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
import os from "node:os";
import path from "node:path";
import { isProxy } from "node:util/types";

import {
  captureCanonicalRuntimeTreeV2,
  captureCanonicalRuntimeTreeV2ForTest,
  verifyCanonicalRuntimeTreeV2,
} from "../execution/canonical-runtime-tree-v2.js";
import type {
  CanonicalRuntimeTreeV2,
} from "../execution/schemas/canonical-runtime-tree-v2.js";
import {
  canonicalJsonStringify,
  hashCanonicalJson,
} from "./canonical-json.js";
import {
  acquireNodeCandidateRuntimeLaunchEnvironmentInternalV2,
  destroyNodeScaffoldExecutionEnvironmentV2,
  executeNodeCandidateRuntimeEnvironmentNpmCiInternalV2,
  revalidateNodeCandidateRuntimeExecutionContextInternalV2,
  type NodeScaffoldExecutionEnvironmentV2,
} from "./node-scaffold-execution-environment-v2.js";
import {
  deriveCodeOwnedNodeScaffoldProductionClosureV2,
  verifyCodeOwnedNodeScaffoldProductionClosureV2,
} from "./node-scaffold-production-closure-v2.js";
import {
  getNodeScaffoldRuntimeMetadataProbeInternalV2,
  materializeNodeScaffoldProductionDependenciesInternalV2,
  normalizeNodeScaffoldRuntimeMetadataInternalV2,
  revalidateNodeScaffoldProductionDependenciesInternalV2,
  type NodeScaffoldProductionMaterializationV2,
} from "./node-scaffold-production-materialization-v2.js";
import type {
  NodeCandidateRuntimeBundleInputFileInternalV2,
  NodeCandidateRuntimeBundleInputsInternalV2,
} from "./node-scaffold-private-materializer-v2.js";
import type {
  HostNodeToolchainCandidateProductionNpmCiEvidenceV2,
} from "./host-node-toolchain-authority-v2.js";
import type {
  HostNodeToolchainReceiptV2,
} from "./schemas/host-node-toolchain-receipt-v2.js";
import type {
  NodeScaffoldExecutionEnvironmentReceiptV2,
} from "./schemas/node-scaffold-execution-environment-v2.js";
import type {
  NodeScaffoldProfileIdV2,
} from "./node-scaffold-toolchain-catalog-v2.js";
import type {
  NodeScaffoldProductionClosureV2,
} from "./schemas/node-scaffold-production-closure-v2.js";

const PRODUCTION_ATTEMPT_PREFIX_V2 =
  "/private/tmp/setfarm-node-candidate-runtime-v2-" as const;
const TEST_ATTEMPT_PREFIX_V2 = "setfarm-node-candidate-runtime-v2-test-" as const;

export type NodeCandidateRuntimePrivateMaterializerErrorCodeV2 =
  | "NODE_CANDIDATE_RUNTIME_PRIVATE_V2_INPUT_INVALID"
  | "NODE_CANDIDATE_RUNTIME_PRIVATE_V2_SCOPE_INVALID"
  | "NODE_CANDIDATE_RUNTIME_PRIVATE_V2_LAYOUT_INVALID"
  | "NODE_CANDIDATE_RUNTIME_PRIVATE_V2_SOURCE_INVALID"
  | "NODE_CANDIDATE_RUNTIME_PRIVATE_V2_INSTALL_REJECTED"
  | "NODE_CANDIDATE_RUNTIME_PRIVATE_V2_DEPENDENCY_REJECTED"
  | "NODE_CANDIDATE_RUNTIME_PRIVATE_V2_BUNDLE_INVALID"
  | "NODE_CANDIDATE_RUNTIME_PRIVATE_V2_AUTHORITY_UNAUTHENTICATED"
  | "NODE_CANDIDATE_RUNTIME_PRIVATE_V2_AUTHORITY_MISMATCH"
  | "NODE_CANDIDATE_RUNTIME_PRIVATE_V2_DESTROYED"
  | "NODE_CANDIDATE_RUNTIME_PRIVATE_V2_CLEANUP_FAILED";

export class NodeCandidateRuntimePrivateMaterializerErrorV2 extends Error {
  readonly code: NodeCandidateRuntimePrivateMaterializerErrorCodeV2;
  override readonly cause?: unknown;

  constructor(
    code: NodeCandidateRuntimePrivateMaterializerErrorCodeV2,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message.slice(0, 1_500), options);
    this.name = "NodeCandidateRuntimePrivateMaterializerErrorV2";
    this.code = code;
    this.cause = options?.cause;
  }
}

type AdmissionScopeV2 = "production_host" | "test_fixture";

type RootIdentityV2 = Readonly<{
  device: number;
  inode: number;
  ownerUid: number;
  ownerGid: number;
}>;

export type NodeCandidateRuntimePhysicalSourceCheckpointInternalV2 = Readonly<{
  packageJson: Readonly<{
    logicalLocator: "package.json";
    contentHash: string;
    byteLength: number;
    physicalIdentityHash: string;
  }>;
  packageLock: Readonly<{
    logicalLocator: "package-lock.json";
    contentHash: string;
    byteLength: number;
    physicalIdentityHash: string;
  }>;
  checkpointHash: string;
}>;

export type NodeCandidateRuntimePrivateMaterializationV2 = Readonly<{
  admissionScope: AdmissionScopeV2;
  profileId: NodeScaffoldProfileIdV2;
  pathDisclosure: "forbidden";
  scaffoldBaseReceiptHash: string;
  sourceMaterializationReceiptHash: string;
  dependencyReceiptHash: string;
  dependencyIdentityHash: string;
  environment: NodeScaffoldExecutionEnvironmentReceiptV2;
  hostToolchain: HostNodeToolchainReceiptV2;
  productionClosure: NodeScaffoldProductionClosureV2;
  sourceBefore: NodeCandidateRuntimePhysicalSourceCheckpointInternalV2;
  sourceAfter: NodeCandidateRuntimePhysicalSourceCheckpointInternalV2;
  installEvidence: HostNodeToolchainCandidateProductionNpmCiEvidenceV2;
  applicationTree: CanonicalRuntimeTreeV2;
  dependencyTree: CanonicalRuntimeTreeV2;
  productionGraph: NodeScaffoldProductionMaterializationV2["productionGraph"];
  packageJson: Readonly<{
    logicalLocator: "candidate-bundle/package.json";
    contentHash: string;
    byteLength: number;
    mode: "0444";
  }>;
  rootMembershipHash: string;
  materializationHash: string;
}>;

