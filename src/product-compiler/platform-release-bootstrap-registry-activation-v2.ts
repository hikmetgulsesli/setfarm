import { z } from "zod";

import {
  PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2,
} from
  "../execution/schemas/platform-release-bootstrap-contract-v2.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2,
} from
  "../execution/schemas/platform-release-bootstrap-operation-abis-v2.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_GENESIS_EPOCH_FLOOR_STATE_V2,
  PlatformReleaseBootstrapRegistryActivationReceiptV2Schema,
  PlatformReleaseBootstrapRegistryEpochClaimV2Schema,
  PlatformReleaseBootstrapRegistryEpochFloorStateV2Schema,
  buildPlatformReleaseBootstrapRegistryActivationReceiptV2,
  type PlatformReleaseBootstrapRegistryActivationReceiptV2,
  type PlatformReleaseBootstrapRegistryEpochClaimV2,
  type PlatformReleaseBootstrapRegistryEpochFloorStateV2,
} from
  "../execution/schemas/platform-release-bootstrap-registry-state-v2.js";
import {
  PLATFORM_RELEASE_COMPONENT_VERSION_V2,
  boundedPlatformReleaseJsonSnapshotV2,
  deepFreezePlatformReleaseJsonV2,
  platformReleaseCandidateFitsCanonicalCapV2,
} from "../execution/schemas/platform-release-common-v2.js";
import {
  PlatformReleaseBootstrapNamespaceCensusV2Schema,
  type PlatformReleaseBootstrapNamespaceCensusV2,
} from "./platform-release-bootstrap-registry-v2.js";
import {
  canonicalJsonStringify,
  hashCanonicalJson,
} from "./canonical-json.js";
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

export const PlatformReleaseBootstrapRegistryActivationStateV2Schema =
  z.enum([
    "LEGACY_ONLY",
    "SHARED_LOCK_PUBLISHED",
    "GENESIS_PUBLISHED",
    "ACTIVATED",
    "CORRUPT",
  ]);

export type PlatformReleaseBootstrapRegistryActivationStateV2 =
  z.infer<
    typeof PlatformReleaseBootstrapRegistryActivationStateV2Schema
  >;

export const PlatformReleaseBootstrapRegistryActivationNextActionV2Schema =
  z.enum([
    "publish_and_acquire_shared_lock",
    "publish_genesis_epoch_floor",
    "publish_activation_receipt",
    "recover_epoch_claim",
    "return_activated",
    "no_mutation",
  ]);

export type PlatformReleaseBootstrapRegistryActivationNextActionV2 =
  z.infer<
    typeof PlatformReleaseBootstrapRegistryActivationNextActionV2Schema
  >;

export const PlatformReleaseBootstrapRegistryEpochClaimDispositionV2Schema =
  z.enum([
    "not_applicable",
    "absent",
    "recovery_from_prior",
    "recovery_from_target",
  ]);

export type PlatformReleaseBootstrapRegistryEpochClaimDispositionV2 =
  z.infer<
    typeof PlatformReleaseBootstrapRegistryEpochClaimDispositionV2Schema
  >;

const ActivationLockRoleV2Schema = z.enum([
  "legacy_node_package_lock",
  "shared_parent_lock",
  "package_lock",
]);

export const PlatformReleaseBootstrapRegistryActivationCorruptionReasonV2Schema =
  z.enum([
    "activation_receipt_cutover_identity_mismatch",
    "activation_receipt_invalid",
    "activation_receipt_missing_epoch_floor",
    "activation_receipt_missing_shared_lock",
    "epoch_claim_invalid",
    "epoch_claim_present_before_activation",
    "epoch_claim_state_mismatch",
    "epoch_floor_invalid",
    "legacy_lock_not_exact",
    "namespace_non_node_siblings_before_activation",
    "namespace_not_exact",
    "namespace_observation_mismatch",
    "node_lifecycle_census_mismatch",
    "node_lifecycle_not_stable",
    "non_genesis_floor_before_activation",
    "parent_boundary_not_exact",
    "shared_lock_invalid",
    "shared_lock_missing_for_epoch_floor",
  ]);

export type PlatformReleaseBootstrapRegistryActivationCorruptionReasonV2 =
  z.infer<
    typeof PlatformReleaseBootstrapRegistryActivationCorruptionReasonV2Schema
  >;

