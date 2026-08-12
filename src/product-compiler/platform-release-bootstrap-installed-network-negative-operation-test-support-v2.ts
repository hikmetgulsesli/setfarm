import { createHash, randomUUID } from "node:crypto";
import {
  chmodSync,
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  mkdirSync,
  openSync,
  readdirSync,
  rmdirSync,
} from "node:fs";
import path from "node:path";

import {
  acquirePlatformReleaseHostNodeToolchainNetworkNegativeOperationLaunchContextInternalV2,
  type PlatformReleaseHostNodeToolchainAuthorityV2,
  type PlatformReleaseHostNodeToolchainNetworkNegativeOperationLaunchContextInternalV2,
} from "../execution/platform-release-host-node-toolchain-authority-v2.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_NETWORK_NEGATIVE_CONTROL_SET_HASH_V2,
  PLATFORM_RELEASE_BOOTSTRAP_NETWORK_NEGATIVE_DENIED_PROBE_SET_HASH_V2,
  PLATFORM_RELEASE_BOOTSTRAP_NETWORK_NEGATIVE_OPERATION_POLICY_HASH_V2,
  PLATFORM_RELEASE_BOOTSTRAP_NETWORK_NEGATIVE_PROBE_CLOSURE_HASH_V2,
} from "../execution/platform-release-bootstrap-network-negative-operation-v2.js";
import {
  NETWORK_ISOLATION_NEGATIVE_PROBE_PROGRAM_HASH_V2,
  NETWORK_SANDBOX_PROFILE_HASH_V2,
} from "../execution/network-sandbox-v2.js";
import {
  NETWORK_ISOLATION_NORMALIZED_ENVIRONMENT_HASH_V2,
} from "../execution/schemas/network-isolation-negative-probe-v2.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_OPERATION_FAILURE_V2_SCHEMA,
  hashPlatformReleaseBootstrapWireMessageV2,
  parsePlatformReleaseBootstrapWireMessageV2,
} from "../execution/schemas/platform-release-bootstrap-wire-contracts-v2.js";
import {
  PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_TEST_IMPLEMENTATION_SCOPE_V2,
  PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_TEST_OPERATION_ABI_HASH_V2,
  PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_TEST_OPERATION_ABI_REF_V2,
  PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_TEST_TARGET_BINDING_V2,
  PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_TEST_V2_SCHEMA,
  hashPlatformReleaseCompositionNetworkNegativeForTestV2,
  parsePlatformReleaseCompositionNetworkNegativeForTestV2,
  type PlatformReleaseCompositionNetworkNegativeTestV2,
} from "../execution/schemas/platform-release-composition-network-negative-test-v2.js";
import {
  canonicalJsonStringify,
  hashCanonicalJson,
} from "./canonical-json.js";
import {
  runInstalledTargetOperationProcessInternalV2,
  type InstalledTargetOperationProcessResultInternalV2,
} from "./platform-release-bootstrap-installed-metadata-operation-test-support-v2.js";

const INPUT_SCHEMA_V2 =
  "setfarm.platform-release-network-negative-probe-input.v2" as const;
const OUTPUT_SCHEMA_V2 =
  "setfarm.platform-release-network-negative-probe-receipt.v2" as const;
const SCRATCH_PREFIX_V2 =
  "setfarm-installed-network-negative-operation-v2-";
const EMPTY_SHA256_V2 =
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

export type PlatformReleaseBootstrapInstalledNetworkNegativeOperationErrorCodeV2 =
  | "INSTALLED_NETWORK_NEGATIVE_OPERATION_PLATFORM_UNAVAILABLE"
  | "INSTALLED_NETWORK_NEGATIVE_OPERATION_INPUT_INVALID"
  | "INSTALLED_NETWORK_NEGATIVE_OPERATION_FILESYSTEM_DRIFT"
  | "INSTALLED_NETWORK_NEGATIVE_OPERATION_LAUNCH_AUTHORITY_DRIFT"
  | "INSTALLED_NETWORK_NEGATIVE_OPERATION_SPAWN_FAILED"
  | "INSTALLED_NETWORK_NEGATIVE_OPERATION_TIMEOUT"
  | "INSTALLED_NETWORK_NEGATIVE_OPERATION_OUTPUT_LIMIT"
  | "INSTALLED_NETWORK_NEGATIVE_OPERATION_PROCESS_FAILED"
  | "INSTALLED_NETWORK_NEGATIVE_OPERATION_OPERATION_REJECTED"
  | "INSTALLED_NETWORK_NEGATIVE_OPERATION_OUTPUT_INVALID"
  | "INSTALLED_NETWORK_NEGATIVE_OPERATION_CLEANUP_FAILED";

