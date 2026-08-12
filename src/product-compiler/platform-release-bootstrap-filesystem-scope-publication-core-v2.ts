import { createHash, randomBytes } from "node:crypto";
import { constants, type BigIntStats } from "node:fs";
import { link, lstat, open, unlink, type FileHandle } from "node:fs/promises";
import path from "node:path";

import { PLATFORM_RELEASE_BOOTSTRAP_FILESYSTEM_SCOPE_DOCUMENT_BASENAME_V2 } from "../execution/schemas/platform-release-bootstrap-contract-v2.js";
import { canonicalJsonStringify } from "./canonical-json.js";
import { PLATFORM_RELEASE_BOOTSTRAP_COOPERATIVE_CAPTURE_CAPABILITY_V2 } from "./platform-release-bootstrap-filesystem-capture-core-v2.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_PHYSICAL_OWNER_ID_MAX_V2,
  buildBootstrapFilesystemScopeIdentityV2,
  buildFsObservationFingerprintV2,
  buildStableFsObjectIdentityV2,
  parseBootstrapFilesystemScopeIdentityCandidateV2,
  type BootstrapFilesystemScopeIdentityV2,
  type FsObservationFingerprintV2,
  type StableFsObjectIdentityV2,
} from "./platform-release-bootstrap-physical-census-v2.js";

export { PLATFORM_RELEASE_BOOTSTRAP_FILESYSTEM_SCOPE_DOCUMENT_BASENAME_V2 };
export const PLATFORM_RELEASE_BOOTSTRAP_FILESYSTEM_SCOPE_STAGE_BASENAME_V2 =
  ".setfarm-bootstrap-filesystem-scope-v2.stage" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_FILESYSTEM_SCOPE_DOCUMENT_MAX_BYTES_V2 =
  64 * 1024;

export type PlatformReleaseBootstrapScopePublicationErrorCodeV2 =
  | "SCOPE_PUBLICATION_CONFLICT"
  | "SCOPE_PUBLICATION_INVALID"
  | "SCOPE_PUBLICATION_PARENT_CHANGED"
  | "SCOPE_PUBLICATION_UNAVAILABLE";

export class PlatformReleaseBootstrapScopePublicationErrorV2 extends Error {
  constructor(
    readonly code: PlatformReleaseBootstrapScopePublicationErrorCodeV2,
    message: string,
    options: ErrorOptions = {},
  ) {
    super(message, options);
    this.name = "PlatformReleaseBootstrapScopePublicationErrorV2";
  }
}

export type PlatformReleaseBootstrapScopePublicationV2 = Readonly<{
  capability: typeof PLATFORM_RELEASE_BOOTSTRAP_COOPERATIVE_CAPTURE_CAPABILITY_V2;
  filesystemScope: BootstrapFilesystemScopeIdentityV2;
  objectIdentity: StableFsObjectIdentityV2;
  fingerprint: FsObservationFingerprintV2;
  rawContentHash: string;
}>;

export const PlatformReleaseBootstrapScopePublicationCheckpointV2 = {
  afterStageWrite: "after_scope_stage_write",
  afterStageFileSync: "after_scope_stage_file_sync",
  afterStageDirectorySync: "after_scope_stage_directory_sync",
  afterTargetLink: "after_scope_target_link",
  afterTargetDirectorySync: "after_scope_target_directory_sync",
  afterStageUnlink: "after_scope_stage_unlink",
  afterFinalDirectorySync: "after_scope_final_directory_sync",
} as const;

export type PlatformReleaseBootstrapScopePublicationCheckpointV2 =
  (typeof PlatformReleaseBootstrapScopePublicationCheckpointV2)[keyof typeof PlatformReleaseBootstrapScopePublicationCheckpointV2];

export type PlatformReleaseBootstrapScopePublicationCheckpointHookV2 = (
  checkpoint: PlatformReleaseBootstrapScopePublicationCheckpointV2,
  context: Readonly<{
    parentPath: string;
    stagePath: string;
    targetPath: string;
  }>,
) => void | Promise<void>;

type ScopePublicationInternalInputV2 = Readonly<{
  parentPath: string;
  nonceBytes?: () => Buffer;
  checkpoint?: PlatformReleaseBootstrapScopePublicationCheckpointHookV2;
}>;

