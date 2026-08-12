import { createHash } from "node:crypto";

import { z } from "zod";

import {
  hashHostNodePlatformReleaseOutputStageExactIdentityV2,
} from "../../product-compiler/host-node-toolchain-authority-v2.js";
import {
  canonicalJsonStringify,
  hashCanonicalJson,
} from "../../product-compiler/canonical-json.js";
import { Sha256Schema } from "../../product-compiler/schemas/common-v1.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_METADATA_OPERATION_POLICY_HASH_V2,
} from "../platform-release-bootstrap-metadata-operation-v2.js";
import {
  hashMetadataProbeDirectoryEntriesV2,
  hashMetadataProbeTargetStableIdentityV2,
} from "./platform-release-bootstrap-darwin-metadata-probe-v2.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_OPERATION_ABI_SET_V2,
} from "./platform-release-bootstrap-operation-abis-v2.js";
import {
  PlatformReleaseDependencyMaterializedPairInspectionV2Schema,
} from "./platform-release-dependency-materialized-pair-v2.js";
import {
  hashPlatformReleaseBootstrapWireMessageV2,
} from "./platform-release-bootstrap-wire-contracts-v2.js";
import {
  PLATFORM_RELEASE_COMPONENT_VERSION_V2,
  boundedPlatformReleaseJsonSnapshotV2,
  deepFreezePlatformReleaseJsonV2,
  platformReleaseCandidateFitsCanonicalCapV2,
} from "./platform-release-common-v2.js";

export const PLATFORM_RELEASE_COMPOSITION_METADATA_TEST_V2_SCHEMA =
  "setfarm.platform-release-composition-metadata-test.v2" as const;
export const PLATFORM_RELEASE_COMPOSITION_METADATA_TEST_HASH_V2_SCHEMA =
  "setfarm.platform-release-composition-metadata-test-hash.v2" as const;
export const PLATFORM_RELEASE_COMPOSITION_METADATA_TEST_TARGET_OBSERVATION_HASH_V2_SCHEMA =
  "setfarm.platform-release-composition-metadata-test-target-observation-hash.v2" as const;
export const PLATFORM_RELEASE_COMPOSITION_METADATA_TEST_PROCESS_OBSERVATION_HASH_V2_SCHEMA =
  "setfarm.platform-release-composition-metadata-test-process-observation-hash.v2" as const;
export const PLATFORM_RELEASE_COMPOSITION_METADATA_TEST_FIXED_ARGV_HASH_V2_SCHEMA =
  "setfarm.platform-release-composition-metadata-test-fixed-argv-hash.v2" as const;
export const PLATFORM_RELEASE_COMPOSITION_METADATA_TEST_STABLE_PROJECTION_HASH_V2_SCHEMA =
  "setfarm.platform-release-composition-metadata-test-stable-projection-hash.v2" as const;
export const PLATFORM_RELEASE_COMPOSITION_METADATA_PAIR_TEST_V2_SCHEMA =
  "setfarm.platform-release-composition-metadata-pair-test.v2" as const;
export const PLATFORM_RELEASE_COMPOSITION_METADATA_PAIR_TEST_HASH_V2_SCHEMA =
  "setfarm.platform-release-composition-metadata-pair-test-hash.v2" as const;
export const PLATFORM_RELEASE_COMPOSITION_METADATA_PAIR_OCCURRENCE_HASH_V2_SCHEMA =
  "setfarm.platform-release-composition-metadata-pair-occurrence-hash.v2" as const;
export const PLATFORM_RELEASE_COMPOSITION_METADATA_PAIR_STABLE_PROJECTION_HASH_V2_SCHEMA =
  "setfarm.platform-release-composition-metadata-pair-stable-projection-hash.v2" as const;
export const PLATFORM_RELEASE_COMPOSITION_METADATA_PAIR_LAUNCH_PROJECTION_HASH_V2_SCHEMA =
  "setfarm.platform-release-composition-metadata-pair-launch-projection-hash.v2" as const;
export const PLATFORM_RELEASE_COMPOSITION_METADATA_TEST_MAX_CANONICAL_BYTES_V2 =
  512 * 1024;
export const PLATFORM_RELEASE_COMPOSITION_METADATA_TEST_MAX_TARGET_BYTES_V2 =
  32 * 1024 * 1024;
export const PLATFORM_RELEASE_COMPOSITION_METADATA_TEST_MAX_DIRECT_ENTRY_COUNT_V2 =
  128;
export const PLATFORM_RELEASE_COMPOSITION_METADATA_TEST_EMPTY_SHA256_V2 =
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" as const;
export const PLATFORM_RELEASE_COMPOSITION_METADATA_TEST_OPERATION_ABI_REF_V2 =
  "ABI_PLATFORM_RELEASE_METADATA_PROBE_V2" as const;
export const PLATFORM_RELEASE_COMPOSITION_METADATA_TEST_TARGET_BINDING_V2 =
  "private_fixture_capability_revalidated_v2" as const;
export const PLATFORM_RELEASE_COMPOSITION_METADATA_TEST_IMPLEMENTATION_SCOPE_V2 =
  "authenticated_test_host_composition_installed_metadata_module_wrapper_observers_v2" as const;
export const PLATFORM_RELEASE_COMPOSITION_METADATA_TEST_ENVIRONMENT_POLICY_V2 =
  "exact_empty_environment_v2" as const;

