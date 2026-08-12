import { createHash } from "node:crypto";
import {
  constants,
  type BigIntStats,
} from "node:fs";
import { lstat, open, readdir, realpath, type FileHandle } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2,
} from "../execution/schemas/platform-release-bootstrap-contract-v2.js";
import {
  PLATFORM_RELEASE_COMPONENT_VERSION_V2,
  boundedPlatformReleaseJsonSnapshotV2,
  deepFreezePlatformReleaseJsonV2,
} from "../execution/schemas/platform-release-common-v2.js";
import {
  buildFsObservationFingerprintV2,
  buildStableFsObjectIdentityV2,
  parseBootstrapFilesystemScopeIdentityCandidateV2,
  parseStableFsObjectIdentityCandidateV2,
  type BootstrapFilesystemScopeIdentityV2,
  type FsObservationFingerprintV2,
  type StableFsObjectIdentityV2,
} from "./platform-release-bootstrap-physical-census-v2.js";
import { canonicalJsonBytes, canonicalJsonStringify, hashCanonicalJson } from "./canonical-json.js";

/**
 * This module is deliberately a test-support mechanics boundary.  It proves
 * that a claim can bind preallocated member inodes before any payload bytes
 * are written; it is not a production registry driver or cleanup authority.
 */
export const PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_ACTIVATION_CLAIM_FIRST_FIXTURE_SCOPE_V2 =
  "claim_first_preallocated_member_fixture_never_production_authority_v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_ACTIVATION_CLAIM_FIRST_FIXTURE_SCHEMA_V2 =
  "setfarm.platform-release-bootstrap-registry-activation-claim-first-fixture.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_ACTIVATION_CLAIM_FIRST_FIXTURE_MAX_BYTES_V2 =
  128 * 1024;
const MAX_MEMBER_BYTES_V2 = 65_536;
const MAX_CLAIM_BYTES_V2 =
  PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_ACTIVATION_CLAIM_FIRST_FIXTURE_MAX_BYTES_V2;
const PRIVATE_FIXTURE_ROOT_PREFIX_V2 = "setfarm-claim-first-v2-";
const DURABILITY_EVIDENCE_V2 =
  "filehandle_sync_return_observed_power_loss_unproven" as const;
const CLAIM_BASENAME_V2 =
  PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.registry.activationClaimBasename;
const MEMBER_BASENAMES_V2 = Object.freeze([
  "staged_activation_receipt",
  "staged_genesis_epoch_state",
  "staged_shared_lock",
] as const);

export type PlatformReleaseBootstrapActivationClaimFirstMemberKindV2 =
  (typeof MEMBER_BASENAMES_V2)[number];

export const PlatformReleaseBootstrapActivationClaimFirstCheckpointV2 =
  Object.freeze({
    afterSkeletonDirectorySync: "after_claim_first_skeleton_directory_sync",
    duringClaimWrite: "during_claim_first_claim_write",
    afterClaimFileSync: "after_claim_first_claim_file_sync",
    afterClaimDirectorySync: "after_claim_first_claim_directory_sync",
    duringMemberWrite: "during_claim_first_member_write",
    afterMemberFileSync: "after_claim_first_member_file_sync",
    afterMemberDirectorySync: "after_claim_first_member_directory_sync",
  } as const);

export type PlatformReleaseBootstrapActivationClaimFirstCheckpointV2 =
  (typeof PlatformReleaseBootstrapActivationClaimFirstCheckpointV2)[keyof typeof PlatformReleaseBootstrapActivationClaimFirstCheckpointV2];

export type PlatformReleaseBootstrapActivationClaimFirstCheckpointHookV2 = (
  checkpoint: PlatformReleaseBootstrapActivationClaimFirstCheckpointV2,
  context: Readonly<{
    basename: string;
    offset: number;
    totalBytes: number;
    path: string;
  }>,
) => void | Promise<void>;

export type PlatformReleaseBootstrapActivationClaimFirstMemberInputV2 =
  Readonly<{
    memberKind: PlatformReleaseBootstrapActivationClaimFirstMemberKindV2;
    bytes: Uint8Array;
  }>;

export type PlatformReleaseBootstrapActivationClaimFirstFixtureInputV2 =
  Readonly<{
    filesystemScope: BootstrapFilesystemScopeIdentityV2;
    namespaceParentPath: string;
    stagingDirectoryPath: string;
    transactionIdentityHash: string;
    claimDocument: Readonly<Record<string, unknown>>;
    members: readonly PlatformReleaseBootstrapActivationClaimFirstMemberInputV2[];
  }>;

export type PlatformReleaseBootstrapActivationClaimFirstMemberObservationV2 =
  Readonly<{
    memberKind: PlatformReleaseBootstrapActivationClaimFirstMemberKindV2;
    basename: PlatformReleaseBootstrapActivationClaimFirstMemberKindV2;
    byteLength: number;
    rawContentHash: string;
    objectIdentity: StableFsObjectIdentityV2;
    fingerprint: FsObservationFingerprintV2;
  }>;

export type PlatformReleaseBootstrapActivationClaimFirstFixtureStatusV2 =
  "claim_absent"
  | "unclaimed_skeleton"
  | "claimed_empty"
  | "partial"
  | "complete";

type PlatformReleaseBootstrapActivationClaimFirstFixtureReceiptBaseV2 = Readonly<{
    schema: typeof PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_ACTIVATION_CLAIM_FIRST_FIXTURE_SCHEMA_V2;
    version: typeof PLATFORM_RELEASE_COMPONENT_VERSION_V2;
    fixtureScope: typeof PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_ACTIVATION_CLAIM_FIRST_FIXTURE_SCOPE_V2;
    productionAuthority: false;
    productionAdmission: "forbidden";
    claimSemantics: "opaque_fixture_claim_document_join_only";
    durabilityEvidence: typeof DURABILITY_EVIDENCE_V2;
    powerLossDurability: "unproven";
    ownershipAuthority: false;
    cleanupAuthority: false;
    transactionIdentityHash: string;
    stagingDirectoryIdentity: StableFsObjectIdentityV2;
    expectedMembers: readonly Readonly<{
      memberKind: PlatformReleaseBootstrapActivationClaimFirstMemberKindV2;
      basename: PlatformReleaseBootstrapActivationClaimFirstMemberKindV2;
      byteLength: number;
      rawContentHash: string;
      objectIdentity: StableFsObjectIdentityV2;
    }>[];
    observedMembers: readonly PlatformReleaseBootstrapActivationClaimFirstMemberObservationV2[];
    completionScope: "staging_payload_members_only";
    activationStatus: "not_attempted";
    terminalAuthority: false;
    receiptHash: string;
  }>;

type PlatformReleaseBootstrapActivationClaimFirstFixtureUnclaimedReceiptV2 =
  PlatformReleaseBootstrapActivationClaimFirstFixtureReceiptBaseV2 & Readonly<{
    status: "claim_absent" | "unclaimed_skeleton";
    claimDocumentHash?: never;
    claimRawContentHash?: never;
    namespaceParentIdentity?: never;
    claimObjectIdentity?: never;
    claimFingerprint?: never;
  }>;

type PlatformReleaseBootstrapActivationClaimFirstFixtureClaimedReceiptV2 =
  PlatformReleaseBootstrapActivationClaimFirstFixtureReceiptBaseV2 & Readonly<{
    status: "claimed_empty" | "partial" | "complete";
    claimDocumentHash: string;
    claimRawContentHash: string;
    namespaceParentIdentity: StableFsObjectIdentityV2;
    claimObjectIdentity: StableFsObjectIdentityV2;
    claimFingerprint: FsObservationFingerprintV2;
  }>;

