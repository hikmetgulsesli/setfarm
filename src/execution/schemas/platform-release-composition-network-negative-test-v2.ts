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
  NETWORK_ISOLATION_NEGATIVE_PROBE_PROGRAM_HASH_V2,
  NETWORK_SANDBOX_PROFILE_HASH_V2,
} from "../network-sandbox-v2.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_NETWORK_NEGATIVE_CONTROL_SET_HASH_V2,
  PLATFORM_RELEASE_BOOTSTRAP_NETWORK_NEGATIVE_DENIED_PROBE_SET_HASH_V2,
  PLATFORM_RELEASE_BOOTSTRAP_NETWORK_NEGATIVE_OPERATION_POLICY_HASH_V2,
  PLATFORM_RELEASE_BOOTSTRAP_NETWORK_NEGATIVE_PROBE_CLOSURE_HASH_V2,
} from "../platform-release-bootstrap-network-negative-operation-v2.js";
import {
  NETWORK_ISOLATION_NORMALIZED_ENVIRONMENT_HASH_V2,
} from "./network-isolation-negative-probe-v2.js";
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

export const PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_TEST_V2_SCHEMA =
  "setfarm.platform-release-composition-network-negative-test.v2" as const;
export const PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_TEST_HASH_V2_SCHEMA =
  "setfarm.platform-release-composition-network-negative-test-hash.v2" as const;
export const PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_TEST_TARGET_STABLE_IDENTITY_HASH_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-installed-network-negative-target-stable-identity.v2" as const;
export const PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_TEST_TARGET_OBSERVATION_HASH_V2_SCHEMA =
  "setfarm.platform-release-composition-network-negative-target-observation-hash.v2" as const;
export const PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_TEST_PROCESS_OBSERVATION_HASH_V2_SCHEMA =
  "setfarm.platform-release-composition-network-negative-process-observation-hash.v2" as const;
export const PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_TEST_FIXED_ARGV_HASH_V2_SCHEMA =
  "setfarm.platform-release-composition-network-negative-fixed-argv-hash.v2" as const;
export const PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_TEST_STABLE_PROJECTION_HASH_V2_SCHEMA =
  "setfarm.platform-release-composition-network-negative-stable-projection-hash.v2" as const;
export const PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_PAIR_TEST_V2_SCHEMA =
  "setfarm.platform-release-composition-network-negative-pair-test.v2" as const;
export const PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_PAIR_TEST_HASH_V2_SCHEMA =
  "setfarm.platform-release-composition-network-negative-pair-test-hash.v2" as const;
export const PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_PAIR_OCCURRENCE_HASH_V2_SCHEMA =
  "setfarm.platform-release-composition-network-negative-pair-occurrence-hash.v2" as const;
export const PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_PAIR_STABLE_PROJECTION_HASH_V2_SCHEMA =
  "setfarm.platform-release-composition-network-negative-pair-stable-projection-hash.v2" as const;
export const PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_PAIR_LAUNCH_PROJECTION_HASH_V2_SCHEMA =
  "setfarm.platform-release-composition-network-negative-pair-launch-projection-hash.v2" as const;
export const PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_TEST_MAX_CANONICAL_BYTES_V2 =
  512 * 1024;
export const PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_TEST_MAX_TARGET_BYTES_V2 =
  32 * 1024 * 1024;
export const PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_TEST_EMPTY_SHA256_V2 =
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" as const;
export const PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_TEST_OPERATION_ABI_REF_V2 =
  "ABI_PLATFORM_RELEASE_NETWORK_NEGATIVE_PROBE_V2" as const;
export const PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_TEST_TARGET_BINDING_V2 =
  "private_fixture_capability_revalidated_v2" as const;
export const PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_TEST_IMPLEMENTATION_SCOPE_V2 =
  "authenticated_test_host_composition_installed_network_wrapper_sandbox_v2" as const;
export const PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_TEST_ENVIRONMENT_POLICY_V2 =
  "exact_empty_environment_v2" as const;
const PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_PAIR_TARGET_ENTRY_NAMES_HASH_V2 =
  hashCanonicalJson({
    schema:
      "setfarm.platform-release-bootstrap-installed-network-negative-directory-entries.v2",
    names: ["payload"],
  });

const networkNegativeOperation = (() => {
  const operation =
    PLATFORM_RELEASE_BOOTSTRAP_OPERATION_ABI_SET_V2.operations.find(
      (candidate) =>
        candidate.abiRef
          === PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_TEST_OPERATION_ABI_REF_V2,
    );
  if (operation === undefined) {
    throw new Error(
      "Code-owned network-negative operation ABI is missing from the bootstrap ABI set",
    );
  }
  return operation;
})();

