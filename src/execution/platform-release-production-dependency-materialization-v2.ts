import {
  lstatSync,
  mkdirSync,
  realpathSync,
  rmSync,
  readdirSync,
} from "node:fs";
import path from "node:path";

import {
  canonicalJsonStringify,
  hashCanonicalJson,
} from "../product-compiler/canonical-json.js";
import {
  captureRawNpmInstallTreeInternalV2,
  deriveExpectedNpmBinsInternalV2,
  getNodeScaffoldRuntimeMetadataProbeInternalV2,
  isPlainNpmLockRecordInternalV2,
  normalizeNodeScaffoldRuntimeMetadataInternalV2,
  parseNpmLockJsonObjectInternalV2,
  readExactNpmLockRegularFileInternalV2,
  sealNpmDependencyTreeInternalV2,
  assertSealedOwnedNpmDependencyTreeInternalV2,
  validateEveryAndOnlyNpmPackageRootsInternalV2,
  validateNpmBinSurfaceInternalV2,
  NodeScaffoldProductionMaterializationErrorV2,
  type NpmLockDependencyCapsuleAdmissionScopeV2,
  type NodeScaffoldProductionMaterializationErrorCodeV2,
  type RawNpmInstallEntryInternalV2,
} from
  "../product-compiler/node-scaffold-production-materialization-v2.js";
import {
  nodeScaffoldPackageNameFromLockPathV2,
  nodeScaffoldVersionSatisfiesSpecV2,
  resolveNodeScaffoldDependencyPathV2,
} from
  "../product-compiler/schemas/node-scaffold-toolchain-catalog-v2.js";
import {
  isCanonicalNpmExactVersionV2,
  isCanonicalNpmLockPackagePathV2,
  isCanonicalNpmPackageNameV2,
  isSupportedNpmDependencySpecV2,
} from
  "../product-compiler/schemas/npm-lock-v3-grammar-v2.js";
import {
  captureCanonicalRuntimeTreeV2,
  captureCanonicalRuntimeTreeV2ForTest,
  verifyCanonicalRuntimeTreeV2,
  CanonicalRuntimeTreeV2Error,
} from "./canonical-runtime-tree-v2.js";
import {
  derivePlatformReleaseSourceLockAuthorityInternalV2,
  PlatformReleaseBuildToolchainMaterializationErrorV2,
  validatePlatformReleaseSourceLockAuthorityInternalV2,
  type PlatformReleaseBuildToolchainMaterializationErrorCodeV2,
  type PlatformReleaseSourceLockAuthorityV2,
  type PlatformReleaseBuildToolchainLockPackageV2,
} from
  "./platform-release-build-toolchain-materialization-v2.js";
import {
  EXACT_SOURCE_FILE_REF_V2_SCHEMA,
  NPM_MATERIALIZATION_RECEIPT_V2_SCHEMA,
  NPM_PRODUCTION_MATERIALIZATION_RECIPE_V2,
  PRODUCTION_PACKAGE_RESOLUTION_ENTRY_V2_SCHEMA,
  PRODUCTION_PACKAGE_RESOLUTION_GRAPH_V2_SCHEMA,
  NpmMaterializationReceiptCandidateV2Schema,
  ProductionPackageResolutionGraphV2Schema,
  hashNpmMaterializationReceiptV2,
  hashProductionPackageResolutionGraphV2,
  type NpmMaterializationReceiptCandidateV2,
  type ProductionPackageResolutionEntryV2,
  type ProductionPackageResolutionGraphHashPayloadV2,
  type ProductionPackageResolutionGraphV2,
} from "./schemas/external-runtime-resolution-v2.js";
import {
  type CanonicalRuntimeTreeV2,
} from "./schemas/canonical-runtime-tree-v2.js";
import {
  type PlatformReleaseSourceTreeBindingV2,
} from "./schemas/platform-release-build-v2.js";
import {
  type PlatformReleaseHostNodeToolchainReceiptV2,
} from "./schemas/platform-release-host-node-toolchain-v2.js";
import {
  CANONICAL_RUNTIME_TREE_BINDING_V2_SCHEMA,
  CanonicalRuntimeDependencyTreeBindingCandidateV2Schema,
  hashCanonicalRuntimeTreeBindingV2,
  type CanonicalRuntimeDependencyTreeBindingCandidateV2,
} from "./schemas/platform-runtime-payload-v2.js";
import {
  deepFreezePlatformReleaseJsonV2,
} from "./schemas/platform-release-common-v2.js";
import {
  PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_MATERIALIZATION_CONTRACT_HASH_V2,
  PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_MATERIALIZATION_CONTRACT_V2,
  PlatformReleaseProductionClosureV2Schema,
  createPlatformReleaseProductionClosureV2,
  hashPlatformReleaseProductionEdgeMembershipV2,
  hashPlatformReleaseProductionPackageMembershipV2,
  hashPlatformReleaseProductionRootMembershipV2,
  type PlatformReleaseProductionClosureV2,
  type PlatformReleaseProductionDependencyEdgeV2,
} from "./schemas/platform-release-production-closure-v2.js";

const PACKAGE_JSON_MAX_BYTES_V2 = 4 * 1024 * 1024;
const LOCK_MAX_BYTES_V2 = 32 * 1024 * 1024;
const MAX_DEPENDENCIES_PER_PACKAGE_V2 = 256;

export {
  PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_MATERIALIZATION_CONTRACT_HASH_V2,
  PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_MATERIALIZATION_CONTRACT_V2,
};

export type PlatformReleaseProductionDependencyMaterializationErrorCodeV2 =
  | "PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_V2_INPUT_INVALID"
  | "PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_V2_LOCK_INVALID"
  | "PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_V2_CLOSURE_INVALID"
  | "PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_V2_INSTALL_TREE_INVALID"
  | "PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_V2_NORMALIZATION_FAILED"
  | "PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_V2_GRAPH_INVALID"
  | "PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_V2_AUTHORITY_MISMATCH";

export class PlatformReleaseProductionDependencyMaterializationErrorV2
  extends Error {
  readonly code:
    PlatformReleaseProductionDependencyMaterializationErrorCodeV2;
  override readonly cause?: unknown;

  constructor(
    code:
      PlatformReleaseProductionDependencyMaterializationErrorCodeV2,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message.slice(0, 1_500), options);
    this.name =
      "PlatformReleaseProductionDependencyMaterializationErrorV2";
    this.code = code;
    this.cause = options?.cause;
  }
}

type JsonRecordV2 = Readonly<Record<string, unknown>>;

export type PlatformReleaseProductionDependencyMaterializationV2 =
  Readonly<{
    lockAuthority:
      PlatformReleaseSourceLockAuthorityV2;
    productionClosure:
      PlatformReleaseProductionClosureV2;
    hiddenLockRawHash: string | null;
    rawInstallMembershipHash: string;
    installedPackageMembershipHash: string;
    dependencyTree: CanonicalRuntimeTreeV2;
    dependencyTreeBinding:
      CanonicalRuntimeDependencyTreeBindingCandidateV2;
    productionGraph: ProductionPackageResolutionGraphV2;
    materializationReceipt:
      NpmMaterializationReceiptCandidateV2;
  }>;