export type PlatformReleaseBootstrapActivationClaimFirstFixtureReceiptV2 =
  | PlatformReleaseBootstrapActivationClaimFirstFixtureUnclaimedReceiptV2
  | PlatformReleaseBootstrapActivationClaimFirstFixtureClaimedReceiptV2;

export type PlatformReleaseBootstrapActivationClaimFirstFixtureErrorCodeV2 =
  | "CLAIM_FIRST_INPUT_INVALID"
  | "CLAIM_FIRST_CLAIM_REQUIRED"
  | "CLAIM_FIRST_CONFLICT"
  | "CLAIM_FIRST_LIFECYCLE_INVALID"
  | "CLAIM_FIRST_UNAVAILABLE";

export class PlatformReleaseBootstrapActivationClaimFirstFixtureErrorV2 extends Error {
  constructor(
    readonly code: PlatformReleaseBootstrapActivationClaimFirstFixtureErrorCodeV2,
    message: string,
    options: ErrorOptions = {},
  ) {
    super(message.slice(0, 1_500), options);
    this.name = "PlatformReleaseBootstrapActivationClaimFirstFixtureErrorV2";
  }
}

type ValidatedInputV2 = Readonly<{
  filesystemScope: BootstrapFilesystemScopeIdentityV2;
  namespaceParentPath: string;
  stagingDirectoryPath: string;
  transactionIdentityHash: string;
  claimDocument: Readonly<Record<string, unknown>>;
  members: readonly Readonly<{
    memberKind: PlatformReleaseBootstrapActivationClaimFirstMemberKindV2;
    bytes: Buffer;
    rawContentHash: string;
  }>[];
}>;

function clearValidatedInputV2(input: ValidatedInputV2): void {
  for (const member of input.members) member.bytes.fill(0);
}

type ClaimEnvelopeV2 = Readonly<{
  schema: typeof PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_ACTIVATION_CLAIM_FIRST_FIXTURE_SCHEMA_V2;
  version: typeof PLATFORM_RELEASE_COMPONENT_VERSION_V2;
  fixtureScope: typeof PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_ACTIVATION_CLAIM_FIRST_FIXTURE_SCOPE_V2;
  productionAuthority: false;
  productionAdmission: "forbidden";
  claimSemantics: "opaque_fixture_claim_document_join_only";
  durabilityEvidence: typeof DURABILITY_EVIDENCE_V2;
  powerLossDurability: "unproven";
  ownershipAuthority: false;
  cleanupAuthority: false;
  transactionIdentityHash: string;
  claimDocumentHash: string;
  claimDocument: Readonly<Record<string, unknown>>;
  namespaceParentIdentity: StableFsObjectIdentityV2;
  stagingDirectoryIdentity: StableFsObjectIdentityV2;
  claimObjectIdentity: StableFsObjectIdentityV2;
  expectedMembers: readonly Readonly<{
    memberKind: PlatformReleaseBootstrapActivationClaimFirstMemberKindV2;
    basename: PlatformReleaseBootstrapActivationClaimFirstMemberKindV2;
    byteLength: number;
    rawContentHash: string;
    objectIdentity: StableFsObjectIdentityV2;
  }>[];
}>;

type CapturedFileV2 = Readonly<{
  stat: BigIntStats;
  objectIdentity: StableFsObjectIdentityV2;
  fingerprint: FsObservationFingerprintV2;
  bytes: Buffer;
  rawContentHash: string;
}>;

type SessionStateV2 = {
  input: ValidatedInputV2;
  closed: boolean;
  closing: boolean;
  activeOperations: number;
  closePromise?: Promise<void>;
  hook?: PlatformReleaseBootstrapActivationClaimFirstCheckpointHookV2;
};

const sessionStatesV2 = new WeakMap<object, SessionStateV2>();
const constructorCapabilityV2 = Object.freeze({});

function beginSessionOperationV2(state: SessionStateV2): void {
  if (state.closed || state.closing) {
    return failV2("CLAIM_FIRST_LIFECYCLE_INVALID", "Claim-first session is closed or closing");
  }
  state.activeOperations += 1;
}

function endSessionOperationV2(state: SessionStateV2): void {
  state.activeOperations -= 1;
}

function failV2(
  code: PlatformReleaseBootstrapActivationClaimFirstFixtureErrorCodeV2,
  message: string,
  cause?: unknown,
): never {
  throw new PlatformReleaseBootstrapActivationClaimFirstFixtureErrorV2(
    code,
    message,
    cause === undefined ? {} : { cause },
  );
}

function isNodeCodeV2(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && error.code === code;
}

function exactPathV2(value: string, label: string): string {
  if (
    typeof value !== "string" ||
    !path.isAbsolute(value) ||
    path.normalize(value) !== value
  ) {
    return failV2(
      "CLAIM_FIRST_INPUT_INVALID",
      `${label} must be one normalized absolute path`,
    );
  }
  return value;
}

function fixtureRootPathV2(
  namespaceParentPath: string,
  stagingDirectoryPath: string,
): string {
  if (
    path.dirname(namespaceParentPath) !== path.dirname(stagingDirectoryPath) ||
    path.basename(namespaceParentPath) === path.basename(stagingDirectoryPath)
  ) {
    return failV2(
      "CLAIM_FIRST_INPUT_INVALID",
      "Claim-first parents must be sibling children of one private fixture root",
    );
  }
  const root = path.dirname(namespaceParentPath);
  const tmp = path.resolve(os.tmpdir());
  const relative = path.relative(tmp, root);
  if (
    relative.startsWith("..") ||
    path.isAbsolute(relative) ||
    !path.basename(root).startsWith(PRIVATE_FIXTURE_ROOT_PREFIX_V2)
  ) {
    return failV2(
      "CLAIM_FIRST_INPUT_INVALID",
      "Claim-first fixture root must be one private temp directory",
    );
  }
  return root;
}

async function assertPrivateFixtureRootV2(
  namespaceParentPath: string,
  stagingDirectoryPath: string,
): Promise<void> {
  const root = fixtureRootPathV2(namespaceParentPath, stagingDirectoryPath);
  let stat: BigIntStats;
  try {
    const lexicalTempRoot = path.resolve(os.tmpdir());
    const canonicalTempRoot = await realpath(lexicalTempRoot);
    const lexicalRelativeRoot = path.relative(lexicalTempRoot, root);
    const expectedCanonicalRoot = path.join(canonicalTempRoot, lexicalRelativeRoot);
    const canonicalRoot = await realpath(root);
    const canonicalRelativeRoot = path.relative(canonicalTempRoot, canonicalRoot);
    if (
      canonicalRoot !== expectedCanonicalRoot ||
      canonicalRelativeRoot.startsWith("..") ||
      path.isAbsolute(canonicalRelativeRoot)
    ) {
      return failV2(
        "CLAIM_FIRST_INPUT_INVALID",
        "Claim-first fixture root must not cross a symlinked temp ancestry",
      );
    }
    stat = await lstat(root, { bigint: true });
  } catch (error) {
    if (error instanceof PlatformReleaseBootstrapActivationClaimFirstFixtureErrorV2) throw error;
    return failV2("CLAIM_FIRST_INPUT_INVALID", "Claim-first fixture root cannot be canonicalized", error);
  }
  if (
    !stat.isDirectory() ||
    (stat.mode & 0o7777n) !== 0o700n ||
    stat.nlink < 2n ||
    (typeof process.getuid === "function" && stat.uid !== BigInt(process.getuid()))
  ) {
    return failV2(
      "CLAIM_FIRST_INPUT_INVALID",
      "Claim-first fixture root must remain one private 0700 owner directory",
    );
  }
}

