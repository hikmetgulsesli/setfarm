import { createHash } from "node:crypto";

import { z } from "zod";

import {
  PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_SHARED_LOCK_BASENAME_V2,
  PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_SHARED_LOCK_CONTENT_V2,
} from "../execution/schemas/platform-release-bootstrap-contract-v2.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2,
} from "../execution/schemas/platform-release-bootstrap-operation-abis-v2.js";
import {
  PLATFORM_RELEASE_COMPONENT_VERSION_V2,
  boundedPlatformReleaseJsonSnapshotV2,
  deepFreezePlatformReleaseJsonV2,
  platformReleaseCandidateFitsCanonicalCapV2,
} from "../execution/schemas/platform-release-common-v2.js";
import { canonicalJsonStringify, hashCanonicalJson } from "./canonical-json.js";
import {
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_LIFECYCLE_SEMANTIC_SNAPSHOT_MAX_CANONICAL_BYTES_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_LIFECYCLE_SEMANTIC_VERIFIER_CONTRACT_HASH_V2,
  NodeToolchainProvisionerBootstrapLifecycleSemanticSnapshotV2Schema,
  parseNodeToolchainProvisionerBootstrapLifecycleSemanticSnapshotCandidateV2,
} from "./node-toolchain-provisioner-bootstrap-lifecycle-semantic-snapshot-v2.js";
import {
  BootstrapFilesystemScopeIdentityV2Schema,
  FsObservationFingerprintV2Schema,
  StableFsObjectIdentityV2Schema,
} from "./platform-release-bootstrap-physical-census-v2.js";
import {
  PlatformReleaseBootstrapNamespaceClassificationV2Schema,
} from "./platform-release-bootstrap-registry-v2.js";
import {
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_LOCK_BASENAME_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_LOCK_CONTENT_V2,
} from "./schemas/node-toolchain-provisioner-bootstrap-installation-state-v2.js";
import { Sha256Schema } from "./schemas/common-v1.js";

export const PLATFORM_RELEASE_BOOTSTRAP_NODE_LIVE_OBSERVATION_SESSION_OPEN_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-node-live-observation-session-open.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_NODE_LIVE_OBSERVATION_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-node-live-observation.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_NODE_LIVE_OBSERVATION_ACK_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-node-live-observation-ack.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_NODE_LIVE_OBSERVATION_SESSION_CLOSE_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-node-live-observation-session-close.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_NODE_LIVE_OBSERVATION_SESSION_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-node-live-observation-session.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_NODE_LIVE_OBSERVATION_SEMANTIC_JOIN_RECEIPT_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-node-live-observation-semantic-join-receipt.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_NODE_LIVE_OBSERVATION_INCOMPLETENESS_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-node-live-observation-incompleteness.v2" as const;

export const PLATFORM_RELEASE_BOOTSTRAP_NODE_LIVE_OBSERVATION_MAX_CANONICAL_FRAME_BYTES_V2 =
  256 * 1024;
export const PLATFORM_RELEASE_BOOTSTRAP_NODE_LIVE_OBSERVATION_MAX_CANONICAL_SESSION_BYTES_V2 =
  1024 * 1024;
export const PLATFORM_RELEASE_BOOTSTRAP_NODE_LIVE_OBSERVATION_MAX_RECURSIVE_ENTRIES_V2 =
  512;
export const PLATFORM_RELEASE_BOOTSTRAP_NODE_LIVE_OBSERVATION_FRAME_COUNT_V2 =
  4 as const;
export const PLATFORM_RELEASE_BOOTSTRAP_NODE_LIVE_OBSERVATION_SHARED_LOCK_CONTENT_HASH_V2 =
  createHash("sha256")
    .update(PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_SHARED_LOCK_CONTENT_V2, "utf8")
    .digest("hex");
export const PLATFORM_RELEASE_BOOTSTRAP_NODE_LIVE_OBSERVATION_NODE_LOCK_CONTENT_HASH_V2 =
  createHash("sha256")
    .update(
      NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_LOCK_CONTENT_V2,
      "utf8",
    )
    .digest("hex");
export const PLATFORM_RELEASE_BOOTSTRAP_NODE_LIVE_OBSERVATION_SHARED_LOCK_CONTENT_BYTES_V2 = Buffer.byteLength(
  PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_SHARED_LOCK_CONTENT_V2,
  "utf8",
);
export const PLATFORM_RELEASE_BOOTSTRAP_NODE_LIVE_OBSERVATION_NODE_LOCK_CONTENT_BYTES_V2 = Buffer.byteLength(
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_LOCK_CONTENT_V2,
  "utf8",
);

export const PLATFORM_RELEASE_BOOTSTRAP_NODE_LIVE_OBSERVATION_LOCK_ORDER_V2 =
  Object.freeze([
    "shared_registry_parent_lock",
    "registered_node_package_lock",
  ] as const);
export const PLATFORM_RELEASE_BOOTSTRAP_NODE_LIVE_OBSERVATION_RELEASE_ORDER_V2 =
  Object.freeze([
    "registered_node_package_lock",
    "shared_registry_parent_lock",
  ] as const);

const SESSION_TRANSCRIPT_GENESIS_DOMAIN_V2 =
  "setfarm.platform-release-bootstrap-node-live-observation-transcript-genesis.v2" as const;
const SESSION_TRANSCRIPT_ROLL_DOMAIN_V2 =
  "setfarm.platform-release-bootstrap-node-live-observation-transcript-roll.v2" as const;
const OPEN_FRAME_HASH_DOMAIN_V2 =
  "setfarm.platform-release-bootstrap-node-live-observation-open-frame-hash.v2" as const;
const OBSERVATION_FRAME_HASH_DOMAIN_V2 =
  "setfarm.platform-release-bootstrap-node-live-observation-frame-hash.v2" as const;
const ACK_FRAME_HASH_DOMAIN_V2 =
  "setfarm.platform-release-bootstrap-node-live-observation-ack-frame-hash.v2" as const;
const CLOSE_FRAME_HASH_DOMAIN_V2 =
  "setfarm.platform-release-bootstrap-node-live-observation-close-frame-hash.v2" as const;

const ExactLockOrderV2Schema = z.tuple([
  z.literal("shared_registry_parent_lock"),
  z.literal("registered_node_package_lock"),
]);
const ExactReleaseOrderV2Schema = z.tuple([
  z.literal("registered_node_package_lock"),
  z.literal("shared_registry_parent_lock"),
]);

const SessionBoundsV2Schema = z.object({
  maxCanonicalFrameBytes: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_NODE_LIVE_OBSERVATION_MAX_CANONICAL_FRAME_BYTES_V2,
  ),
  maxRecursiveEntries: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_NODE_LIVE_OBSERVATION_MAX_RECURSIVE_ENTRIES_V2,
  ),
  maxFrames: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_NODE_LIVE_OBSERVATION_FRAME_COUNT_V2,
  ),
}).strict();

