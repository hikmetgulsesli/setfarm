import {
  createHash,
  createPublicKey,
  verify as verifySignature,
} from "node:crypto";
import { isProxy } from "node:util/types";

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
  PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2,
} from "./platform-release-bootstrap-contract-v2.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_OPERATION_ABI_SET_V2,
  PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2,
} from "./platform-release-bootstrap-operation-abis-v2.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CAPTURE_TRANSCRIPT_CONTRACT_V2,
} from "./platform-release-bootstrap-darwin-capture-transcripts-v2.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_ABI_SET_V2,
} from "./platform-release-bootstrap-darwin-filesystem-backend-v2.js";

export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_CONTRACT_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-darwin-native-distribution-contract.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_ENTRY_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-darwin-native-distribution-entry.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_CATALOG_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-darwin-native-distribution-catalog.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_CATALOG_SIGNING_PREIMAGE_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-darwin-native-distribution-catalog-signing-preimage.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SIGNED_NATIVE_DISTRIBUTION_CATALOG_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-darwin-signed-native-distribution-catalog.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_VERIFICATION_INPUT_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-darwin-native-distribution-verification-input.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_VERIFICATION_RECEIPT_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-darwin-native-distribution-verification-receipt.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_SELECTION_INPUT_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-darwin-native-distribution-selection-input.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_SELECTION_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-darwin-native-distribution-selection.v2" as const;

export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_CONTRACT_MAX_CANONICAL_BYTES_V2 =
  64 * 1024;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_ENTRY_MAX_CANONICAL_BYTES_V2 =
  64 * 1024;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_CATALOG_MAX_CANONICAL_BYTES_V2 =
  192 * 1024;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SIGNED_NATIVE_DISTRIBUTION_CATALOG_MAX_CANONICAL_BYTES_V2 =
  256 * 1024;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_VERIFICATION_INPUT_MAX_CANONICAL_BYTES_V2 =
  320 * 1024;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_VERIFICATION_RECEIPT_MAX_CANONICAL_BYTES_V2 =
  64 * 1024;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_SELECTION_INPUT_MAX_CANONICAL_BYTES_V2 =
  320 * 1024;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_SELECTION_MAX_CANONICAL_BYTES_V2 =
  64 * 1024;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_PUBLIC_SPKI_MAX_DER_BYTES_V2 =
  256;

export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_ARCHITECTURES_V2 =
  Object.freeze(["arm64", "x64"] as const);
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_PROVIDER_MEMBER_REF_V2 =
  "BOOTSTRAP_HOST_VERIFIER_EXECUTABLE_V2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_PRODUCTION_USE_V2 =
  "forbidden_without_live_installer_amfi_admission" as const;

const providerPackageV2 = PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.packages.find(
  (entry) =>
    entry.packageRef === PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.hostVerifier,
);
if (
  providerPackageV2 === undefined ||
  providerPackageV2.packageKind !== "signed_native_leaf" ||
  providerPackageV2.distributionPolicy !==
    "signed_installer_native_distribution_v2" ||
  providerPackageV2.verifierPolicy !==
    "amfi_self_attest_then_descriptor_revalidation_v2"
) {
  throw new TypeError(
    "Darwin native distribution contract requires the exact signed host verifier package",
  );
}

const providerMemberV2 = providerPackageV2.members.find(
  (entry) =>
    entry.memberRef ===
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_PROVIDER_MEMBER_REF_V2,
);
if (
  providerMemberV2 === undefined ||
  providerMemberV2.role !== "signed_native_executable" ||
  providerMemberV2.mediaType !== "application/x-mach-binary" ||
  providerMemberV2.requiredMode !== "0555" ||
  providerMemberV2.requiredLinkCount !== 1
) {
  throw new TypeError(
    "Darwin native distribution contract requires the exact signed Mach-O provider member",
  );
}

export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_PROVIDER_MAX_ARTIFACT_BYTES_V2 =
  providerMemberV2.maxBytes;

