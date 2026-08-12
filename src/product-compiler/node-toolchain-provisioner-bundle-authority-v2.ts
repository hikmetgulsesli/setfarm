import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  closeSync,
  constants,
  fchmodSync,
  fstatSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
  realpathSync,
  rmSync,
  unlinkSync,
  writeSync,
  type Stats,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isProxy } from "node:util/types";

import { canonicalJsonBytes } from "./canonical-json.js";
import {
  copyMaterializedNodeToolchainPrivateTreeBundleV2,
  inspectNodeToolchainPrivateTreeReceiptV2,
  type MaterializedNodeToolchainPrivateTreeV2,
  type NodeToolchainPrivateTreeBundleV2,
} from "./node-toolchain-private-tree-v2.js";
import {
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ENTRYPOINT_SOURCE_LOCATOR_V2,
} from "./schemas/node-toolchain-provisioner-bootstrap-v2.js";
import {
  NODE_TOOLCHAIN_PROVISIONER_BUNDLE_AUTHORITY_RECEIPT_V2_SCHEMA,
  NODE_TOOLCHAIN_PROVISIONER_BUNDLE_AUTHORITY_REF_V2,
  NODE_TOOLCHAIN_PROVISIONER_BUNDLE_AUTHORITY_VERSION_V2,
  NODE_TOOLCHAIN_PROVISIONER_BUNDLE_BUILDER_SOURCE_LOCATOR_V2,
  NODE_TOOLCHAIN_PROVISIONER_BUNDLE_MAX_BYTES_V2,
  NODE_TOOLCHAIN_PROVISIONER_BUNDLE_MAX_METADATA_BYTES_V2,
  NodeToolchainProvisionerBundleAuthorityReceiptV2Schema,
  hashNodeToolchainProvisionerBundleAuthorityReceiptV2,
  hashNodeToolchainProvisionerBundleDependencyClosureV2,
  hashNodeToolchainProvisionerBundleExternalSetV2,
  hashNodeToolchainProvisionerBundleInputSetV2,
  type NodeToolchainProvisionerBundleAuthorityReceiptHashPayloadV2,
  type NodeToolchainProvisionerBundleAuthorityReceiptV2,
} from "./schemas/node-toolchain-provisioner-bundle-authority-v2.js";
import type { NodeToolchainPrivateTreeReceiptV2 } from "./schemas/node-toolchain-private-tree-v2.js";

const GIT_PATH_V2 = "/usr/bin/git" as const;
const BSDTAR_PATH_V2 = "/usr/bin/bsdtar" as const;
const STAGE_PREFIX_V2 = "/private/tmp/setfarm-provisioner-bundle-authority-v2-" as const;
const BUILD_TIMEOUT_MS_V2 = 60_000;
const BUILD_OUTPUT_LIMIT_V2 = 16 * 1024;
const PACKAGE_MAX_FILES_V2 = 2_000;
const PACKAGE_MAX_DIRECTORIES_V2 = 500;
const PACKAGE_MAX_TOTAL_BYTES_V2 = 128 * 1024 * 1024;
const SOURCE_MAX_BYTES_V2 = 16 * 1024 * 1024;
const repositoryRootV2 = realpathSync(path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
));

type ArchitectureV2 = "arm64" | "x64";

type ExactPackageContractV2 = Readonly<{
  packageName: string;
  version: string;
  registryTarballUrl: string;
  registryIntegrity: string;
  registryTarballSha256: string;
  registryContentTreeHash: string;
  installedContentTreeHash: string;
  fileCount: number;
  directoryCount: number;
  totalBytes: number;
  admissionPolicy:
    | "exact_registry_tree_no_links_private_copy_v2"
    | "exact_registry_tree_with_official_binary_replacement_private_copy_v2"
    | "exact_registry_tree_official_binary_pair_private_copy_v2";
}>;

const ZOD_CONTRACT_V2: ExactPackageContractV2 = Object.freeze({
  packageName: "zod",
  version: "4.4.3",
  registryTarballUrl: "https://registry.npmjs.org/zod/-/zod-4.4.3.tgz",
  registryIntegrity:
    "sha512-ytENFjIJFl2UwYglde2jchW2Hwm4GJFLDiSXWdTrJQBIN9Fcyp7n4DhxJEiWNAJMV1/BqWfW/kkg71UDcHJyTQ==",
  registryTarballSha256: "ee38f17f533fd500610685a483ae2f413c26f4eb33a51684314563c8d60f279c",
  registryContentTreeHash: "03a95676d38475d1c82e468c54411837df13ef371b89d35c4f02bbdf6d95502d",
  installedContentTreeHash: "03a95676d38475d1c82e468c54411837df13ef371b89d35c4f02bbdf6d95502d",
  fileCount: 718,
  directoryCount: 30,
  totalBytes: 4_558_122,
  admissionPolicy: "exact_registry_tree_no_links_private_copy_v2",
});

const ESBUILD_REGISTRY_BASE_V2 = Object.freeze({
  packageName: "esbuild",
  version: "0.28.1",
  registryTarballUrl: "https://registry.npmjs.org/esbuild/-/esbuild-0.28.1.tgz",
  registryIntegrity:
    "sha512-HrJrvZv5ayxBzPfwphOoNzkzOIIlifzk0KJrGK2c8R4+LKpMtpYLQeUdjnwjWv/LZlkH2laZk+4w78pi99D4Vw==",
  registryTarballSha256: "eb8ef756f8299d16d5c8b35678606d715ba29923f500db7b37c181310eed40a5",
  registryContentTreeHash: "246cd05c93f9e450cb7287e43420c71f2f9fe43968959162a44d0b1b8a506272",
  fileCount: 7,
  directoryCount: 3,
  admissionPolicy: "exact_registry_tree_with_official_binary_replacement_private_copy_v2",
} as const);

const ARCHITECTURE_CONTRACTS_V2: Readonly<Record<ArchitectureV2, Readonly<{
  esbuild: ExactPackageContractV2;
  platform: ExactPackageContractV2;
}>>> = Object.freeze({
  arm64: Object.freeze({
    esbuild: Object.freeze({
      ...ESBUILD_REGISTRY_BASE_V2,
      installedContentTreeHash: "aab461c4785da4548c406c0790920290f4cd427ff48b8821cedae10d7a8e7e99",
      totalBytes: 10_711_381,
    }),
    platform: Object.freeze({
      packageName: "@esbuild/darwin-arm64",
      version: "0.28.1",
      registryTarballUrl:
        "https://registry.npmjs.org/@esbuild/darwin-arm64/-/darwin-arm64-0.28.1.tgz",
      registryIntegrity:
        "sha512-TZbWkQY7kvTAXbXUT7uVACR5cMHsDiSz9z7ZKAX/RTq/WJEk3QyRr0wZpNhBDX+/0CtdqUIJlOiodQcta6tY3Q==",
      registryTarballSha256: "5d64cc9bc527d598450b5f8d47ff293eb9f3aea38dd9eff67fd55d228c5ccb43",
      registryContentTreeHash: "2e2991067e1f8c4a846c3b2719445b350b3bc6e657c137e7c4c6d87aa4de7fbb",
      installedContentTreeHash: "2e2991067e1f8c4a846c3b2719445b350b3bc6e657c137e7c4c6d87aa4de7fbb",
      fileCount: 3,
      directoryCount: 2,
      totalBytes: 10_574_305,
      admissionPolicy: "exact_registry_tree_official_binary_pair_private_copy_v2",
    }),
  }),
  x64: Object.freeze({
    esbuild: Object.freeze({
      ...ESBUILD_REGISTRY_BASE_V2,
      installedContentTreeHash: "af511c7328a71ae500343ecb957ee64af93fb7b1ac976c7a759c15347d20178b",
      totalBytes: 11_768_467,
    }),
    platform: Object.freeze({
      packageName: "@esbuild/darwin-x64",
      version: "0.28.1",
      registryTarballUrl:
        "https://registry.npmjs.org/@esbuild/darwin-x64/-/darwin-x64-0.28.1.tgz",
      registryIntegrity:
        "sha512-zfdzgK9ACBNZLI/CyHTOx81SyNbM6YXn7rxSgX97VjyiPl9W1i4Ka4fgKECEoFCKGpvBj5qArWIGgQjOwkgskQ==",
      registryTarballSha256: "4cc582287781c171f5ac2d216dc15ab1c40bc83bff59803211a68b66e0c762cb",
      registryContentTreeHash: "68b19e56db45a17d1ec12b5a244040b007867955becf7e814dad6ba45d4d5e69",
      installedContentTreeHash: "68b19e56db45a17d1ec12b5a244040b007867955becf7e814dad6ba45d4d5e69",
      fileCount: 3,
      directoryCount: 2,
      totalBytes: 11_631_379,
      admissionPolicy: "exact_registry_tree_official_binary_pair_private_copy_v2",
    }),
  }),
});

