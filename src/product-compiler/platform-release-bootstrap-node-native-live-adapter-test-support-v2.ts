import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readSync,
  type BigIntStats,
} from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { Duplex } from "node:stream";
import { types as nodeUtilTypes } from "node:util";

import {
  PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2,
} from "../execution/schemas/platform-release-bootstrap-contract-v2.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2,
} from "../execution/schemas/platform-release-bootstrap-operation-abis-v2.js";
import {
  PLATFORM_RELEASE_COMPONENT_VERSION_V2,
  deepFreezePlatformReleaseJsonV2,
} from "../execution/schemas/platform-release-common-v2.js";
import { canonicalJsonStringify, hashCanonicalJson } from "./canonical-json.js";
import {
  buildNodeLiveObservationSessionCloseFrameV2,
  joinNodeLiveObservationSessionToSemanticSnapshotV2,
  parseNodeLiveObservationSessionCandidateV2,
  verifyNodeLiveObservationSemanticJoinReceiptV2,
  type PlatformReleaseBootstrapNodeLiveObservationSemanticJoinReceiptV2,
  type PlatformReleaseBootstrapNodeLiveObservationSessionV2,
} from "./platform-release-bootstrap-node-live-observation-session-contract-v2.js";
import {
  buildPlatformReleaseBootstrapNodeNativeExactReleaseProbeFixtureV2,
} from "./platform-release-bootstrap-node-native-exact-release-probe-fixture-v2.js";
import {
  mapPlatformReleaseBootstrapDarwinAggregateCensusEvidenceStreamV2,
} from "./platform-release-bootstrap-darwin-aggregate-census-fixture-v2.js";
import {
  beginPlatformReleaseBootstrapDarwinSlotLedgerV2,
  disposePlatformReleaseBootstrapDarwinSlotLedgerV2,
  finalizePlatformReleaseBootstrapDarwinSlotLedgerV2,
  issuePlatformReleaseBootstrapDarwinSlotLedgerCatalogV2,
  recordPlatformReleaseBootstrapDarwinSlotLedgerContentV2,
  selectPlatformReleaseBootstrapDarwinSlotLedgerSlotV2,
  type PlatformReleaseBootstrapDarwinSlotLedgerHandleV2,
  type PlatformReleaseBootstrapDarwinSlotLedgerReceiptV2,
} from "./platform-release-bootstrap-darwin-slot-ledger-v2.js";
import {
  preparePlatformReleaseBootstrapNodeRecursiveSemanticBridgeFixtureV2,
  type PlatformReleaseBootstrapNodeRecursiveSemanticPreparationFixtureV2,
} from
  "./platform-release-bootstrap-node-recursive-semantic-bridge-fixture-v2.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_NODE_EXTERNAL_RELEASE_PROBE_V2_SCHEMA,
  PLATFORM_RELEASE_BOOTSTRAP_NODE_NATIVE_CONTROLLER_AGGREGATE_MAX_BYTES_V2,
  PLATFORM_RELEASE_BOOTSTRAP_NODE_NATIVE_CONTROLLER_OBSERVATION_TYPE_V2,
  PLATFORM_RELEASE_BOOTSTRAP_NODE_NATIVE_CONTROLLER_OPEN_TYPE_V2,
  PLATFORM_RELEASE_BOOTSTRAP_NODE_NATIVE_CONTROLLER_TERMINAL_ABORT_TYPE_V2,
  beginPlatformReleaseBootstrapNodeNativeControllerFixtureV2,
  disposePlatformReleaseBootstrapNodeNativeControllerPendingV2,
  finalizePlatformReleaseBootstrapNodeNativeControllerFixtureV2,
  hashPlatformReleaseBootstrapNodeExternalReleaseProbeV2,
  type PlatformReleaseBootstrapNodeExternalReleaseProbeHashPayloadV2,
  type PlatformReleaseBootstrapNodeNativeControllerPendingV2,
  type PlatformReleaseBootstrapNodeNativeControllerReceiptV2,
} from "./platform-release-bootstrap-node-native-controller-fixture-v2.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_PHYSICAL_OWNER_ID_MAX_V2,
  buildFsObservationFingerprintV2,
  buildStableFsObjectIdentityV2,
  type BootstrapFilesystemScopeIdentityV2,
  type FsObservationFingerprintV2,
  type StableFsObjectIdentityV2,
} from "./platform-release-bootstrap-physical-census-v2.js";

const PROTOCOL_IO_TIMEOUT_MILLISECONDS_V2 = 10_000;
const ACKNOWLEDGEMENT_BUDGET_MILLISECONDS_V2 = 5_000;
const CHILD_REAP_TIMEOUT_MILLISECONDS_V2 = 2_000;
const LOCK_PROBE_TIMEOUT_MILLISECONDS_V2 = 2_000;
const STDERR_MAX_BYTES_V2 = 4 * 1024;
const PINNED_BINARY_MAX_BYTES_V2 = 32 * 1024 * 1024;
const PINNED_BINARY_HASH_SCRATCH_BYTES_V2 = 64 * 1024;
const EXACT_RELEASE_PROBE_MAX_BYTES_V2 = 16 * 1024;
const TERMINAL_PAYLOAD_BYTES_V2 = 32 + 32 + 32 + 1;
const FRAME_OVERHEAD_BYTES_V2 = 5;
const MAX_BUFFERED_PROTOCOL_BYTES_V2 =
  FRAME_OVERHEAD_BYTES_V2
  + PLATFORM_RELEASE_BOOTSTRAP_NODE_NATIVE_CONTROLLER_AGGREGATE_MAX_BYTES_V2
  + FRAME_OVERHEAD_BYTES_V2
  + TERMINAL_PAYLOAD_BYTES_V2;
const FIXED_ENVIRONMENT_V2 = Object.freeze({
  LANG: "C",
  LC_ALL: "C",
  PATH: "/usr/bin:/bin",
  TZ: "UTC",
});
const LIVE_ADAPTER_RECEIPT_SCHEMA_V2 =
  "setfarm.platform-release-bootstrap-node-native-live-adapter-test-support-receipt.v2" as const;
const LIVE_ADAPTER_RECEIPT_HASH_DOMAIN_V2 =
  "setfarm.platform-release-bootstrap-node-native-live-adapter-test-support-receipt-hash.v2" as const;
const SEMANTIC_LIVE_ADAPTER_RECEIPT_SCHEMA_V2 =
  "setfarm.platform-release-bootstrap-node-native-recursive-semantic-live-adapter-test-support-receipt.v2" as const;
const SEMANTIC_LIVE_ADAPTER_RECEIPT_HASH_DOMAIN_V2 =
  "setfarm.platform-release-bootstrap-node-native-recursive-semantic-live-adapter-test-support-receipt-hash.v2" as const;
const PINNED_BINARY_DESCRIPTOR_BINDING_SCHEMA_V2 =
  "setfarm.platform-release-bootstrap-node-native-pinned-binary-descriptor-binding.v2" as const;
const PINNED_BINARY_DESCRIPTOR_BINDING_HASH_DOMAIN_V2 =
  "setfarm.platform-release-bootstrap-node-native-pinned-binary-descriptor-binding-hash.v2" as const;
const PINNED_BINARY_CONTENT_EVIDENCE_SCHEMA_V2 =
  "setfarm.platform-release-bootstrap-node-native-pinned-binary-content-evidence.v2" as const;
const PINNED_BINARY_CONTENT_EVIDENCE_HASH_DOMAIN_V2 =
  "setfarm.platform-release-bootstrap-node-native-pinned-binary-content-evidence-hash.v2" as const;
const ACK_ACCEPT_TYPE_V2 = 16;
const TERMINAL_ACCEPT_TYPE_V2 = 32;
const SLOT_CATALOG_TYPE_V2 = 3;
const SLOT_CAPTURE_REQUEST_TYPE_V2 = 4;
const SLOT_CONTENT_OBSERVATION_TYPE_V2 = 5;
const SLOT_CONTENT_HEADER_BYTES_V2 = 61;
const SLOT_CONTENT_CHUNK_BYTES_V2 = 256 * 1024;

type LiveAdapterReceiptIdentityV2 = Readonly<{
  schema: typeof LIVE_ADAPTER_RECEIPT_SCHEMA_V2;
  version: typeof PLATFORM_RELEASE_COMPONENT_VERSION_V2;
  admissionScope: "test_fixture";
  productionAuthority: false;
  controllerReceiptHash: string;
  sessionOccurrenceHash: string;
  globalPhysicalCensusHash: string;
  nodePhysicalProjectionHash: string;
  sharedParentLockObjectIdentityHash: string;
  registeredNodePackageLockObjectIdentityHash: string;
  transportObservationStatus: "code_owned_fd4_terminal_eof_exit_observed";
  pathProbeStatus: "code_owned_path_probe_observed_toctou_limited";
  acknowledgementDeadlineStatus: "measured_ack_within_5000ms";
  binaryExecutionAuthority: "binary_path_spawn_unverified_test_fixture";
  recursiveEvidenceStatus: "recursive_absent";
  serializedAuthority: "self_asserted_replay_never_live_authority";
}>;

type LiveAdapterReceiptV2 = LiveAdapterReceiptIdentityV2 & Readonly<{
  liveAdapterReceiptHash: string;
}>;

type SemanticLiveAdapterReceiptIdentityV2 = Readonly<{
  schema: typeof SEMANTIC_LIVE_ADAPTER_RECEIPT_SCHEMA_V2;
  version: typeof PLATFORM_RELEASE_COMPONENT_VERSION_V2;
  admissionScope: "test_fixture";
  productionAuthority: false;
  preparationHash: string;
  semanticJoinHash: string;
  semanticSnapshotHash: string;
  semanticVerifierContractHash: string;
  semanticStatus: "ready";
  sessionOccurrenceHash: string;
  observationTranscriptHash: string;
  finalTranscriptHash: string;
  rawStreamHash: string;
  globalPhysicalCensusHash: string;
  globalPhysicalCensusFilesystemScopeIdentityHash: string;
  nodePhysicalProjectionHash: string;
  nodeRecursiveEvidenceHash: string;
  openTransportFrameHash: string;
  observationTransportFrameHash: string;
  acknowledgementTransportFrameHash: string;
  terminalTransportFrameHash: string;
  semanticAckSha256: string;
  releaseProbeHash: string;
  sharedParentLockObjectIdentityHash: string;
  registeredNodePackageLockObjectIdentityHash: string;
  pinnedBinaryDescriptorBinding:
    PlatformReleaseBootstrapNodeNativePinnedBinaryDescriptorBindingV2;
  serializedAuthority: "self_asserted_replay_never_live_authority";
  binaryExecutionAuthority:
    "pinned_descriptor_to_running_mapped_vnode_exact_object_observed_test_fixture";
  signingAuthority: "adhoc_or_unsigned_test_fixture";
  signatureAndAmfiAuthority: "unavailable_test_fixture";
  descriptorRelativeReleaseProbeAuthority:
    "native_external_pid_descriptor_relative_exact_object_f_tlock_fixture_v2";
  nativeSemanticParsingStatus:
    "native_semantic_parsing_absent_ts_bridge_required";
  terminalStatus: "terminal_accept_echo_authority_observed";
  protocolEofStatus: "protocol_eof_observed";
  processExitStatus: "exit_zero_silent_observed";
}>;

export type PlatformReleaseBootstrapNodeNativeRecursiveSemanticLiveAdapterReceiptV2 =
  SemanticLiveAdapterReceiptIdentityV2 & Readonly<{
    semanticLiveAdapterReceiptHash: string;
  }>;

export type PlatformReleaseBootstrapNodeNativeRecursiveSemanticLiveAdapterResultV2 =
  Readonly<{
    preparation:
      PlatformReleaseBootstrapNodeRecursiveSemanticPreparationFixtureV2;
    session: PlatformReleaseBootstrapNodeLiveObservationSessionV2;
    semanticJoinReceipt:
      PlatformReleaseBootstrapNodeLiveObservationSemanticJoinReceiptV2;
    semanticLiveAdapterReceipt:
      PlatformReleaseBootstrapNodeNativeRecursiveSemanticLiveAdapterReceiptV2;
    timing: Readonly<{
      authority: "non_authoritative_test_support_timing_v2";
      acknowledgementBudgetMilliseconds: 5_000;
      acknowledgementElapsedMilliseconds: number;
      status: "within_fixture_budget_v2";
    }>;
  }>;