const LegacyLockObservationV2Schema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("absent") }).strict(),
  z.object({
    status: z.literal("exact"),
    legacyNodeLockIdentityHash: Sha256Schema,
  }).strict(),
  z.object({
    status: z.literal("invalid"),
    failureKind: z.enum([
      "content_mismatch",
      "metadata_mismatch",
      "transplanted_identity",
    ]),
  }).strict(),
]);

const SharedLockObservationV2Schema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("absent") }).strict(),
  z.object({
    status: z.literal("exact"),
    sharedLockIdentityHash: Sha256Schema,
  }).strict(),
  z.object({
    status: z.literal("invalid"),
    failureKind: z.enum([
      "content_mismatch",
      "metadata_mismatch",
      "transplanted_identity",
    ]),
  }).strict(),
]);

const ParentBoundaryObservationV2Schema =
  z.discriminatedUnion("status", [
    z.object({
      status: z.literal("exact"),
      parentIdentityHash: Sha256Schema,
    }).strict(),
    z.object({
      status: z.literal("invalid"),
      failureKind: z.enum([
        "descriptor_path_mismatch",
        "metadata_mismatch",
        "parent_changed",
        "transplanted_identity",
      ]),
    }).strict(),
  ]);

const NodeLifecycleObservationV2Schema =
  z.discriminatedUnion("status", [
    z.object({
      status: z.literal("ready"),
      nodeLifecycleIdentityHash: z.literal(
        PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_NODE_LIFECYCLE_IDENTITY_HASH_V2,
      ),
    }).strict(),
    z.object({
      status: z.literal("empty_or_rolled_back"),
      nodeLifecycleIdentityHash: z.literal(
        PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_NODE_LIFECYCLE_IDENTITY_HASH_V2,
      ),
    }).strict(),
    z.object({
      status: z.literal("transient"),
      failureKind: z.enum([
        "active_claim",
        "active_staging",
        "rollback_claim",
      ]),
    }).strict(),
    z.object({
      status: z.literal("invalid"),
      failureKind: z.enum([
        "changing_census",
        "foreign_member",
        "lifecycle_contract_mismatch",
        "metadata_mismatch",
      ]),
    }).strict(),
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
        .filter((entry) =>
          entry.ownerKind === "package"
          && entry.ownerRef !== NODE_PACKAGE_REF_V2)
        .map((entry) =>
          NonNodePackageRefV2Schema.parse(entry.ownerRef)),
    ),
  ].sort(compareUtf16V2);
}

const NamespaceObservationV2Schema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("exact"),
    census: PlatformReleaseBootstrapNamespaceCensusV2Schema,
    nonNodeSiblingPackageRefs:
      z.array(NonNodePackageRefV2Schema).max(3),
  }).strict().superRefine((value, context) => {
    const derived = deriveNonNodeSiblingPackageRefsV2(value.census);
    if (
      value.nonNodeSiblingPackageRefs.length !== derived.length
      || value.nonNodeSiblingPackageRefs.some((entry, index) =>
        entry !== derived[index])
    ) {
      context.addIssue({
        code: "custom",
        path: ["nonNodeSiblingPackageRefs"],
        message:
          "Non-Node sibling refs must equal the sorted unique namespace census projection",
      });
    }
  }),
  z.object({
    status: z.literal("invalid"),
    failureKind: z.enum([
      "ambiguous_basename",
      "changing_census",
      "duplicate_basename",
      "malformed_basename",
      "unknown_basename",
    ]),
  }).strict(),
]);

const EpochFloorObservationV2Schema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("absent") }).strict(),
  z.object({
    status: z.literal("exact"),
    state: PlatformReleaseBootstrapRegistryEpochFloorStateV2Schema,
  }).strict(),
  z.object({
    status: z.literal("invalid"),
    failureKind: z.enum([
      "content_mismatch",
      "metadata_mismatch",
      "state_contract_mismatch",
      "transplanted_identity",
    ]),
  }).strict(),
]);

