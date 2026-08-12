import path from "node:path";

import {
  captureCanonicalRuntimeTreeV2,
  captureCanonicalRuntimeTreeV2ForTest,
  verifyCanonicalRuntimeTreeV2,
} from "./canonical-runtime-tree-v2.js";
import {
  CANONICAL_RUNTIME_TREE_V2_SCHEMA,
  type CanonicalRuntimeTreeV2,
} from "./schemas/canonical-runtime-tree-v2.js";
import {
  PLATFORM_RELEASE_BUILD_TOOLCHAIN_NPM_CONFIG_HASH_V2,
  PLATFORM_RELEASE_BUILD_TOOLCHAIN_TREE_BINDING_V2_SCHEMA,
  PlatformReleaseBuildToolchainTreeBindingV2Schema,
  hashPlatformReleaseBuildToolchainTreeBindingV2,
  type PlatformReleaseBuildToolchainTreeBindingV2,
  type PlatformReleaseCompilerIdentityV2,
  type PlatformReleaseSourceTreeBindingV2,
} from "./schemas/platform-release-build-v2.js";
import {
  deepFreezePlatformReleaseJsonV2,
} from "./schemas/platform-release-common-v2.js";
import {
  canonicalJsonStringify,
  hashCanonicalJson,
} from "../product-compiler/canonical-json.js";
import {
  assertSealedOwnedNpmDependencyTreeInternalV2,
  captureRawNpmInstallTreeInternalV2,
  deriveExpectedNpmBinsInternalV2,
  getNodeScaffoldRuntimeMetadataProbeInternalV2,
  isPlainNpmLockRecordInternalV2,
  normalizeNodeScaffoldRuntimeMetadataInternalV2,
  parseNpmLockJsonObjectInternalV2,
  readExactNpmLockRegularFileInternalV2,
  removeRawNpmInstallExactOwnedObjectsInternalV2,
  sealNpmDependencyTreeInternalV2,
  validateEveryAndOnlyNpmPackageRootsInternalV2,
  validateNpmBinSurfaceInternalV2,
  type NpmLockDependencyCapsuleAdmissionScopeV2,
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

export {
  PLATFORM_RELEASE_BUILD_TOOLCHAIN_NPM_CONFIG_HASH_V2,
} from "./schemas/platform-release-build-v2.js";

const LOCK_MAX_BYTES_V2 = 32 * 1024 * 1024;
const PACKAGE_JSON_MAX_BYTES_V2 = 4 * 1024 * 1024;
const MAX_LOCK_PACKAGES_V2 = 100_000;
const MAX_DEPENDENCIES_PER_PACKAGE_V2 = 10_000;
export type PlatformReleaseBuildToolchainMaterializationErrorCodeV2 =
  | "PLATFORM_RELEASE_BUILD_TOOLCHAIN_V2_INPUT_INVALID"
  | "PLATFORM_RELEASE_BUILD_TOOLCHAIN_V2_LOCK_INVALID"
  | "PLATFORM_RELEASE_BUILD_TOOLCHAIN_V2_INSTALL_TREE_INVALID"
  | "PLATFORM_RELEASE_BUILD_TOOLCHAIN_V2_CLOSURE_INVALID"
  | "PLATFORM_RELEASE_BUILD_TOOLCHAIN_V2_COMPILER_INVALID"
  | "PLATFORM_RELEASE_BUILD_TOOLCHAIN_V2_NORMALIZATION_FAILED"
  | "PLATFORM_RELEASE_BUILD_TOOLCHAIN_V2_AUTHORITY_MISMATCH";

export class PlatformReleaseBuildToolchainMaterializationErrorV2
  extends Error {
  readonly code:
    PlatformReleaseBuildToolchainMaterializationErrorCodeV2;
  override readonly cause?: unknown;

  constructor(
    code:
      PlatformReleaseBuildToolchainMaterializationErrorCodeV2,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message.slice(0, 1_500), options);
    this.name =
      "PlatformReleaseBuildToolchainMaterializationErrorV2";
    this.code = code;
    this.cause = options?.cause;
  }
}

type JsonRecordV2 = Readonly<Record<string, unknown>>;

export type PlatformReleaseBuildToolchainLockPackageV2 =
  Readonly<{
    packagePath: string;
    packageName: string;
    version: string;
    lockEntryHash: string;
  }>;

export type PlatformReleaseSourceLockAuthorityV2 =
  Readonly<{
    schema:
      "setfarm.platform-release-source-lock-authority.v2";
    purpose: "build_toolchain" | "production_runtime";
    lockRawHash: string;
    lockRawByteLength: number;
    packageJsonRawHash: string;
    packageJsonRawByteLength: number;
    inputMembershipHash: string;
    rootPackageName: "setfarm";
    rootPackageVersion: string;
    root: JsonRecordV2;
    packages: JsonRecordV2;
    packagePaths: readonly string[];
    authorityHash: string;
  }>;

