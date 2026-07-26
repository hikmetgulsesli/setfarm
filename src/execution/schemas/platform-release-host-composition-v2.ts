import { z } from "zod";

import {
  canonicalJsonStringify,
  hashCanonicalJson,
} from "../../product-compiler/canonical-json.js";
import {
  Sha256Schema,
} from "../../product-compiler/schemas/common-v1.js";
import {
  PLATFORM_RELEASE_COMPONENT_VERSION_V2,
  boundedPlatformReleaseJsonSnapshotV2,
  deepFreezePlatformReleaseJsonV2,
  platformReleaseCandidateFitsCanonicalCapV2,
} from "./platform-release-common-v2.js";

export const PLATFORM_RELEASE_HOST_COMPOSITION_REQUIREMENT_V2_SCHEMA =
  "setfarm.platform-release-host-composition-requirement.v2" as const;
export const PLATFORM_RELEASE_HOST_COMPOSITION_PLATFORM_PROJECTION_V2_SCHEMA =
  "setfarm.platform-release-host-composition-platform-projection.v2" as const;
export const PLATFORM_RELEASE_HOST_COMPOSITION_FILE_RECEIPT_V2_SCHEMA =
  "setfarm.platform-release-host-composition-file-receipt.v2" as const;
export const PLATFORM_RELEASE_HOST_COMPOSITION_RUNTIME_ACCOUNT_RECEIPT_V2_SCHEMA =
  "setfarm.platform-release-host-composition-runtime-account-receipt.v2" as const;
export const PLATFORM_RELEASE_HOST_COMPOSITION_INSTALLATION_RECEIPT_V2_SCHEMA =
  "setfarm.platform-release-host-composition-installation-receipt.v2" as const;
export const PLATFORM_RELEASE_HOST_COMPOSITION_RECEIPT_V2_SCHEMA =
  "setfarm.platform-release-host-composition-receipt.v2" as const;
export const PLATFORM_RELEASE_HOST_COMPOSITION_AUTHORITY_REF_V2 =
  "AUTH_PLATFORM_RELEASE_HOST_COMPOSITION_V2" as const;
export const PLATFORM_RELEASE_HOST_COMPOSITION_AUTHORITY_VERSION_V2 =
  "2.0.0" as const;
export const PLATFORM_RELEASE_HOST_COMPOSITION_FILE_COUNT_V2 = 10;
export const PLATFORM_RELEASE_HOST_COMPOSITION_FILE_MAX_BYTES_V2 =
  16 * 1024 * 1024;
export const PLATFORM_RELEASE_HOST_COMPOSITION_RECEIPT_MAX_CANONICAL_BYTES_V2 =
  512 * 1024;

const PosixIdentityV2Schema = z.number().int().nonnegative()
  .max(4_294_967_294);
const CanonicalDecimalV2Schema = z.string().min(1).max(80)
  .regex(/^(?:0|[1-9][0-9]*)$/u);
const HostVersionV2Schema = z.string().min(1).max(80)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._+-]*$/u);

export const PLATFORM_RELEASE_HOST_COMPOSITION_ROLE_REQUIREMENTS_V2 =
  deepFreezePlatformReleaseJsonV2([
    {
      role: "release_bootstrap_executable",
      fileRef: "HOST_COMPOSITION_RELEASE_BOOTSTRAP_EXECUTABLE_V2",
      origin: "release_bootstrap_package",
      requiredMode: "0555",
      maxBytes: PLATFORM_RELEASE_HOST_COMPOSITION_FILE_MAX_BYTES_V2,
      requiredExports: [],
    },
    {
      role: "release_bootstrap_module",
      fileRef: "HOST_COMPOSITION_RELEASE_BOOTSTRAP_MODULE_V2",
      origin: "release_bootstrap_package",
      requiredMode: "0444",
      maxBytes: PLATFORM_RELEASE_HOST_COMPOSITION_FILE_MAX_BYTES_V2,
      requiredExports: [
        "runPlatformReleaseHostOperationV2",
        "runPlatformReleaseModuleExportProbeV2",
      ],
    },
    {
      role: "host_verifier_executable",
      fileRef: "HOST_COMPOSITION_HOST_VERIFIER_EXECUTABLE_V2",
      origin: "host_verifier_package",
      requiredMode: "0555",
      maxBytes: PLATFORM_RELEASE_HOST_COMPOSITION_FILE_MAX_BYTES_V2,
      requiredExports: [],
    },
    {
      role: "metadata_bootstrap_module",
      fileRef: "HOST_COMPOSITION_METADATA_BOOTSTRAP_MODULE_V2",
      origin: "release_bootstrap_package",
      requiredMode: "0444",
      maxBytes: PLATFORM_RELEASE_HOST_COMPOSITION_FILE_MAX_BYTES_V2,
      requiredExports: [
        "runPlatformReleaseMetadataProbeV2",
      ],
    },
    {
      role: "xattr_observer_executable",
      fileRef: "HOST_COMPOSITION_XATTR_OBSERVER_EXECUTABLE_V2",
      origin: "fixed_system_tool",
      requiredMode: "0755",
      maxBytes: PLATFORM_RELEASE_HOST_COMPOSITION_FILE_MAX_BYTES_V2,
      requiredExports: [],
    },
    {
      role: "xattr_clear_executable",
      fileRef: "HOST_COMPOSITION_XATTR_CLEAR_EXECUTABLE_V2",
      origin: "fixed_system_tool",
      requiredMode: "0755",
      maxBytes: PLATFORM_RELEASE_HOST_COMPOSITION_FILE_MAX_BYTES_V2,
      requiredExports: [],
    },
    {
      role: "acl_observer_executable",
      fileRef: "HOST_COMPOSITION_ACL_OBSERVER_EXECUTABLE_V2",
      origin: "fixed_system_tool",
      requiredMode: "0755",
      maxBytes: PLATFORM_RELEASE_HOST_COMPOSITION_FILE_MAX_BYTES_V2,
      requiredExports: [],
    },
    {
      role: "acl_clear_executable",
      fileRef: "HOST_COMPOSITION_ACL_CLEAR_EXECUTABLE_V2",
      origin: "fixed_system_tool",
      requiredMode: "0755",
      maxBytes: PLATFORM_RELEASE_HOST_COMPOSITION_FILE_MAX_BYTES_V2,
      requiredExports: [],
    },
    {
      role: "sandbox_executable",
      fileRef: "HOST_COMPOSITION_SANDBOX_EXECUTABLE_V2",
      origin: "fixed_system_tool",
      requiredMode: "0755",
      maxBytes: PLATFORM_RELEASE_HOST_COMPOSITION_FILE_MAX_BYTES_V2,
      requiredExports: [],
    },
    {
      role: "network_wrapper_module",
      fileRef: "HOST_COMPOSITION_NETWORK_WRAPPER_MODULE_V2",
      origin: "release_bootstrap_package",
      requiredMode: "0444",
      maxBytes: PLATFORM_RELEASE_HOST_COMPOSITION_FILE_MAX_BYTES_V2,
      requiredExports: [
        "runPlatformReleaseNetworkNegativeProbeV2",
      ],
    },
  ] as const);

