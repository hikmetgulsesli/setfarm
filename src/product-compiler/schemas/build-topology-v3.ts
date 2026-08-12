import { z } from "zod";

import { EVIDENCE_RECEIPT_V2_SCHEMA } from
  "../../evidence/schemas/evidence-receipt-v2.js";
import { CANDIDATE_BUILD_RECEIPT_V2_SCHEMA } from
  "../../execution/schemas/candidate-build-receipt-v2.js";

import {
  DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
  canonicalJsonBytesBounded,
} from "../bounded-canonical-json.js";
import {
  canonicalJsonStringify,
  hashCanonicalJson,
} from "../canonical-json.js";
import {
  NormalizedRelativeLocatorSchema,
  PathBindingIdSchema,
  ProductIdSchema,
  Sha256Schema,
  StableReferenceSchema,
  hasUniqueStrings,
} from "./common-v1.js";
import {
  FILE_TREE_MANIFEST_CONTRACT_HASH_V3,
  FILE_TREE_MANIFEST_V3_SCHEMA,
  FILE_TREE_MANIFEST_VERSION_V3,
  FileTreePathEntryV3Schema,
  deriveFileTreePathRefV3,
  hashFileTreePathMembershipV3,
  type FileTreePathEntryV3,
} from "./file-tree-manifest-v3.js";
import {
  BUILD_DEPENDENCY_MATERIALIZATION_RECEIPT_V2_SCHEMA,
  PRIVATE_STAGED_MATERIALIZER_VERSION_V2,
} from "./node-scaffold-private-materialization-v2.js";
import {
  NODE_PRODUCT_RUNTIME_GENERATOR_CONTRACT_HASH_V2,
  NODE_PRODUCT_RUNTIME_GENERATOR_CONTRACT_V2,
  NODE_PRODUCT_RUNTIME_SOURCE_RECEIPT_V2_SCHEMA,
  NODE_PRODUCT_TEST_GENERATOR_CONTRACT_HASH_V2,
  NODE_PRODUCT_TEST_GENERATOR_CONTRACT_V2,
  NODE_PRODUCT_TEST_SOURCE_RECEIPT_V2_SCHEMA,
  hashNodeProductRuntimeGeneratorProfileV2,
  hashNodeProductTestGeneratorProfileV2,
} from "./semantic-realization-plan-v2.js";
import {
  asciiCaseFoldPathV2,
  hashPortablePathCaseFoldIdentityV2,
  hashPortablePathIdentityV2,
  portablePathIssuesV2,
} from "./path-token-v2.js";

export const BUILD_TOPOLOGY_V3_SCHEMA = "setfarm.build-topology.v3" as const;
export const BUILD_TOPOLOGY_VERSION_V3 = "3.2.0" as const;
export const BUILD_TOPOLOGY_MAX_CANONICAL_BYTES_V3 = 4 * 1024 * 1024;
export const BUILD_TOPOLOGY_BOUNDED_WORK_LIMITS_V3 = Object.freeze({
  maxDepth: DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxDepth + 20,
  maxNodes: BUILD_TOPOLOGY_MAX_CANONICAL_BYTES_V3 + 40_000,
  maxContainerEntries:
    DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxContainerEntries,
  maxWorkUnits:
    (BUILD_TOPOLOGY_MAX_CANONICAL_BYTES_V3 * 8) + (2 * 1024 * 1024),
});

export const BUILD_TOPOLOGY_BLOCKER_CODES_V3 = Object.freeze([
  "BUILD_TOPOLOGY_V3_BUILD_EXECUTION_UNVERIFIED",
  "BUILD_TOPOLOGY_V3_CANDIDATE_MATERIALIZATION_UNVERIFIED",
  "BUILD_TOPOLOGY_V3_EVIDENCE_REGISTRY_UNVERIFIED",
  "BUILD_TOPOLOGY_V3_NODE_RUNTIME_SOURCE_RECEIPT_UNVERIFIED",
  "BUILD_TOPOLOGY_V3_NODE_TEST_EXECUTION_UNVERIFIED",
  "BUILD_TOPOLOGY_V3_NODE_TEST_SOURCE_RECEIPT_UNVERIFIED",
  "BUILD_TOPOLOGY_V3_RELEASE_MANIFEST_UNVERIFIED",
] as const);

export const BUILD_TOPOLOGY_BUILD_REQUIRED_PRECONDITIONS_V3 = Object.freeze([
  Object.freeze({
    authorityRef: "NODE_PRODUCT_RUNTIME_SOURCE_RECEIPT_V2" as const,
    receiptSchema: NODE_PRODUCT_RUNTIME_SOURCE_RECEIPT_V2_SCHEMA,
    missingDisposition: "typed_precondition_rejection" as const,
  }),
  Object.freeze({
    authorityRef: "NODE_PRODUCT_TEST_SOURCE_RECEIPT_V2" as const,
    receiptSchema: NODE_PRODUCT_TEST_SOURCE_RECEIPT_V2_SCHEMA,
    missingDisposition: "typed_precondition_rejection" as const,
  }),
] as const);

export const BUILD_TOPOLOGY_TEST_REQUIRED_PRECONDITIONS_V3 = Object.freeze([
  Object.freeze({
    authorityRef: "CANDIDATE_BUILD_RECEIPT_V2" as const,
    receiptSchema: CANDIDATE_BUILD_RECEIPT_V2_SCHEMA,
    missingDisposition: "typed_precondition_rejection" as const,
  }),
  Object.freeze({
    authorityRef: "NODE_PRODUCT_RUNTIME_SOURCE_RECEIPT_V2" as const,
    receiptSchema: NODE_PRODUCT_RUNTIME_SOURCE_RECEIPT_V2_SCHEMA,
    missingDisposition: "typed_precondition_rejection" as const,
  }),
  Object.freeze({
    authorityRef: "NODE_PRODUCT_TEST_SOURCE_RECEIPT_V2" as const,
    receiptSchema: NODE_PRODUCT_TEST_SOURCE_RECEIPT_V2_SCHEMA,
    missingDisposition: "typed_precondition_rejection" as const,
  }),
] as const);

export const BUILD_TOPOLOGY_BUILD_PROCESS_POLICY_V3 = Object.freeze({
  stdin: "closed" as const,
  timeoutMs: 120_000 as const,
  maxStdoutBytes: 1_048_576 as const,
  maxStderrBytes: 1_048_576 as const,
  shell: "forbidden" as const,
  ambientEnvironment: "forbidden" as const,
  outputLimitDisposition: "typed_build_rejection" as const,
  timeoutDisposition: "typed_build_rejection" as const,
  nonzeroOrSignalDisposition: "typed_build_rejection" as const,
});

