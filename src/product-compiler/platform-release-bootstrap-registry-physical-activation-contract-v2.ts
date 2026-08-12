import { z } from "zod";

import { PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_ABI_SET_V2 } from "../execution/schemas/platform-release-bootstrap-darwin-filesystem-backend-v2.js";
import {
  PLATFORM_RELEASE_COMPONENT_VERSION_V2,
  boundedPlatformReleaseJsonSnapshotV2,
  deepFreezePlatformReleaseJsonV2,
  platformReleaseCandidateFitsCanonicalCapV2,
} from "../execution/schemas/platform-release-common-v2.js";
import { canonicalJsonStringify, hashCanonicalJson } from "./canonical-json.js";
import { PlatformReleaseBootstrapRegistryActivationNextActionV2Schema } from "./platform-release-bootstrap-registry-activation-v2.js";
import { PLATFORM_RELEASE_BOOTSTRAP_NAMESPACE_CENSUS_MAX_ENTRIES_V2 } from "./platform-release-bootstrap-registry-v2.js";
import { Sha256Schema } from "./schemas/common-v1.js";

export const PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_CONTRACT_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-registry-physical-activation-contract.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_CONTRACT_MAX_CANONICAL_BYTES_V2 =
  256 * 1024;
export const PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_MAX_ROUNDS_V2 = 32;
export const PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_MAX_NO_PROGRESS_REPLAYS_V2 = 2;
export const PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_RESERVED_SESSION_OPERATIONS_V2 = 512;

const PhysicalActionMutationClassV2Schema = z.enum([
  "closed_crash_microprotocol",
  "none",
]);

const PhysicalActionProtocolV2Schema = z
  .object({
    nextAction: PlatformReleaseBootstrapRegistryActivationNextActionV2Schema,
    methodRef: z
      .string()
      .min(1)
      .max(100)
      .regex(/^[a-z][A-Za-z0-9]*$/),
    mutationClass: PhysicalActionMutationClassV2Schema,
    replayPolicy: z.enum([
      "fresh_reobserve_only_v2",
      "return_after_final_locked_reobserve_v2",
    ]),
  })
  .strict();

const exactActionProtocolsV2 = Object.freeze([
  {
    nextAction: "cleanup_activation_staging",
    methodRef: "cleanupActivationStaging",
    mutationClass: "closed_crash_microprotocol",
    replayPolicy: "fresh_reobserve_only_v2",
  },
  {
    nextAction: "cleanup_orphaned_activation_staging",
    methodRef: "cleanupOrphanedActivationStaging",
    mutationClass: "closed_crash_microprotocol",
    replayPolicy: "fresh_reobserve_only_v2",
  },
  {
    nextAction: "cleanup_orphaned_epoch_staging",
    methodRef: "cleanupOrphanedEpochStaging",
    mutationClass: "closed_crash_microprotocol",
    replayPolicy: "fresh_reobserve_only_v2",
  },
  {
    nextAction: "prepare_and_publish_activation_claim",
    methodRef: "prepareAndPublishActivationClaim",
    mutationClass: "closed_crash_microprotocol",
    replayPolicy: "fresh_reobserve_only_v2",
  },
  {
    nextAction: "publish_and_acquire_shared_lock",
    methodRef: "publishAndAcquireSharedLock",
    mutationClass: "closed_crash_microprotocol",
    replayPolicy: "fresh_reobserve_only_v2",
  },
  {
    nextAction: "publish_genesis_epoch_floor",
    methodRef: "publishGenesisEpochFloor",
    mutationClass: "closed_crash_microprotocol",
    replayPolicy: "fresh_reobserve_only_v2",
  },
  {
    nextAction: "publish_activation_receipt",
    methodRef: "publishActivationReceipt",
    mutationClass: "closed_crash_microprotocol",
    replayPolicy: "fresh_reobserve_only_v2",
  },
  {
    nextAction: "recover_epoch_claim",
    methodRef: "recoverEpochClaim",
    mutationClass: "closed_crash_microprotocol",
    replayPolicy: "fresh_reobserve_only_v2",
  },
  {
    nextAction: "remove_activation_claim",
    methodRef: "removeActivationClaim",
    mutationClass: "closed_crash_microprotocol",
    replayPolicy: "fresh_reobserve_only_v2",
  },
  {
    nextAction: "resume_activation_staging_cleanup",
    methodRef: "resumeActivationStagingCleanup",
    mutationClass: "closed_crash_microprotocol",
    replayPolicy: "fresh_reobserve_only_v2",
  },
  {
    nextAction: "return_activated",
    methodRef: "returnActivated",
    mutationClass: "none",
    replayPolicy: "return_after_final_locked_reobserve_v2",
  },
  {
    nextAction: "no_mutation",
    methodRef: "closeWithoutMutation",
    mutationClass: "none",
    replayPolicy: "fresh_reobserve_only_v2",
  },
] as const);

