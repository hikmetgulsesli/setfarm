import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";

import {
  canonicalJsonStringify,
  hashCanonicalJson,
} from "../../../src/product-compiler/canonical-json.js";
import {
  captureCanonicalRuntimeTreeV2,
  type CanonicalRuntimeMetadataProbeV2,
} from "../../../src/execution/canonical-runtime-tree-v2.js";
import {
  getProductDeliveryProfileCatalogV2,
} from
  "../../../src/product-compiler/product-delivery-profile-catalog-v2.js";
import {
  getInvocationTransportCodecCatalogV2,
} from
  "../../../src/product-compiler/schemas/invocation-input-transport-v2.js";
import {
  getEvidenceAdapterDefinitionCatalogV2,
} from
  "../../../src/evidence/schemas/evidence-adapter-definition-catalog-v2.js";
import {
  EVIDENCE_CLI_PROCESS_RUNNER_ABI_HASH_V2,
  EVIDENCE_CLI_PROCESS_RUNNER_ABI_REF_V2,
  EVIDENCE_CLI_PROCESS_RUNNER_ENTRYPOINT_REF_V2,
  EVIDENCE_CLI_PROCESS_RUNNER_EXPORT_V2,
  EVIDENCE_CLI_PROCESS_RUNNER_MODULE_LOCATOR_V2,
} from "../../../src/evidence/schemas/cli-process-runner-v2.js";
import {
  EVIDENCE_COMMAND_RUNNER_ABI_HASH_V2,
  EVIDENCE_COMMAND_RUNNER_ABI_REF_V2,
  EVIDENCE_COMMAND_RUNNER_ENTRYPOINT_REF_V2,
  EVIDENCE_COMMAND_RUNNER_EXPORT_V2,
  EVIDENCE_COMMAND_RUNNER_MODULE_LOCATOR_V2,
} from "../../../src/evidence/schemas/command-runner-v2.js";
import {
  EVIDENCE_HTTP_SERVICE_RUNNER_ABI_HASH_V2,
  EVIDENCE_HTTP_SERVICE_RUNNER_ABI_REF_V2,
  EVIDENCE_HTTP_SERVICE_RUNNER_ENTRYPOINT_REF_V2,
  EVIDENCE_HTTP_SERVICE_RUNNER_EXPORT_V2,
  EVIDENCE_HTTP_SERVICE_RUNNER_MODULE_LOCATOR_V2,
} from "../../../src/evidence/schemas/http-service-runner-v2.js";
import {
  INVOCATION_EVIDENCE_RUNNER_EXECUTION_LEASE_CONTRACT_HASH_V2,
} from
  "../../../src/evidence/schemas/invocation-evidence-runner-execution-lease-v2.js";
import {
  getEvidenceReceiptAbiPolicyV2,
} from "../../../src/evidence/schemas/evidence-receipt-v2.js";
import {
  EVIDENCE_ENVIRONMENT_CAPSULE_V2_SCHEMA,
  EVIDENCE_ENVIRONMENT_NETWORK_ENFORCEMENT_REF_V2,
  EVIDENCE_ENVIRONMENT_NETWORK_WRAPPER_EXPORT_V2,
  EVIDENCE_ENVIRONMENT_NETWORK_WRAPPER_MODULE_V2,
  EVIDENCE_ENVIRONMENT_SANDBOX_EXECUTABLE_REF_V2,
  METADATA_PROBE_AUTHORITY_V2_SCHEMA,
  METADATA_PROBE_RECEIPT_V2_SCHEMA,
  NETWORK_ISOLATION_AUTHORITY_V2_SCHEMA,
  NETWORK_ISOLATION_NEGATIVE_PROBE_RECEIPT_SCHEMA_HASH_V2,
  NETWORK_NEGATIVE_PROBE_RECEIPT_V2_SCHEMA,
  hashEvidenceEnvironmentCapsuleV2,
  hashMetadataProbeAuthorityV2,
  hashNetworkIsolationAuthorityV2,
} from
  "../../../src/execution/schemas/evidence-environment-capsule-v2.js";
import {
  EXCLUSIVE_SOCKET_LIFECYCLE_ABI_HASH_V2,
  EXCLUSIVE_SOCKET_PORT_BANDS_POLICY_HASH_V2,
} from
  "../../../src/execution/schemas/exclusive-socket-lease-v2.js";
import {
  BROWSER_RUNTIME_RESOLUTION_V2_SCHEMA,
  EXACT_SOURCE_FILE_REF_V2_SCHEMA,
  EXTERNAL_EXECUTABLE_RESOLUTION_V2_SCHEMA,
  EXTERNAL_RUNTIME_RESOLUTION_V2_SCHEMA,
  HOST_BOOTSTRAP_BINDING_V2_SCHEMA,
  HOST_RUNTIME_IDENTITY_V2_SCHEMA,
  NODE_RUNTIME_RESOLUTION_V2_SCHEMA,
  NON_SYSTEM_DYNAMIC_LIBRARY_V2_SCHEMA,
  NPM_MATERIALIZATION_RECEIPT_V2_SCHEMA,
  NPM_PACKAGE_MANAGER_RESOLUTION_V2_SCHEMA,
  NPM_PRODUCTION_MATERIALIZATION_RECIPE_V2_SCHEMA,
  PRODUCTION_PACKAGE_RESOLUTION_GRAPH_V2_SCHEMA,
  hashExternalRuntimeResolutionV2,
  hashHostRuntimeIdentityV2,
  hashNpmMaterializationReceiptV2,
  hashNpmProductionMaterializationRecipeV2,
  hashProductionPackageResolutionGraphV2,
} from
  "../../../src/execution/schemas/external-runtime-resolution-v2.js";
import {
  NODE_CLI_LAUNCHER_ABI_HASH_V2,
  NODE_CLI_LAUNCHER_ABI_REF_V2,
  NODE_CLI_LAUNCHER_EXPORT_V2,
  NODE_CLI_LAUNCHER_MODULE_LOCATOR_V2,
  NODE_CLI_LAUNCHER_REF_V2,
} from "../../../src/execution/schemas/node-cli-launcher-v2.js";
import {
  NODE_EXPRESS_API_LAUNCHER_ABI_HASH_V2,
  NODE_EXPRESS_API_LAUNCHER_ABI_REF_V2,
  NODE_EXPRESS_API_LAUNCHER_EXPORT_V2,
  NODE_EXPRESS_API_LAUNCHER_MODULE_LOCATOR_V2,
  NODE_EXPRESS_API_LAUNCHER_REF_V2,
} from
  "../../../src/execution/schemas/node-express-api-launcher-v2.js";
import {
  EXACT_LEGACY_STITCH_CONVERTER_REF_V2_SCHEMA,
  EXACT_PLATFORM_RELEASE_SOURCE_REF_V2_SCHEMA,
  PLATFORM_RELEASE_BUILD_COMMAND_RESULT_V2_SCHEMA,
  PLATFORM_RELEASE_BUILD_CONTRACT_HASH_V2,
  PLATFORM_RELEASE_BUILD_RECEIPT_V2_SCHEMA,
  PLATFORM_RELEASE_EMPTY_GIT_STATUS_CONTENT_HASH_V2,
  PLATFORM_RELEASE_SOURCE_ADMISSION_CONTRACT_HASH_V2,
  PLATFORM_RELEASE_SOURCE_GIT_COMMAND_CONTRACT_HASH_V2,
  PLATFORM_RELEASE_SOURCE_HTTPS_ORIGIN_HASH_V2,
  PLATFORM_RELEASE_SOURCE_REPOSITORY_ID_V2,
  PLATFORM_RELEASE_SOURCE_STAGE_PHYSICAL_IDENTITY_V2_SCHEMA,
  PLATFORM_RELEASE_SOURCE_TREE_BINDING_V2_SCHEMA,
  SOURCE_ADMISSION_RECEIPT_V2_SCHEMA,
  hashExactPlatformReleaseSourceRefV2,
  hashPlatformReleaseBuildReceiptV2,
  hashPlatformReleaseSourceStagePhysicalIdentityV2,
  hashPlatformReleaseSourceTreeBindingV2,
  hashSourceAdmissionReceiptV2,
} from
  "../../../src/execution/schemas/platform-release-build-v2.js";
import {
  EXACT_HOST_OWNED_FILE_REF_V2_SCHEMA,
  HOST_ADMISSION_PHYSICAL_IDENTITY_V2_SCHEMA,
  HOST_ADMISSION_RECEIPT_V2_SCHEMA,
  HOST_ADMISSION_VERIFIER_V2_SCHEMA,
  hashHostAdmissionPhysicalIdentityV2,
  hashHostAdmissionReceiptV2,
} from
  "../../../src/execution/schemas/platform-release-common-v2.js";
