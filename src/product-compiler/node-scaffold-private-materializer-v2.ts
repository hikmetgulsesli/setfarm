import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
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
  readlinkSync,
  realpathSync,
  rmdirSync,
  unlinkSync,
  writeSync,
  type BigIntStats,
  type Stats,
} from "node:fs";
import path from "node:path";
import { isProxy } from "node:util/types";

import type { SemanticArtifactEnvelopeV1 } from "./artifact-envelope.js";
import {
  copyVerifiedDeepByteBundleBytesV2,
  copyVerifiedSemanticArtifactEnvelopeV1,
  verifyDeepByteBundleFromCasV2,
  verifySemanticArtifactEnvelopeFromCasV1,
  type DeepByteBundleCasAuthorityV2,
  type VerifiedDeepByteBundleV2,
} from "./deep-byte-bundle-verifier-v2.js";
import { hashCanonicalJson } from "./canonical-json.js";
import {
  matchesExactStableFilesystemObjectV2,
} from "./exact-stable-filesystem-identity-v2.js";
import {
  captureCanonicalRuntimeTreeV2,
  captureCanonicalRuntimeTreeV2ForTest,
  verifyCanonicalRuntimeTreeV2,
  type CanonicalRuntimeMetadataProbeV2,
} from "../execution/canonical-runtime-tree-v2.js";
import {
  CANONICAL_RUNTIME_TREE_V2_PROFILES,
  canonicalRuntimePathIssuesV2,
  type CanonicalRuntimeTreeV2,
} from "../execution/schemas/canonical-runtime-tree-v2.js";
import {
  getCodeOwnedNodeScaffoldAssetPublicationV2,
  getCodeOwnedNodeScaffoldToolchainCatalogV2,
  getCodeOwnedNodeScaffoldToolchainEntryV2,
  type NodeScaffoldAssetRoleV2,
  type NodeScaffoldProfileIdV2,
} from "./node-scaffold-toolchain-catalog-v2.js";
import type {
  PreparedNodeProductSourcePublicationV1,
} from "./node-product-source-publication-v1.js";
import {
  inspectNodeScaffoldExecutionEnvironmentReceiptV2,
  isProductionNodeScaffoldExecutionEnvironmentV2,
  revalidateNodeScaffoldHostToolchainLogicalIdentityInternalV3,
  revalidateNodeScaffoldExecutionEnvironmentV2,
  destroyNodeScaffoldExecutionEnvironmentV2,
  createNodeCandidateRuntimeExecutionEnvironmentInternalV2,
  executeNodeScaffoldEnvironmentBuildV2,
  executeNodeScaffoldEnvironmentNpmCiV2,
  type NodeScaffoldExecutionEnvironmentV2,
} from "./node-scaffold-execution-environment-v2.js";
import type {
  HostNodeToolchainBuildCompilerTargetV2,
} from "./host-node-toolchain-authority-v2.js";
import {
  BUILD_DEPENDENCY_MATERIALIZATION_RECEIPT_V2_SCHEMA,
  PRIVATE_STAGED_MATERIALIZER_AUTHORITY_REF_V2,
  PRIVATE_STAGED_MATERIALIZER_AUTHORITY_V2_SCHEMA,
  PRIVATE_STAGED_MATERIALIZER_VERSION_V2,
  SCAFFOLD_BASE_MATERIALIZATION_RECEIPT_V2_SCHEMA,
  BuildDependencyMaterializationReceiptV2Schema,
  PrivateStagedMaterializerAuthorityV2Schema,
  ScaffoldBaseMaterializationReceiptV2Schema,
  hashBuildDependencyIdentityV2,
  hashBuildDependencyMaterializationReceiptV2,
  hashPrivateStagedMaterializerAuthorityV2,
  hashScaffoldBaseMaterializationReceiptV2,
  hashScaffoldBaseSemanticInputV2,
  hashScaffoldBaseStateV2,
  type BuildDependencyMaterializationReceiptHashPayloadV2,
  type BuildDependencyMaterializationReceiptV2,
  type PrivateStagedMaterializerAuthorityV2,
  type ScaffoldBaseMaterializationReceiptHashPayloadV2,
  type ScaffoldBaseMaterializationReceiptV2,
} from "./schemas/node-scaffold-private-materialization-v2.js";
import {
  NODE_SCAFFOLD_EXECUTION_ENVIRONMENT_RECEIPT_V2_SCHEMA,
} from "./schemas/node-scaffold-execution-environment-v2.js";
import {
  HOST_NODE_TOOLCHAIN_RECEIPT_V2_SCHEMA,
  type HostNodeToolchainLogicalProjectionV3,
} from "./schemas/host-node-toolchain-receipt-v2.js";
import {
  DEEP_BYTE_BUNDLE_VERIFICATION_RECEIPT_V2_SCHEMA,
  hashDeepByteBundleConsumerBindingV2,
} from "./schemas/deep-byte-bundle-verification-receipt-v2.js";
import {
  NodeProductRuntimeSourceReceiptV2Schema,
  type NodeProductRuntimeSourceReceiptV2,
} from "./schemas/node-product-runtime-source-v2.js";
import {
  NodeProductTestSourceReceiptV2Schema,
  type NodeProductTestSourceReceiptV2,
} from "./schemas/node-product-test-source-v2.js";
import {
  NODE_PRODUCT_SOURCE_PUBLICATION_RECEIPT_V1_SCHEMA,
  NodeProductSourcePublicationReceiptV1Schema,
  type NodeProductSourcePublicationReceiptV1,
  type NodeProductSourceRoleV1,
} from "./schemas/node-product-source-publication-v1.js";
import {
  NODE_PRODUCT_SOURCE_MATERIALIZATION_BLOCKER_CODES_V1,
  NODE_PRODUCT_SOURCE_MATERIALIZATION_RECEIPT_V1_SCHEMA,
  NODE_PRODUCT_SOURCE_MATERIALIZATION_RECEIPT_V1_VERSION,
  NODE_PRODUCT_SOURCE_MATERIALIZER_AUTHORITY_REF_V1,
  NODE_PRODUCT_SOURCE_MATERIALIZER_CONTRACT_HASH_V1,
  NodeProductSourceMaterializationReceiptV1Schema,
  hashNodeProductSourceMaterializationMembershipV1,
  hashNodeProductSourceMaterializationReceiptV1,
  type NodeProductSourceMaterializationEntryV1,
  type NodeProductSourceMaterializationReceiptV1,
} from "./schemas/node-product-source-materialization-v1.js";
import {
  SEMANTIC_ARTIFACT_CAS_VERIFICATION_RECEIPT_V1_SCHEMA,
} from "./schemas/semantic-artifact-cas-verification-receipt-v1.js";
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
  | "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_INSTALL_ALREADY_CONSUMED"
  | "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_DEPENDENCY_INSTALL_FAILED"
  | "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_DEPENDENCY_GRAPH_INVALID"
  | "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_DEPENDENCY_CAPSULE_INVALID"
  | "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_SOURCE_ALREADY_CONSUMED"
  | "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_SOURCE_AUTHORITY_INVALID"
  | "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_SOURCE_MATERIALIZATION_FAILED"
  | "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_BUILD_ALREADY_CONSUMED"
  | "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_BUILD_OUTPUT_INVALID"
  | "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_RUNTIME_BUNDLE_ALREADY_CONSUMED"
  | "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_RUNTIME_BUNDLE_INPUT_INVALID"
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

type RawInstallEntryV2 = Readonly<{
  locator: string;
  type: "directory" | "file" | "symbolic_link";
  mode: string;
  rawHash?: string;
  rawByteLength?: number;
  linkTarget?: string;
}>;

type InstalledBinCaptureV2 = Readonly<{
  commandName: string;
  packagePath: string;
  targetLocator: string;
  linkLocator: string;
  linkTargetHash: string;
  targetContentHash: string;
}>;

type RawDependencyCaptureV2 = Readonly<{
  fileCount: number;
  directoryCount: number;
  symbolicLinkCount: number;
  totalBytes: number;
  membershipHash: string;
  hiddenLockRawHash: string;
  hiddenLockGraphHash: string;
  installedPackageMembershipHash: string;
  installedBins: readonly InstalledBinCaptureV2[];
  installedBinsMembershipHash: string;
}>;

type DependencyMaterializationCaptureV2 = Readonly<{
  raw: RawDependencyCaptureV2;
  capsule: CanonicalRuntimeTreeV2;
  metadataProbe: CanonicalRuntimeMetadataProbeV2;
  metadataAuthority:
    | "code_owned_darwin_acl_nonprovenance_xattr_probe_v2"
    | "test_fixture_clear_probe";
}>;

type SourceReceiptV1 = NodeProductRuntimeSourceReceiptV2
  | NodeProductTestSourceReceiptV2;

type PublishedSourceArtifactAuthorityV1 = Pick<
  PreparedNodeProductSourcePublicationV1,
  | "sourceRole"
  | "receipt"
  | "receiptEnvelope"
  | "receiptArtifactHash"
  | "receiptArtifactByteLength"
  | "sourceReceipt"
  | "sourceReceiptEnvelope"
  | "sourceReceiptArtifactHash"
  | "sourceReceiptArtifactByteLength"
>;

type CapturedPublishedSourceV1 = Readonly<{
  sourceRole: NodeProductSourceRoleV1;
  publicationReceipt: NodeProductSourcePublicationReceiptV1;
  publicationReceiptEnvelope: Readonly<SemanticArtifactEnvelopeV1>;
  publicationReceiptArtifactHash: string;
  publicationReceiptArtifactByteLength: number;
  publicationCasVerificationReceiptHash: string;
  sourceReceipt: SourceReceiptV1;
  sourceReceiptEnvelope: Readonly<SemanticArtifactEnvelopeV1>;
  sourceReceiptArtifactHash: string;
  sourceReceiptArtifactByteLength: number;
  sourceReceiptCasVerificationReceiptHash: string;
  deepVerificationReceiptHash: string;
  consumerBindingHash: string;
  bytes: Buffer;
}>;

type PhysicalSourceCaptureV1 = Readonly<{
  sourceRole: NodeProductSourceRoleV1;
  normalizedLocator: string;
  fingerprint: FingerprintV2;
  contentHash: string;
  physicalIdentityHash: string;
}>;

type SourceMaterializationCaptureV1 = Readonly<{
  directoryFingerprint: FingerprintV2;
  directoryPhysicalIdentityHash: string;
  sources: readonly PhysicalSourceCaptureV1[];
  membershipHash: string;
}>;

export type NodeCandidateBuildOutputFileV2 = Readonly<{
  normalizedLocator:
    | "dist/app.js"
    | "dist/app.setfarm.test.js"
    | "dist/cli.js"
    | "dist/cli.setfarm.test.js";
  mode: "0444";
  executable: false;
  contentHash: string;
  byteLength: number;
  physicalIdentityHash: string;
}>;

export type NodeCandidateBuildOutputV2 = Readonly<{
  admissionScope: "production_host" | "test_fixture";
  profileId: NodeScaffoldProfileIdV2;
  pathDisclosure: "forbidden";
  sourceMaterializationReceiptHash: string;
  dependencyReceiptHash: string;
  dependencyIdentityHash: string;
  memberCount: 2;
  files: readonly [NodeCandidateBuildOutputFileV2, NodeCandidateBuildOutputFileV2];
  membershipHash: string;
  tree: CanonicalRuntimeTreeV2;
}>;

type CandidateBuildOutputCaptureV2 = Readonly<{
  value: NodeCandidateBuildOutputV2;
  metadataProbe: CanonicalRuntimeMetadataProbeV2;
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

type SourceCasRevalidationAuthorityV1 = Readonly<{
  casAuthority: DeepByteBundleCasAuthorityV2;
  sources: readonly PublishedSourceArtifactAuthorityV1[];
}>;

type MutableLifecycleV2 = {
  status:
    | "base_ready"
    | "install_claimed"
    | "installing"
    | "install_consumed"
    | "dependencies_ready"
    | "source_claimed"
    | "sources_ready"
    | "build_claimed"
    | "building"
    | "build_process_consumed"
    | "build_ready"
    | "runtime_bundle_claimed"
    | "runtime_bundle_consumed"
    | "destroyed";
  dependencyReceipt?: BuildDependencyMaterializationReceiptV2;
  dependencyCapture?: DependencyMaterializationCaptureV2;
  sourceReceipt?: NodeProductSourceMaterializationReceiptV1;
  sourceCapture?: SourceMaterializationCaptureV1;
  sourceAuthority?: SourceCasRevalidationAuthorityV1;
  buildOutput?: CandidateBuildOutputCaptureV2;
  cleanupCensus: PrivateCleanupCensusV2;
};

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
  cleanupTestHooks?: NodeScaffoldPrivateMaterializerTestHooksV2;
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
  | "after_private_root_create"
  | "after_dependency_capsule_create"
  | "after_project_directory_create"
  | "after_package_lock_create"
  | "after_package_json_create"
  | "after_tsconfig_create"
  | "after_private_root_fsync"
  | "after_layout_fsync"
  | "after_package_lock_fsync"
  | "after_package_json_fsync"
  | "after_tsconfig_fsync"
  | "after_project_fsync"
  | "after_final_capture";

export type NodeScaffoldPrivateMaterializerTestHooksV2 = Readonly<{
  afterBoundary?: (boundary: NodeScaffoldPrivateMaterializerCrashBoundaryV2) => void;
  afterCleanupDirectoryWritable?: (locator: string) => void;
  afterCleanupDirectoryDescriptorClose?: (locator: string) => void;
  beforeCleanupCensusDirectoryRead?: (locator: string) => void;
  afterCleanupCensusDirectoryClose?: (locator: string) => void;
  afterDependencyCapsuleDestinationCreate?: (locator: string) => void;
  afterDependencyCapsuleSourceDescriptorClose?: (locator: string) => void;
  afterDependencyCapsuleDestinationDescriptorClose?: (locator: string) => void;
  beforeDependencyCapsuleSourceDirectoryRead?: (locator: string) => void;
  afterCleanupDirectoryModeRestore?: (locator: string) => void;
  beforeRawDependencyFileRead?: (locator: string, absolutePath: string) => void;
  maxRawDependencyDirectoryEntriesForTest?: number;
}>;

export type NodeProductSourceMaterializerCrashBoundaryV1 =
  | "after_source_preclaim"
  | "after_source_authority_verification"
  | "after_source_directory_create"
  | "after_runtime_source_create"
  | "after_test_source_create"
  | "after_source_directory_fsync"
  | "after_runtime_source_fsync"
  | "after_test_source_fsync"
  | "after_source_project_fsync"
  | "after_source_final_capture";

export type NodeProductSourceMaterializerTestHooksV1 = Readonly<{
  afterBoundary?: (boundary: NodeProductSourceMaterializerCrashBoundaryV1) => void;
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
  label: string;
  maxNames: number;
  errorCode: NodeScaffoldPrivateMaterializerErrorCodeV2;
  beforeRead?: () => void;
  afterClose?: () => void;
  membershipBoundLabel?: "fixed" | "admitted";
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
            `${input.label} exceeded its ${input.membershipBoundLabel ?? "fixed"} membership bound`,
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
      `${input.label} read or descriptor close failed`,
      new AggregateError(errors, `${input.label} read and descriptor finalization failures`),
    ),
  });
}

function readExactDescriptorBytesV2(input: Readonly<{
  descriptor: number;
  admittedByteLength: number;
  label: string;
  errorCode: NodeScaffoldPrivateMaterializerErrorCodeV2;
}>): Buffer {
  if (!Number.isSafeInteger(input.admittedByteLength) || input.admittedByteLength < 0) {
    return fail(input.errorCode, `${input.label} has an invalid admitted byte length`);
  }
  const bytes = Buffer.alloc(input.admittedByteLength);
  let byteLength = 0;
  while (byteLength < bytes.byteLength) {
    const count = readSync(
      input.descriptor,
      bytes,
      byteLength,
      bytes.byteLength - byteLength,
      null,
    );
    if (count === 0) break;
    byteLength += count;
  }
  const growthProbe = Buffer.allocUnsafe(1);
  const growthCount = readSync(input.descriptor, growthProbe, 0, 1, null);
  if (byteLength !== input.admittedByteLength || growthCount !== 0) {
    bytes.fill(0);
    return fail(input.errorCode, `${input.label} changed outside its admitted byte length`);
  }
  return bytes;
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
  return runWithIndependentFinalizersV2({
    operation: () => {
      descriptor = openSync(absolutePath, constants.O_RDONLY | constants.O_NOFOLLOW);
      fsyncSync(descriptor);
    },
    finalizers: [() => {
      if (descriptor !== undefined) closeSync(descriptor);
    }],
    onFinalizerFailure: (errors) => fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_MATERIALIZATION_FAILED",
      `Private directory ${absolutePath} sync or descriptor close failed`,
      new AggregateError(errors, "Private directory sync and descriptor finalization failures"),
    ),
  });
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
  initialCleanupCensus: PrivateCleanupCensusV2;
}> {
  const prefix = input.admissionScope === "production_host"
    ? PRODUCTION_PRIVATE_ROOT_PREFIX_V2
    : path.join(input.scratchParent!, "attempt-");
  const owner = processOwnerV2();
  let privateRoot: string | undefined;
  let initialRootFingerprint: FingerprintV2 | undefined;
  let cleanupCensus: PrivateCleanupCensusV2 | undefined;
  try {
    privateRoot = mkdtempSync(prefix);
    cleanupCensus = extendPrivateCleanupCensusWithCreatedMemberV2({
      privateRoot,
      current: cleanupCensus,
      absolutePath: privateRoot,
      locator: ".",
    });
    input.hooks?.afterBoundary?.("after_private_root_create");
    cleanupCensus = capturePrivateCleanupCensusV2(privateRoot);
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
    cleanupCensus = capturePrivateCleanupCensusV2(privateRoot);
    input.hooks?.afterBoundary?.("after_private_root_fsync");
    const projectRoot = path.join(privateRoot, "project");
    const dependencyCapsuleRoot = path.join(privateRoot, "dependency-capsule");
    mkdirSync(dependencyCapsuleRoot, { mode: 0o700 });
    cleanupCensus = extendPrivateCleanupCensusWithCreatedMemberV2({
      privateRoot,
      current: cleanupCensus,
      absolutePath: dependencyCapsuleRoot,
      locator: "dependency-capsule",
    });
    input.hooks?.afterBoundary?.("after_dependency_capsule_create");
    cleanupCensus = capturePrivateCleanupCensusV2(privateRoot);
    mkdirSync(projectRoot, { mode: 0o700 });
    cleanupCensus = extendPrivateCleanupCensusWithCreatedMemberV2({
      privateRoot,
      current: cleanupCensus,
      absolutePath: projectRoot,
      locator: "project",
    });
    input.hooks?.afterBoundary?.("after_project_directory_create");
    cleanupCensus = capturePrivateCleanupCensusV2(privateRoot);
    chmodSync(dependencyCapsuleRoot, 0o700);
    chmodSync(projectRoot, 0o700);
    syncDirectoryV2(dependencyCapsuleRoot);
    syncDirectoryV2(projectRoot);
    syncDirectoryV2(privateRoot);
    cleanupCensus = capturePrivateCleanupCensusV2(privateRoot);
    input.hooks?.afterBoundary?.("after_layout_fsync");
    const result = Object.freeze({
      privateRoot,
      projectRoot,
      dependencyCapsuleRoot,
      initialRootFingerprint,
      initialCleanupCensus: cleanupCensus,
    });
    privateRoot = undefined;
    return result;
  } catch (error) {
    let cleanupError: unknown;
    if (privateRoot && cleanupCensus) {
      try {
        safeRemoveOwnedAttemptV2(privateRoot, cleanupCensus);
      } catch (candidate) {
        cleanupError = candidate;
      }
    }
    if (cleanupError !== undefined) {
      return fail(
        error instanceof NodeScaffoldPrivateMaterializerErrorV2
          ? error.code
          : "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_MATERIALIZATION_FAILED",
        `Fresh private scaffold layout failed and cleanup retained its authenticated root ${privateRoot}`,
        new AggregateError(
          [error, cleanupError],
          "Private layout failure and exact cleanup failure",
        ),
      );
    }
    if (error instanceof NodeScaffoldPrivateMaterializerErrorV2) throw error;
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_MATERIALIZATION_FAILED",
      "Fresh private scaffold layout could not be created",
      error,
    );
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
  onCreated: (absolutePath: string) => void;
}>): CapturedPhysicalAssetV2 {
  const absolutePath = path.join(input.projectRoot, input.asset.normalizedLocator);
  let descriptor: number | undefined;
  try {
    return runWithIndependentFinalizersV2({
      operation: () => {
        descriptor = openSync(
      absolutePath,
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW,
      0o600,
    );
    input.onCreated(absolutePath);
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
      },
      finalizers: [() => {
        if (descriptor !== undefined) closeSync(descriptor);
      }],
      onFinalizerFailure: (errors) => fail(
        "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_MATERIALIZATION_FAILED",
        `Scaffold ${input.asset.normalizedLocator} write or descriptor close failed`,
        new AggregateError(errors, "Scaffold write and descriptor finalization failures"),
      ),
    });
  } catch (error) {
    if (error instanceof NodeScaffoldPrivateMaterializerErrorV2) throw error;
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_MATERIALIZATION_FAILED",
      `Scaffold ${input.asset.normalizedLocator} could not be written exclusively`,
      error,
    );
  }
}

