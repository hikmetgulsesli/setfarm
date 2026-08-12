import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  closeSync,
  constants as fsConstants,
  fstatSync,
  lstatSync,
  openSync,
  opendirSync,
  readSync,
  type BigIntStats,
} from "node:fs";
import path from "node:path";

import { z } from "zod";

import {
  canonicalJsonStringify,
  hashCanonicalJson,
} from "./canonical-json.js";
import {
  defaultNodeToolchainProvisionerHostIdentityHashV3,
} from "./node-toolchain-provisioner-physical-census-v3.js";
import {
  bindPlatformReleaseCandidateEnvelopeV2,
  parsePlatformReleaseBuildAttestationCandidateV2,
  type PlatformReleaseBuildAttestationV2,
} from "../execution/schemas/platform-release-build-attestation-v2.js";
import {
  boundedPlatformReleaseJsonSnapshotV2,
  deepFreezePlatformReleaseJsonV2,
  platformReleaseCandidateFitsCanonicalCapV2,
} from "../execution/schemas/platform-release-common-v2.js";
import {
  PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_MAX_ATTESTATIONS_V3,
  PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_MAX_FILE_BYTES_V3,
  PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_MAX_RELEASES_V3,
  PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_MAX_TOTAL_CONTENT_BYTES_V3,
  PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_V3_VERSION,
  PlatformReleaseContentStoreGlobalCensusV3Schema,
  PlatformReleaseContentStoreStableIdentityV3Schema,
  assertPlatformReleaseContentStoreAppendOnlySupersetV3,
  buildPlatformReleaseContentStoreDirectoryMembershipFingerprintV3,
  buildPlatformReleaseContentStoreGlobalCensusV3,
  buildPlatformReleaseContentStoreObservationV3,
  type PlatformReleaseContentStoreAttestationCensusEntryV3,
  type PlatformReleaseContentStoreGlobalCensusV3,
  type PlatformReleaseContentStoreObservationV3,
  type PlatformReleaseContentStoreReleaseCensusEntryV3,
  type PlatformReleaseContentStoreStableIdentityV3,
} from "../execution/schemas/platform-release-content-store-census-v3.js";
import {
  PLATFORM_RELEASE_CONTENT_STORE_TEST_V3_PRODUCTION_BLOCKERS,
  PlatformReleaseContentStoreLeafReceiptTestV3Schema,
  parsePlatformReleaseContentStoreLeafReceiptTestCandidateV3,
  type PlatformReleaseContentStoreLeafReceiptTestV3,
} from "../execution/schemas/platform-release-content-store-test-v3.js";
import {
  parsePlatformReleaseManifestCandidateV2,
  type PlatformReleaseManifestV2,
} from "../execution/schemas/platform-release-manifest-v2.js";
import { Sha256Schema } from "./schemas/common-v1.js";

/**
 * Test-only observer for a quiescent durable content-store fixture. The caller
 * owns the already-open root descriptor. This module never publishes, mutates,
 * signs, leases, or upgrades the observed store to production authority.
 */
export const PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_REJOIN_TEST_V3_SCHEMA =
  "setfarm.platform-release-content-store-global-census-rejoin-test.v3" as const;
export const PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_REJOIN_TEST_HASH_V3_SCHEMA =
  "setfarm.platform-release-content-store-global-census-rejoin-test-hash.v3" as const;
export const PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_DESCRIPTOR_CAPABILITY_TEST_V3 =
  "numeric_inherited_directory_descriptor_test_fixture_v3" as const;
export const PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_REJOIN_TEST_MAX_CANONICAL_BYTES_V3 =
  48 * 1024 * 1024;

const O_CLOEXEC_V3 = (
  fsConstants as typeof fsConstants & Readonly<{ O_CLOEXEC?: number }>
).O_CLOEXEC ?? 0;

export const PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_REJOIN_TEST_V3_PRODUCTION_BLOCKERS =
  Object.freeze([...PLATFORM_RELEASE_CONTENT_STORE_TEST_V3_PRODUCTION_BLOCKERS] as const);

const ProductionBlockersV3Schema = z.tuple([
  z.literal(PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_REJOIN_TEST_V3_PRODUCTION_BLOCKERS[0]),
  z.literal(PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_REJOIN_TEST_V3_PRODUCTION_BLOCKERS[1]),
  z.literal(PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_REJOIN_TEST_V3_PRODUCTION_BLOCKERS[2]),
  z.literal(PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_REJOIN_TEST_V3_PRODUCTION_BLOCKERS[3]),
  z.literal(PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_REJOIN_TEST_V3_PRODUCTION_BLOCKERS[4]),
  z.literal(PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_REJOIN_TEST_V3_PRODUCTION_BLOCKERS[5]),
  z.literal(PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_REJOIN_TEST_V3_PRODUCTION_BLOCKERS[6]),
  z.literal(PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_REJOIN_TEST_V3_PRODUCTION_BLOCKERS[7]),
  z.literal(PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_REJOIN_TEST_V3_PRODUCTION_BLOCKERS[8]),
  z.literal(PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_REJOIN_TEST_V3_PRODUCTION_BLOCKERS[9]),
  z.literal(PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_REJOIN_TEST_V3_PRODUCTION_BLOCKERS[10]),
  z.literal(PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_REJOIN_TEST_V3_PRODUCTION_BLOCKERS[11]),
  z.literal(PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_REJOIN_TEST_V3_PRODUCTION_BLOCKERS[12]),
  z.literal(PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_REJOIN_TEST_V3_PRODUCTION_BLOCKERS[13]),
]);

