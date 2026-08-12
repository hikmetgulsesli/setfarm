import { createHash } from "node:crypto";
import {
  constants,
  type BigIntStats,
} from "node:fs";
import {
  link,
  lstat,
  open,
  unlink,
  type FileHandle,
} from "node:fs/promises";
import path from "node:path";

import {
  PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2,
  PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_DOCUMENT_PROTOCOL_CATALOG_V2,
} from
  "../execution/schemas/platform-release-bootstrap-contract-v2.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_COOPERATIVE_CAPTURE_CAPABILITY_V2,
} from
  "./platform-release-bootstrap-filesystem-capture-core-v2.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_PHYSICAL_OWNER_ID_MAX_V2,
  buildFsObservationFingerprintV2,
  buildStableFsObjectIdentityV2,
  parseBootstrapFilesystemScopeIdentityCandidateV2,
  parseStableFsObjectIdentityCandidateV2,
  type BootstrapFilesystemScopeIdentityV2,
  type FsObservationFingerprintV2,
  type StableFsObjectIdentityV2,
} from "./platform-release-bootstrap-physical-census-v2.js";

export const PlatformReleaseBootstrapActivationPublicationMemberKindV2 = {
  receipt: "staged_activation_receipt",
  genesis: "staged_genesis_epoch_state",
  sharedLock: "staged_shared_lock",
} as const;

export type PlatformReleaseBootstrapActivationPublicationMemberKindV2 =
  typeof PlatformReleaseBootstrapActivationPublicationMemberKindV2[
    keyof typeof PlatformReleaseBootstrapActivationPublicationMemberKindV2
  ];

export const PlatformReleaseBootstrapActivationPublicationCheckpointV2 = {
  afterStageFileSync: "after_activation_stage_file_sync",
  afterStageDirectorySync:
    "after_activation_stage_directory_sync",
  afterTargetLink: "after_activation_target_link",
  afterTargetDirectorySync:
    "after_activation_target_directory_sync",
  afterStageUnlink: "after_activation_stage_unlink",
  afterFinalStageDirectorySync:
    "after_activation_final_stage_directory_sync",
} as const;

export type PlatformReleaseBootstrapActivationPublicationCheckpointV2 =
  typeof PlatformReleaseBootstrapActivationPublicationCheckpointV2[
    keyof typeof PlatformReleaseBootstrapActivationPublicationCheckpointV2
  ];

export type PlatformReleaseBootstrapActivationPublicationCheckpointHookV2 =
  (
    checkpoint:
      PlatformReleaseBootstrapActivationPublicationCheckpointV2,
    context: Readonly<{
      stagingDirectoryPath: string;
      namespaceParentPath: string;
      stagePath: string;
      targetPath: string;
    }>,
  ) => void | Promise<void>;

export type PlatformReleaseBootstrapActivationPublicationInputV2 =
  Readonly<{
    filesystemScope: BootstrapFilesystemScopeIdentityV2;
    stagingDirectoryPath: string;
    namespaceParentPath: string;
    memberKind:
      PlatformReleaseBootstrapActivationPublicationMemberKindV2;
    expectedRawContentHash: string;
    expectedObjectIdentity: StableFsObjectIdentityV2;
  }>;

export type PlatformReleaseBootstrapActivationPublicationV2 =
  Readonly<{
    capability:
      typeof PLATFORM_RELEASE_BOOTSTRAP_COOPERATIVE_CAPTURE_CAPABILITY_V2;
    memberKind:
      PlatformReleaseBootstrapActivationPublicationMemberKindV2;
    objectIdentity: StableFsObjectIdentityV2;
    fingerprint: FsObservationFingerprintV2;
    rawContentHash: string;
  }>;

export type PlatformReleaseBootstrapActivationPublicationErrorCodeV2 =
  | "ACTIVATION_PUBLICATION_CONFLICT"
  | "ACTIVATION_PUBLICATION_INVALID"
  | "ACTIVATION_PUBLICATION_PARENT_CHANGED"
  | "ACTIVATION_PUBLICATION_UNAVAILABLE";

