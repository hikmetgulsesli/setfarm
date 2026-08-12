import { createHash } from "node:crypto";
import { types as nodeUtilTypes } from "node:util";

import { z } from "zod";

import {
  PLATFORM_RELEASE_COMPONENT_VERSION_V2,
  boundedPlatformReleaseJsonSnapshotV2,
  deepFreezePlatformReleaseJsonV2,
} from "../execution/schemas/platform-release-common-v2.js";
import { canonicalJsonStringify, hashCanonicalJson } from "./canonical-json.js";
import {
  mapPlatformReleaseBootstrapDarwinAggregateCensusEvidenceStreamV2,
  type PlatformReleaseBootstrapDarwinAggregateCensusFixtureMappingV2,
} from "./platform-release-bootstrap-darwin-aggregate-census-fixture-v2.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_NODE_LIVE_OBSERVATION_ACK_V2_SCHEMA,
  hashNodeLiveObservationAckFrameV2,
  parseNodeLiveObservationAckFrameCandidateV2,
  rollNodeLiveObservationTranscriptHashV2,
  type PlatformReleaseBootstrapNodeLiveObservationAckFrameV2,
} from "./platform-release-bootstrap-node-live-observation-session-contract-v2.js";
import {
  FsObservationFingerprintV2Schema,
  StableFsObjectIdentityV2Schema,
} from "./platform-release-bootstrap-physical-census-v2.js";
import { Sha256Schema } from "./schemas/common-v1.js";

export const PLATFORM_RELEASE_BOOTSTRAP_NODE_NATIVE_CONTROLLER_RECEIPT_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-node-native-controller-receipt.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_NODE_EXTERNAL_RELEASE_PROBE_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-node-external-release-probe.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_NODE_NATIVE_CONTROLLER_EVIDENCE_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-node-native-controller-evidence.v2" as const;

export const PLATFORM_RELEASE_BOOTSTRAP_NODE_NATIVE_CONTROLLER_OPEN_TYPE_V2 = 1;
export const PLATFORM_RELEASE_BOOTSTRAP_NODE_NATIVE_CONTROLLER_OBSERVATION_TYPE_V2 = 2;
export const PLATFORM_RELEASE_BOOTSTRAP_NODE_NATIVE_CONTROLLER_ACK_ABORT_TYPE_V2 = 17;
export const PLATFORM_RELEASE_BOOTSTRAP_NODE_NATIVE_CONTROLLER_TERMINAL_ABORT_TYPE_V2 = 33;
export const PLATFORM_RELEASE_BOOTSTRAP_NODE_NATIVE_CONTROLLER_TERMINAL_AUTHORITY_SELF_ASSERTED_V2 = 1;
export const PLATFORM_RELEASE_BOOTSTRAP_NODE_NATIVE_CONTROLLER_AGGREGATE_MAX_BYTES_V2 =
  64 * 1024 * 1024;
export const PLATFORM_RELEASE_BOOTSTRAP_NODE_NATIVE_CONTROLLER_OPEN_FRAME_BYTES_V2 =
  4 + 1 + 32;
export const PLATFORM_RELEASE_BOOTSTRAP_NODE_NATIVE_CONTROLLER_ACK_ABORT_FRAME_BYTES_V2 =
  4 + 1 + 32 + 32 + 32;
export const PLATFORM_RELEASE_BOOTSTRAP_NODE_NATIVE_CONTROLLER_TERMINAL_ABORT_FRAME_BYTES_V2 =
  4 + 1 + 32 + 32 + 32 + 1;
export const PLATFORM_RELEASE_BOOTSTRAP_NODE_NATIVE_CONTROLLER_OBSERVATION_MAX_FRAME_BYTES_V2 =
  4 + 1 + PLATFORM_RELEASE_BOOTSTRAP_NODE_NATIVE_CONTROLLER_AGGREGATE_MAX_BYTES_V2;
export const PLATFORM_RELEASE_BOOTSTRAP_NODE_NATIVE_CONTROLLER_RECEIPT_MAX_CANONICAL_BYTES_V2 =
  64 * 1024;
export const PLATFORM_RELEASE_BOOTSTRAP_NODE_EXTERNAL_RELEASE_PROBE_MAX_CANONICAL_BYTES_V2 =
  64 * 1024;

const SESSION_OCCURRENCE_HASH_DOMAIN_V2 =
  "setfarm.platform-release-bootstrap-node-native-controller-session-occurrence-hash.v2";
const OBSERVATION_TRANSCRIPT_HASH_DOMAIN_V2 =
  "setfarm.platform-release-bootstrap-node-native-controller-observation-transcript-hash.v2";
const RELEASE_PROBE_HASH_DOMAIN_V2 =
  "setfarm.platform-release-bootstrap-node-external-release-probe-hash.v2";
const RECEIPT_HASH_DOMAIN_V2 =
  "setfarm.platform-release-bootstrap-node-native-controller-receipt-hash.v2";
const NATIVE_RECURSIVE_EVIDENCE_STATUS_V2 =
  "absent_not_captured_v2" as const;
const TRANSPORT_AUTHORITY_V2 =
  "caller_supplied_fixture_frames_requires_live_adapter_v2" as const;
