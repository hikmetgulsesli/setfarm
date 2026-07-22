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
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeSync,
  type Stats,
} from "node:fs";
import path from "node:path";
import { isProxy } from "node:util/types";

import {
  copyVerifiedDeepByteBundleBytesV2,
  type VerifiedDeepByteBundleV2,
} from "./deep-byte-bundle-verifier-v2.js";
import { hashCanonicalJson } from "./canonical-json.js";
import {
  getCodeOwnedNodeScaffoldAssetPublicationV2,
  getCodeOwnedNodeScaffoldToolchainCatalogV2,
  getCodeOwnedNodeScaffoldToolchainEntryV2,
  type NodeScaffoldAssetRoleV2,
  type NodeScaffoldProfileIdV2,
} from "./node-scaffold-toolchain-catalog-v2.js";
import {
  inspectNodeScaffoldExecutionEnvironmentReceiptV2,
  isProductionNodeScaffoldExecutionEnvironmentV2,
  revalidateNodeScaffoldExecutionEnvironmentV2,
  type NodeScaffoldExecutionEnvironmentV2,
} from "./node-scaffold-execution-environment-v2.js";
import {
  PRIVATE_STAGED_MATERIALIZER_AUTHORITY_REF_V2,
  PRIVATE_STAGED_MATERIALIZER_AUTHORITY_V2_SCHEMA,
  PRIVATE_STAGED_MATERIALIZER_VERSION_V2,
  SCAFFOLD_BASE_MATERIALIZATION_RECEIPT_V2_SCHEMA,
  PrivateStagedMaterializerAuthorityV2Schema,
  ScaffoldBaseMaterializationReceiptV2Schema,
  hashPrivateStagedMaterializerAuthorityV2,
  hashScaffoldBaseMaterializationReceiptV2,
  hashScaffoldBaseSemanticInputV2,
  hashScaffoldBaseStateV2,
  type PrivateStagedMaterializerAuthorityV2,
  type ScaffoldBaseMaterializationReceiptHashPayloadV2,
  type ScaffoldBaseMaterializationReceiptV2,
} from "./schemas/node-scaffold-private-materialization-v2.js";
import {
  NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_RECEIPT_V2_SCHEMA,
} from "./schemas/node-scaffold-execution-environment-v2.js";
import {
  NODE_SCAFFOLD_TOOLCHAIN_CATALOG_V2_SCHEMA,
  NODE_SCAFFOLD_TOOLCHAIN_ENTRY_V2_SCHEMA,
} from "./schemas/node-scaffold-toolchain-catalog-v2.js";

const PRODUCTION_PRIVATE_ROOT_PREFIX_V2 =
  "/private/tmp/setfarm-node-scaffold-materializer-v2-" as const;
const ROOT_MEMBER_NAMES_V2 = Object.freeze(["dependency-capsule", "project"] as const);
const PROJECT_MEMBER_NAMES_V2 = Object.freeze([
  "package-lock.json",
  "package.json",
  "tsconfig.json",
] as const);

const ASSET_INPUTS_V2 = Object.freeze([
  Object.freeze({
    inputKey: "dependencyLockManifest" as const,
    role: "dependency_lock_manifest" as const,
    normalizedLocator: "package-lock.json" as const,
  }),
  Object.freeze({
    inputKey: "packageManifest" as const,
    role: "package_manifest" as const,
    normalizedLocator: "package.json" as const,
  }),
  Object.freeze({
    inputKey: "typescriptCompilerConfig" as const,
    role: "typescript_compiler_config" as const,
    normalizedLocator: "tsconfig.json" as const,
  }),
]);

export type NodeScaffoldPrivateMaterializerErrorCodeV2 =
  | "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_INPUT_INVALID"
  | "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_PRODUCTION_AUTHORITY_REQUIRED"
  | "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_ENVIRONMENT_INVALID"
  | "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_ASSET_AUTHORITY_INVALID"
  | "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_PRIVATE_ROOT_INVALID"
  | "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_MATERIALIZATION_FAILED"
  | "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_RECEIPT_INVALID"
  | "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_HANDLE_UNAUTHENTICATED"
  | "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_STATE_DRIFT"
  | "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_DESTROYED";

export class NodeScaffoldPrivateMaterializerErrorV2 extends Error {
  readonly code: NodeScaffoldPrivateMaterializerErrorCodeV2;
  override readonly cause?: unknown;

  constructor(
    code: NodeScaffoldPrivateMaterializerErrorCodeV2,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message.slice(0, 1_500), options);
    this.name = "NodeScaffoldPrivateMaterializerErrorV2";
    this.code = code;
    this.cause = options?.cause;
  }
}

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

type CapturedAssetV2 = Readonly<{
  role: NodeScaffoldAssetRoleV2;
  normalizedLocator: "package-lock.json" | "package.json" | "tsconfig.json";
  bytes: Buffer;
  rawHash: string;
  rawByteLength: number;
  verificationReceiptHash: string;
  consumerBindingHash: string;
}>;

type CapturedPhysicalAssetV2 = Readonly<{
  locator: "package-lock.json" | "package.json" | "tsconfig.json";
  fingerprint: FingerprintV2;
  contentHash: string;
  physicalIdentityHash: string;
}>;

