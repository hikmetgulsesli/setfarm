import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  mkdtempSync,
  openSync,
  opendirSync,
  readSync,
  realpathSync,
} from "node:fs";
import type { BigIntStats } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Readable, Writable } from "node:stream";
import { isProxy } from "node:util/types";

const BUILDER_V2 = path.resolve(
  import.meta.dirname,
  "../../scripts/build-platform-release-content-store-filesystem-fixture-v2.mjs",
);
const REPOSITORY_ROOT_V2 = path.resolve(import.meta.dirname, "../..");
const BUILD_PARENT_PREFIX_V2 = "setfarm-content-store-runner-build-v2-";
const BINARY_BASENAME_V2 = "content-store-filesystem-fixture-v2";
const RETAINED_STAGE_PREFIX_V2 = ".setfarm-content-store-fixture-build-";
const RETAINED_STAGE_ENTRY_NAMES_V2 = Object.freeze([
  "content-store-filesystem-fixture-v2",
  "platform-release-content-store-filesystem-fixture-v2.c",
  "platform-release-content-store-filesystem-kernel-v2.c",
  "platform-release-content-store-filesystem-kernel-v2.h",
] as const);
const BUILD_RECEIPT_SCHEMA_V2 =
  "setfarm.platform-release-content-store-filesystem-fixture-build-receipt.v2" as const;
const RETENTION_DISPOSITION_SCHEMA_V2 =
  "setfarm.platform-release-content-store-filesystem-fixture-retention-disposition.v2" as const;
const PUBLICATION_POLICY_V2 =
  "descriptor_exclusive_copy_no_replace_fsync_post_fence_false_authority_v2" as const;
const STAGE_WORKSPACE_POLICY_V2 =
  "retained_on_success_or_failure_until_caller_root_disposal_false_authority_v2" as const;
const RESULT_SCHEMA_V2 =
  "setfarm.platform-release-content-store-filesystem-fixture-result.v2" as const;
const CAPABILITY_V2 =
  "darwin_descriptor_relative_content_store_fixture_v2" as const;
const MAGIC_V2 = Buffer.from("SETFARM-CSTORE2\0", "ascii");
const VERSION_V2 = 2;
const DIRECTORY_BYTES_V2 = 36;
const DIRECTORY_COUNT_V2 = 5;
const SHA256_HEX_BYTES_V2 = 64;
const HEADER_BYTES_V2 =
  MAGIC_V2.byteLength + 8 + DIRECTORY_COUNT_V2 * DIRECTORY_BYTES_V2 + 16
  + SHA256_HEX_BYTES_V2 * 2;
const MAX_PAYLOAD_BYTES_V2 = 8 * 1024 * 1024;
const MAX_BINARY_BYTES_V2 = 4 * 1024 * 1024;
const MAX_BUILD_STDOUT_BYTES_V2 = 64 * 1024;
const MAX_BUILD_STDERR_BYTES_V2 = 2 * 1024 * 1024;
const MAX_STDOUT_BYTES_V2 = 16 * 1024;
const MAX_STDERR_BYTES_V2 = 4 * 1024;
const BUILD_TIMEOUT_MILLISECONDS_V2 = 120_000;
const BUILDER_TEST_TIMEOUT_MILLISECONDS_V2 = 25;
const BUILDER_TEST_TIMEOUT_DURATION_SECONDS_V2 = "83.141592";
const BUILDER_TEST_PROCESS_MARKER_V2 =
  "setfarm-content-store-wrapper-builder-runner-fault-v2";
const PROCESS_GROUP_DEATH_ATTEMPTS_V2 = 300;
const PROCESS_GROUP_DEATH_INTERVAL_MILLISECONDS_V2 = 10;
const PROCESS_SETTLEMENT_TIMEOUT_MILLISECONDS_V2 = 3_000;
const CHECKPOINT_TIMEOUT_MILLISECONDS_V2 = 15_000;
const UINT64_MAX_V2 = (1n << 64n) - 1n;

if (MAGIC_V2.byteLength !== 16 || HEADER_BYTES_V2 !== 348) {
  throw new Error("Content-store fixture wire constants are internally inconsistent");
}

const PRIMARY_NAMES_V2 = Object.freeze([
  "ok",
  "invalid_argument",
  "platform_unavailable",
  "root_invalid",
  "child_invalid",
  "bound_exceeded",
  "state_conflict",
  "stage_failed",
  "release_invalid",
  "release_publication_failed",
  "attestation_invalid",
  "attestation_publication_failed",
  "revalidation_failed",
  "sync_failed",
  "cleanup_failed",
  "lease_failed",
] as const);

const CLEANUP_NAMES_V2 = Object.freeze([
  "ok",
  "stage_identity_changed",
  "stage_shape_invalid",
  "entry_identity_changed",
  "entry_unlink_failed",
  "directory_remove_failed",
  "parent_changed",
  "sync_failed",
] as const);

const LEASE_NAMES_V2 = Object.freeze([
  "ok",
  "content_acquire_failed",
  "attestation_acquire_failed",
  "content_changed",
  "attestation_changed",
  "content_release_failed",
  "attestation_release_failed",
  "parent_changed",
  "sync_failed",
] as const);

export type PlatformReleaseContentStoreDarwinFilesystemFixtureCheckpointV2 =
  | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;

export type PlatformReleaseContentStoreDarwinFilesystemExpectedDirectoryV2 =
  Readonly<{
    device: string;
    inode: string;
    ownerUid: string;
    ownerGid: string;
    mode: number;
  }>;

export type PlatformReleaseContentStoreDarwinFilesystemFixtureV2 = Readonly<{
  buildRecipeHash: string;
  binarySha256: string;
  binaryByteLength: number;
  dispose(): PlatformReleaseContentStoreDarwinFilesystemRetentionDispositionV2;
}>;

export type PlatformReleaseContentStoreDarwinFilesystemRetentionDispositionV2 =
  Readonly<{
    schema: typeof RETENTION_DISPOSITION_SCHEMA_V2;
    admissionScope: "test_fixture";
    productionAuthority: false;
    deletionAuthority: false;
    filesystemMutationPerformed: false;
    rootDisposition: "retained_no_atomic_same_uid_conditional_delete_v2";
  }>;

export type PlatformReleaseContentStoreDarwinFilesystemFixtureInspectionV2 =
  Readonly<{
    buildRecipeHash: string;
    binarySha256: string;
    binaryByteLength: number;
  }>;

export type PlatformReleaseContentStoreDarwinFilesystemRetainedWorkspaceForTestV2 =
  Readonly<{
    admissionScope: "test_fixture";
    alias: string;
    binary: string;
    deletionAuthority: false;
    productionAuthority: false;
    root: string;
    stage: string;
  }>;

export type PlatformReleaseContentStoreDarwinFilesystemBuilderFaultScenarioForTestV2 =
  | "stdout_stream_error"
  | "stderr_stream_error"
  | "group_kill_failure_settlement_watchdog"
  | "group_death_unproven"
  | "multi_chunk_output_overflow"
  | "nested_builder_invocation_failure";

export type PlatformReleaseContentStoreDarwinFilesystemBuilderFaultObservationForTestV2 =
  Readonly<{
    admissionScope: "test_fixture";
    error: Error;
    productionAuthority: false;
    retainedEvidence: Readonly<{
      binaryPresent: boolean;
      rootEntryKinds: readonly (
        | "published_binary"
        | "retained_stage"
        | "unexpected"
      )[];
      rootMode: number;
      stageEntryNames: readonly string[];
      stageMode: number | null;
    }>;
    retentionDisposition:
      PlatformReleaseContentStoreDarwinFilesystemRetentionDispositionV2;
    scenario:
      PlatformReleaseContentStoreDarwinFilesystemBuilderFaultScenarioForTestV2;
  }>;

export type PlatformReleaseContentStoreDarwinFilesystemFixtureInputV2 =
  Readonly<{
    rootDescriptor: number;
    root: PlatformReleaseContentStoreDarwinFilesystemExpectedDirectoryV2;
    locks: PlatformReleaseContentStoreDarwinFilesystemExpectedDirectoryV2;
    staging: PlatformReleaseContentStoreDarwinFilesystemExpectedDirectoryV2;
    releases: PlatformReleaseContentStoreDarwinFilesystemExpectedDirectoryV2;
    attestations: PlatformReleaseContentStoreDarwinFilesystemExpectedDirectoryV2;
    manifestPayloadHash: string;
    attestationHash: string;
    manifestBytes: Buffer;
    attestationBytes: Buffer;
    checkpoint: 0;
  }>;

export type PlatformReleaseContentStoreDarwinFilesystemCheckpointInputV2 =
  Omit<PlatformReleaseContentStoreDarwinFilesystemFixtureInputV2, "checkpoint">
  & Readonly<{
    checkpoint: Exclude<
      PlatformReleaseContentStoreDarwinFilesystemFixtureCheckpointV2,
      0
    >;
  }>;

export type PlatformReleaseContentStoreDarwinFilesystemStoppedObservationV2 =
  Readonly<{
    processId: number;
    processState: string;
  }>;

export type PlatformReleaseContentStoreDarwinFilesystemCheckpointCrashV2 =
  Readonly<{
    activeRunReleased: true;
    admissionScope: "test_fixture";
    binaryFencePreserved: true;
    callerDescriptorPreserved: true;
    checkpoint: Exclude<
      PlatformReleaseContentStoreDarwinFilesystemFixtureCheckpointV2,
      0
    >;
    exitCode: null;
    productionAuthority: false;
    schema:
      "setfarm.platform-release-content-store-filesystem-fixture-checkpoint-crash.v2";
    signal: "SIGKILL";
    stderrByteLength: 0;
    stdoutByteLength: 0;
  }>;

export type PlatformReleaseContentStoreDarwinFilesystemPhysicalEvidenceV2 =
  Readonly<{
    byteLength: string;
    changedNanoseconds: string;
    changedSeconds: string;
    device: string;
    inode: string;
    linkCount: string;
    mode: number;
    modifiedNanoseconds: string;
    modifiedSeconds: string;
    ownerGid: string;
    ownerUid: string;
  }>;

export type PlatformReleaseContentStoreDarwinFilesystemFailureV2 = Readonly<{
  cleanupCode: number;
  cleanupCodeName: string;
  cleanupErrno: number;
  lastCheckpoint: number;
  leaseCode: number;
  leaseCodeName: string;
  leaseErrno: number;
  primaryCode: number;
  primaryCodeName: string;
  primaryErrno: number;
  terminalCode: number;
  terminalCodeName: string;
}>;

export type PlatformReleaseContentStoreDarwinFilesystemPublicationResultV2 =
  Readonly<{
    attestationDisposition: "none" | "published" | "adopted_identical";
    attestationLeaseAcquired: boolean;
    attestationLeaseRecovered: boolean;
    authenticatedLeaseLedgerPresent: false;
    contentLeaseAcquired: boolean;
    contentLeaseRecovered: boolean;
    evidence: Readonly<{
      attestation: PlatformReleaseContentStoreDarwinFilesystemPhysicalEvidenceV2;
      attestations: PlatformReleaseContentStoreDarwinFilesystemPhysicalEvidenceV2;
      locks: PlatformReleaseContentStoreDarwinFilesystemPhysicalEvidenceV2;
      manifest: PlatformReleaseContentStoreDarwinFilesystemPhysicalEvidenceV2;
      releaseRoot: PlatformReleaseContentStoreDarwinFilesystemPhysicalEvidenceV2;
      releases: PlatformReleaseContentStoreDarwinFilesystemPhysicalEvidenceV2;
      root: PlatformReleaseContentStoreDarwinFilesystemPhysicalEvidenceV2;
      staging: PlatformReleaseContentStoreDarwinFilesystemPhysicalEvidenceV2;
    }>;
    leasesReleased: boolean;
    releaseDisposition: "none" | "published" | "adopted_identical";
    sameUidAtomicConditionalUnlinkAvailable: false;
    stageCleaned: boolean;
    staleLeaseRecoveryPolicy:
      "unauthenticated_fixture_exact_inode_and_f_tlock_only_v2";
    unauthenticatedStaleLeaseRecoveryEnabled: true;
    unlinkAuthorityPolicy:
      "preserve_unless_exact_identity_revalidated_no_same_uid_atomic_unlink_v2";
    unlinkAuthorityPolicyCode: 1;
  }>;

type PlatformReleaseContentStoreDarwinFilesystemFixtureResultBaseV2 = Readonly<{
  admissionScope: "test_fixture";
  capability: typeof CAPABILITY_V2;
  error: PlatformReleaseContentStoreDarwinFilesystemFailureV2;
  productionAuthority: false;
  result: PlatformReleaseContentStoreDarwinFilesystemPublicationResultV2;
  schema: typeof RESULT_SCHEMA_V2;
}>;

export type PlatformReleaseContentStoreDarwinFilesystemFixtureRunResultV2 =
  | (PlatformReleaseContentStoreDarwinFilesystemFixtureResultBaseV2 &
    Readonly<{ status: "ok" }>)
  | (PlatformReleaseContentStoreDarwinFilesystemFixtureResultBaseV2 &
    Readonly<{ status: "error" }>);

export type PlatformReleaseContentStoreDarwinFilesystemFixtureErrorCodeV2 =
  | "CONTENT_STORE_DARWIN_FIXTURE_PLATFORM_UNAVAILABLE"
  | "CONTENT_STORE_DARWIN_FIXTURE_BUILD_FAILED"
  | "CONTENT_STORE_DARWIN_FIXTURE_HANDLE_UNAUTHENTICATED"
  | "CONTENT_STORE_DARWIN_FIXTURE_INPUT_INVALID"
  | "CONTENT_STORE_DARWIN_FIXTURE_PROCESS_INVALID"
  | "CONTENT_STORE_DARWIN_FIXTURE_OUTPUT_INVALID"
  | "CONTENT_STORE_DARWIN_FIXTURE_DISPOSE_INVALID";

