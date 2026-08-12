import { randomBytes, createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import {
  chmodSync,
  closeSync,
  constants,
  copyFileSync,
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
  canonicalizePlatformReleaseBootstrapDarwinSuspendedExecBindingV2,
  parsePlatformReleaseBootstrapDarwinSuspendedExecBindingCandidateV2,
  type PlatformReleaseBootstrapDarwinSuspendedExecBindingV2,
} from "../execution/schemas/platform-release-bootstrap-darwin-suspended-exec-binding-v2.js";
import { deepFreezePlatformReleaseJsonV2 } from "../execution/schemas/platform-release-common-v2.js";

const BUILDER_V2 = path.resolve(
  import.meta.dirname,
  "../../scripts/build-platform-release-bootstrap-suspended-exec-controller-fixture-v2.mjs",
);
const REPOSITORY_ROOT_V2 = path.resolve(import.meta.dirname, "../..");
const BUILD_ROOT_PREFIX_V2 = "setfarm-suspended-exec-controller-v2-";
const MAX_STDOUT_BYTES_V2 = 64 * 1024;
const MAX_STDERR_BYTES_V2 = 4 * 1024;
const BUILD_TIMEOUT_MILLISECONDS_V2 = 120_000;
const PROCESS_LIST_TIMEOUT_MILLISECONDS_V2 = 2_000;
const PROCESS_GROUP_DEATH_ATTEMPTS_V2 = 300;
const PROCESS_GROUP_DEATH_INTERVAL_MILLISECONDS_V2 = 10;
const PROCESS_SETTLEMENT_TIMEOUT_MILLISECONDS_V2 = 3_000;
const MAX_CONTROLLER_BYTES_V2 = 4 * 1024 * 1024;
const PUBLICATION_POLICY_V2 =
  "descriptor_exclusive_copy_no_replace_fsync_post_fence_false_authority_v2";
const STAGE_WORKSPACE_POLICY_V2 =
  "retained_on_success_or_failure_until_caller_root_disposal_false_authority_v2";
const RETENTION_DISPOSITION_SCHEMA_V2 =
  "setfarm.platform-release-bootstrap-suspended-exec-controller-fixture-retention-disposition.v2" as const;
const RUN_RESIDUE_DISPOSITION_SCHEMA_V2 =
  "setfarm.platform-release-bootstrap-darwin-suspended-exec-run-residue-disposition.v2" as const;
const COMPILE_FLAGS_V2 = Object.freeze([
  "-std=c17",
  "-O2",
  "-Wall",
  "-Wextra",
  "-Werror",
  "-fno-ident",
  "-mmacosx-version-min=13.0",
  "-arch",
  "arm64",
  "-arch",
  "x86_64",
  "-isysroot",
  "MACOSX_SDK_V2",
  "-framework",
  "Security",
  "-framework",
  "CoreFoundation",
]);
const FRAMEWORKS_V2 = Object.freeze(["CoreFoundation", "Security"]);
const SPAWN_FLAGS_V2 = Object.freeze([
  "POSIX_SPAWN_START_SUSPENDED",
  "POSIX_SPAWN_CLOEXEC_DEFAULT",
]);
// Native worst case is bounded at 1s stop + 5s observation + 2s run + 1s reap.
// Keep a bounded 3s scheduler/launch/output margin outside that 9s contract.
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SUSPENDED_EXEC_OUTER_TIMEOUT_MILLISECONDS_V2 =
  12_000;

export type PlatformReleaseBootstrapDarwinSuspendedExecModeV2 =
  | "baseline"
  | "pre_spawn_replacement"
  | "post_spawn_rename"
  | "post_resume_drift"
  | "security_observation_failure"
  | "malformed"
  | "timeout"
  | "canary_then_nonzero_exit"
  | "canary_then_signal";

export type PlatformReleaseBootstrapDarwinSuspendedExecFixtureV2 = Readonly<{
  buildRootAlias: string;
  buildRoot: string;
  controller: string;
  buildReceipt: Readonly<Record<string, unknown>>;
  dispose(): PlatformReleaseBootstrapDarwinSuspendedExecRetentionDispositionV2;
}>;

export type PlatformReleaseBootstrapDarwinSuspendedExecRetentionDispositionV2 =
  Readonly<{
    schema: typeof RETENTION_DISPOSITION_SCHEMA_V2;
    admissionScope: "test_fixture";
    productionAuthority: false;
    deletionAuthority: false;
    filesystemMutationPerformed: false;
    rootDisposition: "retained_no_atomic_same_uid_conditional_delete_v2";
  }>;

export type PlatformReleaseBootstrapDarwinSuspendedExecRunResidueDispositionV2 =
  Readonly<{
    schema: typeof RUN_RESIDUE_DISPOSITION_SCHEMA_V2;
    admissionScope: "test_fixture";
    productionAuthority: false;
    deletionAuthority: false;
    filesystemMutationPerformed: false;
    rootDisposition: "retained_no_atomic_same_uid_conditional_delete_v2";
  }>;

export type PlatformReleaseBootstrapDarwinSuspendedExecFixtureErrorCodeV2 =
  | "DARWIN_SUSPENDED_EXEC_PLATFORM_UNAVAILABLE"
  | "DARWIN_SUSPENDED_EXEC_BUILD_FAILED"
  | "DARWIN_SUSPENDED_EXEC_FIXTURE_DISPOSE_INVALID"
  | "DARWIN_SUSPENDED_EXEC_FIXTURE_HANDLE_UNAUTHENTICATED"
  | "DARWIN_SUSPENDED_EXEC_INPUT_INVALID"
  | "DARWIN_SUSPENDED_EXEC_PROCESS_FAILED"
  | "DARWIN_SUSPENDED_EXEC_FRAME_INVALID"
  | "DARWIN_SUSPENDED_EXEC_TARGET_DRIFT"
  | "DARWIN_SUSPENDED_EXEC_ORPHAN_OBSERVED";

export class PlatformReleaseBootstrapDarwinSuspendedExecFixtureErrorV2
  extends TypeError {
  constructor(
    readonly code: PlatformReleaseBootstrapDarwinSuspendedExecFixtureErrorCodeV2,
    message: string,
    options: ErrorOptions = {},
  ) {
    super(message.slice(0, 1_500), options);
    this.name = "PlatformReleaseBootstrapDarwinSuspendedExecFixtureErrorV2";
  }
}

function failureV2(
  code: PlatformReleaseBootstrapDarwinSuspendedExecFixtureErrorCodeV2,
  message: string,
  cause?: unknown,
): PlatformReleaseBootstrapDarwinSuspendedExecFixtureErrorV2 {
  return new PlatformReleaseBootstrapDarwinSuspendedExecFixtureErrorV2(
    code,
    message,
    cause === undefined ? {} : { cause },
  );
}

function failV2(
  code: PlatformReleaseBootstrapDarwinSuspendedExecFixtureErrorCodeV2,
  message: string,
  cause?: unknown,
): never {
  throw failureV2(code, message, cause);
}

type SuspendedExecFixtureStateV2 = {
  readonly buildRootAlias: string;
  readonly buildRoot: string;
  readonly controller: string;
  readonly buildReceipt: Readonly<Record<string, unknown>>;
  activeLeases: number;
};

const fixtureStatesV2 = new WeakMap<object, SuspendedExecFixtureStateV2>();
const retainedRootObservationHandlesV2 = new WeakSet<object>();

function retainedWorkspaceDispositionV2():
  PlatformReleaseBootstrapDarwinSuspendedExecRetentionDispositionV2 {
  return Object.freeze({
    schema: RETENTION_DISPOSITION_SCHEMA_V2,
    admissionScope: "test_fixture",
    productionAuthority: false,
    deletionAuthority: false,
    filesystemMutationPerformed: false,
    rootDisposition: "retained_no_atomic_same_uid_conditional_delete_v2",
  });
}

function retainedRunResidueDispositionV2():
  PlatformReleaseBootstrapDarwinSuspendedExecRunResidueDispositionV2 {
  return Object.freeze({
    schema: RUN_RESIDUE_DISPOSITION_SCHEMA_V2,
    admissionScope: "test_fixture",
    productionAuthority: false,
    deletionAuthority: false,
    filesystemMutationPerformed: false,
    rootDisposition: "retained_no_atomic_same_uid_conditional_delete_v2",
  });
}

function authenticFixtureStateV2(
  fixture: PlatformReleaseBootstrapDarwinSuspendedExecFixtureV2,
): SuspendedExecFixtureStateV2 {
  if (
    typeof fixture !== "object"
    || fixture === null
    || isProxy(fixture)
  ) {
    return failV2(
      "DARWIN_SUSPENDED_EXEC_FIXTURE_HANDLE_UNAUTHENTICATED",
      "Suspended-exec fixture handle must be one exact non-proxy active handle",
    );
  }
  const state = fixtureStatesV2.get(fixture);
  if (state === undefined) {
    return failV2(
      "DARWIN_SUSPENDED_EXEC_FIXTURE_HANDLE_UNAUTHENTICATED",
      "Suspended-exec fixture handle is not active",
    );
  }
  return state;
}

function acquireFixtureLeaseV2(
  fixture: PlatformReleaseBootstrapDarwinSuspendedExecFixtureV2,
): SuspendedExecFixtureStateV2 {
  const state = authenticFixtureStateV2(fixture);
  state.activeLeases += 1;
  return state;
}

function releaseFixtureLeaseV2(state: SuspendedExecFixtureStateV2): void {
  state.activeLeases -= 1;
}

function disposeFixtureV2(
  this: PlatformReleaseBootstrapDarwinSuspendedExecFixtureV2,
): PlatformReleaseBootstrapDarwinSuspendedExecRetentionDispositionV2 {
  const fixture = this;
  const state = authenticFixtureStateV2(fixture);
  if (state.activeLeases !== 0) {
    return failV2(
      "DARWIN_SUSPENDED_EXEC_FIXTURE_DISPOSE_INVALID",
      "Suspended-exec fixture cannot be disposed during an active invocation",
    );
  }
  fixtureStatesV2.delete(fixture);
  return retainedWorkspaceDispositionV2();
}

type RetainedRootObservationFieldsV2 = Readonly<Record<string, unknown>>;

function disposeRetainedRootObservationV2(
  this: Readonly<{ dispose(): PlatformReleaseBootstrapDarwinSuspendedExecRetentionDispositionV2 }>,
): PlatformReleaseBootstrapDarwinSuspendedExecRetentionDispositionV2 {
  const receiver: unknown = this;
  if (
    typeof receiver !== "object"
    || receiver === null
    || isProxy(receiver)
    || !retainedRootObservationHandlesV2.has(receiver)
  ) {
    return failV2(
      "DARWIN_SUSPENDED_EXEC_FIXTURE_HANDLE_UNAUTHENTICATED",
      "Suspended-exec retained-root observation is not active",
    );
  }
  retainedRootObservationHandlesV2.delete(receiver);
  return retainedWorkspaceDispositionV2();
}

function retainedRootObservationV2<T extends RetainedRootObservationFieldsV2>(
  fields: T,
): Readonly<T & {
  dispose(): PlatformReleaseBootstrapDarwinSuspendedExecRetentionDispositionV2;
}> {
  const handle = Object.freeze({
    ...fields,
    dispose: disposeRetainedRootObservationV2,
  }) as Readonly<T & {
    dispose(): PlatformReleaseBootstrapDarwinSuspendedExecRetentionDispositionV2;
  }>;
  retainedRootObservationHandlesV2.add(handle);
  return handle;
}

function sha256V2(bytes: Uint8Array): string {
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

type ExactExecutableCaptureHooksV2 = Readonly<{
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
  errorCode: PlatformReleaseBootstrapDarwinSuspendedExecFixtureErrorCodeV2,
): ExactExecutablePinV2 {
  if (
    observed.isSymbolicLink()
    || !observed.isFile()
    || observed.nlink !== 1n
    || (observed.mode & 0o7777n) !== 0o500n
    || observed.size < 1n
    || observed.size > BigInt(MAX_CONTROLLER_BYTES_V2)
  ) {
    return failV2(
      errorCode,
      "Suspended-exec executable must be one bounded mode-0500 single-link ordinary file",
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
  errorCode: PlatformReleaseBootstrapDarwinSuspendedExecFixtureErrorCodeV2,
  hooks: ExactExecutableCaptureHooksV2 | undefined = undefined,
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
      "Suspended-exec executable descriptor could not be opened exactly",
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
            "Suspended-exec executable changed during exact descriptor capture",
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
          "Suspended-exec executable changed during exact descriptor capture",
        );
      }
      hooks?.beforePathIdentityFence?.();
      const pathStat = lstatSync(filePath, { bigint: true });
      if (!sameExactExecutablePinV2(pathStat, beforePin)) {
        return failV2(
          errorCode,
          "Suspended-exec executable pathname changed before its exact identity fence",
        );
      }
      captured = Object.freeze({
        bytes,
        byteLength,
        sha256: sha256V2(bytes),
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
    "Suspended-exec executable capture and descriptor close both failed",
  );
  if (captured === undefined) {
    return failV2(
      errorCode,
      "Suspended-exec executable capture ended without exact evidence",
    );
  }
  return captured;
}

export function capturePlatformReleaseBootstrapDarwinSuspendedExecExecutableForTestV2(
  filePath: string,
  hooks: ExactExecutableCaptureHooksV2 | undefined = undefined,
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
      "DARWIN_SUSPENDED_EXEC_INPUT_INVALID",
      "Suspended-exec executable capture test input is invalid",
    );
  }
  const captured = captureExactExecutableV2(
    filePath,
    "DARWIN_SUSPENDED_EXEC_BUILD_FAILED",
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
  const alias = mkdtempSync(path.join(os.tmpdir(), BUILD_ROOT_PREFIX_V2));
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
    return failV2(
      "DARWIN_SUSPENDED_EXEC_BUILD_FAILED",
      "Suspended-exec fixture root must be one private process-owned directory",
    );
  }
  return Object.freeze({ alias, root });
}

function assertBuildReceiptV2(
  controller: string,
  receipt: Readonly<Record<string, unknown>>,
): void {
  const expectedKeys = [
    "admissionScope",
    "binary",
    "buildRecipeHash",
    "compileContract",
    "credentialUse",
    "descriptorExecution",
    "libprocApiStability",
    "productionAuthority",
    "publicationPolicy",
    "schema",
    "signingAuthority",
    "stageWorkspacePolicy",
    "trustConclusion",
  ];
  const binary = receipt.binary;
  const compileContract = receipt.compileContract;
  if (
    JSON.stringify(Object.keys(receipt).sort()) !== JSON.stringify(expectedKeys)
    || receipt.schema !==
      "setfarm.platform-release-bootstrap-suspended-exec-controller-fixture-build-receipt.v2"
    || receipt.admissionScope !== "test_fixture"
    || receipt.productionAuthority !== false
    || receipt.credentialUse !== "none"
    || receipt.descriptorExecution !== false
    || receipt.libprocApiStability !== "private_unproven"
    || receipt.trustConclusion !== "characterization_only"
    || receipt.signingAuthority !== "adhoc_or_unsigned_test_fixture"
    || receipt.publicationPolicy !== PUBLICATION_POLICY_V2
    || receipt.stageWorkspacePolicy !== STAGE_WORKSPACE_POLICY_V2
    || typeof receipt.buildRecipeHash !== "string"
    || !/^[a-f0-9]{64}$/u.test(receipt.buildRecipeHash)
    || typeof binary !== "object"
    || binary === null
    || typeof compileContract !== "object"
    || compileContract === null
  ) {
    return failV2(
      "DARWIN_SUSPENDED_EXEC_BUILD_FAILED",
      "Suspended-exec build receipt attempted authority promotion or omitted its compile contract",
    );
  }
  const binaryRecord = binary as Record<string, unknown>;
  const compileRecord = compileContract as Record<string, unknown>;
  const stableIdentity = binaryRecord.stableIdentity;
  const captured = captureExactExecutableV2(
    controller,
    "DARWIN_SUSPENDED_EXEC_BUILD_FAILED",
  );
  try {
    if (
      JSON.stringify(Object.keys(binaryRecord).sort()) !== JSON.stringify([
        "architectureSet",
        "byteLength",
        "mode",
        "sha256",
        "stableIdentity",
      ])
      || !Array.isArray(binaryRecord.architectureSet)
      || JSON.stringify(binaryRecord.architectureSet) !==
        JSON.stringify(["arm64", "x86_64"])
      || binaryRecord.byteLength !== captured.byteLength
      || binaryRecord.mode !== "0500"
      || binaryRecord.sha256 !== captured.sha256
      || typeof stableIdentity !== "object"
      || stableIdentity === null
      || JSON.stringify(Object.keys(stableIdentity).sort()) !== JSON.stringify([
        "device",
        "inode",
        "objectKind",
      ])
      || (stableIdentity as Record<string, unknown>).objectKind !==
        "ordinary_file"
      || (stableIdentity as Record<string, unknown>).device !==
        captured.pin.device.toString()
      || (stableIdentity as Record<string, unknown>).inode !==
        captured.pin.inode.toString()
      || JSON.stringify(Object.keys(compileRecord).sort()) !== JSON.stringify([
        "compileFlags",
        "deploymentTarget",
        "frameworks",
        "spawnFlags",
      ])
      || JSON.stringify(compileRecord.compileFlags) !==
        JSON.stringify(COMPILE_FLAGS_V2)
      || compileRecord.deploymentTarget !== "13.0"
      || JSON.stringify(compileRecord.frameworks) !==
        JSON.stringify(FRAMEWORKS_V2)
      || JSON.stringify(compileRecord.spawnFlags) !==
        JSON.stringify(SPAWN_FLAGS_V2)
    ) {
      return failV2(
        "DARWIN_SUSPENDED_EXEC_BUILD_FAILED",
        "Suspended-exec build receipt does not pin its exact test binary and spawn flags",
      );
    }
  } finally {
    captured.bytes.fill(0);
  }
}

type ContainedProcessFaultInjectionV2 =
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

function processContainmentProvenV2(error: unknown): boolean {
  return (
    typeof error === "object"
    && error !== null
    && "containmentProven" in error
    && error.containmentProven === true
  );
}

async function runContainedProcessV2(
  executable: string,
  argv: readonly string[],
  options: Readonly<{
    cwd: string;
    env: NodeJS.ProcessEnv;
    errorCode: PlatformReleaseBootstrapDarwinSuspendedExecFixtureErrorCodeV2;
    label: string;
    timeoutMilliseconds: number;
    stdoutByteLimit: number;
    stderrByteLimit: number;
    requireEmptyStderr?: boolean;
    faultInjection?: ContainedProcessFaultInjectionV2;
  }>,
): Promise<ContainedProcessResultV2> {
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
      latchFirstCause(
        failureV2(
          options.errorCode,
          `${options.label} exceeded the bounded ${name} capture`,
        ),
        true,
      );
      return;
    }
    if (firstCause !== undefined) return;
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
    child.stdin.end();
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

export async function runPlatformReleaseBootstrapDarwinSuspendedExecContainedProcessFaultForTestV2(
  faultInjection: ContainedProcessFaultInjectionV2,
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
      "DARWIN_SUSPENDED_EXEC_INPUT_INVALID",
      "Suspended-exec contained-process fault is outside the exact test set",
    );
  }
  const result = await runContainedProcessV2(
    process.execPath,
    ["-e", "setInterval(() => {}, 1000)"],
    {
      cwd: REPOSITORY_ROOT_V2,
      env: {
        HOME: "/var/empty",
        LANG: "C",
        LC_ALL: "C",
        PATH: "/usr/bin:/bin",
        TZ: "UTC",
      },
      errorCode: "DARWIN_SUSPENDED_EXEC_PROCESS_FAILED",
      faultInjection,
      label: "Suspended-exec contained-process fault fixture",
      stderrByteLimit: MAX_STDERR_BYTES_V2,
      stdoutByteLimit: MAX_STDOUT_BYTES_V2,
      timeoutMilliseconds: 25,
    },
  );
  result.stdout.fill(0);
  result.stderr.fill(0);
  return failV2(
    "DARWIN_SUSPENDED_EXEC_PROCESS_FAILED",
    "Suspended-exec contained-process fault did not fail closed",
  );
}

