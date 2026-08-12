import { createHash, randomBytes } from "node:crypto";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
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
  renameSync,
  rmSync,
  symlinkSync,
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
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_ENVIRONMENT_POLICY_V2,
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_EMPTY_SHA256_V2,
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_MAX_OUTPUT_BYTES_V2,
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_MAX_TOOL_BYTES_V2,
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_IMPLEMENTATION_SCOPE_V2,
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_OPERATION_ABI_HASH_V2,
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_OPERATION_ABI_REF_V2,
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_POLICY_HASH_V2,
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_PRIVATE_CWD_TOKEN_V2,
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_PRIVATE_TARGET_TOKEN_V2,
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_TIMEOUT_MS_V2,
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_V2_SCHEMA,
  hashMetadataProbeCatalogV2,
  hashMetadataProbeCommandObservationV2,
  hashMetadataProbeDirectoryEntriesV2,
  hashMetadataProbeObservationV2,
  hashMetadataProbeSnapshotV2,
  hashMetadataProbeTargetObservationV2,
  hashMetadataProbeTargetStableIdentityV2,
  hashMetadataProbeToolObservationV2,
  parsePlatformReleaseBootstrapDarwinMetadataProbeCandidateV2,
  type PlatformReleaseBootstrapDarwinMetadataProbeCommandObservationV2,
  type PlatformReleaseBootstrapDarwinMetadataProbeMetadataStateV2,
  type PlatformReleaseBootstrapDarwinMetadataProbeSnapshotV2,
  type PlatformReleaseBootstrapDarwinMetadataProbeTargetObservationV2,
  type PlatformReleaseBootstrapDarwinMetadataProbeToolObservationV2,
  type PlatformReleaseBootstrapDarwinMetadataProbeV2,
} from "../execution/schemas/platform-release-bootstrap-darwin-metadata-probe-v2.js";

const ROOT_PREFIX_V2 = "setfarm-darwin-metadata-probe-v2-";
const TARGET_BASENAME_V2 = "target";
const TARGET_ENTRY_BASENAME_V2 = "entry.txt";
const TARGET_ENTRY_BYTES_V2 = Buffer.from("setfarm metadata fixture\n", "utf8");
const TARGET_MEMBER_CAP_V2 = 128;
const PROCESS_SETTLEMENT_TIMEOUT_MILLISECONDS_V2 = 1_000;
const TEST_PROCESS_TIMEOUT_MILLISECONDS_V2 = 25;
const TEST_PROCESS_SETTLEMENT_TIMEOUT_MILLISECONDS_V2 = 100;
const TEST_PROCESS_MARKER_V2 = "SETFARM_METADATA_PROBE_RUNNER_FAULT_V2";
const HOST_IDENTITY_HASH_V2 = hashCanonicalJson({
  schema:
    "setfarm.platform-release-bootstrap-darwin-metadata-probe-test-host-identity.v2",
  platform: "darwin",
  hostScope: "private_test_fixture",
});
const HOST_COMPOSITION_RECEIPT_HASH_V2 = hashCanonicalJson({
  schema:
    "setfarm.platform-release-bootstrap-darwin-metadata-probe-test-host-composition-receipt.v2",
  operationAbiRef: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_OPERATION_ABI_REF_V2,
  operationAbiHash: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_OPERATION_ABI_HASH_V2,
  admissionScope: "test_fixture",
  authority: "diagnostic_observation_only",
});
export type PlatformReleaseBootstrapDarwinMetadataProbeFixtureV2 = Readonly<{
  dispose(): void;
}>;

export type PlatformReleaseBootstrapDarwinMetadataProbeFixtureMutationV2 =
  | "replace_target_same_bytes"
  | "add_target_entry"
  | "add_target_entries_over_limit"
  | "add_target_xattr"
  | "replace_target_with_symlink";

export type PlatformReleaseBootstrapDarwinMetadataProbeErrorCodeV2 =
  | "METADATA_PROBE_PLATFORM_UNAVAILABLE"
  | "METADATA_PROBE_FIXTURE_BUILD_FAILED"
  | "METADATA_PROBE_FIXTURE_HANDLE_UNAUTHENTICATED"
  | "METADATA_PROBE_FILESYSTEM_DRIFT"
  | "METADATA_PROBE_SPAWN_FAILED"
  | "METADATA_PROBE_TIMEOUT"
  | "METADATA_PROBE_OUTPUT_LIMIT"
  | "METADATA_PROBE_PROCESS_FAILED"
  | "METADATA_PROBE_METADATA_NOT_CLEAR"
  | "METADATA_PROBE_RECEIPT_INVALID";

export class PlatformReleaseBootstrapDarwinMetadataProbeErrorV2 extends Error {
  constructor(
    readonly code: PlatformReleaseBootstrapDarwinMetadataProbeErrorCodeV2,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message.slice(0, 1_500), options);
    this.name = "PlatformReleaseBootstrapDarwinMetadataProbeErrorV2";
  }
}

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

type DirectoryCaptureFaultForTestV2 =
  | "directory_read_failure"
  | "directory_close_failure"
  | "directory_read_and_close_failure";

type FileCaptureFaultForTestV2 =
  | "file_read_and_close_failure"
  | "file_close_failure";

type CommandRunnerFaultForTestV2 =
  | "stdout_stream_error"
  | "stderr_stream_error"
  | "direct_kill_failure"
  | "close_suppressed";

type MetadataProbeFaultForTestV2 =
  | DirectoryCaptureFaultForTestV2
  | FileCaptureFaultForTestV2
  | CommandRunnerFaultForTestV2
  | "target_membership_cap";

const METADATA_PROBE_FAULTS_FOR_TEST_V2 = Object.freeze([
  "directory_read_failure",
  "directory_close_failure",
  "directory_read_and_close_failure",
  "file_read_and_close_failure",
  "file_close_failure",
  "stdout_stream_error",
  "stderr_stream_error",
  "direct_kill_failure",
  "close_suppressed",
  "target_membership_cap",
] as const satisfies readonly MetadataProbeFaultForTestV2[]);

type StableIdentityV2 = Readonly<{
  hostIdentityHash: string;
  objectKind: "directory" | "ordinary_file";
  device: string;
  inode: string;
}>;

type MutableFingerprintV2 = Readonly<{
  ownerUid: number;
  ownerGid: number;
  mode: string;
  linkCount: number;
  byteLength: number;
  contentHash: string;
  modifiedTimeNanoseconds: string;
  changedTimeNanoseconds: string;
}>;

