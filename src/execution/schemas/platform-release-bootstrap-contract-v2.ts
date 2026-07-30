import { createHash } from "node:crypto";
import path from "node:path";

import { z } from "zod";

import {
  canonicalJsonStringify,
  hashCanonicalJson,
} from "../../product-compiler/canonical-json.js";
import {
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_CLAIM_BASENAME_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_LOCK_BASENAME_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_RECEIPT_BASENAME_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_STAGING_PREFIX_V2,
} from
  "../../product-compiler/schemas/node-toolchain-provisioner-bootstrap-installation-state-v2.js";
import {
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROLLBACK_CLAIM_BASENAME_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROLLBACK_RECEIPT_BASENAME_REGEX_V2,
} from
  "../../product-compiler/schemas/node-toolchain-provisioner-bootstrap-rollback-v2.js";
import {
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_AUTHORITY_REF_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_BUNDLE_LOCATOR_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_LAUNCHER_LOCATOR_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MANIFEST_LOCATOR_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MAX_BUNDLE_BYTES_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MAX_LAUNCHER_BYTES_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MAX_MANIFEST_BYTES_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MAX_RUNTIME_BYTES_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROOT_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_RUNTIME_LOCATOR_V2,
} from
  "../../product-compiler/schemas/node-toolchain-provisioner-bootstrap-v2.js";
import {
  Sha256Schema,
  StableReferenceSchema,
} from "../../product-compiler/schemas/common-v1.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_OPERATION_ABI_SET_V2,
  PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2,
  PlatformReleaseBootstrapPackageRefV2Schema,
} from "./platform-release-bootstrap-operation-abis-v2.js";
import {
  PLATFORM_RELEASE_COMPONENT_VERSION_V2,
  PlatformReleaseAbsoluteLocatorV2Schema,
  boundedPlatformReleaseJsonSnapshotV2,
  deepFreezePlatformReleaseJsonV2,
  platformReleaseCandidateFitsCanonicalCapV2,
} from "./platform-release-common-v2.js";

export const PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-contract.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_AUTHORITY_REF_V2 =
  "AUTH_PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_MAX_CANONICAL_BYTES_V2 =
  1024 * 1024;
export const PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_COUNT_V2 = 4;
export const PLATFORM_RELEASE_BOOTSTRAP_PARENT_V2 =
  "/Library/Application Support/Setfarm/bootstrap" as const;

export const PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_SHARED_LOCK_BASENAME_V2 =
  ".setfarm-bootstrap-package-registry-v2.lock" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_SHARED_LOCK_CONTENT_V2 =
  "setfarm.bootstrap-package-registry-parent-lock.v2\n" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_ACTIVATION_RECEIPT_BASENAME_V2 =
  "bootstrap-package-registry-v2.activation-receipt.v2.json" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_EPOCH_FLOOR_BASENAME_V2 =
  "bootstrap-package-registry-v2.epoch-floor.v2.json" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_EPOCH_CLAIM_BASENAME_V2 =
  ".setfarm-bootstrap-package-registry-v2.epoch-claim.v2.json" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_DOCUMENT_PROTOCOL_CATALOG_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-registry-document-protocol-catalog.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_DOCUMENT_PROTOCOL_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-registry-document-protocol.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_ACTIVATION_RECEIPT_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-registry-activation-receipt.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_EPOCH_FLOOR_STATE_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-registry-epoch-floor-state.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_EPOCH_CLAIM_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-registry-epoch-claim.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_OFFLINE_ROLLBACK_AUTHORIZATION_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-registry-offline-rollback-authorization.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_DOCUMENT_PROTOCOL_COUNT_V2 =
  4;
export const PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_DOCUMENT_PROTOCOL_CATALOG_MAX_CANONICAL_BYTES_V2 =
  256 * 1024;

export const PLATFORM_RELEASE_HOST_VERIFIER_ROOT_V2 =
  "/Library/Application Support/Setfarm/bootstrap/host-composition-verifier-v2" as const;
export const PLATFORM_RELEASE_HOST_VERIFIER_MANIFEST_LOCATOR_V2 =
  "HOST_COMPOSITION_VERIFIER_MANIFEST.v2.json" as const;
export const PLATFORM_RELEASE_HOST_VERIFIER_EXECUTABLE_LOCATOR_V2 =
  "bin/setfarm-host-composition-verifier-v2" as const;

export const PLATFORM_RELEASE_RUNTIME_ACCOUNT_PROVISIONER_ROOT_V2 =
  "/Library/Application Support/Setfarm/bootstrap/runtime-account-provisioner-v2" as const;
export const PLATFORM_RELEASE_RUNTIME_ACCOUNT_PROVISIONER_MANIFEST_LOCATOR_V2 =
  "RUNTIME_ACCOUNT_PROVISIONER_MANIFEST.v2.json" as const;
export const PLATFORM_RELEASE_RUNTIME_ACCOUNT_PROVISIONER_EXECUTABLE_LOCATOR_V2 =
  "bin/setfarm-runtime-account-provisioner-v2" as const;

export const PLATFORM_RELEASE_COMPOSITION_PACKAGE_ROOT_V2 =
  "/Library/Application Support/Setfarm/bootstrap/platform-release-composition-v2" as const;
export const PLATFORM_RELEASE_COMPOSITION_PACKAGE_MANIFEST_LOCATOR_V2 =
  "PLATFORM_RELEASE_COMPOSITION_MANIFEST.v2.json" as const;
export const PLATFORM_RELEASE_COMPOSITION_EXECUTABLE_LOCATOR_V2 =
  "bin/setfarm-platform-release-composition-v2" as const;
export const PLATFORM_RELEASE_COMPOSITION_MODULE_LOCATOR_V2 =
  "lib/platform-release-composition-v2.mjs" as const;
export const PLATFORM_RELEASE_METADATA_MODULE_LOCATOR_V2 =
  "lib/platform-release-metadata-v2.mjs" as const;
export const PLATFORM_RELEASE_NETWORK_WRAPPER_MODULE_LOCATOR_V2 =
  "lib/platform-release-network-wrapper-v2.mjs" as const;

const MAX_NATIVE_EXECUTABLE_BYTES_V2 = 16 * 1024 * 1024;
const MAX_RELEASE_MODULE_BYTES_V2 = 16 * 1024 * 1024;
const MAX_BOOTSTRAP_MANIFEST_BYTES_V2 = 4 * 1024 * 1024;

const RelativeLocatorV2Schema = z.union([
  z.literal("."),
  z.string().min(1).max(1024).superRefine((value, context) => {
    if (
      value.includes("\0")
      || value.includes("\\")
      || value.startsWith("/")
      || value.startsWith("./")
      || value.endsWith("/")
      || path.posix.normalize(value) !== value
      || value.split("/").some((segment) =>
        segment === "" || segment === "." || segment === "..")
    ) {
      context.addIssue({
        code: "custom",
        message: "Expected one normalized package-relative locator",
      });
    }
  }),
]);

const BasenameV2Schema = z.string().min(1).max(255)
  .refine((value) =>
    !value.includes("/")
    && !value.includes("\\")
    && !value.includes("\0")
    && value !== "."
    && value !== "..", {
    message: "Expected one exact bootstrap-parent basename",
  });

const RegistryDocumentSchemaRefV2Schema = z.enum([
  PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_ACTIVATION_RECEIPT_V2_SCHEMA,
  PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_EPOCH_CLAIM_V2_SCHEMA,
  PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_EPOCH_FLOOR_STATE_V2_SCHEMA,
  PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_OFFLINE_ROLLBACK_AUTHORIZATION_V2_SCHEMA,
]);

const RegistryDocumentFieldDefinitionV2Schema = z.object({
  name: z.string().min(1).max(100).regex(/^[a-z][A-Za-z0-9]*$/),
  kind: z.enum([
    "component_version",
    "ed25519_signature",
    "exact_package_epoch_artifact_map",
    "nonnegative_integer",
    "nullable_sha256",
    "registered_package_ref",
    "rfc3339_utc",
    "schema_ref",
    "sha256",
    "stable_ref",
  ]),
}).strict();

const RegistryDocumentProtocolIdentityV2Schema = z.object({
  schema: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_DOCUMENT_PROTOCOL_V2_SCHEMA,
  ),
  schemaRef: RegistryDocumentSchemaRefV2Schema,
  documentKind: z.enum([
    "activation_receipt",
    "epoch_claim",
    "epoch_floor_state",
    "offline_rollback_authorization",
  ]),
  purpose: z.enum([
    "claim_first_single_package_epoch_floor_transaction_v2",
    "irreversible_shared_registry_cutover_receipt_last_v2",
    "offline_signed_exact_older_artifact_execution_exception_v2",
    "sole_receipt_last_monotonic_distribution_epoch_floor_v2",
  ]),
  encoding: z.literal("strict_bounded_canonical_json_utf8_v2"),
  maxCanonicalBytes: z.number().int().positive()
    .max(PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_DOCUMENT_PROTOCOL_CATALOG_MAX_CANONICAL_BYTES_V2),
  productionUse: z.literal("forbidden"),
  relationPolicy: z.enum([
    "activation_binds_registry_locks_node_lifecycle_parent_and_exact_genesis_v2",
    "current_floor_target_lower_epoch_host_expiry_offline_signature_v2",
    "generation_zero_genesis_or_monotonic_prior_exact_every_package_map_v2",
    "prior_to_target_one_package_generation_optional_exact_rollback_authorization_v2",
  ]),
  fields: z.array(RegistryDocumentFieldDefinitionV2Schema)
    .min(1).max(24),
}).strict().superRefine((value, context) => {
  const fieldNames = value.fields.map((field) => field.name);
  if (
    new Set(fieldNames).size !== fieldNames.length
    || fieldNames[0] !== "schema"
    || fieldNames[1] !== "version"
    || !fieldNames.at(-1)?.endsWith("Hash")
  ) {
    context.addIssue({
      code: "custom",
      path: ["fields"],
      message:
        "Registry document protocol fields must be unique, ordered, enveloped, and self-hashed",
    });
  }
});

