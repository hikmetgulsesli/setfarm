import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  closeSync,
  constants,
  fchmodSync,
  fstatSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readSync,
  readdirSync,
  rmSync,
  rmdirSync,
  unlinkSync,
  writeSync,
  type BigIntStats,
} from "node:fs";
import path from "node:path";
import { isProxy } from "node:util/types";

import { hashCanonicalJson } from "./canonical-json.js";
import {
  copyInventoriedNodeToolchainMaterializationSourceV2,
  inspectNodeToolchainArchiveInventoryReceiptV2,
  revalidateInventoriedNodeToolchainMaterializationAuthorityV2,
  type InventoriedNodeToolchainDistributionV2,
  type NodeToolchainSelectedArchiveMemberV2,
} from "./node-toolchain-archive-inventory-v2.js";
import {
  NODE_TOOLCHAIN_PRIVATE_TREE_AUTHORITY_REF_V2,
  NODE_TOOLCHAIN_PRIVATE_TREE_EXTRACT_MAX_STDERR_BYTES_V2,
  NODE_TOOLCHAIN_PRIVATE_TREE_EXTRACT_MAX_STDOUT_BYTES_V2,
  NODE_TOOLCHAIN_PRIVATE_TREE_EXTRACT_TIMEOUT_MS_V2,
  NODE_TOOLCHAIN_PRIVATE_TREE_MAX_DIRECTORIES_V2,
  NODE_TOOLCHAIN_PRIVATE_TREE_MAX_FILES_V2,
  NODE_TOOLCHAIN_PRIVATE_TREE_MAX_TOTAL_BYTES_V2,
  NODE_TOOLCHAIN_PRIVATE_TREE_RECEIPT_V2_SCHEMA,
  NODE_TOOLCHAIN_PRIVATE_TREE_VERSION_V2,
  NodeToolchainPrivateTreeReceiptV2Schema,
  hashNodeToolchainPrivateTreeReceiptV2,
  type NodeToolchainPrivateTreeReceiptHashPayloadV2,
  type NodeToolchainPrivateTreeReceiptV2,
} from "./schemas/node-toolchain-private-tree-v2.js";
import {
  matchesExactStableFilesystemObjectIdentityV2,
} from "./exact-stable-filesystem-identity-v2.js";

const BSDTAR_PATH_V2 = "/usr/bin/bsdtar" as const;
const PRIVATE_ROOT_PREFIX_V2 = "/private/tmp/setfarm-node-toolchain-tree-v2-";
const MAX_TREE_DEPTH_V2 = 64;

export type NodeToolchainPrivateTreeErrorCodeV2 =
  | "NODE_TOOLCHAIN_PRIVATE_TREE_V2_INPUT_INVALID"
  | "NODE_TOOLCHAIN_PRIVATE_TREE_V2_STAGE_INVALID"
  | "NODE_TOOLCHAIN_PRIVATE_TREE_V2_EXTRACT_TIMEOUT"
  | "NODE_TOOLCHAIN_PRIVATE_TREE_V2_EXTRACT_OUTPUT_LIMIT"
  | "NODE_TOOLCHAIN_PRIVATE_TREE_V2_EXTRACT_SPAWN_FAILED"
  | "NODE_TOOLCHAIN_PRIVATE_TREE_V2_EXTRACT_SIGNALLED"
  | "NODE_TOOLCHAIN_PRIVATE_TREE_V2_EXTRACT_NONZERO"
  | "NODE_TOOLCHAIN_PRIVATE_TREE_V2_EXTRACT_MALFORMED"
  | "NODE_TOOLCHAIN_PRIVATE_TREE_V2_RAW_TREE_INVALID"
  | "NODE_TOOLCHAIN_PRIVATE_TREE_V2_NORMALIZED_TREE_INVALID"
  | "NODE_TOOLCHAIN_PRIVATE_TREE_V2_RECEIPT_INVALID"
  | "NODE_TOOLCHAIN_PRIVATE_TREE_V2_HANDLE_UNAUTHENTICATED"
  | "NODE_TOOLCHAIN_PRIVATE_TREE_V2_HANDLE_DISPOSED"
  | "NODE_TOOLCHAIN_PRIVATE_TREE_V2_CLEANUP_FAILED";

export class NodeToolchainPrivateTreeErrorV2 extends Error {
  readonly code: NodeToolchainPrivateTreeErrorCodeV2;
  override readonly cause?: unknown;

  constructor(
    code: NodeToolchainPrivateTreeErrorCodeV2,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message.slice(0, 1_500), options);
    this.name = "NodeToolchainPrivateTreeErrorV2";
    this.code = code;
    this.cause = options?.cause;
  }
}

export type NodeToolchainPrivateTreeExtractionInvocationV2 = Readonly<{
  executable: typeof BSDTAR_PATH_V2;
  argv: readonly string[];
  cwd: string;
  env: Readonly<Record<string, string>>;
  shell: false;
  timeoutMs: number;
  maxStdoutBytes: number;
  maxStderrBytes: number;
}>;

export type NodeToolchainPrivateTreeExtractionResultV2 =
  | Readonly<{
    status: "exited";
    exitCode: number | null;
    signal: string | null;
    stdout: string;
    stderr: string;
  }>
  | Readonly<{
    status: "timed_out" | "output_limit_exceeded" | "spawn_failed";
    stdout: string;
    stderr: string;
  }>;

export type NodeToolchainPrivateTreeExtractorAdapterV2 = (
  invocation: NodeToolchainPrivateTreeExtractionInvocationV2,
) => Promise<NodeToolchainPrivateTreeExtractionResultV2>;

type TestHooksV2 = Readonly<{
  afterExtraction?: (input: Readonly<{
    rawRoot: string;
    rawArchiveRoot: string;
  }>) => void | Promise<void>;
  afterNormalized?: (input: Readonly<{
    treeRoot: string;
  }>) => void | Promise<void>;
}>;

type FileFingerprintV2 = Readonly<{
  device: bigint;
  inode: bigint;
  objectKind: "ordinary_file" | "directory";
  mode: bigint;
  ownerUid: bigint;
  ownerGid: bigint;
  linkCount: bigint;
  byteLength: bigint;
  modifiedNs: bigint;
  changedNs: bigint;
}>;

type RawFileV2 = Readonly<{
  archiveLocator: string;
  treeLocator: string;
  targetMode: "0444" | "0555";
  fingerprint: FileFingerprintV2;
  contentHash: string;
  bytes: Buffer;
}>;

type NormalizedEntryV2 = Readonly<{
  locator: "." | string;
  type: "file" | "directory";
  mode: "0444" | "0555";
  fingerprint: FileFingerprintV2;
  byteLength: number;
  contentHash: string | null;
}>;

type PrivateTreeStateV2 = Readonly<{
  stageRoot: string;
  stageRootFingerprint: FileFingerprintV2;
  treeRoot: string;
  entries: readonly NormalizedEntryV2[];
  receipt: NodeToolchainPrivateTreeReceiptV2;
}>;

export type NodeToolchainPrivateTreeBundleEntryV2 = Readonly<{
  locator: "." | string;
  type: "file" | "directory";
  mode: "0444" | "0555";
  byteLength: number;
  contentHash: string | null;
  bytes: Buffer | null;
}>;

export type NodeToolchainPrivateTreeBundleV2 = Readonly<{
  receipt: NodeToolchainPrivateTreeReceiptV2;
  entries: readonly NodeToolchainPrivateTreeBundleEntryV2[];
}>;

const handleConstructorCapabilityV2 = Object.freeze({});
const privateTreeStateV2 = new WeakMap<object, PrivateTreeStateV2>();
const disposedTreeHandlesV2 = new WeakSet<object>();