const metadataOperation = (() => {
  const operation =
    PLATFORM_RELEASE_BOOTSTRAP_OPERATION_ABI_SET_V2.operations.find(
    (operation) =>
      operation.abiRef
        === PLATFORM_RELEASE_COMPOSITION_METADATA_TEST_OPERATION_ABI_REF_V2,
  );
  if (operation === undefined) {
    throw new Error(
      "Code-owned metadata operation ABI is missing from the bootstrap ABI set",
    );
  }
  return operation;
})();
export const PLATFORM_RELEASE_COMPOSITION_METADATA_TEST_OPERATION_ABI_HASH_V2 =
  metadataOperation.operationHash;

const CanonicalDecimalV2Schema = z.string()
  .min(1)
  .max(80)
  .regex(/^(?:0|[1-9][0-9]*)$/u, "Expected one canonical unsigned decimal");
const CanonicalModeV2Schema = z.string()
  .regex(/^[0-7]{4}$/u, "Expected one canonical four-digit mode");
const OccurrenceIdV2Schema = z.string().regex(
  /^[A-F0-9]{8}-[A-F0-9]{4}-4[A-F0-9]{3}-[89AB][A-F0-9]{3}-[A-F0-9]{12}$/u,
  "Expected one uppercase UUIDv4 occurrence identifier",
);

export type PlatformReleaseCompositionMetadataStableProjectionHashPayloadForTestV2 =
  Readonly<{
    metadataPolicyHash: string;
    hostCompositionReceiptHash: string;
    targetEntryNamesHash: string;
    observedEntryCount: number;
    observationOutcome: "metadata_policy_satisfied";
  }>;

export function hashPlatformReleaseCompositionMetadataStableProjectionForTestV2(
  value:
    PlatformReleaseCompositionMetadataStableProjectionHashPayloadForTestV2,
): string {
  return hashCanonicalJson({
    schema:
      PLATFORM_RELEASE_COMPOSITION_METADATA_TEST_STABLE_PROJECTION_HASH_V2_SCHEMA,
    projection: value,
  });
}

export type PlatformReleaseCompositionMetadataPairStableProjectionHashPayloadForTestV2 =
  Readonly<{
    operationAbiRef:
      typeof PLATFORM_RELEASE_COMPOSITION_METADATA_TEST_OPERATION_ABI_REF_V2;
    operationAbiHash: string;
    metadataPolicyHash: string;
    hostIdentityHash: string;
    platformHostToolchainReceiptHash: string;
    hostCompositionReceiptHash: string;
    stableOutputBindingHash: string;
    targetEntryNamesHash: string;
    observedEntryCount: number;
    observationOutcome: "metadata_policy_satisfied";
    metadataStableProjectionHash: string;
    launchProjectionHash: string;
  }>;

export function hashPlatformReleaseCompositionMetadataPairStableProjectionForTestV2(
  value:
    PlatformReleaseCompositionMetadataPairStableProjectionHashPayloadForTestV2,
): string {
  return hashCanonicalJson({
    schema:
      PLATFORM_RELEASE_COMPOSITION_METADATA_PAIR_STABLE_PROJECTION_HASH_V2_SCHEMA,
    projection: {
      ...value,
      targetRole: "dependency_materialized_output_root_v2",
      targetBinding:
        "authentic_dependency_pair_private_output_roots_v2",
      targetEntrySetPolicy: "exact_payload_directory_name_v2",
    },
  });
}

const TargetStableIdentityV2Schema = z.object({
  hostIdentityHash: Sha256Schema,
  objectKind: z.literal("directory"),
  device: CanonicalDecimalV2Schema,
  inode: CanonicalDecimalV2Schema,
}).strict();

const TargetMutableFingerprintV2Schema = z.object({
  ownerUid: z.number().int().nonnegative().safe().max(4_294_967_294),
  ownerGid: z.number().int().nonnegative().safe().max(4_294_967_294),
  mode: CanonicalModeV2Schema,
  linkCount: z.number().int().positive().safe(),
  byteLength: z.number().int().nonnegative().safe()
    .max(PLATFORM_RELEASE_COMPOSITION_METADATA_TEST_MAX_TARGET_BYTES_V2),
  directEntryNamesHash: Sha256Schema,
  modifiedTimeNanoseconds: CanonicalDecimalV2Schema,
  changedTimeNanoseconds: CanonicalDecimalV2Schema,
}).strict();

type PlatformReleaseCompositionMetadataTargetObservationHashPayloadForTestV2 =
  Readonly<{
    stableIdentity: z.infer<typeof TargetStableIdentityV2Schema>;
    mutableFingerprint: z.infer<typeof TargetMutableFingerprintV2Schema>;
  }>;

export function hashPlatformReleaseCompositionMetadataTargetObservationForTestV2(
  value: PlatformReleaseCompositionMetadataTargetObservationHashPayloadForTestV2,
): string {
  return hashCanonicalJson({
    schema:
      PLATFORM_RELEASE_COMPOSITION_METADATA_TEST_TARGET_OBSERVATION_HASH_V2_SCHEMA,
    target: value,
  });
}

const TargetObservationV2Schema = z.object({
  stableIdentity: TargetStableIdentityV2Schema,
  mutableFingerprint: TargetMutableFingerprintV2Schema,
  observationHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  const { observationHash: _observationHash, ...identity } = value;
  if (
    value.observationHash
      !== hashPlatformReleaseCompositionMetadataTargetObservationForTestV2(
        identity,
      )
  ) {
    context.addIssue({
      code: "custom",
      path: ["observationHash"],
      message: "Metadata target observation hash mismatch",
    });
  }
});

