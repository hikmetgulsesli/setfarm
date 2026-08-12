import { z } from "zod";

import {
  canonicalJsonStringify,
  hashCanonicalJson,
} from "../../product-compiler/canonical-json.js";
import {
  Sha256Schema,
} from "../../product-compiler/schemas/common-v1.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2,
  PlatformReleaseBootstrapPackageRefV2Schema,
} from "./platform-release-bootstrap-operation-abis-v2.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2,
  PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_ACTIVATION_CLAIM_V2_SCHEMA,
  PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_ACTIVATION_RECEIPT_V2_SCHEMA,
  PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_ACTIVATION_MIGRATOR_PROTOCOL_HASH_V2,
  PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_DOCUMENT_PROTOCOL_CATALOG_V2,
  PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_EPOCH_CLAIM_V2_SCHEMA,
  PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_EPOCH_FLOOR_STATE_V2_SCHEMA,
  PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_OFFLINE_ROLLBACK_AUTHORIZATION_V2_SCHEMA,
} from "./platform-release-bootstrap-contract-v2.js";
import {
  PLATFORM_RELEASE_COMPONENT_VERSION_V2,
  boundedPlatformReleaseJsonSnapshotV2,
  deepFreezePlatformReleaseJsonV2,
  platformReleaseCandidateFitsCanonicalCapV2,
} from "./platform-release-common-v2.js";

const REGISTRY_REF_V2 =
  PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.registry.registryRef;
const REGISTRY_CONTRACT_HASH_V2 =
  PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.contractHash;
const MINIMUM_DISTRIBUTION_EPOCH_V2 =
  PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.productionTrust
    .minimumDistributionEpoch;

function registryDocumentMaxCanonicalBytesV2(
  schemaRef: string,
): number {
  const protocol =
    PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_DOCUMENT_PROTOCOL_CATALOG_V2
      .documents.find((entry) => entry.schemaRef === schemaRef);
  if (!protocol) {
    throw new TypeError(
      "Registry document schema reference is not code-owned",
    );
  }
  return protocol.maxCanonicalBytes;
}

export const PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_ACTIVATION_RECEIPT_MAX_CANONICAL_BYTES_V2 =
  registryDocumentMaxCanonicalBytesV2(
    PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_ACTIVATION_RECEIPT_V2_SCHEMA,
  );
export const PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_ACTIVATION_CLAIM_MAX_CANONICAL_BYTES_V2 =
  registryDocumentMaxCanonicalBytesV2(
    PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_ACTIVATION_CLAIM_V2_SCHEMA,
  );
export const PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_EPOCH_FLOOR_STATE_MAX_CANONICAL_BYTES_V2 =
  registryDocumentMaxCanonicalBytesV2(
    PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_EPOCH_FLOOR_STATE_V2_SCHEMA,
  );
export const PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_EPOCH_CLAIM_MAX_CANONICAL_BYTES_V2 =
  registryDocumentMaxCanonicalBytesV2(
    PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_EPOCH_CLAIM_V2_SCHEMA,
  );
export const PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_OFFLINE_ROLLBACK_AUTHORIZATION_MAX_CANONICAL_BYTES_V2 =
  registryDocumentMaxCanonicalBytesV2(
    PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_OFFLINE_ROLLBACK_AUTHORIZATION_V2_SCHEMA,
  );

const NonnegativeSafeIntegerV2Schema =
  z.number().int().nonnegative().safe();

export const PlatformReleaseBootstrapRegistryEd25519SignatureV2Schema =
  z.string()
    .length(88)
    .regex(
      /^[A-Za-z0-9+/]{86}==$/,
      "Expected one canonical base64 Ed25519 signature",
    )
    .refine((value) => {
      const bytes = Buffer.from(value, "base64");
      return bytes.length === 64 && bytes.toString("base64") === value;
    }, "Expected exactly 64 canonical Ed25519 signature bytes");

const ExactUtcMillisecondTimestampV2Schema = z.string()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u,
    "Expected one exact UTC millisecond timestamp",
  )
  .refine((value) => {
    const milliseconds = Date.parse(value);
    return !Number.isNaN(milliseconds)
      && new Date(milliseconds).toISOString() === value;
  }, "Expected one valid round-tripping UTC timestamp");

export const PlatformReleaseBootstrapRegistryPackageEpochArtifactV2Schema =
  z.object({
    distributionEpoch: NonnegativeSafeIntegerV2Schema,
    artifactHash: Sha256Schema.nullable(),
  }).strict().superRefine((value, context) => {
    if (
      (value.distributionEpoch === 0) !== (value.artifactHash === null)
    ) {
      context.addIssue({
        code: "custom",
        path: ["artifactHash"],
        message:
          "Epoch zero is the no-artifact sentinel; admitted epochs require an exact artifact hash",
      });
    }
  });

export type PlatformReleaseBootstrapRegistryPackageEpochArtifactV2 =
  z.infer<
    typeof PlatformReleaseBootstrapRegistryPackageEpochArtifactV2Schema
  >;

export const PlatformReleaseBootstrapRegistryPackageEpochArtifactMapV2Schema =
  z.object({
    [PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.hostVerifier]:
      PlatformReleaseBootstrapRegistryPackageEpochArtifactV2Schema,
    [PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.nodeToolchainProvisioner]:
      PlatformReleaseBootstrapRegistryPackageEpochArtifactV2Schema,
    [PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.platformReleaseComposition]:
      PlatformReleaseBootstrapRegistryPackageEpochArtifactV2Schema,
    [PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.runtimeAccountProvisioner]:
      PlatformReleaseBootstrapRegistryPackageEpochArtifactV2Schema,
  }).strict();

