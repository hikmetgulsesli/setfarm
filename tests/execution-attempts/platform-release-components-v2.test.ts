import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { canonicalJsonBytes } from "../../src/product-compiler/canonical-json.js";
import {
  CANONICAL_RUNTIME_TREE_V2_SCHEMA,
  createCanonicalRuntimeTreeV2,
  type CanonicalRuntimeTreeV2,
} from "../../src/execution/schemas/canonical-runtime-tree-v2.js";
import {
  EXCLUSIVE_SOCKET_LIFECYCLE_ABI_HASH_V2,
  EXCLUSIVE_SOCKET_PORT_BANDS_POLICY_HASH_V2,
} from "../../src/execution/schemas/exclusive-socket-lease-v2.js";
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
  NETWORK_ISOLATION_NEGATIVE_PROBE_RECEIPT_SCHEMA_HASH_V2,
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
  EXTERNAL_RUNTIME_RESOLUTION_V2_MAX_DEPENDENCIES_PER_PACKAGE,
  EXTERNAL_RUNTIME_RESOLUTION_V2_MAX_DEPENDENCY_EDGES,
  EXTERNAL_RUNTIME_RESOLUTION_V2_MAX_PACKAGES,
  EXTERNAL_RUNTIME_RESOLUTION_V2_SCHEMA,
  ExternalRuntimeResolutionCandidateV2Schema,
  HOST_BOOTSTRAP_BINDING_V2_SCHEMA,
  HOST_RUNTIME_IDENTITY_V2_SCHEMA,
  NODE_RUNTIME_RESOLUTION_V2_SCHEMA,
  NON_SYSTEM_DYNAMIC_LIBRARY_V2_SCHEMA,
  NPM_MATERIALIZATION_RECEIPT_ABI_POLICY_V2,
  NPM_MATERIALIZATION_RECEIPT_ABI_POLICY_V2_SCHEMA,
  NPM_MATERIALIZATION_RECEIPT_V2_SCHEMA,
  NPM_PACKAGE_MANAGER_RESOLUTION_V2_SCHEMA,
  NPM_PRODUCTION_MATERIALIZATION_CONFIG_V2,
  NPM_PRODUCTION_MATERIALIZATION_CONFIG_V2_SCHEMA,
  NPM_PRODUCTION_MATERIALIZATION_RECIPE_V2,
  NPM_PRODUCTION_MATERIALIZATION_RECIPE_V2_SCHEMA,
  PRODUCTION_PACKAGE_RESOLUTION_ENTRY_V2_SCHEMA,
  PRODUCTION_PACKAGE_RESOLUTION_GRAPH_V2_SCHEMA,
  PRODUCTION_PACKAGE_RESOLUTION_GRAPH_V2_MAX_CANONICAL_BYTES,
  ProductionPackageResolutionGraphV2Schema,
  hashBrowserRuntimeExactV2,
  hashExternalRuntimeResolutionV2,
  hashHostRuntimeIdentityV2,
  hashNpmMaterializationReceiptAbiPolicyV2,
  hashNpmMaterializationReceiptV2,
  hashNpmProductionMaterializationConfigV2,
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
import * as commonModule from "../../src/execution/schemas/platform-release-common-v2.js";
import {
  EXACT_HOST_OWNED_FILE_REF_V2_SCHEMA,
  ExactHostOwnedFileRefV2Schema,
  HOST_ADMISSION_PHYSICAL_IDENTITY_V2_SCHEMA,
  HOST_ADMISSION_RECEIPT_V2_SCHEMA,
  HOST_ADMISSION_RECEIPT_MAX_CANONICAL_BYTES_V2,
  HOST_ADMISSION_VERIFIER_V2_SCHEMA,
  HostAdmissionReceiptV2Schema,
  hashHostAdmissionPhysicalIdentityV2,
  hashHostAdmissionReceiptV2,
  parseHostAdmissionReceiptCandidateV2,
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
    negativeProbeReceiptSchemaHash:
      NETWORK_ISOLATION_NEGATIVE_PROBE_RECEIPT_SCHEMA_HASH_V2,
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
      bandsHash: EXCLUSIVE_SOCKET_PORT_BANDS_POLICY_HASH_V2,
      lifecycleAbiHash: EXCLUSIVE_SOCKET_LIFECYCLE_ABI_HASH_V2,
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
  const target = {
    absoluteRealpathLocator,
    hash: sha(label),
    byteLength,
    ownerUid: 0 as const,
    ownerGid: 0,
    mode,
  };
  const physicalIdentity = {
    schema: HOST_ADMISSION_PHYSICAL_IDENTITY_V2_SCHEMA,
    device: "1",
    inode: BigInt(`0x${sha(`${label}-inode`).slice(0, 12)}`)
      .toString(),
    linkCount: 1 as const,
    hash: target.hash,
    byteLength,
    ownerUid: 0 as const,
    ownerGid: 0,
    mode,
  };
  const physical = {
    ...physicalIdentity,
    identityHash: hashHostAdmissionPhysicalIdentityV2({
      ...physicalIdentity,
      identityHash: sha("placeholder"),
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
      probeReceiptHash: sha(`${label}-metadata-probe`),
    },
    verifier: {
      schema: HOST_ADMISSION_VERIFIER_V2_SCHEMA,
      installationScope:
        "root_owned_separately_installed" as const,
      absoluteRealpathLocator:
        "/usr/local/libexec/setfarm/host-admission-v2",
      hash: sha("host-admission-verifier"),
      byteLength: 12_001,
      ownerUid: 0 as const,
      ownerGid: 0,
      mode: "0555" as const,
      requiredAbi:
        "HOST_FILE_STABLE_DESCRIPTOR_ADMISSION_V2" as const,
      abiHash: sha("host-admission-verifier-abi"),
      installationAnchorHash:
        sha("host-admission-installation-anchor"),
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

function rehashHostAdmissionRef(candidate: any): void {
  candidate.hostAdmissionReceipt.receiptHash =
    hashHostAdmissionReceiptV2(candidate.hostAdmissionReceipt);
  candidate.hostAdmissionEvidenceHash =
    candidate.hostAdmissionReceipt.receiptHash;
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
  return clone(NPM_PRODUCTION_MATERIALIZATION_RECIPE_V2);
}

test("npm production config, receipt ABI policy, and recipe form one frozen literal authority", () => {
  assert.equal(
    NPM_PRODUCTION_MATERIALIZATION_CONFIG_V2.schema,
    NPM_PRODUCTION_MATERIALIZATION_CONFIG_V2_SCHEMA,
  );
  assert.equal(
    NPM_MATERIALIZATION_RECEIPT_ABI_POLICY_V2.schema,
    NPM_MATERIALIZATION_RECEIPT_ABI_POLICY_V2_SCHEMA,
  );
  assert.equal(
    NPM_PRODUCTION_MATERIALIZATION_CONFIG_V2.configHash,
    hashNpmProductionMaterializationConfigV2(
      NPM_PRODUCTION_MATERIALIZATION_CONFIG_V2,
    ),
  );
  assert.equal(
    NPM_MATERIALIZATION_RECEIPT_ABI_POLICY_V2.policyHash,
    hashNpmMaterializationReceiptAbiPolicyV2(
      NPM_MATERIALIZATION_RECEIPT_ABI_POLICY_V2,
    ),
  );
  assert.equal(
    NPM_PRODUCTION_MATERIALIZATION_RECIPE_V2.configHash,
    NPM_PRODUCTION_MATERIALIZATION_CONFIG_V2.configHash,
  );
  assert.equal(
    NPM_PRODUCTION_MATERIALIZATION_RECIPE_V2
      .materializationReceiptSchemaHash,
    NPM_MATERIALIZATION_RECEIPT_ABI_POLICY_V2.policyHash,
  );
  assertRecursivelyFrozen(
    NPM_PRODUCTION_MATERIALIZATION_CONFIG_V2,
  );
  assertRecursivelyFrozen(
    NPM_MATERIALIZATION_RECEIPT_ABI_POLICY_V2,
  );
  assertRecursivelyFrozen(
    NPM_PRODUCTION_MATERIALIZATION_RECIPE_V2,
  );

  const configDrift = clone(
    NPM_PRODUCTION_MATERIALIZATION_CONFIG_V2,
  ) as any;
  configDrift.arguments[0] = "--include=dev";
  configDrift.configHash =
    hashNpmProductionMaterializationConfigV2(
      configDrift,
    );
  assert.throws(() =>
    externalModule.NpmProductionMaterializationConfigV2Schema
      .parse(configDrift));

  const policyDrift = clone(
    NPM_MATERIALIZATION_RECEIPT_ABI_POLICY_V2,
  ) as any;
  policyDrift.processAuthority = "caller_claimed";
  policyDrift.policyHash =
    hashNpmMaterializationReceiptAbiPolicyV2(
      policyDrift,
    );
  assert.throws(() =>
    externalModule.NpmMaterializationReceiptAbiPolicyV2Schema
      .parse(policyDrift));
});

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
  const dependencyLocators = new Set(
    packages.flatMap((entry) =>
      entry.dependencyLocators),
  );
  const packagesByLocator = new Map(
    packages.map((entry) => [
      entry.packageLocator,
      entry,
    ]),
  );
  const rootDependencyLocators = packages
    .map((entry) => entry.packageLocator)
    .filter((locator) => !dependencyLocators.has(locator))
    .sort();
  const dependencyEdges = [
    ...rootDependencyLocators.map((locator) => {
      const dependency = packagesByLocator.get(locator)!;
      return {
        ownerPackageLocator: "",
        kind: "required" as const,
        dependencyName: dependency.packageName,
        declaredSpec: dependency.version,
        resolvedPackageLocator: locator,
        resolvedVersion: dependency.version,
      };
    }),
    ...packages.flatMap((owner) =>
      owner.dependencyLocators.map((locator) => {
        const dependency = packagesByLocator.get(locator)!;
        return {
          ownerPackageLocator: owner.packageLocator,
          kind: "required" as const,
          dependencyName: dependency.packageName,
          declaredSpec: dependency.version,
          resolvedPackageLocator: locator,
          resolvedVersion: dependency.version,
        };
      })),
  ].sort((left, right) => {
    const leftKey = [
      left.ownerPackageLocator,
      left.kind,
      left.dependencyName,
      left.resolvedPackageLocator,
      left.declaredSpec,
      left.resolvedVersion,
    ].join("\0");
    const rightKey = [
      right.ownerPackageLocator,
      right.kind,
      right.dependencyName,
      right.resolvedPackageLocator,
      right.declaredSpec,
      right.resolvedVersion,
    ].join("\0");
    return leftKey < rightKey
      ? -1
      : leftKey > rightKey
        ? 1
        : 0;
  });
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
    productionClosureHash: sha("production-closure"),
    productionClosureContractHash:
      sha("production-closure-contract"),
    dependencyEdgeModel:
      "required_and_observed_optional" as const,
    rootDependencyLocators,
    dependencyEdges,
    packages,
    packageCount: packages.length,
  };
  return {
    ...identity,
    resolutionGraphHash: hashProductionPackageResolutionGraphV2(identity),
  };
}

function createCanonicalBudgetPackageGraph(
  packageCount: number,
) {
  const version =
    `1.${"1".repeat(30)}.${"1".repeat(31)}`;
  const maximumVersion =
    `2.${"1".repeat(30)}.${"1".repeat(31)}`;
  const declaredSpec =
    `>= ${version} < ${maximumVersion}`;
  const packageNames = Array.from(
    { length: packageCount },
    (_unused, index) => {
      const id = String(index).padStart(2, "0");
      return `@s${id}${"a".repeat(97)}/p${id}${"b".repeat(97)}`;
    },
  );
  const packageLocators = packageNames.map(
    (packageName) => `node_modules/${packageName}`,
  );
  const packages = packageNames.map(
    (packageName, index) => {
      const packageLocator = packageLocators[index]!;
      return {
        schema:
          PRODUCTION_PACKAGE_RESOLUTION_ENTRY_V2_SCHEMA,
        packageLocator,
        packageName,
        version,
        lockEntryHash:
          sha(`budget-lock-${index}`),
        packageJsonHash:
          sha(`budget-package-json-${index}`),
        runtimeTreeHash:
          sha(`budget-runtime-tree-${index}`),
        dependencyLocators: packageLocators
          .filter((locator) => locator !== packageLocator)
          .sort(),
      };
    },
  );
  const byLocator = new Map(
    packages.map((entry) => [
      entry.packageLocator,
      entry,
    ]),
  );
  const dependencyEdges = [
    ...packages.map((dependency) => ({
      ownerPackageLocator: "",
      kind: "required" as const,
      dependencyName: dependency.packageName,
      declaredSpec,
      resolvedPackageLocator:
        dependency.packageLocator,
      resolvedVersion: dependency.version,
    })),
    ...packages.flatMap((owner) =>
      owner.dependencyLocators.map((locator) => {
        const dependency = byLocator.get(locator)!;
        return {
          ownerPackageLocator:
            owner.packageLocator,
          kind: "required" as const,
          dependencyName: dependency.packageName,
          declaredSpec,
          resolvedPackageLocator:
            dependency.packageLocator,
          resolvedVersion: dependency.version,
        };
      })),
  ].sort((left, right) => {
    const leftKey = [
      left.ownerPackageLocator,
      left.kind,
      left.dependencyName,
      left.resolvedPackageLocator,
      left.declaredSpec,
      left.resolvedVersion,
    ].join("\0");
    const rightKey = [
      right.ownerPackageLocator,
      right.kind,
      right.dependencyName,
      right.resolvedPackageLocator,
      right.declaredSpec,
      right.resolvedVersion,
    ].join("\0");
    return leftKey < rightKey
      ? -1
      : leftKey > rightKey
        ? 1
        : 0;
  });
  const identity = {
    schema:
      PRODUCTION_PACKAGE_RESOLUTION_GRAPH_V2_SCHEMA,
    version: "2.0.0" as const,
    lockfileVersion: 3 as const,
    lockfile: {
      schema: EXACT_SOURCE_FILE_REF_V2_SCHEMA,
      locator: "package-lock.json" as const,
      mediaType: "application/json" as const,
      hash: sha("budget-package-lock"),
      byteLength: 1,
    },
    materializedDependencyTreeHash:
      sha("budget-dependency-tree"),
    productionClosureHash:
      sha("budget-production-closure"),
    productionClosureContractHash:
      sha("budget-production-contract"),
    dependencyEdgeModel:
      "required_and_observed_optional" as const,
    rootDependencyLocators: [...packageLocators],
    dependencyEdges,
    packages,
    packageCount,
  };
  return {
    ...identity,
    resolutionGraphHash:
      hashProductionPackageResolutionGraphV2(
        identity,
      ),
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
  const dependencyTree =
    createRuntimePayloadCandidate().dependencyTree;
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
    dependencyTreePayloadHash:
      dependencyTree.treePayloadHash,
    dependencyTreeBindingHash:
      dependencyTree.bindingHash,
    productionClosureHash:
      productionPackages.productionClosureHash,
    productionClosureContractHash:
      productionPackages
        .productionClosureContractHash,
    productionResolutionGraphHash:
      productionPackages.resolutionGraphHash,
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

test("host-owned file refs carry one complete stable admission receipt", () => {
  const candidate = createHostOwnedFile(
    "host-receipt-fixture",
    "/usr/local/libexec/setfarm/host-receipt-fixture",
    "0444",
    4_003,
  );
  assert.equal(
    ExactHostOwnedFileRefV2Schema.safeParse(candidate).success,
    true,
  );
  const parsed = parseHostAdmissionReceiptCandidateV2(
    candidate.hostAdmissionReceipt,
  );
  assert.equal(
    parsed.receiptHash,
    hashHostAdmissionReceiptV2(parsed),
  );
  assert.equal(
    parsed.physicalBefore.identityHash,
    parsed.physicalAfter.identityHash,
  );
  assert.equal(
    canonicalJsonBytes(parsed).byteLength
      < HOST_ADMISSION_RECEIPT_MAX_CANONICAL_BYTES_V2,
    true,
  );
  assertRecursivelyFrozen(parsed);

  const detachedTarget = clone(candidate) as any;
  detachedTarget.hostAdmissionReceipt.target.hash =
    sha("detached-target");
  rehashHostAdmissionRef(detachedTarget);
  assert.equal(
    ExactHostOwnedFileRefV2Schema.safeParse(detachedTarget).success,
    false,
  );

  const unstablePhysical = clone(candidate) as any;
  unstablePhysical.hostAdmissionReceipt.physicalAfter.inode = "999";
  unstablePhysical.hostAdmissionReceipt.physicalAfter.identityHash =
    hashHostAdmissionPhysicalIdentityV2(
      unstablePhysical.hostAdmissionReceipt.physicalAfter,
    );
  rehashHostAdmissionRef(unstablePhysical);
  assert.equal(
    HostAdmissionReceiptV2Schema.safeParse(
      unstablePhysical.hostAdmissionReceipt,
    ).success,
    false,
  );

  let traps = 0;
  const hostile = new Proxy({}, {
    ownKeys() {
      traps += 1;
      throw new Error("host admission proxy trap must not execute");
    },
  });
  assert.throws(() => parseHostAdmissionReceiptCandidateV2(hostile));
  assert.equal(traps, 0);
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
    parsed.network.authority.negativeProbeReceiptSchemaHash,
    NETWORK_ISOLATION_NEGATIVE_PROBE_RECEIPT_SCHEMA_HASH_V2,
  );
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
  assert.equal(
    parsed.portLease.bandsHash,
    EXCLUSIVE_SOCKET_PORT_BANDS_POLICY_HASH_V2,
  );
  assert.equal(
    parsed.portLease.lifecycleAbiHash,
    EXCLUSIVE_SOCKET_LIFECYCLE_ABI_HASH_V2,
  );
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

  const receiptAbiTamper = clone(candidate) as any;
  receiptAbiTamper.network.authority.negativeProbeReceiptSchemaHash =
    sha("caller-network-receipt-abi");
  receiptAbiTamper.network.authority.authorityHash =
    hashNetworkIsolationAuthorityV2(receiptAbiTamper.network.authority);
  receiptAbiTamper.environmentCapsuleHash =
    hashEvidenceEnvironmentCapsuleV2(receiptAbiTamper);
  assert.throws(() => parseEvidenceEnvironmentCapsuleCandidateV2(
    receiptAbiTamper,
  ));

  const socketAbiTamper = clone(candidate) as any;
  socketAbiTamper.portLease.lifecycleAbiHash = sha("caller-socket-abi");
  socketAbiTamper.environmentCapsuleHash =
    hashEvidenceEnvironmentCapsuleV2(socketAbiTamper);
  assert.throws(() => parseEvidenceEnvironmentCapsuleCandidateV2(
    socketAbiTamper,
  ));

  const socketBandsTamper = clone(candidate) as any;
  socketBandsTamper.portLease.bandsHash = sha("caller-port-bands");
  socketBandsTamper.environmentCapsuleHash =
    hashEvidenceEnvironmentCapsuleV2(socketBandsTamper);
  assert.throws(() => parseEvidenceEnvironmentCapsuleCandidateV2(
    socketBandsTamper,
  ));

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

  const bootstrapHostDrift = clone(candidate) as any;
  bootstrapHostDrift.hostRuntime.bootstrap.module
    .hostAdmissionReceipt.host.macosBuildVersion = "24F75";
  rehashHostAdmissionRef(
    bootstrapHostDrift.hostRuntime.bootstrap.module,
  );
  bootstrapHostDrift.hostRuntime.hostRuntimeIdentityHash =
    hashHostRuntimeIdentityV2(bootstrapHostDrift.hostRuntime);
  rehashExternal(bootstrapHostDrift);
  assert.throws(() =>
    parseExternalRuntimeResolutionCandidateV2(bootstrapHostDrift));

  const metadataVerifierDrift = clone(candidate) as any;
  metadataVerifierDrift.metadataProbe.bootstrapModule
    .hostAdmissionReceipt.verifier.abiHash =
      sha("different-host-admission-verifier");
  rehashHostAdmissionRef(
    metadataVerifierDrift.metadataProbe.bootstrapModule,
  );
  metadataVerifierDrift.metadataProbe.authorityHash =
    hashMetadataProbeAuthorityV2(metadataVerifierDrift.metadataProbe);
  rehashExternal(metadataVerifierDrift);
  assert.throws(() =>
    parseExternalRuntimeResolutionCandidateV2(metadataVerifierDrift));

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

test("package graph rejects count, ordering, duplicate, self, unresolved edges, and incomplete root reachability after rehash", () => {
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

  const unorderedRoots = clone(base) as any;
  unorderedRoots.productionPackages.rootDependencyLocators = [
    "node_modules/zod",
    "node_modules/postgres",
  ];
  variants.push(unorderedRoots);

  const duplicateRoot = clone(base) as any;
  duplicateRoot.productionPackages.rootDependencyLocators = [
    "node_modules/postgres",
    "node_modules/postgres",
  ];
  variants.push(duplicateRoot);

  const unreachablePackage = clone(base) as any;
  unreachablePackage.productionPackages.rootDependencyLocators = [
    "node_modules/zod",
  ];
  variants.push(unreachablePackage);

  const missingRoots = clone(base) as any;
  missingRoots.productionPackages.rootDependencyLocators = [];
  variants.push(missingRoots);

  const nestedRoot = clone(base) as any;
  nestedRoot.productionPackages.packages[1].packageLocator =
    "node_modules/postgres/node_modules/zod";
  nestedRoot.productionPackages.packages[0].dependencyLocators = [
    "node_modules/postgres/node_modules/zod",
  ];
  nestedRoot.productionPackages.rootDependencyLocators = [
    "node_modules/postgres/node_modules/zod",
  ];
  variants.push(nestedRoot);

  const malformedPackagePath = clone(base) as any;
  malformedPackagePath.productionPackages.packages[0]
    .packageLocator = "node_modules/extra/postgres";
  malformedPackagePath.productionPackages
    .rootDependencyLocators = [
      "node_modules/extra/postgres",
    ];
  variants.push(malformedPackagePath);

  const unsupportedSpec = clone(base) as any;
  unsupportedSpec.productionPackages.dependencyEdges[0]
    .declaredSpec = "latest";
  variants.push(unsupportedSpec);

  const incompatibleSpec = clone(base) as any;
  incompatibleSpec.productionPackages.dependencyEdges[0]
    .declaredSpec = "^99.0.0";
  variants.push(incompatibleSpec);

  const wrongEdgeModel = clone(base) as any;
  wrongEdgeModel.productionPackages.dependencyEdgeModel =
    "dependencies_only";
  variants.push(wrongEdgeModel);

  const wrongEdgeKind = clone(base) as any;
  wrongEdgeKind.productionPackages.dependencyEdges[0]
    .kind = "dependencies";
  variants.push(wrongEdgeKind);

  const duplicatedEdge = clone(base) as any;
  duplicatedEdge.productionPackages.dependencyEdges.push(
    clone(
      duplicatedEdge.productionPackages
        .dependencyEdges[0],
    ),
  );
  variants.push(duplicatedEdge);

  const reorderedEdges = clone(base) as any;
  reorderedEdges.productionPackages.dependencyEdges
    .reverse();
  variants.push(reorderedEdges);

  const wrongEdgeOwner = clone(base) as any;
  wrongEdgeOwner.productionPackages.dependencyEdges[0]
    .ownerPackageLocator = "node_modules/missing";
  variants.push(wrongEdgeOwner);

  const wrongEdgeName = clone(base) as any;
  wrongEdgeName.productionPackages.dependencyEdges[0]
    .dependencyName = "wrong-name";
  variants.push(wrongEdgeName);

  const missingEdge = clone(base) as any;
  missingEdge.productionPackages.dependencyEdges.pop();
  variants.push(missingEdge);

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

test("package graph enforces its one MiB canonical budget before the two MiB external envelope", () => {
  const withinBudget =
    createCanonicalBudgetPackageGraph(29);
  const overBudget =
    createCanonicalBudgetPackageGraph(30);
  const withinBytes =
    canonicalJsonBytes(withinBudget).byteLength;
  const overBytes =
    canonicalJsonBytes(overBudget).byteLength;

  assert.equal(
    withinBytes
      <= PRODUCTION_PACKAGE_RESOLUTION_GRAPH_V2_MAX_CANONICAL_BYTES,
    true,
  );
  assert.equal(
    overBytes
      > PRODUCTION_PACKAGE_RESOLUTION_GRAPH_V2_MAX_CANONICAL_BYTES,
    true,
  );
  assert.equal(
    PRODUCTION_PACKAGE_RESOLUTION_GRAPH_V2_MAX_CANONICAL_BYTES
      < EXTERNAL_RUNTIME_RESOLUTION_V2_MAX_CANONICAL_BYTES,
    true,
  );
  assert.equal(
    withinBudget.packageCount
      < EXTERNAL_RUNTIME_RESOLUTION_V2_MAX_PACKAGES,
    true,
  );
  assert.equal(
    withinBudget.dependencyEdges.length
      < EXTERNAL_RUNTIME_RESOLUTION_V2_MAX_DEPENDENCY_EDGES,
    true,
  );
  assert.equal(
    withinBudget.packages.every(
      (entry) =>
        entry.dependencyLocators.length
          < EXTERNAL_RUNTIME_RESOLUTION_V2_MAX_DEPENDENCIES_PER_PACKAGE,
    ),
    true,
  );
  assert.doesNotThrow(() =>
    ProductionPackageResolutionGraphV2Schema.parse(
      withinBudget,
    ));

  const rejected =
    ProductionPackageResolutionGraphV2Schema.safeParse(
      overBudget,
    );
  assert.equal(rejected.success, false);
  if (!rejected.success) {
    assert.equal(
      rejected.error.issues.some(
        (issue) =>
          issue.message
            === "Production package resolution graph exceeds its canonical byte cap",
      ),
      true,
    );
  }
});

test("package graph finalizes V2 by rejecting the pre-closure historical shape", () => {
  const current = createPackageGraph();
  assert.doesNotThrow(() =>
    ProductionPackageResolutionGraphV2Schema.parse(
      current,
    ));

  const historical = clone(current) as any;
  delete historical.productionClosureHash;
  delete historical.productionClosureContractHash;
  delete historical.dependencyEdgeModel;
  delete historical.rootDependencyLocators;
  delete historical.dependencyEdges;
  historical.resolutionGraphHash =
    hashProductionPackageResolutionGraphV2(
      historical,
    );
  assert.equal(
    ProductionPackageResolutionGraphV2Schema
      .safeParse(historical).success,
    false,
  );

  const closureDrift = clone(current) as any;
  closureDrift.productionClosureHash =
    sha("different-production-closure");
  closureDrift.resolutionGraphHash =
    hashProductionPackageResolutionGraphV2(
      closureDrift,
    );
  assert.notEqual(
    closureDrift.resolutionGraphHash,
    current.resolutionGraphHash,
  );
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
    ...Object.keys(commonModule),
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
    hostAdmissionReceiptHash:
      external.hostRuntime.bootstrap.executable
        .hostAdmissionReceipt.receiptHash,
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
    hostAdmissionReceiptCanonicalBytes:
      canonicalJsonBytes(
        external.hostRuntime.bootstrap.executable
          .hostAdmissionReceipt,
      ).byteLength,
    externalCanonicalBytes: canonicalJsonBytes(external).byteLength,
    environmentCanonicalBytes: canonicalJsonBytes(environment).byteLength,
    browserExternalCanonicalBytes: canonicalJsonBytes(browserExternal).byteLength,
  }, {
    platformBindingHash: "a6cab60583791c75e7986832573b64164143dad69a6554a28fc7787275e32683",
    dependencyBindingHash: "ebd92a5c0fb9681e3d83f4959ebfcbfb38706944010f415a4eae512f8607f12b",
    runtimePayloadHash: "74b61580a0bef4332dc8e324a0162a0ff3e5884798e2852fe0f77dd23df2f96e",
    hostAdmissionReceiptHash:
      "eac1e35ddd8ce08c6dc51f80dcb07ac4eb5ef7b2f43daf3482359212c89e08e6",
    hostRuntimeIdentityHash: "88cff0f72a247a236540f441435360cd61cc96bcb59db5689014de8a399b7b93",
    npmRecipeHash: "334da44acb37a412e8cdfef71f4d6c68f1e483f079405c9de7b181200d0f88a0",
    npmReceiptHash: "0b88f9b161c091f5972479da8af70c3f8b5a5064080639b521d7ac5cd65f9ba5",
    packageGraphHash: "602b621707c10796195482d658c7ec87571a56664871c3674919f9f4675798c1",
    metadataProbeHash: "10912ba979838f0886e81c7d395f59717378606cb8748dc87276ea68f1fc21d4",
    externalResolutionHash: "f112599136404d5090c882037ef1371eadd5d998c4857c7210bf285b12208746",
    networkIsolationHash: "066148dd65bd0786418c63806d22396a04fff6fb6d30e66c5820b4b000f12fff",
    environmentCapsuleHash: "cc36e6534744d7154e870c4c9e224ca75fe079001a49885c460018a67c73d78c",
    browserClosureHash: "d934d4c4e1aa5a56ca3670e32694c08ed1c84191e39b836ae1a5a6f6f53627d8",
    browserExternalResolutionHash: "ee5121325a736fa5a7313e8b59ad581fa2f90e15b61c3c2e0f7b1d72d88112d6",
    runtimeCanonicalBytes: 1976,
    hostAdmissionReceiptCanonicalBytes: 2011,
    externalCanonicalBytes: 15248,
    environmentCanonicalBytes: 1973,
    browserExternalCanonicalBytes: 17070,
  });
});