export type PlatformReleaseBootstrapNodeNativeSlotLedgerLiveAdapterResultV2 =
  Readonly<{
    slotLedgerReceipt: PlatformReleaseBootstrapDarwinSlotLedgerReceiptV2;
    aggregateCensusHash: string;
    terminalFrameHash: string;
    timing: Readonly<{
      authority: "non_authoritative_test_support_timing_v2";
      acknowledgementBudgetMilliseconds: 5_000;
      acknowledgementElapsedMilliseconds: number;
      status: "within_fixture_budget_v2";
    }>;
  }>;

type PhysicalObservationV2 = Readonly<{
  objectIdentity: StableFsObjectIdentityV2;
  fingerprint: FsObservationFingerprintV2;
}>;

export type PlatformReleaseBootstrapNodeNativePinnedBinaryDescriptorBindingIdentityV2 =
  Readonly<{
    schema: typeof PINNED_BINARY_DESCRIPTOR_BINDING_SCHEMA_V2;
    version: typeof PLATFORM_RELEASE_COMPONENT_VERSION_V2;
    admissionScope: "test_fixture";
    productionAuthority: false;
    descriptorAuthority:
      "code_owned_open_no_follow_positioned_read_pre_post_exact_v2";
    filesystemScopeIdentityHash: string;
    objectIdentity: StableFsObjectIdentityV2;
    fingerprint: FsObservationFingerprintV2;
    contentEvidence:
      PlatformReleaseBootstrapNodeNativePinnedBinaryContentEvidenceV2;
  }>;

export type PlatformReleaseBootstrapNodeNativePinnedBinaryDescriptorBindingV2 =
  PlatformReleaseBootstrapNodeNativePinnedBinaryDescriptorBindingIdentityV2
  & Readonly<{ descriptorBindingHash: string }>;

export type PlatformReleaseBootstrapNodeNativePinnedBinaryContentEvidenceIdentityV2 =
  Readonly<{
    schema: typeof PINNED_BINARY_CONTENT_EVIDENCE_SCHEMA_V2;
    version: typeof PLATFORM_RELEASE_COMPONENT_VERSION_V2;
    objectIdentityHash: string;
    fingerprintHash: string;
    hashAlgorithm: "sha256";
    byteLength: number;
    contentHash: string;
  }>;

export type PlatformReleaseBootstrapNodeNativePinnedBinaryContentEvidenceV2 =
  PlatformReleaseBootstrapNodeNativePinnedBinaryContentEvidenceIdentityV2
  & Readonly<{ contentEvidenceHash: string }>;

type ChildOutcomeV2 =
  Readonly<{
    code: number | null;
    signal: NodeJS.Signals | null;
    spawnError: Error | null;
  }>;

function failV2(message: string, cause?: unknown): never {
  throw new TypeError(
    message,
    cause === undefined ? {} : { cause },
  );
}

function hashLiveAdapterReceiptV2(value: LiveAdapterReceiptIdentityV2): string {
  return hashCanonicalJson({
    schema: LIVE_ADAPTER_RECEIPT_HASH_DOMAIN_V2,
    receipt: value,
  });
}

export function hashPlatformReleaseBootstrapNodeNativeRecursiveSemanticLiveAdapterReceiptV2(
  value: SemanticLiveAdapterReceiptIdentityV2,
): string {
  return hashCanonicalJson({
    schema: SEMANTIC_LIVE_ADAPTER_RECEIPT_HASH_DOMAIN_V2,
    receipt: value,
  });
}

function sha256HexV2(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function encodeAcceptAcknowledgementV2(
  challenge: Buffer,
  aggregateSha256: Buffer,
  semanticAckSha256: Buffer,
): Buffer {
  if (
    challenge.byteLength !== 32
    || aggregateSha256.byteLength !== 32
    || semanticAckSha256.byteLength !== 32
  ) {
    return failV2("Semantic live ACK components must each be 32 bytes");
  }
  const bodyLength = 1 + 32 + 32 + 32;
  const frame = Buffer.allocUnsafe(4 + bodyLength);
  frame.writeUInt32BE(bodyLength, 0);
  frame[4] = ACK_ACCEPT_TYPE_V2;
  challenge.copy(frame, 5);
  aggregateSha256.copy(frame, 37);
  semanticAckSha256.copy(frame, 69);
  return frame;
}

function encodeProtocolFrameV2(type: number, payload: Uint8Array): Buffer {
  if (!Number.isInteger(type) || type < 0 || type > 0xff) {
    return failV2("Live adapter protocol frame type is invalid");
  }
  if (payload.byteLength > 0xffff_ffff - 1) {
    return failV2("Live adapter protocol frame exceeds its byte bound");
  }
  const frame = Buffer.allocUnsafe(5 + payload.byteLength);
  frame.writeUInt32BE(payload.byteLength + 1, 0);
  frame[4] = type;
  Buffer.from(payload).copy(frame, 5);
  return frame;
}

function exactInputV2(input: unknown): Readonly<{
  nativeBinaryPath: string;
  parentPath: string;
}> {
  if (
    input === null
    || typeof input !== "object"
    || nodeUtilTypes.isProxy(input)
    || Object.getPrototypeOf(input) !== Object.prototype
  ) {
    return failV2("Live adapter input must be one non-proxy plain record");
  }
  const descriptors = Object.getOwnPropertyDescriptors(input);
  const keys = ["nativeBinaryPath", "parentPath"] as const;
  if (
    Reflect.ownKeys(descriptors).length !== keys.length
    || keys.some((key) => {
      const descriptor = descriptors[key];
      return !descriptor
        || !("value" in descriptor)
        || !descriptor.enumerable
        || typeof descriptor.value !== "string";
    })
  ) {
    return failV2("Live adapter input must expose only its exact path fields");
  }
  const normalized = Object.fromEntries(keys.map((key) => {
    const value = descriptors[key]!.value as string;
    if (
      value.length === 0
      || value.includes("\0")
      || !path.isAbsolute(value)
      || path.normalize(value) !== value
    ) {
      return failV2(`Live adapter ${key} must be one normalized absolute path`);
    }
    return [key, value];
  })) as { nativeBinaryPath: string; parentPath: string };
  return Object.freeze(normalized);
}

function safeNumberV2(value: bigint, maximum: number, label: string): number {
  if (value < 0n || value > BigInt(maximum)) {
    return failV2(`Live adapter ${label} is outside its exact numeric bound`);
  }
  return Number(value);
}

function canonicalModeV2(mode: bigint): string {
  const permissions = mode & 0o7777n;
  return permissions.toString(8).padStart(4, "0");
}

function samePhysicalObjectV2(left: BigIntStats, right: BigIntStats): boolean {
  return left.dev === right.dev
    && left.ino === right.ino
    && left.mode === right.mode
    && left.uid === right.uid
    && left.gid === right.gid
    && left.nlink === right.nlink
    && left.size === right.size
    && left.mtimeNs === right.mtimeNs
    && left.ctimeNs === right.ctimeNs;
}

export function hashPlatformReleaseBootstrapNodeNativePinnedBinaryDescriptorBindingV2(
  value: PlatformReleaseBootstrapNodeNativePinnedBinaryDescriptorBindingIdentityV2,
): string {
  return hashCanonicalJson({
    schema: PINNED_BINARY_DESCRIPTOR_BINDING_HASH_DOMAIN_V2,
    binding: value,
  });
}

export function hashPlatformReleaseBootstrapNodeNativePinnedBinaryContentEvidenceV2(
  value: PlatformReleaseBootstrapNodeNativePinnedBinaryContentEvidenceIdentityV2,
): string {
  return hashCanonicalJson({
    schema: PINNED_BINARY_CONTENT_EVIDENCE_HASH_DOMAIN_V2,
    contentEvidence: value,
  });
}

function hashPinnedBinaryDescriptorV2(
  descriptor: number,
  byteLength: number,
  scratch: Buffer,
): Buffer {
  if (
    !Number.isSafeInteger(byteLength)
    || byteLength < 1
    || byteLength > PINNED_BINARY_MAX_BYTES_V2
    || scratch.byteLength !== PINNED_BINARY_HASH_SCRATCH_BYTES_V2
  ) {
    return failV2("Semantic live pinned binary hash bounds are invalid");
  }
  const hash = createHash("sha256");
  let position = 0;
  try {
    while (position < byteLength) {
      scratch.fill(0);
      const requested = Math.min(scratch.byteLength, byteLength - position);
      const count = readSync(
        descriptor,
        scratch,
        0,
        requested,
        position,
      );
      if (count <= 0 || count > requested) {
        return failV2("Semantic live pinned binary read was short");
      }
      hash.update(scratch.subarray(0, count));
      position += count;
    }
    return hash.digest();
  } finally {
    scratch.fill(0);
  }
}

function buildPinnedBinaryDescriptorBindingV2(
  filesystemScope: BootstrapFilesystemScopeIdentityV2,
  stat: BigIntStats,
  contentHash: Buffer,
): PlatformReleaseBootstrapNodeNativePinnedBinaryDescriptorBindingV2 {
  if (
    !stat.isFile()
    || stat.nlink !== 1n
    || stat.size < 1n
    || stat.size > BigInt(PINNED_BINARY_MAX_BYTES_V2)
    || contentHash.byteLength !== 32
  ) {
    return failV2(
      "Semantic live pinned binary descriptor boundary is invalid",
    );
  }
  const objectIdentity = buildStableFsObjectIdentityV2({
    filesystemScope,
    objectKind: "ordinary_file",
    device: stat.dev.toString(10),
    inode: stat.ino.toString(10),
  });
  const fingerprint = buildFsObservationFingerprintV2({
    objectIdentity,
    ownerUid: safeNumberV2(
      stat.uid,
      PLATFORM_RELEASE_BOOTSTRAP_PHYSICAL_OWNER_ID_MAX_V2,
      "pinned binary owner UID",
    ),
    ownerGid: safeNumberV2(
      stat.gid,
      PLATFORM_RELEASE_BOOTSTRAP_PHYSICAL_OWNER_ID_MAX_V2,
      "pinned binary owner GID",
    ),
    mode: canonicalModeV2(stat.mode),
    linkCount: 1,
    byteLength: safeNumberV2(
      stat.size,
      PINNED_BINARY_MAX_BYTES_V2,
      "pinned binary byte length",
    ),
    modifiedTimeNanoseconds: stat.mtimeNs.toString(10),
    changedTimeNanoseconds: stat.ctimeNs.toString(10),
  });
  const contentEvidenceIdentity = {
    schema: PINNED_BINARY_CONTENT_EVIDENCE_SCHEMA_V2,
    version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
    objectIdentityHash: objectIdentity.objectIdentityHash,
    fingerprintHash: fingerprint.fingerprintHash,
    hashAlgorithm: "sha256" as const,
    byteLength: fingerprint.byteLength,
    contentHash: contentHash.toString("hex"),
  } satisfies PlatformReleaseBootstrapNodeNativePinnedBinaryContentEvidenceIdentityV2;
  const contentEvidence = {
    ...contentEvidenceIdentity,
    contentEvidenceHash:
      hashPlatformReleaseBootstrapNodeNativePinnedBinaryContentEvidenceV2(
        contentEvidenceIdentity,
      ),
  } satisfies PlatformReleaseBootstrapNodeNativePinnedBinaryContentEvidenceV2;
  const identity = {
    schema: PINNED_BINARY_DESCRIPTOR_BINDING_SCHEMA_V2,
    version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
    admissionScope: "test_fixture" as const,
    productionAuthority: false as const,
    descriptorAuthority:
      "code_owned_open_no_follow_positioned_read_pre_post_exact_v2" as const,
    filesystemScopeIdentityHash: filesystemScope.scopeIdentityHash,
    objectIdentity,
    fingerprint,
    contentEvidence,
  } satisfies PlatformReleaseBootstrapNodeNativePinnedBinaryDescriptorBindingIdentityV2;
  return deepFreezePlatformReleaseJsonV2({
    ...identity,
    descriptorBindingHash:
      hashPlatformReleaseBootstrapNodeNativePinnedBinaryDescriptorBindingV2(
        identity,
      ),
  });
}

function observeRegularFileV2(
  filesystemScope: BootstrapFilesystemScopeIdentityV2,
  stat: BigIntStats,
): PhysicalObservationV2 {
  if (!stat.isFile()) {
    return failV2("Live adapter lock observation is not an exact regular file");
  }
  const objectIdentity = buildStableFsObjectIdentityV2({
    filesystemScope,
    objectKind: "ordinary_file",
    device: stat.dev.toString(10),
    inode: stat.ino.toString(10),
  });
  return Object.freeze({
    objectIdentity,
    fingerprint: buildFsObservationFingerprintV2({
      objectIdentity,
      ownerUid: safeNumberV2(
        stat.uid,
        PLATFORM_RELEASE_BOOTSTRAP_PHYSICAL_OWNER_ID_MAX_V2,
        "owner UID",
      ),
      ownerGid: safeNumberV2(
        stat.gid,
        PLATFORM_RELEASE_BOOTSTRAP_PHYSICAL_OWNER_ID_MAX_V2,
        "owner GID",
      ),
      mode: canonicalModeV2(stat.mode),
      linkCount: safeNumberV2(stat.nlink, Number.MAX_SAFE_INTEGER, "link count"),
      byteLength: safeNumberV2(stat.size, Number.MAX_SAFE_INTEGER, "byte length"),
      modifiedTimeNanoseconds: stat.mtimeNs.toString(10),
      changedTimeNanoseconds: stat.ctimeNs.toString(10),
    }),
  });
}

function equalObservationV2(
  left: PhysicalObservationV2,
  right: PhysicalObservationV2,
): boolean {
  return canonicalJsonStringify(left) === canonicalJsonStringify(right);
}

class BoundedFrameReaderV2 {
  readonly #chunks: Buffer[] = [];
  readonly #waiters = new Set<() => void>();
  readonly #stream: Duplex;
  readonly #onData: (chunk: Buffer | Uint8Array) => void;
  readonly #onEnd: () => void;
  readonly #onError: (error: Error) => void;
  #bufferedBytes = 0;
  #ended = false;
  #failure: Error | null = null;
  #disposed = false;

  constructor(stream: Duplex) {
    this.#stream = stream;
    this.#onData = (chunk: Buffer | Uint8Array): void => {
      if (this.#failure !== null || this.#disposed) return;
      const bytes = Buffer.from(chunk);
      if (bytes.byteLength > MAX_BUFFERED_PROTOCOL_BYTES_V2 - this.#bufferedBytes) {
        bytes.fill(0);
        this.#failure = new Error("Live adapter protocol buffer exceeded its bound");
      } else if (bytes.byteLength > 0) {
        this.#chunks.push(bytes);
        this.#bufferedBytes += bytes.byteLength;
      }
      this.#signal();
    };
    this.#onEnd = (): void => {
      this.#ended = true;
      this.#signal();
    };
    this.#onError = (error: Error): void => {
      this.#failure = error;
      this.#signal();
    };
    stream.on("data", this.#onData);
    stream.once("end", this.#onEnd);
    stream.once("error", this.#onError);
  }

  #signal(): void {
    const waiters = [...this.#waiters];
    this.#waiters.clear();
    for (const waiter of waiters) waiter();
  }

  async #waitForChange(deadline: number, label: string): Promise<void> {
    const remaining = deadline - performance.now();
    if (remaining <= 0) return failV2(`Live adapter ${label} timed out`);
    await new Promise<void>((resolve, reject) => {
      const wake = (): void => {
        clearTimeout(timeout);
        this.#waiters.delete(wake);
        resolve();
      };
      const timeout = setTimeout(() => {
        this.#waiters.delete(wake);
        reject(new TypeError(`Live adapter ${label} timed out`));
      }, remaining);
      this.#waiters.add(wake);
    });
  }

  #take(length: number): Buffer {
    const output = Buffer.allocUnsafe(length);
    let offset = 0;
    while (offset < length) {
      const chunk = this.#chunks.shift()!;
      const count = Math.min(chunk.byteLength, length - offset);
      chunk.copy(output, offset, 0, count);
      offset += count;
      this.#bufferedBytes -= count;
      if (count < chunk.byteLength) {
        this.#chunks.unshift(Buffer.from(chunk.subarray(count)));
      }
      chunk.fill(0);
    }
    return output;
  }

  async #readExact(length: number, deadline: number, label: string): Promise<Buffer> {
    while (this.#bufferedBytes < length) {
      if (this.#failure !== null) return failV2(`Live adapter ${label} failed`, this.#failure);
      if (this.#ended) {
        return failV2(`Live adapter protocol ended during ${label}`);
      }
      await this.#waitForChange(deadline, label);
    }
    return this.#take(length);
  }

  async readFrame(
    expectedType: number,
    minimumPayloadBytes: number,
    maximumPayloadBytes: number,
    deadline: number,
    label: string,
  ): Promise<Buffer> {
    const header = await this.#readExact(4, deadline, `${label} header`);
    const bodyLength = header.readUInt32BE(0);
    if (
      bodyLength < 1 + minimumPayloadBytes
      || bodyLength > 1 + maximumPayloadBytes
    ) {
      header.fill(0);
      return failV2(`Live adapter ${label} body length is invalid`);
    }
    const body = await this.#readExact(bodyLength, deadline, `${label} body`);
    if (body[0] !== expectedType) {
      header.fill(0);
      body.fill(0);
      return failV2(`Live adapter ${label} type is invalid`);
    }
    const frame = Buffer.concat([header, body]);
    header.fill(0);
    body.fill(0);
    return frame;
  }

  async expectEnd(deadline: number): Promise<void> {
    for (;;) {
      if (this.#failure !== null) return failV2("Live adapter protocol EOF failed", this.#failure);
      if (this.#bufferedBytes !== 0) {
        return failV2("Live adapter protocol has trailing bytes after terminal");
      }
      if (this.#ended) return;
      await this.#waitForChange(deadline, "protocol EOF");
    }
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#stream.off("data", this.#onData);
    this.#stream.off("end", this.#onEnd);
    this.#stream.off("error", this.#onError);
    for (const chunk of this.#chunks) chunk.fill(0);
    this.#chunks.length = 0;
    this.#bufferedBytes = 0;
    this.#ended = true;
    this.#failure = new Error("Live adapter frame reader disposed");
    this.#signal();
  }
}

class ChildOutcomeMonitorV2 {
  readonly promise: Promise<ChildOutcomeV2>;
  readonly #child: ChildProcess;
  readonly #onError: (error: Error) => void;
  readonly #onClose: (
    code: number | null,
    signal: NodeJS.Signals | null,
  ) => void;
  #resolve!: (outcome: ChildOutcomeV2) => void;
  #spawnError: Error | null = null;
  #settled = false;

  constructor(child: ChildProcess) {
    this.#child = child;
    this.promise = new Promise((resolve) => { this.#resolve = resolve; });
    this.#onError = (error: Error): void => { this.#spawnError ??= error; };
    this.#onClose = (code, signal): void => {
      if (this.#settled) return;
      this.#settled = true;
      this.#removeListeners();
      this.#resolve(Object.freeze({
        code,
        signal,
        spawnError: this.#spawnError,
      }));
    };
    child.once("error", this.#onError);
    child.once("close", this.#onClose);
  }

  get settled(): boolean {
    return this.#settled;
  }

  #removeListeners(): void {
    this.#child.off("error", this.#onError);
    this.#child.off("close", this.#onClose);
  }

  dispose(): void {
    this.#removeListeners();
  }
}

async function withinDeadlineV2<T>(
  promise: Promise<T>,
  deadline: number,
  label: string,
): Promise<T> {
  const remaining = deadline - performance.now();
  if (remaining <= 0) return failV2(`Live adapter ${label} timed out`);
  let timeout: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(
          () => reject(new TypeError(`Live adapter ${label} timed out`)),
          remaining,
        );
      }),
    ]);
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}