export type PlatformReleaseBootstrapRegistryPackageEpochArtifactMapV2 =
  z.infer<
    typeof PlatformReleaseBootstrapRegistryPackageEpochArtifactMapV2Schema
  >;

function exactGenesisPackageEpochArtifactMapV2():
PlatformReleaseBootstrapRegistryPackageEpochArtifactMapV2 {
  return {
    [PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.hostVerifier]: {
      distributionEpoch: 0,
      artifactHash: null,
    },
    [PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.nodeToolchainProvisioner]:
      {
        distributionEpoch: 0,
        artifactHash: null,
      },
    [PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.platformReleaseComposition]:
      {
        distributionEpoch: 0,
        artifactHash: null,
      },
    [PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.runtimeAccountProvisioner]:
      {
        distributionEpoch: 0,
        artifactHash: null,
      },
  };
}

function exactGenesisEpochFloorStateIdentityV2() {
  return {
    schema:
      PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_EPOCH_FLOOR_STATE_V2_SCHEMA,
    version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
    registryRef: REGISTRY_REF_V2,
    registryContractHash: REGISTRY_CONTRACT_HASH_V2,
    generation: 0,
    priorEpochStateHash: null,
    transactionIdentityHash: null,
    packageEpochArtifactMap: exactGenesisPackageEpochArtifactMapV2(),
  } as const;
}

function exactGenesisEpochFloorStateHashV2(): string {
  return hashPlatformReleaseBootstrapRegistryEpochFloorStateV2(
    exactGenesisEpochFloorStateIdentityV2(),
  );
}

type RegistryDocumentHashPreimageV2 = Readonly<{
  schema: string;
  document: Readonly<Record<string, unknown>>;
}>;

function buildRegistryDocumentHashPreimageV2(
  schema: string,
  selfHashField: string,
  value: Readonly<Record<string, unknown>>,
): RegistryDocumentHashPreimageV2 {
  const document = { ...value };
  delete document[selfHashField];
  return deepFreezePlatformReleaseJsonV2(
    structuredClone({ schema, document }),
  );
}

const ActivationReceiptIdentityV2Schema = z.object({
  schema: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_ACTIVATION_RECEIPT_V2_SCHEMA,
  ),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  registryRef: z.literal(REGISTRY_REF_V2),
  registryContractHash: z.literal(REGISTRY_CONTRACT_HASH_V2),
  sharedLockIdentityHash: Sha256Schema,
  legacyNodeLockIdentityHash: Sha256Schema,
  nodeLifecycleIdentityHash: Sha256Schema,
  parentIdentityHash: Sha256Schema,
  genesisEpochStateHash: Sha256Schema,
}).strict();

export type PlatformReleaseBootstrapRegistryActivationReceiptHashPayloadV2 =
  z.infer<typeof ActivationReceiptIdentityV2Schema>;

export function buildPlatformReleaseBootstrapRegistryActivationReceiptHashPreimageV2(
  value:
    | PlatformReleaseBootstrapRegistryActivationReceiptHashPayloadV2
    | PlatformReleaseBootstrapRegistryActivationReceiptV2
    | Readonly<Record<string, unknown>>,
): RegistryDocumentHashPreimageV2 {
  return buildRegistryDocumentHashPreimageV2(
    "setfarm.platform-release-bootstrap-registry-activation-receipt-hash.v2",
    "activationReceiptHash",
    value,
  );
}

export function hashPlatformReleaseBootstrapRegistryActivationReceiptV2(
  value:
    | PlatformReleaseBootstrapRegistryActivationReceiptHashPayloadV2
    | PlatformReleaseBootstrapRegistryActivationReceiptV2
    | Readonly<Record<string, unknown>>,
): string {
  return hashCanonicalJson(
    buildPlatformReleaseBootstrapRegistryActivationReceiptHashPreimageV2(
      value,
    ),
  );
}

export const PlatformReleaseBootstrapRegistryActivationReceiptV2Schema =
  ActivationReceiptIdentityV2Schema.extend({
    activationReceiptHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const cutoverHashes = [
      value.sharedLockIdentityHash,
      value.legacyNodeLockIdentityHash,
      value.nodeLifecycleIdentityHash,
      value.parentIdentityHash,
      value.genesisEpochStateHash,
    ];
    if (
      !platformReleaseCandidateFitsCanonicalCapV2(
        value,
        PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_ACTIVATION_RECEIPT_MAX_CANONICAL_BYTES_V2,
      )
      || new Set(cutoverHashes).size !== cutoverHashes.length
      || value.genesisEpochStateHash
        !== exactGenesisEpochFloorStateHashV2()
      || value.activationReceiptHash
        !==
          hashPlatformReleaseBootstrapRegistryActivationReceiptV2(
            value,
          )
    ) {
      context.addIssue({
        code: "custom",
        path: ["activationReceiptHash"],
        message:
          "Registry activation receipt must be bounded and bind the exact cutover and genesis identities",
      });
    }
  });

export type PlatformReleaseBootstrapRegistryActivationReceiptV2 =
  z.infer<
    typeof PlatformReleaseBootstrapRegistryActivationReceiptV2Schema
  >;

const ActivationClaimIdentityV2Schema = z.object({
  schema: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_ACTIVATION_CLAIM_V2_SCHEMA,
  ),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  registryRef: z.literal(REGISTRY_REF_V2),
  registryContractHash: z.literal(REGISTRY_CONTRACT_HASH_V2),
  transactionIdentityHash: Sha256Schema,
  migratorProtocolHash: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_ACTIVATION_MIGRATOR_PROTOCOL_HASH_V2,
  ),
  legacyNodeLockIdentityHash: Sha256Schema,
  sharedLockIdentityHash: Sha256Schema,
  nodeLifecycleIdentityHash: Sha256Schema,
  nodeLifecycleSnapshotHash: Sha256Schema,
  parentIdentityHash: Sha256Schema,
  preActivationNamespaceCaptureHash: Sha256Schema,
  transactionStagingIdentityHash: Sha256Schema,
  transactionStagingCensusHash: Sha256Schema,
  genesisEpochStateHash: Sha256Schema,
  expectedActivationReceiptHash: Sha256Schema,
}).strict();

