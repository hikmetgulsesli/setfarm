import { z } from "zod";

import {
  canonicalJsonStringify,
  hashCanonicalJson,
} from "../../product-compiler/canonical-json.js";
import {
  Sha256Schema,
  StableReferenceSchema,
} from "../../product-compiler/schemas/common-v1.js";
import {
  PLATFORM_RELEASE_COMPONENT_VERSION_V2,
  boundedPlatformReleaseJsonSnapshotV2,
  deepFreezePlatformReleaseJsonV2,
  platformReleaseCandidateFitsCanonicalCapV2,
} from "./platform-release-common-v2.js";
import {
  PLATFORM_RELEASE_HOST_COMPOSITION_REQUIREMENT_V2,
} from "./platform-release-host-composition-v2.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_OPERATION_FAILURE_V2_SCHEMA,
  PLATFORM_RELEASE_BOOTSTRAP_WIRE_CONTRACT_SET_V2,
} from "./platform-release-bootstrap-wire-contracts-v2.js";

export const PLATFORM_RELEASE_BOOTSTRAP_OPERATION_ABI_SET_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-operation-abi-set.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_OPERATION_ABI_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-operation-abi.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_OPERATION_ABI_SET_AUTHORITY_REF_V2 =
  "AUTH_PLATFORM_RELEASE_BOOTSTRAP_OPERATION_ABI_SET_V2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_OPERATION_ABI_COUNT_V2 = 11;
export const PLATFORM_RELEASE_BOOTSTRAP_OPERATION_ABI_SET_MAX_CANONICAL_BYTES_V2 =
  256 * 1024;

export const PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2 = Object.freeze({
  hostVerifier:
    "BOOTSTRAP_HOST_COMPOSITION_VERIFIER_V2",
  nodeToolchainProvisioner:
    "BOOTSTRAP_NODE_TOOLCHAIN_PROVISIONER_V2",
  platformReleaseComposition:
    "BOOTSTRAP_PLATFORM_RELEASE_COMPOSITION_V2",
  runtimeAccountProvisioner:
    "BOOTSTRAP_RUNTIME_ACCOUNT_PROVISIONER_V2",
} as const);

export const PlatformReleaseBootstrapPackageRefV2Schema = z.enum([
  PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.hostVerifier,
  PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.nodeToolchainProvisioner,
  PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.platformReleaseComposition,
  PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.runtimeAccountProvisioner,
]);

const OperationAbiRefV2Schema = z.enum([
  "ABI_PLATFORM_RELEASE_APPLY_LOCAL_ACCOUNT_V2",
  "ABI_PLATFORM_RELEASE_HOST_OPERATION_V2",
  "ABI_PLATFORM_RELEASE_LOOKUP_LOCAL_ACCOUNT_V2",
  "ABI_PLATFORM_RELEASE_METADATA_PROBE_V2",
  "ABI_PLATFORM_RELEASE_MODULE_EXPORT_PROBE_V2",
  "ABI_PLATFORM_RELEASE_NETWORK_NEGATIVE_PROBE_V2",
  "ABI_PLATFORM_RELEASE_PLAN_LOCAL_ACCOUNT_V2",
  "ABI_PLATFORM_RELEASE_ROLLBACK_LOCAL_ACCOUNT_V2",
  "ABI_PLATFORM_RELEASE_SELF_ATTEST_V2",
  "ABI_PLATFORM_RELEASE_VERIFY_PACKAGE_V2",
  "ABI_PLATFORM_RELEASE_VERIFY_SYSTEM_ANCHORS_V2",
]);

type OperationAbiRefV2 = z.infer<typeof OperationAbiRefV2Schema>;

const TARGET_ROOT_BOUND_OPERATION_ABI_REFS_V2:
  ReadonlySet<OperationAbiRefV2> = new Set([
    "ABI_PLATFORM_RELEASE_HOST_OPERATION_V2",
    "ABI_PLATFORM_RELEASE_METADATA_PROBE_V2",
    "ABI_PLATFORM_RELEASE_MODULE_EXPORT_PROBE_V2",
    "ABI_PLATFORM_RELEASE_NETWORK_NEGATIVE_PROBE_V2",
  ]);

const WireSchemaRefV2Schema = z.string()
  .min(1)
  .max(160)
  .regex(
    /^setfarm\.[a-z0-9]+(?:[.-][a-z0-9]+)*\.v2$/,
    "Expected one exact V2 wire schema reference",
  );

