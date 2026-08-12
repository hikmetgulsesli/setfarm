import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  chmodSync,
  closeSync,
  constants as fsConstants,
  fstatSync,
  lstatSync,
  mkdtempSync,
  openSync,
  readdirSync,
  realpathSync,
  readSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { isProxy } from "node:util/types";

import {
  acquirePlatformReleaseHostNodeToolchainMetadataOperationLaunchContextInternalV2,
  type PlatformReleaseHostNodeToolchainAuthorityV2,
  type PlatformReleaseHostNodeToolchainMetadataOperationLaunchContextInternalV2,
} from "../execution/platform-release-host-node-toolchain-authority-v2.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_METADATA_OPERATION_POLICY_HASH_V2,
} from "../execution/platform-release-bootstrap-metadata-operation-v2.js";
import {
  hashMetadataProbeDirectoryEntriesV2,
  hashMetadataProbeTargetStableIdentityV2,
} from "../execution/schemas/platform-release-bootstrap-darwin-metadata-probe-v2.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_OPERATION_FAILURE_V2_SCHEMA,
  hashPlatformReleaseBootstrapWireMessageV2,
  parsePlatformReleaseBootstrapWireMessageV2,
} from "../execution/schemas/platform-release-bootstrap-wire-contracts-v2.js";
import {
  PLATFORM_RELEASE_COMPOSITION_METADATA_TEST_ENVIRONMENT_POLICY_V2,
  PLATFORM_RELEASE_COMPOSITION_METADATA_TEST_IMPLEMENTATION_SCOPE_V2,
  PLATFORM_RELEASE_COMPOSITION_METADATA_TEST_MAX_DIRECT_ENTRY_COUNT_V2,
  PLATFORM_RELEASE_COMPOSITION_METADATA_TEST_MAX_TARGET_BYTES_V2,
  PLATFORM_RELEASE_COMPOSITION_METADATA_TEST_OPERATION_ABI_HASH_V2,
  PLATFORM_RELEASE_COMPOSITION_METADATA_TEST_OPERATION_ABI_REF_V2,
  PLATFORM_RELEASE_COMPOSITION_METADATA_TEST_TARGET_BINDING_V2,
  PLATFORM_RELEASE_COMPOSITION_METADATA_TEST_V2_SCHEMA,
  hashPlatformReleaseCompositionMetadataFixedArgvForTestV2,
  hashPlatformReleaseCompositionMetadataForTestV2,
  hashPlatformReleaseCompositionMetadataProcessObservationForTestV2,
  hashPlatformReleaseCompositionMetadataTargetObservationForTestV2,
  parsePlatformReleaseCompositionMetadataForTestV2,
  type PlatformReleaseCompositionMetadataProcessObservationForTestV2,
  type PlatformReleaseCompositionMetadataTargetObservationForTestV2,
  type PlatformReleaseCompositionMetadataTestV2,
  type PlatformReleaseCompositionMetadataWireReceiptForTestV2,
} from "../execution/schemas/platform-release-composition-metadata-test-v2.js";
import {
  canonicalJsonStringify,
  hashCanonicalJson,
} from "./canonical-json.js";

const ROOT_PREFIX_V2 = "setfarm-installed-metadata-operation-v2-";
const ENTRY_BASENAME_V2 = "entry.txt";
const ENTRY_BYTES_V2 = Buffer.from(
  "setfarm installed metadata operation fixture\n",
  "utf8",
);
const INPUT_SCHEMA_V2 =
  "setfarm.platform-release-metadata-probe-input.v2" as const;
const OUTPUT_SCHEMA_V2 =
  "setfarm.platform-release-metadata-probe-receipt.v2" as const;

export type PlatformReleaseBootstrapInstalledMetadataOperationFixtureV2 =
  Readonly<{
    dispose(): void;
  }>;

export type PlatformReleaseBootstrapInstalledMetadataOperationFixtureMutationV2 =
  | "add_target_entry"
  | "add_target_xattr"
  | "replace_entry_same_bytes";

export type PlatformReleaseBootstrapInstalledMetadataOperationErrorCodeV2 =
  | "INSTALLED_METADATA_OPERATION_PLATFORM_UNAVAILABLE"
  | "INSTALLED_METADATA_OPERATION_FIXTURE_BUILD_FAILED"
  | "INSTALLED_METADATA_OPERATION_FIXTURE_HANDLE_UNAUTHENTICATED"
  | "INSTALLED_METADATA_OPERATION_FILESYSTEM_DRIFT"
  | "INSTALLED_METADATA_OPERATION_LAUNCH_AUTHORITY_DRIFT"
  | "INSTALLED_METADATA_OPERATION_SPAWN_FAILED"
  | "INSTALLED_METADATA_OPERATION_TIMEOUT"
  | "INSTALLED_METADATA_OPERATION_OUTPUT_LIMIT"
  | "INSTALLED_METADATA_OPERATION_PROCESS_FAILED"
  | "INSTALLED_METADATA_OPERATION_OPERATION_REJECTED"
  | "INSTALLED_METADATA_OPERATION_OUTPUT_INVALID"
  | "INSTALLED_METADATA_OPERATION_RECEIPT_INVALID";

export type PlatformReleaseBootstrapInstalledMetadataOperationOccurrenceInternalV2 =
  Readonly<{
    hostIdentityHash: string;
    platformHostToolchainReceiptHash: string;
    hostCompositionReceiptHash: string;
    targetRootPhysicalIdentityHash: string;
    metadataPolicyHash:
      typeof PLATFORM_RELEASE_BOOTSTRAP_METADATA_OPERATION_POLICY_HASH_V2;
    occurrenceId: string;
    targetBefore:
      PlatformReleaseCompositionMetadataTargetObservationForTestV2;
    targetAfter:
      PlatformReleaseCompositionMetadataTargetObservationForTestV2;
    receipt:
      PlatformReleaseCompositionMetadataWireReceiptForTestV2;
    process:
      PlatformReleaseCompositionMetadataProcessObservationForTestV2;
  }>;

