import { z } from "zod";

import { hashCanonicalJson } from "../../product-compiler/canonical-json.js";
import { Sha256Schema } from "../../product-compiler/schemas/common-v1.js";
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
  configHash: Sha256Schema,
  materializationReceiptSchema: z.literal(NPM_MATERIALIZATION_RECEIPT_V2_SCHEMA),
  materializationReceiptSchemaHash: Sha256Schema,
}).strict();

export type NpmProductionMaterializationRecipeHashPayloadV2 = z.infer<
  typeof NpmProductionMaterializationRecipeIdentityV2Schema
>;

export function hashNpmProductionMaterializationRecipeV2(
  value:
    | NpmProductionMaterializationRecipeHashPayloadV2
    | NpmProductionMaterializationRecipeV2,
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
  recipeHash: Sha256Schema,
  npmIdentity: z.object({
    packageName: z.literal("npm"),
    version: PlatformReleaseVersionIdentityV2Schema,
    executableRef: PlatformReleaseStableReferenceV2Schema,
    packageTreeHash: Sha256Schema,
  }).strict(),
  lockfile: ExactPackageLockSourceRefV2Schema,
  outputRoot: z.literal("payload/node_modules"),
  dependencyTreeHash: Sha256Schema,
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

const ProductionPackageResolutionEntryIdentityV2Schema = z.object({
  schema: z.literal(PRODUCTION_PACKAGE_RESOLUTION_ENTRY_V2_SCHEMA),
  packageLocator: PlatformReleasePortableLocatorV2Schema.refine(
    (value) => value.startsWith("node_modules/"),
    "Production package locator must be rooted under node_modules",
  ),
  packageName: PlatformReleaseNpmPackageNameV2Schema,
  version: PlatformReleaseVersionIdentityV2Schema,
  lockEntryHash: Sha256Schema,
  packageJsonHash: Sha256Schema,
  runtimeTreeHash: Sha256Schema,
  dependencyLocators: z.array(PlatformReleasePortableLocatorV2Schema)
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
  packages: z.array(ProductionPackageResolutionEntryV2Schema)
    .max(EXTERNAL_RUNTIME_RESOLUTION_V2_MAX_PACKAGES),
  packageCount: z.number().int().nonnegative()
    .max(EXTERNAL_RUNTIME_RESOLUTION_V2_MAX_PACKAGES),
}).strict().superRefine((value, context) => {
  const locators = value.packages.map((entry) => entry.packageLocator);
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
  let dependencyEdges = 0;
  value.packages.forEach((entry, packageIndex) => {
    dependencyEdges += entry.dependencyLocators.length;
    entry.dependencyLocators.forEach((dependencyLocator, dependencyIndex) => {
      if (!locatorSet.has(dependencyLocator) || dependencyLocator === entry.packageLocator) {
        context.addIssue({
          code: "custom",
          path: ["packages", packageIndex, "dependencyLocators", dependencyIndex],
          message: "Every dependency edge must resolve to one other exact package entry",
        });
      }
    });
  });
  if (dependencyEdges > EXTERNAL_RUNTIME_RESOLUTION_V2_MAX_DEPENDENCY_EDGES) {
    context.addIssue({
      code: "custom",
      path: ["packages"],
      message: "Production package dependency-edge limit exceeded",
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