export class PlatformReleaseBootstrapActivationPublicationErrorV2
  extends Error {
  constructor(
    readonly code:
      PlatformReleaseBootstrapActivationPublicationErrorCodeV2,
    message: string,
    options: ErrorOptions = {},
  ) {
    super(message, options);
    this.name =
      "PlatformReleaseBootstrapActivationPublicationErrorV2";
  }
}

type ExactFileV2 = Readonly<{
  stat: BigIntStats;
  rawContentHash: string;
}>;

const MAX_FILE_BYTES_V2 = Math.max(
  ...PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_DOCUMENT_PROTOCOL_CATALOG_V2
    .documents.map((document) => document.maxCanonicalBytes),
);

function publicationErrorV2(
  code: PlatformReleaseBootstrapActivationPublicationErrorCodeV2,
  message: string,
  cause?: unknown,
): PlatformReleaseBootstrapActivationPublicationErrorV2 {
  return new PlatformReleaseBootstrapActivationPublicationErrorV2(
    code,
    message,
    cause === undefined ? {} : { cause },
  );
}

function isNodeCodeV2(error: unknown, code: string): boolean {
  return error instanceof Error
    && "code" in error
    && error.code === code;
}

function exactAbsolutePathV2(value: string, label: string): string {
  if (
    typeof value !== "string"
    || !path.isAbsolute(value)
    || path.normalize(value) !== value
  ) {
    throw publicationErrorV2(
      "ACTIVATION_PUBLICATION_INVALID",
      `Activation publication ${label} must be one normalized absolute path`,
    );
  }
  return value;
}

function targetBasenameV2(
  memberKind:
    PlatformReleaseBootstrapActivationPublicationMemberKindV2,
): string {
  switch (memberKind) {
    case "staged_activation_receipt":
      return PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.registry
        .activationReceiptBasename;
    case "staged_genesis_epoch_state":
      return PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.registry
        .epochFloorBasename;
    case "staged_shared_lock":
      return PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.registry
        .sharedLockBasename;
  }
}

function validateInputV2(
  input: PlatformReleaseBootstrapActivationPublicationInputV2,
): PlatformReleaseBootstrapActivationPublicationInputV2 {
  if (
    !Object.values(
      PlatformReleaseBootstrapActivationPublicationMemberKindV2,
    ).includes(input.memberKind)
    || !/^[a-f0-9]{64}$/.test(input.expectedRawContentHash)
  ) {
    throw publicationErrorV2(
      "ACTIVATION_PUBLICATION_INVALID",
      "Activation publication member kind and content identity must be exact",
    );
  }
  try {
    const filesystemScope =
      parseBootstrapFilesystemScopeIdentityCandidateV2(
        input.filesystemScope,
      );
    const expectedObjectIdentity =
      parseStableFsObjectIdentityCandidateV2(
        input.expectedObjectIdentity,
      );
    if (
      expectedObjectIdentity.objectKind !== "ordinary_file"
      || expectedObjectIdentity.filesystemScopeIdentityHash
        !== filesystemScope.scopeIdentityHash
    ) {
      throw publicationErrorV2(
        "ACTIVATION_PUBLICATION_INVALID",
        "Activation expected object identity must belong to the admitted filesystem scope",
      );
    }
    return Object.freeze({
      filesystemScope,
      stagingDirectoryPath: exactAbsolutePathV2(
        input.stagingDirectoryPath,
        "staging directory",
      ),
      namespaceParentPath: exactAbsolutePathV2(
        input.namespaceParentPath,
        "namespace parent",
      ),
      memberKind: input.memberKind,
      expectedRawContentHash: input.expectedRawContentHash,
      expectedObjectIdentity,
    });
  } catch (error) {
    if (
      error
        instanceof PlatformReleaseBootstrapActivationPublicationErrorV2
    ) {
      throw error;
    }
    throw publicationErrorV2(
      "ACTIVATION_PUBLICATION_INVALID",
      "Activation publication scope or object identity is invalid",
      error,
    );
  }
}

