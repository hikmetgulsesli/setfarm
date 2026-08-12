import { z } from "zod";

import {
  canonicalJsonStringify,
  hashCanonicalJson,
} from "../../product-compiler/canonical-json.js";
import { Sha256Schema } from "../../product-compiler/schemas/common-v1.js";
import {
  PLATFORM_RELEASE_COMPONENT_VERSION_V2,
  boundedPlatformReleaseJsonSnapshotV2,
  deepFreezePlatformReleaseJsonV2,
  platformReleaseCandidateFitsCanonicalCapV2,
} from "./platform-release-common-v2.js";
import {
  PlatformReleaseBootstrapModuleExportProbeV2Schema,
  type PlatformReleaseBootstrapModuleExportProbeV2,
} from "./platform-release-bootstrap-module-export-probe-v2.js";
import {
  PlatformReleaseDependencyMaterializedPairInspectionV2Schema,
} from "./platform-release-dependency-materialized-pair-v2.js";
import {
  PlatformReleaseHostCompositionRuntimeAccountReceiptV2Schema,
} from "./platform-release-host-composition-v2.js";
import {
  PlatformReleaseRequiredModuleClosureV2Schema,
} from "./platform-release-required-module-closure-v2.js";
import {
  PlatformRuntimePayloadCandidateV2Schema,
} from "./platform-runtime-payload-v2.js";

export const PLATFORM_RELEASE_COMPOSITION_TEST_V2_SCHEMA =
  "setfarm.platform-release-composition-test.v2" as const;
export const PLATFORM_RELEASE_COMPOSITION_TEST_EVIDENCE_V2_SCHEMA =
  "setfarm.platform-release-composition-test-sealed-root-evidence.v2" as const;
export const PLATFORM_RELEASE_COMPOSITION_TEST_HASH_V2_SCHEMA =
  "setfarm.platform-release-composition-test-hash.v2" as const;
export const PLATFORM_RELEASE_COMPOSITION_TEST_EVIDENCE_HASH_V2_SCHEMA =
  "setfarm.platform-release-composition-test-evidence-hash.v2" as const;
export const PLATFORM_RELEASE_COMPOSITION_OWNERSHIP_TRANSFER_TEST_V2_SCHEMA =
  "setfarm.platform-release-composition-ownership-transfer-test.v2" as const;
export const PLATFORM_RELEASE_COMPOSITION_OWNERSHIP_TRANSFER_TEST_HASH_V2_SCHEMA =
  "setfarm.platform-release-composition-ownership-transfer-test-hash.v2" as const;
export const PLATFORM_RELEASE_COMPOSITION_MODULE_CLOSURE_TEST_V2_SCHEMA =
  "setfarm.platform-release-composition-module-closure-test.v2" as const;
export const PLATFORM_RELEASE_COMPOSITION_MODULE_CLOSURE_TEST_HASH_V2_SCHEMA =
  "setfarm.platform-release-composition-module-closure-test-hash.v2" as const;
export const PLATFORM_RELEASE_COMPOSITION_MODULE_EXPORTS_TEST_V2_SCHEMA =
  "setfarm.platform-release-composition-module-exports-test.v2" as const;
export const PLATFORM_RELEASE_COMPOSITION_MODULE_EXPORTS_TEST_HASH_V2_SCHEMA =
  "setfarm.platform-release-composition-module-exports-test-hash.v2" as const;
export const PLATFORM_RELEASE_COMPOSITION_MODULE_EXPORTS_TEST_MAX_CANONICAL_BYTES_V2 =
  8 * 1024 * 1024;
export const PLATFORM_RELEASE_COMPOSITION_TEST_MAX_CANONICAL_BYTES_V2 =
  4 * 1024 * 1024;
export const PLATFORM_RELEASE_COMPOSITION_TEST_MAX_CONTENT_BYTES_V2 =
  8 * 1024 * 1024;

const CanonicalDecimalV2Schema = z.string()
  .min(1)
  .max(80)
  .regex(/^(?:0|[1-9][0-9]*)$/u);
const CanonicalModeV2Schema = z.string().regex(/^[0-7]{4}$/u);

const StableDirectoryIdentityV2Schema = z.object({
  hostIdentityHash: Sha256Schema,
  objectKind: z.literal("directory"),
  device: CanonicalDecimalV2Schema,
  inode: CanonicalDecimalV2Schema,
}).strict();

