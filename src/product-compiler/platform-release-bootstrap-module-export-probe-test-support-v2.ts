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
  PLATFORM_RELEASE_BOOTSTRAP_MODULE_EXPORT_PROBE_ENVIRONMENT_POLICY_V2,
  PLATFORM_RELEASE_BOOTSTRAP_MODULE_EXPORT_PROBE_MAX_MODULE_BYTES_V2,
  PLATFORM_RELEASE_BOOTSTRAP_MODULE_EXPORT_PROBE_MAX_OUTPUT_BYTES_V2,
  PLATFORM_RELEASE_BOOTSTRAP_MODULE_EXPORT_PROBE_OPERATION_ABI_HASH_V2,
  PLATFORM_RELEASE_BOOTSTRAP_MODULE_EXPORT_PROBE_OPERATION_ABI_REF_V2,
  PLATFORM_RELEASE_BOOTSTRAP_MODULE_EXPORT_PROBE_TIMEOUT_MS_V2,
  PLATFORM_RELEASE_BOOTSTRAP_MODULE_EXPORT_PROBE_V2_SCHEMA,
  hashPlatformReleaseBootstrapModuleExportProbeExportKindSetV2,
  hashPlatformReleaseBootstrapModuleExportProbeExportSetV2,
  hashPlatformReleaseBootstrapModuleExportProbeModuleObservationV2,
  hashPlatformReleaseBootstrapModuleExportProbeOccurrenceV2,
  hashPlatformReleaseBootstrapModuleExportProbeProcessOccurrenceV2,
  hashPlatformReleaseBootstrapModuleExportProbeStableProjectionV2,
  parsePlatformReleaseBootstrapModuleExportProbeCandidateV2,
  type PlatformReleaseBootstrapModuleExportProbeExportV2,
  type PlatformReleaseBootstrapModuleExportProbeOccurrenceV2,
  type PlatformReleaseBootstrapModuleExportProbeV2,
  type PlatformReleaseBootstrapModuleExportProbeProcessEvidenceV2,
} from "../execution/schemas/platform-release-bootstrap-module-export-probe-v2.js";
import {
  PLATFORM_RELEASE_MODULE_REF_V2_SCHEMA,
  hashPlatformReleaseModuleRefV2,
  type PlatformReleaseModuleRefV2,
} from "../execution/schemas/platform-release-module-catalogs-v2.js";
import { deepFreezePlatformReleaseJsonV2 } from "../execution/schemas/platform-release-common-v2.js";

const ROOT_PREFIX_V2 = "setfarm-module-export-probe-v2-";
const MODULE_LOCATOR_V2 = "dist/execution/network-sandbox-v2.js" as const;
const PAYLOAD_LOCATOR_V2 = "payload/dist/execution/network-sandbox-v2.js" as const;
const MODULE_BASENAME_V2 = "network-sandbox-v2.js";
const OCCURRENCE_NAMES_V2 = ["first", "second"] as const;
const REQUIRED_EXPORTS_V2 = Object.freeze([
  {
    name: "acquireNetworkSandboxLaunchContextInternalV2",
    kind: "function",
  },
  {
    name: "runNetworkIsolatedV2",
    kind: "function",
  },
] as const satisfies readonly PlatformReleaseBootstrapModuleExportProbeExportV2[]);
const MODULE_SOURCE_V2 = [
  "export function acquireNetworkSandboxLaunchContextInternalV2() { return null; }",
  "export function runNetworkIsolatedV2() { return null; }",
  "",
].join("\n");
const MODULE_BYTES_V2 = Buffer.from(MODULE_SOURCE_V2, "utf8");
const MODULE_CONTENT_HASH_V2 = sha256BytesV2(MODULE_BYTES_V2);
const REQUIRED_EXPORT_SET_HASH_V2 =
  hashPlatformReleaseBootstrapModuleExportProbeExportSetV2(
    REQUIRED_EXPORTS_V2,
  );