const ActivationReceiptObservationV2Schema =
  z.discriminatedUnion("status", [
    z.object({ status: z.literal("absent") }).strict(),
    z.object({
      status: z.literal("exact"),
      receipt:
        PlatformReleaseBootstrapRegistryActivationReceiptV2Schema,
    }).strict(),
    z.object({
      status: z.literal("invalid"),
      failureKind: z.enum([
        "content_mismatch",
        "metadata_mismatch",
        "receipt_contract_mismatch",
        "transplanted_identity",
      ]),
    }).strict(),
  ]);

const EpochClaimObservationV2Schema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("absent") }).strict(),
  z.object({
    status: z.literal("exact"),
    claim: PlatformReleaseBootstrapRegistryEpochClaimV2Schema,
  }).strict(),
  z.object({
    status: z.literal("invalid"),
    failureKind: z.enum([
      "content_mismatch",
      "metadata_mismatch",
      "claim_contract_mismatch",
      "transplanted_identity",
    ]),
  }).strict(),
]);

const ActivationObservationIdentityV2Schema =
  z.object({
    schema: z.literal(
      PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_ACTIVATION_OBSERVATION_V2_SCHEMA,
    ),
    version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
    registryRef: z.literal(REGISTRY_REF_V2),
    registryContractHash: z.literal(REGISTRY_CONTRACT_HASH_V2),
    legacyLock: LegacyLockObservationV2Schema,
    sharedLock: SharedLockObservationV2Schema,
    parentBoundary: ParentBoundaryObservationV2Schema,
    nodeLifecycle: NodeLifecycleObservationV2Schema,
    namespace: NamespaceObservationV2Schema,
    epochFloor: EpochFloorObservationV2Schema,
    activationReceipt: ActivationReceiptObservationV2Schema,
    epochClaim: EpochClaimObservationV2Schema,
  }).strict();

export const PlatformReleaseBootstrapRegistryActivationObservationV2Schema =
  ActivationObservationIdentityV2Schema.superRefine(
    (value, context) => {
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
    },
  );

export type PlatformReleaseBootstrapRegistryActivationObservationV2 =
  z.infer<
    typeof PlatformReleaseBootstrapRegistryActivationObservationV2Schema
  >;

export type PlatformReleaseBootstrapRegistryActivationObservationInputV2 =
  Omit<
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

export type PlatformReleaseBootstrapRegistryActivationDecisionV2 =
  Readonly<{
  state: PlatformReleaseBootstrapRegistryActivationStateV2;
  nextAction: PlatformReleaseBootstrapRegistryActivationNextActionV2;
  requiredLockOrder: readonly z.infer<
    typeof ActivationLockRoleV2Schema
  >[];
  corruptionReasons:
    readonly PlatformReleaseBootstrapRegistryActivationCorruptionReasonV2[];
  epochClaimDisposition:
    PlatformReleaseBootstrapRegistryEpochClaimDispositionV2;
  genesisEpochFloorState:
    PlatformReleaseBootstrapRegistryEpochFloorStateV2 | null;
  expectedActivationReceipt:
    PlatformReleaseBootstrapRegistryActivationReceiptV2 | null;
  }>;

function namespaceHasEntryV2(
  census: PlatformReleaseBootstrapNamespaceCensusV2,
  ownerKind: "registry" | "package",
  category: string,
  ownerRef?: string,
): boolean {
  return census.orderedEntries.some((entry) =>
    entry.ownerKind === ownerKind
    && entry.category === category
    && (ownerRef === undefined || entry.ownerRef === ownerRef));
}

function observationPresenceMatchesNamespaceV2(
  observation:
    PlatformReleaseBootstrapRegistryActivationObservationV2,
): boolean {
  if (observation.namespace.status !== "exact") return false;
  const census = observation.namespace.census;
  const legacyLockPresent =
    observation.legacyLock.status !== "absent";
  const sharedLockPresent =
    observation.sharedLock.status !== "absent";
  const epochFloorPresent =
    observation.epochFloor.status !== "absent";
  const activationReceiptPresent =
    observation.activationReceipt.status !== "absent";
  const epochClaimPresent =
    observation.epochClaim.status !== "absent";
  return (
    namespaceHasEntryV2(
      census,
      "package",
      "package_lock",
      NODE_PACKAGE_REF_V2,
    ) === legacyLockPresent
    && namespaceHasEntryV2(
      census,
      "registry",
      "shared_parent_lock",
      REGISTRY_REF_V2,
    ) === sharedLockPresent
    && namespaceHasEntryV2(
      census,
      "registry",
      "epoch_floor_state",
      REGISTRY_REF_V2,
    ) === epochFloorPresent
    && namespaceHasEntryV2(
      census,
      "registry",
      "activation_receipt",
      REGISTRY_REF_V2,
    ) === activationReceiptPresent
    && namespaceHasEntryV2(
      census,
      "registry",
      "epoch_claim",
      REGISTRY_REF_V2,
    ) === epochClaimPresent
  );
}

