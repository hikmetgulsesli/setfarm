import { z } from "zod";

import {
  canonicalJsonStringify,
  hashCanonicalJson,
} from "../../product-compiler/canonical-json.js";
import { Sha256Schema } from "../../product-compiler/schemas/common-v1.js";
import {
  NPM_LOCK_V3_DEPENDENCY_SPEC_MAX_CHARACTERS_V2,
  isCanonicalNpmExactVersionV2,
  isCanonicalNpmLockPackagePathV2,
  isCanonicalNpmRootPackagePathV2,
  isSupportedNpmDependencySpecV2,
  npmVersionSatisfiesDependencySpecV2,
} from
  "../../product-compiler/schemas/npm-lock-v3-grammar-v2.js";
import {
  CANONICAL_RUNTIME_TREE_V2_PROFILES,
  CANONICAL_RUNTIME_TREE_V2_SCHEMA,
} from "./canonical-runtime-tree-v2.js";
import {
  MetadataProbeAuthorityCandidateV2Schema,
} from "./evidence-environment-capsule-v2.js";
import {
  PLATFORM_RELEASE_COMPONENT_VERSION_V2,
  ExactHostOwnedFileRefV2Schema,
  PlatformReleaseAbsoluteLocatorV2Schema,
  PlatformReleaseNpmPackageNameV2Schema,
  PlatformReleasePortableLocatorV2Schema,
  PlatformReleaseStableReferenceV2Schema,
  PlatformReleaseVersionIdentityV2Schema,
  boundedPlatformReleaseJsonSnapshotV2,
  deepFreezePlatformReleaseJsonV2,
  hasCanonicalUniquePlatformReleaseStringsV2,
  platformReleaseCandidateFitsCanonicalCapV2,
} from "./platform-release-common-v2.js";

export const EXTERNAL_RUNTIME_RESOLUTION_V2_SCHEMA =
  "setfarm.external-runtime-resolution.v2" as const;
export const HOST_RUNTIME_IDENTITY_V2_SCHEMA =
  "setfarm.host-runtime-identity.v2" as const;
export const HOST_BOOTSTRAP_BINDING_V2_SCHEMA =
  "setfarm.host-bootstrap-binding.v2" as const;
export const NON_SYSTEM_DYNAMIC_LIBRARY_V2_SCHEMA =
  "setfarm.non-system-dynamic-library.v2" as const;
export const EXTERNAL_EXECUTABLE_RESOLUTION_V2_SCHEMA =
  "setfarm.external-executable-resolution.v2" as const;
export const NODE_RUNTIME_RESOLUTION_V2_SCHEMA =
  "setfarm.node-runtime-resolution.v2" as const;
export const NPM_PACKAGE_MANAGER_RESOLUTION_V2_SCHEMA =
  "setfarm.npm-package-manager-resolution.v2" as const;
export const NPM_PRODUCTION_MATERIALIZATION_CONFIG_V2_SCHEMA =
  "setfarm.npm-production-materialization-config.v2" as const;
export const NPM_MATERIALIZATION_RECEIPT_ABI_POLICY_V2_SCHEMA =
  "setfarm.npm-materialization-receipt-abi-policy.v2" as const;
export const NPM_PRODUCTION_MATERIALIZATION_RECIPE_V2_SCHEMA =
  "setfarm.npm-production-materialization-recipe.v2" as const;
export const NPM_MATERIALIZATION_RECEIPT_V2_SCHEMA =
  "setfarm.npm-materialization-receipt.v2" as const;
export const PRODUCTION_PACKAGE_RESOLUTION_GRAPH_V2_SCHEMA =
  "setfarm.production-package-resolution-graph.v2" as const;
export const PRODUCTION_PACKAGE_RESOLUTION_ENTRY_V2_SCHEMA =
  "setfarm.production-package-resolution-entry.v2" as const;
export const BROWSER_RUNTIME_RESOLUTION_V2_SCHEMA =
  "setfarm.browser-runtime-resolution.v2" as const;
export const BROWSER_COMPANION_RESOURCE_TREE_BINDING_V2_SCHEMA =
  "setfarm.browser-companion-resource-tree-binding.v2" as const;
export const EXACT_SOURCE_FILE_REF_V2_SCHEMA =
  "setfarm.exact-source-file-ref.v2" as const;

export const EXTERNAL_RUNTIME_RESOLUTION_V2_MAX_CANONICAL_BYTES = 2 * 1024 * 1024;
export const EXTERNAL_RUNTIME_RESOLUTION_V2_MAX_EXECUTABLES = 64;
export const EXTERNAL_RUNTIME_RESOLUTION_V2_MAX_EXECUTABLE_BYTES = 1024 * 1024 * 1024;
export const EXTERNAL_RUNTIME_RESOLUTION_V2_MAX_PACKAGES = 4_096;
export const EXTERNAL_RUNTIME_RESOLUTION_V2_MAX_DEPENDENCIES_PER_PACKAGE = 256;
export const EXTERNAL_RUNTIME_RESOLUTION_V2_MAX_DEPENDENCY_EDGES = 32_768;
export const PRODUCTION_PACKAGE_RESOLUTION_GRAPH_V2_MAX_CANONICAL_BYTES =
  1024 * 1024;
export const EXTERNAL_RUNTIME_RESOLUTION_V2_MAX_LOCKFILE_BYTES = 16 * 1024 * 1024;
export const EXTERNAL_RUNTIME_RESOLUTION_V2_MAX_DYNAMIC_LIBRARIES = 512;

const PosixIdentityV2Schema = z.number().int().nonnegative().max(4_294_967_294);

const DecimalIdentityV2Schema = z.string()
  .min(1)
  .max(20)
  .regex(/^(?:0|[1-9][0-9]*)$/, "Expected one canonical decimal identity");

export const ExactPackageLockSourceRefV2Schema = z.object({
  schema: z.literal(EXACT_SOURCE_FILE_REF_V2_SCHEMA),
  locator: z.literal("package-lock.json"),
  mediaType: z.literal("application/json"),
  hash: Sha256Schema,
  byteLength: z.number().int().positive().max(EXTERNAL_RUNTIME_RESOLUTION_V2_MAX_LOCKFILE_BYTES),
}).strict();

export const ExternalExecutablePurposeV2Schema = z.enum([
  "browser_runtime",
  "network_sandbox",
  "node_runtime",
  "npm_package_manager",
  "platform_tool",
  "runner_tool",
]);

