import assert from "node:assert/strict";
import {
  spawn,
  spawnSync,
  type ChildProcess,
  type ChildProcessWithoutNullStreams,
} from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  closeSync,
  copyFileSync,
  constants,
  existsSync,
  lstatSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
  type BigIntStats,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Duplex } from "node:stream";
import { after, before, describe, it } from "node:test";

import {
  PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2,
} from
  "../../src/execution/schemas/platform-release-bootstrap-contract-v2.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2,
} from
  "../../src/execution/schemas/platform-release-bootstrap-operation-abis-v2.js";
import {
  canonicalJsonStringify,
  hashCanonicalJson,
} from "../../src/product-compiler/canonical-json.js";
import {
  buildPlatformReleaseBootstrapNodeNativeExactReleaseProbeFixtureV2,
  hashPlatformReleaseBootstrapNodeNativeExactReleaseProbeReceiptV2,
  type PlatformReleaseBootstrapNodeNativeExactReleaseProbeFixtureInputV2,
} from
  "../../src/product-compiler/platform-release-bootstrap-node-native-exact-release-probe-fixture-v2.js";
import {
  hashPlatformReleaseBootstrapNodeNativePinnedBinaryContentEvidenceV2,
  hashPlatformReleaseBootstrapNodeNativePinnedBinaryDescriptorBindingV2,
  hashPlatformReleaseBootstrapNodeNativeRecursiveSemanticLiveAdapterReceiptV2,
  runPlatformReleaseBootstrapNodeNativeRecursiveSemanticLiveAdapterTestSupportV2,
  runPlatformReleaseBootstrapNodeNativeLiveAdapterTestSupportV2,
  runPlatformReleaseBootstrapNodeNativeSlotLedgerLiveAdapterTestSupportV2,
} from
  "../../src/product-compiler/platform-release-bootstrap-node-native-live-adapter-test-support-v2.js";
import {
  buildBootstrapFilesystemScopeIdentityV2,
  buildFsObservationFingerprintV2,
  buildStableFsObjectIdentityV2,
  type BootstrapFilesystemScopeIdentityV2,
} from
  "../../src/product-compiler/platform-release-bootstrap-physical-census-v2.js";
import {
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_RECEIPT_V2_SCHEMA,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_VERSION_V2,
  NodeToolchainProvisionerBootstrapInstallationReceiptV2Schema,
  buildNodeToolchainProvisionerBootstrapInstallationClaimV2,
  buildNodeToolchainProvisionerBootstrapInstallationIntentV2,
  buildNodeToolchainProvisionerBootstrapRollbackHistoryV2,
  hashNodeToolchainProvisionerBootstrapInstallationReceiptV2,
  hashNodeToolchainProvisionerBootstrapInstalledTreeV2,
  type NodeToolchainProvisionerBootstrapInstallationClaimV2,
  type NodeToolchainProvisionerBootstrapInstallationReceiptV2,
} from
  "../../src/product-compiler/schemas/node-toolchain-provisioner-bootstrap-installation-state-v2.js";
import {
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_PREPARED_PACKAGE_AUTHORITY_REF_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_PREPARED_PACKAGE_RECEIPT_V2_SCHEMA,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_PREPARED_PACKAGE_VERSION_V2,
  NodeToolchainProvisionerBootstrapPreparedPackageReceiptV2Schema,
  hashNodeToolchainProvisionerBootstrapPreparedPackageReceiptV2,
  hashNodeToolchainProvisionerBootstrapPreparedTreeV2,
} from
  "../../src/product-compiler/schemas/node-toolchain-provisioner-bootstrap-prepared-package-v2.js";

const darwinArm64 =
  process.platform === "darwin" && process.arch === "arm64";
const repositoryRoot = realpathSync(path.resolve(import.meta.dirname, "../.."));
const nativeRoot = path.join(repositoryRoot, "native/darwin");
const kernelSource = path.join(
  nativeRoot,
  "platform-release-bootstrap-aggregate-census-kernel-v2.c",
);
const fixtureSource = path.join(
  nativeRoot,
  "platform-release-bootstrap-aggregate-census-fixture-v2.c",
);
const nodePackage = PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.packages.find(
  (entry) => entry.packageRef
    === PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.nodeToolchainProvisioner,
);
if (!nodePackage) throw new Error("Node package contract is absent");
const sharedLockBasename =
  PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.registry.sharedLockBasename;
const nodeLockBasename = nodePackage.lifecycle.packageLockBasename;
const filesystemScopeBasename =
  PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.registry.filesystemScopeBasename;
const nodeRootBasename = nodePackage.rootBasename;
const lifecyclePayloadBasename = nodePackage.lifecycle.activeClaimBasename;
const sharedLockBytes = Buffer.from(
  "setfarm.bootstrap-package-registry-parent-lock.v2\n",
  "utf8",
);
const nodeLockBytes = Buffer.from(
  "setfarm.node-toolchain-provisioner-bootstrap-installation-lock.v2\n",
  "utf8",
);
const maxCapturedOutputBytes = 64 * 1024 * 1024;
const nativeWaitTimeoutMs = 10_000;
const stoppedStateTimeoutMs = 2_000;
const stoppedStatePollIntervalMs = 20;
const protocolReadTimeoutMs = 10_000;
const protocolMaxBodyBytes = 1 + maxCapturedOutputBytes;
const protocolMaxBufferedBytes = protocolMaxBodyBytes + 4_096;
const protocolOpenType = 1;
const protocolObservationType = 2;
const protocolSlotCatalogType = 3;
const protocolSlotCaptureRequestType = 4;
const protocolSlotContentObservationType = 5;
const protocolAckAcceptType = 16;
const protocolAckAbortType = 17;
const protocolTerminalAcceptType = 32;
const protocolTerminalAbortType = 33;
const protocolSelfAssertedTestFixtureAuthorityType = 1;

type NativeExitV2 = Readonly<{
  code: number | null;
  signal: NodeJS.Signals | null;
}>;

type RunningNativeV2 = Readonly<{
  child: ChildProcessWithoutNullStreams;
  protocol: Duplex;
  protocolReader: ProtocolFrameReaderV2;
  waitForExit: () => Promise<NativeExitV2>;
  stdout: () => Buffer;
  stderr: () => string;
  rawProtocol: () => Buffer;
  waitForFirstPass: () => Promise<void>;
  waitForBaseline: () => Promise<void>;
  waitForRecursiveBaseline: () => Promise<void>;
  waitForRecapture: () => Promise<void>;
  waitForSecondOpen: () => Promise<void>;
  waitForLiveRelease: () => Promise<void>;
  waitForSlotLedgerFirstEntry: () => Promise<void>;
}>;

type NativeControlV2 =
  | "none\n"
  | "after_first_pass\n"
  | "session_none\n"
  | "session_after_baseline\n"
  | "session_after_recapture\n"
  | "session_second_open\n"
  | "session_live\n"
  | "session_live_recursive\n"
  | "recursive_semantic_live\n"
  | "semantic_pinned_live\n"
  | "exact_release_probe_v2\n"
  | "probe_shared_held\n"
  | "probe_both_held\n"
  | "probe_node_released\n"
  | "probe_all_released\n"
  | "recursive_revalidate\n"
  | "live_release_stop\n"
  | "slot_ledger_live\n"
  | "slot_ledger_drift\n";

type ProtocolFrameV2 = Readonly<{
  type: number;
  payload: Buffer;
}>;

type NativeStartOptionsV2 = Readonly<{
  inheritedBinaryPath?: string;
  spawnBinaryPath?: string;
  captureRawProtocol?: boolean;
}>;

type FixtureNamespaceV2 = Readonly<{
  alias: string;
  parent: string;
  sharedLock: string;
  nodeLock: string;
  payload: string;
}>;

type RecursiveFixtureNamespaceV2 = FixtureNamespaceV2 & Readonly<{
  packageRoot: string;
  binDirectory: string;
  launcher: string;
  libDirectory: string;
  bundle: string;
  manifest: string;
  runtimeDirectory: string;
  runtime: string;
  fileBytes: Readonly<Record<
    "launcher_file" | "bundle_file" | "manifest_file" |
      "bootstrap_runtime_file",
    Buffer
  >>;
}>;

let buildAlias = "";
let buildRoot = "";
let nativeBinary = "";
let stderrOverflowBinary = "";
let semanticTrailingProtocolBinary = "";
let semanticNoisyNonzeroBinary = "";
let semanticDelayedExitBinary = "";
let exactTrailingProtocolBinary = "";
let exactNoisyNonzeroBinary = "";
let exactStoppedHangBinary = "";
const semanticDelayedReadyMarker =
  ".setfarm-semantic-delayed-ready-v2";
const semanticDelayedReleaseMarker =
  ".setfarm-semantic-delayed-release-v2";
let semanticLockObserverBinary = "";
let exactLockHolderBinary = "";
let exactLockContenderBinary = "";

function makeFixtureNamespaceV2(): FixtureNamespaceV2 {
  const alias = mkdtempSync(
    path.join(os.tmpdir(), "setfarm-darwin-aggregate-census-v2-"),
  );
  const parent = realpathSync(alias);
  chmodSync(parent, 0o700);
  const sharedLock = path.join(parent, sharedLockBasename);
  const nodeLock = path.join(parent, nodeLockBasename);
  const payload = path.join(parent, lifecyclePayloadBasename);
  writeFileSync(sharedLock, sharedLockBytes, { mode: 0o600, flag: "wx" });
  writeFileSync(nodeLock, nodeLockBytes, { mode: 0o600, flag: "wx" });
  const filesystemScope = buildBootstrapFilesystemScopeIdentityV2({
    scopeNonce: sha256V2(parent).toString("hex"),
  });
  writeFileSync(
    path.join(parent, filesystemScopeBasename),
    canonicalJsonStringify(filesystemScope),
    { mode: 0o444, flag: "wx" },
  );
  writeFileSync(payload, "{\"payload\":\"same-byte-replacement\"}\n", {
    mode: 0o444,
    flag: "wx",
  });
  const packageRoot = path.join(parent, nodeRootBasename);
  mkdirSync(packageRoot, { mode: 0o700 });
  writeFileSync(path.join(packageRoot, "member"), "member\n", {
    mode: 0o444,
    flag: "wx",
  });
  return Object.freeze({
    alias,
    parent,
    sharedLock,
    nodeLock,
    payload,
  });
}

function makeRecursiveFixtureNamespaceV2(): RecursiveFixtureNamespaceV2 {
  const fixture = makeFixtureNamespaceV2();
  const packageRoot = path.join(fixture.parent, nodeRootBasename);
  rmSync(packageRoot, { recursive: true, force: true });
  const binDirectory = path.join(packageRoot, "bin");
  const libDirectory = path.join(packageRoot, "lib");
  const runtimeDirectory = path.join(packageRoot, "runtime");
  mkdirSync(packageRoot, { mode: 0o700 });
  mkdirSync(binDirectory, { mode: 0o700 });
  mkdirSync(libDirectory, { mode: 0o700 });
  mkdirSync(runtimeDirectory, { mode: 0o700 });
  const launcher = path.join(
    binDirectory,
    "setfarm-node-toolchain-provisioner-v2",
  );
  const bundle = path.join(libDirectory, "node-toolchain-provisioner-v2.cjs");
  const manifest = path.join(
    packageRoot,
    "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MANIFEST.v2.json",
  );
  const runtime = path.join(runtimeDirectory, "node");
  const fileBytes = Object.freeze({
    launcher_file: Buffer.from("#!/bin/sh\nexit 0\n", "utf8"),
    bundle_file: Buffer.from("\"use strict\";\n", "utf8"),
    manifest_file: Buffer.from("{\"manifest\":\"fixture\"}", "utf8"),
    bootstrap_runtime_file: Buffer.from("fixture-runtime\n", "utf8"),
  });
  writeFileSync(launcher, fileBytes.launcher_file, { mode: 0o555, flag: "wx" });
  writeFileSync(bundle, fileBytes.bundle_file, { mode: 0o444, flag: "wx" });
  writeFileSync(manifest, fileBytes.manifest_file, { mode: 0o444, flag: "wx" });
  writeFileSync(runtime, fileBytes.bootstrap_runtime_file, { mode: 0o555, flag: "wx" });
  chmodSync(binDirectory, 0o555);
  chmodSync(libDirectory, 0o555);
  chmodSync(runtimeDirectory, 0o555);
  chmodSync(packageRoot, 0o555);
  return Object.freeze({
    ...fixture,
    packageRoot,
    binDirectory,
    launcher,
    libDirectory,
    bundle,
    manifest,
    runtimeDirectory,
    runtime,
    fileBytes,
  });
}

type SemanticReadyRecursiveFixtureNamespaceV2 =
  RecursiveFixtureNamespaceV2 & Readonly<{
    activeReceipt: string;
    claimValue: NodeToolchainProvisionerBootstrapInstallationClaimV2;
    receiptValue: NodeToolchainProvisionerBootstrapInstallationReceiptV2;
  }>;

const exactSemanticToolV2 = (
  toolRef: "MACOS_LOCKF_V2" | "MACOS_CAT_LOCK_HELPER_V2",
) => ({
  toolRef,
  contentHash: (toolRef === "MACOS_LOCKF_V2" ? "e" : "f").repeat(64),
  byteLength: 64,
  mode: "0755" as const,
  ownerUid: 0 as const,
  ownerGid: 0,
  linkCount: 1 as const,
});

function makeSemanticReadyRecursiveFixtureNamespaceV2():
  SemanticReadyRecursiveFixtureNamespaceV2 {
  const fixture = makeRecursiveFixtureNamespaceV2();
  chmodSync(fixture.parent, 0o755);
  unlinkSync(fixture.payload);
  const parentStat = lstatSync(fixture.parent, { bigint: true });
  const rootStat = lstatSync(fixture.packageRoot, { bigint: true });
  const ownerUid = Number(parentStat.uid);
  const ownerGid = Number(parentStat.gid);
  const memberHashes = {
    manifest: sha256V2(fixture.fileBytes.manifest_file).toString("hex"),
    launcher: sha256V2(fixture.fileBytes.launcher_file).toString("hex"),
    bundle: sha256V2(fixture.fileBytes.bundle_file).toString("hex"),
    bootstrapRuntime:
      sha256V2(fixture.fileBytes.bootstrap_runtime_file).toString("hex"),
  };
  const members = {
    manifest: {
      artifactRef: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MANIFEST_V2" as const,
      locator: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MANIFEST.v2.json" as const,
      mediaType: "application/json" as const,
      storageMode: "0400" as const,
      targetMode: "0444" as const,
      sha256: memberHashes.manifest,
      byteLength: fixture.fileBytes.manifest_file.byteLength,
      linkCount: 1 as const,
    },
    launcher: {
      artifactRef: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_LAUNCHER_V2" as const,
      locator: "bin/setfarm-node-toolchain-provisioner-v2" as const,
      mediaType: "text/x-shellscript" as const,
      storageMode: "0500" as const,
      targetMode: "0555" as const,
      sha256: memberHashes.launcher,
      byteLength: fixture.fileBytes.launcher_file.byteLength,
      linkCount: 1 as const,
    },
    bundle: {
      artifactRef: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_BUNDLE_V2" as const,
      locator: "lib/node-toolchain-provisioner-v2.cjs" as const,
      mediaType: "application/javascript" as const,
      storageMode: "0400" as const,
      targetMode: "0444" as const,
      sha256: memberHashes.bundle,
      byteLength: fixture.fileBytes.bundle_file.byteLength,
      linkCount: 1 as const,
    },
    bootstrapRuntime: {
      artifactRef: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_RUNTIME_V2" as const,
      locator: "runtime/node" as const,
      mediaType: "application/x-mach-binary" as const,
      storageMode: "0500" as const,
      targetMode: "0555" as const,
      sha256: memberHashes.bootstrapRuntime,
      byteLength: fixture.fileBytes.bootstrap_runtime_file.byteLength,
      linkCount: 1 as const,
    },
  };
  const totalBytes = Object.values(fixture.fileBytes)
    .reduce((sum, bytes) => sum + bytes.byteLength, 0);
  const storageWithoutHash = {
    ownerUid,
    ownerGid,
    rootMode: "0700" as const,
    directoryMode: "0700" as const,
    immutableFileMode: "0400" as const,
    executableFileMode: "0500" as const,
    linkPolicy: "regular_files_only_no_links_v2" as const,
    allowedDirectories: [".", "bin", "lib", "runtime"] as const,
    allowedRootEntries: [
      "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MANIFEST.v2.json",
      "bin",
      "lib",
      "runtime",
    ] as const,
    fileCount: 4 as const,
    directoryCount: 4 as const,
    totalBytes,
  };
  const storage = {
    ...storageWithoutHash,
    treeHash: hashNodeToolchainProvisionerBootstrapPreparedTreeV2({
      storage: {
        ...storageWithoutHash,
        treeHash: "0".repeat(64),
      },
      members,
    }),
  };
  const preparedIdentity = {
    schema:
      NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_PREPARED_PACKAGE_RECEIPT_V2_SCHEMA,
    receiptVersion:
      NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_PREPARED_PACKAGE_VERSION_V2,
    authorityRef:
      NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_PREPARED_PACKAGE_AUTHORITY_REF_V2,
    admissionScope: "test_fixture" as const,
    status: "prepared_payload_verified" as const,
    installationStatus: "not_installed_unprivileged_payload" as const,
    source: {
      codeSha: "a".repeat(40),
      sourceTreeHash: "b".repeat(40),
      packageVersion: "2.0.0",
      architecture: "arm64" as const,
      manifestHash: "9".repeat(64),
      manifestSha256: members.manifest.sha256,
      manifestByteLength: members.manifest.byteLength,
      buildContractHash: "b".repeat(64),
      bundleAuthorityReceiptHash: "c".repeat(64),
      launcherHash: members.launcher.sha256,
      launcherByteLength: members.launcher.byteLength,
      bundleOutputHash: members.bundle.sha256,
      bundleOutputByteLength: members.bundle.byteLength,
      privateTreeReceiptHash: "d".repeat(64),
      privateTreeNodeHash: members.bootstrapRuntime.sha256,
      privateTreeNodeByteLength: members.bootstrapRuntime.byteLength,
    },
    target: {
      rootLocator: fixture.packageRoot,
      expectedOwnerUid: ownerUid,
      expectedOwnerGid: ownerGid,
      directoryMode: "0555" as const,
      manifestMode: "0444" as const,
      publicationPolicy:
        "root_owned_every_only_no_replace_fsync_manifest_last_v2" as const,
    },
    storage,
    members,
    publication: {
      policy:
        "exclusive_create_fsync_files_directories_manifest_last_v2" as const,
      manifestPublishedLast: true as const,
      reopenedAfterPublication: true as const,
      targetRootAccess: "none" as const,
    },
  };
  const prepared =
    NodeToolchainProvisionerBootstrapPreparedPackageReceiptV2Schema.parse({
      ...preparedIdentity,
      receiptHash:
        hashNodeToolchainProvisionerBootstrapPreparedPackageReceiptV2(
          preparedIdentity,
        ),
    });
  const claimValue = buildNodeToolchainProvisionerBootstrapInstallationClaimV2(
    buildNodeToolchainProvisionerBootstrapInstallationIntentV2(prepared),
  );
  const emptyHistory = buildNodeToolchainProvisionerBootstrapRollbackHistoryV2([]);
  const receiptIdentity = {
    schema: NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_RECEIPT_V2_SCHEMA,
    receiptVersion: NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_VERSION_V2,
    authorityRef: claimValue.intent.authorityRef,
    status: "installed_verified" as const,
    admissionScope: "test_fixture" as const,
    claim: claimValue,
    predecessorRollbackHistory: emptyHistory,
    publisher: {
      contractRef: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLER_V2" as const,
      lockExecutionPolicy: "exact_lockf_fd_then_exact_cat_pipe_v2" as const,
      lockf: exactSemanticToolV2("MACOS_LOCKF_V2"),
      lockHelper: exactSemanticToolV2("MACOS_CAT_LOCK_HELPER_V2"),
    },
    finalRoot: {
      rootLocatorHash: claimValue.intent.target.rootLocatorHash,
      manifestHash: claimValue.intent.source.source.manifestHash,
      architecture: claimValue.intent.architecture,
      device: Number(rootStat.dev),
      inode: Number(rootStat.ino),
      ownerUid,
      ownerGid,
      mode: "0555" as const,
      fileCount: 4 as const,
      directoryCount: 4 as const,
      totalBytes,
      treeHash: hashNodeToolchainProvisionerBootstrapInstalledTreeV2(
        claimValue.intent.source,
      ),
    },
    claimFile: {
      locatorHash: claimValue.intent.target.claimLocatorHash,
      mode: "0444" as const,
      ownerUid,
      ownerGid,
      linkCount: 1 as const,
    },
    receiptFile: {
      locatorHash: claimValue.intent.target.receiptLocatorHash,
      mode: "0444" as const,
      ownerUid,
      ownerGid,
      linkCount: 1 as const,
      publicationPolicy:
        "canonical_stage_hard_link_no_replace_fsync_v2" as const,
    },
  };
  const receiptValue =
    NodeToolchainProvisionerBootstrapInstallationReceiptV2Schema.parse({
      ...receiptIdentity,
      receiptHash:
        hashNodeToolchainProvisionerBootstrapInstallationReceiptV2(
          receiptIdentity,
        ),
    });
  const activeReceipt = path.join(
    fixture.parent,
    nodePackage.lifecycle.activeReceiptBasename,
  );
  writeFileSync(fixture.payload, canonicalJsonStringify(claimValue), {
    mode: 0o444,
    flag: "wx",
  });
  writeFileSync(activeReceipt, canonicalJsonStringify(receiptValue), {
    mode: 0o444,
    flag: "wx",
  });
  return Object.freeze({
    ...fixture,
    activeReceipt,
    claimValue,
    receiptValue,
  });
}

