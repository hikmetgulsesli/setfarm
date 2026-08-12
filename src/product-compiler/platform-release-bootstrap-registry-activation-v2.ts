import { createHash } from "node:crypto";

import { z } from "zod";

import { PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2 } from "../execution/schemas/platform-release-bootstrap-contract-v2.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2,
  PlatformReleaseBootstrapPackageRefV2Schema,
} from "../execution/schemas/platform-release-bootstrap-operation-abis-v2.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_GENESIS_EPOCH_FLOOR_STATE_V2,
  PlatformReleaseBootstrapRegistryActivationClaimV2Schema,
  PlatformReleaseBootstrapRegistryActivationReceiptV2Schema,
  PlatformReleaseBootstrapRegistryEpochClaimV2Schema,
  PlatformReleaseBootstrapRegistryEpochFloorStateV2Schema,
  buildPlatformReleaseBootstrapRegistryActivationClaimV2,
  buildPlatformReleaseBootstrapRegistryActivationReceiptV2,
  hashPlatformReleaseBootstrapRegistryEpochStagingInitialCensusV2,
  type PlatformReleaseBootstrapRegistryActivationClaimV2,
  type PlatformReleaseBootstrapRegistryActivationReceiptV2,
  type PlatformReleaseBootstrapRegistryEpochClaimV2,
  type PlatformReleaseBootstrapRegistryEpochFloorStateV2,
} from "../execution/schemas/platform-release-bootstrap-registry-state-v2.js";
import {
  PLATFORM_RELEASE_COMPONENT_VERSION_V2,
  boundedPlatformReleaseJsonSnapshotV2,
  deepFreezePlatformReleaseJsonV2,
  platformReleaseCandidateFitsCanonicalCapV2,
} from "../execution/schemas/platform-release-common-v2.js";
import {
  BootstrapFilesystemScopeIdentityV2Schema,
  DirectoryMembershipIdentityV2Schema,
  FsObservationFingerprintV2Schema,
  NamespacePhysicalCensusV2Schema,
  PackageLifecyclePhysicalProjectionV2Schema,
  StableFsObjectIdentityV2Schema,
  filesystemObjectLocatorKeyV2,
  parsePackageLifecyclePhysicalProjectionCandidateV2,
  type NamespacePhysicalEntryCaptureV2,
  type PackageLifecyclePhysicalProjectionV2,
  type StableFsObjectIdentityV2,
} from "./platform-release-bootstrap-physical-census-v2.js";
import { NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_LOCK_CONTENT_V2 } from "./schemas/node-toolchain-provisioner-bootstrap-installation-state-v2.js";
import {
  PlatformReleaseBootstrapNamespaceClassificationV2Schema,
  PlatformReleaseBootstrapNamespaceCensusV2Schema,
  type PlatformReleaseBootstrapNamespaceCensusV2,
} from "./platform-release-bootstrap-registry-v2.js";
import { canonicalJsonStringify, hashCanonicalJson } from "./canonical-json.js";
import { Sha256Schema } from "./schemas/common-v1.js";

export const PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_ACTIVATION_OBSERVATION_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-registry-activation-observation.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_ACTIVATION_PLAN_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-registry-activation-plan.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_ACTIVATION_OBSERVATION_MAX_CANONICAL_BYTES_V2 =
  16 * 1024 * 1024;
export const PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_ACTIVATION_PLAN_MAX_CANONICAL_BYTES_V2 =
  17 * 1024 * 1024;
export const PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_ACTIVATION_PRODUCTION_ERROR_CODE_V2 =
  "PRODUCTION_ACTIVATION_FORBIDDEN" as const;

export { hashPlatformReleaseBootstrapRegistryEpochStagingInitialCensusV2 } from "../execution/schemas/platform-release-bootstrap-registry-state-v2.js";

const REGISTRY_REF_V2 =
  PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.registry.registryRef;
const REGISTRY_CONTRACT_HASH_V2 =
  PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.contractHash;
const NODE_PACKAGE_REF_V2 =
  PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.nodeToolchainProvisioner;
const NODE_PACKAGE_CONTRACT_V2 =
  PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.packages.find(
    (entry) => entry.packageRef === NODE_PACKAGE_REF_V2,
  );
if (!NODE_PACKAGE_CONTRACT_V2) {
  throw new TypeError(
    "Code-owned bootstrap registry is missing the Node package contract",
  );
}

export function hashPlatformReleaseBootstrapRegistryPublishedCanonicalJsonBytesV2(
  value: unknown,
): string {
  return hashCanonicalJson(value);
}

export function expectedPlatformReleaseBootstrapPackageLockRawContentHashV2(
  packageRef: z.infer<typeof PlatformReleaseBootstrapPackageRefV2Schema>,
): string {
  const parsedPackageRef =
    PlatformReleaseBootstrapPackageRefV2Schema.parse(packageRef);
  const content =
    parsedPackageRef === NODE_PACKAGE_REF_V2
      ? NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_LOCK_CONTENT_V2
      : [
          "setfarm.bootstrap-package-installation-lock.v2",
          `registryContractHash=${REGISTRY_CONTRACT_HASH_V2}`,
          `packageRef=${parsedPackageRef}`,
          "",
        ].join("\n");
  return createHash("sha256").update(content, "utf8").digest("hex");
}

export const PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_NODE_LIFECYCLE_IDENTITY_HASH_V2 =
  hashCanonicalJson({
    schema:
      "setfarm.platform-release-bootstrap-registry-node-lifecycle-identity.v2",
    registryContractHash: REGISTRY_CONTRACT_HASH_V2,
    packageContract: NODE_PACKAGE_CONTRACT_V2,
  });

const NonNodePackageRefV2Schema = z.enum([
  PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.hostVerifier,
  PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.platformReleaseComposition,
  PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.runtimeAccountProvisioner,
]);

export const PlatformReleaseBootstrapRegistryActivationStateV2Schema = z.enum([
  "ACTIVATION_CLAIMED",
  "ACTIVATION_CLEANUP_REQUIRED",
  "ACTIVATION_STAGING_ORPHANED",
  "EPOCH_STAGING_ORPHANED",
  "LEGACY_ONLY",
  "SHARED_LOCK_PUBLISHED",
  "GENESIS_PUBLISHED",
  "ACTIVATED",
  "CORRUPT",
]);

export type PlatformReleaseBootstrapRegistryActivationStateV2 = z.infer<
  typeof PlatformReleaseBootstrapRegistryActivationStateV2Schema
>;

export const PlatformReleaseBootstrapRegistryActivationNextActionV2Schema =
  z.enum([
    "cleanup_activation_staging",
    "cleanup_orphaned_activation_staging",
    "cleanup_orphaned_epoch_staging",
    "prepare_and_publish_activation_claim",
    "publish_and_acquire_shared_lock",
    "publish_genesis_epoch_floor",
    "publish_activation_receipt",
    "recover_epoch_claim",
    "remove_activation_claim",
    "resume_activation_staging_cleanup",
    "return_activated",
    "no_mutation",
  ]);

export type PlatformReleaseBootstrapRegistryActivationNextActionV2 = z.infer<
  typeof PlatformReleaseBootstrapRegistryActivationNextActionV2Schema
>;

export const PlatformReleaseBootstrapRegistryEpochClaimDispositionV2Schema =
  z.enum([
    "not_applicable",
    "absent",
    "recovery_from_prior",
    "recovery_from_target",
  ]);

export type PlatformReleaseBootstrapRegistryEpochClaimDispositionV2 = z.infer<
  typeof PlatformReleaseBootstrapRegistryEpochClaimDispositionV2Schema
>;

const ActivationLockRoleV2Schema = z.enum([
  "legacy_node_package_lock",
  "shared_parent_lock",
  "package_lock",
]);

export const PlatformReleaseBootstrapRegistryActivationCorruptionReasonV2Schema =
  z.enum([
    "activation_claim_identity_mismatch",
    "activation_claim_invalid",
    "activation_claim_missing_staging",
    "activation_claim_required_for_resume",
    "activation_cleanup_partial_before_receipt",
    "activation_cleanup_floor_not_genesis",
    "activation_cleanup_non_node_siblings_present",
    "activation_receipt_cutover_identity_mismatch",
    "activation_receipt_invalid",
    "activation_receipt_missing_epoch_floor",
    "activation_receipt_missing_shared_lock",
    "activation_staging_missing_claim",
    "activation_staging_relation_mismatch",
    "activation_staged_physical_identity_mismatch",
    "activation_staged_payload_mismatch",
    "epoch_claim_invalid",
    "epoch_claim_installation_generation_mismatch",
    "epoch_claim_package_lifecycle_mismatch",
    "epoch_evidence_identity_alias",
    "epoch_claim_present_before_activation",
    "epoch_claim_state_mismatch",
    "epoch_staging_relation_mismatch",
    "epoch_stage_evidence_missing",
    "epoch_staged_physical_identity_mismatch",
    "epoch_staged_target_mismatch",
    "epoch_target_exact_state_mismatch",
    "epoch_target_consumed_state_mismatch",
    "epoch_floor_invalid",
    "legacy_lock_not_exact",
    "namespace_non_node_siblings_before_activation",
    "namespace_not_exact",
    "namespace_observation_mismatch",
    "node_lifecycle_census_mismatch",
    "node_lifecycle_not_stable",
    "non_genesis_floor_before_activation",
    "parent_boundary_not_exact",
    "physical_namespace_relation_mismatch",
    "physical_object_locator_alias",
    "registry_claims_not_mutually_exclusive",
    "shared_lock_invalid",
    "shared_lock_missing_for_epoch_floor",
    "transaction_staging_invalid",
    "transaction_staging_orphan_not_cleanable",
  ]);

export type PlatformReleaseBootstrapRegistryActivationCorruptionReasonV2 =
  z.infer<
    typeof PlatformReleaseBootstrapRegistryActivationCorruptionReasonV2Schema
  >;

const ExactRegularFileObservationPhysicalEvidenceV2Schema = z
  .object({
    physicalFingerprint: FsObservationFingerprintV2Schema,
    rawContentHash: Sha256Schema,
  })
  .strict();

const LegacyLockObservationV2Schema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("absent") }).strict(),
  z
    .object({
      status: z.literal("exact"),
      legacyNodeLockIdentityHash: Sha256Schema,
      ...ExactRegularFileObservationPhysicalEvidenceV2Schema.shape,
    })
    .strict(),
  z
    .object({
      status: z.literal("invalid"),
      failureKind: z.enum([
        "content_mismatch",
        "metadata_mismatch",
        "transplanted_identity",
      ]),
    })
    .strict(),
]);

const SharedLockObservationV2Schema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("absent") }).strict(),
  z
    .object({
      status: z.literal("exact"),
      sharedLockIdentityHash: Sha256Schema,
      ...ExactRegularFileObservationPhysicalEvidenceV2Schema.shape,
    })
    .strict(),
  z
    .object({
      status: z.literal("invalid"),
      failureKind: z.enum([
        "content_mismatch",
        "metadata_mismatch",
        "transplanted_identity",
      ]),
    })
    .strict(),
]);

const ParentBoundaryObservationV2Schema = z.discriminatedUnion("status", [
  z
    .object({
      status: z.literal("exact"),
      parentIdentityHash: Sha256Schema,
      parentFingerprint: FsObservationFingerprintV2Schema,
    })
    .strict(),
  z
    .object({
      status: z.literal("invalid"),
      failureKind: z.enum([
        "descriptor_path_mismatch",
        "metadata_mismatch",
        "parent_changed",
        "transplanted_identity",
      ]),
    })
    .strict(),
]);

const NodeLifecycleObservationV2Schema = z.discriminatedUnion("status", [
  z
    .object({
      status: z.literal("ready"),
      observationAuthority: z.literal(
        "logical_namespace_projection_only_never_node_semantic_authority_v2",
      ),
      productionAuthority: z.literal(false),
      semanticSnapshotStatus: z.literal(
        "unavailable_requires_captured_evidence_v2",
      ),
      nodeLifecycleIdentityHash: z.literal(
        PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_NODE_LIFECYCLE_IDENTITY_HASH_V2,
      ),
      nodeLifecycleSnapshotHash: Sha256Schema,
    })
    .strict()
    .superRefine((value, context) => {
      if (value.nodeLifecycleSnapshotHash === value.nodeLifecycleIdentityHash) {
        context.addIssue({
          code: "custom",
          path: ["nodeLifecycleSnapshotHash"],
          message:
            "Node logical namespace projection census hash must be distinct from its code-owned contract identity",
        });
      }
    }),
  z
    .object({
      status: z.literal("empty_or_rolled_back"),
      observationAuthority: z.literal(
        "logical_namespace_projection_only_never_node_semantic_authority_v2",
      ),
      productionAuthority: z.literal(false),
      semanticSnapshotStatus: z.literal(
        "unavailable_requires_captured_evidence_v2",
      ),
      nodeLifecycleIdentityHash: z.literal(
        PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_NODE_LIFECYCLE_IDENTITY_HASH_V2,
      ),
      nodeLifecycleSnapshotHash: Sha256Schema,
    })
    .strict()
    .superRefine((value, context) => {
      if (value.nodeLifecycleSnapshotHash === value.nodeLifecycleIdentityHash) {
        context.addIssue({
          code: "custom",
          path: ["nodeLifecycleSnapshotHash"],
          message:
            "Node logical namespace projection census hash must be distinct from its code-owned contract identity",
        });
      }
    }),
  z
    .object({
      status: z.literal("transient"),
      failureKind: z.enum(["active_claim", "active_staging", "rollback_claim"]),
    })
    .strict(),
  z
    .object({
      status: z.literal("invalid"),
      failureKind: z.enum([
        "changing_census",
        "foreign_member",
        "lifecycle_contract_mismatch",
        "metadata_mismatch",
      ]),
    })
    .strict(),
]);