function sameLocatorV2(left: StableFsObjectIdentityV2, right: StableFsObjectIdentityV2): boolean {
  return (
    left.filesystemScopeIdentityHash === right.filesystemScopeIdentityHash &&
    left.objectKind === right.objectKind &&
    left.device === right.device &&
    left.inode === right.inode
  );
}

function sameStatIdentityV2(left: BigIntStats, right: BigIntStats): boolean {
  return (
    left.isFile() === right.isFile() &&
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.uid === right.uid &&
    left.gid === right.gid &&
    left.mode === right.mode &&
    left.nlink === right.nlink &&
    left.size === right.size &&
    left.mtimeNs === right.mtimeNs &&
    left.ctimeNs === right.ctimeNs
  );
}

function sameDirectoryStatIdentityV2(left: BigIntStats, right: BigIntStats): boolean {
  return (
    left.isDirectory() === right.isDirectory() &&
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.uid === right.uid &&
    left.gid === right.gid &&
    left.mode === right.mode
  );
}

async function revalidateDirectoryBindingsV2(
  input: ValidatedInputV2,
  expectedNamespaceStat: BigIntStats,
  expectedStagingStat: BigIntStats,
): Promise<void> {
  await assertPrivateFixtureRootV2(input.namespaceParentPath, input.stagingDirectoryPath);
  const namespaceStat = await lstat(input.namespaceParentPath, { bigint: true });
  const stagingStat = await lstat(input.stagingDirectoryPath, { bigint: true });
  if (
    !sameDirectoryStatIdentityV2(namespaceStat, expectedNamespaceStat) ||
    !sameDirectoryStatIdentityV2(stagingStat, expectedStagingStat) ||
    namespaceStat.dev !== stagingStat.dev
  ) {
    return failV2(
      "CLAIM_FIRST_CONFLICT",
      "Claim-first directory identity changed across a checkpoint",
    );
  }
}

async function revalidateReceiptDirectoriesV2(
  input: ValidatedInputV2,
  receipt: PlatformReleaseBootstrapActivationClaimFirstFixtureReceiptV2,
): Promise<void> {
  await assertPrivateFixtureRootV2(input.namespaceParentPath, input.stagingDirectoryPath);
  const namespaceStat = await lstat(input.namespaceParentPath, { bigint: true });
  const stagingStat = await lstat(input.stagingDirectoryPath, { bigint: true });
  if (!namespaceStat.isDirectory() || !stagingStat.isDirectory()) {
    return failV2("CLAIM_FIRST_CONFLICT", "Claim-first directory was replaced by a non-directory");
  }
  const namespaceIdentity = identityForDirectoryV2(input.filesystemScope, namespaceStat);
  const stagingIdentity = identityForDirectoryV2(input.filesystemScope, stagingStat);
  if (
    receipt.namespaceParentIdentity === undefined ||
    !sameLocatorV2(namespaceIdentity, receipt.namespaceParentIdentity) ||
    !sameLocatorV2(stagingIdentity, receipt.stagingDirectoryIdentity)
  ) {
    return failV2("CLAIM_FIRST_CONFLICT", "Claim-first directory identity changed before mutation");
  }
}

function identityForStatV2(
  filesystemScope: BootstrapFilesystemScopeIdentityV2,
  stat: BigIntStats,
): Readonly<{ objectIdentity: StableFsObjectIdentityV2; fingerprint: FsObservationFingerprintV2 }> {
  const objectIdentity = buildStableFsObjectIdentityV2({
    filesystemScope,
    objectKind: "ordinary_file",
    device: stat.dev.toString(10),
    inode: stat.ino.toString(10),
  });
  const fingerprint = buildFsObservationFingerprintV2({
    objectIdentity,
    ownerUid: Number(stat.uid),
    ownerGid: Number(stat.gid),
    mode: (stat.mode & 0o7777n).toString(8).padStart(4, "0"),
    linkCount: Number(stat.nlink),
    byteLength: Number(stat.size),
    modifiedTimeNanoseconds: stat.mtimeNs.toString(10),
    changedTimeNanoseconds: stat.ctimeNs.toString(10),
  });
  return Object.freeze({ objectIdentity, fingerprint });
}

function identityForDirectoryV2(
  filesystemScope: BootstrapFilesystemScopeIdentityV2,
  stat: BigIntStats,
): StableFsObjectIdentityV2 {
  if (!stat.isDirectory()) {
    return failV2(
      "CLAIM_FIRST_INPUT_INVALID",
      "Claim-first parent must be one ordinary directory",
    );
  }
  return buildStableFsObjectIdentityV2({
    filesystemScope,
    objectKind: "directory",
    device: stat.dev.toString(10),
    inode: stat.ino.toString(10),
  });
}

async function statDirectoryV2(
  filesystemScope: BootstrapFilesystemScopeIdentityV2,
  directoryPath: string,
): Promise<StableFsObjectIdentityV2> {
  const stat = await lstat(directoryPath, { bigint: true });
  return identityForDirectoryV2(filesystemScope, stat);
}

function validateMemberKindV2(value: unknown): asserts value is PlatformReleaseBootstrapActivationClaimFirstMemberKindV2 {
  if (!MEMBER_BASENAMES_V2.includes(value as PlatformReleaseBootstrapActivationClaimFirstMemberKindV2)) {
    return failV2(
      "CLAIM_FIRST_INPUT_INVALID",
      "Claim-first fixture requires the exact three code-owned member kinds",
    );
  }
}