export type NodeToolchainProvisionerBundleAuthorityErrorCodeV2 =
  | "NODE_TOOLCHAIN_PROVISIONER_BUNDLE_V2_INPUT_INVALID"
  | "NODE_TOOLCHAIN_PROVISIONER_BUNDLE_V2_GIT_AUTHORITY_INVALID"
  | "NODE_TOOLCHAIN_PROVISIONER_BUNDLE_V2_SOURCE_INVALID"
  | "NODE_TOOLCHAIN_PROVISIONER_BUNDLE_V2_DEPENDENCY_INVALID"
  | "NODE_TOOLCHAIN_PROVISIONER_BUNDLE_V2_STAGE_INVALID"
  | "NODE_TOOLCHAIN_PROVISIONER_BUNDLE_V2_BUILD_FAILED"
  | "NODE_TOOLCHAIN_PROVISIONER_BUNDLE_V2_BUILD_OUTPUT_INVALID"
  | "NODE_TOOLCHAIN_PROVISIONER_BUNDLE_V2_NONDETERMINISTIC"
  | "NODE_TOOLCHAIN_PROVISIONER_BUNDLE_V2_RECEIPT_INVALID"
  | "NODE_TOOLCHAIN_PROVISIONER_BUNDLE_V2_HANDLE_UNAUTHENTICATED";

export class NodeToolchainProvisionerBundleAuthorityErrorV2 extends Error {
  readonly code: NodeToolchainProvisionerBundleAuthorityErrorCodeV2;
  override readonly cause?: unknown;

  constructor(
    code: NodeToolchainProvisionerBundleAuthorityErrorCodeV2,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message.slice(0, 1_500), options);
    this.name = "NodeToolchainProvisionerBundleAuthorityErrorV2";
    this.code = code;
    this.cause = options?.cause;
  }
}

type PackageEntryV2 = Readonly<{
  locator: "." | string;
  type: "file" | "directory";
  byteLength: number;
  contentHash: string | null;
  bytes: Buffer | null;
  device: number;
  inode: number;
  linkCount: number;
}>;

type CapturedPackageV2 = Readonly<{
  contract: ExactPackageContractV2;
  entries: readonly PackageEntryV2[];
}>;

type GitIdentityV2 = Readonly<{
  codeSha: string;
  sourceTreeHash: string;
  branch: string;
  originMainSha: string | null;
  dirty: boolean;
  packageVersion: string;
  entrypointBytes: Buffer;
  packageJsonBytes: Buffer;
  packageLockBytes: Buffer;
  builderBytes: Buffer;
}>;

export type NodeToolchainProvisionerBundleBuildInvocationV2 = Readonly<{
  executionRef: "first" | "second";
  executable: string;
  argv: readonly string[];
  cwd: string;
  env: Readonly<Record<string, string>>;
  shell: false;
  timeoutMs: number;
  maxStdoutBytes: number;
  maxStderrBytes: number;
  outputLocator: string;
  metadataLocator: string;
}>;

export type NodeToolchainProvisionerBundleBuildResultV2 = Readonly<{
  status: "exited" | "timed_out" | "output_limit_exceeded" | "spawn_failed";
  exitCode: number | null;
  signal: string | null;
  stdout: Uint8Array;
  stderr: Uint8Array;
}>;

export type NodeToolchainProvisionerBundleBuilderAdapterV2 = (
  invocation: NodeToolchainProvisionerBundleBuildInvocationV2,
) => Promise<NodeToolchainProvisionerBundleBuildResultV2>;

export type NodeToolchainProvisionerBundleAuthorityTestOptionsV2 = Readonly<{
  privateDependencyRoot: string;
}>;

type DependencyRootAuthorityV2 = Readonly<{
  kind: "repository";
  root: string;
}> | Readonly<{
  kind: "authenticated_private_test";
  root: string;
  architecture: ArchitectureV2;
  rootStat: Stats;
  scopeStat: Stats;
}>;

type AuthorityStateV2 = Readonly<{
  receipt: NodeToolchainProvisionerBundleAuthorityReceiptV2;
  bundleBytes: Buffer;
  entrypointSourceBytes: Buffer;
  packageJsonSourceBytes: Buffer;
  packageLockSourceBytes: Buffer;
}>;

export type NodeToolchainProvisionerBundleAuthoritySnapshotV2 = Readonly<{
  receipt: NodeToolchainProvisionerBundleAuthorityReceiptV2;
  bundleBytes: Buffer;
  entrypointSourceBytes: Buffer;
  packageJsonSourceBytes: Buffer;
  packageLockSourceBytes: Buffer;
}>;

const handleConstructorCapabilityV2 = Object.freeze({});
const authorityStateV2 = new WeakMap<object, AuthorityStateV2>();

export class BuiltNodeToolchainProvisionerBundleV2 {
  readonly receiptHash: string;

  constructor(capability: object, state: AuthorityStateV2) {
    if (capability !== handleConstructorCapabilityV2) {
      throw new NodeToolchainProvisionerBundleAuthorityErrorV2(
        "NODE_TOOLCHAIN_PROVISIONER_BUNDLE_V2_HANDLE_UNAUTHENTICATED",
        "Provisioner bundle authority constructor capability is unavailable",
      );
    }
    this.receiptHash = state.receipt.receiptHash;
    authorityStateV2.set(this, state);
    Object.freeze(this);
  }
}