async function buildPlatformReleaseBootstrapDarwinSuspendedExecFixtureInternalV2(
  faultInjection: ContainedProcessFaultInjectionV2 | undefined,
  observeRoot: ((root: Readonly<{ alias: string; root: string }>) => void)
    | undefined,
  receiptFault: "malformed_receipt_after_success" | undefined,
): Promise<PlatformReleaseBootstrapDarwinSuspendedExecFixtureV2> {
  if (process.platform !== "darwin") {
    return failV2(
      "DARWIN_SUSPENDED_EXEC_PLATFORM_UNAVAILABLE",
      "Suspended-exec fixture requires macOS",
    );
  }
  const root = exactPrivateRootV2();
  observeRoot?.(root);
  const controller = path.join(root.root, "suspended-exec-controller-v2");
  let built: ContainedProcessResultV2 | undefined;
  try {
    built = await runContainedProcessV2(
      process.execPath,
      [BUILDER_V2, "--out-file", controller],
      {
        cwd: REPOSITORY_ROOT_V2,
        env: {
          HOME: "/var/empty",
          LANG: "C",
          LC_ALL: "C",
          PATH: "/usr/bin:/bin",
          TZ: "UTC",
        },
        errorCode: "DARWIN_SUSPENDED_EXEC_BUILD_FAILED",
        faultInjection,
        label: "Suspended-exec builder",
        requireEmptyStderr: true,
        stderrByteLimit: 2 * 1024 * 1024,
        stdoutByteLimit: 2 * 1024 * 1024,
        timeoutMilliseconds: BUILD_TIMEOUT_MILLISECONDS_V2,
      },
    );
    const buildReceipt = deepFreezePlatformReleaseJsonV2(
      JSON.parse(
        receiptFault === "malformed_receipt_after_success"
          ? "{"
          : built.stdout.toString("utf8"),
      ),
    ) as Readonly<Record<string, unknown>>;
    assertBuildReceiptV2(controller, buildReceipt);
    let fixture!: PlatformReleaseBootstrapDarwinSuspendedExecFixtureV2;
    fixture = Object.freeze({
      buildRootAlias: root.alias,
      buildRoot: root.root,
      controller,
      buildReceipt,
      dispose: disposeFixtureV2,
    });
    fixtureStatesV2.set(fixture, {
      buildRootAlias: root.alias,
      buildRoot: root.root,
      controller,
      buildReceipt,
      activeLeases: 0,
    });
    return fixture;
  } catch (error) {
    // Successful builder exit proves nested-tool quiescence, but it does not
    // create atomic same-UID deletion authority. Preserve malformed receipt
    // evidence along with invocation-failure evidence.
    if (error instanceof PlatformReleaseBootstrapDarwinSuspendedExecFixtureErrorV2) {
      throw error;
    }
    return failV2(
      "DARWIN_SUSPENDED_EXEC_BUILD_FAILED",
      "Suspended-exec builder did not return its exact JSON receipt",
      error,
    );
  } finally {
    built?.stdout.fill(0);
    built?.stderr.fill(0);
  }
}