import {
  getPlatformEvidenceDefinitionCatalogsV2,
} from
  "../../../src/execution/schemas/platform-evidence-definition-catalogs-v2.js";
import {
  PLATFORM_LAUNCHER_CATALOG_ENTRY_V2_SCHEMA,
  PLATFORM_LAUNCHER_CATALOG_V2_SCHEMA,
  PLATFORM_RELEASE_MODULE_REF_V2_SCHEMA,
  PLATFORM_RELEASE_NODE_EXECUTABLE_REF_V2,
  PLATFORM_RUNNER_CATALOG_ENTRY_V2_SCHEMA,
  PLATFORM_RUNNER_CATALOG_V2_SCHEMA,
  hashPlatformLauncherCatalogEntryV2,
  hashPlatformLauncherCatalogV2,
  hashPlatformReleaseModuleRefV2,
  hashPlatformRunnerCatalogEntryV2,
  hashPlatformRunnerCatalogV2,
  hashPlatformRunnerToolchainV2,
} from
  "../../../src/execution/schemas/platform-release-module-catalogs-v2.js";
import {
  PLATFORM_RELEASE_MANIFEST_V2_SCHEMA,
  hashPlatformReleaseManifestV2,
  type PlatformReleaseManifestV2,
} from
  "../../../src/execution/schemas/platform-release-manifest-v2.js";
import {
  CANONICAL_RUNTIME_TREE_BINDING_V2_SCHEMA,
  EXACT_BUNDLED_FILE_REF_V2_SCHEMA,
  PLATFORM_RUNTIME_PAYLOAD_V2_SCHEMA,
  RELEASE_LAYOUT_V2,
  RUNTIME_PAYLOAD_LAYOUT_V2,
  hashCanonicalRuntimeTreeBindingV2,
  hashPlatformRuntimePayloadV2,
} from
  "../../../src/execution/schemas/platform-runtime-payload-v2.js";
import {
  CANONICAL_RUNTIME_TREE_V2_SCHEMA,
  type CanonicalRuntimeTreeV2,
} from
  "../../../src/execution/schemas/canonical-runtime-tree-v2.js";

export function fixtureShaV2(label: string): string {
  return createHash("sha256").update(label).digest("hex");
}

function gitHash(label: string): string {
  return fixtureShaV2(label).slice(0, 40);
}

function hostFile(
  label: string,
  absoluteRealpathLocator: string,
  mode: "0444" | "0555",
  byteLength: number,
) {
  const target = {
    absoluteRealpathLocator,
    hash: fixtureShaV2(label),
    byteLength,
    ownerUid: 0 as const,
    ownerGid: 0,
    mode,
  };
  const physicalIdentity = {
    schema: HOST_ADMISSION_PHYSICAL_IDENTITY_V2_SCHEMA,
    device: "1",
    inode: BigInt(
      `0x${fixtureShaV2(`${label}-inode`).slice(0, 12)}`,
    ).toString(),
    linkCount: 1 as const,
    hash: target.hash,
    byteLength,
    ownerUid: 0 as const,
    ownerGid: 0,
    mode,
  };
  const physical = {
    ...physicalIdentity,
    identityHash:
      hashHostAdmissionPhysicalIdentityV2({
        ...physicalIdentity,
        identityHash: fixtureShaV2("placeholder"),
      }),
  };
  const receiptIdentity = {
    schema: HOST_ADMISSION_RECEIPT_V2_SCHEMA,
    version: "2.0.0" as const,
    authorityState:
      "candidate_host_admission_receipt_unverified" as const,
    productionUse:
      "forbidden_until_fresh_independent_host_bootstrap_verification" as const,
    host: {
      platform: "darwin" as const,
      architecture: "arm64" as const,
      macosProductVersion: "15.5",
      macosBuildVersion: "24F74",
      darwinKernelRelease: "24.5.0",
    },
    target,
    physicalBefore: physical,
    physicalAfter: structuredClone(physical),
    metadata: {
      acl: "absent" as const,
      extendedAttributes: "absent" as const,
      probeReceiptHash: fixtureShaV2(`${label}-metadata-probe`),
    },
    verifier: {
      schema: HOST_ADMISSION_VERIFIER_V2_SCHEMA,
      installationScope:
        "root_owned_separately_installed" as const,
      absoluteRealpathLocator:
        "/usr/local/libexec/setfarm/host-admission-v2",
      hash: fixtureShaV2("host-admission-verifier"),
      byteLength: 12_001,
      ownerUid: 0 as const,
      ownerGid: 0,
      mode: "0555" as const,
      requiredAbi:
        "HOST_FILE_STABLE_DESCRIPTOR_ADMISSION_V2" as const,
      abiHash: fixtureShaV2("host-admission-verifier-abi"),
      installationAnchorHash:
        fixtureShaV2("host-admission-installation-anchor"),
    },
  };
  const hostAdmissionReceipt = {
    ...receiptIdentity,
    receiptHash:
      hashHostAdmissionReceiptV2(receiptIdentity as never),
  };
  return {
    schema: EXACT_HOST_OWNED_FILE_REF_V2_SCHEMA,
    ...target,
    hostAdmissionEvidenceHash: hostAdmissionReceipt.receiptHash,
    hostAdmissionReceipt,
  };
}

function runtimeTreeBinding(
  profile: "dist" | "dependencies",
  rootLocator: "payload/dist" | "payload/node_modules",
) {
  const identity = {
    schema: CANONICAL_RUNTIME_TREE_BINDING_V2_SCHEMA,
    treeSchema: CANONICAL_RUNTIME_TREE_V2_SCHEMA,
    profile,
    rootLocator,
    treeHash: fixtureShaV2(`${profile}-tree`),
    treePayloadHash: fixtureShaV2(`${profile}-tree-payload`),
    fileCount: profile === "dist" ? 12 : 4,
    directoryCount: profile === "dist" ? 7 : 3,
    totalBytes: profile === "dist" ? 71_001 : 18_003,
  };
  return {
    ...identity,
    bindingHash: hashCanonicalRuntimeTreeBindingV2(identity),
  };
}

function runtimePayload() {
  const identity = {
    schema: PLATFORM_RUNTIME_PAYLOAD_V2_SCHEMA,
    version: "2.0.0" as const,
    layout: structuredClone(RUNTIME_PAYLOAD_LAYOUT_V2),
    rootLocator: "payload" as const,
    allowedRootEntries: ["dist", "node_modules", "package.json"] as const,
    platformTree: runtimeTreeBinding("dist", "payload/dist"),
    dependencyTree:
      runtimeTreeBinding("dependencies", "payload/node_modules"),
    packageJson: {
      schema: EXACT_BUNDLED_FILE_REF_V2_SCHEMA,
      locator: "payload/package.json" as const,
      mediaType: "application/json" as const,
      hash: fixtureShaV2("package-json"),
      byteLength: 761,
      mode: "0444" as const,
    },
    ownership: {
      ownerUid: 0 as const,
      ownerGid: 0,
      runtimeUid: 501,
      runtimeMustNotOwnRelease: true as const,
      rootMode: "0555" as const,
    },
  };
  return {
    ...identity,
    runtimePayloadHash: hashPlatformRuntimePayloadV2(identity),
  };
}

function metadataProbe() {
  const identity = {
    schema: METADATA_PROBE_AUTHORITY_V2_SCHEMA,
    installationScope: "root_owned_separately_installed" as const,
    bootstrapModule: hostFile(
      "metadata-module",
      "/usr/local/libexec/setfarm/metadata-probe-v2.js",
      "0444",
      5_103,
    ),
    bootstrapExport: "probeReleaseMetadataV2",
    xattrTool: {
      executableRef: "EXEC_XATTR_TOOL_V2",
      executableHash: fixtureShaV2("xattr"),
    },
    aclTool: {
      executableRef: "EXEC_ACL_TOOL_V2",
      executableHash: fixtureShaV2("acl"),
    },
    canonicalClearPolicyHash: fixtureShaV2("metadata-clear"),
    probeReceiptSchema: METADATA_PROBE_RECEIPT_V2_SCHEMA,
    probeReceiptSchemaHash: fixtureShaV2("metadata-receipt-schema"),
  };
  return {
    ...identity,
    authorityHash: hashMetadataProbeAuthorityV2(identity),
  };
}

