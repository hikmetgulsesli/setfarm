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
import { isProxy } from "node:util/types";

import { canonicalJsonBytes } from "./canonical-json.js";
import { renderNodeToolchainProvisionerBootstrapLauncherV2 } from "./node-toolchain-provisioner-bootstrap-v2.js";
import {
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_BUNDLE_LOCATOR_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_LAUNCHER_LOCATOR_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MANIFEST_LOCATOR_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MAX_MANIFEST_BYTES_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROOT_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_RUNTIME_LOCATOR_V2,
  NodeToolchainProvisionerBootstrapManifestV2Schema,
  type NodeToolchainProvisionerBootstrapManifestV2,
} from "./schemas/node-toolchain-provisioner-bootstrap-v2.js";

export type NodeToolchainProvisionerBootstrapPackageErrorCodeV2 =
  | "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_V2_INPUT_INVALID"
  | "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_V2_ROOT_INVALID"
  | "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_V2_MANIFEST_INVALID"
  | "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_V2_LAYOUT_INVALID"
  | "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_V2_FILE_INVALID"
  | "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_V2_FILE_MISMATCH"
  | "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_V2_PROCESS_INVALID"
  | "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_V2_HANDLE_UNAUTHENTICATED"
  | "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_V2_PACKAGE_DRIFT";

export class NodeToolchainProvisionerBootstrapPackageErrorV2 extends Error {
  readonly code: NodeToolchainProvisionerBootstrapPackageErrorCodeV2;
  override readonly cause?: unknown;

  constructor(
    code: NodeToolchainProvisionerBootstrapPackageErrorCodeV2,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message.slice(0, 1_200), options);
    this.name = "NodeToolchainProvisionerBootstrapPackageErrorV2";
    this.code = code;
    this.cause = options?.cause;
  }
}

type ExpectedOwnerV2 = Readonly<{ uid: number; gid: number }>;

type FingerprintV2 = Readonly<{
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

type DirectoryCaptureV2 = Readonly<{
  locator: "." | "bin" | "lib" | "runtime";
  fingerprint: FingerprintV2;
  entries: readonly string[];
}>;

type FileCaptureV2 = Readonly<{
  locator: string;
  fingerprint: FingerprintV2;
  sha256: string;
}>;

type VerifiedPackageStateV2 = Readonly<{
  admissionScope: "production_root" | "test_fixture";
  root: string;
  expectedOwner: ExpectedOwnerV2;
  manifest: NodeToolchainProvisionerBootstrapManifestV2;
  directories: readonly DirectoryCaptureV2[];
  files: readonly FileCaptureV2[];
}>;

const handleCapabilityV2 = Object.freeze({});
const packageStatesV2 = new WeakMap<object, VerifiedPackageStateV2>();

export class VerifiedNodeToolchainProvisionerBootstrapPackageV2 {
  readonly manifestHash: string;

  constructor(capability: object, state: VerifiedPackageStateV2) {
    if (capability !== handleCapabilityV2) {
      throw new NodeToolchainProvisionerBootstrapPackageErrorV2(
        "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_V2_HANDLE_UNAUTHENTICATED",
        "Bootstrap package constructor capability is unavailable",
      );
    }
    this.manifestHash = state.manifest.manifestHash;
    packageStatesV2.set(this, state);
    Object.freeze(this);
  }
}

function fail(
  code: NodeToolchainProvisionerBootstrapPackageErrorCodeV2,
  message: string,
  cause?: unknown,
): never {
  throw new NodeToolchainProvisionerBootstrapPackageErrorV2(
    code,
    message,
    cause === undefined ? undefined : { cause },
  );
}

function modeBits(stat: Stats): number {
  return stat.mode & 0o7777;
}

function fingerprint(stat: Stats): FingerprintV2 {
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

function sameFingerprint(left: FingerprintV2, right: FingerprintV2): boolean {
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

function normalizedRoot(input: unknown): string {
  if (
    typeof input !== "string"
    || input.length < 1
    || input.length > 1_024
    || input.includes("\0")
    || !path.isAbsolute(input)
    || path.normalize(input) !== input
  ) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_V2_INPUT_INVALID",
      "Bootstrap package root must be one normalized absolute locator",
    );
  }
  return input;
}

function exactOwner(input: unknown): ExpectedOwnerV2 {
  try {
    if (
      typeof input !== "object"
      || input === null
      || isProxy(input)
      || Object.getPrototypeOf(input) !== Object.prototype
    ) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_V2_INPUT_INVALID",
        "Bootstrap expected owner must be one plain exact object",
      );
    }
    const descriptors = Object.getOwnPropertyDescriptors(input);
    const keys = Reflect.ownKeys(input).sort();
    if (keys.length !== 2 || keys[0] !== "gid" || keys[1] !== "uid") {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_V2_INPUT_INVALID",
        "Bootstrap expected owner has unknown or missing fields",
      );
    }
    const uid = descriptors.uid && "value" in descriptors.uid ? descriptors.uid.value : undefined;
    const gid = descriptors.gid && "value" in descriptors.gid ? descriptors.gid.value : undefined;
    if (
      !Number.isSafeInteger(uid)
      || uid < 0
      || uid > 2_147_483_647
      || !Number.isSafeInteger(gid)
      || gid < 0
      || gid > 2_147_483_647
    ) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_V2_INPUT_INVALID",
        "Bootstrap expected owner identities are invalid",
      );
    }
    return Object.freeze({ uid, gid });
  } catch (error) {
    if (error instanceof NodeToolchainProvisionerBootstrapPackageErrorV2) throw error;
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_V2_INPUT_INVALID",
      "Bootstrap expected owner could not be inspected safely",
      error,
    );
  }
}

