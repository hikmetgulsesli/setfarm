import { z } from "zod";

import {
  CanonicalRuntimeTreeV2Schema,
} from "../../execution/schemas/canonical-runtime-tree-v2.js";
import { hashCanonicalJson } from "../canonical-json.js";
import { Sha256Schema } from "./common-v1.js";
import {
  DEEP_BYTE_BUNDLE_VERIFICATION_RECEIPT_V2_SCHEMA,
} from "./deep-byte-bundle-verification-receipt-v2.js";
import {
  NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_RECEIPT_V2_SCHEMA,
} from "./node-scaffold-execution-environment-v2.js";
import {
  HOST_NODE_TOOLCHAIN_RECEIPT_V2_SCHEMA,
} from "./host-node-toolchain-receipt-v2.js";
import {
  NODE_SCAFFOLD_TOOLCHAIN_CATALOG_V2_SCHEMA,
  NODE_SCAFFOLD_TOOLCHAIN_ENTRY_V2_SCHEMA,
} from "./node-scaffold-toolchain-catalog-v2.js";

export const PRIVATE_STAGED_MATERIALIZER_AUTHORITY_V2_SCHEMA =
  "setfarm.private-staged-materializer-authority.v2" as const;
export const SCAFFOLD_BASE_MATERIALIZATION_RECEIPT_V2_SCHEMA =
  "setfarm.scaffold-base-materialization-receipt.v2" as const;
export const BUILD_DEPENDENCY_MATERIALIZATION_RECEIPT_V2_SCHEMA =
  "setfarm.build-dependency-materialization-receipt.v2" as const;
export const PRIVATE_STAGED_MATERIALIZER_AUTHORITY_REF_V2 =
  "AUTH_NODE_SCAFFOLD_PRIVATE_STAGED_MATERIALIZER_V2" as const;
export const PRIVATE_STAGED_MATERIALIZER_VERSION_V2 = "2.1.0" as const;

const AdmissionScopeV2Schema = z.enum(["production_host", "test_fixture"]);
const ProfileIdV2Schema = z.enum([
  "PROFILE_NODE_CLI_STATELESS_EXACT_V2",
  "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2",
]);
const EntryRefV2Schema = z.enum([
  "NODE_SCAFFOLD_TOOLCHAIN_NODE_CLI_V2",
  "NODE_SCAFFOLD_TOOLCHAIN_NODE_EXPRESS_API_V2",
]);
const PosixIdentityV2Schema = z.number().int().nonnegative().max(4_294_967_294);

const CatalogBindingV2Schema = z.object({
  catalogSchema: z.literal(NODE_SCAFFOLD_TOOLCHAIN_CATALOG_V2_SCHEMA),
  catalogHash: Sha256Schema,
  entrySchema: z.literal(NODE_SCAFFOLD_TOOLCHAIN_ENTRY_V2_SCHEMA),
  entryRef: EntryRefV2Schema,
  entryHash: Sha256Schema,
  profileId: ProfileIdV2Schema,
  dependencyGraphHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  const expected = value.profileId === "PROFILE_NODE_CLI_STATELESS_EXACT_V2"
    ? "NODE_SCAFFOLD_TOOLCHAIN_NODE_CLI_V2"
    : "NODE_SCAFFOLD_TOOLCHAIN_NODE_EXPRESS_API_V2";
  if (value.entryRef !== expected) {
    context.addIssue({
      code: "custom",
      path: ["entryRef"],
      message: "Private materialization profile and catalog entry must join exactly",
    });
  }
});

const EnvironmentBindingV2Schema = z.object({
  receiptSchema: z.literal(NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_RECEIPT_V2_SCHEMA),
  receiptHash: Sha256Schema,
  effectiveConfigReceiptHash: Sha256Schema,
  effectiveConfigHash: Sha256Schema,
  environmentContractHash: Sha256Schema,
  environmentHash: Sha256Schema,
}).strict();

