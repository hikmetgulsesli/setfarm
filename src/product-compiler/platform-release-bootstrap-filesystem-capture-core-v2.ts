import { createHash } from "node:crypto";
import {
  constants,
  type BigIntStats,
} from "node:fs";
import {
  lstat,
  open,
  opendir,
  type FileHandle,
} from "node:fs/promises";
import path from "node:path";

import {
  canonicalJsonStringify,
} from "./canonical-json.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_PHYSICAL_OWNER_ID_MAX_V2,
  buildDirectoryMembershipIdentityV2,
  buildFsObservationFingerprintV2,
  buildNamespacePhysicalEntryCaptureV2,
  buildStableFsObjectIdentityV2,
  type BootstrapFilesystemScopeIdentityV2,
  type FsObservationFingerprintV2,
  type NamespacePhysicalEntryCaptureV2,
  type StableFsObjectIdentityV2,
  type StableFsObjectKindV2,
} from "./platform-release-bootstrap-physical-census-v2.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_DOCUMENT_PROTOCOL_CATALOG_V2,
} from
  "../execution/schemas/platform-release-bootstrap-contract-v2.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_NAMESPACE_CENSUS_MAX_ENTRIES_V2,
  type PlatformReleaseBootstrapNamespaceClassificationV2,
} from "./platform-release-bootstrap-registry-v2.js";

export const PLATFORM_RELEASE_BOOTSTRAP_COOPERATIVE_CAPTURE_CAPABILITY_V2 =
  "cooperative_writer_process_crash" as const;

export const PLATFORM_RELEASE_BOOTSTRAP_CAPTURE_MAX_FILE_BYTES_V2 =
  Math.max(
    ...PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_DOCUMENT_PROTOCOL_CATALOG_V2
      .documents.map((document) => document.maxCanonicalBytes),
  );

export const PLATFORM_RELEASE_BOOTSTRAP_CAPTURE_MAX_DIRECTORY_ENTRIES_V2 =
  PLATFORM_RELEASE_BOOTSTRAP_NAMESPACE_CENSUS_MAX_ENTRIES_V2;

export type PlatformReleaseBootstrapFilesystemCaptureErrorCodeV2 =
  | "CAPTURE_CHANGED"
  | "CAPTURE_ENTRY_HARDLINKED"
  | "CAPTURE_ENTRY_TOO_LARGE"
  | "CAPTURE_INVALID_INPUT"
  | "CAPTURE_PARENT_INVALID"
  | "CAPTURE_UNSAFE_ENTRY_KIND";

export class PlatformReleaseBootstrapFilesystemCaptureErrorV2
  extends Error {
  constructor(
    readonly code:
      PlatformReleaseBootstrapFilesystemCaptureErrorCodeV2,
    message: string,
    options: ErrorOptions = {},
  ) {
    super(message, options);
    this.name =
      "PlatformReleaseBootstrapFilesystemCaptureErrorV2";
  }
}

export type PlatformReleaseBootstrapCooperativeCaptureInputV2 =
  Readonly<{
    filesystemScope: BootstrapFilesystemScopeIdentityV2;
    parentPath: string;
    classification:
      PlatformReleaseBootstrapNamespaceClassificationV2;
  }>;

export type PlatformReleaseBootstrapCooperativeCaptureV2 =
  Readonly<{
    capability:
      typeof PLATFORM_RELEASE_BOOTSTRAP_COOPERATIVE_CAPTURE_CAPABILITY_V2;
    parentObjectIdentity: StableFsObjectIdentityV2;
    parentFingerprint: FsObservationFingerprintV2;
    entryCapture: NamespacePhysicalEntryCaptureV2;
  }>;

export const PlatformReleaseBootstrapCaptureCheckpointV2 = {
  afterParentPathBefore: "after_parent_path_before",
  afterParentDescriptorBefore: "after_parent_descriptor_before",
  afterChildPathBefore: "after_child_path_before",
  afterChildDescriptorBefore: "after_child_descriptor_before",
  afterChildRead: "after_child_read",
  afterDirectoryMembershipFirst:
    "after_directory_membership_first",
  afterDirectoryMembershipSecond:
    "after_directory_membership_second",
  afterFirstCapture: "after_first_capture",
  afterSecondCapture: "after_second_capture",
  afterParentDescriptorAfter: "after_parent_descriptor_after",
  afterParentPathAfter: "after_parent_path_after",
} as const;