export type PlatformReleaseCompositionMetadataTargetObservationForTestV2 =
  z.infer<typeof TargetObservationV2Schema>;

const MetadataWireReceiptV2Schema = z.object({
  schema: z.literal("setfarm.platform-release-metadata-probe-receipt.v2"),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  occurrenceId: OccurrenceIdV2Schema,
  hostIdentityHash: Sha256Schema,
  targetRootPhysicalIdentityHash: Sha256Schema,
  metadataPolicyHash: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_METADATA_OPERATION_POLICY_HASH_V2,
  ),
  observationOutcome: z.literal("metadata_policy_satisfied"),
  observedEntryCount: z.number().int().nonnegative().safe()
    .max(PLATFORM_RELEASE_COMPOSITION_METADATA_TEST_MAX_DIRECT_ENTRY_COUNT_V2),
  targetEntryNamesHash: Sha256Schema,
  stableMetadataProjectionHash: Sha256Schema,
  metadataCatalogHash: Sha256Schema,
  metadataObservationHash: Sha256Schema,
  hostCompositionReceiptHash: Sha256Schema,
  messageHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  if (
    value.stableMetadataProjectionHash
      !== hashPlatformReleaseCompositionMetadataStableProjectionForTestV2({
        metadataPolicyHash: value.metadataPolicyHash,
        hostCompositionReceiptHash:
          value.hostCompositionReceiptHash,
        targetEntryNamesHash: value.targetEntryNamesHash,
        observedEntryCount: value.observedEntryCount,
        observationOutcome: value.observationOutcome,
      })
  ) {
    context.addIssue({
      code: "custom",
      path: ["stableMetadataProjectionHash"],
      message: "Metadata stable projection hash mismatch",
    });
  }
  if (
    value.messageHash
      !== hashPlatformReleaseBootstrapWireMessageV2(
        value.schema,
        value,
      )
  ) {
    context.addIssue({
      code: "custom",
      path: ["messageHash"],
      message: "Metadata wire receipt hash mismatch",
    });
  }
});

export type PlatformReleaseCompositionMetadataWireReceiptForTestV2 =
  z.infer<typeof MetadataWireReceiptV2Schema>;

const ProcessStatusV2Schema = z.enum([
  "exited",
  "spawn_failed",
  "timed_out",
  "output_limit_exceeded",
]);

const ProcessObservationIdentityV2Schema = z.object({
  nodeIdentityHash: Sha256Schema,
  nodeExecutableContentHash: Sha256Schema,
  releaseBootstrapExecutableContentHash: Sha256Schema,
  releaseBootstrapExecutablePhysicalIdentityHash: Sha256Schema,
  metadataModuleContentHash: Sha256Schema,
  metadataModulePhysicalIdentityHash: Sha256Schema,
  xattrObserverExecutableContentHash: Sha256Schema,
  xattrObserverExecutablePhysicalIdentityHash: Sha256Schema,
  aclObserverExecutableContentHash: Sha256Schema,
  aclObserverExecutablePhysicalIdentityHash: Sha256Schema,
  fixedArgvHash: Sha256Schema,
  environmentPolicy: z.literal(
    PLATFORM_RELEASE_COMPOSITION_METADATA_TEST_ENVIRONMENT_POLICY_V2,
  ),
  shell: z.literal(false),
  pid: z.number().int().safe().min(-1),
  startedAt: z.number().int().nonnegative().safe(),
  finishedAt: z.number().int().nonnegative().safe(),
  status: ProcessStatusV2Schema,
  exitCode: z.number().int().safe().nullable(),
  signal: z.string().regex(/^[A-Z0-9]+$/u).nullable(),
  stdoutByteLength: z.number().int().nonnegative().safe()
    .max(metadataOperation.maxStdoutBytes),
  stderrByteLength: z.number().int().nonnegative().safe()
    .max(metadataOperation.maxStderrBytes),
  stdoutHash: Sha256Schema,
  stderrHash: Sha256Schema,
}).strict();

export type PlatformReleaseCompositionMetadataProcessObservationHashPayloadForTestV2 =
  z.infer<typeof ProcessObservationIdentityV2Schema>;

export type PlatformReleaseCompositionMetadataLaunchProjectionHashPayloadForTestV2 =
  Pick<
    PlatformReleaseCompositionMetadataProcessObservationHashPayloadForTestV2,
    | "nodeIdentityHash"
    | "nodeExecutableContentHash"
    | "releaseBootstrapExecutableContentHash"
    | "releaseBootstrapExecutablePhysicalIdentityHash"
    | "metadataModuleContentHash"
    | "metadataModulePhysicalIdentityHash"
    | "xattrObserverExecutableContentHash"
    | "xattrObserverExecutablePhysicalIdentityHash"
    | "aclObserverExecutableContentHash"
    | "aclObserverExecutablePhysicalIdentityHash"
    | "fixedArgvHash"
    | "environmentPolicy"
    | "shell"
  >;

