import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  closeSync,
  constants,
  existsSync,
  fstatSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
  readlinkSync,
  realpathSync,
  rmSync,
  writeFileSync,
  type Stats,
} from "node:fs";
import { release as osRelease } from "node:os";
import path from "node:path";
import { isProxy } from "node:util/types";

import { hashCanonicalJson } from "./canonical-json.js";
import {
  openProductionProvisionedNodeToolchainV2,
  revalidateProvisionedNodeToolchainV2,
  type ProvisionedNodeToolchainV2,
} from "./node-toolchain-provisioning-v2.js";
import { getCodeOwnedNodeToolchainTargetV2 } from "./node-toolchain-target-registry-v2.js";
import { canonicalRuntimePathIssuesV2 } from "../execution/schemas/canonical-runtime-tree-v2.js";
import {
  getCodeOwnedNodeScaffoldToolchainCatalogV2,
  getCodeOwnedNodeScaffoldToolchainEntryV2,
  type NodeScaffoldProfileIdV2,
} from "./node-scaffold-toolchain-catalog-v2.js";
import {
  HOST_NODE_EXECUTABLE_IDENTITY_V2_SCHEMA,
  HOST_NODE_TOOLCHAIN_AUTHORITY_REF_V2,
  HOST_NODE_TOOLCHAIN_AUTHORITY_VERSION_V2,
  HOST_NODE_TOOLCHAIN_MAX_DYNAMIC_LIBRARIES_V2,
  HOST_NODE_TOOLCHAIN_RECEIPT_V2_SCHEMA,
  HOST_NODE_TOOLCHAIN_RECEIPT_VERSION_V2,
  HOST_NPM_PACKAGE_CLOSURE_V2_SCHEMA,
  HOST_NPM_PACKAGE_MAX_DIRECTORIES_V2,
  HOST_NPM_PACKAGE_MAX_FILES_V2,
  HOST_NPM_PACKAGE_MAX_TOTAL_BYTES_V2,
  HostNodeToolchainReceiptV2Schema,
  hashHostNodeDynamicLibraryClosureV2,
  hashHostNodeExecutableIdentityV2,
  hashHostNodeToolchainReceiptV2,
  hashHostNodeToolchainRequirementV2,
  hashHostNpmPackageClosureV2,
  type HostNodeToolchainReceiptV2,
  type HostNodeToolchainReceiptHashPayloadV2,
  type HostNodeToolchainRequirementV2,
  type HostToolchainExactFileIdentityV2,
} from "./schemas/host-node-toolchain-receipt-v2.js";
import type {
  NodeToolchainProvisioningReceiptV2,
} from "./schemas/node-toolchain-provisioning-v2.js";
import {
  NODE_SCAFFOLD_TOOLCHAIN_CATALOG_V2_SCHEMA,
  NODE_SCAFFOLD_TOOLCHAIN_ENTRY_V2_SCHEMA,
} from "./schemas/node-scaffold-toolchain-catalog-v2.js";

const NODE_PROBE_TIMEOUT_MS_V2 = 5_000 as const;
const NODE_PROBE_MAX_STDOUT_BYTES_V2 = 4_096 as const;
const NODE_PROBE_MAX_STDERR_BYTES_V2 = 4_096 as const;
const EFFECTIVE_NPM_CONFIG_PROBE_MAX_STDOUT_BYTES_V2 = 32_768 as const;
const NPM_SCAFFOLD_INSTALL_TIMEOUT_MS_V2 = 120_000 as const;
const NPM_SCAFFOLD_INSTALL_MAX_OUTPUT_BYTES_V2 = 65_536 as const;
const CANDIDATE_BUILD_TIMEOUT_MS_V2 = 120_000 as const;
const CANDIDATE_BUILD_MAX_OUTPUT_BYTES_V2 = 1_048_576 as const;
const HOST_PACKAGE_MAX_FILE_BYTES_V2 = 64 * 1024 * 1024;
const OTOOL_MAX_OUTPUT_BYTES_V2 = 512 * 1024;
const OTOOL_TIMEOUT_MS_V2 = 5_000;
const HOST_PACKAGE_PATH_LIMITS_V2 = Object.freeze({
  maxPathBytes: 1_024,
  maxSegmentBytes: 255,
  maxDepth: 64,
});

const NODE_IDENTITY_PROBE_SOURCE_V2 = [
  "const value={",
  "version:process.versions.node,",
  "modulesAbi:process.versions.modules,",
  "napiVersion:process.versions.napi,",
  "platform:process.platform,",
  "architecture:process.arch,",
  "execPath:process.execPath",
  "};process.stdout.write(JSON.stringify(value)+'\\n');",
].join("");

const PROBE_ENVIRONMENT_CONTRACT_HASH_V2 = hashCanonicalJson({
  schema: "setfarm.host-node-toolchain-probe-environment-contract.v2",
  inheritAmbientEnvironment: false,
  fixed: {
    LANG: "C.UTF-8",
    LC_ALL: "C.UTF-8",
    NO_COLOR: "1",
    TZ: "UTC",
  },
  privateBindings: [
    "HOME",
    "NPM_CONFIG_CACHE",
    "NPM_CONFIG_GLOBALCONFIG",
    "NPM_CONFIG_USERCONFIG",
    "TEMP",
    "TMP",
    "TMPDIR",
  ],
  pathBinding: "SINGLE_ADMITTED_NODE_BIN_V2",
});

const COMMAND_PATH_PROJECTION_HASH_V2 = hashCanonicalJson({
  schema: "setfarm.host-node-toolchain-command-path-projection.v2",
  policy: "single_admitted_node_bin_then_exact_module_argv_v2",
  orderedExecutableRefs: ["TOOL_NODE_RUNTIME_V2", "TOOL_NODE_NPM_CLI_V2"],
});

export type HostNodeToolchainAuthorityErrorCodeV2 =
  | "HOST_NODE_TOOLCHAIN_V2_INPUT_INVALID"
  | "HOST_NODE_TOOLCHAIN_V2_NO_ADMITTED_CANDIDATE"
  | "HOST_NODE_TOOLCHAIN_V2_CANDIDATE_LAYOUT_INVALID"
  | "HOST_NODE_TOOLCHAIN_V2_NODE_IDENTITY_INVALID"
  | "HOST_NODE_TOOLCHAIN_V2_PACKAGE_CLOSURE_INVALID"
  | "HOST_NODE_TOOLCHAIN_V2_DYNAMIC_LIBRARY_CLOSURE_INVALID"
  | "HOST_NODE_TOOLCHAIN_V2_PROBE_TIMEOUT"
  | "HOST_NODE_TOOLCHAIN_V2_PROBE_OUTPUT_LIMIT"
  | "HOST_NODE_TOOLCHAIN_V2_PROBE_SPAWN_FAILED"
  | "HOST_NODE_TOOLCHAIN_V2_PROBE_SIGNALLED"
  | "HOST_NODE_TOOLCHAIN_V2_PROBE_NONZERO"
  | "HOST_NODE_TOOLCHAIN_V2_PROBE_MALFORMED"
  | "HOST_NODE_TOOLCHAIN_V2_NODE_VERSION_MISMATCH"
  | "HOST_NODE_TOOLCHAIN_V2_NPM_VERSION_MISMATCH"
  | "HOST_NODE_TOOLCHAIN_V2_EXECUTABLE_PAIRING_MISMATCH"
  | "HOST_NODE_TOOLCHAIN_V2_RECEIPT_INVALID"
  | "HOST_NODE_TOOLCHAIN_V2_HANDLE_UNAUTHENTICATED"
  | "HOST_NODE_TOOLCHAIN_V2_PRODUCTION_AUTHORITY_REQUIRED"
  | "HOST_NODE_TOOLCHAIN_V2_PROVISIONING_AUTHORITY_INVALID"
  | "HOST_NODE_TOOLCHAIN_V2_HOST_DRIFT"
  | "HOST_NODE_TOOLCHAIN_V2_EXECUTION_ENVIRONMENT_INVALID"
  | "HOST_NODE_TOOLCHAIN_V2_EFFECTIVE_NPM_CONFIG_INVALID"
  | "HOST_NODE_TOOLCHAIN_V2_INSTALL_SCOPE_INVALID"
  | "HOST_NODE_TOOLCHAIN_V2_INSTALL_TIMEOUT"
  | "HOST_NODE_TOOLCHAIN_V2_INSTALL_OUTPUT_LIMIT"
  | "HOST_NODE_TOOLCHAIN_V2_INSTALL_SPAWN_FAILED"
  | "HOST_NODE_TOOLCHAIN_V2_INSTALL_SIGNALLED"
  | "HOST_NODE_TOOLCHAIN_V2_INSTALL_NONZERO"
  | "HOST_NODE_TOOLCHAIN_V2_RUNTIME_INSTALL_SCOPE_INVALID"
  | "HOST_NODE_TOOLCHAIN_V2_RUNTIME_INSTALL_TIMEOUT"
  | "HOST_NODE_TOOLCHAIN_V2_RUNTIME_INSTALL_OUTPUT_LIMIT"
  | "HOST_NODE_TOOLCHAIN_V2_RUNTIME_INSTALL_SPAWN_FAILED"
  | "HOST_NODE_TOOLCHAIN_V2_RUNTIME_INSTALL_SIGNALLED"
  | "HOST_NODE_TOOLCHAIN_V2_RUNTIME_INSTALL_NONZERO"
  | "HOST_NODE_TOOLCHAIN_V2_RUNTIME_INSTALL_SOURCE_DRIFT"
  | "HOST_NODE_TOOLCHAIN_V2_BUILD_SCOPE_INVALID"
  | "HOST_NODE_TOOLCHAIN_V2_BUILD_TIMEOUT"
  | "HOST_NODE_TOOLCHAIN_V2_BUILD_OUTPUT_LIMIT"
  | "HOST_NODE_TOOLCHAIN_V2_BUILD_SPAWN_FAILED"
  | "HOST_NODE_TOOLCHAIN_V2_BUILD_SIGNALLED"
  | "HOST_NODE_TOOLCHAIN_V2_BUILD_NONZERO"
  | "HOST_NODE_TOOLCHAIN_V2_BUILD_COMPILER_DRIFT";

export class HostNodeToolchainAuthorityErrorV2 extends Error {
  readonly code: HostNodeToolchainAuthorityErrorCodeV2;
  override readonly cause?: unknown;

  constructor(
    code: HostNodeToolchainAuthorityErrorCodeV2,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message.slice(0, 1_500), options);
    this.name = "HostNodeToolchainAuthorityErrorV2";
    this.code = code;
    this.cause = options?.cause;
  }
}

export type HostNodeToolchainProbeRefV2 =
  | "HOST_NODE_RUNTIME_IDENTITY_PROBE_V2"
  | "HOST_NPM_VERSION_PROBE_V2"
  | "HOST_NPM_EFFECTIVE_CONFIG_PROBE_V2"
  | "HOST_NPM_SCAFFOLD_INSTALL_V2"
  | "HOST_NPM_PLATFORM_RELEASE_BUILD_INSTALL_V2"
  | "HOST_NPM_CANDIDATE_PRODUCTION_INSTALL_V2"
  | "HOST_NODE_PRODUCT_BUILD_V2";

export type HostNodeToolchainProbeInvocationV2 = Readonly<{
  probeRef: HostNodeToolchainProbeRefV2;
  executable: string;
  argv: readonly string[];
  cwd: string;
  env: Readonly<Record<string, string>>;
  shell: false;
  timeoutMs:
    | typeof NODE_PROBE_TIMEOUT_MS_V2
    | typeof NPM_SCAFFOLD_INSTALL_TIMEOUT_MS_V2
    | typeof CANDIDATE_BUILD_TIMEOUT_MS_V2;
  maxStdoutBytes:
    | typeof NODE_PROBE_MAX_STDOUT_BYTES_V2
    | typeof EFFECTIVE_NPM_CONFIG_PROBE_MAX_STDOUT_BYTES_V2
    | typeof NPM_SCAFFOLD_INSTALL_MAX_OUTPUT_BYTES_V2
    | typeof CANDIDATE_BUILD_MAX_OUTPUT_BYTES_V2;
  maxStderrBytes:
    | typeof NODE_PROBE_MAX_STDERR_BYTES_V2
    | typeof NPM_SCAFFOLD_INSTALL_MAX_OUTPUT_BYTES_V2
    | typeof CANDIDATE_BUILD_MAX_OUTPUT_BYTES_V2;
}>;

export type HostNodeToolchainProbeResultV2 =
  | Readonly<{
    status: "exited";
    exitCode: number | null;
    signal: NodeJS.Signals | string | null;
    stdout: string;
    stderr: string;
  }>
  | Readonly<{ status: "timed_out"; stdout: string; stderr: string }>
  | Readonly<{ status: "output_limit_exceeded"; stdout: string; stderr: string }>
  | Readonly<{ status: "spawn_failed"; stdout: string; stderr: string }>;

export type HostNodeToolchainEffectiveNpmConfigProbeInputV2 = Readonly<{
  privateRoot: string;
  environment: Readonly<{
    CI: "true";
    HOME: string;
    LANG: "C.UTF-8";
    LC_ALL: "C.UTF-8";
    NODE_DISABLE_COMPILE_CACHE: "1";
    NO_COLOR: "1";
    NPM_CONFIG_CACHE: string;
    NPM_CONFIG_ENGINE_STRICT: "true";
    NPM_CONFIG_GLOBALCONFIG: string;
    NPM_CONFIG_LOGS_MAX: "0";
    NPM_CONFIG_REGISTRY: "https://registry.npmjs.org";
    NPM_CONFIG_USERCONFIG: string;
    TEMP: string;
    TMP: string;
    TMPDIR: string;
    TZ: "UTC";
  }>;
}>;

export type HostNodeToolchainEffectiveNpmConfigProbeEvidenceV2 = Readonly<{
  probeRef: "HOST_NPM_EFFECTIVE_CONFIG_PROBE_V2";
  hostToolchainReceiptHash: string;
  environmentHash: string;
  rawOutputHash: string;
  keySetHash: string;
  keyCount: number;
  effective: Readonly<{
    registry: "https://registry.npmjs.org";
    cache: "PRIVATE_STAGE_NPM_CACHE_V2";
    userconfig: "PRIVATE_STAGE_EMPTY_USER_NPMRC_V2";
    globalconfig: "PRIVATE_STAGE_EMPTY_GLOBAL_NPMRC_V2";
    prefix: "HOST_TOOLCHAIN_DEFAULT_PREFIX_V2";
    location: "user";
    proxy: null;
    httpsProxy: null;
    noProxy: readonly [""];
    ca: null;
    caFile: null;
    certificate: null;
    privateKey: null;
    strictSsl: true;
    color: false;
    engineStrict: true;
    ignoreScripts: false;
    foregroundScripts: false;
    scriptShell: null;
    shell: "sh";
    audit: true;
    fund: true;
    logsMax: 0;
  }>;
  discoveredCredentialConfigCount: 0;
}>;

export type HostNodeToolchainNpmCiInputV2 = Readonly<{
  privateRoot: string;
  projectRoot: string;
  environment: HostNodeToolchainEffectiveNpmConfigProbeInputV2["environment"];
}>;

export type HostNodeToolchainNpmCiEvidenceV2 = Readonly<{
  probeRef: "HOST_NPM_SCAFFOLD_INSTALL_V2";
  hostToolchainReceiptHash: string;
  environmentHash: string;
  projectScopeHash: string;
  directArgv: readonly [
    "npm",
    "ci",
    "--include=dev",
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
  ];
  directArgvHash: string;
  timeoutMs: 120_000;
  maxStdoutBytes: 65_536;
  maxStderrBytes: 65_536;
  exitCode: 0;
  signal: null;
  stdoutHash: string;
  stdoutBytes: number;
  stderrHash: string;
  stderrBytes: number;
}>;

export type HostNodeToolchainPlatformReleaseNpmCiEvidenceV2 =
  Readonly<{
    probeRef: "HOST_NPM_PLATFORM_RELEASE_BUILD_INSTALL_V2";
    hostToolchainReceiptHash: string;
    environmentHash: string;
    projectScopeHash: string;
    directArgv: readonly [
      "npm",
      "ci",
      "--include=dev",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
    ];
    directArgvHash: string;
    timeoutMs: 120_000;
    maxStdoutBytes: 65_536;
    maxStderrBytes: 65_536;
    exitCode: 0;
    signal: null;
    stdoutHash: string;
    stdoutBytes: number;
    stderrHash: string;
    stderrBytes: number;
  }>;

export type HostNodeToolchainCandidateProductionNpmCiInputV2 = Readonly<{
  privateRoot: string;
  candidateBundleRoot: string;
  environment: HostNodeToolchainEffectiveNpmConfigProbeInputV2["environment"];
}>;

export type HostNodeToolchainCandidateProductionNpmCiEvidenceV2 = Readonly<{
  probeRef: "HOST_NPM_CANDIDATE_PRODUCTION_INSTALL_V2";
  hostToolchainReceiptHash: string;
  nodeIdentityHash: string;
  npmClosureHash: string;
  environmentHash: string;
  projectScopeHash: string;
  sourceFenceHash: string;
  directArgv: readonly [
    "npm",
    "ci",
    "--omit=dev",
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
  ];
  directArgvHash: string;
  stdin: "closed";
  timeoutMs: 120_000;
  maxStdoutBytes: 65_536;
  maxStderrBytes: 65_536;
  shell: "forbidden";
  ambientEnvironment: "forbidden";
  status: "exited_zero";
  exitCode: 0;
  signal: null;
  stdoutHash: string;
  stdoutBytes: number;
  stderrHash: string;
  stderrBytes: number;
}>;

export type HostNodeToolchainBuildCompilerTargetV2 = Readonly<{
  executableRef: "TOOL_NODE_TYPESCRIPT_TSC_V2";
  exactVersion: "5.9.3";
  commandName: "tsc";
  packagePath: "node_modules/typescript";
  linkLocator: "node_modules/.bin/tsc";
  targetLocator: "node_modules/typescript/bin/tsc";
  linkTargetHash: string;
  targetContentHash: string;
  executionDisposition: "direct_target_via_authenticated_node_runtime";
}>;

export type HostNodeToolchainBuildInputV2 = Readonly<{
  privateRoot: string;
  projectRoot: string;
  environment: HostNodeToolchainEffectiveNpmConfigProbeInputV2["environment"];
  compilerTarget: HostNodeToolchainBuildCompilerTargetV2;
}>;