export type PlatformReleaseBootstrapRegistryDocumentProtocolHashPayloadV2 =
  z.infer<typeof RegistryDocumentProtocolIdentityV2Schema>;

let exactRegistryDocumentProtocolCanonicalByRefV2:
ReadonlyMap<string, string> | undefined;

export function hashPlatformReleaseBootstrapRegistryDocumentProtocolV2(
  value:
    | PlatformReleaseBootstrapRegistryDocumentProtocolHashPayloadV2
    | PlatformReleaseBootstrapRegistryDocumentProtocolV2
    | Readonly<Record<string, unknown>>,
): string {
  const protocol = { ...value } as Record<string, unknown>;
  delete protocol.documentSchemaHash;
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-bootstrap-registry-document-protocol-hash.v2",
    protocol,
  });
}

export const PlatformReleaseBootstrapRegistryDocumentProtocolV2Schema =
  RegistryDocumentProtocolIdentityV2Schema.extend({
    documentSchemaHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const exactCanonical =
      exactRegistryDocumentProtocolCanonicalByRefV2?.get(
        value.schemaRef,
      );
    if (
      value.documentSchemaHash
        !== hashPlatformReleaseBootstrapRegistryDocumentProtocolV2(
          value,
        )
      || exactRegistryDocumentProtocolCanonicalByRefV2 !== undefined
        && exactCanonical !== canonicalJsonStringify(value)
    ) {
      context.addIssue({
        code: "custom",
        path: ["documentSchemaHash"],
        message:
          "Registry document protocol must be one exact code-owned schema",
      });
    }
  });

export type PlatformReleaseBootstrapRegistryDocumentProtocolV2 =
  z.infer<
    typeof PlatformReleaseBootstrapRegistryDocumentProtocolV2Schema
  >;

type RegistryDocumentFieldDefinitionV2 =
  z.infer<typeof RegistryDocumentFieldDefinitionV2Schema>;

function registryDocumentField(
  name: string,
  kind: RegistryDocumentFieldDefinitionV2["kind"],
): RegistryDocumentFieldDefinitionV2 {
  return { name, kind };
}

const registryDocumentProtocolIdentitiesV2 = [
  {
    schema:
      PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_DOCUMENT_PROTOCOL_V2_SCHEMA,
    schemaRef:
      PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_ACTIVATION_RECEIPT_V2_SCHEMA,
    documentKind: "activation_receipt",
    purpose:
      "irreversible_shared_registry_cutover_receipt_last_v2",
    encoding: "strict_bounded_canonical_json_utf8_v2",
    maxCanonicalBytes: 128 * 1024,
    productionUse: "forbidden",
    relationPolicy:
      "activation_binds_registry_locks_node_lifecycle_parent_and_exact_genesis_v2",
    fields: [
      registryDocumentField("schema", "schema_ref"),
      registryDocumentField("version", "component_version"),
      registryDocumentField("registryRef", "stable_ref"),
      registryDocumentField("registryContractHash", "sha256"),
      registryDocumentField("sharedLockIdentityHash", "sha256"),
      registryDocumentField("legacyNodeLockIdentityHash", "sha256"),
      registryDocumentField("nodeLifecycleIdentityHash", "sha256"),
      registryDocumentField("parentIdentityHash", "sha256"),
      registryDocumentField("genesisEpochStateHash", "sha256"),
      registryDocumentField("activationReceiptHash", "sha256"),
    ],
  },
  {
    schema:
      PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_DOCUMENT_PROTOCOL_V2_SCHEMA,
    schemaRef:
      PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_EPOCH_CLAIM_V2_SCHEMA,
    documentKind: "epoch_claim",
    purpose:
      "claim_first_single_package_epoch_floor_transaction_v2",
    encoding: "strict_bounded_canonical_json_utf8_v2",
    maxCanonicalBytes: 128 * 1024,
    productionUse: "forbidden",
    relationPolicy:
      "prior_to_target_one_package_generation_optional_exact_rollback_authorization_v2",
    fields: [
      registryDocumentField("schema", "schema_ref"),
      registryDocumentField("version", "component_version"),
      registryDocumentField("registryRef", "stable_ref"),
      registryDocumentField("registryContractHash", "sha256"),
      registryDocumentField("transactionIdentityHash", "sha256"),
      registryDocumentField("priorEpochStateHash", "sha256"),
      registryDocumentField("targetEpochStateHash", "sha256"),
      registryDocumentField("packageRef", "registered_package_ref"),
      registryDocumentField(
        "packageInstallationGeneration",
        "nonnegative_integer",
      ),
      registryDocumentField(
        "offlineRollbackAuthorizationHash",
        "nullable_sha256",
      ),
      registryDocumentField("epochClaimHash", "sha256"),
    ],
  },
  {
    schema:
      PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_DOCUMENT_PROTOCOL_V2_SCHEMA,
    schemaRef:
      PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_EPOCH_FLOOR_STATE_V2_SCHEMA,
    documentKind: "epoch_floor_state",
    purpose:
      "sole_receipt_last_monotonic_distribution_epoch_floor_v2",
    encoding: "strict_bounded_canonical_json_utf8_v2",
    maxCanonicalBytes: 256 * 1024,
    productionUse: "forbidden",
    relationPolicy:
      "generation_zero_genesis_or_monotonic_prior_exact_every_package_map_v2",
    fields: [
      registryDocumentField("schema", "schema_ref"),
      registryDocumentField("version", "component_version"),
      registryDocumentField("registryRef", "stable_ref"),
      registryDocumentField("registryContractHash", "sha256"),
      registryDocumentField("generation", "nonnegative_integer"),
      registryDocumentField("priorEpochStateHash", "nullable_sha256"),
      registryDocumentField(
        "transactionIdentityHash",
        "nullable_sha256",
      ),
      registryDocumentField(
        "packageEpochArtifactMap",
        "exact_package_epoch_artifact_map",
      ),
      registryDocumentField("epochStateHash", "sha256"),
    ],
  },
  {
    schema:
      PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_DOCUMENT_PROTOCOL_V2_SCHEMA,
    schemaRef:
      PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_OFFLINE_ROLLBACK_AUTHORIZATION_V2_SCHEMA,
    documentKind: "offline_rollback_authorization",
    purpose:
      "offline_signed_exact_older_artifact_execution_exception_v2",
    encoding: "strict_bounded_canonical_json_utf8_v2",
    maxCanonicalBytes: 128 * 1024,
    productionUse: "forbidden",
    relationPolicy:
      "current_floor_target_lower_epoch_host_expiry_offline_signature_v2",
    fields: [
      registryDocumentField("schema", "schema_ref"),
      registryDocumentField("version", "component_version"),
      registryDocumentField("registryRef", "stable_ref"),
      registryDocumentField("registryContractHash", "sha256"),
      registryDocumentField("currentEpochStateHash", "sha256"),
      registryDocumentField("currentFloorEpoch", "nonnegative_integer"),
      registryDocumentField(
        "targetPackageRef",
        "registered_package_ref",
      ),
      registryDocumentField("targetArtifactHash", "sha256"),
      registryDocumentField(
        "targetDistributionEpoch",
        "nonnegative_integer",
      ),
      registryDocumentField("hostPolicyHash", "sha256"),
      registryDocumentField("expiresAt", "rfc3339_utc"),
      registryDocumentField("offlineSignature", "ed25519_signature"),
      registryDocumentField("authorizationHash", "sha256"),
    ],
  },
] as const;

const registryDocumentProtocolsV2 =
  registryDocumentProtocolIdentitiesV2.map((identity) => ({
    ...identity,
    fields: identity.fields.map((field) => ({ ...field })),
    documentSchemaHash:
      hashPlatformReleaseBootstrapRegistryDocumentProtocolV2(
        identity,
      ),
  }));

exactRegistryDocumentProtocolCanonicalByRefV2 = new Map(
  registryDocumentProtocolsV2.map((protocol) => [
    protocol.schemaRef,
    canonicalJsonStringify(protocol),
  ]),
);

