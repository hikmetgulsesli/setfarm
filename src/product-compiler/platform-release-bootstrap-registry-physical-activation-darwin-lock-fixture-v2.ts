import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
} from "node:fs";
import path from "node:path";

import {
  acquireDarwinParentDescriptorLeaseV2,
  type DarwinParentDescriptorLeaseV2,
} from "./darwin-parent-descriptor-lease-v2.js";
import type { PlatformReleaseBootstrapRegistryPhysicalActivationLockRoleV2 } from "./platform-release-bootstrap-registry-physical-activation-types-v2.js";

export const PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_DARWIN_LOCK_FIXTURE_SCOPE_V2 =
  "darwin_real_kernel_lock_fixture_never_production_authority_v2" as const;

export const PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_DARWIN_LOCK_FIXTURE_LEGAL_ORDERS_V2 =
  Object.freeze([
    Object.freeze(["legacy_node_package_lock"] as const),
    Object.freeze(["legacy_node_package_lock", "shared_parent_lock"] as const),
    Object.freeze(["shared_parent_lock", "legacy_node_package_lock"] as const),
    Object.freeze(["shared_parent_lock", "package_lock"] as const),
  ] as const);

export type PlatformReleaseBootstrapRegistryDarwinLockFixtureOrderV2 =
  (typeof PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_DARWIN_LOCK_FIXTURE_LEGAL_ORDERS_V2)[number];

export type PlatformReleaseBootstrapRegistryDarwinLockFixtureErrorCodeV2 =
  | "DARWIN_LOCK_FIXTURE_ACQUISITION_FAILED"
  | "DARWIN_LOCK_FIXTURE_INPUT_INVALID"
  | "DARWIN_LOCK_FIXTURE_LIFECYCLE_INVALID"
  | "DARWIN_LOCK_FIXTURE_ORDER_INVALID"
  | "DARWIN_LOCK_FIXTURE_RELEASE_FAILED";

export class PlatformReleaseBootstrapRegistryDarwinLockFixtureErrorV2 extends Error {
  readonly code: PlatformReleaseBootstrapRegistryDarwinLockFixtureErrorCodeV2;
  override readonly cause?: unknown;

  constructor(
    code: PlatformReleaseBootstrapRegistryDarwinLockFixtureErrorCodeV2,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message.slice(0, 1_000), options);
    this.name = "PlatformReleaseBootstrapRegistryDarwinLockFixtureErrorV2";
    this.code = code;
    this.cause = options?.cause;
  }
}

export type PlatformReleaseBootstrapRegistryDarwinLockFixtureBoundaryV2 =
  Readonly<{
    parentPath: string;
    lockPath: string;
    lockBytes: Uint8Array;
    expectedOwner: Readonly<{ uid: number; gid: number }>;
    allowedParentModes: readonly (0o700 | 0o755)[];
  }>;

export type PlatformReleaseBootstrapRegistryDarwinLockFixtureInputV2 =
  Readonly<{
    acquisitionOrder: readonly PlatformReleaseBootstrapRegistryPhysicalActivationLockRoleV2[];
    locks: Readonly<
      Record<
        PlatformReleaseBootstrapRegistryPhysicalActivationLockRoleV2,
        PlatformReleaseBootstrapRegistryDarwinLockFixtureBoundaryV2
      >
    >;
  }>;

export interface PlatformReleaseBootstrapRegistryDarwinLockFixtureSessionV2 {
  readonly fixtureScope: typeof PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_DARWIN_LOCK_FIXTURE_SCOPE_V2;
  readonly productionAuthority: false;
  readonly acquisitionOrder: PlatformReleaseBootstrapRegistryDarwinLockFixtureOrderV2;

  acquireLegacyNodeLock(): Promise<void>;
  acquireSharedParentLock(): Promise<void>;
  acquireRegisteredPackageLock(): Promise<void>;
  assertAllHeldAndCurrent(): void;
  releaseAll(): Promise<void>;
}

type InternalBoundaryV2 = Readonly<{
  parentPath: string;
  lockPath: string;
  lockBytes: Buffer;
  expectedOwner: Readonly<{ uid: number; gid: number }>;
  allowedParentModes: readonly (0o700 | 0o755)[];
}>;

type PhysicalParentIdentityV2 = Readonly<{
  device: bigint;
  inode: bigint;
}>;

type PhysicalParentStatV2 = Readonly<{
  dev: bigint;
  ino: bigint;
  uid: bigint;
  gid: bigint;
  mode: bigint;
  isDirectory(): boolean;
  isSymbolicLink(): boolean;
}>;