const PROCESS_SETTLEMENT_AUTHORITY_V2 =
  "caller_supplied_claim_requires_live_adapter_v2" as const;
const PROBE_AUTHORITY_V2 =
  "self_asserted_requires_code_owned_paired_probe_v2" as const;
const AGGREGATE_STREAM_STATUS_V2 =
  "mid_session_evidence_stream_child_not_settled_v2" as const;
const ACK_DEADLINE_STATUS_V2 =
  "unverified_until_live_adapter_v2" as const;
const STANDALONE_ACK_AUTHORITY_V2 =
  "structural_abort_ack_not_live_session_join_v2" as const;
const CONTROLLER_AUTHORITY_V2 =
  "self_asserted_contract_only_requires_live_adapter_v2" as const;

const ACQUISITION_ORDER_V2 = Object.freeze([
  "shared_parent_lock",
  "registered_node_package_lock",
] as const);
const RELEASE_ORDER_V2 = Object.freeze([
  "registered_node_package_lock",
  "shared_parent_lock",
] as const);

const TYPED_ARRAY_PROTOTYPE_V2 = Object.getPrototypeOf(
  Uint8Array.prototype,
) as object;
const TYPED_ARRAY_BUFFER_GETTER_V2 = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE_V2,
  "buffer",
)!.get!;
const TYPED_ARRAY_BYTE_LENGTH_GETTER_V2 = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE_V2,
  "byteLength",
)!.get!;
const TYPED_ARRAY_BYTE_OFFSET_GETTER_V2 = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE_V2,
  "byteOffset",
)!.get!;

export type PlatformReleaseBootstrapNodeNativeControllerFixtureErrorCodeV2 =
  | "NODE_NATIVE_CONTROLLER_AGGREGATE_INVALID"
  | "NODE_NATIVE_CONTROLLER_FRAME_INVALID"
  | "NODE_NATIVE_CONTROLLER_INPUT_INVALID"
  | "NODE_NATIVE_CONTROLLER_PENDING_INVALID"
  | "NODE_NATIVE_CONTROLLER_PROBE_INVALID"
  | "NODE_NATIVE_CONTROLLER_PROCESS_INVALID"
  | "NODE_NATIVE_CONTROLLER_RECEIPT_INVALID"
  | "NODE_NATIVE_CONTROLLER_TERMINAL_INVALID";

export class PlatformReleaseBootstrapNodeNativeControllerFixtureErrorV2
  extends TypeError {
  constructor(
    readonly code: PlatformReleaseBootstrapNodeNativeControllerFixtureErrorCodeV2,
    message: string,
    options: ErrorOptions = {},
  ) {
    super(message.slice(0, 1_000), options);
    this.name =
      "PlatformReleaseBootstrapNodeNativeControllerFixtureErrorV2";
  }
}

function failV2(
  code: PlatformReleaseBootstrapNodeNativeControllerFixtureErrorCodeV2,
  message: string,
  cause?: unknown,
): never {
  throw new PlatformReleaseBootstrapNodeNativeControllerFixtureErrorV2(
    code,
    message,
    cause === undefined ? {} : { cause },
  );
}

function sha256BytesV2(bytes: Uint8Array): Buffer {
  return createHash("sha256").update(bytes).digest();
}