function compareUtf16V2(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function deriveNonNodeSiblingPackageRefsV2(
  census: PlatformReleaseBootstrapNamespaceCensusV2,
): readonly z.infer<typeof NonNodePackageRefV2Schema>[] {
  return [
    ...new Set(
      census.orderedEntries
        .filter(
          (entry) =>
            entry.ownerKind === "package" &&
            entry.ownerRef !== NODE_PACKAGE_REF_V2,
        )
        .map((entry) => NonNodePackageRefV2Schema.parse(entry.ownerRef)),
    ),
  ].sort(compareUtf16V2);
}

const NamespaceObservationV2Schema = z.discriminatedUnion("status", [
  z
    .object({
      status: z.literal("exact"),
      census: PlatformReleaseBootstrapNamespaceCensusV2Schema,
      physicalCensus: NamespacePhysicalCensusV2Schema,
      nonNodeSiblingPackageRefs: z.array(NonNodePackageRefV2Schema).max(3),
    })
    .strict()
    .superRefine((value, context) => {
      const derived = deriveNonNodeSiblingPackageRefsV2(value.census);
      if (
        value.census.censusHash !==
          value.physicalCensus.logicalCensus.censusHash ||
        canonicalJsonStringify(value.census) !==
          canonicalJsonStringify(value.physicalCensus.logicalCensus)
      ) {
        context.addIssue({
          code: "custom",
          path: ["physicalCensus", "logicalCensus"],
          message:
            "Namespace logical census must canonically equal the full physical census logical source",
        });
      }
      if (
        value.nonNodeSiblingPackageRefs.length !== derived.length ||
        value.nonNodeSiblingPackageRefs.some(
          (entry, index) => entry !== derived[index],
        )
      ) {
        context.addIssue({
          code: "custom",
          path: ["nonNodeSiblingPackageRefs"],
          message:
            "Non-Node sibling refs must equal the sorted unique namespace census projection",
        });
      }
    }),
  z
    .object({
      status: z.literal("invalid"),
      failureKind: z.enum([
        "ambiguous_basename",
        "changing_census",
        "duplicate_basename",
        "malformed_basename",
        "unknown_basename",
      ]),
    })
    .strict(),
]);

const EpochFloorObservationV2Schema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("absent") }).strict(),
  z
    .object({
      status: z.literal("exact"),
      state: PlatformReleaseBootstrapRegistryEpochFloorStateV2Schema,
      physicalIdentityHash: Sha256Schema,
      ...ExactRegularFileObservationPhysicalEvidenceV2Schema.shape,
    })
    .strict()
    .superRefine((value, context) => {
      if (value.physicalIdentityHash === value.state.epochStateHash) {
        context.addIssue({
          code: "custom",
          path: ["physicalIdentityHash"],
          message:
            "Epoch floor physical identity must be distinct from its logical state hash",
        });
      }
    }),
  z
    .object({
      status: z.literal("invalid"),
      failureKind: z.enum([
        "content_mismatch",
        "metadata_mismatch",
        "state_contract_mismatch",
        "transplanted_identity",
      ]),
    })
    .strict(),
]);

const ActivationReceiptObservationV2Schema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("absent") }).strict(),
  z
    .object({
      status: z.literal("exact"),
      receipt: PlatformReleaseBootstrapRegistryActivationReceiptV2Schema,
      physicalIdentityHash: Sha256Schema,
      ...ExactRegularFileObservationPhysicalEvidenceV2Schema.shape,
    })
    .strict()
    .superRefine((value, context) => {
      if (value.physicalIdentityHash === value.receipt.activationReceiptHash) {
        context.addIssue({
          code: "custom",
          path: ["physicalIdentityHash"],
          message:
            "Activation receipt physical identity must be distinct from its logical receipt hash",
        });
      }
    }),
  z
    .object({
      status: z.literal("invalid"),
      failureKind: z.enum([
        "content_mismatch",
        "metadata_mismatch",
        "receipt_contract_mismatch",
        "transplanted_identity",
      ]),
    })
    .strict(),
]);

const ActivationClaimObservationV2Schema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("absent") }).strict(),
  z
    .object({
      status: z.literal("exact"),
      claim: PlatformReleaseBootstrapRegistryActivationClaimV2Schema,
      physicalIdentityHash: Sha256Schema,
      ...ExactRegularFileObservationPhysicalEvidenceV2Schema.shape,
    })
    .strict(),
  z
    .object({
      status: z.literal("invalid"),
      failureKind: z.enum([
        "claim_contract_mismatch",
        "content_mismatch",
        "metadata_mismatch",
        "transplanted_identity",
      ]),
    })
    .strict(),
]);

const ActivationStagingPayloadMemberKindV2Schema = z.enum([
  "staged_activation_receipt",
  "staged_genesis_epoch_state",
  "staged_shared_lock",
]);

const EpochStagingPayloadMemberKindV2Schema = z.literal(
  "staged_target_epoch_state",
);

const StagingPhysicalMemberKindV2Schema = z.union([
  ActivationStagingPayloadMemberKindV2Schema,
  EpochStagingPayloadMemberKindV2Schema,
]);

const StagingPhysicalEntryClassificationV2Schema = z
  .object({
    schema: z.literal(
      "setfarm.platform-release-bootstrap-registry-staging-entry-classification.v2",
    ),
    version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
    memberKind: StagingPhysicalMemberKindV2Schema,
    basename: StagingPhysicalMemberKindV2Schema,
    objectKind: z.literal("ordinary_file"),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.basename !== value.memberKind) {
      context.addIssue({
        code: "custom",
        path: ["basename"],
        message:
          "Staging entry basename must canonically equal its code-owned member kind",
      });
    }
  });

const StagingPhysicalMemberV2Schema = z
  .object({
    memberKind: StagingPhysicalMemberKindV2Schema,
    classification: StagingPhysicalEntryClassificationV2Schema,
    parentObjectIdentityHash: Sha256Schema,
    parentObjectIdentity: StableFsObjectIdentityV2Schema,
    logicalIdentityHash: Sha256Schema,
    physicalIdentityHash: Sha256Schema,
    objectIdentity: StableFsObjectIdentityV2Schema,
    fingerprint: FsObservationFingerprintV2Schema,
    rawContentHash: Sha256Schema,
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.classification.memberKind !== value.memberKind ||
      value.classification.basename !== value.memberKind ||
      value.classification.objectKind !== "ordinary_file" ||
      value.parentObjectIdentity.objectKind !== "directory" ||
      value.objectIdentity.objectKind !== "ordinary_file" ||
      value.parentObjectIdentityHash !==
        value.parentObjectIdentity.objectIdentityHash ||
      value.parentObjectIdentity.filesystemScopeIdentityHash !==
        value.objectIdentity.filesystemScopeIdentityHash ||
      filesystemObjectLocatorKeyV2(value.parentObjectIdentity) ===
        filesystemObjectLocatorKeyV2(value.objectIdentity) ||
      value.physicalIdentityHash !== value.objectIdentity.objectIdentityHash ||
      value.fingerprint.objectIdentityHash !==
        value.objectIdentity.objectIdentityHash ||
      value.physicalIdentityHash === value.logicalIdentityHash ||
      value.physicalIdentityHash === value.rawContentHash ||
      value.physicalIdentityHash === value.fingerprint.fingerprintHash ||
      value.fingerprint.fingerprintHash === value.logicalIdentityHash ||
      value.fingerprint.fingerprintHash === value.rawContentHash
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Staging physical member must bind one exact ordinary-file classification, staging-directory parent, stable object, occurrence fingerprint, raw content, and distinct logical identity",
      });
    }
  });

export type PlatformReleaseBootstrapRegistryStagingPhysicalMemberV2 = z.infer<
  typeof StagingPhysicalMemberV2Schema
>;

const StagingPhysicalMemberBuilderInputV2Schema = z
  .object({
    memberKind: StagingPhysicalMemberKindV2Schema,
    parentObjectIdentity: StableFsObjectIdentityV2Schema,
    logicalIdentityHash: Sha256Schema,
    objectIdentity: StableFsObjectIdentityV2Schema,
    fingerprint: FsObservationFingerprintV2Schema,
    rawContentHash: Sha256Schema,
  })
  .strict();

export function buildPlatformReleaseBootstrapRegistryStagingPhysicalMemberV2(
  input: z.infer<typeof StagingPhysicalMemberBuilderInputV2Schema>,
): PlatformReleaseBootstrapRegistryStagingPhysicalMemberV2 {
  const parsed = StagingPhysicalMemberBuilderInputV2Schema.parse(
    boundedPlatformReleaseJsonSnapshotV2(
      input,
      PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_ACTIVATION_OBSERVATION_MAX_CANONICAL_BYTES_V2,
    ),
  );
  return deepFreezePlatformReleaseJsonV2(
    StagingPhysicalMemberV2Schema.parse({
      ...parsed,
      classification: {
        schema:
          "setfarm.platform-release-bootstrap-registry-staging-entry-classification.v2",
        version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
        memberKind: parsed.memberKind,
        basename: parsed.memberKind,
        objectKind: "ordinary_file",
      },
      parentObjectIdentityHash: parsed.parentObjectIdentity.objectIdentityHash,
      physicalIdentityHash: parsed.objectIdentity.objectIdentityHash,
    }),
  );
}

export type PlatformReleaseBootstrapRegistryActivationStagingPayloadMemberV2 =
  PlatformReleaseBootstrapRegistryStagingPhysicalMemberV2;

function expectedStagingDirectoryMembershipEntriesV2(
  members: readonly PlatformReleaseBootstrapRegistryStagingPhysicalMemberV2[],
) {
  return members
    .map((member) => ({
      basename: member.classification.basename,
      objectKind: member.classification.objectKind,
    }))
    .sort((left, right) => compareUtf16V2(left.basename, right.basename));
}

function stagingDirectoryEvidenceJoinsMembersV2(
  stagingDirectoryIdentityHash: string,
  stagingDirectoryFingerprint: z.infer<typeof FsObservationFingerprintV2Schema>,
  stagingDirectoryMembership: z.infer<
    typeof DirectoryMembershipIdentityV2Schema
  >,
  members: readonly PlatformReleaseBootstrapRegistryStagingPhysicalMemberV2[],
): boolean {
  return (
    stagingDirectoryFingerprint.objectIdentityHash ===
      stagingDirectoryIdentityHash &&
    members.every(
      (member) =>
        member.parentObjectIdentityHash === stagingDirectoryIdentityHash &&
        member.parentObjectIdentity.objectIdentityHash ===
          stagingDirectoryIdentityHash,
    ) &&
    canonicalJsonStringify(stagingDirectoryMembership.orderedEntries) ===
      canonicalJsonStringify(
        expectedStagingDirectoryMembershipEntriesV2(members),
      )
  );
}

export function hashPlatformReleaseBootstrapRegistryOrphanStagingCensusV2(
  transactionKind: "activation" | "epoch_floor",
  orderedMembers: readonly PlatformReleaseBootstrapRegistryStagingPhysicalMemberV2[],
): string {
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-bootstrap-registry-orphan-staging-census.v2",
    transactionKind,
    orderedMembers,
  });
}

const ACTIVATION_STAGING_PAYLOAD_MEMBER_ORDER_V2 =
  ActivationStagingPayloadMemberKindV2Schema.options;

const ActivationStagingPayloadMemberV2Schema =
  StagingPhysicalMemberV2Schema.refine(
    (value) =>
      ActivationStagingPayloadMemberKindV2Schema.safeParse(value.memberKind)
        .success,
    "Expected one activation staging payload member",
  );

function activationStagingPayloadMembersV2(value: {
  stagedActivationReceiptHash: string;
  stagedActivationReceipt: PlatformReleaseBootstrapRegistryStagingPhysicalMemberV2;
  stagedGenesisEpochStateHash: string;
  stagedGenesisEpochState: PlatformReleaseBootstrapRegistryStagingPhysicalMemberV2;
  stagedSharedLockContentHash: string;
  stagedSharedLock: PlatformReleaseBootstrapRegistryStagingPhysicalMemberV2;
}): readonly PlatformReleaseBootstrapRegistryActivationStagingPayloadMemberV2[] {
  return [
    value.stagedActivationReceipt,
    value.stagedGenesisEpochState,
    value.stagedSharedLock,
  ];
}

export function hashPlatformReleaseBootstrapRegistryActivationStagingInitialCensusV2(
  orderedMembers: readonly Readonly<{
    memberKind: string;
    logicalIdentityHash: string;
    physicalIdentityHash: string;
  }>[],
): string {
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-bootstrap-registry-activation-staging-initial-census.v2",
    orderedMembers: orderedMembers.map((member) => ({
      memberKind: member.memberKind,
      logicalIdentityHash: member.logicalIdentityHash,
      physicalIdentityHash: member.physicalIdentityHash,
    })),
  });
}

export function hashPlatformReleaseBootstrapRegistryActivationCleanupRemainingCensusV2(
  remainingMembers: readonly Readonly<{
    memberKind: string;
    logicalIdentityHash: string;
    physicalIdentityHash: string;
  }>[],
): string {
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-bootstrap-registry-activation-cleanup-remaining-census.v2",
    remainingMembers: remainingMembers.map((member) => ({
      memberKind: member.memberKind,
      logicalIdentityHash: member.logicalIdentityHash,
      physicalIdentityHash: member.physicalIdentityHash,
    })),
  });
}

const EpochStagingTargetMemberV2Schema = StagingPhysicalMemberV2Schema.refine(
  (value) => value.memberKind === "staged_target_epoch_state",
  "Expected one epoch target staging member",
);

export function hashPlatformReleaseBootstrapRegistryEpochStagingCurrentCensusV2(
  remainingMembers: readonly Readonly<{
    memberKind: string;
    logicalIdentityHash: string;
    physicalIdentityHash: string;
  }>[],
): string {
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-bootstrap-registry-epoch-staging-current-census.v2",
    remainingMembers: remainingMembers.map((member) => ({
      memberKind: member.memberKind,
      logicalIdentityHash: member.logicalIdentityHash,
      physicalIdentityHash: member.physicalIdentityHash,
    })),
  });
}