const PlatformReleaseHostCompositionRoleV2Schema = z.enum([
  "release_bootstrap_executable",
  "release_bootstrap_module",
  "host_verifier_executable",
  "metadata_bootstrap_module",
  "xattr_observer_executable",
  "xattr_clear_executable",
  "acl_observer_executable",
  "acl_clear_executable",
  "sandbox_executable",
  "network_wrapper_module",
]);

const PlatformReleaseHostCompositionFileRefV2Schema = z.enum([
  "HOST_COMPOSITION_RELEASE_BOOTSTRAP_EXECUTABLE_V2",
  "HOST_COMPOSITION_RELEASE_BOOTSTRAP_MODULE_V2",
  "HOST_COMPOSITION_HOST_VERIFIER_EXECUTABLE_V2",
  "HOST_COMPOSITION_METADATA_BOOTSTRAP_MODULE_V2",
  "HOST_COMPOSITION_XATTR_OBSERVER_EXECUTABLE_V2",
  "HOST_COMPOSITION_XATTR_CLEAR_EXECUTABLE_V2",
  "HOST_COMPOSITION_ACL_OBSERVER_EXECUTABLE_V2",
  "HOST_COMPOSITION_ACL_CLEAR_EXECUTABLE_V2",
  "HOST_COMPOSITION_SANDBOX_EXECUTABLE_V2",
  "HOST_COMPOSITION_NETWORK_WRAPPER_MODULE_V2",
]);

const PlatformReleaseHostCompositionParentRefV2Schema = z.enum([
  "HOST_COMPOSITION_BIN_PARENT_V2",
  "HOST_COMPOSITION_LIB_PARENT_V2",
  "HOST_COMPOSITION_TOOLS_PARENT_V2",
]);

const roleRequirementV2Schema = z.object({
  role: PlatformReleaseHostCompositionRoleV2Schema,
  fileRef: PlatformReleaseHostCompositionFileRefV2Schema,
  origin: z.enum([
    "release_bootstrap_package",
    "host_verifier_package",
    "fixed_system_tool",
  ]),
  requiredMode: z.enum(["0444", "0555", "0755"]),
  maxBytes: z.literal(
    PLATFORM_RELEASE_HOST_COMPOSITION_FILE_MAX_BYTES_V2,
  ),
  requiredExports: z.array(z.enum([
    "runPlatformReleaseHostOperationV2",
    "runPlatformReleaseModuleExportProbeV2",
    "runPlatformReleaseMetadataProbeV2",
    "runPlatformReleaseNetworkNegativeProbeV2",
  ])).max(2),
}).strict();

const PLATFORM_RELEASE_HOST_COMPOSITION_OPERATION_BINDINGS_V2 =
  deepFreezePlatformReleaseJsonV2({
    releaseBootstrapAbiHash: hashCanonicalJson({
      schema:
        "setfarm.platform-release-host-composition-release-bootstrap-abi.v2",
      executableProtocol:
        "authenticated_node_direct_argv_closed_stdin_bounded_output_v2",
      moduleExport: "runPlatformReleaseHostOperationV2",
      moduleExportProbe:
        "runPlatformReleaseModuleExportProbeV2",
    }),
    metadataOperationAbiHash: hashCanonicalJson({
      schema:
        "setfarm.platform-release-host-composition-metadata-operation-abi.v2",
      operation:
        "observe_then_clear_xattr_and_acl_with_distinct_exact_roles_v2",
      moduleExport: "runPlatformReleaseMetadataProbeV2",
    }),
    networkOperationAbiHash: hashCanonicalJson({
      schema:
        "setfarm.platform-release-host-composition-network-operation-abi.v2",
      operation:
        "sandboxed_negative_network_probe_authenticated_wrapper_v2",
      moduleExport:
        "runPlatformReleaseNetworkNegativeProbeV2",
    }),
    moduleExportOperationAbiHash: hashCanonicalJson({
      schema:
        "setfarm.platform-release-host-composition-module-export-operation-abi.v2",
      operation:
        "load_exact_required_module_closure_and_verify_exports_v2",
    }),
    sandboxPolicyHash: hashCanonicalJson({
      schema:
        "setfarm.platform-release-host-composition-sandbox-policy.v2",
      network: "deny_all",
      filesystem: "private_output_read_only_except_owned_scratch",
      shell: "forbidden",
    }),
    verifierAbiHash: hashCanonicalJson({
      schema:
        "setfarm.platform-release-host-composition-verifier-abi.v2",
      protocol:
        "descriptor_capture_parent_anchor_every_and_only_membership_v2",
    }),
  });