function fail(
  code: NodeToolchainProvisionerBundleAuthorityErrorCodeV2,
  message: string,
  cause?: unknown,
): never {
  throw new NodeToolchainProvisionerBundleAuthorityErrorV2(
    code,
    message,
    cause === undefined ? undefined : { cause },
  );
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function sameStat(left: Stats, right: Stats): boolean {
  return left.dev === right.dev
    && left.ino === right.ino
    && left.mode === right.mode
    && left.uid === right.uid
    && left.gid === right.gid
    && left.nlink === right.nlink
    && left.size === right.size
    && left.mtimeMs === right.mtimeMs
    && left.ctimeMs === right.ctimeMs;
}

function closeQuietly(descriptor: number | undefined): void {
  if (descriptor === undefined) return;
  try {
    closeSync(descriptor);
  } catch {
    // The primary typed failure remains authoritative.
  }
}

function readStableFile(
  locator: string,
  maxBytes: number,
  code: NodeToolchainProvisionerBundleAuthorityErrorCodeV2,
  expectedMode?: number,
  allowedLinkCounts: readonly number[] = [1],
): Buffer {
  let descriptor: number | undefined;
  try {
    descriptor = openSync(
      locator,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
    const before = fstatSync(descriptor);
    if (
      !before.isFile()
      || !allowedLinkCounts.includes(before.nlink)
      || before.size < 1
      || before.size > maxBytes
      || (expectedMode !== undefined && (before.mode & 0o7777) !== expectedMode)
    ) {
      return fail(code, "Exact file is outside its bounded regular-file contract");
    }
    const bytes = Buffer.allocUnsafeSlow(before.size);
    let offset = 0;
    while (offset < bytes.byteLength) {
      const count = readSync(descriptor, bytes, offset, bytes.byteLength - offset, null);
      if (count < 1) return fail(code, "Exact file ended before its declared byte length");
      offset += count;
    }
    const eof = Buffer.allocUnsafe(1);
    if (readSync(descriptor, eof, 0, 1, null) !== 0) {
      return fail(code, "Exact file exceeded its declared byte length");
    }
    const after = fstatSync(descriptor);
    if (!sameStat(before, after)) return fail(code, "Exact file changed while being read");
    return bytes;
  } catch (error) {
    if (error instanceof NodeToolchainProvisionerBundleAuthorityErrorV2) throw error;
    return fail(code, "Exact no-follow file read failed", error);
  } finally {
    closeQuietly(descriptor);
  }
}

function runExact(
  executable: string,
  argv: readonly string[],
  cwd: string,
  code: NodeToolchainProvisionerBundleAuthorityErrorCodeV2,
  maxBuffer = SOURCE_MAX_BYTES_V2,
): Buffer {
  const result = spawnSync(executable, argv, {
    cwd,
    env: {
      GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_OPTIONAL_LOCKS: "0",
      HOME: "/var/empty",
      LANG: "C",
      LC_ALL: "C",
      PATH: "/usr/bin:/bin",
      TZ: "UTC",
    },
    encoding: "buffer",
    maxBuffer,
    timeout: BUILD_TIMEOUT_MS_V2,
    shell: false,
  });
  if (
    result.error
    || result.signal
    || result.status !== 0
    || (result.stderr?.byteLength ?? 0) !== 0
  ) {
    return fail(code, `Exact command failed: ${path.basename(executable)}`, result.error);
  }
  return Buffer.from(result.stdout ?? Buffer.alloc(0));
}

function gitBytes(argv: readonly string[], maxBuffer = SOURCE_MAX_BYTES_V2): Buffer {
  return runExact(GIT_PATH_V2, ["-C", repositoryRootV2, ...argv], repositoryRootV2,
    "NODE_TOOLCHAIN_PROVISIONER_BUNDLE_V2_GIT_AUTHORITY_INVALID", maxBuffer);
}

function gitText(argv: readonly string[]): string {
  const value = gitBytes(argv, 4 * 1024).toString("utf8").replace(/\n$/, "");
  if (value.includes("\n") || value.includes("\r") || value.includes("\0")) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BUNDLE_V2_GIT_AUTHORITY_INVALID",
      "Git identity command returned non-canonical text",
    );
  }
  return value;
}

function optionalGitText(argv: readonly string[]): string | null {
  const result = spawnSync(GIT_PATH_V2, ["-C", repositoryRootV2, ...argv], {
    cwd: repositoryRootV2,
    env: {
      GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_OPTIONAL_LOCKS: "0",
      HOME: "/var/empty",
      LANG: "C",
      LC_ALL: "C",
      PATH: "/usr/bin:/bin",
      TZ: "UTC",
    },
    encoding: "utf8",
    maxBuffer: 4 * 1024,
    timeout: BUILD_TIMEOUT_MS_V2,
    shell: false,
  });
  if (result.error || result.signal || (result.status !== 0 && result.status !== 128)) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BUNDLE_V2_GIT_AUTHORITY_INVALID",
      "Optional Git identity command failed unexpectedly",
      result.error,
    );
  }
  if (result.status !== 0) return null;
  const value = result.stdout.replace(/\n$/, "");
  if (value.includes("\n") || value.includes("\r") || value.includes("\0")) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BUNDLE_V2_GIT_AUTHORITY_INVALID",
      "Optional Git identity returned non-canonical text",
    );
  }
  return value;
}

type SourceLocatorV2 =
  | "package.json"
  | "package-lock.json"
  | typeof NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ENTRYPOINT_SOURCE_LOCATOR_V2
  | typeof NODE_TOOLCHAIN_PROVISIONER_BUNDLE_BUILDER_SOURCE_LOCATOR_V2;
type SourceMediaTypeV2 = "application/json" | "text/typescript" | "text/javascript";

function sourceRef<L extends SourceLocatorV2, M extends SourceMediaTypeV2>(
  locator: L,
  mediaType: M,
  bytes: Uint8Array,
): Readonly<{
  schema: "setfarm.source-artifact-ref.v1";
  locator: L;
  mediaType: M;
  byteLength: number;
  hash: string;
}> {
  return Object.freeze({
    schema: "setfarm.source-artifact-ref.v1" as const,
    locator,
    mediaType,
    byteLength: bytes.byteLength,
    hash: sha256(bytes),
  });
}

function exactObject(value: unknown, label: string): Record<string, unknown> {
  if (
    typeof value !== "object"
    || value === null
    || Array.isArray(value)
    || isProxy(value)
    || Object.getPrototypeOf(value) !== Object.prototype
  ) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BUNDLE_V2_SOURCE_INVALID",
      `${label} must be one exact JSON object`,
    );
  }
  return value as Record<string, unknown>;
}

function parseJsonObject(bytes: Uint8Array, label: string): Record<string, unknown> {
  try {
    return exactObject(JSON.parse(Buffer.from(bytes).toString("utf8")), label);
  } catch (error) {
    if (error instanceof NodeToolchainProvisionerBundleAuthorityErrorV2) throw error;
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BUNDLE_V2_SOURCE_INVALID",
      `${label} is not canonical parseable JSON`,
      error,
    );
  }
}

function validatePackageContractSources(
  packageJsonBytes: Uint8Array,
  packageLockBytes: Uint8Array,
  architecture: ArchitectureV2,
): string {
  const packageJson = parseJsonObject(packageJsonBytes, "package.json");
  const devDependencies = exactObject(packageJson.devDependencies, "package.json devDependencies");
  const dependencies = exactObject(packageJson.dependencies, "package.json dependencies");
  if (
    packageJson.name !== "setfarm"
    || typeof packageJson.version !== "string"
    || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(packageJson.version)
    || devDependencies.esbuild !== "0.28.1"
    || dependencies.zod !== "^4.4.3"
  ) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BUNDLE_V2_SOURCE_INVALID",
      "Setfarm package manifest does not pin the exact provisioner build closure",
    );
  }
  const lock = parseJsonObject(packageLockBytes, "package-lock.json");
  const packages = exactObject(lock.packages, "package-lock.json packages");
  const root = exactObject(packages[""], "package-lock.json root package");
  const rootDevDependencies = exactObject(root.devDependencies, "lock root devDependencies");
  const rootDependencies = exactObject(root.dependencies, "lock root dependencies");
  const expected = ARCHITECTURE_CONTRACTS_V2[architecture];
  const entries = [expected.esbuild, expected.platform, ZOD_CONTRACT_V2];
  if (rootDevDependencies.esbuild !== "0.28.1" || rootDependencies.zod !== "^4.4.3") {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BUNDLE_V2_SOURCE_INVALID",
      "Lock root does not equal the package manifest build closure",
    );
  }
  for (const contract of entries) {
    const locator = `node_modules/${contract.packageName}`;
    const entry = exactObject(packages[locator], `lock entry ${locator}`);
    if (
      entry.version !== contract.version
      || entry.resolved !== contract.registryTarballUrl
      || entry.integrity !== contract.registryIntegrity
    ) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_BUNDLE_V2_SOURCE_INVALID",
        `Lock entry ${locator} differs from the code-owned registry contract`,
      );
    }
  }
  return packageJson.version;
}