async function endProtocolV2(
  protocol: Duplex,
  acknowledgement: Buffer,
  deadline: number,
): Promise<void> {
  const remaining = deadline - performance.now();
  if (remaining <= 0) {
    return failV2("Live adapter abort acknowledgement write and EOF timed out");
  }
  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = (error?: Error): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      protocol.off("error", onError);
      if (error) reject(error);
      else resolve();
    };
    const onError = (error: Error): void => finish(error);
    const timeout = setTimeout(
      () => finish(new TypeError(
        "Live adapter abort acknowledgement write and EOF timed out",
      )),
      remaining,
    );
    protocol.once("error", onError);
    protocol.end(acknowledgement, () => finish());
  });
}

async function readOwnedBoundedStreamToEndV2(
  stream: Duplex,
  maximumBytes: number,
  deadline: number,
  label: string,
): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;
  let timeout: NodeJS.Timeout | undefined;
  try {
    return await new Promise<Buffer>((resolve, reject) => {
      let settled = false;
      const finish = (error?: Error): void => {
        if (settled) return;
        settled = true;
        if (timeout !== undefined) clearTimeout(timeout);
        stream.off("data", onData);
        stream.off("end", onEnd);
        stream.off("error", onError);
        if (error !== undefined) {
          reject(error);
          return;
        }
        const result = Buffer.concat(chunks, total);
        resolve(result);
      };
      const onData = (chunk: Buffer | Uint8Array): void => {
        const bytes = Buffer.from(chunk);
        if (bytes.byteLength > maximumBytes - total) {
          bytes.fill(0);
          finish(new TypeError(`Live adapter ${label} exceeded its byte bound`));
          return;
        }
        chunks.push(bytes);
        total += bytes.byteLength;
      };
      const onEnd = (): void => finish();
      const onError = (error: Error): void => finish(error);
      const remaining = deadline - performance.now();
      if (remaining <= 0) {
        finish(new TypeError(`Live adapter ${label} timed out`));
        return;
      }
      timeout = setTimeout(
        () => finish(new TypeError(`Live adapter ${label} timed out`)),
        remaining,
      );
      stream.on("data", onData);
      stream.once("end", onEnd);
      stream.once("error", onError);
    });
  } finally {
    for (const chunk of chunks) chunk.fill(0);
  }
}

async function killAndReapV2(
  child: ChildProcess | undefined,
  monitor: ChildOutcomeMonitorV2 | undefined,
): Promise<void> {
  if (!child || !monitor || monitor.settled) return;
  try {
    child.kill("SIGKILL");
  } catch {
    // A concurrent close is acceptable only when the bounded outcome settles.
  }
  await withinDeadlineV2(
    monitor.promise,
    performance.now() + CHILD_REAP_TIMEOUT_MILLISECONDS_V2,
    "child reap",
  );
}