export const ExternalExecutableResolutionV2Schema = z.object({
  schema: z.literal(EXTERNAL_EXECUTABLE_RESOLUTION_V2_SCHEMA),
  executableRef: PlatformReleaseStableReferenceV2Schema,
  purpose: ExternalExecutablePurposeV2Schema,
  absoluteLocator: PlatformReleaseAbsoluteLocatorV2Schema,
  hash: Sha256Schema,
  byteLength: z.number().int().positive()
    .max(EXTERNAL_RUNTIME_RESOLUTION_V2_MAX_EXECUTABLE_BYTES),
}).strict();

export type ExternalExecutableResolutionV2 = z.infer<
  typeof ExternalExecutableResolutionV2Schema
>;

export const HostBootstrapBindingV2Schema = z.object({
  schema: z.literal(HOST_BOOTSTRAP_BINDING_V2_SCHEMA),
  installationScope: z.literal("root_owned_separately_installed"),
  executableRef: PlatformReleaseStableReferenceV2Schema,
  executable: ExactHostOwnedFileRefV2Schema,
  module: ExactHostOwnedFileRefV2Schema,
}).strict().superRefine((value, context) => {
  if (value.executable.mode !== "0555") {
    context.addIssue({
      code: "custom",
      path: ["executable", "mode"],
      message: "Host bootstrap executable must have exact 0555 mode",
    });
  }
  if (value.module.mode !== "0444") {
    context.addIssue({
      code: "custom",
      path: ["module", "mode"],
      message: "Host bootstrap module must have exact 0444 mode",
    });
  }
  if (value.executable.absoluteRealpathLocator === value.module.absoluteRealpathLocator) {
    context.addIssue({
      code: "custom",
      path: ["module", "absoluteRealpathLocator"],
      message: "Host bootstrap executable and module must be distinct admitted files",
    });
  }
});

export const NonSystemDynamicLibraryV2Schema = z.object({
  schema: z.literal(NON_SYSTEM_DYNAMIC_LIBRARY_V2_SCHEMA),
  absoluteLocator: PlatformReleaseAbsoluteLocatorV2Schema,
  hash: Sha256Schema,
  byteLength: z.number().int().positive()
    .max(EXTERNAL_RUNTIME_RESOLUTION_V2_MAX_EXECUTABLE_BYTES),
}).strict();

const HostRuntimeIdentityIdentityV2Schema = z.object({
  schema: z.literal(HOST_RUNTIME_IDENTITY_V2_SCHEMA),
  platform: z.literal("darwin"),
  architecture: z.enum(["arm64", "x64"]),
  macosProductVersion: PlatformReleaseVersionIdentityV2Schema,
  macosBuildVersion: PlatformReleaseVersionIdentityV2Schema,
  darwinKernelRelease: PlatformReleaseVersionIdentityV2Schema,
  bootstrap: HostBootstrapBindingV2Schema,
  runtimeUid: z.number().int().positive().max(4_294_967_294),
  runtimeGid: PosixIdentityV2Schema,
  nonSystemDynamicLibraries: z.array(NonSystemDynamicLibraryV2Schema)
    .max(EXTERNAL_RUNTIME_RESOLUTION_V2_MAX_DYNAMIC_LIBRARIES),
  systemDynamicLibraryTrust: z.literal("exact_macos_build_identity"),
}).strict().superRefine((value, context) => {
  const locators = value.nonSystemDynamicLibraries.map((entry) => entry.absoluteLocator);
  if (!hasCanonicalUniquePlatformReleaseStringsV2(locators)) {
    context.addIssue({
      code: "custom",
      path: ["nonSystemDynamicLibraries"],
      message: "Non-system dynamic libraries must be unique and canonically sorted",
    });
  }
  if (value.runtimeUid === value.bootstrap.executable.ownerUid) {
    context.addIssue({
      code: "custom",
      path: ["runtimeUid"],
      message: "Runtime UID must be separated from the root-owned bootstrap",
    });
  }
  const expectedHostAdmission = canonicalJsonStringify({
    platform: value.platform,
    architecture: value.architecture,
    macosProductVersion: value.macosProductVersion,
    macosBuildVersion: value.macosBuildVersion,
    darwinKernelRelease: value.darwinKernelRelease,
  });
  const bootstrapFiles = [
    value.bootstrap.executable,
    value.bootstrap.module,
  ];
  if (
    bootstrapFiles.some((file) =>
      canonicalJsonStringify(file.hostAdmissionReceipt.host)
        !== expectedHostAdmission)
    || canonicalJsonStringify(
      value.bootstrap.executable.hostAdmissionReceipt.verifier,
    ) !== canonicalJsonStringify(
      value.bootstrap.module.hostAdmissionReceipt.verifier,
    )
  ) {
    context.addIssue({
      code: "custom",
      path: ["bootstrap"],
      message:
        "Bootstrap files must share one verifier and the exact host runtime identity",
    });
  }
});

export type HostRuntimeIdentityHashPayloadV2 = z.infer<
  typeof HostRuntimeIdentityIdentityV2Schema
>;

export function hashHostRuntimeIdentityV2(
  value: HostRuntimeIdentityHashPayloadV2 | HostRuntimeIdentityCandidateV2,
): string {
  const candidate = { ...value } as Record<string, unknown>;
  delete candidate.hostRuntimeIdentityHash;
  return hashCanonicalJson({
    schema: "setfarm.host-runtime-identity-hash.v2",
    candidate,
  });
}

export const HostRuntimeIdentityCandidateV2Schema =
  HostRuntimeIdentityIdentityV2Schema.safeExtend({
    hostRuntimeIdentityHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (value.hostRuntimeIdentityHash !== hashHostRuntimeIdentityV2(value)) {
      context.addIssue({
        code: "custom",
        path: ["hostRuntimeIdentityHash"],
        message: "Host runtime identity hash must bind the exact candidate TCB",
      });
    }
  });

export type HostRuntimeIdentityCandidateV2 = z.infer<
  typeof HostRuntimeIdentityCandidateV2Schema
>;

export const NodeRuntimeResolutionV2Schema = z.object({
  schema: z.literal(NODE_RUNTIME_RESOLUTION_V2_SCHEMA),
  runtimeRef: z.literal("RUNTIME_NODE_PROCESS"),
  version: PlatformReleaseVersionIdentityV2Schema,
  modulesAbi: DecimalIdentityV2Schema,
  napiVersion: DecimalIdentityV2Schema,
  platform: z.literal("darwin"),
  architecture: z.enum(["arm64", "x64"]),
  executableRef: PlatformReleaseStableReferenceV2Schema,
}).strict();