export class PlatformReleaseBootstrapInstalledNetworkNegativeOperationErrorV2
  extends Error {
  constructor(
    readonly code:
      PlatformReleaseBootstrapInstalledNetworkNegativeOperationErrorCodeV2,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message.slice(0, 1_500), options);
    this.name =
      "PlatformReleaseBootstrapInstalledNetworkNegativeOperationErrorV2";
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

export type PlatformReleaseBootstrapInstalledNetworkNegativeTargetObservationInternalV2 =
  Readonly<{
    stableIdentity: Readonly<{
      hostIdentityHash: string;
      objectKind: "directory";
      device: string;
      inode: string;
    }>;
    mutableFingerprint: Readonly<{
      ownerUid: number;
      ownerGid: number;
      mode: string;
      linkCount: number;
      byteLength: number;
      directEntryNamesHash: string;
      modifiedTimeNanoseconds: string;
      changedTimeNanoseconds: string;
    }>;
    observationHash: string;
  }>;

export type PlatformReleaseBootstrapInstalledNetworkNegativeWireReceiptInternalV2 =
  Readonly<{
    schema: typeof OUTPUT_SCHEMA_V2;
    version: "2.0.0";
    occurrenceId: string;
    hostIdentityHash: string;
    targetRootPhysicalIdentityHash: string;
    sandboxPolicyHash: string;
    sandboxProfileHash: string;
    probeProgramHash: string;
    normalizedEnvironmentHash: string;
    probeClosureHash: string;
    probeOutcome: "all_denied";
    attemptedProbeCount: number;
    deniedProbeCount: number;
    deniedProbeSetHash: string;
    controlOutcome: "loopback_and_redirect_observed";
    controlSetHash: string;
    stableNetworkProjectionHash: string;
    networkObservationHash: string;
    hostCompositionReceiptHash: string;
    messageHash: string;
  }>;

export type PlatformReleaseBootstrapInstalledNetworkNegativeProcessObservationInternalV2 =
  Readonly<{
    nodeIdentityHash: string;
    nodeExecutableContentHash: string;
    releaseBootstrapExecutableContentHash: string;
    releaseBootstrapExecutablePhysicalIdentityHash: string;
    networkWrapperModuleContentHash: string;
    networkWrapperModulePhysicalIdentityHash: string;
    sandboxExecutableContentHash: string;
    sandboxExecutablePhysicalIdentityHash: string;
    fixedArgvHash: string;
    environmentPolicy: "exact_empty_environment_v2";
    shell: false;
    pid: number;
    startedAt: number;
    finishedAt: number;
    status:
      InstalledTargetOperationProcessResultInternalV2["status"];
    exitCode: number | null;
    signal: NodeJS.Signals | null;
    stdoutByteLength: number;
    stderrByteLength: number;
    stdoutHash: string;
    stderrHash: string;
    processObservationHash: string;
  }>;

export type PlatformReleaseBootstrapInstalledNetworkNegativeOperationOccurrenceInternalV2 =
  Readonly<{
    hostIdentityHash: string;
    platformHostToolchainReceiptHash: string;
    hostCompositionReceiptHash: string;
    targetRootPhysicalIdentityHash: string;
    sandboxPolicyHash:
      typeof PLATFORM_RELEASE_BOOTSTRAP_NETWORK_NEGATIVE_OPERATION_POLICY_HASH_V2;
    occurrenceId: string;
    targetBefore:
      PlatformReleaseBootstrapInstalledNetworkNegativeTargetObservationInternalV2;
    targetAfter:
      PlatformReleaseBootstrapInstalledNetworkNegativeTargetObservationInternalV2;
    receipt:
      PlatformReleaseBootstrapInstalledNetworkNegativeWireReceiptInternalV2;
    process:
      PlatformReleaseBootstrapInstalledNetworkNegativeProcessObservationInternalV2;
  }>;

function failV2(
  code:
    PlatformReleaseBootstrapInstalledNetworkNegativeOperationErrorCodeV2,
  message: string,
  cause?: unknown,
): never {
  throw new PlatformReleaseBootstrapInstalledNetworkNegativeOperationErrorV2(
    code,
    message,
    cause === undefined ? undefined : { cause },
  );
}

function ownerIdV2(value: bigint): number {
  const result = Number(value);
  if (
    !Number.isSafeInteger(result)
    || result < 0
    || result > 4_294_967_294
  ) {
    return failV2(
      "INSTALLED_NETWORK_NEGATIVE_OPERATION_FILESYSTEM_DRIFT",
      "Network target owner identity is outside the admitted range",
    );
  }
  return result;
}

function boundedFilesystemNumberV2(
  value: bigint,
  minimum: number,
): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < minimum) {
    return failV2(
      "INSTALLED_NETWORK_NEGATIVE_OPERATION_FILESYSTEM_DRIFT",
      "Network filesystem quantity is outside the admitted exact range",
    );
  }
  return result;
}

