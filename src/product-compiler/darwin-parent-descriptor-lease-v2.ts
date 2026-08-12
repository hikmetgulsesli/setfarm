import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readSync,
  type BigIntStats,
} from "node:fs";
import path from "node:path";

const LOCKF_PATH_V2 = "/usr/bin/lockf" as const;
const LOCK_HELPER_PATH_V2 = "/bin/cat" as const;
const LOCK_ACQUISITION_TIMEOUT_SECONDS_V2 = 10;
const LOCK_PROTOCOL_TIMEOUT_MS_V2 = 12_000;
const MAX_TOOL_BYTES_V2 = 4 * 1024 * 1024;

export type DarwinParentDescriptorLeaseErrorCodeV2 =
  | "DARWIN_PARENT_DESCRIPTOR_LEASE_V2_INPUT_INVALID"
  | "DARWIN_PARENT_DESCRIPTOR_LEASE_V2_PLATFORM_UNSUPPORTED"
  | "DARWIN_PARENT_DESCRIPTOR_LEASE_V2_BOUNDARY_INVALID"
  | "DARWIN_PARENT_DESCRIPTOR_LEASE_V2_TOOL_INVALID"
  | "DARWIN_PARENT_DESCRIPTOR_LEASE_V2_TIMEOUT"
  | "DARWIN_PARENT_DESCRIPTOR_LEASE_V2_LOST";

export class DarwinParentDescriptorLeaseErrorV2 extends Error {
  readonly code: DarwinParentDescriptorLeaseErrorCodeV2;
  override readonly cause?: unknown;

  constructor(
    code: DarwinParentDescriptorLeaseErrorCodeV2,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message.slice(0, 1_000), options);
    this.name = "DarwinParentDescriptorLeaseErrorV2";
    this.code = code;
    this.cause = options?.cause;
  }
}

type OwnerV2 = Readonly<{ uid: number; gid: number }>;

type FingerprintV2 = Readonly<{
  device: bigint;
  inode: bigint;
  mode: bigint;
  ownerUid: bigint;
  ownerGid: bigint;
  linkCount: bigint;
  byteLength: bigint;
  modifiedNanoseconds: bigint;
  changedNanoseconds: bigint;
}>;

type SystemToolRefV2 = "MACOS_LOCKF_V2" | "MACOS_CAT_LOCK_HELPER_V2";

type CapturedSystemToolV2<RefV2 extends SystemToolRefV2 = SystemToolRefV2> = Readonly<{
  toolRef: RefV2;
  contentHash: string;
  byteLength: number;
  mode: "0755";
  ownerUid: 0;
  ownerGid: number;
  linkCount: 1;
  fingerprint: FingerprintV2;
}>;

export type DarwinParentDescriptorLeaseSystemToolEvidenceV2<
  RefV2 extends SystemToolRefV2 = SystemToolRefV2,
> = Readonly<{
  toolRef: RefV2;
  contentHash: string;
  byteLength: number;
  mode: "0755";
  ownerUid: 0;
  ownerGid: number;
  linkCount: 1;
}>;

export type DarwinParentDescriptorLeaseV2 = Readonly<{
  parentPhysicalIdentity: Readonly<{
    device: bigint;
    inode: bigint;
  }>;
  evidence: Readonly<{
    contractRef: "DARWIN_PARENT_DESCRIPTOR_LEASE_V2";
    executionPolicy: "exact_lockf_fd_then_exact_cat_pipe_v2";
    lockf: DarwinParentDescriptorLeaseSystemToolEvidenceV2<"MACOS_LOCKF_V2">;
    lockHelper: DarwinParentDescriptorLeaseSystemToolEvidenceV2<"MACOS_CAT_LOCK_HELPER_V2">;
  }>;
  assertCurrent: () => void;
  release: () => Promise<void>;
}>;

