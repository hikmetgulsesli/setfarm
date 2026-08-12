import { createHash, randomBytes } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import {
  chmodSync,
  closeSync,
  constants as fsConstants,
  fstatSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  opendirSync,
  readSync,
  realpathSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { isProxy } from "node:util/types";

import {
  canonicalJsonStringify,
  hashCanonicalJson,
} from "./canonical-json.js";
import {
  PLATFORM_RELEASE_REQUIRED_MODULE_CLOSURE_V2_SCHEMA,
  getPlatformReleaseRequiredModuleRequirementV2,
  type PlatformReleaseRequiredModuleDefinitionV2,
  type PlatformReleaseRequiredModuleRequirementV2,
} from "../execution/schemas/platform-release-required-module-closure-v2.js";
import {
  hashPlatformReleaseModuleRefV2,
  type PlatformReleaseModuleRefV2,
} from "../execution/schemas/platform-release-module-catalogs-v2.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_REQUIRED_MODULE_CLOSURE_PROBE_ENVIRONMENT_POLICY_V2,
  PLATFORM_RELEASE_BOOTSTRAP_REQUIRED_MODULE_CLOSURE_PROBE_IMPLEMENTATION_SCOPE_V2,
  PLATFORM_RELEASE_BOOTSTRAP_REQUIRED_MODULE_CLOSURE_PROBE_MAX_MODULE_BYTES_V2,
  PLATFORM_RELEASE_BOOTSTRAP_REQUIRED_MODULE_CLOSURE_PROBE_MAX_OUTPUT_BYTES_V2,
  PLATFORM_RELEASE_BOOTSTRAP_REQUIRED_MODULE_CLOSURE_PROBE_PAYLOAD_BINDING_V2,
  PLATFORM_RELEASE_BOOTSTRAP_REQUIRED_MODULE_CLOSURE_PROBE_TIMEOUT_MS_V2,
  PLATFORM_RELEASE_BOOTSTRAP_REQUIRED_MODULE_CLOSURE_PROBE_V2_SCHEMA,
  hashPlatformReleaseRequiredModuleClosureProbeEntryV2,
  hashPlatformReleaseRequiredModuleClosureProbeExportKindSetV2,
  hashPlatformReleaseRequiredModuleClosureProbeExportSetV2,
  hashPlatformReleaseRequiredModuleClosureProbeModuleObservationV2,
  hashPlatformReleaseRequiredModuleClosureProbeObservationV2,
  hashPlatformReleaseRequiredModuleClosureProbeOccurrenceV2,
  hashPlatformReleaseRequiredModuleClosureProbeProcessOccurrenceV2,
  hashPlatformReleaseRequiredModuleClosureProbeProjectionV2,
  hashPlatformReleaseRequiredModuleClosureProbeRoleCatalogV2,
  hashPlatformReleaseRequiredModuleClosureProbeV2,
  parsePlatformReleaseRequiredModuleClosureProbeCandidateV2,
  type PlatformReleaseRequiredModuleClosureProbeExportV2,
  type PlatformReleaseRequiredModuleClosureProbeMutableFingerprintV2,
  type PlatformReleaseRequiredModuleClosureProbeModuleRefV2,
  type PlatformReleaseRequiredModuleClosureProbeProcessEvidenceV2,
  type PlatformReleaseRequiredModuleClosureProbeStableIdentityV2,
  type PlatformReleaseRequiredModuleClosureProbeV2,
} from "../execution/schemas/platform-release-bootstrap-required-module-closure-probe-v2.js";

const ROOT_PREFIX_V2 = "setfarm-required-module-closure-probe-v2-";
const OCCURRENCE_NAMES_V2 = ["first", "second"] as const;
const PROBE_PROGRAM_SOURCE_V2 = String.raw`
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const input = JSON.parse(readFileSync(3, "utf8"));
if (input === null || typeof input !== "object" || Array.isArray(input)
    || Object.keys(input).sort().join(",") !== "modulePath"
    || typeof input.modulePath !== "string" || input.modulePath.length < 1) {
  throw new Error("REQUIRED_MODULE_CLOSURE_PROBE_INPUT_INVALID");
}
const namespace = await import(pathToFileURL(input.modulePath).href);
const names = Object.keys(namespace).sort();
const exports = names.map((name) => ({ name, kind: typeof namespace[name] }));
process.stdout.write(JSON.stringify({ exports }) + "\n");
`;
const PROBE_ARGV_V2 = Object.freeze([
  "--input-type=module",
  "-e",
  PROBE_PROGRAM_SOURCE_V2,
] as const);
const PROCESS_SETTLEMENT_TIMEOUT_MILLISECONDS_V2 = 1_000;
const TEST_PROCESS_TIMEOUT_MILLISECONDS_V2 = 25;
const TEST_PROCESS_SETTLEMENT_TIMEOUT_MILLISECONDS_V2 = 100;
const TEST_PROCESS_MARKER_V2 =
  "SETFARM_REQUIRED_MODULE_CLOSURE_PROBE_RUNNER_FAULT_V2";

export type PlatformReleaseBootstrapRequiredModuleClosureProbeFixtureV2 = Readonly<{
  dispose(): void;
}>;

export type PlatformReleaseBootstrapRequiredModuleClosureProbeFixtureMutationV2 =
  | "replace_first_same_bytes"
  | "replace_first_different_bytes"
  | "append_extra_export"
  | "add_root_entry_over_limit";

export type PlatformReleaseBootstrapRequiredModuleClosureProbeErrorCodeV2 =
  | "REQUIRED_MODULE_CLOSURE_PROBE_PLATFORM_UNAVAILABLE"
  | "REQUIRED_MODULE_CLOSURE_PROBE_FIXTURE_BUILD_FAILED"
  | "REQUIRED_MODULE_CLOSURE_PROBE_FIXTURE_HANDLE_UNAUTHENTICATED"
  | "REQUIRED_MODULE_CLOSURE_PROBE_FILESYSTEM_DRIFT"
  | "REQUIRED_MODULE_CLOSURE_PROBE_EXECUTABLE_DRIFT"
  | "REQUIRED_MODULE_CLOSURE_PROBE_SPAWN_FAILED"
  | "REQUIRED_MODULE_CLOSURE_PROBE_TIMEOUT"
  | "REQUIRED_MODULE_CLOSURE_PROBE_OUTPUT_LIMIT"
  | "REQUIRED_MODULE_CLOSURE_PROBE_PROCESS_FAILED"
  | "REQUIRED_MODULE_CLOSURE_PROBE_OUTPUT_INVALID"
  | "REQUIRED_MODULE_CLOSURE_PROBE_RECEIPT_INVALID";

export class PlatformReleaseBootstrapRequiredModuleClosureProbeErrorV2 extends Error {
  constructor(
    readonly code: PlatformReleaseBootstrapRequiredModuleClosureProbeErrorCodeV2,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message.slice(0, 1_500), options);
    this.name = "PlatformReleaseBootstrapRequiredModuleClosureProbeErrorV2";
  }
}

type DirectoryCaptureFaultForTestV2 =
  | "directory_read_failure"
  | "directory_close_failure"
  | "directory_read_and_close_failure";

type FileCaptureFaultForTestV2 =
  | "file_read_and_close_failure"
  | "file_close_failure";

type ProbeRunnerFaultForTestV2 =
  | "stdout_stream_error"
  | "stderr_stream_error"
  | "direct_kill_failure"
  | "close_suppressed";

type RequiredModuleClosureProbeFaultForTestV2 =
  | DirectoryCaptureFaultForTestV2
  | FileCaptureFaultForTestV2
  | ProbeRunnerFaultForTestV2;

const REQUIRED_MODULE_CLOSURE_PROBE_FAULTS_FOR_TEST_V2 = Object.freeze([
  "directory_read_failure",
  "directory_close_failure",
  "directory_read_and_close_failure",
  "file_read_and_close_failure",
  "file_close_failure",
  "stdout_stream_error",
  "stderr_stream_error",
  "direct_kill_failure",
  "close_suppressed",
] as const satisfies readonly RequiredModuleClosureProbeFaultForTestV2[]);