export function hashNodeLiveObservationHeldLockCaptureBindingV2(
  value: Readonly<Record<string, unknown>>,
): string {
  const binding = { ...value };
  delete binding.captureBindingHash;
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-bootstrap-node-live-observation-held-lock-capture-binding-hash.v2",
    binding,
  });
}

const HeldLockV2Schema = z.object({
  lockRole: z.enum([
    "shared_registry_parent_lock",
    "registered_node_package_lock",
  ]),
  lockMode: z.literal("exclusive_advisory_held"),
  descriptorUse: z.literal("read_only_observation_only"),
  basename: z.string().min(1).max(255),
  classification: PlatformReleaseBootstrapNamespaceClassificationV2Schema,
  parentObjectIdentityHash: Sha256Schema,
  objectIdentity: StableFsObjectIdentityV2Schema,
  fingerprint: FsObservationFingerprintV2Schema,
  contentHash: Sha256Schema,
  captureBindingHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  if (
    value.objectIdentity.objectKind !== "ordinary_file"
    || value.fingerprint.objectIdentityHash
      !== value.objectIdentity.objectIdentityHash
    || value.basename !== value.classification.basename
    || value.captureBindingHash
      !== hashNodeLiveObservationHeldLockCaptureBindingV2(value)
  ) {
    context.addIssue({
      code: "custom",
      message: "Held locks must bind one ordinary file identity and fingerprint",
    });
  }
});

const ParentObservationV2Schema = z.object({
  objectIdentity: StableFsObjectIdentityV2Schema,
  fingerprint: FsObservationFingerprintV2Schema,
}).strict().superRefine((value, context) => {
  if (
    value.objectIdentity.objectKind !== "directory"
    || value.fingerprint.objectIdentityHash
      !== value.objectIdentity.objectIdentityHash
  ) {
    context.addIssue({
      code: "custom",
      message: "Parent observation must bind one directory identity and fingerprint",
    });
  }
});

const OpenFrameIdentityV2Schema = z.object({
  schema: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_NODE_LIVE_OBSERVATION_SESSION_OPEN_V2_SCHEMA,
  ),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  sequence: z.literal(0),
  sessionOccurrenceHash: Sha256Schema,
  admissionScope: z.literal("test_fixture"),
  productionAuthority: z.literal(false),
  signingAuthority: z.literal("unsigned_test_fixture"),
  operationMode: z.literal("read_only_observation"),
  mutationPolicy: z.literal("forbidden_no_payload_or_callback_surface"),
  ownershipBoundary: z.object({
    ownerUid: z.number().int().nonnegative().max(4_294_967_294),
    ownerGid: z.number().int().nonnegative().max(4_294_967_294),
    parentMode: z.literal("0755"),
    lockMode: z.literal("0600"),
    lockLinkCount: z.literal(1),
  }).strict(),
  filesystemScope: BootstrapFilesystemScopeIdentityV2Schema,
  parent: ParentObservationV2Schema,
  heldLocks: z.tuple([
    HeldLockV2Schema.safeExtend({
      lockRole: z.literal("shared_registry_parent_lock"),
    }).strict(),
    HeldLockV2Schema.safeExtend({
      lockRole: z.literal("registered_node_package_lock"),
    }).strict(),
  ]),
  acquisitionOrder: ExactLockOrderV2Schema,
  bounds: SessionBoundsV2Schema,
  priorTranscriptHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  const scopeHash = value.filesystemScope.scopeIdentityHash;
  const identities = [
    value.parent.objectIdentity,
    ...value.heldLocks.map((lock) => lock.objectIdentity),
  ];
  if (identities.some((identity) =>
    identity.filesystemScopeIdentityHash !== scopeHash)) {
    context.addIssue({
      code: "custom",
      message: "Parent and held locks must belong to the opened filesystem scope",
    });
  }
  if (
    new Set(identities.map((identity) => identity.objectIdentityHash)).size
      !== identities.length
  ) {
    context.addIssue({
      code: "custom",
      message: "Parent and held lock physical identities must be distinct",
    });
  }
  const boundary = value.ownershipBoundary;
  const parentFingerprint = value.parent.fingerprint;
  const parentDevice = value.parent.objectIdentity.device;
  const locksMatchBoundary = value.heldLocks.every((lock) =>
    lock.objectIdentity.device === parentDevice
    && lock.fingerprint.ownerUid === boundary.ownerUid
    && lock.fingerprint.ownerGid === boundary.ownerGid
    && lock.fingerprint.mode === boundary.lockMode
    && lock.fingerprint.linkCount === boundary.lockLinkCount);
  const lockContentMatches =
    value.heldLocks[0]!.contentHash
      === PLATFORM_RELEASE_BOOTSTRAP_NODE_LIVE_OBSERVATION_SHARED_LOCK_CONTENT_HASH_V2
    && value.heldLocks[0]!.fingerprint.byteLength
      === PLATFORM_RELEASE_BOOTSTRAP_NODE_LIVE_OBSERVATION_SHARED_LOCK_CONTENT_BYTES_V2
    && value.heldLocks[1]!.contentHash
      === PLATFORM_RELEASE_BOOTSTRAP_NODE_LIVE_OBSERVATION_NODE_LOCK_CONTENT_HASH_V2
    && value.heldLocks[1]!.fingerprint.byteLength
      === PLATFORM_RELEASE_BOOTSTRAP_NODE_LIVE_OBSERVATION_NODE_LOCK_CONTENT_BYTES_V2;
  const lockNamespaceMatches =
    value.heldLocks[0]!.basename
      === PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_SHARED_LOCK_BASENAME_V2
    && value.heldLocks[0]!.classification.ownerKind === "registry"
    && value.heldLocks[0]!.classification.category === "shared_parent_lock"
    && value.heldLocks[0]!.parentObjectIdentityHash
      === value.parent.objectIdentity.objectIdentityHash
    && value.heldLocks[1]!.basename
      === NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_LOCK_BASENAME_V2
    && value.heldLocks[1]!.classification.ownerKind === "package"
    && value.heldLocks[1]!.classification.ownerRef
      === PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.nodeToolchainProvisioner
    && value.heldLocks[1]!.classification.category === "package_lock"
    && value.heldLocks[1]!.parentObjectIdentityHash
      === value.parent.objectIdentity.objectIdentityHash;
  if (
    parentFingerprint.ownerUid !== boundary.ownerUid
    || parentFingerprint.ownerGid !== boundary.ownerGid
    || parentFingerprint.mode !== boundary.parentMode
    || !locksMatchBoundary
    || !lockContentMatches
    || !lockNamespaceMatches
  ) {
    context.addIssue({
      code: "custom",
      message:
        "Parent and held locks must satisfy the explicit owner, device, mode, link, and fixed-content boundary",
    });
  }
});

export type PlatformReleaseBootstrapNodeLiveObservationSessionOpenFrameV2 =
  z.infer<typeof PlatformReleaseBootstrapNodeLiveObservationSessionOpenFrameV2Schema>;