function captureDirectoryV2(input: Readonly<{
  absolutePath: string;
  expectedNames: readonly string[];
  label: string;
}>): FingerprintV2 {
  const owner = processOwnerV2();
  const before = lstatSync(input.absolutePath);
  const names = readBoundedDirectoryNamesV2({
    absolutePath: input.absolutePath,
    label: input.label,
    maxNames: input.expectedNames.length,
    errorCode: "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_STATE_DRIFT",
  });
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
    return runWithIndependentFinalizersV2({
      operation: () => {
        descriptor = openSync(
          absolutePath,
          constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
        );
        const before = fstatSync(descriptor);
        if (before.size !== input.asset.rawByteLength) {
          return fail(
            "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_STATE_DRIFT",
            `Scaffold ${input.asset.normalizedLocator} differs from its admitted byte length`,
          );
        }
        const bytes = readExactDescriptorBytesV2({
          descriptor,
          admittedByteLength: input.asset.rawByteLength,
          label: `Scaffold ${input.asset.normalizedLocator}`,
          errorCode: "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_STATE_DRIFT",
        });
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
      },
      finalizers: [() => {
        if (descriptor !== undefined) closeSync(descriptor);
      }],
      onFinalizerFailure: (errors) => fail(
        "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_STATE_DRIFT",
        `Scaffold ${input.asset.normalizedLocator} read or descriptor close failed`,
        new AggregateError(errors, "Scaffold read and descriptor finalization failures"),
      ),
    });
  } catch (error) {
    if (error instanceof NodeScaffoldPrivateMaterializerErrorV2) throw error;
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_STATE_DRIFT",
      `Scaffold ${input.asset.normalizedLocator} could not be fresh-read`,
      error,
    );
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

const PRIVATE_CLEANUP_MAX_MEMBERS_V2 = 65_536 as const;
const PRIVATE_CLEANUP_MAX_DEPTH_V2 = 64 as const;
const PRIVATE_CLEANUP_MAX_LOCATOR_BYTES_V2 = 4_096 as const;

function privateCleanupObjectKindV2(
  stat: BigIntStats,
): PrivateCleanupObjectKindV2 | undefined {
  if (stat.isSymbolicLink()) return "symbolic_link";
  if (stat.isDirectory()) return "directory";
  if (stat.isFile()) return "ordinary_file";
  return undefined;
}

function capturePrivateCleanupMemberV2(input: Readonly<{
  absolutePath: string;
  locator: string;
  ownerUid: string;
  ownerGid: string;
}>): PrivateCleanupMemberV2 {
  const stat = lstatSync(input.absolutePath, { bigint: true });
  const objectKind = privateCleanupObjectKindV2(stat);
  if (
    objectKind === undefined
    || String(stat.uid) !== input.ownerUid
    || String(stat.gid) !== input.ownerGid
  ) {
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_STATE_DRIFT",
      `Private cleanup member ${input.locator} has a forbidden kind or ownership`,
    );
  }
  return Object.freeze({
    locator: input.locator,
    objectKind,
    device: String(stat.dev),
    inode: String(stat.ino),
    ownerUid: String(stat.uid),
    ownerGid: String(stat.gid),
  });
}

function boundedPrivateCleanupNamesV2(
  absoluteDirectory: string,
  memberCount: number,
  locator: string,
  hooks?: NodeScaffoldPrivateMaterializerTestHooksV2,
): readonly string[] {
  return readBoundedDirectoryNamesV2({
    absolutePath: absoluteDirectory,
    label: `Private cleanup directory ${locator}`,
    maxNames: PRIVATE_CLEANUP_MAX_MEMBERS_V2 - memberCount,
    errorCode: "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_STATE_DRIFT",
    beforeRead: () => hooks?.beforeCleanupCensusDirectoryRead?.(locator),
    afterClose: () => hooks?.afterCleanupCensusDirectoryClose?.(locator),
  });
}

function capturePrivateCleanupCensusV2(
  privateRoot: string,
  hooks?: NodeScaffoldPrivateMaterializerTestHooksV2,
): PrivateCleanupCensusV2 {
  const rootStat = lstatSync(privateRoot, { bigint: true });
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_STATE_DRIFT",
      "Private cleanup root is not one direct directory",
    );
  }
  const ownerUid = String(rootStat.uid);
  const ownerGid = String(rootStat.gid);
  const members: PrivateCleanupMemberV2[] = [];
  const visit = (absolutePath: string, locator: string, depth: number): void => {
    if (
      depth > PRIVATE_CLEANUP_MAX_DEPTH_V2
      || Buffer.byteLength(locator, "utf8") > PRIVATE_CLEANUP_MAX_LOCATOR_BYTES_V2
      || members.length >= PRIVATE_CLEANUP_MAX_MEMBERS_V2
    ) {
      return fail(
        "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_STATE_DRIFT",
        "Private cleanup census exceeded its fixed path or membership bound",
      );
    }
    const member = capturePrivateCleanupMemberV2({
      absolutePath,
      locator,
      ownerUid,
      ownerGid,
    });
    members.push(member);
    if (member.objectKind !== "directory") return;
    for (const name of boundedPrivateCleanupNamesV2(
      absolutePath,
      members.length,
      locator,
      hooks,
    )) {
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
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_STATE_DRIFT",
      `Private cleanup journal already contains ${input.locator}`,
    );
  }
  if (
    input.locator !== "."
    && !input.current?.members.some((member) => member.locator === ".")
  ) {
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_STATE_DRIFT",
      `Private cleanup journal lacks its root before adding ${input.locator}`,
    );
  }
  if ((input.current?.members.length ?? 0) >= PRIVATE_CLEANUP_MAX_MEMBERS_V2) {
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_STATE_DRIFT",
      "Private cleanup journal exceeded its fixed membership bound",
    );
  }
  const root = input.current?.members.find((member) => member.locator === ".");
  const rootStat = root === undefined
    ? lstatSync(input.privateRoot, { bigint: true })
    : undefined;
  const member = capturePrivateCleanupMemberV2({
    absolutePath: input.absolutePath,
    locator: input.locator,
    ownerUid: root?.ownerUid ?? String(rootStat!.uid),
    ownerGid: root?.ownerGid ?? String(rootStat!.gid),
  });
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
  const current = capturePrivateCleanupMemberV2({
    absolutePath,
    locator: expected.locator,
    ownerUid: expected.ownerUid,
    ownerGid: expected.ownerGid,
  });
  if (!samePrivateCleanupCensusV2(
    { members: [current] },
    { members: [expected] },
  )) {
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_STATE_DRIFT",
      `Private cleanup member ${expected.locator} changed before removal`,
    );
  }
  return absolutePath;
}

function makePrivateCleanupDirectoryWritableV2(
  privateRoot: string,
  expected: PrivateCleanupMemberV2,
  hooks?: NodeScaffoldPrivateMaterializerTestHooksV2,
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
        "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_STATE_DRIFT",
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
    if (operationError instanceof NodeScaffoldPrivateMaterializerErrorV2) {
      throw operationError;
    }
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_STATE_DRIFT",
      `Private cleanup directory ${expected.locator} could not be made writable through its exact descriptor`,
      operationError,
    );
  }
  const errors = [...operationErrors, ...closeErrors];
  if (errors.length > 0) {
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_STATE_DRIFT",
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
  hooks?: NodeScaffoldPrivateMaterializerTestHooksV2,
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
          "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_STATE_DRIFT",
          `Private cleanup directory ${entry.expected.locator} changed before mode restoration`,
        );
      }
      fchmodSync(descriptor, entry.originalMode);
      hooks?.afterCleanupDirectoryModeRestore?.(entry.expected.locator);
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
          "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_STATE_DRIFT",
          `Private cleanup directory ${entry.expected.locator} did not retain its original mode`,
        );
      }
    },
    finalizers: [() => {
      if (descriptor !== undefined) closeSync(descriptor);
    }],
    onFinalizerFailure: (errors) => fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_STATE_DRIFT",
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
  hooks?: NodeScaffoldPrivateMaterializerTestHooksV2,
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
        "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_STATE_DRIFT",
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
    const deepestFirst = directories.slice().sort((left, right) => {
      const leftDepth = left.locator === "." ? 0 : left.locator.split("/").length;
      const rightDepth = right.locator === "." ? 0 : right.locator.split("/").length;
      return rightDepth - leftDepth;
    });
    for (const directory of deepestFirst) {
      const absolutePath = assertPrivateCleanupMemberV2(privateRoot, directory);
      readBoundedDirectoryNamesV2({
        absolutePath,
        label: `Private cleanup directory ${directory.locator}`,
        maxNames: 0,
        errorCode: "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_STATE_DRIFT",
      });
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
      restorePrivateCleanupDirectoryModeV2(privateRoot, entry, hooks);
    } catch (error) {
      restoreErrors.push(error);
    }
  }
  if (restoreErrors.length > 0) {
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_STATE_DRIFT",
      "Private cleanup could not restore every surviving directory mode",
      new AggregateError(
        [...primaryErrors, ...restoreErrors],
        "Private cleanup operation and directory mode restoration failures",
      ),
    );
  }
  if (primaryErrors.length > 0) throw primaryErrors[0];
}

function codeOwnedMaterializerAuthorityV2(): PrivateStagedMaterializerAuthorityV2 {
  const identity = {
    schema: PRIVATE_STAGED_MATERIALIZER_AUTHORITY_V2_SCHEMA,
    authorityVersion: PRIVATE_STAGED_MATERIALIZER_VERSION_V2,
    authorityRef: PRIVATE_STAGED_MATERIALIZER_AUTHORITY_REF_V2,
    activation: "dependency_materialization_verified_file_tree_blocked" as const,
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

function modeTextV2(stat: Stats): string {
  return modeBits(stat).toString(8).padStart(4, "0");
}

function parseBoundedJsonObjectV2(
  bytes: Buffer,
  label: string,
): Readonly<Record<string, unknown>> {
  if (bytes.byteLength < 2 || bytes.byteLength > 32 * 1024 * 1024) {
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_DEPENDENCY_GRAPH_INVALID",
      `${label} is outside its JSON byte bound`,
    );
  }
  let parsed: unknown;
  try {
    const text = bytes.toString("utf8");
    if (text.includes("\0") || text.startsWith("\ufeff")) throw new Error("non-canonical JSON text");
    parsed = JSON.parse(text);
  } catch (error) {
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_DEPENDENCY_GRAPH_INVALID",
      `${label} is not one JSON document`,
      error,
    );
  }
  if (!isPlainRecord(parsed)) {
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_DEPENDENCY_GRAPH_INVALID",
      `${label} must be one plain JSON object`,
    );
  }
  return parsed;
}

function hashDependencyRegularFileV2(
  absolutePath: string,
  locator: string,
  testHooks?: NodeScaffoldPrivateMaterializerTestHooksV2,
): Readonly<{ rawHash: string; rawByteLength: number; mode: string }> {
  const limits = CANONICAL_RUNTIME_TREE_V2_PROFILES.dependencies;
  const owner = processOwnerV2();
  let descriptor: number | undefined;
  try {
    return runWithIndependentFinalizersV2({
      operation: () => {
        descriptor = openSync(
          absolutePath,
          constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
        );
        const before = fstatSync(descriptor);
        if (
          !before.isFile()
          || before.isSymbolicLink()
          || before.nlink !== 1
          || before.uid !== owner.uid
          || before.gid !== owner.gid
          || (modeBits(before) & 0o022) !== 0
          || !Number.isSafeInteger(before.size)
          || before.size < 0
          || before.size > limits.maxFileBytes
        ) {
          return fail(
            "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_DEPENDENCY_GRAPH_INVALID",
            `Installed file ${locator} has unsafe type, ownership, links, mode or size`,
          );
        }
        const hash = createHash("sha256");
        const buffer = Buffer.allocUnsafe(64 * 1024);
        let rawByteLength = 0;
        testHooks?.beforeRawDependencyFileRead?.(locator, absolutePath);
        while (true) {
          const count = readSync(descriptor, buffer, 0, buffer.byteLength, null);
          if (count === 0) break;
          if (rawByteLength + count > before.size) {
            return fail(
              "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_DEPENDENCY_GRAPH_INVALID",
              `Installed file ${locator} exceeded its admitted byte length`,
            );
          }
          rawByteLength += count;
          hash.update(buffer.subarray(0, count));
        }
        const after = fstatSync(descriptor);
        const pathAfter = lstatSync(absolutePath);
        if (
          rawByteLength !== after.size
          || !sameFingerprint(fingerprint(before), fingerprint(after))
          || !sameFingerprint(fingerprint(after), fingerprint(pathAfter))
        ) {
          return fail(
            "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_DEPENDENCY_GRAPH_INVALID",
            `Installed file ${locator} changed while it was captured`,
          );
        }
        return Object.freeze({
          rawHash: hash.digest("hex"),
          rawByteLength,
          mode: modeTextV2(after),
        });
      },
      finalizers: [() => {
        if (descriptor !== undefined) closeSync(descriptor);
      }],
      onFinalizerFailure: (errors) => fail(
        "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_DEPENDENCY_GRAPH_INVALID",
        `Installed file ${locator} capture or descriptor close failed`,
        new AggregateError(errors, "Installed file capture and descriptor finalization failures"),
      ),
    });
  } catch (error) {
    if (error instanceof NodeScaffoldPrivateMaterializerErrorV2) throw error;
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_DEPENDENCY_GRAPH_INVALID",
      `Installed file ${locator} could not be captured without following links`,
      error,
    );
  }
}

function readExactDependencyJsonBytesV2(input: Readonly<{
  absolutePath: string;
  label: string;
  expectedRawHash?: string;
}>): Buffer {
  const owner = processOwnerV2();
  let descriptor: number | undefined;
  try {
    return runWithIndependentFinalizersV2({
      operation: () => {
        descriptor = openSync(
          input.absolutePath,
          constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
        );
        const before = fstatSync(descriptor);
        if (
          !before.isFile()
          || before.isSymbolicLink()
          || before.nlink !== 1
          || before.uid !== owner.uid
          || before.gid !== owner.gid
          || (modeBits(before) & 0o022) !== 0
          || before.size < 2
          || before.size > 32 * 1024 * 1024
        ) {
          return fail(
            "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_DEPENDENCY_GRAPH_INVALID",
            `${input.label} is not one bounded regular file`,
          );
        }
        const bytes = readExactDescriptorBytesV2({
          descriptor,
          admittedByteLength: before.size,
          label: input.label,
          errorCode: "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_DEPENDENCY_GRAPH_INVALID",
        });
        const after = fstatSync(descriptor);
        const pathAfter = lstatSync(input.absolutePath);
        if (
          !sameFingerprint(fingerprint(before), fingerprint(after))
          || !sameFingerprint(fingerprint(after), fingerprint(pathAfter))
          || (input.expectedRawHash !== undefined && sha256(bytes) !== input.expectedRawHash)
        ) {
          return fail(
            "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_DEPENDENCY_GRAPH_INVALID",
            `${input.label} changed or differs from its admitted hash`,
          );
        }
        return bytes;
      },
      finalizers: [() => {
        if (descriptor !== undefined) closeSync(descriptor);
      }],
      onFinalizerFailure: (errors) => fail(
        "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_DEPENDENCY_GRAPH_INVALID",
        `${input.label} read or descriptor close failed`,
        new AggregateError(errors, `${input.label} read and descriptor finalization failures`),
      ),
    });
  } catch (error) {
    if (error instanceof NodeScaffoldPrivateMaterializerErrorV2) throw error;
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_DEPENDENCY_GRAPH_INVALID",
      `${input.label} could not be read without following links`,
      error,
    );
  }
}

function captureRawInstallEntriesV2(
  nodeModulesRoot: string,
  testHooks?: NodeScaffoldPrivateMaterializerTestHooksV2,
): readonly RawInstallEntryV2[] {
  const limits = CANONICAL_RUNTIME_TREE_V2_PROFILES.dependencies;
  const owner = processOwnerV2();
  const entries: RawInstallEntryV2[] = [];
  const casefold = new Map<string, string>();
  let fileCount = 0;
  let directoryCount = 0;
  let totalBytes = 0;
  const maxMembers = limits.maxFiles + limits.maxDirectories;
  const visit = (absoluteDirectory: string, relativeDirectory: string): void => {
    const before = lstatSync(absoluteDirectory);
    const beforeNames = readBoundedDirectoryNamesV2({
      absolutePath: absoluteDirectory,
      label: `Installed directory ${relativeDirectory || "node_modules"}`,
      maxNames: Math.min(
        maxMembers - entries.length,
        testHooks?.maxRawDependencyDirectoryEntriesForTest ?? Number.MAX_SAFE_INTEGER,
      ),
      errorCode: "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_DEPENDENCY_GRAPH_INVALID",
    });
    if (
      before.isSymbolicLink()
      || !before.isDirectory()
      || realpathSync(absoluteDirectory) !== absoluteDirectory
      || before.uid !== owner.uid
      || before.gid !== owner.gid
      || (modeBits(before) & 0o022) !== 0
    ) {
      return fail(
        "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_DEPENDENCY_GRAPH_INVALID",
        `Installed directory ${relativeDirectory || "node_modules"} is unsafe`,
      );
    }
    for (const name of beforeNames) {
      const locator = relativeDirectory ? `${relativeDirectory}/${name}` : name;
      if (canonicalRuntimePathIssuesV2(locator, limits).length > 0) {
        return fail(
          "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_DEPENDENCY_GRAPH_INVALID",
          `Installed dependency locator ${locator} is not portable`,
        );
      }
      const folded = locator.toLowerCase();
      const prior = casefold.get(folded);
      if (prior !== undefined && prior !== locator) {
        return fail(
          "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_DEPENDENCY_GRAPH_INVALID",
          `Installed dependency locators collide under case folding: ${prior} and ${locator}`,
        );
      }
      casefold.set(folded, locator);
      const absolutePath = path.join(absoluteDirectory, name);
      const stat = lstatSync(absolutePath);
      if (stat.isSymbolicLink()) {
        if (stat.uid !== owner.uid || stat.gid !== owner.gid || stat.nlink !== 1) {
          return fail(
            "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_DEPENDENCY_GRAPH_INVALID",
            `Installed symbolic link ${locator} has unsafe ownership or link count`,
          );
        }
        entries.push(Object.freeze({
          locator,
          type: "symbolic_link" as const,
          mode: modeTextV2(stat),
          linkTarget: readlinkSync(absolutePath),
        }));
        continue;
      }
      if (stat.isDirectory()) {
        directoryCount += 1;
        if (directoryCount > limits.maxDirectories) {
          return fail(
            "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_DEPENDENCY_GRAPH_INVALID",
            "Installed dependency directory count exceeded its fixed bound",
          );
        }
        entries.push(Object.freeze({ locator, type: "directory" as const, mode: modeTextV2(stat) }));
        visit(absolutePath, locator);
        continue;
      }
      if (!stat.isFile()) {
        return fail(
          "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_DEPENDENCY_GRAPH_INVALID",
          `Installed dependency ${locator} is a forbidden special file`,
        );
      }
      fileCount += 1;
      if (fileCount > limits.maxFiles) {
        return fail(
          "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_DEPENDENCY_GRAPH_INVALID",
          "Installed dependency file count exceeded its fixed bound",
        );
      }
      const captured = hashDependencyRegularFileV2(absolutePath, locator, testHooks);
      totalBytes += captured.rawByteLength;
      if (totalBytes > limits.maxTotalBytes) {
        return fail(
          "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_DEPENDENCY_GRAPH_INVALID",
          "Installed dependency bytes exceeded their fixed bound",
        );
      }
      entries.push(Object.freeze({
        locator,
        type: "file" as const,
        mode: captured.mode,
        rawHash: captured.rawHash,
        rawByteLength: captured.rawByteLength,
      }));
    }
    const after = lstatSync(absoluteDirectory);
    const afterNames = readBoundedDirectoryNamesV2({
      absolutePath: absoluteDirectory,
      label: `Installed directory ${relativeDirectory || "node_modules"}`,
      maxNames: beforeNames.length,
      errorCode: "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_DEPENDENCY_GRAPH_INVALID",
    });
    if (
      !sameFingerprint(fingerprint(before), fingerprint(after))
      || JSON.stringify(beforeNames) !== JSON.stringify(afterNames)
    ) {
      return fail(
        "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_DEPENDENCY_GRAPH_INVALID",
        `Installed directory ${relativeDirectory || "node_modules"} changed during capture`,
      );
    }
  };
  visit(nodeModulesRoot, "");
  return Object.freeze(entries.sort((left, right) =>
    left.locator < right.locator ? -1 : left.locator > right.locator ? 1 : 0));
}

function exactStringKeysV2(record: Readonly<Record<string, unknown>>): readonly string[] {
  return Object.freeze(Object.keys(record).sort());
}