const DirectArgvTokenV2Schema = z.string()
  .min(1)
  .max(160)
  .regex(
    /^(?:[a-z][a-z0-9-]*|[A-Z][A-Z0-9_]*_V2)$/,
    "Expected one code-owned direct argv token",
  );

const ModuleExportV2Schema = z.string()
  .min(1)
  .max(160)
  .regex(
    /^[A-Za-z_$][A-Za-z0-9_$]*$/,
    "Expected one exact JavaScript module export",
  );

const PlatformReleaseBootstrapOperationAbiIdentityV2Schema = z.object({
  schema: z.literal(PLATFORM_RELEASE_BOOTSTRAP_OPERATION_ABI_V2_SCHEMA),
  abiRef: OperationAbiRefV2Schema,
  ownerPackageRef: PlatformReleaseBootstrapPackageRefV2Schema,
  implementationKind: z.enum([
    "signed_native_executable",
    "installed_release_module",
  ]),
  processLaunchPolicy: z.enum([
    "exact_native_executable_then_fixed_application_argv_v2",
    "exact_node_runtime_then_release_executable_then_fixed_application_argv_v2",
  ]),
  interpreterPackageRef:
    PlatformReleaseBootstrapPackageRefV2Schema.nullable(),
  interpreterMemberRef: StableReferenceSchema.nullable(),
  processExecutableMemberRef: StableReferenceSchema,
  implementationMemberRef: StableReferenceSchema,
  moduleExport: ModuleExportV2Schema.nullable(),
  command: z.string().min(1).max(100)
    .regex(/^[a-z][a-z0-9-]*-v2$/),
  inputSchema: WireSchemaRefV2Schema,
  outputSchema: WireSchemaRefV2Schema,
  directArgvTemplate: z.array(DirectArgvTokenV2Schema).min(1).max(4),
  inputTransport: z.literal(
    "preopened_read_only_fd3_exactly_once_v2",
  ),
  stdin: z.literal("closed"),
  shell: z.literal("forbidden"),
  inheritAmbientEnvironment: z.literal(false),
  environmentPolicy: z.literal(
    "exact_empty_environment_v2",
  ),
  workingDirectoryPolicy: z.enum([
    "installed_owner_package_root_v2",
    "authenticated_target_root_v2",
  ]),
  processEvidencePolicy: z.literal(
    "outer_host_owner_binds_exit_termination_stdout_stderr_and_occurrence_v2",
  ),
  timeoutMs: z.number().int().positive().max(120_000),
  maxStdoutBytes: z.number().int().positive().max(1024 * 1024),
  maxStderrBytes: z.number().int().positive().max(1024 * 1024),
  compatibilityBindingHash: Sha256Schema.nullable(),
}).strict();

export type PlatformReleaseBootstrapOperationAbiHashPayloadV2 =
  z.infer<typeof PlatformReleaseBootstrapOperationAbiIdentityV2Schema>;

export function hashPlatformReleaseBootstrapOperationAbiV2(
  value:
    | PlatformReleaseBootstrapOperationAbiHashPayloadV2
    | PlatformReleaseBootstrapOperationAbiV2,
): string {
  const operation = { ...value } as Record<string, unknown>;
  delete operation.operationHash;
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-bootstrap-operation-abi-hash.v2",
    operation,
  });
}

export const PlatformReleaseBootstrapOperationAbiV2Schema =
  PlatformReleaseBootstrapOperationAbiIdentityV2Schema.extend({
    operationHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const workingDirectoryBindingIsValid =
      TARGET_ROOT_BOUND_OPERATION_ABI_REFS_V2.has(value.abiRef)
        ? value.workingDirectoryPolicy
            === "authenticated_target_root_v2"
        : value.workingDirectoryPolicy
            === "installed_owner_package_root_v2";
    const implementationBindingIsValid =
      value.implementationKind === "signed_native_executable"
        ? value.processLaunchPolicy
            ===
              "exact_native_executable_then_fixed_application_argv_v2"
          && value.interpreterPackageRef === null
          && value.interpreterMemberRef === null
          && value.processExecutableMemberRef
            === value.implementationMemberRef
          && value.moduleExport === null
        : value.processLaunchPolicy
            ===
              "exact_node_runtime_then_release_executable_then_fixed_application_argv_v2"
          && value.interpreterPackageRef
            ===
              PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2
                .nodeToolchainProvisioner
          && value.interpreterMemberRef === "BOOTSTRAP_NODE_RUNTIME_V2"
          && value.processExecutableMemberRef
            !== value.implementationMemberRef
          && value.moduleExport !== null;
    if (
      value.directArgvTemplate[0] !== value.command
      || !workingDirectoryBindingIsValid
      || !implementationBindingIsValid
      || value.operationHash
        !== hashPlatformReleaseBootstrapOperationAbiV2(value)
    ) {
      context.addIssue({
        code: "custom",
        path: ["operationHash"],
        message:
          "Bootstrap operation ABI must bind its exact executable, implementation, export, command, and identity",
      });
    }
  });