type PlatformReleaseSourceLockAuthorityIdentityV2 =
  Omit<PlatformReleaseSourceLockAuthorityV2, "authorityHash">;

const PLATFORM_RELEASE_SOURCE_LOCK_AUTHORITY_KEYS_V2 =
  Object.freeze([
    "authorityHash",
    "inputMembershipHash",
    "lockRawByteLength",
    "lockRawHash",
    "packageJsonRawByteLength",
    "packageJsonRawHash",
    "packagePaths",
    "packages",
    "purpose",
    "root",
    "rootPackageName",
    "rootPackageVersion",
    "schema",
  ] as const);

export type PlatformReleaseBuildToolchainTreeMaterializationV2 =
  Readonly<{
    lockAuthority:
      PlatformReleaseSourceLockAuthorityV2;
    hiddenLockRawHash: string;
    rawInstallMembershipHash: string;
    installedPackages:
      readonly PlatformReleaseBuildToolchainLockPackageV2[];
    installedPackageMembershipHash: string;
    dependencyTree: CanonicalRuntimeTreeV2;
    treeBinding:
      PlatformReleaseBuildToolchainTreeBindingV2;
    compiler: PlatformReleaseCompilerIdentityV2;
  }>;

export type PlatformReleaseBuildToolchainTreeVerificationV2 =
  Readonly<{
    installedPackages:
      readonly PlatformReleaseBuildToolchainLockPackageV2[];
    installedPackageMembershipHash: string;
    dependencyTree: CanonicalRuntimeTreeV2;
    treeBinding:
      PlatformReleaseBuildToolchainTreeBindingV2;
    compiler: PlatformReleaseCompilerIdentityV2;
  }>;

function fail(
  code:
    PlatformReleaseBuildToolchainMaterializationErrorCodeV2,
  message: string,
  cause?: unknown,
): never {
  throw new PlatformReleaseBuildToolchainMaterializationErrorV2(
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
    && left.every((value, index) => value === right[index]);
}

function exactStringMap(
  value: unknown,
  label: string,
): Readonly<Record<string, string>> {
  if (value === undefined) return Object.freeze({});
  if (!isPlainNpmLockRecordInternalV2(value)) {
    return fail(
      "PLATFORM_RELEASE_BUILD_TOOLCHAIN_V2_LOCK_INVALID",
      `${label} must be one plain string map`,
    );
  }
  const keys = Object.keys(value).sort(compareUtf16);
  if (keys.length > MAX_DEPENDENCIES_PER_PACKAGE_V2) {
    return fail(
      "PLATFORM_RELEASE_BUILD_TOOLCHAIN_V2_LOCK_INVALID",
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
        "PLATFORM_RELEASE_BUILD_TOOLCHAIN_V2_LOCK_INVALID",
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
      "PLATFORM_RELEASE_BUILD_TOOLCHAIN_V2_LOCK_INVALID",
      `${label} is not one bounded string selector list`,
    );
  }
  return Object.freeze([...value]);
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
      "PLATFORM_RELEASE_BUILD_TOOLCHAIN_V2_LOCK_INVALID",
      `Lock package ${packagePath} has an unsafe path or value`,
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
      "PLATFORM_RELEASE_BUILD_TOOLCHAIN_V2_LOCK_INVALID",
      `Lock package ${packagePath} violates the platform build lock policy`,
    );
  }
  exactStringMap(
    candidate.dependencies,
    `${packagePath} dependencies`,
  );
  exactStringMap(
    candidate.optionalDependencies,
    `${packagePath} optionalDependencies`,
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

function selectedRootProjection(
  manifest: JsonRecordV2,
): JsonRecordV2 {
  const projection: Record<string, unknown> = {
    name: manifest.name,
    version: manifest.version,
  };
  for (const key of [
    "dependencies",
    "bin",
    "devDependencies",
    "engines",
    "optionalDependencies",
  ] as const) {
    if (manifest[key] !== undefined) {
      projection[key] = structuredClone(manifest[key]);
    }
  }
  return projection;
}

function platformReleaseSourceLockAuthorityIdentityInternalV2(
  value: PlatformReleaseSourceLockAuthorityV2,
): PlatformReleaseSourceLockAuthorityIdentityV2 {
  return {
    schema: value.schema,
    purpose: value.purpose,
    lockRawHash: value.lockRawHash,
    lockRawByteLength: value.lockRawByteLength,
    packageJsonRawHash: value.packageJsonRawHash,
    packageJsonRawByteLength:
      value.packageJsonRawByteLength,
    inputMembershipHash: value.inputMembershipHash,
    rootPackageName: value.rootPackageName,
    rootPackageVersion: value.rootPackageVersion,
    root: value.root,
    packages: value.packages,
    packagePaths: value.packagePaths,
  };
}

export function hashPlatformReleaseSourceLockAuthorityInternalV2(
  value: PlatformReleaseSourceLockAuthorityV2,
): string {
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-source-lock-authority-hash.v2",
    authority:
      platformReleaseSourceLockAuthorityIdentityInternalV2(
        value,
      ),
  });
}