function sameStringsV2(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function defaultBinNameV2(packageName: string): string {
  const slash = packageName.lastIndexOf("/");
  return slash < 0 ? packageName : packageName.slice(slash + 1);
}

function deriveExpectedBinsV2(
  lockPackages: Readonly<Record<string, unknown>>,
  nodes: readonly Readonly<{
    packagePath: string;
    packageName: string;
    version: string;
    resolved: string;
    integrity: string;
  }>[],
): readonly Readonly<InstalledBinCaptureV2 & { expectedLinkTarget: string }>[] {
  const bins: Array<Readonly<InstalledBinCaptureV2 & { expectedLinkTarget: string }>> = [];
  const linkLocators = new Set<string>();
  for (const node of nodes) {
    const lockEntry = lockPackages[node.packagePath];
    if (!isPlainRecord(lockEntry)) {
      return fail(
        "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_DEPENDENCY_GRAPH_INVALID",
        `Lock package ${node.packagePath} is absent`,
      );
    }
    const rawBin = lockEntry.bin;
    let commands: Array<readonly [string, string]> = [];
    if (typeof rawBin === "string") {
      commands = [[defaultBinNameV2(node.packageName), rawBin] as const];
    } else if (rawBin !== undefined) {
      if (!isPlainRecord(rawBin)) {
        return fail(
          "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_DEPENDENCY_GRAPH_INVALID",
          `Lock package ${node.packagePath} has a malformed bin map`,
        );
      }
      commands = Object.keys(rawBin).sort().map((command) => {
        const target = rawBin[command];
        if (!/^[A-Za-z0-9._+-]{1,214}$/u.test(command) || typeof target !== "string") {
          return fail(
            "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_DEPENDENCY_GRAPH_INVALID",
            `Lock package ${node.packagePath} has an unsafe bin entry`,
          );
        }
        return [command, target] as const;
      });
    }
    const segments = node.packagePath.split("/");
    const nodeModulesIndex = segments.lastIndexOf("node_modules");
    if (nodeModulesIndex < 0) {
      return fail(
        "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_DEPENDENCY_GRAPH_INVALID",
        `Lock package ${node.packagePath} is outside node_modules`,
      );
    }
    const container = segments.slice(0, nodeModulesIndex + 1).join("/");
    for (const [commandName, rawTarget] of commands) {
      const normalizedTarget = path.posix.normalize(rawTarget);
      if (
        normalizedTarget !== rawTarget
        || rawTarget.startsWith("/")
        || rawTarget.includes("\\")
        || rawTarget.split("/").some((segment) => segment === "" || segment === "." || segment === "..")
      ) {
        return fail(
          "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_DEPENDENCY_GRAPH_INVALID",
          `Lock package ${node.packagePath} has a traversing bin target`,
        );
      }
      const targetLocator = `${node.packagePath}/${rawTarget}`;
      const linkLocator = `${container}/.bin/${commandName}`;
      const expectedLinkTarget = path.posix.relative(path.posix.dirname(linkLocator), targetLocator);
      if (
        !/^[A-Za-z0-9._+-]{1,214}$/u.test(commandName)
        || canonicalRuntimePathIssuesV2(
          linkLocator,
          CANONICAL_RUNTIME_TREE_V2_PROFILES.dependencies,
        ).length > 0
        || canonicalRuntimePathIssuesV2(
          targetLocator,
          CANONICAL_RUNTIME_TREE_V2_PROFILES.dependencies,
        ).length > 0
        || linkLocators.has(linkLocator)
      ) {
        return fail(
          "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_DEPENDENCY_GRAPH_INVALID",
          `Lock bin ${linkLocator} is nonportable or collides`,
        );
      }
      linkLocators.add(linkLocator);
      bins.push(Object.freeze({
        commandName,
        packagePath: node.packagePath,
        targetLocator,
        linkLocator,
        expectedLinkTarget,
        linkTargetHash: "",
        targetContentHash: "",
      }));
    }
  }
  return Object.freeze(bins.sort((left, right) =>
    left.linkLocator < right.linkLocator ? -1 : left.linkLocator > right.linkLocator ? 1 : 0));
}

function validateEveryAndOnlyPackageRootsV2(
  projectRoot: string,
  rawEntries: readonly RawInstallEntryV2[],
  packagePaths: readonly string[],
): void {
  const expectedContainers = new Map<string, string[]>();
  for (const packagePath of packagePaths) {
    const segments = packagePath.split("/");
    const index = segments.lastIndexOf("node_modules");
    const container = segments.slice(0, index + 1).join("/");
    const localPackage = segments[index + 1]!.startsWith("@")
      ? `${segments[index + 1]}/${segments[index + 2]}`
      : segments[index + 1]!;
    const members = expectedContainers.get(container) ?? [];
    members.push(localPackage);
    expectedContainers.set(container, members);
  }
  const actualContainers = new Set<string>(["node_modules"]);
  for (const entry of rawEntries) {
    if (entry.type === "directory" && entry.locator.endsWith("/node_modules")) {
      actualContainers.add(`node_modules/${entry.locator}`);
    }
  }
  if (!sameStringsV2([...actualContainers].sort(), [...expectedContainers.keys()].sort())) {
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_DEPENDENCY_GRAPH_INVALID",
      "Installed node_modules containers do not equal the lock graph containers",
    );
  }
  for (const [container, packageMembers] of expectedContainers) {
    const absoluteContainer = path.join(projectRoot, container);
    const expectedTop = new Set(packageMembers.map((member) => member.split("/")[0]!));
    const actualTop = readBoundedDirectoryNamesV2({
      absolutePath: absoluteContainer,
      label: `Installed package roots in ${container}`,
      maxNames: expectedTop.size + 2,
      errorCode: "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_DEPENDENCY_GRAPH_INVALID",
    }).filter((name) =>
      name !== ".bin" && name !== ".package-lock.json").sort();
    if (!sameStringsV2(actualTop, [...expectedTop].sort())) {
      return fail(
        "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_DEPENDENCY_GRAPH_INVALID",
        `Installed package roots in ${container} do not equal the lock graph`,
      );
    }
    for (const scope of [...expectedTop].filter((name) => name.startsWith("@"))) {
      const expectedScoped = packageMembers
        .filter((member) => member.startsWith(`${scope}/`))
        .map((member) => member.slice(scope.length + 1))
        .sort();
      const actualScoped = readBoundedDirectoryNamesV2({
        absolutePath: path.join(absoluteContainer, scope),
        label: `Installed scoped package roots in ${container}/${scope}`,
        maxNames: expectedScoped.length,
        errorCode: "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_DEPENDENCY_GRAPH_INVALID",
      });
      if (!sameStringsV2(actualScoped, expectedScoped)) {
        return fail(
          "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_DEPENDENCY_GRAPH_INVALID",
          `Installed scoped package roots in ${container}/${scope} do not equal the lock graph`,
        );
      }
    }
  }
}

function captureRawDependenciesV2(input: Readonly<{
  projectRoot: string;
  entry: NonNullable<ReturnType<typeof getCodeOwnedNodeScaffoldToolchainEntryV2>>;
  testHooks?: NodeScaffoldPrivateMaterializerTestHooksV2;
}>): RawDependencyCaptureV2 {
  const nodeModulesRoot = path.join(input.projectRoot, "node_modules");
  const rawEntries = captureRawInstallEntriesV2(nodeModulesRoot, input.testHooks);
  const graph = input.entry.dependencyGraph;
  const rootLockBytes = readExactDependencyJsonBytesV2({
    absolutePath: path.join(input.projectRoot, "package-lock.json"),
    label: "Scaffold package-lock.json",
    expectedRawHash: graph.lockRawHash,
  });
  const rootLock = parseBoundedJsonObjectV2(rootLockBytes, "Scaffold package-lock.json");
  if (!isPlainRecord(rootLock.packages)) {
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_DEPENDENCY_GRAPH_INVALID",
      "Scaffold lock packages map is absent",
    );
  }
  const lockPackages = rootLock.packages;
  const expectedPackageKeys = ["", ...graph.nodes.map((node) => node.packagePath)].sort();
  if (!sameStringsV2(exactStringKeysV2(lockPackages), expectedPackageKeys)) {
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_DEPENDENCY_GRAPH_INVALID",
      "Scaffold lock package membership no longer equals the code-owned graph",
    );
  }
  validateEveryAndOnlyPackageRootsV2(
    input.projectRoot,
    rawEntries,
    graph.nodes.map((node) => node.packagePath),
  );

  const hiddenLockEntry = rawEntries.find((entry) => entry.locator === ".package-lock.json");
  if (!hiddenLockEntry || hiddenLockEntry.type !== "file") {
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_DEPENDENCY_GRAPH_INVALID",
      "npm hidden lock is absent from the raw install tree",
    );
  }
  if (rawEntries.some((entry) =>
    entry.locator !== ".package-lock.json" && entry.locator.endsWith("/.package-lock.json"))) {
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_DEPENDENCY_GRAPH_INVALID",
      "Unexpected nested npm hidden lock is present",
    );
  }
  const hiddenLockBytes = readExactDependencyJsonBytesV2({
    absolutePath: path.join(nodeModulesRoot, ".package-lock.json"),
    label: "npm hidden package lock",
    expectedRawHash: hiddenLockEntry.rawHash,
  });
  const hiddenLock = parseBoundedJsonObjectV2(hiddenLockBytes, "npm hidden package lock");
  if (
    !sameStringsV2(exactStringKeysV2(hiddenLock), [
      "lockfileVersion",
      "name",
      "packages",
      "requires",
      "version",
    ])
    || hiddenLock.lockfileVersion !== 3
    || hiddenLock.requires !== true
    || hiddenLock.name !== rootLock.name
    || hiddenLock.version !== rootLock.version
    || !isPlainRecord(hiddenLock.packages)
  ) {
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_DEPENDENCY_GRAPH_INVALID",
      "npm hidden lock root identity differs from the scaffold lock",
    );
  }
  const hiddenPackages = hiddenLock.packages;
  const expectedHiddenKeys = graph.nodes.map((node) => node.packagePath).sort();
  if (!sameStringsV2(exactStringKeysV2(hiddenPackages), expectedHiddenKeys)) {
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_DEPENDENCY_GRAPH_INVALID",
      "npm hidden lock package membership does not equal the code-owned graph",
    );
  }
  const installedPackages = graph.nodes.map((node) => {
    const rootEntry = lockPackages[node.packagePath];
    const hiddenEntry = hiddenPackages[node.packagePath];
    if (
      !isPlainRecord(rootEntry)
      || !isPlainRecord(hiddenEntry)
      || rootEntry.version !== node.version
      || rootEntry.resolved !== node.resolved
      || rootEntry.integrity !== node.integrity
      || hiddenEntry.version !== node.version
      || hiddenEntry.resolved !== node.resolved
      || hiddenEntry.integrity !== node.integrity
    ) {
      return fail(
        "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_DEPENDENCY_GRAPH_INVALID",
        `Installed lock identity differs for ${node.packagePath}`,
      );
    }
    const packageJsonPath = path.join(input.projectRoot, node.packagePath, "package.json");
    const packageJsonEntry = rawEntries.find((candidate) =>
      candidate.locator === `${node.packagePath.slice("node_modules/".length)}/package.json`);
    if (!packageJsonEntry || packageJsonEntry.type !== "file") {
      return fail(
        "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_DEPENDENCY_GRAPH_INVALID",
        `Installed package manifest is absent for ${node.packagePath}`,
      );
    }
    const packageJsonBytes = readExactDependencyJsonBytesV2({
      absolutePath: packageJsonPath,
      label: `${node.packagePath}/package.json`,
      expectedRawHash: packageJsonEntry.rawHash,
    });
    const packageJson = parseBoundedJsonObjectV2(packageJsonBytes, `${node.packagePath}/package.json`);
    if (packageJson.name !== node.packageName || packageJson.version !== node.version) {
      return fail(
        "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_DEPENDENCY_GRAPH_INVALID",
        `Installed package identity differs for ${node.packagePath}`,
      );
    }
    return Object.freeze({
      packagePath: node.packagePath,
      packageName: node.packageName,
      version: node.version,
      resolved: node.resolved,
      integrity: node.integrity,
      packageJsonRawHash: sha256(packageJsonBytes),
    });
  });
  const expectedBins = deriveExpectedBinsV2(lockPackages, graph.nodes);
  const expectedBinDirectories = [...new Set(expectedBins.map((candidate) =>
    path.posix.dirname(candidate.linkLocator)))].sort();
  const actualBinDirectories = rawEntries.filter((candidate) =>
    candidate.type === "directory"
    && (candidate.locator === ".bin" || candidate.locator.endsWith("/node_modules/.bin")))
    .map((candidate) => `node_modules/${candidate.locator}`)
    .sort();
  if (!sameStringsV2(actualBinDirectories, expectedBinDirectories)) {
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_DEPENDENCY_GRAPH_INVALID",
      "Installed npm bin directories do not equal the lock-declared bin surfaces",
    );
  }
  const actualLinks = rawEntries.filter((entry) => entry.type === "symbolic_link");
  if (!sameStringsV2(
    actualLinks.map((entry) => `node_modules/${entry.locator}`).sort(),
    expectedBins.map((entry) => entry.linkLocator).sort(),
  )) {
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_DEPENDENCY_GRAPH_INVALID",
      "Installed symbolic links do not equal the expected npm bin links",
    );
  }
  const installedBins = expectedBins.map((expected) => {
    const rawLinkLocator = expected.linkLocator.slice("node_modules/".length);
    const rawTargetLocator = expected.targetLocator.slice("node_modules/".length);
    const link = actualLinks.find((entry) => entry.locator === rawLinkLocator)!;
    if (link.linkTarget !== expected.expectedLinkTarget) {
      return fail(
        "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_DEPENDENCY_GRAPH_INVALID",
        `Installed npm bin ${expected.linkLocator} targets an unexpected path`,
      );
    }
    const target = rawEntries.find((entry) => entry.locator === rawTargetLocator);
    if (
      !target
      || target.type !== "file"
      || target.rawHash === undefined
      || (Number.parseInt(target.mode, 8) & 0o111) === 0
    ) {
      return fail(
        "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_DEPENDENCY_GRAPH_INVALID",
        `Installed npm bin target ${expected.targetLocator} is absent or non-executable`,
      );
    }
    return Object.freeze({
      commandName: expected.commandName,
      packagePath: expected.packagePath,
      targetLocator: expected.targetLocator,
      linkLocator: expected.linkLocator,
      linkTargetHash: sha256(link.linkTarget!),
      targetContentHash: target.rawHash,
    });
  });
  const files = rawEntries.filter((entry) => entry.type === "file");
  const directories = rawEntries.filter((entry) => entry.type === "directory");
  const symbolicLinks = rawEntries.filter((entry) => entry.type === "symbolic_link");
  const totalBytes = files.reduce((sum, entry) => sum + entry.rawByteLength!, 0);
  return Object.freeze({
    fileCount: files.length,
    directoryCount: directories.length,
    symbolicLinkCount: symbolicLinks.length,
    totalBytes,
    membershipHash: hashCanonicalJson({
      schema: "setfarm.raw-node-modules-membership.v2",
      entries: rawEntries,
    }),
    hiddenLockRawHash: sha256(hiddenLockBytes),
    hiddenLockGraphHash: hashCanonicalJson({
      schema: "setfarm.npm-hidden-lock-graph.v2",
      packages: graph.nodes.map((node) => ({
        packagePath: node.packagePath,
        version: node.version,
        resolved: node.resolved,
        integrity: node.integrity,
      })),
    }),
    installedPackageMembershipHash: hashCanonicalJson({
      schema: "setfarm.installed-package-membership.v2",
      packages: installedPackages,
    }),
    installedBins: Object.freeze(installedBins),
    installedBinsMembershipHash: hashCanonicalJson({
      schema: "setfarm.installed-npm-bin-membership.v2",
      bins: installedBins,
    }),
  });
}

function codeOwnedDarwinMetadataProbeV2(
  input: Parameters<CanonicalRuntimeMetadataProbeV2>[0],
): ReturnType<CanonicalRuntimeMetadataProbeV2> {
  try {
    const environment = Object.freeze({ LANG: "C", LC_ALL: "C", PATH: "/usr/bin:/bin" });
    const xattrs = execFileSync("/usr/bin/xattr", [input.absolutePath], {
      encoding: "utf8",
      env: environment,
      maxBuffer: 64 * 1024,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 5_000,
      windowsHide: true,
    });
    const acl = execFileSync("/bin/ls", ["-lde", input.absolutePath], {
      encoding: "utf8",
      env: environment,
      maxBuffer: 64 * 1024,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 5_000,
      windowsHide: true,
    });
    const metadata: Array<"acl" | "xattr"> = [];
    const xattrNames = xattrs.split("\n").map((name) => name.trim()).filter(Boolean);
    if (xattrNames.some((name) => name !== "com.apple.provenance")) metadata.push("xattr");
    if (acl.split("\n").slice(1).some((line) => /^\s*[0-9]+:\s/u.test(line))) {
      metadata.push("acl");
    }
    return metadata.length === 0
      ? Object.freeze({ status: "clear" as const })
      : Object.freeze({ status: "present" as const, metadata: Object.freeze(metadata) });
  } catch (error) {
    return Object.freeze({
      status: "unsupported" as const,
      detail: `code-owned Darwin metadata probe failed for ${input.relativePath}: ${
        error instanceof Error ? error.name : "unknown_error"
      }`,
    });
  }
}

const clearTestMetadataProbeV2: CanonicalRuntimeMetadataProbeV2 = () =>
  Object.freeze({ status: "clear" as const });

function syncNormalizedTreeV2(
  absolutePath: string,
  errorCode: NodeScaffoldPrivateMaterializerErrorCodeV2 =
    "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_DEPENDENCY_CAPSULE_INVALID",
  census: { remaining: number } = {
    remaining: CANONICAL_RUNTIME_TREE_V2_PROFILES.dependencies.maxFiles
      + CANONICAL_RUNTIME_TREE_V2_PROFILES.dependencies.maxDirectories,
  },
): void {
  const stat = lstatSync(absolutePath);
  if (stat.isSymbolicLink()) {
    return fail(
      errorCode,
      "Metadata normalization encountered a forbidden symbolic link",
    );
  }
  if (stat.isDirectory()) {
    const names = readBoundedDirectoryNamesV2({
      absolutePath,
      label: `Metadata normalization directory ${absolutePath}`,
      maxNames: census.remaining,
      errorCode,
    });
    census.remaining -= names.length;
    for (const name of names) {
      syncNormalizedTreeV2(path.join(absolutePath, name), errorCode, census);
    }
  } else if (!stat.isFile()) {
    return fail(
      errorCode,
      "Metadata normalization encountered a forbidden special file",
    );
  }
  let descriptor: number | undefined;
  return runWithIndependentFinalizersV2({
    operation: () => {
      descriptor = openSync(absolutePath, constants.O_RDONLY | constants.O_NOFOLLOW);
      fsyncSync(descriptor);
    },
    finalizers: [() => {
      if (descriptor !== undefined) closeSync(descriptor);
    }],
    onFinalizerFailure: (errors) => fail(
      errorCode,
      `Metadata normalization path ${absolutePath} sync or descriptor close failed`,
      new AggregateError(
        errors,
        "Metadata normalization sync and descriptor finalization failures",
      ),
    ),
  });
}

function normalizeCodeOwnedDarwinMetadataV2(
  root: string,
  errorCode: NodeScaffoldPrivateMaterializerErrorCodeV2 =
    "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_DEPENDENCY_CAPSULE_INVALID",
): void {
  const environment = Object.freeze({ LANG: "C", LC_ALL: "C", PATH: "/usr/bin:/bin" });
  try {
    execFileSync("/bin/chmod", ["-RN", root], {
      encoding: "utf8",
      env: environment,
      maxBuffer: 64 * 1024,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 30_000,
      windowsHide: true,
    });
    execFileSync("/usr/bin/xattr", ["-cr", root], {
      encoding: "utf8",
      env: environment,
      maxBuffer: 64 * 1024,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 30_000,
      windowsHide: true,
    });
  } catch (error) {
    if (error instanceof NodeScaffoldPrivateMaterializerErrorV2) throw error;
    return fail(
      errorCode,
      "Code-owned Darwin xattr and ACL normalization failed",
    );
  }
}