export async function buildPlatformReleaseBootstrapDarwinSuspendedExecFixtureForTestV2():
  Promise<PlatformReleaseBootstrapDarwinSuspendedExecFixtureV2> {
  return buildPlatformReleaseBootstrapDarwinSuspendedExecFixtureInternalV2(
    undefined,
    undefined,
    undefined,
  );
}

export async function observePlatformReleaseBootstrapDarwinSuspendedExecOuterBuilderFailureRetentionForTestV2():
  Promise<Readonly<{
    buildRootAlias: string;
    buildRoot: string;
    outerContainmentProven: boolean;
    dispose(): PlatformReleaseBootstrapDarwinSuspendedExecRetentionDispositionV2;
  }>> {
  let observedRoot: Readonly<{ alias: string; root: string }> | undefined;
  try {
    const fixture = await buildPlatformReleaseBootstrapDarwinSuspendedExecFixtureInternalV2(
      "stdout_stream_error",
      (root) => {
        observedRoot = root;
      },
      undefined,
    );
    fixture.dispose();
    return failV2(
      "DARWIN_SUSPENDED_EXEC_BUILD_FAILED",
      "Suspended-exec outer builder fault did not fail closed",
    );
  } catch (error) {
    if (observedRoot === undefined) throw error;
    const retained = observedRoot as Readonly<{ alias: string; root: string }>;
    const observed = lstatSync(retained.root);
    if (observed.isSymbolicLink() || !observed.isDirectory()) {
      throw error;
    }
    return retainedRootObservationV2({
      buildRootAlias: retained.alias,
      buildRoot: retained.root,
      outerContainmentProven: processContainmentProvenV2(error),
    });
  }
}