function captureGitIdentity(
  scope: "production_release" | "test_fixture",
  architecture: ArchitectureV2,
): GitIdentityV2 {
  const codeSha = gitText(["rev-parse", "HEAD"]);
  const sourceTreeHash = gitText(["rev-parse", "HEAD^{tree}"]);
  const branch = gitText(["symbolic-ref", "--short", "HEAD"]);
  const originMainSha = optionalGitText(["rev-parse", "--verify", "origin/main"]);
  const status = gitBytes(["status", "--porcelain=v1", "--untracked-files=all"], 16 * 1024 * 1024);
  const dirty = status.byteLength > 0;
  const tree = gitBytes(["ls-tree", "-rz", "--full-tree", "HEAD"], 64 * 1024 * 1024);
  for (const record of tree.toString("utf8").split("\0")) {
    if (record === "") continue;
    const match = /^(\d{6}) (\S+) ([a-f0-9]{40,64})\t(.+)$/.exec(record);
    if (!match || match[2] !== "blob" || !["100644", "100755"].includes(match[1])) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_BUNDLE_V2_GIT_AUTHORITY_INVALID",
        "Provisioner release tree contains a link, submodule or non-blob entry",
      );
    }
    const locator = match[4];
    if (
      locator.startsWith("/")
      || locator.includes("\\")
      || locator.includes("\r")
      || locator.includes("\n")
      || locator.split("/").some((segment) => segment === "" || segment === "." || segment === "..")
    ) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_BUNDLE_V2_GIT_AUTHORITY_INVALID",
        "Provisioner release tree contains a non-canonical locator",
      );
    }
  }
  if (
    !/^[a-f0-9]{40}$|^[a-f0-9]{64}$/.test(codeSha)
    || !/^[a-f0-9]{40}$|^[a-f0-9]{64}$/.test(sourceTreeHash)
    || (scope === "production_release" && (
      branch !== "main"
      || dirty
      || originMainSha !== codeSha
      || process.platform !== "darwin"
      || process.arch !== architecture
    ))
  ) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BUNDLE_V2_GIT_AUTHORITY_INVALID",
      "Production bundle authority requires clean main equal to origin/main on its target architecture",
    );
  }
  const entrypointBytes = gitBytes(["show", `HEAD:${NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ENTRYPOINT_SOURCE_LOCATOR_V2}`]);
  const packageJsonBytes = gitBytes(["show", "HEAD:package.json"]);
  const packageLockBytes = gitBytes(["show", "HEAD:package-lock.json"]);
  const builderPath = path.join(repositoryRootV2, NODE_TOOLCHAIN_PROVISIONER_BUNDLE_BUILDER_SOURCE_LOCATOR_V2);
  const builderBytes = readStableFile(
    builderPath,
    SOURCE_MAX_BYTES_V2,
    "NODE_TOOLCHAIN_PROVISIONER_BUNDLE_V2_SOURCE_INVALID",
  );
  if (scope === "production_release") {
    const committedBuilder = gitBytes([
      "show",
      `HEAD:${NODE_TOOLCHAIN_PROVISIONER_BUNDLE_BUILDER_SOURCE_LOCATOR_V2}`,
    ]);
    if (!builderBytes.equals(committedBuilder)) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_BUNDLE_V2_SOURCE_INVALID",
        "Production builder bytes differ from the exact release tree",
      );
    }
  }
  const packageVersion = validatePackageContractSources(
    packageJsonBytes,
    packageLockBytes,
    architecture,
  );
  return Object.freeze({
    codeSha,
    sourceTreeHash,
    branch,
    originMainSha,
    dirty,
    packageVersion,
    entrypointBytes,
    packageJsonBytes,
    packageLockBytes,
    builderBytes,
  });
}

function packageTreeHash(entries: readonly PackageEntryV2[]): string {
  return sha256(canonicalJsonBytes({
    schema: "setfarm.npm-package-content-tree.v2",
    entries: entries.map((entry) => entry.type === "directory"
      ? { locator: entry.locator, type: entry.type }
      : {
        locator: entry.locator,
        type: entry.type,
        byteLength: entry.byteLength,
        sha256: entry.contentHash,
      }),
  }));
}

function capturePackageTree(
  dependencyRoot: string,
  contract: ExactPackageContractV2,
): CapturedPackageV2 {
  const packageRoot = path.join(dependencyRoot, contract.packageName);
  const pending = ["."];
  const entries: PackageEntryV2[] = [];
  let fileCount = 0;
  let directoryCount = 0;
  let totalBytes = 0;
  try {
    while (pending.length > 0) {
      const locator = pending.pop()!;
      const absolute = locator === "." ? packageRoot : path.join(packageRoot, locator);
      const stat = lstatSync(absolute);
      if (stat.isSymbolicLink()) {
        return fail(
          "NODE_TOOLCHAIN_PROVISIONER_BUNDLE_V2_DEPENDENCY_INVALID",
          `${contract.packageName} contains a symbolic link`,
        );
      }
      if (stat.isDirectory()) {
        directoryCount += 1;
        if (directoryCount > PACKAGE_MAX_DIRECTORIES_V2) {
          return fail(
            "NODE_TOOLCHAIN_PROVISIONER_BUNDLE_V2_DEPENDENCY_INVALID",
            `${contract.packageName} exceeds its directory bound`,
          );
        }
        entries.push(Object.freeze({
          locator,
          type: "directory",
          byteLength: 0,
          contentHash: null,
          bytes: null,
          device: stat.dev,
          inode: stat.ino,
          linkCount: stat.nlink,
        }));
        const names = readdirSync(absolute).sort().reverse();
        for (const name of names) {
          if (
            name === ""
            || name === "."
            || name === ".."
            || name.includes("/")
            || name.includes("\\")
            || name.includes("\0")
            || name.includes("\n")
            || name.includes("\r")
          ) {
            return fail(
              "NODE_TOOLCHAIN_PROVISIONER_BUNDLE_V2_DEPENDENCY_INVALID",
              `${contract.packageName} contains a non-canonical path segment`,
            );
          }
          pending.push(locator === "." ? name : `${locator}/${name}`);
        }
        continue;
      }
      const officialBinaryPair = locator === "bin/esbuild"
        && (contract.packageName === "esbuild" || contract.packageName.startsWith("@esbuild/"));
      if (!stat.isFile() || (!officialBinaryPair && stat.nlink !== 1)
        || (officialBinaryPair && stat.nlink !== 1 && stat.nlink !== 2)) {
        return fail(
          "NODE_TOOLCHAIN_PROVISIONER_BUNDLE_V2_DEPENDENCY_INVALID",
          `${contract.packageName} contains a non-regular or multiply-linked entry`,
        );
      }
      const bytes = readStableFile(
        absolute,
        PACKAGE_MAX_TOTAL_BYTES_V2,
        "NODE_TOOLCHAIN_PROVISIONER_BUNDLE_V2_DEPENDENCY_INVALID",
        undefined,
        officialBinaryPair ? [1, 2] : [1],
      );
      fileCount += 1;
      totalBytes += bytes.byteLength;
      if (fileCount > PACKAGE_MAX_FILES_V2 || totalBytes > PACKAGE_MAX_TOTAL_BYTES_V2) {
        bytes.fill(0);
        return fail(
          "NODE_TOOLCHAIN_PROVISIONER_BUNDLE_V2_DEPENDENCY_INVALID",
          `${contract.packageName} exceeds its file or byte bound`,
        );
      }
      entries.push(Object.freeze({
        locator,
        type: "file",
        byteLength: bytes.byteLength,
        contentHash: sha256(bytes),
        bytes,
        device: stat.dev,
        inode: stat.ino,
        linkCount: stat.nlink,
      }));
    }
  } catch (error) {
    for (const entry of entries) entry.bytes?.fill(0);
    if (error instanceof NodeToolchainProvisionerBundleAuthorityErrorV2) throw error;
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BUNDLE_V2_DEPENDENCY_INVALID",
      `${contract.packageName} could not be captured exactly`,
      error,
    );
  }
  entries.sort((left, right) => Buffer.from(left.locator).compare(Buffer.from(right.locator)));
  if (
    fileCount !== contract.fileCount
    || directoryCount !== contract.directoryCount
    || totalBytes !== contract.totalBytes
    || packageTreeHash(entries) !== contract.installedContentTreeHash
  ) {
    for (const entry of entries) entry.bytes?.fill(0);
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BUNDLE_V2_DEPENDENCY_INVALID",
      `${contract.packageName} differs from its code-owned official content tree`,
    );
  }
  return Object.freeze({ contract, entries: Object.freeze(entries) });
}

function exactDirectoryNames(locator: string): readonly string[] {
  try {
    return Object.freeze(readdirSync(locator).sort());
  } catch (error) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BUNDLE_V2_DEPENDENCY_INVALID",
      "Private test dependency root could not be inventoried exactly",
      error,
    );
  }
}