const MutableDirectoryFingerprintV2Schema = z.object({
  ownerUid: z.number().int().nonnegative().safe().max(4_294_967_294),
  ownerGid: z.number().int().nonnegative().safe().max(4_294_967_294),
  mode: CanonicalModeV2Schema,
  linkCount: z.number().int().positive().safe(),
  byteLength: z.number().int().nonnegative().safe()
    .max(PLATFORM_RELEASE_COMPOSITION_TEST_MAX_CONTENT_BYTES_V2),
  contentHash: Sha256Schema,
  modifiedTimeNanoseconds: CanonicalDecimalV2Schema,
  changedTimeNanoseconds: CanonicalDecimalV2Schema,
}).strict();

const SealedRootPhysicalObservationV2Schema = z.object({
  stableIdentity: StableDirectoryIdentityV2Schema,
  mutableFingerprint: MutableDirectoryFingerprintV2Schema,
  observationHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  const { observationHash: _observationHash, ...identity } = value;
  if (value.observationHash !== hashPlatformReleaseCompositionTestObservationV2(identity)) {
    context.addIssue({
      code: "custom",
      path: ["observationHash"],
      message: "Sealed-root physical observation hash mismatch",
    });
  }
});

const SealDurabilityV2Schema = z.object({
  stageManifestFsync: z.literal(true),
  sealedRootFsync: z.literal(true),
  releaseParentFsync: z.literal(true),
  attestationFsync: z.literal(true),
}).strict();

const SealedRootEvidenceIdentityV2Schema = z.object({
  schema: z.literal(PLATFORM_RELEASE_COMPOSITION_TEST_EVIDENCE_V2_SCHEMA),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  authorityState: z.literal("test_fixture_sealed_root_unverified"),
  admissionScope: z.literal("test_fixture"),
  productionAuthority: z.literal(false),
  productionAdmission: z.literal("forbidden"),
  credentialUse: z.literal("none"),
  signingAuthority: z.literal("unsigned_test_fixture"),
  evidenceOutcome: z.literal("sealed_root_observed_without_production_authority"),
  manifestPayloadHash: Sha256Schema,
  buildAttestationHash: Sha256Schema,
  runtimePayloadHash: Sha256Schema,
  outputTreeHash: Sha256Schema,
  sealedRootMembershipHash: Sha256Schema,
  manifestByteLength: z.number().int().positive().safe()
    .max(PLATFORM_RELEASE_COMPOSITION_TEST_MAX_CONTENT_BYTES_V2),
  buildAttestationByteLength: z.number().int().positive().safe()
    .max(PLATFORM_RELEASE_COMPOSITION_TEST_MAX_CONTENT_BYTES_V2),
  sealedRoot: SealedRootPhysicalObservationV2Schema,
  durability: SealDurabilityV2Schema,
  evidenceHash: Sha256Schema,
}).strict();

export function hashPlatformReleaseCompositionTestObservationV2(
  value: Readonly<Record<string, unknown>>,
): string {
  return hashCanonicalJson({
    schema: `${PLATFORM_RELEASE_COMPOSITION_TEST_EVIDENCE_V2_SCHEMA}.observation-hash.v2`,
    observation: value,
  });
}

export function hashPlatformReleaseCompositionTestEvidenceV2(
  value: Readonly<Record<string, unknown>>,
): string {
  const evidence = { ...value } as Record<string, unknown>;
  delete evidence.evidenceHash;
  return hashCanonicalJson({
    schema: PLATFORM_RELEASE_COMPOSITION_TEST_EVIDENCE_HASH_V2_SCHEMA,
    evidence,
  });
}

const SealedRootEvidenceV2Schema = SealedRootEvidenceIdentityV2Schema
  .superRefine((value, context) => {
    if (value.evidenceHash !== hashPlatformReleaseCompositionTestEvidenceV2(value)) {
      context.addIssue({
        code: "custom",
        path: ["evidenceHash"],
        message: "Sealed-root evidence hash mismatch",
      });
    }
    if (value.sealedRoot.mutableFingerprint.mode !== "0555") {
      context.addIssue({
        code: "custom",
        path: ["sealedRoot", "mutableFingerprint", "mode"],
        message: "Sealed release root must be read-only",
      });
    }
  });