export type PlatformReleaseBootstrapRegistryActivationClaimHashPayloadV2 =
  z.infer<typeof ActivationClaimIdentityV2Schema>;

export function buildPlatformReleaseBootstrapRegistryActivationClaimHashPreimageV2(
  value:
    | PlatformReleaseBootstrapRegistryActivationClaimHashPayloadV2
    | PlatformReleaseBootstrapRegistryActivationClaimV2
    | Readonly<Record<string, unknown>>,
): RegistryDocumentHashPreimageV2 {
  return buildRegistryDocumentHashPreimageV2(
    "setfarm.platform-release-bootstrap-registry-activation-claim-hash.v2",
    "activationClaimHash",
    value,
  );
}

export function hashPlatformReleaseBootstrapRegistryActivationClaimV2(
  value:
    | PlatformReleaseBootstrapRegistryActivationClaimHashPayloadV2
    | PlatformReleaseBootstrapRegistryActivationClaimV2
    | Readonly<Record<string, unknown>>,
): string {
  return hashCanonicalJson(
    buildPlatformReleaseBootstrapRegistryActivationClaimHashPreimageV2(
      value,
    ),
  );
}

function expectedActivationReceiptHashForClaimV2(
  value: PlatformReleaseBootstrapRegistryActivationClaimHashPayloadV2,
): string {
  return hashPlatformReleaseBootstrapRegistryActivationReceiptV2({
    schema:
      PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_ACTIVATION_RECEIPT_V2_SCHEMA,
    version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
    registryRef: REGISTRY_REF_V2,
    registryContractHash: REGISTRY_CONTRACT_HASH_V2,
    sharedLockIdentityHash: value.sharedLockIdentityHash,
    legacyNodeLockIdentityHash: value.legacyNodeLockIdentityHash,
    nodeLifecycleIdentityHash: value.nodeLifecycleIdentityHash,
    parentIdentityHash: value.parentIdentityHash,
    genesisEpochStateHash: value.genesisEpochStateHash,
  });
}

export const PlatformReleaseBootstrapRegistryActivationClaimV2Schema =
  ActivationClaimIdentityV2Schema.extend({
    activationClaimHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const transactionAndCutoverHashes = [
      value.transactionIdentityHash,
      value.migratorProtocolHash,
      value.legacyNodeLockIdentityHash,
      value.sharedLockIdentityHash,
      value.nodeLifecycleIdentityHash,
      value.nodeLifecycleSnapshotHash,
      value.parentIdentityHash,
      value.preActivationNamespaceCaptureHash,
      value.transactionStagingIdentityHash,
      value.transactionStagingCensusHash,
      value.genesisEpochStateHash,
      value.expectedActivationReceiptHash,
    ];
    if (
      !platformReleaseCandidateFitsCanonicalCapV2(
        value,
        PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_ACTIVATION_CLAIM_MAX_CANONICAL_BYTES_V2,
      )
      || new Set(transactionAndCutoverHashes).size
        !== transactionAndCutoverHashes.length
      || value.genesisEpochStateHash
        !== exactGenesisEpochFloorStateHashV2()
      || value.expectedActivationReceiptHash
        !== expectedActivationReceiptHashForClaimV2(value)
      || value.activationClaimHash
        !==
          hashPlatformReleaseBootstrapRegistryActivationClaimV2(
            value,
          )
    ) {
      context.addIssue({
        code: "custom",
        path: ["activationClaimHash"],
        message:
          "Registry activation claim must be bounded and bind one exact crash-safe cutover transaction and expected receipt",
      });
    }
  });

export type PlatformReleaseBootstrapRegistryActivationClaimV2 =
  z.infer<
    typeof PlatformReleaseBootstrapRegistryActivationClaimV2Schema
  >;

const EpochFloorStateIdentityV2Schema = z.object({
  schema: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_EPOCH_FLOOR_STATE_V2_SCHEMA,
  ),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  registryRef: z.literal(REGISTRY_REF_V2),
  registryContractHash: z.literal(REGISTRY_CONTRACT_HASH_V2),
  generation: NonnegativeSafeIntegerV2Schema,
  priorEpochStateHash: Sha256Schema.nullable(),
  transactionIdentityHash: Sha256Schema.nullable(),
  packageEpochArtifactMap:
    PlatformReleaseBootstrapRegistryPackageEpochArtifactMapV2Schema,
}).strict();

export type PlatformReleaseBootstrapRegistryEpochFloorStateHashPayloadV2 =
  z.infer<typeof EpochFloorStateIdentityV2Schema>;

export function buildPlatformReleaseBootstrapRegistryEpochFloorStateHashPreimageV2(
  value:
    | PlatformReleaseBootstrapRegistryEpochFloorStateHashPayloadV2
    | PlatformReleaseBootstrapRegistryEpochFloorStateV2
    | Readonly<Record<string, unknown>>,
): RegistryDocumentHashPreimageV2 {
  return buildRegistryDocumentHashPreimageV2(
    "setfarm.platform-release-bootstrap-registry-epoch-floor-state-hash.v2",
    "epochStateHash",
    value,
  );
}

export function hashPlatformReleaseBootstrapRegistryEpochFloorStateV2(
  value:
    | PlatformReleaseBootstrapRegistryEpochFloorStateHashPayloadV2
    | PlatformReleaseBootstrapRegistryEpochFloorStateV2
    | Readonly<Record<string, unknown>>,
): string {
  return hashCanonicalJson(
    buildPlatformReleaseBootstrapRegistryEpochFloorStateHashPreimageV2(
      value,
    ),
  );
}