const RejoinIdentityV3Schema = z.object({
  schema: z.literal(
    PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_REJOIN_TEST_V3_SCHEMA,
  ),
  version: z.literal(PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_V3_VERSION),
  admissionScope: z.literal("test_fixture"),
  authorityState: z.literal(
    "descriptor_anchored_durable_store_rejoin_test_fixture_unverified",
  ),
  productionAuthority: z.literal(false),
  productionAdmission: z.literal("forbidden"),
  credentialUse: z.literal("none"),
  signingAuthority: z.literal("unsigned_test_fixture"),
  mutationAuthority: z.literal(false),
  trustConclusion: z.literal("characterization_only"),
  operationMode: z.literal("descriptor_anchored_read_only_census_rejoin_test"),
  descriptorCapability: z.literal(
    PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_DESCRIPTOR_CAPABILITY_TEST_V3,
  ),
  descriptorAnchor: z.enum([
    "darwin_f_getpath_joined_to_inherited_fd",
    "linux_proc_self_fd",
  ]),
  rootDescriptorNumber: z.number().int().nonnegative().safe(),
  productionBlockers: ProductionBlockersV3Schema,
  rootStableIdentity: PlatformReleaseContentStoreStableIdentityV3Schema,
  publishedLeafReceipt: PlatformReleaseContentStoreLeafReceiptTestV3Schema,
  publishedLeafReceiptHash: Sha256Schema,
  publishedCensusHash: Sha256Schema,
  currentCensus: PlatformReleaseContentStoreGlobalCensusV3Schema,
  currentCensusHash: Sha256Schema,
}).strict();

export type PlatformReleaseContentStoreGlobalCensusRejoinTestHashPayloadV3 =
  z.infer<typeof RejoinIdentityV3Schema>;

export function hashPlatformReleaseContentStoreGlobalCensusRejoinTestV3(
  value: PlatformReleaseContentStoreGlobalCensusRejoinTestHashPayloadV3,
): string {
  return hashCanonicalJson({
    schema:
      PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_REJOIN_TEST_HASH_V3_SCHEMA,
    rejoin: value,
  });
}

export const PlatformReleaseContentStoreGlobalCensusRejoinTestV3Schema =
  RejoinIdentityV3Schema.extend({
    rejoinHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const { rejoinHash: _rejoinHash, ...identity } = value;
    if (
      value.rejoinHash
        !== hashPlatformReleaseContentStoreGlobalCensusRejoinTestV3(identity)
    ) {
      context.addIssue({
        code: "custom",
        path: ["rejoinHash"],
        message: "Descriptor-anchored content-store rejoin hash mismatch",
      });
    }
    if (
      value.publishedLeafReceiptHash
        !== value.publishedLeafReceipt.receiptHash
      || value.publishedCensusHash
        !== value.publishedLeafReceipt.publishedCensus.censusHash
      || value.currentCensusHash !== value.currentCensus.censusHash
    ) {
      context.addIssue({
        code: "custom",
        path: ["publishedLeafReceiptHash"],
        message: "Rejoin receipt must bind its complete leaf receipt and censuses",
      });
    }
    if (
      canonicalJsonStringify(value.rootStableIdentity)
        !== canonicalJsonStringify(
          value.currentCensus.persistentAnchors.storeRoot.stableIdentity,
        )
    ) {
      context.addIssue({
        code: "custom",
        path: ["rootStableIdentity"],
        message: "Rejoin root identity must equal the observed descriptor root",
      });
    }
    try {
      assertPlatformReleaseContentStoreAppendOnlySupersetV3(
        value.publishedLeafReceipt.publishedCensus,
        value.currentCensus,
      );
    } catch {
      context.addIssue({
        code: "custom",
        path: ["currentCensus"],
        message: "Rejoined census must be an append-only published-census superset",
      });
    }
    if (
      !platformReleaseCandidateFitsCanonicalCapV2(
        value,
        PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_REJOIN_TEST_MAX_CANONICAL_BYTES_V3,
      )
    ) {
      context.addIssue({
        code: "custom",
        message: "Descriptor-anchored rejoin receipt exceeds its canonical byte cap",
      });
    }
  });

export type PlatformReleaseContentStoreGlobalCensusRejoinTestV3 = z.infer<
  typeof PlatformReleaseContentStoreGlobalCensusRejoinTestV3Schema
>;

