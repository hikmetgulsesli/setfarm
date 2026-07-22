import { createHash } from "node:crypto";

import { z } from "zod";

import {
  DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
  canonicalJsonBytesBounded,
  type CanonicalJsonBoundedLimits,
} from "./bounded-canonical-json.js";
import { canonicalJsonStringify, hashCanonicalJson } from "./canonical-json.js";
import {
  verifyDeepByteBundleFromCasV2,
  type DeepByteBundleCasAuthorityV2,
  type VerifiedDeepByteBundleV2,
} from "./deep-byte-bundle-verifier-v2.js";
import type { SemanticArtifactEnvelopeV1 } from "./artifact-store.js";
import {
  ARTIFACT_STORE_BATCH_PLAN_SCHEMA_V1,
  prepareArtifactStoreBatchPlanV1,
} from "./artifact-store-batch-plan.js";
import {
  NODE_CLI_PACKAGE_JSON_TEXT_V2,
  NODE_CLI_PACKAGE_LOCK_JSON_TEXT_V2,
  NODE_CLI_TSCONFIG_JSON_TEXT_V2,
  NODE_EXPRESS_API_PACKAGE_JSON_TEXT_V2,
  NODE_EXPRESS_API_PACKAGE_LOCK_JSON_TEXT_V2,
  NODE_EXPRESS_API_TSCONFIG_JSON_TEXT_V2,
} from "./node-scaffold-assets-v2.js";
import {
  getCodeOwnedNodeExecutionLayoutCatalogV2,
  resolveNodeExecutionLayoutV2,
} from "./node-execution-layout-catalog-v2.js";
import {
  compileNodeExecutionPathTokenSetV2,
} from "./path-token-v2.js";
import {
  getProductDeliveryProfileCatalogV2,
} from "./product-delivery-profile-catalog-v2.js";
import {
  BYTE_BUNDLE_ARTIFACT_TYPE_V1,
  createByteBundleV1,
  type ByteBundleBuildResultV1,
} from "./schemas/byte-bundle-v1.js";
import {
  hashDeepByteBundleConsumerBindingV2,
  type DeepByteBundleConsumerBindingV2,
} from "./schemas/deep-byte-bundle-verification-receipt-v2.js";
import {
  NODE_SCAFFOLD_ASSET_CODE_SHA_V2,
  NODE_SCAFFOLD_BUILD_REQUIRED_PRECONDITIONS_V2,
  NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_REF_V2,
  NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_SCHEMA,
  NODE_SCAFFOLD_INSTALL_REQUIRED_PRECONDITIONS_V2,
  NODE_SCAFFOLD_TOOLCHAIN_BLOCKER_CODES_V2,
  NODE_SCAFFOLD_TOOLCHAIN_CATALOG_MAX_CANONICAL_BYTES_V2,
  NODE_SCAFFOLD_TOOLCHAIN_CATALOG_V2_SCHEMA,
  NODE_SCAFFOLD_TOOLCHAIN_CATALOG_VERSION_V2,
  NODE_SCAFFOLD_TOOLCHAIN_ENTRY_REFS_V2,
  NODE_SCAFFOLD_TOOLCHAIN_ENTRY_V2_SCHEMA,
  NODE_SCAFFOLD_TOOLCHAIN_RESOLUTION_MAX_CANONICAL_BYTES_V2,
  NODE_SCAFFOLD_TOOLCHAIN_RESOLUTION_V2_SCHEMA,
  NODE_SCAFFOLD_TEST_REQUIRED_PRECONDITIONS_V2,
  NodeScaffoldToolchainCatalogV2Schema,
  NodeScaffoldToolchainEntryV2Schema,
  NodeScaffoldToolchainResolutionV2Schema,
  hashNodeScaffoldDependencyEdgeMembershipV2,
  hashNodeScaffoldDependencyGraphV2,
  hashNodeScaffoldDependencyNodeMembershipV2,
  hashNodeScaffoldExecutionEnvironmentV2,
  hashNodeScaffoldSemanticRequirementMembershipV2,
  hashNodeScaffoldToolchainCatalogV2,
  hashNodeScaffoldToolchainEntryV2,
  hashNodeScaffoldToolchainResolutionV2,
  nodeScaffoldPackageNameFromLockPathV2,
  nodeScaffoldVersionSatisfiesSpecV2,
  resolveNodeScaffoldDependencyPathV2,
  type NodeScaffoldByteBundleRefV2,
  type NodeScaffoldDependencyGraphV2,
  type NodeScaffoldExecutionEnvironmentHashPayloadV2,
  type NodeScaffoldExecutionEnvironmentV2,
  type NodeScaffoldToolchainCatalogV2,
  type NodeScaffoldToolchainEntryHashPayloadV2,
  type NodeScaffoldToolchainEntryV2,
  type NodeScaffoldToolchainResolutionHashPayloadV2,
  type NodeScaffoldToolchainResolutionV2,
} from "./schemas/node-scaffold-toolchain-catalog-v2.js";
import type { NodeExecutionLayoutV2 } from "./schemas/node-execution-layout-catalog-v2.js";
import type { NodeExecutionPathTokenSetV2 } from "./schemas/path-token-v2.js";
import type {
  SemanticSourceExternalPathRequirementV2,
  SemanticSourcePathTokenSetV2,
} from "./schemas/semantic-source-path-token-set-v2.js";
import {
  compileSemanticSourcePathTokenSetV2,
} from "./semantic-source-path-token-set-v2.js";
import {
  getCodeOwnedStackSemanticSourceRuleSetV1,
} from "./stack-semantic-source-rules-catalog-v1.js";

const COMPILER_INPUT_MAX_BYTES = 8 * 1024 * 1024;
const VERIFIER_INPUT_MAX_BYTES = 10 * 1024 * 1024;
const MAX_DIAGNOSTICS = 100;
const EMPTY_DIAGNOSTICS = Object.freeze([]) as readonly [];

const COMPILER_BOUNDED_WORK_LIMITS = Object.freeze({
  maxDepth: DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxDepth + 8,
  maxNodes: DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxNodes + 65_536,
  maxContainerEntries:
    DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxContainerEntries,
  maxWorkUnits:
    DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxWorkUnits + (8 * 1024 * 1024),
});

const VERIFIER_BOUNDED_WORK_LIMITS = Object.freeze({
  maxDepth: DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxDepth + 12,
  maxNodes:
    DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxNodes
    + NODE_SCAFFOLD_TOOLCHAIN_CATALOG_MAX_CANONICAL_BYTES_V2
    + NODE_SCAFFOLD_TOOLCHAIN_RESOLUTION_MAX_CANONICAL_BYTES_V2,
  maxContainerEntries:
    DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxContainerEntries,
  maxWorkUnits:
    DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxWorkUnits
    + (NODE_SCAFFOLD_TOOLCHAIN_CATALOG_MAX_CANONICAL_BYTES_V2 * 8)
    + (NODE_SCAFFOLD_TOOLCHAIN_RESOLUTION_MAX_CANONICAL_BYTES_V2 * 8),
});

const ASSET_PRODUCER_V2 = Object.freeze({
  pass: "node-scaffold-toolchain-catalog-v2-assets" as const,
  codeSha: NODE_SCAFFOLD_ASSET_CODE_SHA_V2,
  model: "code-owned" as const,
  toolVersions: Object.freeze({
    byteBundleContract: "1.0.0" as const,
    canonicalJson: "1.0.0" as const,
    lockfile: "3" as const,
    lockGeneratorNode: "22.23.1" as const,
    npm: "10.9.8" as const,
  }),
});

function readinessV2() {
  return {
    status: "shadow" as const,
    productionUse: "forbidden" as const,
    blockerCodes: [...NODE_SCAFFOLD_TOOLCHAIN_BLOCKER_CODES_V2],
  };
}

function plannedNpmrcV2(
  pathRef:
    | "PRIVATE_STAGE_EMPTY_USER_NPMRC_V2"
    | "PRIVATE_STAGE_EMPTY_GLOBAL_NPMRC_V2",
) {
  return {
    pathRef,
    canonicalContent: "single_lf_blank_file" as const,
    rawHash:
      "01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b" as const,
    rawByteLength: 1 as const,
    byteBundleAuthority: "future_private_environment_byte_bundle_v2" as const,
    materializationAuthority: "future_private_staged_materializer_v2" as const,
  };
}