type PrivateBaseCaptureV2 = Readonly<{
  rootFingerprint: FingerprintV2;
  rootIdentityHash: string;
  projectFingerprint: FingerprintV2;
  dependencyCapsuleFingerprint: FingerprintV2;
  physicalAssets: readonly CapturedPhysicalAssetV2[];
  fileMembershipHash: string;
  totalBytes: number;
  privateIdentityHash: string;
}>;

type MutableLifecycleV2 = { status: "base_ready" | "destroyed" };

type PrivateStageStateV2 = Readonly<{
  admissionScope: "production_host" | "test_fixture";
  profileId: NodeScaffoldProfileIdV2;
  environment: NodeScaffoldExecutionEnvironmentV2;
  privateRoot: string;
  projectRoot: string;
  dependencyCapsuleRoot: string;
  baseCapture: PrivateBaseCaptureV2;
  receipt: ScaffoldBaseMaterializationReceiptV2;
  lifecycle: MutableLifecycleV2;
}>;

const materializedStageConstructorCapabilityV2 = Object.freeze({});
const privateStageStateV2 = new WeakMap<object, PrivateStageStateV2>();

export class MaterializedNodeScaffoldPrivateStageV2 {
  readonly receiptHash: string;

  constructor(capability: object, state: PrivateStageStateV2) {
    if (capability !== materializedStageConstructorCapabilityV2) {
      throw new NodeScaffoldPrivateMaterializerErrorV2(
        "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_HANDLE_UNAUTHENTICATED",
        "Private scaffold stage constructor capability is unavailable",
      );
    }
    this.receiptHash = state.receipt.receiptHash;
    privateStageStateV2.set(this, state);
    Object.freeze(this);
  }
}

export type NodeScaffoldPrivateMaterializerCrashBoundaryV2 =
  | "after_private_root_fsync"
  | "after_layout_fsync"
  | "after_package_lock_fsync"
  | "after_package_json_fsync"
  | "after_tsconfig_fsync"
  | "after_project_fsync"
  | "after_final_capture";

export type NodeScaffoldPrivateMaterializerTestHooksV2 = Readonly<{
  afterBoundary?: (boundary: NodeScaffoldPrivateMaterializerCrashBoundaryV2) => void;
}>;

function fail(
  code: NodeScaffoldPrivateMaterializerErrorCodeV2,
  message: string,
  cause?: unknown,
): never {
  throw new NodeScaffoldPrivateMaterializerErrorV2(
    code,
    message,
    cause === undefined ? undefined : { cause },
  );
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function modeBits(stat: Stats): number {
  return stat.mode & 0o7777;
}

function fingerprint(stat: Stats): FingerprintV2 {
  return Object.freeze({
    device: stat.dev,
    inode: stat.ino,
    mode: modeBits(stat),
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

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value) || isProxy(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactDataRecord(
  input: unknown,
  expectedKeys: readonly string[],
): Readonly<Record<string, unknown>> {
  if (!isPlainRecord(input)) {
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_INPUT_INVALID",
      "Private scaffold materializer input must be one non-proxied plain object",
    );
  }
  const keys = Reflect.ownKeys(input);
  if (
    keys.length !== expectedKeys.length
    || keys.some((key) => typeof key !== "string" || !expectedKeys.includes(key))
  ) {
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_INPUT_INVALID",
      "Private scaffold materializer input fields are not exact",
    );
  }
  const descriptors = Object.getOwnPropertyDescriptors(input);
  const values: Record<string, unknown> = {};
  for (const key of expectedKeys) {
    const descriptor = descriptors[key];
    if (!descriptor || !("value" in descriptor) || descriptor.enumerable !== true) {
      return fail(
        "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_INPUT_INVALID",
        "Private scaffold materializer input must contain only enumerable data properties",
      );
    }
    values[key] = descriptor.value;
  }
  return Object.freeze(values);
}

function processOwnerV2(): Readonly<{ uid: number; gid: number }> {
  if (typeof process.geteuid !== "function" || typeof process.getegid !== "function") {
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_PRIVATE_ROOT_INVALID",
      "Private scaffold materialization requires exact POSIX process ownership",
    );
  }
  return Object.freeze({ uid: process.geteuid(), gid: process.getegid() });
}

function deepFreezeJson<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  const pending: object[] = [value as object];
  while (pending.length > 0) {
    const current = pending.pop()!;
    if (Object.isFrozen(current)) continue;
    for (const child of Object.values(current)) {
      if (child !== null && typeof child === "object" && !Object.isFrozen(child)) {
        pending.push(child);
      }
    }
    Object.freeze(current);
  }
  return value;
}

function defensiveCopy<T>(value: T): T {
  return deepFreezeJson(structuredClone(value));
}

function assertMissingPathV2(absolutePath: string, label: string): void {
  try {
    lstatSync(absolutePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_STATE_DRIFT",
      `${label} absence could not be established`,
      error,
    );
  }
  return fail(
    "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_STATE_DRIFT",
    `${label} must be absent`,
  );
}

