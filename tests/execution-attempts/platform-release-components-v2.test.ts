import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { canonicalJsonBytes } from "../../src/product-compiler/canonical-json.js";
import {
  CANONICAL_RUNTIME_TREE_V2_SCHEMA,
  createCanonicalRuntimeTreeV2,
  type CanonicalRuntimeTreeV2,
} from "../../src/execution/schemas/canonical-runtime-tree-v2.js";
import * as environmentModule from "../../src/execution/schemas/evidence-environment-capsule-v2.js";
import {
  EVIDENCE_ENVIRONMENT_CAPSULE_V2_MAX_CANONICAL_BYTES,
  EVIDENCE_ENVIRONMENT_CAPSULE_V2_SCHEMA,
  EVIDENCE_ENVIRONMENT_NETWORK_ENFORCEMENT_REF_V2,
  EVIDENCE_ENVIRONMENT_NETWORK_WRAPPER_EXPORT_V2,
  EVIDENCE_ENVIRONMENT_NETWORK_WRAPPER_MODULE_V2,
  EVIDENCE_ENVIRONMENT_SANDBOX_EXECUTABLE_REF_V2,
  METADATA_PROBE_AUTHORITY_V2_SCHEMA,
  METADATA_PROBE_RECEIPT_V2_SCHEMA,
  NETWORK_ISOLATION_AUTHORITY_V2_SCHEMA,
  NETWORK_NEGATIVE_PROBE_RECEIPT_V2_SCHEMA,
  hashEvidenceEnvironmentCapsuleV2,
  hashMetadataProbeAuthorityV2,
  hashNetworkIsolationAuthorityV2,
  parseEvidenceEnvironmentCapsuleCandidateV2,
  EvidenceEnvironmentCapsuleCandidateV2Schema,
} from "../../src/execution/schemas/evidence-environment-capsule-v2.js";
import * as externalModule from "../../src/execution/schemas/external-runtime-resolution-v2.js";
import {
  BROWSER_COMPANION_RESOURCE_TREE_BINDING_V2_SCHEMA,
  BROWSER_RUNTIME_RESOLUTION_V2_SCHEMA,
  EXACT_SOURCE_FILE_REF_V2_SCHEMA,
  EXTERNAL_EXECUTABLE_RESOLUTION_V2_SCHEMA,
  EXTERNAL_RUNTIME_RESOLUTION_V2_MAX_CANONICAL_BYTES,
  EXTERNAL_RUNTIME_RESOLUTION_V2_SCHEMA,
  ExternalRuntimeResolutionCandidateV2Schema,
  HOST_BOOTSTRAP_BINDING_V2_SCHEMA,
  HOST_RUNTIME_IDENTITY_V2_SCHEMA,
  NODE_RUNTIME_RESOLUTION_V2_SCHEMA,
  NON_SYSTEM_DYNAMIC_LIBRARY_V2_SCHEMA,
  NPM_MATERIALIZATION_RECEIPT_V2_SCHEMA,
  NPM_PACKAGE_MANAGER_RESOLUTION_V2_SCHEMA,
  NPM_PRODUCTION_MATERIALIZATION_RECIPE_V2_SCHEMA,
  PRODUCTION_PACKAGE_RESOLUTION_ENTRY_V2_SCHEMA,
  PRODUCTION_PACKAGE_RESOLUTION_GRAPH_V2_SCHEMA,
  hashBrowserRuntimeExactV2,
  hashExternalRuntimeResolutionV2,
  hashHostRuntimeIdentityV2,
  hashNpmMaterializationReceiptV2,
  hashNpmProductionMaterializationRecipeV2,
  hashProductionPackageResolutionGraphV2,
  parseExternalRuntimeResolutionCandidateV2,
} from "../../src/execution/schemas/external-runtime-resolution-v2.js";
import * as runtimeModule from "../../src/execution/schemas/platform-runtime-payload-v2.js";
import {
  CANONICAL_RUNTIME_TREE_BINDING_V2_SCHEMA,
  EXACT_BUNDLED_FILE_REF_V2_SCHEMA,
  PLATFORM_RUNTIME_PAYLOAD_V2_SCHEMA,
  PLATFORM_RUNTIME_PAYLOAD_V2_MAX_CANONICAL_BYTES,
  RELEASE_LAYOUT_V2,
  RELEASE_LAYOUT_V2_SCHEMA,
  RUNTIME_PAYLOAD_LAYOUT_V2,
  RUNTIME_PAYLOAD_LAYOUT_V2_SCHEMA,
  CanonicalRuntimeTreeBindingCandidateV2Schema,
  hashCanonicalRuntimeTreeBindingV2,
  hashPlatformRuntimePayloadV2,
  parsePlatformRuntimePayloadCandidateV2,
  PlatformRuntimePayloadCandidateV2Schema,
} from "../../src/execution/schemas/platform-runtime-payload-v2.js";
import {
  EXACT_HOST_OWNED_FILE_REF_V2_SCHEMA,
} from "../../src/execution/schemas/platform-release-common-v2.js";