export const PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_TEST_OPERATION_ABI_HASH_V2 =
  networkNegativeOperation.operationHash;

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
    .max(PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_TEST_MAX_TARGET_BYTES_V2),
  directEntryNamesHash: Sha256Schema,
  modifiedTimeNanoseconds: CanonicalDecimalV2Schema,
  changedTimeNanoseconds: CanonicalDecimalV2Schema,
}).strict();

export type PlatformReleaseCompositionNetworkNegativeTargetStableIdentityHashPayloadForTestV2 =
  z.infer<typeof TargetStableIdentityV2Schema>;

export function hashPlatformReleaseCompositionNetworkNegativeTargetStableIdentityForTestV2(
  value:
    PlatformReleaseCompositionNetworkNegativeTargetStableIdentityHashPayloadForTestV2,
): string {
  return hashCanonicalJson({
    schema:
      PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_TEST_TARGET_STABLE_IDENTITY_HASH_V2_SCHEMA,
    stableIdentity: value,
  });
}

export type PlatformReleaseCompositionNetworkNegativeTargetObservationHashPayloadForTestV2 =
  Readonly<{
    stableIdentity: z.infer<typeof TargetStableIdentityV2Schema>;
    mutableFingerprint: z.infer<typeof TargetMutableFingerprintV2Schema>;
  }>;

export function hashPlatformReleaseCompositionNetworkNegativeTargetObservationForTestV2(
  value:
    PlatformReleaseCompositionNetworkNegativeTargetObservationHashPayloadForTestV2,
): string {
  return hashCanonicalJson({
    schema:
      PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_TEST_TARGET_OBSERVATION_HASH_V2_SCHEMA,
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
      !== hashPlatformReleaseCompositionNetworkNegativeTargetObservationForTestV2(
        identity,
      )
  ) {
    context.addIssue({
      code: "custom",
      path: ["observationHash"],
      message: "Network-negative target observation hash mismatch",
    });
  }
});

export type PlatformReleaseCompositionNetworkNegativeTargetObservationForTestV2 =
  z.infer<typeof TargetObservationV2Schema>;

export type PlatformReleaseCompositionNetworkNegativeStableProjectionHashPayloadForTestV2 =
  Readonly<{
    sandboxPolicyHash: string;
    sandboxProfileHash: string;
    probeProgramHash: string;
    normalizedEnvironmentHash: string;
    probeClosureHash: string;
    probeOutcome: "all_denied";
    attemptedProbeCount: 1;
    deniedProbeCount: 1;
    deniedProbeSetHash: string;
    controlOutcome: "loopback_and_redirect_observed";
    controlSetHash: string;
    hostCompositionReceiptHash: string;
  }>;

export function hashPlatformReleaseCompositionNetworkNegativeStableProjectionForTestV2(
  value:
    PlatformReleaseCompositionNetworkNegativeStableProjectionHashPayloadForTestV2,
): string {
  return hashCanonicalJson({
    schema:
      PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_TEST_STABLE_PROJECTION_HASH_V2_SCHEMA,
    projection: value,
  });
}

const NetworkNegativeWireReceiptV2Schema = z.object({
  schema: z.literal(
    "setfarm.platform-release-network-negative-probe-receipt.v2",
  ),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  occurrenceId: OccurrenceIdV2Schema,
  hostIdentityHash: Sha256Schema,
  targetRootPhysicalIdentityHash: Sha256Schema,
  sandboxPolicyHash: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_NETWORK_NEGATIVE_OPERATION_POLICY_HASH_V2,
  ),
  sandboxProfileHash: z.literal(NETWORK_SANDBOX_PROFILE_HASH_V2),
  probeProgramHash: z.literal(
    NETWORK_ISOLATION_NEGATIVE_PROBE_PROGRAM_HASH_V2,
  ),
  normalizedEnvironmentHash: z.literal(
    NETWORK_ISOLATION_NORMALIZED_ENVIRONMENT_HASH_V2,
  ),
  probeClosureHash: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_NETWORK_NEGATIVE_PROBE_CLOSURE_HASH_V2,
  ),
  probeOutcome: z.literal("all_denied"),
  attemptedProbeCount: z.literal(1),
  deniedProbeCount: z.literal(1),
  deniedProbeSetHash: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_NETWORK_NEGATIVE_DENIED_PROBE_SET_HASH_V2,
  ),
  controlOutcome: z.literal("loopback_and_redirect_observed"),
  controlSetHash: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_NETWORK_NEGATIVE_CONTROL_SET_HASH_V2,
  ),
  stableNetworkProjectionHash: Sha256Schema,
  networkObservationHash: Sha256Schema,
  hostCompositionReceiptHash: Sha256Schema,
  messageHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  if (
    value.stableNetworkProjectionHash
      !== hashPlatformReleaseCompositionNetworkNegativeStableProjectionForTestV2({
        sandboxPolicyHash: value.sandboxPolicyHash,
        sandboxProfileHash: value.sandboxProfileHash,
        probeProgramHash: value.probeProgramHash,
        normalizedEnvironmentHash: value.normalizedEnvironmentHash,
        probeClosureHash: value.probeClosureHash,
        probeOutcome: value.probeOutcome,
        attemptedProbeCount: value.attemptedProbeCount,
        deniedProbeCount: value.deniedProbeCount,
        deniedProbeSetHash: value.deniedProbeSetHash,
        controlOutcome: value.controlOutcome,
        controlSetHash: value.controlSetHash,
        hostCompositionReceiptHash: value.hostCompositionReceiptHash,
      })
  ) {
    context.addIssue({
      code: "custom",
      path: ["stableNetworkProjectionHash"],
      message: "Network-negative stable projection hash mismatch",
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
      message: "Network-negative wire receipt hash mismatch",
    });
  }
});