export function hashPlatformReleaseCompositionMetadataLaunchProjectionForTestV2(
  value:
    PlatformReleaseCompositionMetadataLaunchProjectionHashPayloadForTestV2,
): string {
  return hashCanonicalJson({
    schema:
      PLATFORM_RELEASE_COMPOSITION_METADATA_PAIR_LAUNCH_PROJECTION_HASH_V2_SCHEMA,
    launch: {
      nodeIdentityHash: value.nodeIdentityHash,
      nodeExecutableContentHash:
        value.nodeExecutableContentHash,
      releaseBootstrapExecutableContentHash:
        value.releaseBootstrapExecutableContentHash,
      releaseBootstrapExecutablePhysicalIdentityHash:
        value.releaseBootstrapExecutablePhysicalIdentityHash,
      metadataModuleContentHash:
        value.metadataModuleContentHash,
      metadataModulePhysicalIdentityHash:
        value.metadataModulePhysicalIdentityHash,
      xattrObserverExecutableContentHash:
        value.xattrObserverExecutableContentHash,
      xattrObserverExecutablePhysicalIdentityHash:
        value.xattrObserverExecutablePhysicalIdentityHash,
      aclObserverExecutableContentHash:
        value.aclObserverExecutableContentHash,
      aclObserverExecutablePhysicalIdentityHash:
        value.aclObserverExecutablePhysicalIdentityHash,
      fixedArgvHash: value.fixedArgvHash,
      environmentPolicy: value.environmentPolicy,
      shell: value.shell,
    },
  });
}

export function hashPlatformReleaseCompositionMetadataProcessObservationForTestV2(
  value: PlatformReleaseCompositionMetadataProcessObservationHashPayloadForTestV2,
): string {
  return hashCanonicalJson({
    schema:
      PLATFORM_RELEASE_COMPOSITION_METADATA_TEST_PROCESS_OBSERVATION_HASH_V2_SCHEMA,
    process: value,
  });
}

export function hashPlatformReleaseCompositionMetadataFixedArgvForTestV2(
  value: Readonly<{
    nodeIdentityHash: string;
    nodeExecutableContentHash: string;
    releaseBootstrapExecutableContentHash: string;
    releaseBootstrapExecutablePhysicalIdentityHash: string;
    metadataModuleContentHash: string;
    metadataModulePhysicalIdentityHash: string;
    xattrObserverExecutableContentHash: string;
    xattrObserverExecutablePhysicalIdentityHash: string;
    aclObserverExecutableContentHash: string;
    aclObserverExecutablePhysicalIdentityHash: string;
  }>,
): string {
  return hashCanonicalJson({
    schema:
      PLATFORM_RELEASE_COMPOSITION_METADATA_TEST_FIXED_ARGV_HASH_V2_SCHEMA,
    operationAbiRef:
      PLATFORM_RELEASE_COMPOSITION_METADATA_TEST_OPERATION_ABI_REF_V2,
    operationAbiHash:
      PLATFORM_RELEASE_COMPOSITION_METADATA_TEST_OPERATION_ABI_HASH_V2,
    directArgv: metadataOperation.directArgvTemplate,
    nodeIdentityHash: value.nodeIdentityHash,
    nodeExecutableContentHash: value.nodeExecutableContentHash,
    releaseBootstrapExecutableContentHash:
      value.releaseBootstrapExecutableContentHash,
    releaseBootstrapExecutablePhysicalIdentityHash:
      value.releaseBootstrapExecutablePhysicalIdentityHash,
    metadataModuleContentHash: value.metadataModuleContentHash,
    metadataModulePhysicalIdentityHash:
      value.metadataModulePhysicalIdentityHash,
    xattrObserverExecutableContentHash:
      value.xattrObserverExecutableContentHash,
    xattrObserverExecutablePhysicalIdentityHash:
      value.xattrObserverExecutablePhysicalIdentityHash,
    aclObserverExecutableContentHash:
      value.aclObserverExecutableContentHash,
    aclObserverExecutablePhysicalIdentityHash:
      value.aclObserverExecutablePhysicalIdentityHash,
    workingDirectoryPolicy: "authenticated_target_root_v2",
    environmentPolicy:
      PLATFORM_RELEASE_COMPOSITION_METADATA_TEST_ENVIRONMENT_POLICY_V2,
  });
}

const ProcessObservationV2Schema =
  ProcessObservationIdentityV2Schema.extend({
    processObservationHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const {
      processObservationHash: _processObservationHash,
      ...identity
    } = value;
    if (
      value.processObservationHash
        !== hashPlatformReleaseCompositionMetadataProcessObservationForTestV2(
          identity,
        )
    ) {
      context.addIssue({
        code: "custom",
        path: ["processObservationHash"],
        message: "Metadata process observation hash mismatch",
      });
    }
    if (
      value.fixedArgvHash
        !== hashPlatformReleaseCompositionMetadataFixedArgvForTestV2(value)
    ) {
      context.addIssue({
        code: "custom",
        path: ["fixedArgvHash"],
        message: "Metadata process fixed argv binding hash mismatch",
      });
    }
    if (
      value.finishedAt < value.startedAt
      || value.status === "exited" && value.pid < 0
      || value.status === "exited" && value.exitCode === null
      || value.status !== "exited" && value.exitCode !== null
    ) {
      context.addIssue({
        code: "custom",
        path: ["status"],
        message: "Metadata process lifecycle fields are inconsistent",
      });
    }
  });

export type PlatformReleaseCompositionMetadataProcessObservationForTestV2 =
  z.infer<typeof ProcessObservationV2Schema>;