const ReverseDnsIdentifierV2Schema = z.string()
  .min(3)
  .max(255)
  .regex(
    /^(?:[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/,
    "Expected one canonical lowercase reverse-DNS ASCII identifier",
  );

const CanonicalBase64V2Schema = z.string()
  .min(4)
  .max(512)
  .regex(
    /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/,
    "Expected canonical base64",
  )
  .refine((value) => {
    const bytes = Buffer.from(value, "base64");
    return bytes.length > 0 && bytes.toString("base64") === value;
  }, "Expected round-tripping canonical base64");

export const PlatformReleaseBootstrapDarwinNativeDistributionEd25519SignatureV2Schema =
  z.string()
    .length(88)
    .regex(
      /^[A-Za-z0-9+/]{86}==$/,
      "Expected one canonical base64 Ed25519 signature",
    )
    .refine((value) => {
      const bytes = Buffer.from(value, "base64");
      return bytes.length === 64 && bytes.toString("base64") === value;
    }, "Expected exactly 64 canonical Ed25519 signature bytes");

const contractIdentityV2 = {
  schema:
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_CONTRACT_V2_SCHEMA,
  version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
  productionUse: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_PRODUCTION_USE_V2,
  providerPackageRef: PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.hostVerifier,
  providerMemberRef:
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_PROVIDER_MEMBER_REF_V2,
  providerPackageKind: "signed_native_leaf" as const,
  providerMemberRole: "signed_native_executable" as const,
  providerMediaType: "application/x-mach-binary" as const,
  providerRequiredMode: "0555" as const,
  providerRequiredLinkCount: 1 as const,
  providerMaxArtifactBytes:
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_PROVIDER_MAX_ARTIFACT_BYTES_V2,
  requiredArchitectures: [
    ...PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_ARCHITECTURES_V2,
  ],
  signatureAlgorithm: "ed25519" as const,
  registryContractHash: PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.contractHash,
  operationAbiSetHash:
    PLATFORM_RELEASE_BOOTSTRAP_OPERATION_ABI_SET_V2.abiSetHash,
  backendAbiHash:
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_ABI_SET_V2.backendAbiHash,
  captureTranscriptContractHash:
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CAPTURE_TRANSCRIPT_CONTRACT_V2.captureTranscriptContractHash,
} as const;

const NativeDistributionContractIdentityV2Schema = z.object({
  schema: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_CONTRACT_V2_SCHEMA,
  ),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  productionUse: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_PRODUCTION_USE_V2,
  ),
  providerPackageRef: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.hostVerifier,
  ),
  providerMemberRef: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_PROVIDER_MEMBER_REF_V2,
  ),
  providerPackageKind: z.literal("signed_native_leaf"),
  providerMemberRole: z.literal("signed_native_executable"),
  providerMediaType: z.literal("application/x-mach-binary"),
  providerRequiredMode: z.literal("0555"),
  providerRequiredLinkCount: z.literal(1),
  providerMaxArtifactBytes: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_PROVIDER_MAX_ARTIFACT_BYTES_V2,
  ),
  requiredArchitectures: z.tuple([
    z.literal("arm64"),
    z.literal("x64"),
  ]),
  signatureAlgorithm: z.literal("ed25519"),
  registryContractHash: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.contractHash,
  ),
  operationAbiSetHash: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_OPERATION_ABI_SET_V2.abiSetHash,
  ),
  backendAbiHash: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_ABI_SET_V2.backendAbiHash,
  ),
  captureTranscriptContractHash: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CAPTURE_TRANSCRIPT_CONTRACT_V2.captureTranscriptContractHash,
  ),
}).strict();

export type PlatformReleaseBootstrapDarwinNativeDistributionContractHashPayloadV2 =
  z.infer<typeof NativeDistributionContractIdentityV2Schema>;

export function hashPlatformReleaseBootstrapDarwinNativeDistributionContractV2(
  value:
    | PlatformReleaseBootstrapDarwinNativeDistributionContractHashPayloadV2
    | PlatformReleaseBootstrapDarwinNativeDistributionContractV2
    | Readonly<Record<string, unknown>>,
): string {
  const contract = { ...value } as Record<string, unknown>;
  delete contract.contractHash;
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-bootstrap-darwin-native-distribution-contract-hash.v2",
    contract,
  });
}

export const PlatformReleaseBootstrapDarwinNativeDistributionContractV2Schema =
  NativeDistributionContractIdentityV2Schema.extend({
    contractHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (
      !platformReleaseCandidateFitsCanonicalCapV2(
        value,
        PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_CONTRACT_MAX_CANONICAL_BYTES_V2,
      ) ||
      value.contractHash !==
        hashPlatformReleaseBootstrapDarwinNativeDistributionContractV2(value)
    ) {
      context.addIssue({
        code: "custom",
        path: ["contractHash"],
        message: "Darwin native distribution contract hash mismatch",
      });
    }
  });

export type PlatformReleaseBootstrapDarwinNativeDistributionContractV2 =
  z.infer<
    typeof PlatformReleaseBootstrapDarwinNativeDistributionContractV2Schema
  >;

export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_CONTRACT_V2 =
  deepFreezePlatformReleaseJsonV2(
    PlatformReleaseBootstrapDarwinNativeDistributionContractV2Schema.parse({
      ...contractIdentityV2,
      contractHash:
        hashPlatformReleaseBootstrapDarwinNativeDistributionContractV2(
          contractIdentityV2,
        ),
    }),
  );

export function parsePlatformReleaseBootstrapDarwinNativeDistributionContractCandidateV2(
  input: unknown,
): PlatformReleaseBootstrapDarwinNativeDistributionContractV2 {
  return deepFreezePlatformReleaseJsonV2(
    PlatformReleaseBootstrapDarwinNativeDistributionContractV2Schema.parse(
      boundedPlatformReleaseJsonSnapshotV2(
        input,
        PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_CONTRACT_MAX_CANONICAL_BYTES_V2,
      ),
    ),
  );
}

const NativeDistributionEntryIdentityV2Schema = z.object({
  schema: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_ENTRY_V2_SCHEMA,
  ),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  distributionContractHash: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_CONTRACT_V2.contractHash,
  ),
  providerPackageRef: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.hostVerifier,
  ),
  providerMemberRef: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_PROVIDER_MEMBER_REF_V2,
  ),
  architecture: z.enum(["arm64", "x64"]),
  distributionEpoch: z.number().int().positive().safe(),
  artifactByteLength: z.number().int().positive().max(
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_PROVIDER_MAX_ARTIFACT_BYTES_V2,
  ),
  artifactContentHash: Sha256Schema,
  codeDirectoryHash: Sha256Schema,
  sourceTreeHash: Sha256Schema,
  buildRecipeHash: Sha256Schema,
  buildAttestationHash: Sha256Schema,
  packageManifestHash: Sha256Schema,
  registryContractHash: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.contractHash,
  ),
  operationAbiSetHash: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_OPERATION_ABI_SET_V2.abiSetHash,
  ),
  backendAbiHash: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_ABI_SET_V2.backendAbiHash,
  ),
  captureTranscriptContractHash: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CAPTURE_TRANSCRIPT_CONTRACT_V2.captureTranscriptContractHash,
  ),
}).strict().superRefine((value, context) => {
  const evidenceRoleHashes = [
    value.artifactContentHash,
    value.codeDirectoryHash,
    value.sourceTreeHash,
    value.buildRecipeHash,
    value.buildAttestationHash,
    value.packageManifestHash,
  ];
  if (new Set(evidenceRoleHashes).size !== evidenceRoleHashes.length) {
    context.addIssue({
      code: "custom",
      path: ["artifactContentHash"],
      message:
        "Darwin native distribution entry evidence roles must have distinct commitments",
    });
  }
});