export type PlatformReleaseCompositionNetworkNegativeWireReceiptForTestV2 =
  z.infer<typeof NetworkNegativeWireReceiptV2Schema>;

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
  networkWrapperModuleContentHash: Sha256Schema,
  networkWrapperModulePhysicalIdentityHash: Sha256Schema,
  sandboxExecutableContentHash: Sha256Schema,
  sandboxExecutablePhysicalIdentityHash: Sha256Schema,
  fixedArgvHash: Sha256Schema,
  environmentPolicy: z.literal(
    PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_TEST_ENVIRONMENT_POLICY_V2,
  ),
  shell: z.literal(false),
  pid: z.number().int().safe().min(-1),
  startedAt: z.number().int().nonnegative().safe(),
  finishedAt: z.number().int().nonnegative().safe(),
  status: ProcessStatusV2Schema,
  exitCode: z.number().int().safe().nullable(),
  signal: z.string().regex(/^[A-Z0-9]+$/u).nullable(),
  stdoutByteLength: z.number().int().nonnegative().safe()
    .max(networkNegativeOperation.maxStdoutBytes),
  stderrByteLength: z.number().int().nonnegative().safe()
    .max(networkNegativeOperation.maxStderrBytes),
  stdoutHash: Sha256Schema,
  stderrHash: Sha256Schema,
}).strict();

export type PlatformReleaseCompositionNetworkNegativeProcessObservationHashPayloadForTestV2 =
  z.infer<typeof ProcessObservationIdentityV2Schema>;

export function hashPlatformReleaseCompositionNetworkNegativeProcessObservationForTestV2(
  value:
    PlatformReleaseCompositionNetworkNegativeProcessObservationHashPayloadForTestV2,
): string {
  return hashCanonicalJson({
    schema:
      PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_TEST_PROCESS_OBSERVATION_HASH_V2_SCHEMA,
    process: value,
  });
}

export function hashPlatformReleaseCompositionNetworkNegativeFixedArgvForTestV2(
  value: Readonly<{
    nodeIdentityHash: string;
    nodeExecutableContentHash: string;
    releaseBootstrapExecutableContentHash: string;
    releaseBootstrapExecutablePhysicalIdentityHash: string;
    networkWrapperModuleContentHash: string;
    networkWrapperModulePhysicalIdentityHash: string;
    sandboxExecutableContentHash: string;
    sandboxExecutablePhysicalIdentityHash: string;
  }>,
): string {
  return hashCanonicalJson({
    schema:
      PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_TEST_FIXED_ARGV_HASH_V2_SCHEMA,
    operationAbiRef:
      PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_TEST_OPERATION_ABI_REF_V2,
    operationAbiHash:
      PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_TEST_OPERATION_ABI_HASH_V2,
    directArgv: networkNegativeOperation.directArgvTemplate,
    nodeIdentityHash: value.nodeIdentityHash,
    nodeExecutableContentHash: value.nodeExecutableContentHash,
    releaseBootstrapExecutableContentHash:
      value.releaseBootstrapExecutableContentHash,
    releaseBootstrapExecutablePhysicalIdentityHash:
      value.releaseBootstrapExecutablePhysicalIdentityHash,
    networkWrapperModuleContentHash:
      value.networkWrapperModuleContentHash,
    networkWrapperModulePhysicalIdentityHash:
      value.networkWrapperModulePhysicalIdentityHash,
    sandboxExecutableContentHash:
      value.sandboxExecutableContentHash,
    sandboxExecutablePhysicalIdentityHash:
      value.sandboxExecutablePhysicalIdentityHash,
    sandboxPolicyHash:
      PLATFORM_RELEASE_BOOTSTRAP_NETWORK_NEGATIVE_OPERATION_POLICY_HASH_V2,
    workingDirectoryPolicy: "authenticated_target_root_v2",
    environmentPolicy:
      PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_TEST_ENVIRONMENT_POLICY_V2,
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
        !== hashPlatformReleaseCompositionNetworkNegativeProcessObservationForTestV2(
          identity,
        )
    ) {
      context.addIssue({
        code: "custom",
        path: ["processObservationHash"],
        message: "Network-negative process observation hash mismatch",
      });
    }
    if (
      value.fixedArgvHash
        !== hashPlatformReleaseCompositionNetworkNegativeFixedArgvForTestV2(
          value,
        )
    ) {
      context.addIssue({
        code: "custom",
        path: ["fixedArgvHash"],
        message: "Network-negative process fixed argv binding hash mismatch",
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
        message: "Network-negative process lifecycle fields are inconsistent",
      });
    }
  });