export type PlatformReleaseBootstrapOperationAbiV2 =
  z.infer<typeof PlatformReleaseBootstrapOperationAbiV2Schema>;

const fixtureBindings =
  PLATFORM_RELEASE_HOST_COMPOSITION_REQUIREMENT_V2.operationBindings;

const operationIdentitiesV2 = [
  {
    schema: PLATFORM_RELEASE_BOOTSTRAP_OPERATION_ABI_V2_SCHEMA,
    abiRef: "ABI_PLATFORM_RELEASE_APPLY_LOCAL_ACCOUNT_V2",
    ownerPackageRef:
      PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.runtimeAccountProvisioner,
    implementationKind: "signed_native_executable",
    processExecutableMemberRef:
      "BOOTSTRAP_RUNTIME_ACCOUNT_PROVISIONER_EXECUTABLE_V2",
    implementationMemberRef:
      "BOOTSTRAP_RUNTIME_ACCOUNT_PROVISIONER_EXECUTABLE_V2",
    moduleExport: null,
    command: "apply-local-account-v2",
    inputSchema:
      "setfarm.platform-release-apply-local-account-input.v2",
    outputSchema:
      "setfarm.platform-release-apply-local-account-receipt.v2",
    directArgvTemplate: [
      "apply-local-account-v2",
      "SETFARM_PLATFORM_RELEASE_RUNTIME_V2",
    ],
    inputTransport:
      "preopened_read_only_fd3_exactly_once_v2",
    stdin: "closed",
    shell: "forbidden",
    inheritAmbientEnvironment: false,
    environmentPolicy:
      "exact_empty_environment_v2",
    workingDirectoryPolicy:
      "installed_owner_package_root_v2",
    timeoutMs: 30_000,
    maxStdoutBytes: 256 * 1024,
    maxStderrBytes: 64 * 1024,
    compatibilityBindingHash: null,
  },
  {
    schema: PLATFORM_RELEASE_BOOTSTRAP_OPERATION_ABI_V2_SCHEMA,
    abiRef: "ABI_PLATFORM_RELEASE_HOST_OPERATION_V2",
    ownerPackageRef:
      PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.platformReleaseComposition,
    implementationKind: "installed_release_module",
    processExecutableMemberRef:
      "BOOTSTRAP_RELEASE_COMPOSITION_EXECUTABLE_V2",
    implementationMemberRef:
      "BOOTSTRAP_RELEASE_COMPOSITION_MODULE_V2",
    moduleExport: "runPlatformReleaseHostOperationV2",
    command: "run-host-operation-v2",
    inputSchema:
      "setfarm.platform-release-host-operation-input.v2",
    outputSchema:
      "setfarm.platform-release-host-operation-receipt.v2",
    directArgvTemplate: [
      "run-host-operation-v2",
      "PLATFORM_RELEASE_HOST_OPERATION_V2",
    ],
    inputTransport:
      "preopened_read_only_fd3_exactly_once_v2",
    stdin: "closed",
    shell: "forbidden",
    inheritAmbientEnvironment: false,
    environmentPolicy:
      "exact_empty_environment_v2",
    workingDirectoryPolicy:
      "authenticated_target_root_v2",
    timeoutMs: 120_000,
    maxStdoutBytes: 1024 * 1024,
    maxStderrBytes: 256 * 1024,
    compatibilityBindingHash:
      fixtureBindings.releaseBootstrapAbiHash,
  },
  {
    schema: PLATFORM_RELEASE_BOOTSTRAP_OPERATION_ABI_V2_SCHEMA,
    abiRef: "ABI_PLATFORM_RELEASE_LOOKUP_LOCAL_ACCOUNT_V2",
    ownerPackageRef:
      PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.hostVerifier,
    implementationKind: "signed_native_executable",
    processExecutableMemberRef:
      "BOOTSTRAP_HOST_VERIFIER_EXECUTABLE_V2",
    implementationMemberRef:
      "BOOTSTRAP_HOST_VERIFIER_EXECUTABLE_V2",
    moduleExport: null,
    command: "lookup-local-account-v2",
    inputSchema:
      "setfarm.platform-release-lookup-local-account-input.v2",
    outputSchema:
      "setfarm.platform-release-lookup-local-account-receipt.v2",
    directArgvTemplate: [
      "lookup-local-account-v2",
      "SETFARM_PLATFORM_RELEASE_RUNTIME_V2",
    ],
    inputTransport:
      "preopened_read_only_fd3_exactly_once_v2",
    stdin: "closed",
    shell: "forbidden",
    inheritAmbientEnvironment: false,
    environmentPolicy:
      "exact_empty_environment_v2",
    workingDirectoryPolicy:
      "installed_owner_package_root_v2",
    timeoutMs: 10_000,
    maxStdoutBytes: 256 * 1024,
    maxStderrBytes: 64 * 1024,
    compatibilityBindingHash: null,
  },
  {
    schema: PLATFORM_RELEASE_BOOTSTRAP_OPERATION_ABI_V2_SCHEMA,
    abiRef: "ABI_PLATFORM_RELEASE_METADATA_PROBE_V2",
    ownerPackageRef:
      PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.platformReleaseComposition,
    implementationKind: "installed_release_module",
    processExecutableMemberRef:
      "BOOTSTRAP_RELEASE_COMPOSITION_EXECUTABLE_V2",
    implementationMemberRef:
      "BOOTSTRAP_RELEASE_COMPOSITION_METADATA_MODULE_V2",
    moduleExport: "runPlatformReleaseMetadataProbeV2",
    command: "run-metadata-probe-v2",
    inputSchema:
      "setfarm.platform-release-metadata-probe-input.v2",
    outputSchema:
      "setfarm.platform-release-metadata-probe-receipt.v2",
    directArgvTemplate: [
      "run-metadata-probe-v2",
      "PLATFORM_RELEASE_METADATA_PROBE_V2",
    ],
    inputTransport:
      "preopened_read_only_fd3_exactly_once_v2",
    stdin: "closed",
    shell: "forbidden",
    inheritAmbientEnvironment: false,
    environmentPolicy:
      "exact_empty_environment_v2",
    workingDirectoryPolicy:
      "authenticated_target_root_v2",
    timeoutMs: 30_000,
    maxStdoutBytes: 1024 * 1024,
    maxStderrBytes: 256 * 1024,
    compatibilityBindingHash:
      fixtureBindings.metadataOperationAbiHash,
  },
  {
    schema: PLATFORM_RELEASE_BOOTSTRAP_OPERATION_ABI_V2_SCHEMA,
    abiRef: "ABI_PLATFORM_RELEASE_MODULE_EXPORT_PROBE_V2",
    ownerPackageRef:
      PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.platformReleaseComposition,
    implementationKind: "installed_release_module",
    processExecutableMemberRef:
      "BOOTSTRAP_RELEASE_COMPOSITION_EXECUTABLE_V2",
    implementationMemberRef:
      "BOOTSTRAP_RELEASE_COMPOSITION_MODULE_V2",
    moduleExport: "runPlatformReleaseModuleExportProbeV2",
    command: "run-module-export-probe-v2",
    inputSchema:
      "setfarm.platform-release-module-export-probe-input.v2",
    outputSchema:
      "setfarm.platform-release-module-export-probe-receipt.v2",
    directArgvTemplate: [
      "run-module-export-probe-v2",
      "PLATFORM_RELEASE_MODULE_EXPORT_PROBE_V2",
    ],
    inputTransport:
      "preopened_read_only_fd3_exactly_once_v2",
    stdin: "closed",
    shell: "forbidden",
    inheritAmbientEnvironment: false,
    environmentPolicy:
      "exact_empty_environment_v2",
    workingDirectoryPolicy:
      "authenticated_target_root_v2",
    timeoutMs: 30_000,
    maxStdoutBytes: 1024 * 1024,
    maxStderrBytes: 256 * 1024,
    compatibilityBindingHash:
      fixtureBindings.moduleExportOperationAbiHash,
  },
  {
    schema: PLATFORM_RELEASE_BOOTSTRAP_OPERATION_ABI_V2_SCHEMA,
    abiRef: "ABI_PLATFORM_RELEASE_NETWORK_NEGATIVE_PROBE_V2",
    ownerPackageRef:
      PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.platformReleaseComposition,
    implementationKind: "installed_release_module",
    processExecutableMemberRef:
      "BOOTSTRAP_RELEASE_COMPOSITION_EXECUTABLE_V2",
    implementationMemberRef:
      "BOOTSTRAP_RELEASE_COMPOSITION_NETWORK_WRAPPER_MODULE_V2",
    moduleExport: "runPlatformReleaseNetworkNegativeProbeV2",
    command: "run-network-negative-probe-v2",
    inputSchema:
      "setfarm.platform-release-network-negative-probe-input.v2",
    outputSchema:
      "setfarm.platform-release-network-negative-probe-receipt.v2",
    directArgvTemplate: [
      "run-network-negative-probe-v2",
      "PLATFORM_RELEASE_NETWORK_NEGATIVE_PROBE_V2",
    ],
    inputTransport:
      "preopened_read_only_fd3_exactly_once_v2",
    stdin: "closed",
    shell: "forbidden",
    inheritAmbientEnvironment: false,
    environmentPolicy:
      "exact_empty_environment_v2",
    workingDirectoryPolicy:
      "authenticated_target_root_v2",
    timeoutMs: 30_000,
    maxStdoutBytes: 1024 * 1024,
    maxStderrBytes: 256 * 1024,
    compatibilityBindingHash:
      fixtureBindings.networkOperationAbiHash,
  },
  {
    schema: PLATFORM_RELEASE_BOOTSTRAP_OPERATION_ABI_V2_SCHEMA,
    abiRef: "ABI_PLATFORM_RELEASE_PLAN_LOCAL_ACCOUNT_V2",
    ownerPackageRef:
      PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.runtimeAccountProvisioner,
    implementationKind: "signed_native_executable",
    processExecutableMemberRef:
      "BOOTSTRAP_RUNTIME_ACCOUNT_PROVISIONER_EXECUTABLE_V2",
    implementationMemberRef:
      "BOOTSTRAP_RUNTIME_ACCOUNT_PROVISIONER_EXECUTABLE_V2",
    moduleExport: null,
    command: "plan-local-account-v2",
    inputSchema:
      "setfarm.platform-release-plan-local-account-input.v2",
    outputSchema:
      "setfarm.platform-release-plan-local-account-receipt.v2",
    directArgvTemplate: [
      "plan-local-account-v2",
      "SETFARM_PLATFORM_RELEASE_RUNTIME_V2",
    ],
    inputTransport:
      "preopened_read_only_fd3_exactly_once_v2",
    stdin: "closed",
    shell: "forbidden",
    inheritAmbientEnvironment: false,
    environmentPolicy:
      "exact_empty_environment_v2",
    workingDirectoryPolicy:
      "installed_owner_package_root_v2",
    timeoutMs: 10_000,
    maxStdoutBytes: 256 * 1024,
    maxStderrBytes: 64 * 1024,
    compatibilityBindingHash: null,
  },
  {
    schema: PLATFORM_RELEASE_BOOTSTRAP_OPERATION_ABI_V2_SCHEMA,
    abiRef: "ABI_PLATFORM_RELEASE_ROLLBACK_LOCAL_ACCOUNT_V2",
    ownerPackageRef:
      PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.runtimeAccountProvisioner,
    implementationKind: "signed_native_executable",
    processExecutableMemberRef:
      "BOOTSTRAP_RUNTIME_ACCOUNT_PROVISIONER_EXECUTABLE_V2",
    implementationMemberRef:
      "BOOTSTRAP_RUNTIME_ACCOUNT_PROVISIONER_EXECUTABLE_V2",
    moduleExport: null,
    command: "rollback-local-account-v2",
    inputSchema:
      "setfarm.platform-release-rollback-local-account-input.v2",
    outputSchema:
      "setfarm.platform-release-rollback-local-account-receipt.v2",
    directArgvTemplate: [
      "rollback-local-account-v2",
      "SETFARM_PLATFORM_RELEASE_RUNTIME_V2",
    ],
    inputTransport:
      "preopened_read_only_fd3_exactly_once_v2",
    stdin: "closed",
    shell: "forbidden",
    inheritAmbientEnvironment: false,
    environmentPolicy:
      "exact_empty_environment_v2",
    workingDirectoryPolicy:
      "installed_owner_package_root_v2",
    timeoutMs: 30_000,
    maxStdoutBytes: 256 * 1024,
    maxStderrBytes: 64 * 1024,
    compatibilityBindingHash: null,
  },
  {
    schema: PLATFORM_RELEASE_BOOTSTRAP_OPERATION_ABI_V2_SCHEMA,
    abiRef: "ABI_PLATFORM_RELEASE_SELF_ATTEST_V2",
    ownerPackageRef:
      PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.hostVerifier,
    implementationKind: "signed_native_executable",
    processExecutableMemberRef:
      "BOOTSTRAP_HOST_VERIFIER_EXECUTABLE_V2",
    implementationMemberRef:
      "BOOTSTRAP_HOST_VERIFIER_EXECUTABLE_V2",
    moduleExport: null,
    command: "self-attest-v2",
    inputSchema:
      "setfarm.platform-release-self-attest-input.v2",
    outputSchema:
      "setfarm.platform-release-self-attest-receipt.v2",
    directArgvTemplate: ["self-attest-v2"],
    inputTransport:
      "preopened_read_only_fd3_exactly_once_v2",
    stdin: "closed",
    shell: "forbidden",
    inheritAmbientEnvironment: false,
    environmentPolicy:
      "exact_empty_environment_v2",
    workingDirectoryPolicy:
      "installed_owner_package_root_v2",
    timeoutMs: 10_000,
    maxStdoutBytes: 256 * 1024,
    maxStderrBytes: 64 * 1024,
    compatibilityBindingHash:
      fixtureBindings.verifierAbiHash,
  },
  {
    schema: PLATFORM_RELEASE_BOOTSTRAP_OPERATION_ABI_V2_SCHEMA,
    abiRef: "ABI_PLATFORM_RELEASE_VERIFY_PACKAGE_V2",
    ownerPackageRef:
      PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.hostVerifier,
    implementationKind: "signed_native_executable",
    processExecutableMemberRef:
      "BOOTSTRAP_HOST_VERIFIER_EXECUTABLE_V2",
    implementationMemberRef:
      "BOOTSTRAP_HOST_VERIFIER_EXECUTABLE_V2",
    moduleExport: null,
    command: "verify-package-v2",
    inputSchema:
      "setfarm.platform-release-verify-package-input.v2",
    outputSchema:
      "setfarm.platform-release-verify-package-receipt.v2",
    directArgvTemplate: [
      "verify-package-v2",
      "BOOTSTRAP_REGISTERED_PACKAGE_REF_V2",
    ],
    inputTransport:
      "preopened_read_only_fd3_exactly_once_v2",
    stdin: "closed",
    shell: "forbidden",
    inheritAmbientEnvironment: false,
    environmentPolicy:
      "exact_empty_environment_v2",
    workingDirectoryPolicy:
      "installed_owner_package_root_v2",
    timeoutMs: 30_000,
    maxStdoutBytes: 1024 * 1024,
    maxStderrBytes: 256 * 1024,
    compatibilityBindingHash: null,
  },
  {
    schema: PLATFORM_RELEASE_BOOTSTRAP_OPERATION_ABI_V2_SCHEMA,
    abiRef: "ABI_PLATFORM_RELEASE_VERIFY_SYSTEM_ANCHORS_V2",
    ownerPackageRef:
      PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.hostVerifier,
    implementationKind: "signed_native_executable",
    processExecutableMemberRef:
      "BOOTSTRAP_HOST_VERIFIER_EXECUTABLE_V2",
    implementationMemberRef:
      "BOOTSTRAP_HOST_VERIFIER_EXECUTABLE_V2",
    moduleExport: null,
    command: "verify-system-anchors-v2",
    inputSchema:
      "setfarm.platform-release-verify-system-anchors-input.v2",
    outputSchema:
      "setfarm.platform-release-verify-system-anchors-receipt.v2",
    directArgvTemplate: ["verify-system-anchors-v2"],
    inputTransport:
      "preopened_read_only_fd3_exactly_once_v2",
    stdin: "closed",
    shell: "forbidden",
    inheritAmbientEnvironment: false,
    environmentPolicy:
      "exact_empty_environment_v2",
    workingDirectoryPolicy:
      "installed_owner_package_root_v2",
    timeoutMs: 30_000,
    maxStdoutBytes: 1024 * 1024,
    maxStderrBytes: 256 * 1024,
    compatibilityBindingHash: null,
  },
] as const;