type ExactFileV2 = Readonly<{
  stat: BigIntStats;
  filesystemScope: BootstrapFilesystemScopeIdentityV2;
  canonicalText: string;
  rawContentHash: string;
}>;

function publicationErrorV2(
  code: PlatformReleaseBootstrapScopePublicationErrorCodeV2,
  message: string,
  cause?: unknown,
): PlatformReleaseBootstrapScopePublicationErrorV2 {
  return new PlatformReleaseBootstrapScopePublicationErrorV2(
    code,
    message,
    cause === undefined ? {} : { cause },
  );
}

function isNodeCodeV2(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && error.code === code;
}

function exactParentPathV2(parentPath: string): string {
  if (
    typeof parentPath !== "string" ||
    !path.isAbsolute(parentPath) ||
    path.normalize(parentPath) !== parentPath
  ) {
    throw publicationErrorV2(
      "SCOPE_PUBLICATION_INVALID",
      "Filesystem scope publication parent must be one normalized absolute path",
    );
  }
  return parentPath;
}

function sameIdentityV2(left: BigIntStats, right: BigIntStats): boolean {
  return (
    left.isDirectory() === right.isDirectory() &&
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

function sameLocatorV2(left: BigIntStats, right: BigIntStats): boolean {
  return left.dev === right.dev && left.ino === right.ino;
}

function requireParentV2(expected: BigIntStats, observed: BigIntStats): void {
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
      "SCOPE_PUBLICATION_PARENT_CHANGED",
      "Filesystem scope publication parent changed",
    );
  }
}

function requirePrivateFileV2(
  stat: BigIntStats,
  allowedLinks: readonly bigint[],
): void {
  if (
    !stat.isFile() ||
    (stat.mode & 0o7777n) !== 0o600n ||
    !allowedLinks.includes(stat.nlink) ||
    stat.size < 1n ||
    stat.size >
      BigInt(
        PLATFORM_RELEASE_BOOTSTRAP_FILESYSTEM_SCOPE_DOCUMENT_MAX_BYTES_V2,
      ) ||
    (typeof process.getuid === "function" &&
      stat.uid !== BigInt(process.getuid()))
  ) {
    throw publicationErrorV2(
      "SCOPE_PUBLICATION_INVALID",
      "Filesystem scope document must be one exact private ordinary file",
    );
  }
}

function safeNumberV2(value: bigint, maximum: number, label: string): number {
  if (value < 0n || value > BigInt(maximum)) {
    throw publicationErrorV2(
      "SCOPE_PUBLICATION_INVALID",
      `Filesystem scope ${label} is outside its exact numeric boundary`,
    );
  }
  return Number(value);
}

function canonicalModeV2(value: bigint): string {
  return (value & 0o7777n).toString(8).padStart(4, "0");
}

function physicalEvidenceV2(
  filesystemScope: BootstrapFilesystemScopeIdentityV2,
  stat: BigIntStats,
): Readonly<{
  objectIdentity: StableFsObjectIdentityV2;
  fingerprint: FsObservationFingerprintV2;
}> {
  const objectIdentity = buildStableFsObjectIdentityV2({
    filesystemScope,
    objectKind: "ordinary_file",
    device: stat.dev.toString(10),
    inode: stat.ino.toString(10),
  });
  const fingerprint = buildFsObservationFingerprintV2({
    objectIdentity,
    ownerUid: safeNumberV2(
      stat.uid,
      PLATFORM_RELEASE_BOOTSTRAP_PHYSICAL_OWNER_ID_MAX_V2,
      "owner UID",
    ),
    ownerGid: safeNumberV2(
      stat.gid,
      PLATFORM_RELEASE_BOOTSTRAP_PHYSICAL_OWNER_ID_MAX_V2,
      "owner GID",
    ),
    mode: canonicalModeV2(stat.mode),
    linkCount: safeNumberV2(stat.nlink, Number.MAX_SAFE_INTEGER, "link count"),
    byteLength: safeNumberV2(stat.size, Number.MAX_SAFE_INTEGER, "byte length"),
    modifiedTimeNanoseconds: stat.mtimeNs.toString(10),
    changedTimeNanoseconds: stat.ctimeNs.toString(10),
  });
  return Object.freeze({ objectIdentity, fingerprint });
}

