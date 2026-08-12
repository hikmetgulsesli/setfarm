import { createHash, randomBytes } from "node:crypto";
import {
  chmodSync,
  closeSync,
  constants as fsConstants,
  fstatSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readSync,
  readdirSync,
  realpathSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isProxy } from "node:util/types";

import {
  canonicalJsonStringify,
  hashCanonicalJson,
} from "./canonical-json.js";
import {
  createNetworkIsolationProbeContextV2ForTest,
  destroyNetworkIsolationProbeContextV2,
  runNetworkIsolatedWithScratchRootForTestV2,
  type NetworkIsolationProbeContextV2,
} from "../execution/network-sandbox-v2.js";
import {
  EVIDENCE_ENVIRONMENT_NETWORK_WRAPPER_MODULE_V2,
  EVIDENCE_ENVIRONMENT_SANDBOX_EXECUTABLE_REF_V2,
} from "../execution/schemas/evidence-environment-capsule-v2.js";
import {
  NETWORK_ISOLATION_NEGATIVE_PROBE_RECEIPT_SCHEMA_HASH_V2,
} from "../execution/schemas/network-isolation-negative-probe-v2.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NETWORK_NEGATIVE_PROBE_IMPLEMENTATION_SCOPE_V2,
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NETWORK_NEGATIVE_PROBE_OBSERVATION_V2_SCHEMA,
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NETWORK_NEGATIVE_PROBE_PAYLOAD_BINDING_V2,
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NETWORK_NEGATIVE_PROBE_POLICY_HASH_V2,
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NETWORK_NEGATIVE_PROBE_TRUST_CONCLUSION_V2,
  hashNetworkNegativeProbeFileObservationV2,
  hashNetworkNegativeProbeObservationV2,
  hashNetworkNegativeProbeRootObservationV2,
  hashNetworkNegativeProbeSnapshotV2,
  hashPlatformReleaseBootstrapDarwinNetworkNegativeProbeObservationV2,
  parsePlatformReleaseBootstrapDarwinNetworkNegativeProbeObservationCandidateV2,
  type PlatformReleaseBootstrapDarwinNetworkNegativeProbeFileObservationV2,
  type PlatformReleaseBootstrapDarwinNetworkNegativeProbeObservationV2,
  type PlatformReleaseBootstrapDarwinNetworkNegativeProbeRootObservationV2,
  type PlatformReleaseBootstrapDarwinNetworkNegativeProbeSnapshotV2,
} from "../execution/schemas/platform-release-bootstrap-darwin-network-negative-probe-observation-v2.js";

const MAX_FILE_BYTES_V2 = 64 * 1024 * 1024;
const MAX_ROOT_ENTRIES_V2 = 256;
const EXPECTED_SCRATCH_CHILDREN_V2 = Object.freeze([
  "cache",
  "home",
  "tmp",
] as const);
const ROOT_ROLE_V2 = "NETWORK_PROBE_SCRATCH_ROOT_V2" as const;
const ROOT_LOCATOR_REF_V2 =
  "NETWORK_PROBE_SCRATCH_ROOT_PRIVATE_TOKEN_V2" as const;

export type PlatformReleaseBootstrapDarwinNetworkNegativeProbeObservationFixtureV2 = Readonly<{
  dispose(): void;
}>;

export type PlatformReleaseBootstrapDarwinNetworkNegativeProbeObservationErrorCodeV2 =
  | "NETWORK_NEGATIVE_PROBE_PLATFORM_UNAVAILABLE"
  | "NETWORK_NEGATIVE_PROBE_FIXTURE_BUILD_FAILED"
  | "NETWORK_NEGATIVE_PROBE_FIXTURE_HANDLE_UNAUTHENTICATED"
  | "NETWORK_NEGATIVE_PROBE_CHALLENGE_INVALID"
  | "NETWORK_NEGATIVE_PROBE_FILESYSTEM_DRIFT"
  | "NETWORK_NEGATIVE_PROBE_RECEIPT_INVALID"
  | "NETWORK_NEGATIVE_PROBE_CLEANUP_FAILED";