export const PLATFORM_RELEASE_COMPOSITION_TEST_LIFECYCLE_V2 = [
  "pair_ready",
  "pair_consuming",
  "terminalizing",
  "selected_root_owned",
  "predecessors_consumed",
  "release_completed",
] as const;

const CompositionLifecycleV2Schema = z.tuple([
  z.literal("pair_ready"),
  z.literal("pair_consuming"),
  z.literal("terminalizing"),
  z.literal("selected_root_owned"),
  z.literal("predecessors_consumed"),
  z.literal("release_completed"),
]);

const CompositionTransactionIdentityV2Schema = z.object({
  schema: z.literal(PLATFORM_RELEASE_COMPOSITION_TEST_V2_SCHEMA),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  authorityState: z.literal("test_fixture_composition_unverified"),
  admissionScope: z.literal("test_fixture"),
  productionAuthority: z.literal(false),
  productionAdmission: z.literal("forbidden"),
  credentialUse: z.literal("none"),
  signingAuthority: z.literal("unsigned_test_fixture"),
  operationMode: z.literal("test_fixture_composition_contract_only"),
  pairLifecycle: CompositionLifecycleV2Schema,
  selectedOccurrence: z.enum(["first", "second"]),
  ownershipTransfer: z.literal("selected_root_transferred_predecessors_consumed"),
  predecessorTombstone: z.literal("pathless_release_completed_tombstone"),
  sealedRootEvidence: SealedRootEvidenceV2Schema,
  transactionHash: Sha256Schema,
}).strict();

export function hashPlatformReleaseCompositionTestV2(
  value: Readonly<Record<string, unknown>>,
): string {
  const transaction = { ...value } as Record<string, unknown>;
  delete transaction.transactionHash;
  return hashCanonicalJson({
    schema: PLATFORM_RELEASE_COMPOSITION_TEST_HASH_V2_SCHEMA,
    transaction,
  });
}

export const PlatformReleaseCompositionTestV2Schema =
  CompositionTransactionIdentityV2Schema.superRefine((value, context) => {
    if (value.transactionHash !== hashPlatformReleaseCompositionTestV2(value)) {
      context.addIssue({
        code: "custom",
        path: ["transactionHash"],
        message: "Composition transaction hash mismatch",
      });
    }
    if (value.sealedRootEvidence.productionAuthority !== value.productionAuthority
        || value.sealedRootEvidence.admissionScope !== value.admissionScope) {
      context.addIssue({
        code: "custom",
        path: ["sealedRootEvidence"],
        message: "Sealed-root evidence must remain inside the transaction test boundary",
      });
    }
    if (!platformReleaseCandidateFitsCanonicalCapV2(
      value,
      PLATFORM_RELEASE_COMPOSITION_TEST_MAX_CANONICAL_BYTES_V2,
    )) {
      context.addIssue({
        code: "custom",
        message: "Composition transaction exceeds its canonical byte cap",
      });
    }
  });

export type PlatformReleaseCompositionTestSealedRootEvidenceV2 = z.infer<
  typeof SealedRootEvidenceV2Schema
>;

export type PlatformReleaseCompositionTestV2 = z.infer<
  typeof PlatformReleaseCompositionTestV2Schema
>;

export function parsePlatformReleaseCompositionTestSealedRootEvidenceV2(
  input: unknown,
): PlatformReleaseCompositionTestSealedRootEvidenceV2 {
  const snapshot = boundedPlatformReleaseJsonSnapshotV2(
    input,
    PLATFORM_RELEASE_COMPOSITION_TEST_MAX_CANONICAL_BYTES_V2,
  );
  return deepFreezePlatformReleaseJsonV2(
    SealedRootEvidenceV2Schema.parse(snapshot),
  );
}

export function parsePlatformReleaseCompositionTestCandidateV2(
  input: unknown,
): PlatformReleaseCompositionTestV2 {
  const snapshot = boundedPlatformReleaseJsonSnapshotV2(
    input,
    PLATFORM_RELEASE_COMPOSITION_TEST_MAX_CANONICAL_BYTES_V2,
  );
  return deepFreezePlatformReleaseJsonV2(
    PlatformReleaseCompositionTestV2Schema.parse(snapshot),
  );
}

export function platformReleaseCompositionTestCanonicalStringifyV2(
  value: unknown,
): string {
  return canonicalJsonStringify(value);
}