export const BUILD_TOPOLOGY_CONTRACT_V3 = Object.freeze({
  schema: "setfarm.build-topology-contract.v3" as const,
  contractVersion: BUILD_TOPOLOGY_VERSION_V3,
  stage: "realization_sources_planned_dependencies_ready" as const,
  nativeSourceAuthorities: Object.freeze([
    "verified_file_tree_manifest_v3",
    "fresh_product_runtime_behavior_proposal_v1",
    "fresh_product_runtime_behavior_contract_v1",
    "fresh_node_execution_layout_v2",
    "fresh_node_execution_path_token_set_v2",
    "code_owned_runtime_generator_profile_v2",
    "code_owned_test_generator_profile_v2",
    "authenticated_build_dependency_materialization_receipt_v2",
  ] as const),
  forbiddenNativeInputs: Object.freeze([
    "file_tree_manifest_v2",
    "build_topology_v2",
    "node_entrypoint_source_receipt_v2",
    "node_semantic_rule_generator_transition_v2",
    "npm_run_build",
    "npm_test",
    "story_write_grants",
  ] as const),
  pathCardinality: Object.freeze({
    fileTreeProjections: 6 as const,
    rawDependencyInputs: 1 as const,
    readonlyDependencyCapsules: 1 as const,
    runtimeBuildOutputs: 1 as const,
    testBuildOutputs: 1 as const,
    candidateModules: 1 as const,
    total: 11 as const,
  }),
  commandAuthority: Object.freeze({
    install: "authenticated_completed_npm_ci_v2" as const,
    build: "direct_node_typescript_compiler_target_v3" as const,
    test: "direct_node_test_exact_compiled_file_v3" as const,
    buildProcessPolicy: BUILD_TOPOLOGY_BUILD_PROCESS_POLICY_V3,
    shell: "forbidden" as const,
    packageScriptIndirection: "forbidden" as const,
    defaultTestDiscovery: "forbidden" as const,
  }),
  sourceLifecycle: Object.freeze({
    runtimeSourceReceipt: "absent_blocking" as const,
    testSourceReceipt: "absent_blocking" as const,
    runtimeBuildOutput: "physically_absent_before_build" as const,
    testBuildOutput: "physically_absent_before_build" as const,
    candidateModule: "not_materialized" as const,
    minimumTestCount: 1 as const,
  }),
  dependencyRoles: Object.freeze({
    rawNodeModules: "disposable_compile_only_input" as const,
    readonlyCapsule: "future_candidate_runtime_copy_source" as const,
    generatedNpmLinks: "verified_but_not_execution_authority" as const,
    compilerTarget: "verified_direct_target_bytes" as const,
  }),
  identitySeparation: Object.freeze({
    retryAndSemanticIdentity: "logicalBuildHash" as const,
    executionEvidenceIdentity: "manifestHash" as const,
    hostToolchainLogicalProjection:
      "content_version_abi_without_filesystem_metadata_v3" as const,
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
  blockerCodes: BUILD_TOPOLOGY_BLOCKER_CODES_V3,
  hashDomains: Object.freeze({
    nonRepositoryPathRef: "setfarm.build-topology-path-ref.v3" as const,
    pathAbsence: "setfarm.build-topology-path-absence.v3" as const,
    pathEntry: "setfarm.build-topology-path-entry-hash.v3" as const,
    pathMembership: "setfarm.build-topology-path-membership-hash.v3" as const,
    logicalPathMembership:
      "setfarm.build-topology-logical-path-membership-hash.v3" as const,
    logicalDependency: "setfarm.build-topology-logical-dependency-hash.v3" as const,
    commandContract: "setfarm.build-topology-command-contract-hash.v3" as const,
    compilationContract:
      "setfarm.build-topology-compilation-contract-hash.v3" as const,
    runtimeContract: "setfarm.build-topology-runtime-contract-hash.v3" as const,
    logicalBuild: "setfarm.build-topology-logical-build-hash.v3" as const,
    manifest: "setfarm.build-topology-manifest-hash.v3" as const,
  }),
} as const);

export const BUILD_TOPOLOGY_CONTRACT_HASH_V3 = hashCanonicalJson(
  BUILD_TOPOLOGY_CONTRACT_V3,
);

const BuildTopologyBlockerCodeV3Schema = z.enum(
  BUILD_TOPOLOGY_BLOCKER_CODES_V3,
);
const ProfileIdV3Schema = z.enum([
  "PROFILE_NODE_CLI_STATELESS_EXACT_V2",
  "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2",
]);
const StackPackIdV3Schema = z.enum(["node-cli", "node-express-api"]);
const PhysicalSpaceV3Schema = z.enum([
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

export function deriveBuildTopologyPathRefV3(
  physicalSpace: "candidate_runtime" | "dependency_capsule" | "repository",
  normalizedLocator: string,
): string {
  if (physicalSpace === "repository") {
    return deriveFileTreePathRefV3("repository", normalizedLocator);
  }
  return `PATH_${hashCanonicalJson({
    schema: "setfarm.build-topology-path-ref.v3",
    physicalSpace,
    normalizedLocator,
  }).toUpperCase()}`;
}

export function hashBuildTopologyPathAbsenceV3(
  physicalSpace: "candidate_runtime" | "dependency_capsule" | "repository",
  normalizedLocator: string,
): string {
  return hashCanonicalJson({
    schema: "setfarm.build-topology-path-absence.v3",
    physicalSpace,
    normalizedLocator,
  });
}

const FileTreeProjectionStateV3Schema = z.object({
  state: z.literal("file_tree_v3_projection"),
  fileTreeEntryHash: Sha256Schema,
  projectedState: z.enum(["absent", "present_file"]),
}).strict();

const RawDependencyTreeStateV3Schema = z.object({
  state: z.literal("present_raw_dependency_tree"),
  fileCount: z.number().int().positive().max(100_000),
  directoryCount: z.number().int().positive().max(20_000),
  symbolicLinkCount: z.number().int().nonnegative().max(2_000),
  totalBytes: z.number().int().positive().max(2 * 1024 * 1024 * 1024),
  membershipHash: Sha256Schema,
  mutationPolicy: z.literal("private_disposable_install_output_v2"),
}).strict();

const DependencyCapsuleStateV3Schema = z.object({
  state: z.literal("present_readonly_dependency_capsule"),
  treeHash: Sha256Schema,
  payloadHash: Sha256Schema,
  rootMode: z.literal("0555"),
  fileCount: z.number().int().positive().max(100_000),
  directoryCount: z.number().int().nonnegative().max(20_000),
  totalBytes: z.number().int().positive().max(2 * 1024 * 1024 * 1024),
}).strict();

const AbsentPathStateV3Schema = z.object({
  state: z.literal("absent"),
  absenceHash: Sha256Schema,
  evidence: z.literal("authenticated_dependency_stage_exact_project_inventory_v2"),
}).strict();

const PlannedPathStateV3Schema = z.object({
  state: z.literal("not_materialized"),
  disposition: z.literal("future_candidate_materialization_only"),
}).strict();

export const BuildTopologyPathStateV3Schema = z.discriminatedUnion("state", [
  FileTreeProjectionStateV3Schema,
  RawDependencyTreeStateV3Schema,
  DependencyCapsuleStateV3Schema,
  AbsentPathStateV3Schema,
  PlannedPathStateV3Schema,
]);

const FileTreePathAuthorityV3Schema = z.object({
  kind: z.literal("file_tree_v3_path"),
  fileTreeManifestHash: Sha256Schema,
  fileTreeEntryHash: Sha256Schema,
}).strict();

const RawDependencyAuthorityV3Schema = z.object({
  kind: z.literal("raw_dependency_build_input"),
  dependencyReceiptHash: Sha256Schema,
  logicalDependencyHash: Sha256Schema,
  use: z.literal("disposable_compile_only_input"),
  generatedNpmLinks: z.literal("verified_not_execution_authority"),
}).strict();

const DependencyCapsuleAuthorityV3Schema = z.object({
  kind: z.literal("readonly_dependency_runtime_capsule"),
  dependencyReceiptHash: Sha256Schema,
  logicalDependencyHash: Sha256Schema,
  use: z.literal("future_candidate_runtime_copy_source"),
  generatedNpmLinks: z.literal("excluded"),
}).strict();

const RuntimeBuildOutputAuthorityV3Schema = z.object({
  kind: z.literal("runtime_build_output_plan"),
  layoutHash: Sha256Schema,
  sourcePathRef: PathBindingIdSchema,
  sourcePathSlotRef: z.enum([
    "PATH_SLOT_NODE_CLI_SOURCE_ENTRYPOINT_V2",
    "PATH_SLOT_NODE_API_SOURCE_ENTRYPOINT_V2",
  ]),
  outputPathSlotRef: z.enum([
    "PATH_SLOT_NODE_CLI_BUILD_OUTPUT_V2",
    "PATH_SLOT_NODE_API_BUILD_OUTPUT_V2",
  ]),
  pathToken: Sha256Schema,
  tokenBindingHash: Sha256Schema,
  requiredReceiptSchema: z.literal(CANDIDATE_BUILD_RECEIPT_V2_SCHEMA),
  receiptState: z.literal("absent"),
}).strict();

const TestBuildOutputAuthorityV3Schema = z.object({
  kind: z.literal("test_build_output_plan"),
  sourcePathRef: PathBindingIdSchema,
  generatorContractHash: z.literal(NODE_PRODUCT_TEST_GENERATOR_CONTRACT_HASH_V2),
  generatorProfileHash: Sha256Schema,
  profileSourcePathRef: z.enum([
    "PATH_NODE_CLI_GENERATED_TEST_SOURCE_V2",
    "PATH_NODE_API_GENERATED_TEST_SOURCE_V2",
  ]),
  profileCompiledPathRef: z.enum([
    "PATH_NODE_CLI_GENERATED_TEST_OUTPUT_V2",
    "PATH_NODE_API_GENERATED_TEST_OUTPUT_V2",
  ]),
  runtimeImportSpecifier: z.enum(["./cli.js", "./app.js"]),
  requiredReceiptSchema: z.literal(CANDIDATE_BUILD_RECEIPT_V2_SCHEMA),
  receiptState: z.literal("absent"),
}).strict();

const CandidateModuleAuthorityV3Schema = z.object({
  kind: z.literal("candidate_module_plan"),
  layoutHash: Sha256Schema,
  runtimeBuildOutputPathRef: PathBindingIdSchema,
  pathSlotRef: z.enum([
    "PATH_SLOT_NODE_CLI_CANDIDATE_MODULE_V2",
    "PATH_SLOT_NODE_API_CANDIDATE_MODULE_V2",
  ]),
  pathToken: Sha256Schema,
  tokenBindingHash: Sha256Schema,
  requiredReceiptSchema: z.literal(CANDIDATE_BUILD_RECEIPT_V2_SCHEMA),
  materializationState: z.literal("absent"),
}).strict();

export const BuildTopologyPathAuthorityV3Schema = z.discriminatedUnion("kind", [
  FileTreePathAuthorityV3Schema,
  RawDependencyAuthorityV3Schema,
  DependencyCapsuleAuthorityV3Schema,
  RuntimeBuildOutputAuthorityV3Schema,
  TestBuildOutputAuthorityV3Schema,
  CandidateModuleAuthorityV3Schema,
]);

const BuildTopologyOwnerRefV3Schema = z.enum([
  "OWNER_NODE_CANDIDATE_MATERIALIZER_V3",
  "OWNER_NODE_PRODUCT_BUILD_EXECUTOR_V3",
  "OWNER_NODE_PRODUCT_RUNTIME_GENERATOR_V2",
  "OWNER_NODE_PRODUCT_TEST_GENERATOR_V2",
  "OWNER_SETUP_V3",
]);

const BuildTopologyPathEntryIdentityV3Schema = z.object({
  pathRef: PathBindingIdSchema,
  physicalSpace: PhysicalSpaceV3Schema,
  normalizedLocator: NormalizedRelativeLocatorSchema,
  pathIdentityHash: Sha256Schema,
  caseFoldPathIdentityHash: Sha256Schema,
  classification: z.enum([
    "candidate_module",
    "config",
    "config_absence",
    "generated_runtime_source",
    "generated_test_source",
    "raw_dependency_build_input",
    "readonly_dependency_runtime_capsule",
    "runtime_build_output",
    "test_build_output",
  ]),
  ownerRef: BuildTopologyOwnerRefV3Schema,
  writeGrantOwnerRefs: z.tuple([]),
  access: z.enum([
    "build_generated_future",
    "candidate_generated_future",
    "dependency_compile_input",
    "dependency_runtime_readonly",
    "forbidden",
    "generator_whole_file_future",
    "setup_readonly",
  ]),
  currentState: BuildTopologyPathStateV3Schema,
  authority: BuildTopologyPathAuthorityV3Schema,
}).strict();

export type BuildTopologyPathEntryHashPayloadV3 = z.infer<
  typeof BuildTopologyPathEntryIdentityV3Schema
>;

export function hashBuildTopologyPathEntryV3(
  value: BuildTopologyPathEntryHashPayloadV3 | BuildTopologyPathEntryV3,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.entryHash;
  return hashCanonicalJson({
    schema: "setfarm.build-topology-path-entry-hash.v3",
    entry: payload,
  });
}

export const BuildTopologyPathEntryV3Schema =
  BuildTopologyPathEntryIdentityV3Schema.extend({
    entryHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    for (const issue of portablePathIssuesV2(
      value.normalizedLocator,
      { allowEmpty: false },
    )) {
      context.addIssue({
        code: "custom",
        path: ["normalizedLocator"],
        message: issue,
      });
    }
    if (
      value.pathRef
        !== deriveBuildTopologyPathRefV3(value.physicalSpace, value.normalizedLocator)
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
        message: "V3 topology path identity must bind exact physical space and locator",
      });
    }
    if (
      value.currentState.state === "absent"
      && value.currentState.absenceHash !== hashBuildTopologyPathAbsenceV3(
        value.physicalSpace,
        value.normalizedLocator,
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["currentState", "absenceHash"],
        message: "V3 topology absences require canonical path-specific evidence",
      });
    }
    if (value.entryHash !== hashBuildTopologyPathEntryV3(value)) {
      context.addIssue({
        code: "custom",
        path: ["entryHash"],
        message: "V3 topology path entry hash must bind the complete entry",
      });
    }
  });

export type BuildTopologyPathEntryV3 = z.infer<
  typeof BuildTopologyPathEntryV3Schema
>;

function logicalPathProjectionV3(entry: BuildTopologyPathEntryV3) {
  const authority = { ...entry.authority } as Record<string, unknown>;
  if (
    entry.authority.kind === "raw_dependency_build_input"
    || entry.authority.kind === "readonly_dependency_runtime_capsule"
  ) {
    delete authority.dependencyReceiptHash;
  }
  return {
    pathRef: entry.pathRef,
    physicalSpace: entry.physicalSpace,
    normalizedLocator: entry.normalizedLocator,
    classification: entry.classification,
    ownerRef: entry.ownerRef,
    writeGrantOwnerRefs: entry.writeGrantOwnerRefs,
    access: entry.access,
    currentState: entry.currentState,
    authority,
  };
}

export function hashBuildTopologyPathMembershipV3(
  paths: readonly Pick<BuildTopologyPathEntryV3, "pathRef" | "entryHash">[],
): string {
  return hashCanonicalJson({
    schema: "setfarm.build-topology-path-membership-hash.v3",
    paths: paths.map((path) => ({
      pathRef: path.pathRef,
      entryHash: path.entryHash,
    })),
  });
}

export function hashBuildTopologyLogicalPathMembershipV3(
  paths: readonly BuildTopologyPathEntryV3[],
): string {
  return hashCanonicalJson({
    schema: "setfarm.build-topology-logical-path-membership-hash.v3",
    paths: paths.map(logicalPathProjectionV3),
  });
}

const TypeScriptCompilerTargetV3Schema = z.object({
  executableRef: z.literal("TOOL_NODE_TYPESCRIPT_TSC_V2"),
  exactVersion: z.literal("5.9.3"),
  commandName: z.literal("tsc"),
  packagePath: z.literal("node_modules/typescript"),
  linkLocator: z.literal("node_modules/.bin/tsc"),
  targetLocator: z.literal("node_modules/typescript/bin/tsc"),
  linkTargetHash: Sha256Schema,
  targetContentHash: Sha256Schema,
  executionDisposition: z.literal("direct_target_via_authenticated_node_runtime"),
}).strict();

export type TypeScriptCompilerTargetV3 = z.infer<
  typeof TypeScriptCompilerTargetV3Schema
>;

export const BuildTopologyLogicalDependencyV3Schema = z.object({
  catalogHash: Sha256Schema,
  scaffoldEntryHash: Sha256Schema,
  dependencyGraphHash: Sha256Schema,
  environmentContractHash: Sha256Schema,
  effectiveConfigHash: Sha256Schema,
  nodeRuntimeLogicalHash: Sha256Schema,
  npmClosureLogicalHash: Sha256Schema,
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
  typescriptCompiler: TypeScriptCompilerTargetV3Schema,
  rawInstallTree: RawDependencyTreeStateV3Schema.omit({ state: true }),
  dependencyCapsule: DependencyCapsuleStateV3Schema.omit({ state: true }),
  dependencyCapsuleAuthorityHash: Sha256Schema,
}).strict();

export type BuildTopologyLogicalDependencyV3 = z.infer<
  typeof BuildTopologyLogicalDependencyV3Schema
>;

export function hashBuildTopologyLogicalDependencyV3(
  value: BuildTopologyLogicalDependencyV3,
): string {
  return hashCanonicalJson({
    schema: "setfarm.build-topology-logical-dependency-hash.v3",
    dependency: value,
  });
}

const RequiredPreconditionV3Schema = z.object({
  authorityRef: StableReferenceSchema,
  receiptSchema: z.string().min(1).max(200),
  missingDisposition: z.literal("typed_precondition_rejection"),
}).strict();

const BuildCommandV3Schema = z.object({
  commandRef: z.literal("CMD_NODE_PRODUCT_BUILD_V3"),
  executableRef: z.literal("TOOL_NODE_RUNTIME_V2"),
  compilerExecutableRef: z.literal("TOOL_NODE_TYPESCRIPT_TSC_V2"),
  compilerTarget: TypeScriptCompilerTargetV3Schema,
  cwdRootRef: z.literal("PATH_ROOT_NODE_REPOSITORY_V2"),
  directArgv: z.tuple([
    z.literal("node"),
    z.literal("node_modules/typescript/bin/tsc"),
    z.literal("-p"),
    z.literal("tsconfig.json"),
  ]),
  shell: z.literal("forbidden"),
  processPolicy: z.object({
    stdin: z.literal("closed"),
    timeoutMs: z.literal(120_000),
    maxStdoutBytes: z.literal(1_048_576),
    maxStderrBytes: z.literal(1_048_576),
    shell: z.literal("forbidden"),
    ambientEnvironment: z.literal("forbidden"),
    outputLimitDisposition: z.literal("typed_build_rejection"),
    timeoutDisposition: z.literal("typed_build_rejection"),
    nonzeroOrSignalDisposition: z.literal("typed_build_rejection"),
  }).strict(),
  requiredPreconditions: z.array(RequiredPreconditionV3Schema)
    .length(BUILD_TOPOLOGY_BUILD_REQUIRED_PRECONDITIONS_V3.length),
  runtimeSourceReceiptState: z.literal("absent"),
  testSourceReceiptState: z.literal("absent"),
  buildReceiptSchema: z.literal(CANDIDATE_BUILD_RECEIPT_V2_SCHEMA),
  buildReceiptState: z.literal("absent"),
  executionStatus: z.literal("blocked_until_runtime_and_test_source_receipts"),
}).strict();

const TestCommandCommonV3Shape = {
  commandRef: z.literal("CMD_NODE_PRODUCT_TEST_V3"),
  executableRef: z.literal("TOOL_NODE_RUNTIME_V2"),
  cwdRootRef: z.literal("PATH_ROOT_NODE_REPOSITORY_V2"),
  shell: z.literal("forbidden"),
  runnerAbi: z.literal("NODE_TEST_RUNNER_DIRECT_FILE_ABI_V2"),
  requiredPreconditions: z.array(RequiredPreconditionV3Schema)
    .length(BUILD_TOPOLOGY_TEST_REQUIRED_PRECONDITIONS_V3.length),
  canonicalReceiptSchema: z.literal(EVIDENCE_RECEIPT_V2_SCHEMA),
  minimumTestCount: z.literal(1),
  zeroTestReceipt: z.literal("forbidden"),
  networkPolicy: z.literal("forbidden"),
  executionStatus: z.literal("blocked_until_build_and_source_receipts"),
} as const;

const TestCommandV3Schema = z.discriminatedUnion("profileId", [
  z.object({
    ...TestCommandCommonV3Shape,
    profileId: z.literal("PROFILE_NODE_CLI_STATELESS_EXACT_V2"),
    directArgv: z.tuple([
      z.literal("node"),
      z.literal("--test"),
      z.literal("dist/cli.setfarm.test.js"),
    ]),
    subprocessPolicy: z.literal("exact_same_runtime_cli_module_only"),
  }).strict(),
  z.object({
    ...TestCommandCommonV3Shape,
    profileId: z.literal("PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2"),
    directArgv: z.tuple([
      z.literal("node"),
      z.literal("--test"),
      z.literal("dist/app.setfarm.test.js"),
    ]),
    subprocessPolicy: z.literal("forbidden"),
  }).strict(),
]);

export const BuildTopologyCommandsV3Schema = z.object({
  environmentContractHash: Sha256Schema,
  effectiveConfigHash: Sha256Schema,
  nodeRuntimeLogicalHash: Sha256Schema,
  ambientEnvironment: z.literal("forbidden"),
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
  build: BuildCommandV3Schema,
  test: TestCommandV3Schema,
}).strict().superRefine((value, context) => {
  if (
    canonicalJsonStringify(value.build.requiredPreconditions)
      !== canonicalJsonStringify(BUILD_TOPOLOGY_BUILD_REQUIRED_PRECONDITIONS_V3)
    || canonicalJsonStringify(value.test.requiredPreconditions)
      !== canonicalJsonStringify(BUILD_TOPOLOGY_TEST_REQUIRED_PRECONDITIONS_V3)
    || value.build.compilerTarget.targetLocator !== value.build.directArgv[1]
    || canonicalJsonStringify(value.build.processPolicy)
      !== canonicalJsonStringify(BUILD_TOPOLOGY_BUILD_PROCESS_POLICY_V3)
    || value.build.processPolicy.shell !== value.build.shell
    || value.build.processPolicy.ambientEnvironment !== value.ambientEnvironment
  ) {
    context.addIssue({
      code: "custom",
      path: ["build", "requiredPreconditions"],
      message: "V3 build/test commands must equal exact code-owned direct authority",
    });
  }
});

export type BuildTopologyCommandsV3 = z.infer<
  typeof BuildTopologyCommandsV3Schema
>;

export const BuildTopologyCommandContractV3Schema = z.object({
  environmentContractHash: Sha256Schema,
  effectiveConfigHash: Sha256Schema,
  nodeRuntimeLogicalHash: Sha256Schema,
  ambientEnvironment: z.literal("forbidden"),
  install: BuildTopologyCommandsV3Schema.shape.install.pick({
    commandRef: true,
    executableRef: true,
    cwdRootRef: true,
    directArgv: true,
  }),
  build: BuildTopologyCommandsV3Schema.shape.build,
  test: BuildTopologyCommandsV3Schema.shape.test,
}).strict();

export type BuildTopologyCommandContractV3 = z.infer<
  typeof BuildTopologyCommandContractV3Schema
>;

function rawBuildTopologyCommandContractProjectionV3(
  value: BuildTopologyCommandsV3,
) {
  return {
    environmentContractHash: value.environmentContractHash,
    effectiveConfigHash: value.effectiveConfigHash,
    nodeRuntimeLogicalHash: value.nodeRuntimeLogicalHash,
    ambientEnvironment: value.ambientEnvironment,
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

export function projectBuildTopologyCommandContractV3(
  value: BuildTopologyCommandsV3,
): BuildTopologyCommandContractV3 {
  return BuildTopologyCommandContractV3Schema.parse(
    rawBuildTopologyCommandContractProjectionV3(value),
  );
}

export function hashBuildTopologyCommandContractV3(
  value: BuildTopologyCommandsV3 | BuildTopologyCommandContractV3,
): string {
  const commands = "dependencyReceiptHash" in value.install
    ? rawBuildTopologyCommandContractProjectionV3(
        value as BuildTopologyCommandsV3,
      )
    : value;
  return hashCanonicalJson({
    schema: "setfarm.build-topology-command-contract-hash.v3",
    commands,
  });
}

export const BuildTopologyRuntimeTargetV3Schema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("cli"),
    launcherRef: z.literal("LAUNCH_NODE_CLI_V2"),
    entrypointAbi: z.literal("NODE_ESM_CLI_ENTRYPOINT_ABI_V2"),
    argvOwnership: z.literal("executable_invocation_transport_binding_v2"),
    nodeOptionTokens: z.tuple([]),
    candidateModulePathRef: PathBindingIdSchema,
    transportArguments: z.literal("append_after_module"),
    executionStatus: z.literal("blocked_until_candidate_and_release_manifest"),
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
    executionStatus: z.literal("blocked_until_candidate_and_release_manifest"),
  }).strict(),
]);