type TargetObservationIdentityV2 = Readonly<{
  stableIdentity: StableIdentityV2 & { objectKind: "directory" };
  mutableFingerprint: MutableFingerprintV2;
  directEntryNames: string[];
  directEntryNamesHash: string;
}>;

type TargetObservationV2 = TargetObservationIdentityV2 & Readonly<{
  observationHash: string;
}>;

type MetadataStateV2 = PlatformReleaseBootstrapDarwinMetadataProbeMetadataStateV2;

type FixtureStateV2 = Readonly<{
  alias: string;
  root: string;
  target: string;
  rootIdentity: Readonly<{ device: string; inode: string }>;
  targetIdentity: StableIdentityV2 & { objectKind: "directory" };
  toolIdentities: readonly [
    StableIdentityV2 & { objectKind: "ordinary_file" },
    StableIdentityV2 & { objectKind: "ordinary_file" },
  ];
  hostIdentityHash: string;
  hostCompositionReceiptHash: string;
  metadataPolicyHash: string;
}>;

const fixtureStatesV2 = new WeakMap<object, FixtureStateV2>();

function failV2(
  code: PlatformReleaseBootstrapDarwinMetadataProbeErrorCodeV2,
  message: string,
  cause?: unknown,
): never {
  throw new PlatformReleaseBootstrapDarwinMetadataProbeErrorV2(
    code,
    message,
    cause === undefined ? undefined : { cause },
  );
}

function sha256BytesV2(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function metadataObservationHashV2(
  schema: string,
  values: readonly string[],
): string {
  return values.length === 0
    ? PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_EMPTY_SHA256_V2
    : hashCanonicalJson({ schema, values });
}

function captureMetadataStateV2(
  xattrStdout: Uint8Array,
  aclStdout: Uint8Array,
): MetadataStateV2 {
  const xattrLines = Buffer.from(xattrStdout)
    .toString("utf8")
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const xattrNames = xattrLines.map((line) => {
    const separator = line.search(/[\t ]/u);
    const name = (separator < 0 ? line : line.slice(0, separator)).trim();
    return name.endsWith(":") ? name.slice(0, -1) : name;
  });
  const systemManagedXattrNames = xattrNames.filter(
    (name) => name === "com.apple.provenance",
  );
  const observedXattrNames = xattrNames.filter(
    (name) => name !== "com.apple.provenance",
  );
  const aclLines = Buffer.from(aclStdout)
    .toString("utf8")
    .split(/\r?\n/u)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);
  const aclEntries = aclLines.filter((line) => /^\s*\d+:\s/u.test(line));
  const firstLine = aclLines[0] ?? "";
  const aclMarkerPresent = firstLine.slice(0, 12).includes("+");
  const normalizedAclEntries = aclEntries.length > 0
    ? aclEntries
    : aclMarkerPresent
      ? ["acl-marker"]
      : [];
  return Object.freeze({
    xattr: Object.freeze({
      status: observedXattrNames.length === 0 ? "clear" : "present",
      observedNameCount: observedXattrNames.length,
      observedNamesHash: metadataObservationHashV2(
        "setfarm.platform-release-bootstrap-darwin-metadata-probe-xattr-names.v2",
        observedXattrNames,
      ),
      systemManagedNameCount: systemManagedXattrNames.length,
      systemManagedNamesHash: metadataObservationHashV2(
        "setfarm.platform-release-bootstrap-darwin-metadata-probe-system-xattr-names.v2",
        systemManagedXattrNames,
      ),
    }),
    acl: Object.freeze({
      status: normalizedAclEntries.length === 0 ? "clear" : "present",
      observedEntryCount: normalizedAclEntries.length,
      observedEntriesHash: metadataObservationHashV2(
        "setfarm.platform-release-bootstrap-darwin-metadata-probe-acl-entries.v2",
        normalizedAclEntries,
      ),
    }),
  });
}

function modeTextV2(stat: BigIntStatV2): string {
  return (Number(stat.mode & 0o7777n)).toString(8).padStart(4, "0");
}

function statIdentityV2(stat: BigIntStatV2): Readonly<{
  device: string;
  inode: string;
}> {
  return Object.freeze({
    device: stat.dev.toString(10),
    inode: stat.ino.toString(10),
  });
}

function samePhysicalIdentityV2(
  left: Readonly<{ objectKind?: string; device: string; inode: string }>,
  right: Readonly<{ objectKind?: string; device: string; inode: string }>,
): boolean {
  return left.objectKind === right.objectKind
    && left.device === right.device
    && left.inode === right.inode;
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
  code: PlatformReleaseBootstrapDarwinMetadataProbeErrorCodeV2,
  message: string,
): PlatformReleaseBootstrapDarwinMetadataProbeErrorV2 {
  return error instanceof PlatformReleaseBootstrapDarwinMetadataProbeErrorV2
    ? error
    : new PlatformReleaseBootstrapDarwinMetadataProbeErrorV2(
      code,
      message,
      { cause: error },
    );
}

function primaryFirstDirectoryFailureV2(
  primary:
    PlatformReleaseBootstrapDarwinMetadataProbeErrorV2
    | undefined,
  closeFailure:
    PlatformReleaseBootstrapDarwinMetadataProbeErrorV2
    | undefined,
  message: string,
): void {
  if (primary !== undefined && closeFailure !== undefined) {
    const aggregate = new AggregateError(
      [primary, closeFailure],
      message,
      { cause: primary },
    );
    throw new PlatformReleaseBootstrapDarwinMetadataProbeErrorV2(
      primary.code,
      message,
      { cause: aggregate },
    );
  }
  if (primary !== undefined) throw primary;
  if (closeFailure !== undefined) throw closeFailure;
}

type DirectoryCaptureV2 = Readonly<{
  stat: BigIntStatV2;
  names: readonly string[];
}>;