export class PlatformReleaseContentStoreDarwinFilesystemFixtureErrorV2
  extends TypeError {
  constructor(
    readonly code: PlatformReleaseContentStoreDarwinFilesystemFixtureErrorCodeV2,
    message: string,
    options: ErrorOptions = {},
  ) {
    super(message.slice(0, 1_500), options);
    this.name = "PlatformReleaseContentStoreDarwinFilesystemFixtureErrorV2";
  }
}

type FilePinV2 = Readonly<{
  device: bigint;
  inode: bigint;
  ownerUid: bigint;
  ownerGid: bigint;
  mode: bigint;
  linkCount: bigint;
  byteLength: bigint;
  modifiedNanoseconds: bigint;
  changedNanoseconds: bigint;
}>;

type DirectoryPinV2 = Readonly<{
  device: bigint;
  inode: bigint;
  ownerUid: bigint;
  ownerGid: bigint;
  mode: bigint;
}>;

type FixtureStateV2 = {
  alias: string;
  root: string;
  rootPin: DirectoryPinV2;
  binary: string;
  binaryPin: FilePinV2;
  binarySha256: string;
  binaryByteLength: number;
  buildRecipeHash: string;
  stage: string;
  stageName: string;
  stagePin: DirectoryPinV2;
  stageEntryPins: ReadonlyMap<string, FilePinV2>;
  activeRuns: number;
  lifecycle: "active";
};

type BuildRootV2 = Readonly<{
  alias: string;
  root: string;
  initialPin: DirectoryPinV2;
}>;

const fixtureStatesV2 = new WeakMap<object, FixtureStateV2>();

function failV2(
  code: PlatformReleaseContentStoreDarwinFilesystemFixtureErrorCodeV2,
  message: string,
  cause?: unknown,
): never {
  throw new PlatformReleaseContentStoreDarwinFilesystemFixtureErrorV2(
    code,
    message,
    cause === undefined ? {} : { cause },
  );
}

function errorV2(
  code: PlatformReleaseContentStoreDarwinFilesystemFixtureErrorCodeV2,
  message: string,
  cause?: unknown,
): PlatformReleaseContentStoreDarwinFilesystemFixtureErrorV2 {
  return new PlatformReleaseContentStoreDarwinFilesystemFixtureErrorV2(
    code,
    message,
    cause === undefined ? {} : { cause },
  );
}