function normalizeDependencyCapsuleV2(input: Readonly<{
  nodeModulesRoot: string;
  capsuleRoot: string;
  raw: RawDependencyCaptureV2;
  metadataProbe: CanonicalRuntimeMetadataProbeV2;
  metadataAuthority:
    | "code_owned_darwin_acl_nonprovenance_xattr_probe_v2"
    | "test_fixture_clear_probe";
  admissionScope: "production_host" | "test_fixture";
  onCreated: (absolutePath: string, locator: string) => void;
  testHooks?: NodeScaffoldPrivateMaterializerTestHooksV2;
}>): CanonicalRuntimeTreeV2 {
  const owner = processOwnerV2();
  const rawEntries = captureRawInstallEntriesV2(input.nodeModulesRoot);
  const reproducedRawHash = hashCanonicalJson({
    schema: "setfarm.raw-node-modules-membership.v2",
    entries: rawEntries,
  });
  if (reproducedRawHash !== input.raw.membershipHash) {
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_DEPENDENCY_GRAPH_INVALID",
      "Raw install tree changed before dependency capsule normalization",
    );
  }
  const entries = new Map(rawEntries.map((entry) => [entry.locator, entry]));
  const boundedDirectoryNames = (
    absoluteDirectory: string,
    locator: string,
    maxNames: number,
    beforeRead?: () => void,
  ): readonly string[] => readBoundedDirectoryNamesV2({
    absolutePath: absoluteDirectory,
    label: `Dependency capsule directory ${locator}`,
    maxNames,
    errorCode: "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_DEPENDENCY_CAPSULE_INVALID",
    beforeRead,
    membershipBoundLabel: "admitted",
  });
  const immediateChildNames = (relativeDirectory: string): readonly string[] =>
    [...entries.keys()]
      .filter((locator) => {
        const separator = locator.lastIndexOf("/");
        const parent = separator < 0 ? "" : locator.slice(0, separator);
        return parent === relativeDirectory;
      })
      .map((locator) => {
        const separator = locator.lastIndexOf("/");
        return separator < 0 ? locator : locator.slice(separator + 1);
      })
      .sort();
  const skippedCapsuleMember = (relativeDirectory: string, name: string): boolean => {
    const locator = relativeDirectory ? `${relativeDirectory}/${name}` : name;
    const inNodeModulesContainer = relativeDirectory === ""
      || relativeDirectory.endsWith("/node_modules");
    return locator === ".package-lock.json" || (inNodeModulesContainer && name === ".bin");
  };
  const capsuleStat = lstatSync(input.capsuleRoot);
  if (
    capsuleStat.isSymbolicLink()
    || !capsuleStat.isDirectory()
    || realpathSync(input.capsuleRoot) !== input.capsuleRoot
    || modeBits(capsuleStat) !== 0o700
    || capsuleStat.uid !== owner.uid
    || capsuleStat.gid !== owner.gid
    || boundedDirectoryNames(input.capsuleRoot, ".", 0).length !== 0
  ) {
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_DEPENDENCY_CAPSULE_INVALID",
      "Dependency capsule root must be one fresh empty private directory",
    );
  }
  const copyFile = (source: string, destination: string, locator: string): void => {
    const expected = entries.get(locator);
    if (
      !expected
      || expected.type !== "file"
      || expected.rawByteLength === undefined
      || expected.rawHash === undefined
    ) {
      return fail(
        "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_DEPENDENCY_CAPSULE_INVALID",
        `Dependency capsule source ${locator} lacks raw-tree authority`,
      );
    }
    const expectedByteLength = expected.rawByteLength;
    const expectedRawHash = expected.rawHash;
    let sourceDescriptor: number | undefined;
    let destinationDescriptor: number | undefined;
    runWithIndependentFinalizersV2({
      operation: () => {
        sourceDescriptor = openSync(
          source,
          constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
        );
        const before = fstatSync(sourceDescriptor);
        destinationDescriptor = openSync(
          destination,
          constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW,
          0o600,
        );
        input.onCreated(destination, locator);
        input.testHooks?.afterDependencyCapsuleDestinationCreate?.(locator);
        const hash = createHash("sha256");
        const buffer = Buffer.allocUnsafe(64 * 1024);
        let total = 0;
        while (true) {
          const count = readSync(sourceDescriptor, buffer, 0, buffer.byteLength, null);
          if (count === 0) break;
          if (total + count > expectedByteLength) {
            return fail(
              "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_DEPENDENCY_CAPSULE_INVALID",
              `Dependency capsule source ${locator} exceeded its admitted byte length`,
            );
          }
          let offset = 0;
          while (offset < count) {
            const written = writeSync(
              destinationDescriptor,
              buffer,
              offset,
              count - offset,
              null,
            );
            if (written < 1) {
              return fail(
                "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_DEPENDENCY_CAPSULE_INVALID",
                `Dependency capsule write ended early for ${locator}`,
              );
            }
            offset += written;
          }
          total += count;
          hash.update(buffer.subarray(0, count));
        }
        const after = fstatSync(sourceDescriptor);
        const digest = hash.digest("hex");
        if (
          !sameFingerprint(fingerprint(before), fingerprint(after))
          || total !== expectedByteLength
          || digest !== expectedRawHash
        ) {
          return fail(
            "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_DEPENDENCY_CAPSULE_INVALID",
            `Dependency capsule source ${locator} drifted during copy`,
          );
        }
        fsyncSync(destinationDescriptor);
        const destinationStat = fstatSync(destinationDescriptor);
        if (
          !destinationStat.isFile()
          || destinationStat.nlink !== 1
          || destinationStat.uid !== owner.uid
          || destinationStat.gid !== owner.gid
          || modeBits(destinationStat) !== 0o600
          || destinationStat.size !== total
        ) {
          return fail(
            "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_DEPENDENCY_CAPSULE_INVALID",
            `Dependency capsule destination metadata is invalid for ${locator}`,
          );
        }
      },
      finalizers: [
        () => {
          if (sourceDescriptor === undefined) return;
          closeSync(sourceDescriptor);
          input.testHooks?.afterDependencyCapsuleSourceDescriptorClose?.(locator);
        },
        () => {
          if (destinationDescriptor === undefined) return;
          closeSync(destinationDescriptor);
          input.testHooks?.afterDependencyCapsuleDestinationDescriptorClose?.(locator);
        },
      ],
      onFinalizerFailure: (errors) => fail(
        "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_DEPENDENCY_CAPSULE_INVALID",
        `Dependency capsule copy or descriptor close failed for ${locator}`,
        new AggregateError(
          errors,
          `Dependency capsule ${locator} copy and descriptor finalization failures`,
        ),
      ),
    });
  };
  const copyDirectory = (
    sourceDirectory: string,
    targetDirectory: string,
    relativeDirectory: string,
  ): void => {
    const expectedNames = immediateChildNames(relativeDirectory);
    const names = boundedDirectoryNames(
      sourceDirectory,
      relativeDirectory || "node_modules",
      expectedNames.length,
      () => input.testHooks?.beforeDependencyCapsuleSourceDirectoryRead?.(
        relativeDirectory || "node_modules",
      ),
    );
    if (!sameStringsV2(names, expectedNames)) {
      return fail(
        "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_DEPENDENCY_CAPSULE_INVALID",
        `Dependency capsule source directory ${relativeDirectory || "node_modules"} changed membership`,
      );
    }
    for (const name of names) {
      const locator = relativeDirectory ? `${relativeDirectory}/${name}` : name;
      if (skippedCapsuleMember(relativeDirectory, name)) continue;
      const source = path.join(sourceDirectory, name);
      const destination = path.join(targetDirectory, name);
      const stat = lstatSync(source);
      if (stat.isSymbolicLink()) {
        return fail(
          "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_DEPENDENCY_CAPSULE_INVALID",
          `Dependency capsule forbids symbolic link ${locator}`,
        );
      }
      if (stat.isDirectory()) {
        mkdirSync(destination, { mode: 0o700 });
        input.onCreated(destination, locator);
        chmodSync(destination, 0o700);
        copyDirectory(source, destination, locator);
        syncDirectoryV2(destination);
      } else if (stat.isFile()) {
        copyFile(source, destination, locator);
      } else {
        return fail(
          "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_DEPENDENCY_CAPSULE_INVALID",
          `Dependency capsule forbids special file ${locator}`,
        );
      }
    }
  };
  const sealDirectory = (
    absoluteDirectory: string,
    relativeDirectory: string,
  ): void => {
    const expectedNames = immediateChildNames(relativeDirectory)
      .filter((name) => !skippedCapsuleMember(relativeDirectory, name));
    const names = boundedDirectoryNames(
      absoluteDirectory,
      relativeDirectory || ".",
      expectedNames.length,
    );
    if (!sameStringsV2(names, expectedNames)) {
      return fail(
        "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_DEPENDENCY_CAPSULE_INVALID",
        `Dependency capsule seal encountered unauthorised or missing membership in ${relativeDirectory || "."}`,
      );
    }
    for (const name of names) {
      const locator = relativeDirectory ? `${relativeDirectory}/${name}` : name;
      const expected = entries.get(locator);
      const absolutePath = path.join(absoluteDirectory, name);
      const before = lstatSync(absolutePath);
      if (before.isSymbolicLink() || expected === undefined) {
        return fail(
          "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_DEPENDENCY_CAPSULE_INVALID",
          `Dependency capsule seal encountered unauthorised member ${locator}`,
        );
      }
      if (before.isDirectory()) {
        if (expected.type !== "directory" || modeBits(before) !== 0o700) {
          return fail(
            "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_DEPENDENCY_CAPSULE_INVALID",
            `Dependency capsule directory ${locator} changed before its read-only seal`,
          );
        }
        sealDirectory(absolutePath, locator);
        chmodSync(absolutePath, 0o555);
        syncDirectoryV2(absolutePath);
        continue;
      }
      if (!before.isFile() || expected.type !== "file" || modeBits(before) !== 0o600) {
        return fail(
          "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_DEPENDENCY_CAPSULE_INVALID",
          `Dependency capsule file ${locator} changed before its read-only seal`,
        );
      }
      let descriptor: number | undefined;
      runWithIndependentFinalizersV2({
        operation: () => {
          descriptor = openSync(absolutePath, constants.O_RDONLY | constants.O_NOFOLLOW);
          const opened = fstatSync(descriptor);
          if (!sameFingerprint(fingerprint(before), fingerprint(opened))) {
            return fail(
              "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_DEPENDENCY_CAPSULE_INVALID",
              `Dependency capsule file ${locator} changed while its seal was acquired`,
            );
          }
          const rawMode = Number.parseInt(expected.mode, 8);
          if (!Number.isSafeInteger(rawMode)) {
            return fail(
              "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_DEPENDENCY_CAPSULE_INVALID",
              `Dependency capsule file ${locator} has an invalid admitted mode`,
            );
          }
          const sealedMode = (rawMode & 0o111) === 0 ? 0o444 : 0o555;
          fchmodSync(descriptor, sealedMode);
          fsyncSync(descriptor);
          const sealed = fstatSync(descriptor);
          if (
            opened.dev !== sealed.dev
            || opened.ino !== sealed.ino
            || opened.uid !== sealed.uid
            || opened.gid !== sealed.gid
            || opened.nlink !== sealed.nlink
            || opened.size !== sealed.size
            || opened.mtimeMs !== sealed.mtimeMs
            || modeBits(sealed) !== sealedMode
          ) {
            return fail(
              "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_DEPENDENCY_CAPSULE_INVALID",
              `Dependency capsule file ${locator} did not retain its authenticated read-only seal`,
            );
          }
        },
        finalizers: [() => {
          if (descriptor !== undefined) closeSync(descriptor);
        }],
        onFinalizerFailure: (errors) => fail(
          "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_DEPENDENCY_CAPSULE_INVALID",
          `Dependency capsule file ${locator} seal or descriptor close failed`,
          new AggregateError(errors, "Dependency capsule seal and descriptor finalization failures"),
        ),
      });
    }
  };
  try {
    copyDirectory(input.nodeModulesRoot, input.capsuleRoot, "");
    syncDirectoryV2(input.capsuleRoot);
    if (input.metadataAuthority === "code_owned_darwin_acl_nonprovenance_xattr_probe_v2") {
      normalizeCodeOwnedDarwinMetadataV2(input.capsuleRoot);
    }
    sealDirectory(input.capsuleRoot, "");
    chmodSync(input.capsuleRoot, 0o555);
    syncNormalizedTreeV2(input.capsuleRoot);
    return input.admissionScope === "production_host"
      ? captureCanonicalRuntimeTreeV2({
          root: input.capsuleRoot,
          profile: "dependencies",
          metadataProbe: input.metadataProbe,
        })
      : captureCanonicalRuntimeTreeV2ForTest({
          root: input.capsuleRoot,
          profile: "dependencies",
          metadataProbe: input.metadataProbe,
        });
  } catch (error) {
    if (error instanceof NodeScaffoldPrivateMaterializerErrorV2) throw error;
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_DEPENDENCY_CAPSULE_INVALID",
      "Dependency capsule could not be normalized and captured",
      error,
    );
  }
}

function captureScaffoldAssetsAfterInstallV2(
  state: PrivateStageStateV2,
  sourceState: "absent" | "present" = "absent",
  outputState: "absent" | "present" = "absent",
): string {
  const root = lstatSync(state.privateRoot);
  const project = lstatSync(state.projectRoot);
  const capsule = lstatSync(state.dependencyCapsuleRoot);
  const expectedProjectNames = [
    "node_modules",
    "package-lock.json",
    "package.json",
    ...(outputState === "present" ? ["dist"] : []),
    ...(sourceState === "present" ? ["src"] : []),
    "tsconfig.json",
  ].sort();
  if (
    root.isSymbolicLink()
    || !root.isDirectory()
    || realpathSync(state.privateRoot) !== state.privateRoot
    || modeBits(root) !== 0o700
    || root.dev !== state.baseCapture.rootFingerprint.device
    || root.ino !== state.baseCapture.rootFingerprint.inode
    || project.isSymbolicLink()
    || !project.isDirectory()
    || realpathSync(state.projectRoot) !== state.projectRoot
    || modeBits(project) !== 0o700
    || capsule.isSymbolicLink()
    || !capsule.isDirectory()
    || realpathSync(state.dependencyCapsuleRoot) !== state.dependencyCapsuleRoot
    || modeBits(capsule) !== 0o555
    || !sameStringsV2(readBoundedDirectoryNamesV2({
      absolutePath: state.privateRoot,
      label: "Private scaffold root",
      maxNames: ROOT_MEMBER_NAMES_V2.length,
      errorCode: "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_STATE_DRIFT",
    }), [...ROOT_MEMBER_NAMES_V2])
    || !sameStringsV2(
      readBoundedDirectoryNamesV2({
        absolutePath: state.projectRoot,
        label: "Private scaffold project root",
        maxNames: expectedProjectNames.length,
        errorCode: "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_STATE_DRIFT",
      }),
      expectedProjectNames,
    )
  ) {
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_STATE_DRIFT",
      "Private scaffold topology changed during dependency installation",
    );
  }
  assertMissingPathV2(path.join(state.projectRoot, ".npmrc"), "Installed project .npmrc");
  if (sourceState === "absent") {
    assertMissingPathV2(path.join(state.projectRoot, "src"), "Installed project source directory");
  }
  if (outputState === "absent") {
    assertMissingPathV2(path.join(state.projectRoot, "dist"), "Candidate build output directory");
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
  const physical = assets.map((asset) => capturePhysicalAssetV2({
    projectRoot: state.projectRoot,
    asset,
  }));
  const membershipHash = hashCanonicalJson({
    schema: "setfarm.scaffold-base-file-membership.v2",
    files: assets.map((asset) => ({
      role: asset.role,
      normalizedLocator: asset.normalizedLocator,
      mode: "0444",
      rawHash: asset.rawHash,
      rawByteLength: asset.rawByteLength,
    })),
  });
  if (
    membershipHash !== state.receipt.baseState.fileMembershipHash
    || physical.some((file) => {
      const expected = state.receipt.assets.find((asset) =>
        asset.normalizedLocator === file.locator);
      return expected?.physicalIdentityHash !== file.physicalIdentityHash;
    })
  ) {
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_STATE_DRIFT",
      "Scaffold base bytes or physical identities changed during dependency installation",
    );
  }
  return membershipHash;
}

function buildDependencyReceiptV2(input: Readonly<{
  state: PrivateStageStateV2;
  install: Awaited<ReturnType<typeof executeNodeScaffoldEnvironmentNpmCiV2>>;
  raw: RawDependencyCaptureV2;
  capsule: CanonicalRuntimeTreeV2;
  metadataAuthority:
    | "code_owned_darwin_acl_nonprovenance_xattr_probe_v2"
    | "test_fixture_clear_probe";
  endBaseFileMembershipHash: string;
}>): BuildDependencyMaterializationReceiptV2 {
  const catalog = getCodeOwnedNodeScaffoldToolchainCatalogV2();
  const entry = getCodeOwnedNodeScaffoldToolchainEntryV2(input.state.profileId);
  const environmentReceipt = inspectNodeScaffoldExecutionEnvironmentReceiptV2(
    input.state.environment,
  );
  if (!entry) {
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_RECEIPT_INVALID",
      "Dependency materialization profile lost its code-owned entry",
    );
  }
  const identity: BuildDependencyMaterializationReceiptHashPayloadV2 = {
    schema: BUILD_DEPENDENCY_MATERIALIZATION_RECEIPT_V2_SCHEMA,
    receiptVersion: PRIVATE_STAGED_MATERIALIZER_VERSION_V2,
    authorityRef: PRIVATE_STAGED_MATERIALIZER_AUTHORITY_REF_V2,
    status: "dependencies_materialized_verified",
    admissionScope: input.state.admissionScope,
    productionUse: "forbidden_until_file_tree_and_build_topology_join",
    materializerAuthority: codeOwnedMaterializerAuthorityV2(),
    catalogBinding: input.state.receipt.catalogBinding,
    environmentBinding: input.state.receipt.environmentBinding,
    hostToolchain: {
      receiptSchema: HOST_NODE_TOOLCHAIN_RECEIPT_V2_SCHEMA,
      receiptHash: environmentReceipt.hostToolchain.receiptHash,
      nodeIdentityHash: environmentReceipt.hostToolchain.nodeIdentityHash,
      npmClosureHash: environmentReceipt.hostToolchain.npmClosureHash,
      npmVersion: "10.9.8",
    },
    scaffoldBase: {
      receiptSchema: SCAFFOLD_BASE_MATERIALIZATION_RECEIPT_V2_SCHEMA,
      receiptHash: input.state.receipt.receiptHash,
      semanticInputHash: input.state.receipt.semanticInputHash,
      startBaseStateHash: input.state.receipt.baseStateHash,
      endBaseFileMembershipHash: input.endBaseFileMembershipHash,
      projectNpmrcState: "absent",
    },
    installExecution: {
      commandRef: "CMD_NODE_SCAFFOLD_INSTALL_V2",
      executableRef: "TOOL_NODE_NPM_CLI_V2",
      directArgv: [...input.install.directArgv],
      directArgvHash: input.install.directArgvHash,
      environmentHash: input.install.environmentHash,
      projectScopeHash: input.install.projectScopeHash,
      shell: "forbidden",
      timeoutMs: input.install.timeoutMs,
      maxStdoutBytes: input.install.maxStdoutBytes,
      maxStderrBytes: input.install.maxStderrBytes,
      status: "exited_zero",
      exitCode: input.install.exitCode,
      signal: input.install.signal,
      stdoutHash: input.install.stdoutHash,
      stdoutBytes: input.install.stdoutBytes,
      stderrHash: input.install.stderrHash,
      stderrBytes: input.install.stderrBytes,
    },
    lockGraph: {
      graphHash: entry.dependencyGraph.graphHash,
      lockRawHash: entry.dependencyGraph.lockRawHash,
      expectedNodeCount: entry.dependencyGraph.nodeCount,
      installedPackageCount: entry.dependencyGraph.nodeCount,
      expectedEdgeCount: entry.dependencyGraph.edgeCount,
      installedPackageMembershipHash: input.raw.installedPackageMembershipHash,
      hiddenLockRawHash: input.raw.hiddenLockRawHash,
      hiddenLockGraphHash: input.raw.hiddenLockGraphHash,
      graphDisposition: "every_and_only_verified",
    },
    lifecycleAndEnginePolicy: {
      lifecycleBarrier: "exact_npm_ci_ignore_scripts",
      lifecycleExecutionAuthority: "npm_exact_ignore_scripts_argv_barrier_v2",
      nativeLockMetadata: "absent",
      engineStrict: true,
      nodeVersion: "22.23.1",
      compatibilityDisposition: "npm_engine_strict_exit_zero",
      integrityAuthority: "npm_10_9_8_lock_integrity_enforcement",
    },
    installedBins: {
      count: input.raw.installedBins.length,
      membershipHash: input.raw.installedBinsMembershipHash,
      entries: input.raw.installedBins.map((entry) => ({ ...entry })),
      disposition: "every_and_only_verified_npm_links",
    },
    rawInstallTree: {
      fileCount: input.raw.fileCount,
      directoryCount: input.raw.directoryCount,
      symbolicLinkCount: input.raw.symbolicLinkCount,
      totalBytes: input.raw.totalBytes,
      membershipHash: input.raw.membershipHash,
      mutationPolicy: "private_disposable_install_output_v2",
    },
    dependencyCapsuleAuthority: {
      normalization: "exclusive_readonly_copy_without_generated_npm_links_v2",
      metadataNormalization:
        input.metadataAuthority === "code_owned_darwin_acl_nonprovenance_xattr_probe_v2"
        ? "code_owned_darwin_writable_copy_acl_xattr_clear_provenance_exclusion_readonly_seal_fsync_v2"
        : "test_fixture_none",
      metadataProbe: input.metadataAuthority,
      hostMetadataExclusion: input.metadataAuthority
        === "code_owned_darwin_acl_nonprovenance_xattr_probe_v2"
        ? "com.apple.provenance_only_not_in_canonical_tree_v2"
        : "test_fixture_none",
      generatedNpmLinks: "verified_in_raw_tree_excluded_from_capsule",
    },
    dependencyCapsule: input.capsule,
    dependencyIdentityHash: "0".repeat(64),
  };
  identity.dependencyIdentityHash = hashBuildDependencyIdentityV2({
    catalogBinding: identity.catalogBinding,
    environmentBinding: identity.environmentBinding,
    hostToolchain: identity.hostToolchain,
    scaffoldBase: identity.scaffoldBase,
    installExecution: identity.installExecution,
    lockGraph: identity.lockGraph,
    lifecycleAndEnginePolicy: identity.lifecycleAndEnginePolicy,
    installedBins: identity.installedBins,
    rawInstallTree: identity.rawInstallTree,
    dependencyCapsuleAuthority: identity.dependencyCapsuleAuthority,
    dependencyCapsule: identity.dependencyCapsule,
  });
  const parsed = BuildDependencyMaterializationReceiptV2Schema.safeParse({
    ...identity,
    receiptHash: hashBuildDependencyMaterializationReceiptV2(identity),
  });
  if (!parsed.success) {
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_RECEIPT_INVALID",
      "Dependency materialization receipt failed its canonical schema",
      parsed.error,
    );
  }
  if (
    catalog.catalogHash !== parsed.data.catalogBinding.catalogHash
    || entry.entryHash !== parsed.data.catalogBinding.entryHash
    || environmentReceipt.environment.environmentHash
      !== parsed.data.installExecution.environmentHash
    || environmentReceipt.effectiveNpmConfig.effectiveConfigHash
      !== parsed.data.environmentBinding.effectiveConfigHash
  ) {
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_RECEIPT_INVALID",
      "Dependency materialization receipt lost a fresh catalog or environment join",
    );
  }
  return deepFreezeJson(parsed.data);
}

