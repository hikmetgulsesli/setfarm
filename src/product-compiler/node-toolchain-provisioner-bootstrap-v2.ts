import { createHash } from "node:crypto";
import { isProxy } from "node:util/types";

import { canonicalJsonBytes } from "./canonical-json.js";
import {
  renderNodeToolchainProvisionerBootstrapLauncherV2,
} from "./node-toolchain-provisioner-bootstrap-launcher-v2.js";
export {
  renderNodeToolchainProvisionerBootstrapLauncherV2,
} from "./node-toolchain-provisioner-bootstrap-launcher-v2.js";
import {
  copyBuiltNodeToolchainProvisionerBundleV2,
  type BuiltNodeToolchainProvisionerBundleV2,
} from "./node-toolchain-provisioner-bundle-authority-v2.js";
import {
  copyMaterializedNodeToolchainPrivateTreeBundleV2,
  inspectNodeToolchainPrivateTreeReceiptV2,
  type MaterializedNodeToolchainPrivateTreeV2,
  type NodeToolchainPrivateTreeBundleV2,
} from "./node-toolchain-private-tree-v2.js";
import {
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_AUTHORITY_REF_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_BUNDLE_LOCATOR_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ENTRYPOINT_SOURCE_LOCATOR_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_LAUNCHER_LOCATOR_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MANIFEST_LOCATOR_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MANIFEST_V2_SCHEMA,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MAX_BUNDLE_BYTES_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MAX_MANIFEST_BYTES_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MAX_RUNTIME_BYTES_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_RUNTIME_LOCATOR_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROOT_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_VERSION_V2,
  NodeToolchainProvisionerBootstrapManifestV2Schema,
  hashNodeToolchainProvisionerBootstrapBuildV2,
  hashNodeToolchainProvisionerBootstrapManifestV2,
  type NodeToolchainProvisionerBootstrapBuildHashPayloadV2,
  type NodeToolchainProvisionerBootstrapManifestHashPayloadV2,
  type NodeToolchainProvisionerBootstrapManifestV2,
} from "./schemas/node-toolchain-provisioner-bootstrap-v2.js";
import type {
  NodeToolchainProvisionerBundleAuthorityReceiptV2,
} from "./schemas/node-toolchain-provisioner-bundle-authority-v2.js";
import {
  NodeToolchainPrivateTreeReceiptV2Schema,
  type NodeToolchainPrivateTreeReceiptV2,
} from "./schemas/node-toolchain-private-tree-v2.js";

const ENTRYPOINT_SOURCE_MAX_BYTES_V2 = 1024 * 1024;
const PACKAGE_JSON_SOURCE_MAX_BYTES_V2 = 1024 * 1024;
const PACKAGE_LOCK_SOURCE_MAX_BYTES_V2 = 16 * 1024 * 1024;

export class NodeToolchainProvisionerBootstrapAuthorityErrorV2 extends Error {
  readonly code = "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_V2_INPUT_INVALID" as const;
  override readonly cause?: unknown;

  constructor(message: string, options?: ErrorOptions) {
    super(message.slice(0, 1_000), options);
    this.name = "NodeToolchainProvisionerBootstrapAuthorityErrorV2";
    this.cause = options?.cause;
  }
}

export type NodeToolchainProvisionerBootstrapReleaseInputV2 = Readonly<{
  codeSha: string;
  sourceTreeHash: string;
  packageVersion: string;
  entrypointSourceBytes: Uint8Array;
  packageJsonSourceBytes: Uint8Array;
  packageLockSourceBytes: Uint8Array;
  bundleBytes: Uint8Array;
  runtimeBytes: Uint8Array;
  sourcePrivateTree: NodeToolchainPrivateTreeReceiptV2;
}>;

export type CompiledNodeToolchainProvisionerBootstrapSnapshotV2 = Readonly<{
  manifest: NodeToolchainProvisionerBootstrapManifestV2;
  manifestBytes: Buffer;
  launcherBytes: Buffer;
  bundleBytes: Buffer;
  runtimeBytes: Buffer;
}>;