const ExactTransactionStagingObservationV2Schema = z.union([
  z
    .object({
      status: z.literal("exact"),
      transactionKind: z.literal("activation"),
      transactionIdentityHash: Sha256Schema,
      stagingDirectoryIdentityHash: Sha256Schema,
      stagingDirectoryFingerprint: FsObservationFingerprintV2Schema,
      stagingDirectoryMembership: DirectoryMembershipIdentityV2Schema,
      stagingCensusHash: Sha256Schema,
      preActivationNamespaceCaptureHash: Sha256Schema,
      stagedSharedLockContentHash: z.literal(
        PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.registry.sharedLockContentHash,
      ),
      stagedSharedLock: StagingPhysicalMemberV2Schema,
      stagedGenesisEpochStateHash: Sha256Schema,
      stagedGenesisEpochState: StagingPhysicalMemberV2Schema,
      stagedActivationReceiptHash: Sha256Schema,
      stagedActivationReceipt: StagingPhysicalMemberV2Schema,
      orderedMembers: z.tuple([
        ActivationStagingPayloadMemberV2Schema,
        ActivationStagingPayloadMemberV2Schema,
        ActivationStagingPayloadMemberV2Schema,
      ]),
    })
    .strict()
    .superRefine((value, context) => {
      const expectedMembers = activationStagingPayloadMembersV2(value);
      const hashes = [
        value.transactionIdentityHash,
        value.stagingDirectoryIdentityHash,
        value.stagingCensusHash,
        value.preActivationNamespaceCaptureHash,
        value.stagedSharedLockContentHash,
        value.stagedSharedLock.physicalIdentityHash,
        value.stagedGenesisEpochStateHash,
        value.stagedGenesisEpochState.physicalIdentityHash,
        value.stagedActivationReceiptHash,
        value.stagedActivationReceipt.physicalIdentityHash,
      ];
      if (new Set(hashes).size !== hashes.length) {
        context.addIssue({
          code: "custom",
          message:
            "Exact activation staging evidence hashes must be pairwise distinct",
        });
      }
      if (
        value.stagedActivationReceipt.memberKind !==
          "staged_activation_receipt" ||
        value.stagedActivationReceipt.logicalIdentityHash !==
          value.stagedActivationReceiptHash ||
        value.stagedGenesisEpochState.memberKind !==
          "staged_genesis_epoch_state" ||
        value.stagedGenesisEpochState.logicalIdentityHash !==
          value.stagedGenesisEpochStateHash ||
        value.stagedSharedLock.memberKind !== "staged_shared_lock" ||
        value.stagedSharedLock.logicalIdentityHash !==
          value.stagedSharedLockContentHash ||
        canonicalJsonStringify(value.orderedMembers) !==
          canonicalJsonStringify(expectedMembers) ||
        value.orderedMembers.some(
          (member, index) =>
            member.memberKind !==
            ACTIVATION_STAGING_PAYLOAD_MEMBER_ORDER_V2[index],
        ) ||
        !stagingDirectoryEvidenceJoinsMembersV2(
          value.stagingDirectoryIdentityHash,
          value.stagingDirectoryFingerprint,
          value.stagingDirectoryMembership,
          value.orderedMembers,
        )
      ) {
        context.addIssue({
          code: "custom",
          path: ["orderedMembers"],
          message:
            "Exact activation staging members must equal the fixed ordered logical and physical projection",
        });
      }
      if (
        value.stagingCensusHash !==
        hashPlatformReleaseBootstrapRegistryActivationStagingInitialCensusV2(
          expectedMembers,
        )
      ) {
        context.addIssue({
          code: "custom",
          path: ["stagingCensusHash"],
          message:
            "Exact activation staging census must derive from the fixed ordered logical and physical projection",
        });
      }
    }),
  z
    .object({
      status: z.literal("exact"),
      transactionKind: z.literal("epoch_floor"),
      transactionIdentityHash: Sha256Schema,
      stagingDirectoryIdentityHash: Sha256Schema,
      stagingDirectoryFingerprint: FsObservationFingerprintV2Schema,
      stagingDirectoryMembership: DirectoryMembershipIdentityV2Schema,
      stagingCensusHash: Sha256Schema,
      stagedTargetEpochState:
        PlatformReleaseBootstrapRegistryEpochFloorStateV2Schema,
      stagedTargetEpochMember: StagingPhysicalMemberV2Schema,
      orderedMembers: z.tuple([EpochStagingTargetMemberV2Schema]),
    })
    .strict()
    .superRefine((value, context) => {
      const expectedHashMember = {
        memberKind: "staged_target_epoch_state",
        logicalIdentityHash: value.stagedTargetEpochState.epochStateHash,
        physicalIdentityHash:
          value.stagedTargetEpochMember.physicalIdentityHash,
      } as const;
      const hashes = [
        value.transactionIdentityHash,
        value.stagingDirectoryIdentityHash,
        value.stagingCensusHash,
        value.stagedTargetEpochState.epochStateHash,
        value.stagedTargetEpochMember.physicalIdentityHash,
      ];
      if (new Set(hashes).size !== hashes.length) {
        context.addIssue({
          code: "custom",
          message:
            "Exact epoch staging evidence hashes must be pairwise distinct",
        });
      }
      if (
        value.stagedTargetEpochMember.memberKind !==
          "staged_target_epoch_state" ||
        value.stagedTargetEpochMember.logicalIdentityHash !==
          value.stagedTargetEpochState.epochStateHash ||
        canonicalJsonStringify(value.orderedMembers) !==
          canonicalJsonStringify([value.stagedTargetEpochMember]) ||
        !stagingDirectoryEvidenceJoinsMembersV2(
          value.stagingDirectoryIdentityHash,
          value.stagingDirectoryFingerprint,
          value.stagingDirectoryMembership,
          value.orderedMembers,
        ) ||
        value.stagingCensusHash !==
          hashPlatformReleaseBootstrapRegistryEpochStagingInitialCensusV2([
            expectedHashMember,
          ])
      ) {
        context.addIssue({
          code: "custom",
          path: ["orderedMembers"],
          message:
            "Exact epoch staging must contain one derived logical and physical target projection",
        });
      }
    }),
]);

const TransactionStagingObservationV2Schema = z.union([
  z.object({ status: z.literal("absent") }).strict(),
  ExactTransactionStagingObservationV2Schema,
  z
    .object({
      status: z.literal("cleanup_partial"),
      transactionKind: z.literal("activation"),
      transactionIdentityHash: Sha256Schema,
      stagingDirectoryIdentityHash: Sha256Schema,
      stagingDirectoryFingerprint: FsObservationFingerprintV2Schema,
      stagingDirectoryMembership: DirectoryMembershipIdentityV2Schema,
      initialStagingCensusHash: Sha256Schema,
      currentRemainingCensusHash: Sha256Schema,
      preActivationNamespaceCaptureHash: Sha256Schema,
      stagedSharedLockContentHash: z.literal(
        PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.registry.sharedLockContentHash,
      ),
      stagedSharedLock: StagingPhysicalMemberV2Schema,
      stagedGenesisEpochStateHash: Sha256Schema,
      stagedGenesisEpochState: StagingPhysicalMemberV2Schema,
      stagedActivationReceiptHash: Sha256Schema,
      stagedActivationReceipt: StagingPhysicalMemberV2Schema,
      remainingMembers: z.array(ActivationStagingPayloadMemberV2Schema).max(2),
    })
    .strict()
    .superRefine((value, context) => {
      const expectedMembers = activationStagingPayloadMembersV2(value);
      const hashes = [
        value.transactionIdentityHash,
        value.stagingDirectoryIdentityHash,
        value.initialStagingCensusHash,
        value.currentRemainingCensusHash,
        value.preActivationNamespaceCaptureHash,
        value.stagedSharedLockContentHash,
        value.stagedSharedLock.physicalIdentityHash,
        value.stagedGenesisEpochStateHash,
        value.stagedGenesisEpochState.physicalIdentityHash,
        value.stagedActivationReceiptHash,
        value.stagedActivationReceipt.physicalIdentityHash,
      ];
      const expectedRemainingMembers = expectedMembers.slice(
        expectedMembers.length - value.remainingMembers.length,
      );
      if (new Set(hashes).size !== hashes.length) {
        context.addIssue({
          code: "custom",
          message:
            "Partial activation cleanup evidence hashes must be pairwise distinct",
        });
      }
      if (
        value.stagedActivationReceipt.memberKind !==
          "staged_activation_receipt" ||
        value.stagedActivationReceipt.logicalIdentityHash !==
          value.stagedActivationReceiptHash ||
        value.stagedGenesisEpochState.memberKind !==
          "staged_genesis_epoch_state" ||
        value.stagedGenesisEpochState.logicalIdentityHash !==
          value.stagedGenesisEpochStateHash ||
        value.stagedSharedLock.memberKind !== "staged_shared_lock" ||
        value.stagedSharedLock.logicalIdentityHash !==
          value.stagedSharedLockContentHash ||
        canonicalJsonStringify(value.remainingMembers) !==
          canonicalJsonStringify(expectedRemainingMembers) ||
        !stagingDirectoryEvidenceJoinsMembersV2(
          value.stagingDirectoryIdentityHash,
          value.stagingDirectoryFingerprint,
          value.stagingDirectoryMembership,
          value.remainingMembers,
        ) ||
        value.initialStagingCensusHash !==
          hashPlatformReleaseBootstrapRegistryActivationStagingInitialCensusV2(
            expectedMembers,
          )
      ) {
        context.addIssue({
          code: "custom",
          path: ["remainingMembers"],
          message:
            "Partial activation cleanup must preserve the exact initial census and ordered logical and physical suffix",
        });
      }
      if (
        value.currentRemainingCensusHash !==
        hashPlatformReleaseBootstrapRegistryActivationCleanupRemainingCensusV2(
          value.remainingMembers,
        )
      ) {
        context.addIssue({
          code: "custom",
          path: ["currentRemainingCensusHash"],
          message:
            "Partial activation cleanup current census must be deterministically reproduced from the remaining-member projection",
        });
      }
    }),
  z
    .object({
      status: z.literal("epoch_target_consumed"),
      transactionKind: z.literal("epoch_floor"),
      transactionIdentityHash: Sha256Schema,
      stagingDirectoryIdentityHash: Sha256Schema,
      stagingDirectoryFingerprint: FsObservationFingerprintV2Schema,
      stagingDirectoryMembership: DirectoryMembershipIdentityV2Schema,
      initialStagingCensusHash: Sha256Schema,
      currentRemainingCensusHash: Sha256Schema,
      stagedTargetEpochState:
        PlatformReleaseBootstrapRegistryEpochFloorStateV2Schema,
      stagedTargetEpochMember: StagingPhysicalMemberV2Schema,
      remainingMembers: z.array(EpochStagingTargetMemberV2Schema).length(0),
    })
    .strict()
    .superRefine((value, context) => {
      const initialMember = {
        memberKind: "staged_target_epoch_state",
        logicalIdentityHash: value.stagedTargetEpochState.epochStateHash,
        physicalIdentityHash:
          value.stagedTargetEpochMember.physicalIdentityHash,
      } as const;
      const hashes = [
        value.transactionIdentityHash,
        value.stagingDirectoryIdentityHash,
        value.initialStagingCensusHash,
        value.currentRemainingCensusHash,
        value.stagedTargetEpochState.epochStateHash,
        value.stagedTargetEpochMember.physicalIdentityHash,
      ];
      if (
        value.stagedTargetEpochMember.memberKind !==
          "staged_target_epoch_state" ||
        value.stagedTargetEpochMember.logicalIdentityHash !==
          value.stagedTargetEpochState.epochStateHash ||
        value.stagedTargetEpochMember.parentObjectIdentityHash !==
          value.stagingDirectoryIdentityHash ||
        value.stagedTargetEpochMember.parentObjectIdentity
          .objectIdentityHash !== value.stagingDirectoryIdentityHash ||
        !stagingDirectoryEvidenceJoinsMembersV2(
          value.stagingDirectoryIdentityHash,
          value.stagingDirectoryFingerprint,
          value.stagingDirectoryMembership,
          value.remainingMembers,
        ) ||
        new Set(hashes).size !== hashes.length ||
        value.initialStagingCensusHash !==
          hashPlatformReleaseBootstrapRegistryEpochStagingInitialCensusV2([
            initialMember,
          ]) ||
        value.currentRemainingCensusHash !==
          hashPlatformReleaseBootstrapRegistryEpochStagingCurrentCensusV2(
            value.remainingMembers,
          )
      ) {
        context.addIssue({
          code: "custom",
          message:
            "Consumed epoch target staging must bind one exact initial member and one exact empty current census",
        });
      }
    }),
  z
    .object({
      status: z.literal("orphan"),
      transactionKind: z.enum(["activation", "epoch_floor"]),
      stagingDirectoryIdentityHash: Sha256Schema,
      stagingDirectoryFingerprint: FsObservationFingerprintV2Schema,
      stagingDirectoryMembership: DirectoryMembershipIdentityV2Schema,
      stagingCensusHash: Sha256Schema,
      orderedMembers: z.array(StagingPhysicalMemberV2Schema).max(3),
    })
    .strict()
    .superRefine((value, context) => {
      const memberKinds = value.orderedMembers.map(
        (member) => member.memberKind,
      );
      const activationMemberOrderIsExactSubset = memberKinds.every(
        (memberKind, index) =>
          ActivationStagingPayloadMemberKindV2Schema.safeParse(memberKind)
            .success &&
          ACTIVATION_STAGING_PAYLOAD_MEMBER_ORDER_V2.indexOf(
            memberKind as z.infer<
              typeof ActivationStagingPayloadMemberKindV2Schema
            >,
          ) === index,
      );
      const epochMembersAreExact =
        memberKinds.length <= 1 &&
        memberKinds.every(
          (memberKind) => memberKind === "staged_target_epoch_state",
        );
      if (
        value.stagingDirectoryIdentityHash === value.stagingCensusHash ||
        (value.transactionKind === "activation"
          ? !activationMemberOrderIsExactSubset
          : !epochMembersAreExact) ||
        !stagingDirectoryEvidenceJoinsMembersV2(
          value.stagingDirectoryIdentityHash,
          value.stagingDirectoryFingerprint,
          value.stagingDirectoryMembership,
          value.orderedMembers,
        ) ||
        value.stagingCensusHash !==
          hashPlatformReleaseBootstrapRegistryOrphanStagingCensusV2(
            value.transactionKind,
            value.orderedMembers,
          )
      ) {
        context.addIssue({
          code: "custom",
          message:
            "Orphan staging must bind one exact safe typed membership and current payload census",
        });
      }
    }),
  z
    .object({
      status: z.literal("invalid"),
      failureKind: z.enum([
        "changing_census",
        "foreign_member",
        "metadata_mismatch",
        "stage_contract_mismatch",
      ]),
    })
    .strict(),
]);