function modeTextV2(stat: BigIntStatV2): string {
  return Number(stat.mode & 0o7777n).toString(8).padStart(4, "0");
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

function captureTargetV2(
  targetRoot: string,
  hostIdentityHash: string,
): Readonly<{
  observation:
    PlatformReleaseBootstrapInstalledNetworkNegativeTargetObservationInternalV2;
  directEntryNames: readonly string[];
}> {
  let descriptor = -1;
  try {
    const before = lstatSync(targetRoot, {
      bigint: true,
    }) as BigIntStatV2;
    descriptor = openSync(
      targetRoot,
      constants.O_RDONLY
        | ((constants as unknown as Record<string, number>).O_CLOEXEC ?? 0)
        | (constants.O_NOFOLLOW ?? 0)
        | (constants.O_DIRECTORY ?? 0),
    );
    const held = fstatSync(descriptor, {
      bigint: true,
    }) as BigIntStatV2;
    const names = readdirSync(targetRoot, {
      encoding: "utf8",
    }).sort();
    const after = lstatSync(targetRoot, {
      bigint: true,
    }) as BigIntStatV2;
    if (
      !before.isDirectory()
      || before.isSymbolicLink()
      || !sameStatV2(before, held)
      || !sameStatV2(held, after)
      || held.nlink < 1n
      || names.length > 128
      || names.some((name) => name.length < 1 || name.length > 255)
    ) {
      return failV2(
        "INSTALLED_NETWORK_NEGATIVE_OPERATION_FILESYSTEM_DRIFT",
        "Network target changed across descriptor capture",
      );
    }
    const stableIdentity = {
      hostIdentityHash,
      objectKind: "directory" as const,
      device: held.dev.toString(10),
      inode: held.ino.toString(10),
    };
    const mutableFingerprint = {
      ownerUid: ownerIdV2(held.uid),
      ownerGid: ownerIdV2(held.gid),
      mode: modeTextV2(held),
      linkCount: boundedFilesystemNumberV2(held.nlink, 1),
      byteLength: boundedFilesystemNumberV2(held.size, 0),
      directEntryNamesHash: hashCanonicalJson({
        schema:
          "setfarm.platform-release-bootstrap-installed-network-negative-directory-entries.v2",
        names,
      }),
      modifiedTimeNanoseconds: held.mtimeNs.toString(10),
      changedTimeNanoseconds: held.ctimeNs.toString(10),
    };
    return Object.freeze({
      observation: Object.freeze({
        stableIdentity: Object.freeze(stableIdentity),
        mutableFingerprint: Object.freeze(mutableFingerprint),
        observationHash: hashCanonicalJson({
          schema:
            "setfarm.platform-release-composition-network-negative-target-observation-hash.v2",
          target: { stableIdentity, mutableFingerprint },
        }),
      }),
      directEntryNames: Object.freeze(names),
    });
  } catch (error) {
    if (
      error instanceof
        PlatformReleaseBootstrapInstalledNetworkNegativeOperationErrorV2
    ) throw error;
    return failV2(
      "INSTALLED_NETWORK_NEGATIVE_OPERATION_FILESYSTEM_DRIFT",
      "Network target could not be captured",
      error,
    );
  } finally {
    if (descriptor >= 0) {
      try {
        closeSync(descriptor);
      } catch {
        // The fresh post-fence remains authoritative.
      }
    }
  }
}

function targetPhysicalIdentityHashV2(
  target:
    PlatformReleaseBootstrapInstalledNetworkNegativeTargetObservationInternalV2,
): string {
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-bootstrap-installed-network-negative-target-stable-identity.v2",
    stableIdentity: target.stableIdentity,
  });
}

async function acquireLaunchContextV2(
  hostToolchain: PlatformReleaseHostNodeToolchainAuthorityV2,
): Promise<PlatformReleaseHostNodeToolchainNetworkNegativeOperationLaunchContextInternalV2> {
  try {
    return await acquirePlatformReleaseHostNodeToolchainNetworkNegativeOperationLaunchContextInternalV2(
      hostToolchain,
    );
  } catch (error) {
    return failV2(
      "INSTALLED_NETWORK_NEGATIVE_OPERATION_LAUNCH_AUTHORITY_DRIFT",
      "Installed network-negative launch authority could not be acquired",
      error,
    );
  }
}

function assertLaunchContextV2(
  context:
    PlatformReleaseHostNodeToolchainNetworkNegativeOperationLaunchContextInternalV2,
): void {
  const executableDirectory = path.dirname(
    context.releaseBootstrapExecutablePath,
  );
  if (
    context.admissionScope !== "test_fixture"
    || context.operationAbiRef
      !== "ABI_PLATFORM_RELEASE_NETWORK_NEGATIVE_PROBE_V2"
    || context.implementationMemberRef
      !== "BOOTSTRAP_RELEASE_COMPOSITION_NETWORK_WRAPPER_MODULE_V2"
    || context.moduleExport
      !== "runPlatformReleaseNetworkNegativeProbeV2"
    || canonicalJsonStringify(context.directArgv)
      !== canonicalJsonStringify([
        "run-network-negative-probe-v2",
        "PLATFORM_RELEASE_NETWORK_NEGATIVE_PROBE_V2",
      ])
    || context.environmentPolicy !== "exact_empty_environment_v2"
    || context.workingDirectoryPolicy
      !== "authenticated_target_root_v2"
    || context.sandboxPolicyHash
      !== PLATFORM_RELEASE_BOOTSTRAP_NETWORK_NEGATIVE_OPERATION_POLICY_HASH_V2
    || path.resolve(
      executableDirectory,
      "..",
      "lib",
      "network-wrapper.mjs",
    ) !== context.implementationPath
    || path.resolve(
      executableDirectory,
      "..",
      "tools",
      "sandbox-exec",
    ) !== context.sandboxExecutablePath
  ) {
    return failV2(
      "INSTALLED_NETWORK_NEGATIVE_OPERATION_LAUNCH_AUTHORITY_DRIFT",
      "Installed network-negative launch context is not the exact test ABI",
    );
  }
}