function hostRuntime() {
  const identity = {
    schema: HOST_RUNTIME_IDENTITY_V2_SCHEMA,
    platform: "darwin" as const,
    architecture: "arm64" as const,
    macosProductVersion: "15.5",
    macosBuildVersion: "24F74",
    darwinKernelRelease: "24.5.0",
    bootstrap: {
      schema: HOST_BOOTSTRAP_BINDING_V2_SCHEMA,
      installationScope: "root_owned_separately_installed" as const,
      executableRef: "EXEC_BOOTSTRAP_V2",
      executable: hostFile(
        "bootstrap-executable",
        "/usr/local/libexec/setfarm/bootstrap-v2",
        "0555",
        7_001,
      ),
      module: hostFile(
        "bootstrap-module",
        "/usr/local/libexec/setfarm/bootstrap-v2.js",
        "0444",
        9_002,
      ),
    },
    runtimeUid: 501,
    runtimeGid: 20,
    nonSystemDynamicLibraries: [{
      schema: NON_SYSTEM_DYNAMIC_LIBRARY_V2_SCHEMA,
      absoluteLocator: "/opt/homebrew/lib/libalpha.dylib",
      hash: fixtureShaV2("libalpha"),
      byteLength: 1_003,
    }],
    systemDynamicLibraryTrust: "exact_macos_build_identity" as const,
  };
  return {
    ...identity,
    hostRuntimeIdentityHash: hashHostRuntimeIdentityV2(identity),
  };
}

function npmRecipe() {
  const identity = {
    schema: NPM_PRODUCTION_MATERIALIZATION_RECIPE_V2_SCHEMA,
    commandRef: "MATERIALIZE_PRODUCTION_DEPENDENCIES_V2" as const,
    subcommand: "ci" as const,
    arguments: [
      "--omit=dev",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
    ] as const,
    dependencySelection: "production_only" as const,
    lifecycleScripts: "forbidden" as const,
    configHash: fixtureShaV2("npm-config"),
    materializationReceiptSchema:
      NPM_MATERIALIZATION_RECEIPT_V2_SCHEMA,
    materializationReceiptSchemaHash:
      fixtureShaV2("npm-receipt-schema"),
  };
  return {
    ...identity,
    recipeHash: hashNpmProductionMaterializationRecipeV2(identity),
  };
}

function externalExecutable(
  executableRef: string,
  purpose:
    | "network_sandbox"
    | "node_runtime"
    | "npm_package_manager"
    | "platform_tool",
  absoluteLocator: string,
  hash: string,
  byteLength: number,
) {
  return {
    schema: EXTERNAL_EXECUTABLE_RESOLUTION_V2_SCHEMA,
    executableRef,
    purpose,
    absoluteLocator,
    hash,
    byteLength,
  };
}

function externalResolution(payload: ReturnType<typeof runtimePayload>) {
  const host = hostRuntime();
  const probe = metadataProbe();
  const recipe = npmRecipe();
  const packageManager = {
    schema: NPM_PACKAGE_MANAGER_RESOLUTION_V2_SCHEMA,
    packageName: "npm" as const,
    version: "11.4.2",
    executableRef: "EXEC_NPM_PACKAGE_MANAGER_V2",
    packageTreeHash: fixtureShaV2("npm-package-tree"),
    installRecipe: recipe,
  };
  const graphIdentity = {
    schema: PRODUCTION_PACKAGE_RESOLUTION_GRAPH_V2_SCHEMA,
    version: "2.0.0" as const,
    lockfileVersion: 3 as const,
    lockfile: {
      schema: EXACT_SOURCE_FILE_REF_V2_SCHEMA,
      locator: "package-lock.json" as const,
      mediaType: "application/json" as const,
      hash: fixtureShaV2("package-lock"),
      byteLength: 14_321,
    },
    materializedDependencyTreeHash: payload.dependencyTree.treeHash,
    packages: [],
    packageCount: 0,
  };
  const productionPackages = {
    ...graphIdentity,
    resolutionGraphHash:
      hashProductionPackageResolutionGraphV2(graphIdentity),
  };
  const materializationIdentity = {
    schema: NPM_MATERIALIZATION_RECEIPT_V2_SCHEMA,
    recipeHash: recipe.recipeHash,
    npmIdentity: {
      packageName: packageManager.packageName,
      version: packageManager.version,
      executableRef: packageManager.executableRef,
      packageTreeHash: packageManager.packageTreeHash,
    },
    lockfile: structuredClone(productionPackages.lockfile),
    outputRoot: "payload/node_modules" as const,
    dependencyTreeHash: payload.dependencyTree.treeHash,
    packageCount: 0,
    lifecycleScripts: "forbidden" as const,
    exitCode: 0 as const,
  };
  const materializationReceipt = {
    ...materializationIdentity,
    receiptHash:
      hashNpmMaterializationReceiptV2(materializationIdentity),
  };
  const identity = {
    schema: EXTERNAL_RUNTIME_RESOLUTION_V2_SCHEMA,
    version: "2.0.0" as const,
    hostRuntime: host,
    nodeRuntime: {
      schema: NODE_RUNTIME_RESOLUTION_V2_SCHEMA,
      runtimeRef: "RUNTIME_NODE_PROCESS" as const,
      version: "22.17.0",
      modulesAbi: "127",
      napiVersion: "10",
      platform: "darwin" as const,
      architecture: "arm64" as const,
      executableRef: "EXEC_NODE_RUNTIME_V2",
    },
    packageManager,
    productionPackages,
    materializationReceipt,
    metadataProbe: probe,
    executables: [
      externalExecutable(
        "EXEC_ACL_TOOL_V2",
        "platform_tool",
        "/bin/chmod",
        probe.aclTool.executableHash,
        31,
      ),
      externalExecutable(
        "EXEC_BOOTSTRAP_V2",
        "platform_tool",
        host.bootstrap.executable.absoluteRealpathLocator,
        host.bootstrap.executable.hash,
        host.bootstrap.executable.byteLength,
      ),
      externalExecutable(
        EVIDENCE_ENVIRONMENT_SANDBOX_EXECUTABLE_REF_V2,
        "network_sandbox",
        "/usr/bin/sandbox-exec",
        fixtureShaV2("sandbox"),
        37,
      ),
      externalExecutable(
        "EXEC_NODE_RUNTIME_V2",
        "node_runtime",
        "/opt/homebrew/bin/node",
        fixtureShaV2("node"),
        47,
      ),
      externalExecutable(
        "EXEC_NPM_PACKAGE_MANAGER_V2",
        "npm_package_manager",
        "/opt/homebrew/bin/npm",
        fixtureShaV2("npm"),
        43,
      ),
      externalExecutable(
        "EXEC_XATTR_TOOL_V2",
        "platform_tool",
        "/usr/bin/xattr",
        probe.xattrTool.executableHash,
        29,
      ),
    ],
    browserRuntime: {
      schema: BROWSER_RUNTIME_RESOLUTION_V2_SCHEMA,
      status: "forbidden" as const,
      runtimeInstall: "forbidden" as const,
      channelFallback: "forbidden" as const,
    },
  };
  return {
    ...identity,
    externalResolutionHash: hashExternalRuntimeResolutionV2(identity),
  };
}

function environment(
  external: ReturnType<typeof externalResolution>,
) {
  const networkIdentity = {
    schema: NETWORK_ISOLATION_AUTHORITY_V2_SCHEMA,
    enforcementRef: EVIDENCE_ENVIRONMENT_NETWORK_ENFORCEMENT_REF_V2,
    wrapperModuleLocator:
      EVIDENCE_ENVIRONMENT_NETWORK_WRAPPER_MODULE_V2,
    wrapperExport: EVIDENCE_ENVIRONMENT_NETWORK_WRAPPER_EXPORT_V2,
    wrapperModuleHash: fixtureShaV2("network-wrapper"),
    sandboxExecutableRef:
      EVIDENCE_ENVIRONMENT_SANDBOX_EXECUTABLE_REF_V2,
    canonicalProfileHash: fixtureShaV2("network-profile"),
    hostRuntimeIdentityHash:
      external.hostRuntime.hostRuntimeIdentityHash,
    negativeProbeReceiptSchema:
      NETWORK_NEGATIVE_PROBE_RECEIPT_V2_SCHEMA,
    negativeProbeReceiptSchemaHash:
      NETWORK_ISOLATION_NEGATIVE_PROBE_RECEIPT_SCHEMA_HASH_V2,
  };
  const identity = {
    schema: EVIDENCE_ENVIRONMENT_CAPSULE_V2_SCHEMA,
    version: "2.0.0" as const,
    childProcess: {
      inheritAmbientEnvironment: false as const,
      shell: "forbidden" as const,
      executableResolution: "manifest_exact_absolute" as const,
      baseEnvironment: {
        CI: "true" as const,
        LANG: "C.UTF-8" as const,
        LC_ALL: "C.UTF-8" as const,
        NO_COLOR: "1" as const,
        TZ: "UTC" as const,
      },
      runtimeTokens: [
        "HOST",
        "HOME",
        "PORT",
        "RUNTIME_URL",
        "RUN_CACHE_DIR",
        "RUN_HOME",
        "RUN_TMPDIR",
        "TEMP",
        "TMP",
        "TMPDIR",
      ] as const,
      attemptScopedDirectoryMappings: {
        HOME: "RUN_HOME" as const,
        TEMP: "RUN_TMPDIR" as const,
        TMP: "RUN_TMPDIR" as const,
        TMPDIR: "RUN_TMPDIR" as const,
      },
      credentialRefs: [] as const,
      cwdPolicy:
        "candidate_runtime_bundle_descendant_only" as const,
      umask: "0077" as const,
    },
    network: {
      mode: "loopback_only" as const,
      outboundInternet: "forbidden" as const,
      dns: "forbidden" as const,
      authority: {
        ...networkIdentity,
        authorityHash:
          hashNetworkIsolationAuthorityV2(networkIdentity),
      },
    },
    portLease: {
      mode: "exclusive_socket_lease" as const,
      host: "127.0.0.1" as const,
      bandsHash: EXCLUSIVE_SOCKET_PORT_BANDS_POLICY_HASH_V2,
      lifecycleAbiHash: EXCLUSIVE_SOCKET_LIFECYCLE_ABI_HASH_V2,
    },
    filesystem: {
      releaseRoot: "immutable_read_only" as const,
      runtimeScratch: "attempt_scoped" as const,
      metadataProbeAuthorityHash:
        external.metadataProbe.authorityHash,
    },
  };
  return {
    ...identity,
    environmentCapsuleHash:
      hashEvidenceEnvironmentCapsuleV2(identity),
  };
}