function sameIdentityV2(
  left: BigIntStats,
  right: BigIntStats,
): boolean {
  return left.isFile() === right.isFile()
    && left.dev === right.dev
    && left.ino === right.ino
    && left.uid === right.uid
    && left.gid === right.gid
    && left.mode === right.mode
    && left.nlink === right.nlink
    && left.size === right.size
    && left.mtimeNs === right.mtimeNs
    && left.ctimeNs === right.ctimeNs;
}

function sameLocatorV2(
  left: BigIntStats,
  right: BigIntStats,
): boolean {
  return left.dev === right.dev && left.ino === right.ino;
}

function requireExpectedObjectIdentityV2(
  stat: BigIntStats,
  expected: StableFsObjectIdentityV2,
): void {
  if (
    !stat.isFile()
    || stat.dev.toString(10) !== expected.device
    || stat.ino.toString(10) !== expected.inode
  ) {
    throw publicationErrorV2(
      "ACTIVATION_PUBLICATION_CONFLICT",
      "Activation member does not match the claim-bound stable object identity",
    );
  }
}

function requirePrivateFileV2(
  stat: BigIntStats,
  allowedLinks: readonly bigint[],
): void {
  if (
    !stat.isFile()
    || (stat.mode & 0o7777n) !== 0o600n
    || !allowedLinks.includes(stat.nlink)
    || stat.size < 0n
    || stat.size > BigInt(MAX_FILE_BYTES_V2)
    || (
      typeof process.getuid === "function"
      && stat.uid !== BigInt(process.getuid())
    )
  ) {
    throw publicationErrorV2(
      "ACTIVATION_PUBLICATION_INVALID",
      "Activation publication requires one exact private ordinary file",
    );
  }
}

async function readExactFileV2(
  filePath: string,
  allowedLinks: readonly bigint[],
  expectedHash: string,
  expectedObjectIdentity: StableFsObjectIdentityV2,
): Promise<ExactFileV2> {
  const pathBefore = await lstat(filePath, { bigint: true });
  requirePrivateFileV2(pathBefore, allowedLinks);
  requireExpectedObjectIdentityV2(
    pathBefore,
    expectedObjectIdentity,
  );
  const bytes = Buffer.allocUnsafe(Number(pathBefore.size));
  const probe = Buffer.allocUnsafe(1);
  let handle: FileHandle | undefined;
  try {
    handle = await open(
      filePath,
      constants.O_RDONLY
        | constants.O_NOFOLLOW
        | constants.O_NONBLOCK,
    );
    const descriptorBefore = await handle.stat({ bigint: true });
    if (!sameIdentityV2(pathBefore, descriptorBefore)) {
      throw publicationErrorV2(
        "ACTIVATION_PUBLICATION_INVALID",
        "Activation member changed before descriptor admission",
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
          "ACTIVATION_PUBLICATION_INVALID",
          "Activation member reached early EOF",
        );
      }
      offset += read.bytesRead;
    }
    if (
      (
        await handle.read(
          probe,
          0,
          1,
          bytes.length,
        )
      ).bytesRead !== 0
    ) {
      throw publicationErrorV2(
        "ACTIVATION_PUBLICATION_INVALID",
        "Activation member exceeded its exact byte length",
      );
    }
    const descriptorAfter = await handle.stat({ bigint: true });
    const pathAfter = await lstat(filePath, { bigint: true });
    if (
      !sameIdentityV2(pathBefore, descriptorAfter)
      || !sameIdentityV2(pathBefore, pathAfter)
    ) {
      throw publicationErrorV2(
        "ACTIVATION_PUBLICATION_INVALID",
        "Activation member changed during exact read",
      );
    }
    const rawContentHash = createHash("sha256")
      .update(bytes)
      .digest("hex");
    if (rawContentHash !== expectedHash) {
      throw publicationErrorV2(
        "ACTIVATION_PUBLICATION_CONFLICT",
        "Activation member bytes do not match the expected content",
      );
    }
    return Object.freeze({
      stat: pathAfter,
      rawContentHash,
    });
  } finally {
    bytes.fill(0);
    probe.fill(0);
    await handle?.close();
  }
}