export class MaterializedNodeToolchainPrivateTreeV2 {
  readonly receiptHash: string;

  constructor(capability: object, state: PrivateTreeStateV2) {
    if (capability !== handleConstructorCapabilityV2) {
      throw new NodeToolchainPrivateTreeErrorV2(
        "NODE_TOOLCHAIN_PRIVATE_TREE_V2_HANDLE_UNAUTHENTICATED",
        "Materialized Node private tree constructor capability is unavailable",
      );
    }
    this.receiptHash = state.receipt.receiptHash;
    privateTreeStateV2.set(this, state);
    Object.freeze(this);
  }
}

function fail(
  code: NodeToolchainPrivateTreeErrorCodeV2,
  message: string,
  cause?: unknown,
): never {
  throw new NodeToolchainPrivateTreeErrorV2(
    code,
    message,
    cause === undefined ? undefined : { cause },
  );
}

function fingerprint(stat: BigIntStats): FileFingerprintV2 {
  return Object.freeze({
    device: stat.dev,
    inode: stat.ino,
    objectKind: stat.isDirectory() ? "directory" : "ordinary_file",
    mode: stat.mode,
    ownerUid: stat.uid,
    ownerGid: stat.gid,
    linkCount: stat.nlink,
    byteLength: stat.size,
    modifiedNs: stat.mtimeNs,
    changedNs: stat.ctimeNs,
  });
}

function sameFingerprint(left: FileFingerprintV2, right: FileFingerprintV2): boolean {
  return left.device === right.device
    && left.inode === right.inode
    && left.objectKind === right.objectKind
    && left.mode === right.mode
    && left.ownerUid === right.ownerUid
    && left.ownerGid === right.ownerGid
    && left.linkCount === right.linkCount
    && left.byteLength === right.byteLength
    && left.modifiedNs === right.modifiedNs
    && left.changedNs === right.changedNs;
}

function assertExactObjectStableIdentityV2(input: Readonly<{
  absolutePath: string;
  expected: FileFingerprintV2;
  objectKind: "ordinary_file" | "directory";
}>): void {
  let stat: BigIntStats;
  try {
    stat = lstatSync(input.absolutePath, { bigint: true });
  } catch (error) {
    return fail(
      "NODE_TOOLCHAIN_PRIVATE_TREE_V2_CLEANUP_FAILED",
      "Private tree cleanup object identity could not be captured exactly",
      error,
    );
  }
  if (
    !matchesExactStableFilesystemObjectIdentityV2({
      stat,
      expected: {
        device: input.expected.device,
        inode: input.expected.inode,
      },
      objectKind: input.objectKind,
    })
  ) {
    return fail(
      "NODE_TOOLCHAIN_PRIVATE_TREE_V2_CLEANUP_FAILED",
      "Private tree cleanup object kind or stable identity changed",
    );
  }
}

function modeBits(stat: BigIntStats | FileFingerprintV2): bigint {
  return stat.mode & 0o7777n;
}

function modeText(bits: bigint): "0444" | "0555" {
  if (bits === 0o444n) return "0444";
  if (bits === 0o555n) return "0555";
  return fail(
    "NODE_TOOLCHAIN_PRIVATE_TREE_V2_NORMALIZED_TREE_INVALID",
    "Normalized tree entry has a non-canonical mode",
  );
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function deepFreezeJson<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  const pending: object[] = [value as object];
  while (pending.length > 0) {
    const current = pending.pop()!;
    if (Object.isFrozen(current)) continue;
    for (const child of Object.values(current)) {
      if (child !== null && typeof child === "object" && !Object.isFrozen(child)) pending.push(child);
    }
    Object.freeze(current);
  }
  return value;
}

function defensiveReceiptCopy(
  receipt: NodeToolchainPrivateTreeReceiptV2,
): NodeToolchainPrivateTreeReceiptV2 {
  return deepFreezeJson(structuredClone(receipt));
}

function closeQuietly(descriptor: number | undefined): void {
  if (descriptor === undefined) return;
  try {
    closeSync(descriptor);
  } catch {
    // The primary typed failure remains authoritative.
  }
}

function writeExclusiveFile(input: Readonly<{
  absolutePath: string;
  bytes: Uint8Array;
  mode: number;
  errorCode: NodeToolchainPrivateTreeErrorCodeV2;
}>): FileFingerprintV2 {
  let descriptor: number | undefined;
  try {
    descriptor = openSync(
      input.absolutePath,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
      0o600,
    );
    let offset = 0;
    while (offset < input.bytes.byteLength) {
      const written = writeSync(descriptor, input.bytes, offset, input.bytes.byteLength - offset);
      if (written < 1) return fail(input.errorCode, "Exclusive file write made no forward progress");
      offset += written;
    }
    fchmodSync(descriptor, input.mode);
    fsyncSync(descriptor);
    const stat = fstatSync(descriptor, { bigint: true });
    if (
      !stat.isFile()
      || stat.nlink !== 1n
      || modeBits(stat) !== BigInt(input.mode)
      || stat.size !== BigInt(input.bytes.byteLength)
    ) {
      return fail(input.errorCode, "Exclusive file write lost its exact filesystem identity");
    }
    return fingerprint(stat);
  } catch (error) {
    if (error instanceof NodeToolchainPrivateTreeErrorV2) throw error;
    return fail(input.errorCode, "Exclusive file write failed", error);
  } finally {
    closeQuietly(descriptor);
  }
}