export type BuildTopologyRuntimeTargetV3 = z.infer<
  typeof BuildTopologyRuntimeTargetV3Schema
>;

export function hashBuildTopologyRuntimeContractV3(
  value: BuildTopologyRuntimeTargetV3,
): string {
  return hashCanonicalJson({
    schema: "setfarm.build-topology-runtime-contract-hash.v3",
    runtime: value,
  });
}

export const BuildTopologyCompilationV3Schema = z.object({
  profileId: ProfileIdV3Schema,
  layoutHash: Sha256Schema,
  moduleSystem: z.literal("node_esm"),
  runtime: z.object({
    sourcePathRef: PathBindingIdSchema,
    outputPathRef: PathBindingIdSchema,
    sourceNormalizedLocator: z.enum(["src/cli.ts", "src/app.ts"]),
    outputNormalizedLocator: z.enum(["dist/cli.js", "dist/app.js"]),
    sourceMediaType: z.literal("text/typescript"),
    outputMediaType: z.literal("text/javascript"),
    generatorContractHash: z.literal(NODE_PRODUCT_RUNTIME_GENERATOR_CONTRACT_HASH_V2),
    generatorProfileHash: Sha256Schema,
    sourceReceipt: z.object({
      schema: z.literal(NODE_PRODUCT_RUNTIME_SOURCE_RECEIPT_V2_SCHEMA),
      state: z.literal("absent"),
      missingDisposition: z.literal("typed_precondition_rejection"),
    }).strict(),
    realizationCount: z.number().int().positive().max(20_000),
    realizationMembershipHash: Sha256Schema,
  }).strict(),
  test: z.object({
    sourcePathRef: PathBindingIdSchema,
    outputPathRef: PathBindingIdSchema,
    sourceNormalizedLocator: z.enum([
      "src/cli.setfarm.test.ts",
      "src/app.setfarm.test.ts",
    ]),
    outputNormalizedLocator: z.enum([
      "dist/cli.setfarm.test.js",
      "dist/app.setfarm.test.js",
    ]),
    profileSourcePathRef: z.enum([
      "PATH_NODE_CLI_GENERATED_TEST_SOURCE_V2",
      "PATH_NODE_API_GENERATED_TEST_SOURCE_V2",
    ]),
    profileCompiledPathRef: z.enum([
      "PATH_NODE_CLI_GENERATED_TEST_OUTPUT_V2",
      "PATH_NODE_API_GENERATED_TEST_OUTPUT_V2",
    ]),
    runtimeImportSpecifier: z.enum(["./cli.js", "./app.js"]),
    runnerAbi: z.literal("NODE_TEST_RUNNER_DIRECT_FILE_ABI_V2"),
    generatorContractHash: z.literal(NODE_PRODUCT_TEST_GENERATOR_CONTRACT_HASH_V2),
    generatorProfileHash: Sha256Schema,
    sourceReceipt: z.object({
      schema: z.literal(NODE_PRODUCT_TEST_SOURCE_RECEIPT_V2_SCHEMA),
      state: z.literal("absent"),
      missingDisposition: z.literal("typed_precondition_rejection"),
    }).strict(),
    coverageCount: z.number().int().positive().max(20_000),
    coverageMembershipHash: Sha256Schema,
  }).strict(),
  candidate: z.object({
    runtimeBuildOutputPathRef: PathBindingIdSchema,
    candidateModulePathRef: PathBindingIdSchema,
    requiredBuildReceiptSchema: z.literal(CANDIDATE_BUILD_RECEIPT_V2_SCHEMA),
    buildReceiptState: z.literal("absent"),
    materializationState: z.literal("not_materialized"),
  }).strict(),
}).strict();