export type PlatformReleaseProductionDependencyVerificationV2 =
  Readonly<{
    dependencyTree: CanonicalRuntimeTreeV2;
    dependencyTreeBinding:
      CanonicalRuntimeDependencyTreeBindingCandidateV2;
    productionGraph: ProductionPackageResolutionGraphV2;
    materializationReceipt:
      NpmMaterializationReceiptCandidateV2;
  }>;

function fail(
  code:
    PlatformReleaseProductionDependencyMaterializationErrorCodeV2,
  message: string,
  cause?: unknown,
): never {
  throw new PlatformReleaseProductionDependencyMaterializationErrorV2(
    code,
    message,
    cause === undefined ? undefined : { cause },
  );
}

function compareUtf16(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sameStrings(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return left.length === right.length
    && left.every((entry, index) => entry === right[index]);
}

function exactStringMap(
  value: unknown,
  label: string,
): Readonly<Record<string, string>> {
  if (value === undefined) return Object.freeze({});
  if (!isPlainNpmLockRecordInternalV2(value)) {
    return fail(
      "PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_V2_LOCK_INVALID",
      `${label} must be one plain string map`,
    );
  }
  const keys = Object.keys(value).sort(compareUtf16);
  if (keys.length > MAX_DEPENDENCIES_PER_PACKAGE_V2) {
    return fail(
      "PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_V2_LOCK_INVALID",
      `${label} exceeds its fixed dependency count`,
    );
  }
  const result: Record<string, string> = {};
  for (const key of keys) {
    const candidate = value[key];
    if (
      !isCanonicalNpmPackageNameV2(key)
      || !isSupportedNpmDependencySpecV2(candidate)
    ) {
      return fail(
        "PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_V2_LOCK_INVALID",
        `${label} contains an unsafe package name or version spec`,
      );
    }
    result[key] = candidate;
  }
  return Object.freeze(result);
}

function exactStringArray(
  value: unknown,
  label: string,
): readonly string[] | undefined {
  if (value === undefined) return undefined;
  if (
    !Array.isArray(value)
    || value.length < 1
    || value.length > 100
    || value.some((entry) =>
      typeof entry !== "string"
      || entry.length < 1
      || entry.length > 100)
    || (
      value.includes("any")
      && (
        value.length !== 1
        || value[0] !== "any"
      )
    )
  ) {
    return fail(
      "PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_V2_LOCK_INVALID",
      `${label} is not one bounded selector list`,
    );
  }
  return Object.freeze([...value] as string[]);
}

function selectorAllows(
  selectors: readonly string[] | undefined,
  current: string,
): boolean {
  if (!selectors) return true;
  if (selectors.length === 1 && selectors[0] === "any") {
    return true;
  }
  const positive = selectors.filter((entry) =>
    !entry.startsWith("!"));
  if (selectors.includes(`!${current}`)) return false;
  return positive.length === 0
    || positive.includes(current);
}

function packageIsEligible(
  entry: JsonRecordV2,
  hostPlatform: string,
  hostArchitecture: string,
): boolean {
  if (
    entry.dev !== undefined
    && typeof entry.dev !== "boolean"
  ) {
    return fail(
      "PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_V2_LOCK_INVALID",
      "Reached production package has a malformed development-only marker",
    );
  }
  if (entry.dev === true) {
    return fail(
      "PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_V2_CLOSURE_INVALID",
      "Reached production closure contains a development-only lock package",
    );
  }
  if (entry.libc !== undefined) {
    return fail(
      "PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_V2_CLOSURE_INVALID",
      "Reached production package declares libc selectors without a separate Darwin libc authority",
    );
  }
  return selectorAllows(
    exactStringArray(entry.os, "Production package os"),
    hostPlatform,
  ) && selectorAllows(
    exactStringArray(entry.cpu, "Production package cpu"),
    hostArchitecture,
  );
}

function validateLockPackage(
  packagePath: string,
  candidate: unknown,
): PlatformReleaseBuildToolchainLockPackageV2 {
  if (
    !isCanonicalNpmLockPackagePathV2(packagePath)
    || !isPlainNpmLockRecordInternalV2(candidate)
  ) {
    return fail(
      "PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_V2_LOCK_INVALID",
      `Production lock package ${packagePath} is malformed`,
    );
  }
  const packageName =
    nodeScaffoldPackageNameFromLockPathV2(packagePath);
  if (
    !packageName
    || typeof candidate.version !== "string"
    || !isCanonicalNpmExactVersionV2(candidate.version)
    || typeof candidate.resolved !== "string"
    || !candidate.resolved.startsWith(
      "https://registry.npmjs.org/",
    )
    || typeof candidate.integrity !== "string"
    || !/^sha512-[A-Za-z0-9+/]+={0,2}$/u
      .test(candidate.integrity)
    || (
      candidate.dev !== undefined
      && typeof candidate.dev !== "boolean"
    )
    || candidate.dev === true
    || (
      candidate.optional !== undefined
      && typeof candidate.optional !== "boolean"
    )
    || (
      candidate.hasInstallScript !== undefined
      && typeof candidate.hasInstallScript !== "boolean"
    )
    || candidate.link !== undefined
    || candidate.peer === true
    || candidate.peerDependencies !== undefined
    || candidate.peerDependenciesMeta !== undefined
  ) {
    return fail(
      "PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_V2_LOCK_INVALID",
      `Production lock package ${packagePath} violates release policy`,
    );
  }
  exactStringMap(
    candidate.dependencies,
    `${packagePath} dependencies`,
  );
  exactStringMap(
    candidate.optionalDependencies,
    `${packagePath} optional dependencies`,
  );
  exactStringArray(candidate.os, `${packagePath} os`);
  exactStringArray(candidate.cpu, `${packagePath} cpu`);
  exactStringArray(candidate.libc, `${packagePath} libc`);
  return Object.freeze({
    packagePath,
    packageName,
    version: candidate.version,
    lockEntryHash: hashCanonicalJson(candidate),
  });
}

function resolveRequiredEdge(input: Readonly<{
  installedPaths: ReadonlySet<string>;
  packages: JsonRecordV2;
  ownerPackagePath: string;
  dependencyName: string;
  declaredSpec: string;
}>): string {
  const resolved = resolveNodeScaffoldDependencyPathV2(
    input.installedPaths,
    input.ownerPackagePath,
    input.dependencyName,
  );
  const entry = resolved
    ? input.packages[resolved]
    : undefined;
  if (
    !resolved
    || !isPlainNpmLockRecordInternalV2(entry)
    || typeof entry.version !== "string"
    || !nodeScaffoldVersionSatisfiesSpecV2(
      entry.version,
      input.declaredSpec,
    )
  ) {
    return fail(
      "PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_V2_CLOSURE_INVALID",
      `Required production edge ${
        input.ownerPackagePath || "<root>"
      } -> ${input.dependencyName} is absent or incompatible`,
    );
  }
  return resolved;
}

function buildProductionClosure(input: Readonly<{
  lockAuthority:
    PlatformReleaseSourceLockAuthorityV2;
  installedPaths: readonly string[];
  hostPlatform: string;
  hostArchitecture: string;
}>): PlatformReleaseProductionClosureV2 {
  if (input.lockAuthority.purpose !== "production_runtime") {
    return fail(
      "PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_V2_LOCK_INVALID",
      "Production closure requires a production-runtime lock authority",
    );
  }
  if (
    input.installedPaths.length
      > PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_MATERIALIZATION_CONTRACT_V2
        .maxPackages
    || !sameStrings(
      input.installedPaths,
      [...input.installedPaths].sort(compareUtf16),
    )
    || new Set(input.installedPaths).size
      !== input.installedPaths.length
  ) {
    return fail(
      "PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_V2_CLOSURE_INVALID",
      "Production closure package membership exceeds its bound or is not canonical",
    );
  }
  const installed = new Set(input.installedPaths);
  const reached = new Set<string>();
  const pending: string[] = [];
  const edges:
    PlatformReleaseProductionDependencyEdgeV2[] = [];

  const pushRequiredMap = (
    ownerPackagePath: string,
    dependencies: Readonly<Record<string, string>>,
  ): void => {
    for (
      const [dependencyName, declaredSpec]
      of Object.entries(dependencies).sort(([left], [right]) =>
        compareUtf16(left, right))
    ) {
      if (
        edges.length
          >= PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_MATERIALIZATION_CONTRACT_V2
            .maxDependencyEdges
      ) {
        return fail(
          "PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_V2_CLOSURE_INVALID",
          "Production closure dependency-edge limit exceeded",
        );
      }
      const resolvedPackagePath = resolveRequiredEdge({
        installedPaths: installed,
        packages: input.lockAuthority.packages,
        ownerPackagePath,
        dependencyName,
        declaredSpec,
      });
      edges.push(Object.freeze({
        ownerPackagePath,
        kind: "required" as const,
        dependencyName,
        declaredSpec,
        resolvedPackagePath,
      }));
      pending.push(resolvedPackagePath);
    }
  };

  const pushOptionalMap = (
    ownerPackagePath: string,
    dependencies: Readonly<Record<string, string>>,
  ): void => {
    for (
      const [dependencyName, declaredSpec]
      of Object.entries(dependencies).sort(([left], [right]) =>
        compareUtf16(left, right))
    ) {
      const resolvedPackagePath =
        resolveNodeScaffoldDependencyPathV2(
          installed,
          ownerPackagePath,
          dependencyName,
        );
      if (!resolvedPackagePath) continue;
      if (
        edges.length
          >= PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_MATERIALIZATION_CONTRACT_V2
            .maxDependencyEdges
      ) {
        return fail(
          "PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_V2_CLOSURE_INVALID",
          "Production closure dependency-edge limit exceeded",
        );
      }
      const entry =
        input.lockAuthority.packages[resolvedPackagePath];
      if (
        !isPlainNpmLockRecordInternalV2(entry)
        || typeof entry.version !== "string"
        || !nodeScaffoldVersionSatisfiesSpecV2(
          entry.version,
          declaredSpec,
        )
      ) {
        return fail(
          "PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_V2_CLOSURE_INVALID",
          `Installed optional production edge ${
            ownerPackagePath || "<root>"
          } -> ${dependencyName} is incompatible`,
        );
      }
      edges.push(Object.freeze({
        ownerPackagePath,
        kind: "optional" as const,
        dependencyName,
        declaredSpec,
        resolvedPackagePath,
      }));
      pending.push(resolvedPackagePath);
    }
  };

  const rootOptional = exactStringMap(
    input.lockAuthority.root.optionalDependencies,
    "Root optional dependencies",
  );
  const rootRequired = {
    ...exactStringMap(
      input.lockAuthority.root.dependencies,
      "Root runtime dependencies",
    ),
  };
  for (const name of Object.keys(rootOptional)) {
    delete rootRequired[name];
  }
  pushRequiredMap("", Object.freeze(rootRequired));
  pushOptionalMap("", rootOptional);

  while (pending.length > 0) {
    const packagePath = pending.pop()!;
    if (reached.has(packagePath)) continue;
    const entry = input.lockAuthority.packages[packagePath];
    if (
      !isPlainNpmLockRecordInternalV2(entry)
      || !packageIsEligible(
        entry,
        input.hostPlatform,
        input.hostArchitecture,
      )
    ) {
      return fail(
        "PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_V2_CLOSURE_INVALID",
        `Installed production package ${packagePath} is absent or host-ineligible`,
      );
    }
    reached.add(packagePath);
    const optional = exactStringMap(
      entry.optionalDependencies,
      `${packagePath} optional dependencies`,
    );
    const required = {
      ...exactStringMap(
        entry.dependencies,
        `${packagePath} dependencies`,
      ),
    };
    for (const name of Object.keys(optional)) {
      delete required[name];
    }
    pushRequiredMap(packagePath, Object.freeze(required));
    pushOptionalMap(packagePath, optional);
  }

  if (
    reached.size !== installed.size
    || input.installedPaths.some((entry) => !reached.has(entry))
  ) {
    return fail(
      "PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_V2_CLOSURE_INVALID",
      "Installed production package membership is not every-and-only the root-reachable required and observed-optional closure",
    );
  }
  const installedPackages = Object.freeze(
    input.installedPaths.map((packagePath) =>
      validateLockPackage(
        packagePath,
        input.lockAuthority.packages[packagePath],
      )),
  );
  edges.sort((left, right) =>
    compareUtf16(
      [
        left.ownerPackagePath,
        left.kind,
        left.dependencyName,
        left.resolvedPackagePath,
      ].join("\0"),
      [
        right.ownerPackagePath,
        right.kind,
        right.dependencyName,
        right.resolvedPackagePath,
      ].join("\0"),
    ));
  const rootDependencyLocators = Object.freeze(
    [...new Set(
      edges
        .filter((edge) => edge.ownerPackagePath === "")
        .map((edge) => edge.resolvedPackagePath),
    )].sort(compareUtf16),
  );
  const identity = {
    schema:
      "setfarm.platform-release-production-closure.v2" as const,
    version: "2.0.0" as const,
    contractHash:
      PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_MATERIALIZATION_CONTRACT_HASH_V2,
    lockAuthorityHash: input.lockAuthority.authorityHash,
    hostPlatform: input.hostPlatform,
    hostArchitecture: input.hostArchitecture,
    rootDependencyCount:
      rootDependencyLocators.length,
    rootDependencyLocators:
      [...rootDependencyLocators],
    installedPackageCount:
      installedPackages.length,
    installedPackages: [...installedPackages],
    edgeCount: edges.length,
    edges: [...edges],
    rootMembershipHash:
      hashPlatformReleaseProductionRootMembershipV2(
        rootDependencyLocators,
      ),
    installedPackageMembershipHash:
      hashPlatformReleaseProductionPackageMembershipV2(
        installedPackages,
      ),
    edgeMembershipHash:
      hashPlatformReleaseProductionEdgeMembershipV2(
        edges,
      ),
  };
  try {
    return createPlatformReleaseProductionClosureV2(
      identity,
    );
  } catch (error) {
    return fail(
      "PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_V2_CLOSURE_INVALID",
      "Production closure failed its strict bounded authority schema",
      error,
    );
  }
}

function readInstalledManifest(input: Readonly<{
  nodeModulesRoot: string;
  packagePath: string;
  expectedPackageName: string;
  expectedVersion: string;
  allowedModes?: readonly number[];
}>): Readonly<{
  contentHash: string;
  byteLength: number;
}> {
  const relativePath =
    input.packagePath.slice("node_modules/".length);
  const captured = readExactNpmLockRegularFileInternalV2({
    absolutePath: path.join(
      input.nodeModulesRoot,
      ...relativePath.split("/"),
      "package.json",
    ),
    label: `${input.packagePath}/package.json`,
    maxBytes: PACKAGE_JSON_MAX_BYTES_V2,
    allowedModes: input.allowedModes,
  });
  try {
    const manifest = parseNpmLockJsonObjectInternalV2(
      captured.bytes,
      `${input.packagePath}/package.json`,
    );
    if (
      manifest.name !== input.expectedPackageName
      || manifest.version !== input.expectedVersion
    ) {
      return fail(
        "PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_V2_INSTALL_TREE_INVALID",
        `Installed package identity differs for ${input.packagePath}`,
      );
    }
    return Object.freeze({
      contentHash: captured.contentHash,
      byteLength: captured.bytes.byteLength,
    });
  } finally {
    captured.bytes.fill(0);
  }
}

function validateHiddenLockAndInstalledPackages(input: Readonly<{
  projectRoot: string;
  nodeModulesRoot: string;
  lockAuthority:
    PlatformReleaseSourceLockAuthorityV2;
  rawEntries: readonly RawNpmInstallEntryInternalV2[];
  hostPlatform: string;
  hostArchitecture: string;
}>): Readonly<{
  hiddenLockRawHash: string;
  binDirectories: readonly string[];
  productionClosure: PlatformReleaseProductionClosureV2;
}> {
  const rootLock = readExactNpmLockRegularFileInternalV2({
    absolutePath: path.join(
      input.projectRoot,
      "package-lock.json",
    ),
    label: "Platform production package-lock.json",
    maxBytes: LOCK_MAX_BYTES_V2,
    allowedModes: [0o444],
  });
  const hiddenEntry = input.rawEntries.find((entry) =>
    entry.locator === ".package-lock.json");
  if (
    !hiddenEntry
    || hiddenEntry.type !== "file"
    || input.rawEntries.some((entry) =>
      entry.locator !== ".package-lock.json"
      && entry.locator.endsWith("/.package-lock.json"))
  ) {
    rootLock.bytes.fill(0);
    return fail(
      "PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_V2_LOCK_INVALID",
      "Production install lacks one exact root hidden npm lock",
    );
  }
  const hiddenLock = readExactNpmLockRegularFileInternalV2({
    absolutePath: path.join(
      input.nodeModulesRoot,
      ".package-lock.json",
    ),
    label: "Platform production npm hidden lock",
    maxBytes: LOCK_MAX_BYTES_V2,
  });
  try {
    if (
      rootLock.contentHash
        !== input.lockAuthority.lockRawHash
      || rootLock.bytes.byteLength
        !== input.lockAuthority.lockRawByteLength
      || hiddenEntry.contentHash !== hiddenLock.contentHash
    ) {
      return fail(
        "PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_V2_LOCK_INVALID",
        "Production root or hidden npm lock changed",
      );
    }
    const hidden = parseNpmLockJsonObjectInternalV2(
      hiddenLock.bytes,
      "Platform production npm hidden lock",
    );
    if (
      !sameStrings(
        Object.keys(hidden).sort(compareUtf16),
        [
          "lockfileVersion",
          "name",
          "packages",
          "requires",
          "version",
        ],
      )
      || hidden.lockfileVersion !== 3
      || hidden.requires !== true
      || hidden.name
        !== input.lockAuthority.rootPackageName
      || hidden.version
        !== input.lockAuthority.rootPackageVersion
      || !isPlainNpmLockRecordInternalV2(hidden.packages)
    ) {
      return fail(
        "PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_V2_LOCK_INVALID",
        "Production npm hidden lock root identity is not exact",
      );
    }
    const installedPaths =
      Object.keys(hidden.packages).sort(compareUtf16);
    if (
      installedPaths.length > 4_096
      || installedPaths.some((packagePath) =>
        !isCanonicalNpmLockPackagePathV2(packagePath))
    ) {
      return fail(
        "PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_V2_LOCK_INVALID",
        "Production hidden-lock membership is invalid or exceeds its cap",
      );
    }
    for (const packagePath of installedPaths) {
      const rootEntry =
        input.lockAuthority.packages[packagePath];
      const installedEntry = hidden.packages[packagePath];
      if (
        !isPlainNpmLockRecordInternalV2(rootEntry)
        || !isPlainNpmLockRecordInternalV2(installedEntry)
        || canonicalJsonStringify(rootEntry)
          !== canonicalJsonStringify(installedEntry)
      ) {
        return fail(
          "PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_V2_LOCK_INVALID",
          `Production hidden-lock entry differs for ${packagePath}`,
        );
      }
      const lockPackage = validateLockPackage(
        packagePath,
        rootEntry,
      );
      readInstalledManifest({
        nodeModulesRoot: input.nodeModulesRoot,
        packagePath,
        expectedPackageName: lockPackage.packageName,
        expectedVersion: lockPackage.version,
      });
    }
    validateEveryAndOnlyNpmPackageRootsInternalV2(
      input.nodeModulesRoot,
      input.rawEntries,
      installedPaths,
    );
    const productionClosure = buildProductionClosure({
      lockAuthority: input.lockAuthority,
      installedPaths,
      hostPlatform: input.hostPlatform,
      hostArchitecture: input.hostArchitecture,
    });
    const binDirectories = validateNpmBinSurfaceInternalV2(
      input.rawEntries,
      deriveExpectedNpmBinsInternalV2(
        input.lockAuthority.packages,
        installedPaths,
      ),
    );
    return Object.freeze({
      hiddenLockRawHash: hiddenLock.contentHash,
      binDirectories,
      productionClosure,
    });
  } finally {
    rootLock.bytes.fill(0);
    hiddenLock.bytes.fill(0);
  }
}

function installedPackageMembershipHash(
  packages:
    readonly PlatformReleaseBuildToolchainLockPackageV2[],
): string {
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-production-installed-package-membership.v2",
    packages: packages.map((entry) => ({
      packagePath: entry.packagePath,
      lockEntryHash: entry.lockEntryHash,
    })),
  });
}