const NpmProductionMaterializationConfigIdentityV2Schema = z.object({
  schema: z.literal(NPM_PRODUCTION_MATERIALIZATION_CONFIG_V2_SCHEMA),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  executable: z.literal("npm"),
  commandRef: z.literal("MATERIALIZE_PRODUCTION_DEPENDENCIES_V2"),
  subcommand: z.literal("ci"),
  arguments: z.tuple([
    z.literal("--omit=dev"),
    z.literal("--ignore-scripts"),
    z.literal("--no-audit"),
    z.literal("--no-fund"),
  ]),
  dependencySelection: z.literal("production_only"),
  outputRoot: z.literal("payload/node_modules"),
  lifecycleScripts: z.literal("forbidden"),
}).strict();

export type NpmProductionMaterializationConfigHashPayloadV2 = z.infer<
  typeof NpmProductionMaterializationConfigIdentityV2Schema
>;

export function hashNpmProductionMaterializationConfigV2(
  value:
    | NpmProductionMaterializationConfigHashPayloadV2
    | NpmProductionMaterializationConfigV2
    | Readonly<Record<string, unknown>>,
): string {
  const config = { ...value } as Record<string, unknown>;
  delete config.configHash;
  return hashCanonicalJson({
    schema: "setfarm.npm-production-materialization-config-hash.v2",
    config,
  });
}

export const NpmProductionMaterializationConfigV2Schema =
  NpmProductionMaterializationConfigIdentityV2Schema.extend({
    configHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (
      value.configHash
        !== hashNpmProductionMaterializationConfigV2(value)
    ) {
      context.addIssue({
        code: "custom",
        path: ["configHash"],
        message:
          "npm production materialization config hash must bind the exact code-owned config",
      });
    }
  });

export type NpmProductionMaterializationConfigV2 = z.infer<
  typeof NpmProductionMaterializationConfigV2Schema
>;

const NPM_PRODUCTION_MATERIALIZATION_CONFIG_IDENTITY_V2 = {
  schema: NPM_PRODUCTION_MATERIALIZATION_CONFIG_V2_SCHEMA,
  version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
  executable: "npm",
  commandRef: "MATERIALIZE_PRODUCTION_DEPENDENCIES_V2",
  subcommand: "ci",
  arguments: [
    "--omit=dev",
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
  ],
  dependencySelection: "production_only",
  outputRoot: "payload/node_modules",
  lifecycleScripts: "forbidden",
} as const;

export const NPM_PRODUCTION_MATERIALIZATION_CONFIG_V2 =
  deepFreezePlatformReleaseJsonV2(
    NpmProductionMaterializationConfigV2Schema.parse({
      ...NPM_PRODUCTION_MATERIALIZATION_CONFIG_IDENTITY_V2,
      configHash: hashNpmProductionMaterializationConfigV2(
        NPM_PRODUCTION_MATERIALIZATION_CONFIG_IDENTITY_V2,
      ),
    }),
  );

const NpmMaterializationReceiptAbiPolicyIdentityV2Schema = z.object({
  schema: z.literal(
    NPM_MATERIALIZATION_RECEIPT_ABI_POLICY_V2_SCHEMA,
  ),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  receiptSchema: z.literal(NPM_MATERIALIZATION_RECEIPT_V2_SCHEMA),
  recipeSchema: z.literal(
    NPM_PRODUCTION_MATERIALIZATION_RECIPE_V2_SCHEMA,
  ),
  outputRoot: z.literal("payload/node_modules"),
  maxPackages: z.literal(
    EXTERNAL_RUNTIME_RESOLUTION_V2_MAX_PACKAGES,
  ),
  dependencySelection: z.literal("production_only"),
  lifecycleScripts: z.literal("forbidden"),
  successfulExitCode: z.literal(0),
  processAuthority: z.literal(
    "authenticated_platform_host_exact_argv_occurrence_v2",
  ),
  sourceFence: z.literal(
    "admitted_package_lock_manifest_and_tsconfig_before_after_v2",
  ),
  productionGraphAuthority: z.literal(
    "strict_closure_bound_exact_named_specified_lock_edges_v2",
  ),
  dependencyTreeAuthority: z.literal(
    "fresh_canonical_sealed_runtime_tree_v2",
  ),
}).strict();

export type NpmMaterializationReceiptAbiPolicyHashPayloadV2 = z.infer<
  typeof NpmMaterializationReceiptAbiPolicyIdentityV2Schema
>;

export function hashNpmMaterializationReceiptAbiPolicyV2(
  value:
    | NpmMaterializationReceiptAbiPolicyHashPayloadV2
    | NpmMaterializationReceiptAbiPolicyV2,
): string {
  const policy = { ...value } as Record<string, unknown>;
  delete policy.policyHash;
  return hashCanonicalJson({
    schema: "setfarm.npm-materialization-receipt-abi-policy-hash.v2",
    policy,
  });
}

export const NpmMaterializationReceiptAbiPolicyV2Schema =
  NpmMaterializationReceiptAbiPolicyIdentityV2Schema.extend({
    policyHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (
      value.policyHash
        !== hashNpmMaterializationReceiptAbiPolicyV2(value)
    ) {
      context.addIssue({
        code: "custom",
        path: ["policyHash"],
        message:
          "npm materialization receipt ABI policy hash must bind the exact code-owned policy",
      });
    }
  });

export type NpmMaterializationReceiptAbiPolicyV2 = z.infer<
  typeof NpmMaterializationReceiptAbiPolicyV2Schema
>;

const NPM_MATERIALIZATION_RECEIPT_ABI_POLICY_IDENTITY_V2 = {
  schema: NPM_MATERIALIZATION_RECEIPT_ABI_POLICY_V2_SCHEMA,
  version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
  receiptSchema: NPM_MATERIALIZATION_RECEIPT_V2_SCHEMA,
  recipeSchema: NPM_PRODUCTION_MATERIALIZATION_RECIPE_V2_SCHEMA,
  outputRoot: "payload/node_modules",
  maxPackages: EXTERNAL_RUNTIME_RESOLUTION_V2_MAX_PACKAGES,
  dependencySelection: "production_only",
  lifecycleScripts: "forbidden",
  successfulExitCode: 0,
  processAuthority:
    "authenticated_platform_host_exact_argv_occurrence_v2",
  sourceFence:
    "admitted_package_lock_manifest_and_tsconfig_before_after_v2",
  productionGraphAuthority:
    "strict_closure_bound_exact_named_specified_lock_edges_v2",
  dependencyTreeAuthority:
    "fresh_canonical_sealed_runtime_tree_v2",
} as const;