const operationBindingsV2Schema = z.object({
  releaseBootstrapAbiHash: Sha256Schema,
  metadataOperationAbiHash: Sha256Schema,
  networkOperationAbiHash: Sha256Schema,
  moduleExportOperationAbiHash: Sha256Schema,
  sandboxPolicyHash: Sha256Schema,
  verifierAbiHash: Sha256Schema,
}).strict();

const platformReleaseHostCompositionRequirementIdentityV2 = {
  schema:
    PLATFORM_RELEASE_HOST_COMPOSITION_REQUIREMENT_V2_SCHEMA,
  purpose: "complete_platform_release_composition_v2" as const,
  fileSetPolicy:
    "exact_ordered_every_and_only_descriptor_captured_v2" as const,
  ownerPolicy:
    "production_root_owned_test_fixture_current_owner_v2" as const,
  runtimeAccountPolicy:
    "authenticated_unprivileged_uid_gid_distinct_from_file_owner_v2" as const,
  verifierPolicy:
    "one_independent_verifier_identity_binds_every_file_v2" as const,
  roleCount:
    PLATFORM_RELEASE_HOST_COMPOSITION_FILE_COUNT_V2 as 10,
  roles: [
    ...PLATFORM_RELEASE_HOST_COMPOSITION_ROLE_REQUIREMENTS_V2
      .map((role) => ({
        ...role,
        requiredExports: [...role.requiredExports],
      })),
  ],
  operationBindings:
    PLATFORM_RELEASE_HOST_COMPOSITION_OPERATION_BINDINGS_V2,
};

const PlatformReleaseHostCompositionRequirementIdentityV2Schema =
  z.object({
    schema: z.literal(
      PLATFORM_RELEASE_HOST_COMPOSITION_REQUIREMENT_V2_SCHEMA,
    ),
    purpose: z.literal(
      "complete_platform_release_composition_v2",
    ),
    fileSetPolicy: z.literal(
      "exact_ordered_every_and_only_descriptor_captured_v2",
    ),
    ownerPolicy: z.literal(
      "production_root_owned_test_fixture_current_owner_v2",
    ),
    runtimeAccountPolicy: z.literal(
      "authenticated_unprivileged_uid_gid_distinct_from_file_owner_v2",
    ),
    verifierPolicy: z.literal(
      "one_independent_verifier_identity_binds_every_file_v2",
    ),
    roleCount: z.literal(
      PLATFORM_RELEASE_HOST_COMPOSITION_FILE_COUNT_V2,
    ),
    roles: z.array(roleRequirementV2Schema).length(
      PLATFORM_RELEASE_HOST_COMPOSITION_FILE_COUNT_V2,
    ),
    operationBindings: operationBindingsV2Schema,
  }).strict();

export type PlatformReleaseHostCompositionRequirementHashPayloadV2 =
  z.infer<
    typeof PlatformReleaseHostCompositionRequirementIdentityV2Schema
  >;

export function hashPlatformReleaseHostCompositionRequirementV2(
  value: PlatformReleaseHostCompositionRequirementHashPayloadV2,
): string {
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-host-composition-requirement-hash.v2",
    requirement: value,
  });
}

export const PlatformReleaseHostCompositionRequirementV2Schema =
  PlatformReleaseHostCompositionRequirementIdentityV2Schema.extend({
    requirementHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const { requirementHash: _requirementHash, ...identity } =
      value;
    if (
      canonicalJsonStringify(identity)
        !== canonicalJsonStringify(
          platformReleaseHostCompositionRequirementIdentityV2,
        )
      || value.requirementHash
        !== hashPlatformReleaseHostCompositionRequirementV2(
          identity,
        )
    ) {
      context.addIssue({
        code: "custom",
        path: ["requirementHash"],
        message:
          "Host composition requirement must equal the exact code-owned role and operation contract",
      });
    }
  });

export type PlatformReleaseHostCompositionRequirementV2 =
  z.infer<
    typeof PlatformReleaseHostCompositionRequirementV2Schema
  >;

export const PLATFORM_RELEASE_HOST_COMPOSITION_REQUIREMENT_V2 =
  deepFreezePlatformReleaseJsonV2({
    ...platformReleaseHostCompositionRequirementIdentityV2,
    requirementHash:
      hashPlatformReleaseHostCompositionRequirementV2(
        platformReleaseHostCompositionRequirementIdentityV2,
      ),
  });

const PlatformReleaseHostIdentityV2Schema = z.object({
  platform: z.literal("darwin"),
  architecture: z.enum(["arm64", "x64"]),
  macosProductVersion: HostVersionV2Schema,
  macosBuildVersion: HostVersionV2Schema,
  darwinKernelRelease: HostVersionV2Schema,
}).strict();