const ClaimedPackageLifecycleProjectionIdentityV2Schema = z
  .object({
    schema: z.literal(
      "setfarm.platform-release-bootstrap-registry-claimed-package-lifecycle-projection.v2",
    ),
    version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
    packageRef: PlatformReleaseBootstrapPackageRefV2Schema,
    entryCount: z.number().int().positive().max(16_384),
    orderedEntries: z
      .array(PlatformReleaseBootstrapNamespaceClassificationV2Schema)
      .min(1)
      .max(16_384),
  })
  .strict();

export type PlatformReleaseBootstrapRegistryClaimedPackageLifecycleProjectionHashPayloadV2 =
  z.infer<typeof ClaimedPackageLifecycleProjectionIdentityV2Schema>;

export function hashPlatformReleaseBootstrapRegistryClaimedPackageLifecycleProjectionV2(
  value:
    | PlatformReleaseBootstrapRegistryClaimedPackageLifecycleProjectionHashPayloadV2
    | Readonly<Record<string, unknown>>,
): string {
  const projection = { ...value } as Record<string, unknown>;
  delete projection.censusHash;
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-bootstrap-registry-claimed-package-lifecycle-projection-hash.v2",
    projection,
  });
}

const ClaimedPackageLifecycleProjectionV2Schema =
  ClaimedPackageLifecycleProjectionIdentityV2Schema.extend({
    censusHash: Sha256Schema,
  })
    .strict()
    .superRefine((value, context) => {
      if (
        value.entryCount !== value.orderedEntries.length ||
        !value.orderedEntries.some(
          (entry) =>
            entry.ownerKind === "package" &&
            entry.ownerRef === value.packageRef &&
            entry.category === "package_lock",
        ) ||
        value.orderedEntries.some(
          (entry, index) =>
            entry.ownerKind !== "package" ||
            entry.ownerRef !== value.packageRef ||
            (index > 0 &&
              compareUtf16V2(
                value.orderedEntries[index - 1]!.basename,
                entry.basename,
              ) >= 0),
        ) ||
        value.censusHash !==
          hashPlatformReleaseBootstrapRegistryClaimedPackageLifecycleProjectionV2(
            value,
          )
      ) {
        context.addIssue({
          code: "custom",
          message:
            "Claimed package lifecycle projection must be exact, sorted, nonempty, package-owned, and include its package lock",
        });
      }
    });

export type PlatformReleaseBootstrapRegistryClaimedPackageLifecycleProjectionV2 =
  z.infer<typeof ClaimedPackageLifecycleProjectionV2Schema>;

export function projectPlatformReleaseBootstrapRegistryClaimedPackageLifecycleV2(
  census: PlatformReleaseBootstrapNamespaceCensusV2,
  packageRef: z.infer<typeof PlatformReleaseBootstrapPackageRefV2Schema>,
): PlatformReleaseBootstrapRegistryClaimedPackageLifecycleProjectionV2 {
  const parsedCensus =
    PlatformReleaseBootstrapNamespaceCensusV2Schema.parse(census);
  const parsedPackageRef =
    PlatformReleaseBootstrapPackageRefV2Schema.parse(packageRef);
  const identity = {
    schema:
      "setfarm.platform-release-bootstrap-registry-claimed-package-lifecycle-projection.v2",
    version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
    packageRef: parsedPackageRef,
    orderedEntries: parsedCensus.orderedEntries.filter(
      (entry) =>
        entry.ownerKind === "package" && entry.ownerRef === parsedPackageRef,
    ),
  } as const;
  const withCount = {
    ...identity,
    entryCount: identity.orderedEntries.length,
  };
  return deepFreezePlatformReleaseJsonV2(
    ClaimedPackageLifecycleProjectionV2Schema.parse({
      ...withCount,
      censusHash:
        hashPlatformReleaseBootstrapRegistryClaimedPackageLifecycleProjectionV2(
          withCount,
        ),
    }),
  );
}

const EpochClaimObservationV2Schema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("absent") }).strict(),
  z
    .object({
      status: z.literal("exact"),
      claim: PlatformReleaseBootstrapRegistryEpochClaimV2Schema,
      physicalIdentityHash: Sha256Schema,
      packageRef: PlatformReleaseBootstrapPackageRefV2Schema,
      packageLifecycleProjection: PackageLifecyclePhysicalProjectionV2Schema,
      observedInstallationGeneration: z.number().int().nonnegative().safe(),
      ...ExactRegularFileObservationPhysicalEvidenceV2Schema.shape,
    })
    .strict()
    .superRefine((value, context) => {
      if (
        value.packageRef !== value.claim.packageRef ||
        value.packageLifecycleProjection.packageRef !== value.packageRef
      ) {
        context.addIssue({
          code: "custom",
          message:
            "Epoch recovery package tag and physical lifecycle projection must join the exact claim",
        });
      }
    }),
  z
    .object({
      status: z.literal("invalid"),
      failureKind: z.enum([
        "content_mismatch",
        "metadata_mismatch",
        "claim_contract_mismatch",
        "transplanted_identity",
      ]),
    })
    .strict(),
]);

const ActivationObservationIdentityV2Schema = z
  .object({
    schema: z.literal(
      PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_ACTIVATION_OBSERVATION_V2_SCHEMA,
    ),
    version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
    registryRef: z.literal(REGISTRY_REF_V2),
    registryContractHash: z.literal(REGISTRY_CONTRACT_HASH_V2),
    filesystemScope: BootstrapFilesystemScopeIdentityV2Schema,
    legacyLock: LegacyLockObservationV2Schema,
    sharedLock: SharedLockObservationV2Schema,
    parentBoundary: ParentBoundaryObservationV2Schema,
    nodeLifecycle: NodeLifecycleObservationV2Schema,
    namespace: NamespaceObservationV2Schema,
    epochFloor: EpochFloorObservationV2Schema,
    activationClaim: ActivationClaimObservationV2Schema,
    activationReceipt: ActivationReceiptObservationV2Schema,
    epochClaim: EpochClaimObservationV2Schema,
    transactionStaging: TransactionStagingObservationV2Schema,
  })
  .strict();

export const PlatformReleaseBootstrapRegistryActivationObservationV2Schema =
  ActivationObservationIdentityV2Schema.superRefine((value, context) => {
    if (
      value.namespace.status === "exact" &&
      (value.filesystemScope.scopeIdentityHash !==
        value.namespace.physicalCensus.filesystemScopeIdentityHash ||
        canonicalJsonStringify(value.filesystemScope) !==
          canonicalJsonStringify(
            value.namespace.physicalCensus.filesystemScope,
          ))
    ) {
      context.addIssue({
        code: "custom",
        path: ["filesystemScope"],
        message:
          "Registry activation observation filesystem scope must be the single full identity source for its physical census",
      });
    }
    if (
      !platformReleaseCandidateFitsCanonicalCapV2(
        value,
        PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_ACTIVATION_OBSERVATION_MAX_CANONICAL_BYTES_V2,
      )
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Registry activation observation exceeds its fixed canonical byte cap",
      });
    }
  });

export type PlatformReleaseBootstrapRegistryActivationObservationV2 = z.infer<
  typeof PlatformReleaseBootstrapRegistryActivationObservationV2Schema
>;

export type PlatformReleaseBootstrapRegistryActivationObservationInputV2 = Omit<
  PlatformReleaseBootstrapRegistryActivationObservationV2,
  "schema" | "version" | "registryRef" | "registryContractHash"
>;

const ActivationObservationInputV2Schema =
  ActivationObservationIdentityV2Schema.omit({
    schema: true,
    version: true,
    registryRef: true,
    registryContractHash: true,
  }).strict();

export type PlatformReleaseBootstrapRegistryActivationDecisionV2 = Readonly<{
  state: PlatformReleaseBootstrapRegistryActivationStateV2;
  nextAction: PlatformReleaseBootstrapRegistryActivationNextActionV2;
  requiredLockOrder: readonly z.infer<typeof ActivationLockRoleV2Schema>[];
  corruptionReasons: readonly PlatformReleaseBootstrapRegistryActivationCorruptionReasonV2[];
  epochClaimDisposition: PlatformReleaseBootstrapRegistryEpochClaimDispositionV2;
  genesisEpochFloorState: PlatformReleaseBootstrapRegistryEpochFloorStateV2 | null;
  expectedActivationReceipt: PlatformReleaseBootstrapRegistryActivationReceiptV2 | null;
  expectedActivationClaim: PlatformReleaseBootstrapRegistryActivationClaimV2 | null;
}>;

function namespaceHasEntryV2(
  census: PlatformReleaseBootstrapNamespaceCensusV2,
  ownerKind: "registry" | "package",
  category: string,
  ownerRef?: string,
): boolean {
  return census.orderedEntries.some(
    (entry) =>
      entry.ownerKind === ownerKind &&
      entry.category === category &&
      (ownerRef === undefined || entry.ownerRef === ownerRef),
  );
}

function exactNamespacePhysicalCaptureV2(
  observation: PlatformReleaseBootstrapRegistryActivationObservationV2,
  ownerKind: "registry" | "package",
  category: string,
  ownerRef?: string,
): NamespacePhysicalEntryCaptureV2 | null {
  if (observation.namespace.status !== "exact") return null;
  const matches =
    observation.namespace.physicalCensus.orderedEntryCaptures.filter(
      (capture) =>
        capture.classification.ownerKind === ownerKind &&
        capture.classification.category === category &&
        (ownerRef === undefined ||
          capture.classification.ownerRef === ownerRef),
    );
  return matches.length === 1 ? matches[0]! : null;
}

function rawContentHashFromGlobalCaptureV2(
  capture: NamespacePhysicalEntryCaptureV2 | null,
): string | null {
  return capture?.contentEvidence.kind === "bounded_regular_file_bytes"
    ? capture.contentEvidence.rawContentHash
    : null;
}

function stagingHashMemberFromGlobalCaptureV2(
  memberKind: z.infer<typeof StagingPhysicalMemberKindV2Schema>,
  logicalIdentityHash: string,
  capture: NamespacePhysicalEntryCaptureV2 | null,
): Readonly<{
  memberKind: z.infer<typeof StagingPhysicalMemberKindV2Schema>;
  logicalIdentityHash: string;
  physicalIdentityHash: string;
}> | null {
  if (!capture || capture.objectIdentity.objectKind !== "ordinary_file")
    return null;
  return {
    memberKind,
    logicalIdentityHash,
    physicalIdentityHash: capture.objectIdentity.objectIdentityHash,
  };
}

function observationPresenceMatchesNamespaceV2(
  observation: PlatformReleaseBootstrapRegistryActivationObservationV2,
): boolean {
  if (observation.namespace.status !== "exact") return false;
  const census = observation.namespace.census;
  const legacyLockPresent = observation.legacyLock.status !== "absent";
  const sharedLockPresent = observation.sharedLock.status !== "absent";
  const epochFloorPresent = observation.epochFloor.status !== "absent";
  const activationReceiptPresent =
    observation.activationReceipt.status !== "absent";
  const activationClaimPresent =
    observation.activationClaim.status !== "absent";
  const epochClaimPresent = observation.epochClaim.status !== "absent";
  const transactionStagingPresent =
    observation.transactionStaging.status !== "absent";
  return (
    namespaceHasEntryV2(
      census,
      "registry",
      "filesystem_scope",
      REGISTRY_REF_V2,
    ) &&
    namespaceHasEntryV2(
      census,
      "package",
      "package_lock",
      NODE_PACKAGE_REF_V2,
    ) === legacyLockPresent &&
    namespaceHasEntryV2(
      census,
      "registry",
      "shared_parent_lock",
      REGISTRY_REF_V2,
    ) === sharedLockPresent &&
    namespaceHasEntryV2(
      census,
      "registry",
      "epoch_floor_state",
      REGISTRY_REF_V2,
    ) === epochFloorPresent &&
    namespaceHasEntryV2(
      census,
      "registry",
      "activation_claim",
      REGISTRY_REF_V2,
    ) === activationClaimPresent &&
    namespaceHasEntryV2(
      census,
      "registry",
      "activation_receipt",
      REGISTRY_REF_V2,
    ) === activationReceiptPresent &&
    namespaceHasEntryV2(census, "registry", "epoch_claim", REGISTRY_REF_V2) ===
      epochClaimPresent &&
    namespaceHasEntryV2(
      census,
      "registry",
      "transaction_staging",
      REGISTRY_REF_V2,
    ) === transactionStagingPresent
  );
}

function stagePhysicalMembersV2(
  observation: PlatformReleaseBootstrapRegistryActivationObservationV2,
): readonly PlatformReleaseBootstrapRegistryStagingPhysicalMemberV2[] {
  const stage = observation.transactionStaging;
  if (
    (stage.status === "exact" || stage.status === "cleanup_partial") &&
    stage.transactionKind === "activation"
  ) {
    return [
      stage.stagedActivationReceipt,
      stage.stagedGenesisEpochState,
      stage.stagedSharedLock,
    ];
  }
  if (
    (stage.status === "exact" && stage.transactionKind === "epoch_floor") ||
    stage.status === "epoch_target_consumed"
  ) {
    return [stage.stagedTargetEpochMember];
  }
  if (stage.status === "orphan") {
    return stage.orderedMembers;
  }
  return [];
}

function currentLiveStageMembersV2(
  observation: PlatformReleaseBootstrapRegistryActivationObservationV2,
): readonly PlatformReleaseBootstrapRegistryStagingPhysicalMemberV2[] {
  const stage = observation.transactionStaging;
  if (stage.status === "exact") return stage.orderedMembers;
  if (stage.status === "cleanup_partial") {
    return stage.remainingMembers;
  }
  if (stage.status === "orphan") {
    return stage.orderedMembers;
  }
  return [];
}