export type PlatformReleaseContentStoreGlobalCensusTestErrorCodeV3 =
  | "CONTENT_STORE_GLOBAL_CENSUS_TEST_PLATFORM_UNAVAILABLE"
  | "CONTENT_STORE_GLOBAL_CENSUS_TEST_DESCRIPTOR_INVALID"
  | "CONTENT_STORE_GLOBAL_CENSUS_TEST_LAYOUT_INVALID"
  | "CONTENT_STORE_GLOBAL_CENSUS_TEST_CONTENT_INVALID"
  | "CONTENT_STORE_GLOBAL_CENSUS_TEST_DRIFT"
  | "CONTENT_STORE_GLOBAL_CENSUS_TEST_RECEIPT_INVALID";

export class PlatformReleaseContentStoreGlobalCensusTestErrorV3
  extends TypeError {
  constructor(
    readonly code: PlatformReleaseContentStoreGlobalCensusTestErrorCodeV3,
    message: string,
    options: ErrorOptions = {},
  ) {
    super(`${code}: ${message}`.slice(0, 2_000), options);
    this.name = "PlatformReleaseContentStoreGlobalCensusTestErrorV3";
  }
}

function failV3(
  code: PlatformReleaseContentStoreGlobalCensusTestErrorCodeV3,
  message: string,
  cause?: unknown,
): never {
  throw new PlatformReleaseContentStoreGlobalCensusTestErrorV3(
    code,
    message,
    cause === undefined ? {} : { cause },
  );
}

function descriptorAnchorV3(rootDescriptor: number): Readonly<{
  anchor: string;
  kind:
    | "darwin_f_getpath_joined_to_inherited_fd"
    | "linux_proc_self_fd";
}> {
  if (!Number.isSafeInteger(rootDescriptor) || rootDescriptor < 0) {
    return failV3(
      "CONTENT_STORE_GLOBAL_CENSUS_TEST_DESCRIPTOR_INVALID",
      "Root capability must be one already-open non-negative numeric descriptor",
    );
  }
  if (process.platform === "darwin") {
    const script = [
      "import fcntl,sys",
      "value=fcntl.fcntl(3, fcntl.F_GETPATH, bytes(1024))",
      "sys.stdout.buffer.write(value.split(bytes(1),1)[0])",
    ].join("\n");
    const resolved = spawnSync(
      "/usr/bin/python3",
      ["-I", "-c", script],
      {
        encoding: "utf8",
        env: {},
        maxBuffer: 4_096,
        stdio: ["ignore", "pipe", "pipe", rootDescriptor],
        timeout: 5_000,
      },
    );
    const anchor = resolved.stdout;
    if (
      resolved.status !== 0
      || resolved.signal !== null
      || resolved.error !== undefined
      || typeof anchor !== "string"
      || !path.isAbsolute(anchor)
      || anchor.length < 2
      || anchor.length > 1_023
      || anchor.includes("\0")
      || anchor.includes("\n")
      || path.normalize(anchor) !== anchor
    ) {
      return failV3(
        "CONTENT_STORE_GLOBAL_CENSUS_TEST_DESCRIPTOR_INVALID",
        "Darwin F_GETPATH could not resolve the inherited /dev/fd capability",
        resolved.error ?? resolved.stderr,
      );
    }
    let descriptorStatus: BigIntStats;
    let pathStatus: BigIntStats;
    try {
      descriptorStatus = fstatSync(rootDescriptor, { bigint: true });
      pathStatus = lstatSync(anchor, { bigint: true });
    } catch (error) {
      return failV3(
        "CONTENT_STORE_GLOBAL_CENSUS_TEST_DESCRIPTOR_INVALID",
        "Darwin descriptor path could not be admitted",
        error,
      );
    }
    if (!sameStatusV3(descriptorStatus, pathStatus)) {
      return failV3(
        "CONTENT_STORE_GLOBAL_CENSUS_TEST_DRIFT",
        "Darwin F_GETPATH result does not identify the inherited root descriptor",
      );
    }
    return Object.freeze({
      anchor,
      kind: "darwin_f_getpath_joined_to_inherited_fd",
    });
  }
  if (process.platform === "linux") {
    return Object.freeze({
      anchor: `/proc/self/fd/${rootDescriptor}`,
      kind: "linux_proc_self_fd",
    });
  }
  return failV3(
    "CONTENT_STORE_GLOBAL_CENSUS_TEST_PLATFORM_UNAVAILABLE",
    "Descriptor-anchored census characterization supports only Darwin and Linux",
  );
}

function currentOwnerV3(): Readonly<{ ownerUid: number; ownerGid: number }> {
  if (process.getuid === undefined || process.getgid === undefined) {
    return failV3(
      "CONTENT_STORE_GLOBAL_CENSUS_TEST_PLATFORM_UNAVAILABLE",
      "Descriptor-anchored census requires POSIX process ownership",
    );
  }
  return Object.freeze({
    ownerUid: process.getuid(),
    ownerGid: process.getgid(),
  });
}