async function readExactScopeFileV2(
  filePath: string,
  allowedLinks: readonly bigint[],
): Promise<ExactFileV2> {
  const pathBefore = await lstat(filePath, {
    bigint: true,
  });
  requirePrivateFileV2(pathBefore, allowedLinks);
  let handle: FileHandle | undefined;
  const bytes = Buffer.allocUnsafe(Number(pathBefore.size));
  const probe = Buffer.allocUnsafe(1);
  try {
    handle = await open(
      filePath,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
    const descriptorBefore = await handle.stat({
      bigint: true,
    });
    if (!sameIdentityV2(pathBefore, descriptorBefore)) {
      throw publicationErrorV2(
        "SCOPE_PUBLICATION_INVALID",
        "Filesystem scope document changed before descriptor admission",
      );
    }
    let offset = 0;
    while (offset < bytes.length) {
      const result = await handle.read(
        bytes,
        offset,
        bytes.length - offset,
        offset,
      );
      if (result.bytesRead === 0) {
        throw publicationErrorV2(
          "SCOPE_PUBLICATION_INVALID",
          "Filesystem scope document reached early EOF",
        );
      }
      offset += result.bytesRead;
    }
    const eof = await handle.read(probe, 0, 1, bytes.length);
    if (eof.bytesRead !== 0) {
      throw publicationErrorV2(
        "SCOPE_PUBLICATION_INVALID",
        "Filesystem scope document exceeded its exact byte length",
      );
    }
    const descriptorAfter = await handle.stat({
      bigint: true,
    });
    const pathAfter = await lstat(filePath, {
      bigint: true,
    });
    if (
      !sameIdentityV2(pathBefore, descriptorAfter) ||
      !sameIdentityV2(pathBefore, pathAfter)
    ) {
      throw publicationErrorV2(
        "SCOPE_PUBLICATION_INVALID",
        "Filesystem scope document changed during exact read",
      );
    }
    const canonicalText = bytes.toString("utf8");
    let filesystemScope: BootstrapFilesystemScopeIdentityV2;
    try {
      filesystemScope = parseBootstrapFilesystemScopeIdentityCandidateV2(
        JSON.parse(canonicalText),
      );
    } catch (error) {
      throw publicationErrorV2(
        "SCOPE_PUBLICATION_INVALID",
        "Filesystem scope document is not one strict identity",
        error,
      );
    }
    if (canonicalText !== canonicalJsonStringify(filesystemScope)) {
      throw publicationErrorV2(
        "SCOPE_PUBLICATION_INVALID",
        "Filesystem scope document bytes are not exact canonical UTF-8",
      );
    }
    return Object.freeze({
      stat: pathAfter,
      filesystemScope,
      canonicalText,
      rawContentHash: createHash("sha256").update(bytes).digest("hex"),
    });
  } finally {
    bytes.fill(0);
    probe.fill(0);
    await handle?.close();
  }
}

async function inspectOptionalScopeFileV2(
  filePath: string,
  allowedLinks: readonly bigint[],
): Promise<ExactFileV2 | null> {
  try {
    return await readExactScopeFileV2(filePath, allowedLinks);
  } catch (error) {
    if (isNodeCodeV2(error, "ENOENT")) return null;
    throw error;
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
  allowedLinks: readonly bigint[],
): Promise<void> {
  let handle: FileHandle | undefined;
  try {
    handle = await open(
      filePath,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
    const current = await handle.stat({ bigint: true });
    requirePrivateFileV2(current, allowedLinks);
    if (!sameIdentityV2(expected, current)) {
      throw publicationErrorV2(
        "SCOPE_PUBLICATION_CONFLICT",
        "Filesystem scope file changed before durability completion",
      );
    }
    await handle.sync();
  } finally {
    await handle?.close();
  }
}

async function writeExactStageV2(
  stagePath: string,
  canonicalText: string,
  checkpoint:
    PlatformReleaseBootstrapScopePublicationCheckpointHookV2 | undefined,
  checkpointContext: Readonly<{
    parentPath: string;
    stagePath: string;
    targetPath: string;
  }>,
): Promise<void> {
  const bytes = Buffer.from(canonicalText, "utf8");
  let handle: FileHandle | undefined;
  try {
    handle = await open(
      stagePath,
      constants.O_WRONLY |
        constants.O_CREAT |
        constants.O_EXCL |
        constants.O_NOFOLLOW,
      0o600,
    );
    await handle.chmod(0o600);
    let offset = 0;
    while (offset < bytes.length) {
      const result = await handle.write(
        bytes,
        offset,
        bytes.length - offset,
        offset,
      );
      if (result.bytesWritten === 0) {
        throw publicationErrorV2(
          "SCOPE_PUBLICATION_UNAVAILABLE",
          "Filesystem scope stage write made no progress",
        );
      }
      offset += result.bytesWritten;
    }
    const created = await handle.stat({ bigint: true });
    requirePrivateFileV2(created, [1n]);
    await checkpoint?.(
      PlatformReleaseBootstrapScopePublicationCheckpointV2.afterStageWrite,
      checkpointContext,
    );
    await handle.sync();
    await checkpoint?.(
      PlatformReleaseBootstrapScopePublicationCheckpointV2.afterStageFileSync,
      checkpointContext,
    );
  } finally {
    bytes.fill(0);
    await handle?.close();
  }
}

function resultFromExactFileV2(
  exact: ExactFileV2,
): PlatformReleaseBootstrapScopePublicationV2 {
  const { objectIdentity, fingerprint } = physicalEvidenceV2(
    exact.filesystemScope,
    exact.stat,
  );
  return Object.freeze({
    capability: PLATFORM_RELEASE_BOOTSTRAP_COOPERATIVE_CAPTURE_CAPABILITY_V2,
    filesystemScope: exact.filesystemScope,
    objectIdentity,
    fingerprint,
    rawContentHash: exact.rawContentHash,
  });
}

async function removeExactStageV2(
  stagePath: string,
  expected: BigIntStats,
): Promise<void> {
  const current = await lstat(stagePath, { bigint: true });
  requirePrivateFileV2(current, [1n, 2n]);
  if (!sameIdentityV2(expected, current)) {
    throw publicationErrorV2(
      "SCOPE_PUBLICATION_CONFLICT",
      "Filesystem scope stage changed before exact cleanup",
    );
  }
  await unlink(stagePath);
}

async function finalParentFenceV2(
  parentPath: string,
  parentHandle: FileHandle,
  parentBefore: BigIntStats,
): Promise<void> {
  const descriptorAfter = await parentHandle.stat({
    bigint: true,
  });
  const pathAfter = await lstat(parentPath, {
    bigint: true,
  });
  requireParentV2(parentBefore, descriptorAfter);
  requireParentV2(parentBefore, pathAfter);
}

export async function ensureCooperativeBootstrapFilesystemScopeInternalV2(
  input: ScopePublicationInternalInputV2,
): Promise<PlatformReleaseBootstrapScopePublicationV2> {
  const parentPath = exactParentPathV2(input.parentPath);
  const stagePath = path.join(
    parentPath,
    PLATFORM_RELEASE_BOOTSTRAP_FILESYSTEM_SCOPE_STAGE_BASENAME_V2,
  );
  const targetPath = path.join(
    parentPath,
    PLATFORM_RELEASE_BOOTSTRAP_FILESYSTEM_SCOPE_DOCUMENT_BASENAME_V2,
  );
  const checkpointContext = Object.freeze({
    parentPath,
    stagePath,
    targetPath,
  });
  const parentPathBefore = await lstat(parentPath, {
    bigint: true,
  });
  if (!parentPathBefore.isDirectory()) {
    throw publicationErrorV2(
      "SCOPE_PUBLICATION_INVALID",
      "Filesystem scope publication parent is not one directory",
    );
  }
  let parentHandle: FileHandle | undefined;
  let invocationOwnedStage: ExactFileV2 | null = null;
  let invocationStageIsDurable = false;
  try {
    parentHandle = await open(
      parentPath,
      constants.O_RDONLY |
        constants.O_DIRECTORY |
        constants.O_NOFOLLOW |
        constants.O_NONBLOCK,
    );
    requireParentV2(
      parentPathBefore,
      await parentHandle.stat({ bigint: true }),
    );

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const target = await inspectOptionalScopeFileV2(targetPath, [1n, 2n]);
      const stage = await inspectOptionalScopeFileV2(stagePath, [1n, 2n]);
      if (target !== null) {
        if (stage === null) {
          if (target.stat.nlink !== 1n) {
            throw publicationErrorV2(
              "SCOPE_PUBLICATION_CONFLICT",
              "Filesystem scope final document has a hidden link",
            );
          }
          await finalParentFenceV2(parentPath, parentHandle, parentPathBefore);
          await syncExactFileV2(targetPath, target.stat, [1n]);
          await syncDirectoryV2(parentPath);
          await input.checkpoint?.(
            PlatformReleaseBootstrapScopePublicationCheckpointV2.afterFinalDirectorySync,
            checkpointContext,
          );
          const reproducedTarget = await readExactScopeFileV2(targetPath, [1n]);
          if (
            !sameIdentityV2(target.stat, reproducedTarget.stat) ||
            target.canonicalText !== reproducedTarget.canonicalText
          ) {
            throw publicationErrorV2(
              "SCOPE_PUBLICATION_CONFLICT",
              "Filesystem scope final document changed during reproduction",
            );
          }
          await finalParentFenceV2(parentPath, parentHandle, parentPathBefore);
          return resultFromExactFileV2(reproducedTarget);
        }
        if (sameLocatorV2(target.stat, stage.stat)) {
          if (
            target.stat.nlink !== 2n ||
            stage.stat.nlink !== 2n ||
            target.canonicalText !== stage.canonicalText
          ) {
            throw publicationErrorV2(
              "SCOPE_PUBLICATION_CONFLICT",
              "Filesystem scope overlap is not one exact two-link object",
            );
          }
          await syncDirectoryV2(parentPath);
          await input.checkpoint?.(
            PlatformReleaseBootstrapScopePublicationCheckpointV2.afterTargetDirectorySync,
            checkpointContext,
          );
          await removeExactStageV2(stagePath, stage.stat);
          await input.checkpoint?.(
            PlatformReleaseBootstrapScopePublicationCheckpointV2.afterStageUnlink,
            checkpointContext,
          );
          await syncDirectoryV2(parentPath);
          await input.checkpoint?.(
            PlatformReleaseBootstrapScopePublicationCheckpointV2.afterFinalDirectorySync,
            checkpointContext,
          );
          await finalParentFenceV2(parentPath, parentHandle, parentPathBefore);
          const final = await readExactScopeFileV2(targetPath, [1n]);
          if (
            !sameLocatorV2(target.stat, final.stat) ||
            target.canonicalText !== final.canonicalText ||
            target.rawContentHash !== final.rawContentHash
          ) {
            throw publicationErrorV2(
              "SCOPE_PUBLICATION_CONFLICT",
              "Filesystem scope final document did not preserve the admitted staged object",
            );
          }
          await finalParentFenceV2(parentPath, parentHandle, parentPathBefore);
          return resultFromExactFileV2(final);
        }
        if (target.stat.nlink !== 1n || stage.stat.nlink !== 1n) {
          throw publicationErrorV2(
            "SCOPE_PUBLICATION_CONFLICT",
            "Filesystem scope competitor state contains a hidden link",
          );
        }
        if (
          invocationOwnedStage === null ||
          !sameIdentityV2(invocationOwnedStage.stat, stage.stat) ||
          invocationOwnedStage.canonicalText !== stage.canonicalText
        ) {
          throw publicationErrorV2(
            "SCOPE_PUBLICATION_CONFLICT",
            "Filesystem scope contains an ambiguous pre-existing stage and target",
          );
        }
        await syncExactFileV2(targetPath, target.stat, [1n]);
        await syncDirectoryV2(parentPath);
        await input.checkpoint?.(
          PlatformReleaseBootstrapScopePublicationCheckpointV2.afterTargetDirectorySync,
          checkpointContext,
        );
        await removeExactStageV2(stagePath, stage.stat);
        await input.checkpoint?.(
          PlatformReleaseBootstrapScopePublicationCheckpointV2.afterStageUnlink,
          checkpointContext,
        );
        await syncDirectoryV2(parentPath);
        await input.checkpoint?.(
          PlatformReleaseBootstrapScopePublicationCheckpointV2.afterFinalDirectorySync,
          checkpointContext,
        );
        await finalParentFenceV2(parentPath, parentHandle, parentPathBefore);
        const reproducedWinner = await readExactScopeFileV2(targetPath, [1n]);
        if (
          !sameIdentityV2(target.stat, reproducedWinner.stat) ||
          target.canonicalText !== reproducedWinner.canonicalText
        ) {
          throw publicationErrorV2(
            "SCOPE_PUBLICATION_CONFLICT",
            "Filesystem scope competitor winner changed during reproduction",
          );
        }
        return resultFromExactFileV2(reproducedWinner);
      }

      let exactStage = stage;
      if (exactStage === null) {
        const nonce = (input.nonceBytes ?? randomBytes)(32);
        try {
          if (!Buffer.isBuffer(nonce) || nonce.length !== 32) {
            throw publicationErrorV2(
              "SCOPE_PUBLICATION_INVALID",
              "Filesystem scope nonce source must return exactly 32 bytes",
            );
          }
          const filesystemScope = buildBootstrapFilesystemScopeIdentityV2({
            scopeNonce: nonce.toString("hex"),
          });
          try {
            await writeExactStageV2(
              stagePath,
              canonicalJsonStringify(filesystemScope),
              input.checkpoint,
              checkpointContext,
            );
          } catch (error) {
            if (isNodeCodeV2(error, "EEXIST")) continue;
            throw error;
          }
        } finally {
          nonce.fill(0);
        }
        await syncDirectoryV2(parentPath);
        await input.checkpoint?.(
          PlatformReleaseBootstrapScopePublicationCheckpointV2.afterStageDirectorySync,
          checkpointContext,
        );
        exactStage = await readExactScopeFileV2(stagePath, [1n]);
        invocationOwnedStage = exactStage;
        invocationStageIsDurable = true;
      }
      if (exactStage.stat.nlink !== 1n) {
        throw publicationErrorV2(
          "SCOPE_PUBLICATION_CONFLICT",
          "Filesystem scope stage has an invalid link topology",
        );
      }
      if (!invocationStageIsDurable) {
        await syncExactFileV2(stagePath, exactStage.stat, [1n]);
        await input.checkpoint?.(
          PlatformReleaseBootstrapScopePublicationCheckpointV2.afterStageFileSync,
          checkpointContext,
        );
        await syncDirectoryV2(parentPath);
        await input.checkpoint?.(
          PlatformReleaseBootstrapScopePublicationCheckpointV2.afterStageDirectorySync,
          checkpointContext,
        );
        invocationStageIsDurable = true;
      }
      invocationOwnedStage ??= exactStage;
      const stageBeforeLink = await lstat(stagePath, {
        bigint: true,
      });
      if (!sameIdentityV2(exactStage.stat, stageBeforeLink)) {
        throw publicationErrorV2(
          "SCOPE_PUBLICATION_CONFLICT",
          "Filesystem scope stage changed before no-replace publication",
        );
      }
      try {
        await link(stagePath, targetPath);
      } catch (error) {
        if (isNodeCodeV2(error, "EEXIST")) continue;
        throw publicationErrorV2(
          "SCOPE_PUBLICATION_UNAVAILABLE",
          "Filesystem scope target could not be linked",
          error,
        );
      }
      await input.checkpoint?.(
        PlatformReleaseBootstrapScopePublicationCheckpointV2.afterTargetLink,
        checkpointContext,
      );
    }
    throw publicationErrorV2(
      "SCOPE_PUBLICATION_CONFLICT",
      "Filesystem scope publication did not converge",
    );
  } catch (error) {
    if (
      error instanceof PlatformReleaseBootstrapScopePublicationErrorV2 ||
      (error instanceof Error && error.message.startsWith("injected:"))
    ) {
      throw error;
    }
    throw publicationErrorV2(
      "SCOPE_PUBLICATION_UNAVAILABLE",
      "Filesystem scope publication could not complete",
      error,
    );
  } finally {
    await parentHandle?.close();
  }
}