function globalPhysicalObservationJoinsNamespaceV2(
  observation: PlatformReleaseBootstrapRegistryActivationObservationV2,
): boolean {
  if (observation.namespace.status !== "exact") return false;
  const capture = (
    ownerKind: "registry" | "package",
    category: string,
    ownerRef?: string,
  ): NamespacePhysicalEntryCaptureV2 | null =>
    exactNamespacePhysicalCaptureV2(observation, ownerKind, category, ownerRef);
  const regularFileEvidenceJoins = (
    exactCapture: NamespacePhysicalEntryCaptureV2 | null,
    physicalIdentityHash: string,
    physicalFingerprint: z.infer<typeof FsObservationFingerprintV2Schema>,
    rawContentHash: string,
    expectedRawContentHash: string,
  ): boolean =>
    exactCapture !== null &&
    exactCapture.objectIdentity.objectKind === "ordinary_file" &&
    exactCapture.objectIdentity.objectIdentityHash === physicalIdentityHash &&
    canonicalJsonStringify(exactCapture.fingerprint) ===
      canonicalJsonStringify(physicalFingerprint) &&
    rawContentHashFromGlobalCaptureV2(exactCapture) === rawContentHash &&
    rawContentHash === expectedRawContentHash;
  const stage = observation.transactionStaging;
  const stageDirectoryIdentityHash =
    stage.status === "absent" || stage.status === "invalid"
      ? null
      : stage.stagingDirectoryIdentityHash;
  const stageDirectoryCapture =
    stageDirectoryIdentityHash === null
      ? null
      : exactNamespacePhysicalCaptureV2(
          observation,
          "registry",
          "transaction_staging",
          REGISTRY_REF_V2,
        );
  const stageDirectoryFingerprint =
    stage.status === "absent" || stage.status === "invalid"
      ? null
      : stage.stagingDirectoryFingerprint;
  const observedStageMembership =
    stage.status === "absent" || stage.status === "invalid"
      ? null
      : stage.stagingDirectoryMembership;
  const expectedStageMembership = currentLiveStageMembersV2(observation)
    .map((member) => ({
      basename: member.classification.basename,
      objectKind: member.classification.objectKind,
    }))
    .sort((left, right) => compareUtf16V2(left.basename, right.basename));
  const stageMembershipMatches =
    stageDirectoryIdentityHash === null
      ? stageDirectoryCapture === null
      : stageDirectoryCapture !== null &&
        stageDirectoryFingerprint !== null &&
        observedStageMembership !== null &&
        canonicalJsonStringify(stageDirectoryCapture.fingerprint) ===
          canonicalJsonStringify(stageDirectoryFingerprint) &&
        stageDirectoryCapture.contentEvidence.kind === "directory_membership" &&
        canonicalJsonStringify(
          stageDirectoryCapture.contentEvidence.membership,
        ) === canonicalJsonStringify(observedStageMembership) &&
        canonicalJsonStringify(observedStageMembership.orderedEntries) ===
          canonicalJsonStringify(expectedStageMembership);
  const packageLocksMatchFixedContent =
    observation.namespace.physicalCensus.orderedEntryCaptures
      .filter(
        (entry) =>
          entry.classification.ownerKind === "package" &&
          entry.classification.category === "package_lock",
      )
      .every(
        (entry) =>
          rawContentHashFromGlobalCaptureV2(entry) ===
          expectedPlatformReleaseBootstrapPackageLockRawContentHashV2(
            PlatformReleaseBootstrapPackageRefV2Schema.parse(
              entry.classification.ownerRef,
            ),
          ),
      );
  const codeOwnedMetadataMatches =
    observation.namespace.physicalCensus.orderedEntryCaptures.every((entry) => {
      const fingerprint = entry.fingerprint;
      if (fingerprint.ownerUid !== 0 || fingerprint.ownerGid !== 0) {
        return false;
      }
      if (entry.classification.ownerKind === "registry") {
        return (
          fingerprint.mode ===
          (entry.classification.category === "transaction_staging"
            ? "0700"
            : "0600")
        );
      }
      if (entry.classification.category === "package_lock") {
        return fingerprint.mode === "0600";
      }
      if (entry.classification.category === "package_root") {
        const packageContract =
          PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.packages.find(
            (candidate) =>
              candidate.packageRef === entry.classification.ownerRef,
          );
        return fingerprint.mode === packageContract?.rootMode;
      }
      if (entry.classification.category === "generation_staging") {
        return fingerprint.mode === "0700";
      }
      return true;
    });
  const filesystemScopeCapture = capture(
    "registry",
    "filesystem_scope",
    REGISTRY_REF_V2,
  );
  const filesystemScopeJoins =
    filesystemScopeCapture !== null &&
    filesystemScopeCapture.objectIdentity.objectKind === "ordinary_file" &&
    rawContentHashFromGlobalCaptureV2(filesystemScopeCapture) ===
      hashPlatformReleaseBootstrapRegistryPublishedCanonicalJsonBytesV2(
        observation.filesystemScope,
      );
  const parentMetadataMatches =
    observation.namespace.physicalCensus.parentFingerprint.ownerUid === 0 &&
    observation.namespace.physicalCensus.parentFingerprint.ownerGid === 0 &&
    observation.namespace.physicalCensus.parentFingerprint.mode === "0755";
  const stagingMetadataMatches =
    (stage.status === "absent" ||
      stage.status === "invalid" ||
      (stage.stagingDirectoryFingerprint.ownerUid === 0 &&
        stage.stagingDirectoryFingerprint.ownerGid === 0 &&
        stage.stagingDirectoryFingerprint.mode === "0700")) &&
    stagePhysicalMembersV2(observation).every(
      (member) =>
        member.fingerprint.ownerUid === 0 &&
        member.fingerprint.ownerGid === 0 &&
        member.fingerprint.mode === "0600",
    );
  return (
    filesystemScopeJoins &&
    parentMetadataMatches &&
    codeOwnedMetadataMatches &&
    stagingMetadataMatches &&
    (observation.parentBoundary.status !== "exact" ||
      (observation.parentBoundary.parentIdentityHash ===
        observation.namespace.physicalCensus.parentObjectIdentity
          .objectIdentityHash &&
        canonicalJsonStringify(observation.parentBoundary.parentFingerprint) ===
          canonicalJsonStringify(
            observation.namespace.physicalCensus.parentFingerprint,
          ))) &&
    (observation.legacyLock.status !== "exact" ||
      regularFileEvidenceJoins(
        capture("package", "package_lock", NODE_PACKAGE_REF_V2),
        observation.legacyLock.legacyNodeLockIdentityHash,
        observation.legacyLock.physicalFingerprint,
        observation.legacyLock.rawContentHash,
        expectedPlatformReleaseBootstrapPackageLockRawContentHashV2(
          NODE_PACKAGE_REF_V2,
        ),
      )) &&
    (observation.sharedLock.status !== "exact" ||
      regularFileEvidenceJoins(
        capture("registry", "shared_parent_lock", REGISTRY_REF_V2),
        observation.sharedLock.sharedLockIdentityHash,
        observation.sharedLock.physicalFingerprint,
        observation.sharedLock.rawContentHash,
        PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.registry.sharedLockContentHash,
      )) &&
    (observation.epochFloor.status !== "exact" ||
      regularFileEvidenceJoins(
        capture("registry", "epoch_floor_state", REGISTRY_REF_V2),
        observation.epochFloor.physicalIdentityHash,
        observation.epochFloor.physicalFingerprint,
        observation.epochFloor.rawContentHash,
        hashPlatformReleaseBootstrapRegistryPublishedCanonicalJsonBytesV2(
          observation.epochFloor.state,
        ),
      )) &&
    (observation.activationReceipt.status !== "exact" ||
      regularFileEvidenceJoins(
        capture("registry", "activation_receipt", REGISTRY_REF_V2),
        observation.activationReceipt.physicalIdentityHash,
        observation.activationReceipt.physicalFingerprint,
        observation.activationReceipt.rawContentHash,
        hashPlatformReleaseBootstrapRegistryPublishedCanonicalJsonBytesV2(
          observation.activationReceipt.receipt,
        ),
      )) &&
    (observation.activationClaim.status !== "exact" ||
      regularFileEvidenceJoins(
        capture("registry", "activation_claim", REGISTRY_REF_V2),
        observation.activationClaim.physicalIdentityHash,
        observation.activationClaim.physicalFingerprint,
        observation.activationClaim.rawContentHash,
        hashPlatformReleaseBootstrapRegistryPublishedCanonicalJsonBytesV2(
          observation.activationClaim.claim,
        ),
      )) &&
    (observation.epochClaim.status !== "exact" ||
      regularFileEvidenceJoins(
        capture("registry", "epoch_claim", REGISTRY_REF_V2),
        observation.epochClaim.physicalIdentityHash,
        observation.epochClaim.physicalFingerprint,
        observation.epochClaim.rawContentHash,
        hashPlatformReleaseBootstrapRegistryPublishedCanonicalJsonBytesV2(
          observation.epochClaim.claim,
        ),
      )) &&
    (stageDirectoryIdentityHash === null ||
      stageDirectoryIdentityHash ===
        stageDirectoryCapture?.objectIdentity.objectIdentityHash) &&
    stageMembershipMatches &&
    packageLocksMatchFixedContent &&
    stagePhysicalMembersV2(observation).every(
      (member) =>
        member.objectIdentity.filesystemScopeIdentityHash ===
          observation.filesystemScope.scopeIdentityHash &&
        member.parentObjectIdentity.filesystemScopeIdentityHash ===
          observation.filesystemScope.scopeIdentityHash &&
        member.parentObjectIdentityHash === stageDirectoryIdentityHash,
    )
  );
}

function physicalObjectLocatorAliasesAreAllowedV2(
  observation: PlatformReleaseBootstrapRegistryActivationObservationV2,
  epochFloorDisposition: "prior" | "target" | null,
): boolean {
  if (observation.namespace.status !== "exact") return false;
  const globalCaptures =
    observation.namespace.physicalCensus.orderedEntryCaptures;
  const parentLocator = filesystemObjectLocatorKeyV2(
    observation.namespace.physicalCensus.parentObjectIdentity,
  );
  const stageMembers = stagePhysicalMembersV2(observation);
  const liveStageMembers = currentLiveStageMembersV2(observation);
  const liveKinds = new Set(
    liveStageMembers.map((member) => member.memberKind),
  );
  const stageMemberLocators = new Set<string>();
  const allowedActivationCategory = new Map([
    ["staged_activation_receipt", "activation_receipt"],
    ["staged_genesis_epoch_state", "epoch_floor_state"],
    ["staged_shared_lock", "shared_parent_lock"],
  ] as const);
  for (const capture of globalCaptures) {
    if (capture.objectIdentity.objectKind !== "ordinary_file") {
      continue;
    }
    const captureLocator = filesystemObjectLocatorKeyV2(capture.objectIdentity);
    const liveActivationAliases = liveStageMembers.filter((member) => {
      const expectedCategory = allowedActivationCategory.get(
        member.memberKind as
          | "staged_activation_receipt"
          | "staged_genesis_epoch_state"
          | "staged_shared_lock",
      );
      return (
        expectedCategory !== undefined &&
        capture.classification.ownerKind === "registry" &&
        capture.classification.ownerRef === REGISTRY_REF_V2 &&
        capture.classification.category === expectedCategory &&
        filesystemObjectLocatorKeyV2(member.objectIdentity) === captureLocator
      );
    });
    const expectedLinkCount = liveActivationAliases.length === 1 ? 2 : 1;
    if (capture.fingerprint.linkCount !== expectedLinkCount) {
      return false;
    }
  }
  for (const member of stageMembers) {
    const locator = filesystemObjectLocatorKeyV2(member.objectIdentity);
    if (locator === parentLocator || stageMemberLocators.has(locator))
      return false;
    stageMemberLocators.add(locator);
    const aliases = globalCaptures.filter(
      (capture) =>
        filesystemObjectLocatorKeyV2(capture.objectIdentity) === locator,
    );
    for (const alias of aliases) {
      const activationCategory = allowedActivationCategory.get(
        member.memberKind as
          | "staged_activation_receipt"
          | "staged_genesis_epoch_state"
          | "staged_shared_lock",
      );
      const activationAliasAllowed =
        activationCategory !== undefined &&
        alias.classification.ownerKind === "registry" &&
        alias.classification.ownerRef === REGISTRY_REF_V2 &&
        alias.classification.category === activationCategory;
      const consumedEpochRenameAllowed =
        member.memberKind === "staged_target_epoch_state" &&
        observation.transactionStaging.status === "epoch_target_consumed" &&
        epochFloorDisposition === "target" &&
        alias.classification.ownerKind === "registry" &&
        alias.classification.ownerRef === REGISTRY_REF_V2 &&
        alias.classification.category === "epoch_floor_state";
      if (!activationAliasAllowed && !consumedEpochRenameAllowed) {
        return false;
      }
      if (activationAliasAllowed) {
        const isLive = liveKinds.has(member.memberKind);
        const rawContentHash = rawContentHashFromGlobalCaptureV2(alias);
        if (
          rawContentHash !== member.rawContentHash ||
          (isLive
            ? member.fingerprint.linkCount !== 2 ||
              alias.fingerprint.linkCount !== 2 ||
              canonicalJsonStringify(member.fingerprint) !==
                canonicalJsonStringify(alias.fingerprint)
            : alias.fingerprint.linkCount !== 1)
        )
          return false;
      }
      if (
        consumedEpochRenameAllowed &&
        (alias.fingerprint.linkCount !== 1 ||
          member.fingerprint.linkCount !== 1 ||
          rawContentHashFromGlobalCaptureV2(alias) !== member.rawContentHash)
      )
        return false;
    }
    if (
      aliases.length === 0 &&
      liveKinds.has(member.memberKind) &&
      member.fingerprint.linkCount !== 1
    )
      return false;
  }
  return true;
}