export type PlatformReleaseBootstrapCaptureCheckpointV2 =
  typeof PlatformReleaseBootstrapCaptureCheckpointV2[
    keyof typeof PlatformReleaseBootstrapCaptureCheckpointV2
  ];

export type PlatformReleaseBootstrapCaptureCheckpointContextV2 =
  Readonly<{
    parentPath: string;
    entryPath: string;
    basename: string;
  }>;

export type PlatformReleaseBootstrapCaptureCheckpointHookV2 = (
  checkpoint: PlatformReleaseBootstrapCaptureCheckpointV2,
  context: PlatformReleaseBootstrapCaptureCheckpointContextV2,
) => void | Promise<void>;

type CapturedStatV2 = Readonly<{
  objectKind: StableFsObjectKindV2;
  device: bigint;
  inode: bigint;
  ownerUid: bigint;
  ownerGid: bigint;
  mode: bigint;
  linkCount: bigint;
  byteLength: bigint;
  modifiedTimeNanoseconds: bigint;
  changedTimeNanoseconds: bigint;
}>;

function captureErrorV2(
  code: PlatformReleaseBootstrapFilesystemCaptureErrorCodeV2,
  message: string,
  cause?: unknown,
): PlatformReleaseBootstrapFilesystemCaptureErrorV2 {
  return new PlatformReleaseBootstrapFilesystemCaptureErrorV2(
    code,
    message,
    cause === undefined ? {} : { cause },
  );
}

function exactBasenameV2(value: string): string {
  if (
    value.length < 1
    || value.length > 255
    || value === "."
    || value === ".."
    || value.includes("/")
    || value.includes("\\")
    || value.includes("\0")
    || path.basename(value) !== value
  ) {
    throw captureErrorV2(
      "CAPTURE_INVALID_INPUT",
      "Bootstrap capture requires one exact direct-child basename",
    );
  }
  return value;
}

function validateInputV2(
  input: PlatformReleaseBootstrapCooperativeCaptureInputV2,
): PlatformReleaseBootstrapCaptureCheckpointContextV2 {
  if (
    typeof input.parentPath !== "string"
    || !path.isAbsolute(input.parentPath)
    || path.normalize(input.parentPath) !== input.parentPath
  ) {
    throw captureErrorV2(
      "CAPTURE_INVALID_INPUT",
      "Bootstrap capture parent must be one normalized absolute path",
    );
  }
  const basename = exactBasenameV2(
    input.classification.basename,
  );
  const entryPath = path.join(input.parentPath, basename);
  if (path.dirname(entryPath) !== input.parentPath) {
    throw captureErrorV2(
      "CAPTURE_INVALID_INPUT",
      "Bootstrap capture entry escaped its exact parent",
    );
  }
  return Object.freeze({
    parentPath: input.parentPath,
    entryPath,
    basename,
  });
}

function kindFromStatV2(
  stat: BigIntStats,
): StableFsObjectKindV2 {
  if (stat.isFile()) return "ordinary_file";
  if (stat.isDirectory()) return "directory";
  throw captureErrorV2(
    "CAPTURE_UNSAFE_ENTRY_KIND",
    "Bootstrap capture rejects symbolic links and special files",
  );
}

function capturedStatV2(stat: BigIntStats): CapturedStatV2 {
  return Object.freeze({
    objectKind: kindFromStatV2(stat),
    device: stat.dev,
    inode: stat.ino,
    ownerUid: stat.uid,
    ownerGid: stat.gid,
    mode: stat.mode & 0o7777n,
    linkCount: stat.nlink,
    byteLength: stat.size,
    modifiedTimeNanoseconds: stat.mtimeNs,
    changedTimeNanoseconds: stat.ctimeNs,
  });
}

function sameCapturedStatV2(
  left: CapturedStatV2,
  right: CapturedStatV2,
): boolean {
  return left.objectKind === right.objectKind
    && left.device === right.device
    && left.inode === right.inode
    && left.ownerUid === right.ownerUid
    && left.ownerGid === right.ownerGid
    && left.mode === right.mode
    && left.linkCount === right.linkCount
    && left.byteLength === right.byteLength
    && left.modifiedTimeNanoseconds
      === right.modifiedTimeNanoseconds
    && left.changedTimeNanoseconds
      === right.changedTimeNanoseconds;
}