function removeRecursiveFixtureNamespaceV2(
  fixture: RecursiveFixtureNamespaceV2,
): void {
  for (const directory of [
    fixture.binDirectory,
    fixture.libDirectory,
    fixture.runtimeDirectory,
    fixture.packageRoot,
  ]) {
    try {
      chmodSync(directory, 0o700);
    } catch {
      // Best-effort permission restoration for deterministic temp cleanup.
    }
  }
  rmSync(fixture.alias, { recursive: true, force: true });
}

function darwinProcessStateV2(
  pid: number,
  timeoutMs: number,
): string | null {
  const observed = spawnSync(
    "/bin/ps",
    ["-o", "state=", "-p", String(pid)],
    {
      cwd: "/",
      encoding: "utf8",
      env: { LANG: "C", LC_ALL: "C", PATH: "/usr/bin:/bin", TZ: "UTC" },
      maxBuffer: 64 * 1024,
      shell: false,
      timeout: timeoutMs,
    },
  );
  if (observed.error !== undefined) throw observed.error;
  if (observed.signal !== null) {
    throw new Error(
      `Darwin process-state probe terminated by ${observed.signal}: ${observed.stderr}`,
    );
  }
  return observed.status === 0 ? observed.stdout.trim() : null;
}

async function waitForStoppedStateV2(
  child: ChildProcessWithoutNullStreams,
  checkpointName: string,
): Promise<void> {
  const pid = child.pid;
  assert.equal(Number.isSafeInteger(pid) && (pid ?? 0) > 0, true);
  const deadline = Date.now() + stoppedStateTimeoutMs;
  let lastState: string | null = null;
  for (;;) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    lastState = darwinProcessStateV2(pid!, Math.min(250, remaining));
    if (lastState?.startsWith("T") === true) return;
    const waitMs = Math.min(
      stoppedStatePollIntervalMs,
      deadline - Date.now(),
    );
    if (waitMs <= 0) break;
    await new Promise<void>((resolve) => {
      setTimeout(resolve, waitMs);
    });
  }
  throw new Error(
    `Native ${checkpointName} marker arrived without stopped/T process state within ${stoppedStateTimeoutMs}ms; lastState=${JSON.stringify(lastState)}`,
  );
}

class ProtocolFrameReaderV2 {
  #buffer = Buffer.alloc(0);
  #ended = false;
  #failure: Error | null = null;
  readonly #waiters = new Set<() => void>();

  constructor(stream: Duplex) {
    stream.on("data", (chunk: Buffer) => {
      if (this.#failure !== null) return;
      if (chunk.byteLength > protocolMaxBufferedBytes - this.#buffer.byteLength) {
        this.#failure = new Error("Native protocol exceeded bounded buffer");
        this.#signal();
        return;
      }
      this.#buffer = Buffer.concat([this.#buffer, chunk]);
      this.#signal();
    });
    stream.once("end", () => {
      this.#ended = true;
      this.#signal();
    });
    stream.once("error", (error: Error) => {
      this.#failure = error;
      this.#signal();
    });
  }

  #signal(): void {
    const waiters = [...this.#waiters];
    this.#waiters.clear();
    for (const waiter of waiters) waiter();
  }

  async #waitForChange(deadline: number, label: string): Promise<void> {
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      throw new Error(`Native protocol ${label} timed out`);
    }
    await new Promise<void>((resolve, reject) => {
      const wake = (): void => {
        clearTimeout(timeout);
        this.#waiters.delete(wake);
        resolve();
      };
      const timeout = setTimeout(() => {
        this.#waiters.delete(wake);
        reject(new Error(`Native protocol ${label} timed out`));
      }, remaining);
      this.#waiters.add(wake);
    });
  }

  async #readExact(
    length: number,
    deadline: number,
    label: string,
  ): Promise<Buffer> {
    while (this.#buffer.byteLength < length) {
      if (this.#failure !== null) throw this.#failure;
      if (this.#ended) {
        throw new Error(
          `Native protocol ended during ${label} with ${this.#buffer.byteLength}/${length} bytes`,
        );
      }
      await this.#waitForChange(deadline, label);
    }
    const result = Buffer.from(this.#buffer.subarray(0, length));
    this.#buffer = this.#buffer.subarray(length);
    return result;
  }

  async readFrame(): Promise<ProtocolFrameV2> {
    const deadline = Date.now() + protocolReadTimeoutMs;
    const header = await this.#readExact(4, deadline, "frame header");
    const bodyLength = header.readUInt32BE(0);
    if (bodyLength < 1 || bodyLength > protocolMaxBodyBytes) {
      throw new Error(`Native protocol frame body bound invalid: ${bodyLength}`);
    }
    const body = await this.#readExact(bodyLength, deadline, "frame body");
    return Object.freeze({
      type: body[0]!,
      payload: Buffer.from(body.subarray(1)),
    });
  }

  async expectEnd(): Promise<void> {
    const deadline = Date.now() + protocolReadTimeoutMs;
    for (;;) {
      if (this.#failure !== null) throw this.#failure;
      if (this.#buffer.byteLength !== 0) {
        throw new Error(
          `Native protocol left ${this.#buffer.byteLength} trailing bytes`,
        );
      }
      if (this.#ended) return;
      await this.#waitForChange(deadline, "stream EOF");
    }
  }
}

function encodeProtocolFrameV2(type: number, payload: Buffer): Buffer {
  assert.equal(Number.isInteger(type) && type >= 0 && type <= 0xff, true);
  assert.equal(payload.byteLength <= protocolMaxBodyBytes - 1, true);
  const frame = Buffer.allocUnsafe(5 + payload.byteLength);
  frame.writeUInt32BE(payload.byteLength + 1, 0);
  frame[4] = type;
  payload.copy(frame, 5);
  return frame;
}

function sha256V2(bytes: Buffer | string): Buffer {
  return createHash("sha256").update(bytes).digest();
}

function filesystemScopeForFixtureV2(
  fixture: FixtureNamespaceV2,
): BootstrapFilesystemScopeIdentityV2 {
  return buildBootstrapFilesystemScopeIdentityV2({
    scopeNonce: sha256V2(fixture.parent).toString("hex"),
  });
}

function physicalObservationFromStatV2(
  filesystemScope: BootstrapFilesystemScopeIdentityV2,
  objectKind: "ordinary_file" | "directory",
  stat: BigIntStats,
) {
  const objectIdentity = buildStableFsObjectIdentityV2({
    filesystemScope,
    objectKind,
    device: stat.dev.toString(10),
    inode: stat.ino.toString(10),
  });
  return Object.freeze({
    objectIdentity,
    fingerprint: buildFsObservationFingerprintV2({
      objectIdentity,
      ownerUid: Number(stat.uid),
      ownerGid: Number(stat.gid),
      mode: (Number(stat.mode) & 0o7777).toString(8).padStart(4, "0"),
      linkCount: Number(stat.nlink),
      byteLength: Number(stat.size),
      modifiedTimeNanoseconds: stat.mtimeNs.toString(10),
      changedTimeNanoseconds: stat.ctimeNs.toString(10),
    }),
  });
}

function encodeAckV2(
  type: typeof protocolAckAcceptType | typeof protocolAckAbortType,
  challenge: Buffer,
  aggregateSha256: Buffer,
  semanticAckSha256: Buffer,
): Buffer {
  assert.equal(challenge.byteLength, 32);
  assert.equal(aggregateSha256.byteLength, 32);
  assert.equal(semanticAckSha256.byteLength, 32);
  return encodeProtocolFrameV2(
    type,
    Buffer.concat([challenge, aggregateSha256, semanticAckSha256]),
  );
}

function startNativeV2(
  parent: string,
  control: NativeControlV2,
  options: NativeStartOptionsV2 = {},
): RunningNativeV2 {
  const parentDescriptor = openSync(
    parent,
    constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
  );
  const pinnedBinaryDescriptor = options.inheritedBinaryPath === undefined
    ? undefined
    : openSync(
      options.inheritedBinaryPath,
      constants.O_RDONLY | constants.O_NOFOLLOW,
    );
  let child: ChildProcessWithoutNullStreams;
  try {
    child = spawn(options.spawnBinaryPath ?? nativeBinary, [], {
      cwd: buildRoot,
      env: { LANG: "C", LC_ALL: "C", TZ: "UTC" },
      shell: false,
      stdio: pinnedBinaryDescriptor === undefined
        ? ["pipe", "pipe", "pipe", parentDescriptor, "pipe"]
        : [
          "pipe",
          "pipe",
          "pipe",
          parentDescriptor,
          "pipe",
          pinnedBinaryDescriptor,
        ],
      windowsHide: true,
    }) as ChildProcessWithoutNullStreams;
  } finally {
    closeSync(parentDescriptor);
    if (pinnedBinaryDescriptor !== undefined) {
      closeSync(pinnedBinaryDescriptor);
    }
  }
  let stdout = Buffer.alloc(0);
  let stderr = Buffer.alloc(0);
  let rawProtocol = Buffer.alloc(0);
  const protocol = child.stdio[4] as Duplex;
  const protocolReader = new ProtocolFrameReaderV2(protocol);
  if (options.captureRawProtocol === true) {
    protocol.on("data", (chunk: Buffer) => {
      rawProtocol = Buffer.concat([rawProtocol, chunk]);
      if (rawProtocol.byteLength > 16 * 1024) child.kill("SIGKILL");
    });
  }
  child.stdout.on("data", (chunk: Buffer) => {
    stdout = Buffer.concat([stdout, chunk]);
    if (stdout.byteLength > maxCapturedOutputBytes) child.kill("SIGKILL");
  });
  child.stderr.on("data", (chunk: Buffer) => {
    stderr = Buffer.concat([stderr, chunk]);
    if (stderr.byteLength > 64 * 1024) child.kill("SIGKILL");
  });
  child.stdin.end(control);
  const exit = new Promise<NativeExitV2>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code, signal) => resolve({ code, signal }));
  });
  const waitForExit = async (): Promise<NativeExitV2> =>
    await new Promise<NativeExitV2>((resolve, reject) => {
      const timeout = setTimeout(() => {
        child.kill("SIGKILL");
        reject(
          new Error(
            `Native fixture exit timed out after ${nativeWaitTimeoutMs}ms: ${stderr.toString("utf8")}`,
          ),
        );
      }, nativeWaitTimeoutMs);
      void exit.then(
        (observed) => {
          clearTimeout(timeout);
          resolve(observed);
        },
        (error: unknown) => {
          clearTimeout(timeout);
          reject(error);
        },
      );
    });
  const waitForMarker = async (
    marker: string,
    checkpointName: string,
  ): Promise<void> => {
    if (!stderr.includes(marker)) {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          cleanup();
          reject(
            new Error(
              `Native ${checkpointName} checkpoint timed out: ${stderr.toString("utf8")}`,
            ),
          );
        }, nativeWaitTimeoutMs);
        const inspect = (): void => {
          if (stderr.includes(marker)) {
            cleanup();
            resolve();
          }
        };
        const ended = (observed: NativeExitV2): void => {
          cleanup();
          reject(
            new Error(
              `Native fixture exited before ${checkpointName} checkpoint: ${JSON.stringify(observed)} ${stderr.toString("utf8")}`,
            ),
          );
        };
        const cleanup = (): void => {
          clearTimeout(timeout);
          child.stderr.off("data", inspect);
        };
        child.stderr.on("data", inspect);
        void exit.then(ended, reject);
        inspect();
      });
    }
    await waitForStoppedStateV2(child, checkpointName);
  };
  return Object.freeze({
    child,
    protocol,
    protocolReader,
    waitForExit,
    stdout: () => Buffer.from(stdout),
    stderr: () => stderr.toString("utf8"),
    rawProtocol: () => Buffer.from(rawProtocol),
    waitForFirstPass: () => waitForMarker(
      "fixture_checkpoint_after_first_pass\n",
      "first-pass",
    ),
    waitForBaseline: () => waitForMarker(
      "fixture_checkpoint_after_baseline\n",
      "baseline",
    ),
    waitForRecursiveBaseline: () => waitForMarker(
      "fixture_checkpoint_recursive_baseline\n",
      "recursive-baseline",
    ),
    waitForRecapture: () => waitForMarker(
      "fixture_checkpoint_after_recapture\n",
      "recapture",
    ),
    waitForSecondOpen: () => waitForMarker(
      "fixture_checkpoint_session_second_open\n",
      "second-open",
    ),
    waitForLiveRelease: () => waitForMarker(
      "fixture_checkpoint_live_release_complete\n",
      "live-release",
    ),
    waitForSlotLedgerFirstEntry: () => waitForMarker(
      "fixture_checkpoint_slot_ledger_first_entry\n",
      "slot-ledger-first-entry",
    ),
  });
}

function lockContenderStatusV2(lockPath: string): number | null {
  const result = spawnSync(
    "/usr/bin/lockf",
    ["-t", "0", lockPath, "/usr/bin/true"],
    {
      cwd: "/",
      encoding: "utf8",
      env: { LANG: "C", LC_ALL: "C", PATH: "/usr/bin:/bin", TZ: "UTC" },
      maxBuffer: 64 * 1024,
      shell: false,
    },
  );
  assert.equal(result.signal, null, result.stderr);
  return result.status;
}

function descriptorLockContenderStatusV2(lockPath: string): number | null {
  const result = spawnSync(exactLockContenderBinary, [lockPath], {
    cwd: "/",
    encoding: "utf8",
    env: { LANG: "C", LC_ALL: "C", PATH: "/usr/bin:/bin", TZ: "UTC" },
    maxBuffer: 4_096,
    shell: false,
    timeout: 2_000,
  });
  assert.equal(result.signal, null, result.stderr);
  return result.status;
}

function pairedLockProbeStatusV2(
  sharedLockPath: string,
  nodeLockPath: string,
): number | null {
  const result = spawnSync(
    "/usr/bin/lockf",
    [
      "-t",
      "0",
      sharedLockPath,
      "/usr/bin/lockf",
      "-t",
      "0",
      nodeLockPath,
      "/usr/bin/true",
    ],
    {
      cwd: "/",
      encoding: "utf8",
      env: { LANG: "C", LC_ALL: "C", PATH: "/usr/bin:/bin", TZ: "UTC" },
      maxBuffer: 64 * 1024,
      shell: false,
      timeout: 2_000,
    },
  );
  assert.equal(result.signal, null, result.stderr);
  return result.status;
}

async function withinTestDeadlineV2<T>(
  promise: Promise<T>,
  label: string,
  timeoutMilliseconds = 2_000,
): Promise<T> {
  return await new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error(`Timed out waiting for ${label}`)),
      timeoutMilliseconds,
    );
    void promise.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

type RunningLockObserverV2 = Readonly<{
  child: ChildProcess;
  waitForReady: () => Promise<void>;
  waitForHeld: () => Promise<void>;
  waitForExit: () => Promise<NativeExitV2>;
}>;

function startPairedLockObserverV2(
  sharedLockPath: string,
  nodeLockPath: string,
): RunningLockObserverV2 {
  const child = spawn(
    semanticLockObserverBinary,
    [sharedLockPath, nodeLockPath],
    {
      cwd: "/",
      env: { LANG: "C", LC_ALL: "C", PATH: "/usr/bin:/bin", TZ: "UTC" },
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );
  let readySettled = false;
  let stderr = Buffer.alloc(0);
  const ready = new Promise<void>((resolve, reject) => {
    child.stdout!.on("data", (chunk: Buffer) => {
      if (readySettled) return;
      if (chunk.byteLength === 1 && chunk[0] === 0x52) {
        readySettled = true;
        resolve();
        return;
      }
      readySettled = true;
      reject(new Error("Lock observer readiness frame is invalid"));
    });
    child.once("error", (error) => {
      if (readySettled) return;
      readySettled = true;
      reject(error);
    });
  });
  child.stderr!.on("data", (chunk: Buffer) => {
    stderr = Buffer.concat([stderr, chunk]);
    if (stderr.byteLength > 4_096) child.kill("SIGKILL");
  });
  const exit = new Promise<NativeExitV2>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code, signal) => resolve({ code, signal }));
  });
  return Object.freeze({
    child,
    waitForReady: async () => {
      await withinTestDeadlineV2(ready, "lock observer readiness");
    },
    waitForHeld: async () => {
      const outcome = await withinTestDeadlineV2(
        exit,
        "lock observer held result",
      );
      assert.deepEqual(
        outcome,
        { code: 0, signal: null },
        stderr.toString("utf8"),
      );
      assert.equal(stderr.byteLength, 0);
    },
    waitForExit: async () => await withinTestDeadlineV2(
      exit,
      "lock observer reap",
    ),
  });
}

async function waitForConditionV2(
  condition: () => boolean,
  label: string,
  timeoutMilliseconds = 2_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMilliseconds;
  while (!condition()) {
    if (Date.now() >= deadline) {
      throw new Error(`Timed out waiting for ${label}`);
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 5));
  }
}

type RunningLockHolderV2 = Readonly<{
  child: ChildProcess;
  waitForExit: () => Promise<NativeExitV2>;
}>;

async function startDescriptorLockHolderV2(
  lockPath: string,
): Promise<RunningLockHolderV2> {
  const child = spawn(exactLockHolderBinary, [lockPath], {
    cwd: "/",
    env: { LANG: "C", LC_ALL: "C", PATH: "/usr/bin:/bin", TZ: "UTC" },
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  let stderr = Buffer.alloc(0);
  child.stderr!.on("data", (chunk: Buffer) => {
    stderr = Buffer.concat([stderr, chunk]);
    if (stderr.byteLength > 4_096) child.kill("SIGKILL");
  });
  const ready = new Promise<void>((resolve, reject) => {
    child.stdout!.once("data", (chunk: Buffer) => {
      if (chunk.equals(Buffer.from("R"))) resolve();
      else reject(new Error("Descriptor lock holder readiness is invalid"));
    });
    child.once("error", reject);
  });
  const exit = new Promise<NativeExitV2>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code, signal) => resolve({ code, signal }));
  });
  const waitForExit = async (): Promise<NativeExitV2> =>
    await withinTestDeadlineV2(exit, "descriptor lock holder reap");
  await withinTestDeadlineV2(ready, "descriptor lock holder readiness")
    .catch(async (error: unknown) => {
      child.kill("SIGKILL");
      await waitForExit().catch(() => undefined);
      throw new Error(`Descriptor lock holder failed: ${stderr.toString("utf8")}`, {
        cause: error,
      });
    });
  assert.notEqual(lockContenderStatusV2(lockPath), 0);
  return Object.freeze({ child, waitForExit });
}

function parseCompleteStreamV2(bytes: Buffer): Record<string, unknown>[] {
  assert.equal(bytes.byteLength > 0, true);
  assert.equal(bytes.at(-1), 0x0a);
  const text = bytes.toString("utf8");
  assert.equal(text.includes("\0"), false);
  return text.trimEnd().split("\n").map(
    (line) => JSON.parse(line) as Record<string, unknown>,
  );
}

function decodedEntryNameV2(frame: Record<string, unknown>): string {
  assert.equal(typeof frame.basenameBase64, "string");
  return Buffer.from(frame.basenameBase64 as string, "base64").toString("utf8");
}

type LiveObservationV2 = Readonly<{
  challenge: Buffer;
  aggregateBytes: Buffer;
  aggregateSha256: Buffer;
  frames: Record<string, unknown>[];
}>;