function sha256HexV2(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function exactDataRecordV2(
  input: unknown,
  keys: readonly string[],
  label: string,
): Record<string, unknown> {
  try {
    if (
      input === null
      || typeof input !== "object"
      || nodeUtilTypes.isProxy(input)
      || Object.getPrototypeOf(input) !== Object.prototype
    ) {
      return failV2(
        "NODE_NATIVE_CONTROLLER_INPUT_INVALID",
        `${label} must be one non-proxy plain record`,
      );
    }
    const descriptors = Object.getOwnPropertyDescriptors(input);
    if (
      Reflect.ownKeys(descriptors).length !== keys.length
      || keys.some((key) => {
        const descriptor = descriptors[key];
        return !descriptor
          || !("value" in descriptor)
          || !descriptor.enumerable;
      })
    ) {
      return failV2(
        "NODE_NATIVE_CONTROLLER_INPUT_INVALID",
        `${label} must expose only its exact enumerable data properties`,
      );
    }
    return Object.fromEntries(
      keys.map((key) => [key, descriptors[key]!.value]),
    );
  } catch (error) {
    if (
      error instanceof
      PlatformReleaseBootstrapNodeNativeControllerFixtureErrorV2
    ) throw error;
    return failV2(
      "NODE_NATIVE_CONTROLLER_INPUT_INVALID",
      `${label} could not be inspected safely`,
      error,
    );
  }
}

function snapshotBytesV2(
  input: unknown,
  maxBytes: number,
  label: string,
): Buffer {
  try {
    if (
      input === null
      || typeof input !== "object"
      || nodeUtilTypes.isProxy(input)
      || (
        Object.getPrototypeOf(input) !== Buffer.prototype
        && Object.getPrototypeOf(input) !== Uint8Array.prototype
      )
      || ["buffer", "byteLength", "byteOffset", "length"].some(
        (key) => Object.getOwnPropertyDescriptor(input, key) !== undefined,
      )
    ) {
      return failV2(
        "NODE_NATIVE_CONTROLLER_INPUT_INVALID",
        `${label} must be one exact unshadowed byte array`,
      );
    }
    const arrayBuffer = TYPED_ARRAY_BUFFER_GETTER_V2.call(input) as unknown;
    const byteLength = TYPED_ARRAY_BYTE_LENGTH_GETTER_V2.call(input) as unknown;
    const byteOffset = TYPED_ARRAY_BYTE_OFFSET_GETTER_V2.call(input) as unknown;
    if (
      arrayBuffer === null
      || typeof arrayBuffer !== "object"
      || nodeUtilTypes.isProxy(arrayBuffer)
      || !(arrayBuffer instanceof ArrayBuffer)
      || Object.getPrototypeOf(arrayBuffer) !== ArrayBuffer.prototype
      || typeof byteLength !== "number"
      || !Number.isSafeInteger(byteLength)
      || byteLength < 0
      || byteLength > maxBytes
      || typeof byteOffset !== "number"
      || !Number.isSafeInteger(byteOffset)
      || byteOffset < 0
    ) {
      return failV2(
        "NODE_NATIVE_CONTROLLER_INPUT_INVALID",
        `${label} violates its exact pre-copy byte bound`,
      );
    }
    return Buffer.from(new Uint8Array(arrayBuffer, byteOffset, byteLength));
  } catch (error) {
    if (
      error instanceof
      PlatformReleaseBootstrapNodeNativeControllerFixtureErrorV2
    ) throw error;
    return failV2(
      "NODE_NATIVE_CONTROLLER_INPUT_INVALID",
      `${label} could not be snapshotted safely`,
      error,
    );
  }
}

function parseFrameV2(
  bytes: Buffer,
  expectedType: number,
  exactPayloadBytes: number | undefined,
  label: string,
): Buffer {
  if (bytes.byteLength < 5) {
    return failV2(
      "NODE_NATIVE_CONTROLLER_FRAME_INVALID",
      `${label} is shorter than one u32be typed frame`,
    );
  }
  const declared = bytes.readUInt32BE(0);
  const payloadBytes = bytes.byteLength - 5;
  if (
    declared !== bytes.byteLength - 4
    || bytes[4] !== expectedType
    || (exactPayloadBytes !== undefined && payloadBytes !== exactPayloadBytes)
  ) {
    return failV2(
      "NODE_NATIVE_CONTROLLER_FRAME_INVALID",
      `${label} type, length, or payload width is invalid`,
    );
  }
  return bytes.subarray(5);
}

function encodeFrameV2(type: number, payload: Uint8Array): Buffer {
  const frame = Buffer.allocUnsafe(4 + 1 + payload.byteLength);
  frame.writeUInt32BE(1 + payload.byteLength, 0);
  frame[4] = type;
  Buffer.from(payload).copy(frame, 5);
  return frame;
}

const ProbedLockV2Schema = z.object({
  objectIdentity: StableFsObjectIdentityV2Schema,
  fingerprint: FsObservationFingerprintV2Schema,
  outcome: z.literal("exclusive_nonblocking_lock_acquired_then_released"),
}).strict();

const ExternalReleaseProbeIdentityV2Schema = z.object({
  schema: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_NODE_EXTERNAL_RELEASE_PROBE_V2_SCHEMA,
  ),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  productionAuthority: z.literal(false),
  probeAuthority: z.literal(PROBE_AUTHORITY_V2),
  acquisitionOrder: z.tuple([
    z.literal("shared_parent_lock"),
    z.literal("registered_node_package_lock"),
  ]),
  releaseOrder: z.tuple([
    z.literal("registered_node_package_lock"),
    z.literal("shared_parent_lock"),
  ]),
  sharedParentLock: ProbedLockV2Schema,
  registeredNodePackageLock: ProbedLockV2Schema,
}).strict().superRefine((value, context) => {
  if (
    value.sharedParentLock.objectIdentity.objectIdentityHash
      === value.registeredNodePackageLock.objectIdentity.objectIdentityHash
  ) {
    context.addIssue({
      code: "custom",
      message: "External release probe lock identities must be distinct",
    });
  }
});

export type PlatformReleaseBootstrapNodeExternalReleaseProbeHashPayloadV2 =
  z.infer<typeof ExternalReleaseProbeIdentityV2Schema>;

export function hashPlatformReleaseBootstrapNodeExternalReleaseProbeV2(
  value:
    | PlatformReleaseBootstrapNodeExternalReleaseProbeHashPayloadV2
    | PlatformReleaseBootstrapNodeExternalReleaseProbeV2,
): string {
  const identity = { ...value } as Record<string, unknown>;
  delete identity.probeHash;
  return hashCanonicalJson({
    schema: RELEASE_PROBE_HASH_DOMAIN_V2,
    probe: identity,
  });
}

export const PlatformReleaseBootstrapNodeExternalReleaseProbeV2Schema =
  ExternalReleaseProbeIdentityV2Schema.safeExtend({
    probeHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (
      value.probeHash
        !== hashPlatformReleaseBootstrapNodeExternalReleaseProbeV2(value)
    ) {
      context.addIssue({
        code: "custom",
        path: ["probeHash"],
        message: "External release probe hash mismatch",
      });
    }
  });