type BigIntStatV2 = ReturnType<typeof lstatSync> & {
  dev: bigint;
  ino: bigint;
  uid: bigint;
  gid: bigint;
  mode: bigint;
  nlink: bigint;
  size: bigint;
  mtimeNs: bigint;
  ctimeNs: bigint;
};

type FileObservationV2 = Readonly<{
  stableIdentity: PlatformReleaseRequiredModuleClosureProbeStableIdentityV2;
  mutableFingerprint: PlatformReleaseRequiredModuleClosureProbeMutableFingerprintV2;
  moduleObservationHash: string;
}>;

type NodeExecutableV2 = Readonly<{
  contentHash: string;
  stableIdentity: PlatformReleaseRequiredModuleClosureProbeStableIdentityV2;
  mutableFingerprint: PlatformReleaseRequiredModuleClosureProbeMutableFingerprintV2;
}>;

type DirectoryIdentityV2 = Readonly<{
  path: string;
  device: string;
  inode: string;
}>;

type FixtureStateV2 = Readonly<{
  alias: string;
  root: string;
  requirement: PlatformReleaseRequiredModuleRequirementV2;
  hostIdentityHash: string;
  catalogHash: string;
  modulePaths: readonly [
    readonly string[],
    readonly string[],
  ];
  moduleBytes: readonly Buffer[];
  moduleRefs: readonly PlatformReleaseModuleRefV2[];
  moduleStableIdentities: readonly [
    readonly PlatformReleaseRequiredModuleClosureProbeStableIdentityV2[],
    readonly PlatformReleaseRequiredModuleClosureProbeStableIdentityV2[],
  ];
  moduleMutableFingerprints: readonly [
    readonly PlatformReleaseRequiredModuleClosureProbeMutableFingerprintV2[],
    readonly PlatformReleaseRequiredModuleClosureProbeMutableFingerprintV2[],
  ];
  directoryIdentities: readonly [
    readonly DirectoryIdentityV2[],
    readonly DirectoryIdentityV2[],
  ];
  ownerUid: number;
  ownerGid: number;
  rootIdentity: Readonly<{ device: string; inode: string }>;
}>;

const fixtureStatesV2 = new WeakMap<object, FixtureStateV2>();

function failV2(
  code: PlatformReleaseBootstrapRequiredModuleClosureProbeErrorCodeV2,
  message: string,
  cause?: unknown,
): never {
  throw new PlatformReleaseBootstrapRequiredModuleClosureProbeErrorV2(
    code,
    message,
    cause === undefined ? undefined : { cause },
  );
}