const OwnershipTransferMutableDirectoryFingerprintV2Schema = z.object({
  ownerUid: z.number().int().nonnegative().safe().max(4_294_967_294),
  ownerGid: z.number().int().nonnegative().safe().max(4_294_967_294),
  mode: z.literal("0700"),
  linkCount: z.number().int().positive().safe(),
  byteLength: z.number().int().nonnegative().safe()
    .max(PLATFORM_RELEASE_COMPOSITION_TEST_MAX_CONTENT_BYTES_V2),
  modifiedTimeNanoseconds: CanonicalDecimalV2Schema,
  changedTimeNanoseconds: CanonicalDecimalV2Schema,
}).strict();

const OwnershipTransferDirectoryObservationIdentityV2Schema = z.object({
  stableIdentity: StableDirectoryIdentityV2Schema,
  mutableFingerprint:
    OwnershipTransferMutableDirectoryFingerprintV2Schema,
  membershipHash: Sha256Schema,
}).strict();

export function hashPlatformReleaseCompositionOwnershipTransferDirectoryObservationForTestV2(
  value: Readonly<Record<string, unknown>>,
): string {
  return hashCanonicalJson({
    schema:
      `${PLATFORM_RELEASE_COMPOSITION_OWNERSHIP_TRANSFER_TEST_V2_SCHEMA}.directory-observation-hash.v2`,
    observation: value,
  });
}

const OwnershipTransferDirectoryObservationV2Schema =
  OwnershipTransferDirectoryObservationIdentityV2Schema.extend({
    observationHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const { observationHash: _observationHash, ...identity } = value;
    if (
      value.observationHash
        !== hashPlatformReleaseCompositionOwnershipTransferDirectoryObservationForTestV2(
          identity,
        )
    ) {
      context.addIssue({
        code: "custom",
        path: ["observationHash"],
        message: "Ownership-transfer directory observation hash mismatch",
      });
    }
  });

const OwnershipTransferSelectedSlotIdentityV2Schema = z.object({
  privateParent: OwnershipTransferDirectoryObservationV2Schema,
  outputRoot: OwnershipTransferDirectoryObservationV2Schema,
}).strict();

export function hashPlatformReleaseCompositionOwnershipTransferSlotForTestV2(
  value: Readonly<Record<string, unknown>>,
): string {
  return hashCanonicalJson({
    schema:
      `${PLATFORM_RELEASE_COMPOSITION_OWNERSHIP_TRANSFER_TEST_V2_SCHEMA}.selected-slot-hash.v2`,
    selectedSlot: value,
  });
}

const OwnershipTransferSelectedSlotV2Schema =
  OwnershipTransferSelectedSlotIdentityV2Schema.extend({
    slotHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const { slotHash: _slotHash, ...identity } = value;
    if (
      value.slotHash
        !== hashPlatformReleaseCompositionOwnershipTransferSlotForTestV2(
          identity,
        )
    ) {
      context.addIssue({
        code: "custom",
        path: ["slotHash"],
        message: "Ownership-transfer selected-slot hash mismatch",
      });
    }
    if (
      value.privateParent.stableIdentity.hostIdentityHash
        !== value.outputRoot.stableIdentity.hostIdentityHash
      || (
        value.privateParent.stableIdentity.device
          === value.outputRoot.stableIdentity.device
        && value.privateParent.stableIdentity.inode
          === value.outputRoot.stableIdentity.inode
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["outputRoot", "stableIdentity"],
        message:
          "Transferred parent and output must be distinct directories on one observed host",
      });
    }
  });

export const PLATFORM_RELEASE_COMPOSITION_OWNERSHIP_TRANSFER_TEST_LIFECYCLE_V2 =
  [
    "pair_ready",
    "pair_consuming",
    "selected_root_owned",
    "predecessors_consumed",
    "release_completed",
  ] as const;