/** Test-only live bridge. It deliberately cannot issue production authority. */
export async function runPlatformReleaseBootstrapNodeNativeLiveAdapterTestSupportV2(
  input: Readonly<{ nativeBinaryPath: string; parentPath: string }>,
): Promise<Readonly<{
  receipt: PlatformReleaseBootstrapNodeNativeControllerReceiptV2;
  liveAdapterReceipt: LiveAdapterReceiptV2;
  timing: Readonly<{
    authority: "non_authoritative_test_support_timing_v2";
    acknowledgementBudgetMilliseconds: 5_000;
    acknowledgementElapsedMilliseconds: number;
    status: "within_fixture_budget_v2";
  }>;
}>> {
  const parsed = exactInputV2(input);
  const nodePackage = PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.packages.find(
    (entry) => entry.packageRef
      === PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.nodeToolchainProvisioner,
  );
  if (!nodePackage) return failV2("Live adapter Node package contract is absent");
  const sharedLockPath = path.join(
    parsed.parentPath,
    PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.registry.sharedLockBasename,
  );
  const nodeLockPath = path.join(
    parsed.parentPath,
    nodePackage.lifecycle.packageLockBasename,
  );

  const binaryStat = lstatSync(parsed.nativeBinaryPath, { bigint: true });
  const parentStat = lstatSync(parsed.parentPath, { bigint: true });
  const sharedPreStat = lstatSync(sharedLockPath, { bigint: true });
  const nodePreStat = lstatSync(nodeLockPath, { bigint: true });
  if (
    !binaryStat.isFile()
    || !parentStat.isDirectory()
    || !sharedPreStat.isFile()
    || !nodePreStat.isFile()
    || sharedPreStat.dev !== parentStat.dev
    || nodePreStat.dev !== parentStat.dev
    || sharedPreStat.uid !== parentStat.uid
    || sharedPreStat.gid !== parentStat.gid
    || nodePreStat.uid !== parentStat.uid
    || nodePreStat.gid !== parentStat.gid
    || canonicalModeV2(sharedPreStat.mode) !== "0600"
    || canonicalModeV2(nodePreStat.mode) !== "0600"
    || sharedPreStat.nlink !== 1n
    || nodePreStat.nlink !== 1n
    || (sharedPreStat.dev === nodePreStat.dev && sharedPreStat.ino === nodePreStat.ino)
  ) {
    return failV2("Live adapter pre-observation physical boundary is invalid");
  }

  let parentDescriptor: number | undefined;
  let child: ChildProcess | undefined;
  let childMonitor: ChildOutcomeMonitorV2 | undefined;
  let reader: BoundedFrameReaderV2 | undefined;
  let pending: PlatformReleaseBootstrapNodeNativeControllerPendingV2 | undefined;
  let openFrame: Buffer | undefined;
  let observationFrame: Buffer | undefined;
  let terminalFrame: Buffer | undefined;
  let acknowledgement: Buffer | undefined;
  let stderr = Buffer.alloc(0);
  let stdoutDirty = false;
  let stderrDirty = false;
  let stderrOverflow = false;
  let stdioFailure: Error | null = null;
  let stdioErrorListener: ((error: Error) => void) | undefined;
  let stdoutDataListener: (() => void) | undefined;
  let stderrDataListener: ((chunk: Buffer | Uint8Array) => void) | undefined;
  try {
    parentDescriptor = openSync(
      parsed.parentPath,
      constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
    );
    const pinnedParentStat = fstatSync(parentDescriptor, { bigint: true });
    if (!pinnedParentStat.isDirectory() || !samePhysicalObjectV2(parentStat, pinnedParentStat)) {
      return failV2("Live adapter pinned parent descriptor changed before spawn");
    }
    child = spawn(parsed.nativeBinaryPath, [], {
      cwd: "/",
      env: FIXED_ENVIRONMENT_V2,
      shell: false,
      stdio: ["pipe", "pipe", "pipe", parentDescriptor, "pipe"],
      windowsHide: true,
    });
    childMonitor = new ChildOutcomeMonitorV2(child);
    closeSync(parentDescriptor);
    parentDescriptor = undefined;
    stdioErrorListener = (error: Error): void => {
      stdioFailure ??= error;
      child?.kill("SIGKILL");
    };
    stdoutDataListener = (): void => {
      stdoutDirty = true;
      child?.kill("SIGKILL");
    };
    stderrDataListener = (chunk: Buffer | Uint8Array): void => {
      stderrDirty = true;
      const bytes = Buffer.from(chunk);
      if (bytes.byteLength > STDERR_MAX_BYTES_V2 - stderr.byteLength) {
        stderrOverflow = true;
        bytes.fill(0);
        child?.kill("SIGKILL");
        return;
      }
      const combined = Buffer.concat([stderr, bytes]);
      stderr.fill(0);
      bytes.fill(0);
      stderr = combined;
    };
    child.stdin!.on("error", stdioErrorListener);
    child.stdout!.on("error", stdioErrorListener);
    child.stderr!.on("error", stdioErrorListener);
    child.stdout!.on("data", stdoutDataListener);
    child.stderr!.on("data", stderrDataListener);
    const protocol = child.stdio[4];
    if (!(protocol instanceof Duplex)) {
      return failV2("Live adapter fd4 protocol is not one Duplex stream");
    }
    reader = new BoundedFrameReaderV2(protocol);
    child.stdin!.end("session_live\n");

    const observationDeadline =
      performance.now() + PROTOCOL_IO_TIMEOUT_MILLISECONDS_V2;
    openFrame = await reader.readFrame(
      PLATFORM_RELEASE_BOOTSTRAP_NODE_NATIVE_CONTROLLER_OPEN_TYPE_V2,
      32,
      32,
      observationDeadline,
      "OPEN frame",
    );
    observationFrame = await reader.readFrame(
      PLATFORM_RELEASE_BOOTSTRAP_NODE_NATIVE_CONTROLLER_OBSERVATION_TYPE_V2,
      1,
      PLATFORM_RELEASE_BOOTSTRAP_NODE_NATIVE_CONTROLLER_AGGREGATE_MAX_BYTES_V2,
      observationDeadline,
      "OBSERVATION frame",
    );

    const acknowledgementStarted = performance.now();
    const acknowledgementDeadline =
      acknowledgementStarted + ACKNOWLEDGEMENT_BUDGET_MILLISECONDS_V2;
    const begun = beginPlatformReleaseBootstrapNodeNativeControllerFixtureV2({
      openFrameBytes: openFrame,
      observationFrameBytes: observationFrame,
    });
    pending = begun.pending;
    acknowledgement = Buffer.from(begun.acknowledgementBytes);
    if (performance.now() >= acknowledgementDeadline) {
      return failV2("Live adapter controller work exceeded its ACK budget");
    }
    await endProtocolV2(protocol, acknowledgement, acknowledgementDeadline);
    const acknowledgementElapsedMilliseconds =
      performance.now() - acknowledgementStarted;
    if (acknowledgementElapsedMilliseconds > ACKNOWLEDGEMENT_BUDGET_MILLISECONDS_V2) {
      return failV2("Live adapter acknowledgement exceeded its ACK budget");
    }

    const terminalDeadline =
      performance.now() + PROTOCOL_IO_TIMEOUT_MILLISECONDS_V2;
    terminalFrame = await reader.readFrame(
      PLATFORM_RELEASE_BOOTSTRAP_NODE_NATIVE_CONTROLLER_TERMINAL_ABORT_TYPE_V2,
      TERMINAL_PAYLOAD_BYTES_V2,
      TERMINAL_PAYLOAD_BYTES_V2,
      terminalDeadline,
      "TERMINAL_ABORT frame",
    );
    await reader.expectEnd(terminalDeadline);
    const outcome = await withinDeadlineV2(
      childMonitor.promise,
      terminalDeadline,
      "clean child settlement",
    );
    if (
      outcome.spawnError !== null
      || outcome.code !== 0
      || outcome.signal !== null
      || stdoutDirty
      || stderrDirty
      || stderrOverflow
      || stdioFailure !== null
      || stderr.byteLength !== 0
    ) {
      return failV2("Live adapter child did not settle cleanly and silently");
    }

    const filesystemScope = begun.evidence.aggregateObservation.filesystemScope;
    const sharedPre = observeRegularFileV2(filesystemScope, sharedPreStat);
    const nodePre = observeRegularFileV2(filesystemScope, nodePreStat);
    const mappedLocks = begun.evidence.aggregateObservation.heldLocks;
    if (
      !equalObservationV2(sharedPre, mappedLocks.sharedParentLock)
      || !equalObservationV2(nodePre, mappedLocks.registeredNodePackageLock)
    ) {
      return failV2("Live adapter pre-lock observations do not equal native evidence");
    }

    const sharedPost = observeRegularFileV2(
      filesystemScope,
      lstatSync(sharedLockPath, { bigint: true }),
    );
    const nodePost = observeRegularFileV2(
      filesystemScope,
      lstatSync(nodeLockPath, { bigint: true }),
    );
    if (!equalObservationV2(sharedPre, sharedPost) || !equalObservationV2(nodePre, nodePost)) {
      return failV2("Live adapter lock identities changed before release probe");
    }

    const lockProbe = spawnSync(
      "/usr/bin/lockf",
      [
        "-k", "-t", "0", sharedLockPath,
        "/usr/bin/lockf", "-k", "-t", "0", nodeLockPath,
        "/usr/bin/true",
      ],
      {
        cwd: "/",
        env: FIXED_ENVIRONMENT_V2,
        shell: false,
        encoding: "buffer",
        maxBuffer: STDERR_MAX_BYTES_V2,
        timeout: LOCK_PROBE_TIMEOUT_MILLISECONDS_V2,
        windowsHide: true,
      },
    );
    if (
      lockProbe.error !== undefined
      || lockProbe.status !== 0
      || lockProbe.signal !== null
      || lockProbe.stdout.byteLength !== 0
      || lockProbe.stderr.byteLength !== 0
    ) {
      return failV2("Live adapter paired lock release probe failed");
    }
    const sharedFinal = observeRegularFileV2(
      filesystemScope,
      lstatSync(sharedLockPath, { bigint: true }),
    );
    const nodeFinal = observeRegularFileV2(
      filesystemScope,
      lstatSync(nodeLockPath, { bigint: true }),
    );
    if (
      !equalObservationV2(sharedPre, sharedFinal)
      || !equalObservationV2(nodePre, nodeFinal)
    ) {
      return failV2("Live adapter lock identities changed across release probe");
    }
    const probeIdentity = {
      schema: PLATFORM_RELEASE_BOOTSTRAP_NODE_EXTERNAL_RELEASE_PROBE_V2_SCHEMA,
      version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
      productionAuthority: false as const,
      probeAuthority: "self_asserted_requires_code_owned_paired_probe_v2" as const,
      acquisitionOrder: [
        "shared_parent_lock",
        "registered_node_package_lock",
      ],
      releaseOrder: [
        "registered_node_package_lock",
        "shared_parent_lock",
      ],
      sharedParentLock: {
        ...sharedFinal,
        outcome: "exclusive_nonblocking_lock_acquired_then_released" as const,
      },
      registeredNodePackageLock: {
        ...nodeFinal,
        outcome: "exclusive_nonblocking_lock_acquired_then_released" as const,
      },
    } satisfies PlatformReleaseBootstrapNodeExternalReleaseProbeHashPayloadV2;
    const receipt = finalizePlatformReleaseBootstrapNodeNativeControllerFixtureV2(
      pending,
      {
        terminalFrameBytes: terminalFrame,
        processSettlement: {
          exitCode: 0,
          signal: null,
          protocolEof: true,
          stdout: Buffer.alloc(0),
          stderr: Buffer.alloc(0),
        },
        externalReleaseProbe: {
          ...probeIdentity,
          probeHash: hashPlatformReleaseBootstrapNodeExternalReleaseProbeV2(
            probeIdentity,
          ),
        },
      },
    );
    pending = undefined;
    const liveAdapterReceiptIdentity = Object.freeze({
      schema: LIVE_ADAPTER_RECEIPT_SCHEMA_V2,
      version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
      admissionScope: "test_fixture" as const,
      productionAuthority: false as const,
      controllerReceiptHash: receipt.receiptHash,
      sessionOccurrenceHash: receipt.sessionOccurrenceHash,
      globalPhysicalCensusHash: receipt.globalPhysicalCensusHash,
      nodePhysicalProjectionHash: receipt.nodePhysicalProjectionHash,
      sharedParentLockObjectIdentityHash:
        receipt.sharedParentLockObjectIdentityHash,
      registeredNodePackageLockObjectIdentityHash:
        receipt.registeredNodePackageLockObjectIdentityHash,
      transportObservationStatus:
        "code_owned_fd4_terminal_eof_exit_observed" as const,
      pathProbeStatus:
        "code_owned_path_probe_observed_toctou_limited" as const,
      acknowledgementDeadlineStatus:
        "measured_ack_within_5000ms" as const,
      binaryExecutionAuthority:
        "binary_path_spawn_unverified_test_fixture" as const,
      recursiveEvidenceStatus: "recursive_absent" as const,
      serializedAuthority:
        "self_asserted_replay_never_live_authority" as const,
    }) satisfies LiveAdapterReceiptIdentityV2;
    const liveAdapterReceipt = Object.freeze({
      ...liveAdapterReceiptIdentity,
      liveAdapterReceiptHash:
        hashLiveAdapterReceiptV2(liveAdapterReceiptIdentity),
    });
    return Object.freeze({
      receipt,
      liveAdapterReceipt,
      timing: Object.freeze({
        authority: "non_authoritative_test_support_timing_v2" as const,
        acknowledgementBudgetMilliseconds:
          ACKNOWLEDGEMENT_BUDGET_MILLISECONDS_V2,
        acknowledgementElapsedMilliseconds,
        status: "within_fixture_budget_v2" as const,
      }),
    });
  } catch (error) {
    if (stderrOverflow) {
      return failV2("Live adapter stderr exceeded its exact byte bound", error);
    }
    if (stdoutDirty || stderrDirty) {
      return failV2("Live adapter child emitted forbidden output", error);
    }
    if (stdioFailure !== null) {
      return failV2("Live adapter child stdio failed", stdioFailure);
    }
    throw error;
  } finally {
    let cleanupFailure: unknown;
    if (parentDescriptor !== undefined) {
      try {
        closeSync(parentDescriptor);
      } catch (error) {
        cleanupFailure ??= error;
      }
    }
    if (pending !== undefined) {
      try {
        disposePlatformReleaseBootstrapNodeNativeControllerPendingV2(pending);
      } catch (error) {
        cleanupFailure ??= error;
      }
    }
    try {
      await killAndReapV2(child, childMonitor);
    } catch (error) {
      cleanupFailure ??= error;
    }
    reader?.dispose();
    if (stdioErrorListener !== undefined) {
      child?.stdin?.off("error", stdioErrorListener);
      child?.stdout?.off("error", stdioErrorListener);
      child?.stderr?.off("error", stdioErrorListener);
    }
    if (stdoutDataListener !== undefined) {
      child?.stdout?.off("data", stdoutDataListener);
    }
    if (stderrDataListener !== undefined) {
      child?.stderr?.off("data", stderrDataListener);
    }
    childMonitor?.dispose();
    openFrame?.fill(0);
    observationFrame?.fill(0);
    terminalFrame?.fill(0);
    acknowledgement?.fill(0);
    stderr.fill(0);
    if (cleanupFailure !== undefined) {
      return failV2("Live adapter cleanup or child reap failed", cleanupFailure);
    }
  }
}

