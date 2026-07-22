import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  closeSync,
  constants,
  fstatSync,
  fsyncSync,
  lstatSync,
  mkdtempSync,
  openSync,
  readSync,
  readdirSync,
  rmdirSync,
  unlinkSync,
  writeSync,
  type Stats,
} from "node:fs";
import path from "node:path";
import { isProxy } from "node:util/types";

import { hashCanonicalJson } from "./canonical-json.js";
import {
  copyVerifiedNodeToolchainDistributionArchiveBytesV2,
  inspectNodeToolchainDistributionVerificationReceiptV2,
  revalidateVerifiedNodeToolchainDistributionArchiveV2,
  type VerifiedNodeToolchainDistributionArchiveV2,
} from "./node-toolchain-distribution-authority-v2.js";
import {
  NODE_TOOLCHAIN_ARCHIVE_INVENTORY_AUTHORITY_REF_V2,
  NODE_TOOLCHAIN_ARCHIVE_INVENTORY_MAX_LISTING_BYTES_V2,
  NODE_TOOLCHAIN_ARCHIVE_INVENTORY_MAX_MEMBERS_V2,
  NODE_TOOLCHAIN_ARCHIVE_INVENTORY_MAX_STDERR_BYTES_V2,
  NODE_TOOLCHAIN_ARCHIVE_INVENTORY_RECEIPT_V2_SCHEMA,
  NODE_TOOLCHAIN_ARCHIVE_INVENTORY_TIMEOUT_MS_V2,
  NODE_TOOLCHAIN_ARCHIVE_INVENTORY_VERSION_V2,
  NodeToolchainArchiveInventoryReceiptV2Schema,
  hashNodeToolchainArchiveInventoryReceiptV2,
  type NodeToolchainArchiveInventoryReceiptHashPayloadV2,
  type NodeToolchainArchiveInventoryReceiptV2,
} from "./schemas/node-toolchain-archive-inventory-v2.js";

const BSDTAR_PATH_V2 = "/usr/bin/bsdtar" as const;
const PRIVATE_ROOT_PREFIX_V2 = "/private/tmp/setfarm-node-toolchain-inventory-v2-";
const MAX_MEMBER_PATH_BYTES_V2 = 1_024;
const MAX_MEMBER_SEGMENT_BYTES_V2 = 255;
const MAX_MEMBER_DEPTH_V2 = 64;

export type NodeToolchainArchiveInventoryErrorCodeV2 =
  | "NODE_TOOLCHAIN_ARCHIVE_V2_INPUT_INVALID"
  | "NODE_TOOLCHAIN_ARCHIVE_V2_PRIVATE_COPY_INVALID"
  | "NODE_TOOLCHAIN_ARCHIVE_V2_TAR_TOOL_INVALID"
  | "NODE_TOOLCHAIN_ARCHIVE_V2_TAR_TIMEOUT"
  | "NODE_TOOLCHAIN_ARCHIVE_V2_TAR_OUTPUT_LIMIT"
  | "NODE_TOOLCHAIN_ARCHIVE_V2_TAR_SPAWN_FAILED"
  | "NODE_TOOLCHAIN_ARCHIVE_V2_TAR_SIGNALLED"
  | "NODE_TOOLCHAIN_ARCHIVE_V2_TAR_NONZERO"
  | "NODE_TOOLCHAIN_ARCHIVE_V2_LISTING_MALFORMED"
  | "NODE_TOOLCHAIN_ARCHIVE_V2_MEMBER_BOUND_EXCEEDED"
  | "NODE_TOOLCHAIN_ARCHIVE_V2_PATH_INVALID"
  | "NODE_TOOLCHAIN_ARCHIVE_V2_DUPLICATE_MEMBER"
  | "NODE_TOOLCHAIN_ARCHIVE_V2_CASE_COLLISION"
  | "NODE_TOOLCHAIN_ARCHIVE_V2_SELECTED_TYPE_REJECTED"
  | "NODE_TOOLCHAIN_ARCHIVE_V2_SELECTED_CLOSURE_INCOMPLETE"
  | "NODE_TOOLCHAIN_ARCHIVE_V2_SELECTED_CLOSURE_UNEXPECTED"
  | "NODE_TOOLCHAIN_ARCHIVE_V2_RECEIPT_INVALID"
  | "NODE_TOOLCHAIN_ARCHIVE_V2_HANDLE_UNAUTHENTICATED"
  | "NODE_TOOLCHAIN_ARCHIVE_V2_CLEANUP_FAILED";

export class NodeToolchainArchiveInventoryErrorV2 extends Error {
  readonly code: NodeToolchainArchiveInventoryErrorCodeV2;
  override readonly cause?: unknown;

  constructor(
    code: NodeToolchainArchiveInventoryErrorCodeV2,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message.slice(0, 1_500), options);
    this.name = "NodeToolchainArchiveInventoryErrorV2";
    this.code = code;
    this.cause = options?.cause;
  }
}

export type NodeToolchainTarInventoryInvocationV2 = Readonly<{
  executable: typeof BSDTAR_PATH_V2;
  namesArgv: readonly ["-tf", string];
  verboseArgv: readonly ["-tvf", string];
  cwd: string;
  env: Readonly<Record<string, string>>;
  shell: false;
  timeoutMs: number;
  maxNamesBytes: number;
  maxVerboseBytes: number;
  maxStderrBytes: number;
}>;

export type NodeToolchainTarInventoryResultV2 =
  | Readonly<{
    status: "exited";
    exitCode: number | null;
    signal: string | null;
    namesOutput: string;
    verboseOutput: string;
    stderr: string;
  }>
  | Readonly<{
    status: "timed_out" | "output_limit_exceeded" | "spawn_failed";
    namesOutput: string;
    verboseOutput: string;
    stderr: string;
  }>;