export const NPM_MATERIALIZATION_RECEIPT_ABI_POLICY_V2 =
  deepFreezePlatformReleaseJsonV2(
    NpmMaterializationReceiptAbiPolicyV2Schema.parse({
      ...NPM_MATERIALIZATION_RECEIPT_ABI_POLICY_IDENTITY_V2,
      policyHash: hashNpmMaterializationReceiptAbiPolicyV2(
        NPM_MATERIALIZATION_RECEIPT_ABI_POLICY_IDENTITY_V2,
      ),
    }),
  );

const NpmProductionMaterializationRecipeIdentityV2Schema = z.object({
  schema: z.literal(NPM_PRODUCTION_MATERIALIZATION_RECIPE_V2_SCHEMA),
  commandRef: z.literal("MATERIALIZE_PRODUCTION_DEPENDENCIES_V2"),
  subcommand: z.literal("ci"),
  arguments: z.tuple([
    z.literal("--omit=dev"),
    z.literal("--ignore-scripts"),
    z.literal("--no-audit"),
    z.literal("--no-fund"),
  ]),
  dependencySelection: z.literal("production_only"),
  lifecycleScripts: z.literal("forbidden"),
  configHash: z.literal(
    NPM_PRODUCTION_MATERIALIZATION_CONFIG_V2.configHash,
  ),
  materializationReceiptSchema: z.literal(NPM_MATERIALIZATION_RECEIPT_V2_SCHEMA),
  materializationReceiptSchemaHash: z.literal(
    NPM_MATERIALIZATION_RECEIPT_ABI_POLICY_V2.policyHash,
  ),
}).strict();

export type NpmProductionMaterializationRecipeHashPayloadV2 = z.infer<
  typeof NpmProductionMaterializationRecipeIdentityV2Schema
>;

export function hashNpmProductionMaterializationRecipeV2(
  value:
    | NpmProductionMaterializationRecipeHashPayloadV2
    | NpmProductionMaterializationRecipeV2
    | Readonly<Record<string, unknown>>,
): string {
  const recipe = { ...value } as Record<string, unknown>;
  delete recipe.recipeHash;
  return hashCanonicalJson({
    schema: "setfarm.npm-production-materialization-recipe-hash.v2",
    recipe,
  });
}

export const NpmProductionMaterializationRecipeV2Schema =
  NpmProductionMaterializationRecipeIdentityV2Schema.extend({
    recipeHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (value.recipeHash !== hashNpmProductionMaterializationRecipeV2(value)) {
      context.addIssue({
        code: "custom",
        path: ["recipeHash"],
        message: "npm materialization recipe hash must bind the exact code-owned recipe",
      });
    }
  });

export type NpmProductionMaterializationRecipeV2 = z.infer<
  typeof NpmProductionMaterializationRecipeV2Schema
>;

const NPM_PRODUCTION_MATERIALIZATION_RECIPE_IDENTITY_V2 = {
  schema: NPM_PRODUCTION_MATERIALIZATION_RECIPE_V2_SCHEMA,
  commandRef: "MATERIALIZE_PRODUCTION_DEPENDENCIES_V2",
  subcommand: "ci",
  arguments: [
    "--omit=dev",
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
  ],
  dependencySelection: "production_only",
  lifecycleScripts: "forbidden",
  configHash:
    NPM_PRODUCTION_MATERIALIZATION_CONFIG_V2.configHash,
  materializationReceiptSchema:
    NPM_MATERIALIZATION_RECEIPT_V2_SCHEMA,
  materializationReceiptSchemaHash:
    NPM_MATERIALIZATION_RECEIPT_ABI_POLICY_V2.policyHash,
} as const;

export const NPM_PRODUCTION_MATERIALIZATION_RECIPE_V2 =
  deepFreezePlatformReleaseJsonV2(
    NpmProductionMaterializationRecipeV2Schema.parse({
      ...NPM_PRODUCTION_MATERIALIZATION_RECIPE_IDENTITY_V2,
      recipeHash: hashNpmProductionMaterializationRecipeV2(
        NPM_PRODUCTION_MATERIALIZATION_RECIPE_IDENTITY_V2,
      ),
    }),
  );

export const NpmPackageManagerResolutionV2Schema = z.object({
  schema: z.literal(NPM_PACKAGE_MANAGER_RESOLUTION_V2_SCHEMA),
  packageName: z.literal("npm"),
  version: PlatformReleaseVersionIdentityV2Schema,
  executableRef: PlatformReleaseStableReferenceV2Schema,
  packageTreeHash: Sha256Schema,
  installRecipe: NpmProductionMaterializationRecipeV2Schema,
}).strict();

const NpmMaterializationReceiptIdentityV2Schema = z.object({
  schema: z.literal(NPM_MATERIALIZATION_RECEIPT_V2_SCHEMA),
  recipeHash: z.literal(
    NPM_PRODUCTION_MATERIALIZATION_RECIPE_V2.recipeHash,
  ),
  npmIdentity: z.object({
    packageName: z.literal("npm"),
    version: PlatformReleaseVersionIdentityV2Schema,
    executableRef: PlatformReleaseStableReferenceV2Schema,
    packageTreeHash: Sha256Schema,
  }).strict(),
  lockfile: ExactPackageLockSourceRefV2Schema,
  outputRoot: z.literal("payload/node_modules"),
  dependencyTreeHash: Sha256Schema,
  dependencyTreePayloadHash: Sha256Schema,
  dependencyTreeBindingHash: Sha256Schema,
  productionClosureHash: Sha256Schema,
  productionClosureContractHash: Sha256Schema,
  productionResolutionGraphHash: Sha256Schema,
  packageCount: z.number().int().nonnegative()
    .max(EXTERNAL_RUNTIME_RESOLUTION_V2_MAX_PACKAGES),
  lifecycleScripts: z.literal("forbidden"),
  exitCode: z.literal(0),
}).strict();

export type NpmMaterializationReceiptHashPayloadV2 = z.infer<
  typeof NpmMaterializationReceiptIdentityV2Schema
>;

export function hashNpmMaterializationReceiptV2(
  value:
    | NpmMaterializationReceiptHashPayloadV2
    | NpmMaterializationReceiptCandidateV2,
): string {
  const receipt = { ...value } as Record<string, unknown>;
  delete receipt.receiptHash;
  return hashCanonicalJson({
    schema: "setfarm.npm-materialization-receipt-hash.v2",
    receipt,
  });
}

