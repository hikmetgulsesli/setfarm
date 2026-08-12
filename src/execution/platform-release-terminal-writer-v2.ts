import { createHash } from "node:crypto";
import {
  closeSync,
  constants,
  fchmodSync,
  fstatSync,
  fsyncSync,
  lstatSync,
  openSync,
  opendirSync,
  readSync,
  realpathSync,
  unlinkSync,
  writeSync,
  type BigIntStats,
  type Stats,
} from "node:fs";
import path from "node:path";
import os from "node:os";
import { isNativeError, isProxy } from "node:util/types";

import {
  canonicalJsonStringify,
  hashCanonicalJson,
} from "../product-compiler/canonical-json.js";
import {
  defaultNodeToolchainProvisionerHostIdentityHashV3,
} from "../product-compiler/node-toolchain-provisioner-physical-census-v3.js";
import {
  captureCanonicalRuntimeTreeV2,
  type CanonicalRuntimeMetadataProbeV2,
} from "./canonical-runtime-tree-v2.js";
import {
  PLATFORM_RELEASE_MANIFEST_V2_MAX_CANONICAL_BYTES,
  type PlatformReleaseManifestV2,
} from "./schemas/platform-release-manifest-v2.js";
import {
  PLATFORM_RELEASE_CANDIDATE_ENVELOPE_V2_SCHEMA,
  parsePlatformReleaseCandidateEnvelopeV2,
  type PlatformReleaseBuildAttestationV2,
} from "./schemas/platform-release-build-attestation-v2.js";
import {
  hashCanonicalRuntimeTreeBindingV2,
  type CanonicalRuntimeTreeBindingCandidateV2,
} from "./schemas/platform-runtime-payload-v2.js";
import type {
  CanonicalRuntimeTreeV2,
} from "./schemas/canonical-runtime-tree-v2.js";
import {
  hashPlatformReleaseTerminalTestObservationV2,
  hashPlatformReleaseTerminalTestSealedRootObservationV2,
  parsePlatformReleaseTerminalTestObservationV2,
} from "./schemas/platform-release-terminal-test-observation-v2.js";

export const PLATFORM_RELEASE_MANIFEST_V2_FILENAME =
  "PLATFORM_RELEASE_MANIFEST.v2.json" as const;

export type PlatformReleaseTerminalWriteV2ErrorCode =
  | "COMPLETED_STAGE_UNAUTHENTICATED"
  | "INPUT_INVALID"
  | "LAYOUT_INVALID"
  | "MANIFEST_ALREADY_PRESENT"
  | "MANIFEST_WRITE_FAILED"
  | "MODULE_BYTES_MISMATCH"
  | "PACKAGE_JSON_MISMATCH"
  | "CLEANUP_FAILED"
  | "RETAINED_RESIDUE_UNAUTHENTICATED"
  | "ROOT_CHANGED"
  | "ROOT_INVALID"
  | "RUNTIME_TREE_MISMATCH"
  | "STITCH_CONVERTER_MISMATCH";

export class PlatformReleaseTerminalWriteV2Error extends Error {
  constructor(
    readonly code: PlatformReleaseTerminalWriteV2ErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(`${code}: ${message}`, options);
    this.name = "PlatformReleaseTerminalWriteV2Error";
  }
}

type RootIdentityV2 = Readonly<{
  absolutePath: string;
  dev: bigint;
  ino: bigint;
  ownerUid: bigint;
  ownerGid: bigint;
  hostIdentityHash: string;
}>;

type DirectoryReadHookContextV2 = Readonly<{
  absolutePath: string;
  label: string;
}>;

type DirectoryEntryReadHookContextV2 = DirectoryReadHookContextV2 & Readonly<{
  name: string;
}>;

type SealedMembershipHookContextV2 = Readonly<{
  absolutePath: string;
  basename: string;
  objectKind: "ordinary_file" | "directory";
}>;

export type PlatformReleaseTerminalWriterV2TestHooks = Readonly<{
  afterDirectoryEntryRead?: (context: DirectoryEntryReadHookContextV2) => void;
  afterDirectoryDescriptorClose?: (context: DirectoryReadHookContextV2) => void;
  afterManifestDescriptorClose?: () => void;
  beforeRootReadOnlyFinalization?: () => void;
  beforeManifestRollback?: () => void;
  afterSealedMembershipDescriptorAdmission?: (
    context: SealedMembershipHookContextV2,
  ) => void;
  afterSealedMembershipDescriptorClose?: (
    context: SealedMembershipHookContextV2,
  ) => void;
}>;

type StableFileV2 = Readonly<{
  contentHash: string;
  byteLength: number;
  mode: "0444" | "0555";
  bytes: Buffer;
}>;

export type CompletedPlatformReleaseStageCandidateInspectionV2 = Readonly<{
  schema: "setfarm.completed-platform-release-stage-candidate-inspection.v2";
  authorityState: "completed_stage_candidate_unverified";
  productionUse: "forbidden_until_publication_lease_and_fresh_verification";
  releaseId: string;
  manifestPayloadHash: string;
  buildAttestationHash: string;
  manifestCanonicalByteLength: number;
  runtimePayloadHash: string;
  platformTreeHash: string;
  dependencyTreeHash: string;
  launcherCatalogHash: string;
  runnerCatalogHash: string;
  requiredModuleClosureHash: string;
  requiredModuleCount: 17;
}>;

export type PlatformReleaseTerminalTestObservationV2 = Readonly<{
  schema: "setfarm.platform-release-terminal-test-observation.v2";
  version: "2.0.0";
  authorityState: "test_fixture_terminalized_unverified";
  admissionScope: "test_fixture";
  productionAuthority: false;
  productionAdmission: "forbidden";
  productionUse: "forbidden_until_publication_lease_and_fresh_verification";
  credentialUse: "none";
  mutationAuthority: false;
  trustConclusion: "characterization_only";
  releaseId: string;
  manifestPayloadHash: string;
  buildAttestationHash: string;
  manifestCanonicalByteLength: number;
  runtimePayloadHash: string;
  platformTreeHash: string;
  dependencyTreeHash: string;
  launcherCatalogHash: string;
  runnerCatalogHash: string;
  requiredModuleClosureHash: string;
  requiredModuleCount: number;
  sealedRoot: Readonly<{
    stableIdentity: Readonly<{
      hostIdentityHash: string;
      objectKind: "directory";
      device: string;
      inode: string;
    }>;
    mutableFingerprint: Readonly<{
      ownerUid: number;
      ownerGid: number;
      mode: "0555";
      linkCount: number;
      byteLength: number;
      modifiedTimeNanoseconds: string;
      changedTimeNanoseconds: string;
    }>;
    membershipHash: string;
    observationHash: string;
  }>;
  durability: Readonly<{
    manifestFsync: true;
    rootFsync: true;
    rootReadOnly: true;
  }>;
  observationHash: string;
}>;