function nodeLifecycleMatchesNamespaceV2(
  observation:
    PlatformReleaseBootstrapRegistryActivationObservationV2,
): boolean {
  if (
    observation.namespace.status !== "exact"
    || (
      observation.nodeLifecycle.status !== "ready"
      && observation.nodeLifecycle.status !== "empty_or_rolled_back"
    )
  ) {
    return false;
  }
  const census = observation.namespace.census;
  const hasNodeCategory = (category: string): boolean =>
    namespaceHasEntryV2(
      census,
      "package",
      category,
      NODE_PACKAGE_REF_V2,
    );
  const hasLock = hasNodeCategory("package_lock");
  const hasRoot = hasNodeCategory("package_root");
  const hasActiveClaim = hasNodeCategory("active_claim");
  const hasActiveReceipt = hasNodeCategory("active_receipt");
  const hasStaging = hasNodeCategory("generation_staging");
  const hasRollbackClaim = hasNodeCategory("rollback_claim");
  if (observation.nodeLifecycle.status === "ready") {
    return hasLock
      && hasRoot
      && hasActiveClaim
      && hasActiveReceipt
      && !hasStaging
      && !hasRollbackClaim;
  }
  return hasLock
    && !hasRoot
    && !hasActiveClaim
    && !hasActiveReceipt
    && !hasStaging
    && !hasRollbackClaim;
}

function epochClaimMatchesCurrentFloorV2(
  claim: PlatformReleaseBootstrapRegistryEpochClaimV2,
  floor: PlatformReleaseBootstrapRegistryEpochFloorStateV2,
): boolean {
  if (
    floor.epochStateHash !== claim.priorEpochStateHash
    && floor.epochStateHash !== claim.targetEpochStateHash
  ) {
    return false;
  }
  return floor.epochStateHash !== claim.targetEpochStateHash
    || floor.transactionIdentityHash === claim.transactionIdentityHash;
}

function isExactGenesisEpochFloorV2(
  floor: PlatformReleaseBootstrapRegistryEpochFloorStateV2,
): boolean {
  return floor.epochStateHash
    ===
      PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_GENESIS_EPOCH_FLOOR_STATE_V2
        .epochStateHash
    && canonicalJsonStringify(floor)
      === canonicalJsonStringify(
        PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_GENESIS_EPOCH_FLOOR_STATE_V2,
      );
}

function expectedActivationReceiptV2(
  observation:
    PlatformReleaseBootstrapRegistryActivationObservationV2,
): PlatformReleaseBootstrapRegistryActivationReceiptV2 | null {
  if (
    observation.legacyLock.status !== "exact"
    || observation.sharedLock.status !== "exact"
    || observation.parentBoundary.status !== "exact"
    || (
      observation.nodeLifecycle.status !== "ready"
      && observation.nodeLifecycle.status !== "empty_or_rolled_back"
    )
  ) {
    return null;
  }
  try {
    return buildPlatformReleaseBootstrapRegistryActivationReceiptV2({
      sharedLockIdentityHash:
        observation.sharedLock.sharedLockIdentityHash,
      legacyNodeLockIdentityHash:
        observation.legacyLock.legacyNodeLockIdentityHash,
      nodeLifecycleIdentityHash:
        observation.nodeLifecycle.nodeLifecycleIdentityHash,
      parentIdentityHash:
        observation.parentBoundary.parentIdentityHash,
    });
  } catch {
    return null;
  }
}

function sortedUniqueCorruptionReasonsV2(
  reasons:
    readonly PlatformReleaseBootstrapRegistryActivationCorruptionReasonV2[],
): readonly PlatformReleaseBootstrapRegistryActivationCorruptionReasonV2[] {
  return [...new Set(reasons)].sort(compareUtf16V2);
}