function moduleRef(moduleLocator: string, byteLength: number) {
  const identity = {
    schema: PLATFORM_RELEASE_MODULE_REF_V2_SCHEMA,
    moduleLocator,
    payloadLocator: `payload/${moduleLocator}`,
    mediaType: "text/javascript" as const,
    contentHash: fixtureShaV2(moduleLocator),
    byteLength,
    mode: "0444" as const,
  };
  return {
    ...identity,
    moduleRefHash:
      hashPlatformReleaseModuleRefV2(identity as never),
  };
}

function moduleCatalogs(
  payload: ReturnType<typeof runtimePayload>,
  external: ReturnType<typeof externalResolution>,
  capsule: ReturnType<typeof environment>,
) {
  const profiles = getProductDeliveryProfileCatalogV2();
  const definitions = getPlatformEvidenceDefinitionCatalogsV2();
  const codecs = getInvocationTransportCodecCatalogV2();
  const receipt = getEvidenceReceiptAbiPolicyV2();
  const adapters = getEvidenceAdapterDefinitionCatalogV2();
  const cliProfile = profiles.profiles[0]!;
  const apiProfile = profiles.profiles[1]!;
  const launcherEntries = [
    {
      schema: PLATFORM_LAUNCHER_CATALOG_ENTRY_V2_SCHEMA,
      launcherRef: NODE_CLI_LAUNCHER_REF_V2,
      invocationKind: "cli_process" as const,
      profile: {
        profileId: cliProfile.id,
        profileHash: cliProfile.profileHash,
      },
      requirementDefinitionHash:
        definitions.launcherRequirements.definitions[0]!.definitionHash,
      module: moduleRef(NODE_CLI_LAUNCHER_MODULE_LOCATOR_V2, 10_001),
      requiredExport: NODE_CLI_LAUNCHER_EXPORT_V2,
      abiRef: NODE_CLI_LAUNCHER_ABI_REF_V2,
      abiHash: NODE_CLI_LAUNCHER_ABI_HASH_V2,
      runnerEntrypointRef:
        EVIDENCE_CLI_PROCESS_RUNNER_ENTRYPOINT_REF_V2,
      executableRef: PLATFORM_RELEASE_NODE_EXECUTABLE_REF_V2,
      environmentCapsuleHash: capsule.environmentCapsuleHash,
    },
    {
      schema: PLATFORM_LAUNCHER_CATALOG_ENTRY_V2_SCHEMA,
      launcherRef: NODE_EXPRESS_API_LAUNCHER_REF_V2,
      invocationKind: "http_service" as const,
      profile: {
        profileId: apiProfile.id,
        profileHash: apiProfile.profileHash,
      },
      requirementDefinitionHash:
        definitions.launcherRequirements.definitions[1]!.definitionHash,
      module: moduleRef(
        NODE_EXPRESS_API_LAUNCHER_MODULE_LOCATOR_V2,
        10_002,
      ),
      requiredExport: NODE_EXPRESS_API_LAUNCHER_EXPORT_V2,
      abiRef: NODE_EXPRESS_API_LAUNCHER_ABI_REF_V2,
      abiHash: NODE_EXPRESS_API_LAUNCHER_ABI_HASH_V2,
      runnerEntrypointRef:
        EVIDENCE_HTTP_SERVICE_RUNNER_ENTRYPOINT_REF_V2,
      executableRef: PLATFORM_RELEASE_NODE_EXECUTABLE_REF_V2,
      environmentCapsuleHash: capsule.environmentCapsuleHash,
    },
  ].map((entry) => ({
    ...entry,
    entryHash:
      hashPlatformLauncherCatalogEntryV2(entry as never),
  }));
  const launcherIdentity = {
    schema: PLATFORM_LAUNCHER_CATALOG_V2_SCHEMA,
    version: "2.0.0" as const,
    authorityState: "candidate_module_bytes_unverified" as const,
    productionUse:
      "forbidden_until_fresh_verified_release" as const,
    runtimePayloadHash: payload.runtimePayloadHash,
    platformTreeHash: payload.platformTree.treeHash,
    externalResolutionHash: external.externalResolutionHash,
    environmentCapsuleHash: capsule.environmentCapsuleHash,
    profileCatalogHash: profiles.catalogHash,
    requirementCatalogHash:
      definitions.launcherRequirements.catalogHash,
    entries: launcherEntries,
  };
  const launcher = {
    ...launcherIdentity,
    catalogHash:
      hashPlatformLauncherCatalogV2(launcherIdentity as never),
  };
  const runnerStatic = [
    {
      runnerEntrypointRef:
        EVIDENCE_CLI_PROCESS_RUNNER_ENTRYPOINT_REF_V2,
      invocationKind: "cli_process" as const,
      profileBindings: [{
        profileId: cliProfile.id,
        profileHash: cliProfile.profileHash,
      }],
      module: moduleRef(
        EVIDENCE_CLI_PROCESS_RUNNER_MODULE_LOCATOR_V2,
        20_001,
      ),
      requiredExport: EVIDENCE_CLI_PROCESS_RUNNER_EXPORT_V2,
      abiRef: EVIDENCE_CLI_PROCESS_RUNNER_ABI_REF_V2,
      abiHash: EVIDENCE_CLI_PROCESS_RUNNER_ABI_HASH_V2,
      admission: {
        kind: "invocation" as const,
        readiness:
          "admission_boundary_only_until_verified_release_join" as const,
        productionUse: "forbidden" as const,
        executionLeaseContractHash:
          INVOCATION_EVIDENCE_RUNNER_EXECUTION_LEASE_CONTRACT_HASH_V2,
      },
    },
    {
      runnerEntrypointRef:
        EVIDENCE_COMMAND_RUNNER_ENTRYPOINT_REF_V2,
      invocationKind: "command" as const,
      profileBindings: [
        {
          profileId: cliProfile.id,
          profileHash: cliProfile.profileHash,
        },
        {
          profileId: apiProfile.id,
          profileHash: apiProfile.profileHash,
        },
      ],
      module: moduleRef(
        EVIDENCE_COMMAND_RUNNER_MODULE_LOCATOR_V2,
        20_002,
      ),
      requiredExport: EVIDENCE_COMMAND_RUNNER_EXPORT_V2,
      abiRef: EVIDENCE_COMMAND_RUNNER_ABI_REF_V2,
      abiHash: EVIDENCE_COMMAND_RUNNER_ABI_HASH_V2,
      admission: {
        kind: "command" as const,
        readiness:
          "shadow_blocked_until_activated_command_execution_lease" as const,
        productionUse: "forbidden" as const,
      },
    },
    {
      runnerEntrypointRef:
        EVIDENCE_HTTP_SERVICE_RUNNER_ENTRYPOINT_REF_V2,
      invocationKind: "http_service" as const,
      profileBindings: [{
        profileId: apiProfile.id,
        profileHash: apiProfile.profileHash,
      }],
      module: moduleRef(
        EVIDENCE_HTTP_SERVICE_RUNNER_MODULE_LOCATOR_V2,
        20_003,
      ),
      requiredExport: EVIDENCE_HTTP_SERVICE_RUNNER_EXPORT_V2,
      abiRef: EVIDENCE_HTTP_SERVICE_RUNNER_ABI_REF_V2,
      abiHash: EVIDENCE_HTTP_SERVICE_RUNNER_ABI_HASH_V2,
      admission: {
        kind: "invocation" as const,
        readiness:
          "admission_boundary_only_until_verified_release_join" as const,
        productionUse: "forbidden" as const,
        executionLeaseContractHash:
          INVOCATION_EVIDENCE_RUNNER_EXECUTION_LEASE_CONTRACT_HASH_V2,
      },
    },
  ] as const;
  const runnerEntries = runnerStatic.map((entry, index) => {
    const executionAdmissionHash =
      entry.admission.kind === "invocation"
        ? entry.admission.executionLeaseContractHash
        : entry.abiHash;
    const toolchainHash = hashPlatformRunnerToolchainV2({
      runnerEntrypointRef: entry.runnerEntrypointRef,
      runnerModuleHash: entry.module.contentHash,
      runnerAbiHash: entry.abiHash,
      platformTreeHash: payload.platformTree.treeHash,
      dependencyTreeHash: payload.dependencyTree.treeHash,
      runtimePayloadHash: payload.runtimePayloadHash,
      externalResolutionHash: external.externalResolutionHash,
      productionResolutionGraphHash:
        external.productionPackages.resolutionGraphHash,
      environmentCapsuleHash: capsule.environmentCapsuleHash,
      launcherCatalogHash: launcher.catalogHash,
      transportCodecCatalogHash: codecs.catalogHash,
      receiptSchemaHash: receipt.policyHash,
      adapterDefinitionCatalogHash: adapters.catalogHash,
      executionAdmissionHash,
    });
    const identity = {
      schema: PLATFORM_RUNNER_CATALOG_ENTRY_V2_SCHEMA,
      ...entry,
      requirementDefinitionHash:
        definitions.runnerRequirements.definitions[index]!.definitionHash,
      executableRefs: [PLATFORM_RELEASE_NODE_EXECUTABLE_REF_V2] as const,
      toolchainHash,
    };
    return {
      ...identity,
      entryHash:
        hashPlatformRunnerCatalogEntryV2(identity as never),
    };
  });
  const runnerIdentity = {
    schema: PLATFORM_RUNNER_CATALOG_V2_SCHEMA,
    version: "2.0.0" as const,
    authorityState: "candidate_module_bytes_unverified" as const,
    productionUse:
      "forbidden_until_fresh_verified_release_and_derived_adapter_catalog" as const,
    runtimePayloadHash: payload.runtimePayloadHash,
    platformTreeHash: payload.platformTree.treeHash,
    dependencyTreeHash: payload.dependencyTree.treeHash,
    externalResolutionHash: external.externalResolutionHash,
    productionResolutionGraphHash:
      external.productionPackages.resolutionGraphHash,
    environmentCapsuleHash: capsule.environmentCapsuleHash,
    profileCatalogHash: profiles.catalogHash,
    requirementCatalogHash:
      definitions.runnerRequirements.catalogHash,
    launcherCatalogHash: launcher.catalogHash,
    transportCodecCatalogHash: codecs.catalogHash,
    receiptSchemaHash: receipt.policyHash,
    adapterDefinitionCatalogHash: adapters.catalogHash,
    invocationExecutionLeasePolicyHash:
      INVOCATION_EVIDENCE_RUNNER_EXECUTION_LEASE_CONTRACT_HASH_V2,
    entries: runnerEntries,
  };
  return {
    launcher,
    runner: {
      ...runnerIdentity,
      catalogHash:
        hashPlatformRunnerCatalogV2(runnerIdentity as never),
    },
  };
}