function captureSealedInstalledPackagePaths(
  nodeModulesRoot: string,
): readonly string[] {
  assertSealedOwnedNpmDependencyTreeInternalV2(
    nodeModulesRoot,
  );
  const entries = captureRawNpmInstallTreeInternalV2(
    nodeModulesRoot,
  );
  if (entries.some((entry) =>
    entry.type === "symbolic_link"
    || entry.locator === ".package-lock.json"
    || entry.locator.endsWith("/.package-lock.json")
    || entry.locator.split("/").includes(".bin"))
  ) {
    return fail(
      "PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_V2_AUTHORITY_MISMATCH",
      "Sealed production tree retained npm-generated metadata or symbolic links",
    );
  }
  const installedPaths = entries
    .filter((entry) =>
      entry.type === "directory"
      && isCanonicalNpmLockPackagePathV2(
        `node_modules/${entry.locator}`,
      ))
    .map((entry) => `node_modules/${entry.locator}`)
    .sort(compareUtf16);
  validateEveryAndOnlyNpmPackageRootsInternalV2(
    nodeModulesRoot,
    entries,
    installedPaths,
  );
  return Object.freeze(installedPaths);
}

function assertSealedMembership(input: Readonly<{
  nodeModulesRoot: string;
  productionClosure: PlatformReleaseProductionClosureV2;
}>): void {
  const installedPaths =
    captureSealedInstalledPackagePaths(
      input.nodeModulesRoot,
    );
  if (
    !sameStrings(
      installedPaths,
      input.productionClosure.installedPackages.map(
        (entry) => entry.packagePath,
      ),
    )
  ) {
    return fail(
      "PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_V2_AUTHORITY_MISMATCH",
      "Sealed package roots differ from the exact production closure",
    );
  }
}