const CompositionMetadataTestIdentityV2Schema = z.object({
  schema: z.literal(PLATFORM_RELEASE_COMPOSITION_METADATA_TEST_V2_SCHEMA),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  admissionScope: z.literal("test_fixture"),
  productionAuthority: z.literal(false),
  productionAdmission: z.literal("forbidden"),
  credentialUse: z.literal("none"),
  mutationAuthority: z.literal(false),
  trustConclusion: z.literal("characterization_only"),
  targetBinding: z.literal(
    PLATFORM_RELEASE_COMPOSITION_METADATA_TEST_TARGET_BINDING_V2,
  ),
  implementationScope: z.literal(
    PLATFORM_RELEASE_COMPOSITION_METADATA_TEST_IMPLEMENTATION_SCOPE_V2,
  ),
  operationAbiRef: z.literal(
    PLATFORM_RELEASE_COMPOSITION_METADATA_TEST_OPERATION_ABI_REF_V2,
  ),
  operationAbiHash: z.literal(
    PLATFORM_RELEASE_COMPOSITION_METADATA_TEST_OPERATION_ABI_HASH_V2,
  ),
  hostIdentityHash: Sha256Schema,
  platformHostToolchainReceiptHash: Sha256Schema,
  hostCompositionReceiptHash: Sha256Schema,
  targetRootPhysicalIdentityHash: Sha256Schema,
  metadataPolicyHash: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_METADATA_OPERATION_POLICY_HASH_V2,
  ),
  occurrenceId: OccurrenceIdV2Schema,
  targetBefore: TargetObservationV2Schema,
  targetAfter: TargetObservationV2Schema,
  receipt: MetadataWireReceiptV2Schema,
  process: ProcessObservationV2Schema,
}).strict().superRefine((value, context) => {
  const expectedTargetRootPhysicalIdentityHash =
    hashMetadataProbeTargetStableIdentityV2(
      value.targetBefore.stableIdentity,
    );
  const receiptCanonicalLine = `${canonicalJsonStringify(value.receipt)}\n`;
  const receiptCanonicalLineByteLength =
    Buffer.byteLength(receiptCanonicalLine, "utf8");
  const receiptCanonicalLineHash = createHash("sha256")
    .update(receiptCanonicalLine, "utf8")
    .digest("hex");
  if (
    value.hostIdentityHash
      !== value.targetBefore.stableIdentity.hostIdentityHash
    || value.hostIdentityHash
      !== value.targetAfter.stableIdentity.hostIdentityHash
    || value.hostIdentityHash !== value.receipt.hostIdentityHash
    || value.targetRootPhysicalIdentityHash
      !== expectedTargetRootPhysicalIdentityHash
    || value.targetRootPhysicalIdentityHash
      !== value.receipt.targetRootPhysicalIdentityHash
    || value.metadataPolicyHash !== value.receipt.metadataPolicyHash
    || value.targetBefore.mutableFingerprint.directEntryNamesHash
      !== value.receipt.targetEntryNamesHash
    || value.hostCompositionReceiptHash
      !== value.receipt.hostCompositionReceiptHash
    || value.occurrenceId !== value.receipt.occurrenceId
  ) {
    context.addIssue({
      code: "custom",
      path: ["receipt"],
      message: "Metadata evidence and wire receipt joins are inconsistent",
    });
  }
  if (
    canonicalJsonStringify(value.targetBefore)
      !== canonicalJsonStringify(value.targetAfter)
  ) {
    context.addIssue({
      code: "custom",
      path: ["targetAfter"],
      message: "Metadata operation requires one unchanged target pre/post fence",
    });
  }
  if (
    value.process.status !== "exited"
    || value.process.exitCode !== 0
    || value.process.signal !== null
    || value.process.stderrByteLength !== 0
    || value.process.stderrHash
      !== PLATFORM_RELEASE_COMPOSITION_METADATA_TEST_EMPTY_SHA256_V2
    || value.process.stdoutByteLength !== receiptCanonicalLineByteLength
    || value.process.stdoutHash !== receiptCanonicalLineHash
  ) {
    context.addIssue({
      code: "custom",
      path: ["process"],
      message: "Metadata operation must bind one successful quiet process and exact receipt output",
    });
  }
});

export type PlatformReleaseCompositionMetadataTestHashPayloadV2 = z.infer<
  typeof CompositionMetadataTestIdentityV2Schema
>;

export function hashPlatformReleaseCompositionMetadataForTestV2(
  value:
    | PlatformReleaseCompositionMetadataTestHashPayloadV2
    | PlatformReleaseCompositionMetadataTestV2
    | Readonly<Record<string, unknown>>,
): string {
  const evidence = { ...value } as Record<string, unknown>;
  delete evidence.evidenceHash;
  return hashCanonicalJson({
    schema: PLATFORM_RELEASE_COMPOSITION_METADATA_TEST_HASH_V2_SCHEMA,
    evidence,
  });
}

export const PlatformReleaseCompositionMetadataTestV2Schema =
  CompositionMetadataTestIdentityV2Schema.extend({
    evidenceHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (
      value.evidenceHash
        !== hashPlatformReleaseCompositionMetadataForTestV2(value)
    ) {
      context.addIssue({
        code: "custom",
        path: ["evidenceHash"],
        message: "Metadata test evidence hash mismatch",
      });
    }
    if (
      !platformReleaseCandidateFitsCanonicalCapV2(
        value,
        PLATFORM_RELEASE_COMPOSITION_METADATA_TEST_MAX_CANONICAL_BYTES_V2,
      )
    ) {
      context.addIssue({
        code: "custom",
        message: "Metadata test evidence exceeds its canonical byte cap",
      });
    }
  });