function modeTextV3(status: BigIntStats): string {
  return Number(status.mode & 0o7777n).toString(8).padStart(4, "0");
}

function sameStatusV3(left: BigIntStats, right: BigIntStats): boolean {
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

function exactSortedNamesV3(
  absolutePath: string,
  maximum: number,
): string[] {
  let directory: ReturnType<typeof opendirSync> | undefined;
  let failure: unknown;
  const names: string[] = [];
  try {
    directory = opendirSync(absolutePath);
    while (true) {
      const entry = directory.readSync();
      if (entry === null) break;
      names.push(entry.name);
      if (names.length > maximum) {
        return failV3(
          "CONTENT_STORE_GLOBAL_CENSUS_TEST_LAYOUT_INVALID",
          `Directory ${absolutePath} exceeds its bounded member count`,
        );
      }
    }
  } catch (error) {
    failure = error;
  }
  try {
    directory?.closeSync();
  } catch (error) {
    failure ??= error;
  }
  if (failure instanceof PlatformReleaseContentStoreGlobalCensusTestErrorV3) {
    throw failure;
  }
  if (failure !== undefined) {
    return failV3(
      "CONTENT_STORE_GLOBAL_CENSUS_TEST_LAYOUT_INVALID",
      `Directory ${absolutePath} cannot be read through its descriptor anchor`,
      failure,
    );
  }
  return names.sort();
}

function assertExactNamesV3(
  actual: readonly string[],
  expected: readonly string[],
  label: string,
): void {
  if (canonicalJsonStringify(actual) !== canonicalJsonStringify(expected)) {
    return failV3(
      "CONTENT_STORE_GLOBAL_CENSUS_TEST_LAYOUT_INVALID",
      `${label} has unexpected or missing members`,
    );
  }
}

function assertOwnedObjectV3(
  status: BigIntStats,
  expectedKind: "directory" | "ordinary_file",
  expectedMode: "0700" | "0555" | "0444",
  owner: Readonly<{ ownerUid: number; ownerGid: number }>,
  label: string,
): void {
  const kindMatches = expectedKind === "directory"
    ? status.isDirectory()
    : status.isFile();
  if (
    status.isSymbolicLink()
    || !kindMatches
    || status.uid !== BigInt(owner.ownerUid)
    || status.gid !== BigInt(owner.ownerGid)
    || modeTextV3(status) !== expectedMode
  ) {
    return failV3(
      "CONTENT_STORE_GLOBAL_CENSUS_TEST_LAYOUT_INVALID",
      `${label} violates its exact kind, owner, or mode policy`,
    );
  }
}

function observationFromStatusV3(
  status: BigIntStats,
  hostIdentityHash: string,
  objectKind: "directory" | "ordinary_file",
  contentHash: string,
  byteLength: number,
): PlatformReleaseContentStoreObservationV3 {
  return buildPlatformReleaseContentStoreObservationV3({
    stableIdentity: {
      hostIdentityHash,
      objectKind,
      device: status.dev.toString(10),
      inode: status.ino.toString(10),
    },
    mutableFingerprint: {
      ownerUid: Number(status.uid),
      ownerGid: Number(status.gid),
      mode: modeTextV3(status),
      linkCount: Number(status.nlink),
      byteLength,
      contentHash,
      modifiedTimeNanoseconds: status.mtimeNs.toString(10),
      changedTimeNanoseconds: status.ctimeNs.toString(10),
    },
  });
}

type DirectoryRoleV3 = Parameters<
  typeof buildPlatformReleaseContentStoreDirectoryMembershipFingerprintV3
>[0];

function captureRootDirectoryV3(
  rootDescriptor: number,
  rootAnchor: string,
  hostIdentityHash: string,
  owner: Readonly<{ ownerUid: number; ownerGid: number }>,
): PlatformReleaseContentStoreObservationV3 {
  const expected = [".locks", ".staging", "attestations", "releases"];
  const before = fstatSync(rootDescriptor, { bigint: true });
  assertOwnedObjectV3(before, "directory", "0700", owner, "Store root descriptor");
  const names = exactSortedNamesV3(rootAnchor, expected.length);
  assertExactNamesV3(names, expected, "Store root descriptor");
  const after = fstatSync(rootDescriptor, { bigint: true });
  if (!sameStatusV3(before, after)) {
    return failV3(
      "CONTENT_STORE_GLOBAL_CENSUS_TEST_DRIFT",
      "Store root changed during its descriptor-anchored observation",
    );
  }
  const membership =
    buildPlatformReleaseContentStoreDirectoryMembershipFingerprintV3(
      "store_root",
      names,
    );
  return observationFromStatusV3(
    after,
    hostIdentityHash,
    "directory",
    membership.contentHash,
    membership.byteLength,
  );
}

function captureDirectoryV3(
  absolutePath: string,
  role: DirectoryRoleV3,
  expectedMode: "0700" | "0555",
  expectedNames: readonly string[],
  hostIdentityHash: string,
  owner: Readonly<{ ownerUid: number; ownerGid: number }>,
): PlatformReleaseContentStoreObservationV3 {
  let descriptor = -1;
  try {
    const pathBefore = lstatSync(absolutePath, { bigint: true });
    assertOwnedObjectV3(
      pathBefore,
      "directory",
      expectedMode,
      owner,
      absolutePath,
    );
    descriptor = openSync(
      absolutePath,
      fsConstants.O_RDONLY
        | (fsConstants.O_DIRECTORY ?? 0)
        | (fsConstants.O_NOFOLLOW ?? 0)
        | O_CLOEXEC_V3,
    );
    const descriptorBefore = fstatSync(descriptor, { bigint: true });
    if (!sameStatusV3(pathBefore, descriptorBefore)) {
      return failV3(
        "CONTENT_STORE_GLOBAL_CENSUS_TEST_DRIFT",
        `Directory ${absolutePath} changed during descriptor admission`,
      );
    }
    const names = exactSortedNamesV3(absolutePath, expectedNames.length);
    assertExactNamesV3(names, expectedNames, `Directory ${absolutePath}`);
    const descriptorAfter = fstatSync(descriptor, { bigint: true });
    const pathAfter = lstatSync(absolutePath, { bigint: true });
    if (
      !sameStatusV3(descriptorBefore, descriptorAfter)
      || !sameStatusV3(descriptorAfter, pathAfter)
    ) {
      return failV3(
        "CONTENT_STORE_GLOBAL_CENSUS_TEST_DRIFT",
        `Directory ${absolutePath} changed during its bounded observation`,
      );
    }
    const membership =
      buildPlatformReleaseContentStoreDirectoryMembershipFingerprintV3(
        role,
        names,
      );
    return observationFromStatusV3(
      descriptorAfter,
      hostIdentityHash,
      "directory",
      membership.contentHash,
      membership.byteLength,
    );
  } catch (error) {
    if (error instanceof PlatformReleaseContentStoreGlobalCensusTestErrorV3) {
      throw error;
    }
    return failV3(
      "CONTENT_STORE_GLOBAL_CENSUS_TEST_LAYOUT_INVALID",
      `Could not capture directory ${absolutePath}`,
      error,
    );
  } finally {
    if (descriptor >= 0) closeSync(descriptor);
  }
}

type CapturedFileV3<T> = Readonly<{
  value: T;
  observation: PlatformReleaseContentStoreObservationV3;
}>;

type RemainingContentByteBudgetV3 = {
  remainingBytes: bigint;
};

function createContentByteBudgetV3(): RemainingContentByteBudgetV3 {
  return {
    remainingBytes: BigInt(
      PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_MAX_TOTAL_CONTENT_BYTES_V3,
    ),
  };
}

function reserveContentBytesV3(
  budget: RemainingContentByteBudgetV3,
  byteLength: bigint,
  label: string,
): void {
  if (byteLength > budget.remainingBytes) {
    return failV3(
      "CONTENT_STORE_GLOBAL_CENSUS_TEST_CONTENT_INVALID",
      `${label} exceeds the aggregate content byte budget`,
    );
  }
  budget.remainingBytes -= byteLength;
}

/** Regression hook for the same exact-size reservation used after file fstat. */
export function assertPlatformReleaseContentStoreGlobalCensusContentFileSizesForTestV3(
  fileByteLengths: readonly number[],
): void {
  const budget = createContentByteBudgetV3();
  for (const [index, byteLength] of fileByteLengths.entries()) {
    if (
      !Number.isSafeInteger(byteLength)
      || byteLength < 1
      || byteLength
        > PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_MAX_FILE_BYTES_V3
    ) {
      return failV3(
        "CONTENT_STORE_GLOBAL_CENSUS_TEST_CONTENT_INVALID",
        `Test content file ${index} is not one bounded leaf size`,
      );
    }
    reserveContentBytesV3(
      budget,
      BigInt(byteLength),
      `Test content file ${index}`,
    );
  }
}

function captureCanonicalFileV3<T>(
  absolutePath: string,
  hostIdentityHash: string,
  owner: Readonly<{ ownerUid: number; ownerGid: number }>,
  contentByteBudget: RemainingContentByteBudgetV3,
  parser: (input: unknown) => T,
): CapturedFileV3<T> {
  let descriptor = -1;
  let bytes: Buffer | undefined;
  try {
    const pathBefore = lstatSync(absolutePath, { bigint: true });
    assertOwnedObjectV3(
      pathBefore,
      "ordinary_file",
      "0444",
      owner,
      absolutePath,
    );
    if (
      pathBefore.nlink !== 1n
      || pathBefore.size < 1n
      || pathBefore.size
        > BigInt(PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_MAX_FILE_BYTES_V3)
    ) {
      return failV3(
        "CONTENT_STORE_GLOBAL_CENSUS_TEST_CONTENT_INVALID",
        `File ${absolutePath} is not one bounded single-link leaf`,
      );
    }
    descriptor = openSync(
      absolutePath,
      fsConstants.O_RDONLY
        | (fsConstants.O_NOFOLLOW ?? 0)
        | O_CLOEXEC_V3,
    );
    const descriptorBefore = fstatSync(descriptor, { bigint: true });
    if (!sameStatusV3(pathBefore, descriptorBefore)) {
      return failV3(
        "CONTENT_STORE_GLOBAL_CENSUS_TEST_DRIFT",
        `File ${absolutePath} changed during descriptor admission`,
      );
    }
    if (
      descriptorBefore.nlink !== 1n
      || descriptorBefore.size < 1n
      || descriptorBefore.size
        > BigInt(PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_MAX_FILE_BYTES_V3)
    ) {
      return failV3(
        "CONTENT_STORE_GLOBAL_CENSUS_TEST_CONTENT_INVALID",
        `File ${absolutePath} is not one bounded single-link descriptor leaf`,
      );
    }
    reserveContentBytesV3(
      contentByteBudget,
      descriptorBefore.size,
      `File ${absolutePath}`,
    );
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
        return failV3(
          "CONTENT_STORE_GLOBAL_CENSUS_TEST_DRIFT",
          `File ${absolutePath} reached EOF before its descriptor length`,
        );
      }
      offset += count;
    }
    const eof = Buffer.alloc(1);
    const grew = readSync(descriptor, eof, 0, 1, byteLength) !== 0;
    eof.fill(0);
    if (grew) {
      return failV3(
        "CONTENT_STORE_GLOBAL_CENSUS_TEST_DRIFT",
        `File ${absolutePath} grew during its bounded read`,
      );
    }
    let candidate: unknown;
    try {
      candidate = JSON.parse(bytes.toString("utf8"));
    } catch (error) {
      return failV3(
        "CONTENT_STORE_GLOBAL_CENSUS_TEST_CONTENT_INVALID",
        `File ${absolutePath} is not strict JSON`,
        error,
      );
    }
    let value: T;
    try {
      value = parser(candidate);
    } catch (error) {
      return failV3(
        "CONTENT_STORE_GLOBAL_CENSUS_TEST_CONTENT_INVALID",
        `File ${absolutePath} violates its strict content schema`,
        error,
      );
    }
    const canonicalBytes = Buffer.from(canonicalJsonStringify(value), "utf8");
    if (!canonicalBytes.equals(bytes)) {
      canonicalBytes.fill(0);
      return failV3(
        "CONTENT_STORE_GLOBAL_CENSUS_TEST_CONTENT_INVALID",
        `File ${absolutePath} is not exact canonical JSON`,
      );
    }
    canonicalBytes.fill(0);
    const descriptorAfter = fstatSync(descriptor, { bigint: true });
    const pathAfter = lstatSync(absolutePath, { bigint: true });
    if (
      !sameStatusV3(descriptorBefore, descriptorAfter)
      || !sameStatusV3(descriptorAfter, pathAfter)
    ) {
      return failV3(
        "CONTENT_STORE_GLOBAL_CENSUS_TEST_DRIFT",
        `File ${absolutePath} changed during its bounded observation`,
      );
    }
    return Object.freeze({
      value,
      observation: observationFromStatusV3(
        descriptorAfter,
        hostIdentityHash,
        "ordinary_file",
        createHash("sha256").update(bytes).digest("hex"),
        byteLength,
      ),
    });
  } catch (error) {
    if (error instanceof PlatformReleaseContentStoreGlobalCensusTestErrorV3) {
      throw error;
    }
    return failV3(
      "CONTENT_STORE_GLOBAL_CENSUS_TEST_CONTENT_INVALID",
      `Could not capture file ${absolutePath}`,
      error,
    );
  } finally {
    bytes?.fill(0);
    if (descriptor >= 0) closeSync(descriptor);
  }
}