export type PlatformReleaseCompositionNetworkNegativeProcessObservationForTestV2 =
  z.infer<typeof ProcessObservationV2Schema>;

const CompositionNetworkNegativeTestIdentityV2Schema = z.object({
  schema: z.literal(PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_TEST_V2_SCHEMA),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  admissionScope: z.literal("test_fixture"),
  productionAuthority: z.literal(false),
  productionAdmission: z.literal("forbidden"),
  credentialUse: z.literal("none"),
  mutationAuthority: z.literal(false),
  trustConclusion: z.literal("characterization_only"),
  limitations: z.object({
    delegateAuthority: z.literal(
      "wrapper_bytes_censused_delegate_shell_env_and_apple_sandbox_tool_not_independently_censused",
    ),
    filesystemRaceBoundary: z.literal(
      "pathname_fences_and_empty_directory_cleanup_do_not_close_transient_aba",
    ),
    processGroupBoundary: z.literal(
      "timeout_and_output_limit_kill_the_fresh_group_successful_descendant_absence_not_independently_proven",
    ),
    runtimeAccountBoundary: z.literal(
      "probe_children_execute_as_test_owner_not_receipt_runtime_account",
    ),
    serializedProvenanceBoundary: z.literal(
      "strict_self_consistency_is_not_origin_authentication",
    ),
  }).strict(),
  targetBinding: z.literal(
    PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_TEST_TARGET_BINDING_V2,
  ),
  implementationScope: z.literal(
    PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_TEST_IMPLEMENTATION_SCOPE_V2,
  ),
  operationAbiRef: z.literal(
    PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_TEST_OPERATION_ABI_REF_V2,
  ),
  operationAbiHash: z.literal(
    PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_TEST_OPERATION_ABI_HASH_V2,
  ),
  hostIdentityHash: Sha256Schema,
  platformHostToolchainReceiptHash: Sha256Schema,
  hostCompositionReceiptHash: Sha256Schema,
  targetRootPhysicalIdentityHash: Sha256Schema,
  sandboxPolicyHash: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_NETWORK_NEGATIVE_OPERATION_POLICY_HASH_V2,
  ),
  occurrenceId: OccurrenceIdV2Schema,
  targetBefore: TargetObservationV2Schema,
  targetAfter: TargetObservationV2Schema,
  receipt: NetworkNegativeWireReceiptV2Schema,
  process: ProcessObservationV2Schema,
}).strict().superRefine((value, context) => {
  const expectedTargetRootPhysicalIdentityHash =
    hashPlatformReleaseCompositionNetworkNegativeTargetStableIdentityForTestV2(
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
    || value.sandboxPolicyHash !== value.receipt.sandboxPolicyHash
    || value.hostCompositionReceiptHash
      !== value.receipt.hostCompositionReceiptHash
    || value.occurrenceId !== value.receipt.occurrenceId
  ) {
    context.addIssue({
      code: "custom",
      path: ["receipt"],
      message: "Network-negative evidence and wire receipt joins are inconsistent",
    });
  }
  if (
    canonicalJsonStringify(value.targetBefore)
      !== canonicalJsonStringify(value.targetAfter)
  ) {
    context.addIssue({
      code: "custom",
      path: ["targetAfter"],
      message: "Network-negative operation requires one unchanged target pre/post fence",
    });
  }
  if (
    value.process.status !== "exited"
    || value.process.exitCode !== 0
    || value.process.signal !== null
    || value.process.stderrByteLength !== 0
    || value.process.stderrHash
      !== PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_TEST_EMPTY_SHA256_V2
    || value.process.stdoutByteLength !== receiptCanonicalLineByteLength
    || value.process.stdoutHash !== receiptCanonicalLineHash
  ) {
    context.addIssue({
      code: "custom",
      path: ["process"],
      message: "Network-negative operation must bind one successful quiet process and exact receipt output",
    });
  }
});