function nodeLifecycleLogicalNamespaceProjectionMatchesV2(
  observation: PlatformReleaseBootstrapRegistryActivationObservationV2,
): boolean {
  if (
    observation.namespace.status !== "exact" ||
    (observation.nodeLifecycle.status !== "ready" &&
      observation.nodeLifecycle.status !== "empty_or_rolled_back")
  ) {
    return false;
  }
  const census = observation.namespace.census;
  const hasNodeCategory = (category: string): boolean =>
    namespaceHasEntryV2(census, "package", category, NODE_PACKAGE_REF_V2);
  const hasLock = hasNodeCategory("package_lock");
  const hasRoot = hasNodeCategory("package_root");
  const hasActiveClaim = hasNodeCategory("active_claim");
  const hasActiveReceipt = hasNodeCategory("active_receipt");
  const hasStaging = hasNodeCategory("generation_staging");
  const hasRollbackClaim = hasNodeCategory("rollback_claim");
  if (observation.nodeLifecycle.status === "ready") {
    return (
      hasLock &&
      hasRoot &&
      hasActiveClaim &&
      hasActiveReceipt &&
      !hasStaging &&
      !hasRollbackClaim
    );
  }
  return (
    hasLock &&
    !hasRoot &&
    !hasActiveClaim &&
    !hasActiveReceipt &&
    !hasStaging &&
    !hasRollbackClaim
  );
}

function epochClaimPackageLifecycleMatchesNamespaceV2(
  observation: PlatformReleaseBootstrapRegistryActivationObservationV2,
): boolean {
  if (
    observation.epochClaim.status !== "exact" ||
    observation.namespace.status !== "exact"
  ) {
    return false;
  }
  const claimedPackageRef = observation.epochClaim.claim.packageRef;
  let parsedPhysicalProjection: PackageLifecyclePhysicalProjectionV2;
  try {
    parsedPhysicalProjection =
      parsePackageLifecyclePhysicalProjectionCandidateV2(
        observation.epochClaim.packageLifecycleProjection,
        observation.namespace.physicalCensus,
      );
  } catch {
    return false;
  }
  if (
    parsedPhysicalProjection.packageRef !== claimedPackageRef ||
    canonicalJsonStringify(parsedPhysicalProjection) !==
      canonicalJsonStringify(observation.epochClaim.packageLifecycleProjection)
  ) {
    return false;
  }
  if (claimedPackageRef !== NODE_PACKAGE_REF_V2) return true;
  let expectedLogicalNamespaceProjection: PlatformReleaseBootstrapRegistryClaimedPackageLifecycleProjectionV2;
  try {
    expectedLogicalNamespaceProjection =
      projectPlatformReleaseBootstrapRegistryClaimedPackageLifecycleV2(
        observation.namespace.census,
        claimedPackageRef,
      );
  } catch {
    return false;
  }
  return (
    (observation.nodeLifecycle.status === "ready" ||
      observation.nodeLifecycle.status === "empty_or_rolled_back") &&
    observation.legacyLock.status === "exact" &&
    expectedLogicalNamespaceProjection.censusHash ===
      observation.nodeLifecycle.nodeLifecycleSnapshotHash &&
    parsedPhysicalProjection.packageLockObjectIdentityHash ===
      observation.legacyLock.legacyNodeLockIdentityHash
  );
}

function epochClaimCurrentFloorDispositionV2(
  claim: PlatformReleaseBootstrapRegistryEpochClaimV2,
  floor: PlatformReleaseBootstrapRegistryEpochFloorStateV2,
): "prior" | "target" | null {
  const floorCanonical = canonicalJsonStringify(floor);
  if (floorCanonical === canonicalJsonStringify(claim.priorEpochState)) {
    return "prior";
  }
  if (floorCanonical === canonicalJsonStringify(claim.targetEpochState)) {
    return "target";
  }
  return null;
}

function isExactGenesisEpochFloorV2(
  floor: PlatformReleaseBootstrapRegistryEpochFloorStateV2,
): boolean {
  return (
    floor.epochStateHash ===
      PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_GENESIS_EPOCH_FLOOR_STATE_V2.epochStateHash &&
    canonicalJsonStringify(floor) ===
      canonicalJsonStringify(
        PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_GENESIS_EPOCH_FLOOR_STATE_V2,
      )
  );
}

function expectedActivationReceiptV2(
  observation: PlatformReleaseBootstrapRegistryActivationObservationV2,
): PlatformReleaseBootstrapRegistryActivationReceiptV2 | null {
  const orphanStagedSharedLock =
    observation.transactionStaging.status === "orphan" &&
    observation.transactionStaging.transactionKind === "activation"
      ? observation.transactionStaging.orderedMembers.find(
          (member) => member.memberKind === "staged_shared_lock",
        )
      : undefined;
  const sharedLockIdentityHash =
    (observation.transactionStaging.status === "exact" ||
      observation.transactionStaging.status === "cleanup_partial") &&
    observation.transactionStaging.transactionKind === "activation"
      ? observation.transactionStaging.stagedSharedLock.physicalIdentityHash
      : orphanStagedSharedLock !== undefined
        ? orphanStagedSharedLock.physicalIdentityHash
        : observation.sharedLock.status === "exact"
          ? observation.sharedLock.sharedLockIdentityHash
          : null;
  if (
    observation.legacyLock.status !== "exact" ||
    sharedLockIdentityHash === null ||
    observation.parentBoundary.status !== "exact" ||
    (observation.nodeLifecycle.status !== "ready" &&
      observation.nodeLifecycle.status !== "empty_or_rolled_back")
  ) {
    return null;
  }
  try {
    return buildPlatformReleaseBootstrapRegistryActivationReceiptV2({
      sharedLockIdentityHash,
      legacyNodeLockIdentityHash:
        observation.legacyLock.legacyNodeLockIdentityHash,
      nodeLifecycleIdentityHash:
        observation.nodeLifecycle.nodeLifecycleIdentityHash,
      parentIdentityHash: observation.parentBoundary.parentIdentityHash,
    });
  } catch {
    return null;
  }
}

function orphanStagingPayloadIsExactlyKnownV2(
  observation: PlatformReleaseBootstrapRegistryActivationObservationV2,
  expectedActivationReceipt: PlatformReleaseBootstrapRegistryActivationReceiptV2 | null,
): boolean {
  const stage = observation.transactionStaging;
  if (stage.status !== "orphan") return true;
  if (stage.transactionKind === "epoch_floor") {
    // With no epoch claim there is no authority for an arbitrary target
    // document. Only an exact empty orphan directory is cleanable.
    return stage.orderedMembers.length === 0;
  }
  if (stage.orderedMembers.length === 0) return true;
  if (
    expectedActivationReceipt === null ||
    stage.orderedMembers.length !==
      ACTIVATION_STAGING_PAYLOAD_MEMBER_ORDER_V2.length
  ) {
    return false;
  }
  return stage.orderedMembers.every((member) => {
    switch (member.memberKind) {
      case "staged_activation_receipt":
        return (
          member.logicalIdentityHash ===
            expectedActivationReceipt.activationReceiptHash &&
          member.rawContentHash ===
            hashPlatformReleaseBootstrapRegistryPublishedCanonicalJsonBytesV2(
              expectedActivationReceipt,
            )
        );
      case "staged_genesis_epoch_state":
        return (
          member.logicalIdentityHash ===
            PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_GENESIS_EPOCH_FLOOR_STATE_V2.epochStateHash &&
          member.rawContentHash ===
            hashPlatformReleaseBootstrapRegistryPublishedCanonicalJsonBytesV2(
              PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_GENESIS_EPOCH_FLOOR_STATE_V2,
            )
        );
      case "staged_shared_lock":
        return (
          member.logicalIdentityHash ===
            PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.registry
              .sharedLockContentHash &&
          member.rawContentHash ===
            PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.registry
              .sharedLockContentHash
        );
      default:
        return false;
    }
  });
}

function activationStagingInitialCensusHashV2(
  observation: PlatformReleaseBootstrapRegistryActivationObservationV2,
): string | null {
  const stage = observation.transactionStaging;
  if (
    (stage.status === "exact" || stage.status === "cleanup_partial") &&
    stage.transactionKind === "activation"
  ) {
    return stage.status === "exact"
      ? stage.stagingCensusHash
      : stage.initialStagingCensusHash;
  }
  if (
    stage.status === "absent" &&
    observation.activationReceipt.status === "exact" &&
    observation.epochFloor.status === "exact" &&
    observation.sharedLock.status === "exact"
  ) {
    const stagedActivationReceipt = stagingHashMemberFromGlobalCaptureV2(
      "staged_activation_receipt",
      observation.activationReceipt.receipt.activationReceiptHash,
      exactNamespacePhysicalCaptureV2(
        observation,
        "registry",
        "activation_receipt",
        REGISTRY_REF_V2,
      ),
    );
    const stagedGenesisEpochState = stagingHashMemberFromGlobalCaptureV2(
      "staged_genesis_epoch_state",
      observation.epochFloor.state.epochStateHash,
      exactNamespacePhysicalCaptureV2(
        observation,
        "registry",
        "epoch_floor_state",
        REGISTRY_REF_V2,
      ),
    );
    const stagedSharedLock = stagingHashMemberFromGlobalCaptureV2(
      "staged_shared_lock",
      PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.registry.sharedLockContentHash,
      exactNamespacePhysicalCaptureV2(
        observation,
        "registry",
        "shared_parent_lock",
        REGISTRY_REF_V2,
      ),
    );
    if (
      stagedActivationReceipt === null ||
      stagedGenesisEpochState === null ||
      stagedSharedLock === null
    )
      return null;
    return hashPlatformReleaseBootstrapRegistryActivationStagingInitialCensusV2(
      [stagedActivationReceipt, stagedGenesisEpochState, stagedSharedLock],
    );
  }
  return null;
}

function expectedActivationClaimV2(
  observation: PlatformReleaseBootstrapRegistryActivationObservationV2,
): PlatformReleaseBootstrapRegistryActivationClaimV2 | null {
  if (
    observation.activationClaim.status !== "exact" ||
    observation.legacyLock.status !== "exact" ||
    observation.parentBoundary.status !== "exact" ||
    (observation.nodeLifecycle.status !== "ready" &&
      observation.nodeLifecycle.status !== "empty_or_rolled_back")
  ) {
    return null;
  }
  const stage = observation.transactionStaging;
  const activationStageEvidence =
    (stage.status === "exact" || stage.status === "cleanup_partial") &&
    stage.transactionKind === "activation"
      ? stage
      : null;
  const transactionIdentityHash =
    activationStageEvidence !== null
      ? activationStageEvidence.transactionIdentityHash
      : observation.activationClaim.claim.transactionIdentityHash;
  const preActivationNamespaceCaptureHash =
    activationStageEvidence !== null
      ? activationStageEvidence.preActivationNamespaceCaptureHash
      : observation.activationClaim.claim.preActivationNamespaceCaptureHash;
  const transactionStagingIdentityHash =
    activationStageEvidence !== null
      ? activationStageEvidence.stagingDirectoryIdentityHash
      : observation.activationClaim.claim.transactionStagingIdentityHash;
  const transactionStagingCensusHash =
    activationStagingInitialCensusHashV2(observation);
  const sharedLockIdentityHash =
    activationStageEvidence !== null
      ? activationStageEvidence.stagedSharedLock.physicalIdentityHash
      : observation.sharedLock.status === "exact"
        ? observation.sharedLock.sharedLockIdentityHash
        : null;
  if (sharedLockIdentityHash === null || transactionStagingCensusHash === null)
    return null;
  try {
    return buildPlatformReleaseBootstrapRegistryActivationClaimV2({
      transactionIdentityHash,
      sharedLockIdentityHash,
      legacyNodeLockIdentityHash:
        observation.legacyLock.legacyNodeLockIdentityHash,
      nodeLifecycleIdentityHash:
        observation.nodeLifecycle.nodeLifecycleIdentityHash,
      nodeLifecycleSnapshotHash:
        observation.nodeLifecycle.nodeLifecycleSnapshotHash,
      parentIdentityHash: observation.parentBoundary.parentIdentityHash,
      preActivationNamespaceCaptureHash,
      transactionStagingIdentityHash,
      transactionStagingCensusHash,
    });
  } catch {
    return null;
  }
}

function sortedUniqueCorruptionReasonsV2(
  reasons: readonly PlatformReleaseBootstrapRegistryActivationCorruptionReasonV2[],
): readonly PlatformReleaseBootstrapRegistryActivationCorruptionReasonV2[] {
  return [...new Set(reasons)].sort(compareUtf16V2);
}