function buildPlannedExecutionEnvironmentV2():
NodeScaffoldExecutionEnvironmentV2 {
  const withoutHash: NodeScaffoldExecutionEnvironmentHashPayloadV2 = {
    schema: NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_SCHEMA,
    contractVersion: "2.1.0",
    environmentRef: NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_REF_V2,
    mode: "planned_isolated_exact",
    productionAuthority: "unverified_blocking",
    productionAuthorityBlockerCode:
      "NODE_SCAFFOLD_V2_EXECUTION_ENVIRONMENT_UNVERIFIED",
    inheritAmbientEnvironment: false,
    constructionPolicy: "deny_all_then_exact_set",
    inheritedVariableAllowlist: [],
    fixedVariables: {
      CI: "true",
      LANG: "C.UTF-8",
      LC_ALL: "C.UTF-8",
      // Node/npm process diagnostics are captured by canonical command
      // receipts; mutable compile-cache and npm log files are forbidden.
      NODE_DISABLE_COMPILE_CACHE: "1",
      NO_COLOR: "1",
      NPM_CONFIG_REGISTRY: "https://registry.npmjs.org",
      NPM_CONFIG_LOGS_MAX: "0",
      TZ: "UTC",
    },
    attemptScopedVariableBindings: {
      HOME: "PRIVATE_STAGE_HOME_V2",
      NPM_CONFIG_CACHE: "PRIVATE_STAGE_NPM_CACHE_V2",
      NPM_CONFIG_GLOBALCONFIG: "PRIVATE_STAGE_EMPTY_GLOBAL_NPMRC_V2",
      NPM_CONFIG_USERCONFIG: "PRIVATE_STAGE_EMPTY_USER_NPMRC_V2",
      PATH: "HOST_TOOLCHAIN_EXACT_COMMAND_PATH_V2",
      TEMP: "PRIVATE_STAGE_TMP_V2",
      TMP: "PRIVATE_STAGE_TMP_V2",
      TMPDIR: "PRIVATE_STAGE_TMP_V2",
    },
    npmConfigIsolation: {
      ambientVariablePrefix: "npm_config_",
      prefixMatch: "case_insensitive",
      ambientVariablePolicy: "strip_all_before_exact_set",
      projectNpmrc: {
        normalizedLocator: ".npmrc",
        requiredBaseState: "absent",
        evidenceAuthority: "future_file_tree_manifest_v2",
      },
      userNpmrc: plannedNpmrcV2("PRIVATE_STAGE_EMPTY_USER_NPMRC_V2"),
      globalNpmrc: plannedNpmrcV2("PRIVATE_STAGE_EMPTY_GLOBAL_NPMRC_V2"),
      builtinNpmrcAuthority: "future_exact_host_npm_toolchain_receipt_v2",
      effectiveConfigReceiptSchema:
        "setfarm.effective-npm-config-receipt.v2",
      effectiveConfigReceiptStatus: "unverified_blocking",
      effectiveConfigReceiptBlockerCode:
        "NODE_SCAFFOLD_V2_EFFECTIVE_NPM_CONFIG_RECEIPT_UNVERIFIED",
    },
    proxyAndCaPolicy: "absent_unless_future_secret_authority",
    credentialVariableRefs: [],
    requiredReceiptSchema:
      "setfarm.node-scaffold-execution-environment-receipt.v2",
    receiptStatus: "unverified_blocking",
    receiptBlockerCode:
      "NODE_SCAFFOLD_V2_EXECUTION_ENVIRONMENT_UNVERIFIED",
  };
  return {
    ...withoutHash,
    environmentContractHash:
      hashNodeScaffoldExecutionEnvironmentV2(withoutHash),
  };
}

type JsonRecord = Record<string, any>;

type EntryDescriptorV2 = Readonly<{
  entryRef: typeof NODE_SCAFFOLD_TOOLCHAIN_ENTRY_REFS_V2[number];
  kind: "cli" | "http_handler";
  profileId:
    | "PROFILE_NODE_CLI_STATELESS_EXACT_V2"
    | "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2";
  stackPackId: "node-cli" | "node-express-api";
  layoutRef:
    | "NODE_EXECUTION_LAYOUT_NODE_CLI_V2"
    | "NODE_EXECUTION_LAYOUT_NODE_EXPRESS_API_V2";
  sourceEntrypointSlotRef:
    | "PATH_SLOT_NODE_CLI_SOURCE_ENTRYPOINT_V2"
    | "PATH_SLOT_NODE_API_SOURCE_ENTRYPOINT_V2";
  packageJson: string;
  packageLockJson: string;
  tsconfigJson: string;
  sourceExports: readonly [string, string, string];
}>;

export type NodeScaffoldAssetRoleV2 =
  | "package_manifest"
  | "dependency_lock_manifest"
  | "typescript_compiler_config";

export type NodeScaffoldProfileIdV2 = EntryDescriptorV2["profileId"];

type NodeScaffoldAssetDefinitionV2 = Readonly<{
  role: NodeScaffoldAssetRoleV2;
  pathSlotRef:
    | "PATH_SLOT_NODE_PACKAGE_JSON_V2"
    | "PATH_SLOT_NODE_PACKAGE_LOCK_JSON_V2"
    | "PATH_SLOT_NODE_TSCONFIG_JSON_V2";
  normalizedLocator: "package.json" | "package-lock.json" | "tsconfig.json";
  sourceExportRef: string;
  text: string;
}>;

const ENTRY_DESCRIPTORS_V2: readonly EntryDescriptorV2[] = Object.freeze([
  Object.freeze({
    entryRef: NODE_SCAFFOLD_TOOLCHAIN_ENTRY_REFS_V2[0],
    kind: "cli",
    profileId: "PROFILE_NODE_CLI_STATELESS_EXACT_V2",
    stackPackId: "node-cli",
    layoutRef: "NODE_EXECUTION_LAYOUT_NODE_CLI_V2",
    sourceEntrypointSlotRef: "PATH_SLOT_NODE_CLI_SOURCE_ENTRYPOINT_V2",
    packageJson: NODE_CLI_PACKAGE_JSON_TEXT_V2,
    packageLockJson: NODE_CLI_PACKAGE_LOCK_JSON_TEXT_V2,
    tsconfigJson: NODE_CLI_TSCONFIG_JSON_TEXT_V2,
    sourceExports: Object.freeze([
      "NODE_CLI_PACKAGE_JSON_TEXT_V2",
      "NODE_CLI_PACKAGE_LOCK_JSON_TEXT_V2",
      "NODE_CLI_TSCONFIG_JSON_TEXT_V2",
    ]) as readonly [string, string, string],
  }),
  Object.freeze({
    entryRef: NODE_SCAFFOLD_TOOLCHAIN_ENTRY_REFS_V2[1],
    kind: "http_handler",
    profileId: "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2",
    stackPackId: "node-express-api",
    layoutRef: "NODE_EXECUTION_LAYOUT_NODE_EXPRESS_API_V2",
    sourceEntrypointSlotRef: "PATH_SLOT_NODE_API_SOURCE_ENTRYPOINT_V2",
    packageJson: NODE_EXPRESS_API_PACKAGE_JSON_TEXT_V2,
    packageLockJson: NODE_EXPRESS_API_PACKAGE_LOCK_JSON_TEXT_V2,
    tsconfigJson: NODE_EXPRESS_API_TSCONFIG_JSON_TEXT_V2,
    sourceExports: Object.freeze([
      "NODE_EXPRESS_API_PACKAGE_JSON_TEXT_V2",
      "NODE_EXPRESS_API_PACKAGE_LOCK_JSON_TEXT_V2",
      "NODE_EXPRESS_API_TSCONFIG_JSON_TEXT_V2",
    ]) as readonly [string, string, string],
  }),
]);

function descriptorAssetDefinitionsV2(
  descriptor: EntryDescriptorV2,
): readonly NodeScaffoldAssetDefinitionV2[] {
  return Object.freeze([
    Object.freeze({
      role: "package_manifest" as const,
      pathSlotRef: "PATH_SLOT_NODE_PACKAGE_JSON_V2" as const,
      normalizedLocator: "package.json" as const,
      sourceExportRef: descriptor.sourceExports[0],
      text: descriptor.packageJson,
    }),
    Object.freeze({
      role: "dependency_lock_manifest" as const,
      pathSlotRef: "PATH_SLOT_NODE_PACKAGE_LOCK_JSON_V2" as const,
      normalizedLocator: "package-lock.json" as const,
      sourceExportRef: descriptor.sourceExports[1],
      text: descriptor.packageLockJson,
    }),
    Object.freeze({
      role: "typescript_compiler_config" as const,
      pathSlotRef: "PATH_SLOT_NODE_TSCONFIG_JSON_V2" as const,
      normalizedLocator: "tsconfig.json" as const,
      sourceExportRef: descriptor.sourceExports[2],
      text: descriptor.tsconfigJson,
    }),
  ]);
}