function syncDirectoryV2(absolutePath: string): void {
  let descriptor: number | undefined;
  try {
    descriptor = openSync(absolutePath, constants.O_RDONLY | constants.O_NOFOLLOW);
    fsyncSync(descriptor);
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function validateScratchParentV2(value: unknown): string {
  if (typeof value !== "string" || !path.isAbsolute(value)) {
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_INPUT_INVALID",
      "Test private scaffold scratch parent must be one absolute path",
    );
  }
  const owner = processOwnerV2();
  try {
    const stat = lstatSync(value);
    if (
      stat.isSymbolicLink()
      || !stat.isDirectory()
      || realpathSync(value) !== value
      || modeBits(stat) !== 0o700
      || stat.uid !== owner.uid
      || stat.gid !== owner.gid
    ) {
      return fail(
        "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_INPUT_INVALID",
        "Test private scaffold scratch parent must be direct, canonical, mode-0700 and process-owned",
      );
    }
    return value;
  } catch (error) {
    if (error instanceof NodeScaffoldPrivateMaterializerErrorV2) throw error;
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_INPUT_INVALID",
      "Test private scaffold scratch parent cannot be verified",
      error,
    );
  }
}

function createPrivateLayoutV2(input: Readonly<{
  admissionScope: "production_host" | "test_fixture";
  scratchParent?: string;
  hooks?: NodeScaffoldPrivateMaterializerTestHooksV2;
}>): Readonly<{
  privateRoot: string;
  projectRoot: string;
  dependencyCapsuleRoot: string;
  initialRootFingerprint: FingerprintV2;
}> {
  const prefix = input.admissionScope === "production_host"
    ? PRODUCTION_PRIVATE_ROOT_PREFIX_V2
    : path.join(input.scratchParent!, "attempt-");
  const owner = processOwnerV2();
  let privateRoot: string | undefined;
  let initialRootFingerprint: FingerprintV2 | undefined;
  try {
    privateRoot = mkdtempSync(prefix);
    chmodSync(privateRoot, 0o700);
    initialRootFingerprint = fingerprint(lstatSync(privateRoot));
    if (
      realpathSync(privateRoot) !== privateRoot
      || initialRootFingerprint.mode !== 0o700
      || initialRootFingerprint.ownerUid !== owner.uid
      || initialRootFingerprint.ownerGid !== owner.gid
    ) {
      return fail(
        "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_PRIVATE_ROOT_INVALID",
        "Fresh private scaffold root is not direct, mode-0700 and process-owned",
      );
    }
    syncDirectoryV2(privateRoot);
    input.hooks?.afterBoundary?.("after_private_root_fsync");
    const projectRoot = path.join(privateRoot, "project");
    const dependencyCapsuleRoot = path.join(privateRoot, "dependency-capsule");
    mkdirSync(dependencyCapsuleRoot, { mode: 0o700 });
    mkdirSync(projectRoot, { mode: 0o700 });
    chmodSync(dependencyCapsuleRoot, 0o700);
    chmodSync(projectRoot, 0o700);
    syncDirectoryV2(dependencyCapsuleRoot);
    syncDirectoryV2(projectRoot);
    syncDirectoryV2(privateRoot);
    input.hooks?.afterBoundary?.("after_layout_fsync");
    const result = Object.freeze({
      privateRoot,
      projectRoot,
      dependencyCapsuleRoot,
      initialRootFingerprint,
    });
    privateRoot = undefined;
    return result;
  } catch (error) {
    if (error instanceof NodeScaffoldPrivateMaterializerErrorV2) throw error;
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_MATERIALIZATION_FAILED",
      "Fresh private scaffold layout could not be created",
      error,
    );
  } finally {
    if (privateRoot && initialRootFingerprint) {
      safeRemoveOwnedAttemptV2(privateRoot, initialRootFingerprint);
    }
  }
}

function captureAuthenticatedAssetsV2(input: Readonly<{
  profileId: NodeScaffoldProfileIdV2;
  values: Readonly<Record<string, unknown>>;
}>): readonly CapturedAssetV2[] {
  const publication = getCodeOwnedNodeScaffoldAssetPublicationV2();
  const captured: CapturedAssetV2[] = [];
  let completed = false;
  try {
    for (const descriptor of ASSET_INPUTS_V2) {
      const handle = input.values[descriptor.inputKey] as VerifiedDeepByteBundleV2;
      let bytes: Buffer;
      try {
        bytes = copyVerifiedDeepByteBundleBytesV2(handle);
      } catch (error) {
        return fail(
          "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_ASSET_AUTHORITY_INVALID",
          `Scaffold ${descriptor.normalizedLocator} lacks an authenticated deep-byte handle`,
          error,
        );
      }
      const expected = publication.files.find((file) =>
        file.profileId === input.profileId && file.role === descriptor.role);
      const receipt = handle.receipt;
      if (
        !expected
        || expected.normalizedLocator !== descriptor.normalizedLocator
        || receipt.bundle.rawHash !== expected.rawHash
        || receipt.bundle.rawByteLength !== expected.rawByteLength
        || receipt.bundle.envelopeHash !== expected.byteBundle.envelopeHash
        || receipt.binding.bindingHash !== expected.binding.bindingHash
        || receipt.binding.authorityHash !== publication.catalogHash
        || bytes.byteLength !== expected.rawByteLength
        || sha256(bytes) !== expected.rawHash
      ) {
        bytes.fill(0);
        return fail(
          "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_ASSET_AUTHORITY_INVALID",
          `Scaffold ${descriptor.normalizedLocator} does not join the exact profile catalog asset`,
        );
      }
      captured.push(Object.freeze({
        role: descriptor.role,
        normalizedLocator: descriptor.normalizedLocator,
        bytes,
        rawHash: expected.rawHash,
        rawByteLength: expected.rawByteLength,
        verificationReceiptHash: receipt.receiptHash,
        consumerBindingHash: receipt.binding.bindingHash,
      }));
    }
    completed = true;
    return Object.freeze(captured);
  } finally {
    if (!completed) {
      for (const asset of captured) asset.bytes.fill(0);
    }
  }
}

