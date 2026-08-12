import { z } from "zod";

import {
  PLATFORM_RELEASE_COMPONENT_VERSION_V2,
  boundedPlatformReleaseJsonSnapshotV2,
  deepFreezePlatformReleaseJsonV2,
  platformReleaseCandidateFitsCanonicalCapV2,
} from "../execution/schemas/platform-release-common-v2.js";
import { PlatformReleaseBootstrapRegistryActivationNextActionV2Schema } from "./platform-release-bootstrap-registry-activation-v2.js";
import { PLATFORM_RELEASE_BOOTSTRAP_COOPERATIVE_CAPTURE_CAPABILITY_V2 } from "./platform-release-bootstrap-filesystem-capture-core-v2.js";
import { PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_CONTRACT_V2 } from "./platform-release-bootstrap-registry-physical-activation-contract-v2.js";
import { canonicalJsonStringify, hashCanonicalJson } from "./canonical-json.js";
import { Sha256Schema } from "./schemas/common-v1.js";

export const PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_NODE_FIXTURE_CONTRACT_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-registry-physical-activation-node-fixture-contract.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_NODE_FIXTURE_CONTRACT_MAX_CANONICAL_BYTES_V2 =
  128 * 1024;

const NodeFixtureCoverageV2Schema = z.enum([
  "exact_cooperative_mutation",
  "partial_cooperative_mutation",
  "terminal_mechanics_only",
  "unsupported",
]);

const NodeFixturePrimitiveRefV2Schema = z.enum([
  "ACTIVATION_MEMBER_PUBLICATION_V2",
  "EPOCH_STATE_PUBLICATION_V2",
]);

const NodeFixtureActionSpecificGapV2Schema = z.enum([
  "exact_activation_claim_unlink_and_parent_sync",
  "exact_epoch_claim_unlink_and_parent_sync",
  "exact_orphan_member_unlink_and_directory_removal",
  "exact_staging_directory_removal_and_parent_sync",
  "native_shared_lock_acquisition_and_retention",
  "staging_and_claim_creation_sync_publication",
]);

const NodeFixtureFullDriverBlockerV2Schema = z.enum([
  "aggregate_locked_namespace_observation",
  "authenticated_lock_acquisition_and_retention",
  "exact_absence_observation",
  "native_session_revalidation_and_reserve",
  "private_descriptor_slot_ledger",
]);

const NodeFixtureActionCoverageV2Schema = z
  .object({
    nextAction: PlatformReleaseBootstrapRegistryActivationNextActionV2Schema,
    methodRef: z
      .string()
      .min(1)
      .max(100)
      .regex(/^[a-z][A-Za-z0-9]*$/),
    coverage: NodeFixtureCoverageV2Schema,
    primitiveRefs: z.array(NodeFixturePrimitiveRefV2Schema).max(2),
    actionSpecificGaps: z.array(NodeFixtureActionSpecificGapV2Schema).max(4),
    fullSessionDriverEligible: z.literal(false),
  })
  .strict();

