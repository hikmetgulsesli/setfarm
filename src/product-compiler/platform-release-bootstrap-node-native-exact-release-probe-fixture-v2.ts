import { createHash } from "node:crypto";
import { types as nodeUtilTypes } from "node:util";

import {
  PLATFORM_RELEASE_COMPONENT_VERSION_V2,
  deepFreezePlatformReleaseJsonV2,
} from "../execution/schemas/platform-release-common-v2.js";
import { canonicalJsonStringify, hashCanonicalJson } from "./canonical-json.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_PHYSICAL_OWNER_ID_MAX_V2,
  buildFsObservationFingerprintV2,
  buildStableFsObjectIdentityV2,
  parseBootstrapFilesystemScopeIdentityCandidateV2,
  parseFsObservationFingerprintCandidateV2,
  parseStableFsObjectIdentityCandidateV2,
  type BootstrapFilesystemScopeIdentityV2,
  type FsObservationFingerprintV2,
  type StableFsObjectIdentityV2,
} from "./platform-release-bootstrap-physical-census-v2.js";

const RAW_FRAME_MAX_BYTES_V2 = 16 * 1024;
const FRAME_SCHEMA_V2 =
  "setfarm.platform-release-bootstrap-node-native-exact-release-probe-frame.v2" as const;
const RECEIPT_SCHEMA_V2 =
  "setfarm.platform-release-bootstrap-node-native-exact-release-probe-receipt.v2" as const;
const RECEIPT_HASH_DOMAIN_V2 =
  "setfarm.platform-release-bootstrap-node-native-exact-release-probe-receipt-hash.v2" as const;
const OCCURRENCE_HASH_DOMAIN_V2 =
  "setfarm.platform-release-bootstrap-node-native-exact-release-probe-occurrence-hash.v2" as const;
const LOCK_OUTCOME_V2 =
  "exclusive_nonblocking_lock_acquired_then_released" as const;
const CONTENT_STATUS_V2 = "exact_fixed_bytes_and_eof" as const;
const ACQUISITION_ORDER_V2 = [
  "shared_parent_lock",
  "registered_node_package_lock",
] as const;
const RELEASE_ORDER_V2 = [
  "registered_node_package_lock",
  "shared_parent_lock",
] as const;

type JsonRecordV2 = Record<string, unknown>;

type PhysicalObservationV2 = Readonly<{
  objectIdentity: StableFsObjectIdentityV2;
  fingerprint: FsObservationFingerprintV2;
}>;

type NativeStableV2 = Readonly<{
  objectKind: "ordinary_file" | "directory";
  device: string;
  inode: string;
}>;

type NativeMutableV2 = Readonly<{
  ownerUid: number;
  ownerGid: number;
  mode: string;
  linkCount: number;
  byteLength: number;
  modifiedTimeNanoseconds: string;
  changedTimeNanoseconds: string;
}>;

type NativeObservationV2 = Readonly<{
  stable: NativeStableV2;
  mutable: NativeMutableV2;
}>;

export type PlatformReleaseBootstrapNodeNativeExactReleaseProbeReceiptIdentityV2 =
  Readonly<{
    schema: typeof RECEIPT_SCHEMA_V2;
    version: typeof PLATFORM_RELEASE_COMPONENT_VERSION_V2;
    admissionScope: "test_fixture";
    productionAuthority: false;
    descriptorRelativeReleaseProbeAuthority:
      "native_external_pid_descriptor_relative_exact_object_f_tlock_fixture_v2";
    serializedAuthority: "self_asserted_replay_never_live_authority";
    semanticSessionOccurrenceHash: string;
    finalTranscriptHash: string;
    pinnedBinaryDescriptorBindingHash: string;
    filesystemScopeIdentityHash: string;
    globalPhysicalCensusHash: string;
    probeOccurrenceHash: string;
    rawFrameHash: string;
    challengeBase64: string;
    parent: PhysicalObservationV2;
    sharedParentLock: PhysicalObservationV2 & Readonly<{
      contentStatus: typeof CONTENT_STATUS_V2;
      outcome: typeof LOCK_OUTCOME_V2;
    }>;
    registeredNodePackageLock: PhysicalObservationV2 & Readonly<{
      contentStatus: typeof CONTENT_STATUS_V2;
      outcome: typeof LOCK_OUTCOME_V2;
    }>;
    acquisitionOrder: typeof ACQUISITION_ORDER_V2;
    releaseOrder: typeof RELEASE_ORDER_V2;
    transportStatus: "caller_asserted_owned_bounded_fd4_frame_and_eof";
    processExitStatus: "caller_asserted_exit_zero_silent";
  }>;