const EXPECTED_NODE_SCAFFOLD_TOOLCHAIN_IDENTITY_V2 = Object.freeze({
  catalogVersion: "2.0.0" as const,
  assetCodeSha: NODE_SCAFFOLD_ASSET_CODE_SHA_V2,
  entries: Object.freeze([
    Object.freeze({
      entryRef: NODE_SCAFFOLD_TOOLCHAIN_ENTRY_REFS_V2[0],
      entryHash:
        "dcc662d7d80a7c4b0bac637cbe183af422e6be094233a8d8694ed7ce8e1b6236",
      graphHash:
        "9df929156d318356432f64478465b4d9db56e149322c0a409668cb1d94cd2e05",
    }),
    Object.freeze({
      entryRef: NODE_SCAFFOLD_TOOLCHAIN_ENTRY_REFS_V2[1],
      entryHash:
        "a50c542dc95e8cf0efcbcef4d56999f0b64fe7656691ee87a7274474f46188b4",
      graphHash:
        "0b252fa9eae81525771901bad0a279656164e4b03dceadde6b58186ee80c519f",
    }),
  ]),
  catalogHash:
    "1a98cb77c5faa3eb0605b93a052ff7aa943c4bf784c6d152eb5a352505e25930",
});

function compareUtf16(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function rawSha256(bytes: string | Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message.slice(0, 1_000)
    : "Invalid bounded canonical JSON input";
}

function deepFreezeJson<T>(value: T): T {
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

function boundedSnapshot(
  value: unknown,
  maxBytes: number,
  workLimits: Omit<CanonicalJsonBoundedLimits, "maxBytes">,
): unknown {
  const bytes = canonicalJsonBytesBounded(value, { maxBytes, ...workLimits });
  return JSON.parse(bytes.toString("utf8"));
}

function parseCanonicalJsonAsset(text: string, label: string): JsonRecord {
  if (
    text.startsWith("\ufeff")
    || text.includes("\r")
    || !text.endsWith("\n")
    || text.endsWith("\n\n")
  ) {
    throw new NodeScaffoldToolchainCodeAuthorityErrorV2(
      `${label} is not one canonical LF-terminated JSON artifact`,
    );
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new NodeScaffoldToolchainCodeAuthorityErrorV2(
      `${label} is not valid JSON`,
    );
  }
  if (`${canonicalJsonStringify(value)}\n` !== text) {
    throw new NodeScaffoldToolchainCodeAuthorityErrorV2(
      `${label} is not exact Setfarm canonical JSON plus one LF`,
    );
  }
  return value as JsonRecord;
}

function edgeKey(edge: Readonly<{
  ownerPackagePath: string;
  kind: string;
  dependencyName: string;
  resolvedPackagePath: string;
}>): string {
  return [
    edge.ownerPackagePath,
    edge.kind,
    edge.dependencyName,
    edge.resolvedPackagePath,
  ].join("\0");
}

function buildDependencyGraphV2(
  manifestText: string,
  lockText: string,
): NodeScaffoldDependencyGraphV2 {
  const manifest = parseCanonicalJsonAsset(manifestText, "package.json");
  const lock = parseCanonicalJsonAsset(lockText, "package-lock.json");
  if (
    lock.lockfileVersion !== 3
    || lock.requires !== true
    || lock.name !== manifest.name
    || lock.version !== manifest.version
    || lock.packages === null
    || typeof lock.packages !== "object"
    || Array.isArray(lock.packages)
  ) {
    throw new NodeScaffoldToolchainCodeAuthorityErrorV2(
      "Package manifest and npm lock root authority do not join exactly",
    );
  }
  if (
    manifest.packageManager !== "npm@10.9.8"
    || manifest.engines?.node !== ">=22.13.0 <23"
    || manifest.engines?.npm !== "10.9.8"
  ) {
    throw new NodeScaffoldToolchainCodeAuthorityErrorV2(
      "Package manifest lost its exact Node/npm toolchain projection",
    );
  }
  const packages = lock.packages as JsonRecord;
  const root = packages[""] as JsonRecord | undefined;
  if (!root) {
    throw new NodeScaffoldToolchainCodeAuthorityErrorV2(
      "npm lock lacks its exact root package entry",
    );
  }
  const expectedRoot = {
    ...(manifest.dependencies ? { dependencies: manifest.dependencies } : {}),
    devDependencies: manifest.devDependencies,
    engines: manifest.engines,
    name: manifest.name,
    version: manifest.version,
  };
  if (canonicalJsonStringify(root) !== canonicalJsonStringify(expectedRoot)) {
    throw new NodeScaffoldToolchainCodeAuthorityErrorV2(
      "npm lock root differs from the exact package manifest projection",
    );
  }
  const directDependencies = [
    ...Object.entries(manifest.dependencies ?? {}).map(([packageName, exactVersion]) => ({
      kind: "runtime" as const,
      packageName,
      exactVersion: String(exactVersion),
    })),
    ...Object.entries(manifest.devDependencies ?? {}).map(([packageName, exactVersion]) => ({
      kind: "development" as const,
      packageName,
      exactVersion: String(exactVersion),
    })),
  ].sort((left, right) => compareUtf16(
    `${left.kind}\0${left.packageName}`,
    `${right.kind}\0${right.packageName}`,
  ));
  for (const dependency of directDependencies) {
    if (!/^\d+\.\d+\.\d+$/u.test(dependency.exactVersion)) {
      throw new NodeScaffoldToolchainCodeAuthorityErrorV2(
        `Root dependency ${dependency.packageName} is not exact`,
      );
    }
  }
  const packagePaths = new Set(Object.keys(packages).filter((path) => path !== ""));
  const nodes = Object.entries(packages)
    .filter(([packagePath]) => packagePath !== "")
    .map(([packagePath, candidate]) => {
      const entry = candidate as JsonRecord;
      if (
        typeof entry.version !== "string"
        || typeof entry.resolved !== "string"
        || !entry.resolved.startsWith("https://registry.npmjs.org/")
        || typeof entry.integrity !== "string"
        || !entry.integrity.startsWith("sha512-")
        || typeof entry.license !== "string"
        || entry.hasInstallScript !== undefined
        || entry.link !== undefined
        || entry.gypfile !== undefined
        || entry.os !== undefined
        || entry.cpu !== undefined
        || entry.libc !== undefined
        || entry.optionalDependencies !== undefined
        || entry.peerDependencies !== undefined
      ) {
        throw new NodeScaffoldToolchainCodeAuthorityErrorV2(
          `Lock node ${packagePath} violates the exact scaffold dependency policy`,
        );
      }
      return {
        packagePath,
        packageName: nodeScaffoldPackageNameFromLockPathV2(packagePath)!,
        version: entry.version,
        resolved: entry.resolved,
        integrity: entry.integrity,
        dev: entry.dev === true,
        license: entry.license,
        installLifecycle: "hasInstallScript_absent_in_lock" as const,
        nativeLockMetadata: "absent" as const,
        lockEntryHash: hashCanonicalJson(entry),
      };
    })
    .sort((left, right) => compareUtf16(left.packagePath, right.packagePath));
  const edges: Array<{
    ownerPackagePath: string;
    kind: "dependencies" | "devDependencies";
    dependencyName: string;
    declaredSpec: string;
    resolvedPackagePath: string;
    resolvedVersion: string;
  }> = [];
  for (const [ownerPackagePath, candidate] of Object.entries(packages)) {
    const entry = candidate as JsonRecord;
    for (const kind of ["dependencies", "devDependencies"] as const) {
      const dependencies = entry[kind] as JsonRecord | undefined;
      if (!dependencies) continue;
      if (ownerPackagePath !== "" && kind === "devDependencies") {
        throw new NodeScaffoldToolchainCodeAuthorityErrorV2(
          `Non-root lock node ${ownerPackagePath} declares devDependencies`,
        );
      }
      for (const [dependencyName, declaredSpecValue] of Object.entries(dependencies)) {
        const resolvedPackagePath = resolveNodeScaffoldDependencyPathV2(
          packagePaths,
          ownerPackagePath,
          dependencyName,
        );
        const resolvedEntry = resolvedPackagePath
          ? packages[resolvedPackagePath] as JsonRecord | undefined
          : undefined;
        const declaredSpec = String(declaredSpecValue);
        if (
          !resolvedPackagePath
          || !resolvedEntry
          || typeof resolvedEntry.version !== "string"
          || !nodeScaffoldVersionSatisfiesSpecV2(
            resolvedEntry.version,
            declaredSpec,
          )
        ) {
          throw new NodeScaffoldToolchainCodeAuthorityErrorV2(
            `Lock edge ${ownerPackagePath || "<root>"} -> ${dependencyName} is unresolved or incompatible`,
          );
        }
        edges.push({
          ownerPackagePath,
          kind,
          dependencyName,
          declaredSpec,
          resolvedPackagePath,
          resolvedVersion: resolvedEntry.version,
        });
      }
    }
  }
  edges.sort((left, right) => compareUtf16(edgeKey(left), edgeKey(right)));
  const withoutHash = {
    schema: "setfarm.node-scaffold-dependency-graph.v2" as const,
    lockfileVersion: 3 as const,
    lockRawHash: rawSha256(lockText),
    root: {
      packageName: manifest.name,
      version: "0.0.0" as const,
      engines: {
        node: ">=22.13.0 <23" as const,
        npm: "10.9.8" as const,
      },
      packageManager: "npm@10.9.8" as const,
      directDependencies,
      manifestRawHash: rawSha256(manifestText),
      lockRootHash: hashCanonicalJson(root),
    },
    policy: {
      registryOrigin: "https://registry.npmjs.org" as const,
      integrityAlgorithm: "sha512" as const,
      rootVersionPolicy: "exact_versions_only" as const,
      versionSpecGrammar:
        "exact_major_wildcard_caret_tilde_comparator_pair_v2" as const,
      graphResolution: "nearest_node_modules_lock_v3" as const,
      installLifecyclePolicy: "hasInstallScript_absent_in_lock" as const,
      scriptExecutionBarrier: "npm_ci_ignore_scripts" as const,
      registryLifecycleMetadataAuthority:
        "unversioned_audit_not_production_authority" as const,
      deepTarballContentAuthority: "unverified_blocking" as const,
      deepTarballContentBlockerCode:
        "NODE_SCAFFOLD_V2_DEPENDENCY_TARBALL_CONTENT_UNVERIFIED" as const,
      transitiveEngineCompatibilityAuthority: "unverified_blocking" as const,
      transitiveEngineCompatibilityBlockerCode:
        "NODE_SCAFFOLD_V2_TRANSITIVE_ENGINE_COMPATIBILITY_UNVERIFIED" as const,
    },
    nodeCount: nodes.length,
    nodes,
    edgeCount: edges.length,
    edges,
    nodeMembershipHash: hashNodeScaffoldDependencyNodeMembershipV2(nodes),
    edgeMembershipHash: hashNodeScaffoldDependencyEdgeMembershipV2(edges),
  };
  return {
    ...withoutHash,
    graphHash: hashNodeScaffoldDependencyGraphV2(withoutHash as NodeScaffoldDependencyGraphV2),
  } as NodeScaffoldDependencyGraphV2;
}

type ProducedByteBundleV1 = Extract<
  ByteBundleBuildResultV1,
  { status: "produced" }
>;

function buildAssetByteBundleV2(
  sourceExportRef: string,
  text: string,
): ProducedByteBundleV1 {
  const byteBundle = createByteBundleV1({
    bytes: Buffer.from(text, "utf8"),
    producer: ASSET_PRODUCER_V2,
  });
  if (byteBundle.status !== "produced") {
    throw new NodeScaffoldToolchainCodeAuthorityErrorV2(
      `${sourceExportRef} cannot produce ByteBundleV1: ${byteBundle.rejectionCode}`,
    );
  }
  return byteBundle;
}

function buildAssetRefV2(
  definition: NodeScaffoldAssetDefinitionV2,
) {
  const byteBundle = buildAssetByteBundleV2(
    definition.sourceExportRef,
    definition.text,
  );
  const bundleRef: NodeScaffoldByteBundleRefV2 = {
    artifactType: BYTE_BUNDLE_ARTIFACT_TYPE_V1,
    envelopeHash: byteBundle.bundle.envelopeHash,
    envelopeByteLength: byteBundle.bundle.envelopeByteLength,
    rawHash: byteBundle.rawHash,
    rawByteLength: byteBundle.rawByteLength,
  };
  return {
    role: definition.role,
    pathSlotRef: definition.pathSlotRef,
    normalizedLocator: definition.normalizedLocator,
    mediaType: "application/json" as const,
    sourceExportRef: definition.sourceExportRef,
    rawHash: byteBundle.rawHash,
    rawByteLength: byteBundle.rawByteLength,
    byteBundle: bundleRef,
  };
}

function requireLayout(
  descriptor: EntryDescriptorV2,
  layouts: readonly NodeExecutionLayoutV2[],
): NodeExecutionLayoutV2 {
  const layout = layouts.find((candidate) =>
    candidate.layoutRef === descriptor.layoutRef);
  if (
    !layout
    || layout.profileBinding.profileId !== descriptor.profileId
    || layout.stackPackBinding.stackPackId !== descriptor.stackPackId
    || layout.pathSlots.sourceEntrypoint.slotRef
      !== descriptor.sourceEntrypointSlotRef
  ) {
    throw new NodeScaffoldToolchainCodeAuthorityErrorV2(
      `${descriptor.entryRef} lost exact profile/layout/source-slot authority`,
    );
  }
  return layout;
}

function buildEntryV2(
  descriptor: EntryDescriptorV2,
  profileCatalog: ReturnType<typeof getProductDeliveryProfileCatalogV2>,
  layoutCatalog: ReturnType<typeof getCodeOwnedNodeExecutionLayoutCatalogV2>,
): NodeScaffoldToolchainEntryV2 {
  const profile = profileCatalog.profiles.find((candidate) =>
    candidate.id === descriptor.profileId);
  const layout = requireLayout(descriptor, layoutCatalog.layouts);
  const semanticRuleSet = getCodeOwnedStackSemanticSourceRuleSetV1(
    descriptor.stackPackId,
  );
  if (!profile || !semanticRuleSet || semanticRuleSet.ruleSetVersion !== "1.0.0") {
    throw new NodeScaffoldToolchainCodeAuthorityErrorV2(
      `${descriptor.entryRef} lost profile or semantic-rule authority`,
    );
  }
  parseCanonicalJsonAsset(descriptor.tsconfigJson, "tsconfig.json");
  const files = descriptorAssetDefinitionsV2(descriptor).map(buildAssetRefV2);
  const executionEnvironment = buildPlannedExecutionEnvironmentV2();
  const withoutHash: NodeScaffoldToolchainEntryHashPayloadV2 = {
    schema: NODE_SCAFFOLD_TOOLCHAIN_ENTRY_V2_SCHEMA,
    entryVersion: NODE_SCAFFOLD_TOOLCHAIN_CATALOG_VERSION_V2,
    entryRef: descriptor.entryRef,
    kind: descriptor.kind,
    profileBinding: {
      catalogVersion: profileCatalog.catalogVersion,
      catalogHash: profileCatalog.catalogHash,
      profileId: descriptor.profileId,
      profileHash: profile.profileHash,
      stackPackId: descriptor.stackPackId,
      stackPackVersion: layout.stackPackBinding.stackPackVersion,
      stackPackContentHash: layout.stackPackBinding.stackPackContentHash,
    },
    layoutBinding: {
      catalogVersion: layoutCatalog.catalogVersion,
      catalogHash: layoutCatalog.catalogHash,
      layoutRef: descriptor.layoutRef,
      layoutHash: layout.layoutHash,
      pathSlotContractVersion: layout.pathSlots.slotContractVersion,
      pathSlotSetHash: layout.pathSlots.slotSetHash,
    },
    readiness: readinessV2(),
    scaffold: {
      fileCount: 3,
      files,
      forbiddenArtifactClasses: [
        "source",
        "test",
        "documentation",
        "repository_control",
        "build_output",
        "dependency_installation",
        "candidate_bundle",
      ],
    },
    dependencyGraph: buildDependencyGraphV2(
      descriptor.packageJson,
      descriptor.packageLockJson,
    ),
    toolchain: {
      nodeRuntime: {
        executableRef: "TOOL_NODE_RUNTIME_V2",
        compatibilityRange: ">=22.13.0 <23",
        exactHostResolution: "unverified_blocking",
        exactHostResolutionBlockerCode:
          "NODE_SCAFFOLD_V2_HOST_TOOLCHAIN_RESOLUTION_UNVERIFIED",
      },
      npm: {
        executableRef: "TOOL_NODE_NPM_CLI_V2",
        exactVersion: "10.9.8",
        exactHostResolution: "unverified_blocking",
        exactHostResolutionBlockerCode:
          "NODE_SCAFFOLD_V2_HOST_TOOLCHAIN_RESOLUTION_UNVERIFIED",
      },
      typescript: {
        executableRef: "TOOL_NODE_TYPESCRIPT_TSC_V2",
        exactVersion: "5.9.3",
        materializationAuthority: "package_lock_graph_and_future_receipt",
      },
      lockGeneration: {
        nodeVersion: "22.23.1",
        npmVersion: "10.9.8",
        lockfileVersion: 3,
        registryOrigin: "https://registry.npmjs.org",
      },
    },
    executionEnvironment,
    recipes: {
      install: {
        commandRef: "CMD_NODE_SCAFFOLD_INSTALL_V2",
        executableRef: "TOOL_NODE_NPM_CLI_V2",
        cwdRootRef: "PATH_ROOT_NODE_REPOSITORY_V2",
        directArgv: [
          "npm",
          "ci",
          "--include=dev",
          "--ignore-scripts",
          "--no-audit",
          "--no-fund",
        ],
        environmentBinding: {
          environmentRef: NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_REF_V2,
          environmentContractHash: executionEnvironment.environmentContractHash,
        },
        requiredPreconditionCount:
          NODE_SCAFFOLD_INSTALL_REQUIRED_PRECONDITIONS_V2.length,
        requiredPreconditions: [
          ...NODE_SCAFFOLD_INSTALL_REQUIRED_PRECONDITIONS_V2,
        ],
        executionStatus: "blocked_until_private_materializer_and_host_receipt",
      },
      build: {
        commandRef: "CMD_BUILD",
        executableRef: "TOOL_NODE_NPM_CLI_V2",
        cwdRootRef: "PATH_ROOT_NODE_REPOSITORY_V2",
        directArgv: ["npm", "run", "build"],
        environmentBinding: {
          environmentRef: NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_REF_V2,
          environmentContractHash: executionEnvironment.environmentContractHash,
        },
        requiredPreconditionCount:
          NODE_SCAFFOLD_BUILD_REQUIRED_PRECONDITIONS_V2.length,
        requiredPreconditions: [
          ...NODE_SCAFFOLD_BUILD_REQUIRED_PRECONDITIONS_V2,
        ],
        requiredSourceReceiptSchema: "setfarm.node-entrypoint-source-receipt.v2",
        missingSourceReceiptDisposition: "typed_precondition_rejection",
        executionStatus: "blocked_until_source_and_dependency_receipts",
      },
      test: {
        commandRef: "CMD_TEST",
        executableRef: "TOOL_NODE_NPM_CLI_V2",
        cwdRootRef: "PATH_ROOT_NODE_REPOSITORY_V2",
        directArgv: ["npm", "test"],
        environmentBinding: {
          environmentRef: NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_REF_V2,
          environmentContractHash: executionEnvironment.environmentContractHash,
        },
        requiredPreconditionCount:
          NODE_SCAFFOLD_TEST_REQUIRED_PRECONDITIONS_V2.length,
        requiredPreconditions: [
          ...NODE_SCAFFOLD_TEST_REQUIRED_PRECONDITIONS_V2,
        ],
        canonicalReceiptSchema: "setfarm.canonical-test-receipt.v2",
        exitCodeRequired: 0,
        minimumTestCount: 1,
        zeroTestReceipt: "forbidden",
        acceptanceAuthority: "none_until_verified_canonical_receipt",
        executionStatus: "blocked_until_source_and_dependency_receipts",
      },
    },
    sourceGeneration: {
      kind: "deferred_to_node_entrypoint_generator_v2",
      scaffoldCreatesSource: false,
      sourceDirectoryMayBeAbsent: true,
      canonicalEntrypointInitialState: "absent",
      requiredBaseState: "absent",
      canonicalEntrypointPathSlotRef: descriptor.sourceEntrypointSlotRef,
      finalOwnerRef: "NODE_ENTRYPOINT_GENERATOR_V2",
      outputMode: "whole_file",
      modelWriteAuthority: "forbidden",
      requiredReceiptSchema: "setfarm.node-entrypoint-source-receipt.v2",
      buildBeforeReceipt: "typed_precondition_rejection",
      currentSemanticRulesCompatibility: {
        ruleSetRef: semanticRuleSet.ruleSetRef,
        ruleSetVersion: "1.0.0",
        ruleSetHash: semanticRuleSet.ruleSetHash,
        status: "unmigrated_shared_entrypoint_rules",
        productionActivation: "forbidden",
      },
    },
  };
  const parsed = NodeScaffoldToolchainEntryV2Schema.safeParse({
    ...withoutHash,
    entryHash: hashNodeScaffoldToolchainEntryV2(withoutHash),
  });
  if (!parsed.success) {
    throw new NodeScaffoldToolchainCodeAuthorityErrorV2(
      parsed.error.issues[0]?.message ?? `${descriptor.entryRef} is invalid`,
    );
  }
  return parsed.data;
}

function buildCodeOwnedNodeScaffoldToolchainCatalogV2():
NodeScaffoldToolchainCatalogV2 {
  const profileCatalog = getProductDeliveryProfileCatalogV2();
  const layoutCatalog = getCodeOwnedNodeExecutionLayoutCatalogV2();
  const entries = ENTRY_DESCRIPTORS_V2.map((descriptor) =>
    buildEntryV2(descriptor, profileCatalog, layoutCatalog));
  const withoutHash = {
    schema: NODE_SCAFFOLD_TOOLCHAIN_CATALOG_V2_SCHEMA,
    catalogVersion: NODE_SCAFFOLD_TOOLCHAIN_CATALOG_VERSION_V2,
    sourceAuthority: {
      kind: "code_owned_commit_assets" as const,
      repositoryRef: "SETFARM" as const,
      codeSha: NODE_SCAFFOLD_ASSET_CODE_SHA_V2,
      moduleLocator: "src/product-compiler/node-scaffold-assets-v2.ts" as const,
      producer: ASSET_PRODUCER_V2,
      publicationStatus: "unpublished_shadow" as const,
      deepCasVerification: {
        status: "unverified" as const,
        blockerCode:
          "NODE_SCAFFOLD_V2_BYTE_BUNDLE_DEEP_VERIFICATION_UNVERIFIED" as const,
      },
    },
    readiness: readinessV2(),
    entryCount: NODE_SCAFFOLD_TOOLCHAIN_ENTRY_REFS_V2.length,
    entries,
  };
  const parsed = NodeScaffoldToolchainCatalogV2Schema.safeParse({
    ...withoutHash,
    catalogHash: hashNodeScaffoldToolchainCatalogV2(withoutHash),
  });
  if (!parsed.success) {
    throw new NodeScaffoldToolchainCodeAuthorityErrorV2(
      parsed.error.issues[0]?.message
      ?? "Code-owned NodeScaffoldToolchainCatalogV2 is invalid",
    );
  }
  const identity = {
    catalogVersion: parsed.data.catalogVersion,
    assetCodeSha: parsed.data.sourceAuthority.codeSha,
    entries: parsed.data.entries.map((entry) => ({
      entryRef: entry.entryRef,
      entryHash: entry.entryHash,
      graphHash: entry.dependencyGraph.graphHash,
    })),
    catalogHash: parsed.data.catalogHash,
  };
  if (
    canonicalJsonStringify(identity)
    !== canonicalJsonStringify(EXPECTED_NODE_SCAFFOLD_TOOLCHAIN_IDENTITY_V2)
  ) {
    throw new NodeScaffoldToolchainCodeAuthorityErrorV2(
      "NodeScaffoldToolchainCatalogV2 identity changed without an intentional version/hash transition: "
        + canonicalJsonStringify(identity),
    );
  }
  return deepFreezeJson(parsed.data);
}

export class NodeScaffoldToolchainCodeAuthorityErrorV2 extends Error {
  readonly code = "NODE_SCAFFOLD_TOOLCHAIN_V2_CODE_AUTHORITY_DRIFT" as const;

  constructor(message: string) {
    super(message.slice(0, 1_000));
    this.name = "NodeScaffoldToolchainCodeAuthorityErrorV2";
  }
}

export function getCodeOwnedNodeScaffoldToolchainCatalogV2():
Readonly<NodeScaffoldToolchainCatalogV2> {
  return buildCodeOwnedNodeScaffoldToolchainCatalogV2();
}

export function nodeScaffoldToolchainCatalogHashV2(): string {
  return buildCodeOwnedNodeScaffoldToolchainCatalogV2().catalogHash;
}

export function getCodeOwnedNodeScaffoldToolchainEntryV2(
  profileId: string,
): Readonly<NodeScaffoldToolchainEntryV2> | null {
  return buildCodeOwnedNodeScaffoldToolchainCatalogV2().entries.find((entry) =>
    entry.profileBinding.profileId === profileId) ?? null;
}

export const NODE_SCAFFOLD_ASSET_PUBLICATION_V2_SCHEMA =
  "setfarm.node-scaffold-asset-publication.v2" as const;

export type NodeScaffoldAssetPublicationFileV2 = Readonly<{
  entryRef: NodeScaffoldToolchainEntryV2["entryRef"];
  entryHash: string;
  profileId: NodeScaffoldProfileIdV2;
  role: NodeScaffoldAssetRoleV2;
  normalizedLocator: "package.json" | "package-lock.json" | "tsconfig.json";
  sourceExportRef: string;
  rawHash: string;
  rawByteLength: number;
  byteBundle: NodeScaffoldByteBundleRefV2;
  binding: DeepByteBundleConsumerBindingV2;
}>;

export type NodeScaffoldAssetPublicationV2 = Readonly<{
  schema: typeof NODE_SCAFFOLD_ASSET_PUBLICATION_V2_SCHEMA;
  catalogHash: string;
  assetCodeSha: string;
  fileCount: number;
  files: readonly NodeScaffoldAssetPublicationFileV2[];
  batchCount: number;
  batches: readonly Readonly<{
    profileId: NodeScaffoldProfileIdV2;
    planIdentityHash: string;
    plan: Readonly<{
      schema: typeof ARTIFACT_STORE_BATCH_PLAN_SCHEMA_V1;
      items: readonly Readonly<{
        durabilityTier: 0 | 1;
        envelope: SemanticArtifactEnvelopeV1;
      }>[];
    }>;
  }>[];
}>;

function nodeScaffoldAssetSubjectHashV2(input: Readonly<{
  catalogHash: string;
  entryRef: string;
  entryHash: string;
  profileId: string;
  file: NodeScaffoldToolchainEntryV2["scaffold"]["files"][number];
}>): string {
  return hashCanonicalJson({
    schema: "setfarm.node-scaffold-asset-subject-hash.v2",
    ...input,
  });
}

/**
 * Fresh-reproduces every code-owned scaffold ByteBundle occurrence. This is a
 * shadow publication plan only; callers must still use the DB-first indexed
 * batch publisher before any deep verification or materialization.
 */
export function getCodeOwnedNodeScaffoldAssetPublicationV2():
Readonly<NodeScaffoldAssetPublicationV2> {
  const catalog = buildCodeOwnedNodeScaffoldToolchainCatalogV2();
  const files: NodeScaffoldAssetPublicationFileV2[] = [];
  const batches: Array<NodeScaffoldAssetPublicationV2["batches"][number]> = [];
  for (const descriptor of ENTRY_DESCRIPTORS_V2) {
    const items: Array<Readonly<{
      durabilityTier: 0 | 1;
      envelope: SemanticArtifactEnvelopeV1;
    }>> = [];
    const entry = catalog.entries.find((candidate) =>
      candidate.entryRef === descriptor.entryRef);
    if (!entry) {
      throw new NodeScaffoldToolchainCodeAuthorityErrorV2(
        `${descriptor.entryRef} is absent from the fresh scaffold catalog`,
      );
    }
    for (const definition of descriptorAssetDefinitionsV2(descriptor)) {
      const file = entry.scaffold.files.find((candidate) =>
        candidate.role === definition.role);
      if (!file) {
        throw new NodeScaffoldToolchainCodeAuthorityErrorV2(
          `${descriptor.entryRef} lacks ${definition.role}`,
        );
      }
      const produced = buildAssetByteBundleV2(
        definition.sourceExportRef,
        definition.text,
      );
      const expectedFile = buildAssetRefV2(definition);
      if (canonicalJsonStringify(file) !== canonicalJsonStringify(expectedFile)) {
        throw new NodeScaffoldToolchainCodeAuthorityErrorV2(
          `${descriptor.entryRef} ${definition.role} differs from fresh byte authority`,
        );
      }
      const subjectHash = nodeScaffoldAssetSubjectHashV2({
        catalogHash: catalog.catalogHash,
        entryRef: entry.entryRef,
        entryHash: entry.entryHash,
        profileId: descriptor.profileId,
        file,
      });
      const bindingIdentity = {
        authoritySchema: catalog.schema,
        authorityHash: catalog.catalogHash,
        subjectRef: `${entry.entryRef}/${definition.role}`,
        subjectHash,
      };
      files.push(Object.freeze({
        entryRef: entry.entryRef,
        entryHash: entry.entryHash,
        profileId: descriptor.profileId,
        role: definition.role,
        normalizedLocator: definition.normalizedLocator,
        sourceExportRef: definition.sourceExportRef,
        rawHash: produced.rawHash,
        rawByteLength: produced.rawByteLength,
        byteBundle: file.byteBundle,
        binding: {
          ...bindingIdentity,
          bindingHash: hashDeepByteBundleConsumerBindingV2(bindingIdentity),
        },
      }));
      produced.chunks.forEach((chunk) => items.push(Object.freeze({
        durabilityTier: 0,
        envelope: chunk.envelope,
      })));
      items.push(Object.freeze({
        durabilityTier: 1,
        envelope: produced.bundle.envelope,
      }));
    }
    const plan = deepFreezeJson({
      schema: ARTIFACT_STORE_BATCH_PLAN_SCHEMA_V1,
      items,
    });
    const prepared = prepareArtifactStoreBatchPlanV1(plan);
    batches.push(Object.freeze({
      profileId: descriptor.profileId,
      planIdentityHash: prepared.planIdentityHash,
      plan,
    }));
  }
  return deepFreezeJson({
    schema: NODE_SCAFFOLD_ASSET_PUBLICATION_V2_SCHEMA,
    catalogHash: catalog.catalogHash,
    assetCodeSha: catalog.sourceAuthority.codeSha,
    fileCount: files.length,
    files,
    batchCount: batches.length,
    batches,
  });
}

/** Fresh code-owned selection prevents valid cross-profile bundle substitution. */
export async function verifyCodeOwnedNodeScaffoldAssetByteBundleV2(
  input: Readonly<{
    authority: DeepByteBundleCasAuthorityV2;
    profileId: NodeScaffoldProfileIdV2;
    role: NodeScaffoldAssetRoleV2;
  }>,
): Promise<VerifiedDeepByteBundleV2> {
  const publication = getCodeOwnedNodeScaffoldAssetPublicationV2();
  const file = publication.files.find((candidate) =>
    candidate.profileId === input.profileId && candidate.role === input.role);
  if (!file) {
    throw new NodeScaffoldToolchainCodeAuthorityErrorV2(
      `No code-owned scaffold bundle exists for ${String(input.profileId)}/${String(input.role)}`,
    );
  }
  return verifyDeepByteBundleFromCasV2({
    authority: input.authority,
    binding: file.binding,
    bundle: file.byteBundle,
  });
}

export type NodeScaffoldToolchainCatalogVerificationErrorCodeV2 =
  | "NODE_SCAFFOLD_TOOLCHAIN_CATALOG_V2_CANDIDATE_INVALID"
  | "NODE_SCAFFOLD_TOOLCHAIN_CATALOG_V2_AUTHORITY_MISMATCH"
  | "NODE_SCAFFOLD_TOOLCHAIN_CATALOG_V2_CODE_AUTHORITY_DRIFT";

export class NodeScaffoldToolchainCatalogVerificationErrorV2 extends Error {
  readonly code: NodeScaffoldToolchainCatalogVerificationErrorCodeV2;

  constructor(
    code: NodeScaffoldToolchainCatalogVerificationErrorCodeV2,
    message: string,
  ) {
    super(message.slice(0, 1_000));
    this.name = "NodeScaffoldToolchainCatalogVerificationErrorV2";
    this.code = code;
  }
}

export function verifyNodeScaffoldToolchainCatalogV2(
  candidate: unknown,
): Readonly<NodeScaffoldToolchainCatalogV2> {
  const parsed = NodeScaffoldToolchainCatalogV2Schema.safeParse(candidate);
  if (!parsed.success) {
    throw new NodeScaffoldToolchainCatalogVerificationErrorV2(
      "NODE_SCAFFOLD_TOOLCHAIN_CATALOG_V2_CANDIDATE_INVALID",
      parsed.error.issues[0]?.message ?? "Scaffold catalog candidate is invalid",
    );
  }
  let reproduced: NodeScaffoldToolchainCatalogV2;
  try {
    reproduced = buildCodeOwnedNodeScaffoldToolchainCatalogV2();
  } catch (error) {
    throw new NodeScaffoldToolchainCatalogVerificationErrorV2(
      "NODE_SCAFFOLD_TOOLCHAIN_CATALOG_V2_CODE_AUTHORITY_DRIFT",
      errorMessage(error),
    );
  }
  if (canonicalJsonStringify(parsed.data) !== canonicalJsonStringify(reproduced)) {
    throw new NodeScaffoldToolchainCatalogVerificationErrorV2(
      "NODE_SCAFFOLD_TOOLCHAIN_CATALOG_V2_AUTHORITY_MISMATCH",
      "Scaffold catalog candidate does not equal fresh code-owned byte, profile, layout, and lock authority",
    );
  }
  return reproduced;
}

const ResolutionCompilerInputV2Schema = z.object({
  productSpec: z.unknown(),
  deliverySelection: z.unknown(),
}).strict();

const ResolutionVerifierInputV2Schema = z.object({
  productSpec: z.unknown(),
  deliverySelection: z.unknown(),
  candidate: z.unknown(),
}).strict();

export type NodeScaffoldToolchainResolutionDiagnosticCodeV2 =
  | "NODE_SCAFFOLD_TOOLCHAIN_V2_INPUT_INVALID"
  | "NODE_SCAFFOLD_TOOLCHAIN_V2_LAYOUT_REJECTED"
  | "NODE_SCAFFOLD_TOOLCHAIN_V2_PATH_TOKEN_REJECTED"
  | "NODE_SCAFFOLD_TOOLCHAIN_V2_SEMANTIC_PATH_TOKEN_REJECTED"
  | "NODE_SCAFFOLD_TOOLCHAIN_V2_CODE_AUTHORITY_DRIFT"
  | "NODE_SCAFFOLD_TOOLCHAIN_V2_ENTRY_UNRESOLVED"
  | "NODE_SCAFFOLD_TOOLCHAIN_V2_AUTHORITY_MISMATCH"
  | "NODE_SCAFFOLD_TOOLCHAIN_V2_ARTIFACT_INVALID";

export type NodeScaffoldToolchainResolutionDiagnosticV2 = Readonly<{
  code: NodeScaffoldToolchainResolutionDiagnosticCodeV2;
  path: string;
  message: string;
}>;

export type NodeScaffoldToolchainResolutionResultV2 =
  | Readonly<{
      status: "shadow_resolved";
      diagnostics: readonly [];
      resolution: Readonly<NodeScaffoldToolchainResolutionV2>;
      entry: Readonly<NodeScaffoldToolchainEntryV2>;
      catalogHash: string;
      canonicalBytes: string;
    }>
  | Readonly<{
      status: "rejected";
      diagnostics: readonly NodeScaffoldToolchainResolutionDiagnosticV2[];
    }>;

function diagnostic(
  code: NodeScaffoldToolchainResolutionDiagnosticCodeV2,
  path: string,
  message: string,
): NodeScaffoldToolchainResolutionDiagnosticV2 {
  return Object.freeze({
    code,
    path: path.slice(0, 500),
    message: message.slice(0, 1_000),
  });
}

function rejected(
  code: NodeScaffoldToolchainResolutionDiagnosticCodeV2,
  path: string,
  message: string,
): NodeScaffoldToolchainResolutionResultV2 {
  return deepFreezeJson({
    status: "rejected" as const,
    diagnostics: [diagnostic(code, path, message)].slice(0, MAX_DIAGNOSTICS),
  });
}

function requireToken(
  tokenSet: NodeExecutionPathTokenSetV2,
  slotRef: string,
) {
  const token = tokenSet.tokens.find((candidate) =>
    candidate.origin.slotRef === slotRef);
  if (!token || token.disposition !== "planned") {
    throw new NodeScaffoldToolchainCodeAuthorityErrorV2(
      `Fresh PathTokenSetV2 lacks planned slot ${slotRef}`,
    );
  }
  return token;
}

function requireSelectedEntrypointRequirements(
  semanticSet: SemanticSourcePathTokenSetV2,
  expectedKind: "cli" | "api",
): readonly SemanticSourceExternalPathRequirementV2[] {
  if (
    semanticSet.externalRequirements.length < 1
    || semanticSet.externalRequirements.some((requirement) =>
      requirement.expectation.kind !== "shared_structural_selected_entrypoint"
      || requirement.expectation.entrypointKind !== expectedKind
      || requirement.expectation.requiredAuthority
        !== "node_execution_path_token_v2")
  ) {
    throw new NodeScaffoldToolchainCodeAuthorityErrorV2(
      "Current Node semantic requirements are not exclusively selected-entrypoint requirements",
    );
  }
  return semanticSet.externalRequirements;
}

function buildResolutionV2(
  layout: NodeExecutionLayoutV2,
  pathTokenSet: NodeExecutionPathTokenSetV2,
  semanticSet: SemanticSourcePathTokenSetV2,
  catalog: NodeScaffoldToolchainCatalogV2,
): Readonly<{
  resolution: NodeScaffoldToolchainResolutionV2;
  entry: NodeScaffoldToolchainEntryV2;
}> {
  const entry = catalog.entries.find((candidate) =>
    candidate.profileBinding.profileId === layout.profileBinding.profileId);
  if (!entry) {
    throw new NodeScaffoldToolchainCodeAuthorityErrorV2(
      "Fresh layout has no exact scaffold toolchain entry",
    );
  }
  if (
    entry.layoutBinding.layoutHash !== layout.layoutHash
    || entry.layoutBinding.pathSlotSetHash !== layout.pathSlots.slotSetHash
    || pathTokenSet.sourceAuthority.slotSetHash !== layout.pathSlots.slotSetHash
    || semanticSet.sourceAuthority.profileId !== entry.profileBinding.profileId
    || semanticSet.sourceAuthority.stackPackId !== entry.profileBinding.stackPackId
    || semanticSet.sourceAuthority.semanticRuleSetHash
      !== entry.sourceGeneration.currentSemanticRulesCompatibility.ruleSetHash
  ) {
    throw new NodeScaffoldToolchainCodeAuthorityErrorV2(
      "Fresh scaffold, layout, path-token, and semantic authorities disagree",
    );
  }
  const fileBindings = entry.scaffold.files.map((file) => {
    const token = requireToken(pathTokenSet, file.pathSlotRef);
    if (token.normalizedLocator !== file.normalizedLocator) {
      throw new NodeScaffoldToolchainCodeAuthorityErrorV2(
        `Scaffold ${file.role} locator differs from its fresh PathTokenV2`,
      );
    }
    return {
      role: file.role,
      pathSlotRef: file.pathSlotRef,
      pathToken: token.pathToken,
      tokenBindingHash: token.bindingHash,
      normalizedLocator: file.normalizedLocator,
      rawHash: file.rawHash,
      byteBundleEnvelopeHash: file.byteBundle.envelopeHash,
    };
  });
  const sourceToken = requireToken(
    pathTokenSet,
    entry.sourceGeneration.canonicalEntrypointPathSlotRef,
  );
  const entrypointKind = entry.kind === "cli" ? "cli" as const : "api" as const;
  const requirements = requireSelectedEntrypointRequirements(
    semanticSet,
    entrypointKind,
  );
  const semanticRequirementBindings = requirements.map((requirement) => ({
    intentRef: requirement.intentRef,
    requirementHash: requirement.requirementHash,
    ruleRef: requirement.ruleRef,
    responsibility: requirement.responsibility,
    expectationKind: "shared_structural_selected_entrypoint" as const,
    entrypointKind,
    requiredAuthority: "node_execution_path_token_v2" as const,
    resolvedPathSlotRef:
      entry.sourceGeneration.canonicalEntrypointPathSlotRef,
    resolvedPathToken: sourceToken.pathToken,
    resolvedTokenBindingHash: sourceToken.bindingHash,
    compatibilityStatus:
      "current_v1_rule_unmigrated_v2_activation_forbidden" as const,
  })).sort((left, right) => compareUtf16(left.intentRef, right.intentRef));
  const identity: NodeScaffoldToolchainResolutionHashPayloadV2 = {
    schema: NODE_SCAFFOLD_TOOLCHAIN_RESOLUTION_V2_SCHEMA,
    resolutionVersion: NODE_SCAFFOLD_TOOLCHAIN_CATALOG_VERSION_V2,
    readiness: readinessV2(),
    sourceAuthority: {
      productRef: semanticSet.sourceAuthority.productRef,
      productSpecHash: semanticSet.sourceAuthority.productSpecHash,
      deliverySelectionHash: semanticSet.sourceAuthority.deliverySelectionHash,
      profileId: semanticSet.sourceAuthority.profileId,
      stackPackId: semanticSet.sourceAuthority.stackPackId,
      layoutHash: layout.layoutHash,
      pathTokenContractVersion: pathTokenSet.pathTokenContractVersion,
      pathTokenContractHash: pathTokenSet.pathTokenContractHash,
      pathTokenSetVersion: pathTokenSet.tokenSetVersion,
      pathTokenSetHash: pathTokenSet.tokenSetHash,
      semanticPathTokenContractVersion: "2.0.0",
      semanticPathTokenContractHash: semanticSet.tokenContractHash,
      semanticPathTokenSetVersion: semanticSet.setVersion,
      semanticPathTokenSetContractHash: semanticSet.setContractHash,
      semanticPathTokenSetHash: semanticSet.setHash,
      semanticRuleSetHash: semanticSet.sourceAuthority.semanticRuleSetHash,
    },
    catalogBinding: {
      catalogVersion: catalog.catalogVersion,
      catalogHash: catalog.catalogHash,
      entryRef: entry.entryRef,
      entryHash: entry.entryHash,
    },
    fileBindingCount: 3,
    fileBindings,
    selectedEntrypoint: {
      pathSlotRef: entry.sourceGeneration.canonicalEntrypointPathSlotRef,
      pathToken: sourceToken.pathToken,
      tokenBindingHash: sourceToken.bindingHash,
      normalizedLocator: sourceToken.normalizedLocator as "src/cli.ts" | "src/app.ts",
      requiredBaseState: "absent",
      finalOwnerRef: "NODE_ENTRYPOINT_GENERATOR_V2",
      modelWriteAuthority: "forbidden",
    },
    semanticRequirementBindingCount: semanticRequirementBindings.length,
    semanticRequirementBindings,
    semanticRequirementMembershipHash:
      hashNodeScaffoldSemanticRequirementMembershipV2(
        semanticRequirementBindings,
      ),
  };
  const parsed = NodeScaffoldToolchainResolutionV2Schema.safeParse({
    ...identity,
    resolutionHash: hashNodeScaffoldToolchainResolutionV2(identity),
  });
  if (!parsed.success) {
    throw new NodeScaffoldToolchainCodeAuthorityErrorV2(
      parsed.error.issues[0]?.message ?? "Scaffold resolution artifact is invalid",
    );
  }
  return deepFreezeJson({ resolution: parsed.data, entry });
}

export function resolveNodeScaffoldToolchainV2(
  input: unknown,
): NodeScaffoldToolchainResolutionResultV2 {
  let snapshot: unknown;
  try {
    snapshot = boundedSnapshot(
      input,
      COMPILER_INPUT_MAX_BYTES,
      COMPILER_BOUNDED_WORK_LIMITS,
    );
  } catch (error) {
    return rejected(
      "NODE_SCAFFOLD_TOOLCHAIN_V2_INPUT_INVALID",
      "/",
      errorMessage(error),
    );
  }
  const outer = ResolutionCompilerInputV2Schema.safeParse(snapshot);
  if (!outer.success) {
    return rejected(
      "NODE_SCAFFOLD_TOOLCHAIN_V2_INPUT_INVALID",
      `/${outer.error.issues[0]?.path.map(String).join("/") ?? ""}`
        .replace(/\/$/u, "") || "/",
      outer.error.issues[0]?.message ?? "Scaffold resolver input is invalid",
    );
  }
  const layoutResult = resolveNodeExecutionLayoutV2({
    productSpec: outer.data.productSpec,
    deliverySelection: outer.data.deliverySelection,
  });
  if (layoutResult.status !== "shadow_resolved") {
    return rejected(
      "NODE_SCAFFOLD_TOOLCHAIN_V2_LAYOUT_REJECTED",
      layoutResult.diagnostics[0]?.path ?? "/",
      layoutResult.diagnostics[0]?.message ?? "Fresh Node layout was rejected",
    );
  }
  const pathResult = compileNodeExecutionPathTokenSetV2({
    productSpec: outer.data.productSpec,
    deliverySelection: outer.data.deliverySelection,
  });
  if (pathResult.status !== "shadow_compiled") {
    return rejected(
      "NODE_SCAFFOLD_TOOLCHAIN_V2_PATH_TOKEN_REJECTED",
      pathResult.diagnostics[0]?.path ?? "/",
      pathResult.diagnostics[0]?.message ?? "Fresh Node PathTokenV2 was rejected",
    );
  }
  const semanticResult = compileSemanticSourcePathTokenSetV2({
    productSpec: outer.data.productSpec,
    deliverySelection: outer.data.deliverySelection,
  });
  if (semanticResult.status !== "shadow_compiled") {
    return rejected(
      "NODE_SCAFFOLD_TOOLCHAIN_V2_SEMANTIC_PATH_TOKEN_REJECTED",
      semanticResult.diagnostics[0]?.path ?? "/",
      semanticResult.diagnostics[0]?.message
        ?? "Fresh semantic source PathTokenV2 was rejected",
    );
  }
  try {
    const catalog = buildCodeOwnedNodeScaffoldToolchainCatalogV2();
    const built = buildResolutionV2(
      layoutResult.layout,
      pathResult.value,
      semanticResult.value,
      catalog,
    );
    return deepFreezeJson({
      status: "shadow_resolved" as const,
      diagnostics: EMPTY_DIAGNOSTICS,
      resolution: built.resolution,
      entry: built.entry,
      catalogHash: catalog.catalogHash,
      canonicalBytes: canonicalJsonStringify(built.resolution),
    });
  } catch (error) {
    return rejected(
      error instanceof NodeScaffoldToolchainCodeAuthorityErrorV2
        ? "NODE_SCAFFOLD_TOOLCHAIN_V2_CODE_AUTHORITY_DRIFT"
        : "NODE_SCAFFOLD_TOOLCHAIN_V2_ARTIFACT_INVALID",
      "/",
      errorMessage(error),
    );
  }
}

export type NodeScaffoldToolchainResolutionVerificationErrorCodeV2 =
  | "NODE_SCAFFOLD_TOOLCHAIN_V2_VERIFICATION_INPUT_INVALID"
  | "NODE_SCAFFOLD_TOOLCHAIN_V2_VERIFICATION_CANDIDATE_INVALID"
  | "NODE_SCAFFOLD_TOOLCHAIN_V2_VERIFICATION_REPRODUCTION_REJECTED"
  | "NODE_SCAFFOLD_TOOLCHAIN_V2_VERIFICATION_AUTHORITY_MISMATCH";

export class NodeScaffoldToolchainResolutionVerificationErrorV2 extends Error {
  readonly code: NodeScaffoldToolchainResolutionVerificationErrorCodeV2;

  constructor(
    code: NodeScaffoldToolchainResolutionVerificationErrorCodeV2,
    message: string,
  ) {
    super(message.slice(0, 1_000));
    this.name = "NodeScaffoldToolchainResolutionVerificationErrorV2";
    this.code = code;
  }
}

export type VerifiedShadowNodeScaffoldToolchainResolutionV2 = Readonly<{
  status: "verified_shadow";
  resolution: Readonly<NodeScaffoldToolchainResolutionV2>;
  entry: Readonly<NodeScaffoldToolchainEntryV2>;
  catalogHash: string;
  canonicalBytes: string;
}>;

export function verifyNodeScaffoldToolchainResolutionV2(
  input: unknown,
): VerifiedShadowNodeScaffoldToolchainResolutionV2 {
  let snapshot: unknown;
  try {
    snapshot = boundedSnapshot(
      input,
      VERIFIER_INPUT_MAX_BYTES,
      VERIFIER_BOUNDED_WORK_LIMITS,
    );
  } catch (error) {
    throw new NodeScaffoldToolchainResolutionVerificationErrorV2(
      "NODE_SCAFFOLD_TOOLCHAIN_V2_VERIFICATION_INPUT_INVALID",
      errorMessage(error),
    );
  }
  const outer = ResolutionVerifierInputV2Schema.safeParse(snapshot);
  if (!outer.success) {
    throw new NodeScaffoldToolchainResolutionVerificationErrorV2(
      "NODE_SCAFFOLD_TOOLCHAIN_V2_VERIFICATION_INPUT_INVALID",
      outer.error.issues[0]?.message ?? "Scaffold verification input is invalid",
    );
  }
  const candidate = NodeScaffoldToolchainResolutionV2Schema.safeParse(
    outer.data.candidate,
  );
  if (!candidate.success) {
    throw new NodeScaffoldToolchainResolutionVerificationErrorV2(
      "NODE_SCAFFOLD_TOOLCHAIN_V2_VERIFICATION_CANDIDATE_INVALID",
      candidate.error.issues[0]?.message ?? "Scaffold resolution candidate is invalid",
    );
  }
  const reproduced = resolveNodeScaffoldToolchainV2({
    productSpec: outer.data.productSpec,
    deliverySelection: outer.data.deliverySelection,
  });
  if (reproduced.status !== "shadow_resolved") {
    throw new NodeScaffoldToolchainResolutionVerificationErrorV2(
      "NODE_SCAFFOLD_TOOLCHAIN_V2_VERIFICATION_REPRODUCTION_REJECTED",
      reproduced.diagnostics[0]?.message
        ?? "Fresh scaffold resolution was rejected",
    );
  }
  if (
    canonicalJsonStringify(candidate.data)
    !== canonicalJsonStringify(reproduced.resolution)
  ) {
    throw new NodeScaffoldToolchainResolutionVerificationErrorV2(
      "NODE_SCAFFOLD_TOOLCHAIN_V2_VERIFICATION_AUTHORITY_MISMATCH",
      "Scaffold resolution candidate does not equal fresh ProductSpec, layout, path, semantic, and code-owned asset authority",
    );
  }
  return deepFreezeJson({
    status: "verified_shadow" as const,
    resolution: reproduced.resolution,
    entry: reproduced.entry,
    catalogHash: reproduced.catalogHash,
    canonicalBytes: reproduced.canonicalBytes,
  });
}