export class PlatformReleaseBootstrapInstalledMetadataOperationErrorV2
  extends Error {
  readonly code:
    PlatformReleaseBootstrapInstalledMetadataOperationErrorCodeV2;
  override readonly cause?: unknown;

  constructor(
    code: PlatformReleaseBootstrapInstalledMetadataOperationErrorCodeV2,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message.slice(0, 1_500), options);
    this.name =
      "PlatformReleaseBootstrapInstalledMetadataOperationErrorV2";
    this.code = code;
    this.cause = options?.cause;
  }
}

type BigIntStatV2 = ReturnType<typeof lstatSync> & Readonly<{
  dev: bigint;
  ino: bigint;
  uid: bigint;
  gid: bigint;
  mode: bigint;
  nlink: bigint;
  size: bigint;
  mtimeNs: bigint;
  ctimeNs: bigint;
}>;

type StableIdentityV2 = Readonly<{
  hostIdentityHash: string;
  objectKind: "directory";
  device: string;
  inode: string;
}>;

type MutableFingerprintV2 = Readonly<{
  ownerUid: number;
  ownerGid: number;
  mode: string;
  linkCount: number;
  byteLength: number;
  directEntryNamesHash: string;
  modifiedTimeNanoseconds: string;
  changedTimeNanoseconds: string;
}>;

type TargetObservationV2 = Readonly<{
  stableIdentity: StableIdentityV2;
  mutableFingerprint: MutableFingerprintV2;
  observationHash: string;
}>;

type TargetCaptureV2 = Readonly<{
  observation: TargetObservationV2;
  directEntryNames: readonly string[];
}>;

type FixtureStateV2 = Readonly<{
  alias: string;
  targetRoot: string;
  targetStableIdentity: Readonly<{
    objectKind: "directory";
    device: string;
    inode: string;
  }>;
  entryStableIdentity: Readonly<{
    device: string;
    inode: string;
  }>;
  entryContentHash: string;
}>;

export type InstalledTargetOperationProcessResultInternalV2 = Readonly<{
  status:
    | "exited"
    | "spawn_failed"
    | "timed_out"
    | "output_limit_exceeded";
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  pid: number;
  stdout: Buffer;
  stderr: Buffer;
  startedAt: number;
  finishedAt: number;
}>;

const fixtureStatesV2 = new WeakMap<object, FixtureStateV2>();

function failV2(
  code: PlatformReleaseBootstrapInstalledMetadataOperationErrorCodeV2,
  message: string,
  cause?: unknown,
): never {
  throw new PlatformReleaseBootstrapInstalledMetadataOperationErrorV2(
    code,
    message,
    cause === undefined ? undefined : { cause },
  );
}

