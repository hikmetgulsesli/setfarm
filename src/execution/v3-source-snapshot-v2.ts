import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { readRegularFileAtMostSync } from "../lib/bounded-file-read.js";
import { topologyPathAbsenceHash } from "../product-compiler/schemas/build-topology-v1.js";
import {
  NormalizedRelativeLocatorSchema,
  PathBindingIdSchema,
} from "../product-compiler/schemas/common-v1.js";
import type {
  LegacyCurrentImplementationFileSnapshotV2 as CurrentImplementationFileSnapshotV2,
} from "../product-compiler/slice-compiler-v2-legacy.js";

export const V3_SOURCE_SNAPSHOT_V2_DEFAULT_LIMITS = Object.freeze({
  maxFiles: 20_000,
  maxFileBytes: 64 * 1024 * 1024,
  maxTotalBytes: 512 * 1024 * 1024,
});

export type V3SourceSnapshotLimitsV2 = Readonly<{
  maxFiles: number;
  maxFileBytes: number;
  maxTotalBytes: number;
}>;

export type V3SourceSnapshotPathV2 = Readonly<{
  pathRef: string;
  path: string;
}>;

export type V3SourceSnapshotErrorCodeV2 =
  | "V3_SOURCE_SNAPSHOT_INPUT_INVALID"
  | "V3_SOURCE_SNAPSHOT_PATH_ESCAPE"
  | "V3_SOURCE_SNAPSHOT_TYPE_UNSUPPORTED"
  | "V3_SOURCE_SNAPSHOT_FILE_TOO_LARGE"
  | "V3_SOURCE_SNAPSHOT_TOTAL_TOO_LARGE"
  | "V3_SOURCE_SNAPSHOT_IO_UNAVAILABLE"
  | "V3_SOURCE_SNAPSHOT_CHANGED_DURING_CAPTURE";

export class V3SourceSnapshotErrorV2 extends Error {
  constructor(
    readonly code: V3SourceSnapshotErrorCodeV2,
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "V3SourceSnapshotErrorV2";
  }
}

type PathIdentity = Readonly<{
  path: string;
  dev: number;
  ino: number;
  nlink: number;
  mode: number;
  mtimeMs: number;
  ctimeMs: number;
}>;

function compareUtf16(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function exactPositiveLimit(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new V3SourceSnapshotErrorV2(
      "V3_SOURCE_SNAPSHOT_INPUT_INVALID",
      `${label} must be a positive safe integer`,
    );
  }
  return value;
}

function pathIdentity(target: string, expectedDirectory: boolean): PathIdentity {
  let stat: fs.Stats;
  try {
    stat = fs.lstatSync(target);
  } catch (error) {
    throw new V3SourceSnapshotErrorV2(
      isMissing(error)
        ? "V3_SOURCE_SNAPSHOT_CHANGED_DURING_CAPTURE"
        : "V3_SOURCE_SNAPSHOT_IO_UNAVAILABLE",
      isMissing(error)
        ? `Source path changed while its parent closure was captured: ${target}`
        : `Source path metadata is unavailable: ${target}`,
      error,
    );
  }
  if (stat.isSymbolicLink() || (expectedDirectory ? !stat.isDirectory() : !stat.isFile())) {
    throw new V3SourceSnapshotErrorV2(
      "V3_SOURCE_SNAPSHOT_TYPE_UNSUPPORTED",
      `Source path is not an exact ${expectedDirectory ? "directory" : "regular file"}: ${target}`,
    );
  }
  return {
    path: target,
    dev: stat.dev,
    ino: stat.ino,
    nlink: stat.nlink,
    mode: stat.mode,
    mtimeMs: stat.mtimeMs,
    ctimeMs: stat.ctimeMs,
  };
}

function samePathIdentity(left: PathIdentity, right: PathIdentity): boolean {
  return left.path === right.path
    && left.dev === right.dev
    && left.ino === right.ino
    && left.nlink === right.nlink
    && left.mode === right.mode
    && left.mtimeMs === right.mtimeMs
    && left.ctimeMs === right.ctimeMs;
}

type ParentClosure = Readonly<{
  existing: readonly PathIdentity[];
  firstMissing?: string;
}>;

function parentClosure(root: string, relative: string): ParentClosure {
  const segments = relative.split("/");
  const identities: PathIdentity[] = [pathIdentity(root, true)];
  let current = root;
  for (const segment of segments.slice(0, -1)) {
    current = path.join(current, segment);
    try {
      identities.push(pathIdentity(current, true));
    } catch (error) {
      if (
        error instanceof V3SourceSnapshotErrorV2
        && error.cause instanceof Error
        && "code" in error.cause
        && error.cause.code === "ENOENT"
      ) {
        return { existing: identities, firstMissing: current };
      }
      throw error;
    }
  }
  return { existing: identities };
}