export type HostNodeToolchainBuildEvidenceV2 = Readonly<{
  probeRef: "HOST_NODE_PRODUCT_BUILD_V2";
  hostToolchainReceiptHash: string;
  nodeIdentityHash: string;
  environmentHash: string;
  projectScopeHash: string;
  compilerTargetIdentityHash: string;
  directArgv: readonly [
    "node",
    "node_modules/typescript/bin/tsc",
    "-p",
    "tsconfig.json",
  ];
  directArgvHash: string;
  stdin: "closed";
  timeoutMs: 120_000;
  maxStdoutBytes: 1_048_576;
  maxStderrBytes: 1_048_576;
  shell: "forbidden";
  ambientEnvironment: "forbidden";
  status: "exited_zero";
  exitCode: 0;
  signal: null;
  stdoutHash: string;
  stdoutBytes: number;
  stderrHash: string;
  stderrBytes: number;
}>;

type HostNodeToolchainProbeAdapterV2 = (
  invocation: HostNodeToolchainProbeInvocationV2,
) => Promise<HostNodeToolchainProbeResultV2>;

type HostIdentityV2 = Readonly<{
  platform: "darwin";
  architecture: "arm64" | "x64";
  macosProductVersion: string;
  macosBuildVersion: string;
  darwinKernelRelease: string;
}>;

type FingerprintV2 = Readonly<{
  device: number;
  inode: number;
  mode: number;
  ownerUid: number;
  ownerGid: number;
  linkCount: number;
  byteLength: number;
  modifiedMs: number;
  changedMs: number;
}>;

type CapturedFileV2 = Readonly<{
  absolutePath: string;
  relativePath: string;
  fingerprint: FingerprintV2;
  contentHash: string;
  bytes?: Buffer;
}>;

type CapturedDirectoryV2 = Readonly<{
  relativePath: "." | string;
  fingerprint: FingerprintV2;
  names: readonly string[];
}>;

type CapturedNpmPackageV2 = Readonly<{
  root: string;
  rootOwnerUid: number;
  rootOwnerGid: number;
  rootMode: "0555" | "0755";
  files: readonly CapturedFileV2[];
  directories: readonly CapturedDirectoryV2[];
  fileCount: number;
  directoryCount: number;
  totalBytes: number;
  treeHash: string;
  normalizedTreeHash: string;
  privateIdentityHash: string;
  packageName: "npm";
  version: string;
  cli: CapturedFileV2;
  packageJson: CapturedFileV2;
}>;

type CapturedDynamicLibraryV2 = Readonly<{
  installNameHash: string;
  absolutePath: string;
  file: CapturedFileV2;
}>;

type ResolvedRootV2 = Readonly<{
  logicalRoot: string;
  realRoot: string;
  nodePath: string;
  npmRoot: string;
  npmCliPath: string;
  rootOwnerUid: number;
  rootOwnerGid: number;
  rootMode: number;
  rootFingerprint: FingerprintV2;
  rootIdentityHash: string;
}>;

type CapturedAuthorityStateV2 = Readonly<{
  root: ResolvedRootV2;
  nodeFile: CapturedFileV2;
  npmPackage: CapturedNpmPackageV2;
  dynamicLibraries: readonly CapturedDynamicLibraryV2[];
  privateIdentityHash: string;
}>;

type PrivateAuthorityStateV2 = Readonly<{
  admissionScope: "production_host" | "test_fixture";
  profileId: NodeScaffoldProfileIdV2;
  requirement: HostNodeToolchainRequirementV2;
  host: HostIdentityV2;
  candidate: Readonly<{
    logicalRoot: string;
    expectedRealRoot?: string;
    productionRootPolicy?: "root_owned_direct_exact_v2";
  }>;
  testDynamicLibraryPaths?: readonly string[];
  probeAdapter: HostNodeToolchainProbeAdapterV2;
  provisionedToolchain?: ProvisionedNodeToolchainV2;
  provisioningReceipt?: NodeToolchainProvisioningReceiptV2;
  captured: CapturedAuthorityStateV2;
  receipt: HostNodeToolchainReceiptV2;
}>;

const authorityConstructorCapabilityV2 = Object.freeze({});
const privateAuthorityStateV2 = new WeakMap<object, PrivateAuthorityStateV2>();

export class HostNodeToolchainAuthorityV2 {
  readonly receiptHash: string;

  constructor(
    capability: object,
    state: PrivateAuthorityStateV2,
  ) {
    if (capability !== authorityConstructorCapabilityV2) {
      throw new HostNodeToolchainAuthorityErrorV2(
        "HOST_NODE_TOOLCHAIN_V2_HANDLE_UNAUTHENTICATED",
        "Host Node toolchain authority constructor capability is unavailable",
      );
    }
    this.receiptHash = state.receipt.receiptHash;
    privateAuthorityStateV2.set(this, state);
    Object.freeze(this);
  }
}

function fail(
  code: HostNodeToolchainAuthorityErrorCodeV2,
  message: string,
  cause?: unknown,
): never {
  throw new HostNodeToolchainAuthorityErrorV2(
    code,
    message,
    cause === undefined ? undefined : { cause },
  );
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function modeBits(stat: Stats): number {
  return stat.mode & 0o7777;
}

function modeText(stat: Stats): string {
  return modeBits(stat).toString(8).padStart(4, "0");
}

function fingerprint(stat: Stats): FingerprintV2 {
  return Object.freeze({
    device: stat.dev,
    inode: stat.ino,
    mode: stat.mode,
    ownerUid: stat.uid,
    ownerGid: stat.gid,
    linkCount: stat.nlink,
    byteLength: stat.size,
    modifiedMs: stat.mtimeMs,
    changedMs: stat.ctimeMs,
  });
}

function sameFingerprint(left: FingerprintV2, right: FingerprintV2): boolean {
  return left.device === right.device
    && left.inode === right.inode
    && left.mode === right.mode
    && left.ownerUid === right.ownerUid
    && left.ownerGid === right.ownerGid
    && left.linkCount === right.linkCount
    && left.byteLength === right.byteLength
    && left.modifiedMs === right.modifiedMs
    && left.changedMs === right.changedMs;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value) || isProxy(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactRecordKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Reflect.ownKeys(value);
  return keys.every((key) => typeof key === "string")
    && keys.length === expected.length
    && [...keys as string[]].sort().every((key, index) => key === [...expected].sort()[index]);
}

function parseProductionInput(input: unknown): NodeScaffoldProfileIdV2 {
  if (!isPlainRecord(input) || !exactRecordKeys(input, ["profileId"])) {
    return fail(
      "HOST_NODE_TOOLCHAIN_V2_INPUT_INVALID",
      "Production host toolchain input must contain exactly one code-owned profileId",
    );
  }
  if (
    input.profileId !== "PROFILE_NODE_CLI_STATELESS_EXACT_V2"
    && input.profileId !== "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2"
  ) {
    return fail(
      "HOST_NODE_TOOLCHAIN_V2_INPUT_INVALID",
      "Production host toolchain profileId is not a code-owned Node scaffold profile",
    );
  }
  return input.profileId;
}

function exactFileIdentity(file: CapturedFileV2): HostToolchainExactFileIdentityV2 {
  if (file.fingerprint.byteLength < 1) {
    return fail(
      "HOST_NODE_TOOLCHAIN_V2_NODE_IDENTITY_INVALID",
      `${file.relativePath} must not be empty when projected as an exact toolchain file`,
    );
  }
  const mode = modeTextFromBits(file.fingerprint.mode);
  if (mode !== "0444" && mode !== "0555") {
    return fail(
      "HOST_NODE_TOOLCHAIN_V2_NODE_IDENTITY_INVALID",
      `${file.relativePath} has non-read-only mode ${mode}`,
    );
  }
  return {
    contentHash: file.contentHash,
    byteLength: file.fingerprint.byteLength,
    mode,
    ownerUid: file.fingerprint.ownerUid,
    ownerGid: file.fingerprint.ownerGid,
    linkCount: 1,
  };
}

function modeTextFromBits(mode: number): string {
  return (mode & 0o7777).toString(8).padStart(4, "0");
}

function assertDirectDescendant(root: string, candidate: string, label: string): void {
  const relative = path.relative(root, candidate);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    fail(
      "HOST_NODE_TOOLCHAIN_V2_CANDIDATE_LAYOUT_INVALID",
      `${label} must be one exact descendant of the admitted toolchain root`,
    );
  }
  let realCandidate: string;
  try {
    realCandidate = realpathSync(candidate);
  } catch (error) {
    return fail(
      "HOST_NODE_TOOLCHAIN_V2_CANDIDATE_LAYOUT_INVALID",
      `${label} cannot be resolved inside the admitted toolchain root`,
      error,
    );
  }
  if (realCandidate !== candidate) {
    fail(
      "HOST_NODE_TOOLCHAIN_V2_CANDIDATE_LAYOUT_INVALID",
      `${label} must not traverse a symbolic link`,
    );
  }
}

function resolveCandidateRoot(input: Readonly<{
  logicalRoot: string;
  expectedRealRoot?: string;
  productionRootPolicy?: "root_owned_direct_exact_v2";
}>): ResolvedRootV2 {
  let rootStat: Stats;
  let realRoot: string;
  try {
    rootStat = lstatSync(input.logicalRoot);
    realRoot = realpathSync(input.logicalRoot);
  } catch (error) {
    return fail(
      "HOST_NODE_TOOLCHAIN_V2_NO_ADMITTED_CANDIDATE",
      "The code-owned Node 22 candidate root is unavailable",
      error,
    );
  }
  if (input.productionRootPolicy) {
    if (
      rootStat.isSymbolicLink()
      || !rootStat.isDirectory()
      || realRoot !== input.logicalRoot
      || rootStat.uid !== 0
      || (modeBits(rootStat) & 0o022) !== 0
    ) {
      fail(
        "HOST_NODE_TOOLCHAIN_V2_CANDIDATE_LAYOUT_INVALID",
        "The code-owned Node 22 candidate must be one direct root-owned runtime-read-only Setfarm root",
      );
    }
  } else if (!rootStat.isDirectory() && !rootStat.isSymbolicLink()) {
    fail(
      "HOST_NODE_TOOLCHAIN_V2_CANDIDATE_LAYOUT_INVALID",
      "The test toolchain candidate root must resolve a directory",
    );
  }
  if (input.expectedRealRoot !== undefined && realRoot !== input.expectedRealRoot) {
    fail(
      "HOST_NODE_TOOLCHAIN_V2_CANDIDATE_LAYOUT_INVALID",
      "The admitted Node toolchain candidate root changed its exact target",
    );
  }
  let resolvedRootStat: Stats;
  try {
    resolvedRootStat = lstatSync(realRoot);
  } catch (error) {
    return fail(
      "HOST_NODE_TOOLCHAIN_V2_CANDIDATE_LAYOUT_INVALID",
      "The admitted Node toolchain real root cannot be inspected",
      error,
    );
  }
  if (!resolvedRootStat.isDirectory() || resolvedRootStat.isSymbolicLink()) {
    fail(
      "HOST_NODE_TOOLCHAIN_V2_CANDIDATE_LAYOUT_INVALID",
      "The admitted Node toolchain target must be a direct directory",
    );
  }

  const nodePath = path.join(realRoot, "bin", "node");
  const npmRoot = path.join(realRoot, "lib", "node_modules", "npm");
  const npmCliPath = path.join(npmRoot, "bin", "npm-cli.js");
  assertDirectDescendant(realRoot, nodePath, "Node executable");
  assertDirectDescendant(realRoot, npmRoot, "npm package root");

  const linkTarget = rootStat.isSymbolicLink() ? readlinkSync(input.logicalRoot) : ".";
  const rootIdentityHash = hashCanonicalJson({
    schema: "setfarm.host-node-candidate-root-private-identity.v2",
    logicalRootHash: sha256(input.logicalRoot),
    realRootHash: sha256(realRoot),
    linkTargetHash: sha256(linkTarget),
    logicalRootFingerprint: fingerprint(rootStat),
    realRootFingerprint: fingerprint(resolvedRootStat),
  });
  return Object.freeze({
    logicalRoot: input.logicalRoot,
    realRoot,
    nodePath,
    npmRoot,
    npmCliPath,
    rootOwnerUid: resolvedRootStat.uid,
    rootOwnerGid: resolvedRootStat.gid,
    rootMode: modeBits(resolvedRootStat),
    rootFingerprint: fingerprint(resolvedRootStat),
    rootIdentityHash,
  });
}