function writeExclusiveAssetV2(input: Readonly<{
  projectRoot: string;
  asset: CapturedAssetV2;
}>): CapturedPhysicalAssetV2 {
  const absolutePath = path.join(input.projectRoot, input.asset.normalizedLocator);
  let descriptor: number | undefined;
  try {
    descriptor = openSync(
      absolutePath,
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW,
      0o600,
    );
    fchmodSync(descriptor, 0o444);
    let offset = 0;
    while (offset < input.asset.bytes.byteLength) {
      const written = writeSync(
        descriptor,
        input.asset.bytes,
        offset,
        input.asset.bytes.byteLength - offset,
        null,
      );
      if (written < 1) {
        return fail(
          "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_MATERIALIZATION_FAILED",
          `Exclusive scaffold write ended early for ${input.asset.normalizedLocator}`,
        );
      }
      offset += written;
    }
    fsyncSync(descriptor);
    const stat = fstatSync(descriptor);
    if (
      !stat.isFile()
      || stat.nlink !== 1
      || modeBits(stat) !== 0o444
      || stat.uid !== processOwnerV2().uid
      || stat.gid !== processOwnerV2().gid
      || stat.size !== input.asset.rawByteLength
    ) {
      return fail(
        "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_MATERIALIZATION_FAILED",
        `Exclusive scaffold file metadata is invalid for ${input.asset.normalizedLocator}`,
      );
    }
    const fileFingerprint = fingerprint(stat);
    return Object.freeze({
      locator: input.asset.normalizedLocator,
      fingerprint: fileFingerprint,
      contentHash: input.asset.rawHash,
      physicalIdentityHash: hashCanonicalJson({
        schema: "setfarm.scaffold-base-physical-file-identity.v2",
        locator: input.asset.normalizedLocator,
        fingerprint: fileFingerprint,
        contentHash: input.asset.rawHash,
      }),
    });
  } catch (error) {
    if (error instanceof NodeScaffoldPrivateMaterializerErrorV2) throw error;
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_MATERIALIZATION_FAILED",
      `Scaffold ${input.asset.normalizedLocator} could not be written exclusively`,
      error,
    );
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function captureDirectoryV2(input: Readonly<{
  absolutePath: string;
  expectedNames: readonly string[];
  label: string;
}>): FingerprintV2 {
  const owner = processOwnerV2();
  const before = lstatSync(input.absolutePath);
  const names = readdirSync(input.absolutePath).sort();
  const after = lstatSync(input.absolutePath);
  if (
    before.isSymbolicLink()
    || !before.isDirectory()
    || realpathSync(input.absolutePath) !== input.absolutePath
    || modeBits(before) !== 0o700
    || before.uid !== owner.uid
    || before.gid !== owner.gid
    || !sameFingerprint(fingerprint(before), fingerprint(after))
    || names.length !== input.expectedNames.length
    || names.some((name, index) => name !== [...input.expectedNames].sort()[index])
  ) {
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_STATE_DRIFT",
      `${input.label} is not one exact mode-0700 every-and-only directory`,
    );
  }
  return fingerprint(after);
}