export async function observePlatformReleaseBootstrapDarwinSuspendedExecSuccessfulBuilderReceiptFailureRetentionForTestV2():
  Promise<Readonly<{
    buildRootAlias: string;
    buildRoot: string;
    controller: string;
    errorCode: "DARWIN_SUSPENDED_EXEC_BUILD_FAILED";
    dispose(): PlatformReleaseBootstrapDarwinSuspendedExecRetentionDispositionV2;
  }>> {
  let observedRoot: Readonly<{ alias: string; root: string }> | undefined;
  try {
    const fixture = await buildPlatformReleaseBootstrapDarwinSuspendedExecFixtureInternalV2(
      undefined,
      (root) => {
        observedRoot = root;
      },
      "malformed_receipt_after_success",
    );
    fixture.dispose();
    return failV2(
      "DARWIN_SUSPENDED_EXEC_BUILD_FAILED",
      "Suspended-exec malformed-receipt fault did not fail closed",
    );
  } catch (error) {
    if (
      observedRoot === undefined
      || !(error instanceof PlatformReleaseBootstrapDarwinSuspendedExecFixtureErrorV2)
      || error.code !== "DARWIN_SUSPENDED_EXEC_BUILD_FAILED"
    ) {
      throw error;
    }
    const retained = observedRoot as Readonly<{ alias: string; root: string }>;
    const observed = lstatSync(retained.root);
    if (observed.isSymbolicLink() || !observed.isDirectory()) throw error;
    return retainedRootObservationV2({
      buildRootAlias: retained.alias,
      buildRoot: retained.root,
      controller: path.join(retained.root, "suspended-exec-controller-v2"),
      errorCode: error.code,
    });
  }
}