function sha256BytesV2(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function modeTextV2(stat: BigIntStatV2): string {
  return (Number(stat.mode & 0o7777n)).toString(8).padStart(4, "0");
}

function statIdentityV2(stat: BigIntStatV2): Readonly<{ device: string; inode: string }> {
  return Object.freeze({ device: stat.dev.toString(10), inode: stat.ino.toString(10) });
}

function sameIdentityV2(
  left: Readonly<{ device: string; inode: string }>,
  right: Readonly<{ device: string; inode: string }>,
): boolean {
  return left.device === right.device && left.inode === right.inode;
}

function sameDirectoryFingerprintV2(
  left: BigIntStatV2,
  right: BigIntStatV2,
): boolean {
  return left.dev === right.dev
    && left.ino === right.ino
    && left.uid === right.uid
    && left.gid === right.gid
    && left.mode === right.mode
    && left.nlink === right.nlink
    && left.size === right.size
    && left.mtimeNs === right.mtimeNs
    && left.ctimeNs === right.ctimeNs;
}

function captureErrorV2(
  error: unknown,
  code: PlatformReleaseBootstrapRequiredModuleClosureProbeErrorCodeV2,
  message: string,
): PlatformReleaseBootstrapRequiredModuleClosureProbeErrorV2 {
  return error
      instanceof PlatformReleaseBootstrapRequiredModuleClosureProbeErrorV2
    ? error
    : new PlatformReleaseBootstrapRequiredModuleClosureProbeErrorV2(
      code,
      message,
      { cause: error },
    );
}

function primaryFirstCaptureFailureV2(
  primary:
    PlatformReleaseBootstrapRequiredModuleClosureProbeErrorV2
    | undefined,
  closeFailure:
    PlatformReleaseBootstrapRequiredModuleClosureProbeErrorV2
    | undefined,
  message: string,
): void {
  if (primary !== undefined && closeFailure !== undefined) {
    const aggregate = new AggregateError(
      [primary, closeFailure],
      message,
      { cause: primary },
    );
    throw new PlatformReleaseBootstrapRequiredModuleClosureProbeErrorV2(
      primary.code,
      message,
      { cause: aggregate },
    );
  }
  if (primary !== undefined) throw primary;
  if (closeFailure !== undefined) throw closeFailure;
}

function captureDirectoryV2(
  absolutePath: string,
  options: Readonly<{
    errorCode: PlatformReleaseBootstrapRequiredModuleClosureProbeErrorCodeV2;
    label: string;
    maximumNames: number;
    exactNames: readonly string[];
    expectedIdentity: Readonly<{ device: string; inode: string }>;
    expectedOwnerUid: number;
    expectedOwnerGid: number;
    faultForTest?: DirectoryCaptureFaultForTestV2;
  }>,
): void {
  let before: BigIntStatV2;
  try {
    before = lstatSync(absolutePath, { bigint: true }) as BigIntStatV2;
    if (
      before.isSymbolicLink()
      || !before.isDirectory()
      || before.nlink <= 0n
      || realpathSync(absolutePath) !== absolutePath
      || modeTextV2(before) !== "0700"
      || Number(before.uid) !== options.expectedOwnerUid
      || Number(before.gid) !== options.expectedOwnerGid
      || !sameIdentityV2(statIdentityV2(before), options.expectedIdentity)
    ) {
      return failV2(
        options.errorCode,
        `${options.label} failed directory admission`,
      );
    }
  } catch (error) {
    throw captureErrorV2(
      error,
      options.errorCode,
      `${options.label} could not complete directory admission`,
    );
  }

  if (
    !Number.isSafeInteger(options.maximumNames)
    || options.maximumNames < 0
    || options.exactNames.length > options.maximumNames
  ) {
    return failV2(
      options.errorCode,
      `${options.label} has an invalid code-owned member bound`,
    );
  }

  let directory: ReturnType<typeof opendirSync> | undefined;
  let primary:
    PlatformReleaseBootstrapRequiredModuleClosureProbeErrorV2
    | undefined;
  const names: string[] = [];
  try {
    directory = opendirSync(absolutePath, { bufferSize: 1 });
    while (true) {
      const entry = directory.readSync();
      if (entry === null) break;
      if (
        options.faultForTest === "directory_read_failure"
        || options.faultForTest === "directory_read_and_close_failure"
      ) {
        throw new Error("Injected closure directory read failure");
      }
      if (entry.name.length < 1 || entry.name.length > 255) {
        return failV2(
          options.errorCode,
          `${options.label} contains an invalid direct-entry name`,
        );
      }
      if (names.length >= options.maximumNames) {
        return failV2(
          options.errorCode,
          `${options.label} exceeds its bounded member set`,
        );
      }
      names.push(entry.name);
    }
  } catch (error) {
    primary = captureErrorV2(
      error,
      options.errorCode,
      `${options.label} membership could not be captured`,
    );
  }

  let closeFailure:
    PlatformReleaseBootstrapRequiredModuleClosureProbeErrorV2
    | undefined;
  if (directory !== undefined) {
    try {
      directory.closeSync();
      if (
        options.faultForTest === "directory_close_failure"
        || options.faultForTest === "directory_read_and_close_failure"
      ) {
        throw new Error("Injected closure directory close failure");
      }
    } catch (error) {
      closeFailure = captureErrorV2(
        error,
        options.errorCode,
        `${options.label} descriptor could not be closed`,
      );
    }
  }
  primaryFirstCaptureFailureV2(
    primary,
    closeFailure,
    `${options.label} membership capture and descriptor close both failed`,
  );

  let after: BigIntStatV2;
  try {
    after = lstatSync(absolutePath, { bigint: true }) as BigIntStatV2;
    if (
      after.isSymbolicLink()
      || !after.isDirectory()
      || after.nlink <= 0n
      || realpathSync(absolutePath) !== absolutePath
      || !sameDirectoryFingerprintV2(before, after)
    ) {
      return failV2(
        options.errorCode,
        `${options.label} changed during bounded membership capture`,
      );
    }
  } catch (error) {
    throw captureErrorV2(
      error,
      options.errorCode,
      `${options.label} could not complete its post-capture fence`,
    );
  }

  names.sort();
  if (
    canonicalJsonStringify(names)
    !== canonicalJsonStringify([...options.exactNames].sort())
  ) {
    return failV2(
      options.errorCode,
      `${options.label} has unexpected direct children`,
    );
  }
}

type CapturePolicyV2 = Readonly<{
  expectedMode?: string;
  expectedOwnerUid?: number;
  expectedOwnerGid?: number;
  expectedLinkCount?: number;
}>;

function directoryPathsV2(
  occurrenceRoot: string,
  modulePaths: readonly string[],
): readonly string[] {
  const directories = new Set<string>();
  directories.add(occurrenceRoot);
  for (const modulePath of modulePaths) {
    let parent = path.dirname(modulePath);
    while (true) {
      directories.add(parent);
      if (parent === occurrenceRoot) break;
      parent = path.dirname(parent);
    }
  }
  return [...directories].sort();
}

function exactPrivateRootV2(): Readonly<{ alias: string; root: string }> {
  const alias = mkdtempSync(path.join(os.tmpdir(), ROOT_PREFIX_V2));
  const root = realpathSync(alias);
  chmodSync(root, 0o700);
  const stat = lstatSync(root, { bigint: true }) as BigIntStatV2;
  const ownerMatches =
    (typeof process.getuid !== "function" || Number(stat.uid) === process.getuid())
    && (typeof process.getgid !== "function" || Number(stat.gid) === process.getgid());
  if (stat.isSymbolicLink() || !stat.isDirectory() || modeTextV2(stat) !== "0700" || !ownerMatches) {
    rmSync(alias, { recursive: true, force: true });
    return failV2("REQUIRED_MODULE_CLOSURE_PROBE_FIXTURE_BUILD_FAILED", "Fixture root is not private and process-owned");
  }
  return Object.freeze({ alias, root });
}

function generatedModuleBytesV2(definition: PlatformReleaseRequiredModuleDefinitionV2): Buffer {
  const lines = definition.requiredExports.map((entry) =>
    entry.kind === "function"
      ? `export function ${entry.name}() { return undefined; }`
      : `export const ${entry.name} = ${JSON.stringify(`fixture:${definition.role}:${entry.name}`)};`,
  );
  const bytes = Buffer.from(`${lines.join("\n")}\n`, "utf8");
  if (bytes.byteLength === 0 || bytes.byteLength > PLATFORM_RELEASE_BOOTSTRAP_REQUIRED_MODULE_CLOSURE_PROBE_MAX_MODULE_BYTES_V2) {
    return failV2("REQUIRED_MODULE_CLOSURE_PROBE_FIXTURE_BUILD_FAILED", "Generated module exceeds the bounded fixture byte cap");
  }
  return bytes;
}

function moduleRefV2(definition: PlatformReleaseRequiredModuleDefinitionV2, bytes: Buffer): PlatformReleaseModuleRefV2 {
  const identity = {
    schema: "setfarm.platform-release-module-ref.v2" as const,
    moduleLocator: definition.moduleLocator,
    payloadLocator: `payload/${definition.moduleLocator}`,
    mediaType: "text/javascript" as const,
    contentHash: sha256BytesV2(bytes),
    byteLength: bytes.byteLength,
    mode: "0444" as const,
  };
  return Object.freeze({ ...identity, moduleRefHash: hashPlatformReleaseModuleRefV2(identity) });
}

function captureFileV2(
  absolutePath: string,
  hostIdentityHash: string,
  policy: CapturePolicyV2 = {},
  faultForTest?: FileCaptureFaultForTestV2,
): FileObservationV2 {
  let descriptor = -1;
  let buffer: Buffer | undefined;
  let eof: Buffer | undefined;
  let result: FileObservationV2 | undefined;
  let primary:
    PlatformReleaseBootstrapRequiredModuleClosureProbeErrorV2
    | undefined;
  try {
    const pathBefore = lstatSync(absolutePath, { bigint: true }) as BigIntStatV2;
    if (pathBefore.isSymbolicLink() || !pathBefore.isFile() || pathBefore.nlink < 1n || pathBefore.size <= 0n || pathBefore.size > BigInt(PLATFORM_RELEASE_BOOTSTRAP_REQUIRED_MODULE_CLOSURE_PROBE_MAX_MODULE_BYTES_V2) || (policy.expectedMode !== undefined && modeTextV2(pathBefore) !== policy.expectedMode) || (policy.expectedOwnerUid !== undefined && Number(pathBefore.uid) !== policy.expectedOwnerUid) || (policy.expectedOwnerGid !== undefined && Number(pathBefore.gid) !== policy.expectedOwnerGid) || (policy.expectedLinkCount !== undefined && Number(pathBefore.nlink) !== policy.expectedLinkCount)) {
      return failV2("REQUIRED_MODULE_CLOSURE_PROBE_FILESYSTEM_DRIFT", "Closure module is not one bounded regular file");
    }
    descriptor = openSync(absolutePath, fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0) | ((fsConstants as unknown as Record<string, number>).O_CLOEXEC ?? 0));
    const descriptorBefore = fstatSync(descriptor, { bigint: true }) as BigIntStatV2;
    if (!sameIdentityV2(statIdentityV2(pathBefore), statIdentityV2(descriptorBefore))) {
      return failV2("REQUIRED_MODULE_CLOSURE_PROBE_FILESYSTEM_DRIFT", "Closure module changed between path and descriptor admission");
    }
    const expectedByteLength = Number(descriptorBefore.size);
    buffer = Buffer.alloc(expectedByteLength);
    const digest = createHash("sha256");
    let offset = 0;
    while (offset < expectedByteLength) {
      if (faultForTest === "file_read_and_close_failure") {
        throw new Error("Injected closure file descriptor read failure");
      }
      const count = readSync(descriptor, buffer, offset, expectedByteLength - offset, offset);
      if (count <= 0) return failV2("REQUIRED_MODULE_CLOSURE_PROBE_FILESYSTEM_DRIFT", "Closure module reached EOF early");
      digest.update(buffer.subarray(offset, offset + count));
      offset += count;
    }
    eof = Buffer.alloc(1);
    if (readSync(descriptor, eof, 0, 1, expectedByteLength) !== 0) return failV2("REQUIRED_MODULE_CLOSURE_PROBE_FILESYSTEM_DRIFT", "Closure module grew during bounded read");
    const descriptorAfter = fstatSync(descriptor, { bigint: true }) as BigIntStatV2;
    const pathAfter = lstatSync(absolutePath, { bigint: true }) as BigIntStatV2;
    if (!sameIdentityV2(statIdentityV2(descriptorBefore), statIdentityV2(descriptorAfter))
        || !sameIdentityV2(statIdentityV2(descriptorAfter), statIdentityV2(pathAfter))
        || descriptorBefore.uid !== descriptorAfter.uid
        || descriptorBefore.gid !== descriptorAfter.gid
        || descriptorBefore.mode !== descriptorAfter.mode
        || descriptorBefore.nlink !== descriptorAfter.nlink
        || descriptorBefore.size !== descriptorAfter.size
        || descriptorBefore.mtimeNs !== descriptorAfter.mtimeNs
        || descriptorBefore.ctimeNs !== descriptorAfter.ctimeNs) {
      return failV2("REQUIRED_MODULE_CLOSURE_PROBE_FILESYSTEM_DRIFT", "Closure module changed during descriptor-bounded observation");
    }
    if ((policy.expectedMode !== undefined && modeTextV2(descriptorAfter) !== policy.expectedMode)
        || (policy.expectedOwnerUid !== undefined && Number(descriptorAfter.uid) !== policy.expectedOwnerUid)
        || (policy.expectedOwnerGid !== undefined && Number(descriptorAfter.gid) !== policy.expectedOwnerGid)
        || (policy.expectedLinkCount !== undefined && Number(descriptorAfter.nlink) !== policy.expectedLinkCount)) {
      return failV2("REQUIRED_MODULE_CLOSURE_PROBE_FILESYSTEM_DRIFT", "Closure module violated its fixture file policy");
    }
    const stableIdentity = Object.freeze({
      hostIdentityHash,
      objectKind: "ordinary_file" as const,
      device: descriptorAfter.dev.toString(10),
      inode: descriptorAfter.ino.toString(10),
    });
    const mutableFingerprint = Object.freeze({
      ownerUid: Number(descriptorAfter.uid),
      ownerGid: Number(descriptorAfter.gid),
      mode: modeTextV2(descriptorAfter),
      linkCount: Number(descriptorAfter.nlink),
      byteLength: Number(descriptorAfter.size),
      contentHash: digest.digest("hex"),
      modifiedTimeNanoseconds: descriptorAfter.mtimeNs.toString(10),
      changedTimeNanoseconds: descriptorAfter.ctimeNs.toString(10),
    });
    result = Object.freeze({
      stableIdentity,
      mutableFingerprint,
      moduleObservationHash: hashPlatformReleaseRequiredModuleClosureProbeModuleObservationV2({ stableIdentity, mutableFingerprint }),
    });
  } catch (error) {
    primary = captureErrorV2(
      error,
      "REQUIRED_MODULE_CLOSURE_PROBE_FILESYSTEM_DRIFT",
      "Closure module could not be captured through one descriptor",
    );
  }
  buffer?.fill(0);
  eof?.fill(0);

  let closeFailure:
    PlatformReleaseBootstrapRequiredModuleClosureProbeErrorV2
    | undefined;
  if (descriptor >= 0) {
    const descriptorToClose = descriptor;
    descriptor = -1;
    try {
      closeSync(descriptorToClose);
      if (
        faultForTest === "file_close_failure"
        || faultForTest === "file_read_and_close_failure"
      ) {
        throw new Error("Injected closure file descriptor close failure");
      }
    } catch (error) {
      closeFailure = captureErrorV2(
        error,
        "REQUIRED_MODULE_CLOSURE_PROBE_FILESYSTEM_DRIFT",
        `Closure module descriptor could not be closed: ${absolutePath}`,
      );
    }
  }
  primaryFirstCaptureFailureV2(
    primary,
    closeFailure,
    "Closure module capture and descriptor close both failed",
  );
  if (result === undefined) {
    return failV2(
      "REQUIRED_MODULE_CLOSURE_PROBE_FILESYSTEM_DRIFT",
      "Closure module descriptor capture did not produce a result",
    );
  }
  return result;
}