/**
 * Test-only descriptor-capture slot-join bridge. The native slot catalog and
 * content frames are joined by a private WeakMap ledger before an ACCEPT is
 * emitted; pathname spawn, signing, AMFI, and notarization remain unproven,
 * so the returned pre-ACCEPT receipt is never production authority.
 */
export async function runPlatformReleaseBootstrapNodeNativeSlotLedgerLiveAdapterTestSupportV2(
  input: Readonly<{ nativeBinaryPath: string; parentPath: string }>,
): Promise<PlatformReleaseBootstrapNodeNativeSlotLedgerLiveAdapterResultV2> {
  const parsed = exactInputV2(input);
  const nodePackage = PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.packages.find(
    (entry) => entry.packageRef
      === PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.nodeToolchainProvisioner,
  );
  if (!nodePackage) return failV2("Slot-ledger Node package contract is absent");
  const sharedLockPath = path.join(
    parsed.parentPath,
    PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.registry.sharedLockBasename,
  );
  const nodeLockPath = path.join(
    parsed.parentPath,
    nodePackage.lifecycle.packageLockBasename,
  );
  const targetBasename = nodePackage.lifecycle.activeClaimBasename;
  const parentStat = lstatSync(parsed.parentPath, { bigint: true });
  const sharedPreStat = lstatSync(sharedLockPath, { bigint: true });
  const nodePreStat = lstatSync(nodeLockPath, { bigint: true });
  if (
    !parentStat.isDirectory()
    || !sharedPreStat.isFile()
    || !nodePreStat.isFile()
    || sharedPreStat.dev !== parentStat.dev
    || nodePreStat.dev !== parentStat.dev
    || sharedPreStat.nlink !== 1n
    || nodePreStat.nlink !== 1n
  ) return failV2("Slot-ledger pre-observation physical boundary is invalid");

  let parentDescriptor: number | undefined;
  let child: ChildProcess | undefined;
  let childMonitor: ChildOutcomeMonitorV2 | undefined;
  let reader: BoundedFrameReaderV2 | undefined;
  let ledger: PlatformReleaseBootstrapDarwinSlotLedgerHandleV2 | undefined;
  let openFrame: Buffer | undefined;
  let observationFrame: Buffer | undefined;
  let catalogFrame: Buffer | undefined;
  let terminalFrame: Buffer | undefined;
  let acknowledgement: Buffer | undefined;
  let requestFrame: Buffer | undefined;
  let stderr = Buffer.alloc(0);
  let stdoutDirty = false;
  let stderrDirty = false;
  let stderrOverflow = false;
  let stdioFailure: Error | null = null;
  let stdioErrorListener: ((error: Error) => void) | undefined;
  let stdoutDataListener: (() => void) | undefined;
  let stderrDataListener: ((chunk: Buffer | Uint8Array) => void) | undefined;
  try {
    parentDescriptor = openSync(
      parsed.parentPath,
      constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
    );
    const pinnedParentStat = fstatSync(parentDescriptor, { bigint: true });
    if (!pinnedParentStat.isDirectory() || !samePhysicalObjectV2(parentStat, pinnedParentStat)) {
      return failV2("Slot-ledger pinned parent descriptor changed before spawn");
    }
    child = spawn(parsed.nativeBinaryPath, [], {
      cwd: "/",
      env: FIXED_ENVIRONMENT_V2,
      shell: false,
      stdio: ["pipe", "pipe", "pipe", parentDescriptor, "pipe"],
      windowsHide: true,
    });
    childMonitor = new ChildOutcomeMonitorV2(child);
    closeSync(parentDescriptor);
    parentDescriptor = undefined;
    stdioErrorListener = (error: Error): void => {
      stdioFailure ??= error;
      child?.kill("SIGKILL");
    };
    stdoutDataListener = (): void => {
      stdoutDirty = true;
      child?.kill("SIGKILL");
    };
    stderrDataListener = (chunk: Buffer | Uint8Array): void => {
      stderrDirty = true;
      const bytes = Buffer.from(chunk);
      if (bytes.byteLength > STDERR_MAX_BYTES_V2 - stderr.byteLength) {
        stderrOverflow = true;
        bytes.fill(0);
        child?.kill("SIGKILL");
        return;
      }
      const combined = Buffer.concat([stderr, bytes]);
      stderr.fill(0);
      bytes.fill(0);
      stderr = combined;
    };
    child.stdin!.on("error", stdioErrorListener);
    child.stdout!.on("error", stdioErrorListener);
    child.stderr!.on("error", stdioErrorListener);
    child.stdout!.on("data", stdoutDataListener);
    child.stderr!.on("data", stderrDataListener);
    const protocol = child.stdio[4];
    if (!(protocol instanceof Duplex)) return failV2("Slot-ledger fd4 protocol is not one Duplex stream");
    reader = new BoundedFrameReaderV2(protocol);
    child.stdin!.end("slot_ledger_live\n");
    const observationDeadline = performance.now() + PROTOCOL_IO_TIMEOUT_MILLISECONDS_V2;
    openFrame = await reader.readFrame(
      1,
      32,
      32,
      observationDeadline,
      "slot-ledger OPEN frame",
    );
    observationFrame = await reader.readFrame(
      2,
      1,
      PLATFORM_RELEASE_BOOTSTRAP_NODE_NATIVE_CONTROLLER_AGGREGATE_MAX_BYTES_V2,
      observationDeadline,
      "slot-ledger OBSERVATION frame",
    );
    const challenge = Buffer.from(openFrame.subarray(5));
    const aggregateBytes = Buffer.from(observationFrame.subarray(5));
    const aggregateCensusHash = sha256HexV2(aggregateBytes);
    const aggregateObservation =
      mapPlatformReleaseBootstrapDarwinAggregateCensusEvidenceStreamV2(
        aggregateBytes,
      );
    const rawOrdered = aggregateObservation.logicalCensus.orderedEntries
      .map((classification, logicalIndex) => ({
        basename: classification.basename,
        basenameBytes: Buffer.from(classification.basename, "utf8"),
        capture: aggregateObservation.physicalCensus.orderedEntryCaptures[logicalIndex],
      }))
      .sort((left, right) => Buffer.compare(left.basenameBytes, right.basenameBytes));
    const rawEntryIndex = rawOrdered.findIndex(
      (entry) => entry.basename === targetBasename,
    );
    if (rawEntryIndex < 0 || rawEntryIndex > 16_383) return failV2("Slot-ledger target entry is absent");
    const expectedCatalog = rawOrdered.map((entry) => {
      if (entry.capture === undefined) return failV2("Slot-ledger raw order has no physical capture");
      return {
        objectKind: entry.capture.objectIdentity.objectKind,
        objectIdentity: entry.capture.objectIdentity,
      } as const;
    });
    const logicalEntryIndex = aggregateObservation.logicalCensus.orderedEntries.findIndex(
      (entry) => entry.basename === targetBasename,
    );
    const sourceCapture = aggregateObservation.physicalCensus.orderedEntryCaptures[logicalEntryIndex];
    if (
      logicalEntryIndex < 0
      || sourceCapture === undefined
      || sourceCapture.objectIdentity.objectKind !== "ordinary_file"
      || sourceCapture.contentEvidence.kind !== "bounded_regular_file_bytes"
    ) return failV2("Slot-ledger target physical capture is absent");
    const sessionOccurrenceHash = hashCanonicalJson({
      schema: "setfarm.platform-release-bootstrap-node-native-controller-session-occurrence-hash.v2",
      challenge: challenge.toString("hex"),
      aggregateEvidenceStreamHash: aggregateCensusHash,
    });
    const sessionSlot = `slot_${sha256HexV2(Buffer.from(`session:${sessionOccurrenceHash}`, "utf8"))}`;
    const captureSlot = `slot_${sha256HexV2(Buffer.from(`capture:${sessionOccurrenceHash}:${rawEntryIndex}`, "utf8"))}`;
    const beginRequestHash = sha256HexV2(
      Buffer.concat([challenge, aggregateBytes, Buffer.from(targetBasename, "utf8")]),
    );
    ledger = beginPlatformReleaseBootstrapDarwinSlotLedgerV2({
      sessionOccurrenceHash,
      aggregateCensusHash,
      challengeHex: challenge.toString("hex"),
      sessionSlot,
      beginRequestHash,
      captureSlot,
      expectedEntryIndex: rawEntryIndex,
      expectedCatalog,
      sourceObjectIdentity: sourceCapture.objectIdentity,
      sourceFingerprint: sourceCapture.fingerprint,
      sourceContentHash: sourceCapture.contentEvidence.rawContentHash,
    });
    catalogFrame = await reader.readFrame(
      SLOT_CATALOG_TYPE_V2,
      4,
      4 + 16_384 * 37,
      observationDeadline,
      "slot-ledger catalog frame",
    );
    const catalogPayload = Buffer.from(catalogFrame.subarray(5));
    try {
      const catalog = issuePlatformReleaseBootstrapDarwinSlotLedgerCatalogV2(
        ledger,
        catalogPayload,
      );
      const targetSlot = catalog.find((record) => record.entryIndex === rawEntryIndex);
      if (!targetSlot || targetSlot.objectKind !== "ordinary_file") return failV2("Slot-ledger target slot is absent");
      const slotBytes = Buffer.from(targetSlot.slot.slice(5), "hex");
      try {
        selectPlatformReleaseBootstrapDarwinSlotLedgerSlotV2(ledger, slotBytes);
        requestFrame = encodeProtocolFrameV2(SLOT_CAPTURE_REQUEST_TYPE_V2, slotBytes);
      } finally {
        slotBytes.fill(0);
      }
    } finally {
      catalogPayload.fill(0);
    }
    const requestDeadline = performance.now() + PROTOCOL_IO_TIMEOUT_MILLISECONDS_V2;
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new TypeError("Slot-ledger request write timed out")), Math.max(1, requestDeadline - performance.now()));
      protocol.write(requestFrame!, (error?: Error | null) => {
        clearTimeout(timeout);
        if (error) reject(error);
        else resolve();
      });
    });
    requestFrame.fill(0);
    requestFrame = undefined;
    const chunkCount = Math.max(1, Math.ceil(sourceCapture.fingerprint.byteLength / SLOT_CONTENT_CHUNK_BYTES_V2));
    for (let index = 0; index < chunkCount * 2; index += 1) {
      const contentFrame = await reader.readFrame(
        SLOT_CONTENT_OBSERVATION_TYPE_V2,
        SLOT_CONTENT_HEADER_BYTES_V2,
        SLOT_CONTENT_HEADER_BYTES_V2 + SLOT_CONTENT_CHUNK_BYTES_V2,
        observationDeadline,
        "slot-ledger content frame",
      );
      const payload = Buffer.from(contentFrame.subarray(5));
      try {
        recordPlatformReleaseBootstrapDarwinSlotLedgerContentV2(ledger, payload);
      } finally {
        payload.fill(0);
        contentFrame.fill(0);
      }
    }
    const slotLedgerReceipt = finalizePlatformReleaseBootstrapDarwinSlotLedgerV2(ledger);
    const semanticAckSha256 = Buffer.from(slotLedgerReceipt.receiptHash, "hex");
    const acknowledgementStarted = performance.now();
    const acknowledgementDeadline = acknowledgementStarted + ACKNOWLEDGEMENT_BUDGET_MILLISECONDS_V2;
    acknowledgement = encodeAcceptAcknowledgementV2(
      challenge,
      Buffer.from(aggregateCensusHash, "hex"),
      semanticAckSha256,
    );
    await endProtocolV2(protocol, acknowledgement, acknowledgementDeadline);
    const acknowledgementElapsedMilliseconds = performance.now() - acknowledgementStarted;
    if (acknowledgementElapsedMilliseconds > ACKNOWLEDGEMENT_BUDGET_MILLISECONDS_V2) return failV2("Slot-ledger acknowledgement exceeded its ACK budget");
    terminalFrame = await reader.readFrame(
      TERMINAL_ACCEPT_TYPE_V2,
      97,
      97,
      performance.now() + PROTOCOL_IO_TIMEOUT_MILLISECONDS_V2,
      "slot-ledger TERMINAL_ACCEPT frame",
    );
    const terminalPayload = terminalFrame.subarray(5);
    if (
      !terminalPayload.subarray(0, 32).equals(challenge)
      || !terminalPayload.subarray(32, 64).equals(Buffer.from(aggregateCensusHash, "hex"))
      || !terminalPayload.subarray(64, 96).equals(semanticAckSha256)
      || terminalPayload[96] !== 1
    ) return failV2("Slot-ledger terminal frame does not echo its exact ACCEPT binding");
    await reader.expectEnd(performance.now() + PROTOCOL_IO_TIMEOUT_MILLISECONDS_V2);
    const outcome = await withinDeadlineV2(
      childMonitor.promise,
      performance.now() + CHILD_REAP_TIMEOUT_MILLISECONDS_V2,
      "slot-ledger child settlement",
    );
    if (
      outcome.spawnError !== null
      || outcome.code !== 0
      || outcome.signal !== null
      || stdoutDirty
      || stderrDirty
      || stderrOverflow
      || stdioFailure !== null
      || stderr.byteLength !== 0
    ) return failV2("Slot-ledger child did not settle cleanly and silently");
    const filesystemScope = aggregateObservation.filesystemScope;
    const sharedPre = observeRegularFileV2(filesystemScope, sharedPreStat);
    const nodePre = observeRegularFileV2(filesystemScope, nodePreStat);
    if (
      !equalObservationV2(sharedPre, aggregateObservation.heldLocks.sharedParentLock)
      || !equalObservationV2(nodePre, aggregateObservation.heldLocks.registeredNodePackageLock)
    ) return failV2("Slot-ledger lock observations do not equal native evidence");
    const lockProbe = spawnSync(
      "/usr/bin/lockf",
      ["-k", "-t", "0", sharedLockPath, "/usr/bin/lockf", "-k", "-t", "0", nodeLockPath, "/usr/bin/true"],
      {
        cwd: "/",
        env: FIXED_ENVIRONMENT_V2,
        shell: false,
        encoding: "buffer",
        maxBuffer: STDERR_MAX_BYTES_V2,
        timeout: LOCK_PROBE_TIMEOUT_MILLISECONDS_V2,
        windowsHide: true,
      },
    );
    if (
      lockProbe.error !== undefined
      || lockProbe.status !== 0
      || lockProbe.signal !== null
      || lockProbe.stdout.byteLength !== 0
      || lockProbe.stderr.byteLength !== 0
    ) return failV2("Slot-ledger paired lock release probe failed");
    return Object.freeze({
      slotLedgerReceipt,
      aggregateCensusHash,
      terminalFrameHash: sha256HexV2(terminalFrame),
      timing: Object.freeze({
        authority: "non_authoritative_test_support_timing_v2" as const,
        acknowledgementBudgetMilliseconds: ACKNOWLEDGEMENT_BUDGET_MILLISECONDS_V2,
        acknowledgementElapsedMilliseconds,
        status: "within_fixture_budget_v2" as const,
      }),
    });
  } catch (error) {
    if (stderrOverflow) return failV2("Slot-ledger child stderr exceeded its exact byte bound", error);
    if (stdoutDirty || stderrDirty) return failV2("Slot-ledger child emitted forbidden output", error);
    if (stdioFailure !== null) return failV2("Slot-ledger child stdio failed", stdioFailure);
    throw error;
  } finally {
    let cleanupFailure: unknown;
    if (parentDescriptor !== undefined) {
      try { closeSync(parentDescriptor); } catch (error) { cleanupFailure ??= error; }
    }
    if (requestFrame !== undefined) requestFrame.fill(0);
    if (ledger !== undefined) {
      try { disposePlatformReleaseBootstrapDarwinSlotLedgerV2(ledger); } catch (error) { cleanupFailure ??= error; }
    }
    try { await killAndReapV2(child, childMonitor); } catch (error) { cleanupFailure ??= error; }
    reader?.dispose();
    if (stdioErrorListener !== undefined) {
      child?.stdin?.off("error", stdioErrorListener);
      child?.stdout?.off("error", stdioErrorListener);
      child?.stderr?.off("error", stdioErrorListener);
    }
    if (stdoutDataListener !== undefined) child?.stdout?.off("data", stdoutDataListener);
    if (stderrDataListener !== undefined) child?.stderr?.off("data", stderrDataListener);
    childMonitor?.dispose();
    openFrame?.fill(0);
    observationFrame?.fill(0);
    catalogFrame?.fill(0);
    terminalFrame?.fill(0);
    acknowledgement?.fill(0);
    stderr.fill(0);
    if (cleanupFailure !== undefined) return failV2("Slot-ledger adapter cleanup or child reap failed", cleanupFailure);
  }
}