function assertChallengeV2(challenge: Buffer): void {
  if (
    challenge.byteLength !== 32
    || isProxy(challenge)
    || Object.getPrototypeOf(challenge) !== Buffer.prototype
  ) {
    return failV2(
      "DARWIN_SUSPENDED_EXEC_INPUT_INVALID",
      "Suspended-exec challenge must be one exact private 32-byte Buffer",
    );
  }
}

export function parsePlatformReleaseBootstrapDarwinSuspendedExecNativeFrameForTestV2(
  stdout: Buffer,
): PlatformReleaseBootstrapDarwinSuspendedExecBindingV2 {
  if (
    stdout.byteLength < 2
    || stdout.byteLength > MAX_STDOUT_BYTES_V2
    || stdout[stdout.byteLength - 1] !== 0x0a
    || stdout.subarray(0, -1).includes(0x0a)
    || isProxy(stdout)
    || Object.getPrototypeOf(stdout) !== Buffer.prototype
  ) {
    return failV2(
      "DARWIN_SUSPENDED_EXEC_FRAME_INVALID",
      "Suspended-exec stdout must be one bounded newline-terminated Buffer frame",
    );
  }
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(
      stdout.subarray(0, -1),
    );
  } catch (error) {
    return failV2(
      "DARWIN_SUSPENDED_EXEC_FRAME_INVALID",
      "Suspended-exec frame must be strict UTF-8",
      error,
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return failV2(
      "DARWIN_SUSPENDED_EXEC_FRAME_INVALID",
      "Suspended-exec frame must be valid JSON",
      error,
    );
  }
  let normalized: PlatformReleaseBootstrapDarwinSuspendedExecBindingV2;
  try {
    normalized = parsePlatformReleaseBootstrapDarwinSuspendedExecBindingCandidateV2(
      parsed,
    );
  } catch (error) {
    return failV2(
      "DARWIN_SUSPENDED_EXEC_FRAME_INVALID",
      "Suspended-exec frame failed its strict false-authority schema",
      error,
    );
  }
  if (
    text !== canonicalizePlatformReleaseBootstrapDarwinSuspendedExecBindingV2(
      normalized,
    )
  ) {
    return failV2(
      "DARWIN_SUSPENDED_EXEC_FRAME_INVALID",
      "Suspended-exec frame must use exact canonical JSON wire order",
    );
  }
  return normalized;
}