function requireSameStatV2(
  expected: CapturedStatV2,
  observed: BigIntStats,
  message: string,
): void {
  if (!sameCapturedStatV2(expected, capturedStatV2(observed))) {
    throw captureErrorV2("CAPTURE_CHANGED", message);
  }
}

function requireEntryCaptureStillExactV2(
  expected: NamespacePhysicalEntryCaptureV2,
  observed: BigIntStats,
): void {
  const stat = capturedStatV2(observed);
  const fingerprint = expected.fingerprint;
  if (
    stat.objectKind !== expected.objectIdentity.objectKind
    || stat.device.toString(10)
      !== expected.objectIdentity.device
    || stat.inode.toString(10)
      !== expected.objectIdentity.inode
    || stat.ownerUid !== BigInt(fingerprint.ownerUid)
    || stat.ownerGid !== BigInt(fingerprint.ownerGid)
    || canonicalModeV2(stat.mode) !== fingerprint.mode
    || stat.linkCount !== BigInt(fingerprint.linkCount)
    || stat.byteLength !== BigInt(fingerprint.byteLength)
    || stat.modifiedTimeNanoseconds.toString(10)
      !== fingerprint.modifiedTimeNanoseconds
    || stat.changedTimeNanoseconds.toString(10)
      !== fingerprint.changedTimeNanoseconds
  ) {
    throw captureErrorV2(
      "CAPTURE_CHANGED",
      "Bootstrap capture entry changed before final return",
    );
  }
}

function safeNumberV2(
  value: bigint,
  maximum: number,
  label: string,
): number {
  if (value < 0n || value > BigInt(maximum)) {
    throw captureErrorV2(
      "CAPTURE_INVALID_INPUT",
      `Bootstrap capture ${label} is outside its exact numeric boundary`,
    );
  }
  return Number(value);
}

function canonicalModeV2(value: bigint): string {
  if (value < 0n || value > 0o7777n) {
    throw captureErrorV2(
      "CAPTURE_INVALID_INPUT",
      "Bootstrap capture mode is outside its exact boundary",
    );
  }
  return value.toString(8).padStart(4, "0");
}

function identitiesFromStatV2(
  filesystemScope: BootstrapFilesystemScopeIdentityV2,
  stat: CapturedStatV2,
): Readonly<{
  objectIdentity: StableFsObjectIdentityV2;
  fingerprint: FsObservationFingerprintV2;
}> {
  const objectIdentity = buildStableFsObjectIdentityV2({
    filesystemScope,
    objectKind: stat.objectKind,
    device: stat.device.toString(10),
    inode: stat.inode.toString(10),
  });
  const fingerprint = buildFsObservationFingerprintV2({
    objectIdentity,
    ownerUid: safeNumberV2(
      stat.ownerUid,
      PLATFORM_RELEASE_BOOTSTRAP_PHYSICAL_OWNER_ID_MAX_V2,
      "owner UID",
    ),
    ownerGid: safeNumberV2(
      stat.ownerGid,
      PLATFORM_RELEASE_BOOTSTRAP_PHYSICAL_OWNER_ID_MAX_V2,
      "owner GID",
    ),
    mode: canonicalModeV2(stat.mode),
    linkCount: safeNumberV2(
      stat.linkCount,
      Number.MAX_SAFE_INTEGER,
      "link count",
    ),
    byteLength: safeNumberV2(
      stat.byteLength,
      Number.MAX_SAFE_INTEGER,
      "byte length",
    ),
    modifiedTimeNanoseconds:
      stat.modifiedTimeNanoseconds.toString(10),
    changedTimeNanoseconds:
      stat.changedTimeNanoseconds.toString(10),
  });
  return Object.freeze({ objectIdentity, fingerprint });
}

function expectedEntryKindV2(
  classification:
    PlatformReleaseBootstrapNamespaceClassificationV2,
): StableFsObjectKindV2 {
  return (
    classification.category === "transaction_staging"
    || classification.category === "package_root"
    || classification.category === "generation_staging"
  )
    ? "directory"
    : "ordinary_file";
}

async function checkpointV2(
  hook: PlatformReleaseBootstrapCaptureCheckpointHookV2 | undefined,
  checkpoint: PlatformReleaseBootstrapCaptureCheckpointV2,
  context: PlatformReleaseBootstrapCaptureCheckpointContextV2,
): Promise<void> {
  await hook?.(checkpoint, context);
}