function captureDirectory(
  root: string,
  locator: DirectoryCaptureV2["locator"],
  expectedOwner: ExpectedOwnerV2,
  expectedEntries: readonly string[],
): DirectoryCaptureV2 {
  const absolutePath = locator === "." ? root : path.join(root, locator);
  try {
    const before = lstatSync(absolutePath);
    if (
      before.isSymbolicLink()
      || !before.isDirectory()
      || before.uid !== expectedOwner.uid
      || before.gid !== expectedOwner.gid
      || modeBits(before) !== 0o555
      || realpathSync(absolutePath) !== absolutePath
    ) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_V2_LAYOUT_INVALID",
        `Bootstrap directory ${locator} does not match its exact owner and mode`,
      );
    }
    const entries = readdirSync(absolutePath).sort();
    if (
      entries.length !== expectedEntries.length
      || entries.some((entry, index) => entry !== expectedEntries[index])
    ) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_V2_LAYOUT_INVALID",
        `Bootstrap directory ${locator} is not every-and-only`,
      );
    }
    const after = lstatSync(absolutePath);
    if (!sameFingerprint(fingerprint(before), fingerprint(after))) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_V2_LAYOUT_INVALID",
        `Bootstrap directory ${locator} changed during enumeration`,
      );
    }
    return Object.freeze({
      locator,
      fingerprint: fingerprint(after),
      entries: Object.freeze(entries),
    });
  } catch (error) {
    if (error instanceof NodeToolchainProvisionerBootstrapPackageErrorV2) throw error;
    return fail(
      locator === "."
        ? "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_V2_ROOT_INVALID"
        : "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_V2_LAYOUT_INVALID",
      `Bootstrap directory ${locator} could not be verified`,
      error,
    );
  }
}

function readExactFile(input: Readonly<{
  root: string;
  locator: string;
  expectedOwner: ExpectedOwnerV2;
  expectedMode: 0o444 | 0o555;
  expectedLength?: number;
  maxLength: number;
  expectedSha256?: string;
}>): Readonly<{ bytes: Buffer; capture: FileCaptureV2 }> {
  const absolutePath = path.join(input.root, input.locator);
  let descriptor: number | undefined;
  let bytes: Buffer | undefined;
  let released = false;
  try {
    descriptor = openSync(
      absolutePath,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
    const before = fstatSync(descriptor);
    if (
      !before.isFile()
      || before.uid !== input.expectedOwner.uid
      || before.gid !== input.expectedOwner.gid
      || before.nlink !== 1
      || modeBits(before) !== input.expectedMode
      || before.size < 1
      || before.size > input.maxLength
      || (input.expectedLength !== undefined && before.size !== input.expectedLength)
    ) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_V2_FILE_INVALID",
        `Bootstrap file ${input.locator} does not match its exact metadata`,
      );
    }
    bytes = Buffer.allocUnsafeSlow(before.size);
    let offset = 0;
    while (offset < bytes.byteLength) {
      const count = readSync(descriptor, bytes, offset, bytes.byteLength - offset, null);
      if (count < 1) {
        return fail(
          "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_V2_FILE_INVALID",
          `Bootstrap file ${input.locator} ended before its inspected length`,
        );
      }
      offset += count;
    }
    const eof = Buffer.allocUnsafe(1);
    if (readSync(descriptor, eof, 0, 1, null) !== 0) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_V2_FILE_INVALID",
        `Bootstrap file ${input.locator} exceeded its inspected length`,
      );
    }
    const after = fstatSync(descriptor);
    const pathAfter = lstatSync(absolutePath);
    if (
      !sameFingerprint(fingerprint(before), fingerprint(after))
      || !sameFingerprint(fingerprint(after), fingerprint(pathAfter))
    ) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_V2_FILE_INVALID",
        `Bootstrap file ${input.locator} changed during its bounded read`,
      );
    }
    const digest = createHash("sha256").update(bytes).digest("hex");
    if (input.expectedSha256 !== undefined && digest !== input.expectedSha256) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_V2_FILE_MISMATCH",
        `Bootstrap file ${input.locator} bytes do not match the manifest`,
      );
    }
    const result = Object.freeze({
      bytes,
      capture: Object.freeze({
        locator: input.locator,
        fingerprint: fingerprint(after),
        sha256: digest,
      }),
    });
    released = true;
    return result;
  } catch (error) {
    if (error instanceof NodeToolchainProvisionerBootstrapPackageErrorV2) throw error;
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_V2_FILE_INVALID",
      `Bootstrap file ${input.locator} could not be read safely`,
      error,
    );
  } finally {
    if (!released) bytes?.fill(0);
    if (descriptor !== undefined) {
      try {
        closeSync(descriptor);
      } catch {
        // The exact read result owns the verification outcome.
      }
    }
  }
}