function buildOperation(
  identity: PlatformReleaseBootstrapOperationAbiHashPayloadV2,
): PlatformReleaseBootstrapOperationAbiV2 {
  return {
    ...identity,
    operationHash:
      hashPlatformReleaseBootstrapOperationAbiV2(identity),
  };
}

const operationsV2 = operationIdentitiesV2.map((identity) =>
  buildOperation({
    ...identity,
    ...(
      identity.implementationKind === "signed_native_executable"
        ? {
          processLaunchPolicy:
            "exact_native_executable_then_fixed_application_argv_v2",
          interpreterPackageRef: null,
          interpreterMemberRef: null,
        }
        : {
          processLaunchPolicy:
            "exact_node_runtime_then_release_executable_then_fixed_application_argv_v2",
          interpreterPackageRef:
            PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2
              .nodeToolchainProvisioner,
          interpreterMemberRef: "BOOTSTRAP_NODE_RUNTIME_V2",
        }
    ),
    directArgvTemplate: [...identity.directArgvTemplate],
    processEvidencePolicy:
      "outer_host_owner_binds_exit_termination_stdout_stderr_and_occurrence_v2",
  }));

const PlatformReleaseBootstrapOperationAbiSetIdentityV2Schema =
  z.object({
    schema: z.literal(
      PLATFORM_RELEASE_BOOTSTRAP_OPERATION_ABI_SET_V2_SCHEMA,
    ),
    version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
    authorityRef: z.literal(
      PLATFORM_RELEASE_BOOTSTRAP_OPERATION_ABI_SET_AUTHORITY_REF_V2,
    ),
    policy: z.literal(
      "fixed_argv_no_shell_no_ambient_environment_bounded_canonical_receipts_v2",
    ),
    productionUse: z.literal(
      "forbidden_until_signed_packages_and_leaf_authorities_exist",
    ),
    operationCount: z.literal(
      PLATFORM_RELEASE_BOOTSTRAP_OPERATION_ABI_COUNT_V2,
    ),
    wireContractSetHash: Sha256Schema,
    operations: z.array(
      PlatformReleaseBootstrapOperationAbiV2Schema,
    ).length(PLATFORM_RELEASE_BOOTSTRAP_OPERATION_ABI_COUNT_V2),
    sandboxPolicyHash: Sha256Schema,
    fixtureRequirementHash: Sha256Schema,
  }).strict();