export type BuildTopologyCompilationV3 = z.infer<
  typeof BuildTopologyCompilationV3Schema
>;

export function hashBuildTopologyCompilationContractV3(
  value: BuildTopologyCompilationV3,
): string {
  return hashCanonicalJson({
    schema: "setfarm.build-topology-compilation-contract-hash.v3",
    compilation: value,
  });
}

const BuildTopologyLogicalIdentityV3Schema = z.object({
  schema: z.literal(BUILD_TOPOLOGY_V3_SCHEMA),
  topologyVersion: z.literal(BUILD_TOPOLOGY_VERSION_V3),
  contractHash: z.literal(BUILD_TOPOLOGY_CONTRACT_HASH_V3),
  stage: z.literal("realization_sources_planned_dependencies_ready"),
  readiness: z.object({
    status: z.literal("shadow_blocked"),
    productionUse: z.literal("forbidden"),
    blockerCodes: z.array(BuildTopologyBlockerCodeV3Schema)
      .length(BUILD_TOPOLOGY_BLOCKER_CODES_V3.length),
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
    fileTree: z.object({
      schema: z.literal(FILE_TREE_MANIFEST_V3_SCHEMA),
      version: z.literal(FILE_TREE_MANIFEST_VERSION_V3),
      contractHash: z.literal(FILE_TREE_MANIFEST_CONTRACT_HASH_V3),
      manifestHash: Sha256Schema,
      pathCount: z.literal(6),
      pathMembershipHash: Sha256Schema,
      ownerMembershipHash: Sha256Schema,
      semanticRealizationPlanHash: Sha256Schema,
      runtimeBehaviorProposalHash: Sha256Schema,
      runtimeBehaviorContractHash: Sha256Schema,
      runtimeRealizationMembershipHash: Sha256Schema,
      testCoverageMembershipHash: Sha256Schema,
    }).strict(),
    layoutRef: StableReferenceSchema,
    layoutHash: Sha256Schema,
    pathTokenSetHash: Sha256Schema,
    scaffoldCatalogHash: Sha256Schema,
    scaffoldEntryHash: Sha256Schema,
    logicalDependencyHash: Sha256Schema,
    logicalPathMembershipHash: Sha256Schema,
    commandContractHash: Sha256Schema,
    compilationContractHash: Sha256Schema,
    runtimeContractHash: Sha256Schema,
  }).strict(),
}).strict();