export type PlatformReleaseBootstrapNodeNativeExactReleaseProbeReceiptV2 =
  PlatformReleaseBootstrapNodeNativeExactReleaseProbeReceiptIdentityV2
  & Readonly<{ exactReleaseProbeReceiptHash: string }>;

export type PlatformReleaseBootstrapNodeNativeExactReleaseProbeFixtureInputV2 =
  Readonly<{
    rawFrameBytes: Uint8Array;
    filesystemScope: BootstrapFilesystemScopeIdentityV2;
    globalPhysicalCensusHash: string;
    semanticSessionOccurrenceHash: string;
    finalTranscriptHash: string;
    pinnedBinaryDescriptorBindingHash: string;
    expectedParent: PhysicalObservationV2;
    expectedSharedParentLock: PhysicalObservationV2;
    expectedRegisteredNodePackageLock: PhysicalObservationV2;
  }>;

function failV2(message: string, cause?: unknown): never {
  throw new TypeError(message, cause === undefined ? {} : { cause });
}

const typedArrayByteLengthGetterV2 = (() => {
  const getter = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(Uint8Array.prototype) as object,
    "byteLength",
  )?.get;
  if (getter === undefined) {
    throw new Error("Typed-array byteLength intrinsic is unavailable");
  }
  return getter;
})();
const typedArraySetV2 = Uint8Array.prototype.set;

function exactDataSnapshotV2(
  value: unknown,
  keys: readonly string[],
  label: string,
): JsonRecordV2 {
  if (
    typeof value !== "object"
    || value === null
    || nodeUtilTypes.isProxy(value)
    || Array.isArray(value)
    || Object.getPrototypeOf(value) !== Object.prototype
  ) {
    return failV2(`${label} is not one exact non-proxy plain object`);
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const actual = Reflect.ownKeys(descriptors);
  if (
    actual.length !== keys.length
    || actual.some((key) => typeof key !== "string" || !keys.includes(key))
  ) {
    return failV2(`${label} membership is invalid`);
  }
  const snapshot: JsonRecordV2 = {};
  for (const key of keys) {
    const descriptor = descriptors[key];
    if (
      descriptor === undefined
      || !("value" in descriptor)
      || descriptor.enumerable !== true
    ) {
      return failV2(`${label}.${key} is not one enumerable data property`);
    }
    snapshot[key] = descriptor.value;
  }
  return snapshot;
}

function ownedRawSnapshotV2(value: unknown): Buffer {
  if (
    typeof value !== "object"
    || value === null
    || nodeUtilTypes.isProxy(value)
    || !nodeUtilTypes.isUint8Array(value)
  ) {
    return failV2(
      "Exact release probe raw frame must be one non-proxy Buffer or Uint8Array",
    );
  }
  const length = Reflect.apply(
    typedArrayByteLengthGetterV2,
    value,
    [],
  ) as number;
  if (length < 2 || length > RAW_FRAME_MAX_BYTES_V2) {
    return failV2("Exact release probe frame violates its byte bound");
  }
  const owned = new Uint8Array(length);
  Reflect.apply(typedArraySetV2, owned, [value]);
  return Buffer.from(owned.buffer, owned.byteOffset, owned.byteLength);
}

function physicalObservationSnapshotV2(
  value: unknown,
  label: string,
): PhysicalObservationV2 {
  const observation = exactDataSnapshotV2(
    value,
    ["objectIdentity", "fingerprint"],
    label,
  );
  const identity = parseStableFsObjectIdentityCandidateV2(
    exactDataSnapshotV2(
      observation.objectIdentity,
      [
        "schema",
        "version",
        "filesystemScopeIdentityHash",
        "objectKind",
        "device",
        "inode",
        "objectIdentityHash",
      ],
      `${label}.objectIdentity`,
    ),
  );
  const fingerprint = parseFsObservationFingerprintCandidateV2(
    exactDataSnapshotV2(
      observation.fingerprint,
      [
        "schema",
        "version",
        "objectIdentityHash",
        "ownerUid",
        "ownerGid",
        "mode",
        "linkCount",
        "byteLength",
        "modifiedTimeNanoseconds",
        "changedTimeNanoseconds",
        "fingerprintHash",
      ],
      `${label}.fingerprint`,
    ),
  );
  if (fingerprint.objectIdentityHash !== identity.objectIdentityHash) {
    return failV2(`${label} identity/fingerprint join is invalid`);
  }
  return deepFreezePlatformReleaseJsonV2({
    objectIdentity: identity,
    fingerprint,
  });
}

function exactRecordV2(
  value: unknown,
  keys: readonly string[],
  label: string,
): JsonRecordV2 {
  if (
    typeof value !== "object"
    || value === null
    || Array.isArray(value)
    || Object.getPrototypeOf(value) !== Object.prototype
    || Reflect.ownKeys(value).some((key) => typeof key !== "string")
  ) {
    return failV2(`${label} is not one exact plain object`);
  }
  const actual = Object.keys(value);
  if (
    actual.length !== keys.length
    || actual.some((key, index) => key !== keys[index])
  ) {
    return failV2(`${label} key order or membership is invalid`);
  }
  return value as JsonRecordV2;
}

function exactStringV2(value: unknown, expected: string, label: string): string {
  if (value !== expected) return failV2(`${label} is invalid`);
  return expected;
}

function sha256V2(value: unknown, label: string): string {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/u.test(value)) {
    return failV2(`${label} is not canonical SHA-256`);
  }
  return value;
}