export function derivePlatformReleaseBootstrapRegistryActivationDecisionV2(
  observation:
    PlatformReleaseBootstrapRegistryActivationObservationV2,
): PlatformReleaseBootstrapRegistryActivationDecisionV2 {
  const parsed =
    parsePlatformReleaseBootstrapRegistryActivationObservationCandidateV2(
      observation,
    );
  const reasons:
    PlatformReleaseBootstrapRegistryActivationCorruptionReasonV2[] = [];
  const expectedReceiptCandidate =
    expectedActivationReceiptV2(parsed);

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
    parsed.nodeLifecycle.status !== "ready"
    && parsed.nodeLifecycle.status !== "empty_or_rolled_back"
  ) {
    reasons.push("node_lifecycle_not_stable");
  } else if (
    parsed.namespace.status === "exact"
    && !nodeLifecycleMatchesNamespaceV2(parsed)
  ) {
    reasons.push("node_lifecycle_census_mismatch");
  }
  if (parsed.namespace.status !== "exact") {
    reasons.push("namespace_not_exact");
  } else if (!observationPresenceMatchesNamespaceV2(parsed)) {
    reasons.push("namespace_observation_mismatch");
  }
  if (parsed.epochFloor.status === "invalid") {
    reasons.push("epoch_floor_invalid");
  }
  if (parsed.activationReceipt.status === "invalid") {
    reasons.push("activation_receipt_invalid");
  }
  if (parsed.epochClaim.status === "invalid") {
    reasons.push("epoch_claim_invalid");
  }
  if (
    parsed.sharedLock.status === "exact"
    && parsed.legacyLock.status === "exact"
    && parsed.parentBoundary.status === "exact"
    && (
      parsed.nodeLifecycle.status === "ready"
      || parsed.nodeLifecycle.status === "empty_or_rolled_back"
    )
    && expectedReceiptCandidate === null
  ) {
    reasons.push(
      "activation_receipt_cutover_identity_mismatch",
    );
  }

  const receiptIsExact = parsed.activationReceipt.status === "exact";
  if (parsed.activationReceipt.status !== "exact") {
    if (
      parsed.namespace.status === "exact"
      && parsed.namespace.nonNodeSiblingPackageRefs.length !== 0
    ) {
      reasons.push(
        "namespace_non_node_siblings_before_activation",
      );
    }
    if (parsed.epochClaim.status !== "absent") {
      reasons.push("epoch_claim_present_before_activation");
    }
    if (
      parsed.sharedLock.status === "absent"
      && parsed.epochFloor.status === "exact"
    ) {
      reasons.push("shared_lock_missing_for_epoch_floor");
    }
    if (
      parsed.epochFloor.status === "exact"
      && !isExactGenesisEpochFloorV2(parsed.epochFloor.state)
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
      expectedReceipt === null
      || expectedReceipt.activationReceiptHash
        !== parsed.activationReceipt.receipt.activationReceiptHash
      || canonicalJsonStringify(expectedReceipt)
        !== canonicalJsonStringify(
          parsed.activationReceipt.receipt,
        )
    ) {
      reasons.push(
        "activation_receipt_cutover_identity_mismatch",
      );
    }
    if (
      parsed.epochClaim.status === "exact"
      && (
        parsed.epochFloor.status !== "exact"
        || !epochClaimMatchesCurrentFloorV2(
          parsed.epochClaim.claim,
          parsed.epochFloor.state,
        )
      )
    ) {
      reasons.push("epoch_claim_state_mismatch");
    }
  }

  const corruptionReasons =
    sortedUniqueCorruptionReasonsV2(reasons);
  if (corruptionReasons.length !== 0) {
    return deepFreezePlatformReleaseJsonV2({
      state: "CORRUPT",
      nextAction: "no_mutation",
      requiredLockOrder: [],
      corruptionReasons,
      epochClaimDisposition: "not_applicable",
      genesisEpochFloorState: null,
      expectedActivationReceipt: null,
    } as const);
  }

  const genesisEpochFloorState =
    PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_GENESIS_EPOCH_FLOOR_STATE_V2;
  const expectedReceipt = expectedReceiptCandidate;
  if (receiptIsExact) {
    const epochClaimDisposition =
      parsed.epochClaim.status === "exact"
        ? parsed.epochFloor.status === "exact"
          && parsed.epochFloor.state.epochStateHash
            === parsed.epochClaim.claim.priorEpochStateHash
          ? "recovery_from_prior"
          : "recovery_from_target"
        : "absent";
    return deepFreezePlatformReleaseJsonV2({
      state: "ACTIVATED",
      nextAction:
        epochClaimDisposition === "absent"
          ? "return_activated"
          : "recover_epoch_claim",
      requiredLockOrder: [
        "shared_parent_lock",
        "package_lock",
      ],
      corruptionReasons: [],
      epochClaimDisposition,
      genesisEpochFloorState,
      expectedActivationReceipt: expectedReceipt,
    } as const);
  }
  if (parsed.sharedLock.status === "absent") {
    return deepFreezePlatformReleaseJsonV2({
      state: "LEGACY_ONLY",
      nextAction: "publish_and_acquire_shared_lock",
      requiredLockOrder: [
        "legacy_node_package_lock",
        "shared_parent_lock",
      ],
      corruptionReasons: [],
      epochClaimDisposition: "not_applicable",
      genesisEpochFloorState,
      expectedActivationReceipt: null,
    } as const);
  }
  if (parsed.epochFloor.status === "absent") {
    return deepFreezePlatformReleaseJsonV2({
      state: "SHARED_LOCK_PUBLISHED",
      nextAction: "publish_genesis_epoch_floor",
      requiredLockOrder: [
        "legacy_node_package_lock",
        "shared_parent_lock",
      ],
      corruptionReasons: [],
      epochClaimDisposition: "not_applicable",
      genesisEpochFloorState,
      expectedActivationReceipt: expectedReceipt,
    } as const);
  }
  return deepFreezePlatformReleaseJsonV2({
    state: "GENESIS_PUBLISHED",
    nextAction: "publish_activation_receipt",
    requiredLockOrder: [
      "legacy_node_package_lock",
      "shared_parent_lock",
    ],
    corruptionReasons: [],
    epochClaimDisposition: "not_applicable",
    genesisEpochFloorState,
    expectedActivationReceipt: expectedReceipt,
  } as const);
}