function captureDirectoryV2(
  absolutePath: string,
  options: Readonly<{
    errorCode: PlatformReleaseBootstrapDarwinMetadataProbeErrorCodeV2;
    label: string;
    maximumNames: number;
    exactNames?: readonly string[];
    expectedIdentity?: Readonly<{ device: string; inode: string }>;
    expectedMode?: string;
    requireProcessOwner: boolean;
    faultForTest?: DirectoryCaptureFaultForTestV2;
  }>,
): DirectoryCaptureV2 {
  let before: BigIntStatV2;
  try {
    before = lstatSync(absolutePath, { bigint: true }) as BigIntStatV2;
    if (
      before.isSymbolicLink()
      || !before.isDirectory()
      || before.nlink <= 0n
      || realpathSync(absolutePath) !== absolutePath
      || options.expectedMode !== undefined
        && modeTextV2(before) !== options.expectedMode
      || options.expectedIdentity !== undefined
        && (
          before.dev.toString(10) !== options.expectedIdentity.device
          || before.ino.toString(10) !== options.expectedIdentity.inode
        )
      || options.requireProcessOwner
        && (
          typeof process.getuid === "function"
          && Number(before.uid) !== process.getuid()
          || typeof process.getgid === "function"
          && Number(before.gid) !== process.getgid()
        )
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
    || options.exactNames !== undefined
      && options.exactNames.length > options.maximumNames
  ) {
    return failV2(
      options.errorCode,
      `${options.label} has an invalid code-owned member bound`,
    );
  }

  let directory: ReturnType<typeof opendirSync> | undefined;
  let primary:
    PlatformReleaseBootstrapDarwinMetadataProbeErrorV2
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
        throw new Error("Injected metadata directory read failure");
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
    PlatformReleaseBootstrapDarwinMetadataProbeErrorV2
    | undefined;
  if (directory !== undefined) {
    try {
      directory.closeSync();
      if (
        options.faultForTest === "directory_close_failure"
        || options.faultForTest === "directory_read_and_close_failure"
      ) {
        throw new Error("Injected metadata directory close failure");
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
    options.exactNames !== undefined
    && canonicalJsonStringify(names)
      !== canonicalJsonStringify([...options.exactNames].sort())
  ) {
    return failV2(
      options.errorCode,
      `${options.label} has unexpected direct children`,
    );
  }
  return Object.freeze({
    stat: after,
    names: Object.freeze(names),
  });
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
      "METADATA_PROBE_FIXTURE_BUILD_FAILED",
      "Metadata probe root must be one private process-owned directory",
    );
  }
  return Object.freeze({ alias, root });
}

type FileCaptureV2 = Readonly<{
  stableIdentity: StableIdentityV2 & { objectKind: "ordinary_file" };
  mutableFingerprint: MutableFingerprintV2;
}>;

function captureFileV2(
  absolutePath: string,
  expectedHostIdentityHash: string,
  faultForTest?: FileCaptureFaultForTestV2,
): FileCaptureV2 {
  let descriptor = -1;
  let bytes: Buffer | undefined;
  let eofProbe: Buffer | undefined;
  let result: FileCaptureV2 | undefined;
  let primary:
    PlatformReleaseBootstrapDarwinMetadataProbeErrorV2
    | undefined;
  try {
    const pathBefore = lstatSync(absolutePath, { bigint: true }) as BigIntStatV2;
    if (
      pathBefore.isSymbolicLink()
      || !pathBefore.isFile()
      || pathBefore.nlink !== 1n
      || pathBefore.size <= 0n
      || pathBefore.size > BigInt(PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_MAX_TOOL_BYTES_V2)
    ) {
      return failV2(
        "METADATA_PROBE_FILESYSTEM_DRIFT",
        `Metadata tool is not one bounded ordinary file: ${absolutePath}`,
      );
    }
    descriptor = openSync(
      absolutePath,
      fsConstants.O_RDONLY
        | (fsConstants.O_NOFOLLOW ?? 0)
        | ((fsConstants as unknown as Record<string, number>).O_CLOEXEC ?? 0),
    );
    const descriptorBefore = fstatSync(descriptor, { bigint: true }) as BigIntStatV2;
    if (
      !samePhysicalIdentityV2(
        { objectKind: "ordinary_file", ...statIdentityV2(pathBefore) },
        { objectKind: "ordinary_file", ...statIdentityV2(descriptorBefore) },
      )
    ) {
      return failV2(
        "METADATA_PROBE_FILESYSTEM_DRIFT",
        "Metadata tool changed between pathname and descriptor capture",
      );
    }
    const expectedByteLength = Number(descriptorBefore.size);
    bytes = Buffer.alloc(expectedByteLength);
    const digest = createHash("sha256");
    let offset = 0;
    while (offset < expectedByteLength) {
      if (faultForTest === "file_read_and_close_failure") {
        throw new Error("Injected metadata file descriptor read failure");
      }
      const count = readSync(
        descriptor,
        bytes,
        offset,
        expectedByteLength - offset,
        offset,
      );
      if (count <= 0) {
        bytes.fill(0);
        return failV2(
          "METADATA_PROBE_FILESYSTEM_DRIFT",
          "Metadata tool reached EOF before its descriptor size",
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
        "METADATA_PROBE_FILESYSTEM_DRIFT",
        "Metadata tool grew beyond its descriptor size",
      );
    }
    const descriptorAfter = fstatSync(descriptor, { bigint: true }) as BigIntStatV2;
    const pathAfter = lstatSync(absolutePath, { bigint: true }) as BigIntStatV2;
    if (
      !samePhysicalIdentityV2(
        { objectKind: "ordinary_file", ...statIdentityV2(descriptorBefore) },
        { objectKind: "ordinary_file", ...statIdentityV2(descriptorAfter) },
      )
      || !samePhysicalIdentityV2(
        { objectKind: "ordinary_file", ...statIdentityV2(descriptorAfter) },
        { objectKind: "ordinary_file", ...statIdentityV2(pathAfter) },
      )
      || modeTextV2(descriptorBefore) !== modeTextV2(descriptorAfter)
      || descriptorBefore.uid !== descriptorAfter.uid
      || descriptorBefore.gid !== descriptorAfter.gid
      || descriptorBefore.nlink !== descriptorAfter.nlink
      || descriptorBefore.size !== descriptorAfter.size
      || descriptorBefore.mtimeNs !== descriptorAfter.mtimeNs
      || descriptorBefore.ctimeNs !== descriptorAfter.ctimeNs
    ) {
      return failV2(
        "METADATA_PROBE_FILESYSTEM_DRIFT",
        "Metadata tool changed during descriptor capture",
      );
    }
    const stableIdentity: StableIdentityV2 & { objectKind: "ordinary_file" } = Object.freeze({
      hostIdentityHash: expectedHostIdentityHash,
      objectKind: "ordinary_file",
      device: descriptorAfter.dev.toString(10),
      inode: descriptorAfter.ino.toString(10),
    });
    const mutableFingerprint: MutableFingerprintV2 = Object.freeze({
      ownerUid: Number(descriptorAfter.uid),
      ownerGid: Number(descriptorAfter.gid),
      mode: modeTextV2(descriptorAfter),
      linkCount: Number(descriptorAfter.nlink),
      byteLength: Number(descriptorAfter.size),
      contentHash: digest.digest("hex"),
      modifiedTimeNanoseconds: descriptorAfter.mtimeNs.toString(10),
      changedTimeNanoseconds: descriptorAfter.ctimeNs.toString(10),
    });
    result = Object.freeze({ stableIdentity, mutableFingerprint });
  } catch (error) {
    primary = directoryCaptureErrorV2(
      error,
      "METADATA_PROBE_FILESYSTEM_DRIFT",
      `Metadata tool could not be captured: ${absolutePath}`,
    );
  }
  bytes?.fill(0);
  eofProbe?.fill(0);

  let closeFailure:
    PlatformReleaseBootstrapDarwinMetadataProbeErrorV2
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
        throw new Error("Injected metadata file descriptor close failure");
      }
    } catch (error) {
      closeFailure = directoryCaptureErrorV2(
        error,
        "METADATA_PROBE_FILESYSTEM_DRIFT",
        `Metadata tool descriptor could not be closed: ${absolutePath}`,
      );
    }
  }
  primaryFirstDirectoryFailureV2(
    primary,
    closeFailure,
    "Metadata tool capture and descriptor close both failed",
  );
  if (result === undefined) {
    return failV2(
      "METADATA_PROBE_FILESYSTEM_DRIFT",
      `Metadata tool capture did not produce a result: ${absolutePath}`,
    );
  }
  return result;
}