export type BuildTopologyLogicalIdentityV3 = z.infer<
  typeof BuildTopologyLogicalIdentityV3Schema
>;

export function hashBuildTopologyLogicalBuildV3(
  value: BuildTopologyLogicalIdentityV3 | BuildTopologyV3,
): string {
  return hashCanonicalJson({
    schema: "setfarm.build-topology-logical-build-hash.v3",
    topology: {
      schema: value.schema,
      topologyVersion: value.topologyVersion,
      contractHash: value.contractHash,
      stage: value.stage,
      readiness: value.readiness,
      authority: value.authority,
    },
  });
}

const BuildTopologyManifestIdentityV3Schema =
  BuildTopologyLogicalIdentityV3Schema.extend({
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
      evidenceAuthority: z.literal(
        "authenticated_private_dependency_stage_fresh_revalidation_v2",
      ),
    }).strict(),
    dependency: z.object({
      logical: BuildTopologyLogicalDependencyV3Schema,
      logicalDependencyHash: Sha256Schema,
      rawBuildInputPathRef: PathBindingIdSchema,
      runtimeCapsulePathRef: PathBindingIdSchema,
    }).strict(),
    pathCount: z.literal(11),
    paths: z.array(BuildTopologyPathEntryV3Schema).length(11),
    pathMembershipHash: Sha256Schema,
    compilation: BuildTopologyCompilationV3Schema,
    commands: BuildTopologyCommandsV3Schema,
    runtimeTarget: BuildTopologyRuntimeTargetV3Schema,
    logicalBuildHash: Sha256Schema,
  }).strict();