function sha(label: string): string {
  return createHash("sha256").update(label).digest("hex");
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function assertRecursivelyFrozen(value: unknown): void {
  const pending: unknown[] = [value];
  while (pending.length > 0) {
    const current = pending.pop();
    if (current === null || typeof current !== "object") continue;
    assert.equal(Object.isFrozen(current), true);
    pending.push(...Object.values(current));
  }
}

function createPlatformTree(): CanonicalRuntimeTreeV2 {
  return createCanonicalRuntimeTreeV2({
    schema: CANONICAL_RUNTIME_TREE_V2_SCHEMA,
    profile: "dist",
    rootMode: "0555",
    entries: [
      { path: "cli", type: "directory", mode: "0555" },
      {
        path: "cli/cli.js",
        type: "file",
        mode: "0555",
        executable: true,
        byteLength: 3,
        contentHash: sha("dist-cli"),
      },
      { path: "execution", type: "directory", mode: "0555" },
      {
        path: "execution/network-sandbox-v2.js",
        type: "file",
        mode: "0444",
        executable: false,
        byteLength: 7,
        contentHash: sha("network-wrapper-module"),
      },
    ],
    fileCount: 2,
    directoryCount: 2,
    totalBytes: 10,
  });
}

function createDependencyTree(): CanonicalRuntimeTreeV2 {
  return createCanonicalRuntimeTreeV2({
    schema: CANONICAL_RUNTIME_TREE_V2_SCHEMA,
    profile: "dependencies",
    rootMode: "0555",
    entries: [
      { path: "postgres", type: "directory", mode: "0555" },
      {
        path: "postgres/package.json",
        type: "file",
        mode: "0444",
        executable: false,
        byteLength: 13,
        contentHash: sha("postgres-package-json"),
      },
      { path: "zod", type: "directory", mode: "0555" },
      {
        path: "zod/package.json",
        type: "file",
        mode: "0444",
        executable: false,
        byteLength: 17,
        contentHash: sha("zod-package-json"),
      },
    ],
    fileCount: 2,
    directoryCount: 2,
    totalBytes: 30,
  });
}

function createRuntimeTreeBindingCandidate(
  rootLocator: "payload/dist" | "payload/node_modules",
  tree: CanonicalRuntimeTreeV2,
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

function createRuntimePayloadCandidate() {
  const identity = {
    schema: PLATFORM_RUNTIME_PAYLOAD_V2_SCHEMA,
    version: "2.0.0" as const,
    layout: clone(RUNTIME_PAYLOAD_LAYOUT_V2),
    rootLocator: "payload" as const,
    allowedRootEntries: ["dist", "node_modules", "package.json"] as const,
    platformTree: createRuntimeTreeBindingCandidate(
      "payload/dist",
      createPlatformTree(),
    ),
    dependencyTree: createRuntimeTreeBindingCandidate(
      "payload/node_modules",
      createDependencyTree(),
    ),
    packageJson: {
      schema: EXACT_BUNDLED_FILE_REF_V2_SCHEMA,
      locator: "payload/package.json" as const,
      mediaType: "application/json" as const,
      hash: sha("package-json"),
      byteLength: 761,
      mode: "0444" as const,
    },
    ownership: {
      ownerUid: 0,
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

function createMetadataProbeCandidate() {
  const identity = {
    schema: METADATA_PROBE_AUTHORITY_V2_SCHEMA,
    installationScope: "root_owned_separately_installed" as const,
    bootstrapModule: createHostOwnedFile(
      "metadata-probe-module",
      "/usr/local/libexec/setfarm/metadata-probe-v2.js",
      "0444",
      53,
    ),
    bootstrapExport: "probeReleaseMetadataV2",
    xattrTool: {
      executableRef: "EXEC_XATTR_TOOL_V2",
      executableHash: sha("xattr-tool"),
    },
    aclTool: {
      executableRef: "EXEC_ACL_TOOL_V2",
      executableHash: sha("acl-tool"),
    },
    canonicalClearPolicyHash: sha("metadata-clear-policy"),
    probeReceiptSchema: METADATA_PROBE_RECEIPT_V2_SCHEMA,
    probeReceiptSchemaHash: sha("metadata-probe-receipt-schema"),
  };
  return {
    ...identity,
    authorityHash: hashMetadataProbeAuthorityV2(identity),
  };
}

function createNetworkIsolationCandidate(hostRuntimeIdentityHash: string) {
  const identity = {
    schema: NETWORK_ISOLATION_AUTHORITY_V2_SCHEMA,
    enforcementRef: EVIDENCE_ENVIRONMENT_NETWORK_ENFORCEMENT_REF_V2,
    wrapperModuleLocator: EVIDENCE_ENVIRONMENT_NETWORK_WRAPPER_MODULE_V2,
    wrapperExport: EVIDENCE_ENVIRONMENT_NETWORK_WRAPPER_EXPORT_V2,
    wrapperModuleHash: sha("network-wrapper-module"),
    sandboxExecutableRef: EVIDENCE_ENVIRONMENT_SANDBOX_EXECUTABLE_REF_V2,
    canonicalProfileHash: sha("network-profile"),
    hostRuntimeIdentityHash,
    negativeProbeReceiptSchema: NETWORK_NEGATIVE_PROBE_RECEIPT_V2_SCHEMA,
    negativeProbeReceiptSchemaHash: sha("negative-network-probe-receipt-schema"),
  };
  return {
    ...identity,
    authorityHash: hashNetworkIsolationAuthorityV2(identity),
  };
}

function createEnvironmentCandidate(
  hostRuntimeIdentityHash = sha("host-runtime-placeholder"),
  metadataProbeAuthorityHash = createMetadataProbeCandidate().authorityHash,
) {
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
      cwdPolicy: "candidate_runtime_bundle_descendant_only" as const,
      umask: "0077" as const,
    },
    network: {
      mode: "loopback_only" as const,
      outboundInternet: "forbidden" as const,
      dns: "forbidden" as const,
      authority: createNetworkIsolationCandidate(hostRuntimeIdentityHash),
    },
    portLease: {
      mode: "exclusive_socket_lease" as const,
      host: "127.0.0.1" as const,
      bandsHash: sha("port-bands"),
    },
    filesystem: {
      releaseRoot: "immutable_read_only" as const,
      runtimeScratch: "attempt_scoped" as const,
      metadataProbeAuthorityHash,
    },
  };
  return {
    ...identity,
    environmentCapsuleHash: hashEvidenceEnvironmentCapsuleV2(identity),
  };
}

function createHostOwnedFile(
  label: string,
  absoluteRealpathLocator: string,
  mode: "0444" | "0555",
  byteLength: number,
) {
  return {
    schema: EXACT_HOST_OWNED_FILE_REF_V2_SCHEMA,
    absoluteRealpathLocator,
    hash: sha(label),
    byteLength,
    ownerUid: 0 as const,
    ownerGid: 0,
    mode,
    hostAdmissionEvidenceHash: sha(`${label}-host-admission`),
  };
}

function createHostRuntimeCandidate() {
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
      executable: createHostOwnedFile(
        "bootstrap-executable",
        "/usr/local/libexec/setfarm/setfarm-bootstrap-v2",
        "0555",
        41,
      ),
      module: createHostOwnedFile(
        "bootstrap-module",
        "/usr/local/libexec/setfarm/platform-release-bootstrap-v2.js",
        "0444",
        47,
      ),
    },
    runtimeUid: 501,
    runtimeGid: 20,
    nonSystemDynamicLibraries: [
      {
        schema: NON_SYSTEM_DYNAMIC_LIBRARY_V2_SCHEMA,
        absoluteLocator: "/opt/homebrew/lib/libalpha.dylib",
        hash: sha("libalpha"),
        byteLength: 101,
      },
      {
        schema: NON_SYSTEM_DYNAMIC_LIBRARY_V2_SCHEMA,
        absoluteLocator: "/opt/homebrew/lib/libbeta.dylib",
        hash: sha("libbeta"),
        byteLength: 103,
      },
    ],
    systemDynamicLibraryTrust: "exact_macos_build_identity" as const,
  };
  return {
    ...identity,
    hostRuntimeIdentityHash: hashHostRuntimeIdentityV2(identity),
  };
}

function createNpmRecipe() {
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
    configHash: sha("npm-config"),
    materializationReceiptSchema: NPM_MATERIALIZATION_RECEIPT_V2_SCHEMA,
    materializationReceiptSchemaHash: sha("npm-materialization-receipt-schema"),
  };
  return {
    ...identity,
    recipeHash: hashNpmProductionMaterializationRecipeV2(identity),
  };
}