export type PlatformReleaseBootstrapDarwinNativeDistributionEntryHashPayloadV2 =
  z.infer<typeof NativeDistributionEntryIdentityV2Schema>;

export function hashPlatformReleaseBootstrapDarwinNativeDistributionEntryV2(
  value:
    | PlatformReleaseBootstrapDarwinNativeDistributionEntryHashPayloadV2
    | PlatformReleaseBootstrapDarwinNativeDistributionEntryV2,
): string {
  const entry = { ...value } as Record<string, unknown>;
  delete entry.entryHash;
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-bootstrap-darwin-native-distribution-entry-hash.v2",
    entry,
  });
}

export const PlatformReleaseBootstrapDarwinNativeDistributionEntryV2Schema =
  NativeDistributionEntryIdentityV2Schema.extend({
    entryHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (
      !platformReleaseCandidateFitsCanonicalCapV2(
        value,
        PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_ENTRY_MAX_CANONICAL_BYTES_V2,
      ) ||
      value.entryHash !==
        hashPlatformReleaseBootstrapDarwinNativeDistributionEntryV2(value)
    ) {
      context.addIssue({
        code: "custom",
        path: ["entryHash"],
        message: "Darwin native distribution entry hash mismatch",
      });
    }
  });

export type PlatformReleaseBootstrapDarwinNativeDistributionEntryV2 = z.infer<
  typeof PlatformReleaseBootstrapDarwinNativeDistributionEntryV2Schema
>;

export function parsePlatformReleaseBootstrapDarwinNativeDistributionEntryCandidateV2(
  input: unknown,
): PlatformReleaseBootstrapDarwinNativeDistributionEntryV2 {
  return deepFreezePlatformReleaseJsonV2(
    PlatformReleaseBootstrapDarwinNativeDistributionEntryV2Schema.parse(
      boundedPlatformReleaseJsonSnapshotV2(
        input,
        PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_ENTRY_MAX_CANONICAL_BYTES_V2,
      ),
    ),
  );
}

const NativeDistributionCatalogIdentityV2Schema = z.object({
  schema: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_CATALOG_V2_SCHEMA,
  ),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  productionUse: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_PRODUCTION_USE_V2,
  ),
  distributionContractHash: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_CONTRACT_V2.contractHash,
  ),
  installerPackageIdentifier: ReverseDnsIdentifierV2Schema,
  developerTeamIdentityHash: Sha256Schema,
  designatedRequirementHash: Sha256Schema,
  hardenedRuntimePolicyHash: Sha256Schema,
  libraryValidationPolicyHash: Sha256Schema,
  distributionEpoch: z.number().int().positive().safe(),
  offlineReleaseKeyId: Sha256Schema,
  entries: z.tuple([
    PlatformReleaseBootstrapDarwinNativeDistributionEntryV2Schema,
    PlatformReleaseBootstrapDarwinNativeDistributionEntryV2Schema,
  ]),
}).strict().superRefine((value, context) => {
  const exactArchitectures =
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_ARCHITECTURES_V2;
  if (
    value.entries.some(
      (entry, index) =>
        entry.architecture !== exactArchitectures[index] ||
        entry.distributionEpoch !== value.distributionEpoch,
    )
  ) {
    context.addIssue({
      code: "custom",
      path: ["entries"],
      message:
        "Darwin native distribution catalog requires exact ordered arm64 and x64 entries at one common positive epoch",
    });
  }
  const trustRoleHashes = [
    value.developerTeamIdentityHash,
    value.designatedRequirementHash,
    value.hardenedRuntimePolicyHash,
    value.libraryValidationPolicyHash,
    value.offlineReleaseKeyId,
  ];
  if (new Set(trustRoleHashes).size !== trustRoleHashes.length) {
    context.addIssue({
      code: "custom",
      path: ["developerTeamIdentityHash"],
      message:
        "Darwin native distribution trust roles must have distinct commitments",
    });
  }
  const semanticHashRoles: ReadonlyArray<readonly [string, string]> = [
    ["distributionContract", value.distributionContractHash],
    ["developerTeamIdentity", value.developerTeamIdentityHash],
    ["designatedRequirement", value.designatedRequirementHash],
    ["hardenedRuntimePolicy", value.hardenedRuntimePolicyHash],
    ["libraryValidationPolicy", value.libraryValidationPolicyHash],
    ["offlineReleaseKey", value.offlineReleaseKeyId],
    ...value.entries.flatMap((entry) => [
      ["distributionContract", entry.distributionContractHash] as const,
      ["artifactContent", entry.artifactContentHash] as const,
      ["codeDirectory", entry.codeDirectoryHash] as const,
      ["sourceTree", entry.sourceTreeHash] as const,
      ["buildRecipe", entry.buildRecipeHash] as const,
      ["buildAttestation", entry.buildAttestationHash] as const,
      ["packageManifest", entry.packageManifestHash] as const,
      ["registryContract", entry.registryContractHash] as const,
      ["operationAbiSet", entry.operationAbiSetHash] as const,
      ["backendAbi", entry.backendAbiHash] as const,
      ["captureTranscriptContract", entry.captureTranscriptContractHash] as const,
    ]),
  ];
  const roleByHash = new Map<string, string>();
  for (const [role, hash] of semanticHashRoles) {
    const existingRole = roleByHash.get(hash);
    if (existingRole !== undefined && existingRole !== role) {
      context.addIssue({
        code: "custom",
        path: ["catalogHash"],
        message:
          "Darwin native distribution catalog cannot reuse one commitment for different semantic roles",
      });
      break;
    }
    roleByHash.set(hash, role);
  }
});