function fail(
  code: DarwinParentDescriptorLeaseErrorCodeV2,
  message: string,
  cause?: unknown,
): never {
  throw new DarwinParentDescriptorLeaseErrorV2(
    code,
    message,
    cause === undefined ? undefined : { cause },
  );
}

function closeQuietly(descriptor: number | undefined): void {
  if (descriptor === undefined) return;
  try {
    closeSync(descriptor);
  } catch {
    // The primary lease outcome remains authoritative.
  }
}

function fingerprint(stat: BigIntStats): FingerprintV2 {
  return Object.freeze({
    device: stat.dev,
    inode: stat.ino,
    mode: stat.mode,
    ownerUid: stat.uid,
    ownerGid: stat.gid,
    linkCount: stat.nlink,
    byteLength: stat.size,
    modifiedNanoseconds: stat.mtimeNs,
    changedNanoseconds: stat.ctimeNs,
  });
}

function sameFingerprint(left: FingerprintV2, right: FingerprintV2): boolean {
  return left.device === right.device
    && left.inode === right.inode
    && left.mode === right.mode
    && left.ownerUid === right.ownerUid
    && left.ownerGid === right.ownerGid
    && left.linkCount === right.linkCount
    && left.byteLength === right.byteLength
    && left.modifiedNanoseconds === right.modifiedNanoseconds
    && left.changedNanoseconds === right.changedNanoseconds;
}

function samePhysicalIdentity(left: FingerprintV2, right: FingerprintV2): boolean {
  return left.device === right.device && left.inode === right.inode;
}

function modeBits(stat: BigIntStats | FingerprintV2): number {
  return Number(stat.mode & 0o7777n);
}

function normalizedAbsolute(value: unknown, field: string): string {
  if (
    typeof value !== "string"
    || !path.isAbsolute(value)
    || path.normalize(value) !== value
    || value.includes("\0")
  ) {
    return fail(
      "DARWIN_PARENT_DESCRIPTOR_LEASE_V2_INPUT_INVALID",
      `${field} must be one normalized absolute locator`,
    );
  }
  return value;
}