export type PlatformReleaseBootstrapOperationAbiSetHashPayloadV2 =
  z.infer<
    typeof PlatformReleaseBootstrapOperationAbiSetIdentityV2Schema
  >;

export function hashPlatformReleaseBootstrapOperationAbiSetV2(
  value:
    | PlatformReleaseBootstrapOperationAbiSetHashPayloadV2
    | PlatformReleaseBootstrapOperationAbiSetV2,
): string {
  const abiSet = { ...value } as Record<string, unknown>;
  delete abiSet.abiSetHash;
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-bootstrap-operation-abi-set-hash.v2",
    abiSet,
  });
}

const operationAbiSetIdentityV2 = {
  schema: PLATFORM_RELEASE_BOOTSTRAP_OPERATION_ABI_SET_V2_SCHEMA,
  version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
  authorityRef:
    PLATFORM_RELEASE_BOOTSTRAP_OPERATION_ABI_SET_AUTHORITY_REF_V2,
  policy:
    "fixed_argv_no_shell_no_ambient_environment_bounded_canonical_receipts_v2",
  productionUse:
    "forbidden_until_signed_packages_and_leaf_authorities_exist",
  operationCount:
    PLATFORM_RELEASE_BOOTSTRAP_OPERATION_ABI_COUNT_V2,
  wireContractSetHash:
    PLATFORM_RELEASE_BOOTSTRAP_WIRE_CONTRACT_SET_V2.contractSetHash,
  operations: operationsV2,
  sandboxPolicyHash: fixtureBindings.sandboxPolicyHash,
  fixtureRequirementHash:
    PLATFORM_RELEASE_HOST_COMPOSITION_REQUIREMENT_V2.requirementHash,
} as const;