const exactNodeFixtureActionCoverageV2 = Object.freeze([
  {
    nextAction: "cleanup_activation_staging",
    methodRef: "cleanupActivationStaging",
    coverage: "partial_cooperative_mutation",
    primitiveRefs: ["ACTIVATION_MEMBER_PUBLICATION_V2"],
    actionSpecificGaps: ["exact_staging_directory_removal_and_parent_sync"],
    fullSessionDriverEligible: false,
  },
  {
    nextAction: "cleanup_orphaned_activation_staging",
    methodRef: "cleanupOrphanedActivationStaging",
    coverage: "unsupported",
    primitiveRefs: [],
    actionSpecificGaps: ["exact_orphan_member_unlink_and_directory_removal"],
    fullSessionDriverEligible: false,
  },
  {
    nextAction: "cleanup_orphaned_epoch_staging",
    methodRef: "cleanupOrphanedEpochStaging",
    coverage: "unsupported",
    primitiveRefs: [],
    actionSpecificGaps: ["exact_orphan_member_unlink_and_directory_removal"],
    fullSessionDriverEligible: false,
  },
  {
    nextAction: "prepare_and_publish_activation_claim",
    methodRef: "prepareAndPublishActivationClaim",
    coverage: "unsupported",
    primitiveRefs: [],
    actionSpecificGaps: ["staging_and_claim_creation_sync_publication"],
    fullSessionDriverEligible: false,
  },
  {
    nextAction: "publish_and_acquire_shared_lock",
    methodRef: "publishAndAcquireSharedLock",
    coverage: "partial_cooperative_mutation",
    primitiveRefs: ["ACTIVATION_MEMBER_PUBLICATION_V2"],
    actionSpecificGaps: ["native_shared_lock_acquisition_and_retention"],
    fullSessionDriverEligible: false,
  },
  {
    nextAction: "publish_genesis_epoch_floor",
    methodRef: "publishGenesisEpochFloor",
    coverage: "exact_cooperative_mutation",
    primitiveRefs: ["ACTIVATION_MEMBER_PUBLICATION_V2"],
    actionSpecificGaps: [],
    fullSessionDriverEligible: false,
  },
  {
    nextAction: "publish_activation_receipt",
    methodRef: "publishActivationReceipt",
    coverage: "exact_cooperative_mutation",
    primitiveRefs: ["ACTIVATION_MEMBER_PUBLICATION_V2"],
    actionSpecificGaps: [],
    fullSessionDriverEligible: false,
  },
  {
    nextAction: "recover_epoch_claim",
    methodRef: "recoverEpochClaim",
    coverage: "partial_cooperative_mutation",
    primitiveRefs: ["EPOCH_STATE_PUBLICATION_V2"],
    actionSpecificGaps: ["exact_epoch_claim_unlink_and_parent_sync"],
    fullSessionDriverEligible: false,
  },
  {
    nextAction: "remove_activation_claim",
    methodRef: "removeActivationClaim",
    coverage: "unsupported",
    primitiveRefs: [],
    actionSpecificGaps: ["exact_activation_claim_unlink_and_parent_sync"],
    fullSessionDriverEligible: false,
  },
  {
    nextAction: "resume_activation_staging_cleanup",
    methodRef: "resumeActivationStagingCleanup",
    coverage: "partial_cooperative_mutation",
    primitiveRefs: ["ACTIVATION_MEMBER_PUBLICATION_V2"],
    actionSpecificGaps: ["exact_staging_directory_removal_and_parent_sync"],
    fullSessionDriverEligible: false,
  },
  {
    nextAction: "return_activated",
    methodRef: "returnActivated",
    coverage: "terminal_mechanics_only",
    primitiveRefs: [],
    actionSpecificGaps: [],
    fullSessionDriverEligible: false,
  },
  {
    nextAction: "no_mutation",
    methodRef: "closeWithoutMutation",
    coverage: "terminal_mechanics_only",
    primitiveRefs: [],
    actionSpecificGaps: [],
    fullSessionDriverEligible: false,
  },
] as const);

const NodeFixtureContractIdentityV2Schema = z
  .object({
    schema: z.literal(
      PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_NODE_FIXTURE_CONTRACT_V2_SCHEMA,
    ),
    version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
    mechanicsCapability: z.literal(
      PLATFORM_RELEASE_BOOTSTRAP_COOPERATIVE_CAPTURE_CAPABILITY_V2,
    ),
    productionAuthority: z.literal(false),
    productionUse: z.literal("forbidden_partial_node_process_crash_fixture_v2"),
    physicalActivationContractHash: z.literal(
      PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_CONTRACT_V2.contractHash,
    ),
    fullSessionDriverAvailable: z.literal(false),
    fullDriverBlockers: z.array(NodeFixtureFullDriverBlockerV2Schema).length(5),
    exactCooperativeMutationCount: z.literal(2),
    terminalMechanicsCount: z.literal(2),
    partialOrUnsupportedMutationCount: z.literal(8),
    actionCount: z.literal(12),
    actionCoverage: z.array(NodeFixtureActionCoverageV2Schema).length(12),
  })
  .strict();

const exactNodeFixtureContractIdentityV2 = {
  schema:
    PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_NODE_FIXTURE_CONTRACT_V2_SCHEMA,
  version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
  mechanicsCapability:
    PLATFORM_RELEASE_BOOTSTRAP_COOPERATIVE_CAPTURE_CAPABILITY_V2,
  productionAuthority: false,
  productionUse: "forbidden_partial_node_process_crash_fixture_v2",
  physicalActivationContractHash:
    PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_CONTRACT_V2.contractHash,
  fullSessionDriverAvailable: false,
  fullDriverBlockers: [
    "aggregate_locked_namespace_observation",
    "authenticated_lock_acquisition_and_retention",
    "exact_absence_observation",
    "native_session_revalidation_and_reserve",
    "private_descriptor_slot_ledger",
  ],
  exactCooperativeMutationCount: 2,
  terminalMechanicsCount: 2,
  partialOrUnsupportedMutationCount: 8,
  actionCount: 12,
  actionCoverage: exactNodeFixtureActionCoverageV2.map((entry) => ({
    ...entry,
    primitiveRefs: [...entry.primitiveRefs],
    actionSpecificGaps: [...entry.actionSpecificGaps],
  })),
} as const;