export const NpmMaterializationReceiptCandidateV2Schema =
  NpmMaterializationReceiptIdentityV2Schema.extend({
    receiptHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (value.receiptHash !== hashNpmMaterializationReceiptV2(value)) {
      context.addIssue({
        code: "custom",
        path: ["receiptHash"],
        message: "npm materialization receipt hash must bind the exact candidate",
      });
    }
  });

export type NpmMaterializationReceiptCandidateV2 = z.infer<
  typeof NpmMaterializationReceiptCandidateV2Schema
>;

export const PlatformReleaseNpmLockPackageLocatorV2Schema =
  PlatformReleasePortableLocatorV2Schema.refine(
    isCanonicalNpmLockPackagePathV2,
    "Production package locator must be one exact npm lock package path",
  );

export const PlatformReleaseNpmRootPackageLocatorV2Schema =
  PlatformReleaseNpmLockPackageLocatorV2Schema.refine(
    isCanonicalNpmRootPackagePathV2,
    "Production root dependency locator must be one direct npm root package path",
  );

const ProductionNpmExactVersionV2Schema = z.string()
  .refine(
    isCanonicalNpmExactVersionV2,
    "Production package version must be one canonical exact three-part version",
  );

const ProductionNpmDependencySpecV2Schema = z.string()
  .max(NPM_LOCK_V3_DEPENDENCY_SPEC_MAX_CHARACTERS_V2)
  .refine(
    isSupportedNpmDependencySpecV2,
    "Production dependency spec must use the supported canonical lock grammar",
  );

export const ProductionPackageResolutionEdgeV2Schema =
  z.object({
    ownerPackageLocator: z.union([
      z.literal(""),
      PlatformReleaseNpmLockPackageLocatorV2Schema,
    ]),
    kind: z.enum([
      "dependencies",
      "required",
      "optional",
    ]),
    dependencyName:
      PlatformReleaseNpmPackageNameV2Schema,
    declaredSpec:
      ProductionNpmDependencySpecV2Schema,
    resolvedPackageLocator:
      PlatformReleaseNpmLockPackageLocatorV2Schema,
    resolvedVersion:
      ProductionNpmExactVersionV2Schema,
  }).strict();

export type ProductionPackageResolutionEdgeV2 = z.infer<
  typeof ProductionPackageResolutionEdgeV2Schema
>;

const ProductionPackageResolutionEntryIdentityV2Schema = z.object({
  schema: z.literal(PRODUCTION_PACKAGE_RESOLUTION_ENTRY_V2_SCHEMA),
  packageLocator:
    PlatformReleaseNpmLockPackageLocatorV2Schema,
  packageName: PlatformReleaseNpmPackageNameV2Schema,
  version: ProductionNpmExactVersionV2Schema,
  lockEntryHash: Sha256Schema,
  packageJsonHash: Sha256Schema,
  runtimeTreeHash: Sha256Schema,
  dependencyLocators: z.array(
    PlatformReleaseNpmLockPackageLocatorV2Schema,
  )
    .max(EXTERNAL_RUNTIME_RESOLUTION_V2_MAX_DEPENDENCIES_PER_PACKAGE),
}).strict().superRefine((value, context) => {
  if (!value.packageLocator.endsWith(`node_modules/${value.packageName}`)) {
    context.addIssue({
      code: "custom",
      path: ["packageLocator"],
      message: "Production package locator must terminate in its exact package name",
    });
  }
  if (!hasCanonicalUniquePlatformReleaseStringsV2(value.dependencyLocators)) {
    context.addIssue({
      code: "custom",
      path: ["dependencyLocators"],
      message: "Production dependency locators must be unique and canonically sorted",
    });
  }
});

export const ProductionPackageResolutionEntryV2Schema =
  ProductionPackageResolutionEntryIdentityV2Schema;

export type ProductionPackageResolutionEntryV2 = z.infer<
  typeof ProductionPackageResolutionEntryV2Schema
>;