function captureTargetV2(
  target: string,
  expectedHostIdentityHash: string,
): TargetObservationV2 {
  try {
    const captured = captureDirectoryV2(target, {
      errorCode: "METADATA_PROBE_FILESYSTEM_DRIFT",
      label: "Metadata target directory",
      maximumNames: TARGET_MEMBER_CAP_V2,
      expectedMode: "0700",
      requireProcessOwner: true,
    });
    const stat = captured.stat;
    const stableIdentity: StableIdentityV2 & { objectKind: "directory" } = Object.freeze({
      hostIdentityHash: expectedHostIdentityHash,
      objectKind: "directory",
      device: stat.dev.toString(10),
      inode: stat.ino.toString(10),
    });
    const directEntryNames = [...captured.names];
    const mutableFingerprint: MutableFingerprintV2 = Object.freeze({
      ownerUid: Number(stat.uid),
      ownerGid: Number(stat.gid),
      mode: modeTextV2(stat),
      linkCount: Number(stat.nlink),
      byteLength: Number(stat.size),
      contentHash: hashMetadataProbeDirectoryEntriesV2(directEntryNames),
      modifiedTimeNanoseconds: stat.mtimeNs.toString(10),
      changedTimeNanoseconds: stat.ctimeNs.toString(10),
    });
    const identity: TargetObservationIdentityV2 = {
      stableIdentity,
      mutableFingerprint,
      directEntryNames,
      directEntryNamesHash: hashMetadataProbeDirectoryEntriesV2(directEntryNames),
    };
    return Object.freeze({
      ...identity,
      observationHash: hashMetadataProbeTargetObservationV2(identity),
    });
  } catch (error) {
    if (error instanceof PlatformReleaseBootstrapDarwinMetadataProbeErrorV2) {
      throw error;
    }
    return failV2(
      "METADATA_PROBE_FILESYSTEM_DRIFT",
      "Metadata target could not be captured",
      error,
    );
  }
}

function assertFixtureLayoutV2(
  state: FixtureStateV2,
  faultForTest?: DirectoryCaptureFaultForTestV2,
): void {
  try {
    captureDirectoryV2(state.root, {
      errorCode: "METADATA_PROBE_FIXTURE_HANDLE_UNAUTHENTICATED",
      label: "Metadata probe root",
      maximumNames: 1,
      exactNames: [TARGET_BASENAME_V2],
      expectedIdentity: state.rootIdentity,
      expectedMode: "0700",
      requireProcessOwner: true,
      faultForTest,
    });
    captureDirectoryV2(state.target, {
      errorCode: "METADATA_PROBE_FIXTURE_HANDLE_UNAUTHENTICATED",
      label: "Metadata probe target",
      maximumNames: 1,
      exactNames: [TARGET_ENTRY_BASENAME_V2],
      expectedIdentity: state.targetIdentity,
      expectedMode: "0700",
      requireProcessOwner: true,
    });
  } catch (error) {
    if (error instanceof PlatformReleaseBootstrapDarwinMetadataProbeErrorV2) {
      throw error;
    }
    return failV2(
      "METADATA_PROBE_FIXTURE_HANDLE_UNAUTHENTICATED",
      "Metadata probe fixture layout could not be revalidated",
      error,
    );
  }
}

function codeOwnedFixtureStateV2(
  fixture: PlatformReleaseBootstrapDarwinMetadataProbeFixtureV2,
): FixtureStateV2 {
  if (
    typeof fixture !== "object"
    || fixture === null
    || isProxy(fixture)
  ) {
    return failV2(
      "METADATA_PROBE_FIXTURE_HANDLE_UNAUTHENTICATED",
      "Metadata probe requires one authentic fixture handle",
    );
  }
  const state = fixtureStatesV2.get(fixture);
  if (state === undefined) {
    return failV2(
      "METADATA_PROBE_FIXTURE_HANDLE_UNAUTHENTICATED",
      "Metadata probe fixture handle is not code-owned",
    );
  }
  return state;
}

function authenticFixtureStateV2(
  fixture: PlatformReleaseBootstrapDarwinMetadataProbeFixtureV2,
  faultForTest?: DirectoryCaptureFaultForTestV2,
): FixtureStateV2 {
  const state = codeOwnedFixtureStateV2(fixture);
  assertFixtureLayoutV2(state, faultForTest);
  return state;
}

type CommandResultV2 = Readonly<{
  status: "exited" | "spawn_failed" | "timed_out" | "output_limit_exceeded";
  pid: number;
  startedAt: number;
  finishedAt: number;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stdout: Buffer;
  stderr: Buffer;
}>;