const AUTHENTIC_FAILURE_DIAGNOSTICS_V2 = Object.freeze(
  new Map<string, readonly string[]>([
    [
      "INPUT_INVALID\0NETWORK_NEGATIVE_PROBE_INPUT_V2\0terminal",
      ["NETWORK_PROBE_INPUT_BOUND_INVALID", "NETWORK_PROBE_INPUT_INVALID"],
    ],
    [
      "POLICY_MISMATCH\0NETWORK_NEGATIVE_PROBE_POLICY_V2\0terminal",
      ["NETWORK_PROBE_POLICY_MISMATCH"],
    ],
    [
      "AUTHORITY_DRIFT\0NETWORK_NEGATIVE_PROBE_FILESYSTEM_FENCE_V2\0retry_after_authority_delta",
      ["NETWORK_PROBE_FILESYSTEM_DRIFT", "NETWORK_PROBE_TARGET_IDENTITY_MISMATCH"],
    ],
    [
      "TIMEOUT\0NETWORK_NEGATIVE_PROBE_EXECUTION_V2\0terminal",
      ["NETWORK_PROBE_TIMEOUT"],
    ],
    [
      "OUTPUT_INVALID\0NETWORK_NEGATIVE_PROBE_OBSERVATION_V2\0terminal",
      ["NETWORK_PROBE_OUTPUT_LIMIT", "NETWORK_PROBE_OUTPUT_INVALID"],
    ],
    [
      "EXECUTION_FAILED\0NETWORK_NEGATIVE_PROBE_EXECUTION_V2\0terminal",
      [
        "NETWORK_PROBE_SPAWN_FAILED",
        "NETWORK_PROBE_PROCESS_FAILED",
        "NETWORK_PROBE_SERVER_FAILED",
        "NETWORK_PROBE_CHILD_CONFIG_INVALID",
        "NETWORK_PROBE_CHILD_ENVIRONMENT_NOT_EXACT",
        "NETWORK_PROBE_CHILD_ENVIRONMENT_HASH_MISMATCH",
        "NETWORK_PROBE_CHILD_LOOPBACK_RESPONSE_LIMIT",
        "NETWORK_PROBE_CHILD_LOOPBACK_TIMEOUT",
        "NETWORK_PROBE_CHILD_LOOPBACK_MISMATCH",
        "NETWORK_PROBE_CHILD_DNS_UNTYPED",
        "NETWORK_PROBE_CHILD_OUTBOUND_TIMEOUT",
        "NETWORK_PROBE_CHILD_OUTBOUND_UNTYPED",
        "NETWORK_PROBE_CHILD_REDIRECT_MISMATCH",
        "NETWORK_PROBE_CHILD_FAILED",
      ],
    ],
    [
      "INTERNAL_FAILURE\0NETWORK_NEGATIVE_PROBE_EXECUTION_V2\0terminal",
      ["NETWORK_PROBE_INTERNAL_FAILURE"],
    ],
  ]),
);

function parseAuthenticatedFailureV2(
  stdout: Buffer,
  expected: Readonly<{
    occurrenceId: string;
    hostCompositionReceiptHash: string;
  }>,
): Readonly<{ errorCode: string; diagnosticRef: string }> {
  const text = stdout.toString("utf8");
  const failure = parsePlatformReleaseBootstrapWireMessageV2(
    PLATFORM_RELEASE_BOOTSTRAP_OPERATION_FAILURE_V2_SCHEMA,
    JSON.parse(text),
  );
  const failureCode = typeof failure.errorCode === "string"
    ? failure.errorCode
    : "";
  const diagnosticRefs = AUTHENTIC_FAILURE_DIAGNOSTICS_V2.get([
    failureCode,
    failure.phaseRef,
    failure.retryDisposition,
  ].join("\0"));
  const diagnosticRef = diagnosticRefs?.find((candidate) =>
    failure.diagnosticHash === hashCanonicalJson({
      schema:
        "setfarm.platform-release-network-negative-probe-diagnostic-hash.v2",
      diagnosticRef: candidate,
    }));
  if (
    text !== `${canonicalJsonStringify(failure)}\n`
    || failureCode.length < 1
    || failure.occurrenceId !== expected.occurrenceId
    || failure.operationAbiRef
      !== "ABI_PLATFORM_RELEASE_NETWORK_NEGATIVE_PROBE_V2"
    || failure.authorityStateHash
      !== expected.hostCompositionReceiptHash
    || diagnosticRefs === undefined
    || diagnosticRef === undefined
  ) {
    throw new TypeError(
      "Installed network-negative failure detached from its request",
    );
  }
  return Object.freeze({ errorCode: failureCode, diagnosticRef });
}

