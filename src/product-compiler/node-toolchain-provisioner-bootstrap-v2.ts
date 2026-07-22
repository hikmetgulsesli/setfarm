import { createHash } from "node:crypto";
import path from "node:path";
import { isProxy } from "node:util/types";

import { canonicalJsonBytes } from "./canonical-json.js";
import {
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_AUTHORITY_REF_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_BUNDLE_LOCATOR_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ENTRYPOINT_SOURCE_LOCATOR_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_FAILURE_V2_SCHEMA,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_LAUNCHER_LOCATOR_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MANIFEST_LOCATOR_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MANIFEST_V2_SCHEMA,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MAX_BUNDLE_BYTES_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MAX_LAUNCHER_BYTES_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MAX_MANIFEST_BYTES_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MAX_RUNTIME_BYTES_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_RUNTIME_LOCATOR_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_VERSION_V2,
  NodeToolchainProvisionerBootstrapFailureV2Schema,
  NodeToolchainProvisionerBootstrapManifestV2Schema,
  hashNodeToolchainProvisionerBootstrapBuildV2,
  hashNodeToolchainProvisionerBootstrapFailureV2,
  hashNodeToolchainProvisionerBootstrapManifestV2,
  type NodeToolchainProvisionerBootstrapBuildHashPayloadV2,
  type NodeToolchainProvisionerBootstrapFailureCodeV2,
  type NodeToolchainProvisionerBootstrapFailureHashPayloadV2,
  type NodeToolchainProvisionerBootstrapManifestHashPayloadV2,
  type NodeToolchainProvisionerBootstrapManifestV2,
} from "./schemas/node-toolchain-provisioner-bootstrap-v2.js";
import {
  NodeToolchainPrivateTreeReceiptV2Schema,
  type NodeToolchainPrivateTreeReceiptV2,
} from "./schemas/node-toolchain-private-tree-v2.js";

const ENTRYPOINT_SOURCE_MAX_BYTES_V2 = 1024 * 1024;
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
  packageLockSourceBytes: Uint8Array;
  bundleBytes: Uint8Array;
  runtimeBytes: Uint8Array;
  sourcePrivateTree: NodeToolchainPrivateTreeReceiptV2;
}>;

export type CompiledNodeToolchainProvisionerBootstrapV2 = Readonly<{
  manifest: NodeToolchainProvisionerBootstrapManifestV2;
  manifestBytes: Buffer;
  launcherBytes: Buffer;
  bundleBytes: Buffer;
  runtimeBytes: Buffer;
}>;