const RegistryDocumentProtocolCatalogIdentityV2Schema = z.object({
  schema: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_DOCUMENT_PROTOCOL_CATALOG_V2_SCHEMA,
  ),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  authorityRef: z.literal(
    "AUTH_PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_DOCUMENT_PROTOCOL_CATALOG_V2",
  ),
  productionUse: z.literal("forbidden"),
  documentCount: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_DOCUMENT_PROTOCOL_COUNT_V2,
  ),
  documents: z.array(
    PlatformReleaseBootstrapRegistryDocumentProtocolV2Schema,
  ).length(
    PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_DOCUMENT_PROTOCOL_COUNT_V2,
  ),
}).strict();

export type PlatformReleaseBootstrapRegistryDocumentProtocolCatalogHashPayloadV2 =
  z.infer<typeof RegistryDocumentProtocolCatalogIdentityV2Schema>;

export function hashPlatformReleaseBootstrapRegistryDocumentProtocolCatalogV2(
  value:
    | PlatformReleaseBootstrapRegistryDocumentProtocolCatalogHashPayloadV2
    | PlatformReleaseBootstrapRegistryDocumentProtocolCatalogV2,
): string {
  const catalog = { ...value } as Record<string, unknown>;
  delete catalog.catalogHash;
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-bootstrap-registry-document-protocol-catalog-hash.v2",
    catalog,
  });
}

const registryDocumentProtocolCatalogIdentityV2 = {
  schema:
    PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_DOCUMENT_PROTOCOL_CATALOG_V2_SCHEMA,
  version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
  authorityRef:
    "AUTH_PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_DOCUMENT_PROTOCOL_CATALOG_V2",
  productionUse: "forbidden",
  documentCount:
    PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_DOCUMENT_PROTOCOL_COUNT_V2,
  documents: registryDocumentProtocolsV2,
} as const;

export const PlatformReleaseBootstrapRegistryDocumentProtocolCatalogV2Schema =
  RegistryDocumentProtocolCatalogIdentityV2Schema.extend({
    catalogHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const { catalogHash: _catalogHash, ...identity } = value;
    if (
      !platformReleaseCandidateFitsCanonicalCapV2(
        value,
        PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_DOCUMENT_PROTOCOL_CATALOG_MAX_CANONICAL_BYTES_V2,
      )
      || canonicalJsonStringify(identity)
        !== canonicalJsonStringify(
          registryDocumentProtocolCatalogIdentityV2,
        )
      || value.catalogHash
        !==
          hashPlatformReleaseBootstrapRegistryDocumentProtocolCatalogV2(
            identity,
          )
      || value.documents.some((document, index) =>
        index > 0
        && value.documents[index - 1]!.schemaRef
          >= document.schemaRef)
    ) {
      context.addIssue({
        code: "custom",
        path: ["catalogHash"],
        message:
          "Registry document protocol catalog must equal the exact code-owned ordered catalog",
      });
    }
  });

export type PlatformReleaseBootstrapRegistryDocumentProtocolCatalogV2 =
  z.infer<
    typeof PlatformReleaseBootstrapRegistryDocumentProtocolCatalogV2Schema
  >;

export const PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_DOCUMENT_PROTOCOL_CATALOG_V2:
PlatformReleaseBootstrapRegistryDocumentProtocolCatalogV2 =
  deepFreezePlatformReleaseJsonV2(
    PlatformReleaseBootstrapRegistryDocumentProtocolCatalogV2Schema
      .parse({
        ...registryDocumentProtocolCatalogIdentityV2,
        catalogHash:
          hashPlatformReleaseBootstrapRegistryDocumentProtocolCatalogV2(
            registryDocumentProtocolCatalogIdentityV2,
          ),
      }),
  );

const PackageDirectoryV2Schema = z.object({
  directoryRef: StableReferenceSchema,
  relativeLocator: RelativeLocatorV2Schema,
  requiredMode: z.literal("0555"),
  orderedEntryRefs: z.array(StableReferenceSchema).min(1).max(32),
  orderedEntryBasenames: z.array(BasenameV2Schema).min(1).max(32),
}).strict().superRefine((value, context) => {
  if (
    value.orderedEntryRefs.length
      !== value.orderedEntryBasenames.length
    || new Set(value.orderedEntryRefs).size
      !== value.orderedEntryRefs.length
    || new Set(value.orderedEntryBasenames).size
      !== value.orderedEntryBasenames.length
  ) {
    context.addIssue({
      code: "custom",
      message:
        "Package directory entries must be unique one-to-one bindings",
    });
  }
});

const PackageMemberV2Schema = z.object({
  memberRef: StableReferenceSchema,
  role: z.enum([
    "canonical_manifest",
    "node_bundle",
    "node_launcher",
    "node_runtime",
    "signed_native_executable",
    "release_executable",
    "release_module",
    "metadata_module",
    "network_wrapper_module",
  ]),
  relativeLocator: RelativeLocatorV2Schema,
  parentDirectoryRef: StableReferenceSchema,
  mediaType: z.enum([
    "application/json",
    "application/javascript",
    "application/x-mach-binary",
    "text/x-shellscript",
  ]),
  requiredMode: z.enum(["0444", "0555"]),
  requiredLinkCount: z.literal(1),
  maxBytes: z.number().int().positive().max(256 * 1024 * 1024),
  requiredExports: z.array(
    z.string().min(1).max(160).regex(/^[A-Za-z_$][A-Za-z0-9_$]*$/),
  ).max(16),
}).strict();

const LifecycleNamespaceV2Schema = z.object({
  activeReceiptBasename: BasenameV2Schema,
  activeClaimBasename: BasenameV2Schema,
  packageLockBasename: BasenameV2Schema,
  stagingPrefix: BasenameV2Schema,
  rollbackClaimBasename: BasenameV2Schema,
  rollbackReceiptBasenameRegex: z.string().min(1).max(512),
}).strict().superRefine((value, context) => {
  try {
    if (
      !value.rollbackReceiptBasenameRegex.startsWith("^")
      || !value.rollbackReceiptBasenameRegex.endsWith("$")
    ) {
      throw new Error("unanchored");
    }
    new RegExp(value.rollbackReceiptBasenameRegex);
  } catch {
    context.addIssue({
      code: "custom",
      path: ["rollbackReceiptBasenameRegex"],
      message:
        "Rollback receipt namespace must be one valid fully anchored pattern",
    });
  }
});

const PackageContractV2Schema = z.object({
  packageRef: PlatformReleaseBootstrapPackageRefV2Schema,
  packageKind: z.enum([
    "legacy_node_compatibility",
    "signed_native_leaf",
    "built_release_leaf",
  ]),
  authorityRef: StableReferenceSchema,
  root: PlatformReleaseAbsoluteLocatorV2Schema,
  rootBasename: BasenameV2Schema,
  manifestLocator: RelativeLocatorV2Schema,
  productionOwnerUid: z.literal(0),
  productionOwnerGid: z.literal(0),
  rootMode: z.literal("0555"),
  distributionPolicy: z.enum([
    "existing_authenticated_node_bootstrap_v2",
    "signed_installer_native_distribution_v2",
    "authenticated_platform_release_build_v2",
  ]),
  verifierPolicy: z.enum([
    "existing_node_package_authority_v2",
    "amfi_self_attest_then_descriptor_revalidation_v2",
    "installed_native_verifier_v2",
  ]),
  directories: z.array(PackageDirectoryV2Schema).min(2).max(8),
  members: z.array(PackageMemberV2Schema).min(2).max(16),
  lifecycle: LifecycleNamespaceV2Schema,
}).strict();

const BootstrapRegistryV2Schema = z.object({
  parent: PlatformReleaseAbsoluteLocatorV2Schema,
  registryRef: z.literal("BOOTSTRAP_PACKAGE_REGISTRY_V2"),
  namespacePolicy: z.literal(
    "exact_registered_siblings_unknown_and_ambiguous_fail_v2",
  ),
  cutoverPolicy: z.literal(
    "legacy_node_lock_then_shared_activation_then_shared_package_order_v2",
  ),
  sharedLockBasename: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_SHARED_LOCK_BASENAME_V2,
  ),
  sharedLockContentHash: Sha256Schema,
  activationReceiptBasename: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_ACTIVATION_RECEIPT_BASENAME_V2,
  ),
  epochFloorBasename: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_EPOCH_FLOOR_BASENAME_V2,
  ),
  epochClaimBasename: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_EPOCH_CLAIM_BASENAME_V2,
  ),
  epochPolicy: z.literal(
    "fixed_state_is_receipt_last_monotonic_floor_signed_rollback_override_v2",
  ),
  genesisPolicy: z.literal(
    "generation_zero_null_prior_zero_epoch_null_artifact_every_package_v2",
  ),
  documentProtocolCatalogHash: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_DOCUMENT_PROTOCOL_CATALOG_V2
      .catalogHash,
  ),
  packageCount: z.literal(PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_COUNT_V2),
}).strict();

const SystemParentV2Schema = z.object({
  parentRef: StableReferenceSchema,
  absoluteLocator: z.enum(["/bin", "/usr/bin"]),
  requiredOwnerUid: z.literal(0),
  requiredOwnerGid: z.literal(0),
  requiredMode: z.literal("0755"),
}).strict();