const PrivateStagedMaterializerAuthorityIdentityV2Schema = z.object({
  schema: z.literal(PRIVATE_STAGED_MATERIALIZER_AUTHORITY_V2_SCHEMA),
  authorityVersion: z.literal(PRIVATE_STAGED_MATERIALIZER_VERSION_V2),
  authorityRef: z.literal(PRIVATE_STAGED_MATERIALIZER_AUTHORITY_REF_V2),
  activation: z.literal("dependency_materialization_verified_file_tree_blocked"),
  policy: z.object({
    rootFreshness: z.literal("exclusive_random_root_no_adoption_v2"),
    scaffoldWrite: z.literal("exclusive_descriptor_fsync_fresh_read_v2"),
    dependencyInstall: z.literal("single_use_exact_npm_ci_v2"),
    dependencyCapture: z.literal("readonly_canonical_runtime_tree_dependencies_v2"),
    failureCleanup: z.literal("authenticated_owned_attempt_only_v2"),
    portablePathDisclosure: z.literal("forbidden"),
  }).strict(),
}).strict();

export type PrivateStagedMaterializerAuthorityHashPayloadV2 = z.infer<
  typeof PrivateStagedMaterializerAuthorityIdentityV2Schema
>;

export function hashPrivateStagedMaterializerAuthorityV2(
  value:
    | PrivateStagedMaterializerAuthorityHashPayloadV2
    | PrivateStagedMaterializerAuthorityV2,
): string {
  const authority = { ...value } as Record<string, unknown>;
  delete authority.authorityHash;
  return hashCanonicalJson({
    schema: "setfarm.private-staged-materializer-authority-hash.v2",
    authority,
  });
}

export const PrivateStagedMaterializerAuthorityV2Schema =
  PrivateStagedMaterializerAuthorityIdentityV2Schema.extend({
    authorityHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (value.authorityHash === hashPrivateStagedMaterializerAuthorityV2(value)) return;
    context.addIssue({
      code: "custom",
      path: ["authorityHash"],
      message: "Private staged materializer authority hash must bind its exact policy",
    });
  });

export type PrivateStagedMaterializerAuthorityV2 = z.infer<
  typeof PrivateStagedMaterializerAuthorityV2Schema
>;

const ScaffoldAssetV2Schema = z.object({
  role: z.enum([
    "package_manifest",
    "dependency_lock_manifest",
    "typescript_compiler_config",
  ]),
  normalizedLocator: z.enum(["package.json", "package-lock.json", "tsconfig.json"]),
  mode: z.literal("0444"),
  rawHash: Sha256Schema,
  rawByteLength: z.number().int().positive().max(16 * 1024 * 1024),
  verificationReceiptSchema: z.literal(DEEP_BYTE_BUNDLE_VERIFICATION_RECEIPT_V2_SCHEMA),
  verificationReceiptHash: Sha256Schema,
  consumerBindingHash: Sha256Schema,
  physicalIdentityHash: Sha256Schema,
}).strict();

const ScaffoldBaseStateV2Schema = z.object({
  layoutRef: z.literal("PRIVATE_NODE_SCAFFOLD_MATERIALIZATION_LAYOUT_V2"),
  rootMode: z.literal("0700"),
  projectRootMode: z.literal("0700"),
  dependencyCapsuleRootMode: z.literal("0700"),
  rootMemberNames: z.tuple([
    z.literal("dependency-capsule"),
    z.literal("project"),
  ]),
  projectMemberNames: z.tuple([
    z.literal("package-lock.json"),
    z.literal("package.json"),
    z.literal("tsconfig.json"),
  ]),
  dependencyCapsuleMemberCount: z.literal(0),
  projectNpmrc: z.object({
    normalizedLocator: z.literal(".npmrc"),
    state: z.literal("absent"),
    evidenceAuthority: z.literal("private_stage_fresh_capture_v2"),
  }).strict(),
  dependencyInstallation: z.object({
    normalizedLocator: z.literal("node_modules"),
    state: z.literal("absent"),
  }).strict(),
  sourceEntrypoint: z.object({
    sourceDirectoryState: z.literal("absent"),
    state: z.literal("absent"),
    finalOwnerRef: z.literal("NODE_ENTRYPOINT_GENERATOR_V2"),
  }).strict(),
  fileCount: z.literal(3),
  totalBytes: z.number().int().positive().max(32 * 1024 * 1024),
  fileMembershipHash: Sha256Schema,
}).strict();

export type ScaffoldBaseStateV2 = z.infer<typeof ScaffoldBaseStateV2Schema>;

export function hashScaffoldBaseStateV2(value: ScaffoldBaseStateV2): string {
  return hashCanonicalJson({
    schema: "setfarm.scaffold-base-state-hash.v2",
    state: value,
  });
}