function readExactFile(input: Readonly<{
  absolutePath: string;
  relativePath: string;
  allowedModes: readonly number[];
  maxBytes: number;
  captureBytes?: boolean;
  errorCode: HostNodeToolchainAuthorityErrorCodeV2;
}>): CapturedFileV2 {
  let descriptor: number | undefined;
  try {
    const pathBefore = lstatSync(input.absolutePath);
    if (pathBefore.isSymbolicLink()) fail(input.errorCode, `${input.relativePath} is a symbolic link`);
    if (!pathBefore.isFile()) fail(input.errorCode, `${input.relativePath} is not a regular file`);
    if (pathBefore.nlink !== 1) {
      fail(input.errorCode, `${input.relativePath} has link count ${pathBefore.nlink}; expected 1`);
    }
    if (!input.allowedModes.includes(modeBits(pathBefore))) {
      fail(input.errorCode, `${input.relativePath} mode ${modeText(pathBefore)} is not admitted`);
    }
    if (!Number.isSafeInteger(pathBefore.size) || pathBefore.size < 0 || pathBefore.size > input.maxBytes) {
      fail(input.errorCode, `${input.relativePath} exceeds its exact file bound`);
    }
    descriptor = openSync(
      input.absolutePath,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
    const before = fstatSync(descriptor);
    if (!sameFingerprint(fingerprint(pathBefore), fingerprint(before))) {
      fail(input.errorCode, `${input.relativePath} changed before its exact read`);
    }
    const hash = createHash("sha256");
    const chunks: Buffer[] = [];
    const buffer = Buffer.allocUnsafe(64 * 1024);
    let byteLength = 0;
    while (true) {
      const bytesRead = readSync(descriptor, buffer, 0, buffer.length, null);
      if (bytesRead === 0) break;
      byteLength += bytesRead;
      if (byteLength > input.maxBytes) fail(input.errorCode, `${input.relativePath} exceeded its read bound`);
      const bytes = buffer.subarray(0, bytesRead);
      hash.update(bytes);
      if (input.captureBytes) chunks.push(Buffer.from(bytes));
    }
    const after = fstatSync(descriptor);
    const pathAfter = lstatSync(input.absolutePath);
    if (
      !sameFingerprint(fingerprint(before), fingerprint(after))
      || !sameFingerprint(fingerprint(after), fingerprint(pathAfter))
      || byteLength !== after.size
    ) {
      fail(input.errorCode, `${input.relativePath} changed while it was read`);
    }
    return Object.freeze({
      absolutePath: input.absolutePath,
      relativePath: input.relativePath,
      fingerprint: fingerprint(after),
      contentHash: hash.digest("hex"),
      ...(input.captureBytes ? { bytes: Buffer.concat(chunks, byteLength) } : {}),
    });
  } catch (error) {
    if (error instanceof HostNodeToolchainAuthorityErrorV2) throw error;
    return fail(input.errorCode, `${input.relativePath} could not be captured exactly`, error);
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function directorySnapshot(
  absolutePath: string,
  relativePath: "." | string,
): CapturedDirectoryV2 {
  const stat = lstatSync(absolutePath);
  if (stat.isSymbolicLink()) {
    fail("HOST_NODE_TOOLCHAIN_V2_PACKAGE_CLOSURE_INVALID", `${relativePath} is a symbolic-link directory`);
  }
  if (!stat.isDirectory()) {
    fail("HOST_NODE_TOOLCHAIN_V2_PACKAGE_CLOSURE_INVALID", `${relativePath} is not a directory`);
  }
  if (modeBits(stat) !== 0o555 && modeBits(stat) !== 0o755) {
    fail(
      "HOST_NODE_TOOLCHAIN_V2_PACKAGE_CLOSURE_INVALID",
      `${relativePath} directory mode ${modeText(stat)} is not admitted`,
    );
  }
  return Object.freeze({
    relativePath,
    fingerprint: fingerprint(stat),
    names: Object.freeze(readdirSync(absolutePath).sort()),
  });
}

function sameDirectorySnapshot(left: CapturedDirectoryV2, right: CapturedDirectoryV2): boolean {
  return sameFingerprint(left.fingerprint, right.fingerprint)
    && left.names.length === right.names.length
    && left.names.every((name, index) => name === right.names[index]);
}

function captureNpmPackage(root: string): CapturedNpmPackageV2 {
  try {
    if (realpathSync(root) !== root) {
      fail("HOST_NODE_TOOLCHAIN_V2_PACKAGE_CLOSURE_INVALID", "npm package root must be direct and symlink-free");
    }
    const files: CapturedFileV2[] = [];
    const directories: CapturedDirectoryV2[] = [];
    const casefoldPaths = new Map<string, string>();
    let totalBytes = 0;

    const visit = (absolutePath: string, relativePath: "." | string): void => {
      const before = directorySnapshot(absolutePath, relativePath);
      if (before.fingerprint.ownerUid !== lstatSync(root).uid
        || before.fingerprint.ownerGid !== lstatSync(root).gid) {
        fail(
          "HOST_NODE_TOOLCHAIN_V2_PACKAGE_CLOSURE_INVALID",
          `${relativePath} owner differs from the npm package root`,
        );
      }
      for (const name of before.names) {
        const childRelative = relativePath === "." ? name : `${relativePath}/${name}`;
        const pathIssues = canonicalRuntimePathIssuesV2(childRelative, HOST_PACKAGE_PATH_LIMITS_V2);
        if (pathIssues.length > 0) {
          fail(
            "HOST_NODE_TOOLCHAIN_V2_PACKAGE_CLOSURE_INVALID",
            `${childRelative} is not a portable package path: ${pathIssues.join("; ")}`,
          );
        }
        const folded = childRelative.toLowerCase();
        const prior = casefoldPaths.get(folded);
        if (prior !== undefined && prior !== childRelative) {
          fail(
            "HOST_NODE_TOOLCHAIN_V2_PACKAGE_CLOSURE_INVALID",
            `${childRelative} collides with ${prior} under ASCII case folding`,
          );
        }
        casefoldPaths.set(folded, childRelative);
        const childAbsolute = path.join(absolutePath, name);
        const childStat = lstatSync(childAbsolute);
        if (childStat.isSymbolicLink()) {
          fail("HOST_NODE_TOOLCHAIN_V2_PACKAGE_CLOSURE_INVALID", `${childRelative} is a symbolic link`);
        }
        if (childStat.uid !== before.fingerprint.ownerUid || childStat.gid !== before.fingerprint.ownerGid) {
          fail(
            "HOST_NODE_TOOLCHAIN_V2_PACKAGE_CLOSURE_INVALID",
            `${childRelative} owner differs from its package directory`,
          );
        }
        if (childStat.isDirectory()) {
          if (directories.length >= HOST_NPM_PACKAGE_MAX_DIRECTORIES_V2) {
            fail("HOST_NODE_TOOLCHAIN_V2_PACKAGE_CLOSURE_INVALID", "npm package directory bound exceeded");
          }
          const snapshot = directorySnapshot(childAbsolute, childRelative);
          directories.push(snapshot);
          visit(childAbsolute, childRelative);
          continue;
        }
        if (!childStat.isFile()) {
          fail(
            "HOST_NODE_TOOLCHAIN_V2_PACKAGE_CLOSURE_INVALID",
            `${childRelative} is not a regular file or directory`,
          );
        }
        if (files.length >= HOST_NPM_PACKAGE_MAX_FILES_V2) {
          fail("HOST_NODE_TOOLCHAIN_V2_PACKAGE_CLOSURE_INVALID", "npm package file bound exceeded");
        }
        const captureBytes = childRelative === "package.json"
          || childRelative === "bin/npm-cli.js";
        const file = readExactFile({
          absolutePath: childAbsolute,
          relativePath: childRelative,
          allowedModes: [0o444, 0o555],
          maxBytes: HOST_PACKAGE_MAX_FILE_BYTES_V2,
          captureBytes,
          errorCode: "HOST_NODE_TOOLCHAIN_V2_PACKAGE_CLOSURE_INVALID",
        });
        totalBytes += file.fingerprint.byteLength;
        if (totalBytes > HOST_NPM_PACKAGE_MAX_TOTAL_BYTES_V2) {
          fail("HOST_NODE_TOOLCHAIN_V2_PACKAGE_CLOSURE_INVALID", "npm package total-byte bound exceeded");
        }
        files.push(file);
      }
      const after = directorySnapshot(absolutePath, relativePath);
      if (!sameDirectorySnapshot(before, after)) {
        fail(
          "HOST_NODE_TOOLCHAIN_V2_PACKAGE_CLOSURE_INVALID",
          `${relativePath} changed during package closure capture`,
        );
      }
    };

    const rootSnapshot = directorySnapshot(root, ".");
    visit(root, ".");
    files.sort((left, right) => left.relativePath < right.relativePath ? -1 : 1);
    directories.sort((left, right) => left.relativePath < right.relativePath ? -1 : 1);
    const treeEntries = [
      ...directories.map((directory) => ({
        path: directory.relativePath,
        type: "directory" as const,
        mode: modeTextFromBits(directory.fingerprint.mode),
      })),
      ...files.map((file) => ({
        path: file.relativePath,
        type: "file" as const,
        mode: modeTextFromBits(file.fingerprint.mode),
        byteLength: file.fingerprint.byteLength,
        contentHash: file.contentHash,
      })),
    ].sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
    const rootMode = modeTextFromBits(rootSnapshot.fingerprint.mode);
    if (rootMode !== "0555" && rootMode !== "0755") {
      fail("HOST_NODE_TOOLCHAIN_V2_PACKAGE_CLOSURE_INVALID", "npm package root mode is not admitted");
    }
    const normalizedTreeHash = hashCanonicalJson({
      schema: "setfarm.node-toolchain-normalized-npm-tree.v2",
      entries: [
        { locator: ".", type: "directory" as const, mode: rootMode },
        ...treeEntries.map((entry) => ({
          locator: entry.path,
          type: entry.type,
          mode: entry.mode,
          ...(entry.type === "file"
            ? { byteLength: entry.byteLength, contentHash: entry.contentHash }
            : {}),
        })),
      ],
    });
    const treeHash = hashCanonicalJson({
      schema: "setfarm.host-npm-package-tree-content.v2",
      rootMode,
      entries: treeEntries,
      fileCount: files.length,
      directoryCount: directories.length,
      totalBytes,
    });
    const byPath = new Map(files.map((file) => [file.relativePath, file]));
    const packageJson = byPath.get("package.json");
    const cli = byPath.get("bin/npm-cli.js");
    if (!packageJson?.bytes || !cli?.bytes) {
      fail(
        "HOST_NODE_TOOLCHAIN_V2_PACKAGE_CLOSURE_INVALID",
        "npm package closure is missing package.json or bin/npm-cli.js",
      );
    }
    if (byPath.has("npmrc")) {
      fail(
        "HOST_NODE_TOOLCHAIN_V2_PACKAGE_CLOSURE_INVALID",
        "npm package closure contains an unadmitted builtin npmrc",
      );
    }
    let parsedPackage: unknown;
    try {
      parsedPackage = JSON.parse(packageJson.bytes.toString("utf8"));
    } catch (error) {
      return fail(
        "HOST_NODE_TOOLCHAIN_V2_PACKAGE_CLOSURE_INVALID",
        "npm package.json is not valid JSON",
        error,
      );
    }
    if (
      !isPlainRecord(parsedPackage)
      || parsedPackage.name !== "npm"
      || typeof parsedPackage.version !== "string"
      || !isPlainRecord(parsedPackage.bin)
      || parsedPackage.bin.npm !== "bin/npm-cli.js"
    ) {
      fail(
        "HOST_NODE_TOOLCHAIN_V2_PACKAGE_CLOSURE_INVALID",
        "npm package metadata does not bind the exact npm CLI entrypoint",
      );
    }
    const privateIdentityHash = hashCanonicalJson({
      schema: "setfarm.host-npm-package-private-identity.v2",
      root: rootSnapshot,
      directories,
      files: files.map((file) => ({
        relativePath: file.relativePath,
        fingerprint: file.fingerprint,
        contentHash: file.contentHash,
      })),
    });
    return Object.freeze({
      root,
      rootOwnerUid: rootSnapshot.fingerprint.ownerUid,
      rootOwnerGid: rootSnapshot.fingerprint.ownerGid,
      rootMode,
      files: Object.freeze(files),
      directories: Object.freeze(directories),
      fileCount: files.length,
      directoryCount: directories.length,
      totalBytes,
      treeHash,
      normalizedTreeHash,
      privateIdentityHash,
      packageName: "npm",
      version: parsedPackage.version,
      cli,
      packageJson,
    });
  } catch (error) {
    if (error instanceof HostNodeToolchainAuthorityErrorV2) throw error;
    return fail(
      "HOST_NODE_TOOLCHAIN_V2_PACKAGE_CLOSURE_INVALID",
      "npm package closure could not be captured",
      error,
    );
  }
}

function runExactUtility(executable: string, argv: readonly string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(executable, [...argv], {
      encoding: "utf8",
      env: Object.create(null) as NodeJS.ProcessEnv,
      maxBuffer: OTOOL_MAX_OUTPUT_BYTES_V2,
      shell: false,
      timeout: OTOOL_TIMEOUT_MS_V2,
      windowsHide: true,
    }, (error, stdout) => {
      if (error) reject(error);
      else resolve(stdout);
    });
  });
}

async function exactUtilityOutput(executable: string, argv: readonly string[]): Promise<string> {
  try {
    return await runExactUtility(executable, argv);
  } catch (error) {
    return fail(
      "HOST_NODE_TOOLCHAIN_V2_DYNAMIC_LIBRARY_CLOSURE_INVALID",
      `Exact host utility ${path.basename(executable)} failed`,
      error,
    );
  }
}

function parseOtoolDependencies(output: string): string[] {
  const lines = output.split("\n").slice(1);
  const dependencies: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const marker = trimmed.lastIndexOf(" (compatibility version ");
    if (marker < 1) {
      fail(
        "HOST_NODE_TOOLCHAIN_V2_DYNAMIC_LIBRARY_CLOSURE_INVALID",
        "otool returned a malformed dynamic-library dependency line",
      );
    }
    dependencies.push(trimmed.slice(0, marker));
  }
  return dependencies;
}

function parseOtoolRpaths(output: string): string[] {
  const lines = output.split("\n");
  const rpaths: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index]?.trim() !== "cmd LC_RPATH") continue;
    for (let offset = 1; offset <= 4 && index + offset < lines.length; offset += 1) {
      const match = /^\s*path (.+) \(offset [0-9]+\)\s*$/.exec(lines[index + offset]!);
      if (match) {
        rpaths.push(match[1]!);
        break;
      }
    }
  }
  return [...new Set(rpaths)].sort();
}

function isSystemDynamicLibrary(installName: string): boolean {
  return installName.startsWith("/usr/lib/")
    || installName.startsWith("/System/Library/");
}

function expandLoaderToken(
  value: string,
  loaderPath: string,
  executablePath: string,
): string | null {
  if (value === "@loader_path") return path.dirname(loaderPath);
  if (value.startsWith("@loader_path/")) {
    return path.join(path.dirname(loaderPath), value.slice("@loader_path/".length));
  }
  if (value === "@executable_path") return path.dirname(executablePath);
  if (value.startsWith("@executable_path/")) {
    return path.join(path.dirname(executablePath), value.slice("@executable_path/".length));
  }
  if (value.startsWith("/")) return value;
  return null;
}

function resolveInstallName(input: Readonly<{
  installName: string;
  loaderPath: string;
  executablePath: string;
  loaderRpaths: readonly string[];
  executableRpaths: readonly string[];
}>): string {
  const direct = expandLoaderToken(input.installName, input.loaderPath, input.executablePath);
  if (direct !== null) {
    if (!existsSync(direct)) {
      fail(
        "HOST_NODE_TOOLCHAIN_V2_DYNAMIC_LIBRARY_CLOSURE_INVALID",
        "A non-system dynamic-library dependency is unavailable",
      );
    }
    return realpathSync(direct);
  }
  if (!input.installName.startsWith("@rpath/")) {
    return fail(
      "HOST_NODE_TOOLCHAIN_V2_DYNAMIC_LIBRARY_CLOSURE_INVALID",
      "A dynamic-library install name uses an unsupported loader token",
    );
  }
  const suffix = input.installName.slice("@rpath/".length);
  const candidates = [...input.loaderRpaths, ...input.executableRpaths];
  for (const rpath of candidates) {
    const expanded = expandLoaderToken(rpath, input.loaderPath, input.executablePath);
    if (expanded === null) continue;
    const candidate = path.join(expanded, suffix);
    if (existsSync(candidate)) return realpathSync(candidate);
  }
  return fail(
    "HOST_NODE_TOOLCHAIN_V2_DYNAMIC_LIBRARY_CLOSURE_INVALID",
    "An @rpath dynamic-library dependency cannot be resolved exactly",
  );
}

async function resolveProductionDynamicLibraries(nodePath: string): Promise<Array<Readonly<{
  installName: string;
  absolutePath: string;
}>>> {
  const otool = "/usr/bin/otool";
  const executableRpaths = parseOtoolRpaths(await exactUtilityOutput(otool, ["-l", nodePath]));
  const queue: string[] = [nodePath];
  const visited = new Set<string>();
  const installNamesByPath = new Map<string, Set<string>>();
  while (queue.length > 0) {
    const loaderPath = queue.shift()!;
    if (visited.has(loaderPath)) continue;
    visited.add(loaderPath);
    const [dependenciesOutput, loadCommandsOutput] = await Promise.all([
      exactUtilityOutput(otool, ["-L", loaderPath]),
      exactUtilityOutput(otool, ["-l", loaderPath]),
    ]);
    const loaderRpaths = parseOtoolRpaths(loadCommandsOutput);
    const dependencies = parseOtoolDependencies(dependenciesOutput);
    if (loaderPath !== nodePath) dependencies.shift();
    for (const installName of dependencies) {
      if (isSystemDynamicLibrary(installName)) continue;
      const absolutePath = resolveInstallName({
        installName,
        loaderPath,
        executablePath: nodePath,
        loaderRpaths,
        executableRpaths,
      });
      if (absolutePath === loaderPath || absolutePath === nodePath) continue;
      const names = installNamesByPath.get(absolutePath) ?? new Set<string>();
      names.add(installName);
      installNamesByPath.set(absolutePath, names);
      if (!visited.has(absolutePath)) queue.push(absolutePath);
      if (installNamesByPath.size > HOST_NODE_TOOLCHAIN_MAX_DYNAMIC_LIBRARIES_V2) {
        fail(
          "HOST_NODE_TOOLCHAIN_V2_DYNAMIC_LIBRARY_CLOSURE_INVALID",
          "Node non-system dynamic-library closure exceeded its fixed bound",
        );
      }
    }
  }
  return [...installNamesByPath.entries()].map(([absolutePath, names]) => ({
    absolutePath,
    installName: hashCanonicalJson({
      schema: "setfarm.host-node-dynamic-library-install-name-set.v2",
      names: [...names].sort(),
    }),
  }));
}

async function captureDynamicLibraries(input: Readonly<{
  nodePath: string;
  testPaths?: readonly string[];
}>): Promise<readonly CapturedDynamicLibraryV2[]> {
  try {
    const resolved = input.testPaths === undefined
      ? await resolveProductionDynamicLibraries(input.nodePath)
      : input.testPaths.map((absolutePath, index) => ({
        absolutePath: realpathSync(absolutePath),
        installName: `TEST_FIXTURE_DYLIB_${String(index + 1).padStart(4, "0")}`,
      }));
    const captures = resolved.map((entry) => {
      const installNameHash = /^[a-f0-9]{64}$/.test(entry.installName)
        ? entry.installName
        : sha256(entry.installName);
      const file = readExactFile({
        absolutePath: entry.absolutePath,
        relativePath: `dynamic-library:${installNameHash}`,
        allowedModes: [0o444, 0o555],
        maxBytes: 1024 * 1024 * 1024,
        errorCode: "HOST_NODE_TOOLCHAIN_V2_DYNAMIC_LIBRARY_CLOSURE_INVALID",
      });
      return Object.freeze({ installNameHash, absolutePath: entry.absolutePath, file });
    }).sort((left, right) => left.installNameHash < right.installNameHash ? -1 : 1);
    if (new Set(captures.map((capture) => capture.installNameHash)).size !== captures.length) {
      fail(
        "HOST_NODE_TOOLCHAIN_V2_DYNAMIC_LIBRARY_CLOSURE_INVALID",
        "Node dynamic-library install-name identities are not unique",
      );
    }
    return Object.freeze(captures);
  } catch (error) {
    if (error instanceof HostNodeToolchainAuthorityErrorV2) throw error;
    return fail(
      "HOST_NODE_TOOLCHAIN_V2_DYNAMIC_LIBRARY_CLOSURE_INVALID",
      "Node non-system dynamic-library closure could not be captured",
      error,
    );
  }
}

function productionProbeAdapter(
  invocation: HostNodeToolchainProbeInvocationV2,
): Promise<HostNodeToolchainProbeResultV2> {
  return new Promise((resolve) => {
    const child = execFile(invocation.executable, [...invocation.argv], {
      cwd: invocation.cwd,
      encoding: "utf8",
      env: { ...invocation.env },
      maxBuffer: Math.max(invocation.maxStdoutBytes, invocation.maxStderrBytes),
      shell: false,
      timeout: invocation.timeoutMs,
      windowsHide: true,
    }, (error, stdout, stderr) => {
      const capturedStdout = typeof stdout === "string" ? stdout : "";
      const capturedStderr = typeof stderr === "string" ? stderr : "";
      if (!error) {
        resolve(Object.freeze({
          status: "exited",
          exitCode: 0,
          signal: null,
          stdout: capturedStdout,
          stderr: capturedStderr,
        }));
        return;
      }
      const candidate = error as NodeJS.ErrnoException & Readonly<{
        killed?: boolean;
        signal?: NodeJS.Signals | null;
      }>;
      if (candidate.code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER") {
        resolve(Object.freeze({
          status: "output_limit_exceeded",
          stdout: capturedStdout,
          stderr: capturedStderr,
        }));
      } else if (candidate.killed) {
        resolve(Object.freeze({ status: "timed_out", stdout: capturedStdout, stderr: capturedStderr }));
      } else if (typeof candidate.code === "number" || candidate.signal) {
        resolve(Object.freeze({
          status: "exited",
          exitCode: typeof candidate.code === "number" ? candidate.code : null,
          signal: candidate.signal ?? null,
          stdout: capturedStdout,
          stderr: capturedStderr,
        }));
      } else {
        resolve(Object.freeze({
          status: "spawn_failed",
          stdout: capturedStdout,
          stderr: capturedStderr || candidate.message,
        }));
      }
    });
    child.stdin?.end();
  });
}

function immutableProbeInvocation(input: Omit<HostNodeToolchainProbeInvocationV2, "shell" | "timeoutMs" | "maxStdoutBytes" | "maxStderrBytes">):
HostNodeToolchainProbeInvocationV2 {
  const env = Object.freeze({ ...input.env });
  return Object.freeze({
    ...input,
    argv: Object.freeze([...input.argv]),
    env,
    shell: false,
    timeoutMs: NODE_PROBE_TIMEOUT_MS_V2,
    maxStdoutBytes: NODE_PROBE_MAX_STDOUT_BYTES_V2,
    maxStderrBytes: NODE_PROBE_MAX_STDERR_BYTES_V2,
  });
}

function assertProbeSucceeded(
  result: HostNodeToolchainProbeResultV2,
  probeRef: HostNodeToolchainProbeRefV2,
): asserts result is Extract<HostNodeToolchainProbeResultV2, { status: "exited" }> {
  if (Buffer.byteLength(result.stdout, "utf8") > NODE_PROBE_MAX_STDOUT_BYTES_V2
    || Buffer.byteLength(result.stderr, "utf8") > NODE_PROBE_MAX_STDERR_BYTES_V2
    || result.status === "output_limit_exceeded") {
    fail("HOST_NODE_TOOLCHAIN_V2_PROBE_OUTPUT_LIMIT", `${probeRef} exceeded its output bound`);
  }
  if (result.status === "timed_out") {
    fail("HOST_NODE_TOOLCHAIN_V2_PROBE_TIMEOUT", `${probeRef} exceeded its exact timeout`);
  }
  if (result.status === "spawn_failed") {
    fail("HOST_NODE_TOOLCHAIN_V2_PROBE_SPAWN_FAILED", `${probeRef} could not be spawned exactly`);
  }
  if (result.signal !== null) {
    fail("HOST_NODE_TOOLCHAIN_V2_PROBE_SIGNALLED", `${probeRef} terminated by signal`);
  }
  if (result.exitCode !== 0) {
    fail("HOST_NODE_TOOLCHAIN_V2_PROBE_NONZERO", `${probeRef} exited nonzero`);
  }
  if (result.stderr !== "") {
    fail("HOST_NODE_TOOLCHAIN_V2_PROBE_MALFORMED", `${probeRef} wrote unexpected stderr`);
  }
}

type NodeProbeIdentityV2 = Readonly<{
  version: string;
  modulesAbi: string;
  napiVersion: string;
  platform: "darwin";
  architecture: "arm64" | "x64";
}>;