const SystemFileV2Schema = z.object({
  fileRef: StableReferenceSchema,
  parentRef: StableReferenceSchema,
  absoluteLocator: z.enum([
    "/bin/chmod",
    "/bin/ls",
    "/usr/bin/sandbox-exec",
    "/usr/bin/xattr",
  ]),
  requiredOwnerUid: z.literal(0),
  requiredOwnerGid: z.literal(0),
  requiredMode: z.literal("0755"),
  requiredLinkCount: z.literal(1),
  maxBytes: z.literal(MAX_NATIVE_EXECUTABLE_BYTES_V2),
}).strict();

const SystemLogicalBindingV2Schema = z.object({
  roleRef: StableReferenceSchema,
  fileRef: StableReferenceSchema,
}).strict();

const SystemAnchorContractV2Schema = z.object({
  policy: z.literal(
    "two_exact_parents_four_physical_files_five_logical_roles_v2",
  ),
  verifierAbiRef: z.literal(
    "ABI_PLATFORM_RELEASE_VERIFY_SYSTEM_ANCHORS_V2",
  ),
  parents: z.array(SystemParentV2Schema).length(2),
  files: z.array(SystemFileV2Schema).length(4),
  logicalBindings: z.array(SystemLogicalBindingV2Schema).length(5),
}).strict();

const RuntimeAccountContractV2Schema = z.object({
  accountRef: z.literal("SETFARM_PLATFORM_RELEASE_RUNTIME_V2"),
  userRecordName: z.literal("_setfarmrelease"),
  groupRecordName: z.literal("_setfarmrelease"),
  realName: z.literal("Setfarm Platform Release Runtime"),
  homeDirectory: z.literal("/var/empty"),
  userShell: z.literal("/usr/bin/false"),
  passwordPolicy: z.literal("disabled_non_empty_marker_v2"),
  hidden: z.literal(true),
  uidGidPolicy: z.literal(
    "lowest_equal_free_uid_gid_in_code_owned_range_v2",
  ),
  minimumUidGid: z.literal(600),
  maximumUidGid: z.literal(699),
  lookupAbiRef: z.literal(
    "ABI_PLATFORM_RELEASE_LOOKUP_LOCAL_ACCOUNT_V2",
  ),
  mutationAbiRefs: z.tuple([
    z.literal("ABI_PLATFORM_RELEASE_APPLY_LOCAL_ACCOUNT_V2"),
    z.literal("ABI_PLATFORM_RELEASE_PLAN_LOCAL_ACCOUNT_V2"),
    z.literal("ABI_PLATFORM_RELEASE_ROLLBACK_LOCAL_ACCOUNT_V2"),
  ]),
  lifecyclePolicy: z.literal(
    "double_absence_preclaim_native_mutation_double_observation_receipt_last_v2",
  ),
  adoptionPolicy: z.literal(
    "receipt_or_matching_active_preclaim_only_v2",
  ),
}).strict();

const ProductionTrustRequirementV2Schema = z.object({
  authorityState: z.literal(
    "production_trust_configuration_unavailable",
  ),
  productionAdmission: z.literal("forbidden"),
  externalRoot: z.literal(
    "notarized_developer_id_installer_plus_amfi_v2",
  ),
  signatureAlgorithm: z.literal("ed25519"),
  requiredArchitectures: z.tuple([
    z.literal("arm64"),
    z.literal("x64"),
  ]),
  requiredNativePackageRefs: z.tuple([
    z.literal(
      PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.hostVerifier,
    ),
    z.literal(
      PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.runtimeAccountProvisioner,
    ),
  ]),
  requiredConfiguredFields: z.tuple([
    z.literal("developerTeamId"),
    z.literal("designatedRequirement"),
    z.literal("installerPackageIdentifier"),
    z.literal("offlineReleasePublicKey"),
    z.literal("signedDistributionCatalog"),
  ]),
  blockerCodes: z.tuple([
    z.literal("DEVELOPER_ID_TEAM_UNCONFIGURED"),
    z.literal("DESIGNATED_REQUIREMENT_UNCONFIGURED"),
    z.literal("INSTALLER_PACKAGE_ID_UNCONFIGURED"),
    z.literal("OFFLINE_RELEASE_PUBLIC_KEY_UNCONFIGURED"),
    z.literal("SIGNED_NATIVE_DISTRIBUTION_CATALOG_EMPTY"),
  ]),
  minimumDistributionEpoch: z.literal(1),
  rollbackPolicy: z.literal(
    "floor_never_decreases_exact_offline_signed_override_only_v2",
  ),
}).strict();

const PlatformReleaseBootstrapContractIdentityV2Schema = z.object({
  schema: z.literal(PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2_SCHEMA),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  authorityRef: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_AUTHORITY_REF_V2,
  ),
  authorityState: z.literal(
    "code_owned_contract_production_trust_unconfigured",
  ),
  productionUse: z.literal(
    "forbidden_until_signed_distribution_and_registry_activation_exist",
  ),
  registry: BootstrapRegistryV2Schema,
  packages: z.array(PackageContractV2Schema)
    .length(PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_COUNT_V2),
  operationAbiSetHash: Sha256Schema,
  systemAnchors: SystemAnchorContractV2Schema,
  runtimeAccount: RuntimeAccountContractV2Schema,
  productionTrust: ProductionTrustRequirementV2Schema,
}).strict();

export type PlatformReleaseBootstrapContractHashPayloadV2 =
  z.infer<typeof PlatformReleaseBootstrapContractIdentityV2Schema>;

export function hashPlatformReleaseBootstrapContractV2(
  value:
    | PlatformReleaseBootstrapContractHashPayloadV2
    | PlatformReleaseBootstrapContractV2
    | Readonly<Record<string, unknown>>,
): string {
  const contract = { ...value } as Record<string, unknown>;
  delete contract.contractHash;
  return hashCanonicalJson({
    schema: "setfarm.platform-release-bootstrap-contract-hash.v2",
    contract,
  });
}

const nodePackageV2 = {
  packageRef:
    PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.nodeToolchainProvisioner,
  packageKind: "legacy_node_compatibility",
  authorityRef: NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_AUTHORITY_REF_V2,
  root: NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROOT_V2,
  rootBasename: "node-toolchain-provisioner-v2",
  manifestLocator:
    NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MANIFEST_LOCATOR_V2,
  productionOwnerUid: 0,
  productionOwnerGid: 0,
  rootMode: "0555",
  distributionPolicy:
    "existing_authenticated_node_bootstrap_v2",
  verifierPolicy: "existing_node_package_authority_v2",
  directories: [
    {
      directoryRef: "BOOTSTRAP_NODE_ROOT_DIRECTORY_V2",
      relativeLocator: ".",
      requiredMode: "0555",
      orderedEntryRefs: [
        "BOOTSTRAP_NODE_MANIFEST_V2",
        "BOOTSTRAP_NODE_BIN_DIRECTORY_V2",
        "BOOTSTRAP_NODE_LIB_DIRECTORY_V2",
        "BOOTSTRAP_NODE_RUNTIME_DIRECTORY_V2",
      ],
      orderedEntryBasenames: [
        NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MANIFEST_LOCATOR_V2,
        "bin",
        "lib",
        "runtime",
      ],
    },
    {
      directoryRef: "BOOTSTRAP_NODE_BIN_DIRECTORY_V2",
      relativeLocator: "bin",
      requiredMode: "0555",
      orderedEntryRefs: ["BOOTSTRAP_NODE_LAUNCHER_V2"],
      orderedEntryBasenames: [
        path.posix.basename(
          NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_LAUNCHER_LOCATOR_V2,
        ),
      ],
    },
    {
      directoryRef: "BOOTSTRAP_NODE_LIB_DIRECTORY_V2",
      relativeLocator: "lib",
      requiredMode: "0555",
      orderedEntryRefs: ["BOOTSTRAP_NODE_BUNDLE_V2"],
      orderedEntryBasenames: [
        path.posix.basename(
          NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_BUNDLE_LOCATOR_V2,
        ),
      ],
    },
    {
      directoryRef: "BOOTSTRAP_NODE_RUNTIME_DIRECTORY_V2",
      relativeLocator: "runtime",
      requiredMode: "0555",
      orderedEntryRefs: ["BOOTSTRAP_NODE_RUNTIME_V2"],
      orderedEntryBasenames: [
        path.posix.basename(
          NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_RUNTIME_LOCATOR_V2,
        ),
      ],
    },
  ],
  members: [
    {
      memberRef: "BOOTSTRAP_NODE_MANIFEST_V2",
      role: "canonical_manifest",
      relativeLocator:
        NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MANIFEST_LOCATOR_V2,
      parentDirectoryRef: "BOOTSTRAP_NODE_ROOT_DIRECTORY_V2",
      mediaType: "application/json",
      requiredMode: "0444",
      requiredLinkCount: 1,
      maxBytes:
        NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MAX_MANIFEST_BYTES_V2,
      requiredExports: [],
    },
    {
      memberRef: "BOOTSTRAP_NODE_LAUNCHER_V2",
      role: "node_launcher",
      relativeLocator:
        NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_LAUNCHER_LOCATOR_V2,
      parentDirectoryRef: "BOOTSTRAP_NODE_BIN_DIRECTORY_V2",
      mediaType: "text/x-shellscript",
      requiredMode: "0555",
      requiredLinkCount: 1,
      maxBytes:
        NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MAX_LAUNCHER_BYTES_V2,
      requiredExports: [],
    },
    {
      memberRef: "BOOTSTRAP_NODE_BUNDLE_V2",
      role: "node_bundle",
      relativeLocator:
        NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_BUNDLE_LOCATOR_V2,
      parentDirectoryRef: "BOOTSTRAP_NODE_LIB_DIRECTORY_V2",
      mediaType: "application/javascript",
      requiredMode: "0444",
      requiredLinkCount: 1,
      maxBytes:
        NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MAX_BUNDLE_BYTES_V2,
      requiredExports: [],
    },
    {
      memberRef: "BOOTSTRAP_NODE_RUNTIME_V2",
      role: "node_runtime",
      relativeLocator:
        NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_RUNTIME_LOCATOR_V2,
      parentDirectoryRef: "BOOTSTRAP_NODE_RUNTIME_DIRECTORY_V2",
      mediaType: "application/x-mach-binary",
      requiredMode: "0555",
      requiredLinkCount: 1,
      maxBytes:
        NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MAX_RUNTIME_BYTES_V2,
      requiredExports: [],
    },
  ],
  lifecycle: {
    activeReceiptBasename:
      NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_RECEIPT_BASENAME_V2,
    activeClaimBasename:
      NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_CLAIM_BASENAME_V2,
    packageLockBasename:
      NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_LOCK_BASENAME_V2,
    stagingPrefix:
      NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_STAGING_PREFIX_V2,
    rollbackClaimBasename:
      NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROLLBACK_CLAIM_BASENAME_V2,
    rollbackReceiptBasenameRegex:
      NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROLLBACK_RECEIPT_BASENAME_REGEX_V2,
  },
} as const;