function captureNodeExecutableV2(hostIdentityHash: string): NodeExecutableV2 {
  const executable = realpathSync(process.execPath);
  const observation = captureFileV2(executable, hostIdentityHash);
  return Object.freeze({
    contentHash: observation.mutableFingerprint.contentHash,
    stableIdentity: observation.stableIdentity,
    mutableFingerprint: observation.mutableFingerprint,
  });
}

type ProbeResultV2 = Readonly<{
  status: "exited" | "spawn_failed" | "timed_out" | "output_limit_exceeded";
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  pid: number;
  stdout: Buffer;
  stderr: Buffer;
  startedAt: number;
  finishedAt: number;
}>;

function primaryFirstProbeFailureV2(
  primary: PlatformReleaseBootstrapRequiredModuleClosureProbeErrorV2,
  secondary:
    readonly PlatformReleaseBootstrapRequiredModuleClosureProbeErrorV2[],
  message: string,
): PlatformReleaseBootstrapRequiredModuleClosureProbeErrorV2 {
  if (secondary.length === 0) return primary;
  const aggregate = new AggregateError(
    [primary, ...secondary],
    message,
    { cause: primary },
  );
  return new PlatformReleaseBootstrapRequiredModuleClosureProbeErrorV2(
    primary.code,
    message,
    { cause: aggregate },
  );
}