function admitPrivateTestDependencyRoot(
  options: NodeToolchainProvisionerBundleAuthorityTestOptionsV2 | undefined,
  architecture: ArchitectureV2,
): DependencyRootAuthorityV2 {
  if (options === undefined) {
    return Object.freeze({
      kind: "repository" as const,
      root: path.join(repositoryRootV2, "node_modules"),
    });
  }
  if (
    typeof options !== "object"
    || options === null
    || Array.isArray(options)
    || isProxy(options)
    || Object.getPrototypeOf(options) !== Object.prototype
    || !Object.isFrozen(options)
  ) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BUNDLE_V2_INPUT_INVALID",
      "Private test dependency options must be one frozen exact object",
    );
  }
  const descriptors = Object.getOwnPropertyDescriptors(options);
  if (
    Reflect.ownKeys(descriptors).length !== 1
    || !("privateDependencyRoot" in descriptors)
    || descriptors.privateDependencyRoot?.get !== undefined
    || descriptors.privateDependencyRoot?.set !== undefined
    || descriptors.privateDependencyRoot?.enumerable !== true
    || descriptors.privateDependencyRoot?.value !== options.privateDependencyRoot
    || typeof descriptors.privateDependencyRoot?.value !== "string"
  ) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BUNDLE_V2_INPUT_INVALID",
      "Private test dependency options contain unknown or active fields",
    );
  }
  const requestedRoot = descriptors.privateDependencyRoot.value as string;
  if (
    requestedRoot.length < 1
    || requestedRoot.length > 1_024
    || !path.isAbsolute(requestedRoot)
    || path.normalize(requestedRoot) !== requestedRoot
    || requestedRoot.includes("\0")
    || requestedRoot.includes("\n")
    || requestedRoot.includes("\r")
  ) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BUNDLE_V2_INPUT_INVALID",
      "Private test dependency root is not one canonical absolute path",
    );
  }
  let root: string;
  let rootStat: Stats;
  let scopeStat: Stats;
  try {
    root = realpathSync(requestedRoot);
    rootStat = lstatSync(root);
    scopeStat = lstatSync(path.join(root, "@esbuild"));
  } catch (error) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BUNDLE_V2_DEPENDENCY_INVALID",
      "Private test dependency root could not be authenticated",
      error,
    );
  }
  const expectedPlatform = architecture === "arm64" ? "darwin-arm64" : "darwin-x64";
  if (
    root !== requestedRoot
    || !rootStat.isDirectory()
    || rootStat.isSymbolicLink()
    || (rootStat.mode & 0o7777) !== 0o700
    || rootStat.uid !== process.getuid?.()
    || !scopeStat.isDirectory()
    || scopeStat.isSymbolicLink()
    || scopeStat.uid !== rootStat.uid
    || exactDirectoryNames(root).join("\0") !== "@esbuild\0esbuild\0zod"
    || exactDirectoryNames(path.join(root, "@esbuild")).join("\0") !== expectedPlatform
  ) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BUNDLE_V2_DEPENDENCY_INVALID",
      "Private test dependency root is not one exact process-owned closure",
    );
  }
  return Object.freeze({
    kind: "authenticated_private_test" as const,
    root,
    architecture,
    rootStat,
    scopeStat,
  });
}

function revalidatePrivateTestDependencyRoot(authority: DependencyRootAuthorityV2): void {
  if (authority.kind !== "authenticated_private_test") return;
  const scope = path.join(authority.root, "@esbuild");
  const expectedPlatform = authority.architecture === "arm64" ? "darwin-arm64" : "darwin-x64";
  let rootStat: Stats;
  let scopeStat: Stats;
  try {
    rootStat = lstatSync(authority.root);
    scopeStat = lstatSync(scope);
  } catch (error) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BUNDLE_V2_DEPENDENCY_INVALID",
      "Private test dependency root disappeared during capture",
      error,
    );
  }
  if (
    !sameStat(rootStat, authority.rootStat)
    || !sameStat(scopeStat, authority.scopeStat)
    || exactDirectoryNames(authority.root).join("\0") !== "@esbuild\0esbuild\0zod"
    || exactDirectoryNames(scope).join("\0") !== expectedPlatform
  ) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BUNDLE_V2_DEPENDENCY_INVALID",
      "Private test dependency root changed during exact capture",
    );
  }
}

function writeExclusive(locator: string, bytes: Uint8Array, mode: number): void {
  let descriptor: number | undefined;
  try {
    descriptor = openSync(
      locator,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
      0o600,
    );
    let offset = 0;
    while (offset < bytes.byteLength) {
      const count = writeSync(descriptor, bytes, offset, bytes.byteLength - offset);
      if (count < 1) {
        return fail(
          "NODE_TOOLCHAIN_PROVISIONER_BUNDLE_V2_STAGE_INVALID",
          "Private stage write made no forward progress",
        );
      }
      offset += count;
    }
    fchmodSync(descriptor, mode);
    fsyncSync(descriptor);
    const stat = fstatSync(descriptor);
    if (
      !stat.isFile()
      || stat.nlink !== 1
      || stat.size !== bytes.byteLength
      || (stat.mode & 0o7777) !== mode
    ) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_BUNDLE_V2_STAGE_INVALID",
        "Private stage file lost its exact identity",
      );
    }
  } catch (error) {
    if (error instanceof NodeToolchainProvisionerBundleAuthorityErrorV2) throw error;
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BUNDLE_V2_STAGE_INVALID",
      "Private stage file could not be written exclusively",
      error,
    );
  } finally {
    closeQuietly(descriptor);
  }
}

function syncDirectory(locator: string): void {
  const descriptor = openSync(locator, constants.O_RDONLY);
  try {
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

function materializePackage(root: string, captured: CapturedPackageV2): void {
  mkdirSync(root, { mode: 0o700 });
  const directories = captured.entries
    .filter((entry) => entry.type === "directory" && entry.locator !== ".")
    .sort((left, right) => left.locator.split("/").length - right.locator.split("/").length);
  for (const directory of directories) {
    mkdirSync(path.join(root, directory.locator), { mode: 0o700 });
  }
  for (const file of captured.entries.filter((entry) => entry.type === "file")) {
    writeExclusive(
      path.join(root, file.locator),
      file.bytes!,
      file.locator === "bin/esbuild" ? 0o500 : 0o400,
    );
  }
  for (const directory of [...directories].reverse()) {
    syncDirectory(path.join(root, directory.locator));
  }
  syncDirectory(root);
}

function materializeGitArchive(stageRoot: string, sourceRoot: string): void {
  const archive = path.join(stageRoot, "source.tar");
  runExact(
    GIT_PATH_V2,
    ["-C", repositoryRootV2, "archive", "--format=tar", `--output=${archive}`, "HEAD"],
    repositoryRootV2,
    "NODE_TOOLCHAIN_PROVISIONER_BUNDLE_V2_SOURCE_INVALID",
    64 * 1024,
  );
  runExact(
    BSDTAR_PATH_V2,
    ["-xf", archive, "-C", sourceRoot],
    stageRoot,
    "NODE_TOOLCHAIN_PROVISIONER_BUNDLE_V2_SOURCE_INVALID",
    64 * 1024,
  );
  unlinkSync(archive);
  if (readdirSync(sourceRoot).includes("node_modules")) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BUNDLE_V2_SOURCE_INVALID",
      "Release source archive must not contain ambient node_modules",
    );
  }
}