const hostVerifierPackageV2 = {
  packageRef:
    PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.hostVerifier,
  packageKind: "signed_native_leaf",
  authorityRef: "AUTH_PLATFORM_RELEASE_HOST_VERIFIER_PACKAGE_V2",
  root: PLATFORM_RELEASE_HOST_VERIFIER_ROOT_V2,
  rootBasename: "host-composition-verifier-v2",
  manifestLocator:
    PLATFORM_RELEASE_HOST_VERIFIER_MANIFEST_LOCATOR_V2,
  productionOwnerUid: 0,
  productionOwnerGid: 0,
  rootMode: "0555",
  distributionPolicy: "signed_installer_native_distribution_v2",
  verifierPolicy:
    "amfi_self_attest_then_descriptor_revalidation_v2",
  directories: [
    {
      directoryRef: "BOOTSTRAP_HOST_VERIFIER_ROOT_DIRECTORY_V2",
      relativeLocator: ".",
      requiredMode: "0555",
      orderedEntryRefs: [
        "BOOTSTRAP_HOST_VERIFIER_MANIFEST_V2",
        "BOOTSTRAP_HOST_VERIFIER_BIN_DIRECTORY_V2",
      ],
      orderedEntryBasenames: [
        PLATFORM_RELEASE_HOST_VERIFIER_MANIFEST_LOCATOR_V2,
        "bin",
      ],
    },
    {
      directoryRef: "BOOTSTRAP_HOST_VERIFIER_BIN_DIRECTORY_V2",
      relativeLocator: "bin",
      requiredMode: "0555",
      orderedEntryRefs: [
        "BOOTSTRAP_HOST_VERIFIER_EXECUTABLE_V2",
      ],
      orderedEntryBasenames: [
        path.posix.basename(
          PLATFORM_RELEASE_HOST_VERIFIER_EXECUTABLE_LOCATOR_V2,
        ),
      ],
    },
  ],
  members: [
    {
      memberRef: "BOOTSTRAP_HOST_VERIFIER_MANIFEST_V2",
      role: "canonical_manifest",
      relativeLocator:
        PLATFORM_RELEASE_HOST_VERIFIER_MANIFEST_LOCATOR_V2,
      parentDirectoryRef:
        "BOOTSTRAP_HOST_VERIFIER_ROOT_DIRECTORY_V2",
      mediaType: "application/json",
      requiredMode: "0444",
      requiredLinkCount: 1,
      maxBytes: MAX_BOOTSTRAP_MANIFEST_BYTES_V2,
      requiredExports: [],
    },
    {
      memberRef: "BOOTSTRAP_HOST_VERIFIER_EXECUTABLE_V2",
      role: "signed_native_executable",
      relativeLocator:
        PLATFORM_RELEASE_HOST_VERIFIER_EXECUTABLE_LOCATOR_V2,
      parentDirectoryRef:
        "BOOTSTRAP_HOST_VERIFIER_BIN_DIRECTORY_V2",
      mediaType: "application/x-mach-binary",
      requiredMode: "0555",
      requiredLinkCount: 1,
      maxBytes: MAX_NATIVE_EXECUTABLE_BYTES_V2,
      requiredExports: [],
    },
  ],
  lifecycle: {
    activeReceiptBasename:
      "host-composition-verifier-v2.installation-receipt.v2.json",
    activeClaimBasename:
      ".setfarm-host-composition-verifier-v2.installation.claim.json",
    packageLockBasename:
      ".setfarm-host-composition-verifier-v2.installation.lock",
    stagingPrefix:
      ".setfarm-host-composition-verifier-v2.installation.staging",
    rollbackClaimBasename:
      ".setfarm-host-composition-verifier-v2.rollback.claim.json",
    rollbackReceiptBasenameRegex:
      "^\\.setfarm-host-composition-verifier-v2\\.rollback\\.[a-f0-9]{64}\\.receipt\\.json$",
  },
} as const;