type PrivateStateV2 = Readonly<{
  admissionScope: AdmissionScopeV2;
  profileId: NodeScaffoldProfileIdV2;
  attemptRoot: string;
  bundleRoot: string;
  attemptIdentity: RootIdentityV2;
  bundleIdentity: RootIdentityV2;
  environment: NodeScaffoldExecutionEnvironmentV2;
  productionClosure: NodeScaffoldProductionClosureV2;
  value: NodeCandidateRuntimePrivateMaterializationV2;
  lifecycle: { status: "ready" | "destroyed" };
}>;

const constructorCapabilityV2 = Object.freeze({});
const privateStateV2 = new WeakMap<object, PrivateStateV2>();

export class MaterializedNodeCandidateRuntimePrivateV2 {
  readonly materializationHash: string;
  readonly applicationTreeHash: string;
  readonly dependencyTreeHash: string;
  readonly productionGraphHash: string;
  readonly admissionScope: AdmissionScopeV2;

  constructor(capability: object, state: PrivateStateV2) {
    if (capability !== constructorCapabilityV2) {
      throw new NodeCandidateRuntimePrivateMaterializerErrorV2(
        "NODE_CANDIDATE_RUNTIME_PRIVATE_V2_AUTHORITY_UNAUTHENTICATED",
        "Candidate runtime private constructor capability is unavailable",
      );
    }
    this.materializationHash = state.value.materializationHash;
    this.applicationTreeHash = state.value.applicationTree.treeHash;
    this.dependencyTreeHash = state.value.dependencyTree.treeHash;
    this.productionGraphHash = state.value.productionGraph.resolutionGraphHash;
    this.admissionScope = state.admissionScope;
    privateStateV2.set(this, state);
    Object.freeze(this);
  }
}