const PhysicalActivationContractIdentityV2Schema = z
  .object({
    schema: z.literal(
      PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_CONTRACT_V2_SCHEMA,
    ),
    version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
    productionUse: z.literal(
      "forbidden_until_authenticated_native_driver_exists_node_fixture_never_authority_v2",
    ),
    backendAbiHash: z.literal(
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_ABI_SET_V2.backendAbiHash,
    ),
    wireContractCatalogHash: z.literal(
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_ABI_SET_V2.wireContractCatalogHash,
    ),
    roundPolicy: z.literal(
      "fresh_session_observe_plan_lock_revalidate_reobserve_one_action_revalidate_close_v2",
    ),
    lockPolicy: z.literal(
      "reducer_exact_lock_vector_rederived_under_held_locks_v2",
    ),
    planAuthorityPolicy: z.literal(
      "public_plan_is_audit_evidence_private_slot_ledger_is_mutation_authority_v2",
    ),
    uncertaintyPolicy: z.literal(
      "irreversible_error_closes_session_then_exact_fresh_reobserve_v2",
    ),
    cooperativeImportPolicy: z.literal(
      "node_fs_path_callbacks_and_cooperative_modules_forbidden_v2",
    ),
    maxRounds: z.literal(
      PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_MAX_ROUNDS_V2,
    ),
    maxNoProgressReplays: z.literal(
      PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_MAX_NO_PROGRESS_REPLAYS_V2,
    ),
    maxNamespaceEntries: z.literal(
      PLATFORM_RELEASE_BOOTSTRAP_NAMESPACE_CENSUS_MAX_ENTRIES_V2,
    ),
    reservedSessionOperations: z.literal(
      PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_RESERVED_SESSION_OPERATIONS_V2,
    ),
    backendMaxOperationsPerSession: z.literal(
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_ABI_SET_V2.maxOperationsPerSession,
    ),
    actionCount: z.literal(exactActionProtocolsV2.length),
    actionProtocols: z
      .array(PhysicalActionProtocolV2Schema)
      .length(exactActionProtocolsV2.length),
  })
  .strict();

const exactContractIdentityV2 = {
  schema:
    PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_CONTRACT_V2_SCHEMA,
  version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
  productionUse:
    "forbidden_until_authenticated_native_driver_exists_node_fixture_never_authority_v2",
  backendAbiHash:
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_ABI_SET_V2.backendAbiHash,
  wireContractCatalogHash:
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_ABI_SET_V2.wireContractCatalogHash,
  roundPolicy:
    "fresh_session_observe_plan_lock_revalidate_reobserve_one_action_revalidate_close_v2",
  lockPolicy: "reducer_exact_lock_vector_rederived_under_held_locks_v2",
  planAuthorityPolicy:
    "public_plan_is_audit_evidence_private_slot_ledger_is_mutation_authority_v2",
  uncertaintyPolicy:
    "irreversible_error_closes_session_then_exact_fresh_reobserve_v2",
  cooperativeImportPolicy:
    "node_fs_path_callbacks_and_cooperative_modules_forbidden_v2",
  maxRounds:
    PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_MAX_ROUNDS_V2,
  maxNoProgressReplays:
    PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_MAX_NO_PROGRESS_REPLAYS_V2,
  maxNamespaceEntries:
    PLATFORM_RELEASE_BOOTSTRAP_NAMESPACE_CENSUS_MAX_ENTRIES_V2,
  reservedSessionOperations:
    PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_RESERVED_SESSION_OPERATIONS_V2,
  backendMaxOperationsPerSession:
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_ABI_SET_V2.maxOperationsPerSession,
  actionCount: exactActionProtocolsV2.length,
  actionProtocols: exactActionProtocolsV2.map((entry) => ({ ...entry })),
} as const;