function processObservationV2(
  context:
    PlatformReleaseHostNodeToolchainNetworkNegativeOperationLaunchContextInternalV2,
  result: InstalledTargetOperationProcessResultInternalV2,
): PlatformReleaseBootstrapInstalledNetworkNegativeProcessObservationInternalV2 {
  const identity = {
    nodeIdentityHash: context.nodeIdentityHash,
    nodeExecutableContentHash: context.nodeExecutableContentHash,
    releaseBootstrapExecutableContentHash:
      context.releaseBootstrapExecutableContentHash,
    releaseBootstrapExecutablePhysicalIdentityHash:
      context.releaseBootstrapExecutablePhysicalIdentityHash,
    networkWrapperModuleContentHash:
      context.implementationContentHash,
    networkWrapperModulePhysicalIdentityHash:
      context.implementationPhysicalIdentityHash,
    sandboxExecutableContentHash:
      context.sandboxExecutableContentHash,
    sandboxExecutablePhysicalIdentityHash:
      context.sandboxExecutablePhysicalIdentityHash,
    fixedArgvHash: hashCanonicalJson({
      schema:
        "setfarm.platform-release-composition-network-negative-fixed-argv-hash.v2",
      operationAbiRef: context.operationAbiRef,
      operationAbiHash: context.operationAbiHash,
      directArgv: context.directArgv,
      nodeIdentityHash: context.nodeIdentityHash,
      nodeExecutableContentHash: context.nodeExecutableContentHash,
      releaseBootstrapExecutableContentHash:
        context.releaseBootstrapExecutableContentHash,
      releaseBootstrapExecutablePhysicalIdentityHash:
        context.releaseBootstrapExecutablePhysicalIdentityHash,
      networkWrapperModuleContentHash:
        context.implementationContentHash,
      networkWrapperModulePhysicalIdentityHash:
        context.implementationPhysicalIdentityHash,
      sandboxExecutableContentHash:
        context.sandboxExecutableContentHash,
      sandboxExecutablePhysicalIdentityHash:
        context.sandboxExecutablePhysicalIdentityHash,
      sandboxPolicyHash: context.sandboxPolicyHash,
      workingDirectoryPolicy: context.workingDirectoryPolicy,
      environmentPolicy: context.environmentPolicy,
    }),
    environmentPolicy: "exact_empty_environment_v2" as const,
    shell: false as const,
    pid: result.pid,
    startedAt: result.startedAt,
    finishedAt: result.finishedAt,
    status: result.status,
    exitCode: result.exitCode,
    signal: result.signal,
    stdoutByteLength: result.stdout.byteLength,
    stderrByteLength: result.stderr.byteLength,
    stdoutHash: createHash("sha256").update(result.stdout).digest("hex"),
    stderrHash: createHash("sha256").update(result.stderr).digest("hex"),
  };
  return Object.freeze({
    ...identity,
    processObservationHash: hashCanonicalJson({
      schema:
        "setfarm.platform-release-composition-network-negative-process-observation-hash.v2",
      process: identity,
    }),
  });
}

type ScratchIdentityV2 = Readonly<{
  root: string;
  device: bigint;
  inode: bigint;
  children: readonly Readonly<{
    name: "cache" | "home" | "tmp";
    device: bigint;
    inode: bigint;
  }>[];
}>;

function assertScratchDirectoryV2(
  absolutePath: string,
  expected: Readonly<{ device: bigint; inode: bigint }>,
  requirePrivateMode = true,
): BigIntStatV2 {
  const stat = lstatSync(absolutePath, { bigint: true }) as BigIntStatV2;
  if (
    stat.isSymbolicLink()
    || !stat.isDirectory()
    || stat.dev !== expected.device
    || stat.ino !== expected.inode
    || (requirePrivateMode && modeTextV2(stat) !== "0700")
    || (typeof process.getuid === "function"
      && ownerIdV2(stat.uid) !== process.getuid())
  ) {
    return failV2(
      "INSTALLED_NETWORK_NEGATIVE_OPERATION_CLEANUP_FAILED",
      "Network-negative scratch directory detached from its exact identity",
    );
  }
  return stat;
}

function removeScratchDirectoriesV2(scratch: ScratchIdentityV2): void {
  assertScratchDirectoryV2(scratch.root, scratch, false);
  const expectedNames = scratch.children.map((child) => child.name).sort();
  if (
    canonicalJsonStringify(readdirSync(scratch.root).sort())
      !== canonicalJsonStringify(expectedNames)
  ) {
    return failV2(
      "INSTALLED_NETWORK_NEGATIVE_OPERATION_CLEANUP_FAILED",
      "Network-negative scratch root has unexpected direct entries",
    );
  }
  for (const child of [...scratch.children].reverse()) {
    const childPath = path.join(scratch.root, child.name);
    assertScratchDirectoryV2(childPath, child, false);
    if (readdirSync(childPath).length !== 0) {
      return failV2(
        "INSTALLED_NETWORK_NEGATIVE_OPERATION_CLEANUP_FAILED",
        "Network-negative scratch child is not empty; refusing cleanup",
      );
    }
    rmdirSync(childPath);
  }
  assertScratchDirectoryV2(scratch.root, scratch, false);
  if (readdirSync(scratch.root).length !== 0) {
    return failV2(
      "INSTALLED_NETWORK_NEGATIVE_OPERATION_CLEANUP_FAILED",
      "Network-negative scratch root did not become empty",
    );
  }
  rmdirSync(scratch.root);
}