export const PlatformReleaseBootstrapOperationAbiSetV2Schema =
  PlatformReleaseBootstrapOperationAbiSetIdentityV2Schema.extend({
    abiSetHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const { abiSetHash: _abiSetHash, ...identity } = value;
    const wireBySchemaRef = new Map(
      PLATFORM_RELEASE_BOOTSTRAP_WIRE_CONTRACT_SET_V2.schemas
        .map((entry) => [entry.schemaRef, entry] as const),
    );
    const operationWireSchemaRefs = new Set(
      value.operations.flatMap((operation) => [
        operation.inputSchema,
        operation.outputSchema,
      ]),
    );
    const wireContractsAreComplete =
      operationWireSchemaRefs.size === value.operations.length * 2
      && PLATFORM_RELEASE_BOOTSTRAP_WIRE_CONTRACT_SET_V2.schemas.length
        === operationWireSchemaRefs.size + 1
      && PLATFORM_RELEASE_BOOTSTRAP_WIRE_CONTRACT_SET_V2.schemas
        .every((wireContract) =>
          wireContract.schemaRef
            === PLATFORM_RELEASE_BOOTSTRAP_OPERATION_FAILURE_V2_SCHEMA
          || operationWireSchemaRefs.has(wireContract.schemaRef))
      && value.operations.every((operation) =>
        wireBySchemaRef.get(operation.inputSchema)?.messageKind
          === "operation_input"
        && wireBySchemaRef.get(operation.inputSchema)?.transport
          === operation.inputTransport
        && wireBySchemaRef.get(operation.outputSchema)?.messageKind
          === "operation_success");
    if (
      !platformReleaseCandidateFitsCanonicalCapV2(
        value,
        PLATFORM_RELEASE_BOOTSTRAP_OPERATION_ABI_SET_MAX_CANONICAL_BYTES_V2,
      )
      || value.wireContractSetHash
        !== PLATFORM_RELEASE_BOOTSTRAP_WIRE_CONTRACT_SET_V2.contractSetHash
      || !wireContractsAreComplete
      || canonicalJsonStringify(identity)
        !== canonicalJsonStringify(operationAbiSetIdentityV2)
      || value.abiSetHash
        !== hashPlatformReleaseBootstrapOperationAbiSetV2(identity)
      || value.operations.some((operation, index) =>
        index > 0
        && value.operations[index - 1]!.abiRef >= operation.abiRef)
    ) {
      context.addIssue({
        code: "custom",
        path: ["abiSetHash"],
        message:
          "Bootstrap operation ABI set must equal the exact code-owned ordered contract",
      });
    }
  });