const ActivationPlanIdentityV2Schema = z.object({
  schema: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_ACTIVATION_PLAN_V2_SCHEMA,
  ),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  registryRef: z.literal(REGISTRY_REF_V2),
  registryContractHash: z.literal(REGISTRY_CONTRACT_HASH_V2),
  operation: z.literal("plan_registry_activation"),
  observation:
    PlatformReleaseBootstrapRegistryActivationObservationV2Schema,
  state:
    PlatformReleaseBootstrapRegistryActivationStateV2Schema,
  nextAction:
    PlatformReleaseBootstrapRegistryActivationNextActionV2Schema,
  requiredLockOrder:
    z.array(ActivationLockRoleV2Schema).max(2),
  corruptionReasons:
    z.array(
      PlatformReleaseBootstrapRegistryActivationCorruptionReasonV2Schema,
    ).max(17),
  epochClaimDisposition:
    PlatformReleaseBootstrapRegistryEpochClaimDispositionV2Schema,
  genesisEpochFloorState:
    PlatformReleaseBootstrapRegistryEpochFloorStateV2Schema.nullable(),
  expectedActivationReceipt:
    PlatformReleaseBootstrapRegistryActivationReceiptV2Schema.nullable(),
}).strict();

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
  plan:
    PlatformReleaseBootstrapRegistryActivationPlanHashPayloadV2,
): boolean {
  return (
    plan.state === decision.state
    && plan.nextAction === decision.nextAction
    && canonicalJsonStringify(plan.requiredLockOrder)
      === canonicalJsonStringify(decision.requiredLockOrder)
    && canonicalJsonStringify(plan.corruptionReasons)
      === canonicalJsonStringify(decision.corruptionReasons)
    && plan.epochClaimDisposition
      === decision.epochClaimDisposition
    && canonicalJsonStringify(plan.genesisEpochFloorState)
      === canonicalJsonStringify(decision.genesisEpochFloorState)
    && canonicalJsonStringify(plan.expectedActivationReceipt)
      === canonicalJsonStringify(decision.expectedActivationReceipt)
  );
}