function safeRemoveOwnedAttemptV2(
  privateRoot: string,
  expectedCensus: PrivateCleanupCensusV2,
): void {
  try {
    destroyPrivateCleanupCensusV2(privateRoot, expectedCensus);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
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
  let cleanupCensus: PrivateCleanupCensusV2 | undefined;
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
    cleanupCensus = layout.initialCleanupCensus;
    for (const asset of assets) {
      writeExclusiveAssetV2({
        projectRoot: layout.projectRoot,
        asset,
        onCreated: (absolutePath) => {
          cleanupCensus = extendPrivateCleanupCensusWithCreatedMemberV2({
            privateRoot: layout!.privateRoot,
            current: cleanupCensus,
            absolutePath,
            locator: `project/${asset.normalizedLocator}`,
          });
          input.hooks?.afterBoundary?.(
            asset.normalizedLocator === "package-lock.json"
              ? "after_package_lock_create"
              : asset.normalizedLocator === "package.json"
                ? "after_package_json_create"
                : "after_tsconfig_create",
          );
          cleanupCensus = capturePrivateCleanupCensusV2(layout!.privateRoot);
        },
      });
      cleanupCensus = capturePrivateCleanupCensusV2(layout.privateRoot);
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
    cleanupCensus = capturePrivateCleanupCensusV2(layout.privateRoot);
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
    const lifecycle: MutableLifecycleV2 = {
      status: "base_ready",
      cleanupCensus: capturePrivateCleanupCensusV2(layout.privateRoot),
    };
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
      ...(input.hooks ? { cleanupTestHooks: input.hooks } : {}),
    });
    const handle = new MaterializedNodeScaffoldPrivateStageV2(
      materializedStageConstructorCapabilityV2,
      state,
    );
    layout = undefined;
    return handle;
  } catch (error) {
    let cleanupError: unknown;
    if (layout && cleanupCensus) {
      try {
        safeRemoveOwnedAttemptV2(layout.privateRoot, cleanupCensus);
      } catch (candidate) {
        cleanupError = candidate;
      }
    }
    if (cleanupError !== undefined) {
      return fail(
        error instanceof NodeScaffoldPrivateMaterializerErrorV2
          ? error.code
          : "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_MATERIALIZATION_FAILED",
        `Private scaffold base materialization failed and cleanup retained its authenticated root ${layout?.privateRoot}`,
        new AggregateError(
          [error, cleanupError],
          "Private base failure and exact cleanup failure",
        ),
      );
    }
    if (error instanceof NodeScaffoldPrivateMaterializerErrorV2) throw error;
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_MATERIALIZATION_FAILED",
      "Private scaffold base materialization failed",
      error,
    );
  } finally {
    for (const asset of assets) asset.bytes.fill(0);
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
      || Reflect.ownKeys(testHooks).some((key) =>
        key !== "afterBoundary"
        && key !== "afterCleanupDirectoryWritable"
        && key !== "afterCleanupDirectoryDescriptorClose"
        && key !== "beforeCleanupCensusDirectoryRead"
        && key !== "afterCleanupCensusDirectoryClose"
        && key !== "afterDependencyCapsuleDestinationCreate"
        && key !== "afterDependencyCapsuleSourceDescriptorClose"
        && key !== "afterDependencyCapsuleDestinationDescriptorClose"
        && key !== "beforeDependencyCapsuleSourceDirectoryRead"
        && key !== "afterCleanupDirectoryModeRestore"
        && key !== "beforeRawDependencyFileRead"
        && key !== "maxRawDependencyDirectoryEntriesForTest")
      || (testHooks.afterBoundary !== undefined && typeof testHooks.afterBoundary !== "function")
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
      || (
        testHooks.afterDependencyCapsuleDestinationCreate !== undefined
        && typeof testHooks.afterDependencyCapsuleDestinationCreate !== "function"
      )
      || (
        testHooks.afterDependencyCapsuleSourceDescriptorClose !== undefined
        && typeof testHooks.afterDependencyCapsuleSourceDescriptorClose !== "function"
      )
      || (
        testHooks.afterDependencyCapsuleDestinationDescriptorClose !== undefined
        && typeof testHooks.afterDependencyCapsuleDestinationDescriptorClose !== "function"
      )
      || (
        testHooks.beforeDependencyCapsuleSourceDirectoryRead !== undefined
        && typeof testHooks.beforeDependencyCapsuleSourceDirectoryRead !== "function"
      )
      || (
        testHooks.afterCleanupDirectoryModeRestore !== undefined
        && typeof testHooks.afterCleanupDirectoryModeRestore !== "function"
      )
      || (
        testHooks.beforeRawDependencyFileRead !== undefined
        && typeof testHooks.beforeRawDependencyFileRead !== "function"
      )
      || (
        testHooks.maxRawDependencyDirectoryEntriesForTest !== undefined
        && (
          typeof testHooks.maxRawDependencyDirectoryEntriesForTest !== "number"
          || !Number.isSafeInteger(testHooks.maxRawDependencyDirectoryEntriesForTest)
          || testHooks.maxRawDependencyDirectoryEntriesForTest < 0
        )
      )
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
  if (state.lifecycle.status !== "base_ready") {
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_INSTALL_ALREADY_CONSUMED",
      "Scaffold base revalidation is available only before its one-shot install",
    );
  }
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

export type NodeScaffoldPrivateInstallScopeInternalV2 = Readonly<{
  admissionScope: "production_host" | "test_fixture";
  profileId: NodeScaffoldProfileIdV2;
  projectRoot: string;
  scaffoldBaseReceiptHash: string;
}>;

/** @internal Authenticated bridge used only by the execution-environment boundary. */
export function acquireNodeScaffoldPrivateInstallScopeInternalV2(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  expectedEnvironmentReceiptHash: string,
): NodeScaffoldPrivateInstallScopeInternalV2 {
  const state = activeStageStateV2(handle);
  if (state.lifecycle.status !== "install_claimed") {
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_INSTALL_ALREADY_CONSUMED",
      "Private scaffold dependency installation lacks its single-use preclaim",
    );
  }
  if (state.receipt.environmentBinding.receiptHash !== expectedEnvironmentReceiptHash) {
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_ENVIRONMENT_INVALID",
      "Private scaffold and execution environment receipts do not join",
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
      "Private scaffold base changed before dependency installation",
    );
  }
  state.lifecycle.status = "installing";
  return Object.freeze({
    admissionScope: state.admissionScope,
    profileId: state.profileId,
    projectRoot: state.projectRoot,
    scaffoldBaseReceiptHash: state.receipt.receiptHash,
  });
}

/** @internal Consumes the one-shot stage lease on every process outcome. */
export function settleNodeScaffoldPrivateInstallScopeInternalV2(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  scaffoldBaseReceiptHash: string,
): void {
  const state = activeStageStateV2(handle);
  if (
    state.lifecycle.status !== "installing"
    || state.receipt.receiptHash !== scaffoldBaseReceiptHash
  ) {
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_STATE_DRIFT",
      "Private scaffold install lease cannot be settled from this state",
    );
  }
  const captureErrors: unknown[] = [];
  try {
    state.lifecycle.cleanupCensus = capturePrivateCleanupCensusV2(state.privateRoot);
  } catch (error) {
    captureErrors.push(error);
  }
  state.lifecycle.status = "install_consumed";
  if (captureErrors.length > 0) {
    const [error] = captureErrors;
    if (error instanceof NodeScaffoldPrivateMaterializerErrorV2) throw error;
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_STATE_DRIFT",
      "Private scaffold install lease was consumed without a fresh exact cleanup census",
      error,
    );
  }
}

async function materializeDependenciesV2(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  admissionScope: "production_host" | "test_fixture",
  metadataAuthority:
    | "code_owned_darwin_acl_nonprovenance_xattr_probe_v2"
    | "test_fixture_clear_probe",
): Promise<BuildDependencyMaterializationReceiptV2> {
  const state = activeStageStateV2(handle);
  if (state.admissionScope !== admissionScope) {
    return fail(
      admissionScope === "production_host"
        ? "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_PRODUCTION_AUTHORITY_REQUIRED"
        : "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_INPUT_INVALID",
      "Dependency materializer cannot promote, downgrade or cross execution scopes",
    );
  }
  if (state.lifecycle.status !== "base_ready") {
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_INSTALL_ALREADY_CONSUMED",
      "Dependency materialization is single-use for each private scaffold stage",
    );
  }
  const entry = getCodeOwnedNodeScaffoldToolchainEntryV2(state.profileId);
  if (!entry) {
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_RECEIPT_INVALID",
      "Dependency materialization profile lost its code-owned entry",
    );
  }
  state.lifecycle.status = "install_claimed";
  try {
    const install = await executeNodeScaffoldEnvironmentNpmCiV2(state.environment, handle);
    if ((state.lifecycle as MutableLifecycleV2).status !== "install_consumed") {
      return fail(
        "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_STATE_DRIFT",
        "Private scaffold install lease was not consumed after npm ci",
      );
    }
    const raw = captureRawDependenciesV2({
      projectRoot: state.projectRoot,
      entry,
      testHooks: state.cleanupTestHooks,
    });
    const metadataProbe = metadataAuthority
      === "code_owned_darwin_acl_nonprovenance_xattr_probe_v2"
      ? codeOwnedDarwinMetadataProbeV2
      : clearTestMetadataProbeV2;
    const capsule = normalizeDependencyCapsuleV2({
      nodeModulesRoot: path.join(state.projectRoot, "node_modules"),
      capsuleRoot: state.dependencyCapsuleRoot,
      raw,
      metadataProbe,
      metadataAuthority,
      admissionScope,
      testHooks: state.cleanupTestHooks,
      onCreated: (absolutePath, locator) => {
        state.lifecycle.cleanupCensus = extendPrivateCleanupCensusWithCreatedMemberV2({
          privateRoot: state.privateRoot,
          current: state.lifecycle.cleanupCensus,
          absolutePath,
          locator: `dependency-capsule/${locator}`,
        });
        state.lifecycle.cleanupCensus = capturePrivateCleanupCensusV2(state.privateRoot);
      },
    });
    const endBaseFileMembershipHash = captureScaffoldAssetsAfterInstallV2(state);
    const receipt = buildDependencyReceiptV2({
      state,
      install,
      raw,
      capsule,
      metadataAuthority,
      endBaseFileMembershipHash,
    });
    state.lifecycle.dependencyReceipt = receipt;
    state.lifecycle.dependencyCapture = Object.freeze({
      raw,
      capsule,
      metadataProbe,
      metadataAuthority,
    });
    state.lifecycle.cleanupCensus = capturePrivateCleanupCensusV2(state.privateRoot);
    state.lifecycle.status = "dependencies_ready";
    return defensiveCopy(receipt);
  } catch (error) {
    let cleanupError: unknown;
    try {
      destroyNodeScaffoldPrivateStageV2(handle);
    } catch (candidate) {
      cleanupError = candidate;
    }
    if (cleanupError !== undefined) {
      return fail(
        "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_STATE_DRIFT",
        "Failed dependency attempt could not clean only its authenticated private root",
        new AggregateError(
          [error, cleanupError],
          `Dependency failure retained authenticated private root ${state.privateRoot}`,
        ),
      );
    }
    if (error instanceof NodeScaffoldPrivateMaterializerErrorV2) throw error;
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_DEPENDENCY_INSTALL_FAILED",
      "Authenticated dependency materialization failed and its private attempt was removed",
      error,
    );
  }
}

export async function materializeNodeScaffoldDependenciesV2(
  handle: MaterializedNodeScaffoldPrivateStageV2,
): Promise<BuildDependencyMaterializationReceiptV2> {
  let production: boolean;
  try {
    production = isProductionNodeScaffoldPrivateStageV2(handle);
  } catch (error) {
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_HANDLE_UNAUTHENTICATED",
      "Production dependency materialization requires one authentic private stage",
      error,
    );
  }
  if (!production) {
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_PRODUCTION_AUTHORITY_REQUIRED",
      "Production dependency materialization requires a production_host private stage",
    );
  }
  return materializeDependenciesV2(
    handle,
    "production_host",
    "code_owned_darwin_acl_nonprovenance_xattr_probe_v2",
  );
}

export async function materializeNodeScaffoldDependenciesV2ForTest(
  handle: MaterializedNodeScaffoldPrivateStageV2,
): Promise<BuildDependencyMaterializationReceiptV2> {
  let production: boolean;
  try {
    production = isProductionNodeScaffoldPrivateStageV2(handle);
  } catch (error) {
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_HANDLE_UNAUTHENTICATED",
      "Test dependency materialization requires one authentic private stage",
      error,
    );
  }
  if (production) {
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_INPUT_INVALID",
      "Test dependency materializer cannot consume production authority",
    );
  }
  return materializeDependenciesV2(handle, "test_fixture", "test_fixture_clear_probe");
}

/**
 * Uses official runtime bytes and real Darwin metadata probes while retaining
 * test_fixture scope, so release rehearsal cannot promote a private test root.
 */
export async function materializeNodeScaffoldDependenciesV2ForOfficialRehearsal(
  handle: MaterializedNodeScaffoldPrivateStageV2,
): Promise<BuildDependencyMaterializationReceiptV2> {
  let production: boolean;
  try {
    production = isProductionNodeScaffoldPrivateStageV2(handle);
  } catch (error) {
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_HANDLE_UNAUTHENTICATED",
      "Official dependency rehearsal requires one authentic private stage",
      error,
    );
  }
  if (production) {
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_INPUT_INVALID",
      "Official test rehearsal cannot consume or downgrade production authority",
    );
  }
  return materializeDependenciesV2(
    handle,
    "test_fixture",
    "code_owned_darwin_acl_nonprovenance_xattr_probe_v2",
  );
}

export function inspectBuildDependencyMaterializationReceiptV2(
  handle: MaterializedNodeScaffoldPrivateStageV2,
): BuildDependencyMaterializationReceiptV2 {
  const state = activeStageStateV2(handle);
  if (
    ![
      "dependencies_ready",
      "source_claimed",
      "sources_ready",
      "build_process_consumed",
      "build_ready",
      "runtime_bundle_claimed",
      "runtime_bundle_consumed",
    ].includes(state.lifecycle.status)
    || !state.lifecycle.dependencyReceipt
    || !state.lifecycle.dependencyCapture
  ) {
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_INSTALL_ALREADY_CONSUMED",
      "Verified dependency materialization is not available for this stage",
    );
  }
  return defensiveCopy(state.lifecycle.dependencyReceipt);
}

/** @internal Revalidates the stage-owned environment before logical hashing. */
export function revalidateNodeScaffoldStageHostToolchainLogicalIdentityInternalV3(
  handle: MaterializedNodeScaffoldPrivateStageV2,
): Promise<HostNodeToolchainLogicalProjectionV3> {
  const state = activeStageStateV2(handle);
  if (
    ![
      "dependencies_ready",
      "source_claimed",
      "sources_ready",
      "build_process_consumed",
      "build_ready",
      "runtime_bundle_claimed",
      "runtime_bundle_consumed",
    ].includes(state.lifecycle.status)
    || !state.lifecycle.dependencyReceipt
    || !state.lifecycle.dependencyCapture
  ) {
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_INSTALL_ALREADY_CONSUMED",
      "Logical host toolchain identity requires a verified dependency stage",
    );
  }
  return revalidateNodeScaffoldHostToolchainLogicalIdentityInternalV3(
    state.environment,
  );
}

export async function revalidateNodeScaffoldDependenciesV2(
  handle: MaterializedNodeScaffoldPrivateStageV2,
): Promise<BuildDependencyMaterializationReceiptV2> {
  const state = activeStageStateV2(handle);
  const receipt = state.lifecycle.dependencyReceipt;
  const prior = state.lifecycle.dependencyCapture;
  if (
    ![
      "dependencies_ready",
      "source_claimed",
      "sources_ready",
      "build_process_consumed",
      "build_ready",
      "runtime_bundle_claimed",
      "runtime_bundle_consumed",
    ].includes(state.lifecycle.status)
    || !receipt
    || !prior
  ) {
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_INSTALL_ALREADY_CONSUMED",
      "Dependency revalidation requires one completed verified materialization",
    );
  }
  try {
    const entry = getCodeOwnedNodeScaffoldToolchainEntryV2(state.profileId);
    if (!entry) {
      return fail(
        "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_STATE_DRIFT",
        "Dependency profile no longer has code-owned authority",
      );
    }
    const endMembership = captureScaffoldAssetsAfterInstallV2(
      state,
      [
        "sources_ready",
        "build_process_consumed",
        "build_ready",
        "runtime_bundle_claimed",
        "runtime_bundle_consumed",
      ]
        .includes(state.lifecycle.status) ? "present" : "absent",
      [
        "build_process_consumed",
        "build_ready",
        "runtime_bundle_claimed",
        "runtime_bundle_consumed",
      ]
        .includes(state.lifecycle.status) ? "present" : "absent",
    );
    const raw = captureRawDependenciesV2({ projectRoot: state.projectRoot, entry });
    if (
      endMembership !== receipt.scaffoldBase.endBaseFileMembershipHash
      || hashCanonicalJson(raw) !== hashCanonicalJson(prior.raw)
    ) {
      return fail(
        "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_STATE_DRIFT",
        "Raw dependencies or scaffold inputs changed after materialization",
      );
    }
    const capsule = verifyCanonicalRuntimeTreeV2({
      root: state.dependencyCapsuleRoot,
      candidate: receipt.dependencyCapsule,
      metadataProbe: prior.metadataProbe,
    });
    if (capsule.payloadHash !== prior.capsule.payloadHash) {
      return fail(
        "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_STATE_DRIFT",
        "Dependency capsule no longer reproduces its issued identity",
      );
    }
    const authority = codeOwnedMaterializerAuthorityV2();
    const environment = inspectNodeScaffoldExecutionEnvironmentReceiptV2(state.environment);
    if (
      authority.authorityHash !== receipt.materializerAuthority.authorityHash
      || environment.receiptHash !== receipt.environmentBinding.receiptHash
      || prior.metadataAuthority !== receipt.dependencyCapsuleAuthority.metadataProbe
      || getCodeOwnedNodeScaffoldToolchainCatalogV2().catalogHash
        !== receipt.catalogBinding.catalogHash
    ) {
      return fail(
        "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_STATE_DRIFT",
        "Dependency receipt no longer joins current code-owned authorities",
      );
    }
    return defensiveCopy(receipt);
  } catch (error) {
    if (
      error instanceof NodeScaffoldPrivateMaterializerErrorV2
      && error.code === "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_STATE_DRIFT"
    ) throw error;
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_STATE_DRIFT",
      "Dependency materialization could not be freshly reproduced",
      error,
    );
  }
}