function captureDependencyTree(
  admissionScope:
    NpmLockDependencyCapsuleAdmissionScopeV2,
  nodeModulesRoot: string,
): CanonicalRuntimeTreeV2 {
  const metadataProbe =
    getNodeScaffoldRuntimeMetadataProbeInternalV2(
      admissionScope,
    );
  return admissionScope === "production_host"
    ? captureCanonicalRuntimeTreeV2({
        root: nodeModulesRoot,
        profile: "dependencies",
        metadataProbe,
      })
    : captureCanonicalRuntimeTreeV2ForTest({
        root: nodeModulesRoot,
        profile: "dependencies",
        metadataProbe,
      });
}

function dependencyTreeBinding(
  dependencyTree: CanonicalRuntimeTreeV2,
): CanonicalRuntimeDependencyTreeBindingCandidateV2 {
  const identity = {
    schema: CANONICAL_RUNTIME_TREE_BINDING_V2_SCHEMA,
    treeSchema: dependencyTree.schema,
    profile: "dependencies" as const,
    rootLocator: "payload/node_modules" as const,
    treeHash: dependencyTree.treeHash,
    treePayloadHash: dependencyTree.payloadHash,
    fileCount: dependencyTree.fileCount,
    directoryCount: dependencyTree.directoryCount,
    totalBytes: dependencyTree.totalBytes,
  };
  return deepFreezePlatformReleaseJsonV2(
    CanonicalRuntimeDependencyTreeBindingCandidateV2Schema
      .parse({
        ...identity,
        bindingHash:
          hashCanonicalRuntimeTreeBindingV2(identity),
      }),
  );
}