function syncDirectory(absolutePath: string): void {
  const descriptor = openSync(absolutePath, constants.O_RDONLY);
  try {
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

function removeStageBestEffort(stageRoot: string | undefined, stagePrefix: string): void {
  if (!stageRoot || !stageRoot.startsWith(stagePrefix)) return;
  try {
    const root = lstatSync(stageRoot, { bigint: true });
    if (root.isSymbolicLink() || !root.isDirectory()) return;
    const ownerUid = root.uid;
    const makeWritable = (absoluteDirectory: string): void => {
      const stat = lstatSync(absoluteDirectory, { bigint: true });
      if (stat.isSymbolicLink() || !stat.isDirectory() || stat.uid !== ownerUid) return;
      chmodSync(absoluteDirectory, 0o700);
      for (const name of readdirSync(absoluteDirectory)) {
        const child = path.join(absoluteDirectory, name);
        const childStat = lstatSync(child, { bigint: true });
        if (childStat.isDirectory() && !childStat.isSymbolicLink()) makeWritable(child);
      }
    };
    makeWritable(stageRoot);
    rmSync(stageRoot, { recursive: true, force: true });
  } catch {
    // The primary materialization failure remains authoritative.
  }
}

type StageV2 = Readonly<{
  stageRoot: string;
  archivePath: string;
  archiveFingerprint: FileFingerprintV2;
  selectionPath: string;
  selectionFingerprint: FileFingerprintV2;
  selectionBytesHash: string;
  rawRoot: string;
  treeRoot: string;
}>;

function createStage(input: Readonly<{
  archiveBytes: Buffer;
  archiveSha256: string;
  selectedMembers: readonly NodeToolchainSelectedArchiveMemberV2[];
  stagePrefix: string;
}>): StageV2 {
  if (sha256(input.archiveBytes) !== input.archiveSha256) {
    return fail(
      "NODE_TOOLCHAIN_PRIVATE_TREE_V2_STAGE_INVALID",
      "Materialization archive bytes differ from the authenticated inventory",
    );
  }
  let stageRoot: string | undefined;
  let completed = false;
  try {
    stageRoot = mkdtempSync(input.stagePrefix);
    chmodSync(stageRoot, 0o700);
    const archivePath = path.join(stageRoot, "archive.tar.xz");
    const selectionPath = path.join(stageRoot, "selected-members.nul");
    const rawRoot = path.join(stageRoot, "raw");
    const treeRoot = path.join(stageRoot, "tree");
    const selectionBytes = Buffer.from(
      `${input.selectedMembers.map((member) => member.archiveLocator).join("\0")}\0`,
      "utf8",
    );
    if (
      input.selectedMembers.length < 1
      || input.selectedMembers.some((member, index) =>
        member.archiveLocator.includes("\0")
        || (index > 0
          && member.archiveLocator <= input.selectedMembers[index - 1]!.archiveLocator))
    ) {
      return fail(
        "NODE_TOOLCHAIN_PRIVATE_TREE_V2_STAGE_INVALID",
        "Selected archive members must be unique and canonically sorted",
      );
    }
    const archiveFingerprint = writeExclusiveFile({
      absolutePath: archivePath,
      bytes: input.archiveBytes,
      mode: 0o600,
      errorCode: "NODE_TOOLCHAIN_PRIVATE_TREE_V2_STAGE_INVALID",
    });
    const selectionFingerprint = writeExclusiveFile({
      absolutePath: selectionPath,
      bytes: selectionBytes,
      mode: 0o600,
      errorCode: "NODE_TOOLCHAIN_PRIVATE_TREE_V2_STAGE_INVALID",
    });
    mkdirSync(rawRoot, { mode: 0o700 });
    mkdirSync(treeRoot, { mode: 0o700 });
    syncDirectory(stageRoot);
    completed = true;
    return Object.freeze({
      stageRoot,
      archivePath,
      archiveFingerprint,
      selectionPath,
      selectionFingerprint,
      selectionBytesHash: sha256(selectionBytes),
      rawRoot,
      treeRoot,
    });
  } catch (error) {
    if (error instanceof NodeToolchainPrivateTreeErrorV2) throw error;
    return fail("NODE_TOOLCHAIN_PRIVATE_TREE_V2_STAGE_INVALID", "Private materialization stage failed", error);
  } finally {
    if (!completed) removeStageBestEffort(stageRoot, input.stagePrefix);
  }
}

function immutableExtractionInvocation(stage: StageV2): NodeToolchainPrivateTreeExtractionInvocationV2 {
  return Object.freeze({
    executable: BSDTAR_PATH_V2,
    argv: Object.freeze([
      "-xf",
      stage.archivePath,
      "-C",
      stage.rawRoot,
      "--no-same-owner",
      "--no-same-permissions",
      "--no-xattrs",
      "--no-acls",
      "--no-recursion",
      "--null",
      "-T",
      stage.selectionPath,
    ]),
    cwd: stage.stageRoot,
    env: Object.freeze({ LANG: "C", LC_ALL: "C", TZ: "UTC" }),
    shell: false,
    timeoutMs: NODE_TOOLCHAIN_PRIVATE_TREE_EXTRACT_TIMEOUT_MS_V2,
    maxStdoutBytes: NODE_TOOLCHAIN_PRIVATE_TREE_EXTRACT_MAX_STDOUT_BYTES_V2,
    maxStderrBytes: NODE_TOOLCHAIN_PRIVATE_TREE_EXTRACT_MAX_STDERR_BYTES_V2,
  });
}

function productionExtractorAdapter(
  invocation: NodeToolchainPrivateTreeExtractionInvocationV2,
): Promise<NodeToolchainPrivateTreeExtractionResultV2> {
  return new Promise((resolve) => {
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let forcedStatus: "timed_out" | "output_limit_exceeded" | undefined;
    let settled = false;
    let child: ReturnType<typeof spawn>;
    let timer: NodeJS.Timeout | undefined;

    const captured = (): Readonly<{ stdout: string; stderr: string }> => Object.freeze({
      stdout: Buffer.concat(stdoutChunks, stdoutBytes).toString("utf8"),
      stderr: Buffer.concat(stderrChunks, stderrBytes).toString("utf8"),
    });
    const settle = (result: NodeToolchainPrivateTreeExtractionResultV2): void => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolve(Object.freeze(result));
    };
    const terminateFor = (status: "timed_out" | "output_limit_exceeded"): void => {
      if (forcedStatus !== undefined) return;
      forcedStatus = status;
      child.kill("SIGKILL");
    };

    try {
      child = spawn(invocation.executable, [...invocation.argv], {
        cwd: invocation.cwd,
        env: { ...invocation.env },
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
    } catch (error) {
      resolve(Object.freeze({
        status: "spawn_failed",
        stdout: "",
        stderr: error instanceof Error ? error.message : "spawn failed",
      }));
      return;
    }
    timer = setTimeout(() => terminateFor("timed_out"), invocation.timeoutMs);
    child.stdout!.on("data", (chunk: Buffer) => {
      if (forcedStatus !== undefined) return;
      if (stdoutBytes + chunk.byteLength > invocation.maxStdoutBytes) {
        terminateFor("output_limit_exceeded");
        return;
      }
      stdoutChunks.push(Buffer.from(chunk));
      stdoutBytes += chunk.byteLength;
    });
    child.stderr!.on("data", (chunk: Buffer) => {
      if (forcedStatus !== undefined) return;
      if (stderrBytes + chunk.byteLength > invocation.maxStderrBytes) {
        terminateFor("output_limit_exceeded");
        return;
      }
      stderrChunks.push(Buffer.from(chunk));
      stderrBytes += chunk.byteLength;
    });
    child.once("error", (error) => {
      const output = captured();
      settle({ status: "spawn_failed", stdout: output.stdout, stderr: output.stderr || error.message });
    });
    child.once("close", (exitCode, signal) => {
      const output = captured();
      if (forcedStatus !== undefined) {
        settle({ status: forcedStatus, stdout: output.stdout, stderr: output.stderr });
        return;
      }
      settle({
        status: "exited",
        exitCode,
        signal: signal ?? null,
        stdout: output.stdout,
        stderr: output.stderr,
      });
    });
  });
}

function assertExtractionSucceeded(
  result: NodeToolchainPrivateTreeExtractionResultV2,
): asserts result is Extract<NodeToolchainPrivateTreeExtractionResultV2, { status: "exited" }> {
  if (
    Buffer.byteLength(result.stdout, "utf8") > NODE_TOOLCHAIN_PRIVATE_TREE_EXTRACT_MAX_STDOUT_BYTES_V2
    || Buffer.byteLength(result.stderr, "utf8") > NODE_TOOLCHAIN_PRIVATE_TREE_EXTRACT_MAX_STDERR_BYTES_V2
  ) {
    fail("NODE_TOOLCHAIN_PRIVATE_TREE_V2_EXTRACT_OUTPUT_LIMIT", "Archive extraction exceeded its output bound");
  }
  switch (result.status) {
    case "output_limit_exceeded":
      fail("NODE_TOOLCHAIN_PRIVATE_TREE_V2_EXTRACT_OUTPUT_LIMIT", "Archive extraction exceeded its output bound");
    case "timed_out":
      fail("NODE_TOOLCHAIN_PRIVATE_TREE_V2_EXTRACT_TIMEOUT", "Archive extraction exceeded its exact timeout");
    case "spawn_failed":
      fail("NODE_TOOLCHAIN_PRIVATE_TREE_V2_EXTRACT_SPAWN_FAILED", "Exact bsdtar extraction could not spawn");
    case "exited":
      break;
  }
  if (result.signal !== null) {
    fail("NODE_TOOLCHAIN_PRIVATE_TREE_V2_EXTRACT_SIGNALLED", "Archive extraction terminated by signal");
  }
  if (result.exitCode !== 0) {
    fail("NODE_TOOLCHAIN_PRIVATE_TREE_V2_EXTRACT_NONZERO", "Archive extraction exited nonzero");
  }
  if (result.stdout !== "" || result.stderr !== "") {
    fail("NODE_TOOLCHAIN_PRIVATE_TREE_V2_EXTRACT_MALFORMED", "Successful archive extraction wrote output");
  }
}

function validateTreeLocator(
  locator: string,
  errorCode:
    | "NODE_TOOLCHAIN_PRIVATE_TREE_V2_RAW_TREE_INVALID"
    | "NODE_TOOLCHAIN_PRIVATE_TREE_V2_NORMALIZED_TREE_INVALID",
): void {
  const segments = locator === "." ? [] : locator.split("/");
  if (
    (locator !== "." && (segments.length < 1 || segments.length > MAX_TREE_DEPTH_V2))
    || segments.some((segment) => !/^[A-Za-z0-9._@+-]+$/.test(segment))
  ) {
    fail(errorCode, "Materialized tree locator is not canonical");
  }
}

function readStableFile(input: Readonly<{
  absolutePath: string;
  expectedFingerprint?: FileFingerprintV2;
  maxBytes: number;
  errorCode:
    | "NODE_TOOLCHAIN_PRIVATE_TREE_V2_STAGE_INVALID"
    | "NODE_TOOLCHAIN_PRIVATE_TREE_V2_RAW_TREE_INVALID"
    | "NODE_TOOLCHAIN_PRIVATE_TREE_V2_NORMALIZED_TREE_INVALID";
}>): Readonly<{
  fingerprint: FileFingerprintV2;
  contentHash: string;
  bytes: Buffer;
}> {
  let descriptor: number | undefined;
  try {
    const pathBefore = lstatSync(input.absolutePath, { bigint: true });
    if (
      pathBefore.isSymbolicLink()
      || !pathBefore.isFile()
      || pathBefore.nlink !== 1n
      || pathBefore.size < 0n
      || pathBefore.size > BigInt(input.maxBytes)
    ) {
      return fail(input.errorCode, "Materialized file is not one bounded single-link regular file");
    }
    descriptor = openSync(
      input.absolutePath,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
    const before = fstatSync(descriptor, { bigint: true });
    if (
      !sameFingerprint(fingerprint(pathBefore), fingerprint(before))
      || (input.expectedFingerprint
        && !sameFingerprint(fingerprint(before), input.expectedFingerprint))
    ) {
      return fail(input.errorCode, "Materialized file changed before its exact read");
    }
    if (before.size > BigInt(Number.MAX_SAFE_INTEGER)) {
      return fail(input.errorCode, "Materialized file length cannot be represented safely");
    }
    const byteLength = Number(before.size);
    const bytes = Buffer.allocUnsafeSlow(byteLength);
    let offset = 0;
    while (offset < bytes.byteLength) {
      const bytesRead = readSync(descriptor, bytes, offset, bytes.byteLength - offset, null);
      if (bytesRead < 1) return fail(input.errorCode, "Materialized file ended before its exact length");
      offset += bytesRead;
    }
    const eof = Buffer.allocUnsafe(1);
    if (readSync(descriptor, eof, 0, 1, null) !== 0) {
      return fail(input.errorCode, "Materialized file exceeded its exact length");
    }
    const after = fstatSync(descriptor, { bigint: true });
    const pathAfter = lstatSync(input.absolutePath, { bigint: true });
    if (
      !sameFingerprint(fingerprint(before), fingerprint(after))
      || !sameFingerprint(fingerprint(after), fingerprint(pathAfter))
    ) {
      return fail(input.errorCode, "Materialized file changed during its exact read");
    }
    return Object.freeze({
      fingerprint: fingerprint(after),
      contentHash: sha256(bytes),
      bytes,
    });
  } catch (error) {
    if (error instanceof NodeToolchainPrivateTreeErrorV2) throw error;
    return fail(input.errorCode, "Materialized file could not be read exactly", error);
  } finally {
    closeQuietly(descriptor);
  }
}

function captureRawTree(input: Readonly<{
  rawRoot: string;
  selectedMembers: readonly NodeToolchainSelectedArchiveMemberV2[];
}>): readonly RawFileV2[] {
  const expected = new Map(input.selectedMembers.map((member) => [member.archiveLocator, member]));
  const observed = new Map<string, "file" | "directory">();
  const files: RawFileV2[] = [];
  let totalBytes = 0;
  let directoryCount = 0;

  const visit = (absoluteDirectory: string, parentLocator: string | null): void => {
    const before = lstatSync(absoluteDirectory, { bigint: true });
    if (before.isSymbolicLink() || !before.isDirectory()) {
      fail("NODE_TOOLCHAIN_PRIVATE_TREE_V2_RAW_TREE_INVALID", "Raw extraction contains a non-directory parent");
    }
    const namesBefore = readdirSync(absoluteDirectory).sort();
    for (const name of namesBefore) {
      const locator = parentLocator === null ? name : `${parentLocator}/${name}`;
      validateTreeLocator(
        locator.replace(/^[^/]+\/?/, "") || ".",
        "NODE_TOOLCHAIN_PRIVATE_TREE_V2_RAW_TREE_INVALID",
      );
      if (observed.has(locator)) {
        fail("NODE_TOOLCHAIN_PRIVATE_TREE_V2_RAW_TREE_INVALID", "Raw extraction contains a duplicate locator");
      }
      const expectedMember = expected.get(locator);
      if (!expectedMember) {
        fail("NODE_TOOLCHAIN_PRIVATE_TREE_V2_RAW_TREE_INVALID", "Raw extraction contains an unselected member");
      }
      const absolutePath = path.join(absoluteDirectory, name);
      const stat = lstatSync(absolutePath, { bigint: true });
      if (stat.isSymbolicLink()) {
        fail("NODE_TOOLCHAIN_PRIVATE_TREE_V2_RAW_TREE_INVALID", "Raw extraction contains a symbolic link");
      }
      if (stat.isDirectory()) {
        if (expectedMember.type !== "directory") {
          fail("NODE_TOOLCHAIN_PRIVATE_TREE_V2_RAW_TREE_INVALID", "Raw extraction member type changed");
        }
        directoryCount += 1;
        if (directoryCount > NODE_TOOLCHAIN_PRIVATE_TREE_MAX_DIRECTORIES_V2 + 1) {
          fail("NODE_TOOLCHAIN_PRIVATE_TREE_V2_RAW_TREE_INVALID", "Raw extraction directory bound exceeded");
        }
        observed.set(locator, "directory");
        visit(absolutePath, locator);
        continue;
      }
      if (!stat.isFile() || stat.nlink !== 1n || expectedMember.type !== "file") {
        fail("NODE_TOOLCHAIN_PRIVATE_TREE_V2_RAW_TREE_INVALID", "Raw extraction contains a hard link or special entry");
      }
      if (files.length >= NODE_TOOLCHAIN_PRIVATE_TREE_MAX_FILES_V2) {
        fail("NODE_TOOLCHAIN_PRIVATE_TREE_V2_RAW_TREE_INVALID", "Raw extraction file bound exceeded");
      }
      const captured = readStableFile({
        absolutePath,
        maxBytes: NODE_TOOLCHAIN_PRIVATE_TREE_MAX_TOTAL_BYTES_V2,
        errorCode: "NODE_TOOLCHAIN_PRIVATE_TREE_V2_RAW_TREE_INVALID",
      });
      totalBytes += captured.bytes.byteLength;
      if (totalBytes > NODE_TOOLCHAIN_PRIVATE_TREE_MAX_TOTAL_BYTES_V2) {
        fail("NODE_TOOLCHAIN_PRIVATE_TREE_V2_RAW_TREE_INVALID", "Raw extraction total-byte bound exceeded");
      }
      observed.set(locator, "file");
      files.push(Object.freeze({
        archiveLocator: locator,
        treeLocator: expectedMember.treeLocator,
        targetMode: expectedMember.targetMode,
        fingerprint: captured.fingerprint,
        contentHash: captured.contentHash,
        bytes: captured.bytes,
      }));
    }
    const after = lstatSync(absoluteDirectory, { bigint: true });
    const namesAfter = readdirSync(absoluteDirectory).sort();
    if (
      !sameFingerprint(fingerprint(before), fingerprint(after))
      || namesBefore.length !== namesAfter.length
      || namesBefore.some((name, index) => name !== namesAfter[index])
    ) {
      fail("NODE_TOOLCHAIN_PRIVATE_TREE_V2_RAW_TREE_INVALID", "Raw extraction changed during capture");
    }
  };

  try {
    visit(input.rawRoot, null);
    if (
      observed.size !== expected.size
      || [...expected].some(([locator, member]) => observed.get(locator) !== member.type)
    ) {
      fail("NODE_TOOLCHAIN_PRIVATE_TREE_V2_RAW_TREE_INVALID", "Raw extraction is missing a selected member");
    }
    return Object.freeze(files.sort((left, right) => left.treeLocator < right.treeLocator ? -1 : 1));
  } catch (error) {
    for (const file of files) file.bytes.fill(0);
    throw error;
  }
}

function materializeNormalizedTree(input: Readonly<{
  treeRoot: string;
  selectedMembers: readonly NodeToolchainSelectedArchiveMemberV2[];
  rawFiles: readonly RawFileV2[];
}>): void {
  const directories = input.selectedMembers
    .filter((member) => member.type === "directory" && member.treeLocator !== ".")
    .sort((left, right) => {
      const depth = left.treeLocator.split("/").length - right.treeLocator.split("/").length;
      return depth !== 0 ? depth : left.treeLocator < right.treeLocator ? -1 : 1;
    });
  for (const directory of directories) {
    mkdirSync(path.join(input.treeRoot, directory.treeLocator), { mode: 0o700 });
  }
  for (const file of input.rawFiles) {
    const absolutePath = path.join(input.treeRoot, file.treeLocator);
    const written = writeExclusiveFile({
      absolutePath,
      bytes: file.bytes,
      mode: file.targetMode === "0555" ? 0o555 : 0o444,
      errorCode: "NODE_TOOLCHAIN_PRIVATE_TREE_V2_NORMALIZED_TREE_INVALID",
    });
    if (sha256(file.bytes) !== file.contentHash || written.byteLength !== BigInt(file.bytes.byteLength)) {
      fail("NODE_TOOLCHAIN_PRIVATE_TREE_V2_NORMALIZED_TREE_INVALID", "Normalized file differs from raw capture");
    }
  }
  for (const directory of [...directories].reverse()) {
    const absolutePath = path.join(input.treeRoot, directory.treeLocator);
    chmodSync(absolutePath, 0o555);
    syncDirectory(absolutePath);
  }
  chmodSync(input.treeRoot, 0o555);
  syncDirectory(input.treeRoot);
}

function captureNormalizedTree(input: Readonly<{
  treeRoot: string;
  selectedMembers: readonly NodeToolchainSelectedArchiveMemberV2[];
  expectedFiles?: ReadonlyMap<string, Readonly<{ contentHash: string; byteLength: number }>>;
}>): Readonly<{
  entries: readonly NormalizedEntryV2[];
  fileBuffers: ReadonlyMap<string, Buffer>;
}> {
  const expected = new Map(input.selectedMembers.map((member) => [member.treeLocator, member]));
  const entries: NormalizedEntryV2[] = [];
  const fileBuffers = new Map<string, Buffer>();
  let totalBytes = 0;

  const visit = (absoluteDirectory: string, locator: "." | string): void => {
    const expectedDirectory = expected.get(locator);
    const before = lstatSync(absoluteDirectory, { bigint: true });
    if (
      !expectedDirectory
      || expectedDirectory.type !== "directory"
      || before.isSymbolicLink()
      || !before.isDirectory()
      || modeBits(before) !== 0o555n
    ) {
      fail("NODE_TOOLCHAIN_PRIVATE_TREE_V2_NORMALIZED_TREE_INVALID", "Normalized directory identity is invalid");
    }
    entries.push(Object.freeze({
      locator,
      type: "directory",
      mode: "0555",
      fingerprint: fingerprint(before),
      byteLength: 0,
      contentHash: null,
    }));
    const namesBefore = readdirSync(absoluteDirectory).sort();
    for (const name of namesBefore) {
      const childLocator = locator === "." ? name : `${locator}/${name}`;
      validateTreeLocator(childLocator, "NODE_TOOLCHAIN_PRIVATE_TREE_V2_NORMALIZED_TREE_INVALID");
      const expectedMember = expected.get(childLocator);
      if (!expectedMember) {
        fail("NODE_TOOLCHAIN_PRIVATE_TREE_V2_NORMALIZED_TREE_INVALID", "Normalized tree contains an extra member");
      }
      const absolutePath = path.join(absoluteDirectory, name);
      const stat = lstatSync(absolutePath, { bigint: true });
      if (stat.isDirectory()) {
        if (expectedMember.type !== "directory") {
          fail("NODE_TOOLCHAIN_PRIVATE_TREE_V2_NORMALIZED_TREE_INVALID", "Normalized member type changed");
        }
        visit(absolutePath, childLocator);
        continue;
      }
      if (
        expectedMember.type !== "file"
        || stat.isSymbolicLink()
        || !stat.isFile()
        || stat.nlink !== 1n
        || modeText(modeBits(stat)) !== expectedMember.targetMode
      ) {
        fail("NODE_TOOLCHAIN_PRIVATE_TREE_V2_NORMALIZED_TREE_INVALID", "Normalized file identity is invalid");
      }
      const captured = readStableFile({
        absolutePath,
        maxBytes: NODE_TOOLCHAIN_PRIVATE_TREE_MAX_TOTAL_BYTES_V2,
        errorCode: "NODE_TOOLCHAIN_PRIVATE_TREE_V2_NORMALIZED_TREE_INVALID",
      });
      const expectedFile = input.expectedFiles?.get(childLocator);
      if (expectedFile && (
        expectedFile.contentHash !== captured.contentHash
        || expectedFile.byteLength !== captured.bytes.byteLength
      )) {
        captured.bytes.fill(0);
        fail("NODE_TOOLCHAIN_PRIVATE_TREE_V2_NORMALIZED_TREE_INVALID", "Normalized file bytes differ from raw capture");
      }
      totalBytes += captured.bytes.byteLength;
      if (totalBytes > NODE_TOOLCHAIN_PRIVATE_TREE_MAX_TOTAL_BYTES_V2) {
        captured.bytes.fill(0);
        fail("NODE_TOOLCHAIN_PRIVATE_TREE_V2_NORMALIZED_TREE_INVALID", "Normalized tree byte bound exceeded");
      }
      entries.push(Object.freeze({
        locator: childLocator,
        type: "file",
        mode: expectedMember.targetMode,
        fingerprint: captured.fingerprint,
        byteLength: captured.bytes.byteLength,
        contentHash: captured.contentHash,
      }));
      fileBuffers.set(childLocator, captured.bytes);
    }
    const after = lstatSync(absoluteDirectory, { bigint: true });
    const namesAfter = readdirSync(absoluteDirectory).sort();
    if (
      !sameFingerprint(fingerprint(before), fingerprint(after))
      || namesBefore.length !== namesAfter.length
      || namesBefore.some((name, index) => name !== namesAfter[index])
    ) {
      fail("NODE_TOOLCHAIN_PRIVATE_TREE_V2_NORMALIZED_TREE_INVALID", "Normalized directory changed during capture");
    }
  };

  try {
    visit(input.treeRoot, ".");
    if (entries.length !== expected.size) {
      fail("NODE_TOOLCHAIN_PRIVATE_TREE_V2_NORMALIZED_TREE_INVALID", "Normalized tree is missing a selected member");
    }
    entries.sort((left, right) => left.locator < right.locator ? -1 : 1);
    return Object.freeze({ entries: Object.freeze(entries), fileBuffers });
  } catch (error) {
    for (const bytes of fileBuffers.values()) bytes.fill(0);
    throw error;
  }
}

function exactFile<const ModeV2 extends "0444" | "0555">(
  entry: NormalizedEntryV2,
  expectedMode: ModeV2,
): Readonly<{ contentHash: string; byteLength: number; mode: ModeV2; linkCount: 1 }> {
  if (entry.type !== "file" || entry.contentHash === null || entry.mode !== expectedMode) {
    return fail("NODE_TOOLCHAIN_PRIVATE_TREE_V2_RECEIPT_INVALID", "Receipt file projection is not a file");
  }
  return Object.freeze({
    contentHash: entry.contentHash,
    byteLength: entry.byteLength,
    mode: expectedMode,
    linkCount: 1,
  });
}

function treeContentHash(entries: readonly NormalizedEntryV2[], schema: string): string {
  return hashCanonicalJson({
    schema,
    entries: entries.map((entry) => ({
      locator: entry.locator,
      type: entry.type,
      mode: entry.mode,
      ...(entry.type === "file"
        ? { byteLength: entry.byteLength, contentHash: entry.contentHash }
        : {}),
    })),
  });
}

function buildReceipt(input: Readonly<{
  inventory: ReturnType<typeof inspectNodeToolchainArchiveInventoryReceiptV2>;
  selectedMembers: readonly NodeToolchainSelectedArchiveMemberV2[];
  entries: readonly NormalizedEntryV2[];
}>): NodeToolchainPrivateTreeReceiptV2 {
  const byLocator = new Map(input.entries.map((entry) => [entry.locator, entry]));
  const node = byLocator.get("bin/node");
  const npmRoot = byLocator.get("lib/node_modules/npm");
  const npmCli = byLocator.get("lib/node_modules/npm/bin/npm-cli.js");
  const packageJson = byLocator.get("lib/node_modules/npm/package.json");
  if (!node || !npmRoot || !npmCli || !packageJson || npmRoot.type !== "directory") {
    return fail("NODE_TOOLCHAIN_PRIVATE_TREE_V2_RECEIPT_INVALID", "Normalized tree lacks required Node/npm identity");
  }
  const files = input.entries.filter((entry) => entry.type === "file");
  const directories = input.entries.filter((entry) => entry.type === "directory" && entry.locator !== ".");
  const npmPrefix = "lib/node_modules/npm";
  const npmEntries = input.entries
    .filter((entry) => entry.locator === npmPrefix || entry.locator.startsWith(`${npmPrefix}/`))
    .map((entry): NormalizedEntryV2 => Object.freeze({
      ...entry,
      locator: entry.locator === npmPrefix ? "." : entry.locator.slice(npmPrefix.length + 1),
    }));
  const npmFiles = npmEntries.filter((entry) => entry.type === "file");
  const npmDirectories = npmEntries.filter((entry) => entry.type === "directory" && entry.locator !== ".");
  const selectedMemberListHash = hashCanonicalJson({
    schema: "setfarm.node-toolchain-selected-materialization-member-list.v2",
    members: input.selectedMembers,
  });
  const identity: NodeToolchainPrivateTreeReceiptHashPayloadV2 = {
    schema: NODE_TOOLCHAIN_PRIVATE_TREE_RECEIPT_V2_SCHEMA,
    receiptVersion: NODE_TOOLCHAIN_PRIVATE_TREE_VERSION_V2,
    authorityRef: NODE_TOOLCHAIN_PRIVATE_TREE_AUTHORITY_REF_V2,
    authorityVersion: NODE_TOOLCHAIN_PRIVATE_TREE_VERSION_V2,
    status: "materialized_verified",
    admissionScope: input.inventory.admissionScope,
    inventory: input.inventory,
    materializer: {
      contractRef: "NODE_TOOLCHAIN_SELECTED_PRIVATE_MATERIALIZER_V2",
      extractionToolRef: "MACOS_BSDTAR_V2",
      extractionToolContentHash: input.inventory.tarTool.contentHash,
      extractionPolicy: "nul_exact_member_list_no_recursion_private_scratch_v2",
      selectedMemberCount: input.selectedMembers.length,
      selectedMemberListHash,
      normalizationPolicy: "exclusive_copy_0444_0555_fsync_fresh_read_v2",
      filesystemProtection: "private_0700_parent_process_owned_v2",
    },
    tree: {
      rootMode: "0555",
      fileCount: files.length,
      directoryCount: directories.length,
      totalBytes: files.reduce((sum, entry) => sum + entry.byteLength, 0),
      treeHash: treeContentHash(input.entries, "setfarm.node-toolchain-normalized-private-tree.v2"),
      node: { locator: "bin/node", ...exactFile(node, "0555") },
      npm: {
        rootLocator: "lib/node_modules/npm",
        rootMode: "0555",
        fileCount: npmFiles.length,
        directoryCount: npmDirectories.length,
        totalBytes: npmFiles.reduce((sum, entry) => sum + entry.byteLength, 0),
        treeHash: treeContentHash(npmEntries, "setfarm.node-toolchain-normalized-npm-tree.v2"),
        cli: { locator: "bin/npm-cli.js", ...exactFile(npmCli, "0555") },
        packageJson: { locator: "package.json", ...exactFile(packageJson, "0444") },
        builtinNpmrc: { locator: "npmrc", status: "absent" },
      },
    },
  };
  const parsed = NodeToolchainPrivateTreeReceiptV2Schema.safeParse({
    ...identity,
    receiptHash: hashNodeToolchainPrivateTreeReceiptV2(identity),
  });
  if (!parsed.success) {
    return fail(
      "NODE_TOOLCHAIN_PRIVATE_TREE_V2_RECEIPT_INVALID",
      "Fresh normalized Node private tree receipt failed its canonical schema",
      parsed.error,
    );
  }
  return deepFreezeJson(parsed.data);
}

function verifyStageFile(input: Readonly<{
  absolutePath: string;
  expectedFingerprint: FileFingerprintV2;
  expectedHash: string;
}>): void {
  const captured = readStableFile({
    absolutePath: input.absolutePath,
    expectedFingerprint: input.expectedFingerprint,
    maxBytes: NODE_TOOLCHAIN_PRIVATE_TREE_MAX_TOTAL_BYTES_V2,
    errorCode: "NODE_TOOLCHAIN_PRIVATE_TREE_V2_STAGE_INVALID",
  });
  try {
    if (captured.contentHash !== input.expectedHash) {
      fail("NODE_TOOLCHAIN_PRIVATE_TREE_V2_STAGE_INVALID", "Materialization stage input changed during extraction");
    }
  } finally {
    captured.bytes.fill(0);
  }
}

function cleanupInputs(
  stage: StageV2,
  selectedMembers: readonly NodeToolchainSelectedArchiveMemberV2[],
): void {
  try {
    chmodSync(stage.rawRoot, 0o700);
    const directories = selectedMembers
      .filter((member) => member.type === "directory")
      .sort((left, right) => left.archiveLocator.split("/").length
        - right.archiveLocator.split("/").length);
    for (const directory of directories) {
      chmodSync(path.join(stage.rawRoot, directory.archiveLocator), 0o700);
    }
    rmSync(stage.rawRoot, { recursive: true, force: false });
    unlinkSync(stage.selectionPath);
    unlinkSync(stage.archivePath);
    syncDirectory(stage.stageRoot);
  } catch (error) {
    return fail(
      "NODE_TOOLCHAIN_PRIVATE_TREE_V2_CLEANUP_FAILED",
      "Private extraction inputs could not be removed exactly",
      error,
    );
  }
}

async function materialize(input: Readonly<{
  inventoryHandle: InventoriedNodeToolchainDistributionV2;
  extractorAdapter: NodeToolchainPrivateTreeExtractorAdapterV2;
  stagePrefix: string;
  testHooks?: TestHooksV2;
}>): Promise<MaterializedNodeToolchainPrivateTreeV2> {
  const source = await copyInventoriedNodeToolchainMaterializationSourceV2(input.inventoryHandle);
  let stage: StageV2 | undefined;
  let completed = false;
  let rawFiles: readonly RawFileV2[] = [];
  try {
    stage = createStage({
      archiveBytes: source.archiveBytes,
      archiveSha256: source.receipt.distribution.archive.sha256,
      selectedMembers: source.selectedMembers,
      stagePrefix: input.stagePrefix,
    });
    let extraction: NodeToolchainPrivateTreeExtractionResultV2;
    try {
      extraction = await input.extractorAdapter(immutableExtractionInvocation(stage));
    } catch (error) {
      return fail(
        "NODE_TOOLCHAIN_PRIVATE_TREE_V2_EXTRACT_SPAWN_FAILED",
        "Archive extractor adapter failed before returning bounded evidence",
        error,
      );
    }
    assertExtractionSucceeded(extraction);
    await revalidateInventoriedNodeToolchainMaterializationAuthorityV2(input.inventoryHandle);
    verifyStageFile({
      absolutePath: stage.archivePath,
      expectedFingerprint: stage.archiveFingerprint,
      expectedHash: source.receipt.distribution.archive.sha256,
    });
    verifyStageFile({
      absolutePath: stage.selectionPath,
      expectedFingerprint: stage.selectionFingerprint,
      expectedHash: stage.selectionBytesHash,
    });
    const rawArchiveRoot = path.join(stage.rawRoot, source.receipt.distribution.artifact.archiveRoot);
    await input.testHooks?.afterExtraction?.({ rawRoot: stage.rawRoot, rawArchiveRoot });
    rawFiles = captureRawTree({ rawRoot: stage.rawRoot, selectedMembers: source.selectedMembers });
    const expectedFiles = new Map(rawFiles.map((file) => [file.treeLocator, {
      contentHash: file.contentHash,
      byteLength: file.bytes.byteLength,
    }]));
    materializeNormalizedTree({
      treeRoot: stage.treeRoot,
      selectedMembers: source.selectedMembers,
      rawFiles,
    });
    cleanupInputs(stage, source.selectedMembers);
    await input.testHooks?.afterNormalized?.({ treeRoot: stage.treeRoot });
    const captured = captureNormalizedTree({
      treeRoot: stage.treeRoot,
      selectedMembers: source.selectedMembers,
      expectedFiles,
    });
    try {
      const receipt = buildReceipt({
        inventory: source.receipt,
        selectedMembers: source.selectedMembers,
        entries: captured.entries,
      });
      const stageRootFingerprint = fingerprint(lstatSync(stage.stageRoot, { bigint: true }));
      if (
        modeBits(stageRootFingerprint) !== 0o700n
        || readdirSync(stage.stageRoot).length !== 1
        || readdirSync(stage.stageRoot)[0] !== path.basename(stage.treeRoot)
      ) {
        return fail(
          "NODE_TOOLCHAIN_PRIVATE_TREE_V2_STAGE_INVALID",
          "Private normalized tree parent lost its exact ownership boundary",
        );
      }
      const state: PrivateTreeStateV2 = Object.freeze({
        stageRoot: stage.stageRoot,
        stageRootFingerprint,
        treeRoot: stage.treeRoot,
        entries: captured.entries,
        receipt,
      });
      completed = true;
      return new MaterializedNodeToolchainPrivateTreeV2(handleConstructorCapabilityV2, state);
    } finally {
      for (const bytes of captured.fileBuffers.values()) bytes.fill(0);
    }
  } finally {
    source.archiveBytes.fill(0);
    for (const file of rawFiles) file.bytes.fill(0);
    if (!completed) removeStageBestEffort(stage?.stageRoot, input.stagePrefix);
  }
}

export async function materializeInventoriedNodeToolchainPrivateTreeV2(
  inventoryHandle: InventoriedNodeToolchainDistributionV2,
): Promise<MaterializedNodeToolchainPrivateTreeV2> {
  return materialize({
    inventoryHandle,
    extractorAdapter: productionExtractorAdapter,
    stagePrefix: PRIVATE_ROOT_PREFIX_V2,
  });
}

function testStagePrefix(scratchParent: string | undefined): string {
  if (scratchParent === undefined) return PRIVATE_ROOT_PREFIX_V2;
  if (
    typeof scratchParent !== "string"
    || !path.isAbsolute(scratchParent)
    || path.normalize(scratchParent) !== scratchParent
    || scratchParent.includes("\0")
  ) {
    return fail(
      "NODE_TOOLCHAIN_PRIVATE_TREE_V2_INPUT_INVALID",
      "Test private-tree scratch parent must be one normalized absolute path",
    );
  }
  const stat = lstatSync(scratchParent, { bigint: true });
  const expectedUid = typeof process.geteuid === "function" ? process.geteuid() : undefined;
  const expectedGid = typeof process.getegid === "function" ? process.getegid() : undefined;
  if (
    stat.isSymbolicLink()
    || !stat.isDirectory()
    || modeBits(stat) !== 0o700n
    || expectedUid === undefined
    || expectedGid === undefined
    || stat.uid !== BigInt(expectedUid)
    || stat.gid !== BigInt(expectedGid)
  ) {
    return fail(
      "NODE_TOOLCHAIN_PRIVATE_TREE_V2_INPUT_INVALID",
      "Test private-tree scratch parent must be one direct process-owned 0700 directory",
    );
  }
  return path.join(scratchParent, "setfarm-node-toolchain-tree-v2-");
}

export async function materializeInventoriedNodeToolchainPrivateTreeV2ForTest(
  inventoryHandle: InventoriedNodeToolchainDistributionV2,
  input: Readonly<{
    extractorAdapter?: NodeToolchainPrivateTreeExtractorAdapterV2;
    scratchParent?: string;
    testHooks?: TestHooksV2;
  }>,
): Promise<MaterializedNodeToolchainPrivateTreeV2> {
  const receipt = inspectNodeToolchainArchiveInventoryReceiptV2(inventoryHandle);
  if (receipt.admissionScope !== "test_fixture" || !input || typeof input !== "object") {
    return fail(
      "NODE_TOOLCHAIN_PRIVATE_TREE_V2_INPUT_INVALID",
      "Test private tree materialization requires one test-fixture inventory",
    );
  }
  return materialize({
    inventoryHandle,
    extractorAdapter: input.extractorAdapter ?? productionExtractorAdapter,
    stagePrefix: testStagePrefix(input.scratchParent),
    ...(input.testHooks ? { testHooks: input.testHooks } : {}),
  });
}

function authenticState(handle: MaterializedNodeToolchainPrivateTreeV2): PrivateTreeStateV2 {
  if (
    typeof handle !== "object"
    || handle === null
    || isProxy(handle)
    || Object.getPrototypeOf(handle) !== MaterializedNodeToolchainPrivateTreeV2.prototype
  ) {
    return fail(
      "NODE_TOOLCHAIN_PRIVATE_TREE_V2_HANDLE_UNAUTHENTICATED",
      "Node private tree operation requires one authentic handle",
    );
  }
  if (disposedTreeHandlesV2.has(handle)) {
    return fail(
      "NODE_TOOLCHAIN_PRIVATE_TREE_V2_HANDLE_DISPOSED",
      "Materialized Node private tree has already been disposed",
    );
  }
  const state = privateTreeStateV2.get(handle);
  if (!state) {
    return fail(
      "NODE_TOOLCHAIN_PRIVATE_TREE_V2_HANDLE_UNAUTHENTICATED",
      "Node private tree operation requires one authentic handle",
    );
  }
  return state;
}

export function inspectNodeToolchainPrivateTreeReceiptV2(
  handle: MaterializedNodeToolchainPrivateTreeV2,
): NodeToolchainPrivateTreeReceiptV2 {
  return defensiveReceiptCopy(authenticState(handle).receipt);
}

function revalidatePrivateTree(state: PrivateTreeStateV2): Readonly<{
  entries: readonly NormalizedEntryV2[];
  fileBuffers: ReadonlyMap<string, Buffer>;
}> {
  const stage = fingerprint(lstatSync(state.stageRoot, { bigint: true }));
  if (
    !sameFingerprint(stage, state.stageRootFingerprint)
    || modeBits(stage) !== 0o700n
    || readdirSync(state.stageRoot).length !== 1
    || readdirSync(state.stageRoot)[0] !== path.basename(state.treeRoot)
  ) {
    return fail(
      "NODE_TOOLCHAIN_PRIVATE_TREE_V2_NORMALIZED_TREE_INVALID",
      "Private normalized tree parent changed after authority issuance",
    );
  }
  const selectedMembers = state.entries.map((entry): NodeToolchainSelectedArchiveMemberV2 => ({
    archiveLocator: entry.locator,
    treeLocator: entry.locator,
    type: entry.type,
    targetMode: entry.mode,
  }));
  const expectedFiles = new Map(state.entries
    .filter((entry) => entry.type === "file" && entry.contentHash !== null)
    .map((entry) => [entry.locator, {
      contentHash: entry.contentHash!,
      byteLength: entry.byteLength,
    }]));
  const captured = captureNormalizedTree({
    treeRoot: state.treeRoot,
    selectedMembers,
    expectedFiles,
  });
  if (
    captured.entries.length !== state.entries.length
    || captured.entries.some((entry, index) => {
      const expected = state.entries[index];
      return !expected
        || entry.locator !== expected.locator
        || entry.type !== expected.type
        || entry.mode !== expected.mode
        || !sameFingerprint(entry.fingerprint, expected.fingerprint);
    })
  ) {
    for (const bytes of captured.fileBuffers.values()) bytes.fill(0);
    return fail(
      "NODE_TOOLCHAIN_PRIVATE_TREE_V2_NORMALIZED_TREE_INVALID",
      "Private normalized tree filesystem identity changed after authority issuance",
    );
  }
  if (treeContentHash(captured.entries, "setfarm.node-toolchain-normalized-private-tree.v2")
    !== state.receipt.tree.treeHash) {
    for (const bytes of captured.fileBuffers.values()) bytes.fill(0);
    return fail(
      "NODE_TOOLCHAIN_PRIVATE_TREE_V2_NORMALIZED_TREE_INVALID",
      "Private normalized tree hash changed after authority issuance",
    );
  }
  return captured;
}

export async function copyMaterializedNodeToolchainPrivateTreeBundleV2(
  handle: MaterializedNodeToolchainPrivateTreeV2,
): Promise<NodeToolchainPrivateTreeBundleV2> {
  const state = authenticState(handle);
  const captured = revalidatePrivateTree(state);
  try {
    const entries = captured.entries.map((entry): NodeToolchainPrivateTreeBundleEntryV2 => Object.freeze({
      locator: entry.locator,
      type: entry.type,
      mode: entry.mode,
      byteLength: entry.byteLength,
      contentHash: entry.contentHash,
      bytes: entry.type === "file"
        ? Buffer.from(captured.fileBuffers.get(entry.locator)!)
        : null,
    }));
    return Object.freeze({
      receipt: defensiveReceiptCopy(state.receipt),
      entries: Object.freeze(entries),
    });
  } finally {
    for (const bytes of captured.fileBuffers.values()) bytes.fill(0);
  }
}

function cleanupAuthenticatedTree(state: PrivateTreeStateV2): void {
  try {
    const writableDirectories = state.entries
      .filter((entry) => entry.type === "directory")
      .sort((left, right) => left.locator.split("/").length - right.locator.split("/").length);
    for (const directory of writableDirectories) {
      chmodSync(
        directory.locator === "."
          ? state.treeRoot
          : path.join(state.treeRoot, directory.locator),
        0o700,
      );
    }
    const files = state.entries
      .filter((entry) => entry.type === "file")
      .sort((left, right) => right.locator.length - left.locator.length);
    for (const file of files) {
      const absolutePath = path.join(state.treeRoot, file.locator);
      assertExactObjectStableIdentityV2({
        absolutePath,
        expected: file.fingerprint,
        objectKind: "ordinary_file",
      });
      unlinkSync(absolutePath);
    }
    const directories = state.entries
      .filter((entry) => entry.type === "directory" && entry.locator !== ".")
      .sort((left, right) => right.locator.split("/").length - left.locator.split("/").length);
    for (const directory of directories) {
      const absolutePath = path.join(state.treeRoot, directory.locator);
      assertExactObjectStableIdentityV2({
        absolutePath,
        expected: directory.fingerprint,
        objectKind: "directory",
      });
      rmdirSync(absolutePath);
    }
    const treeRootEntry = state.entries.find(
      (entry) => entry.locator === "." && entry.type === "directory",
    );
    if (!treeRootEntry) {
      return fail(
        "NODE_TOOLCHAIN_PRIVATE_TREE_V2_CLEANUP_FAILED",
        "Private tree cleanup has no exact captured tree root identity",
      );
    }
    assertExactObjectStableIdentityV2({
      absolutePath: state.treeRoot,
      expected: treeRootEntry.fingerprint,
      objectKind: "directory",
    });
    rmdirSync(state.treeRoot);
    assertExactObjectStableIdentityV2({
      absolutePath: state.stageRoot,
      expected: state.stageRootFingerprint,
      objectKind: "directory",
    });
    rmdirSync(state.stageRoot);
  } catch (error) {
    return fail(
      "NODE_TOOLCHAIN_PRIVATE_TREE_V2_CLEANUP_FAILED",
      "Authenticated Node private tree could not be removed exactly",
      error,
    );
  }
}

export async function disposeMaterializedNodeToolchainPrivateTreeV2(
  handle: MaterializedNodeToolchainPrivateTreeV2,
): Promise<void> {
  if (
    typeof handle !== "object"
    || handle === null
    || isProxy(handle)
    || Object.getPrototypeOf(handle) !== MaterializedNodeToolchainPrivateTreeV2.prototype
  ) {
    return fail(
      "NODE_TOOLCHAIN_PRIVATE_TREE_V2_HANDLE_UNAUTHENTICATED",
      "Node private tree disposal requires one authentic handle",
    );
  }
  if (disposedTreeHandlesV2.has(handle)) return;
  const state = privateTreeStateV2.get(handle);
  if (!state) {
    return fail(
      "NODE_TOOLCHAIN_PRIVATE_TREE_V2_HANDLE_UNAUTHENTICATED",
      "Node private tree disposal requires one authentic handle",
    );
  }
  const captured = revalidatePrivateTree(state);
  for (const bytes of captured.fileBuffers.values()) bytes.fill(0);
  cleanupAuthenticatedTree(state);
  privateTreeStateV2.delete(handle);
  disposedTreeHandlesV2.add(handle);
}