type CompiledBootstrapStateV2 = Readonly<{
  snapshot: CompiledNodeToolchainProvisionerBootstrapSnapshotV2;
}>;

const compiledHandleCapabilityV2 = Object.freeze({});
const compiledBootstrapStatesV2 = new WeakMap<object, CompiledBootstrapStateV2>();
const disposedCompiledBootstrapHandlesV2 = new WeakSet<object>();

export class CompiledNodeToolchainProvisionerBootstrapV2 {
  readonly manifestHash: string;
  readonly admissionScope: "production_root" | "test_fixture";

  constructor(capability: object, state: CompiledBootstrapStateV2) {
    if (capability !== compiledHandleCapabilityV2) {
      throw new NodeToolchainProvisionerBootstrapAuthorityErrorV2(
        "Compiled bootstrap constructor capability is unavailable",
      );
    }
    this.manifestHash = state.snapshot.manifest.manifestHash;
    this.admissionScope = state.snapshot.manifest.admissionScope;
    compiledBootstrapStatesV2.set(this, state);
    Object.freeze(this);
  }
}

const BOOTSTRAP_INPUT_KEYS_V2 = Object.freeze([
  "bundleBytes",
  "codeSha",
  "entrypointSourceBytes",
  "packageJsonSourceBytes",
  "packageLockSourceBytes",
  "packageVersion",
  "runtimeBytes",
  "sourcePrivateTree",
  "sourceTreeHash",
] as const);