function assertSha256NameV3(value: string, suffix = ""): void {
  const pattern = suffix === ".json"
    ? /^[a-f0-9]{64}\.json$/u
    : /^[a-f0-9]{64}$/u;
  if (!pattern.test(value)) {
    return failV3(
      "CONTENT_STORE_GLOBAL_CENSUS_TEST_LAYOUT_INVALID",
      `Content-store member ${value} is not one canonical hash basename`,
    );
  }
}

function captureOneCensusPassV3(
  rootDescriptor: number,
): PlatformReleaseContentStoreGlobalCensusV3 {
  const descriptor = descriptorAnchorV3(rootDescriptor);
  const owner = currentOwnerV3();
  let rootBefore: BigIntStats;
  try {
    rootBefore = fstatSync(rootDescriptor, { bigint: true });
  } catch (error) {
    return failV3(
      "CONTENT_STORE_GLOBAL_CENSUS_TEST_DESCRIPTOR_INVALID",
      "Root descriptor is not open",
      error,
    );
  }
  assertOwnedObjectV3(
    rootBefore,
    "directory",
    "0700",
    owner,
    "Store root descriptor",
  );
  const hostIdentityHash = defaultNodeToolchainProvisionerHostIdentityHashV3();
  const contentByteBudget = createContentByteBudgetV3();
  const releasesPath = path.join(descriptor.anchor, "releases");
  const attestationsPath = path.join(descriptor.anchor, "attestations");
  const releaseNames = exactSortedNamesV3(
    releasesPath,
    PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_MAX_RELEASES_V3,
  );
  const attestationNames = exactSortedNamesV3(
    attestationsPath,
    PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_MAX_ATTESTATIONS_V3,
  );
  for (const name of releaseNames) assertSha256NameV3(name);
  for (const name of attestationNames) assertSha256NameV3(name, ".json");

  const releaseEntries: PlatformReleaseContentStoreReleaseCensusEntryV3[] = [];
  const manifestsByReleaseHash = new Map<string, PlatformReleaseManifestV2>();
  for (const releaseName of releaseNames) {
    const releasePath = path.join(releasesPath, releaseName);
    const releaseRoot = captureDirectoryV3(
      releasePath,
      "release_root",
      "0555",
      ["manifest.json"],
      hostIdentityHash,
      owner,
    );
    const manifest = captureCanonicalFileV3<PlatformReleaseManifestV2>(
      path.join(releasePath, "manifest.json"),
      hostIdentityHash,
      owner,
      contentByteBudget,
      parsePlatformReleaseManifestCandidateV2,
    );
    if (manifest.value.manifestPayloadHash !== releaseName) {
      return failV3(
        "CONTENT_STORE_GLOBAL_CENSUS_TEST_CONTENT_INVALID",
        `Release basename ${releaseName} does not join its manifest payload hash`,
      );
    }
    releaseEntries.push({
      manifestPayloadHash: releaseName,
      releaseRoot,
      manifest: manifest.observation,
    });
    manifestsByReleaseHash.set(releaseName, manifest.value);
  }

  const attestationEntries:
    PlatformReleaseContentStoreAttestationCensusEntryV3[] = [];
  for (const attestationName of attestationNames) {
    const attestationHash = attestationName.slice(0, -".json".length);
    const attestation =
      captureCanonicalFileV3<PlatformReleaseBuildAttestationV2>(
        path.join(attestationsPath, attestationName),
        hostIdentityHash,
        owner,
        contentByteBudget,
        parsePlatformReleaseBuildAttestationCandidateV2,
      );
    if (
      attestation.value.attestationHash !== attestationHash
      || !releaseNames.includes(attestation.value.releaseContentHash)
    ) {
      return failV3(
        "CONTENT_STORE_GLOBAL_CENSUS_TEST_CONTENT_INVALID",
        `Attestation basename ${attestationName} does not join its hash and release`,
      );
    }
    const referencedManifest = manifestsByReleaseHash.get(
      attestation.value.releaseContentHash,
    )!;
    try {
      bindPlatformReleaseCandidateEnvelopeV2(
        referencedManifest,
        attestation.value,
      );
    } catch (error) {
      return failV3(
        "CONTENT_STORE_GLOBAL_CENSUS_TEST_CONTENT_INVALID",
        `Attestation ${attestationName} does not semantically join its manifest`,
        error,
      );
    }
    attestationEntries.push({
      attestationHash,
      releaseContentHash: attestation.value.releaseContentHash,
      attestation: attestation.observation,
    });
  }

  const persistentAnchors = {
    storeRoot: captureRootDirectoryV3(
      rootDescriptor,
      descriptor.anchor,
      hostIdentityHash,
      owner,
    ),
    locksRoot: captureDirectoryV3(
      path.join(descriptor.anchor, ".locks"),
      "locks_root",
      "0700",
      [],
      hostIdentityHash,
      owner,
    ),
    stagingRoot: captureDirectoryV3(
      path.join(descriptor.anchor, ".staging"),
      "staging_root",
      "0700",
      [],
      hostIdentityHash,
      owner,
    ),
    releasesRoot: captureDirectoryV3(
      releasesPath,
      "releases_root",
      "0700",
      releaseNames,
      hostIdentityHash,
      owner,
    ),
    attestationsRoot: captureDirectoryV3(
      attestationsPath,
      "attestations_root",
      "0700",
      attestationNames,
      hostIdentityHash,
      owner,
    ),
  };
  let rootAfter: BigIntStats;
  let darwinPathAfter: BigIntStats;
  try {
    rootAfter = fstatSync(rootDescriptor, { bigint: true });
    darwinPathAfter = descriptor.kind
        === "darwin_f_getpath_joined_to_inherited_fd"
      ? lstatSync(descriptor.anchor, { bigint: true })
      : rootAfter;
  } catch (error) {
    return failV3(
      "CONTENT_STORE_GLOBAL_CENSUS_TEST_DRIFT",
      "Store root descriptor or its Darwin F_GETPATH join disappeared",
      error,
    );
  }
  if (
    !sameStatusV3(rootBefore, rootAfter)
    || !sameStatusV3(rootAfter, darwinPathAfter)
  ) {
    return failV3(
      "CONTENT_STORE_GLOBAL_CENSUS_TEST_DRIFT",
      "Store root descriptor changed during one complete census pass",
    );
  }
  return buildPlatformReleaseContentStoreGlobalCensusV3({
    hostIdentityHash,
    persistentAnchors,
    releaseEntries,
    attestationEntries,
  });
}