function exactOwner(value: unknown): OwnerV2 {
  if (
    typeof value !== "object"
    || value === null
    || Object.getPrototypeOf(value) !== Object.prototype
  ) {
    return fail(
      "DARWIN_PARENT_DESCRIPTOR_LEASE_V2_INPUT_INVALID",
      "Lease owner must be one exact plain object",
    );
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(value).sort();
  const uid = descriptors.uid && "value" in descriptors.uid ? descriptors.uid.value : undefined;
  const gid = descriptors.gid && "value" in descriptors.gid ? descriptors.gid.value : undefined;
  if (
    keys.length !== 2
    || keys[0] !== "gid"
    || keys[1] !== "uid"
    || !Number.isInteger(uid)
    || uid < 0
    || uid > 2_147_483_647
    || !Number.isInteger(gid)
    || gid < 0
    || gid > 2_147_483_647
  ) {
    return fail(
      "DARWIN_PARENT_DESCRIPTOR_LEASE_V2_INPUT_INVALID",
      "Lease owner has unknown or invalid identities",
    );
  }
  return Object.freeze({ uid, gid });
}

function stableFileHash(input: Readonly<{
  absolutePath: string;
  maxBytes: number;
  expectedOwner?: OwnerV2;
  allowedModes: readonly number[];
  allowedLinks: readonly number[];
  errorCode: DarwinParentDescriptorLeaseErrorCodeV2;
}>): Readonly<{ fingerprint: FingerprintV2; contentHash: string }> {
  let descriptor: number | undefined;
  try {
    const pathBefore = lstatSync(input.absolutePath, { bigint: true });
    if (
      pathBefore.isSymbolicLink()
      || !pathBefore.isFile()
      || pathBefore.size < 1n
      || pathBefore.size > BigInt(input.maxBytes)
      || (input.expectedOwner
        && (pathBefore.uid !== BigInt(input.expectedOwner.uid)
          || pathBefore.gid !== BigInt(input.expectedOwner.gid)))
      || !input.allowedModes.includes(modeBits(pathBefore))
      || !input.allowedLinks.includes(Number(pathBefore.nlink))
    ) {
      return fail(input.errorCode, "Lease file is not one exact bounded ordinary file");
    }
    descriptor = openSync(
      input.absolutePath,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
    const before = fstatSync(descriptor, { bigint: true });
    if (!sameFingerprint(fingerprint(pathBefore), fingerprint(before))) {
      return fail(input.errorCode, "Lease file changed before its bounded read");
    }
    const hash = createHash("sha256");
    const buffer = Buffer.allocUnsafe(64 * 1024);
    let total = 0;
    while (true) {
      const count = readSync(descriptor, buffer, 0, buffer.byteLength, null);
      if (count === 0) break;
      total += count;
      if (total > input.maxBytes) return fail(input.errorCode, "Lease file exceeded its bound");
      hash.update(buffer.subarray(0, count));
    }
    const after = fstatSync(descriptor, { bigint: true });
    const pathAfter = lstatSync(input.absolutePath, { bigint: true });
    if (
      BigInt(total) !== before.size
      || !sameFingerprint(fingerprint(before), fingerprint(after))
      || !sameFingerprint(fingerprint(after), fingerprint(pathAfter))
    ) {
      return fail(input.errorCode, "Lease file changed during its bounded read");
    }
    return Object.freeze({ fingerprint: fingerprint(after), contentHash: hash.digest("hex") });
  } catch (error) {
    if (error instanceof DarwinParentDescriptorLeaseErrorV2) throw error;
    return fail(input.errorCode, "Lease file could not be captured", error);
  } finally {
    closeQuietly(descriptor);
  }
}

function assertDirectory(input: Readonly<{
  absolutePath: string;
  expectedOwner: OwnerV2;
  allowedModes: readonly number[];
  errorCode: DarwinParentDescriptorLeaseErrorCodeV2;
}>): FingerprintV2 {
  try {
    const before = lstatSync(input.absolutePath, { bigint: true });
    const after = lstatSync(input.absolutePath, { bigint: true });
    if (
      before.isSymbolicLink()
      || !before.isDirectory()
      || before.uid !== BigInt(input.expectedOwner.uid)
      || before.gid !== BigInt(input.expectedOwner.gid)
      || !input.allowedModes.includes(modeBits(before))
      || !sameFingerprint(fingerprint(before), fingerprint(after))
    ) {
      return fail(input.errorCode, "Lease parent does not match its exact physical boundary");
    }
    return fingerprint(after);
  } catch (error) {
    if (error instanceof DarwinParentDescriptorLeaseErrorV2) throw error;
    return fail(input.errorCode, "Lease parent could not be captured", error);
  }
}

function captureSystemTool<RefV2 extends SystemToolRefV2>(
  absolutePath: typeof LOCKF_PATH_V2 | typeof LOCK_HELPER_PATH_V2,
  toolRef: RefV2,
): CapturedSystemToolV2<RefV2> {
  try {
    const ownerGid = Number(lstatSync(absolutePath, { bigint: true }).gid);
    const captured = stableFileHash({
      absolutePath,
      maxBytes: MAX_TOOL_BYTES_V2,
      expectedOwner: { uid: 0, gid: ownerGid },
      allowedModes: [0o755],
      allowedLinks: [1],
      errorCode: "DARWIN_PARENT_DESCRIPTOR_LEASE_V2_TOOL_INVALID",
    });
    return Object.freeze({
      toolRef,
      contentHash: captured.contentHash,
      byteLength: Number(captured.fingerprint.byteLength),
      mode: "0755",
      ownerUid: 0,
      ownerGid,
      linkCount: 1,
      fingerprint: captured.fingerprint,
    });
  } catch (error) {
    if (error instanceof DarwinParentDescriptorLeaseErrorV2) throw error;
    return fail(
      "DARWIN_PARENT_DESCRIPTOR_LEASE_V2_TOOL_INVALID",
      "Lease system tool could not be captured",
      error,
    );
  }
}

function systemToolEvidence<RefV2 extends SystemToolRefV2>(
  tool: CapturedSystemToolV2<RefV2>,
): DarwinParentDescriptorLeaseSystemToolEvidenceV2<RefV2> {
  return Object.freeze({
    toolRef: tool.toolRef,
    contentHash: tool.contentHash,
    byteLength: tool.byteLength,
    mode: tool.mode,
    ownerUid: tool.ownerUid,
    ownerGid: tool.ownerGid,
    linkCount: tool.linkCount,
  });
}

function assertSystemToolCurrent(
  absolutePath: typeof LOCKF_PATH_V2 | typeof LOCK_HELPER_PATH_V2,
  expected: CapturedSystemToolV2,
): void {
  const current = captureSystemTool(absolutePath, expected.toolRef);
  if (
    current.contentHash !== expected.contentHash
    || !sameFingerprint(current.fingerprint, expected.fingerprint)
  ) {
    return fail(
      "DARWIN_PARENT_DESCRIPTOR_LEASE_V2_LOST",
      "Lease system tool changed while the kernel lease was held",
    );
  }
}

async function waitForChildExit(
  child: ReturnType<typeof spawn>,
  timeoutMs = 5_000,
): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = (error?: Error): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.off("close", onClose);
      child.off("error", onError);
      if (error) reject(error);
      else resolve();
    };
    const onClose = () => finish();
    const onError = (error: Error) => finish(error);
    const timer = setTimeout(() => finish(new Error("lease helper exit timeout")), timeoutMs);
    child.once("close", onClose);
    child.once("error", onError);
    if (child.exitCode !== null || child.signalCode !== null) finish();
  });
}