function epochFloorStateRelationIssueV2(
  value: PlatformReleaseBootstrapRegistryEpochFloorStateHashPayloadV2,
): string | undefined {
  const packageStates = Object.values(value.packageEpochArtifactMap);
  if (value.generation === 0) {
    if (
      value.priorEpochStateHash !== null
      || value.transactionIdentityHash !== null
      || packageStates.some((entry) =>
        entry.distributionEpoch !== 0 || entry.artifactHash !== null)
    ) {
      return "Genesis epoch state must have null ancestry and exact zero/no-artifact entries for every package";
    }
    return undefined;
  }
  if (
    value.priorEpochStateHash === null
    || value.transactionIdentityHash === null
    || value.priorEpochStateHash === value.transactionIdentityHash
  ) {
    return "A later epoch state requires distinct non-null prior-state and transaction identities";
  }
  return undefined;
}

export const PlatformReleaseBootstrapRegistryEpochFloorStateV2Schema =
  EpochFloorStateIdentityV2Schema.extend({
    epochStateHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const relationIssue = epochFloorStateRelationIssueV2(value);
    if (
      !platformReleaseCandidateFitsCanonicalCapV2(
        value,
        PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_EPOCH_FLOOR_STATE_MAX_CANONICAL_BYTES_V2,
      )
      || relationIssue !== undefined
      || value.epochStateHash
        !== hashPlatformReleaseBootstrapRegistryEpochFloorStateV2(
          value,
        )
    ) {
      context.addIssue({
        code: "custom",
        path: ["epochStateHash"],
        message:
          relationIssue
          ?? "Registry epoch floor state must be bounded, relationally exact, and self-hashed",
      });
    }
  });

export type PlatformReleaseBootstrapRegistryEpochFloorStateV2 =
  z.infer<
    typeof PlatformReleaseBootstrapRegistryEpochFloorStateV2Schema
  >;

export type PlatformReleaseBootstrapRegistryEpochStagingTargetMemberV2 =
  Readonly<{
    memberKind: "staged_target_epoch_state";
    logicalIdentityHash: string;
    physicalIdentityHash: string;
  }>;

export function hashPlatformReleaseBootstrapRegistryEpochStagingInitialCensusV2(
  orderedMembers:
    readonly PlatformReleaseBootstrapRegistryEpochStagingTargetMemberV2[],
): string {
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-bootstrap-registry-epoch-staging-initial-census.v2",
    orderedMembers,
  });
}

const EpochClaimIdentityV2Schema = z.object({
  schema: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_EPOCH_CLAIM_V2_SCHEMA,
  ),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  registryRef: z.literal(REGISTRY_REF_V2),
  registryContractHash: z.literal(REGISTRY_CONTRACT_HASH_V2),
  transactionIdentityHash: Sha256Schema,
  priorEpochStateHash: Sha256Schema,
  targetEpochStateHash: Sha256Schema,
  priorEpochState:
    PlatformReleaseBootstrapRegistryEpochFloorStateV2Schema,
  targetEpochState:
    PlatformReleaseBootstrapRegistryEpochFloorStateV2Schema,
  transactionStagingIdentityHash: Sha256Schema,
  transactionStagingCensusHash: Sha256Schema,
  stagedTargetEpochStatePhysicalIdentityHash: Sha256Schema,
  packageRef: PlatformReleaseBootstrapPackageRefV2Schema,
  packageInstallationGeneration: NonnegativeSafeIntegerV2Schema,
  offlineRollbackAuthorizationHash: Sha256Schema.nullable(),
}).strict().superRefine((value, context) => {
  const identityHashes = [
    value.transactionIdentityHash,
    value.priorEpochStateHash,
    value.targetEpochStateHash,
    value.transactionStagingIdentityHash,
    value.transactionStagingCensusHash,
    value.stagedTargetEpochStatePhysicalIdentityHash,
  ];
  if (new Set(identityHashes).size !== identityHashes.length) {
    context.addIssue({
      code: "custom",
      path: ["transactionIdentityHash"],
      message:
        "Epoch claim transaction, state, staging, census, and physical target identities must be pairwise distinct",
    });
  }
  if (
    value.priorEpochStateHash
      !== value.priorEpochState.epochStateHash
    || value.targetEpochStateHash
      !== value.targetEpochState.epochStateHash
  ) {
    context.addIssue({
      code: "custom",
      path: ["priorEpochStateHash"],
      message:
        "Epoch claim state hashes must exactly bind their full prior and target state documents",
    });
  }
  if (
    value.transactionStagingCensusHash
      !==
        hashPlatformReleaseBootstrapRegistryEpochStagingInitialCensusV2(
          [{
            memberKind: "staged_target_epoch_state",
            logicalIdentityHash: value.targetEpochStateHash,
            physicalIdentityHash:
              value.stagedTargetEpochStatePhysicalIdentityHash,
          }],
        )
  ) {
    context.addIssue({
      code: "custom",
      path: ["transactionStagingCensusHash"],
      message:
        "Epoch claim staging census must derive from its exact logical and physical target member",
    });
  }
  if (
    value.priorEpochState.generation
      >= Number.MAX_SAFE_INTEGER
    || value.targetEpochState.generation
      !== value.priorEpochState.generation + 1
    || value.targetEpochState.priorEpochStateHash
      !== value.priorEpochState.epochStateHash
    || value.targetEpochState.transactionIdentityHash
      !== value.transactionIdentityHash
  ) {
    context.addIssue({
      code: "custom",
      path: ["targetEpochState"],
      message:
        "Epoch claim target must be the safe next generation with exact prior and transaction ancestry",
    });
  }
  for (const packageRef of Object.values(
    PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2,
  )) {
    const priorEntry =
      value.priorEpochState.packageEpochArtifactMap[packageRef];
    const targetEntry =
      value.targetEpochState.packageEpochArtifactMap[packageRef];
    if (packageRef === value.packageRef) {
      if (
        targetEntry.distributionEpoch
          <= priorEntry.distributionEpoch
      ) {
        context.addIssue({
          code: "custom",
          path: [
            "targetEpochState",
            "packageEpochArtifactMap",
            packageRef,
          ],
          message:
            "Epoch claim target package distribution epoch must strictly increase",
        });
      }
    } else if (
      canonicalJsonStringify(targetEntry)
        !== canonicalJsonStringify(priorEntry)
    ) {
      context.addIssue({
        code: "custom",
        path: [
          "targetEpochState",
          "packageEpochArtifactMap",
          packageRef,
        ],
        message:
          "Epoch claim may change only its declared package entry",
      });
    }
  }
});