async function readExactBoundedHashV2(
  handle: FileHandle,
  expected: CapturedStatV2,
  hook:
    PlatformReleaseBootstrapCaptureCheckpointHookV2 | undefined,
  context: PlatformReleaseBootstrapCaptureCheckpointContextV2,
): Promise<string> {
  if (
    expected.byteLength < 0n
    || expected.byteLength
      > BigInt(
        PLATFORM_RELEASE_BOOTSTRAP_CAPTURE_MAX_FILE_BYTES_V2,
      )
  ) {
    throw captureErrorV2(
      "CAPTURE_ENTRY_TOO_LARGE",
      "Bootstrap capture ordinary file exceeds its fixed byte cap",
    );
  }
  const byteLength = Number(expected.byteLength);
  const bytes = Buffer.allocUnsafe(byteLength);
  const eofProbe = Buffer.allocUnsafe(1);
  try {
    let offset = 0;
    while (offset < byteLength) {
      const result = await handle.read(
        bytes,
        offset,
        byteLength - offset,
        offset,
      );
      if (result.bytesRead === 0) {
        throw captureErrorV2(
          "CAPTURE_CHANGED",
          "Bootstrap capture reached EOF before the exact byte length",
        );
      }
      offset += result.bytesRead;
    }
    const eof = await handle.read(
      eofProbe,
      0,
      1,
      byteLength,
    );
    if (eof.bytesRead !== 0) {
      throw captureErrorV2(
        "CAPTURE_CHANGED",
        "Bootstrap capture observed bytes beyond the exact byte length",
      );
    }
    await checkpointV2(
      hook,
      PlatformReleaseBootstrapCaptureCheckpointV2.afterChildRead,
      context,
    );
    return createHash("sha256")
      .update(bytes)
      .digest("hex");
  } finally {
    bytes.fill(0);
    eofProbe.fill(0);
  }
}

async function closeDirectoryV2(
  directory: Awaited<ReturnType<typeof opendir>>,
): Promise<void> {
  try {
    await directory.close();
  } catch (error) {
    if (
      !(
        error instanceof Error
        && "code" in error
        && error.code === "ERR_DIR_CLOSED"
      )
    ) {
      throw error;
    }
  }
}

async function enumerateDirectoryMembershipV2(
  directoryPath: string,
): Promise<
  readonly Readonly<{
    basename: string;
    objectKind: StableFsObjectKindV2;
  }>[]
> {
  const directory = await opendir(directoryPath, {
    bufferSize: 32,
  });
  try {
    const entries: Array<{
      basename: string;
      objectKind: StableFsObjectKindV2;
    }> = [];
    while (true) {
      const entry = await directory.read();
      if (entry === null) break;
      if (
        entries.length
          >=
            PLATFORM_RELEASE_BOOTSTRAP_CAPTURE_MAX_DIRECTORY_ENTRIES_V2
      ) {
        throw captureErrorV2(
          "CAPTURE_ENTRY_TOO_LARGE",
          "Bootstrap directory membership exceeds its fixed entry cap",
        );
      }
      const basename = exactBasenameV2(entry.name);
      const childStat = await lstat(
        path.join(directoryPath, basename),
        { bigint: true },
      );
      entries.push({
        basename,
        objectKind: kindFromStatV2(childStat),
      });
    }
    entries.sort((left, right) =>
      left.basename < right.basename
        ? -1
        : left.basename > right.basename
          ? 1
          : 0);
    for (let index = 1; index < entries.length; index += 1) {
      if (
        entries[index - 1]!.basename
          === entries[index]!.basename
      ) {
        throw captureErrorV2(
          "CAPTURE_CHANGED",
          "Bootstrap directory membership contained a duplicate basename",
        );
      }
    }
    return Object.freeze(
      entries.map((entry) => Object.freeze(entry)),
    );
  } finally {
    await closeDirectoryV2(directory);
  }
}