export type BuildTopologyManifestHashPayloadV3 = z.infer<
  typeof BuildTopologyManifestIdentityV3Schema
>;

export function hashBuildTopologyManifestV3(
  value: BuildTopologyManifestHashPayloadV3 | BuildTopologyV3,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.manifestHash;
  return hashCanonicalJson({
    schema: "setfarm.build-topology-manifest-hash.v3",
    topology: payload,
  });
}

function expectedProfileV3(stackPackId: "node-cli" | "node-express-api") {
  return stackPackId === "node-cli"
    ? {
        profileId: "PROFILE_NODE_CLI_STATELESS_EXACT_V2" as const,
        runtimeSource: "src/cli.ts" as const,
        runtimeOutput: "dist/cli.js" as const,
        testSource: "src/cli.setfarm.test.ts" as const,
        testOutput: "dist/cli.setfarm.test.js" as const,
        testSourceRef: "PATH_NODE_CLI_GENERATED_TEST_SOURCE_V2" as const,
        testOutputRef: "PATH_NODE_CLI_GENERATED_TEST_OUTPUT_V2" as const,
        runtimeImportSpecifier: "./cli.js" as const,
        candidate: "candidate-bundle/application/cli.js" as const,
        runtimeKind: "cli" as const,
      }
    : {
        profileId: "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2" as const,
        runtimeSource: "src/app.ts" as const,
        runtimeOutput: "dist/app.js" as const,
        testSource: "src/app.setfarm.test.ts" as const,
        testOutput: "dist/app.setfarm.test.js" as const,
        testSourceRef: "PATH_NODE_API_GENERATED_TEST_SOURCE_V2" as const,
        testOutputRef: "PATH_NODE_API_GENERATED_TEST_OUTPUT_V2" as const,
        runtimeImportSpecifier: "./app.js" as const,
        candidate: "candidate-bundle/application/app.js" as const,
        runtimeKind: "http_handler" as const,
      };
}