export type NodeToolchainTarInventoryAdapterV2 = (
  invocation: NodeToolchainTarInventoryInvocationV2,
) => Promise<NodeToolchainTarInventoryResultV2>;

type FileFingerprintV2 = Readonly<{
  device: number;
  inode: number;
  mode: number;
  ownerUid: number;
  ownerGid: number;
  linkCount: number;
  byteLength: number;
  modifiedMs: number;
  changedMs: number;
}>;

type TarToolCaptureV2 = Readonly<{
  fingerprint: FileFingerprintV2;
  identity: NodeToolchainArchiveInventoryReceiptV2["tarTool"];
}>;

type ArchiveMemberTypeV2 = "file" | "directory" | "symlink" | "hard_link" | "special";
type ArchiveMemberModeClassV2 = "executable" | "non_executable" | "not_applicable";

type ArchiveMemberV2 = Readonly<{
  locator: string;
  type: ArchiveMemberTypeV2;
  modeClass: ArchiveMemberModeClassV2;
}>;

export type NodeToolchainSelectedArchiveMemberV2 = Readonly<{
  archiveLocator: string;
  treeLocator: "." | string;
  type: "file" | "directory";
  targetMode: "0444" | "0555";
}>;

export type NodeToolchainMaterializationSourceV2 = Readonly<{
  receipt: NodeToolchainArchiveInventoryReceiptV2;
  archiveBytes: Buffer;
  selectedMembers: readonly NodeToolchainSelectedArchiveMemberV2[];
}>;

type PrivateInventoryStateV2 = Readonly<{
  archive: VerifiedNodeToolchainDistributionArchiveV2;
  members: readonly ArchiveMemberV2[];
  selectedMembers: readonly ArchiveMemberV2[];
  receipt: NodeToolchainArchiveInventoryReceiptV2;
}>;

const handleConstructorCapabilityV2 = Object.freeze({});
const privateInventoryStateV2 = new WeakMap<object, PrivateInventoryStateV2>();

export class InventoriedNodeToolchainDistributionV2 {
  readonly receiptHash: string;

  constructor(capability: object, state: PrivateInventoryStateV2) {
    if (capability !== handleConstructorCapabilityV2) {
      throw new NodeToolchainArchiveInventoryErrorV2(
        "NODE_TOOLCHAIN_ARCHIVE_V2_HANDLE_UNAUTHENTICATED",
        "Inventoried Node distribution constructor capability is unavailable",
      );
    }
    this.receiptHash = state.receipt.receiptHash;
    privateInventoryStateV2.set(this, state);
    Object.freeze(this);
  }
}

function fail(
  code: NodeToolchainArchiveInventoryErrorCodeV2,
  message: string,
  cause?: unknown,
): never {
  throw new NodeToolchainArchiveInventoryErrorV2(
    code,
    message,
    cause === undefined ? undefined : { cause },
  );
}

function fingerprint(stat: Stats): FileFingerprintV2 {
  return Object.freeze({
    device: stat.dev,
    inode: stat.ino,
    mode: stat.mode,
    ownerUid: stat.uid,
    ownerGid: stat.gid,
    linkCount: stat.nlink,
    byteLength: stat.size,
    modifiedMs: stat.mtimeMs,
    changedMs: stat.ctimeMs,
  });
}