function createScratchV2(occurrenceId: string): ScratchIdentityV2 {
  const root = path.join(
    "/private/tmp",
    `${SCRATCH_PREFIX_V2}${occurrenceId}`,
  );
  let rootIdentity: Readonly<{ device: bigint; inode: bigint }> | undefined;
  let rootCreated = false;
  const children: Array<{
    name: "cache" | "home" | "tmp";
    device: bigint;
    inode: bigint;
  }> = [];
  try {
    mkdirSync(root, { mode: 0o700 });
    rootCreated = true;
    {
      const stat = lstatSync(root, { bigint: true }) as BigIntStatV2;
      rootIdentity = Object.freeze({ device: stat.dev, inode: stat.ino });
    }
    chmodSync(root, 0o700);
    for (const name of ["cache", "home", "tmp"] as const) {
      const childPath = path.join(root, name);
      mkdirSync(childPath, { mode: 0o700 });
      const childStat = lstatSync(childPath, {
        bigint: true,
      }) as BigIntStatV2;
      children.push({
        name,
        device: childStat.dev,
        inode: childStat.ino,
      });
      chmodSync(childPath, 0o700);
    }
    const stat = lstatSync(root, { bigint: true }) as BigIntStatV2;
    const scratch = Object.freeze({
      root,
      device: stat.dev,
      inode: stat.ino,
      children: Object.freeze(children.map((child) => Object.freeze(child))),
    });
    assertScratchDirectoryV2(root, scratch);
    for (const child of scratch.children) {
      assertScratchDirectoryV2(path.join(root, child.name), child);
    }
    return scratch;
  } catch (error) {
    if (rootCreated && rootIdentity === undefined) {
      return failV2(
        "INSTALLED_NETWORK_NEGATIVE_OPERATION_CLEANUP_FAILED",
        "Created network-negative scratch could not be identified for safe cleanup",
        error,
      );
    }
    if (rootIdentity !== undefined) {
      try {
        removeScratchDirectoriesV2(Object.freeze({
          root,
          ...rootIdentity,
          children: Object.freeze(
            children.map((child) => Object.freeze(child)),
          ),
        }));
      } catch (cleanupFailure) {
        return failV2(
          "INSTALLED_NETWORK_NEGATIVE_OPERATION_CLEANUP_FAILED",
          "Partially-created network-negative scratch could not be safely removed",
          new AggregateError([error, cleanupFailure]),
        );
      }
    }
    return failV2(
      "INSTALLED_NETWORK_NEGATIVE_OPERATION_FILESYSTEM_DRIFT",
      "Network-negative runner could not create its exact private scratch",
      error,
    );
  }
}

function cleanupScratchV2(
  scratch: ScratchIdentityV2,
): void {
  try {
    removeScratchDirectoriesV2(scratch);
  } catch (error) {
    if (
      error instanceof
        PlatformReleaseBootstrapInstalledNetworkNegativeOperationErrorV2
    ) throw error;
    return failV2(
      "INSTALLED_NETWORK_NEGATIVE_OPERATION_CLEANUP_FAILED",
      "Network-negative exact scratch could not be removed",
      error,
    );
  }
}

function parseSuccessV2(
  stdout: Buffer,
  expected: Readonly<{
    occurrenceId: string;
    hostIdentityHash: string;
    targetRootPhysicalIdentityHash: string;
    hostCompositionReceiptHash: string;
  }>,
): PlatformReleaseBootstrapInstalledNetworkNegativeWireReceiptInternalV2 {
  const text = stdout.toString("utf8");
  let receipt:
    PlatformReleaseBootstrapInstalledNetworkNegativeWireReceiptInternalV2;
  try {
    receipt = parsePlatformReleaseBootstrapWireMessageV2(
      OUTPUT_SCHEMA_V2,
      JSON.parse(text),
    ) as PlatformReleaseBootstrapInstalledNetworkNegativeWireReceiptInternalV2;
  } catch (error) {
    return failV2(
      "INSTALLED_NETWORK_NEGATIVE_OPERATION_OUTPUT_INVALID",
      "Installed network-negative stdout is not one strict wire receipt",
      error,
    );
  }
  const expectedStableProjectionHash = hashCanonicalJson({
    schema:
      "setfarm.platform-release-composition-network-negative-stable-projection-hash.v2",
    projection: {
      sandboxPolicyHash:
        PLATFORM_RELEASE_BOOTSTRAP_NETWORK_NEGATIVE_OPERATION_POLICY_HASH_V2,
      sandboxProfileHash: NETWORK_SANDBOX_PROFILE_HASH_V2,
      probeProgramHash:
        NETWORK_ISOLATION_NEGATIVE_PROBE_PROGRAM_HASH_V2,
      normalizedEnvironmentHash:
        NETWORK_ISOLATION_NORMALIZED_ENVIRONMENT_HASH_V2,
      probeClosureHash:
        PLATFORM_RELEASE_BOOTSTRAP_NETWORK_NEGATIVE_PROBE_CLOSURE_HASH_V2,
      probeOutcome: "all_denied",
      attemptedProbeCount: 1,
      deniedProbeCount: 1,
      deniedProbeSetHash:
        PLATFORM_RELEASE_BOOTSTRAP_NETWORK_NEGATIVE_DENIED_PROBE_SET_HASH_V2,
      controlOutcome: "loopback_and_redirect_observed",
      controlSetHash:
        PLATFORM_RELEASE_BOOTSTRAP_NETWORK_NEGATIVE_CONTROL_SET_HASH_V2,
      hostCompositionReceiptHash:
        expected.hostCompositionReceiptHash,
    },
  });
  if (
    text !== `${canonicalJsonStringify(receipt)}\n`
    || receipt.occurrenceId !== expected.occurrenceId
    || receipt.hostIdentityHash !== expected.hostIdentityHash
    || receipt.targetRootPhysicalIdentityHash
      !== expected.targetRootPhysicalIdentityHash
    || receipt.sandboxPolicyHash
      !== PLATFORM_RELEASE_BOOTSTRAP_NETWORK_NEGATIVE_OPERATION_POLICY_HASH_V2
    || receipt.sandboxProfileHash !== NETWORK_SANDBOX_PROFILE_HASH_V2
    || receipt.probeProgramHash
      !== NETWORK_ISOLATION_NEGATIVE_PROBE_PROGRAM_HASH_V2
    || receipt.normalizedEnvironmentHash
      !== NETWORK_ISOLATION_NORMALIZED_ENVIRONMENT_HASH_V2
    || receipt.probeClosureHash
      !== PLATFORM_RELEASE_BOOTSTRAP_NETWORK_NEGATIVE_PROBE_CLOSURE_HASH_V2
    || receipt.probeOutcome !== "all_denied"
    || receipt.attemptedProbeCount !== 1
    || receipt.deniedProbeCount !== 1
    || receipt.deniedProbeSetHash
      !== PLATFORM_RELEASE_BOOTSTRAP_NETWORK_NEGATIVE_DENIED_PROBE_SET_HASH_V2
    || receipt.controlOutcome
      !== "loopback_and_redirect_observed"
    || receipt.controlSetHash
      !== PLATFORM_RELEASE_BOOTSTRAP_NETWORK_NEGATIVE_CONTROL_SET_HASH_V2
    || receipt.stableNetworkProjectionHash
      !== expectedStableProjectionHash
    || receipt.hostCompositionReceiptHash
      !== expected.hostCompositionReceiptHash
  ) {
    return failV2(
      "INSTALLED_NETWORK_NEGATIVE_OPERATION_OUTPUT_INVALID",
      "Installed network-negative receipt is detached from its exact request or policy",
    );
  }
  return Object.freeze(structuredClone(receipt));
}