function sha256V2(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function exactRecordV2(
  value: unknown,
  keys: readonly string[],
  code: PlatformReleaseContentStoreDarwinFilesystemFixtureErrorCodeV2,
  label: string,
  ordered = false,
): asserts value is Record<string, unknown> {
  if (
    typeof value !== "object"
    || value === null
    || Array.isArray(value)
    || isProxy(value)
    || Object.getPrototypeOf(value) !== Object.prototype
    || Reflect.ownKeys(value).some((key) => typeof key !== "string")
  ) {
    failV2(code, `${label} must be one exact plain record`);
  }
  const observed = Object.keys(value);
  const expected = ordered ? [...keys] : [...keys].sort();
  const projected = ordered ? observed : [...observed].sort();
  if (
    projected.length !== expected.length
    || projected.some((key, index) => key !== expected[index])
  ) {
    failV2(code, `${label} has an unexpected field set or wire order`);
  }
}

function pinDirectoryV2(status: BigIntStats): DirectoryPinV2 {
  return Object.freeze({
    device: status.dev,
    inode: status.ino,
    ownerUid: status.uid,
    ownerGid: status.gid,
    mode: status.mode,
  });
}

function pinFileV2(status: BigIntStats): FilePinV2 {
  return Object.freeze({
    device: status.dev,
    inode: status.ino,
    ownerUid: status.uid,
    ownerGid: status.gid,
    mode: status.mode,
    linkCount: status.nlink,
    byteLength: status.size,
    modifiedNanoseconds: status.mtimeNs,
    changedNanoseconds: status.ctimeNs,
  });
}

function sameDirectoryPinV2(status: BigIntStats, pin: DirectoryPinV2): boolean {
  return status.dev === pin.device
    && status.ino === pin.inode
    && status.uid === pin.ownerUid
    && status.gid === pin.ownerGid
    && status.mode === pin.mode;
}

function sameFilePinV2(status: BigIntStats, pin: FilePinV2): boolean {
  return status.dev === pin.device
    && status.ino === pin.inode
    && status.uid === pin.ownerUid
    && status.gid === pin.ownerGid
    && status.mode === pin.mode
    && status.nlink === pin.linkCount
    && status.size === pin.byteLength
    && status.mtimeNs === pin.modifiedNanoseconds
    && status.ctimeNs === pin.changedNanoseconds;
}

function processOwnerV2(status: BigIntStats): boolean {
  const getuid = process.getuid;
  const getgid = process.getgid;
  return getuid !== undefined
    && getgid !== undefined
    && status.uid === BigInt(getuid())
    && status.gid === BigInt(getgid());
}

function captureBinaryV2(
  binary: string,
  beforeReadForTest?: () => void,
): Readonly<{
  bytes: Buffer;
  pin: FilePinV2;
  sha256: string;
  byteLength: number;
}> {
  let descriptor: number;
  try {
    descriptor = openSync(
      binary,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
  } catch (error) {
    failV2(
      "CONTENT_STORE_DARWIN_FIXTURE_BUILD_FAILED",
      "Native content-store fixture binary could not be opened without following links",
      error,
    );
  }
  let bytes = Buffer.alloc(0);
  let captured: Readonly<{
    bytes: Buffer;
    pin: FilePinV2;
    sha256: string;
    byteLength: number;
  }> | undefined;
  let primary: unknown;
  try {
    const descriptorBefore = fstatSync(descriptor, { bigint: true });
    const descriptorPin = pinFileV2(descriptorBefore);
    const pathBefore = lstatSync(binary, { bigint: true });
    if (
      !descriptorBefore.isFile()
      || descriptorBefore.isSymbolicLink()
      || descriptorBefore.size < 1n
      || descriptorBefore.size > BigInt(MAX_BINARY_BYTES_V2)
      || descriptorBefore.nlink !== 1n
      || (descriptorBefore.mode & 0o7777n) !== 0o500n
      || !processOwnerV2(descriptorBefore)
      || !sameFilePinV2(pathBefore, descriptorPin)
      || realpathSync(binary) !== binary
    ) {
      failV2(
        "CONTENT_STORE_DARWIN_FIXTURE_BUILD_FAILED",
        "Native content-store fixture binary is not one exact owned mode-0500 file",
      );
    }
    beforeReadForTest?.();
    const byteLength = Number(descriptorBefore.size);
    bytes = Buffer.allocUnsafeSlow(byteLength);
    let offset = 0;
    while (offset < byteLength) {
      const count = readSync(
        descriptor,
        bytes,
        offset,
        byteLength - offset,
        offset,
      );
      if (count < 1) {
        failV2(
          "CONTENT_STORE_DARWIN_FIXTURE_BUILD_FAILED",
          "Native content-store fixture binary reached EOF before its descriptor length",
        );
      }
      offset += count;
    }
    const eof = Buffer.alloc(1);
    const grew = readSync(descriptor, eof, 0, 1, byteLength) !== 0;
    eof.fill(0);
    if (grew) {
      failV2(
        "CONTENT_STORE_DARWIN_FIXTURE_BUILD_FAILED",
        "Native content-store fixture binary grew beyond its descriptor length",
      );
    }
    const descriptorAfter = fstatSync(descriptor, { bigint: true });
    const pathAfter = lstatSync(binary, { bigint: true });
    if (
      bytes.byteLength !== byteLength
      || !sameFilePinV2(descriptorAfter, descriptorPin)
      || !sameFilePinV2(pathAfter, descriptorPin)
    ) {
      bytes.fill(0);
      failV2(
        "CONTENT_STORE_DARWIN_FIXTURE_BUILD_FAILED",
        "Native content-store fixture binary changed during capture",
      );
    }
    captured = Object.freeze({
      bytes,
      pin: descriptorPin,
      sha256: sha256V2(bytes),
      byteLength: bytes.byteLength,
    });
  } catch (error) {
    primary = error;
  }
  let closeFailure: unknown;
  try {
    closeSync(descriptor);
  } catch (error) {
    closeFailure = error;
  }
  if (primary !== undefined || closeFailure !== undefined) {
    bytes.fill(0);
    if (primary !== undefined && closeFailure !== undefined) {
      failV2(
        "CONTENT_STORE_DARWIN_FIXTURE_BUILD_FAILED",
        "Native content-store fixture capture and descriptor close both failed",
        new AggregateError(
          [primary, closeFailure],
          "Native content-store fixture capture and descriptor close failures",
          { cause: primary },
        ),
      );
    }
    if (
      primary
        instanceof PlatformReleaseContentStoreDarwinFilesystemFixtureErrorV2
    ) {
      throw primary;
    }
    failV2(
      "CONTENT_STORE_DARWIN_FIXTURE_BUILD_FAILED",
      "Native content-store fixture descriptor capture failed",
      primary ?? closeFailure,
    );
  }
  if (captured === undefined) {
    bytes.fill(0);
    failV2(
      "CONTENT_STORE_DARWIN_FIXTURE_BUILD_FAILED",
      "Native content-store fixture capture ended without exact evidence",
    );
  }
  return captured;
}

export function capturePlatformReleaseContentStoreDarwinFilesystemBinaryAtReadForTestV2(
  binary: string,
  beforeRead: () => void,
): Readonly<{
  admissionScope: "test_fixture";
  productionAuthority: false;
  binarySha256: string;
  binaryByteLength: number;
}> {
  if (typeof beforeRead !== "function" || isProxy(beforeRead)) {
    failV2(
      "CONTENT_STORE_DARWIN_FIXTURE_INPUT_INVALID",
      "Content-store binary capture test hook must be one exact function",
    );
  }
  const capture = captureBinaryV2(binary, beforeRead);
  try {
    return Object.freeze({
      admissionScope: "test_fixture" as const,
      productionAuthority: false as const,
      binarySha256: capture.sha256,
      binaryByteLength: capture.byteLength,
    });
  } finally {
    capture.bytes.fill(0);
  }
}

function parseBuildReceiptV2(stdout: Buffer): Readonly<{
  buildRecipeHash: string;
  binarySha256: string;
  binaryByteLength: number;
  stableIdentity: Readonly<{
    device: string;
    inode: string;
    objectKind: "ordinary_file";
  }>;
}> {
  if (stdout.byteLength < 2 || stdout.byteLength > MAX_BUILD_STDOUT_BYTES_V2) {
    failV2(
      "CONTENT_STORE_DARWIN_FIXTURE_BUILD_FAILED",
      "Native content-store builder returned an out-of-bounds receipt",
    );
  }
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(stdout);
  } catch (error) {
    failV2(
      "CONTENT_STORE_DARWIN_FIXTURE_BUILD_FAILED",
      "Native content-store builder receipt is not strict UTF-8",
      error,
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    failV2(
      "CONTENT_STORE_DARWIN_FIXTURE_BUILD_FAILED",
      "Native content-store builder receipt is not JSON",
      error,
    );
  }
  exactRecordV2(
    parsed,
    [
      "admissionScope",
      "binary",
      "buildRecipeHash",
      "productionAuthority",
      "publicationPolicy",
      "schema",
      "signingAuthority",
      "stageWorkspacePolicy",
      "trustConclusion",
    ],
    "CONTENT_STORE_DARWIN_FIXTURE_BUILD_FAILED",
    "Native content-store builder receipt",
    true,
  );
  exactRecordV2(
    parsed.binary,
    ["architectureSet", "byteLength", "mode", "sha256", "stableIdentity"],
    "CONTENT_STORE_DARWIN_FIXTURE_BUILD_FAILED",
    "Native content-store builder binary receipt",
    true,
  );
  const binary = parsed.binary;
  exactRecordV2(
    binary.stableIdentity,
    ["device", "inode", "objectKind"],
    "CONTENT_STORE_DARWIN_FIXTURE_BUILD_FAILED",
    "Native content-store builder stable binary identity",
    true,
  );
  const stableIdentity = binary.stableIdentity;
  if (
    text !== JSON.stringify(parsed)
    || parsed.schema !== BUILD_RECEIPT_SCHEMA_V2
    || parsed.admissionScope !== "test_fixture"
    || parsed.productionAuthority !== false
    || parsed.signingAuthority !== "adhoc_or_unsigned_test_fixture"
    || parsed.publicationPolicy !== PUBLICATION_POLICY_V2
    || parsed.stageWorkspacePolicy !== STAGE_WORKSPACE_POLICY_V2
    || parsed.trustConclusion !== "characterization_only"
    || typeof parsed.buildRecipeHash !== "string"
    || !/^[a-f0-9]{64}$/u.test(parsed.buildRecipeHash)
    || !Array.isArray(binary.architectureSet)
    || binary.architectureSet.length !== 2
    || binary.architectureSet[0] !== "arm64"
    || binary.architectureSet[1] !== "x86_64"
    || typeof binary.byteLength !== "number"
    || !Number.isSafeInteger(binary.byteLength)
    || binary.byteLength < 1
    || binary.byteLength > MAX_BINARY_BYTES_V2
    || binary.mode !== "0500"
    || typeof binary.sha256 !== "string"
    || !/^[a-f0-9]{64}$/u.test(binary.sha256)
    || stableIdentity.objectKind !== "ordinary_file"
    || typeof stableIdentity.device !== "string"
    || !/^(?:0|[1-9][0-9]*)$/u.test(stableIdentity.device)
    || typeof stableIdentity.inode !== "string"
    || !/^(?:0|[1-9][0-9]*)$/u.test(stableIdentity.inode)
  ) {
    failV2(
      "CONTENT_STORE_DARWIN_FIXTURE_BUILD_FAILED",
      "Native content-store builder receipt failed its exact non-authority schema",
    );
  }
  return Object.freeze({
    buildRecipeHash: parsed.buildRecipeHash,
    binarySha256: binary.sha256,
    binaryByteLength: binary.byteLength,
    stableIdentity: Object.freeze({
      device: stableIdentity.device,
      inode: stableIdentity.inode,
      objectKind: "ordinary_file" as const,
    }),
  });
}

function assertPinnedFileCurrentV2(binary: string, pin: FilePinV2): void {
  let descriptor: number | undefined;
  try {
    const before = lstatSync(binary, { bigint: true });
    descriptor = openSync(
      binary,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
    const descriptorStatus = fstatSync(descriptor, { bigint: true });
    const after = lstatSync(binary, { bigint: true });
    if (
      before.isSymbolicLink()
      || !before.isFile()
      || descriptorStatus.isSymbolicLink()
      || !descriptorStatus.isFile()
      || after.isSymbolicLink()
      || !after.isFile()
      || !sameFilePinV2(before, pin)
      || !sameFilePinV2(descriptorStatus, pin)
      || !sameFilePinV2(after, pin)
    ) {
      throw new Error("build binary identity or shape changed");
    }
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function throwBuildFailureV2(primary: unknown): never {
  if (primary instanceof PlatformReleaseContentStoreDarwinFilesystemFixtureErrorV2) {
    throw primary;
  }
  failV2(
    "CONTENT_STORE_DARWIN_FIXTURE_BUILD_FAILED",
    "Native content-store fixture build failed",
    primary,
  );
}

function createBuildRootV2(): BuildRootV2 {
  const alias = mkdtempSync(path.join(os.tmpdir(), BUILD_PARENT_PREFIX_V2));
  try {
    const root = realpathSync(alias);
    chmodSync(root, 0o700);
    const status = lstatSync(root, { bigint: true });
    const initialPin = pinDirectoryV2(status);
    assertRootCurrentV2(
      alias,
      root,
      [],
      initialPin,
      "CONTENT_STORE_DARWIN_FIXTURE_BUILD_FAILED",
    );
    if (
      status.isSymbolicLink()
      || !status.isDirectory()
      || !processOwnerV2(status)
      || (status.mode & 0o7777n) !== 0o700n
      || root === REPOSITORY_ROOT_V2
      || root.startsWith(`${REPOSITORY_ROOT_V2}${path.sep}`)
    ) {
      failV2(
        "CONTENT_STORE_DARWIN_FIXTURE_BUILD_FAILED",
        "Native content-store build parent is not one external empty private directory",
      );
    }
    return Object.freeze({ alias, root, initialPin });
  } catch (primary) {
    // The root is deliberately retained. Node path APIs cannot atomically
    // condition deletion on the directory identity observed above.
    throwBuildFailureV2(primary);
  }
}

function assertDirectoryCurrentV2(
  directoryPath: string,
  expectedEntries: readonly string[],
  expectedPin: DirectoryPinV2,
  code: PlatformReleaseContentStoreDarwinFilesystemFixtureErrorCodeV2,
  label: string,
): BigIntStats {
  let descriptor: number | undefined;
  try {
    const before = lstatSync(directoryPath, { bigint: true });
    descriptor = openSync(
      directoryPath,
      constants.O_RDONLY
        | constants.O_DIRECTORY
        | constants.O_NOFOLLOW
        | constants.O_NONBLOCK,
    );
    const descriptorStatus = fstatSync(descriptor, { bigint: true });
    const entries = exactBoundedDirectoryNamesV2(
      directoryPath,
      expectedEntries.length,
      code,
      label,
    );
    const after = lstatSync(directoryPath, { bigint: true });
    if (
      before.isSymbolicLink()
      || !before.isDirectory()
      || descriptorStatus.isSymbolicLink()
      || !descriptorStatus.isDirectory()
      || after.isSymbolicLink()
      || !after.isDirectory()
      || !processOwnerV2(before)
      || !processOwnerV2(descriptorStatus)
      || !processOwnerV2(after)
      || (before.mode & 0o7777n) !== 0o700n
      || realpathSync(directoryPath) !== directoryPath
      || !sameDirectoryPinV2(before, expectedPin)
      || !sameDirectoryPinV2(descriptorStatus, expectedPin)
      || !sameDirectoryPinV2(after, expectedPin)
      || entries.length !== expectedEntries.length
      || entries.some((entry, index) => entry !== expectedEntries[index])
    ) {
      failV2(
        code,
        `${label} changed or contains unexpected entries`,
      );
    }
    return before;
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function assertRootCurrentV2(
  alias: string,
  root: string,
  expectedEntries: readonly string[],
  expectedPin: DirectoryPinV2,
  code: PlatformReleaseContentStoreDarwinFilesystemFixtureErrorCodeV2,
): void {
  const aliasBefore = lstatSync(alias, { bigint: true });
  assertDirectoryCurrentV2(
    root,
    expectedEntries,
    expectedPin,
    code,
    "Native content-store retained build root",
  );
  const aliasAfter = lstatSync(alias, { bigint: true });
  if (
    realpathSync(alias) !== root
    || !sameDirectoryPinV2(aliasBefore, expectedPin)
    || !sameDirectoryPinV2(aliasAfter, expectedPin)
  ) {
    failV2(code, "Native content-store retained build-root alias changed");
  }
}

function exactBoundedDirectoryNamesV2(
  directoryPath: string,
  maximum: number,
  code: PlatformReleaseContentStoreDarwinFilesystemFixtureErrorCodeV2,
  label: string,
): string[] {
  let directory: ReturnType<typeof opendirSync> | undefined;
  let primary: unknown;
  const entries: string[] = [];
  try {
    directory = opendirSync(directoryPath, { bufferSize: 1 });
    while (true) {
      const entry = directory.readSync();
      if (entry === null) break;
      if (entries.length >= maximum) {
        failV2(
          code,
          `${label} exceeds its bounded member count`,
        );
      }
      entries.push(entry.name);
    }
  } catch (error) {
    primary = error;
  }
  let closeFailure: unknown;
  try {
    directory?.closeSync();
  } catch (error) {
    closeFailure = error;
  }
  if (primary !== undefined && closeFailure !== undefined) {
    failV2(
      code,
      `${label} read and close both failed`,
      new AggregateError(
        [primary, closeFailure],
        `${label} read and close failures`,
        { cause: primary },
      ),
    );
  }
  if (
    primary
      instanceof PlatformReleaseContentStoreDarwinFilesystemFixtureErrorV2
  ) {
    throw primary;
  }
  if (primary !== undefined || closeFailure !== undefined) {
    failV2(
      code,
      `${label} cannot be read exactly`,
      primary ?? closeFailure,
    );
  }
  return entries.sort();
}

function captureRetainedStageEntryPinV2(
  entryPath: string,
  expectedMode: 0o400 | 0o500,
): FilePinV2 {
  let descriptor: number | undefined;
  try {
    descriptor = openSync(
      entryPath,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
    const descriptorStatus = fstatSync(descriptor, { bigint: true });
    const pin = pinFileV2(descriptorStatus);
    const pathStatus = lstatSync(entryPath, { bigint: true });
    if (
      !descriptorStatus.isFile()
      || descriptorStatus.isSymbolicLink()
      || descriptorStatus.size < 1n
      || descriptorStatus.size > BigInt(MAX_BINARY_BYTES_V2)
      || descriptorStatus.nlink !== 1n
      || !processOwnerV2(descriptorStatus)
      || (descriptorStatus.mode & 0o7777n) !== BigInt(expectedMode)
      || !sameFilePinV2(pathStatus, pin)
    ) {
      failV2(
        "CONTENT_STORE_DARWIN_FIXTURE_BUILD_FAILED",
        "Native content-store retained stage entry has invalid physical identity",
      );
    }
    return pin;
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function captureRetainedStageV2(
  buildRoot: BuildRootV2,
): Readonly<{
  stage: string;
  stageName: string;
  stagePin: DirectoryPinV2;
  stageEntryPins: ReadonlyMap<string, FilePinV2>;
  stageBinarySha256: string;
  stageBinaryByteLength: number;
}> {
  const rootNames = exactBoundedDirectoryNamesV2(
    buildRoot.root,
    2,
    "CONTENT_STORE_DARWIN_FIXTURE_BUILD_FAILED",
    "Native content-store retained build root",
  );
  const stageNames = rootNames.filter((name) => name !== BINARY_BASENAME_V2);
  if (
    rootNames.length !== 2
    || !rootNames.includes(BINARY_BASENAME_V2)
    || stageNames.length !== 1
    || !stageNames[0]!.startsWith(RETAINED_STAGE_PREFIX_V2)
    || stageNames[0]!.length <= RETAINED_STAGE_PREFIX_V2.length
    || path.basename(stageNames[0]!) !== stageNames[0]
  ) {
    failV2(
      "CONTENT_STORE_DARWIN_FIXTURE_BUILD_FAILED",
      "Native content-store build did not retain one exact private stage",
    );
  }
  const stageName = stageNames[0]!;
  const stage = path.join(buildRoot.root, stageName);
  const stageStatus = lstatSync(stage, { bigint: true });
  if (
    stageStatus.isSymbolicLink()
    || !stageStatus.isDirectory()
    || !processOwnerV2(stageStatus)
    || (stageStatus.mode & 0o7777n) !== 0o700n
    || realpathSync(stage) !== stage
  ) {
    failV2(
      "CONTENT_STORE_DARWIN_FIXTURE_BUILD_FAILED",
      "Native content-store retained stage root has invalid physical identity",
    );
  }
  const stagePin = pinDirectoryV2(stageStatus);
  assertDirectoryCurrentV2(
    stage,
    RETAINED_STAGE_ENTRY_NAMES_V2,
    stagePin,
    "CONTENT_STORE_DARWIN_FIXTURE_BUILD_FAILED",
    "Native content-store retained stage",
  );
  const stageEntryPins = new Map<string, FilePinV2>();
  for (const name of RETAINED_STAGE_ENTRY_NAMES_V2) {
    stageEntryPins.set(
      name,
      captureRetainedStageEntryPinV2(
        path.join(stage, name),
        name === BINARY_BASENAME_V2 ? 0o500 : 0o400,
      ),
    );
  }
  const stageBinary = captureBinaryV2(path.join(stage, BINARY_BASENAME_V2));
  try {
    assertRootCurrentV2(
      buildRoot.alias,
      buildRoot.root,
      [stageName, BINARY_BASENAME_V2].sort(),
      buildRoot.initialPin,
      "CONTENT_STORE_DARWIN_FIXTURE_BUILD_FAILED",
    );
    assertDirectoryCurrentV2(
      stage,
      RETAINED_STAGE_ENTRY_NAMES_V2,
      stagePin,
      "CONTENT_STORE_DARWIN_FIXTURE_BUILD_FAILED",
      "Native content-store retained stage",
    );
    return Object.freeze({
      stage,
      stageName,
      stagePin,
      stageEntryPins,
      stageBinarySha256: stageBinary.sha256,
      stageBinaryByteLength: stageBinary.byteLength,
    });
  } finally {
    stageBinary.bytes.fill(0);
  }
}

function assertRetainedWorkspaceCurrentV2(state: FixtureStateV2): void {
  assertRootCurrentV2(
    state.alias,
    state.root,
    [state.stageName, BINARY_BASENAME_V2].sort(),
    state.rootPin,
    "CONTENT_STORE_DARWIN_FIXTURE_HANDLE_UNAUTHENTICATED",
  );
  assertDirectoryCurrentV2(
    state.stage,
    RETAINED_STAGE_ENTRY_NAMES_V2,
    state.stagePin,
    "CONTENT_STORE_DARWIN_FIXTURE_HANDLE_UNAUTHENTICATED",
    "Authenticated content-store retained stage",
  );
  for (const [name, pin] of state.stageEntryPins) {
    assertPinnedFileCurrentV2(path.join(state.stage, name), pin);
  }
}

function assertBinaryCurrentV2(state: FixtureStateV2): void {
  let capture: ReturnType<typeof captureBinaryV2>;
  try {
    assertRetainedWorkspaceCurrentV2(state);
    capture = captureBinaryV2(state.binary);
  } catch (error) {
    failV2(
      "CONTENT_STORE_DARWIN_FIXTURE_HANDLE_UNAUTHENTICATED",
      "Authenticated content-store fixture binary is no longer capturable",
      error,
    );
  }
  try {
    if (
      !sameFilePinV2(lstatSync(state.binary, { bigint: true }), state.binaryPin)
      || capture.sha256 !== state.binarySha256
      || capture.byteLength !== state.binaryByteLength
    ) {
      failV2(
        "CONTENT_STORE_DARWIN_FIXTURE_HANDLE_UNAUTHENTICATED",
        "Authenticated content-store fixture binary drifted",
      );
    }
  } finally {
    capture.bytes.fill(0);
  }
}

function disposeFixtureV2(
  handle: PlatformReleaseContentStoreDarwinFilesystemFixtureV2,
): PlatformReleaseContentStoreDarwinFilesystemRetentionDispositionV2 {
  if (isProxy(handle)) {
    failV2(
      "CONTENT_STORE_DARWIN_FIXTURE_HANDLE_UNAUTHENTICATED",
      "Content-store fixture handle must not be a proxy",
    );
  }
  const state = fixtureStatesV2.get(handle);
  if (state === undefined) {
    failV2(
      "CONTENT_STORE_DARWIN_FIXTURE_HANDLE_UNAUTHENTICATED",
      "Content-store fixture handle is not active",
    );
  }
  if (state.activeRuns !== 0) {
    failV2(
      "CONTENT_STORE_DARWIN_FIXTURE_DISPOSE_INVALID",
      "Content-store fixture cannot be disposed during an active native invocation",
    );
  }
  fixtureStatesV2.delete(handle);
  return retainedWorkspaceDispositionV2();
}

function retainedWorkspaceDispositionV2():
  PlatformReleaseContentStoreDarwinFilesystemRetentionDispositionV2 {
  return Object.freeze({
    schema: RETENTION_DISPOSITION_SCHEMA_V2,
    admissionScope: "test_fixture",
    productionAuthority: false,
    deletionAuthority: false,
    filesystemMutationPerformed: false,
    rootDisposition: "retained_no_atomic_same_uid_conditional_delete_v2",
  });
}

type ContainedBuildResultV2 = Readonly<{
  stdout: Buffer;
  stderr: Buffer;
}>;

function processGroupAliveV2(processGroupId: number): boolean {
  try {
    process.kill(-processGroupId, 0);
    return true;
  } catch (error) {
    return !(error instanceof Error && "code" in error && error.code === "ESRCH");
  }
}

async function waitForProcessGroupDeathV2(
  processGroupId: number,
): Promise<boolean> {
  for (let attempt = 0; attempt < PROCESS_GROUP_DEATH_ATTEMPTS_V2; attempt += 1) {
    if (!processGroupAliveV2(processGroupId)) return true;
    if (attempt + 1 < PROCESS_GROUP_DEATH_ATTEMPTS_V2) {
      await new Promise((resolve) =>
        setTimeout(resolve, PROCESS_GROUP_DEATH_INTERVAL_MILLISECONDS_V2));
    }
  }
  return !processGroupAliveV2(processGroupId);
}

async function waitForInjectedUnprovenContainmentForTestV2(): Promise<false> {
  for (let attempt = 1; attempt < PROCESS_GROUP_DEATH_ATTEMPTS_V2; attempt += 1) {
    await new Promise((resolve) =>
      setTimeout(resolve, PROCESS_GROUP_DEATH_INTERVAL_MILLISECONDS_V2));
  }
  return false;
}

type ContainedBuilderFaultForTestV2 =
  PlatformReleaseContentStoreDarwinFilesystemBuilderFaultScenarioForTestV2;

async function runContainedBuilderV2(
  buildRoot: BuildRootV2,
  binary: string,
  testFault?: ContainedBuilderFaultForTestV2,
): Promise<ContainedBuildResultV2> {
  const runnerFault = testFault !== undefined
    && testFault !== "nested_builder_invocation_failure";
  const executable = runnerFault && testFault !== "multi_chunk_output_overflow"
    ? "/bin/sleep"
    : process.execPath;
  const argv = testFault === "multi_chunk_output_overflow"
    ? [
      "-e",
      "const chunk = Buffer.alloc(64 * 1024, 120); for (let index = 0; index < 40; index += 1) { process.stdout.write(chunk); process.stderr.write(chunk); } setInterval(() => {}, 1000);",
      BUILDER_TEST_PROCESS_MARKER_V2,
    ]
    : runnerFault
      ? [BUILDER_TEST_TIMEOUT_DURATION_SECONDS_V2]
      : [BUILDER_V2, "--out-file", binary];
  const child = spawn(executable, argv, {
    cwd: buildRoot.root,
    detached: testFault === undefined,
    env: {
      HOME: "/var/empty",
      LANG: "C",
      LC_ALL: "C",
      PATH: "/usr/bin:/bin",
      SOURCE_DATE_EPOCH: "0",
      TZ: "UTC",
      ...(testFault === "nested_builder_invocation_failure"
        ? { SETFARM_CONTENT_STORE_FIXTURE_TEST_FORCE_TOOL_ERROR_V2: "1" }
        : {}),
    },
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const stdoutChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];
  const containmentErrors: Error[] = [];
  let stdoutByteLength = 0;
  let stderrByteLength = 0;
  let firstCause: Error | undefined;
  let outputLimitLatched = false;
  let terminationRequested = false;
  let settled = false;
  let settlementTimer: NodeJS.Timeout | undefined;
  let executionTimer: NodeJS.Timeout | undefined;
  let resolveSettlement!: (result: Readonly<{
    kind: "close" | "watchdog";
    code: number | null;
    signal: NodeJS.Signals | null;
  }>) => void;
  const settlement = new Promise<Readonly<{
    kind: "close" | "watchdog";
    code: number | null;
    signal: NodeJS.Signals | null;
  }>>((resolve) => {
    resolveSettlement = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    child.once("close", (code, signal) => {
      resolveSettlement({ kind: "close", code, signal });
    });
  });
  const signalDirectChild = (force = false): void => {
    if (
      child.pid === undefined
      || !Number.isSafeInteger(child.pid)
      || child.pid < 1
    ) {
      return;
    }
    if (testFault === "group_kill_failure_settlement_watchdog" && !force) {
      return;
    }
    try {
      child.kill("SIGKILL");
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ESRCH")) {
        containmentErrors.push(errorV2(
          "CONTENT_STORE_DARWIN_FIXTURE_BUILD_FAILED",
          "Native content-store fixture builder direct-child fallback failed",
          error,
        ));
      }
    }
  };
  const requestTermination = (): void => {
    if (terminationRequested) return;
    terminationRequested = true;
    if (!settled) {
      settlementTimer = setTimeout(() => {
        const error = errorV2(
          "CONTENT_STORE_DARWIN_FIXTURE_BUILD_FAILED",
          "Native content-store fixture builder did not settle after termination",
        );
        if (firstCause === undefined) firstCause = error;
        else containmentErrors.push(error);
        signalDirectChild(true);
        resolveSettlement({ kind: "watchdog", code: null, signal: null });
      }, PROCESS_SETTLEMENT_TIMEOUT_MILLISECONDS_V2);
    }
    if (child.pid === undefined) return;
    if (testFault !== undefined) {
      if (testFault === "group_kill_failure_settlement_watchdog") {
        containmentErrors.push(errorV2(
          "CONTENT_STORE_DARWIN_FIXTURE_BUILD_FAILED",
          "Native content-store fixture builder process-group kill failed",
          new Error(
            "Injected native content-store fixture builder process-group kill failure",
          ),
        ));
      }
      signalDirectChild();
      return;
    }
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ESRCH")) {
        containmentErrors.push(errorV2(
          "CONTENT_STORE_DARWIN_FIXTURE_BUILD_FAILED",
          "Native content-store fixture builder process-group kill failed",
          error,
        ));
        signalDirectChild();
      }
    }
  };
  const latchFailure = (error: Error): void => {
    if (firstCause === undefined) firstCause = error;
    else containmentErrors.push(error);
    requestTermination();
  };
  const captureOutput = (name: "stdout" | "stderr", chunk: Buffer): void => {
    const bytes = Buffer.from(chunk);
    if (outputLimitLatched || firstCause !== undefined) {
      bytes.fill(0);
      return;
    }
    const current = name === "stdout" ? stdoutByteLength : stderrByteLength;
    const maximum = name === "stdout"
      ? MAX_BUILD_STDOUT_BYTES_V2
      : MAX_BUILD_STDERR_BYTES_V2;
    if (current + bytes.byteLength > maximum) {
      outputLimitLatched = true;
      bytes.fill(0);
      latchFailure(errorV2(
        "CONTENT_STORE_DARWIN_FIXTURE_BUILD_FAILED",
        `Native content-store fixture builder exceeded bounded ${name}`,
      ));
      return;
    }
    if (name === "stdout") {
      stdoutChunks.push(bytes);
      stdoutByteLength += bytes.byteLength;
    } else {
      stderrChunks.push(bytes);
      stderrByteLength += bytes.byteLength;
    }
  };
  child.stdout.on("data", (chunk: Buffer) => captureOutput("stdout", chunk));
  child.stderr.on("data", (chunk: Buffer) => captureOutput("stderr", chunk));
  child.stdout.once("error", (error) => latchFailure(errorV2(
    "CONTENT_STORE_DARWIN_FIXTURE_BUILD_FAILED",
    "Native content-store fixture builder stdout stream failed",
    error,
  )));
  child.stderr.once("error", (error) => latchFailure(errorV2(
    "CONTENT_STORE_DARWIN_FIXTURE_BUILD_FAILED",
    "Native content-store fixture builder stderr stream failed",
    error,
  )));
  child.once("error", (error) => latchFailure(errorV2(
    "CONTENT_STORE_DARWIN_FIXTURE_BUILD_FAILED",
    "Native content-store fixture builder could not start",
    error,
  )));
  if (testFault === "stdout_stream_error") {
    queueMicrotask(() => {
      child.stdout.destroy(new Error(
        "Injected native content-store fixture builder stdout stream failure",
      ));
    });
  }
  if (testFault === "stderr_stream_error") {
    queueMicrotask(() => {
      child.stderr.destroy(new Error(
        "Injected native content-store fixture builder stderr stream failure",
      ));
    });
  }
  const executionTimeout = runnerFault
    && testFault !== "stdout_stream_error"
    && testFault !== "stderr_stream_error"
    && testFault !== "multi_chunk_output_overflow"
    ? BUILDER_TEST_TIMEOUT_MILLISECONDS_V2
    : BUILD_TIMEOUT_MILLISECONDS_V2;
  executionTimer = setTimeout(() => latchFailure(errorV2(
    "CONTENT_STORE_DARWIN_FIXTURE_BUILD_FAILED",
    `Native content-store fixture builder timed out after ${executionTimeout}ms`,
  )), executionTimeout);

  const result = await settlement;
  if (executionTimer !== undefined) clearTimeout(executionTimer);
  if (settlementTimer !== undefined) clearTimeout(settlementTimer);
  const stderrText = Buffer.concat(stderrChunks, stderrByteLength)
    .toString("utf8").slice(0, 600);
  if (firstCause === undefined && stderrByteLength !== 0) {
    firstCause = errorV2(
      "CONTENT_STORE_DARWIN_FIXTURE_BUILD_FAILED",
      `Native content-store fixture builder emitted stderr: ${stderrText}`,
    );
  }
  if (
    firstCause === undefined
    && (result.kind !== "close" || result.code !== 0 || result.signal !== null)
  ) {
    firstCause = errorV2(
      "CONTENT_STORE_DARWIN_FIXTURE_BUILD_FAILED",
      `Native content-store fixture builder failed code=${String(result.code)} signal=${String(result.signal)} stderr=${stderrText}`,
    );
  }
  if (
    testFault === undefined
    && child.pid !== undefined
    && Number.isSafeInteger(child.pid)
    && child.pid > 0
    && processGroupAliveV2(child.pid)
  ) {
    firstCause ??= errorV2(
      "CONTENT_STORE_DARWIN_FIXTURE_BUILD_FAILED",
      "Native content-store fixture builder left its outer process group alive",
    );
    requestTermination();
  }
  let containmentProven = true;
  if (
    testFault === "group_death_unproven"
    || testFault === "multi_chunk_output_overflow"
  ) {
    containmentProven = await waitForInjectedUnprovenContainmentForTestV2();
  } else if (
    testFault === undefined
    && child.pid !== undefined
    && Number.isSafeInteger(child.pid)
    && child.pid > 0
  ) {
    containmentProven = await waitForProcessGroupDeathV2(child.pid);
  }
  if (!containmentProven) {
    containmentErrors.push(errorV2(
      "CONTENT_STORE_DARWIN_FIXTURE_BUILD_FAILED",
      "Native content-store fixture builder process-group death was not proven by ESRCH",
    ));
  }
  if (firstCause !== undefined || containmentErrors.length > 0) {
    for (const chunk of stdoutChunks) chunk.fill(0);
    for (const chunk of stderrChunks) chunk.fill(0);
    const errors = firstCause === undefined
      ? containmentErrors
      : [firstCause, ...containmentErrors];
    if (errors.length === 1) throw errors[0];
    const aggregate = new AggregateError(
      errors,
      `Native content-store fixture builder and containment both failed: ${errors[0]!.message}`,
      { cause: errors[0] },
    );
    Object.assign(aggregate, { containmentProven });
    throw aggregate;
  }
  const stdout = Buffer.concat(stdoutChunks, stdoutByteLength);
  const stderr = Buffer.concat(stderrChunks, stderrByteLength);
  for (const chunk of stdoutChunks) chunk.fill(0);
  for (const chunk of stderrChunks) chunk.fill(0);
  return Object.freeze({ stdout, stderr });
}

function assertBuilderFaultScenarioForTestV2(
  scenario: unknown,
): asserts scenario is
  PlatformReleaseContentStoreDarwinFilesystemBuilderFaultScenarioForTestV2 {
  if (
    scenario !== "stdout_stream_error"
    && scenario !== "stderr_stream_error"
    && scenario !== "group_kill_failure_settlement_watchdog"
    && scenario !== "group_death_unproven"
    && scenario !== "multi_chunk_output_overflow"
    && scenario !== "nested_builder_invocation_failure"
  ) {
    failV2(
      "CONTENT_STORE_DARWIN_FIXTURE_INPUT_INVALID",
      "Content-store fixture builder runner test scenario is invalid",
    );
  }
}

function captureBuilderFaultRetainedEvidenceForTestV2(
  buildRoot: BuildRootV2,
): PlatformReleaseContentStoreDarwinFilesystemBuilderFaultObservationForTestV2[
  "retainedEvidence"
] {
  const rootEntryNames = exactBoundedDirectoryNamesV2(
    buildRoot.root,
    2,
    "CONTENT_STORE_DARWIN_FIXTURE_BUILD_FAILED",
    "Native content-store retained fault-observation root",
  );
  assertRootCurrentV2(
    buildRoot.alias,
    buildRoot.root,
    rootEntryNames,
    buildRoot.initialPin,
    "CONTENT_STORE_DARWIN_FIXTURE_BUILD_FAILED",
  );
  const retainedStageNames = rootEntryNames.filter((name) =>
    name.startsWith(RETAINED_STAGE_PREFIX_V2)
    && name.length > RETAINED_STAGE_PREFIX_V2.length
    && path.basename(name) === name);
  if (retainedStageNames.length > 1) {
    failV2(
      "CONTENT_STORE_DARWIN_FIXTURE_BUILD_FAILED",
      "Native content-store retained fault observation has multiple stages",
    );
  }
  let stageEntryNames: readonly string[] = Object.freeze([]);
  let stageMode: number | null = null;
  if (retainedStageNames.length === 1) {
    const stage = path.join(buildRoot.root, retainedStageNames[0]!);
    const stageStatus = lstatSync(stage, { bigint: true });
    if (
      stageStatus.isSymbolicLink()
      || !stageStatus.isDirectory()
      || !processOwnerV2(stageStatus)
      || (stageStatus.mode & 0o7777n) !== 0o700n
      || realpathSync(stage) !== stage
    ) {
      failV2(
        "CONTENT_STORE_DARWIN_FIXTURE_BUILD_FAILED",
        "Native content-store retained fault-observation stage is not one private directory",
      );
    }
    const stagePin = pinDirectoryV2(stageStatus);
    const capturedStageEntryNames = exactBoundedDirectoryNamesV2(
      stage,
      RETAINED_STAGE_ENTRY_NAMES_V2.length,
      "CONTENT_STORE_DARWIN_FIXTURE_BUILD_FAILED",
      "Native content-store retained fault-observation stage",
    );
    assertDirectoryCurrentV2(
      stage,
      capturedStageEntryNames,
      stagePin,
      "CONTENT_STORE_DARWIN_FIXTURE_BUILD_FAILED",
      "Native content-store retained fault-observation stage",
    );
    stageEntryNames = Object.freeze(capturedStageEntryNames);
    stageMode = Number(stagePin.mode & 0o7777n);
  }
  assertRootCurrentV2(
    buildRoot.alias,
    buildRoot.root,
    rootEntryNames,
    buildRoot.initialPin,
    "CONTENT_STORE_DARWIN_FIXTURE_BUILD_FAILED",
  );
  return Object.freeze({
    binaryPresent: rootEntryNames.includes(BINARY_BASENAME_V2),
    rootEntryKinds: Object.freeze(rootEntryNames.map((name) =>
      name === BINARY_BASENAME_V2
        ? "published_binary" as const
        : retainedStageNames.includes(name)
          ? "retained_stage" as const
          : "unexpected" as const)),
    rootMode: Number(buildRoot.initialPin.mode & 0o7777n),
    stageEntryNames,
    stageMode,
  });
}

export async function observePlatformReleaseContentStoreDarwinFilesystemBuilderFaultForTestV2(
  scenario:
    PlatformReleaseContentStoreDarwinFilesystemBuilderFaultScenarioForTestV2,
): Promise<
  PlatformReleaseContentStoreDarwinFilesystemBuilderFaultObservationForTestV2
> {
  if (process.platform !== "darwin") {
    failV2(
      "CONTENT_STORE_DARWIN_FIXTURE_PLATFORM_UNAVAILABLE",
      "Darwin content-store filesystem fixture requires macOS",
    );
  }
  assertBuilderFaultScenarioForTestV2(scenario);
  const buildRoot = createBuildRootV2();
  const binary = path.join(buildRoot.root, BINARY_BASENAME_V2);
  let observedError: Error | undefined;
  try {
    const unexpected = await runContainedBuilderV2(buildRoot, binary, scenario);
    unexpected.stdout.fill(0);
    unexpected.stderr.fill(0);
  } catch (error) {
    observedError = error instanceof Error
      ? error
      : errorV2(
        "CONTENT_STORE_DARWIN_FIXTURE_BUILD_FAILED",
        "Native content-store fixture builder failed with a non-Error cause",
        error,
      );
  }
  if (observedError === undefined) {
    failV2(
      "CONTENT_STORE_DARWIN_FIXTURE_BUILD_FAILED",
      "Content-store fixture builder runner test scenario did not fail closed",
    );
  }
  const retainedEvidence = captureBuilderFaultRetainedEvidenceForTestV2(
    buildRoot,
  );
  return Object.freeze({
    admissionScope: "test_fixture",
    error: observedError,
    productionAuthority: false,
    retainedEvidence,
    retentionDisposition: retainedWorkspaceDispositionV2(),
    scenario,
  });
}

async function buildFixtureV2(): Promise<
  PlatformReleaseContentStoreDarwinFilesystemFixtureV2
> {
  if (process.platform !== "darwin") {
    failV2(
      "CONTENT_STORE_DARWIN_FIXTURE_PLATFORM_UNAVAILABLE",
      "Darwin content-store filesystem fixture requires macOS",
    );
  }
  const buildRoot = createBuildRootV2();
  const binary = path.join(buildRoot.root, BINARY_BASENAME_V2);
  let built: ContainedBuildResultV2;
  try {
    built = await runContainedBuilderV2(buildRoot, binary);
  } catch (error) {
    // Outer process-group death cannot prove that an inner detached clang/xcrun
    // group is quiescent. Retain the complete root on every invocation failure.
    throwBuildFailureV2(error);
  }
  try {
    const receipt = parseBuildReceiptV2(built.stdout);
    const retainedStage = captureRetainedStageV2(buildRoot);
    const captured = captureBinaryV2(binary);
    try {
      if (
        receipt.binarySha256 !== captured.sha256
        || receipt.binaryByteLength !== captured.byteLength
        || receipt.stableIdentity.objectKind !== "ordinary_file"
        || receipt.stableIdentity.device !== captured.pin.device.toString()
        || receipt.stableIdentity.inode !== captured.pin.inode.toString()
        || retainedStage.stageBinarySha256 !== captured.sha256
        || retainedStage.stageBinaryByteLength !== captured.byteLength
      ) {
        failV2(
          "CONTENT_STORE_DARWIN_FIXTURE_BUILD_FAILED",
          "Native content-store fixture binary does not match its exact receipt and retained stage",
        );
      }
      let handle!: PlatformReleaseContentStoreDarwinFilesystemFixtureV2;
      handle = Object.freeze({
        buildRecipeHash: receipt.buildRecipeHash,
        binarySha256: receipt.binarySha256,
        binaryByteLength: receipt.binaryByteLength,
        dispose: () => disposeFixtureV2(handle),
      });
      fixtureStatesV2.set(handle, {
        alias: buildRoot.alias,
        root: buildRoot.root,
        rootPin: buildRoot.initialPin,
        binary,
        binaryPin: captured.pin,
        binarySha256: captured.sha256,
        binaryByteLength: captured.byteLength,
        buildRecipeHash: receipt.buildRecipeHash,
        stage: retainedStage.stage,
        stageName: retainedStage.stageName,
        stagePin: retainedStage.stagePin,
        stageEntryPins: retainedStage.stageEntryPins,
        activeRuns: 0,
        lifecycle: "active",
      });
      return handle;
    } finally {
      captured.bytes.fill(0);
    }
  } catch (error) {
    // Successful builder exit is the nested-tool quiescence handshake, but it
    // does not create atomic same-UID deletion authority. Preserve malformed
    // or drifted retained evidence as well.
    throwBuildFailureV2(error);
  } finally {
    built.stdout.fill(0);
    built.stderr.fill(0);
  }
}

export async function buildPlatformReleaseContentStoreDarwinFilesystemFixtureV2():
  Promise<PlatformReleaseContentStoreDarwinFilesystemFixtureV2> {
  return buildFixtureV2();
}

export function inspectPlatformReleaseContentStoreDarwinFilesystemRetainedWorkspaceForTestV2(
  handle: PlatformReleaseContentStoreDarwinFilesystemFixtureV2,
): PlatformReleaseContentStoreDarwinFilesystemRetainedWorkspaceForTestV2 {
  if (isProxy(handle)) {
    failV2(
      "CONTENT_STORE_DARWIN_FIXTURE_HANDLE_UNAUTHENTICATED",
      "Content-store fixture handle must not be a proxy",
    );
  }
  const state = fixtureStatesV2.get(handle);
  if (state === undefined) {
    failV2(
      "CONTENT_STORE_DARWIN_FIXTURE_HANDLE_UNAUTHENTICATED",
      "Content-store fixture handle is not active",
    );
  }
  assertBinaryCurrentV2(state);
  return Object.freeze({
    admissionScope: "test_fixture",
    alias: state.alias,
    binary: state.binary,
    deletionAuthority: false,
    productionAuthority: false,
    root: state.root,
    stage: state.stage,
  });
}

export function inspectPlatformReleaseContentStoreDarwinFilesystemFixtureV2(
  handle: PlatformReleaseContentStoreDarwinFilesystemFixtureV2,
): PlatformReleaseContentStoreDarwinFilesystemFixtureInspectionV2 {
  if (isProxy(handle)) {
    failV2(
      "CONTENT_STORE_DARWIN_FIXTURE_HANDLE_UNAUTHENTICATED",
      "Content-store fixture handle must not be a proxy",
    );
  }
  const state = fixtureStatesV2.get(handle);
  if (state === undefined || state.lifecycle !== "active") {
    failV2(
      "CONTENT_STORE_DARWIN_FIXTURE_HANDLE_UNAUTHENTICATED",
      "Content-store fixture handle is not one active authenticated handle",
    );
  }
  assertBinaryCurrentV2(state);
  return Object.freeze({
    buildRecipeHash: state.buildRecipeHash,
    binarySha256: state.binarySha256,
    binaryByteLength: state.binaryByteLength,
  });
}

function unsigned64V2(value: unknown, label: string): bigint {
  if (
    typeof value !== "string"
    || !/^(?:0|[1-9][0-9]*)$/u.test(value)
  ) {
    failV2(
      "CONTENT_STORE_DARWIN_FIXTURE_INPUT_INVALID",
      `${label} must be one canonical unsigned decimal string`,
    );
  }
  const parsed = BigInt(value);
  if (parsed > UINT64_MAX_V2) {
    failV2(
      "CONTENT_STORE_DARWIN_FIXTURE_INPUT_INVALID",
      `${label} exceeds uint64`,
    );
  }
  return parsed;
}

function encodeDirectoryV2(
  frame: Buffer,
  offset: number,
  value: unknown,
  label: string,
): number {
  exactRecordV2(
    value,
    ["device", "inode", "mode", "ownerGid", "ownerUid"],
    "CONTENT_STORE_DARWIN_FIXTURE_INPUT_INVALID",
    label,
  );
  const mode = value.mode;
  if (!Number.isInteger(mode) || typeof mode !== "number" || mode < 0 || mode > 0xffff_ffff) {
    failV2(
      "CONTENT_STORE_DARWIN_FIXTURE_INPUT_INVALID",
      `${label}.mode must be one uint32`,
    );
  }
  frame.writeBigUInt64BE(unsigned64V2(value.device, `${label}.device`), offset);
  frame.writeBigUInt64BE(unsigned64V2(value.inode, `${label}.inode`), offset + 8);
  frame.writeBigUInt64BE(unsigned64V2(value.ownerUid, `${label}.ownerUid`), offset + 16);
  frame.writeBigUInt64BE(unsigned64V2(value.ownerGid, `${label}.ownerGid`), offset + 24);
  frame.writeUInt32BE(mode, offset + 32);
  return offset + DIRECTORY_BYTES_V2;
}

function exactPayloadV2(value: unknown, label: string): Buffer {
  if (
    !Buffer.isBuffer(value)
    || isProxy(value)
    || Object.getPrototypeOf(value) !== Buffer.prototype
    || value.byteLength < 1
    || value.byteLength > MAX_PAYLOAD_BYTES_V2
  ) {
    failV2(
      "CONTENT_STORE_DARWIN_FIXTURE_INPUT_INVALID",
      `${label} must be one non-empty bounded exact Buffer`,
    );
  }
  return Buffer.from(value);
}

function encodeInputV2(
  input:
    | PlatformReleaseContentStoreDarwinFilesystemFixtureInputV2
    | PlatformReleaseContentStoreDarwinFilesystemCheckpointInputV2,
): Buffer {
  exactRecordV2(
    input,
    [
      "attestationBytes",
      "attestationHash",
      "attestations",
      "checkpoint",
      "locks",
      "manifestBytes",
      "manifestPayloadHash",
      "releases",
      "root",
      "rootDescriptor",
      "staging",
    ],
    "CONTENT_STORE_DARWIN_FIXTURE_INPUT_INVALID",
    "Content-store fixture input",
  );
  if (
    !Number.isSafeInteger(input.rootDescriptor)
    || input.rootDescriptor < 0
  ) {
    failV2(
      "CONTENT_STORE_DARWIN_FIXTURE_INPUT_INVALID",
      "Content-store rootDescriptor must be one already-open non-negative descriptor",
    );
  }
  if (
    !Number.isInteger(input.checkpoint)
    || input.checkpoint < 0
    || input.checkpoint > 13
  ) {
    failV2(
      "CONTENT_STORE_DARWIN_FIXTURE_INPUT_INVALID",
      "Content-store checkpoint must be an integer from 0 through 13",
    );
  }
  if (
    typeof input.manifestPayloadHash !== "string"
    || !/^[a-f0-9]{64}$/u.test(input.manifestPayloadHash)
    || typeof input.attestationHash !== "string"
    || !/^[a-f0-9]{64}$/u.test(input.attestationHash)
  ) {
    failV2(
      "CONTENT_STORE_DARWIN_FIXTURE_INPUT_INVALID",
      "Content-store hashes must be exact lowercase sha256 strings",
    );
  }
  const manifestBytes = exactPayloadV2(input.manifestBytes, "manifestBytes");
  const attestationBytes = exactPayloadV2(input.attestationBytes, "attestationBytes");
  const frame = Buffer.allocUnsafe(
    HEADER_BYTES_V2 + manifestBytes.byteLength + attestationBytes.byteLength,
  );
  try {
    let offset = 0;
    MAGIC_V2.copy(frame, offset);
    offset += MAGIC_V2.byteLength;
    frame.writeUInt32BE(VERSION_V2, offset);
    offset += 4;
    frame.writeUInt32BE(input.checkpoint, offset);
    offset += 4;
    offset = encodeDirectoryV2(frame, offset, input.root, "root");
    offset = encodeDirectoryV2(frame, offset, input.locks, "locks");
    offset = encodeDirectoryV2(frame, offset, input.staging, "staging");
    offset = encodeDirectoryV2(frame, offset, input.releases, "releases");
    offset = encodeDirectoryV2(frame, offset, input.attestations, "attestations");
    frame.writeBigUInt64BE(BigInt(manifestBytes.byteLength), offset);
    offset += 8;
    frame.writeBigUInt64BE(BigInt(attestationBytes.byteLength), offset);
    offset += 8;
    frame.write(input.manifestPayloadHash, offset, SHA256_HEX_BYTES_V2, "ascii");
    offset += SHA256_HEX_BYTES_V2;
    frame.write(input.attestationHash, offset, SHA256_HEX_BYTES_V2, "ascii");
    offset += SHA256_HEX_BYTES_V2;
    manifestBytes.copy(frame, offset);
    offset += manifestBytes.byteLength;
    attestationBytes.copy(frame, offset);
    offset += attestationBytes.byteLength;
    if (offset !== frame.byteLength) {
      failV2(
        "CONTENT_STORE_DARWIN_FIXTURE_INPUT_INVALID",
        "Content-store frame encoder did not consume its exact allocation",
      );
    }
    return frame;
  } finally {
    manifestBytes.fill(0);
    attestationBytes.fill(0);
  }
}

function assertIntegerV2(
  value: unknown,
  minimum: number,
  maximum: number,
  label: string,
): asserts value is number {
  if (
    typeof value !== "number"
    || !Number.isInteger(value)
    || value < minimum
    || value > maximum
  ) {
    failV2(
      "CONTENT_STORE_DARWIN_FIXTURE_OUTPUT_INVALID",
      `${label} is outside its exact integer domain`,
    );
  }
}

function assertDecimalV2(value: unknown, signed: boolean, label: string): asserts value is string {
  const pattern = signed ? /^(?:0|-?[1-9][0-9]*)$/u : /^(?:0|[1-9][0-9]*)$/u;
  if (typeof value !== "string" || !pattern.test(value)) {
    failV2(
      "CONTENT_STORE_DARWIN_FIXTURE_OUTPUT_INVALID",
      `${label} must be one canonical decimal string`,
    );
  }
}

function parseEvidenceV2(value: unknown, label: string): void {
  const keys = [
    "byteLength",
    "changedNanoseconds",
    "changedSeconds",
    "device",
    "inode",
    "linkCount",
    "mode",
    "modifiedNanoseconds",
    "modifiedSeconds",
    "ownerGid",
    "ownerUid",
  ] as const;
  exactRecordV2(
    value,
    keys,
    "CONTENT_STORE_DARWIN_FIXTURE_OUTPUT_INVALID",
    label,
    true,
  );
  assertDecimalV2(value.byteLength, false, `${label}.byteLength`);
  assertDecimalV2(value.changedNanoseconds, true, `${label}.changedNanoseconds`);
  assertDecimalV2(value.changedSeconds, true, `${label}.changedSeconds`);
  assertDecimalV2(value.device, false, `${label}.device`);
  assertDecimalV2(value.inode, false, `${label}.inode`);
  assertDecimalV2(value.linkCount, false, `${label}.linkCount`);
  assertIntegerV2(value.mode, 0, 0xffff_ffff, `${label}.mode`);
  assertDecimalV2(value.modifiedNanoseconds, true, `${label}.modifiedNanoseconds`);
  assertDecimalV2(value.modifiedSeconds, true, `${label}.modifiedSeconds`);
  assertDecimalV2(value.ownerGid, false, `${label}.ownerGid`);
  assertDecimalV2(value.ownerUid, false, `${label}.ownerUid`);
}

function parseFailureV2(
  value: unknown,
): asserts value is PlatformReleaseContentStoreDarwinFilesystemFailureV2 {
  exactRecordV2(
    value,
    [
      "cleanupCode",
      "cleanupCodeName",
      "cleanupErrno",
      "lastCheckpoint",
      "leaseCode",
      "leaseCodeName",
      "leaseErrno",
      "primaryCode",
      "primaryCodeName",
      "primaryErrno",
      "terminalCode",
      "terminalCodeName",
    ],
    "CONTENT_STORE_DARWIN_FIXTURE_OUTPUT_INVALID",
    "Content-store failure record",
    true,
  );
  assertIntegerV2(value.cleanupCode, 0, CLEANUP_NAMES_V2.length - 1, "cleanupCode");
  assertIntegerV2(value.cleanupErrno, 0, 0x7fff_ffff, "cleanupErrno");
  assertIntegerV2(value.lastCheckpoint, 0, 13, "lastCheckpoint");
  assertIntegerV2(value.leaseCode, 0, LEASE_NAMES_V2.length - 1, "leaseCode");
  assertIntegerV2(value.leaseErrno, 0, 0x7fff_ffff, "leaseErrno");
  assertIntegerV2(value.primaryCode, 0, PRIMARY_NAMES_V2.length - 1, "primaryCode");
  assertIntegerV2(value.primaryErrno, 0, 0x7fff_ffff, "primaryErrno");
  assertIntegerV2(value.terminalCode, 0, PRIMARY_NAMES_V2.length - 1, "terminalCode");
  if (
    value.cleanupCodeName !== CLEANUP_NAMES_V2[value.cleanupCode]
    || value.leaseCodeName !== LEASE_NAMES_V2[value.leaseCode]
    || value.primaryCodeName !== PRIMARY_NAMES_V2[value.primaryCode]
    || value.terminalCodeName !== PRIMARY_NAMES_V2[value.terminalCode]
    || (value.cleanupCode === 0 && value.cleanupErrno !== 0)
    || (value.leaseCode === 0 && value.leaseErrno !== 0)
    || (value.primaryCode === 0 && value.primaryErrno !== 0)
  ) {
    failV2(
      "CONTENT_STORE_DARWIN_FIXTURE_OUTPUT_INVALID",
      "Content-store failure code names do not match their numeric codes",
    );
  }
}

function parsePublicationResultV2(value: unknown): void {
  exactRecordV2(
    value,
    [
      "attestationDisposition",
      "attestationLeaseAcquired",
      "attestationLeaseRecovered",
      "authenticatedLeaseLedgerPresent",
      "contentLeaseAcquired",
      "contentLeaseRecovered",
      "evidence",
      "leasesReleased",
      "releaseDisposition",
      "sameUidAtomicConditionalUnlinkAvailable",
      "stageCleaned",
      "staleLeaseRecoveryPolicy",
      "unauthenticatedStaleLeaseRecoveryEnabled",
      "unlinkAuthorityPolicy",
      "unlinkAuthorityPolicyCode",
    ],
    "CONTENT_STORE_DARWIN_FIXTURE_OUTPUT_INVALID",
    "Content-store publication result",
    true,
  );
  const dispositions = ["none", "published", "adopted_identical"];
  if (
    !dispositions.includes(value.attestationDisposition as string)
    || !dispositions.includes(value.releaseDisposition as string)
    || typeof value.attestationLeaseAcquired !== "boolean"
    || typeof value.attestationLeaseRecovered !== "boolean"
    || value.authenticatedLeaseLedgerPresent !== false
    || typeof value.contentLeaseAcquired !== "boolean"
    || typeof value.contentLeaseRecovered !== "boolean"
    || typeof value.leasesReleased !== "boolean"
    || value.sameUidAtomicConditionalUnlinkAvailable !== false
    || typeof value.stageCleaned !== "boolean"
    || value.staleLeaseRecoveryPolicy
      !== "unauthenticated_fixture_exact_inode_and_f_tlock_only_v2"
    || value.unauthenticatedStaleLeaseRecoveryEnabled !== true
    || value.unlinkAuthorityPolicy
      !== "preserve_unless_exact_identity_revalidated_no_same_uid_atomic_unlink_v2"
    || value.unlinkAuthorityPolicyCode !== 1
  ) {
    failV2(
      "CONTENT_STORE_DARWIN_FIXTURE_OUTPUT_INVALID",
      "Content-store publication result contains an invalid disposition or flag",
    );
  }
  const evidenceKeys = [
    "attestation",
    "attestations",
    "locks",
    "manifest",
    "releaseRoot",
    "releases",
    "root",
    "staging",
  ] as const;
  exactRecordV2(
    value.evidence,
    evidenceKeys,
    "CONTENT_STORE_DARWIN_FIXTURE_OUTPUT_INVALID",
    "Content-store evidence census",
    true,
  );
  for (const key of evidenceKeys) {
    parseEvidenceV2(value.evidence[key], `evidence.${key}`);
  }
}

function deepFreezeV2<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }
  for (const child of Object.values(value)) deepFreezeV2(child);
  return Object.freeze(value);
}

function parseResultV2(
  stdout: Buffer,
  exitStatus: 0 | 1,
): PlatformReleaseContentStoreDarwinFilesystemFixtureRunResultV2 {
  if (
    stdout.byteLength < 3
    || stdout.byteLength > MAX_STDOUT_BYTES_V2
    || stdout[stdout.byteLength - 1] !== 0x0a
    || stdout.subarray(0, -1).includes(0x0a)
  ) {
    failV2(
      "CONTENT_STORE_DARWIN_FIXTURE_OUTPUT_INVALID",
      "Content-store fixture stdout must be one bounded newline-terminated frame",
    );
  }
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(stdout.subarray(0, -1));
  } catch (error) {
    failV2(
      "CONTENT_STORE_DARWIN_FIXTURE_OUTPUT_INVALID",
      "Content-store fixture stdout is not strict UTF-8",
      error,
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    failV2(
      "CONTENT_STORE_DARWIN_FIXTURE_OUTPUT_INVALID",
      "Content-store fixture stdout is not JSON",
      error,
    );
  }
  exactRecordV2(
    parsed,
    [
      "admissionScope",
      "capability",
      "error",
      "productionAuthority",
      "result",
      "schema",
      "status",
    ],
    "CONTENT_STORE_DARWIN_FIXTURE_OUTPUT_INVALID",
    "Content-store fixture result",
    true,
  );
  if (
    text !== JSON.stringify(parsed)
    || parsed.admissionScope !== "test_fixture"
    || parsed.capability !== CAPABILITY_V2
    || parsed.productionAuthority !== false
    || parsed.schema !== RESULT_SCHEMA_V2
    || (parsed.status !== "ok" && parsed.status !== "error")
  ) {
    failV2(
      "CONTENT_STORE_DARWIN_FIXTURE_OUTPUT_INVALID",
      "Content-store fixture result failed its exact pathless non-authority schema",
    );
  }
  parseFailureV2(parsed.error);
  parsePublicationResultV2(parsed.result);
  const failure = parsed.error;
  if (
    (exitStatus === 0 && (parsed.status !== "ok" || failure.terminalCode !== 0))
    || (exitStatus === 1 && (parsed.status !== "error" || failure.terminalCode === 0))
  ) {
    failV2(
      "CONTENT_STORE_DARWIN_FIXTURE_OUTPUT_INVALID",
      "Content-store fixture status does not match its process exit and primary code",
    );
  }
  if (exitStatus === 0) {
    if (
      failure.primaryCode !== 0
      || failure.cleanupCode !== 0
      || failure.cleanupErrno !== 0
      || failure.leaseCode !== 0
      || failure.leaseErrno !== 0
      || failure.primaryErrno !== 0
    ) {
      failV2(
        "CONTENT_STORE_DARWIN_FIXTURE_OUTPUT_INVALID",
        "Successful content-store fixture result contains failure residue",
      );
    }
  } else if (
    (failure.primaryCode !== 0 && failure.terminalCode !== failure.primaryCode)
    || (failure.primaryCode === 0 && failure.cleanupCode !== 0
      && failure.terminalCode !== 14)
    || (failure.primaryCode === 0 && failure.cleanupCode === 0
      && failure.leaseCode !== 0 && failure.terminalCode !== 15)
    || (failure.primaryCode === 0
      && failure.cleanupCode === 0
      && failure.leaseCode === 0)
  ) {
    failV2(
      "CONTENT_STORE_DARWIN_FIXTURE_OUTPUT_INVALID",
      "Content-store terminal code is inconsistent with its first-cause channels",
    );
  }
  return deepFreezeV2(parsed) as PlatformReleaseContentStoreDarwinFilesystemFixtureRunResultV2;
}

function assertCallerDescriptorV2(
  status: BigIntStats,
  expected: BigIntStats,
): void {
  if (
    !status.isDirectory()
    || status.dev !== expected.dev
    || status.ino !== expected.ino
    || status.uid !== expected.uid
    || status.gid !== expected.gid
    || status.mode !== expected.mode
  ) {
    failV2(
      "CONTENT_STORE_DARWIN_FIXTURE_INPUT_INVALID",
      "Caller-owned root descriptor changed identity or metadata",
    );
  }
}

function observeStoppedCheckpointChildV2(
  processId: number,
  cwd: string,
): PlatformReleaseContentStoreDarwinFilesystemStoppedObservationV2 {
  const deadline = process.hrtime.bigint() + 2_000_000_000n;
  for (let attempt = 0; attempt < 128; attempt += 1) {
    const observed = spawnSync(
      "/bin/ps",
      ["-o", "state=", "-p", String(processId)],
      {
        cwd,
        encoding: "buffer",
        env: {
          LANG: "C",
          LC_ALL: "C",
          PATH: "/usr/bin:/bin",
          TZ: "UTC",
        },
        killSignal: "SIGKILL",
        maxBuffer: 1_024,
        shell: false,
        timeout: 500,
      },
    );
    const stdout = Buffer.isBuffer(observed.stdout)
      ? observed.stdout
      : Buffer.alloc(0);
    const stderr = Buffer.isBuffer(observed.stderr)
      ? observed.stderr
      : Buffer.alloc(0);
    let processState = "";
    try {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(stdout);
      if (
        observed.status !== 0
        || observed.signal !== null
        || observed.error !== undefined
        || stderr.byteLength !== 0
        || stdout.byteLength !== 5
        || !/^[A-Z][A-Za-z+< ]{3}\n$/u.test(text)
      ) {
        failV2(
          "CONTENT_STORE_DARWIN_FIXTURE_PROCESS_INVALID",
          "Native checkpoint child state probe returned a noncanonical result",
          observed.error,
        );
      }
      processState = text.slice(0, -1).trimEnd();
      if (
        processState.includes(" ")
        || !/^[A-Z][A-Za-z+<]*$/u.test(processState)
      ) {
        failV2(
          "CONTENT_STORE_DARWIN_FIXTURE_PROCESS_INVALID",
          "Native checkpoint child state token is noncanonical",
        );
      }
    } catch (error) {
      if (error instanceof PlatformReleaseContentStoreDarwinFilesystemFixtureErrorV2) {
        throw error;
      }
      failV2(
        "CONTENT_STORE_DARWIN_FIXTURE_PROCESS_INVALID",
        "Native checkpoint child state is not strict UTF-8",
        error,
      );
    } finally {
      stdout.fill(0);
      stderr.fill(0);
    }
    if (processState.startsWith("T")) {
      return Object.freeze({ processId, processState });
    }
    if (process.hrtime.bigint() >= deadline) break;
  }
  failV2(
    "CONTENT_STORE_DARWIN_FIXTURE_PROCESS_INVALID",
    "Native checkpoint child did not reach its own kernel-stopped state",
  );
}

export function runPlatformReleaseContentStoreDarwinFilesystemFixtureV2(
  handle: PlatformReleaseContentStoreDarwinFilesystemFixtureV2,
  input: PlatformReleaseContentStoreDarwinFilesystemFixtureInputV2,
): PlatformReleaseContentStoreDarwinFilesystemFixtureRunResultV2 {
  if (process.platform !== "darwin") {
    failV2(
      "CONTENT_STORE_DARWIN_FIXTURE_PLATFORM_UNAVAILABLE",
      "Darwin content-store filesystem fixture requires macOS",
    );
  }
  if (isProxy(handle)) {
    failV2(
      "CONTENT_STORE_DARWIN_FIXTURE_HANDLE_UNAUTHENTICATED",
      "Content-store fixture handle must not be a proxy",
    );
  }
  const state = fixtureStatesV2.get(handle);
  if (state === undefined || state.lifecycle !== "active") {
    failV2(
      "CONTENT_STORE_DARWIN_FIXTURE_HANDLE_UNAUTHENTICATED",
      "Content-store fixture handle is not one active authenticated handle",
    );
  }
  if (input.checkpoint !== 0) {
    failV2(
      "CONTENT_STORE_DARWIN_FIXTURE_INPUT_INVALID",
      "Synchronous content-store fixture invocation requires checkpoint 0",
    );
  }
  assertBinaryCurrentV2(state);
  const frame = encodeInputV2(input);
  let descriptorBefore: BigIntStats;
  try {
    descriptorBefore = fstatSync(input.rootDescriptor, { bigint: true });
    assertCallerDescriptorV2(descriptorBefore, descriptorBefore);
  } catch (error) {
    frame.fill(0);
    if (error instanceof PlatformReleaseContentStoreDarwinFilesystemFixtureErrorV2) {
      throw error;
    }
    failV2(
      "CONTENT_STORE_DARWIN_FIXTURE_INPUT_INVALID",
      "Content-store rootDescriptor is not one open directory descriptor",
      error,
    );
  }
  let invoked: ReturnType<typeof spawnSync>;
  try {
    invoked = spawnSync(state.binary, [], {
      cwd: state.root,
      env: {
        LANG: "C",
        LC_ALL: "C",
        PATH: "/usr/bin:/bin",
        TZ: "UTC",
      },
      input: frame,
      maxBuffer: MAX_STDOUT_BYTES_V2,
      shell: false,
      stdio: ["pipe", "pipe", "pipe", input.rootDescriptor],
    });
  } finally {
    frame.fill(0);
  }
  let descriptorAfter: BigIntStats;
  try {
    descriptorAfter = fstatSync(input.rootDescriptor, { bigint: true });
    assertCallerDescriptorV2(descriptorAfter, descriptorBefore);
  } catch (error) {
    failV2(
      "CONTENT_STORE_DARWIN_FIXTURE_PROCESS_INVALID",
      "Native invocation closed or replaced the caller-owned root descriptor",
      error,
    );
  }
  assertBinaryCurrentV2(state);
  const stdout = Buffer.isBuffer(invoked.stdout) ? invoked.stdout : Buffer.alloc(0);
  const stderr = Buffer.isBuffer(invoked.stderr) ? invoked.stderr : Buffer.alloc(0);
  try {
    if (
      invoked.signal !== null
      || invoked.error !== undefined
      || (invoked.status !== 0 && invoked.status !== 1)
      || stderr.byteLength !== 0
      || stderr.byteLength > MAX_STDERR_BYTES_V2
    ) {
      failV2(
        "CONTENT_STORE_DARWIN_FIXTURE_PROCESS_INVALID",
        `Native content-store fixture process failed code=${String(invoked.status)} signal=${String(invoked.signal)} stderr=${stderr.toString("utf8").slice(0, 600)}`,
        invoked.error,
      );
    }
    return parseResultV2(stdout, invoked.status);
  } finally {
    stdout.fill(0);
    stderr.fill(0);
  }
}

export async function runPlatformReleaseContentStoreDarwinFilesystemFixtureAtCheckpointForTestV2(
  handle: PlatformReleaseContentStoreDarwinFilesystemFixtureV2,
  input: PlatformReleaseContentStoreDarwinFilesystemCheckpointInputV2,
  mutateWhileStopped: (
    observation: PlatformReleaseContentStoreDarwinFilesystemStoppedObservationV2,
  ) => void,
): Promise<PlatformReleaseContentStoreDarwinFilesystemFixtureRunResultV2> {
  if (process.platform !== "darwin") {
    failV2(
      "CONTENT_STORE_DARWIN_FIXTURE_PLATFORM_UNAVAILABLE",
      "Darwin content-store filesystem fixture requires macOS",
    );
  }
  if (isProxy(handle)) {
    failV2(
      "CONTENT_STORE_DARWIN_FIXTURE_HANDLE_UNAUTHENTICATED",
      "Content-store fixture handle must not be a proxy",
    );
  }
  const state = fixtureStatesV2.get(handle);
  if (state === undefined || state.lifecycle !== "active") {
    failV2(
      "CONTENT_STORE_DARWIN_FIXTURE_HANDLE_UNAUTHENTICATED",
      "Content-store fixture handle is not one active authenticated handle",
    );
  }
  if (
    !Number.isInteger(input.checkpoint)
    || input.checkpoint < 1
    || input.checkpoint > 13
    || typeof mutateWhileStopped !== "function"
    || isProxy(mutateWhileStopped)
  ) {
    failV2(
      "CONTENT_STORE_DARWIN_FIXTURE_INPUT_INVALID",
      "Checkpoint control requires checkpoint 1 through 13 and one synchronous callback",
    );
  }
  assertBinaryCurrentV2(state);
  const frame = encodeInputV2(input);
  let descriptorBefore: BigIntStats;
  try {
    descriptorBefore = fstatSync(input.rootDescriptor, { bigint: true });
    assertCallerDescriptorV2(descriptorBefore, descriptorBefore);
  } catch (error) {
    frame.fill(0);
    if (error instanceof PlatformReleaseContentStoreDarwinFilesystemFixtureErrorV2) {
      throw error;
    }
    failV2(
      "CONTENT_STORE_DARWIN_FIXTURE_INPUT_INVALID",
      "Content-store rootDescriptor is not one open directory descriptor",
      error,
    );
  }

  state.activeRuns += 1;
  let stdout: Buffer<ArrayBufferLike> = Buffer.alloc(0);
  let stderr: Buffer<ArrayBufferLike> = Buffer.alloc(0);
  let readiness: Buffer<ArrayBufferLike> = Buffer.alloc(0);
  let exitCode: number | null = null;
  let exitSignal: NodeJS.Signals | null = null;
  let controllerFailed = false;
  let controllerError: unknown;
  let callbackThrew = false;
  let callbackError: unknown;
  let checkpointHandled = false;
  let acknowledgementSent = false;
  let continued = false;
  let childSettled = false;
  let hardTimeout: NodeJS.Timeout | undefined;
  let child: ReturnType<typeof spawn> | undefined;
  let resolveControl!: () => void;
  let rejectControl!: (error: unknown) => void;
  const control = new Promise<void>((resolve, reject) => {
    resolveControl = resolve;
    rejectControl = reject;
  });

  const terminateV2 = (): void => {
    if (
      child !== undefined
      && !childSettled
      && child.pid !== undefined
    ) {
      try {
        child.kill("SIGKILL");
      } catch {
        // Settlement and the original controller error remain authoritative.
      }
    }
  };
  const abortV2 = (error: unknown): void => {
    if (!controllerFailed) {
      controllerFailed = true;
      controllerError = error;
      rejectControl(error);
    }
    terminateV2();
  };
  const appendBoundedV2 = (
    current: Buffer<ArrayBufferLike>,
    chunk: Buffer | string,
    maximum: number,
    label: string,
  ): Buffer<ArrayBufferLike> => {
    const incoming = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    const next = Buffer.concat([current, incoming]);
    current.fill(0);
    if (next.byteLength > maximum) {
      next.fill(0);
      abortV2(errorV2(
        "CONTENT_STORE_DARWIN_FIXTURE_PROCESS_INVALID",
        `${label} exceeded its exact byte bound`,
      ));
      return Buffer.alloc(0);
    }
    return next;
  };

  try {
    child = spawn(state.binary, [], {
      cwd: state.root,
      env: {
        LANG: "C",
        LC_ALL: "C",
        PATH: "/usr/bin:/bin",
        TZ: "UTC",
      },
      shell: false,
      stdio: [
        "pipe",
        "pipe",
        "pipe",
        input.rootDescriptor,
        "pipe",
        "pipe",
      ],
    });
    const spawnedChild = child;
    const inputStream = spawnedChild.stdin;
    const stdoutStream = spawnedChild.stdout;
    const stderrStream = spawnedChild.stderr;
    const extraStreams = spawnedChild.stdio as unknown as Array<
      Readable | Writable | null | undefined
    >;
    const readyStream = extraStreams[4] as Readable | null | undefined;
    const acknowledgementStream = extraStreams[5] as Writable | null | undefined;
    if (
      inputStream === null
      || stdoutStream === null
      || stderrStream === null
      || readyStream === null
      || readyStream === undefined
      || acknowledgementStream === null
      || acknowledgementStream === undefined
    ) {
      abortV2(errorV2(
        "CONTENT_STORE_DARWIN_FIXTURE_PROCESS_INVALID",
        "Native checkpoint fixture did not expose its exact pipe set",
      ));
    } else {
      stdoutStream.on("data", (chunk: Buffer | string) => {
        stdout = appendBoundedV2(
          stdout,
          chunk,
          MAX_STDOUT_BYTES_V2,
          "Native checkpoint stdout",
        );
      });
      stderrStream.on("data", (chunk: Buffer | string) => {
        stderr = appendBoundedV2(
          stderr,
          chunk,
          MAX_STDERR_BYTES_V2,
          "Native checkpoint stderr",
        );
      });
      readyStream.on("data", (chunk: Buffer | string) => {
        readiness = appendBoundedV2(
          readiness,
          chunk,
          8,
          "Native checkpoint readiness",
        );
        if (controllerFailed || readiness.byteLength !== 8 || checkpointHandled) {
          return;
        }
        if (
          readiness.readUInt32BE(0) !== 0x5346_4332
          || readiness.readUInt32BE(4) !== input.checkpoint
        ) {
          abortV2(errorV2(
            "CONTENT_STORE_DARWIN_FIXTURE_PROCESS_INVALID",
            "Native checkpoint readiness frame did not match the selected checkpoint",
          ));
          return;
        }
        checkpointHandled = true;
        let stoppedObservation: PlatformReleaseContentStoreDarwinFilesystemStoppedObservationV2;
        try {
          if (spawnedChild.pid === undefined) {
            throw errorV2(
              "CONTENT_STORE_DARWIN_FIXTURE_PROCESS_INVALID",
              "Native checkpoint child has no process identifier",
            );
          }
          stoppedObservation = observeStoppedCheckpointChildV2(
            spawnedChild.pid,
            state.root,
          );
        } catch (error) {
          abortV2(error);
          return;
        }
        let callbackReturn: unknown;
        try {
          callbackReturn = mutateWhileStopped(stoppedObservation);
        } catch (error) {
          callbackThrew = true;
          callbackError = error;
          abortV2(error);
          return;
        }
        if (callbackReturn !== undefined) {
          abortV2(errorV2(
            "CONTENT_STORE_DARWIN_FIXTURE_INPUT_INVALID",
            "Checkpoint mutation callback must complete synchronously",
          ));
          return;
        }
        const acknowledgement = Buffer.from([0xa5]);
        acknowledgementStream.write(acknowledgement, (error?: Error | null) => {
          acknowledgement.fill(0);
          if (error) {
            abortV2(errorV2(
              "CONTENT_STORE_DARWIN_FIXTURE_PROCESS_INVALID",
              "Native checkpoint acknowledgement write failed",
              error,
            ));
            return;
          }
          acknowledgementSent = true;
          acknowledgementStream.end();
          try {
            if (!spawnedChild.kill("SIGCONT")) {
              abortV2(errorV2(
                "CONTENT_STORE_DARWIN_FIXTURE_PROCESS_INVALID",
                "Native checkpoint child could not be continued",
              ));
              return;
            }
          } catch (error) {
            abortV2(errorV2(
              "CONTENT_STORE_DARWIN_FIXTURE_PROCESS_INVALID",
              "Native checkpoint SIGCONT failed",
              error,
            ));
            return;
          }
          continued = true;
          resolveControl();
        });
      });
      inputStream.on("error", (error) => {
        abortV2(errorV2(
          "CONTENT_STORE_DARWIN_FIXTURE_PROCESS_INVALID",
          "Native checkpoint stdin failed",
          error,
        ));
      });
      stdoutStream.on("error", (error) => {
        abortV2(errorV2(
          "CONTENT_STORE_DARWIN_FIXTURE_PROCESS_INVALID",
          "Native checkpoint stdout failed",
          error,
        ));
      });
      stderrStream.on("error", (error) => {
        abortV2(errorV2(
          "CONTENT_STORE_DARWIN_FIXTURE_PROCESS_INVALID",
          "Native checkpoint stderr failed",
          error,
        ));
      });
      readyStream.on("error", (error) => {
        abortV2(errorV2(
          "CONTENT_STORE_DARWIN_FIXTURE_PROCESS_INVALID",
          "Native checkpoint readiness pipe failed",
          error,
        ));
      });
      acknowledgementStream.on("error", (error) => {
        abortV2(errorV2(
          "CONTENT_STORE_DARWIN_FIXTURE_PROCESS_INVALID",
          "Native checkpoint acknowledgement pipe failed",
          error,
        ));
      });
      inputStream.end(frame);
    }

    const settled = new Promise<void>((resolve) => {
      spawnedChild.once("error", (error) => {
        abortV2(errorV2(
          "CONTENT_STORE_DARWIN_FIXTURE_PROCESS_INVALID",
          "Native checkpoint child failed to spawn or execute",
          error,
        ));
      });
      spawnedChild.once("close", (code, signal) => {
        childSettled = true;
        exitCode = code;
        exitSignal = signal;
        if (!checkpointHandled || !acknowledgementSent || !continued) {
          abortV2(errorV2(
            "CONTENT_STORE_DARWIN_FIXTURE_PROCESS_INVALID",
            "Native checkpoint child closed before completing its control protocol",
          ));
        }
        resolve();
      });
    });
    hardTimeout = setTimeout(() => {
      abortV2(errorV2(
        "CONTENT_STORE_DARWIN_FIXTURE_PROCESS_INVALID",
        "Native checkpoint child exceeded its hard deadlock timeout",
      ));
    }, CHECKPOINT_TIMEOUT_MILLISECONDS_V2);
    await Promise.allSettled([control, settled]);
  } catch (error) {
    if (!controllerFailed) {
      controllerFailed = true;
      controllerError = error;
    }
    terminateV2();
    if (child !== undefined && !childSettled) {
      await new Promise<void>((resolve) => child!.once("close", () => resolve()));
    }
  } finally {
    if (hardTimeout !== undefined) clearTimeout(hardTimeout);
    frame.fill(0);
    state.activeRuns -= 1;
  }

  let fenceError: unknown;
  try {
    const descriptorAfter = fstatSync(input.rootDescriptor, { bigint: true });
    assertCallerDescriptorV2(descriptorAfter, descriptorBefore);
  } catch (error) {
    fenceError = errorV2(
      "CONTENT_STORE_DARWIN_FIXTURE_PROCESS_INVALID",
      "Native checkpoint invocation closed or replaced the caller-owned root descriptor",
      error,
    );
  }
  try {
    assertBinaryCurrentV2(state);
  } catch (error) {
    if (fenceError === undefined) fenceError = error;
  }

  try {
    if (callbackThrew) throw callbackError;
    if (controllerFailed) throw controllerError;
    if (fenceError !== undefined) throw fenceError;
    if (
      readiness.byteLength !== 8
      || !checkpointHandled
      || !acknowledgementSent
      || !continued
      || exitSignal !== null
      || (exitCode !== 0 && exitCode !== 1)
      || stderr.byteLength !== 0
    ) {
      failV2(
        "CONTENT_STORE_DARWIN_FIXTURE_PROCESS_INVALID",
        `Native checkpoint fixture process failed code=${String(exitCode)} signal=${String(exitSignal)} stderr=${stderr.toString("utf8").slice(0, 600)}`,
      );
    }
    return parseResultV2(stdout, exitCode);
  } finally {
    stdout.fill(0);
    stderr.fill(0);
    readiness.fill(0);
  }
}

export async function crashPlatformReleaseContentStoreDarwinFilesystemFixtureAtCheckpointForTestV2(
  handle: PlatformReleaseContentStoreDarwinFilesystemFixtureV2,
  input: PlatformReleaseContentStoreDarwinFilesystemCheckpointInputV2,
): Promise<PlatformReleaseContentStoreDarwinFilesystemCheckpointCrashV2> {
  if (process.platform !== "darwin") {
    failV2(
      "CONTENT_STORE_DARWIN_FIXTURE_PLATFORM_UNAVAILABLE",
      "Darwin content-store filesystem fixture requires macOS",
    );
  }
  if (isProxy(handle)) {
    failV2(
      "CONTENT_STORE_DARWIN_FIXTURE_HANDLE_UNAUTHENTICATED",
      "Content-store fixture handle must not be a proxy",
    );
  }
  const state = fixtureStatesV2.get(handle);
  if (state === undefined || state.lifecycle !== "active") {
    failV2(
      "CONTENT_STORE_DARWIN_FIXTURE_HANDLE_UNAUTHENTICATED",
      "Content-store fixture handle is not one active authenticated handle",
    );
  }
  if (
    !Number.isInteger(input.checkpoint)
    || input.checkpoint < 1
    || input.checkpoint > 13
  ) {
    failV2(
      "CONTENT_STORE_DARWIN_FIXTURE_INPUT_INVALID",
      "Checkpoint crash requires checkpoint 1 through 13",
    );
  }
  assertBinaryCurrentV2(state);
  const frame = encodeInputV2(input);
  let descriptorBefore: BigIntStats;
  try {
    descriptorBefore = fstatSync(input.rootDescriptor, { bigint: true });
    assertCallerDescriptorV2(descriptorBefore, descriptorBefore);
  } catch (error) {
    frame.fill(0);
    if (error instanceof PlatformReleaseContentStoreDarwinFilesystemFixtureErrorV2) {
      throw error;
    }
    failV2(
      "CONTENT_STORE_DARWIN_FIXTURE_INPUT_INVALID",
      "Content-store rootDescriptor is not one open directory descriptor",
      error,
    );
  }

  state.activeRuns += 1;
  let stdout: Buffer<ArrayBufferLike> = Buffer.alloc(0);
  let stderr: Buffer<ArrayBufferLike> = Buffer.alloc(0);
  let readiness: Buffer<ArrayBufferLike> = Buffer.alloc(0);
  let exitCode: number | null = null;
  let exitSignal: NodeJS.Signals | null = null;
  let child: ReturnType<typeof spawn> | undefined;
  let childSettled = false;
  let checkpointStopped = false;
  let killIssued = false;
  let controllerFailed = false;
  let controllerError: unknown;
  let hardTimeout: NodeJS.Timeout | undefined;
  let resolveControl!: () => void;
  let rejectControl!: (error: unknown) => void;
  const control = new Promise<void>((resolve, reject) => {
    resolveControl = resolve;
    rejectControl = reject;
  });
  const terminateV2 = (): void => {
    if (child !== undefined && !childSettled && child.pid !== undefined) {
      try {
        child.kill("SIGKILL");
      } catch {
        // The first controller error and close settlement remain authoritative.
      }
    }
  };
  const abortV2 = (error: unknown): void => {
    if (!controllerFailed) {
      controllerFailed = true;
      controllerError = error;
      rejectControl(error);
    }
    terminateV2();
  };
  const appendBoundedV2 = (
    current: Buffer<ArrayBufferLike>,
    chunk: Buffer | string,
    maximum: number,
    label: string,
  ): Buffer<ArrayBufferLike> => {
    const incoming = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    const next = Buffer.concat([current, incoming]);
    current.fill(0);
    if (next.byteLength > maximum) {
      next.fill(0);
      abortV2(errorV2(
        "CONTENT_STORE_DARWIN_FIXTURE_PROCESS_INVALID",
        `${label} exceeded its exact byte bound`,
      ));
      return Buffer.alloc(0);
    }
    return next;
  };

  try {
    child = spawn(state.binary, [], {
      cwd: state.root,
      env: {
        LANG: "C",
        LC_ALL: "C",
        PATH: "/usr/bin:/bin",
        TZ: "UTC",
      },
      shell: false,
      stdio: [
        "pipe",
        "pipe",
        "pipe",
        input.rootDescriptor,
        "pipe",
        "pipe",
      ],
    });
    const spawnedChild = child;
    const inputStream = spawnedChild.stdin;
    const stdoutStream = spawnedChild.stdout;
    const stderrStream = spawnedChild.stderr;
    const extraStreams = spawnedChild.stdio as unknown as Array<
      Readable | Writable | null | undefined
    >;
    const readyStream = extraStreams[4] as Readable | null | undefined;
    const acknowledgementStream = extraStreams[5] as Writable | null | undefined;
    if (
      inputStream === null
      || stdoutStream === null
      || stderrStream === null
      || readyStream === null
      || readyStream === undefined
      || acknowledgementStream === null
      || acknowledgementStream === undefined
    ) {
      abortV2(errorV2(
        "CONTENT_STORE_DARWIN_FIXTURE_PROCESS_INVALID",
        "Native checkpoint crash did not expose its exact pipe set",
      ));
    } else {
      stdoutStream.on("data", (chunk: Buffer | string) => {
        stdout = appendBoundedV2(
          stdout,
          chunk,
          MAX_STDOUT_BYTES_V2,
          "Native checkpoint crash stdout",
        );
      });
      stderrStream.on("data", (chunk: Buffer | string) => {
        stderr = appendBoundedV2(
          stderr,
          chunk,
          MAX_STDERR_BYTES_V2,
          "Native checkpoint crash stderr",
        );
      });
      readyStream.on("data", (chunk: Buffer | string) => {
        readiness = appendBoundedV2(
          readiness,
          chunk,
          8,
          "Native checkpoint crash readiness",
        );
        if (controllerFailed || readiness.byteLength !== 8 || checkpointStopped) {
          return;
        }
        if (
          readiness.readUInt32BE(0) !== 0x5346_4332
          || readiness.readUInt32BE(4) !== input.checkpoint
          || spawnedChild.pid === undefined
        ) {
          abortV2(errorV2(
            "CONTENT_STORE_DARWIN_FIXTURE_PROCESS_INVALID",
            "Native checkpoint crash readiness frame is invalid",
          ));
          return;
        }
        try {
          const stopped = observeStoppedCheckpointChildV2(
            spawnedChild.pid,
            state.root,
          );
          if (!stopped.processState.startsWith("T")) {
            throw errorV2(
              "CONTENT_STORE_DARWIN_FIXTURE_PROCESS_INVALID",
              "Native checkpoint crash child is not kernel-stopped",
            );
          }
          checkpointStopped = true;
          if (!spawnedChild.kill("SIGKILL")) {
            throw errorV2(
              "CONTENT_STORE_DARWIN_FIXTURE_PROCESS_INVALID",
              "Native checkpoint crash SIGKILL was not delivered",
            );
          }
          killIssued = true;
          acknowledgementStream.end();
          resolveControl();
        } catch (error) {
          abortV2(error);
        }
      });
      for (const [stream, label] of [
        [inputStream, "stdin"],
        [stdoutStream, "stdout"],
        [stderrStream, "stderr"],
        [readyStream, "readiness"],
        [acknowledgementStream, "acknowledgement"],
      ] as const) {
        stream.on("error", (error) => {
          abortV2(errorV2(
            "CONTENT_STORE_DARWIN_FIXTURE_PROCESS_INVALID",
            `Native checkpoint crash ${label} pipe failed`,
            error,
          ));
        });
      }
      inputStream.end(frame);
    }
    const settled = new Promise<void>((resolve) => {
      spawnedChild.once("error", (error) => {
        abortV2(errorV2(
          "CONTENT_STORE_DARWIN_FIXTURE_PROCESS_INVALID",
          "Native checkpoint crash child failed to spawn or execute",
          error,
        ));
      });
      spawnedChild.once("close", (code, signal) => {
        childSettled = true;
        exitCode = code;
        exitSignal = signal;
        if (!checkpointStopped || !killIssued) {
          abortV2(errorV2(
            "CONTENT_STORE_DARWIN_FIXTURE_PROCESS_INVALID",
            "Native checkpoint crash child closed before its selected stop",
          ));
        }
        resolve();
      });
    });
    hardTimeout = setTimeout(() => {
      abortV2(errorV2(
        "CONTENT_STORE_DARWIN_FIXTURE_PROCESS_INVALID",
        "Native checkpoint crash exceeded its hard deadlock timeout",
      ));
    }, CHECKPOINT_TIMEOUT_MILLISECONDS_V2);
    await Promise.allSettled([control, settled]);
  } catch (error) {
    if (!controllerFailed) {
      controllerFailed = true;
      controllerError = error;
    }
    terminateV2();
    if (child !== undefined && !childSettled) {
      await new Promise<void>((resolve) => child!.once("close", () => resolve()));
    }
  } finally {
    if (hardTimeout !== undefined) clearTimeout(hardTimeout);
    frame.fill(0);
    state.activeRuns -= 1;
  }

  let fenceError: unknown;
  try {
    const descriptorAfter = fstatSync(input.rootDescriptor, { bigint: true });
    assertCallerDescriptorV2(descriptorAfter, descriptorBefore);
  } catch (error) {
    fenceError = errorV2(
      "CONTENT_STORE_DARWIN_FIXTURE_PROCESS_INVALID",
      "Native checkpoint crash closed or replaced the caller-owned root descriptor",
      error,
    );
  }
  try {
    assertBinaryCurrentV2(state);
  } catch (error) {
    if (fenceError === undefined) fenceError = error;
  }
  try {
    if (controllerFailed) throw controllerError;
    if (fenceError !== undefined) throw fenceError;
    if (
      readiness.byteLength !== 8
      || !checkpointStopped
      || !killIssued
      || !childSettled
      || exitCode !== null
      || exitSignal !== "SIGKILL"
      || stdout.byteLength !== 0
      || stderr.byteLength !== 0
    ) {
      failV2(
        "CONTENT_STORE_DARWIN_FIXTURE_PROCESS_INVALID",
        `Native checkpoint crash settlement is invalid code=${String(exitCode)} signal=${String(exitSignal)}`,
      );
    }
    return Object.freeze({
      activeRunReleased: true,
      admissionScope: "test_fixture",
      binaryFencePreserved: true,
      callerDescriptorPreserved: true,
      checkpoint: input.checkpoint,
      exitCode: null,
      productionAuthority: false,
      schema:
        "setfarm.platform-release-content-store-filesystem-fixture-checkpoint-crash.v2",
      signal: "SIGKILL",
      stderrByteLength: 0,
      stdoutByteLength: 0,
    });
  } finally {
    stdout.fill(0);
    stderr.fill(0);
    readiness.fill(0);
  }
}