function frameHashV2(
  domain: string,
  frame: Readonly<Record<string, unknown>>,
  transcriptField: "transcriptHash" | "finalTranscriptHash",
): string {
  const identity = { ...frame };
  delete identity.frameHash;
  delete identity[transcriptField];
  return hashCanonicalJson({ schema: domain, frame: identity });
}

export function nodeLiveObservationTranscriptGenesisHashV2(
  sessionOccurrenceHash: string,
): string {
  return hashCanonicalJson({
    schema: SESSION_TRANSCRIPT_GENESIS_DOMAIN_V2,
    sessionOccurrenceHash,
  });
}

export function rollNodeLiveObservationTranscriptHashV2(input: Readonly<{
  sessionOccurrenceHash: string;
  priorTranscriptHash: string;
  sequence: 0 | 1 | 2 | 3;
  frameHash: string;
}>): string {
  return hashCanonicalJson({
    schema: SESSION_TRANSCRIPT_ROLL_DOMAIN_V2,
    ...input,
  });
}

export function hashNodeLiveObservationSessionOpenFrameV2(
  frame: Readonly<Record<string, unknown>>,
): string {
  return frameHashV2(OPEN_FRAME_HASH_DOMAIN_V2, frame, "transcriptHash");
}

export const PlatformReleaseBootstrapNodeLiveObservationSessionOpenFrameV2Schema =
  OpenFrameIdentityV2Schema.safeExtend({
    frameHash: Sha256Schema,
    transcriptHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const expectedGenesis = nodeLiveObservationTranscriptGenesisHashV2(
      value.sessionOccurrenceHash,
    );
    const expectedFrameHash = hashNodeLiveObservationSessionOpenFrameV2(value);
    if (
      !platformReleaseCandidateFitsCanonicalCapV2(
        value,
        PLATFORM_RELEASE_BOOTSTRAP_NODE_LIVE_OBSERVATION_MAX_CANONICAL_FRAME_BYTES_V2,
      )
      || value.priorTranscriptHash !== expectedGenesis
      || value.frameHash !== expectedFrameHash
      || value.transcriptHash !== rollNodeLiveObservationTranscriptHashV2({
        sessionOccurrenceHash: value.sessionOccurrenceHash,
        priorTranscriptHash: value.priorTranscriptHash,
        sequence: value.sequence,
        frameHash: value.frameHash,
      })
    ) {
      context.addIssue({
        code: "custom",
        message: "Open frame hash or transcript genesis mismatch",
      });
    }
  });

const ObservationFrameIdentityV2Schema = z.object({
  schema: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_NODE_LIVE_OBSERVATION_V2_SCHEMA,
  ),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  sequence: z.literal(1),
  sessionOccurrenceHash: Sha256Schema,
  globalPhysicalCensusHash: Sha256Schema,
  nodeRecursiveEvidence: z.object({
    evidenceHash: Sha256Schema,
    entryCount: z.number().int().nonnegative().max(
      PLATFORM_RELEASE_BOOTSTRAP_NODE_LIVE_OBSERVATION_MAX_RECURSIVE_ENTRIES_V2,
    ),
    complete: z.literal(true),
  }).strict(),
  sourceProjectionHashes: z.object({
    logicalCensusHash: Sha256Schema,
    physicalCensusHash: Sha256Schema,
    nodePackageProjectionHash: Sha256Schema,
    nodePackageLockObjectIdentityHash: Sha256Schema,
  }).strict(),
  globalPhysicalCensusLockBindings: z.object({
    physicalCensusHash: Sha256Schema,
    sharedParentLockCaptureBindingHash: Sha256Schema,
    nodePackageLockCaptureBindingHash: Sha256Schema,
  }).strict(),
  priorTranscriptHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  if (
    value.globalPhysicalCensusHash
      !== value.sourceProjectionHashes.physicalCensusHash
    || value.globalPhysicalCensusHash
      !== value.globalPhysicalCensusLockBindings.physicalCensusHash
  ) {
    context.addIssue({
      code: "custom",
      path: ["sourceProjectionHashes", "physicalCensusHash"],
      message: "Source physical projection must bind the global physical census",
    });
  }
});

export type PlatformReleaseBootstrapNodeLiveObservationFrameV2 =
  z.infer<typeof PlatformReleaseBootstrapNodeLiveObservationFrameV2Schema>;

export function hashNodeLiveObservationFrameV2(
  frame: Readonly<Record<string, unknown>>,
): string {
  return frameHashV2(OBSERVATION_FRAME_HASH_DOMAIN_V2, frame, "transcriptHash");
}

export const PlatformReleaseBootstrapNodeLiveObservationFrameV2Schema =
  ObservationFrameIdentityV2Schema.safeExtend({
    frameHash: Sha256Schema,
    transcriptHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const expectedFrameHash = hashNodeLiveObservationFrameV2(value);
    if (
      !platformReleaseCandidateFitsCanonicalCapV2(
        value,
        PLATFORM_RELEASE_BOOTSTRAP_NODE_LIVE_OBSERVATION_MAX_CANONICAL_FRAME_BYTES_V2,
      )
      || value.frameHash !== expectedFrameHash
      || value.transcriptHash !== rollNodeLiveObservationTranscriptHashV2({
        sessionOccurrenceHash: value.sessionOccurrenceHash,
        priorTranscriptHash: value.priorTranscriptHash,
        sequence: value.sequence,
        frameHash: value.frameHash,
      })
    ) {
      context.addIssue({
        code: "custom",
        message: "Observation frame hash or transcript mismatch",
      });
    }
  });

const AckFrameCommonV2Schema = z.object({
  schema: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_NODE_LIVE_OBSERVATION_ACK_V2_SCHEMA,
  ),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  sequence: z.literal(2),
  sessionOccurrenceHash: Sha256Schema,
  observationTranscriptHash: Sha256Schema,
  priorTranscriptHash: Sha256Schema,
  frameHash: Sha256Schema,
  transcriptHash: Sha256Schema,
});