/** @internal Exact target locators must come from a code-owned authority. */
export async function observePlatformReleaseBootstrapInstalledNetworkNegativeOperationAtPrivateTargetInternalV2(
  hostToolchain: PlatformReleaseHostNodeToolchainAuthorityV2,
  targetRoot: string,
): Promise<PlatformReleaseBootstrapInstalledNetworkNegativeOperationOccurrenceInternalV2> {
  if (process.platform !== "darwin") {
    return failV2(
      "INSTALLED_NETWORK_NEGATIVE_OPERATION_PLATFORM_UNAVAILABLE",
      "Installed network-negative operation requires Darwin",
    );
  }
  const launchBefore = await acquireLaunchContextV2(hostToolchain);
  assertLaunchContextV2(launchBefore);
  const targetBefore = captureTargetV2(
    targetRoot,
    launchBefore.hostIdentityHash,
  );
  const targetRootPhysicalIdentityHash =
    targetPhysicalIdentityHashV2(targetBefore.observation);
  const occurrenceId = randomUUID().toUpperCase();
  const scratch = createScratchV2(occurrenceId);
  let primaryFailure: unknown;
  let occurrence:
    PlatformReleaseBootstrapInstalledNetworkNegativeOperationOccurrenceInternalV2
    | undefined;
  try {
    const inputIdentity = {
      schema: INPUT_SCHEMA_V2,
      version: "2.0.0" as const,
      occurrenceId,
      hostIdentityHash: launchBefore.hostIdentityHash,
      targetRootPhysicalIdentityHash,
      sandboxPolicyHash:
        PLATFORM_RELEASE_BOOTSTRAP_NETWORK_NEGATIVE_OPERATION_POLICY_HASH_V2,
      hostCompositionReceiptHash:
        launchBefore.hostCompositionReceiptHash,
    };
    const input = parsePlatformReleaseBootstrapWireMessageV2(
      INPUT_SCHEMA_V2,
      {
        ...inputIdentity,
        messageHash: hashPlatformReleaseBootstrapWireMessageV2(
          INPUT_SCHEMA_V2,
          inputIdentity,
        ),
      },
    );
    const result = await runInstalledTargetOperationProcessInternalV2({
      context: launchBefore,
      targetRoot,
      wireInputCanonical: canonicalJsonStringify(input),
    });
    let launchAfter:
      PlatformReleaseHostNodeToolchainNetworkNegativeOperationLaunchContextInternalV2;
    let targetAfter: ReturnType<typeof captureTargetV2>;
    try {
      targetAfter = captureTargetV2(
        targetRoot,
        launchBefore.hostIdentityHash,
      );
      launchAfter = await acquireLaunchContextV2(hostToolchain);
      assertLaunchContextV2(launchAfter);
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
          ? "INSTALLED_NETWORK_NEGATIVE_OPERATION_LAUNCH_AUTHORITY_DRIFT"
          : "INSTALLED_NETWORK_NEGATIVE_OPERATION_FILESYSTEM_DRIFT",
        "Installed network-negative launch or target changed across settlement",
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
        Readonly<{ errorCode: string; diagnosticRef: string }>
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
          // Non-exact failure output stays opaque.
        }
      }
      result.stdout.fill(0);
      result.stderr.fill(0);
      return failV2(
        authenticatedFailure?.errorCode === "POLICY_MISMATCH"
          ? "INSTALLED_NETWORK_NEGATIVE_OPERATION_OPERATION_REJECTED"
          : authenticatedFailure?.errorCode === "AUTHORITY_DRIFT"
            ? "INSTALLED_NETWORK_NEGATIVE_OPERATION_FILESYSTEM_DRIFT"
            : authenticatedFailure?.errorCode === "TIMEOUT"
              ? "INSTALLED_NETWORK_NEGATIVE_OPERATION_TIMEOUT"
              : authenticatedFailure?.errorCode === "OUTPUT_INVALID"
                || authenticatedFailure?.errorCode === "INPUT_INVALID"
                ? "INSTALLED_NETWORK_NEGATIVE_OPERATION_OUTPUT_INVALID"
                : authenticatedFailure?.errorCode === "EXECUTION_FAILED"
                  || authenticatedFailure?.errorCode === "INTERNAL_FAILURE"
                  ? "INSTALLED_NETWORK_NEGATIVE_OPERATION_PROCESS_FAILED"
                  : result.status === "timed_out"
                    ? "INSTALLED_NETWORK_NEGATIVE_OPERATION_TIMEOUT"
                    : result.status === "output_limit_exceeded"
                      ? "INSTALLED_NETWORK_NEGATIVE_OPERATION_OUTPUT_LIMIT"
                      : result.status === "spawn_failed"
                        ? "INSTALLED_NETWORK_NEGATIVE_OPERATION_SPAWN_FAILED"
                        : "INSTALLED_NETWORK_NEGATIVE_OPERATION_PROCESS_FAILED",
        authenticatedFailure === undefined
          ? "Installed network-negative process failed without trusted diagnostics"
          : `Installed network-negative operation returned authenticated ${authenticatedFailure.errorCode}:${authenticatedFailure.diagnosticRef}`,
      );
    }
    let receipt:
      PlatformReleaseBootstrapInstalledNetworkNegativeWireReceiptInternalV2;
    try {
      receipt = parseSuccessV2(result.stdout, {
        occurrenceId,
        hostIdentityHash: launchBefore.hostIdentityHash,
        targetRootPhysicalIdentityHash,
        hostCompositionReceiptHash:
          launchBefore.hostCompositionReceiptHash,
      });
    } finally {
      result.stdout.fill(0);
      result.stderr.fill(0);
    }
    occurrence = Object.freeze({
      hostIdentityHash: launchBefore.hostIdentityHash,
      platformHostToolchainReceiptHash:
        launchBefore.platformHostToolchainReceiptHash,
      hostCompositionReceiptHash:
        launchBefore.hostCompositionReceiptHash,
      targetRootPhysicalIdentityHash,
      sandboxPolicyHash:
        PLATFORM_RELEASE_BOOTSTRAP_NETWORK_NEGATIVE_OPERATION_POLICY_HASH_V2,
      occurrenceId,
      targetBefore: targetBefore.observation,
      targetAfter: targetAfter.observation,
      receipt,
      process: processObservation,
    });
  } catch (error) {
    primaryFailure = error;
  }
  try {
    cleanupScratchV2(scratch);
  } catch (cleanupFailure) {
    return failV2(
      "INSTALLED_NETWORK_NEGATIVE_OPERATION_CLEANUP_FAILED",
      "Installed network-negative scratch cleanup failed",
      primaryFailure === undefined
        ? cleanupFailure
        : new AggregateError([primaryFailure, cleanupFailure]),
    );
  }
  if (primaryFailure !== undefined) throw primaryFailure;
  if (occurrence === undefined) {
    return failV2(
      "INSTALLED_NETWORK_NEGATIVE_OPERATION_OUTPUT_INVALID",
      "Installed network-negative operation produced no occurrence",
    );
  }
  return occurrence;
}