function validateInputV2(input: PlatformReleaseBootstrapActivationClaimFirstFixtureInputV2): ValidatedInputV2 {
  if (typeof input !== "object" || input === null) {
    return failV2("CLAIM_FIRST_INPUT_INVALID", "Claim-first fixture input is not one object");
  }
  let filesystemScope: BootstrapFilesystemScopeIdentityV2;
  try {
    filesystemScope = parseBootstrapFilesystemScopeIdentityCandidateV2(input.filesystemScope);
  } catch (error) {
    return failV2("CLAIM_FIRST_INPUT_INVALID", "Claim-first filesystem scope is invalid", error);
  }
  const namespaceParentPath = exactPathV2(input.namespaceParentPath, "namespace parent");
  const stagingDirectoryPath = exactPathV2(input.stagingDirectoryPath, "staging directory");
  if (
    namespaceParentPath === stagingDirectoryPath
  ) {
    return failV2("CLAIM_FIRST_INPUT_INVALID", "Claim-first parents are not distinct direct paths");
  }
  fixtureRootPathV2(namespaceParentPath, stagingDirectoryPath);
  if (!/^[a-f0-9]{64}$/.test(input.transactionIdentityHash)) {
    return failV2("CLAIM_FIRST_INPUT_INVALID", "Claim-first transaction identity is not one SHA-256");
  }
  let claimDocument: Readonly<Record<string, unknown>>;
  try {
    const snapshot = boundedPlatformReleaseJsonSnapshotV2(
      input.claimDocument,
      PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_ACTIVATION_CLAIM_FIRST_FIXTURE_MAX_BYTES_V2,
    );
    if (
      typeof snapshot !== "object" ||
      snapshot === null ||
      Array.isArray(snapshot) ||
      Object.getPrototypeOf(snapshot) !== Object.prototype
    ) {
      return failV2("CLAIM_FIRST_INPUT_INVALID", "Claim-first claim document must be one plain object");
    }
    claimDocument = snapshot as Readonly<Record<string, unknown>>;
  } catch (error) {
    return failV2("CLAIM_FIRST_INPUT_INVALID", "Claim-first claim document is not canonical", error);
  }
  let claimDocumentByteLength: number;
  try {
    claimDocumentByteLength = canonicalJsonBytes(claimDocument).byteLength;
  } catch (error) {
    return failV2("CLAIM_FIRST_INPUT_INVALID", "Claim-first claim document cannot be measured canonically", error);
  }
  if (
    claimDocumentByteLength >
    PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_ACTIVATION_CLAIM_FIRST_FIXTURE_MAX_BYTES_V2 -
      32_768
  ) {
    return failV2(
      "CLAIM_FIRST_INPUT_INVALID",
      "Claim-first claim document leaves insufficient bounded space for its self-bound envelope",
    );
  }
  const reservedAuthorityKeys = [
    "productionAuthority",
    "productionAdmission",
    "ownershipAuthority",
    "cleanupAuthority",
    "signedNativeAdmission",
    "terminalAuthority",
  ] as const;
  if (reservedAuthorityKeys.some((key) => Object.hasOwn(claimDocument, key))) {
    return failV2(
      "CLAIM_FIRST_INPUT_INVALID",
      "Claim-first opaque claim documents cannot carry authority-looking top-level fields",
    );
  }
  if (!Array.isArray(input.members) || input.members.length !== MEMBER_BASENAMES_V2.length) {
    return failV2("CLAIM_FIRST_INPUT_INVALID", "Claim-first fixture requires exactly three members");
  }
  const seen = new Set<string>();
  const allocatedBuffers: Buffer[] = [];
  let members: readonly Readonly<{
    memberKind: PlatformReleaseBootstrapActivationClaimFirstMemberKindV2;
    bytes: Buffer;
    rawContentHash: string;
  }>[];
  try {
    members = input.members.map((member) => {
      validateMemberKindV2(member?.memberKind);
      if (seen.has(member.memberKind) || MEMBER_BASENAMES_V2[seen.size] !== member.memberKind) {
        return failV2("CLAIM_FIRST_INPUT_INVALID", "Claim-first members must follow the fixed canonical order");
      }
      seen.add(member.memberKind);
      if (!(member.bytes instanceof Uint8Array) || member.bytes.byteLength > MAX_MEMBER_BYTES_V2) {
        return failV2("CLAIM_FIRST_INPUT_INVALID", "Claim-first member payload exceeds its fixed byte cap");
      }
      const bytes = Buffer.from(member.bytes);
      allocatedBuffers.push(bytes);
      return Object.freeze({
        memberKind: member.memberKind,
        bytes,
        rawContentHash: createHash("sha256").update(bytes).digest("hex"),
      });
    });
  } catch (error) {
    for (const bytes of allocatedBuffers) bytes.fill(0);
    if (error instanceof PlatformReleaseBootstrapActivationClaimFirstFixtureErrorV2) throw error;
    return failV2("CLAIM_FIRST_INPUT_INVALID", "Claim-first member payloads are not readable", error);
  }
  return Object.freeze({
    filesystemScope,
    namespaceParentPath,
    stagingDirectoryPath,
    transactionIdentityHash: input.transactionIdentityHash,
    claimDocument,
    members: Object.freeze(members),
  });
}

function claimPathV2(input: ValidatedInputV2): string {
  return path.join(input.namespaceParentPath, CLAIM_BASENAME_V2);
}

function memberPathV2(input: ValidatedInputV2, memberKind: string): string {
  return path.join(input.stagingDirectoryPath, memberKind);
}

function assertPrivateFileV2(
  stat: BigIntStats,
  expectedSize?: number,
  maximumBytes = MAX_MEMBER_BYTES_V2,
): void {
  if (
    !stat.isFile() ||
    (stat.mode & 0o7777n) !== 0o600n ||
    stat.nlink !== 1n ||
    stat.size < 0n ||
    stat.size > BigInt(maximumBytes) ||
    (expectedSize !== undefined && stat.size !== BigInt(expectedSize))
  ) {
    return failV2("CLAIM_FIRST_CONFLICT", "Claim-first file is not one private unaliased regular file");
  }
  if (typeof process.getuid === "function" && stat.uid !== BigInt(process.getuid())) {
    return failV2("CLAIM_FIRST_CONFLICT", "Claim-first file owner changed");
  }
}

async function writeAllV2(
  handle: FileHandle,
  bytes: Buffer,
  basename: string,
  filePath: string,
  hook: PlatformReleaseBootstrapActivationClaimFirstCheckpointHookV2 | undefined,
  checkpoint: PlatformReleaseBootstrapActivationClaimFirstCheckpointV2,
  startOffset = 0,
): Promise<void> {
  let offset = startOffset;
  while (offset < bytes.length) {
    const length = Math.min(bytes.length - offset, 4_096);
    const result = await handle.write(bytes, offset, length, offset);
    if (result.bytesWritten <= 0) {
      return failV2("CLAIM_FIRST_UNAVAILABLE", "Claim-first write made no progress");
    }
    offset += result.bytesWritten;
    await hook?.(checkpoint, {
      basename,
      offset,
      totalBytes: bytes.length,
      path: filePath,
    });
  }
}