export const PlatformReleaseBootstrapNodeLiveObservationAckFrameV2Schema =
  z.discriminatedUnion("disposition", [
    AckFrameCommonV2Schema.extend({
      disposition: z.literal("accept_read_only"),
      semanticAcceptanceAuthority: z.literal(
        "unverified_until_explicit_snapshot_join_v2",
      ),
      semanticSnapshotHash: Sha256Schema,
      semanticVerifierContractHash: z.literal(
        NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_LIFECYCLE_SEMANTIC_VERIFIER_CONTRACT_HASH_V2,
      ),
      semanticStatus: z.enum(["ready", "empty_or_rolled_back"]),
    }).strict(),
    AckFrameCommonV2Schema.extend({
      disposition: z.literal("abort"),
      abortReason: z.enum([
        "caller_cancelled",
        "semantic_rejection",
        "observation_not_acceptable",
      ]),
    }).strict(),
  ]).superRefine((value, context) => {
    const expectedFrameHash = hashNodeLiveObservationAckFrameV2(value);
    if (
      !platformReleaseCandidateFitsCanonicalCapV2(
        value,
        PLATFORM_RELEASE_BOOTSTRAP_NODE_LIVE_OBSERVATION_MAX_CANONICAL_FRAME_BYTES_V2,
      )
      || value.observationTranscriptHash !== value.priorTranscriptHash
      || value.frameHash !== expectedFrameHash
      || value.transcriptHash !== rollNodeLiveObservationTranscriptHashV2({
        sessionOccurrenceHash: value.sessionOccurrenceHash,
        priorTranscriptHash: value.priorTranscriptHash,
        sequence: value.sequence,
        frameHash: value.frameHash,
      })
    ) {
      context.addIssue({
        code: "custom",
        message: "Acknowledgement frame hash or transcript mismatch",
      });
    }
  });

export type PlatformReleaseBootstrapNodeLiveObservationAckFrameV2 =
  z.infer<typeof PlatformReleaseBootstrapNodeLiveObservationAckFrameV2Schema>;

export function hashNodeLiveObservationAckFrameV2(
  frame: Readonly<Record<string, unknown>>,
): string {
  return frameHashV2(ACK_FRAME_HASH_DOMAIN_V2, frame, "transcriptHash");
}

const CloseFrameIdentityV2Schema = z.object({
  schema: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_NODE_LIVE_OBSERVATION_SESSION_CLOSE_V2_SCHEMA,
  ),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  sequence: z.literal(3),
  sessionOccurrenceHash: Sha256Schema,
  outcome: z.enum(["accepted_read_only", "aborted"]),
  observationTranscriptHash: Sha256Schema,
  acknowledgementTranscriptHash: Sha256Schema,
  nativeRecaptureEqual: z.boolean(),
  releaseOrder: ExactReleaseOrderV2Schema,
  released: z.literal(true),
  terminal: z.literal(true),
  standaloneAuthority: z.literal(
    "declarative_terminal_frame_not_native_receipt_v2",
  ),
  priorTranscriptHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  if (
    value.acknowledgementTranscriptHash !== value.priorTranscriptHash
    || (value.outcome === "accepted_read_only") !== value.nativeRecaptureEqual
  ) {
    context.addIssue({
      code: "custom",
      path: ["nativeRecaptureEqual"],
      message: "Native recapture equality is true only for an accepted read-only session",
    });
  }
});

export function hashNodeLiveObservationSessionCloseFrameV2(
  frame: Readonly<Record<string, unknown>>,
): string {
  return frameHashV2(CLOSE_FRAME_HASH_DOMAIN_V2, frame, "finalTranscriptHash");
}

export const PlatformReleaseBootstrapNodeLiveObservationSessionCloseFrameV2Schema =
  CloseFrameIdentityV2Schema.safeExtend({
    frameHash: Sha256Schema,
    finalTranscriptHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const expectedFrameHash = hashNodeLiveObservationSessionCloseFrameV2(value);
    if (
      !platformReleaseCandidateFitsCanonicalCapV2(
        value,
        PLATFORM_RELEASE_BOOTSTRAP_NODE_LIVE_OBSERVATION_MAX_CANONICAL_FRAME_BYTES_V2,
      )
      || value.frameHash !== expectedFrameHash
      || value.finalTranscriptHash !== rollNodeLiveObservationTranscriptHashV2({
        sessionOccurrenceHash: value.sessionOccurrenceHash,
        priorTranscriptHash: value.priorTranscriptHash,
        sequence: value.sequence,
        frameHash: value.frameHash,
      })
    ) {
      context.addIssue({
        code: "custom",
        message: "Close frame hash or final transcript mismatch",
      });
    }
  });

export type PlatformReleaseBootstrapNodeLiveObservationSessionCloseFrameV2 =
  z.infer<
    typeof PlatformReleaseBootstrapNodeLiveObservationSessionCloseFrameV2Schema
  >;

export const PlatformReleaseBootstrapNodeLiveObservationSessionV2Schema =
  z.object({
    schema: z.literal(
      PLATFORM_RELEASE_BOOTSTRAP_NODE_LIVE_OBSERVATION_SESSION_V2_SCHEMA,
    ),
    version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
    open: PlatformReleaseBootstrapNodeLiveObservationSessionOpenFrameV2Schema,
    observation: PlatformReleaseBootstrapNodeLiveObservationFrameV2Schema,
    acknowledgement: PlatformReleaseBootstrapNodeLiveObservationAckFrameV2Schema,
    close: PlatformReleaseBootstrapNodeLiveObservationSessionCloseFrameV2Schema,
  }).strict().superRefine((value, context) => {
    const frames = [
      value.open,
      value.observation,
      value.acknowledgement,
      value.close,
    ];
    const sessionOccurrenceHash = value.open.sessionOccurrenceHash;
    const chainMatches =
      frames.every((frame) =>
        frame.sessionOccurrenceHash === sessionOccurrenceHash)
      && value.observation.priorTranscriptHash === value.open.transcriptHash
      && value.acknowledgement.priorTranscriptHash
        === value.observation.transcriptHash
      && value.acknowledgement.observationTranscriptHash
        === value.observation.transcriptHash
      && value.close.priorTranscriptHash
        === value.acknowledgement.transcriptHash
      && value.close.acknowledgementTranscriptHash
        === value.acknowledgement.transcriptHash
      && value.close.observationTranscriptHash
        === value.observation.transcriptHash;
    const lockProjectionMatches =
      value.observation.sourceProjectionHashes
        .nodePackageLockObjectIdentityHash
        === value.open.heldLocks[1].objectIdentity.objectIdentityHash
      && value.observation.globalPhysicalCensusLockBindings
        .sharedParentLockCaptureBindingHash
        === value.open.heldLocks[0].captureBindingHash
      && value.observation.globalPhysicalCensusLockBindings
        .nodePackageLockCaptureBindingHash
        === value.open.heldLocks[1].captureBindingHash;
    const outcomeMatches = value.acknowledgement.disposition
      === "accept_read_only"
      ? value.close.outcome === "accepted_read_only"
        && value.close.nativeRecaptureEqual
      : value.close.outcome === "aborted"
        && !value.close.nativeRecaptureEqual;
    if (!chainMatches || !lockProjectionMatches || !outcomeMatches) {
      context.addIssue({
        code: "custom",
        message:
          "Session frames must form one exact occurrence, transcript, lock projection, and terminal outcome chain",
      });
    }
  });

export type PlatformReleaseBootstrapNodeLiveObservationSessionV2 =
  z.infer<typeof PlatformReleaseBootstrapNodeLiveObservationSessionV2Schema>;