function addBuildTopologyClosureIssuesV3(
  value: BuildTopologyManifestHashPayloadV3 & { manifestHash: string },
  context: z.RefinementCtx,
): void {
  if (
    canonicalJsonStringify(value.readiness.blockerCodes)
      !== canonicalJsonStringify(BUILD_TOPOLOGY_BLOCKER_CODES_V3)
  ) {
    context.addIssue({
      code: "custom",
      path: ["readiness", "blockerCodes"],
      message: "V3 topology blockers must equal the exact code-owned set",
    });
  }

  const pathKeys = value.paths.map((entry) =>
    `${entry.physicalSpace}\0${entry.normalizedLocator}`);
  const foldedKeys = value.paths.map((entry) =>
    `${entry.physicalSpace}\0${asciiCaseFoldPathV2(entry.normalizedLocator)}`);
  if (
    !canonicalStrings(pathKeys)
    || !hasUniqueStrings(value.paths.map((entry) => entry.pathRef))
    || !hasUniqueStrings(foldedKeys)
    || value.pathMembershipHash !== hashBuildTopologyPathMembershipV3(value.paths)
    || value.authority.logicalPathMembershipHash
      !== hashBuildTopologyLogicalPathMembershipV3(value.paths)
  ) {
    context.addIssue({
      code: "custom",
      path: ["paths"],
      message: "V3 topology paths must be canonical, portable and hash-bound",
    });
  }

  const fileTreePaths = value.paths.filter((entry) =>
    entry.authority.kind === "file_tree_v3_path");
  const fileTreeMembership = fileTreePaths.map((entry) => ({
    pathRef: entry.pathRef,
    entryHash: entry.authority.kind === "file_tree_v3_path"
      ? entry.authority.fileTreeEntryHash
      : "",
  }));
  if (
    fileTreePaths.length !== value.authority.fileTree.pathCount
    || hashFileTreePathMembershipV3(fileTreeMembership)
      !== value.authority.fileTree.pathMembershipHash
    || fileTreePaths.some((entry) =>
      entry.authority.kind !== "file_tree_v3_path"
      || entry.authority.fileTreeManifestHash !== value.authority.fileTree.manifestHash
      || entry.currentState.state !== "file_tree_v3_projection"
      || entry.currentState.fileTreeEntryHash !== entry.authority.fileTreeEntryHash)
  ) {
    context.addIssue({
      code: "custom",
      path: ["paths"],
      message: "Every-and-only V3 FileTree path must survive exact projection",
    });
  }

  const raw = value.paths.filter((entry) =>
    entry.authority.kind === "raw_dependency_build_input");
  const capsule = value.paths.filter((entry) =>
    entry.authority.kind === "readonly_dependency_runtime_capsule");
  const runtimeOutput = value.paths.filter((entry) =>
    entry.authority.kind === "runtime_build_output_plan");
  const testOutput = value.paths.filter((entry) =>
    entry.authority.kind === "test_build_output_plan");
  const candidate = value.paths.filter((entry) =>
    entry.authority.kind === "candidate_module_plan");
  if (
    raw.length !== 1
    || capsule.length !== 1
    || runtimeOutput.length !== 1
    || testOutput.length !== 1
    || candidate.length !== 1
    || raw[0]?.pathRef !== value.dependency.rawBuildInputPathRef
    || capsule[0]?.pathRef !== value.dependency.runtimeCapsulePathRef
    || raw[0]?.normalizedLocator !== "node_modules"
    || raw[0]?.physicalSpace !== "repository"
    || raw[0]?.classification !== "raw_dependency_build_input"
    || raw[0]?.ownerRef !== "OWNER_SETUP_V3"
    || raw[0]?.access !== "dependency_compile_input"
    || raw[0]?.currentState.state !== "present_raw_dependency_tree"
    || capsule[0]?.normalizedLocator !== "node_modules"
    || capsule[0]?.physicalSpace !== "dependency_capsule"
    || capsule[0]?.classification !== "readonly_dependency_runtime_capsule"
    || capsule[0]?.ownerRef !== "OWNER_SETUP_V3"
    || capsule[0]?.access !== "dependency_runtime_readonly"
    || capsule[0]?.currentState.state !== "present_readonly_dependency_capsule"
    || runtimeOutput[0]?.physicalSpace !== "repository"
    || runtimeOutput[0]?.classification !== "runtime_build_output"
    || runtimeOutput[0]?.ownerRef !== "OWNER_NODE_PRODUCT_BUILD_EXECUTOR_V3"
    || runtimeOutput[0]?.access !== "build_generated_future"
    || runtimeOutput[0]?.currentState.state !== "absent"
    || testOutput[0]?.physicalSpace !== "repository"
    || testOutput[0]?.classification !== "test_build_output"
    || testOutput[0]?.ownerRef !== "OWNER_NODE_PRODUCT_BUILD_EXECUTOR_V3"
    || testOutput[0]?.access !== "build_generated_future"
    || testOutput[0]?.currentState.state !== "absent"
    || candidate[0]?.physicalSpace !== "candidate_runtime"
    || candidate[0]?.classification !== "candidate_module"
    || candidate[0]?.ownerRef !== "OWNER_NODE_CANDIDATE_MATERIALIZER_V3"
    || candidate[0]?.access !== "candidate_generated_future"
    || candidate[0]?.currentState.state !== "not_materialized"
  ) {
    context.addIssue({
      code: "custom",
      path: ["paths"],
      message: "V3 dependency, output and candidate roles must occur exactly once",
    });
  }

  const dependencyReceiptHash = value.operationalEvidence.dependencyReceiptHash;
  if (
    value.dependency.logicalDependencyHash
      !== hashBuildTopologyLogicalDependencyV3(value.dependency.logical)
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
    || canonicalJsonStringify(value.commands.build.compilerTarget)
      !== canonicalJsonStringify(value.dependency.logical.typescriptCompiler)
    || value.commands.nodeRuntimeLogicalHash
      !== value.dependency.logical.nodeRuntimeLogicalHash
  ) {
    context.addIssue({
      code: "custom",
      path: ["dependency"],
      message: "V3 logical dependency, compiler target and operational receipt must join",
    });
  }

  const runtimeSource = value.paths.find((entry) =>
    entry.pathRef === value.compilation.runtime.sourcePathRef);
  const testSource = value.paths.find((entry) =>
    entry.pathRef === value.compilation.test.sourcePathRef);
  const expected = expectedProfileV3(value.authority.stackPackId);
  const runtimeProfile = NODE_PRODUCT_RUNTIME_GENERATOR_CONTRACT_V2.profiles.find(
    (profile) => profile.profileId === expected.profileId,
  );
  const testProfile = NODE_PRODUCT_TEST_GENERATOR_CONTRACT_V2.profiles.find(
    (profile) => profile.profileId === expected.profileId,
  );
  if (
    value.authority.profileId !== expected.profileId
    || value.compilation.profileId !== expected.profileId
    || value.commands.test.profileId !== expected.profileId
    || runtimeSource?.normalizedLocator !== expected.runtimeSource
    || runtimeSource?.classification !== "generated_runtime_source"
    || runtimeSource.ownerRef !== "OWNER_NODE_PRODUCT_RUNTIME_GENERATOR_V2"
    || testSource?.normalizedLocator !== expected.testSource
    || testSource?.classification !== "generated_test_source"
    || testSource.ownerRef !== "OWNER_NODE_PRODUCT_TEST_GENERATOR_V2"
    || runtimeOutput[0]?.normalizedLocator !== expected.runtimeOutput
    || testOutput[0]?.normalizedLocator !== expected.testOutput
    || candidate[0]?.normalizedLocator !== expected.candidate
    || value.compilation.runtime.sourceNormalizedLocator !== expected.runtimeSource
    || value.compilation.runtime.outputNormalizedLocator !== expected.runtimeOutput
    || value.compilation.test.sourceNormalizedLocator !== expected.testSource
    || value.compilation.test.outputNormalizedLocator !== expected.testOutput
    || value.compilation.test.profileSourcePathRef !== expected.testSourceRef
    || value.compilation.test.profileCompiledPathRef !== expected.testOutputRef
    || value.compilation.test.runtimeImportSpecifier
      !== expected.runtimeImportSpecifier
    || value.commands.test.directArgv[2] !== expected.testOutput
    || value.runtimeTarget.kind !== expected.runtimeKind
    || !runtimeProfile
    || runtimeProfile.stackPackId !== value.authority.stackPackId
    || value.compilation.runtime.generatorProfileHash
      !== hashNodeProductRuntimeGeneratorProfileV2(runtimeProfile)
    || !testProfile
    || testProfile.stackPackId !== value.authority.stackPackId
    || value.compilation.test.generatorProfileHash
      !== hashNodeProductTestGeneratorProfileV2(testProfile)
  ) {
    context.addIssue({
      code: "custom",
      path: ["compilation"],
      message: "V3 source, output, command, profile and runtime ABI must close exactly",
    });
  }

  if (
    runtimeOutput[0]?.pathRef !== value.compilation.runtime.outputPathRef
    || testOutput[0]?.pathRef !== value.compilation.test.outputPathRef
    || candidate[0]?.pathRef !== value.compilation.candidate.candidateModulePathRef
    || runtimeOutput[0]?.authority.kind !== "runtime_build_output_plan"
    || runtimeOutput[0].authority.sourcePathRef
      !== value.compilation.runtime.sourcePathRef
    || testOutput[0]?.authority.kind !== "test_build_output_plan"
    || testOutput[0].authority.sourcePathRef !== value.compilation.test.sourcePathRef
    || candidate[0]?.authority.kind !== "candidate_module_plan"
    || candidate[0].authority.runtimeBuildOutputPathRef
      !== value.compilation.runtime.outputPathRef
    || value.compilation.candidate.runtimeBuildOutputPathRef
      !== value.compilation.runtime.outputPathRef
    || value.runtimeTarget.candidateModulePathRef
      !== value.compilation.candidate.candidateModulePathRef
    || value.compilation.runtime.realizationMembershipHash
      !== value.authority.fileTree.runtimeRealizationMembershipHash
    || value.compilation.test.coverageMembershipHash
      !== value.authority.fileTree.testCoverageMembershipHash
  ) {
    context.addIssue({
      code: "custom",
      path: ["compilation"],
      message: "V3 source-to-output-to-candidate references must join exactly",
    });
  }

  if (
    value.authority.commandContractHash
      !== hashBuildTopologyCommandContractV3(value.commands)
    || value.authority.compilationContractHash
      !== hashBuildTopologyCompilationContractV3(value.compilation)
    || value.authority.runtimeContractHash
      !== hashBuildTopologyRuntimeContractV3(value.runtimeTarget)
    || value.logicalBuildHash !== hashBuildTopologyLogicalBuildV3(value)
    || value.manifestHash !== hashBuildTopologyManifestV3(value)
  ) {
    context.addIssue({
      code: "custom",
      path: ["manifestHash"],
      message: "V3 topology logical and operational identities must self-verify",
    });
  }
}