export function derivePlatformReleaseBootstrapRegistryActivationDecisionV2(
  observation: PlatformReleaseBootstrapRegistryActivationObservationV2,
): PlatformReleaseBootstrapRegistryActivationDecisionV2 {
  const parsed =
    parsePlatformReleaseBootstrapRegistryActivationObservationCandidateV2(
      observation,
    );
  const reasons: PlatformReleaseBootstrapRegistryActivationCorruptionReasonV2[] =
    [];
  const expectedReceiptCandidate = expectedActivationReceiptV2(parsed);
  const expectedClaimCandidate = expectedActivationClaimV2(parsed);
  const activationStageEvidence =
    (parsed.transactionStaging.status === "exact" ||
      parsed.transactionStaging.status === "cleanup_partial") &&
    parsed.transactionStaging.transactionKind === "activation"
      ? parsed.transactionStaging
      : null;
  const hasActivationStageEvidence = activationStageEvidence !== null;
  const epochStageEvidence =
    (parsed.transactionStaging.status === "exact" &&
      parsed.transactionStaging.transactionKind === "epoch_floor") ||
    parsed.transactionStaging.status === "epoch_target_consumed"
      ? parsed.transactionStaging
      : null;

  if (parsed.legacyLock.status !== "exact") {
    reasons.push("legacy_lock_not_exact");
  }
  if (parsed.sharedLock.status === "invalid") {
    reasons.push("shared_lock_invalid");
  }
  if (parsed.parentBoundary.status !== "exact") {
    reasons.push("parent_boundary_not_exact");
  }
  if (
    parsed.nodeLifecycle.status !== "ready" &&
    parsed.nodeLifecycle.status !== "empty_or_rolled_back"
  ) {
    reasons.push("node_lifecycle_not_stable");
  } else if (
    parsed.namespace.status === "exact" &&
    !nodeLifecycleLogicalNamespaceProjectionMatchesV2(parsed)
  ) {
    reasons.push("node_lifecycle_census_mismatch");
  }
  if (parsed.namespace.status !== "exact") {
    reasons.push("namespace_not_exact");
  } else if (!observationPresenceMatchesNamespaceV2(parsed)) {
    reasons.push("namespace_observation_mismatch");
  } else if (!globalPhysicalObservationJoinsNamespaceV2(parsed)) {
    reasons.push("physical_namespace_relation_mismatch");
  }
  if (parsed.epochFloor.status === "invalid") {
    reasons.push("epoch_floor_invalid");
  }
  if (parsed.activationReceipt.status === "invalid") {
    reasons.push("activation_receipt_invalid");
  }
  if (parsed.activationClaim.status === "invalid") {
    reasons.push("activation_claim_invalid");
  }
  if (parsed.epochClaim.status === "invalid") {
    reasons.push("epoch_claim_invalid");
  }
  if (parsed.transactionStaging.status === "invalid") {
    reasons.push("transaction_staging_invalid");
  }
  if (
    parsed.activationClaim.status !== "absent" &&
    parsed.epochClaim.status !== "absent"
  ) {
    reasons.push("registry_claims_not_mutually_exclusive");
  }
  if (
    activationStageEvidence !== null &&
    parsed.sharedLock.status === "exact" &&
    activationStageEvidence.stagedSharedLock.physicalIdentityHash !==
      parsed.sharedLock.sharedLockIdentityHash
  ) {
    reasons.push("activation_staging_relation_mismatch");
  }
  if (
    activationStageEvidence !== null &&
    (expectedReceiptCandidate === null ||
      activationStageEvidence.stagedGenesisEpochStateHash !==
        PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_GENESIS_EPOCH_FLOOR_STATE_V2.epochStateHash ||
      activationStageEvidence.stagedActivationReceiptHash !==
        expectedReceiptCandidate.activationReceiptHash ||
      activationStageEvidence.stagedSharedLock.rawContentHash !==
        PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.registry.sharedLockContentHash ||
      activationStageEvidence.stagedGenesisEpochState.rawContentHash !==
        hashPlatformReleaseBootstrapRegistryPublishedCanonicalJsonBytesV2(
          PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_GENESIS_EPOCH_FLOOR_STATE_V2,
        ) ||
      activationStageEvidence.stagedActivationReceipt.rawContentHash !==
        hashPlatformReleaseBootstrapRegistryPublishedCanonicalJsonBytesV2(
          expectedReceiptCandidate,
        ))
  ) {
    reasons.push("activation_staged_payload_mismatch");
  }
  if (
    activationStageEvidence !== null &&
    ((parsed.activationReceipt.status === "exact" &&
      activationStageEvidence.stagedActivationReceipt.physicalIdentityHash !==
        parsed.activationReceipt.physicalIdentityHash) ||
      (parsed.epochFloor.status === "exact" &&
        activationStageEvidence.stagedGenesisEpochState.physicalIdentityHash !==
          parsed.epochFloor.physicalIdentityHash))
  ) {
    reasons.push("activation_staged_physical_identity_mismatch");
  }
  if (parsed.activationClaim.status === "exact") {
    if (
      expectedClaimCandidate === null ||
      canonicalJsonStringify(expectedClaimCandidate) !==
        canonicalJsonStringify(parsed.activationClaim.claim)
    ) {
      reasons.push("activation_claim_identity_mismatch");
    }
    if (
      (parsed.transactionStaging.status === "exact" ||
        parsed.transactionStaging.status === "cleanup_partial") &&
      parsed.transactionStaging.transactionKind !== "activation"
    ) {
      reasons.push("activation_staging_relation_mismatch");
    }
    if (
      parsed.activationReceipt.status !== "exact" &&
      !hasActivationStageEvidence
    ) {
      reasons.push("activation_claim_missing_staging");
    }
    if (
      parsed.activationReceipt.status !== "exact" &&
      parsed.transactionStaging.status === "cleanup_partial"
    ) {
      reasons.push("activation_cleanup_partial_before_receipt");
    }
  } else if (hasActivationStageEvidence) {
    reasons.push("activation_staging_missing_claim");
  }
  if (
    epochStageEvidence !== null &&
    (parsed.epochClaim.status !== "exact" ||
      epochStageEvidence.transactionIdentityHash !==
        parsed.epochClaim.claim.transactionIdentityHash ||
      epochStageEvidence.stagingDirectoryIdentityHash !==
        parsed.epochClaim.claim.transactionStagingIdentityHash ||
      (epochStageEvidence.status === "exact"
        ? epochStageEvidence.stagingCensusHash
        : epochStageEvidence.initialStagingCensusHash) !==
        parsed.epochClaim.claim.transactionStagingCensusHash)
  ) {
    reasons.push("epoch_staging_relation_mismatch");
  }
  if (
    parsed.epochClaim.status === "exact" &&
    parsed.epochClaim.observedInstallationGeneration !==
      parsed.epochClaim.claim.packageInstallationGeneration
  ) {
    reasons.push("epoch_claim_installation_generation_mismatch");
  }
  if (
    epochStageEvidence !== null &&
    parsed.epochClaim.status === "exact" &&
    canonicalJsonStringify(epochStageEvidence.stagedTargetEpochState) !==
      canonicalJsonStringify(parsed.epochClaim.claim.targetEpochState)
  ) {
    reasons.push("epoch_staged_target_mismatch");
  }
  if (
    epochStageEvidence !== null &&
    epochStageEvidence.stagedTargetEpochMember.rawContentHash !==
      hashPlatformReleaseBootstrapRegistryPublishedCanonicalJsonBytesV2(
        epochStageEvidence.stagedTargetEpochState,
      )
  ) {
    reasons.push("epoch_staged_target_mismatch");
  }
  if (
    parsed.epochClaim.status === "exact" &&
    !epochClaimPackageLifecycleMatchesNamespaceV2(parsed)
  ) {
    reasons.push("epoch_claim_package_lifecycle_mismatch");
  }
  const epochFloorDisposition =
    parsed.epochClaim.status === "exact" && parsed.epochFloor.status === "exact"
      ? epochClaimCurrentFloorDispositionV2(
          parsed.epochClaim.claim,
          parsed.epochFloor.state,
        )
      : null;
  if (
    parsed.namespace.status === "exact" &&
    !physicalObjectLocatorAliasesAreAllowedV2(parsed, epochFloorDisposition)
  ) {
    reasons.push("physical_object_locator_alias");
  }
  if (
    epochStageEvidence !== null &&
    parsed.epochClaim.status === "exact" &&
    epochStageEvidence.stagedTargetEpochMember.physicalIdentityHash !==
      parsed.epochClaim.claim.stagedTargetEpochStatePhysicalIdentityHash
  ) {
    reasons.push("epoch_staged_physical_identity_mismatch");
  }
  if (
    parsed.epochClaim.status === "exact" &&
    epochFloorDisposition === "target" &&
    parsed.epochFloor.status === "exact" &&
    parsed.epochFloor.physicalIdentityHash !==
      parsed.epochClaim.claim.stagedTargetEpochStatePhysicalIdentityHash
  ) {
    reasons.push("epoch_staged_physical_identity_mismatch");
  }
  if (
    parsed.transactionStaging.status === "epoch_target_consumed" &&
    (parsed.epochClaim.status !== "exact" ||
      epochFloorDisposition !== "target" ||
      parsed.epochFloor.status !== "exact" ||
      parsed.epochFloor.physicalIdentityHash !==
        parsed.transactionStaging.stagedTargetEpochMember.physicalIdentityHash)
  ) {
    reasons.push("epoch_target_consumed_state_mismatch");
  }
  if (
    parsed.epochClaim.status === "exact" &&
    epochFloorDisposition === "target" &&
    parsed.transactionStaging.status === "exact" &&
    parsed.transactionStaging.transactionKind === "epoch_floor"
  ) {
    reasons.push("epoch_target_exact_state_mismatch");
  }
  if (
    parsed.epochClaim.status === "exact" &&
    parsed.parentBoundary.status === "exact" &&
    parsed.sharedLock.status === "exact"
  ) {
    const epochEvidenceHashes = [
      parsed.epochClaim.claim.transactionIdentityHash,
      parsed.epochClaim.claim.priorEpochStateHash,
      parsed.epochClaim.claim.targetEpochStateHash,
      parsed.epochClaim.claim.epochClaimHash,
      parsed.epochClaim.claim.transactionStagingIdentityHash,
      parsed.epochClaim.claim.transactionStagingCensusHash,
      parsed.epochClaim.claim.stagedTargetEpochStatePhysicalIdentityHash,
      parsed.epochClaim.packageLifecycleProjection.projectionHash,
      parsed.epochClaim.packageLifecycleProjection
        .packageLockObjectIdentityHash,
      parsed.parentBoundary.parentIdentityHash,
      parsed.sharedLock.sharedLockIdentityHash,
      ...(parsed.activationReceipt.status === "exact"
        ? [parsed.activationReceipt.physicalIdentityHash]
        : []),
      ...(parsed.epochFloor.status === "exact" &&
      epochFloorDisposition !== "target"
        ? [parsed.epochFloor.physicalIdentityHash]
        : []),
      ...(epochStageEvidence !== null
        ? [
            ...(epochStageEvidence.status === "epoch_target_consumed"
              ? [epochStageEvidence.currentRemainingCensusHash]
              : []),
          ]
        : []),
    ];
    if (new Set(epochEvidenceHashes).size !== epochEvidenceHashes.length) {
      reasons.push("epoch_evidence_identity_alias");
    }
  }
  if (
    (parsed.sharedLock.status === "exact" || hasActivationStageEvidence) &&
    parsed.legacyLock.status === "exact" &&
    parsed.parentBoundary.status === "exact" &&
    (parsed.nodeLifecycle.status === "ready" ||
      parsed.nodeLifecycle.status === "empty_or_rolled_back") &&
    expectedReceiptCandidate === null
  ) {
    reasons.push("activation_receipt_cutover_identity_mismatch");
  }

  const receiptIsExact = parsed.activationReceipt.status === "exact";
  if (parsed.activationReceipt.status !== "exact") {
    if (
      parsed.namespace.status === "exact" &&
      parsed.namespace.nonNodeSiblingPackageRefs.length !== 0
    ) {
      reasons.push("namespace_non_node_siblings_before_activation");
    }
    if (parsed.epochClaim.status !== "absent") {
      reasons.push("epoch_claim_present_before_activation");
    }
    if (
      parsed.activationClaim.status === "absent" &&
      (parsed.sharedLock.status === "exact" ||
        parsed.epochFloor.status === "exact")
    ) {
      reasons.push("activation_claim_required_for_resume");
    }
    if (
      parsed.sharedLock.status === "absent" &&
      parsed.epochFloor.status === "exact"
    ) {
      reasons.push("shared_lock_missing_for_epoch_floor");
    }
    if (
      parsed.epochFloor.status === "exact" &&
      !isExactGenesisEpochFloorV2(parsed.epochFloor.state)
    ) {
      reasons.push("non_genesis_floor_before_activation");
    }
  } else {
    if (parsed.sharedLock.status !== "exact") {
      reasons.push("activation_receipt_missing_shared_lock");
    }
    if (parsed.epochFloor.status !== "exact") {
      reasons.push("activation_receipt_missing_epoch_floor");
    }
    const expectedReceipt = expectedReceiptCandidate;
    if (
      expectedReceipt === null ||
      expectedReceipt.activationReceiptHash !==
        parsed.activationReceipt.receipt.activationReceiptHash ||
      canonicalJsonStringify(expectedReceipt) !==
        canonicalJsonStringify(parsed.activationReceipt.receipt)
    ) {
      reasons.push("activation_receipt_cutover_identity_mismatch");
    }
    if (
      parsed.epochClaim.status === "exact" &&
      (parsed.epochFloor.status !== "exact" ||
        epochClaimCurrentFloorDispositionV2(
          parsed.epochClaim.claim,
          parsed.epochFloor.state,
        ) === null)
    ) {
      reasons.push("epoch_claim_state_mismatch");
    }
    if (
      parsed.epochClaim.status === "exact" &&
      parsed.epochFloor.status === "exact" &&
      epochClaimCurrentFloorDispositionV2(
        parsed.epochClaim.claim,
        parsed.epochFloor.state,
      ) === "prior" &&
      !(
        parsed.transactionStaging.status === "exact" &&
        parsed.transactionStaging.transactionKind === "epoch_floor"
      )
    ) {
      reasons.push("epoch_stage_evidence_missing");
    }
    if (
      parsed.activationClaim.status === "absent" &&
      ((parsed.transactionStaging.status === "exact" &&
        parsed.transactionStaging.transactionKind === "activation") ||
        parsed.transactionStaging.status === "cleanup_partial" ||
        (parsed.transactionStaging.status === "orphan" &&
          parsed.transactionStaging.transactionKind === "activation"))
    ) {
      reasons.push("activation_staging_missing_claim");
    }
    if (
      parsed.activationClaim.status === "exact" &&
      parsed.epochFloor.status === "exact" &&
      !isExactGenesisEpochFloorV2(parsed.epochFloor.state)
    ) {
      reasons.push("activation_cleanup_floor_not_genesis");
    }
    if (
      parsed.activationClaim.status === "exact" &&
      parsed.namespace.status === "exact" &&
      parsed.namespace.nonNodeSiblingPackageRefs.length !== 0
    ) {
      reasons.push("activation_cleanup_non_node_siblings_present");
    }
  }

  const orphanPayloadIsExactlyKnown = orphanStagingPayloadIsExactlyKnownV2(
    parsed,
    expectedReceiptCandidate,
  );
  const cleanableActivationOrphan =
    parsed.transactionStaging.status === "orphan" &&
    parsed.transactionStaging.transactionKind === "activation" &&
    orphanPayloadIsExactlyKnown &&
    parsed.activationClaim.status === "absent" &&
    parsed.epochClaim.status === "absent" &&
    parsed.sharedLock.status === "absent" &&
    parsed.epochFloor.status === "absent" &&
    parsed.activationReceipt.status === "absent" &&
    (parsed.namespace.status !== "exact" ||
      parsed.namespace.nonNodeSiblingPackageRefs.length === 0);
  const cleanableEpochOrphan =
    parsed.transactionStaging.status === "orphan" &&
    parsed.transactionStaging.transactionKind === "epoch_floor" &&
    orphanPayloadIsExactlyKnown &&
    parsed.activationReceipt.status === "exact" &&
    parsed.activationClaim.status === "absent" &&
    parsed.epochClaim.status === "absent" &&
    parsed.sharedLock.status === "exact" &&
    parsed.epochFloor.status === "exact";
  if (
    parsed.transactionStaging.status === "orphan" &&
    !cleanableActivationOrphan &&
    !cleanableEpochOrphan
  ) {
    reasons.push("transaction_staging_orphan_not_cleanable");
  }

  const corruptionReasons = sortedUniqueCorruptionReasonsV2(reasons);
  if (corruptionReasons.length !== 0) {
    return deepFreezePlatformReleaseJsonV2({
      state: "CORRUPT",
      nextAction: "no_mutation",
      requiredLockOrder: [],
      corruptionReasons,
      epochClaimDisposition: "not_applicable",
      genesisEpochFloorState: null,
      expectedActivationReceipt: null,
      expectedActivationClaim: null,
    } as const);
  }

  const genesisEpochFloorState =
    PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_GENESIS_EPOCH_FLOOR_STATE_V2;
  const expectedReceipt = expectedReceiptCandidate;
  if (receiptIsExact) {
    if (parsed.activationClaim.status === "exact") {
      return deepFreezePlatformReleaseJsonV2({
        state: "ACTIVATION_CLEANUP_REQUIRED",
        nextAction:
          parsed.transactionStaging.status === "exact"
            ? "cleanup_activation_staging"
            : parsed.transactionStaging.status === "cleanup_partial"
              ? "resume_activation_staging_cleanup"
              : "remove_activation_claim",
        requiredLockOrder: ["shared_parent_lock", "legacy_node_package_lock"],
        corruptionReasons: [],
        epochClaimDisposition: "not_applicable",
        genesisEpochFloorState,
        expectedActivationReceipt: expectedReceipt,
        expectedActivationClaim: expectedClaimCandidate,
      } as const);
    }
    if (cleanableEpochOrphan) {
      return deepFreezePlatformReleaseJsonV2({
        state: "EPOCH_STAGING_ORPHANED",
        nextAction: "cleanup_orphaned_epoch_staging",
        requiredLockOrder: ["shared_parent_lock"],
        corruptionReasons: [],
        epochClaimDisposition: "not_applicable",
        genesisEpochFloorState,
        expectedActivationReceipt: expectedReceipt,
        expectedActivationClaim: null,
      } as const);
    }
    const epochClaimDisposition =
      parsed.epochClaim.status === "exact"
        ? parsed.epochFloor.status === "exact" &&
          epochClaimCurrentFloorDispositionV2(
            parsed.epochClaim.claim,
            parsed.epochFloor.state,
          ) === "prior"
          ? "recovery_from_prior"
          : "recovery_from_target"
        : "absent";
    return deepFreezePlatformReleaseJsonV2({
      state: "ACTIVATED",
      nextAction:
        epochClaimDisposition === "absent"
          ? "return_activated"
          : "recover_epoch_claim",
      requiredLockOrder: ["shared_parent_lock", "package_lock"],
      corruptionReasons: [],
      epochClaimDisposition,
      genesisEpochFloorState,
      expectedActivationReceipt: expectedReceipt,
      expectedActivationClaim: null,
    } as const);
  }
  if (cleanableActivationOrphan) {
    return deepFreezePlatformReleaseJsonV2({
      state: "ACTIVATION_STAGING_ORPHANED",
      nextAction: "cleanup_orphaned_activation_staging",
      requiredLockOrder: ["legacy_node_package_lock"],
      corruptionReasons: [],
      epochClaimDisposition: "not_applicable",
      genesisEpochFloorState,
      expectedActivationReceipt: null,
      expectedActivationClaim: null,
    } as const);
  }
  if (parsed.sharedLock.status === "absent") {
    if (parsed.activationClaim.status === "exact") {
      return deepFreezePlatformReleaseJsonV2({
        state: "ACTIVATION_CLAIMED",
        nextAction: "publish_and_acquire_shared_lock",
        requiredLockOrder: ["legacy_node_package_lock", "shared_parent_lock"],
        corruptionReasons: [],
        epochClaimDisposition: "not_applicable",
        genesisEpochFloorState,
        expectedActivationReceipt: expectedReceipt,
        expectedActivationClaim: expectedClaimCandidate,
      } as const);
    }
    return deepFreezePlatformReleaseJsonV2({
      state: "LEGACY_ONLY",
      nextAction: "prepare_and_publish_activation_claim",
      requiredLockOrder: ["legacy_node_package_lock"],
      corruptionReasons: [],
      epochClaimDisposition: "not_applicable",
      genesisEpochFloorState,
      expectedActivationReceipt: null,
      expectedActivationClaim: null,
    } as const);
  }
  if (parsed.epochFloor.status === "absent") {
    return deepFreezePlatformReleaseJsonV2({
      state: "SHARED_LOCK_PUBLISHED",
      nextAction: "publish_genesis_epoch_floor",
      requiredLockOrder: ["legacy_node_package_lock", "shared_parent_lock"],
      corruptionReasons: [],
      epochClaimDisposition: "not_applicable",
      genesisEpochFloorState,
      expectedActivationReceipt: expectedReceipt,
      expectedActivationClaim: expectedClaimCandidate,
    } as const);
  }
  return deepFreezePlatformReleaseJsonV2({
    state: "GENESIS_PUBLISHED",
    nextAction: "publish_activation_receipt",
    requiredLockOrder: ["legacy_node_package_lock", "shared_parent_lock"],
    corruptionReasons: [],
    epochClaimDisposition: "not_applicable",
    genesisEpochFloorState,
    expectedActivationReceipt: expectedReceipt,
    expectedActivationClaim: expectedClaimCandidate,
  } as const);
}