function unsignedDecimalV2(value: unknown, label: string): string {
  if (typeof value !== "string" || !/^(?:0|[1-9][0-9]*)$/u.test(value)) {
    return failV2(`${label} is not one canonical unsigned decimal`);
  }
  return value;
}

function signedDecimalV2(value: unknown, label: string): string {
  if (typeof value !== "string" || !/^(?:0|-?[1-9][0-9]*)$/u.test(value)) {
    return failV2(`${label} is not one canonical signed decimal`);
  }
  return value;
}

function safeIntegerV2(
  value: unknown,
  minimum: number,
  maximum: number,
  label: string,
): number {
  if (
    typeof value !== "number"
    || !Number.isSafeInteger(value)
    || value < minimum
    || value > maximum
  ) {
    return failV2(`${label} is outside its exact integer bound`);
  }
  return value;
}

function timestampV2(seconds: unknown, nanos: unknown, label: string): string {
  const secondValue = BigInt(signedDecimalV2(seconds, `${label} seconds`));
  const nanoValue = BigInt(unsignedDecimalV2(nanos, `${label} nanoseconds`));
  if (nanoValue >= 1_000_000_000n) {
    return failV2(`${label} fractional nanoseconds are invalid`);
  }
  const total = secondValue * 1_000_000_000n + nanoValue;
  if (total < 0n) return failV2(`${label} is negative`);
  return total.toString(10);
}

