import type {
  PlatformReleaseBootstrapRegistryActivationNextActionV2,
  PlatformReleaseBootstrapRegistryActivationObservationV2,
} from "./platform-release-bootstrap-registry-activation-v2.js";

export const PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_MECHANICS_SCOPE_V2 =
  "mechanics_only_never_production_authority_v2" as const;

export type PlatformReleaseBootstrapRegistryPhysicalActivationLockRoleV2 =
  "legacy_node_package_lock" | "shared_parent_lock" | "package_lock";

export interface PlatformReleaseBootstrapRegistryPhysicalActivationPlanHandleV2 {
  readonly mechanicsScope: typeof PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_MECHANICS_SCOPE_V2;
  readonly round: number;
  readonly planHash: string;
  readonly nextAction: PlatformReleaseBootstrapRegistryActivationNextActionV2;
}

export interface PlatformReleaseBootstrapRegistryPhysicalActivationLockedSlotLedgerTokenV2 {
  readonly mechanicsScope: typeof PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_MECHANICS_SCOPE_V2;
}

export interface PlatformReleaseBootstrapRegistryPhysicalActivationLockedObservationV2 {
  readonly observation: PlatformReleaseBootstrapRegistryActivationObservationV2;
  readonly slotLedgerToken: PlatformReleaseBootstrapRegistryPhysicalActivationLockedSlotLedgerTokenV2;
  readonly slotLedgerBindingHash: string;
}

export interface PlatformReleaseBootstrapRegistryPhysicalActivationSessionV2 {
  readonly mechanicsScope: typeof PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_MECHANICS_SCOPE_V2;
  readonly contractHash: string;
  readonly backendAbiHash: string;
  readonly sessionOccurrenceHash: string;

  observePhysicalActivationState(): Promise<PlatformReleaseBootstrapRegistryActivationObservationV2>;
  reobserveLockedPhysicalActivationState(): Promise<PlatformReleaseBootstrapRegistryPhysicalActivationLockedObservationV2>;
  acquireLegacyNodeLock(): Promise<void>;
  acquireSharedParentLock(): Promise<void>;
  acquireRegisteredPackageLock(): Promise<void>;
  revalidateFixedSession(): Promise<void>;
  assertPhysicalActivationOperationReserve(): Promise<void>;

  cleanupActivationStaging(
    plan: PlatformReleaseBootstrapRegistryPhysicalActivationPlanHandleV2,
    slotLedger: PlatformReleaseBootstrapRegistryPhysicalActivationLockedSlotLedgerTokenV2,
  ): Promise<void>;
  cleanupOrphanedActivationStaging(
    plan: PlatformReleaseBootstrapRegistryPhysicalActivationPlanHandleV2,
    slotLedger: PlatformReleaseBootstrapRegistryPhysicalActivationLockedSlotLedgerTokenV2,
  ): Promise<void>;
  cleanupOrphanedEpochStaging(
    plan: PlatformReleaseBootstrapRegistryPhysicalActivationPlanHandleV2,
    slotLedger: PlatformReleaseBootstrapRegistryPhysicalActivationLockedSlotLedgerTokenV2,
  ): Promise<void>;
  prepareAndPublishActivationClaim(
    plan: PlatformReleaseBootstrapRegistryPhysicalActivationPlanHandleV2,
    slotLedger: PlatformReleaseBootstrapRegistryPhysicalActivationLockedSlotLedgerTokenV2,
  ): Promise<void>;
  publishAndAcquireSharedLock(
    plan: PlatformReleaseBootstrapRegistryPhysicalActivationPlanHandleV2,
    slotLedger: PlatformReleaseBootstrapRegistryPhysicalActivationLockedSlotLedgerTokenV2,
  ): Promise<void>;
  publishGenesisEpochFloor(
    plan: PlatformReleaseBootstrapRegistryPhysicalActivationPlanHandleV2,
    slotLedger: PlatformReleaseBootstrapRegistryPhysicalActivationLockedSlotLedgerTokenV2,
  ): Promise<void>;
  publishActivationReceipt(
    plan: PlatformReleaseBootstrapRegistryPhysicalActivationPlanHandleV2,
    slotLedger: PlatformReleaseBootstrapRegistryPhysicalActivationLockedSlotLedgerTokenV2,
  ): Promise<void>;
  recoverEpochClaim(
    plan: PlatformReleaseBootstrapRegistryPhysicalActivationPlanHandleV2,
    slotLedger: PlatformReleaseBootstrapRegistryPhysicalActivationLockedSlotLedgerTokenV2,
  ): Promise<void>;
  removeActivationClaim(
    plan: PlatformReleaseBootstrapRegistryPhysicalActivationPlanHandleV2,
    slotLedger: PlatformReleaseBootstrapRegistryPhysicalActivationLockedSlotLedgerTokenV2,
  ): Promise<void>;
  resumeActivationStagingCleanup(
    plan: PlatformReleaseBootstrapRegistryPhysicalActivationPlanHandleV2,
    slotLedger: PlatformReleaseBootstrapRegistryPhysicalActivationLockedSlotLedgerTokenV2,
  ): Promise<void>;
  returnActivated(
    plan: PlatformReleaseBootstrapRegistryPhysicalActivationPlanHandleV2,
    slotLedger: PlatformReleaseBootstrapRegistryPhysicalActivationLockedSlotLedgerTokenV2,
  ): Promise<void>;
  closeWithoutMutation(
    plan: PlatformReleaseBootstrapRegistryPhysicalActivationPlanHandleV2,
    slotLedger: PlatformReleaseBootstrapRegistryPhysicalActivationLockedSlotLedgerTokenV2,
  ): Promise<void>;

  closeOrAbortSession(disposition: "close" | "abort"): Promise<void>;
}

export interface PlatformReleaseBootstrapRegistryPhysicalActivationMechanicsDriverV2 {
  readonly mechanicsScope: typeof PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_MECHANICS_SCOPE_V2;
  readonly contractHash: string;
  readonly backendAbiHash: string;
  openFreshSession(): Promise<PlatformReleaseBootstrapRegistryPhysicalActivationSessionV2>;
}

export const PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_ACTION_METHOD_REFS_V2 =
  Object.freeze([
    "cleanupActivationStaging",
    "cleanupOrphanedActivationStaging",
    "cleanupOrphanedEpochStaging",
    "prepareAndPublishActivationClaim",
    "publishAndAcquireSharedLock",
    "publishGenesisEpochFloor",
    "publishActivationReceipt",
    "recoverEpochClaim",
    "removeActivationClaim",
    "resumeActivationStagingCleanup",
    "returnActivated",
    "closeWithoutMutation",
  ] as const);

export type PlatformReleaseBootstrapRegistryPhysicalActivationActionMethodV2 =
  (typeof PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_ACTION_METHOD_REFS_V2)[number];