function assertUnchangedParents(before: ParentClosure): void {
  for (const identity of before.existing) {
    const after = pathIdentity(identity.path, true);
    if (!samePathIdentity(identity, after)) {
      throw new V3SourceSnapshotErrorV2(
        "V3_SOURCE_SNAPSHOT_CHANGED_DURING_CAPTURE",
        `Source parent changed during descriptor capture: ${identity.path}`,
      );
    }
  }
  if (before.firstMissing) {
    try {
      fs.lstatSync(before.firstMissing);
      throw new V3SourceSnapshotErrorV2(
        "V3_SOURCE_SNAPSHOT_CHANGED_DURING_CAPTURE",
        `Missing source parent appeared during capture: ${before.firstMissing}`,
      );
    } catch (error) {
      if (!isMissing(error)) {
        if (error instanceof V3SourceSnapshotErrorV2) throw error;
        throw new V3SourceSnapshotErrorV2(
          "V3_SOURCE_SNAPSHOT_IO_UNAVAILABLE",
          `Missing source parent could not be rechecked: ${before.firstMissing}`,
          error,
        );
      }
    }
  }
}

function isMissing(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function readOne(
  root: string,
  sourcePath: V3SourceSnapshotPathV2,
  limits: V3SourceSnapshotLimitsV2,
  totalBytes: number,
): Readonly<{
  snapshot: CurrentImplementationFileSnapshotV2;
  byteLength: number;
  inodeKey?: string;
}> {
  const relative = sourcePath.path;
  const absolute = path.resolve(root, relative);
  if (absolute === root || !absolute.startsWith(`${root}${path.sep}`)) {
    throw new V3SourceSnapshotErrorV2(
      "V3_SOURCE_SNAPSHOT_PATH_ESCAPE",
      `Source path escapes the implementation worktree: ${relative}`,
    );
  }
  const parents = parentClosure(root, relative);
  let before: fs.Stats;
  try {
    before = fs.lstatSync(absolute);
  } catch (error) {
    if (!isMissing(error)) {
      throw new V3SourceSnapshotErrorV2(
        "V3_SOURCE_SNAPSHOT_IO_UNAVAILABLE",
        `Source path metadata is unavailable: ${relative}`,
        error,
      );
    }
    assertUnchangedParents(parents);
    try {
      fs.lstatSync(absolute);
      throw new V3SourceSnapshotErrorV2(
        "V3_SOURCE_SNAPSHOT_CHANGED_DURING_CAPTURE",
        `Absent source path appeared during capture: ${relative}`,
      );
    } catch (afterError) {
      if (!isMissing(afterError)) {
        if (afterError instanceof V3SourceSnapshotErrorV2) throw afterError;
        throw new V3SourceSnapshotErrorV2(
          "V3_SOURCE_SNAPSHOT_IO_UNAVAILABLE",
          `Absent source path could not be rechecked: ${relative}`,
          afterError,
        );
      }
    }
    return {
      snapshot: {
        pathRef: sourcePath.pathRef,
        presence: "absent",
        contentHash: topologyPathAbsenceHash(relative),
      },
      byteLength: 0,
    };
  }
  if (before.isSymbolicLink() || !before.isFile()) {
    throw new V3SourceSnapshotErrorV2(
      "V3_SOURCE_SNAPSHOT_TYPE_UNSUPPORTED",
      `Source path is not a regular file: ${relative}`,
    );
  }
  if (before.nlink !== 1) {
    throw new V3SourceSnapshotErrorV2(
      "V3_SOURCE_SNAPSHOT_TYPE_UNSUPPORTED",
      `Source path has external hard-link authority: ${relative}`,
    );
  }
  if (parents.firstMissing) {
    throw new V3SourceSnapshotErrorV2(
      "V3_SOURCE_SNAPSHOT_CHANGED_DURING_CAPTURE",
      `Source file appeared below a parent missing at capture start: ${relative}`,
    );
  }
  if (before.size > limits.maxFileBytes) {
    throw new V3SourceSnapshotErrorV2(
      "V3_SOURCE_SNAPSHOT_FILE_TOO_LARGE",
      `Source file exceeds ${limits.maxFileBytes} bytes: ${relative}`,
    );
  }
  if (before.size > limits.maxTotalBytes - totalBytes) {
    throw new V3SourceSnapshotErrorV2(
      "V3_SOURCE_SNAPSHOT_TOTAL_TOO_LARGE",
      `Source closure exceeds ${limits.maxTotalBytes} bytes at ${relative}`,
    );
  }

  let exact: ReturnType<typeof readRegularFileAtMostSync>;
  try {
    exact = readRegularFileAtMostSync(absolute, limits.maxFileBytes);
  } catch (error) {
    const boundedCode = error instanceof Error && "code" in error ? String(error.code) : "";
    throw new V3SourceSnapshotErrorV2(
      boundedCode === "FILE_TOO_LARGE"
        ? "V3_SOURCE_SNAPSHOT_FILE_TOO_LARGE"
        : boundedCode === "FILE_NOT_REGULAR"
          ? "V3_SOURCE_SNAPSHOT_TYPE_UNSUPPORTED"
          : "V3_SOURCE_SNAPSHOT_CHANGED_DURING_CAPTURE",
      `Descriptor-bounded source read failed for ${relative}`,
      error,
    );
  }
  const after = pathIdentity(absolute, false);
  assertUnchangedParents(parents);
  if (
    before.dev !== exact.stat.dev
    || before.ino !== exact.stat.ino
    || before.nlink !== exact.stat.nlink
    || before.mode !== exact.stat.mode
    || before.size !== exact.stat.size
    || before.mtimeMs !== exact.stat.mtimeMs
    || before.ctimeMs !== exact.stat.ctimeMs
    || after.dev !== exact.stat.dev
    || after.ino !== exact.stat.ino
    || after.nlink !== exact.stat.nlink
    || after.mode !== exact.stat.mode
    || after.mtimeMs !== exact.stat.mtimeMs
    || after.ctimeMs !== exact.stat.ctimeMs
  ) {
    throw new V3SourceSnapshotErrorV2(
      "V3_SOURCE_SNAPSHOT_CHANGED_DURING_CAPTURE",
      `Source pathname no longer names the descriptor-captured inode: ${relative}`,
    );
  }
  return {
    snapshot: {
      pathRef: sourcePath.pathRef,
      presence: "present",
      contentHash: createHash("sha256").update(exact.bytes).digest("hex"),
    },
    byteLength: exact.byteLength,
    inodeKey: `${exact.stat.dev}:${exact.stat.ino}`,
  };
}

export function captureV3ImplementationSourceSnapshotsV2(input: Readonly<{
  worktree: string;
  files: readonly V3SourceSnapshotPathV2[];
  limits?: Partial<V3SourceSnapshotLimitsV2>;
}>): Readonly<{
  snapshots: readonly CurrentImplementationFileSnapshotV2[];
  totalBytes: number;
}> {
  const limits = Object.freeze({
    maxFiles: exactPositiveLimit(
      input.limits?.maxFiles ?? V3_SOURCE_SNAPSHOT_V2_DEFAULT_LIMITS.maxFiles,
      "maxFiles",
    ),
    maxFileBytes: exactPositiveLimit(
      input.limits?.maxFileBytes ?? V3_SOURCE_SNAPSHOT_V2_DEFAULT_LIMITS.maxFileBytes,
      "maxFileBytes",
    ),
    maxTotalBytes: exactPositiveLimit(
      input.limits?.maxTotalBytes ?? V3_SOURCE_SNAPSHOT_V2_DEFAULT_LIMITS.maxTotalBytes,
      "maxTotalBytes",
    ),
  });
  if (input.files.length > limits.maxFiles) {
    throw new V3SourceSnapshotErrorV2(
      "V3_SOURCE_SNAPSHOT_INPUT_INVALID",
      `Source closure exceeds ${limits.maxFiles} files`,
    );
  }
  let root: string;
  try {
    root = fs.realpathSync(input.worktree);
  } catch (error) {
    throw new V3SourceSnapshotErrorV2(
      "V3_SOURCE_SNAPSHOT_INPUT_INVALID",
      "Implementation worktree is unavailable",
      error,
    );
  }
  pathIdentity(root, true);
  let parsed: V3SourceSnapshotPathV2[];
  try {
    parsed = input.files.map((file) => ({
      pathRef: PathBindingIdSchema.parse(file.pathRef),
      path: NormalizedRelativeLocatorSchema.parse(file.path),
    })).sort((left, right) => compareUtf16(left.pathRef, right.pathRef));
  } catch (error) {
    throw new V3SourceSnapshotErrorV2(
      "V3_SOURCE_SNAPSHOT_INPUT_INVALID",
      "Source closure contains an invalid path reference or locator",
      error,
    );
  }
  const refs = new Set<string>();
  const paths = new Set<string>();
  for (const file of parsed) {
    if (refs.has(file.pathRef) || paths.has(file.path)) {
      throw new V3SourceSnapshotErrorV2(
        "V3_SOURCE_SNAPSHOT_INPUT_INVALID",
        `Source closure duplicates a path ref or locator: ${file.pathRef}`,
      );
    }
    refs.add(file.pathRef);
    paths.add(file.path);
  }

  const snapshots: CurrentImplementationFileSnapshotV2[] = [];
  const inodeKeys = new Set<string>();
  let totalBytes = 0;
  for (const file of parsed) {
    const captured = readOne(root, file, limits, totalBytes);
    if (captured.inodeKey && inodeKeys.has(captured.inodeKey)) {
      throw new V3SourceSnapshotErrorV2(
        "V3_SOURCE_SNAPSHOT_INPUT_INVALID",
        `Two source locators resolve to one filesystem inode: ${file.pathRef}`,
      );
    }
    if (captured.inodeKey) inodeKeys.add(captured.inodeKey);
    totalBytes += captured.byteLength;
    snapshots.push(captured.snapshot);
  }
  return { snapshots, totalBytes };
}