function runBoundedProbeV2(
  input: Readonly<{ modulePath: string; cwd: string }>,
  faultForTest?: ProbeRunnerFaultForTestV2,
): Promise<ProbeResultV2> {
  const argv = faultForTest === undefined
    ? PROBE_ARGV_V2
    : Object.freeze([
      "-e",
      "setInterval(() => {}, 1000);",
      TEST_PROCESS_MARKER_V2,
    ] as const);
  return new Promise((resolve, reject) => {
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    const secondaryFailures:
      PlatformReleaseBootstrapRequiredModuleClosureProbeErrorV2[] = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let status: ProbeResultV2["status"] = "exited";
    let primaryFailure:
      PlatformReleaseBootstrapRequiredModuleClosureProbeErrorV2
      | undefined;
    let rejectAfterClose = false;
    let failureLatched = false;
    let outputLimitLatched = false;
    let terminationRequested = false;
    let settled = false;
    let executionTimer: NodeJS.Timeout | undefined;
    let settlementTimer: NodeJS.Timeout | undefined;
    let child: ChildProcess;
    const startedAt = Date.now();

    const clearTimers = (): void => {
      if (executionTimer !== undefined) clearTimeout(executionTimer);
      if (settlementTimer !== undefined) clearTimeout(settlementTimer);
    };
    const zeroChunks = (): void => {
      for (const chunk of stdoutChunks) chunk.fill(0);
      for (const chunk of stderrChunks) chunk.fill(0);
    };
    const probeResult = (
      exitCode: number | null,
      signal: NodeJS.Signals | null,
    ): ProbeResultV2 => {
      const stdout = Buffer.concat(stdoutChunks, stdoutBytes);
      const stderr = Buffer.concat(stderrChunks, stderrBytes);
      zeroChunks();
      return Object.freeze({
        status,
        exitCode,
        signal,
        pid: child.pid ?? -1,
        stdout,
        stderr,
        startedAt,
        finishedAt: Date.now(),
      });
    };
    const rejectFailure = (
      fallback: PlatformReleaseBootstrapRequiredModuleClosureProbeErrorV2,
    ): void => {
      const primary = primaryFailure ?? fallback;
      zeroChunks();
      reject(primaryFirstProbeFailureV2(
        primary,
        secondaryFailures,
        "Closure probe and direct-child containment both failed",
      ));
    };
    const settleClose = (
      exitCode: number | null,
      signal: NodeJS.Signals | null,
    ): void => {
      if (settled) return;
      settled = true;
      clearTimers();
      if (
        primaryFailure !== undefined
        && (rejectAfterClose || secondaryFailures.length > 0)
      ) {
        rejectFailure(primaryFailure);
        return;
      }
      resolve(probeResult(exitCode, signal));
    };
    try {
      child = spawn(process.execPath, argv, {
        cwd: input.cwd,
        detached: false,
        env: {},
        shell: false,
        stdio: ["ignore", "pipe", "pipe", "pipe"],
      });
    } catch (error) {
      resolve(Object.freeze({ status: "spawn_failed", exitCode: null, signal: null, pid: -1, stdout: Buffer.alloc(0), stderr: Buffer.from(String(error), "utf8").subarray(0, PLATFORM_RELEASE_BOOTSTRAP_REQUIRED_MODULE_CLOSURE_PROBE_MAX_OUTPUT_BYTES_V2), startedAt, finishedAt: Date.now() }));
      return;
    }

    const recordSecondaryFailure = (message: string, cause?: unknown): void => {
      secondaryFailures.push(
        new PlatformReleaseBootstrapRequiredModuleClosureProbeErrorV2(
          "REQUIRED_MODULE_CLOSURE_PROBE_PROCESS_FAILED",
          message,
          cause === undefined ? undefined : { cause },
        ),
      );
    };
    const signalDirectChild = (force: boolean): boolean => {
      if (faultForTest === "direct_kill_failure" && !force) {
        recordSecondaryFailure(
          "Injected closure probe direct-child termination failure",
        );
        return false;
      }
      try {
        const signaled = child.kill("SIGKILL");
        if (!signaled) {
          recordSecondaryFailure(
            "Closure probe direct-child termination returned false",
          );
        }
        return signaled;
      } catch (error) {
        recordSecondaryFailure(
          "Closure probe direct-child termination threw",
          error,
        );
        return false;
      }
    };
    const settleWatchdog = (): void => {
      if (settled) return;
      secondaryFailures.push(
        new PlatformReleaseBootstrapRequiredModuleClosureProbeErrorV2(
          "REQUIRED_MODULE_CLOSURE_PROBE_PROCESS_FAILED",
          "Closure probe did not settle after direct-child termination",
        ),
      );
      signalDirectChild(true);
      settled = true;
      clearTimers();
      rejectFailure(
        new PlatformReleaseBootstrapRequiredModuleClosureProbeErrorV2(
          "REQUIRED_MODULE_CLOSURE_PROBE_PROCESS_FAILED",
          "Closure probe settlement was not proven",
        ),
      );
    };
    const requestTermination = (): void => {
      if (terminationRequested) return;
      terminationRequested = true;
      const settlementMilliseconds = faultForTest === undefined
        ? PROCESS_SETTLEMENT_TIMEOUT_MILLISECONDS_V2
        : TEST_PROCESS_SETTLEMENT_TIMEOUT_MILLISECONDS_V2;
      settlementTimer = setTimeout(settleWatchdog, settlementMilliseconds);
      if (!signalDirectChild(false)) signalDirectChild(true);
    };
    const latchPrimaryFailure = (
      error: PlatformReleaseBootstrapRequiredModuleClosureProbeErrorV2,
      nextStatus: ProbeResultV2["status"],
      mustRejectAfterClose: boolean,
    ): void => {
      if (failureLatched) return;
      failureLatched = true;
      primaryFailure = error;
      status = nextStatus;
      rejectAfterClose = mustRejectAfterClose;
      requestTermination();
    };
    const captureOutput = (
      stream: "stdout" | "stderr",
      chunk: Buffer,
    ): void => {
      if (failureLatched || outputLimitLatched) return;
      const current = stream === "stdout" ? stdoutBytes : stderrBytes;
      if (
        current + chunk.byteLength
        > PLATFORM_RELEASE_BOOTSTRAP_REQUIRED_MODULE_CLOSURE_PROBE_MAX_OUTPUT_BYTES_V2
      ) {
        outputLimitLatched = true;
        latchPrimaryFailure(
          new PlatformReleaseBootstrapRequiredModuleClosureProbeErrorV2(
            "REQUIRED_MODULE_CLOSURE_PROBE_OUTPUT_LIMIT",
            `Closure probe exceeded bounded ${stream} capture`,
          ),
          "output_limit_exceeded",
          false,
        );
        return;
      }
      const copy = Buffer.from(chunk);
      if (stream === "stdout") {
        stdoutChunks.push(copy);
        stdoutBytes += copy.byteLength;
      } else {
        stderrChunks.push(copy);
        stderrBytes += copy.byteLength;
      }
    };
    const streamFailure = (
      stream: "stdout" | "stderr" | "input",
      error: Error,
    ): void => {
      latchPrimaryFailure(
        new PlatformReleaseBootstrapRequiredModuleClosureProbeErrorV2(
          "REQUIRED_MODULE_CLOSURE_PROBE_PROCESS_FAILED",
          `Closure probe ${stream} stream failed`,
          { cause: error },
        ),
        "spawn_failed",
        true,
      );
    };

    child.once("error", (error) => {
      latchPrimaryFailure(
        new PlatformReleaseBootstrapRequiredModuleClosureProbeErrorV2(
          "REQUIRED_MODULE_CLOSURE_PROBE_SPAWN_FAILED",
          "Closure probe could not start",
          { cause: error },
        ),
        "spawn_failed",
        false,
      );
    });
    child.once("close", (exitCode, signal) => {
      if (faultForTest === "close_suppressed") return;
      settleClose(exitCode, signal);
    });
    if (child.stdout === null || child.stderr === null) {
      latchPrimaryFailure(
        new PlatformReleaseBootstrapRequiredModuleClosureProbeErrorV2(
          "REQUIRED_MODULE_CLOSURE_PROBE_SPAWN_FAILED",
          "Closure probe did not expose its fixed output streams",
        ),
        "spawn_failed",
        true,
      );
    } else {
      child.stdout.once("error", (error) => streamFailure("stdout", error));
      child.stderr.once("error", (error) => streamFailure("stderr", error));
      child.stdout.on("data", (chunk: Buffer) => captureOutput("stdout", chunk));
      child.stderr.on("data", (chunk: Buffer) => captureOutput("stderr", chunk));
      if (faultForTest === "stdout_stream_error") {
        queueMicrotask(() => {
          child.stdout?.destroy(new Error(
            "Injected closure probe stdout stream failure",
          ));
        });
      }
      if (faultForTest === "stderr_stream_error") {
        queueMicrotask(() => {
          child.stderr?.destroy(new Error(
            "Injected closure probe stderr stream failure",
          ));
        });
      }
    }

    const fd3 = child.stdio[3];
    if (
      !fd3
      || typeof fd3 === "string"
      || typeof (fd3 as { once?: unknown }).once !== "function"
      || typeof (fd3 as { end?: unknown }).end !== "function"
    ) {
      latchPrimaryFailure(
        new PlatformReleaseBootstrapRequiredModuleClosureProbeErrorV2(
          "REQUIRED_MODULE_CLOSURE_PROBE_SPAWN_FAILED",
          "Closure probe did not expose its fixed input stream",
        ),
        "spawn_failed",
        true,
      );
    } else {
      const inputStream = fd3 as unknown as {
        once(event: "error", listener: (error: Error) => void): void;
        end(value: string): void;
      };
      inputStream.once("error", (error) => streamFailure("input", error));
      try {
        inputStream.end(JSON.stringify({ modulePath: input.modulePath }));
      } catch (error) {
        streamFailure(
          "input",
          error instanceof Error ? error : new Error(String(error)),
        );
      }
    }

    const executionMilliseconds = faultForTest === undefined
      ? PLATFORM_RELEASE_BOOTSTRAP_REQUIRED_MODULE_CLOSURE_PROBE_TIMEOUT_MS_V2
      : TEST_PROCESS_TIMEOUT_MILLISECONDS_V2;
    executionTimer = setTimeout(() => {
      latchPrimaryFailure(
        new PlatformReleaseBootstrapRequiredModuleClosureProbeErrorV2(
          "REQUIRED_MODULE_CLOSURE_PROBE_TIMEOUT",
          `Closure probe timed out after ${executionMilliseconds}ms`,
        ),
        "timed_out",
        false,
      );
    }, executionMilliseconds);
  });
}

function parseChildExportsV2(stdout: Buffer): readonly PlatformReleaseRequiredModuleClosureProbeExportV2[] {
  let parsed: unknown;
  try { parsed = JSON.parse(stdout.toString("utf8")); } catch (error) { return failV2("REQUIRED_MODULE_CLOSURE_PROBE_OUTPUT_INVALID", "Closure child did not emit JSON", error); }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed) || Object.keys(parsed).length !== 1 || !Array.isArray((parsed as { exports?: unknown }).exports)) return failV2("REQUIRED_MODULE_CLOSURE_PROBE_OUTPUT_INVALID", "Closure child changed its output shape");
  const exports = (parsed as { exports: unknown[] }).exports.map((entry) => {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry) || Object.keys(entry).sort().join(",") !== "kind,name" || typeof (entry as { name?: unknown }).name !== "string" || typeof (entry as { kind?: unknown }).kind !== "string") return failV2("REQUIRED_MODULE_CLOSURE_PROBE_OUTPUT_INVALID", "Closure child returned an invalid export");
    const kind = (entry as { kind: string }).kind;
    if (!["function", "string", "number", "boolean", "object", "undefined", "symbol", "bigint"].includes(kind)) return failV2("REQUIRED_MODULE_CLOSURE_PROBE_OUTPUT_INVALID", "Closure child returned an invalid export kind");
    return { name: (entry as { name: string }).name, kind: kind as PlatformReleaseRequiredModuleClosureProbeExportV2["kind"] };
  });
  for (let index = 1; index < exports.length; index += 1) if (exports[index - 1]!.name >= exports[index]!.name) return failV2("REQUIRED_MODULE_CLOSURE_PROBE_OUTPUT_INVALID", "Closure child export names are not sorted");
  return Object.freeze(exports);
}

