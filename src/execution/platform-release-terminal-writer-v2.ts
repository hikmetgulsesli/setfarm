import { createHash } from "node:crypto";
import {
  chmodSync,
  closeSync,
  constants,
  fchmodSync,
  fstatSync,
  fsyncSync,
  lstatSync,
  openSync,
  readSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  writeSync,
  type Stats,
} from "node:fs";
import path from "node:path";
import { isProxy } from "node:util/types";

import {
  canonicalJsonStringify,
} from "../product-compiler/canonical-json.js";
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
  dev: number;
  ino: number;
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
  let stat: Stats;
  let real: string;
  try {
    stat = lstatSync(stageRoot);
    real = realpathSync(stageRoot);
  } catch (error) {
    return fail("ROOT_INVALID", "Stage root cannot be inspected", error);
  }
  if (
    stat.isSymbolicLink()
    || !stat.isDirectory()
    || real !== stageRoot
    || modeBits(stat) !== 0o700
  ) {
    fail(
      "ROOT_INVALID",
      "Stage root must be one real private 0700 directory",
    );
  }
  return Object.freeze({
    absolutePath: stageRoot,
    dev: stat.dev,
    ino: stat.ino,
  });
}

function assertRootIdentityV2(root: RootIdentityV2): void {
  let stat: Stats;
  let real: string;
  try {
    stat = lstatSync(root.absolutePath);
    real = realpathSync(root.absolutePath);
  } catch (error) {
    return fail("ROOT_CHANGED", "Stage root disappeared", error);
  }
  if (
    stat.isSymbolicLink()
    || !stat.isDirectory()
    || stat.dev !== root.dev
    || stat.ino !== root.ino
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
  let stat: Stats;
  try {
    stat = lstatSync(absolutePath);
  } catch (error) {
    return fail("LAYOUT_INVALID", `${label} cannot be inspected`, error);
  }
  if (
    stat.isSymbolicLink()
    || !stat.isDirectory()
    || modeBits(stat) !== expectedMode
    || realpathSync(absolutePath) !== absolutePath
  ) {
    fail(
      "LAYOUT_INVALID",
      `${label} must be one real ${expectedMode.toString(8)} directory`,
    );
  }
}

function assertPreManifestLayoutV2(root: RootIdentityV2): void {
  assertRootIdentityV2(root);
  const names = readdirSync(root.absolutePath).sort();
  if (names.includes(PLATFORM_RELEASE_MANIFEST_V2_FILENAME)) {
    fail(
      "MANIFEST_ALREADY_PRESENT",
      "Terminal manifest file already exists",
    );
  }
  if (!sameStringArray(names, ["payload"])) {
    fail(
      "LAYOUT_INVALID",
      "Pre-manifest release root must contain exactly payload",
    );
  }
  const payload = path.join(root.absolutePath, "payload");
  assertDirectory(payload, 0o555, "Runtime payload root");
  const payloadNames = readdirSync(payload).sort();
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
  try {
    descriptor = openSync(
      absolutePath,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
    const before = fstatSync(descriptor);
    if (
      !before.isFile()
      || before.nlink !== 1
      || before.size < 1
      || before.size > maximumBytes
      || ![0o444, 0o555].includes(modeBits(before))
    ) {
      fail("LAYOUT_INVALID", `${absolutePath} is not one bounded release file`);
    }
    const bytes = Buffer.allocUnsafe(before.size);
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
    const after = fstatSync(descriptor);
    const pathAfter = lstatSync(absolutePath);
    if (
      offset !== bytes.byteLength
      || !after.isFile()
      || !pathAfter.isFile()
      || before.dev !== after.dev
      || before.ino !== after.ino
      || before.size !== after.size
      || before.mode !== after.mode
      || before.mtimeMs !== after.mtimeMs
      || before.ctimeMs !== after.ctimeMs
      || after.dev !== pathAfter.dev
      || after.ino !== pathAfter.ino
      || after.size !== pathAfter.size
      || after.mode !== pathAfter.mode
      || after.mtimeMs !== pathAfter.mtimeMs
      || after.ctimeMs !== pathAfter.ctimeMs
    ) {
      fail("ROOT_CHANGED", `${absolutePath} changed during bounded read`);
    }
    return Object.freeze({
      contentHash: createHash("sha256").update(bytes).digest("hex"),
      byteLength: bytes.byteLength,
      mode: modeBits(after) === 0o555 ? "0555" : "0444",
      bytes,
    });
  } catch (error) {
    if (error instanceof PlatformReleaseTerminalWriteV2Error) throw error;
    return fail("LAYOUT_INVALID", `${absolutePath} cannot be read safely`, error);
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
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

function fsyncDirectoryV2(absolutePath: string): void {
  let descriptor: number | undefined;
  try {
    descriptor = openSync(
      absolutePath,
      constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
    );
    fsyncSync(descriptor);
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
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
  let rootFinalized = false;
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
    closeSync(descriptor);
    descriptor = undefined;
    assertRootIdentityV2(root);
    assertTerminalManifestFileV2(manifestPath, canonicalBytes);
    const names = readdirSync(root.absolutePath).sort();
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
    fsyncDirectoryV2(root.absolutePath);
    revalidateBeforeFinalize();
    assertRootIdentityV2(root);
    chmodSync(root.absolutePath, 0o555);
    rootFinalized = true;
    fsyncDirectoryV2(root.absolutePath);
    const finalStat = statSync(root.absolutePath);
    if (modeBits(finalStat) !== 0o555) {
      fail("MANIFEST_WRITE_FAILED", "Release root did not become read-only");
    }
    return Buffer.from(canonicalBytes);
  } catch (error) {
    if (descriptor !== undefined) {
      try {
        closeSync(descriptor);
      } catch {
        // The primary terminal-write error remains authoritative.
      }
    }
    if (manifestCreated && !rootFinalized) {
      try {
        assertRootIdentityV2(root);
        rmSync(manifestPath, { force: true });
        fsyncDirectoryV2(root.absolutePath);
      } catch {
        // Never follow or mutate a root that no longer has the anchored identity.
      }
    }
    if (error instanceof PlatformReleaseTerminalWriteV2Error) throw error;
    return fail(
      "MANIFEST_WRITE_FAILED",
      "Terminal manifest write failed",
      error,
    );
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

export function terminalWritePlatformReleaseManifestCandidateV2(
  input: unknown,
): CompletedPlatformReleaseStageCandidateV2 {
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
  assertPreManifestLayoutV2(root);
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
  );
  const handle = new CompletedPlatformReleaseStageCandidateV2(
    COMPLETED_STAGE_CONSTRUCTOR_CAPABILITY_V2,
    manifest.manifestPayloadHash,
  );
  const inspection = completedInspectionV2(
    manifest,
    buildAttestation,
    manifestCanonicalBytes,
  );
  completedStageStatesV2.set(handle, Object.freeze({
    root,
    manifest,
    buildAttestation,
    manifestCanonicalBytes,
    inspection,
  }));
  return handle;
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