function exactModeV2(
  mode: string,
): asserts mode is PlatformReleaseBootstrapDarwinSuspendedExecModeV2 {
  if (![
    "baseline",
    "pre_spawn_replacement",
    "post_spawn_rename",
    "post_resume_drift",
    "security_observation_failure",
    "malformed",
    "timeout",
    "canary_then_nonzero_exit",
    "canary_then_signal",
  ].includes(mode)) {
    return failV2(
      "DARWIN_SUSPENDED_EXEC_INPUT_INVALID",
      "Suspended-exec mode is outside the exact bounded fixture set",
    );
  }
}

async function invokeControllerV2(
  controller: string,
  mode: PlatformReleaseBootstrapDarwinSuspendedExecModeV2,
  target: string,
  replacement: string,
  challenge: Buffer,
): Promise<Buffer> {
  const result = await runContainedProcessV2(
    controller,
    [
      "--setfarm-suspended-controller-v2",
      mode,
      target,
      replacement,
      challenge.toString("hex"),
    ],
    {
      cwd: path.dirname(target),
      env: {
        HOME: "/var/empty",
        LANG: "C",
        LC_ALL: "C",
        PATH: "/usr/bin:/bin",
        TZ: "UTC",
      },
      errorCode: "DARWIN_SUSPENDED_EXEC_PROCESS_FAILED",
      label: "Suspended-exec controller",
      requireEmptyStderr: true,
      stderrByteLimit: MAX_STDERR_BYTES_V2,
      stdoutByteLimit: MAX_STDOUT_BYTES_V2,
      timeoutMilliseconds:
        PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SUSPENDED_EXEC_OUTER_TIMEOUT_MILLISECONDS_V2,
    },
  );
  result.stderr.fill(0);
  return result.stdout;
}