function productionBuilderAdapter(
  invocation: NodeToolchainProvisionerBundleBuildInvocationV2,
): Promise<NodeToolchainProvisionerBundleBuildResultV2> {
  const result = spawnSync(invocation.executable, invocation.argv, {
    cwd: invocation.cwd,
    env: { ...invocation.env },
    encoding: "buffer",
    maxBuffer: Math.max(invocation.maxStdoutBytes, invocation.maxStderrBytes),
    timeout: invocation.timeoutMs,
    shell: false,
  });
  const stdout = Buffer.from(result.stdout ?? Buffer.alloc(0));
  const stderr = Buffer.from(result.stderr ?? Buffer.alloc(0));
  if (result.error && (result.error as NodeJS.ErrnoException).code === "ETIMEDOUT") {
    return Promise.resolve(Object.freeze({
      status: "timed_out" as const,
      exitCode: null,
      signal: result.signal,
      stdout,
      stderr,
    }));
  }
  if (result.error) {
    return Promise.resolve(Object.freeze({
      status: "spawn_failed" as const,
      exitCode: result.status,
      signal: result.signal,
      stdout,
      stderr,
    }));
  }
  if (
    stdout.byteLength > invocation.maxStdoutBytes
    || stderr.byteLength > invocation.maxStderrBytes
  ) {
    return Promise.resolve(Object.freeze({
      status: "output_limit_exceeded" as const,
      exitCode: result.status,
      signal: result.signal,
      stdout,
      stderr,
    }));
  }
  return Promise.resolve(Object.freeze({
    status: "exited" as const,
    exitCode: result.status,
    signal: result.signal,
    stdout,
    stderr,
  }));
}

type BuildMetadataV2 = Readonly<{
  inputLocators: readonly string[];
  externalNodeBuiltins: readonly string[];
  bundleHash: string;
  bundleByteLength: number;
}>;

function parseBuildMetadata(bytes: Uint8Array): BuildMetadataV2 {
  let value: Record<string, unknown>;
  try {
    value = exactObject(JSON.parse(Buffer.from(bytes).toString("utf8")), "build metadata");
  } catch (error) {
    if (error instanceof NodeToolchainProvisionerBundleAuthorityErrorV2) throw error;
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BUNDLE_V2_BUILD_OUTPUT_INVALID",
      "Build metadata is not parseable exact JSON",
      error,
    );
  }
  if (!canonicalJsonBytes(value).equals(Buffer.from(bytes))) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BUNDLE_V2_BUILD_OUTPUT_INVALID",
      "Build metadata must be exact canonical JSON without trailing bytes",
    );
  }
  const keys = Object.keys(value).sort();
  const bundle = exactObject(value.bundle, "build metadata bundle");
  if (
    keys.join("|") !== "bundle|esbuildVersion|externalNodeBuiltins|inputLocators|schema"
    || value.schema !== "setfarm.node-toolchain-provisioner-bundle-build-metadata.v2"
    || value.esbuildVersion !== "0.28.1"
    || !Array.isArray(value.inputLocators)
    || !Array.isArray(value.externalNodeBuiltins)
    || typeof bundle.sha256 !== "string"
    || typeof bundle.byteLength !== "number"
  ) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BUNDLE_V2_BUILD_OUTPUT_INVALID",
      "Build metadata differs from its exact protocol",
    );
  }
  const inputLocators = value.inputLocators;
  const externalNodeBuiltins = value.externalNodeBuiltins;
  if (
    inputLocators.length < 1
    || inputLocators.length > 2_000
    || inputLocators.some((entry) => typeof entry !== "string")
    || externalNodeBuiltins.length < 1
    || externalNodeBuiltins.length > 256
    || externalNodeBuiltins.some((entry) => typeof entry !== "string")
  ) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BUNDLE_V2_BUILD_OUTPUT_INVALID",
      "Build metadata dependency sets are outside their bounds",
    );
  }
  return Object.freeze({
    inputLocators: Object.freeze([...inputLocators] as string[]),
    externalNodeBuiltins: Object.freeze([...externalNodeBuiltins] as string[]),
    bundleHash: bundle.sha256,
    bundleByteLength: bundle.byteLength,
  });
}

function verifyInputLocators(inputLocators: readonly string[], sourceRoot: string): void {
  if (
    inputLocators[0] === undefined
    || !inputLocators.includes(NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ENTRYPOINT_SOURCE_LOCATOR_V2)
    || new Set(inputLocators).size !== inputLocators.length
    || [...inputLocators].sort().some((entry, index) => entry !== inputLocators[index])
  ) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BUNDLE_V2_BUILD_OUTPUT_INVALID",
      "Build input set does not include one canonical exact entrypoint",
    );
  }
  for (const locator of inputLocators) {
    if (
      path.isAbsolute(locator)
      || locator.includes("\\")
      || locator.includes("\0")
      || locator.includes("\n")
      || locator.includes("\r")
      || locator.split("/").some((segment) => segment === "" || segment === "." || segment === "..")
      || (locator.startsWith("node_modules/") && !locator.startsWith("node_modules/zod/"))
    ) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_BUNDLE_V2_BUILD_OUTPUT_INVALID",
        "Build input set contains a non-canonical or unowned dependency",
      );
    }
    const stageBytes = readStableFile(
      path.join(sourceRoot, locator),
      SOURCE_MAX_BYTES_V2,
      "NODE_TOOLCHAIN_PROVISIONER_BUNDLE_V2_BUILD_OUTPUT_INVALID",
    );
    if (!locator.startsWith("node_modules/")) {
      const gitSource = gitBytes(["show", `HEAD:${locator}`]);
      if (!stageBytes.equals(gitSource)) {
        return fail(
          "NODE_TOOLCHAIN_PROVISIONER_BUNDLE_V2_BUILD_OUTPUT_INVALID",
          "Build input bytes differ from the exact Git release source",
        );
      }
    }
  }
}

type ExecutionEvidenceV2 = Readonly<{
  executionRef: "first" | "second";
  bundleBytes: Buffer;
  metadata: BuildMetadataV2;
  metadataBytes: Buffer;
}>;

async function executeBuild(
  executionRef: "first" | "second",
  adapter: NodeToolchainProvisionerBundleBuilderAdapterV2,
  paths: Readonly<{
    stageRoot: string;
    sourceRoot: string;
    runtime: string;
    builder: string;
    home: string;
    temp: string;
  }>,
): Promise<ExecutionEvidenceV2> {
  const outputLocator = path.join(paths.stageRoot, `bundle-${executionRef}.cjs`);
  const metadataLocator = path.join(paths.stageRoot, `bundle-${executionRef}.json`);
  const invocation: NodeToolchainProvisionerBundleBuildInvocationV2 = Object.freeze({
    executionRef,
    executable: paths.runtime,
    argv: Object.freeze([
      paths.builder,
      "--runtime",
      paths.runtime,
      "--source-root",
      paths.sourceRoot,
      "--out-file",
      outputLocator,
      "--metadata-file",
      metadataLocator,
    ]),
    cwd: paths.stageRoot,
    env: Object.freeze({
      HOME: paths.home,
      LANG: "C",
      LC_ALL: "C",
      NO_COLOR: "1",
      TMPDIR: paths.temp,
      TZ: "UTC",
      SETFARM_NODE_TOOLCHAIN_PROVISIONER_BUNDLE_BUILD_V2: "1",
    }),
    shell: false,
    timeoutMs: BUILD_TIMEOUT_MS_V2,
    maxStdoutBytes: BUILD_OUTPUT_LIMIT_V2,
    maxStderrBytes: BUILD_OUTPUT_LIMIT_V2,
    outputLocator,
    metadataLocator,
  });
  let result: NodeToolchainProvisionerBundleBuildResultV2;
  try {
    result = await adapter(invocation);
  } catch (error) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BUNDLE_V2_BUILD_FAILED",
      "Provisioner bundle build adapter threw",
      error,
    );
  }
  if (
    !result
    || typeof result !== "object"
    || isProxy(result)
    || result.status !== "exited"
    || result.exitCode !== 0
    || result.signal !== null
    || !(result.stdout instanceof Uint8Array)
    || !(result.stderr instanceof Uint8Array)
    || isProxy(result.stdout)
    || isProxy(result.stderr)
    || result.stdout.byteLength !== 0
    || result.stderr.byteLength !== 0
  ) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BUNDLE_V2_BUILD_FAILED",
      "Provisioner bundle build did not exit silently and successfully",
    );
  }
  const bundleBytes = readStableFile(
    outputLocator,
    NODE_TOOLCHAIN_PROVISIONER_BUNDLE_MAX_BYTES_V2,
    "NODE_TOOLCHAIN_PROVISIONER_BUNDLE_V2_BUILD_OUTPUT_INVALID",
    0o600,
  );
  const metadataBytes = readStableFile(
    metadataLocator,
    NODE_TOOLCHAIN_PROVISIONER_BUNDLE_MAX_METADATA_BYTES_V2,
    "NODE_TOOLCHAIN_PROVISIONER_BUNDLE_V2_BUILD_OUTPUT_INVALID",
    0o600,
  );
  const metadata = parseBuildMetadata(metadataBytes);
  if (
    metadata.bundleHash !== sha256(bundleBytes)
    || metadata.bundleByteLength !== bundleBytes.byteLength
  ) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BUNDLE_V2_BUILD_OUTPUT_INVALID",
      "Provisioner bundle bytes differ from their build metadata",
    );
  }
  verifyInputLocators(metadata.inputLocators, paths.sourceRoot);
  return Object.freeze({ executionRef, bundleBytes, metadata, metadataBytes });
}