export type PlatformReleaseBootstrapRegistryEpochClaimHashPayloadV2 =
  z.infer<typeof EpochClaimIdentityV2Schema>;

export function buildPlatformReleaseBootstrapRegistryEpochClaimHashPreimageV2(
  value:
    | PlatformReleaseBootstrapRegistryEpochClaimHashPayloadV2
    | PlatformReleaseBootstrapRegistryEpochClaimV2
    | Readonly<Record<string, unknown>>,
): RegistryDocumentHashPreimageV2 {
  return buildRegistryDocumentHashPreimageV2(
    "setfarm.platform-release-bootstrap-registry-epoch-claim-hash.v2",
    "epochClaimHash",
    value,
  );
}

export function hashPlatformReleaseBootstrapRegistryEpochClaimV2(
  value:
    | PlatformReleaseBootstrapRegistryEpochClaimHashPayloadV2
    | PlatformReleaseBootstrapRegistryEpochClaimV2
    | Readonly<Record<string, unknown>>,
): string {
  return hashCanonicalJson(
    buildPlatformReleaseBootstrapRegistryEpochClaimHashPreimageV2(value),
  );
}

export const PlatformReleaseBootstrapRegistryEpochClaimV2Schema =
  EpochClaimIdentityV2Schema.extend({
    epochClaimHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (
      !platformReleaseCandidateFitsCanonicalCapV2(
        value,
        PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_EPOCH_CLAIM_MAX_CANONICAL_BYTES_V2,
      )
      || value.epochClaimHash
        !== hashPlatformReleaseBootstrapRegistryEpochClaimV2(value)
    ) {
      context.addIssue({
        code: "custom",
        path: ["epochClaimHash"],
        message:
          "Registry epoch claim must be bounded, relationally exact, and self-hashed",
      });
    }
  });

export type PlatformReleaseBootstrapRegistryEpochClaimV2 =
  z.infer<typeof PlatformReleaseBootstrapRegistryEpochClaimV2Schema>;

const OfflineRollbackAuthorizationUnsignedIdentityV2Schema = z.object({
  schema: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_OFFLINE_ROLLBACK_AUTHORIZATION_V2_SCHEMA,
  ),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  registryRef: z.literal(REGISTRY_REF_V2),
  registryContractHash: z.literal(REGISTRY_CONTRACT_HASH_V2),
  currentEpochStateHash: Sha256Schema,
  currentFloorEpoch: NonnegativeSafeIntegerV2Schema,
  targetPackageRef: PlatformReleaseBootstrapPackageRefV2Schema,
  targetArtifactHash: Sha256Schema,
  targetDistributionEpoch: NonnegativeSafeIntegerV2Schema,
  hostPolicyHash: Sha256Schema,
  expiresAt: ExactUtcMillisecondTimestampV2Schema,
}).strict().superRefine((value, context) => {
  if (
    value.currentFloorEpoch === 0
    || value.targetDistributionEpoch < MINIMUM_DISTRIBUTION_EPOCH_V2
    || value.targetDistributionEpoch >= value.currentFloorEpoch
  ) {
    context.addIssue({
      code: "custom",
      path: ["targetDistributionEpoch"],
      message:
        "Rollback authorization target epoch must meet the code-owned minimum and be strictly below one positive current floor",
    });
  }
});

export type PlatformReleaseBootstrapRegistryOfflineRollbackAuthorizationUnsignedIdentityV2 =
  z.infer<
    typeof OfflineRollbackAuthorizationUnsignedIdentityV2Schema
  >;

const OfflineRollbackAuthorizationIdentityV2Schema =
  OfflineRollbackAuthorizationUnsignedIdentityV2Schema.safeExtend({
    offlineSignature:
      PlatformReleaseBootstrapRegistryEd25519SignatureV2Schema,
  }).strict();

export type PlatformReleaseBootstrapRegistryOfflineRollbackAuthorizationHashPayloadV2 =
  z.infer<typeof OfflineRollbackAuthorizationIdentityV2Schema>;

export type PlatformReleaseBootstrapRegistryOfflineRollbackAuthorizationSigningPreimageV2 =
  Readonly<{
    schema:
      "setfarm.platform-release-bootstrap-registry-offline-rollback-authorization-signing-preimage.v2";
    authorization:
      PlatformReleaseBootstrapRegistryOfflineRollbackAuthorizationUnsignedIdentityV2;
  }>;