function packageRuntimeTreeHash(input: Readonly<{
  packageLocator: string;
  packageLocators: readonly string[];
  dependencyTree: CanonicalRuntimeTreeV2;
}>): string {
  const prefix = `${input.packageLocator}/`;
  const descendants = input.packageLocators.filter((candidate) =>
    candidate !== input.packageLocator
    && candidate.startsWith(prefix));
  const entries = input.dependencyTree.entries
    .flatMap((entry) => {
      const fullLocator = `node_modules/${entry.path}`;
      if (!fullLocator.startsWith(prefix)) return [];
      if (descendants.some((descendant) =>
        fullLocator === descendant
        || fullLocator.startsWith(`${descendant}/`))) {
        return [];
      }
      const relativePath = fullLocator.slice(prefix.length);
      return relativePath
        ? [{ ...entry, path: relativePath }]
        : [];
    })
    .sort((left, right) =>
      compareUtf16(left.path, right.path));
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-production-package-runtime-tree.v2",
    packageLocator: input.packageLocator,
    rootMode: "0555",
    entries,
  });
}

function lockfileRef(
  source: PlatformReleaseSourceTreeBindingV2,
): ProductionPackageResolutionGraphHashPayloadV2["lockfile"] {
  const lock = source.inputs.find((entry) =>
    entry.locator === "package-lock.json");
  if (!lock) {
    return fail(
      "PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_V2_LOCK_INVALID",
      "Admitted release source lacks package-lock.json",
    );
  }
  return Object.freeze({
    schema: EXACT_SOURCE_FILE_REF_V2_SCHEMA,
    locator: "package-lock.json" as const,
    mediaType: "application/json" as const,
    hash: lock.contentHash,
    byteLength: lock.byteLength,
  });
}