export type PlatformReleaseCompositionNetworkNegativeTestHashPayloadV2 =
  z.infer<typeof CompositionNetworkNegativeTestIdentityV2Schema>;

export function hashPlatformReleaseCompositionNetworkNegativeForTestV2(
  value:
    | PlatformReleaseCompositionNetworkNegativeTestHashPayloadV2
    | PlatformReleaseCompositionNetworkNegativeTestV2
    | Readonly<Record<string, unknown>>,
): string {
  const evidence = { ...value } as Record<string, unknown>;
  delete evidence.evidenceHash;
  return hashCanonicalJson({
    schema:
      PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_TEST_HASH_V2_SCHEMA,
    evidence,
  });
}

export const PlatformReleaseCompositionNetworkNegativeTestV2Schema =
  CompositionNetworkNegativeTestIdentityV2Schema.extend({
    evidenceHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (
      value.evidenceHash
        !== hashPlatformReleaseCompositionNetworkNegativeForTestV2(value)
    ) {
      context.addIssue({
        code: "custom",
        path: ["evidenceHash"],
        message: "Network-negative test evidence hash mismatch",
      });
    }
    if (
      !platformReleaseCandidateFitsCanonicalCapV2(
        value,
        PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_TEST_MAX_CANONICAL_BYTES_V2,
      )
    ) {
      context.addIssue({
        code: "custom",
        message: "Network-negative test evidence exceeds its canonical byte cap",
      });
    }
  });

export type PlatformReleaseCompositionNetworkNegativeTestV2 = z.infer<
  typeof PlatformReleaseCompositionNetworkNegativeTestV2Schema
>;

export function parsePlatformReleaseCompositionNetworkNegativeForTestV2(
  input: unknown,
): PlatformReleaseCompositionNetworkNegativeTestV2 {
  const snapshot = boundedPlatformReleaseJsonSnapshotV2(
    input,
    PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_TEST_MAX_CANONICAL_BYTES_V2,
  );
  return deepFreezePlatformReleaseJsonV2(
    PlatformReleaseCompositionNetworkNegativeTestV2Schema.parse(snapshot),
  );
}

const NetworkNegativePairStageRefV2Schema = z.enum([
  "PLATFORM_RELEASE_DEPENDENCY_STAGE_FIRST_V2",
  "PLATFORM_RELEASE_DEPENDENCY_STAGE_SECOND_V2",
]);

export type PlatformReleaseCompositionNetworkNegativeLaunchProjectionHashPayloadForTestV2 =
  Pick<
    PlatformReleaseCompositionNetworkNegativeProcessObservationHashPayloadForTestV2,
    | "nodeIdentityHash"
    | "nodeExecutableContentHash"
    | "releaseBootstrapExecutableContentHash"
    | "releaseBootstrapExecutablePhysicalIdentityHash"
    | "networkWrapperModuleContentHash"
    | "networkWrapperModulePhysicalIdentityHash"
    | "sandboxExecutableContentHash"
    | "sandboxExecutablePhysicalIdentityHash"
    | "fixedArgvHash"
    | "environmentPolicy"
    | "shell"
  >;

export function hashPlatformReleaseCompositionNetworkNegativeLaunchProjectionForTestV2(
  value:
    PlatformReleaseCompositionNetworkNegativeLaunchProjectionHashPayloadForTestV2,
): string {
  return hashCanonicalJson({
    schema:
      PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_PAIR_LAUNCH_PROJECTION_HASH_V2_SCHEMA,
    launch: {
      nodeIdentityHash: value.nodeIdentityHash,
      nodeExecutableContentHash: value.nodeExecutableContentHash,
      releaseBootstrapExecutableContentHash:
        value.releaseBootstrapExecutableContentHash,
      releaseBootstrapExecutablePhysicalIdentityHash:
        value.releaseBootstrapExecutablePhysicalIdentityHash,
      networkWrapperModuleContentHash:
        value.networkWrapperModuleContentHash,
      networkWrapperModulePhysicalIdentityHash:
        value.networkWrapperModulePhysicalIdentityHash,
      sandboxExecutableContentHash:
        value.sandboxExecutableContentHash,
      sandboxExecutablePhysicalIdentityHash:
        value.sandboxExecutablePhysicalIdentityHash,
      fixedArgvHash: value.fixedArgvHash,
      environmentPolicy: value.environmentPolicy,
      shell: value.shell,
    },
  });
}