function sourceRef(
  role:
    | "dependency_lock_manifest"
    | "package_manifest"
    | "typescript_compiler_config",
  locator: "package-lock.json" | "package.json" | "tsconfig.json",
  label: string,
  byteLength: number,
) {
  const identity = {
    schema: EXACT_PLATFORM_RELEASE_SOURCE_REF_V2_SCHEMA,
    role,
    locator,
    mediaType: "application/json" as const,
    gitBlobHash: gitHash(`${label}-blob`),
    contentHash: fixtureShaV2(label),
    byteLength,
    gitMode: "100644" as const,
    exportedMode: "0444" as const,
  };
  return {
    ...identity,
    sourceRefHash:
      hashExactPlatformReleaseSourceRefV2(identity),
  };
}

function sourceInputs() {
  return [
    sourceRef(
      "dependency_lock_manifest",
      "package-lock.json",
      "package-lock",
      14_321,
    ),
    sourceRef(
      "package_manifest",
      "package.json",
      "package-json",
      761,
    ),
    sourceRef(
      "typescript_compiler_config",
      "tsconfig.json",
      "tsconfig",
      603,
    ),
  ] as const;
}

function sourceTreeBinding(inputs: ReturnType<typeof sourceInputs>) {
  const sourceTreeHash = gitHash("source-tree");
  const inputMembershipHash = hashCanonicalJson({
    schema: "setfarm.platform-release-source-input-membership.v2",
    entries: inputs.map((entry) => ({
      role: entry.role,
      locator: entry.locator,
      sourceRefHash: entry.sourceRefHash,
    })),
  });
  const identity = {
    schema: PLATFORM_RELEASE_SOURCE_TREE_BINDING_V2_SCHEMA,
    sourceTreeHash,
    exportedFileTreeHash: fixtureShaV2("source-file-tree"),
    exportedFileCount: 187,
    exportedDirectoryCount: 49,
    exportedTotalBytes: 1_250_003,
    inputMembershipHash,
    inputs,
  };
  return {
    ...identity,
    bindingHash:
      hashPlatformReleaseSourceTreeBindingV2(identity as never),
  };
}

function gitFence(codeSha: string, treeHash: string) {
  const identity = {
    headSha: codeSha,
    treeHash,
    indexTreeHash: treeHash,
  };
  return {
    ...identity,
    identityHash: hashCanonicalJson({
      schema: "setfarm.git-source-fence-identity.v2",
      ...identity,
    }),
  };
}

function sourceAdmission(
  codeSha: string,
  treeHash: string,
  source: ReturnType<typeof sourceTreeBinding>,
) {
  const remoteObservation = {
    repositoryId:
      PLATFORM_RELEASE_SOURCE_REPOSITORY_ID_V2,
    originTransport: "github_https" as const,
    originUrlHash:
      PLATFORM_RELEASE_SOURCE_HTTPS_ORIGIN_HASH_V2,
    remoteRef: "refs/remotes/origin/main" as const,
    observedSha: codeSha,
    observedTreeHash: treeHash,
    observationHash: hashCanonicalJson({
      schema: "setfarm.remote-main-observation.v2",
      repositoryId:
        PLATFORM_RELEASE_SOURCE_REPOSITORY_ID_V2,
      originTransport: "github_https",
      originUrlHash:
        PLATFORM_RELEASE_SOURCE_HTTPS_ORIGIN_HASH_V2,
      remoteRef: "refs/remotes/origin/main",
      observedSha: codeSha,
      observedTreeHash: treeHash,
    }),
  };
  const cleanIdentity = {
    dirty: false as const,
    untrackedEntryCount: 0 as const,
    statusPorcelainContentHash:
      PLATFORM_RELEASE_EMPTY_GIT_STATUS_CONTENT_HASH_V2,
    headSha: codeSha,
    treeHash,
    indexTreeHash: treeHash,
  };
  const cleanWorktreeProof = {
    ...cleanIdentity,
    proofHash: hashCanonicalJson({
      schema: "setfarm.clean-worktree-proof.v2",
      ...cleanIdentity,
    }),
  };
  const fence = gitFence(codeSha, treeHash);
  const stageIdentity = {
    schema:
      PLATFORM_RELEASE_SOURCE_STAGE_PHYSICAL_IDENTITY_V2_SCHEMA,
    device: "1",
    inode: BigInt(
      `0x${fixtureShaV2("source-stage-inode").slice(0, 12)}`,
    ).toString(),
    ownerUid: 501,
    ownerGid: 20,
    mode: "0555" as const,
    sourceBindingHash: source.bindingHash,
  };
  const stage = {
    ...stageIdentity,
    identityHash:
      hashPlatformReleaseSourceStagePhysicalIdentityV2({
        ...stageIdentity,
        identityHash: fixtureShaV2("placeholder"),
      }),
  };
  const identity = {
    schema: SOURCE_ADMISSION_RECEIPT_V2_SCHEMA,
    version: "2.0.0" as const,
    authorityState: "candidate_observation_unverified" as const,
    productionUse:
      "forbidden_until_fresh_root_owned_source_verification" as const,
    repositoryId:
      PLATFORM_RELEASE_SOURCE_REPOSITORY_ID_V2,
    remoteRef: "refs/remotes/origin/main" as const,
    policy: "exact_remote_main_sha" as const,
    branch: "main" as const,
    admissionContractHash:
      PLATFORM_RELEASE_SOURCE_ADMISSION_CONTRACT_HASH_V2,
    remoteBefore: structuredClone(remoteObservation),
    remoteAfter: structuredClone(remoteObservation),
    admittedSource: {
      sha: codeSha,
      treeHash,
      commitEpochSeconds: "1785052800",
    },
    cleanWorktreeBefore: structuredClone(cleanWorktreeProof),
    cleanWorktreeAfter: structuredClone(cleanWorktreeProof),
    sourceBefore: structuredClone(fence),
    sourceAfter: structuredClone(fence),
    exportedSource: {
      method: "verified_git_tree_export.v2" as const,
      buildContextPolicy:
        "private_0700_parent_source_child_and_authenticated_toolchain_sibling_v2" as const,
      source,
      initialStageWasEmpty: true as const,
      stageBefore: structuredClone(stage),
      stageAfter: structuredClone(stage),
      temporaryLocatorDisclosure: "forbidden" as const,
    },
    gitTool: {
      executable: hostFile(
        "source-git",
        "/usr/local/libexec/setfarm/git-source-export-v2",
        "0555",
        118_928,
      ),
      requiredAbi:
        "GIT_OBJECT_DATABASE_SOURCE_EXPORT_V2" as const,
      commandContractHash:
        PLATFORM_RELEASE_SOURCE_GIT_COMMAND_CONTRACT_HASH_V2,
    },
    implementation: {
      ownership: "root_owned_separately_installed" as const,
      module: hostFile(
        "source-admission",
        "/usr/local/libexec/setfarm/source-admission-v2.js",
        "0444",
        11_002,
      ),
      requiredExport: "admitPlatformReleaseSourceV2" as const,
    },
  };
  return {
    ...identity,
    receiptHash: hashSourceAdmissionReceiptV2(identity),
  };
}