const HeldLockBuilderInputV2Schema = z.object({
  lockRole: z.enum([
    "shared_registry_parent_lock",
    "registered_node_package_lock",
  ]),
  lockMode: z.literal("exclusive_advisory_held"),
  descriptorUse: z.literal("read_only_observation_only"),
  basename: z.string().min(1).max(255),
  classification: PlatformReleaseBootstrapNamespaceClassificationV2Schema,
  parentObjectIdentityHash: Sha256Schema,
  objectIdentity: StableFsObjectIdentityV2Schema,
  fingerprint: FsObservationFingerprintV2Schema,
  contentHash: Sha256Schema,
}).strict();

const OpenBuilderInputV2Schema = z.object({
  sessionOccurrenceHash: Sha256Schema,
  filesystemScope: BootstrapFilesystemScopeIdentityV2Schema,
  parent: ParentObservationV2Schema,
  heldLocks: z.tuple([
    HeldLockBuilderInputV2Schema.extend({
      lockRole: z.literal("shared_registry_parent_lock"),
    }).strict(),
    HeldLockBuilderInputV2Schema.extend({
      lockRole: z.literal("registered_node_package_lock"),
    }).strict(),
  ]),
}).strict();

const ObservationBuilderInputV2Schema = z.object({
  globalPhysicalCensusHash: Sha256Schema,
  nodeRecursiveEvidence: z.object({
    evidenceHash: Sha256Schema,
    entryCount: z.number().int().nonnegative().max(
      PLATFORM_RELEASE_BOOTSTRAP_NODE_LIVE_OBSERVATION_MAX_RECURSIVE_ENTRIES_V2,
    ),
    complete: z.literal(true),
  }).strict(),
  sourceProjectionHashes: z.object({
    logicalCensusHash: Sha256Schema,
    physicalCensusHash: Sha256Schema,
    nodePackageProjectionHash: Sha256Schema,
    nodePackageLockObjectIdentityHash: Sha256Schema,
  }).strict(),
  globalPhysicalCensusLockBindings: z.object({
    physicalCensusHash: Sha256Schema,
    sharedParentLockCaptureBindingHash: Sha256Schema,
    nodePackageLockCaptureBindingHash: Sha256Schema,
  }).strict(),
}).strict().superRefine((value, context) => {
  if (
    value.globalPhysicalCensusHash
      !== value.sourceProjectionHashes.physicalCensusHash
    || value.globalPhysicalCensusHash
      !== value.globalPhysicalCensusLockBindings.physicalCensusHash
  ) {
    context.addIssue({
      code: "custom",
      path: ["sourceProjectionHashes", "physicalCensusHash"],
      message: "Source physical projection must bind the global physical census",
    });
  }
});

const AckBuilderInputV2Schema = z.discriminatedUnion("disposition", [
  z.object({
    disposition: z.literal("accept_read_only"),
    semanticSnapshot:
      NodeToolchainProvisionerBootstrapLifecycleSemanticSnapshotV2Schema,
  }).strict(),
  z.object({
    disposition: z.literal("abort"),
    abortReason: z.enum([
      "caller_cancelled",
      "semantic_rejection",
      "observation_not_acceptable",
    ]),
  }).strict(),
]);

function snapshotFrameV2(input: unknown): unknown {
  return boundedPlatformReleaseJsonSnapshotV2(
    input,
    PLATFORM_RELEASE_BOOTSTRAP_NODE_LIVE_OBSERVATION_MAX_CANONICAL_FRAME_BYTES_V2,
  );
}

export function parseNodeLiveObservationSessionOpenFrameCandidateV2(
  input: unknown,
): PlatformReleaseBootstrapNodeLiveObservationSessionOpenFrameV2 {
  return deepFreezePlatformReleaseJsonV2(
    PlatformReleaseBootstrapNodeLiveObservationSessionOpenFrameV2Schema.parse(
      snapshotFrameV2(input),
    ),
  );
}

export function parseNodeLiveObservationFrameCandidateV2(
  input: unknown,
): PlatformReleaseBootstrapNodeLiveObservationFrameV2 {
  return deepFreezePlatformReleaseJsonV2(
    PlatformReleaseBootstrapNodeLiveObservationFrameV2Schema.parse(
      snapshotFrameV2(input),
    ),
  );
}

export function parseNodeLiveObservationAckFrameCandidateV2(
  input: unknown,
): PlatformReleaseBootstrapNodeLiveObservationAckFrameV2 {
  return deepFreezePlatformReleaseJsonV2(
    PlatformReleaseBootstrapNodeLiveObservationAckFrameV2Schema.parse(
      snapshotFrameV2(input),
    ),
  );
}

export function parseNodeLiveObservationSessionCloseFrameCandidateV2(
  input: unknown,
): PlatformReleaseBootstrapNodeLiveObservationSessionCloseFrameV2 {
  return deepFreezePlatformReleaseJsonV2(
    PlatformReleaseBootstrapNodeLiveObservationSessionCloseFrameV2Schema.parse(
      snapshotFrameV2(input),
    ),
  );
}

export function parseNodeLiveObservationSessionCandidateV2(
  input: unknown,
): PlatformReleaseBootstrapNodeLiveObservationSessionV2 {
  const snapshot = boundedPlatformReleaseJsonSnapshotV2(
    input,
    PLATFORM_RELEASE_BOOTSTRAP_NODE_LIVE_OBSERVATION_MAX_CANONICAL_SESSION_BYTES_V2,
  );
  return deepFreezePlatformReleaseJsonV2(
    PlatformReleaseBootstrapNodeLiveObservationSessionV2Schema.parse(snapshot),
  );
}

export function buildNodeLiveObservationSessionOpenFrameV2(
  input: z.input<typeof OpenBuilderInputV2Schema>,
): PlatformReleaseBootstrapNodeLiveObservationSessionOpenFrameV2 {
  const parsed = OpenBuilderInputV2Schema.parse(snapshotFrameV2(input));
  const priorTranscriptHash = nodeLiveObservationTranscriptGenesisHashV2(
    parsed.sessionOccurrenceHash,
  );
  const heldLocks = parsed.heldLocks.map((lock) => ({
    ...lock,
    captureBindingHash:
      hashNodeLiveObservationHeldLockCaptureBindingV2(lock),
  })) as [
    z.infer<typeof HeldLockV2Schema>,
    z.infer<typeof HeldLockV2Schema>,
  ];
  const identity = {
    schema: PLATFORM_RELEASE_BOOTSTRAP_NODE_LIVE_OBSERVATION_SESSION_OPEN_V2_SCHEMA,
    version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
    sequence: 0,
    sessionOccurrenceHash: parsed.sessionOccurrenceHash,
    admissionScope: "test_fixture",
    productionAuthority: false,
    signingAuthority: "unsigned_test_fixture",
    operationMode: "read_only_observation",
    mutationPolicy: "forbidden_no_payload_or_callback_surface",
    ownershipBoundary: {
      ownerUid: parsed.parent.fingerprint.ownerUid,
      ownerGid: parsed.parent.fingerprint.ownerGid,
      parentMode: "0755",
      lockMode: "0600",
      lockLinkCount: 1,
    },
    filesystemScope: parsed.filesystemScope,
    parent: parsed.parent,
    heldLocks,
    acquisitionOrder: [...PLATFORM_RELEASE_BOOTSTRAP_NODE_LIVE_OBSERVATION_LOCK_ORDER_V2],
    bounds: {
      maxCanonicalFrameBytes:
        PLATFORM_RELEASE_BOOTSTRAP_NODE_LIVE_OBSERVATION_MAX_CANONICAL_FRAME_BYTES_V2,
      maxRecursiveEntries:
        PLATFORM_RELEASE_BOOTSTRAP_NODE_LIVE_OBSERVATION_MAX_RECURSIVE_ENTRIES_V2,
      maxFrames: PLATFORM_RELEASE_BOOTSTRAP_NODE_LIVE_OBSERVATION_FRAME_COUNT_V2,
    },
    priorTranscriptHash,
  } as const;
  const frameHash = hashNodeLiveObservationSessionOpenFrameV2(identity);
  return parseNodeLiveObservationSessionOpenFrameCandidateV2({
    ...identity,
    frameHash,
    transcriptHash: rollNodeLiveObservationTranscriptHashV2({
      sessionOccurrenceHash: identity.sessionOccurrenceHash,
      priorTranscriptHash,
      sequence: 0,
      frameHash,
    }),
  });
}