function fail(message: string, cause?: unknown): never {
  throw new NodeToolchainProvisionerBootstrapAuthorityErrorV2(
    message,
    cause === undefined ? undefined : { cause },
  );
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function ownedBytes(value: unknown, label: string, maxBytes: number): Buffer {
  if (
    !(value instanceof Uint8Array)
    || isProxy(value)
    || value.buffer instanceof SharedArrayBuffer
    || value.byteLength < 1
    || value.byteLength > maxBytes
  ) {
    return fail(`${label} must be one bounded non-proxy byte array`);
  }
  try {
    return Buffer.from(value);
  } catch (error) {
    return fail(`${label} could not be copied`, error);
  }
}

function snapshotInput(input: unknown): NodeToolchainProvisionerBootstrapReleaseInputV2 {
  try {
    if (
      typeof input !== "object"
      || input === null
      || isProxy(input)
      || Object.getPrototypeOf(input) !== Object.prototype
    ) {
      return fail("Bootstrap compiler input must be one plain exact object");
    }
    const keys = Reflect.ownKeys(input);
    const sortedKeys = keys.every((key): key is string => typeof key === "string")
      ? [...keys].sort()
      : [];
    if (
      sortedKeys.length !== BOOTSTRAP_INPUT_KEYS_V2.length
      || sortedKeys.some((key, index) => key !== BOOTSTRAP_INPUT_KEYS_V2[index])
    ) {
      return fail("Bootstrap compiler input has unknown, missing or non-canonical fields");
    }
    const descriptors = Object.getOwnPropertyDescriptors(input);
    const values = Object.fromEntries(BOOTSTRAP_INPUT_KEYS_V2.map((key) => {
      const descriptor = descriptors[key];
      if (!descriptor || !("value" in descriptor) || descriptor.get || descriptor.set) {
        return fail("Bootstrap compiler input must not contain accessors");
      }
      return [key, descriptor.value];
    })) as Record<(typeof BOOTSTRAP_INPUT_KEYS_V2)[number], unknown>;
    if (
      typeof values.codeSha !== "string"
      || typeof values.sourceTreeHash !== "string"
      || typeof values.packageVersion !== "string"
    ) {
      return fail("Bootstrap release identity fields must be exact strings");
    }
    return Object.freeze({
      codeSha: values.codeSha,
      sourceTreeHash: values.sourceTreeHash,
      packageVersion: values.packageVersion,
      entrypointSourceBytes: values.entrypointSourceBytes as Uint8Array,
      packageJsonSourceBytes: values.packageJsonSourceBytes as Uint8Array,
      packageLockSourceBytes: values.packageLockSourceBytes as Uint8Array,
      bundleBytes: values.bundleBytes as Uint8Array,
      runtimeBytes: values.runtimeBytes as Uint8Array,
      sourcePrivateTree: values.sourcePrivateTree as NodeToolchainPrivateTreeReceiptV2,
    });
  } catch (error) {
    if (error instanceof NodeToolchainProvisionerBootstrapAuthorityErrorV2) throw error;
    return fail("Bootstrap compiler input could not be inspected safely", error);
  }
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

type BootstrapBuildAuthorityV2 =
  | Readonly<{
    kind: "raw_test_fixture";
    authorityRef: "TEST_NODE_TOOLCHAIN_PROVISIONER_BUNDLE_INPUT_V2";
    admissionScope: "test_fixture";
  }>
  | Readonly<{
    kind: "authenticated_bundle";
    receipt: NodeToolchainProvisionerBundleAuthorityReceiptV2;
  }>;

function compile(
  untrustedInput: unknown,
  scope: Readonly<{
    admissionScope: "production_root" | "test_fixture";
    rootLocator: string;
    expectedOwnerUid: number;
    expectedOwnerGid: number;
  }>,
  authority: BootstrapBuildAuthorityV2,
): CompiledNodeToolchainProvisionerBootstrapSnapshotV2 {
  const input = snapshotInput(untrustedInput);
  let sourcePrivateTree: NodeToolchainPrivateTreeReceiptV2;
  try {
    sourcePrivateTree = NodeToolchainPrivateTreeReceiptV2Schema.parse(input.sourcePrivateTree);
  } catch (error) {
    return fail("Bootstrap source private-tree receipt is invalid", error);
  }
  const entrypointSourceBytes = ownedBytes(
    input.entrypointSourceBytes,
    "Bootstrap entrypoint source",
    ENTRYPOINT_SOURCE_MAX_BYTES_V2,
  );
  const packageJsonSourceBytes = ownedBytes(
    input.packageJsonSourceBytes,
    "Bootstrap package.json source",
    PACKAGE_JSON_SOURCE_MAX_BYTES_V2,
  );
  const packageLockSourceBytes = ownedBytes(
    input.packageLockSourceBytes,
    "Bootstrap package-lock source",
    PACKAGE_LOCK_SOURCE_MAX_BYTES_V2,
  );
  const bundleBytes = ownedBytes(
    input.bundleBytes,
    "Bootstrap bundle",
    NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MAX_BUNDLE_BYTES_V2,
  );
  const runtimeBytes = ownedBytes(
    input.runtimeBytes,
    "Bootstrap runtime",
    NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MAX_RUNTIME_BYTES_V2,
  );
  if (
    runtimeBytes.byteLength !== sourcePrivateTree.tree.node.byteLength
    || sha256(runtimeBytes) !== sourcePrivateTree.tree.node.contentHash
  ) {
    return fail("Bootstrap runtime bytes do not equal the authenticated private-tree Node member");
  }
  const buildIdentity: NodeToolchainProvisionerBootstrapBuildHashPayloadV2 = {
    contractRef: "BUILD_NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_V2",
    sourceTreeHash: input.sourceTreeHash,
    entrypointSource: {
      schema: "setfarm.source-artifact-ref.v1",
      locator: NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ENTRYPOINT_SOURCE_LOCATOR_V2,
      mediaType: "text/typescript",
      byteLength: entrypointSourceBytes.byteLength,
      hash: sha256(entrypointSourceBytes),
    },
    packageJsonSource: {
      schema: "setfarm.source-artifact-ref.v1",
      locator: "package.json",
      mediaType: "application/json",
      byteLength: packageJsonSourceBytes.byteLength,
      hash: sha256(packageJsonSourceBytes),
    },
    packageLockSource: {
      schema: "setfarm.source-artifact-ref.v1",
      locator: "package-lock.json",
      mediaType: "application/json",
      byteLength: packageLockSourceBytes.byteLength,
      hash: sha256(packageLockSourceBytes),
    },
    authority,
    bundler: {
      packageName: "esbuild",
      version: "0.28.1",
      packageIntegrity:
        "sha512-HrJrvZv5ayxBzPfwphOoNzkzOIIlifzk0KJrGK2c8R4+LKpMtpYLQeUdjnwjWv/LZlkH2laZk+4w78pi99D4Vw==",
      format: "cjs",
      platform: "node",
      target: "node22",
      bundle: true,
      treeShaking: true,
      sourcemap: false,
      legalComments: "none",
      externalDependencies: [],
    },
  };
  const build = {
    ...buildIdentity,
    buildContractHash: hashNodeToolchainProvisionerBootstrapBuildV2(buildIdentity),
  };
  const bundleSha256 = sha256(bundleBytes);
  const runtimeSha256 = sha256(runtimeBytes);
  const launcherBytes = renderNodeToolchainProvisionerBootstrapLauncherV2({
    rootLocator: scope.rootLocator,
    expectedOwnerUid: scope.expectedOwnerUid,
    expectedOwnerGid: scope.expectedOwnerGid,
    bundleSha256,
    bundleByteLength: bundleBytes.byteLength,
    runtimeSha256,
    runtimeByteLength: runtimeBytes.byteLength,
  });
  const installedBase = {
    ownerUid: scope.expectedOwnerUid,
    ownerGid: scope.expectedOwnerGid,
    linkCount: 1 as const,
  };
  const identity: NodeToolchainProvisionerBootstrapManifestHashPayloadV2 = {
    schema: NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MANIFEST_V2_SCHEMA,
    manifestVersion: NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_VERSION_V2,
    authorityRef: NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_AUTHORITY_REF_V2,
    admissionScope: scope.admissionScope,
    release: {
      codeSha: input.codeSha,
      sourceTreeHash: input.sourceTreeHash,
      branch: authority.kind === "authenticated_bundle"
        ? authority.receipt.release.branch
        : "test_fixture",
      dirty: authority.kind === "authenticated_bundle"
        ? authority.receipt.release.dirty
        : true,
      packageName: "setfarm",
      packageVersion: input.packageVersion,
    },
    build,
    distribution: {
      manifestHash: sourcePrivateTree.inventory.distribution.manifest.manifestHash,
      artifactHash: sourcePrivateTree.inventory.distribution.artifact.artifactHash,
      architecture: sourcePrivateTree.inventory.distribution.artifact.architecture,
      sourcePrivateTree,
    },
    layout: {
      rootLocator: scope.rootLocator,
      manifestLocator: NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MANIFEST_LOCATOR_V2,
      allowedRootEntries: [
        NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MANIFEST_LOCATOR_V2,
        "bin",
        "lib",
        "runtime",
      ],
      allowedDirectories: [".", "bin", "lib", "runtime"],
      directoryMode: "0555",
      manifestMode: "0444",
      expectedOwnerUid: scope.expectedOwnerUid,
      expectedOwnerGid: scope.expectedOwnerGid,
      publicationPolicy: "root_owned_every_only_no_replace_fsync_manifest_last_v2",
    },
    files: {
      launcher: {
        artifactRef: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_LAUNCHER_V2",
        locator: NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_LAUNCHER_LOCATOR_V2,
        mediaType: "text/x-shellscript",
        sha256: sha256(launcherBytes),
        byteLength: launcherBytes.byteLength,
        mode: "0555",
        ...installedBase,
      },
      bundle: {
        artifactRef: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_BUNDLE_V2",
        locator: NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_BUNDLE_LOCATOR_V2,
        mediaType: "application/javascript",
        sha256: bundleSha256,
        byteLength: bundleBytes.byteLength,
        mode: "0444",
        ...installedBase,
      },
      bootstrapRuntime: {
        artifactRef: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_RUNTIME_V2",
        locator: NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_RUNTIME_LOCATOR_V2,
        mediaType: "application/x-mach-binary",
        sha256: runtimeSha256,
        byteLength: runtimeBytes.byteLength,
        mode: "0555",
        ...installedBase,
      },
    },
    launcher: {
      contractRef: "NODE_TOOLCHAIN_PROVISIONER_ROOT_LAUNCHER_V2",
      shell: "/bin/sh",
      rootRequired: true,
      ambientEnvironment: "discard_all",
      directExec: true,
      cwdPolicy: "fixed_verified_package_root",
      systemTools: [
        "/usr/bin/env",
        "/usr/bin/id",
        "/usr/bin/printf",
        "/usr/bin/shasum",
        "/usr/bin/stat",
      ],
      fixedEnvironment: {
        HOME: "/var/empty",
        LANG: "C",
        LC_ALL: "C",
        NO_COLOR: "1",
        TMPDIR: "/private/var/tmp",
        TZ: "UTC",
      },
    },
    cli: {
      contractSchema: "setfarm.node-toolchain-provisioner-cli-failure.v2",
      contractVersion: "2.0.0",
      authorityRef: "AUTH_NODE_TOOLCHAIN_PROVISIONER_CLI_V2",
      commands: ["inspect", "plan_apply", "plan_rollback", "apply", "verify", "rollback"],
      successOutput: "one_canonical_artifact_without_trailing_lf_v2",
      failureOutput: "one_canonical_failure_without_trailing_lf_v2",
      stderrAuthority: "non_authoritative_bounded_diagnostic",
    },
  };
  const parsed = NodeToolchainProvisionerBootstrapManifestV2Schema.safeParse({
    ...identity,
    manifestHash: hashNodeToolchainProvisionerBootstrapManifestV2(identity),
  });
  if (!parsed.success) {
    return fail("Compiled bootstrap manifest failed its exact V2 schema", parsed.error);
  }
  const manifest = deepFreezeJson(parsed.data);
  const manifestBytes = canonicalJsonBytes(manifest);
  if (manifestBytes.byteLength > NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MAX_MANIFEST_BYTES_V2) {
    return fail("Compiled bootstrap manifest exceeds its byte bound");
  }
  return Object.freeze({
    manifest,
    manifestBytes,
    launcherBytes: Buffer.from(launcherBytes),
    bundleBytes: Buffer.from(bundleBytes),
    runtimeBytes: Buffer.from(runtimeBytes),
  });
}

export function compileNodeToolchainProvisionerBootstrapV2ForTest(
  input: unknown,
  testRoot: string,
): CompiledNodeToolchainProvisionerBootstrapSnapshotV2 {
  if (typeof process.getuid !== "function" || typeof process.getgid !== "function") {
    return fail("Test bootstrap compilation requires POSIX owner identity");
  }
  return compile(
    input,
    {
      admissionScope: "test_fixture",
      rootLocator: testRoot,
      expectedOwnerUid: process.getuid(),
      expectedOwnerGid: process.getgid(),
    },
    {
      kind: "raw_test_fixture",
      authorityRef: "TEST_NODE_TOOLCHAIN_PROVISIONER_BUNDLE_INPUT_V2",
      admissionScope: "test_fixture",
    },
  );
}

function zeroBundleSnapshot(
  snapshot: ReturnType<typeof copyBuiltNodeToolchainProvisionerBundleV2> | undefined,
): void {
  if (!snapshot) return;
  snapshot.bundleBytes.fill(0);
  snapshot.entrypointSourceBytes.fill(0);
  snapshot.packageJsonSourceBytes.fill(0);
  snapshot.packageLockSourceBytes.fill(0);
}

function zeroPrivateTreeBundle(bundle: NodeToolchainPrivateTreeBundleV2 | undefined): void {
  if (!bundle) return;
  for (const entry of bundle.entries) entry.bytes?.fill(0);
}

function zeroCompiledSnapshot(
  snapshot: CompiledNodeToolchainProvisionerBootstrapSnapshotV2 | undefined,
): void {
  if (!snapshot) return;
  snapshot.manifestBytes.fill(0);
  snapshot.launcherBytes.fill(0);
  snapshot.bundleBytes.fill(0);
  snapshot.runtimeBytes.fill(0);
}

function validatedCompiledSnapshot(
  snapshot: CompiledNodeToolchainProvisionerBootstrapSnapshotV2,
): CompiledNodeToolchainProvisionerBootstrapSnapshotV2 {
  let manifest: NodeToolchainProvisionerBootstrapManifestV2;
  try {
    manifest = NodeToolchainProvisionerBootstrapManifestV2Schema.parse(snapshot.manifest);
  } catch (error) {
    return fail("Authenticated compiled bootstrap manifest is invalid", error);
  }
  if (manifest.build.authority.kind !== "authenticated_bundle") {
    return fail("Raw test bootstrap output cannot become compiled authority");
  }
  const manifestBytes = ownedBytes(
    snapshot.manifestBytes,
    "Compiled bootstrap manifest",
    NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MAX_MANIFEST_BYTES_V2,
  );
  const launcherBytes = ownedBytes(
    snapshot.launcherBytes,
    "Compiled bootstrap launcher",
    64 * 1024,
  );
  const bundleBytes = ownedBytes(
    snapshot.bundleBytes,
    "Compiled bootstrap bundle",
    NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MAX_BUNDLE_BYTES_V2,
  );
  const runtimeBytes = ownedBytes(
    snapshot.runtimeBytes,
    "Compiled bootstrap runtime",
    NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MAX_RUNTIME_BYTES_V2,
  );
  const expectedLauncher = renderNodeToolchainProvisionerBootstrapLauncherV2({
    rootLocator: manifest.layout.rootLocator,
    expectedOwnerUid: manifest.layout.expectedOwnerUid,
    expectedOwnerGid: manifest.layout.expectedOwnerGid,
    bundleSha256: manifest.files.bundle.sha256,
    bundleByteLength: manifest.files.bundle.byteLength,
    runtimeSha256: manifest.files.bootstrapRuntime.sha256,
    runtimeByteLength: manifest.files.bootstrapRuntime.byteLength,
  });
  let released = false;
  try {
    if (
      !manifestBytes.equals(canonicalJsonBytes(manifest))
      || manifest.files.launcher.sha256 !== sha256(launcherBytes)
      || manifest.files.launcher.byteLength !== launcherBytes.byteLength
      || manifest.files.bundle.sha256 !== sha256(bundleBytes)
      || manifest.files.bundle.byteLength !== bundleBytes.byteLength
      || manifest.files.bootstrapRuntime.sha256 !== sha256(runtimeBytes)
      || manifest.files.bootstrapRuntime.byteLength !== runtimeBytes.byteLength
      || !launcherBytes.equals(expectedLauncher)
    ) {
      return fail("Compiled bootstrap bytes do not equal their authenticated manifest");
    }
    const result = Object.freeze({
      manifest: deepFreezeJson(structuredClone(manifest)),
      manifestBytes,
      launcherBytes,
      bundleBytes,
      runtimeBytes,
    });
    released = true;
    return result;
  } catch (error) {
    if (error instanceof NodeToolchainProvisionerBootstrapAuthorityErrorV2) throw error;
    return fail("Compiled bootstrap bytes could not be validated safely", error);
  } finally {
    expectedLauncher.fill(0);
    if (!released) {
      manifestBytes.fill(0);
      launcherBytes.fill(0);
      bundleBytes.fill(0);
      runtimeBytes.fill(0);
    }
  }
}

function issueCompiledBootstrapAuthority(
  snapshot: CompiledNodeToolchainProvisionerBootstrapSnapshotV2,
): CompiledNodeToolchainProvisionerBootstrapV2 {
  const validated = validatedCompiledSnapshot(snapshot);
  const state = Object.freeze({ snapshot: validated });
  return new CompiledNodeToolchainProvisionerBootstrapV2(compiledHandleCapabilityV2, state);
}

function authenticCompiledState(
  handle: CompiledNodeToolchainProvisionerBootstrapV2,
): CompiledBootstrapStateV2 {
  if (
    typeof handle !== "object"
    || handle === null
    || isProxy(handle)
    || Object.getPrototypeOf(handle) !== CompiledNodeToolchainProvisionerBootstrapV2.prototype
    || disposedCompiledBootstrapHandlesV2.has(handle)
  ) {
    return fail("Compiled bootstrap operation requires one live authentic handle");
  }
  const state = compiledBootstrapStatesV2.get(handle);
  if (!state) return fail("Compiled bootstrap handle was not issued by the authority compiler");
  return state;
}

export function copyCompiledNodeToolchainProvisionerBootstrapV2(
  handle: CompiledNodeToolchainProvisionerBootstrapV2,
): CompiledNodeToolchainProvisionerBootstrapSnapshotV2 {
  const validated = validatedCompiledSnapshot(authenticCompiledState(handle).snapshot);
  try {
    return Object.freeze({
      manifest: deepFreezeJson(structuredClone(validated.manifest)),
      manifestBytes: Buffer.from(validated.manifestBytes),
      launcherBytes: Buffer.from(validated.launcherBytes),
      bundleBytes: Buffer.from(validated.bundleBytes),
      runtimeBytes: Buffer.from(validated.runtimeBytes),
    });
  } finally {
    zeroCompiledSnapshot(validated);
  }
}

export function inspectCompiledNodeToolchainProvisionerBootstrapManifestV2(
  handle: CompiledNodeToolchainProvisionerBootstrapV2,
): NodeToolchainProvisionerBootstrapManifestV2 {
  const state = authenticCompiledState(handle);
  const validated = validatedCompiledSnapshot(state.snapshot);
  try {
    return deepFreezeJson(structuredClone(validated.manifest));
  } finally {
    zeroCompiledSnapshot(validated);
  }
}

export function disposeCompiledNodeToolchainProvisionerBootstrapV2(
  handle: CompiledNodeToolchainProvisionerBootstrapV2,
): void {
  if (
    typeof handle !== "object"
    || handle === null
    || isProxy(handle)
    || Object.getPrototypeOf(handle) !== CompiledNodeToolchainProvisionerBootstrapV2.prototype
  ) {
    return fail("Compiled bootstrap disposal requires one authentic handle");
  }
  if (disposedCompiledBootstrapHandlesV2.has(handle)) return;
  const state = compiledBootstrapStatesV2.get(handle);
  if (!state) return fail("Compiled bootstrap disposal requires one authentic handle");
  zeroCompiledSnapshot(state.snapshot);
  compiledBootstrapStatesV2.delete(handle);
  disposedCompiledBootstrapHandlesV2.add(handle);
}

async function compileFromAuthenticatedAuthorities(
  bundleHandle: BuiltNodeToolchainProvisionerBundleV2,
  privateTreeHandle: MaterializedNodeToolchainPrivateTreeV2,
  scope: Readonly<{
    admissionScope: "production_root" | "test_fixture";
    rootLocator: string;
    expectedOwnerUid: number;
    expectedOwnerGid: number;
  }>,
): Promise<CompiledNodeToolchainProvisionerBootstrapV2> {
  let snapshot: ReturnType<typeof copyBuiltNodeToolchainProvisionerBundleV2> | undefined;
  let privateBundle: NodeToolchainPrivateTreeBundleV2 | undefined;
  let compiled: CompiledNodeToolchainProvisionerBootstrapSnapshotV2 | undefined;
  try {
    snapshot = copyBuiltNodeToolchainProvisionerBundleV2(bundleHandle);
    const privateTreeReceipt = inspectNodeToolchainPrivateTreeReceiptV2(privateTreeHandle);
    const expectedBundleScope = scope.admissionScope === "production_root"
      ? "production_release"
      : "test_fixture";
    const expectedTreeScope = scope.admissionScope === "production_root"
      ? "production_distribution"
      : "test_fixture";
    if (
      snapshot.receipt.admissionScope !== expectedBundleScope
      || privateTreeReceipt.admissionScope !== expectedTreeScope
      || snapshot.receipt.runtime.sourcePrivateTree.receiptHash
        !== privateTreeReceipt.receiptHash
    ) {
      return fail(
        "Authenticated bundle and private-tree handles do not belong to one bootstrap scope",
      );
    }
    privateBundle = await copyMaterializedNodeToolchainPrivateTreeBundleV2(privateTreeHandle);
    const runtime = privateBundle.entries.find((entry) => entry.locator === "bin/node");
    if (
      !runtime?.bytes
      || runtime.contentHash !== privateTreeReceipt.tree.node.contentHash
      || runtime.byteLength !== privateTreeReceipt.tree.node.byteLength
    ) {
      return fail("Authenticated private tree did not reproduce its exact bootstrap runtime");
    }
    compiled = compile(
      {
        codeSha: snapshot.receipt.release.codeSha,
        sourceTreeHash: snapshot.receipt.release.sourceTreeHash,
        packageVersion: snapshot.receipt.release.packageVersion,
        entrypointSourceBytes: snapshot.entrypointSourceBytes,
        packageJsonSourceBytes: snapshot.packageJsonSourceBytes,
        packageLockSourceBytes: snapshot.packageLockSourceBytes,
        bundleBytes: snapshot.bundleBytes,
        runtimeBytes: runtime.bytes,
        sourcePrivateTree: privateBundle.receipt,
      },
      scope,
      {
        kind: "authenticated_bundle",
        receipt: snapshot.receipt,
      },
    );
    return issueCompiledBootstrapAuthority(compiled);
  } catch (error) {
    if (error instanceof NodeToolchainProvisionerBootstrapAuthorityErrorV2) throw error;
    return fail("Authenticated bootstrap authorities could not be joined", error);
  } finally {
    zeroBundleSnapshot(snapshot);
    zeroPrivateTreeBundle(privateBundle);
    zeroCompiledSnapshot(compiled);
  }
}

export async function compileNodeToolchainProvisionerBootstrapV2(
  bundleHandle: BuiltNodeToolchainProvisionerBundleV2,
  privateTreeHandle: MaterializedNodeToolchainPrivateTreeV2,
): Promise<CompiledNodeToolchainProvisionerBootstrapV2> {
  return compileFromAuthenticatedAuthorities(bundleHandle, privateTreeHandle, {
    admissionScope: "production_root",
    rootLocator: NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROOT_V2,
    expectedOwnerUid: 0,
    expectedOwnerGid: 0,
  });
}

export async function compileNodeToolchainProvisionerBootstrapV2ForTestFromAuthority(
  bundleHandle: BuiltNodeToolchainProvisionerBundleV2,
  privateTreeHandle: MaterializedNodeToolchainPrivateTreeV2,
  testRoot: string,
): Promise<CompiledNodeToolchainProvisionerBootstrapV2> {
  if (typeof process.getuid !== "function" || typeof process.getgid !== "function") {
    return fail("Test bootstrap compilation requires POSIX owner identity");
  }
  return compileFromAuthenticatedAuthorities(bundleHandle, privateTreeHandle, {
    admissionScope: "test_fixture",
    rootLocator: testRoot,
    expectedOwnerUid: process.getuid(),
    expectedOwnerGid: process.getgid(),
  });
}