export type PlatformReleaseBootstrapOperationAbiSetV2 =
  z.infer<typeof PlatformReleaseBootstrapOperationAbiSetV2Schema>;

export const PLATFORM_RELEASE_BOOTSTRAP_OPERATION_ABI_SET_V2:
PlatformReleaseBootstrapOperationAbiSetV2 =
  deepFreezePlatformReleaseJsonV2({
    ...PlatformReleaseBootstrapOperationAbiSetV2Schema.parse({
      ...operationAbiSetIdentityV2,
      abiSetHash:
        hashPlatformReleaseBootstrapOperationAbiSetV2(
          operationAbiSetIdentityV2,
        ),
    }),
  });

export function getPlatformReleaseBootstrapOperationAbiSetV2():
PlatformReleaseBootstrapOperationAbiSetV2 {
  return deepFreezePlatformReleaseJsonV2(
    structuredClone(
      PLATFORM_RELEASE_BOOTSTRAP_OPERATION_ABI_SET_V2,
    ),
  );
}

export function parsePlatformReleaseBootstrapOperationAbiSetCandidateV2(
  input: unknown,
): PlatformReleaseBootstrapOperationAbiSetV2 {
  const snapshot = boundedPlatformReleaseJsonSnapshotV2(
    input,
    PLATFORM_RELEASE_BOOTSTRAP_OPERATION_ABI_SET_MAX_CANONICAL_BYTES_V2,
  );
  return deepFreezePlatformReleaseJsonV2(
    PlatformReleaseBootstrapOperationAbiSetV2Schema.parse(snapshot),
  );
}