function sameFingerprint(left: FileFingerprintV2, right: FileFingerprintV2): boolean {
  return left.device === right.device
    && left.inode === right.inode
    && left.mode === right.mode
    && left.ownerUid === right.ownerUid
    && left.ownerGid === right.ownerGid
    && left.linkCount === right.linkCount
    && left.byteLength === right.byteLength
    && left.modifiedMs === right.modifiedMs
    && left.changedMs === right.changedMs;
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
  receipt: NodeToolchainArchiveInventoryReceiptV2,
): NodeToolchainArchiveInventoryReceiptV2 {
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

function sha256(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function cleanupPrivateArchive(privateRoot: string, privateArchivePath: string): void {
  try {
    const names = readdirSync(privateRoot);
    if (names.length > 1 || (names.length === 1 && names[0] !== path.basename(privateArchivePath))) {
      return fail(
        "NODE_TOOLCHAIN_ARCHIVE_V2_CLEANUP_FAILED",
        "Private archive inventory root contains an unowned entry",
      );
    }
    if (names.length === 1) unlinkSync(privateArchivePath);
    rmdirSync(privateRoot);
  } catch (error) {
    if (error instanceof NodeToolchainArchiveInventoryErrorV2) throw error;
    return fail(
      "NODE_TOOLCHAIN_ARCHIVE_V2_CLEANUP_FAILED",
      "Private archive inventory root could not be removed exactly",
      error,
    );
  }
}

function createPrivateArchive(
  bytes: Buffer,
  expected: Readonly<{ byteLength: number; sha256: string }>,
): Readonly<{
  privateRoot: string;
  privateArchivePath: string;
  privateArchiveFingerprint: FileFingerprintV2;
}> {
  if (bytes.byteLength !== expected.byteLength || sha256(bytes) !== expected.sha256) {
    return fail(
      "NODE_TOOLCHAIN_ARCHIVE_V2_PRIVATE_COPY_INVALID",
      "Defensive archive bytes differ from the authenticated distribution receipt",
    );
  }
  let privateRoot: string | undefined;
  let privateArchivePath: string | undefined;
  let descriptor: number | undefined;
  let completed = false;
  try {
    privateRoot = mkdtempSync(PRIVATE_ROOT_PREFIX_V2);
    chmodSync(privateRoot, 0o700);
    privateArchivePath = path.join(privateRoot, "archive.tar.xz");
    descriptor = openSync(
      privateArchivePath,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
      0o600,
    );
    let offset = 0;
    while (offset < bytes.byteLength) {
      const written = writeSync(descriptor, bytes, offset, bytes.byteLength - offset);
      if (written < 1) {
        return fail(
          "NODE_TOOLCHAIN_ARCHIVE_V2_PRIVATE_COPY_INVALID",
          "Private archive copy made no forward progress",
        );
      }
      offset += written;
    }
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = undefined;
    const rootDescriptor = openSync(privateRoot, constants.O_RDONLY);
    try {
      fsyncSync(rootDescriptor);
    } finally {
      closeSync(rootDescriptor);
    }
    const archiveStat = lstatSync(privateArchivePath);
    if (
      archiveStat.isSymbolicLink()
      || !archiveStat.isFile()
      || archiveStat.nlink !== 1
      || (archiveStat.mode & 0o7777) !== 0o600
      || archiveStat.size !== expected.byteLength
    ) {
      return fail(
        "NODE_TOOLCHAIN_ARCHIVE_V2_PRIVATE_COPY_INVALID",
        "Private archive copy lost its exact filesystem identity",
      );
    }
    completed = true;
    return Object.freeze({
      privateRoot,
      privateArchivePath,
      privateArchiveFingerprint: fingerprint(archiveStat),
    });
  } catch (error) {
    if (error instanceof NodeToolchainArchiveInventoryErrorV2) throw error;
    return fail(
      "NODE_TOOLCHAIN_ARCHIVE_V2_PRIVATE_COPY_INVALID",
      "Authenticated archive bytes could not be staged privately",
      error,
    );
  } finally {
    closeQuietly(descriptor);
    if (!completed && privateRoot && privateArchivePath) {
      try {
        cleanupPrivateArchive(privateRoot, privateArchivePath);
      } catch {
        // The primary private-copy failure remains authoritative.
      }
    }
  }
}

function revalidatePrivateArchive(
  staged: Readonly<{
    privateArchivePath: string;
    privateArchiveFingerprint: FileFingerprintV2;
  }>,
  expected: Readonly<{ byteLength: number; sha256: string }>,
): void {
  let descriptor: number | undefined;
  try {
    const pathBefore = lstatSync(staged.privateArchivePath);
    descriptor = openSync(
      staged.privateArchivePath,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
    const before = fstatSync(descriptor);
    if (
      pathBefore.isSymbolicLink()
      || !pathBefore.isFile()
      || pathBefore.nlink !== 1
      || (pathBefore.mode & 0o7777) !== 0o600
      || !sameFingerprint(fingerprint(pathBefore), fingerprint(before))
      || !sameFingerprint(fingerprint(before), staged.privateArchiveFingerprint)
    ) {
      return fail(
        "NODE_TOOLCHAIN_ARCHIVE_V2_PRIVATE_COPY_INVALID",
        "Private archive copy changed before final inventory revalidation",
      );
    }
    const hash = createHash("sha256");
    const buffer = Buffer.allocUnsafe(256 * 1024);
    let byteLength = 0;
    while (true) {
      const bytesRead = readSync(descriptor, buffer, 0, buffer.length, null);
      if (bytesRead === 0) break;
      byteLength += bytesRead;
      if (byteLength > expected.byteLength) {
        return fail(
          "NODE_TOOLCHAIN_ARCHIVE_V2_PRIVATE_COPY_INVALID",
          "Private archive copy exceeded its authenticated byte length",
        );
      }
      hash.update(buffer.subarray(0, bytesRead));
    }
    const after = fstatSync(descriptor);
    const pathAfter = lstatSync(staged.privateArchivePath);
    if (
      !sameFingerprint(fingerprint(before), fingerprint(after))
      || !sameFingerprint(fingerprint(after), fingerprint(pathAfter))
      || !sameFingerprint(fingerprint(after), staged.privateArchiveFingerprint)
      || byteLength !== expected.byteLength
      || hash.digest("hex") !== expected.sha256
    ) {
      return fail(
        "NODE_TOOLCHAIN_ARCHIVE_V2_PRIVATE_COPY_INVALID",
        "Private archive bytes or identity changed during inventory",
      );
    }
  } catch (error) {
    if (error instanceof NodeToolchainArchiveInventoryErrorV2) throw error;
    return fail(
      "NODE_TOOLCHAIN_ARCHIVE_V2_PRIVATE_COPY_INVALID",
      "Private archive copy could not be revalidated after inventory",
      error,
    );
  } finally {
    closeQuietly(descriptor);
  }
}

function captureTarTool(): TarToolCaptureV2 {
  let descriptor: number | undefined;
  try {
    const pathBefore = lstatSync(BSDTAR_PATH_V2);
    if (
      pathBefore.isSymbolicLink()
      || !pathBefore.isFile()
      || pathBefore.nlink !== 1
      || (pathBefore.mode & 0o7777) !== 0o755
      || pathBefore.uid !== 0
      || pathBefore.size < 1
      || pathBefore.size > 4 * 1024 * 1024
    ) {
      return fail(
        "NODE_TOOLCHAIN_ARCHIVE_V2_TAR_TOOL_INVALID",
        "Exact macOS bsdtar tool identity is not root-owned and immutable-shaped",
      );
    }
    descriptor = openSync(
      BSDTAR_PATH_V2,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
    const before = fstatSync(descriptor);
    if (!sameFingerprint(fingerprint(pathBefore), fingerprint(before))) {
      return fail(
        "NODE_TOOLCHAIN_ARCHIVE_V2_TAR_TOOL_INVALID",
        "Exact macOS bsdtar tool changed before capture",
      );
    }
    const hash = createHash("sha256");
    const buffer = Buffer.allocUnsafe(256 * 1024);
    let byteLength = 0;
    while (true) {
      const bytesRead = readSync(descriptor, buffer, 0, buffer.length, null);
      if (bytesRead === 0) break;
      byteLength += bytesRead;
      if (byteLength > 4 * 1024 * 1024) {
        return fail(
          "NODE_TOOLCHAIN_ARCHIVE_V2_TAR_TOOL_INVALID",
          "Exact macOS bsdtar tool exceeded its fixed byte bound",
        );
      }
      hash.update(buffer.subarray(0, bytesRead));
    }
    const after = fstatSync(descriptor);
    const pathAfter = lstatSync(BSDTAR_PATH_V2);
    if (
      !sameFingerprint(fingerprint(before), fingerprint(after))
      || !sameFingerprint(fingerprint(after), fingerprint(pathAfter))
      || byteLength !== pathBefore.size
    ) {
      return fail(
        "NODE_TOOLCHAIN_ARCHIVE_V2_TAR_TOOL_INVALID",
        "Exact macOS bsdtar tool changed during capture",
      );
    }
    return Object.freeze({
      fingerprint: fingerprint(after),
      identity: Object.freeze({
        toolRef: "MACOS_BSDTAR_V2",
        executionPolicy: "direct_exact_path_deny_all_environment_v2",
        contentHash: hash.digest("hex"),
        byteLength,
        mode: "0755",
        ownerUid: 0,
        ownerGid: after.gid,
        linkCount: 1,
      }),
    });
  } catch (error) {
    if (error instanceof NodeToolchainArchiveInventoryErrorV2) throw error;
    return fail(
      "NODE_TOOLCHAIN_ARCHIVE_V2_TAR_TOOL_INVALID",
      "Exact macOS bsdtar tool could not be captured",
      error,
    );
  } finally {
    closeQuietly(descriptor);
  }
}

type SingleTarResultV2 = Readonly<{
  status: "exited" | "timed_out" | "output_limit_exceeded" | "spawn_failed";
  exitCode: number | null;
  signal: string | null;
  stdout: string;
  stderr: string;
}>;

function runSingleTarListing(
  invocation: NodeToolchainTarInventoryInvocationV2,
  argv: readonly string[],
  maxOutputBytes: number,
): Promise<SingleTarResultV2> {
  return new Promise((resolve) => {
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let forcedStatus: "timed_out" | "output_limit_exceeded" | undefined;
    let settled = false;
    let child: ReturnType<typeof spawn>;

    const captured = (): Readonly<{ stdout: string; stderr: string }> => Object.freeze({
      stdout: Buffer.concat(stdoutChunks, stdoutBytes).toString("utf8"),
      stderr: Buffer.concat(stderrChunks, stderrBytes).toString("utf8"),
    });
    const settle = (result: SingleTarResultV2): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(Object.freeze(result));
    };
    const terminateFor = (status: "timed_out" | "output_limit_exceeded"): void => {
      if (forcedStatus !== undefined) return;
      forcedStatus = status;
      child.kill("SIGKILL");
    };

    try {
      child = spawn(invocation.executable, [...argv], {
        cwd: invocation.cwd,
        env: { ...invocation.env },
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
    } catch (error) {
      resolve(Object.freeze({
        status: "spawn_failed",
        exitCode: null,
        signal: null,
        stdout: "",
        stderr: error instanceof Error ? error.message : "spawn failed",
      }));
      return;
    }

    const timer = setTimeout(() => terminateFor("timed_out"), invocation.timeoutMs);
    child.stdout!.on("data", (chunk: Buffer) => {
      if (forcedStatus !== undefined) return;
      if (stdoutBytes + chunk.byteLength > maxOutputBytes) {
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
      settle({
        status: "spawn_failed",
        exitCode: null,
        signal: null,
        stdout: output.stdout,
        stderr: output.stderr || error.message,
      });
    });
    child.once("close", (exitCode, signal) => {
      const output = captured();
      if (forcedStatus !== undefined) {
        settle({
          status: forcedStatus,
          exitCode: null,
          signal: signal ?? null,
          stdout: output.stdout,
          stderr: output.stderr,
        });
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

async function productionTarAdapter(
  invocation: NodeToolchainTarInventoryInvocationV2,
): Promise<NodeToolchainTarInventoryResultV2> {
  const [names, verbose] = await Promise.all([
    runSingleTarListing(invocation, invocation.namesArgv, invocation.maxNamesBytes),
    runSingleTarListing(invocation, invocation.verboseArgv, invocation.maxVerboseBytes),
  ]);
  const namesOutput = names.stdout;
  const verboseOutput = verbose.stdout;
  const stderr = `${names.stderr}${verbose.stderr}`;
  if (names.status === "output_limit_exceeded" || verbose.status === "output_limit_exceeded") {
    return Object.freeze({ status: "output_limit_exceeded", namesOutput, verboseOutput, stderr });
  }
  if (names.status === "timed_out" || verbose.status === "timed_out") {
    return Object.freeze({ status: "timed_out", namesOutput, verboseOutput, stderr });
  }
  if (names.status === "spawn_failed" || verbose.status === "spawn_failed") {
    return Object.freeze({ status: "spawn_failed", namesOutput, verboseOutput, stderr });
  }
  const signal = names.signal ?? verbose.signal;
  const exitCode = names.exitCode !== 0 ? names.exitCode : verbose.exitCode;
  return Object.freeze({
    status: "exited",
    exitCode,
    signal,
    namesOutput,
    verboseOutput,
    stderr,
  });
}

function immutableTarInvocation(
  privateRoot: string,
  privateArchivePath: string,
): NodeToolchainTarInventoryInvocationV2 {
  return Object.freeze({
    executable: BSDTAR_PATH_V2,
    namesArgv: Object.freeze(["-tf", privateArchivePath]) as readonly ["-tf", string],
    verboseArgv: Object.freeze(["-tvf", privateArchivePath]) as readonly ["-tvf", string],
    cwd: privateRoot,
    env: Object.freeze({ LANG: "C", LC_ALL: "C", TZ: "UTC" }),
    shell: false,
    timeoutMs: NODE_TOOLCHAIN_ARCHIVE_INVENTORY_TIMEOUT_MS_V2,
    maxNamesBytes: NODE_TOOLCHAIN_ARCHIVE_INVENTORY_MAX_LISTING_BYTES_V2,
    maxVerboseBytes: NODE_TOOLCHAIN_ARCHIVE_INVENTORY_MAX_LISTING_BYTES_V2,
    maxStderrBytes: NODE_TOOLCHAIN_ARCHIVE_INVENTORY_MAX_STDERR_BYTES_V2,
  });
}

function assertTarSucceeded(
  result: NodeToolchainTarInventoryResultV2,
): asserts result is Extract<NodeToolchainTarInventoryResultV2, { status: "exited" }> {
  if (
    Buffer.byteLength(result.namesOutput, "utf8")
      > NODE_TOOLCHAIN_ARCHIVE_INVENTORY_MAX_LISTING_BYTES_V2
    || Buffer.byteLength(result.verboseOutput, "utf8")
      > NODE_TOOLCHAIN_ARCHIVE_INVENTORY_MAX_LISTING_BYTES_V2
    || Buffer.byteLength(result.stderr, "utf8")
      > NODE_TOOLCHAIN_ARCHIVE_INVENTORY_MAX_STDERR_BYTES_V2
  ) {
    fail("NODE_TOOLCHAIN_ARCHIVE_V2_TAR_OUTPUT_LIMIT", "Archive listing exceeded its fixed output bound");
  }
  switch (result.status) {
    case "output_limit_exceeded":
      fail("NODE_TOOLCHAIN_ARCHIVE_V2_TAR_OUTPUT_LIMIT", "Archive listing exceeded its fixed output bound");
    case "timed_out":
      fail("NODE_TOOLCHAIN_ARCHIVE_V2_TAR_TIMEOUT", "Archive listing exceeded its exact timeout");
    case "spawn_failed":
      fail("NODE_TOOLCHAIN_ARCHIVE_V2_TAR_SPAWN_FAILED", "Exact macOS bsdtar could not be spawned");
    case "exited":
      break;
  }
  if (result.signal !== null) {
    fail("NODE_TOOLCHAIN_ARCHIVE_V2_TAR_SIGNALLED", "Archive listing terminated by signal");
  }
  if (result.exitCode !== 0) {
    fail("NODE_TOOLCHAIN_ARCHIVE_V2_TAR_NONZERO", "Archive listing exited nonzero");
  }
  if (result.stderr !== "") {
    fail("NODE_TOOLCHAIN_ARCHIVE_V2_LISTING_MALFORMED", "Successful archive listing wrote stderr");
  }
}

function listingLines(output: string): string[] {
  if (output.length < 1 || !output.endsWith("\n") || output.includes("\r")) {
    return fail(
      "NODE_TOOLCHAIN_ARCHIVE_V2_LISTING_MALFORMED",
      "Archive inventory must be one LF-terminated member per line",
    );
  }
  const lines = output.slice(0, -1).split("\n");
  if (lines.some((line) => line.length < 1)) {
    return fail(
      "NODE_TOOLCHAIN_ARCHIVE_V2_LISTING_MALFORMED",
      "Archive inventory contains an empty listing line",
    );
  }
  return lines;
}

function memberTypeAndMode(verboseLine: string): Readonly<{
  type: ArchiveMemberTypeV2;
  modeClass: ArchiveMemberModeClassV2;
}> {
  if (verboseLine.length < 10) {
    return fail(
      "NODE_TOOLCHAIN_ARCHIVE_V2_LISTING_MALFORMED",
      "Verbose archive inventory omitted one exact permission field",
    );
  }
  const typeCharacter = verboseLine[0];
  const permissions = verboseLine.slice(1, 10);
  if ((typeCharacter === "-" || typeCharacter === "d")
    && !/^[r-][w-][x-][r-][w-][x-][r-][w-][x-]$/.test(permissions)) {
    return fail(
      "NODE_TOOLCHAIN_ARCHIVE_V2_LISTING_MALFORMED",
      "Selected-capable archive member has non-canonical permission text",
    );
  }
  if (typeCharacter === "-") {
    return Object.freeze({
      type: "file",
      modeClass: permissions[2] === "x" || permissions[5] === "x" || permissions[8] === "x"
        ? "executable"
        : "non_executable",
    });
  }
  if (typeCharacter === "d") {
    return Object.freeze({ type: "directory", modeClass: "not_applicable" });
  }
  if (typeCharacter === "l") {
    return Object.freeze({ type: "symlink", modeClass: "not_applicable" });
  }
  if (typeCharacter === "h") {
    return Object.freeze({ type: "hard_link", modeClass: "not_applicable" });
  }
  return Object.freeze({ type: "special", modeClass: "not_applicable" });
}

function normalizeMemberLocator(
  rawName: string,
  type: ArchiveMemberTypeV2,
  archiveRoot: string,
): string {
  if (
    Buffer.byteLength(rawName, "utf8") > MAX_MEMBER_PATH_BYTES_V2
    || rawName.includes("\0")
    || rawName.includes("\\")
    || rawName.startsWith("/")
    || (type === "directory" ? !rawName.endsWith("/") : rawName.endsWith("/"))
  ) {
    return fail("NODE_TOOLCHAIN_ARCHIVE_V2_PATH_INVALID", "Archive member path is not portable and relative");
  }
  const locator = type === "directory" ? rawName.slice(0, -1) : rawName;
  const segments = locator.split("/");
  if (
    locator.length < 1
    || segments.length > MAX_MEMBER_DEPTH_V2
    || segments[0] !== archiveRoot
    || segments.some((segment) =>
      segment.length < 1
      || segment === "."
      || segment === ".."
      || Buffer.byteLength(segment, "utf8") > MAX_MEMBER_SEGMENT_BYTES_V2
      || !/^[A-Za-z0-9._@+-]+$/.test(segment))
  ) {
    return fail("NODE_TOOLCHAIN_ARCHIVE_V2_PATH_INVALID", "Archive member path escaped its exact portable root");
  }
  return locator;
}

function parseInventory(input: Readonly<{
  namesOutput: string;
  verboseOutput: string;
  archiveRoot: string;
}>): readonly ArchiveMemberV2[] {
  const names = listingLines(input.namesOutput);
  const verbose = listingLines(input.verboseOutput);
  if (
    names.length !== verbose.length
    || names.length > NODE_TOOLCHAIN_ARCHIVE_INVENTORY_MAX_MEMBERS_V2
  ) {
    return fail(
      names.length > NODE_TOOLCHAIN_ARCHIVE_INVENTORY_MAX_MEMBERS_V2
        ? "NODE_TOOLCHAIN_ARCHIVE_V2_MEMBER_BOUND_EXCEEDED"
        : "NODE_TOOLCHAIN_ARCHIVE_V2_LISTING_MALFORMED",
      "Archive name and type inventories must have one bounded member-to-member pairing",
    );
  }
  const exact = new Set<string>();
  const folded = new Map<string, string>();
  const members: ArchiveMemberV2[] = [];
  for (let index = 0; index < names.length; index += 1) {
    const { type, modeClass } = memberTypeAndMode(verbose[index]!);
    const locator = normalizeMemberLocator(names[index]!, type, input.archiveRoot);
    if (exact.has(locator)) {
      return fail(
        "NODE_TOOLCHAIN_ARCHIVE_V2_DUPLICATE_MEMBER",
        "Archive contains more than one member at the same canonical locator",
      );
    }
    const caseFolded = locator.toLowerCase();
    const existing = folded.get(caseFolded);
    if (existing !== undefined && existing !== locator) {
      return fail(
        "NODE_TOOLCHAIN_ARCHIVE_V2_CASE_COLLISION",
        "Archive contains members that collide on a case-insensitive filesystem",
      );
    }
    exact.add(locator);
    folded.set(caseFolded, locator);
    members.push(Object.freeze({ locator, type, modeClass }));
  }
  return Object.freeze(members);
}

function requireMember(
  membersByLocator: ReadonlyMap<string, ArchiveMemberV2>,
  locator: string,
  expectedType: "file" | "directory",
): ArchiveMemberV2 {
  const member = membersByLocator.get(locator);
  if (!member) {
    return fail(
      "NODE_TOOLCHAIN_ARCHIVE_V2_SELECTED_CLOSURE_INCOMPLETE",
      "Archive is missing one required selected Node/npm member",
    );
  }
  if (member.type !== expectedType) {
    return fail(
      "NODE_TOOLCHAIN_ARCHIVE_V2_SELECTED_TYPE_REJECTED",
      "A selected Node/npm member is not an exact regular file or directory",
    );
  }
  return member;
}

function parentLocators(locator: string): string[] {
  const segments = locator.split("/");
  const parents: string[] = [];
  for (let end = 1; end < segments.length; end += 1) {
    parents.push(segments.slice(0, end).join("/"));
  }
  return parents;
}

function selectClosure(input: Readonly<{
  members: readonly ArchiveMemberV2[];
  archiveRoot: string;
  nodeExecutableLocator: string;
  npmPackageRootLocator: string;
  npmCliLocator: string;
  npmPackageJsonLocator: string;
  npmBuiltinConfigLocator: string;
}>): Readonly<{
  npmMembers: readonly ArchiveMemberV2[];
  retainedLocators: ReadonlySet<string>;
  npmClosureHash: string;
}> {
  const membersByLocator = new Map(input.members.map((member) => [member.locator, member]));
  requireMember(membersByLocator, input.archiveRoot, "directory");
  const nodeLocator = `${input.archiveRoot}/${input.nodeExecutableLocator}`;
  const npmRoot = `${input.archiveRoot}/${input.npmPackageRootLocator}`;
  const npmCli = `${input.archiveRoot}/${input.npmCliLocator}`;
  const packageJson = `${input.archiveRoot}/${input.npmPackageJsonLocator}`;
  const builtinNpmrc = `${input.archiveRoot}/${input.npmBuiltinConfigLocator}`;
  const nodeExecutable = requireMember(membersByLocator, nodeLocator, "file");
  requireMember(membersByLocator, npmRoot, "directory");
  const npmCliMember = requireMember(membersByLocator, npmCli, "file");
  const packageJsonMember = requireMember(membersByLocator, packageJson, "file");
  if (membersByLocator.has(builtinNpmrc)) {
    return fail(
      "NODE_TOOLCHAIN_ARCHIVE_V2_SELECTED_CLOSURE_UNEXPECTED",
      "Selected npm archive closure contains an unadmitted builtin npmrc",
    );
  }
  if (
    nodeExecutable.modeClass !== "executable"
    || npmCliMember.modeClass !== "executable"
    || packageJsonMember.modeClass !== "non_executable"
  ) {
    return fail(
      "NODE_TOOLCHAIN_ARCHIVE_V2_SELECTED_TYPE_REJECTED",
      "Selected Node executable and npm CLI must retain executable source mode",
    );
  }

  const npmMembers = input.members.filter((member) => member.locator.startsWith(`${npmRoot}/`));
  if (npmMembers.length < 1) {
    return fail(
      "NODE_TOOLCHAIN_ARCHIVE_V2_SELECTED_CLOSURE_INCOMPLETE",
      "Selected npm archive closure contains no members",
    );
  }
  if (npmMembers.some((member) => member.type !== "file" && member.type !== "directory")) {
    return fail(
      "NODE_TOOLCHAIN_ARCHIVE_V2_SELECTED_TYPE_REJECTED",
      "Selected npm archive closure contains a link or special member",
    );
  }

  const retainedLocators = new Set<string>([nodeLocator, npmRoot]);
  for (const member of npmMembers) retainedLocators.add(member.locator);
  for (const locator of [...retainedLocators]) {
    for (const parent of parentLocators(locator)) {
      requireMember(membersByLocator, parent, "directory");
      retainedLocators.add(parent);
    }
  }
  const npmCanonicalMembers = [
    { locator: ".", type: "directory" as const, modeClass: "not_applicable" as const },
    ...npmMembers.map((member) => ({
      locator: member.locator.slice(npmRoot.length + 1),
      type: member.type,
      modeClass: member.modeClass,
    })),
  ].sort((left, right) => left.locator < right.locator ? -1 : left.locator > right.locator ? 1 : 0);
  return Object.freeze({
    npmMembers: Object.freeze([...npmMembers]),
    retainedLocators,
    npmClosureHash: hashCanonicalJson({
      schema: "setfarm.node-toolchain-selected-npm-archive-closure.v2",
      members: npmCanonicalMembers,
    }),
  });
}

function buildReceipt(input: Readonly<{
  distribution: ReturnType<typeof inspectNodeToolchainDistributionVerificationReceiptV2>;
  tarTool: NodeToolchainArchiveInventoryReceiptV2["tarTool"];
  members: readonly ArchiveMemberV2[];
}>): Readonly<{
  receipt: NodeToolchainArchiveInventoryReceiptV2;
  selectedMembers: readonly ArchiveMemberV2[];
}> {
  const artifact = input.distribution.artifact;
  const selected = selectClosure({
    members: input.members,
    archiveRoot: artifact.archiveRoot,
    nodeExecutableLocator: artifact.selection.nodeExecutableLocator,
    npmPackageRootLocator: artifact.selection.npmPackageRootLocator,
    npmCliLocator: artifact.selection.npmCliLocator,
    npmPackageJsonLocator: artifact.selection.npmPackageJsonLocator,
    npmBuiltinConfigLocator: artifact.selection.npmBuiltinConfigLocator,
  });
  const sortedMembers = [...input.members]
    .map((member) => ({
      locator: member.locator,
      type: member.type,
      modeClass: member.modeClass,
    }))
    .sort((left, right) => left.locator < right.locator ? -1 : left.locator > right.locator ? 1 : 0);
  const count = (type: ArchiveMemberTypeV2): number =>
    input.members.filter((member) => member.type === type).length;
  const discarded = input.members.filter((member) => !selected.retainedLocators.has(member.locator));
  const identity: NodeToolchainArchiveInventoryReceiptHashPayloadV2 = {
    schema: NODE_TOOLCHAIN_ARCHIVE_INVENTORY_RECEIPT_V2_SCHEMA,
    receiptVersion: NODE_TOOLCHAIN_ARCHIVE_INVENTORY_VERSION_V2,
    authorityRef: NODE_TOOLCHAIN_ARCHIVE_INVENTORY_AUTHORITY_REF_V2,
    authorityVersion: NODE_TOOLCHAIN_ARCHIVE_INVENTORY_VERSION_V2,
    status: "inventoried_verified",
    admissionScope: input.distribution.admissionScope,
    distribution: input.distribution,
    tarTool: input.tarTool,
    inventory: {
      policy: "every_addressable_member_before_extraction_v2",
      memberCount: input.members.length,
      fileCount: count("file"),
      directoryCount: count("directory"),
      symlinkCount: count("symlink"),
      hardLinkCount: count("hard_link"),
      specialCount: count("special"),
      inventoryHash: hashCanonicalJson({
        schema: "setfarm.node-toolchain-archive-member-inventory.v2",
        members: sortedMembers,
      }),
    },
    selected: {
      policy: "exact_node_and_bundled_npm_v2",
      nodeExecutableType: "file",
      npmPackageRootType: "directory",
      nodeExecutableModeClass: "executable",
      npmMemberCount: selected.npmMembers.length,
      npmClosureHash: selected.npmClosureHash,
      npmCliType: "file",
      npmCliModeClass: "executable",
      packageJsonType: "file",
      packageJsonModeClass: "non_executable",
      builtinNpmrcStatus: "absent",
      unselectedPolicy: "inventory_then_discard_without_extraction_v2",
      discardedUnselectedMemberCount: discarded.length,
      discardedUnselectedSymlinkCount: discarded.filter((member) => member.type === "symlink").length,
    },
  };
  const parsed = NodeToolchainArchiveInventoryReceiptV2Schema.safeParse({
    ...identity,
    receiptHash: hashNodeToolchainArchiveInventoryReceiptV2(identity),
  });
  if (!parsed.success) {
    return fail(
      "NODE_TOOLCHAIN_ARCHIVE_V2_RECEIPT_INVALID",
      "Fresh Node archive inventory receipt failed its canonical schema",
      parsed.error,
    );
  }
  return Object.freeze({
    receipt: deepFreezeJson(parsed.data),
    selectedMembers: Object.freeze(input.members
      .filter((member) => selected.retainedLocators.has(member.locator))
      .sort((left, right) => left.locator < right.locator ? -1 : 1)),
  });
}

async function inventory(input: Readonly<{
  archive: VerifiedNodeToolchainDistributionArchiveV2;
  tarAdapter: NodeToolchainTarInventoryAdapterV2;
}>): Promise<InventoriedNodeToolchainDistributionV2> {
  const distribution = inspectNodeToolchainDistributionVerificationReceiptV2(input.archive);
  const bytes = await copyVerifiedNodeToolchainDistributionArchiveBytesV2(input.archive);
  let staged: Readonly<{
    privateRoot: string;
    privateArchivePath: string;
    privateArchiveFingerprint: FileFingerprintV2;
  }> | undefined;
  try {
    staged = createPrivateArchive(bytes, distribution.archive);
    const tarBefore = captureTarTool();
    const invocation = immutableTarInvocation(staged.privateRoot, staged.privateArchivePath);
    let result: NodeToolchainTarInventoryResultV2;
    try {
      result = await input.tarAdapter(invocation);
    } catch (error) {
      return fail(
        "NODE_TOOLCHAIN_ARCHIVE_V2_TAR_SPAWN_FAILED",
        "Archive inventory adapter failed before returning bounded evidence",
        error,
      );
    }
    assertTarSucceeded(result);
    const tarAfter = captureTarTool();
    if (
      !sameFingerprint(tarBefore.fingerprint, tarAfter.fingerprint)
      || tarBefore.identity.contentHash !== tarAfter.identity.contentHash
    ) {
      return fail(
        "NODE_TOOLCHAIN_ARCHIVE_V2_TAR_TOOL_INVALID",
        "Exact macOS bsdtar tool changed during archive inventory",
      );
    }
    revalidatePrivateArchive(staged, distribution.archive);
    const members = parseInventory({
      namesOutput: result.namesOutput,
      verboseOutput: result.verboseOutput,
      archiveRoot: distribution.artifact.archiveRoot,
    });
    const built = buildReceipt({ distribution, tarTool: tarAfter.identity, members });
    const state: PrivateInventoryStateV2 = Object.freeze({
      archive: input.archive,
      members,
      selectedMembers: built.selectedMembers,
      receipt: built.receipt,
    });
    return new InventoriedNodeToolchainDistributionV2(handleConstructorCapabilityV2, state);
  } finally {
    bytes.fill(0);
    if (staged) cleanupPrivateArchive(staged.privateRoot, staged.privateArchivePath);
  }
}

export async function inventoryVerifiedNodeToolchainDistributionArchiveV2(
  archive: VerifiedNodeToolchainDistributionArchiveV2,
): Promise<InventoriedNodeToolchainDistributionV2> {
  return inventory({ archive, tarAdapter: productionTarAdapter });
}

export async function inventoryVerifiedNodeToolchainDistributionArchiveV2ForTest(
  archive: VerifiedNodeToolchainDistributionArchiveV2,
  input: Readonly<{ tarAdapter: NodeToolchainTarInventoryAdapterV2 }>,
): Promise<InventoriedNodeToolchainDistributionV2> {
  if (!input || typeof input.tarAdapter !== "function") {
    return fail(
      "NODE_TOOLCHAIN_ARCHIVE_V2_INPUT_INVALID",
      "Test archive inventory requires one explicit tar adapter",
    );
  }
  return inventory({ archive, tarAdapter: input.tarAdapter });
}

function authenticState(
  handle: InventoriedNodeToolchainDistributionV2,
): PrivateInventoryStateV2 {
  if (
    typeof handle !== "object"
    || handle === null
    || isProxy(handle)
    || Object.getPrototypeOf(handle) !== InventoriedNodeToolchainDistributionV2.prototype
  ) {
    return fail(
      "NODE_TOOLCHAIN_ARCHIVE_V2_HANDLE_UNAUTHENTICATED",
      "Node archive inventory operation requires one authentic handle",
    );
  }
  const state = privateInventoryStateV2.get(handle);
  if (!state) {
    return fail(
      "NODE_TOOLCHAIN_ARCHIVE_V2_HANDLE_UNAUTHENTICATED",
      "Node archive inventory operation requires one authentic handle",
    );
  }
  return state;
}

export function inspectNodeToolchainArchiveInventoryReceiptV2(
  handle: InventoriedNodeToolchainDistributionV2,
): NodeToolchainArchiveInventoryReceiptV2 {
  return defensiveReceiptCopy(authenticState(handle).receipt);
}

export async function copyInventoriedNodeToolchainMaterializationSourceV2(
  handle: InventoriedNodeToolchainDistributionV2,
): Promise<NodeToolchainMaterializationSourceV2> {
  const state = authenticState(handle);
  await revalidateInventoriedNodeToolchainMaterializationAuthorityV2(handle);
  const archiveBytes = await copyVerifiedNodeToolchainDistributionArchiveBytesV2(state.archive);
  const archiveRoot = state.receipt.distribution.artifact.archiveRoot;
  const selectedMembers = state.selectedMembers.map((member): NodeToolchainSelectedArchiveMemberV2 => {
    if (member.type !== "file" && member.type !== "directory") {
      return fail(
        "NODE_TOOLCHAIN_ARCHIVE_V2_SELECTED_TYPE_REJECTED",
        "Authenticated selected member cannot cross the materialization boundary",
      );
    }
    return Object.freeze({
      archiveLocator: member.locator,
      treeLocator: member.locator === archiveRoot
        ? "."
        : member.locator.slice(archiveRoot.length + 1),
      type: member.type,
      targetMode: member.type === "directory" || member.modeClass === "executable"
        ? "0555"
        : "0444",
    });
  });
  return Object.freeze({
    receipt: defensiveReceiptCopy(state.receipt),
    archiveBytes,
    selectedMembers: Object.freeze(selectedMembers),
  });
}

export async function revalidateInventoriedNodeToolchainMaterializationAuthorityV2(
  handle: InventoriedNodeToolchainDistributionV2,
): Promise<NodeToolchainArchiveInventoryReceiptV2> {
  const state = authenticState(handle);
  const tarTool = captureTarTool();
  if (hashCanonicalJson(tarTool.identity) !== hashCanonicalJson(state.receipt.tarTool)) {
    return fail(
      "NODE_TOOLCHAIN_ARCHIVE_V2_TAR_TOOL_INVALID",
      "Archive inventory tar authority changed before materialization handoff",
    );
  }
  const distribution = await revalidateVerifiedNodeToolchainDistributionArchiveV2(state.archive);
  if (distribution.receiptHash !== state.receipt.distribution.receiptHash) {
    return fail(
      "NODE_TOOLCHAIN_ARCHIVE_V2_PRIVATE_COPY_INVALID",
      "Authenticated distribution receipt changed after archive inventory",
    );
  }
  return defensiveReceiptCopy(state.receipt);
}