export type PlatformReleaseBootstrapDarwinNativeDistributionCatalogHashPayloadV2 =
  z.infer<typeof NativeDistributionCatalogIdentityV2Schema>;

export function hashPlatformReleaseBootstrapDarwinNativeDistributionCatalogV2(
  value:
    | PlatformReleaseBootstrapDarwinNativeDistributionCatalogHashPayloadV2
    | PlatformReleaseBootstrapDarwinNativeDistributionCatalogV2,
): string {
  const catalog = { ...value } as Record<string, unknown>;
  delete catalog.catalogHash;
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-bootstrap-darwin-native-distribution-catalog-hash.v2",
    catalog,
  });
}

export const PlatformReleaseBootstrapDarwinNativeDistributionCatalogV2Schema =
  NativeDistributionCatalogIdentityV2Schema.extend({
    catalogHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (
      !platformReleaseCandidateFitsCanonicalCapV2(
        value,
        PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_CATALOG_MAX_CANONICAL_BYTES_V2,
      ) ||
      value.catalogHash !==
        hashPlatformReleaseBootstrapDarwinNativeDistributionCatalogV2(value)
    ) {
      context.addIssue({
        code: "custom",
        path: ["catalogHash"],
        message: "Darwin native distribution catalog hash mismatch",
      });
    }
  });

export type PlatformReleaseBootstrapDarwinNativeDistributionCatalogV2 = z.infer<
  typeof PlatformReleaseBootstrapDarwinNativeDistributionCatalogV2Schema
>;

export function parsePlatformReleaseBootstrapDarwinNativeDistributionCatalogCandidateV2(
  input: unknown,
): PlatformReleaseBootstrapDarwinNativeDistributionCatalogV2 {
  return deepFreezePlatformReleaseJsonV2(
    PlatformReleaseBootstrapDarwinNativeDistributionCatalogV2Schema.parse(
      boundedPlatformReleaseJsonSnapshotV2(
        input,
        PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_CATALOG_MAX_CANONICAL_BYTES_V2,
      ),
    ),
  );
}

export type PlatformReleaseBootstrapDarwinNativeDistributionCatalogSigningPreimageV2 =
  Readonly<{
    schema: typeof PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_CATALOG_SIGNING_PREIMAGE_V2_SCHEMA;
    signatureAlgorithm: "ed25519";
    offlineReleaseKeyId: string;
    catalog: PlatformReleaseBootstrapDarwinNativeDistributionCatalogV2;
  }>;

export function buildPlatformReleaseBootstrapDarwinNativeDistributionCatalogSigningPreimageV2(
  catalog: PlatformReleaseBootstrapDarwinNativeDistributionCatalogV2,
): PlatformReleaseBootstrapDarwinNativeDistributionCatalogSigningPreimageV2 {
  const parsed =
    parsePlatformReleaseBootstrapDarwinNativeDistributionCatalogCandidateV2(
      catalog,
    );
  return deepFreezePlatformReleaseJsonV2({
    schema:
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_CATALOG_SIGNING_PREIMAGE_V2_SCHEMA,
    signatureAlgorithm: "ed25519" as const,
    offlineReleaseKeyId: parsed.offlineReleaseKeyId,
    catalog: parsed,
  });
}

export function canonicalizePlatformReleaseBootstrapDarwinNativeDistributionCatalogSigningPreimageV2(
  catalog: PlatformReleaseBootstrapDarwinNativeDistributionCatalogV2,
): string {
  return canonicalJsonStringify(
    buildPlatformReleaseBootstrapDarwinNativeDistributionCatalogSigningPreimageV2(
      catalog,
    ),
  );
}

export function hashPlatformReleaseBootstrapDarwinNativeDistributionCatalogSigningPreimageV2(
  catalog: PlatformReleaseBootstrapDarwinNativeDistributionCatalogV2,
): string {
  return createHash("sha256")
    .update(
      canonicalizePlatformReleaseBootstrapDarwinNativeDistributionCatalogSigningPreimageV2(
        catalog,
      ),
      "utf8",
    )
    .digest("hex");
}