function parseNodeProbeOutput(stdout: string, expectedNodePath: string): NodeProbeIdentityV2 {
  let parsed: unknown;
  try {
    if (!stdout.endsWith("\n") || stdout.slice(0, -1).includes("\n")) throw new Error("not one JSON line");
    parsed = JSON.parse(stdout.slice(0, -1));
  } catch (error) {
    return fail("HOST_NODE_TOOLCHAIN_V2_PROBE_MALFORMED", "Node identity probe did not return one JSON line", error);
  }
  const expectedKeys = ["architecture", "execPath", "modulesAbi", "napiVersion", "platform", "version"];
  if (
    !isPlainRecord(parsed)
    || !exactRecordKeys(parsed, expectedKeys)
    || typeof parsed.version !== "string"
    || typeof parsed.modulesAbi !== "string"
    || typeof parsed.napiVersion !== "string"
    || parsed.platform !== "darwin"
    || (parsed.architecture !== "arm64" && parsed.architecture !== "x64")
    || typeof parsed.execPath !== "string"
    || !/^(?:0|[1-9][0-9]*)$/.test(parsed.modulesAbi)
    || !/^(?:0|[1-9][0-9]*)$/.test(parsed.napiVersion)
  ) {
    fail("HOST_NODE_TOOLCHAIN_V2_PROBE_MALFORMED", "Node identity probe fields are not exact");
  }
  let probedRealpath: string;
  try {
    probedRealpath = realpathSync(parsed.execPath);
  } catch (error) {
    return fail(
      "HOST_NODE_TOOLCHAIN_V2_EXECUTABLE_PAIRING_MISMATCH",
      "Node identity probe execPath cannot resolve to the admitted executable",
      error,
    );
  }
  if (probedRealpath !== expectedNodePath) {
    fail(
      "HOST_NODE_TOOLCHAIN_V2_EXECUTABLE_PAIRING_MISMATCH",
      "Node identity probe ran a different executable than the admitted Node file",
    );
  }
  return Object.freeze({
    version: parsed.version,
    modulesAbi: parsed.modulesAbi,
    napiVersion: parsed.napiVersion,
    platform: parsed.platform,
    architecture: parsed.architecture,
  });
}

function nodeVersionSatisfiesRange(version: string): boolean {
  const match = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/.exec(version);
  if (!match) return false;
  const major = Number(match[1]);
  const minor = Number(match[2]);
  return major === 22 && minor >= 13;
}

async function probeToolchain(input: Readonly<{
  root: ResolvedRootV2;
  npmPackage: CapturedNpmPackageV2;
  host: HostIdentityV2;
  probeAdapter: HostNodeToolchainProbeAdapterV2;
}>): Promise<NodeProbeIdentityV2> {
  const probeRoot = mkdtempSync("/private/tmp/setfarm-host-node-probe-v2-");
  try {
    chmodSync(probeRoot, 0o700);
    const home = path.join(probeRoot, "home");
    const cache = path.join(probeRoot, "cache");
    const temp = path.join(probeRoot, "tmp");
    mkdirSync(home, { mode: 0o700 });
    mkdirSync(cache, { mode: 0o700 });
    mkdirSync(temp, { mode: 0o700 });
    const userNpmrc = path.join(probeRoot, "user.npmrc");
    const globalNpmrc = path.join(probeRoot, "global.npmrc");
    writeFileSync(userNpmrc, "\n", { mode: 0o600, flag: "wx" });
    writeFileSync(globalNpmrc, "\n", { mode: 0o600, flag: "wx" });
    const env = Object.freeze({
      HOME: home,
      LANG: "C.UTF-8",
      LC_ALL: "C.UTF-8",
      NO_COLOR: "1",
      NPM_CONFIG_CACHE: cache,
      NPM_CONFIG_GLOBALCONFIG: globalNpmrc,
      NPM_CONFIG_USERCONFIG: userNpmrc,
      PATH: path.dirname(input.root.nodePath),
      TEMP: temp,
      TMP: temp,
      TMPDIR: temp,
      TZ: "UTC",
    });
    const nodeInvocation = immutableProbeInvocation({
      probeRef: "HOST_NODE_RUNTIME_IDENTITY_PROBE_V2",
      executable: input.root.nodePath,
      argv: ["--input-type=commonjs", "--eval", NODE_IDENTITY_PROBE_SOURCE_V2],
      cwd: input.root.realRoot,
      env,
    });
    let nodeResult: HostNodeToolchainProbeResultV2;
    try {
      nodeResult = await input.probeAdapter(nodeInvocation);
    } catch (error) {
      return fail("HOST_NODE_TOOLCHAIN_V2_PROBE_SPAWN_FAILED", "Node identity probe adapter failed", error);
    }
    assertProbeSucceeded(nodeResult, nodeInvocation.probeRef);
    const nodeIdentity = parseNodeProbeOutput(nodeResult.stdout, input.root.nodePath);
    if (!nodeVersionSatisfiesRange(nodeIdentity.version)) {
      fail(
        "HOST_NODE_TOOLCHAIN_V2_NODE_VERSION_MISMATCH",
        "Admitted Node version does not satisfy >=22.13.0 <23",
      );
    }
    if (
      nodeIdentity.platform !== input.host.platform
      || nodeIdentity.architecture !== input.host.architecture
    ) {
      fail(
        "HOST_NODE_TOOLCHAIN_V2_EXECUTABLE_PAIRING_MISMATCH",
        "Node probe platform or architecture differs from the admitted host",
      );
    }

    const npmInvocation = immutableProbeInvocation({
      probeRef: "HOST_NPM_VERSION_PROBE_V2",
      executable: input.root.nodePath,
      argv: [input.root.npmCliPath, "--version"],
      cwd: input.root.npmRoot,
      env,
    });
    let npmResult: HostNodeToolchainProbeResultV2;
    try {
      npmResult = await input.probeAdapter(npmInvocation);
    } catch (error) {
      return fail("HOST_NODE_TOOLCHAIN_V2_PROBE_SPAWN_FAILED", "npm version probe adapter failed", error);
    }
    assertProbeSucceeded(npmResult, npmInvocation.probeRef);
    if (npmResult.stdout !== "10.9.8\n") {
      if (/^[0-9]+\.[0-9]+\.[0-9]+\n$/.test(npmResult.stdout)) {
        fail("HOST_NODE_TOOLCHAIN_V2_NPM_VERSION_MISMATCH", "Admitted npm version is not exactly 10.9.8");
      }
      fail("HOST_NODE_TOOLCHAIN_V2_PROBE_MALFORMED", "npm version probe did not return one exact version line");
    }
    if (input.npmPackage.version !== "10.9.8") {
      fail(
        "HOST_NODE_TOOLCHAIN_V2_NPM_VERSION_MISMATCH",
        "npm package.json version is not exactly 10.9.8",
      );
    }
    return nodeIdentity;
  } finally {
    rmSync(probeRoot, { recursive: true, force: true });
  }
}

function requirementForProfile(profileId: NodeScaffoldProfileIdV2): HostNodeToolchainRequirementV2 {
  const catalog = getCodeOwnedNodeScaffoldToolchainCatalogV2();
  const entry = getCodeOwnedNodeScaffoldToolchainEntryV2(profileId);
  if (
    !entry
    || entry.toolchain.nodeRuntime.executableRef !== "TOOL_NODE_RUNTIME_V2"
    || entry.toolchain.nodeRuntime.compatibilityRange !== ">=22.13.0 <23"
    || entry.toolchain.npm.executableRef !== "TOOL_NODE_NPM_CLI_V2"
    || entry.toolchain.npm.exactVersion !== "10.9.8"
  ) {
    return fail(
      "HOST_NODE_TOOLCHAIN_V2_INPUT_INVALID",
      "Code-owned Node scaffold toolchain requirements cannot be reproduced",
    );
  }
  const identity = {
    catalogSchema: NODE_SCAFFOLD_TOOLCHAIN_CATALOG_V2_SCHEMA,
    catalogHash: catalog.catalogHash,
    entrySchema: NODE_SCAFFOLD_TOOLCHAIN_ENTRY_V2_SCHEMA,
    entryRef: entry.entryRef,
    entryHash: entry.entryHash,
    profileId,
    nodeExecutableRef: "TOOL_NODE_RUNTIME_V2" as const,
    nodeCompatibilityRange: ">=22.13.0 <23" as const,
    npmExecutableRef: "TOOL_NODE_NPM_CLI_V2" as const,
    npmExactVersion: "10.9.8" as const,
  };
  return Object.freeze({
    ...identity,
    requirementHash: hashHostNodeToolchainRequirementV2(identity),
  });
}

function privateCaptureHash(input: Readonly<{
  root: ResolvedRootV2;
  nodeFile: CapturedFileV2;
  npmPackage: CapturedNpmPackageV2;
  dynamicLibraries: readonly CapturedDynamicLibraryV2[];
}>): string {
  return hashCanonicalJson({
    schema: "setfarm.host-node-toolchain-private-capture.v2",
    rootIdentityHash: input.root.rootIdentityHash,
    node: {
      locatorHash: sha256(input.nodeFile.absolutePath),
      fingerprint: input.nodeFile.fingerprint,
      contentHash: input.nodeFile.contentHash,
    },
    npmPrivateIdentityHash: input.npmPackage.privateIdentityHash,
    dynamicLibraries: input.dynamicLibraries.map((library) => ({
      installNameHash: library.installNameHash,
      locatorHash: sha256(library.absolutePath),
      fingerprint: library.file.fingerprint,
      contentHash: library.file.contentHash,
    })),
  });
}

async function captureAuthorityState(input: Readonly<{
  candidate: PrivateAuthorityStateV2["candidate"];
  testDynamicLibraryPaths?: readonly string[];
}>): Promise<CapturedAuthorityStateV2> {
  const root = resolveCandidateRoot(input.candidate);
  const nodeFile = readExactFile({
    absolutePath: root.nodePath,
    relativePath: "bin/node",
    allowedModes: [0o555],
    maxBytes: 1024 * 1024 * 1024,
    errorCode: "HOST_NODE_TOOLCHAIN_V2_NODE_IDENTITY_INVALID",
  });
  const npmPackage = captureNpmPackage(root.npmRoot);
  if (
    nodeFile.fingerprint.ownerUid !== npmPackage.rootOwnerUid
    || nodeFile.fingerprint.ownerGid !== npmPackage.rootOwnerGid
  ) {
    fail(
      "HOST_NODE_TOOLCHAIN_V2_EXECUTABLE_PAIRING_MISMATCH",
      "Node executable and npm package root must share one installation owner",
    );
  }
  const dynamicLibraries = await captureDynamicLibraries({
    nodePath: root.nodePath,
    ...(input.testDynamicLibraryPaths
      ? { testPaths: input.testDynamicLibraryPaths }
      : {}),
  });
  const privateIdentityHash = privateCaptureHash({ root, nodeFile, npmPackage, dynamicLibraries });
  return Object.freeze({ root, nodeFile, npmPackage, dynamicLibraries, privateIdentityHash });
}

function assertProvisioningJoin(input: Readonly<{
  admissionScope: "production_host" | "test_fixture";
  host: HostIdentityV2;
  captured: CapturedAuthorityStateV2;
  receipt: NodeToolchainProvisioningReceiptV2;
}>): void {
  const expectedProvisioningScope = input.admissionScope === "production_host"
    ? "production_root"
    : "test_fixture";
  const root = input.captured.root.rootFingerprint;
  const source = input.receipt.source.tree;
  if (
    input.receipt.admissionScope !== expectedProvisioningScope
    || input.receipt.intent.architecture !== input.host.architecture
    || input.receipt.source.inventory.distribution.artifact.architecture !== input.host.architecture
    || input.receipt.finalRoot.device !== root.device
    || input.receipt.finalRoot.inode !== root.inode
    || input.receipt.finalRoot.ownerUid !== root.ownerUid
    || input.receipt.finalRoot.ownerGid !== root.ownerGid
    || input.receipt.finalRoot.mode !== modeTextFromBits(root.mode)
    || input.receipt.finalRoot.nodeContentHash !== input.captured.nodeFile.contentHash
    || input.receipt.finalRoot.npmTreeHash !== input.captured.npmPackage.normalizedTreeHash
    || source.node.contentHash !== input.captured.nodeFile.contentHash
    || source.npm.treeHash !== input.captured.npmPackage.normalizedTreeHash
    || source.npm.fileCount !== input.captured.npmPackage.fileCount
    || source.npm.directoryCount !== input.captured.npmPackage.directoryCount
    || source.npm.totalBytes !== input.captured.npmPackage.totalBytes
    || source.npm.cli.contentHash !== input.captured.npmPackage.cli.contentHash
    || source.npm.packageJson.contentHash !== input.captured.npmPackage.packageJson.contentHash
  ) {
    return fail(
      "HOST_NODE_TOOLCHAIN_V2_PROVISIONING_AUTHORITY_INVALID",
      "Host Node/npm capture does not join the exact durable provisioning authority",
    );
  }
}

async function requireProvisioningReceipt(input: Readonly<{
  admissionScope: "production_host" | "test_fixture";
  handle: ProvisionedNodeToolchainV2;
}>): Promise<NodeToolchainProvisioningReceiptV2> {
  try {
    const receipt = await revalidateProvisionedNodeToolchainV2(input.handle);
    const expectedScope = input.admissionScope === "production_host"
      ? "production_root"
      : "test_fixture";
    if (receipt.admissionScope !== expectedScope) {
      return fail(
        "HOST_NODE_TOOLCHAIN_V2_PROVISIONING_AUTHORITY_INVALID",
        "Host authority cannot promote a provisioning authority from another admission scope",
      );
    }
    return receipt;
  } catch (error) {
    if (error instanceof HostNodeToolchainAuthorityErrorV2) throw error;
    return fail(
      "HOST_NODE_TOOLCHAIN_V2_PROVISIONING_AUTHORITY_INVALID",
      "Durable Node provisioning authority could not be reproduced",
      error,
    );
  }
}

function buildReceipt(input: Readonly<{
  admissionScope: "production_host" | "test_fixture";
  requirement: HostNodeToolchainRequirementV2;
  host: HostIdentityV2;
  captured: CapturedAuthorityStateV2;
  nodeProbe: NodeProbeIdentityV2;
  provisioningReceipt?: NodeToolchainProvisioningReceiptV2;
}>): HostNodeToolchainReceiptV2 {
  const dynamicIdentity = {
    resolutionPolicy: "darwin_recursive_loader_graph_v2" as const,
    systemLibraryTrust: "exact_macos_build_identity" as const,
    memberCount: input.captured.dynamicLibraries.length,
    members: input.captured.dynamicLibraries.map((library, index) => ({
      memberRef: `HOST_NODE_NON_SYSTEM_DYLIB_${String(index + 1).padStart(4, "0")}`,
      installNameHash: library.installNameHash,
      file: exactFileIdentity(library.file),
    })),
  };
  const dynamicClosure = {
    ...dynamicIdentity,
    closureHash: hashHostNodeDynamicLibraryClosureV2(dynamicIdentity),
  };
  const nodeIdentity = {
    schema: HOST_NODE_EXECUTABLE_IDENTITY_V2_SCHEMA,
    executableRef: "TOOL_NODE_RUNTIME_V2" as const,
    version: input.nodeProbe.version,
    modulesAbi: input.nodeProbe.modulesAbi,
    napiVersion: input.nodeProbe.napiVersion,
    platform: input.nodeProbe.platform,
    architecture: input.nodeProbe.architecture,
    executable: exactFileIdentity(input.captured.nodeFile),
    nonSystemDynamicLibraries: dynamicClosure,
  };
  const node = {
    ...nodeIdentity,
    identityHash: hashHostNodeExecutableIdentityV2(nodeIdentity),
  };
  const npmIdentity = {
    schema: HOST_NPM_PACKAGE_CLOSURE_V2_SCHEMA,
    executableRef: "TOOL_NODE_NPM_CLI_V2" as const,
    packageName: "npm" as const,
    version: input.captured.npmPackage.version,
    rootOwnerUid: input.captured.npmPackage.rootOwnerUid,
    rootOwnerGid: input.captured.npmPackage.rootOwnerGid,
    cliLocator: "bin/npm-cli.js" as const,
    cli: exactFileIdentity(input.captured.npmPackage.cli),
    packageJsonLocator: "package.json" as const,
    packageJson: exactFileIdentity(input.captured.npmPackage.packageJson),
    builtinNpmrc: {
      locator: "npmrc" as const,
      status: "absent" as const,
    },
    packageTree: {
      treeContract: "host_npm_package_tree_every_and_only_v2" as const,
      rootMode: input.captured.npmPackage.rootMode,
      fileCount: input.captured.npmPackage.fileCount,
      directoryCount: input.captured.npmPackage.directoryCount,
      totalBytes: input.captured.npmPackage.totalBytes,
      treeHash: input.captured.npmPackage.treeHash,
      normalizedTreeHash: input.captured.npmPackage.normalizedTreeHash,
    },
  };
  const npm = {
    ...npmIdentity,
    closureHash: hashHostNpmPackageClosureV2(npmIdentity),
  };
  const receiptIdentity: HostNodeToolchainReceiptHashPayloadV2 = {
    schema: HOST_NODE_TOOLCHAIN_RECEIPT_V2_SCHEMA,
    receiptVersion: HOST_NODE_TOOLCHAIN_RECEIPT_VERSION_V2,
    authorityRef: HOST_NODE_TOOLCHAIN_AUTHORITY_REF_V2,
    authorityVersion: HOST_NODE_TOOLCHAIN_AUTHORITY_VERSION_V2,
    status: "verified" as const,
    admissionScope: input.admissionScope,
    filesystemProtection: input.admissionScope === "production_host"
      ? "root_owned_runtime_read_only" as const
      : "test_fixture_only" as const,
    installationRoot: {
      device: input.captured.root.rootFingerprint.device,
      inode: input.captured.root.rootFingerprint.inode,
      ownerUid: input.captured.root.rootFingerprint.ownerUid,
      ownerGid: input.captured.root.rootFingerprint.ownerGid,
      mode: modeTextFromBits(input.captured.root.rootFingerprint.mode) as "0555" | "0700" | "0755",
    },
    provisioning: input.provisioningReceipt
      ? {
          policy: "durable_provisioning_receipt_required_v2" as const,
          status: "provisioned_verified" as const,
          receiptSchema: input.provisioningReceipt.schema,
          authorityRef: input.provisioningReceipt.authorityRef,
          admissionScope: input.provisioningReceipt.admissionScope,
          receiptHash: input.provisioningReceipt.receiptHash,
          sourcePrivateTreeReceiptHash: input.provisioningReceipt.source.receiptHash,
          targetRef: input.provisioningReceipt.finalRoot.targetRef,
          rootLocatorHash: input.provisioningReceipt.finalRoot.rootLocatorHash,
          rootDevice: input.provisioningReceipt.finalRoot.device,
          rootInode: input.provisioningReceipt.finalRoot.inode,
          treeHash: input.provisioningReceipt.finalRoot.treeHash,
          fileCount: input.provisioningReceipt.finalRoot.fileCount,
          directoryCount: input.provisioningReceipt.finalRoot.directoryCount,
          totalBytes: input.provisioningReceipt.finalRoot.totalBytes,
          nodeContentHash: input.provisioningReceipt.finalRoot.nodeContentHash,
          npmTreeHash: input.provisioningReceipt.finalRoot.npmTreeHash,
          npmFileCount: input.provisioningReceipt.source.tree.npm.fileCount,
          npmDirectoryCount: input.provisioningReceipt.source.tree.npm.directoryCount,
          npmTotalBytes: input.provisioningReceipt.source.tree.npm.totalBytes,
        }
      : {
          policy: "test_fixture_unprovisioned_v2" as const,
          status: "not_applicable" as const,
        },
    requirement: input.requirement,
    host: input.host,
    node,
    npm,
    probe: {
      executionPolicy: "direct_exact_node_argv_deny_all_environment_v2" as const,
      shell: "forbidden" as const,
      timeoutMs: NODE_PROBE_TIMEOUT_MS_V2,
      maxStdoutBytes: NODE_PROBE_MAX_STDOUT_BYTES_V2,
      maxStderrBytes: NODE_PROBE_MAX_STDERR_BYTES_V2,
      nodeProbeSourceHash: sha256(NODE_IDENTITY_PROBE_SOURCE_V2),
      environmentContractHash: PROBE_ENVIRONMENT_CONTRACT_HASH_V2,
    },
    commandPathProjection: {
      policy: "single_admitted_node_bin_then_exact_module_argv_v2" as const,
      orderedExecutableRefs: [
        "TOOL_NODE_RUNTIME_V2" as const,
        "TOOL_NODE_NPM_CLI_V2" as const,
      ],
      projectionHash: COMMAND_PATH_PROJECTION_HASH_V2,
    },
  };
  const parsed = HostNodeToolchainReceiptV2Schema.safeParse({
    ...receiptIdentity,
    receiptHash: hashHostNodeToolchainReceiptV2(receiptIdentity),
  });
  if (!parsed.success) {
    return fail(
      "HOST_NODE_TOOLCHAIN_V2_RECEIPT_INVALID",
      "Fresh host Node toolchain receipt failed its canonical schema",
      parsed.error,
    );
  }
  return deepFreezeJson(parsed.data);
}