async function captureChildOnceV2(
  input: PlatformReleaseBootstrapCooperativeCaptureInputV2,
  parentIdentity: StableFsObjectIdentityV2,
  context: PlatformReleaseBootstrapCaptureCheckpointContextV2,
  hook:
    PlatformReleaseBootstrapCaptureCheckpointHookV2 | undefined,
): Promise<NamespacePhysicalEntryCaptureV2> {
  let beforePath: BigIntStats;
  try {
    beforePath = await lstat(context.entryPath, {
      bigint: true,
    });
  } catch (error) {
    throw captureErrorV2(
      "CAPTURE_CHANGED",
      "Bootstrap capture entry was not exactly observable",
      error,
    );
  }
  const before = capturedStatV2(beforePath);
  const expectedKind = expectedEntryKindV2(
    input.classification,
  );
  if (before.objectKind !== expectedKind) {
    throw captureErrorV2(
      "CAPTURE_UNSAFE_ENTRY_KIND",
      "Bootstrap capture entry kind does not match its classification",
    );
  }
  if (
    before.objectKind === "ordinary_file"
    && before.linkCount !== 1n
  ) {
    throw captureErrorV2(
      "CAPTURE_ENTRY_HARDLINKED",
      "Bootstrap capture ordinary file must have exactly one link",
    );
  }
  await checkpointV2(
    hook,
    PlatformReleaseBootstrapCaptureCheckpointV2.afterChildPathBefore,
    context,
  );

  let handle: FileHandle | undefined;
  try {
    handle = await open(
      context.entryPath,
      constants.O_RDONLY
        | constants.O_NOFOLLOW
        | constants.O_NONBLOCK
        | (
          expectedKind === "directory"
            ? constants.O_DIRECTORY
            : 0
        ),
    );
    const descriptorBefore = await handle.stat({
      bigint: true,
    });
    requireSameStatV2(
      before,
      descriptorBefore,
      "Bootstrap capture entry changed before descriptor admission",
    );
    await checkpointV2(
      hook,
      PlatformReleaseBootstrapCaptureCheckpointV2
        .afterChildDescriptorBefore,
      context,
    );

    let contentEvidence:
      | Readonly<{
        kind: "bounded_regular_file_bytes";
        rawContentHash: string;
      }>
      | Readonly<{
        kind: "directory_membership";
        membership: ReturnType<
          typeof buildDirectoryMembershipIdentityV2
        >;
      }>;
    if (expectedKind === "ordinary_file") {
      contentEvidence = Object.freeze({
        kind: "bounded_regular_file_bytes",
        rawContentHash: await readExactBoundedHashV2(
          handle,
          before,
          hook,
          context,
        ),
      });
    } else {
      const firstMembership =
        await enumerateDirectoryMembershipV2(context.entryPath);
      await checkpointV2(
        hook,
        PlatformReleaseBootstrapCaptureCheckpointV2
          .afterDirectoryMembershipFirst,
        context,
      );
      const secondMembership =
        await enumerateDirectoryMembershipV2(context.entryPath);
      await checkpointV2(
        hook,
        PlatformReleaseBootstrapCaptureCheckpointV2
          .afterDirectoryMembershipSecond,
        context,
      );
      if (
        canonicalJsonStringify(firstMembership)
          !== canonicalJsonStringify(secondMembership)
      ) {
        throw captureErrorV2(
          "CAPTURE_CHANGED",
          "Bootstrap directory membership changed between exact captures",
        );
      }
      contentEvidence = Object.freeze({
        kind: "directory_membership",
        membership: buildDirectoryMembershipIdentityV2({
          orderedEntries: [...firstMembership],
        }),
      });
    }

    const descriptorAfter = await handle.stat({
      bigint: true,
    });
    requireSameStatV2(
      before,
      descriptorAfter,
      "Bootstrap capture entry descriptor changed during observation",
    );
    const afterPath = await lstat(context.entryPath, {
      bigint: true,
    });
    requireSameStatV2(
      before,
      afterPath,
      "Bootstrap capture entry path changed during observation",
    );
    const {
      objectIdentity,
      fingerprint,
    } = identitiesFromStatV2(input.filesystemScope, before);
    return buildNamespacePhysicalEntryCaptureV2({
      classification: input.classification,
      parentObjectIdentityHash:
        parentIdentity.objectIdentityHash,
      objectIdentity,
      fingerprint,
      contentEvidence,
    });
  } catch (error) {
    if (
      error
        instanceof PlatformReleaseBootstrapFilesystemCaptureErrorV2
    ) {
      throw error;
    }
    throw captureErrorV2(
      "CAPTURE_CHANGED",
      "Bootstrap capture entry could not be observed safely",
      error,
    );
  } finally {
    await handle?.close();
  }
}