function capturePhysicalAssetV2(input: Readonly<{
  projectRoot: string;
  asset: CapturedAssetV2;
}>): CapturedPhysicalAssetV2 {
  const absolutePath = path.join(input.projectRoot, input.asset.normalizedLocator);
  let descriptor: number | undefined;
  try {
    descriptor = openSync(
      absolutePath,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
    const before = fstatSync(descriptor);
    const bytes = readFileSync(descriptor);
    const after = fstatSync(descriptor);
    const pathAfter = lstatSync(absolutePath);
    const fileFingerprint = fingerprint(after);
    if (
      !before.isFile()
      || before.isSymbolicLink()
      || before.nlink !== 1
      || modeBits(before) !== 0o444
      || before.uid !== processOwnerV2().uid
      || before.gid !== processOwnerV2().gid
      || !sameFingerprint(fingerprint(before), fileFingerprint)
      || !sameFingerprint(fileFingerprint, fingerprint(pathAfter))
      || bytes.byteLength !== input.asset.rawByteLength
      || sha256(bytes) !== input.asset.rawHash
    ) {
      return fail(
        "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_STATE_DRIFT",
        `Scaffold ${input.asset.normalizedLocator} changed after materialization`,
      );
    }
    return Object.freeze({
      locator: input.asset.normalizedLocator,
      fingerprint: fileFingerprint,
      contentHash: input.asset.rawHash,
      physicalIdentityHash: hashCanonicalJson({
        schema: "setfarm.scaffold-base-physical-file-identity.v2",
        locator: input.asset.normalizedLocator,
        fingerprint: fileFingerprint,
        contentHash: input.asset.rawHash,
      }),
    });
  } catch (error) {
    if (error instanceof NodeScaffoldPrivateMaterializerErrorV2) throw error;
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_STATE_DRIFT",
      `Scaffold ${input.asset.normalizedLocator} could not be fresh-read`,
      error,
    );
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function capturePrivateBaseV2(input: Readonly<{
  privateRoot: string;
  projectRoot: string;
  dependencyCapsuleRoot: string;
  assets: readonly CapturedAssetV2[];
}>): PrivateBaseCaptureV2 {
  const rootFingerprint = captureDirectoryV2({
    absolutePath: input.privateRoot,
    expectedNames: ROOT_MEMBER_NAMES_V2,
    label: "Private scaffold root",
  });
  const projectFingerprint = captureDirectoryV2({
    absolutePath: input.projectRoot,
    expectedNames: PROJECT_MEMBER_NAMES_V2,
    label: "Private scaffold project root",
  });
  const dependencyCapsuleFingerprint = captureDirectoryV2({
    absolutePath: input.dependencyCapsuleRoot,
    expectedNames: [],
    label: "Private dependency capsule root",
  });
  assertMissingPathV2(path.join(input.projectRoot, ".npmrc"), "Project .npmrc");
  assertMissingPathV2(path.join(input.projectRoot, "node_modules"), "Project node_modules");
  assertMissingPathV2(path.join(input.projectRoot, "src"), "Project source directory");
  const physicalAssets = Object.freeze(input.assets.map((asset) =>
    capturePhysicalAssetV2({ projectRoot: input.projectRoot, asset })));
  const totalBytes = input.assets.reduce((sum, asset) => sum + asset.rawByteLength, 0);
  const fileMembershipHash = hashCanonicalJson({
    schema: "setfarm.scaffold-base-file-membership.v2",
    files: input.assets.map((asset) => ({
      role: asset.role,
      normalizedLocator: asset.normalizedLocator,
      mode: "0444",
      rawHash: asset.rawHash,
      rawByteLength: asset.rawByteLength,
    })),
  });
  const rootIdentityHash = hashCanonicalJson({
    schema: "setfarm.private-scaffold-attempt-root-identity.v2",
    root: rootFingerprint,
    project: projectFingerprint,
    dependencyCapsule: dependencyCapsuleFingerprint,
  });
  const privateIdentityHash = hashCanonicalJson({
    schema: "setfarm.private-scaffold-base-physical-identity.v2",
    rootIdentityHash,
    physicalAssets: physicalAssets.map((asset) => ({
      locator: asset.locator,
      physicalIdentityHash: asset.physicalIdentityHash,
    })),
    fileMembershipHash,
  });
  return Object.freeze({
    rootFingerprint,
    rootIdentityHash,
    projectFingerprint,
    dependencyCapsuleFingerprint,
    physicalAssets,
    fileMembershipHash,
    totalBytes,
    privateIdentityHash,
  });
}

function codeOwnedMaterializerAuthorityV2(): PrivateStagedMaterializerAuthorityV2 {
  const identity = {
    schema: PRIVATE_STAGED_MATERIALIZER_AUTHORITY_V2_SCHEMA,
    authorityVersion: PRIVATE_STAGED_MATERIALIZER_VERSION_V2,
    authorityRef: PRIVATE_STAGED_MATERIALIZER_AUTHORITY_REF_V2,
    activation: "scaffold_base_only_dependency_install_blocked" as const,
    policy: {
      rootFreshness: "exclusive_random_root_no_adoption_v2" as const,
      scaffoldWrite: "exclusive_descriptor_fsync_fresh_read_v2" as const,
      dependencyInstall: "single_use_exact_npm_ci_v2" as const,
      dependencyCapture: "readonly_canonical_runtime_tree_dependencies_v2" as const,
      failureCleanup: "authenticated_owned_attempt_only_v2" as const,
      portablePathDisclosure: "forbidden" as const,
    },
  };
  return PrivateStagedMaterializerAuthorityV2Schema.parse({
    ...identity,
    authorityHash: hashPrivateStagedMaterializerAuthorityV2(identity),
  });
}

export function getCodeOwnedPrivateStagedMaterializerAuthorityV2():
PrivateStagedMaterializerAuthorityV2 {
  return defensiveCopy(codeOwnedMaterializerAuthorityV2());
}

function buildBaseReceiptV2(input: Readonly<{
  admissionScope: "production_host" | "test_fixture";
  profileId: NodeScaffoldProfileIdV2;
  environmentReceipt: ReturnType<typeof inspectNodeScaffoldExecutionEnvironmentReceiptV2>;
  assets: readonly CapturedAssetV2[];
  capture: PrivateBaseCaptureV2;
}>): ScaffoldBaseMaterializationReceiptV2 {
  const catalog = getCodeOwnedNodeScaffoldToolchainCatalogV2();
  const entry = getCodeOwnedNodeScaffoldToolchainEntryV2(input.profileId);
  if (!entry) {
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_RECEIPT_INVALID",
      "Private scaffold profile lost its code-owned catalog entry",
    );
  }
  const materializerAuthority = codeOwnedMaterializerAuthorityV2();
  const catalogBinding = {
    catalogSchema: NODE_SCAFFOLD_TOOLCHAIN_CATALOG_V2_SCHEMA,
    catalogHash: catalog.catalogHash,
    entrySchema: NODE_SCAFFOLD_TOOLCHAIN_ENTRY_V2_SCHEMA,
    entryRef: entry.entryRef,
    entryHash: entry.entryHash,
    profileId: input.profileId,
    dependencyGraphHash: entry.dependencyGraph.graphHash,
  };
  const environmentBinding = {
    receiptSchema: NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_RECEIPT_V2_SCHEMA,
    receiptHash: input.environmentReceipt.receiptHash,
    effectiveConfigReceiptHash: input.environmentReceipt.effectiveNpmConfig.receiptHash,
    effectiveConfigHash: input.environmentReceipt.effectiveNpmConfig.effectiveConfigHash,
    environmentContractHash: input.environmentReceipt.environment.environmentContractHash,
    environmentHash: input.environmentReceipt.environment.environmentHash,
  };
  const assets = input.assets.map((asset) => {
    const physical = input.capture.physicalAssets.find((candidate) =>
      candidate.locator === asset.normalizedLocator);
    if (!physical) {
      return fail(
        "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_RECEIPT_INVALID",
        `Physical identity is absent for ${asset.normalizedLocator}`,
      );
    }
    return {
      role: asset.role,
      normalizedLocator: asset.normalizedLocator,
      mode: "0444" as const,
      rawHash: asset.rawHash,
      rawByteLength: asset.rawByteLength,
      verificationReceiptSchema: "setfarm.deep-byte-bundle-verification-receipt.v2" as const,
      verificationReceiptHash: asset.verificationReceiptHash,
      consumerBindingHash: asset.consumerBindingHash,
      physicalIdentityHash: physical.physicalIdentityHash,
    };
  });
  const baseState = {
    layoutRef: "PRIVATE_NODE_SCAFFOLD_MATERIALIZATION_LAYOUT_V2" as const,
    rootMode: "0700" as const,
    projectRootMode: "0700" as const,
    dependencyCapsuleRootMode: "0700" as const,
    rootMemberNames: [...ROOT_MEMBER_NAMES_V2] as ["dependency-capsule", "project"],
    projectMemberNames: [...PROJECT_MEMBER_NAMES_V2] as [
      "package-lock.json",
      "package.json",
      "tsconfig.json",
    ],
    dependencyCapsuleMemberCount: 0 as const,
    projectNpmrc: {
      normalizedLocator: ".npmrc" as const,
      state: "absent" as const,
      evidenceAuthority: "private_stage_fresh_capture_v2" as const,
    },
    dependencyInstallation: {
      normalizedLocator: "node_modules" as const,
      state: "absent" as const,
    },
    sourceEntrypoint: {
      sourceDirectoryState: "absent" as const,
      state: "absent" as const,
      finalOwnerRef: "NODE_ENTRYPOINT_GENERATOR_V2" as const,
    },
    fileCount: 3 as const,
    totalBytes: input.capture.totalBytes,
    fileMembershipHash: input.capture.fileMembershipHash,
  };
  const semanticInput = {
    materializerAuthorityHash: materializerAuthority.authorityHash,
    catalogBinding,
    environmentBinding,
    assets,
  };
  const identity: ScaffoldBaseMaterializationReceiptHashPayloadV2 = {
    schema: SCAFFOLD_BASE_MATERIALIZATION_RECEIPT_V2_SCHEMA,
    receiptVersion: PRIVATE_STAGED_MATERIALIZER_VERSION_V2,
    authorityRef: PRIVATE_STAGED_MATERIALIZER_AUTHORITY_REF_V2,
    status: "scaffold_base_materialized_verified",
    admissionScope: input.admissionScope,
    productionUse: "forbidden_until_dependency_file_tree_and_build_topology_join",
    materializerAuthority,
    catalogBinding,
    environmentBinding,
    semanticInputHash: hashScaffoldBaseSemanticInputV2(semanticInput),
    privateAttempt: {
      rootIdentityHash: input.capture.rootIdentityHash,
      rootMode: "0700",
      ownerUid: input.capture.rootFingerprint.ownerUid,
      ownerGid: input.capture.rootFingerprint.ownerGid,
      freshnessPolicy: "exclusive_random_root_no_adoption_v2",
      pathDisclosure: "forbidden",
      destructionPolicy: "authenticated_owned_attempt_only_v2",
    },
    assetCount: 3,
    assets,
    baseState,
    baseStateHash: hashScaffoldBaseStateV2(baseState),
  };
  const parsed = ScaffoldBaseMaterializationReceiptV2Schema.safeParse({
    ...identity,
    receiptHash: hashScaffoldBaseMaterializationReceiptV2(identity),
  });
  if (!parsed.success) {
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_RECEIPT_INVALID",
      "Scaffold base receipt failed its canonical schema",
      parsed.error,
    );
  }
  return deepFreezeJson(parsed.data);
}