export function hashPlatformReleaseHostCompositionHostIdentityV2(
  value: z.infer<typeof PlatformReleaseHostIdentityV2Schema>,
): string {
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-host-composition-host-identity-hash.v2",
    host: value,
  });
}

const PlatformReleaseHostCompositionPlatformProjectionIdentityV2Schema =
  z.object({
    schema: z.literal(
      PLATFORM_RELEASE_HOST_COMPOSITION_PLATFORM_PROJECTION_V2_SCHEMA,
    ),
    platformHostToolchainReceiptHash: Sha256Schema,
    host: PlatformReleaseHostIdentityV2Schema,
    hostIdentityHash: Sha256Schema,
    nodeIdentityHash: Sha256Schema,
    npmClosureHash: Sha256Schema,
    dynamicLibraryClosureHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (
      value.hostIdentityHash
        !== hashPlatformReleaseHostCompositionHostIdentityV2(
          value.host,
        )
    ) {
      context.addIssue({
        code: "custom",
        path: ["hostIdentityHash"],
        message:
          "Host composition platform projection must bind the exact host identity",
      });
    }
  });

export type PlatformReleaseHostCompositionPlatformProjectionHashPayloadV2 =
  z.infer<
    typeof PlatformReleaseHostCompositionPlatformProjectionIdentityV2Schema
  >;

export function hashPlatformReleaseHostCompositionPlatformProjectionV2(
  value:
    PlatformReleaseHostCompositionPlatformProjectionHashPayloadV2,
): string {
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-host-composition-platform-projection-hash.v2",
    projection: value,
  });
}

export const PlatformReleaseHostCompositionPlatformProjectionV2Schema =
  PlatformReleaseHostCompositionPlatformProjectionIdentityV2Schema
    .extend({
      projectionHash: Sha256Schema,
    }).strict().superRefine((value, context) => {
      const {
        projectionHash: _projectionHash,
        ...identity
      } = value;
      if (
        value.projectionHash
          !== hashPlatformReleaseHostCompositionPlatformProjectionV2(
            identity,
          )
      ) {
        context.addIssue({
          code: "custom",
          path: ["projectionHash"],
          message:
            "Host composition platform projection hash mismatch",
        });
      }
    });

export type PlatformReleaseHostCompositionPlatformProjectionV2 =
  z.infer<
    typeof PlatformReleaseHostCompositionPlatformProjectionV2Schema
  >;

const PlatformReleaseHostCompositionParentIdentityV2Schema =
  z.object({
    parentRef:
      PlatformReleaseHostCompositionParentRefV2Schema,
    device: CanonicalDecimalV2Schema,
    inode: CanonicalDecimalV2Schema,
    ownerUid: PosixIdentityV2Schema,
    ownerGid: PosixIdentityV2Schema,
    mode: z.enum(["0555", "0700", "0755"]),
    linkCount: CanonicalDecimalV2Schema,
    byteLength: CanonicalDecimalV2Schema,
    modifiedTimeNanoseconds: CanonicalDecimalV2Schema,
    changedTimeNanoseconds: CanonicalDecimalV2Schema,
  }).strict();

export type PlatformReleaseHostCompositionParentIdentityHashPayloadV2 =
  z.infer<
    typeof PlatformReleaseHostCompositionParentIdentityV2Schema
  >;

export function hashPlatformReleaseHostCompositionParentIdentityV2(
  value:
    PlatformReleaseHostCompositionParentIdentityHashPayloadV2,
): string {
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-host-composition-parent-identity-hash.v2",
    parent: value,
  });
}

const PlatformReleaseHostCompositionParentReceiptV2Schema =
  PlatformReleaseHostCompositionParentIdentityV2Schema.extend({
    identityHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const { identityHash: _identityHash, ...identity } = value;
    if (
      value.identityHash
        !== hashPlatformReleaseHostCompositionParentIdentityV2(
          identity,
        )
    ) {
      context.addIssue({
        code: "custom",
        path: ["identityHash"],
        message: "Host composition parent identity hash mismatch",
      });
    }
  });

const PlatformReleaseHostCompositionFilePhysicalIdentityV2Schema =
  z.object({
    role: PlatformReleaseHostCompositionRoleV2Schema,
    fileRef: PlatformReleaseHostCompositionFileRefV2Schema,
    origin: z.enum([
      "release_bootstrap_package",
      "host_verifier_package",
      "fixed_system_tool",
    ]),
    hostIdentityHash: Sha256Schema,
    contentHash: Sha256Schema,
    byteLength: z.number().int().positive()
      .max(PLATFORM_RELEASE_HOST_COMPOSITION_FILE_MAX_BYTES_V2),
    ownerUid: PosixIdentityV2Schema,
    ownerGid: PosixIdentityV2Schema,
    mode: z.enum(["0444", "0555", "0755"]),
    linkCount: z.literal(1),
    device: CanonicalDecimalV2Schema,
    inode: CanonicalDecimalV2Schema,
    modifiedTimeNanoseconds: CanonicalDecimalV2Schema,
    changedTimeNanoseconds: CanonicalDecimalV2Schema,
    parent: PlatformReleaseHostCompositionParentReceiptV2Schema,
  }).strict();

export type PlatformReleaseHostCompositionFilePhysicalIdentityHashPayloadV2 =
  z.infer<
    typeof PlatformReleaseHostCompositionFilePhysicalIdentityV2Schema
  >;