function verifyPackage(input: Readonly<{
  admissionScope: "production_root" | "test_fixture";
  root: string;
  expectedOwner: ExpectedOwnerV2;
}>): VerifiedPackageStateV2 {
  const root = normalizedRoot(input.root);
  const expectedOwner = input.expectedOwner;
  const directories: DirectoryCaptureV2[] = [];
  const files: FileCaptureV2[] = [];
  directories.push(captureDirectory(root, ".", expectedOwner, [
    NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MANIFEST_LOCATOR_V2,
    "bin",
    "lib",
    "runtime",
  ]));
  directories.push(captureDirectory(root, "bin", expectedOwner, [
    path.basename(NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_LAUNCHER_LOCATOR_V2),
  ]));
  directories.push(captureDirectory(root, "lib", expectedOwner, [
    path.basename(NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_BUNDLE_LOCATOR_V2),
  ]));
  directories.push(captureDirectory(root, "runtime", expectedOwner, [
    path.basename(NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_RUNTIME_LOCATOR_V2),
  ]));

  const manifestRead = readExactFile({
    root,
    locator: NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MANIFEST_LOCATOR_V2,
    expectedOwner,
    expectedMode: 0o444,
    maxLength: NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MAX_MANIFEST_BYTES_V2,
  });
  files.push(manifestRead.capture);
  let manifest: NodeToolchainProvisionerBootstrapManifestV2;
  try {
    const raw = JSON.parse(manifestRead.bytes.toString("utf8"));
    const parsed = NodeToolchainProvisionerBootstrapManifestV2Schema.safeParse(raw);
    if (!parsed.success || !manifestRead.bytes.equals(canonicalJsonBytes(parsed.success ? parsed.data : raw))) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_V2_MANIFEST_INVALID",
        "Bootstrap manifest is not one exact canonical V2 artifact",
        parsed.success ? undefined : parsed.error,
      );
    }
    manifest = deepFreezeJson(parsed.data);
  } catch (error) {
    if (error instanceof NodeToolchainProvisionerBootstrapPackageErrorV2) throw error;
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_V2_MANIFEST_INVALID",
      "Bootstrap manifest is not bounded canonical JSON",
      error,
    );
  } finally {
    manifestRead.bytes.fill(0);
  }
  if (
    manifest.admissionScope !== input.admissionScope
    || manifest.layout.rootLocator !== root
    || manifest.layout.expectedOwnerUid !== expectedOwner.uid
    || manifest.layout.expectedOwnerGid !== expectedOwner.gid
  ) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_V2_MANIFEST_INVALID",
      "Bootstrap manifest scope, root or owner does not equal verifier authority",
    );
  }

  const expectedLauncher = renderNodeToolchainProvisionerBootstrapLauncherV2({
    rootLocator: root,
    expectedOwnerUid: expectedOwner.uid,
    expectedOwnerGid: expectedOwner.gid,
    bundleSha256: manifest.files.bundle.sha256,
    bundleByteLength: manifest.files.bundle.byteLength,
    runtimeSha256: manifest.files.bootstrapRuntime.sha256,
    runtimeByteLength: manifest.files.bootstrapRuntime.byteLength,
  });
  try {
    const fileSpecs = [
      manifest.files.launcher,
      manifest.files.bundle,
      manifest.files.bootstrapRuntime,
    ] as const;
    for (const spec of fileSpecs) {
      const read = readExactFile({
        root,
        locator: spec.locator,
        expectedOwner,
        expectedMode: spec.mode === "0555" ? 0o555 : 0o444,
        expectedLength: spec.byteLength,
        maxLength: spec.byteLength,
        expectedSha256: spec.sha256,
      });
      try {
        if (
          spec.locator === NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_LAUNCHER_LOCATOR_V2
          && !read.bytes.equals(expectedLauncher)
        ) {
          return fail(
            "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_V2_FILE_MISMATCH",
            "Bootstrap launcher bytes are not reproduced by the manifest contract",
          );
        }
        files.push(read.capture);
      } finally {
        read.bytes.fill(0);
      }
    }
  } finally {
    expectedLauncher.fill(0);
  }

  const expectedDirectoryEntries = [
    [
      NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MANIFEST_LOCATOR_V2,
      "bin",
      "lib",
      "runtime",
    ],
    [path.basename(NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_LAUNCHER_LOCATOR_V2)],
    [path.basename(NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_BUNDLE_LOCATOR_V2)],
    [path.basename(NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_RUNTIME_LOCATOR_V2)],
  ] as const;
  for (let index = 0; index < directories.length; index += 1) {
    const initial = directories[index]!;
    const recaptured = captureDirectory(
      root,
      initial.locator,
      expectedOwner,
      expectedDirectoryEntries[index]!,
    );
    if (!sameFingerprint(initial.fingerprint, recaptured.fingerprint)) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_V2_LAYOUT_INVALID",
        `Bootstrap directory ${initial.locator} changed while package files were verified`,
      );
    }
  }
  return Object.freeze({
    admissionScope: input.admissionScope,
    root,
    expectedOwner,
    manifest,
    directories: Object.freeze(directories),
    files: Object.freeze(files),
  });
}