function safeRemoveOwnedAttemptV2(
  privateRoot: string,
  expectedRoot: FingerprintV2,
): void {
  try {
    const current = lstatSync(privateRoot);
    if (
      current.isDirectory()
      && !current.isSymbolicLink()
      && realpathSync(privateRoot) === privateRoot
      && current.dev === expectedRoot.device
      && current.ino === expectedRoot.inode
      && current.uid === expectedRoot.ownerUid
      && current.gid === expectedRoot.ownerGid
      && modeBits(current) === 0o700
    ) {
      rmSync(privateRoot, { recursive: true, force: false });
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
  }
}

async function materializeBaseV2(input: Readonly<{
  admissionScope: "production_host" | "test_fixture";
  environment: NodeScaffoldExecutionEnvironmentV2;
  values: Readonly<Record<string, unknown>>;
  scratchParent?: string;
  hooks?: NodeScaffoldPrivateMaterializerTestHooksV2;
}>): Promise<MaterializedNodeScaffoldPrivateStageV2> {
  let layout: ReturnType<typeof createPrivateLayoutV2> | undefined;
  let assets: readonly CapturedAssetV2[] = [];
  try {
    const environmentReceipt = await revalidateNodeScaffoldExecutionEnvironmentV2(
      input.environment,
    );
    if (environmentReceipt.admissionScope !== input.admissionScope) {
      return fail(
        "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_ENVIRONMENT_INVALID",
        "Private scaffold materializer and execution environment scopes do not join",
      );
    }
    const profileId = environmentReceipt.catalogBinding.profileId;
    assets = captureAuthenticatedAssetsV2({ profileId, values: input.values });
    layout = createPrivateLayoutV2({
      admissionScope: input.admissionScope,
      ...(input.scratchParent ? { scratchParent: input.scratchParent } : {}),
      ...(input.hooks ? { hooks: input.hooks } : {}),
    });
    for (const asset of assets) {
      writeExclusiveAssetV2({ projectRoot: layout.projectRoot, asset });
      input.hooks?.afterBoundary?.(
        asset.normalizedLocator === "package-lock.json"
          ? "after_package_lock_fsync"
          : asset.normalizedLocator === "package.json"
            ? "after_package_json_fsync"
            : "after_tsconfig_fsync",
      );
    }
    syncDirectoryV2(layout.projectRoot);
    syncDirectoryV2(layout.privateRoot);
    input.hooks?.afterBoundary?.("after_project_fsync");
    const baseCapture = capturePrivateBaseV2({
      privateRoot: layout.privateRoot,
      projectRoot: layout.projectRoot,
      dependencyCapsuleRoot: layout.dependencyCapsuleRoot,
      assets,
    });
    input.hooks?.afterBoundary?.("after_final_capture");
    const receipt = buildBaseReceiptV2({
      admissionScope: input.admissionScope,
      profileId,
      environmentReceipt,
      assets,
      capture: baseCapture,
    });
    const lifecycle: MutableLifecycleV2 = { status: "base_ready" };
    const state: PrivateStageStateV2 = Object.freeze({
      admissionScope: input.admissionScope,
      profileId,
      environment: input.environment,
      privateRoot: layout.privateRoot,
      projectRoot: layout.projectRoot,
      dependencyCapsuleRoot: layout.dependencyCapsuleRoot,
      baseCapture,
      receipt,
      lifecycle,
    });
    const handle = new MaterializedNodeScaffoldPrivateStageV2(
      materializedStageConstructorCapabilityV2,
      state,
    );
    layout = undefined;
    return handle;
  } catch (error) {
    if (error instanceof NodeScaffoldPrivateMaterializerErrorV2) throw error;
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_MATERIALIZATION_FAILED",
      "Private scaffold base materialization failed",
      error,
    );
  } finally {
    for (const asset of assets) asset.bytes.fill(0);
    if (layout) safeRemoveOwnedAttemptV2(layout.privateRoot, layout.initialRootFingerprint);
  }
}