export async function captureCooperativeBootstrapNamespaceEntryInternalV2(
  input: PlatformReleaseBootstrapCooperativeCaptureInputV2,
  hook?:
    PlatformReleaseBootstrapCaptureCheckpointHookV2,
): Promise<PlatformReleaseBootstrapCooperativeCaptureV2> {
  const context = validateInputV2(input);
  let parentBeforePath: BigIntStats;
  try {
    parentBeforePath = await lstat(input.parentPath, {
      bigint: true,
    });
  } catch (error) {
    throw captureErrorV2(
      "CAPTURE_PARENT_INVALID",
      "Bootstrap capture parent was not exactly observable",
      error,
    );
  }
  const parentBefore = capturedStatV2(parentBeforePath);
  if (parentBefore.objectKind !== "directory") {
    throw captureErrorV2(
      "CAPTURE_PARENT_INVALID",
      "Bootstrap capture parent must be one ordinary directory",
    );
  }
  await checkpointV2(
    hook,
    PlatformReleaseBootstrapCaptureCheckpointV2.afterParentPathBefore,
    context,
  );

  let parentHandle: FileHandle | undefined;
  try {
    parentHandle = await open(
      input.parentPath,
      constants.O_RDONLY
        | constants.O_DIRECTORY
        | constants.O_NOFOLLOW
        | constants.O_NONBLOCK,
    );
    const parentDescriptorBefore = await parentHandle.stat({
      bigint: true,
    });
    requireSameStatV2(
      parentBefore,
      parentDescriptorBefore,
      "Bootstrap capture parent changed before descriptor admission",
    );
    await checkpointV2(
      hook,
      PlatformReleaseBootstrapCaptureCheckpointV2
        .afterParentDescriptorBefore,
      context,
    );
    const {
      objectIdentity: parentObjectIdentity,
      fingerprint: parentFingerprint,
    } = identitiesFromStatV2(
      input.filesystemScope,
      parentBefore,
    );

    const first = await captureChildOnceV2(
      input,
      parentObjectIdentity,
      context,
      hook,
    );
    await checkpointV2(
      hook,
      PlatformReleaseBootstrapCaptureCheckpointV2.afterFirstCapture,
      context,
    );
    const second = await captureChildOnceV2(
      input,
      parentObjectIdentity,
      context,
      hook,
    );
    await checkpointV2(
      hook,
      PlatformReleaseBootstrapCaptureCheckpointV2.afterSecondCapture,
      context,
    );
    if (
      canonicalJsonStringify(first)
        !== canonicalJsonStringify(second)
    ) {
      throw captureErrorV2(
        "CAPTURE_CHANGED",
        "Bootstrap entry captures were not exactly equal",
      );
    }

    const parentDescriptorAfter = await parentHandle.stat({
      bigint: true,
    });
    requireSameStatV2(
      parentBefore,
      parentDescriptorAfter,
      "Bootstrap capture held parent changed during observation",
    );
    await checkpointV2(
      hook,
      PlatformReleaseBootstrapCaptureCheckpointV2
        .afterParentDescriptorAfter,
      context,
    );
    const parentAfterPath = await lstat(input.parentPath, {
      bigint: true,
    });
    requireSameStatV2(
      parentBefore,
      parentAfterPath,
      "Bootstrap capture parent path changed during observation",
    );
    await checkpointV2(
      hook,
      PlatformReleaseBootstrapCaptureCheckpointV2.afterParentPathAfter,
      context,
    );
    const finalParentDescriptor = await parentHandle.stat({
      bigint: true,
    });
    requireSameStatV2(
      parentBefore,
      finalParentDescriptor,
      "Bootstrap capture held parent changed at final return",
    );
    const finalParentPath = await lstat(input.parentPath, {
      bigint: true,
    });
    requireSameStatV2(
      parentBefore,
      finalParentPath,
      "Bootstrap capture parent path changed at final return",
    );
    const finalEntryPath = await lstat(context.entryPath, {
      bigint: true,
    });
    requireEntryCaptureStillExactV2(first, finalEntryPath);

    return Object.freeze({
      capability:
        PLATFORM_RELEASE_BOOTSTRAP_COOPERATIVE_CAPTURE_CAPABILITY_V2,
      parentObjectIdentity,
      parentFingerprint,
      entryCapture: first,
    });
  } catch (error) {
    if (
      error
        instanceof PlatformReleaseBootstrapFilesystemCaptureErrorV2
    ) {
      throw error;
    }
    throw captureErrorV2(
      "CAPTURE_PARENT_INVALID",
      "Bootstrap capture parent could not be held safely",
      error,
    );
  } finally {
    await parentHandle?.close();
  }
}