export type PlatformReleaseBootstrapNodeExternalReleaseProbeV2 = z.infer<
  typeof PlatformReleaseBootstrapNodeExternalReleaseProbeV2Schema
>;

export type PlatformReleaseBootstrapNodeNativeProcessSettlementV2 =
  Readonly<{
    exitCode: 0;
    signal: null;
    protocolEof: true;
    stdout: Uint8Array;
    stderr: Uint8Array;
  }>;

export type PlatformReleaseBootstrapNodeNativeControllerEvidenceV2 =
  Readonly<{
    schema:
      typeof PLATFORM_RELEASE_BOOTSTRAP_NODE_NATIVE_CONTROLLER_EVIDENCE_V2_SCHEMA;
    version: typeof PLATFORM_RELEASE_COMPONENT_VERSION_V2;
    admissionScope: "test_fixture";
    productionAuthority: false;
    transportAuthority: typeof TRANSPORT_AUTHORITY_V2;
    processSettlementAuthority: typeof PROCESS_SETTLEMENT_AUTHORITY_V2;
    aggregateStreamStatus: typeof AGGREGATE_STREAM_STATUS_V2;
    ackDeadlineStatus: typeof ACK_DEADLINE_STATUS_V2;
    standaloneAckAuthority: typeof STANDALONE_ACK_AUTHORITY_V2;
    nativeRecursiveEvidenceStatus:
      typeof NATIVE_RECURSIVE_EVIDENCE_STATUS_V2;
    sessionOccurrenceHash: string;
    challengeHash: string;
    aggregateEvidenceStreamHash: string;
    observationTranscriptHash: string;
    openFrameHash: string;
    observationFrameHash: string;
    semanticAcknowledgement:
      PlatformReleaseBootstrapNodeLiveObservationAckFrameV2;
    aggregateObservation:
      PlatformReleaseBootstrapDarwinAggregateCensusFixtureMappingV2;
  }>;

type PendingStateV2 = {
  challenge: Buffer;
  aggregateEvidenceStreamHashBytes: Buffer;
  abortDecisionHashBytes: Buffer;
  evidence: PlatformReleaseBootstrapNodeNativeControllerEvidenceV2;
};

const pendingConstructorCapabilityV2 = Object.freeze({});
const pendingStateV2 = new WeakMap<
  PlatformReleaseBootstrapNodeNativeControllerPendingV2,
  PendingStateV2
>();
const consumedPendingV2 = new WeakSet<object>();

function zeroPendingStateV2(state: PendingStateV2): void {
  state.challenge.fill(0);
  state.aggregateEvidenceStreamHashBytes.fill(0);
  state.abortDecisionHashBytes.fill(0);
}

export class PlatformReleaseBootstrapNodeNativeControllerPendingV2 {
  constructor(capability: object) {
    if (capability !== pendingConstructorCapabilityV2) {
      return failV2(
        "NODE_NATIVE_CONTROLLER_PENDING_INVALID",
        "Native controller pending handles are module-private capabilities",
      );
    }
    Object.freeze(this);
  }
}

export type PlatformReleaseBootstrapNodeNativeControllerPendingDisposeResultV2 =
  | "disposed"
  | "already_disposed";

export function disposePlatformReleaseBootstrapNodeNativeControllerPendingV2(
  pending: PlatformReleaseBootstrapNodeNativeControllerPendingV2,
): PlatformReleaseBootstrapNodeNativeControllerPendingDisposeResultV2 {
  if (
    pending === null
    || typeof pending !== "object"
    || nodeUtilTypes.isProxy(pending)
  ) {
    return failV2(
      "NODE_NATIVE_CONTROLLER_PENDING_INVALID",
      "Native controller pending handle is forged",
    );
  }
  if (consumedPendingV2.has(pending)) return "already_disposed";
  const state = pendingStateV2.get(pending);
  if (!state) {
    return failV2(
      "NODE_NATIVE_CONTROLLER_PENDING_INVALID",
      "Native controller pending handle is not owned by this module",
    );
  }
  pendingStateV2.delete(pending);
  consumedPendingV2.add(pending);
  zeroPendingStateV2(state);
  return "disposed";
}

function buildAbortAcknowledgementV2(
  sessionOccurrenceHash: string,
  observationTranscriptHash: string,
): PlatformReleaseBootstrapNodeLiveObservationAckFrameV2 {
  const identity = {
    schema: PLATFORM_RELEASE_BOOTSTRAP_NODE_LIVE_OBSERVATION_ACK_V2_SCHEMA,
    version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
    sequence: 2,
    sessionOccurrenceHash,
    observationTranscriptHash,
    priorTranscriptHash: observationTranscriptHash,
    disposition: "abort",
    abortReason: "observation_not_acceptable",
  } as const;
  const frameHash = hashNodeLiveObservationAckFrameV2(identity);
  return parseNodeLiveObservationAckFrameCandidateV2({
    ...identity,
    frameHash,
    transcriptHash: rollNodeLiveObservationTranscriptHashV2({
      sessionOccurrenceHash,
      priorTranscriptHash: observationTranscriptHash,
      sequence: 2,
      frameHash,
    }),
  });
}