function assertFixtureLayoutV2(
  state: FixtureStateV2,
  faultForTest?: DirectoryCaptureFaultForTestV2,
): void {
  captureDirectoryV2(state.root, {
    errorCode: "REQUIRED_MODULE_CLOSURE_PROBE_FIXTURE_HANDLE_UNAUTHENTICATED",
    label: "Closure fixture root",
    maximumNames: OCCURRENCE_NAMES_V2.length,
    exactNames: OCCURRENCE_NAMES_V2,
    expectedIdentity: state.rootIdentity,
    expectedOwnerUid: state.ownerUid,
    expectedOwnerGid: state.ownerGid,
    faultForTest,
  });
  for (const [occurrenceIndex, paths] of state.modulePaths.entries()) {
    const occurrenceRoot = path.join(state.root, OCCURRENCE_NAMES_V2[occurrenceIndex]!);
    const expectedDirectories = directoryPathsV2(occurrenceRoot, paths);
    const expectedChildren = new Map<string, Set<string>>();
    const expectedFiles = new Set(paths);
    const expectChild = (parent: string, child: string): void => {
      const children = expectedChildren.get(parent) ?? new Set<string>();
      children.add(child);
      expectedChildren.set(parent, children);
    };
    for (const modulePath of paths) {
      let parent = path.dirname(modulePath);
      expectChild(parent, path.basename(modulePath));
      while (parent !== occurrenceRoot) {
        const child = path.basename(parent);
        parent = path.dirname(parent);
        expectChild(parent, child);
      }
    }
    for (const directory of expectedDirectories) {
      const expectedIdentity = state.directoryIdentities[occurrenceIndex]!
        .find((entry) => entry.path === directory);
      const expectedNames = expectedChildren.get(directory);
      if (expectedIdentity === undefined || expectedNames === undefined) {
        return failV2(
          "REQUIRED_MODULE_CLOSURE_PROBE_FIXTURE_HANDLE_UNAUTHENTICATED",
          "Closure fixture directory is outside its exact code-owned layout",
        );
      }
      captureDirectoryV2(directory, {
        errorCode:
          "REQUIRED_MODULE_CLOSURE_PROBE_FIXTURE_HANDLE_UNAUTHENTICATED",
        label: `Closure fixture occurrence ${occurrenceIndex + 1} directory`,
        maximumNames: expectedNames.size,
        exactNames: [...expectedNames],
        expectedIdentity,
        expectedOwnerUid: state.ownerUid,
        expectedOwnerGid: state.ownerGid,
      });
    }
    for (const [moduleIndex, modulePath] of paths.entries()) {
      const stat = lstatSync(modulePath, { bigint: true }) as BigIntStatV2;
      const observation = captureFileV2(modulePath, state.hostIdentityHash, { expectedMode: "0444", expectedOwnerUid: state.ownerUid, expectedOwnerGid: state.ownerGid, expectedLinkCount: 1 });
      if (stat.isSymbolicLink() || !stat.isFile() || modeTextV2(stat) !== "0444" || path.basename(modulePath) !== path.basename(state.requirement.entries[moduleIndex]!.moduleLocator) || !sameIdentityV2(statIdentityV2(stat), observation.stableIdentity) || !expectedFiles.has(modulePath)) return failV2("REQUIRED_MODULE_CLOSURE_PROBE_FIXTURE_HANDLE_UNAUTHENTICATED", `Closure fixture module ${occurrenceIndex}:${moduleIndex} is not authentic`);
    }
  }
}

function authenticFixtureStateV2(
  fixture: PlatformReleaseBootstrapRequiredModuleClosureProbeFixtureV2,
  faultForTest?: DirectoryCaptureFaultForTestV2,
): FixtureStateV2 {
  if (typeof fixture !== "object" || fixture === null || isProxy(fixture)) return failV2("REQUIRED_MODULE_CLOSURE_PROBE_FIXTURE_HANDLE_UNAUTHENTICATED", "Closure probe requires an authentic fixture handle");
  const state = fixtureStatesV2.get(fixture);
  if (state === undefined) return failV2("REQUIRED_MODULE_CLOSURE_PROBE_FIXTURE_HANDLE_UNAUTHENTICATED", "Closure probe handle is not code-owned");
  assertFixtureLayoutV2(state, faultForTest);
  return state;
}