export async function acquireDarwinParentDescriptorLeaseV2(input: Readonly<{
  parentPath: string;
  lockPath: string;
  lockBytes: Uint8Array;
  expectedOwner: Readonly<{ uid: number; gid: number }>;
  allowedParentModes: readonly (0o700 | 0o755)[];
}>): Promise<DarwinParentDescriptorLeaseV2> {
  if (process.platform !== "darwin") {
    return fail(
      "DARWIN_PARENT_DESCRIPTOR_LEASE_V2_PLATFORM_UNSUPPORTED",
      "Parent descriptor lease requires Darwin /usr/bin/lockf",
    );
  }
  const parentPath = normalizedAbsolute(input.parentPath, "Lease parent");
  const lockPath = normalizedAbsolute(input.lockPath, "Lease lock");
  if (path.dirname(lockPath) !== parentPath) {
    return fail(
      "DARWIN_PARENT_DESCRIPTOR_LEASE_V2_INPUT_INVALID",
      "Lease lock must be one direct child of its parent",
    );
  }
  const expectedOwner = exactOwner(input.expectedOwner);
  const allowedParentModes = [...input.allowedParentModes];
  if (
    allowedParentModes.length < 1
    || allowedParentModes.length > 2
    || new Set(allowedParentModes).size !== allowedParentModes.length
    || allowedParentModes.some((mode) => mode !== 0o700 && mode !== 0o755)
  ) {
    return fail(
      "DARWIN_PARENT_DESCRIPTOR_LEASE_V2_INPUT_INVALID",
      "Lease parent modes are not one exact bounded set",
    );
  }
  const expectedLockBytes = Buffer.from(input.lockBytes);
  if (expectedLockBytes.byteLength < 1 || expectedLockBytes.byteLength > 4_096) {
    expectedLockBytes.fill(0);
    return fail(
      "DARWIN_PARENT_DESCRIPTOR_LEASE_V2_INPUT_INVALID",
      "Lease lock bytes exceed their exact bound",
    );
  }
  const expectedLockHash = createHash("sha256").update(expectedLockBytes).digest("hex");
  const lockf = captureSystemTool(LOCKF_PATH_V2, "MACOS_LOCKF_V2");
  const lockHelper = captureSystemTool(LOCK_HELPER_PATH_V2, "MACOS_CAT_LOCK_HELPER_V2");
  const expectedParent = assertDirectory({
    absolutePath: parentPath,
    expectedOwner,
    allowedModes: allowedParentModes,
    errorCode: "DARWIN_PARENT_DESCRIPTOR_LEASE_V2_BOUNDARY_INVALID",
  });
  const expectedLock = stableFileHash({
    absolutePath: lockPath,
    maxBytes: expectedLockBytes.byteLength,
    expectedOwner,
    allowedModes: [0o600],
    allowedLinks: [1],
    errorCode: "DARWIN_PARENT_DESCRIPTOR_LEASE_V2_BOUNDARY_INVALID",
  });
  if (
    expectedLock.contentHash !== expectedLockHash
    || expectedLock.fingerprint.byteLength !== BigInt(expectedLockBytes.byteLength)
  ) {
    expectedLockBytes.fill(0);
    return fail(
      "DARWIN_PARENT_DESCRIPTOR_LEASE_V2_BOUNDARY_INVALID",
      "Lease lock does not contain its exact canonical bytes",
    );
  }
  expectedLockBytes.fill(0);
  let descriptor: number | undefined;
  let child: ReturnType<typeof spawn> | undefined;
  try {
    descriptor = openSync(lockPath, constants.O_RDWR | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    if (!sameFingerprint(
      fingerprint(fstatSync(descriptor, { bigint: true })),
      expectedLock.fingerprint,
    )) {
      return fail(
        "DARWIN_PARENT_DESCRIPTOR_LEASE_V2_LOST",
        "Lease lock changed while its inherited descriptor was opened",
      );
    }
    const token = `setfarm-darwin-parent-descriptor-lease:${randomUUID()}\n`;
    child = spawn(LOCKF_PATH_V2, [
      "-s",
      "-t",
      String(LOCK_ACQUISITION_TIMEOUT_SECONDS_V2),
      "/dev/fd/3",
      LOCK_HELPER_PATH_V2,
    ], {
      env: { LANG: "C", LC_ALL: "C", TZ: "UTC" },
      shell: false,
      stdio: ["pipe", "pipe", "pipe", descriptor],
      windowsHide: true,
    });
    let stdinError: Error | undefined;
    child.stdin!.on("error", (error) => { stdinError = error; });
    let stderr = "";
    child.stderr!.on("data", (chunk: Buffer) => {
      const remaining = 4_096 - Buffer.byteLength(stderr, "utf8");
      if (remaining > 0) stderr += chunk.subarray(0, remaining).toString("utf8");
    });
    await new Promise<void>((resolve, reject) => {
      let output = "";
      let settled = false;
      const finish = (error?: Error): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        child!.stdout!.off("data", onData);
        child!.off("close", onClose);
        child!.off("error", onError);
        if (error) reject(error);
        else resolve();
      };
      const onData = (chunk: Buffer): void => {
        output += chunk.toString("utf8");
        if (output === token) finish();
        else if (output.length > token.length || !token.startsWith(output)) {
          finish(new Error("lease helper emitted non-canonical readiness output"));
        }
      };
      const onClose = (code: number | null, signal: NodeJS.Signals | null): void => {
        finish(code === 75 && signal === null
          ? new DarwinParentDescriptorLeaseErrorV2(
              "DARWIN_PARENT_DESCRIPTOR_LEASE_V2_TIMEOUT",
              "Parent descriptor lease acquisition timed out",
            )
          : new DarwinParentDescriptorLeaseErrorV2(
              "DARWIN_PARENT_DESCRIPTOR_LEASE_V2_LOST",
              `Parent descriptor lease helper exited before readiness (${code ?? signal}); ${stderr}`,
            ));
      };
      const onError = (error: Error): void => finish(error);
      const timer = setTimeout(
        () => finish(new DarwinParentDescriptorLeaseErrorV2(
          "DARWIN_PARENT_DESCRIPTOR_LEASE_V2_TIMEOUT",
          "Parent descriptor lease readiness protocol timed out",
        )),
        LOCK_PROTOCOL_TIMEOUT_MS_V2,
      );
      child!.stdout!.on("data", onData);
      child!.once("close", onClose);
      child!.once("error", onError);
      child!.stdin!.write(token);
    });
    closeSync(descriptor);
    descriptor = undefined;
    let released = false;
    const activeChild = child;
    const assertCurrent = (): void => {
      if (
        released
        || activeChild.exitCode !== null
        || activeChild.signalCode !== null
        || activeChild.stdin!.destroyed
        || stdinError
      ) {
        return fail(
          "DARWIN_PARENT_DESCRIPTOR_LEASE_V2_LOST",
          "Parent descriptor kernel lease is no longer held",
        );
      }
      const currentLock = stableFileHash({
        absolutePath: lockPath,
        maxBytes: Number(expectedLock.fingerprint.byteLength),
        expectedOwner,
        allowedModes: [0o600],
        allowedLinks: [1],
        errorCode: "DARWIN_PARENT_DESCRIPTOR_LEASE_V2_LOST",
      });
      const currentParent = assertDirectory({
        absolutePath: parentPath,
        expectedOwner,
        allowedModes: allowedParentModes,
        errorCode: "DARWIN_PARENT_DESCRIPTOR_LEASE_V2_LOST",
      });
      if (
        currentLock.contentHash !== expectedLockHash
        || !sameFingerprint(currentLock.fingerprint, expectedLock.fingerprint)
        || !samePhysicalIdentity(currentParent, expectedParent)
      ) {
        return fail(
          "DARWIN_PARENT_DESCRIPTOR_LEASE_V2_LOST",
          "Parent descriptor lease boundary changed while held",
        );
      }
      assertSystemToolCurrent(LOCKF_PATH_V2, lockf);
      assertSystemToolCurrent(LOCK_HELPER_PATH_V2, lockHelper);
    };
    const release = async (): Promise<void> => {
      if (released) return;
      released = true;
      activeChild.stdin!.end();
      try {
        await waitForChildExit(activeChild);
      } catch (error) {
        if (activeChild.exitCode === null && activeChild.signalCode === null) {
          activeChild.kill("SIGKILL");
          await waitForChildExit(activeChild).catch(() => undefined);
        }
        return fail(
          "DARWIN_PARENT_DESCRIPTOR_LEASE_V2_LOST",
          "Parent descriptor lease helper did not terminate after release",
          error,
        );
      }
      if (activeChild.exitCode !== 0 || activeChild.signalCode !== null || stdinError) {
        return fail(
          "DARWIN_PARENT_DESCRIPTOR_LEASE_V2_LOST",
          "Parent descriptor lease helper exited abnormally",
        );
      }
    };
    assertCurrent();
    return Object.freeze({
      parentPhysicalIdentity: Object.freeze({
        device: expectedParent.device,
        inode: expectedParent.inode,
      }),
      evidence: Object.freeze({
        contractRef: "DARWIN_PARENT_DESCRIPTOR_LEASE_V2" as const,
        executionPolicy: "exact_lockf_fd_then_exact_cat_pipe_v2" as const,
        lockf: systemToolEvidence(lockf),
        lockHelper: systemToolEvidence(lockHelper),
      }),
      assertCurrent,
      release,
    });
  } catch (error) {
    if (child && child.exitCode === null && child.signalCode === null) {
      child.stdin?.destroy();
      child.kill("SIGKILL");
      await waitForChildExit(child).catch(() => undefined);
    }
    if (error instanceof DarwinParentDescriptorLeaseErrorV2) throw error;
    return fail(
      "DARWIN_PARENT_DESCRIPTOR_LEASE_V2_LOST",
      "Parent descriptor kernel lease failed",
      error,
    );
  } finally {
    closeQuietly(descriptor);
  }
}