export function beginPlatformReleaseBootstrapNodeNativeControllerFixtureV2(
  input: Readonly<{
    openFrameBytes: Uint8Array;
    observationFrameBytes: Uint8Array;
  }>,
): Readonly<{
  pending: PlatformReleaseBootstrapNodeNativeControllerPendingV2;
  acknowledgementBytes: Uint8Array;
  evidence: PlatformReleaseBootstrapNodeNativeControllerEvidenceV2;
}> {
  let openFrame: Buffer | undefined;
  let observationFrame: Buffer | undefined;
  let aggregateBytes: Buffer | undefined;
  let aggregateHashBytes: Buffer | undefined;
  let abortDecisionHashBytes: Buffer | undefined;
  let acknowledgementFrame: Buffer | undefined;
  try {
    const record = exactDataRecordV2(
      input,
      ["openFrameBytes", "observationFrameBytes"],
      "Native controller begin input",
    );
    openFrame = snapshotBytesV2(
      record.openFrameBytes,
      PLATFORM_RELEASE_BOOTSTRAP_NODE_NATIVE_CONTROLLER_OPEN_FRAME_BYTES_V2,
      "Native controller OPEN frame",
    );
    observationFrame = snapshotBytesV2(
      record.observationFrameBytes,
      PLATFORM_RELEASE_BOOTSTRAP_NODE_NATIVE_CONTROLLER_OBSERVATION_MAX_FRAME_BYTES_V2,
      "Native controller OBSERVATION frame",
    );
    if (
      openFrame.byteLength
        !== PLATFORM_RELEASE_BOOTSTRAP_NODE_NATIVE_CONTROLLER_OPEN_FRAME_BYTES_V2
    ) {
      return failV2(
        "NODE_NATIVE_CONTROLLER_FRAME_INVALID",
        "Native controller OPEN frame has an invalid exact width",
      );
    }
    const challenge = parseFrameV2(
      openFrame,
      PLATFORM_RELEASE_BOOTSTRAP_NODE_NATIVE_CONTROLLER_OPEN_TYPE_V2,
      32,
      "Native controller OPEN frame",
    );
    const aggregatePayload = parseFrameV2(
      observationFrame,
      PLATFORM_RELEASE_BOOTSTRAP_NODE_NATIVE_CONTROLLER_OBSERVATION_TYPE_V2,
      undefined,
      "Native controller OBSERVATION frame",
    );
    if (
      aggregatePayload.byteLength < 1
      || aggregatePayload.byteLength
        > PLATFORM_RELEASE_BOOTSTRAP_NODE_NATIVE_CONTROLLER_AGGREGATE_MAX_BYTES_V2
    ) {
      return failV2(
        "NODE_NATIVE_CONTROLLER_FRAME_INVALID",
        "Native controller aggregate observation exceeds its exact byte range",
      );
    }
    aggregateBytes = Buffer.from(aggregatePayload);
    aggregateHashBytes = sha256BytesV2(aggregateBytes);
    let aggregateObservation:
      PlatformReleaseBootstrapDarwinAggregateCensusFixtureMappingV2;
    try {
      aggregateObservation =
        mapPlatformReleaseBootstrapDarwinAggregateCensusEvidenceStreamV2(
          aggregateBytes,
        );
    } catch (error) {
      return failV2(
        "NODE_NATIVE_CONTROLLER_AGGREGATE_INVALID",
        "Native controller aggregate evidence stream is invalid",
        error,
      );
    }
    const aggregateEvidenceStreamHash = aggregateHashBytes.toString("hex");
    const sessionOccurrenceHash = hashCanonicalJson({
      schema: SESSION_OCCURRENCE_HASH_DOMAIN_V2,
      challenge: challenge.toString("hex"),
      aggregateEvidenceStreamHash,
    });
    const observationTranscriptHash = hashCanonicalJson({
      schema: OBSERVATION_TRANSCRIPT_HASH_DOMAIN_V2,
      sessionOccurrenceHash,
      aggregateEvidenceStreamHash,
      globalPhysicalCensusHash:
        aggregateObservation.physicalCensus.physicalCensusHash,
      nodePhysicalProjectionHash:
        aggregateObservation.nodePhysicalProjection.projectionHash,
      nativeRecursiveEvidenceStatus: NATIVE_RECURSIVE_EVIDENCE_STATUS_V2,
    });
    const acknowledgement = buildAbortAcknowledgementV2(
      sessionOccurrenceHash,
      observationTranscriptHash,
    );
    abortDecisionHashBytes = Buffer.from(acknowledgement.frameHash, "hex");
    const acknowledgementPayload = Buffer.concat([
      challenge,
      aggregateHashBytes,
      abortDecisionHashBytes,
    ]);
    try {
      acknowledgementFrame = encodeFrameV2(
        PLATFORM_RELEASE_BOOTSTRAP_NODE_NATIVE_CONTROLLER_ACK_ABORT_TYPE_V2,
        acknowledgementPayload,
      );
    } finally {
      acknowledgementPayload.fill(0);
    }
    if (
      acknowledgementFrame.byteLength
        !== PLATFORM_RELEASE_BOOTSTRAP_NODE_NATIVE_CONTROLLER_ACK_ABORT_FRAME_BYTES_V2
    ) {
      return failV2(
        "NODE_NATIVE_CONTROLLER_FRAME_INVALID",
        "Native controller ACK_ABORT frame has an invalid exact width",
      );
    }
    const evidence = deepFreezePlatformReleaseJsonV2({
      schema:
        PLATFORM_RELEASE_BOOTSTRAP_NODE_NATIVE_CONTROLLER_EVIDENCE_V2_SCHEMA,
      version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
      admissionScope: "test_fixture" as const,
      productionAuthority: false as const,
      transportAuthority: TRANSPORT_AUTHORITY_V2,
      processSettlementAuthority: PROCESS_SETTLEMENT_AUTHORITY_V2,
      aggregateStreamStatus: AGGREGATE_STREAM_STATUS_V2,
      ackDeadlineStatus: ACK_DEADLINE_STATUS_V2,
      standaloneAckAuthority: STANDALONE_ACK_AUTHORITY_V2,
      nativeRecursiveEvidenceStatus: NATIVE_RECURSIVE_EVIDENCE_STATUS_V2,
      sessionOccurrenceHash,
      challengeHash: sha256HexV2(challenge),
      aggregateEvidenceStreamHash,
      observationTranscriptHash,
      openFrameHash: sha256HexV2(openFrame),
      observationFrameHash: sha256HexV2(observationFrame),
      semanticAcknowledgement: acknowledgement,
      aggregateObservation,
    });
    const pending = new PlatformReleaseBootstrapNodeNativeControllerPendingV2(
      pendingConstructorCapabilityV2,
    );
    pendingStateV2.set(pending, {
      challenge: Buffer.from(challenge),
      aggregateEvidenceStreamHashBytes: Buffer.from(aggregateHashBytes),
      abortDecisionHashBytes: Buffer.from(abortDecisionHashBytes),
      evidence,
    });
    return Object.freeze({
      pending,
      acknowledgementBytes: Uint8Array.from(acknowledgementFrame),
      evidence,
    });
  } finally {
    openFrame?.fill(0);
    observationFrame?.fill(0);
    aggregateBytes?.fill(0);
    aggregateHashBytes?.fill(0);
    abortDecisionHashBytes?.fill(0);
    acknowledgementFrame?.fill(0);
  }
}