async function capturePublishedSourceAuthorityV1(
  casAuthority: DeepByteBundleCasAuthorityV2,
  publication: PublishedSourceArtifactAuthorityV1,
): Promise<CapturedPublishedSourceV1> {
  const publicationReceipt = NodeProductSourcePublicationReceiptV1Schema.parse(
    publication.receipt,
  );
  if (publicationReceipt.authority.sourceRole !== publication.sourceRole) {
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_SOURCE_AUTHORITY_INVALID",
      "Source publication role changed before private materialization",
    );
  }
  const sourceReceipt = publication.sourceRole === "runtime"
    ? NodeProductRuntimeSourceReceiptV2Schema.parse(publication.sourceReceipt)
    : NodeProductTestSourceReceiptV2Schema.parse(publication.sourceReceipt);
  const bindingIdentity = {
    authoritySchema: publicationReceipt.schema,
    authorityHash: publicationReceipt.receiptHash,
    subjectRef:
      `${publication.sourceRole}:${publicationReceipt.authority.source.pathRef}`,
    subjectHash: publicationReceipt.authority.source.sourceIdentityHash,
  };
  const reads = await Promise.allSettled([
    verifySemanticArtifactEnvelopeFromCasV1({
      authority: casAuthority,
      expectedEnvelope: publication.receiptEnvelope,
    }),
    verifySemanticArtifactEnvelopeFromCasV1({
      authority: casAuthority,
      expectedEnvelope: publication.sourceReceiptEnvelope,
    }),
    verifyDeepByteBundleFromCasV2({
      authority: casAuthority,
      binding: {
        ...bindingIdentity,
        bindingHash: hashDeepByteBundleConsumerBindingV2(bindingIdentity),
      },
      bundle: publicationReceipt.authority.sourceBundle,
    }),
  ] as const);
  const rejected = reads.find((result) => result.status === "rejected");
  if (rejected?.status === "rejected") throw rejected.reason;
  const publicationArtifact = reads[0];
  const sourceReceiptArtifact = reads[1];
  const sourceBundle = reads[2];
  if (
    publicationArtifact.status !== "fulfilled"
    || sourceReceiptArtifact.status !== "fulfilled"
    || sourceBundle.status !== "fulfilled"
  ) {
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_SOURCE_AUTHORITY_INVALID",
      "Source publication artifact reads did not settle completely",
    );
  }
  const publicationEnvelope = copyVerifiedSemanticArtifactEnvelopeV1(
    publicationArtifact.value,
  );
  const sourceReceiptEnvelope = copyVerifiedSemanticArtifactEnvelopeV1(
    sourceReceiptArtifact.value,
  );
  const parsedPublicationPayload = NodeProductSourcePublicationReceiptV1Schema.parse(
    publicationEnvelope.payload,
  );
  const parsedSourcePayload = publication.sourceRole === "runtime"
    ? NodeProductRuntimeSourceReceiptV2Schema.parse(sourceReceiptEnvelope.payload)
    : NodeProductTestSourceReceiptV2Schema.parse(sourceReceiptEnvelope.payload);
  const bytes = copyVerifiedDeepByteBundleBytesV2(sourceBundle.value);
  const publicationCasReceipt = publicationArtifact.value.receipt;
  const sourceCasReceipt = sourceReceiptArtifact.value.receipt;
  const deepReceipt = sourceBundle.value.receipt;
  if (
    hashCanonicalJson(parsedPublicationPayload)
      !== hashCanonicalJson(publicationReceipt)
    || hashCanonicalJson(parsedSourcePayload) !== hashCanonicalJson(sourceReceipt)
    || publicationCasReceipt.expected.envelopeHash
      !== publication.receiptArtifactHash
    || publicationCasReceipt.expected.envelopeByteLength
      !== publication.receiptArtifactByteLength
    || sourceCasReceipt.expected.envelopeHash
      !== publication.sourceReceiptArtifactHash
    || sourceCasReceipt.expected.envelopeByteLength
      !== publication.sourceReceiptArtifactByteLength
    || publicationReceipt.authority.sourceReceiptArtifact.envelopeHash
      !== publication.sourceReceiptArtifactHash
    || publicationReceipt.authority.sourceReceiptArtifact.receiptHash
      !== sourceReceipt.receiptHash
    || deepReceipt.bundle.envelopeHash
      !== publicationReceipt.authority.sourceBundle.envelopeHash
    || deepReceipt.bundle.rawHash !== sourceReceipt.source.contentHash
    || deepReceipt.bundle.rawByteLength !== sourceReceipt.source.byteLength
    || deepReceipt.binding.authorityHash !== publicationReceipt.receiptHash
    || deepReceipt.binding.subjectHash !== sourceReceipt.source.sourceIdentityHash
    || bytes.byteLength !== sourceReceipt.source.byteLength
    || sha256(bytes) !== sourceReceipt.source.contentHash
  ) {
    bytes.fill(0);
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_SOURCE_AUTHORITY_INVALID",
      `${publication.sourceRole} source publication, indexed receipts and ByteBundle do not join`,
    );
  }
  return Object.freeze({
    sourceRole: publication.sourceRole,
    publicationReceipt,
    publicationReceiptEnvelope: publicationEnvelope,
    publicationReceiptArtifactHash:
      publicationCasReceipt.expected.envelopeHash,
    publicationReceiptArtifactByteLength:
      publicationCasReceipt.expected.envelopeByteLength,
    publicationCasVerificationReceiptHash: publicationCasReceipt.receiptHash,
    sourceReceipt,
    sourceReceiptEnvelope,
    sourceReceiptArtifactHash: sourceCasReceipt.expected.envelopeHash,
    sourceReceiptArtifactByteLength:
      sourceCasReceipt.expected.envelopeByteLength,
    sourceReceiptCasVerificationReceiptHash: sourceCasReceipt.receiptHash,
    deepVerificationReceiptHash: deepReceipt.receiptHash,
    consumerBindingHash: deepReceipt.binding.bindingHash,
    bytes,
  });
}

function sourceMemberNamesV1(
  profileId: NodeScaffoldProfileIdV2,
): readonly [string, string] {
  return profileId === "PROFILE_NODE_CLI_STATELESS_EXACT_V2"
    ? ["cli.setfarm.test.ts", "cli.ts"]
    : ["app.setfarm.test.ts", "app.ts"];
}

function expectedSourceLocatorV1(
  profileId: NodeScaffoldProfileIdV2,
  role: NodeProductSourceRoleV1,
): string {
  if (profileId === "PROFILE_NODE_CLI_STATELESS_EXACT_V2") {
    return role === "runtime" ? "src/cli.ts" : "src/cli.setfarm.test.ts";
  }
  return role === "runtime" ? "src/app.ts" : "src/app.setfarm.test.ts";
}

function writeExclusivePublishedSourceV1(input: Readonly<{
  state: PrivateStageStateV2;
  source: CapturedPublishedSourceV1;
  onCreated: (absolutePath: string, locator: string) => void;
}>): PhysicalSourceCaptureV1 {
  const expectedLocator = expectedSourceLocatorV1(
    input.state.profileId,
    input.source.sourceRole,
  );
  const locator = input.source.sourceReceipt.source.normalizedLocator;
  if (
    locator !== expectedLocator
    || path.posix.dirname(locator) !== "src"
    || path.posix.basename(locator) !== locator.slice(4)
  ) {
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_SOURCE_AUTHORITY_INVALID",
      `${input.source.sourceRole} source locator differs from its code-owned profile target`,
    );
  }
  const absolutePath = path.join(input.state.projectRoot, locator);
  let descriptor: number | undefined;
  try {
    return runWithIndependentFinalizersV2({
      operation: () => {
        descriptor = openSync(
      absolutePath,
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW,
      0o600,
    );
    input.onCreated(absolutePath, locator);
    let offset = 0;
    while (offset < input.source.bytes.byteLength) {
      const written = writeSync(
        descriptor,
        input.source.bytes,
        offset,
        input.source.bytes.byteLength - offset,
        null,
      );
      if (written < 1) {
        return fail(
          "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_SOURCE_MATERIALIZATION_FAILED",
          `Exclusive ${input.source.sourceRole} source write ended early`,
        );
      }
      offset += written;
    }
    fchmodSync(descriptor, 0o444);
    fsyncSync(descriptor);
    const stat = fstatSync(descriptor);
    const fileFingerprint = fingerprint(stat);
    if (
      !stat.isFile()
      || stat.isSymbolicLink()
      || stat.nlink !== 1
      || modeBits(stat) !== 0o444
      || stat.uid !== processOwnerV2().uid
      || stat.gid !== processOwnerV2().gid
      || stat.size !== input.source.sourceReceipt.source.byteLength
    ) {
      return fail(
        "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_SOURCE_MATERIALIZATION_FAILED",
        `Exclusive ${input.source.sourceRole} source metadata is invalid`,
      );
    }
        return Object.freeze({
      sourceRole: input.source.sourceRole,
      normalizedLocator: locator,
      fingerprint: fileFingerprint,
      contentHash: input.source.sourceReceipt.source.contentHash,
      physicalIdentityHash: hashCanonicalJson({
        schema: "setfarm.node-product-source-physical-file-identity.v1",
        sourceRole: input.source.sourceRole,
        normalizedLocator: locator,
        fingerprint: fileFingerprint,
        contentHash: input.source.sourceReceipt.source.contentHash,
      }),
        });
      },
      finalizers: [() => {
        if (descriptor !== undefined) closeSync(descriptor);
      }],
      onFinalizerFailure: (errors) => fail(
        "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_SOURCE_MATERIALIZATION_FAILED",
        `${input.source.sourceRole} source write or descriptor close failed`,
        new AggregateError(errors, "Source write and descriptor finalization failures"),
      ),
    });
  } catch (error) {
    if (error instanceof NodeScaffoldPrivateMaterializerErrorV2) throw error;
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_SOURCE_MATERIALIZATION_FAILED",
      `${input.source.sourceRole} source could not be written exclusively`,
      error,
    );
  }
}

function capturePhysicalSourceV1(input: Readonly<{
  state: PrivateStageStateV2;
  sourceRole: NodeProductSourceRoleV1;
  normalizedLocator: string;
  contentHash: string;
  byteLength: number;
}>): PhysicalSourceCaptureV1 {
  const expectedLocator = expectedSourceLocatorV1(
    input.state.profileId,
    input.sourceRole,
  );
  if (input.normalizedLocator !== expectedLocator) {
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_STATE_DRIFT",
      `${input.sourceRole} source locator changed after materialization`,
    );
  }
  const absolutePath = path.join(input.state.projectRoot, input.normalizedLocator);
  let descriptor: number | undefined;
  try {
    return runWithIndependentFinalizersV2({
      operation: () => {
        descriptor = openSync(
          absolutePath,
          constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
        );
        const before = fstatSync(descriptor);
        if (before.size !== input.byteLength) {
          return fail(
            "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_STATE_DRIFT",
            `${input.sourceRole} source differs from its admitted byte length`,
          );
        }
        const bytes = readExactDescriptorBytesV2({
          descriptor,
          admittedByteLength: input.byteLength,
          label: `${input.sourceRole} source`,
          errorCode: "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_STATE_DRIFT",
        });
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
          || sha256(bytes) !== input.contentHash
        ) {
          return fail(
            "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_STATE_DRIFT",
            `${input.sourceRole} source changed after materialization`,
          );
        }
        return Object.freeze({
          sourceRole: input.sourceRole,
          normalizedLocator: input.normalizedLocator,
          fingerprint: fileFingerprint,
          contentHash: input.contentHash,
          physicalIdentityHash: hashCanonicalJson({
            schema: "setfarm.node-product-source-physical-file-identity.v1",
            sourceRole: input.sourceRole,
            normalizedLocator: input.normalizedLocator,
            fingerprint: fileFingerprint,
            contentHash: input.contentHash,
          }),
        });
      },
      finalizers: [() => {
        if (descriptor !== undefined) closeSync(descriptor);
      }],
      onFinalizerFailure: (errors) => fail(
        "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_STATE_DRIFT",
        `${input.sourceRole} source read or descriptor close failed`,
        new AggregateError(errors, "Source read and descriptor finalization failures"),
      ),
    });
  } catch (error) {
    if (error instanceof NodeScaffoldPrivateMaterializerErrorV2) throw error;
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_STATE_DRIFT",
      `${input.sourceRole} source could not be fresh-read`,
      error,
    );
  }
}

function captureSourceMaterializationV1(input: Readonly<{
  state: PrivateStageStateV2;
  sources: readonly NodeProductSourceMaterializationEntryV1[];
  outputState?: "absent" | "present";
}>): SourceMaterializationCaptureV1 {
  const dependency = input.state.lifecycle.dependencyReceipt;
  if (!dependency) {
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_STATE_DRIFT",
      "Source capture lost its dependency materialization receipt",
    );
  }
  const baseMembership = captureScaffoldAssetsAfterInstallV2(
    input.state,
    "present",
    input.outputState ?? "absent",
  );
  if (baseMembership !== dependency.scaffoldBase.endBaseFileMembershipHash) {
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_STATE_DRIFT",
      "Scaffold base changed while source targets were materialized",
    );
  }
  const sourceRoot = path.join(input.state.projectRoot, "src");
  const memberNames = sourceMemberNamesV1(input.state.profileId);
  const directoryFingerprint = captureDirectoryV2({
    absolutePath: sourceRoot,
    expectedNames: memberNames,
    label: "Private generated source directory",
  });
  const sources = Object.freeze(input.sources.map((source) =>
    capturePhysicalSourceV1({
      state: input.state,
      sourceRole: source.sourceRole,
      normalizedLocator: source.source.normalizedLocator,
      contentHash: source.source.contentHash,
      byteLength: source.source.byteLength,
    })));
  const membershipHash = hashNodeProductSourceMaterializationMembershipV1(
    input.sources,
  );
  const directoryPhysicalIdentityHash = hashCanonicalJson({
    schema: "setfarm.node-product-source-directory-physical-identity.v1",
    fingerprint: directoryFingerprint,
    memberNames,
    sources: sources.map((source) => ({
      sourceRole: source.sourceRole,
      physicalIdentityHash: source.physicalIdentityHash,
    })),
  });
  return Object.freeze({
    directoryFingerprint,
    directoryPhysicalIdentityHash,
    sources,
    membershipHash,
  });
}

function materializationEntryV1(
  source: CapturedPublishedSourceV1,
  physical: PhysicalSourceCaptureV1,
): NodeProductSourceMaterializationEntryV1 {
  return {
    sourceRole: source.sourceRole,
    sourceReceipt: {
      schema: source.sourceReceipt.schema,
      logicalReceiptHash: source.sourceReceipt.logicalReceiptHash,
      receiptHash: source.sourceReceipt.receiptHash,
      artifactHash: source.sourceReceiptArtifactHash,
      artifactByteLength: source.sourceReceiptArtifactByteLength,
      casVerificationReceiptSchema:
        SEMANTIC_ARTIFACT_CAS_VERIFICATION_RECEIPT_V1_SCHEMA,
      casVerificationReceiptHash:
        source.sourceReceiptCasVerificationReceiptHash,
    },
    publicationReceipt: {
      schema: NODE_PRODUCT_SOURCE_PUBLICATION_RECEIPT_V1_SCHEMA,
      receiptHash: source.publicationReceipt.receiptHash,
      entryCommitmentHash: source.publicationReceipt.entryCommitmentHash,
      receiptSetCommitmentHash:
        source.publicationReceipt.receiptSet.commitmentHash,
      fileTreeManifestHash:
        source.publicationReceipt.authority.fileTreeManifestHash,
      logicalBuildHash:
        source.publicationReceipt.authority.buildTopology.logicalBuildHash,
      buildTopologyManifestHash:
        source.publicationReceipt.authority.buildTopology.manifestHash,
      artifactHash: source.publicationReceiptArtifactHash,
      artifactByteLength: source.publicationReceiptArtifactByteLength,
      casVerificationReceiptSchema:
        SEMANTIC_ARTIFACT_CAS_VERIFICATION_RECEIPT_V1_SCHEMA,
      casVerificationReceiptHash:
        source.publicationCasVerificationReceiptHash,
    },
    source: {
      pathRef: source.sourceReceipt.source.pathRef,
      normalizedLocator: source.sourceReceipt.source.normalizedLocator,
      contentHash: source.sourceReceipt.source.contentHash,
      byteLength: source.sourceReceipt.source.byteLength,
      sourceIdentityHash: source.sourceReceipt.source.sourceIdentityHash,
      mode: "0444",
      physicalIdentityHash: physical.physicalIdentityHash,
    },
    bundle: {
      envelopeHash: source.publicationReceipt.authority.sourceBundle.envelopeHash,
      envelopeByteLength:
        source.publicationReceipt.authority.sourceBundle.envelopeByteLength,
      rawHash: source.publicationReceipt.authority.sourceBundle.rawHash,
      rawByteLength:
        source.publicationReceipt.authority.sourceBundle.rawByteLength,
      deepVerificationReceiptSchema:
        DEEP_BYTE_BUNDLE_VERIFICATION_RECEIPT_V2_SCHEMA,
      deepVerificationReceiptHash: source.deepVerificationReceiptHash,
      consumerBindingHash: source.consumerBindingHash,
    },
  };
}

function assertDependencyStateForSourceV1(
  state: PrivateStageStateV2,
  sourceState: "absent" | "present",
  outputState: "absent" | "present" = "absent",
): void {
  const dependency = state.lifecycle.dependencyReceipt;
  const prior = state.lifecycle.dependencyCapture;
  if (!dependency || !prior) {
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_STATE_DRIFT",
      "Source lifecycle lost its verified dependency authority",
    );
  }
  const entry = getCodeOwnedNodeScaffoldToolchainEntryV2(state.profileId);
  if (!entry) {
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_STATE_DRIFT",
      "Source materialization profile lost its code-owned dependency entry",
    );
  }
  const baseMembership = captureScaffoldAssetsAfterInstallV2(
    state,
    sourceState,
    outputState,
  );
  const raw = captureRawDependenciesV2({ projectRoot: state.projectRoot, entry });
  const capsule = verifyCanonicalRuntimeTreeV2({
    root: state.dependencyCapsuleRoot,
    candidate: dependency.dependencyCapsule,
    metadataProbe: prior.metadataProbe,
  });
  const environment = inspectNodeScaffoldExecutionEnvironmentReceiptV2(
    state.environment,
  );
  const materializerAuthority = codeOwnedMaterializerAuthorityV2();
  if (
    baseMembership !== dependency.scaffoldBase.endBaseFileMembershipHash
    || hashCanonicalJson(raw) !== hashCanonicalJson(prior.raw)
    || capsule.payloadHash !== prior.capsule.payloadHash
    || environment.receiptHash !== dependency.environmentBinding.receiptHash
    || materializerAuthority.authorityHash
      !== dependency.materializerAuthority.authorityHash
    || prior.metadataAuthority
      !== dependency.dependencyCapsuleAuthority.metadataProbe
    || getCodeOwnedNodeScaffoldToolchainCatalogV2().catalogHash
      !== dependency.catalogBinding.catalogHash
  ) {
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_STATE_DRIFT",
      "Dependency, environment or scaffold authority changed across source materialization",
    );
  }
}

function sourceMaterializerHooksV1(
  value: unknown,
): NodeProductSourceMaterializerTestHooksV1 | undefined {
  if (value === undefined) return undefined;
  if (
    !isPlainRecord(value)
    || Reflect.ownKeys(value).some((key) => key !== "afterBoundary")
    || (
      value.afterBoundary !== undefined
      && typeof value.afterBoundary !== "function"
    )
  ) {
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_INPUT_INVALID",
      "Node product source materializer test hooks are invalid",
    );
  }
  return value as NodeProductSourceMaterializerTestHooksV1;
}

