import { createHash } from "node:crypto";
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readSync,
  readdirSync,
  realpathSync,
  type Stats,
} from "node:fs";
import path from "node:path";

import { canonicalJsonStringify } from "../product-compiler/canonical-json.js";
import {
  CANONICAL_RUNTIME_TREE_V2_PROFILES,
  CanonicalRuntimeTreeV2Schema,
  canonicalRuntimePathIssuesV2,
  createCanonicalRuntimeTreeV2,
  type CanonicalRuntimeTreeEntryV2,
  type CanonicalRuntimeTreeLimitsV2,
  type CanonicalRuntimeTreeProfileV2,
  type CanonicalRuntimeTreeV2,
} from "./schemas/canonical-runtime-tree-v2.js";

export type CanonicalRuntimeTreeV2ErrorCode =
  | "AUTHORITY_MISMATCH"
  | "CONTRACT_INVALID"
  | "DIRECTORY_CHANGED"
  | "DIRECTORY_LIMIT_EXCEEDED"
  | "FILE_CHANGED"
  | "FILE_LIMIT_EXCEEDED"
  | "FILE_TOO_LARGE"
  | "HARDLINK_REJECTED"
  | "IO_FAILURE"
  | "METADATA_PRESENT"
  | "METADATA_PROBE_FAILED"
  | "METADATA_PROBE_UNSUPPORTED"
  | "MODE_INVALID"
  | "PATH_CASE_COLLISION"
  | "PATH_INVALID"
  | "ROOT_INVALID"
  | "SPECIAL_FILE_REJECTED"
  | "SYMLINK_REJECTED"
  | "TOTAL_BYTES_EXCEEDED";

export class CanonicalRuntimeTreeV2Error extends Error {
  constructor(
    readonly code: CanonicalRuntimeTreeV2ErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(`${code}: ${message}`, options);
    this.name = "CanonicalRuntimeTreeV2Error";
  }
}

export type CanonicalRuntimeMetadataKindV2 = "acl" | "xattr";

export type CanonicalRuntimeMetadataProbeResultV2 =
  | Readonly<{ status: "clear" }>
  | Readonly<{
    status: "present";
    metadata: readonly CanonicalRuntimeMetadataKindV2[];
    detail?: string;
  }>
  | Readonly<{ status: "unsupported"; detail: string }>;

export type CanonicalRuntimeMetadataProbeV2 = (input: Readonly<{
  absolutePath: string;
  relativePath: "." | string;
  type: "root" | "directory" | "file";
}>) => CanonicalRuntimeMetadataProbeResultV2;

export type CaptureCanonicalRuntimeTreeV2Input = Readonly<{
  root: string;
  profile: CanonicalRuntimeTreeProfileV2;
  /**
   * Required because portable Node APIs cannot prove that ACLs or xattrs are
   * absent. A capsule builder must inject a platform-specific, fail-closed
   * probe before this artifact can become deployment authority.
   */
  metadataProbe: CanonicalRuntimeMetadataProbeV2;
}>;

export type VerifyCanonicalRuntimeTreeV2Input = Readonly<{
  root: string;
  candidate: unknown;
  metadataProbe: CanonicalRuntimeMetadataProbeV2;
}>;

type CaptureHookContext = Readonly<{
  absolutePath: string;
  relativePath: "." | string;
}>;

export type CanonicalRuntimeTreeV2TestHooks = Readonly<{
  afterFileRead?: (context: CaptureHookContext) => void;
  beforeDirectoryRescan?: (context: CaptureHookContext) => void;
}>;

type CaptureState = {
  readonly root: string;
  readonly profile: CanonicalRuntimeTreeProfileV2;
  readonly limits: CanonicalRuntimeTreeLimitsV2;
  readonly metadataProbe: CanonicalRuntimeMetadataProbeV2;
  readonly hooks?: CanonicalRuntimeTreeV2TestHooks;
  readonly entries: CanonicalRuntimeTreeEntryV2[];
  readonly casefoldPaths: Map<string, string>;
  readonly visitedDirectories: Set<string>;
  fileCount: number;
  directoryCount: number;
  totalBytes: number;
};

type DirectorySnapshot = Readonly<{
  dev: number;
  ino: number;
  mode: number;
  mtimeMs: number;
  ctimeMs: number;
  names: readonly string[];
}>;

function modeBits(stat: Stats): number {
  return stat.mode & 0o7777;
}

function octalMode(stat: Stats): string {
  return modeBits(stat).toString(8).padStart(4, "0");
}