export type PlatformReleaseTerminalRetainedResidueReceiptV2 = Readonly<{
  schema: "setfarm.platform-release-terminal-retained-residue-receipt.v2";
  version: "2.0.0";
  authorityState: "test_fixture_terminalized_observation_failure_retained";
  admissionScope: "test_fixture";
  productionAuthority: false;
  productionAdmission: "forbidden";
  mutationAuthority: false;
  deletionAuthority: false;
  fsMutation: false;
  rootDisposition: "retained_for_external_owner_inspection";
  rootIdentity: Readonly<{
    hostIdentityHash: string;
    objectKind: "directory";
    device: string;
    inode: string;
  }>;
}>;

const COMPLETED_STAGE_CONSTRUCTOR_CAPABILITY_V2 = Object.freeze({});

export class CompletedPlatformReleaseStageCandidateV2 {
  readonly releaseId: string;

  constructor(
    capability: object,
    releaseId: string,
  ) {
    if (capability !== COMPLETED_STAGE_CONSTRUCTOR_CAPABILITY_V2) {
      throw new PlatformReleaseTerminalWriteV2Error(
        "COMPLETED_STAGE_UNAUTHENTICATED",
        "Completed stage candidates can only be issued by the terminal writer",
      );
    }
    this.releaseId = releaseId;
    Object.freeze(this);
  }
}

type CompletedStageStateV2 = Readonly<{
  root: RootIdentityV2;
  manifest: PlatformReleaseManifestV2;
  buildAttestation: PlatformReleaseBuildAttestationV2;
  manifestCanonicalBytes: Buffer;
  inspection: CompletedPlatformReleaseStageCandidateInspectionV2;
}>;

const completedStageStatesV2 = new WeakMap<
  CompletedPlatformReleaseStageCandidateV2,
  CompletedStageStateV2
>();

const retainedResidueReceiptsV2 = new WeakMap<
  object,
  PlatformReleaseTerminalRetainedResidueReceiptV2
>();

function fail(
  code: PlatformReleaseTerminalWriteV2ErrorCode,
  message: string,
  cause?: unknown,
): never {
  throw new PlatformReleaseTerminalWriteV2Error(
    code,
    message,
    cause === undefined ? undefined : { cause },
  );
}

function terminalWriteFailureV2(
  error: unknown,
  code: PlatformReleaseTerminalWriteV2ErrorCode,
  message: string,
): PlatformReleaseTerminalWriteV2Error {
  return error instanceof PlatformReleaseTerminalWriteV2Error
    ? error
    : new PlatformReleaseTerminalWriteV2Error(
      code,
      message,
      { cause: error },
    );
}

function throwPrimaryFirstTerminalWriteFailureV2(
  primaryError: PlatformReleaseTerminalWriteV2Error | undefined,
  secondaryErrors: readonly (
    PlatformReleaseTerminalWriteV2Error | undefined
  )[],
  message: string,
): void {
  const errors = [primaryError, ...secondaryErrors].filter(
    (error): error is PlatformReleaseTerminalWriteV2Error =>
      error !== undefined,
  );
  if (errors.length > 1) {
    const authoritativeError = errors[0]!;
    const aggregate = new AggregateError(
      errors,
      message,
      { cause: authoritativeError },
    );
    throw new PlatformReleaseTerminalWriteV2Error(
      authoritativeError.code,
      message,
      { cause: aggregate },
    );
  }
  if (errors.length === 1) throw errors[0];
}

function effectiveProcessOwnerV2(
  code: "ROOT_INVALID" | "ROOT_CHANGED",
): Readonly<{ uid: bigint; gid: bigint }> {
  if (
    typeof process.geteuid !== "function"
    || typeof process.getegid !== "function"
  ) {
    return fail(
      code,
      "Terminal writer requires exact POSIX effective ownership",
    );
  }
  return Object.freeze({
    uid: BigInt(process.geteuid()),
    gid: BigInt(process.getegid()),
  });
}

function modeBits(stat: Stats): number {
  return stat.mode & 0o7777;
}

function sameStringArray(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return left.length === right.length
    && left.every((entry, index) => entry === right[index]);
}

function assertPlainExactInput(
  input: unknown,
): asserts input is Readonly<{
  stageRoot: string;
  manifest: unknown;
  buildAttestation: unknown;
  metadataProbe: CanonicalRuntimeMetadataProbeV2;
}> {
  if (
    input === null
    || typeof input !== "object"
    || Array.isArray(input)
    || isProxy(input)
    || Object.getPrototypeOf(input) !== Object.prototype
  ) {
    fail("INPUT_INVALID", "Terminal writer input must be one plain exact object");
  }
  const descriptors = Object.getOwnPropertyDescriptors(input);
  const keys = Object.keys(descriptors).sort();
  if (
    !sameStringArray(keys, [
      "buildAttestation",
      "manifest",
      "metadataProbe",
      "stageRoot",
    ])
    || keys.some((key) =>
      !("value" in descriptors[key]!)
      || descriptors[key]!.get !== undefined
      || descriptors[key]!.set !== undefined)
  ) {
    fail(
      "INPUT_INVALID",
      "Terminal writer input must contain exact data properties",
    );
  }
  const value = input as Record<string, unknown>;
  if (
    typeof value.stageRoot !== "string"
    || Buffer.byteLength(value.stageRoot, "utf8") < 1
    || Buffer.byteLength(value.stageRoot, "utf8") > 4_096
    || typeof value.metadataProbe !== "function"
  ) {
    fail("INPUT_INVALID", "Terminal writer root or metadata probe is invalid");
  }
}

function anchorPrivateStageRootV2(stageRoot: string): RootIdentityV2 {
  if (
    !path.isAbsolute(stageRoot)
    || path.normalize(stageRoot) !== stageRoot
    || stageRoot === path.parse(stageRoot).root
  ) {
    fail("ROOT_INVALID", "Stage root must be one normalized absolute path");
  }
  let stat: BigIntStats;
  let real: string;
  const owner = effectiveProcessOwnerV2("ROOT_INVALID");
  let hostIdentityHash: string;
  try {
    stat = lstatSync(stageRoot, { bigint: true });
    real = realpathSync(stageRoot);
    hostIdentityHash =
      defaultNodeToolchainProvisionerHostIdentityHashV3();
  } catch (error) {
    return fail("ROOT_INVALID", "Stage root cannot be inspected", error);
  }
  if (
    stat.isSymbolicLink()
    || !stat.isDirectory()
    || real !== stageRoot
    || Number(stat.mode & 0o7777n) !== 0o700
    || stat.uid !== owner.uid
    || stat.gid !== owner.gid
  ) {
    fail(
      "ROOT_INVALID",
      "Stage root must be one real process-owned private 0700 directory",
    );
  }
  return Object.freeze({
    absolutePath: stageRoot,
    dev: stat.dev,
    ino: stat.ino,
    ownerUid: stat.uid,
    ownerGid: stat.gid,
    hostIdentityHash,
  });
}