export function capturePlatformReleaseContentStoreGlobalCensusFromDescriptorForTestV3(
  rootDescriptor: number,
): PlatformReleaseContentStoreGlobalCensusV3 {
  const first = captureOneCensusPassV3(rootDescriptor);
  const second = captureOneCensusPassV3(rootDescriptor);
  if (canonicalJsonStringify(first) !== canonicalJsonStringify(second)) {
    return failV3(
      "CONTENT_STORE_GLOBAL_CENSUS_TEST_DRIFT",
      "Two complete descriptor-anchored census passes did not reproduce exactly",
    );
  }
  return second;
}

export function parsePlatformReleaseContentStoreGlobalCensusRejoinTestCandidateV3(
  input: unknown,
): PlatformReleaseContentStoreGlobalCensusRejoinTestV3 {
  try {
    const snapshot = boundedPlatformReleaseJsonSnapshotV2(
      input,
      PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_REJOIN_TEST_MAX_CANONICAL_BYTES_V3,
    );
    return deepFreezePlatformReleaseJsonV2(
      PlatformReleaseContentStoreGlobalCensusRejoinTestV3Schema.parse(snapshot),
    );
  } catch (error) {
    if (error instanceof PlatformReleaseContentStoreGlobalCensusTestErrorV3) {
      throw error;
    }
    return failV3(
      "CONTENT_STORE_GLOBAL_CENSUS_TEST_RECEIPT_INVALID",
      "Descriptor-anchored rejoin receipt is invalid",
      error,
    );
  }
}