const BuildTopologyCandidateV3Schema = BuildTopologyManifestIdentityV3Schema.extend({
  manifestHash: Sha256Schema,
}).strict().superRefine(addBuildTopologyClosureIssuesV3);

export const BuildTopologyV3Schema = z.unknown().superRefine((value, context) => {
  try {
    canonicalJsonBytesBounded(value, {
      maxBytes: BUILD_TOPOLOGY_MAX_CANONICAL_BYTES_V3,
      ...BUILD_TOPOLOGY_BOUNDED_WORK_LIMITS_V3,
    });
  } catch {
    context.addIssue({
      code: "custom",
      message: "V3 build topology exceeds its canonical byte or work bound",
    });
  }
}).pipe(BuildTopologyCandidateV3Schema);

export type BuildTopologyV3 = z.infer<typeof BuildTopologyCandidateV3Schema>;

export function recursivelyFreezeBuildTopologyV3<T>(value: T): T {
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

export function fileTreePathProjectionForBuildTopologyV3(
  fileTreeManifestHash: string,
  entry: FileTreePathEntryV3,
): BuildTopologyPathEntryHashPayloadV3 {
  return {
    pathRef: deriveBuildTopologyPathRefV3("repository", entry.normalizedLocator),
    physicalSpace: "repository",
    normalizedLocator: entry.normalizedLocator,
    pathIdentityHash: hashPortablePathIdentityV2(
      "repository",
      entry.normalizedLocator,
    ),
    caseFoldPathIdentityHash: hashPortablePathCaseFoldIdentityV2(
      "repository",
      entry.normalizedLocator,
    ),
    classification: entry.classification,
    ownerRef: entry.ownerRef,
    writeGrantOwnerRefs: [],
    access: entry.access,
    currentState: {
      state: "file_tree_v3_projection",
      fileTreeEntryHash: entry.entryHash,
      projectedState: entry.currentState.state,
    },
    authority: {
      kind: "file_tree_v3_path",
      fileTreeManifestHash,
      fileTreeEntryHash: entry.entryHash,
    },
  };
}

export function parseFileTreePathEntryForBuildTopologyV3(
  value: unknown,
): FileTreePathEntryV3 {
  return FileTreePathEntryV3Schema.parse(value);
}
