import { createHash } from "node:crypto";
import { constants, type BigIntStats } from "node:fs";
import {
  lstat,
  open,
  readdir,
  rename,
  rmdir,
  type FileHandle,
} from "node:fs/promises";
import path from "node:path";

import {
  PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2,
  PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_DOCUMENT_PROTOCOL_CATALOG_V2,
} from "../execution/schemas/platform-release-bootstrap-contract-v2.js";
import { PLATFORM_RELEASE_BOOTSTRAP_COOPERATIVE_CAPTURE_CAPABILITY_V2 } from "./platform-release-bootstrap-filesystem-capture-core-v2.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_PHYSICAL_OWNER_ID_MAX_V2,
  buildFsObservationFingerprintV2,
  parseBootstrapFilesystemScopeIdentityCandidateV2,
  parseStableFsObjectIdentityCandidateV2,
  type BootstrapFilesystemScopeIdentityV2,
  type FsObservationFingerprintV2,
  type StableFsObjectIdentityV2,
} from "./platform-release-bootstrap-physical-census-v2.js";

export const PLATFORM_RELEASE_BOOTSTRAP_EPOCH_TARGET_STAGE_BASENAME_V2 =
  "staged_target_epoch_state" as const;

export const PlatformReleaseBootstrapEpochPublicationCheckpointV2 = {
  afterStageFileSync: "after_epoch_stage_file_sync",
  afterStageDirectorySync: "after_epoch_stage_directory_sync",
  afterAtomicReplace: "after_epoch_atomic_replace",
  afterTargetFileSync: "after_epoch_target_file_sync",
  afterTargetDirectorySync: "after_epoch_target_directory_sync",
  afterConsumedStageDirectorySync: "after_epoch_consumed_stage_directory_sync",
  afterStageDirectoryRemove: "after_epoch_stage_directory_remove",
  afterFinalParentSync: "after_epoch_final_parent_sync",
} as const;

export type PlatformReleaseBootstrapEpochPublicationCheckpointV2 =
  (typeof PlatformReleaseBootstrapEpochPublicationCheckpointV2)[keyof typeof PlatformReleaseBootstrapEpochPublicationCheckpointV2];

export type PlatformReleaseBootstrapEpochPublicationCheckpointHookV2 = (
  checkpoint: PlatformReleaseBootstrapEpochPublicationCheckpointV2,
  context: Readonly<{
    stagingDirectoryPath: string;
    namespaceParentPath: string;
    stagePath: string;
    targetPath: string;
  }>,
) => void | Promise<void>;

export type PlatformReleaseBootstrapEpochPublicationInputV2 = Readonly<{
  filesystemScope: BootstrapFilesystemScopeIdentityV2;
  stagingDirectoryPath: string;
  namespaceParentPath: string;
  expectedPriorRawContentHash: string;
  expectedTargetRawContentHash: string;
  expectedPriorObjectIdentity: StableFsObjectIdentityV2;
  expectedStagingDirectoryObjectIdentity: StableFsObjectIdentityV2;
  expectedTargetObjectIdentity: StableFsObjectIdentityV2;
}>;

export type PlatformReleaseBootstrapEpochPublicationV2 = Readonly<{
  capability: typeof PLATFORM_RELEASE_BOOTSTRAP_COOPERATIVE_CAPTURE_CAPABILITY_V2;
  objectIdentity: StableFsObjectIdentityV2;
  fingerprint: FsObservationFingerprintV2;
  rawContentHash: string;
}>;

export type PlatformReleaseBootstrapEpochPublicationErrorCodeV2 =
  | "EPOCH_PUBLICATION_CONFLICT"
  | "EPOCH_PUBLICATION_INVALID"
  | "EPOCH_PUBLICATION_PARENT_CHANGED"
  | "EPOCH_PUBLICATION_UNAVAILABLE";

export class PlatformReleaseBootstrapEpochPublicationErrorV2 extends Error {
  constructor(
    readonly code: PlatformReleaseBootstrapEpochPublicationErrorCodeV2,
    message: string,
    options: ErrorOptions = {},
  ) {
    super(message, options);
    this.name = "PlatformReleaseBootstrapEpochPublicationErrorV2";
  }
}

type ExactFileV2 = Readonly<{
  stat: BigIntStats;
  rawContentHash: string;
}>;

type StableParentV2 = Readonly<{
  handle: FileHandle;
  before: BigIntStats;
}>;