const OwnershipTransferTestIdentityV2Schema = z.object({
  schema: z.literal(
    PLATFORM_RELEASE_COMPOSITION_OWNERSHIP_TRANSFER_TEST_V2_SCHEMA,
  ),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  authorityState: z.literal(
    "test_fixture_ownership_transfer_unverified",
  ),
  admissionScope: z.literal("test_fixture"),
  productionAuthority: z.literal(false),
  productionAdmission: z.literal("forbidden"),
  productionUse: z.literal(
    "forbidden_until_authenticated_composition_and_fresh_verification",
  ),
  credentialUse: z.literal("none"),
  mutationAuthority: z.literal(false),
  trustConclusion: z.literal("characterization_only"),
  operationMode: z.literal(
    "test_fixture_pair_slot_ownership_transfer_rehearsal",
  ),
  pairLifecycle: z.tuple([
    z.literal("pair_ready"),
    z.literal("pair_consuming"),
    z.literal("selected_root_owned"),
    z.literal("predecessors_consumed"),
    z.literal("release_completed"),
  ]),
  selectedOccurrence: z.literal("first"),
  ownershipTransfer: z.literal(
    "selected_slot_transferred_to_test_handle",
  ),
  predecessorTombstone: z.literal(
    "pathless_release_completed_tombstone",
  ),
  terminalizationState: z.literal(
    "not_performed_manifest_attestation_still_required",
  ),
  dependencyPairInspectionHash: Sha256Schema,
  sourceBindingHash: Sha256Schema,
  stableOutputBindingHash: Sha256Schema,
  selectedSlot: OwnershipTransferSelectedSlotV2Schema,
  discardedOccurrenceCleanup: z.literal(
    "second_output_exactly_removed_before_completion",
  ),
  sourceContextCleanup: z.literal(
    "source_and_toolchain_context_exactly_removed_before_completion",
  ),
}).strict();

export function hashPlatformReleaseCompositionOwnershipTransferForTestV2(
  value: Readonly<Record<string, unknown>>,
): string {
  const transaction = { ...value } as Record<string, unknown>;
  delete transaction.transactionHash;
  return hashCanonicalJson({
    schema:
      PLATFORM_RELEASE_COMPOSITION_OWNERSHIP_TRANSFER_TEST_HASH_V2_SCHEMA,
    transaction,
  });
}

export const PlatformReleaseCompositionOwnershipTransferForTestV2Schema =
  OwnershipTransferTestIdentityV2Schema.extend({
    transactionHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (
      value.transactionHash
        !== hashPlatformReleaseCompositionOwnershipTransferForTestV2(value)
    ) {
      context.addIssue({
        code: "custom",
        path: ["transactionHash"],
        message: "Ownership-transfer rehearsal transaction hash mismatch",
      });
    }
    if (
      !platformReleaseCandidateFitsCanonicalCapV2(
        value,
        PLATFORM_RELEASE_COMPOSITION_TEST_MAX_CANONICAL_BYTES_V2,
      )
    ) {
      context.addIssue({
        code: "custom",
        message: "Ownership-transfer rehearsal exceeds its canonical byte cap",
      });
    }
  });

export type PlatformReleaseCompositionOwnershipTransferForTestV2Inspection =
  z.infer<
    typeof PlatformReleaseCompositionOwnershipTransferForTestV2Schema
  >;

export function parsePlatformReleaseCompositionOwnershipTransferForTestV2(
  input: unknown,
): PlatformReleaseCompositionOwnershipTransferForTestV2Inspection {
  const snapshot = boundedPlatformReleaseJsonSnapshotV2(
    input,
    PLATFORM_RELEASE_COMPOSITION_TEST_MAX_CANONICAL_BYTES_V2,
  );
  return deepFreezePlatformReleaseJsonV2(
    PlatformReleaseCompositionOwnershipTransferForTestV2Schema.parse(
      snapshot,
    ),
  );
}

const CompositionModuleClosureStableOutputV2Schema = z.object({
  predependencyOutputBindingHash: Sha256Schema,
  dependencyOutputBindingHash: Sha256Schema,
  distTreeHash: Sha256Schema,
  dependencyTreeHash: Sha256Schema,
  packageContentHash: Sha256Schema,
}).strict();

const CompositionModuleClosureOccurrenceV2Schema = z.object({
  stageRef: z.enum([
    "PLATFORM_RELEASE_BUILD_STAGE_FIRST_V2",
    "PLATFORM_RELEASE_BUILD_STAGE_SECOND_V2",
  ]),
  outputStagePhysicalIdentityHash: Sha256Schema,
  moduleSetHash: Sha256Schema,
}).strict();