const ReceiptIdentityV2Schema = z.object({
  schema: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_NODE_NATIVE_CONTROLLER_RECEIPT_V2_SCHEMA,
  ),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  admissionScope: z.literal("test_fixture"),
  productionAuthority: z.literal(false),
  transportAuthority: z.literal(TRANSPORT_AUTHORITY_V2),
  processSettlementAuthority: z.literal(PROCESS_SETTLEMENT_AUTHORITY_V2),
  aggregateStreamStatus: z.literal(AGGREGATE_STREAM_STATUS_V2),
  ackDeadlineStatus: z.literal(ACK_DEADLINE_STATUS_V2),
  standaloneAckAuthority: z.literal(STANDALONE_ACK_AUTHORITY_V2),
  controllerAuthority: z.literal(CONTROLLER_AUTHORITY_V2),
  nativeRecursiveEvidenceStatus: z.literal(
    NATIVE_RECURSIVE_EVIDENCE_STATUS_V2,
  ),
  semanticDisposition: z.literal("abort_observation_not_acceptable"),
  recapture: z.literal("not_performed"),
  acceptMechanics: z.literal("fixture_tested_but_disabled"),
  sessionOccurrenceHash: Sha256Schema,
  aggregateEvidenceStreamHash: Sha256Schema,
  globalPhysicalCensusHash: Sha256Schema,
  nodePhysicalProjectionHash: Sha256Schema,
  sharedParentLockObjectIdentityHash: Sha256Schema,
  registeredNodePackageLockObjectIdentityHash: Sha256Schema,
  openFrameHash: Sha256Schema,
  observationFrameHash: Sha256Schema,
  semanticAckFrameHash: Sha256Schema,
  semanticAckTranscriptHash: Sha256Schema,
  terminalFrameHash: Sha256Schema,
  externalReleaseProbeHash: Sha256Schema,
  cleanProcessSettlement: z.literal(true),
  receiptVerification: z.literal(
    "serialized_reparse_never_fresh_controller_authority",
  ),
}).strict().superRefine((value, context) => {
  if (
    value.sharedParentLockObjectIdentityHash
      === value.registeredNodePackageLockObjectIdentityHash
  ) {
    context.addIssue({
      code: "custom",
      message: "Native controller receipt lock identities must remain distinct",
    });
  }
});

export type PlatformReleaseBootstrapNodeNativeControllerReceiptHashPayloadV2 =
  z.infer<typeof ReceiptIdentityV2Schema>;

export function hashPlatformReleaseBootstrapNodeNativeControllerReceiptV2(
  value:
    | PlatformReleaseBootstrapNodeNativeControllerReceiptHashPayloadV2
    | PlatformReleaseBootstrapNodeNativeControllerReceiptV2,
): string {
  const identity = { ...value } as Record<string, unknown>;
  delete identity.receiptHash;
  return hashCanonicalJson({
    schema: RECEIPT_HASH_DOMAIN_V2,
    receipt: identity,
  });
}