export function rejoinPlatformReleaseContentStoreGlobalCensusFromLeafReceiptForTestV3(
  rootDescriptor: number,
  publishedLeafReceiptInput: unknown,
): PlatformReleaseContentStoreGlobalCensusRejoinTestV3 {
  let publishedLeafReceipt: PlatformReleaseContentStoreLeafReceiptTestV3;
  try {
    publishedLeafReceipt =
      parsePlatformReleaseContentStoreLeafReceiptTestCandidateV3(
        publishedLeafReceiptInput,
      );
  } catch (error) {
    return failV3(
      "CONTENT_STORE_GLOBAL_CENSUS_TEST_RECEIPT_INVALID",
      "Rejoin requires one complete serialized V3 leaf receipt",
      error,
    );
  }
  const descriptor = descriptorAnchorV3(rootDescriptor);
  const currentCensus =
    capturePlatformReleaseContentStoreGlobalCensusFromDescriptorForTestV3(
      rootDescriptor,
    );
  try {
    assertPlatformReleaseContentStoreAppendOnlySupersetV3(
      publishedLeafReceipt.publishedCensus,
      currentCensus,
    );
  } catch (error) {
    return failV3(
      "CONTENT_STORE_GLOBAL_CENSUS_TEST_RECEIPT_INVALID",
      "Current descriptor census is not an append-only published-census superset",
      error,
    );
  }
  const identity: PlatformReleaseContentStoreGlobalCensusRejoinTestHashPayloadV3 = {
    schema: PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_REJOIN_TEST_V3_SCHEMA,
    version: PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_V3_VERSION,
    admissionScope: "test_fixture",
    authorityState:
      "descriptor_anchored_durable_store_rejoin_test_fixture_unverified",
    productionAuthority: false,
    productionAdmission: "forbidden",
    credentialUse: "none",
    signingAuthority: "unsigned_test_fixture",
    mutationAuthority: false,
    trustConclusion: "characterization_only",
    operationMode: "descriptor_anchored_read_only_census_rejoin_test",
    descriptorCapability:
      PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_DESCRIPTOR_CAPABILITY_TEST_V3,
    descriptorAnchor: descriptor.kind,
    rootDescriptorNumber: rootDescriptor,
    productionBlockers: [
      ...PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_REJOIN_TEST_V3_PRODUCTION_BLOCKERS,
    ],
    rootStableIdentity:
      currentCensus.persistentAnchors.storeRoot.stableIdentity,
    publishedLeafReceipt,
    publishedLeafReceiptHash: publishedLeafReceipt.receiptHash,
    publishedCensusHash: publishedLeafReceipt.publishedCensus.censusHash,
    currentCensus,
    currentCensusHash: currentCensus.censusHash,
  };
  return parsePlatformReleaseContentStoreGlobalCensusRejoinTestCandidateV3({
    ...identity,
    rejoinHash:
      hashPlatformReleaseContentStoreGlobalCensusRejoinTestV3(identity),
  });
}