function primaryFirstCommandFailureV2(
  primary: PlatformReleaseBootstrapDarwinMetadataProbeErrorV2,
  secondary: readonly PlatformReleaseBootstrapDarwinMetadataProbeErrorV2[],
  message: string,
): PlatformReleaseBootstrapDarwinMetadataProbeErrorV2 {
  if (secondary.length === 0) return primary;
  const aggregate = new AggregateError(
    [primary, ...secondary],
    message,
    { cause: primary },
  );
  return new PlatformReleaseBootstrapDarwinMetadataProbeErrorV2(
    primary.code,
    message,
    { cause: aggregate },
  );
}

function runBoundedCommandV2(
  kind: "xattr_observe" | "acl_observe",
  target: string,
  cwd: string,
  faultForTest?: CommandRunnerFaultForTestV2,
): Promise<CommandResultV2> {
  const executable = faultForTest === undefined
    ? kind === "xattr_observe" ? "/usr/bin/xattr" : "/bin/ls"
    : process.execPath;
  const argv = faultForTest === undefined
    ? kind === "xattr_observe" ? ["-l", target] : ["-lde@", target]
    : [
      "-e",
      "setInterval(() => {}, 1000);",
      TEST_PROCESS_MARKER_V2,
    ];
  return new Promise((resolve, reject) => {
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    const secondaryFailures:
      PlatformReleaseBootstrapDarwinMetadataProbeErrorV2[] = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let status: CommandResultV2["status"] = "exited";
    let primaryFailure:
      PlatformReleaseBootstrapDarwinMetadataProbeErrorV2
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
    const commandResult = (
      exitCode: number | null,
      signal: NodeJS.Signals | null,
    ): CommandResultV2 => {
      const stdout = Buffer.concat(stdoutChunks, stdoutBytes);
      const stderr = Buffer.concat(stderrChunks, stderrBytes);
      zeroChunks();
      return Object.freeze({
        status,
        pid: child.pid ?? -1,
        startedAt,
        finishedAt: Date.now(),
        exitCode,
        signal,
        stdout,
        stderr,
      });
    };
    const rejectFailure = (
      fallback: PlatformReleaseBootstrapDarwinMetadataProbeErrorV2,
    ): void => {
      const primary = primaryFailure ?? fallback;
      zeroChunks();
      reject(primaryFirstCommandFailureV2(
        primary,
        secondaryFailures,
        "Metadata command and direct-child containment both failed",
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
      resolve(commandResult(exitCode, signal));
    };
    try {
      child = spawn(executable, argv, {
        cwd,
        detached: false,
        env: {},
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (error) {
      resolve(Object.freeze({
        status: "spawn_failed",
        pid: -1,
        startedAt,
        finishedAt: Date.now(),
        exitCode: null,
        signal: null,
        stdout: Buffer.alloc(0),
        stderr: Buffer.from(String(error), "utf8").subarray(
          0,
          PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_MAX_OUTPUT_BYTES_V2,
        ),
      }));
      return;
    }

    const recordSecondaryFailure = (message: string, cause?: unknown): void => {
      secondaryFailures.push(new PlatformReleaseBootstrapDarwinMetadataProbeErrorV2(
        "METADATA_PROBE_PROCESS_FAILED",
        message,
        cause === undefined ? undefined : { cause },
      ));
    };
    const signalDirectChild = (force: boolean): boolean => {
      if (faultForTest === "direct_kill_failure" && !force) {
        recordSecondaryFailure(
          "Injected metadata command direct-child termination failure",
        );
        return false;
      }
      try {
        const signaled = child.kill("SIGKILL");
        if (!signaled) {
          recordSecondaryFailure(
            "Metadata command direct-child termination returned false",
          );
        }
        return signaled;
      } catch (error) {
        recordSecondaryFailure(
          "Metadata command direct-child termination threw",
          error,
        );
        return false;
      }
    };
    const settleWatchdog = (): void => {
      if (settled) return;
      secondaryFailures.push(new PlatformReleaseBootstrapDarwinMetadataProbeErrorV2(
        "METADATA_PROBE_PROCESS_FAILED",
        "Metadata command did not settle after direct-child termination",
      ));
      signalDirectChild(true);
      settled = true;
      clearTimers();
      rejectFailure(new PlatformReleaseBootstrapDarwinMetadataProbeErrorV2(
        "METADATA_PROBE_PROCESS_FAILED",
        "Metadata command settlement was not proven",
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
      error: PlatformReleaseBootstrapDarwinMetadataProbeErrorV2,
      nextStatus: CommandResultV2["status"],
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
        > PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_MAX_OUTPUT_BYTES_V2
      ) {
        outputLimitLatched = true;
        latchPrimaryFailure(
          new PlatformReleaseBootstrapDarwinMetadataProbeErrorV2(
            "METADATA_PROBE_OUTPUT_LIMIT",
            `Metadata command exceeded bounded ${stream} capture`,
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
    const streamFailure = (stream: "stdout" | "stderr", error: Error): void => {
      latchPrimaryFailure(
        new PlatformReleaseBootstrapDarwinMetadataProbeErrorV2(
          "METADATA_PROBE_PROCESS_FAILED",
          `Metadata command ${stream} stream failed`,
          { cause: error },
        ),
        "spawn_failed",
        true,
      );
    };

    child.once("error", (error) => {
      latchPrimaryFailure(
        new PlatformReleaseBootstrapDarwinMetadataProbeErrorV2(
          "METADATA_PROBE_SPAWN_FAILED",
          "Metadata command could not start",
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
        new PlatformReleaseBootstrapDarwinMetadataProbeErrorV2(
          "METADATA_PROBE_SPAWN_FAILED",
          "Metadata command did not expose its fixed output streams",
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
            "Injected metadata command stdout stream failure",
          ));
        });
      }
      if (faultForTest === "stderr_stream_error") {
        queueMicrotask(() => {
          child.stderr?.destroy(new Error(
            "Injected metadata command stderr stream failure",
          ));
        });
      }
    }

    const executionMilliseconds = faultForTest === undefined
      ? PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_TIMEOUT_MS_V2
      : TEST_PROCESS_TIMEOUT_MILLISECONDS_V2;
    executionTimer = setTimeout(() => {
      latchPrimaryFailure(
        new PlatformReleaseBootstrapDarwinMetadataProbeErrorV2(
          "METADATA_PROBE_TIMEOUT",
          `Metadata command timed out after ${executionMilliseconds}ms`,
        ),
        "timed_out",
        false,
      );
    }, executionMilliseconds);
  });
}

function commandObservationV2(
  kind: "xattr_observe" | "acl_observe",
  _target: string,
  _cwd: string,
  result: Awaited<ReturnType<typeof runBoundedCommandV2>>,
): PlatformReleaseBootstrapDarwinMetadataProbeCommandObservationV2 {
  const executable: "/usr/bin/xattr" | "/bin/ls" =
    kind === "xattr_observe" ? "/usr/bin/xattr" : "/bin/ls";
  const argv = (kind === "xattr_observe"
    ? ["-l", PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_PRIVATE_TARGET_TOKEN_V2]
    : ["-lde@", PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_PRIVATE_TARGET_TOKEN_V2]) as [
      string,
      typeof PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_PRIVATE_TARGET_TOKEN_V2,
    ];
  const cwdLocator = PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_PRIVATE_CWD_TOKEN_V2;
  const argvHash = hashCanonicalJson({
    schema:
      "setfarm.platform-release-bootstrap-darwin-metadata-probe-command-argv.v2",
    kind,
    executable,
    argv,
    cwdLocator,
    environmentPolicy:
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_ENVIRONMENT_POLICY_V2,
    shell: "forbidden",
  });
  const identity = {
    kind,
    executable,
    argv,
    argvHash,
    cwdLocator,
    environmentPolicy:
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_ENVIRONMENT_POLICY_V2,
    shell: "forbidden" as const,
    status: result.status,
    pid: result.pid,
    startedAt: result.startedAt,
    finishedAt: result.finishedAt,
    exitCode: result.exitCode,
    signal: result.signal,
    stdoutByteLength: result.stdout.byteLength,
    stderrByteLength: result.stderr.byteLength,
    stdoutHash: sha256BytesV2(result.stdout),
    stderrHash: sha256BytesV2(result.stderr),
  };
  return {
    ...identity,
    observationHash: hashMetadataProbeCommandObservationV2(identity),
  };
}

function toolObservationV2(
  toolRef: "XATTR_OBSERVER_V2" | "ACL_OBSERVER_V2",
  physical: Readonly<{
    stableIdentity: StableIdentityV2 & { objectKind: "ordinary_file" };
    mutableFingerprint: MutableFingerprintV2;
  }>,
  command: PlatformReleaseBootstrapDarwinMetadataProbeCommandObservationV2,
): PlatformReleaseBootstrapDarwinMetadataProbeToolObservationV2 {
  const identity: Readonly<{
    toolRef: "XATTR_OBSERVER_V2" | "ACL_OBSERVER_V2";
    stableIdentity: StableIdentityV2 & { objectKind: "ordinary_file" };
    mutableFingerprint: MutableFingerprintV2;
    command: PlatformReleaseBootstrapDarwinMetadataProbeCommandObservationV2;
  }> = {
    toolRef,
    stableIdentity: physical.stableIdentity,
    mutableFingerprint: physical.mutableFingerprint,
    command,
  };
  return {
    ...identity,
    observationHash: hashMetadataProbeToolObservationV2(identity),
  };
}

function snapshotV2(
  target: TargetObservationV2,
  tools: [PlatformReleaseBootstrapDarwinMetadataProbeToolObservationV2, PlatformReleaseBootstrapDarwinMetadataProbeToolObservationV2],
  metadataState: MetadataStateV2,
): PlatformReleaseBootstrapDarwinMetadataProbeSnapshotV2 {
  const identity: Readonly<{
    target: TargetObservationV2;
    tools: [
      PlatformReleaseBootstrapDarwinMetadataProbeToolObservationV2,
      PlatformReleaseBootstrapDarwinMetadataProbeToolObservationV2,
    ];
    metadataState: MetadataStateV2;
    observedEntryCount: number;
  }> = {
    target,
    tools,
    metadataState,
    observedEntryCount: target.directEntryNames.length,
  };
  return {
    ...identity,
    snapshotHash: hashMetadataProbeSnapshotV2(identity),
  };
}

export function buildPlatformReleaseBootstrapDarwinMetadataProbeFixtureForTestV2(): PlatformReleaseBootstrapDarwinMetadataProbeFixtureV2 {
  if (process.platform !== "darwin") {
    return failV2(
      "METADATA_PROBE_PLATFORM_UNAVAILABLE",
      "Darwin metadata probe fixture requires Darwin",
    );
  }
  const privateRoot = exactPrivateRootV2();
  try {
    const target = path.join(privateRoot.root, TARGET_BASENAME_V2);
    mkdirSync(target, { mode: 0o700 });
    chmodSync(target, 0o700);
    const entry = path.join(target, TARGET_ENTRY_BASENAME_V2);
    writeFileSync(entry, TARGET_ENTRY_BYTES_V2, { mode: 0o444 });
    chmodSync(entry, 0o444);
    const root = lstatSync(privateRoot.root, { bigint: true }) as BigIntStatV2;
    const targetObservation = captureTargetV2(target, HOST_IDENTITY_HASH_V2);
    const xattrPhysical = captureFileV2("/usr/bin/xattr", HOST_IDENTITY_HASH_V2);
    const lsPhysical = captureFileV2("/bin/ls", HOST_IDENTITY_HASH_V2);
    const state: FixtureStateV2 = Object.freeze({
      alias: privateRoot.alias,
      root: privateRoot.root,
      target,
      rootIdentity: statIdentityV2(root),
      targetIdentity: targetObservation.stableIdentity,
      toolIdentities: [
        xattrPhysical.stableIdentity,
        lsPhysical.stableIdentity,
      ] as const,
      hostIdentityHash: HOST_IDENTITY_HASH_V2,
      hostCompositionReceiptHash: HOST_COMPOSITION_RECEIPT_HASH_V2,
      metadataPolicyHash: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_POLICY_HASH_V2,
    });
    let fixture: PlatformReleaseBootstrapDarwinMetadataProbeFixtureV2;
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
    if (error instanceof PlatformReleaseBootstrapDarwinMetadataProbeErrorV2) {
      throw error;
    }
    return failV2(
      "METADATA_PROBE_FIXTURE_BUILD_FAILED",
      "Could not create private metadata probe fixture",
      error,
    );
  }
}

export function mutatePlatformReleaseBootstrapDarwinMetadataProbeFixtureForTestV2(
  fixture: PlatformReleaseBootstrapDarwinMetadataProbeFixtureV2,
  mutation: PlatformReleaseBootstrapDarwinMetadataProbeFixtureMutationV2,
): void {
  const state = authenticFixtureStateV2(fixture);
  const entry = path.join(state.target, TARGET_ENTRY_BASENAME_V2);
  if (mutation === "replace_target_same_bytes") {
    const replacement = path.join(state.root, "replacement-target");
    mkdirSync(replacement, { mode: 0o700 });
    chmodSync(replacement, 0o700);
    const replacementEntry = path.join(replacement, TARGET_ENTRY_BASENAME_V2);
    writeFileSync(replacementEntry, TARGET_ENTRY_BYTES_V2, { mode: 0o444 });
    chmodSync(replacementEntry, 0o444);
    rmSync(state.target, { recursive: true, force: true });
    renameSync(replacement, state.target);
    return;
  }
  if (mutation === "add_target_entry") {
    const extra = path.join(state.target, "extra.txt");
    writeFileSync(extra, Buffer.from("drift\n", "utf8"), { mode: 0o444 });
    chmodSync(extra, 0o444);
    return;
  }
  if (mutation === "add_target_entries_over_limit") {
    for (let index = 0; index < TARGET_MEMBER_CAP_V2; index += 1) {
      const extra = path.join(
        state.target,
        `overflow-${index.toString(10).padStart(3, "0")}.txt`,
      );
      writeFileSync(extra, Buffer.from("bounded drift\n", "utf8"), {
        flag: "wx",
        mode: 0o444,
      });
      chmodSync(extra, 0o444);
    }
    return;
  }
  if (mutation === "add_target_xattr") {
    const result = spawnSync(
      "/usr/bin/xattr",
      ["-w", "com.setfarm.metadata_probe_v2", "fixture", state.target],
      { env: {}, shell: false, stdio: "ignore", timeout: 8_000 },
    );
    if (result.error !== undefined || result.status !== 0) {
      return failV2(
        "METADATA_PROBE_FILESYSTEM_DRIFT",
        "Could not add the test-only metadata mutation",
        result.error ?? new Error(`xattr exited with ${String(result.status)}`),
      );
    }
    return;
  }
  unlinkSync(entry);
  writeFileSync(entry, TARGET_ENTRY_BYTES_V2, { mode: 0o444 });
  chmodSync(entry, 0o444);
  const replacement = path.join(state.root, "replacement-target");
  mkdirSync(replacement, { mode: 0o700 });
  chmodSync(replacement, 0o700);
  try {
    // A symlink target is intentionally outside the authenticated layout.
    unlinkSync(path.join(state.root, TARGET_BASENAME_V2));
  } catch {
    // The target directory is removed below if the platform rejects unlink.
  }
  rmSync(state.target, { recursive: true, force: true });
  // Recreate a symlink only for the drift test; the next observe rejects it.
  symlinkSync(replacement, state.target);
}

function admittedFaultForTestV2(
  value: unknown,
): MetadataProbeFaultForTestV2 | undefined {
  if (value === undefined) return undefined;
  if (
    typeof value !== "string"
    || !(METADATA_PROBE_FAULTS_FOR_TEST_V2 as readonly string[]).includes(value)
  ) {
    return failV2(
      "METADATA_PROBE_RECEIPT_INVALID",
      "Metadata probe test fault is outside the fixed literal set",
    );
  }
  return value as MetadataProbeFaultForTestV2;
}

function isDirectoryCaptureFaultForTestV2(
  value: MetadataProbeFaultForTestV2 | undefined,
): value is DirectoryCaptureFaultForTestV2 {
  return value === "directory_read_failure"
    || value === "directory_close_failure"
    || value === "directory_read_and_close_failure";
}

function isFileCaptureFaultForTestV2(
  value: MetadataProbeFaultForTestV2 | undefined,
): value is FileCaptureFaultForTestV2 {
  return value === "file_read_and_close_failure"
    || value === "file_close_failure";
}

function isCommandRunnerFaultForTestV2(
  value: MetadataProbeFaultForTestV2 | undefined,
): value is CommandRunnerFaultForTestV2 {
  return value === "stdout_stream_error"
    || value === "stderr_stream_error"
    || value === "direct_kill_failure"
    || value === "close_suppressed";
}

export async function observePlatformReleaseBootstrapDarwinMetadataProbeForTestV2(
  fixture: PlatformReleaseBootstrapDarwinMetadataProbeFixtureV2,
  options: Readonly<{
    challenge?: Uint8Array;
    testFault?: MetadataProbeFaultForTestV2;
  }> = {},
): Promise<PlatformReleaseBootstrapDarwinMetadataProbeV2> {
  if (process.platform !== "darwin") {
    return failV2(
      "METADATA_PROBE_PLATFORM_UNAVAILABLE",
      "Darwin metadata probe requires Darwin",
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
      "METADATA_PROBE_RECEIPT_INVALID",
      "Metadata probe options are outside the exact test support shape",
    );
  }
  const testFault = admittedFaultForTestV2(options.testFault);
  const state = testFault === "target_membership_cap"
    ? codeOwnedFixtureStateV2(fixture)
    : authenticFixtureStateV2(
      fixture,
      isDirectoryCaptureFaultForTestV2(testFault) ? testFault : undefined,
    );
  const challenge = options.challenge === undefined
    ? randomBytes(32)
    : Buffer.from(options.challenge);
  if (challenge.byteLength !== 32) {
    return failV2(
      "METADATA_PROBE_RECEIPT_INVALID",
      "Metadata probe challenge must be exactly 32 bytes",
    );
  }
  if (testFault === "target_membership_cap") {
    captureTargetV2(state.target, state.hostIdentityHash);
    return failV2(
      "METADATA_PROBE_FILESYSTEM_DRIFT",
      "Metadata target membership-cap fault did not fail closed",
    );
  }
  if (isFileCaptureFaultForTestV2(testFault)) {
    captureFileV2(
      "/usr/bin/xattr",
      state.hostIdentityHash,
      testFault,
    );
    return failV2(
      "METADATA_PROBE_FILESYSTEM_DRIFT",
      "Metadata file capture fault did not fail closed",
    );
  }
  if (isCommandRunnerFaultForTestV2(testFault)) {
    await runBoundedCommandV2(
      "xattr_observe",
      state.target,
      state.root,
      testFault,
    );
    return failV2(
      "METADATA_PROBE_PROCESS_FAILED",
      "Metadata command runner fault did not fail closed",
    );
  }
  const targetBefore = captureTargetV2(state.target, state.hostIdentityHash);
  const xattrBefore = captureFileV2("/usr/bin/xattr", state.hostIdentityHash);
  const lsBefore = captureFileV2("/bin/ls", state.hostIdentityHash);
  if (
    !samePhysicalIdentityV2(targetBefore.stableIdentity, state.targetIdentity)
    || !samePhysicalIdentityV2(xattrBefore.stableIdentity, state.toolIdentities[0]!)
    || !samePhysicalIdentityV2(lsBefore.stableIdentity, state.toolIdentities[1]!)
  ) {
    return failV2(
      "METADATA_PROBE_FILESYSTEM_DRIFT",
      "Metadata target or tool identity changed before observation",
    );
  }
  const xattrResult = await runBoundedCommandV2("xattr_observe", state.target, state.root);
  const xattrCommand = commandObservationV2(
    "xattr_observe",
    state.target,
    state.root,
    xattrResult,
  );
  const lsResult = await runBoundedCommandV2("acl_observe", state.target, state.root);
  const lsCommand = commandObservationV2("acl_observe", state.target, state.root, lsResult);
  const clearResult = (result: Awaited<ReturnType<typeof runBoundedCommandV2>>, command: string): void => {
    result.stdout.fill(0);
    result.stderr.fill(0);
    void command;
  };
  if (
    xattrResult.status !== "exited"
    || xattrResult.exitCode !== 0
    || xattrResult.signal !== null
    || lsResult.status !== "exited"
    || lsResult.exitCode !== 0
    || lsResult.signal !== null
  ) {
    clearResult(xattrResult, "xattr");
    clearResult(lsResult, "ls");
    return failV2(
      xattrResult.status === "timed_out" || lsResult.status === "timed_out"
        ? "METADATA_PROBE_TIMEOUT"
        : xattrResult.status === "output_limit_exceeded" || lsResult.status === "output_limit_exceeded"
          ? "METADATA_PROBE_OUTPUT_LIMIT"
          : xattrResult.status === "spawn_failed" || lsResult.status === "spawn_failed"
            ? "METADATA_PROBE_SPAWN_FAILED"
            : "METADATA_PROBE_PROCESS_FAILED",
      "Metadata observation command did not complete successfully",
    );
  }
  const metadataState = captureMetadataStateV2(
    xattrResult.stdout,
    lsResult.stdout,
  );
  clearResult(xattrResult, "xattr");
  clearResult(lsResult, "ls");
  if (
    metadataState.xattr.status !== "clear"
    || metadataState.acl.status !== "clear"
  ) {
    return failV2(
      "METADATA_PROBE_METADATA_NOT_CLEAR",
      "Metadata observation found xattrs or ACL entries on the private target",
    );
  }
  // Revalidate the private output root and namespace after both child
  // processes have exited. The operation never trusts a path-only pre-fence.
  assertFixtureLayoutV2(state);
  const targetAfter = captureTargetV2(state.target, state.hostIdentityHash);
  const xattrAfter = captureFileV2("/usr/bin/xattr", state.hostIdentityHash);
  const lsAfter = captureFileV2("/bin/ls", state.hostIdentityHash);
  const xattrBeforeTool = toolObservationV2("XATTR_OBSERVER_V2", xattrBefore, xattrCommand);
  const lsBeforeTool = toolObservationV2("ACL_OBSERVER_V2", lsBefore, lsCommand);
  const xattrAfterTool = toolObservationV2("XATTR_OBSERVER_V2", xattrAfter, xattrCommand);
  const lsAfterTool = toolObservationV2("ACL_OBSERVER_V2", lsAfter, lsCommand);
  const before = snapshotV2(
    targetBefore,
    [xattrBeforeTool, lsBeforeTool],
    metadataState,
  );
  const after = snapshotV2(
    targetAfter,
    [xattrAfterTool, lsAfterTool],
    metadataState,
  );
  if (
    canonicalJsonStringify(before) !== canonicalJsonStringify(after)
    || !samePhysicalIdentityV2(targetAfter.stableIdentity, state.targetIdentity)
    || !samePhysicalIdentityV2(xattrAfter.stableIdentity, state.toolIdentities[0]!)
    || !samePhysicalIdentityV2(lsAfter.stableIdentity, state.toolIdentities[1]!)
  ) {
    return failV2(
      "METADATA_PROBE_FILESYSTEM_DRIFT",
      "Metadata target or fixed tool changed across the pre/post fence",
    );
  }
  const metadataCatalogHash = hashMetadataProbeCatalogV2({
    metadataPolicyHash: state.metadataPolicyHash,
    target: before.target,
    tools: before.tools,
    metadataState: before.metadataState,
  });
  const observationOutcome = "metadata_policy_satisfied" as const;
  const metadataObservationHash = hashMetadataProbeObservationV2({
    before,
    after,
    observationOutcome,
    metadataCatalogHash,
  });
  const identity = {
    schema: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_V2_SCHEMA,
    version: "2.0.0" as const,
    authorityState: "observed_test_fixture_unverified" as const,
    admissionScope: "test_fixture" as const,
    productionAuthority: false as const,
    productionAdmission: "forbidden" as const,
    credentialUse: "none" as const,
    mutationAuthority: false as const,
    trustConclusion: "characterization_only" as const,
    targetBinding: "private_fixture_path_revalidated_v2" as const,
    implementationScope:
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_IMPLEMENTATION_SCOPE_V2,
    operationAbiRef: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_OPERATION_ABI_REF_V2,
    operationAbiHash: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_OPERATION_ABI_HASH_V2,
    hostCompositionReceiptHash: state.hostCompositionReceiptHash,
    challengeHash: sha256BytesV2(challenge),
    targetRootPhysicalIdentityHash: hashMetadataProbeTargetStableIdentityV2(
      before.target.stableIdentity,
    ),
    metadataPolicyHash: state.metadataPolicyHash,
    observationOutcome,
    observedEntryCount: before.observedEntryCount,
    metadataCatalogHash,
    before,
    after,
    metadataObservationHash,
  };
  return parsePlatformReleaseBootstrapDarwinMetadataProbeCandidateV2({
    ...identity,
    probeHash: hashCanonicalJson({
      schema: "setfarm.platform-release-bootstrap-darwin-metadata-probe-hash.v2",
      probe: identity,
    }),
  });
}