export type PlatformReleaseCompositionMetadataTestV2 = z.infer<
  typeof PlatformReleaseCompositionMetadataTestV2Schema
>;

export function parsePlatformReleaseCompositionMetadataForTestV2(
  input: unknown,
): PlatformReleaseCompositionMetadataTestV2 {
  const snapshot = boundedPlatformReleaseJsonSnapshotV2(
    input,
    PLATFORM_RELEASE_COMPOSITION_METADATA_TEST_MAX_CANONICAL_BYTES_V2,
  );
  return deepFreezePlatformReleaseJsonV2(
    PlatformReleaseCompositionMetadataTestV2Schema.parse(snapshot),
  );
}

const MetadataPairStageRefV2Schema = z.enum([
  "PLATFORM_RELEASE_DEPENDENCY_STAGE_FIRST_V2",
  "PLATFORM_RELEASE_DEPENDENCY_STAGE_SECOND_V2",
]);

const MetadataPairOccurrenceIdentityV2Schema = z.object({
  stageRef: MetadataPairStageRefV2Schema,
  outputStagePhysicalIdentityHash: Sha256Schema,
  stableOutputBindingHash: Sha256Schema,
  hostIdentityHash: Sha256Schema,
  platformHostToolchainReceiptHash: Sha256Schema,
  hostCompositionReceiptHash: Sha256Schema,
  targetRootPhysicalIdentityHash: Sha256Schema,
  metadataPolicyHash: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_METADATA_OPERATION_POLICY_HASH_V2,
  ),
  occurrenceId: OccurrenceIdV2Schema,
  targetBefore: TargetObservationV2Schema,
  targetAfter: TargetObservationV2Schema,
  receipt: MetadataWireReceiptV2Schema,
  process: ProcessObservationV2Schema,
  launchProjectionHash: Sha256Schema,
  stableProjectionHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  const expectedTargetRootPhysicalIdentityHash =
    hashMetadataProbeTargetStableIdentityV2(
      value.targetBefore.stableIdentity,
    );
  const expectedOutputStagePhysicalIdentityHash =
    hashHostNodePlatformReleaseOutputStageExactIdentityV2({
      device: value.targetBefore.stableIdentity.device,
      inode: value.targetBefore.stableIdentity.inode,
      mode: Number.parseInt(
        value.targetBefore.mutableFingerprint.mode,
        8,
      ),
      ownerUid: value.targetBefore.mutableFingerprint.ownerUid,
      ownerGid: value.targetBefore.mutableFingerprint.ownerGid,
    });
  const receiptCanonicalLine =
    `${canonicalJsonStringify(value.receipt)}\n`;
  if (
    value.hostIdentityHash
      !== value.targetBefore.stableIdentity.hostIdentityHash
    || value.hostIdentityHash
      !== value.targetAfter.stableIdentity.hostIdentityHash
    || value.hostIdentityHash !== value.receipt.hostIdentityHash
    || value.targetRootPhysicalIdentityHash
      !== expectedTargetRootPhysicalIdentityHash
    || value.targetRootPhysicalIdentityHash
      !== value.receipt.targetRootPhysicalIdentityHash
    || value.outputStagePhysicalIdentityHash
      !== expectedOutputStagePhysicalIdentityHash
    || value.metadataPolicyHash !== value.receipt.metadataPolicyHash
    || value.hostCompositionReceiptHash
      !== value.receipt.hostCompositionReceiptHash
    || value.occurrenceId !== value.receipt.occurrenceId
    || value.targetBefore.mutableFingerprint.directEntryNamesHash
      !== value.receipt.targetEntryNamesHash
    || value.stableProjectionHash
      !== hashPlatformReleaseCompositionMetadataPairStableProjectionForTestV2({
        operationAbiRef:
          PLATFORM_RELEASE_COMPOSITION_METADATA_TEST_OPERATION_ABI_REF_V2,
        operationAbiHash:
          PLATFORM_RELEASE_COMPOSITION_METADATA_TEST_OPERATION_ABI_HASH_V2,
        metadataPolicyHash: value.metadataPolicyHash,
        hostIdentityHash: value.hostIdentityHash,
        platformHostToolchainReceiptHash:
          value.platformHostToolchainReceiptHash,
        hostCompositionReceiptHash:
          value.hostCompositionReceiptHash,
        stableOutputBindingHash:
          value.stableOutputBindingHash,
        targetEntryNamesHash:
          value.receipt.targetEntryNamesHash,
        observedEntryCount: value.receipt.observedEntryCount,
        observationOutcome: value.receipt.observationOutcome,
        metadataStableProjectionHash:
          value.receipt.stableMetadataProjectionHash,
        launchProjectionHash: value.launchProjectionHash,
      })
  ) {
    context.addIssue({
      code: "custom",
      path: ["receipt"],
      message:
        "Pair metadata occurrence detached from its target, output stage or wire receipt",
    });
  }
  if (
    value.launchProjectionHash
      !== hashPlatformReleaseCompositionMetadataLaunchProjectionForTestV2(
        value.process,
      )
  ) {
    context.addIssue({
      code: "custom",
      path: ["launchProjectionHash"],
      message: "Pair metadata launch projection hash mismatch",
    });
  }
  if (
    canonicalJsonStringify(value.targetBefore)
      !== canonicalJsonStringify(value.targetAfter)
  ) {
    context.addIssue({
      code: "custom",
      path: ["targetAfter"],
      message:
        "Pair metadata occurrence requires one unchanged target pre/post fence",
    });
  }
  if (
    value.process.status !== "exited"
    || value.process.exitCode !== 0
    || value.process.signal !== null
    || value.process.stderrByteLength !== 0
    || value.process.stderrHash
      !== PLATFORM_RELEASE_COMPOSITION_METADATA_TEST_EMPTY_SHA256_V2
    || value.process.stdoutByteLength
      !== Buffer.byteLength(receiptCanonicalLine, "utf8")
    || value.process.stdoutHash
      !== createHash("sha256")
        .update(receiptCanonicalLine, "utf8")
        .digest("hex")
  ) {
    context.addIssue({
      code: "custom",
      path: ["process"],
      message:
        "Pair metadata occurrence must bind one successful quiet child and exact receipt",
    });
  }
});