async function readLiveObservationV2(
  running: RunningNativeV2,
  fixture: FixtureNamespaceV2,
): Promise<LiveObservationV2> {
  const open = await running.protocolReader.readFrame();
  assert.equal(open.type, protocolOpenType);
  assert.equal(open.payload.byteLength, 32);
  assert.notDeepEqual(open.payload, Buffer.alloc(32));
  const observation = await running.protocolReader.readFrame();
  assert.equal(observation.type, protocolObservationType);
  assert.equal(observation.payload.byteLength > 0, true);
  assert.equal(
    observation.payload.includes(Buffer.from(fixture.parent, "utf8")),
    false,
  );
  const frames = parseCompleteStreamV2(observation.payload);
  assert.equal(frames.at(-1)!.completed, true);
  return Object.freeze({
    challenge: Buffer.from(open.payload),
    aggregateBytes: Buffer.from(observation.payload),
    aggregateSha256: sha256V2(observation.payload),
    frames,
  });
}

type SlotCatalogRecordV2 = Readonly<{
  slot: Buffer;
  entryIndex: number;
  objectKind: number;
}>;

function parseSlotCatalogV2(payload: Buffer): SlotCatalogRecordV2[] {
  assert.equal(payload.byteLength >= 4, true);
  const count = payload.readUInt32BE(0);
  assert.equal(payload.byteLength, 4 + count * 37);
  const records: SlotCatalogRecordV2[] = [];
  const slots = new Set<string>();
  for (let index = 0; index < count; index += 1) {
    const offset = 4 + index * 37;
    const slot = Buffer.from(payload.subarray(offset, offset + 32));
    const key = slot.toString("hex");
    assert.equal(slots.has(key), false);
    slots.add(key);
    records.push(Object.freeze({
      slot,
      entryIndex: payload.readUInt32BE(offset + 32),
      objectKind: payload[offset + 36]!,
    }));
  }
  assert.equal(new Set(records.map((record) => record.entryIndex)).size, count);
  return records;
}

type SlotContentObservationV2 = Readonly<{
  slot: Buffer;
  observationOrdinal: number;
  chunkIndex: number;
  chunkCount: number;
  offset: bigint;
  total: bigint;
  bytes: Buffer;
}>;

function parseSlotContentObservationV2(
  payload: Buffer,
): SlotContentObservationV2 {
  assert.equal(payload.byteLength >= 61, true);
  const chunkLength = payload.readUInt32BE(57);
  assert.equal(payload.byteLength, 61 + chunkLength);
  return Object.freeze({
    slot: Buffer.from(payload.subarray(0, 32)),
    observationOrdinal: payload[32]!,
    chunkIndex: payload.readUInt32BE(33),
    chunkCount: payload.readUInt32BE(37),
    offset: payload.readBigUInt64BE(41),
    total: payload.readBigUInt64BE(49),
    bytes: Buffer.from(payload.subarray(61)),
  });
}

function assertTerminalV2(
  terminal: ProtocolFrameV2,
  expectedType: number,
  observation: LiveObservationV2,
  semanticAckSha256: Buffer,
): void {
  assert.equal(terminal.type, expectedType);
  assert.equal(terminal.payload.byteLength, 97);
  assert.deepEqual(terminal.payload.subarray(0, 32), observation.challenge);
  assert.deepEqual(
    terminal.payload.subarray(32, 64),
    observation.aggregateSha256,
  );
  assert.deepEqual(
    terminal.payload.subarray(64, 96),
    semanticAckSha256,
  );
  assert.equal(
    terminal.payload[96],
    protocolSelfAssertedTestFixtureAuthorityType,
  );
}

async function expectLiveFailureWithoutTerminalV2(
  running: RunningNativeV2,
): Promise<NativeExitV2> {
  const noTerminal = assert.rejects(running.protocolReader.readFrame());
  const exit = await running.waitForExit();
  await noTerminal;
  await running.protocolReader.expectEnd();
  assert.notEqual(exit.code, 0, running.stderr());
  assert.equal(running.stdout().byteLength, 0);
  return exit;
}

function hostileExactBuilderInputV2(
  rawFrameBytes: unknown,
): PlatformReleaseBootstrapNodeNativeExactReleaseProbeFixtureInputV2 {
  return {
    rawFrameBytes,
    filesystemScope: null,
    globalPhysicalCensusHash: "",
    semanticSessionOccurrenceHash: "",
    finalTranscriptHash: "",
    pinnedBinaryDescriptorBindingHash: "",
    expectedParent: null,
    expectedSharedParentLock: null,
    expectedRegisteredNodePackageLock: null,
  } as unknown as
    PlatformReleaseBootstrapNodeNativeExactReleaseProbeFixtureInputV2;
}

describe("exact release probe replay builder hostile input boundaries", () => {
  it("rejects proxy, accessor, and intrinsic-oversize inputs before unsafe reads", () => {
    assert.throws(() =>
      buildPlatformReleaseBootstrapNodeNativeExactReleaseProbeFixtureV2(
        new Proxy({}, {}) as
          PlatformReleaseBootstrapNodeNativeExactReleaseProbeFixtureInputV2,
      )
    );
    assert.throws(() =>
      buildPlatformReleaseBootstrapNodeNativeExactReleaseProbeFixtureV2(
        hostileExactBuilderInputV2(new Proxy(new Uint8Array(2), {})),
      )
    );

    let accessorInvoked = false;
    const accessorInput = hostileExactBuilderInputV2(new Uint8Array(2));
    Object.defineProperty(accessorInput, "rawFrameBytes", {
      enumerable: true,
      configurable: true,
      get(): Uint8Array {
        accessorInvoked = true;
        throw new Error("raw accessor must not run");
      },
    });
    assert.throws(() =>
      buildPlatformReleaseBootstrapNodeNativeExactReleaseProbeFixtureV2(
        accessorInput,
      )
    );
    assert.equal(accessorInvoked, false);

    const nestedInput = hostileExactBuilderInputV2(new Uint8Array(2));
    Object.defineProperty(nestedInput, "filesystemScope", {
      value: buildBootstrapFilesystemScopeIdentityV2({
        scopeNonce: "a".repeat(64),
      }),
      enumerable: true,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(nestedInput, "expectedParent", {
      value: new Proxy({}, {}),
      enumerable: true,
      configurable: true,
      writable: true,
    });
    assert.throws(() =>
      buildPlatformReleaseBootstrapNodeNativeExactReleaseProbeFixtureV2(
        nestedInput,
      )
    );
    let nestedAccessorInvoked = false;
    const accessorObservation = { fingerprint: null };
    Object.defineProperty(accessorObservation, "objectIdentity", {
      enumerable: true,
      configurable: true,
      get(): never {
        nestedAccessorInvoked = true;
        throw new Error("nested accessor must not run");
      },
    });
    Object.defineProperty(nestedInput, "expectedParent", {
      value: accessorObservation,
      enumerable: true,
      configurable: true,
      writable: true,
    });
    assert.throws(() =>
      buildPlatformReleaseBootstrapNodeNativeExactReleaseProbeFixtureV2(
        nestedInput,
      )
    );
    assert.equal(nestedAccessorInvoked, false);

    let shadowByteLengthInvoked = false;
    const oversized = new Uint8Array(16 * 1024 + 1);
    Object.defineProperty(oversized, "byteLength", {
      configurable: true,
      get(): number {
        shadowByteLengthInvoked = true;
        throw new Error("shadow byteLength must not run");
      },
    });
    assert.throws(
      () => buildPlatformReleaseBootstrapNodeNativeExactReleaseProbeFixtureV2(
        hostileExactBuilderInputV2(oversized),
      ),
      /violates its byte bound/,
    );
    assert.equal(shadowByteLengthInvoked, false);

    let speciesInvoked = false;
    class HostileSpeciesBytesV2 extends Uint8Array {
      static override get [Symbol.species](): Uint8ArrayConstructor {
        speciesInvoked = true;
        throw new Error("typed-array species must not run");
      }
    }
    assert.throws(() =>
      buildPlatformReleaseBootstrapNodeNativeExactReleaseProbeFixtureV2(
        hostileExactBuilderInputV2(new HostileSpeciesBytesV2(2)),
      )
    );
    assert.equal(speciesInvoked, false);
  });
});

before(() => {
  if (!darwinArm64) return;
  buildAlias = mkdtempSync(
    path.join(os.tmpdir(), "setfarm-darwin-aggregate-census-build-v2-"),
  );
  buildRoot = realpathSync(buildAlias);
  chmodSync(buildRoot, 0o700);
  nativeBinary = path.join(buildRoot, "aggregate-census-fixture-v2");
  const clang = spawnSync(
    "/usr/bin/xcrun",
    ["--sdk", "macosx", "--find", "clang"],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
      env: { LANG: "C", LC_ALL: "C", PATH: "/usr/bin:/bin", TZ: "UTC" },
      maxBuffer: 1024 * 1024,
      shell: false,
    },
  );
  const sdk = spawnSync(
    "/usr/bin/xcrun",
    ["--sdk", "macosx", "--show-sdk-path"],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
      env: { LANG: "C", LC_ALL: "C", PATH: "/usr/bin:/bin", TZ: "UTC" },
      maxBuffer: 1024 * 1024,
      shell: false,
    },
  );
  assert.equal(clang.status, 0, clang.stderr);
  assert.equal(sdk.status, 0, sdk.stderr);
  const compiled = spawnSync(
    clang.stdout.trim(),
    [
      "-std=c17",
      "-O2",
      "-Wall",
      "-Wextra",
      "-Werror",
      "-pedantic",
      "-arch",
      "arm64",
      "-isysroot",
      sdk.stdout.trim(),
      kernelSource,
      fixtureSource,
      "-o",
      nativeBinary,
    ],
    {
      cwd: buildRoot,
      encoding: "utf8",
      env: { LANG: "C", LC_ALL: "C", PATH: "/usr/bin:/bin", TZ: "UTC" },
      maxBuffer: 2 * 1024 * 1024,
      shell: false,
    },
  );
  assert.equal(compiled.status, 0, compiled.stderr);
  assert.equal(compiled.signal, null);
  stderrOverflowBinary = path.join(
    buildRoot,
    "aggregate-census-stderr-overflow-wrapper-v2",
  );
  const quotedNativeBinary = nativeBinary.replaceAll("'", "'\\''");
  writeFileSync(
    stderrOverflowBinary,
    [
      "#!/bin/sh",
      `printf '%s' '${"x".repeat(5000)}' >&2`,
      `exec '${quotedNativeBinary}'`,
      "",
    ].join("\n"),
    { mode: 0o700, flag: "wx" },
  );
  semanticTrailingProtocolBinary = path.join(
    buildRoot,
    "aggregate-census-semantic-trailing-protocol-wrapper-v2",
  );
  semanticNoisyNonzeroBinary = path.join(
    buildRoot,
    "aggregate-census-semantic-noisy-nonzero-wrapper-v2",
  );
  semanticDelayedExitBinary = path.join(
    buildRoot,
    "aggregate-census-semantic-delayed-exit-wrapper-v2",
  );
  exactTrailingProtocolBinary = path.join(
    buildRoot,
    "aggregate-census-exact-trailing-protocol-wrapper-v2",
  );
  exactNoisyNonzeroBinary = path.join(
    buildRoot,
    "aggregate-census-exact-noisy-nonzero-wrapper-v2",
  );
  exactStoppedHangBinary = path.join(
    buildRoot,
    "aggregate-census-exact-stopped-hang-wrapper-v2",
  );
  const semanticWrapperSource = path.join(
    buildRoot,
    "aggregate-census-semantic-wrapper-v2.c",
  );
  const semanticLockObserverSource = path.join(
    buildRoot,
    "aggregate-census-semantic-lock-observer-v2.c",
  );
  const exactLockHolderSource = path.join(
    buildRoot,
    "aggregate-census-exact-lock-holder-v2.c",
  );
  const exactLockContenderSource = path.join(
    buildRoot,
    "aggregate-census-exact-lock-contender-v2.c",
  );
  semanticLockObserverBinary = path.join(
    buildRoot,
    "aggregate-census-semantic-lock-observer-v2",
  );
  exactLockHolderBinary = path.join(
    buildRoot,
    "aggregate-census-exact-lock-holder-v2",
  );
  exactLockContenderBinary = path.join(
    buildRoot,
    "aggregate-census-exact-lock-contender-v2",
  );
  const semanticInnerObject = path.join(
    buildRoot,
    "aggregate-census-semantic-inner-v2.o",
  );
  const semanticKernelObject = path.join(
    buildRoot,
    "aggregate-census-semantic-kernel-v2.o",
  );
  writeFileSync(
    semanticWrapperSource,
    [
      "#include <errno.h>",
      "#include <fcntl.h>",
      "#include <stdbool.h>",
      "#include <stddef.h>",
      "#include <string.h>",
      "#include <time.h>",
      "#include <unistd.h>",
      "",
      "int setfarm_fixture_inner_main_v2(int argc, char **argv);",
      "",
      "#if SETFARM_SEMANTIC_WRAPPER_MODE_V2 == 3",
      "static int setfarm_wait_for_release_v2(void)",
      "{",
      `  static const char ready[] = "${semanticDelayedReadyMarker}";`,
      `  static const char release[] = "${semanticDelayedReleaseMarker}";`,
      "  const struct timespec interval = { .tv_sec = 0, .tv_nsec = 1000000L };",
      "  int marker_fd;",
      "  int release_fd;",
      "  int attempt;",
      "  marker_fd = openat(3, ready, O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW, 0600);",
      "  if (marker_fd < 0 || close(marker_fd) != 0) return 74;",
      "  for (attempt = 0; attempt < 10000; attempt += 1) {",
      "    release_fd = openat(3, release, O_RDONLY | O_NOFOLLOW);",
      "    if (release_fd >= 0) {",
      "      if (close(release_fd) != 0) return 74;",
      "      return 0;",
      "    }",
      "    if (errno != ENOENT) return 74;",
      "    if (nanosleep(&interval, NULL) != 0 && errno != EINTR) return 74;",
      "  }",
      "  return 75;",
      "}",
      "#endif",
      "",
      "#if SETFARM_SEMANTIC_WRAPPER_MODE_V2 >= 4",
      "static int setfarm_run_exact_hook_v2(int argc, char **argv)",
      "{",
      "  static const char exact[] = \"exact_release_probe_v2\\n\";",
      "#if SETFARM_SEMANTIC_WRAPPER_MODE_V2 == 6",
      "  static const char both[] = \"probe_both_held\\n\";",
      "#endif",
      "  char control[25];",
      "  const char *selected = control;",
      "  size_t selected_length;",
      "  size_t used = 0;",
      "  int bridge[2];",
      "  int status;",
      "  bool is_exact;",
      "  while (used < sizeof(control)) {",
      "    ssize_t count = read(0, control + used, sizeof(control) - used);",
      "    if (count < 0 && errno == EINTR) continue;",
      "    if (count < 0) return 74;",
      "    if (count == 0) break;",
      "    used += (size_t)count;",
      "  }",
      "  if (used > 24) return 65;",
      "  is_exact = used == sizeof(exact) - 1 &&",
      "    memcmp(control, exact, sizeof(exact) - 1) == 0;",
      "  selected_length = used;",
      "#if SETFARM_SEMANTIC_WRAPPER_MODE_V2 == 6",
      "  if (is_exact) { selected = both; selected_length = sizeof(both) - 1; }",
      "#endif",
      "  if (pipe(bridge) != 0) return 74;",
      "  if (write(bridge[1], selected, selected_length) != (ssize_t)selected_length ||",
      "      close(bridge[1]) != 0 || dup2(bridge[0], 0) < 0 ||",
      "      close(bridge[0]) != 0) return 74;",
      "  status = setfarm_fixture_inner_main_v2(argc, argv);",
      "  if (status != 0) return status;",
      "#if SETFARM_SEMANTIC_WRAPPER_MODE_V2 == 4",
      "  if (is_exact && write(4, \"x\", 1) != 1) return 74;",
      "#elif SETFARM_SEMANTIC_WRAPPER_MODE_V2 == 5",
      "  if (is_exact) {",
      "    static const char message[] = \"exact wrapper forbidden stderr\\n\";",
      "    if (write(2, message, sizeof(message) - 1) < 0) return 74;",
      "    return 9;",
      "  }",
      "#endif",
      "  return 0;",
      "}",
      "#endif",
      "",
      "int main(int argc, char **argv)",
      "{",
      "#if SETFARM_SEMANTIC_WRAPPER_MODE_V2 >= 4",
      "  return setfarm_run_exact_hook_v2(argc, argv);",
      "#else",
      "  int status = setfarm_fixture_inner_main_v2(argc, argv);",
      "  if (status != 0) return status;",
      "#if SETFARM_SEMANTIC_WRAPPER_MODE_V2 == 1",
      "  if (write(4, \"x\", 1) != 1) return 74;",
      "  return 0;",
      "#elif SETFARM_SEMANTIC_WRAPPER_MODE_V2 == 2",
      "  {",
      "    static const char message[] = \"semantic wrapper forbidden stderr\\n\";",
      "    if (write(2, message, sizeof(message) - 1) < 0) return 74;",
      "  }",
      "  return 9;",
      "#elif SETFARM_SEMANTIC_WRAPPER_MODE_V2 == 3",
      "  return setfarm_wait_for_release_v2();",
      "#else",
      "#error unsupported semantic wrapper mode",
      "#endif",
      "#endif",
      "}",
      "",
    ].join("\n"),
    { mode: 0o600, flag: "wx" },
  );
  writeFileSync(
    semanticLockObserverSource,
    [
      "#include <fcntl.h>",
      "#include <errno.h>",
      "#include <string.h>",
      "#include <time.h>",
      "#include <unistd.h>",
      "",
      "static int setfarm_lock_is_held_v2(int fd)",
      "{",
      "  struct flock query;",
      "  memset(&query, 0, sizeof(query));",
      "  query.l_type = F_WRLCK;",
      "  query.l_whence = SEEK_SET;",
      "  if (fcntl(fd, F_GETLK, &query) != 0) return -1;",
      "  return query.l_type == F_UNLCK ? 0 : 1;",
      "}",
      "",
      "int main(int argc, char **argv)",
      "{",
      "  int shared_status;",
      "  int node_status;",
      "  int shared_fd;",
      "  int node_fd;",
      "  int attempt;",
      "  const struct timespec interval = { .tv_sec = 0, .tv_nsec = 1000000L };",
      "  if (argc != 3) return 64;",
      "  shared_fd = open(argv[1], O_RDONLY | O_NOFOLLOW);",
      "  node_fd = open(argv[2], O_RDONLY | O_NOFOLLOW);",
      "  if (shared_fd < 0 || node_fd < 0) return 74;",
      "  if (write(1, \"R\", 1) != 1) return 74;",
      "  for (attempt = 0; attempt < 10000; attempt += 1) {",
      "    shared_status = setfarm_lock_is_held_v2(shared_fd);",
      "    node_status = setfarm_lock_is_held_v2(node_fd);",
      "    if (shared_status < 0 || node_status < 0) return 74;",
      "    if (shared_status == 1 && node_status == 1) {",
      "      if (close(shared_fd) != 0 || close(node_fd) != 0) return 74;",
      "      return 0;",
      "    }",
      "    if (nanosleep(&interval, NULL) != 0 && errno != EINTR) return 74;",
      "  }",
      "  if (close(shared_fd) != 0 || close(node_fd) != 0) return 74;",
      "  return 1;",
      "}",
      "",
    ].join("\n"),
    { mode: 0o600, flag: "wx" },
  );
  writeFileSync(
    exactLockHolderSource,
    [
      "#include <fcntl.h>",
      "#include <unistd.h>",
      "",
      "int main(int argc, char **argv)",
      "{",
      "  int fd;",
      "  if (argc != 2) return 64;",
      "  fd = open(argv[1], O_RDWR | O_NOFOLLOW);",
      "  if (fd < 0 || lseek(fd, 0, SEEK_SET) < 0) return 74;",
      "  if (lockf(fd, F_LOCK, 0) != 0) return 75;",
      "  if (write(1, \"R\", 1) != 1) return 74;",
      "  for (;;) pause();",
      "}",
      "",
    ].join("\n"),
    { mode: 0o600, flag: "wx" },
  );
  writeFileSync(
    exactLockContenderSource,
    [
      "#include <fcntl.h>",
      "#include <unistd.h>",
      "",
      "int main(int argc, char **argv)",
      "{",
      "  int fd;",
      "  if (argc != 2) return 64;",
      "  fd = open(argv[1], O_RDWR | O_NOFOLLOW);",
      "  if (fd < 0 || lseek(fd, 0, SEEK_SET) < 0) return 74;",
      "  if (lockf(fd, F_TLOCK, 0) != 0) return 1;",
      "  if (lseek(fd, 0, SEEK_SET) < 0 || lockf(fd, F_ULOCK, 0) != 0)",
      "    return 74;",
      "  return close(fd) == 0 ? 0 : 74;",
      "}",
      "",
    ].join("\n"),
    { mode: 0o600, flag: "wx" },
  );
  const compileEnvironment = {
    LANG: "C",
    LC_ALL: "C",
    PATH: "/usr/bin:/bin",
    TZ: "UTC",
  };
  const strictCompileArguments = [
    "-std=c17",
    "-O2",
    "-Wall",
    "-Wextra",
    "-Werror",
    "-pedantic",
    "-arch",
    "arm64",
    "-isysroot",
    sdk.stdout.trim(),
  ];
  const compiledInner = spawnSync(
    clang.stdout.trim(),
    [
      ...strictCompileArguments,
      "-Dmain=setfarm_fixture_inner_main_v2",
      "-c",
      fixtureSource,
      "-o",
      semanticInnerObject,
    ],
    {
      cwd: buildRoot,
      encoding: "utf8",
      env: compileEnvironment,
      maxBuffer: 2 * 1024 * 1024,
      shell: false,
    },
  );
  assert.equal(compiledInner.status, 0, compiledInner.stderr);
  assert.equal(compiledInner.signal, null);
  const compiledKernel = spawnSync(
    clang.stdout.trim(),
    [
      ...strictCompileArguments,
      "-c",
      kernelSource,
      "-o",
      semanticKernelObject,
    ],
    {
      cwd: buildRoot,
      encoding: "utf8",
      env: compileEnvironment,
      maxBuffer: 2 * 1024 * 1024,
      shell: false,
    },
  );
  assert.equal(compiledKernel.status, 0, compiledKernel.stderr);
  assert.equal(compiledKernel.signal, null);
  const compileSemanticWrapper = (
    mode: 1 | 2 | 3 | 4 | 5 | 6,
    outputPath: string,
  ): void => {
    const result = spawnSync(
      clang.stdout.trim(),
      [
        ...strictCompileArguments,
        `-DSETFARM_SEMANTIC_WRAPPER_MODE_V2=${mode}`,
        semanticWrapperSource,
        semanticInnerObject,
        semanticKernelObject,
        "-o",
        outputPath,
      ],
      {
        cwd: buildRoot,
        encoding: "utf8",
        env: compileEnvironment,
        maxBuffer: 2 * 1024 * 1024,
        shell: false,
      },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.signal, null);
  };
  compileSemanticWrapper(1, semanticTrailingProtocolBinary);
  compileSemanticWrapper(2, semanticNoisyNonzeroBinary);
  compileSemanticWrapper(3, semanticDelayedExitBinary);
  compileSemanticWrapper(4, exactTrailingProtocolBinary);
  compileSemanticWrapper(5, exactNoisyNonzeroBinary);
  compileSemanticWrapper(6, exactStoppedHangBinary);
  const compiledLockObserver = spawnSync(
    clang.stdout.trim(),
    [
      ...strictCompileArguments,
      semanticLockObserverSource,
      "-o",
      semanticLockObserverBinary,
    ],
    {
      cwd: buildRoot,
      encoding: "utf8",
      env: compileEnvironment,
      maxBuffer: 2 * 1024 * 1024,
      shell: false,
    },
  );
  assert.equal(compiledLockObserver.status, 0, compiledLockObserver.stderr);
  assert.equal(compiledLockObserver.signal, null);
  const compiledExactLockHolder = spawnSync(
    clang.stdout.trim(),
    [
      ...strictCompileArguments,
      exactLockHolderSource,
      "-o",
      exactLockHolderBinary,
    ],
    {
      cwd: buildRoot,
      encoding: "utf8",
      env: compileEnvironment,
      maxBuffer: 2 * 1024 * 1024,
      shell: false,
    },
  );
  assert.equal(compiledExactLockHolder.status, 0, compiledExactLockHolder.stderr);
  assert.equal(compiledExactLockHolder.signal, null);
  const compiledExactLockContender = spawnSync(
    clang.stdout.trim(),
    [
      ...strictCompileArguments,
      exactLockContenderSource,
      "-o",
      exactLockContenderBinary,
    ],
    {
      cwd: buildRoot,
      encoding: "utf8",
      env: compileEnvironment,
      maxBuffer: 2 * 1024 * 1024,
      shell: false,
    },
  );
  assert.equal(
    compiledExactLockContender.status,
    0,
    compiledExactLockContender.stderr,
  );
  assert.equal(compiledExactLockContender.signal, null);
});