const ActivationPlanIdentityV2Schema = z
  .object({
    schema: z.literal(
      PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_ACTIVATION_PLAN_V2_SCHEMA,
    ),
    version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
    registryRef: z.literal(REGISTRY_REF_V2),
    registryContractHash: z.literal(REGISTRY_CONTRACT_HASH_V2),
    operation: z.literal("plan_registry_activation"),
    observation: PlatformReleaseBootstrapRegistryActivationObservationV2Schema,
    state: PlatformReleaseBootstrapRegistryActivationStateV2Schema,
    nextAction: PlatformReleaseBootstrapRegistryActivationNextActionV2Schema,
    requiredLockOrder: z.array(ActivationLockRoleV2Schema).max(2),
    corruptionReasons: z
      .array(PlatformReleaseBootstrapRegistryActivationCorruptionReasonV2Schema)
      .max(32),
    epochClaimDisposition:
      PlatformReleaseBootstrapRegistryEpochClaimDispositionV2Schema,
    genesisEpochFloorState:
      PlatformReleaseBootstrapRegistryEpochFloorStateV2Schema.nullable(),
    expectedActivationReceipt:
      PlatformReleaseBootstrapRegistryActivationReceiptV2Schema.nullable(),
    expectedActivationClaim:
      PlatformReleaseBootstrapRegistryActivationClaimV2Schema.nullable(),
  })
  .strict();

export type PlatformReleaseBootstrapRegistryActivationPlanHashPayloadV2 =
  z.infer<typeof ActivationPlanIdentityV2Schema>;

export function hashPlatformReleaseBootstrapRegistryActivationPlanV2(
  value:
    | PlatformReleaseBootstrapRegistryActivationPlanHashPayloadV2
    | PlatformReleaseBootstrapRegistryActivationPlanV2
    | Readonly<Record<string, unknown>>,
): string {
  const plan = { ...value } as Record<string, unknown>;
  delete plan.planHash;
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-bootstrap-registry-activation-plan-hash.v2",
    plan,
  });
}

function decisionEqualsPlanV2(
  decision: PlatformReleaseBootstrapRegistryActivationDecisionV2,
  plan: PlatformReleaseBootstrapRegistryActivationPlanHashPayloadV2,
): boolean {
  return (
    plan.state === decision.state &&
    plan.nextAction === decision.nextAction &&
    canonicalJsonStringify(plan.requiredLockOrder) ===
      canonicalJsonStringify(decision.requiredLockOrder) &&
    canonicalJsonStringify(plan.corruptionReasons) ===
      canonicalJsonStringify(decision.corruptionReasons) &&
    plan.epochClaimDisposition === decision.epochClaimDisposition &&
    canonicalJsonStringify(plan.genesisEpochFloorState) ===
      canonicalJsonStringify(decision.genesisEpochFloorState) &&
    canonicalJsonStringify(plan.expectedActivationReceipt) ===
      canonicalJsonStringify(decision.expectedActivationReceipt) &&
    canonicalJsonStringify(plan.expectedActivationClaim) ===
      canonicalJsonStringify(decision.expectedActivationClaim)
  );
}

export const PlatformReleaseBootstrapRegistryActivationPlanV2Schema =
  ActivationPlanIdentityV2Schema.extend({
    planHash: Sha256Schema,
  })
    .strict()
    .superRefine((value, context) => {
      let decision: PlatformReleaseBootstrapRegistryActivationDecisionV2;
      try {
        decision = derivePlatformReleaseBootstrapRegistryActivationDecisionV2(
          value.observation,
        );
      } catch {
        context.addIssue({
          code: "custom",
          path: ["observation"],
          message:
            "Registry activation plan observation must be independently valid before deterministic reduction",
        });
        return;
      }
      if (!decisionEqualsPlanV2(decision, value)) {
        context.addIssue({
          code: "custom",
          message:
            "Registry activation plan must equal the deterministic observation reduction",
        });
      }
      if (
        value.planHash !==
        hashPlatformReleaseBootstrapRegistryActivationPlanV2(value)
      ) {
        context.addIssue({
          code: "custom",
          path: ["planHash"],
          message: "Registry activation plan hash mismatch",
        });
      }
      if (
        !platformReleaseCandidateFitsCanonicalCapV2(
          value,
          PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_ACTIVATION_PLAN_MAX_CANONICAL_BYTES_V2,
        )
      ) {
        context.addIssue({
          code: "custom",
          message:
            "Registry activation plan exceeds its fixed canonical byte cap",
        });
      }
    });

export type PlatformReleaseBootstrapRegistryActivationPlanV2 = z.infer<
  typeof PlatformReleaseBootstrapRegistryActivationPlanV2Schema
>;

export function buildPlatformReleaseBootstrapRegistryActivationObservationV2(
  input: PlatformReleaseBootstrapRegistryActivationObservationInputV2,
): PlatformReleaseBootstrapRegistryActivationObservationV2 {
  const inputSnapshot = boundedPlatformReleaseJsonSnapshotV2(
    input,
    PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_ACTIVATION_OBSERVATION_MAX_CANONICAL_BYTES_V2,
  );
  const parsedInput = ActivationObservationInputV2Schema.parse(inputSnapshot);
  return parsePlatformReleaseBootstrapRegistryActivationObservationCandidateV2({
    schema:
      PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_ACTIVATION_OBSERVATION_V2_SCHEMA,
    version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
    registryRef: REGISTRY_REF_V2,
    registryContractHash: REGISTRY_CONTRACT_HASH_V2,
    ...parsedInput,
  });
}

export function parsePlatformReleaseBootstrapRegistryActivationObservationCandidateV2(
  input: unknown,
): PlatformReleaseBootstrapRegistryActivationObservationV2 {
  const snapshot = boundedPlatformReleaseJsonSnapshotV2(
    input,
    PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_ACTIVATION_OBSERVATION_MAX_CANONICAL_BYTES_V2,
  );
  return deepFreezePlatformReleaseJsonV2(
    PlatformReleaseBootstrapRegistryActivationObservationV2Schema.parse(
      snapshot,
    ),
  );
}

export function buildPlatformReleaseBootstrapRegistryActivationPlanV2(
  observation: PlatformReleaseBootstrapRegistryActivationObservationV2,
): PlatformReleaseBootstrapRegistryActivationPlanV2 {
  const parsedObservation =
    parsePlatformReleaseBootstrapRegistryActivationObservationCandidateV2(
      observation,
    );
  const decision =
    derivePlatformReleaseBootstrapRegistryActivationDecisionV2(
      parsedObservation,
    );
  const identity = {
    schema: PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_ACTIVATION_PLAN_V2_SCHEMA,
    version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
    registryRef: REGISTRY_REF_V2,
    registryContractHash: REGISTRY_CONTRACT_HASH_V2,
    operation: "plan_registry_activation",
    observation: parsedObservation,
    ...decision,
  } as const;
  return parsePlatformReleaseBootstrapRegistryActivationPlanCandidateV2({
    ...identity,
    planHash: hashPlatformReleaseBootstrapRegistryActivationPlanV2(identity),
  });
}

export function parsePlatformReleaseBootstrapRegistryActivationPlanCandidateV2(
  input: unknown,
): PlatformReleaseBootstrapRegistryActivationPlanV2 {
  const snapshot = boundedPlatformReleaseJsonSnapshotV2(
    input,
    PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_ACTIVATION_PLAN_MAX_CANONICAL_BYTES_V2,
  );
  return deepFreezePlatformReleaseJsonV2(
    PlatformReleaseBootstrapRegistryActivationPlanV2Schema.parse(snapshot),
  );
}

export class PlatformReleaseBootstrapRegistryProductionActivationErrorV2 extends Error {
  readonly code =
    PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_ACTIVATION_PRODUCTION_ERROR_CODE_V2;

  constructor() {
    super(
      "Production registry activation is forbidden until a physical dual-lock authority is implemented",
    );
    this.name = "PlatformReleaseBootstrapRegistryProductionActivationErrorV2";
  }
}

export function activatePlatformReleaseBootstrapRegistryProductionV2(): never {
  throw new PlatformReleaseBootstrapRegistryProductionActivationErrorV2();
}