export function buildPlatformReleaseBootstrapRegistryOfflineRollbackAuthorizationSigningPreimageV2(
  value:
    PlatformReleaseBootstrapRegistryOfflineRollbackAuthorizationUnsignedIdentityV2,
): PlatformReleaseBootstrapRegistryOfflineRollbackAuthorizationSigningPreimageV2 {
  const authorization =
    OfflineRollbackAuthorizationUnsignedIdentityV2Schema.parse(value);
  return deepFreezePlatformReleaseJsonV2(
    structuredClone({
      schema:
        "setfarm.platform-release-bootstrap-registry-offline-rollback-authorization-signing-preimage.v2",
      authorization,
    } as const),
  );
}

export function canonicalizePlatformReleaseBootstrapRegistryOfflineRollbackAuthorizationSigningPreimageV2(
  value:
    PlatformReleaseBootstrapRegistryOfflineRollbackAuthorizationUnsignedIdentityV2,
): string {
  return canonicalJsonStringify(
    buildPlatformReleaseBootstrapRegistryOfflineRollbackAuthorizationSigningPreimageV2(
      value,
    ),
  );
}

export function buildPlatformReleaseBootstrapRegistryOfflineRollbackAuthorizationHashPreimageV2(
  value:
    | PlatformReleaseBootstrapRegistryOfflineRollbackAuthorizationHashPayloadV2
    | PlatformReleaseBootstrapRegistryOfflineRollbackAuthorizationV2
    | Readonly<Record<string, unknown>>,
): RegistryDocumentHashPreimageV2 {
  return buildRegistryDocumentHashPreimageV2(
    "setfarm.platform-release-bootstrap-registry-offline-rollback-authorization-hash.v2",
    "authorizationHash",
    value,
  );
}

export function hashPlatformReleaseBootstrapRegistryOfflineRollbackAuthorizationV2(
  value:
    | PlatformReleaseBootstrapRegistryOfflineRollbackAuthorizationHashPayloadV2
    | PlatformReleaseBootstrapRegistryOfflineRollbackAuthorizationV2
    | Readonly<Record<string, unknown>>,
): string {
  return hashCanonicalJson(
    buildPlatformReleaseBootstrapRegistryOfflineRollbackAuthorizationHashPreimageV2(
      value,
    ),
  );
}

export const PlatformReleaseBootstrapRegistryOfflineRollbackAuthorizationV2Schema =
  OfflineRollbackAuthorizationIdentityV2Schema.safeExtend({
    authorizationHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (
      !platformReleaseCandidateFitsCanonicalCapV2(
        value,
        PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_OFFLINE_ROLLBACK_AUTHORIZATION_MAX_CANONICAL_BYTES_V2,
      )
      || value.authorizationHash
        !==
          hashPlatformReleaseBootstrapRegistryOfflineRollbackAuthorizationV2(
            value,
          )
    ) {
      context.addIssue({
        code: "custom",
        path: ["authorizationHash"],
        message:
          "Offline rollback authorization must be bounded, relationally exact, and self-hashed",
      });
    }
  });

export type PlatformReleaseBootstrapRegistryOfflineRollbackAuthorizationV2 =
  z.infer<
    typeof PlatformReleaseBootstrapRegistryOfflineRollbackAuthorizationV2Schema
  >;

export const PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_OFFLINE_ROLLBACK_SIGNATURE_ADMISSION_V2 =
  "shape_only_production_trust_unconfigured" as const;

export function parsePlatformReleaseBootstrapRegistryActivationReceiptCandidateV2(
  input: unknown,
): PlatformReleaseBootstrapRegistryActivationReceiptV2 {
  const snapshot = boundedPlatformReleaseJsonSnapshotV2(
    input,
    PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_ACTIVATION_RECEIPT_MAX_CANONICAL_BYTES_V2,
  );
  return deepFreezePlatformReleaseJsonV2(
    PlatformReleaseBootstrapRegistryActivationReceiptV2Schema.parse(
      snapshot,
    ),
  );
}

export function parsePlatformReleaseBootstrapRegistryActivationClaimCandidateV2(
  input: unknown,
): PlatformReleaseBootstrapRegistryActivationClaimV2 {
  const snapshot = boundedPlatformReleaseJsonSnapshotV2(
    input,
    PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_ACTIVATION_CLAIM_MAX_CANONICAL_BYTES_V2,
  );
  return deepFreezePlatformReleaseJsonV2(
    PlatformReleaseBootstrapRegistryActivationClaimV2Schema.parse(
      snapshot,
    ),
  );
}

export function parsePlatformReleaseBootstrapRegistryEpochFloorStateCandidateV2(
  input: unknown,
): PlatformReleaseBootstrapRegistryEpochFloorStateV2 {
  const snapshot = boundedPlatformReleaseJsonSnapshotV2(
    input,
    PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_EPOCH_FLOOR_STATE_MAX_CANONICAL_BYTES_V2,
  );
  return deepFreezePlatformReleaseJsonV2(
    PlatformReleaseBootstrapRegistryEpochFloorStateV2Schema.parse(
      snapshot,
    ),
  );
}

export function parsePlatformReleaseBootstrapRegistryEpochClaimCandidateV2(
  input: unknown,
): PlatformReleaseBootstrapRegistryEpochClaimV2 {
  const snapshot = boundedPlatformReleaseJsonSnapshotV2(
    input,
    PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_EPOCH_CLAIM_MAX_CANONICAL_BYTES_V2,
  );
  return deepFreezePlatformReleaseJsonV2(
    PlatformReleaseBootstrapRegistryEpochClaimV2Schema.parse(snapshot),
  );
}

export function parsePlatformReleaseBootstrapRegistryOfflineRollbackAuthorizationCandidateV2(
  input: unknown,
): PlatformReleaseBootstrapRegistryOfflineRollbackAuthorizationV2 {
  const snapshot = boundedPlatformReleaseJsonSnapshotV2(
    input,
    PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_OFFLINE_ROLLBACK_AUTHORIZATION_MAX_CANONICAL_BYTES_V2,
  );
  return deepFreezePlatformReleaseJsonV2(
    PlatformReleaseBootstrapRegistryOfflineRollbackAuthorizationV2Schema
      .parse(snapshot),
  );
}