export type PlatformReleaseCompositionNetworkNegativePairStableProjectionHashPayloadForTestV2 =
  Readonly<{
    operationAbiRef:
      typeof PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_TEST_OPERATION_ABI_REF_V2;
    operationAbiHash: string;
    sandboxPolicyHash: string;
    hostIdentityHash: string;
    platformHostToolchainReceiptHash: string;
    hostCompositionReceiptHash: string;
    stableOutputBindingHash: string;
    sandboxProfileHash: string;
    probeProgramHash: string;
    normalizedEnvironmentHash: string;
    probeClosureHash: string;
    probeOutcome: "all_denied";
    attemptedProbeCount: 1;
    deniedProbeCount: 1;
    deniedProbeSetHash: string;
    controlOutcome: "loopback_and_redirect_observed";
    controlSetHash: string;
    networkStableProjectionHash: string;
    launchProjectionHash: string;
  }>;

export function hashPlatformReleaseCompositionNetworkNegativePairStableProjectionForTestV2(
  value:
    PlatformReleaseCompositionNetworkNegativePairStableProjectionHashPayloadForTestV2,
): string {
  return hashCanonicalJson({
    schema:
      PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_PAIR_STABLE_PROJECTION_HASH_V2_SCHEMA,
    projection: {
      ...value,
      targetRole: "dependency_materialized_output_root_v2",
      targetBinding:
        "authentic_dependency_pair_private_output_roots_v2",
      networkSemantics:
        "equal_denial_control_and_installed_launch_projection_v2",
    },
  });
}

const NetworkNegativePairOccurrenceIdentityV2Schema = z.object({
  stageRef: NetworkNegativePairStageRefV2Schema,
  outputStagePhysicalIdentityHash: Sha256Schema,
  stableOutputBindingHash: Sha256Schema,
  hostIdentityHash: Sha256Schema,
  platformHostToolchainReceiptHash: Sha256Schema,
  hostCompositionReceiptHash: Sha256Schema,
  targetRootPhysicalIdentityHash: Sha256Schema,
  sandboxPolicyHash: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_NETWORK_NEGATIVE_OPERATION_POLICY_HASH_V2,
  ),
  occurrenceId: OccurrenceIdV2Schema,
  targetBefore: TargetObservationV2Schema,
  targetAfter: TargetObservationV2Schema,
  receipt: NetworkNegativeWireReceiptV2Schema,
  process: ProcessObservationV2Schema,
  launchProjectionHash: Sha256Schema,
  stableProjectionHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  const expectedTargetRootPhysicalIdentityHash =
    hashPlatformReleaseCompositionNetworkNegativeTargetStableIdentityForTestV2(
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
    || value.targetBefore.mutableFingerprint.directEntryNamesHash
      !== PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_PAIR_TARGET_ENTRY_NAMES_HASH_V2
    || value.sandboxPolicyHash !== value.receipt.sandboxPolicyHash
    || value.hostCompositionReceiptHash
      !== value.receipt.hostCompositionReceiptHash
    || value.occurrenceId !== value.receipt.occurrenceId
    || value.stableProjectionHash
      !== hashPlatformReleaseCompositionNetworkNegativePairStableProjectionForTestV2({
        operationAbiRef:
          PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_TEST_OPERATION_ABI_REF_V2,
        operationAbiHash:
          PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_TEST_OPERATION_ABI_HASH_V2,
        sandboxPolicyHash: value.sandboxPolicyHash,
        hostIdentityHash: value.hostIdentityHash,
        platformHostToolchainReceiptHash:
          value.platformHostToolchainReceiptHash,
        hostCompositionReceiptHash:
          value.hostCompositionReceiptHash,
        stableOutputBindingHash: value.stableOutputBindingHash,
        sandboxProfileHash: value.receipt.sandboxProfileHash,
        probeProgramHash: value.receipt.probeProgramHash,
        normalizedEnvironmentHash:
          value.receipt.normalizedEnvironmentHash,
        probeClosureHash: value.receipt.probeClosureHash,
        probeOutcome: value.receipt.probeOutcome,
        attemptedProbeCount: value.receipt.attemptedProbeCount,
        deniedProbeCount: value.receipt.deniedProbeCount,
        deniedProbeSetHash: value.receipt.deniedProbeSetHash,
        controlOutcome: value.receipt.controlOutcome,
        controlSetHash: value.receipt.controlSetHash,
        networkStableProjectionHash:
          value.receipt.stableNetworkProjectionHash,
        launchProjectionHash: value.launchProjectionHash,
      })
  ) {
    context.addIssue({
      code: "custom",
      path: ["receipt"],
      message:
        "Pair network-negative occurrence detached from its target, output stage or wire receipt",
    });
  }
  if (
    value.launchProjectionHash
      !== hashPlatformReleaseCompositionNetworkNegativeLaunchProjectionForTestV2(
        value.process,
      )
  ) {
    context.addIssue({
      code: "custom",
      path: ["launchProjectionHash"],
      message: "Pair network-negative launch projection hash mismatch",
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
        "Pair network-negative occurrence requires one unchanged target pre/post fence",
    });
  }
  if (
    value.process.status !== "exited"
    || value.process.exitCode !== 0
    || value.process.signal !== null
    || value.process.stderrByteLength !== 0
    || value.process.stderrHash
      !== PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_TEST_EMPTY_SHA256_V2
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
        "Pair network-negative occurrence must bind one successful quiet child and exact receipt",
    });
  }
});

