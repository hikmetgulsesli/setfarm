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
  opendirSync,
  readSync,
  realpathSync,
  rmdirSync,
  unlinkSync,
  writeSync,
  type BigIntStats,
  type Stats,
} from "node:fs";
import path from "node:path";
import { isProxy } from "node:util/types";

import { hashCanonicalJson } from "./canonical-json.js";
import {
  matchesExactStableFilesystemObjectV2,
} from "./exact-stable-filesystem-identity-v2.js";
import {
  HostNodeToolchainAuthorityErrorV2,
  acquireHostNodeRuntimeLaunchContextInternalV2,
  inspectHostNodeToolchainReceiptV2,
  isProductionHostNodeToolchainAuthorityV2,
  executeHostNodeToolchainNpmCiV2,
  executeHostNodeToolchainCandidateProductionNpmCiV2,
  executeHostNodeToolchainBuildV2,
  probeHostNodeToolchainEffectiveNpmConfigV2,
  revalidateHostNodeToolchainAuthorityV2,
  type HostNodeToolchainAuthorityV2,
  type HostNodeToolchainEffectiveNpmConfigProbeEvidenceV2,
  type HostNodeToolchainEffectiveNpmConfigProbeInputV2,
  type HostNodeToolchainNpmCiEvidenceV2,
  type HostNodeToolchainCandidateProductionNpmCiEvidenceV2,
  type HostNodeToolchainBuildEvidenceV2,
  type HostNodeRuntimeLaunchContextInternalV2,
} from "./host-node-toolchain-authority-v2.js";
import type {
  MaterializedNodeScaffoldPrivateStageV2,
} from "./node-scaffold-private-materializer-v2.js";
import {
  getCodeOwnedNodeScaffoldToolchainCatalogV2,
  getCodeOwnedNodeScaffoldToolchainEntryV2,
  type NodeScaffoldProfileIdV2,
} from "./node-scaffold-toolchain-catalog-v2.js";
import {
  EFFECTIVE_NPM_CONFIG_RECEIPT_V2_SCHEMA,
  EffectiveNpmConfigReceiptV2Schema,
  NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_AUTHORITY_REF_V2,
  NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_RECEIPT_V2_SCHEMA,
  NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_VARIABLE_NAMES_V2,
  NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_VERSION_V2,
  NODE_SCAFFOLD_PRIVATE_NPMRC_CONTENT_HASH_V2,
  NodeScaffoldExecutionEnvironmentReceiptV2Schema,
  hashEffectiveNpmConfigReceiptV2,
  hashEffectiveNpmConfigV2,
  hashNodeScaffoldExecutionEnvironmentReceiptV2,
  hashPrivateNpmrcIdentityV2,
  type EffectiveNpmConfigReceiptHashPayloadV2,
  type EffectiveNpmConfigReceiptV2,
  type NodeScaffoldExecutionEnvironmentReceiptHashPayloadV2,
  type NodeScaffoldExecutionEnvironmentReceiptV2,
  type PrivateNpmrcIdentityV2,
} from "./schemas/node-scaffold-execution-environment-v2.js";
import {
  HOST_NODE_TOOLCHAIN_AUTHORITY_REF_V2,
  HOST_NODE_TOOLCHAIN_RECEIPT_V2_SCHEMA,
  projectHostNodeToolchainLogicalIdentityV3,
  type HostNodeToolchainLogicalProjectionV3,
  type HostNodeToolchainReceiptV2,
} from "./schemas/host-node-toolchain-receipt-v2.js";
import {
  NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_REF_V2,
  NODE_SCAFFOLD_TOOLCHAIN_CATALOG_V2_SCHEMA,
  NODE_SCAFFOLD_TOOLCHAIN_ENTRY_V2_SCHEMA,
} from "./schemas/node-scaffold-toolchain-catalog-v2.js";

const PRODUCTION_PRIVATE_ROOT_PREFIX_V2 =
  "/private/tmp/setfarm-node-scaffold-environment-v2-" as const;
const PRIVATE_LAYOUT_NAMES_V2 = Object.freeze([
  "cache",
  "config-probe",
  "global.npmrc",
  "home",
  "tmp",
  "user.npmrc",
] as const);

export type NodeScaffoldExecutionEnvironmentErrorCodeV2 =
  | "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_INPUT_INVALID"
  | "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_PRODUCTION_AUTHORITY_REQUIRED"
  | "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_HOST_AUTHORITY_INVALID"
  | "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_PRIVATE_ROOT_INVALID"
  | "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_MATERIALIZATION_FAILED"
  | "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_EFFECTIVE_CONFIG_INVALID"
  | "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_RECEIPT_INVALID"
  | "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_HANDLE_UNAUTHENTICATED"
  | "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_STATE_DRIFT"
  | "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_INSTALL_ALREADY_CONSUMED"
  | "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_BUILD_ALREADY_CONSUMED"
  | "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_OPERATION_ROLE_INVALID"
  | "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_RUNTIME_HANDOFF_ALREADY_CONSUMED"
  | "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_RUNTIME_INSTALL_ALREADY_CONSUMED"
  | "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_DESTROYED";

export class NodeScaffoldExecutionEnvironmentErrorV2 extends Error {
  readonly code: NodeScaffoldExecutionEnvironmentErrorCodeV2;
  override readonly cause?: unknown;

  constructor(
    code: NodeScaffoldExecutionEnvironmentErrorCodeV2,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message.slice(0, 1_500), options);
    this.name = "NodeScaffoldExecutionEnvironmentErrorV2";
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

type PrivateCleanupObjectKindV2 =
  | "directory"
  | "ordinary_file"
  | "symbolic_link";

type PrivateCleanupMemberV2 = Readonly<{
  locator: string;
  objectKind: PrivateCleanupObjectKindV2;
  device: string;
  inode: string;
  ownerUid: string;
  ownerGid: string;
}>;

type PrivateCleanupCensusV2 = Readonly<{
  members: readonly PrivateCleanupMemberV2[];
}>;

type PrivateMaterializationCaptureV2 = Readonly<{
  privateRoot: string;
  rootFingerprint: FingerprintV2;
  rootIdentityHash: string;
  ownerUid: number;
  ownerGid: number;
  userNpmrc: PrivateNpmrcIdentityV2;
  globalNpmrc: PrivateNpmrcIdentityV2;
  cleanupCensus: PrivateCleanupCensusV2;
  privateIdentityHash: string;
}>;

type MutableLifecycleV2 = {
  status:
    | "active"
    | "installing"
    | "install_consumed"
    | "install_failed"
    | "building"
    | "build_consumed"
    | "runtime_handoff_claimed"
    | "runtime_handoff_consumed"
    | "destroyed";
  cleanupCensus: PrivateCleanupCensusV2;
};

type PrivateEnvironmentStateV2 = Readonly<{
  admissionScope: "production_host" | "test_fixture";
  profileId: NodeScaffoldProfileIdV2;
  operationRole: "scaffold_build" | "candidate_runtime_install";
  hostToolchain: HostNodeToolchainAuthorityV2;
  privateRoot: string;
  probeInput: HostNodeToolchainEffectiveNpmConfigProbeInputV2;
  materialization: PrivateMaterializationCaptureV2;
  probeEvidence: HostNodeToolchainEffectiveNpmConfigProbeEvidenceV2;
  effectiveNpmConfigReceipt: EffectiveNpmConfigReceiptV2;
  receipt: NodeScaffoldExecutionEnvironmentReceiptV2;
  lifecycle: MutableLifecycleV2;
  cleanupTestHooks?: NodeScaffoldExecutionEnvironmentTestHooksV2;
}>;

const environmentConstructorCapabilityV2 = Object.freeze({});
const privateEnvironmentStateV2 = new WeakMap<object, PrivateEnvironmentStateV2>();

export class NodeScaffoldExecutionEnvironmentV2 {
  readonly receiptHash: string;