const SignedNativeDistributionCatalogIdentityV2Schema = z.object({
  schema: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SIGNED_NATIVE_DISTRIBUTION_CATALOG_V2_SCHEMA,
  ),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  productionUse: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_PRODUCTION_USE_V2,
  ),
  signatureAlgorithm: z.literal("ed25519"),
  offlineReleaseKeyId: Sha256Schema,
  catalog: PlatformReleaseBootstrapDarwinNativeDistributionCatalogV2Schema,
  signingPreimageHash: Sha256Schema,
  offlineSignature:
    PlatformReleaseBootstrapDarwinNativeDistributionEd25519SignatureV2Schema,
}).strict().superRefine((value, context) => {
  if (
    value.offlineReleaseKeyId !== value.catalog.offlineReleaseKeyId ||
    value.signingPreimageHash !==
      hashPlatformReleaseBootstrapDarwinNativeDistributionCatalogSigningPreimageV2(
        value.catalog,
      )
  ) {
    context.addIssue({
      code: "custom",
      path: ["signingPreimageHash"],
      message:
        "Signed Darwin native distribution catalog must bind its exact key and signing preimage",
    });
  }
});

export type PlatformReleaseBootstrapDarwinSignedNativeDistributionCatalogHashPayloadV2 =
  z.infer<typeof SignedNativeDistributionCatalogIdentityV2Schema>;

export function hashPlatformReleaseBootstrapDarwinSignedNativeDistributionCatalogV2(
  value:
    | PlatformReleaseBootstrapDarwinSignedNativeDistributionCatalogHashPayloadV2
    | PlatformReleaseBootstrapDarwinSignedNativeDistributionCatalogV2,
): string {
  const envelope = { ...value } as Record<string, unknown>;
  delete envelope.signedEnvelopeHash;
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-bootstrap-darwin-signed-native-distribution-catalog-hash.v2",
    envelope,
  });
}

export const PlatformReleaseBootstrapDarwinSignedNativeDistributionCatalogV2Schema =
  SignedNativeDistributionCatalogIdentityV2Schema.extend({
    signedEnvelopeHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (
      !platformReleaseCandidateFitsCanonicalCapV2(
        value,
        PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SIGNED_NATIVE_DISTRIBUTION_CATALOG_MAX_CANONICAL_BYTES_V2,
      ) ||
      value.signedEnvelopeHash !==
        hashPlatformReleaseBootstrapDarwinSignedNativeDistributionCatalogV2(
          value,
        )
    ) {
      context.addIssue({
        code: "custom",
        path: ["signedEnvelopeHash"],
        message: "Signed Darwin native distribution envelope hash mismatch",
      });
    }
  });

export type PlatformReleaseBootstrapDarwinSignedNativeDistributionCatalogV2 =
  z.infer<
    typeof PlatformReleaseBootstrapDarwinSignedNativeDistributionCatalogV2Schema
  >;

export function parsePlatformReleaseBootstrapDarwinSignedNativeDistributionCatalogCandidateV2(
  input: unknown,
): PlatformReleaseBootstrapDarwinSignedNativeDistributionCatalogV2 {
  return deepFreezePlatformReleaseJsonV2(
    PlatformReleaseBootstrapDarwinSignedNativeDistributionCatalogV2Schema.parse(
      boundedPlatformReleaseJsonSnapshotV2(
        input,
        PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SIGNED_NATIVE_DISTRIBUTION_CATALOG_MAX_CANONICAL_BYTES_V2,
      ),
    ),
  );
}

const VerificationInputV2Schema = z.object({
  schema: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_VERIFICATION_INPUT_V2_SCHEMA,
  ),
  publicKeySpkiDerBase64: CanonicalBase64V2Schema,
  signedEnvelope:
    PlatformReleaseBootstrapDarwinSignedNativeDistributionCatalogV2Schema,
}).strict();

const VerificationReceiptIdentityV2Schema = z.object({
  schema: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_VERIFICATION_RECEIPT_V2_SCHEMA,
  ),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  authorityState: z.literal("caller_supplied_test_mechanics_only"),
  productionAuthority: z.literal(false),
  verificationState: z.literal("ed25519_signature_verified_only"),
  signatureAlgorithm: z.literal("ed25519"),
  offlineReleaseKeyId: Sha256Schema,
  distributionContractHash: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_CONTRACT_V2.contractHash,
  ),
  catalogHash: Sha256Schema,
  orderedEntryHashes: z.tuple([Sha256Schema, Sha256Schema]),
  signingPreimageHash: Sha256Schema,
  signedEnvelopeHash: Sha256Schema,
}).strict();

export type PlatformReleaseBootstrapDarwinNativeDistributionVerificationReceiptHashPayloadV2 =
  z.infer<typeof VerificationReceiptIdentityV2Schema>;

export function hashPlatformReleaseBootstrapDarwinNativeDistributionVerificationReceiptV2(
  value:
    | PlatformReleaseBootstrapDarwinNativeDistributionVerificationReceiptHashPayloadV2
    | PlatformReleaseBootstrapDarwinNativeDistributionVerificationReceiptV2
    | Readonly<Record<string, unknown>>,
): string {
  const receipt = { ...value } as Record<string, unknown>;
  delete receipt.verificationReceiptHash;
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-bootstrap-darwin-native-distribution-verification-receipt-hash.v2",
    receipt,
  });
}

export const PlatformReleaseBootstrapDarwinNativeDistributionVerificationReceiptV2Schema =
  VerificationReceiptIdentityV2Schema.extend({
    verificationReceiptHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (
      !platformReleaseCandidateFitsCanonicalCapV2(
        value,
        PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_VERIFICATION_RECEIPT_MAX_CANONICAL_BYTES_V2,
      ) ||
      value.verificationReceiptHash !==
        hashPlatformReleaseBootstrapDarwinNativeDistributionVerificationReceiptV2(
          value,
        )
    ) {
      context.addIssue({
        code: "custom",
        path: ["verificationReceiptHash"],
        message:
          "Darwin native distribution verification receipt hash mismatch",
      });
    }
  });