export type PlatformReleaseCompositionNetworkNegativePairOccurrenceHashPayloadForTestV2 =
  z.infer<typeof NetworkNegativePairOccurrenceIdentityV2Schema>;

export function hashPlatformReleaseCompositionNetworkNegativePairOccurrenceForTestV2(
  value:
    | PlatformReleaseCompositionNetworkNegativePairOccurrenceHashPayloadForTestV2
    | PlatformReleaseCompositionNetworkNegativePairOccurrenceForTestV2,
): string {
  const occurrence = { ...value } as Record<string, unknown>;
  delete occurrence.occurrenceHash;
  return hashCanonicalJson({
    schema:
      PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_PAIR_OCCURRENCE_HASH_V2_SCHEMA,
    occurrence,
  });
}

export const PlatformReleaseCompositionNetworkNegativePairOccurrenceForTestV2Schema =
  NetworkNegativePairOccurrenceIdentityV2Schema.extend({
    occurrenceHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (
      value.occurrenceHash
        !== hashPlatformReleaseCompositionNetworkNegativePairOccurrenceForTestV2(
          value,
        )
    ) {
      context.addIssue({
        code: "custom",
        path: ["occurrenceHash"],
        message: "Pair network-negative occurrence hash mismatch",
      });
    }
  });

export type PlatformReleaseCompositionNetworkNegativePairOccurrenceForTestV2 =
  z.infer<
    typeof PlatformReleaseCompositionNetworkNegativePairOccurrenceForTestV2Schema
  >;