export function hashPlatformReleaseHostCompositionFilePhysicalIdentityV2(
  value:
    PlatformReleaseHostCompositionFilePhysicalIdentityHashPayloadV2,
): string {
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-host-composition-file-physical-identity-hash.v2",
    file: value,
  });
}

export function hashPlatformReleaseHostCompositionVerifierIdentityV2(
  value: Readonly<{
    verifierPhysicalIdentityHash: string;
    verifierAbiHash: string;
  }>,
): string {
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-host-composition-verifier-identity-hash.v2",
    ...value,
  });
}

export function hashPlatformReleaseHostCompositionVerifierBindingV2(
  value: Readonly<{
    verifierIdentityHash: string;
    filePhysicalIdentityHash: string;
    requirementHash: string;
  }>,
): string {
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-host-composition-verifier-binding-hash.v2",
    ...value,
  });
}

const PlatformReleaseHostCompositionFileReceiptIdentityV2Schema =
  PlatformReleaseHostCompositionFilePhysicalIdentityV2Schema
    .extend({
      schema: z.literal(
        PLATFORM_RELEASE_HOST_COMPOSITION_FILE_RECEIPT_V2_SCHEMA,
      ),
      receiptVersion: z.literal(
        PLATFORM_RELEASE_COMPONENT_VERSION_V2,
      ),
      physicalIdentityHash: Sha256Schema,
      verifierIdentityHash: Sha256Schema,
      verifierBindingHash: Sha256Schema,
    }).strict().superRefine((value, context) => {
      const physicalIdentity = {
        role: value.role,
        fileRef: value.fileRef,
        origin: value.origin,
        hostIdentityHash: value.hostIdentityHash,
        contentHash: value.contentHash,
        byteLength: value.byteLength,
        ownerUid: value.ownerUid,
        ownerGid: value.ownerGid,
        mode: value.mode,
        linkCount: value.linkCount,
        device: value.device,
        inode: value.inode,
        modifiedTimeNanoseconds:
          value.modifiedTimeNanoseconds,
        changedTimeNanoseconds:
          value.changedTimeNanoseconds,
        parent: value.parent,
      };
      if (
        value.physicalIdentityHash
          !== hashPlatformReleaseHostCompositionFilePhysicalIdentityV2(
            physicalIdentity,
          )
      ) {
        context.addIssue({
          code: "custom",
          path: ["physicalIdentityHash"],
          message:
            "Host composition file physical identity hash mismatch",
        });
      }
      if (
        value.verifierBindingHash
          !== hashPlatformReleaseHostCompositionVerifierBindingV2({
            verifierIdentityHash: value.verifierIdentityHash,
            filePhysicalIdentityHash:
              value.physicalIdentityHash,
            requirementHash:
              PLATFORM_RELEASE_HOST_COMPOSITION_REQUIREMENT_V2
                .requirementHash,
          })
      ) {
        context.addIssue({
          code: "custom",
          path: ["verifierBindingHash"],
          message:
            "Host composition file verifier binding mismatch",
        });
      }
    });

export type PlatformReleaseHostCompositionFileReceiptHashPayloadV2 =
  z.infer<
    typeof PlatformReleaseHostCompositionFileReceiptIdentityV2Schema
  >;

export function hashPlatformReleaseHostCompositionFileReceiptV2(
  value:
    | PlatformReleaseHostCompositionFileReceiptHashPayloadV2
    | PlatformReleaseHostCompositionFileReceiptV2,
): string {
  const receipt = { ...value } as Record<string, unknown>;
  delete receipt.receiptHash;
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-host-composition-file-receipt-hash.v2",
    receipt,
  });
}

export const PlatformReleaseHostCompositionFileReceiptV2Schema =
  PlatformReleaseHostCompositionFileReceiptIdentityV2Schema
    .extend({
      receiptHash: Sha256Schema,
    }).strict().superRefine((value, context) => {
      if (
        value.receiptHash
          !== hashPlatformReleaseHostCompositionFileReceiptV2(
            value,
          )
      ) {
        context.addIssue({
          code: "custom",
          path: ["receiptHash"],
          message: "Host composition file receipt hash mismatch",
        });
      }
    });

export type PlatformReleaseHostCompositionFileReceiptV2 =
  z.infer<
    typeof PlatformReleaseHostCompositionFileReceiptV2Schema
  >;

const PlatformReleaseHostCompositionRuntimeAccountReceiptIdentityV2Schema =
  z.object({
    schema: z.literal(
      PLATFORM_RELEASE_HOST_COMPOSITION_RUNTIME_ACCOUNT_RECEIPT_V2_SCHEMA,
    ),
    receiptVersion: z.literal(
      PLATFORM_RELEASE_COMPONENT_VERSION_V2,
    ),
    accountRef: z.enum([
      "SETFARM_PLATFORM_RELEASE_RUNTIME_V2",
      "TEST_FIXTURE_PLATFORM_RELEASE_RUNTIME_V2",
    ]),
    authorityState: z.enum([
      "durable_os_account_verified",
      "test_fixture_identity_unverified",
    ]),
    uid: PosixIdentityV2Schema.refine(
      (value) => value > 0,
      "Runtime UID must be unprivileged",
    ),
    gid: PosixIdentityV2Schema.refine(
      (value) => value > 0,
      "Runtime GID must be unprivileged",
    ),
    ownerSeparationPolicy: z.literal(
      "uid_gid_nonzero_and_distinct_from_every_host_file_owner_v2",
    ),
    hostIdentityHash: Sha256Schema,
  }).strict();