export type PlatformReleaseCompositionMetadataPairOccurrenceHashPayloadForTestV2 =
  z.infer<typeof MetadataPairOccurrenceIdentityV2Schema>;

export function hashPlatformReleaseCompositionMetadataPairOccurrenceForTestV2(
  value:
    | PlatformReleaseCompositionMetadataPairOccurrenceHashPayloadForTestV2
    | PlatformReleaseCompositionMetadataPairOccurrenceForTestV2,
): string {
  const occurrence = { ...value } as Record<string, unknown>;
  delete occurrence.occurrenceHash;
  return hashCanonicalJson({
    schema:
      PLATFORM_RELEASE_COMPOSITION_METADATA_PAIR_OCCURRENCE_HASH_V2_SCHEMA,
    occurrence,
  });
}

export const PlatformReleaseCompositionMetadataPairOccurrenceForTestV2Schema =
  MetadataPairOccurrenceIdentityV2Schema.extend({
    occurrenceHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (
      value.occurrenceHash
        !== hashPlatformReleaseCompositionMetadataPairOccurrenceForTestV2(
          value,
        )
    ) {
      context.addIssue({
        code: "custom",
        path: ["occurrenceHash"],
        message: "Pair metadata occurrence hash mismatch",
      });
    }
  });

export type PlatformReleaseCompositionMetadataPairOccurrenceForTestV2 =
  z.infer<
    typeof PlatformReleaseCompositionMetadataPairOccurrenceForTestV2Schema
  >;