const ProductionPackageResolutionGraphIdentityV2Schema = z.object({
  schema: z.literal(PRODUCTION_PACKAGE_RESOLUTION_GRAPH_V2_SCHEMA),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  lockfileVersion: z.literal(3),
  lockfile: ExactPackageLockSourceRefV2Schema,
  materializedDependencyTreeHash: Sha256Schema,
  productionClosureHash: Sha256Schema,
  productionClosureContractHash: Sha256Schema,
  dependencyEdgeModel: z.enum([
    "dependencies_only",
    "required_and_observed_optional",
  ]),
  rootDependencyLocators: z.array(
    PlatformReleaseNpmRootPackageLocatorV2Schema,
  ).max(EXTERNAL_RUNTIME_RESOLUTION_V2_MAX_PACKAGES),
  dependencyEdges:
    z.array(ProductionPackageResolutionEdgeV2Schema)
      .max(
        EXTERNAL_RUNTIME_RESOLUTION_V2_MAX_DEPENDENCY_EDGES,
      ),
  packages: z.array(ProductionPackageResolutionEntryV2Schema)
    .max(EXTERNAL_RUNTIME_RESOLUTION_V2_MAX_PACKAGES),
  packageCount: z.number().int().nonnegative()
    .max(EXTERNAL_RUNTIME_RESOLUTION_V2_MAX_PACKAGES),
}).strict().superRefine((value, context) => {
  const locators = value.packages.map((entry) => entry.packageLocator);
  if (
    !hasCanonicalUniquePlatformReleaseStringsV2(
      value.rootDependencyLocators,
    )
  ) {
    context.addIssue({
      code: "custom",
      path: ["rootDependencyLocators"],
      message:
        "Production root dependency locators must be unique and canonically sorted",
    });
  }
  if (!hasCanonicalUniquePlatformReleaseStringsV2(locators)) {
    context.addIssue({
      code: "custom",
      path: ["packages"],
      message: "Production package entries must be unique and canonically sorted by locator",
    });
  }
  if (value.packageCount !== value.packages.length) {
    context.addIssue({
      code: "custom",
      path: ["packageCount"],
      message: "Production package count must equal the exact package array length",
    });
  }
  const locatorSet = new Set(locators);
  const edgeKeys = value.dependencyEdges.map((edge) =>
    [
      edge.ownerPackageLocator,
      edge.kind,
      edge.dependencyName,
      edge.resolvedPackageLocator,
      edge.declaredSpec,
      edge.resolvedVersion,
    ].join("\0"));
  if (!hasCanonicalUniquePlatformReleaseStringsV2(edgeKeys)) {
    context.addIssue({
      code: "custom",
      path: ["dependencyEdges"],
      message:
        "Production dependency edges must be unique and canonically sorted",
    });
  }
  if (
    value.dependencyEdgeModel === "dependencies_only"
      ? value.dependencyEdges.some((edge) =>
          edge.kind !== "dependencies")
      : value.dependencyEdges.some((edge) =>
          edge.kind === "dependencies")
  ) {
    context.addIssue({
      code: "custom",
      path: ["dependencyEdges"],
      message:
        "Production dependency edge kinds must match the declared closure model",
    });
  }
  const rootEdgeLocators = [
    ...new Set(
      value.dependencyEdges
        .filter((edge) => edge.ownerPackageLocator === "")
        .map((edge) => edge.resolvedPackageLocator),
    ),
  ].sort();
  if (
    canonicalJsonStringify(rootEdgeLocators)
      !== canonicalJsonStringify(
        value.rootDependencyLocators,
      )
  ) {
    context.addIssue({
      code: "custom",
      path: ["rootDependencyLocators"],
      message:
        "Production roots must equal every and only exact root dependency edge",
    });
  }
  value.rootDependencyLocators.forEach((locator, index) => {
    if (!locatorSet.has(locator)) {
      context.addIssue({
        code: "custom",
        path: ["rootDependencyLocators", index],
        message:
          "Every production root dependency must resolve to one exact package entry",
      });
    }
  });
  const byLocator = new Map(
    value.packages.map((entry) => [
      entry.packageLocator,
      entry,
    ]),
  );
  value.dependencyEdges.forEach((edge, edgeIndex) => {
    const resolved = byLocator.get(
      edge.resolvedPackageLocator,
    );
    const owner = edge.ownerPackageLocator === ""
      ? undefined
      : byLocator.get(edge.ownerPackageLocator);
    if (
      !resolved
      || (
        edge.ownerPackageLocator !== ""
        && !owner
      )
      || edge.ownerPackageLocator
        === edge.resolvedPackageLocator
      || resolved?.packageName !== edge.dependencyName
      || resolved?.version !== edge.resolvedVersion
      || !npmVersionSatisfiesDependencySpecV2(
        edge.resolvedVersion,
        edge.declaredSpec,
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["dependencyEdges", edgeIndex],
        message:
          "Every exact dependency edge must join an existing owner, dependency name, version and distinct resolved package",
      });
    }
  });
  value.packages.forEach((entry, packageIndex) => {
    entry.dependencyLocators.forEach((dependencyLocator, dependencyIndex) => {
      if (!locatorSet.has(dependencyLocator) || dependencyLocator === entry.packageLocator) {
        context.addIssue({
          code: "custom",
          path: ["packages", packageIndex, "dependencyLocators", dependencyIndex],
          message: "Every dependency edge must resolve to one other exact package entry",
        });
      }
    });
    const projected = [
      ...new Set(
        value.dependencyEdges
          .filter((edge) =>
            edge.ownerPackageLocator
              === entry.packageLocator)
          .map((edge) =>
            edge.resolvedPackageLocator),
      ),
    ].sort();
    if (
      canonicalJsonStringify(projected)
        !== canonicalJsonStringify(
          entry.dependencyLocators,
        )
    ) {
      context.addIssue({
        code: "custom",
        path: ["packages", packageIndex, "dependencyLocators"],
        message:
          "Package adjacency must equal every and only exact dependency edge",
      });
    }
  });
  if (
    value.dependencyEdges.length
      > EXTERNAL_RUNTIME_RESOLUTION_V2_MAX_DEPENDENCY_EDGES
  ) {
    context.addIssue({
      code: "custom",
      path: ["packages"],
      message: "Production package dependency-edge limit exceeded",
    });
  }
  const reached = new Set<string>();
  const pending = [...value.rootDependencyLocators];
  while (pending.length > 0) {
    const locator = pending.pop()!;
    if (reached.has(locator)) continue;
    reached.add(locator);
    const entry = byLocator.get(locator);
    if (entry) pending.push(...entry.dependencyLocators);
  }
  if (
    reached.size !== locatorSet.size
    || locators.some((locator) => !reached.has(locator))
  ) {
    context.addIssue({
      code: "custom",
      path: ["packages"],
      message:
        "Every and only production package must be reachable from an exact root dependency",
    });
  }
});

export type ProductionPackageResolutionGraphHashPayloadV2 = z.infer<
  typeof ProductionPackageResolutionGraphIdentityV2Schema
>;

export function hashProductionPackageResolutionGraphV2(
  value:
    | ProductionPackageResolutionGraphHashPayloadV2
    | ProductionPackageResolutionGraphV2,
): string {
  const graph = { ...value } as Record<string, unknown>;
  delete graph.resolutionGraphHash;
  return hashCanonicalJson({
    schema: "setfarm.production-package-resolution-graph-hash.v2",
    graph,
  });
}

export const ProductionPackageResolutionGraphV2Schema =
  ProductionPackageResolutionGraphIdentityV2Schema.safeExtend({
    resolutionGraphHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (
      !platformReleaseCandidateFitsCanonicalCapV2(
        value,
        PRODUCTION_PACKAGE_RESOLUTION_GRAPH_V2_MAX_CANONICAL_BYTES,
      )
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Production package resolution graph exceeds its canonical byte cap",
      });
    }
    if (value.resolutionGraphHash !== hashProductionPackageResolutionGraphV2(value)) {
      context.addIssue({
        code: "custom",
        path: ["resolutionGraphHash"],
        message: "Package graph hash must bind the exact resolution graph",
      });
    }
  });

export type ProductionPackageResolutionGraphV2 = z.infer<
  typeof ProductionPackageResolutionGraphV2Schema
>;

export const BrowserRuntimeForbiddenV2Schema = z.object({
  schema: z.literal(BROWSER_RUNTIME_RESOLUTION_V2_SCHEMA),
  status: z.literal("forbidden"),
  runtimeInstall: z.literal("forbidden"),
  channelFallback: z.literal("forbidden"),
}).strict();