function legacyStitchConverter() {
  return {
    schema: EXACT_LEGACY_STITCH_CONVERTER_REF_V2_SCHEMA,
    sourceLocator: "scripts/stitch-to-jsx.mjs" as const,
    locator:
      "payload/dist/legacy-assets/stitch-to-jsx.mjs" as const,
    mediaType: "text/javascript" as const,
    hash: fixtureShaV2("stitch-converter"),
    byteLength: 31_007,
    mode: "0444" as const,
  };
}

function buildReceipt(
  stageRef:
    | "PLATFORM_RELEASE_BUILD_STAGE_FIRST_V2"
    | "PLATFORM_RELEASE_BUILD_STAGE_SECOND_V2",
  admissionReceiptHash: string,
  codeSha: string,
  source: ReturnType<typeof sourceTreeBinding>,
  sourceStagePhysicalIdentityHash: string,
  compiler: ReturnType<typeof buildCompiler>,
  packageManager: ReturnType<typeof buildPackageManager>,
  payload: ReturnType<typeof runtimePayload>,
  external: ReturnType<typeof externalResolution>,
  stitchConverter: ReturnType<typeof legacyStitchConverter>,
) {
  const outputClosureHash = hashCanonicalJson({
    schema: "setfarm.platform-release-build-output-closure.v2",
    runtimePayloadHash: payload.runtimePayloadHash,
    platformTreeBindingHash: payload.platformTree.bindingHash,
    dependencyTreeBindingHash: payload.dependencyTree.bindingHash,
    packageJsonHash: payload.packageJson.hash,
    npmMaterializationReceiptHash:
      external.materializationReceipt.receiptHash,
    legacyStitchConverter: stitchConverter,
  });
  const commandResult = {
    schema: PLATFORM_RELEASE_BUILD_COMMAND_RESULT_V2_SCHEMA,
    version: "2.0.0" as const,
    sourceFingerprintHash: source.exportedFileTreeHash,
    sourceFileCount: 187,
    sourceDirectoryCount: 49,
    sourceTotalBytes: 1_250_003,
    sourceSha: codeSha,
    sourceDateEpoch: "1785052800",
    compilerEntryHash: compiler.entryModuleHash,
    platformFileCount: payload.platformTree.fileCount,
    platformDirectoryCount: payload.platformTree.directoryCount,
    platformTotalBytes: payload.platformTree.totalBytes,
    outputLayout: "payload_dist_and_package_json_only" as const,
    productionUse:
      "forbidden_until_dependency_materialization_and_manifest_verification" as const,
  };
  const commandStdout = `${canonicalJsonStringify(commandResult)}\n`;
  const identity = {
    schema: PLATFORM_RELEASE_BUILD_RECEIPT_V2_SCHEMA,
    version: "2.0.0" as const,
    authorityState: "candidate_build_observation_unverified" as const,
    productionUse:
      "forbidden_until_double_build_and_fresh_release_verification" as const,
    sourceAdmissionReceiptHash: admissionReceiptHash,
    source,
    stage: {
      stageRef,
      sourceStagePhysicalIdentityHash:
        sourceStagePhysicalIdentityHash,
      outputStagePhysicalIdentityHash:
        fixtureShaV2(`${stageRef}-output-stage`),
      sourceBuildContextPolicy:
        "private_0700_parent_source_child_and_authenticated_toolchain_sibling_v2" as const,
      sourceStageMode: "0555" as const,
      outputStageInitialMode: "0700" as const,
      outputWasEmpty: true as const,
      sourceAndOutputAreDistinct: true as const,
      temporaryLocatorDisclosure: "forbidden" as const,
    },
    inputs: source.inputs,
    compiler,
    packageManager,
    command: {
      commandRef: "BUILD_PLATFORM_RELEASE_V2" as const,
      contractHash: PLATFORM_RELEASE_BUILD_CONTRACT_HASH_V2,
      executableRef: "RUNTIME_NODE_PROCESS" as const,
      moduleLocator: "scripts/build-platform-release-v2.mjs" as const,
      moduleContentHash: fixtureShaV2("build-module"),
      directArgvTemplate: [
        "node",
        "scripts/build-platform-release-v2.mjs",
        "--source-root",
        "<VERIFIED_SOURCE_STAGE>",
        "--output-root",
        "<EMPTY_OUTPUT_STAGE>",
        "--typescript-entry",
        "<AUTHENTICATED_TYPESCRIPT_ENTRY>",
        "--source-sha",
        "<ADMITTED_SOURCE_SHA>",
        "--source-date-epoch",
        "<ADMITTED_SOURCE_EPOCH>",
      ] as const,
      cwd: "verified_source_stage" as const,
      sourceRootPassing: "parameterized_exact_stage" as const,
      outputRootPassing:
        "parameterized_exact_empty_stage" as const,
      compilerEntryPassing:
        "parameterized_authenticated_external_entry" as const,
      sourceIdentityPassing:
        "parameterized_exact_admitted_sha" as const,
      sourceClockPassing:
        "parameterized_exact_admitted_git_epoch" as const,
      shell: "forbidden" as const,
    },
    sourceDateEpoch: "1785052800",
    process: {
      stdin: "closed" as const,
      inheritAmbientEnvironment: false as const,
      environment: {
        CI: "true" as const,
        LANG: "C.UTF-8" as const,
        LC_ALL: "C.UTF-8" as const,
        NO_COLOR: "1" as const,
        SOURCE_DATE_EPOCH: "1785052800",
        TZ: "UTC" as const,
      },
      termination: "normal_exit" as const,
      exitCode: 0 as const,
      stdoutContentHash: createHash("sha256")
        .update(commandStdout)
        .digest("hex"),
      stdoutByteLength: Buffer.byteLength(commandStdout, "utf8"),
      stderrContentHash:
        PLATFORM_RELEASE_EMPTY_GIT_STATUS_CONTENT_HASH_V2,
      stderrByteLength: 0,
      commandResult,
    },
    output: {
      runtimePayload: payload,
      npmMaterializationReceipt:
        external.materializationReceipt,
      legacyStitchConverter: stitchConverter,
      outputClosureHash,
    },
  };
  return {
    ...identity,
    receiptHash:
      hashPlatformReleaseBuildReceiptV2(identity as never),
  };
}

function buildCompiler() {
  return {
    packageName: "typescript" as const,
    version: "5.9.3",
    lockEntryHash: fixtureShaV2("typescript-lock"),
    packageJsonHash: fixtureShaV2("typescript-package-json"),
    packageTreeHash: fixtureShaV2("typescript-tree"),
    entryModuleLocator: "node_modules/typescript/bin/tsc" as const,
    entryModuleHash: fixtureShaV2("typescript-tsc"),
  };
}