function buildProductionGraph(input: Readonly<{
  nodeModulesRoot: string;
  source: PlatformReleaseSourceTreeBindingV2;
  lockAuthority:
    PlatformReleaseSourceLockAuthorityV2;
  productionClosure: PlatformReleaseProductionClosureV2;
  dependencyTree: CanonicalRuntimeTreeV2;
}>): ProductionPackageResolutionGraphV2 {
  const packageLocators =
    input.productionClosure.installedPackages.map(
      (entry) => entry.packagePath,
    );
  const packageVersions = new Map(
    input.productionClosure.installedPackages.map(
      (entry) => [entry.packagePath, entry.version],
    ),
  );
  const dependencyEdges =
    input.productionClosure.edges.map((edge) => ({
      ownerPackageLocator: edge.ownerPackagePath,
      kind: edge.kind,
      dependencyName: edge.dependencyName,
      declaredSpec: edge.declaredSpec,
      resolvedPackageLocator:
        edge.resolvedPackagePath,
      resolvedVersion:
        packageVersions.get(edge.resolvedPackagePath)!,
    })).sort((left, right) =>
      compareUtf16(
        [
          left.ownerPackageLocator,
          left.kind,
          left.dependencyName,
          left.resolvedPackageLocator,
          left.declaredSpec,
          left.resolvedVersion,
        ].join("\0"),
        [
          right.ownerPackageLocator,
          right.kind,
          right.dependencyName,
          right.resolvedPackageLocator,
          right.declaredSpec,
          right.resolvedVersion,
        ].join("\0"),
      ));
  const packages: ProductionPackageResolutionEntryV2[] =
    input.productionClosure.installedPackages.map((entry) => {
      const manifest = readInstalledManifest({
        nodeModulesRoot: input.nodeModulesRoot,
        packagePath: entry.packagePath,
        expectedPackageName: entry.packageName,
        expectedVersion: entry.version,
        allowedModes: [0o444],
      });
      const relativePackage =
        entry.packagePath.slice("node_modules/".length);
      const treeEntry = input.dependencyTree.entries.find(
        (candidate) =>
          candidate.type === "file"
          && candidate.path
            === `${relativePackage}/package.json`,
      );
      if (
        treeEntry?.type !== "file"
        || treeEntry.contentHash !== manifest.contentHash
        || treeEntry.byteLength !== manifest.byteLength
      ) {
        return fail(
          "PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_V2_GRAPH_INVALID",
          `Installed manifest tree binding differs for ${entry.packagePath}`,
        );
      }
      const dependencyLocators =
        input.productionClosure.edges
          .filter((edge) =>
            edge.ownerPackagePath === entry.packagePath)
          .map((edge) => edge.resolvedPackagePath)
          .sort(compareUtf16);
      return {
        schema: PRODUCTION_PACKAGE_RESOLUTION_ENTRY_V2_SCHEMA,
        packageLocator: entry.packagePath,
        packageName: entry.packageName,
        version: entry.version,
        lockEntryHash: entry.lockEntryHash,
        packageJsonHash: manifest.contentHash,
        runtimeTreeHash: packageRuntimeTreeHash({
          packageLocator: entry.packagePath,
          packageLocators,
          dependencyTree: input.dependencyTree,
        }),
        dependencyLocators,
      };
    });
  packages.sort((left, right) =>
    compareUtf16(left.packageLocator, right.packageLocator));
  const identity:
    ProductionPackageResolutionGraphHashPayloadV2 = {
      schema:
        PRODUCTION_PACKAGE_RESOLUTION_GRAPH_V2_SCHEMA,
      version: "2.0.0",
      lockfileVersion: 3,
      lockfile: lockfileRef(input.source),
      materializedDependencyTreeHash:
        input.dependencyTree.treeHash,
      productionClosureHash:
        input.productionClosure.closureHash,
      productionClosureContractHash:
        input.productionClosure.contractHash,
      dependencyEdgeModel:
        "required_and_observed_optional",
      rootDependencyLocators:
        [...input.productionClosure.rootDependencyLocators],
      dependencyEdges,
      packages,
      packageCount: packages.length,
    };
  const parsed =
    ProductionPackageResolutionGraphV2Schema.safeParse({
      ...identity,
      resolutionGraphHash:
        hashProductionPackageResolutionGraphV2(identity),
    });
  if (!parsed.success) {
    return fail(
      "PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_V2_GRAPH_INVALID",
      parsed.error.issues[0]?.message
        ?? "Production resolution graph is invalid",
      parsed.error,
    );
  }
  return deepFreezePlatformReleaseJsonV2(parsed.data);
}

function materializationReceipt(input: Readonly<{
  source: PlatformReleaseSourceTreeBindingV2;
  hostToolchain:
    PlatformReleaseHostNodeToolchainReceiptV2;
  productionClosure:
    PlatformReleaseProductionClosureV2;
  dependencyTree: CanonicalRuntimeTreeV2;
  dependencyTreeBinding:
    CanonicalRuntimeDependencyTreeBindingCandidateV2;
  productionGraph: ProductionPackageResolutionGraphV2;
}>): NpmMaterializationReceiptCandidateV2 {
  const identity = {
    schema: NPM_MATERIALIZATION_RECEIPT_V2_SCHEMA,
    recipeHash:
      NPM_PRODUCTION_MATERIALIZATION_RECIPE_V2.recipeHash,
    npmIdentity: {
      packageName: "npm" as const,
      version: input.hostToolchain.npm.version,
      executableRef:
        input.hostToolchain.npm.executableRef,
      packageTreeHash:
        input.hostToolchain.npm.packageTree.normalizedTreeHash,
    },
    lockfile: lockfileRef(input.source),
    outputRoot: "payload/node_modules" as const,
    dependencyTreeHash: input.dependencyTree.treeHash,
    dependencyTreePayloadHash:
      input.dependencyTree.payloadHash,
    dependencyTreeBindingHash:
      input.dependencyTreeBinding.bindingHash,
    productionClosureHash:
      input.productionClosure.closureHash,
    productionClosureContractHash:
      input.productionClosure.contractHash,
    productionResolutionGraphHash:
      input.productionGraph.resolutionGraphHash,
    packageCount: input.productionGraph.packageCount,
    lifecycleScripts: "forbidden" as const,
    exitCode: 0 as const,
  };
  return deepFreezePlatformReleaseJsonV2(
    NpmMaterializationReceiptCandidateV2Schema.parse({
      ...identity,
      receiptHash:
        hashNpmMaterializationReceiptV2(identity),
    }),
  );
}

function assertRawProjectTopology(
  projectRoot: string,
): "source_only" | "npm_tree_present" {
  const sourceNames = [
    "package-lock.json",
    "package.json",
    "tsconfig.json",
  ];
  const installedNames = [
    ...sourceNames,
    "node_modules",
  ].sort(compareUtf16);
  const names = readdirSync(projectRoot).sort(compareUtf16);
  const topology = sameStrings(names, sourceNames)
    ? "source_only" as const
    : sameStrings(names, installedNames)
    ? "npm_tree_present" as const
    : null;
  const ownerUid = process.getuid?.() ?? 0;
  const ownerGid = process.getgid?.() ?? 0;
  const project = lstatSync(projectRoot);
  if (
    !path.isAbsolute(projectRoot)
    || path.basename(projectRoot) !== "project"
    || topology === null
    || project.isSymbolicLink()
    || !project.isDirectory()
    || realpathSync(projectRoot) !== projectRoot
    || (project.mode & 0o7777) !== 0o700
    || project.uid !== ownerUid
    || project.gid !== ownerGid
  ) {
    return fail(
      "PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_V2_INPUT_INVALID",
      "Production dependency materialization requires one exact private source-only or npm-tree project topology",
    );
  }
  if (topology === "npm_tree_present") {
    const nodeModulesRoot =
      path.join(projectRoot, "node_modules");
    const nodeModules = lstatSync(nodeModulesRoot);
    if (
      nodeModules.isSymbolicLink()
      || !nodeModules.isDirectory()
      || realpathSync(nodeModulesRoot)
        !== nodeModulesRoot
      || ![0o700, 0o755].includes(
        nodeModules.mode & 0o7777,
      )
      || nodeModules.uid !== ownerUid
      || nodeModules.gid !== ownerGid
    ) {
      return fail(
        "PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_V2_INPUT_INVALID",
        "npm-produced dependency root is not one direct process-owned directory",
      );
    }
  }
  return topology;
}