function nativeObservationV2(value: unknown, label: string): NativeObservationV2 {
  const observation = exactRecordV2(value, ["stable", "mutable"], label);
  const stable = exactRecordV2(
    observation.stable,
    ["objectKind", "device", "inode"],
    `${label} stable identity`,
  );
  if (
    stable.objectKind !== "ordinary_file"
    && stable.objectKind !== "directory"
  ) {
    return failV2(`${label} object kind is invalid`);
  }
  const mutable = exactRecordV2(
    observation.mutable,
    [
      "ownerUid",
      "ownerGid",
      "mode",
      "linkCount",
      "byteLength",
      "modifiedSeconds",
      "modifiedNanoseconds",
      "changedSeconds",
      "changedNanoseconds",
    ],
    `${label} mutable fingerprint`,
  );
  if (typeof mutable.mode !== "string" || !/^0[0-7]{3}$/u.test(mutable.mode)) {
    return failV2(`${label} mode is invalid`);
  }
  return Object.freeze({
    stable: Object.freeze({
      objectKind: stable.objectKind,
      device: unsignedDecimalV2(stable.device, `${label} device`),
      inode: unsignedDecimalV2(stable.inode, `${label} inode`),
    }),
    mutable: Object.freeze({
      ownerUid: safeIntegerV2(
        mutable.ownerUid,
        0,
        PLATFORM_RELEASE_BOOTSTRAP_PHYSICAL_OWNER_ID_MAX_V2,
        `${label} owner UID`,
      ),
      ownerGid: safeIntegerV2(
        mutable.ownerGid,
        0,
        PLATFORM_RELEASE_BOOTSTRAP_PHYSICAL_OWNER_ID_MAX_V2,
        `${label} owner GID`,
      ),
      mode: mutable.mode,
      linkCount: safeIntegerV2(
        mutable.linkCount, 1, Number.MAX_SAFE_INTEGER, `${label} link count`,
      ),
      byteLength: safeIntegerV2(
        mutable.byteLength, 0, Number.MAX_SAFE_INTEGER, `${label} byte length`,
      ),
      modifiedTimeNanoseconds: timestampV2(
        mutable.modifiedSeconds,
        mutable.modifiedNanoseconds,
        `${label} modified time`,
      ),
      changedTimeNanoseconds: timestampV2(
        mutable.changedSeconds,
        mutable.changedNanoseconds,
        `${label} changed time`,
      ),
    }),
  });
}

function observationV2(
  native: NativeObservationV2,
  filesystemScope: BootstrapFilesystemScopeIdentityV2,
): PhysicalObservationV2 {
  const objectIdentity = buildStableFsObjectIdentityV2({
    filesystemScope,
    objectKind: native.stable.objectKind,
    device: native.stable.device,
    inode: native.stable.inode,
  });
  return deepFreezePlatformReleaseJsonV2({
    objectIdentity,
    fingerprint: buildFsObservationFingerprintV2({
      objectIdentity,
      ...native.mutable,
    }),
  });
}

function equalV2(left: unknown, right: unknown): boolean {
  return canonicalJsonStringify(left) === canonicalJsonStringify(right);
}

function exactOrderV2(
  value: unknown,
  expected: readonly string[],
  label: string,
): void {
  if (
    !Array.isArray(value)
    || value.length !== expected.length
    || value.some((entry, index) => entry !== expected[index])
  ) {
    return failV2(`${label} is invalid`);
  }
}

export function hashPlatformReleaseBootstrapNodeNativeExactReleaseProbeReceiptV2(
  value: PlatformReleaseBootstrapNodeNativeExactReleaseProbeReceiptIdentityV2,
): string {
  return hashCanonicalJson({ schema: RECEIPT_HASH_DOMAIN_V2, receipt: value });
}