  constructor(capability: object, state: PrivateEnvironmentStateV2) {
    if (capability !== environmentConstructorCapabilityV2) {
      throw new NodeScaffoldExecutionEnvironmentErrorV2(
        "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_HANDLE_UNAUTHENTICATED",
        "Execution environment constructor capability is unavailable",
      );
    }
    this.receiptHash = state.receipt.receiptHash;
    privateEnvironmentStateV2.set(this, state);
    Object.freeze(this);
  }
}

function fail(
  code: NodeScaffoldExecutionEnvironmentErrorCodeV2,
  message: string,
  cause?: unknown,
): never {
  throw new NodeScaffoldExecutionEnvironmentErrorV2(
    code,
    message,
    cause === undefined ? undefined : { cause },
  );
}

function runWithIndependentFinalizersV2<T>(input: Readonly<{
  operation: () => T;
  finalizers: readonly (() => void)[];
  onFinalizerFailure: (errors: readonly unknown[]) => never;
}>): T {
  const primaryErrors: unknown[] = [];
  let result: T | undefined;
  try {
    result = input.operation();
  } catch (error) {
    primaryErrors.push(error);
  }
  const finalizerErrors: unknown[] = [];
  for (const finalizer of input.finalizers) {
    try {
      finalizer();
    } catch (error) {
      finalizerErrors.push(error);
    }
  }
  if (finalizerErrors.length > 0) {
    return input.onFinalizerFailure([...primaryErrors, ...finalizerErrors]);
  }
  if (primaryErrors.length > 0) throw primaryErrors[0];
  return result as T;
}

function readBoundedDirectoryNamesV2(input: Readonly<{
  absolutePath: string;
  locator: string;
  maxNames: number;
  errorCode: NodeScaffoldExecutionEnvironmentErrorCodeV2;
  beforeRead?: () => void;
  afterClose?: () => void;
}>): readonly string[] {
  const names: string[] = [];
  const directory = opendirSync(input.absolutePath);
  return runWithIndependentFinalizersV2({
    operation: () => {
      input.beforeRead?.();
      let entry = directory.readSync();
      while (entry !== null) {
        names.push(entry.name);
        if (names.length > input.maxNames) {
          return fail(
            input.errorCode,
            `Directory ${input.locator} exceeded its fixed membership bound`,
          );
        }
        entry = directory.readSync();
      }
      return names.sort();
    },
    finalizers: [() => {
      directory.closeSync();
      input.afterClose?.();
    }],
    onFinalizerFailure: (errors) => fail(
      input.errorCode,
      `Directory ${input.locator} read or descriptor close failed`,
      new AggregateError(
        errors,
        `Directory ${input.locator} read and descriptor finalization failures`,
      ),
    ),
  });
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function modeBits(stat: Stats): number {
  return stat.mode & 0o7777;
}

function modeText(stat: Stats): string {
  return modeBits(stat).toString(8).padStart(4, "0");
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

function assertExactPrivateRootStableIdentityV2(
  privateRoot: string,
  expected: FingerprintV2,
): void {
  let stat: BigIntStats;
  try {
    stat = lstatSync(privateRoot, { bigint: true });
  } catch (error) {
    return fail(
      "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_STATE_DRIFT",
      "Private execution environment root identity could not be captured exactly before destruction",
      error,
    );
  }
  if (
    !matchesExactStableFilesystemObjectV2({
      stat,
      expected,
      objectKind: "directory",
    })
    || stat.uid !== BigInt(expected.ownerUid)
    || stat.gid !== BigInt(expected.ownerGid)
  ) {
    return fail(
      "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_STATE_DRIFT",
      "Refusing to destroy a private execution environment root with changed exact identity",
    );
  }
}

const PRIVATE_CLEANUP_MAX_MEMBERS_V2 = 65_536 as const;
const PRIVATE_CLEANUP_MAX_DEPTH_V2 = 64 as const;

function privateCleanupObjectKindV2(
  stat: BigIntStats,
): PrivateCleanupObjectKindV2 | undefined {
  if (stat.isSymbolicLink()) return "symbolic_link";
  if (stat.isDirectory()) return "directory";
  if (stat.isFile()) return "ordinary_file";
  return undefined;
}

function capturePrivateCleanupMemberV2(
  absolutePath: string,
  locator: string,
  ownerUid: string,
  ownerGid: string,
): PrivateCleanupMemberV2 {
  const stat = lstatSync(absolutePath, { bigint: true });
  const objectKind = privateCleanupObjectKindV2(stat);
  if (
    objectKind === undefined
    || String(stat.uid) !== ownerUid
    || String(stat.gid) !== ownerGid
  ) {
    return fail(
      "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_STATE_DRIFT",
      `Private cleanup member ${locator} has a forbidden kind or ownership`,
    );
  }
  return Object.freeze({
    locator,
    objectKind,
    device: String(stat.dev),
    inode: String(stat.ino),
    ownerUid: String(stat.uid),
    ownerGid: String(stat.gid),
  });
}

function boundedPrivateCleanupNamesV2(
  absoluteDirectory: string,
  locator: string,
  hooks?: NodeScaffoldExecutionEnvironmentTestHooksV2,
): readonly string[] {
  return readBoundedDirectoryNamesV2({
    absolutePath: absoluteDirectory,
    locator,
    maxNames: PRIVATE_CLEANUP_MAX_MEMBERS_V2,
    errorCode: "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_STATE_DRIFT",
    beforeRead: () => hooks?.beforeCleanupCensusDirectoryRead?.(locator),
    afterClose: () => hooks?.afterCleanupCensusDirectoryClose?.(locator),
  });
}

function capturePrivateCleanupCensusV2(
  privateRoot: string,
  hooks?: NodeScaffoldExecutionEnvironmentTestHooksV2,
): PrivateCleanupCensusV2 {
  const rootStat = lstatSync(privateRoot, { bigint: true });
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
    return fail(
      "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_STATE_DRIFT",
      "Private cleanup root is not one direct directory",
    );
  }
  const ownerUid = String(rootStat.uid);
  const ownerGid = String(rootStat.gid);
  const members: PrivateCleanupMemberV2[] = [];
  const visit = (absolutePath: string, locator: string, depth: number): void => {
    if (
      depth > PRIVATE_CLEANUP_MAX_DEPTH_V2
      || Buffer.byteLength(locator, "utf8") > 4_096
      || members.length >= PRIVATE_CLEANUP_MAX_MEMBERS_V2
    ) {
      return fail(
        "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_STATE_DRIFT",
        "Private cleanup census exceeded its fixed path or membership bound",
      );
    }
    const member = capturePrivateCleanupMemberV2(
      absolutePath,
      locator,
      ownerUid,
      ownerGid,
    );
    members.push(member);
    if (member.objectKind !== "directory") return;
    for (const name of boundedPrivateCleanupNamesV2(absolutePath, locator, hooks)) {
      visit(
        path.join(absolutePath, name),
        locator === "." ? name : `${locator}/${name}`,
        depth + 1,
      );
    }
  };
  visit(privateRoot, ".", 0);
  return Object.freeze({
    members: Object.freeze(members.sort((left, right) =>
      left.locator < right.locator ? -1 : left.locator > right.locator ? 1 : 0)),
  });
}

function extendPrivateCleanupCensusWithCreatedMemberV2(input: Readonly<{
  privateRoot: string;
  current: PrivateCleanupCensusV2 | undefined;
  absolutePath: string;
  locator: string;
}>): PrivateCleanupCensusV2 {
  if (input.current?.members.some((member) => member.locator === input.locator)) {
    return fail(
      "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_STATE_DRIFT",
      `Private cleanup journal already contains ${input.locator}`,
    );
  }
  if (
    input.locator !== "."
    && !input.current?.members.some((member) => member.locator === ".")
  ) {
    return fail(
      "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_STATE_DRIFT",
      `Private cleanup journal lacks its root before adding ${input.locator}`,
    );
  }
  if ((input.current?.members.length ?? 0) >= PRIVATE_CLEANUP_MAX_MEMBERS_V2) {
    return fail(
      "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_STATE_DRIFT",
      "Private cleanup journal exceeded its fixed membership bound",
    );
  }
  const root = input.current?.members.find((member) => member.locator === ".");
  const rootStat = root === undefined
    ? lstatSync(input.privateRoot, { bigint: true })
    : undefined;
  const member = capturePrivateCleanupMemberV2(
    input.absolutePath,
    input.locator,
    root?.ownerUid ?? String(rootStat!.uid),
    root?.ownerGid ?? String(rootStat!.gid),
  );
  return Object.freeze({
    members: Object.freeze([
      ...(input.current?.members ?? []),
      member,
    ].sort((left, right) =>
      left.locator < right.locator ? -1 : left.locator > right.locator ? 1 : 0)),
  });
}

function samePrivateCleanupCensusV2(
  left: PrivateCleanupCensusV2,
  right: PrivateCleanupCensusV2,
): boolean {
  return left.members.length === right.members.length
    && left.members.every((member, index) => {
      const expected = right.members[index];
      return expected !== undefined
        && member.locator === expected.locator
        && member.objectKind === expected.objectKind
        && member.device === expected.device
        && member.inode === expected.inode
        && member.ownerUid === expected.ownerUid
        && member.ownerGid === expected.ownerGid;
    });
}

function assertPrivateCleanupMemberV2(
  privateRoot: string,
  expected: PrivateCleanupMemberV2,
): string {
  const absolutePath = expected.locator === "."
    ? privateRoot
    : path.join(privateRoot, ...expected.locator.split("/"));
  const current = capturePrivateCleanupMemberV2(
    absolutePath,
    expected.locator,
    expected.ownerUid,
    expected.ownerGid,
  );
  if (!samePrivateCleanupCensusV2(
    { members: [current] },
    { members: [expected] },
  )) {
    return fail(
      "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_STATE_DRIFT",
      `Private cleanup member ${expected.locator} changed before removal`,
    );
  }
  return absolutePath;
}

function makePrivateCleanupDirectoryWritableV2(
  privateRoot: string,
  expected: PrivateCleanupMemberV2,
  hooks?: NodeScaffoldExecutionEnvironmentTestHooksV2,
  onModeChange?: (entry: Readonly<{
    expected: PrivateCleanupMemberV2;
    originalMode: number;
  }>) => void,
): void {
  const absolutePath = assertPrivateCleanupMemberV2(privateRoot, expected);
  let descriptor: number | undefined;
  const operationErrors: unknown[] = [];
  try {
    descriptor = openSync(
      absolutePath,
      constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
    );
    const stat = fstatSync(descriptor, { bigint: true });
    if (
      !stat.isDirectory()
      || String(stat.dev) !== expected.device
      || String(stat.ino) !== expected.inode
      || String(stat.uid) !== expected.ownerUid
      || String(stat.gid) !== expected.ownerGid
    ) {
      return fail(
        "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_STATE_DRIFT",
        `Private cleanup directory ${expected.locator} changed before descriptor-bound chmod`,
      );
    }
    const originalMode = Number(stat.mode & 0o7777n);
    if (originalMode !== 0o700) {
      onModeChange?.(Object.freeze({ expected, originalMode }));
      fchmodSync(descriptor, 0o700);
    }
    hooks?.afterCleanupDirectoryWritable?.(expected.locator);
  } catch (error) {
    operationErrors.push(error);
  }
  const closeErrors: unknown[] = [];
  if (descriptor !== undefined) {
    try {
      closeSync(descriptor);
      hooks?.afterCleanupDirectoryDescriptorClose?.(expected.locator);
    } catch (error) {
      closeErrors.push(error);
    }
  }
  if (operationErrors.length === 1 && closeErrors.length === 0) {
    const [operationError] = operationErrors;
    if (operationError instanceof NodeScaffoldExecutionEnvironmentErrorV2) {
      throw operationError;
    }
    return fail(
      "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_STATE_DRIFT",
      `Private cleanup directory ${expected.locator} could not be made writable through its exact descriptor`,
      operationError,
    );
  }
  const errors = [...operationErrors, ...closeErrors];
  if (errors.length > 0) {
    return fail(
      "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_STATE_DRIFT",
      `Private cleanup directory ${expected.locator} mutation or descriptor close failed`,
      errors.length === 1
        ? errors[0]
        : new AggregateError(
          errors,
          "Private cleanup directory mutation and descriptor close both failed",
        ),
    );
  }
  assertPrivateCleanupMemberV2(privateRoot, expected);
}

function restorePrivateCleanupDirectoryModeV2(
  privateRoot: string,
  entry: Readonly<{
    expected: PrivateCleanupMemberV2;
    originalMode: number;
  }>,
): void {
  const absolutePath = entry.expected.locator === "."
    ? privateRoot
    : path.join(privateRoot, ...entry.expected.locator.split("/"));
  try {
    lstatSync(absolutePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  let descriptor: number | undefined;
  return runWithIndependentFinalizersV2({
    operation: () => {
      descriptor = openSync(
        absolutePath,
        constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
      );
      const before = fstatSync(descriptor, { bigint: true });
      if (
        !before.isDirectory()
        || String(before.dev) !== entry.expected.device
        || String(before.ino) !== entry.expected.inode
        || String(before.uid) !== entry.expected.ownerUid
        || String(before.gid) !== entry.expected.ownerGid
      ) {
        return fail(
          "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_STATE_DRIFT",
          `Private cleanup directory ${entry.expected.locator} changed before mode restoration`,
        );
      }
      fchmodSync(descriptor, entry.originalMode);
      const after = fstatSync(descriptor, { bigint: true });
      const pathAfter = lstatSync(absolutePath, { bigint: true });
      if (
        String(after.dev) !== entry.expected.device
        || String(after.ino) !== entry.expected.inode
        || String(pathAfter.dev) !== entry.expected.device
        || String(pathAfter.ino) !== entry.expected.inode
        || Number(after.mode & 0o7777n) !== entry.originalMode
        || Number(pathAfter.mode & 0o7777n) !== entry.originalMode
      ) {
        return fail(
          "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_STATE_DRIFT",
          `Private cleanup directory ${entry.expected.locator} did not retain its original mode`,
        );
      }
    },
    finalizers: [() => {
      if (descriptor !== undefined) closeSync(descriptor);
    }],
    onFinalizerFailure: (errors) => fail(
      "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_STATE_DRIFT",
      `Private cleanup directory ${entry.expected.locator} mode restore or descriptor close failed`,
      new AggregateError(
        errors,
        "Private cleanup directory mode restoration and descriptor finalization failures",
      ),
    ),
  });
}

function destroyPrivateCleanupCensusV2(
  privateRoot: string,
  expected: PrivateCleanupCensusV2,
  hooks?: NodeScaffoldExecutionEnvironmentTestHooksV2,
): void {
  const modeJournal = new Map<string, Readonly<{
    expected: PrivateCleanupMemberV2;
    originalMode: number;
  }>>();
  const primaryErrors: unknown[] = [];
  try {
    const current = capturePrivateCleanupCensusV2(privateRoot, hooks);
    if (!samePrivateCleanupCensusV2(current, expected)) {
      return fail(
        "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_STATE_DRIFT",
        "Private cleanup census no longer equals every-and-only captured membership",
      );
    }
    const directories = expected.members.filter((member) =>
      member.objectKind === "directory");
    for (const directory of directories) {
      makePrivateCleanupDirectoryWritableV2(
        privateRoot,
        directory,
        hooks,
        (entry) => modeJournal.set(entry.expected.locator, entry),
      );
    }
    for (const leaf of expected.members.filter((member) =>
      member.objectKind !== "directory")) {
      const absolutePath = assertPrivateCleanupMemberV2(privateRoot, leaf);
      unlinkSync(absolutePath);
      assertMissingPathV2(absolutePath, `Destroyed private cleanup member ${leaf.locator}`);
    }
    const deepestFirst = directories.slice().sort((left, right) =>
      (right.locator === "." ? 0 : right.locator.split("/").length)
        - (left.locator === "." ? 0 : left.locator.split("/").length));
    for (const directory of deepestFirst) {
      const absolutePath = assertPrivateCleanupMemberV2(privateRoot, directory);
      if (readBoundedDirectoryNamesV2({
        absolutePath,
        locator: directory.locator,
        maxNames: 0,
        errorCode: "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_STATE_DRIFT",
      }).length !== 0) {
        return fail(
          "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_STATE_DRIFT",
          `Private cleanup directory ${directory.locator} is not empty`,
        );
      }
      rmdirSync(absolutePath);
      assertMissingPathV2(
        absolutePath,
        `Destroyed private cleanup directory ${directory.locator}`,
      );
    }
  } catch (error) {
    primaryErrors.push(error);
  }
  const restoreErrors: unknown[] = [];
  for (const entry of [...modeJournal.values()].reverse()) {
    try {
      restorePrivateCleanupDirectoryModeV2(privateRoot, entry);
    } catch (error) {
      restoreErrors.push(error);
    }
  }
  if (restoreErrors.length > 0) {
    return fail(
      "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_STATE_DRIFT",
      "Private cleanup could not restore every surviving directory mode",
      new AggregateError(
        [...primaryErrors, ...restoreErrors],
        "Private cleanup operation and directory mode restoration failures",
      ),
    );
  }
  if (primaryErrors.length > 0) throw primaryErrors[0];
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value) || isProxy(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactRecordKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Reflect.ownKeys(value);
  return keys.every((key) => typeof key === "string")
    && keys.length === expected.length
    && [...keys as string[]].sort().every((key, index) => key === [...expected].sort()[index]);
}

function processOwnerV2(): Readonly<{ uid: number; gid: number }> {
  if (typeof process.geteuid !== "function" || typeof process.getegid !== "function") {
    return fail(
      "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_PRIVATE_ROOT_INVALID",
      "Execution environment authority requires exact POSIX process ownership",
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

function syncDirectoryV2(absolutePath: string): void {
  let descriptor: number | undefined;
  return runWithIndependentFinalizersV2({
    operation: () => {
      descriptor = openSync(absolutePath, constants.O_RDONLY);
      fsyncSync(descriptor);
    },
    finalizers: [() => {
      if (descriptor !== undefined) closeSync(descriptor);
    }],
    onFinalizerFailure: (errors) => fail(
      "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_MATERIALIZATION_FAILED",
      `Private directory ${absolutePath} sync or descriptor close failed`,
      new AggregateError(errors, "Private directory sync and descriptor finalization failures"),
    ),
  });
}

function writeBlankNpmrcV2(
  absolutePath: string,
  onCreated: () => void,
): void {
  let descriptor: number | undefined;
  return runWithIndependentFinalizersV2({
    operation: () => {
      descriptor = openSync(
        absolutePath,
        constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW,
        0o600,
      );
      onCreated();
      if (writeSync(descriptor, Buffer.from("\n", "utf8")) !== 1) {
        fail(
          "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_MATERIALIZATION_FAILED",
          "Private npmrc write was incomplete",
        );
      }
      fsyncSync(descriptor);
    },
    finalizers: [() => {
      if (descriptor !== undefined) closeSync(descriptor);
    }],
    onFinalizerFailure: (errors) => fail(
      "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_MATERIALIZATION_FAILED",
      `Private npmrc ${absolutePath} write or descriptor close failed`,
      new AggregateError(errors, "Private npmrc write and descriptor finalization failures"),
    ),
  });
}

function assertMissingPathV2(absolutePath: string, label: string): void {
  try {
    lstatSync(absolutePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    return fail(
      "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_PRIVATE_ROOT_INVALID",
      `${label} absence could not be established exactly`,
      error,
    );
  }
  fail(
    "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_PRIVATE_ROOT_INVALID",
    `${label} must be absent`,
  );
}

function privateNpmrcIdentityV2(
  privateRoot: string,
  pathRef: "PRIVATE_STAGE_EMPTY_USER_NPMRC_V2" | "PRIVATE_STAGE_EMPTY_GLOBAL_NPMRC_V2",
): PrivateNpmrcIdentityV2 {
  const normalizedPrivateLocator = pathRef === "PRIVATE_STAGE_EMPTY_USER_NPMRC_V2"
    ? "user.npmrc" as const
    : "global.npmrc" as const;
  const absolutePath = path.join(privateRoot, normalizedPrivateLocator);
  const owner = processOwnerV2();
  let descriptor: number | undefined;
  const captured = runWithIndependentFinalizersV2({
    operation: () => {
      descriptor = openSync(
        absolutePath,
        constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
      );
      const before = fstatSync(descriptor);
      if (before.size !== 1) {
        return fail(
          "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_PRIVATE_ROOT_INVALID",
          `${normalizedPrivateLocator} is outside its exact byte bound`,
        );
      }
      const bytes = Buffer.alloc(1);
      const byteLength = readSync(descriptor, bytes, 0, 1, null);
      const growthProbe = Buffer.allocUnsafe(1);
      const growthCount = readSync(descriptor, growthProbe, 0, 1, null);
      const after = fstatSync(descriptor);
      const pathAfter = lstatSync(absolutePath);
      if (
        byteLength !== 1
        || growthCount !== 0
        || !sameFingerprint(fingerprint(before), fingerprint(after))
        || !sameFingerprint(fingerprint(after), fingerprint(pathAfter))
      ) {
        return fail(
          "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_PRIVATE_ROOT_INVALID",
          `${normalizedPrivateLocator} changed while it was captured`,
        );
      }
      return Object.freeze({ before, after, bytes });
    },
    finalizers: [() => {
      if (descriptor !== undefined) closeSync(descriptor);
    }],
    onFinalizerFailure: (errors) => fail(
      "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_PRIVATE_ROOT_INVALID",
      `${normalizedPrivateLocator} read or descriptor close failed`,
      new AggregateError(errors, "Private npmrc read and descriptor finalization failures"),
    ),
  });
  const { before, after, bytes } = captured;
  if (
    before.isSymbolicLink()
    || !before.isFile()
    || realpathSync(absolutePath) !== absolutePath
    || modeBits(before) !== 0o600
    || before.uid !== owner.uid
    || before.gid !== owner.gid
    || before.nlink !== 1
    || bytes.length !== 1
    || bytes[0] !== 0x0a
    || sha256(bytes) !== NODE_SCAFFOLD_PRIVATE_NPMRC_CONTENT_HASH_V2
  ) {
    return fail(
      "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_PRIVATE_ROOT_INVALID",
      `${normalizedPrivateLocator} is not one exact process-owned blank-LF file`,
    );
  }
  const identity = {
    pathRef,
    normalizedPrivateLocator,
    canonicalContent: "single_lf_blank_file" as const,
    rawHash: NODE_SCAFFOLD_PRIVATE_NPMRC_CONTENT_HASH_V2,
    rawByteLength: 1 as const,
    mode: "0600" as const,
    ownerUid: before.uid,
    ownerGid: before.gid,
    linkCount: 1 as const,
  };
  return deepFreezeJson({
    ...identity,
    identityHash: hashPrivateNpmrcIdentityV2(identity),
  });
}

function capturePrivateMaterializationV2(privateRoot: string): PrivateMaterializationCaptureV2 {
  try {
    const owner = processOwnerV2();
    const rootStat = lstatSync(privateRoot);
    if (
      rootStat.isSymbolicLink()
      || !rootStat.isDirectory()
      || realpathSync(privateRoot) !== privateRoot
      || modeBits(rootStat) !== 0o700
      || rootStat.uid !== owner.uid
      || rootStat.gid !== owner.gid
      || JSON.stringify(readBoundedDirectoryNamesV2({
        absolutePath: privateRoot,
        locator: ".",
        maxNames: PRIVATE_LAYOUT_NAMES_V2.length,
        errorCode: "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_PRIVATE_ROOT_INVALID",
      }))
        !== JSON.stringify([...PRIVATE_LAYOUT_NAMES_V2])
    ) {
      return fail(
        "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_PRIVATE_ROOT_INVALID",
        "Private execution environment root or its exact layout is invalid",
      );
    }
    const directoryCaptures = ["cache", "config-probe", "home", "tmp"].map((name) => {
      const absolutePath = path.join(privateRoot, name);
      const stat = lstatSync(absolutePath);
      if (
        stat.isSymbolicLink()
        || !stat.isDirectory()
        || realpathSync(absolutePath) !== absolutePath
        || modeBits(stat) !== 0o700
        || stat.uid !== owner.uid
        || stat.gid !== owner.gid
        || readBoundedDirectoryNamesV2({
          absolutePath,
          locator: name,
          maxNames: 0,
          errorCode: "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_PRIVATE_ROOT_INVALID",
        }).length !== 0
      ) {
        fail(
          "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_PRIVATE_ROOT_INVALID",
          `Private execution environment directory ${name} is invalid`,
        );
      }
      return Object.freeze({ name, fingerprint: fingerprint(stat) });
    });
    assertMissingPathV2(
      path.join(privateRoot, "config-probe", ".npmrc"),
      "Probe project .npmrc",
    );
    const userNpmrc = privateNpmrcIdentityV2(
      privateRoot,
      "PRIVATE_STAGE_EMPTY_USER_NPMRC_V2",
    );
    const globalNpmrc = privateNpmrcIdentityV2(
      privateRoot,
      "PRIVATE_STAGE_EMPTY_GLOBAL_NPMRC_V2",
    );
    const userStat = lstatSync(path.join(privateRoot, "user.npmrc"));
    const globalStat = lstatSync(path.join(privateRoot, "global.npmrc"));
    if (userStat.dev === globalStat.dev && userStat.ino === globalStat.ino) {
      return fail(
        "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_PRIVATE_ROOT_INVALID",
        "Private user and global npmrc files alias one physical file",
      );
    }
    const rootFingerprint = fingerprint(rootStat);
    const rootIdentityHash = hashCanonicalJson({
      schema: "setfarm.node-scaffold-private-environment-root-identity.v2",
      fingerprint: rootFingerprint,
    });
    const privateIdentityHash = hashCanonicalJson({
      schema: "setfarm.node-scaffold-private-environment-materialization.v2",
      rootFingerprint,
      directoryCaptures,
      userNpmrc,
      globalNpmrc,
    });
    return Object.freeze({
      privateRoot,
      rootFingerprint,
      rootIdentityHash,
      ownerUid: owner.uid,
      ownerGid: owner.gid,
      userNpmrc,
      globalNpmrc,
      cleanupCensus: capturePrivateCleanupCensusV2(privateRoot),
      privateIdentityHash,
    });
  } catch (error) {
    if (error instanceof NodeScaffoldExecutionEnvironmentErrorV2) throw error;
    return fail(
      "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_PRIVATE_ROOT_INVALID",
      "Private execution environment could not be captured exactly",
      error,
    );
  }
}

function validateScratchParentV2(scratchParent: string): string {
  try {
    if (!path.isAbsolute(scratchParent) || realpathSync(scratchParent) !== scratchParent) {
      return fail(
        "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_INPUT_INVALID",
        "Test scratch parent must be one canonical absolute path",
      );
    }
    const stat = lstatSync(scratchParent);
    const owner = processOwnerV2();
    if (
      stat.isSymbolicLink()
      || !stat.isDirectory()
      || modeBits(stat) !== 0o700
      || stat.uid !== owner.uid
      || stat.gid !== owner.gid
    ) {
      return fail(
        "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_INPUT_INVALID",
        "Test scratch parent must be one direct process-owned 0700 directory",
      );
    }
    return scratchParent;
  } catch (error) {
    if (error instanceof NodeScaffoldExecutionEnvironmentErrorV2) throw error;
    return fail(
      "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_INPUT_INVALID",
      "Test scratch parent could not be verified",
      error,
    );
  }
}

function createPrivateRootV2(input: Readonly<{
  admissionScope: "production_host" | "test_fixture";
  scratchParent?: string;
  hooks?: NodeScaffoldExecutionEnvironmentTestHooksV2;
}>): string {
  let privateRoot: string | undefined;
  let cleanupCensus: PrivateCleanupCensusV2 | undefined;
  try {
    const prefix = input.admissionScope === "production_host"
      ? PRODUCTION_PRIVATE_ROOT_PREFIX_V2
      : path.join(validateScratchParentV2(input.scratchParent!), "environment-");
    privateRoot = mkdtempSync(prefix);
    cleanupCensus = extendPrivateCleanupCensusWithCreatedMemberV2({
      privateRoot,
      current: cleanupCensus,
      absolutePath: privateRoot,
      locator: ".",
    });
    input.hooks?.afterCheckpoint?.("after_private_root_create");
    cleanupCensus = capturePrivateCleanupCensusV2(privateRoot);
    if (realpathSync(privateRoot) !== privateRoot) {
      return fail(
        "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_PRIVATE_ROOT_INVALID",
        "Fresh private execution environment root is not canonical",
      );
    }
    chmodSync(privateRoot, 0o700);
    cleanupCensus = capturePrivateCleanupCensusV2(privateRoot);
    for (const name of ["cache", "config-probe", "home", "tmp"]) {
      const directoryPath = path.join(privateRoot, name);
      mkdirSync(directoryPath, { mode: 0o700 });
      cleanupCensus = extendPrivateCleanupCensusWithCreatedMemberV2({
        privateRoot,
        current: cleanupCensus,
        absolutePath: directoryPath,
        locator: name,
      });
      input.hooks?.afterCheckpoint?.("after_private_directory_create");
      cleanupCensus = capturePrivateCleanupCensusV2(privateRoot);
      chmodSync(directoryPath, 0o700);
      cleanupCensus = capturePrivateCleanupCensusV2(privateRoot);
    }
    const afterNpmrcCreated = (locator: "global.npmrc" | "user.npmrc") => (): void => {
      cleanupCensus = extendPrivateCleanupCensusWithCreatedMemberV2({
        privateRoot: privateRoot!,
        current: cleanupCensus,
        absolutePath: path.join(privateRoot!, locator),
        locator,
      });
      input.hooks?.afterCheckpoint?.("after_private_npmrc_create");
      cleanupCensus = capturePrivateCleanupCensusV2(privateRoot!);
    };
    writeBlankNpmrcV2(
      path.join(privateRoot, "global.npmrc"),
      afterNpmrcCreated("global.npmrc"),
    );
    writeBlankNpmrcV2(
      path.join(privateRoot, "user.npmrc"),
      afterNpmrcCreated("user.npmrc"),
    );
    syncDirectoryV2(privateRoot);
    return privateRoot;
  } catch (error) {
    let cleanupError: unknown;
    if (privateRoot && cleanupCensus) {
      try {
        destroyPrivateCleanupCensusV2(privateRoot, cleanupCensus);
      } catch (candidate) {
        cleanupError = candidate;
      }
    }
    if (cleanupError !== undefined) {
      return fail(
        error instanceof NodeScaffoldExecutionEnvironmentErrorV2
          ? error.code
          : "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_MATERIALIZATION_FAILED",
        `Fresh private execution environment failed and cleanup retained its authenticated root ${privateRoot}`,
        new AggregateError(
          [error, cleanupError],
          "Private environment creation failure and exact cleanup failure",
        ),
      );
    }
    if (error instanceof NodeScaffoldExecutionEnvironmentErrorV2) throw error;
    return fail(
      "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_MATERIALIZATION_FAILED",
      "Fresh private execution environment could not be materialized",
      error,
    );
  }
}

function buildProbeInputV2(privateRoot: string): HostNodeToolchainEffectiveNpmConfigProbeInputV2 {
  return Object.freeze({
    privateRoot,
    environment: Object.freeze({
      CI: "true" as const,
      HOME: path.join(privateRoot, "home"),
      LANG: "C.UTF-8" as const,
      LC_ALL: "C.UTF-8" as const,
      NODE_DISABLE_COMPILE_CACHE: "1" as const,
      NO_COLOR: "1" as const,
      NPM_CONFIG_CACHE: path.join(privateRoot, "cache"),
      NPM_CONFIG_ENGINE_STRICT: "true" as const,
      NPM_CONFIG_GLOBALCONFIG: path.join(privateRoot, "global.npmrc"),
      NPM_CONFIG_LOGS_MAX: "0" as const,
      NPM_CONFIG_REGISTRY: "https://registry.npmjs.org" as const,
      NPM_CONFIG_USERCONFIG: path.join(privateRoot, "user.npmrc"),
      TEMP: path.join(privateRoot, "tmp"),
      TMP: path.join(privateRoot, "tmp"),
      TMPDIR: path.join(privateRoot, "tmp"),
      TZ: "UTC" as const,
    }),
  });
}

function catalogAndEntryV2(profileId: NodeScaffoldProfileIdV2) {
  const catalog = getCodeOwnedNodeScaffoldToolchainCatalogV2();
  const entry = getCodeOwnedNodeScaffoldToolchainEntryV2(profileId);
  if (!entry) {
    return fail(
      "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_INPUT_INVALID",
      "Execution environment profile is not one code-owned Node scaffold profile",
    );
  }
  return Object.freeze({ catalog, entry });
}

function catalogBindingV2(
  profileId: NodeScaffoldProfileIdV2,
  catalog: ReturnType<typeof getCodeOwnedNodeScaffoldToolchainCatalogV2>,
  entry: NonNullable<ReturnType<typeof getCodeOwnedNodeScaffoldToolchainEntryV2>>,
) {
  return Object.freeze({
    catalogSchema: NODE_SCAFFOLD_TOOLCHAIN_CATALOG_V2_SCHEMA,
    catalogHash: catalog.catalogHash,
    entrySchema: NODE_SCAFFOLD_TOOLCHAIN_ENTRY_V2_SCHEMA,
    entryRef: entry.entryRef,
    entryHash: entry.entryHash,
    profileId,
    environmentRef: NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_REF_V2,
    environmentContractHash: entry.executionEnvironment.environmentContractHash,
  });
}

function hostToolchainBindingV2(
  receipt: ReturnType<typeof inspectHostNodeToolchainReceiptV2>,
) {
  return Object.freeze({
    receiptSchema: HOST_NODE_TOOLCHAIN_RECEIPT_V2_SCHEMA,
    authorityRef: HOST_NODE_TOOLCHAIN_AUTHORITY_REF_V2,
    receiptHash: receipt.receiptHash,
    nodeIdentityHash: receipt.node.identityHash,
    npmClosureHash: receipt.npm.closureHash,
    npmVersion: "10.9.8" as const,
  });
}

function buildReceiptsV2(input: Readonly<{
  admissionScope: "production_host" | "test_fixture";
  profileId: NodeScaffoldProfileIdV2;
  hostReceipt: ReturnType<typeof inspectHostNodeToolchainReceiptV2>;
  materialization: PrivateMaterializationCaptureV2;
  probeEvidence: HostNodeToolchainEffectiveNpmConfigProbeEvidenceV2;
}>): Readonly<{
  effectiveNpmConfigReceipt: EffectiveNpmConfigReceiptV2;
  receipt: NodeScaffoldExecutionEnvironmentReceiptV2;
}> {
  const { catalog, entry } = catalogAndEntryV2(input.profileId);
  const catalogBinding = catalogBindingV2(input.profileId, catalog, entry);
  const hostToolchain = hostToolchainBindingV2(input.hostReceipt);
  const installDirectArgvHash = hashCanonicalJson({
    schema: "setfarm.node-scaffold-install-direct-argv-hash.v2",
    directArgv: entry.recipes.install.directArgv,
  });
  const effectiveConfig = {
    registry: input.probeEvidence.effective.registry,
    cachePathRef: input.probeEvidence.effective.cache,
    userConfigPathRef: input.probeEvidence.effective.userconfig,
    globalConfigPathRef: input.probeEvidence.effective.globalconfig,
    prefixPolicy: "host_toolchain_default_never_used_for_global_install" as const,
    location: input.probeEvidence.effective.location,
    proxy: "absent" as const,
    httpsProxy: "absent" as const,
    noProxy: "empty" as const,
    ca: "absent" as const,
    caFile: "absent" as const,
    certificate: "absent" as const,
    privateKey: "absent" as const,
    strictSsl: input.probeEvidence.effective.strictSsl,
    color: input.probeEvidence.effective.color,
    engineStrict: input.probeEvidence.effective.engineStrict,
    lifecycle: {
      baselineIgnoreScripts: input.probeEvidence.effective.ignoreScripts,
      foregroundScripts: input.probeEvidence.effective.foregroundScripts,
      scriptShell: "default_null" as const,
      shell: input.probeEvidence.effective.shell,
      installLifecycleBarrier: "exact_install_argv_ignore_scripts" as const,
      installCommandRef: "CMD_NODE_SCAFFOLD_INSTALL_V2" as const,
      installDirectArgvHash,
    },
    networkSideEffects: {
      baselineAudit: input.probeEvidence.effective.audit,
      baselineFund: input.probeEvidence.effective.fund,
      installOverride: "exact_install_argv_no_audit_no_fund" as const,
    },
    processCacheAndLogs: {
      nodeCompileCache: "disabled" as const,
      npmLogsMax: input.probeEvidence.effective.logsMax,
      processReceiptAuthority: "canonical_command_stdout_stderr_receipt_v2" as const,
    },
  };
  const effectiveIdentity: EffectiveNpmConfigReceiptHashPayloadV2 = {
    schema: EFFECTIVE_NPM_CONFIG_RECEIPT_V2_SCHEMA,
    receiptVersion: NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_VERSION_V2,
    authorityRef: NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_AUTHORITY_REF_V2,
    authorityVersion: NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_VERSION_V2,
    status: "verified",
    admissionScope: input.admissionScope,
    catalogBinding,
    hostToolchain,
    environmentBinding: {
      environmentHash: input.probeEvidence.environmentHash,
      constructionPolicy: "deny_all_then_exact_set",
      inheritedAmbientVariableCount: 0,
    },
    probe: {
      probeRef: "HOST_NPM_EFFECTIVE_CONFIG_PROBE_V2",
      executableRef: "TOOL_NODE_NPM_CLI_V2",
      directArgv: ["npm", "config", "list", "--json"],
      cwdRef: "PRIVATE_ENVIRONMENT_CONFIG_PROBE_CWD_V2",
      shell: "forbidden",
      timeoutMs: 5_000,
      maxStdoutBytes: 32_768,
      maxStderrBytes: 4_096,
      rawOutputHash: input.probeEvidence.rawOutputHash,
      keySetHash: input.probeEvidence.keySetHash,
      keyCount: input.probeEvidence.keyCount,
    },
    sourceIsolation: {
      ambientEnvironment: "not_inherited",
      ambientNpmConfigPolicy: "case_insensitive_strip_all_before_exact_set",
      probeProjectNpmrc: {
        normalizedLocator: ".npmrc",
        state: "absent",
        evidenceAuthority: "private_probe_cwd_fresh_capture_v2",
      },
      executionProjectNpmrc: {
        requiredState: "absent",
        evidenceStatus: "pending_file_tree_join",
        evidenceAuthority: "future_file_tree_manifest_v2",
      },
      userNpmrc: input.materialization.userNpmrc,
      globalNpmrc: input.materialization.globalNpmrc,
      builtinNpmrc: {
        locator: "npmrc",
        state: "absent",
        evidenceAuthority: "host_npm_package_every_and_only_closure_v2",
        npmClosureHash: input.hostReceipt.npm.closureHash,
      },
    },
    effectiveConfig,
    effectiveConfigHash: hashEffectiveNpmConfigV2(effectiveConfig),
    secretAuthority: {
      status: "absent",
      credentialVariableRefs: [],
      discoveredCredentialConfigCount: input.probeEvidence.discoveredCredentialConfigCount,
    },
  };
  const effectiveParsed = EffectiveNpmConfigReceiptV2Schema.safeParse({
    ...effectiveIdentity,
    receiptHash: hashEffectiveNpmConfigReceiptV2(effectiveIdentity),
  });
  if (!effectiveParsed.success) {
    return fail(
      "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_RECEIPT_INVALID",
      "Effective npm config receipt failed its canonical schema",
      effectiveParsed.error,
    );
  }
  const effectiveNpmConfigReceipt = deepFreezeJson(effectiveParsed.data);
  const receiptIdentity: NodeScaffoldExecutionEnvironmentReceiptHashPayloadV2 = {
    schema: NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_RECEIPT_V2_SCHEMA,
    receiptVersion: NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_VERSION_V2,
    authorityRef: NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_AUTHORITY_REF_V2,
    authorityVersion: NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_VERSION_V2,
    status: "verified_environment_pending_file_tree_join",
    admissionScope: input.admissionScope,
    productionUse: "forbidden_until_private_materializer_and_file_tree_join",
    catalogBinding,
    hostToolchain,
    privateMaterialization: {
      layoutRef: "PRIVATE_NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_LAYOUT_V2",
      rootIdentityHash: input.materialization.rootIdentityHash,
      rootMode: "0700",
      ownerUid: input.materialization.ownerUid,
      ownerGid: input.materialization.ownerGid,
      freshnessPolicy: "exclusive_random_root_no_adoption_v2",
      directoryMode: "0700",
      directoryRefs: [
        "PRIVATE_ENVIRONMENT_CONFIG_PROBE_CWD_V2",
        "PRIVATE_STAGE_HOME_V2",
        "PRIVATE_STAGE_NPM_CACHE_V2",
        "PRIVATE_STAGE_TMP_V2",
      ],
      userNpmrc: input.materialization.userNpmrc,
      globalNpmrc: input.materialization.globalNpmrc,
      destructionPolicy: "authenticated_owned_root_only_v2",
    },
    environment: {
      environmentRef: NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_REF_V2,
      environmentContractHash: entry.executionEnvironment.environmentContractHash,
      constructionPolicy: "deny_all_then_exact_set",
      inheritAmbientEnvironment: false,
      inheritedVariableAllowlist: [],
      ambientNpmConfigPolicy: "case_insensitive_strip_all_before_exact_set",
      exactVariableCount: NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_VARIABLE_NAMES_V2.length,
      exactVariableNames: [...NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_VARIABLE_NAMES_V2],
      environmentHash: input.probeEvidence.environmentHash,
      privateBindings: {
        HOME: "PRIVATE_STAGE_HOME_V2",
        NPM_CONFIG_CACHE: "PRIVATE_STAGE_NPM_CACHE_V2",
        NPM_CONFIG_GLOBALCONFIG: "PRIVATE_STAGE_EMPTY_GLOBAL_NPMRC_V2",
        NPM_CONFIG_USERCONFIG: "PRIVATE_STAGE_EMPTY_USER_NPMRC_V2",
        PATH: "HOST_TOOLCHAIN_EXACT_COMMAND_PATH_V2",
        TEMP: "PRIVATE_STAGE_TMP_V2",
        TMP: "PRIVATE_STAGE_TMP_V2",
        TMPDIR: "PRIVATE_STAGE_TMP_V2",
      },
    },
    recipeBindings: [
      { commandRef: "CMD_BUILD", environmentHash: input.probeEvidence.environmentHash },
      {
        commandRef: "CMD_NODE_SCAFFOLD_INSTALL_V2",
        environmentHash: input.probeEvidence.environmentHash,
      },
      { commandRef: "CMD_TEST", environmentHash: input.probeEvidence.environmentHash },
    ],
    effectiveNpmConfig: {
      receiptSchema: EFFECTIVE_NPM_CONFIG_RECEIPT_V2_SCHEMA,
      receiptHash: effectiveNpmConfigReceipt.receiptHash,
      effectiveConfigHash: effectiveNpmConfigReceipt.effectiveConfigHash,
      status: "verified",
    },
    executionProjectNpmrc: {
      requiredState: "absent",
      evidenceStatus: "pending_file_tree_join",
      evidenceAuthority: "future_file_tree_manifest_v2",
    },
    secretAuthority: {
      status: "absent",
      credentialVariableRefs: [],
    },
  };
  const parsed = NodeScaffoldExecutionEnvironmentReceiptV2Schema.safeParse({
    ...receiptIdentity,
    receiptHash: hashNodeScaffoldExecutionEnvironmentReceiptV2(receiptIdentity),
  });
  if (!parsed.success) {
    return fail(
      "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_RECEIPT_INVALID",
      "Execution environment receipt failed its canonical schema",
      parsed.error,
    );
  }
  return deepFreezeJson({
    effectiveNpmConfigReceipt,
    receipt: parsed.data,
  });
}

function parseExactInputV2(
  input: unknown,
  expectedKeys: readonly string[],
): Readonly<{ profileId: NodeScaffoldProfileIdV2; values: Readonly<Record<string, unknown>> }> {
  if (!isPlainRecord(input) || !exactRecordKeys(input, expectedKeys)) {
    return fail(
      "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_INPUT_INVALID",
      "Execution environment input fields are not exact",
    );
  }
  const descriptors = Object.getOwnPropertyDescriptors(input);
  const values: Record<string, unknown> = {};
  for (const key of expectedKeys) {
    const descriptor = descriptors[key];
    if (!descriptor || !("value" in descriptor) || descriptor.enumerable !== true) {
      return fail(
        "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_INPUT_INVALID",
        "Execution environment input must contain only enumerable data properties",
      );
    }
    values[key] = descriptor.value;
  }
  const profileId = values.profileId;
  if (
    profileId !== "PROFILE_NODE_CLI_STATELESS_EXACT_V2"
    && profileId !== "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2"
  ) {
    return fail(
      "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_INPUT_INVALID",
      "Execution environment profileId is not code-owned",
    );
  }
  return Object.freeze({ profileId, values: Object.freeze(values) });
}

async function buildEnvironmentV2(input: Readonly<{
  admissionScope: "production_host" | "test_fixture";
  profileId: NodeScaffoldProfileIdV2;
  operationRole: "scaffold_build" | "candidate_runtime_install";
  hostToolchain: HostNodeToolchainAuthorityV2;
  scratchParent?: string;
  hooks?: NodeScaffoldExecutionEnvironmentTestHooksV2;
}>): Promise<NodeScaffoldExecutionEnvironmentV2> {
  let privateRoot: string | undefined;
  let cleanupCensus: PrivateCleanupCensusV2 | undefined;
  try {
    const hostReceipt = await revalidateHostNodeToolchainAuthorityV2(input.hostToolchain);
    if (
      hostReceipt.admissionScope !== input.admissionScope
      || hostReceipt.requirement.profileId !== input.profileId
    ) {
      return fail(
        "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_HOST_AUTHORITY_INVALID",
        "Execution environment and host toolchain scopes or profiles do not join",
      );
    }
    privateRoot = createPrivateRootV2({
      admissionScope: input.admissionScope,
      ...(input.scratchParent ? { scratchParent: input.scratchParent } : {}),
      ...(input.hooks ? { hooks: input.hooks } : {}),
    });
    const materialization = capturePrivateMaterializationV2(privateRoot);
    cleanupCensus = materialization.cleanupCensus;
    const probeInput = buildProbeInputV2(privateRoot);
    let probeEvidence: HostNodeToolchainEffectiveNpmConfigProbeEvidenceV2;
    try {
      probeEvidence = await probeHostNodeToolchainEffectiveNpmConfigV2(
        input.hostToolchain,
        probeInput,
      );
    } catch (error) {
      return fail(
        "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_EFFECTIVE_CONFIG_INVALID",
        "Effective npm config could not be proven by the authenticated host toolchain",
        error,
      );
    }
    if (probeEvidence.hostToolchainReceiptHash !== hostReceipt.receiptHash) {
      return fail(
        "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_HOST_AUTHORITY_INVALID",
        "Host toolchain receipt changed before effective npm config admission",
      );
    }
    const freshMaterialization = capturePrivateMaterializationV2(privateRoot);
    cleanupCensus = freshMaterialization.cleanupCensus;
    if (freshMaterialization.privateIdentityHash !== materialization.privateIdentityHash) {
      return fail(
        "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_STATE_DRIFT",
        "Private execution environment changed during admission",
      );
    }
    const receipts = buildReceiptsV2({
      admissionScope: input.admissionScope,
      profileId: input.profileId,
      hostReceipt,
      materialization,
      probeEvidence,
    });
    const lifecycle: MutableLifecycleV2 = {
      status: "active",
      cleanupCensus: materialization.cleanupCensus,
    };
    const state: PrivateEnvironmentStateV2 = Object.freeze({
      admissionScope: input.admissionScope,
      profileId: input.profileId,
      operationRole: input.operationRole,
      hostToolchain: input.hostToolchain,
      privateRoot,
      probeInput,
      materialization,
      probeEvidence,
      effectiveNpmConfigReceipt: receipts.effectiveNpmConfigReceipt,
      receipt: receipts.receipt,
      lifecycle,
      ...(input.hooks ? { cleanupTestHooks: input.hooks } : {}),
    });
    privateRoot = undefined;
    return new NodeScaffoldExecutionEnvironmentV2(environmentConstructorCapabilityV2, state);
  } catch (error) {
    let cleanupError: unknown;
    if (privateRoot && cleanupCensus) {
      try {
        destroyPrivateCleanupCensusV2(privateRoot, cleanupCensus);
      } catch (candidate) {
        cleanupError = candidate;
      }
    }
    if (cleanupError !== undefined) {
      return fail(
        "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_STATE_DRIFT",
        `Execution environment admission failed and cleanup retained its authenticated root ${privateRoot}`,
        new AggregateError(
          [error, cleanupError],
          "Execution environment admission failure and exact cleanup failure",
        ),
      );
    }
    if (error instanceof NodeScaffoldExecutionEnvironmentErrorV2) throw error;
    if (error instanceof HostNodeToolchainAuthorityErrorV2) {
      return fail(
        "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_HOST_AUTHORITY_INVALID",
        "Host toolchain authority rejected execution environment admission",
        error,
      );
    }
    return fail(
      "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_MATERIALIZATION_FAILED",
      "Execution environment admission failed",
      error,
    );
  }
}

export async function createNodeScaffoldExecutionEnvironmentV2(
  input: unknown,
): Promise<NodeScaffoldExecutionEnvironmentV2> {
  const parsed = parseExactInputV2(input, ["hostToolchain", "profileId"]);
  const hostToolchain = parsed.values.hostToolchain as HostNodeToolchainAuthorityV2;
  let productionAuthority: boolean;
  try {
    productionAuthority = isProductionHostNodeToolchainAuthorityV2(hostToolchain);
  } catch (error) {
    return fail(
      "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_INPUT_INVALID",
      "Production execution environment hostToolchain is not authentic",
      error,
    );
  }
  if (!productionAuthority) {
    return fail(
      "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_PRODUCTION_AUTHORITY_REQUIRED",
      "Production execution environment requires one production_host toolchain authority",
    );
  }
  return buildEnvironmentV2({
    admissionScope: "production_host",
    profileId: parsed.profileId,
    operationRole: "scaffold_build",
    hostToolchain,
  });
}

export type NodeScaffoldExecutionEnvironmentTestCheckpointV2 =
  | "after_private_root_create"
  | "after_private_directory_create"
  | "after_private_npmrc_create";

export type NodeScaffoldExecutionEnvironmentTestHooksV2 = Readonly<{
  afterCheckpoint?: (
    checkpoint: NodeScaffoldExecutionEnvironmentTestCheckpointV2,
  ) => void;
  afterCleanupDirectoryWritable?: (locator: string) => void;
  afterCleanupDirectoryDescriptorClose?: (locator: string) => void;
  beforeCleanupCensusDirectoryRead?: (locator: string) => void;
  afterCleanupCensusDirectoryClose?: (locator: string) => void;
}>;

export type NodeScaffoldExecutionEnvironmentV2TestInput = Readonly<{
  profileId: NodeScaffoldProfileIdV2;
  hostToolchain: HostNodeToolchainAuthorityV2;
  scratchParent: string;
  testHooks?: NodeScaffoldExecutionEnvironmentTestHooksV2;
}>;

export async function createNodeScaffoldExecutionEnvironmentV2ForTest(
  input: NodeScaffoldExecutionEnvironmentV2TestInput,
): Promise<NodeScaffoldExecutionEnvironmentV2> {
  const expectedKeys = isPlainRecord(input)
    && Object.prototype.hasOwnProperty.call(input, "testHooks")
    ? ["hostToolchain", "profileId", "scratchParent", "testHooks"]
    : ["hostToolchain", "profileId", "scratchParent"];
  const parsed = parseExactInputV2(input, expectedKeys);
  if (typeof parsed.values.scratchParent !== "string") {
    return fail(
      "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_INPUT_INVALID",
      "Test execution environment scratchParent must be one string",
    );
  }
  const hostToolchain = parsed.values.hostToolchain as HostNodeToolchainAuthorityV2;
  let hostReceipt;
  try {
    hostReceipt = inspectHostNodeToolchainReceiptV2(hostToolchain);
  } catch (error) {
    return fail(
      "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_INPUT_INVALID",
      "Test execution environment hostToolchain is not authentic",
      error,
    );
  }
  if (hostReceipt.admissionScope !== "test_fixture") {
    return fail(
      "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_INPUT_INVALID",
      "Test constructor cannot consume or downgrade a production host authority",
    );
  }
  const testHooks = parsed.values.testHooks;
  if (
    testHooks !== undefined
    && (
      !isPlainRecord(testHooks)
      || Reflect.ownKeys(testHooks).some((key) =>
        key !== "afterCheckpoint"
        && key !== "afterCleanupDirectoryWritable"
        && key !== "afterCleanupDirectoryDescriptorClose"
        && key !== "beforeCleanupCensusDirectoryRead"
        && key !== "afterCleanupCensusDirectoryClose")
      || (
        testHooks.afterCheckpoint !== undefined
        && typeof testHooks.afterCheckpoint !== "function"
      )
      || (
        testHooks.afterCleanupDirectoryWritable !== undefined
        && typeof testHooks.afterCleanupDirectoryWritable !== "function"
      )
      || (
        testHooks.afterCleanupDirectoryDescriptorClose !== undefined
        && typeof testHooks.afterCleanupDirectoryDescriptorClose !== "function"
      )
      || (
        testHooks.beforeCleanupCensusDirectoryRead !== undefined
        && typeof testHooks.beforeCleanupCensusDirectoryRead !== "function"
      )
      || (
        testHooks.afterCleanupCensusDirectoryClose !== undefined
        && typeof testHooks.afterCleanupCensusDirectoryClose !== "function"
      )
    )
  ) {
    return fail(
      "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_INPUT_INVALID",
      "Test execution environment hooks are invalid",
    );
  }
  return buildEnvironmentV2({
    admissionScope: "test_fixture",
    profileId: parsed.profileId,
    operationRole: "scaffold_build",
    hostToolchain,
    scratchParent: validateScratchParentV2(parsed.values.scratchParent),
    ...(testHooks
      ? { hooks: testHooks as NodeScaffoldExecutionEnvironmentTestHooksV2 }
      : {}),
  });
}

function authenticStateV2(
  handle: NodeScaffoldExecutionEnvironmentV2,
): PrivateEnvironmentStateV2 {
  if (
    typeof handle !== "object"
    || handle === null
    || isProxy(handle)
    || Object.getPrototypeOf(handle) !== NodeScaffoldExecutionEnvironmentV2.prototype
  ) {
    return fail(
      "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_HANDLE_UNAUTHENTICATED",
      "Execution environment operation requires one authentic handle",
    );
  }
  const state = privateEnvironmentStateV2.get(handle);
  if (!state) {
    return fail(
      "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_HANDLE_UNAUTHENTICATED",
      "Execution environment operation requires one authentic handle",
    );
  }
  return state;
}

function requireActiveStateV2(
  handle: NodeScaffoldExecutionEnvironmentV2,
): PrivateEnvironmentStateV2 {
  const state = authenticStateV2(handle);
  if (state.operationRole !== "scaffold_build") {
    return fail(
      "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_OPERATION_ROLE_INVALID",
      "Candidate-runtime environments cannot execute scaffold dependency installation",
    );
  }
  if (state.lifecycle.status !== "active") {
    if (state.lifecycle.status !== "destroyed") {
      return fail(
        "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_INSTALL_ALREADY_CONSUMED",
        "Execution environment npm install authority is single-use",
      );
    }
    return fail(
      "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_DESTROYED",
      "Execution environment authority has already been destroyed",
    );
  }
  return state;
}

function requireRevalidatableStateV2(
  handle: NodeScaffoldExecutionEnvironmentV2,
): PrivateEnvironmentStateV2 {
  const state = authenticStateV2(handle);
  if (
    state.lifecycle.status === "active"
    || state.lifecycle.status === "install_consumed"
    || state.lifecycle.status === "build_consumed"
  ) {
    return state;
  }
  if (state.lifecycle.status === "destroyed") {
    return fail(
      "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_DESTROYED",
      "Execution environment authority has already been destroyed",
    );
  }
  if (state.lifecycle.status === "install_failed") {
    return fail(
      "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_INSTALL_ALREADY_CONSUMED",
      "Execution environment npm install authority failed and was consumed",
    );
  }
  return fail(
    "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_STATE_DRIFT",
    "Execution environment cannot be revalidated during an owned process transition",
  );
}

function requireBuildStateV2(
  handle: NodeScaffoldExecutionEnvironmentV2,
): PrivateEnvironmentStateV2 {
  const state = authenticStateV2(handle);
  if (state.operationRole !== "scaffold_build") {
    return fail(
      "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_OPERATION_ROLE_INVALID",
      "Candidate-runtime environments cannot execute scaffold build operations",
    );
  }
  if (state.lifecycle.status === "install_consumed") return state;
  if (state.lifecycle.status === "destroyed") {
    return fail(
      "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_DESTROYED",
      "Execution environment authority has already been destroyed",
    );
  }
  return fail(
    "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_BUILD_ALREADY_CONSUMED",
    "Execution environment candidate build authority requires one completed install and is single-use",
  );
}

export function inspectNodeScaffoldExecutionEnvironmentReceiptV2(
  handle: NodeScaffoldExecutionEnvironmentV2,
): NodeScaffoldExecutionEnvironmentReceiptV2 {
  return defensiveCopy(authenticStateV2(handle).receipt);
}

/** @internal Returns only freshly revalidated retry-stable toolchain semantics. */
export async function revalidateNodeScaffoldHostToolchainLogicalIdentityInternalV3(
  handle: NodeScaffoldExecutionEnvironmentV2,
): Promise<HostNodeToolchainLogicalProjectionV3> {
  const state = authenticStateV2(handle);
  if (
    state.lifecycle.status === "destroyed"
    || state.lifecycle.status === "install_failed"
  ) {
    return fail(
      "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_STATE_DRIFT",
      "Logical toolchain projection requires a live execution environment",
    );
  }
  const hostToolchain = await revalidateHostNodeToolchainAuthorityV2(
    state.hostToolchain,
  );
  const statusAfter = authenticStateV2(handle).lifecycle.status;
  if (
    statusAfter === "destroyed"
    || statusAfter === "install_failed"
    || hostToolchain.receiptHash !== state.receipt.hostToolchain.receiptHash
    || hostToolchain.node.identityHash
      !== state.receipt.hostToolchain.nodeIdentityHash
    || hostToolchain.npm.closureHash
      !== state.receipt.hostToolchain.npmClosureHash
  ) {
    return fail(
      "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_STATE_DRIFT",
      "Logical toolchain projection lost its authenticated environment join",
    );
  }
  return projectHostNodeToolchainLogicalIdentityV3(hostToolchain);
}

export function inspectEffectiveNpmConfigReceiptV2(
  handle: NodeScaffoldExecutionEnvironmentV2,
): EffectiveNpmConfigReceiptV2 {
  return defensiveCopy(authenticStateV2(handle).effectiveNpmConfigReceipt);
}

export function isProductionNodeScaffoldExecutionEnvironmentV2(
  handle: NodeScaffoldExecutionEnvironmentV2,
): boolean {
  return authenticStateV2(handle).admissionScope === "production_host";
}

export async function revalidateNodeScaffoldExecutionEnvironmentV2(
  handle: NodeScaffoldExecutionEnvironmentV2,
): Promise<NodeScaffoldExecutionEnvironmentReceiptV2> {
  const state = requireRevalidatableStateV2(handle);
  try {
    const materialization = capturePrivateMaterializationV2(state.privateRoot);
    if (materialization.privateIdentityHash !== state.materialization.privateIdentityHash) {
      return fail(
        "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_STATE_DRIFT",
        "Private execution environment no longer reproduces its admitted identity",
      );
    }
    const hostReceipt = await revalidateHostNodeToolchainAuthorityV2(state.hostToolchain);
    if (hostReceipt.receiptHash !== state.receipt.hostToolchain.receiptHash) {
      return fail(
        "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_STATE_DRIFT",
        "Host toolchain no longer reproduces the execution environment binding",
      );
    }
    const probeEvidence = await probeHostNodeToolchainEffectiveNpmConfigV2(
      state.hostToolchain,
      state.probeInput,
    );
    if (
      hashCanonicalJson(probeEvidence) !== hashCanonicalJson(state.probeEvidence)
      || probeEvidence.environmentHash !== state.receipt.environment.environmentHash
    ) {
      return fail(
        "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_STATE_DRIFT",
        "Effective npm config no longer reproduces its admitted evidence",
      );
    }
    return defensiveCopy(state.receipt);
  } catch (error) {
    if (
      error instanceof NodeScaffoldExecutionEnvironmentErrorV2
      && error.code === "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_STATE_DRIFT"
    ) throw error;
    return fail(
      "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_STATE_DRIFT",
      "Execution environment authority could not be revalidated",
      error,
    );
  }
}

/**
 * @internal Issues one fresh candidate-runtime environment from the same
 * authenticated host only after the scaffold build consumed its environment.
 */
export async function createNodeCandidateRuntimeExecutionEnvironmentInternalV2(
  handle: NodeScaffoldExecutionEnvironmentV2,
): Promise<NodeScaffoldExecutionEnvironmentV2> {
  const state = authenticStateV2(handle);
  if (
    state.operationRole !== "scaffold_build"
    || state.lifecycle.status !== "build_consumed"
  ) {
    return fail(
      "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_RUNTIME_HANDOFF_ALREADY_CONSUMED",
      "Candidate-runtime environment handoff requires one consumed scaffold build and is single-use",
    );
  }
  state.lifecycle.status = "runtime_handoff_claimed";
  try {
    return await buildEnvironmentV2({
      admissionScope: state.admissionScope,
      profileId: state.profileId,
      operationRole: "candidate_runtime_install",
      hostToolchain: state.hostToolchain,
      ...(state.admissionScope === "test_fixture"
        ? { scratchParent: path.dirname(state.privateRoot) }
        : {}),
    });
  } finally {
    state.lifecycle.status = "runtime_handoff_consumed";
  }
}

function requireCandidateRuntimeInstallStateInternalV2(
  handle: NodeScaffoldExecutionEnvironmentV2,
): PrivateEnvironmentStateV2 {
  const state = authenticStateV2(handle);
  if (state.operationRole !== "candidate_runtime_install") {
    return fail(
      "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_OPERATION_ROLE_INVALID",
      "Scaffold-build environments cannot execute candidate runtime installation",
    );
  }
  if (state.lifecycle.status === "active") return state;
  if (state.lifecycle.status === "destroyed") {
    return fail(
      "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_DESTROYED",
      "Candidate runtime environment has already been destroyed",
    );
  }
  return fail(
    "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_RUNTIME_INSTALL_ALREADY_CONSUMED",
    "Candidate runtime dependency installation authority is single-use",
  );
}

function finishExecutionOperationV2<T>(input: Readonly<{
  completed: boolean;
  evidence: T | undefined;
  primaryErrors: readonly unknown[];
  finalizerErrors: readonly unknown[];
  message: string;
  aggregateMessage: string;
}>): T {
  if (input.finalizerErrors.length > 0) {
    return fail(
      "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_STATE_DRIFT",
      input.message,
      new AggregateError(
        [...input.primaryErrors, ...input.finalizerErrors],
        input.aggregateMessage,
      ),
    );
  }
  if (input.primaryErrors.length > 0) throw input.primaryErrors[0];
  if (!input.completed || input.evidence === undefined) {
    return fail(
      "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_STATE_DRIFT",
      "Execution operation completed without exact evidence",
    );
  }
  return input.evidence;
}

/** @internal Executes the only candidate-runtime operation and consumes it. */
export async function executeNodeCandidateRuntimeEnvironmentNpmCiInternalV2(
  handle: NodeScaffoldExecutionEnvironmentV2,
  candidateBundleRoot: string,
): Promise<HostNodeToolchainCandidateProductionNpmCiEvidenceV2> {
  const state = requireCandidateRuntimeInstallStateInternalV2(handle);
  if (typeof candidateBundleRoot !== "string") {
    return fail(
      "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_OPERATION_ROLE_INVALID",
      "Candidate runtime installation requires one exact bundle-root locator",
    );
  }
  const environmentReceipt = await revalidateNodeScaffoldExecutionEnvironmentV2(
    handle,
  );
  state.lifecycle.status = "installing";
  let evidence: HostNodeToolchainCandidateProductionNpmCiEvidenceV2 | undefined;
  let completed = false;
  const primaryErrors: unknown[] = [];
  try {
    const candidateEvidence =
      await executeHostNodeToolchainCandidateProductionNpmCiV2(
        state.hostToolchain,
        {
          privateRoot: state.privateRoot,
          candidateBundleRoot,
          environment: state.probeInput.environment,
        },
      );
    if (
      candidateEvidence.hostToolchainReceiptHash
        !== environmentReceipt.hostToolchain.receiptHash
      || candidateEvidence.nodeIdentityHash
        !== environmentReceipt.hostToolchain.nodeIdentityHash
      || candidateEvidence.npmClosureHash
        !== environmentReceipt.hostToolchain.npmClosureHash
      || candidateEvidence.environmentHash
        !== environmentReceipt.environment.environmentHash
      || candidateEvidence.directArgvHash !== hashCanonicalJson({
        schema: "setfarm.candidate-runtime-npm-direct-argv-hash.v2",
        directArgv: candidateEvidence.directArgv,
      })
    ) {
      return fail(
        "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_STATE_DRIFT",
        "Candidate runtime npm evidence does not reproduce the admitted environment",
      );
    }
    evidence = candidateEvidence;
    completed = true;
  } catch (error) {
    primaryErrors.push(error);
  }
  const finalizerErrors: unknown[] = [];
  try {
    state.lifecycle.cleanupCensus = capturePrivateCleanupCensusV2(state.privateRoot);
  } catch (error) {
    finalizerErrors.push(error);
  }
  state.lifecycle.status = completed ? "install_consumed" : "install_failed";
  return finishExecutionOperationV2({
    completed,
    evidence,
    primaryErrors,
    finalizerErrors,
    message: "Candidate runtime npm operation finalization could not capture its exact private cleanup census",
    aggregateMessage: "Candidate runtime npm operation and bounded finalization failures",
  });
}

/** @internal Freshly reproduces the pathless host/environment runtime context. */
export async function revalidateNodeCandidateRuntimeExecutionContextInternalV2(
  handle: NodeScaffoldExecutionEnvironmentV2,
): Promise<Readonly<{
  environment: NodeScaffoldExecutionEnvironmentReceiptV2;
  hostToolchain: HostNodeToolchainReceiptV2;
}>> {
  const state = authenticStateV2(handle);
  if (state.operationRole !== "candidate_runtime_install") {
    return fail(
      "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_OPERATION_ROLE_INVALID",
      "Candidate runtime context requires its dedicated operation-role environment",
    );
  }
  const environment = await revalidateNodeScaffoldExecutionEnvironmentV2(handle);
  const hostToolchain = await revalidateHostNodeToolchainAuthorityV2(
    state.hostToolchain,
  );
  if (
    environment.hostToolchain.receiptHash !== hostToolchain.receiptHash
    || environment.hostToolchain.nodeIdentityHash
      !== hostToolchain.node.identityHash
    || environment.hostToolchain.npmClosureHash
      !== hostToolchain.npm.closureHash
  ) {
    return fail(
      "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_STATE_DRIFT",
      "Candidate runtime host and environment receipts no longer join",
    );
  }
  return Object.freeze({
    environment: defensiveCopy(environment),
    hostToolchain: defensiveCopy(hostToolchain),
  });
}

/**
 * @internal Freshly joins the candidate-runtime environment to the exact
 * authenticated Node executable without serializing either private locator.
 */
export async function acquireNodeCandidateRuntimeLaunchEnvironmentInternalV2(
  handle: NodeScaffoldExecutionEnvironmentV2,
): Promise<Readonly<{
  admissionScope: "production_host" | "test_fixture";
  profileId: NodeScaffoldProfileIdV2;
  environmentReceiptHash: string;
  environmentHash: string;
  hostRuntime: HostNodeRuntimeLaunchContextInternalV2;
}>> {
  const state = authenticStateV2(handle);
  if (
    state.operationRole !== "candidate_runtime_install"
    || state.lifecycle.status !== "install_consumed"
  ) {
    return fail(
      "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_OPERATION_ROLE_INVALID",
      "Candidate launch requires one completed candidate-runtime installation environment",
    );
  }
  const context = await revalidateNodeCandidateRuntimeExecutionContextInternalV2(
    handle,
  );
  const hostRuntime = await acquireHostNodeRuntimeLaunchContextInternalV2(
    state.hostToolchain,
  );
  if (
    hostRuntime.admissionScope !== state.admissionScope
    || hostRuntime.profileId !== state.profileId
    || hostRuntime.hostToolchainReceiptHash
      !== context.hostToolchain.receiptHash
    || hostRuntime.nodeIdentityHash
      !== context.hostToolchain.node.identityHash
  ) {
    return fail(
      "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_STATE_DRIFT",
      "Candidate launch environment no longer joins its exact host runtime",
    );
  }
  return Object.freeze({
    admissionScope: state.admissionScope,
    profileId: state.profileId,
    environmentReceiptHash: context.environment.receiptHash,
    environmentHash: context.environment.environment.environmentHash,
    hostRuntime,
  });
}

/**
 * Joins one authenticated environment to one authenticated scaffold stage and
 * consumes both install capabilities regardless of the process outcome.
 */
export async function executeNodeScaffoldEnvironmentNpmCiV2(
  handle: NodeScaffoldExecutionEnvironmentV2,
  stage: MaterializedNodeScaffoldPrivateStageV2,
): Promise<HostNodeToolchainNpmCiEvidenceV2> {
  const state = requireActiveStateV2(handle);
  const environmentReceipt = await revalidateNodeScaffoldExecutionEnvironmentV2(handle);
  const stageBridge = await import("./node-scaffold-private-materializer-v2.js");
  let scope: ReturnType<
    typeof stageBridge.acquireNodeScaffoldPrivateInstallScopeInternalV2
  >;
  try {
    scope = stageBridge.acquireNodeScaffoldPrivateInstallScopeInternalV2(
      stage,
      environmentReceipt.receiptHash,
    );
  } catch (error) {
    return fail(
      "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_STATE_DRIFT",
      "Execution environment could not acquire its authenticated scaffold install scope",
      error,
    );
  }
  if (
    scope.admissionScope !== state.admissionScope
    || scope.profileId !== state.profileId
    || scope.scaffoldBaseReceiptHash !== stage.receiptHash
  ) {
    stageBridge.settleNodeScaffoldPrivateInstallScopeInternalV2(
      stage,
      scope.scaffoldBaseReceiptHash,
    );
    return fail(
      "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_STATE_DRIFT",
      "Execution environment and private scaffold scope or profile do not join",
    );
  }
  state.lifecycle.status = "installing";
  let evidence: HostNodeToolchainNpmCiEvidenceV2 | undefined;
  let completed = false;
  const primaryErrors: unknown[] = [];
  try {
    const candidateEvidence = await executeHostNodeToolchainNpmCiV2(state.hostToolchain, {
      privateRoot: state.privateRoot,
      projectRoot: scope.projectRoot,
      environment: state.probeInput.environment,
    });
    if (
      candidateEvidence.hostToolchainReceiptHash !== environmentReceipt.hostToolchain.receiptHash
      || candidateEvidence.environmentHash !== environmentReceipt.environment.environmentHash
      || candidateEvidence.directArgvHash !== hashCanonicalJson({
        schema: "setfarm.node-scaffold-install-direct-argv-hash.v2",
        directArgv: candidateEvidence.directArgv,
      })
    ) {
      return fail(
        "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_STATE_DRIFT",
        "npm ci execution evidence does not reproduce the admitted environment",
      );
    }
    evidence = candidateEvidence;
    completed = true;
  } catch (error) {
    primaryErrors.push(error);
  }
  const finalizerErrors: unknown[] = [];
  try {
    state.lifecycle.cleanupCensus = capturePrivateCleanupCensusV2(state.privateRoot);
  } catch (error) {
    finalizerErrors.push(error);
  }
  state.lifecycle.status = completed ? "install_consumed" : "install_failed";
  try {
    stageBridge.settleNodeScaffoldPrivateInstallScopeInternalV2(
      stage,
      scope.scaffoldBaseReceiptHash,
    );
  } catch (error) {
    finalizerErrors.push(error);
  }
  return finishExecutionOperationV2({
    completed,
    evidence,
    primaryErrors,
    finalizerErrors,
    message: "npm ci operation finalization could not consume every authenticated private scope",
    aggregateMessage: "npm ci operation and bounded private-scope finalization failures",
  });
}

/**
 * Joins the post-install sealed environment to one source-ready stage and
 * consumes both build capabilities on every process outcome.
 */
export async function executeNodeScaffoldEnvironmentBuildV2(
  handle: NodeScaffoldExecutionEnvironmentV2,
  stage: MaterializedNodeScaffoldPrivateStageV2,
): Promise<HostNodeToolchainBuildEvidenceV2> {
  const state = requireBuildStateV2(handle);
  const environmentReceipt = await revalidateNodeScaffoldExecutionEnvironmentV2(handle);
  const stageBridge = await import("./node-scaffold-private-materializer-v2.js");
  let scope: Awaited<ReturnType<
    typeof stageBridge.acquireNodeScaffoldPrivateBuildScopeInternalV2
  >>;
  try {
    scope = await stageBridge.acquireNodeScaffoldPrivateBuildScopeInternalV2(
      stage,
      environmentReceipt.receiptHash,
    );
  } catch (error) {
    return fail(
      "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_STATE_DRIFT",
      "Execution environment could not acquire its authenticated candidate-build scope",
      error,
    );
  }
  if (
    scope.admissionScope !== state.admissionScope
    || scope.profileId !== state.profileId
    || scope.scaffoldBaseReceiptHash !== stage.receiptHash
  ) {
    stageBridge.settleNodeScaffoldPrivateBuildScopeInternalV2(
      stage,
      scope.scaffoldBaseReceiptHash,
    );
    return fail(
      "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_STATE_DRIFT",
      "Execution environment and candidate-build scope or profile do not join",
    );
  }
  state.lifecycle.status = "building";
  let evidence: HostNodeToolchainBuildEvidenceV2 | undefined;
  let completed = false;
  const primaryErrors: unknown[] = [];
  try {
    const candidateEvidence = await executeHostNodeToolchainBuildV2(state.hostToolchain, {
      privateRoot: state.privateRoot,
      projectRoot: scope.projectRoot,
      environment: state.probeInput.environment,
      compilerTarget: scope.compilerTarget,
    });
    if (
      candidateEvidence.hostToolchainReceiptHash
        !== environmentReceipt.hostToolchain.receiptHash
      || candidateEvidence.nodeIdentityHash
        !== environmentReceipt.hostToolchain.nodeIdentityHash
      || candidateEvidence.environmentHash
        !== environmentReceipt.environment.environmentHash
      || candidateEvidence.directArgvHash !== hashCanonicalJson({
        schema: "setfarm.candidate-build-direct-argv-hash.v2",
        directArgv: candidateEvidence.directArgv,
      })
    ) {
      return fail(
        "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_STATE_DRIFT",
        "Candidate build execution evidence does not reproduce the sealed environment",
      );
    }
    evidence = candidateEvidence;
    completed = true;
  } catch (error) {
    primaryErrors.push(error);
  }
  const finalizerErrors: unknown[] = [];
  try {
    state.lifecycle.cleanupCensus = capturePrivateCleanupCensusV2(state.privateRoot);
  } catch (error) {
    finalizerErrors.push(error);
  }
  state.lifecycle.status = "build_consumed";
  try {
    stageBridge.settleNodeScaffoldPrivateBuildScopeInternalV2(
      stage,
      scope.scaffoldBaseReceiptHash,
    );
  } catch (error) {
    finalizerErrors.push(error);
  }
  return finishExecutionOperationV2({
    completed,
    evidence,
    primaryErrors,
    finalizerErrors,
    message: "Candidate build finalization could not consume every authenticated private scope",
    aggregateMessage: "Candidate build operation and bounded private-scope finalization failures",
  });
}

export function destroyNodeScaffoldExecutionEnvironmentV2(
  handle: NodeScaffoldExecutionEnvironmentV2,
): void {
  const state = authenticStateV2(handle);
  if (state.lifecycle.status === "destroyed") return;
  try {
    assertExactPrivateRootStableIdentityV2(
      state.privateRoot,
      state.materialization.rootFingerprint,
    );
    destroyPrivateCleanupCensusV2(
      state.privateRoot,
      state.lifecycle.cleanupCensus,
      state.cleanupTestHooks,
    );
    assertMissingPathV2(state.privateRoot, "Destroyed private execution environment root");
    state.lifecycle.status = "destroyed";
  } catch (error) {
    if (error instanceof NodeScaffoldExecutionEnvironmentErrorV2) throw error;
    return fail(
      "NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_V2_STATE_DRIFT",
      "Private execution environment could not be destroyed safely",
      error,
    );
  }
}