const NODE_SCAFFOLD_ERROR_CODE_TO_PLATFORM_RELEASE_V2 =
  Object.freeze({
    NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_INPUT_INVALID:
      "PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_V2_INPUT_INVALID",
    NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_LOCK_INVALID:
      "PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_V2_LOCK_INVALID",
    NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_INSTALL_TREE_INVALID:
      "PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_V2_INSTALL_TREE_INVALID",
    NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_NORMALIZATION_FAILED:
      "PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_V2_NORMALIZATION_FAILED",
    NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_GRAPH_INVALID:
      "PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_V2_GRAPH_INVALID",
    NODE_SCAFFOLD_PRODUCTION_MATERIALIZATION_V2_AUTHORITY_MISMATCH:
      "PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_V2_AUTHORITY_MISMATCH",
  } satisfies Readonly<Record<
    NodeScaffoldProductionMaterializationErrorCodeV2,
    PlatformReleaseProductionDependencyMaterializationErrorCodeV2
  >>);

const BUILD_TOOLCHAIN_ERROR_CODE_TO_PRODUCTION_DEPENDENCY_V2 =
  Object.freeze({
    PLATFORM_RELEASE_BUILD_TOOLCHAIN_V2_INPUT_INVALID:
      "PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_V2_INPUT_INVALID",
    PLATFORM_RELEASE_BUILD_TOOLCHAIN_V2_LOCK_INVALID:
      "PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_V2_LOCK_INVALID",
    PLATFORM_RELEASE_BUILD_TOOLCHAIN_V2_INSTALL_TREE_INVALID:
      "PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_V2_INSTALL_TREE_INVALID",
    PLATFORM_RELEASE_BUILD_TOOLCHAIN_V2_CLOSURE_INVALID:
      "PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_V2_CLOSURE_INVALID",
    PLATFORM_RELEASE_BUILD_TOOLCHAIN_V2_COMPILER_INVALID:
      "PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_V2_LOCK_INVALID",
    PLATFORM_RELEASE_BUILD_TOOLCHAIN_V2_NORMALIZATION_FAILED:
      "PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_V2_NORMALIZATION_FAILED",
    PLATFORM_RELEASE_BUILD_TOOLCHAIN_V2_AUTHORITY_MISMATCH:
      "PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_V2_AUTHORITY_MISMATCH",
  } satisfies Readonly<Record<
    PlatformReleaseBuildToolchainMaterializationErrorCodeV2,
    PlatformReleaseProductionDependencyMaterializationErrorCodeV2
  >>);

function translateProductionMaterializationError(
  error: unknown,
): never {
  if (error instanceof CanonicalRuntimeTreeV2Error) {
    return fail(
      "PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_V2_INSTALL_TREE_INVALID",
      "Canonical runtime dependency tree verification failed",
      error,
    );
  }
  if (
    error instanceof
    NodeScaffoldProductionMaterializationErrorV2
  ) {
    return fail(
      NODE_SCAFFOLD_ERROR_CODE_TO_PLATFORM_RELEASE_V2[
        error.code
      ],
      "Shared npm-tree verification rejected the platform release production closure",
      error,
    );
  }
  if (
    error instanceof
    PlatformReleaseBuildToolchainMaterializationErrorV2
  ) {
    return fail(
      BUILD_TOOLCHAIN_ERROR_CODE_TO_PRODUCTION_DEPENDENCY_V2[
        error.code
      ],
      "Shared source-lock verification rejected the platform release production closure",
      error,
    );
  }
  return fail(
    "PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_V2_NORMALIZATION_FAILED",
    "Platform release production dependency tree could not be materialized",
    error,
  );
}

export function materializePlatformReleaseProductionDependenciesInternalV2(
  input: Readonly<{
    admissionScope:
      NpmLockDependencyCapsuleAdmissionScopeV2;
    projectRoot: string;
    source: PlatformReleaseSourceTreeBindingV2;
    hostPlatform: string;
    hostArchitecture: string;
    hostToolchain:
      PlatformReleaseHostNodeToolchainReceiptV2;
  }>,
): PlatformReleaseProductionDependencyMaterializationV2 {
  if (
    (
      input.admissionScope !== "production_host"
      && input.admissionScope !== "test_fixture"
    )
    || input.hostToolchain.admissionScope
      !== input.admissionScope
    || input.hostToolchain.host.platform
      !== input.hostPlatform
    || input.hostToolchain.host.architecture
      !== input.hostArchitecture
  ) {
    return fail(
      "PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_V2_INPUT_INVALID",
      "Production dependency input does not join one admitted host scope",
    );
  }
  const nodeModulesRoot =
    path.join(input.projectRoot, "node_modules");
  try {
    const topology =
      assertRawProjectTopology(input.projectRoot);
    const lockAuthority =
      derivePlatformReleaseSourceLockAuthorityInternalV2({
        projectRoot: input.projectRoot,
        source: input.source,
        purpose: "production_runtime",
      });
    let rawEntries:
      readonly RawNpmInstallEntryInternalV2[];
    let validated: Readonly<{
      hiddenLockRawHash: string | null;
      binDirectories: readonly string[];
      productionClosure:
        PlatformReleaseProductionClosureV2;
    }>;
    if (topology === "source_only") {
      const productionClosure = buildProductionClosure({
        lockAuthority,
        installedPaths: [],
        hostPlatform: input.hostPlatform,
        hostArchitecture: input.hostArchitecture,
      });
      try {
        mkdirSync(nodeModulesRoot, {
          mode: 0o700,
          recursive: false,
        });
      } catch (error) {
        return fail(
          "PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_V2_INSTALL_TREE_INVALID",
          "A source-only npm result could not acquire one exclusive code-owned empty dependency root",
          error,
        );
      }
      rawEntries = Object.freeze([]);
      validated = Object.freeze({
        hiddenLockRawHash: null,
        binDirectories: Object.freeze([]),
        productionClosure,
      });
    } else {
      rawEntries =
        captureRawNpmInstallTreeInternalV2(
          nodeModulesRoot,
        );
      if (rawEntries.length === 0) {
        validated = Object.freeze({
          hiddenLockRawHash: null,
          binDirectories: Object.freeze([]),
          productionClosure: buildProductionClosure({
            lockAuthority,
            installedPaths: [],
            hostPlatform: input.hostPlatform,
            hostArchitecture: input.hostArchitecture,
          }),
        });
      } else {
        validated =
          validateHiddenLockAndInstalledPackages({
            projectRoot: input.projectRoot,
            nodeModulesRoot,
            lockAuthority,
            rawEntries,
            hostPlatform: input.hostPlatform,
            hostArchitecture: input.hostArchitecture,
          });
      }
    }
    const rawAfter =
      captureRawNpmInstallTreeInternalV2(
        nodeModulesRoot,
      );
    if (
      canonicalJsonStringify(rawAfter)
        !== canonicalJsonStringify(rawEntries)
    ) {
      return fail(
        "PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_V2_INSTALL_TREE_INVALID",
        "Production install tree changed across exact lock validation",
      );
    }
    if (validated.hiddenLockRawHash !== null) {
      rmSync(
        path.join(nodeModulesRoot, ".package-lock.json"),
        { force: false },
      );
    }
    for (const directory of validated.binDirectories) {
      rmSync(
        path.join(
          nodeModulesRoot,
          ...directory.split("/"),
        ),
        { recursive: true, force: false },
      );
    }
    normalizeNodeScaffoldRuntimeMetadataInternalV2(
      input.admissionScope,
      nodeModulesRoot,
    );
    sealNpmDependencyTreeInternalV2(nodeModulesRoot);
    assertSealedMembership({
      nodeModulesRoot,
      productionClosure: validated.productionClosure,
    });
    const dependencyTree = captureDependencyTree(
      input.admissionScope,
      nodeModulesRoot,
    );
    const binding = dependencyTreeBinding(dependencyTree);
    const productionGraph = buildProductionGraph({
      nodeModulesRoot,
      source: input.source,
      lockAuthority,
      productionClosure: validated.productionClosure,
      dependencyTree,
    });
    const receipt = materializationReceipt({
      source: input.source,
      hostToolchain: input.hostToolchain,
      productionClosure:
        validated.productionClosure,
      dependencyTree,
      dependencyTreeBinding: binding,
      productionGraph,
    });
    return deepFreezePlatformReleaseJsonV2({
      lockAuthority,
      productionClosure: validated.productionClosure,
      hiddenLockRawHash: validated.hiddenLockRawHash,
      rawInstallMembershipHash: hashCanonicalJson({
        schema:
          "setfarm.platform-release-production-raw-install-membership.v2",
        entries: rawEntries,
      }),
      installedPackageMembershipHash:
        installedPackageMembershipHash(
          validated.productionClosure.installedPackages,
        ),
      dependencyTree,
      dependencyTreeBinding: binding,
      productionGraph,
      materializationReceipt: receipt,
    });
  } catch (error) {
    if (
      error instanceof
      PlatformReleaseProductionDependencyMaterializationErrorV2
    ) throw error;
    return translateProductionMaterializationError(error);
  }
}