export async function materializeNodeScaffoldPrivateStageV2(
  input: unknown,
): Promise<MaterializedNodeScaffoldPrivateStageV2> {
  const values = exactDataRecord(input, [
    "dependencyLockManifest",
    "environment",
    "packageManifest",
    "typescriptCompilerConfig",
  ]);
  const environment = values.environment as NodeScaffoldExecutionEnvironmentV2;
  let productionEnvironment: boolean;
  try {
    productionEnvironment = isProductionNodeScaffoldExecutionEnvironmentV2(environment);
  } catch (error) {
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_INPUT_INVALID",
      "Production private scaffold environment handle is not authentic",
      error,
    );
  }
  if (!productionEnvironment) {
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_PRODUCTION_AUTHORITY_REQUIRED",
      "Production private scaffold materialization requires a production_host environment",
    );
  }
  return materializeBaseV2({
    admissionScope: "production_host",
    environment,
    values,
  });
}

export type MaterializeNodeScaffoldPrivateStageV2ForTestInput = Readonly<{
  dependencyLockManifest: VerifiedDeepByteBundleV2;
  environment: NodeScaffoldExecutionEnvironmentV2;
  packageManifest: VerifiedDeepByteBundleV2;
  scratchParent: string;
  typescriptCompilerConfig: VerifiedDeepByteBundleV2;
  testHooks?: NodeScaffoldPrivateMaterializerTestHooksV2;
}>;

export async function materializeNodeScaffoldPrivateStageV2ForTest(
  input: MaterializeNodeScaffoldPrivateStageV2ForTestInput,
): Promise<MaterializedNodeScaffoldPrivateStageV2> {
  const expectedKeys = "testHooks" in input
    ? [
        "dependencyLockManifest",
        "environment",
        "packageManifest",
        "scratchParent",
        "testHooks",
        "typescriptCompilerConfig",
      ]
    : [
        "dependencyLockManifest",
        "environment",
        "packageManifest",
        "scratchParent",
        "typescriptCompilerConfig",
      ];
  const values = exactDataRecord(input, expectedKeys);
  const environment = values.environment as NodeScaffoldExecutionEnvironmentV2;
  let environmentReceipt;
  try {
    environmentReceipt = inspectNodeScaffoldExecutionEnvironmentReceiptV2(environment);
  } catch (error) {
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_INPUT_INVALID",
      "Test private scaffold environment handle is not authentic",
      error,
    );
  }
  if (environmentReceipt.admissionScope !== "test_fixture") {
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_INPUT_INVALID",
      "Test private scaffold constructor cannot consume or downgrade production authority",
    );
  }
  const testHooks = values.testHooks;
  if (
    testHooks !== undefined
    && (
      !isPlainRecord(testHooks)
      || Reflect.ownKeys(testHooks).some((key) => key !== "afterBoundary")
      || (testHooks.afterBoundary !== undefined && typeof testHooks.afterBoundary !== "function")
    )
  ) {
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_INPUT_INVALID",
      "Test private scaffold hooks are invalid",
    );
  }
  return materializeBaseV2({
    admissionScope: "test_fixture",
    environment,
    values,
    scratchParent: validateScratchParentV2(values.scratchParent),
    ...(testHooks
      ? { hooks: testHooks as NodeScaffoldPrivateMaterializerTestHooksV2 }
      : {}),
  });
}