export function validatePlatformReleaseSourceLockAuthorityInternalV2(
  value: PlatformReleaseSourceLockAuthorityV2,
  expectedPurpose:
    PlatformReleaseSourceLockAuthorityV2["purpose"],
): void {
  if (
    value.schema
      !== "setfarm.platform-release-source-lock-authority.v2"
    || value.purpose !== expectedPurpose
    || !sameStrings(
      Object.keys(value).sort(),
      [...PLATFORM_RELEASE_SOURCE_LOCK_AUTHORITY_KEYS_V2],
    )
    || value.authorityHash
      !== hashPlatformReleaseSourceLockAuthorityInternalV2(
        value,
      )
  ) {
    return fail(
      "PLATFORM_RELEASE_BUILD_TOOLCHAIN_V2_AUTHORITY_MISMATCH",
      "Source lock authority purpose, shape or canonical hash is invalid",
    );
  }
}

export function derivePlatformReleaseSourceLockAuthorityInternalV2(
  input: Readonly<{
    projectRoot: string;
    source: PlatformReleaseSourceTreeBindingV2;
    purpose: "build_toolchain" | "production_runtime";
  }>,
): PlatformReleaseSourceLockAuthorityV2 {
  const lockRef = input.source.inputs.find((entry) =>
    entry.locator === "package-lock.json");
  const packageRef = input.source.inputs.find((entry) =>
    entry.locator === "package.json");
  if (!lockRef || !packageRef) {
    return fail(
      "PLATFORM_RELEASE_BUILD_TOOLCHAIN_V2_INPUT_INVALID",
      "Source binding lacks the exact package and lock inputs",
    );
  }
  const lockFile = readExactNpmLockRegularFileInternalV2({
    absolutePath: path.join(
      input.projectRoot,
      "package-lock.json",
    ),
    label: "Platform build package-lock.json",
    maxBytes: LOCK_MAX_BYTES_V2,
    allowedModes: [0o444],
  });
  const packageFile = readExactNpmLockRegularFileInternalV2({
    absolutePath: path.join(input.projectRoot, "package.json"),
    label: "Platform build package.json",
    maxBytes: PACKAGE_JSON_MAX_BYTES_V2,
    allowedModes: [0o444],
  });
  try {
    if (
      lockFile.contentHash !== lockRef.contentHash
      || lockFile.bytes.byteLength !== lockRef.byteLength
      || packageFile.contentHash !== packageRef.contentHash
      || packageFile.bytes.byteLength !== packageRef.byteLength
    ) {
      return fail(
        "PLATFORM_RELEASE_BUILD_TOOLCHAIN_V2_INPUT_INVALID",
        "Copied package or lock bytes differ from admitted source inputs",
      );
    }
    const lock = parseNpmLockJsonObjectInternalV2(
      lockFile.bytes,
      "Platform build package-lock.json",
    );
    const manifest = parseNpmLockJsonObjectInternalV2(
      packageFile.bytes,
      "Platform build package.json",
    );
    if (
      !sameStrings(
        Object.keys(lock).sort(compareUtf16),
        [
          "lockfileVersion",
          "name",
          "packages",
          "requires",
          "version",
        ],
      )
      || lock.lockfileVersion !== 3
      || lock.requires !== true
      || lock.name !== "setfarm"
      || lock.name !== manifest.name
      || lock.version !== manifest.version
      || typeof lock.version !== "string"
      || !isCanonicalNpmExactVersionV2(lock.version)
      || !isPlainNpmLockRecordInternalV2(lock.packages)
      || manifest.peerDependencies !== undefined
      || manifest.peerDependenciesMeta !== undefined
    ) {
      return fail(
        "PLATFORM_RELEASE_BUILD_TOOLCHAIN_V2_LOCK_INVALID",
        "Package manifest and npm lock-v3 root do not join exactly",
      );
    }
    const packages = lock.packages;
    const root = packages[""];
    if (
      !isPlainNpmLockRecordInternalV2(root)
      || canonicalJsonStringify(root)
        !== canonicalJsonStringify(
          selectedRootProjection(manifest),
        )
    ) {
      return fail(
        "PLATFORM_RELEASE_BUILD_TOOLCHAIN_V2_LOCK_INVALID",
        "npm lock root differs from the exact package manifest projection",
      );
    }
    exactStringMap(
      manifest.dependencies,
      "Root runtime dependencies",
    );
    exactStringMap(
      manifest.devDependencies,
      "Root development dependencies",
    );
    exactStringMap(
      manifest.optionalDependencies,
      "Root optional dependencies",
    );
    const packagePaths = Object.keys(packages)
      .filter((entry) => entry !== "")
      .sort(compareUtf16);
    if (
      (
        input.purpose === "build_toolchain"
        && packagePaths.length < 1
      )
      || packagePaths.length > MAX_LOCK_PACKAGES_V2
    ) {
      return fail(
        "PLATFORM_RELEASE_BUILD_TOOLCHAIN_V2_LOCK_INVALID",
        "npm lock package membership violates its purpose-specific fixed bounds",
      );
    }
    for (const packagePath of packagePaths) {
      validateLockPackage(packagePath, packages[packagePath]);
    }
    if (input.purpose === "build_toolchain") {
      const typescript = packages["node_modules/typescript"];
      if (
        !isPlainNpmLockRecordInternalV2(typescript)
        || typeof typescript.version !== "string"
        || !isCanonicalNpmExactVersionV2(typescript.version)
      ) {
        return fail(
          "PLATFORM_RELEASE_BUILD_TOOLCHAIN_V2_COMPILER_INVALID",
          "Exact TypeScript lock entry is absent",
        );
      }
    }
    const identity = {
      schema:
        "setfarm.platform-release-source-lock-authority.v2" as const,
      purpose: input.purpose,
      lockRawHash: lockFile.contentHash,
      lockRawByteLength: lockFile.bytes.byteLength,
      packageJsonRawHash: packageFile.contentHash,
      packageJsonRawByteLength: packageFile.bytes.byteLength,
      inputMembershipHash: input.source.inputMembershipHash,
      rootPackageName: "setfarm" as const,
      rootPackageVersion: lock.version,
      root: structuredClone(root),
      packages: structuredClone(packages),
      packagePaths,
    };
    const authority =
      deepFreezePlatformReleaseJsonV2({
        ...identity,
        authorityHash: hashCanonicalJson({
          schema:
            "setfarm.platform-release-source-lock-authority-hash.v2",
          authority: identity,
        }),
      });
    validatePlatformReleaseSourceLockAuthorityInternalV2(
      authority,
      input.purpose,
    );
    return authority;
  } catch (error) {
    if (
      error
        instanceof PlatformReleaseBuildToolchainMaterializationErrorV2
    ) throw error;
    return fail(
      "PLATFORM_RELEASE_BUILD_TOOLCHAIN_V2_LOCK_INVALID",
      "Exact platform build lock authority could not be compiled",
      error,
    );
  } finally {
    lockFile.bytes.fill(0);
    packageFile.bytes.fill(0);
  }
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
  return selectorAllows(
    exactStringArray(entry.os, "Installed package os"),
    hostPlatform,
  ) && selectorAllows(
    exactStringArray(entry.cpu, "Installed package cpu"),
    hostArchitecture,
  );
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
      "PLATFORM_RELEASE_BUILD_TOOLCHAIN_V2_CLOSURE_INVALID",
      `Required lock edge ${
        input.ownerPackagePath || "<root>"
      } -> ${input.dependencyName} is absent or incompatible`,
    );
  }
  return resolved;
}