const ActivationReceiptBuilderInputV2Schema = z.object({
  sharedLockIdentityHash: Sha256Schema,
  legacyNodeLockIdentityHash: Sha256Schema,
  nodeLifecycleIdentityHash: Sha256Schema,
  parentIdentityHash: Sha256Schema,
}).strict();

export type PlatformReleaseBootstrapRegistryActivationReceiptBuilderInputV2 =
  z.infer<typeof ActivationReceiptBuilderInputV2Schema>;

export function buildPlatformReleaseBootstrapRegistryActivationReceiptV2(
  input: PlatformReleaseBootstrapRegistryActivationReceiptBuilderInputV2,
): PlatformReleaseBootstrapRegistryActivationReceiptV2 {
  const parsedInput = ActivationReceiptBuilderInputV2Schema.parse(input);
  const identity = {
    schema:
      PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_ACTIVATION_RECEIPT_V2_SCHEMA,
    version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
    registryRef: REGISTRY_REF_V2,
    registryContractHash: REGISTRY_CONTRACT_HASH_V2,
    ...parsedInput,
    genesisEpochStateHash: exactGenesisEpochFloorStateHashV2(),
  } as const;
  return parsePlatformReleaseBootstrapRegistryActivationReceiptCandidateV2({
    ...identity,
    activationReceiptHash:
      hashPlatformReleaseBootstrapRegistryActivationReceiptV2(identity),
  });
}

const ActivationClaimBuilderInputV2Schema =
  ActivationReceiptBuilderInputV2Schema.extend({
    transactionIdentityHash: Sha256Schema,
    nodeLifecycleSnapshotHash: Sha256Schema,
    preActivationNamespaceCaptureHash: Sha256Schema,
    transactionStagingIdentityHash: Sha256Schema,
    transactionStagingCensusHash: Sha256Schema,
  }).strict();

export type PlatformReleaseBootstrapRegistryActivationClaimBuilderInputV2 =
  z.infer<typeof ActivationClaimBuilderInputV2Schema>;

export function buildPlatformReleaseBootstrapRegistryActivationClaimV2(
  input: PlatformReleaseBootstrapRegistryActivationClaimBuilderInputV2,
): PlatformReleaseBootstrapRegistryActivationClaimV2 {
  const parsedInput = ActivationClaimBuilderInputV2Schema.parse(input);
  const receipt =
    buildPlatformReleaseBootstrapRegistryActivationReceiptV2({
      sharedLockIdentityHash: parsedInput.sharedLockIdentityHash,
      legacyNodeLockIdentityHash:
        parsedInput.legacyNodeLockIdentityHash,
      nodeLifecycleIdentityHash:
        parsedInput.nodeLifecycleIdentityHash,
      parentIdentityHash: parsedInput.parentIdentityHash,
    });
  const identity = {
    schema:
      PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_ACTIVATION_CLAIM_V2_SCHEMA,
    version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
    registryRef: REGISTRY_REF_V2,
    registryContractHash: REGISTRY_CONTRACT_HASH_V2,
    transactionIdentityHash: parsedInput.transactionIdentityHash,
    migratorProtocolHash:
      PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_ACTIVATION_MIGRATOR_PROTOCOL_HASH_V2,
    legacyNodeLockIdentityHash:
      parsedInput.legacyNodeLockIdentityHash,
    sharedLockIdentityHash: parsedInput.sharedLockIdentityHash,
    nodeLifecycleIdentityHash:
      parsedInput.nodeLifecycleIdentityHash,
    nodeLifecycleSnapshotHash:
      parsedInput.nodeLifecycleSnapshotHash,
    parentIdentityHash: parsedInput.parentIdentityHash,
    preActivationNamespaceCaptureHash:
      parsedInput.preActivationNamespaceCaptureHash,
    transactionStagingIdentityHash:
      parsedInput.transactionStagingIdentityHash,
    transactionStagingCensusHash:
      parsedInput.transactionStagingCensusHash,
    genesisEpochStateHash: receipt.genesisEpochStateHash,
    expectedActivationReceiptHash:
      receipt.activationReceiptHash,
  } as const;
  return parsePlatformReleaseBootstrapRegistryActivationClaimCandidateV2({
    ...identity,
    activationClaimHash:
      hashPlatformReleaseBootstrapRegistryActivationClaimV2(identity),
  });
}

const EpochFloorStateBuilderInputV2Schema = z.object({
  generation: NonnegativeSafeIntegerV2Schema,
  priorEpochStateHash: Sha256Schema.nullable(),
  transactionIdentityHash: Sha256Schema.nullable(),
  packageEpochArtifactMap:
    PlatformReleaseBootstrapRegistryPackageEpochArtifactMapV2Schema,
}).strict();

export type PlatformReleaseBootstrapRegistryEpochFloorStateBuilderInputV2 =
  z.infer<typeof EpochFloorStateBuilderInputV2Schema>;

export function buildPlatformReleaseBootstrapRegistryEpochFloorStateV2(
  input: PlatformReleaseBootstrapRegistryEpochFloorStateBuilderInputV2,
): PlatformReleaseBootstrapRegistryEpochFloorStateV2 {
  const parsedInput = EpochFloorStateBuilderInputV2Schema.parse(input);
  const identity = {
    schema:
      PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_EPOCH_FLOOR_STATE_V2_SCHEMA,
    version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
    registryRef: REGISTRY_REF_V2,
    registryContractHash: REGISTRY_CONTRACT_HASH_V2,
    ...parsedInput,
  } as const;
  return parsePlatformReleaseBootstrapRegistryEpochFloorStateCandidateV2({
    ...identity,
    epochStateHash:
      hashPlatformReleaseBootstrapRegistryEpochFloorStateV2(identity),
  });
}