function authenticStageStateV2(
  handle: MaterializedNodeScaffoldPrivateStageV2,
): PrivateStageStateV2 {
  if (
    typeof handle !== "object"
    || handle === null
    || isProxy(handle)
    || Object.getPrototypeOf(handle) !== MaterializedNodeScaffoldPrivateStageV2.prototype
  ) {
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_HANDLE_UNAUTHENTICATED",
      "Private scaffold operation requires one authentic handle",
    );
  }
  const state = privateStageStateV2.get(handle);
  if (!state) {
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_HANDLE_UNAUTHENTICATED",
      "Private scaffold operation requires one authentic handle",
    );
  }
  return state;
}

function activeStageStateV2(
  handle: MaterializedNodeScaffoldPrivateStageV2,
): PrivateStageStateV2 {
  const state = authenticStageStateV2(handle);
  if (state.lifecycle.status === "destroyed") {
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_DESTROYED",
      "Private scaffold materialization has already been destroyed",
    );
  }
  return state;
}

export function inspectScaffoldBaseMaterializationReceiptV2(
  handle: MaterializedNodeScaffoldPrivateStageV2,
): ScaffoldBaseMaterializationReceiptV2 {
  return defensiveCopy(authenticStageStateV2(handle).receipt);
}

export function isProductionNodeScaffoldPrivateStageV2(
  handle: MaterializedNodeScaffoldPrivateStageV2,
): boolean {
  return authenticStageStateV2(handle).admissionScope === "production_host";
}

export async function revalidateNodeScaffoldPrivateStageV2(
  handle: MaterializedNodeScaffoldPrivateStageV2,
): Promise<ScaffoldBaseMaterializationReceiptV2> {
  const state = activeStageStateV2(handle);
  try {
    const environmentReceipt = await revalidateNodeScaffoldExecutionEnvironmentV2(
      state.environment,
    );
    if (environmentReceipt.receiptHash !== state.receipt.environmentBinding.receiptHash) {
      return fail(
        "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_STATE_DRIFT",
        "Execution environment changed after scaffold base materialization",
      );
    }
    const assets = state.receipt.assets.map((asset) => Object.freeze({
      role: asset.role,
      normalizedLocator: asset.normalizedLocator,
      bytes: Buffer.alloc(0),
      rawHash: asset.rawHash,
      rawByteLength: asset.rawByteLength,
      verificationReceiptHash: asset.verificationReceiptHash,
      consumerBindingHash: asset.consumerBindingHash,
    })) as readonly CapturedAssetV2[];
    const fresh = capturePrivateBaseV2({
      privateRoot: state.privateRoot,
      projectRoot: state.projectRoot,
      dependencyCapsuleRoot: state.dependencyCapsuleRoot,
      assets,
    });
    if (fresh.privateIdentityHash !== state.baseCapture.privateIdentityHash) {
      return fail(
        "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_STATE_DRIFT",
        "Private scaffold base no longer reproduces its issued physical identity",
      );
    }
    return defensiveCopy(state.receipt);
  } catch (error) {
    if (
      error instanceof NodeScaffoldPrivateMaterializerErrorV2
      && error.code === "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_STATE_DRIFT"
    ) throw error;
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_STATE_DRIFT",
      "Private scaffold base could not be revalidated",
      error,
    );
  }
}

export function destroyNodeScaffoldPrivateStageV2(
  handle: MaterializedNodeScaffoldPrivateStageV2,
): void {
  const state = authenticStageStateV2(handle);
  if (state.lifecycle.status === "destroyed") return;
  try {
    const current = lstatSync(state.privateRoot);
    if (
      current.isSymbolicLink()
      || !current.isDirectory()
      || realpathSync(state.privateRoot) !== state.privateRoot
      || current.dev !== state.baseCapture.rootFingerprint.device
      || current.ino !== state.baseCapture.rootFingerprint.inode
      || current.uid !== state.baseCapture.rootFingerprint.ownerUid
      || current.gid !== state.baseCapture.rootFingerprint.ownerGid
      || modeBits(current) !== 0o700
    ) {
      return fail(
        "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_STATE_DRIFT",
        "Refusing to destroy a replaced private scaffold root",
      );
    }
    rmSync(state.privateRoot, { recursive: true, force: false });
    assertMissingPathV2(state.privateRoot, "Destroyed private scaffold root");
    state.lifecycle.status = "destroyed";
  } catch (error) {
    if (error instanceof NodeScaffoldPrivateMaterializerErrorV2) throw error;
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_STATE_DRIFT",
      "Private scaffold root could not be destroyed safely",
      error,
    );
  }
}