function installedClosure(input: Readonly<{
  lockAuthority:
    PlatformReleaseSourceLockAuthorityV2;
  installedPaths: readonly string[];
  hostPlatform: string;
  hostArchitecture: string;
}>): readonly PlatformReleaseBuildToolchainLockPackageV2[] {
  const installed = new Set(input.installedPaths);
  const allLockPaths = new Set(
    input.lockAuthority.packagePaths,
  );
  const reached = new Set<string>();
  const pending: string[] = [];
  const pushRequiredMap = (
    ownerPackagePath: string,
    dependencies: Readonly<Record<string, string>>,
  ): void => {
    for (
      const [dependencyName, declaredSpec]
      of Object.entries(dependencies).sort(([left], [right]) =>
        compareUtf16(left, right))
    ) {
      pending.push(resolveRequiredEdge({
        installedPaths: installed,
        packages: input.lockAuthority.packages,
        ownerPackagePath,
        dependencyName,
        declaredSpec,
      }));
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
      const resolved = resolveNodeScaffoldDependencyPathV2(
        allLockPaths,
        ownerPackagePath,
        dependencyName,
      );
      if (!resolved || !installed.has(resolved)) continue;
      const entry = input.lockAuthority.packages[resolved];
      if (
        !isPlainNpmLockRecordInternalV2(entry)
        || typeof entry.version !== "string"
        || !nodeScaffoldVersionSatisfiesSpecV2(
          entry.version,
          declaredSpec,
        )
      ) {
        return fail(
          "PLATFORM_RELEASE_BUILD_TOOLCHAIN_V2_CLOSURE_INVALID",
          `Installed optional edge ${
            ownerPackagePath || "<root>"
          } -> ${dependencyName} is incompatible`,
        );
      }
      pending.push(resolved);
    }
  };

  const rootOptional = exactStringMap(
    input.lockAuthority.root.optionalDependencies,
    "Root optional dependencies",
  );
  const rootDependencies = exactStringMap(
    input.lockAuthority.root.dependencies,
    "Root runtime dependencies",
  );
  const rootDevelopment = exactStringMap(
    input.lockAuthority.root.devDependencies,
    "Root development dependencies",
  );
  pushRequiredMap("", Object.freeze({
    ...rootDependencies,
    ...rootDevelopment,
  }));
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
        "PLATFORM_RELEASE_BUILD_TOOLCHAIN_V2_CLOSURE_INVALID",
        `Installed package ${packagePath} is absent from authority or host-ineligible`,
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
    for (const name of Object.keys(optional)) delete required[name];
    pushRequiredMap(packagePath, Object.freeze(required));
    pushOptionalMap(packagePath, optional);
  }

  if (
    reached.size !== installed.size
    || input.installedPaths.some((entry) => !reached.has(entry))
  ) {
    return fail(
      "PLATFORM_RELEASE_BUILD_TOOLCHAIN_V2_CLOSURE_INVALID",
      "Installed package membership is not every-and-only the reachable required/observed-optional closure",
    );
  }
  return Object.freeze(
    input.installedPaths.map((packagePath) =>
      validateLockPackage(
        packagePath,
        input.lockAuthority.packages[packagePath],
      )),
  );
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
  installedPackages:
    readonly PlatformReleaseBuildToolchainLockPackageV2[];
}> {
  const rootLock = readExactNpmLockRegularFileInternalV2({
    absolutePath: path.join(
      input.projectRoot,
      "package-lock.json",
    ),
    label: "Platform build package-lock.json",
    maxBytes: LOCK_MAX_BYTES_V2,
    allowedModes: [0o444],
  });
  const hiddenEntry = input.rawEntries.find((entry) =>
    entry.locator === ".package-lock.json");
  const hiddenLock =
    readExactNpmLockRegularFileInternalV2({
      absolutePath: path.join(
        input.nodeModulesRoot,
        ".package-lock.json",
      ),
      label: "Platform build npm hidden lock",
      maxBytes: LOCK_MAX_BYTES_V2,
    });
  try {
    if (
      rootLock.contentHash
        !== input.lockAuthority.lockRawHash
      || rootLock.bytes.byteLength
        !== input.lockAuthority.lockRawByteLength
      || hiddenEntry?.type !== "file"
      || hiddenEntry.contentHash !== hiddenLock.contentHash
      || input.rawEntries.some((entry) =>
        entry.locator !== ".package-lock.json"
        && entry.locator.endsWith("/.package-lock.json"))
    ) {
      return fail(
        "PLATFORM_RELEASE_BUILD_TOOLCHAIN_V2_LOCK_INVALID",
        "Root or hidden npm lock changed or appears at an unexpected locator",
      );
    }
    const hidden = parseNpmLockJsonObjectInternalV2(
      hiddenLock.bytes,
      "Platform build npm hidden lock",
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
        "PLATFORM_RELEASE_BUILD_TOOLCHAIN_V2_LOCK_INVALID",
        "npm hidden lock root identity is not exact",
      );
    }
    const installedPaths = Object.keys(hidden.packages)
      .sort(compareUtf16);
    if (
      installedPaths.length < 1
      || installedPaths.length > MAX_LOCK_PACKAGES_V2
      || installedPaths.some((packagePath) =>
        !isCanonicalNpmLockPackagePathV2(packagePath))
    ) {
      return fail(
        "PLATFORM_RELEASE_BUILD_TOOLCHAIN_V2_LOCK_INVALID",
        "npm hidden lock installed membership is empty or invalid",
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
          "PLATFORM_RELEASE_BUILD_TOOLCHAIN_V2_LOCK_INVALID",
          `Installed hidden lock entry differs for ${packagePath}`,
        );
      }
      const manifest =
        readExactNpmLockRegularFileInternalV2({
          absolutePath: path.join(
            input.nodeModulesRoot,
            ...packagePath
              .slice("node_modules/".length)
              .split("/"),
            "package.json",
          ),
          label: `${packagePath}/package.json`,
          maxBytes: PACKAGE_JSON_MAX_BYTES_V2,
        });
      try {
        const value = parseNpmLockJsonObjectInternalV2(
          manifest.bytes,
          `${packagePath}/package.json`,
        );
        if (
          value.name
            !== nodeScaffoldPackageNameFromLockPathV2(
              packagePath,
            )
          || value.version !== rootEntry.version
        ) {
          return fail(
            "PLATFORM_RELEASE_BUILD_TOOLCHAIN_V2_INSTALL_TREE_INVALID",
            `Installed package identity differs for ${packagePath}`,
          );
        }
      } finally {
        manifest.bytes.fill(0);
      }
    }
    validateEveryAndOnlyNpmPackageRootsInternalV2(
      input.nodeModulesRoot,
      input.rawEntries,
      installedPaths,
    );
    const installedPackages = installedClosure({
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
      installedPackages,
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
      "setfarm.platform-release-build-toolchain-installed-package-membership.v2",
    packages: packages.map((entry) => ({
      packagePath: entry.packagePath,
      lockEntryHash: entry.lockEntryHash,
    })),
  });
}