export function revalidatePlatformReleaseProductionDependenciesInternalV2(
  input: Readonly<{
    admissionScope:
      NpmLockDependencyCapsuleAdmissionScopeV2;
    nodeModulesRoot: string;
    source: PlatformReleaseSourceTreeBindingV2;
    hostToolchain:
      PlatformReleaseHostNodeToolchainReceiptV2;
    lockAuthority:
      PlatformReleaseSourceLockAuthorityV2;
    productionClosure:
      PlatformReleaseProductionClosureV2;
    dependencyTree: CanonicalRuntimeTreeV2;
    dependencyTreeBinding:
      CanonicalRuntimeDependencyTreeBindingCandidateV2;
    productionGraph: ProductionPackageResolutionGraphV2;
    materializationReceipt:
      NpmMaterializationReceiptCandidateV2;
  }>,
): PlatformReleaseProductionDependencyVerificationV2 {
  try {
    validatePlatformReleaseSourceLockAuthorityInternalV2(
      input.lockAuthority,
      "production_runtime",
    );
    const admittedClosure =
      PlatformReleaseProductionClosureV2Schema.parse(
        input.productionClosure,
      );
    if (
      input.hostToolchain.admissionScope
        !== input.admissionScope
      || input.lockAuthority.purpose !== "production_runtime"
      || input.lockAuthority.inputMembershipHash
        !== input.source.inputMembershipHash
      || admittedClosure.lockAuthorityHash
        !== input.lockAuthority.authorityHash
      || admittedClosure.contractHash
        !== PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_MATERIALIZATION_CONTRACT_HASH_V2
    ) {
      return fail(
        "PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_V2_AUTHORITY_MISMATCH",
        "Production closure no longer joins its admitted source and lock authority",
      );
    }
    const installedPaths =
      captureSealedInstalledPackagePaths(
        input.nodeModulesRoot,
      );
    const productionClosure = buildProductionClosure({
      lockAuthority: input.lockAuthority,
      installedPaths,
      hostPlatform:
        input.hostToolchain.host.platform,
      hostArchitecture:
        input.hostToolchain.host.architecture,
    });
    if (
      canonicalJsonStringify(productionClosure)
        !== canonicalJsonStringify(admittedClosure)
    ) {
      return fail(
        "PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_V2_AUTHORITY_MISMATCH",
        "Production closure no longer reproduces from sealed package roots, source lock and host identity",
      );
    }
    assertSealedMembership({
      nodeModulesRoot: input.nodeModulesRoot,
      productionClosure,
    });
    const dependencyTree = verifyCanonicalRuntimeTreeV2({
      root: input.nodeModulesRoot,
      candidate: input.dependencyTree,
      metadataProbe:
        getNodeScaffoldRuntimeMetadataProbeInternalV2(
          input.admissionScope,
        ),
    });
    const binding = dependencyTreeBinding(dependencyTree);
    const graph = buildProductionGraph({
      nodeModulesRoot: input.nodeModulesRoot,
      source: input.source,
      lockAuthority: input.lockAuthority,
      productionClosure,
      dependencyTree,
    });
    const receipt = materializationReceipt({
      source: input.source,
      hostToolchain: input.hostToolchain,
      productionClosure:
        productionClosure,
      dependencyTree,
      dependencyTreeBinding: binding,
      productionGraph: graph,
    });
    if (
      canonicalJsonStringify(binding)
        !== canonicalJsonStringify(
          input.dependencyTreeBinding,
        )
      || canonicalJsonStringify(graph)
        !== canonicalJsonStringify(input.productionGraph)
      || canonicalJsonStringify(receipt)
        !== canonicalJsonStringify(
          input.materializationReceipt,
        )
    ) {
      return fail(
        "PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_V2_AUTHORITY_MISMATCH",
        "Sealed dependency tree no longer reproduces its binding, graph and receipt",
      );
    }
    return deepFreezePlatformReleaseJsonV2({
      dependencyTree,
      dependencyTreeBinding: binding,
      productionGraph: graph,
      materializationReceipt: receipt,
    });
  } catch (error) {
    if (
      error instanceof
      PlatformReleaseProductionDependencyMaterializationErrorV2
    ) throw error;
    if (
      error instanceof CanonicalRuntimeTreeV2Error
      || error instanceof
        NodeScaffoldProductionMaterializationErrorV2
      || error instanceof
        PlatformReleaseBuildToolchainMaterializationErrorV2
    ) {
      return translateProductionMaterializationError(
        error,
      );
    }
    return fail(
      "PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_V2_AUTHORITY_MISMATCH",
      "Production dependency authority could not be freshly reproduced",
      error,
    );
  }
}