export function buildNodeLiveObservationFrameV2(
  open: PlatformReleaseBootstrapNodeLiveObservationSessionOpenFrameV2,
  input: z.input<typeof ObservationBuilderInputV2Schema>,
): PlatformReleaseBootstrapNodeLiveObservationFrameV2 {
  const parsedOpen = parseNodeLiveObservationSessionOpenFrameCandidateV2(open);
  const parsed = ObservationBuilderInputV2Schema.parse(snapshotFrameV2(input));
  const identity = {
    schema: PLATFORM_RELEASE_BOOTSTRAP_NODE_LIVE_OBSERVATION_V2_SCHEMA,
    version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
    sequence: 1,
    sessionOccurrenceHash: parsedOpen.sessionOccurrenceHash,
    ...parsed,
    priorTranscriptHash: parsedOpen.transcriptHash,
  } as const;
  const frameHash = hashNodeLiveObservationFrameV2(identity);
  return parseNodeLiveObservationFrameCandidateV2({
    ...identity,
    frameHash,
    transcriptHash: rollNodeLiveObservationTranscriptHashV2({
      sessionOccurrenceHash: identity.sessionOccurrenceHash,
      priorTranscriptHash: identity.priorTranscriptHash,
      sequence: 1,
      frameHash,
    }),
  });
}

export function buildNodeLiveObservationAckFrameV2(
  observation: PlatformReleaseBootstrapNodeLiveObservationFrameV2,
  input: z.input<typeof AckBuilderInputV2Schema>,
): PlatformReleaseBootstrapNodeLiveObservationAckFrameV2 {
  const parsedObservation = parseNodeLiveObservationFrameCandidateV2(observation);
  const parsed = AckBuilderInputV2Schema.parse(
    boundedPlatformReleaseJsonSnapshotV2(
      input,
      NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_LIFECYCLE_SEMANTIC_SNAPSHOT_MAX_CANONICAL_BYTES_V2
        + PLATFORM_RELEASE_BOOTSTRAP_NODE_LIVE_OBSERVATION_MAX_CANONICAL_FRAME_BYTES_V2,
    ),
  );
  const acknowledgement = parsed.disposition === "accept_read_only"
    ? (() => {
        const semanticSnapshot =
          parseNodeToolchainProvisionerBootstrapLifecycleSemanticSnapshotCandidateV2(
            parsed.semanticSnapshot,
          );
        return {
          disposition: "accept_read_only" as const,
          semanticAcceptanceAuthority:
            "unverified_until_explicit_snapshot_join_v2" as const,
          semanticSnapshotHash: semanticSnapshot.snapshotHash,
          semanticVerifierContractHash:
            NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_LIFECYCLE_SEMANTIC_VERIFIER_CONTRACT_HASH_V2,
          semanticStatus: semanticSnapshot.status,
        };
      })()
    : parsed;
  const identity = {
    schema: PLATFORM_RELEASE_BOOTSTRAP_NODE_LIVE_OBSERVATION_ACK_V2_SCHEMA,
    version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
    sequence: 2,
    sessionOccurrenceHash: parsedObservation.sessionOccurrenceHash,
    observationTranscriptHash: parsedObservation.transcriptHash,
    priorTranscriptHash: parsedObservation.transcriptHash,
    ...acknowledgement,
  } as const;
  const frameHash = hashNodeLiveObservationAckFrameV2(identity);
  return parseNodeLiveObservationAckFrameCandidateV2({
    ...identity,
    frameHash,
    transcriptHash: rollNodeLiveObservationTranscriptHashV2({
      sessionOccurrenceHash: identity.sessionOccurrenceHash,
      priorTranscriptHash: identity.priorTranscriptHash,
      sequence: 2,
      frameHash,
    }),
  });
}

export function buildNodeLiveObservationSessionCloseFrameV2(
  observation: PlatformReleaseBootstrapNodeLiveObservationFrameV2,
  acknowledgement: PlatformReleaseBootstrapNodeLiveObservationAckFrameV2,
  nativeRecaptureEqual: boolean,
): PlatformReleaseBootstrapNodeLiveObservationSessionCloseFrameV2 {
  const parsedObservation = parseNodeLiveObservationFrameCandidateV2(observation);
  const parsedAcknowledgement =
    parseNodeLiveObservationAckFrameCandidateV2(acknowledgement);
  if (
    parsedAcknowledgement.sessionOccurrenceHash
      !== parsedObservation.sessionOccurrenceHash
    || parsedAcknowledgement.observationTranscriptHash
      !== parsedObservation.transcriptHash
    || parsedAcknowledgement.priorTranscriptHash
      !== parsedObservation.transcriptHash
  ) {
    throw new TypeError(
      "Close builder requires one exact observation and acknowledgement chain",
    );
  }
  const identity = {
    schema: PLATFORM_RELEASE_BOOTSTRAP_NODE_LIVE_OBSERVATION_SESSION_CLOSE_V2_SCHEMA,
    version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
    sequence: 3,
    sessionOccurrenceHash: parsedAcknowledgement.sessionOccurrenceHash,
    outcome: parsedAcknowledgement.disposition === "accept_read_only"
      ? "accepted_read_only"
      : "aborted",
    observationTranscriptHash: parsedObservation.transcriptHash,
    acknowledgementTranscriptHash: parsedAcknowledgement.transcriptHash,
    nativeRecaptureEqual,
    releaseOrder: [...PLATFORM_RELEASE_BOOTSTRAP_NODE_LIVE_OBSERVATION_RELEASE_ORDER_V2],
    released: true,
    terminal: true,
    standaloneAuthority:
      "declarative_terminal_frame_not_native_receipt_v2",
    priorTranscriptHash: parsedAcknowledgement.transcriptHash,
  } as const;
  const frameHash = hashNodeLiveObservationSessionCloseFrameV2(identity);
  return parseNodeLiveObservationSessionCloseFrameCandidateV2({
    ...identity,
    frameHash,
    finalTranscriptHash: rollNodeLiveObservationTranscriptHashV2({
      sessionOccurrenceHash: identity.sessionOccurrenceHash,
      priorTranscriptHash: identity.priorTranscriptHash,
      sequence: 3,
      frameHash,
    }),
  });
}