function compilerIdentity(input: Readonly<{
  nodeModulesRoot: string;
  lockAuthority:
    PlatformReleaseSourceLockAuthorityV2;
  installedPackages:
    readonly PlatformReleaseBuildToolchainLockPackageV2[];
  dependencyTree: CanonicalRuntimeTreeV2;
}>): PlatformReleaseCompilerIdentityV2 {
  const compilerPath = "node_modules/typescript";
  const compiler = input.installedPackages.find((entry) =>
    entry.packagePath === compilerPath);
  const lockEntry =
    input.lockAuthority.packages[compilerPath];
  if (
    !compiler
    || !isPlainNpmLockRecordInternalV2(lockEntry)
    || compiler.version !== lockEntry.version
  ) {
    return fail(
      "PLATFORM_RELEASE_BUILD_TOOLCHAIN_V2_COMPILER_INVALID",
      "Installed TypeScript compiler does not join its exact lock entry",
    );
  }
  const packageJson =
    readExactNpmLockRegularFileInternalV2({
      absolutePath: path.join(
        input.nodeModulesRoot,
        "typescript",
        "package.json",
      ),
      label: "Installed TypeScript package.json",
      maxBytes: PACKAGE_JSON_MAX_BYTES_V2,
      allowedModes: [0o444],
    });
  try {
    const manifest = parseNpmLockJsonObjectInternalV2(
      packageJson.bytes,
      "Installed TypeScript package.json",
    );
    const entry = input.dependencyTree.entries.find((candidate) =>
      candidate.type === "file"
      && candidate.path === "typescript/bin/tsc");
    if (
      manifest.name !== "typescript"
      || manifest.version !== compiler.version
      || entry?.type !== "file"
      || entry.mode !== "0555"
    ) {
      return fail(
        "PLATFORM_RELEASE_BUILD_TOOLCHAIN_V2_COMPILER_INVALID",
        "Installed TypeScript manifest or direct executable entry is invalid",
      );
    }
    const nestedPackageRoots =
      input.installedPackages
        .map((candidate) => candidate.packagePath)
        .filter((candidate) =>
          candidate.startsWith(`${compilerPath}/node_modules/`))
        .map((candidate) =>
          candidate.slice("node_modules/".length));
    const packageEntries = input.dependencyTree.entries
      .filter((candidate) =>
        candidate.path.startsWith("typescript/")
        && !nestedPackageRoots.some((root) =>
          candidate.path === root
          || candidate.path.startsWith(`${root}/`)))
      .map((candidate) => ({
        ...candidate,
        path: candidate.path.slice("typescript/".length),
      }))
      .sort((left, right) =>
        compareUtf16(left.path, right.path));
    return Object.freeze({
      packageName: "typescript" as const,
      version: compiler.version,
      lockEntryHash: compiler.lockEntryHash,
      packageJsonHash: packageJson.contentHash,
      packageTreeHash: hashCanonicalJson({
        schema:
          "setfarm.platform-release-build-toolchain-package-tree.v2",
        packagePath: compilerPath,
        rootMode: "0555",
        entries: packageEntries,
      }),
      entryModuleLocator:
        "node_modules/typescript/bin/tsc" as const,
      entryModuleHash: entry.contentHash,
    });
  } finally {
    packageJson.bytes.fill(0);
  }
}