const releaseCompositionPackageV2 = {
  packageRef:
    PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.platformReleaseComposition,
  packageKind: "built_release_leaf",
  authorityRef:
    "AUTH_PLATFORM_RELEASE_COMPOSITION_PACKAGE_V2",
  root: PLATFORM_RELEASE_COMPOSITION_PACKAGE_ROOT_V2,
  rootBasename: "platform-release-composition-v2",
  manifestLocator:
    PLATFORM_RELEASE_COMPOSITION_PACKAGE_MANIFEST_LOCATOR_V2,
  productionOwnerUid: 0,
  productionOwnerGid: 0,
  rootMode: "0555",
  distributionPolicy:
    "authenticated_platform_release_build_v2",
  verifierPolicy: "installed_native_verifier_v2",
  directories: [
    {
      directoryRef:
        "BOOTSTRAP_RELEASE_COMPOSITION_ROOT_DIRECTORY_V2",
      relativeLocator: ".",
      requiredMode: "0555",
      orderedEntryRefs: [
        "BOOTSTRAP_RELEASE_COMPOSITION_MANIFEST_V2",
        "BOOTSTRAP_RELEASE_COMPOSITION_BIN_DIRECTORY_V2",
        "BOOTSTRAP_RELEASE_COMPOSITION_LIB_DIRECTORY_V2",
      ],
      orderedEntryBasenames: [
        PLATFORM_RELEASE_COMPOSITION_PACKAGE_MANIFEST_LOCATOR_V2,
        "bin",
        "lib",
      ],
    },
    {
      directoryRef:
        "BOOTSTRAP_RELEASE_COMPOSITION_BIN_DIRECTORY_V2",
      relativeLocator: "bin",
      requiredMode: "0555",
      orderedEntryRefs: [
        "BOOTSTRAP_RELEASE_COMPOSITION_EXECUTABLE_V2",
      ],
      orderedEntryBasenames: [
        path.posix.basename(
          PLATFORM_RELEASE_COMPOSITION_EXECUTABLE_LOCATOR_V2,
        ),
      ],
    },
    {
      directoryRef:
        "BOOTSTRAP_RELEASE_COMPOSITION_LIB_DIRECTORY_V2",
      relativeLocator: "lib",
      requiredMode: "0555",
      orderedEntryRefs: [
        "BOOTSTRAP_RELEASE_COMPOSITION_MODULE_V2",
        "BOOTSTRAP_RELEASE_COMPOSITION_METADATA_MODULE_V2",
        "BOOTSTRAP_RELEASE_COMPOSITION_NETWORK_WRAPPER_MODULE_V2",
      ],
      orderedEntryBasenames: [
        path.posix.basename(
          PLATFORM_RELEASE_COMPOSITION_MODULE_LOCATOR_V2,
        ),
        path.posix.basename(
          PLATFORM_RELEASE_METADATA_MODULE_LOCATOR_V2,
        ),
        path.posix.basename(
          PLATFORM_RELEASE_NETWORK_WRAPPER_MODULE_LOCATOR_V2,
        ),
      ],
    },
  ],
  members: [
    {
      memberRef: "BOOTSTRAP_RELEASE_COMPOSITION_MANIFEST_V2",
      role: "canonical_manifest",
      relativeLocator:
        PLATFORM_RELEASE_COMPOSITION_PACKAGE_MANIFEST_LOCATOR_V2,
      parentDirectoryRef:
        "BOOTSTRAP_RELEASE_COMPOSITION_ROOT_DIRECTORY_V2",
      mediaType: "application/json",
      requiredMode: "0444",
      requiredLinkCount: 1,
      maxBytes: MAX_BOOTSTRAP_MANIFEST_BYTES_V2,
      requiredExports: [],
    },
    {
      memberRef: "BOOTSTRAP_RELEASE_COMPOSITION_EXECUTABLE_V2",
      role: "release_executable",
      relativeLocator:
        PLATFORM_RELEASE_COMPOSITION_EXECUTABLE_LOCATOR_V2,
      parentDirectoryRef:
        "BOOTSTRAP_RELEASE_COMPOSITION_BIN_DIRECTORY_V2",
      mediaType: "application/javascript",
      requiredMode: "0555",
      requiredLinkCount: 1,
      maxBytes: MAX_RELEASE_MODULE_BYTES_V2,
      requiredExports: [],
    },
    {
      memberRef: "BOOTSTRAP_RELEASE_COMPOSITION_MODULE_V2",
      role: "release_module",
      relativeLocator:
        PLATFORM_RELEASE_COMPOSITION_MODULE_LOCATOR_V2,
      parentDirectoryRef:
        "BOOTSTRAP_RELEASE_COMPOSITION_LIB_DIRECTORY_V2",
      mediaType: "application/javascript",
      requiredMode: "0444",
      requiredLinkCount: 1,
      maxBytes: MAX_RELEASE_MODULE_BYTES_V2,
      requiredExports: [
        "runPlatformReleaseHostOperationV2",
        "runPlatformReleaseModuleExportProbeV2",
      ],
    },
    {
      memberRef: "BOOTSTRAP_RELEASE_COMPOSITION_METADATA_MODULE_V2",
      role: "metadata_module",
      relativeLocator:
        PLATFORM_RELEASE_METADATA_MODULE_LOCATOR_V2,
      parentDirectoryRef:
        "BOOTSTRAP_RELEASE_COMPOSITION_LIB_DIRECTORY_V2",
      mediaType: "application/javascript",
      requiredMode: "0444",
      requiredLinkCount: 1,
      maxBytes: MAX_RELEASE_MODULE_BYTES_V2,
      requiredExports: [
        "runPlatformReleaseMetadataProbeV2",
      ],
    },
    {
      memberRef:
        "BOOTSTRAP_RELEASE_COMPOSITION_NETWORK_WRAPPER_MODULE_V2",
      role: "network_wrapper_module",
      relativeLocator:
        PLATFORM_RELEASE_NETWORK_WRAPPER_MODULE_LOCATOR_V2,
      parentDirectoryRef:
        "BOOTSTRAP_RELEASE_COMPOSITION_LIB_DIRECTORY_V2",
      mediaType: "application/javascript",
      requiredMode: "0444",
      requiredLinkCount: 1,
      maxBytes: MAX_RELEASE_MODULE_BYTES_V2,
      requiredExports: [
        "runPlatformReleaseNetworkNegativeProbeV2",
      ],
    },
  ],
  lifecycle: {
    activeReceiptBasename:
      "platform-release-composition-v2.installation-receipt.v2.json",
    activeClaimBasename:
      ".setfarm-platform-release-composition-v2.installation.claim.json",
    packageLockBasename:
      ".setfarm-platform-release-composition-v2.installation.lock",
    stagingPrefix:
      ".setfarm-platform-release-composition-v2.installation.staging",
    rollbackClaimBasename:
      ".setfarm-platform-release-composition-v2.rollback.claim.json",
    rollbackReceiptBasenameRegex:
      "^\\.setfarm-platform-release-composition-v2\\.rollback\\.[a-f0-9]{64}\\.receipt\\.json$",
  },
} as const;

const runtimeAccountProvisionerPackageV2 = {
  packageRef:
    PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.runtimeAccountProvisioner,
  packageKind: "signed_native_leaf",
  authorityRef:
    "AUTH_PLATFORM_RELEASE_RUNTIME_ACCOUNT_PROVISIONER_PACKAGE_V2",
  root: PLATFORM_RELEASE_RUNTIME_ACCOUNT_PROVISIONER_ROOT_V2,
  rootBasename: "runtime-account-provisioner-v2",
  manifestLocator:
    PLATFORM_RELEASE_RUNTIME_ACCOUNT_PROVISIONER_MANIFEST_LOCATOR_V2,
  productionOwnerUid: 0,
  productionOwnerGid: 0,
  rootMode: "0555",
  distributionPolicy: "signed_installer_native_distribution_v2",
  verifierPolicy: "installed_native_verifier_v2",
  directories: [
    {
      directoryRef:
        "BOOTSTRAP_RUNTIME_ACCOUNT_PROVISIONER_ROOT_DIRECTORY_V2",
      relativeLocator: ".",
      requiredMode: "0555",
      orderedEntryRefs: [
        "BOOTSTRAP_RUNTIME_ACCOUNT_PROVISIONER_MANIFEST_V2",
        "BOOTSTRAP_RUNTIME_ACCOUNT_PROVISIONER_BIN_DIRECTORY_V2",
      ],
      orderedEntryBasenames: [
        PLATFORM_RELEASE_RUNTIME_ACCOUNT_PROVISIONER_MANIFEST_LOCATOR_V2,
        "bin",
      ],
    },
    {
      directoryRef:
        "BOOTSTRAP_RUNTIME_ACCOUNT_PROVISIONER_BIN_DIRECTORY_V2",
      relativeLocator: "bin",
      requiredMode: "0555",
      orderedEntryRefs: [
        "BOOTSTRAP_RUNTIME_ACCOUNT_PROVISIONER_EXECUTABLE_V2",
      ],
      orderedEntryBasenames: [
        path.posix.basename(
          PLATFORM_RELEASE_RUNTIME_ACCOUNT_PROVISIONER_EXECUTABLE_LOCATOR_V2,
        ),
      ],
    },
  ],
  members: [
    {
      memberRef:
        "BOOTSTRAP_RUNTIME_ACCOUNT_PROVISIONER_MANIFEST_V2",
      role: "canonical_manifest",
      relativeLocator:
        PLATFORM_RELEASE_RUNTIME_ACCOUNT_PROVISIONER_MANIFEST_LOCATOR_V2,
      parentDirectoryRef:
        "BOOTSTRAP_RUNTIME_ACCOUNT_PROVISIONER_ROOT_DIRECTORY_V2",
      mediaType: "application/json",
      requiredMode: "0444",
      requiredLinkCount: 1,
      maxBytes: MAX_BOOTSTRAP_MANIFEST_BYTES_V2,
      requiredExports: [],
    },
    {
      memberRef:
        "BOOTSTRAP_RUNTIME_ACCOUNT_PROVISIONER_EXECUTABLE_V2",
      role: "signed_native_executable",
      relativeLocator:
        PLATFORM_RELEASE_RUNTIME_ACCOUNT_PROVISIONER_EXECUTABLE_LOCATOR_V2,
      parentDirectoryRef:
        "BOOTSTRAP_RUNTIME_ACCOUNT_PROVISIONER_BIN_DIRECTORY_V2",
      mediaType: "application/x-mach-binary",
      requiredMode: "0555",
      requiredLinkCount: 1,
      maxBytes: MAX_NATIVE_EXECUTABLE_BYTES_V2,
      requiredExports: [],
    },
  ],
  lifecycle: {
    activeReceiptBasename:
      "runtime-account-provisioner-v2.installation-receipt.v2.json",
    activeClaimBasename:
      ".setfarm-runtime-account-provisioner-v2.installation.claim.json",
    packageLockBasename:
      ".setfarm-runtime-account-provisioner-v2.installation.lock",
    stagingPrefix:
      ".setfarm-runtime-account-provisioner-v2.installation.staging",
    rollbackClaimBasename:
      ".setfarm-runtime-account-provisioner-v2.rollback.claim.json",
    rollbackReceiptBasenameRegex:
      "^\\.setfarm-runtime-account-provisioner-v2\\.rollback\\.[a-f0-9]{64}\\.receipt\\.json$",
  },
} as const;