const MAX_FILE_BYTES_V2 = Math.max(
  ...PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_DOCUMENT_PROTOCOL_CATALOG_V2.documents.map(
    (document) => document.maxCanonicalBytes,
  ),
);

function publicationErrorV2(
  code: PlatformReleaseBootstrapEpochPublicationErrorCodeV2,
  message: string,
  cause?: unknown,
): PlatformReleaseBootstrapEpochPublicationErrorV2 {
  return new PlatformReleaseBootstrapEpochPublicationErrorV2(
    code,
    message,
    cause === undefined ? {} : { cause },
  );
}

function isNodeCodeV2(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && error.code === code;
}

function exactAbsolutePathV2(value: string, label: string): string {
  if (
    typeof value !== "string" ||
    !path.isAbsolute(value) ||
    path.normalize(value) !== value
  ) {
    throw publicationErrorV2(
      "EPOCH_PUBLICATION_INVALID",
      `Epoch publication ${label} must be one normalized absolute path`,
    );
  }
  return value;
}

function validateInputV2(
  input: PlatformReleaseBootstrapEpochPublicationInputV2,
): PlatformReleaseBootstrapEpochPublicationInputV2 {
  if (
    !/^[a-f0-9]{64}$/.test(input.expectedPriorRawContentHash) ||
    !/^[a-f0-9]{64}$/.test(input.expectedTargetRawContentHash) ||
    input.expectedPriorRawContentHash === input.expectedTargetRawContentHash
  ) {
    throw publicationErrorV2(
      "EPOCH_PUBLICATION_INVALID",
      "Epoch prior and target content identities must be distinct SHA-256 values",
    );
  }
  try {
    const filesystemScope = parseBootstrapFilesystemScopeIdentityCandidateV2(
      input.filesystemScope,
    );
    const expectedTargetObjectIdentity = parseStableFsObjectIdentityCandidateV2(
      input.expectedTargetObjectIdentity,
    );
    const expectedPriorObjectIdentity = parseStableFsObjectIdentityCandidateV2(
      input.expectedPriorObjectIdentity,
    );
    const expectedStagingDirectoryObjectIdentity =
      parseStableFsObjectIdentityCandidateV2(
        input.expectedStagingDirectoryObjectIdentity,
      );
    if (
      expectedTargetObjectIdentity.objectKind !== "ordinary_file" ||
      expectedTargetObjectIdentity.filesystemScopeIdentityHash !==
        filesystemScope.scopeIdentityHash ||
      expectedPriorObjectIdentity.objectKind !== "ordinary_file" ||
      expectedPriorObjectIdentity.filesystemScopeIdentityHash !==
        filesystemScope.scopeIdentityHash ||
      expectedStagingDirectoryObjectIdentity.objectKind !== "directory" ||
      expectedStagingDirectoryObjectIdentity.filesystemScopeIdentityHash !==
        filesystemScope.scopeIdentityHash ||
      expectedStagingDirectoryObjectIdentity.objectIdentityHash ===
        expectedTargetObjectIdentity.objectIdentityHash ||
      expectedPriorObjectIdentity.objectIdentityHash ===
        expectedTargetObjectIdentity.objectIdentityHash ||
      expectedPriorObjectIdentity.objectIdentityHash ===
        expectedStagingDirectoryObjectIdentity.objectIdentityHash
    ) {
      throw publicationErrorV2(
        "EPOCH_PUBLICATION_INVALID",
        "Epoch target identity must be one ordinary file in the admitted filesystem scope",
      );
    }
    const namespaceParentPath = exactAbsolutePathV2(
      input.namespaceParentPath,
      "namespace parent",
    );
    const stagingDirectoryPath = exactAbsolutePathV2(
      input.stagingDirectoryPath,
      "staging directory",
    );
    if (
      stagingDirectoryPath !==
      path.join(
        namespaceParentPath,
        PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.registry
          .transactionStagingBasename,
      )
    ) {
      throw publicationErrorV2(
        "EPOCH_PUBLICATION_INVALID",
        "Epoch staging directory must be the fixed direct child of the namespace parent",
      );
    }
    return Object.freeze({
      filesystemScope,
      stagingDirectoryPath,
      namespaceParentPath,
      expectedPriorRawContentHash: input.expectedPriorRawContentHash,
      expectedTargetRawContentHash: input.expectedTargetRawContentHash,
      expectedPriorObjectIdentity,
      expectedStagingDirectoryObjectIdentity,
      expectedTargetObjectIdentity,
    });
  } catch (error) {
    if (error instanceof PlatformReleaseBootstrapEpochPublicationErrorV2) {
      throw error;
    }
    throw publicationErrorV2(
      "EPOCH_PUBLICATION_INVALID",
      "Epoch publication scope or target identity is invalid",
      error,
    );
  }
}