export const PlatformReleaseBootstrapRegistryActivationPlanV2Schema =
  ActivationPlanIdentityV2Schema.extend({
    planHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const decision =
      derivePlatformReleaseBootstrapRegistryActivationDecisionV2(
        value.observation,
      );
    if (!decisionEqualsPlanV2(decision, value)) {
      context.addIssue({
        code: "custom",
        message:
          "Registry activation plan must equal the deterministic observation reduction",
      });
    }
    if (
      value.planHash
      !== hashPlatformReleaseBootstrapRegistryActivationPlanV2(value)
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

export type PlatformReleaseBootstrapRegistryActivationPlanV2 =
  z.infer<
    typeof PlatformReleaseBootstrapRegistryActivationPlanV2Schema
  >;

export function buildPlatformReleaseBootstrapRegistryActivationObservationV2(
  input:
    PlatformReleaseBootstrapRegistryActivationObservationInputV2,
): PlatformReleaseBootstrapRegistryActivationObservationV2 {
  const inputSnapshot = boundedPlatformReleaseJsonSnapshotV2(
    input,
    PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_ACTIVATION_OBSERVATION_MAX_CANONICAL_BYTES_V2,
  );
  const parsedInput =
    ActivationObservationInputV2Schema.parse(inputSnapshot);
  return parsePlatformReleaseBootstrapRegistryActivationObservationCandidateV2(
    {
      schema:
        PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_ACTIVATION_OBSERVATION_V2_SCHEMA,
      version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
      registryRef: REGISTRY_REF_V2,
      registryContractHash: REGISTRY_CONTRACT_HASH_V2,
      ...parsedInput,
    },
  );
}

export function parsePlatformReleaseBootstrapRegistryActivationObservationCandidateV2(
  input: unknown,
): PlatformReleaseBootstrapRegistryActivationObservationV2 {
  const snapshot = boundedPlatformReleaseJsonSnapshotV2(
    input,
    PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_ACTIVATION_OBSERVATION_MAX_CANONICAL_BYTES_V2,
  );
  return deepFreezePlatformReleaseJsonV2(
    PlatformReleaseBootstrapRegistryActivationObservationV2Schema
      .parse(snapshot),
  );
}

export function buildPlatformReleaseBootstrapRegistryActivationPlanV2(
  observation:
    PlatformReleaseBootstrapRegistryActivationObservationV2,
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
    schema:
      PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_ACTIVATION_PLAN_V2_SCHEMA,
    version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
    registryRef: REGISTRY_REF_V2,
    registryContractHash: REGISTRY_CONTRACT_HASH_V2,
    operation: "plan_registry_activation",
    observation: parsedObservation,
    ...decision,
  } as const;
  return parsePlatformReleaseBootstrapRegistryActivationPlanCandidateV2(
    {
      ...identity,
      planHash:
        hashPlatformReleaseBootstrapRegistryActivationPlanV2(identity),
    },
  );
}

export function parsePlatformReleaseBootstrapRegistryActivationPlanCandidateV2(
  input: unknown,
): PlatformReleaseBootstrapRegistryActivationPlanV2 {
  const snapshot = boundedPlatformReleaseJsonSnapshotV2(
    input,
    PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_ACTIVATION_PLAN_MAX_CANONICAL_BYTES_V2,
  );
  return deepFreezePlatformReleaseJsonV2(
    PlatformReleaseBootstrapRegistryActivationPlanV2Schema
      .parse(snapshot),
  );
}

export class PlatformReleaseBootstrapRegistryProductionActivationErrorV2
  extends Error {
  readonly code =
    PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_ACTIVATION_PRODUCTION_ERROR_CODE_V2;

  constructor() {
    super(
      "Production registry activation is forbidden until a physical dual-lock authority is implemented",
    );
    this.name =
      "PlatformReleaseBootstrapRegistryProductionActivationErrorV2";
  }
}

export function activatePlatformReleaseBootstrapRegistryProductionV2(
): never {
  throw new PlatformReleaseBootstrapRegistryProductionActivationErrorV2();
}