const ScaffoldBaseSemanticInputV2Schema = z.object({
  materializerAuthorityHash: Sha256Schema,
  catalogBinding: CatalogBindingV2Schema,
  environmentBinding: EnvironmentBindingV2Schema,
  assets: z.array(ScaffoldAssetV2Schema).length(3),
}).strict();

export type ScaffoldBaseSemanticInputV2 = z.infer<
  typeof ScaffoldBaseSemanticInputV2Schema
>;

export function hashScaffoldBaseSemanticInputV2(
  value: ScaffoldBaseSemanticInputV2,
): string {
  return hashCanonicalJson({
    schema: "setfarm.scaffold-base-semantic-input-hash.v2",
    input: {
      materializerAuthorityHash: value.materializerAuthorityHash,
      catalogBinding: value.catalogBinding,
      environmentContract: {
        environmentContractHash: value.environmentBinding.environmentContractHash,
        effectiveConfigHash: value.environmentBinding.effectiveConfigHash,
      },
      assets: value.assets.map((asset) => ({
        role: asset.role,
        normalizedLocator: asset.normalizedLocator,
        mode: asset.mode,
        rawHash: asset.rawHash,
        rawByteLength: asset.rawByteLength,
        verificationReceiptSchema: asset.verificationReceiptSchema,
        verificationReceiptHash: asset.verificationReceiptHash,
        consumerBindingHash: asset.consumerBindingHash,
      })),
    },
  });
}

const ScaffoldBaseMaterializationReceiptIdentityV2Schema = z.object({
  schema: z.literal(SCAFFOLD_BASE_MATERIALIZATION_RECEIPT_V2_SCHEMA),
  receiptVersion: z.literal(PRIVATE_STAGED_MATERIALIZER_VERSION_V2),
  authorityRef: z.literal(PRIVATE_STAGED_MATERIALIZER_AUTHORITY_REF_V2),
  status: z.literal("scaffold_base_materialized_verified"),
  admissionScope: AdmissionScopeV2Schema,
  productionUse: z.literal("forbidden_until_dependency_file_tree_and_build_topology_join"),
  materializerAuthority: PrivateStagedMaterializerAuthorityV2Schema,
  catalogBinding: CatalogBindingV2Schema,
  environmentBinding: EnvironmentBindingV2Schema,
  semanticInputHash: Sha256Schema,
  privateAttempt: z.object({
    rootIdentityHash: Sha256Schema,
    rootMode: z.literal("0700"),
    ownerUid: PosixIdentityV2Schema,
    ownerGid: PosixIdentityV2Schema,
    freshnessPolicy: z.literal("exclusive_random_root_no_adoption_v2"),
    pathDisclosure: z.literal("forbidden"),
    destructionPolicy: z.literal("authenticated_owned_attempt_only_v2"),
  }).strict(),
  assetCount: z.literal(3),
  assets: z.array(ScaffoldAssetV2Schema).length(3),
  baseState: ScaffoldBaseStateV2Schema,
  baseStateHash: Sha256Schema,
}).strict();

export type ScaffoldBaseMaterializationReceiptHashPayloadV2 = z.infer<
  typeof ScaffoldBaseMaterializationReceiptIdentityV2Schema
>;

export function hashScaffoldBaseMaterializationReceiptV2(
  value:
    | ScaffoldBaseMaterializationReceiptHashPayloadV2
    | ScaffoldBaseMaterializationReceiptV2,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.receiptHash;
  return hashCanonicalJson({
    schema: "setfarm.scaffold-base-materialization-receipt-hash.v2",
    receipt: payload,
  });
}

export const ScaffoldBaseMaterializationReceiptV2Schema =
  ScaffoldBaseMaterializationReceiptIdentityV2Schema.extend({
    receiptHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const expectedRoles = [
      "dependency_lock_manifest",
      "package_manifest",
      "typescript_compiler_config",
    ];
    const expectedLocators = ["package-lock.json", "package.json", "tsconfig.json"];
    const semanticInput = {
      materializerAuthorityHash: value.materializerAuthority.authorityHash,
      catalogBinding: value.catalogBinding,
      environmentBinding: value.environmentBinding,
      assets: value.assets,
    };
    if (
      value.assetCount !== value.assets.length
      || value.assets.some((asset, index) => asset.role !== expectedRoles[index])
      || value.assets.some((asset, index) => asset.normalizedLocator !== expectedLocators[index])
    ) {
      context.addIssue({
        code: "custom",
        path: ["assets"],
        message: "Scaffold base assets must be every-and-only and canonically ordered",
      });
    }
    if (value.semanticInputHash !== hashScaffoldBaseSemanticInputV2(semanticInput)) {
      context.addIssue({
        code: "custom",
        path: ["semanticInputHash"],
        message: "Scaffold base semantic input hash must exclude only physical attempt identity",
      });
    }
    if (value.baseStateHash !== hashScaffoldBaseStateV2(value.baseState)) {
      context.addIssue({
        code: "custom",
        path: ["baseStateHash"],
        message: "Scaffold base state hash must bind its complete initial state",
      });
    }
    if (value.receiptHash !== hashScaffoldBaseMaterializationReceiptV2(value)) {
      context.addIssue({
        code: "custom",
        path: ["receiptHash"],
        message: "Scaffold base receipt hash must bind the exact materialization",
      });
    }
  });