export type PlatformReleaseBootstrapDarwinNativeDistributionVerificationReceiptV2 =
  z.infer<
    typeof PlatformReleaseBootstrapDarwinNativeDistributionVerificationReceiptV2Schema
  >;

type AuthenticVerificationStateV2 = Readonly<{
  verificationReceiptHash: string;
  offlineReleaseKeyId: string;
  catalogHash: string;
  orderedEntryHashes: readonly [string, string];
  signingPreimageHash: string;
  signedEnvelopeHash: string;
}>;

const authenticVerificationReceiptsV2 = new WeakMap<
  object,
  AuthenticVerificationStateV2
>();

export type PlatformReleaseBootstrapDarwinNativeDistributionMechanicsErrorCodeV2 =
  | "NATIVE_DISTRIBUTION_PUBLIC_KEY_INVALID"
  | "NATIVE_DISTRIBUTION_KEY_ID_MISMATCH"
  | "NATIVE_DISTRIBUTION_SIGNATURE_INVALID"
  | "NATIVE_DISTRIBUTION_VERIFICATION_RECEIPT_UNAUTHENTICATED"
  | "NATIVE_DISTRIBUTION_SELECTION_MISMATCH"
  | "NATIVE_DISTRIBUTION_EPOCH_BELOW_FLOOR";

export class PlatformReleaseBootstrapDarwinNativeDistributionMechanicsErrorV2
  extends Error {
  readonly code:
    PlatformReleaseBootstrapDarwinNativeDistributionMechanicsErrorCodeV2;
  override readonly cause?: unknown;

  constructor(
    code: PlatformReleaseBootstrapDarwinNativeDistributionMechanicsErrorCodeV2,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message.slice(0, 1_500), options);
    this.name =
      "PlatformReleaseBootstrapDarwinNativeDistributionMechanicsErrorV2";
    this.code = code;
    this.cause = options?.cause;
  }
}

function mechanicsFailV2(
  code: PlatformReleaseBootstrapDarwinNativeDistributionMechanicsErrorCodeV2,
  message: string,
  cause?: unknown,
): never {
  throw new PlatformReleaseBootstrapDarwinNativeDistributionMechanicsErrorV2(
    code,
    message,
    cause === undefined ? undefined : { cause },
  );
}

export function verifyPlatformReleaseBootstrapDarwinNativeDistributionCatalogSignatureMechanicsV2(
  input: unknown,
): PlatformReleaseBootstrapDarwinNativeDistributionVerificationReceiptV2 {
  const parsed = VerificationInputV2Schema.parse(
    boundedPlatformReleaseJsonSnapshotV2(
      input,
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_VERIFICATION_INPUT_MAX_CANONICAL_BYTES_V2,
    ),
  );
  const publicKeyDer = Buffer.from(parsed.publicKeySpkiDerBase64, "base64");
  if (
    publicKeyDer.length < 1 ||
    publicKeyDer.length >
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_PUBLIC_SPKI_MAX_DER_BYTES_V2
  ) {
    return mechanicsFailV2(
      "NATIVE_DISTRIBUTION_PUBLIC_KEY_INVALID",
      "Darwin native distribution public SPKI DER exceeds its exact bound",
    );
  }

  let publicKey: ReturnType<typeof createPublicKey>;
  try {
    publicKey = createPublicKey({
      key: publicKeyDer,
      format: "der",
      type: "spki",
    });
  } catch (error) {
    return mechanicsFailV2(
      "NATIVE_DISTRIBUTION_PUBLIC_KEY_INVALID",
      "Darwin native distribution public key is not exact SPKI DER",
      error,
    );
  }
  const exportedDer = publicKey.export({ format: "der", type: "spki" });
  if (
    publicKey.asymmetricKeyType !== "ed25519" ||
    !Buffer.isBuffer(exportedDer) ||
    !exportedDer.equals(publicKeyDer)
  ) {
    return mechanicsFailV2(
      "NATIVE_DISTRIBUTION_PUBLIC_KEY_INVALID",
      "Darwin native distribution public key must be canonical Ed25519 SPKI DER",
    );
  }

  const keyId = createHash("sha256").update(publicKeyDer).digest("hex");
  const envelope = parsed.signedEnvelope;
  if (
    keyId !== envelope.offlineReleaseKeyId ||
    keyId !== envelope.catalog.offlineReleaseKeyId
  ) {
    return mechanicsFailV2(
      "NATIVE_DISTRIBUTION_KEY_ID_MISMATCH",
      "Darwin native distribution public key does not match the signed catalog key identity",
    );
  }

  const preimage = Buffer.from(
    canonicalizePlatformReleaseBootstrapDarwinNativeDistributionCatalogSigningPreimageV2(
      envelope.catalog,
    ),
    "utf8",
  );
  const signature = Buffer.from(envelope.offlineSignature, "base64");
  if (!verifySignature(null, preimage, publicKey, signature)) {
    return mechanicsFailV2(
      "NATIVE_DISTRIBUTION_SIGNATURE_INVALID",
      "Darwin native distribution catalog Ed25519 signature is invalid",
    );
  }

  const receiptIdentity = {
    schema:
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_VERIFICATION_RECEIPT_V2_SCHEMA,
    version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
    authorityState: "caller_supplied_test_mechanics_only" as const,
    productionAuthority: false as const,
    verificationState: "ed25519_signature_verified_only" as const,
    signatureAlgorithm: "ed25519" as const,
    offlineReleaseKeyId: keyId,
    distributionContractHash:
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_CONTRACT_V2.contractHash,
    catalogHash: envelope.catalog.catalogHash,
    orderedEntryHashes: [
      envelope.catalog.entries[0].entryHash,
      envelope.catalog.entries[1].entryHash,
    ] as const,
    signingPreimageHash: envelope.signingPreimageHash,
    signedEnvelopeHash: envelope.signedEnvelopeHash,
  };
  const receipt = deepFreezePlatformReleaseJsonV2(
    PlatformReleaseBootstrapDarwinNativeDistributionVerificationReceiptV2Schema.parse(
      {
        ...receiptIdentity,
        verificationReceiptHash:
          hashPlatformReleaseBootstrapDarwinNativeDistributionVerificationReceiptV2(
            receiptIdentity,
          ),
      },
    ),
  );
  authenticVerificationReceiptsV2.set(receipt, Object.freeze({
    verificationReceiptHash: receipt.verificationReceiptHash,
    offlineReleaseKeyId: receipt.offlineReleaseKeyId,
    catalogHash: receipt.catalogHash,
    orderedEntryHashes: Object.freeze([
      receipt.orderedEntryHashes[0],
      receipt.orderedEntryHashes[1],
    ]) as readonly [string, string],
    signingPreimageHash: receipt.signingPreimageHash,
    signedEnvelopeHash: receipt.signedEnvelopeHash,
  }));
  return receipt;
}