function buildPackageManager(
  external: ReturnType<typeof externalResolution>,
) {
  const executable = external.executables.find(
    (entry) =>
      entry.executableRef === external.packageManager.executableRef,
  )!;
  return {
    packageName: "npm" as const,
    version: external.packageManager.version,
    executableRef: external.packageManager.executableRef,
    executableHash: executable.hash,
    packageTreeHash: external.packageManager.packageTreeHash,
    installRecipeHash:
      external.packageManager.installRecipe.recipeHash,
  };
}

export function createPlatformReleaseManifestFixtureV2():
PlatformReleaseManifestV2 {
  const payload = runtimePayload();
  const external = externalResolution(payload);
  const capsule = environment(external);
  const catalogs = moduleCatalogs(payload, external, capsule);
  const inputs = sourceInputs();
  const source = sourceTreeBinding(inputs);
  const codeSha = gitHash("source-commit");
  const admission = sourceAdmission(
    codeSha,
    source.sourceTreeHash,
    source,
  );
  const compiler = buildCompiler();
  const packageManager = buildPackageManager(external);
  const stitchConverter = legacyStitchConverter();
  const firstBuildReceipt = buildReceipt(
    "PLATFORM_RELEASE_BUILD_STAGE_FIRST_V2",
    admission.receiptHash,
    codeSha,
    source,
    admission.exportedSource.stageAfter.identityHash,
    compiler,
    packageManager,
    payload,
    external,
    stitchConverter,
  );
  const secondBuildReceipt = buildReceipt(
    "PLATFORM_RELEASE_BUILD_STAGE_SECOND_V2",
    admission.receiptHash,
    codeSha,
    source,
    admission.exportedSource.stageAfter.identityHash,
    compiler,
    packageManager,
    payload,
    external,
    stitchConverter,
  );
  const identity = {
    schema: PLATFORM_RELEASE_MANIFEST_V2_SCHEMA,
    manifestVersion: 2 as const,
    authorityState: "candidate_manifest_unverified" as const,
    productionUse:
      "forbidden_until_empty_stage_materialization_and_fresh_verification" as const,
    releaseLayout: structuredClone(RELEASE_LAYOUT_V2),
    release: {
      codeSha,
      sourceTreeHash: source.sourceTreeHash,
      branch: "main" as const,
      dirty: false as const,
      sourceAdmission: {
        repositoryId:
          PLATFORM_RELEASE_SOURCE_REPOSITORY_ID_V2,
        remoteRef: "refs/remotes/origin/main" as const,
        admittedSha: codeSha,
        policy: "exact_remote_main_sha" as const,
        receipt: admission,
        receiptHash: admission.receiptHash,
      },
      packageName: "setfarm" as const,
      packageVersion: "2.3.79",
    },
    build: {
      contractVersion: "2.0.0" as const,
      inputs,
      compiler,
      packageManager,
      sourceStage: {
        method: "verified_git_tree_export.v2" as const,
        exportedTreeHash: source.sourceTreeHash,
        exportedFileTreeHash: source.exportedFileTreeHash,
        exportedFileCount: source.exportedFileCount,
        exportedDirectoryCount:
          source.exportedDirectoryCount,
        exportedTotalBytes: source.exportedTotalBytes,
        sourceBindingHash: source.bindingHash,
        stagePhysicalIdentityHash:
          admission.exportedSource.stageAfter.identityHash,
        buildContextPolicy:
          "private_0700_parent_source_child_and_authenticated_toolchain_sibling_v2" as const,
        mode: "read_only" as const,
      },
      commandRef: "BUILD_PLATFORM_RELEASE_V2" as const,
      outputPolicy: "parameterized_empty_stage_only" as const,
      sourceDateEpoch: "1785052800",
      reproducibility:
        "double_clean_build_exact_tree_match" as const,
      firstBuildReceipt,
      firstBuildReceiptHash: firstBuildReceipt.receiptHash,
      secondBuildReceipt,
      secondBuildReceiptHash: secondBuildReceipt.receiptHash,
    },
    runtimePayload: payload,
    externalResolution: external,
    environmentCapsule: capsule,
    profileCatalog: getProductDeliveryProfileCatalogV2(),
    evidenceDefinitionCatalogs:
      getPlatformEvidenceDefinitionCatalogsV2(),
    launcherCatalog: catalogs.launcher,
    runnerCatalog: catalogs.runner,
    transportCodecCatalog:
      getInvocationTransportCodecCatalogV2(),
    receiptSchema: getEvidenceReceiptAbiPolicyV2(),
    adapterDefinitionCatalog:
      getEvidenceAdapterDefinitionCatalogV2(),
    legacyAssets: { stitchConverter },
  };
  return {
    ...identity,
    manifestPayloadHash:
      hashPlatformReleaseManifestV2(identity as never),
  } as PlatformReleaseManifestV2;
}

function bindingFromObservedTreeV2(
  tree: CanonicalRuntimeTreeV2,
  rootLocator: "payload/dist" | "payload/node_modules",
) {
  const identity = {
    schema: CANONICAL_RUNTIME_TREE_BINDING_V2_SCHEMA,
    treeSchema: CANONICAL_RUNTIME_TREE_V2_SCHEMA,
    profile: tree.profile,
    rootLocator,
    treeHash: tree.treeHash,
    treePayloadHash: tree.payloadHash,
    fileCount: tree.fileCount,
    directoryCount: tree.directoryCount,
    totalBytes: tree.totalBytes,
  };
  return {
    ...identity,
    bindingHash: hashCanonicalRuntimeTreeBindingV2(identity),
  };
}

function observedFileV2(absolutePath: string) {
  const bytes = readFileSync(absolutePath);
  const stat = statSync(absolutePath);
  return {
    contentHash: createHash("sha256").update(bytes).digest("hex"),
    byteLength: bytes.byteLength,
    mode: (stat.mode & 0o7777) === 0o555
      ? "0555" as const
      : "0444" as const,
  };
}

function rebindBuildOutputV2(
  receipt: any,
  manifest: any,
): void {
  receipt.output.runtimePayload = structuredClone(
    manifest.runtimePayload,
  );
  receipt.output.npmMaterializationReceipt = structuredClone(
    manifest.externalResolution.materializationReceipt,
  );
  receipt.output.legacyStitchConverter = structuredClone(
    manifest.legacyAssets.stitchConverter,
  );
  receipt.output.outputClosureHash = hashCanonicalJson({
    schema: "setfarm.platform-release-build-output-closure.v2",
    runtimePayloadHash:
      receipt.output.runtimePayload.runtimePayloadHash,
    platformTreeBindingHash:
      receipt.output.runtimePayload.platformTree.bindingHash,
    dependencyTreeBindingHash:
      receipt.output.runtimePayload.dependencyTree.bindingHash,
    packageJsonHash: receipt.output.runtimePayload.packageJson.hash,
    npmMaterializationReceiptHash:
      receipt.output.npmMaterializationReceipt.receiptHash,
    legacyStitchConverter: receipt.output.legacyStitchConverter,
  });
  receipt.process.commandResult.platformFileCount =
    manifest.runtimePayload.platformTree.fileCount;
  receipt.process.commandResult.platformDirectoryCount =
    manifest.runtimePayload.platformTree.directoryCount;
  receipt.process.commandResult.platformTotalBytes =
    manifest.runtimePayload.platformTree.totalBytes;
  const commandStdout =
    `${canonicalJsonStringify(receipt.process.commandResult)}\n`;
  receipt.process.stdoutContentHash = createHash("sha256")
    .update(commandStdout)
    .digest("hex");
  receipt.process.stdoutByteLength =
    Buffer.byteLength(commandStdout, "utf8");
  receipt.receiptHash =
    hashPlatformReleaseBuildReceiptV2(receipt);
}

/**
 * Test-only fixture derivation from real immutable stage bytes. This helper
 * never issues a production handle; the terminal writer still performs its own
 * independent full recapture and byte joins.
 */