export const BrowserCompanionResourceTreeBindingV2Schema = z.object({
  schema: z.literal(BROWSER_COMPANION_RESOURCE_TREE_BINDING_V2_SCHEMA),
  treeSchema: z.literal(CANONICAL_RUNTIME_TREE_V2_SCHEMA),
  profile: z.literal("dependencies"),
  absoluteBundleRoot: PlatformReleaseAbsoluteLocatorV2Schema,
  rootMode: z.literal("0555"),
  treeHash: Sha256Schema,
  payloadHash: Sha256Schema,
  fileCount: z.number().int().positive(),
  directoryCount: z.number().int().nonnegative(),
  totalBytes: z.number().int().positive(),
  executableRelativeLocator: PlatformReleasePortableLocatorV2Schema,
}).strict().superRefine((value, context) => {
  const limits = CANONICAL_RUNTIME_TREE_V2_PROFILES.dependencies;
  if (value.fileCount > limits.maxFiles) {
    context.addIssue({
      code: "custom",
      path: ["fileCount"],
      message: "Browser companion tree file limit exceeded",
    });
  }
  if (value.directoryCount > limits.maxDirectories) {
    context.addIssue({
      code: "custom",
      path: ["directoryCount"],
      message: "Browser companion tree directory limit exceeded",
    });
  }
  if (value.totalBytes > limits.maxTotalBytes) {
    context.addIssue({
      code: "custom",
      path: ["totalBytes"],
      message: "Browser companion tree total-byte limit exceeded",
    });
  }
});

const BrowserRuntimeExactIdentityV2Schema = z.object({
  schema: z.literal(BROWSER_RUNTIME_RESOLUTION_V2_SCHEMA),
  status: z.literal("playwright_chromium_exact"),
  runtimeInstall: z.literal("forbidden"),
  channelFallback: z.literal("forbidden"),
  browserName: z.literal("chromium"),
  browserRevision: PlatformReleaseVersionIdentityV2Schema,
  playwrightPackageLocator: PlatformReleasePortableLocatorV2Schema,
  playwrightVersion: PlatformReleaseVersionIdentityV2Schema,
  playwrightPackageTreeHash: Sha256Schema,
  executableRef: PlatformReleaseStableReferenceV2Schema,
  companionResourceTree: BrowserCompanionResourceTreeBindingV2Schema,
}).strict();

export type BrowserRuntimeExactHashPayloadV2 = z.infer<
  typeof BrowserRuntimeExactIdentityV2Schema
>;

export function hashBrowserRuntimeExactV2(
  value: BrowserRuntimeExactHashPayloadV2 | BrowserRuntimeExactV2,
): string {
  const browser = { ...value } as Record<string, unknown>;
  delete browser.browserClosureHash;
  return hashCanonicalJson({
    schema: "setfarm.browser-runtime-resolution-hash.v2",
    browser,
  });
}

export const BrowserRuntimeExactV2Schema = BrowserRuntimeExactIdentityV2Schema.extend({
  browserClosureHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  if (value.browserClosureHash !== hashBrowserRuntimeExactV2(value)) {
    context.addIssue({
      code: "custom",
      path: ["browserClosureHash"],
      message: "Browser closure hash must bind the exact Playwright Chromium resolution",
    });
  }
});

export type BrowserRuntimeExactV2 = z.infer<typeof BrowserRuntimeExactV2Schema>;

export const BrowserRuntimeResolutionV2Schema = z.union([
  BrowserRuntimeForbiddenV2Schema,
  BrowserRuntimeExactV2Schema,
]);