function fail(
  code: NodeCandidateRuntimePrivateMaterializerErrorCodeV2,
  message: string,
  cause?: unknown,
): never {
  throw new NodeCandidateRuntimePrivateMaterializerErrorV2(
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

function processOwner(): Readonly<{ uid: number; gid: number }> {
  if (typeof process.getuid !== "function" || typeof process.getgid !== "function") {
    return fail(
      "NODE_CANDIDATE_RUNTIME_PRIVATE_V2_LAYOUT_INVALID",
      "Candidate runtime private materializer requires POSIX ownership evidence",
    );
  }
  return Object.freeze({ uid: process.getuid(), gid: process.getgid() });
}

function rootIdentity(stat: Stats): RootIdentityV2 {
  return Object.freeze({
    device: stat.dev,
    inode: stat.ino,
    ownerUid: stat.uid,
    ownerGid: stat.gid,
  });
}

function sameRootIdentity(left: RootIdentityV2, right: RootIdentityV2): boolean {
  return left.device === right.device
    && left.inode === right.inode
    && left.ownerUid === right.ownerUid
    && left.ownerGid === right.ownerGid;
}

function deepFreezeJson<T>(value: T): T {
  const pending: object[] = [];
  if (value !== null && typeof value === "object") pending.push(value);
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

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (
    value === null
    || typeof value !== "object"
    || Array.isArray(value)
    || isProxy(value)
  ) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactDataRecord(
  input: unknown,
  expectedKeys: readonly string[],
): Readonly<Record<string, unknown>> {
  if (!isPlainRecord(input)) {
    return fail(
      "NODE_CANDIDATE_RUNTIME_PRIVATE_V2_INPUT_INVALID",
      "Candidate runtime input must be one non-proxied plain object",
    );
  }
  const keys = Reflect.ownKeys(input);
  if (
    keys.length !== expectedKeys.length
    || keys.some((key) => typeof key !== "string" || !expectedKeys.includes(key))
  ) {
    return fail(
      "NODE_CANDIDATE_RUNTIME_PRIVATE_V2_INPUT_INVALID",
      "Candidate runtime input fields are not exact",
    );
  }
  const descriptors = Object.getOwnPropertyDescriptors(input);
  const values: Record<string, unknown> = {};
  for (const key of expectedKeys) {
    const descriptor = descriptors[key];
    if (!descriptor || !("value" in descriptor) || descriptor.enumerable !== true) {
      return fail(
        "NODE_CANDIDATE_RUNTIME_PRIVATE_V2_INPUT_INVALID",
        "Candidate runtime input must use enumerable data properties",
      );
    }
    values[key] = descriptor.value;
  }
  return Object.freeze(values);
}

function exactInputFile(
  input: unknown,
  expectedLocator: string,
): NodeCandidateRuntimeBundleInputFileInternalV2 {
  const values = exactDataRecord(input, [
    "byteLength",
    "bytes",
    "contentHash",
    "logicalLocator",
  ]);
  if (
    values.logicalLocator !== expectedLocator
    || typeof values.contentHash !== "string"
    || !/^[a-f0-9]{64}$/u.test(values.contentHash)
    || typeof values.byteLength !== "number"
    || !Number.isSafeInteger(values.byteLength)
    || values.byteLength < 1
    || !Buffer.isBuffer(values.bytes)
    || values.bytes.byteLength !== values.byteLength
    || sha256(values.bytes) !== values.contentHash
  ) {
    return fail(
      "NODE_CANDIDATE_RUNTIME_PRIVATE_V2_SOURCE_INVALID",
      `Candidate runtime input ${expectedLocator} is malformed or changed`,
    );
  }
  return input as NodeCandidateRuntimeBundleInputFileInternalV2;
}

function exactRuntimeInputs(input: unknown): NodeCandidateRuntimeBundleInputsInternalV2 {
  const values = exactDataRecord(input, [
    "admissionScope",
    "application",
    "dependencyIdentityHash",
    "dependencyReceiptHash",
    "packageJson",
    "packageLock",
    "profileId",
    "runtimeEnvironment",
    "scaffoldBaseReceiptHash",
    "sourceMaterializationReceiptHash",
  ]);
  if (
    (values.admissionScope !== "production_host"
      && values.admissionScope !== "test_fixture")
    || (values.profileId !== "PROFILE_NODE_CLI_STATELESS_EXACT_V2"
      && values.profileId !== "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2")
    || ![values.scaffoldBaseReceiptHash,
      values.sourceMaterializationReceiptHash,
      values.dependencyReceiptHash,
      values.dependencyIdentityHash].every((hash) =>
        typeof hash === "string" && /^[a-f0-9]{64}$/u.test(hash))
    || !Array.isArray(values.application)
    || values.application.length !== 2
  ) {
    return fail(
      "NODE_CANDIDATE_RUNTIME_PRIVATE_V2_INPUT_INVALID",
      "Candidate runtime stage authority is malformed",
    );
  }
  const names = values.profileId === "PROFILE_NODE_CLI_STATELESS_EXACT_V2"
    ? ["application/cli.js", "application/cli.setfarm.test.js"] as const
    : ["application/app.js", "application/app.setfarm.test.js"] as const;
  exactInputFile(values.packageJson, "package.json");
  exactInputFile(values.packageLock, "package-lock.json");
  exactInputFile(values.application[0], names[0]);
  exactInputFile(values.application[1], names[1]);
  return input as NodeCandidateRuntimeBundleInputsInternalV2;
}

function syncPath(absolutePath: string): void {
  let descriptor: number | undefined;
  try {
    descriptor = openSync(absolutePath, constants.O_RDONLY | constants.O_NOFOLLOW);
    fsyncSync(descriptor);
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function writeExclusiveFile(input: Readonly<{
  absolutePath: string;
  file: NodeCandidateRuntimeBundleInputFileInternalV2;
}>): void {
  const owner = processOwner();
  let descriptor: number | undefined;
  try {
    const beforeHash = sha256(input.file.bytes);
    if (
      beforeHash !== input.file.contentHash
      || input.file.bytes.byteLength !== input.file.byteLength
    ) {
      return fail(
        "NODE_CANDIDATE_RUNTIME_PRIVATE_V2_SOURCE_INVALID",
        `Candidate input ${input.file.logicalLocator} changed before copy`,
      );
    }
    descriptor = openSync(
      input.absolutePath,
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW,
      0o600,
    );
    let offset = 0;
    while (offset < input.file.bytes.byteLength) {
      const written = writeSync(
        descriptor,
        input.file.bytes,
        offset,
        input.file.bytes.byteLength - offset,
        null,
      );
      if (written < 1) {
        return fail(
          "NODE_CANDIDATE_RUNTIME_PRIVATE_V2_SOURCE_INVALID",
          `Candidate input ${input.file.logicalLocator} write ended early`,
        );
      }
      offset += written;
    }
    fsyncSync(descriptor);
    fchmodSync(descriptor, 0o444);
    fsyncSync(descriptor);
    const stat = fstatSync(descriptor);
    if (
      !stat.isFile()
      || stat.nlink !== 1
      || stat.uid !== owner.uid
      || stat.gid !== owner.gid
      || modeBits(stat) !== 0o444
      || stat.size !== input.file.byteLength
      || sha256(input.file.bytes) !== beforeHash
    ) {
      return fail(
        "NODE_CANDIDATE_RUNTIME_PRIVATE_V2_SOURCE_INVALID",
        `Candidate input ${input.file.logicalLocator} changed during exact copy`,
      );
    }
  } catch (error) {
    if (error instanceof NodeCandidateRuntimePrivateMaterializerErrorV2) throw error;
    return fail(
      "NODE_CANDIDATE_RUNTIME_PRIVATE_V2_SOURCE_INVALID",
      `Candidate input ${input.file.logicalLocator} could not be copied`,
      error,
    );
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function captureSealedFile<TLocator extends string>(input: Readonly<{
  absolutePath: string;
  logicalLocator: TLocator;
  maxBytes: number;
}>): Readonly<{
  logicalLocator: TLocator;
  contentHash: string;
  byteLength: number;
  physicalIdentityHash: string;
}> {
  const owner = processOwner();
  let descriptor: number | undefined;
  try {
    descriptor = openSync(
      input.absolutePath,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
    const before = fstatSync(descriptor);
    const bytes = readFileSync(descriptor);
    const after = fstatSync(descriptor);
    const pathAfter = lstatSync(input.absolutePath);
    if (
      !before.isFile()
      || before.nlink !== 1
      || before.uid !== owner.uid
      || before.gid !== owner.gid
      || modeBits(before) !== 0o444
      || before.size < 1
      || before.size > input.maxBytes
      || before.dev !== after.dev
      || before.ino !== after.ino
      || before.mode !== after.mode
      || before.size !== after.size
      || before.mtimeMs !== after.mtimeMs
      || before.ctimeMs !== after.ctimeMs
      || after.dev !== pathAfter.dev
      || after.ino !== pathAfter.ino
      || after.mode !== pathAfter.mode
      || after.size !== pathAfter.size
      || bytes.byteLength !== after.size
    ) {
      bytes.fill(0);
      return fail(
        "NODE_CANDIDATE_RUNTIME_PRIVATE_V2_SOURCE_INVALID",
        `Candidate source ${input.logicalLocator} changed or is not sealed`,
      );
    }
    const value = Object.freeze({
      logicalLocator: input.logicalLocator,
      contentHash: sha256(bytes),
      byteLength: bytes.byteLength,
      physicalIdentityHash: hashCanonicalJson({
        schema: "setfarm.node-candidate-runtime-physical-file.v2",
        logicalLocator: input.logicalLocator,
        device: after.dev,
        inode: after.ino,
        mode: modeBits(after),
        ownerUid: after.uid,
        ownerGid: after.gid,
        linkCount: after.nlink,
        byteLength: after.size,
        modifiedMs: after.mtimeMs,
        changedMs: after.ctimeMs,
        contentHash: sha256(bytes),
      }),
    });
    bytes.fill(0);
    return value;
  } catch (error) {
    if (error instanceof NodeCandidateRuntimePrivateMaterializerErrorV2) throw error;
    return fail(
      "NODE_CANDIDATE_RUNTIME_PRIVATE_V2_SOURCE_INVALID",
      `Candidate source ${input.logicalLocator} could not be captured`,
      error,
    );
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function sourceCheckpoint(bundleRoot: string):
NodeCandidateRuntimePhysicalSourceCheckpointInternalV2 {
  const packageJson = captureSealedFile({
    absolutePath: path.join(bundleRoot, "package.json"),
    logicalLocator: "package.json",
    maxBytes: 4 * 1024 * 1024,
  });
  const packageLock = captureSealedFile({
    absolutePath: path.join(bundleRoot, "package-lock.json"),
    logicalLocator: "package-lock.json",
    maxBytes: 16 * 1024 * 1024,
  });
  return Object.freeze({
    packageJson,
    packageLock,
    checkpointHash: hashCanonicalJson({
      schema: "setfarm.node-candidate-runtime-source-checkpoint.v2",
      packageJson,
      packageLock,
    }),
  });
}

function createLayout(scope: AdmissionScopeV2): Readonly<{
  attemptRoot: string;
  bundleRoot: string;
  applicationRoot: string;
  attemptIdentity: RootIdentityV2;
}> {
  const owner = processOwner();
  let attemptRoot: string | undefined;
  try {
    const prefix = scope === "production_host"
      ? PRODUCTION_ATTEMPT_PREFIX_V2
      : path.join(realpathSync(os.tmpdir()), TEST_ATTEMPT_PREFIX_V2);
    attemptRoot = mkdtempSync(prefix);
    chmodSync(attemptRoot, 0o700);
    const attemptStat = lstatSync(attemptRoot);
    if (
      attemptStat.isSymbolicLink()
      || !attemptStat.isDirectory()
      || realpathSync(attemptRoot) !== attemptRoot
      || modeBits(attemptStat) !== 0o700
      || attemptStat.uid !== owner.uid
      || attemptStat.gid !== owner.gid
      || readdirSync(attemptRoot).length !== 0
    ) {
      return fail(
        "NODE_CANDIDATE_RUNTIME_PRIVATE_V2_LAYOUT_INVALID",
        "Candidate runtime attempt root is not fresh and private",
      );
    }
    const bundleRoot = path.join(attemptRoot, "candidate-bundle");
    const applicationRoot = path.join(bundleRoot, "application");
    mkdirSync(bundleRoot, { mode: 0o700 });
    mkdirSync(applicationRoot, { mode: 0o700 });
    chmodSync(bundleRoot, 0o700);
    chmodSync(applicationRoot, 0o700);
    syncPath(applicationRoot);
    syncPath(bundleRoot);
    syncPath(attemptRoot);
    const value = Object.freeze({
      attemptRoot,
      bundleRoot,
      applicationRoot,
      attemptIdentity: rootIdentity(attemptStat),
    });
    attemptRoot = undefined;
    return value;
  } catch (error) {
    if (error instanceof NodeCandidateRuntimePrivateMaterializerErrorV2) throw error;
    return fail(
      "NODE_CANDIDATE_RUNTIME_PRIVATE_V2_LAYOUT_INVALID",
      "Candidate runtime private layout could not be created",
      error,
    );
  } finally {
    if (attemptRoot) rmSync(attemptRoot, { recursive: true, force: true });
  }
}

function captureApplicationTree(
  scope: AdmissionScopeV2,
  applicationRoot: string,
): CanonicalRuntimeTreeV2 {
  const probe = getNodeScaffoldRuntimeMetadataProbeInternalV2(scope);
  return scope === "production_host"
    ? captureCanonicalRuntimeTreeV2({
        root: applicationRoot,
        profile: "dist",
        metadataProbe: probe,
      })
    : captureCanonicalRuntimeTreeV2ForTest({
        root: applicationRoot,
        profile: "dist",
        metadataProbe: probe,
      });
}

function expectedApplicationNames(profileId: NodeScaffoldProfileIdV2): readonly string[] {
  return profileId === "PROFILE_NODE_CLI_STATELESS_EXACT_V2"
    ? Object.freeze(["cli.js", "cli.setfarm.test.js"])
    : Object.freeze(["app.js", "app.setfarm.test.js"]);
}

function assertFinalTopology(input: Readonly<{
  attemptRoot: string;
  bundleRoot: string;
  profileId: NodeScaffoldProfileIdV2;
  attemptIdentity: RootIdentityV2;
}>): RootIdentityV2 {
  const owner = processOwner();
  try {
    const attempt = lstatSync(input.attemptRoot);
    const bundle = lstatSync(input.bundleRoot);
    const applicationRoot = path.join(input.bundleRoot, "application");
    const dependenciesRoot = path.join(input.bundleRoot, "node_modules");
    const packageJsonPath = path.join(input.bundleRoot, "package.json");
    const application = lstatSync(applicationRoot);
    const dependencies = lstatSync(dependenciesRoot);
    const packageJson = lstatSync(packageJsonPath);
    if (
      attempt.isSymbolicLink()
      || !attempt.isDirectory()
      || realpathSync(input.attemptRoot) !== input.attemptRoot
      || !sameRootIdentity(rootIdentity(attempt), input.attemptIdentity)
      || modeBits(attempt) !== 0o700
      || !sameStrings(readdirSync(input.attemptRoot).sort(), ["candidate-bundle"])
      || bundle.isSymbolicLink()
      || !bundle.isDirectory()
      || realpathSync(input.bundleRoot) !== input.bundleRoot
      || bundle.uid !== owner.uid
      || bundle.gid !== owner.gid
      || modeBits(bundle) !== 0o555
      || !sameStrings(readdirSync(input.bundleRoot).sort(), [
        "application",
        "node_modules",
        "package.json",
      ])
      || application.isSymbolicLink()
      || !application.isDirectory()
      || realpathSync(applicationRoot) !== applicationRoot
      || application.uid !== owner.uid
      || application.gid !== owner.gid
      || modeBits(application) !== 0o555
      || dependencies.isSymbolicLink()
      || !dependencies.isDirectory()
      || realpathSync(dependenciesRoot) !== dependenciesRoot
      || dependencies.uid !== owner.uid
      || dependencies.gid !== owner.gid
      || modeBits(dependencies) !== 0o555
      || packageJson.isSymbolicLink()
      || !packageJson.isFile()
      || packageJson.nlink !== 1
      || packageJson.uid !== owner.uid
      || packageJson.gid !== owner.gid
      || modeBits(packageJson) !== 0o444
      || !sameStrings(
        readdirSync(applicationRoot).sort(),
        [...expectedApplicationNames(input.profileId)].sort(),
      )
    ) {
      return fail(
        "NODE_CANDIDATE_RUNTIME_PRIVATE_V2_BUNDLE_INVALID",
        "Candidate runtime bundle is not the exact sealed every-and-only topology",
      );
    }
    for (const name of readdirSync(applicationRoot)) {
      const file = lstatSync(path.join(applicationRoot, name));
      if (
        file.isSymbolicLink()
        || !file.isFile()
        || file.nlink !== 1
        || file.uid !== owner.uid
        || file.gid !== owner.gid
        || modeBits(file) !== 0o444
      ) {
        return fail(
          "NODE_CANDIDATE_RUNTIME_PRIVATE_V2_BUNDLE_INVALID",
          `Candidate application member ${name} is not exactly sealed`,
        );
      }
    }
    return rootIdentity(bundle);
  } catch (error) {
    if (error instanceof NodeCandidateRuntimePrivateMaterializerErrorV2) throw error;
    return fail(
      "NODE_CANDIDATE_RUNTIME_PRIVATE_V2_BUNDLE_INVALID",
      "Candidate runtime final topology could not be authenticated",
      error,
    );
  }
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length
    && left.every((value, index) => value === right[index]);
}

function materializationIdentity(
  value: Omit<NodeCandidateRuntimePrivateMaterializationV2, "materializationHash">,
): string {
  return hashCanonicalJson({
    schema: "setfarm.node-candidate-runtime-private-materialization.v2",
    value,
  });
}

function classifyFailure(error: unknown): NodeCandidateRuntimePrivateMaterializerErrorV2 {
  if (error instanceof NodeCandidateRuntimePrivateMaterializerErrorV2) return error;
  const code = error instanceof Error
    && "code" in error
    && typeof (error as Error & { code?: unknown }).code === "string"
    ? (error as Error & { code: string }).code
    : "UNKNOWN";
  if (code.includes("RUNTIME_INSTALL") || code.includes("HOST_NODE_TOOLCHAIN")) {
    return new NodeCandidateRuntimePrivateMaterializerErrorV2(
      "NODE_CANDIDATE_RUNTIME_PRIVATE_V2_INSTALL_REJECTED",
      `Candidate runtime install authority rejected the attempt as ${code}`,
      { cause: error },
    );
  }
  if (code.includes("PRODUCTION_MATERIALIZATION")) {
    return new NodeCandidateRuntimePrivateMaterializerErrorV2(
      "NODE_CANDIDATE_RUNTIME_PRIVATE_V2_DEPENDENCY_REJECTED",
      `Candidate production dependency authority rejected the attempt as ${code}`,
      { cause: error },
    );
  }
  return new NodeCandidateRuntimePrivateMaterializerErrorV2(
    "NODE_CANDIDATE_RUNTIME_PRIVATE_V2_BUNDLE_INVALID",
    "Candidate runtime private materialization failed at an internal boundary",
    { cause: error },
  );
}

function makeWritable(absolutePath: string): void {
  let stat: Stats;
  try {
    stat = lstatSync(absolutePath);
  } catch {
    return;
  }
  if (stat.isSymbolicLink()) return;
  if (stat.isDirectory()) {
    chmodSync(absolutePath, 0o700);
    for (const name of readdirSync(absolutePath)) {
      makeWritable(path.join(absolutePath, name));
    }
  } else if (stat.isFile()) {
    chmodSync(absolutePath, 0o600);
  }
}

function cleanupOwnedAttempt(input: Readonly<{
  attemptRoot: string;
  attemptIdentity: RootIdentityV2;
}>): void {
  try {
    const stat = lstatSync(input.attemptRoot);
    if (
      stat.isSymbolicLink()
      || !stat.isDirectory()
      || realpathSync(input.attemptRoot) !== input.attemptRoot
      || !sameRootIdentity(rootIdentity(stat), input.attemptIdentity)
    ) {
      return fail(
        "NODE_CANDIDATE_RUNTIME_PRIVATE_V2_CLEANUP_FAILED",
        "Refusing to remove a replaced candidate runtime attempt root",
      );
    }
    makeWritable(input.attemptRoot);
    rmSync(input.attemptRoot, { recursive: true, force: false });
  } catch (error) {
    if (error instanceof NodeCandidateRuntimePrivateMaterializerErrorV2) throw error;
    return fail(
      "NODE_CANDIDATE_RUNTIME_PRIVATE_V2_CLEANUP_FAILED",
      "Candidate runtime attempt root could not be removed safely",
      error,
    );
  }
}

async function materializeInternal(
  input: unknown,
  expectedScope: AdmissionScopeV2,
): Promise<MaterializedNodeCandidateRuntimePrivateV2> {
  const values = exactDataRecord(input, ["runtimeInputs"]);
  const runtimeInputs = exactRuntimeInputs(values.runtimeInputs);
  const buffers = [
    runtimeInputs.packageJson.bytes,
    runtimeInputs.packageLock.bytes,
    ...runtimeInputs.application.map((file) => file.bytes),
  ];
  let layout: ReturnType<typeof createLayout> | undefined;
  let environmentOwned = false;
  let succeeded = false;
  try {
    if (runtimeInputs.admissionScope !== expectedScope) {
      return fail(
        "NODE_CANDIDATE_RUNTIME_PRIVATE_V2_SCOPE_INVALID",
        "Candidate runtime private materializer cannot promote or downgrade scope",
      );
    }
    environmentOwned = true;
    const contextBefore =
      await revalidateNodeCandidateRuntimeExecutionContextInternalV2(
        runtimeInputs.runtimeEnvironment,
      );
    if (
      contextBefore.environment.admissionScope !== expectedScope
      || contextBefore.environment.catalogBinding.profileId
        !== runtimeInputs.profileId
    ) {
      return fail(
        "NODE_CANDIDATE_RUNTIME_PRIVATE_V2_SCOPE_INVALID",
        "Candidate runtime environment and build inputs do not share scope or profile",
      );
    }
    const closure = deriveCodeOwnedNodeScaffoldProductionClosureV2(
      runtimeInputs.profileId,
    );
    if (
      runtimeInputs.packageJson.contentHash
        !== closure.sourceGraph.rootManifestRawHash
      || runtimeInputs.packageLock.contentHash !== closure.sourceGraph.lockRawHash
    ) {
      return fail(
        "NODE_CANDIDATE_RUNTIME_PRIVATE_V2_SOURCE_INVALID",
        "Candidate package manifest or lock differs from production closure source authority",
      );
    }
    layout = createLayout(expectedScope);
    writeExclusiveFile({
      absolutePath: path.join(layout.bundleRoot, "package.json"),
      file: runtimeInputs.packageJson,
    });
    writeExclusiveFile({
      absolutePath: path.join(layout.bundleRoot, "package-lock.json"),
      file: runtimeInputs.packageLock,
    });
    for (const file of runtimeInputs.application) {
      writeExclusiveFile({
        absolutePath: path.join(
          layout.applicationRoot,
          path.basename(file.logicalLocator),
        ),
        file,
      });
    }
    syncPath(layout.applicationRoot);
    syncPath(layout.bundleRoot);
    normalizeNodeScaffoldRuntimeMetadataInternalV2(
      expectedScope,
      layout.bundleRoot,
    );
    chmodSync(layout.applicationRoot, 0o555);
    syncPath(layout.applicationRoot);
    const applicationBefore = captureApplicationTree(
      expectedScope,
      layout.applicationRoot,
    );
    const sourceBefore = sourceCheckpoint(layout.bundleRoot);
    const installEvidence =
      await executeNodeCandidateRuntimeEnvironmentNpmCiInternalV2(
        runtimeInputs.runtimeEnvironment,
        layout.bundleRoot,
      );
    const sourceAfter = sourceCheckpoint(layout.bundleRoot);
    if (
      canonicalJsonStringify(sourceBefore)
        !== canonicalJsonStringify(sourceAfter)
      || sourceBefore.packageJson.contentHash
        !== runtimeInputs.packageJson.contentHash
      || sourceBefore.packageLock.contentHash
        !== runtimeInputs.packageLock.contentHash
    ) {
      return fail(
        "NODE_CANDIDATE_RUNTIME_PRIVATE_V2_SOURCE_INVALID",
        "Candidate package manifest or lock changed across production install",
      );
    }
    const dependencies = materializeNodeScaffoldProductionDependenciesInternalV2({
      admissionScope: expectedScope,
      nodeModulesRoot: path.join(layout.bundleRoot, "node_modules"),
      productionClosure: closure,
    });
    const applicationAfter = captureApplicationTree(
      expectedScope,
      layout.applicationRoot,
    );
    if (
      canonicalJsonStringify(applicationBefore)
        !== canonicalJsonStringify(applicationAfter)
    ) {
      return fail(
        "NODE_CANDIDATE_RUNTIME_PRIVATE_V2_BUNDLE_INVALID",
        "Candidate application tree changed across dependency materialization",
      );
    }
    rmSync(path.join(layout.bundleRoot, "package-lock.json"), { force: false });
    syncPath(layout.bundleRoot);
    chmodSync(layout.bundleRoot, 0o555);
    syncPath(layout.bundleRoot);
    const bundleIdentity = assertFinalTopology({
      attemptRoot: layout.attemptRoot,
      bundleRoot: layout.bundleRoot,
      profileId: runtimeInputs.profileId,
      attemptIdentity: layout.attemptIdentity,
    });
    const contextAfter =
      await revalidateNodeCandidateRuntimeExecutionContextInternalV2(
        runtimeInputs.runtimeEnvironment,
      );
    if (
      canonicalJsonStringify(contextBefore)
        !== canonicalJsonStringify(contextAfter)
      || installEvidence.hostToolchainReceiptHash
        !== contextAfter.hostToolchain.receiptHash
      || installEvidence.environmentHash
        !== contextAfter.environment.environment.environmentHash
      || installEvidence.npmClosureHash
        !== contextAfter.hostToolchain.npm.closureHash
      || dependencies.productionClosureHash !== closure.closureHash
    ) {
      return fail(
        "NODE_CANDIDATE_RUNTIME_PRIVATE_V2_AUTHORITY_MISMATCH",
        "Candidate runtime host, environment, install and production closure do not join",
      );
    }
    const packageJson = Object.freeze({
      logicalLocator: "candidate-bundle/package.json" as const,
      contentHash: sourceAfter.packageJson.contentHash,
      byteLength: sourceAfter.packageJson.byteLength,
      mode: "0444" as const,
    });
    const rootMembershipHash = hashCanonicalJson({
      schema: "setfarm.node-candidate-runtime-root-membership.v2",
      logicalRoot: "candidate-bundle",
      rootMode: "0555",
      allowedRootEntries: ["application", "node_modules", "package.json"],
      applicationTreeHash: applicationAfter.treeHash,
      dependencyTreeHash: dependencies.dependencyTree.treeHash,
      productionGraphHash: dependencies.productionGraph.resolutionGraphHash,
      packageJson,
    });
    const identity = {
      admissionScope: expectedScope,
      profileId: runtimeInputs.profileId,
      pathDisclosure: "forbidden" as const,
      scaffoldBaseReceiptHash: runtimeInputs.scaffoldBaseReceiptHash,
      sourceMaterializationReceiptHash:
        runtimeInputs.sourceMaterializationReceiptHash,
      dependencyReceiptHash: runtimeInputs.dependencyReceiptHash,
      dependencyIdentityHash: runtimeInputs.dependencyIdentityHash,
      environment: contextAfter.environment,
      hostToolchain: contextAfter.hostToolchain,
      productionClosure: closure,
      sourceBefore,
      sourceAfter,
      installEvidence,
      applicationTree: applicationAfter,
      dependencyTree: dependencies.dependencyTree,
      productionGraph: dependencies.productionGraph,
      packageJson,
      rootMembershipHash,
    } satisfies Omit<
      NodeCandidateRuntimePrivateMaterializationV2,
      "materializationHash"
    >;
    const value = deepFreezeJson({
      ...identity,
      materializationHash: materializationIdentity(identity),
    });
    const lifecycle = { status: "ready" as const };
    const state: PrivateStateV2 = Object.freeze({
      admissionScope: expectedScope,
      profileId: runtimeInputs.profileId,
      attemptRoot: layout.attemptRoot,
      bundleRoot: layout.bundleRoot,
      attemptIdentity: layout.attemptIdentity,
      bundleIdentity,
      environment: runtimeInputs.runtimeEnvironment,
      productionClosure: closure,
      value,
      lifecycle,
    });
    const handle = new MaterializedNodeCandidateRuntimePrivateV2(
      constructorCapabilityV2,
      state,
    );
    layout = undefined;
    succeeded = true;
    return handle;
  } catch (error) {
    throw classifyFailure(error);
  } finally {
    for (const bytes of buffers) bytes.fill(0);
    if (!succeeded) {
      let cleanupError: unknown;
      if (layout) {
        try {
          cleanupOwnedAttempt({
            attemptRoot: layout.attemptRoot,
            attemptIdentity: layout.attemptIdentity,
          });
        } catch (error) {
          cleanupError = error;
        }
      }
      if (environmentOwned) {
        try {
          destroyNodeScaffoldExecutionEnvironmentV2(
            runtimeInputs.runtimeEnvironment,
          );
        } catch (error) {
          cleanupError ??= error;
        }
      }
      if (cleanupError !== undefined) {
        throw new NodeCandidateRuntimePrivateMaterializerErrorV2(
          "NODE_CANDIDATE_RUNTIME_PRIVATE_V2_CLEANUP_FAILED",
          "Failed candidate runtime attempt could not clean its owned roots",
          { cause: cleanupError },
        );
      }
    }
  }
}

export function materializeNodeCandidateRuntimePrivateV2(
  input: unknown,
): Promise<MaterializedNodeCandidateRuntimePrivateV2> {
  return materializeInternal(input, "production_host");
}

export function materializeNodeCandidateRuntimePrivateV2ForTest(
  input: unknown,
): Promise<MaterializedNodeCandidateRuntimePrivateV2> {
  return materializeInternal(input, "test_fixture");
}

function authenticState(
  handle: MaterializedNodeCandidateRuntimePrivateV2,
): PrivateStateV2 {
  if (
    typeof handle !== "object"
    || handle === null
    || isProxy(handle)
    || Object.getPrototypeOf(handle)
      !== MaterializedNodeCandidateRuntimePrivateV2.prototype
  ) {
    return fail(
      "NODE_CANDIDATE_RUNTIME_PRIVATE_V2_AUTHORITY_UNAUTHENTICATED",
      "Candidate runtime operation requires one authentic private handle",
    );
  }
  const state = privateStateV2.get(handle);
  if (!state) {
    return fail(
      "NODE_CANDIDATE_RUNTIME_PRIVATE_V2_AUTHORITY_UNAUTHENTICATED",
      "Candidate runtime operation requires one authentic private handle",
    );
  }
  return state;
}

export async function revalidateNodeCandidateRuntimePrivateV2(
  handle: MaterializedNodeCandidateRuntimePrivateV2,
): Promise<NodeCandidateRuntimePrivateMaterializationV2> {
  const state = authenticState(handle);
  if (state.lifecycle.status === "destroyed") {
    return fail(
      "NODE_CANDIDATE_RUNTIME_PRIVATE_V2_DESTROYED",
      "Candidate runtime private authority has already been destroyed",
    );
  }
  const bundleIdentity = assertFinalTopology({
    attemptRoot: state.attemptRoot,
    bundleRoot: state.bundleRoot,
    profileId: state.profileId,
    attemptIdentity: state.attemptIdentity,
  });
  if (!sameRootIdentity(bundleIdentity, state.bundleIdentity)) {
    return fail(
      "NODE_CANDIDATE_RUNTIME_PRIVATE_V2_AUTHORITY_MISMATCH",
      "Candidate runtime bundle root was replaced",
    );
  }
  const context = await revalidateNodeCandidateRuntimeExecutionContextInternalV2(
    state.environment,
  );
  const application = verifyCanonicalRuntimeTreeV2({
    root: path.join(state.bundleRoot, "application"),
    candidate: state.value.applicationTree,
    metadataProbe: getNodeScaffoldRuntimeMetadataProbeInternalV2(
      state.admissionScope,
    ),
  });
  const dependencies = revalidateNodeScaffoldProductionDependenciesInternalV2({
    admissionScope: state.admissionScope,
    nodeModulesRoot: path.join(state.bundleRoot, "node_modules"),
    productionClosure: state.productionClosure,
    dependencyTree: state.value.dependencyTree,
    productionGraph: state.value.productionGraph,
  });
  const packageJson = captureSealedFile({
    absolutePath: path.join(state.bundleRoot, "package.json"),
    logicalLocator: "package.json",
    maxBytes: 4 * 1024 * 1024,
  });
  const freshClosure = verifyCodeOwnedNodeScaffoldProductionClosureV2(
    state.productionClosure,
  );
  if (
    packageJson.physicalIdentityHash
      !== state.value.sourceAfter.packageJson.physicalIdentityHash
  ) {
    return fail(
      "NODE_CANDIDATE_RUNTIME_PRIVATE_V2_AUTHORITY_MISMATCH",
      "Candidate runtime package manifest physical identity changed",
    );
  }
  const freshPackageJson = {
    logicalLocator: "candidate-bundle/package.json" as const,
    contentHash: packageJson.contentHash,
    byteLength: packageJson.byteLength,
    mode: "0444" as const,
  };
  const rootMembershipHash = hashCanonicalJson({
    schema: "setfarm.node-candidate-runtime-root-membership.v2",
    logicalRoot: "candidate-bundle",
    rootMode: "0555",
    allowedRootEntries: ["application", "node_modules", "package.json"],
    applicationTreeHash: application.treeHash,
    dependencyTreeHash: dependencies.dependencyTree.treeHash,
    productionGraphHash: dependencies.productionGraph.resolutionGraphHash,
    packageJson: freshPackageJson,
  });
  const freshIdentity = {
    admissionScope: state.admissionScope,
    profileId: state.profileId,
    pathDisclosure: "forbidden" as const,
    scaffoldBaseReceiptHash: state.value.scaffoldBaseReceiptHash,
    sourceMaterializationReceiptHash:
      state.value.sourceMaterializationReceiptHash,
    dependencyReceiptHash: state.value.dependencyReceiptHash,
    dependencyIdentityHash: state.value.dependencyIdentityHash,
    environment: context.environment,
    hostToolchain: context.hostToolchain,
    productionClosure: freshClosure,
    sourceBefore: state.value.sourceBefore,
    sourceAfter: state.value.sourceAfter,
    installEvidence: state.value.installEvidence,
    applicationTree: application,
    dependencyTree: dependencies.dependencyTree,
    productionGraph: dependencies.productionGraph,
    packageJson: freshPackageJson,
    rootMembershipHash,
  } satisfies Omit<
    NodeCandidateRuntimePrivateMaterializationV2,
    "materializationHash"
  >;
  const fresh = deepFreezeJson({
    ...freshIdentity,
    materializationHash: materializationIdentity(freshIdentity),
  });
  if (
    canonicalJsonStringify(fresh) !== canonicalJsonStringify(state.value)
  ) {
    return fail(
      "NODE_CANDIDATE_RUNTIME_PRIVATE_V2_AUTHORITY_MISMATCH",
      "Candidate runtime private authority no longer reproduces from physical evidence",
    );
  }
  return defensiveCopy(fresh);
}

/**
 * @internal
 *
 * Physical locators never enter a serialized bundle or public authority
 * handle. This bridge accepts only the otherwise-unexposed authentic private
 * materializer handle and fresh-reproduces the complete bundle before giving
 * the execution layer its immediate pre-spawn context.
 */
export type NodeCandidateRuntimePhysicalLaunchContextInternalV2 = Readonly<{
  admissionScope: AdmissionScopeV2;
  profileId: NodeScaffoldProfileIdV2;
  bundleRoot: string;
  applicationRoot: string;
  materializationHash: string;
  applicationTree: CanonicalRuntimeTreeV2;
  applicationEntrypoint: Readonly<{
    logicalLocator: "cli.js" | "app.js";
    absolutePath: string;
    contentHash: string;
    byteLength: number;
    mode: "0444";
    physicalIdentityHash: string;
  }>;
  applicationTestFile: Readonly<{
    logicalLocator: "cli.setfarm.test.js" | "app.setfarm.test.js";
    absolutePath: string;
    contentHash: string;
    byteLength: number;
    mode: "0444";
    physicalIdentityHash: string;
  }>;
  environment: Awaited<
    ReturnType<
      typeof acquireNodeCandidateRuntimeLaunchEnvironmentInternalV2
    >
  >;
}>;

export async function acquireNodeCandidateRuntimePhysicalLaunchContextInternalV2(
  handle: MaterializedNodeCandidateRuntimePrivateV2,
): Promise<NodeCandidateRuntimePhysicalLaunchContextInternalV2> {
  const state = authenticState(handle);
  const materialization = await revalidateNodeCandidateRuntimePrivateV2(handle);
  const environment =
    await acquireNodeCandidateRuntimeLaunchEnvironmentInternalV2(
      state.environment,
    );
  const applicationRoot = path.join(state.bundleRoot, "application");
  const logicalLocator = state.profileId
    === "PROFILE_NODE_CLI_STATELESS_EXACT_V2"
    ? "cli.js" as const
    : "app.js" as const;
  const testLogicalLocator = state.profileId
    === "PROFILE_NODE_CLI_STATELESS_EXACT_V2"
    ? "cli.setfarm.test.js" as const
    : "app.setfarm.test.js" as const;
  const entry = materialization.applicationTree.entries.find((candidate) =>
    candidate.path === logicalLocator);
  const testEntry = materialization.applicationTree.entries.find((candidate) =>
    candidate.path === testLogicalLocator);
  if (
    !entry
    || entry.type !== "file"
    || entry.mode !== "0444"
    || entry.executable
    || !testEntry
    || testEntry.type !== "file"
    || testEntry.mode !== "0444"
    || testEntry.executable
  ) {
    return fail(
      "NODE_CANDIDATE_RUNTIME_PRIVATE_V2_AUTHORITY_MISMATCH",
      "Candidate runtime entrypoint or generated test is absent or not one sealed data module",
    );
  }
  const capturedEntrypoint = captureSealedFile({
    absolutePath: path.join(applicationRoot, logicalLocator),
    logicalLocator,
    maxBytes: 64 * 1024 * 1024,
  });
  const capturedTestFile = captureSealedFile({
    absolutePath: path.join(applicationRoot, testLogicalLocator),
    logicalLocator: testLogicalLocator,
    maxBytes: 32 * 1024 * 1024,
  });
  if (
    environment.admissionScope !== state.admissionScope
    || environment.profileId !== state.profileId
    || materialization.environment.receiptHash
      !== environment.environmentReceiptHash
    || materialization.hostToolchain.receiptHash
      !== environment.hostRuntime.hostToolchainReceiptHash
    || capturedEntrypoint.contentHash !== entry.contentHash
    || capturedEntrypoint.byteLength !== entry.byteLength
    || capturedTestFile.contentHash !== testEntry.contentHash
    || capturedTestFile.byteLength !== testEntry.byteLength
  ) {
    return fail(
      "NODE_CANDIDATE_RUNTIME_PRIVATE_V2_AUTHORITY_MISMATCH",
      "Candidate runtime launch context does not join its exact environment",
    );
  }
  return Object.freeze({
    admissionScope: state.admissionScope,
    profileId: state.profileId,
    bundleRoot: state.bundleRoot,
    applicationRoot,
    materializationHash: materialization.materializationHash,
    applicationTree: defensiveCopy(materialization.applicationTree),
    applicationEntrypoint: Object.freeze({
      ...capturedEntrypoint,
      absolutePath: path.join(applicationRoot, logicalLocator),
      mode: "0444" as const,
    }),
    applicationTestFile: Object.freeze({
      ...capturedTestFile,
      absolutePath: path.join(applicationRoot, testLogicalLocator),
      mode: "0444" as const,
    }),
    environment,
  });
}

export function destroyNodeCandidateRuntimePrivateV2(
  handle: MaterializedNodeCandidateRuntimePrivateV2,
): void {
  const state = authenticState(handle);
  if (state.lifecycle.status === "destroyed") return;
  destroyNodeScaffoldExecutionEnvironmentV2(state.environment);
  cleanupOwnedAttempt({
    attemptRoot: state.attemptRoot,
    attemptIdentity: state.attemptIdentity,
  });
  state.lifecycle.status = "destroyed";
}