function assertRootIdentityV2(root: RootIdentityV2): void {
  let stat: BigIntStats;
  let real: string;
  const owner = effectiveProcessOwnerV2("ROOT_CHANGED");
  try {
    stat = lstatSync(root.absolutePath, { bigint: true });
    real = realpathSync(root.absolutePath);
  } catch (error) {
    return fail("ROOT_CHANGED", "Stage root disappeared", error);
  }
  if (
    stat.isSymbolicLink()
    || !stat.isDirectory()
    || stat.dev !== root.dev
    || stat.ino !== root.ino
    || stat.uid !== root.ownerUid
    || stat.gid !== root.ownerGid
    || stat.uid !== owner.uid
    || stat.gid !== owner.gid
    || real !== root.absolutePath
  ) {
    fail("ROOT_CHANGED", "Stage root identity changed during terminal write");
  }
}

function assertDirectory(
  absolutePath: string,
  expectedMode: number,
  label: string,
): void {
  try {
    const stat = lstatSync(absolutePath);
    const real = realpathSync(absolutePath);
    if (
      stat.isSymbolicLink()
      || !stat.isDirectory()
      || modeBits(stat) !== expectedMode
      || real !== absolutePath
    ) {
      fail(
        "LAYOUT_INVALID",
        `${label} must be one real ${expectedMode.toString(8)} directory`,
      );
    }
  } catch (error) {
    if (error instanceof PlatformReleaseTerminalWriteV2Error) throw error;
    return fail("LAYOUT_INVALID", `${label} cannot be inspected`, error);
  }
}

function readDirectoryNamesV2(
  absolutePath: string,
  label: string,
  maximumEntries: number,
  code: "LAYOUT_INVALID" | "ROOT_CHANGED" = "LAYOUT_INVALID",
  testHooks?: PlatformReleaseTerminalWriterV2TestHooks,
): string[] {
  let directory: ReturnType<typeof opendirSync> | undefined;
  let primaryError: PlatformReleaseTerminalWriteV2Error | undefined;
  const names: string[] = [];
  try {
    directory = opendirSync(absolutePath, { bufferSize: 1 });
    while (true) {
      const entry = directory.readSync();
      if (entry === null) break;
      testHooks?.afterDirectoryEntryRead?.({
        absolutePath,
        label,
        name: entry.name,
      });
      if (names.length >= maximumEntries) {
        fail(
          code,
          `${label} directory membership exceeds the admitted bound`,
        );
      }
      names.push(entry.name);
    }
  } catch (error) {
    primaryError = terminalWriteFailureV2(
      error,
      code,
      `${label} directory membership cannot be read`,
    );
  }

  let closeError: PlatformReleaseTerminalWriteV2Error | undefined;
  if (directory !== undefined) {
    try {
      directory.closeSync();
      testHooks?.afterDirectoryDescriptorClose?.({ absolutePath, label });
    } catch (error) {
      closeError = terminalWriteFailureV2(
        error,
        code,
        `${label} directory membership cannot be closed`,
      );
    }
  }
  throwPrimaryFirstTerminalWriteFailureV2(
    primaryError,
    [closeError],
    `${label} directory membership read and close both failed`,
  );
  return names.sort();
}

function assertPreManifestLayoutV2(
  root: RootIdentityV2,
  testHooks?: PlatformReleaseTerminalWriterV2TestHooks,
): void {
  assertRootIdentityV2(root);
  const manifestPath = path.join(
    root.absolutePath,
    PLATFORM_RELEASE_MANIFEST_V2_FILENAME,
  );
  try {
    lstatSync(manifestPath);
    fail(
      "MANIFEST_ALREADY_PRESENT",
      "Terminal manifest file already exists",
    );
  } catch (error) {
    if (error instanceof PlatformReleaseTerminalWriteV2Error) throw error;
    if (
      !(error instanceof Error)
      || !("code" in error)
      || error.code !== "ENOENT"
    ) {
      return fail(
        "LAYOUT_INVALID",
        "Terminal manifest absence cannot be established",
        error,
      );
    }
  }
  const names = readDirectoryNamesV2(
    root.absolutePath,
    "Release root",
    1,
    "LAYOUT_INVALID",
    testHooks,
  );
  if (!sameStringArray(names, ["payload"])) {
    fail(
      "LAYOUT_INVALID",
      "Pre-manifest release root must contain exactly payload",
    );
  }
  const payload = path.join(root.absolutePath, "payload");
  assertDirectory(payload, 0o555, "Runtime payload root");
  const payloadNames = readDirectoryNamesV2(
    payload,
    "Runtime payload",
    3,
    "LAYOUT_INVALID",
    testHooks,
  );
  if (
    !sameStringArray(
      payloadNames,
      ["dist", "node_modules", "package.json"],
    )
  ) {
    fail(
      "LAYOUT_INVALID",
      "Runtime payload must contain exactly dist, node_modules and package.json",
    );
  }
  assertDirectory(path.join(payload, "dist"), 0o555, "Platform dist tree");
  assertDirectory(
    path.join(payload, "node_modules"),
    0o555,
    "Production dependency tree",
  );
  assertRootIdentityV2(root);
}