function defensiveReceiptCopy(
  receipt: NodeToolchainProvisionerBundleAuthorityReceiptV2,
): NodeToolchainProvisionerBundleAuthorityReceiptV2 {
  return structuredClone(receipt);
}

function authenticState(handle: BuiltNodeToolchainProvisionerBundleV2): AuthorityStateV2 {
  if (
    typeof handle !== "object"
    || handle === null
    || isProxy(handle)
    || Object.getPrototypeOf(handle) !== BuiltNodeToolchainProvisionerBundleV2.prototype
  ) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BUNDLE_V2_HANDLE_UNAUTHENTICATED",
      "Provisioner bundle operation requires one authentic handle",
    );
  }
  const state = authorityStateV2.get(handle);
  if (!state) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BUNDLE_V2_HANDLE_UNAUTHENTICATED",
      "Provisioner bundle operation requires one authentic handle",
    );
  }
  return state;
}

function zeroPrivateTreeBundle(bundle: NodeToolchainPrivateTreeBundleV2 | undefined): void {
  if (!bundle) return;
  for (const entry of bundle.entries) entry.bytes?.fill(0);
}

function zeroCapturedPackages(packages: readonly CapturedPackageV2[]): void {
  for (const captured of packages) {
    for (const entry of captured.entries) entry.bytes?.fill(0);
  }
}

async function buildAuthority(
  privateTreeHandle: MaterializedNodeToolchainPrivateTreeV2,
  admissionScope: "production_release" | "test_fixture",
  adapter: NodeToolchainProvisionerBundleBuilderAdapterV2,
  dependencyRootAuthority: DependencyRootAuthorityV2,
): Promise<BuiltNodeToolchainProvisionerBundleV2> {
  if (typeof adapter !== "function") {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BUNDLE_V2_INPUT_INVALID",
      "Provisioner bundle authority requires one exact builder adapter",
    );
  }
  const privateTreeReceipt = inspectNodeToolchainPrivateTreeReceiptV2(privateTreeHandle);
  const architecture = privateTreeReceipt.inventory.distribution.artifact.architecture;
  if (architecture !== "arm64" && architecture !== "x64") {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BUNDLE_V2_INPUT_INVALID",
      "Provisioner bundle authority supports only Darwin arm64 and x64",
    );
  }
  if (
    (admissionScope === "production_release"
      && privateTreeReceipt.admissionScope !== "production_distribution")
    || (admissionScope === "test_fixture" && privateTreeReceipt.admissionScope !== "test_fixture")
  ) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BUNDLE_V2_INPUT_INVALID",
      "Provisioner bundle scope must equal its authenticated private runtime scope",
    );
  }
  const git = captureGitIdentity(admissionScope, architecture);
  const contracts = ARCHITECTURE_CONTRACTS_V2[architecture];
  const capturedPackages: CapturedPackageV2[] = [];
  let privateBundle: NodeToolchainPrivateTreeBundleV2 | undefined;
  let stageRoot: string | undefined;
  try {
    const esbuild = capturePackageTree(dependencyRootAuthority.root, contracts.esbuild);
    capturedPackages.push(esbuild);
    const platform = capturePackageTree(dependencyRootAuthority.root, contracts.platform);
    capturedPackages.push(platform);
    const zod = capturePackageTree(dependencyRootAuthority.root, ZOD_CONTRACT_V2);
    capturedPackages.push(zod);
    revalidatePrivateTestDependencyRoot(dependencyRootAuthority);
    const genericBinary = esbuild.entries.find((entry) => entry.locator === "bin/esbuild");
    const platformBinary = platform.entries.find((entry) => entry.locator === "bin/esbuild");
    if (
      !genericBinary?.bytes
      || !platformBinary?.bytes
      || !genericBinary.bytes.equals(platformBinary.bytes)
      || genericBinary.linkCount !== platformBinary.linkCount
      || (genericBinary.linkCount === 2 && (
        genericBinary.device !== platformBinary.device
        || genericBinary.inode !== platformBinary.inode
      ))
    ) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_BUNDLE_V2_DEPENDENCY_INVALID",
        "Installed esbuild binary does not equal its exact official platform package",
      );
    }
    privateBundle = await copyMaterializedNodeToolchainPrivateTreeBundleV2(privateTreeHandle);
    const runtimeEntry = privateBundle.entries.find((entry) => entry.locator === "bin/node");
    if (
      !runtimeEntry?.bytes
      || runtimeEntry.contentHash !== privateTreeReceipt.tree.node.contentHash
      || runtimeEntry.byteLength !== privateTreeReceipt.tree.node.byteLength
    ) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_BUNDLE_V2_INPUT_INVALID",
        "Authenticated private tree did not reproduce its exact Node runtime",
      );
    }
    stageRoot = realpathSync(mkdtempSync(STAGE_PREFIX_V2));
    chmodSync(stageRoot, 0o700);
    const stageStat = lstatSync(stageRoot);
    if (
      !stageStat.isDirectory()
      || stageStat.isSymbolicLink()
      || (stageStat.mode & 0o7777) !== 0o700
      || stageStat.uid !== process.getuid?.()
    ) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_BUNDLE_V2_STAGE_INVALID",
        "Provisioner bundle stage is not one private process-owned directory",
      );
    }
    const sourceRoot = path.join(stageRoot, "source");
    const runtimeRoot = path.join(stageRoot, "runtime");
    const home = path.join(stageRoot, "home");
    const temp = path.join(stageRoot, "tmp");
    mkdirSync(sourceRoot, { mode: 0o700 });
    mkdirSync(runtimeRoot, { mode: 0o700 });
    mkdirSync(home, { mode: 0o700 });
    mkdirSync(temp, { mode: 0o700 });
    materializeGitArchive(stageRoot, sourceRoot);
    const nodeModules = path.join(sourceRoot, "node_modules");
    const scopeRoot = path.join(nodeModules, "@esbuild");
    mkdirSync(nodeModules, { mode: 0o700 });
    mkdirSync(scopeRoot, { mode: 0o700 });
    materializePackage(path.join(nodeModules, "esbuild"), esbuild);
    materializePackage(path.join(scopeRoot, architecture === "arm64" ? "darwin-arm64" : "darwin-x64"), platform);
    materializePackage(path.join(nodeModules, "zod"), zod);
    const runtime = path.join(runtimeRoot, "node");
    const builder = path.join(stageRoot, "builder.mjs");
    writeExclusive(runtime, runtimeEntry.bytes, 0o500);
    writeExclusive(builder, git.builderBytes, 0o400);
    syncDirectory(runtimeRoot);
    syncDirectory(stageRoot);
    const paths = Object.freeze({ stageRoot, sourceRoot, runtime, builder, home, temp });
    const first = await executeBuild("first", adapter, paths);
    const second = await executeBuild("second", adapter, paths);
    if (
      !first.bundleBytes.equals(second.bundleBytes)
      || !first.metadataBytes.equals(second.metadataBytes)
      || first.metadata.inputLocators.join("\0") !== second.metadata.inputLocators.join("\0")
      || first.metadata.externalNodeBuiltins.join("\0")
        !== second.metadata.externalNodeBuiltins.join("\0")
    ) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_BUNDLE_V2_NONDETERMINISTIC",
        "Two fresh provisioner bundle executions did not reproduce identical evidence",
      );
    }
    const dependencyIdentity = {
      contractRef: "NODE_TOOLCHAIN_PROVISIONER_BUNDLE_DEPENDENCY_CLOSURE_V2" as const,
      platformPackageName: contracts.platform.packageName as
        "@esbuild/darwin-arm64" | "@esbuild/darwin-x64",
      esbuild: contracts.esbuild,
      platformBinary: contracts.platform,
      zod: ZOD_CONTRACT_V2,
      privateMaterializationPolicy:
        "fresh_0700_root_exclusive_files_fsync_exact_tree_v2" as const,
    };
    const executionReceipt = (execution: ExecutionEvidenceV2) => Object.freeze({
      executionRef: execution.executionRef,
      exitCode: 0 as const,
      stdoutBytes: 0 as const,
      stderrBytes: 0 as const,
      outputHash: sha256(execution.bundleBytes),
      outputByteLength: execution.bundleBytes.byteLength,
      metadataHash: sha256(execution.metadataBytes),
      metadataByteLength: execution.metadataBytes.byteLength,
    });
    const identity: NodeToolchainProvisionerBundleAuthorityReceiptHashPayloadV2 = {
      schema: NODE_TOOLCHAIN_PROVISIONER_BUNDLE_AUTHORITY_RECEIPT_V2_SCHEMA,
      receiptVersion: NODE_TOOLCHAIN_PROVISIONER_BUNDLE_AUTHORITY_VERSION_V2,
      authorityRef: NODE_TOOLCHAIN_PROVISIONER_BUNDLE_AUTHORITY_REF_V2,
      admissionScope,
      status: "built_reproducible_verified",
      release: {
        codeSha: git.codeSha,
        sourceTreeHash: git.sourceTreeHash,
        branch: git.branch,
        originMainSha: git.originMainSha,
        dirty: git.dirty,
        packageName: "setfarm",
        packageVersion: git.packageVersion,
        sourcePolicy: "exact_git_archive_head_no_links_v2",
      },
      sources: {
        entrypoint: sourceRef(
          NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ENTRYPOINT_SOURCE_LOCATOR_V2,
          "text/typescript",
          git.entrypointBytes,
        ),
        packageJson: sourceRef("package.json", "application/json", git.packageJsonBytes),
        packageLock: sourceRef("package-lock.json", "application/json", git.packageLockBytes),
        builder: sourceRef(
          NODE_TOOLCHAIN_PROVISIONER_BUNDLE_BUILDER_SOURCE_LOCATOR_V2,
          "text/javascript",
          git.builderBytes,
        ),
      },
      runtime: {
        sourcePrivateTree: privateTreeReceipt,
        nodeLocator: "bin/node",
        nodeHash: privateTreeReceipt.tree.node.contentHash,
        nodeByteLength: privateTreeReceipt.tree.node.byteLength,
        executionPolicy: "authenticated_private_node_direct_exec_v2",
      },
      dependencyClosure: {
        ...dependencyIdentity,
        closureHash: hashNodeToolchainProvisionerBundleDependencyClosureV2(dependencyIdentity),
      },
      build: {
        contractRef: "BUILD_NODE_TOOLCHAIN_PROVISIONER_BUNDLE_V2",
        bundlerPackage: "esbuild",
        bundlerVersion: "0.28.1",
        format: "cjs",
        platform: "node",
        target: "node22",
        bundle: true,
        treeShaking: true,
        sourcemap: false,
        legalComments: "none",
        charset: "utf8",
        ambientEnvironment: "discard_all",
        stagePolicy: "private_fresh_git_and_dependency_snapshot_v2",
        executionAuthority: admissionScope === "production_release"
          ? "authenticated_private_runtime"
          : "test_adapter",
        executions: [executionReceipt(first), executionReceipt(second)],
      },
      output: {
        artifactRef: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_BUNDLE_V2",
        mediaType: "application/javascript",
        sha256: sha256(first.bundleBytes),
        byteLength: first.bundleBytes.byteLength,
        inputLocators: [...first.metadata.inputLocators],
        inputSetHash: hashNodeToolchainProvisionerBundleInputSetV2(
          first.metadata.inputLocators,
        ),
        externalNodeBuiltins: [...first.metadata.externalNodeBuiltins],
        externalSetHash: hashNodeToolchainProvisionerBundleExternalSetV2(
          first.metadata.externalNodeBuiltins,
        ),
        reproducibilityPolicy: "two_fresh_processes_byte_identical_v2",
      },
    };
    const parsed = NodeToolchainProvisionerBundleAuthorityReceiptV2Schema.safeParse({
      ...identity,
      receiptHash: hashNodeToolchainProvisionerBundleAuthorityReceiptV2(identity),
    });
    if (!parsed.success) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_BUNDLE_V2_RECEIPT_INVALID",
        "Provisioner bundle authority receipt failed its exact schema",
        parsed.error,
      );
    }
    const state: AuthorityStateV2 = Object.freeze({
      receipt: structuredClone(parsed.data),
      bundleBytes: Buffer.from(first.bundleBytes),
      entrypointSourceBytes: Buffer.from(git.entrypointBytes),
      packageJsonSourceBytes: Buffer.from(git.packageJsonBytes),
      packageLockSourceBytes: Buffer.from(git.packageLockBytes),
    });
    return new BuiltNodeToolchainProvisionerBundleV2(handleConstructorCapabilityV2, state);
  } finally {
    zeroCapturedPackages(capturedPackages);
    zeroPrivateTreeBundle(privateBundle);
    git.entrypointBytes.fill(0);
    git.packageJsonBytes.fill(0);
    git.packageLockBytes.fill(0);
    git.builderBytes.fill(0);
    if (stageRoot) rmSync(stageRoot, { recursive: true, force: true });
  }
}