async function materializeNodeProductSourcesInternalV1(input: Readonly<{
  handle: MaterializedNodeScaffoldPrivateStageV2;
  casAuthority: DeepByteBundleCasAuthorityV2;
  compilerInput: unknown;
  candidatePublications: unknown;
  expectedScope: "production_host" | "test_fixture";
  hooks?: NodeProductSourceMaterializerTestHooksV1;
}>): Promise<NodeProductSourceMaterializationReceiptV1> {
  const state = activeStageStateV2(input.handle);
  if (state.admissionScope !== input.expectedScope) {
    return fail(
      input.expectedScope === "production_host"
        ? "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_PRODUCTION_AUTHORITY_REQUIRED"
        : "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_INPUT_INVALID",
      "Source materializer cannot promote, downgrade or cross private-stage scope",
    );
  }
  if (
    state.lifecycle.status !== "dependencies_ready"
    || !state.lifecycle.dependencyReceipt
    || !state.lifecycle.dependencyCapture
  ) {
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_SOURCE_ALREADY_CONSUMED",
      "Source materialization is single-use after one verified dependency stage",
    );
  }
  state.lifecycle.status = "source_claimed";
  const captured: CapturedPublishedSourceV1[] = [];
  let filesystemStarted = false;
  try {
    input.hooks?.afterBoundary?.("after_source_preclaim");
    // Source generators depend on this private-stage authority. Resolve the
    // higher-level fresh verifier only after this module is initialized, as the
    // execution-environment bridge does, so filesystem ownership stays here
    // without introducing an eager ESM dependency cycle.
    const sourcePublication = await import(
      "./node-product-source-publication-v1.js"
    );
    const verified = input.expectedScope === "production_host"
      ? await sourcePublication.verifyNodeProductSourcePublicationV1(
          input.handle,
          {
            compilerInput: input.compilerInput,
            candidatePublications: input.candidatePublications,
          },
        )
      : await sourcePublication.verifyNodeProductSourcePublicationV1ForTest(
          input.handle,
          {
            compilerInput: input.compilerInput,
            candidatePublications: input.candidatePublications,
          },
        );
    if (
      verified.publications.length !== 2
      || verified.publications[0]?.sourceRole !== "runtime"
      || verified.publications[1]?.sourceRole !== "test"
    ) {
      return fail(
        "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_SOURCE_AUTHORITY_INVALID",
        "Fresh source publication verifier did not return runtime then test exactly once",
      );
    }
    const reads = await Promise.allSettled(
      verified.publications.map((publication) =>
        capturePublishedSourceAuthorityV1(input.casAuthority, publication)),
    );
    for (const result of reads) {
      if (result.status === "fulfilled") captured.push(result.value);
    }
    const rejected = reads.find((result) => result.status === "rejected");
    if (rejected?.status === "rejected") throw rejected.reason;
    if (
      captured.length !== 2
      || captured[0]?.sourceRole !== "runtime"
      || captured[1]?.sourceRole !== "test"
    ) {
      return fail(
        "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_SOURCE_AUTHORITY_INVALID",
        "Authenticated CAS reads did not return both exact source roles",
      );
    }
    await revalidateNodeScaffoldDependenciesV2(input.handle);
    input.hooks?.afterBoundary?.("after_source_authority_verification");
    const sourceRoot = path.join(state.projectRoot, "src");
    filesystemStarted = true;
    assertMissingPathV2(sourceRoot, "Generated source directory");
    mkdirSync(sourceRoot, { mode: 0o700 });
    state.lifecycle.cleanupCensus = extendPrivateCleanupCensusWithCreatedMemberV2({
      privateRoot: state.privateRoot,
      current: state.lifecycle.cleanupCensus,
      absolutePath: sourceRoot,
      locator: "project/src",
    });
    input.hooks?.afterBoundary?.("after_source_directory_create");
    state.lifecycle.cleanupCensus = capturePrivateCleanupCensusV2(state.privateRoot);
    chmodSync(sourceRoot, 0o700);
    syncDirectoryV2(sourceRoot);
    syncDirectoryV2(state.projectRoot);
    state.lifecycle.cleanupCensus = capturePrivateCleanupCensusV2(
      state.privateRoot,
    );
    input.hooks?.afterBoundary?.("after_source_directory_fsync");

    const written = captured.map((source) => {
      const physical = writeExclusivePublishedSourceV1({
        state,
        source,
        onCreated: (absolutePath, locator) => {
          state.lifecycle.cleanupCensus = extendPrivateCleanupCensusWithCreatedMemberV2({
            privateRoot: state.privateRoot,
            current: state.lifecycle.cleanupCensus,
            absolutePath,
            locator: `project/${locator}`,
          });
          input.hooks?.afterBoundary?.(
            source.sourceRole === "runtime"
              ? "after_runtime_source_create"
              : "after_test_source_create",
          );
          state.lifecycle.cleanupCensus = capturePrivateCleanupCensusV2(
            state.privateRoot,
          );
        },
      });
      state.lifecycle.cleanupCensus = capturePrivateCleanupCensusV2(
        state.privateRoot,
      );
      input.hooks?.afterBoundary?.(
        source.sourceRole === "runtime"
          ? "after_runtime_source_fsync"
          : "after_test_source_fsync",
      );
      return physical;
    });
    syncDirectoryV2(sourceRoot);
    syncDirectoryV2(state.projectRoot);
    syncDirectoryV2(state.privateRoot);
    input.hooks?.afterBoundary?.("after_source_project_fsync");
    assertDependencyStateForSourceV1(state, "present");

    const entries = captured.map((source, index) =>
      materializationEntryV1(source, written[index]!));
    const capture = captureSourceMaterializationV1({
      state,
      sources: entries,
    });
    if (
      capture.sources.some((source, index) =>
        source.physicalIdentityHash !== written[index]?.physicalIdentityHash)
    ) {
      return fail(
        "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_STATE_DRIFT",
        "Generated source physical identity changed between write and fresh capture",
      );
    }
    input.hooks?.afterBoundary?.("after_source_final_capture");
    const firstPublication = captured[0]!.publicationReceipt;
    const dependency = state.lifecycle.dependencyReceipt;
    const receiptWithoutHash = {
      schema: NODE_PRODUCT_SOURCE_MATERIALIZATION_RECEIPT_V1_SCHEMA,
      receiptVersion: NODE_PRODUCT_SOURCE_MATERIALIZATION_RECEIPT_V1_VERSION,
      authorityRef: NODE_PRODUCT_SOURCE_MATERIALIZER_AUTHORITY_REF_V1,
      materializerContractHash:
        NODE_PRODUCT_SOURCE_MATERIALIZER_CONTRACT_HASH_V1,
      status: "sources_materialized_verified" as const,
      admissionScope: state.admissionScope,
      productionUse:
        "forbidden_until_build_test_evidence_registry_and_release_manifest" as const,
      readiness: {
        blockerCodes: [...NODE_PRODUCT_SOURCE_MATERIALIZATION_BLOCKER_CODES_V1] as [
          typeof NODE_PRODUCT_SOURCE_MATERIALIZATION_BLOCKER_CODES_V1[0],
          typeof NODE_PRODUCT_SOURCE_MATERIALIZATION_BLOCKER_CODES_V1[1],
          typeof NODE_PRODUCT_SOURCE_MATERIALIZATION_BLOCKER_CODES_V1[2],
          typeof NODE_PRODUCT_SOURCE_MATERIALIZATION_BLOCKER_CODES_V1[3],
        ],
      },
      profileId: state.profileId,
      privateAttempt: {
        rootIdentityHash: state.receipt.privateAttempt.rootIdentityHash,
        sourceDirectoryMode: "0700" as const,
        sourceFileMode: "0444" as const,
        pathDisclosure: "forbidden" as const,
        failureCleanup: "authenticated_owned_attempt_only_v1" as const,
      },
      scaffold: {
        baseReceiptSchema: state.receipt.schema,
        baseReceiptHash: state.receipt.receiptHash,
        dependencyReceiptSchema: dependency.schema,
        dependencyReceiptHash: dependency.receiptHash,
        dependencyIdentityHash: dependency.dependencyIdentityHash,
      },
      publication: {
        receiptSetSchema: firstPublication.receiptSet.schema,
        receiptSetCommitmentHash:
          firstPublication.receiptSet.commitmentHash,
        publicationReceiptCount: 2 as const,
        verificationDisposition:
          "fresh-reproduced-every-and-only-runtime-test-pair" as const,
      },
      buildTopology: {
        fileTreeManifestHash:
          firstPublication.authority.fileTreeManifestHash,
        logicalBuildHash:
          firstPublication.authority.buildTopology.logicalBuildHash,
        manifestHash: firstPublication.authority.buildTopology.manifestHash,
      },
      sourceDirectory: {
        memberCount: 2 as const,
        memberNames: [...sourceMemberNamesV1(state.profileId)],
        membershipHash: capture.membershipHash,
        physicalIdentityHash: capture.directoryPhysicalIdentityHash,
      },
      sourceCount: 2 as const,
      sources: entries,
    };
    const receipt = NodeProductSourceMaterializationReceiptV1Schema.parse({
      ...receiptWithoutHash,
      receiptHash:
        hashNodeProductSourceMaterializationReceiptV1(receiptWithoutHash),
    });
    state.lifecycle.sourceReceipt = receipt;
    state.lifecycle.sourceCapture = capture;
    state.lifecycle.sourceAuthority = Object.freeze({
      casAuthority: input.casAuthority,
      sources: Object.freeze(verified.publications.map((publication) =>
        Object.freeze({
          sourceRole: publication.sourceRole,
          receipt: publication.receipt,
          receiptEnvelope: publication.receiptEnvelope,
          receiptArtifactHash: publication.receiptArtifactHash,
          receiptArtifactByteLength: publication.receiptArtifactByteLength,
          sourceReceipt: publication.sourceReceipt,
          sourceReceiptEnvelope: publication.sourceReceiptEnvelope,
          sourceReceiptArtifactHash: publication.sourceReceiptArtifactHash,
          sourceReceiptArtifactByteLength:
            publication.sourceReceiptArtifactByteLength,
        }))),
    });
    state.lifecycle.cleanupCensus = capturePrivateCleanupCensusV2(state.privateRoot);
    state.lifecycle.status = "sources_ready";
    return defensiveCopy(receipt);
  } catch (error) {
    let cleanupError: unknown;
    try {
      destroyNodeScaffoldPrivateStageV2(input.handle);
    } catch (candidate) {
      cleanupError = candidate;
    }
    if (cleanupError !== undefined) {
      return fail(
        "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_STATE_DRIFT",
        "Failed source attempt could not clean only its authenticated private root",
        new AggregateError(
          [error, cleanupError],
          `Source failure retained authenticated private root ${state.privateRoot}`,
        ),
      );
    }
    if (error instanceof NodeScaffoldPrivateMaterializerErrorV2) throw error;
    return fail(
      filesystemStarted
        ? "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_SOURCE_MATERIALIZATION_FAILED"
        : "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_SOURCE_AUTHORITY_INVALID",
      filesystemStarted
        ? "Private source filesystem materialization failed and its authenticated attempt was removed"
        : "Authenticated source publication was rejected and its private attempt was removed",
      error,
    );
  } finally {
    for (const source of captured) source.bytes.fill(0);
  }
}

export async function materializeNodeProductSourcesV1(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
): Promise<NodeProductSourceMaterializationReceiptV1> {
  const values = exactDataRecord(input, [
    "candidatePublications",
    "casAuthority",
    "compilerInput",
  ]);
  return materializeNodeProductSourcesInternalV1({
    handle,
    casAuthority: values.casAuthority as DeepByteBundleCasAuthorityV2,
    compilerInput: values.compilerInput,
    candidatePublications: values.candidatePublications,
    expectedScope: "production_host",
  });
}

export type MaterializeNodeProductSourcesV1ForTestInput = Readonly<{
  casAuthority: DeepByteBundleCasAuthorityV2;
  compilerInput: unknown;
  candidatePublications: unknown;
  testHooks?: NodeProductSourceMaterializerTestHooksV1;
}>;

export async function materializeNodeProductSourcesV1ForTest(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: MaterializeNodeProductSourcesV1ForTestInput,
): Promise<NodeProductSourceMaterializationReceiptV1> {
  const expectedKeys = isPlainRecord(input)
    && Object.prototype.hasOwnProperty.call(input, "testHooks")
    ? ["candidatePublications", "casAuthority", "compilerInput", "testHooks"]
    : ["candidatePublications", "casAuthority", "compilerInput"];
  const values = exactDataRecord(input, expectedKeys);
  return materializeNodeProductSourcesInternalV1({
    handle,
    casAuthority: values.casAuthority as DeepByteBundleCasAuthorityV2,
    compilerInput: values.compilerInput,
    candidatePublications: values.candidatePublications,
    expectedScope: "test_fixture",
    ...(values.testHooks === undefined
      ? {}
      : { hooks: sourceMaterializerHooksV1(values.testHooks) }),
  });
}

export function inspectNodeProductSourceMaterializationReceiptV1(
  handle: MaterializedNodeScaffoldPrivateStageV2,
): NodeProductSourceMaterializationReceiptV1 {
  const state = activeStageStateV2(handle);
  if (
    ![
      "sources_ready",
      "build_process_consumed",
      "build_ready",
      "runtime_bundle_claimed",
      "runtime_bundle_consumed",
    ]
      .includes(state.lifecycle.status)
    || !state.lifecycle.sourceReceipt
    || !state.lifecycle.sourceCapture
    || !state.lifecycle.sourceAuthority
  ) {
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_SOURCE_ALREADY_CONSUMED",
      "Verified source materialization is not available for this stage",
    );
  }
  return defensiveCopy(state.lifecycle.sourceReceipt);
}

export async function revalidateNodeProductSourcesV1(
  handle: MaterializedNodeScaffoldPrivateStageV2,
): Promise<NodeProductSourceMaterializationReceiptV1> {
  const state = activeStageStateV2(handle);
  const receipt = state.lifecycle.sourceReceipt;
  const priorCapture = state.lifecycle.sourceCapture;
  const sourceAuthority = state.lifecycle.sourceAuthority;
  const dependency = state.lifecycle.dependencyReceipt;
  const dependencyCapture = state.lifecycle.dependencyCapture;
  const outputState = [
    "build_process_consumed",
    "build_ready",
    "runtime_bundle_claimed",
    "runtime_bundle_consumed",
  ]
    .includes(state.lifecycle.status) ? "present" as const : "absent" as const;
  if (
    ![
      "sources_ready",
      "build_process_consumed",
      "build_ready",
      "runtime_bundle_claimed",
      "runtime_bundle_consumed",
    ]
      .includes(state.lifecycle.status)
    || !receipt
    || !priorCapture
    || !sourceAuthority
    || !dependency
    || !dependencyCapture
  ) {
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_SOURCE_ALREADY_CONSUMED",
      "Source revalidation requires one completed verified materialization",
    );
  }
  const recaptured: CapturedPublishedSourceV1[] = [];
  try {
    assertDependencyStateForSourceV1(state, "present", outputState);
    const reads = await Promise.allSettled(sourceAuthority.sources.map((source) =>
      capturePublishedSourceAuthorityV1(sourceAuthority.casAuthority, source)));
    for (const result of reads) {
      if (result.status === "fulfilled") recaptured.push(result.value);
    }
    const rejected = reads.find((result) => result.status === "rejected");
    if (rejected?.status === "rejected") throw rejected.reason;
    if (recaptured.length !== 2) {
      return fail(
        "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_STATE_DRIFT",
        "Published source CAS authority could not be completely replayed",
      );
    }
    const freshCapture = captureSourceMaterializationV1({
      state,
      sources: receipt.sources,
      outputState,
    });
    if (
      freshCapture.directoryPhysicalIdentityHash
        !== priorCapture.directoryPhysicalIdentityHash
      || freshCapture.membershipHash !== priorCapture.membershipHash
      || receipt.sourceDirectory.physicalIdentityHash
        !== freshCapture.directoryPhysicalIdentityHash
      || receipt.sourceDirectory.membershipHash !== freshCapture.membershipHash
      || recaptured.some((source, index) => {
        const expected = receipt.sources[index];
        return !expected
          || source.sourceRole !== expected.sourceRole
          || source.publicationReceipt.receiptHash
            !== expected.publicationReceipt.receiptHash
          || source.publicationCasVerificationReceiptHash
            !== expected.publicationReceipt.casVerificationReceiptHash
          || source.sourceReceipt.receiptHash
            !== expected.sourceReceipt.receiptHash
          || source.sourceReceiptCasVerificationReceiptHash
            !== expected.sourceReceipt.casVerificationReceiptHash
          || source.deepVerificationReceiptHash
            !== expected.bundle.deepVerificationReceiptHash
          || source.consumerBindingHash !== expected.bundle.consumerBindingHash;
      })
      || NodeProductSourceMaterializationReceiptV1Schema.parse(receipt)
        .receiptHash !== receipt.receiptHash
    ) {
      return fail(
        "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_STATE_DRIFT",
        "Source materialization no longer reproduces its issued physical and CAS identity",
      );
    }
    return defensiveCopy(receipt);
  } catch (error) {
    if (
      error instanceof NodeScaffoldPrivateMaterializerErrorV2
      && error.code === "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_STATE_DRIFT"
    ) throw error;
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_STATE_DRIFT",
      "Source materialization could not be freshly reproduced",
      error,
    );
  } finally {
    for (const source of recaptured) source.bytes.fill(0);
  }
}

export type NodeScaffoldPrivateBuildScopeInternalV2 = Readonly<{
  admissionScope: "production_host" | "test_fixture";
  profileId: NodeScaffoldProfileIdV2;
  projectRoot: string;
  scaffoldBaseReceiptHash: string;
  sourceMaterializationReceiptHash: string;
  dependencyReceiptHash: string;
  dependencyIdentityHash: string;
  compilerTarget: HostNodeToolchainBuildCompilerTargetV2;
}>;

/** @internal Authenticated bridge used only by the execution-environment boundary. */
export async function acquireNodeScaffoldPrivateBuildScopeInternalV2(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  expectedEnvironmentReceiptHash: string,
): Promise<NodeScaffoldPrivateBuildScopeInternalV2> {
  const state = activeStageStateV2(handle);
  if (state.lifecycle.status !== "sources_ready") {
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_BUILD_ALREADY_CONSUMED",
      "Private candidate build requires one source-ready single-use stage",
    );
  }
  if (state.receipt.environmentBinding.receiptHash !== expectedEnvironmentReceiptHash) {
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_ENVIRONMENT_INVALID",
      "Private candidate build and execution environment receipts do not join",
    );
  }
  const [source, dependency, environment] = await Promise.all([
    revalidateNodeProductSourcesV1(handle),
    revalidateNodeScaffoldDependenciesV2(handle),
    revalidateNodeScaffoldExecutionEnvironmentV2(state.environment),
  ]);
  if (
    state.lifecycle.status !== "sources_ready"
    || environment.receiptHash !== expectedEnvironmentReceiptHash
    || dependency.receiptHash !== source.scaffold.dependencyReceiptHash
    || dependency.dependencyIdentityHash !== source.scaffold.dependencyIdentityHash
  ) {
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_STATE_DRIFT",
      "Candidate source, dependency and environment authority changed before build claim",
    );
  }
  const compilers = dependency.installedBins.entries.filter((entry) =>
    entry.commandName === "tsc"
    && entry.packagePath === "node_modules/typescript"
    && entry.linkLocator === "node_modules/.bin/tsc"
    && entry.targetLocator === "node_modules/typescript/bin/tsc");
  if (compilers.length !== 1) {
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_STATE_DRIFT",
      "Candidate build dependency authority lacks one exact TypeScript compiler target",
    );
  }
  const compiler = compilers[0]!;
  const compilerTarget: HostNodeToolchainBuildCompilerTargetV2 = Object.freeze({
    executableRef: "TOOL_NODE_TYPESCRIPT_TSC_V2",
    exactVersion: "5.9.3",
    commandName: "tsc",
    packagePath: "node_modules/typescript",
    linkLocator: "node_modules/.bin/tsc",
    targetLocator: "node_modules/typescript/bin/tsc",
    linkTargetHash: compiler.linkTargetHash,
    targetContentHash: compiler.targetContentHash,
    executionDisposition: "direct_target_via_authenticated_node_runtime",
  });
  state.lifecycle.status = "build_claimed";
  state.lifecycle.status = "building";
  return Object.freeze({
    admissionScope: state.admissionScope,
    profileId: state.profileId,
    projectRoot: state.projectRoot,
    scaffoldBaseReceiptHash: state.receipt.receiptHash,
    sourceMaterializationReceiptHash: source.receiptHash,
    dependencyReceiptHash: dependency.receiptHash,
    dependencyIdentityHash: dependency.dependencyIdentityHash,
    compilerTarget,
  });
}

/** @internal Consumes the one-shot candidate-build stage lease on every process outcome. */
export function settleNodeScaffoldPrivateBuildScopeInternalV2(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  scaffoldBaseReceiptHash: string,
): void {
  const state = activeStageStateV2(handle);
  if (
    state.lifecycle.status !== "building"
    || state.receipt.receiptHash !== scaffoldBaseReceiptHash
  ) {
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_STATE_DRIFT",
      "Private candidate-build lease cannot be settled from this state",
    );
  }
  const captureErrors: unknown[] = [];
  try {
    state.lifecycle.cleanupCensus = capturePrivateCleanupCensusV2(state.privateRoot);
  } catch (error) {
    captureErrors.push(error);
  }
  state.lifecycle.status = "build_process_consumed";
  if (captureErrors.length > 0) {
    const [error] = captureErrors;
    if (error instanceof NodeScaffoldPrivateMaterializerErrorV2) throw error;
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_STATE_DRIFT",
      "Private candidate-build lease was consumed without a fresh exact cleanup census",
      error,
    );
  }
}

/** @internal Runs the only build operation through the stage-owned environment. */
export function executeNodeCandidateBuildProcessInternalV2(
  handle: MaterializedNodeScaffoldPrivateStageV2,
) {
  const state = activeStageStateV2(handle);
  return executeNodeScaffoldEnvironmentBuildV2(state.environment, handle);
}

/** @internal Removes both authenticated private roots after a failed build attempt. */
export function destroyNodeCandidateBuildAttemptInternalV2(
  handle: MaterializedNodeScaffoldPrivateStageV2,
): void {
  const state = authenticStageStateV2(handle);
  let stageError: unknown;
  let environmentError: unknown;
  try {
    destroyNodeScaffoldPrivateStageV2(handle);
  } catch (error) {
    stageError = error;
  }
  try {
    destroyNodeScaffoldExecutionEnvironmentV2(state.environment);
  } catch (error) {
    environmentError = error;
  }
  if (stageError !== undefined || environmentError !== undefined) {
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_STATE_DRIFT",
      "Candidate build failure cleanup could not remove both authenticated private roots",
      { stageError, environmentError },
    );
  }
}