function authenticState(
  handle: VerifiedNodeToolchainProvisionerBootstrapPackageV2,
): VerifiedPackageStateV2 {
  if (
    typeof handle !== "object"
    || handle === null
    || isProxy(handle)
    || Object.getPrototypeOf(handle) !== VerifiedNodeToolchainProvisionerBootstrapPackageV2.prototype
  ) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_V2_HANDLE_UNAUTHENTICATED",
      "Bootstrap package operation requires one authentic handle",
    );
  }
  const state = packageStatesV2.get(handle);
  if (!state) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_V2_HANDLE_UNAUTHENTICATED",
      "Bootstrap package handle was not issued by the fresh verifier",
    );
  }
  return state;
}

function samePackageState(left: VerifiedPackageStateV2, right: VerifiedPackageStateV2): boolean {
  return left.manifest.manifestHash === right.manifest.manifestHash
    && left.directories.length === right.directories.length
    && left.files.length === right.files.length
    && left.directories.every((directory, index) => {
      const next = right.directories[index];
      return next !== undefined
        && directory.locator === next.locator
        && sameFingerprint(directory.fingerprint, next.fingerprint);
    })
    && left.files.every((file, index) => {
      const next = right.files[index];
      return next !== undefined
        && file.locator === next.locator
        && file.sha256 === next.sha256
        && sameFingerprint(file.fingerprint, next.fingerprint);
    });
}

export function openProductionNodeToolchainProvisionerBootstrapPackageV2():
VerifiedNodeToolchainProvisionerBootstrapPackageV2 {
  const state = verifyPackage({
    admissionScope: "production_root",
    root: NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROOT_V2,
    expectedOwner: { uid: 0, gid: 0 },
  });
  return new VerifiedNodeToolchainProvisionerBootstrapPackageV2(handleCapabilityV2, state);
}