const NetworkNegativePairIdentityV2Schema = z.object({
  schema: z.literal(
    PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_PAIR_TEST_V2_SCHEMA,
  ),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  authorityState: z.literal(
    "test_fixture_dependency_pair_network_negative_observed_unverified",
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
    PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_TEST_IMPLEMENTATION_SCOPE_V2,
  ),
  operationMode: z.literal(
    "authentic_dependency_pair_zero_caller_dual_occurrence_read_only_network_negative_observation",
  ),
  callerJsonState: z.literal("absent"),
  callerLocatorState: z.literal("absent"),
  pairLeaseState: z.literal(
    "exclusive_pair_api_network_negative_probe_claim_released_after_fresh_post_fence",
  ),
  terminalizationState: z.literal(
    "not_performed_manifest_and_attestation_still_required",
  ),
  limitations: z.object({
    delegateAuthority: z.literal(
      "wrapper_bytes_censused_delegate_shell_env_and_apple_sandbox_tool_not_independently_censused",
    ),
    filesystemRaceBoundary: z.literal(
      "pathname_fences_and_empty_directory_cleanup_do_not_close_transient_aba",
    ),
    processGroupBoundary: z.literal(
      "timeout_and_output_limit_kill_the_fresh_group_successful_descendant_absence_not_independently_proven",
    ),
    runtimeAccountBoundary: z.literal(
      "probe_children_execute_as_test_owner_not_receipt_runtime_account",
    ),
    testLocatorBoundary: z.literal(
      "raw_test_callback_locators_may_outlive_api_lease_and_require_all_physical_fences",
    ),
    serializedProvenanceBoundary: z.literal(
      "strict_self_consistency_is_not_origin_authentication",
    ),
    serializedHostJoinBoundary: z.literal(
      "host_join_is_live_observer_authority_not_a_dependency_inspection_field",
    ),
  }).strict(),
  dependencyPairInspectionHash: Sha256Schema,
  dependencyPairInspection:
    PlatformReleaseDependencyMaterializedPairInspectionV2Schema,
  stableOutputBindingHash: Sha256Schema,
  operationAbiRef: z.literal(
    PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_TEST_OPERATION_ABI_REF_V2,
  ),
  operationAbiHash: z.literal(
    PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_TEST_OPERATION_ABI_HASH_V2,
  ),
  sandboxPolicyHash: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_NETWORK_NEGATIVE_OPERATION_POLICY_HASH_V2,
  ),
  hostIdentityHash: Sha256Schema,
  platformHostToolchainReceiptHash: Sha256Schema,
  hostCompositionReceiptHash: Sha256Schema,
  occurrences: z.tuple([
    PlatformReleaseCompositionNetworkNegativePairOccurrenceForTestV2Schema,
    PlatformReleaseCompositionNetworkNegativePairOccurrenceForTestV2Schema,
  ]),
  stableProjectionHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  const [first, second] = value.occurrences;
  if (
    first.stageRef
      !== "PLATFORM_RELEASE_DEPENDENCY_STAGE_FIRST_V2"
    || second.stageRef
      !== "PLATFORM_RELEASE_DEPENDENCY_STAGE_SECOND_V2"
  ) {
    context.addIssue({
      code: "custom",
      path: ["occurrences"],
      message:
        "Pair network-negative occurrences must retain canonical stage order",
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
        "Pair network-negative evidence must embed and join its authentic dependency-pair inspection",
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
    || occurrence.sandboxPolicyHash !== value.sandboxPolicyHash
    || occurrence.launchProjectionHash
      !== first.launchProjectionHash
    || occurrence.stableProjectionHash
      !== value.stableProjectionHash
    || occurrence.receipt.stableNetworkProjectionHash
      !== first.receipt.stableNetworkProjectionHash
  )) {
    context.addIssue({
      code: "custom",
      path: ["occurrences"],
      message:
        "Every pair network-negative occurrence must join the common pair, host, policy, launch and stable network semantics",
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
    || first.receipt.networkObservationHash
      === second.receipt.networkObservationHash
    || first.occurrenceHash === second.occurrenceHash
  ) {
    context.addIssue({
      code: "custom",
      path: ["occurrences"],
      message:
        "Pair network-negative observations must be two distinct physical and process-bound occurrences",
    });
  }
});

export type PlatformReleaseCompositionNetworkNegativePairTestHashPayloadV2 =
  z.infer<typeof NetworkNegativePairIdentityV2Schema>;

export function hashPlatformReleaseCompositionNetworkNegativePairForTestV2(
  value:
    | PlatformReleaseCompositionNetworkNegativePairTestHashPayloadV2
    | PlatformReleaseCompositionNetworkNegativePairTestV2
    | Readonly<Record<string, unknown>>,
): string {
  const evidence = { ...value } as Record<string, unknown>;
  delete evidence.collectionHash;
  return hashCanonicalJson({
    schema:
      PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_PAIR_TEST_HASH_V2_SCHEMA,
    evidence,
  });
}

export const PlatformReleaseCompositionNetworkNegativePairTestV2Schema =
  NetworkNegativePairIdentityV2Schema.extend({
    collectionHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (
      value.collectionHash
        !== hashPlatformReleaseCompositionNetworkNegativePairForTestV2(value)
    ) {
      context.addIssue({
        code: "custom",
        path: ["collectionHash"],
        message: "Pair network-negative collection hash mismatch",
      });
    }
    if (
      !platformReleaseCandidateFitsCanonicalCapV2(
        value,
        PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_TEST_MAX_CANONICAL_BYTES_V2,
      )
    ) {
      context.addIssue({
        code: "custom",
        message: "Pair network-negative evidence exceeds its canonical byte cap",
      });
    }
  });

export type PlatformReleaseCompositionNetworkNegativePairTestV2 = z.infer<
  typeof PlatformReleaseCompositionNetworkNegativePairTestV2Schema
>;

export function parsePlatformReleaseCompositionNetworkNegativePairForTestV2(
  input: unknown,
): PlatformReleaseCompositionNetworkNegativePairTestV2 {
  const snapshot = boundedPlatformReleaseJsonSnapshotV2(
    input,
    PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_TEST_MAX_CANONICAL_BYTES_V2,
  );
  return deepFreezePlatformReleaseJsonV2(
    PlatformReleaseCompositionNetworkNegativePairTestV2Schema.parse(snapshot),
  );
}