export type PlatformReleaseHostCompositionRuntimeAccountReceiptHashPayloadV2 =
  z.infer<
    typeof PlatformReleaseHostCompositionRuntimeAccountReceiptIdentityV2Schema
  >;

export function hashPlatformReleaseHostCompositionRuntimeAccountReceiptV2(
  value:
    | PlatformReleaseHostCompositionRuntimeAccountReceiptHashPayloadV2
    | PlatformReleaseHostCompositionRuntimeAccountReceiptV2,
): string {
  const receipt = { ...value } as Record<string, unknown>;
  delete receipt.receiptHash;
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-host-composition-runtime-account-receipt-hash.v2",
    receipt,
  });
}

export const PlatformReleaseHostCompositionRuntimeAccountReceiptV2Schema =
  PlatformReleaseHostCompositionRuntimeAccountReceiptIdentityV2Schema
    .extend({
      receiptHash: Sha256Schema,
    }).strict().superRefine((value, context) => {
      if (
        value.receiptHash
          !== hashPlatformReleaseHostCompositionRuntimeAccountReceiptV2(
            value,
          )
      ) {
        context.addIssue({
          code: "custom",
          path: ["receiptHash"],
          message:
            "Host composition runtime-account receipt hash mismatch",
        });
      }
    });

export type PlatformReleaseHostCompositionRuntimeAccountReceiptV2 =
  z.infer<
    typeof PlatformReleaseHostCompositionRuntimeAccountReceiptV2Schema
  >;

const PlatformReleaseHostCompositionInstallationReceiptIdentityV2Schema =
  z.object({
    schema: z.literal(
      PLATFORM_RELEASE_HOST_COMPOSITION_INSTALLATION_RECEIPT_V2_SCHEMA,
    ),
    receiptVersion: z.literal(
      PLATFORM_RELEASE_COMPONENT_VERSION_V2,
    ),
    filesystemProtection: z.enum([
      "root_owned_runtime_read_only",
      "test_fixture_only",
    ]),
    device: CanonicalDecimalV2Schema,
    inode: CanonicalDecimalV2Schema,
    ownerUid: PosixIdentityV2Schema,
    ownerGid: PosixIdentityV2Schema,
    mode: z.enum(["0555", "0700"]),
    linkCount: CanonicalDecimalV2Schema,
    byteLength: CanonicalDecimalV2Schema,
    modifiedTimeNanoseconds: CanonicalDecimalV2Schema,
    changedTimeNanoseconds: CanonicalDecimalV2Schema,
    directoryCount: z.literal(3),
    fileCount: z.literal(
      PLATFORM_RELEASE_HOST_COMPOSITION_FILE_COUNT_V2,
    ),
    totalBytes: z.number().int().positive().max(
      PLATFORM_RELEASE_HOST_COMPOSITION_FILE_COUNT_V2
        * PLATFORM_RELEASE_HOST_COMPOSITION_FILE_MAX_BYTES_V2,
    ),
    fileSetMembershipHash: Sha256Schema,
  }).strict();

export type PlatformReleaseHostCompositionInstallationReceiptHashPayloadV2 =
  z.infer<
    typeof PlatformReleaseHostCompositionInstallationReceiptIdentityV2Schema
  >;

export function hashPlatformReleaseHostCompositionInstallationReceiptV2(
  value:
    | PlatformReleaseHostCompositionInstallationReceiptHashPayloadV2
    | PlatformReleaseHostCompositionInstallationReceiptV2,
): string {
  const receipt = { ...value } as Record<string, unknown>;
  delete receipt.receiptHash;
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-host-composition-installation-receipt-hash.v2",
    receipt,
  });
}

export const PlatformReleaseHostCompositionInstallationReceiptV2Schema =
  PlatformReleaseHostCompositionInstallationReceiptIdentityV2Schema
    .extend({
      receiptHash: Sha256Schema,
    }).strict().superRefine((value, context) => {
      if (
        value.receiptHash
          !== hashPlatformReleaseHostCompositionInstallationReceiptV2(
            value,
          )
      ) {
        context.addIssue({
          code: "custom",
          path: ["receiptHash"],
          message:
            "Host composition installation receipt hash mismatch",
        });
      }
    });

export type PlatformReleaseHostCompositionInstallationReceiptV2 =
  z.infer<
    typeof PlatformReleaseHostCompositionInstallationReceiptV2Schema
  >;

export function hashPlatformReleaseHostCompositionFileSetMembershipV2(
  files: readonly PlatformReleaseHostCompositionFileReceiptV2[],
): string {
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-host-composition-file-set-membership-hash.v2",
    members: files.map((file) => ({
      role: file.role,
      fileRef: file.fileRef,
      physicalIdentityHash: file.physicalIdentityHash,
      receiptHash: file.receiptHash,
    })),
  });
}

export function hashPlatformReleaseHostCompositionPhysicalClosureV2(
  files: readonly PlatformReleaseHostCompositionFileReceiptV2[],
): string {
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-host-composition-physical-closure-hash.v2",
    orderedFileReceiptHashes:
      files.map((file) => file.receiptHash),
  });
}