export type ScaffoldBaseMaterializationReceiptV2 = z.infer<
  typeof ScaffoldBaseMaterializationReceiptV2Schema
>;

const InstalledBinV2Schema = z.object({
  commandName: z.string().min(1).max(214).regex(/^[A-Za-z0-9._+-]+$/u),
  packagePath: z.string().min(1).max(1_024),
  targetLocator: z.string().min(1).max(1_024),
  linkLocator: z.string().min(1).max(1_024),
  linkTargetHash: Sha256Schema,
  targetContentHash: Sha256Schema,
}).strict();

const BuildDependencyMaterializationReceiptIdentityV2Schema = z.object({
  schema: z.literal(BUILD_DEPENDENCY_MATERIALIZATION_RECEIPT_V2_SCHEMA),
  receiptVersion: z.literal(PRIVATE_STAGED_MATERIALIZER_VERSION_V2),
  authorityRef: z.literal(PRIVATE_STAGED_MATERIALIZER_AUTHORITY_REF_V2),
  status: z.literal("dependencies_materialized_verified"),
  admissionScope: AdmissionScopeV2Schema,
  productionUse: z.literal("forbidden_until_file_tree_and_build_topology_join"),
  materializerAuthority: PrivateStagedMaterializerAuthorityV2Schema,
  catalogBinding: CatalogBindingV2Schema,
  environmentBinding: EnvironmentBindingV2Schema,
  hostToolchain: z.object({
    receiptSchema: z.literal(HOST_NODE_TOOLCHAIN_RECEIPT_V2_SCHEMA),
    receiptHash: Sha256Schema,
    nodeIdentityHash: Sha256Schema,
    npmClosureHash: Sha256Schema,
    npmVersion: z.literal("10.9.8"),
  }).strict(),
  scaffoldBase: z.object({
    receiptSchema: z.literal(SCAFFOLD_BASE_MATERIALIZATION_RECEIPT_V2_SCHEMA),
    receiptHash: Sha256Schema,
    semanticInputHash: Sha256Schema,
    startBaseStateHash: Sha256Schema,
    endBaseFileMembershipHash: Sha256Schema,
    projectNpmrcState: z.literal("absent"),
  }).strict(),
  installExecution: z.object({
    commandRef: z.literal("CMD_NODE_SCAFFOLD_INSTALL_V2"),
    executableRef: z.literal("TOOL_NODE_NPM_CLI_V2"),
    directArgv: z.tuple([
      z.literal("npm"),
      z.literal("ci"),
      z.literal("--include=dev"),
      z.literal("--ignore-scripts"),
      z.literal("--no-audit"),
      z.literal("--no-fund"),
    ]),
    directArgvHash: Sha256Schema,
    environmentHash: Sha256Schema,
    projectScopeHash: Sha256Schema,
    shell: z.literal("forbidden"),
    timeoutMs: z.literal(120_000),
    maxStdoutBytes: z.literal(65_536),
    maxStderrBytes: z.literal(65_536),
    status: z.literal("exited_zero"),
    exitCode: z.literal(0),
    signal: z.null(),
    stdoutHash: Sha256Schema,
    stdoutBytes: z.number().int().nonnegative().max(65_536),
    stderrHash: Sha256Schema,
    stderrBytes: z.number().int().nonnegative().max(65_536),
  }).strict(),
  lockGraph: z.object({
    graphHash: Sha256Schema,
    lockRawHash: Sha256Schema,
    expectedNodeCount: z.number().int().positive().max(1_000),
    installedPackageCount: z.number().int().positive().max(1_000),
    expectedEdgeCount: z.number().int().positive().max(4_000),
    installedPackageMembershipHash: Sha256Schema,
    hiddenLockRawHash: Sha256Schema,
    hiddenLockGraphHash: Sha256Schema,
    graphDisposition: z.literal("every_and_only_verified"),
  }).strict(),
  lifecycleAndEnginePolicy: z.object({
    lifecycleBarrier: z.literal("exact_npm_ci_ignore_scripts"),
    lifecycleExecutionAuthority: z.literal("npm_exact_ignore_scripts_argv_barrier_v2"),
    nativeLockMetadata: z.literal("absent"),
    engineStrict: z.literal(true),
    nodeVersion: z.literal("22.23.1"),
    compatibilityDisposition: z.literal("npm_engine_strict_exit_zero"),
    integrityAuthority: z.literal("npm_10_9_8_lock_integrity_enforcement"),
  }).strict(),
  installedBins: z.object({
    count: z.number().int().nonnegative().max(2_000),
    membershipHash: Sha256Schema,
    entries: z.array(InstalledBinV2Schema).max(2_000),
    disposition: z.literal("every_and_only_verified_npm_links"),
  }).strict(),
  rawInstallTree: z.object({
    fileCount: z.number().int().positive().max(100_000),
    directoryCount: z.number().int().positive().max(20_000),
    symbolicLinkCount: z.number().int().nonnegative().max(2_000),
    totalBytes: z.number().int().positive().max(2 * 1024 * 1024 * 1024),
    membershipHash: Sha256Schema,
    mutationPolicy: z.literal("private_disposable_install_output_v2"),
  }).strict(),
  dependencyCapsuleAuthority: z.object({
    normalization: z.literal("exclusive_readonly_copy_without_generated_npm_links_v2"),
    metadataNormalization: z.enum([
      "code_owned_darwin_writable_copy_acl_xattr_clear_provenance_exclusion_readonly_seal_fsync_v2",
      "test_fixture_none",
    ]),
    metadataProbe: z.enum([
      "code_owned_darwin_acl_nonprovenance_xattr_probe_v2",
      "test_fixture_clear_probe",
    ]),
    hostMetadataExclusion: z.enum([
      "com.apple.provenance_only_not_in_canonical_tree_v2",
      "test_fixture_none",
    ]),
    generatedNpmLinks: z.literal("verified_in_raw_tree_excluded_from_capsule"),
  }).strict(),
  dependencyCapsule: CanonicalRuntimeTreeV2Schema.superRefine((value, context) => {
    if (value.profile !== "dependencies") {
      context.addIssue({
        code: "custom",
        path: ["profile"],
        message: "Build dependency materialization requires the dependencies runtime-tree profile",
      });
    }
  }),
  dependencyIdentityHash: Sha256Schema,
}).strict();