export function hashPlatformReleaseCompositionModuleSetForTestV2(
  modules: readonly unknown[],
): string {
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-composition-module-set-hash.v2",
    modules,
  });
}

const CompositionModuleClosureTestIdentityV2Schema = z.object({
  schema: z.literal(
    PLATFORM_RELEASE_COMPOSITION_MODULE_CLOSURE_TEST_V2_SCHEMA,
  ),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  authorityState: z.literal(
    "test_fixture_module_closure_unverified",
  ),
  admissionScope: z.literal("test_fixture"),
  productionAuthority: z.literal(false),
  productionAdmission: z.literal("forbidden"),
  productionUse: z.literal(
    "forbidden_until_fresh_module_export_receipts_and_verified_release",
  ),
  credentialUse: z.literal("none"),
  mutationAuthority: z.literal(false),
  trustConclusion: z.literal("characterization_only"),
  operationMode: z.literal(
    "authentic_dependency_pair_zero_caller_runtime_payload_and_required_module_closure_derivation",
  ),
  callerJsonState: z.literal("absent"),
  terminalizationState: z.literal(
    "not_performed_module_exports_manifest_and_attestation_still_required",
  ),
  dependencyPairInspectionHash: Sha256Schema,
  dependencyPair:
    PlatformReleaseDependencyMaterializedPairInspectionV2Schema,
  sourceBindingHash: Sha256Schema,
  hostCompositionReceiptHash: Sha256Schema,
  runtimeAccountReceiptHash: Sha256Schema,
  hostRuntimeAccount:
    PlatformReleaseHostCompositionRuntimeAccountReceiptV2Schema,
  stableOutput: CompositionModuleClosureStableOutputV2Schema,
  runtimePayload: PlatformRuntimePayloadCandidateV2Schema,
  requiredModuleClosure:
    PlatformReleaseRequiredModuleClosureV2Schema,
  occurrences: z.tuple([
    CompositionModuleClosureOccurrenceV2Schema.extend({
      stageRef: z.literal(
        "PLATFORM_RELEASE_BUILD_STAGE_FIRST_V2",
      ),
    }).strict(),
    CompositionModuleClosureOccurrenceV2Schema.extend({
      stageRef: z.literal(
        "PLATFORM_RELEASE_BUILD_STAGE_SECOND_V2",
      ),
    }).strict(),
  ]),
  equalityState: z.literal(
    "independent_physical_dist_trees_with_equal_code_owned_module_refs",
  ),
}).strict().superRefine((value, context) => {
  if (
    value.dependencyPairInspectionHash
      !== value.dependencyPair.inspectionHash
    || value.sourceBindingHash
      !== value.dependencyPair.sourceBindingHash
    || value.stableOutput.predependencyOutputBindingHash
      !== value.dependencyPair.compiledOutputPair
        .stableOutput.bindingHash
    || value.stableOutput.dependencyOutputBindingHash
      !== value.dependencyPair.stableOutput.bindingHash
    || value.stableOutput.distTreeHash
      !== value.dependencyPair.stableOutput.distTreeHash
    || value.stableOutput.dependencyTreeHash
      !== value.dependencyPair.stableOutput.dependencyTree.treeHash
    || value.stableOutput.packageContentHash
      !== value.dependencyPair.stableOutput.packageContentHash
  ) {
    context.addIssue({
      code: "custom",
      path: ["dependencyPair"],
      message:
        "Module-closure derivation must embed and exactly project its authentic dependency-pair inspection",
    });
  }
  if (
    value.runtimeAccountReceiptHash
      !== value.hostRuntimeAccount.receiptHash
    || value.runtimePayload.ownership.runtimeUid
      !== value.hostRuntimeAccount.uid
  ) {
    context.addIssue({
      code: "custom",
      path: ["hostRuntimeAccount"],
      message:
        "Runtime payload ownership must project the authenticated host runtime account receipt",
    });
  }
  if (
    value.runtimePayload.platformTree.treeHash
      !== value.stableOutput.distTreeHash
    || value.runtimePayload.dependencyTree.treeHash
      !== value.stableOutput.dependencyTreeHash
    || value.runtimePayload.packageJson.hash
      !== value.stableOutput.packageContentHash
    || value.requiredModuleClosure.platformTreeHash
      !== value.runtimePayload.platformTree.treeHash
    || value.requiredModuleClosure.runtimePayloadHash
      !== value.runtimePayload.runtimePayloadHash
  ) {
    context.addIssue({
      code: "custom",
      path: ["runtimePayload"],
      message:
        "Derived runtime payload, stable pair output and required module closure must form one exact hash join",
    });
  }
  const [first, second] = value.occurrences;
  const expectedModuleSetHash =
    hashPlatformReleaseCompositionModuleSetForTestV2(
      value.requiredModuleClosure.entries.map(
        (entry) => entry.module,
      ),
    );
  if (
    first.outputStagePhysicalIdentityHash
      === second.outputStagePhysicalIdentityHash
    || first.moduleSetHash !== second.moduleSetHash
    || first.moduleSetHash !== expectedModuleSetHash
    || first.outputStagePhysicalIdentityHash
      !== value.dependencyPair.compiledOutputPair
        .occurrences[0].outputStagePhysicalIdentityHash
    || second.outputStagePhysicalIdentityHash
      !== value.dependencyPair.compiledOutputPair
        .occurrences[1].outputStagePhysicalIdentityHash
  ) {
    context.addIssue({
      code: "custom",
      path: ["occurrences"],
      message:
        "Module closure occurrences must be physically independent and canonically byte-equal",
    });
  }
});