const contractIdentityV2 = {
  schema: PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2_SCHEMA,
  version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
  authorityRef:
    PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_AUTHORITY_REF_V2,
  authorityState:
    "code_owned_contract_production_trust_unconfigured",
  productionUse:
    "forbidden_until_signed_distribution_and_registry_activation_exist",
  registry: {
    parent: PLATFORM_RELEASE_BOOTSTRAP_PARENT_V2,
    registryRef: "BOOTSTRAP_PACKAGE_REGISTRY_V2",
    namespacePolicy:
      "exact_registered_siblings_unknown_and_ambiguous_fail_v2",
    cutoverPolicy:
      "legacy_node_lock_then_shared_activation_then_shared_package_order_v2",
    sharedLockBasename:
      PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_SHARED_LOCK_BASENAME_V2,
    sharedLockContentHash: createHash("sha256")
      .update(
        PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_SHARED_LOCK_CONTENT_V2,
        "utf8",
      )
      .digest("hex"),
    activationReceiptBasename:
      PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_ACTIVATION_RECEIPT_BASENAME_V2,
    epochFloorBasename:
      PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_EPOCH_FLOOR_BASENAME_V2,
    epochClaimBasename:
      PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_EPOCH_CLAIM_BASENAME_V2,
    epochPolicy:
      "fixed_state_is_receipt_last_monotonic_floor_signed_rollback_override_v2",
    genesisPolicy:
      "generation_zero_null_prior_zero_epoch_null_artifact_every_package_v2",
    documentProtocolCatalogHash:
      PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_DOCUMENT_PROTOCOL_CATALOG_V2
        .catalogHash,
    packageCount: PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_COUNT_V2,
  },
  packages: [
    hostVerifierPackageV2,
    nodePackageV2,
    releaseCompositionPackageV2,
    runtimeAccountProvisionerPackageV2,
  ],
  operationAbiSetHash:
    PLATFORM_RELEASE_BOOTSTRAP_OPERATION_ABI_SET_V2.abiSetHash,
  systemAnchors: {
    policy:
      "two_exact_parents_four_physical_files_five_logical_roles_v2",
    verifierAbiRef:
      "ABI_PLATFORM_RELEASE_VERIFY_SYSTEM_ANCHORS_V2",
    parents: [
      {
        parentRef: "HOST_SYSTEM_BIN_PARENT_V2",
        absoluteLocator: "/bin",
        requiredOwnerUid: 0,
        requiredOwnerGid: 0,
        requiredMode: "0755",
      },
      {
        parentRef: "HOST_SYSTEM_USR_BIN_PARENT_V2",
        absoluteLocator: "/usr/bin",
        requiredOwnerUid: 0,
        requiredOwnerGid: 0,
        requiredMode: "0755",
      },
    ],
    files: [
      {
        fileRef: "HOST_SYSTEM_CHMOD_EXECUTABLE_V2",
        parentRef: "HOST_SYSTEM_BIN_PARENT_V2",
        absoluteLocator: "/bin/chmod",
        requiredOwnerUid: 0,
        requiredOwnerGid: 0,
        requiredMode: "0755",
        requiredLinkCount: 1,
        maxBytes: MAX_NATIVE_EXECUTABLE_BYTES_V2,
      },
      {
        fileRef: "HOST_SYSTEM_LS_EXECUTABLE_V2",
        parentRef: "HOST_SYSTEM_BIN_PARENT_V2",
        absoluteLocator: "/bin/ls",
        requiredOwnerUid: 0,
        requiredOwnerGid: 0,
        requiredMode: "0755",
        requiredLinkCount: 1,
        maxBytes: MAX_NATIVE_EXECUTABLE_BYTES_V2,
      },
      {
        fileRef: "HOST_SYSTEM_SANDBOX_EXECUTABLE_V2",
        parentRef: "HOST_SYSTEM_USR_BIN_PARENT_V2",
        absoluteLocator: "/usr/bin/sandbox-exec",
        requiredOwnerUid: 0,
        requiredOwnerGid: 0,
        requiredMode: "0755",
        requiredLinkCount: 1,
        maxBytes: MAX_NATIVE_EXECUTABLE_BYTES_V2,
      },
      {
        fileRef: "HOST_SYSTEM_XATTR_EXECUTABLE_V2",
        parentRef: "HOST_SYSTEM_USR_BIN_PARENT_V2",
        absoluteLocator: "/usr/bin/xattr",
        requiredOwnerUid: 0,
        requiredOwnerGid: 0,
        requiredMode: "0755",
        requiredLinkCount: 1,
        maxBytes: MAX_NATIVE_EXECUTABLE_BYTES_V2,
      },
    ],
    logicalBindings: [
      {
        roleRef: "HOST_COMPOSITION_ACL_CLEAR_EXECUTABLE_V2",
        fileRef: "HOST_SYSTEM_CHMOD_EXECUTABLE_V2",
      },
      {
        roleRef: "HOST_COMPOSITION_ACL_OBSERVER_EXECUTABLE_V2",
        fileRef: "HOST_SYSTEM_LS_EXECUTABLE_V2",
      },
      {
        roleRef: "HOST_COMPOSITION_SANDBOX_EXECUTABLE_V2",
        fileRef: "HOST_SYSTEM_SANDBOX_EXECUTABLE_V2",
      },
      {
        roleRef: "HOST_COMPOSITION_XATTR_CLEAR_EXECUTABLE_V2",
        fileRef: "HOST_SYSTEM_XATTR_EXECUTABLE_V2",
      },
      {
        roleRef: "HOST_COMPOSITION_XATTR_OBSERVER_EXECUTABLE_V2",
        fileRef: "HOST_SYSTEM_XATTR_EXECUTABLE_V2",
      },
    ],
  },
  runtimeAccount: {
    accountRef: "SETFARM_PLATFORM_RELEASE_RUNTIME_V2",
    userRecordName: "_setfarmrelease",
    groupRecordName: "_setfarmrelease",
    realName: "Setfarm Platform Release Runtime",
    homeDirectory: "/var/empty",
    userShell: "/usr/bin/false",
    passwordPolicy: "disabled_non_empty_marker_v2",
    hidden: true,
    uidGidPolicy:
      "lowest_equal_free_uid_gid_in_code_owned_range_v2",
    minimumUidGid: 600,
    maximumUidGid: 699,
    lookupAbiRef:
      "ABI_PLATFORM_RELEASE_LOOKUP_LOCAL_ACCOUNT_V2",
    mutationAbiRefs: [
      "ABI_PLATFORM_RELEASE_APPLY_LOCAL_ACCOUNT_V2",
      "ABI_PLATFORM_RELEASE_PLAN_LOCAL_ACCOUNT_V2",
      "ABI_PLATFORM_RELEASE_ROLLBACK_LOCAL_ACCOUNT_V2",
    ],
    lifecyclePolicy:
      "double_absence_preclaim_native_mutation_double_observation_receipt_last_v2",
    adoptionPolicy:
      "receipt_or_matching_active_preclaim_only_v2",
  },
  productionTrust: {
    authorityState:
      "production_trust_configuration_unavailable",
    productionAdmission: "forbidden",
    externalRoot:
      "notarized_developer_id_installer_plus_amfi_v2",
    signatureAlgorithm: "ed25519",
    requiredArchitectures: ["arm64", "x64"],
    requiredNativePackageRefs: [
      PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.hostVerifier,
      PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2
        .runtimeAccountProvisioner,
    ],
    requiredConfiguredFields: [
      "developerTeamId",
      "designatedRequirement",
      "installerPackageIdentifier",
      "offlineReleasePublicKey",
      "signedDistributionCatalog",
    ],
    blockerCodes: [
      "DEVELOPER_ID_TEAM_UNCONFIGURED",
      "DESIGNATED_REQUIREMENT_UNCONFIGURED",
      "INSTALLER_PACKAGE_ID_UNCONFIGURED",
      "OFFLINE_RELEASE_PUBLIC_KEY_UNCONFIGURED",
      "SIGNED_NATIVE_DISTRIBUTION_CATALOG_EMPTY",
    ],
    minimumDistributionEpoch: 1,
    rollbackPolicy:
      "floor_never_decreases_exact_offline_signed_override_only_v2",
  },
} as const;