function treeBinding(input: Readonly<{
  source: PlatformReleaseSourceTreeBindingV2;
  dependencyTree: CanonicalRuntimeTreeV2;
  installedPackages:
    readonly PlatformReleaseBuildToolchainLockPackageV2[];
}>): PlatformReleaseBuildToolchainTreeBindingV2 {
  const identity = {
    schema:
      PLATFORM_RELEASE_BUILD_TOOLCHAIN_TREE_BINDING_V2_SCHEMA,
    treeSchema: CANONICAL_RUNTIME_TREE_V2_SCHEMA,
    profile: "dependencies" as const,
    rootLocator: "node_modules" as const,
    treeHash: input.dependencyTree.treeHash,
    treePayloadHash: input.dependencyTree.payloadHash,
    fileCount: input.dependencyTree.fileCount,
    directoryCount: input.dependencyTree.directoryCount,
    totalBytes: input.dependencyTree.totalBytes,
    inputMembershipHash: input.source.inputMembershipHash,
    packageCount: input.installedPackages.length,
    installedPackageMembershipHash:
      installedPackageMembershipHash(
        input.installedPackages,
      ),
  };
  return deepFreezePlatformReleaseJsonV2(
    PlatformReleaseBuildToolchainTreeBindingV2Schema.parse({
      ...identity,
      bindingHash:
        hashPlatformReleaseBuildToolchainTreeBindingV2(
          identity,
        ),
    }),
  );
}