function assertNoOrphanV2(target: string): void {
  const observed = spawnSync("/bin/ps", ["-ax", "-o", "command="], {
    encoding: "utf8",
    env: { LANG: "C", LC_ALL: "C", PATH: "/usr/bin:/bin" },
    maxBuffer: 8 * 1024 * 1024,
    timeout: PROCESS_LIST_TIMEOUT_MILLISECONDS_V2,
    killSignal: "SIGKILL",
    shell: false,
  });
  if (
    observed.status !== 0
    || observed.signal !== null
    || observed.error
    || observed.stdout.split("\n").some((line) => line.includes(target))
  ) {
    return failV2(
      "DARWIN_SUSPENDED_EXEC_ORPHAN_OBSERVED",
      "Suspended-exec controller left a target process or could not prove its absence",
      observed.error,
    );
  }
}

type SuspendedExecBeforeLeaseReleaseCheckpointV2 = (
  runRoot: string,
) => Promise<void>;

async function runPlatformReleaseBootstrapDarwinSuspendedExecBindingInternalV2(
  fixture: PlatformReleaseBootstrapDarwinSuspendedExecFixtureV2,
  options: Readonly<{
    mode: PlatformReleaseBootstrapDarwinSuspendedExecModeV2;
    challenge?: Buffer;
  }>,
  beforeLeaseRelease: SuspendedExecBeforeLeaseReleaseCheckpointV2 | undefined,
): Promise<PlatformReleaseBootstrapDarwinSuspendedExecBindingV2> {
  const fixtureState = acquireFixtureLeaseV2(fixture);
  let challenge: Buffer | undefined;
  let runRoot: string | undefined;
  try {
    exactModeV2(options.mode);
    challenge = options.challenge === undefined
      ? randomBytes(32)
      : Buffer.from(options.challenge);
    assertChallengeV2(challenge);
    runRoot = mkdtempSync(path.join(fixtureState.buildRoot, ".run-v2-"));
    chmodSync(runRoot, 0o700);
    const target = path.join(runRoot, "target-v2");
    const replacement = path.join(runRoot, "replacement-v2");
    assertBuildReceiptV2(fixtureState.controller, fixtureState.buildReceipt);
    copyFileSync(fixtureState.controller, target);
    copyFileSync(fixtureState.controller, replacement);
    chmodSync(target, 0o500);
    chmodSync(replacement, 0o500);
    const initial = captureExactExecutableV2(
      target,
      "DARWIN_SUSPENDED_EXEC_TARGET_DRIFT",
    );
    let replacementCapture: ExactExecutableCaptureV2 | undefined;
    try {
      replacementCapture = captureExactExecutableV2(
        replacement,
        "DARWIN_SUSPENDED_EXEC_TARGET_DRIFT",
      );
      if (
        initial.pin.device !== replacementCapture.pin.device
        || initial.pin.inode === replacementCapture.pin.inode
        || !initial.bytes.equals(replacementCapture.bytes)
      ) {
        return failV2(
          "DARWIN_SUSPENDED_EXEC_TARGET_DRIFT",
          "Suspended-exec run did not create exact same-byte distinct-inode targets",
        );
      }
      const stdout = await invokeControllerV2(
        fixtureState.controller,
        options.mode,
        target,
        replacement,
        challenge,
      );
      const receipt = parsePlatformReleaseBootstrapDarwinSuspendedExecNativeFrameForTestV2(
        stdout,
      );
      stdout.fill(0);
      if (
        receipt.heldExecutable.stableIdentity.device !==
          initial.pin.device.toString()
        || receipt.heldExecutable.stableIdentity.inode !==
          initial.pin.inode.toString()
        || receipt.heldExecutable.mutableFingerprint.byteLength !==
          initial.byteLength
        || receipt.heldExecutable.mutableFingerprint.contentHash !==
          initial.sha256
        || receipt.heldExecutable.mutableFingerprint.ownerUid !==
          Number(initial.pin.ownerUid)
        || receipt.heldExecutable.mutableFingerprint.ownerGid !==
          Number(initial.pin.ownerGid)
      ) {
        return failV2(
          "DARWIN_SUSPENDED_EXEC_TARGET_DRIFT",
          "Suspended-exec native receipt does not bind the exact held target descriptor",
        );
      }
      assertNoOrphanV2(target);
      return receipt;
    } finally {
      initial.bytes.fill(0);
      replacementCapture?.bytes.fill(0);
    }
  } finally {
    challenge?.fill(0);
    try {
      if (beforeLeaseRelease !== undefined && runRoot !== undefined) {
        await beforeLeaseRelease(runRoot);
      }
    } finally {
      // Process containment proves process death only. It never grants path
      // deletion authority; every run root remains retained on success/failure.
      releaseFixtureLeaseV2(fixtureState);
    }
  }
}