async function inspectOptionalFileV2(
  filePath: string,
  allowedLinks: readonly bigint[],
  expectedHash: string,
  expectedObjectIdentity: StableFsObjectIdentityV2,
): Promise<ExactFileV2 | null> {
  try {
    return await readExactFileV2(
      filePath,
      allowedLinks,
      expectedHash,
      expectedObjectIdentity,
    );
  } catch (error) {
    if (isNodeCodeV2(error, "ENOENT")) return null;
    throw error;
  }
}

async function requireAbsentTwiceV2(
  filePath: string,
): Promise<void> {
  for (let capture = 0; capture < 2; capture += 1) {
    try {
      await lstat(filePath, { bigint: true });
    } catch (error) {
      if (isNodeCodeV2(error, "ENOENT")) continue;
      throw error;
    }
    throw publicationErrorV2(
      "ACTIVATION_PUBLICATION_CONFLICT",
      "Activation stage reappeared before final publication",
    );
  }
}

async function syncDirectoryV2(directoryPath: string): Promise<void> {
  let handle: FileHandle | undefined;
  try {
    handle = await open(
      directoryPath,
      constants.O_RDONLY
        | constants.O_DIRECTORY
        | constants.O_NOFOLLOW
        | constants.O_NONBLOCK,
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
      constants.O_RDONLY
        | constants.O_NOFOLLOW
        | constants.O_NONBLOCK,
    );
    const current = await handle.stat({ bigint: true });
    requirePrivateFileV2(current, allowedLinks);
    if (!sameIdentityV2(expected, current)) {
      throw publicationErrorV2(
        "ACTIVATION_PUBLICATION_CONFLICT",
        "Activation member changed before durability completion",
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
    !expected.isDirectory()
    || !observed.isDirectory()
    || expected.dev !== observed.dev
    || expected.ino !== observed.ino
    || expected.uid !== observed.uid
    || expected.gid !== observed.gid
    || expected.mode !== observed.mode
  ) {
    throw publicationErrorV2(
      "ACTIVATION_PUBLICATION_PARENT_CHANGED",
      "Activation publication parent changed",
    );
  }
}

async function openStableParentV2(
  parentPath: string,
): Promise<Readonly<{
  handle: FileHandle;
  before: BigIntStats;
}>> {
  const before = await lstat(parentPath, { bigint: true });
  if (!before.isDirectory()) {
    throw publicationErrorV2(
      "ACTIVATION_PUBLICATION_INVALID",
      "Activation publication parent must be one directory",
    );
  }
  const handle = await open(
    parentPath,
    constants.O_RDONLY
      | constants.O_DIRECTORY
      | constants.O_NOFOLLOW
      | constants.O_NONBLOCK,
  );
  try {
    requireStableParentV2(
      before,
      await handle.stat({ bigint: true }),
    );
    return Object.freeze({ handle, before });
  } catch (error) {
    await handle.close();
    throw error;
  }
}

async function finalParentFenceV2(
  parentPath: string,
  held: Readonly<{
    handle: FileHandle;
    before: BigIntStats;
  }>,
): Promise<void> {
  requireStableParentV2(
    held.before,
    await held.handle.stat({ bigint: true }),
  );
  requireStableParentV2(
    held.before,
    await lstat(parentPath, { bigint: true }),
  );
}

function safeNumberV2(
  value: bigint,
  maximum: number,
  label: string,
): number {
  if (value < 0n || value > BigInt(maximum)) {
    throw publicationErrorV2(
      "ACTIVATION_PUBLICATION_INVALID",
      `Activation ${label} is outside its exact boundary`,
    );
  }
  return Number(value);
}

function resultV2(
  input: PlatformReleaseBootstrapActivationPublicationInputV2,
  final: ExactFileV2,
): PlatformReleaseBootstrapActivationPublicationV2 {
  const objectIdentity = buildStableFsObjectIdentityV2({
    filesystemScope: input.filesystemScope,
    objectKind: "ordinary_file",
    device: final.stat.dev.toString(10),
    inode: final.stat.ino.toString(10),
  });
  const fingerprint = buildFsObservationFingerprintV2({
    objectIdentity,
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
    mode: (final.stat.mode & 0o7777n)
      .toString(8)
      .padStart(4, "0"),
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
    capability:
      PLATFORM_RELEASE_BOOTSTRAP_COOPERATIVE_CAPTURE_CAPABILITY_V2,
    memberKind: input.memberKind,
    objectIdentity,
    fingerprint,
    rawContentHash: final.rawContentHash,
  });
}

export async function publishCooperativeActivationMemberInternalV2(
  input: PlatformReleaseBootstrapActivationPublicationInputV2,
  checkpoint?:
    PlatformReleaseBootstrapActivationPublicationCheckpointHookV2,
): Promise<PlatformReleaseBootstrapActivationPublicationV2> {
  const validatedInput = validateInputV2(input);
  const stagingDirectoryPath =
    validatedInput.stagingDirectoryPath;
  const namespaceParentPath =
    validatedInput.namespaceParentPath;
  const stagePath = path.join(
    stagingDirectoryPath,
    validatedInput.memberKind,
  );
  const targetPath = path.join(
    namespaceParentPath,
    targetBasenameV2(validatedInput.memberKind),
  );
  const context = Object.freeze({
    stagingDirectoryPath,
    namespaceParentPath,
    stagePath,
    targetPath,
  });
  const stageParent = await openStableParentV2(
    stagingDirectoryPath,
  );
  let targetParent:
    Awaited<ReturnType<typeof openStableParentV2>>
    | undefined;
  try {
    targetParent = await openStableParentV2(
      namespaceParentPath,
    );
    if (stageParent.before.dev !== targetParent.before.dev) {
      throw publicationErrorV2(
        "ACTIVATION_PUBLICATION_CONFLICT",
        "Activation hard-link publication requires one filesystem",
      );
    }
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const stage = await inspectOptionalFileV2(
        stagePath,
        [1n, 2n],
        validatedInput.expectedRawContentHash,
        validatedInput.expectedObjectIdentity,
      );
      const target = await inspectOptionalFileV2(
        targetPath,
        [1n, 2n],
        validatedInput.expectedRawContentHash,
        validatedInput.expectedObjectIdentity,
      );
      if (stage === null && target === null) {
        throw publicationErrorV2(
          "ACTIVATION_PUBLICATION_CONFLICT",
          "Activation member is absent from both stage and final target",
        );
      }
      if (stage === null && target !== null) {
        if (target.stat.nlink !== 1n) {
          throw publicationErrorV2(
            "ACTIVATION_PUBLICATION_CONFLICT",
            "Activation final-only member has a hidden link",
          );
        }
        await syncExactFileV2(targetPath, target.stat, [1n]);
        await syncDirectoryV2(namespaceParentPath);
        await checkpoint?.(
          PlatformReleaseBootstrapActivationPublicationCheckpointV2
            .afterTargetDirectorySync,
          context,
        );
        await syncDirectoryV2(stagingDirectoryPath);
        await checkpoint?.(
          PlatformReleaseBootstrapActivationPublicationCheckpointV2
            .afterFinalStageDirectorySync,
          context,
        );
        await finalParentFenceV2(
          stagingDirectoryPath,
          stageParent,
        );
        await finalParentFenceV2(
          namespaceParentPath,
          targetParent,
        );
        const reproduced = await readExactFileV2(
          targetPath,
          [1n],
          validatedInput.expectedRawContentHash,
          validatedInput.expectedObjectIdentity,
        );
        if (!sameIdentityV2(target.stat, reproduced.stat)) {
          throw publicationErrorV2(
            "ACTIVATION_PUBLICATION_CONFLICT",
            "Activation final-only member changed during reproduction",
          );
        }
        await requireAbsentTwiceV2(stagePath);
        return resultV2(validatedInput, reproduced);
      }
      if (stage !== null && target !== null) {
        if (
          !sameLocatorV2(stage.stat, target.stat)
          || stage.stat.nlink !== 2n
          || target.stat.nlink !== 2n
        ) {
          throw publicationErrorV2(
            "ACTIVATION_PUBLICATION_CONFLICT",
            "Activation mixed state is not one exact two-link overlap",
          );
        }
        await syncDirectoryV2(namespaceParentPath);
        await checkpoint?.(
          PlatformReleaseBootstrapActivationPublicationCheckpointV2
            .afterTargetDirectorySync,
          context,
        );
        const stageBeforeUnlink = await lstat(stagePath, {
          bigint: true,
        });
        if (!sameIdentityV2(stage.stat, stageBeforeUnlink)) {
          throw publicationErrorV2(
            "ACTIVATION_PUBLICATION_CONFLICT",
            "Activation stage changed before exact unlink",
          );
        }
        await unlink(stagePath);
        await checkpoint?.(
          PlatformReleaseBootstrapActivationPublicationCheckpointV2
            .afterStageUnlink,
          context,
        );
        await syncDirectoryV2(stagingDirectoryPath);
        await checkpoint?.(
          PlatformReleaseBootstrapActivationPublicationCheckpointV2
            .afterFinalStageDirectorySync,
          context,
        );
        await finalParentFenceV2(
          stagingDirectoryPath,
          stageParent,
        );
        await finalParentFenceV2(
          namespaceParentPath,
          targetParent,
        );
        const final = await readExactFileV2(
          targetPath,
          [1n],
          validatedInput.expectedRawContentHash,
          validatedInput.expectedObjectIdentity,
        );
        if (!sameLocatorV2(stage.stat, final.stat)) {
          throw publicationErrorV2(
            "ACTIVATION_PUBLICATION_CONFLICT",
            "Activation final member did not preserve the staged inode",
          );
        }
        await requireAbsentTwiceV2(stagePath);
        return resultV2(validatedInput, final);
      }
      if (stage === null || stage.stat.nlink !== 1n) {
        throw publicationErrorV2(
          "ACTIVATION_PUBLICATION_CONFLICT",
          "Activation stage-only member has an invalid link topology",
        );
      }
      await syncExactFileV2(stagePath, stage.stat, [1n]);
      await checkpoint?.(
        PlatformReleaseBootstrapActivationPublicationCheckpointV2
          .afterStageFileSync,
        context,
      );
      await syncDirectoryV2(stagingDirectoryPath);
      await checkpoint?.(
        PlatformReleaseBootstrapActivationPublicationCheckpointV2
          .afterStageDirectorySync,
        context,
      );
      const stageBeforeLink = await lstat(stagePath, {
        bigint: true,
      });
      if (!sameIdentityV2(stage.stat, stageBeforeLink)) {
        continue;
      }
      try {
        await link(stagePath, targetPath);
      } catch (error) {
        if (isNodeCodeV2(error, "EEXIST")) {
          continue;
        }
        throw error;
      }
      await checkpoint?.(
        PlatformReleaseBootstrapActivationPublicationCheckpointV2
          .afterTargetLink,
        context,
      );
    }
    throw publicationErrorV2(
      "ACTIVATION_PUBLICATION_CONFLICT",
      "Activation publication did not converge",
    );
  } catch (error) {
    if (
      error
        instanceof PlatformReleaseBootstrapActivationPublicationErrorV2
      || (
        error instanceof Error
        && error.message.startsWith("injected:")
      )
    ) {
      throw error;
    }
    throw publicationErrorV2(
      "ACTIVATION_PUBLICATION_UNAVAILABLE",
      "Activation publication could not complete",
      error,
    );
  } finally {
    await targetParent?.handle.close();
    await stageParent.handle.close();
  }
}