export function hashPlatformReleaseCompositionModuleClosureForTestV2(
  value: Readonly<Record<string, unknown>>,
): string {
  const derivation = { ...value } as Record<string, unknown>;
  delete derivation.derivationHash;
  return hashCanonicalJson({
    schema:
      PLATFORM_RELEASE_COMPOSITION_MODULE_CLOSURE_TEST_HASH_V2_SCHEMA,
    derivation,
  });
}

export const PlatformReleaseCompositionModuleClosureForTestV2Schema =
  CompositionModuleClosureTestIdentityV2Schema.extend({
    derivationHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (
      value.derivationHash
        !== hashPlatformReleaseCompositionModuleClosureForTestV2(
          value,
        )
    ) {
      context.addIssue({
        code: "custom",
        path: ["derivationHash"],
        message: "Module-closure derivation hash mismatch",
      });
    }
    if (
      !platformReleaseCandidateFitsCanonicalCapV2(
        value,
        PLATFORM_RELEASE_COMPOSITION_TEST_MAX_CANONICAL_BYTES_V2,
      )
    ) {
      context.addIssue({
        code: "custom",
        message: "Module-closure derivation exceeds its canonical byte cap",
      });
    }
  });

export type PlatformReleaseCompositionModuleClosureForTestV2Inspection =
  z.infer<
    typeof PlatformReleaseCompositionModuleClosureForTestV2Schema
  >;

export function parsePlatformReleaseCompositionModuleClosureForTestV2(
  input: unknown,
): PlatformReleaseCompositionModuleClosureForTestV2Inspection {
  const snapshot = boundedPlatformReleaseJsonSnapshotV2(
    input,
    PLATFORM_RELEASE_COMPOSITION_TEST_MAX_CANONICAL_BYTES_V2,
  );
  return deepFreezePlatformReleaseJsonV2(
    PlatformReleaseCompositionModuleClosureForTestV2Schema.parse(
      snapshot,
    ),
  );
}

export function hashPlatformReleaseCompositionModuleExportStableSetForTestV2(
  probes: readonly PlatformReleaseBootstrapModuleExportProbeV2[],
): string {
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-composition-module-export-stable-set-hash.v2",
    probes: probes.map((probe) => ({
      moduleRefHash: probe.moduleRef.moduleRefHash,
      stableProjectionHash: probe.stableProjectionHash,
    })),
  });
}