export const PlatformReleaseBootstrapNodeNativeControllerReceiptV2Schema =
  ReceiptIdentityV2Schema.safeExtend({
    receiptHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (
      value.receiptHash
        !== hashPlatformReleaseBootstrapNodeNativeControllerReceiptV2(value)
    ) {
      context.addIssue({
        code: "custom",
        path: ["receiptHash"],
        message: "Native controller receipt hash mismatch",
      });
    }
  });

export type PlatformReleaseBootstrapNodeNativeControllerReceiptV2 = z.infer<
  typeof PlatformReleaseBootstrapNodeNativeControllerReceiptV2Schema
>;

export function parsePlatformReleaseBootstrapNodeNativeControllerReceiptCandidateV2(
  input: unknown,
): PlatformReleaseBootstrapNodeNativeControllerReceiptV2 {
  try {
    return deepFreezePlatformReleaseJsonV2(
      PlatformReleaseBootstrapNodeNativeControllerReceiptV2Schema.parse(
        boundedPlatformReleaseJsonSnapshotV2(
          input,
          PLATFORM_RELEASE_BOOTSTRAP_NODE_NATIVE_CONTROLLER_RECEIPT_MAX_CANONICAL_BYTES_V2,
        ),
      ),
    );
  } catch (error) {
    return failV2(
      "NODE_NATIVE_CONTROLLER_RECEIPT_INVALID",
      "Serialized native controller receipt is invalid and never fresh authority",
      error,
    );
  }
}

function parseProcessSettlementV2(
  input: unknown,
): Readonly<{
  exitCode: 0;
  signal: null;
  protocolEof: true;
}> {
  const record = exactDataRecordV2(
    input,
    ["exitCode", "signal", "protocolEof", "stdout", "stderr"],
    "Native controller process settlement",
  );
  let stdout: Buffer | undefined;
  let stderr: Buffer | undefined;
  try {
    stdout = snapshotBytesV2(
      record.stdout,
      0,
      "Native controller trailing stdout",
    );
    stderr = snapshotBytesV2(
      record.stderr,
      0,
      "Native controller stderr",
    );
    if (
      record.exitCode !== 0
      || record.signal !== null
      || record.protocolEof !== true
      || stdout.byteLength !== 0
      || stderr.byteLength !== 0
    ) {
      return failV2(
        "NODE_NATIVE_CONTROLLER_PROCESS_INVALID",
        "Native controller process did not settle at exact clean EOF",
      );
    }
    return Object.freeze({
      exitCode: 0 as const,
      signal: null,
      protocolEof: true as const,
    });
  } finally {
    stdout?.fill(0);
    stderr?.fill(0);
  }
}

function parseExternalReleaseProbeV2(
  input: unknown,
): PlatformReleaseBootstrapNodeExternalReleaseProbeV2 {
  try {
    return deepFreezePlatformReleaseJsonV2(
      PlatformReleaseBootstrapNodeExternalReleaseProbeV2Schema.parse(
        boundedPlatformReleaseJsonSnapshotV2(
          input,
          PLATFORM_RELEASE_BOOTSTRAP_NODE_EXTERNAL_RELEASE_PROBE_MAX_CANONICAL_BYTES_V2,
        ),
      ),
    );
  } catch (error) {
    return failV2(
      "NODE_NATIVE_CONTROLLER_PROBE_INVALID",
      "External lock-release probe is invalid",
      error,
    );
  }
}