const SemanticJoinReceiptIdentityV2Schema = z.object({
  schema: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_NODE_LIVE_OBSERVATION_SEMANTIC_JOIN_RECEIPT_V2_SCHEMA,
  ),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  admissionScope: z.literal("test_fixture"),
  productionAuthority: z.literal(false),
  semanticAcceptanceAuthority: z.literal(
    "self_asserted_requires_explicit_rejoin_v2",
  ),
  sessionOccurrenceHash: Sha256Schema,
  observationTranscriptHash: Sha256Schema,
  finalTranscriptHash: Sha256Schema,
  globalPhysicalCensusHash: Sha256Schema,
  nodeRecursiveEvidenceHash: Sha256Schema,
  semanticSnapshotHash: Sha256Schema,
  semanticVerifierContractHash: z.literal(
    NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_LIFECYCLE_SEMANTIC_VERIFIER_CONTRACT_HASH_V2,
  ),
  semanticStatus: z.enum(["ready", "empty_or_rolled_back"]),
}).strict();

export function hashNodeLiveObservationSemanticJoinReceiptV2(
  value: Readonly<Record<string, unknown>>,
): string {
  const receipt = { ...value };
  delete receipt.joinHash;
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-bootstrap-node-live-observation-semantic-join-receipt-hash.v2",
    receipt,
  });
}

export const PlatformReleaseBootstrapNodeLiveObservationSemanticJoinReceiptV2Schema =
  SemanticJoinReceiptIdentityV2Schema.extend({
    joinHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (
      value.joinHash !== hashNodeLiveObservationSemanticJoinReceiptV2(value)
      || !platformReleaseCandidateFitsCanonicalCapV2(
        value,
        PLATFORM_RELEASE_BOOTSTRAP_NODE_LIVE_OBSERVATION_MAX_CANONICAL_FRAME_BYTES_V2,
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["joinHash"],
        message: "Semantic join receipt must be self-hashed and bounded",
      });
    }
  });

export type PlatformReleaseBootstrapNodeLiveObservationSemanticJoinReceiptV2 =
  z.infer<
    typeof PlatformReleaseBootstrapNodeLiveObservationSemanticJoinReceiptV2Schema
  >;

export function parseNodeLiveObservationSemanticJoinReceiptCandidateV2(
  input: unknown,
): PlatformReleaseBootstrapNodeLiveObservationSemanticJoinReceiptV2 {
  return deepFreezePlatformReleaseJsonV2(
    PlatformReleaseBootstrapNodeLiveObservationSemanticJoinReceiptV2Schema.parse(
      snapshotFrameV2(input),
    ),
  );
}

export function joinNodeLiveObservationSessionToSemanticSnapshotV2(
  sessionInput: unknown,
  semanticSnapshotInput: unknown,
): PlatformReleaseBootstrapNodeLiveObservationSemanticJoinReceiptV2 {
  const session = parseNodeLiveObservationSessionCandidateV2(sessionInput);
  const semanticSnapshot =
    parseNodeToolchainProvisionerBootstrapLifecycleSemanticSnapshotCandidateV2(
      semanticSnapshotInput,
    );
  const acknowledgement = session.acknowledgement;
  const nodeLock = session.open.heldLocks[1];
  const binding = semanticSnapshot.liveObservationBinding;
  const accepted = acknowledgement.disposition === "accept_read_only"
    && acknowledgement.semanticAcceptanceAuthority
      === "unverified_until_explicit_snapshot_join_v2"
    && acknowledgement.semanticSnapshotHash === semanticSnapshot.snapshotHash
    && acknowledgement.semanticVerifierContractHash
      === NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_LIFECYCLE_SEMANTIC_VERIFIER_CONTRACT_HASH_V2
    && acknowledgement.semanticVerifierContractHash
      === semanticSnapshot.semanticVerifierContractHash
    && acknowledgement.semanticStatus === semanticSnapshot.status
    && binding.sessionOccurrenceHash === session.open.sessionOccurrenceHash
    && binding.observationTranscriptHash === session.observation.transcriptHash
    && binding.globalPhysicalCensusHash
      === session.observation.globalPhysicalCensusHash
    && binding.nodeRecursiveEvidenceHash
      === session.observation.nodeRecursiveEvidence.evidenceHash
    && semanticSnapshot.sourceLogicalCensusHash
      === session.observation.sourceProjectionHashes.logicalCensusHash
    && semanticSnapshot.sourcePhysicalCensusHash
      === session.observation.sourceProjectionHashes.physicalCensusHash
    && semanticSnapshot.nodePhysicalProjectionHash
      === session.observation.sourceProjectionHashes.nodePackageProjectionHash
    && canonicalJsonStringify(semanticSnapshot.filesystemScope)
      === canonicalJsonStringify(session.open.filesystemScope)
    && semanticSnapshot.expectedOwner.uid
      === session.open.ownershipBoundary.ownerUid
    && semanticSnapshot.expectedOwner.gid
      === session.open.ownershipBoundary.ownerGid
    && canonicalJsonStringify(semanticSnapshot.heldPackageLock.objectIdentity)
      === canonicalJsonStringify(nodeLock.objectIdentity)
    && canonicalJsonStringify(semanticSnapshot.heldPackageLock.fingerprint)
      === canonicalJsonStringify(nodeLock.fingerprint)
    && semanticSnapshot.heldPackageLock.rawContentHash === nodeLock.contentHash
    && semanticSnapshot.nodePhysicalProjection.orderedEntryCaptures.every(
      (capture) =>
        capture.parentObjectIdentityHash
          === session.open.parent.objectIdentity.objectIdentityHash,
    )
    && session.close.outcome === "accepted_read_only"
    && session.close.nativeRecaptureEqual
    && session.close.released
    && session.close.terminal;
  if (!accepted) {
    throw new TypeError(
      "Live observation session does not exactly join the verified semantic snapshot",
    );
  }
  const identity = {
    schema:
      PLATFORM_RELEASE_BOOTSTRAP_NODE_LIVE_OBSERVATION_SEMANTIC_JOIN_RECEIPT_V2_SCHEMA,
    version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
    admissionScope: "test_fixture",
    productionAuthority: false,
    semanticAcceptanceAuthority:
      "self_asserted_requires_explicit_rejoin_v2",
    sessionOccurrenceHash: session.open.sessionOccurrenceHash,
    observationTranscriptHash: session.observation.transcriptHash,
    finalTranscriptHash: session.close.finalTranscriptHash,
    globalPhysicalCensusHash: session.observation.globalPhysicalCensusHash,
    nodeRecursiveEvidenceHash:
      session.observation.nodeRecursiveEvidence.evidenceHash,
    semanticSnapshotHash: semanticSnapshot.snapshotHash,
    semanticVerifierContractHash:
      NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_LIFECYCLE_SEMANTIC_VERIFIER_CONTRACT_HASH_V2,
    semanticStatus: semanticSnapshot.status,
  } as const;
  return parseNodeLiveObservationSemanticJoinReceiptCandidateV2({
    ...identity,
    joinHash: hashNodeLiveObservationSemanticJoinReceiptV2(identity),
  });
}