async function syncDirectoryV2(directoryPath: string): Promise<void> {
  let handle: FileHandle | undefined;
  try {
    handle = await open(
      directoryPath,
      constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
    await handle.sync();
  } finally {
    await handle?.close();
  }
}

async function captureFileV2(
  input: ValidatedInputV2,
  filePath: string,
  expectedIdentity?: StableFsObjectIdentityV2,
  maximumBytes = MAX_MEMBER_BYTES_V2,
): Promise<CapturedFileV2> {
  const pathBefore = await lstat(filePath, { bigint: true });
  assertPrivateFileV2(pathBefore, undefined, maximumBytes);
  const beforeIdentity = identityForStatV2(input.filesystemScope, pathBefore);
  if (expectedIdentity !== undefined && !sameLocatorV2(beforeIdentity.objectIdentity, expectedIdentity)) {
    return failV2("CLAIM_FIRST_CONFLICT", "Claim-first file stable identity changed");
  }
  let handle: FileHandle | undefined;
  let bytes = Buffer.alloc(0);
  try {
    handle = await open(filePath, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const descriptorBefore = await handle.stat({ bigint: true });
    if (!sameStatIdentityV2(pathBefore, descriptorBefore)) {
      return failV2("CLAIM_FIRST_CONFLICT", "Claim-first file changed before descriptor admission");
    }
    bytes = Buffer.alloc(Number(pathBefore.size));
    let offset = 0;
    while (offset < bytes.length) {
      const result = await handle.read(bytes, offset, bytes.length - offset, offset);
      if (result.bytesRead <= 0) return failV2("CLAIM_FIRST_CONFLICT", "Claim-first file reached early EOF");
      offset += result.bytesRead;
    }
    const probe = Buffer.alloc(1);
    try {
      if ((await handle.read(probe, 0, 1, bytes.length)).bytesRead !== 0) {
        return failV2("CLAIM_FIRST_CONFLICT", "Claim-first file grew beyond its captured bytes");
      }
    } finally {
      probe.fill(0);
    }
    const descriptorAfter = await handle.stat({ bigint: true });
    const pathAfter = await lstat(filePath, { bigint: true });
    if (!sameStatIdentityV2(pathBefore, descriptorAfter) || !sameStatIdentityV2(pathBefore, pathAfter)) {
      return failV2("CLAIM_FIRST_CONFLICT", "Claim-first file changed during capture");
    }
    return Object.freeze({
      stat: pathAfter,
      objectIdentity: beforeIdentity.objectIdentity,
      fingerprint: buildFsObservationFingerprintV2({
        objectIdentity: beforeIdentity.objectIdentity,
        ownerUid: Number(pathAfter.uid),
        ownerGid: Number(pathAfter.gid),
        mode: (pathAfter.mode & 0o7777n).toString(8).padStart(4, "0"),
        linkCount: Number(pathAfter.nlink),
        byteLength: Number(pathAfter.size),
        modifiedTimeNanoseconds: pathAfter.mtimeNs.toString(10),
        changedTimeNanoseconds: pathAfter.ctimeNs.toString(10),
      }),
      bytes,
      rawContentHash: createHash("sha256").update(bytes).digest("hex"),
    });
  } catch (error) {
    bytes.fill(0);
    if (error instanceof PlatformReleaseBootstrapActivationClaimFirstFixtureErrorV2) throw error;
    return failV2("CLAIM_FIRST_UNAVAILABLE", "Claim-first file could not be captured", error);
  } finally {
    await handle?.close();
  }
}

async function readHandleBytesV2(
  handle: FileHandle,
  stat: BigIntStats,
  maximumBytes: number,
): Promise<Buffer> {
  if (stat.size > BigInt(maximumBytes)) {
    return failV2("CLAIM_FIRST_CONFLICT", "Claim-first file exceeds its fixed read cap");
  }
  const bytes = Buffer.alloc(Number(stat.size));
  try {
    let offset = 0;
    while (offset < bytes.length) {
      const result = await handle.read(bytes, offset, bytes.length - offset, offset);
      if (result.bytesRead <= 0) {
        bytes.fill(0);
        return failV2("CLAIM_FIRST_CONFLICT", "Claim-first file reached early EOF");
      }
      offset += result.bytesRead;
    }
    const probe = Buffer.alloc(1);
    try {
      if ((await handle.read(probe, 0, 1, bytes.length)).bytesRead !== 0) {
        bytes.fill(0);
        return failV2("CLAIM_FIRST_CONFLICT", "Claim-first file grew during descriptor read");
      }
    } finally {
      probe.fill(0);
    }
    return bytes;
  } catch (error) {
    bytes.fill(0);
    throw error;
  }
}

async function lstatOptionalV2(filePath: string): Promise<BigIntStats | null> {
  try {
    return await lstat(filePath, { bigint: true });
  } catch (error) {
    if (isNodeCodeV2(error, "ENOENT")) return null;
    throw error;
  }
}

function claimEnvelopeBytesV2(envelope: ClaimEnvelopeV2): Buffer {
  return canonicalJsonBytes(envelope);
}

const CLAIM_ENVELOPE_KEYS_V2 = Object.freeze([
  "claimDocument",
  "claimDocumentHash",
  "claimObjectIdentity",
  "claimSemantics",
  "cleanupAuthority",
  "durabilityEvidence",
  "expectedMembers",
  "fixtureScope",
  "namespaceParentIdentity",
  "ownershipAuthority",
  "powerLossDurability",
  "productionAdmission",
  "productionAuthority",
  "schema",
  "stagingDirectoryIdentity",
  "transactionIdentityHash",
  "version",
] as const);

function receiptHashV2(receipt: Readonly<Record<string, unknown>>): string {
  return hashCanonicalJson({
    schema: "setfarm.platform-release-bootstrap-activation-claim-first-fixture-receipt-hash.v2",
    receipt,
  });
}

type DistributiveOmitV2<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

export function hashPlatformReleaseBootstrapActivationClaimFirstFixtureReceiptV2(
  receipt: Readonly<DistributiveOmitV2<PlatformReleaseBootstrapActivationClaimFirstFixtureReceiptV2, "receiptHash">>,
): string {
  const identity = { ...(receipt as unknown as Record<string, unknown>) };
  delete identity.receiptHash;
  return receiptHashV2(identity);
}

function claimDocumentHashV2(document: Readonly<Record<string, unknown>>): string {
  return hashCanonicalJson({
    schema: "setfarm.platform-release-bootstrap-activation-claim-first-document-hash.v2",
    document,
  });
}

function expectedMemberManifestV2(
  input: ValidatedInputV2,
  identities: readonly StableFsObjectIdentityV2[],
) {
  return input.members.map((member, index) => ({
    memberKind: member.memberKind,
    basename: member.memberKind,
    byteLength: member.bytes.byteLength,
    rawContentHash: member.rawContentHash,
    objectIdentity: identities[index]!,
  }));
}

function parseClaimEnvelopeV2(
  input: ValidatedInputV2,
  raw: Buffer,
  claimObservedIdentity: StableFsObjectIdentityV2,
  namespaceParentIdentity: StableFsObjectIdentityV2,
  stagingDirectoryIdentity: StableFsObjectIdentityV2,
): ClaimEnvelopeV2 {
  let parsed: unknown;
  let rawText: string;
  try {
    rawText = new TextDecoder("utf-8", { fatal: true }).decode(raw);
    parsed = JSON.parse(rawText);
  } catch (error) {
    return failV2("CLAIM_FIRST_CONFLICT", "Claim-first claim bytes are not strict UTF-8 JSON", error);
  }
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    Array.isArray(parsed)
  ) {
    return failV2("CLAIM_FIRST_CONFLICT", "Claim-first claim envelope is not one object");
  }
  try {
    if (!canonicalJsonBytes(parsed).equals(raw)) {
      return failV2("CLAIM_FIRST_CONFLICT", "Claim-first claim bytes are not canonical");
    }
  } catch (error) {
    if (error instanceof PlatformReleaseBootstrapActivationClaimFirstFixtureErrorV2) throw error;
    return failV2("CLAIM_FIRST_CONFLICT", "Claim-first claim canonicalization exceeded its bound", error);
  }
  const envelope = parsed as Partial<ClaimEnvelopeV2>;
  const envelopeKeys = Object.keys(parsed).sort();
  if (
    canonicalJsonStringify(envelopeKeys) !==
    canonicalJsonStringify([...CLAIM_ENVELOPE_KEYS_V2].sort())
  ) {
    return failV2("CLAIM_FIRST_CONFLICT", "Claim-first claim envelope has non-canonical or extra keys");
  }
  if (
    envelope.schema !== PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_ACTIVATION_CLAIM_FIRST_FIXTURE_SCHEMA_V2 ||
    envelope.version !== PLATFORM_RELEASE_COMPONENT_VERSION_V2 ||
    envelope.fixtureScope !== PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_ACTIVATION_CLAIM_FIRST_FIXTURE_SCOPE_V2 ||
    envelope.productionAuthority !== false ||
    envelope.productionAdmission !== "forbidden" ||
    envelope.claimSemantics !== "opaque_fixture_claim_document_join_only" ||
    envelope.durabilityEvidence !== DURABILITY_EVIDENCE_V2 ||
    envelope.powerLossDurability !== "unproven" ||
    envelope.ownershipAuthority !== false ||
    envelope.cleanupAuthority !== false ||
    envelope.transactionIdentityHash !== input.transactionIdentityHash ||
    envelope.claimDocumentHash !== claimDocumentHashV2(input.claimDocument) ||
    canonicalJsonStringify(envelope.claimDocument) !== canonicalJsonStringify(input.claimDocument) ||
    !Array.isArray(envelope.expectedMembers)
  ) {
    return failV2("CLAIM_FIRST_CONFLICT", "Claim-first claim envelope is foreign or structurally invalid");
  }
  let claimIdentity: StableFsObjectIdentityV2;
  let parentIdentity: StableFsObjectIdentityV2;
  let stageIdentity: StableFsObjectIdentityV2;
  try {
    claimIdentity = parseStableFsObjectIdentityCandidateV2(envelope.claimObjectIdentity);
    parentIdentity = parseStableFsObjectIdentityCandidateV2(envelope.namespaceParentIdentity);
    stageIdentity = parseStableFsObjectIdentityCandidateV2(envelope.stagingDirectoryIdentity);
  } catch (error) {
    return failV2("CLAIM_FIRST_CONFLICT", "Claim-first claim object identities are invalid", error);
  }
  if (
    !sameLocatorV2(claimIdentity, claimObservedIdentity) ||
    !sameLocatorV2(parentIdentity, namespaceParentIdentity) ||
    !sameLocatorV2(stageIdentity, stagingDirectoryIdentity) ||
    envelope.expectedMembers.length !== input.members.length
  ) {
    return failV2("CLAIM_FIRST_CONFLICT", "Claim-first claim stable identity binding is not exact");
  }
  const expected = envelope.expectedMembers.map((member, index) => {
    validateMemberKindV2(member?.memberKind);
    if (
      typeof member !== "object" ||
      member === null ||
      canonicalJsonStringify(Object.keys(member).sort()) !==
        canonicalJsonStringify([
          "basename",
          "byteLength",
          "memberKind",
          "objectIdentity",
          "rawContentHash",
        ])
    ) {
      return failV2("CLAIM_FIRST_CONFLICT", "Claim-first member manifest has non-canonical or extra keys");
    }
    if (
      member.memberKind !== MEMBER_BASENAMES_V2[index] ||
      member.basename !== member.memberKind ||
      member.byteLength !== input.members[index]!.bytes.byteLength ||
      member.rawContentHash !== input.members[index]!.rawContentHash ||
      (() => {
        try {
          const identity = parseStableFsObjectIdentityCandidateV2(member.objectIdentity);
          return identity.objectKind !== "ordinary_file" ||
            identity.filesystemScopeIdentityHash !== input.filesystemScope.scopeIdentityHash;
        } catch {
          return true;
        }
      })()
    ) {
      return failV2("CLAIM_FIRST_CONFLICT", "Claim-first member manifest is foreign");
    }
    return Object.freeze({
      memberKind: member.memberKind,
      basename: member.basename,
      byteLength: member.byteLength,
      rawContentHash: member.rawContentHash,
      objectIdentity: parseStableFsObjectIdentityCandidateV2(member.objectIdentity),
    });
  });
  return Object.freeze({
    schema: envelope.schema,
    version: envelope.version,
    fixtureScope: envelope.fixtureScope,
    productionAuthority: false,
    productionAdmission: "forbidden",
    claimSemantics: "opaque_fixture_claim_document_join_only",
    durabilityEvidence: DURABILITY_EVIDENCE_V2,
    powerLossDurability: "unproven",
    ownershipAuthority: false,
    cleanupAuthority: false,
    transactionIdentityHash: envelope.transactionIdentityHash,
    claimDocumentHash: envelope.claimDocumentHash,
    claimDocument: envelope.claimDocument!,
    namespaceParentIdentity: parentIdentity,
    stagingDirectoryIdentity: stageIdentity,
    claimObjectIdentity: claimIdentity,
    expectedMembers: Object.freeze(expected),
  });
}

async function inspectInternalV2(
  input: ValidatedInputV2,
): Promise<PlatformReleaseBootstrapActivationClaimFirstFixtureReceiptV2> {
  await assertPrivateFixtureRootV2(input.namespaceParentPath, input.stagingDirectoryPath);
  const parentStat = await lstat(input.namespaceParentPath, { bigint: true });
  const stageStat = await lstat(input.stagingDirectoryPath, { bigint: true });
  if (!parentStat.isDirectory() || !stageStat.isDirectory() || parentStat.dev !== stageStat.dev) {
    return failV2("CLAIM_FIRST_CONFLICT", "Claim-first parent/staging boundary changed");
  }
  const parentIdentity = identityForDirectoryV2(input.filesystemScope, parentStat);
  const stagingIdentity = identityForDirectoryV2(input.filesystemScope, stageStat);
  const claimPath = claimPathV2(input);
  const claimStat = await lstatOptionalV2(claimPath);
  const entries = await readdir(input.stagingDirectoryPath, { withFileTypes: true });
  const entryNames = entries.map((entry) => entry.name).sort();
  const expectedNames = [...MEMBER_BASENAMES_V2].sort();
  if (entryNames.some((name) => !expectedNames.includes(name as typeof MEMBER_BASENAMES_V2[number]))) {
    return failV2("CLAIM_FIRST_CONFLICT", "Claim-first staging contains a foreign member");
  }
  if (claimStat === null) {
    const status = entryNames.length === 0 ? "claim_absent" : "unclaimed_skeleton";
    const identity = {
      schema: PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_ACTIVATION_CLAIM_FIRST_FIXTURE_SCHEMA_V2,
      version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
      fixtureScope: PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_ACTIVATION_CLAIM_FIRST_FIXTURE_SCOPE_V2,
      productionAuthority: false,
      productionAdmission: "forbidden",
      claimSemantics: "opaque_fixture_claim_document_join_only",
      durabilityEvidence: DURABILITY_EVIDENCE_V2,
      powerLossDurability: "unproven",
      ownershipAuthority: false,
      cleanupAuthority: false,
      transactionIdentityHash: input.transactionIdentityHash,
      stagingDirectoryIdentity: stagingIdentity,
      expectedMembers: [],
      observedMembers: [],
      status,
      completionScope: "staging_payload_members_only",
      activationStatus: "not_attempted",
      terminalAuthority: false,
    } as const;
    return deepFreezePlatformReleaseJsonV2({
      ...identity,
      receiptHash: receiptHashV2(identity),
    });
  }
  const claimCapture = await captureFileV2(input, claimPath, undefined, MAX_CLAIM_BYTES_V2);
  try {
    const envelope = parseClaimEnvelopeV2(
      input,
      claimCapture.bytes,
      claimCapture.objectIdentity,
      parentIdentity,
      stagingIdentity,
    );
    const observations: PlatformReleaseBootstrapActivationClaimFirstMemberObservationV2[] = [];
    let partial = false;
    for (const expected of envelope.expectedMembers) {
      const memberPath = memberPathV2(input, expected.memberKind);
      const memberStat = await lstatOptionalV2(memberPath);
      if (memberStat === null) {
        return failV2("CLAIM_FIRST_CONFLICT", "Claim-first member disappeared");
      }
      const captured = await captureFileV2(input, memberPath, expected.objectIdentity);
      try {
        const expectedBytes = input.members.find((member) => member.memberKind === expected.memberKind)!.bytes;
        if (captured.bytes.length > expectedBytes.length) {
          return failV2("CLAIM_FIRST_CONFLICT", "Claim-first member exceeds its admitted length");
        }
        const prefix = expectedBytes.subarray(0, captured.bytes.length);
        if (!captured.bytes.equals(prefix)) {
          return failV2("CLAIM_FIRST_CONFLICT", "Claim-first member prefix is foreign");
        }
        if (captured.bytes.length !== expectedBytes.length) partial = true;
        observations.push(Object.freeze({
          memberKind: expected.memberKind,
          basename: expected.basename,
          byteLength: captured.bytes.length,
          rawContentHash: captured.rawContentHash,
          objectIdentity: captured.objectIdentity,
          fingerprint: captured.fingerprint,
        }));
      } finally {
        captured.bytes.fill(0);
      }
    }
    const status = partial ? (observations.every((entry) => entry.byteLength === 0) ? "claimed_empty" : "partial") : "complete";
    const identity = {
      schema: PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_ACTIVATION_CLAIM_FIRST_FIXTURE_SCHEMA_V2,
      version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
      fixtureScope: PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_ACTIVATION_CLAIM_FIRST_FIXTURE_SCOPE_V2,
      productionAuthority: false,
      productionAdmission: "forbidden",
      claimSemantics: "opaque_fixture_claim_document_join_only",
      durabilityEvidence: DURABILITY_EVIDENCE_V2,
      powerLossDurability: "unproven",
      ownershipAuthority: false,
      cleanupAuthority: false,
      transactionIdentityHash: input.transactionIdentityHash,
      claimDocumentHash: envelope.claimDocumentHash,
      claimRawContentHash: claimCapture.rawContentHash,
      namespaceParentIdentity: envelope.namespaceParentIdentity,
      claimObjectIdentity: envelope.claimObjectIdentity,
      claimFingerprint: claimCapture.fingerprint,
      stagingDirectoryIdentity: envelope.stagingDirectoryIdentity,
      expectedMembers: envelope.expectedMembers,
      observedMembers: observations,
      status,
      completionScope: "staging_payload_members_only",
      activationStatus: "not_attempted",
      terminalAuthority: false,
    } as const;
    return deepFreezePlatformReleaseJsonV2({
      ...identity,
      receiptHash: receiptHashV2(identity),
    });
  } finally {
    claimCapture.bytes.fill(0);
  }
}

async function createSessionV2(
  capability: object,
  input: ValidatedInputV2,
  hook?: PlatformReleaseBootstrapActivationClaimFirstCheckpointHookV2,
  resume = false,
): Promise<PlatformReleaseBootstrapActivationClaimFirstFixtureSessionV2> {
  if (capability !== constructorCapabilityV2) {
    return failV2("CLAIM_FIRST_LIFECYCLE_INVALID", "Claim-first session constructor is private");
  }
  await assertPrivateFixtureRootV2(input.namespaceParentPath, input.stagingDirectoryPath);
  const parentStat = await lstat(input.namespaceParentPath, { bigint: true });
  const stageStat = await lstat(input.stagingDirectoryPath, { bigint: true });
  if (!parentStat.isDirectory() || !stageStat.isDirectory() || parentStat.dev !== stageStat.dev) {
    return failV2("CLAIM_FIRST_CONFLICT", "Claim-first parent/staging boundary is invalid");
  }
  if (resume) {
    const existing = await inspectInternalV2(input);
    if (
      existing.status !== "claimed_empty" &&
      existing.status !== "partial" &&
      existing.status !== "complete"
    ) {
      return failV2(
        "CLAIM_FIRST_CLAIM_REQUIRED",
        "Claim-first recovery requires one exact sync-return-observed fixture claim",
      );
    }
  } else {
    const existingClaim = await lstatOptionalV2(claimPathV2(input));
    const existingStage = await readdir(input.stagingDirectoryPath);
    if (existingClaim !== null || existingStage.length > 0) {
      return failV2("CLAIM_FIRST_CONFLICT", "Claim-first session requires an untouched namespace");
    }
  }
  const stageIdentities: StableFsObjectIdentityV2[] = [];
  const stageHandles: FileHandle[] = [];
  try {
    if (!resume) {
      for (const member of input.members) {
      const filePath = memberPathV2(input, member.memberKind);
      const handle = await open(
        filePath,
        constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
        0o600,
      );
      stageHandles.push(handle);
      await handle.chmod(0o600);
      const stat = await handle.stat({ bigint: true });
      assertPrivateFileV2(stat, 0);
      stageIdentities.push(identityForStatV2(input.filesystemScope, stat).objectIdentity);
      await handle.sync();
      }
      await syncDirectoryV2(input.stagingDirectoryPath);
      await hook?.(PlatformReleaseBootstrapActivationClaimFirstCheckpointV2.afterSkeletonDirectorySync, {
        basename: "staging-directory",
        offset: 0,
        totalBytes: 0,
        path: input.stagingDirectoryPath,
      });
      await revalidateDirectoryBindingsV2(input, parentStat, stageStat);
      for (const handle of stageHandles) await handle.close();
      stageHandles.length = 0;

      const parentIdentity = identityForDirectoryV2(input.filesystemScope, parentStat);
      const stagingIdentity = identityForDirectoryV2(input.filesystemScope, stageStat);
      const claimPath = claimPathV2(input);
      const claimHandle = await open(
      claimPath,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
      0o600,
    );
      try {
      await claimHandle.chmod(0o600);
      const claimStat = await claimHandle.stat({ bigint: true });
      assertPrivateFileV2(claimStat, 0);
      const claimIdentity = identityForStatV2(input.filesystemScope, claimStat).objectIdentity;
      const envelope: ClaimEnvelopeV2 = Object.freeze({
        schema: PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_ACTIVATION_CLAIM_FIRST_FIXTURE_SCHEMA_V2,
        version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
        fixtureScope: PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_ACTIVATION_CLAIM_FIRST_FIXTURE_SCOPE_V2,
        productionAuthority: false,
        productionAdmission: "forbidden",
        claimSemantics: "opaque_fixture_claim_document_join_only",
        durabilityEvidence: DURABILITY_EVIDENCE_V2,
        powerLossDurability: "unproven",
        ownershipAuthority: false,
        cleanupAuthority: false,
        transactionIdentityHash: input.transactionIdentityHash,
        claimDocumentHash: claimDocumentHashV2(input.claimDocument),
        claimDocument: input.claimDocument,
        namespaceParentIdentity: parentIdentity,
        stagingDirectoryIdentity: stagingIdentity,
        claimObjectIdentity: claimIdentity,
        expectedMembers: expectedMemberManifestV2(input, stageIdentities),
      });
      const claimBytes = claimEnvelopeBytesV2(envelope);
      if (claimBytes.byteLength > MAX_CLAIM_BYTES_V2) {
        claimBytes.fill(0);
        return failV2("CLAIM_FIRST_INPUT_INVALID", "Claim-first claim envelope exceeds its fixed byte cap");
      }
      try {
        await writeAllV2(
          claimHandle,
          claimBytes,
          CLAIM_BASENAME_V2,
          claimPath,
          hook,
          PlatformReleaseBootstrapActivationClaimFirstCheckpointV2.duringClaimWrite,
        );
        await claimHandle.sync();
        await hook?.(PlatformReleaseBootstrapActivationClaimFirstCheckpointV2.afterClaimFileSync, {
          basename: CLAIM_BASENAME_V2,
          offset: claimBytes.length,
          totalBytes: claimBytes.length,
          path: claimPath,
        });
        await revalidateDirectoryBindingsV2(input, parentStat, stageStat);
        await syncDirectoryV2(input.namespaceParentPath);
        await hook?.(PlatformReleaseBootstrapActivationClaimFirstCheckpointV2.afterClaimDirectorySync, {
          basename: CLAIM_BASENAME_V2,
          offset: claimBytes.length,
          totalBytes: claimBytes.length,
          path: claimPath,
        });
        await revalidateDirectoryBindingsV2(input, parentStat, stageStat);
      } finally {
        claimBytes.fill(0);
      }
      } finally {
        await claimHandle.close();
      }
    }
    await inspectInternalV2(input);
  } catch (error) {
    for (const handle of stageHandles) await handle.close().catch(() => undefined);
    if (error instanceof PlatformReleaseBootstrapActivationClaimFirstFixtureErrorV2) throw error;
    return failV2(
      "CLAIM_FIRST_UNAVAILABLE",
      "Claim-first session could not establish its fully-written sync-return-observed fixture claim",
      error,
    );
  }

  const session = Object.freeze({
    fixtureScope: PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_ACTIVATION_CLAIM_FIRST_FIXTURE_SCOPE_V2,
    productionAuthority: false as const,
    productionAdmission: "forbidden" as const,
    claimSemantics: "opaque_fixture_claim_document_join_only" as const,
    ownershipAuthority: false as const,
    cleanupAuthority: false as const,
    mutationScope: "test_staging_member_payload_only" as const,
    async writeMember(memberKind: PlatformReleaseBootstrapActivationClaimFirstMemberKindV2): Promise<void> {
      const state = sessionStatesV2.get(session);
      if (!state) return failV2("CLAIM_FIRST_LIFECYCLE_INVALID", "Claim-first session is forged");
      beginSessionOperationV2(state);
      let payload: Buffer | undefined;
      try {
          const member = state.input.members.find((candidate) => candidate.memberKind === memberKind);
          if (!member) return failV2("CLAIM_FIRST_INPUT_INVALID", "Claim-first member is not code-owned");
          payload = Buffer.from(member.bytes);
          const receipt = await inspectInternalV2(state.input);
          if (receipt.status === "claim_absent" || receipt.status === "unclaimed_skeleton") {
            return failV2("CLAIM_FIRST_CLAIM_REQUIRED", "Claim-first payload write requires an exact sync-return-observed fixture claim");
          }
          const expected = receipt.expectedMembers.find((candidate) => candidate.memberKind === memberKind);
          if (!expected) return failV2("CLAIM_FIRST_CONFLICT", "Claim-first member observation is incomplete");
          const memberPath = memberPathV2(state.input, memberKind);
          let handle: FileHandle | undefined;
          let currentBytes: Buffer | undefined;
          let finalBytes: Buffer | undefined;
          try {
            handle = await open(memberPath, constants.O_RDWR | constants.O_NOFOLLOW | constants.O_NONBLOCK);
            const stat = await handle.stat({ bigint: true });
            assertPrivateFileV2(stat);
            const identity = identityForStatV2(state.input.filesystemScope, stat).objectIdentity;
            if (!sameLocatorV2(identity, expected.objectIdentity)) return failV2("CLAIM_FIRST_CONFLICT", "Claim-first member inode was replaced");
            currentBytes = await readHandleBytesV2(handle, stat, MAX_MEMBER_BYTES_V2);
            if (
              currentBytes.length > payload.length ||
              !payload.subarray(0, currentBytes.length).equals(currentBytes)
            ) {
              return failV2("CLAIM_FIRST_CONFLICT", "Claim-first member prefix changed before resume");
            }
            await writeAllV2(
              handle,
              payload,
              memberKind,
              memberPath,
              state.hook,
              PlatformReleaseBootstrapActivationClaimFirstCheckpointV2.duringMemberWrite,
              currentBytes.length,
            );
            await handle.sync();
            await state.hook?.(PlatformReleaseBootstrapActivationClaimFirstCheckpointV2.afterMemberFileSync, {
              basename: memberKind,
              offset: payload.length,
              totalBytes: payload.length,
              path: memberPath,
            });
            await revalidateReceiptDirectoriesV2(state.input, receipt);
            await syncDirectoryV2(state.input.stagingDirectoryPath);
            await state.hook?.(PlatformReleaseBootstrapActivationClaimFirstCheckpointV2.afterMemberDirectorySync, {
              basename: memberKind,
              offset: payload.length,
              totalBytes: payload.length,
              path: state.input.stagingDirectoryPath,
            });
            await revalidateReceiptDirectoriesV2(state.input, receipt);
            const finalStat = await handle.stat({ bigint: true });
            assertPrivateFileV2(finalStat, payload.length);
            if (!sameLocatorV2(identityForStatV2(state.input.filesystemScope, finalStat).objectIdentity, expected.objectIdentity)) {
              return failV2("CLAIM_FIRST_CONFLICT", "Claim-first member inode changed after resume");
            }
            finalBytes = await readHandleBytesV2(handle, finalStat, MAX_MEMBER_BYTES_V2);
            const finalHash = createHash("sha256").update(finalBytes).digest("hex");
            if (!finalBytes.equals(payload) || finalHash !== expected.rawContentHash) {
              return failV2("CLAIM_FIRST_CONFLICT", "Claim-first member bytes did not settle to the admitted hash");
            }
            await inspectInternalV2(state.input);
          } catch (error) {
            if (error instanceof PlatformReleaseBootstrapActivationClaimFirstFixtureErrorV2) {
              throw error;
            }
            return failV2(
              "CLAIM_FIRST_UNAVAILABLE",
              "Claim-first member write did not settle",
              error,
            );
          } finally {
            currentBytes?.fill(0);
            finalBytes?.fill(0);
            await handle?.close();
          }
      } finally {
        payload?.fill(0);
        endSessionOperationV2(state);
      }
    },
    async inspect(): Promise<PlatformReleaseBootstrapActivationClaimFirstFixtureReceiptV2> {
      const state = sessionStatesV2.get(session);
      if (!state) return failV2("CLAIM_FIRST_LIFECYCLE_INVALID", "Claim-first session is forged");
      beginSessionOperationV2(state);
      try {
        return await inspectInternalV2(state.input);
      } finally {
        endSessionOperationV2(state);
      }
    },
    async close(): Promise<void> {
      const state = sessionStatesV2.get(session);
      if (!state) return failV2("CLAIM_FIRST_LIFECYCLE_INVALID", "Claim-first session is forged");
      if (state.closePromise) return state.closePromise;
      if (state.activeOperations > 0) {
        return failV2(
          "CLAIM_FIRST_LIFECYCLE_INVALID",
          "Claim-first session cannot close while an operation is active; retry after it settles",
        );
      }
      state.closing = true;
      state.closed = true;
      for (const member of state.input.members) member.bytes.fill(0);
      state.closePromise = Promise.resolve();
      return state.closePromise;
    },
  });
  sessionStatesV2.set(session, {
    input,
    closed: false,
    closing: false,
    activeOperations: 0,
    hook,
  });
  return session;
}

export interface PlatformReleaseBootstrapActivationClaimFirstFixtureSessionV2 {
  readonly fixtureScope: typeof PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_ACTIVATION_CLAIM_FIRST_FIXTURE_SCOPE_V2;
  readonly productionAuthority: false;
  readonly productionAdmission: "forbidden";
  readonly claimSemantics: "opaque_fixture_claim_document_join_only";
  readonly ownershipAuthority: false;
  readonly cleanupAuthority: false;
  readonly mutationScope: "test_staging_member_payload_only";
  writeMember(memberKind: PlatformReleaseBootstrapActivationClaimFirstMemberKindV2): Promise<void>;
  inspect(): Promise<PlatformReleaseBootstrapActivationClaimFirstFixtureReceiptV2>;
  close(): Promise<void>;
}

export async function createPlatformReleaseBootstrapActivationClaimFirstFixtureSessionV2(
  input: PlatformReleaseBootstrapActivationClaimFirstFixtureInputV2,
  hook?: PlatformReleaseBootstrapActivationClaimFirstCheckpointHookV2,
): Promise<PlatformReleaseBootstrapActivationClaimFirstFixtureSessionV2> {
  const validated = validateInputV2(input);
  try {
    return await createSessionV2(constructorCapabilityV2, validated, hook);
  } catch (error) {
    clearValidatedInputV2(validated);
    throw error;
  }
}

export async function resumePlatformReleaseBootstrapActivationClaimFirstFixtureSessionV2(
  input: PlatformReleaseBootstrapActivationClaimFirstFixtureInputV2,
  hook?: PlatformReleaseBootstrapActivationClaimFirstCheckpointHookV2,
): Promise<PlatformReleaseBootstrapActivationClaimFirstFixtureSessionV2> {
  const validated = validateInputV2(input);
  try {
    return await createSessionV2(constructorCapabilityV2, validated, hook, true);
  } catch (error) {
    clearValidatedInputV2(validated);
    throw error;
  }
}

export async function inspectPlatformReleaseBootstrapActivationClaimFirstFixtureV2(
  input: PlatformReleaseBootstrapActivationClaimFirstFixtureInputV2,
): Promise<PlatformReleaseBootstrapActivationClaimFirstFixtureReceiptV2> {
  const validated = validateInputV2(input);
  try {
    return await inspectInternalV2(validated);
  } finally {
    clearValidatedInputV2(validated);
  }
}

export function claimFirstFixtureMemberBasenamesV2(): readonly PlatformReleaseBootstrapActivationClaimFirstMemberKindV2[] {
  return MEMBER_BASENAMES_V2;
}