export function finalizePlatformReleaseBootstrapNodeNativeControllerFixtureV2(
  pending: PlatformReleaseBootstrapNodeNativeControllerPendingV2,
  input: Readonly<{
    terminalFrameBytes: Uint8Array;
    processSettlement: PlatformReleaseBootstrapNodeNativeProcessSettlementV2;
    externalReleaseProbe: PlatformReleaseBootstrapNodeExternalReleaseProbeV2;
  }>,
): PlatformReleaseBootstrapNodeNativeControllerReceiptV2 {
  if (
    pending === null
    || typeof pending !== "object"
    || nodeUtilTypes.isProxy(pending)
    || consumedPendingV2.has(pending)
  ) {
    return failV2(
      "NODE_NATIVE_CONTROLLER_PENDING_INVALID",
      "Native controller pending handle is forged or already consumed",
    );
  }
  const state = pendingStateV2.get(pending);
  if (!state) {
    return failV2(
      "NODE_NATIVE_CONTROLLER_PENDING_INVALID",
      "Native controller pending handle is not owned by this module",
    );
  }
  pendingStateV2.delete(pending);
  consumedPendingV2.add(pending);

  let terminalFrame: Buffer | undefined;
  try {
    const record = exactDataRecordV2(
      input,
      ["terminalFrameBytes", "processSettlement", "externalReleaseProbe"],
      "Native controller finalize input",
    );
    terminalFrame = snapshotBytesV2(
      record.terminalFrameBytes,
      PLATFORM_RELEASE_BOOTSTRAP_NODE_NATIVE_CONTROLLER_TERMINAL_ABORT_FRAME_BYTES_V2,
      "Native controller TERMINAL_ABORT frame",
    );
    if (
      terminalFrame.byteLength
        !== PLATFORM_RELEASE_BOOTSTRAP_NODE_NATIVE_CONTROLLER_TERMINAL_ABORT_FRAME_BYTES_V2
    ) {
      return failV2(
        "NODE_NATIVE_CONTROLLER_TERMINAL_INVALID",
        "Native controller terminal frame has an invalid exact width",
      );
    }
    const terminal = parseFrameV2(
      terminalFrame,
      PLATFORM_RELEASE_BOOTSTRAP_NODE_NATIVE_CONTROLLER_TERMINAL_ABORT_TYPE_V2,
      32 + 32 + 32 + 1,
      "Native controller TERMINAL_ABORT frame",
    );
    if (
      !terminal.subarray(0, 32).equals(state.challenge)
      || !terminal.subarray(32, 64).equals(
        state.aggregateEvidenceStreamHashBytes,
      )
      || !terminal.subarray(64, 96).equals(state.abortDecisionHashBytes)
      || terminal[96]
        !== PLATFORM_RELEASE_BOOTSTRAP_NODE_NATIVE_CONTROLLER_TERMINAL_AUTHORITY_SELF_ASSERTED_V2
    ) {
      return failV2(
        "NODE_NATIVE_CONTROLLER_TERMINAL_INVALID",
        "Native controller terminal frame does not echo the exact abort occurrence",
      );
    }
    parseProcessSettlementV2(record.processSettlement);
    const releaseProbe = parseExternalReleaseProbeV2(
      record.externalReleaseProbe,
    );
    const aggregate = state.evidence.aggregateObservation;
    const expectedShared = aggregate.heldLocks.sharedParentLock;
    const expectedNode = aggregate.heldLocks.registeredNodePackageLock;
    if (
      canonicalJsonStringify(releaseProbe.sharedParentLock.objectIdentity)
        !== canonicalJsonStringify(expectedShared.objectIdentity)
      || canonicalJsonStringify(releaseProbe.sharedParentLock.fingerprint)
        !== canonicalJsonStringify(expectedShared.fingerprint)
      || canonicalJsonStringify(
        releaseProbe.registeredNodePackageLock.objectIdentity,
      ) !== canonicalJsonStringify(expectedNode.objectIdentity)
      || canonicalJsonStringify(
        releaseProbe.registeredNodePackageLock.fingerprint,
      ) !== canonicalJsonStringify(expectedNode.fingerprint)
    ) {
      return failV2(
        "NODE_NATIVE_CONTROLLER_PROBE_INVALID",
        "External release probe does not reproduce both pre-lock identities and fingerprints",
      );
    }
    const identity = {
      schema:
        PLATFORM_RELEASE_BOOTSTRAP_NODE_NATIVE_CONTROLLER_RECEIPT_V2_SCHEMA,
      version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
      admissionScope: "test_fixture" as const,
      productionAuthority: false as const,
      transportAuthority: TRANSPORT_AUTHORITY_V2,
      processSettlementAuthority: PROCESS_SETTLEMENT_AUTHORITY_V2,
      aggregateStreamStatus: AGGREGATE_STREAM_STATUS_V2,
      ackDeadlineStatus: ACK_DEADLINE_STATUS_V2,
      standaloneAckAuthority: STANDALONE_ACK_AUTHORITY_V2,
      controllerAuthority: CONTROLLER_AUTHORITY_V2,
      nativeRecursiveEvidenceStatus: NATIVE_RECURSIVE_EVIDENCE_STATUS_V2,
      semanticDisposition: "abort_observation_not_acceptable" as const,
      recapture: "not_performed" as const,
      acceptMechanics: "fixture_tested_but_disabled" as const,
      sessionOccurrenceHash: state.evidence.sessionOccurrenceHash,
      aggregateEvidenceStreamHash:
        state.evidence.aggregateEvidenceStreamHash,
      globalPhysicalCensusHash:
        aggregate.physicalCensus.physicalCensusHash,
      nodePhysicalProjectionHash:
        aggregate.nodePhysicalProjection.projectionHash,
      sharedParentLockObjectIdentityHash:
        expectedShared.objectIdentity.objectIdentityHash,
      registeredNodePackageLockObjectIdentityHash:
        expectedNode.objectIdentity.objectIdentityHash,
      openFrameHash: state.evidence.openFrameHash,
      observationFrameHash: state.evidence.observationFrameHash,
      semanticAckFrameHash:
        state.evidence.semanticAcknowledgement.frameHash,
      semanticAckTranscriptHash:
        state.evidence.semanticAcknowledgement.transcriptHash,
      terminalFrameHash: sha256HexV2(terminalFrame),
      externalReleaseProbeHash: releaseProbe.probeHash,
      cleanProcessSettlement: true as const,
      receiptVerification:
        "serialized_reparse_never_fresh_controller_authority" as const,
    };
    // Owned byte buffers are zeroed below. Parsed JSON strings are immutable
    // JavaScript values, so this fixture deliberately makes no string-memory
    // zeroization claim.
    return parsePlatformReleaseBootstrapNodeNativeControllerReceiptCandidateV2({
      ...identity,
      receiptHash:
        hashPlatformReleaseBootstrapNodeNativeControllerReceiptV2(identity),
    });
  } finally {
    terminalFrame?.fill(0);
    zeroPendingStateV2(state);
  }
}