function assertSealedMembership(input: Readonly<{
  nodeModulesRoot: string;
  installedPackages:
    readonly PlatformReleaseBuildToolchainLockPackageV2[];
}>): void {
  assertSealedOwnedNpmDependencyTreeInternalV2(
    input.nodeModulesRoot,
  );
  const entries =
    captureRawNpmInstallTreeInternalV2(
      input.nodeModulesRoot,
    );
  if (entries.some((entry) =>
    entry.type === "symbolic_link"
    || entry.locator === ".package-lock.json"
    || entry.locator.endsWith("/.package-lock.json")
    || entry.locator.split("/").includes(".bin"))
  ) {
    return fail(
      "PLATFORM_RELEASE_BUILD_TOOLCHAIN_V2_AUTHORITY_MISMATCH",
      "Sealed toolchain retained npm metadata or symbolic links",
    );
  }
  validateEveryAndOnlyNpmPackageRootsInternalV2(
    input.nodeModulesRoot,
    entries,
    input.installedPackages.map((entry) =>
      entry.packagePath),
  );
}

function captureTree(
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

export function materializePlatformReleaseBuildToolchainTreeInternalV2(
  input: Readonly<{
    admissionScope:
      NpmLockDependencyCapsuleAdmissionScopeV2;
    projectRoot: string;
    source: PlatformReleaseSourceTreeBindingV2;
    hostPlatform: string;
    hostArchitecture: string;
  }>,
): PlatformReleaseBuildToolchainTreeMaterializationV2 {
  if (
    !path.isAbsolute(input.projectRoot)
    || path.basename(input.projectRoot) !== "project"
    || (
      input.admissionScope !== "production_host"
      && input.admissionScope !== "test_fixture"
    )
  ) {
    return fail(
      "PLATFORM_RELEASE_BUILD_TOOLCHAIN_V2_INPUT_INVALID",
      "Build toolchain materialization input is not one admitted private project",
    );
  }
  const nodeModulesRoot =
    path.join(input.projectRoot, "node_modules");
  try {
    const lockAuthority =
      derivePlatformReleaseSourceLockAuthorityInternalV2({
        ...input,
        purpose: "build_toolchain",
      });
    const rawEntries =
      captureRawNpmInstallTreeInternalV2(
        nodeModulesRoot,
      );
    const validated =
      validateHiddenLockAndInstalledPackages({
        projectRoot: input.projectRoot,
        nodeModulesRoot,
        lockAuthority,
        rawEntries,
        hostPlatform: input.hostPlatform,
        hostArchitecture: input.hostArchitecture,
      });
    const rawAfter =
      captureRawNpmInstallTreeInternalV2(
        nodeModulesRoot,
      );
    if (
      canonicalJsonStringify(rawAfter)
        !== canonicalJsonStringify(rawEntries)
    ) {
      return fail(
        "PLATFORM_RELEASE_BUILD_TOOLCHAIN_V2_INSTALL_TREE_INVALID",
        "Installed dependency tree changed across exact lock validation",
      );
    }
    removeRawNpmInstallExactOwnedObjectsInternalV2({
      entries: rawEntries,
      nodeModulesRoot,
      locators: [
        ".package-lock.json",
        ...validated.binDirectories,
      ],
      onFailure: (message, cause) => fail(
        "PLATFORM_RELEASE_BUILD_TOOLCHAIN_V2_INSTALL_TREE_INVALID",
        message,
        cause,
      ),
    });
    normalizeNodeScaffoldRuntimeMetadataInternalV2(
      input.admissionScope,
      nodeModulesRoot,
    );
    sealNpmDependencyTreeInternalV2(nodeModulesRoot);
    assertSealedMembership({
      nodeModulesRoot,
      installedPackages: validated.installedPackages,
    });
    const dependencyTree = captureTree(
      input.admissionScope,
      nodeModulesRoot,
    );
    const compiler = compilerIdentity({
      nodeModulesRoot,
      lockAuthority,
      installedPackages: validated.installedPackages,
      dependencyTree,
    });
    const binding = treeBinding({
      source: input.source,
      dependencyTree,
      installedPackages: validated.installedPackages,
    });
    return deepFreezePlatformReleaseJsonV2({
      lockAuthority,
      hiddenLockRawHash:
        validated.hiddenLockRawHash,
      rawInstallMembershipHash: hashCanonicalJson({
        schema:
          "setfarm.platform-release-build-toolchain-raw-install-membership.v2",
        entries: rawEntries,
      }),
      installedPackages:
        validated.installedPackages,
      installedPackageMembershipHash:
        binding.installedPackageMembershipHash,
      dependencyTree,
      treeBinding: binding,
      compiler,
    });
  } catch (error) {
    if (
      error
        instanceof PlatformReleaseBuildToolchainMaterializationErrorV2
    ) throw error;
    return fail(
      "PLATFORM_RELEASE_BUILD_TOOLCHAIN_V2_NORMALIZATION_FAILED",
      "Platform build dependency tree could not be materialized",
      error,
    );
  }
}

export function revalidatePlatformReleaseBuildToolchainTreeInternalV2(
  input: Readonly<{
    admissionScope:
      NpmLockDependencyCapsuleAdmissionScopeV2;
    nodeModulesRoot: string;
    source: PlatformReleaseSourceTreeBindingV2;
    lockAuthority:
      PlatformReleaseSourceLockAuthorityV2;
    installedPackages:
      readonly PlatformReleaseBuildToolchainLockPackageV2[];
    dependencyTree: CanonicalRuntimeTreeV2;
    treeBinding:
      PlatformReleaseBuildToolchainTreeBindingV2;
    compiler: PlatformReleaseCompilerIdentityV2;
  }>,
): PlatformReleaseBuildToolchainTreeVerificationV2 {
  try {
    validatePlatformReleaseSourceLockAuthorityInternalV2(
      input.lockAuthority,
      "build_toolchain",
    );
    assertSealedMembership({
      nodeModulesRoot: input.nodeModulesRoot,
      installedPackages: input.installedPackages,
    });
    const dependencyTree = verifyCanonicalRuntimeTreeV2({
      root: input.nodeModulesRoot,
      candidate: input.dependencyTree,
      metadataProbe:
        getNodeScaffoldRuntimeMetadataProbeInternalV2(
          input.admissionScope,
        ),
    });
    const compiler = compilerIdentity({
      nodeModulesRoot: input.nodeModulesRoot,
      lockAuthority: input.lockAuthority,
      installedPackages: input.installedPackages,
      dependencyTree,
    });
    const binding = treeBinding({
      source: input.source,
      dependencyTree,
      installedPackages: input.installedPackages,
    });
    if (
      canonicalJsonStringify(compiler)
        !== canonicalJsonStringify(input.compiler)
      || canonicalJsonStringify(binding)
        !== canonicalJsonStringify(input.treeBinding)
      || input.lockAuthority.inputMembershipHash
        !== input.source.inputMembershipHash
    ) {
      return fail(
        "PLATFORM_RELEASE_BUILD_TOOLCHAIN_V2_AUTHORITY_MISMATCH",
        "Fresh toolchain tree, compiler or source binding differs from materialization authority",
      );
    }
    return deepFreezePlatformReleaseJsonV2({
      installedPackages: input.installedPackages,
      installedPackageMembershipHash:
        installedPackageMembershipHash(
          input.installedPackages,
        ),
      dependencyTree,
      treeBinding: binding,
      compiler,
    });
  } catch (error) {
    if (
      error
        instanceof PlatformReleaseBuildToolchainMaterializationErrorV2
    ) throw error;
    return fail(
      "PLATFORM_RELEASE_BUILD_TOOLCHAIN_V2_AUTHORITY_MISMATCH",
      "Platform build toolchain could not be freshly reproduced",
      error,
    );
  }
}