function fixtureFailV2(
  code: PlatformReleaseBootstrapRegistryDarwinLockFixtureErrorCodeV2,
  message: string,
  cause?: unknown,
): never {
  throw new PlatformReleaseBootstrapRegistryDarwinLockFixtureErrorV2(
    code,
    message,
    cause === undefined ? undefined : { cause },
  );
}

function exactLegalOrderV2(
  candidate: readonly PlatformReleaseBootstrapRegistryPhysicalActivationLockRoleV2[],
): PlatformReleaseBootstrapRegistryDarwinLockFixtureOrderV2 {
  if (!Array.isArray(candidate)) {
    return fixtureFailV2(
      "DARWIN_LOCK_FIXTURE_ORDER_INVALID",
      "Darwin lock fixture requires one exact legal acquisition order",
    );
  }
  const key = candidate.join("\0");
  const order =
    PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_DARWIN_LOCK_FIXTURE_LEGAL_ORDERS_V2.find(
      (legal) => legal.join("\0") === key,
    );
  if (order === undefined || new Set(candidate).size !== candidate.length) {
    return fixtureFailV2(
      "DARWIN_LOCK_FIXTURE_ORDER_INVALID",
      "Darwin lock fixture order is unsupported, duplicated, or inverted",
    );
  }
  return order;
}

function captureBoundaryV2(
  role: PlatformReleaseBootstrapRegistryPhysicalActivationLockRoleV2,
  candidate: PlatformReleaseBootstrapRegistryDarwinLockFixtureBoundaryV2,
): InternalBoundaryV2 {
  if (
    typeof candidate !== "object" ||
    candidate === null ||
    typeof candidate.parentPath !== "string" ||
    !path.isAbsolute(candidate.parentPath) ||
    path.normalize(candidate.parentPath) !== candidate.parentPath ||
    typeof candidate.lockPath !== "string" ||
    !path.isAbsolute(candidate.lockPath) ||
    path.normalize(candidate.lockPath) !== candidate.lockPath ||
    path.dirname(candidate.lockPath) !== candidate.parentPath ||
    !(candidate.lockBytes instanceof Uint8Array) ||
    candidate.lockBytes.byteLength < 1 ||
    candidate.lockBytes.byteLength > 4_096 ||
    !Number.isInteger(candidate.expectedOwner?.uid) ||
    candidate.expectedOwner.uid < 0 ||
    !Number.isInteger(candidate.expectedOwner?.gid) ||
    candidate.expectedOwner.gid < 0 ||
    !Array.isArray(candidate.allowedParentModes) ||
    candidate.allowedParentModes.length < 1 ||
    candidate.allowedParentModes.length > 2 ||
    new Set(candidate.allowedParentModes).size !==
      candidate.allowedParentModes.length ||
    candidate.allowedParentModes.some(
      (mode) => mode !== 0o700 && mode !== 0o755,
    )
  ) {
    return fixtureFailV2(
      "DARWIN_LOCK_FIXTURE_INPUT_INVALID",
      `Darwin lock fixture ${role} boundary is not one exact direct-child lock`,
    );
  }
  return Object.freeze({
    parentPath: candidate.parentPath,
    lockPath: candidate.lockPath,
    lockBytes: Buffer.from(candidate.lockBytes),
    expectedOwner: Object.freeze({
      uid: candidate.expectedOwner.uid,
      gid: candidate.expectedOwner.gid,
    }),
    allowedParentModes: Object.freeze(
      [...candidate.allowedParentModes].sort((left, right) => left - right),
    ),
  });
}

function physicalParentIdentityV2(
  stat: PhysicalParentStatV2,
): PhysicalParentIdentityV2 {
  return Object.freeze({ device: stat.dev, inode: stat.ino });
}

function samePhysicalParentIdentityV2(
  left: PhysicalParentIdentityV2,
  right: PhysicalParentIdentityV2,
): boolean {
  return left.device === right.device && left.inode === right.inode;
}

function assertPhysicalParentBoundaryV2(
  stat: PhysicalParentStatV2,
  boundary: InternalBoundaryV2,
): void {
  if (
    stat.isSymbolicLink() ||
    !stat.isDirectory() ||
    stat.uid !== BigInt(boundary.expectedOwner.uid) ||
    stat.gid !== BigInt(boundary.expectedOwner.gid) ||
    !boundary.allowedParentModes.includes(Number(stat.mode & 0o7777n) as 0o700 | 0o755)
  ) {
    return fixtureFailV2(
      "DARWIN_LOCK_FIXTURE_ACQUISITION_FAILED",
      "Darwin lock fixture parent no longer matches its exact physical boundary",
    );
  }
}