const PlatformReleaseHostCompositionReceiptIdentityV2Schema =
  z.object({
    schema: z.literal(
      PLATFORM_RELEASE_HOST_COMPOSITION_RECEIPT_V2_SCHEMA,
    ),
    receiptVersion: z.literal(
      PLATFORM_RELEASE_COMPONENT_VERSION_V2,
    ),
    authorityRef: z.literal(
      PLATFORM_RELEASE_HOST_COMPOSITION_AUTHORITY_REF_V2,
    ),
    authorityVersion: z.literal(
      PLATFORM_RELEASE_HOST_COMPOSITION_AUTHORITY_VERSION_V2,
    ),
    status: z.literal("verified"),
    authorityState: z.literal(
      "fresh_exact_physical_admission",
    ),
    admissionScope: z.enum([
      "production_host",
      "test_fixture",
    ]),
    productionUse: z.enum([
      "production_host_private_capability_only",
      "forbidden_test_fixture",
    ]),
    requirement:
      PlatformReleaseHostCompositionRequirementV2Schema,
    platformHost:
      PlatformReleaseHostCompositionPlatformProjectionV2Schema,
    runtimeAccount:
      PlatformReleaseHostCompositionRuntimeAccountReceiptV2Schema,
    installation:
      PlatformReleaseHostCompositionInstallationReceiptV2Schema,
    verifierIdentityHash: Sha256Schema,
    files: z.tuple([
      PlatformReleaseHostCompositionFileReceiptV2Schema,
      PlatformReleaseHostCompositionFileReceiptV2Schema,
      PlatformReleaseHostCompositionFileReceiptV2Schema,
      PlatformReleaseHostCompositionFileReceiptV2Schema,
      PlatformReleaseHostCompositionFileReceiptV2Schema,
      PlatformReleaseHostCompositionFileReceiptV2Schema,
      PlatformReleaseHostCompositionFileReceiptV2Schema,
      PlatformReleaseHostCompositionFileReceiptV2Schema,
      PlatformReleaseHostCompositionFileReceiptV2Schema,
      PlatformReleaseHostCompositionFileReceiptV2Schema,
    ]),
    fileCount: z.literal(
      PLATFORM_RELEASE_HOST_COMPOSITION_FILE_COUNT_V2,
    ),
    physicalClosureHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (
      canonicalJsonStringify(value.requirement)
        !== canonicalJsonStringify(
          PLATFORM_RELEASE_HOST_COMPOSITION_REQUIREMENT_V2,
        )
    ) {
      context.addIssue({
        code: "custom",
        path: ["requirement"],
        message:
          "Host composition receipt must embed the exact code-owned requirement",
      });
    }
    if (
      (
        value.admissionScope === "production_host"
        && (
          value.productionUse
            !== "production_host_private_capability_only"
          || value.installation.filesystemProtection
            !== "root_owned_runtime_read_only"
          || value.installation.ownerUid !== 0
          || value.installation.ownerGid !== 0
          || value.installation.mode !== "0555"
          || value.runtimeAccount.authorityState
            !== "durable_os_account_verified"
          || value.runtimeAccount.accountRef
            !== "SETFARM_PLATFORM_RELEASE_RUNTIME_V2"
          || value.files.some(
            (file) =>
              file.ownerUid !== 0
              || file.ownerGid !== 0
              || file.parent.ownerUid !== 0
              || file.parent.ownerGid !== 0
              || file.parent.mode === "0700",
          )
        )
      )
      || (
        value.admissionScope === "test_fixture"
        && (
          value.productionUse !== "forbidden_test_fixture"
          || value.installation.filesystemProtection
            !== "test_fixture_only"
          || value.installation.mode !== "0700"
          || value.runtimeAccount.authorityState
            !== "test_fixture_identity_unverified"
          || value.runtimeAccount.accountRef
            !== "TEST_FIXTURE_PLATFORM_RELEASE_RUNTIME_V2"
          || value.files.some(
            (file) => file.parent.mode !== "0700",
          )
        )
      )
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Host composition scope, filesystem, account and production-use state must agree",
      });
    }
    if (
      value.runtimeAccount.hostIdentityHash
        !== value.platformHost.hostIdentityHash
      || value.files.some(
        (file) =>
          file.ownerUid === value.runtimeAccount.uid
          || file.ownerGid === value.runtimeAccount.gid,
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["runtimeAccount"],
        message:
          "Runtime account must bind the host and differ from every admitted file owner",
      });
    }
    const physicalKeys = value.files.map(
      (file) => `${file.device}:${file.inode}`,
    );
    for (
      let left = 0;
      left < physicalKeys.length;
      left += 1
    ) {
      for (
        let right = left + 1;
        right < physicalKeys.length;
        right += 1
      ) {
        const sharedXattrRole =
          left === 4 && right === 5;
        if (
          physicalKeys[left] === physicalKeys[right]
          && !sharedXattrRole
        ) {
          context.addIssue({
            code: "custom",
            path: ["files", right],
            message:
              "Host composition physical files must be distinct except for the explicit xattr observe/clear role pair",
          });
        }
      }
    }
    value.files.forEach((file, index) => {
      const expected =
        PLATFORM_RELEASE_HOST_COMPOSITION_ROLE_REQUIREMENTS_V2[
          index
        ];
      if (
        !expected
        || file.role !== expected.role
        || file.fileRef !== expected.fileRef
        || file.origin !== expected.origin
        || file.mode !== expected.requiredMode
        || file.byteLength > expected.maxBytes
        || file.hostIdentityHash
          !== value.platformHost.hostIdentityHash
        || file.verifierIdentityHash
          !== value.verifierIdentityHash
      ) {
        context.addIssue({
          code: "custom",
          path: ["files", index],
          message:
            "Host composition files must equal the exact ordered role, mode, origin and verifier contract",
        });
      }
    });
    const expectedParentRefs = [
      "HOST_COMPOSITION_BIN_PARENT_V2",
      "HOST_COMPOSITION_LIB_PARENT_V2",
      "HOST_COMPOSITION_BIN_PARENT_V2",
      "HOST_COMPOSITION_LIB_PARENT_V2",
      "HOST_COMPOSITION_TOOLS_PARENT_V2",
      "HOST_COMPOSITION_TOOLS_PARENT_V2",
      "HOST_COMPOSITION_TOOLS_PARENT_V2",
      "HOST_COMPOSITION_TOOLS_PARENT_V2",
      "HOST_COMPOSITION_TOOLS_PARENT_V2",
      "HOST_COMPOSITION_LIB_PARENT_V2",
    ] as const;
    value.files.forEach((file, index) => {
      if (
        file.parent.parentRef !== expectedParentRefs[index]
        || file.ownerUid !== value.installation.ownerUid
        || file.ownerGid !== value.installation.ownerGid
        || file.parent.ownerUid
          !== value.installation.ownerUid
        || file.parent.ownerGid
          !== value.installation.ownerGid
      ) {
        context.addIssue({
          code: "custom",
          path: ["files", index, "parent"],
          message:
            "Host composition file and parent ownership must join the exact installation and role",
        });
      }
    });
    for (const group of [
      [0, 2],
      [1, 3, 9],
      [4, 5, 6, 7, 8],
    ] as const) {
      const first = value.files[group[0]];
      if (
        group.some(
          (index) =>
            canonicalJsonStringify(value.files[index].parent)
              !== canonicalJsonStringify(first.parent),
        )
      ) {
        context.addIssue({
          code: "custom",
          path: ["files"],
          message:
            "Host composition members of one code-owned parent must bind one exact parent identity",
        });
      }
    }
    const verifier = value.files[2];
    if (
      value.verifierIdentityHash
        !== hashPlatformReleaseHostCompositionVerifierIdentityV2({
          verifierPhysicalIdentityHash:
            verifier.physicalIdentityHash,
          verifierAbiHash:
            value.requirement.operationBindings.verifierAbiHash,
        })
    ) {
      context.addIssue({
        code: "custom",
        path: ["verifierIdentityHash"],
        message:
          "Host composition verifier identity must bind the exact verifier file and ABI",
      });
    }
    if (
      value.installation.fileCount !== value.files.length
      || value.installation.totalBytes
        !== value.files.reduce(
          (total, file) => total + file.byteLength,
          0,
        )
      || value.installation.fileSetMembershipHash
        !== hashPlatformReleaseHostCompositionFileSetMembershipV2(
          value.files,
        )
      || value.physicalClosureHash
        !== hashPlatformReleaseHostCompositionPhysicalClosureV2(
          value.files,
        )
    ) {
      context.addIssue({
        code: "custom",
        path: ["physicalClosureHash"],
        message:
          "Host composition aggregate must bind every and only ordered physical file",
      });
    }
  });