function exactContractIssue(
  value: z.infer<typeof PlatformReleaseBootstrapContractIdentityV2Schema>,
): string | undefined {
  const packageRefs = value.packages.map((entry) => entry.packageRef);
  const roots = value.packages.map((entry) => entry.root);
  const rootBasenames = value.packages.map((entry) => entry.rootBasename);
  const globalBasenames = [
    value.registry.sharedLockBasename,
    value.registry.activationReceiptBasename,
    value.registry.epochFloorBasename,
    value.registry.epochClaimBasename,
  ];
  const lifecycleExactNames = value.packages.flatMap((entry) => [
    entry.rootBasename,
    entry.lifecycle.activeReceiptBasename,
    entry.lifecycle.activeClaimBasename,
    entry.lifecycle.packageLockBasename,
    entry.lifecycle.stagingPrefix,
    entry.lifecycle.rollbackClaimBasename,
  ]);
  if (
    new Set(packageRefs).size !== packageRefs.length
    || new Set(roots).size !== roots.length
    || new Set(rootBasenames).size !== rootBasenames.length
    || new Set([...globalBasenames, ...lifecycleExactNames]).size
      !== globalBasenames.length + lifecycleExactNames.length
  ) {
    return "Bootstrap registry package or lifecycle namespaces collide";
  }
  for (const packageContract of value.packages) {
    const rootDirectories = packageContract.directories.filter((entry) =>
      entry.relativeLocator === ".");
    const directoryByRef = new Map(
      packageContract.directories.map((entry) => [
        entry.directoryRef,
        entry,
      ]),
    );
    const memberByRef = new Map(
      packageContract.members.map((entry) => [
        entry.memberRef,
        entry,
      ]),
    );
    const observedEntryRefs = packageContract.directories
      .flatMap((entry) => entry.orderedEntryRefs);
    const expectedEntryRefs = [
      ...packageContract.directories
        .filter((entry) => entry.relativeLocator !== ".")
        .map((entry) => entry.directoryRef),
      ...packageContract.members.map((entry) => entry.memberRef),
    ];
    if (
      path.posix.dirname(packageContract.root)
        !== PLATFORM_RELEASE_BOOTSTRAP_PARENT_V2
      || path.posix.basename(packageContract.root)
        !== packageContract.rootBasename
      || rootDirectories.length !== 1
      || new Set(packageContract.directories.map((entry) =>
        entry.directoryRef)).size !== packageContract.directories.length
      || new Set(packageContract.members.map((entry) =>
        entry.memberRef)).size !== packageContract.members.length
      || new Set(packageContract.members.map((entry) =>
        entry.relativeLocator)).size !== packageContract.members.length
      || observedEntryRefs.length !== expectedEntryRefs.length
      || new Set(observedEntryRefs).size !== observedEntryRefs.length
      || expectedEntryRefs.some((entryRef) =>
        !observedEntryRefs.includes(entryRef))
      || packageContract.directories.some((directory) =>
        directory.orderedEntryBasenames.some((basename, index) =>
          index > 0
          && directory.orderedEntryBasenames[index - 1]! >= basename))
      || packageContract.directories.some((directory) =>
        directory.orderedEntryRefs.some((entryRef, index) => {
          const childDirectory = directoryByRef.get(entryRef);
          const member = memberByRef.get(entryRef);
          const expectedBasename = childDirectory
            ? path.posix.basename(childDirectory.relativeLocator)
            : member
              ? path.posix.basename(member.relativeLocator)
              : undefined;
          return expectedBasename
            !== directory.orderedEntryBasenames[index];
        }))
      || packageContract.members.some((member) => {
        const parent = directoryByRef.get(member.parentDirectoryRef);
        return !parent
          || path.posix.dirname(member.relativeLocator)
            !== parent.relativeLocator;
      })
      || !packageContract.members.some((member) =>
        member.role === "canonical_manifest"
        && member.relativeLocator === packageContract.manifestLocator)
    ) {
      return `Bootstrap package ${packageContract.packageRef} topology is not exact`;
    }
  }
  const packageByRef = new Map(
    value.packages.map((entry) => [entry.packageRef, entry]),
  );
  for (
    const operation
    of PLATFORM_RELEASE_BOOTSTRAP_OPERATION_ABI_SET_V2.operations
  ) {
    const ownerPackage = packageByRef.get(operation.ownerPackageRef);
    const processExecutable = ownerPackage?.members.find((member) =>
      member.memberRef === operation.processExecutableMemberRef);
    const implementation = ownerPackage?.members.find((member) =>
      member.memberRef === operation.implementationMemberRef);
    const interpreterPackage =
      operation.interpreterPackageRef === null
        ? undefined
        : packageByRef.get(operation.interpreterPackageRef);
    const interpreter =
      operation.interpreterMemberRef === null
        ? undefined
        : interpreterPackage?.members.find((member) =>
          member.memberRef === operation.interpreterMemberRef);
    const interpreterBindingIsExact =
      operation.implementationKind === "signed_native_executable"
        ? operation.processLaunchPolicy
            ===
              "exact_native_executable_then_fixed_application_argv_v2"
          && operation.interpreterPackageRef === null
          && operation.interpreterMemberRef === null
        : operation.processLaunchPolicy
            ===
              "exact_node_runtime_then_release_executable_then_fixed_application_argv_v2"
          && interpreterPackage?.packageRef
            === PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2
              .nodeToolchainProvisioner
          && interpreter?.role === "node_runtime";
    if (
      !ownerPackage
      || !processExecutable
      || (
        processExecutable.role !== "signed_native_executable"
        && processExecutable.role !== "release_executable"
      )
      || !implementation
      || !interpreterBindingIsExact
      || (
        operation.moduleExport === null
          ? implementation.memberRef !== processExecutable.memberRef
          : !implementation.requiredExports.includes(
            operation.moduleExport,
          )
      )
    ) {
      return `Bootstrap operation ${operation.abiRef} package member binding is not exact`;
    }
  }
  const parentRefs = new Set(
    value.systemAnchors.parents.map((entry) => entry.parentRef),
  );
  const fileRefs = new Set(
    value.systemAnchors.files.map((entry) => entry.fileRef),
  );
  if (
    parentRefs.size !== 2
    || fileRefs.size !== 4
    || value.systemAnchors.files.some((entry) =>
      !parentRefs.has(entry.parentRef)
      || path.posix.dirname(entry.absoluteLocator)
        !== value.systemAnchors.parents.find((parent) =>
          parent.parentRef === entry.parentRef)?.absoluteLocator)
    || value.systemAnchors.logicalBindings.some((entry) =>
      !fileRefs.has(entry.fileRef))
  ) {
    return "Bootstrap fixed system-anchor topology is incomplete";
  }
  const xattrBindings = value.systemAnchors.logicalBindings
    .filter((entry) => entry.roleRef.includes("XATTR_"));
  if (
    xattrBindings.length !== 2
    || xattrBindings[0]!.fileRef !== xattrBindings[1]!.fileRef
  ) {
    return "Bootstrap xattr logical roles must share one physical file";
  }
  return undefined;
}

export const PlatformReleaseBootstrapContractV2Schema =
  PlatformReleaseBootstrapContractIdentityV2Schema.extend({
    contractHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const { contractHash: _contractHash, ...identity } = value;
    const issue = exactContractIssue(identity);
    if (
      !platformReleaseCandidateFitsCanonicalCapV2(
        value,
        PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_MAX_CANONICAL_BYTES_V2,
      )
      || issue !== undefined
      || canonicalJsonStringify(identity)
        !== canonicalJsonStringify(contractIdentityV2)
      || value.contractHash
        !== hashPlatformReleaseBootstrapContractV2(identity)
    ) {
      context.addIssue({
        code: "custom",
        path: ["contractHash"],
        message:
          issue
          ?? "Bootstrap contract must equal the exact code-owned topology and policy",
      });
    }
  });

export type PlatformReleaseBootstrapContractV2 =
  z.infer<typeof PlatformReleaseBootstrapContractV2Schema>;

export const PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2:
PlatformReleaseBootstrapContractV2 =
  deepFreezePlatformReleaseJsonV2(
    PlatformReleaseBootstrapContractV2Schema.parse({
      ...contractIdentityV2,
      contractHash:
        hashPlatformReleaseBootstrapContractV2(contractIdentityV2),
    }),
  );

export function getPlatformReleaseBootstrapContractV2():
PlatformReleaseBootstrapContractV2 {
  return deepFreezePlatformReleaseJsonV2(
    structuredClone(PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2),
  );
}

export function getPlatformReleaseBootstrapRegistryDocumentProtocolCatalogV2():
PlatformReleaseBootstrapRegistryDocumentProtocolCatalogV2 {
  return deepFreezePlatformReleaseJsonV2(
    structuredClone(
      PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_DOCUMENT_PROTOCOL_CATALOG_V2,
    ),
  );
}

export function getPlatformReleaseBootstrapRegistryDocumentProtocolV2(
  schemaRef: string,
): PlatformReleaseBootstrapRegistryDocumentProtocolV2 {
  const found =
    PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_DOCUMENT_PROTOCOL_CATALOG_V2
      .documents.find((entry) => entry.schemaRef === schemaRef);
  if (!found) {
    throw new TypeError(
      "Registry document schema reference is not code-owned",
    );
  }
  return deepFreezePlatformReleaseJsonV2(structuredClone(found));
}

export function parsePlatformReleaseBootstrapRegistryDocumentProtocolCandidateV2(
  input: unknown,
): PlatformReleaseBootstrapRegistryDocumentProtocolV2 {
  const snapshot = boundedPlatformReleaseJsonSnapshotV2(
    input,
    PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_DOCUMENT_PROTOCOL_CATALOG_MAX_CANONICAL_BYTES_V2,
  );
  return deepFreezePlatformReleaseJsonV2(
    PlatformReleaseBootstrapRegistryDocumentProtocolV2Schema.parse(
      snapshot,
    ),
  );
}

export function parsePlatformReleaseBootstrapRegistryDocumentProtocolCatalogCandidateV2(
  input: unknown,
): PlatformReleaseBootstrapRegistryDocumentProtocolCatalogV2 {
  const snapshot = boundedPlatformReleaseJsonSnapshotV2(
    input,
    PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_DOCUMENT_PROTOCOL_CATALOG_MAX_CANONICAL_BYTES_V2,
  );
  return deepFreezePlatformReleaseJsonV2(
    PlatformReleaseBootstrapRegistryDocumentProtocolCatalogV2Schema
      .parse(snapshot),
  );
}

export function parsePlatformReleaseBootstrapContractCandidateV2(
  input: unknown,
): PlatformReleaseBootstrapContractV2 {
  const snapshot = boundedPlatformReleaseJsonSnapshotV2(
    input,
    PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_MAX_CANONICAL_BYTES_V2,
  );
  return deepFreezePlatformReleaseJsonV2(
    PlatformReleaseBootstrapContractV2Schema.parse(snapshot),
  );
}