export function hashPlatformReleaseBootstrapRegistryPhysicalActivationContractV2(
  value: Readonly<Record<string, unknown>>,
): string {
  const contract = { ...value };
  delete contract.contractHash;
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-bootstrap-registry-physical-activation-contract-hash.v2",
    contract,
  });
}

let exactContractCanonicalV2: string | undefined;

export const PlatformReleaseBootstrapRegistryPhysicalActivationContractV2Schema =
  PhysicalActivationContractIdentityV2Schema.extend({
    contractHash: Sha256Schema,
  })
    .strict()
    .superRefine((value, context) => {
      if (
        !platformReleaseCandidateFitsCanonicalCapV2(
          value,
          PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_CONTRACT_MAX_CANONICAL_BYTES_V2,
        ) ||
        value.backendMaxOperationsPerSession <
          value.maxNamespaceEntries + value.reservedSessionOperations ||
        new Set(value.actionProtocols.map((entry) => entry.nextAction)).size !==
          value.actionCount ||
        (exactContractCanonicalV2 !== undefined &&
          canonicalJsonStringify(value) !== exactContractCanonicalV2) ||
        value.contractHash !==
          hashPlatformReleaseBootstrapRegistryPhysicalActivationContractV2(
            value,
          )
      ) {
        context.addIssue({
          code: "custom",
          path: ["contractHash"],
          message:
            "Physical activation contract must equal the exact bounded code-owned protocol",
        });
      }
    });

export type PlatformReleaseBootstrapRegistryPhysicalActivationContractV2 =
  z.infer<
    typeof PlatformReleaseBootstrapRegistryPhysicalActivationContractV2Schema
  >;

const parsedExactContractV2 =
  PlatformReleaseBootstrapRegistryPhysicalActivationContractV2Schema.parse({
    ...exactContractIdentityV2,
    contractHash:
      hashPlatformReleaseBootstrapRegistryPhysicalActivationContractV2(
        exactContractIdentityV2,
      ),
  });

exactContractCanonicalV2 = canonicalJsonStringify(parsedExactContractV2);

export const PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_CONTRACT_V2: PlatformReleaseBootstrapRegistryPhysicalActivationContractV2 =
  deepFreezePlatformReleaseJsonV2(parsedExactContractV2);

export function getPlatformReleaseBootstrapRegistryPhysicalActivationContractV2(): PlatformReleaseBootstrapRegistryPhysicalActivationContractV2 {
  return deepFreezePlatformReleaseJsonV2(
    structuredClone(
      PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_CONTRACT_V2,
    ),
  );
}

export function parsePlatformReleaseBootstrapRegistryPhysicalActivationContractCandidateV2(
  input: unknown,
): PlatformReleaseBootstrapRegistryPhysicalActivationContractV2 {
  return deepFreezePlatformReleaseJsonV2(
    PlatformReleaseBootstrapRegistryPhysicalActivationContractV2Schema.parse(
      boundedPlatformReleaseJsonSnapshotV2(
        input,
        PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_CONTRACT_MAX_CANONICAL_BYTES_V2,
      ),
    ),
  );
}