function readStableFileV2(
  absolutePath: string,
  maximumBytes: number,
): StableFileV2 {
  let descriptor: number | undefined;
  let captured: StableFileV2 | undefined;
  let primaryError: PlatformReleaseTerminalWriteV2Error | undefined;
  try {
    descriptor = openSync(
      absolutePath,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
    const before = fstatSync(descriptor, { bigint: true });
    if (
      !before.isFile()
      || before.nlink !== 1n
      || before.size < 1n
      || before.size > BigInt(maximumBytes)
      || ![0o444, 0o555].includes(
        Number(before.mode & 0o7777n),
      )
    ) {
      fail("LAYOUT_INVALID", `${absolutePath} is not one bounded release file`);
    }
    const bytes = Buffer.allocUnsafe(Number(before.size));
    let offset = 0;
    while (offset < bytes.byteLength) {
      const read = readSync(
        descriptor,
        bytes,
        offset,
        bytes.byteLength - offset,
        null,
      );
      if (read === 0) break;
      offset += read;
    }
    const after = fstatSync(descriptor, { bigint: true });
    const pathAfter = lstatSync(absolutePath, { bigint: true });
    if (
      offset !== bytes.byteLength
      || !after.isFile()
      || !pathAfter.isFile()
      || before.dev !== after.dev
      || before.ino !== after.ino
      || before.size !== after.size
      || before.mode !== after.mode
      || before.mtimeNs !== after.mtimeNs
      || before.ctimeNs !== after.ctimeNs
      || after.dev !== pathAfter.dev
      || after.ino !== pathAfter.ino
      || after.size !== pathAfter.size
      || after.mode !== pathAfter.mode
      || after.mtimeNs !== pathAfter.mtimeNs
      || after.ctimeNs !== pathAfter.ctimeNs
    ) {
      fail("ROOT_CHANGED", `${absolutePath} changed during bounded read`);
    }
    captured = Object.freeze({
      contentHash: createHash("sha256").update(bytes).digest("hex"),
      byteLength: bytes.byteLength,
      mode: Number(after.mode & 0o7777n) === 0o555 ? "0555" : "0444",
      bytes,
    });
  } catch (error) {
    primaryError = terminalWriteFailureV2(
      error,
      "LAYOUT_INVALID",
      `${absolutePath} cannot be read safely`,
    );
  }
  let closeError: PlatformReleaseTerminalWriteV2Error | undefined;
  if (descriptor !== undefined) {
    const descriptorToClose = descriptor;
    descriptor = undefined;
    try {
      closeSync(descriptorToClose);
    } catch (error) {
      closeError = terminalWriteFailureV2(
        error,
        "LAYOUT_INVALID",
        `${absolutePath} descriptor could not be closed`,
      );
    }
  }
  throwPrimaryFirstTerminalWriteFailureV2(
    primaryError,
    [closeError],
    `${absolutePath} bounded read and descriptor close both failed`,
  );
  return captured!;
}

function bindingFromTreeV2(
  tree: CanonicalRuntimeTreeV2,
  rootLocator: "payload/dist" | "payload/node_modules",
): CanonicalRuntimeTreeBindingCandidateV2 {
  const identity = {
    schema: "setfarm.canonical-runtime-tree-binding.v2" as const,
    treeSchema: "setfarm.canonical-runtime-tree.v2" as const,
    profile: tree.profile,
    rootLocator,
    treeHash: tree.treeHash,
    treePayloadHash: tree.payloadHash,
    fileCount: tree.fileCount,
    directoryCount: tree.directoryCount,
    totalBytes: tree.totalBytes,
  };
  return Object.freeze({
    ...identity,
    bindingHash: hashCanonicalRuntimeTreeBindingV2(identity),
  }) as CanonicalRuntimeTreeBindingCandidateV2;
}

function assertRuntimeTreesV2(
  root: RootIdentityV2,
  manifest: PlatformReleaseManifestV2,
  metadataProbe: CanonicalRuntimeMetadataProbeV2,
): Readonly<{
  platformTree: CanonicalRuntimeTreeV2;
  dependencyTree: CanonicalRuntimeTreeV2;
}> {
  const platformTree = captureCanonicalRuntimeTreeV2({
    root: path.join(root.absolutePath, "payload", "dist"),
    profile: "dist",
    metadataProbe,
  });
  const dependencyTree = captureCanonicalRuntimeTreeV2({
    root: path.join(root.absolutePath, "payload", "node_modules"),
    profile: "dependencies",
    metadataProbe,
  });
  const platformBinding = bindingFromTreeV2(
    platformTree,
    "payload/dist",
  );
  const dependencyBinding = bindingFromTreeV2(
    dependencyTree,
    "payload/node_modules",
  );
  if (
    canonicalJsonStringify(platformBinding)
      !== canonicalJsonStringify(manifest.runtimePayload.platformTree)
    || canonicalJsonStringify(dependencyBinding)
      !== canonicalJsonStringify(manifest.runtimePayload.dependencyTree)
  ) {
    fail(
      "RUNTIME_TREE_MISMATCH",
      "Fresh runtime-tree captures do not equal manifest bindings",
    );
  }
  return Object.freeze({ platformTree, dependencyTree });
}

function assertPackageJsonV2(
  root: RootIdentityV2,
  manifest: PlatformReleaseManifestV2,
): void {
  const observed = readStableFileV2(
    path.join(root.absolutePath, "payload", "package.json"),
    4 * 1024 * 1024,
  );
  const expected = manifest.runtimePayload.packageJson;
  if (
    observed.contentHash !== expected.hash
    || observed.byteLength !== expected.byteLength
    || observed.mode !== expected.mode
  ) {
    fail(
      "PACKAGE_JSON_MISMATCH",
      "Bundled package.json does not equal the manifest source ref",
    );
  }
}

function assertStitchConverterV2(
  root: RootIdentityV2,
  manifest: PlatformReleaseManifestV2,
): void {
  const expected = manifest.legacyAssets.stitchConverter;
  const observed = readStableFileV2(
    path.join(root.absolutePath, expected.locator),
    64 * 1024 * 1024,
  );
  if (
    observed.contentHash !== expected.hash
    || observed.byteLength !== expected.byteLength
    || observed.mode !== expected.mode
  ) {
    fail(
      "STITCH_CONVERTER_MISMATCH",
      "Bundled Stitch converter does not equal the manifest ref",
    );
  }
}

function assertMaterializedModulesV2(
  root: RootIdentityV2,
  manifest: PlatformReleaseManifestV2,
  platformTree: CanonicalRuntimeTreeV2,
): void {
  const refs = manifest.requiredModuleClosure.entries.map(
    (entry) => entry.module,
  );
  const locators = refs.map((entry) => entry.payloadLocator);
  if (
    new Set(locators).size !== locators.length
    || refs.some((entry) =>
      !entry.payloadLocator.startsWith("payload/dist/"))
  ) {
    fail(
      "MODULE_BYTES_MISMATCH",
      "Materialized module refs must be unique payload/dist descendants",
    );
  }
  const treeFiles = new Map(
    platformTree.entries
      .filter((entry) => entry.type === "file")
      .map((entry) => [entry.path, entry]),
  );
  for (const expected of refs) {
    const observed = readStableFileV2(
      path.join(root.absolutePath, expected.payloadLocator),
      64 * 1024 * 1024,
    );
    const treeLocator = expected.moduleLocator.slice("dist/".length);
    const treeEntry = treeFiles.get(treeLocator);
    if (
      observed.contentHash !== expected.contentHash
      || observed.byteLength !== expected.byteLength
      || observed.mode !== expected.mode
      || !treeEntry
      || treeEntry.contentHash !== expected.contentHash
      || treeEntry.byteLength !== expected.byteLength
      || treeEntry.mode !== expected.mode
    ) {
      fail(
        "MODULE_BYTES_MISMATCH",
        `Materialized module ${expected.moduleLocator} differs from its required closure ref`,
      );
    }
  }
}

function fsyncDirectoryV2(
  absolutePath: string,
  expectedRoot?: RootIdentityV2,
): void {
  let descriptor: number | undefined;
  let primaryError: PlatformReleaseTerminalWriteV2Error | undefined;
  try {
    descriptor = openSync(
      absolutePath,
      constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
    );
    if (expectedRoot !== undefined) {
      const observed = fstatSync(descriptor, { bigint: true });
      if (
        observed.dev !== expectedRoot.dev
        || observed.ino !== expectedRoot.ino
        || observed.uid !== expectedRoot.ownerUid
        || observed.gid !== expectedRoot.ownerGid
        || !observed.isDirectory()
      ) {
        fail("ROOT_CHANGED", "Directory identity changed before fsync");
      }
    }
    fsyncSync(descriptor);
  } catch (error) {
    primaryError = terminalWriteFailureV2(
      error,
      "MANIFEST_WRITE_FAILED",
      "Release directory could not be fsynced",
    );
  }
  let closeError: PlatformReleaseTerminalWriteV2Error | undefined;
  if (descriptor !== undefined) {
    const descriptorToClose = descriptor;
    descriptor = undefined;
    try {
      closeSync(descriptorToClose);
    } catch (error) {
      closeError = terminalWriteFailureV2(
        error,
        "MANIFEST_WRITE_FAILED",
        "Release directory descriptor could not be closed",
      );
    }
  }
  throwPrimaryFirstTerminalWriteFailureV2(
    primaryError,
    [closeError],
    "Release directory fsync and descriptor close both failed",
  );
}

function finalizeRootReadOnlyV2(
  root: RootIdentityV2,
  onRootReadOnly: () => void,
): void {
  let descriptor: number | undefined;
  let primaryError: PlatformReleaseTerminalWriteV2Error | undefined;
  try {
    descriptor = openSync(
      root.absolutePath,
      constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
    );
    const before = fstatSync(descriptor, { bigint: true });
    if (
      !before.isDirectory()
      || before.dev !== root.dev
      || before.ino !== root.ino
      || before.uid !== root.ownerUid
      || before.gid !== root.ownerGid
      || Number(before.mode & 0o7777n) !== 0o700
    ) {
      fail("ROOT_CHANGED", "Stage root identity changed before read-only finalization");
    }
    fchmodSync(descriptor, 0o555);
    onRootReadOnly();
    const after = fstatSync(descriptor, { bigint: true });
    if (
      !after.isDirectory()
      || after.dev !== root.dev
      || after.ino !== root.ino
      || after.uid !== root.ownerUid
      || after.gid !== root.ownerGid
      || Number(after.mode & 0o7777n) !== 0o555
    ) {
      fail("ROOT_CHANGED", "Stage root identity changed during read-only finalization");
    }
    fsyncSync(descriptor);
  } catch (error) {
    primaryError = terminalWriteFailureV2(
      error,
      "MANIFEST_WRITE_FAILED",
      "Release root could not be finalized read-only",
    );
  }
  let closeError: PlatformReleaseTerminalWriteV2Error | undefined;
  if (descriptor !== undefined) {
    const descriptorToClose = descriptor;
    descriptor = undefined;
    try {
      closeSync(descriptorToClose);
    } catch (error) {
      closeError = terminalWriteFailureV2(
        error,
        "MANIFEST_WRITE_FAILED",
        "Release root descriptor could not be closed after finalization",
      );
    }
  }
  throwPrimaryFirstTerminalWriteFailureV2(
    primaryError,
    [closeError],
    "Release root finalization and descriptor close both failed",
  );
}

function writeAllV2(descriptor: number, bytes: Buffer): void {
  let offset = 0;
  while (offset < bytes.byteLength) {
    const written = writeSync(
      descriptor,
      bytes,
      offset,
      bytes.byteLength - offset,
      null,
    );
    if (written < 1) {
      fail("MANIFEST_WRITE_FAILED", "Manifest write made no progress");
    }
    offset += written;
  }
}

function assertTerminalManifestFileV2(
  manifestPath: string,
  expectedBytes: Buffer,
): void {
  const observed = readStableFileV2(
    manifestPath,
    PLATFORM_RELEASE_MANIFEST_V2_MAX_CANONICAL_BYTES + 1,
  );
  if (
    observed.mode !== "0444"
    || !observed.bytes.equals(expectedBytes)
  ) {
    fail(
      "MANIFEST_WRITE_FAILED",
      "Terminal manifest bytes or mode differ after fsync",
    );
  }
}

function terminalWriteManifestV2(
  root: RootIdentityV2,
  manifest: PlatformReleaseManifestV2,
  revalidateBeforeFinalize: () => void,
  testHooks?: PlatformReleaseTerminalWriterV2TestHooks,
): Buffer {
  const canonicalText = canonicalJsonStringify(manifest);
  const canonicalBytes = Buffer.from(`${canonicalText}\n`, "utf8");
  if (
    Buffer.byteLength(canonicalText, "utf8")
      > PLATFORM_RELEASE_MANIFEST_V2_MAX_CANONICAL_BYTES
  ) {
    fail("MANIFEST_WRITE_FAILED", "Canonical manifest exceeds its byte cap");
  }
  const manifestPath = path.join(
    root.absolutePath,
    PLATFORM_RELEASE_MANIFEST_V2_FILENAME,
  );
  let descriptor: number | undefined;
  let manifestCreated = false;
  let manifestRollbackEligible = false;
  try {
    assertRootIdentityV2(root);
    descriptor = openSync(
      manifestPath,
      constants.O_WRONLY
        | constants.O_CREAT
        | constants.O_EXCL
        | constants.O_NOFOLLOW,
      0o600,
    );
    manifestCreated = true;
    writeAllV2(descriptor, canonicalBytes);
    fchmodSync(descriptor, 0o444);
    fsyncSync(descriptor);
    const descriptorToClose = descriptor;
    descriptor = undefined;
    try {
      closeSync(descriptorToClose);
      testHooks?.afterManifestDescriptorClose?.();
      manifestRollbackEligible = true;
    } catch (error) {
      throw terminalWriteFailureV2(
        error,
        "MANIFEST_WRITE_FAILED",
        "Terminal manifest descriptor could not be closed",
      );
    }
    assertRootIdentityV2(root);
    assertTerminalManifestFileV2(manifestPath, canonicalBytes);
    const names = readDirectoryNamesV2(
      root.absolutePath,
      "Completed release root",
      2,
      "LAYOUT_INVALID",
      testHooks,
    );
    if (
      !sameStringArray(
        names,
        [PLATFORM_RELEASE_MANIFEST_V2_FILENAME, "payload"],
      )
    ) {
      fail(
        "LAYOUT_INVALID",
        "Completed release root contains unexpected entries",
      );
    }
    fsyncDirectoryV2(root.absolutePath, root);
    revalidateBeforeFinalize();
    testHooks?.beforeRootReadOnlyFinalization?.();
    assertRootIdentityV2(root);
    finalizeRootReadOnlyV2(root, () => {
      manifestRollbackEligible = false;
    });
    fsyncDirectoryV2(root.absolutePath, root);
    return Buffer.from(canonicalBytes);
  } catch (error) {
    const primaryError = terminalWriteFailureV2(
      error,
      "MANIFEST_WRITE_FAILED",
      "Terminal manifest write failed",
    );
    let closeError: PlatformReleaseTerminalWriteV2Error | undefined;
    if (descriptor !== undefined) {
      const descriptorToClose = descriptor;
      descriptor = undefined;
      try {
        closeSync(descriptorToClose);
        testHooks?.afterManifestDescriptorClose?.();
        manifestRollbackEligible = manifestCreated;
      } catch (closeFailure) {
        manifestRollbackEligible = false;
        closeError = terminalWriteFailureV2(
          closeFailure,
          "MANIFEST_WRITE_FAILED",
          "Terminal manifest descriptor could not be closed after write failure",
        );
      }
    }
    let cleanupError: PlatformReleaseTerminalWriteV2Error | undefined;
    if (manifestCreated && manifestRollbackEligible) {
      try {
        assertRootIdentityV2(root);
        testHooks?.beforeManifestRollback?.();
        // This test-fixture rollback is best-effort pathname cleanup,
        // not an atomic same-UID compare-and-swap. It is permitted only after
        // one definite descriptor close and never after an ambiguous close.
        unlinkSync(manifestPath);
        fsyncDirectoryV2(root.absolutePath, root);
      } catch (cleanupFailure) {
        cleanupError = new PlatformReleaseTerminalWriteV2Error(
          "CLEANUP_FAILED",
          "Terminal manifest rollback could not be completed",
          { cause: cleanupFailure },
        );
      }
    }
    throwPrimaryFirstTerminalWriteFailureV2(
      primaryError,
      [closeError, cleanupError],
      "Terminal manifest write settlement failed",
    );
    throw primaryError;
  }
}

function completedInspectionV2(
  manifest: PlatformReleaseManifestV2,
  buildAttestation: PlatformReleaseBuildAttestationV2,
  canonicalBytes: Buffer,
): CompletedPlatformReleaseStageCandidateInspectionV2 {
  return Object.freeze({
    schema:
      "setfarm.completed-platform-release-stage-candidate-inspection.v2",
    authorityState: "completed_stage_candidate_unverified",
    productionUse:
      "forbidden_until_publication_lease_and_fresh_verification",
    releaseId: manifest.manifestPayloadHash,
    manifestPayloadHash: manifest.manifestPayloadHash,
    buildAttestationHash: buildAttestation.attestationHash,
    manifestCanonicalByteLength: canonicalBytes.byteLength - 1,
    runtimePayloadHash: manifest.runtimePayload.runtimePayloadHash,
    platformTreeHash: manifest.runtimePayload.platformTree.treeHash,
    dependencyTreeHash: manifest.runtimePayload.dependencyTree.treeHash,
    launcherCatalogHash: manifest.launcherCatalog.catalogHash,
    runnerCatalogHash: manifest.runnerCatalog.catalogHash,
    requiredModuleClosureHash:
      manifest.requiredModuleClosure.closureHash,
    requiredModuleCount:
      manifest.requiredModuleClosure.entries.length,
  });
}

function assertTerminalTestFixtureRootV2(input: unknown): void {
  if (
    input === null
    || typeof input !== "object"
    || !Object.hasOwn(input, "stageRoot")
    || typeof (input as Record<string, unknown>).stageRoot !== "string"
  ) {
    return;
  }
  const stageRoot = (input as Record<string, string>).stageRoot;
  let expectedParents: ReadonlySet<string>;
  try {
    expectedParents = new Set([
      path.normalize(os.tmpdir()),
      path.normalize(realpathSync(os.tmpdir())),
    ]);
  } catch (error) {
    return fail(
      "ROOT_INVALID",
      "ForTest terminalization temporary fixture root cannot be anchored",
      error,
    );
  }
  const basename = path.basename(stageRoot);
  if (
    !expectedParents.has(path.dirname(stageRoot))
    || !basename.startsWith("setfarm-release-terminal-v2-")
  ) {
    fail(
      "ROOT_INVALID",
      "ForTest terminalization accepts only code-owned temporary fixture roots",
    );
  }
}

function boundedTerminalTestNumberV2(
  value: bigint,
  maximum: number,
  label: string,
): number {
  if (
    value < 0n
    || value > BigInt(maximum)
    || !Number.isSafeInteger(Number(value))
  ) {
    return fail(
      "ROOT_CHANGED",
      `Terminal test observation ${label} is outside its exact numeric boundary`,
    );
  }
  return Number(value);
}

type SealedRootMembershipEntryV2 = Readonly<{
  basename: string;
  objectKind: "ordinary_file" | "directory";
  device: string;
  inode: string;
  ownerUid: string;
  ownerGid: string;
  mode: string;
  linkCount: string;
  byteLength: string;
  modifiedTimeNanoseconds: string;
  changedTimeNanoseconds: string;
}>;

const SEALED_ROOT_MEMBERSHIP_SPEC_V2 = [
  {
    basename: PLATFORM_RELEASE_MANIFEST_V2_FILENAME,
    objectKind: "ordinary_file" as const,
    mode: 0o444,
  },
  {
    basename: "payload",
    objectKind: "directory" as const,
    mode: 0o555,
  },
] as const;

function captureTerminalTestRootStatV2(root: RootIdentityV2): BigIntStats {
  try {
    const owner = effectiveProcessOwnerV2("ROOT_CHANGED");
    const stat = lstatSync(root.absolutePath, { bigint: true });
    const real = realpathSync(root.absolutePath);
    if (
      stat.isSymbolicLink()
      || !stat.isDirectory()
      || stat.dev !== root.dev
      || stat.ino !== root.ino
      || stat.uid !== root.ownerUid
      || stat.gid !== root.ownerGid
      || stat.uid !== owner.uid
      || stat.gid !== owner.gid
      || Number(stat.mode & 0o7777n) !== 0o555
      || real !== root.absolutePath
    ) {
      return fail(
        "ROOT_CHANGED",
        "Terminal test observation root identity or read-only fence changed",
      );
    }
    return stat;
  } catch (error) {
    if (error instanceof PlatformReleaseTerminalWriteV2Error) throw error;
    return fail(
      "ROOT_CHANGED",
      "Terminal test observation root disappeared after finalization",
      error,
    );
  }
}

function sameTerminalTestRootStatV2(
  left: BigIntStats,
  right: BigIntStats,
): boolean {
  return left.dev === right.dev
    && left.ino === right.ino
    && left.uid === right.uid
    && left.gid === right.gid
    && left.mode === right.mode
    && left.nlink === right.nlink
    && left.size === right.size
    && left.mtimeNs === right.mtimeNs
    && left.ctimeNs === right.ctimeNs;
}

function terminalTestMembershipObjectKindV2(
  stat: BigIntStats,
): "ordinary_file" | "directory" | undefined {
  if (stat.isFile()) return "ordinary_file";
  if (stat.isDirectory()) return "directory";
  return undefined;
}

function sameTerminalTestMembershipStatV2(
  left: BigIntStats,
  right: BigIntStats,
): boolean {
  return terminalTestMembershipObjectKindV2(left)
      === terminalTestMembershipObjectKindV2(right)
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

function assertTerminalTestMembershipStatV2(
  stat: BigIntStats,
  spec: typeof SEALED_ROOT_MEMBERSHIP_SPEC_V2[number],
): void {
  const objectKind = terminalTestMembershipObjectKindV2(stat);
  if (
    stat.isSymbolicLink()
    || objectKind !== spec.objectKind
    || Number(stat.mode & 0o7777n) !== spec.mode
    || (objectKind === "ordinary_file" && stat.nlink !== 1n)
  ) {
    fail(
      "ROOT_CHANGED",
      `Terminal test observation member ${spec.basename} kind or identity changed`,
    );
  }
}

function captureTerminalTestMembershipEntryV2(
  root: RootIdentityV2,
  spec: typeof SEALED_ROOT_MEMBERSHIP_SPEC_V2[number],
  testHooks?: PlatformReleaseTerminalWriterV2TestHooks,
): SealedRootMembershipEntryV2 {
  const absolutePath = path.join(root.absolutePath, spec.basename);
  const hookContext = Object.freeze({
    absolutePath,
    basename: spec.basename,
    objectKind: spec.objectKind,
  });
  let descriptor: number | undefined;
  let captured: SealedRootMembershipEntryV2 | undefined;
  let primaryError: PlatformReleaseTerminalWriteV2Error | undefined;
  try {
    const before = lstatSync(absolutePath, { bigint: true });
    assertTerminalTestMembershipStatV2(before, spec);
    descriptor = openSync(
      absolutePath,
      spec.objectKind === "ordinary_file"
        ? constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK
        : constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
    );
    const admitted = fstatSync(descriptor, { bigint: true });
    assertTerminalTestMembershipStatV2(admitted, spec);
    if (!sameTerminalTestMembershipStatV2(before, admitted)) {
      fail(
        "ROOT_CHANGED",
        `Terminal test observation member ${spec.basename} changed during descriptor admission`,
      );
    }
    testHooks?.afterSealedMembershipDescriptorAdmission?.(hookContext);
    const pathAfter = lstatSync(absolutePath, { bigint: true });
    assertTerminalTestMembershipStatV2(pathAfter, spec);
    if (!sameTerminalTestMembershipStatV2(admitted, pathAfter)) {
      fail(
        "ROOT_CHANGED",
        `Terminal test observation member ${spec.basename} changed after descriptor admission`,
      );
    }
    captured = Object.freeze({
      basename: spec.basename,
      objectKind: spec.objectKind,
      device: admitted.dev.toString(10),
      inode: admitted.ino.toString(10),
      ownerUid: admitted.uid.toString(10),
      ownerGid: admitted.gid.toString(10),
      mode: (admitted.mode & 0o7777n).toString(8).padStart(4, "0"),
      linkCount: admitted.nlink.toString(10),
      byteLength: admitted.size.toString(10),
      modifiedTimeNanoseconds: admitted.mtimeNs.toString(10),
      changedTimeNanoseconds: admitted.ctimeNs.toString(10),
    });
  } catch (error) {
    primaryError = terminalWriteFailureV2(
      error,
      "ROOT_CHANGED",
      `Terminal test observation member ${spec.basename} could not be captured`,
    );
  }
  let closeError: PlatformReleaseTerminalWriteV2Error | undefined;
  if (descriptor !== undefined) {
    const descriptorToClose = descriptor;
    descriptor = undefined;
    try {
      closeSync(descriptorToClose);
      testHooks?.afterSealedMembershipDescriptorClose?.(hookContext);
    } catch (error) {
      closeError = terminalWriteFailureV2(
        error,
        "ROOT_CHANGED",
        `Terminal test observation member ${spec.basename} descriptor could not be closed`,
      );
    }
  }
  throwPrimaryFirstTerminalWriteFailureV2(
    primaryError,
    [closeError],
    `Terminal test observation member ${spec.basename} capture and descriptor close both failed`,
  );
  return captured!;
}

function captureTerminalTestMembershipV2(
  root: RootIdentityV2,
  testHooks?: PlatformReleaseTerminalWriterV2TestHooks,
): readonly SealedRootMembershipEntryV2[] {
  try {
    const expectedNames = SEALED_ROOT_MEMBERSHIP_SPEC_V2
      .map((entry) => entry.basename)
      .sort();
    const names = readDirectoryNamesV2(
      root.absolutePath,
      "Terminal test observation root",
      expectedNames.length,
      "ROOT_CHANGED",
      testHooks,
    );
    if (!sameStringArray(names, expectedNames)) {
      return fail(
        "ROOT_CHANGED",
        "Terminal test observation root membership changed after finalization",
      );
    }
    return Object.freeze(
      SEALED_ROOT_MEMBERSHIP_SPEC_V2
        .map((spec) =>
          captureTerminalTestMembershipEntryV2(root, spec, testHooks))
        .sort((left, right) => left.basename.localeCompare(right.basename)),
    );
  } catch (error) {
    if (error instanceof PlatformReleaseTerminalWriteV2Error) throw error;
    return fail(
      "ROOT_CHANGED",
      "Terminal test observation root membership could not be captured",
      error,
    );
  }
}

function retainedResidueReceiptV2(
  root: RootIdentityV2,
): PlatformReleaseTerminalRetainedResidueReceiptV2 {
  return Object.freeze({
    schema:
      "setfarm.platform-release-terminal-retained-residue-receipt.v2" as const,
    version: "2.0.0" as const,
    authorityState:
      "test_fixture_terminalized_observation_failure_retained" as const,
    admissionScope: "test_fixture" as const,
    productionAuthority: false as const,
    productionAdmission: "forbidden" as const,
    mutationAuthority: false as const,
    deletionAuthority: false as const,
    fsMutation: false as const,
    rootDisposition:
      "retained_for_external_owner_inspection" as const,
    rootIdentity: Object.freeze({
      hostIdentityHash: root.hostIdentityHash,
      objectKind: "directory" as const,
      device: root.dev.toString(10),
      inode: root.ino.toString(10),
    }),
  });
}

function captureTerminalTestSealedRootV2(
  root: RootIdentityV2,
  testHooks?: PlatformReleaseTerminalWriterV2TestHooks,
): PlatformReleaseTerminalTestObservationV2["sealedRoot"] {
  const before = captureTerminalTestRootStatV2(root);
  const firstMembership = captureTerminalTestMembershipV2(root, testHooks);
  const between = captureTerminalTestRootStatV2(root);
  const secondMembership = captureTerminalTestMembershipV2(root, testHooks);
  const stat = captureTerminalTestRootStatV2(root);
  if (
    !sameTerminalTestRootStatV2(before, between)
    || !sameTerminalTestRootStatV2(between, stat)
    || canonicalJsonStringify(firstMembership)
      !== canonicalJsonStringify(secondMembership)
  ) {
    return fail(
      "ROOT_CHANGED",
      "Terminal test observation root or exact membership changed during capture",
    );
  }
  const stableIdentity = Object.freeze({
    hostIdentityHash: root.hostIdentityHash,
    objectKind: "directory" as const,
    device: stat.dev.toString(10),
    inode: stat.ino.toString(10),
  });
  const mutableFingerprint = Object.freeze({
    ownerUid: boundedTerminalTestNumberV2(
      stat.uid,
      4_294_967_294,
      "owner UID",
    ),
    ownerGid: boundedTerminalTestNumberV2(
      stat.gid,
      4_294_967_294,
      "owner GID",
    ),
    mode: "0555" as const,
    linkCount: boundedTerminalTestNumberV2(
      stat.nlink,
      Number.MAX_SAFE_INTEGER,
      "link count",
    ),
    byteLength: boundedTerminalTestNumberV2(
      stat.size,
      Number.MAX_SAFE_INTEGER,
      "byte length",
    ),
    modifiedTimeNanoseconds: stat.mtimeNs.toString(10),
    changedTimeNanoseconds: stat.ctimeNs.toString(10),
  });
  const membershipHash = hashCanonicalJson({
    schema: "setfarm.platform-release-terminal-test-sealed-root-membership.v2",
    entries: secondMembership.map(({ basename, objectKind, device, inode }) => ({
      basename,
      objectKind,
      device,
      inode,
    })),
  });
  const identity = { stableIdentity, mutableFingerprint, membershipHash };
  return Object.freeze({
    ...identity,
    observationHash:
      hashPlatformReleaseTerminalTestSealedRootObservationV2(identity),
  });
}

function terminalizePlatformReleaseManifestV2(
  input: unknown,
  testHooks?: PlatformReleaseTerminalWriterV2TestHooks,
): CompletedStageStateV2 {
  assertPlainExactInput(input);
  const root = anchorPrivateStageRootV2(input.stageRoot);
  let manifest: PlatformReleaseManifestV2;
  let buildAttestation: PlatformReleaseBuildAttestationV2;
  try {
    const envelope = parsePlatformReleaseCandidateEnvelopeV2({
      schema: PLATFORM_RELEASE_CANDIDATE_ENVELOPE_V2_SCHEMA,
      manifest: input.manifest,
      buildAttestation: input.buildAttestation,
    });
    manifest = envelope.manifest;
    buildAttestation = envelope.buildAttestation;
  } catch (error) {
    return fail(
      "INPUT_INVALID",
      "Terminal writer manifest and build attestation candidate are invalid",
      error,
    );
  }
  assertPreManifestLayoutV2(root, testHooks);
  const validateStageBytes = () => {
    const trees = assertRuntimeTreesV2(
      root,
      manifest,
      input.metadataProbe,
    );
    assertRootIdentityV2(root);
    assertPackageJsonV2(root, manifest);
    assertStitchConverterV2(root, manifest);
    assertMaterializedModulesV2(root, manifest, trees.platformTree);
    assertRootIdentityV2(root);
  };
  validateStageBytes();
  const manifestCanonicalBytes = terminalWriteManifestV2(
    root,
    manifest,
    validateStageBytes,
    testHooks,
  );
  const inspection = completedInspectionV2(
    manifest,
    buildAttestation,
    manifestCanonicalBytes,
  );
  return Object.freeze({
    root,
    manifest,
    buildAttestation,
    manifestCanonicalBytes,
    inspection,
  });
}

function terminalWritePlatformReleaseManifestObservationV2(
  input: unknown,
  observationFailure?: Error,
  testHooks?: PlatformReleaseTerminalWriterV2TestHooks,
): PlatformReleaseTerminalTestObservationV2 {
  assertPlainExactInput(input);
  assertTerminalTestFixtureRootV2(input);
  const state = terminalizePlatformReleaseManifestV2(input, testHooks);
  const retainedResidueReceipt = retainedResidueReceiptV2(state.root);
  try {
    if (observationFailure !== undefined) throw observationFailure;
    const sealedRoot = captureTerminalTestSealedRootV2(
      state.root,
      testHooks,
    );
    const identity = {
      schema: "setfarm.platform-release-terminal-test-observation.v2" as const,
      version: "2.0.0" as const,
      authorityState: "test_fixture_terminalized_unverified" as const,
      admissionScope: "test_fixture" as const,
      productionAuthority: false as const,
      productionAdmission: "forbidden" as const,
      productionUse:
        "forbidden_until_publication_lease_and_fresh_verification" as const,
      credentialUse: "none" as const,
      mutationAuthority: false as const,
      trustConclusion: "characterization_only" as const,
      releaseId: state.inspection.releaseId,
      manifestPayloadHash: state.inspection.manifestPayloadHash,
      buildAttestationHash: state.inspection.buildAttestationHash,
      manifestCanonicalByteLength:
        state.inspection.manifestCanonicalByteLength,
      runtimePayloadHash: state.inspection.runtimePayloadHash,
      platformTreeHash: state.inspection.platformTreeHash,
      dependencyTreeHash: state.inspection.dependencyTreeHash,
      launcherCatalogHash: state.inspection.launcherCatalogHash,
      runnerCatalogHash: state.inspection.runnerCatalogHash,
      requiredModuleClosureHash:
        state.inspection.requiredModuleClosureHash,
      requiredModuleCount: 17 as const,
      sealedRoot,
      durability: {
        manifestFsync: true as const,
        rootFsync: true as const,
        rootReadOnly: true as const,
      },
    };
    return parsePlatformReleaseTerminalTestObservationV2({
      ...identity,
      observationHash: hashPlatformReleaseTerminalTestObservationV2(identity),
    }) as PlatformReleaseTerminalTestObservationV2;
  } catch (error) {
    if (
      (typeof error === "object" && error !== null)
      || typeof error === "function"
    ) {
      if (retainedResidueReceiptsV2.has(error)) {
        const wrapper = new PlatformReleaseTerminalWriteV2Error(
          "ROOT_CHANGED",
          "Repeated natural terminal observation failure retained",
          { cause: error },
        );
        retainedResidueReceiptsV2.set(wrapper, retainedResidueReceipt);
        throw wrapper;
      } else {
        retainedResidueReceiptsV2.set(error, retainedResidueReceipt);
      }
    }
    throw error;
  }
}

export function terminalWritePlatformReleaseManifestForTestV2(
  input: unknown,
  testHooks: PlatformReleaseTerminalWriterV2TestHooks | undefined = undefined,
): PlatformReleaseTerminalTestObservationV2 {
  return terminalWritePlatformReleaseManifestObservationV2(
    input,
    undefined,
    testHooks,
  );
}

export function terminalWritePlatformReleaseManifestObservationFailureForTestV2(
  input: unknown,
  observationFailure: unknown,
  testHooks: PlatformReleaseTerminalWriterV2TestHooks | undefined = undefined,
): never {
  if (
    typeof observationFailure !== "object"
    || observationFailure === null
    || isProxy(observationFailure)
    || !isNativeError(observationFailure)
    || !(observationFailure instanceof Error)
    || Object.getPrototypeOf(observationFailure) !== Error.prototype
  ) {
    return fail(
      "INPUT_INVALID",
      "Observation failure injection must be one exact non-proxy Error",
    );
  }
  if (retainedResidueReceiptsV2.has(observationFailure)) {
    return fail(
      "INPUT_INVALID",
      "Observation failure injection must be one unused exact Error",
    );
  }
  terminalWritePlatformReleaseManifestObservationV2(
    input,
    observationFailure,
    testHooks,
  );
  throw observationFailure;
}

export function inspectPlatformReleaseTerminalRetainedResidueReceiptForTestV2(
  error: unknown,
): PlatformReleaseTerminalRetainedResidueReceiptV2 {
  if (
    typeof error !== "object"
    || error === null
    || isProxy(error)
    || !isNativeError(error)
    || !(error instanceof Error)
  ) {
    return fail(
      "RETAINED_RESIDUE_UNAUTHENTICATED",
      "Retained terminal residue inspection requires the exact observation error",
    );
  }
  const receipt = retainedResidueReceiptsV2.get(error);
  if (receipt === undefined) {
    return fail(
      "RETAINED_RESIDUE_UNAUTHENTICATED",
      "Retained terminal residue inspection requires the exact observation error",
    );
  }
  return receipt;
}

export function inspectCompletedPlatformReleaseStageCandidateV2(
  candidate: CompletedPlatformReleaseStageCandidateV2,
): CompletedPlatformReleaseStageCandidateInspectionV2 {
  const state = completedStageStatesV2.get(candidate);
  if (!state) {
    fail(
      "COMPLETED_STAGE_UNAUTHENTICATED",
      "Completed stage candidate is not an authentic terminal-writer handle",
    );
  }
  return Object.freeze(structuredClone(state.inspection));
}