const SelectionInputV2Schema = z.object({
  schema: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_SELECTION_INPUT_V2_SCHEMA,
  ),
  signedEnvelope:
    PlatformReleaseBootstrapDarwinSignedNativeDistributionCatalogV2Schema,
  architecture: z.enum(["arm64", "x64"]),
  durableEpochFloor: z.number().int().nonnegative().safe(),
}).strict();

const SelectionIdentityV2Schema = z.object({
  schema: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_SELECTION_V2_SCHEMA,
  ),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  authorityState: z.literal("caller_supplied_test_mechanics_only"),
  productionAuthority: z.literal(false),
  providerPackageRef: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.hostVerifier,
  ),
  providerMemberRef: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_PROVIDER_MEMBER_REF_V2,
  ),
  architecture: z.enum(["arm64", "x64"]),
  durableEpochFloor: z.number().int().nonnegative().safe(),
  distributionEpoch: z.number().int().positive().safe(),
  artifactByteLength: z.number().int().positive().max(
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_PROVIDER_MAX_ARTIFACT_BYTES_V2,
  ),
  artifactContentHash: Sha256Schema,
  codeDirectoryHash: Sha256Schema,
  sourceTreeHash: Sha256Schema,
  buildRecipeHash: Sha256Schema,
  buildAttestationHash: Sha256Schema,
  packageManifestHash: Sha256Schema,
  registryContractHash: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.contractHash,
  ),
  operationAbiSetHash: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_OPERATION_ABI_SET_V2.abiSetHash,
  ),
  backendAbiHash: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_ABI_SET_V2.backendAbiHash,
  ),
  captureTranscriptContractHash: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CAPTURE_TRANSCRIPT_CONTRACT_V2.captureTranscriptContractHash,
  ),
  installerPackageIdentifier: ReverseDnsIdentifierV2Schema,
  developerTeamIdentityHash: Sha256Schema,
  designatedRequirementHash: Sha256Schema,
  hardenedRuntimePolicyHash: Sha256Schema,
  libraryValidationPolicyHash: Sha256Schema,
  offlineReleaseKeyId: Sha256Schema,
  distributionContractHash: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_CONTRACT_V2.contractHash,
  ),
  catalogHash: Sha256Schema,
  entryHash: Sha256Schema,
  signingPreimageHash: Sha256Schema,
  signedEnvelopeHash: Sha256Schema,
  verificationReceiptHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  if (value.distributionEpoch < Math.max(1, value.durableEpochFloor)) {
    context.addIssue({
      code: "custom",
      path: ["distributionEpoch"],
      message: "Darwin native distribution selection is below its durable floor",
    });
  }
});

export type PlatformReleaseBootstrapDarwinNativeDistributionSelectionHashPayloadV2 =
  z.infer<typeof SelectionIdentityV2Schema>;

export function hashPlatformReleaseBootstrapDarwinNativeDistributionSelectionV2(
  value:
    | PlatformReleaseBootstrapDarwinNativeDistributionSelectionHashPayloadV2
    | PlatformReleaseBootstrapDarwinNativeDistributionSelectionV2,
): string {
  const selection = { ...value } as Record<string, unknown>;
  delete selection.selectionHash;
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-bootstrap-darwin-native-distribution-selection-hash.v2",
    selection,
  });
}

export const PlatformReleaseBootstrapDarwinNativeDistributionSelectionV2Schema =
  SelectionIdentityV2Schema.extend({
    selectionHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (
      !platformReleaseCandidateFitsCanonicalCapV2(
        value,
        PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_SELECTION_MAX_CANONICAL_BYTES_V2,
      ) ||
      value.selectionHash !==
        hashPlatformReleaseBootstrapDarwinNativeDistributionSelectionV2(value)
    ) {
      context.addIssue({
        code: "custom",
        path: ["selectionHash"],
        message: "Darwin native distribution selection hash mismatch",
      });
    }
  });

export type PlatformReleaseBootstrapDarwinNativeDistributionSelectionV2 =
  z.infer<
    typeof PlatformReleaseBootstrapDarwinNativeDistributionSelectionV2Schema
  >;