export function hashPlatformReleaseBootstrapRegistryPhysicalActivationNodeFixtureContractV2(
  value: Readonly<Record<string, unknown>>,
): string {
  const contract = { ...value };
  delete contract.contractHash;
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-bootstrap-registry-physical-activation-node-fixture-contract-hash.v2",
    contract,
  });
}

let exactNodeFixtureContractCanonicalV2: string | undefined;

export const PlatformReleaseBootstrapRegistryPhysicalActivationNodeFixtureContractV2Schema =
  NodeFixtureContractIdentityV2Schema.extend({
    contractHash: Sha256Schema,
  })
    .strict()
    .superRefine((value, context) => {
      const exactMutations = value.actionCoverage.filter(
        (entry) => entry.coverage === "exact_cooperative_mutation",
      ).length;
      const terminalMechanics = value.actionCoverage.filter(
        (entry) => entry.coverage === "terminal_mechanics_only",
      ).length;
      const incompleteMutations = value.actionCoverage.filter(
        (entry) =>
          entry.coverage === "partial_cooperative_mutation" ||
          entry.coverage === "unsupported",
      ).length;
      if (
        !platformReleaseCandidateFitsCanonicalCapV2(
          value,
          PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_NODE_FIXTURE_CONTRACT_MAX_CANONICAL_BYTES_V2,
        ) ||
        new Set(value.actionCoverage.map((entry) => entry.nextAction)).size !==
          value.actionCount ||
        exactMutations !== value.exactCooperativeMutationCount ||
        terminalMechanics !== value.terminalMechanicsCount ||
        incompleteMutations !== value.partialOrUnsupportedMutationCount ||
        canonicalJsonStringify(
          value.actionCoverage.map((entry) => ({
            nextAction: entry.nextAction,
            methodRef: entry.methodRef,
          })),
        ) !==
          canonicalJsonStringify(
            PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_CONTRACT_V2.actionProtocols.map(
              (entry) => ({
                nextAction: entry.nextAction,
                methodRef: entry.methodRef,
              }),
            ),
          ) ||
        value.actionCoverage.some((entry) => entry.fullSessionDriverEligible) ||
        (exactNodeFixtureContractCanonicalV2 !== undefined &&
          canonicalJsonStringify(value) !==
            exactNodeFixtureContractCanonicalV2) ||
        value.contractHash !==
          hashPlatformReleaseBootstrapRegistryPhysicalActivationNodeFixtureContractV2(
            value,
          )
      ) {
        context.addIssue({
          code: "custom",
          path: ["contractHash"],
          message:
            "Node fixture contract must equal the exact non-promotable partial mechanics catalog",
        });
      }
    });

export type PlatformReleaseBootstrapRegistryPhysicalActivationNodeFixtureContractV2 =
  z.infer<
    typeof PlatformReleaseBootstrapRegistryPhysicalActivationNodeFixtureContractV2Schema
  >;

const parsedExactNodeFixtureContractV2 =
  PlatformReleaseBootstrapRegistryPhysicalActivationNodeFixtureContractV2Schema.parse(
    {
      ...exactNodeFixtureContractIdentityV2,
      contractHash:
        hashPlatformReleaseBootstrapRegistryPhysicalActivationNodeFixtureContractV2(
          exactNodeFixtureContractIdentityV2,
        ),
    },
  );

exactNodeFixtureContractCanonicalV2 = canonicalJsonStringify(
  parsedExactNodeFixtureContractV2,
);

export const PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_NODE_FIXTURE_CONTRACT_V2: PlatformReleaseBootstrapRegistryPhysicalActivationNodeFixtureContractV2 =
  deepFreezePlatformReleaseJsonV2(parsedExactNodeFixtureContractV2);

export function getPlatformReleaseBootstrapRegistryPhysicalActivationNodeFixtureContractV2(): PlatformReleaseBootstrapRegistryPhysicalActivationNodeFixtureContractV2 {
  return deepFreezePlatformReleaseJsonV2(
    structuredClone(
      PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_NODE_FIXTURE_CONTRACT_V2,
    ),
  );
}

export function parsePlatformReleaseBootstrapRegistryPhysicalActivationNodeFixtureContractCandidateV2(
  input: unknown,
): PlatformReleaseBootstrapRegistryPhysicalActivationNodeFixtureContractV2 {
  return deepFreezePlatformReleaseJsonV2(
    PlatformReleaseBootstrapRegistryPhysicalActivationNodeFixtureContractV2Schema.parse(
      boundedPlatformReleaseJsonSnapshotV2(
        input,
        PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_NODE_FIXTURE_CONTRACT_MAX_CANONICAL_BYTES_V2,
      ),
    ),
  );
}
