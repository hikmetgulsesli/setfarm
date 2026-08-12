import { createHash, randomBytes } from "node:crypto";
import {
  chmodSync,
  closeSync,
  constants as fsConstants,
  fchmodSync,
  fstatSync,
  fsyncSync,
  lstatSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmdirSync,
  symlinkSync,
  unlinkSync,
  writeSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { isProxy } from "node:util/types";

import {
  canonicalJsonBytes,
  canonicalJsonStringify,
  hashCanonicalJson,
} from "./canonical-json.js";
import {
  hashPlatformReleaseBuildAttestationV2,
  parsePlatformReleaseBuildAttestationCandidateV2,
  parsePlatformReleaseCandidateEnvelopeV2,
  type PlatformReleaseBuildAttestationV2,
  type PlatformReleaseCandidateEnvelopeV2,
} from "../execution/schemas/platform-release-build-attestation-v2.js";
import {
  hashPlatformReleaseManifestV2,
  parsePlatformReleaseManifestCandidateV2,
  type PlatformReleaseManifestV2,
} from "../execution/schemas/platform-release-manifest-v2.js";
import {
  hashPlatformReleaseContentStoreTestMembershipV2,
  hashPlatformReleaseContentStoreTestNativePublicationV2,
  hashPlatformReleaseContentStoreTestDirectoryMembershipV2,
  hashPlatformReleaseContentStoreTestReleaseMembershipV2,
  hashPlatformReleaseContentStoreTestV2,
  parsePlatformReleaseContentStoreTestCandidateV2,
  PLATFORM_RELEASE_CONTENT_STORE_TEST_ATTESTATION_LEASE_POLICY_V2,
  PLATFORM_RELEASE_CONTENT_STORE_TEST_CONDITIONAL_UNLINK_POLICY_V2,
  PLATFORM_RELEASE_CONTENT_STORE_TEST_CONTENT_LEASE_POLICY_V2,
  PLATFORM_RELEASE_CONTENT_STORE_TEST_MAX_FILE_BYTES_V2,
  PLATFORM_RELEASE_CONTENT_STORE_TEST_EPHEMERAL_LOCK_POLICY_V2,
  PLATFORM_RELEASE_CONTENT_STORE_TEST_EXACT_CLEANUP_POLICY_V2,
  PLATFORM_RELEASE_CONTENT_STORE_TEST_FILESYSTEM_CAPABILITY_V2,
  PLATFORM_RELEASE_CONTENT_STORE_TEST_PUBLICATION_BACKEND_V2,
  PLATFORM_RELEASE_CONTENT_STORE_TEST_STALE_LEASE_RECOVERY_POLICY_V2,
  type PlatformReleaseContentStoreTestFenceV2,
  type PlatformReleaseContentStoreTestObservationV2,
  type PlatformReleaseContentStoreTestV2,
} from "../execution/schemas/platform-release-content-store-test-v2.js";
import {
  inspectPlatformReleaseContentStoreDarwinFilesystemFixtureV2,
  runPlatformReleaseContentStoreDarwinFilesystemFixtureV2,
  type PlatformReleaseContentStoreDarwinFilesystemExpectedDirectoryV2,
  type PlatformReleaseContentStoreDarwinFilesystemFixtureInspectionV2,
  type PlatformReleaseContentStoreDarwinFilesystemFixtureRunResultV2,
  type PlatformReleaseContentStoreDarwinFilesystemFixtureV2,
  type PlatformReleaseContentStoreDarwinFilesystemPhysicalEvidenceV2,
} from "./platform-release-content-store-darwin-filesystem-fixture-v2.js";
import {
  defaultNodeToolchainProvisionerHostIdentityHashV3,
} from "./node-toolchain-provisioner-physical-census-v3.js";

const ROOT_PREFIX_V2 = "setfarm-platform-release-content-store-test-v2-";
const STORE_CHILDREN_V2 = [".locks", ".staging", "attestations", "releases"] as const;
const STORE_ROOT_MODE_V2 = "0700" as const;
const RELEASE_ROOT_MODE_V2 = "0555" as const;
const CONTENT_FILE_MODE_V2 = "0444" as const;
const STAGE_MODE_V2 = 0o700;
const MAX_CONTENT_BYTES_V2 = PLATFORM_RELEASE_CONTENT_STORE_TEST_MAX_FILE_BYTES_V2;
const MAX_CLEANUP_INVENTORY_ENTRIES_V2 = 128;

export type PlatformReleaseContentStoreTestErrorCodeV2 =
  | "CONTENT_STORE_PLATFORM_UNAVAILABLE"
  | "CONTENT_STORE_FIXTURE_BUILD_FAILED"
  | "CONTENT_STORE_FIXTURE_HANDLE_UNAUTHENTICATED"
  | "CONTENT_STORE_STAGE_HANDLE_UNAUTHENTICATED"
  | "CONTENT_STORE_RECEIPT_UNAUTHENTICATED"
  | "CONTENT_STORE_STAGE_INVALID"
  | "CONTENT_STORE_CANDIDATE_INVALID"
  | "CONTENT_STORE_CHALLENGE_INVALID"
  | "CONTENT_STORE_PUBLICATION_INVALID"
  | "CONTENT_STORE_REPRODUCTION_INVALID"
  | "CONTENT_STORE_FILESYSTEM_DRIFT"
  | "CONTENT_STORE_CLEANUP_FAILED"
  | "CONTENT_STORE_DISPOSE_INVALID";

export class PlatformReleaseContentStoreTestErrorV2 extends Error {
  constructor(
    readonly code: PlatformReleaseContentStoreTestErrorCodeV2,
    message: string,
    options?: ErrorOptions,
  ) {
    super(`${code}: ${message}`.slice(0, 2_000), options);
    this.name = "PlatformReleaseContentStoreTestErrorV2";
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

type IdentityV2 = Readonly<{ device: string; inode: string }>;

type CleanupObjectKindV2 = "ordinary_file" | "directory" | "symbolic_link";

type CleanupInventoryEntryV2 = Readonly<{
  relativePath: string;
  identity: IdentityV2;
  objectKind: CleanupObjectKindV2;
  ownerUid: bigint;
  ownerGid: bigint;
  mode: string;
}>;

type CleanupInventoryV2 = Map<string, CleanupInventoryEntryV2>;

type PrivateRootV2 = Readonly<{
  alias: string;
  root: string;
  stat: BigIntStatV2;
  cleanupInventory: CleanupInventoryV2;
}>;

type CleanupReplacementMutationV2 = Readonly<{
  kind: "descendant" | "root";
  foreignAlias: string;
  foreignIdentity: IdentityV2;
  foreignInventory: CleanupInventoryV2;
  targetRelativePath: "" | ".staging";
  displacedAlias?: string;
}>;

export type PlatformReleaseContentStoreTestStageV2 = Readonly<{
  manifestPayloadHash: string;
  attestationHash: string;
  manifestByteLength: number;
  attestationByteLength: number;
  dispose(): void;
}>;

export type PlatformReleaseContentStoreTestFixtureV2 = Readonly<{
  dispose(): void;
}>;

export type PlatformReleaseContentStoreTestMutationV2 =
  | "replace_manifest_same_bytes"
  | "replace_manifest_different_bytes"
  | "replace_attestation_same_bytes"
  | "replace_locks_root_same_layout"
  | "replace_staging_root_same_layout"
  | "add_release_extra_file"
  | "add_staging_extra_file"
  | "add_attestations_extra_file"
  | "add_releases_extra_directory"
  | "remove_attestation"
  | "remove_release_and_attestation";

export type PlatformReleaseContentStoreTestPrePublicationMutationV2 =
  | "replace_locks_root_with_external_symlink"
  | "replace_staging_root_with_external_symlink"
  | "replace_attestations_root_with_external_symlink"
  | "replace_releases_root_with_external_symlink";

export type PlatformReleaseContentStoreTestCleanupReplacementMutationV2 =
  | "replace_descendant_with_foreign_tree"
  | "replace_root_with_foreign_tree";

export type PlatformReleaseContentStoreTestFaultV2 = Readonly<{
  checkpoint:
    | "replace_staging_root_before_cleanup"
    | "replace_lock_before_release"
    | "replace_staging_root_before_cleanup_and_lock_before_release"
    | "fail_after_staging_allocation"
    | "fail_publication_and_replace_staging_before_cleanup_and_lock_before_release";
}>;

type StageStateV2 = {
  manifest: PlatformReleaseManifestV2;
  buildAttestation: PlatformReleaseBuildAttestationV2;
  manifestBytes: Buffer;
  attestationBytes: Buffer;
  consumed: boolean;
};

type FixtureStateV2 = {
  alias: string;
  root: string;
  rootIdentity: IdentityV2;
  childIdentities: Readonly<Record<(typeof STORE_CHILDREN_V2)[number], IdentityV2>>;
  ownerUid: number;
  ownerGid: number;
  hostIdentityHash: string;
  nativeFilesystemFixture: PlatformReleaseContentStoreDarwinFilesystemFixtureV2;
  nativeFilesystemIdentity: PlatformReleaseContentStoreDarwinFilesystemFixtureInspectionV2;
  cleanupInventory: CleanupInventoryV2;
  cleanupReplacementMutation?: CleanupReplacementMutationV2;
  activeLockName?: string;
  lifecycle: "open" | "cleaning" | "cleanup_failed" | "disposed";
  disposeFaultOnce?: "before_cleanup" | "after_external_cleanup";
  committedPublication?: Readonly<{
    manifestPayloadHash: string;
    attestationHash: string;
    fence: PlatformReleaseContentStoreTestFenceV2;
  }>;
  prePublicationMutation?: Readonly<{
    kind: PlatformReleaseContentStoreTestPrePublicationMutationV2;
    externalAlias: string;
    externalRoot: string;
    externalIdentity: IdentityV2;
    externalBaseline: BigIntStatV2;
    externalInventory: CleanupInventoryV2;
    externalCanaryIdentity?: IdentityV2;
  }>;
};

type ReceiptStateV2 = {
  fixture: FixtureStateV2;
  manifestPath: string;
  attestationPath: string;
  manifestBytes: Buffer;
  attestationBytes: Buffer;
};

type ReleaseLockV2 = Readonly<{
  path: string;
  descriptor: number;
  identity: IdentityV2;
  parentIdentity: IdentityV2;
}>;

const stageStatesV2 = new WeakMap<object, StageStateV2>();
const fixtureStatesV2 = new WeakMap<object, FixtureStateV2>();
const receiptStatesV2 = new WeakMap<object, ReceiptStateV2>();

function failV2(
  code: PlatformReleaseContentStoreTestErrorCodeV2,
  message: string,
  cause?: unknown,
): never {
  throw platformReleaseContentStoreErrorV2(code, message, cause);
}

function platformReleaseContentStoreErrorV2(
  code: PlatformReleaseContentStoreTestErrorCodeV2,
  message: string,
  cause?: unknown,
): PlatformReleaseContentStoreTestErrorV2 {
  return new PlatformReleaseContentStoreTestErrorV2(
    code,
    message,
    cause === undefined ? undefined : { cause },
  );
}

function closeDescriptorPreservingFailureV2(
  descriptor: number,
  primary: unknown,
  fallbackCode: PlatformReleaseContentStoreTestErrorCodeV2,
  message: string,
): void {
  if (descriptor < 0) return;
  try {
    closeSync(descriptor);
  } catch (closeError) {
    if (primary instanceof PlatformReleaseContentStoreTestErrorV2) {
      throw platformReleaseContentStoreErrorV2(
        primary.code,
        message,
        new AggregateError([primary, closeError]),
      );
    }
    if (primary !== undefined) {
      throw platformReleaseContentStoreErrorV2(
        fallbackCode,
        message,
        new AggregateError([primary, closeError]),
      );
    }
    throw platformReleaseContentStoreErrorV2(
      fallbackCode,
      message,
      closeError,
    );
  }
}

function sha256BytesV2(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function modeTextV2(stat: BigIntStatV2): string {
  return (Number(stat.mode & 0o7777n)).toString(8).padStart(4, "0");
}

function identityV2(stat: BigIntStatV2): IdentityV2 {
  return Object.freeze({
    device: stat.dev.toString(10),
    inode: stat.ino.toString(10),
  });
}

function sameIdentityV2(left: IdentityV2, right: IdentityV2): boolean {
  return left.device === right.device && left.inode === right.inode;
}

function sameStatV2(left: BigIntStatV2, right: BigIntStatV2): boolean {
  return sameIdentityV2(identityV2(left), identityV2(right))
    && left.uid === right.uid
    && left.gid === right.gid
    && left.mode === right.mode
    && left.nlink === right.nlink
    && left.size === right.size
    && left.mtimeNs === right.mtimeNs
    && left.ctimeNs === right.ctimeNs;
}

function withCloexecV2(flags: number): number {
  const maybeCloexec = (fsConstants as unknown as Record<string, number>).O_CLOEXEC;
  return flags | (maybeCloexec ?? 0);
}

function cleanupObjectKindV2(stat: BigIntStatV2): CleanupObjectKindV2 {
  if (stat.isSymbolicLink()) return "symbolic_link";
  if (stat.isDirectory()) return "directory";
  if (stat.isFile()) return "ordinary_file";
  return failV2("CONTENT_STORE_CLEANUP_FAILED", "Cleanup inventory rejected a special filesystem object");
}

function cleanupAbsolutePathV2(root: string, relativePath: string): string {
  if (relativePath === "") return root;
  if (
    path.isAbsolute(relativePath)
    || relativePath.split(path.sep).some((component) => component === "" || component === "." || component === "..")
  ) {
    return failV2("CONTENT_STORE_CLEANUP_FAILED", "Cleanup inventory contains an unsafe relative path");
  }
  return path.join(root, relativePath);
}

function cleanupRelativePathV2(root: string, absolutePath: string): string {
  const relativePath = path.relative(root, absolutePath);
  cleanupAbsolutePathV2(root, relativePath);
  return relativePath;
}

function cleanupInventoryEntryV2(
  relativePath: string,
  stat: BigIntStatV2,
): CleanupInventoryEntryV2 {
  return Object.freeze({
    relativePath,
    identity: identityV2(stat),
    objectKind: cleanupObjectKindV2(stat),
    ownerUid: stat.uid,
    ownerGid: stat.gid,
    mode: modeTextV2(stat),
  });
}

function recordCleanupPathV2(
  root: string,
  inventory: CleanupInventoryV2,
  absolutePath: string,
): CleanupInventoryEntryV2 {
  const relativePath = cleanupRelativePathV2(root, absolutePath);
  if (!inventory.has(relativePath) && inventory.size >= MAX_CLEANUP_INVENTORY_ENTRIES_V2) {
    return failV2("CONTENT_STORE_CLEANUP_FAILED", "Cleanup inventory exceeded its code-owned bound");
  }
  const stat = lstatSync(absolutePath, { bigint: true }) as BigIntStatV2;
  const entry = cleanupInventoryEntryV2(relativePath, stat);
  inventory.set(relativePath, entry);
  return entry;
}

function forgetCleanupPathV2(
  root: string,
  inventory: CleanupInventoryV2,
  absolutePath: string,
): void {
  inventory.delete(cleanupRelativePathV2(root, absolutePath));
}

function moveCleanupInventoryPrefixV2(
  inventory: CleanupInventoryV2,
  beforeRelativePath: string,
  afterRelativePath: string,
): void {
  const moved = [...inventory.values()]
    .filter((entry) => entry.relativePath === beforeRelativePath
      || entry.relativePath.startsWith(`${beforeRelativePath}${path.sep}`))
    .sort((left, right) => left.relativePath.length - right.relativePath.length);
  if (moved.length === 0) {
    return failV2("CONTENT_STORE_CLEANUP_FAILED", "Cleanup inventory cannot move an unknown owned prefix");
  }
  const movedNames = new Set(moved.map((entry) => entry.relativePath));
  const replacements = moved.map((entry) => {
    const suffix = entry.relativePath.slice(beforeRelativePath.length);
    const relativePath = `${afterRelativePath}${suffix}`;
    return Object.freeze({ ...entry, relativePath });
  });
  const replacementNames = new Set(replacements.map((entry) => entry.relativePath));
  if (
    replacementNames.size !== replacements.length
    || replacements.some((entry) => inventory.has(entry.relativePath) && !movedNames.has(entry.relativePath))
  ) {
    return failV2("CONTENT_STORE_CLEANUP_FAILED", "Cleanup inventory prefix move collided");
  }
  for (const entry of moved) inventory.delete(entry.relativePath);
  for (const entry of replacements) {
    inventory.set(entry.relativePath, entry);
  }
}

function cleanupEntryMatchesStatV2(
  entry: CleanupInventoryEntryV2,
  stat: BigIntStatV2,
): boolean {
  return cleanupObjectKindV2(stat) === entry.objectKind
    && sameIdentityV2(identityV2(stat), entry.identity)
    && stat.uid === entry.ownerUid
    && stat.gid === entry.ownerGid
    && modeTextV2(stat) === entry.mode;
}

function selectedCleanupEntriesV2(
  inventory: CleanupInventoryV2,
  cleanupRootRelativePath: string,
): CleanupInventoryEntryV2[] {
  const selected = [...inventory.values()].filter((entry) =>
    cleanupRootRelativePath === ""
      || entry.relativePath === cleanupRootRelativePath
      || entry.relativePath.startsWith(`${cleanupRootRelativePath}${path.sep}`));
  if (
    selected.length === 0
    || selected.length > MAX_CLEANUP_INVENTORY_ENTRIES_V2
    || !selected.some((entry) => entry.relativePath === cleanupRootRelativePath)
  ) {
    return failV2("CONTENT_STORE_CLEANUP_FAILED", "Cleanup inventory has no bounded owned root");
  }
  return selected;
}

function directCleanupChildNamesV2(
  entries: readonly CleanupInventoryEntryV2[],
  directoryRelativePath: string,
): string[] {
  return entries
    .filter((candidate) => candidate.relativePath !== directoryRelativePath
      && path.dirname(candidate.relativePath) === (directoryRelativePath === "" ? "." : directoryRelativePath))
    .map((candidate) => path.basename(candidate.relativePath))
    .sort();
}

function assertCleanupEntryV2(
  root: string,
  entry: CleanupInventoryEntryV2,
  message: string,
): BigIntStatV2 {
  let stat: BigIntStatV2;
  try {
    stat = lstatSync(cleanupAbsolutePathV2(root, entry.relativePath), { bigint: true }) as BigIntStatV2;
  } catch (error) {
    return failV2("CONTENT_STORE_CLEANUP_FAILED", message, error);
  }
  if (!cleanupEntryMatchesStatV2(entry, stat)) {
    return failV2("CONTENT_STORE_CLEANUP_FAILED", message);
  }
  return stat;
}

function assertCleanupDirectoryMembershipV2(
  root: string,
  inventory: CleanupInventoryV2,
  cleanupRootRelativePath: string,
  directoryEntry: CleanupInventoryEntryV2,
): void {
  assertCleanupEntryV2(root, directoryEntry, "Cleanup directory identity changed before membership admission");
  const entries = selectedCleanupEntriesV2(inventory, cleanupRootRelativePath);
  const actual = readdirSync(cleanupAbsolutePathV2(root, directoryEntry.relativePath)).sort();
  const expected = directCleanupChildNamesV2(entries, directoryEntry.relativePath);
  if (actual.length > MAX_CLEANUP_INVENTORY_ENTRIES_V2) {
    return failV2(
      "CONTENT_STORE_CLEANUP_FAILED",
      "Cleanup directory membership exceeded its bounded inventory and was preserved",
    );
  }
  if (canonicalJsonStringify(actual) !== canonicalJsonStringify(expected)) {
    return failV2(
      "CONTENT_STORE_CLEANUP_FAILED",
      `Cleanup directory ${directoryEntry.relativePath || "."} contains unexpected membership (${canonicalJsonStringify({ actual, expected })})`,
    );
  }
}

function changeOwnedCleanupDirectoryModeV2(
  root: string,
  inventory: CleanupInventoryV2,
  absolutePath: string,
  mode: number,
): void {
  const relativePath = cleanupRelativePathV2(root, absolutePath);
  const entry = inventory.get(relativePath);
  if (entry === undefined || entry.objectKind !== "directory") {
    return failV2("CONTENT_STORE_CLEANUP_FAILED", "Directory mode change requires one inventoried owned directory");
  }
  const expectedMode = mode.toString(8).padStart(4, "0");
  if (entry.mode === expectedMode) return;
  let descriptor = -1;
  let primary: unknown;
  try {
    descriptor = openSync(
      absolutePath,
      withCloexecV2(fsConstants.O_RDONLY | (fsConstants.O_DIRECTORY ?? 0) | (fsConstants.O_NOFOLLOW ?? 0)),
    );
    const before = fstatSync(descriptor, { bigint: true }) as BigIntStatV2;
    if (!cleanupEntryMatchesStatV2(entry, before)) {
      return failV2("CONTENT_STORE_CLEANUP_FAILED", "Cleanup directory changed before descriptor-relative mode preparation");
    }
    fchmodSync(descriptor, mode);
    const after = fstatSync(descriptor, { bigint: true }) as BigIntStatV2;
    if (
      cleanupObjectKindV2(after) !== "directory"
      || !sameIdentityV2(identityV2(after), entry.identity)
      || after.uid !== entry.ownerUid
      || after.gid !== entry.ownerGid
      || modeTextV2(after) !== expectedMode
    ) {
      return failV2("CONTENT_STORE_CLEANUP_FAILED", "Cleanup directory changed during descriptor-relative mode preparation");
    }
    inventory.set(entry.relativePath, cleanupInventoryEntryV2(entry.relativePath, after));
  } catch (error) {
    primary = error;
    throw error;
  } finally {
    closeDescriptorPreservingFailureV2(
      descriptor,
      primary,
      "CONTENT_STORE_CLEANUP_FAILED",
      "Cleanup directory preparation and descriptor close both failed",
    );
  }
}

function makeCleanupDirectoryWritableV2(
  root: string,
  inventory: CleanupInventoryV2,
  entry: CleanupInventoryEntryV2,
): void {
  if (entry.objectKind !== "directory" || entry.mode === "0700") return;
  changeOwnedCleanupDirectoryModeV2(
    root,
    inventory,
    cleanupAbsolutePathV2(root, entry.relativePath),
    0o700,
  );
}

function assertExactOwnedTreeV2(
  root: string,
  inventory: CleanupInventoryV2,
  cleanupRootRelativePath = "",
): CleanupInventoryEntryV2[] {
  const selected = selectedCleanupEntriesV2(inventory, cleanupRootRelativePath);
  for (const entry of selected) {
    assertCleanupEntryV2(root, entry, "Cleanup object identity, owner, kind, or mode changed");
  }
  for (const entry of selected.filter((candidate) => candidate.objectKind === "directory")) {
    assertCleanupDirectoryMembershipV2(root, inventory, cleanupRootRelativePath, entry);
  }
  return selected;
}

function cleanupExactOwnedTreeV2(
  root: string,
  inventory: CleanupInventoryV2,
  cleanupRootRelativePath = "",
): void {
  // Node exposes neither unlinkat(2) nor an inode-conditional unlink. Every
  // pathname leaf is therefore revalidated at the last available boundary and
  // removed one-at-a-time. A same-UID writer can still race that final syscall;
  // this fixture remains productionAuthority:false. Never use recursive removal:
  // a raced directory must stay non-empty and be preserved by rmdir(2).
  let selected = assertExactOwnedTreeV2(root, inventory, cleanupRootRelativePath);

  for (const entry of selected
    .filter((candidate) => candidate.objectKind === "directory")
    .sort((left, right) => left.relativePath.length - right.relativePath.length)) {
    makeCleanupDirectoryWritableV2(root, inventory, entry);
  }

  selected = selectedCleanupEntriesV2(inventory, cleanupRootRelativePath);
  const leaves = selected
    .filter((entry) => entry.objectKind !== "directory")
    .sort((left, right) => right.relativePath.length - left.relativePath.length);
  for (const entry of leaves) {
    const parentRelativePath = path.dirname(entry.relativePath) === "." ? "" : path.dirname(entry.relativePath);
    const parent = inventory.get(parentRelativePath);
    if (parent === undefined || parent.objectKind !== "directory") {
      return failV2("CONTENT_STORE_CLEANUP_FAILED", "Cleanup leaf lost its owned parent");
    }
    assertCleanupDirectoryMembershipV2(root, inventory, cleanupRootRelativePath, parent);
    assertCleanupEntryV2(root, entry, "Cleanup leaf changed immediately before unlink");
    unlinkSync(cleanupAbsolutePathV2(root, entry.relativePath));
    inventory.delete(entry.relativePath);
    fsyncDirectoryV2(cleanupAbsolutePathV2(root, parentRelativePath));
  }

  selected = selectedCleanupEntriesV2(inventory, cleanupRootRelativePath);
  const directories = selected
    .filter((entry) => entry.objectKind === "directory" && entry.relativePath !== cleanupRootRelativePath)
    .sort((left, right) => right.relativePath.length - left.relativePath.length);
  for (const entry of directories) {
    const parentRelativePath = path.dirname(entry.relativePath) === "." ? "" : path.dirname(entry.relativePath);
    const parent = inventory.get(parentRelativePath);
    if (parent === undefined || parent.objectKind !== "directory") {
      return failV2("CONTENT_STORE_CLEANUP_FAILED", "Cleanup directory lost its owned parent");
    }
    assertCleanupDirectoryMembershipV2(root, inventory, cleanupRootRelativePath, entry);
    assertCleanupDirectoryMembershipV2(root, inventory, cleanupRootRelativePath, parent);
    rmdirSync(cleanupAbsolutePathV2(root, entry.relativePath));
    inventory.delete(entry.relativePath);
    fsyncDirectoryV2(cleanupAbsolutePathV2(root, parentRelativePath));
  }

  const cleanupRoot = inventory.get(cleanupRootRelativePath);
  if (cleanupRoot === undefined || cleanupRoot.objectKind !== "directory") {
    return failV2("CONTENT_STORE_CLEANUP_FAILED", "Cleanup root ownership disappeared before final removal");
  }
  assertCleanupDirectoryMembershipV2(root, inventory, cleanupRootRelativePath, cleanupRoot);
  rmdirSync(cleanupAbsolutePathV2(root, cleanupRootRelativePath));
  inventory.delete(cleanupRootRelativePath);
  if (cleanupRootRelativePath !== "") {
    const parentRelativePath = path.dirname(cleanupRootRelativePath) === "." ? "" : path.dirname(cleanupRootRelativePath);
    fsyncDirectoryV2(cleanupAbsolutePathV2(root, parentRelativePath));
  }
}

function privateRootV2(): PrivateRootV2 {
  const alias = mkdtempSync(path.join(os.tmpdir(), ROOT_PREFIX_V2));
  const cleanupInventory: CleanupInventoryV2 = new Map();
  try {
    const root = realpathSync(alias);
    chmodSync(root, 0o700);
    const stat = lstatSync(root, { bigint: true }) as BigIntStatV2;
    const ownerMatches =
      (typeof process.getuid !== "function" || Number(stat.uid) === process.getuid())
      && (typeof process.getgid !== "function" || Number(stat.gid) === process.getgid());
    if (stat.isSymbolicLink() || !stat.isDirectory() || modeTextV2(stat) !== STORE_ROOT_MODE_V2 || !ownerMatches) {
      throw new Error("private root policy mismatch");
    }
    recordCleanupPathV2(root, cleanupInventory, root);
    return Object.freeze({ alias, root, stat, cleanupInventory });
  } catch (error) {
    let cleanupError: unknown;
    if (cleanupInventory.has("")) {
      try { cleanupExactOwnedTreeV2(alias, cleanupInventory); } catch (candidate) { cleanupError = candidate; }
    }
    if (cleanupError !== undefined) {
      return failV2(
        "CONTENT_STORE_FIXTURE_BUILD_FAILED",
        "Private-root construction failed and exact nonrecursive cleanup also failed",
        new AggregateError([error, cleanupError]),
      );
    }
    return failV2("CONTENT_STORE_FIXTURE_BUILD_FAILED", "Could not create a private process-owned store root", error);
  }
}

function removeOwnedStagingRootV2(
  state: FixtureStateV2,
  stagingRoot: string,
  expectedIdentity: IdentityV2,
): void {
  try {
    assertPersistentStoreChildAnchorV2(
      state,
      ".staging",
      "Staging parent changed before exact cleanup",
    );
    const current = lstatSync(stagingRoot, { bigint: true }) as BigIntStatV2;
    const stagingParent = path.join(state.root, ".staging");
    if (current.isSymbolicLink()
        || !current.isDirectory()
        || modeTextV2(current) !== "0700"
        || !sameIdentityV2(identityV2(current), expectedIdentity)
        || realpathSync(path.dirname(stagingRoot)) !== realpathSync(stagingParent)) {
      return failV2("CONTENT_STORE_CLEANUP_FAILED", "Staging root identity changed before exact cleanup");
    }
    assertPersistentStoreChildAnchorV2(
      state,
      ".staging",
      "Staging parent changed during exact cleanup",
    );
    const afterPrepare = lstatSync(stagingRoot, { bigint: true }) as BigIntStatV2;
    if (afterPrepare.isSymbolicLink()
        || !afterPrepare.isDirectory()
        || modeTextV2(afterPrepare) !== "0700"
        || !sameIdentityV2(identityV2(afterPrepare), expectedIdentity)
        || realpathSync(path.dirname(stagingRoot)) !== realpathSync(stagingParent)) {
      return failV2("CONTENT_STORE_CLEANUP_FAILED", "Staging root identity changed during exact cleanup");
    }
    cleanupExactOwnedTreeV2(
      state.root,
      state.cleanupInventory,
      cleanupRelativePathV2(state.root, stagingRoot),
    );
    assertPersistentStoreChildAnchorV2(
      state,
      ".staging",
      "Staging parent changed after exact cleanup",
    );
  } catch (error) {
    if (
      error instanceof PlatformReleaseContentStoreTestErrorV2
      && error.code === "CONTENT_STORE_CLEANUP_FAILED"
    ) throw error;
    return failV2(
      "CONTENT_STORE_CLEANUP_FAILED",
      "Exact staging cleanup failed and the untrusted root was preserved",
      error,
    );
  }
}

function expectedStoreChildrenV2(): readonly string[] {
  return [...STORE_CHILDREN_V2];
}

function assertSortedExactV2(actual: readonly string[], expected: readonly string[], message: string): void {
  const actualSorted = [...actual].sort();
  const expectedSorted = [...expected].sort();
  if (canonicalJsonStringify(actualSorted) !== canonicalJsonStringify(expectedSorted)) {
    return failV2("CONTENT_STORE_FILESYSTEM_DRIFT", message);
  }
}

function ensureDirectoryV2(absolutePath: string, mode: number): void {
  mkdirSync(absolutePath, { mode });
  chmodSync(absolutePath, mode);
  const stat = lstatSync(absolutePath, { bigint: true }) as BigIntStatV2;
  if (stat.isSymbolicLink() || !stat.isDirectory() || modeTextV2(stat) !== mode.toString(8).padStart(4, "0")) {
    return failV2("CONTENT_STORE_FILESYSTEM_DRIFT", `Directory ${absolutePath} violates its mode or object-kind policy`);
  }
}

function fsyncDirectoryV2(absolutePath: string): void {
  let descriptor = -1;
  let primary: unknown;
  try {
    descriptor = openSync(
      absolutePath,
      withCloexecV2(fsConstants.O_RDONLY | (fsConstants.O_DIRECTORY ?? 0) | (fsConstants.O_NOFOLLOW ?? 0)),
    );
    fsyncSync(descriptor);
  } catch (error) {
    primary = error instanceof PlatformReleaseContentStoreTestErrorV2
      ? error
      : platformReleaseContentStoreErrorV2(
        "CONTENT_STORE_FILESYSTEM_DRIFT",
        `Directory ${absolutePath} could not be durably synced`,
        error,
      );
    throw primary;
  } finally {
    closeDescriptorPreservingFailureV2(
      descriptor,
      primary,
      "CONTENT_STORE_FILESYSTEM_DRIFT",
      `Directory ${absolutePath} sync and descriptor close both failed`,
    );
  }
}

function assertDirectoryIdentityV2(
  absolutePath: string,
  expectedIdentity: IdentityV2,
  message: string,
): void {
  let stat: BigIntStatV2;
  try {
    stat = lstatSync(absolutePath, { bigint: true }) as BigIntStatV2;
  } catch (error) {
    return failV2("CONTENT_STORE_FILESYSTEM_DRIFT", message, error);
  }
  if (
    stat.isSymbolicLink()
    || !stat.isDirectory()
    || !sameIdentityV2(identityV2(stat), expectedIdentity)
  ) {
    return failV2("CONTENT_STORE_FILESYSTEM_DRIFT", message);
  }
}

function assertPersistentStoreChildAnchorV2(
  state: FixtureStateV2,
  child: (typeof STORE_CHILDREN_V2)[number],
  message: string,
): BigIntStatV2 {
  let stat: BigIntStatV2;
  try {
    stat = lstatSync(path.join(state.root, child), { bigint: true }) as BigIntStatV2;
  } catch (error) {
    return failV2("CONTENT_STORE_FILESYSTEM_DRIFT", message, error);
  }
  if (
    stat.isSymbolicLink()
    || !stat.isDirectory()
    || !sameIdentityV2(identityV2(stat), state.childIdentities[child])
    || stat.uid !== BigInt(state.ownerUid)
    || stat.gid !== BigInt(state.ownerGid)
    || modeTextV2(stat) !== STORE_ROOT_MODE_V2
  ) {
    return failV2("CONTENT_STORE_FILESYSTEM_DRIFT", message);
  }
  return stat;
}

function assertPersistentStoreAnchorsV2(state: FixtureStateV2, phase: string): void {
  for (const child of STORE_CHILDREN_V2) {
    assertPersistentStoreChildAnchorV2(
      state,
      child,
      `Persistent store child ${child} changed ${phase}`,
    );
  }
}

function writeExclusiveFileV2(absolutePath: string, bytes: Buffer, mode: number): void {
  if (bytes.byteLength < 1 || bytes.byteLength > MAX_CONTENT_BYTES_V2) {
    return failV2("CONTENT_STORE_PUBLICATION_INVALID", "Content file exceeds its bounded byte policy");
  }
  let descriptor = -1;
  let primary: unknown;
  try {
    descriptor = openSync(
      absolutePath,
      withCloexecV2(fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL | (fsConstants.O_NOFOLLOW ?? 0)),
      mode,
    );
    let offset = 0;
    while (offset < bytes.byteLength) {
      const written = writeSync(descriptor, bytes, offset, bytes.byteLength - offset);
      if (written <= 0) return failV2("CONTENT_STORE_FILESYSTEM_DRIFT", "Content file write reached a zero-progress boundary");
      offset += written;
    }
    fchmodSync(descriptor, mode);
    fsyncSync(descriptor);
  } catch (error) {
    primary = error instanceof PlatformReleaseContentStoreTestErrorV2
      ? error
      : platformReleaseContentStoreErrorV2(
        "CONTENT_STORE_PUBLICATION_INVALID",
        `Could not write ${absolutePath} without replacement`,
        error,
      );
    throw primary;
  } finally {
    closeDescriptorPreservingFailureV2(
      descriptor,
      primary,
      "CONTENT_STORE_PUBLICATION_INVALID",
      `Content write and descriptor close both failed for ${absolutePath}`,
    );
  }
}

let stableHostIdentityHashCacheV2: string | undefined;

function stableHostIdentityHashV2(): string {
  stableHostIdentityHashCacheV2 ??=
    defaultNodeToolchainProvisionerHostIdentityHashV3();
  return stableHostIdentityHashCacheV2;
}

function observationV2(
  stableIdentity: Readonly<{
    hostIdentityHash: string;
    objectKind: "ordinary_file" | "directory";
    device: string;
    inode: string;
  }>,
  mutableFingerprint: Readonly<{
    ownerUid: number;
    ownerGid: number;
    mode: string;
    linkCount: number;
    byteLength: number;
    contentHash: string;
    modifiedTimeNanoseconds: string;
    changedTimeNanoseconds: string;
  }>,
): PlatformReleaseContentStoreTestObservationV2 {
  const identity = { stableIdentity, mutableFingerprint };
  return Object.freeze({
    ...identity,
    observationHash: hashCanonicalJson({
      schema: "setfarm.platform-release-content-store-test-observation-hash.v2",
      observation: identity,
    }),
  }) as PlatformReleaseContentStoreTestObservationV2;
}

function captureFileV2(
  absolutePath: string,
  hostIdentityHash: string,
  expectedBytes?: Uint8Array,
): PlatformReleaseContentStoreTestObservationV2 {
  let descriptor = -1;
  let primary: unknown;
  try {
    const pathBefore = lstatSync(absolutePath, { bigint: true }) as BigIntStatV2;
    if (pathBefore.isSymbolicLink() || !pathBefore.isFile() || pathBefore.nlink !== 1n || modeTextV2(pathBefore) !== CONTENT_FILE_MODE_V2 || pathBefore.size < 1n || pathBefore.size > BigInt(MAX_CONTENT_BYTES_V2)) {
      return failV2("CONTENT_STORE_FILESYSTEM_DRIFT", `Content file ${absolutePath} is not a bounded read-only single-link file`);
    }
    descriptor = openSync(absolutePath, withCloexecV2(fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0)));
    const descriptorBefore = fstatSync(descriptor, { bigint: true }) as BigIntStatV2;
    if (!sameStatV2(pathBefore, descriptorBefore) || descriptorBefore.isSymbolicLink() || !descriptorBefore.isFile()) {
      return failV2("CONTENT_STORE_FILESYSTEM_DRIFT", "Content file changed between path and descriptor admission");
    }
    const byteLength = Number(descriptorBefore.size);
    const bytes = Buffer.alloc(byteLength);
    const digest = createHash("sha256");
    let offset = 0;
    while (offset < byteLength) {
      const count = readSync(descriptor, bytes, offset, byteLength - offset, offset);
      if (count <= 0) return failV2("CONTENT_STORE_FILESYSTEM_DRIFT", "Content file reached EOF before its descriptor length");
      digest.update(bytes.subarray(offset, offset + count));
      offset += count;
    }
    const eof = Buffer.alloc(1);
    if (readSync(descriptor, eof, 0, 1, byteLength) !== 0) {
      eof.fill(0);
      return failV2("CONTENT_STORE_FILESYSTEM_DRIFT", "Content file grew during its bounded descriptor read");
    }
    eof.fill(0);
    if (expectedBytes !== undefined && !Buffer.from(expectedBytes).equals(bytes)) {
      bytes.fill(0);
      return failV2("CONTENT_STORE_FILESYSTEM_DRIFT", "Content file bytes differ from the staged canonical payload");
    }
    const descriptorAfter = fstatSync(descriptor, { bigint: true }) as BigIntStatV2;
    const pathAfter = lstatSync(absolutePath, { bigint: true }) as BigIntStatV2;
    if (!sameStatV2(descriptorBefore, descriptorAfter) || !sameStatV2(descriptorAfter, pathAfter)) {
      bytes.fill(0);
      return failV2("CONTENT_STORE_FILESYSTEM_DRIFT", "Content file changed during its descriptor-bounded observation");
    }
    const stableIdentity = {
      hostIdentityHash,
      objectKind: "ordinary_file" as const,
      device: descriptorAfter.dev.toString(10),
      inode: descriptorAfter.ino.toString(10),
    };
    const mutableFingerprint = {
      ownerUid: Number(descriptorAfter.uid),
      ownerGid: Number(descriptorAfter.gid),
      mode: modeTextV2(descriptorAfter),
      linkCount: Number(descriptorAfter.nlink),
      byteLength,
      contentHash: digest.digest("hex"),
      modifiedTimeNanoseconds: descriptorAfter.mtimeNs.toString(10),
      changedTimeNanoseconds: descriptorAfter.ctimeNs.toString(10),
    };
    bytes.fill(0);
    return observationV2(stableIdentity, mutableFingerprint);
  } catch (error) {
    primary = error instanceof PlatformReleaseContentStoreTestErrorV2
      ? error
      : platformReleaseContentStoreErrorV2(
        "CONTENT_STORE_FILESYSTEM_DRIFT",
        `Could not capture content file ${absolutePath}`,
        error,
      );
    throw primary;
  } finally {
    closeDescriptorPreservingFailureV2(
      descriptor,
      primary,
      "CONTENT_STORE_FILESYSTEM_DRIFT",
      `Content capture and descriptor close both failed for ${absolutePath}`,
    );
  }
}

function captureDirectoryV2(
  absolutePath: string,
  hostIdentityHash: string,
  expectedMode: "0700" | "0555",
  expectedChildren: readonly string[],
  membershipHash: string,
  membershipEntries: readonly string[] = expectedChildren,
): PlatformReleaseContentStoreTestObservationV2 {
  let descriptor = -1;
  let primary: unknown;
  try {
    const pathBefore = lstatSync(absolutePath, { bigint: true }) as BigIntStatV2;
    if (pathBefore.isSymbolicLink() || !pathBefore.isDirectory() || modeTextV2(pathBefore) !== expectedMode) {
      return failV2("CONTENT_STORE_FILESYSTEM_DRIFT", `Directory ${absolutePath} violates its descriptor policy`);
    }
    const names = readdirSync(absolutePath);
    assertSortedExactV2(names, expectedChildren, `Directory ${absolutePath} has unexpected members`);
    descriptor = openSync(absolutePath, withCloexecV2(fsConstants.O_RDONLY | (fsConstants.O_DIRECTORY ?? 0) | (fsConstants.O_NOFOLLOW ?? 0)));
    const descriptorBefore = fstatSync(descriptor, { bigint: true }) as BigIntStatV2;
    if (!sameStatV2(pathBefore, descriptorBefore)) {
      return failV2("CONTENT_STORE_FILESYSTEM_DRIFT", "Directory changed between path and descriptor admission");
    }
    const namesAfterRead = readdirSync(absolutePath);
    assertSortedExactV2(namesAfterRead, expectedChildren, `Directory ${absolutePath} changed during census`);
    const descriptorAfter = fstatSync(descriptor, { bigint: true }) as BigIntStatV2;
    const pathAfter = lstatSync(absolutePath, { bigint: true }) as BigIntStatV2;
    if (!sameStatV2(descriptorBefore, descriptorAfter) || !sameStatV2(descriptorAfter, pathAfter)) {
      return failV2("CONTENT_STORE_FILESYSTEM_DRIFT", "Directory changed during its descriptor-bounded observation");
    }
    const membershipBytes = canonicalJsonBytes(membershipEntries);
    return observationV2(
      {
        hostIdentityHash,
        objectKind: "directory",
        device: descriptorAfter.dev.toString(10),
        inode: descriptorAfter.ino.toString(10),
      },
      {
        ownerUid: Number(descriptorAfter.uid),
        ownerGid: Number(descriptorAfter.gid),
        mode: modeTextV2(descriptorAfter),
        linkCount: Number(descriptorAfter.nlink),
        byteLength: membershipBytes.byteLength,
        contentHash: membershipHash,
        modifiedTimeNanoseconds: descriptorAfter.mtimeNs.toString(10),
        changedTimeNanoseconds: descriptorAfter.ctimeNs.toString(10),
      },
    );
  } catch (error) {
    primary = error instanceof PlatformReleaseContentStoreTestErrorV2
      ? error
      : platformReleaseContentStoreErrorV2(
        "CONTENT_STORE_FILESYSTEM_DRIFT",
        `Could not capture directory ${absolutePath}`,
        error,
      );
    throw primary;
  } finally {
    closeDescriptorPreservingFailureV2(
      descriptor,
      primary,
      "CONTENT_STORE_FILESYSTEM_DRIFT",
      `Directory capture and descriptor close both failed for ${absolutePath}`,
    );
  }
}

function storeLayoutV2(
  state: FixtureStateV2,
  manifestPayloadHash: string,
  attestationHash: string,
): Readonly<{
  manifestPath: string;
  attestationPath: string;
  releaseRoot: string;
  stagingRoot: string;
  attestationsRoot: string;
  releasesRoot: string;
  locksRoot: string;
  storeMembershipHash: string;
  releaseMembershipHash: string;
}> {
  const stagingRoot = path.join(state.root, ".staging");
  const locksRoot = path.join(state.root, ".locks");
  const releases = path.join(state.root, "releases");
  const attestations = path.join(state.root, "attestations");
  const releaseRoot = path.join(releases, manifestPayloadHash);
  const manifestPath = path.join(releaseRoot, "manifest.json");
  const attestationPath = path.join(attestations, `${attestationHash}.json`);
  return Object.freeze({
    manifestPath,
    attestationPath,
    releaseRoot,
    stagingRoot,
    attestationsRoot: attestations,
    releasesRoot: releases,
    locksRoot,
    storeMembershipHash: hashPlatformReleaseContentStoreTestMembershipV2(manifestPayloadHash, attestationHash),
    releaseMembershipHash: hashPlatformReleaseContentStoreTestReleaseMembershipV2(),
  });
}

function directoryMembershipHashV2(relativePath: string, entries: readonly string[]): string {
  return hashPlatformReleaseContentStoreTestDirectoryMembershipV2(relativePath, entries);
}

function storeMembershipEntriesV2(manifestPayloadHash: string, attestationHash: string): readonly string[] {
  return [
    ...STORE_CHILDREN_V2,
    `attestations/${attestationHash}.json`,
    `releases/${manifestPayloadHash}`,
    `releases/${manifestPayloadHash}/manifest.json`,
  ];
}

function assertStoreShapeV2(
  state: FixtureStateV2,
  layout: ReturnType<typeof storeLayoutV2>,
): void {
  if (state.lifecycle !== "open") return failV2("CONTENT_STORE_FIXTURE_HANDLE_UNAUTHENTICATED", "Fixture is not in its open lifecycle");
  const root = lstatSync(state.root, { bigint: true }) as BigIntStatV2;
  if (root.isSymbolicLink() || !root.isDirectory() || modeTextV2(root) !== STORE_ROOT_MODE_V2 || !sameIdentityV2(identityV2(root), state.rootIdentity)) {
    return failV2("CONTENT_STORE_FIXTURE_HANDLE_UNAUTHENTICATED", "Fixture root is not the original private directory");
  }
  if (Number(root.uid) !== state.ownerUid || Number(root.gid) !== state.ownerGid) {
    return failV2("CONTENT_STORE_FIXTURE_HANDLE_UNAUTHENTICATED", "Fixture root owner changed");
  }
  assertPersistentStoreAnchorsV2(state, "during store-shape admission");
  assertSortedExactV2(readdirSync(state.root), expectedStoreChildrenV2(), "Store root has unexpected children");
  assertSortedExactV2(readdirSync(path.join(state.root, ".staging")), [], "Staging directory must be empty after publication");
  assertSortedExactV2(
    readdirSync(path.join(state.root, ".locks")),
    state.activeLockName === undefined ? [] : [state.activeLockName],
    "Lock directory contains an unexpected publisher lock",
  );
  const releaseNames = readdirSync(path.join(state.root, "releases"));
  assertSortedExactV2(releaseNames, [path.basename(layout.releaseRoot)], "Release directory has unexpected releases");
  const attestationNames = readdirSync(path.join(state.root, "attestations"));
  assertSortedExactV2(attestationNames, [path.basename(layout.attestationPath)], "Attestation directory has unexpected attestations");
  const releaseStat = lstatSync(layout.releaseRoot, { bigint: true }) as BigIntStatV2;
  const attestationStat = lstatSync(layout.attestationPath, { bigint: true }) as BigIntStatV2;
  if (releaseStat.isSymbolicLink() || !releaseStat.isDirectory() || attestationStat.isSymbolicLink() || !attestationStat.isFile()) {
    return failV2("CONTENT_STORE_FILESYSTEM_DRIFT", "Published release and attestation object kinds are invalid");
  }
  assertSortedExactV2(readdirSync(layout.releaseRoot), ["manifest.json"], "Release root has unexpected children");
}

function captureFenceV2(
  state: FixtureStateV2,
  layout: ReturnType<typeof storeLayoutV2>,
): PlatformReleaseContentStoreTestFenceV2 {
  assertStoreShapeV2(state, layout);
  const storeEntries = storeMembershipEntriesV2(path.basename(layout.releaseRoot), path.basename(layout.attestationPath, ".json"));
  const storeRoot = captureDirectoryV2(
    state.root,
    state.hostIdentityHash,
    STORE_ROOT_MODE_V2,
    expectedStoreChildrenV2(),
    layout.storeMembershipHash,
    storeEntries,
  );
  const releaseRoot = captureDirectoryV2(
    layout.releaseRoot,
    state.hostIdentityHash,
    RELEASE_ROOT_MODE_V2,
    ["manifest.json"],
    layout.releaseMembershipHash,
  );
  const stagingRoot = captureDirectoryV2(
    layout.stagingRoot,
    state.hostIdentityHash,
    STORE_ROOT_MODE_V2,
    [],
    directoryMembershipHashV2(".staging", []),
  );
  const locksRoot = captureDirectoryV2(
    layout.locksRoot,
    state.hostIdentityHash,
    STORE_ROOT_MODE_V2,
    [],
    directoryMembershipHashV2(".locks", []),
  );
  const attestationsRoot = captureDirectoryV2(
    layout.attestationsRoot,
    state.hostIdentityHash,
    STORE_ROOT_MODE_V2,
    [path.basename(layout.attestationPath)],
    directoryMembershipHashV2("attestations", [path.basename(layout.attestationPath)]),
  );
  const releasesRoot = captureDirectoryV2(
    layout.releasesRoot,
    state.hostIdentityHash,
    STORE_ROOT_MODE_V2,
    [path.basename(layout.releaseRoot)],
    directoryMembershipHashV2("releases", [path.basename(layout.releaseRoot)]),
  );
  // Keep the full relative layout construction live so a future schema change cannot silently
  // make the root observation direct-children-only.
  if (canonicalJsonStringify(storeEntries) !== canonicalJsonStringify([
    ...STORE_CHILDREN_V2,
    `attestations/${path.basename(layout.attestationPath)}`,
    `releases/${path.basename(layout.releaseRoot)}`,
    `releases/${path.basename(layout.releaseRoot)}/manifest.json`,
  ])) {
    return failV2("CONTENT_STORE_FILESYSTEM_DRIFT", "Store layout membership construction is not canonical");
  }
  return Object.freeze({
    storeRoot,
    locksRoot,
    stagingRoot,
    attestationsRoot,
    releasesRoot,
    releaseRoot,
    manifest: captureFileV2(layout.manifestPath, state.hostIdentityHash),
    attestation: captureFileV2(layout.attestationPath, state.hostIdentityHash),
  });
}

function stageFromV2(stage: PlatformReleaseContentStoreTestStageV2): StageStateV2 {
  if (typeof stage !== "object" || stage === null || isProxy(stage)) {
    return failV2("CONTENT_STORE_STAGE_HANDLE_UNAUTHENTICATED", "Stage handle is not an authentic object");
  }
  const state = stageStatesV2.get(stage);
  if (state === undefined || state.consumed) {
    return failV2("CONTENT_STORE_STAGE_HANDLE_UNAUTHENTICATED", "Stage handle is not code-owned or was already consumed");
  }
  return state;
}

function fixtureFromV2(fixture: PlatformReleaseContentStoreTestFixtureV2): FixtureStateV2 {
  if (typeof fixture !== "object" || fixture === null || isProxy(fixture)) {
    return failV2("CONTENT_STORE_FIXTURE_HANDLE_UNAUTHENTICATED", "Fixture handle is not an authentic object");
  }
  const state = fixtureStatesV2.get(fixture);
  if (state === undefined || state.lifecycle !== "open") {
    return failV2("CONTENT_STORE_FIXTURE_HANDLE_UNAUTHENTICATED", "Fixture handle is not code-owned or open");
  }
  return state;
}

function receiptStateV2(receipt: PlatformReleaseContentStoreTestV2): ReceiptStateV2 {
  if (typeof receipt !== "object" || receipt === null || isProxy(receipt)) {
    return failV2("CONTENT_STORE_RECEIPT_UNAUTHENTICATED", "Receipt is not an authentic object");
  }
  const state = receiptStatesV2.get(receipt);
  if (state === undefined || state.fixture.lifecycle !== "open") {
    return failV2("CONTENT_STORE_RECEIPT_UNAUTHENTICATED", "Receipt is not code-owned or its fixture is not open");
  }
  return state;
}

function freshReproductionHashV2(value: Readonly<Record<string, unknown>>): string {
  return hashCanonicalJson({
    schema: "setfarm.platform-release-content-store-test.v2.fresh-reproduction.v2",
    reproduction: value,
  });
}

function committedFenceProjectionV2(
  fence: PlatformReleaseContentStoreTestFenceV2,
): Readonly<Record<string, unknown>> {
  const {
    modifiedTimeNanoseconds: _modifiedTimeNanoseconds,
    changedTimeNanoseconds: _changedTimeNanoseconds,
    ...leaseNeutralLocksFingerprint
  } = fence.locksRoot.mutableFingerprint;
  const { observationHash: _observationHash, ...locksRootWithoutObservationHash } =
    fence.locksRoot;
  return {
    ...fence,
    locksRoot: {
      ...locksRootWithoutObservationHash,
      mutableFingerprint: leaseNeutralLocksFingerprint,
    },
  };
}

function sameCommittedFenceV2(
  left: PlatformReleaseContentStoreTestFenceV2,
  right: PlatformReleaseContentStoreTestFenceV2,
): boolean {
  return canonicalJsonStringify(committedFenceProjectionV2(left))
    === canonicalJsonStringify(committedFenceProjectionV2(right));
}

function probeStorePathV2(
  absolutePath: string,
  label: string,
): BigIntStatV2 | undefined {
  try {
    return lstatSync(absolutePath, { bigint: true }) as BigIntStatV2;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    return failV2(
      "CONTENT_STORE_FILESYSTEM_DRIFT",
      `${label} could not be probed safely`,
      error,
    );
  }
}

function expectedNativePublicationDispositionV2(
  state: FixtureStateV2,
  stage: StageStateV2,
  layout: ReturnType<typeof storeLayoutV2>,
): "published" | "adopted_identical" {
  const release = probeStorePathV2(layout.releaseRoot, "Release target");
  const attestation = probeStorePathV2(
    layout.attestationPath,
    "Attestation target",
  );
  if ((release === undefined) !== (attestation === undefined)) {
    return failV2(
      "CONTENT_STORE_PUBLICATION_INVALID",
      "Partial release publication cannot be adopted or repaired",
    );
  }
  if (release === undefined && attestation === undefined) {
    if (state.committedPublication !== undefined) {
      return failV2(
        "CONTENT_STORE_FILESYSTEM_DRIFT",
        "Committed release objects disappeared before a new publication attempt",
      );
    }
    return "published";
  }
  const committed = state.committedPublication;
  if (
    committed === undefined
    || committed.manifestPayloadHash !== stage.manifest.manifestPayloadHash
    || committed.attestationHash !== stage.buildAttestation.attestationHash
  ) {
    return failV2(
      "CONTENT_STORE_FILESYSTEM_DRIFT",
      "Pre-existing release bytes have no matching code-owned committed identity fence",
    );
  }
  const manifestBytes = readExactFileV2(layout.manifestPath);
  const attestationBytes = readExactFileV2(layout.attestationPath);
  try {
    if (
      !manifestBytes.equals(stage.manifestBytes)
      || !attestationBytes.equals(stage.attestationBytes)
    ) {
      return failV2(
        "CONTENT_STORE_PUBLICATION_INVALID",
        "Existing release content differs; no-replace adoption refused",
      );
    }
  } finally {
    manifestBytes.fill(0);
    attestationBytes.fill(0);
  }
  const currentFence = captureFenceV2(state, layout);
  if (!sameCommittedFenceV2(committed.fence, currentFence)) {
    return failV2(
      "CONTENT_STORE_FILESYSTEM_DRIFT",
      "Existing identical bytes no longer match the code-owned committed physical fence",
    );
  }
  return "adopted_identical";
}

function nativeExpectedDirectoryV2(
  absolutePath: string,
  expectedMode: "0700",
  label: string,
): PlatformReleaseContentStoreDarwinFilesystemExpectedDirectoryV2 {
  const status = lstatSync(absolutePath, { bigint: true }) as BigIntStatV2;
  if (
    status.isSymbolicLink()
    || !status.isDirectory()
    || modeTextV2(status) !== expectedMode
  ) {
    return failV2(
      "CONTENT_STORE_FILESYSTEM_DRIFT",
      `${label} is not one exact native publication directory`,
    );
  }
  return Object.freeze({
    device: status.dev.toString(10),
    inode: status.ino.toString(10),
    ownerUid: status.uid.toString(10),
    ownerGid: status.gid.toString(10),
    mode: Number(status.mode & 0o7777n),
  });
}

function evidenceNanosecondsV2(
  seconds: string,
  nanoseconds: string,
  label: string,
): bigint {
  const secondValue = BigInt(seconds);
  const nanosecondValue = BigInt(nanoseconds);
  if (nanosecondValue < 0n || nanosecondValue >= 1_000_000_000n) {
    return failV2(
      "CONTENT_STORE_FILESYSTEM_DRIFT",
      `${label} contains a non-canonical subsecond value`,
    );
  }
  return secondValue * 1_000_000_000n + nanosecondValue;
}

function assertNativeEvidenceMatchesPathV2(
  absolutePath: string,
  evidence: PlatformReleaseContentStoreDarwinFilesystemPhysicalEvidenceV2,
  objectKind: "directory" | "ordinary_file",
  label: string,
): BigIntStatV2 {
  const status = lstatSync(absolutePath, { bigint: true }) as BigIntStatV2;
  const correctKind = objectKind === "directory"
    ? status.isDirectory() && !status.isSymbolicLink()
    : status.isFile() && !status.isSymbolicLink();
  if (
    !correctKind
    || status.dev !== BigInt(evidence.device)
    || status.ino !== BigInt(evidence.inode)
    || status.uid !== BigInt(evidence.ownerUid)
    || status.gid !== BigInt(evidence.ownerGid)
    || status.nlink !== BigInt(evidence.linkCount)
    || status.size !== BigInt(evidence.byteLength)
    || Number(status.mode & 0o7777n) !== evidence.mode
    || status.mtimeNs !== evidenceNanosecondsV2(
      evidence.modifiedSeconds,
      evidence.modifiedNanoseconds,
      `${label}.modifiedTime`,
    )
    || status.ctimeNs !== evidenceNanosecondsV2(
      evidence.changedSeconds,
      evidence.changedNanoseconds,
      `${label}.changedTime`,
    )
  ) {
    return failV2(
      "CONTENT_STORE_FILESYSTEM_DRIFT",
      `${label} does not match the native final physical evidence`,
    );
  }
  return status;
}

function assertNativeEvidenceMatchesObservationV2(
  evidence: PlatformReleaseContentStoreDarwinFilesystemPhysicalEvidenceV2,
  observation: PlatformReleaseContentStoreTestObservationV2,
  objectKind: "directory" | "ordinary_file",
  label: string,
): void {
  if (
    observation.stableIdentity.objectKind !== objectKind
    || observation.stableIdentity.device !== evidence.device
    || observation.stableIdentity.inode !== evidence.inode
    || observation.mutableFingerprint.ownerUid !== Number(evidence.ownerUid)
    || observation.mutableFingerprint.ownerGid !== Number(evidence.ownerGid)
    || observation.mutableFingerprint.mode
      !== evidence.mode.toString(8).padStart(4, "0")
    || observation.mutableFingerprint.linkCount !== Number(evidence.linkCount)
    || observation.mutableFingerprint.modifiedTimeNanoseconds
      !== evidenceNanosecondsV2(
        evidence.modifiedSeconds,
        evidence.modifiedNanoseconds,
        `${label}.modifiedTime`,
      ).toString(10)
    || observation.mutableFingerprint.changedTimeNanoseconds
      !== evidenceNanosecondsV2(
        evidence.changedSeconds,
        evidence.changedNanoseconds,
        `${label}.changedTime`,
      ).toString(10)
    || (objectKind === "ordinary_file"
      && observation.mutableFingerprint.byteLength !== Number(evidence.byteLength))
  ) {
    return failV2(
      "CONTENT_STORE_FILESYSTEM_DRIFT",
      `${label} native evidence does not join the independent TypeScript census`,
    );
  }
}

type NativePublicationV2 = Readonly<{
  publication: "published" | "adopted_identical";
  result: PlatformReleaseContentStoreDarwinFilesystemFixtureRunResultV2;
}>;

function recordNativePublicationCleanupEntryV2(
  state: FixtureStateV2,
  absolutePath: string,
  evidence: PlatformReleaseContentStoreDarwinFilesystemPhysicalEvidenceV2,
  objectKind: "ordinary_file" | "directory",
): void {
  const relativePath = cleanupRelativePathV2(state.root, absolutePath);
  if (!state.cleanupInventory.has(relativePath)
      && state.cleanupInventory.size >= MAX_CLEANUP_INVENTORY_ENTRIES_V2) {
    return failV2("CONTENT_STORE_CLEANUP_FAILED", "Native publication cleanup inventory exceeded its bound");
  }
  state.cleanupInventory.set(relativePath, Object.freeze({
    relativePath,
    identity: Object.freeze({ device: evidence.device, inode: evidence.inode }),
    objectKind,
    ownerUid: BigInt(evidence.ownerUid),
    ownerGid: BigInt(evidence.ownerGid),
    mode: evidence.mode.toString(8).padStart(4, "0"),
  }));
}

function recordNativePublicationCleanupInventoryV2(
  state: FixtureStateV2,
  layout: ReturnType<typeof storeLayoutV2>,
  result: PlatformReleaseContentStoreDarwinFilesystemFixtureRunResultV2,
): void {
  if (result.status !== "ok" || result.result.releaseDisposition !== "published") return;
  const evidence = result.result.evidence;
  recordNativePublicationCleanupEntryV2(
    state,
    layout.releaseRoot,
    evidence.releaseRoot,
    "directory",
  );
  recordNativePublicationCleanupEntryV2(
    state,
    layout.manifestPath,
    evidence.manifest,
    "ordinary_file",
  );
  recordNativePublicationCleanupEntryV2(
    state,
    layout.attestationPath,
    evidence.attestation,
    "ordinary_file",
  );
}

function nativePublicationFailureCodeV2(
  result: PlatformReleaseContentStoreDarwinFilesystemFixtureRunResultV2,
): PlatformReleaseContentStoreTestErrorCodeV2 {
  if (
    result.error.primaryCodeName === "cleanup_failed"
    || (result.error.primaryCode === 0 && result.error.cleanupCode !== 0)
  ) return "CONTENT_STORE_CLEANUP_FAILED";
  if ([
    "root_invalid",
    "child_invalid",
    "state_conflict",
    "release_invalid",
    "attestation_invalid",
    "revalidation_failed",
  ].includes(result.error.primaryCodeName)) {
    return "CONTENT_STORE_FILESYSTEM_DRIFT";
  }
  return "CONTENT_STORE_PUBLICATION_INVALID";
}

function publishNativeBytesV2(
  state: FixtureStateV2,
  stage: StageStateV2,
  layout: ReturnType<typeof storeLayoutV2>,
): NativePublicationV2 {
  if (process.platform !== "darwin") {
    return failV2(
      "CONTENT_STORE_PLATFORM_UNAVAILABLE",
      "The descriptor-relative content-store publication fixture requires Darwin",
    );
  }
  const expectedDisposition = expectedNativePublicationDispositionV2(
    state,
    stage,
    layout,
  );
  assertPersistentStoreAnchorsV2(
    state,
    "before descriptor-relative native publication",
  );
  let rootDescriptor = -1;
  let operationError: unknown;
  let result:
    | PlatformReleaseContentStoreDarwinFilesystemFixtureRunResultV2
    | undefined;
  try {
    rootDescriptor = openSync(
      state.root,
      withCloexecV2(
        fsConstants.O_RDONLY
        | (fsConstants.O_DIRECTORY ?? 0)
        | (fsConstants.O_NOFOLLOW ?? 0),
      ),
    );
    const rootDescriptorStatus = fstatSync(
      rootDescriptor,
      { bigint: true },
    ) as BigIntStatV2;
    if (
      rootDescriptorStatus.isSymbolicLink()
      || !rootDescriptorStatus.isDirectory()
      || !sameIdentityV2(identityV2(rootDescriptorStatus), state.rootIdentity)
    ) {
      return failV2(
        "CONTENT_STORE_FILESYSTEM_DRIFT",
        "Store root changed before native descriptor inheritance",
      );
    }
    result = runPlatformReleaseContentStoreDarwinFilesystemFixtureV2(
      state.nativeFilesystemFixture,
      {
        rootDescriptor,
        root: nativeExpectedDirectoryV2(state.root, "0700", "store root"),
        locks: nativeExpectedDirectoryV2(layout.locksRoot, "0700", "locks root"),
        staging: nativeExpectedDirectoryV2(
          layout.stagingRoot,
          "0700",
          "staging root",
        ),
        releases: nativeExpectedDirectoryV2(
          layout.releasesRoot,
          "0700",
          "releases root",
        ),
        attestations: nativeExpectedDirectoryV2(
          layout.attestationsRoot,
          "0700",
          "attestations root",
        ),
        manifestPayloadHash: stage.manifest.manifestPayloadHash,
        attestationHash: stage.buildAttestation.attestationHash,
        manifestBytes: stage.manifestBytes,
        attestationBytes: stage.attestationBytes,
        checkpoint: 0,
      },
    );
  } catch (error) {
    operationError = error;
  }
  closeDescriptorPreservingFailureV2(
    rootDescriptor,
    operationError,
    "CONTENT_STORE_PUBLICATION_INVALID",
    "Native publication and inherited-root descriptor close both failed",
  );
  if (operationError !== undefined) {
    if (operationError instanceof PlatformReleaseContentStoreTestErrorV2) {
      throw operationError;
    }
    return failV2(
      "CONTENT_STORE_PUBLICATION_INVALID",
      "Descriptor-relative native content-store invocation failed",
      operationError,
    );
  }
  if (result === undefined) {
    return failV2(
      "CONTENT_STORE_PUBLICATION_INVALID",
      "Descriptor-relative native content-store invocation returned no result",
    );
  }
  if (result.status !== "ok") {
    return failV2(
      nativePublicationFailureCodeV2(result),
      `Native publication failed with ${result.error.primaryCodeName}`,
      result,
    );
  }
  if (
    result.result.releaseDisposition !== expectedDisposition
    || result.result.attestationDisposition !== expectedDisposition
    || !result.result.contentLeaseAcquired
    || !result.result.attestationLeaseAcquired
    || result.result.contentLeaseRecovered
    || result.result.attestationLeaseRecovered
    || !result.result.stageCleaned
    || !result.result.leasesReleased
    || result.result.staleLeaseRecoveryPolicy
      !== PLATFORM_RELEASE_CONTENT_STORE_TEST_STALE_LEASE_RECOVERY_POLICY_V2
    || result.result.unauthenticatedStaleLeaseRecoveryEnabled !== true
    || result.result.authenticatedLeaseLedgerPresent !== false
    || result.result.sameUidAtomicConditionalUnlinkAvailable !== false
    || result.result.unlinkAuthorityPolicy
      !== PLATFORM_RELEASE_CONTENT_STORE_TEST_CONDITIONAL_UNLINK_POLICY_V2
    || result.result.unlinkAuthorityPolicyCode !== 1
  ) {
    return failV2(
      "CONTENT_STORE_PUBLICATION_INVALID",
      "Native publication result violates its exact disposition, lease-recovery, cleanup, or unlink-authority contract",
    );
  }
  recordNativePublicationCleanupInventoryV2(state, layout, result);
  return Object.freeze({ publication: expectedDisposition, result });
}

function captureAndJoinNativePublicationFenceV2(
  state: FixtureStateV2,
  layout: ReturnType<typeof storeLayoutV2>,
  native: NativePublicationV2,
): PlatformReleaseContentStoreTestFenceV2 {
  const evidence = native.result.result.evidence;
  assertNativeEvidenceMatchesPathV2(
    state.root, evidence.root, "directory", "store root",
  );
  assertNativeEvidenceMatchesPathV2(
    layout.locksRoot, evidence.locks, "directory", "locks root",
  );
  assertNativeEvidenceMatchesPathV2(
    layout.stagingRoot, evidence.staging, "directory", "staging root",
  );
  assertNativeEvidenceMatchesPathV2(
    layout.releasesRoot, evidence.releases, "directory", "releases root",
  );
  assertNativeEvidenceMatchesPathV2(
    layout.attestationsRoot,
    evidence.attestations,
    "directory",
    "attestations root",
  );
  assertNativeEvidenceMatchesPathV2(
    layout.releaseRoot, evidence.releaseRoot, "directory", "release root",
  );
  assertNativeEvidenceMatchesPathV2(
    layout.manifestPath, evidence.manifest, "ordinary_file", "manifest",
  );
  assertNativeEvidenceMatchesPathV2(
    layout.attestationPath,
    evidence.attestation,
    "ordinary_file",
    "attestation",
  );
  const fence = captureFenceV2(state, layout);
  for (const [label, nativeEvidence, observation, objectKind] of [
    ["store root", evidence.root, fence.storeRoot, "directory"],
    ["locks root", evidence.locks, fence.locksRoot, "directory"],
    ["staging root", evidence.staging, fence.stagingRoot, "directory"],
    ["releases root", evidence.releases, fence.releasesRoot, "directory"],
    ["attestations root", evidence.attestations, fence.attestationsRoot, "directory"],
    ["release root", evidence.releaseRoot, fence.releaseRoot, "directory"],
    ["manifest", evidence.manifest, fence.manifest, "ordinary_file"],
    ["attestation", evidence.attestation, fence.attestation, "ordinary_file"],
  ] as const) {
    assertNativeEvidenceMatchesObservationV2(
      nativeEvidence,
      observation,
      objectKind,
      label,
    );
  }
  return fence;
}

type ReproductionExpectationV2 = Readonly<Pick<
  PlatformReleaseContentStoreTestV2,
  "manifestPayloadHash" | "attestationHash"
>>;

function reproduceBytesV2(
  state: ReceiptStateV2,
  receipt: ReproductionExpectationV2,
): Readonly<{ manifest: PlatformReleaseManifestV2; buildAttestation: PlatformReleaseBuildAttestationV2; fence: PlatformReleaseContentStoreTestFenceV2 }> {
  const layout = storeLayoutV2(
    state.fixture,
    receipt.manifestPayloadHash,
    receipt.attestationHash,
  );
  const manifestBytes = readExactFileV2(layout.manifestPath);
  const attestationBytes = readExactFileV2(layout.attestationPath);
  if (!manifestBytes.equals(state.manifestBytes) || !attestationBytes.equals(state.attestationBytes)) {
    manifestBytes.fill(0);
    attestationBytes.fill(0);
    return failV2("CONTENT_STORE_REPRODUCTION_INVALID", "Published bytes differ from the authenticated staged payload");
  }
  let manifest: PlatformReleaseManifestV2;
  let buildAttestation: PlatformReleaseBuildAttestationV2;
  try {
    manifest = parsePlatformReleaseManifestCandidateV2(JSON.parse(manifestBytes.toString("utf8")));
    buildAttestation = parsePlatformReleaseBuildAttestationCandidateV2(JSON.parse(attestationBytes.toString("utf8")));
  } catch (error) {
    manifestBytes.fill(0);
    attestationBytes.fill(0);
    return failV2("CONTENT_STORE_REPRODUCTION_INVALID", "Published files do not parse as their candidate schemas", error);
  }
  if (canonicalJsonStringify(manifest) !== manifestBytes.toString("utf8")
      || canonicalJsonStringify(buildAttestation) !== attestationBytes.toString("utf8")
      || manifest.manifestPayloadHash !== receipt.manifestPayloadHash
      || buildAttestation.attestationHash !== receipt.attestationHash
      || buildAttestation.releaseContentHash !== manifest.manifestPayloadHash
      || hashPlatformReleaseManifestV2(manifest) !== manifest.manifestPayloadHash
      || hashPlatformReleaseBuildAttestationV2(buildAttestation) !== buildAttestation.attestationHash) {
    manifestBytes.fill(0);
    attestationBytes.fill(0);
    return failV2("CONTENT_STORE_REPRODUCTION_INVALID", "Published files do not preserve their canonical hashes and cross-file join");
  }
  const fence = captureFenceV2(state.fixture, layout);
  manifestBytes.fill(0);
  attestationBytes.fill(0);
  return Object.freeze({ manifest, buildAttestation, fence });
}

function readExactFileV2(absolutePath: string): Buffer {
  let descriptor = -1;
  let primary: unknown;
  try {
    const pathBefore = lstatSync(absolutePath, { bigint: true }) as BigIntStatV2;
    if (pathBefore.isSymbolicLink() || !pathBefore.isFile() || pathBefore.nlink !== 1n || modeTextV2(pathBefore) !== CONTENT_FILE_MODE_V2 || pathBefore.size < 1n || pathBefore.size > BigInt(MAX_CONTENT_BYTES_V2)) {
      return failV2("CONTENT_STORE_REPRODUCTION_INVALID", `Published path ${absolutePath} is not an authentic content file`);
    }
    descriptor = openSync(absolutePath, withCloexecV2(fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0)));
    const descriptorBefore = fstatSync(descriptor, { bigint: true }) as BigIntStatV2;
    if (!sameStatV2(pathBefore, descriptorBefore)) return failV2("CONTENT_STORE_REPRODUCTION_INVALID", "Published file changed before reproduction");
    const length = Number(descriptorBefore.size);
    const bytes = Buffer.alloc(length);
    let offset = 0;
    while (offset < length) {
      const count = readSync(descriptor, bytes, offset, length - offset, offset);
      if (count <= 0) { bytes.fill(0); return failV2("CONTENT_STORE_REPRODUCTION_INVALID", "Published file reached EOF during reproduction"); }
      offset += count;
    }
    const eof = Buffer.alloc(1);
    if (readSync(descriptor, eof, 0, 1, length) !== 0) { eof.fill(0); bytes.fill(0); return failV2("CONTENT_STORE_REPRODUCTION_INVALID", "Published file grew during reproduction"); }
    eof.fill(0);
    const descriptorAfter = fstatSync(descriptor, { bigint: true }) as BigIntStatV2;
    const pathAfter = lstatSync(absolutePath, { bigint: true }) as BigIntStatV2;
    if (!sameStatV2(descriptorBefore, descriptorAfter) || !sameStatV2(descriptorAfter, pathAfter)) { bytes.fill(0); return failV2("CONTENT_STORE_REPRODUCTION_INVALID", "Published file changed during reproduction"); }
    return bytes;
  } catch (error) {
    primary = error instanceof PlatformReleaseContentStoreTestErrorV2
      ? error
      : platformReleaseContentStoreErrorV2(
        "CONTENT_STORE_REPRODUCTION_INVALID",
        `Could not read published file ${absolutePath}`,
        error,
      );
    throw primary;
  } finally {
    closeDescriptorPreservingFailureV2(
      descriptor,
      primary,
      "CONTENT_STORE_REPRODUCTION_INVALID",
      `Published-file read and descriptor close both failed for ${absolutePath}`,
    );
  }
}

function acquireLockV2(state: FixtureStateV2, manifestPayloadHash: string): ReleaseLockV2 {
  const lockPath = path.join(state.root, ".locks", `${manifestPayloadHash}.lock`);
  const lockParent = path.join(state.root, ".locks");
  const parentBefore = assertPersistentStoreChildAnchorV2(
    state,
    ".locks",
    "Lock parent changed before publisher lease acquisition",
  );
  let descriptor = -1;
  let createdIdentity: IdentityV2 | undefined;
  try {
    descriptor = openSync(lockPath, withCloexecV2(fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL | (fsConstants.O_NOFOLLOW ?? 0)), 0o600);
    const descriptorStat = fstatSync(descriptor, { bigint: true }) as BigIntStatV2;
    createdIdentity = identityV2(descriptorStat);
    const pathStat = lstatSync(lockPath, { bigint: true }) as BigIntStatV2;
    if (descriptorStat.isSymbolicLink()
        || !descriptorStat.isFile()
        || descriptorStat.nlink !== 1n
        || modeTextV2(descriptorStat) !== "0600"
        || !sameStatV2(descriptorStat, pathStat)) {
      return failV2("CONTENT_STORE_FILESYSTEM_DRIFT", "Publisher lock changed during admission");
    }
    assertPersistentStoreChildAnchorV2(
      state,
      ".locks",
      "Lock parent changed during publisher lease acquisition",
    );
    fsyncSync(descriptor);
    fsyncDirectoryV2(lockParent);
    assertPersistentStoreChildAnchorV2(
      state,
      ".locks",
      "Lock parent changed after durable publisher lease acquisition",
    );
    recordCleanupPathV2(state.root, state.cleanupInventory, lockPath);
    state.activeLockName = path.basename(lockPath);
    return Object.freeze({
      path: lockPath,
      descriptor,
      identity: identityV2(descriptorStat),
      parentIdentity: identityV2(parentBefore),
    });
  } catch (error) {
    let cleanupError: unknown;
    if (descriptor >= 0 && createdIdentity !== undefined) {
      try {
        assertPersistentStoreChildAnchorV2(
          state,
          ".locks",
          "Lock parent changed while recovering failed lease acquisition",
        );
        const currentPath = lstatSync(lockPath, { bigint: true }) as BigIntStatV2;
        const currentDescriptor = fstatSync(descriptor, { bigint: true }) as BigIntStatV2;
        if (
          currentPath.isSymbolicLink()
          || !currentPath.isFile()
          || !sameIdentityV2(identityV2(currentPath), createdIdentity)
          || !sameIdentityV2(identityV2(currentDescriptor), createdIdentity)
        ) {
          return failV2(
            "CONTENT_STORE_FILESYSTEM_DRIFT",
            "Failed publisher-lock acquisition left an untrusted replacement that was preserved",
            error,
          );
        }
        unlinkSync(lockPath);
        forgetCleanupPathV2(state.root, state.cleanupInventory, lockPath);
        fsyncDirectoryV2(lockParent);
      } catch (candidateCleanupError) {
        cleanupError = candidateCleanupError;
      }
    }
    if (descriptor >= 0) {
      try { closeSync(descriptor); } catch (closeError) { cleanupError ??= closeError; }
    }
    if (cleanupError !== undefined) {
      return failV2(
        "CONTENT_STORE_PUBLICATION_INVALID",
        "Publisher-lock acquisition failed and exact lock cleanup also failed",
        new AggregateError([error, cleanupError]),
      );
    }
    return failV2("CONTENT_STORE_PUBLICATION_INVALID", "Another publisher already owns the release lock", error);
  }
}

function installReleaseLockReplacementFaultV2(
  state: FixtureStateV2,
  lock: ReleaseLockV2,
): void {
  const displaced = `${lock.path}.displaced`;
  renameSync(lock.path, displaced);
  moveCleanupInventoryPrefixV2(
    state.cleanupInventory,
    cleanupRelativePathV2(state.root, lock.path),
    cleanupRelativePathV2(state.root, displaced),
  );
  writeExclusiveFileV2(lock.path, Buffer.from("replacement\n", "utf8"), 0o600);
  recordCleanupPathV2(state.root, state.cleanupInventory, lock.path);
}

function releaseLockV2(state: FixtureStateV2, lock: ReleaseLockV2): void {
  let validationError: PlatformReleaseContentStoreTestErrorV2 | undefined;
  try {
    assertPersistentStoreChildAnchorV2(
      state,
      ".locks",
      "Publisher lock parent changed before release",
    );
    fsyncSync(lock.descriptor);
    const descriptorStat = fstatSync(lock.descriptor, { bigint: true }) as BigIntStatV2;
    const pathStat = lstatSync(lock.path, { bigint: true }) as BigIntStatV2;
    const parentPath = path.join(state.root, ".locks");
    const parentStat = lstatSync(parentPath, { bigint: true }) as BigIntStatV2;
    if (!sameIdentityV2(identityV2(descriptorStat), lock.identity)
        || !sameStatV2(descriptorStat, pathStat)
        || descriptorStat.uid !== BigInt(state.ownerUid)
        || descriptorStat.gid !== BigInt(state.ownerGid)
        || modeTextV2(descriptorStat) !== "0600"
        || descriptorStat.nlink !== 1n
        || !parentStat.isDirectory()
        || !sameIdentityV2(identityV2(parentStat), lock.parentIdentity)
        || parentStat.uid !== BigInt(state.ownerUid)
        || parentStat.gid !== BigInt(state.ownerGid)
        || modeTextV2(parentStat) !== STORE_ROOT_MODE_V2) {
      return failV2("CONTENT_STORE_FILESYSTEM_DRIFT", "Publisher lock replacement detected before release");
    }
  } catch (error) {
    validationError = error instanceof PlatformReleaseContentStoreTestErrorV2
      ? error
      : platformReleaseContentStoreErrorV2(
        "CONTENT_STORE_FILESYSTEM_DRIFT",
        "Publisher lock could not be revalidated before release",
        error,
      );
  }
  closeDescriptorPreservingFailureV2(
    lock.descriptor,
    validationError,
    "CONTENT_STORE_FILESYSTEM_DRIFT",
    "Publisher-lock validation and descriptor close both failed",
  );
  if (validationError !== undefined) throw validationError;
  try {
    assertPersistentStoreChildAnchorV2(
      state,
      ".locks",
      "Publisher lock parent changed immediately before unlink",
    );
    const pathImmediatelyBeforeUnlink = lstatSync(lock.path, { bigint: true }) as BigIntStatV2;
    if (
      pathImmediatelyBeforeUnlink.isSymbolicLink()
      || !pathImmediatelyBeforeUnlink.isFile()
      || !sameIdentityV2(identityV2(pathImmediatelyBeforeUnlink), lock.identity)
    ) {
      return failV2("CONTENT_STORE_FILESYSTEM_DRIFT", "Publisher lock changed immediately before unlink");
    }
    unlinkSync(lock.path);
    forgetCleanupPathV2(state.root, state.cleanupInventory, lock.path);
    fsyncDirectoryV2(path.join(state.root, ".locks"));
    assertPersistentStoreChildAnchorV2(
      state,
      ".locks",
      "Publisher lock parent changed after unlink",
    );
  } catch (error) {
    return failV2("CONTENT_STORE_FILESYSTEM_DRIFT", "Release lock could not be removed", error);
  }
  delete state.activeLockName;
}

function publishBytesV2(
  state: FixtureStateV2,
  stage: StageStateV2,
  layout: ReturnType<typeof storeLayoutV2>,
  fault?: PlatformReleaseContentStoreTestFaultV2,
): "published" | "adopted_identical" {
  assertPersistentStoreAnchorsV2(state, "before publication target probing");
  const releaseExists = (() => {
    try {
      return lstatSync(layout.releaseRoot, { bigint: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      return failV2("CONTENT_STORE_FILESYSTEM_DRIFT", "Release target could not be probed safely", error);
    }
  })();
  const attestationExists = (() => {
    try {
      return lstatSync(layout.attestationPath, { bigint: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      return failV2("CONTENT_STORE_FILESYSTEM_DRIFT", "Attestation target could not be probed safely", error);
    }
  })();
  if (releaseExists !== undefined || attestationExists !== undefined) {
    if (releaseExists === undefined || attestationExists === undefined) return failV2("CONTENT_STORE_PUBLICATION_INVALID", "Partial release publication cannot be adopted or repaired");
    const committed = state.committedPublication;
    if (
      committed === undefined
      || committed.manifestPayloadHash !== stage.manifest.manifestPayloadHash
      || committed.attestationHash !== stage.buildAttestation.attestationHash
    ) {
      return failV2(
        "CONTENT_STORE_FILESYSTEM_DRIFT",
        "Pre-existing release bytes have no matching code-owned committed identity fence",
      );
    }
    const existingManifest = readExactFileV2(layout.manifestPath);
    const existingAttestation = readExactFileV2(layout.attestationPath);
    const identical = existingManifest.equals(stage.manifestBytes) && existingAttestation.equals(stage.attestationBytes);
    existingManifest.fill(0);
    existingAttestation.fill(0);
    if (!identical) return failV2("CONTENT_STORE_PUBLICATION_INVALID", "Existing release content differs; no-replace adoption refused");
    return "adopted_identical";
  }
  if (state.committedPublication !== undefined) {
    return failV2(
      "CONTENT_STORE_FILESYSTEM_DRIFT",
      "Committed release objects disappeared before a new publication attempt",
    );
  }

  assertPersistentStoreChildAnchorV2(
    state,
    ".staging",
    "Staging parent changed immediately before transaction allocation",
  );
  const stagingRoot = mkdtempSync(path.join(state.root, ".staging", "publish-"));
  chmodSync(stagingRoot, STAGE_MODE_V2);
  const stagingIdentity = identityV2(lstatSync(stagingRoot, { bigint: true }) as BigIntStatV2);
  recordCleanupPathV2(state.root, state.cleanupInventory, stagingRoot);
  let outcome: "published" | undefined;
  let operationError: unknown;
  try {
    outcome = (() => {
      assertPersistentStoreChildAnchorV2(
        state,
        ".staging",
        "Staging parent changed after transaction allocation",
      );
      if (fault?.checkpoint === "fail_after_staging_allocation") {
        return failV2(
          "CONTENT_STORE_PUBLICATION_INVALID",
          "Injected failure after staging allocation",
        );
      }
      const releaseStage = path.join(stagingRoot, "release");
      const attestationStage = path.join(stagingRoot, "attestation.json");
      try {
        mkdirSync(releaseStage, { mode: STAGE_MODE_V2 });
        chmodSync(releaseStage, STAGE_MODE_V2);
        recordCleanupPathV2(state.root, state.cleanupInventory, releaseStage);
        writeExclusiveFileV2(path.join(releaseStage, "manifest.json"), stage.manifestBytes, 0o444);
        recordCleanupPathV2(
          state.root,
          state.cleanupInventory,
          path.join(releaseStage, "manifest.json"),
        );
        writeExclusiveFileV2(attestationStage, stage.attestationBytes, 0o444);
        recordCleanupPathV2(state.root, state.cleanupInventory, attestationStage);
        fsyncDirectoryV2(releaseStage);
        fsyncDirectoryV2(stagingRoot);
        if (
          fault?.checkpoint
            === "fail_publication_and_replace_staging_before_cleanup_and_lock_before_release"
        ) {
          const displaced = `${stagingRoot}.displaced`;
          renameSync(stagingRoot, displaced);
          moveCleanupInventoryPrefixV2(
            state.cleanupInventory,
            cleanupRelativePathV2(state.root, stagingRoot),
            cleanupRelativePathV2(state.root, displaced),
          );
          mkdirSync(stagingRoot, { mode: STAGE_MODE_V2 });
          chmodSync(stagingRoot, STAGE_MODE_V2);
          recordCleanupPathV2(state.root, state.cleanupInventory, stagingRoot);
          return failV2(
            "CONTENT_STORE_PUBLICATION_INVALID",
            "Injected primary failure after staging construction",
          );
        }
      } catch (error) {
        if (error instanceof PlatformReleaseContentStoreTestErrorV2) throw error;
        return failV2("CONTENT_STORE_PUBLICATION_INVALID", "Release staging failed", error);
      }
      try {
        // Reserve the content directory with mkdir (an atomic no-replace operation),
        // then publish the staged manifest through a no-replace hard link. This
        // prevents a foreign target from being overwritten after a path precheck.
        assertPersistentStoreChildAnchorV2(
          state,
          "releases",
          "Releases parent changed immediately before no-replace reservation",
        );
        mkdirSync(layout.releaseRoot, { mode: STAGE_MODE_V2 });
        chmodSync(layout.releaseRoot, STAGE_MODE_V2);
        recordCleanupPathV2(state.root, state.cleanupInventory, layout.releaseRoot);
        const releaseRootIdentity = identityV2(
          lstatSync(layout.releaseRoot, { bigint: true }) as BigIntStatV2,
        );
        assertPersistentStoreChildAnchorV2(
          state,
          "releases",
          "Releases parent changed after no-replace reservation",
        );
        assertDirectoryIdentityV2(
          layout.releaseRoot,
          releaseRootIdentity,
          "Reserved release root changed before manifest publication",
        );
        linkSync(path.join(releaseStage, "manifest.json"), layout.manifestPath);
        recordCleanupPathV2(state.root, state.cleanupInventory, layout.manifestPath);
        assertPersistentStoreChildAnchorV2(
          state,
          "releases",
          "Releases parent changed during manifest publication",
        );
        assertDirectoryIdentityV2(
          layout.releaseRoot,
          releaseRootIdentity,
          "Reserved release root changed during manifest publication",
        );
        unlinkSync(path.join(releaseStage, "manifest.json"));
        forgetCleanupPathV2(
          state.root,
          state.cleanupInventory,
          path.join(releaseStage, "manifest.json"),
        );
        changeOwnedCleanupDirectoryModeV2(
          state.root,
          state.cleanupInventory,
          layout.releaseRoot,
          0o555,
        );
        fsyncDirectoryV2(layout.releaseRoot);
        fsyncDirectoryV2(path.join(state.root, "releases"));
        assertPersistentStoreChildAnchorV2(
          state,
          "attestations",
          "Attestations parent changed before no-replace publication",
        );
        try {
          lstatSync(layout.attestationPath, { bigint: true });
          return failV2("CONTENT_STORE_PUBLICATION_INVALID", "Attestation target appeared before its no-replace link");
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
        assertPersistentStoreChildAnchorV2(
          state,
          "attestations",
          "Attestations parent changed immediately before no-replace link",
        );
        linkSync(attestationStage, layout.attestationPath);
        recordCleanupPathV2(state.root, state.cleanupInventory, layout.attestationPath);
        assertPersistentStoreChildAnchorV2(
          state,
          "attestations",
          "Attestations parent changed during no-replace link",
        );
        unlinkSync(attestationStage);
        forgetCleanupPathV2(state.root, state.cleanupInventory, attestationStage);
        fsyncDirectoryV2(path.join(state.root, "attestations"));
        fsyncDirectoryV2(stagingRoot);
        fsyncDirectoryV2(path.join(state.root, ".staging"));
        fsyncDirectoryV2(state.root);
        assertPersistentStoreAnchorsV2(state, "after durable publication");
        if (
          fault?.checkpoint === "replace_staging_root_before_cleanup"
          || fault?.checkpoint === "replace_staging_root_before_cleanup_and_lock_before_release"
        ) {
          const displaced = `${stagingRoot}.displaced`;
          renameSync(stagingRoot, displaced);
          moveCleanupInventoryPrefixV2(
            state.cleanupInventory,
            cleanupRelativePathV2(state.root, stagingRoot),
            cleanupRelativePathV2(state.root, displaced),
          );
          mkdirSync(stagingRoot, { mode: STAGE_MODE_V2 });
          chmodSync(stagingRoot, STAGE_MODE_V2);
          recordCleanupPathV2(state.root, state.cleanupInventory, stagingRoot);
        }
        return "published" as const;
      } catch (error) {
        if (error instanceof PlatformReleaseContentStoreTestErrorV2) throw error;
        return failV2("CONTENT_STORE_PUBLICATION_INVALID", "Atomic release publication failed", error);
      }
    })();
  } catch (error) {
    operationError = error;
  }
  let cleanupError: unknown;
  try {
    removeOwnedStagingRootV2(state, stagingRoot, stagingIdentity);
  } catch (error) {
    cleanupError = error;
  }
  if (operationError !== undefined) {
    if (cleanupError !== undefined) {
      if (operationError instanceof PlatformReleaseContentStoreTestErrorV2) {
        return failV2(
          operationError.code,
          "Publication failed and exact staging cleanup also failed",
          new AggregateError([operationError, cleanupError]),
        );
      }
      return failV2(
        "CONTENT_STORE_PUBLICATION_INVALID",
        "Publication failed and exact staging cleanup also failed",
        new AggregateError([operationError, cleanupError]),
      );
    }
    throw operationError;
  }
  if (cleanupError !== undefined) throw cleanupError;
  if (outcome === undefined) {
    return failV2("CONTENT_STORE_PUBLICATION_INVALID", "Publication ended without a terminal outcome");
  }
  return outcome;
}

export function buildPlatformReleaseContentStoreTestStageForTestV2(
  candidate: unknown,
): PlatformReleaseContentStoreTestStageV2 {
  let envelope: PlatformReleaseCandidateEnvelopeV2;
  try {
    envelope = parsePlatformReleaseCandidateEnvelopeV2(candidate);
  } catch (error) {
    return failV2("CONTENT_STORE_CANDIDATE_INVALID", "Content-store stage requires a valid candidate envelope", error);
  }
  const manifestBytes = canonicalJsonBytes(envelope.manifest);
  const attestationBytes = canonicalJsonBytes(envelope.buildAttestation);
  if (manifestBytes.byteLength < 1 || manifestBytes.byteLength > MAX_CONTENT_BYTES_V2 || attestationBytes.byteLength < 1 || attestationBytes.byteLength > MAX_CONTENT_BYTES_V2) {
    return failV2("CONTENT_STORE_STAGE_INVALID", "Canonical manifest and attestation exceed the bounded stage file policy");
  }
  const state: StageStateV2 = {
    manifest: envelope.manifest,
    buildAttestation: envelope.buildAttestation,
    manifestBytes,
    attestationBytes,
    consumed: false,
  };
  let stage!: PlatformReleaseContentStoreTestStageV2;
  stage = Object.freeze({
    manifestPayloadHash: envelope.manifest.manifestPayloadHash,
    attestationHash: envelope.buildAttestation.attestationHash,
    manifestByteLength: manifestBytes.byteLength,
    attestationByteLength: attestationBytes.byteLength,
    dispose(): void {
      const owned = stageStatesV2.get(stage);
      if (owned === undefined) return failV2("CONTENT_STORE_STAGE_HANDLE_UNAUTHENTICATED", "Stage dispose requires the authentic code-owned handle");
      owned.consumed = true;
      stageStatesV2.delete(stage);
      owned.manifestBytes.fill(0);
      owned.attestationBytes.fill(0);
    },
  });
  stageStatesV2.set(stage, state);
  return stage;
}

export function buildPlatformReleaseContentStoreTestFixtureForTestV2(
  nativeFilesystemFixture: PlatformReleaseContentStoreDarwinFilesystemFixtureV2,
): PlatformReleaseContentStoreTestFixtureV2 {
  if (
    typeof nativeFilesystemFixture !== "object"
    || nativeFilesystemFixture === null
    || isProxy(nativeFilesystemFixture)
  ) {
    return failV2(
      "CONTENT_STORE_FIXTURE_HANDLE_UNAUTHENTICATED",
      "Content-store fixture construction requires one opaque native filesystem fixture",
    );
  }
  let nativeFilesystemIdentity: PlatformReleaseContentStoreDarwinFilesystemFixtureInspectionV2;
  try {
    nativeFilesystemIdentity =
      inspectPlatformReleaseContentStoreDarwinFilesystemFixtureV2(
        nativeFilesystemFixture,
      );
  } catch (error) {
    return failV2(
      "CONTENT_STORE_FIXTURE_HANDLE_UNAUTHENTICATED",
      "Content-store fixture construction rejected the native filesystem fixture",
      error,
    );
  }
  const privateRoot = privateRootV2();
  try {
    for (const child of STORE_CHILDREN_V2) {
      const childPath = path.join(privateRoot.root, child);
      ensureDirectoryV2(childPath, 0o700);
      recordCleanupPathV2(privateRoot.root, privateRoot.cleanupInventory, childPath);
    }
    fsyncDirectoryV2(privateRoot.root);
    const childIdentities = Object.freeze({
      ".locks": identityV2(lstatSync(path.join(privateRoot.root, ".locks"), { bigint: true }) as BigIntStatV2),
      ".staging": identityV2(lstatSync(path.join(privateRoot.root, ".staging"), { bigint: true }) as BigIntStatV2),
      attestations: identityV2(lstatSync(path.join(privateRoot.root, "attestations"), { bigint: true }) as BigIntStatV2),
      releases: identityV2(lstatSync(path.join(privateRoot.root, "releases"), { bigint: true }) as BigIntStatV2),
    });
    const fixtureState: FixtureStateV2 = {
      alias: privateRoot.alias,
      root: privateRoot.root,
      rootIdentity: identityV2(privateRoot.stat),
      childIdentities,
      ownerUid: Number(privateRoot.stat.uid),
      ownerGid: Number(privateRoot.stat.gid),
      hostIdentityHash: stableHostIdentityHashV2(),
      nativeFilesystemFixture,
      nativeFilesystemIdentity,
      cleanupInventory: privateRoot.cleanupInventory,
      lifecycle: "open",
    };
    assertPersistentStoreAnchorsV2(fixtureState, "during fixture construction");
    let fixture!: PlatformReleaseContentStoreTestFixtureV2;
    fixture = Object.freeze({
      dispose(): void {
        const owned = fixtureStatesV2.get(fixture);
        if (
          owned === undefined
          || owned.lifecycle === "cleaning"
          || owned.lifecycle === "disposed"
        ) {
          return failV2("CONTENT_STORE_DISPOSE_INVALID", "Fixture dispose requires the authentic retryable owner");
        }
        owned.lifecycle = "cleaning";
        try {
          if (owned.disposeFaultOnce === "before_cleanup") {
            delete owned.disposeFaultOnce;
            throw new Error("Injected fixture-dispose failure");
          }
          if (owned.prePublicationMutation !== undefined) {
            const external = owned.prePublicationMutation;
            const externalBefore = lstatSync(external.externalAlias, { bigint: true }) as BigIntStatV2;
            if (
              externalBefore.isSymbolicLink()
              || !externalBefore.isDirectory()
              || !sameIdentityV2(identityV2(externalBefore), external.externalIdentity)
              || !sameStatV2(externalBefore, external.externalBaseline)
              || realpathSync(external.externalAlias) !== external.externalRoot
              || readdirSync(external.externalRoot).length !== 0
            ) {
              return failV2("CONTENT_STORE_DISPOSE_INVALID", "External mutation sentinel changed before disposal");
            }
            const externalAfterPrepare = lstatSync(external.externalAlias, { bigint: true }) as BigIntStatV2;
            if (
              externalAfterPrepare.isSymbolicLink()
              || !externalAfterPrepare.isDirectory()
              || !sameIdentityV2(identityV2(externalAfterPrepare), external.externalIdentity)
              || !sameStatV2(externalAfterPrepare, external.externalBaseline)
              || realpathSync(external.externalAlias) !== external.externalRoot
              || readdirSync(external.externalRoot).length !== 0
            ) {
              return failV2("CONTENT_STORE_DISPOSE_INVALID", "External mutation sentinel changed during disposal");
            }
            cleanupExactOwnedTreeV2(
              external.externalAlias,
              external.externalInventory,
            );
            delete owned.prePublicationMutation;
          }
          if (owned.disposeFaultOnce === "after_external_cleanup") {
            delete owned.disposeFaultOnce;
            throw new Error("Injected fixture-dispose failure after external cleanup");
          }
          const stat = lstatSync(owned.root, { bigint: true }) as BigIntStatV2;
          if (stat.isSymbolicLink() || !stat.isDirectory() || modeTextV2(stat) !== STORE_ROOT_MODE_V2 || !sameIdentityV2(identityV2(stat), owned.rootIdentity) || realpathSync(owned.alias) !== owned.root) {
            return failV2("CONTENT_STORE_DISPOSE_INVALID", "Fixture root changed before disposal");
          }
          const afterPrepare = lstatSync(owned.alias, { bigint: true }) as BigIntStatV2;
          if (afterPrepare.isSymbolicLink()
              || !afterPrepare.isDirectory()
              || modeTextV2(afterPrepare) !== STORE_ROOT_MODE_V2
              || !sameIdentityV2(identityV2(afterPrepare), owned.rootIdentity)
              || realpathSync(owned.alias) !== owned.root) {
            return failV2("CONTENT_STORE_DISPOSE_INVALID", "Fixture root changed during disposal");
          }
          cleanupExactOwnedTreeV2(owned.alias, owned.cleanupInventory);
          owned.lifecycle = "disposed";
          fixtureStatesV2.delete(fixture);
        } catch (error) {
          owned.lifecycle = "cleanup_failed";
          if (
            error instanceof PlatformReleaseContentStoreTestErrorV2
            && error.code === "CONTENT_STORE_DISPOSE_INVALID"
          ) throw error;
          return failV2(
            "CONTENT_STORE_DISPOSE_INVALID",
            "Fixture cleanup failed but retained retryable ownership",
            error,
          );
        }
      },
    });
    fixtureStatesV2.set(fixture, fixtureState);
    return fixture;
  } catch (error) {
    let cleanupError: unknown;
    try {
      cleanupExactOwnedTreeV2(privateRoot.alias, privateRoot.cleanupInventory);
    } catch (candidate) {
      cleanupError = candidate;
    }
    if (cleanupError !== undefined) {
      if (error instanceof PlatformReleaseContentStoreTestErrorV2) {
        return failV2(
          error.code,
          "Fixture construction failed and exact nonrecursive cleanup also failed",
          new AggregateError([error, cleanupError]),
        );
      }
      return failV2(
        "CONTENT_STORE_FIXTURE_BUILD_FAILED",
        "Fixture construction failed and exact nonrecursive cleanup also failed",
        new AggregateError([error, cleanupError]),
      );
    }
    if (error instanceof PlatformReleaseContentStoreTestErrorV2) throw error;
    return failV2("CONTENT_STORE_FIXTURE_BUILD_FAILED", "Could not initialize the private release store layout", error);
  }
}

function childForPrePublicationMutationV2(
  mutation: PlatformReleaseContentStoreTestPrePublicationMutationV2,
): (typeof STORE_CHILDREN_V2)[number] {
  if (mutation === "replace_locks_root_with_external_symlink") return ".locks";
  if (mutation === "replace_staging_root_with_external_symlink") return ".staging";
  if (mutation === "replace_attestations_root_with_external_symlink") return "attestations";
  if (mutation === "replace_releases_root_with_external_symlink") return "releases";
  return failV2("CONTENT_STORE_FILESYSTEM_DRIFT", "Unknown pre-publication store mutation");
}

export function mutatePlatformReleaseContentStoreTestFixtureBeforePublicationForTestV2(
  fixture: PlatformReleaseContentStoreTestFixtureV2,
  mutation: PlatformReleaseContentStoreTestPrePublicationMutationV2,
): void {
  const state = fixtureFromV2(fixture);
  if (state.prePublicationMutation !== undefined) {
    return failV2("CONTENT_STORE_FILESYSTEM_DRIFT", "Only one pre-publication mutation may own the fixture");
  }
  assertPersistentStoreAnchorsV2(state, "before test-only pre-publication mutation");
  assertSortedExactV2(readdirSync(state.root), expectedStoreChildrenV2(), "Fixture root changed before test-only mutation");
  for (const child of STORE_CHILDREN_V2) {
    assertSortedExactV2(readdirSync(path.join(state.root, child)), [], `Store child ${child} is not empty before test-only mutation`);
  }
  const child = childForPrePublicationMutationV2(mutation);
  const childPath = path.join(state.root, child);
  const external = privateRootV2();
  try {
    rmdirSync(childPath);
    forgetCleanupPathV2(state.root, state.cleanupInventory, childPath);
    symlinkSync(external.root, childPath, "dir");
    recordCleanupPathV2(state.root, state.cleanupInventory, childPath);
    fsyncDirectoryV2(state.root);
    state.prePublicationMutation = Object.freeze({
      kind: mutation,
      externalAlias: external.alias,
      externalRoot: external.root,
      externalIdentity: identityV2(external.stat),
      externalBaseline: lstatSync(external.alias, { bigint: true }) as BigIntStatV2,
      externalInventory: external.cleanupInventory,
    });
  } catch (error) {
    let cleanupError: unknown;
    try {
      cleanupExactOwnedTreeV2(external.alias, external.cleanupInventory);
    } catch (candidate) { cleanupError = candidate; }
    if (cleanupError !== undefined) {
      return failV2(
        "CONTENT_STORE_FILESYSTEM_DRIFT",
        "Test-only external mutation failed and exact nonrecursive cleanup also failed",
        new AggregateError([error, cleanupError]),
      );
    }
    return failV2("CONTENT_STORE_FILESYSTEM_DRIFT", "Could not install the test-only external child mutation", error);
  }
}

export function inspectPlatformReleaseContentStorePrePublicationMutationForTestV2(
  fixture: PlatformReleaseContentStoreTestFixtureV2,
): Readonly<{
  mutation: PlatformReleaseContentStoreTestPrePublicationMutationV2;
  externalEntryCount: number;
  externalEntryNamesHash: string;
  externalObservationUnchanged: boolean;
}> {
  const state = fixtureFromV2(fixture);
  const mutation = state.prePublicationMutation;
  if (mutation === undefined) {
    return failV2("CONTENT_STORE_FILESYSTEM_DRIFT", "Fixture has no active pre-publication mutation");
  }
  const external = lstatSync(mutation.externalAlias, { bigint: true }) as BigIntStatV2;
  if (
    external.isSymbolicLink()
    || !external.isDirectory()
    || !sameIdentityV2(identityV2(external), mutation.externalIdentity)
    || realpathSync(mutation.externalAlias) !== mutation.externalRoot
  ) {
    return failV2("CONTENT_STORE_FILESYSTEM_DRIFT", "External mutation sentinel changed before inspection");
  }
  const entries = readdirSync(mutation.externalRoot).sort();
  return Object.freeze({
    mutation: mutation.kind,
    externalEntryCount: entries.length,
    externalEntryNamesHash: hashCanonicalJson({
      schema: "setfarm.platform-release-content-store-test-external-entry-names.v2",
      entries,
    }),
    externalObservationUnchanged: sameStatV2(
      mutation.externalBaseline,
      external,
    ),
  });
}

export function mutatePlatformReleaseContentStoreExternalSentinelForTestV2(
  fixture: PlatformReleaseContentStoreTestFixtureV2,
  operation: "add_unexpected_entry" | "recover_unexpected_entry",
): void {
  if (typeof fixture !== "object" || fixture === null || isProxy(fixture)) {
    return failV2(
      "CONTENT_STORE_FIXTURE_HANDLE_UNAUTHENTICATED",
      "External sentinel mutation requires the authentic fixture handle",
    );
  }
  const state = fixtureStatesV2.get(fixture);
  if (
    state === undefined
    || state.lifecycle === "cleaning"
    || state.lifecycle === "disposed"
    || state.prePublicationMutation === undefined
  ) {
    return failV2(
      "CONTENT_STORE_FIXTURE_HANDLE_UNAUTHENTICATED",
      "External sentinel mutation requires retained fixture ownership",
    );
  }
  const mutation = state.prePublicationMutation;
  const canaryPath = path.join(mutation.externalRoot, "unexpected-entry.txt");
  const canaryBytes = Buffer.from("unexpected-external-entry\n", "utf8");
  if (operation === "add_unexpected_entry") {
    if (
      state.lifecycle !== "open"
      || mutation.externalCanaryIdentity !== undefined
      || !sameStatV2(
        mutation.externalBaseline,
        lstatSync(mutation.externalAlias, { bigint: true }) as BigIntStatV2,
      )
      || readdirSync(mutation.externalRoot).length !== 0
    ) {
      canaryBytes.fill(0);
      return failV2(
        "CONTENT_STORE_FILESYSTEM_DRIFT",
        "External sentinel is not at its exact empty baseline",
      );
    }
    writeExclusiveFileV2(canaryPath, canaryBytes, 0o444);
    canaryBytes.fill(0);
    fsyncDirectoryV2(mutation.externalRoot);
    const canary = lstatSync(canaryPath, { bigint: true }) as BigIntStatV2;
    state.prePublicationMutation = Object.freeze({
      ...mutation,
      externalCanaryIdentity: identityV2(canary),
    });
    return;
  }
  if (mutation.externalCanaryIdentity === undefined) {
    canaryBytes.fill(0);
    return failV2(
      "CONTENT_STORE_FILESYSTEM_DRIFT",
      "External sentinel has no code-owned recovery canary",
    );
  }
  assertSortedExactV2(
    readdirSync(mutation.externalRoot),
    [path.basename(canaryPath)],
    "External sentinel contains more than the recovery canary",
  );
  const canary = lstatSync(canaryPath, { bigint: true }) as BigIntStatV2;
  const observedBytes = readExactFileV2(canaryPath);
  const authentic = !canary.isSymbolicLink()
    && canary.isFile()
    && sameIdentityV2(identityV2(canary), mutation.externalCanaryIdentity)
    && observedBytes.equals(canaryBytes);
  observedBytes.fill(0);
  canaryBytes.fill(0);
  if (!authentic) {
    return failV2(
      "CONTENT_STORE_FILESYSTEM_DRIFT",
      "External sentinel recovery canary changed and was preserved",
    );
  }
  unlinkSync(canaryPath);
  fsyncDirectoryV2(mutation.externalRoot);
  const recoveredBaseline = lstatSync(
    mutation.externalAlias,
    { bigint: true },
  ) as BigIntStatV2;
  state.prePublicationMutation = Object.freeze({
    kind: mutation.kind,
    externalAlias: mutation.externalAlias,
    externalRoot: mutation.externalRoot,
    externalIdentity: mutation.externalIdentity,
    externalBaseline: recoveredBaseline,
    externalInventory: mutation.externalInventory,
  });
}

function cleanupReplacementFixtureStateV2(
  fixture: PlatformReleaseContentStoreTestFixtureV2,
): FixtureStateV2 {
  if (typeof fixture !== "object" || fixture === null || isProxy(fixture)) {
    return failV2(
      "CONTENT_STORE_FIXTURE_HANDLE_UNAUTHENTICATED",
      "Cleanup replacement mutation requires the authentic fixture handle",
    );
  }
  const state = fixtureStatesV2.get(fixture);
  if (state === undefined || state.lifecycle === "cleaning" || state.lifecycle === "disposed") {
    return failV2(
      "CONTENT_STORE_FIXTURE_HANDLE_UNAUTHENTICATED",
      "Cleanup replacement mutation requires retained fixture ownership",
    );
  }
  return state;
}

export function mutatePlatformReleaseContentStoreCleanupReplacementForTestV2(
  fixture: PlatformReleaseContentStoreTestFixtureV2,
  mutation: PlatformReleaseContentStoreTestCleanupReplacementMutationV2,
): void {
  const state = cleanupReplacementFixtureStateV2(fixture);
  if (
    state.lifecycle !== "open"
    || state.cleanupReplacementMutation !== undefined
    || state.prePublicationMutation !== undefined
    || state.committedPublication !== undefined
  ) {
    return failV2(
      "CONTENT_STORE_FILESYSTEM_DRIFT",
      "Cleanup replacement mutation requires one clean open fixture",
    );
  }
  assertPersistentStoreAnchorsV2(state, "before cleanup replacement mutation");
  assertExactOwnedTreeV2(state.root, state.cleanupInventory);
  const foreign = privateRootV2();
  const canaryPath = path.join(foreign.root, "foreign-canary.txt");
  const canaryBytes = Buffer.from("foreign-cleanup-canary\n", "utf8");
  let displacedAlias: string | undefined;
  let ownedDescendantRemoved = false;
  let ownedRootDisplaced = false;
  let foreignAtAlias = true;
  let foreignMovedToTarget = false;
  try {
    writeExclusiveFileV2(canaryPath, canaryBytes, 0o444);
    recordCleanupPathV2(foreign.root, foreign.cleanupInventory, canaryPath);
    fsyncDirectoryV2(foreign.root);
    if (mutation === "replace_descendant_with_foreign_tree") {
      const target = path.join(state.root, ".staging");
      const expected = state.cleanupInventory.get(".staging");
      if (expected === undefined) {
        return failV2("CONTENT_STORE_FILESYSTEM_DRIFT", "Cleanup descendant inventory is absent");
      }
      assertCleanupEntryV2(state.root, expected, "Cleanup descendant changed before replacement test");
      assertCleanupDirectoryMembershipV2(state.root, state.cleanupInventory, "", expected);
      rmdirSync(target);
      ownedDescendantRemoved = true;
      renameSync(foreign.alias, target);
      foreignAtAlias = false;
      foreignMovedToTarget = true;
      fsyncDirectoryV2(state.root);
      state.cleanupReplacementMutation = Object.freeze({
        kind: "descendant",
        foreignAlias: foreign.alias,
        foreignIdentity: identityV2(foreign.stat),
        foreignInventory: foreign.cleanupInventory,
        targetRelativePath: ".staging",
      });
      return;
    }
    displacedAlias = `${state.alias}.owned-displaced-${randomBytes(8).toString("hex")}`;
    renameSync(state.alias, displacedAlias);
    ownedRootDisplaced = true;
    renameSync(foreign.alias, state.alias);
    foreignAtAlias = false;
    foreignMovedToTarget = true;
    state.cleanupReplacementMutation = Object.freeze({
      kind: "root",
      foreignAlias: foreign.alias,
      foreignIdentity: identityV2(foreign.stat),
      foreignInventory: foreign.cleanupInventory,
      targetRelativePath: "",
      displacedAlias,
    });
  } catch (error) {
    const cleanupErrors: unknown[] = [];
    if (foreignMovedToTarget) {
      const target = mutation === "replace_root_with_foreign_tree"
        ? state.alias
        : path.join(state.root, ".staging");
      try {
        assertExactOwnedTreeV2(target, foreign.cleanupInventory);
        renameSync(target, foreign.alias);
        foreignAtAlias = true;
        foreignMovedToTarget = false;
      } catch (candidate) {
        cleanupErrors.push(candidate);
      }
    }
    if (ownedRootDisplaced && displacedAlias !== undefined) {
      try {
        renameSync(displacedAlias, state.alias);
        ownedRootDisplaced = false;
      } catch (candidate) {
        cleanupErrors.push(candidate);
      }
    }
    if (ownedDescendantRemoved && !foreignMovedToTarget) {
      try {
        const replacement = path.join(state.root, ".staging");
        mkdirSync(replacement, { mode: 0o700 });
        chmodSync(replacement, 0o700);
        const entry = recordCleanupPathV2(state.root, state.cleanupInventory, replacement);
        state.childIdentities = Object.freeze({
          ...state.childIdentities,
          ".staging": entry.identity,
        });
        fsyncDirectoryV2(state.root);
        ownedDescendantRemoved = false;
      } catch (candidate) {
        cleanupErrors.push(candidate);
      }
    }
    if (foreignAtAlias) {
      try {
        cleanupExactOwnedTreeV2(foreign.alias, foreign.cleanupInventory);
        foreignAtAlias = false;
      } catch (candidate) {
        cleanupErrors.push(candidate);
      }
    }
    if (cleanupErrors.length > 0) {
      return failV2(
        error instanceof PlatformReleaseContentStoreTestErrorV2
          ? error.code
          : "CONTENT_STORE_FILESYSTEM_DRIFT",
        "Cleanup replacement mutation failed and exact rollback also failed",
        new AggregateError([error, ...cleanupErrors]),
      );
    }
    if (error instanceof PlatformReleaseContentStoreTestErrorV2) throw error;
    return failV2(
      "CONTENT_STORE_FILESYSTEM_DRIFT",
      "Cleanup replacement mutation failed before ownership transfer",
      error,
    );
  } finally {
    canaryBytes.fill(0);
  }
}

export function inspectPlatformReleaseContentStoreCleanupReplacementForTestV2(
  fixture: PlatformReleaseContentStoreTestFixtureV2,
): Readonly<{
  kind: "descendant" | "root";
  foreignRootIdentityPreserved: boolean;
  foreignCanaryPreserved: boolean;
  ownedFixtureRootPreserved: boolean;
}> {
  const state = cleanupReplacementFixtureStateV2(fixture);
  const mutation = state.cleanupReplacementMutation;
  if (mutation === undefined) {
    return failV2("CONTENT_STORE_FILESYSTEM_DRIFT", "Fixture has no cleanup replacement mutation");
  }
  const foreignRoot = mutation.kind === "root"
    ? state.alias
    : path.join(state.root, mutation.targetRelativePath);
  const foreignStat = lstatSync(foreignRoot, { bigint: true }) as BigIntStatV2;
  const canaryPath = path.join(foreignRoot, "foreign-canary.txt");
  const canary = lstatSync(canaryPath, { bigint: true }) as BigIntStatV2;
  const canaryEntry = mutation.foreignInventory.get("foreign-canary.txt");
  const ownedRootPath = mutation.kind === "root" ? mutation.displacedAlias : state.root;
  let ownedFixtureRootPreserved = false;
  if (ownedRootPath !== undefined) {
    const ownedRoot = lstatSync(ownedRootPath, { bigint: true }) as BigIntStatV2;
    ownedFixtureRootPreserved = ownedRoot.isDirectory()
      && !ownedRoot.isSymbolicLink()
      && sameIdentityV2(identityV2(ownedRoot), state.rootIdentity);
  }
  return Object.freeze({
    kind: mutation.kind,
    foreignRootIdentityPreserved: foreignStat.isDirectory()
      && !foreignStat.isSymbolicLink()
      && sameIdentityV2(identityV2(foreignStat), mutation.foreignIdentity),
    foreignCanaryPreserved: canaryEntry !== undefined
      && cleanupEntryMatchesStatV2(canaryEntry, canary),
    ownedFixtureRootPreserved,
  });
}

export function recoverPlatformReleaseContentStoreCleanupReplacementForTestV2(
  fixture: PlatformReleaseContentStoreTestFixtureV2,
): void {
  const state = cleanupReplacementFixtureStateV2(fixture);
  const mutation = state.cleanupReplacementMutation;
  if (mutation === undefined) {
    return failV2("CONTENT_STORE_FILESYSTEM_DRIFT", "Fixture has no cleanup replacement mutation to recover");
  }
  const currentForeignRoot = mutation.kind === "root"
    ? state.alias
    : path.join(state.root, mutation.targetRelativePath);
  assertExactOwnedTreeV2(currentForeignRoot, mutation.foreignInventory);
  if (mutation.kind === "descendant") {
    renameSync(currentForeignRoot, mutation.foreignAlias);
    const replacement = path.join(state.root, ".staging");
    mkdirSync(replacement, { mode: 0o700 });
    chmodSync(replacement, 0o700);
    const entry = recordCleanupPathV2(state.root, state.cleanupInventory, replacement);
    state.childIdentities = Object.freeze({
      ...state.childIdentities,
      ".staging": entry.identity,
    });
    fsyncDirectoryV2(state.root);
  } else {
    if (mutation.displacedAlias === undefined) {
      return failV2("CONTENT_STORE_FILESYSTEM_DRIFT", "Root cleanup replacement lost its displaced owner");
    }
    assertExactOwnedTreeV2(mutation.displacedAlias, state.cleanupInventory);
    renameSync(currentForeignRoot, mutation.foreignAlias);
    renameSync(mutation.displacedAlias, state.alias);
  }
  cleanupExactOwnedTreeV2(mutation.foreignAlias, mutation.foreignInventory);
  delete state.cleanupReplacementMutation;
}

export function armPlatformReleaseContentStoreTestDisposeFailureForTestV2(
  fixture: PlatformReleaseContentStoreTestFixtureV2,
  checkpoint: "before_cleanup" | "after_external_cleanup" = "before_cleanup",
): void {
  const state = fixtureFromV2(fixture);
  if (state.disposeFaultOnce) {
    return failV2("CONTENT_STORE_DISPOSE_INVALID", "Fixture dispose failure is already armed");
  }
  state.disposeFaultOnce = checkpoint;
}

export function inspectPlatformReleaseContentStoreTestFixtureLifecycleForTestV2(
  fixture: PlatformReleaseContentStoreTestFixtureV2,
): Readonly<{
  lifecycle: "open" | "cleaning" | "cleanup_failed";
  fixtureRootRetained: boolean;
  externalMutationOwned: boolean;
}> {
  if (typeof fixture !== "object" || fixture === null || isProxy(fixture)) {
    return failV2(
      "CONTENT_STORE_FIXTURE_HANDLE_UNAUTHENTICATED",
      "Fixture lifecycle inspection requires the authentic code-owned handle",
    );
  }
  const state = fixtureStatesV2.get(fixture);
  if (state === undefined || state.lifecycle === "disposed") {
    return failV2(
      "CONTENT_STORE_FIXTURE_HANDLE_UNAUTHENTICATED",
      "Fixture lifecycle inspection requires retained cleanup ownership",
    );
  }
  let fixtureRootRetained = false;
  try {
    const current = lstatSync(state.alias, { bigint: true }) as BigIntStatV2;
    fixtureRootRetained = current.isDirectory()
      && !current.isSymbolicLink()
      && sameIdentityV2(identityV2(current), state.rootIdentity);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  return Object.freeze({
    lifecycle: state.lifecycle,
    fixtureRootRetained,
    externalMutationOwned: state.prePublicationMutation !== undefined,
  });
}

export function publishPlatformReleaseContentStoreTestForTestV2(
  fixture: PlatformReleaseContentStoreTestFixtureV2,
  stage: PlatformReleaseContentStoreTestStageV2,
  options: Readonly<{
    challenge?: Uint8Array;
    fault?: PlatformReleaseContentStoreTestFaultV2;
  }> = {},
): PlatformReleaseContentStoreTestV2 {
  const state = fixtureFromV2(fixture);
  const stageState = stageFromV2(stage);
  const challenge = options.challenge === undefined ? randomBytes(32) : Buffer.from(options.challenge);
  if (challenge.byteLength !== 32) return failV2("CONTENT_STORE_CHALLENGE_INVALID", "Content-store publication requires exactly 32 challenge bytes");
  const layout = storeLayoutV2(state, stageState.manifest.manifestPayloadHash, stageState.buildAttestation.attestationHash);
  assertStoreShapeBeforePublishV2(state, layout);
  let nativePublication: NativePublicationV2;
  if (options.fault === undefined) {
    nativePublication = publishNativeBytesV2(state, stageState, layout);
  } else {
    const lock = acquireLockV2(state, stageState.manifest.manifestPayloadHash);
    let faultPublication: "published" | "adopted_identical" | undefined;
    let publicationError: unknown;
    try {
      faultPublication = publishBytesV2(state, stageState, layout, options.fault);
    } catch (error) {
      publicationError = error;
    }
    if (
      options.fault.checkpoint === "replace_lock_before_release"
      || options.fault.checkpoint
        === "replace_staging_root_before_cleanup_and_lock_before_release"
      || options.fault.checkpoint
        === "fail_publication_and_replace_staging_before_cleanup_and_lock_before_release"
    ) {
      try {
        installReleaseLockReplacementFaultV2(state, lock);
      } catch (error) {
        if (publicationError === undefined) publicationError = error;
      }
    }
    let releaseError: unknown;
    try {
      releaseLockV2(state, lock);
    } catch (error) {
      releaseError = error;
    }
    if (publicationError !== undefined) {
      if (releaseError !== undefined) {
        if (publicationError instanceof PlatformReleaseContentStoreTestErrorV2) {
          return failV2(
            publicationError.code,
            "Publication failed before receipt ownership transfer; publisher-lock cleanup also failed",
            new AggregateError([publicationError, releaseError]),
          );
        }
        return failV2(
          "CONTENT_STORE_PUBLICATION_INVALID",
          "Publication failed before receipt ownership transfer; publisher-lock cleanup also failed",
          new AggregateError([publicationError, releaseError]),
        );
      }
      throw publicationError;
    }
    if (releaseError !== undefined) throw releaseError;
    return failV2(
      "CONTENT_STORE_PUBLICATION_INVALID",
      `Fault-characterization publication path cannot issue a receipt (${String(faultPublication)})`,
    );
  }
  const publication = nativePublication.publication;
  const publishedFence = captureAndJoinNativePublicationFenceV2(
    state,
    layout,
    nativePublication,
  );
  if (publication === "adopted_identical") {
    const committed = state.committedPublication;
    if (
      committed === undefined
      || committed.manifestPayloadHash !== stageState.manifest.manifestPayloadHash
      || committed.attestationHash !== stageState.buildAttestation.attestationHash
      || !sameCommittedFenceV2(committed.fence, publishedFence)
    ) {
      return failV2(
        "CONTENT_STORE_FILESYSTEM_DRIFT",
        "Identical bytes no longer match the code-owned committed physical fence",
      );
    }
  }
  const reproduction = reproduceBytesV2({
    fixture: state,
    manifestPath: layout.manifestPath,
    attestationPath: layout.attestationPath,
    manifestBytes: stageState.manifestBytes,
    attestationBytes: stageState.attestationBytes,
  }, {
    manifestPayloadHash: stageState.manifest.manifestPayloadHash,
    attestationHash: stageState.buildAttestation.attestationHash,
  });
  if (canonicalJsonStringify(reproduction.fence) !== canonicalJsonStringify(publishedFence)) {
    return failV2(
      "CONTENT_STORE_FILESYSTEM_DRIFT",
      "Published physical fence changed during post-lock fresh reproduction",
    );
  }
  const freshIdentity = {
    outcome: "exact_manifest_and_attestation_reproduced" as const,
    manifestPayloadHash: stageState.manifest.manifestPayloadHash,
    attestationHash: stageState.buildAttestation.attestationHash,
    manifestFileContentHash: sha256BytesV2(stageState.manifestBytes),
    attestationFileContentHash: sha256BytesV2(stageState.attestationBytes),
    manifestByteLength: stageState.manifestBytes.byteLength,
    attestationByteLength: stageState.attestationBytes.byteLength,
  };
  const filesystemMechanics = {
    capability: PLATFORM_RELEASE_CONTENT_STORE_TEST_FILESYSTEM_CAPABILITY_V2,
    productionAuthority: false as const,
    publicationBackend: PLATFORM_RELEASE_CONTENT_STORE_TEST_PUBLICATION_BACKEND_V2,
    contentLeasePolicy: PLATFORM_RELEASE_CONTENT_STORE_TEST_CONTENT_LEASE_POLICY_V2,
    attestationLeasePolicy: PLATFORM_RELEASE_CONTENT_STORE_TEST_ATTESTATION_LEASE_POLICY_V2,
    conditionalUnlinkPolicy: PLATFORM_RELEASE_CONTENT_STORE_TEST_CONDITIONAL_UNLINK_POLICY_V2,
    exactCleanupPolicy: PLATFORM_RELEASE_CONTENT_STORE_TEST_EXACT_CLEANUP_POLICY_V2,
    staleLeaseRecoveryPolicy:
      PLATFORM_RELEASE_CONTENT_STORE_TEST_STALE_LEASE_RECOVERY_POLICY_V2,
    contentLeaseRecovered: false as const,
    attestationLeaseRecovered: false as const,
    unauthenticatedStaleLeaseRecoveryEnabled: true as const,
    authenticatedLeaseLedgerPresent: false as const,
    sameUidAtomicConditionalUnlinkAvailable: false as const,
    fixtureBuildRecipeHash: state.nativeFilesystemIdentity.buildRecipeHash,
    fixtureBinaryHash: state.nativeFilesystemIdentity.binarySha256,
    fixtureBinaryByteLength: state.nativeFilesystemIdentity.binaryByteLength,
  };
  const identity = {
    schema: "setfarm.platform-release-content-store-test.v2" as const,
    version: "2.0.0" as const,
    authorityState: "test_fixture_content_store_unverified" as const,
    admissionScope: "test_fixture" as const,
    productionAuthority: false as const,
    productionAdmission: "forbidden" as const,
    credentialUse: "none" as const,
    signingAuthority: "unsigned_test_fixture" as const,
    mutationAuthority: false as const,
    operationMode: "test_fixture_publication_only" as const,
    trustConclusion: "characterization_only" as const,
    productionBlockers: [
      "production_store_bootstrap_absent",
      "authenticated_release_lease_absent",
      "atomic_conditional_unlink_absent",
      "crash_replay_ledger_absent",
      "runtime_payload_unbound",
      "fresh_production_verifier_absent",
    ] as const,
    implementationScope: "test_fixture_private_release_store_v2" as const,
    payloadBinding: "test_fixture_manifest_attestation_bytes_only_v2" as const,
    layout: "private_store_dot_staging_dot_locks_releases_attestations_v2" as const,
    snapshotScope: "single_release_single_attestation_fixture_snapshot_v2" as const,
    ephemeralLockPolicy: PLATFORM_RELEASE_CONTENT_STORE_TEST_EPHEMERAL_LOCK_POLICY_V2,
    challengeHash: sha256BytesV2(challenge),
    manifestPayloadHash: stageState.manifest.manifestPayloadHash,
    attestationHash: stageState.buildAttestation.attestationHash,
    releaseContentHash: stageState.manifest.manifestPayloadHash,
    manifestFileContentHash: sha256BytesV2(stageState.manifestBytes),
    attestationFileContentHash: sha256BytesV2(stageState.attestationBytes),
    manifestByteLength: stageState.manifestBytes.byteLength,
    attestationByteLength: stageState.attestationBytes.byteLength,
    publication,
    filesystemMechanics,
    nativePublicationHash:
      hashPlatformReleaseContentStoreTestNativePublicationV2(
        filesystemMechanics,
        publication,
        publishedFence,
      ),
    storeMembershipHash: layout.storeMembershipHash,
    releaseMembershipHash: layout.releaseMembershipHash,
    publishedFence,
    reproducedFence: reproduction.fence,
    freshReproduction: {
      ...freshIdentity,
      reproductionHash: freshReproductionHashV2(freshIdentity),
    },
  };
  const receipt = parsePlatformReleaseContentStoreTestCandidateV2({
    ...identity,
    storeHash: hashPlatformReleaseContentStoreTestV2(identity),
  });
  if (publication === "published") {
    state.committedPublication = Object.freeze({
      manifestPayloadHash: stageState.manifest.manifestPayloadHash,
      attestationHash: stageState.buildAttestation.attestationHash,
      fence: publishedFence,
    });
  }
  receiptStatesV2.set(receipt, {
    fixture: state,
    manifestPath: layout.manifestPath,
    attestationPath: layout.attestationPath,
    manifestBytes: Buffer.from(stageState.manifestBytes),
    attestationBytes: Buffer.from(stageState.attestationBytes),
  });
  stageState.consumed = true;
  stageStatesV2.delete(stage);
  stageState.manifestBytes.fill(0);
  stageState.attestationBytes.fill(0);
  return receipt;
}

function assertStoreShapeBeforePublishV2(
  state: FixtureStateV2,
  layout: ReturnType<typeof storeLayoutV2>,
): void {
  if (state.lifecycle !== "open") return failV2("CONTENT_STORE_FIXTURE_HANDLE_UNAUTHENTICATED", "Fixture is not open for publication");
  const root = lstatSync(state.root, { bigint: true }) as BigIntStatV2;
  if (root.isSymbolicLink() || !root.isDirectory() || modeTextV2(root) !== STORE_ROOT_MODE_V2 || !sameIdentityV2(identityV2(root), state.rootIdentity)) return failV2("CONTENT_STORE_FIXTURE_HANDLE_UNAUTHENTICATED", "Fixture root changed before publication");
  if (root.uid !== BigInt(state.ownerUid) || root.gid !== BigInt(state.ownerGid)) {
    return failV2("CONTENT_STORE_FIXTURE_HANDLE_UNAUTHENTICATED", "Fixture root owner changed before publication");
  }
  assertPersistentStoreAnchorsV2(state, "before the first publication side effect");
  assertSortedExactV2(readdirSync(state.root), expectedStoreChildrenV2(), "Store root has unexpected children before publication");
  assertSortedExactV2(readdirSync(path.join(state.root, ".staging")), [], "Store child .staging is not empty before publication");
  assertSortedExactV2(readdirSync(path.join(state.root, ".locks")), [], "Store child .locks is not empty before publication");
  const existingReleaseNames = readdirSync(path.join(state.root, "releases"));
  const existingAttestationNames = readdirSync(path.join(state.root, "attestations"));
  if (existingReleaseNames.length > 0 && canonicalJsonStringify(existingReleaseNames.sort()) !== canonicalJsonStringify([path.basename(layout.releaseRoot)])) {
    return failV2("CONTENT_STORE_FILESYSTEM_DRIFT", "Release store contains an unexpected pre-existing release");
  }
  if (existingAttestationNames.length > 0 && canonicalJsonStringify(existingAttestationNames.sort()) !== canonicalJsonStringify([path.basename(layout.attestationPath)])) {
    return failV2("CONTENT_STORE_FILESYSTEM_DRIFT", "Attestation store contains an unexpected pre-existing attestation");
  }
  assertPersistentStoreAnchorsV2(state, "after publication preflight and before lease acquisition");
}

export function reproducePlatformReleaseContentStoreTestForTestV2(
  receipt: PlatformReleaseContentStoreTestV2,
): PlatformReleaseContentStoreTestV2 {
  const state = receiptStateV2(receipt);
  const layout = storeLayoutV2(state.fixture, receipt.manifestPayloadHash, receipt.attestationHash);
  try {
    const reproduction = reproduceBytesV2(state, receipt);
    if (canonicalJsonStringify(reproduction.fence) !== canonicalJsonStringify(receipt.reproducedFence)
        || canonicalJsonStringify(reproduction.fence) !== canonicalJsonStringify(receipt.publishedFence)) {
      return failV2("CONTENT_STORE_REPRODUCTION_INVALID", "Fresh reproduction no longer matches the sealed physical fence");
    }
    return receipt;
  } catch (error) {
    if (error instanceof PlatformReleaseContentStoreTestErrorV2) {
      if (error.code === "CONTENT_STORE_REPRODUCTION_INVALID") throw error;
      return failV2("CONTENT_STORE_REPRODUCTION_INVALID", "Fresh reproduction rejected the physical store shape", error);
    }
    return failV2("CONTENT_STORE_REPRODUCTION_INVALID", "Fresh reproduction failed", error);
  }
}

export function mutatePlatformReleaseContentStoreTestFixtureForTestV2(
  receipt: PlatformReleaseContentStoreTestV2,
  mutation: PlatformReleaseContentStoreTestMutationV2,
): void {
  const state = receiptStateV2(receipt);
  const layout = storeLayoutV2(state.fixture, receipt.manifestPayloadHash, receipt.attestationHash);
  assertStoreShapeV2(state.fixture, layout);
  if (mutation === "replace_locks_root_same_layout" || mutation === "replace_staging_root_same_layout") {
    const child = mutation === "replace_locks_root_same_layout" ? ".locks" : ".staging";
    const childPath = path.join(state.fixture.root, child);
    rmdirSync(childPath);
    forgetCleanupPathV2(state.fixture.root, state.fixture.cleanupInventory, childPath);
    mkdirSync(childPath, { mode: 0o700 });
    chmodSync(childPath, 0o700);
    recordCleanupPathV2(state.fixture.root, state.fixture.cleanupInventory, childPath);
    fsyncDirectoryV2(state.fixture.root);
    return;
  }
  if (mutation === "replace_manifest_same_bytes" || mutation === "replace_manifest_different_bytes") {
    const replacement = mutation === "replace_manifest_same_bytes"
      ? state.manifestBytes
      : Buffer.from("not-a-platform-release-manifest\n", "utf8");
    const temporary = path.join(layout.releaseRoot, `.mutation-${randomBytes(8).toString("hex")}.tmp`);
    changeOwnedCleanupDirectoryModeV2(
      state.fixture.root,
      state.fixture.cleanupInventory,
      layout.releaseRoot,
      0o700,
    );
    try {
      writeExclusiveFileV2(temporary, Buffer.from(replacement), 0o444);
      recordCleanupPathV2(state.fixture.root, state.fixture.cleanupInventory, temporary);
      renameSync(temporary, layout.manifestPath);
      forgetCleanupPathV2(
        state.fixture.root,
        state.fixture.cleanupInventory,
        layout.manifestPath,
      );
      moveCleanupInventoryPrefixV2(
        state.fixture.cleanupInventory,
        cleanupRelativePathV2(state.fixture.root, temporary),
        cleanupRelativePathV2(state.fixture.root, layout.manifestPath),
      );
      fsyncDirectoryV2(layout.releaseRoot);
    } finally {
      changeOwnedCleanupDirectoryModeV2(
        state.fixture.root,
        state.fixture.cleanupInventory,
        layout.releaseRoot,
        0o555,
      );
    }
    return;
  }
  if (mutation === "replace_attestation_same_bytes") {
    const temporary = path.join(
      state.fixture.root,
      "attestations",
      `.mutation-${randomBytes(8).toString("hex")}.tmp`,
    );
    writeExclusiveFileV2(temporary, Buffer.from(state.attestationBytes), 0o444);
    recordCleanupPathV2(state.fixture.root, state.fixture.cleanupInventory, temporary);
    renameSync(temporary, layout.attestationPath);
    forgetCleanupPathV2(
      state.fixture.root,
      state.fixture.cleanupInventory,
      layout.attestationPath,
    );
    moveCleanupInventoryPrefixV2(
      state.fixture.cleanupInventory,
      cleanupRelativePathV2(state.fixture.root, temporary),
      cleanupRelativePathV2(state.fixture.root, layout.attestationPath),
    );
    fsyncDirectoryV2(path.dirname(layout.attestationPath));
    return;
  }
  if (mutation === "add_release_extra_file") {
    changeOwnedCleanupDirectoryModeV2(
      state.fixture.root,
      state.fixture.cleanupInventory,
      layout.releaseRoot,
      0o700,
    );
    try {
      writeExclusiveFileV2(path.join(layout.releaseRoot, "extra.txt"), Buffer.from("extra\n", "utf8"), 0o444);
      recordCleanupPathV2(
        state.fixture.root,
        state.fixture.cleanupInventory,
        path.join(layout.releaseRoot, "extra.txt"),
      );
      fsyncDirectoryV2(layout.releaseRoot);
    } finally {
      changeOwnedCleanupDirectoryModeV2(
        state.fixture.root,
        state.fixture.cleanupInventory,
        layout.releaseRoot,
        0o555,
      );
    }
    return;
  }
  if (mutation === "add_staging_extra_file") {
    const stagingPath = path.join(state.fixture.root, ".staging");
    writeExclusiveFileV2(path.join(stagingPath, "unexpected.txt"), Buffer.from("unexpected\n", "utf8"), 0o444);
    recordCleanupPathV2(
      state.fixture.root,
      state.fixture.cleanupInventory,
      path.join(stagingPath, "unexpected.txt"),
    );
    fsyncDirectoryV2(stagingPath);
    return;
  }
  if (mutation === "add_attestations_extra_file") {
    const extraPath = path.join(state.fixture.root, "attestations", "unexpected.json");
    writeExclusiveFileV2(extraPath, Buffer.from("unexpected\n", "utf8"), 0o444);
    recordCleanupPathV2(state.fixture.root, state.fixture.cleanupInventory, extraPath);
    fsyncDirectoryV2(path.dirname(extraPath));
    return;
  }
  if (mutation === "add_releases_extra_directory") {
    const extraPath = path.join(state.fixture.root, "releases", "unexpected");
    mkdirSync(extraPath, { mode: 0o700 });
    chmodSync(extraPath, 0o700);
    recordCleanupPathV2(state.fixture.root, state.fixture.cleanupInventory, extraPath);
    fsyncDirectoryV2(path.dirname(extraPath));
    return;
  }
  if (mutation === "remove_attestation") {
    unlinkSync(layout.attestationPath);
    forgetCleanupPathV2(
      state.fixture.root,
      state.fixture.cleanupInventory,
      layout.attestationPath,
    );
    fsyncDirectoryV2(path.join(state.fixture.root, "attestations"));
    return;
  }
  if (mutation === "remove_release_and_attestation") {
    changeOwnedCleanupDirectoryModeV2(
      state.fixture.root,
      state.fixture.cleanupInventory,
      layout.releaseRoot,
      0o700,
    );
    unlinkSync(layout.manifestPath);
    forgetCleanupPathV2(
      state.fixture.root,
      state.fixture.cleanupInventory,
      layout.manifestPath,
    );
    rmdirSync(layout.releaseRoot);
    forgetCleanupPathV2(
      state.fixture.root,
      state.fixture.cleanupInventory,
      layout.releaseRoot,
    );
    unlinkSync(layout.attestationPath);
    forgetCleanupPathV2(
      state.fixture.root,
      state.fixture.cleanupInventory,
      layout.attestationPath,
    );
    fsyncDirectoryV2(path.join(state.fixture.root, "releases"));
    fsyncDirectoryV2(path.join(state.fixture.root, "attestations"));
    fsyncDirectoryV2(state.fixture.root);
    return;
  }
  return failV2("CONTENT_STORE_PUBLICATION_INVALID", "Unknown test mutation");
}