export class PlatformReleaseBootstrapDarwinNetworkNegativeProbeObservationErrorV2
  extends Error {
  constructor(
    readonly code:
      PlatformReleaseBootstrapDarwinNetworkNegativeProbeObservationErrorCodeV2,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message.slice(0, 1_500), options);
    this.name =
      "PlatformReleaseBootstrapDarwinNetworkNegativeProbeObservationErrorV2";
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

type FixedFileDefinitionV2 = Readonly<{
  roleRef:
    | "NETWORK_PROBE_WRAPPER_MODULE_V2"
    | "NETWORK_PROBE_SANDBOX_EXECUTABLE_V2"
    | "NETWORK_PROBE_NODE_EXECUTABLE_V2";
  locatorRef:
    | typeof EVIDENCE_ENVIRONMENT_NETWORK_WRAPPER_MODULE_V2
    | typeof EVIDENCE_ENVIRONMENT_SANDBOX_EXECUTABLE_REF_V2
    | "EXEC_NODE_RUNTIME_V2";
  absolutePath: string;
}>;

type FixtureStateV2 = Readonly<{
  rootPath: string;
  context: NetworkIsolationProbeContextV2;
  hostIdentityHash: string;
  files: readonly [FixedFileDefinitionV2, FixedFileDefinitionV2, FixedFileDefinitionV2];
  baseline: PlatformReleaseBootstrapDarwinNetworkNegativeProbeSnapshotV2;
  lifecycle: { status: "ready" | "running" | "disposed" };
}>;

const fixtureStatesV2 = new WeakMap<object, FixtureStateV2>();

function failV2(
  code: PlatformReleaseBootstrapDarwinNetworkNegativeProbeObservationErrorCodeV2,
  message: string,
  cause?: unknown,
): never {
  throw new PlatformReleaseBootstrapDarwinNetworkNegativeProbeObservationErrorV2(
    code,
    message,
    cause === undefined ? undefined : { cause },
  );
}

function sha256BytesV2(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function modeTextV2(stat: BigIntStatV2): string {
  return Number(stat.mode & 0o7777n).toString(8).padStart(4, "0");
}

function stableIdentityV2<K extends "directory" | "ordinary_file">(
  stat: BigIntStatV2,
  hostIdentityHash: string,
  objectKind: K,
) {
  return {
    hostIdentityHash,
    objectKind,
    device: stat.dev.toString(10),
    inode: stat.ino.toString(10),
  } as const;
}

function samePhysicalV2(
  left: Readonly<{
    hostIdentityHash: string;
    objectKind: string;
    device: string;
    inode: string;
  }>,
  right: Readonly<{
    hostIdentityHash: string;
    objectKind: string;
    device: string;
    inode: string;
  }>,
): boolean {
  return left.hostIdentityHash === right.hostIdentityHash
    && left.objectKind === right.objectKind
    && left.device === right.device
    && left.inode === right.inode;
}

function sameMutableV2(
  left: Readonly<Record<string, unknown>>,
  right: Readonly<Record<string, unknown>>,
): boolean {
  return canonicalJsonStringify(left) === canonicalJsonStringify(right);
}

function mutableFingerprintV2(
  stat: BigIntStatV2,
  contentHash: string,
): {
  ownerUid: number;
  ownerGid: number;
  mode: string;
  linkCount: number;
  byteLength: number;
  contentHash: string;
  modifiedTimeNanoseconds: string;
  changedTimeNanoseconds: string;
} {
  if (
    stat.uid > 4_294_967_294n
    || stat.gid > 4_294_967_294n
    || stat.nlink < 1n
    || stat.size < 0n
    || stat.size > BigInt(MAX_FILE_BYTES_V2)
  ) {
    return failV2(
      "NETWORK_NEGATIVE_PROBE_FILESYSTEM_DRIFT",
      "Network probe physical fingerprint is outside its fixed bounds",
    );
  }
  return {
    ownerUid: Number(stat.uid),
    ownerGid: Number(stat.gid),
    mode: modeTextV2(stat),
    linkCount: Number(stat.nlink),
    byteLength: Number(stat.size),
    contentHash,
    modifiedTimeNanoseconds: stat.mtimeNs.toString(10),
    changedTimeNanoseconds: stat.ctimeNs.toString(10),
  };
}

function captureFileV2(
  definition: FixedFileDefinitionV2,
  hostIdentityHash: string,
): PlatformReleaseBootstrapDarwinNetworkNegativeProbeFileObservationV2 {
  let descriptor = -1;
  try {
    const literal = path.resolve(definition.absolutePath);
    const real = realpathSync(literal);
    if (real !== literal) {
      return failV2(
        "NETWORK_NEGATIVE_PROBE_FILESYSTEM_DRIFT",
        "Network probe fixed file is a replaceable symbolic link",
      );
    }
    const pathBefore = lstatSync(literal, { bigint: true }) as BigIntStatV2;
    if (
      pathBefore.isSymbolicLink()
      || !pathBefore.isFile()
      || pathBefore.nlink !== 1n
      || pathBefore.size <= 0n
      || pathBefore.size > BigInt(MAX_FILE_BYTES_V2)
    ) {
      return failV2(
        "NETWORK_NEGATIVE_PROBE_FILESYSTEM_DRIFT",
        "Network probe fixed file is not one bounded ordinary file",
      );
    }
    descriptor = openSync(
      literal,
      fsConstants.O_RDONLY
        | (fsConstants.O_NOFOLLOW ?? 0)
        | ((fsConstants as unknown as Record<string, number>).O_CLOEXEC ?? 0),
    );
    const descriptorBefore = fstatSync(
      descriptor,
      { bigint: true },
    ) as BigIntStatV2;
    const beforeStable = stableIdentityV2(
      pathBefore,
      hostIdentityHash,
      "ordinary_file",
    );
    const descriptorStable = stableIdentityV2(
      descriptorBefore,
      hostIdentityHash,
      "ordinary_file",
    );
    if (
      descriptorBefore.isSymbolicLink()
      || !descriptorBefore.isFile()
      || !samePhysicalV2(beforeStable, descriptorStable)
    ) {
      return failV2(
        "NETWORK_NEGATIVE_PROBE_FILESYSTEM_DRIFT",
        "Network probe fixed file changed before descriptor capture",
      );
    }
    const length = Number(descriptorBefore.size);
    const bytes = Buffer.alloc(length);
    const digest = createHash("sha256");
    let offset = 0;
    while (offset < length) {
      const count = readSync(descriptor, bytes, offset, length - offset, offset);
      if (count <= 0) {
        bytes.fill(0);
        return failV2(
          "NETWORK_NEGATIVE_PROBE_FILESYSTEM_DRIFT",
          "Network probe fixed file reached EOF before its descriptor size",
        );
      }
      digest.update(bytes.subarray(offset, offset + count));
      offset += count;
    }
    const eof = Buffer.alloc(1);
    if (readSync(descriptor, eof, 0, 1, length) !== 0) {
      bytes.fill(0);
      eof.fill(0);
      return failV2(
        "NETWORK_NEGATIVE_PROBE_FILESYSTEM_DRIFT",
        "Network probe fixed file grew during descriptor capture",
      );
    }
    bytes.fill(0);
    eof.fill(0);
    const descriptorAfter = fstatSync(
      descriptor,
      { bigint: true },
    ) as BigIntStatV2;
    const pathAfter = lstatSync(literal, { bigint: true }) as BigIntStatV2;
    const contentHash = digest.digest("hex");
    const afterStable = stableIdentityV2(
      descriptorAfter,
      hostIdentityHash,
      "ordinary_file",
    );
    const pathAfterStable = stableIdentityV2(
      pathAfter,
      hostIdentityHash,
      "ordinary_file",
    );
    const mutableBefore = mutableFingerprintV2(
      descriptorBefore,
      contentHash,
    );
    const mutableAfter = mutableFingerprintV2(descriptorAfter, contentHash);
    if (
      descriptorAfter.isSymbolicLink()
      || !descriptorAfter.isFile()
      || pathAfter.isSymbolicLink()
      || !pathAfter.isFile()
      || !samePhysicalV2(descriptorStable, afterStable)
      || !samePhysicalV2(afterStable, pathAfterStable)
      || !sameMutableV2(mutableBefore, mutableAfter)
    ) {
      return failV2(
        "NETWORK_NEGATIVE_PROBE_FILESYSTEM_DRIFT",
        "Network probe fixed file changed during descriptor capture",
      );
    }
    const identity = {
      roleRef: definition.roleRef,
      locatorRef: definition.locatorRef,
      stableIdentity: afterStable,
      mutableFingerprint: mutableAfter,
    } as const;
    return {
      ...identity,
      observationHash: hashNetworkNegativeProbeFileObservationV2(identity),
    };
  } catch (error) {
    if (
      error
      instanceof PlatformReleaseBootstrapDarwinNetworkNegativeProbeObservationErrorV2
    ) {
      throw error;
    }
    return failV2(
      "NETWORK_NEGATIVE_PROBE_FILESYSTEM_DRIFT",
      "Network probe fixed file could not be captured",
      error,
    );
  } finally {
    if (descriptor >= 0) {
      try {
        closeSync(descriptor);
      } catch {
        // The descriptor is fixture-local; the observation has already failed
        // closed if the close itself is not accepted by the host.
      }
    }
  }
}

function captureRootV2(
  rootPath: string,
  hostIdentityHash: string,
): PlatformReleaseBootstrapDarwinNetworkNegativeProbeRootObservationV2 {
  let descriptor = -1;
  try {
    const literal = path.resolve(rootPath);
    if (realpathSync(literal) !== literal) {
      return failV2(
        "NETWORK_NEGATIVE_PROBE_FILESYSTEM_DRIFT",
        "Network probe scratch root is a replaceable symbolic link",
      );
    }
    const pathBefore = lstatSync(literal, { bigint: true }) as BigIntStatV2;
    if (
      pathBefore.isSymbolicLink()
      || !pathBefore.isDirectory()
      || modeTextV2(pathBefore) !== "0700"
    ) {
      return failV2(
        "NETWORK_NEGATIVE_PROBE_FILESYSTEM_DRIFT",
        "Network probe scratch root is not a mode-0700 directory",
      );
    }
    descriptor = openSync(
      literal,
      fsConstants.O_RDONLY
        | (fsConstants.O_DIRECTORY ?? 0)
        | (fsConstants.O_NOFOLLOW ?? 0)
        | ((fsConstants as unknown as Record<string, number>).O_CLOEXEC ?? 0),
    );
    const descriptorBefore = fstatSync(
      descriptor,
      { bigint: true },
    ) as BigIntStatV2;
    const beforeStable = stableIdentityV2(
      pathBefore,
      hostIdentityHash,
      "directory",
    );
    const descriptorStable = stableIdentityV2(
      descriptorBefore,
      hostIdentityHash,
      "directory",
    );
    if (
      descriptorBefore.isSymbolicLink()
      || !descriptorBefore.isDirectory()
      || !samePhysicalV2(beforeStable, descriptorStable)
    ) {
      return failV2(
        "NETWORK_NEGATIVE_PROBE_FILESYSTEM_DRIFT",
        "Network probe scratch root changed before descriptor capture",
      );
    }
    const namesBefore = readdirSync(literal).sort();
    if (
      namesBefore.length > MAX_ROOT_ENTRIES_V2
      || namesBefore.some((name) =>
        name.length < 1 || name.length > 255 || name.includes("\0"))
    ) {
      return failV2(
        "NETWORK_NEGATIVE_PROBE_FILESYSTEM_DRIFT",
        "Network probe scratch root exceeds its bounded namespace",
      );
    }
    const namesHashBefore = hashCanonicalJson({
      schema:
        "setfarm.platform-release-bootstrap-darwin-network-negative-probe-root-membership.v2",
      entries: namesBefore,
    });
    const descriptorAfter = fstatSync(
      descriptor,
      { bigint: true },
    ) as BigIntStatV2;
    const pathAfter = lstatSync(literal, { bigint: true }) as BigIntStatV2;
    const namesAfter = readdirSync(literal).sort();
    const namesHashAfter = hashCanonicalJson({
      schema:
        "setfarm.platform-release-bootstrap-darwin-network-negative-probe-root-membership.v2",
      entries: namesAfter,
    });
    const afterStable = stableIdentityV2(
      descriptorAfter,
      hostIdentityHash,
      "directory",
    );
    const pathAfterStable = stableIdentityV2(
      pathAfter,
      hostIdentityHash,
      "directory",
    );
    const mutableBefore = mutableFingerprintV2(
      descriptorBefore,
      namesHashBefore,
    );
    const mutableAfter = mutableFingerprintV2(
      descriptorAfter,
      namesHashAfter,
    );
    if (
      namesBefore.length !== namesAfter.length
      || namesHashBefore !== namesHashAfter
      || descriptorAfter.isSymbolicLink()
      || !descriptorAfter.isDirectory()
      || pathAfter.isSymbolicLink()
      || !pathAfter.isDirectory()
      || !samePhysicalV2(descriptorStable, afterStable)
      || !samePhysicalV2(afterStable, pathAfterStable)
      || !sameMutableV2(mutableBefore, mutableAfter)
    ) {
      return failV2(
        "NETWORK_NEGATIVE_PROBE_FILESYSTEM_DRIFT",
        "Network probe scratch root changed during descriptor capture",
      );
    }
    const identity = {
      roleRef: ROOT_ROLE_V2,
      locatorRef: ROOT_LOCATOR_REF_V2,
      stableIdentity: afterStable,
      mutableFingerprint: mutableAfter,
      directEntryNamesHash: namesHashAfter,
    } as const;
    return {
      ...identity,
      observationHash: hashNetworkNegativeProbeRootObservationV2(identity),
    };
  } catch (error) {
    if (
      error
      instanceof PlatformReleaseBootstrapDarwinNetworkNegativeProbeObservationErrorV2
    ) {
      throw error;
    }
    return failV2(
      "NETWORK_NEGATIVE_PROBE_FILESYSTEM_DRIFT",
      "Network probe scratch root could not be captured",
      error,
    );
  } finally {
    if (descriptor >= 0) {
      try {
        closeSync(descriptor);
      } catch {
        // Fixture cleanup remains bounded and the receipt never promotes this
        // descriptor into production authority.
      }
    }
  }
}

function captureSnapshotV2(
  state: FixtureStateV2,
): PlatformReleaseBootstrapDarwinNetworkNegativeProbeSnapshotV2 {
  const root = captureRootV2(state.rootPath, state.hostIdentityHash);
  const files = state.files.map((definition) =>
    captureFileV2(definition, state.hostIdentityHash)) as [
      PlatformReleaseBootstrapDarwinNetworkNegativeProbeFileObservationV2,
      PlatformReleaseBootstrapDarwinNetworkNegativeProbeFileObservationV2,
      PlatformReleaseBootstrapDarwinNetworkNegativeProbeFileObservationV2,
    ];
  const identity = { root, files } as const;
  return {
    ...identity,
    snapshotHash: hashNetworkNegativeProbeSnapshotV2(identity),
  };
}

function authenticFixtureStateV2(
  fixture: PlatformReleaseBootstrapDarwinNetworkNegativeProbeObservationFixtureV2,
): FixtureStateV2 {
  if (
    typeof fixture !== "object"
    || fixture === null
    || isProxy(fixture)
  ) {
    return failV2(
      "NETWORK_NEGATIVE_PROBE_FIXTURE_HANDLE_UNAUTHENTICATED",
      "Network negative probe requires one authentic private fixture",
    );
  }
  const state = fixtureStatesV2.get(fixture);
  if (state === undefined) {
    return failV2(
      "NETWORK_NEGATIVE_PROBE_FIXTURE_HANDLE_UNAUTHENTICATED",
      "Network negative probe fixture is not code-owned",
    );
  }
  return state;
}

export async function buildPlatformReleaseBootstrapDarwinNetworkNegativeProbeObservationFixtureForTestV2(): Promise<
  PlatformReleaseBootstrapDarwinNetworkNegativeProbeObservationFixtureV2
> {
  if (process.platform !== "darwin") {
    return failV2(
      "NETWORK_NEGATIVE_PROBE_PLATFORM_UNAVAILABLE",
      "Network negative probe observation requires Darwin",
    );
  }
  let rootPath: string | undefined;
  let cleanupRootIdentity: Readonly<{ dev: bigint; ino: bigint }> | undefined;
  let context: NetworkIsolationProbeContextV2 | undefined;
  try {
    context = await createNetworkIsolationProbeContextV2ForTest();
    rootPath = realpathSync(mkdtempSync(
      path.join(tmpdir(), "setfarm-network-negative-observation-v2-"),
    ));
    {
      const rootStat = lstatSync(rootPath, { bigint: true }) as BigIntStatV2;
      cleanupRootIdentity = { dev: rootStat.dev, ino: rootStat.ino };
    }
    chmodSync(rootPath, 0o700);
    for (const basename of EXPECTED_SCRATCH_CHILDREN_V2) {
      mkdirSync(path.join(rootPath, basename), { mode: 0o700 });
    }
    const hostIdentityHash = context.hostRuntimeIdentityHash;
    const files = [
      {
        roleRef: "NETWORK_PROBE_WRAPPER_MODULE_V2" as const,
        locatorRef: EVIDENCE_ENVIRONMENT_NETWORK_WRAPPER_MODULE_V2,
        absolutePath: fileURLToPath(
          new URL("../execution/network-sandbox-v2.ts", import.meta.url),
        ),
      },
      {
        roleRef: "NETWORK_PROBE_SANDBOX_EXECUTABLE_V2" as const,
        locatorRef: EVIDENCE_ENVIRONMENT_SANDBOX_EXECUTABLE_REF_V2,
        absolutePath: "/usr/bin/sandbox-exec",
      },
      {
        roleRef: "NETWORK_PROBE_NODE_EXECUTABLE_V2" as const,
        locatorRef: "EXEC_NODE_RUNTIME_V2",
        absolutePath: process.execPath,
      },
    ] as const;
    const provisionalState = {
      rootPath,
      context,
      hostIdentityHash,
      files,
      baseline: undefined as never,
      lifecycle: { status: "ready" as const },
    } as FixtureStateV2;
    const baseline = captureSnapshotV2(provisionalState);
    let fixture: PlatformReleaseBootstrapDarwinNetworkNegativeProbeObservationFixtureV2;
    const state: FixtureStateV2 = {
      ...provisionalState,
      baseline,
    };
    fixture = Object.freeze({
      dispose(): void {
        const current = fixtureStatesV2.get(fixture);
        if (current === undefined || current.lifecycle.status === "disposed") return;
        if (current.lifecycle.status === "running") {
          return failV2(
            "NETWORK_NEGATIVE_PROBE_FIXTURE_HANDLE_UNAUTHENTICATED",
            "Network negative probe fixture cannot be disposed while running",
          );
        }
        try {
          const root = captureRootV2(
            current.rootPath,
            current.hostIdentityHash,
          );
          if (
            !samePhysicalV2(
              root.stableIdentity,
              current.baseline.root.stableIdentity,
            )
            || root.directEntryNamesHash
              !== current.baseline.root.directEntryNamesHash
            || !sameMutableV2(
              root.mutableFingerprint,
              current.baseline.root.mutableFingerprint,
            )
          ) {
            return failV2(
              "NETWORK_NEGATIVE_PROBE_CLEANUP_FAILED",
              "Network negative probe fixture root changed; refusing destructive cleanup",
            );
          }
          destroyNetworkIsolationProbeContextV2(current.context);
          rmSync(current.rootPath, { recursive: true, force: false });
        } catch (error) {
          throw new PlatformReleaseBootstrapDarwinNetworkNegativeProbeObservationErrorV2(
            "NETWORK_NEGATIVE_PROBE_CLEANUP_FAILED",
            "Network negative probe fixture root could not be removed",
            { cause: error },
          );
        }
        current.lifecycle.status = "disposed";
        fixtureStatesV2.delete(fixture);
      },
    });
    fixtureStatesV2.set(fixture, state);
    return fixture;
  } catch (error) {
    if (
      context !== undefined
    ) {
      try {
        destroyNetworkIsolationProbeContextV2(context);
      } catch {
        // Preserve the original typed fixture-build failure.
      }
    }
    if (rootPath !== undefined && cleanupRootIdentity !== undefined) {
      try {
        const cleanupStat = lstatSync(rootPath, { bigint: true }) as BigIntStatV2;
        if (
          !cleanupStat.isSymbolicLink()
          && cleanupStat.isDirectory()
          && cleanupStat.dev === cleanupRootIdentity.dev
          && cleanupStat.ino === cleanupRootIdentity.ino
        ) {
          rmSync(rootPath, { recursive: true, force: false });
        }
      } catch {
        // Preserve the original typed fixture-build failure.
      }
    }
    if (
      error
      instanceof PlatformReleaseBootstrapDarwinNetworkNegativeProbeObservationErrorV2
    ) {
      throw error;
    }
    return failV2(
      "NETWORK_NEGATIVE_PROBE_FIXTURE_BUILD_FAILED",
      "Network negative probe observation fixture could not be built",
      error,
    );
  }
}

export async function observePlatformReleaseBootstrapDarwinNetworkNegativeProbeObservationForTestV2(
  fixture: PlatformReleaseBootstrapDarwinNetworkNegativeProbeObservationFixtureV2,
  options: Readonly<{ challenge?: Uint8Array }> = {},
): Promise<PlatformReleaseBootstrapDarwinNetworkNegativeProbeObservationV2> {
  if (process.platform !== "darwin") {
    return failV2(
      "NETWORK_NEGATIVE_PROBE_PLATFORM_UNAVAILABLE",
      "Network negative probe observation requires Darwin",
    );
  }
  const state = authenticFixtureStateV2(fixture);
  if (state.lifecycle.status !== "ready") {
    return failV2(
      "NETWORK_NEGATIVE_PROBE_FIXTURE_HANDLE_UNAUTHENTICATED",
      "Network negative probe fixture is not ready for one observation",
    );
  }
  const challenge = options.challenge === undefined
    ? randomBytes(32)
    : Buffer.from(options.challenge);
  if (challenge.byteLength !== 32) {
    return failV2(
      "NETWORK_NEGATIVE_PROBE_CHALLENGE_INVALID",
      "Network negative probe challenge must be exactly 32 bytes",
    );
  }
  state.lifecycle.status = "running";
  let primaryFailure: unknown;
  try {
    const before = captureSnapshotV2(state);
    if (canonicalJsonStringify(before) !== canonicalJsonStringify(state.baseline)) {
      return failV2(
        "NETWORK_NEGATIVE_PROBE_FILESYSTEM_DRIFT",
        "Network negative probe fixture changed before observation",
      );
    }
    const result = await runNetworkIsolatedWithScratchRootForTestV2(
      state.context,
      state.rootPath,
    );
    const interstitialNames = readdirSync(state.rootPath).sort();
    if (
      canonicalJsonStringify(interstitialNames)
      !== canonicalJsonStringify([...EXPECTED_SCRATCH_CHILDREN_V2])
    ) {
      return failV2(
        "NETWORK_NEGATIVE_PROBE_FILESYSTEM_DRIFT",
        "Network negative probe scratch root contains an unknown child",
      );
    }
    const after = captureSnapshotV2(state);
    const networkReceipt = result.receipt;
    const identity = {
      schema: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NETWORK_NEGATIVE_PROBE_OBSERVATION_V2_SCHEMA,
      version: "2.0.0" as const,
      authorityState: "observed_test_fixture_unverified" as const,
      admissionScope: "test_fixture" as const,
      productionAuthority: false as const,
      productionAdmission: "forbidden" as const,
      credentialUse: "none" as const,
      mutationAuthority: false as const,
      trustConclusion:
        PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NETWORK_NEGATIVE_PROBE_TRUST_CONCLUSION_V2,
      implementationScope:
        PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NETWORK_NEGATIVE_PROBE_IMPLEMENTATION_SCOPE_V2,
      payloadBinding:
        PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NETWORK_NEGATIVE_PROBE_PAYLOAD_BINDING_V2,
      policyHash: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NETWORK_NEGATIVE_PROBE_POLICY_HASH_V2,
      hostIdentityHash: state.hostIdentityHash,
      challengeHash: sha256BytesV2(challenge),
      networkReceiptSchemaHash:
        NETWORK_ISOLATION_NEGATIVE_PROBE_RECEIPT_SCHEMA_HASH_V2,
      networkReceipt,
      networkReceiptHash: networkReceipt.receiptHash,
      observationOutcome: "network_negative_probes_observed" as const,
      before,
      after,
      observationHash: hashNetworkNegativeProbeObservationV2({
        challengeHash: sha256BytesV2(challenge),
        hostIdentityHash: state.hostIdentityHash,
        networkReceiptHash: networkReceipt.receiptHash,
        observationOutcome: "network_negative_probes_observed",
        policyHash: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NETWORK_NEGATIVE_PROBE_POLICY_HASH_V2,
        before,
        after,
      }),
    } as const;
    return parsePlatformReleaseBootstrapDarwinNetworkNegativeProbeObservationCandidateV2({
      ...identity,
      probeHash:
        hashPlatformReleaseBootstrapDarwinNetworkNegativeProbeObservationV2(
          identity,
        ),
    });
  } catch (error) {
    primaryFailure = error;
    if (
      error
      instanceof PlatformReleaseBootstrapDarwinNetworkNegativeProbeObservationErrorV2
    ) {
      throw error;
    }
    return failV2(
      "NETWORK_NEGATIVE_PROBE_RECEIPT_INVALID",
      "Network negative probe observation crossed an untyped boundary",
      error,
    );
  } finally {
    state.lifecycle.status = "ready";
    if (primaryFailure !== undefined) {
      // The typed primary error is raised above; no cleanup authority is
      // inferred from a failed observation.
    }
  }
}