function removePrivateFixtureRootIfAuthenticV2(
  alias: string,
  root: string,
  expectedIdentity?: Readonly<{ device: string; inode: string }>,
): boolean {
  try {
    const aliasStat = lstatSync(alias, { bigint: true }) as BigIntStatV2;
    const rootStat = lstatSync(root, { bigint: true }) as BigIntStatV2;
    if (aliasStat.isSymbolicLink() || rootStat.isSymbolicLink() || !rootStat.isDirectory() || realpathSync(alias) !== root || modeTextV2(rootStat) !== "0700" || (expectedIdentity !== undefined && !sameIdentityV2(statIdentityV2(rootStat), expectedIdentity))) return false;
    rmSync(alias, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

function processEvidenceV2(result: Awaited<ReturnType<typeof runBoundedProbeV2>>, node: NodeExecutableV2, argvHash: string): PlatformReleaseRequiredModuleClosureProbeProcessEvidenceV2 {
  const base = {
    executableRef: "NODE_RUNTIME_V2" as const,
    executableStableIdentity: node.stableIdentity,
    executableMutableFingerprint: node.mutableFingerprint,
    executableContentHash: node.contentHash,
    argvHash,
    environmentPolicy: PLATFORM_RELEASE_BOOTSTRAP_REQUIRED_MODULE_CLOSURE_PROBE_ENVIRONMENT_POLICY_V2,
    shell: "forbidden" as const,
    pid: result.pid,
    startedAt: result.startedAt,
    finishedAt: result.finishedAt,
    status: result.status,
    exitCode: result.exitCode,
    signal: result.signal,
    stdoutByteLength: result.stdout.byteLength,
    stderrByteLength: result.stderr.byteLength,
    stdoutHash: sha256BytesV2(result.stdout),
    stderrHash: sha256BytesV2(result.stderr),
  };
  return { ...base, processOccurrenceHash: hashPlatformReleaseRequiredModuleClosureProbeProcessOccurrenceV2(base) };
}

export function buildPlatformReleaseBootstrapRequiredModuleClosureProbeFixtureForTestV2(): PlatformReleaseBootstrapRequiredModuleClosureProbeFixtureV2 {
  if (process.platform !== "darwin") return failV2("REQUIRED_MODULE_CLOSURE_PROBE_PLATFORM_UNAVAILABLE", "Full module closure probe requires Darwin");
  const privateRoot = exactPrivateRootV2();
  try {
    const requirement = getPlatformReleaseRequiredModuleRequirementV2();
    const hostIdentityHash = hashCanonicalJson({ schema: `${PLATFORM_RELEASE_BOOTSTRAP_REQUIRED_MODULE_CLOSURE_PROBE_V2_SCHEMA}.test-host.v2`, platform: "darwin", authority: "test_fixture_only" });
    const catalogHash = hashPlatformReleaseRequiredModuleClosureProbeRoleCatalogV2(requirement);
    const moduleBytes = requirement.entries.map(generatedModuleBytesV2);
    const moduleRefs = requirement.entries.map((definition, index) => moduleRefV2(definition, moduleBytes[index]!));
    const modulePaths = OCCURRENCE_NAMES_V2.map((occurrence) => requirement.entries.map((definition, index) => {
      const modulePath = path.join(privateRoot.root, occurrence, definition.moduleLocator);
      mkdirSync(path.dirname(modulePath), { recursive: true, mode: 0o700 });
      chmodSync(path.dirname(modulePath), 0o700);
      writeFileSync(modulePath, moduleBytes[index]!, { mode: 0o444 });
      chmodSync(modulePath, 0o444);
      return modulePath;
    })) as [string[], string[]];
    const root = lstatSync(privateRoot.root, { bigint: true }) as BigIntStatV2;
    const ownerUid = Number(root.uid);
    const ownerGid = Number(root.gid);
    const directoryIdentities = modulePaths.map((paths, occurrenceIndex) =>
      directoryPathsV2(path.join(privateRoot.root, OCCURRENCE_NAMES_V2[occurrenceIndex]!), paths).map((directory) => {
        const stat = lstatSync(directory, { bigint: true }) as BigIntStatV2;
        if (stat.isSymbolicLink() || !stat.isDirectory() || modeTextV2(stat) !== "0700" || Number(stat.uid) !== ownerUid || Number(stat.gid) !== ownerGid) {
          return failV2("REQUIRED_MODULE_CLOSURE_PROBE_FIXTURE_BUILD_FAILED", "Closure fixture directory is not private and process-owned");
        }
        return Object.freeze({ path: directory, ...statIdentityV2(stat) });
      }),
    ) as [DirectoryIdentityV2[], DirectoryIdentityV2[]];
    const initialModuleObservations = modulePaths.map((paths) =>
      paths.map((modulePath) => captureFileV2(modulePath, hostIdentityHash, { expectedMode: "0444", expectedOwnerUid: ownerUid, expectedOwnerGid: ownerGid, expectedLinkCount: 1 })),
    ) as [FileObservationV2[], FileObservationV2[]];
    const moduleStableIdentities = initialModuleObservations.map((observations) =>
      observations.map((observation) => observation.stableIdentity),
    ) as [PlatformReleaseRequiredModuleClosureProbeStableIdentityV2[], PlatformReleaseRequiredModuleClosureProbeStableIdentityV2[]];
    const moduleMutableFingerprints = initialModuleObservations.map((observations) =>
      observations.map((observation) => observation.mutableFingerprint),
    ) as [PlatformReleaseRequiredModuleClosureProbeMutableFingerprintV2[], PlatformReleaseRequiredModuleClosureProbeMutableFingerprintV2[]];
    const state: FixtureStateV2 = Object.freeze({ alias: privateRoot.alias, root: privateRoot.root, requirement, hostIdentityHash, catalogHash, modulePaths, moduleBytes, moduleRefs, moduleStableIdentities, moduleMutableFingerprints, directoryIdentities, ownerUid, ownerGid, rootIdentity: statIdentityV2(root) });
    let fixture: PlatformReleaseBootstrapRequiredModuleClosureProbeFixtureV2;
    fixture = Object.freeze({
      dispose(): void {
        const current = fixtureStatesV2.get(fixture);
        if (current === undefined) return;
        if (removePrivateFixtureRootIfAuthenticV2(current.alias, current.root, current.rootIdentity)) fixtureStatesV2.delete(fixture);
      },
    });
    fixtureStatesV2.set(fixture, state);
    return fixture;
  } catch (error) {
    removePrivateFixtureRootIfAuthenticV2(privateRoot.alias, privateRoot.root);
    return failV2("REQUIRED_MODULE_CLOSURE_PROBE_FIXTURE_BUILD_FAILED", "Could not build private full module closure fixture", error);
  }
}

export function mutatePlatformReleaseBootstrapRequiredModuleClosureProbeFixtureForTestV2(
  fixture: PlatformReleaseBootstrapRequiredModuleClosureProbeFixtureV2,
  mutation: PlatformReleaseBootstrapRequiredModuleClosureProbeFixtureMutationV2,
): void {
  const state = authenticFixtureStateV2(fixture);
  if (mutation === "add_root_entry_over_limit") {
    writeFileSync(
      path.join(state.root, "overflow-entry-v2"),
      "bounded membership overflow\n",
      { flag: "wx", mode: 0o400 },
    );
    return;
  }
  const firstPath = state.modulePaths[0]![0]!;
  const original = state.moduleBytes[0]!;
  const replacement = mutation === "replace_first_same_bytes"
    ? original
    : mutation === "append_extra_export"
      ? Buffer.concat([original, Buffer.from("export const attackerExtraV2 = true;\n", "utf8")])
      : Buffer.from(`${original.toString("utf8")}\nexport const driftV2 = true;\n`, "utf8");
  unlinkSync(firstPath);
  writeFileSync(firstPath, replacement, { mode: 0o444 });
  chmodSync(firstPath, 0o444);
}

function admittedFaultForTestV2(
  value: unknown,
): RequiredModuleClosureProbeFaultForTestV2 | undefined {
  if (value === undefined) return undefined;
  if (
    typeof value !== "string"
    || !REQUIRED_MODULE_CLOSURE_PROBE_FAULTS_FOR_TEST_V2.includes(
      value as RequiredModuleClosureProbeFaultForTestV2,
    )
  ) {
    return failV2(
      "REQUIRED_MODULE_CLOSURE_PROBE_RECEIPT_INVALID",
      "Closure probe test fault is outside the fixed literal set",
    );
  }
  return value as RequiredModuleClosureProbeFaultForTestV2;
}

function isDirectoryCaptureFaultForTestV2(
  value: RequiredModuleClosureProbeFaultForTestV2 | undefined,
): value is DirectoryCaptureFaultForTestV2 {
  return value === "directory_read_failure"
    || value === "directory_close_failure"
    || value === "directory_read_and_close_failure";
}

function isFileCaptureFaultForTestV2(
  value: RequiredModuleClosureProbeFaultForTestV2 | undefined,
): value is FileCaptureFaultForTestV2 {
  return value === "file_read_and_close_failure"
    || value === "file_close_failure";
}

function isProbeRunnerFaultForTestV2(
  value: RequiredModuleClosureProbeFaultForTestV2 | undefined,
): value is ProbeRunnerFaultForTestV2 {
  return value === "stdout_stream_error"
    || value === "stderr_stream_error"
    || value === "direct_kill_failure"
    || value === "close_suppressed";
}

export async function observePlatformReleaseBootstrapRequiredModuleClosureProbeForTestV2(
  fixture: PlatformReleaseBootstrapRequiredModuleClosureProbeFixtureV2,
  options: Readonly<{
    challenge?: Uint8Array;
    testFault?: RequiredModuleClosureProbeFaultForTestV2;
  }> = {},
): Promise<PlatformReleaseRequiredModuleClosureProbeV2> {
  if (process.platform !== "darwin") return failV2("REQUIRED_MODULE_CLOSURE_PROBE_PLATFORM_UNAVAILABLE", "Full module closure probe requires Darwin");
  if (
    options === null
    || typeof options !== "object"
    || isProxy(options)
    || Object.keys(options).some((key) =>
      key !== "challenge" && key !== "testFault")
  ) {
    return failV2(
      "REQUIRED_MODULE_CLOSURE_PROBE_RECEIPT_INVALID",
      "Closure probe options are outside the exact test support shape",
    );
  }
  const testFault = admittedFaultForTestV2(options.testFault);
  const state = authenticFixtureStateV2(
    fixture,
    isDirectoryCaptureFaultForTestV2(testFault) ? testFault : undefined,
  );
  const challenge = options.challenge === undefined ? randomBytes(32) : Buffer.from(options.challenge);
  if (challenge.byteLength !== 32) return failV2("REQUIRED_MODULE_CLOSURE_PROBE_RECEIPT_INVALID", "Closure probe challenge must be exactly 32 bytes");
  const modulePolicy = { expectedMode: "0444", expectedOwnerUid: state.ownerUid, expectedOwnerGid: state.ownerGid, expectedLinkCount: 1 } as const;
  if (isFileCaptureFaultForTestV2(testFault)) {
    captureFileV2(
      state.modulePaths[0]![0]!,
      state.hostIdentityHash,
      modulePolicy,
      testFault,
    );
    return failV2(
      "REQUIRED_MODULE_CLOSURE_PROBE_FILESYSTEM_DRIFT",
      "Closure file capture fault did not fail closed",
    );
  }
  if (isProbeRunnerFaultForTestV2(testFault)) {
    await runBoundedProbeV2(
      {
        modulePath: state.modulePaths[0]![0]!,
        cwd: path.dirname(state.modulePaths[0]![0]!),
      },
      testFault,
    );
    return failV2(
      "REQUIRED_MODULE_CLOSURE_PROBE_PROCESS_FAILED",
      "Closure probe runner fault did not fail closed",
    );
  }
  const nodeBefore = captureNodeExecutableV2(state.hostIdentityHash);
  assertFixtureLayoutV2(state);
  const observationsBefore = state.modulePaths.map((paths) => paths.map((modulePath) => captureFileV2(modulePath, state.hostIdentityHash, modulePolicy)));
  for (const [occurrenceIndex, observations] of observationsBefore.entries()) for (const [moduleIndex, observation] of observations.entries()) {
    const ref = state.moduleRefs[moduleIndex]!;
    if (canonicalJsonStringify(observation.stableIdentity) !== canonicalJsonStringify(state.moduleStableIdentities[occurrenceIndex]![moduleIndex]!) || canonicalJsonStringify(observation.mutableFingerprint) !== canonicalJsonStringify(state.moduleMutableFingerprints[occurrenceIndex]![moduleIndex]!) || observation.mutableFingerprint.contentHash !== ref.contentHash || observation.mutableFingerprint.byteLength !== ref.byteLength || observation.mutableFingerprint.mode !== ref.mode) return failV2("REQUIRED_MODULE_CLOSURE_PROBE_FILESYSTEM_DRIFT", `Closure module ${occurrenceIndex}:${moduleIndex} drifted before execution`);
  }
  const argvHash = hashCanonicalJson({ schema: `${PLATFORM_RELEASE_BOOTSTRAP_REQUIRED_MODULE_CLOSURE_PROBE_V2_SCHEMA}.child-argv.v2`, argv: PROBE_ARGV_V2 });
  const occurrenceRows: Array<Array<{
    process: PlatformReleaseRequiredModuleClosureProbeProcessEvidenceV2;
    observedExports: readonly PlatformReleaseRequiredModuleClosureProbeExportV2[];
  }>> = [[], []];
  for (const occurrenceIndex of [0, 1] as const) {
    for (const [moduleIndex, modulePath] of state.modulePaths[occurrenceIndex]!.entries()) {
      const result = await runBoundedProbeV2({ modulePath, cwd: path.dirname(modulePath) });
      const process = processEvidenceV2(result, nodeBefore, argvHash);
      if (result.status !== "exited" || result.exitCode !== 0 || result.signal !== null || result.stderr.byteLength !== 0) {
        result.stdout.fill(0); result.stderr.fill(0);
        return failV2(result.status === "timed_out" ? "REQUIRED_MODULE_CLOSURE_PROBE_TIMEOUT" : result.status === "output_limit_exceeded" ? "REQUIRED_MODULE_CLOSURE_PROBE_OUTPUT_LIMIT" : result.status === "spawn_failed" ? "REQUIRED_MODULE_CLOSURE_PROBE_SPAWN_FAILED" : "REQUIRED_MODULE_CLOSURE_PROBE_PROCESS_FAILED", `Closure child ${occurrenceIndex}:${moduleIndex} failed`);
      }
      const observedExports = parseChildExportsV2(result.stdout);
      result.stdout.fill(0); result.stderr.fill(0);
      occurrenceRows[occurrenceIndex]!.push({ process, observedExports });
    }
  }
  assertFixtureLayoutV2(state);
  const observationsAfter = state.modulePaths.map((paths) => paths.map((modulePath) => captureFileV2(modulePath, state.hostIdentityHash, modulePolicy)));
  const nodeAfter = captureNodeExecutableV2(state.hostIdentityHash);
  if (canonicalJsonStringify(nodeBefore) !== canonicalJsonStringify(nodeAfter) || observationsBefore.some((observations, occurrenceIndex) => observations.some((observation, moduleIndex) => canonicalJsonStringify(observation) !== canonicalJsonStringify(observationsAfter[occurrenceIndex]![moduleIndex]!)))) return failV2("REQUIRED_MODULE_CLOSURE_PROBE_EXECUTABLE_DRIFT", "Closure module or Node executable changed during observation");
  const entries = state.requirement.entries.map((definition, moduleIndex) => {
    const moduleRef = state.moduleRefs[moduleIndex]!;
    const occurrences = ([0, 1] as const).map((occurrenceIndex) => {
      const requiredExports = definition.requiredExports.map((entry) => ({ name: entry.name, kind: entry.kind })) as PlatformReleaseRequiredModuleClosureProbeExportV2[];
      const observedExports = [...occurrenceRows[occurrenceIndex]![moduleIndex]!.observedExports];
      const requiredExportSetHash = hashPlatformReleaseRequiredModuleClosureProbeExportSetV2(requiredExports);
      const observedExportSetHash = hashPlatformReleaseRequiredModuleClosureProbeExportSetV2(observedExports);
      const observedExportKindSetHash = hashPlatformReleaseRequiredModuleClosureProbeExportKindSetV2(observedExports);
      const semanticProjectionHash = hashPlatformReleaseRequiredModuleClosureProbeProjectionV2({ moduleRefHash: moduleRef.moduleRefHash, requiredExportSetHash, observedExportSetHash, observedExportKindSetHash, semanticOutcome: "required_exports_loaded" });
      const identity = { occurrenceRef: OCCURRENCE_NAMES_V2[occurrenceIndex]!, moduleRef, moduleObservation: observationsBefore[occurrenceIndex]![moduleIndex]!, requiredExports, requiredExportSetHash, observedExports, observedExportSetHash, observedExportKindSetHash, semanticOutcome: "required_exports_loaded" as const, semanticProjectionHash, process: occurrenceRows[occurrenceIndex]![moduleIndex]!.process };
      return { ...identity, occurrenceHash: hashPlatformReleaseRequiredModuleClosureProbeOccurrenceV2(identity) };
    });
    const identity = { role: definition.role, sourceModuleLocator: definition.sourceModuleLocator, implementationUse: definition.implementationUse, verificationPolicy: definition.verificationPolicy, moduleRef, occurrences: [occurrences[0]!, occurrences[1]!] as const };
    return { ...identity, entryHash: hashPlatformReleaseRequiredModuleClosureProbeEntryV2(identity) };
  });
  const identity = { schema: PLATFORM_RELEASE_BOOTSTRAP_REQUIRED_MODULE_CLOSURE_PROBE_V2_SCHEMA, version: "2.0.0" as const, authorityState: "observed_test_fixture_unverified" as const, admissionScope: "test_fixture" as const, productionAuthority: false as const, productionAdmission: "forbidden" as const, credentialUse: "none" as const, mutationAuthority: false as const, trustConclusion: "characterization_only" as const, implementationScope: PLATFORM_RELEASE_BOOTSTRAP_REQUIRED_MODULE_CLOSURE_PROBE_IMPLEMENTATION_SCOPE_V2, payloadBinding: PLATFORM_RELEASE_BOOTSTRAP_REQUIRED_MODULE_CLOSURE_PROBE_PAYLOAD_BINDING_V2, hostIdentityHash: state.hostIdentityHash, challengeHash: sha256BytesV2(challenge), requiredModuleClosure: state.requirement, catalogHash: state.catalogHash, observationOutcome: "all_required_exports_loaded" as const, entries, };
  const observationHash = hashPlatformReleaseRequiredModuleClosureProbeObservationV2(identity);
  const withObservation = { ...identity, observationHash };
  return parsePlatformReleaseRequiredModuleClosureProbeCandidateV2({ ...withObservation, probeHash: hashPlatformReleaseRequiredModuleClosureProbeV2(withObservation) });
}