const BOOTSTRAP_INPUT_KEYS_V2 = Object.freeze([
  "bundleBytes",
  "codeSha",
  "entrypointSourceBytes",
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

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

function bootstrapFailure(code: NodeToolchainProvisionerBootstrapFailureCodeV2): string {
  const identity: NodeToolchainProvisionerBootstrapFailureHashPayloadV2 = {
    schema: NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_FAILURE_V2_SCHEMA,
    failureVersion: NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_VERSION_V2,
    authorityRef: NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_AUTHORITY_REF_V2,
    failureCode: code,
    exitCode: 70,
  };
  return canonicalJsonBytes(NodeToolchainProvisionerBootstrapFailureV2Schema.parse({
    ...identity,
    failureHash: hashNodeToolchainProvisionerBootstrapFailureV2(identity),
  })).toString("utf8");
}

type LauncherInputV2 = Readonly<{
  rootLocator: string;
  expectedOwnerUid: number;
  expectedOwnerGid: number;
  bundleSha256: string;
  bundleByteLength: number;
  runtimeSha256: string;
  runtimeByteLength: number;
}>;

export function renderNodeToolchainProvisionerBootstrapLauncherV2(
  input: LauncherInputV2,
): Buffer {
  const root = path.normalize(input.rootLocator);
  if (
    !path.isAbsolute(root)
    || root !== input.rootLocator
    || root.includes("\0")
    || root.includes("\n")
    || root.includes("\r")
    || root.includes("'")
    || !Number.isSafeInteger(input.expectedOwnerUid)
    || input.expectedOwnerUid < 0
    || !Number.isSafeInteger(input.expectedOwnerGid)
    || input.expectedOwnerGid < 0
    || !/^[a-f0-9]{64}$/.test(input.bundleSha256)
    || input.bundleByteLength < 1
    || input.bundleByteLength > NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MAX_BUNDLE_BYTES_V2
    || !/^[a-f0-9]{64}$/.test(input.runtimeSha256)
    || input.runtimeByteLength < 1
    || input.runtimeByteLength > NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MAX_RUNTIME_BYTES_V2
  ) {
    return fail("Bootstrap launcher input is outside its exact bounded contract");
  }
  const rootRequired = shellQuote(bootstrapFailure(
    "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_V2_ROOT_REQUIRED",
  ));
  const fileInvalid = shellQuote(bootstrapFailure(
    "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_V2_PACKAGE_FILE_INVALID",
  ));
  const fileMismatch = shellQuote(bootstrapFailure(
    "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_V2_PACKAGE_FILE_MISMATCH",
  ));
  const manifest = path.join(root, NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MANIFEST_LOCATOR_V2);
  const bundle = path.join(root, NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_BUNDLE_LOCATOR_V2);
  const runtime = path.join(root, NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_RUNTIME_LOCATOR_V2);
  const lines = [
    "#!/bin/sh",
    "set -fu",
    "umask 077",
    `ROOT=${shellQuote(root)}`,
    `MANIFEST=${shellQuote(manifest)}`,
    `BUNDLE=${shellQuote(bundle)}`,
    `RUNTIME=${shellQuote(runtime)}`,
    `FAIL_ROOT=${rootRequired}`,
    `FAIL_FILE=${fileInvalid}`,
    `FAIL_MISMATCH=${fileMismatch}`,
    "fail() {",
    "  /usr/bin/printf '%s' \"$1\"",
    "  exit 70",
    "}",
    "verify_file() {",
    "  file=$1",
    "  mode=$2",
    "  length=$3",
    "  digest=$4",
    "  metadata=$(/usr/bin/stat -f '%HT|%u|%g|%Lp|%l|%z' \"$file\" 2>/dev/null) || fail \"$FAIL_FILE\"",
    `  expected="Regular File|${input.expectedOwnerUid}|${input.expectedOwnerGid}|$mode|1|$length"`,
    "  [ \"$metadata\" = \"$expected\" ] || fail \"$FAIL_FILE\"",
    "  observed=$(/usr/bin/shasum -a 256 \"$file\" 2>/dev/null) || fail \"$FAIL_FILE\"",
    "  observed=${observed%% *}",
    "  [ \"$observed\" = \"$digest\" ] || fail \"$FAIL_MISMATCH\"",
    "}",
    "verify_manifest() {",
    "  metadata=$(/usr/bin/stat -f '%HT|%u|%g|%Lp|%l|%z' \"$MANIFEST\" 2>/dev/null) || fail \"$FAIL_FILE\"",
    "  old_ifs=$IFS",
    "  IFS='|'",
    "  set -- $metadata",
    "  IFS=$old_ifs",
    "  [ \"$#\" -eq 6 ] || fail \"$FAIL_FILE\"",
    `  [ \"$1\" = 'Regular File' ] && [ \"$2\" = '${input.expectedOwnerUid}' ] && [ \"$3\" = '${input.expectedOwnerGid}' ] || fail \"$FAIL_FILE\"`,
    "  [ \"$4\" = '444' ] && [ \"$5\" = '1' ] || fail \"$FAIL_FILE\"",
    `  [ \"$6\" -ge 1 ] 2>/dev/null && [ \"$6\" -le ${NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MAX_MANIFEST_BYTES_V2} ] 2>/dev/null || fail \"$FAIL_FILE\"`,
    "}",
    `[ \"$(/usr/bin/id -u 2>/dev/null)\" = '${input.expectedOwnerUid}' ] || fail \"$FAIL_ROOT\"`,
    "verify_manifest",
    `verify_file \"$BUNDLE\" 444 ${input.bundleByteLength} ${input.bundleSha256}`,
    `verify_file \"$RUNTIME\" 555 ${input.runtimeByteLength} ${input.runtimeSha256}`,
    "cd \"$ROOT\" || fail \"$FAIL_FILE\"",
    "exec /usr/bin/env -i \\",
    "  HOME=/var/empty \\",
    "  LANG=C \\",
    "  LC_ALL=C \\",
    "  NO_COLOR=1 \\",
    "  TMPDIR=/private/var/tmp \\",
    "  TZ=UTC \\",
    "  SETFARM_NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_V2=1 \\",
    "  SETFARM_NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MANIFEST_V2=\"$MANIFEST\" \\",
    "  \"$RUNTIME\" \"$BUNDLE\" \"$@\"",
    "",
  ];
  const bytes = Buffer.from(lines.join("\n"), "utf8");
  if (bytes.byteLength > NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MAX_LAUNCHER_BYTES_V2) {
    return fail("Rendered bootstrap launcher exceeds its byte bound");
  }
  return bytes;
}

function compile(
  untrustedInput: unknown,
  scope: Readonly<{
    admissionScope: "production_root" | "test_fixture";
    rootLocator: string;
    expectedOwnerUid: number;
    expectedOwnerGid: number;
  }>,
): CompiledNodeToolchainProvisionerBootstrapV2 {
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
    packageLockSource: {
      schema: "setfarm.source-artifact-ref.v1",
      locator: "package-lock.json",
      mediaType: "application/json",
      byteLength: packageLockSourceBytes.byteLength,
      hash: sha256(packageLockSourceBytes),
    },
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
      branch: "main",
      dirty: false,
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
): CompiledNodeToolchainProvisionerBootstrapV2 {
  if (typeof process.getuid !== "function" || typeof process.getgid !== "function") {
    return fail("Test bootstrap compilation requires POSIX owner identity");
  }
  return compile(input, {
    admissionScope: "test_fixture",
    rootLocator: testRoot,
    expectedOwnerUid: process.getuid(),
    expectedOwnerGid: process.getgid(),
  });
}