export function openNodeToolchainProvisionerBootstrapPackageV2ForTest(input: unknown):
VerifiedNodeToolchainProvisionerBootstrapPackageV2 {
  try {
    if (
      typeof input !== "object"
      || input === null
      || isProxy(input)
      || Object.getPrototypeOf(input) !== Object.prototype
    ) {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_V2_INPUT_INVALID",
        "Test bootstrap verifier input must be one plain exact object",
      );
    }
    const descriptors = Object.getOwnPropertyDescriptors(input);
    const keys = Reflect.ownKeys(input).sort();
    if (keys.length !== 2 || keys[0] !== "expectedOwner" || keys[1] !== "root") {
      return fail(
        "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_V2_INPUT_INVALID",
        "Test bootstrap verifier input has unknown or missing fields",
      );
    }
    const root = descriptors.root && "value" in descriptors.root ? descriptors.root.value : undefined;
    const owner = descriptors.expectedOwner && "value" in descriptors.expectedOwner
      ? descriptors.expectedOwner.value
      : undefined;
    const state = verifyPackage({
      admissionScope: "test_fixture",
      root: normalizedRoot(root),
      expectedOwner: exactOwner(owner),
    });
    return new VerifiedNodeToolchainProvisionerBootstrapPackageV2(handleCapabilityV2, state);
  } catch (error) {
    if (error instanceof NodeToolchainProvisionerBootstrapPackageErrorV2) throw error;
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_V2_INPUT_INVALID",
      "Test bootstrap verifier input could not be inspected safely",
      error,
    );
  }
}

export function inspectNodeToolchainProvisionerBootstrapPackageV2(
  handle: VerifiedNodeToolchainProvisionerBootstrapPackageV2,
): NodeToolchainProvisionerBootstrapManifestV2 {
  return deepFreezeJson(structuredClone(authenticState(handle).manifest));
}

export function revalidateNodeToolchainProvisionerBootstrapPackageV2(
  handle: VerifiedNodeToolchainProvisionerBootstrapPackageV2,
): NodeToolchainProvisionerBootstrapManifestV2 {
  const state = authenticState(handle);
  const fresh = verifyPackage({
    admissionScope: state.admissionScope,
    root: state.root,
    expectedOwner: state.expectedOwner,
  });
  if (!samePackageState(state, fresh)) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_V2_PACKAGE_DRIFT",
      "Bootstrap package physical identity changed after authority issuance",
    );
  }
  return deepFreezeJson(structuredClone(fresh.manifest));
}

const EXACT_PROCESS_ENVIRONMENT_KEYS_V2 = Object.freeze([
  "HOME",
  "LANG",
  "LC_ALL",
  "NO_COLOR",
  "SETFARM_NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MANIFEST_V2",
  "SETFARM_NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_V2",
  "TMPDIR",
  "TZ",
]);

export function assertProductionNodeToolchainProvisionerBootstrapProcessV2(
  handle: VerifiedNodeToolchainProvisionerBootstrapPackageV2,
): NodeToolchainProvisionerBootstrapManifestV2 {
  const state = authenticState(handle);
  if (state.admissionScope !== "production_root") {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_V2_PROCESS_INVALID",
      "Test bootstrap package authority cannot admit a production process",
    );
  }
  const manifest = revalidateNodeToolchainProvisionerBootstrapPackageV2(handle);
  const runtimePath = path.join(state.root, NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_RUNTIME_LOCATOR_V2);
  const bundlePath = path.join(state.root, NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_BUNDLE_LOCATOR_V2);
  const manifestPath = path.join(state.root, NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MANIFEST_LOCATOR_V2);
  const environmentKeys = Object.keys(process.env).sort();
  const currentUmask = process.umask();
  if (
    process.platform !== "darwin"
    || process.arch !== manifest.distribution.architecture
    || typeof process.getuid !== "function"
    || typeof process.getgid !== "function"
    || process.getuid() !== 0
    || process.getgid() !== 0
    || process.execPath !== runtimePath
    || realpathSync(process.execPath) !== runtimePath
    || process.argv[1] !== bundlePath
    || realpathSync(process.argv[1]) !== bundlePath
    || process.cwd() !== state.root
    || realpathSync(process.cwd()) !== state.root
    || currentUmask !== 0o077
    || process.versions.node !== "22.23.1"
    || process.versions.modules !== "127"
    || process.versions.napi !== "10"
    || environmentKeys.length !== EXACT_PROCESS_ENVIRONMENT_KEYS_V2.length
    || environmentKeys.some((key, index) => key !== EXACT_PROCESS_ENVIRONMENT_KEYS_V2[index])
    || process.env.HOME !== "/var/empty"
    || process.env.LANG !== "C"
    || process.env.LC_ALL !== "C"
    || process.env.NO_COLOR !== "1"
    || process.env.TMPDIR !== "/private/var/tmp"
    || process.env.TZ !== "UTC"
    || process.env.SETFARM_NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_V2 !== "1"
    || process.env.SETFARM_NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MANIFEST_V2 !== manifestPath
  ) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_V2_PROCESS_INVALID",
      "Provisioner process does not equal the verified root-owned runtime, bundle and sealed environment",
    );
  }
  return manifest;
}