/** @internal Projects one raw installed occurrence into strict pathless evidence. */
export async function observePlatformReleaseBootstrapInstalledNetworkNegativeEvidenceAtPrivateTargetInternalV2(
  hostToolchain: PlatformReleaseHostNodeToolchainAuthorityV2,
  targetRoot: string,
): Promise<PlatformReleaseCompositionNetworkNegativeTestV2> {
  const occurrence =
    await observePlatformReleaseBootstrapInstalledNetworkNegativeOperationAtPrivateTargetInternalV2(
      hostToolchain,
      targetRoot,
    );
  const identity = {
    schema: PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_TEST_V2_SCHEMA,
    version: "2.0.0" as const,
    admissionScope: "test_fixture" as const,
    productionAuthority: false as const,
    productionAdmission: "forbidden" as const,
    credentialUse: "none" as const,
    mutationAuthority: false as const,
    trustConclusion: "characterization_only" as const,
    limitations: {
      delegateAuthority:
        "wrapper_bytes_censused_delegate_shell_env_and_apple_sandbox_tool_not_independently_censused" as const,
      filesystemRaceBoundary:
        "pathname_fences_and_empty_directory_cleanup_do_not_close_transient_aba" as const,
      processGroupBoundary:
        "timeout_and_output_limit_kill_the_fresh_group_successful_descendant_absence_not_independently_proven" as const,
      runtimeAccountBoundary:
        "probe_children_execute_as_test_owner_not_receipt_runtime_account" as const,
      serializedProvenanceBoundary:
        "strict_self_consistency_is_not_origin_authentication" as const,
    },
    targetBinding:
      PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_TEST_TARGET_BINDING_V2,
    implementationScope:
      PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_TEST_IMPLEMENTATION_SCOPE_V2,
    operationAbiRef:
      PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_TEST_OPERATION_ABI_REF_V2,
    operationAbiHash:
      PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_TEST_OPERATION_ABI_HASH_V2,
    ...occurrence,
  };
  return parsePlatformReleaseCompositionNetworkNegativeForTestV2({
    ...identity,
    evidenceHash:
      hashPlatformReleaseCompositionNetworkNegativeForTestV2(identity),
  });
}

export const PLATFORM_RELEASE_BOOTSTRAP_INSTALLED_NETWORK_NEGATIVE_EMPTY_SHA256_V2 =
  EMPTY_SHA256_V2;