after(() => {
  if (buildAlias !== "") {
    rmSync(buildAlias, { recursive: true, force: true });
  }
});

describe(
  "Darwin read-only native aggregate census fixture v2",
  { skip: !darwinArm64 },
  () => {
    it("stops only at each code-owned exact release boundary with no pre-release frame", async () => {
      const cases = [
        {
          control: "probe_shared_held\n" as const,
          sharedHeld: true,
          nodeHeld: false,
        },
        {
          control: "probe_both_held\n" as const,
          sharedHeld: true,
          nodeHeld: true,
        },
        {
          control: "probe_node_released\n" as const,
          sharedHeld: true,
          nodeHeld: false,
        },
        {
          control: "probe_all_released\n" as const,
          sharedHeld: false,
          nodeHeld: false,
        },
      ];
      for (const fixtureCase of cases) {
        const fixture = makeFixtureNamespaceV2();
        let running: RunningNativeV2 | undefined;
        try {
          running = startNativeV2(fixture.parent, fixtureCase.control, {
            inheritedBinaryPath: nativeBinary,
            captureRawProtocol: true,
          });
          await waitForStoppedStateV2(running.child, fixtureCase.control.trim());
          assert.equal(running.stdout().byteLength, 0);
          assert.equal(running.stderr(), "");
          assert.equal(running.rawProtocol().byteLength, 0);
          assert.equal(
            descriptorLockContenderStatusV2(fixture.sharedLock) !== 0,
            fixtureCase.sharedHeld,
          );
          assert.equal(
            descriptorLockContenderStatusV2(fixture.nodeLock) !== 0,
            fixtureCase.nodeHeld,
          );
          assert.equal(running.child.kill("SIGCONT"), true);
          const exit = await running.waitForExit();
          assert.deepEqual(exit, { code: 0, signal: null }, running.stderr());
          assert.equal(running.stdout().byteLength, 0);
          assert.equal(running.stderr(), "");
          assert.equal(running.rawProtocol().byteLength > 0, true);
          running = undefined;
          assert.equal(
            pairedLockProbeStatusV2(fixture.sharedLock, fixture.nodeLock),
            0,
          );
        } finally {
          if (running !== undefined) {
            running.child.kill("SIGKILL");
            await running.waitForExit().catch(() => undefined);
          }
          rmSync(fixture.alias, { recursive: true, force: true });
        }
      }
    });

    it("proves exact descriptor-relative release and builds one pathless self-hashed receipt", async () => {
      const fixture = makeFixtureNamespaceV2();
      try {
        const filesystemScope = filesystemScopeForFixtureV2(fixture);
        const parent = physicalObservationFromStatV2(
          filesystemScope,
          "directory",
          lstatSync(fixture.parent, { bigint: true }),
        );
        const shared = physicalObservationFromStatV2(
          filesystemScope,
          "ordinary_file",
          lstatSync(fixture.sharedLock, { bigint: true }),
        );
        const node = physicalObservationFromStatV2(
          filesystemScope,
          "ordinary_file",
          lstatSync(fixture.nodeLock, { bigint: true }),
        );
        const running = startNativeV2(
          fixture.parent,
          "exact_release_probe_v2\n",
          { inheritedBinaryPath: nativeBinary, captureRawProtocol: true },
        );
        const exit = await running.waitForExit();
        assert.deepEqual(exit, { code: 0, signal: null }, running.stderr());
        assert.equal(running.stdout().byteLength, 0);
        assert.equal(running.stderr(), "");
        const raw = running.rawProtocol();
        assert.equal(raw.byteLength > 0 && raw.byteLength <= 16 * 1024, true);
        assert.equal(raw.at(-1), 0x0a);
        assert.equal(raw.subarray(0, -1).includes(0x0a), false);

        const baseInput = {
          rawFrameBytes: raw,
          filesystemScope,
          globalPhysicalCensusHash: sha256V2("global-census-v2").toString("hex"),
          semanticSessionOccurrenceHash:
            sha256V2("semantic-session-v2").toString("hex"),
          finalTranscriptHash: sha256V2("final-transcript-v2").toString("hex"),
          pinnedBinaryDescriptorBindingHash:
            sha256V2("pinned-binary-v2").toString("hex"),
          expectedParent: parent,
          expectedSharedParentLock: shared,
          expectedRegisteredNodePackageLock: node,
        } as const;
        const receipt =
          buildPlatformReleaseBootstrapNodeNativeExactReleaseProbeFixtureV2(
            baseInput,
          );
        assert.equal(Object.isFrozen(receipt), true);
        assert.equal(
          receipt.transportStatus,
          "caller_asserted_owned_bounded_fd4_frame_and_eof",
        );
        assert.equal(
          receipt.processExitStatus,
          "caller_asserted_exit_zero_silent",
        );
        assert.equal(
          receipt.descriptorRelativeReleaseProbeAuthority,
          "native_external_pid_descriptor_relative_exact_object_f_tlock_fixture_v2",
        );
        assert.deepEqual(receipt.acquisitionOrder, [
          "shared_parent_lock",
          "registered_node_package_lock",
        ]);
        assert.deepEqual(receipt.releaseOrder, [
          "registered_node_package_lock",
          "shared_parent_lock",
        ]);
        assert.equal(JSON.stringify(receipt).includes(fixture.parent), false);
        const { exactReleaseProbeReceiptHash, ...receiptIdentity } = receipt;
        assert.equal(
          exactReleaseProbeReceiptHash,
          hashPlatformReleaseBootstrapNodeNativeExactReleaseProbeReceiptV2(
            receiptIdentity,
          ),
        );
        const replay =
          buildPlatformReleaseBootstrapNodeNativeExactReleaseProbeFixtureV2({
            ...baseInput,
            semanticSessionOccurrenceHash:
              sha256V2("different-session-v2").toString("hex"),
          });
        assert.notEqual(replay.probeOccurrenceHash, receipt.probeOccurrenceHash);
        assert.notEqual(
          replay.exactReleaseProbeReceiptHash,
          receipt.exactReleaseProbeReceiptHash,
        );
        assert.throws(() =>
          buildPlatformReleaseBootstrapNodeNativeExactReleaseProbeFixtureV2({
            ...baseInput,
            rawFrameBytes: Buffer.concat([raw, Buffer.from("x")]),
          })
        );
        const tampered = Buffer.from(raw);
        tampered[0] ^= 0x01;
        assert.throws(() =>
          buildPlatformReleaseBootstrapNodeNativeExactReleaseProbeFixtureV2({
            ...baseInput,
            rawFrameBytes: tampered,
          })
        );
        assert.equal(
          pairedLockProbeStatusV2(fixture.sharedLock, fixture.nodeLock),
          0,
        );
      } finally {
        rmSync(fixture.alias, { recursive: true, force: true });
      }
    });

    it("fails closed before exact release probing when fd5 is missing or wrong", async () => {
      const fixture = makeFixtureNamespaceV2();
      let holder: RunningLockHolderV2 | undefined;
      try {
        holder = await startDescriptorLockHolderV2(fixture.sharedLock);
        for (const inheritedBinaryPath of [undefined, "wrong"] as const) {
          const started = Date.now();
          const running = startNativeV2(
            fixture.parent,
            "exact_release_probe_v2\n",
            {
              inheritedBinaryPath: inheritedBinaryPath === "wrong"
                ? fixture.payload
                : undefined,
              captureRawProtocol: true,
            },
          );
          const exit = await running.waitForExit();
          assert.deepEqual(exit, { code: 65, signal: null });
          assert.equal(Date.now() - started < 2_000, true);
          assert.equal(running.stdout().byteLength, 0);
          assert.equal(running.rawProtocol().byteLength, 0);
          assert.match(
            running.stderr(),
            /fixture_semantic_pinned_fd_invalid|fixture_semantic_pinned_mapped_vnode_mismatch/,
          );
          assert.notEqual(lockContenderStatusV2(fixture.sharedLock), 0);
          assert.equal(lockContenderStatusV2(fixture.nodeLock), 0);
        }
      } finally {
        if (holder !== undefined) {
          holder.child.kill("SIGKILL");
          await holder.waitForExit().catch(() => undefined);
        }
        assert.equal(
          pairedLockProbeStatusV2(fixture.sharedLock, fixture.nodeLock),
          0,
        );
        rmSync(fixture.alias, { recursive: true, force: true });
      }
    });

    it("releases the shared exact-object lease when the Node package lock is contended", async () => {
      const fixture = makeFixtureNamespaceV2();
      let holder: RunningLockHolderV2 | undefined;
      try {
        holder = await startDescriptorLockHolderV2(fixture.nodeLock);
        const running = startNativeV2(
          fixture.parent,
          "exact_release_probe_v2\n",
          { inheritedBinaryPath: nativeBinary, captureRawProtocol: true },
        );
        const exit = await running.waitForExit();
        assert.deepEqual(exit, { code: 65, signal: null });
        assert.equal(running.stdout().byteLength, 0);
        assert.equal(running.rawProtocol().byteLength, 0);
        assert.match(
          running.stderr(),
          /^fixture_exact_release_probe_failed code=lock_failed errno=\d+\n$/u,
        );
        assert.equal(lockContenderStatusV2(fixture.sharedLock), 0);
        assert.notEqual(lockContenderStatusV2(fixture.nodeLock), 0);
      } finally {
        if (holder !== undefined) {
          holder.child.kill("SIGKILL");
          await holder.waitForExit().catch(() => undefined);
        }
        assert.equal(
          pairedLockProbeStatusV2(fixture.sharedLock, fixture.nodeLock),
          0,
        );
        rmSync(fixture.alias, { recursive: true, force: true });
      }
    });

    it("rejects a same-byte new-inode shared pathname swap while retaining and releasing the original lease", async () => {
      const fixture = makeFixtureNamespaceV2();
      const renamedOriginal = path.join(
        fixture.parent,
        "shared-lock-original-after-swap",
      );
      let running: RunningNativeV2 | undefined;
      try {
        const originalStat = lstatSync(fixture.sharedLock, { bigint: true });
        running = startNativeV2(fixture.parent, "probe_shared_held\n", {
          inheritedBinaryPath: nativeBinary,
          captureRawProtocol: true,
        });
        await waitForStoppedStateV2(running.child, "shared-held inode swap");
        renameSync(fixture.sharedLock, renamedOriginal);
        writeFileSync(fixture.sharedLock, sharedLockBytes, {
          mode: 0o600,
          flag: "wx",
        });
        assert.notEqual(
          lstatSync(fixture.sharedLock, { bigint: true }).ino,
          originalStat.ino,
        );
        assert.equal(descriptorLockContenderStatusV2(fixture.sharedLock), 0);
        assert.notEqual(
          descriptorLockContenderStatusV2(renamedOriginal),
          0,
        );
        assert.equal(running.rawProtocol().byteLength, 0);
        assert.equal(running.child.kill("SIGCONT"), true);
        const exit = await running.waitForExit();
        assert.deepEqual(exit, { code: 65, signal: null });
        assert.match(
          running.stderr(),
          /^fixture_exact_release_probe_failed code=lock_invalid errno=\d+\n$/u,
        );
        assert.equal(running.rawProtocol().byteLength, 0);
        running = undefined;
        assert.equal(descriptorLockContenderStatusV2(fixture.sharedLock), 0);
        assert.equal(descriptorLockContenderStatusV2(renamedOriginal), 0);
      } finally {
        if (running !== undefined) {
          running.child.kill("SIGKILL");
          await running.waitForExit().catch(() => undefined);
        }
        rmSync(fixture.alias, { recursive: true, force: true });
      }
    });

    it("fails closed on fd3 parent fingerprint drift while leaving current-path decoys untouched", async () => {
      const fixture = makeFixtureNamespaceV2();
      const renamedParent = `${fixture.parent}.descriptor-pinned-original`;
      let running: RunningNativeV2 | undefined;
      try {
        running = startNativeV2(fixture.parent, "probe_shared_held\n", {
          inheritedBinaryPath: nativeBinary,
          captureRawProtocol: true,
        });
        await waitForStoppedStateV2(running.child, "fd3 parent replacement");
        renameSync(fixture.parent, renamedParent);
        mkdirSync(fixture.parent, { mode: 0o700 });
        writeFileSync(fixture.sharedLock, sharedLockBytes, {
          mode: 0o600,
          flag: "wx",
        });
        writeFileSync(fixture.nodeLock, nodeLockBytes, {
          mode: 0o600,
          flag: "wx",
        });
        assert.equal(descriptorLockContenderStatusV2(fixture.sharedLock), 0);
        assert.equal(descriptorLockContenderStatusV2(fixture.nodeLock), 0);
        assert.equal(running.child.kill("SIGCONT"), true);
        const exit = await running.waitForExit();
        assert.deepEqual(exit, { code: 65, signal: null });
        assert.match(
          running.stderr(),
          /^fixture_exact_release_probe_failed code=parent_changed errno=\d+\n$/u,
        );
        assert.equal(running.rawProtocol().byteLength, 0);
        running = undefined;
        assert.equal(descriptorLockContenderStatusV2(fixture.sharedLock), 0);
        assert.equal(descriptorLockContenderStatusV2(fixture.nodeLock), 0);
        assert.equal(
          descriptorLockContenderStatusV2(
            path.join(renamedParent, sharedLockBasename),
          ),
          0,
        );
        assert.equal(
          descriptorLockContenderStatusV2(
            path.join(renamedParent, nodeLockBasename),
          ),
          0,
        );
      } finally {
        if (running !== undefined) {
          running.child.kill("SIGKILL");
          await running.waitForExit().catch(() => undefined);
        }
        rmSync(fixture.parent, { recursive: true, force: true });
        rmSync(renamedParent, { recursive: true, force: true });
      }
    });

    it("rejects symlink, hardlink, and shared/Node alias lock topologies without evidence", async () => {
      const cases = [
        (fixture: FixtureNamespaceV2): void => {
          unlinkSync(fixture.sharedLock);
          symlinkSync(nodeLockBasename, fixture.sharedLock);
        },
        (fixture: FixtureNamespaceV2): void => {
          linkSync(
            fixture.sharedLock,
            path.join(fixture.parent, "unexpected-shared-hardlink"),
          );
        },
        (fixture: FixtureNamespaceV2): void => {
          unlinkSync(fixture.nodeLock);
          linkSync(fixture.sharedLock, fixture.nodeLock);
        },
      ] as const;
      for (const attack of cases) {
        const fixture = makeFixtureNamespaceV2();
        try {
          attack(fixture);
          const running = startNativeV2(
            fixture.parent,
            "exact_release_probe_v2\n",
            { inheritedBinaryPath: nativeBinary, captureRawProtocol: true },
          );
          const exit = await running.waitForExit();
          assert.deepEqual(exit, { code: 65, signal: null });
          assert.equal(running.stdout().byteLength, 0);
          assert.equal(running.rawProtocol().byteLength, 0);
          assert.match(
            running.stderr(),
            /^fixture_exact_release_probe_failed code=[a-z_]+ errno=\d+\n$/u,
          );
        } finally {
          rmSync(fixture.alias, { recursive: true, force: true });
        }
      }
    });

    it("emits one complete pathless stream with held-lock evidence joined to census entries", async () => {
      const fixture = makeFixtureNamespaceV2();
      try {
        const running = startNativeV2(fixture.parent, "none\n");
        const exit = await running.waitForExit();
        assert.deepEqual(exit, { code: 0, signal: null }, running.stderr());
        const frames = parseCompleteStreamV2(running.stdout());
        const header = frames[0]!;
        const parent = frames[1]!;
        const locks = frames[2]!;
        const footer = frames.at(-1)!;
        const entries = frames.slice(3, -1);

        assert.deepEqual(Object.keys(header), [
          "schema",
          "admissionScope",
          "capability",
          "productionAuthority",
          "signingAuthority",
          "observationAuthority",
          "capturePasses",
          "lockOrder",
        ]);
        assert.equal(
          header.schema,
          "setfarm.platform-release-bootstrap-darwin-aggregate-census-fixture-stream-header.v2",
        );
        assert.equal(header.admissionScope, "test_fixture");
        assert.equal(
          header.capability,
          "darwin_read_only_aggregate_census_fixture_v2",
        );
        assert.equal(header.productionAuthority, false);
        assert.equal(
          header.signingAuthority,
          "adhoc_or_unsigned_test_fixture",
        );
        assert.equal(
          header.observationAuthority,
          "fixture_evidence_only_never_backend_capability_v2",
        );
        assert.equal(header.capturePasses, 2);
        assert.deepEqual(header.lockOrder, [
          "shared_parent_lock",
          "registered_node_package_lock",
        ]);
        assert.equal(
          parent.schema,
          "setfarm.platform-release-bootstrap-darwin-aggregate-census-fixture-parent.v2",
        );
        assert.deepEqual(Object.keys(locks), [
          "schema",
          "lockOrder",
          "sharedParentLock",
          "registeredNodePackageLock",
        ]);
        assert.equal(
          locks.schema,
          "setfarm.platform-release-bootstrap-darwin-aggregate-census-fixture-locks.v2",
        );
        assert.equal(
          footer.schema,
          "setfarm.platform-release-bootstrap-darwin-aggregate-census-fixture-stream-footer.v2",
        );
        assert.equal(footer.completed, true);
        assert.equal(footer.entryCount, entries.length);
        assert.equal(footer.frameCount, frames.length);

        const orderedNames = entries.map(decodedEntryNameV2);
        assert.deepEqual(
          orderedNames,
          [...orderedNames].sort((left, right) =>
            Buffer.compare(Buffer.from(left), Buffer.from(right))),
        );
        const sharedEntry = entries.find(
          (entry) => decodedEntryNameV2(entry) === sharedLockBasename,
        )!;
        const nodeEntry = entries.find(
          (entry) => decodedEntryNameV2(entry) === nodeLockBasename,
        )!;
        assert.deepEqual(
          {
            stable: sharedEntry.stable,
            mutable: sharedEntry.mutable,
          },
          locks.sharedParentLock,
        );
        assert.deepEqual(
          {
            stable: nodeEntry.stable,
            mutable: nodeEntry.mutable,
          },
          locks.registeredNodePackageLock,
        );
        assert.equal(running.stdout().includes(fixture.parent), false);
      } finally {
        rmSync(fixture.alias, { recursive: true, force: true });
      }
    });

    it("holds both real lockf leases at the first-pass checkpoint and releases them on SIGKILL", async () => {
      const fixture = makeFixtureNamespaceV2();
      let running: RunningNativeV2 | undefined;
      try {
        running = startNativeV2(fixture.parent, "after_first_pass\n");
        await running.waitForFirstPass();
        assert.notEqual(lockContenderStatusV2(fixture.sharedLock), 0);
        assert.notEqual(lockContenderStatusV2(fixture.nodeLock), 0);
        assert.equal(running.stdout().byteLength, 0);

        assert.equal(running.child.kill("SIGKILL"), true);
        const exit = await running.waitForExit();
        assert.deepEqual(exit, { code: null, signal: "SIGKILL" });
        running = undefined;
        assert.equal(lockContenderStatusV2(fixture.sharedLock), 0);
        assert.equal(lockContenderStatusV2(fixture.nodeLock), 0);
      } finally {
        if (running !== undefined) {
          running.child.kill("SIGKILL");
          await running.waitForExit().catch(() => undefined);
        }
        rmSync(fixture.alias, { recursive: true, force: true });
      }
    });

    it("rejects a same-byte inode replacement after the first pass without authoritative stdout", async () => {
      const fixture = makeFixtureNamespaceV2();
      let running: RunningNativeV2 | undefined;
      try {
        const prior = lstatSync(fixture.payload, { bigint: true });
        running = startNativeV2(fixture.parent, "after_first_pass\n");
        await running.waitForFirstPass();
        const replacement = path.join(fixture.parent, "replacement.tmp");
        writeFileSync(
          replacement,
          "{\"payload\":\"same-byte-replacement\"}\n",
          { mode: 0o600, flag: "wx" },
        );
        renameSync(replacement, fixture.payload);
        const next = lstatSync(fixture.payload, { bigint: true });
        assert.notEqual(next.ino, prior.ino);

        assert.equal(running.child.kill("SIGCONT"), true);
        const exit = await running.waitForExit();
        assert.equal(exit.code, 70, running.stderr());
        assert.equal(exit.signal, null);
        assert.match(
          running.stderr(),
          /parent_changed|entry_changed|membership_changed/,
        );
        assert.equal(running.stdout().byteLength, 0);
        running = undefined;
      } finally {
        if (running !== undefined) {
          running.child.kill("SIGKILL");
          await running.waitForExit().catch(() => undefined);
        }
        rmSync(fixture.alias, { recursive: true, force: true });
      }
    });

    it("emits the complete stream only after a successful stateful recapture and close", async () => {
      const fixture = makeFixtureNamespaceV2();
      try {
        const running = startNativeV2(fixture.parent, "session_none\n");
        const exit = await running.waitForExit();
        assert.deepEqual(exit, { code: 0, signal: null }, running.stderr());
        const frames = parseCompleteStreamV2(running.stdout());
        assert.equal(
          frames[0]!.schema,
          "setfarm.platform-release-bootstrap-darwin-aggregate-census-fixture-stream-header.v2",
        );
        assert.deepEqual(frames[0]!.lockOrder, [
          "shared_parent_lock",
          "registered_node_package_lock",
        ]);
        assert.equal(frames.at(-1)!.completed, true);
        assert.equal(frames.at(-1)!.frameCount, frames.length);
        assert.equal(lockContenderStatusV2(fixture.sharedLock), 0);
        assert.equal(lockContenderStatusV2(fixture.nodeLock), 0);
      } finally {
        rmSync(fixture.alias, { recursive: true, force: true });
      }
    });

    it("holds both real lockf leases through the baseline checkpoint and releases after stateful close", async () => {
      const fixture = makeFixtureNamespaceV2();
      let running: RunningNativeV2 | undefined;
      try {
        running = startNativeV2(fixture.parent, "session_after_baseline\n");
        await running.waitForBaseline();
        assert.notEqual(lockContenderStatusV2(fixture.sharedLock), 0);
        assert.notEqual(lockContenderStatusV2(fixture.nodeLock), 0);
        assert.equal(running.stdout().byteLength, 0);

        assert.equal(running.child.kill("SIGCONT"), true);
        const exit = await running.waitForExit();
        assert.deepEqual(exit, { code: 0, signal: null }, running.stderr());
        parseCompleteStreamV2(running.stdout());
        running = undefined;
        assert.equal(lockContenderStatusV2(fixture.sharedLock), 0);
        assert.equal(lockContenderStatusV2(fixture.nodeLock), 0);
      } finally {
        if (running !== undefined) {
          running.child.kill("SIGKILL");
          await running.waitForExit().catch(() => undefined);
        }
        rmSync(fixture.alias, { recursive: true, force: true });
      }
    });

    it("preserves the first stateful session and both lockf leases when a second open is rejected", async () => {
      const fixture = makeFixtureNamespaceV2();
      let running: RunningNativeV2 | undefined;
      try {
        running = startNativeV2(fixture.parent, "session_second_open\n");
        await running.waitForSecondOpen();
        assert.notEqual(lockContenderStatusV2(fixture.sharedLock), 0);
        assert.notEqual(lockContenderStatusV2(fixture.nodeLock), 0);
        assert.equal(running.stdout().byteLength, 0);

        assert.equal(running.child.kill("SIGCONT"), true);
        const exit = await running.waitForExit();
        assert.deepEqual(exit, { code: 0, signal: null }, running.stderr());
        parseCompleteStreamV2(running.stdout());
        running = undefined;
        assert.equal(lockContenderStatusV2(fixture.sharedLock), 0);
        assert.equal(lockContenderStatusV2(fixture.nodeLock), 0);
      } finally {
        if (running !== undefined) {
          running.child.kill("SIGKILL");
          await running.waitForExit().catch(() => undefined);
        }
        rmSync(fixture.alias, { recursive: true, force: true });
      }
    });

    it("rejects same-byte inode replacement after recapture without publishing buffered stdout", async () => {
      const fixture = makeFixtureNamespaceV2();
      let running: RunningNativeV2 | undefined;
      try {
        const prior = lstatSync(fixture.payload, { bigint: true });
        running = startNativeV2(
          fixture.parent,
          "session_after_recapture\n",
        );
        await running.waitForRecapture();
        assert.notEqual(lockContenderStatusV2(fixture.sharedLock), 0);
        assert.notEqual(lockContenderStatusV2(fixture.nodeLock), 0);
        assert.equal(running.stdout().byteLength, 0);

        const replacement = path.join(
          fixture.parent,
          "replacement-after-recapture.tmp",
        );
        writeFileSync(
          replacement,
          "{\"payload\":\"same-byte-replacement\"}\n",
          { mode: 0o600, flag: "wx" },
        );
        renameSync(replacement, fixture.payload);
        const next = lstatSync(fixture.payload, { bigint: true });
        assert.notEqual(next.ino, prior.ino);

        assert.equal(running.child.kill("SIGCONT"), true);
        const exit = await running.waitForExit();
        assert.equal(exit.code, 70, running.stderr());
        assert.equal(exit.signal, null);
        assert.match(
          running.stderr(),
          /parent_changed|entry_changed|membership_changed/,
        );
        assert.equal(running.stdout().byteLength, 0);
        running = undefined;
        assert.equal(lockContenderStatusV2(fixture.sharedLock), 0);
        assert.equal(lockContenderStatusV2(fixture.nodeLock), 0);
      } finally {
        if (running !== undefined) {
          running.child.kill("SIGKILL");
          await running.waitForExit().catch(() => undefined);
        }
        rmSync(fixture.alias, { recursive: true, force: true });
      }
    });

    it("accepts one exact live ACK, releases in reverse, and emits one self-asserted terminal frame", async () => {
      const fixture = makeFixtureNamespaceV2();
      let running: RunningNativeV2 | undefined;
      try {
        running = startNativeV2(fixture.parent, "session_live\n");
        const observation = await readLiveObservationV2(running, fixture);
        assert.equal(observation.frames.length > 4, true);
        assert.notEqual(lockContenderStatusV2(fixture.sharedLock), 0);
        assert.notEqual(lockContenderStatusV2(fixture.nodeLock), 0);
        assert.equal(running.stdout().byteLength, 0);
        const semanticAckSha256 = sha256V2("live-accept-semantic-ack-v2");
        running.protocol.end(encodeAckV2(
          protocolAckAcceptType,
          observation.challenge,
          observation.aggregateSha256,
          semanticAckSha256,
        ));

        const terminal = await running.protocolReader.readFrame();
        assertTerminalV2(
          terminal,
          protocolTerminalAcceptType,
          observation,
          semanticAckSha256,
        );
        await running.protocolReader.expectEnd();
        const exit = await running.waitForExit();
        assert.deepEqual(exit, { code: 0, signal: null }, running.stderr());
        assert.equal(running.stdout().byteLength, 0);
        running = undefined;
        assert.equal(
          pairedLockProbeStatusV2(fixture.sharedLock, fixture.nodeLock),
          0,
        );
      } finally {
        if (running !== undefined) {
          running.child.kill("SIGKILL");
          await running.waitForExit().catch(() => undefined);
        }
        rmSync(fixture.alias, { recursive: true, force: true });
      }
    });

    it("issues opaque descriptor-backed member slots and returns two exact observations", async () => {
      const fixture = makeFixtureNamespaceV2();
      let running: RunningNativeV2 | undefined;
      try {
        running = startNativeV2(fixture.parent, "slot_ledger_live\n");
        const observation = await readLiveObservationV2(running, fixture);
        const catalogFrame = await running.protocolReader.readFrame();
        assert.equal(catalogFrame.type, protocolSlotCatalogType);
        const catalog = parseSlotCatalogV2(catalogFrame.payload);
        const payloadFrameIndex = observation.frames.findIndex(
          (frame) => typeof frame.basenameBase64 === "string" &&
            decodedEntryNameV2(frame) === lifecyclePayloadBasename,
        );
        assert.equal(payloadFrameIndex >= 3, true);
        const payloadEntryIndex = payloadFrameIndex - 3;
        const payloadSlot = catalog.find(
          (record) => record.entryIndex === payloadEntryIndex,
        );
        assert.notEqual(payloadSlot, undefined);
        assert.equal(payloadSlot!.objectKind, 1);

        running.protocol.write(encodeProtocolFrameV2(
          protocolSlotCaptureRequestType,
          payloadSlot!.slot,
        ));
        const captured: SlotContentObservationV2[] = [];
        while (captured.length < 2) {
          const frame = await running.protocolReader.readFrame();
          assert.equal(frame.type, protocolSlotContentObservationType);
          const content = parseSlotContentObservationV2(frame.payload);
          assert.deepEqual(content.slot, payloadSlot!.slot);
          assert.equal(content.chunkCount, 1);
          assert.equal(content.chunkIndex, 0);
          assert.equal(content.offset, 0n);
          assert.equal(content.total, BigInt(readFileSync(fixture.payload).byteLength));
          assert.equal(content.bytes.equals(readFileSync(fixture.payload)), true);
          captured.push(content);
        }
        assert.deepEqual(
          captured.map((content) => content.observationOrdinal).sort(),
          [0, 1],
        );
        const semanticAckSha256 = sha256V2(
          Buffer.concat(captured.map((content) => content.bytes)),
        );
        running.protocol.end(encodeAckV2(
          protocolAckAcceptType,
          observation.challenge,
          observation.aggregateSha256,
          semanticAckSha256,
        ));
        const terminal = await running.protocolReader.readFrame();
        assertTerminalV2(
          terminal,
          protocolTerminalAcceptType,
          observation,
          semanticAckSha256,
        );
        await running.protocolReader.expectEnd();
        const exit = await running.waitForExit();
        assert.deepEqual(exit, { code: 0, signal: null }, running.stderr());
        assert.equal(running.stdout().byteLength, 0);
        assert.equal(running.stderr(), "");
        running = undefined;
        assert.equal(
          pairedLockProbeStatusV2(fixture.sharedLock, fixture.nodeLock),
          0,
        );
      } finally {
        if (running !== undefined) {
          running.child.kill("SIGKILL");
          await running.waitForExit().catch(() => undefined);
        }
        rmSync(fixture.alias, { recursive: true, force: true });
      }
    });

    it("joins the live slot catalog and content frames through the private TS ledger before ACCEPT", async () => {
      const fixture = makeFixtureNamespaceV2();
      try {
        const result =
          await runPlatformReleaseBootstrapNodeNativeSlotLedgerLiveAdapterTestSupportV2({
            nativeBinaryPath: nativeBinary,
            parentPath: fixture.parent,
          });
        assert.equal(result.slotLedgerReceipt.productionAuthority, false);
        assert.equal(
          result.slotLedgerReceipt.authority,
          "test_fixture_node_ledger_joining_native_descriptor_capture_frames_v2",
        );
        assert.equal(
          result.slotLedgerReceipt.signingAuthority,
          "adhoc_or_unsigned_test_fixture",
        );
        assert.equal(result.slotLedgerReceipt.amfiAdmission, "unproven_test_fixture");
        assert.equal(
          result.slotLedgerReceipt.notarizationAdmission,
          "unproven_test_fixture",
        );
        assert.equal(
          result.slotLedgerReceipt.settlementStatus,
          "pre_accept_content_join_only",
        );
        assert.equal(Object.isFrozen(result.slotLedgerReceipt), true);
        assert.equal(
          JSON.stringify(result.slotLedgerReceipt).includes(fixture.parent),
          false,
        );
        assert.equal(result.aggregateCensusHash.length, 64);
        assert.equal(result.terminalFrameHash.length, 64);
        assert.equal(
          pairedLockProbeStatusV2(fixture.sharedLock, fixture.nodeLock),
          0,
        );
      } finally {
        rmSync(fixture.alias, { recursive: true, force: true });
      }
    });

    it("fails closed when the selected member changes between the two descriptor observations", async () => {
      const fixture = makeFixtureNamespaceV2();
      let running: RunningNativeV2 | undefined;
      try {
        running = startNativeV2(fixture.parent, "slot_ledger_drift\n");
        const observation = await readLiveObservationV2(running, fixture);
        const catalogFrame = await running.protocolReader.readFrame();
        const catalog = parseSlotCatalogV2(catalogFrame.payload);
        const payloadFrameIndex = observation.frames.findIndex(
          (frame) => typeof frame.basenameBase64 === "string" &&
            decodedEntryNameV2(frame) === lifecyclePayloadBasename,
        );
        const payloadEntryIndex = payloadFrameIndex - 3;
        const target = catalog.find((record) => record.entryIndex === payloadEntryIndex);
        assert.notEqual(target, undefined);
        running.protocol.write(encodeProtocolFrameV2(
          protocolSlotCaptureRequestType,
          target!.slot,
        ));
        await running.waitForSlotLedgerFirstEntry();
        const replacement = path.join(fixture.parent, "slot-ledger-drift.tmp");
        writeFileSync(
          replacement,
          readFileSync(fixture.payload),
          { mode: 0o600, flag: "wx" },
        );
        renameSync(replacement, fixture.payload);
        assert.equal(running.child.kill("SIGCONT"), true);
        const noTerminal = assert.rejects(running.protocolReader.readFrame());
        const exit = await running.waitForExit();
        await noTerminal;
        await running.protocolReader.expectEnd();
        assert.equal(exit.code, 70, running.stderr());
        assert.equal(exit.signal, null);
        assert.match(running.stderr(), /parent_changed|entry_changed/);
        assert.equal(running.stdout().byteLength, 0);
        running = undefined;
        assert.equal(
          pairedLockProbeStatusV2(fixture.sharedLock, fixture.nodeLock),
          0,
        );
      } finally {
        if (running !== undefined) {
          running.child.kill("SIGKILL");
          await running.waitForExit().catch(() => undefined);
        }
        rmSync(fixture.alias, { recursive: true, force: true });
      }
    });

    it("emits one strict recursive composite observation and aborts without weakening the live envelope", async () => {
      const fixture = makeRecursiveFixtureNamespaceV2();
      let running: RunningNativeV2 | undefined;
      try {
        running = startNativeV2(fixture.parent, "session_live_recursive\n");
        const observation = await readLiveObservationV2(running, fixture);
        assert.notEqual(lockContenderStatusV2(fixture.sharedLock), 0);
        assert.notEqual(lockContenderStatusV2(fixture.nodeLock), 0);
        const header = observation.frames[0]!;
        const recursive = observation.frames.at(-2)!;
        const footer = observation.frames.at(-1)!;
        const namespaceEntries = observation.frames.slice(3, -2);
        assert.deepEqual(Object.keys(header), [
          "schema",
          "admissionScope",
          "capability",
          "productionAuthority",
          "signingAuthority",
          "observationAuthority",
          "capturePasses",
          "recursiveEvidencePolicy",
          "lockOrder",
        ]);
        assert.equal(
          header.schema,
          "setfarm.platform-release-bootstrap-darwin-aggregate-census-fixture-stream-header.v3",
        );
        assert.equal(
          header.capability,
          "darwin_read_only_aggregate_census_with_node_recursive_evidence_fixture_v3",
        );
        assert.equal(header.productionAuthority, false);
        assert.equal(
          header.recursiveEvidencePolicy,
          "code_owned_exact_node_tree_descriptor_relative_v3",
        );
        assert.equal(
          recursive.schema,
          "setfarm.platform-release-bootstrap-darwin-aggregate-census-fixture-node-recursive-evidence.v3",
        );
        assert.equal(recursive.admissionScope, "test_fixture");
        assert.equal(recursive.productionAuthority, false);
        assert.equal(
          recursive.joinStatus,
          "native_capture_only_requires_ts_aggregate_join_v2",
        );
        assert.equal(recursive.rootBasename, nodeRootBasename);
        assert.equal(recursive.status, "complete");
        assert.equal(recursive.entryCount, 8);
        const orderedEntries = recursive.orderedEntries as Record<string, unknown>[];
        assert.deepEqual(
          orderedEntries.map((entry) => entry.role),
          [
            "root_directory",
            "bin_directory",
            "launcher_file",
            "lib_directory",
            "bundle_file",
            "manifest_file",
            "runtime_directory",
            "bootstrap_runtime_file",
          ],
        );
        assert.deepEqual(
          orderedEntries.map((entry) => entry.locator),
          [
            ".",
            "bin",
            "bin/setfarm-node-toolchain-provisioner-v2",
            "lib",
            "lib/node-toolchain-provisioner-v2.cjs",
            "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MANIFEST.v2.json",
            "runtime",
            "runtime/node",
          ],
        );
        assert.deepEqual(
          orderedEntries.map((entry) => entry.parentRole),
          [
            "global_parent",
            "root_directory",
            "bin_directory",
            "root_directory",
            "lib_directory",
            "root_directory",
            "root_directory",
            "runtime_directory",
          ],
        );
        const rootNamespaceEntry = namespaceEntries.find(
          (entry) => decodedEntryNameV2(entry) === nodeRootBasename,
        )!;
        assert.deepEqual(orderedEntries[0]!.stable, rootNamespaceEntry.stable);
        assert.deepEqual(orderedEntries[0]!.mutable, rootNamespaceEntry.mutable);
        const expectedFiles = new Map([
          ["launcher_file", { mode: "0555", bytes: fixture.fileBytes.launcher_file }],
          ["bundle_file", { mode: "0444", bytes: fixture.fileBytes.bundle_file }],
          ["manifest_file", { mode: "0444", bytes: fixture.fileBytes.manifest_file }],
          ["bootstrap_runtime_file", {
            mode: "0555",
            bytes: fixture.fileBytes.bootstrap_runtime_file,
          }],
        ]);
        for (const entry of orderedEntries) {
          const stable = entry.stable as Record<string, unknown>;
          const mutable = entry.mutable as Record<string, unknown>;
          const content = entry.content as Record<string, unknown>;
          const expected = expectedFiles.get(String(entry.role));
          if (expected === undefined) {
            assert.equal(stable.objectKind, "directory");
            assert.equal(mutable.mode, "0555");
            assert.equal(content.kind, "directory_membership");
          } else {
            assert.equal(stable.objectKind, "ordinary_file");
            assert.equal(mutable.mode, expected.mode);
            assert.equal(mutable.linkCount, 1);
            assert.equal(mutable.byteLength, expected.bytes.byteLength);
            assert.equal(content.kind, "sha256_regular_file");
            assert.equal(content.sha256, sha256V2(expected.bytes).toString("hex"));
          }
        }
        const physicalKeys = orderedEntries.map((entry) => {
          const stable = entry.stable as Record<string, unknown>;
          return `${stable.device}:${stable.inode}`;
        });
        assert.equal(new Set(physicalKeys).size, 8);
        assert.equal(
          observation.aggregateBytes.includes(fixture.fileBytes.bootstrap_runtime_file),
          false,
        );
        assert.equal(
          footer.schema,
          "setfarm.platform-release-bootstrap-darwin-aggregate-census-fixture-stream-footer.v3",
        );
        assert.equal(footer.namespaceEntryCount, namespaceEntries.length);
        assert.equal(footer.recursiveFrameCount, 1);
        assert.equal(footer.frameCount, observation.frames.length);
        assert.equal(observation.frames.length, namespaceEntries.length + 5);

        const semanticAckSha256 = sha256V2("recursive-live-abort-v2");
        running.protocol.end(encodeAckV2(
          protocolAckAbortType,
          observation.challenge,
          observation.aggregateSha256,
          semanticAckSha256,
        ));
        const terminal = await running.protocolReader.readFrame();
        assertTerminalV2(
          terminal,
          protocolTerminalAbortType,
          observation,
          semanticAckSha256,
        );
        await running.protocolReader.expectEnd();
        const exit = await running.waitForExit();
        assert.deepEqual(exit, { code: 0, signal: null }, running.stderr());
        running = undefined;
        assert.equal(
          pairedLockProbeStatusV2(fixture.sharedLock, fixture.nodeLock),
          0,
        );
      } finally {
        if (running !== undefined) {
          running.child.kill("SIGKILL");
          await running.waitForExit().catch(() => undefined);
        }
        removeRecursiveFixtureNamespaceV2(fixture);
      }
    });

    it("reports stable root absence and the legacy dummy layout without fabricating recursive entries", async () => {
      const cases = [
        { status: "layout_not_exact", removeRoot: false },
        { status: "root_absent", removeRoot: true },
      ] as const;
      for (const fixtureCase of cases) {
        const fixture = makeFixtureNamespaceV2();
        let running: RunningNativeV2 | undefined;
        try {
          if (fixtureCase.removeRoot) {
            rmSync(path.join(fixture.parent, nodeRootBasename), {
              recursive: true,
              force: true,
            });
          }
          running = startNativeV2(fixture.parent, "session_live_recursive\n");
          const observation = await readLiveObservationV2(running, fixture);
          const recursive = observation.frames.at(-2)!;
          assert.equal(recursive.status, fixtureCase.status);
          assert.equal(recursive.entryCount, 0);
          assert.deepEqual(recursive.orderedEntries, []);
          const semanticAckSha256 = sha256V2(
            `recursive-${fixtureCase.status}-abort-v2`,
          );
          running.protocol.end(encodeAckV2(
            protocolAckAbortType,
            observation.challenge,
            observation.aggregateSha256,
            semanticAckSha256,
          ));
          const terminal = await running.protocolReader.readFrame();
          assertTerminalV2(
            terminal,
            protocolTerminalAbortType,
            observation,
            semanticAckSha256,
          );
          await running.protocolReader.expectEnd();
          assert.deepEqual(
            await running.waitForExit(),
            { code: 0, signal: null },
            running.stderr(),
          );
          running = undefined;
          assert.equal(
            pairedLockProbeStatusV2(fixture.sharedLock, fixture.nodeLock),
            0,
          );
        } finally {
          if (running !== undefined) {
            running.child.kill("SIGKILL");
            await running.waitForExit().catch(() => undefined);
          }
          rmSync(fixture.alias, { recursive: true, force: true });
        }
      }
    });

    it("rejects recursive live accept for every native status until the TS semantic join exists", async () => {
      const cases = [
        {
          status: "complete",
          make(): FixtureNamespaceV2 {
            return makeRecursiveFixtureNamespaceV2();
          },
        },
        {
          status: "layout_not_exact",
          make(): FixtureNamespaceV2 {
            return makeFixtureNamespaceV2();
          },
        },
        {
          status: "root_absent",
          make(): FixtureNamespaceV2 {
            const fixture = makeFixtureNamespaceV2();
            rmSync(path.join(fixture.parent, nodeRootBasename), {
              recursive: true,
              force: true,
            });
            return fixture;
          },
        },
      ] as const;
      for (const fixtureCase of cases) {
        const fixture = fixtureCase.make();
        let running: RunningNativeV2 | undefined;
        try {
          running = startNativeV2(fixture.parent, "session_live_recursive\n");
          const observation = await readLiveObservationV2(running, fixture);
          assert.equal(observation.frames.at(-2)!.status, fixtureCase.status);
          assert.notEqual(lockContenderStatusV2(fixture.sharedLock), 0);
          assert.notEqual(lockContenderStatusV2(fixture.nodeLock), 0);
          running.protocol.end(encodeAckV2(
            protocolAckAcceptType,
            observation.challenge,
            observation.aggregateSha256,
            sha256V2(`forbidden-recursive-${fixtureCase.status}-accept-v2`),
          ));
          const noTerminal = assert.rejects(running.protocolReader.readFrame());
          const exit = await running.waitForExit();
          await noTerminal;
          await running.protocolReader.expectEnd();
          assert.deepEqual(exit, { code: 65, signal: null });
          assert.equal(running.stdout().byteLength, 0);
          assert.equal(
            running.stderr(),
            "fixture_recursive_accept_requires_ts_semantic_join\n",
          );
          running = undefined;
          assert.equal(
            pairedLockProbeStatusV2(fixture.sharedLock, fixture.nodeLock),
            0,
          );
        } finally {
          if (running !== undefined) {
            running.child.kill("SIGKILL");
            await running.waitForExit().catch(() => undefined);
          }
          if ("packageRoot" in fixture) {
            removeRecursiveFixtureNamespaceV2(
              fixture as RecursiveFixtureNamespaceV2,
            );
          } else {
            rmSync(fixture.alias, { recursive: true, force: true });
          }
        }
      }
    });

    it("accepts one complete recursive semantic-live session and echoes the opaque semantic commitment", async () => {
      const fixture = makeRecursiveFixtureNamespaceV2();
      let running: RunningNativeV2 | undefined;
      try {
        running = startNativeV2(fixture.parent, "recursive_semantic_live\n");
        const observation = await readLiveObservationV2(running, fixture);
        assert.equal(observation.frames.at(-2)!.status, "complete");
        assert.notEqual(lockContenderStatusV2(fixture.sharedLock), 0);
        assert.notEqual(lockContenderStatusV2(fixture.nodeLock), 0);
        assert.equal(running.stdout().byteLength, 0);
        const semanticAckSha256 = sha256V2(
          "recursive-semantic-live-complete-opaque-commitment-v2",
        );
        running.protocol.end(encodeAckV2(
          protocolAckAcceptType,
          observation.challenge,
          observation.aggregateSha256,
          semanticAckSha256,
        ));

        const terminal = await running.protocolReader.readFrame();
        assertTerminalV2(
          terminal,
          protocolTerminalAcceptType,
          observation,
          semanticAckSha256,
        );
        await running.protocolReader.expectEnd();
        assert.deepEqual(
          await running.waitForExit(),
          { code: 0, signal: null },
          running.stderr(),
        );
        assert.equal(running.stderr(), "");
        assert.equal(running.stdout().byteLength, 0);
        running = undefined;
        assert.equal(
          pairedLockProbeStatusV2(fixture.sharedLock, fixture.nodeLock),
          0,
        );
      } finally {
        if (running !== undefined) {
          running.child.kill("SIGKILL");
          await running.waitForExit().catch(() => undefined);
        }
        removeRecursiveFixtureNamespaceV2(fixture);
      }
    });

    it("accepts semantic-live only when fd5 pins the running mapped vnode", async () => {
      const fixture = makeRecursiveFixtureNamespaceV2();
      let running: RunningNativeV2 | undefined;
      try {
        running = startNativeV2(fixture.parent, "semantic_pinned_live\n", {
          inheritedBinaryPath: nativeBinary,
        });
        const observation = await readLiveObservationV2(running, fixture);
        assert.equal(observation.frames.at(-2)!.status, "complete");
        assert.notEqual(lockContenderStatusV2(fixture.sharedLock), 0);
        assert.notEqual(lockContenderStatusV2(fixture.nodeLock), 0);
        const semanticAckSha256 = sha256V2(
          "semantic-pinned-live-complete-opaque-commitment-v2",
        );
        running.protocol.end(encodeAckV2(
          protocolAckAcceptType,
          observation.challenge,
          observation.aggregateSha256,
          semanticAckSha256,
        ));
        assertTerminalV2(
          await running.protocolReader.readFrame(),
          protocolTerminalAcceptType,
          observation,
          semanticAckSha256,
        );
        await running.protocolReader.expectEnd();
        assert.deepEqual(
          await running.waitForExit(),
          { code: 0, signal: null },
          running.stderr(),
        );
        assert.equal(running.stderr(), "");
        assert.equal(running.stdout().byteLength, 0);
        running = undefined;
        assert.equal(
          pairedLockProbeStatusV2(fixture.sharedLock, fixture.nodeLock),
          0,
        );
      } finally {
        if (running !== undefined) {
          running.child.kill("SIGKILL");
          await running.waitForExit().catch(() => undefined);
        }
        removeRecursiveFixtureNamespaceV2(fixture);
      }
    });

    it("fails closed before protocol and locks when semantic fd5 is absent or wrong", async () => {
      const cases = [
        {
          name: "missing_fd5",
          options: {},
          stderr: /^fixture_semantic_pinned_fd_invalid errno=\d+\n$/,
        },
        {
          name: "wrong_regular_file",
          options: { inheritedBinaryPath: "payload" },
          stderr: /^fixture_semantic_pinned_mapped_vnode_mismatch\n$/,
        },
      ] as const;
      for (const fixtureCase of cases) {
        const fixture = makeFixtureNamespaceV2();
        let running: RunningNativeV2 | undefined;
        let holder: RunningLockHolderV2 | undefined;
        try {
          holder = await startDescriptorLockHolderV2(fixture.sharedLock);
          assert.notEqual(lockContenderStatusV2(fixture.sharedLock), 0);
          assert.equal(lockContenderStatusV2(fixture.nodeLock), 0);
          const started = Date.now();
          running = startNativeV2(
            fixture.parent,
            "semantic_pinned_live\n",
            fixtureCase.options.inheritedBinaryPath === "payload"
              ? { inheritedBinaryPath: fixture.payload }
              : {},
          );
          assert.deepEqual(
            await expectLiveFailureWithoutTerminalV2(running),
            { code: 65, signal: null },
            fixtureCase.name,
          );
          assert.equal(
            Date.now() - started < 1_000,
            true,
            `${fixtureCase.name} reached lock acquisition unexpectedly`,
          );
          assert.match(running.stderr(), fixtureCase.stderr);
          running = undefined;
          assert.notEqual(lockContenderStatusV2(fixture.sharedLock), 0);
          assert.equal(lockContenderStatusV2(fixture.nodeLock), 0);
        } finally {
          if (running !== undefined) {
            running.child.kill("SIGKILL");
            await running.waitForExit().catch(() => undefined);
          }
          if (holder !== undefined) {
            holder.child.kill("SIGKILL");
            await holder.waitForExit();
          }
          assert.equal(
            pairedLockProbeStatusV2(fixture.sharedLock, fixture.nodeLock),
            0,
          );
          rmSync(fixture.alias, { recursive: true, force: true });
        }
      }
    });

    it("rejects a same-byte different-inode fd5 before protocol", async () => {
      const fixture = makeFixtureNamespaceV2();
      const copiedBinary = path.join(buildRoot, "aggregate-census-copy-v2");
      let running: RunningNativeV2 | undefined;
      try {
        copyFileSync(nativeBinary, copiedBinary, constants.COPYFILE_EXCL);
        chmodSync(copiedBinary, 0o700);
        const originalStat = lstatSync(nativeBinary, { bigint: true });
        const copiedStat = lstatSync(copiedBinary, { bigint: true });
        assert.equal(originalStat.dev, copiedStat.dev);
        assert.notEqual(originalStat.ino, copiedStat.ino);
        assert.deepEqual(readFileSync(nativeBinary), readFileSync(copiedBinary));
        running = startNativeV2(fixture.parent, "semantic_pinned_live\n", {
          inheritedBinaryPath: nativeBinary,
          spawnBinaryPath: copiedBinary,
        });
        assert.deepEqual(
          await expectLiveFailureWithoutTerminalV2(running),
          { code: 65, signal: null },
        );
        assert.equal(
          running.stderr(),
          "fixture_semantic_pinned_mapped_vnode_mismatch\n",
        );
        running = undefined;
        assert.equal(
          pairedLockProbeStatusV2(fixture.sharedLock, fixture.nodeLock),
          0,
        );
      } finally {
        if (running !== undefined) {
          running.child.kill("SIGKILL");
          await running.waitForExit().catch(() => undefined);
        }
        rmSync(copiedBinary, { force: true });
        rmSync(fixture.alias, { recursive: true, force: true });
      }
    });

    it("rejects incomplete recursive semantic-live accept without terminal authority", async () => {
      const cases = [
        { status: "layout_not_exact", removeRoot: false },
        { status: "root_absent", removeRoot: true },
      ] as const;
      for (const fixtureCase of cases) {
        const fixture = makeFixtureNamespaceV2();
        let running: RunningNativeV2 | undefined;
        try {
          if (fixtureCase.removeRoot) {
            rmSync(path.join(fixture.parent, nodeRootBasename), {
              recursive: true,
              force: true,
            });
          }
          running = startNativeV2(
            fixture.parent,
            "recursive_semantic_live\n",
          );
          const observation = await readLiveObservationV2(running, fixture);
          assert.equal(observation.frames.at(-2)!.status, fixtureCase.status);
          assert.notEqual(lockContenderStatusV2(fixture.sharedLock), 0);
          assert.notEqual(lockContenderStatusV2(fixture.nodeLock), 0);
          running.protocol.end(encodeAckV2(
            protocolAckAcceptType,
            observation.challenge,
            observation.aggregateSha256,
            sha256V2(
              `recursive-semantic-${fixtureCase.status}-accept-v2`,
            ),
          ));

          const exit = await expectLiveFailureWithoutTerminalV2(running);
          assert.deepEqual(exit, { code: 65, signal: null });
          assert.equal(
            running.stderr(),
            "fixture_recursive_semantic_accept_requires_complete_evidence\n",
          );
          running = undefined;
          assert.equal(
            pairedLockProbeStatusV2(fixture.sharedLock, fixture.nodeLock),
            0,
          );
        } finally {
          if (running !== undefined) {
            running.child.kill("SIGKILL");
            await running.waitForExit().catch(() => undefined);
          }
          rmSync(fixture.alias, { recursive: true, force: true });
        }
      }
    });

    it("keeps recursive semantic-live abort exact for complete and incomplete observations", async () => {
      const cases = [
        {
          status: "complete",
          make(): FixtureNamespaceV2 {
            return makeRecursiveFixtureNamespaceV2();
          },
        },
        {
          status: "layout_not_exact",
          make(): FixtureNamespaceV2 {
            return makeFixtureNamespaceV2();
          },
        },
      ] as const;
      for (const fixtureCase of cases) {
        const fixture = fixtureCase.make();
        let running: RunningNativeV2 | undefined;
        try {
          running = startNativeV2(
            fixture.parent,
            "recursive_semantic_live\n",
          );
          const observation = await readLiveObservationV2(running, fixture);
          assert.equal(observation.frames.at(-2)!.status, fixtureCase.status);
          const semanticAckSha256 = sha256V2(
            `recursive-semantic-${fixtureCase.status}-abort-v2`,
          );
          running.protocol.end(encodeAckV2(
            protocolAckAbortType,
            observation.challenge,
            observation.aggregateSha256,
            semanticAckSha256,
          ));

          assertTerminalV2(
            await running.protocolReader.readFrame(),
            protocolTerminalAbortType,
            observation,
            semanticAckSha256,
          );
          await running.protocolReader.expectEnd();
          assert.deepEqual(
            await running.waitForExit(),
            { code: 0, signal: null },
            running.stderr(),
          );
          assert.equal(running.stderr(), "");
          running = undefined;
          assert.equal(
            pairedLockProbeStatusV2(fixture.sharedLock, fixture.nodeLock),
            0,
          );
        } finally {
          if (running !== undefined) {
            running.child.kill("SIGKILL");
            await running.waitForExit().catch(() => undefined);
          }
          if ("packageRoot" in fixture) {
            removeRecursiveFixtureNamespaceV2(
              fixture as RecursiveFixtureNamespaceV2,
            );
          } else {
            rmSync(fixture.alias, { recursive: true, force: true });
          }
        }
      }
    });

    it("rejects recursive semantic-live inode, content, and membership drift before terminal authority", async () => {
      const attacks = [
        {
          name: "same_byte_inode_replacement",
          mutate(fixture: RecursiveFixtureNamespaceV2): void {
            const replacement = path.join(
              fixture.binDirectory,
              ".semantic-live-replacement",
            );
            chmodSync(fixture.binDirectory, 0o755);
            writeFileSync(replacement, fixture.fileBytes.launcher_file, {
              mode: 0o555,
              flag: "wx",
            });
            renameSync(replacement, fixture.launcher);
            chmodSync(fixture.binDirectory, 0o555);
          },
        },
        {
          name: "same_length_content_change",
          mutate(fixture: RecursiveFixtureNamespaceV2): void {
            const changed = Buffer.from(fixture.fileBytes.launcher_file);
            changed[changed.byteLength - 2] ^= 1;
            chmodSync(fixture.launcher, 0o755);
            writeFileSync(fixture.launcher, changed);
            chmodSync(fixture.launcher, 0o555);
          },
        },
        {
          name: "membership_change",
          mutate(fixture: RecursiveFixtureNamespaceV2): void {
            chmodSync(fixture.packageRoot, 0o755);
            writeFileSync(
              path.join(fixture.packageRoot, "unexpected-semantic-live"),
              "x",
              { mode: 0o444, flag: "wx" },
            );
            chmodSync(fixture.packageRoot, 0o555);
          },
        },
      ] as const;
      for (const attack of attacks) {
        const fixture = makeRecursiveFixtureNamespaceV2();
        let running: RunningNativeV2 | undefined;
        try {
          running = startNativeV2(
            fixture.parent,
            "recursive_semantic_live\n",
          );
          const observation = await readLiveObservationV2(running, fixture);
          assert.equal(observation.frames.at(-2)!.status, "complete");
          assert.notEqual(lockContenderStatusV2(fixture.sharedLock), 0);
          assert.notEqual(lockContenderStatusV2(fixture.nodeLock), 0);
          attack.mutate(fixture);
          running.protocol.end(encodeAckV2(
            protocolAckAcceptType,
            observation.challenge,
            observation.aggregateSha256,
            sha256V2(`recursive-semantic-${attack.name}-accept-v2`),
          ));

          const exit = await expectLiveFailureWithoutTerminalV2(running);
          assert.match(
            running.stderr(),
            /parent_changed|entry_changed|membership_changed|entry_invalid/,
            attack.name,
          );
          assert.notEqual(exit.code, 0, attack.name);
          running = undefined;
          assert.equal(
            pairedLockProbeStatusV2(fixture.sharedLock, fixture.nodeLock),
            0,
          );
        } finally {
          if (running !== undefined) {
            running.child.kill("SIGKILL");
            await running.waitForExit().catch(() => undefined);
          }
          removeRecursiveFixtureNamespaceV2(fixture);
        }
      }
    });

    it("revalidates and closes one clean recursive composite session before publishing stdout", async () => {
      const fixture = makeRecursiveFixtureNamespaceV2();
      let running: RunningNativeV2 | undefined;
      try {
        running = startNativeV2(fixture.parent, "recursive_revalidate\n");
        await running.waitForRecursiveBaseline();
        assert.notEqual(lockContenderStatusV2(fixture.sharedLock), 0);
        assert.notEqual(lockContenderStatusV2(fixture.nodeLock), 0);
        assert.equal(running.stdout().byteLength, 0);
        assert.equal(running.child.kill("SIGCONT"), true);
        const exit = await running.waitForExit();
        assert.deepEqual(exit, { code: 0, signal: null }, running.stderr());
        const frames = parseCompleteStreamV2(running.stdout());
        assert.equal(
          frames[0]!.schema,
          "setfarm.platform-release-bootstrap-darwin-aggregate-census-fixture-stream-header.v3",
        );
        assert.equal(frames.at(-2)!.status, "complete");
        assert.equal(frames.at(-2)!.entryCount, 8);
        assert.equal(
          frames.at(-1)!.schema,
          "setfarm.platform-release-bootstrap-darwin-aggregate-census-fixture-stream-footer.v3",
        );
        running = undefined;
        assert.equal(
          pairedLockProbeStatusV2(fixture.sharedLock, fixture.nodeLock),
          0,
        );
      } finally {
        if (running !== undefined) {
          running.child.kill("SIGKILL");
          await running.waitForExit().catch(() => undefined);
        }
        removeRecursiveFixtureNamespaceV2(fixture);
      }
    });

    it("rejects nested recursive changes during stateful revalidation without stdout", async () => {
      const attacks = [
        {
          name: "content_and_metadata",
          mutate(fixture: RecursiveFixtureNamespaceV2): void {
            chmodSync(fixture.launcher, 0o755);
            writeFileSync(fixture.launcher, "#!/bin/sh\nexit 1\n");
          },
        },
        {
          name: "inode_replacement",
          mutate(fixture: RecursiveFixtureNamespaceV2): void {
            const replacementRoot = mkdtempSync(
              path.join(os.tmpdir(), "setfarm-recursive-replacement-v2-"),
            );
            const replacement = path.join(replacementRoot, "launcher");
            writeFileSync(replacement, fixture.fileBytes.launcher_file, {
              mode: 0o555,
              flag: "wx",
            });
            chmodSync(fixture.binDirectory, 0o755);
            renameSync(replacement, fixture.launcher);
            rmSync(replacementRoot, { recursive: true, force: true });
          },
        },
        {
          name: "membership",
          mutate(fixture: RecursiveFixtureNamespaceV2): void {
            chmodSync(fixture.packageRoot, 0o755);
            writeFileSync(path.join(fixture.packageRoot, "unexpected"), "x", {
              mode: 0o444,
              flag: "wx",
            });
          },
        },
      ] as const;
      for (const attack of attacks) {
        const fixture = makeRecursiveFixtureNamespaceV2();
        let running: RunningNativeV2 | undefined;
        try {
          running = startNativeV2(fixture.parent, "recursive_revalidate\n");
          await running.waitForRecursiveBaseline();
          assert.notEqual(lockContenderStatusV2(fixture.sharedLock), 0);
          assert.notEqual(lockContenderStatusV2(fixture.nodeLock), 0);
          assert.equal(running.stdout().byteLength, 0);
          attack.mutate(fixture);
          assert.equal(running.child.kill("SIGCONT"), true);
          const exit = await running.waitForExit();
          assert.match(
            running.stderr(),
            /parent_changed|entry_changed|membership_changed|entry_invalid/,
          );
          assert.notEqual(exit.code, 0);
          assert.equal(running.stdout().byteLength, 0);
          running = undefined;
          assert.equal(
            pairedLockProbeStatusV2(fixture.sharedLock, fixture.nodeLock),
            0,
          );
        } finally {
          if (running !== undefined) {
            running.child.kill("SIGKILL");
            await running.waitForExit().catch(() => undefined);
          }
          removeRecursiveFixtureNamespaceV2(fixture);
        }
      }
    });

    it("rejects recursive symlink and hardlink layouts before observation authority", async () => {
      const attacks = [
        {
          name: "symlink",
          mutate(fixture: RecursiveFixtureNamespaceV2): void {
            chmodSync(fixture.runtimeDirectory, 0o755);
            unlinkSync(fixture.runtime);
            symlinkSync("../bin/setfarm-node-toolchain-provisioner-v2", fixture.runtime);
            chmodSync(fixture.runtimeDirectory, 0o555);
          },
        },
        {
          name: "hardlink",
          mutate(fixture: RecursiveFixtureNamespaceV2): void {
            chmodSync(fixture.libDirectory, 0o755);
            unlinkSync(fixture.bundle);
            linkSync(fixture.launcher, fixture.bundle);
            chmodSync(fixture.libDirectory, 0o555);
          },
        },
      ] as const;
      for (const attack of attacks) {
        const fixture = makeRecursiveFixtureNamespaceV2();
        try {
          attack.mutate(fixture);
          const running = startNativeV2(
            fixture.parent,
            "session_live_recursive\n",
          );
          const noFrame = assert.rejects(running.protocolReader.readFrame());
          const exit = await running.waitForExit();
          await noFrame;
          await running.protocolReader.expectEnd();
          assert.notEqual(exit.code, 0, attack.name);
          assert.match(
            running.stderr(),
            /entry_changed|entry_invalid/,
            attack.name,
          );
          assert.equal(
            pairedLockProbeStatusV2(fixture.sharedLock, fixture.nodeLock),
            0,
          );
        } finally {
          removeRecursiveFixtureNamespaceV2(fixture);
        }
      }
    });

    it("proves accept and abort release while the child is stopped before terminal publication", async () => {
      const decisions = [
        {
          name: "accept",
          ackType: protocolAckAcceptType,
          terminalType: protocolTerminalAcceptType,
        },
        {
          name: "abort",
          ackType: protocolAckAbortType,
          terminalType: protocolTerminalAbortType,
        },
      ] as const;
      for (const decision of decisions) {
        const fixture = makeFixtureNamespaceV2();
        let running: RunningNativeV2 | undefined;
        try {
          const sharedBefore = lstatSync(fixture.sharedLock, { bigint: true });
          const nodeBefore = lstatSync(fixture.nodeLock, { bigint: true });
          assert.notDeepEqual(
            { device: sharedBefore.dev, inode: sharedBefore.ino },
            { device: nodeBefore.dev, inode: nodeBefore.ino },
          );
          running = startNativeV2(fixture.parent, "live_release_stop\n");
          const observation = await readLiveObservationV2(running, fixture);
          const semanticAckSha256 = sha256V2(
            `live-release-stop-${decision.name}-semantic-ack-v2`,
          );
          let terminalSettled = false;
          const terminalOutcome = running.protocolReader.readFrame().then(
            (frame) => {
              terminalSettled = true;
              return { frame, error: null };
            },
            (error: unknown) => {
              terminalSettled = true;
              return { frame: null, error };
            },
          );
          running.protocol.end(encodeAckV2(
            decision.ackType,
            observation.challenge,
            observation.aggregateSha256,
            semanticAckSha256,
          ));

          await running.waitForLiveRelease();
          await new Promise<void>((resolve) => setTimeout(resolve, 25));
          assert.equal(terminalSettled, false, decision.name);
          const sharedStopped = lstatSync(
            fixture.sharedLock,
            { bigint: true },
          );
          const nodeStopped = lstatSync(fixture.nodeLock, { bigint: true });
          assert.deepEqual(
            { device: sharedStopped.dev, inode: sharedStopped.ino },
            { device: sharedBefore.dev, inode: sharedBefore.ino },
          );
          assert.deepEqual(
            { device: nodeStopped.dev, inode: nodeStopped.ino },
            { device: nodeBefore.dev, inode: nodeBefore.ino },
          );
          assert.notDeepEqual(
            { device: sharedStopped.dev, inode: sharedStopped.ino },
            { device: nodeStopped.dev, inode: nodeStopped.ino },
          );
          assert.equal(
            pairedLockProbeStatusV2(fixture.sharedLock, fixture.nodeLock),
            0,
          );
          assert.equal(running.stdout().byteLength, 0);

          assert.equal(running.child.kill("SIGCONT"), true);
          const terminalResult = await terminalOutcome;
          if (terminalResult.error !== null) throw terminalResult.error;
          assert.notEqual(terminalResult.frame, null);
          assertTerminalV2(
            terminalResult.frame!,
            decision.terminalType,
            observation,
            semanticAckSha256,
          );
          await running.protocolReader.expectEnd();
          const exit = await running.waitForExit();
          assert.deepEqual(
            exit,
            { code: 0, signal: null },
            running.stderr(),
          );
          assert.equal(running.stdout().byteLength, 0);
          running = undefined;
        } finally {
          if (running !== undefined) {
            running.child.kill("SIGKILL");
            await running.waitForExit().catch(() => undefined);
          }
          rmSync(fixture.alias, { recursive: true, force: true });
        }
      }
    });

    it("aborts one exact live session, releases both locks, and emits only the abort terminal", async () => {
      const fixture = makeFixtureNamespaceV2();
      let running: RunningNativeV2 | undefined;
      try {
        running = startNativeV2(fixture.parent, "session_live\n");
        const observation = await readLiveObservationV2(running, fixture);
        assert.notEqual(lockContenderStatusV2(fixture.sharedLock), 0);
        assert.notEqual(lockContenderStatusV2(fixture.nodeLock), 0);
        const semanticAckSha256 = sha256V2("live-abort-semantic-ack-v2");
        running.protocol.end(encodeAckV2(
          protocolAckAbortType,
          observation.challenge,
          observation.aggregateSha256,
          semanticAckSha256,
        ));

        const terminal = await running.protocolReader.readFrame();
        assertTerminalV2(
          terminal,
          protocolTerminalAbortType,
          observation,
          semanticAckSha256,
        );
        await running.protocolReader.expectEnd();
        const exit = await running.waitForExit();
        assert.deepEqual(exit, { code: 0, signal: null }, running.stderr());
        assert.equal(running.stdout().byteLength, 0);
        running = undefined;
        assert.equal(
          pairedLockProbeStatusV2(fixture.sharedLock, fixture.nodeLock),
          0,
        );
      } finally {
        if (running !== undefined) {
          running.child.kill("SIGKILL");
          await running.waitForExit().catch(() => undefined);
        }
        rmSync(fixture.alias, { recursive: true, force: true });
      }
    });

    it("joins the real native abort session to the test-support controller receipt", async () => {
      const fixture = makeFixtureNamespaceV2();
      try {
        const result =
          await runPlatformReleaseBootstrapNodeNativeLiveAdapterTestSupportV2({
            nativeBinaryPath: nativeBinary,
            parentPath: fixture.parent,
          });
        assert.deepEqual(Object.keys(result), [
          "receipt",
          "liveAdapterReceipt",
          "timing",
        ]);
        assert.equal(Object.isFrozen(result), true);
        assert.equal(Object.isFrozen(result.liveAdapterReceipt), true);
        assert.equal(Object.isFrozen(result.timing), true);
        assert.equal(result.receipt.admissionScope, "test_fixture");
        assert.equal(result.receipt.productionAuthority, false);
        assert.equal(
          result.receipt.transportAuthority,
          "caller_supplied_fixture_frames_requires_live_adapter_v2",
        );
        assert.equal(
          result.receipt.processSettlementAuthority,
          "caller_supplied_claim_requires_live_adapter_v2",
        );
        assert.equal(
          result.receipt.ackDeadlineStatus,
          "unverified_until_live_adapter_v2",
        );
        assert.equal(
          result.receipt.controllerAuthority,
          "self_asserted_contract_only_requires_live_adapter_v2",
        );
        assert.equal(
          result.receipt.semanticDisposition,
          "abort_observation_not_acceptable",
        );
        assert.equal(result.receipt.cleanProcessSettlement, true);
        const liveReceipt = result.liveAdapterReceipt;
        assert.equal(liveReceipt.admissionScope, "test_fixture");
        assert.equal(liveReceipt.productionAuthority, false);
        assert.equal(
          liveReceipt.controllerReceiptHash,
          result.receipt.receiptHash,
        );
        assert.equal(
          liveReceipt.sessionOccurrenceHash,
          result.receipt.sessionOccurrenceHash,
        );
        assert.equal(
          liveReceipt.globalPhysicalCensusHash,
          result.receipt.globalPhysicalCensusHash,
        );
        assert.equal(
          liveReceipt.nodePhysicalProjectionHash,
          result.receipt.nodePhysicalProjectionHash,
        );
        assert.equal(
          liveReceipt.sharedParentLockObjectIdentityHash,
          result.receipt.sharedParentLockObjectIdentityHash,
        );
        assert.equal(
          liveReceipt.registeredNodePackageLockObjectIdentityHash,
          result.receipt.registeredNodePackageLockObjectIdentityHash,
        );
        assert.equal(
          liveReceipt.transportObservationStatus,
          "code_owned_fd4_terminal_eof_exit_observed",
        );
        assert.equal(
          liveReceipt.pathProbeStatus,
          "code_owned_path_probe_observed_toctou_limited",
        );
        assert.equal(
          liveReceipt.acknowledgementDeadlineStatus,
          "measured_ack_within_5000ms",
        );
        assert.equal(
          liveReceipt.binaryExecutionAuthority,
          "binary_path_spawn_unverified_test_fixture",
        );
        assert.equal(liveReceipt.recursiveEvidenceStatus, "recursive_absent");
        assert.equal(
          liveReceipt.serializedAuthority,
          "self_asserted_replay_never_live_authority",
        );
        const {
          liveAdapterReceiptHash,
          ...liveReceiptIdentity
        } = liveReceipt;
        assert.equal(
          liveAdapterReceiptHash,
          hashCanonicalJson({
            schema:
              "setfarm.platform-release-bootstrap-node-native-live-adapter-test-support-receipt-hash.v2",
            receipt: liveReceiptIdentity,
          }),
        );
        assert.equal(
          result.timing.authority,
          "non_authoritative_test_support_timing_v2",
        );
        assert.equal(result.timing.status, "within_fixture_budget_v2");
        assert.equal(result.timing.acknowledgementBudgetMilliseconds, 5_000);
        assert.equal(
          result.timing.acknowledgementElapsedMilliseconds >= 0
            && result.timing.acknowledgementElapsedMilliseconds <= 5_000,
          true,
        );
        assert.equal(
          pairedLockProbeStatusV2(fixture.sharedLock, fixture.nodeLock),
          0,
        );
        assert.deepEqual(
          Object.keys(result).filter((key) =>
            /descriptor|callback|buffer|bytes|process|method/i.test(key)),
          [],
        );
        assert.equal(JSON.stringify(result).includes(fixture.parent), false);
      } finally {
        rmSync(fixture.alias, { recursive: true, force: true });
      }
    });

    it("joins one real recursive semantic-live accept through terminal, release, session close, and fresh semantic rejoin", async () => {
      const fixture = makeSemanticReadyRecursiveFixtureNamespaceV2();
      try {
        const result =
          await runPlatformReleaseBootstrapNodeNativeRecursiveSemanticLiveAdapterTestSupportV2({
            nativeBinaryPath: nativeBinary,
            parentPath: fixture.parent,
          });
        assert.deepEqual(Object.keys(result), [
          "preparation",
          "session",
          "semanticJoinReceipt",
          "semanticLiveAdapterReceipt",
          "timing",
        ]);
        assert.equal(Object.isFrozen(result), true);
        assert.equal(Object.isFrozen(result.semanticLiveAdapterReceipt), true);
        assert.equal(result.preparation.semanticSnapshot.status, "ready");
        assert.equal(
          result.preparation.semanticSnapshot.activeGeneration?.claim.value
            .claimHash,
          fixture.claimValue.claimHash,
        );
        assert.equal(
          result.preparation.semanticSnapshot.activeGeneration?.receipt.value
            .receiptHash,
          fixture.receiptValue.receiptHash,
        );
        assert.equal(result.session.close.outcome, "accepted_read_only");
        assert.equal(result.session.close.nativeRecaptureEqual, true);
        assert.equal(result.session.close.terminal, true);
        assert.equal(
          result.semanticJoinReceipt.semanticSnapshotHash,
          result.preparation.semanticSnapshot.snapshotHash,
        );
        const receipt = result.semanticLiveAdapterReceipt;
        assert.equal(receipt.admissionScope, "test_fixture");
        assert.equal(receipt.productionAuthority, false);
        assert.equal(receipt.preparationHash, result.preparation.preparationHash);
        assert.equal(receipt.semanticJoinHash, result.semanticJoinReceipt.joinHash);
        assert.equal(
          receipt.semanticSnapshotHash,
          result.preparation.semanticSnapshot.snapshotHash,
        );
        assert.equal(
          receipt.sessionOccurrenceHash,
          result.session.open.sessionOccurrenceHash,
        );
        assert.equal(
          receipt.observationTranscriptHash,
          result.session.observation.transcriptHash,
        );
        assert.equal(
          receipt.finalTranscriptHash,
          result.session.close.finalTranscriptHash,
        );
        assert.equal(
          receipt.semanticAckSha256,
          result.preparation.acknowledgement.frameHash,
        );
        assert.equal(
          receipt.serializedAuthority,
          "self_asserted_replay_never_live_authority",
        );
        assert.equal(
          receipt.binaryExecutionAuthority,
          "pinned_descriptor_to_running_mapped_vnode_exact_object_observed_test_fixture",
        );
        assert.equal(
          receipt.descriptorRelativeReleaseProbeAuthority,
          "native_external_pid_descriptor_relative_exact_object_f_tlock_fixture_v2",
        );
        assert.match(receipt.releaseProbeHash, /^[a-f0-9]{64}$/u);
        assert.equal("pathProbeAuthority" in receipt, false);
        assert.equal(receipt.signingAuthority, "adhoc_or_unsigned_test_fixture");
        assert.equal(
          receipt.signatureAndAmfiAuthority,
          "unavailable_test_fixture",
        );
        const binaryStat = lstatSync(nativeBinary, { bigint: true });
        const pinnedBinding = receipt.pinnedBinaryDescriptorBinding;
        assert.deepEqual(Object.keys(pinnedBinding), [
          "schema",
          "version",
          "admissionScope",
          "productionAuthority",
          "descriptorAuthority",
          "filesystemScopeIdentityHash",
          "objectIdentity",
          "fingerprint",
          "contentEvidence",
          "descriptorBindingHash",
        ]);
        assert.equal(pinnedBinding.admissionScope, "test_fixture");
        assert.equal(pinnedBinding.productionAuthority, false);
        const physicalCensus =
          result.preparation.mapping.aggregateObservation.physicalCensus;
        assert.equal(
          receipt.globalPhysicalCensusFilesystemScopeIdentityHash,
          physicalCensus.filesystemScopeIdentityHash,
        );
        assert.equal(
          pinnedBinding.filesystemScopeIdentityHash,
          physicalCensus.filesystemScopeIdentityHash,
        );
        assert.equal(
          pinnedBinding.objectIdentity.filesystemScopeIdentityHash,
          physicalCensus.filesystemScopeIdentityHash,
        );
        assert.equal(pinnedBinding.objectIdentity.objectKind, "ordinary_file");
        assert.equal(
          pinnedBinding.objectIdentity.device,
          binaryStat.dev.toString(10),
        );
        assert.equal(
          pinnedBinding.objectIdentity.inode,
          binaryStat.ino.toString(10),
        );
        assert.equal(
          pinnedBinding.fingerprint.objectIdentityHash,
          pinnedBinding.objectIdentity.objectIdentityHash,
        );
        assert.equal(
          pinnedBinding.fingerprint.mode,
          (binaryStat.mode & 0o7777n).toString(8).padStart(4, "0"),
        );
        assert.equal(
          pinnedBinding.fingerprint.byteLength,
          Number(binaryStat.size),
        );
        assert.deepEqual(Object.keys(pinnedBinding.contentEvidence), [
          "schema",
          "version",
          "objectIdentityHash",
          "fingerprintHash",
          "hashAlgorithm",
          "byteLength",
          "contentHash",
          "contentEvidenceHash",
        ]);
        assert.equal(
          pinnedBinding.contentEvidence.objectIdentityHash,
          pinnedBinding.objectIdentity.objectIdentityHash,
        );
        assert.equal(
          pinnedBinding.contentEvidence.fingerprintHash,
          pinnedBinding.fingerprint.fingerprintHash,
        );
        assert.equal(pinnedBinding.contentEvidence.hashAlgorithm, "sha256");
        assert.equal(
          pinnedBinding.contentEvidence.byteLength,
          pinnedBinding.fingerprint.byteLength,
        );
        assert.equal(
          pinnedBinding.contentEvidence.contentHash,
          sha256V2(readFileSync(nativeBinary)).toString("hex"),
        );
        const {
          contentEvidenceHash,
          ...contentEvidenceIdentity
        } = pinnedBinding.contentEvidence;
        assert.equal(
          contentEvidenceHash,
          hashPlatformReleaseBootstrapNodeNativePinnedBinaryContentEvidenceV2(
            contentEvidenceIdentity,
          ),
        );
        assert.notEqual(
          contentEvidenceHash,
          hashPlatformReleaseBootstrapNodeNativePinnedBinaryContentEvidenceV2({
            ...contentEvidenceIdentity,
            contentHash: "0".repeat(64),
          }),
        );
        assert.equal(Object.isFrozen(pinnedBinding.objectIdentity), true);
        assert.equal(Object.isFrozen(pinnedBinding.fingerprint), true);
        assert.equal(Object.isFrozen(pinnedBinding.contentEvidence), true);
        const {
          descriptorBindingHash,
          ...pinnedBindingIdentity
        } = pinnedBinding;
        assert.equal(
          descriptorBindingHash,
          hashPlatformReleaseBootstrapNodeNativePinnedBinaryDescriptorBindingV2(
            pinnedBindingIdentity,
          ),
        );
        assert.notEqual(
          descriptorBindingHash,
          hashPlatformReleaseBootstrapNodeNativePinnedBinaryDescriptorBindingV2({
            ...pinnedBindingIdentity,
            contentEvidence: {
              ...pinnedBindingIdentity.contentEvidence,
              contentEvidenceHash: "0".repeat(64),
            },
          }),
        );
        assert.equal(
          receipt.nativeSemanticParsingStatus,
          "native_semantic_parsing_absent_ts_bridge_required",
        );
        assert.equal(
          receipt.terminalStatus,
          "terminal_accept_echo_authority_observed",
        );
        assert.equal(receipt.protocolEofStatus, "protocol_eof_observed");
        assert.equal(receipt.processExitStatus, "exit_zero_silent_observed");
        const {
          semanticLiveAdapterReceiptHash,
          ...receiptIdentity
        } = receipt;
        assert.equal(
          semanticLiveAdapterReceiptHash,
          hashPlatformReleaseBootstrapNodeNativeRecursiveSemanticLiveAdapterReceiptV2(
            receiptIdentity,
          ),
        );
        assert.equal(
          pairedLockProbeStatusV2(fixture.sharedLock, fixture.nodeLock),
          0,
        );
        assert.deepEqual(
          Object.keys(result).filter((key) =>
            /callback|hook|decision|descriptor|buffer|bytes|path|method/i
              .test(key)),
          [],
        );
        assert.equal(JSON.stringify(receipt).includes(fixture.parent), false);
        assert.equal(JSON.stringify(pinnedBinding).includes(nativeBinary), false);
      } finally {
        removeRecursiveFixtureNamespaceV2(fixture);
      }
    });

    it("rejects a symlink semantic binary path before observation", async () => {
      const fixture = makeSemanticReadyRecursiveFixtureNamespaceV2();
      const binarySymlink = path.join(fixture.parent, "native-binary-link-v2");
      try {
        symlinkSync(nativeBinary, binarySymlink);
        await assert.rejects(
          runPlatformReleaseBootstrapNodeNativeRecursiveSemanticLiveAdapterTestSupportV2({
            nativeBinaryPath: binarySymlink,
            parentPath: fixture.parent,
          }),
          /Semantic live adapter pre-observation physical boundary is invalid/,
        );
        assert.equal(
          pairedLockProbeStatusV2(fixture.sharedLock, fixture.nodeLock),
          0,
        );
      } finally {
        removeRecursiveFixtureNamespaceV2(fixture);
      }
    });

    it("rejects trailing protocol bytes and noisy nonzero settlement after semantic terminal", async () => {
      const cases = [
        {
          name: "trailing_protocol_byte",
          binary: semanticTrailingProtocolBinary,
          assertError(error: unknown): boolean {
            assert.equal(error instanceof TypeError, true);
            assert.match(
              (error as TypeError).message,
              /Live adapter protocol has trailing bytes after terminal/,
            );
            return true;
          },
        },
        {
          name: "forbidden_stderr_and_nonzero_exit",
          binary: semanticNoisyNonzeroBinary,
          assertError(error: unknown): boolean {
            assert.equal(error instanceof TypeError, true);
            assert.match(
              (error as TypeError).message,
              /Semantic live adapter child emitted forbidden output/,
            );
            assert.equal((error as TypeError).cause instanceof TypeError, true);
            assert.match(
              ((error as TypeError).cause as TypeError).message,
              /Semantic live child did not settle cleanly and silently/,
            );
            return true;
          },
        },
      ] as const;
      for (const fixtureCase of cases) {
        const fixture = makeSemanticReadyRecursiveFixtureNamespaceV2();
        const started = Date.now();
        try {
          await assert.rejects(
            runPlatformReleaseBootstrapNodeNativeRecursiveSemanticLiveAdapterTestSupportV2({
              nativeBinaryPath: fixtureCase.binary,
              parentPath: fixture.parent,
            }),
            fixtureCase.assertError,
          );
          assert.equal(Date.now() - started < 3_000, true, fixtureCase.name);
          assert.equal(
            pairedLockProbeStatusV2(fixture.sharedLock, fixture.nodeLock),
            0,
            fixtureCase.name,
          );
        } finally {
          removeRecursiveFixtureNamespaceV2(fixture);
        }
      }
    });

    it("rejects exact-child trailing, noisy-nonzero, and stopped-hang lifecycles with bounded reap", async () => {
      const cases = [
        {
          name: "exact_trailing_fd4",
          binary: exactTrailingProtocolBinary,
          error: /Exact release probe frame must be one LF-terminated line/,
          maximumMilliseconds: 3_000,
        },
        {
          name: "exact_stderr_exit9",
          binary: exactNoisyNonzeroBinary,
          error: /Exact release probe child did not settle cleanly and silently/,
          maximumMilliseconds: 3_000,
        },
        {
          name: "exact_both_held_hang",
          binary: exactStoppedHangBinary,
          error: /exact release probe fd4 frame timed out/,
          maximumMilliseconds: 12_000,
        },
      ] as const;
      for (const fixtureCase of cases) {
        const fixture = makeSemanticReadyRecursiveFixtureNamespaceV2();
        const started = Date.now();
        try {
          await assert.rejects(
            runPlatformReleaseBootstrapNodeNativeRecursiveSemanticLiveAdapterTestSupportV2({
              nativeBinaryPath: fixtureCase.binary,
              parentPath: fixture.parent,
            }),
            fixtureCase.error,
          );
          assert.equal(
            Date.now() - started < fixtureCase.maximumMilliseconds,
            true,
            fixtureCase.name,
          );
          assert.equal(
            pairedLockProbeStatusV2(fixture.sharedLock, fixture.nodeLock),
            0,
            fixtureCase.name,
          );
        } finally {
          removeRecursiveFixtureNamespaceV2(fixture);
        }
      }
    });

    it("rejects pinned binary fingerprint drift after terminal and clean delayed settlement", async () => {
      const fixture = makeSemanticReadyRecursiveFixtureNamespaceV2();
      const readyMarker = path.join(
        fixture.parent,
        semanticDelayedReadyMarker,
      );
      const releaseMarker = path.join(
        fixture.parent,
        semanticDelayedReleaseMarker,
      );
      const initialStat = lstatSync(semanticDelayedExitBinary, {
        bigint: true,
      });
      const initialMode = Number(initialStat.mode & 0o7777n);
      const driftMode = initialMode ^ 0o200;
      let lockObserver: RunningLockObserverV2 | undefined;
      let adapterRejection: Promise<void> | undefined;
      try {
        lockObserver = startPairedLockObserverV2(
          fixture.sharedLock,
          fixture.nodeLock,
        );
        await lockObserver.waitForReady();
        const adapterPromise =
          runPlatformReleaseBootstrapNodeNativeRecursiveSemanticLiveAdapterTestSupportV2({
            nativeBinaryPath: semanticDelayedExitBinary,
            parentPath: fixture.parent,
          });
        adapterRejection = assert.rejects(
          adapterPromise,
          /Semantic live pinned binary changed before post-settlement hashing/,
        );
        await lockObserver.waitForHeld();
        lockObserver = undefined;
        await waitForConditionV2(
          () => existsSync(readyMarker),
          "semantic delayed wrapper post-terminal marker",
        );
        assert.equal(
          pairedLockProbeStatusV2(fixture.sharedLock, fixture.nodeLock),
          0,
        );
        chmodSync(semanticDelayedExitBinary, driftMode);
        writeFileSync(releaseMarker, "release\n", {
          mode: 0o600,
          flag: "wx",
        });
        await adapterRejection;
        assert.equal(
          pairedLockProbeStatusV2(fixture.sharedLock, fixture.nodeLock),
          0,
        );
      } finally {
        if (lockObserver !== undefined) {
          lockObserver.child.kill("SIGKILL");
          await lockObserver.waitForExit().catch(() => undefined);
        }
        if (existsSync(readyMarker) && !existsSync(releaseMarker)) {
          writeFileSync(releaseMarker, "release\n", {
            mode: 0o600,
            flag: "wx",
          });
        }
        await adapterRejection?.catch(() => undefined);
        chmodSync(semanticDelayedExitBinary, initialMode);
        removeRecursiveFixtureNamespaceV2(fixture);
      }
    });

    it("rejects a delayed-semantic current-parent replacement before spawning the exact probe", async () => {
      const fixture = makeSemanticReadyRecursiveFixtureNamespaceV2();
      const renamedParent = `${fixture.parent}.semantic-pinned-original`;
      const readyMarker = path.join(
        fixture.parent,
        semanticDelayedReadyMarker,
      );
      let adapterRejection: Promise<void> | undefined;
      try {
        const adapterPromise =
          runPlatformReleaseBootstrapNodeNativeRecursiveSemanticLiveAdapterTestSupportV2({
            nativeBinaryPath: semanticDelayedExitBinary,
            parentPath: fixture.parent,
          });
        adapterRejection = assert.rejects(
          adapterPromise,
          /Semantic live identities changed before release probe/,
        );
        await waitForConditionV2(
          () => existsSync(readyMarker),
          "semantic delayed parent replacement marker",
        );
        renameSync(fixture.parent, renamedParent);
        mkdirSync(fixture.parent, { mode: 0o755 });
        writeFileSync(fixture.sharedLock, sharedLockBytes, {
          mode: 0o600,
          flag: "wx",
        });
        writeFileSync(fixture.nodeLock, nodeLockBytes, {
          mode: 0o600,
          flag: "wx",
        });
        writeFileSync(
          path.join(renamedParent, semanticDelayedReleaseMarker),
          "release\n",
          { mode: 0o600, flag: "wx" },
        );
        await adapterRejection;
        assert.equal(
          pairedLockProbeStatusV2(fixture.sharedLock, fixture.nodeLock),
          0,
        );
        assert.equal(
          pairedLockProbeStatusV2(
            path.join(renamedParent, sharedLockBasename),
            path.join(renamedParent, nodeLockBasename),
          ),
          0,
        );
      } finally {
        if (
          existsSync(renamedParent)
          && !existsSync(path.join(renamedParent, semanticDelayedReleaseMarker))
        ) {
          writeFileSync(
            path.join(renamedParent, semanticDelayedReleaseMarker),
            "release\n",
            { mode: 0o600, flag: "wx" },
          );
        }
        await adapterRejection?.catch(() => undefined);
        rmSync(fixture.parent, { recursive: true, force: true });
        for (const relative of [
          "node-toolchain-provisioner-v2/runtime",
          "node-toolchain-provisioner-v2/lib",
          "node-toolchain-provisioner-v2/bin",
          "node-toolchain-provisioner-v2",
          "",
        ]) {
          const candidate = path.join(renamedParent, relative);
          if (existsSync(candidate)) chmodSync(candidate, 0o700);
        }
        rmSync(renamedParent, { recursive: true, force: true });
      }
    });

    it("kills and reaps incomplete or noncanonical recursive semantic state before ACK_ACCEPT and releases both locks", async () => {
      const cases = [
        {
          name: "layout_not_exact",
          make(): FixtureNamespaceV2 {
            const fixture = makeFixtureNamespaceV2();
            chmodSync(fixture.parent, 0o755);
            return fixture;
          },
          cleanup(fixture: FixtureNamespaceV2): void {
            rmSync(fixture.alias, { recursive: true, force: true });
          },
        },
        {
          name: "noncanonical_active_claim",
          make(): FixtureNamespaceV2 {
            const fixture = makeSemanticReadyRecursiveFixtureNamespaceV2();
            chmodSync(fixture.payload, 0o600);
            writeFileSync(fixture.payload, "{\n}\n");
            chmodSync(fixture.payload, 0o444);
            return fixture;
          },
          cleanup(fixture: FixtureNamespaceV2): void {
            removeRecursiveFixtureNamespaceV2(
              fixture as SemanticReadyRecursiveFixtureNamespaceV2,
            );
          },
        },
      ] as const;
      for (const fixtureCase of cases) {
        const fixture = fixtureCase.make();
        const started = Date.now();
        try {
          await assert.rejects(
            runPlatformReleaseBootstrapNodeNativeRecursiveSemanticLiveAdapterTestSupportV2({
              nativeBinaryPath: nativeBinary,
              parentPath: fixture.parent,
            }),
          );
          assert.equal(Date.now() - started < 3_000, true, fixtureCase.name);
          assert.equal(
            pairedLockProbeStatusV2(fixture.sharedLock, fixture.nodeLock),
            0,
            fixtureCase.name,
          );
        } finally {
          fixtureCase.cleanup(fixture);
        }
      }
    });

    it("rejects stderr overflow and an early binary exit within a bounded cleanup", async () => {
      for (const candidate of [
        {
          binary: stderrOverflowBinary,
          error: /stderr exceeded its exact byte bound/,
        },
        {
          binary: "/usr/bin/true",
          error: /protocol ended during OPEN frame|OPEN frame failed/,
        },
      ]) {
        const fixture = makeFixtureNamespaceV2();
        const started = Date.now();
        try {
          await assert.rejects(
            runPlatformReleaseBootstrapNodeNativeLiveAdapterTestSupportV2({
              nativeBinaryPath: candidate.binary,
              parentPath: fixture.parent,
            }),
            candidate.error,
          );
          assert.equal(Date.now() - started < 3_000, true);
          assert.equal(
            pairedLockProbeStatusV2(fixture.sharedLock, fixture.nodeLock),
            0,
          );
        } finally {
          rmSync(fixture.alias, { recursive: true, force: true });
        }
      }
    });

    it("rejects a foreign live challenge without terminal authority and releases both locks", async () => {
      const fixture = makeFixtureNamespaceV2();
      let running: RunningNativeV2 | undefined;
      try {
        running = startNativeV2(fixture.parent, "session_live\n");
        const observation = await readLiveObservationV2(running, fixture);
        const foreignChallenge = Buffer.from(observation.challenge);
        foreignChallenge[0] ^= 0xff;
        running.protocol.end(encodeAckV2(
          protocolAckAcceptType,
          foreignChallenge,
          observation.aggregateSha256,
          sha256V2("foreign-challenge-semantic-ack-v2"),
        ));

        await expectLiveFailureWithoutTerminalV2(running);
        running = undefined;
        assert.equal(
          pairedLockProbeStatusV2(fixture.sharedLock, fixture.nodeLock),
          0,
        );
      } finally {
        if (running !== undefined) {
          running.child.kill("SIGKILL");
          await running.waitForExit().catch(() => undefined);
        }
        rmSync(fixture.alias, { recursive: true, force: true });
      }
    });

    it("rejects partial and trailing live ACK bytes without terminal authority", async () => {
      for (const malformed of ["partial", "trailing"] as const) {
        const fixture = makeFixtureNamespaceV2();
        let running: RunningNativeV2 | undefined;
        try {
          running = startNativeV2(fixture.parent, "session_live\n");
          const observation = await readLiveObservationV2(running, fixture);
          const complete = encodeAckV2(
            protocolAckAcceptType,
            observation.challenge,
            observation.aggregateSha256,
            sha256V2(`live-${malformed}-semantic-ack-v2`),
          );
          running.protocol.end(
            malformed === "partial"
              ? complete.subarray(0, 23)
              : Buffer.concat([complete, Buffer.from([0x7f])]),
          );

          await expectLiveFailureWithoutTerminalV2(running);
          running = undefined;
          assert.equal(
            pairedLockProbeStatusV2(fixture.sharedLock, fixture.nodeLock),
            0,
          );
        } finally {
          if (running !== undefined) {
            running.child.kill("SIGKILL");
            await running.waitForExit().catch(() => undefined);
          }
          rmSync(fixture.alias, { recursive: true, force: true });
        }
      }
    });

    it("rejects same-byte inode replacement before live accept without terminal authority", async () => {
      const fixture = makeFixtureNamespaceV2();
      let running: RunningNativeV2 | undefined;
      try {
        const prior = lstatSync(fixture.payload, { bigint: true });
        running = startNativeV2(fixture.parent, "session_live\n");
        const observation = await readLiveObservationV2(running, fixture);
        assert.notEqual(lockContenderStatusV2(fixture.sharedLock), 0);
        assert.notEqual(lockContenderStatusV2(fixture.nodeLock), 0);
        const replacement = path.join(
          fixture.parent,
          "replacement-before-live-accept.tmp",
        );
        writeFileSync(
          replacement,
          "{\"payload\":\"same-byte-replacement\"}\n",
          { mode: 0o600, flag: "wx" },
        );
        renameSync(replacement, fixture.payload);
        const next = lstatSync(fixture.payload, { bigint: true });
        assert.notEqual(next.ino, prior.ino);
        running.protocol.end(encodeAckV2(
          protocolAckAcceptType,
          observation.challenge,
          observation.aggregateSha256,
          sha256V2("live-drift-semantic-ack-v2"),
        ));

        await expectLiveFailureWithoutTerminalV2(running);
        assert.match(
          running.stderr(),
          /parent_changed|entry_changed|membership_changed/,
        );
        running = undefined;
        assert.equal(
          pairedLockProbeStatusV2(fixture.sharedLock, fixture.nodeLock),
          0,
        );
      } finally {
        if (running !== undefined) {
          running.child.kill("SIGKILL");
          await running.waitForExit().catch(() => undefined);
        }
        rmSync(fixture.alias, { recursive: true, force: true });
      }
    });

    it("releases both live lockf leases on SIGKILL while awaiting the only ACK", async () => {
      const fixture = makeFixtureNamespaceV2();
      let running: RunningNativeV2 | undefined;
      try {
        running = startNativeV2(fixture.parent, "session_live\n");
        await readLiveObservationV2(running, fixture);
        assert.notEqual(lockContenderStatusV2(fixture.sharedLock), 0);
        assert.notEqual(lockContenderStatusV2(fixture.nodeLock), 0);
        assert.equal(running.stdout().byteLength, 0);
        const noTerminal = assert.rejects(running.protocolReader.readFrame());
        assert.equal(running.child.kill("SIGKILL"), true);
        const exit = await running.waitForExit();
        await noTerminal;
        await running.protocolReader.expectEnd();
        assert.deepEqual(exit, { code: null, signal: "SIGKILL" });
        assert.equal(running.stdout().byteLength, 0);
        running = undefined;
        assert.equal(
          pairedLockProbeStatusV2(fixture.sharedLock, fixture.nodeLock),
          0,
        );
      } finally {
        if (running !== undefined) {
          running.child.kill("SIGKILL");
          await running.waitForExit().catch(() => undefined);
        }
        rmSync(fixture.alias, { recursive: true, force: true });
      }
    });
  },
);