export function selectPlatformReleaseBootstrapDarwinNativeDistributionEntryMechanicsV2(
  verificationReceipt:
    PlatformReleaseBootstrapDarwinNativeDistributionVerificationReceiptV2,
  input: unknown,
): PlatformReleaseBootstrapDarwinNativeDistributionSelectionV2 {
  if (
    typeof verificationReceipt !== "object" ||
    verificationReceipt === null ||
    isProxy(verificationReceipt)
  ) {
    return mechanicsFailV2(
      "NATIVE_DISTRIBUTION_VERIFICATION_RECEIPT_UNAUTHENTICATED",
      "Darwin native distribution selection requires one authentic mechanics receipt",
    );
  }
  const authentic = authenticVerificationReceiptsV2.get(verificationReceipt);
  if (authentic === undefined) {
    return mechanicsFailV2(
      "NATIVE_DISTRIBUTION_VERIFICATION_RECEIPT_UNAUTHENTICATED",
      "Darwin native distribution selection requires one authentic mechanics receipt",
    );
  }
  const parsed = SelectionInputV2Schema.parse(
    boundedPlatformReleaseJsonSnapshotV2(
      input,
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_SELECTION_INPUT_MAX_CANONICAL_BYTES_V2,
    ),
  );
  const envelope = parsed.signedEnvelope;
  const entryIndex = parsed.architecture === "arm64" ? 0 : 1;
  const entry = envelope.catalog.entries[entryIndex];
  if (
    authentic.verificationReceiptHash !==
      verificationReceipt.verificationReceiptHash ||
    authentic.offlineReleaseKeyId !== envelope.offlineReleaseKeyId ||
    authentic.catalogHash !== envelope.catalog.catalogHash ||
    authentic.signingPreimageHash !== envelope.signingPreimageHash ||
    authentic.signedEnvelopeHash !== envelope.signedEnvelopeHash ||
    authentic.orderedEntryHashes[0] !==
      envelope.catalog.entries[0].entryHash ||
    authentic.orderedEntryHashes[1] !==
      envelope.catalog.entries[1].entryHash ||
    entry.architecture !== parsed.architecture
  ) {
    return mechanicsFailV2(
      "NATIVE_DISTRIBUTION_SELECTION_MISMATCH",
      "Darwin native distribution selection does not match its verified catalog occurrence",
    );
  }
  if (
    entry.distributionEpoch < Math.max(1, parsed.durableEpochFloor)
  ) {
    return mechanicsFailV2(
      "NATIVE_DISTRIBUTION_EPOCH_BELOW_FLOOR",
      "Darwin native distribution epoch is below the durable floor",
    );
  }

  const selectionIdentity = {
    schema:
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_SELECTION_V2_SCHEMA,
    version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
    authorityState: "caller_supplied_test_mechanics_only" as const,
    productionAuthority: false as const,
    providerPackageRef: entry.providerPackageRef,
    providerMemberRef: entry.providerMemberRef,
    architecture: entry.architecture,
    durableEpochFloor: parsed.durableEpochFloor,
    distributionEpoch: entry.distributionEpoch,
    artifactByteLength: entry.artifactByteLength,
    artifactContentHash: entry.artifactContentHash,
    codeDirectoryHash: entry.codeDirectoryHash,
    sourceTreeHash: entry.sourceTreeHash,
    buildRecipeHash: entry.buildRecipeHash,
    buildAttestationHash: entry.buildAttestationHash,
    packageManifestHash: entry.packageManifestHash,
    registryContractHash: entry.registryContractHash,
    operationAbiSetHash: entry.operationAbiSetHash,
    backendAbiHash: entry.backendAbiHash,
    captureTranscriptContractHash: entry.captureTranscriptContractHash,
    installerPackageIdentifier: envelope.catalog.installerPackageIdentifier,
    developerTeamIdentityHash: envelope.catalog.developerTeamIdentityHash,
    designatedRequirementHash: envelope.catalog.designatedRequirementHash,
    hardenedRuntimePolicyHash: envelope.catalog.hardenedRuntimePolicyHash,
    libraryValidationPolicyHash: envelope.catalog.libraryValidationPolicyHash,
    offlineReleaseKeyId: envelope.offlineReleaseKeyId,
    distributionContractHash: entry.distributionContractHash,
    catalogHash: envelope.catalog.catalogHash,
    entryHash: entry.entryHash,
    signingPreimageHash: envelope.signingPreimageHash,
    signedEnvelopeHash: envelope.signedEnvelopeHash,
    verificationReceiptHash: verificationReceipt.verificationReceiptHash,
  };
  return deepFreezePlatformReleaseJsonV2(
    PlatformReleaseBootstrapDarwinNativeDistributionSelectionV2Schema.parse({
      ...selectionIdentity,
      selectionHash:
        hashPlatformReleaseBootstrapDarwinNativeDistributionSelectionV2(
          selectionIdentity,
        ),
    }),
  );
}

export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_PRODUCTION_TRUST_CONFIGURATION_V2 =
  deepFreezePlatformReleaseJsonV2({
    schema:
      "setfarm.platform-release-bootstrap-darwin-native-distribution-production-trust-configuration.v2" as const,
    version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
    state: "unavailable" as const,
    productionAdmission: "forbidden" as const,
    offlineReleasePublicKeySpkiDerBase64: null,
    signedNativeDistributionCatalog: null,
  });