export function createPlatformReleaseBootstrapRegistryDarwinLockFixtureSessionV2(
  input: PlatformReleaseBootstrapRegistryDarwinLockFixtureInputV2,
): PlatformReleaseBootstrapRegistryDarwinLockFixtureSessionV2 {
  if (typeof input !== "object" || input === null || typeof input.locks !== "object" || input.locks === null) {
    return fixtureFailV2(
      "DARWIN_LOCK_FIXTURE_INPUT_INVALID",
      "Darwin lock fixture requires one exact constructor input",
    );
  }
  const acquisitionOrder = exactLegalOrderV2(input.acquisitionOrder);
  const boundaries: Readonly<
    Record<PlatformReleaseBootstrapRegistryPhysicalActivationLockRoleV2, InternalBoundaryV2>
  > = Object.freeze({
    legacy_node_package_lock: captureBoundaryV2(
      "legacy_node_package_lock",
      input.locks.legacy_node_package_lock,
    ),
    shared_parent_lock: captureBoundaryV2(
      "shared_parent_lock",
      input.locks.shared_parent_lock,
    ),
    package_lock: captureBoundaryV2("package_lock", input.locks.package_lock),
  });
  const boundaryVector = Object.values(boundaries);
  const sharedBoundary = boundaries.shared_parent_lock;
  if (
    boundaryVector.some(
      (boundary) =>
        boundary.parentPath !== sharedBoundary.parentPath ||
        boundary.expectedOwner.uid !== sharedBoundary.expectedOwner.uid ||
        boundary.expectedOwner.gid !== sharedBoundary.expectedOwner.gid ||
        boundary.allowedParentModes.join("\0") !==
          sharedBoundary.allowedParentModes.join("\0"),
    ) ||
    new Set(boundaryVector.map((boundary) => boundary.lockPath)).size !== 3 ||
    new Set(boundaryVector.map((boundary) => path.basename(boundary.lockPath)))
      .size !== 3
  ) {
    for (const boundary of boundaryVector) boundary.lockBytes.fill(0);
    return fixtureFailV2(
      "DARWIN_LOCK_FIXTURE_INPUT_INVALID",
      "Darwin lock fixture roles require one shared parent/owner/mode boundary and three distinct direct children",
    );
  }
  let lifecycle: "fresh" | "acquiring" | "held" | "released" | "failed" =
    "fresh";
  let acquisitionInFlight = false;
  const held: Array<
    Readonly<{
      role: PlatformReleaseBootstrapRegistryPhysicalActivationLockRoleV2;
      lease: DarwinParentDescriptorLeaseV2;
    }>
  > = [];
  let boundaryBytesZeroed = false;
  let pinnedParentDescriptor: number | undefined;
  let pinnedParentIdentity: PhysicalParentIdentityV2 | undefined;

  const zeroBoundaryBytesV2 = (): void => {
    if (boundaryBytesZeroed) return;
    boundaryBytesZeroed = true;
    for (const boundary of boundaryVector) boundary.lockBytes.fill(0);
  };

  const releaseHeldV2 = async (): Promise<unknown[]> => {
    const errors: unknown[] = [];
    while (held.length > 0) {
      const entry = held.pop();
      if (entry === undefined) break;
      try {
        await entry.lease.release();
      } catch (error) {
        errors.push(error);
      }
    }
    return errors;
  };

  const closePinnedParentV2 = (): unknown[] => {
    if (pinnedParentDescriptor === undefined) return [];
    const descriptor = pinnedParentDescriptor;
    pinnedParentDescriptor = undefined;
    pinnedParentIdentity = undefined;
    try {
      closeSync(descriptor);
      return [];
    } catch (error) {
      return [error];
    }
  };

  const pinPhysicalParentV2 = (): void => {
    if (pinnedParentDescriptor !== undefined || pinnedParentIdentity !== undefined) {
      return fixtureFailV2(
        "DARWIN_LOCK_FIXTURE_LIFECYCLE_INVALID",
        "Darwin lock fixture parent descriptor may be pinned only once",
      );
    }
    let descriptor: number | undefined;
    try {
      const before = lstatSync(sharedBoundary.parentPath, { bigint: true });
      assertPhysicalParentBoundaryV2(before, sharedBoundary);
      descriptor = openSync(
        sharedBoundary.parentPath,
        constants.O_RDONLY |
          constants.O_DIRECTORY |
          constants.O_NOFOLLOW |
          constants.O_NONBLOCK,
      );
      const pinned = fstatSync(descriptor, { bigint: true });
      const after = lstatSync(sharedBoundary.parentPath, { bigint: true });
      assertPhysicalParentBoundaryV2(pinned, sharedBoundary);
      assertPhysicalParentBoundaryV2(after, sharedBoundary);
      const beforeIdentity = physicalParentIdentityV2(before);
      const pinnedIdentity = physicalParentIdentityV2(pinned);
      const afterIdentity = physicalParentIdentityV2(after);
      if (
        !samePhysicalParentIdentityV2(beforeIdentity, pinnedIdentity) ||
        !samePhysicalParentIdentityV2(pinnedIdentity, afterIdentity)
      ) {
        return fixtureFailV2(
          "DARWIN_LOCK_FIXTURE_ACQUISITION_FAILED",
          "Darwin lock fixture parent changed while its descriptor was pinned",
        );
      }
      pinnedParentDescriptor = descriptor;
      pinnedParentIdentity = pinnedIdentity;
      descriptor = undefined;
    } catch (error) {
      if (error instanceof PlatformReleaseBootstrapRegistryDarwinLockFixtureErrorV2) {
        throw error;
      }
      return fixtureFailV2(
        "DARWIN_LOCK_FIXTURE_ACQUISITION_FAILED",
        "Darwin lock fixture parent descriptor could not be pinned",
        error,
      );
    } finally {
      if (descriptor !== undefined) closeSync(descriptor);
    }
  };

  const assertPinnedPhysicalParentCurrentV2 = (): void => {
    if (pinnedParentDescriptor === undefined || pinnedParentIdentity === undefined) {
      return fixtureFailV2(
        "DARWIN_LOCK_FIXTURE_LIFECYCLE_INVALID",
        "Darwin lock fixture parent descriptor is not pinned",
      );
    }
    try {
      const pinned = fstatSync(pinnedParentDescriptor, { bigint: true });
      const pathBefore = lstatSync(sharedBoundary.parentPath, { bigint: true });
      const pathAfter = lstatSync(sharedBoundary.parentPath, { bigint: true });
      assertPhysicalParentBoundaryV2(pinned, sharedBoundary);
      assertPhysicalParentBoundaryV2(pathBefore, sharedBoundary);
      assertPhysicalParentBoundaryV2(pathAfter, sharedBoundary);
      const pinnedCurrentIdentity = physicalParentIdentityV2(pinned);
      const pathBeforeIdentity = physicalParentIdentityV2(pathBefore);
      const pathAfterIdentity = physicalParentIdentityV2(pathAfter);
      if (
        !samePhysicalParentIdentityV2(pinnedParentIdentity, pinnedCurrentIdentity) ||
        !samePhysicalParentIdentityV2(pinnedParentIdentity, pathBeforeIdentity) ||
        !samePhysicalParentIdentityV2(pathBeforeIdentity, pathAfterIdentity)
      ) {
        return fixtureFailV2(
          "DARWIN_LOCK_FIXTURE_ACQUISITION_FAILED",
          "Darwin lock fixture parent path no longer names its pinned physical object",
        );
      }
    } catch (error) {
      if (error instanceof PlatformReleaseBootstrapRegistryDarwinLockFixtureErrorV2) {
        throw error;
      }
      return fixtureFailV2(
        "DARWIN_LOCK_FIXTURE_ACQUISITION_FAILED",
        "Darwin lock fixture pinned parent could not be revalidated",
        error,
      );
    }
  };

  const rejectAcquisitionV2 = async (
    code: PlatformReleaseBootstrapRegistryDarwinLockFixtureErrorCodeV2,
    message: string,
    cause?: unknown,
  ): Promise<never> => {
    const releaseErrors = [
      ...(await releaseHeldV2()),
      ...closePinnedParentV2(),
    ];
    lifecycle = "failed";
    zeroBoundaryBytesV2();
    return fixtureFailV2(
      code,
      message,
      releaseErrors.length === 0
        ? cause
        : new AggregateError(
            cause === undefined ? releaseErrors : [cause, ...releaseErrors],
            "Darwin lock fixture acquisition and reverse release failed",
          ),
    );
  };

  const acquireRoleV2 = async (
    role: PlatformReleaseBootstrapRegistryPhysicalActivationLockRoleV2,
  ): Promise<void> => {
    if (acquisitionInFlight) {
      return fixtureFailV2(
        "DARWIN_LOCK_FIXTURE_LIFECYCLE_INVALID",
        "Darwin lock fixture permits only one acquisition operation at a time",
      );
    }
    if (lifecycle !== "fresh" && lifecycle !== "acquiring") {
      return fixtureFailV2(
        "DARWIN_LOCK_FIXTURE_LIFECYCLE_INVALID",
        "Darwin lock fixture session is one-shot and no longer acquirable",
      );
    }
    const expectedRole = acquisitionOrder[held.length];
    if (expectedRole !== role) {
      return rejectAcquisitionV2(
        "DARWIN_LOCK_FIXTURE_ORDER_INVALID",
        `Darwin lock fixture expected ${expectedRole ?? "no further lock"}, received ${role}`,
      );
    }
    lifecycle = "acquiring";
    acquisitionInFlight = true;
    try {
      if (held.length === 0) pinPhysicalParentV2();
      assertPinnedPhysicalParentCurrentV2();
      for (const entry of held) entry.lease.assertCurrent();
      const boundary = boundaries[role];
      const lease = await acquireDarwinParentDescriptorLeaseV2({
        parentPath: boundary.parentPath,
        lockPath: boundary.lockPath,
        lockBytes: boundary.lockBytes,
        expectedOwner: boundary.expectedOwner,
        allowedParentModes: boundary.allowedParentModes,
      });
      held.push(Object.freeze({ role, lease }));
      if (
        pinnedParentIdentity === undefined ||
        lease.parentPhysicalIdentity.device !== pinnedParentIdentity.device ||
        lease.parentPhysicalIdentity.inode !== pinnedParentIdentity.inode
      ) {
        return rejectAcquisitionV2(
          "DARWIN_LOCK_FIXTURE_ACQUISITION_FAILED",
          `Darwin lock fixture ${role} lease resolved outside the pinned physical parent`,
        );
      }
      assertPinnedPhysicalParentCurrentV2();
      for (const entry of held) entry.lease.assertCurrent();
      lifecycle = held.length === acquisitionOrder.length ? "held" : "acquiring";
    } catch (error) {
      return rejectAcquisitionV2(
        "DARWIN_LOCK_FIXTURE_ACQUISITION_FAILED",
        `Darwin lock fixture failed while acquiring ${role}`,
        error,
      );
    } finally {
      acquisitionInFlight = false;
    }
  };

  const session: PlatformReleaseBootstrapRegistryDarwinLockFixtureSessionV2 = {
    fixtureScope: PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_DARWIN_LOCK_FIXTURE_SCOPE_V2,
    productionAuthority: false,
    acquisitionOrder,
    acquireLegacyNodeLock: () => acquireRoleV2("legacy_node_package_lock"),
    acquireSharedParentLock: () => acquireRoleV2("shared_parent_lock"),
    acquireRegisteredPackageLock: () => acquireRoleV2("package_lock"),
    assertAllHeldAndCurrent(): void {
      if (lifecycle !== "held" || held.length !== acquisitionOrder.length) {
        return fixtureFailV2(
          "DARWIN_LOCK_FIXTURE_LIFECYCLE_INVALID",
          "Darwin lock fixture cannot assert an incomplete or released lock vector",
        );
      }
      assertPinnedPhysicalParentCurrentV2();
      for (const entry of held) {
        entry.lease.assertCurrent();
        if (
          pinnedParentIdentity === undefined ||
          entry.lease.parentPhysicalIdentity.device !== pinnedParentIdentity.device ||
          entry.lease.parentPhysicalIdentity.inode !== pinnedParentIdentity.inode
        ) {
          return fixtureFailV2(
            "DARWIN_LOCK_FIXTURE_ACQUISITION_FAILED",
            "Darwin lock fixture held lease escaped the pinned physical parent",
          );
        }
      }
    },
    async releaseAll(): Promise<void> {
      if (acquisitionInFlight) {
        return fixtureFailV2(
          "DARWIN_LOCK_FIXTURE_LIFECYCLE_INVALID",
          "Darwin lock fixture cannot release during an in-flight acquisition",
        );
      }
      if (lifecycle === "released") return;
      if (lifecycle === "failed") {
        return fixtureFailV2(
          "DARWIN_LOCK_FIXTURE_LIFECYCLE_INVALID",
          "Failed Darwin lock fixture session already released its held leases",
        );
      }
      const releaseErrors = [
        ...(await releaseHeldV2()),
        ...closePinnedParentV2(),
      ];
      lifecycle = "released";
      zeroBoundaryBytesV2();
      if (releaseErrors.length > 0) {
        return fixtureFailV2(
          "DARWIN_LOCK_FIXTURE_RELEASE_FAILED",
          "Darwin lock fixture failed to release its leases in reverse order",
          new AggregateError(releaseErrors),
        );
      }
    },
  };
  return Object.freeze(session);
}