const MetadataPairIdentityV2Schema = z.object({
  schema: z.literal(
    PLATFORM_RELEASE_COMPOSITION_METADATA_PAIR_TEST_V2_SCHEMA,
  ),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  authorityState: z.literal(
    "test_fixture_dependency_pair_metadata_observed_unverified",
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
  targetBinding: z.literal(
    "authentic_dependency_pair_private_output_roots_v2",
  ),
  implementationScope: z.literal(
    PLATFORM_RELEASE_COMPOSITION_METADATA_TEST_IMPLEMENTATION_SCOPE_V2,
  ),
  operationMode: z.literal(
    "authentic_dependency_pair_zero_caller_dual_occurrence_read_only_metadata_observation",
  ),
  callerJsonState: z.literal("absent"),
  pairLeaseState: z.literal(
    "exclusive_pair_api_metadata_probe_claim_released_after_fresh_post_fence",
  ),
  terminalizationState: z.literal(
    "not_performed_manifest_and_attestation_still_required",
  ),
  limitations: z.object({
    delegateAuthority: z.literal(
      "wrapper_bytes_censused_delegate_shell_and_apple_tools_not_independently_censused",
    ),
    filesystemRaceBoundary: z.literal(
      "pathname_fences_do_not_close_transient_aba",
    ),
    runtimeAccountBoundary: z.literal(
      "observer_children_execute_as_test_owner_not_receipt_runtime_account",
    ),
    testLocatorBoundary: z.literal(
      "raw_test_callback_locators_may_outlive_api_lease_and_require_all_physical_fences",
    ),
  }).strict(),
  dependencyPairInspectionHash: Sha256Schema,
  dependencyPairInspection:
    PlatformReleaseDependencyMaterializedPairInspectionV2Schema,
  stableOutputBindingHash: Sha256Schema,
  operationAbiRef: z.literal(
    PLATFORM_RELEASE_COMPOSITION_METADATA_TEST_OPERATION_ABI_REF_V2,
  ),
  operationAbiHash: z.literal(
    PLATFORM_RELEASE_COMPOSITION_METADATA_TEST_OPERATION_ABI_HASH_V2,
  ),
  metadataPolicyHash: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_METADATA_OPERATION_POLICY_HASH_V2,
  ),
  hostIdentityHash: Sha256Schema,
  platformHostToolchainReceiptHash: Sha256Schema,
  hostCompositionReceiptHash: Sha256Schema,
  occurrences: z.tuple([
    PlatformReleaseCompositionMetadataPairOccurrenceForTestV2Schema,
    PlatformReleaseCompositionMetadataPairOccurrenceForTestV2Schema,
  ]),
  stableProjectionHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  const [first, second] = value.occurrences;
  const expectedEntryNamesHash =
    hashMetadataProbeDirectoryEntriesV2(["payload"]);
  if (
    first.stageRef
      !== "PLATFORM_RELEASE_DEPENDENCY_STAGE_FIRST_V2"
    || second.stageRef
      !== "PLATFORM_RELEASE_DEPENDENCY_STAGE_SECOND_V2"
  ) {
    context.addIssue({
      code: "custom",
      path: ["occurrences"],
      message: "Pair metadata occurrences must retain canonical stage order",
    });
  }
  if (
    value.dependencyPairInspectionHash
      !== value.dependencyPairInspection.inspectionHash
    || value.dependencyPairInspection.admissionScope
      !== "test_fixture"
    || value.stableOutputBindingHash
      !== value.dependencyPairInspection.stableOutput.bindingHash
    || first.outputStagePhysicalIdentityHash
      !== value.dependencyPairInspection.compiledOutputPair
        .occurrences[0].outputStagePhysicalIdentityHash
    || second.outputStagePhysicalIdentityHash
      !== value.dependencyPairInspection.compiledOutputPair
        .occurrences[1].outputStagePhysicalIdentityHash
  ) {
    context.addIssue({
      code: "custom",
      path: ["dependencyPairInspection"],
      message:
        "Pair metadata evidence must embed and join its authentic dependency-pair inspection",
    });
  }
  if (value.occurrences.some((occurrence) =>
    occurrence.stableOutputBindingHash
      !== value.stableOutputBindingHash
    || occurrence.hostIdentityHash !== value.hostIdentityHash
    || occurrence.platformHostToolchainReceiptHash
      !== value.platformHostToolchainReceiptHash
    || occurrence.hostCompositionReceiptHash
      !== value.hostCompositionReceiptHash
    || occurrence.metadataPolicyHash !== value.metadataPolicyHash
    || occurrence.stableProjectionHash
      !== value.stableProjectionHash
    || occurrence.receipt.observedEntryCount !== 1
    || occurrence.receipt.targetEntryNamesHash
      !== expectedEntryNamesHash
  )) {
    context.addIssue({
      code: "custom",
      path: ["occurrences"],
      message:
        "Every pair metadata occurrence must join the common pair, host, policy and payload-only root projection",
    });
  }
  const physicallyAliased =
    first.targetBefore.stableIdentity.device
      === second.targetBefore.stableIdentity.device
    && first.targetBefore.stableIdentity.inode
      === second.targetBefore.stableIdentity.inode;
  if (
    physicallyAliased
    || first.outputStagePhysicalIdentityHash
      === second.outputStagePhysicalIdentityHash
    || first.targetRootPhysicalIdentityHash
      === second.targetRootPhysicalIdentityHash
    || first.targetBefore.observationHash
      === second.targetBefore.observationHash
    || first.occurrenceId === second.occurrenceId
    || first.process.processObservationHash
      === second.process.processObservationHash
    || first.receipt.messageHash === second.receipt.messageHash
    || first.receipt.metadataCatalogHash
      === second.receipt.metadataCatalogHash
    || first.receipt.metadataObservationHash
      === second.receipt.metadataObservationHash
    || first.occurrenceHash === second.occurrenceHash
  ) {
    context.addIssue({
      code: "custom",
      path: ["occurrences"],
      message:
        "Pair metadata observations must be two distinct physical and process-bound occurrences",
    });
  }
});

export type PlatformReleaseCompositionMetadataPairTestHashPayloadV2 =
  z.infer<typeof MetadataPairIdentityV2Schema>;

export function hashPlatformReleaseCompositionMetadataPairForTestV2(
  value:
    | PlatformReleaseCompositionMetadataPairTestHashPayloadV2
    | PlatformReleaseCompositionMetadataPairTestV2
    | Readonly<Record<string, unknown>>,
): string {
  const evidence = { ...value } as Record<string, unknown>;
  delete evidence.collectionHash;
  return hashCanonicalJson({
    schema:
      PLATFORM_RELEASE_COMPOSITION_METADATA_PAIR_TEST_HASH_V2_SCHEMA,
    evidence,
  });
}

export const PlatformReleaseCompositionMetadataPairTestV2Schema =
  MetadataPairIdentityV2Schema.extend({
    collectionHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (
      value.collectionHash
        !== hashPlatformReleaseCompositionMetadataPairForTestV2(value)
    ) {
      context.addIssue({
        code: "custom",
        path: ["collectionHash"],
        message: "Pair metadata collection hash mismatch",
      });
    }
    if (
      !platformReleaseCandidateFitsCanonicalCapV2(
        value,
        PLATFORM_RELEASE_COMPOSITION_METADATA_TEST_MAX_CANONICAL_BYTES_V2,
      )
    ) {
      context.addIssue({
        code: "custom",
        message: "Pair metadata evidence exceeds its canonical byte cap",
      });
    }
  });

export type PlatformReleaseCompositionMetadataPairTestV2 = z.infer<
  typeof PlatformReleaseCompositionMetadataPairTestV2Schema
>;

export function parsePlatformReleaseCompositionMetadataPairForTestV2(
  input: unknown,
): PlatformReleaseCompositionMetadataPairTestV2 {
  const snapshot = boundedPlatformReleaseJsonSnapshotV2(
    input,
    PLATFORM_RELEASE_COMPOSITION_METADATA_TEST_MAX_CANONICAL_BYTES_V2,
  );
  return deepFreezePlatformReleaseJsonV2(
    PlatformReleaseCompositionMetadataPairTestV2Schema.parse(snapshot),
  );
}