function isSystemError(value: unknown): value is NodeJS.ErrnoException {
  return value instanceof Error && "code" in value;
}

function throwCaptureError(
  code: CanonicalRuntimeTreeV2ErrorCode,
  message: string,
  cause?: unknown,
): never {
  throw new CanonicalRuntimeTreeV2Error(code, message, cause === undefined ? undefined : { cause });
}

function assertExactMode(
  stat: Stats,
  expected: readonly number[],
  relativePath: "." | string,
): void {
  const actual = modeBits(stat);
  if (!expected.includes(actual)) {
    throwCaptureError(
      "MODE_INVALID",
      `${relativePath} mode is ${octalMode(stat)}; expected ${expected
        .map((entry) => entry.toString(8).padStart(4, "0"))
        .join(" or ")}`,
    );
  }
}

function assertMetadataClear(
  state: CaptureState,
  absolutePath: string,
  relativePath: "." | string,
  type: "root" | "directory" | "file",
): void {
  let result: CanonicalRuntimeMetadataProbeResultV2;
  try {
    result = state.metadataProbe({ absolutePath, relativePath, type });
  } catch (error) {
    throwCaptureError("METADATA_PROBE_FAILED", `metadata probe failed for ${relativePath}`, error);
  }
  if (!result || typeof result !== "object" || !("status" in result)) {
    throwCaptureError("METADATA_PROBE_FAILED", `metadata probe returned an invalid result for ${relativePath}`);
  }
  const keys = Object.keys(result).sort();
  if (result.status === "clear" && keys.length === 1 && keys[0] === "status") return;
  if (
    result.status === "unsupported"
    && typeof result.detail === "string"
    && keys.length === 2
    && keys[0] === "detail"
    && keys[1] === "status"
  ) {
    throwCaptureError(
      "METADATA_PROBE_UNSUPPORTED",
      `metadata authority is unavailable for ${relativePath}: ${result.detail}`,
    );
  }
  if (
    result.status === "present"
    && Array.isArray(result.metadata)
    && result.metadata.length > 0
    && result.metadata.every((entry) => entry === "acl" || entry === "xattr")
    && keys.every((key) => key === "detail" || key === "metadata" || key === "status")
    && keys.includes("metadata")
    && keys.includes("status")
    && (result.detail === undefined || typeof result.detail === "string")
  ) {
    throwCaptureError(
      "METADATA_PRESENT",
      `${relativePath} has forbidden metadata: ${[...new Set(result.metadata)].sort().join(", ")}`,
    );
  }
  throwCaptureError("METADATA_PROBE_FAILED", `metadata probe returned an invalid result for ${relativePath}`);
}

function validateRelativePath(state: CaptureState, relativePath: string): void {
  const issues = canonicalRuntimePathIssuesV2(relativePath, state.limits);
  if (issues.length > 0) {
    throwCaptureError("PATH_INVALID", `${relativePath}: ${issues.join("; ")}`);
  }
  const folded = relativePath.toLowerCase();
  const prior = state.casefoldPaths.get(folded);
  if (prior !== undefined && prior !== relativePath) {
    throwCaptureError(
      "PATH_CASE_COLLISION",
      `${relativePath} collides with ${prior} under ASCII case folding`,
    );
  }
  state.casefoldPaths.set(folded, relativePath);
}

function directorySnapshot(absolutePath: string, relativePath: "." | string): DirectorySnapshot {
  let stat: Stats;
  let names: string[];
  try {
    stat = lstatSync(absolutePath);
    names = readdirSync(absolutePath).sort();
  } catch (error) {
    throwCaptureError("DIRECTORY_CHANGED", `${relativePath} could not be snapshotted`, error);
  }
  if (stat.isSymbolicLink()) {
    throwCaptureError("SYMLINK_REJECTED", `${relativePath} is a symbolic link`);
  }
  if (!stat.isDirectory()) {
    throwCaptureError("SPECIAL_FILE_REJECTED", `${relativePath} is not a directory`);
  }
  return {
    dev: stat.dev,
    ino: stat.ino,
    mode: stat.mode,
    mtimeMs: stat.mtimeMs,
    ctimeMs: stat.ctimeMs,
    names,
  };
}

function sameStringArray(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((entry, index) => entry === right[index]);
}