export function buildPlatformReleaseBootstrapNodeNativeExactReleaseProbeFixtureV2(
  input: PlatformReleaseBootstrapNodeNativeExactReleaseProbeFixtureInputV2,
): PlatformReleaseBootstrapNodeNativeExactReleaseProbeReceiptV2 {
  const inputSnapshot = exactDataSnapshotV2(
    input,
    [
      "rawFrameBytes",
      "filesystemScope",
      "globalPhysicalCensusHash",
      "semanticSessionOccurrenceHash",
      "finalTranscriptHash",
      "pinnedBinaryDescriptorBindingHash",
      "expectedParent",
      "expectedSharedParentLock",
      "expectedRegisteredNodePackageLock",
    ],
    "Exact release probe builder input",
  );
  const raw = ownedRawSnapshotV2(inputSnapshot.rawFrameBytes);
  try {
    const filesystemScope =
      parseBootstrapFilesystemScopeIdentityCandidateV2(
        exactDataSnapshotV2(
          inputSnapshot.filesystemScope,
          [
            "schema",
            "version",
            "registryContractHash",
            "scopeNonce",
            "scopeIdentityHash",
          ],
          "Exact release probe filesystem scope",
        ),
      );
    const expectedParent = physicalObservationSnapshotV2(
      inputSnapshot.expectedParent,
      "Exact release probe expected parent",
    );
    const expectedSharedParentLock = physicalObservationSnapshotV2(
      inputSnapshot.expectedSharedParentLock,
      "Exact release probe expected shared parent lock",
    );
    const expectedRegisteredNodePackageLock = physicalObservationSnapshotV2(
      inputSnapshot.expectedRegisteredNodePackageLock,
      "Exact release probe expected registered Node package lock",
    );
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(raw);
    } catch (error) {
      return failV2("Exact release probe frame is not strict UTF-8", error);
    }
    if (!text.endsWith("\n") || text.slice(0, -1).includes("\n")) {
      return failV2("Exact release probe frame must be one LF-terminated line");
    }
    const line = text.slice(0, -1);
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch (error) {
      return failV2("Exact release probe frame is malformed JSON", error);
    }
    if (JSON.stringify(parsed) !== line) {
      return failV2("Exact release probe frame is not compact exact JSON");
    }
    const frame = exactRecordV2(
      parsed,
      [
        "schema",
        "admissionScope",
        "productionAuthority",
        "nativeExternalPidAuthority",
        "challengeBase64",
        "parent",
        "sharedParentLock",
        "registeredNodePackageLock",
        "acquisitionOrder",
        "releaseOrder",
      ],
      "Exact release probe frame",
    );
    exactStringV2(frame.schema, FRAME_SCHEMA_V2, "frame schema");
    exactStringV2(frame.admissionScope, "test_fixture", "admission scope");
    if (frame.productionAuthority !== false) {
      return failV2("Exact release probe production authority is invalid");
    }
    exactStringV2(
      frame.nativeExternalPidAuthority,
      "distinct_process_descriptor_relative_f_tlock_fixture_v2",
      "native PID authority",
    );
    if (
      typeof frame.challengeBase64 !== "string"
      || !/^(?:[A-Za-z0-9+/]{4}){10}[A-Za-z0-9+/]{3}=$/u
        .test(frame.challengeBase64)
    ) {
      return failV2("Exact release probe challenge is not canonical base64");
    }
    const challenge = Buffer.from(frame.challengeBase64, "base64");
    if (
      challenge.byteLength !== 32
      || challenge.toString("base64") !== frame.challengeBase64
      || challenge.equals(Buffer.alloc(32))
    ) {
      challenge.fill(0);
      return failV2("Exact release probe challenge boundary is invalid");
    }
    challenge.fill(0);
    exactOrderV2(frame.acquisitionOrder, ACQUISITION_ORDER_V2, "acquisition order");
    exactOrderV2(frame.releaseOrder, RELEASE_ORDER_V2, "release order");

    const parentNative = nativeObservationV2(frame.parent, "parent");
    const sharedRecord = exactRecordV2(
      frame.sharedParentLock,
      ["stable", "mutable", "contentStatus", "outcome"],
      "shared parent lock",
    );
    const nodeRecord = exactRecordV2(
      frame.registeredNodePackageLock,
      ["stable", "mutable", "contentStatus", "outcome"],
      "registered Node package lock",
    );
    exactStringV2(sharedRecord.contentStatus, CONTENT_STATUS_V2, "shared content status");
    exactStringV2(sharedRecord.outcome, LOCK_OUTCOME_V2, "shared outcome");
    exactStringV2(nodeRecord.contentStatus, CONTENT_STATUS_V2, "Node content status");
    exactStringV2(nodeRecord.outcome, LOCK_OUTCOME_V2, "Node outcome");
    const sharedNative = nativeObservationV2(
      { stable: sharedRecord.stable, mutable: sharedRecord.mutable },
      "shared parent lock",
    );
    const nodeNative = nativeObservationV2(
      { stable: nodeRecord.stable, mutable: nodeRecord.mutable },
      "registered Node package lock",
    );
    if (
      parentNative.stable.objectKind !== "directory"
      || sharedNative.stable.objectKind !== "ordinary_file"
      || nodeNative.stable.objectKind !== "ordinary_file"
      || sharedNative.mutable.mode !== "0600"
      || nodeNative.mutable.mode !== "0600"
      || sharedNative.mutable.linkCount !== 1
      || nodeNative.mutable.linkCount !== 1
      || sharedNative.stable.device !== parentNative.stable.device
      || nodeNative.stable.device !== parentNative.stable.device
      || sharedNative.mutable.ownerUid !== parentNative.mutable.ownerUid
      || sharedNative.mutable.ownerGid !== parentNative.mutable.ownerGid
      || nodeNative.mutable.ownerUid !== parentNative.mutable.ownerUid
      || nodeNative.mutable.ownerGid !== parentNative.mutable.ownerGid
      || (
        sharedNative.stable.device === nodeNative.stable.device
        && sharedNative.stable.inode === nodeNative.stable.inode
      )
    ) {
      return failV2("Exact release probe physical boundary is invalid");
    }
    const parent = observationV2(parentNative, filesystemScope);
    const shared = observationV2(sharedNative, filesystemScope);
    const node = observationV2(nodeNative, filesystemScope);
    if (
      !equalV2(parent, expectedParent)
      || !equalV2(shared, expectedSharedParentLock)
      || !equalV2(node, expectedRegisteredNodePackageLock)
    ) {
      return failV2("Exact release probe does not rejoin expected aggregate objects");
    }
    const rawFrameHash = createHash("sha256").update(raw).digest("hex");
    const semanticSessionOccurrenceHash = sha256V2(
      inputSnapshot.semanticSessionOccurrenceHash,
      "semantic session occurrence hash",
    );
    const finalTranscriptHash = sha256V2(
      inputSnapshot.finalTranscriptHash,
      "final transcript hash",
    );
    const pinnedBinaryDescriptorBindingHash = sha256V2(
      inputSnapshot.pinnedBinaryDescriptorBindingHash,
      "pinned binary descriptor binding hash",
    );
    const globalPhysicalCensusHash = sha256V2(
      inputSnapshot.globalPhysicalCensusHash,
      "global physical census hash",
    );
    const probeOccurrenceHash = hashCanonicalJson({
      schema: OCCURRENCE_HASH_DOMAIN_V2,
      challengeBase64: frame.challengeBase64,
      rawFrameHash,
      semanticSessionOccurrenceHash,
      finalTranscriptHash,
      pinnedBinaryDescriptorBindingHash,
    });
    const identity = {
      schema: RECEIPT_SCHEMA_V2,
      version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
      admissionScope: "test_fixture" as const,
      productionAuthority: false as const,
      descriptorRelativeReleaseProbeAuthority:
        "native_external_pid_descriptor_relative_exact_object_f_tlock_fixture_v2" as const,
      serializedAuthority: "self_asserted_replay_never_live_authority" as const,
      semanticSessionOccurrenceHash,
      finalTranscriptHash,
      pinnedBinaryDescriptorBindingHash,
      filesystemScopeIdentityHash: filesystemScope.scopeIdentityHash,
      globalPhysicalCensusHash,
      probeOccurrenceHash,
      rawFrameHash,
      challengeBase64: frame.challengeBase64,
      parent,
      sharedParentLock: { ...shared, contentStatus: CONTENT_STATUS_V2, outcome: LOCK_OUTCOME_V2 },
      registeredNodePackageLock: { ...node, contentStatus: CONTENT_STATUS_V2, outcome: LOCK_OUTCOME_V2 },
      acquisitionOrder: ACQUISITION_ORDER_V2,
      releaseOrder: RELEASE_ORDER_V2,
      transportStatus:
        "caller_asserted_owned_bounded_fd4_frame_and_eof" as const,
      processExitStatus: "caller_asserted_exit_zero_silent" as const,
    } satisfies PlatformReleaseBootstrapNodeNativeExactReleaseProbeReceiptIdentityV2;
    return deepFreezePlatformReleaseJsonV2({
      ...identity,
      exactReleaseProbeReceiptHash:
        hashPlatformReleaseBootstrapNodeNativeExactReleaseProbeReceiptV2(identity),
    });
  } finally {
    raw.fill(0);
  }
}