export type PlatformReleaseHostCompositionReceiptHashPayloadV2 =
  z.infer<
    typeof PlatformReleaseHostCompositionReceiptIdentityV2Schema
  >;

export function hashPlatformReleaseHostCompositionReceiptV2(
  value:
    | PlatformReleaseHostCompositionReceiptHashPayloadV2
    | PlatformReleaseHostCompositionReceiptV2
    | Readonly<Record<string, unknown>>,
): string {
  const receipt = { ...value } as Record<string, unknown>;
  delete receipt.receiptHash;
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-host-composition-receipt-hash.v2",
    receipt,
  });
}

export const PlatformReleaseHostCompositionReceiptV2Schema =
  PlatformReleaseHostCompositionReceiptIdentityV2Schema.extend({
    receiptHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (
      !platformReleaseCandidateFitsCanonicalCapV2(
        value,
        PLATFORM_RELEASE_HOST_COMPOSITION_RECEIPT_MAX_CANONICAL_BYTES_V2,
      )
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Host composition receipt exceeds its canonical byte cap",
      });
      return;
    }
    if (
      value.receiptHash
        !== hashPlatformReleaseHostCompositionReceiptV2(value)
    ) {
      context.addIssue({
        code: "custom",
        path: ["receiptHash"],
        message: "Host composition receipt hash mismatch",
      });
    }
  });

export type PlatformReleaseHostCompositionReceiptV2 =
  z.infer<
    typeof PlatformReleaseHostCompositionReceiptV2Schema
  >;

export function getPlatformReleaseHostCompositionRequirementV2():
PlatformReleaseHostCompositionRequirementV2 {
  return deepFreezePlatformReleaseJsonV2(
    structuredClone(
      PLATFORM_RELEASE_HOST_COMPOSITION_REQUIREMENT_V2,
    ),
  );
}

export function parsePlatformReleaseHostCompositionReceiptCandidateV2(
  input: unknown,
): PlatformReleaseHostCompositionReceiptV2 {
  const snapshot = boundedPlatformReleaseJsonSnapshotV2(
    input,
    PLATFORM_RELEASE_HOST_COMPOSITION_RECEIPT_MAX_CANONICAL_BYTES_V2,
  );
  return deepFreezePlatformReleaseJsonV2(
    PlatformReleaseHostCompositionReceiptV2Schema.parse(
      snapshot,
    ),
  );
}