const CompositionModuleExportsTestIdentityV2Schema = z.object({
  schema: z.literal(
    PLATFORM_RELEASE_COMPOSITION_MODULE_EXPORTS_TEST_V2_SCHEMA,
  ),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  authorityState: z.literal(
    "test_fixture_module_exports_observed_unverified",
  ),
  admissionScope: z.literal("test_fixture"),
  productionAuthority: z.literal(false),
  productionAdmission: z.literal("forbidden"),
  productionUse: z.literal(
    "forbidden_until_authenticated_installed_probe_and_verified_release",
  ),
  credentialUse: z.literal("none"),
  mutationAuthority: z.literal(false),
  trustConclusion: z.literal("characterization_only"),
  operationMode: z.literal(
    "authentic_dependency_pair_zero_caller_dual_occurrence_required_export_observation",
  ),
  operationExecutionState: z.literal(
    "authenticated_test_host_composition_fixed_abi_fd3_isolated_observer_child",
  ),
  callerJsonState: z.literal("absent"),
  pairLeaseState: z.literal(
    "exclusive_probe_claim_released_after_fresh_post_fence",
  ),
  terminalizationState: z.literal(
    "not_performed_manifest_and_attestation_still_required",
  ),
  dependencyPairInspectionHash: Sha256Schema,
  moduleClosureDerivation:
    PlatformReleaseCompositionModuleClosureForTestV2Schema,
  probes: z.array(
    PlatformReleaseBootstrapModuleExportProbeV2Schema,
  ).length(17),
  stableProjectionSetHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  if (
    value.dependencyPairInspectionHash
      !== value.moduleClosureDerivation
        .dependencyPairInspectionHash
  ) {
    context.addIssue({
      code: "custom",
      path: ["moduleClosureDerivation"],
      message:
        "Module-export observations must embed their exact authentic pair-derived closure",
    });
  }
  const entries =
    value.moduleClosureDerivation.requiredModuleClosure.entries;
  for (const [index, probe] of value.probes.entries()) {
    const entry = entries[index];
    if (
      !entry
      || canonicalJsonStringify(probe.moduleRef)
        !== canonicalJsonStringify(entry.module)
      || canonicalJsonStringify(probe.requiredExports)
        !== canonicalJsonStringify(
          entry.definition.requiredExports,
        )
      || probe.hostCompositionReceiptHash
        !== value.moduleClosureDerivation
          .hostCompositionReceiptHash
      || probe.productionAuthority !== false
      || probe.productionAdmission !== "forbidden"
      || probe.mutationAuthority !== false
    ) {
      context.addIssue({
        code: "custom",
        path: ["probes", index],
        message:
          "Every module probe must exactly project one ordered closure definition and remain false authority",
      });
    }
  }
  if (
    new Set(
      value.probes.map((probe) => probe.challengeHash),
    ).size !== value.probes.length
    || value.stableProjectionSetHash
      !== hashPlatformReleaseCompositionModuleExportStableSetForTestV2(
        value.probes,
      )
  ) {
    context.addIssue({
      code: "custom",
      path: ["stableProjectionSetHash"],
      message:
        "Module probes must carry unique challenges and one exact ordered stable projection set",
    });
  }
});

export function hashPlatformReleaseCompositionModuleExportsForTestV2(
  value: Readonly<Record<string, unknown>>,
): string {
  const collection = { ...value } as Record<string, unknown>;
  delete collection.collectionHash;
  return hashCanonicalJson({
    schema:
      PLATFORM_RELEASE_COMPOSITION_MODULE_EXPORTS_TEST_HASH_V2_SCHEMA,
    collection,
  });
}

export const PlatformReleaseCompositionModuleExportsForTestV2Schema =
  CompositionModuleExportsTestIdentityV2Schema.extend({
    collectionHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (
      value.collectionHash
        !== hashPlatformReleaseCompositionModuleExportsForTestV2(
          value,
        )
      || !platformReleaseCandidateFitsCanonicalCapV2(
        value,
        PLATFORM_RELEASE_COMPOSITION_MODULE_EXPORTS_TEST_MAX_CANONICAL_BYTES_V2,
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["collectionHash"],
        message:
          "Module-export collection must remain bounded and bind every observation",
      });
    }
  });

export type PlatformReleaseCompositionModuleExportsForTestV2Inspection =
  z.infer<
    typeof PlatformReleaseCompositionModuleExportsForTestV2Schema
  >;

export function parsePlatformReleaseCompositionModuleExportsForTestV2(
  input: unknown,
): PlatformReleaseCompositionModuleExportsForTestV2Inspection {
  const snapshot = boundedPlatformReleaseJsonSnapshotV2(
    input,
    PLATFORM_RELEASE_COMPOSITION_MODULE_EXPORTS_TEST_MAX_CANONICAL_BYTES_V2,
  );
  return deepFreezePlatformReleaseJsonV2(
    PlatformReleaseCompositionModuleExportsForTestV2Schema.parse(
      snapshot,
    ),
  );
}