function deepFreezeJson<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  const pending: object[] = [value as object];
  while (pending.length > 0) {
    const current = pending.pop()!;
    if (Object.isFrozen(current)) continue;
    for (const child of Object.values(current)) {
      if (child !== null && typeof child === "object" && !Object.isFrozen(child)) pending.push(child);
    }
    Object.freeze(current);
  }
  return value;
}

function defensiveReceiptCopy(receipt: HostNodeToolchainReceiptV2): HostNodeToolchainReceiptV2 {
  return deepFreezeJson(structuredClone(receipt));
}

function authenticState(handle: HostNodeToolchainAuthorityV2): PrivateAuthorityStateV2 {
  if (
    typeof handle !== "object"
    || handle === null
    || isProxy(handle)
    || Object.getPrototypeOf(handle) !== HostNodeToolchainAuthorityV2.prototype
  ) {
    return fail(
      "HOST_NODE_TOOLCHAIN_V2_HANDLE_UNAUTHENTICATED",
      "Host Node toolchain operation requires one authentic authority handle",
    );
  }
  const state = privateAuthorityStateV2.get(handle);
  if (!state) {
    return fail(
      "HOST_NODE_TOOLCHAIN_V2_HANDLE_UNAUTHENTICATED",
      "Host Node toolchain operation requires one authentic authority handle",
    );
  }
  return state;
}

async function buildAuthority(input: Readonly<{
  admissionScope: "production_host" | "test_fixture";
  profileId: NodeScaffoldProfileIdV2;
  host: HostIdentityV2;
  candidate: PrivateAuthorityStateV2["candidate"];
  testDynamicLibraryPaths?: readonly string[];
  probeAdapter: HostNodeToolchainProbeAdapterV2;
  provisionedToolchain?: ProvisionedNodeToolchainV2;
}>): Promise<HostNodeToolchainAuthorityV2> {
  const requirement = requirementForProfile(input.profileId);
  if (input.admissionScope === "production_host" && !input.provisionedToolchain) {
    return fail(
      "HOST_NODE_TOOLCHAIN_V2_PROVISIONING_AUTHORITY_INVALID",
      "Production host authority requires one durable production provisioning authority",
    );
  }
  let provisioningReceipt = input.provisionedToolchain
    ? await requireProvisioningReceipt({
        admissionScope: input.admissionScope,
        handle: input.provisionedToolchain,
      })
    : undefined;
  const captured = await captureAuthorityState({
    candidate: input.candidate,
    ...(input.testDynamicLibraryPaths
      ? { testDynamicLibraryPaths: input.testDynamicLibraryPaths }
      : {}),
  });
  if (
    input.admissionScope === "production_host"
    && (
      captured.root.rootOwnerUid !== 0
      || captured.nodeFile.fingerprint.ownerUid !== 0
      || captured.npmPackage.rootOwnerUid !== 0
      || captured.dynamicLibraries.some((library) => library.file.fingerprint.ownerUid !== 0)
    )
  ) {
    return fail(
      "HOST_NODE_TOOLCHAIN_V2_CANDIDATE_LAYOUT_INVALID",
      "Production Node/npm and every non-system dynamic library must be root-owned",
    );
  }
  if (provisioningReceipt) {
    assertProvisioningJoin({
      admissionScope: input.admissionScope,
      host: input.host,
      captured,
      receipt: provisioningReceipt,
    });
  }
  const nodeProbe = await probeToolchain({
    root: captured.root,
    npmPackage: captured.npmPackage,
    host: input.host,
    probeAdapter: input.probeAdapter,
  });
  if (input.provisionedToolchain) {
    const freshProvisioningReceipt = await requireProvisioningReceipt({
      admissionScope: input.admissionScope,
      handle: input.provisionedToolchain,
    });
    if (freshProvisioningReceipt.receiptHash !== provisioningReceipt?.receiptHash) {
      return fail(
        "HOST_NODE_TOOLCHAIN_V2_PROVISIONING_AUTHORITY_INVALID",
        "Durable provisioning receipt changed during host toolchain admission",
      );
    }
    assertProvisioningJoin({
      admissionScope: input.admissionScope,
      host: input.host,
      captured,
      receipt: freshProvisioningReceipt,
    });
    provisioningReceipt = freshProvisioningReceipt;
  }
  const receipt = buildReceipt({
    admissionScope: input.admissionScope,
    requirement,
    host: input.host,
    captured,
    nodeProbe,
    ...(provisioningReceipt ? { provisioningReceipt } : {}),
  });
  const state: PrivateAuthorityStateV2 = Object.freeze({
    admissionScope: input.admissionScope,
    profileId: input.profileId,
    requirement,
    host: Object.freeze({ ...input.host }),
    candidate: Object.freeze({
      ...input.candidate,
      expectedRealRoot: captured.root.realRoot,
    }),
    ...(input.testDynamicLibraryPaths
      ? { testDynamicLibraryPaths: Object.freeze([...input.testDynamicLibraryPaths]) }
      : {}),
    probeAdapter: input.probeAdapter,
    ...(input.provisionedToolchain
      ? {
          provisionedToolchain: input.provisionedToolchain,
          provisioningReceipt,
        }
      : {}),
    captured,
    receipt,
  });
  return new HostNodeToolchainAuthorityV2(authorityConstructorCapabilityV2, state);
}

function productionHostIdentity(): HostIdentityV2 {
  if (process.platform !== "darwin" || (process.arch !== "arm64" && process.arch !== "x64")) {
    return fail(
      "HOST_NODE_TOOLCHAIN_V2_NO_ADMITTED_CANDIDATE",
      "Host Node toolchain V2 currently admits only Darwin arm64 or x64",
    );
  }
  const exactSwVers = (argument: "-productVersion" | "-buildVersion"): string => {
    try {
      const output = readFileSync(
        argument === "-productVersion"
          ? "/System/Library/CoreServices/SystemVersion.plist"
          : "/System/Library/CoreServices/SystemVersion.plist",
        "utf8",
      );
      const key = argument === "-productVersion" ? "ProductUserVisibleVersion" : "ProductBuildVersion";
      const expression = new RegExp(`<key>${key}</key>\\s*<string>([^<]+)</string>`);
      const match = expression.exec(output);
      if (!match) throw new Error(`${key} missing`);
      return match[1]!;
    } catch (error) {
      return fail(
        "HOST_NODE_TOOLCHAIN_V2_NO_ADMITTED_CANDIDATE",
        "Exact macOS version identity cannot be read",
        error,
      );
    }
  };
  return Object.freeze({
    platform: "darwin",
    architecture: process.arch,
    macosProductVersion: exactSwVers("-productVersion"),
    macosBuildVersion: exactSwVers("-buildVersion"),
    darwinKernelRelease: osRelease(),
  });
}

/**
 * Creates production authority from one profile and one code-owned Darwin
 * candidate registry. Absolute roots, process adapters and expected versions
 * are intentionally absent from this input surface.
 */
export async function createHostNodeToolchainAuthorityV2(input: unknown):
Promise<HostNodeToolchainAuthorityV2> {
  const profileId = parseProductionInput(input);
  const host = productionHostIdentity();
  const candidate = getCodeOwnedNodeToolchainTargetV2(host.architecture);
  let provisionedToolchain: ProvisionedNodeToolchainV2;
  try {
    provisionedToolchain = await openProductionProvisionedNodeToolchainV2();
  } catch (error) {
    return fail(
      "HOST_NODE_TOOLCHAIN_V2_PROVISIONING_AUTHORITY_INVALID",
      "Code-owned durable Node provisioning authority is unavailable",
      error,
    );
  }
  return buildAuthority({
    admissionScope: "production_host",
    profileId,
    host,
    candidate: {
      logicalRoot: candidate.logicalRoot,
      productionRootPolicy: "root_owned_direct_exact_v2",
    },
    probeAdapter: productionProbeAdapter,
    provisionedToolchain,
  });
}

export type HostNodeToolchainAuthorityV2TestInput = Readonly<{
  profileId: NodeScaffoldProfileIdV2;
  fixture: Readonly<{
    candidateRoot: string;
    host: HostIdentityV2;
    nonSystemDynamicLibraryPaths?: readonly string[];
  }>;
  probeAdapter?: HostNodeToolchainProbeAdapterV2;
  provisionedToolchain?: ProvisionedNodeToolchainV2;
}>;

/**
 * Test-scoped constructor. Its receipt is permanently branded test_fixture;
 * later operational materializers must require production_host.
 */
export async function createHostNodeToolchainAuthorityV2ForTest(
  input: HostNodeToolchainAuthorityV2TestInput,
): Promise<HostNodeToolchainAuthorityV2> {
  return buildAuthority({
    admissionScope: "test_fixture",
    profileId: input.profileId,
    host: input.fixture.host,
    candidate: { logicalRoot: input.fixture.candidateRoot },
    ...(input.fixture.nonSystemDynamicLibraryPaths
      ? { testDynamicLibraryPaths: input.fixture.nonSystemDynamicLibraryPaths }
      : {}),
    probeAdapter: input.probeAdapter ?? productionProbeAdapter,
    ...(input.provisionedToolchain
      ? { provisionedToolchain: input.provisionedToolchain }
      : {}),
  });
}

export function inspectHostNodeToolchainReceiptV2(
  handle: HostNodeToolchainAuthorityV2,
): HostNodeToolchainReceiptV2 {
  return defensiveReceiptCopy(authenticState(handle).receipt);
}

export function isProductionHostNodeToolchainAuthorityV2(
  handle: HostNodeToolchainAuthorityV2,
): boolean {
  return authenticState(handle).admissionScope === "production_host";
}

/**
 * Fresh-captures every held byte and POSIX identity. This is the mandatory
 * pre-spawn operation; a later execution module must keep the exact paths
 * private and spawn immediately inside the same authority boundary.
 */
export async function revalidateHostNodeToolchainAuthorityV2(
  handle: HostNodeToolchainAuthorityV2,
): Promise<HostNodeToolchainReceiptV2> {
  const state = authenticState(handle);
  try {
    const provisioningReceipt = state.provisionedToolchain
      ? await requireProvisioningReceipt({
          admissionScope: state.admissionScope,
          handle: state.provisionedToolchain,
        })
      : undefined;
    if (
      state.admissionScope === "production_host"
      && (!provisioningReceipt || !state.provisioningReceipt)
    ) {
      fail(
        "HOST_NODE_TOOLCHAIN_V2_HOST_DRIFT",
        "Production host authority lost its durable provisioning authority",
      );
    }
    if (
      provisioningReceipt
      && provisioningReceipt.receiptHash !== state.provisioningReceipt?.receiptHash
    ) {
      fail(
        "HOST_NODE_TOOLCHAIN_V2_HOST_DRIFT",
        "Durable provisioning receipt changed after host authority issuance",
      );
    }
    const fresh = await captureAuthorityState({
      candidate: state.candidate,
      ...(state.testDynamicLibraryPaths
        ? { testDynamicLibraryPaths: state.testDynamicLibraryPaths }
        : {}),
    });
    if (fresh.privateIdentityHash !== state.captured.privateIdentityHash) {
      fail(
        "HOST_NODE_TOOLCHAIN_V2_HOST_DRIFT",
        "Host Node/npm bytes, topology or held POSIX identity changed after admission",
      );
    }
    if (provisioningReceipt) {
      assertProvisioningJoin({
        admissionScope: state.admissionScope,
        host: state.host,
        captured: fresh,
        receipt: provisioningReceipt,
      });
    }
    return defensiveReceiptCopy(state.receipt);
  } catch (error) {
    if (error instanceof HostNodeToolchainAuthorityErrorV2
      && error.code === "HOST_NODE_TOOLCHAIN_V2_HOST_DRIFT") throw error;
    return fail(
      "HOST_NODE_TOOLCHAIN_V2_HOST_DRIFT",
      "Host Node/npm authority could not reproduce its admitted private identity",
      error,
    );
  }
}

/**
 * @internal
 *
 * Returns the exact executable locator only to a consumer that already holds
 * the authentic host-toolchain capability. Serialized receipts remain
 * pathless; the caller must spawn immediately and fresh-revalidate the same
 * authority after the process boundary.
 */
export type HostNodeRuntimeLaunchContextInternalV2 = Readonly<{
  admissionScope: "production_host" | "test_fixture";
  profileId: NodeScaffoldProfileIdV2;
  nodeExecutablePath: string;
  nodeExecutableContentHash: string;
  nodeIdentityHash: string;
  hostToolchainReceiptHash: string;
}>;

export async function acquireHostNodeRuntimeLaunchContextInternalV2(
  handle: HostNodeToolchainAuthorityV2,
): Promise<HostNodeRuntimeLaunchContextInternalV2> {
  const state = authenticState(handle);
  const receipt = await revalidateHostNodeToolchainAuthorityV2(handle);
  if (
    receipt.receiptHash !== state.receipt.receiptHash
    || receipt.node.identityHash !== state.receipt.node.identityHash
    || receipt.node.executable.contentHash
      !== state.captured.nodeFile.contentHash
  ) {
    return fail(
      "HOST_NODE_TOOLCHAIN_V2_HOST_DRIFT",
      "Host Node launch context does not reproduce the admitted executable",
    );
  }
  return Object.freeze({
    admissionScope: state.admissionScope,
    profileId: state.profileId,
    nodeExecutablePath: state.captured.root.nodePath,
    nodeExecutableContentHash: state.captured.nodeFile.contentHash,
    nodeIdentityHash: receipt.node.identityHash,
    hostToolchainReceiptHash: receipt.receiptHash,
  });
}

type EffectiveNpmConfigProbeScopeCaptureV2 = Readonly<{
  privateRoot: string;
  configProbeCwd: string;
  environment: HostNodeToolchainEffectiveNpmConfigProbeInputV2["environment"];
  identityHash: string;
}>;

const EFFECTIVE_NPM_CONFIG_ENVIRONMENT_KEYS_V2 = Object.freeze([
  "CI",
  "HOME",
  "LANG",
  "LC_ALL",
  "NODE_DISABLE_COMPILE_CACHE",
  "NO_COLOR",
  "NPM_CONFIG_CACHE",
  "NPM_CONFIG_ENGINE_STRICT",
  "NPM_CONFIG_GLOBALCONFIG",
  "NPM_CONFIG_LOGS_MAX",
  "NPM_CONFIG_REGISTRY",
  "NPM_CONFIG_USERCONFIG",
  "TEMP",
  "TMP",
  "TMPDIR",
  "TZ",
] as const);

function processOwnerV2(): Readonly<{ uid: number; gid: number }> {
  if (typeof process.geteuid !== "function" || typeof process.getegid !== "function") {
    return fail(
      "HOST_NODE_TOOLCHAIN_V2_EXECUTION_ENVIRONMENT_INVALID",
      "Effective npm config probing requires exact POSIX process ownership",
    );
  }
  return Object.freeze({ uid: process.geteuid(), gid: process.getegid() });
}