export async function buildNodeToolchainProvisionerBundleAuthorityV2(
  privateTreeHandle: MaterializedNodeToolchainPrivateTreeV2,
): Promise<BuiltNodeToolchainProvisionerBundleV2> {
  return buildAuthority(
    privateTreeHandle,
    "production_release",
    productionBuilderAdapter,
    Object.freeze({
      kind: "repository",
      root: path.join(repositoryRootV2, "node_modules"),
    }),
  );
}

export async function buildNodeToolchainProvisionerBundleAuthorityV2ForTest(
  privateTreeHandle: MaterializedNodeToolchainPrivateTreeV2,
  builderAdapter: NodeToolchainProvisionerBundleBuilderAdapterV2,
  options?: NodeToolchainProvisionerBundleAuthorityTestOptionsV2,
): Promise<BuiltNodeToolchainProvisionerBundleV2> {
  const receipt = inspectNodeToolchainPrivateTreeReceiptV2(privateTreeHandle);
  const architecture = receipt.inventory.distribution.artifact.architecture;
  if (architecture !== "arm64" && architecture !== "x64") {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BUNDLE_V2_INPUT_INVALID",
      "Provisioner bundle test dependency root supports only Darwin arm64 and x64",
    );
  }
  return buildAuthority(
    privateTreeHandle,
    "test_fixture",
    builderAdapter,
    admitPrivateTestDependencyRoot(options, architecture),
  );
}

export function inspectNodeToolchainProvisionerBundleAuthorityReceiptV2(
  handle: BuiltNodeToolchainProvisionerBundleV2,
): NodeToolchainProvisionerBundleAuthorityReceiptV2 {
  return defensiveReceiptCopy(authenticState(handle).receipt);
}

export function copyBuiltNodeToolchainProvisionerBundleV2(
  handle: BuiltNodeToolchainProvisionerBundleV2,
): NodeToolchainProvisionerBundleAuthoritySnapshotV2 {
  const state = authenticState(handle);
  return Object.freeze({
    receipt: defensiveReceiptCopy(state.receipt),
    bundleBytes: Buffer.from(state.bundleBytes),
    entrypointSourceBytes: Buffer.from(state.entrypointSourceBytes),
    packageJsonSourceBytes: Buffer.from(state.packageJsonSourceBytes),
    packageLockSourceBytes: Buffer.from(state.packageLockSourceBytes),
  });
}