function assertDirectoryStable(
  before: DirectorySnapshot,
  after: DirectorySnapshot,
  relativePath: "." | string,
): void {
  if (
    before.dev !== after.dev
    || before.ino !== after.ino
    || before.mode !== after.mode
    || before.mtimeMs !== after.mtimeMs
    || before.ctimeMs !== after.ctimeMs
    || !sameStringArray(before.names, after.names)
  ) {
    throwCaptureError("DIRECTORY_CHANGED", `${relativePath} changed while its tree was captured`);
  }
}

function assertFileStat(
  stat: Stats,
  relativePath: string,
  limits: CanonicalRuntimeTreeLimitsV2,
): void {
  if (!stat.isFile()) {
    throwCaptureError("SPECIAL_FILE_REJECTED", `${relativePath} is not a regular file`);
  }
  if (stat.nlink !== 1) {
    throwCaptureError("HARDLINK_REJECTED", `${relativePath} has link count ${stat.nlink}; expected 1`);
  }
  assertExactMode(stat, [0o444, 0o555], relativePath);
  if (!Number.isSafeInteger(stat.size) || stat.size < 0 || stat.size > limits.maxFileBytes) {
    throwCaptureError("FILE_TOO_LARGE", `${relativePath} exceeds ${limits.maxFileBytes} bytes`);
  }
}

function sameFileStat(left: Stats, right: Stats): boolean {
  return left.isFile()
    && right.isFile()
    && left.dev === right.dev
    && left.ino === right.ino
    && left.nlink === right.nlink
    && left.mode === right.mode
    && left.size === right.size
    && left.mtimeMs === right.mtimeMs
    && left.ctimeMs === right.ctimeMs;
}

