import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { spawn } from "node:child_process";
import {
  chmodSync,
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  mkdtempSync,
  openSync,
  readSync,
  realpathSync,
  type BigIntStats,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { isProxy } from "node:util/types";

import {
  canonicalJsonStringify,
  hashCanonicalJson,
} from "./canonical-json.js";
import {
  canonicalizePlatformReleaseBootstrapDarwinHostSelfObservationV2,
  parsePlatformReleaseBootstrapDarwinHostSelfObservationCandidateV2,
  type PlatformReleaseBootstrapDarwinHostSelfObservationV2,
} from "../execution/schemas/platform-release-bootstrap-darwin-host-self-observation-v2.js";
import { deepFreezePlatformReleaseJsonV2 } from "../execution/schemas/platform-release-common-v2.js";

const BUILDER = path.resolve(
  import.meta.dirname,
  "../../scripts/build-platform-release-bootstrap-darwin-host-self-observation-fixture-v2.mjs",
);
const OUTPUT_PARENT_PREFIX_V2 = "setfarm-darwin-host-self-observation-build-v2-";
const MAX_STDOUT_BYTES_V2 = 64 * 1024;
const MAX_STDERR_BYTES_V2 = 4 * 1024;
const MAX_BINARY_BYTES_V2 = 4 * 1024 * 1024;
const BUILD_TIMEOUT_MILLISECONDS_V2 = 120_000;
const NATIVE_TIMEOUT_MILLISECONDS_V2 = 10_000;
const PROCESS_GROUP_DEATH_ATTEMPTS_V2 = 300;
const PROCESS_GROUP_DEATH_INTERVAL_MILLISECONDS_V2 = 10;
const PROCESS_SETTLEMENT_TIMEOUT_MILLISECONDS_V2 = 3_000;
const PUBLICATION_POLICY_V2 =
  "descriptor_exclusive_copy_no_replace_fsync_post_fence_false_authority_v2";
const STAGE_WORKSPACE_POLICY_V2 =
  "retained_on_success_or_failure_until_caller_root_disposal_false_authority_v2";
const RETENTION_DISPOSITION_SCHEMA_V2 =
  "setfarm.platform-release-bootstrap-darwin-host-self-observation-fixture-retention-disposition.v2" as const;
const OCCURRENCE_SCHEMA_V2 =
  "setfarm.platform-release-bootstrap-darwin-host-self-observation-occurrence.v2" as const;

export type PlatformReleaseBootstrapDarwinHostSelfObservationOccurrenceV2 = Readonly<{
  schema: typeof OCCURRENCE_SCHEMA_V2;
  admissionScope: "test_fixture";
  productionAuthority: false;
  challengeHash: string;
  observation: PlatformReleaseBootstrapDarwinHostSelfObservationV2;
  executablePhysicalIdentityHash: string;
  executableMutableFingerprintHash: string;
  occurrenceHash: string;
}>;

export type PlatformReleaseBootstrapDarwinHostSelfObservationFixtureV2 = Readonly<{
  buildRootAlias: string;
  buildRoot: string;
  binary: string;
  buildReceipt: Readonly<Record<string, unknown>>;
  dispose(): PlatformReleaseBootstrapDarwinHostSelfObservationRetentionDispositionV2;
}>;

export type PlatformReleaseBootstrapDarwinHostSelfObservationRetentionDispositionV2 =
  Readonly<{
    schema: typeof RETENTION_DISPOSITION_SCHEMA_V2;
    admissionScope: "test_fixture";
    productionAuthority: false;
    deletionAuthority: false;
    filesystemMutationPerformed: false;
    rootDisposition: "retained_no_atomic_same_uid_conditional_delete_v2";
  }>;

export type PlatformReleaseBootstrapDarwinHostSelfObservationFixtureErrorCodeV2 =
  | "DARWIN_HOST_SELF_OBSERVATION_PLATFORM_UNAVAILABLE"
  | "DARWIN_HOST_SELF_OBSERVATION_BUILD_FAILED"
  | "DARWIN_HOST_SELF_OBSERVATION_FIXTURE_DISPOSE_INVALID"
  | "DARWIN_HOST_SELF_OBSERVATION_FIXTURE_HANDLE_UNAUTHENTICATED"
  | "DARWIN_HOST_SELF_OBSERVATION_PROCESS_FAILED"
  | "DARWIN_HOST_SELF_OBSERVATION_FRAME_INVALID"
  | "DARWIN_HOST_SELF_OBSERVATION_EXECUTABLE_DRIFT";

export class PlatformReleaseBootstrapDarwinHostSelfObservationFixtureErrorV2
  extends TypeError {
  constructor(
    readonly code: PlatformReleaseBootstrapDarwinHostSelfObservationFixtureErrorCodeV2,
    message: string,
    options: ErrorOptions = {},
  ) {
    super(message.slice(0, 1_500), options);
    this.name = "PlatformReleaseBootstrapDarwinHostSelfObservationFixtureErrorV2";
  }
}

type PlatformReleaseBootstrapDarwinHostSelfObservationBuildPinV2 = Readonly<{
  byteLength: number;
  mode: "0500";
  sha256: string;
  stableIdentity: Readonly<{
    device: string;
    inode: string;
    objectKind: "ordinary_file";
  }>;
}>;

function failV2(
  code: PlatformReleaseBootstrapDarwinHostSelfObservationFixtureErrorCodeV2,
  message: string,
  cause?: unknown,
): never {
  throw failureV2(code, message, cause);
}

function failureV2(
  code: PlatformReleaseBootstrapDarwinHostSelfObservationFixtureErrorCodeV2,
  message: string,
  cause?: unknown,
): PlatformReleaseBootstrapDarwinHostSelfObservationFixtureErrorV2 {
  return new PlatformReleaseBootstrapDarwinHostSelfObservationFixtureErrorV2(
    code,
    message,
    cause === undefined ? {} : { cause },
  );
}

type HostSelfObservationFixtureStateV2 = {
  readonly buildRootAlias: string;
  readonly buildRoot: string;
  readonly binary: string;
  readonly buildReceipt: Readonly<Record<string, unknown>>;
  activeLeases: number;
};

const fixtureStatesV2 = new WeakMap<object, HostSelfObservationFixtureStateV2>();
const retainedRootObservationHandlesV2 = new WeakSet<object>();

function retainedWorkspaceDispositionV2():
  PlatformReleaseBootstrapDarwinHostSelfObservationRetentionDispositionV2 {
  return Object.freeze({
    schema: RETENTION_DISPOSITION_SCHEMA_V2,
    admissionScope: "test_fixture",
    productionAuthority: false,
    deletionAuthority: false,
    filesystemMutationPerformed: false,
    rootDisposition: "retained_no_atomic_same_uid_conditional_delete_v2",
  });
}

function authenticFixtureStateV2(
  fixture: PlatformReleaseBootstrapDarwinHostSelfObservationFixtureV2,
): HostSelfObservationFixtureStateV2 {
  if (
    typeof fixture !== "object"
    || fixture === null
    || isProxy(fixture)
  ) {
    failV2(
      "DARWIN_HOST_SELF_OBSERVATION_FIXTURE_HANDLE_UNAUTHENTICATED",
      "Host self-observation fixture handle must be one exact non-proxy active handle",
    );
  }
  const state = fixtureStatesV2.get(fixture);
  if (state === undefined) {
    failV2(
      "DARWIN_HOST_SELF_OBSERVATION_FIXTURE_HANDLE_UNAUTHENTICATED",
      "Host self-observation fixture handle is not active",
    );
  }
  return state;
}

function acquireFixtureLeaseV2(
  fixture: PlatformReleaseBootstrapDarwinHostSelfObservationFixtureV2,
): HostSelfObservationFixtureStateV2 {
  const state = authenticFixtureStateV2(fixture);
  state.activeLeases += 1;
  return state;
}

function releaseFixtureLeaseV2(state: HostSelfObservationFixtureStateV2): void {
  state.activeLeases -= 1;
}

function disposeFixtureV2(
  this: PlatformReleaseBootstrapDarwinHostSelfObservationFixtureV2,
): PlatformReleaseBootstrapDarwinHostSelfObservationRetentionDispositionV2 {
  const fixture = this;
  const state = authenticFixtureStateV2(fixture);
  if (state.activeLeases !== 0) {
    failV2(
      "DARWIN_HOST_SELF_OBSERVATION_FIXTURE_DISPOSE_INVALID",
      "Host self-observation fixture cannot be disposed during an active invocation",
    );
  }
  fixtureStatesV2.delete(fixture);
  return retainedWorkspaceDispositionV2();
}

type RetainedRootObservationFieldsV2 = Readonly<Record<string, unknown>>;

function disposeRetainedRootObservationV2(
  this: Readonly<{
    dispose(): PlatformReleaseBootstrapDarwinHostSelfObservationRetentionDispositionV2;
  }>,
): PlatformReleaseBootstrapDarwinHostSelfObservationRetentionDispositionV2 {
  const receiver: unknown = this;
  if (
    typeof receiver !== "object"
    || receiver === null
    || isProxy(receiver)
    || !retainedRootObservationHandlesV2.has(receiver)
  ) {
    failV2(
      "DARWIN_HOST_SELF_OBSERVATION_FIXTURE_HANDLE_UNAUTHENTICATED",
      "Host self-observation retained-root observation is not active",
    );
  }
  retainedRootObservationHandlesV2.delete(receiver);
  return retainedWorkspaceDispositionV2();
}

function retainedRootObservationV2<T extends RetainedRootObservationFieldsV2>(
  fields: T,
): Readonly<T & {
  dispose(): PlatformReleaseBootstrapDarwinHostSelfObservationRetentionDispositionV2;
}> {
  const handle = Object.freeze({
    ...fields,
    dispose: disposeRetainedRootObservationV2,
  }) as Readonly<T & {
    dispose(): PlatformReleaseBootstrapDarwinHostSelfObservationRetentionDispositionV2;
  }>;
  retainedRootObservationHandlesV2.add(handle);
  return handle;
}

function sha256BytesV2(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

type ExactExecutablePinV2 = Readonly<{
  device: bigint;
  inode: bigint;
  ownerUid: bigint;
  ownerGid: bigint;
  mode: bigint;
  linkCount: bigint;
  byteLength: bigint;
  modifiedTimeNanoseconds: bigint;
  changedTimeNanoseconds: bigint;
}>;

type ExactExecutableCaptureV2 = Readonly<{
  bytes: Buffer;
  byteLength: number;
  sha256: string;
  pin: ExactExecutablePinV2;
}>;

export type PlatformReleaseBootstrapDarwinHostSelfObservationExecutableCaptureHooksV2 =
  Readonly<{
    beforePathIdentityFence?: () => void;
  }>;

function primaryFirstCaptureFailureV2(
  errors: readonly unknown[],
  message: string,
): void {
  if (errors.length === 0) return;
  if (errors.length === 1) throw errors[0];
  const aggregate = new AggregateError(
    errors,
    `${message}: ${errors[0] instanceof Error ? errors[0].message : "failed"}`,
    { cause: errors[0] },
  );
  if (errors[0] instanceof Error && "code" in errors[0]) {
    Object.assign(aggregate, { code: String(errors[0].code) });
  }
  throw aggregate;
}

function exactExecutablePinFromStatV2(
  observed: BigIntStats,
  errorCode: PlatformReleaseBootstrapDarwinHostSelfObservationFixtureErrorCodeV2,
): ExactExecutablePinV2 {
  if (
    observed.isSymbolicLink()
    || !observed.isFile()
    || observed.nlink !== 1n
    || (observed.mode & 0o7777n) !== 0o500n
    || observed.size < 1n
    || observed.size > BigInt(MAX_BINARY_BYTES_V2)
  ) {
    return failV2(
      errorCode,
      "Host self-observation executable must be one bounded mode-0500 single-link ordinary file",
    );
  }
  return Object.freeze({
    device: observed.dev,
    inode: observed.ino,
    ownerUid: observed.uid,
    ownerGid: observed.gid,
    mode: observed.mode,
    linkCount: observed.nlink,
    byteLength: observed.size,
    modifiedTimeNanoseconds: observed.mtimeNs,
    changedTimeNanoseconds: observed.ctimeNs,
  });
}

function sameExactExecutablePinV2(
  observed: BigIntStats,
  expected: ExactExecutablePinV2,
): boolean {
  return (
    !observed.isSymbolicLink()
    && observed.isFile()
    && observed.dev === expected.device
    && observed.ino === expected.inode
    && observed.uid === expected.ownerUid
    && observed.gid === expected.ownerGid
    && observed.mode === expected.mode
    && observed.nlink === expected.linkCount
    && observed.size === expected.byteLength
    && observed.mtimeNs === expected.modifiedTimeNanoseconds
    && observed.ctimeNs === expected.changedTimeNanoseconds
  );
}

function captureExactExecutableV2(
  filePath: string,
  errorCode: PlatformReleaseBootstrapDarwinHostSelfObservationFixtureErrorCodeV2,
  hooks:
    PlatformReleaseBootstrapDarwinHostSelfObservationExecutableCaptureHooksV2
    | undefined = undefined,
): ExactExecutableCaptureV2 {
  let descriptor: number;
  try {
    descriptor = openSync(
      filePath,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
  } catch (error) {
    return failV2(
      errorCode,
      "Host self-observation executable descriptor could not be opened exactly",
      error,
    );
  }
  const captureErrors: unknown[] = [];
  let captured: ExactExecutableCaptureV2 | undefined;
  try {
    const before = fstatSync(descriptor, { bigint: true });
    const beforePin = exactExecutablePinFromStatV2(before, errorCode);
    const byteLength = Number(before.size);
    const bytes = Buffer.alloc(byteLength);
    let captureComplete = false;
    try {
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
          return failV2(
            errorCode,
            "Host self-observation executable changed during exact descriptor capture",
          );
        }
        offset += count;
      }
      const growthProbe = Buffer.alloc(1);
      let growthCount: number;
      try {
        growthCount = readSync(
          descriptor,
          growthProbe,
          0,
          1,
          byteLength,
        );
      } finally {
        growthProbe.fill(0);
      }
      const after = fstatSync(descriptor, { bigint: true });
      if (
        growthCount !== 0
        || !sameExactExecutablePinV2(after, beforePin)
        || BigInt(bytes.byteLength) !== beforePin.byteLength
      ) {
        return failV2(
          errorCode,
          "Host self-observation executable changed during exact descriptor capture",
        );
      }
      hooks?.beforePathIdentityFence?.();
      const pathStat = lstatSync(filePath, { bigint: true });
      if (!sameExactExecutablePinV2(pathStat, beforePin)) {
        return failV2(
          errorCode,
          "Host self-observation executable pathname changed before its exact identity fence",
        );
      }
      captured = Object.freeze({
        bytes,
        byteLength,
        sha256: sha256BytesV2(bytes),
        pin: beforePin,
      });
      captureComplete = true;
    } finally {
      if (!captureComplete) bytes.fill(0);
    }
  } catch (error) {
    captureErrors.push(error);
  }
  try {
    closeSync(descriptor);
  } catch (error) {
    captureErrors.push(error);
  }
  if (captureErrors.length > 0) captured?.bytes.fill(0);
  primaryFirstCaptureFailureV2(
    captureErrors,
    "Host self-observation executable capture and descriptor close both failed",
  );
  if (captured === undefined) {
    return failV2(
      errorCode,
      "Host self-observation executable capture ended without exact evidence",
    );
  }
  return captured;
}

export function capturePlatformReleaseBootstrapDarwinHostSelfObservationExecutableForTestV2(
  filePath: string,
  hooks:
    PlatformReleaseBootstrapDarwinHostSelfObservationExecutableCaptureHooksV2
    | undefined = undefined,
): Readonly<{
  byteLength: number;
  sha256: string;
  stableIdentity: Readonly<{
    objectKind: "ordinary_file";
    device: string;
    inode: string;
  }>;
}> {
  if (
    typeof filePath !== "string"
    || filePath.length < 1
    || filePath.length > 4_096
    || filePath.includes("\0")
    || !path.isAbsolute(filePath)
    || path.normalize(filePath) !== filePath
    || (
      hooks !== undefined
      && (
        hooks === null
        || typeof hooks !== "object"
        || Object.keys(hooks).some((key) => key !== "beforePathIdentityFence")
        || typeof hooks.beforePathIdentityFence !== "function"
      )
    )
  ) {
    return failV2(
      "DARWIN_HOST_SELF_OBSERVATION_BUILD_FAILED",
      "Host self-observation executable capture test input is invalid",
    );
  }
  const captured = captureExactExecutableV2(
    filePath,
    "DARWIN_HOST_SELF_OBSERVATION_BUILD_FAILED",
    hooks,
  );
  try {
    return Object.freeze({
      byteLength: captured.byteLength,
      sha256: captured.sha256,
      stableIdentity: Object.freeze({
        objectKind: "ordinary_file",
        device: captured.pin.device.toString(),
        inode: captured.pin.inode.toString(),
      }),
    });
  } finally {
    captured.bytes.fill(0);
  }
}

function exactPrivateRootV2(): Readonly<{ alias: string; root: string }> {
  const alias = mkdtempSync(path.join(os.tmpdir(), OUTPUT_PARENT_PREFIX_V2));
  const root = realpathSync(alias);
  chmodSync(root, 0o700);
  const stat = lstatSync(root);
  if (
    stat.isSymbolicLink()
    || !stat.isDirectory()
    || realpathSync(root) !== root
    || (stat.mode & 0o7777) !== 0o700
    || (typeof process.getuid === "function" && stat.uid !== process.getuid())
    || (typeof process.getgid === "function" && stat.gid !== process.getgid())
  ) {
    failV2(
      "DARWIN_HOST_SELF_OBSERVATION_BUILD_FAILED",
      "Self-observation fixture root must be one private process-owned directory",
    );
  }
  return Object.freeze({ alias, root });
}

function assertExecutableEvidenceCurrentV2(
  binary: string,
  observation: PlatformReleaseBootstrapDarwinHostSelfObservationV2,
  buildPin: PlatformReleaseBootstrapDarwinHostSelfObservationBuildPinV2,
): void {
  const captured = captureExactExecutableV2(
    binary,
    "DARWIN_HOST_SELF_OBSERVATION_EXECUTABLE_DRIFT",
  );
  const stableIdentity = observation.executable.stableIdentity;
  const mutableFingerprint = observation.executable.mutableFingerprint;
  try {
    if (
      !/^[a-f0-9]{64}$/u.test(stableIdentity.hostIdentityHash)
      || stableIdentity.objectKind !== "ordinary_file"
      || captured.pin.device.toString() !== stableIdentity.device
      || captured.pin.inode.toString() !== stableIdentity.inode
      || stableIdentity.objectKind !== buildPin.stableIdentity.objectKind
      || stableIdentity.device !== buildPin.stableIdentity.device
      || stableIdentity.inode !== buildPin.stableIdentity.inode
      || captured.sha256 !== mutableFingerprint.contentHash
      || captured.byteLength !== mutableFingerprint.byteLength
      || mutableFingerprint.contentHash !== buildPin.sha256
      || mutableFingerprint.byteLength !== buildPin.byteLength
      || mutableFingerprint.mode !== buildPin.mode
      || Number(captured.pin.linkCount) !== mutableFingerprint.linkCount
      || (Number(captured.pin.mode) & 0o7777).toString(8).padStart(4, "0")
        !== mutableFingerprint.mode
      || captured.pin.ownerUid !== BigInt(mutableFingerprint.ownerUid)
      || captured.pin.ownerGid !== BigInt(mutableFingerprint.ownerGid)
      || captured.pin.modifiedTimeNanoseconds.toString()
        !== mutableFingerprint.modifiedNanoseconds
      || captured.pin.changedTimeNanoseconds.toString()
        !== mutableFingerprint.changedNanoseconds
    ) {
      failV2(
        "DARWIN_HOST_SELF_OBSERVATION_EXECUTABLE_DRIFT",
        "Security.framework observation no longer matches the pinned fixture executable",
      );
    }
  } finally {
    captured.bytes.fill(0);
  }
}

function assertFixtureBuildPinV2(
  binary: string,
  buildReceipt: Readonly<Record<string, unknown>>,
): PlatformReleaseBootstrapDarwinHostSelfObservationBuildPinV2 {
  const expectedReceiptKeys = [
    "admissionScope",
    "binary",
    "buildRecipeHash",
    "productionAuthority",
    "publicationPolicy",
    "schema",
    "signingAuthority",
    "stageWorkspacePolicy",
    "trustConclusion",
  ];
  const receiptBinary = buildReceipt.binary;
  if (
    JSON.stringify(Object.keys(buildReceipt).sort())
      !== JSON.stringify(expectedReceiptKeys)
    || buildReceipt.schema !==
      "setfarm.platform-release-bootstrap-darwin-host-self-observation-fixture-build-receipt.v2"
    || buildReceipt.admissionScope !== "test_fixture"
    || buildReceipt.productionAuthority !== false
    || buildReceipt.signingAuthority !== "adhoc_or_unsigned_test_fixture"
    || buildReceipt.publicationPolicy !== PUBLICATION_POLICY_V2
    || buildReceipt.stageWorkspacePolicy !== STAGE_WORKSPACE_POLICY_V2
    || buildReceipt.trustConclusion !== "characterization_only"
    || typeof buildReceipt.buildRecipeHash !== "string"
    || !/^[a-f0-9]{64}$/u.test(buildReceipt.buildRecipeHash)
    || typeof receiptBinary !== "object"
    || receiptBinary === null
  ) {
    return failV2(
      "DARWIN_HOST_SELF_OBSERVATION_BUILD_FAILED",
      "Security.framework fixture build receipt attempted authority promotion or omitted exact policy evidence",
    );
  }
  const record = receiptBinary as Record<string, unknown>;
  const stable = record.stableIdentity;
  if (
    JSON.stringify(Object.keys(record).sort()) !== JSON.stringify([
      "architectureSet",
      "byteLength",
      "mode",
      "sha256",
      "stableIdentity",
    ])
    || record.mode !== "0500"
    || !Array.isArray(record.architectureSet)
    || JSON.stringify(record.architectureSet) !== JSON.stringify(["arm64", "x86_64"])
    || typeof record.byteLength !== "number"
    || !Number.isSafeInteger(record.byteLength)
    || record.byteLength < 1
    || record.byteLength > MAX_BINARY_BYTES_V2
    || typeof record.sha256 !== "string"
    || !/^[a-f0-9]{64}$/u.test(record.sha256)
    || typeof stable !== "object"
    || stable === null
  ) {
    return failV2(
      "DARWIN_HOST_SELF_OBSERVATION_BUILD_FAILED",
      "Security.framework fixture build receipt has incomplete binary evidence",
    );
  }
  const stableRecord = stable as Record<string, unknown>;
  if (
    JSON.stringify(Object.keys(stableRecord).sort()) !== JSON.stringify([
      "device",
      "inode",
      "objectKind",
    ])
    || stableRecord.objectKind !== "ordinary_file"
    || typeof stableRecord.device !== "string"
    || !/^(?:0|[1-9][0-9]*)$/u.test(stableRecord.device)
    || typeof stableRecord.inode !== "string"
    || !/^(?:0|[1-9][0-9]*)$/u.test(stableRecord.inode)
  ) {
    return failV2(
      "DARWIN_HOST_SELF_OBSERVATION_BUILD_FAILED",
      "Security.framework fixture build receipt has invalid stable binary identity",
    );
  }
  const buildPin = Object.freeze({
    byteLength: record.byteLength,
    mode: "0500" as const,
    sha256: record.sha256,
    stableIdentity: Object.freeze({
      device: stableRecord.device,
      inode: stableRecord.inode,
      objectKind: "ordinary_file" as const,
    }),
  });
  const captured = captureExactExecutableV2(
    binary,
    "DARWIN_HOST_SELF_OBSERVATION_EXECUTABLE_DRIFT",
  );
  try {
    if (
      captured.pin.device.toString() !== stableRecord.device
      || captured.pin.inode.toString() !== stableRecord.inode
      || captured.byteLength !== record.byteLength
      || captured.sha256 !== record.sha256
    ) {
      return failV2(
        "DARWIN_HOST_SELF_OBSERVATION_EXECUTABLE_DRIFT",
        "Security.framework fixture binary changed before observation",
      );
    }
  } finally {
    captured.bytes.fill(0);
  }
  return buildPin;
}

export type PlatformReleaseBootstrapDarwinHostSelfObservationContainedProcessFaultV2 =
  | "stdout_stream_error"
  | "stderr_stream_error"
  | "stdin_stream_error"
  | "group_kill_failure"
  | "settlement_timeout"
  | "death_unproven";

type ContainedProcessResultV2 = Readonly<{
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

async function waitForProcessGroupDeathV2(processGroupId: number): Promise<boolean> {
  for (let attempt = 0; attempt < PROCESS_GROUP_DEATH_ATTEMPTS_V2; attempt += 1) {
    if (!processGroupAliveV2(processGroupId)) return true;
    if (attempt + 1 < PROCESS_GROUP_DEATH_ATTEMPTS_V2) {
      await new Promise((resolve) =>
        setTimeout(resolve, PROCESS_GROUP_DEATH_INTERVAL_MILLISECONDS_V2));
    }
  }
  return !processGroupAliveV2(processGroupId);
}

function throwContainedProcessFailureV2(
  primary: Error | undefined,
  containmentErrors: readonly Error[],
  message: string,
  containmentProven: boolean,
): void {
  const errors = primary === undefined
    ? [...containmentErrors]
    : [primary, ...containmentErrors];
  if (errors.length === 0) return;
  const output = errors.length === 1
    ? errors[0]
    : new AggregateError(
      errors,
      `${message}: ${errors[0].message}`,
      { cause: errors[0] },
    );
  Object.assign(output, {
    code: "code" in errors[0] ? String(errors[0].code) : undefined,
    containmentProven,
  });
  throw output;
}

async function runContainedProcessV2(
  executable: string,
  argv: readonly string[],
  options: Readonly<{
    cwd: string;
    env: NodeJS.ProcessEnv;
    errorCode: PlatformReleaseBootstrapDarwinHostSelfObservationFixtureErrorCodeV2;
    label: string;
    timeoutMilliseconds: number;
    stdin: Buffer;
    stdinByteLimit: number;
    stdoutByteLimit: number;
    stderrByteLimit: number;
    requireEmptyStderr?: boolean;
    faultInjection?:
      PlatformReleaseBootstrapDarwinHostSelfObservationContainedProcessFaultV2;
  }>,
): Promise<ContainedProcessResultV2> {
  if (
    options.stdin.byteLength > options.stdinByteLimit
    || options.stdinByteLimit < 0
    || options.stdoutByteLimit < 1
    || options.stderrByteLimit < 1
    || options.timeoutMilliseconds < 1
  ) {
    return failV2(
      options.errorCode,
      `${options.label} process bounds are invalid`,
    );
  }
  const stdinBytes = Buffer.from(options.stdin);
  const child = spawn(executable, [...argv], {
    cwd: options.cwd,
    detached: true,
    env: options.env,
    shell: false,
    stdio: ["pipe", "pipe", "pipe"],
  });
  const stdoutChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];
  const containmentErrors: Error[] = [];
  let stdoutByteLength = 0;
  let stderrByteLength = 0;
  let firstCause: Error | undefined;
  let terminationRequested = false;
  let childSettled = false;
  let settlementTimer: NodeJS.Timeout | undefined;
  let executionTimer: NodeJS.Timeout | undefined;
  let resolveSettlement: ((result: Readonly<{
    kind: "close" | "watchdog";
    code: number | null;
    signal: NodeJS.Signals | null;
  }>) => void) | undefined;

  const settled = new Promise<Readonly<{
    kind: "close" | "watchdog";
    code: number | null;
    signal: NodeJS.Signals | null;
  }>>((resolve) => {
    resolveSettlement = (result) => {
      if (childSettled) return;
      childSettled = true;
      resolve(result);
    };
    child.once("close", (code, signal) => {
      if (options.faultInjection === "settlement_timeout") return;
      resolveSettlement?.({ kind: "close", code, signal });
    });
  });

  const latchContainmentError = (message: string, cause: unknown): void => {
    containmentErrors.push(failureV2(options.errorCode, message, cause));
  };
  const signalDirectChildFallback = (): void => {
    if (child.pid === undefined || !Number.isSafeInteger(child.pid) || child.pid < 1) {
      return;
    }
    try {
      child.kill("SIGKILL");
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ESRCH")) {
        latchContainmentError(
          `${options.label} direct-child fallback kill failed`,
          error,
        );
      }
    }
  };
  const armSettlementWatchdog = (): void => {
    if (childSettled || settlementTimer !== undefined) return;
    const settlementMilliseconds = options.faultInjection === "settlement_timeout"
      ? 25
      : PROCESS_SETTLEMENT_TIMEOUT_MILLISECONDS_V2;
    settlementTimer = setTimeout(() => {
      const settlementFailure = failureV2(
        options.errorCode,
        `${options.label} did not settle after termination`,
      );
      if (firstCause === undefined) firstCause = settlementFailure;
      else containmentErrors.push(settlementFailure);
      signalDirectChildFallback();
      resolveSettlement?.({ kind: "watchdog", code: null, signal: null });
    }, settlementMilliseconds);
  };
  const requestTermination = (): void => {
    if (terminationRequested) return;
    terminationRequested = true;
    armSettlementWatchdog();
    if (child.pid === undefined || !Number.isSafeInteger(child.pid) || child.pid < 1) {
      return;
    }
    try {
      if (options.faultInjection === "group_kill_failure") {
        throw new Error("forced process-group kill failure");
      }
      process.kill(-child.pid, "SIGKILL");
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ESRCH")) {
        latchContainmentError(`${options.label} process-group kill failed`, error);
        signalDirectChildFallback();
      }
    }
  };
  const latchFirstCause = (error: Error, terminate: boolean): void => {
    if (firstCause === undefined) firstCause = error;
    else containmentErrors.push(error);
    if (terminate) requestTermination();
  };
  const captureOutput = (name: "stdout" | "stderr", chunk: Buffer): void => {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    const currentByteLength = name === "stdout"
      ? stdoutByteLength
      : stderrByteLength;
    const byteLimit = name === "stdout"
      ? options.stdoutByteLimit
      : options.stderrByteLimit;
    if (currentByteLength + bytes.byteLength > byteLimit) {
      bytes.fill(0);
      latchFirstCause(
        failureV2(
          options.errorCode,
          `${options.label} exceeded the bounded ${name} capture`,
        ),
        true,
      );
      return;
    }
    if (firstCause !== undefined) {
      bytes.fill(0);
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
  const streamFailure = (
    name: "stdin" | "stdout" | "stderr",
    error: Error,
  ): void => {
    latchFirstCause(
      failureV2(
        options.errorCode,
        `${options.label} ${name} stream failed`,
        error,
      ),
      true,
    );
  };

  child.stdout.on("data", (chunk: Buffer) => captureOutput("stdout", chunk));
  child.stderr.on("data", (chunk: Buffer) => captureOutput("stderr", chunk));
  child.stdin.once("error", (error) => streamFailure("stdin", error));
  child.stdout.once("error", (error) => streamFailure("stdout", error));
  child.stderr.once("error", (error) => streamFailure("stderr", error));
  child.once("error", (error) => {
    latchFirstCause(
      failureV2(
        options.errorCode,
        `${options.label} could not start`,
        error,
      ),
      true,
    );
  });

  queueMicrotask(() => {
    if (options.faultInjection === "stdin_stream_error") {
      child.stdin.destroy(new Error("forced stdin stream failure"));
      return;
    }
    child.stdin.end(stdinBytes);
    if (options.faultInjection === "stdout_stream_error") {
      child.stdout.destroy(new Error("forced stdout stream failure"));
    }
    if (options.faultInjection === "stderr_stream_error") {
      child.stderr.destroy(new Error("forced stderr stream failure"));
    }
  });

  executionTimer = setTimeout(() => {
    latchFirstCause(
      failureV2(
        options.errorCode,
        `${options.label} timed out after ${options.timeoutMilliseconds}ms`,
      ),
      true,
    );
  }, options.timeoutMilliseconds);

  const result = await settled;
  if (executionTimer !== undefined) clearTimeout(executionTimer);
  if (settlementTimer !== undefined) clearTimeout(settlementTimer);

  const stderrText = Buffer.concat(
    stderrChunks,
    stderrByteLength,
  ).toString("utf8").slice(0, 600);
  if (
    firstCause === undefined
    && options.requireEmptyStderr === true
    && stderrByteLength !== 0
  ) {
    firstCause = failureV2(
      options.errorCode,
      `${options.label} emitted stderr: ${stderrText}`,
    );
  }
  if (
    firstCause === undefined
    && (result.code !== 0 || result.signal !== null)
  ) {
    firstCause = failureV2(
      options.errorCode,
      `${options.label} failed code=${String(result.code)} signal=${String(
        result.signal,
      )} stderr=${stderrText}`,
    );
  }

  if (
    child.pid !== undefined
    && Number.isSafeInteger(child.pid)
    && child.pid > 0
    && processGroupAliveV2(child.pid)
  ) {
    if (firstCause === undefined) {
      firstCause = failureV2(
        options.errorCode,
        `${options.label} left its process group alive`,
      );
    }
    requestTermination();
  }

  let containmentProven = true;
  if (child.pid !== undefined && Number.isSafeInteger(child.pid) && child.pid > 0) {
    const actualDeathProven = await waitForProcessGroupDeathV2(child.pid);
    containmentProven = actualDeathProven
      && options.faultInjection !== "death_unproven";
    if (!containmentProven) {
      containmentErrors.push(failureV2(
        options.errorCode,
        `${options.label} process-group death was not proven by ESRCH`,
      ));
    }
  }

  stdinBytes.fill(0);
  if (firstCause !== undefined || containmentErrors.length > 0) {
    for (const chunk of stdoutChunks) chunk.fill(0);
    for (const chunk of stderrChunks) chunk.fill(0);
    throwContainedProcessFailureV2(
      firstCause,
      containmentErrors,
      `${options.label} and containment both failed`,
      containmentProven,
    );
  }

  const stdout = Buffer.concat(stdoutChunks, stdoutByteLength);
  const stderr = Buffer.concat(stderrChunks, stderrByteLength);
  for (const chunk of stdoutChunks) chunk.fill(0);
  for (const chunk of stderrChunks) chunk.fill(0);
  return Object.freeze({ stdout, stderr });
}

export async function runPlatformReleaseBootstrapDarwinHostSelfObservationContainedProcessFaultForTestV2(
  faultInjection:
    PlatformReleaseBootstrapDarwinHostSelfObservationContainedProcessFaultV2,
): Promise<never> {
  if (![
    "stdout_stream_error",
    "stderr_stream_error",
    "stdin_stream_error",
    "group_kill_failure",
    "settlement_timeout",
    "death_unproven",
  ].includes(faultInjection)) {
    return failV2(
      "DARWIN_HOST_SELF_OBSERVATION_PROCESS_FAILED",
      "Host self-observation contained-process fault is outside the exact test set",
    );
  }
  const result = await runContainedProcessV2(
    process.execPath,
    ["-e", "setInterval(() => {}, 1000)"],
    {
      cwd: path.resolve(import.meta.dirname, "../.."),
      env: {
        HOME: "/var/empty",
        LANG: "C",
        LC_ALL: "C",
        PATH: "/usr/bin:/bin",
        TZ: "UTC",
      },
      errorCode: "DARWIN_HOST_SELF_OBSERVATION_PROCESS_FAILED",
      faultInjection,
      label: "Host self-observation contained-process fault fixture",
      stdin: Buffer.alloc(0),
      stdinByteLimit: 0,
      stderrByteLimit: MAX_STDERR_BYTES_V2,
      stdoutByteLimit: MAX_STDOUT_BYTES_V2,
      timeoutMilliseconds: 25,
    },
  );
  result.stdout.fill(0);
  result.stderr.fill(0);
  return failV2(
    "DARWIN_HOST_SELF_OBSERVATION_PROCESS_FAILED",
    "Host self-observation contained-process fault did not fail closed",
  );
}

async function buildFixtureV2(
  receiptFault: "malformed_receipt_after_success" | undefined,
  observeRoot: ((root: Readonly<{ alias: string; root: string }>) => void)
    | undefined,
): Promise<
  PlatformReleaseBootstrapDarwinHostSelfObservationFixtureV2
> {
  if (process.platform !== "darwin") {
    failV2(
      "DARWIN_HOST_SELF_OBSERVATION_PLATFORM_UNAVAILABLE",
      "Security.framework self-observation fixture requires macOS",
    );
  }
  const root = exactPrivateRootV2();
  observeRoot?.(root);
  const binary = path.join(root.root, "host-self-observation-v2");
  let built: ContainedProcessResultV2 | undefined;
  try {
    built = await runContainedProcessV2(
      process.execPath,
      [BUILDER, "--out-file", binary],
      {
        cwd: path.resolve(import.meta.dirname, "../.."),
        env: {
          HOME: "/var/empty",
          LANG: "C",
          LC_ALL: "C",
          PATH: "/usr/bin:/bin",
          TZ: "UTC",
        },
        errorCode: "DARWIN_HOST_SELF_OBSERVATION_BUILD_FAILED",
        label: "Security.framework fixture builder",
        requireEmptyStderr: true,
        stdin: Buffer.alloc(0),
        stdinByteLimit: 0,
        stderrByteLimit: 2 * 1024 * 1024,
        stdoutByteLimit: 2 * 1024 * 1024,
        timeoutMilliseconds: BUILD_TIMEOUT_MILLISECONDS_V2,
      },
    );
  } catch (error) {
    // The builder creates its own detached tool process groups. Preserve its
    // retained root on every invocation failure: outer-PG death alone cannot
    // prove that an inner clang/xcrun group is quiescent.
    if (
      error instanceof PlatformReleaseBootstrapDarwinHostSelfObservationFixtureErrorV2
      || error instanceof AggregateError
    ) {
      throw error;
    }
    return failV2(
      "DARWIN_HOST_SELF_OBSERVATION_BUILD_FAILED",
      "Security.framework fixture builder invocation failed without exact containment evidence",
      error,
    );
  }
  try {
    const buildReceipt = deepFreezePlatformReleaseJsonV2(
      JSON.parse(
        receiptFault === "malformed_receipt_after_success"
          ? "{"
          : built.stdout.toString("utf8"),
      ),
    ) as Readonly<Record<string, unknown>>;
    assertFixtureBuildPinV2(binary, buildReceipt);
    let fixture!: PlatformReleaseBootstrapDarwinHostSelfObservationFixtureV2;
    fixture = Object.freeze({
      buildRootAlias: root.alias,
      buildRoot: root.root,
      binary,
      buildReceipt,
      dispose: disposeFixtureV2,
    });
    fixtureStatesV2.set(fixture, {
      buildRootAlias: root.alias,
      buildRoot: root.root,
      binary,
      buildReceipt,
      activeLeases: 0,
    });
    return fixture;
  } catch (error) {
    // A successful builder exit is the inner-quiescence handshake, but it does
    // not create atomic same-UID deletion authority. Preserve malformed or
    // drifted receipt evidence as well.
    if (error instanceof PlatformReleaseBootstrapDarwinHostSelfObservationFixtureErrorV2) {
      throw error;
    }
    return failV2(
      "DARWIN_HOST_SELF_OBSERVATION_BUILD_FAILED",
      "Security.framework fixture builder did not return its exact JSON receipt",
      error,
    );
  } finally {
    built.stdout.fill(0);
    built.stderr.fill(0);
  }
}

function parseNativeFrameV2(
  stdout: Buffer,
): PlatformReleaseBootstrapDarwinHostSelfObservationV2 {
  if (
    stdout.byteLength < 2
    || stdout.byteLength > MAX_STDOUT_BYTES_V2
    || stdout[stdout.byteLength - 1] !== 0x0a
  ) {
    return failV2(
      "DARWIN_HOST_SELF_OBSERVATION_FRAME_INVALID",
      "Self-observation stdout must be one bounded newline-terminated frame",
    );
  }
  const frameBytes = stdout.subarray(0, -1);
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(frameBytes);
  } catch (error) {
    return failV2(
      "DARWIN_HOST_SELF_OBSERVATION_FRAME_INVALID",
      "Self-observation frame must be strict UTF-8",
      error,
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return failV2(
      "DARWIN_HOST_SELF_OBSERVATION_FRAME_INVALID",
      "Self-observation frame must be valid JSON",
      error,
    );
  }
  let normalized: PlatformReleaseBootstrapDarwinHostSelfObservationV2;
  try {
    normalized = parsePlatformReleaseBootstrapDarwinHostSelfObservationCandidateV2(parsed);
  } catch (error) {
    return failV2(
      "DARWIN_HOST_SELF_OBSERVATION_FRAME_INVALID",
      "Self-observation frame failed its strict schema projection",
      error,
    );
  }
  const identity = { ...normalized } as Record<string, unknown>;
  delete identity.observationHash;
  if (text !== canonicalJsonStringify(identity)) {
    return failV2(
      "DARWIN_HOST_SELF_OBSERVATION_FRAME_INVALID",
      "Self-observation frame must be canonical JSON in its exact wire order",
    );
  }
  if (canonicalizePlatformReleaseBootstrapDarwinHostSelfObservationV2(normalized).length < 1) {
    return failV2(
      "DARWIN_HOST_SELF_OBSERVATION_FRAME_INVALID",
      "Self-observation frame canonicalization returned no bytes",
    );
  }
  return normalized;
}

function assertObservationChallengeV2(challenge: Buffer): void {
  if (
    challenge.byteLength !== 32
    || isProxy(challenge)
    || Object.getPrototypeOf(challenge) !== Buffer.prototype
  ) {
    return failV2(
      "DARWIN_HOST_SELF_OBSERVATION_FRAME_INVALID",
      "Self-observation challenge must be one exact private 32-byte Buffer",
    );
  }
}

export function parsePlatformReleaseBootstrapDarwinHostSelfObservationNativeFrameForTestV2(
  stdout: Buffer,
  challenge: Buffer,
): PlatformReleaseBootstrapDarwinHostSelfObservationV2 {
  assertObservationChallengeV2(challenge);
  const observation = parseNativeFrameV2(stdout);
  const expected = Buffer.from(sha256BytesV2(challenge), "ascii");
  const observed = Buffer.from(observation.challengeHash, "ascii");
  const matches = expected.byteLength === observed.byteLength
    && timingSafeEqual(expected, observed);
  expected.fill(0);
  observed.fill(0);
  if (!matches) {
    return failV2(
      "DARWIN_HOST_SELF_OBSERVATION_FRAME_INVALID",
      "Self-observation frame challenge hash does not bind the supplied challenge",
    );
  }
  return observation;
}

async function invokeNativeV2(
  binary: string,
  challenge: Buffer,
): Promise<PlatformReleaseBootstrapDarwinHostSelfObservationV2> {
  assertObservationChallengeV2(challenge);
  const stdin = Buffer.from(
    `self_observe_v2:${challenge.toString("hex")}\n`,
    "utf8",
  );
  let result: ContainedProcessResultV2 | undefined;
  try {
    result = await runContainedProcessV2(binary, [], {
      cwd: path.dirname(binary),
      env: {
        HOME: "/var/empty",
        LANG: "C",
        LC_ALL: "C",
        PATH: "/usr/bin:/bin",
        TZ: "UTC",
      },
      errorCode: "DARWIN_HOST_SELF_OBSERVATION_PROCESS_FAILED",
      label: "Security.framework self-observation",
      requireEmptyStderr: true,
      stdin,
      stdinByteLimit: 96,
      stderrByteLimit: MAX_STDERR_BYTES_V2,
      stdoutByteLimit: MAX_STDOUT_BYTES_V2,
      timeoutMilliseconds: NATIVE_TIMEOUT_MILLISECONDS_V2,
    });
    return parsePlatformReleaseBootstrapDarwinHostSelfObservationNativeFrameForTestV2(
      result.stdout,
      challenge,
    );
  } finally {
    stdin.fill(0);
    result?.stdout.fill(0);
    result?.stderr.fill(0);
  }
}

function occurrenceHashV2(
  observation: PlatformReleaseBootstrapDarwinHostSelfObservationV2,
  sequence: number,
): string {
  return hashCanonicalJson({
    schema: OCCURRENCE_SCHEMA_V2,
    challengeHash: observation.challengeHash,
    executablePhysicalIdentityHash: hashCanonicalJson(
      observation.executable.stableIdentity,
    ),
    executableMutableFingerprintHash: hashCanonicalJson(
      observation.executable.mutableFingerprint,
    ),
    observationHash: observation.observationHash,
    sequence,
  });
}

type HostSelfObservationBeforeLeaseReleaseCheckpointV2 = () => Promise<void>;

async function observePlatformReleaseBootstrapDarwinHostSelfObservationInternalV2(
  fixture: PlatformReleaseBootstrapDarwinHostSelfObservationFixtureV2,
  options: Readonly<{ sequence?: number; challenge?: Buffer }>,
  beforeLeaseRelease:
    HostSelfObservationBeforeLeaseReleaseCheckpointV2 | undefined,
): Promise<PlatformReleaseBootstrapDarwinHostSelfObservationOccurrenceV2> {
  const fixtureState = acquireFixtureLeaseV2(fixture);
  let challenge: Buffer | undefined;
  try {
    challenge = options.challenge === undefined
      ? randomBytes(32)
      : Buffer.from(options.challenge);
    const buildPin = assertFixtureBuildPinV2(
      fixtureState.binary,
      fixtureState.buildReceipt,
    );
    const observation = await invokeNativeV2(fixtureState.binary, challenge);
    assertExecutableEvidenceCurrentV2(
      fixtureState.binary,
      observation,
      buildPin,
    );
    const sequence = options.sequence ?? 1;
    if (!Number.isSafeInteger(sequence) || sequence < 1) {
      return failV2(
        "DARWIN_HOST_SELF_OBSERVATION_FRAME_INVALID",
        "Self-observation sequence must be one positive safe integer",
      );
    }
    const occurrenceHash = occurrenceHashV2(observation, sequence);
    return Object.freeze({
      schema: OCCURRENCE_SCHEMA_V2,
      admissionScope: "test_fixture",
      productionAuthority: false,
      challengeHash: observation.challengeHash,
      observation,
      executablePhysicalIdentityHash: hashCanonicalJson(
        observation.executable.stableIdentity,
      ),
      executableMutableFingerprintHash: hashCanonicalJson(
        observation.executable.mutableFingerprint,
      ),
      occurrenceHash,
    });
  } finally {
    challenge?.fill(0);
    try {
      await beforeLeaseRelease?.();
    } finally {
      releaseFixtureLeaseV2(fixtureState);
    }
  }
}

export async function observePlatformReleaseBootstrapDarwinHostSelfObservationForTestV2(
  fixture: PlatformReleaseBootstrapDarwinHostSelfObservationFixtureV2,
  options: Readonly<{ sequence?: number; challenge?: Buffer }> = {},
): Promise<PlatformReleaseBootstrapDarwinHostSelfObservationOccurrenceV2> {
  return observePlatformReleaseBootstrapDarwinHostSelfObservationInternalV2(
    fixture,
    options,
    undefined,
  );
}

export function observePlatformReleaseBootstrapDarwinHostSelfObservationPendingLeaseForTestV2(
  fixture: PlatformReleaseBootstrapDarwinHostSelfObservationFixtureV2,
): Readonly<{
  leaseHeld: Promise<true>;
  release(): void;
  result: Promise<PlatformReleaseBootstrapDarwinHostSelfObservationOccurrenceV2>;
}> {
  let resolveLeaseHeld!: (value: true) => void;
  let resolveRelease!: () => void;
  let released = false;
  const leaseHeld = new Promise<true>((resolve) => {
    resolveLeaseHeld = resolve;
  });
  const releaseGate = new Promise<void>((resolve) => {
    resolveRelease = resolve;
  });
  const challenge = Buffer.alloc(32, 0x5a);
  const result =
    observePlatformReleaseBootstrapDarwinHostSelfObservationInternalV2(
      fixture,
      { sequence: 7_777, challenge },
      async () => {
        resolveLeaseHeld(true);
        await releaseGate;
      },
    );
  challenge.fill(0);
  return Object.freeze({
    leaseHeld,
    release(): void {
      if (released) return;
      released = true;
      resolveRelease();
    },
    result,
  });
}

export async function buildPlatformReleaseBootstrapDarwinHostSelfObservationFixtureForTestV2():
  Promise<PlatformReleaseBootstrapDarwinHostSelfObservationFixtureV2> {
  return buildFixtureV2(undefined, undefined);
}

export async function observePlatformReleaseBootstrapDarwinHostSelfObservationSuccessfulBuilderReceiptFailureRetentionForTestV2():
  Promise<Readonly<{
    buildRootAlias: string;
    buildRoot: string;
    binary: string;
    errorCode: "DARWIN_HOST_SELF_OBSERVATION_BUILD_FAILED";
    dispose(): PlatformReleaseBootstrapDarwinHostSelfObservationRetentionDispositionV2;
  }>> {
  let observedRoot: Readonly<{ alias: string; root: string }> | undefined;
  try {
    const fixture = await buildFixtureV2(
      "malformed_receipt_after_success",
      (root) => {
        observedRoot = root;
      },
    );
    fixture.dispose();
    failV2(
      "DARWIN_HOST_SELF_OBSERVATION_BUILD_FAILED",
      "Host self-observation malformed-receipt fault did not fail closed",
    );
  } catch (error) {
    if (
      observedRoot === undefined
      || !(error
        instanceof PlatformReleaseBootstrapDarwinHostSelfObservationFixtureErrorV2)
      || error.code !== "DARWIN_HOST_SELF_OBSERVATION_BUILD_FAILED"
    ) {
      throw error;
    }
    const retained = observedRoot as Readonly<{ alias: string; root: string }>;
    const observed = lstatSync(retained.root);
    if (observed.isSymbolicLink() || !observed.isDirectory()) throw error;
    return retainedRootObservationV2({
      buildRootAlias: retained.alias,
      buildRoot: retained.root,
      binary: path.join(retained.root, "host-self-observation-v2"),
      errorCode: error.code,
    });
  }
}