function sameIdentityV2(left: BigIntStats, right: BigIntStats): boolean {
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

function requireExpectedObjectIdentityV2(
  stat: BigIntStats,
  expected: StableFsObjectIdentityV2,
): void {
  if (
    !stat.isFile() ||
    stat.dev.toString(10) !== expected.device ||
    stat.ino.toString(10) !== expected.inode
  ) {
    throw publicationErrorV2(
      "EPOCH_PUBLICATION_CONFLICT",
      "Epoch object does not match its authority-bound stable identity",
    );
  }
}

function requirePrivateFileV2(stat: BigIntStats): void {
  if (
    !stat.isFile() ||
    (stat.mode & 0o7777n) !== 0o600n ||
    stat.nlink !== 1n ||
    stat.size < 1n ||
    stat.size > BigInt(MAX_FILE_BYTES_V2) ||
    (typeof process.getuid === "function" &&
      stat.uid !== BigInt(process.getuid()))
  ) {
    throw publicationErrorV2(
      "EPOCH_PUBLICATION_INVALID",
      "Epoch publication requires one exact private unaliased ordinary file",
    );
  }
}

async function readExactFileV2(filePath: string): Promise<ExactFileV2> {
  const pathBefore = await lstat(filePath, { bigint: true });
  requirePrivateFileV2(pathBefore);
  const bytes = Buffer.allocUnsafe(Number(pathBefore.size));
  const probe = Buffer.allocUnsafe(1);
  let handle: FileHandle | undefined;
  try {
    handle = await open(
      filePath,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
    const descriptorBefore = await handle.stat({ bigint: true });
    if (!sameIdentityV2(pathBefore, descriptorBefore)) {
      throw publicationErrorV2(
        "EPOCH_PUBLICATION_INVALID",
        "Epoch publication member changed before descriptor admission",
      );
    }
    let offset = 0;
    while (offset < bytes.length) {
      const read = await handle.read(
        bytes,
        offset,
        bytes.length - offset,
        offset,
      );
      if (read.bytesRead === 0) {
        throw publicationErrorV2(
          "EPOCH_PUBLICATION_INVALID",
          "Epoch publication member reached early EOF",
        );
      }
      offset += read.bytesRead;
    }
    if ((await handle.read(probe, 0, 1, bytes.length)).bytesRead !== 0) {
      throw publicationErrorV2(
        "EPOCH_PUBLICATION_INVALID",
        "Epoch publication member exceeded its exact byte length",
      );
    }
    const descriptorAfter = await handle.stat({ bigint: true });
    const pathAfter = await lstat(filePath, { bigint: true });
    if (
      !sameIdentityV2(pathBefore, descriptorAfter) ||
      !sameIdentityV2(pathBefore, pathAfter)
    ) {
      throw publicationErrorV2(
        "EPOCH_PUBLICATION_INVALID",
        "Epoch publication member changed during exact read",
      );
    }
    return Object.freeze({
      stat: pathAfter,
      rawContentHash: createHash("sha256").update(bytes).digest("hex"),
    });
  } finally {
    bytes.fill(0);
    probe.fill(0);
    await handle?.close();
  }
}

async function inspectOptionalFileV2(
  filePath: string,
): Promise<ExactFileV2 | null> {
  try {
    return await readExactFileV2(filePath);
  } catch (error) {
    if (isNodeCodeV2(error, "ENOENT")) return null;
    throw error;
  }
}

async function requireAbsentTwiceV2(filePath: string): Promise<void> {
  for (let capture = 0; capture < 2; capture += 1) {
    try {
      await lstat(filePath, { bigint: true });
    } catch (error) {
      if (isNodeCodeV2(error, "ENOENT")) continue;
      throw error;
    }
    throw publicationErrorV2(
      "EPOCH_PUBLICATION_CONFLICT",
      "Epoch stage reappeared before final publication",
    );
  }
}

async function syncDirectoryV2(directoryPath: string): Promise<void> {
  let handle: FileHandle | undefined;
  try {
    handle = await open(
      directoryPath,
      constants.O_RDONLY |
        constants.O_DIRECTORY |
        constants.O_NOFOLLOW |
        constants.O_NONBLOCK,
    );
    await handle.sync();
  } finally {
    await handle?.close();
  }
}

async function syncExactFileV2(
  filePath: string,
  expected: BigIntStats,
): Promise<void> {
  let handle: FileHandle | undefined;
  try {
    handle = await open(
      filePath,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
    const current = await handle.stat({ bigint: true });
    requirePrivateFileV2(current);
    if (!sameIdentityV2(expected, current)) {
      throw publicationErrorV2(
        "EPOCH_PUBLICATION_CONFLICT",
        "Epoch publication member changed before durability completion",
      );
    }
    await handle.sync();
  } finally {
    await handle?.close();
  }
}

function requireStableParentV2(
  expected: BigIntStats,
  observed: BigIntStats,
): void {
  if (
    !expected.isDirectory() ||
    !observed.isDirectory() ||
    expected.dev !== observed.dev ||
    expected.ino !== observed.ino ||
    expected.uid !== observed.uid ||
    expected.gid !== observed.gid ||
    expected.mode !== observed.mode
  ) {
    throw publicationErrorV2(
      "EPOCH_PUBLICATION_PARENT_CHANGED",
      "Epoch publication parent changed",
    );
  }
}

function requireExpectedDirectoryIdentityV2(
  stat: BigIntStats,
  expected: StableFsObjectIdentityV2,
): void {
  if (
    !stat.isDirectory() ||
    stat.dev.toString(10) !== expected.device ||
    stat.ino.toString(10) !== expected.inode
  ) {
    throw publicationErrorV2(
      "EPOCH_PUBLICATION_CONFLICT",
      "Epoch staging directory does not match the claim-bound stable identity",
    );
  }
}

async function openStableParentV2(
  parentPath: string,
  expectedObjectIdentity?: StableFsObjectIdentityV2,
): Promise<StableParentV2> {
  const before = await lstat(parentPath, { bigint: true });
  if (!before.isDirectory()) {
    throw publicationErrorV2(
      "EPOCH_PUBLICATION_INVALID",
      "Epoch publication parent must be one directory",
    );
  }
  if (expectedObjectIdentity !== undefined) {
    requireExpectedDirectoryIdentityV2(before, expectedObjectIdentity);
  }
  const handle = await open(
    parentPath,
    constants.O_RDONLY |
      constants.O_DIRECTORY |
      constants.O_NOFOLLOW |
      constants.O_NONBLOCK,
  );
  try {
    requireStableParentV2(before, await handle.stat({ bigint: true }));
    return Object.freeze({ handle, before });
  } catch (error) {
    await handle.close();
    throw error;
  }
}

async function inspectOptionalStableStageDirectoryV2(
  directoryPath: string,
  expectedObjectIdentity: StableFsObjectIdentityV2,
): Promise<StableParentV2 | null> {
  try {
    const opened = await openStableParentV2(
      directoryPath,
      expectedObjectIdentity,
    );
    if (
      (opened.before.mode & 0o7777n) !== 0o700n ||
      (typeof process.getuid === "function" &&
        opened.before.uid !== BigInt(process.getuid()))
    ) {
      await opened.handle.close();
      throw publicationErrorV2(
        "EPOCH_PUBLICATION_INVALID",
        "Epoch staging directory must be exact and private",
      );
    }
    return opened;
  } catch (error) {
    if (isNodeCodeV2(error, "ENOENT")) return null;
    throw error;
  }
}

async function captureStageMembershipV2(
  directoryPath: string,
): Promise<readonly string[]> {
  const captures: string[][] = [];
  for (let capture = 0; capture < 2; capture += 1) {
    const entries = await readdir(directoryPath, {
      withFileTypes: true,
    });
    if (
      entries.some(
        (entry) =>
          entry.name.includes("/") || entry.name === "." || entry.name === "..",
      )
    ) {
      throw publicationErrorV2(
        "EPOCH_PUBLICATION_INVALID",
        "Epoch staging directory contains an invalid member name",
      );
    }
    captures.push(entries.map((entry) => entry.name).sort());
  }
  if (JSON.stringify(captures[0]) !== JSON.stringify(captures[1])) {
    throw publicationErrorV2(
      "EPOCH_PUBLICATION_CONFLICT",
      "Epoch staging directory membership changed between captures",
    );
  }
  return Object.freeze(captures[1]);
}

async function finalParentFenceV2(
  parentPath: string,
  held: StableParentV2,
): Promise<void> {
  requireStableParentV2(held.before, await held.handle.stat({ bigint: true }));
  requireStableParentV2(held.before, await lstat(parentPath, { bigint: true }));
}

function safeNumberV2(value: bigint, maximum: number, label: string): number {
  if (value < 0n || value > BigInt(maximum)) {
    throw publicationErrorV2(
      "EPOCH_PUBLICATION_INVALID",
      `Epoch ${label} is outside its exact boundary`,
    );
  }
  return Number(value);
}

function resultV2(
  input: PlatformReleaseBootstrapEpochPublicationInputV2,
  final: ExactFileV2,
): PlatformReleaseBootstrapEpochPublicationV2 {
  requireExpectedObjectIdentityV2(
    final.stat,
    input.expectedTargetObjectIdentity,
  );
  const fingerprint = buildFsObservationFingerprintV2({
    objectIdentity: input.expectedTargetObjectIdentity,
    ownerUid: safeNumberV2(
      final.stat.uid,
      PLATFORM_RELEASE_BOOTSTRAP_PHYSICAL_OWNER_ID_MAX_V2,
      "owner UID",
    ),
    ownerGid: safeNumberV2(
      final.stat.gid,
      PLATFORM_RELEASE_BOOTSTRAP_PHYSICAL_OWNER_ID_MAX_V2,
      "owner GID",
    ),
    mode: (final.stat.mode & 0o7777n).toString(8).padStart(4, "0"),
    linkCount: safeNumberV2(
      final.stat.nlink,
      Number.MAX_SAFE_INTEGER,
      "link count",
    ),
    byteLength: safeNumberV2(
      final.stat.size,
      Number.MAX_SAFE_INTEGER,
      "byte length",
    ),
    modifiedTimeNanoseconds: final.stat.mtimeNs.toString(10),
    changedTimeNanoseconds: final.stat.ctimeNs.toString(10),
  });
  return Object.freeze({
    capability: PLATFORM_RELEASE_BOOTSTRAP_COOPERATIVE_CAPTURE_CAPABILITY_V2,
    objectIdentity: input.expectedTargetObjectIdentity,
    fingerprint,
    rawContentHash: final.rawContentHash,
  });
}

function requireKnownTargetV2(
  input: PlatformReleaseBootstrapEpochPublicationInputV2,
  target: ExactFileV2,
): "prior" | "target" {
  if (target.rawContentHash === input.expectedPriorRawContentHash) {
    requireExpectedObjectIdentityV2(
      target.stat,
      input.expectedPriorObjectIdentity,
    );
    return "prior";
  }
  if (target.rawContentHash === input.expectedTargetRawContentHash) {
    requireExpectedObjectIdentityV2(
      target.stat,
      input.expectedTargetObjectIdentity,
    );
    return "target";
  }
  throw publicationErrorV2(
    "EPOCH_PUBLICATION_CONFLICT",
    "Epoch floor is neither the exact prior nor exact target content",
  );
}

function requireExactStageV2(
  input: PlatformReleaseBootstrapEpochPublicationInputV2,
  stage: ExactFileV2,
): void {
  if (stage.rawContentHash !== input.expectedTargetRawContentHash) {
    throw publicationErrorV2(
      "EPOCH_PUBLICATION_CONFLICT",
      "Epoch stage does not contain the exact target content",
    );
  }
  requireExpectedObjectIdentityV2(
    stage.stat,
    input.expectedTargetObjectIdentity,
  );
}

export async function publishCooperativeEpochStateInternalV2(
  input: PlatformReleaseBootstrapEpochPublicationInputV2,
  checkpoint?: PlatformReleaseBootstrapEpochPublicationCheckpointHookV2,
): Promise<PlatformReleaseBootstrapEpochPublicationV2> {
  const validatedInput = validateInputV2(input);
  const stagingDirectoryPath = validatedInput.stagingDirectoryPath;
  const namespaceParentPath = validatedInput.namespaceParentPath;
  const stagePath = path.join(
    stagingDirectoryPath,
    PLATFORM_RELEASE_BOOTSTRAP_EPOCH_TARGET_STAGE_BASENAME_V2,
  );
  const targetPath = path.join(
    namespaceParentPath,
    PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.registry.epochFloorBasename,
  );
  const context = Object.freeze({
    stagingDirectoryPath,
    namespaceParentPath,
    stagePath,
    targetPath,
  });
  const targetParent = await openStableParentV2(namespaceParentPath);
  try {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const stageDirectory = await inspectOptionalStableStageDirectoryV2(
        stagingDirectoryPath,
        validatedInput.expectedStagingDirectoryObjectIdentity,
      );
      try {
        const target = await inspectOptionalFileV2(targetPath);
        if (target === null) {
          throw publicationErrorV2(
            "EPOCH_PUBLICATION_CONFLICT",
            "Epoch floor target is absent",
          );
        }
        const targetDisposition = requireKnownTargetV2(validatedInput, target);
        if (stageDirectory === null) {
          if (targetDisposition !== "target") {
            throw publicationErrorV2(
              "EPOCH_PUBLICATION_CONFLICT",
              "Epoch prior floor has no exact staging directory",
            );
          }
          await syncExactFileV2(targetPath, target.stat);
          await checkpoint?.(
            PlatformReleaseBootstrapEpochPublicationCheckpointV2.afterTargetFileSync,
            context,
          );
          await syncDirectoryV2(namespaceParentPath);
          await checkpoint?.(
            PlatformReleaseBootstrapEpochPublicationCheckpointV2.afterTargetDirectorySync,
            context,
          );
          await syncDirectoryV2(namespaceParentPath);
          await checkpoint?.(
            PlatformReleaseBootstrapEpochPublicationCheckpointV2.afterFinalParentSync,
            context,
          );
          await finalParentFenceV2(namespaceParentPath, targetParent);
          const reproduced = await readExactFileV2(targetPath);
          if (
            reproduced.rawContentHash !==
              validatedInput.expectedTargetRawContentHash ||
            !sameIdentityV2(target.stat, reproduced.stat)
          ) {
            throw publicationErrorV2(
              "EPOCH_PUBLICATION_CONFLICT",
              "Epoch target changed during final reproduction",
            );
          }
          requireExpectedObjectIdentityV2(
            reproduced.stat,
            validatedInput.expectedTargetObjectIdentity,
          );
          await requireAbsentTwiceV2(stagingDirectoryPath);
          return resultV2(validatedInput, reproduced);
        }
        if (stageDirectory.before.dev !== targetParent.before.dev) {
          throw publicationErrorV2(
            "EPOCH_PUBLICATION_CONFLICT",
            "Epoch atomic replacement requires one filesystem",
          );
        }
        const membership = await captureStageMembershipV2(stagingDirectoryPath);
        await finalParentFenceV2(stagingDirectoryPath, stageDirectory);
        if (membership.length === 0) {
          if (targetDisposition !== "target") {
            throw publicationErrorV2(
              "EPOCH_PUBLICATION_CONFLICT",
              "Epoch prior floor cannot have consumed staging",
            );
          }
          await syncExactFileV2(targetPath, target.stat);
          await checkpoint?.(
            PlatformReleaseBootstrapEpochPublicationCheckpointV2.afterTargetFileSync,
            context,
          );
          await syncDirectoryV2(namespaceParentPath);
          await checkpoint?.(
            PlatformReleaseBootstrapEpochPublicationCheckpointV2.afterTargetDirectorySync,
            context,
          );
          await stageDirectory.handle.sync();
          await checkpoint?.(
            PlatformReleaseBootstrapEpochPublicationCheckpointV2.afterConsumedStageDirectorySync,
            context,
          );
          await finalParentFenceV2(stagingDirectoryPath, stageDirectory);
          await finalParentFenceV2(namespaceParentPath, targetParent);
          const currentMembership =
            await captureStageMembershipV2(stagingDirectoryPath);
          if (currentMembership.length !== 0) {
            throw publicationErrorV2(
              "EPOCH_PUBLICATION_CONFLICT",
              "Epoch consumed staging directory is no longer empty",
            );
          }
          const reproduced = await readExactFileV2(targetPath);
          if (
            reproduced.rawContentHash !==
              validatedInput.expectedTargetRawContentHash ||
            !sameIdentityV2(target.stat, reproduced.stat)
          ) {
            throw publicationErrorV2(
              "EPOCH_PUBLICATION_CONFLICT",
              "Epoch consumed target changed before staging cleanup",
            );
          }
          requireExpectedObjectIdentityV2(
            reproduced.stat,
            validatedInput.expectedTargetObjectIdentity,
          );
          await stageDirectory.handle.close();
          await rmdir(stagingDirectoryPath);
          await checkpoint?.(
            PlatformReleaseBootstrapEpochPublicationCheckpointV2.afterStageDirectoryRemove,
            context,
          );
          await syncDirectoryV2(namespaceParentPath);
          await checkpoint?.(
            PlatformReleaseBootstrapEpochPublicationCheckpointV2.afterFinalParentSync,
            context,
          );
          await finalParentFenceV2(namespaceParentPath, targetParent);
          const final = await readExactFileV2(targetPath);
          if (
            final.rawContentHash !==
              validatedInput.expectedTargetRawContentHash ||
            !sameIdentityV2(reproduced.stat, final.stat)
          ) {
            throw publicationErrorV2(
              "EPOCH_PUBLICATION_CONFLICT",
              "Epoch target changed after staging cleanup",
            );
          }
          await requireAbsentTwiceV2(stagingDirectoryPath);
          return resultV2(validatedInput, final);
        }
        if (
          membership.length !== 1 ||
          membership[0] !==
            PLATFORM_RELEASE_BOOTSTRAP_EPOCH_TARGET_STAGE_BASENAME_V2
        ) {
          throw publicationErrorV2(
            "EPOCH_PUBLICATION_CONFLICT",
            "Epoch staging directory is neither exact nor consumed",
          );
        }
        const stage = await readExactFileV2(stagePath);
        requireExactStageV2(validatedInput, stage);
        if (targetDisposition === "target") {
          throw publicationErrorV2(
            "EPOCH_PUBLICATION_CONFLICT",
            "Epoch target plus exact stage is not a rename state",
          );
        }
        if (stage.stat.dev !== target.stat.dev) {
          throw publicationErrorV2(
            "EPOCH_PUBLICATION_CONFLICT",
            "Epoch stage and prior floor must share one filesystem",
          );
        }
        await syncExactFileV2(stagePath, stage.stat);
        await checkpoint?.(
          PlatformReleaseBootstrapEpochPublicationCheckpointV2.afterStageFileSync,
          context,
        );
        await stageDirectory.handle.sync();
        await checkpoint?.(
          PlatformReleaseBootstrapEpochPublicationCheckpointV2.afterStageDirectorySync,
          context,
        );
        const stageBeforeRename = await inspectOptionalFileV2(stagePath);
        const targetBeforeRename = await inspectOptionalFileV2(targetPath);
        const membershipBeforeRename =
          await captureStageMembershipV2(stagingDirectoryPath);
        if (
          stageBeforeRename === null ||
          targetBeforeRename === null ||
          membershipBeforeRename.length !== 1 ||
          membershipBeforeRename[0] !==
            PLATFORM_RELEASE_BOOTSTRAP_EPOCH_TARGET_STAGE_BASENAME_V2
        ) {
          continue;
        }
        requireExactStageV2(validatedInput, stageBeforeRename);
        if (
          requireKnownTargetV2(validatedInput, targetBeforeRename) !==
            "prior" ||
          !sameIdentityV2(stage.stat, stageBeforeRename.stat) ||
          !sameIdentityV2(target.stat, targetBeforeRename.stat)
        ) {
          continue;
        }
        await finalParentFenceV2(stagingDirectoryPath, stageDirectory);
        await finalParentFenceV2(namespaceParentPath, targetParent);
        await rename(stagePath, targetPath);
        await checkpoint?.(
          PlatformReleaseBootstrapEpochPublicationCheckpointV2.afterAtomicReplace,
          context,
        );
      } catch (error) {
        if (isNodeCodeV2(error, "ENOENT")) {
          continue;
        }
        throw error;
      } finally {
        if (stageDirectory !== null && stageDirectory.handle.fd >= 0) {
          await stageDirectory.handle.close();
        }
      }
    }
    throw publicationErrorV2(
      "EPOCH_PUBLICATION_CONFLICT",
      "Epoch publication did not converge",
    );
  } catch (error) {
    if (
      error instanceof PlatformReleaseBootstrapEpochPublicationErrorV2 ||
      (error instanceof Error && error.message.startsWith("injected:"))
    ) {
      throw error;
    }
    throw publicationErrorV2(
      "EPOCH_PUBLICATION_UNAVAILABLE",
      "Epoch publication could not complete",
      error,
    );
  } finally {
    await targetParent.handle.close();
  }
}