function candidateBuildOutputNamesV2(
  profileId: NodeScaffoldProfileIdV2,
): readonly [string, string] {
  return profileId === "PROFILE_NODE_CLI_STATELESS_EXACT_V2"
    ? Object.freeze(["cli.js", "cli.setfarm.test.js"] as const)
    : Object.freeze(["app.js", "app.setfarm.test.js"] as const);
}

function captureCandidateBuildOutputFilesV2(input: Readonly<{
  state: PrivateStageStateV2;
  sealed: boolean;
}>): readonly [NodeCandidateBuildOutputFileV2, NodeCandidateBuildOutputFileV2] {
  const root = path.join(input.state.projectRoot, "dist");
  const owner = processOwnerV2();
  try {
    const rootStat = lstatSync(root);
    const expectedNames = candidateBuildOutputNamesV2(input.state.profileId);
    const names = readBoundedDirectoryNamesV2({
      absolutePath: root,
      label: "Candidate build output root",
      maxNames: expectedNames.length,
      errorCode: "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_BUILD_OUTPUT_INVALID",
    });
    const rootMode = modeBits(rootStat);
    if (
      rootStat.isSymbolicLink()
      || !rootStat.isDirectory()
      || realpathSync(root) !== root
      || rootStat.uid !== owner.uid
      || rootStat.gid !== owner.gid
      || (input.sealed
        ? rootMode !== 0o555
        : ![0o700, 0o755].includes(rootMode))
      || !sameStringsV2(names, [...expectedNames])
    ) {
      return fail(
        "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_BUILD_OUTPUT_INVALID",
        "Candidate build output root is not the exact profile-owned dist topology",
      );
    }
    const files = names.map((name) => {
      const absolutePath = path.join(root, name);
      let descriptor: number | undefined;
      return runWithIndependentFinalizersV2({
        operation: () => {
          descriptor = openSync(
            absolutePath,
            constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
          );
          const before = fstatSync(descriptor);
          if (before.size <= 0 || before.size > 32 * 1024 * 1024) {
            return fail(
              "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_BUILD_OUTPUT_INVALID",
              `Candidate build output ${name} has an invalid byte length`,
            );
          }
          const bytes = readExactDescriptorBytesV2({
            descriptor,
            admittedByteLength: before.size,
            label: `Candidate build output ${name}`,
            errorCode: "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_BUILD_OUTPUT_INVALID",
          });
          const after = fstatSync(descriptor);
          const pathAfter = lstatSync(absolutePath);
          const mode = modeBits(after);
          const fileFingerprint = fingerprint(after);
          if (
            !before.isFile()
            || before.isSymbolicLink()
            || before.nlink !== 1
            || before.uid !== owner.uid
            || before.gid !== owner.gid
            || (input.sealed
              ? mode !== 0o444
              : ![0o600, 0o640, 0o644].includes(mode))
            || !sameFingerprint(fingerprint(before), fileFingerprint)
            || !sameFingerprint(fileFingerprint, fingerprint(pathAfter))
          ) {
            return fail(
              "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_BUILD_OUTPUT_INVALID",
              `Candidate build output ${name} is not one stable process-owned regular file`,
            );
          }
          const normalizedLocator = `dist/${name}` as
            NodeCandidateBuildOutputFileV2["normalizedLocator"];
          const contentHash = sha256(bytes);
          return Object.freeze({
            normalizedLocator,
            mode: "0444" as const,
            executable: false as const,
            contentHash,
            byteLength: bytes.byteLength,
            physicalIdentityHash: hashCanonicalJson({
              schema: "setfarm.node-candidate-build-output-physical-file.v2",
              normalizedLocator,
              fingerprint: fileFingerprint,
              contentHash,
            }),
          });
        },
        finalizers: [() => {
          if (descriptor !== undefined) closeSync(descriptor);
        }],
        onFinalizerFailure: (errors) => fail(
          "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_BUILD_OUTPUT_INVALID",
          `Candidate build output ${name} read or descriptor close failed`,
          new AggregateError(errors, "Build output read and descriptor finalization failures"),
        ),
      });
    });
    return Object.freeze(files) as readonly [
      NodeCandidateBuildOutputFileV2,
      NodeCandidateBuildOutputFileV2,
    ];
  } catch (error) {
    if (error instanceof NodeScaffoldPrivateMaterializerErrorV2) throw error;
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_BUILD_OUTPUT_INVALID",
      "Candidate build output could not be captured",
      error,
    );
  }
}

function candidateBuildOutputMembershipHashV2(
  files: readonly NodeCandidateBuildOutputFileV2[],
): string {
  return hashCanonicalJson({
    schema: "setfarm.node-candidate-build-output-membership.v2",
    files: files.map((file) => ({
      normalizedLocator: file.normalizedLocator,
      contentHash: file.contentHash,
      byteLength: file.byteLength,
    })),
  });
}

async function finalizeNodeCandidateBuildOutputInternalV2(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  expectedScope: "production_host" | "test_fixture",
): Promise<NodeCandidateBuildOutputV2> {
  const state = activeStageStateV2(handle);
  if (
    state.admissionScope !== expectedScope
    || state.lifecycle.status !== "build_process_consumed"
    || !state.lifecycle.sourceReceipt
    || !state.lifecycle.dependencyReceipt
  ) {
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_BUILD_ALREADY_CONSUMED",
      "Candidate build output finalization requires one matching consumed build process",
    );
  }
  await revalidateNodeProductSourcesV1(handle);
  const raw = captureCandidateBuildOutputFilesV2({ state, sealed: false });
  const outputRoot = path.join(state.projectRoot, "dist");
  const metadataProbe = expectedScope === "production_host"
    ? codeOwnedDarwinMetadataProbeV2
    : clearTestMetadataProbeV2;
  if (expectedScope === "production_host") {
    normalizeCodeOwnedDarwinMetadataV2(
      outputRoot,
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_BUILD_OUTPUT_INVALID",
    );
  }
  for (const name of candidateBuildOutputNamesV2(state.profileId)) {
    chmodSync(path.join(outputRoot, name), 0o444);
  }
  chmodSync(outputRoot, 0o555);
  syncNormalizedTreeV2(
    outputRoot,
    "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_BUILD_OUTPUT_INVALID",
  );
  const sealed = captureCandidateBuildOutputFilesV2({ state, sealed: true });
  if (raw.some((file, index) =>
    file.normalizedLocator !== sealed[index]?.normalizedLocator
    || file.contentHash !== sealed[index]?.contentHash
    || file.byteLength !== sealed[index]?.byteLength)) {
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_BUILD_OUTPUT_INVALID",
      "Candidate build output bytes changed during normalization",
    );
  }
  const tree = expectedScope === "production_host"
    ? captureCanonicalRuntimeTreeV2({
        root: outputRoot,
        profile: "dist",
        metadataProbe,
      })
    : captureCanonicalRuntimeTreeV2ForTest({
        root: outputRoot,
        profile: "dist",
        metadataProbe,
      });
  const treeFiles = tree.entries.filter((entry) => entry.type === "file");
  if (
    tree.fileCount !== 2
    || tree.directoryCount !== 0
    || treeFiles.length !== 2
    || treeFiles.some((entry, index) => {
      const expected = sealed[index];
      return !expected
        || `dist/${entry.path}` !== expected.normalizedLocator
        || entry.mode !== "0444"
        || entry.executable !== false
        || entry.contentHash !== expected.contentHash
        || entry.byteLength !== expected.byteLength;
    })
  ) {
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_BUILD_OUTPUT_INVALID",
      "Canonical runtime tree does not equal every-and-only profile build output",
    );
  }
  const dependency = state.lifecycle.dependencyReceipt;
  const source = state.lifecycle.sourceReceipt;
  const value: NodeCandidateBuildOutputV2 = deepFreezeJson({
    admissionScope: state.admissionScope,
    profileId: state.profileId,
    pathDisclosure: "forbidden" as const,
    sourceMaterializationReceiptHash: source.receiptHash,
    dependencyReceiptHash: dependency.receiptHash,
    dependencyIdentityHash: dependency.dependencyIdentityHash,
    memberCount: 2 as const,
    files: sealed,
    membershipHash: candidateBuildOutputMembershipHashV2(sealed),
    tree,
  });
  state.lifecycle.buildOutput = Object.freeze({ value, metadataProbe });
  state.lifecycle.cleanupCensus = capturePrivateCleanupCensusV2(state.privateRoot);
  state.lifecycle.status = "build_ready";
  return defensiveCopy(value);
}

export function finalizeNodeCandidateBuildOutputV2(
  handle: MaterializedNodeScaffoldPrivateStageV2,
): Promise<NodeCandidateBuildOutputV2> {
  if (!isProductionNodeScaffoldPrivateStageV2(handle)) {
    return Promise.reject(new NodeScaffoldPrivateMaterializerErrorV2(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_PRODUCTION_AUTHORITY_REQUIRED",
      "Production candidate build output requires a production private stage",
    ));
  }
  return finalizeNodeCandidateBuildOutputInternalV2(handle, "production_host");
}

export function finalizeNodeCandidateBuildOutputV2ForTest(
  handle: MaterializedNodeScaffoldPrivateStageV2,
): Promise<NodeCandidateBuildOutputV2> {
  if (isProductionNodeScaffoldPrivateStageV2(handle)) {
    return Promise.reject(new NodeScaffoldPrivateMaterializerErrorV2(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_INPUT_INVALID",
      "Test candidate build output cannot consume production authority",
    ));
  }
  return finalizeNodeCandidateBuildOutputInternalV2(handle, "test_fixture");
}

export async function revalidateNodeCandidateBuildOutputV2(
  handle: MaterializedNodeScaffoldPrivateStageV2,
): Promise<NodeCandidateBuildOutputV2> {
  const state = activeStageStateV2(handle);
  const capture = state.lifecycle.buildOutput;
  if (
    ![
      "build_ready",
      "runtime_bundle_claimed",
      "runtime_bundle_consumed",
    ]
      .includes(state.lifecycle.status)
    || !capture
  ) {
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_BUILD_ALREADY_CONSUMED",
      "Candidate build output revalidation requires one completed build authority",
    );
  }
  await revalidateNodeProductSourcesV1(handle);
  const files = captureCandidateBuildOutputFilesV2({ state, sealed: true });
  let tree: CanonicalRuntimeTreeV2;
  try {
    tree = verifyCanonicalRuntimeTreeV2({
      root: path.join(state.projectRoot, "dist"),
      candidate: capture.value.tree,
      metadataProbe: capture.metadataProbe,
    });
  } catch (error) {
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_BUILD_OUTPUT_INVALID",
      "Candidate build output canonical tree could not be freshly reproduced",
      error,
    );
  }
  if (
    candidateBuildOutputMembershipHashV2(files) !== capture.value.membershipHash
    || tree.treeHash !== capture.value.tree.treeHash
    || tree.payloadHash !== capture.value.tree.payloadHash
  ) {
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_BUILD_OUTPUT_INVALID",
      "Candidate build output no longer reproduces its exact physical authority",
    );
  }
  return defensiveCopy(capture.value);
}

export type NodeCandidateRuntimeBundleExpectedAuthorityInternalV2 = Readonly<{
  admissionScope: "production_host" | "test_fixture";
  profileId: NodeScaffoldProfileIdV2;
  sourceMaterializationReceiptHash: string;
  dependencyReceiptHash: string;
  dependencyIdentityHash: string;
  outputMembershipHash: string;
  outputTreeHash: string;
  outputTreePayloadHash: string;
}>;

export type NodeCandidateRuntimeBundleInputFileInternalV2 = Readonly<{
  logicalLocator: string;
  contentHash: string;
  byteLength: number;
  bytes: Buffer;
}>;

export type NodeCandidateRuntimeBundleInputsInternalV2 = Readonly<{
  admissionScope: "production_host" | "test_fixture";
  profileId: NodeScaffoldProfileIdV2;
  scaffoldBaseReceiptHash: string;
  sourceMaterializationReceiptHash: string;
  dependencyReceiptHash: string;
  dependencyIdentityHash: string;
  packageJson: NodeCandidateRuntimeBundleInputFileInternalV2;
  packageLock: NodeCandidateRuntimeBundleInputFileInternalV2;
  application: readonly [
    NodeCandidateRuntimeBundleInputFileInternalV2,
    NodeCandidateRuntimeBundleInputFileInternalV2,
  ];
  runtimeEnvironment: NodeScaffoldExecutionEnvironmentV2;
}>;

function copyNodeCandidateRuntimeInputFileInternalV2(input: Readonly<{
  absolutePath: string;
  logicalLocator: string;
  expectedHash: string;
  expectedByteLength: number;
  maxBytes: number;
}>): NodeCandidateRuntimeBundleInputFileInternalV2 {
  let descriptor: number | undefined;
  try {
    return runWithIndependentFinalizersV2({
      operation: () => {
        descriptor = openSync(
          input.absolutePath,
          constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
        );
        const before = fstatSync(descriptor);
        if (
          input.expectedByteLength < 1
          || input.expectedByteLength > input.maxBytes
          || before.size !== input.expectedByteLength
        ) {
          return fail(
            "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_RUNTIME_BUNDLE_INPUT_INVALID",
            `Runtime-bundle input ${input.logicalLocator} differs from its admitted byte length`,
          );
        }
        const bytes = readExactDescriptorBytesV2({
          descriptor,
          admittedByteLength: input.expectedByteLength,
          label: `Runtime-bundle input ${input.logicalLocator}`,
          errorCode: "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_RUNTIME_BUNDLE_INPUT_INVALID",
        });
        const after = fstatSync(descriptor);
        const pathAfter = lstatSync(input.absolutePath);
        const owner = processOwnerV2();
        if (
          !before.isFile()
          || before.isSymbolicLink()
          || before.nlink !== 1
          || modeBits(before) !== 0o444
          || before.uid !== owner.uid
          || before.gid !== owner.gid
          || !sameFingerprint(fingerprint(before), fingerprint(after))
          || !sameFingerprint(fingerprint(after), fingerprint(pathAfter))
          || sha256(bytes) !== input.expectedHash
        ) {
          bytes.fill(0);
          return fail(
            "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_RUNTIME_BUNDLE_INPUT_INVALID",
            `Runtime-bundle input ${input.logicalLocator} changed or differs from build authority`,
          );
        }
        return Object.freeze({
          logicalLocator: input.logicalLocator,
          contentHash: input.expectedHash,
          byteLength: input.expectedByteLength,
          bytes,
        });
      },
      finalizers: [() => {
        if (descriptor !== undefined) closeSync(descriptor);
      }],
      onFinalizerFailure: (errors) => fail(
        "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_RUNTIME_BUNDLE_INPUT_INVALID",
        `Runtime-bundle input ${input.logicalLocator} read or descriptor close failed`,
        new AggregateError(errors, "Runtime input read and descriptor finalization failures"),
      ),
    });
  } catch (error) {
    if (error instanceof NodeScaffoldPrivateMaterializerErrorV2) throw error;
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_RUNTIME_BUNDLE_INPUT_INVALID",
      `Runtime-bundle input ${input.logicalLocator} could not be copied exactly`,
      error,
    );
  }
}

/** @internal Preclaims and copies every pathless runtime input from one sealed build. */
export async function acquireNodeCandidateRuntimeBundleInputsInternalV2(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  expected: NodeCandidateRuntimeBundleExpectedAuthorityInternalV2,
): Promise<NodeCandidateRuntimeBundleInputsInternalV2> {
  const state = activeStageStateV2(handle);
  if (state.lifecycle.status !== "build_ready") {
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_RUNTIME_BUNDLE_ALREADY_CONSUMED",
      "Candidate runtime-bundle input authority is single-use",
    );
  }
  if (
    !isPlainRecord(expected)
    || Reflect.ownKeys(expected).length !== 8
    || state.admissionScope !== expected.admissionScope
    || state.profileId !== expected.profileId
  ) {
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_RUNTIME_BUNDLE_INPUT_INVALID",
      "Candidate runtime-bundle expected authority is malformed or cross-scoped",
    );
  }
  state.lifecycle.status = "runtime_bundle_claimed";
  const copied: Buffer[] = [];
  try {
    const [source, dependency, output] = await Promise.all([
      revalidateNodeProductSourcesV1(handle),
      revalidateNodeScaffoldDependenciesV2(handle),
      revalidateNodeCandidateBuildOutputV2(handle),
    ]);
    if (
      source.receiptHash !== expected.sourceMaterializationReceiptHash
      || dependency.receiptHash !== expected.dependencyReceiptHash
      || dependency.dependencyIdentityHash !== expected.dependencyIdentityHash
      || output.sourceMaterializationReceiptHash !== source.receiptHash
      || output.dependencyReceiptHash !== dependency.receiptHash
      || output.dependencyIdentityHash !== dependency.dependencyIdentityHash
      || output.membershipHash !== expected.outputMembershipHash
      || output.tree.treeHash !== expected.outputTreeHash
      || output.tree.payloadHash !== expected.outputTreePayloadHash
    ) {
      return fail(
        "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_RUNTIME_BUNDLE_INPUT_INVALID",
        "Candidate source, dependency and sealed build output do not join runtime-bundle authority",
      );
    }
    const assetByLocator = new Map(state.receipt.assets.map((asset) => [
      asset.normalizedLocator,
      asset,
    ]));
    const packageJsonAsset = assetByLocator.get("package.json");
    const packageLockAsset = assetByLocator.get("package-lock.json");
    if (!packageJsonAsset || !packageLockAsset) {
      return fail(
        "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_RUNTIME_BUNDLE_INPUT_INVALID",
        "Scaffold authority lacks the exact package manifest or dependency lock",
      );
    }
    const packageJson = copyNodeCandidateRuntimeInputFileInternalV2({
      absolutePath: path.join(state.projectRoot, "package.json"),
      logicalLocator: "package.json",
      expectedHash: packageJsonAsset.rawHash,
      expectedByteLength: packageJsonAsset.rawByteLength,
      maxBytes: 4 * 1024 * 1024,
    });
    copied.push(packageJson.bytes);
    const packageLock = copyNodeCandidateRuntimeInputFileInternalV2({
      absolutePath: path.join(state.projectRoot, "package-lock.json"),
      logicalLocator: "package-lock.json",
      expectedHash: packageLockAsset.rawHash,
      expectedByteLength: packageLockAsset.rawByteLength,
      maxBytes: 16 * 1024 * 1024,
    });
    copied.push(packageLock.bytes);
    const application = output.files.map((file) => {
      const name = path.basename(file.normalizedLocator);
      const copiedFile = copyNodeCandidateRuntimeInputFileInternalV2({
        absolutePath: path.join(state.projectRoot, "dist", name),
        logicalLocator: `application/${name}`,
        expectedHash: file.contentHash,
        expectedByteLength: file.byteLength,
        maxBytes: 32 * 1024 * 1024,
      });
      copied.push(copiedFile.bytes);
      return copiedFile;
    }) as unknown as readonly [
      NodeCandidateRuntimeBundleInputFileInternalV2,
      NodeCandidateRuntimeBundleInputFileInternalV2,
    ];
    const runtimeEnvironment =
      await createNodeCandidateRuntimeExecutionEnvironmentInternalV2(
        state.environment,
      );
    return Object.freeze({
      admissionScope: state.admissionScope,
      profileId: state.profileId,
      scaffoldBaseReceiptHash: state.receipt.receiptHash,
      sourceMaterializationReceiptHash: source.receiptHash,
      dependencyReceiptHash: dependency.receiptHash,
      dependencyIdentityHash: dependency.dependencyIdentityHash,
      packageJson,
      packageLock,
      application: Object.freeze(application),
      runtimeEnvironment,
    });
  } catch (error) {
    for (const bytes of copied) bytes.fill(0);
    throw error;
  }
}

/** @internal Consumes the claimed physical runtime-input lease. */
export function settleNodeCandidateRuntimeBundleInputsInternalV2(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  expectedScaffoldBaseReceiptHash: string,
): void {
  const state = activeStageStateV2(handle);
  if (
    state.lifecycle.status !== "runtime_bundle_claimed"
    || state.receipt.receiptHash !== expectedScaffoldBaseReceiptHash
  ) {
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_RUNTIME_BUNDLE_ALREADY_CONSUMED",
      "Candidate runtime-bundle input lease cannot be settled from this state",
    );
  }
  state.lifecycle.status = "runtime_bundle_consumed";
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
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_STATE_DRIFT",
      "Private scaffold root identity could not be captured exactly before destruction",
      error,
    );
  }
  if (!matchesExactStableFilesystemObjectV2({
    stat,
    expected,
    objectKind: "directory",
  })) {
    return fail(
      "NODE_SCAFFOLD_PRIVATE_MATERIALIZER_V2_STATE_DRIFT",
      "Refusing to destroy a private scaffold root with changed exact identity",
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
    assertExactPrivateRootStableIdentityV2(
      state.privateRoot,
      state.baseCapture.rootFingerprint,
    );
    destroyPrivateCleanupCensusV2(
      state.privateRoot,
      state.lifecycle.cleanupCensus,
      state.cleanupTestHooks,
    );
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