function basePackages() {
  return [
    {
      schema: PRODUCTION_PACKAGE_RESOLUTION_ENTRY_V2_SCHEMA,
      packageLocator: "node_modules/postgres",
      packageName: "postgres",
      version: "3.4.8",
      lockEntryHash: sha("postgres-lock-entry"),
      packageJsonHash: sha("postgres-package-json"),
      runtimeTreeHash: sha("postgres-runtime-tree"),
      dependencyLocators: ["node_modules/zod"],
    },
    {
      schema: PRODUCTION_PACKAGE_RESOLUTION_ENTRY_V2_SCHEMA,
      packageLocator: "node_modules/zod",
      packageName: "zod",
      version: "4.4.3",
      lockEntryHash: sha("zod-lock-entry"),
      packageJsonHash: sha("zod-package-json"),
      runtimeTreeHash: sha("zod-runtime-tree"),
      dependencyLocators: [],
    },
  ];
}

function createPackageGraph(packages = basePackages()) {
  const identity = {
    schema: PRODUCTION_PACKAGE_RESOLUTION_GRAPH_V2_SCHEMA,
    version: "2.0.0" as const,
    lockfileVersion: 3 as const,
    lockfile: {
      schema: EXACT_SOURCE_FILE_REF_V2_SCHEMA,
      locator: "package-lock.json" as const,
      mediaType: "application/json" as const,
      hash: sha("package-lock"),
      byteLength: 14_321,
    },
    materializedDependencyTreeHash: createRuntimePayloadCandidate().dependencyTree.treeHash,
    packages,
    packageCount: packages.length,
  };
  return {
    ...identity,
    resolutionGraphHash: hashProductionPackageResolutionGraphV2(identity),
  };
}