const ExternalRuntimeResolutionIdentityV2Schema = z.object({
  schema: z.literal(EXTERNAL_RUNTIME_RESOLUTION_V2_SCHEMA),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  hostRuntime: HostRuntimeIdentityCandidateV2Schema,
  nodeRuntime: NodeRuntimeResolutionV2Schema,
  packageManager: NpmPackageManagerResolutionV2Schema,
  productionPackages: ProductionPackageResolutionGraphV2Schema,
  materializationReceipt: NpmMaterializationReceiptCandidateV2Schema,
  metadataProbe: MetadataProbeAuthorityCandidateV2Schema,
  executables: z.array(ExternalExecutableResolutionV2Schema)
    .min(5)
    .max(EXTERNAL_RUNTIME_RESOLUTION_V2_MAX_EXECUTABLES),
  browserRuntime: BrowserRuntimeResolutionV2Schema,
}).strict().superRefine((value, context) => {
  const executableRefs = value.executables.map((entry) => entry.executableRef);
  if (!hasCanonicalUniquePlatformReleaseStringsV2(executableRefs)) {
    context.addIssue({
      code: "custom",
      path: ["executables"],
      message: "External executables must be unique and canonically sorted by ref",
    });
  }

  const requireExecutable = (
    executableRef: string,
    purpose: z.infer<typeof ExternalExecutablePurposeV2Schema>,
    path: (string | number)[],
    expectedHash?: string,
    expectedBytes?: number,
  ): ExternalExecutableResolutionV2 | undefined => {
    const executable = value.executables.find((entry) => entry.executableRef === executableRef);
    if (
      !executable
      || executable.purpose !== purpose
      || (expectedHash !== undefined && executable.hash !== expectedHash)
      || (expectedBytes !== undefined && executable.byteLength !== expectedBytes)
    ) {
      context.addIssue({
        code: "custom",
        path,
        message: `Executable ref must resolve one exact ${purpose} entry`,
      });
      return undefined;
    }
    return executable;
  };

  const bootstrapExecutable = requireExecutable(
    value.hostRuntime.bootstrap.executableRef,
    "platform_tool",
    ["hostRuntime", "bootstrap", "executableRef"],
    value.hostRuntime.bootstrap.executable.hash,
    value.hostRuntime.bootstrap.executable.byteLength,
  );
  if (
    bootstrapExecutable
    && bootstrapExecutable.absoluteLocator
      !== value.hostRuntime.bootstrap.executable.absoluteRealpathLocator
  ) {
    context.addIssue({
      code: "custom",
      path: ["hostRuntime", "bootstrap", "executable", "absoluteRealpathLocator"],
      message: "Host bootstrap executable ref must resolve its exact admitted realpath",
    });
  }
  requireExecutable(
    value.nodeRuntime.executableRef,
    "node_runtime",
    ["nodeRuntime", "executableRef"],
  );
  requireExecutable(
    value.packageManager.executableRef,
    "npm_package_manager",
    ["packageManager", "executableRef"],
  );
  requireExecutable(
    value.metadataProbe.xattrTool.executableRef,
    "platform_tool",
    ["metadataProbe", "xattrTool", "executableRef"],
    value.metadataProbe.xattrTool.executableHash,
  );
  requireExecutable(
    value.metadataProbe.aclTool.executableRef,
    "platform_tool",
    ["metadataProbe", "aclTool", "executableRef"],
    value.metadataProbe.aclTool.executableHash,
  );

  const receipt = value.materializationReceipt;
  const manager = value.packageManager;
  const graph = value.productionPackages;
  if (
    receipt.recipeHash !== manager.installRecipe.recipeHash
    || receipt.npmIdentity.packageName !== manager.packageName
    || receipt.npmIdentity.version !== manager.version
    || receipt.npmIdentity.executableRef !== manager.executableRef
    || receipt.npmIdentity.packageTreeHash !== manager.packageTreeHash
    || receipt.lockfile.hash !== graph.lockfile.hash
    || receipt.lockfile.byteLength !== graph.lockfile.byteLength
    || receipt.dependencyTreeHash !== graph.materializedDependencyTreeHash
    || receipt.productionClosureHash
      !== graph.productionClosureHash
    || receipt.productionClosureContractHash
      !== graph.productionClosureContractHash
    || receipt.productionResolutionGraphHash
      !== graph.resolutionGraphHash
    || receipt.packageCount !== graph.packageCount
    || receipt.lifecycleScripts !== manager.installRecipe.lifecycleScripts
  ) {
    context.addIssue({
      code: "custom",
      path: ["materializationReceipt"],
      message: "npm materialization receipt must exactly project recipe, npm, lockfile and produced dependency closure",
    });
  }

  if (
    value.nodeRuntime.platform !== value.hostRuntime.platform
    || value.nodeRuntime.architecture !== value.hostRuntime.architecture
  ) {
    context.addIssue({
      code: "custom",
      path: ["nodeRuntime"],
      message: "Node platform and architecture must match the exact host TCB",
    });
  }

  const hostAdmissionProjection = canonicalJsonStringify({
    platform: value.hostRuntime.platform,
    architecture: value.hostRuntime.architecture,
    macosProductVersion: value.hostRuntime.macosProductVersion,
    macosBuildVersion: value.hostRuntime.macosBuildVersion,
    darwinKernelRelease: value.hostRuntime.darwinKernelRelease,
  });
  if (
    canonicalJsonStringify(
      value.metadataProbe.bootstrapModule.hostAdmissionReceipt.host,
    ) !== hostAdmissionProjection
    || canonicalJsonStringify(
      value.metadataProbe.bootstrapModule.hostAdmissionReceipt.verifier,
    ) !== canonicalJsonStringify(
      value.hostRuntime.bootstrap.executable
        .hostAdmissionReceipt.verifier,
    )
  ) {
    context.addIssue({
      code: "custom",
      path: ["metadataProbe", "bootstrapModule"],
      message:
        "Metadata-probe host admission must match the exact host and verifier identity",
    });
  }

  const browserExecutables = value.executables.filter((entry) =>
    entry.purpose === "browser_runtime");
  if (value.browserRuntime.status === "forbidden") {
    if (browserExecutables.length > 0) {
      context.addIssue({
        code: "custom",
        path: ["browserRuntime"],
        message: "Browser-forbidden resolution cannot carry a browser executable",
      });
    }
    return;
  }

  const browserRuntime = value.browserRuntime;
  if (browserExecutables.length !== 1) {
    context.addIssue({
      code: "custom",
      path: ["browserRuntime"],
      message: "Exact Chromium resolution must carry exactly one browser executable",
    });
  }

  const browserExecutable = requireExecutable(
    browserRuntime.executableRef,
    "browser_runtime",
    ["browserRuntime", "executableRef"],
  );
  const expectedBrowserExecutableLocator =
    `${browserRuntime.companionResourceTree.absoluteBundleRoot}/${browserRuntime.companionResourceTree.executableRelativeLocator}`;
  if (
    browserExecutable
    && browserExecutable.absoluteLocator !== expectedBrowserExecutableLocator
  ) {
    context.addIssue({
      code: "custom",
      path: ["browserRuntime", "companionResourceTree", "executableRelativeLocator"],
      message: "Chromium executable must be the exact descendant bound by its companion resource tree",
    });
  }
  const playwrightPackage = value.productionPackages.packages.find((entry) =>
    entry.packageLocator === browserRuntime.playwrightPackageLocator);
  if (
    !playwrightPackage
    || playwrightPackage.packageName !== "playwright"
    || playwrightPackage.version !== browserRuntime.playwrightVersion
    || playwrightPackage.runtimeTreeHash !== browserRuntime.playwrightPackageTreeHash
  ) {
    context.addIssue({
      code: "custom",
      path: ["browserRuntime", "playwrightPackageLocator"],
      message: "Exact Chromium resolution must bind one exact Playwright package-tree entry",
    });
  }
});

export type ExternalRuntimeResolutionHashPayloadV2 = z.infer<
  typeof ExternalRuntimeResolutionIdentityV2Schema
>;

export function hashExternalRuntimeResolutionV2(
  value:
    | ExternalRuntimeResolutionHashPayloadV2
    | ExternalRuntimeResolutionCandidateV2,
): string {
  const candidate = { ...value } as Record<string, unknown>;
  delete candidate.externalResolutionHash;
  return hashCanonicalJson({
    schema: "setfarm.external-runtime-resolution-hash.v2",
    candidate,
  });
}

export const ExternalRuntimeResolutionCandidateV2Schema =
  ExternalRuntimeResolutionIdentityV2Schema.safeExtend({
    externalResolutionHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (!platformReleaseCandidateFitsCanonicalCapV2(
      value,
      EXTERNAL_RUNTIME_RESOLUTION_V2_MAX_CANONICAL_BYTES,
    )) {
      context.addIssue({
        code: "custom",
        message: `External runtime candidate exceeds ${EXTERNAL_RUNTIME_RESOLUTION_V2_MAX_CANONICAL_BYTES} canonical bytes`,
      });
      return;
    }
    if (value.externalResolutionHash !== hashExternalRuntimeResolutionV2(value)) {
      context.addIssue({
        code: "custom",
        path: ["externalResolutionHash"],
        message: "External-resolution hash must bind the exact candidate resolution",
      });
    }
  });

export type ExternalRuntimeResolutionCandidateV2 = z.infer<
  typeof ExternalRuntimeResolutionCandidateV2Schema
>;

export function parseExternalRuntimeResolutionCandidateV2(
  input: unknown,
): ExternalRuntimeResolutionCandidateV2 {
  const snapshot = boundedPlatformReleaseJsonSnapshotV2(
    input,
    EXTERNAL_RUNTIME_RESOLUTION_V2_MAX_CANONICAL_BYTES,
  );
  return deepFreezePlatformReleaseJsonV2(
    ExternalRuntimeResolutionCandidateV2Schema.parse(snapshot),
  );
}