export function buildPlatformReleaseBootstrapRegistryGenesisEpochFloorStateV2():
PlatformReleaseBootstrapRegistryEpochFloorStateV2 {
  const identity = exactGenesisEpochFloorStateIdentityV2();
  return parsePlatformReleaseBootstrapRegistryEpochFloorStateCandidateV2({
    ...identity,
    epochStateHash:
      hashPlatformReleaseBootstrapRegistryEpochFloorStateV2(identity),
  });
}

const EpochClaimBuilderInputV2Schema = z.object({
  transactionIdentityHash: Sha256Schema,
  priorEpochState:
    PlatformReleaseBootstrapRegistryEpochFloorStateV2Schema,
  targetEpochState:
    PlatformReleaseBootstrapRegistryEpochFloorStateV2Schema,
  transactionStagingIdentityHash: Sha256Schema,
  transactionStagingCensusHash: Sha256Schema,
  stagedTargetEpochStatePhysicalIdentityHash: Sha256Schema,
  packageRef: PlatformReleaseBootstrapPackageRefV2Schema,
  packageInstallationGeneration: NonnegativeSafeIntegerV2Schema,
  offlineRollbackAuthorizationHash: Sha256Schema.nullable(),
}).strict();

export type PlatformReleaseBootstrapRegistryEpochClaimBuilderInputV2 =
  z.infer<typeof EpochClaimBuilderInputV2Schema>;

export function buildPlatformReleaseBootstrapRegistryEpochClaimV2(
  input: PlatformReleaseBootstrapRegistryEpochClaimBuilderInputV2,
): PlatformReleaseBootstrapRegistryEpochClaimV2 {
  const parsedInput = EpochClaimBuilderInputV2Schema.parse(input);
  const identity = {
    schema: PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_EPOCH_CLAIM_V2_SCHEMA,
    version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
    registryRef: REGISTRY_REF_V2,
    registryContractHash: REGISTRY_CONTRACT_HASH_V2,
    priorEpochStateHash:
      parsedInput.priorEpochState.epochStateHash,
    targetEpochStateHash:
      parsedInput.targetEpochState.epochStateHash,
    ...parsedInput,
  } as const;
  return parsePlatformReleaseBootstrapRegistryEpochClaimCandidateV2({
    ...identity,
    epochClaimHash:
      hashPlatformReleaseBootstrapRegistryEpochClaimV2(identity),
  });
}

const OfflineRollbackAuthorizationUnsignedBuilderInputV2Schema = z.object({
  currentEpochStateHash: Sha256Schema,
  currentFloorEpoch: NonnegativeSafeIntegerV2Schema,
  targetPackageRef: PlatformReleaseBootstrapPackageRefV2Schema,
  targetArtifactHash: Sha256Schema,
  targetDistributionEpoch: NonnegativeSafeIntegerV2Schema,
  hostPolicyHash: Sha256Schema,
  expiresAt: ExactUtcMillisecondTimestampV2Schema,
}).strict();

const OfflineRollbackAuthorizationBuilderInputV2Schema =
  OfflineRollbackAuthorizationUnsignedBuilderInputV2Schema.extend({
  offlineSignature:
    PlatformReleaseBootstrapRegistryEd25519SignatureV2Schema,
}).strict();

export type PlatformReleaseBootstrapRegistryOfflineRollbackAuthorizationBuilderInputV2 =
  z.infer<typeof OfflineRollbackAuthorizationBuilderInputV2Schema>;

export function buildPlatformReleaseBootstrapRegistryOfflineRollbackAuthorizationSigningIdentityV2(
  input: Omit<
    PlatformReleaseBootstrapRegistryOfflineRollbackAuthorizationBuilderInputV2,
    "offlineSignature"
  >,
): PlatformReleaseBootstrapRegistryOfflineRollbackAuthorizationUnsignedIdentityV2 {
  const parsedInput =
    OfflineRollbackAuthorizationUnsignedBuilderInputV2Schema.parse(
      input,
    );
  return deepFreezePlatformReleaseJsonV2(
    OfflineRollbackAuthorizationUnsignedIdentityV2Schema.parse({
      schema:
        PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_OFFLINE_ROLLBACK_AUTHORIZATION_V2_SCHEMA,
      version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
      registryRef: REGISTRY_REF_V2,
      registryContractHash: REGISTRY_CONTRACT_HASH_V2,
      ...parsedInput,
    }),
  );
}

export function buildPlatformReleaseBootstrapRegistryOfflineRollbackAuthorizationV2(
  input:
    PlatformReleaseBootstrapRegistryOfflineRollbackAuthorizationBuilderInputV2,
): PlatformReleaseBootstrapRegistryOfflineRollbackAuthorizationV2 {
  const parsedInput =
    OfflineRollbackAuthorizationBuilderInputV2Schema.parse(input);
  const identity = {
    schema:
      PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_OFFLINE_ROLLBACK_AUTHORIZATION_V2_SCHEMA,
    version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
    registryRef: REGISTRY_REF_V2,
    registryContractHash: REGISTRY_CONTRACT_HASH_V2,
    ...parsedInput,
  } as const;
  return parsePlatformReleaseBootstrapRegistryOfflineRollbackAuthorizationCandidateV2(
    {
      ...identity,
      authorizationHash:
        hashPlatformReleaseBootstrapRegistryOfflineRollbackAuthorizationV2(
          identity,
        ),
    },
  );
}

export const PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_GENESIS_EPOCH_FLOOR_STATE_V2 =
  buildPlatformReleaseBootstrapRegistryGenesisEpochFloorStateV2();