export async function runPlatformReleaseBootstrapDarwinSuspendedExecBindingForTestV2(
  fixture: PlatformReleaseBootstrapDarwinSuspendedExecFixtureV2,
  options: Readonly<{
    mode: PlatformReleaseBootstrapDarwinSuspendedExecModeV2;
    challenge?: Buffer;
  }>,
): Promise<PlatformReleaseBootstrapDarwinSuspendedExecBindingV2> {
  return runPlatformReleaseBootstrapDarwinSuspendedExecBindingInternalV2(
    fixture,
    options,
    undefined,
  );
}

export function runPlatformReleaseBootstrapDarwinSuspendedExecPendingLeaseForTestV2(
  fixture: PlatformReleaseBootstrapDarwinSuspendedExecFixtureV2,
): Readonly<{
  leaseHeld: Promise<Readonly<{
    runRoot: string;
    residueDisposition:
      PlatformReleaseBootstrapDarwinSuspendedExecRunResidueDispositionV2;
  }>>;
  release(): void;
  result: Promise<PlatformReleaseBootstrapDarwinSuspendedExecBindingV2>;
}> {
  let resolveLeaseHeld!: (value: Readonly<{
    runRoot: string;
    residueDisposition:
      PlatformReleaseBootstrapDarwinSuspendedExecRunResidueDispositionV2;
  }>) => void;
  let resolveRelease!: () => void;
  let released = false;
  const leaseHeld = new Promise<Readonly<{
    runRoot: string;
    residueDisposition:
      PlatformReleaseBootstrapDarwinSuspendedExecRunResidueDispositionV2;
  }>>((resolve) => {
    resolveLeaseHeld = resolve;
  });
  const releaseGate = new Promise<void>((resolve) => {
    resolveRelease = resolve;
  });
  const challenge = Buffer.alloc(32, 0x6b);
  const result =
    runPlatformReleaseBootstrapDarwinSuspendedExecBindingInternalV2(
      fixture,
      { mode: "baseline", challenge },
      async (runRoot) => {
        resolveLeaseHeld(Object.freeze({
          runRoot,
          residueDisposition: retainedRunResidueDispositionV2(),
        }));
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