export function bindPlatformReleaseManifestFixtureToStageV2(
  stageRoot: string,
  metadataProbe: CanonicalRuntimeMetadataProbeV2,
): PlatformReleaseManifestV2 {
  const manifest: any = createPlatformReleaseManifestFixtureV2();
  const payloadRoot = path.join(stageRoot, "payload");
  const platformTree = captureCanonicalRuntimeTreeV2({
    root: path.join(payloadRoot, "dist"),
    profile: "dist",
    metadataProbe,
  });
  const dependencyTree = captureCanonicalRuntimeTreeV2({
    root: path.join(payloadRoot, "node_modules"),
    profile: "dependencies",
    metadataProbe,
  });
  manifest.runtimePayload.platformTree =
    bindingFromObservedTreeV2(platformTree, "payload/dist");
  manifest.runtimePayload.dependencyTree =
    bindingFromObservedTreeV2(
      dependencyTree,
      "payload/node_modules",
    );
  const packageJson = observedFileV2(
    path.join(payloadRoot, "package.json"),
  );
  manifest.runtimePayload.packageJson.hash =
    packageJson.contentHash;
  manifest.runtimePayload.packageJson.byteLength =
    packageJson.byteLength;
  manifest.runtimePayload.packageJson.mode = packageJson.mode;
  manifest.runtimePayload.runtimePayloadHash =
    hashPlatformRuntimePayloadV2(manifest.runtimePayload);
  const sourceInputSets = [
    manifest.build.inputs,
    manifest.release.sourceAdmission.receipt
      .exportedSource.source.inputs,
    manifest.build.firstBuildReceipt.inputs,
    manifest.build.firstBuildReceipt.source.inputs,
    manifest.build.secondBuildReceipt.inputs,
    manifest.build.secondBuildReceipt.source.inputs,
  ];
  for (const inputs of sourceInputSets) {
    const sourcePackageJson = inputs[1];
    sourcePackageJson.contentHash = packageJson.contentHash;
    sourcePackageJson.byteLength = packageJson.byteLength;
    sourcePackageJson.sourceRefHash =
      hashExactPlatformReleaseSourceRefV2(sourcePackageJson);
  }
  for (const source of [
    manifest.release.sourceAdmission.receipt
      .exportedSource.source,
    manifest.build.firstBuildReceipt.source,
    manifest.build.secondBuildReceipt.source,
  ]) {
    source.inputMembershipHash = hashCanonicalJson({
      schema: "setfarm.platform-release-source-input-membership.v2",
      entries: source.inputs.map((entry: any) => ({
        role: entry.role,
        locator: entry.locator,
        sourceRefHash: entry.sourceRefHash,
      })),
    });
    source.bindingHash =
      hashPlatformReleaseSourceTreeBindingV2(source);
  }
  const admission =
    manifest.release.sourceAdmission.receipt;
  for (const stage of [
    admission.exportedSource.stageBefore,
    admission.exportedSource.stageAfter,
  ]) {
    stage.sourceBindingHash =
      admission.exportedSource.source.bindingHash;
    stage.identityHash =
      hashPlatformReleaseSourceStagePhysicalIdentityV2(stage);
  }
  admission.receiptHash =
    hashSourceAdmissionReceiptV2(admission);
  manifest.release.sourceAdmission.receiptHash =
    admission.receiptHash;
  manifest.build.sourceStage.sourceBindingHash =
    admission.exportedSource.source.bindingHash;
  manifest.build.sourceStage.stagePhysicalIdentityHash =
    admission.exportedSource.stageAfter.identityHash;
  for (const receipt of [
    manifest.build.firstBuildReceipt,
    manifest.build.secondBuildReceipt,
  ]) {
    receipt.sourceAdmissionReceiptHash =
      admission.receiptHash;
    receipt.stage.sourceStagePhysicalIdentityHash =
      admission.exportedSource.stageAfter.identityHash;
  }

  const external = manifest.externalResolution;
  external.productionPackages.materializedDependencyTreeHash =
    dependencyTree.treeHash;
  external.productionPackages.resolutionGraphHash =
    hashProductionPackageResolutionGraphV2(
      external.productionPackages,
    );
  external.materializationReceipt.dependencyTreeHash =
    dependencyTree.treeHash;
  external.materializationReceipt.receiptHash =
    hashNpmMaterializationReceiptV2(
      external.materializationReceipt,
    );
  external.externalResolutionHash =
    hashExternalRuntimeResolutionV2(external);

  const networkWrapper = observedFileV2(path.join(
    payloadRoot,
    manifest.environmentCapsule.network.authority
      .wrapperModuleLocator,
  ));
  manifest.environmentCapsule.network.authority.wrapperModuleHash =
    networkWrapper.contentHash;
  manifest.environmentCapsule.network.authority.authorityHash =
    hashNetworkIsolationAuthorityV2(
      manifest.environmentCapsule.network.authority,
    );
  manifest.environmentCapsule.environmentCapsuleHash =
    hashEvidenceEnvironmentCapsuleV2(
      manifest.environmentCapsule,
    );

  const stitch = observedFileV2(path.join(
    stageRoot,
    manifest.legacyAssets.stitchConverter.locator,
  ));
  manifest.legacyAssets.stitchConverter.hash =
    stitch.contentHash;
  manifest.legacyAssets.stitchConverter.byteLength =
    stitch.byteLength;
  manifest.legacyAssets.stitchConverter.mode = stitch.mode;

  const launcher = manifest.launcherCatalog;
  launcher.runtimePayloadHash =
    manifest.runtimePayload.runtimePayloadHash;
  launcher.platformTreeHash = platformTree.treeHash;
  launcher.externalResolutionHash =
    external.externalResolutionHash;
  launcher.environmentCapsuleHash =
    manifest.environmentCapsule.environmentCapsuleHash;
  for (const entry of launcher.entries) {
    const module = observedFileV2(
      path.join(stageRoot, entry.module.payloadLocator),
    );
    entry.module.contentHash = module.contentHash;
    entry.module.byteLength = module.byteLength;
    entry.module.mode = module.mode;
    entry.module.moduleRefHash =
      hashPlatformReleaseModuleRefV2(entry.module);
    entry.environmentCapsuleHash =
      manifest.environmentCapsule.environmentCapsuleHash;
    entry.entryHash =
      hashPlatformLauncherCatalogEntryV2(entry);
  }
  launcher.catalogHash =
    hashPlatformLauncherCatalogV2(launcher);

  const runner = manifest.runnerCatalog;
  runner.runtimePayloadHash =
    manifest.runtimePayload.runtimePayloadHash;
  runner.platformTreeHash = platformTree.treeHash;
  runner.dependencyTreeHash = dependencyTree.treeHash;
  runner.externalResolutionHash =
    external.externalResolutionHash;
  runner.productionResolutionGraphHash =
    external.productionPackages.resolutionGraphHash;
  runner.environmentCapsuleHash =
    manifest.environmentCapsule.environmentCapsuleHash;
  runner.launcherCatalogHash = launcher.catalogHash;
  for (const entry of runner.entries) {
    const module = observedFileV2(
      path.join(stageRoot, entry.module.payloadLocator),
    );
    entry.module.contentHash = module.contentHash;
    entry.module.byteLength = module.byteLength;
    entry.module.mode = module.mode;
    entry.module.moduleRefHash =
      hashPlatformReleaseModuleRefV2(entry.module);
    const executionAdmissionHash =
      entry.admission.kind === "invocation"
        ? entry.admission.executionLeaseContractHash
        : entry.abiHash;
    entry.toolchainHash = hashPlatformRunnerToolchainV2({
      runnerEntrypointRef: entry.runnerEntrypointRef,
      runnerModuleHash: entry.module.contentHash,
      runnerAbiHash: entry.abiHash,
      platformTreeHash: runner.platformTreeHash,
      dependencyTreeHash: runner.dependencyTreeHash,
      runtimePayloadHash: runner.runtimePayloadHash,
      externalResolutionHash: runner.externalResolutionHash,
      productionResolutionGraphHash:
        runner.productionResolutionGraphHash,
      environmentCapsuleHash: runner.environmentCapsuleHash,
      launcherCatalogHash: runner.launcherCatalogHash,
      transportCodecCatalogHash:
        runner.transportCodecCatalogHash,
      receiptSchemaHash: runner.receiptSchemaHash,
      adapterDefinitionCatalogHash:
        runner.adapterDefinitionCatalogHash,
      executionAdmissionHash,
    });
    entry.entryHash =
      hashPlatformRunnerCatalogEntryV2(entry);
  }
  runner.catalogHash = hashPlatformRunnerCatalogV2(runner);

  rebindBuildOutputV2(
    manifest.build.firstBuildReceipt,
    manifest,
  );
  manifest.build.firstBuildReceiptHash =
    manifest.build.firstBuildReceipt.receiptHash;
  rebindBuildOutputV2(
    manifest.build.secondBuildReceipt,
    manifest,
  );
  manifest.build.secondBuildReceiptHash =
    manifest.build.secondBuildReceipt.receiptHash;
  manifest.manifestPayloadHash =
    hashPlatformReleaseManifestV2(manifest);
  return manifest as PlatformReleaseManifestV2;
}