const HOST_IDENTITY_HASH_V2 = hashCanonicalJson({
  schema:
    "setfarm.platform-release-bootstrap-module-export-probe-test-host-identity.v2",
  platform: "darwin",
  authority: "test_fixture_only",
});
const HOST_COMPOSITION_RECEIPT_HASH_V2 = hashCanonicalJson({
  schema:
    "setfarm.platform-release-bootstrap-module-export-probe-test-host-composition-receipt.v2",
  operationAbiRef: PLATFORM_RELEASE_BOOTSTRAP_MODULE_EXPORT_PROBE_OPERATION_ABI_REF_V2,
  operationAbiHash: PLATFORM_RELEASE_BOOTSTRAP_MODULE_EXPORT_PROBE_OPERATION_ABI_HASH_V2,
  admissionScope: "test_fixture",
});
const PROBE_PROGRAM_SOURCE_V2 = String.raw`
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const input = JSON.parse(readFileSync(3, "utf8"));
if (
  input === null
  || typeof input !== "object"
  || Array.isArray(input)
  || Object.keys(input).sort().join(",") !== "modulePath"
  || typeof input.modulePath !== "string"
  || input.modulePath.length < 1
) {
  throw new Error("MODULE_EXPORT_PROBE_INPUT_INVALID");
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
const TEST_PROCESS_MARKER_V2 = "SETFARM_MODULE_EXPORT_PROBE_RUNNER_FAULT_V2";

export type PlatformReleaseBootstrapModuleExportProbeFixtureV2 = Readonly<{
  dispose(): void;
}>;

export type PlatformReleaseBootstrapModuleExportProbeFixtureMutationV2 =
  | "replace_first_same_bytes"
  | "replace_first_different_bytes"
  | "append_extra_export"
  | "add_root_entry_over_limit";

export type PlatformReleaseBootstrapModuleExportProbeErrorCodeV2 =
  | "MODULE_EXPORT_PROBE_PLATFORM_UNAVAILABLE"
  | "MODULE_EXPORT_PROBE_FIXTURE_BUILD_FAILED"
  | "MODULE_EXPORT_PROBE_FIXTURE_HANDLE_UNAUTHENTICATED"
  | "MODULE_EXPORT_PROBE_FILESYSTEM_DRIFT"
  | "MODULE_EXPORT_PROBE_EXECUTABLE_DRIFT"
  | "MODULE_EXPORT_PROBE_SPAWN_FAILED"
  | "MODULE_EXPORT_PROBE_TIMEOUT"
  | "MODULE_EXPORT_PROBE_OUTPUT_LIMIT"
  | "MODULE_EXPORT_PROBE_PROCESS_FAILED"
  | "MODULE_EXPORT_PROBE_OUTPUT_INVALID"
  | "MODULE_EXPORT_PROBE_RECEIPT_INVALID";

export class PlatformReleaseBootstrapModuleExportProbeErrorV2
  extends Error {
  constructor(
    readonly code: PlatformReleaseBootstrapModuleExportProbeErrorCodeV2,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message.slice(0, 1_500), options);
    this.name = "PlatformReleaseBootstrapModuleExportProbeErrorV2";
  }
}

type DirectoryCaptureFaultForTestV2 =
  | "directory_read_failure"
  | "directory_close_failure"
  | "directory_read_and_close_failure";

type ModuleCaptureFaultForTestV2 =
  | "module_read_and_close_failure"
  | "module_close_failure";

type ProbeRunnerFaultForTestV2 =
  | "stdout_stream_error"
  | "stderr_stream_error"
  | "direct_kill_failure"
  | "close_suppressed";

type ModuleExportProbeFaultForTestV2 =
  | DirectoryCaptureFaultForTestV2
  | ModuleCaptureFaultForTestV2
  | ProbeRunnerFaultForTestV2;

const MODULE_EXPORT_PROBE_FAULTS_FOR_TEST_V2 = Object.freeze([
  "directory_read_failure",
  "directory_close_failure",
  "directory_read_and_close_failure",
  "module_read_and_close_failure",
  "module_close_failure",
  "stdout_stream_error",
  "stderr_stream_error",
  "direct_kill_failure",
  "close_suppressed",
] as const satisfies readonly ModuleExportProbeFaultForTestV2[]);

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

type ModuleStableIdentityV2 = Readonly<{
  hostIdentityHash: string;
  objectKind: "ordinary_file";
  device: string;
  inode: string;
}>;

type ModuleMutableFingerprintV2 = Readonly<{
  ownerUid: number;
  ownerGid: number;
  mode: string;
  linkCount: 1;
  byteLength: number;
  contentHash: string;
  modifiedTimeNanoseconds: string;
  changedTimeNanoseconds: string;
}>;

type ModuleObservationV2 = Readonly<{
  stableIdentity: ModuleStableIdentityV2;
  mutableFingerprint: ModuleMutableFingerprintV2;
  observationHash: string;
}>;

type FixtureStateV2 = Readonly<{
  alias: string;
  root: string;
  modulePaths: readonly [string, string];
  rootIdentity: Readonly<{ device: string; inode: string }>;
  directoryIdentities: readonly [
    Readonly<{ device: string; inode: string }>,
    Readonly<{ device: string; inode: string }>,
  ];
  moduleStableIdentities: readonly [ModuleStableIdentityV2, ModuleStableIdentityV2];
  moduleRef: PlatformReleaseModuleRefV2;
  requiredExports: readonly PlatformReleaseBootstrapModuleExportProbeExportV2[];
  requiredExportSetHash: string;
  hostIdentityHash: string;
  hostCompositionReceiptHash: string;
}>;

const fixtureStatesV2 = new WeakMap<object, FixtureStateV2>();

function failV2(
  code: PlatformReleaseBootstrapModuleExportProbeErrorCodeV2,
  message: string,
  cause?: unknown,
): never {
  throw new PlatformReleaseBootstrapModuleExportProbeErrorV2(
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
  return Object.freeze({
    device: stat.dev.toString(10),
    inode: stat.ino.toString(10),
  });
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

function directoryCaptureErrorV2(
  error: unknown,
  code: PlatformReleaseBootstrapModuleExportProbeErrorCodeV2,
  message: string,
): PlatformReleaseBootstrapModuleExportProbeErrorV2 {
  return error instanceof PlatformReleaseBootstrapModuleExportProbeErrorV2
    ? error
    : new PlatformReleaseBootstrapModuleExportProbeErrorV2(
      code,
      message,
      { cause: error },
    );
}

function primaryFirstDirectoryFailureV2(
  primary: PlatformReleaseBootstrapModuleExportProbeErrorV2 | undefined,
  closeFailure: PlatformReleaseBootstrapModuleExportProbeErrorV2 | undefined,
  message: string,
): void {
  if (primary !== undefined && closeFailure !== undefined) {
    const aggregate = new AggregateError(
      [primary, closeFailure],
      message,
      { cause: primary },
    );
    throw new PlatformReleaseBootstrapModuleExportProbeErrorV2(
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
    errorCode: PlatformReleaseBootstrapModuleExportProbeErrorCodeV2;
    label: string;
    maximumNames: number;
    exactNames: readonly string[];
    expectedIdentity: Readonly<{ device: string; inode: string }>;
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
      || !sameIdentityV2(statIdentityV2(before), options.expectedIdentity)
      || typeof process.getuid === "function"
        && Number(before.uid) !== process.getuid()
      || typeof process.getgid === "function"
        && Number(before.gid) !== process.getgid()
    ) {
      return failV2(
        options.errorCode,
        `${options.label} failed directory admission`,
      );
    }
  } catch (error) {
    throw directoryCaptureErrorV2(
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
  let primary: PlatformReleaseBootstrapModuleExportProbeErrorV2 | undefined;
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
        throw new Error("Injected module export directory read failure");
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
    primary = directoryCaptureErrorV2(
      error,
      options.errorCode,
      `${options.label} membership could not be captured`,
    );
  }

  let closeFailure:
    PlatformReleaseBootstrapModuleExportProbeErrorV2
    | undefined;
  if (directory !== undefined) {
    try {
      directory.closeSync();
      if (
        options.faultForTest === "directory_close_failure"
        || options.faultForTest === "directory_read_and_close_failure"
      ) {
        throw new Error("Injected module export directory close failure");
      }
    } catch (error) {
      closeFailure = directoryCaptureErrorV2(
        error,
        options.errorCode,
        `${options.label} descriptor could not be closed`,
      );
    }
  }
  primaryFirstDirectoryFailureV2(
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
    throw directoryCaptureErrorV2(
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

function exactPrivateRootV2(): Readonly<{ alias: string; root: string }> {
  const alias = mkdtempSync(path.join(os.tmpdir(), ROOT_PREFIX_V2));
  const root = realpathSync(alias);
  chmodSync(root, 0o700);
  const stat = lstatSync(root, { bigint: true }) as BigIntStatV2;
  const ownerMatches =
    (typeof process.getuid !== "function" || Number(stat.uid) === process.getuid())
    && (typeof process.getgid !== "function" || Number(stat.gid) === process.getgid());
  if (
    stat.isSymbolicLink()
    || !stat.isDirectory()
    || modeTextV2(stat) !== "0700"
    || !ownerMatches
  ) {
    rmSync(alias, { recursive: true, force: true });
    return failV2(
      "MODULE_EXPORT_PROBE_FIXTURE_BUILD_FAILED",
      "Module export probe root must be one private process-owned directory",
    );
  }
  return Object.freeze({ alias, root });
}

function captureModuleV2(
  absolutePath: string,
  expectedHostIdentityHash: string,
  expectedMode: "0444" | "any" = "0444",
  faultForTest?: ModuleCaptureFaultForTestV2,
): ModuleObservationV2 {
  let descriptor = -1;
  let bytes: Buffer | undefined;
  let eofProbe: Buffer | undefined;
  let result: ModuleObservationV2 | undefined;
  let primary:
    PlatformReleaseBootstrapModuleExportProbeErrorV2
    | undefined;
  try {
    const pathBefore = lstatSync(absolutePath, { bigint: true }) as BigIntStatV2;
    if (
      pathBefore.isSymbolicLink()
      || !pathBefore.isFile()
      || pathBefore.nlink !== 1n
      || (expectedMode !== "any" && modeTextV2(pathBefore) !== expectedMode)
      || pathBefore.size <= 0n
      || pathBefore.size > BigInt(PLATFORM_RELEASE_BOOTSTRAP_MODULE_EXPORT_PROBE_MAX_MODULE_BYTES_V2)
    ) {
      return failV2(
        "MODULE_EXPORT_PROBE_FILESYSTEM_DRIFT",
        "Module fixture is not one bounded single-link 0444 regular file",
      );
    }
    descriptor = openSync(
      absolutePath,
      fsConstants.O_RDONLY
        | (fsConstants.O_NOFOLLOW ?? 0)
        | ((fsConstants as unknown as Record<string, number>).O_CLOEXEC ?? 0),
    );
    const descriptorBefore = fstatSync(descriptor, { bigint: true }) as BigIntStatV2;
    if (!sameIdentityV2(statIdentityV2(pathBefore), statIdentityV2(descriptorBefore))) {
      return failV2(
        "MODULE_EXPORT_PROBE_FILESYSTEM_DRIFT",
        "Module changed between path and descriptor admission",
      );
    }
    const expectedByteLength = Number(descriptorBefore.size);
    bytes = Buffer.alloc(expectedByteLength);
    let offset = 0;
    const digest = createHash("sha256");
    while (offset < expectedByteLength) {
      if (faultForTest === "module_read_and_close_failure") {
        throw new Error("Injected module descriptor read failure");
      }
      const count = readSync(descriptor, bytes, offset, expectedByteLength - offset, offset);
      if (count <= 0) {
        bytes.fill(0);
        return failV2(
          "MODULE_EXPORT_PROBE_FILESYSTEM_DRIFT",
          "Module reached EOF before its descriptor-bounded byte length",
        );
      }
      digest.update(bytes.subarray(offset, offset + count));
      offset += count;
    }
    eofProbe = Buffer.alloc(1);
    if (readSync(descriptor, eofProbe, 0, 1, expectedByteLength) !== 0) {
      bytes.fill(0);
      eofProbe.fill(0);
      return failV2(
        "MODULE_EXPORT_PROBE_FILESYSTEM_DRIFT",
        "Module grew beyond its descriptor-bounded byte length",
      );
    }
    const descriptorAfter = fstatSync(descriptor, { bigint: true }) as BigIntStatV2;
    const pathAfter = lstatSync(absolutePath, { bigint: true }) as BigIntStatV2;
    if (
      !sameIdentityV2(statIdentityV2(descriptorBefore), statIdentityV2(descriptorAfter))
      || (expectedMode !== "any" && modeTextV2(descriptorBefore) !== expectedMode)
      || modeTextV2(descriptorBefore) !== modeTextV2(descriptorAfter)
      || descriptorBefore.uid !== descriptorAfter.uid
      || descriptorBefore.gid !== descriptorAfter.gid
      || descriptorBefore.nlink !== descriptorAfter.nlink
      || descriptorBefore.size !== descriptorAfter.size
      || descriptorBefore.mtimeNs !== descriptorAfter.mtimeNs
      || descriptorBefore.ctimeNs !== descriptorAfter.ctimeNs
      || !sameIdentityV2(statIdentityV2(descriptorAfter), statIdentityV2(pathAfter))
    ) {
      return failV2(
        "MODULE_EXPORT_PROBE_FILESYSTEM_DRIFT",
        "Module changed during descriptor-bounded observation",
      );
    }
    const stableIdentity: ModuleStableIdentityV2 = Object.freeze({
      hostIdentityHash: expectedHostIdentityHash,
      objectKind: "ordinary_file",
      device: descriptorAfter.dev.toString(10),
      inode: descriptorAfter.ino.toString(10),
    });
    const mutableFingerprint: ModuleMutableFingerprintV2 = Object.freeze({
      ownerUid: Number(descriptorAfter.uid),
      ownerGid: Number(descriptorAfter.gid),
      mode: modeTextV2(descriptorAfter),
      linkCount: 1,
      byteLength: Number(descriptorAfter.size),
      contentHash: digest.digest("hex"),
      modifiedTimeNanoseconds: descriptorAfter.mtimeNs.toString(10),
      changedTimeNanoseconds: descriptorAfter.ctimeNs.toString(10),
    });
    result = Object.freeze({
      stableIdentity,
      mutableFingerprint,
      observationHash: hashPlatformReleaseBootstrapModuleExportProbeModuleObservationV2({
        stableIdentity,
        mutableFingerprint,
      }),
    });
  } catch (error) {
    primary = directoryCaptureErrorV2(
      error,
      "MODULE_EXPORT_PROBE_FILESYSTEM_DRIFT",
      "Module could not be captured through one bounded descriptor",
    );
  }
  bytes?.fill(0);
  eofProbe?.fill(0);

  let closeFailure:
    PlatformReleaseBootstrapModuleExportProbeErrorV2
    | undefined;
  if (descriptor >= 0) {
    const descriptorToClose = descriptor;
    descriptor = -1;
    try {
      closeSync(descriptorToClose);
      if (
        faultForTest === "module_close_failure"
        || faultForTest === "module_read_and_close_failure"
      ) {
        throw new Error("Injected module descriptor close failure");
      }
    } catch (error) {
      closeFailure = directoryCaptureErrorV2(
        error,
        "MODULE_EXPORT_PROBE_FILESYSTEM_DRIFT",
        `Module descriptor could not be closed: ${absolutePath}`,
      );
    }
  }
  primaryFirstDirectoryFailureV2(
    primary,
    closeFailure,
    "Module capture and descriptor close both failed",
  );
  if (result === undefined) {
    return failV2(
      "MODULE_EXPORT_PROBE_FILESYSTEM_DRIFT",
      "Module descriptor capture did not produce a result",
    );
  }
  return result;
}

function assertFixtureLayoutV2(
  state: FixtureStateV2,
  faultForTest?: DirectoryCaptureFaultForTestV2,
): void {
  captureDirectoryV2(state.root, {
    errorCode: "MODULE_EXPORT_PROBE_FIXTURE_HANDLE_UNAUTHENTICATED",
    label: "Module export probe root",
    maximumNames: OCCURRENCE_NAMES_V2.length,
    exactNames: OCCURRENCE_NAMES_V2,
    expectedIdentity: state.rootIdentity,
    faultForTest,
  });
  for (const [index, modulePath] of state.modulePaths.entries()) {
    if (path.basename(modulePath) !== MODULE_BASENAME_V2) {
      return failV2(
        "MODULE_EXPORT_PROBE_FIXTURE_HANDLE_UNAUTHENTICATED",
        "Module export probe occurrence path has an unexpected basename",
      );
    }
    captureDirectoryV2(path.dirname(modulePath), {
      errorCode: "MODULE_EXPORT_PROBE_FIXTURE_HANDLE_UNAUTHENTICATED",
      label: `Module export probe occurrence ${index + 1} root`,
      maximumNames: 1,
      exactNames: [MODULE_BASENAME_V2],
      expectedIdentity: state.directoryIdentities[index]!,
    });
  }
}

function authenticFixtureStateV2(
  fixture: PlatformReleaseBootstrapModuleExportProbeFixtureV2,
  faultForTest?: DirectoryCaptureFaultForTestV2,
): FixtureStateV2 {
  if (
    typeof fixture !== "object"
    || fixture === null
    || isProxy(fixture)
  ) {
    return failV2(
      "MODULE_EXPORT_PROBE_FIXTURE_HANDLE_UNAUTHENTICATED",
      "Module export probe requires one authentic fixture handle",
    );
  }
  const state = fixtureStatesV2.get(fixture);
  if (state === undefined) {
    return failV2(
      "MODULE_EXPORT_PROBE_FIXTURE_HANDLE_UNAUTHENTICATED",
      "Module export probe fixture handle is not code-owned",
    );
  }
  assertFixtureLayoutV2(state, faultForTest);
  return state;
}

function captureNodeExecutableV2(): Readonly<{
  contentHash: string;
  stableIdentity: ModuleStableIdentityV2;
  mutableFingerprint: ModuleMutableFingerprintV2;
}> {
  const executable = realpathSync(process.execPath);
  const observation = captureModuleV2(executable, HOST_IDENTITY_HASH_V2, "any");
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
  primary: PlatformReleaseBootstrapModuleExportProbeErrorV2,
  secondary: readonly PlatformReleaseBootstrapModuleExportProbeErrorV2[],
  message: string,
): PlatformReleaseBootstrapModuleExportProbeErrorV2 {
  if (secondary.length === 0) return primary;
  const aggregate = new AggregateError(
    [primary, ...secondary],
    message,
    { cause: primary },
  );
  return new PlatformReleaseBootstrapModuleExportProbeErrorV2(
    primary.code,
    message,
    { cause: aggregate },
  );
}

function runBoundedProbeV2(
  input: Readonly<{ modulePath: string; cwd: string; argvHash: string }>,
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
      PlatformReleaseBootstrapModuleExportProbeErrorV2[] = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let status: ProbeResultV2["status"] = "exited";
    let primaryFailure:
      PlatformReleaseBootstrapModuleExportProbeErrorV2
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
      fallback: PlatformReleaseBootstrapModuleExportProbeErrorV2,
    ): void => {
      const primary = primaryFailure ?? fallback;
      zeroChunks();
      reject(primaryFirstProbeFailureV2(
        primary,
        secondaryFailures,
        "Module export probe and direct-child containment both failed",
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
      child = spawn(
        process.execPath,
        argv,
        {
          cwd: input.cwd,
          detached: false,
          env: {},
          shell: false,
          stdio: ["ignore", "pipe", "pipe", "pipe"],
        },
      );
    } catch (error) {
      resolve(Object.freeze({
        status: "spawn_failed",
        exitCode: null,
        signal: null,
        pid: -1,
        stdout: Buffer.alloc(0),
        stderr: Buffer.from(String(error), "utf8").subarray(
          0,
          PLATFORM_RELEASE_BOOTSTRAP_MODULE_EXPORT_PROBE_MAX_OUTPUT_BYTES_V2,
        ),
        startedAt,
        finishedAt: Date.now(),
      }));
      return;
    }

    const recordSecondaryFailure = (message: string, cause?: unknown): void => {
      secondaryFailures.push(new PlatformReleaseBootstrapModuleExportProbeErrorV2(
        "MODULE_EXPORT_PROBE_PROCESS_FAILED",
        message,
        cause === undefined ? undefined : { cause },
      ));
    };
    const signalDirectChild = (force: boolean): boolean => {
      if (faultForTest === "direct_kill_failure" && !force) {
        recordSecondaryFailure(
          "Injected module export probe direct-child termination failure",
        );
        return false;
      }
      try {
        const signaled = child.kill("SIGKILL");
        if (!signaled) {
          recordSecondaryFailure(
            "Module export probe direct-child termination returned false",
          );
        }
        return signaled;
      } catch (error) {
        recordSecondaryFailure(
          "Module export probe direct-child termination threw",
          error,
        );
        return false;
      }
    };
    const settleWatchdog = (): void => {
      if (settled) return;
      secondaryFailures.push(new PlatformReleaseBootstrapModuleExportProbeErrorV2(
        "MODULE_EXPORT_PROBE_PROCESS_FAILED",
        "Module export probe did not settle after direct-child termination",
      ));
      signalDirectChild(true);
      settled = true;
      clearTimers();
      rejectFailure(new PlatformReleaseBootstrapModuleExportProbeErrorV2(
        "MODULE_EXPORT_PROBE_PROCESS_FAILED",
        "Module export probe settlement was not proven",
      ));
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
      error: PlatformReleaseBootstrapModuleExportProbeErrorV2,
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
        > PLATFORM_RELEASE_BOOTSTRAP_MODULE_EXPORT_PROBE_MAX_OUTPUT_BYTES_V2
      ) {
        outputLimitLatched = true;
        latchPrimaryFailure(
          new PlatformReleaseBootstrapModuleExportProbeErrorV2(
            "MODULE_EXPORT_PROBE_OUTPUT_LIMIT",
            `Module export probe exceeded bounded ${stream} capture`,
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
        new PlatformReleaseBootstrapModuleExportProbeErrorV2(
          "MODULE_EXPORT_PROBE_PROCESS_FAILED",
          `Module export probe ${stream} stream failed`,
          { cause: error },
        ),
        "spawn_failed",
        true,
      );
    };

    child.once("error", (error) => {
      latchPrimaryFailure(
        new PlatformReleaseBootstrapModuleExportProbeErrorV2(
          "MODULE_EXPORT_PROBE_SPAWN_FAILED",
          "Module export probe could not start",
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
        new PlatformReleaseBootstrapModuleExportProbeErrorV2(
          "MODULE_EXPORT_PROBE_SPAWN_FAILED",
          "Module export probe did not expose its fixed output streams",
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
            "Injected module export probe stdout stream failure",
          ));
        });
      }
      if (faultForTest === "stderr_stream_error") {
        queueMicrotask(() => {
          child.stderr?.destroy(new Error(
            "Injected module export probe stderr stream failure",
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
        new PlatformReleaseBootstrapModuleExportProbeErrorV2(
          "MODULE_EXPORT_PROBE_SPAWN_FAILED",
          "Module export probe did not expose its fixed input stream",
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
      ? PLATFORM_RELEASE_BOOTSTRAP_MODULE_EXPORT_PROBE_TIMEOUT_MS_V2
      : TEST_PROCESS_TIMEOUT_MILLISECONDS_V2;
    executionTimer = setTimeout(() => {
      latchPrimaryFailure(
        new PlatformReleaseBootstrapModuleExportProbeErrorV2(
          "MODULE_EXPORT_PROBE_TIMEOUT",
          `Module export probe timed out after ${executionMilliseconds}ms`,
        ),
        "timed_out",
        false,
      );
    }, executionMilliseconds);
  });
}

function parseChildExportsV2(stdout: Buffer): readonly PlatformReleaseBootstrapModuleExportProbeExportV2[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout.toString("utf8"));
  } catch (error) {
    return failV2(
      "MODULE_EXPORT_PROBE_OUTPUT_INVALID",
      "Module export child did not emit canonical JSON",
      error,
    );
  }
  if (
    parsed === null
    || typeof parsed !== "object"
    || Array.isArray(parsed)
    || Object.keys(parsed).length !== 1
    || !Array.isArray((parsed as { exports?: unknown }).exports)
  ) {
    return failV2(
      "MODULE_EXPORT_PROBE_OUTPUT_INVALID",
      "Module export child changed its exact output shape",
    );
  }
  const exports = (parsed as { exports: unknown[] }).exports;
  const normalized = exports.map((entry) => {
    if (
      entry === null
      || typeof entry !== "object"
      || Array.isArray(entry)
      || Object.keys(entry).sort().join(",") !== "kind,name"
      || typeof (entry as { name?: unknown }).name !== "string"
      || typeof (entry as { kind?: unknown }).kind !== "string"
    ) {
      return failV2(
        "MODULE_EXPORT_PROBE_OUTPUT_INVALID",
        "Module export child returned one invalid export identity",
      );
    }
    const kind = (entry as { kind: string }).kind;
    if (![
      "function",
      "string",
      "number",
      "boolean",
      "object",
      "undefined",
      "symbol",
      "bigint",
    ].includes(kind)) {
      return failV2(
        "MODULE_EXPORT_PROBE_OUTPUT_INVALID",
        "Module export child returned one invalid export kind",
      );
    }
    return {
      name: (entry as { name: string }).name,
      kind: kind as PlatformReleaseBootstrapModuleExportProbeExportV2["kind"],
    };
  });
  for (let index = 1; index < normalized.length; index += 1) {
    if (normalized[index - 1]!.name >= normalized[index]!.name) {
      return failV2(
        "MODULE_EXPORT_PROBE_OUTPUT_INVALID",
        "Module export child names are not strictly sorted",
      );
    }
  }
  return Object.freeze(normalized);
}

function moduleRefV2(): PlatformReleaseModuleRefV2 {
  const identity = {
    schema: PLATFORM_RELEASE_MODULE_REF_V2_SCHEMA,
    moduleLocator: MODULE_LOCATOR_V2,
    payloadLocator: PAYLOAD_LOCATOR_V2,
    mediaType: "text/javascript" as const,
    contentHash: MODULE_CONTENT_HASH_V2,
    byteLength: MODULE_BYTES_V2.byteLength,
    mode: "0444" as const,
  };
  return Object.freeze({
    ...identity,
    moduleRefHash: hashPlatformReleaseModuleRefV2(identity),
  });
}

export function buildPlatformReleaseBootstrapModuleExportProbeFixtureForTestV2(): PlatformReleaseBootstrapModuleExportProbeFixtureV2 {
  if (process.platform !== "darwin") {
    return failV2(
      "MODULE_EXPORT_PROBE_PLATFORM_UNAVAILABLE",
      "Module export probe fixture requires Darwin",
    );
  }
  const privateRoot = exactPrivateRootV2();
  try {
    const modulePaths = OCCURRENCE_NAMES_V2.map((name) => {
      const occurrenceRoot = path.join(privateRoot.root, name);
      mkdirSync(occurrenceRoot, { mode: 0o700 });
      chmodSync(occurrenceRoot, 0o700);
      const modulePath = path.join(occurrenceRoot, MODULE_BASENAME_V2);
      writeFileSync(modulePath, MODULE_BYTES_V2, { mode: 0o444 });
      chmodSync(modulePath, 0o444);
      return modulePath;
    }) as [string, string];
    const root = lstatSync(privateRoot.root, { bigint: true }) as BigIntStatV2;
    const directories = modulePaths.map(
      (modulePath) => lstatSync(path.dirname(modulePath), { bigint: true }) as BigIntStatV2,
    ) as [BigIntStatV2, BigIntStatV2];
    const initialObservations = modulePaths.map((modulePath) =>
      captureModuleV2(modulePath, HOST_IDENTITY_HASH_V2),
    ) as [ModuleObservationV2, ModuleObservationV2];
    const moduleRef = moduleRefV2();
    if (initialObservations.some((observation) =>
      observation.mutableFingerprint.contentHash !== moduleRef.contentHash
      || observation.mutableFingerprint.byteLength !== moduleRef.byteLength
      || observation.mutableFingerprint.mode !== moduleRef.mode
    )) {
      return failV2(
        "MODULE_EXPORT_PROBE_FIXTURE_BUILD_FAILED",
        "Module fixture bytes did not match its code-owned module ref",
      );
    }
    const state: FixtureStateV2 = Object.freeze({
      alias: privateRoot.alias,
      root: privateRoot.root,
      modulePaths,
      rootIdentity: statIdentityV2(root),
      directoryIdentities: [
        statIdentityV2(directories[0]!),
        statIdentityV2(directories[1]!),
      ] as FixtureStateV2["directoryIdentities"],
      moduleStableIdentities: [
        initialObservations[0]!.stableIdentity,
        initialObservations[1]!.stableIdentity,
      ] as FixtureStateV2["moduleStableIdentities"],
      moduleRef,
      requiredExports: REQUIRED_EXPORTS_V2,
      requiredExportSetHash: REQUIRED_EXPORT_SET_HASH_V2,
      hostIdentityHash: HOST_IDENTITY_HASH_V2,
      hostCompositionReceiptHash: HOST_COMPOSITION_RECEIPT_HASH_V2,
    });
    let fixture: PlatformReleaseBootstrapModuleExportProbeFixtureV2;
    fixture = Object.freeze({
      dispose(): void {
        fixtureStatesV2.delete(fixture);
        rmSync(privateRoot.alias, { recursive: true, force: true });
      },
    });
    fixtureStatesV2.set(fixture, state);
    return fixture;
  } catch (error) {
    rmSync(privateRoot.alias, { recursive: true, force: true });
    return failV2(
      "MODULE_EXPORT_PROBE_FIXTURE_BUILD_FAILED",
      "Could not create the private module export fixture",
      error,
    );
  }
}

export function mutatePlatformReleaseBootstrapModuleExportProbeFixtureForTestV2(
  fixture: PlatformReleaseBootstrapModuleExportProbeFixtureV2,
  mutation: PlatformReleaseBootstrapModuleExportProbeFixtureMutationV2,
): void {
  const state = authenticFixtureStateV2(fixture);
  const firstPath = state.modulePaths[0]!;
  if (mutation === "add_root_entry_over_limit") {
    writeFileSync(
      path.join(state.root, "overflow-entry-v2"),
      "bounded membership overflow\n",
      { flag: "wx", mode: 0o400 },
    );
    return;
  }
  if (mutation === "append_extra_export") {
    chmodSync(firstPath, 0o644);
    writeFileSync(
      firstPath,
      Buffer.concat([
        MODULE_BYTES_V2,
        Buffer.from("export const attackerExtraV2 = true;\n", "utf8"),
      ]),
      { mode: 0o444 },
    );
    chmodSync(firstPath, 0o444);
    return;
  }
  const replacement = mutation === "replace_first_same_bytes"
    ? MODULE_BYTES_V2
    : Buffer.from(
      "export function acquireNetworkSandboxLaunchContextInternalV2() { return 'drift'; }\nexport function runNetworkIsolatedV2() { return null; }\n",
      "utf8",
    );
  unlinkSync(firstPath);
  writeFileSync(firstPath, replacement, { mode: 0o444 });
  chmodSync(firstPath, 0o444);
}

function processEvidenceV2(
  result: Awaited<ReturnType<typeof runBoundedProbeV2>>,
  nodeExecutable: Readonly<{
    contentHash: string;
    stableIdentity: Readonly<{
      hostIdentityHash: string;
      objectKind: "ordinary_file";
      device: string;
      inode: string;
    }>;
    mutableFingerprint: ModuleMutableFingerprintV2;
  }>,
  argvHash: string,
): PlatformReleaseBootstrapModuleExportProbeProcessEvidenceV2 {
  const base = {
    executableRef: "NODE_RUNTIME_V2" as const,
    executableStableIdentity: nodeExecutable.stableIdentity,
    executableMutableFingerprint: nodeExecutable.mutableFingerprint,
    executableContentHash: nodeExecutable.contentHash,
    argvHash,
    environmentPolicy:
      PLATFORM_RELEASE_BOOTSTRAP_MODULE_EXPORT_PROBE_ENVIRONMENT_POLICY_V2,
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
  return {
    ...base,
    processOccurrenceHash:
      hashPlatformReleaseBootstrapModuleExportProbeProcessOccurrenceV2(base),
  };
}

function admittedFaultForTestV2(
  value: unknown,
): ModuleExportProbeFaultForTestV2 | undefined {
  if (value === undefined) return undefined;
  if (
    typeof value !== "string"
    || !MODULE_EXPORT_PROBE_FAULTS_FOR_TEST_V2.includes(
      value as ModuleExportProbeFaultForTestV2,
    )
  ) {
    return failV2(
      "MODULE_EXPORT_PROBE_RECEIPT_INVALID",
      "Module export probe test fault is outside the fixed literal set",
    );
  }
  return value as ModuleExportProbeFaultForTestV2;
}

function isDirectoryCaptureFaultForTestV2(
  value: ModuleExportProbeFaultForTestV2 | undefined,
): value is DirectoryCaptureFaultForTestV2 {
  return value === "directory_read_failure"
    || value === "directory_close_failure"
    || value === "directory_read_and_close_failure";
}

function isModuleCaptureFaultForTestV2(
  value: ModuleExportProbeFaultForTestV2 | undefined,
): value is ModuleCaptureFaultForTestV2 {
  return value === "module_read_and_close_failure"
    || value === "module_close_failure";
}

function isProbeRunnerFaultForTestV2(
  value: ModuleExportProbeFaultForTestV2 | undefined,
): value is ProbeRunnerFaultForTestV2 {
  return value === "stdout_stream_error"
    || value === "stderr_stream_error"
    || value === "direct_kill_failure"
    || value === "close_suppressed";
}

export async function observePlatformReleaseBootstrapModuleExportProbeForTestV2(
  fixture: PlatformReleaseBootstrapModuleExportProbeFixtureV2,
  options: Readonly<{
    challenge?: Uint8Array;
    testFault?: ModuleExportProbeFaultForTestV2;
  }> = {},
): Promise<PlatformReleaseBootstrapModuleExportProbeV2> {
  if (process.platform !== "darwin") {
    return failV2(
      "MODULE_EXPORT_PROBE_PLATFORM_UNAVAILABLE",
      "Module export probe requires Darwin",
    );
  }
  if (
    options === null
    || typeof options !== "object"
    || isProxy(options)
    || Object.keys(options).some((key) =>
      key !== "challenge" && key !== "testFault")
  ) {
    return failV2(
      "MODULE_EXPORT_PROBE_RECEIPT_INVALID",
      "Module export probe options are outside the exact test support shape",
    );
  }
  const testFault = admittedFaultForTestV2(options.testFault);
  const state = authenticFixtureStateV2(
    fixture,
    isDirectoryCaptureFaultForTestV2(testFault) ? testFault : undefined,
  );
  const challenge = options.challenge === undefined
    ? randomBytes(32)
    : Buffer.from(options.challenge);
  if (challenge.byteLength !== 32) {
    return failV2(
      "MODULE_EXPORT_PROBE_RECEIPT_INVALID",
      "Module export probe challenge must be exactly 32 bytes",
    );
  }
  if (isModuleCaptureFaultForTestV2(testFault)) {
    captureModuleV2(
      state.modulePaths[0],
      state.hostIdentityHash,
      "0444",
      testFault,
    );
    return failV2(
      "MODULE_EXPORT_PROBE_FILESYSTEM_DRIFT",
      "Module capture fault did not fail closed",
    );
  }
  if (isProbeRunnerFaultForTestV2(testFault)) {
    await runBoundedProbeV2(
      {
        modulePath: state.modulePaths[0],
        cwd: path.dirname(state.modulePaths[0]),
        argvHash: hashCanonicalJson({
          schema:
            "setfarm.platform-release-bootstrap-module-export-probe-child-argv.v2",
          operationAbiRef: PLATFORM_RELEASE_BOOTSTRAP_MODULE_EXPORT_PROBE_OPERATION_ABI_REF_V2,
          operationAbiHash: PLATFORM_RELEASE_BOOTSTRAP_MODULE_EXPORT_PROBE_OPERATION_ABI_HASH_V2,
          argv: PROBE_ARGV_V2,
        }),
      },
      testFault,
    );
    return failV2(
      "MODULE_EXPORT_PROBE_PROCESS_FAILED",
      "Module export probe runner fault did not fail closed",
    );
  }
  const nodeBefore = captureNodeExecutableV2();
  const observationsBefore = state.modulePaths.map((modulePath) =>
    captureModuleV2(modulePath, state.hostIdentityHash),
  ) as [ModuleObservationV2, ModuleObservationV2];
  for (const [index, observation] of observationsBefore.entries()) {
    if (
      !sameIdentityV2(
        observation.stableIdentity,
        state.moduleStableIdentities[index]!,
      )
      || observation.mutableFingerprint.contentHash !== state.moduleRef.contentHash
      || observation.mutableFingerprint.byteLength !== state.moduleRef.byteLength
      || observation.mutableFingerprint.mode !== state.moduleRef.mode
    ) {
      return failV2(
        "MODULE_EXPORT_PROBE_FILESYSTEM_DRIFT",
        "Module fixture changed before module export execution",
      );
    }
  }
  const argvHash = hashCanonicalJson({
    schema:
      "setfarm.platform-release-bootstrap-module-export-probe-child-argv.v2",
    operationAbiRef: PLATFORM_RELEASE_BOOTSTRAP_MODULE_EXPORT_PROBE_OPERATION_ABI_REF_V2,
    operationAbiHash: PLATFORM_RELEASE_BOOTSTRAP_MODULE_EXPORT_PROBE_OPERATION_ABI_HASH_V2,
    argv: PROBE_ARGV_V2,
  });
  const occurrences: PlatformReleaseBootstrapModuleExportProbeOccurrenceV2[] = [];
  for (const [index, modulePath] of state.modulePaths.entries()) {
    const result = await runBoundedProbeV2({
      modulePath,
      cwd: path.dirname(modulePath),
      argvHash,
    });
    const processEvidence = processEvidenceV2(
      result,
      nodeBefore,
      argvHash,
    );
    if (
      result.status !== "exited"
      || result.exitCode !== 0
      || result.signal !== null
      || result.stderr.byteLength !== 0
    ) {
      result.stdout.fill(0);
      result.stderr.fill(0);
      return failV2(
        result.status === "timed_out"
          ? "MODULE_EXPORT_PROBE_TIMEOUT"
          : result.status === "output_limit_exceeded"
            ? "MODULE_EXPORT_PROBE_OUTPUT_LIMIT"
            : result.status === "spawn_failed"
              ? "MODULE_EXPORT_PROBE_SPAWN_FAILED"
              : "MODULE_EXPORT_PROBE_PROCESS_FAILED",
        "Module export child did not complete successfully",
      );
    }
    const observedExports = [...parseChildExportsV2(result.stdout)];
    result.stdout.fill(0);
    result.stderr.fill(0);
    const observedExportSetHash =
      hashPlatformReleaseBootstrapModuleExportProbeExportSetV2(observedExports);
    const observedExportKindSetHash =
      hashPlatformReleaseBootstrapModuleExportProbeExportKindSetV2(observedExports);
    const semanticProjectionHash =
      hashPlatformReleaseBootstrapModuleExportProbeStableProjectionV2({
        moduleRefHash: state.moduleRef.moduleRefHash,
        requiredExportSetHash: state.requiredExportSetHash,
        observedExportSetHash,
        observedExportKindSetHash,
        semanticOutcome: "required_exports_loaded",
      });
    const occurrenceIdentity = {
      occurrenceRef: OCCURRENCE_NAMES_V2[index]!,
      moduleObservation: observationsBefore[index]!,
      observedExports,
      observedExportSetHash,
      observedExportKindSetHash,
      semanticOutcome: "required_exports_loaded" as const,
      semanticProjectionHash,
      process: processEvidence,
    };
    occurrences.push({
      ...occurrenceIdentity,
      occurrenceHash:
        hashPlatformReleaseBootstrapModuleExportProbeOccurrenceV2(
          occurrenceIdentity,
        ),
    });
  }
  const observationsAfter = state.modulePaths.map((modulePath) =>
    captureModuleV2(modulePath, state.hostIdentityHash),
  ) as [ModuleObservationV2, ModuleObservationV2];
  const nodeAfter = captureNodeExecutableV2();
  if (
    canonicalJsonStringify(nodeBefore) !== canonicalJsonStringify(nodeAfter)
    || observationsBefore.some((observation, index) =>
      canonicalJsonStringify(observation) !== canonicalJsonStringify(observationsAfter[index]!)
      || !sameIdentityV2(
        observation.stableIdentity,
        state.moduleStableIdentities[index]!,
      )
    )
  ) {
    return failV2(
      "MODULE_EXPORT_PROBE_FILESYSTEM_DRIFT",
      "Module or Node executable changed during module export observation",
    );
  }
  const identity = {
    schema: PLATFORM_RELEASE_BOOTSTRAP_MODULE_EXPORT_PROBE_V2_SCHEMA,
    version: "2.0.0" as const,
    authorityState: "observed_test_fixture_unverified" as const,
    admissionScope: "test_fixture" as const,
    productionAuthority: false as const,
    productionAdmission: "forbidden" as const,
    credentialUse: "none" as const,
    mutationAuthority: false as const,
    trustConclusion: "characterization_only" as const,
    operationAbiRef: PLATFORM_RELEASE_BOOTSTRAP_MODULE_EXPORT_PROBE_OPERATION_ABI_REF_V2,
    operationAbiHash: PLATFORM_RELEASE_BOOTSTRAP_MODULE_EXPORT_PROBE_OPERATION_ABI_HASH_V2,
    hostCompositionReceiptHash: state.hostCompositionReceiptHash,
    challengeHash: sha256BytesV2(challenge),
    moduleRef: state.moduleRef,
    requiredExports: state.requiredExports,
    requiredExportSetHash: state.requiredExportSetHash,
    occurrences: [occurrences[0]!, occurrences[1]!] as const,
    stableProjectionHash: occurrences[0]!.semanticProjectionHash,
  };
  return parsePlatformReleaseBootstrapModuleExportProbeCandidateV2({
    ...identity,
    probeHash: hashCanonicalJson({
      schema: "setfarm.platform-release-bootstrap-module-export-probe-hash.v2",
      probe: identity,
    }),
  });
}