/**
 * Test-only recursive semantic live adapter. Native transport remains mechanics
 * authority only; semantic preparation and rejoin remain explicit TypeScript
 * fixture assertions.
 */
export async function runPlatformReleaseBootstrapNodeNativeRecursiveSemanticLiveAdapterTestSupportV2(
  input: Readonly<{ nativeBinaryPath: string; parentPath: string }>,
): Promise<
  PlatformReleaseBootstrapNodeNativeRecursiveSemanticLiveAdapterResultV2
> {
  const parsed = exactInputV2(input);
  const nodePackage = PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.packages.find(
    (entry) => entry.packageRef
      === PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.nodeToolchainProvisioner,
  );
  if (!nodePackage) {
    return failV2("Semantic live adapter Node package contract is absent");
  }
  const sharedLockPath = path.join(
    parsed.parentPath,
    PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.registry.sharedLockBasename,
  );
  const nodeLockPath = path.join(
    parsed.parentPath,
    nodePackage.lifecycle.packageLockBasename,
  );
  const binaryStat = lstatSync(parsed.nativeBinaryPath, { bigint: true });
  const parentStat = lstatSync(parsed.parentPath, { bigint: true });
  const sharedPreStat = lstatSync(sharedLockPath, { bigint: true });
  const nodePreStat = lstatSync(nodeLockPath, { bigint: true });
  if (
    !binaryStat.isFile()
    || binaryStat.nlink !== 1n
    || binaryStat.size < 1n
    || binaryStat.size > BigInt(PINNED_BINARY_MAX_BYTES_V2)
    || !parentStat.isDirectory()
    || canonicalModeV2(parentStat.mode) !== "0755"
    || !sharedPreStat.isFile()
    || !nodePreStat.isFile()
    || sharedPreStat.dev !== parentStat.dev
    || nodePreStat.dev !== parentStat.dev
    || sharedPreStat.uid !== parentStat.uid
    || sharedPreStat.gid !== parentStat.gid
    || nodePreStat.uid !== parentStat.uid
    || nodePreStat.gid !== parentStat.gid
    || canonicalModeV2(sharedPreStat.mode) !== "0600"
    || canonicalModeV2(nodePreStat.mode) !== "0600"
    || sharedPreStat.nlink !== 1n
    || nodePreStat.nlink !== 1n
    || (sharedPreStat.dev === nodePreStat.dev
      && sharedPreStat.ino === nodePreStat.ino)
  ) {
    return failV2(
      "Semantic live adapter pre-observation physical boundary is invalid",
    );
  }

  let parentDescriptor: number | undefined;
  let pinnedParentStat: BigIntStats | undefined;
  let pinnedBinaryDescriptor: number | undefined;
  let pinnedBinaryStat: BigIntStats | undefined;
  let pinnedBinaryDescriptorBinding:
    PlatformReleaseBootstrapNodeNativePinnedBinaryDescriptorBindingV2
    | undefined;
  let child: ChildProcess | undefined;
  let childMonitor: ChildOutcomeMonitorV2 | undefined;
  let probeChild: ChildProcess | undefined;
  let probeChildMonitor: ChildOutcomeMonitorV2 | undefined;
  let reader: BoundedFrameReaderV2 | undefined;
  let openTransportFrame: Buffer | undefined;
  let observationTransportFrame: Buffer | undefined;
  let acknowledgementTransportFrame: Buffer | undefined;
  let terminalTransportFrame: Buffer | undefined;
  let challenge: Buffer | undefined;
  let observationPayload: Buffer | undefined;
  let aggregateSha256: Buffer | undefined;
  let semanticAckSha256: Buffer | undefined;
  let pinnedBinaryPreContentHash: Buffer | undefined;
  let pinnedBinaryPostContentHash: Buffer | undefined;
  let pinnedBinaryFinalContentHash: Buffer | undefined;
  let exactReleaseProbeRawFrame: Buffer | undefined;
  const pinnedBinaryHashScratch = Buffer.alloc(
    PINNED_BINARY_HASH_SCRATCH_BYTES_V2,
  );
  let stderr = Buffer.alloc(0);
  let probeStderr = Buffer.alloc(0);
  let probeStdoutDirty = false;
  let probeStderrOverflow = false;
  let probeStdioFailure: Error | null = null;
  let stdoutDirty = false;
  let stderrDirty = false;
  let stderrOverflow = false;
  let stdioFailure: Error | null = null;
  let stdioErrorListener: ((error: Error) => void) | undefined;
  let stdoutDataListener: (() => void) | undefined;
  let stderrDataListener: ((chunk: Buffer | Uint8Array) => void) | undefined;
  try {
    pinnedBinaryDescriptor = openSync(
      parsed.nativeBinaryPath,
      constants.O_RDONLY | constants.O_NOFOLLOW,
    );
    const pinnedBeforeHashStat = fstatSync(
      pinnedBinaryDescriptor,
      { bigint: true },
    );
    if (
      !pinnedBeforeHashStat.isFile()
      || pinnedBeforeHashStat.nlink !== 1n
      || !samePhysicalObjectV2(binaryStat, pinnedBeforeHashStat)
    ) {
      return failV2(
        "Semantic live pinned binary changed before descriptor hashing",
      );
    }
    pinnedBinaryPreContentHash = hashPinnedBinaryDescriptorV2(
      pinnedBinaryDescriptor,
      safeNumberV2(
        pinnedBeforeHashStat.size,
        PINNED_BINARY_MAX_BYTES_V2,
        "pinned binary pre-hash byte length",
      ),
      pinnedBinaryHashScratch,
    );
    pinnedBinaryStat = fstatSync(pinnedBinaryDescriptor, { bigint: true });
    if (!samePhysicalObjectV2(pinnedBeforeHashStat, pinnedBinaryStat)) {
      return failV2(
        "Semantic live pinned binary changed during descriptor hashing",
      );
    }
    parentDescriptor = openSync(
      parsed.parentPath,
      constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
    );
    pinnedParentStat = fstatSync(parentDescriptor, { bigint: true });
    if (
      !pinnedParentStat.isDirectory()
      || !samePhysicalObjectV2(parentStat, pinnedParentStat)
    ) {
      return failV2(
        "Semantic live adapter pinned parent changed before spawn",
      );
    }
    child = spawn(parsed.nativeBinaryPath, [], {
      cwd: "/",
      env: FIXED_ENVIRONMENT_V2,
      shell: false,
      stdio: [
        "pipe",
        "pipe",
        "pipe",
        parentDescriptor,
        "pipe",
        pinnedBinaryDescriptor,
      ],
      windowsHide: true,
    });
    childMonitor = new ChildOutcomeMonitorV2(child);
    stdioErrorListener = (error: Error): void => {
      stdioFailure ??= error;
      child?.kill("SIGKILL");
    };
    stdoutDataListener = (): void => {
      stdoutDirty = true;
      child?.kill("SIGKILL");
    };
    stderrDataListener = (chunk: Buffer | Uint8Array): void => {
      stderrDirty = true;
      const bytes = Buffer.from(chunk);
      if (bytes.byteLength > STDERR_MAX_BYTES_V2 - stderr.byteLength) {
        stderrOverflow = true;
        bytes.fill(0);
        child?.kill("SIGKILL");
        return;
      }
      const combined = Buffer.concat([stderr, bytes]);
      stderr.fill(0);
      bytes.fill(0);
      stderr = combined;
    };
    child.stdin!.on("error", stdioErrorListener);
    child.stdout!.on("error", stdioErrorListener);
    child.stderr!.on("error", stdioErrorListener);
    child.stdout!.on("data", stdoutDataListener);
    child.stderr!.on("data", stderrDataListener);
    const protocol = child.stdio[4];
    if (!(protocol instanceof Duplex)) {
      return failV2("Semantic live adapter fd4 is not one Duplex stream");
    }
    reader = new BoundedFrameReaderV2(protocol);
    child.stdin!.end("semantic_pinned_live\n");

    const observationDeadline =
      performance.now() + PROTOCOL_IO_TIMEOUT_MILLISECONDS_V2;
    openTransportFrame = await reader.readFrame(
      PLATFORM_RELEASE_BOOTSTRAP_NODE_NATIVE_CONTROLLER_OPEN_TYPE_V2,
      32,
      32,
      observationDeadline,
      "semantic OPEN frame",
    );
    observationTransportFrame = await reader.readFrame(
      PLATFORM_RELEASE_BOOTSTRAP_NODE_NATIVE_CONTROLLER_OBSERVATION_TYPE_V2,
      1,
      PLATFORM_RELEASE_BOOTSTRAP_NODE_NATIVE_CONTROLLER_AGGREGATE_MAX_BYTES_V2,
      observationDeadline,
      "semantic OBSERVATION frame",
    );
    challenge = Buffer.from(openTransportFrame.subarray(FRAME_OVERHEAD_BYTES_V2));
    observationPayload = Buffer.from(
      observationTransportFrame.subarray(FRAME_OVERHEAD_BYTES_V2),
    );
    aggregateSha256 = createHash("sha256").update(observationPayload).digest();

    const acknowledgementStarted = performance.now();
    const acknowledgementDeadline =
      acknowledgementStarted + ACKNOWLEDGEMENT_BUDGET_MILLISECONDS_V2;
    const preparation =
      preparePlatformReleaseBootstrapNodeRecursiveSemanticBridgeFixtureV2({
        challenge,
        aggregateRecursiveEvidenceStream: observationPayload,
      });
    const aggregate = preparation.mapping.aggregateObservation;
    const filesystemScope = aggregate.filesystemScope;
    if (
      aggregate.physicalCensus.filesystemScopeIdentityHash
        !== filesystemScope.scopeIdentityHash
    ) {
      return failV2(
        "Semantic live global census filesystem scope join is invalid",
      );
    }
    pinnedBinaryDescriptorBinding = buildPinnedBinaryDescriptorBindingV2(
      filesystemScope,
      pinnedBinaryStat,
      pinnedBinaryPreContentHash,
    );
    if (
      pinnedBinaryDescriptorBinding.filesystemScopeIdentityHash
        !== aggregate.physicalCensus.filesystemScopeIdentityHash
      || pinnedBinaryDescriptorBinding.objectIdentity
        .filesystemScopeIdentityHash
        !== aggregate.physicalCensus.filesystemScopeIdentityHash
      || pinnedBinaryDescriptorBinding.fingerprint.objectIdentityHash
        !== pinnedBinaryDescriptorBinding.objectIdentity.objectIdentityHash
      || pinnedBinaryDescriptorBinding.contentEvidence.objectIdentityHash
        !== pinnedBinaryDescriptorBinding.objectIdentity.objectIdentityHash
      || pinnedBinaryDescriptorBinding.contentEvidence.fingerprintHash
        !== pinnedBinaryDescriptorBinding.fingerprint.fingerprintHash
    ) {
      return failV2(
        "Semantic live pinned binary binding does not join global census scope",
      );
    }
    if (
      preparation.mapping.rawStreamHash !== aggregateSha256.toString("hex")
      || preparation.semanticAckSha256
        !== preparation.acknowledgement.frameHash
    ) {
      return failV2(
        "Semantic live preparation does not bind native aggregate or ACK hash",
      );
    }
    semanticAckSha256 = Buffer.from(
      preparation.semanticAckSha256,
      "hex",
    );
    if (
      semanticAckSha256.byteLength !== 32
      || semanticAckSha256.toString("hex")
        !== preparation.semanticAckSha256
    ) {
      return failV2("Semantic live ACK hash is not canonical SHA-256");
    }
    acknowledgementTransportFrame = encodeAcceptAcknowledgementV2(
      challenge,
      aggregateSha256,
      semanticAckSha256,
    );
    if (performance.now() >= acknowledgementDeadline) {
      return failV2("Semantic live preparation exceeded its ACK budget");
    }
    await endProtocolV2(
      protocol,
      acknowledgementTransportFrame,
      acknowledgementDeadline,
    );
    const acknowledgementElapsedMilliseconds =
      performance.now() - acknowledgementStarted;
    if (
      acknowledgementElapsedMilliseconds
        > ACKNOWLEDGEMENT_BUDGET_MILLISECONDS_V2
    ) {
      return failV2("Semantic live acknowledgement exceeded its ACK budget");
    }

    const terminalDeadline =
      performance.now() + PROTOCOL_IO_TIMEOUT_MILLISECONDS_V2;
    terminalTransportFrame = await reader.readFrame(
      TERMINAL_ACCEPT_TYPE_V2,
      TERMINAL_PAYLOAD_BYTES_V2,
      TERMINAL_PAYLOAD_BYTES_V2,
      terminalDeadline,
      "TERMINAL_ACCEPT frame",
    );
    if (
      !terminalTransportFrame.subarray(5, 37).equals(challenge)
      || !terminalTransportFrame.subarray(37, 69).equals(aggregateSha256)
      || !terminalTransportFrame.subarray(69, 101).equals(semanticAckSha256)
      || terminalTransportFrame[101] !== 1
    ) {
      return failV2(
        "Semantic live terminal does not echo its exact commitment authority",
      );
    }
    await reader.expectEnd(terminalDeadline);
    const outcome = await withinDeadlineV2(
      childMonitor.promise,
      terminalDeadline,
      "semantic clean child settlement",
    );
    if (
      outcome.spawnError !== null
      || outcome.code !== 0
      || outcome.signal !== null
      || stdoutDirty
      || stderrDirty
      || stderrOverflow
      || stdioFailure !== null
      || stderr.byteLength !== 0
    ) {
      return failV2(
        "Semantic live child did not settle cleanly and silently",
      );
    }

    if (
      pinnedBinaryDescriptor === undefined
      || pinnedBinaryStat === undefined
      || pinnedBinaryDescriptorBinding === undefined
      || pinnedBinaryPreContentHash === undefined
    ) {
      return failV2(
        "Semantic live pinned binary descriptor state is incomplete",
      );
    }
    const pinnedAfterSettlementBeforeHashStat = fstatSync(
      pinnedBinaryDescriptor,
      { bigint: true },
    );
    if (
      !samePhysicalObjectV2(
        pinnedBinaryStat,
        pinnedAfterSettlementBeforeHashStat,
      )
    ) {
      return failV2(
        "Semantic live pinned binary changed before post-settlement hashing",
      );
    }
    pinnedBinaryPostContentHash = hashPinnedBinaryDescriptorV2(
      pinnedBinaryDescriptor,
      safeNumberV2(
        pinnedAfterSettlementBeforeHashStat.size,
        PINNED_BINARY_MAX_BYTES_V2,
        "pinned binary post-settlement byte length",
      ),
      pinnedBinaryHashScratch,
    );
    const pinnedAfterSettlementAfterHashStat = fstatSync(
      pinnedBinaryDescriptor,
      { bigint: true },
    );
    if (
      !samePhysicalObjectV2(
        pinnedAfterSettlementBeforeHashStat,
        pinnedAfterSettlementAfterHashStat,
      )
      || !pinnedBinaryPostContentHash.equals(pinnedBinaryPreContentHash)
    ) {
      return failV2(
        "Semantic live pinned binary changed during live settlement",
      );
    }
    const postSettlementPinnedBinaryDescriptorBinding =
      buildPinnedBinaryDescriptorBindingV2(
        filesystemScope,
        pinnedAfterSettlementAfterHashStat,
        pinnedBinaryPostContentHash,
      );
    if (
      canonicalJsonStringify(postSettlementPinnedBinaryDescriptorBinding)
        !== canonicalJsonStringify(pinnedBinaryDescriptorBinding)
    ) {
      return failV2(
        "Semantic live pinned binary binding changed across live settlement",
      );
    }

    const sharedPre = observeRegularFileV2(filesystemScope, sharedPreStat);
    const nodePre = observeRegularFileV2(filesystemScope, nodePreStat);
    if (
      !equalObservationV2(sharedPre, aggregate.heldLocks.sharedParentLock)
      || !equalObservationV2(
        nodePre,
        aggregate.heldLocks.registeredNodePackageLock,
      )
    ) {
      return failV2(
        "Semantic live pre-lock observations do not rejoin mapped locks",
      );
    }
    const parentPostStat = lstatSync(parsed.parentPath, { bigint: true });
    const pinnedParentPostSemanticStat = fstatSync(
      parentDescriptor,
      { bigint: true },
    );
    const sharedPost = observeRegularFileV2(
      filesystemScope,
      lstatSync(sharedLockPath, { bigint: true }),
    );
    const nodePost = observeRegularFileV2(
      filesystemScope,
      lstatSync(nodeLockPath, { bigint: true }),
    );
    if (
      !samePhysicalObjectV2(parentStat, parentPostStat)
      || !samePhysicalObjectV2(pinnedParentStat, pinnedParentPostSemanticStat)
      || !equalObservationV2(sharedPre, sharedPost)
      || !equalObservationV2(nodePre, nodePost)
    ) {
      return failV2(
        "Semantic live identities changed before release probe",
      );
    }

    probeChild = spawn(parsed.nativeBinaryPath, [], {
      cwd: "/",
      env: FIXED_ENVIRONMENT_V2,
      shell: false,
      stdio: [
        "pipe",
        "pipe",
        "pipe",
        parentDescriptor,
        "pipe",
        pinnedBinaryDescriptor,
      ],
      windowsHide: true,
    });
    probeChildMonitor = new ChildOutcomeMonitorV2(probeChild);
    const probeDeadline =
      performance.now() + PROTOCOL_IO_TIMEOUT_MILLISECONDS_V2;
    const probeProtocol = probeChild.stdio[4];
    if (!(probeProtocol instanceof Duplex)) {
      return failV2("Exact release probe fd4 is not one owned Duplex stream");
    }
    const onProbeStdioError = (error: Error): void => {
      probeStdioFailure ??= error;
      probeChild?.kill("SIGKILL");
    };
    probeChild.stdin!.on("error", onProbeStdioError);
    probeChild.stdout!.on("error", onProbeStdioError);
    probeChild.stderr!.on("error", onProbeStdioError);
    probeChild.stdout!.on("data", () => {
      probeStdoutDirty = true;
      probeChild?.kill("SIGKILL");
    });
    probeChild.stderr!.on("data", (chunk: Buffer | Uint8Array) => {
      const bytes = Buffer.from(chunk);
      if (bytes.byteLength > STDERR_MAX_BYTES_V2 - probeStderr.byteLength) {
        probeStderrOverflow = true;
        bytes.fill(0);
        probeChild?.kill("SIGKILL");
        return;
      }
      const combined = Buffer.concat([probeStderr, bytes]);
      probeStderr.fill(0);
      bytes.fill(0);
      probeStderr = combined;
    });
    const probeRawFramePromise = readOwnedBoundedStreamToEndV2(
      probeProtocol,
      EXACT_RELEASE_PROBE_MAX_BYTES_V2,
      probeDeadline,
      "exact release probe fd4 frame",
    );
    probeChild.stdin!.end("exact_release_probe_v2\n");
    exactReleaseProbeRawFrame = await probeRawFramePromise;
    const probeOutcome = await withinDeadlineV2(
      probeChildMonitor.promise,
      probeDeadline,
      "exact release probe child settlement",
    );
    if (
      probeOutcome.spawnError !== null
      || probeOutcome.code !== 0
      || probeOutcome.signal !== null
      || probeStdoutDirty
      || probeStderrOverflow
      || probeStdioFailure !== null
      || probeStderr.byteLength !== 0
      || exactReleaseProbeRawFrame.byteLength === 0
    ) {
      return failV2(
        "Exact release probe child did not settle cleanly and silently",
      );
    }
    const parentFinalStat = lstatSync(parsed.parentPath, { bigint: true });
    const pinnedParentFinalStat = fstatSync(
      parentDescriptor,
      { bigint: true },
    );
    const sharedFinal = observeRegularFileV2(
      filesystemScope,
      lstatSync(sharedLockPath, { bigint: true }),
    );
    const nodeFinal = observeRegularFileV2(
      filesystemScope,
      lstatSync(nodeLockPath, { bigint: true }),
    );
    if (
      !samePhysicalObjectV2(parentStat, parentFinalStat)
      || !samePhysicalObjectV2(pinnedParentStat, pinnedParentFinalStat)
      || !equalObservationV2(sharedPre, sharedFinal)
      || !equalObservationV2(nodePre, nodeFinal)
    ) {
      return failV2(
        "Semantic live identities changed across release probe",
      );
    }

    const pinnedBeforeFinalHashStat = fstatSync(
      pinnedBinaryDescriptor,
      { bigint: true },
    );
    if (!samePhysicalObjectV2(pinnedBinaryStat, pinnedBeforeFinalHashStat)) {
      return failV2(
        "Semantic live pinned binary changed before final probe hashing",
      );
    }
    pinnedBinaryFinalContentHash = hashPinnedBinaryDescriptorV2(
      pinnedBinaryDescriptor,
      safeNumberV2(
        pinnedBeforeFinalHashStat.size,
        PINNED_BINARY_MAX_BYTES_V2,
        "pinned binary final byte length",
      ),
      pinnedBinaryHashScratch,
    );
    const pinnedAfterFinalHashStat = fstatSync(
      pinnedBinaryDescriptor,
      { bigint: true },
    );
    if (
      !samePhysicalObjectV2(pinnedBeforeFinalHashStat, pinnedAfterFinalHashStat)
      || !pinnedBinaryFinalContentHash.equals(pinnedBinaryPreContentHash)
    ) {
      return failV2(
        "Semantic live pinned binary changed across exact release probe",
      );
    }

    const close = buildNodeLiveObservationSessionCloseFrameV2(
      preparation.observation,
      preparation.acknowledgement,
      true,
    );
    const exactReleaseProbeReceipt =
      buildPlatformReleaseBootstrapNodeNativeExactReleaseProbeFixtureV2({
        rawFrameBytes: exactReleaseProbeRawFrame,
        filesystemScope,
        globalPhysicalCensusHash:
          aggregate.physicalCensus.physicalCensusHash,
        semanticSessionOccurrenceHash:
          preparation.open.sessionOccurrenceHash,
        finalTranscriptHash: close.finalTranscriptHash,
        pinnedBinaryDescriptorBindingHash:
          pinnedBinaryDescriptorBinding.descriptorBindingHash,
        expectedParent: {
          objectIdentity: aggregate.physicalCensus.parentObjectIdentity,
          fingerprint: aggregate.physicalCensus.parentFingerprint,
        },
        expectedSharedParentLock: sharedFinal,
        expectedRegisteredNodePackageLock: nodeFinal,
      });
    const releaseProbeHash =
      exactReleaseProbeReceipt.exactReleaseProbeReceiptHash;
    const session = parseNodeLiveObservationSessionCandidateV2({
      schema: "setfarm.platform-release-bootstrap-node-live-observation-session.v2",
      version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
      open: preparation.open,
      observation: preparation.observation,
      acknowledgement: preparation.acknowledgement,
      close,
    });
    const semanticJoinReceipt =
      joinNodeLiveObservationSessionToSemanticSnapshotV2(
        session,
        preparation.semanticSnapshot,
      );
    verifyNodeLiveObservationSemanticJoinReceiptV2(
      semanticJoinReceipt,
      session,
      preparation.semanticSnapshot,
    );
    const receiptIdentity = {
      schema: SEMANTIC_LIVE_ADAPTER_RECEIPT_SCHEMA_V2,
      version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
      admissionScope: "test_fixture" as const,
      productionAuthority: false as const,
      preparationHash: preparation.preparationHash,
      semanticJoinHash: semanticJoinReceipt.joinHash,
      semanticSnapshotHash: preparation.semanticSnapshot.snapshotHash,
      semanticVerifierContractHash:
        preparation.semanticSnapshot.semanticVerifierContractHash,
      semanticStatus: "ready" as const,
      sessionOccurrenceHash: preparation.open.sessionOccurrenceHash,
      observationTranscriptHash: preparation.observation.transcriptHash,
      finalTranscriptHash: close.finalTranscriptHash,
      rawStreamHash: preparation.mapping.rawStreamHash,
      globalPhysicalCensusHash:
        aggregate.physicalCensus.physicalCensusHash,
      globalPhysicalCensusFilesystemScopeIdentityHash:
        aggregate.physicalCensus.filesystemScopeIdentityHash,
      nodePhysicalProjectionHash:
        aggregate.nodePhysicalProjection.projectionHash,
      nodeRecursiveEvidenceHash:
        preparation.observation.nodeRecursiveEvidence.evidenceHash,
      openTransportFrameHash: sha256HexV2(openTransportFrame),
      observationTransportFrameHash: sha256HexV2(observationTransportFrame),
      acknowledgementTransportFrameHash:
        sha256HexV2(acknowledgementTransportFrame),
      terminalTransportFrameHash: sha256HexV2(terminalTransportFrame),
      semanticAckSha256: preparation.semanticAckSha256,
      releaseProbeHash,
      sharedParentLockObjectIdentityHash:
        sharedFinal.objectIdentity.objectIdentityHash,
      registeredNodePackageLockObjectIdentityHash:
        nodeFinal.objectIdentity.objectIdentityHash,
      pinnedBinaryDescriptorBinding,
      serializedAuthority:
        "self_asserted_replay_never_live_authority" as const,
      binaryExecutionAuthority:
        "pinned_descriptor_to_running_mapped_vnode_exact_object_observed_test_fixture" as const,
      signingAuthority: "adhoc_or_unsigned_test_fixture" as const,
      signatureAndAmfiAuthority: "unavailable_test_fixture" as const,
      descriptorRelativeReleaseProbeAuthority:
        "native_external_pid_descriptor_relative_exact_object_f_tlock_fixture_v2" as const,
      nativeSemanticParsingStatus:
        "native_semantic_parsing_absent_ts_bridge_required" as const,
      terminalStatus:
        "terminal_accept_echo_authority_observed" as const,
      protocolEofStatus: "protocol_eof_observed" as const,
      processExitStatus: "exit_zero_silent_observed" as const,
    } satisfies SemanticLiveAdapterReceiptIdentityV2;
    const semanticLiveAdapterReceipt = {
      ...receiptIdentity,
      semanticLiveAdapterReceiptHash:
        hashPlatformReleaseBootstrapNodeNativeRecursiveSemanticLiveAdapterReceiptV2(
          receiptIdentity,
        ),
    };
    return deepFreezePlatformReleaseJsonV2({
      preparation,
      session,
      semanticJoinReceipt,
      semanticLiveAdapterReceipt,
      timing: {
        authority: "non_authoritative_test_support_timing_v2" as const,
        acknowledgementBudgetMilliseconds:
          ACKNOWLEDGEMENT_BUDGET_MILLISECONDS_V2,
        acknowledgementElapsedMilliseconds,
        status: "within_fixture_budget_v2" as const,
      },
    });
  } catch (error) {
    if (stderrOverflow) {
      return failV2(
        "Semantic live adapter stderr exceeded its exact byte bound",
        error,
      );
    }
    if (stdoutDirty || stderrDirty) {
      return failV2("Semantic live adapter child emitted forbidden output", error);
    }
    if (stdioFailure !== null) {
      return failV2("Semantic live adapter child stdio failed", stdioFailure);
    }
    throw error;
  } finally {
    let cleanupFailure: unknown;
    try {
      await killAndReapV2(probeChild, probeChildMonitor);
    } catch (error) {
      cleanupFailure ??= error;
    }
    try {
      await killAndReapV2(child, childMonitor);
    } catch (error) {
      cleanupFailure ??= error;
    }
    if (parentDescriptor !== undefined) {
      try {
        closeSync(parentDescriptor);
      } catch (error) {
        cleanupFailure ??= error;
      }
    }
    if (pinnedBinaryDescriptor !== undefined) {
      try {
        closeSync(pinnedBinaryDescriptor);
      } catch (error) {
        cleanupFailure ??= error;
      }
    }
    reader?.dispose();
    if (stdioErrorListener !== undefined) {
      child?.stdin?.off("error", stdioErrorListener);
      child?.stdout?.off("error", stdioErrorListener);
      child?.stderr?.off("error", stdioErrorListener);
    }
    if (stdoutDataListener !== undefined) {
      child?.stdout?.off("data", stdoutDataListener);
    }
    if (stderrDataListener !== undefined) {
      child?.stderr?.off("data", stderrDataListener);
    }
    childMonitor?.dispose();
    probeChildMonitor?.dispose();
    openTransportFrame?.fill(0);
    observationTransportFrame?.fill(0);
    acknowledgementTransportFrame?.fill(0);
    terminalTransportFrame?.fill(0);
    challenge?.fill(0);
    observationPayload?.fill(0);
    aggregateSha256?.fill(0);
    semanticAckSha256?.fill(0);
    pinnedBinaryPreContentHash?.fill(0);
    pinnedBinaryPostContentHash?.fill(0);
    pinnedBinaryFinalContentHash?.fill(0);
    exactReleaseProbeRawFrame?.fill(0);
    pinnedBinaryHashScratch.fill(0);
    stderr.fill(0);
    probeStderr.fill(0);
    if (cleanupFailure !== undefined) {
      return failV2(
        "Semantic live adapter cleanup or child reap failed",
        cleanupFailure,
      );
    }
  }
}