export function verifyNodeLiveObservationSemanticJoinReceiptV2(
  receiptInput: unknown,
  sessionInput: unknown,
  semanticSnapshotInput: unknown,
): true {
  const receipt = parseNodeLiveObservationSemanticJoinReceiptCandidateV2(
    receiptInput,
  );
  const rejoined = joinNodeLiveObservationSessionToSemanticSnapshotV2(
    sessionInput,
    semanticSnapshotInput,
  );
  if (
    canonicalJsonStringify(receipt) !== canonicalJsonStringify(rejoined)
  ) {
    throw new TypeError(
      "Self-asserted semantic join receipt does not equal an explicit fresh rejoin",
    );
  }
  return true;
}

const IncompletenessBlockerV2Schema = z.enum([
  "unsigned_test_fixture",
  "native_live_session_driver_absent",
  "mutation_surface_intentionally_absent",
  "production_backend_capability_absent",
  "semantic_snapshot_join_required",
  "native_recapture_proof_absent",
  "native_release_proof_absent",
]);

const IncompletenessIdentityV2Schema = z.object({
  schema: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_NODE_LIVE_OBSERVATION_INCOMPLETENESS_V2_SCHEMA,
  ),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  admissionScope: z.literal("test_fixture"),
  productionAuthority: z.literal(false),
  signatureStatus: z.literal("unsigned_test_fixture"),
  nativeLiveSessionDriverAvailable: z.literal(false),
  mutationSurfaceAvailable: z.literal(false),
  productionBackendCapabilityAvailable: z.literal(false),
  failurePolicy: z.literal(
    "invalid_or_incomplete_chain_yields_no_session_receipt",
  ),
  abortPolicy: z.literal(
    "abort_requires_terminal_reverse_release_without_acceptance_recapture",
  ),
  frameCount: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_NODE_LIVE_OBSERVATION_FRAME_COUNT_V2,
  ),
  blockers: z.tuple([
    z.literal("unsigned_test_fixture"),
    z.literal("native_live_session_driver_absent"),
    z.literal("mutation_surface_intentionally_absent"),
    z.literal("production_backend_capability_absent"),
    z.literal("semantic_snapshot_join_required"),
    z.literal("native_recapture_proof_absent"),
    z.literal("native_release_proof_absent"),
  ]),
}).strict();

export function hashNodeLiveObservationIncompletenessCatalogV2(
  value: Readonly<Record<string, unknown>>,
): string {
  const identity = { ...value };
  delete identity.catalogHash;
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-bootstrap-node-live-observation-incompleteness-hash.v2",
    catalog: identity,
  });
}

let exactIncompletenessCanonicalV2: string | undefined;

export const PlatformReleaseBootstrapNodeLiveObservationIncompletenessV2Schema =
  IncompletenessIdentityV2Schema.extend({
    catalogHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (
      !platformReleaseCandidateFitsCanonicalCapV2(
        value,
        PLATFORM_RELEASE_BOOTSTRAP_NODE_LIVE_OBSERVATION_MAX_CANONICAL_FRAME_BYTES_V2,
      )
      || value.blockers.some((blocker) =>
        !IncompletenessBlockerV2Schema.safeParse(blocker).success)
      || (exactIncompletenessCanonicalV2 !== undefined
        && canonicalJsonStringify(value) !== exactIncompletenessCanonicalV2)
      || value.catalogHash
        !== hashNodeLiveObservationIncompletenessCatalogV2(value)
    ) {
      context.addIssue({
        code: "custom",
        path: ["catalogHash"],
        message: "Incompleteness catalog must equal the exact non-production blocker set",
      });
    }
  });

export type PlatformReleaseBootstrapNodeLiveObservationIncompletenessV2 =
  z.infer<
    typeof PlatformReleaseBootstrapNodeLiveObservationIncompletenessV2Schema
  >;

const incompletenessIdentityV2 = {
  schema: PLATFORM_RELEASE_BOOTSTRAP_NODE_LIVE_OBSERVATION_INCOMPLETENESS_V2_SCHEMA,
  version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
  admissionScope: "test_fixture",
  productionAuthority: false,
  signatureStatus: "unsigned_test_fixture",
  nativeLiveSessionDriverAvailable: false,
  mutationSurfaceAvailable: false,
  productionBackendCapabilityAvailable: false,
  failurePolicy: "invalid_or_incomplete_chain_yields_no_session_receipt",
  abortPolicy:
    "abort_requires_terminal_reverse_release_without_acceptance_recapture",
  frameCount: PLATFORM_RELEASE_BOOTSTRAP_NODE_LIVE_OBSERVATION_FRAME_COUNT_V2,
  blockers: [
    "unsigned_test_fixture",
    "native_live_session_driver_absent",
    "mutation_surface_intentionally_absent",
    "production_backend_capability_absent",
    "semantic_snapshot_join_required",
    "native_recapture_proof_absent",
    "native_release_proof_absent",
  ],
} as const;

const parsedIncompletenessV2 =
  PlatformReleaseBootstrapNodeLiveObservationIncompletenessV2Schema.parse({
    ...incompletenessIdentityV2,
    catalogHash: hashNodeLiveObservationIncompletenessCatalogV2(
      incompletenessIdentityV2,
    ),
  });
exactIncompletenessCanonicalV2 = canonicalJsonStringify(parsedIncompletenessV2);

export const PLATFORM_RELEASE_BOOTSTRAP_NODE_LIVE_OBSERVATION_INCOMPLETENESS_V2:
  PlatformReleaseBootstrapNodeLiveObservationIncompletenessV2 =
    deepFreezePlatformReleaseJsonV2(parsedIncompletenessV2);

export function parseNodeLiveObservationIncompletenessCandidateV2(
  input: unknown,
): PlatformReleaseBootstrapNodeLiveObservationIncompletenessV2 {
  return deepFreezePlatformReleaseJsonV2(
    PlatformReleaseBootstrapNodeLiveObservationIncompletenessV2Schema.parse(
      snapshotFrameV2(input),
    ),
  );
}