function readAndHashFile(state: CaptureState, absolutePath: string, relativePath: string): Readonly<{
  byteLength: number;
  contentHash: string;
  mode: "0444" | "0555";
  executable: boolean;
}> {
  let descriptor: number | undefined;
  try {
    try {
      descriptor = openSync(
        absolutePath,
        constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
      );
    } catch (error) {
      if (isSystemError(error) && error.code === "ELOOP") {
        throwCaptureError("SYMLINK_REJECTED", `${relativePath} became a symbolic link`, error);
      }
      throwCaptureError("FILE_CHANGED", `${relativePath} could not be opened without following links`, error);
    }

    const before = fstatSync(descriptor);
    assertFileStat(before, relativePath, state.limits);
    if (state.totalBytes + before.size > state.limits.maxTotalBytes) {
      throwCaptureError(
        "TOTAL_BYTES_EXCEEDED",
        `runtime tree exceeds ${state.limits.maxTotalBytes} total bytes at ${relativePath}`,
      );
    }
    assertMetadataClear(state, absolutePath, relativePath, "file");

    const hash = createHash("sha256");
    const buffer = Buffer.allocUnsafe(64 * 1024);
    let byteLength = 0;
    while (true) {
      const bytesRead = readSync(descriptor, buffer, 0, buffer.length, null);
      if (bytesRead === 0) break;
      byteLength += bytesRead;
      if (byteLength > state.limits.maxFileBytes) {
        throwCaptureError("FILE_TOO_LARGE", `${relativePath} exceeds ${state.limits.maxFileBytes} bytes`);
      }
      if (state.totalBytes + byteLength > state.limits.maxTotalBytes) {
        throwCaptureError(
          "TOTAL_BYTES_EXCEEDED",
          `runtime tree exceeds ${state.limits.maxTotalBytes} total bytes at ${relativePath}`,
        );
      }
      hash.update(buffer.subarray(0, bytesRead));
    }

    state.hooks?.afterFileRead?.({ absolutePath, relativePath });
    const after = fstatSync(descriptor);
    let pathAfter: Stats;
    try {
      pathAfter = lstatSync(absolutePath);
    } catch (error) {
      throwCaptureError("FILE_CHANGED", `${relativePath} disappeared during capture`, error);
    }
    if (
      !sameFileStat(before, after)
      || !sameFileStat(after, pathAfter)
      || byteLength !== after.size
    ) {
      throwCaptureError("FILE_CHANGED", `${relativePath} changed while it was hashed`);
    }
    assertFileStat(after, relativePath, state.limits);
    assertMetadataClear(state, absolutePath, relativePath, "file");

    const executable = modeBits(after) === 0o555;
    return {
      byteLength,
      contentHash: hash.digest("hex"),
      mode: executable ? "0555" : "0444",
      executable,
    };
  } catch (error) {
    if (error instanceof CanonicalRuntimeTreeV2Error) throw error;
    return throwCaptureError("IO_FAILURE", `failed to capture ${relativePath}`, error);
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function visitDirectory(
  state: CaptureState,
  absolutePath: string,
  relativePath: "." | string,
  type: "root" | "directory",
): void {
  const before = directorySnapshot(absolutePath, relativePath);
  const directoryIdentity = `${before.dev}:${before.ino}`;
  if (state.visitedDirectories.has(directoryIdentity)) {
    throwCaptureError("HARDLINK_REJECTED", `${relativePath} aliases an already visited directory`);
  }
  state.visitedDirectories.add(directoryIdentity);
  let beforeStat: Stats;
  try {
    beforeStat = lstatSync(absolutePath);
  } catch (error) {
    throwCaptureError("DIRECTORY_CHANGED", `${relativePath} disappeared after snapshot`, error);
  }
  if (
    before.dev !== beforeStat.dev
    || before.ino !== beforeStat.ino
    || before.mode !== beforeStat.mode
    || before.mtimeMs !== beforeStat.mtimeMs
    || before.ctimeMs !== beforeStat.ctimeMs
  ) {
    throwCaptureError("DIRECTORY_CHANGED", `${relativePath} changed after its initial snapshot`);
  }
  assertExactMode(beforeStat, [0o555], relativePath);
  assertMetadataClear(state, absolutePath, relativePath, type);

  for (const name of before.names) {
    const childRelative = relativePath === "." ? name : `${relativePath}/${name}`;
    validateRelativePath(state, childRelative);
    const childAbsolute = path.join(absolutePath, name);
    let childStat: Stats;
    try {
      childStat = lstatSync(childAbsolute);
    } catch (error) {
      throwCaptureError("DIRECTORY_CHANGED", `${childRelative} disappeared during traversal`, error);
    }
    if (childStat.isSymbolicLink()) {
      throwCaptureError("SYMLINK_REJECTED", `${childRelative} is a symbolic link`);
    }
    if (childStat.isDirectory()) {
      state.directoryCount += 1;
      if (state.directoryCount > state.limits.maxDirectories) {
        throwCaptureError(
          "DIRECTORY_LIMIT_EXCEEDED",
          `runtime tree exceeds ${state.limits.maxDirectories} directories`,
        );
      }
      assertExactMode(childStat, [0o555], childRelative);
      state.entries.push({ path: childRelative, type: "directory", mode: "0555" });
      visitDirectory(state, childAbsolute, childRelative, "directory");
      continue;
    }
    if (!childStat.isFile()) {
      throwCaptureError("SPECIAL_FILE_REJECTED", `${childRelative} is not a regular file or directory`);
    }
    state.fileCount += 1;
    if (state.fileCount > state.limits.maxFiles) {
      throwCaptureError(
        "FILE_LIMIT_EXCEEDED",
        `runtime tree exceeds ${state.limits.maxFiles} files`,
      );
    }
    assertFileStat(childStat, childRelative, state.limits);
    const captured = readAndHashFile(state, childAbsolute, childRelative);
    state.totalBytes += captured.byteLength;
    state.entries.push({ path: childRelative, type: "file", ...captured });
  }

  state.hooks?.beforeDirectoryRescan?.({ absolutePath, relativePath });
  const after = directorySnapshot(absolutePath, relativePath);
  assertDirectoryStable(before, after, relativePath);
  assertMetadataClear(state, absolutePath, relativePath, type);
}

function validateLimits(
  profile: CanonicalRuntimeTreeProfileV2,
  overrides?: Partial<CanonicalRuntimeTreeLimitsV2>,
): CanonicalRuntimeTreeLimitsV2 {
  const fixed = CANONICAL_RUNTIME_TREE_V2_PROFILES[profile];
  if (overrides === undefined) return fixed;
  const merged = { ...fixed, ...overrides };
  for (const key of Object.keys(fixed) as (keyof CanonicalRuntimeTreeLimitsV2)[]) {
    const value = merged[key];
    if (!Number.isSafeInteger(value) || value < 1 || value > fixed[key]) {
      throw new RangeError(`${key} test limit must be a positive safe integer no greater than ${fixed[key]}`);
    }
  }
  return Object.freeze(merged);
}

function deepFreezeArtifact(value: CanonicalRuntimeTreeV2): CanonicalRuntimeTreeV2 {
  for (const entry of value.entries) Object.freeze(entry);
  Object.freeze(value.entries);
  return Object.freeze(value);
}

function capture(
  input: CaptureCanonicalRuntimeTreeV2Input,
  options?: Readonly<{
    limits?: Partial<CanonicalRuntimeTreeLimitsV2>;
    hooks?: CanonicalRuntimeTreeV2TestHooks;
  }>,
): CanonicalRuntimeTreeV2 {
  if (typeof input.root !== "string" || input.root.length === 0) {
    throwCaptureError("ROOT_INVALID", "runtime tree root must be a non-empty path");
  }
  if (input.profile !== "dist" && input.profile !== "dependencies") {
    throwCaptureError("CONTRACT_INVALID", "runtime tree profile must be dist or dependencies");
  }
  if (typeof input.metadataProbe !== "function") {
    throwCaptureError("CONTRACT_INVALID", "runtime tree metadataProbe must be a function");
  }
  const root = path.resolve(input.root);
  let rootStat: Stats;
  try {
    rootStat = lstatSync(root);
  } catch (error) {
    throwCaptureError("ROOT_INVALID", `${root} cannot be inspected`, error);
  }
  if (rootStat.isSymbolicLink()) {
    throwCaptureError("SYMLINK_REJECTED", `${root} is a symbolic-link root`);
  }
  if (!rootStat.isDirectory()) {
    throwCaptureError("ROOT_INVALID", `${root} is not a directory`);
  }
  let realRoot: string;
  try {
    realRoot = realpathSync(root);
  } catch (error) {
    throwCaptureError("ROOT_INVALID", `${root} cannot be resolved`, error);
  }
  if (realRoot !== root) {
    throwCaptureError("SYMLINK_REJECTED", `${root} traverses a symbolic-link root or parent`);
  }

  const state: CaptureState = {
    root,
    profile: input.profile,
    limits: validateLimits(input.profile, options?.limits),
    metadataProbe: input.metadataProbe,
    hooks: options?.hooks,
    entries: [],
    casefoldPaths: new Map(),
    visitedDirectories: new Set(),
    fileCount: 0,
    directoryCount: 0,
    totalBytes: 0,
  };
  visitDirectory(state, root, ".", "root");
  state.entries.sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
  const artifact = createCanonicalRuntimeTreeV2({
    schema: "setfarm.canonical-runtime-tree.v2",
    profile: state.profile,
    rootMode: "0555",
    entries: state.entries,
    fileCount: state.fileCount,
    directoryCount: state.directoryCount,
    totalBytes: state.totalBytes,
  });
  return deepFreezeArtifact(artifact);
}

/**
 * Captures a normalized read-only runtime tree as canonical authority.
 *
 * This detects accidental and concurrent drift. It is not a security boundary
 * against a hostile process running as the same UID: Node does not expose the
 * openat-style component walk needed to prevent a swap-and-restore attack on
 * every pathname. The capsule builder must therefore own a private immutable
 * root and pin this artifact's hash outside that root before release.
 */
export function captureCanonicalRuntimeTreeV2(
  input: CaptureCanonicalRuntimeTreeV2Input,
): CanonicalRuntimeTreeV2 {
  return capture(input);
}

/**
 * Reproduces current authority from bytes and metadata, then compares it with
 * the candidate. A successful call returns the fresh recapture, never the
 * caller-supplied object.
 */
export function verifyCanonicalRuntimeTreeV2(
  input: VerifyCanonicalRuntimeTreeV2Input,
): CanonicalRuntimeTreeV2 {
  const parsed = CanonicalRuntimeTreeV2Schema.safeParse(input.candidate);
  if (!parsed.success) {
    throwCaptureError("CONTRACT_INVALID", "candidate runtime tree does not satisfy the V2 schema", parsed.error);
  }
  const reproduced = captureCanonicalRuntimeTreeV2({
    root: input.root,
    profile: parsed.data.profile,
    metadataProbe: input.metadataProbe,
  });
  if (canonicalJsonStringify(reproduced) !== canonicalJsonStringify(parsed.data)) {
    throwCaptureError(
      "AUTHORITY_MISMATCH",
      `runtime tree reproduction differs from candidate ${parsed.data.payloadHash}`,
    );
  }
  return reproduced;
}

/**
 * Test-only entry point for reaching each fail-closed bound without creating
 * production-sized fixtures. Overrides can only tighten a fixed profile.
 */
export function captureCanonicalRuntimeTreeV2ForTest(input: CaptureCanonicalRuntimeTreeV2Input & Readonly<{
  limits?: Partial<CanonicalRuntimeTreeLimitsV2>;
  hooks?: CanonicalRuntimeTreeV2TestHooks;
}>): CanonicalRuntimeTreeV2 {
  return capture(input, { limits: input.limits, hooks: input.hooks });
}