function sha256BytesV2(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function modeTextV2(stat: BigIntStatV2): string {
  return Number(stat.mode & 0o7777n)
    .toString(8)
    .padStart(4, "0");
}

function ownerIdV2(value: bigint): number {
  const ownerId = Number(value);
  if (
    !Number.isSafeInteger(ownerId)
    || ownerId < 0
    || ownerId > 4_294_967_294
  ) {
    return failV2(
      "INSTALLED_METADATA_OPERATION_FILESYSTEM_DRIFT",
      "Metadata target owner identity is outside the admitted range",
    );
  }
  return ownerId;
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

function sameStableIdentityV2(
  left: Readonly<{
    objectKind?: string;
    device: string;
    inode: string;
  }>,
  right: Readonly<{
    objectKind?: string;
    device: string;
    inode: string;
  }>,
): boolean {
  return left.objectKind === right.objectKind
    && left.device === right.device
    && left.inode === right.inode;
}

function sameStatV2(left: BigIntStatV2, right: BigIntStatV2): boolean {
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

function authenticStateWithoutLayoutV2(
  fixture: PlatformReleaseBootstrapInstalledMetadataOperationFixtureV2,
): FixtureStateV2 {
  if (
    typeof fixture !== "object"
    || fixture === null
    || isProxy(fixture)
  ) {
    return failV2(
      "INSTALLED_METADATA_OPERATION_FIXTURE_HANDLE_UNAUTHENTICATED",
      "Installed metadata operation requires one authentic fixture handle",
    );
  }
  const state = fixtureStatesV2.get(fixture);
  if (state === undefined) {
    return failV2(
      "INSTALLED_METADATA_OPERATION_FIXTURE_HANDLE_UNAUTHENTICATED",
      "Installed metadata operation fixture handle is not code-owned",
    );
  }
  return state;
}

function captureEntryV2(
  entryPath: string,
): Readonly<{
  stableIdentity: Readonly<{ device: string; inode: string }>;
  contentHash: string;
}> {
  let descriptor = -1;
  let bytes: Buffer | undefined;
  const eofProbe = Buffer.alloc(1);
  try {
    const pathBefore = lstatSync(entryPath, {
      bigint: true,
    }) as BigIntStatV2;
    if (
      pathBefore.isSymbolicLink()
      || !pathBefore.isFile()
      || pathBefore.nlink !== 1n
      || modeTextV2(pathBefore) !== "0444"
      || pathBefore.size !== BigInt(ENTRY_BYTES_V2.byteLength)
    ) {
      return failV2(
        "INSTALLED_METADATA_OPERATION_FIXTURE_HANDLE_UNAUTHENTICATED",
        "Installed metadata fixture entry is not one exact 0444 regular file",
      );
    }
    descriptor = openSync(
      entryPath,
      fsConstants.O_RDONLY
        | (fsConstants.O_NOFOLLOW ?? 0)
        | ((fsConstants as unknown as Record<string, number>)
          .O_CLOEXEC ?? 0),
    );
    const descriptorBefore = fstatSync(descriptor, {
      bigint: true,
    }) as BigIntStatV2;
    if (!sameStatV2(pathBefore, descriptorBefore)) {
      return failV2(
        "INSTALLED_METADATA_OPERATION_FIXTURE_HANDLE_UNAUTHENTICATED",
        "Installed metadata fixture entry changed during descriptor admission",
      );
    }
    bytes = Buffer.alloc(Number(descriptorBefore.size));
    let offset = 0;
    while (offset < bytes.byteLength) {
      const count = readSync(
        descriptor,
        bytes,
        offset,
        bytes.byteLength - offset,
        offset,
      );
      if (count <= 0) {
        return failV2(
          "INSTALLED_METADATA_OPERATION_FIXTURE_HANDLE_UNAUTHENTICATED",
          "Installed metadata fixture entry reached an early EOF",
        );
      }
      offset += count;
    }
    if (readSync(descriptor, eofProbe, 0, 1, offset) !== 0) {
      return failV2(
        "INSTALLED_METADATA_OPERATION_FIXTURE_HANDLE_UNAUTHENTICATED",
        "Installed metadata fixture entry grew during descriptor capture",
      );
    }
    const descriptorAfter = fstatSync(descriptor, {
      bigint: true,
    }) as BigIntStatV2;
    const pathAfter = lstatSync(entryPath, {
      bigint: true,
    }) as BigIntStatV2;
    if (
      !sameStatV2(descriptorBefore, descriptorAfter)
      || !sameStatV2(descriptorAfter, pathAfter)
    ) {
      return failV2(
        "INSTALLED_METADATA_OPERATION_FIXTURE_HANDLE_UNAUTHENTICATED",
        "Installed metadata fixture entry changed during bounded capture",
      );
    }
    return Object.freeze({
      stableIdentity: statIdentityV2(descriptorAfter),
      contentHash: sha256BytesV2(bytes),
    });
  } catch (error) {
    if (
      error
        instanceof PlatformReleaseBootstrapInstalledMetadataOperationErrorV2
    ) {
      throw error;
    }
    return failV2(
      "INSTALLED_METADATA_OPERATION_FIXTURE_HANDLE_UNAUTHENTICATED",
      "Installed metadata fixture entry could not be captured",
      error,
    );
  } finally {
    bytes?.fill(0);
    eofProbe.fill(0);
    if (descriptor >= 0) closeSync(descriptor);
  }
}

function assertFixtureLayoutV2(state: FixtureStateV2): void {
  try {
    const root = lstatSync(state.targetRoot, {
      bigint: true,
    }) as BigIntStatV2;
    if (
      root.isSymbolicLink()
      || !root.isDirectory()
      || realpathSync(state.targetRoot) !== state.targetRoot
      || modeTextV2(root) !== "0700"
      || !sameStableIdentityV2(
        {
          objectKind: "directory",
          ...statIdentityV2(root),
        },
        state.targetStableIdentity,
      )
      || typeof process.getuid === "function"
        && Number(root.uid) !== process.getuid()
      || typeof process.getgid === "function"
        && Number(root.gid) !== process.getgid()
    ) {
      return failV2(
        "INSTALLED_METADATA_OPERATION_FIXTURE_HANDLE_UNAUTHENTICATED",
        "Installed metadata target is not the original private 0700 directory",
      );
    }
    const names = readdirSync(state.targetRoot).sort();
    if (
      canonicalJsonStringify(names)
        !== canonicalJsonStringify([ENTRY_BASENAME_V2])
    ) {
      return failV2(
        "INSTALLED_METADATA_OPERATION_FIXTURE_HANDLE_UNAUTHENTICATED",
        "Installed metadata target has unexpected direct entries",
      );
    }
    const entry = captureEntryV2(
      path.join(state.targetRoot, ENTRY_BASENAME_V2),
    );
    if (
      !sameStableIdentityV2(
        entry.stableIdentity,
        state.entryStableIdentity,
      )
      || entry.contentHash !== state.entryContentHash
    ) {
      return failV2(
        "INSTALLED_METADATA_OPERATION_FIXTURE_HANDLE_UNAUTHENTICATED",
        "Installed metadata fixture entry detached from its original identity",
      );
    }
  } catch (error) {
    if (
      error
        instanceof PlatformReleaseBootstrapInstalledMetadataOperationErrorV2
    ) {
      throw error;
    }
    return failV2(
      "INSTALLED_METADATA_OPERATION_FIXTURE_HANDLE_UNAUTHENTICATED",
      "Installed metadata fixture layout could not be revalidated",
      error,
    );
  }
}

function authenticFixtureStateV2(
  fixture: PlatformReleaseBootstrapInstalledMetadataOperationFixtureV2,
): FixtureStateV2 {
  const state = authenticStateWithoutLayoutV2(fixture);
  assertFixtureLayoutV2(state);
  return state;
}

function captureTargetV2(
  targetRoot: string,
  hostIdentityHash: string,
): TargetCaptureV2 {
  let descriptor = -1;
  try {
    const pathBefore = lstatSync(targetRoot, {
      bigint: true,
    }) as BigIntStatV2;
    descriptor = openSync(
      targetRoot,
      fsConstants.O_RDONLY
        | (fsConstants.O_DIRECTORY ?? 0)
        | (fsConstants.O_NOFOLLOW ?? 0)
        | ((fsConstants as unknown as Record<string, number>)
          .O_CLOEXEC ?? 0),
    );
    const descriptorBefore = fstatSync(descriptor, {
      bigint: true,
    }) as BigIntStatV2;
    if (
      pathBefore.isSymbolicLink()
      || !pathBefore.isDirectory()
      || realpathSync(targetRoot) !== targetRoot
      || !sameStatV2(pathBefore, descriptorBefore)
      || descriptorBefore.nlink < 1n
      || descriptorBefore.size < 0n
      || descriptorBefore.size
        > BigInt(
          PLATFORM_RELEASE_COMPOSITION_METADATA_TEST_MAX_TARGET_BYTES_V2,
        )
    ) {
      return failV2(
        "INSTALLED_METADATA_OPERATION_FILESYSTEM_DRIFT",
        "Installed metadata target failed directory descriptor admission",
      );
    }
    const directEntryNames = readdirSync(targetRoot).sort();
    if (
      directEntryNames.length
        > PLATFORM_RELEASE_COMPOSITION_METADATA_TEST_MAX_DIRECT_ENTRY_COUNT_V2
      || directEntryNames.some(
        (name) => name.length < 1 || name.length > 255,
      )
    ) {
      return failV2(
        "INSTALLED_METADATA_OPERATION_FILESYSTEM_DRIFT",
        "Installed metadata target exceeds its bounded direct-entry set",
      );
    }
    const descriptorAfter = fstatSync(descriptor, {
      bigint: true,
    }) as BigIntStatV2;
    const pathAfter = lstatSync(targetRoot, {
      bigint: true,
    }) as BigIntStatV2;
    if (
      !sameStatV2(descriptorBefore, descriptorAfter)
      || !sameStatV2(descriptorAfter, pathAfter)
    ) {
      return failV2(
        "INSTALLED_METADATA_OPERATION_FILESYSTEM_DRIFT",
        "Installed metadata target changed during bounded capture",
      );
    }
    const stableIdentity: StableIdentityV2 = Object.freeze({
      hostIdentityHash,
      objectKind: "directory",
      device: descriptorAfter.dev.toString(10),
      inode: descriptorAfter.ino.toString(10),
    });
    const directEntryNamesHash =
      hashMetadataProbeDirectoryEntriesV2(directEntryNames);
    const mutableFingerprint: MutableFingerprintV2 = Object.freeze({
      ownerUid: ownerIdV2(descriptorAfter.uid),
      ownerGid: ownerIdV2(descriptorAfter.gid),
      mode: modeTextV2(descriptorAfter),
      linkCount: Number(descriptorAfter.nlink),
      byteLength: Number(descriptorAfter.size),
      directEntryNamesHash,
      modifiedTimeNanoseconds:
        descriptorAfter.mtimeNs.toString(10),
      changedTimeNanoseconds:
        descriptorAfter.ctimeNs.toString(10),
    });
    if (
      !Number.isSafeInteger(mutableFingerprint.linkCount)
      || mutableFingerprint.linkCount < 1
      || !Number.isSafeInteger(mutableFingerprint.byteLength)
    ) {
      return failV2(
        "INSTALLED_METADATA_OPERATION_FILESYSTEM_DRIFT",
        "Installed metadata target mutable fingerprint is outside its schema",
      );
    }
    const observationIdentity = {
      stableIdentity,
      mutableFingerprint,
    };
    return Object.freeze({
      observation: Object.freeze({
        ...observationIdentity,
        observationHash:
          hashPlatformReleaseCompositionMetadataTargetObservationForTestV2(
            observationIdentity,
          ),
      }),
      directEntryNames: Object.freeze([...directEntryNames]),
    });
  } catch (error) {
    if (
      error
        instanceof PlatformReleaseBootstrapInstalledMetadataOperationErrorV2
    ) {
      throw error;
    }
    return failV2(
      "INSTALLED_METADATA_OPERATION_FILESYSTEM_DRIFT",
      "Installed metadata target could not be captured",
      error,
    );
  } finally {
    if (descriptor >= 0) closeSync(descriptor);
  }
}

function acquireLaunchContextV2(
  hostToolchain: PlatformReleaseHostNodeToolchainAuthorityV2,
): Promise<
  PlatformReleaseHostNodeToolchainMetadataOperationLaunchContextInternalV2
> {
  return acquirePlatformReleaseHostNodeToolchainMetadataOperationLaunchContextInternalV2(
    hostToolchain,
  ).catch((error: unknown) =>
    failV2(
      "INSTALLED_METADATA_OPERATION_LAUNCH_AUTHORITY_DRIFT",
      "Installed metadata launch authority failed fresh acquisition",
      error,
    ));
}

function assertExactLaunchContextV2(
  context:
    PlatformReleaseHostNodeToolchainMetadataOperationLaunchContextInternalV2,
): void {
  const metadataDirectory = path.dirname(context.implementationPath);
  if (
    context.admissionScope !== "test_fixture"
    || context.operationAbiRef
      !== PLATFORM_RELEASE_COMPOSITION_METADATA_TEST_OPERATION_ABI_REF_V2
    || context.operationAbiHash
      !== PLATFORM_RELEASE_COMPOSITION_METADATA_TEST_OPERATION_ABI_HASH_V2
    || context.moduleExport !== "runPlatformReleaseMetadataProbeV2"
    || canonicalJsonStringify(context.directArgv)
      !== canonicalJsonStringify([
        "run-metadata-probe-v2",
        "PLATFORM_RELEASE_METADATA_PROBE_V2",
      ])
    || context.workingDirectoryPolicy
      !== "authenticated_target_root_v2"
    || context.environmentPolicy
      !== PLATFORM_RELEASE_COMPOSITION_METADATA_TEST_ENVIRONMENT_POLICY_V2
    || path.resolve(
      metadataDirectory,
      "..",
      "tools",
      "xattr-observe",
    ) !== context.xattrObserverExecutablePath
    || path.resolve(
      metadataDirectory,
      "..",
      "tools",
      "acl-observe",
    ) !== context.aclObserverExecutablePath
  ) {
    return failV2(
      "INSTALLED_METADATA_OPERATION_LAUNCH_AUTHORITY_DRIFT",
      "Installed metadata launch context is not the exact code-owned test ABI",
    );
  }
}

/** @internal Runs one installed target operation in its own killable group. */
export function runInstalledTargetOperationProcessInternalV2(
  input: Readonly<{
    context: Readonly<{
      nodeExecutablePath: string;
      releaseBootstrapExecutablePath: string;
      directArgv: readonly string[];
      timeoutMs: number;
      maxStdoutBytes: number;
      maxStderrBytes: number;
    }>;
    targetRoot: string;
    wireInputCanonical: string;
  }>,
): Promise<InstalledTargetOperationProcessResultInternalV2> {
  return new Promise((resolve) => {
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let status: InstalledTargetOperationProcessResultInternalV2["status"] = "exited";
    let settled = false;
    let timer: NodeJS.Timeout | undefined;
    let child: ChildProcess | undefined;
    const startedAt = Date.now();
    const kill = (): void => {
      try {
        if (child?.pid !== undefined && child.pid > 0) {
          process.kill(-child.pid, "SIGKILL");
        } else {
          child?.kill("SIGKILL");
        }
      } catch {
        try {
          child?.kill("SIGKILL");
        } catch {
          // The close event remains the sole settlement owner.
        }
      }
    };
    const terminateFor = (
      nextStatus: Exclude<
        InstalledTargetOperationProcessResultInternalV2["status"],
        "exited"
      >,
    ): void => {
      if (status !== "exited" || settled) return;
      status = nextStatus;
      kill();
    };
    const settle = (
      exitCode: number | null,
      signal: NodeJS.Signals | null,
    ): void => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) clearTimeout(timer);
      const stdout = Buffer.concat(stdoutChunks);
      const stderr = Buffer.concat(stderrChunks);
      for (const chunk of stdoutChunks) chunk.fill(0);
      for (const chunk of stderrChunks) chunk.fill(0);
      stdoutChunks.length = 0;
      stderrChunks.length = 0;
      resolve(Object.freeze({
        status,
        exitCode,
        signal,
        pid: child?.pid ?? -1,
        stdout,
        stderr,
        startedAt,
        finishedAt: Date.now(),
      }));
    };
    try {
      child = spawn(
        input.context.nodeExecutablePath,
        [
          input.context.releaseBootstrapExecutablePath,
          ...input.context.directArgv,
        ],
        {
          cwd: input.targetRoot,
          env: {},
          shell: false,
          detached: true,
          stdio: ["ignore", "pipe", "pipe", "pipe"],
        },
      );
    } catch {
      resolve(Object.freeze({
        status: "spawn_failed",
        exitCode: null,
        signal: null,
        pid: -1,
        stdout: Buffer.alloc(0),
        stderr: Buffer.alloc(0),
        startedAt,
        finishedAt: Date.now(),
      }));
      return;
    }
    timer = setTimeout(() => {
      terminateFor("timed_out");
    }, input.context.timeoutMs);
    child.stdout?.on("data", (chunk: Buffer) => {
      if (status !== "exited" || settled) return;
      stdoutBytes += chunk.byteLength;
      if (stdoutBytes > input.context.maxStdoutBytes) {
        terminateFor("output_limit_exceeded");
        return;
      }
      stdoutChunks.push(Buffer.from(chunk));
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      if (status !== "exited" || settled) return;
      stderrBytes += chunk.byteLength;
      if (stderrBytes > input.context.maxStderrBytes) {
        terminateFor("output_limit_exceeded");
        return;
      }
      stderrChunks.push(Buffer.from(chunk));
    });
    child.once("error", () => {
      terminateFor("spawn_failed");
    });
    child.once("close", (exitCode, signal) => {
      settle(exitCode, signal);
    });
    if (!child.stdout || !child.stderr) {
      terminateFor("spawn_failed");
      return;
    }
    const fd3 = child.stdio[3];
    if (
      !fd3
      || typeof fd3 === "string"
      || typeof (fd3 as { end?: unknown }).end !== "function"
      || typeof (fd3 as { once?: unknown }).once !== "function"
    ) {
      terminateFor("spawn_failed");
      return;
    }
    const inputDescriptor = fd3 as Readonly<{
      once(
        event: "error",
        listener: () => void,
      ): void;
      end(value: string): void;
    }>;
    inputDescriptor.once("error", () => {
      terminateFor("spawn_failed");
    });
    try {
      inputDescriptor.end(input.wireInputCanonical);
    } catch {
      terminateFor("spawn_failed");
    }
  });
}

const AUTHENTIC_FAILURE_DIAGNOSTICS_V2 = Object.freeze(
  new Map<string, readonly string[]>([
    [
      "INPUT_INVALID\0METADATA_PROBE_INPUT_V2\0terminal",
      [
        "METADATA_PROBE_INPUT_BOUND_INVALID",
        "METADATA_PROBE_INPUT_INVALID",
      ],
    ],
    [
      "POLICY_MISMATCH\0METADATA_PROBE_POLICY_V2\0terminal",
      [
        "METADATA_PROBE_POLICY_MISMATCH",
        "METADATA_PROBE_METADATA_NOT_CLEAR",
      ],
    ],
    [
      "AUTHORITY_DRIFT\0METADATA_PROBE_FILESYSTEM_FENCE_V2\0retry_after_authority_delta",
      [
        "METADATA_PROBE_FILESYSTEM_DRIFT",
        "METADATA_PROBE_TARGET_IDENTITY_MISMATCH",
      ],
    ],
    [
      "TIMEOUT\0METADATA_PROBE_EXECUTION_V2\0terminal",
      ["METADATA_PROBE_TIMEOUT"],
    ],
    [
      "OUTPUT_INVALID\0METADATA_PROBE_OBSERVATION_V2\0terminal",
      [
        "METADATA_PROBE_OUTPUT_LIMIT",
        "METADATA_PROBE_OUTPUT_INVALID",
      ],
    ],
    [
      "EXECUTION_FAILED\0METADATA_PROBE_EXECUTION_V2\0terminal",
      [
        "METADATA_PROBE_SPAWN_FAILED",
        "METADATA_PROBE_PROCESS_FAILED",
      ],
    ],
    [
      "INTERNAL_FAILURE\0METADATA_PROBE_EXECUTION_V2\0terminal",
      ["METADATA_PROBE_INTERNAL_FAILURE"],
    ],
  ]),
);

function parseAuthenticatedFailureV2(
  stdout: Buffer,
  expected: Readonly<{
    occurrenceId: string;
    hostCompositionReceiptHash: string;
  }>,
):
  | "INPUT_INVALID"
  | "POLICY_MISMATCH"
  | "AUTHORITY_DRIFT"
  | "TIMEOUT"
  | "OUTPUT_INVALID"
  | "EXECUTION_FAILED"
  | "INTERNAL_FAILURE" {
  const text = stdout.toString("utf8");
  const parsed = JSON.parse(text);
  const failure = parsePlatformReleaseBootstrapWireMessageV2(
    PLATFORM_RELEASE_BOOTSTRAP_OPERATION_FAILURE_V2_SCHEMA,
    parsed,
  );
  const diagnosticRefs = AUTHENTIC_FAILURE_DIAGNOSTICS_V2.get([
    failure.errorCode,
    failure.phaseRef,
    failure.retryDisposition,
  ].join("\0"));
  if (
    text !== `${canonicalJsonStringify(failure)}\n`
    || failure.occurrenceId !== expected.occurrenceId
    || failure.operationAbiRef
      !== PLATFORM_RELEASE_COMPOSITION_METADATA_TEST_OPERATION_ABI_REF_V2
    || failure.authorityStateHash
      !== expected.hostCompositionReceiptHash
    || diagnosticRefs === undefined
    || !diagnosticRefs.some((diagnosticRef) =>
      failure.diagnosticHash
        === hashCanonicalJson({
          schema:
            "setfarm.platform-release-metadata-probe-diagnostic-hash.v2",
          diagnosticRef,
        }))
  ) {
    throw new TypeError(
      "Installed metadata failure receipt is detached from its request or policy",
    );
  }
  return failure.errorCode as
    | "INPUT_INVALID"
    | "POLICY_MISMATCH"
    | "AUTHORITY_DRIFT"
    | "TIMEOUT"
    | "OUTPUT_INVALID"
    | "EXECUTION_FAILED"
    | "INTERNAL_FAILURE";
}

function parseSuccessReceiptV2(
  stdout: Buffer,
  expected: Readonly<{
    occurrenceId: string;
    hostIdentityHash: string;
    targetRootPhysicalIdentityHash: string;
    observedEntryCount: number;
    targetEntryNamesHash: string;
    hostCompositionReceiptHash: string;
  }>,
): PlatformReleaseCompositionMetadataWireReceiptForTestV2 {
  let receipt: Readonly<Record<string, unknown>>;
  const text = stdout.toString("utf8");
  try {
    receipt = parsePlatformReleaseBootstrapWireMessageV2(
      OUTPUT_SCHEMA_V2,
      JSON.parse(text),
    );
  } catch (error) {
    return failV2(
      "INSTALLED_METADATA_OPERATION_OUTPUT_INVALID",
      "Installed metadata operation did not emit one valid wire receipt",
      error,
    );
  }
  if (
    text !== `${canonicalJsonStringify(receipt)}\n`
    || receipt.occurrenceId !== expected.occurrenceId
    || receipt.hostIdentityHash !== expected.hostIdentityHash
    || receipt.targetRootPhysicalIdentityHash
      !== expected.targetRootPhysicalIdentityHash
    || receipt.metadataPolicyHash
      !== PLATFORM_RELEASE_BOOTSTRAP_METADATA_OPERATION_POLICY_HASH_V2
    || receipt.observationOutcome !== "metadata_policy_satisfied"
    || receipt.observedEntryCount !== expected.observedEntryCount
    || receipt.targetEntryNamesHash
      !== expected.targetEntryNamesHash
    || receipt.hostCompositionReceiptHash
      !== expected.hostCompositionReceiptHash
  ) {
    return failV2(
      "INSTALLED_METADATA_OPERATION_RECEIPT_INVALID",
      "Installed metadata wire receipt detached from its exact request",
    );
  }
  return receipt as unknown as
    PlatformReleaseCompositionMetadataWireReceiptForTestV2;
}

function processObservationV2(
  context:
    PlatformReleaseHostNodeToolchainMetadataOperationLaunchContextInternalV2,
  result: InstalledTargetOperationProcessResultInternalV2,
): PlatformReleaseCompositionMetadataProcessObservationForTestV2 {
  const fixedArgvInput = {
    nodeIdentityHash: context.nodeIdentityHash,
    nodeExecutableContentHash:
      context.nodeExecutableContentHash,
    releaseBootstrapExecutableContentHash:
      context.releaseBootstrapExecutableContentHash,
    releaseBootstrapExecutablePhysicalIdentityHash:
      context.releaseBootstrapExecutablePhysicalIdentityHash,
    metadataModuleContentHash:
      context.implementationContentHash,
    metadataModulePhysicalIdentityHash:
      context.implementationPhysicalIdentityHash,
    xattrObserverExecutableContentHash:
      context.xattrObserverExecutableContentHash,
    xattrObserverExecutablePhysicalIdentityHash:
      context.xattrObserverExecutablePhysicalIdentityHash,
    aclObserverExecutableContentHash:
      context.aclObserverExecutableContentHash,
    aclObserverExecutablePhysicalIdentityHash:
      context.aclObserverExecutablePhysicalIdentityHash,
  };
  const identity = {
    ...fixedArgvInput,
    fixedArgvHash:
      hashPlatformReleaseCompositionMetadataFixedArgvForTestV2(
        fixedArgvInput,
      ),
    environmentPolicy:
      PLATFORM_RELEASE_COMPOSITION_METADATA_TEST_ENVIRONMENT_POLICY_V2,
    shell: false as const,
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
  return Object.freeze({
    ...identity,
    processObservationHash:
      hashPlatformReleaseCompositionMetadataProcessObservationForTestV2(
        identity,
      ),
  });
}

export function buildPlatformReleaseBootstrapInstalledMetadataOperationFixtureForTestV2():
PlatformReleaseBootstrapInstalledMetadataOperationFixtureV2 {
  if (process.platform !== "darwin") {
    return failV2(
      "INSTALLED_METADATA_OPERATION_PLATFORM_UNAVAILABLE",
      "Installed metadata operation fixture requires Darwin",
    );
  }
  const alias = mkdtempSync(path.join(os.tmpdir(), ROOT_PREFIX_V2));
  let fixture:
    PlatformReleaseBootstrapInstalledMetadataOperationFixtureV2;
  try {
    const targetRoot = realpathSync(alias);
    chmodSync(targetRoot, 0o700);
    const entryPath = path.join(targetRoot, ENTRY_BASENAME_V2);
    writeFileSync(entryPath, ENTRY_BYTES_V2, { mode: 0o444 });
    chmodSync(entryPath, 0o444);
    const target = lstatSync(targetRoot, {
      bigint: true,
    }) as BigIntStatV2;
    const entry = captureEntryV2(entryPath);
    const ownerMatches =
      (typeof process.getuid !== "function"
        || Number(target.uid) === process.getuid())
      && (typeof process.getgid !== "function"
        || Number(target.gid) === process.getgid());
    if (
      target.isSymbolicLink()
      || !target.isDirectory()
      || modeTextV2(target) !== "0700"
      || !ownerMatches
      || entry.contentHash !== sha256BytesV2(ENTRY_BYTES_V2)
    ) {
      return failV2(
        "INSTALLED_METADATA_OPERATION_FIXTURE_BUILD_FAILED",
        "Installed metadata target must be one exact private fixture",
      );
    }
    const state: FixtureStateV2 = Object.freeze({
      alias,
      targetRoot,
      targetStableIdentity: Object.freeze({
        objectKind: "directory" as const,
        ...statIdentityV2(target),
      }),
      entryStableIdentity: entry.stableIdentity,
      entryContentHash: entry.contentHash,
    });
    fixture = Object.freeze({
      dispose(): void {
        disposePlatformReleaseBootstrapInstalledMetadataOperationFixtureForTestV2(
          fixture,
        );
      },
    });
    fixtureStatesV2.set(fixture, state);
    return fixture;
  } catch (error) {
    rmSync(alias, { recursive: true, force: true });
    if (
      error
        instanceof PlatformReleaseBootstrapInstalledMetadataOperationErrorV2
    ) {
      throw error;
    }
    return failV2(
      "INSTALLED_METADATA_OPERATION_FIXTURE_BUILD_FAILED",
      "Could not create the installed metadata operation fixture",
      error,
    );
  }
}

export function disposePlatformReleaseBootstrapInstalledMetadataOperationFixtureForTestV2(
  fixture: PlatformReleaseBootstrapInstalledMetadataOperationFixtureV2,
): void {
  const state = authenticStateWithoutLayoutV2(fixture);
  fixtureStatesV2.delete(fixture);
  rmSync(state.alias, { recursive: true, force: true });
}

export function mutatePlatformReleaseBootstrapInstalledMetadataOperationFixtureForTestV2(
  fixture: PlatformReleaseBootstrapInstalledMetadataOperationFixtureV2,
  mutation:
    PlatformReleaseBootstrapInstalledMetadataOperationFixtureMutationV2,
): void {
  const state = authenticFixtureStateV2(fixture);
  const entryPath = path.join(
    state.targetRoot,
    ENTRY_BASENAME_V2,
  );
  if (mutation === "add_target_entry") {
    const extraPath = path.join(state.targetRoot, "extra.txt");
    writeFileSync(extraPath, "drift\n", { mode: 0o444 });
    chmodSync(extraPath, 0o444);
    return;
  }
  if (mutation === "add_target_xattr") {
    const result = spawnSync(
      "/usr/bin/xattr",
      [
        "-w",
        "com.setfarm.installed_metadata_operation_v2",
        "fixture",
        state.targetRoot,
      ],
      {
        env: {},
        shell: false,
        stdio: "ignore",
        timeout: 8_000,
      },
    );
    if (result.error !== undefined || result.status !== 0) {
      return failV2(
        "INSTALLED_METADATA_OPERATION_FILESYSTEM_DRIFT",
        "Could not apply the test-only metadata mutation",
        result.error
          ?? new Error(`xattr exited with ${String(result.status)}`),
      );
    }
    return;
  }
  unlinkSync(entryPath);
  writeFileSync(entryPath, ENTRY_BYTES_V2, { mode: 0o444 });
  chmodSync(entryPath, 0o444);
}

/** @internal Exact target locators must come from a code-owned authority. */
export async function observePlatformReleaseBootstrapInstalledMetadataOperationAtPrivateTargetInternalV2(
  hostToolchain: PlatformReleaseHostNodeToolchainAuthorityV2,
  targetRoot: string,
): Promise<
  PlatformReleaseBootstrapInstalledMetadataOperationOccurrenceInternalV2
> {
  if (process.platform !== "darwin") {
    return failV2(
      "INSTALLED_METADATA_OPERATION_PLATFORM_UNAVAILABLE",
      "Installed metadata operation observation requires Darwin",
    );
  }
  const launchBefore = await acquireLaunchContextV2(hostToolchain);
  assertExactLaunchContextV2(launchBefore);
  const targetBefore = captureTargetV2(
    targetRoot,
    launchBefore.hostIdentityHash,
  );
  const targetRootPhysicalIdentityHash =
    hashMetadataProbeTargetStableIdentityV2(
      targetBefore.observation.stableIdentity,
    );
  const occurrenceId = randomUUID().toUpperCase();
  const wireInputIdentity = {
    schema: INPUT_SCHEMA_V2,
    version: "2.0.0" as const,
    occurrenceId,
    hostIdentityHash: launchBefore.hostIdentityHash,
    targetRootPhysicalIdentityHash,
    metadataPolicyHash:
      PLATFORM_RELEASE_BOOTSTRAP_METADATA_OPERATION_POLICY_HASH_V2,
    hostCompositionReceiptHash:
      launchBefore.hostCompositionReceiptHash,
  };
  const wireInput = parsePlatformReleaseBootstrapWireMessageV2(
    INPUT_SCHEMA_V2,
    {
      ...wireInputIdentity,
      messageHash: hashPlatformReleaseBootstrapWireMessageV2(
        INPUT_SCHEMA_V2,
        wireInputIdentity,
      ),
    },
  );
  const result = await runInstalledTargetOperationProcessInternalV2({
    context: launchBefore,
    targetRoot,
    wireInputCanonical: canonicalJsonStringify(wireInput),
  });
  let launchAfter:
    PlatformReleaseHostNodeToolchainMetadataOperationLaunchContextInternalV2;
  let targetAfter: TargetCaptureV2;
  try {
    targetAfter = captureTargetV2(
      targetRoot,
      launchBefore.hostIdentityHash,
    );
    launchAfter = await acquireLaunchContextV2(hostToolchain);
    assertExactLaunchContextV2(launchAfter);
  } catch (error) {
    result.stdout.fill(0);
    result.stderr.fill(0);
    throw error;
  }
  if (
    canonicalJsonStringify(launchAfter)
      !== canonicalJsonStringify(launchBefore)
    || canonicalJsonStringify(targetAfter.observation)
      !== canonicalJsonStringify(targetBefore.observation)
  ) {
    result.stdout.fill(0);
    result.stderr.fill(0);
    return failV2(
      canonicalJsonStringify(launchAfter)
        !== canonicalJsonStringify(launchBefore)
        ? "INSTALLED_METADATA_OPERATION_LAUNCH_AUTHORITY_DRIFT"
        : "INSTALLED_METADATA_OPERATION_FILESYSTEM_DRIFT",
      "Installed metadata launch or target authority changed across process settlement",
    );
  }
  const processObservation = processObservationV2(
    launchBefore,
    result,
  );
  if (
    result.status !== "exited"
    || result.exitCode !== 0
    || result.signal !== null
    || result.stderr.byteLength !== 0
  ) {
    let authenticatedFailure:
      ReturnType<typeof parseAuthenticatedFailureV2>
      | undefined;
    if (
      result.status === "exited"
      && result.exitCode === 1
      && result.signal === null
      && result.stderr.byteLength === 0
      && result.stdout.byteLength > 0
    ) {
      try {
        authenticatedFailure = parseAuthenticatedFailureV2(
          result.stdout,
          {
          occurrenceId,
          hostCompositionReceiptHash:
            launchBefore.hostCompositionReceiptHash,
          },
        );
      } catch {
        // Any non-exact failure output remains opaque and untrusted.
      }
    }
    result.stdout.fill(0);
    result.stderr.fill(0);
    return failV2(
      authenticatedFailure === "POLICY_MISMATCH"
        ? "INSTALLED_METADATA_OPERATION_OPERATION_REJECTED"
        : authenticatedFailure === "AUTHORITY_DRIFT"
          ? "INSTALLED_METADATA_OPERATION_FILESYSTEM_DRIFT"
          : authenticatedFailure === "TIMEOUT"
            ? "INSTALLED_METADATA_OPERATION_TIMEOUT"
            : authenticatedFailure === "OUTPUT_INVALID"
              || authenticatedFailure === "INPUT_INVALID"
              ? "INSTALLED_METADATA_OPERATION_OUTPUT_INVALID"
              : authenticatedFailure === "EXECUTION_FAILED"
                || authenticatedFailure === "INTERNAL_FAILURE"
                ? "INSTALLED_METADATA_OPERATION_PROCESS_FAILED"
        : result.status === "timed_out"
          ? "INSTALLED_METADATA_OPERATION_TIMEOUT"
          : result.status === "output_limit_exceeded"
            ? "INSTALLED_METADATA_OPERATION_OUTPUT_LIMIT"
            : result.status === "spawn_failed"
              ? "INSTALLED_METADATA_OPERATION_SPAWN_FAILED"
              : "INSTALLED_METADATA_OPERATION_PROCESS_FAILED",
      authenticatedFailure !== undefined
        ? "Installed metadata operation returned one authenticated classified failure"
        : "Installed metadata operation process failed without trusted diagnostics",
    );
  }
  let receipt:
    PlatformReleaseCompositionMetadataWireReceiptForTestV2;
  try {
    receipt = parseSuccessReceiptV2(result.stdout, {
      occurrenceId,
      hostIdentityHash: launchBefore.hostIdentityHash,
      targetRootPhysicalIdentityHash,
      observedEntryCount:
        targetBefore.directEntryNames.length,
      targetEntryNamesHash:
        targetBefore.observation.mutableFingerprint
          .directEntryNamesHash,
      hostCompositionReceiptHash:
        launchBefore.hostCompositionReceiptHash,
    });
  } finally {
    result.stdout.fill(0);
    result.stderr.fill(0);
  }
  return Object.freeze({
    hostIdentityHash: launchBefore.hostIdentityHash,
    platformHostToolchainReceiptHash:
      launchBefore.platformHostToolchainReceiptHash,
    hostCompositionReceiptHash:
      launchBefore.hostCompositionReceiptHash,
    targetRootPhysicalIdentityHash,
    metadataPolicyHash:
      PLATFORM_RELEASE_BOOTSTRAP_METADATA_OPERATION_POLICY_HASH_V2,
    occurrenceId,
    targetBefore: targetBefore.observation,
    targetAfter: targetAfter.observation,
    receipt,
    process: processObservation,
  });
}

export async function observePlatformReleaseBootstrapInstalledMetadataOperationForTestV2(
  hostToolchain: PlatformReleaseHostNodeToolchainAuthorityV2,
  fixture: PlatformReleaseBootstrapInstalledMetadataOperationFixtureV2,
): Promise<PlatformReleaseCompositionMetadataTestV2> {
  const state = authenticFixtureStateV2(fixture);
  let occurrence:
    PlatformReleaseBootstrapInstalledMetadataOperationOccurrenceInternalV2
    | undefined;
  let operationFailure: unknown;
  try {
    occurrence =
      await observePlatformReleaseBootstrapInstalledMetadataOperationAtPrivateTargetInternalV2(
        hostToolchain,
        state.targetRoot,
      );
  } catch (error) {
    operationFailure = error;
  }
  try {
    assertFixtureLayoutV2(state);
  } catch (fenceFailure) {
    if (operationFailure !== undefined) {
      throw new AggregateError([
        operationFailure,
        fenceFailure,
      ]);
    }
    throw fenceFailure;
  }
  if (operationFailure !== undefined) throw operationFailure;
  if (
    occurrence === undefined
    || !sameStableIdentityV2(
      occurrence.targetBefore.stableIdentity,
      state.targetStableIdentity,
    )
    || !sameStableIdentityV2(
      occurrence.targetAfter.stableIdentity,
      state.targetStableIdentity,
    )
  ) {
    return failV2(
      "INSTALLED_METADATA_OPERATION_FILESYSTEM_DRIFT",
      "Installed metadata target detached from its fixture authority",
    );
  }
  const identity = {
    schema: PLATFORM_RELEASE_COMPOSITION_METADATA_TEST_V2_SCHEMA,
    version: "2.0.0" as const,
    admissionScope: "test_fixture" as const,
    productionAuthority: false as const,
    productionAdmission: "forbidden" as const,
    credentialUse: "none" as const,
    mutationAuthority: false as const,
    trustConclusion: "characterization_only" as const,
    targetBinding:
      PLATFORM_RELEASE_COMPOSITION_METADATA_TEST_TARGET_BINDING_V2,
    implementationScope:
      PLATFORM_RELEASE_COMPOSITION_METADATA_TEST_IMPLEMENTATION_SCOPE_V2,
    operationAbiRef:
      PLATFORM_RELEASE_COMPOSITION_METADATA_TEST_OPERATION_ABI_REF_V2,
    operationAbiHash:
      PLATFORM_RELEASE_COMPOSITION_METADATA_TEST_OPERATION_ABI_HASH_V2,
    ...occurrence,
  };
  return parsePlatformReleaseCompositionMetadataForTestV2({
    ...identity,
    evidenceHash:
      hashPlatformReleaseCompositionMetadataForTestV2(identity),
  });
}