function assertMissingPathV2(absolutePath: string, label: string): void {
  try {
    lstatSync(absolutePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    return fail(
      "HOST_NODE_TOOLCHAIN_V2_EXECUTION_ENVIRONMENT_INVALID",
      `${label} absence could not be established exactly`,
      error,
    );
  }
  fail(
    "HOST_NODE_TOOLCHAIN_V2_EXECUTION_ENVIRONMENT_INVALID",
    `${label} must be absent`,
  );
}

function captureEffectiveNpmConfigProbeScopeV2(
  input: HostNodeToolchainEffectiveNpmConfigProbeInputV2,
): EffectiveNpmConfigProbeScopeCaptureV2 {
  if (
    !isPlainRecord(input)
    || !exactRecordKeys(input, ["environment", "privateRoot"])
    || typeof input.privateRoot !== "string"
    || !path.isAbsolute(input.privateRoot)
    || !isPlainRecord(input.environment)
    || !exactRecordKeys(input.environment, EFFECTIVE_NPM_CONFIG_ENVIRONMENT_KEYS_V2)
  ) {
    return fail(
      "HOST_NODE_TOOLCHAIN_V2_EXECUTION_ENVIRONMENT_INVALID",
      "Effective npm config probe input is not one exact private environment",
    );
  }
  const root = input.privateRoot;
  const owner = processOwnerV2();
  const expected = Object.freeze({
    HOME: path.join(root, "home"),
    NPM_CONFIG_CACHE: path.join(root, "cache"),
    NPM_CONFIG_GLOBALCONFIG: path.join(root, "global.npmrc"),
    NPM_CONFIG_USERCONFIG: path.join(root, "user.npmrc"),
    TEMP: path.join(root, "tmp"),
    TMP: path.join(root, "tmp"),
    TMPDIR: path.join(root, "tmp"),
  });
  if (
    input.environment.CI !== "true"
    || input.environment.LANG !== "C.UTF-8"
    || input.environment.LC_ALL !== "C.UTF-8"
    || input.environment.NODE_DISABLE_COMPILE_CACHE !== "1"
    || input.environment.NO_COLOR !== "1"
    || input.environment.NPM_CONFIG_ENGINE_STRICT !== "true"
    || input.environment.NPM_CONFIG_LOGS_MAX !== "0"
    || input.environment.NPM_CONFIG_REGISTRY !== "https://registry.npmjs.org"
    || input.environment.TZ !== "UTC"
    || input.environment.HOME !== expected.HOME
    || input.environment.NPM_CONFIG_CACHE !== expected.NPM_CONFIG_CACHE
    || input.environment.NPM_CONFIG_GLOBALCONFIG !== expected.NPM_CONFIG_GLOBALCONFIG
    || input.environment.NPM_CONFIG_USERCONFIG !== expected.NPM_CONFIG_USERCONFIG
    || input.environment.TEMP !== expected.TEMP
    || input.environment.TMP !== expected.TMP
    || input.environment.TMPDIR !== expected.TMPDIR
  ) {
    return fail(
      "HOST_NODE_TOOLCHAIN_V2_EXECUTION_ENVIRONMENT_INVALID",
      "Effective npm config environment differs from the code-owned exact bindings",
    );
  }

  const expectedRootNames = [
    "cache",
    "config-probe",
    "global.npmrc",
    "home",
    "tmp",
    "user.npmrc",
  ];
  const rootStat = lstatSync(root);
  if (
    rootStat.isSymbolicLink()
    || !rootStat.isDirectory()
    || realpathSync(root) !== root
    || modeBits(rootStat) !== 0o700
    || rootStat.uid !== owner.uid
    || rootStat.gid !== owner.gid
    || canonicalJsonKeyList(readdirSync(root).sort()) !== canonicalJsonKeyList(expectedRootNames)
  ) {
    return fail(
      "HOST_NODE_TOOLCHAIN_V2_EXECUTION_ENVIRONMENT_INVALID",
      "Effective npm config private root is not one exact process-owned layout",
    );
  }

  const directories = [
    path.join(root, "cache"),
    path.join(root, "config-probe"),
    path.join(root, "home"),
    path.join(root, "tmp"),
  ].map((absolutePath) => {
    const stat = lstatSync(absolutePath);
    const names = readdirSync(absolutePath).sort();
    if (
      stat.isSymbolicLink()
      || !stat.isDirectory()
      || realpathSync(absolutePath) !== absolutePath
      || modeBits(stat) !== 0o700
      || stat.uid !== owner.uid
      || stat.gid !== owner.gid
      || names.length !== 0
    ) {
      fail(
        "HOST_NODE_TOOLCHAIN_V2_EXECUTION_ENVIRONMENT_INVALID",
        `Effective npm config private directory ${path.basename(absolutePath)} is not exact, empty `
          + `and process-owned (members: ${names.join(",") || "none"})`,
      );
    }
    return Object.freeze({ absolutePath, fingerprint: fingerprint(stat) });
  });

  const configFiles = [
    path.join(root, "global.npmrc"),
    path.join(root, "user.npmrc"),
  ].map((absolutePath) => {
    const stat = lstatSync(absolutePath);
    const bytes = readFileSync(absolutePath);
    const after = lstatSync(absolutePath);
    if (
      stat.isSymbolicLink()
      || !stat.isFile()
      || realpathSync(absolutePath) !== absolutePath
      || modeBits(stat) !== 0o600
      || stat.uid !== owner.uid
      || stat.gid !== owner.gid
      || stat.nlink !== 1
      || !sameFingerprint(fingerprint(stat), fingerprint(after))
      || bytes.length !== 1
      || bytes[0] !== 0x0a
    ) {
      fail(
        "HOST_NODE_TOOLCHAIN_V2_EXECUTION_ENVIRONMENT_INVALID",
        "Effective npm config requires distinct exact blank-LF private npmrc files",
      );
    }
    return Object.freeze({
      absolutePath,
      fingerprint: fingerprint(stat),
      contentHash: sha256(bytes),
    });
  });
  if (configFiles[0]!.fingerprint.inode === configFiles[1]!.fingerprint.inode
    && configFiles[0]!.fingerprint.device === configFiles[1]!.fingerprint.device) {
    fail(
      "HOST_NODE_TOOLCHAIN_V2_EXECUTION_ENVIRONMENT_INVALID",
      "Effective npm config user and global files must have distinct physical identities",
    );
  }
  const configProbeCwd = path.join(root, "config-probe");
  assertMissingPathV2(path.join(configProbeCwd, ".npmrc"), "Probe project .npmrc");
  const identityHash = hashCanonicalJson({
    schema: "setfarm.host-node-effective-npm-config-private-scope.v2",
    root: fingerprint(rootStat),
    directories,
    configFiles,
    environment: input.environment,
  });
  return Object.freeze({
    privateRoot: root,
    configProbeCwd,
    environment: Object.freeze({ ...input.environment }),
    identityHash,
  });
}

function canonicalJsonKeyList(values: readonly string[]): string {
  return JSON.stringify(values);
}

function assertEffectiveNpmConfigProbeSucceededV2(
  result: HostNodeToolchainProbeResultV2,
): asserts result is Extract<HostNodeToolchainProbeResultV2, { status: "exited" }> {
  if (
    Buffer.byteLength(result.stdout, "utf8") > EFFECTIVE_NPM_CONFIG_PROBE_MAX_STDOUT_BYTES_V2
    || Buffer.byteLength(result.stderr, "utf8") > NODE_PROBE_MAX_STDERR_BYTES_V2
    || result.status === "output_limit_exceeded"
  ) {
    fail(
      "HOST_NODE_TOOLCHAIN_V2_PROBE_OUTPUT_LIMIT",
      "HOST_NPM_EFFECTIVE_CONFIG_PROBE_V2 exceeded its output bound",
    );
  }
  if (result.status === "timed_out") {
    fail(
      "HOST_NODE_TOOLCHAIN_V2_PROBE_TIMEOUT",
      "HOST_NPM_EFFECTIVE_CONFIG_PROBE_V2 exceeded its exact timeout",
    );
  }
  if (result.status === "spawn_failed") {
    fail(
      "HOST_NODE_TOOLCHAIN_V2_PROBE_SPAWN_FAILED",
      "HOST_NPM_EFFECTIVE_CONFIG_PROBE_V2 could not be spawned exactly",
    );
  }
  if (result.signal !== null) {
    fail(
      "HOST_NODE_TOOLCHAIN_V2_PROBE_SIGNALLED",
      "HOST_NPM_EFFECTIVE_CONFIG_PROBE_V2 terminated by signal",
    );
  }
  if (result.exitCode !== 0) {
    fail(
      "HOST_NODE_TOOLCHAIN_V2_PROBE_NONZERO",
      "HOST_NPM_EFFECTIVE_CONFIG_PROBE_V2 exited nonzero",
    );
  }
  if (result.stderr !== "") {
    fail(
      "HOST_NODE_TOOLCHAIN_V2_PROBE_MALFORMED",
      "HOST_NPM_EFFECTIVE_CONFIG_PROBE_V2 wrote unexpected stderr",
    );
  }
}

function parseEffectiveNpmConfigProbeOutputV2(input: Readonly<{
  stdout: string;
  environment: HostNodeToolchainEffectiveNpmConfigProbeInputV2["environment"];
}>): Omit<
HostNodeToolchainEffectiveNpmConfigProbeEvidenceV2,
"probeRef" | "hostToolchainReceiptHash" | "environmentHash"
> {
  let parsed: unknown;
  try {
    if (!input.stdout.endsWith("\n") || input.stdout.includes("\r") || input.stdout.startsWith("\ufeff")) {
      throw new Error("not one canonical LF-terminated npm JSON document");
    }
    parsed = JSON.parse(input.stdout);
  } catch (error) {
    return fail(
      "HOST_NODE_TOOLCHAIN_V2_EFFECTIVE_NPM_CONFIG_INVALID",
      "Effective npm config probe did not return one bounded JSON object",
      error,
    );
  }
  if (!isPlainRecord(parsed)) {
    return fail(
      "HOST_NODE_TOOLCHAIN_V2_EFFECTIVE_NPM_CONFIG_INVALID",
      "Effective npm config probe root is not one plain object",
    );
  }
  const keys = Object.keys(parsed).sort();
  if (keys.length === 0 || keys.length > 1_024) {
    return fail(
      "HOST_NODE_TOOLCHAIN_V2_EFFECTIVE_NPM_CONFIG_INVALID",
      "Effective npm config key census is outside its exact bound",
    );
  }
  const credentialKeys = keys.filter((key) => {
    const lower = key.toLowerCase();
    if (lower === "auth-type") return false;
    return lower.startsWith("//")
      || lower === "_auth"
      || lower === "_authtoken"
      || lower === "username"
      || lower === "_password"
      || lower.endsWith(":_auth")
      || lower.endsWith(":_authtoken")
      || lower.endsWith(":username")
      || lower.endsWith(":_password");
  });
  if (credentialKeys.length > 0) {
    return fail(
      "HOST_NODE_TOOLCHAIN_V2_EFFECTIVE_NPM_CONFIG_INVALID",
      "Effective npm config contains an unowned credential binding",
    );
  }
  if (
    parsed.registry !== "https://registry.npmjs.org"
    || parsed.cache !== input.environment.NPM_CONFIG_CACHE
    || parsed.userconfig !== input.environment.NPM_CONFIG_USERCONFIG
    || parsed.globalconfig !== input.environment.NPM_CONFIG_GLOBALCONFIG
    || typeof parsed.prefix !== "string"
    || !path.isAbsolute(parsed.prefix)
    || parsed.location !== "user"
    || parsed.proxy !== null
    || parsed["https-proxy"] !== null
    || !Array.isArray(parsed.noproxy)
    || parsed.noproxy.length !== 1
    || parsed.noproxy[0] !== ""
    || parsed.ca !== null
    || parsed.cafile !== null
    || parsed.cert !== null
    || parsed.key !== null
    || parsed["strict-ssl"] !== true
    || parsed.color !== false
    || parsed["engine-strict"] !== true
    || parsed["ignore-scripts"] !== false
    || parsed["foreground-scripts"] !== false
    || parsed["script-shell"] !== null
    || parsed.shell !== "sh"
    || parsed.audit !== true
    || parsed.fund !== true
    || parsed["logs-max"] !== 0
  ) {
    return fail(
      "HOST_NODE_TOOLCHAIN_V2_EFFECTIVE_NPM_CONFIG_INVALID",
      "Effective npm config differs from the isolated registry, path, TLS or lifecycle contract",
    );
  }
  return Object.freeze({
    rawOutputHash: sha256(input.stdout),
    keySetHash: hashCanonicalJson({
      schema: "setfarm.host-node-effective-npm-config-key-set.v2",
      keys,
    }),
    keyCount: keys.length,
    effective: Object.freeze({
      registry: "https://registry.npmjs.org" as const,
      cache: "PRIVATE_STAGE_NPM_CACHE_V2" as const,
      userconfig: "PRIVATE_STAGE_EMPTY_USER_NPMRC_V2" as const,
      globalconfig: "PRIVATE_STAGE_EMPTY_GLOBAL_NPMRC_V2" as const,
      prefix: "HOST_TOOLCHAIN_DEFAULT_PREFIX_V2" as const,
      location: "user" as const,
      proxy: null,
      httpsProxy: null,
      noProxy: Object.freeze([""] as const),
      ca: null,
      caFile: null,
      certificate: null,
      privateKey: null,
      strictSsl: true as const,
      color: false as const,
      engineStrict: true as const,
      ignoreScripts: false as const,
      foregroundScripts: false as const,
      scriptShell: null,
      shell: "sh" as const,
      audit: true as const,
      fund: true as const,
      logsMax: 0 as const,
    }),
    discoveredCredentialConfigCount: 0 as const,
  });
}

/**
 * Runs only the code-owned npm effective-config probe. The caller supplies one
 * exact private environment layout, while executable paths stay inside this
 * authenticated host-toolchain boundary and are never returned.
 */
export async function probeHostNodeToolchainEffectiveNpmConfigV2(
  handle: HostNodeToolchainAuthorityV2,
  input: HostNodeToolchainEffectiveNpmConfigProbeInputV2,
): Promise<HostNodeToolchainEffectiveNpmConfigProbeEvidenceV2> {
  const state = authenticState(handle);
  const hostBefore = await revalidateHostNodeToolchainAuthorityV2(handle);
  const scopeBefore = captureEffectiveNpmConfigProbeScopeV2(input);
  const environment = Object.freeze({
    ...scopeBefore.environment,
    PATH: path.dirname(state.captured.root.nodePath),
  });
  const environmentHash = hashCanonicalJson({
    schema: "setfarm.node-scaffold-private-execution-environment.v2",
    variables: Object.entries(environment).sort(([left], [right]) =>
      left < right ? -1 : left > right ? 1 : 0),
  });
  const invocation: HostNodeToolchainProbeInvocationV2 = Object.freeze({
    probeRef: "HOST_NPM_EFFECTIVE_CONFIG_PROBE_V2",
    executable: state.captured.root.nodePath,
    argv: Object.freeze([
      state.captured.root.npmCliPath,
      "config",
      "list",
      "--json",
    ]),
    cwd: scopeBefore.configProbeCwd,
    env: environment,
    shell: false,
    timeoutMs: NODE_PROBE_TIMEOUT_MS_V2,
    maxStdoutBytes: EFFECTIVE_NPM_CONFIG_PROBE_MAX_STDOUT_BYTES_V2,
    maxStderrBytes: NODE_PROBE_MAX_STDERR_BYTES_V2,
  });
  let result: HostNodeToolchainProbeResultV2;
  try {
    result = await state.probeAdapter(invocation);
  } catch (error) {
    return fail(
      "HOST_NODE_TOOLCHAIN_V2_PROBE_SPAWN_FAILED",
      "Effective npm config probe adapter failed",
      error,
    );
  }
  assertEffectiveNpmConfigProbeSucceededV2(result);
  const parsed = parseEffectiveNpmConfigProbeOutputV2({
    stdout: result.stdout,
    environment: scopeBefore.environment,
  });
  const scopeAfter = captureEffectiveNpmConfigProbeScopeV2(input);
  if (scopeAfter.identityHash !== scopeBefore.identityHash) {
    return fail(
      "HOST_NODE_TOOLCHAIN_V2_EXECUTION_ENVIRONMENT_INVALID",
      "Effective npm config private environment changed during probing",
    );
  }
  const hostAfter = await revalidateHostNodeToolchainAuthorityV2(handle);
  if (hostAfter.receiptHash !== hostBefore.receiptHash) {
    return fail(
      "HOST_NODE_TOOLCHAIN_V2_HOST_DRIFT",
      "Host Node/npm authority changed during effective config probing",
    );
  }
  return deepFreezeJson({
    probeRef: "HOST_NPM_EFFECTIVE_CONFIG_PROBE_V2" as const,
    hostToolchainReceiptHash: hostBefore.receiptHash,
    environmentHash,
    ...parsed,
  });
}

function captureNpmCiProjectScopeV2(projectRoot: string): string {
  if (!path.isAbsolute(projectRoot) || path.basename(projectRoot) !== "project") {
    return fail(
      "HOST_NODE_TOOLCHAIN_V2_INSTALL_SCOPE_INVALID",
      "npm ci requires one absolute private project root",
    );
  }
  const owner = processOwnerV2();
  try {
    const root = lstatSync(projectRoot);
    const parent = path.dirname(projectRoot);
    const parentStat = lstatSync(parent);
    const names = readdirSync(projectRoot).sort();
    const parentNames = readdirSync(parent).sort();
    if (
      root.isSymbolicLink()
      || !root.isDirectory()
      || realpathSync(projectRoot) !== projectRoot
      || modeBits(root) !== 0o700
      || root.uid !== owner.uid
      || root.gid !== owner.gid
      || parentStat.isSymbolicLink()
      || !parentStat.isDirectory()
      || realpathSync(parent) !== parent
      || modeBits(parentStat) !== 0o700
      || parentStat.uid !== owner.uid
      || parentStat.gid !== owner.gid
      || canonicalJsonKeyList(parentNames) !== canonicalJsonKeyList(["dependency-capsule", "project"])
      || canonicalJsonKeyList(names)
        !== canonicalJsonKeyList(["package-lock.json", "package.json", "tsconfig.json"])
    ) {
      return fail(
        "HOST_NODE_TOOLCHAIN_V2_INSTALL_SCOPE_INVALID",
        "npm ci project scope is not one exact private scaffold base",
      );
    }
    const files = names.map((name) => {
      const absolutePath = path.join(projectRoot, name);
      let descriptor: number | undefined;
      try {
        descriptor = openSync(
          absolutePath,
          constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
        );
        const stat = fstatSync(descriptor);
        const bytes = readFileSync(descriptor);
        const after = fstatSync(descriptor);
        const pathAfter = lstatSync(absolutePath);
        if (
          !stat.isFile()
          || stat.isSymbolicLink()
          || realpathSync(absolutePath) !== absolutePath
          || stat.nlink !== 1
          || modeBits(stat) !== 0o444
          || stat.uid !== owner.uid
          || stat.gid !== owner.gid
          || !sameFingerprint(fingerprint(stat), fingerprint(after))
          || !sameFingerprint(fingerprint(after), fingerprint(pathAfter))
          || bytes.byteLength !== after.size
        ) {
          return fail(
            "HOST_NODE_TOOLCHAIN_V2_INSTALL_SCOPE_INVALID",
            `npm ci scaffold input ${name} is not one exact read-only file`,
          );
        }
        return Object.freeze({ name, rawHash: sha256(bytes), rawByteLength: bytes.byteLength });
      } finally {
        if (descriptor !== undefined) closeSync(descriptor);
      }
    });
    assertMissingPathV2(path.join(projectRoot, ".npmrc"), "Install project .npmrc");
    assertMissingPathV2(path.join(projectRoot, "node_modules"), "Install project node_modules");
    assertMissingPathV2(path.join(projectRoot, "src"), "Install project source directory");
    return hashCanonicalJson({
      schema: "setfarm.host-node-npm-ci-project-scope.v2",
      root: fingerprint(root),
      parent: fingerprint(parentStat),
      files,
    });
  } catch (error) {
    if (error instanceof HostNodeToolchainAuthorityErrorV2) throw error;
    return fail(
      "HOST_NODE_TOOLCHAIN_V2_INSTALL_SCOPE_INVALID",
      "npm ci private project scope could not be captured",
      error,
    );
  }
}

async function executeHostNodeToolchainNpmCiForPurposeV2(
  handle: HostNodeToolchainAuthorityV2,
  input: HostNodeToolchainNpmCiInputV2,
  probeRef:
    | "HOST_NPM_SCAFFOLD_INSTALL_V2"
    | "HOST_NPM_PLATFORM_RELEASE_BUILD_INSTALL_V2",
): Promise<
  | HostNodeToolchainNpmCiEvidenceV2
  | HostNodeToolchainPlatformReleaseNpmCiEvidenceV2
> {
  const state = authenticState(handle);
  if (
    !isPlainRecord(input)
    || !exactRecordKeys(input, ["environment", "privateRoot", "projectRoot"])
    || typeof input.projectRoot !== "string"
  ) {
    return fail(
      "HOST_NODE_TOOLCHAIN_V2_INSTALL_SCOPE_INVALID",
      "npm ci input must contain one exact private environment and project scope",
    );
  }
  const hostBefore = await revalidateHostNodeToolchainAuthorityV2(handle);
  const environmentScope = captureEffectiveNpmConfigProbeScopeV2({
    privateRoot: input.privateRoot,
    environment: input.environment,
  });
  const projectScopeHash = captureNpmCiProjectScopeV2(input.projectRoot);
  const environment = Object.freeze({
    ...environmentScope.environment,
    PATH: path.dirname(state.captured.root.nodePath),
  });
  const environmentHash = hashCanonicalJson({
    schema: "setfarm.node-scaffold-private-execution-environment.v2",
    variables: Object.entries(environment).sort(([left], [right]) =>
      left < right ? -1 : left > right ? 1 : 0),
  });
  const directArgv = Object.freeze([
    "npm",
    "ci",
    "--include=dev",
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
  ] as const);
  const invocation: HostNodeToolchainProbeInvocationV2 = Object.freeze({
    probeRef,
    executable: state.captured.root.nodePath,
    argv: Object.freeze([state.captured.root.npmCliPath, ...directArgv.slice(1)]),
    cwd: input.projectRoot,
    env: environment,
    shell: false,
    timeoutMs: NPM_SCAFFOLD_INSTALL_TIMEOUT_MS_V2,
    maxStdoutBytes: NPM_SCAFFOLD_INSTALL_MAX_OUTPUT_BYTES_V2,
    maxStderrBytes: NPM_SCAFFOLD_INSTALL_MAX_OUTPUT_BYTES_V2,
  });
  let result: HostNodeToolchainProbeResultV2;
  try {
    result = await state.probeAdapter(invocation);
  } catch (error) {
    const hostAfterFailure = await revalidateHostNodeToolchainAuthorityV2(handle);
    if (hostAfterFailure.receiptHash !== hostBefore.receiptHash) {
      return fail(
        "HOST_NODE_TOOLCHAIN_V2_HOST_DRIFT",
        "Host Node/npm authority changed while npm ci failed to spawn",
      );
    }
    return fail(
      "HOST_NODE_TOOLCHAIN_V2_INSTALL_SPAWN_FAILED",
      "Exact npm ci adapter failed",
      error,
    );
  }
  const hostAfter = await revalidateHostNodeToolchainAuthorityV2(handle);
  if (hostAfter.receiptHash !== hostBefore.receiptHash) {
    return fail("HOST_NODE_TOOLCHAIN_V2_HOST_DRIFT", "Host Node/npm authority changed during npm ci");
  }
  if (
    Buffer.byteLength(result.stdout, "utf8") > NPM_SCAFFOLD_INSTALL_MAX_OUTPUT_BYTES_V2
    || Buffer.byteLength(result.stderr, "utf8") > NPM_SCAFFOLD_INSTALL_MAX_OUTPUT_BYTES_V2
    || result.status === "output_limit_exceeded"
  ) {
    return fail("HOST_NODE_TOOLCHAIN_V2_INSTALL_OUTPUT_LIMIT", "Exact npm ci exceeded its output bound");
  }
  if (result.status === "timed_out") {
    return fail("HOST_NODE_TOOLCHAIN_V2_INSTALL_TIMEOUT", "Exact npm ci exceeded its timeout");
  }
  if (result.status === "spawn_failed") {
    return fail("HOST_NODE_TOOLCHAIN_V2_INSTALL_SPAWN_FAILED", "Exact npm ci could not be spawned");
  }
  if (result.signal !== null) {
    return fail("HOST_NODE_TOOLCHAIN_V2_INSTALL_SIGNALLED", "Exact npm ci terminated by signal");
  }
  if (result.exitCode !== 0) {
    return fail("HOST_NODE_TOOLCHAIN_V2_INSTALL_NONZERO", "Exact npm ci exited nonzero");
  }
  return deepFreezeJson({
    probeRef,
    hostToolchainReceiptHash: hostBefore.receiptHash,
    environmentHash,
    projectScopeHash,
    directArgv,
    directArgvHash: hashCanonicalJson({
      schema: probeRef === "HOST_NPM_SCAFFOLD_INSTALL_V2"
        ? "setfarm.node-scaffold-install-direct-argv-hash.v2"
        : "setfarm.platform-release-build-toolchain-direct-argv-hash.v2",
      directArgv,
    }),
    timeoutMs: NPM_SCAFFOLD_INSTALL_TIMEOUT_MS_V2,
    maxStdoutBytes: NPM_SCAFFOLD_INSTALL_MAX_OUTPUT_BYTES_V2,
    maxStderrBytes: NPM_SCAFFOLD_INSTALL_MAX_OUTPUT_BYTES_V2,
    exitCode: 0 as const,
    signal: null,
    stdoutHash: sha256(result.stdout),
    stdoutBytes: Buffer.byteLength(result.stdout, "utf8"),
    stderrHash: sha256(result.stderr),
    stderrBytes: Buffer.byteLength(result.stderr, "utf8"),
  });
}

/**
 * Executes the only admitted generated-scaffold dependency install. Paths are
 * consumed inside the authenticated host authority and are represented only by
 * hashes in the returned evidence.
 */
export async function executeHostNodeToolchainNpmCiV2(
  handle: HostNodeToolchainAuthorityV2,
  input: HostNodeToolchainNpmCiInputV2,
): Promise<HostNodeToolchainNpmCiEvidenceV2> {
  const evidence =
    await executeHostNodeToolchainNpmCiForPurposeV2(
      handle,
      input,
      "HOST_NPM_SCAFFOLD_INSTALL_V2",
    );
  if (evidence.probeRef !== "HOST_NPM_SCAFFOLD_INSTALL_V2") {
    return fail(
      "HOST_NODE_TOOLCHAIN_V2_INSTALL_SCOPE_INVALID",
      "Scaffold npm ci returned another purpose's evidence",
    );
  }
  return evidence;
}

/**
 * Executes the admitted Setfarm platform-release build dependency install.
 * The physical host authority is shared, while its invocation and hash domains
 * remain separate from generated-product scaffolding.
 */
export async function executeHostNodeToolchainPlatformReleaseNpmCiV2(
  handle: HostNodeToolchainAuthorityV2,
  input: HostNodeToolchainNpmCiInputV2,
): Promise<HostNodeToolchainPlatformReleaseNpmCiEvidenceV2> {
  const evidence =
    await executeHostNodeToolchainNpmCiForPurposeV2(
      handle,
      input,
      "HOST_NPM_PLATFORM_RELEASE_BUILD_INSTALL_V2",
    );
  if (
    evidence.probeRef
      !== "HOST_NPM_PLATFORM_RELEASE_BUILD_INSTALL_V2"
  ) {
    return fail(
      "HOST_NODE_TOOLCHAIN_V2_INSTALL_SCOPE_INVALID",
      "Platform release npm ci returned another purpose's evidence",
    );
  }
  return evidence;
}

type CandidateProductionNpmScopeCaptureV2 = Readonly<{
  projectScopeHash: string;
  sourceFenceHash: string;
}>;

function assertCandidateProductionMissingPathV2(
  absolutePath: string,
  label: string,
): void {
  try {
    lstatSync(absolutePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    return fail(
      "HOST_NODE_TOOLCHAIN_V2_RUNTIME_INSTALL_SCOPE_INVALID",
      `${label} absence could not be established exactly`,
      error,
    );
  }
  return fail(
    "HOST_NODE_TOOLCHAIN_V2_RUNTIME_INSTALL_SCOPE_INVALID",
    `${label} must be absent`,
  );
}

function captureCandidateProductionNpmScopeV2(input: Readonly<{
  candidateBundleRoot: string;
  profileId: NodeScaffoldProfileIdV2;
  phase: "before" | "after" | "failure";
}>): CandidateProductionNpmScopeCaptureV2 {
  const bundleRoot = input.candidateBundleRoot;
  if (!path.isAbsolute(bundleRoot) || path.basename(bundleRoot) !== "candidate-bundle") {
    return fail(
      "HOST_NODE_TOOLCHAIN_V2_RUNTIME_INSTALL_SCOPE_INVALID",
      "Candidate production install requires one absolute candidate-bundle root",
    );
  }
  const owner = processOwnerV2();
  try {
    const parent = path.dirname(bundleRoot);
    const parentStat = lstatSync(parent);
    const rootStat = lstatSync(bundleRoot);
    const parentNames = readdirSync(parent).sort();
    const rootNames = readdirSync(bundleRoot).sort();
    const baseNames = ["application", "package-lock.json", "package.json"];
    const installedNames = [...baseNames, "node_modules"].sort();
    const namesAdmitted = input.phase === "before"
      ? canonicalJsonKeyList(rootNames) === canonicalJsonKeyList(baseNames.sort())
      : input.phase === "after"
      ? canonicalJsonKeyList(rootNames) === canonicalJsonKeyList(installedNames)
      : canonicalJsonKeyList(rootNames) === canonicalJsonKeyList(baseNames.sort())
        || canonicalJsonKeyList(rootNames) === canonicalJsonKeyList(installedNames);
    if (
      parentStat.isSymbolicLink()
      || !parentStat.isDirectory()
      || realpathSync(parent) !== parent
      || modeBits(parentStat) !== 0o700
      || parentStat.uid !== owner.uid
      || parentStat.gid !== owner.gid
      || canonicalJsonKeyList(parentNames) !== canonicalJsonKeyList(["candidate-bundle"])
      || rootStat.isSymbolicLink()
      || !rootStat.isDirectory()
      || realpathSync(bundleRoot) !== bundleRoot
      || modeBits(rootStat) !== 0o700
      || rootStat.uid !== owner.uid
      || rootStat.gid !== owner.gid
      || !namesAdmitted
    ) {
      return fail(
        "HOST_NODE_TOOLCHAIN_V2_RUNTIME_INSTALL_SCOPE_INVALID",
        "Candidate production install root is not one exact private every-and-only topology",
      );
    }

    const applicationRoot = path.join(bundleRoot, "application");
    const applicationStat = lstatSync(applicationRoot);
    const expectedApplicationNames = input.profileId
      === "PROFILE_NODE_CLI_STATELESS_EXACT_V2"
      ? ["cli.js", "cli.setfarm.test.js"]
      : ["app.js", "app.setfarm.test.js"];
    const applicationNames = readdirSync(applicationRoot).sort();
    if (
      applicationStat.isSymbolicLink()
      || !applicationStat.isDirectory()
      || realpathSync(applicationRoot) !== applicationRoot
      || modeBits(applicationStat) !== 0o555
      || applicationStat.uid !== owner.uid
      || applicationStat.gid !== owner.gid
      || canonicalJsonKeyList(applicationNames)
        !== canonicalJsonKeyList(expectedApplicationNames.sort())
    ) {
      return fail(
        "HOST_NODE_TOOLCHAIN_V2_RUNTIME_INSTALL_SCOPE_INVALID",
        "Candidate application input is not the exact sealed profile output",
      );
    }
    const application = applicationNames.map((name) => {
      const file = readExactFile({
        absolutePath: path.join(applicationRoot, name),
        relativePath: `application/${name}`,
        allowedModes: [0o444],
        maxBytes: 32 * 1024 * 1024,
        errorCode: "HOST_NODE_TOOLCHAIN_V2_RUNTIME_INSTALL_SCOPE_INVALID",
      });
      if (
        file.fingerprint.ownerUid !== owner.uid
        || file.fingerprint.ownerGid !== owner.gid
        || file.fingerprint.byteLength < 1
      ) {
        return fail(
          "HOST_NODE_TOOLCHAIN_V2_RUNTIME_INSTALL_SCOPE_INVALID",
          `Candidate application input ${name} is not one exact process-owned file`,
        );
      }
      return Object.freeze({
        normalizedLocator: `application/${name}`,
        contentHash: file.contentHash,
        byteLength: file.fingerprint.byteLength,
        fingerprint: file.fingerprint,
      });
    });

    const packageJson = readExactFile({
      absolutePath: path.join(bundleRoot, "package.json"),
      relativePath: "package.json",
      allowedModes: [0o444],
      maxBytes: 4 * 1024 * 1024,
      errorCode: "HOST_NODE_TOOLCHAIN_V2_RUNTIME_INSTALL_SCOPE_INVALID",
    });
    const packageLock = readExactFile({
      absolutePath: path.join(bundleRoot, "package-lock.json"),
      relativePath: "package-lock.json",
      allowedModes: [0o444],
      maxBytes: 16 * 1024 * 1024,
      errorCode: "HOST_NODE_TOOLCHAIN_V2_RUNTIME_INSTALL_SCOPE_INVALID",
    });
    for (const file of [packageJson, packageLock]) {
      if (
        file.fingerprint.ownerUid !== owner.uid
        || file.fingerprint.ownerGid !== owner.gid
        || file.fingerprint.byteLength < 1
      ) {
        return fail(
          "HOST_NODE_TOOLCHAIN_V2_RUNTIME_INSTALL_SCOPE_INVALID",
          `${file.relativePath} is not one exact process-owned runtime input`,
        );
      }
    }

    let nodeModules: FingerprintV2 | null = null;
    if (rootNames.includes("node_modules")) {
      const nodeModulesRoot = path.join(bundleRoot, "node_modules");
      const stat = lstatSync(nodeModulesRoot);
      if (
        stat.isSymbolicLink()
        || !stat.isDirectory()
        || realpathSync(nodeModulesRoot) !== nodeModulesRoot
        || ![0o700, 0o755].includes(modeBits(stat))
        || stat.uid !== owner.uid
        || stat.gid !== owner.gid
      ) {
        return fail(
          "HOST_NODE_TOOLCHAIN_V2_RUNTIME_INSTALL_SCOPE_INVALID",
          "Candidate node_modules output is not one direct process-owned directory",
        );
      }
      nodeModules = fingerprint(stat);
    }
    assertCandidateProductionMissingPathV2(
      path.join(bundleRoot, ".npmrc"),
      "Candidate bundle .npmrc",
    );
    const sourceFenceHash = hashCanonicalJson({
      schema: "setfarm.host-node-candidate-production-source-fence.v2",
      application,
      packageJson: {
        contentHash: packageJson.contentHash,
        fingerprint: packageJson.fingerprint,
      },
      packageLock: {
        contentHash: packageLock.contentHash,
        fingerprint: packageLock.fingerprint,
      },
    });
    return Object.freeze({
      sourceFenceHash,
      projectScopeHash: hashCanonicalJson({
        schema: "setfarm.host-node-candidate-production-project-scope.v2",
        phase: input.phase,
        parent: fingerprint(parentStat),
        root: fingerprint(rootStat),
        rootNames,
        sourceFenceHash,
        nodeModules,
      }),
    });
  } catch (error) {
    if (error instanceof HostNodeToolchainAuthorityErrorV2) throw error;
    return fail(
      "HOST_NODE_TOOLCHAIN_V2_RUNTIME_INSTALL_SCOPE_INVALID",
      "Candidate production install scope could not be captured",
      error,
    );
  }
}

/**
 * Executes the only admitted candidate production-dependency operation. The
 * caller contributes no argv, cwd override, environment overlay, timeout or
 * output limit, and package/application inputs are fenced across the process.
 */
export async function executeHostNodeToolchainCandidateProductionNpmCiV2(
  handle: HostNodeToolchainAuthorityV2,
  input: HostNodeToolchainCandidateProductionNpmCiInputV2,
): Promise<HostNodeToolchainCandidateProductionNpmCiEvidenceV2> {
  const state = authenticState(handle);
  if (
    !isPlainRecord(input)
    || !exactRecordKeys(input, [
      "candidateBundleRoot",
      "environment",
      "privateRoot",
    ])
    || typeof input.candidateBundleRoot !== "string"
    || typeof input.privateRoot !== "string"
  ) {
    return fail(
      "HOST_NODE_TOOLCHAIN_V2_RUNTIME_INSTALL_SCOPE_INVALID",
      "Candidate production npm input must contain one exact environment and bundle scope",
    );
  }
  const hostBefore = await revalidateHostNodeToolchainAuthorityV2(handle);
  const environmentScope = captureEffectiveNpmConfigProbeScopeV2({
    privateRoot: input.privateRoot,
    environment: input.environment,
  });
  const scopeBefore = captureCandidateProductionNpmScopeV2({
    candidateBundleRoot: input.candidateBundleRoot,
    profileId: state.profileId,
    phase: "before",
  });
  const environment = Object.freeze({
    ...environmentScope.environment,
    PATH: path.dirname(state.captured.root.nodePath),
  });
  const environmentHash = hashCanonicalJson({
    schema: "setfarm.node-scaffold-private-execution-environment.v2",
    variables: Object.entries(environment).sort(([left], [right]) =>
      left < right ? -1 : left > right ? 1 : 0),
  });
  const directArgv = Object.freeze([
    "npm",
    "ci",
    "--omit=dev",
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
  ] as const);
  const invocation: HostNodeToolchainProbeInvocationV2 = Object.freeze({
    probeRef: "HOST_NPM_CANDIDATE_PRODUCTION_INSTALL_V2",
    executable: state.captured.root.nodePath,
    argv: Object.freeze([state.captured.root.npmCliPath, ...directArgv.slice(1)]),
    cwd: input.candidateBundleRoot,
    env: environment,
    shell: false,
    timeoutMs: NPM_SCAFFOLD_INSTALL_TIMEOUT_MS_V2,
    maxStdoutBytes: NPM_SCAFFOLD_INSTALL_MAX_OUTPUT_BYTES_V2,
    maxStderrBytes: NPM_SCAFFOLD_INSTALL_MAX_OUTPUT_BYTES_V2,
  });
  let result: HostNodeToolchainProbeResultV2;
  try {
    result = await state.probeAdapter(invocation);
  } catch (error) {
    const hostAfterFailure = await revalidateHostNodeToolchainAuthorityV2(handle);
    const scopeAfterFailure = captureCandidateProductionNpmScopeV2({
      candidateBundleRoot: input.candidateBundleRoot,
      profileId: state.profileId,
      phase: "failure",
    });
    if (hostAfterFailure.receiptHash !== hostBefore.receiptHash) {
      return fail(
        "HOST_NODE_TOOLCHAIN_V2_HOST_DRIFT",
        "Host Node/npm authority changed while candidate npm failed to spawn",
      );
    }
    if (scopeAfterFailure.sourceFenceHash !== scopeBefore.sourceFenceHash) {
      return fail(
        "HOST_NODE_TOOLCHAIN_V2_RUNTIME_INSTALL_SOURCE_DRIFT",
        "Candidate package, lockfile or application changed while npm failed to spawn",
      );
    }
    return fail(
      "HOST_NODE_TOOLCHAIN_V2_RUNTIME_INSTALL_SPAWN_FAILED",
      "Exact candidate production npm adapter failed",
      error,
    );
  }
  const succeeded = result.status === "exited"
    && result.exitCode === 0
    && result.signal === null
    && Buffer.byteLength(result.stdout, "utf8")
      <= NPM_SCAFFOLD_INSTALL_MAX_OUTPUT_BYTES_V2
    && Buffer.byteLength(result.stderr, "utf8")
      <= NPM_SCAFFOLD_INSTALL_MAX_OUTPUT_BYTES_V2;
  const [hostAfter, scopeAfter] = await Promise.all([
    revalidateHostNodeToolchainAuthorityV2(handle),
    Promise.resolve(captureCandidateProductionNpmScopeV2({
      candidateBundleRoot: input.candidateBundleRoot,
      profileId: state.profileId,
      phase: succeeded ? "after" : "failure",
    })),
  ]);
  if (hostAfter.receiptHash !== hostBefore.receiptHash) {
    return fail(
      "HOST_NODE_TOOLCHAIN_V2_HOST_DRIFT",
      "Host Node/npm authority changed during candidate production npm",
    );
  }
  if (scopeAfter.sourceFenceHash !== scopeBefore.sourceFenceHash) {
    return fail(
      "HOST_NODE_TOOLCHAIN_V2_RUNTIME_INSTALL_SOURCE_DRIFT",
      "Candidate package, lockfile or application changed across production npm",
    );
  }
  if (
    Buffer.byteLength(result.stdout, "utf8") > NPM_SCAFFOLD_INSTALL_MAX_OUTPUT_BYTES_V2
    || Buffer.byteLength(result.stderr, "utf8") > NPM_SCAFFOLD_INSTALL_MAX_OUTPUT_BYTES_V2
    || result.status === "output_limit_exceeded"
  ) {
    return fail(
      "HOST_NODE_TOOLCHAIN_V2_RUNTIME_INSTALL_OUTPUT_LIMIT",
      "Exact candidate production npm exceeded its output bound",
    );
  }
  if (result.status === "timed_out") {
    return fail(
      "HOST_NODE_TOOLCHAIN_V2_RUNTIME_INSTALL_TIMEOUT",
      "Exact candidate production npm exceeded its timeout",
    );
  }
  if (result.status === "spawn_failed") {
    return fail(
      "HOST_NODE_TOOLCHAIN_V2_RUNTIME_INSTALL_SPAWN_FAILED",
      "Exact candidate production npm could not be spawned",
    );
  }
  if (result.signal !== null) {
    return fail(
      "HOST_NODE_TOOLCHAIN_V2_RUNTIME_INSTALL_SIGNALLED",
      "Exact candidate production npm terminated by signal",
    );
  }
  if (result.exitCode !== 0) {
    return fail(
      "HOST_NODE_TOOLCHAIN_V2_RUNTIME_INSTALL_NONZERO",
      "Exact candidate production npm exited nonzero",
    );
  }
  return deepFreezeJson({
    probeRef: "HOST_NPM_CANDIDATE_PRODUCTION_INSTALL_V2" as const,
    hostToolchainReceiptHash: hostBefore.receiptHash,
    nodeIdentityHash: hostBefore.node.identityHash,
    npmClosureHash: hostBefore.npm.closureHash,
    environmentHash,
    projectScopeHash: scopeBefore.projectScopeHash,
    sourceFenceHash: scopeBefore.sourceFenceHash,
    directArgv,
    directArgvHash: hashCanonicalJson({
      schema: "setfarm.candidate-runtime-npm-direct-argv-hash.v2",
      directArgv,
    }),
    stdin: "closed" as const,
    timeoutMs: NPM_SCAFFOLD_INSTALL_TIMEOUT_MS_V2,
    maxStdoutBytes: NPM_SCAFFOLD_INSTALL_MAX_OUTPUT_BYTES_V2,
    maxStderrBytes: NPM_SCAFFOLD_INSTALL_MAX_OUTPUT_BYTES_V2,
    shell: "forbidden" as const,
    ambientEnvironment: "forbidden" as const,
    status: "exited_zero" as const,
    exitCode: 0 as const,
    signal: null,
    stdoutHash: sha256(result.stdout),
    stdoutBytes: Buffer.byteLength(result.stdout, "utf8"),
    stderrHash: sha256(result.stderr),
    stderrBytes: Buffer.byteLength(result.stderr, "utf8"),
  });
}

function parseBuildCompilerTargetV2(
  value: unknown,
): HostNodeToolchainBuildCompilerTargetV2 {
  const keys = [
    "commandName",
    "exactVersion",
    "executableRef",
    "executionDisposition",
    "linkLocator",
    "linkTargetHash",
    "packagePath",
    "targetContentHash",
    "targetLocator",
  ];
  if (
    !isPlainRecord(value)
    || !exactRecordKeys(value, keys)
    || value.executableRef !== "TOOL_NODE_TYPESCRIPT_TSC_V2"
    || value.exactVersion !== "5.9.3"
    || value.commandName !== "tsc"
    || value.packagePath !== "node_modules/typescript"
    || value.linkLocator !== "node_modules/.bin/tsc"
    || value.targetLocator !== "node_modules/typescript/bin/tsc"
    || value.executionDisposition
      !== "direct_target_via_authenticated_node_runtime"
    || typeof value.linkTargetHash !== "string"
    || !/^[a-f0-9]{64}$/u.test(value.linkTargetHash)
    || typeof value.targetContentHash !== "string"
    || !/^[a-f0-9]{64}$/u.test(value.targetContentHash)
  ) {
    return fail(
      "HOST_NODE_TOOLCHAIN_V2_BUILD_SCOPE_INVALID",
      "Candidate build compiler target must be the exact code-owned TypeScript target",
    );
  }
  return Object.freeze({
    executableRef: value.executableRef,
    exactVersion: value.exactVersion,
    commandName: value.commandName,
    packagePath: value.packagePath,
    linkLocator: value.linkLocator,
    targetLocator: value.targetLocator,
    linkTargetHash: value.linkTargetHash,
    targetContentHash: value.targetContentHash,
    executionDisposition: value.executionDisposition,
  });
}

function captureCandidateBuildProjectScopeV2(projectRoot: string): string {
  if (!path.isAbsolute(projectRoot) || path.basename(projectRoot) !== "project") {
    return fail(
      "HOST_NODE_TOOLCHAIN_V2_BUILD_SCOPE_INVALID",
      "Candidate build requires one absolute private project root",
    );
  }
  const owner = processOwnerV2();
  try {
    const root = lstatSync(projectRoot);
    const names = readdirSync(projectRoot).sort();
    if (
      root.isSymbolicLink()
      || !root.isDirectory()
      || realpathSync(projectRoot) !== projectRoot
      || modeBits(root) !== 0o700
      || root.uid !== owner.uid
      || root.gid !== owner.gid
      || canonicalJsonKeyList(names) !== canonicalJsonKeyList([
        "node_modules",
        "package-lock.json",
        "package.json",
        "src",
        "tsconfig.json",
      ])
    ) {
      return fail(
        "HOST_NODE_TOOLCHAIN_V2_BUILD_SCOPE_INVALID",
        "Candidate build project is not the exact source-ready private topology",
      );
    }
    assertMissingPathV2(path.join(projectRoot, ".npmrc"), "Build project .npmrc");
    assertMissingPathV2(path.join(projectRoot, "dist"), "Build project dist");
    return hashCanonicalJson({
      schema: "setfarm.host-node-candidate-build-project-scope.v2",
      root: fingerprint(root),
      names,
    });
  } catch (error) {
    if (error instanceof HostNodeToolchainAuthorityErrorV2) throw error;
    return fail(
      "HOST_NODE_TOOLCHAIN_V2_BUILD_SCOPE_INVALID",
      "Candidate build project scope could not be captured",
      error,
    );
  }
}

function captureCandidateBuildCompilerTargetV2(input: Readonly<{
  projectRoot: string;
  compilerTarget: HostNodeToolchainBuildCompilerTargetV2;
}>): string {
  const owner = processOwnerV2();
  const linkPath = path.join(input.projectRoot, input.compilerTarget.linkLocator);
  const targetPath = path.join(input.projectRoot, input.compilerTarget.targetLocator);
  try {
    const link = lstatSync(linkPath);
    const linkTarget = readlinkSync(linkPath);
    const target = readExactFile({
      absolutePath: targetPath,
      relativePath: input.compilerTarget.targetLocator,
      allowedModes: [0o500, 0o555, 0o700, 0o755],
      maxBytes: 16 * 1024 * 1024,
      errorCode: "HOST_NODE_TOOLCHAIN_V2_BUILD_COMPILER_DRIFT",
    });
    if (
      !link.isSymbolicLink()
      || link.uid !== owner.uid
      || link.gid !== owner.gid
      || realpathSync(linkPath) !== targetPath
      || sha256(linkTarget) !== input.compilerTarget.linkTargetHash
      || target.contentHash !== input.compilerTarget.targetContentHash
      || target.fingerprint.ownerUid !== owner.uid
      || target.fingerprint.ownerGid !== owner.gid
      || target.fingerprint.linkCount !== 1
    ) {
      return fail(
        "HOST_NODE_TOOLCHAIN_V2_BUILD_COMPILER_DRIFT",
        "Candidate TypeScript link and target no longer reproduce dependency authority",
      );
    }
    return hashCanonicalJson({
      schema: "setfarm.host-node-candidate-build-compiler-target.v2",
      compilerTarget: input.compilerTarget,
      link: fingerprint(link),
      target: target.fingerprint,
    });
  } catch (error) {
    if (error instanceof HostNodeToolchainAuthorityErrorV2) throw error;
    return fail(
      "HOST_NODE_TOOLCHAIN_V2_BUILD_COMPILER_DRIFT",
      "Candidate TypeScript compiler target could not be captured",
      error,
    );
  }
}

/**
 * Executes only the BuildTopologyV3.2 direct Node/TypeScript operation. The
 * caller contributes no argv, cwd, environment overlay, timeout or limit.
 */
export async function executeHostNodeToolchainBuildV2(
  handle: HostNodeToolchainAuthorityV2,
  input: HostNodeToolchainBuildInputV2,
): Promise<HostNodeToolchainBuildEvidenceV2> {
  const state = authenticState(handle);
  if (
    !isPlainRecord(input)
    || !exactRecordKeys(input, [
      "compilerTarget",
      "environment",
      "privateRoot",
      "projectRoot",
    ])
    || typeof input.privateRoot !== "string"
    || typeof input.projectRoot !== "string"
  ) {
    return fail(
      "HOST_NODE_TOOLCHAIN_V2_BUILD_SCOPE_INVALID",
      "Candidate build input must contain one exact environment, project and compiler target",
    );
  }
  const compilerTarget = parseBuildCompilerTargetV2(input.compilerTarget);
  const hostBefore = await revalidateHostNodeToolchainAuthorityV2(handle);
  const environmentScope = captureEffectiveNpmConfigProbeScopeV2({
    privateRoot: input.privateRoot,
    environment: input.environment,
  });
  const projectScopeHash = captureCandidateBuildProjectScopeV2(input.projectRoot);
  const compilerTargetIdentityHash = captureCandidateBuildCompilerTargetV2({
    projectRoot: input.projectRoot,
    compilerTarget,
  });
  const environment = Object.freeze({
    ...environmentScope.environment,
    PATH: path.dirname(state.captured.root.nodePath),
  });
  const environmentHash = hashCanonicalJson({
    schema: "setfarm.node-scaffold-private-execution-environment.v2",
    variables: Object.entries(environment).sort(([left], [right]) =>
      left < right ? -1 : left > right ? 1 : 0),
  });
  const directArgv = Object.freeze([
    "node",
    "node_modules/typescript/bin/tsc",
    "-p",
    "tsconfig.json",
  ] as const);
  const invocation: HostNodeToolchainProbeInvocationV2 = Object.freeze({
    probeRef: "HOST_NODE_PRODUCT_BUILD_V2",
    executable: state.captured.root.nodePath,
    argv: Object.freeze([
      path.join(input.projectRoot, compilerTarget.targetLocator),
      "-p",
      "tsconfig.json",
    ]),
    cwd: input.projectRoot,
    env: environment,
    shell: false,
    timeoutMs: CANDIDATE_BUILD_TIMEOUT_MS_V2,
    maxStdoutBytes: CANDIDATE_BUILD_MAX_OUTPUT_BYTES_V2,
    maxStderrBytes: CANDIDATE_BUILD_MAX_OUTPUT_BYTES_V2,
  });
  let result: HostNodeToolchainProbeResultV2;
  try {
    result = await state.probeAdapter(invocation);
  } catch (error) {
    const hostAfterFailure = await revalidateHostNodeToolchainAuthorityV2(handle);
    const compilerAfterFailure = captureCandidateBuildCompilerTargetV2({
      projectRoot: input.projectRoot,
      compilerTarget,
    });
    if (
      hostAfterFailure.receiptHash !== hostBefore.receiptHash
      || compilerAfterFailure !== compilerTargetIdentityHash
    ) {
      return fail(
        "HOST_NODE_TOOLCHAIN_V2_HOST_DRIFT",
        "Host Node or compiler authority changed while candidate build failed to spawn",
      );
    }
    return fail(
      "HOST_NODE_TOOLCHAIN_V2_BUILD_SPAWN_FAILED",
      "Exact candidate build adapter failed",
      error,
    );
  }
  const hostAfter = await revalidateHostNodeToolchainAuthorityV2(handle);
  const compilerAfter = captureCandidateBuildCompilerTargetV2({
    projectRoot: input.projectRoot,
    compilerTarget,
  });
  if (hostAfter.receiptHash !== hostBefore.receiptHash) {
    return fail(
      "HOST_NODE_TOOLCHAIN_V2_HOST_DRIFT",
      "Host Node authority changed during candidate build",
    );
  }
  if (compilerAfter !== compilerTargetIdentityHash) {
    return fail(
      "HOST_NODE_TOOLCHAIN_V2_BUILD_COMPILER_DRIFT",
      "TypeScript compiler target changed during candidate build",
    );
  }
  if (
    Buffer.byteLength(result.stdout, "utf8") > CANDIDATE_BUILD_MAX_OUTPUT_BYTES_V2
    || Buffer.byteLength(result.stderr, "utf8") > CANDIDATE_BUILD_MAX_OUTPUT_BYTES_V2
    || result.status === "output_limit_exceeded"
  ) {
    return fail(
      "HOST_NODE_TOOLCHAIN_V2_BUILD_OUTPUT_LIMIT",
      "Exact candidate build exceeded its output bound",
    );
  }
  if (result.status === "timed_out") {
    return fail(
      "HOST_NODE_TOOLCHAIN_V2_BUILD_TIMEOUT",
      "Exact candidate build exceeded its timeout",
    );
  }
  if (result.status === "spawn_failed") {
    return fail(
      "HOST_NODE_TOOLCHAIN_V2_BUILD_SPAWN_FAILED",
      "Exact candidate build could not be spawned",
    );
  }
  if (result.signal !== null) {
    return fail(
      "HOST_NODE_TOOLCHAIN_V2_BUILD_SIGNALLED",
      "Exact candidate build terminated by signal",
    );
  }
  if (result.exitCode !== 0) {
    return fail(
      "HOST_NODE_TOOLCHAIN_V2_BUILD_NONZERO",
      "Exact candidate build exited nonzero",
    );
  }
  return deepFreezeJson({
    probeRef: "HOST_NODE_PRODUCT_BUILD_V2" as const,
    hostToolchainReceiptHash: hostBefore.receiptHash,
    nodeIdentityHash: hostBefore.node.identityHash,
    environmentHash,
    projectScopeHash,
    compilerTargetIdentityHash,
    directArgv,
    directArgvHash: hashCanonicalJson({
      schema: "setfarm.candidate-build-direct-argv-hash.v2",
      directArgv,
    }),
    stdin: "closed" as const,
    timeoutMs: CANDIDATE_BUILD_TIMEOUT_MS_V2,
    maxStdoutBytes: CANDIDATE_BUILD_MAX_OUTPUT_BYTES_V2,
    maxStderrBytes: CANDIDATE_BUILD_MAX_OUTPUT_BYTES_V2,
    shell: "forbidden" as const,
    ambientEnvironment: "forbidden" as const,
    status: "exited_zero" as const,
    exitCode: 0 as const,
    signal: null,
    stdoutHash: sha256(result.stdout),
    stdoutBytes: Buffer.byteLength(result.stdout, "utf8"),
    stderrHash: sha256(result.stderr),
    stderrBytes: Buffer.byteLength(result.stderr, "utf8"),
  });
}

/**
 * Production consumers use this entrypoint, never the test-capable generic
 * revalidator. It preserves the test_fixture/production_host separation before
 * the future materializer enters the private spawn boundary.
 */
export async function requireProductionHostNodeToolchainPreSpawnV2(
  handle: HostNodeToolchainAuthorityV2,
): Promise<HostNodeToolchainReceiptV2> {
  const state = authenticState(handle);
  if (state.admissionScope !== "production_host") {
    return fail(
      "HOST_NODE_TOOLCHAIN_V2_PRODUCTION_AUTHORITY_REQUIRED",
      "Operational Node/npm execution requires a production_host authority",
    );
  }
  return revalidateHostNodeToolchainAuthorityV2(handle);
}