export type BuildDependencyMaterializationReceiptHashPayloadV2 = z.infer<
  typeof BuildDependencyMaterializationReceiptIdentityV2Schema
>;

export function hashBuildDependencyIdentityV2(
  value: Pick<
    BuildDependencyMaterializationReceiptHashPayloadV2,
    | "catalogBinding"
    | "environmentBinding"
    | "hostToolchain"
    | "scaffoldBase"
    | "installExecution"
    | "lockGraph"
    | "lifecycleAndEnginePolicy"
    | "installedBins"
    | "rawInstallTree"
    | "dependencyCapsuleAuthority"
    | "dependencyCapsule"
  >,
): string {
  return hashCanonicalJson({
    schema: "setfarm.build-dependency-materialization-identity-hash.v2",
    dependency: value,
  });
}

export function hashBuildDependencyMaterializationReceiptV2(
  value:
    | BuildDependencyMaterializationReceiptHashPayloadV2
    | BuildDependencyMaterializationReceiptV2,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.receiptHash;
  return hashCanonicalJson({
    schema: "setfarm.build-dependency-materialization-receipt-hash.v2",
    receipt: payload,
  });
}

export const BuildDependencyMaterializationReceiptV2Schema =
  BuildDependencyMaterializationReceiptIdentityV2Schema.extend({
    receiptHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const directArgvHash = hashCanonicalJson({
      schema: "setfarm.node-scaffold-install-direct-argv-hash.v2",
      directArgv: value.installExecution.directArgv,
    });
    if (
      value.installExecution.environmentHash !== value.environmentBinding.environmentHash
      || value.installExecution.directArgvHash !== directArgvHash
    ) {
      context.addIssue({
        code: "custom",
        path: ["installExecution"],
        message: "Dependency install must bind the exact environment and code-owned argv",
      });
    }
    if (
      value.lockGraph.expectedNodeCount !== value.lockGraph.installedPackageCount
      || value.catalogBinding.dependencyGraphHash !== value.lockGraph.graphHash
    ) {
      context.addIssue({
        code: "custom",
        path: ["lockGraph"],
        message: "Installed package membership must equal the exact catalog lock graph",
      });
    }
    if (
      value.admissionScope === "production_host"
      && value.dependencyCapsuleAuthority.metadataProbe
        !== "code_owned_darwin_acl_nonprovenance_xattr_probe_v2"
    ) {
      context.addIssue({
        code: "custom",
        path: ["dependencyCapsuleAuthority", "metadataProbe"],
        message: "Production dependency capsules require the code-owned Darwin metadata probe",
      });
    }
    if (
      value.dependencyCapsuleAuthority.metadataProbe
        === "code_owned_darwin_acl_nonprovenance_xattr_probe_v2"
      && value.dependencyCapsuleAuthority.metadataNormalization
        !== "code_owned_darwin_writable_copy_acl_xattr_clear_provenance_exclusion_readonly_seal_fsync_v2"
    ) {
      context.addIssue({
        code: "custom",
        path: ["dependencyCapsuleAuthority", "metadataNormalization"],
        message: "Darwin metadata probing requires the code-owned clear and fsync normalization",
      });
    }
    if (
      value.dependencyCapsuleAuthority.metadataProbe
        === "code_owned_darwin_acl_nonprovenance_xattr_probe_v2"
      && value.dependencyCapsuleAuthority.hostMetadataExclusion
        !== "com.apple.provenance_only_not_in_canonical_tree_v2"
    ) {
      context.addIssue({
        code: "custom",
        path: ["dependencyCapsuleAuthority", "hostMetadataExclusion"],
        message: "Darwin metadata probing must disclose its only host metadata exclusion",
      });
    }
    if (
      value.dependencyCapsuleAuthority.metadataProbe === "test_fixture_clear_probe"
      && (
        value.dependencyCapsuleAuthority.metadataNormalization !== "test_fixture_none"
        || value.dependencyCapsuleAuthority.hostMetadataExclusion !== "test_fixture_none"
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["dependencyCapsuleAuthority"],
        message: "Test metadata probing cannot claim Darwin normalization or exclusions",
      });
    }
    if (
      value.installedBins.count !== value.installedBins.entries.length
      || new Set(value.installedBins.entries.map((entry) => entry.linkLocator)).size
        !== value.installedBins.entries.length
      || value.installedBins.entries.some((entry, index) =>
        index > 0
        && value.installedBins.entries[index - 1]!.linkLocator >= entry.linkLocator)
    ) {
      context.addIssue({
        code: "custom",
        path: ["installedBins"],
        message: "Installed bins must be complete, unique, and canonically ordered",
      });
    }
    const dependencyIdentity = {
      catalogBinding: value.catalogBinding,
      environmentBinding: value.environmentBinding,
      hostToolchain: value.hostToolchain,
      scaffoldBase: value.scaffoldBase,
      installExecution: value.installExecution,
      lockGraph: value.lockGraph,
      lifecycleAndEnginePolicy: value.lifecycleAndEnginePolicy,
      installedBins: value.installedBins,
      rawInstallTree: value.rawInstallTree,
      dependencyCapsuleAuthority: value.dependencyCapsuleAuthority,
      dependencyCapsule: value.dependencyCapsule,
    };
    if (value.dependencyIdentityHash !== hashBuildDependencyIdentityV2(dependencyIdentity)) {
      context.addIssue({
        code: "custom",
        path: ["dependencyIdentityHash"],
        message: "Dependency identity hash must bind every install and tree authority",
      });
    }
    if (value.receiptHash !== hashBuildDependencyMaterializationReceiptV2(value)) {
      context.addIssue({
        code: "custom",
        path: ["receiptHash"],
        message: "Dependency materialization receipt hash must bind the exact receipt",
      });
    }
  });

export type BuildDependencyMaterializationReceiptV2 = z.infer<
  typeof BuildDependencyMaterializationReceiptV2Schema
>;