function externalExecutable(
  executableRef: string,
  purpose:
    | "browser_runtime"
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

function createNpmMaterializationReceipt(
  packageManager: ReturnType<typeof createNpmPackageManager>,
  productionPackages: ReturnType<typeof createPackageGraph>,
) {
  const identity = {
    schema: NPM_MATERIALIZATION_RECEIPT_V2_SCHEMA,
    recipeHash: packageManager.installRecipe.recipeHash,
    npmIdentity: {
      packageName: packageManager.packageName,
      version: packageManager.version,
      executableRef: packageManager.executableRef,
      packageTreeHash: packageManager.packageTreeHash,
    },
    lockfile: clone(productionPackages.lockfile),
    outputRoot: "payload/node_modules" as const,
    dependencyTreeHash: productionPackages.materializedDependencyTreeHash,
    packageCount: productionPackages.packageCount,
    lifecycleScripts: "forbidden" as const,
    exitCode: 0 as const,
  };
  return {
    ...identity,
    receiptHash: hashNpmMaterializationReceiptV2(identity),
  };
}

function createNpmPackageManager() {
  return {
    schema: NPM_PACKAGE_MANAGER_RESOLUTION_V2_SCHEMA,
    packageName: "npm" as const,
    version: "11.4.2",
    executableRef: "EXEC_NPM_PACKAGE_MANAGER_V2",
    packageTreeHash: sha("npm-package-tree"),
    installRecipe: createNpmRecipe(),
  };
}

function createExternalRuntimeCandidate() {
  const hostRuntime = createHostRuntimeCandidate();
  const metadataProbe = createMetadataProbeCandidate();
  const packageManager = createNpmPackageManager();
  const productionPackages = createPackageGraph();
  const identity = {
    schema: EXTERNAL_RUNTIME_RESOLUTION_V2_SCHEMA,
    version: "2.0.0" as const,
    hostRuntime,
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
    materializationReceipt: createNpmMaterializationReceipt(
      packageManager,
      productionPackages,
    ),
    metadataProbe,
    executables: [
      externalExecutable(
        "EXEC_ACL_TOOL_V2",
        "platform_tool",
        "/bin/chmod",
        metadataProbe.aclTool.executableHash,
        31,
      ),
      externalExecutable(
        "EXEC_BOOTSTRAP_V2",
        "platform_tool",
        hostRuntime.bootstrap.executable.absoluteRealpathLocator,
        hostRuntime.bootstrap.executable.hash,
        hostRuntime.bootstrap.executable.byteLength,
      ),
      externalExecutable(
        EVIDENCE_ENVIRONMENT_SANDBOX_EXECUTABLE_REF_V2,
        "network_sandbox",
        "/usr/bin/sandbox-exec",
        sha("sandbox-executable"),
        37,
      ),
      externalExecutable(
        "EXEC_NODE_RUNTIME_V2",
        "node_runtime",
        "/opt/homebrew/bin/node",
        sha("node-executable"),
        47,
      ),
      externalExecutable(
        "EXEC_NPM_PACKAGE_MANAGER_V2",
        "npm_package_manager",
        "/opt/homebrew/bin/npm",
        sha("npm-executable"),
        43,
      ),
      externalExecutable(
        "EXEC_XATTR_TOOL_V2",
        "platform_tool",
        "/usr/bin/xattr",
        metadataProbe.xattrTool.executableHash,
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

function rehashExternal(candidate: any): any {
  candidate.externalResolutionHash = hashExternalRuntimeResolutionV2(candidate);
  return candidate;
}

function createOverCapExternalRuntimeCandidate() {
  const candidate: any = createExternalRuntimeCandidate();
  candidate.hostRuntime.nonSystemDynamicLibraries = Array.from(
    { length: 512 },
    (_, index) => ({
      schema: NON_SYSTEM_DYNAMIC_LIBRARY_V2_SCHEMA,
      absoluteLocator: `/opt/${String(index).padStart(3, "0")}/${"a".repeat(4_000)}`,
      hash: sha(`oversized-library-${index}`),
      byteLength: index + 1,
    }),
  );
  candidate.hostRuntime.hostRuntimeIdentityHash = hashHostRuntimeIdentityV2(
    candidate.hostRuntime,
  );
  return rehashExternal(candidate);
}

function createBrowserExternalRuntimeCandidate() {
  const candidate: any = createExternalRuntimeCandidate();
  const playwrightPackage = {
    schema: PRODUCTION_PACKAGE_RESOLUTION_ENTRY_V2_SCHEMA,
    packageLocator: "node_modules/playwright",
    packageName: "playwright",
    version: "1.60.0",
    lockEntryHash: sha("playwright-lock-entry"),
    packageJsonHash: sha("playwright-package-json"),
    runtimeTreeHash: sha("playwright-runtime-tree"),
    dependencyLocators: [],
  };
  candidate.productionPackages = createPackageGraph([
    playwrightPackage,
    ...basePackages(),
  ]);
  candidate.materializationReceipt = createNpmMaterializationReceipt(
    candidate.packageManager,
    candidate.productionPackages,
  );
  const browserBundleRoot = "/opt/playwright/chromium-1194";
  const browserExecutableRelativeLocator = "Chromium.app/Contents/MacOS/Chromium";
  candidate.executables.push(externalExecutable(
    "EXEC_BROWSER_CHROMIUM_V2",
    "browser_runtime",
    `${browserBundleRoot}/${browserExecutableRelativeLocator}`,
    sha("chromium-executable"),
    59,
  ));
  candidate.executables.sort((left: any, right: any) =>
    left.executableRef < right.executableRef ? -1 : left.executableRef > right.executableRef ? 1 : 0);
  const browserIdentity = {
    schema: BROWSER_RUNTIME_RESOLUTION_V2_SCHEMA,
    status: "playwright_chromium_exact" as const,
    runtimeInstall: "forbidden" as const,
    channelFallback: "forbidden" as const,
    browserName: "chromium" as const,
    browserRevision: "1194",
    playwrightPackageLocator: "node_modules/playwright",
    playwrightVersion: "1.60.0",
    playwrightPackageTreeHash: playwrightPackage.runtimeTreeHash,
    executableRef: "EXEC_BROWSER_CHROMIUM_V2",
    companionResourceTree: {
      schema: BROWSER_COMPANION_RESOURCE_TREE_BINDING_V2_SCHEMA,
      treeSchema: CANONICAL_RUNTIME_TREE_V2_SCHEMA,
      profile: "dependencies" as const,
      absoluteBundleRoot: browserBundleRoot,
      rootMode: "0555" as const,
      treeHash: sha("chromium-companion-tree"),
      payloadHash: sha("chromium-companion-tree-payload"),
      fileCount: 127,
      directoryCount: 31,
      totalBytes: 1_048_576,
      executableRelativeLocator: browserExecutableRelativeLocator,
    },
  };
  candidate.browserRuntime = {
    ...browserIdentity,
    browserClosureHash: hashBrowserRuntimeExactV2(browserIdentity),
  };
  return rehashExternal(candidate);
}

test("release and payload layouts are exact, immutable, and manifest-adjacent", () => {
  assert.deepEqual(RELEASE_LAYOUT_V2, {
    schema: RELEASE_LAYOUT_V2_SCHEMA,
    version: "2.0.0",
    rootMode: "0555",
    allowedRootEntries: ["PLATFORM_RELEASE_MANIFEST.v2.json", "payload"],
    manifest: {
      locator: "PLATFORM_RELEASE_MANIFEST.v2.json",
      kind: "file",
      mode: "0444",
      placement: "adjacent_to_payload",
    },
    runtimePayload: { locator: "payload", kind: "directory", mode: "0555" },
  });
  assert.deepEqual(RUNTIME_PAYLOAD_LAYOUT_V2.allowedRootEntries, [
    "dist",
    "node_modules",
    "package.json",
  ]);
  assert.equal(RUNTIME_PAYLOAD_LAYOUT_V2.schema, RUNTIME_PAYLOAD_LAYOUT_V2_SCHEMA);
  assert.equal(RUNTIME_PAYLOAD_LAYOUT_V2.rootMode, "0555");
  assert.equal(RUNTIME_PAYLOAD_LAYOUT_V2.platformTreeRoot.mode, "0555");
  assert.equal(RUNTIME_PAYLOAD_LAYOUT_V2.dependencyTreeRoot.mode, "0555");
  assert.equal(RUNTIME_PAYLOAD_LAYOUT_V2.packageJsonFile.mode, "0444");
  assertRecursivelyFrozen(RELEASE_LAYOUT_V2);
  assertRecursivelyFrozen(RUNTIME_PAYLOAD_LAYOUT_V2);
});

test("runtime tree candidate bindings retain full-tree identities without a public projector", () => {
  const fullTree = createPlatformTree();
  const binding = CanonicalRuntimeTreeBindingCandidateV2Schema.parse(
    createRuntimeTreeBindingCandidate("payload/dist", fullTree),
  );
  assert.equal(binding.treeSchema, CANONICAL_RUNTIME_TREE_V2_SCHEMA);
  assert.equal(binding.treeHash, fullTree.treeHash);
  assert.equal(binding.treePayloadHash, fullTree.payloadHash);
  assert.equal(binding.bindingHash, hashCanonicalRuntimeTreeBindingV2(binding));
  assert.equal("entries" in binding, false);
  const wrongRoot = createRuntimeTreeBindingCandidate("payload/node_modules", fullTree);
  assert.throws(() => CanonicalRuntimeTreeBindingCandidateV2Schema.parse(wrongRoot));
});

test("runtime payload candidate binds exact layout, bounded trees, ownership separation, and hash", () => {
  const candidate = createRuntimePayloadCandidate();
  const parsed = parsePlatformRuntimePayloadCandidateV2(candidate);
  assert.equal(parsed.runtimePayloadHash, hashPlatformRuntimePayloadV2(parsed));
  assert.equal(parsed.ownership.runtimeMustNotOwnRelease, true);
  assert.notEqual(parsed.ownership.ownerUid, parsed.ownership.runtimeUid);
  assert.equal(parsed.ownership.rootMode, parsed.layout.rootMode);
  assert.equal("entries" in parsed.platformTree, false);
  assert.equal("entries" in parsed.dependencyTree, false);
  assert.equal(parsed.packageJson.locator.startsWith("payload/"), true);
  assert.equal(RELEASE_LAYOUT_V2.manifest.locator.startsWith("payload/"), false);
  assertRecursivelyFrozen(parsed);

  const unknown = clone(candidate) as any;
  unknown.unknown = true;
  assert.throws(() => parsePlatformRuntimePayloadCandidateV2(unknown));

  const sameOwner = clone(candidate) as any;
  sameOwner.ownership.runtimeUid = sameOwner.ownership.ownerUid;
  sameOwner.runtimePayloadHash = hashPlatformRuntimePayloadV2(sameOwner);
  assert.throws(() => parsePlatformRuntimePayloadCandidateV2(sameOwner));

  const nonRootOwner = clone(candidate) as any;
  nonRootOwner.ownership.ownerUid = 502;
  nonRootOwner.runtimePayloadHash = hashPlatformRuntimePayloadV2(nonRootOwner);
  assert.throws(() => parsePlatformRuntimePayloadCandidateV2(nonRootOwner));

  const wrongLayout = clone(candidate) as any;
  wrongLayout.layout.allowedRootEntries = ["node_modules", "dist", "package.json"];
  wrongLayout.runtimePayloadHash = hashPlatformRuntimePayloadV2(wrongLayout);
  assert.throws(() => parsePlatformRuntimePayloadCandidateV2(wrongLayout));

  const forgedBinding = clone(candidate) as any;
  forgedBinding.platformTree.treeSchema = "setfarm.canonical-runtime-tree.v1";
  forgedBinding.platformTree.bindingHash = hashCanonicalRuntimeTreeBindingV2(
    forgedBinding.platformTree,
  );
  forgedBinding.runtimePayloadHash = hashPlatformRuntimePayloadV2(forgedBinding);
  assert.throws(() => parsePlatformRuntimePayloadCandidateV2(forgedBinding));

  const oversizedBinding = clone(candidate) as any;
  oversizedBinding.platformTree.fileCount = 20_001;
  oversizedBinding.platformTree.bindingHash = hashCanonicalRuntimeTreeBindingV2(
    oversizedBinding.platformTree,
  );
  oversizedBinding.runtimePayloadHash = hashPlatformRuntimePayloadV2(oversizedBinding);
  assert.throws(() => parsePlatformRuntimePayloadCandidateV2(oversizedBinding));
});

test("environment capsule candidate seals allowlists and exact metadata/network bindings", () => {
  const external = createExternalRuntimeCandidate();
  const candidate = createEnvironmentCandidate(
    external.hostRuntime.hostRuntimeIdentityHash,
    external.metadataProbe.authorityHash,
  );
  const parsed = parseEvidenceEnvironmentCapsuleCandidateV2(candidate);
  assert.equal(parsed.environmentCapsuleHash, hashEvidenceEnvironmentCapsuleV2(parsed));
  assert.equal(
    parsed.network.authority.hostRuntimeIdentityHash,
    external.hostRuntime.hostRuntimeIdentityHash,
  );
  assert.equal(parsed.network.authority.authorityHash, hashNetworkIsolationAuthorityV2(
    parsed.network.authority,
  ));
  assert.equal(
    parsed.filesystem.metadataProbeAuthorityHash,
    external.metadataProbe.authorityHash,
  );
  assert.deepEqual(parsed.childProcess.credentialRefs, []);
  assert.deepEqual(parsed.childProcess.attemptScopedDirectoryMappings, {
    HOME: "RUN_HOME",
    TEMP: "RUN_TMPDIR",
    TMP: "RUN_TMPDIR",
    TMPDIR: "RUN_TMPDIR",
  });
  assert.equal(parsed.childProcess.cwdPolicy, "candidate_runtime_bundle_descendant_only");
  assert.equal(parsed.childProcess.inheritAmbientEnvironment, false);
  assert.equal(parsed.childProcess.shell, "forbidden");
  assert.equal(parsed.network.outboundInternet, "forbidden");
  assert.equal(parsed.network.dns, "forbidden");
  assertRecursivelyFrozen(parsed);

  const ambient = clone(candidate) as any;
  ambient.childProcess.inheritAmbientEnvironment = true;
  ambient.environmentCapsuleHash = hashEvidenceEnvironmentCapsuleV2(ambient);
  assert.throws(() => parseEvidenceEnvironmentCapsuleCandidateV2(ambient));

  const credential = clone(candidate) as any;
  credential.childProcess.credentialRefs = ["SECRET_TOKEN"];
  credential.environmentCapsuleHash = hashEvidenceEnvironmentCapsuleV2(credential);
  assert.throws(() => parseEvidenceEnvironmentCapsuleCandidateV2(credential));

  const sharedTmp = clone(candidate) as any;
  sharedTmp.childProcess.attemptScopedDirectoryMappings.TMPDIR = "RUN_HOME";
  sharedTmp.environmentCapsuleHash = hashEvidenceEnvironmentCapsuleV2(sharedTmp);
  assert.throws(() => parseEvidenceEnvironmentCapsuleCandidateV2(sharedTmp));

  const networkTamper = clone(candidate) as any;
  networkTamper.network.authority.canonicalProfileHash = sha("tampered-profile");
  networkTamper.environmentCapsuleHash = hashEvidenceEnvironmentCapsuleV2(networkTamper);
  assert.throws(() => parseEvidenceEnvironmentCapsuleCandidateV2(networkTamper));

  const metadataTamper = clone(candidate) as any;
  metadataTamper.filesystem.metadataProbeAuthorityHash = sha("tampered-module");
  assert.throws(() => parseEvidenceEnvironmentCapsuleCandidateV2(metadataTamper));
});

test("external runtime candidate binds host TCB, exact npm recipe, graph, tools, and browser policy", () => {
  const candidate = createExternalRuntimeCandidate();
  const parsed = parseExternalRuntimeResolutionCandidateV2(candidate);
  assert.equal(parsed.externalResolutionHash, hashExternalRuntimeResolutionV2(parsed));
  assert.equal(parsed.hostRuntime.hostRuntimeIdentityHash, hashHostRuntimeIdentityV2(
    parsed.hostRuntime,
  ));
  assert.equal(parsed.packageManager.installRecipe.recipeHash,
    hashNpmProductionMaterializationRecipeV2(parsed.packageManager.installRecipe));
  assert.deepEqual(parsed.packageManager.installRecipe.arguments, [
    "--omit=dev",
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
  ]);
  assert.equal(parsed.packageManager.installRecipe.lifecycleScripts, "forbidden");
  assert.equal(parsed.materializationReceipt.receiptHash,
    hashNpmMaterializationReceiptV2(parsed.materializationReceipt));
  assert.equal(parsed.materializationReceipt.recipeHash,
    parsed.packageManager.installRecipe.recipeHash);
  assert.equal(parsed.materializationReceipt.dependencyTreeHash,
    parsed.productionPackages.materializedDependencyTreeHash);
  assert.equal(parsed.materializationReceipt.packageCount,
    parsed.productionPackages.packageCount);
  assert.equal(parsed.materializationReceipt.exitCode, 0);
  assert.equal(parsed.productionPackages.resolutionGraphHash,
    hashProductionPackageResolutionGraphV2(parsed.productionPackages));
  assert.equal(parsed.browserRuntime.status, "forbidden");
  assert.equal(EXTERNAL_RUNTIME_RESOLUTION_V2_MAX_CANONICAL_BYTES < 3 * 1024 * 1024, true);
  assertRecursivelyFrozen(parsed);

  const refs = parsed.executables.map((entry) => entry.executableRef);
  assert.deepEqual(refs, [...refs].sort());
  assert.equal(refs.includes(EVIDENCE_ENVIRONMENT_SANDBOX_EXECUTABLE_REF_V2), true);
  assert.equal(parsed.hostRuntime.bootstrap.installationScope,
    "root_owned_separately_installed");
  assert.equal(parsed.hostRuntime.bootstrap.module.absoluteRealpathLocator.startsWith("payload/"),
    false);
  assert.equal(parsed.metadataProbe.bootstrapModule.absoluteRealpathLocator.startsWith("payload/"),
    false);

  const unknown = clone(candidate) as any;
  unknown.hostRuntime.unknown = true;
  unknown.hostRuntime.hostRuntimeIdentityHash = hashHostRuntimeIdentityV2(unknown.hostRuntime);
  rehashExternal(unknown);
  assert.throws(() => parseExternalRuntimeResolutionCandidateV2(unknown));

  const wrongBootstrap = clone(candidate) as any;
  wrongBootstrap.hostRuntime.bootstrap.executable.hash = sha("wrong-bootstrap");
  wrongBootstrap.hostRuntime.hostRuntimeIdentityHash = hashHostRuntimeIdentityV2(
    wrongBootstrap.hostRuntime,
  );
  rehashExternal(wrongBootstrap);
  assert.throws(() => parseExternalRuntimeResolutionCandidateV2(wrongBootstrap));

  const payloadBootstrap = clone(candidate) as any;
  payloadBootstrap.hostRuntime.bootstrap.module.absoluteRealpathLocator =
    "payload/dist/execution/platform-release-bootstrap-v2.js";
  payloadBootstrap.hostRuntime.hostRuntimeIdentityHash = hashHostRuntimeIdentityV2(
    payloadBootstrap.hostRuntime,
  );
  rehashExternal(payloadBootstrap);
  assert.throws(() => parseExternalRuntimeResolutionCandidateV2(payloadBootstrap));

  const payloadMetadataProbe = clone(candidate) as any;
  payloadMetadataProbe.metadataProbe.bootstrapModule.absoluteRealpathLocator =
    "payload/dist/execution/metadata-probe-v2.js";
  payloadMetadataProbe.metadataProbe.authorityHash = hashMetadataProbeAuthorityV2(
    payloadMetadataProbe.metadataProbe,
  );
  rehashExternal(payloadMetadataProbe);
  assert.throws(() => parseExternalRuntimeResolutionCandidateV2(payloadMetadataProbe));

  const wrongMetadataTool = clone(candidate) as any;
  wrongMetadataTool.metadataProbe.xattrTool.executableHash = sha("wrong-xattr");
  wrongMetadataTool.metadataProbe.authorityHash = hashMetadataProbeAuthorityV2(
    wrongMetadataTool.metadataProbe,
  );
  rehashExternal(wrongMetadataTool);
  assert.throws(() => parseExternalRuntimeResolutionCandidateV2(wrongMetadataTool));

  const wrongNodeArchitecture = clone(candidate) as any;
  wrongNodeArchitecture.nodeRuntime.architecture = "x64";
  rehashExternal(wrongNodeArchitecture);
  assert.throws(() => parseExternalRuntimeResolutionCandidateV2(wrongNodeArchitecture));

  const reorderedLibraries = clone(candidate) as any;
  reorderedLibraries.hostRuntime.nonSystemDynamicLibraries.reverse();
  reorderedLibraries.hostRuntime.hostRuntimeIdentityHash = hashHostRuntimeIdentityV2(
    reorderedLibraries.hostRuntime,
  );
  rehashExternal(reorderedLibraries);
  assert.throws(() => parseExternalRuntimeResolutionCandidateV2(reorderedLibraries));

  const wrongRecipe = clone(candidate) as any;
  wrongRecipe.packageManager.installRecipe.arguments[0] = "--include=dev";
  wrongRecipe.packageManager.installRecipe.recipeHash =
    hashNpmProductionMaterializationRecipeV2(wrongRecipe.packageManager.installRecipe);
  rehashExternal(wrongRecipe);
  assert.throws(() => parseExternalRuntimeResolutionCandidateV2(wrongRecipe));

  const wrongReceipt = clone(candidate) as any;
  wrongReceipt.materializationReceipt.dependencyTreeHash = sha("wrong-dependency-tree");
  wrongReceipt.materializationReceipt.receiptHash = hashNpmMaterializationReceiptV2(
    wrongReceipt.materializationReceipt,
  );
  rehashExternal(wrongReceipt);
  assert.throws(() => parseExternalRuntimeResolutionCandidateV2(wrongReceipt));
});

test("package graph rejects count, ordering, duplicate, self, and unresolved edges after rehash", () => {
  const base = createExternalRuntimeCandidate();
  const variants: any[] = [];

  const wrongCount = clone(base) as any;
  wrongCount.productionPackages.packageCount += 1;
  variants.push(wrongCount);

  const reordered = clone(base) as any;
  reordered.productionPackages.packages.reverse();
  variants.push(reordered);

  const duplicate = clone(base) as any;
  duplicate.productionPackages.packages[1] = clone(
    duplicate.productionPackages.packages[0],
  );
  variants.push(duplicate);

  const selfEdge = clone(base) as any;
  selfEdge.productionPackages.packages[0].dependencyLocators = [
    selfEdge.productionPackages.packages[0].packageLocator,
  ];
  variants.push(selfEdge);

  const unresolved = clone(base) as any;
  unresolved.productionPackages.packages[0].dependencyLocators = [
    "node_modules/missing",
  ];
  variants.push(unresolved);

  for (const variant of variants) {
    variant.productionPackages.resolutionGraphHash =
      hashProductionPackageResolutionGraphV2(variant.productionPackages);
    variant.materializationReceipt = createNpmMaterializationReceipt(
      variant.packageManager,
      variant.productionPackages,
    );
    rehashExternal(variant);
    assert.throws(() => parseExternalRuntimeResolutionCandidateV2(variant));
  }
});

test("browser policy is either forbidden with no browser executable or one exact closure", () => {
  const exact = createBrowserExternalRuntimeCandidate();
  const parsed = parseExternalRuntimeResolutionCandidateV2(exact);
  assert.equal(parsed.browserRuntime.status, "playwright_chromium_exact");
  if (parsed.browserRuntime.status === "playwright_chromium_exact") {
    assert.equal(parsed.browserRuntime.companionResourceTree.treeSchema,
      CANONICAL_RUNTIME_TREE_V2_SCHEMA);
    assert.equal(parsed.browserRuntime.companionResourceTree.profile, "dependencies");
    assert.equal(parsed.browserRuntime.companionResourceTree.fileCount > 0, true);
  }

  const forbiddenWithExecutable = clone(createExternalRuntimeCandidate()) as any;
  forbiddenWithExecutable.executables.push(externalExecutable(
    "EXEC_BROWSER_CHROMIUM_V2",
    "browser_runtime",
    "/opt/chromium",
    sha("chromium"),
    19,
  ));
  forbiddenWithExecutable.executables.sort((left: any, right: any) =>
    left.executableRef < right.executableRef ? -1 : left.executableRef > right.executableRef ? 1 : 0);
  rehashExternal(forbiddenWithExecutable);
  assert.throws(() => parseExternalRuntimeResolutionCandidateV2(forbiddenWithExecutable));

  const wrongPackageClosure = clone(exact) as any;
  wrongPackageClosure.browserRuntime.playwrightPackageTreeHash = sha("wrong-tree");
  wrongPackageClosure.browserRuntime.browserClosureHash = hashBrowserRuntimeExactV2(
    wrongPackageClosure.browserRuntime,
  );
  rehashExternal(wrongPackageClosure);
  assert.throws(() => parseExternalRuntimeResolutionCandidateV2(wrongPackageClosure));

  const wrongCompanionExecutable = clone(exact) as any;
  wrongCompanionExecutable.browserRuntime.companionResourceTree.executableRelativeLocator =
    "Chromium.app/Contents/MacOS/NotChromium";
  wrongCompanionExecutable.browserRuntime.browserClosureHash = hashBrowserRuntimeExactV2(
    wrongCompanionExecutable.browserRuntime,
  );
  rehashExternal(wrongCompanionExecutable);
  assert.throws(() => parseExternalRuntimeResolutionCandidateV2(wrongCompanionExecutable));

  const extraBrowserExecutable = clone(exact) as any;
  extraBrowserExecutable.executables.push(externalExecutable(
    "EXEC_BROWSER_CHROMIUM_HELPER_V2",
    "browser_runtime",
    "/opt/playwright/chromium-1194/helper",
    sha("chromium-helper"),
    23,
  ));
  extraBrowserExecutable.executables.sort((left: any, right: any) =>
    left.executableRef < right.executableRef ? -1 : left.executableRef > right.executableRef ? 1 : 0);
  rehashExternal(extraBrowserExecutable);
  assert.throws(() => parseExternalRuntimeResolutionCandidateV2(extraBrowserExecutable));
});

test("candidate parsers reject proxies, accessors, cycles, and oversized canonical input", () => {
  let proxyTrapCalled = false;
  const proxy = new Proxy({}, {
    get() {
      proxyTrapCalled = true;
      throw new Error("proxy trap must not execute");
    },
  });
  assert.throws(() => parseExternalRuntimeResolutionCandidateV2(proxy));
  assert.equal(proxyTrapCalled, false);

  let accessorCalled = false;
  const accessor = clone(createEnvironmentCandidate()) as any;
  Object.defineProperty(accessor, "forged", {
    enumerable: true,
    get() {
      accessorCalled = true;
      return true;
    },
  });
  assert.throws(() => parseEvidenceEnvironmentCapsuleCandidateV2(accessor));
  assert.equal(accessorCalled, false);

  const cycle = clone(createRuntimePayloadCandidate()) as any;
  cycle.self = cycle;
  assert.throws(() => parsePlatformRuntimePayloadCandidateV2(cycle));

  const oversized = {
    ...createExternalRuntimeCandidate(),
    padding: "x".repeat(EXTERNAL_RUNTIME_RESOLUTION_V2_MAX_CANONICAL_BYTES),
  };
  assert.throws(() => parseExternalRuntimeResolutionCandidateV2(oversized));
});

test("top-level candidate schemas and parsers enforce the same canonical byte caps", () => {
  const runtime = createRuntimePayloadCandidate();
  assert.equal(canonicalJsonBytes(runtime).byteLength
    < PLATFORM_RUNTIME_PAYLOAD_V2_MAX_CANONICAL_BYTES, true);
  const oversizedRuntime = {
    ...runtime,
    padding: "x".repeat(PLATFORM_RUNTIME_PAYLOAD_V2_MAX_CANONICAL_BYTES),
  };
  assert.equal(PlatformRuntimePayloadCandidateV2Schema.safeParse(oversizedRuntime).success,
    false);
  assert.throws(() => parsePlatformRuntimePayloadCandidateV2(oversizedRuntime));

  const external = createExternalRuntimeCandidate();
  const environment = createEnvironmentCandidate(
    external.hostRuntime.hostRuntimeIdentityHash,
    external.metadataProbe.authorityHash,
  );
  assert.equal(canonicalJsonBytes(environment).byteLength
    < EVIDENCE_ENVIRONMENT_CAPSULE_V2_MAX_CANONICAL_BYTES, true);
  const oversizedEnvironment = {
    ...environment,
    padding: "x".repeat(EVIDENCE_ENVIRONMENT_CAPSULE_V2_MAX_CANONICAL_BYTES),
  };
  assert.equal(EvidenceEnvironmentCapsuleCandidateV2Schema.safeParse(
    oversizedEnvironment,
  ).success, false);
  assert.throws(() => parseEvidenceEnvironmentCapsuleCandidateV2(
    oversizedEnvironment,
  ));

  const oversizedExternal = createOverCapExternalRuntimeCandidate();
  assert.equal(canonicalJsonBytes(oversizedExternal).byteLength
    > EXTERNAL_RUNTIME_RESOLUTION_V2_MAX_CANONICAL_BYTES, true);
  const direct = ExternalRuntimeResolutionCandidateV2Schema.safeParse(
    oversizedExternal,
  );
  assert.equal(direct.success, false);
  if (!direct.success) {
    assert.equal(direct.error.issues.some((issue) =>
      issue.message.includes("External runtime candidate exceeds")), true);
  }
  assert.throws(() => parseExternalRuntimeResolutionCandidateV2(oversizedExternal));
});

test("public release-component surface exposes candidates, parsers and hashes but no authority issuer", () => {
  const exportedNames = [
    ...Object.keys(environmentModule),
    ...Object.keys(externalModule),
    ...Object.keys(runtimeModule),
  ];
  assert.equal(exportedNames.some((name) => /^(?:verify|activate|materialize|issue)/i.test(name)), false);
  assert.equal(exportedNames.some((name) => /^(?:create|derive)CanonicalRuntimeTreeBinding/.test(name)), false);
  assert.equal(exportedNames.some((name) => /(?:Brand|Verified|Activated)/.test(name)), false);
  assert.equal(exportedNames.some((name) => /^getDefault/.test(name)), false);
  assert.equal("EvidenceEnvironmentCapsuleV2Schema" in environmentModule, false);
  assert.equal("ExternalRuntimeResolutionV2Schema" in externalModule, false);
  assert.equal("PlatformRuntimePayloadV2Schema" in runtimeModule, false);
  assert.equal(exportedNames.some((name) => /PlatformReleaseManifestV2/.test(name)), false);
});

test("component hash domains are separated", () => {
  const runtime = createRuntimePayloadCandidate();
  const external = createExternalRuntimeCandidate();
  const environment = createEnvironmentCandidate(
    external.hostRuntime.hostRuntimeIdentityHash,
  );
  const hashes = [
    runtime.runtimePayloadHash,
    runtime.platformTree.bindingHash,
    runtime.dependencyTree.bindingHash,
    external.hostRuntime.hostRuntimeIdentityHash,
    external.packageManager.installRecipe.recipeHash,
    external.materializationReceipt.receiptHash,
    external.productionPackages.resolutionGraphHash,
    external.metadataProbe.authorityHash,
    external.externalResolutionHash,
    environment.network.authority.authorityHash,
    environment.environmentCapsuleHash,
  ];
  assert.equal(new Set(hashes).size, hashes.length);
});

test("component candidates expose the exact keys reserved for later root cross-joins", () => {
  const runtime = createRuntimePayloadCandidate();
  const external = createExternalRuntimeCandidate();
  const environment = createEnvironmentCandidate(
    external.hostRuntime.hostRuntimeIdentityHash,
    external.metadataProbe.authorityHash,
  );
  assert.equal(runtime.ownership.runtimeUid, external.hostRuntime.runtimeUid);
  assert.equal(environment.network.authority.hostRuntimeIdentityHash,
    external.hostRuntime.hostRuntimeIdentityHash);
  assert.equal(runtime.dependencyTree.treeHash,
    external.productionPackages.materializedDependencyTreeHash);
  assert.equal(environment.filesystem.metadataProbeAuthorityHash,
    external.metadataProbe.authorityHash);
});

test("component canonical hashes and byte lengths match hardcoded golden vectors", () => {
  const runtime = createRuntimePayloadCandidate();
  const external = createExternalRuntimeCandidate();
  const environment = createEnvironmentCandidate(
    external.hostRuntime.hostRuntimeIdentityHash,
  );
  const browserExternal = createBrowserExternalRuntimeCandidate();
  assert.equal(browserExternal.browserRuntime.status, "playwright_chromium_exact");
  assert.deepEqual({
    platformBindingHash: runtime.platformTree.bindingHash,
    dependencyBindingHash: runtime.dependencyTree.bindingHash,
    runtimePayloadHash: runtime.runtimePayloadHash,
    hostRuntimeIdentityHash: external.hostRuntime.hostRuntimeIdentityHash,
    npmRecipeHash: external.packageManager.installRecipe.recipeHash,
    npmReceiptHash: external.materializationReceipt.receiptHash,
    packageGraphHash: external.productionPackages.resolutionGraphHash,
    metadataProbeHash: external.metadataProbe.authorityHash,
    externalResolutionHash: external.externalResolutionHash,
    networkIsolationHash: environment.network.authority.authorityHash,
    environmentCapsuleHash: environment.environmentCapsuleHash,
    browserClosureHash: browserExternal.browserRuntime.browserClosureHash,
    browserExternalResolutionHash: browserExternal.externalResolutionHash,
    runtimeCanonicalBytes: canonicalJsonBytes(runtime).byteLength,
    externalCanonicalBytes: canonicalJsonBytes(external).byteLength,
    environmentCanonicalBytes: canonicalJsonBytes(environment).byteLength,
    browserExternalCanonicalBytes: canonicalJsonBytes(browserExternal).byteLength,
  }, {
    platformBindingHash: "a6cab60583791c75e7986832573b64164143dad69a6554a28fc7787275e32683",
    dependencyBindingHash: "ebd92a5c0fb9681e3d83f4959ebfcbfb38706944010f415a4eae512f8607f12b",
    runtimePayloadHash: "74b61580a0bef4332dc8e324a0162a0ff3e5884798e2852fe0f77dd23df2f96e",
    hostRuntimeIdentityHash: "ae1bfa5c37071fe2a28fd22296bdceca3c91acebdeb44c1c049cbb016a4129ab",
    npmRecipeHash: "0dada13537e1129a741cf50d35aeb54529e311aeb2e7e09310dff864e5a1d87b",
    npmReceiptHash: "8b6080a206bfddb53360d3bf6466a09783379b7b636cb8559cad7797cf64a3c0",
    packageGraphHash: "060f6de7f196c4adb0bb75a940eefae2ce213385370d66e4791567f82300ffe8",
    metadataProbeHash: "b34ce4aa52892c45b7ebb535df83a689e4a23cda55e88217d194b05cc1e10aa2",
    externalResolutionHash: "6b0b4902e5aadd7cde26ca2efc2b02439ff67342d8711f5aaadf80b82e47ccb5",
    networkIsolationHash: "df66fe0a14bc59e83787aad5fbb1951705e09f26ed91477e05f8a7f2530d7c60",
    environmentCapsuleHash: "414c83f0af2c003de52bc562925e08f518ce4375f73304935d850d07cb3f56cd",
    browserClosureHash: "d934d4c4e1aa5a56ca3670e32694c08ed1c84191e39b836ae1a5a6f6f53627d8",
    browserExternalResolutionHash: "3e089dfe2ff5e4ac239c851f263c45230f0e2ed963c89bb07e4a7c4343a1d5eb",
    runtimeCanonicalBytes: 1976,
    externalCanonicalBytes: 7983,
    environmentCanonicalBytes: 1887,
    browserExternalCanonicalBytes: 9602,
  });
});
