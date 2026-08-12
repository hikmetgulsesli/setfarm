import { z } from "zod";

import {
  PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2,
} from
  "../execution/schemas/platform-release-bootstrap-contract-v2.js";
import {
  PlatformReleaseBootstrapPackageRefV2Schema,
} from
  "../execution/schemas/platform-release-bootstrap-operation-abis-v2.js";
import {
  PLATFORM_RELEASE_COMPONENT_VERSION_V2,
  deepFreezePlatformReleaseJsonV2,
  platformReleaseCandidateFitsCanonicalCapV2,
} from "../execution/schemas/platform-release-common-v2.js";
import {
  canonicalJsonBytesBounded,
} from "./bounded-canonical-json.js";
import {
  canonicalJsonStringify,
  hashCanonicalJson,
} from "./canonical-json.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_NAMESPACE_CENSUS_MAX_ENTRIES_V2,
  PlatformReleaseBootstrapNamespaceCensusV2Schema,
  PlatformReleaseBootstrapNamespaceClassificationV2Schema,
  type PlatformReleaseBootstrapNamespaceCensusV2,
  type PlatformReleaseBootstrapNamespaceClassificationV2,
} from "./platform-release-bootstrap-registry-v2.js";
import { Sha256Schema } from "./schemas/common-v1.js";

export const PLATFORM_RELEASE_BOOTSTRAP_FILESYSTEM_SCOPE_IDENTITY_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-filesystem-scope-identity.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_FILESYSTEM_SCOPE_IDENTITY_HASH_V2_DOMAIN =
  "setfarm.platform-release-bootstrap-filesystem-scope-identity-hash.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_STABLE_FS_OBJECT_IDENTITY_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-stable-fs-object-identity.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_STABLE_FS_OBJECT_IDENTITY_HASH_V2_DOMAIN =
  "setfarm.platform-release-bootstrap-stable-fs-object-identity-hash.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_FILESYSTEM_OBJECT_LOCATOR_KEY_V2_DOMAIN =
  "setfarm.platform-release-bootstrap-filesystem-object-locator-key.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_FS_OBSERVATION_FINGERPRINT_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-fs-observation-fingerprint.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_FS_OBSERVATION_FINGERPRINT_HASH_V2_DOMAIN =
  "setfarm.platform-release-bootstrap-fs-observation-fingerprint-hash.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_DIRECTORY_MEMBERSHIP_IDENTITY_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-directory-membership-identity.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_DIRECTORY_MEMBERSHIP_IDENTITY_HASH_V2_DOMAIN =
  "setfarm.platform-release-bootstrap-directory-membership-identity-hash.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_NAMESPACE_PHYSICAL_ENTRY_CAPTURE_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-namespace-physical-entry-capture.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_NAMESPACE_PHYSICAL_ENTRY_CAPTURE_HASH_V2_DOMAIN =
  "setfarm.platform-release-bootstrap-namespace-physical-entry-capture-hash.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_NAMESPACE_PHYSICAL_CENSUS_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-namespace-physical-census.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_NAMESPACE_PHYSICAL_CENSUS_HASH_V2_DOMAIN =
  "setfarm.platform-release-bootstrap-namespace-physical-census-hash.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_LIFECYCLE_PHYSICAL_PROJECTION_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-package-lifecycle-physical-projection.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_LIFECYCLE_PHYSICAL_PROJECTION_HASH_V2_DOMAIN =
  "setfarm.platform-release-bootstrap-package-lifecycle-physical-projection-hash.v2" as const;

export const PLATFORM_RELEASE_BOOTSTRAP_PHYSICAL_CENSUS_MAX_CANONICAL_BYTES_V2 =
  16 * 1024 * 1024;
export const PLATFORM_RELEASE_BOOTSTRAP_PHYSICAL_IDENTITY_MAX_CANONICAL_BYTES_V2 =
  64 * 1024;
export const PLATFORM_RELEASE_BOOTSTRAP_PHYSICAL_DECIMAL_MAX_DIGITS_V2 =
  80;
export const PLATFORM_RELEASE_BOOTSTRAP_PHYSICAL_OWNER_ID_MAX_V2 =
  4_294_967_294;

const PHYSICAL_CENSUS_SNAPSHOT_LIMITS_V2 = Object.freeze({
  maxDepth: 64,
  maxNodes: 1_000_000,
  maxContainerEntries: 65_536,
  maxWorkUnits: 128 * 1024 * 1024,
});

const CanonicalUnsignedPhysicalDecimalV2Schema = z.string()
  .min(1)
  .max(PLATFORM_RELEASE_BOOTSTRAP_PHYSICAL_DECIMAL_MAX_DIGITS_V2)
  .regex(
    /^(?:0|[1-9][0-9]*)$/,
    "Expected one canonical unsigned physical decimal",
  );

const CanonicalFourOctalModeV2Schema = z.string().regex(
  /^[0-7]{4}$/,
  "Expected one canonical four-digit octal mode",
);

const NonnegativeSafeIntegerV2Schema =
  z.number().int().nonnegative().safe();
const PositiveSafeIntegerV2Schema =
  z.number().int().positive().safe();
const PhysicalOwnerIdV2Schema =
  NonnegativeSafeIntegerV2Schema.max(
    PLATFORM_RELEASE_BOOTSTRAP_PHYSICAL_OWNER_ID_MAX_V2,
  );

function boundedPhysicalJsonSnapshotV2(
  input: unknown,
  maxBytes: number,
): unknown {
  const bytes = canonicalJsonBytesBounded(input, {
    maxBytes,
    ...PHYSICAL_CENSUS_SNAPSHOT_LIMITS_V2,
  });
  return JSON.parse(bytes.toString("utf8"));
}

const BootstrapFilesystemScopeIdentityV2IdentitySchema = z.object({
  schema: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_FILESYSTEM_SCOPE_IDENTITY_V2_SCHEMA,
  ),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  registryContractHash: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.contractHash,
  ),
  scopeNonce: z.string().regex(
    /^[a-f0-9]{64}$/,
    "Expected one 256-bit lowercase-hex filesystem scope nonce",
  ),
}).strict();

export type BootstrapFilesystemScopeIdentityHashPayloadV2 =
  z.infer<typeof BootstrapFilesystemScopeIdentityV2IdentitySchema>;

export function hashBootstrapFilesystemScopeIdentityV2(
  value: BootstrapFilesystemScopeIdentityHashPayloadV2,
): string {
  return hashCanonicalJson({
    schema:
      PLATFORM_RELEASE_BOOTSTRAP_FILESYSTEM_SCOPE_IDENTITY_HASH_V2_DOMAIN,
    identity: {
      schema: value.schema,
      version: value.version,
      registryContractHash: value.registryContractHash,
      scopeNonce: value.scopeNonce,
    },
  });
}

export const BootstrapFilesystemScopeIdentityV2Schema =
  BootstrapFilesystemScopeIdentityV2IdentitySchema.extend({
    scopeIdentityHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (
      !platformReleaseCandidateFitsCanonicalCapV2(
        value,
        PLATFORM_RELEASE_BOOTSTRAP_PHYSICAL_IDENTITY_MAX_CANONICAL_BYTES_V2,
      )
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Bootstrap filesystem scope identity exceeds its fixed canonical byte cap",
      });
    }
    const {
      scopeIdentityHash: _scopeIdentityHash,
      ...identity
    } = value;
    if (
      value.scopeIdentityHash
        !== hashBootstrapFilesystemScopeIdentityV2(identity)
    ) {
      context.addIssue({
        code: "custom",
        path: ["scopeIdentityHash"],
        message: "Bootstrap filesystem scope identity hash mismatch",
      });
    }
  });

export type BootstrapFilesystemScopeIdentityV2 =
  z.infer<typeof BootstrapFilesystemScopeIdentityV2Schema>;

const BootstrapFilesystemScopeIdentityBuilderInputV2Schema =
  z.object({
    scopeNonce: z.string(),
  }).strict();

export type BootstrapFilesystemScopeIdentityBuilderInputV2 =
  z.infer<
    typeof BootstrapFilesystemScopeIdentityBuilderInputV2Schema
  >;

export function parseBootstrapFilesystemScopeIdentityCandidateV2(
  input: unknown,
): BootstrapFilesystemScopeIdentityV2 {
  const snapshot = boundedPhysicalJsonSnapshotV2(
    input,
    PLATFORM_RELEASE_BOOTSTRAP_PHYSICAL_IDENTITY_MAX_CANONICAL_BYTES_V2,
  );
  return deepFreezePlatformReleaseJsonV2(
    BootstrapFilesystemScopeIdentityV2Schema.parse(snapshot),
  );
}

export function buildBootstrapFilesystemScopeIdentityV2(
  input: BootstrapFilesystemScopeIdentityBuilderInputV2,
): BootstrapFilesystemScopeIdentityV2 {
  const parsedInput =
    BootstrapFilesystemScopeIdentityBuilderInputV2Schema.parse(
      boundedPhysicalJsonSnapshotV2(
        input,
        PLATFORM_RELEASE_BOOTSTRAP_PHYSICAL_IDENTITY_MAX_CANONICAL_BYTES_V2,
      ),
    );
  const identity = {
    schema:
      PLATFORM_RELEASE_BOOTSTRAP_FILESYSTEM_SCOPE_IDENTITY_V2_SCHEMA,
    version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
    registryContractHash:
      PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.contractHash,
    scopeNonce: parsedInput.scopeNonce,
  } as const;
  return parseBootstrapFilesystemScopeIdentityCandidateV2({
    ...identity,
    scopeIdentityHash:
      hashBootstrapFilesystemScopeIdentityV2(identity),
  });
}

export const StableFsObjectKindV2Schema = z.enum([
  "ordinary_file",
  "directory",
]);

export type StableFsObjectKindV2 =
  z.infer<typeof StableFsObjectKindV2Schema>;

const StableFsObjectIdentityV2IdentitySchema = z.object({
  schema: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_STABLE_FS_OBJECT_IDENTITY_V2_SCHEMA,
  ),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  filesystemScopeIdentityHash: Sha256Schema,
  objectKind: StableFsObjectKindV2Schema,
  device: CanonicalUnsignedPhysicalDecimalV2Schema,
  inode: CanonicalUnsignedPhysicalDecimalV2Schema,
}).strict();

export type StableFsObjectIdentityHashPayloadV2 =
  z.infer<typeof StableFsObjectIdentityV2IdentitySchema>;

export function hashStableFsObjectIdentityV2(
  value: StableFsObjectIdentityHashPayloadV2,
): string {
  return hashCanonicalJson({
    schema:
      PLATFORM_RELEASE_BOOTSTRAP_STABLE_FS_OBJECT_IDENTITY_HASH_V2_DOMAIN,
    identity: {
      schema: value.schema,
      version: value.version,
      filesystemScopeIdentityHash:
        value.filesystemScopeIdentityHash,
      objectKind: value.objectKind,
      device: value.device,
      inode: value.inode,
    },
  });
}

const FilesystemObjectLocatorKeyInputV2Schema = z.object({
  filesystemScopeIdentityHash: Sha256Schema,
  device: CanonicalUnsignedPhysicalDecimalV2Schema,
  inode: CanonicalUnsignedPhysicalDecimalV2Schema,
}).strict();

export type FilesystemObjectLocatorKeyInputV2 =
  z.infer<typeof FilesystemObjectLocatorKeyInputV2Schema>;

export function filesystemObjectLocatorKeyV2(
  value: FilesystemObjectLocatorKeyInputV2,
): string {
  const parsed = FilesystemObjectLocatorKeyInputV2Schema.parse({
    filesystemScopeIdentityHash:
      value.filesystemScopeIdentityHash,
    device: value.device,
    inode: value.inode,
  });
  return hashCanonicalJson({
    schema:
      PLATFORM_RELEASE_BOOTSTRAP_FILESYSTEM_OBJECT_LOCATOR_KEY_V2_DOMAIN,
    locator: parsed,
  });
}

export const StableFsObjectIdentityV2Schema =
  StableFsObjectIdentityV2IdentitySchema.extend({
    objectIdentityHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (
      !platformReleaseCandidateFitsCanonicalCapV2(
        value,
        PLATFORM_RELEASE_BOOTSTRAP_PHYSICAL_IDENTITY_MAX_CANONICAL_BYTES_V2,
      )
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Stable filesystem object identity exceeds its fixed canonical byte cap",
      });
    }
    const {
      objectIdentityHash: _objectIdentityHash,
      ...identity
    } = value;
    if (
      value.objectIdentityHash
        !== hashStableFsObjectIdentityV2(identity)
    ) {
      context.addIssue({
        code: "custom",
        path: ["objectIdentityHash"],
        message: "Stable filesystem object identity hash mismatch",
      });
    }
  });

export type StableFsObjectIdentityV2 =
  z.infer<typeof StableFsObjectIdentityV2Schema>;

const StableFsObjectIdentityBuilderInputV2Schema = z.object({
  filesystemScope: BootstrapFilesystemScopeIdentityV2Schema,
  objectKind: StableFsObjectKindV2Schema,
  device: CanonicalUnsignedPhysicalDecimalV2Schema,
  inode: CanonicalUnsignedPhysicalDecimalV2Schema,
}).strict();

export type StableFsObjectIdentityBuilderInputV2 =
  z.infer<typeof StableFsObjectIdentityBuilderInputV2Schema>;

export function parseStableFsObjectIdentityCandidateV2(
  input: unknown,
): StableFsObjectIdentityV2 {
  const snapshot = boundedPhysicalJsonSnapshotV2(
    input,
    PLATFORM_RELEASE_BOOTSTRAP_PHYSICAL_IDENTITY_MAX_CANONICAL_BYTES_V2,
  );
  return deepFreezePlatformReleaseJsonV2(
    StableFsObjectIdentityV2Schema.parse(snapshot),
  );
}

export function buildStableFsObjectIdentityV2(
  input: StableFsObjectIdentityBuilderInputV2,
): StableFsObjectIdentityV2 {
  const parsedInput =
    StableFsObjectIdentityBuilderInputV2Schema.parse(
      boundedPhysicalJsonSnapshotV2(
        input,
        PLATFORM_RELEASE_BOOTSTRAP_PHYSICAL_IDENTITY_MAX_CANONICAL_BYTES_V2,
      ),
    );
  const identity = {
    schema:
      PLATFORM_RELEASE_BOOTSTRAP_STABLE_FS_OBJECT_IDENTITY_V2_SCHEMA,
    version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
    filesystemScopeIdentityHash:
      parsedInput.filesystemScope.scopeIdentityHash,
    objectKind: parsedInput.objectKind,
    device: parsedInput.device,
    inode: parsedInput.inode,
  } as const;
  return parseStableFsObjectIdentityCandidateV2({
    ...identity,
    objectIdentityHash: hashStableFsObjectIdentityV2(identity),
  });
}

const FsObservationFingerprintV2IdentitySchema = z.object({
  schema: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_FS_OBSERVATION_FINGERPRINT_V2_SCHEMA,
  ),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  objectIdentityHash: Sha256Schema,
  ownerUid: PhysicalOwnerIdV2Schema,
  ownerGid: PhysicalOwnerIdV2Schema,
  mode: CanonicalFourOctalModeV2Schema,
  linkCount: PositiveSafeIntegerV2Schema,
  byteLength: NonnegativeSafeIntegerV2Schema,
  modifiedTimeNanoseconds:
    CanonicalUnsignedPhysicalDecimalV2Schema,
  changedTimeNanoseconds:
    CanonicalUnsignedPhysicalDecimalV2Schema,
}).strict();

export type FsObservationFingerprintHashPayloadV2 =
  z.infer<typeof FsObservationFingerprintV2IdentitySchema>;

export function hashFsObservationFingerprintV2(
  value: FsObservationFingerprintHashPayloadV2,
): string {
  return hashCanonicalJson({
    schema:
      PLATFORM_RELEASE_BOOTSTRAP_FS_OBSERVATION_FINGERPRINT_HASH_V2_DOMAIN,
    fingerprint: {
      schema: value.schema,
      version: value.version,
      objectIdentityHash: value.objectIdentityHash,
      ownerUid: value.ownerUid,
      ownerGid: value.ownerGid,
      mode: value.mode,
      linkCount: value.linkCount,
      byteLength: value.byteLength,
      modifiedTimeNanoseconds: value.modifiedTimeNanoseconds,
      changedTimeNanoseconds: value.changedTimeNanoseconds,
    },
  });
}

export const FsObservationFingerprintV2Schema =
  FsObservationFingerprintV2IdentitySchema.extend({
    fingerprintHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (
      !platformReleaseCandidateFitsCanonicalCapV2(
        value,
        PLATFORM_RELEASE_BOOTSTRAP_PHYSICAL_IDENTITY_MAX_CANONICAL_BYTES_V2,
      )
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Filesystem observation fingerprint exceeds its fixed canonical byte cap",
      });
    }
    const {
      fingerprintHash: _fingerprintHash,
      ...identity
    } = value;
    if (
      value.fingerprintHash
        !== hashFsObservationFingerprintV2(identity)
    ) {
      context.addIssue({
        code: "custom",
        path: ["fingerprintHash"],
        message: "Filesystem observation fingerprint hash mismatch",
      });
    }
  });

export type FsObservationFingerprintV2 =
  z.infer<typeof FsObservationFingerprintV2Schema>;

const FsObservationFingerprintBuilderInputV2Schema = z.object({
  objectIdentity: StableFsObjectIdentityV2Schema,
  ownerUid: PhysicalOwnerIdV2Schema,
  ownerGid: PhysicalOwnerIdV2Schema,
  mode: CanonicalFourOctalModeV2Schema,
  linkCount: PositiveSafeIntegerV2Schema,
  byteLength: NonnegativeSafeIntegerV2Schema,
  modifiedTimeNanoseconds:
    CanonicalUnsignedPhysicalDecimalV2Schema,
  changedTimeNanoseconds:
    CanonicalUnsignedPhysicalDecimalV2Schema,
}).strict();

export type FsObservationFingerprintBuilderInputV2 =
  z.infer<typeof FsObservationFingerprintBuilderInputV2Schema>;

export function parseFsObservationFingerprintCandidateV2(
  input: unknown,
): FsObservationFingerprintV2 {
  const snapshot = boundedPhysicalJsonSnapshotV2(
    input,
    PLATFORM_RELEASE_BOOTSTRAP_PHYSICAL_IDENTITY_MAX_CANONICAL_BYTES_V2,
  );
  return deepFreezePlatformReleaseJsonV2(
    FsObservationFingerprintV2Schema.parse(snapshot),
  );
}

export function buildFsObservationFingerprintV2(
  input: FsObservationFingerprintBuilderInputV2,
): FsObservationFingerprintV2 {
  const parsedInput =
    FsObservationFingerprintBuilderInputV2Schema.parse(
      boundedPhysicalJsonSnapshotV2(
        input,
        PLATFORM_RELEASE_BOOTSTRAP_PHYSICAL_IDENTITY_MAX_CANONICAL_BYTES_V2,
      ),
    );
  const identity = {
    schema:
      PLATFORM_RELEASE_BOOTSTRAP_FS_OBSERVATION_FINGERPRINT_V2_SCHEMA,
    version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
    objectIdentityHash:
      parsedInput.objectIdentity.objectIdentityHash,
    ownerUid: parsedInput.ownerUid,
    ownerGid: parsedInput.ownerGid,
    mode: parsedInput.mode,
    linkCount: parsedInput.linkCount,
    byteLength: parsedInput.byteLength,
    modifiedTimeNanoseconds:
      parsedInput.modifiedTimeNanoseconds,
    changedTimeNanoseconds:
      parsedInput.changedTimeNanoseconds,
  } as const;
  return parseFsObservationFingerprintCandidateV2({
    ...identity,
    fingerprintHash: hashFsObservationFingerprintV2(identity),
  });
}

const DirectoryMembershipBasenameV2Schema = z.string()
  .min(1)
  .max(255)
  .refine((value) =>
    !value.includes("/")
    && !value.includes("\\")
    && !value.includes("\0")
    && value !== "."
    && value !== "..", {
    message: "Expected one exact directory-member basename",
  });

export const DirectoryMembershipEntryV2Schema = z.object({
  basename: DirectoryMembershipBasenameV2Schema,
  objectKind: StableFsObjectKindV2Schema,
}).strict().superRefine((value, context) => {
  if (
    !platformReleaseCandidateFitsCanonicalCapV2(
      value,
      PLATFORM_RELEASE_BOOTSTRAP_PHYSICAL_IDENTITY_MAX_CANONICAL_BYTES_V2,
    )
  ) {
    context.addIssue({
      code: "custom",
      message:
        "Directory membership entry exceeds its fixed canonical byte cap",
    });
  }
});

export type DirectoryMembershipEntryV2 =
  z.infer<typeof DirectoryMembershipEntryV2Schema>;

const DirectoryMembershipIdentityV2IdentitySchema = z.object({
  schema: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_DIRECTORY_MEMBERSHIP_IDENTITY_V2_SCHEMA,
  ),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  entryCount: NonnegativeSafeIntegerV2Schema.max(
    PLATFORM_RELEASE_BOOTSTRAP_NAMESPACE_CENSUS_MAX_ENTRIES_V2,
  ),
  orderedEntries: z.array(
    DirectoryMembershipEntryV2Schema,
  ).max(PLATFORM_RELEASE_BOOTSTRAP_NAMESPACE_CENSUS_MAX_ENTRIES_V2),
}).strict();

export type DirectoryMembershipIdentityHashPayloadV2 =
  z.infer<typeof DirectoryMembershipIdentityV2IdentitySchema>;

export function hashDirectoryMembershipIdentityV2(
  value: DirectoryMembershipIdentityHashPayloadV2,
): string {
  return hashCanonicalJson({
    schema:
      PLATFORM_RELEASE_BOOTSTRAP_DIRECTORY_MEMBERSHIP_IDENTITY_HASH_V2_DOMAIN,
    membership: {
      schema: value.schema,
      version: value.version,
      entryCount: value.entryCount,
      orderedEntries: value.orderedEntries,
    },
  });
}

export const DirectoryMembershipIdentityV2Schema =
  DirectoryMembershipIdentityV2IdentitySchema.extend({
    membershipHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (
      !platformReleaseCandidateFitsCanonicalCapV2(
        value,
        PLATFORM_RELEASE_BOOTSTRAP_PHYSICAL_IDENTITY_MAX_CANONICAL_BYTES_V2,
      )
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Directory membership identity exceeds its fixed canonical byte cap",
      });
    }
    if (value.entryCount !== value.orderedEntries.length) {
      context.addIssue({
        code: "custom",
        path: ["entryCount"],
        message: "Directory membership entry count mismatch",
      });
    }
    for (let index = 1; index < value.orderedEntries.length; index += 1) {
      if (
        value.orderedEntries[index - 1]!.basename
          >= value.orderedEntries[index]!.basename
      ) {
        context.addIssue({
          code: "custom",
          path: ["orderedEntries", index, "basename"],
          message:
            "Directory membership basenames must be unique and strictly UTF-16 ordered",
        });
      }
    }
    const {
      membershipHash: _membershipHash,
      ...identity
    } = value;
    if (
      value.membershipHash
        !== hashDirectoryMembershipIdentityV2(identity)
    ) {
      context.addIssue({
        code: "custom",
        path: ["membershipHash"],
        message: "Directory membership identity hash mismatch",
      });
    }
  });

export type DirectoryMembershipIdentityV2 =
  z.infer<typeof DirectoryMembershipIdentityV2Schema>;

const DirectoryMembershipIdentityBuilderInputV2Schema = z.object({
  orderedEntries: z.array(
    DirectoryMembershipEntryV2Schema,
  ).max(PLATFORM_RELEASE_BOOTSTRAP_NAMESPACE_CENSUS_MAX_ENTRIES_V2),
}).strict();

export type DirectoryMembershipIdentityBuilderInputV2 =
  z.infer<typeof DirectoryMembershipIdentityBuilderInputV2Schema>;

export function parseDirectoryMembershipIdentityCandidateV2(
  input: unknown,
): DirectoryMembershipIdentityV2 {
  const snapshot = boundedPhysicalJsonSnapshotV2(
    input,
    PLATFORM_RELEASE_BOOTSTRAP_PHYSICAL_IDENTITY_MAX_CANONICAL_BYTES_V2,
  );
  return deepFreezePlatformReleaseJsonV2(
    DirectoryMembershipIdentityV2Schema.parse(snapshot),
  );
}

export function buildDirectoryMembershipIdentityV2(
  input: DirectoryMembershipIdentityBuilderInputV2,
): DirectoryMembershipIdentityV2 {
  const parsedInput =
    DirectoryMembershipIdentityBuilderInputV2Schema.parse(
      boundedPhysicalJsonSnapshotV2(
        input,
        PLATFORM_RELEASE_BOOTSTRAP_PHYSICAL_IDENTITY_MAX_CANONICAL_BYTES_V2,
      ),
    );
  const identity = {
    schema:
      PLATFORM_RELEASE_BOOTSTRAP_DIRECTORY_MEMBERSHIP_IDENTITY_V2_SCHEMA,
    version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
    entryCount: parsedInput.orderedEntries.length,
    orderedEntries: parsedInput.orderedEntries,
  } as const;
  return parseDirectoryMembershipIdentityCandidateV2({
    ...identity,
    membershipHash:
      hashDirectoryMembershipIdentityV2(identity),
  });
}

export const NamespacePhysicalContentEvidenceV2Schema =
  z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("bounded_regular_file_bytes"),
      rawContentHash: Sha256Schema,
    }).strict(),
    z.object({
      kind: z.literal("directory_membership"),
      membership: DirectoryMembershipIdentityV2Schema,
    }).strict(),
  ]).superRefine((value, context) => {
    if (
      !platformReleaseCandidateFitsCanonicalCapV2(
        value,
        PLATFORM_RELEASE_BOOTSTRAP_PHYSICAL_IDENTITY_MAX_CANONICAL_BYTES_V2,
      )
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Namespace physical content evidence exceeds its fixed canonical byte cap",
      });
    }
  });

export type NamespacePhysicalContentEvidenceV2 =
  z.infer<typeof NamespacePhysicalContentEvidenceV2Schema>;

function contentEvidenceIdentityHashV2(
  evidence: NamespacePhysicalContentEvidenceV2,
): string {
  return evidence.kind === "bounded_regular_file_bytes"
    ? evidence.rawContentHash
    : evidence.membership.membershipHash;
}

function expectedObjectKindForClassificationV2(
  classification:
    PlatformReleaseBootstrapNamespaceClassificationV2,
): StableFsObjectKindV2 {
  return (
    classification.category === "transaction_staging"
    || classification.category === "package_root"
    || classification.category === "generation_staging"
  )
    ? "directory"
    : "ordinary_file";
}

const NamespacePhysicalEntryCaptureV2IdentitySchema = z.object({
  schema: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_NAMESPACE_PHYSICAL_ENTRY_CAPTURE_V2_SCHEMA,
  ),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  classification:
    PlatformReleaseBootstrapNamespaceClassificationV2Schema,
  parentObjectIdentityHash: Sha256Schema,
  objectIdentity: StableFsObjectIdentityV2Schema,
  fingerprint: FsObservationFingerprintV2Schema,
  contentEvidence: NamespacePhysicalContentEvidenceV2Schema,
}).strict();

export type NamespacePhysicalEntryCaptureHashPayloadV2 =
  z.infer<typeof NamespacePhysicalEntryCaptureV2IdentitySchema>;

export function hashNamespacePhysicalEntryCaptureV2(
  value: NamespacePhysicalEntryCaptureHashPayloadV2,
): string {
  return hashCanonicalJson({
    schema:
      PLATFORM_RELEASE_BOOTSTRAP_NAMESPACE_PHYSICAL_ENTRY_CAPTURE_HASH_V2_DOMAIN,
    capture: {
      schema: value.schema,
      version: value.version,
      classification: value.classification,
      parentObjectIdentityHash: value.parentObjectIdentityHash,
      objectIdentity: value.objectIdentity,
      fingerprint: value.fingerprint,
      contentEvidence: value.contentEvidence,
    },
  });
}

export const NamespacePhysicalEntryCaptureV2Schema =
  NamespacePhysicalEntryCaptureV2IdentitySchema.extend({
    entryCaptureHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (
      !platformReleaseCandidateFitsCanonicalCapV2(
        value,
        PLATFORM_RELEASE_BOOTSTRAP_PHYSICAL_IDENTITY_MAX_CANONICAL_BYTES_V2,
      )
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Namespace physical entry capture exceeds its fixed canonical byte cap",
      });
    }
    const evidenceIdentityHash =
      contentEvidenceIdentityHashV2(value.contentEvidence);
    const expectedObjectKind =
      expectedObjectKindForClassificationV2(value.classification);
    const contentKindMatches =
      value.objectIdentity.objectKind === "ordinary_file"
        ? value.contentEvidence.kind
          === "bounded_regular_file_bytes"
        : value.contentEvidence.kind
          === "directory_membership";
    const {
      entryCaptureHash: _entryCaptureHash,
      ...identity
    } = value;
    if (
      value.fingerprint.objectIdentityHash
        !== value.objectIdentity.objectIdentityHash
      || value.parentObjectIdentityHash
        === value.objectIdentity.objectIdentityHash
      || value.objectIdentity.objectKind !== expectedObjectKind
      || !contentKindMatches
      || evidenceIdentityHash === value.objectIdentity.objectIdentityHash
      || evidenceIdentityHash === value.fingerprint.fingerprintHash
      || value.entryCaptureHash
        !== hashNamespacePhysicalEntryCaptureV2(identity)
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Namespace physical entry must join its exact classification, parent, stable object, occurrence fingerprint, and kind-specific content evidence",
      });
    }
  });

export type NamespacePhysicalEntryCaptureV2 =
  z.infer<typeof NamespacePhysicalEntryCaptureV2Schema>;

const NamespacePhysicalEntryCaptureBuilderInputV2Schema = z.object({
  classification:
    PlatformReleaseBootstrapNamespaceClassificationV2Schema,
  parentObjectIdentityHash: Sha256Schema,
  objectIdentity: StableFsObjectIdentityV2Schema,
  fingerprint: FsObservationFingerprintV2Schema,
  contentEvidence: NamespacePhysicalContentEvidenceV2Schema,
}).strict();

export type NamespacePhysicalEntryCaptureBuilderInputV2 =
  z.infer<typeof NamespacePhysicalEntryCaptureBuilderInputV2Schema>;

export function parseNamespacePhysicalEntryCaptureCandidateV2(
  input: unknown,
): NamespacePhysicalEntryCaptureV2 {
  const snapshot = boundedPhysicalJsonSnapshotV2(
    input,
    PLATFORM_RELEASE_BOOTSTRAP_PHYSICAL_IDENTITY_MAX_CANONICAL_BYTES_V2,
  );
  return deepFreezePlatformReleaseJsonV2(
    NamespacePhysicalEntryCaptureV2Schema.parse(snapshot),
  );
}

export function buildNamespacePhysicalEntryCaptureV2(
  input: NamespacePhysicalEntryCaptureBuilderInputV2,
): NamespacePhysicalEntryCaptureV2 {
  const parsedInput =
    NamespacePhysicalEntryCaptureBuilderInputV2Schema.parse(
      boundedPhysicalJsonSnapshotV2(
        input,
        PLATFORM_RELEASE_BOOTSTRAP_PHYSICAL_IDENTITY_MAX_CANONICAL_BYTES_V2,
      ),
    );
  const identity = {
    schema:
      PLATFORM_RELEASE_BOOTSTRAP_NAMESPACE_PHYSICAL_ENTRY_CAPTURE_V2_SCHEMA,
    version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
    ...parsedInput,
  } as const;
  return parseNamespacePhysicalEntryCaptureCandidateV2({
    ...identity,
    entryCaptureHash:
      hashNamespacePhysicalEntryCaptureV2(identity),
  });
}

const NamespacePhysicalCensusV2IdentitySchema = z.object({
  schema: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_NAMESPACE_PHYSICAL_CENSUS_V2_SCHEMA,
  ),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  filesystemScope: BootstrapFilesystemScopeIdentityV2Schema,
  filesystemScopeIdentityHash: Sha256Schema,
  logicalCensus: PlatformReleaseBootstrapNamespaceCensusV2Schema,
  parentObjectIdentity: StableFsObjectIdentityV2Schema,
  parentFingerprint: FsObservationFingerprintV2Schema,
  entryCount: NonnegativeSafeIntegerV2Schema.max(
    PLATFORM_RELEASE_BOOTSTRAP_NAMESPACE_CENSUS_MAX_ENTRIES_V2,
  ),
  orderedEntryCaptures: z.array(
    NamespacePhysicalEntryCaptureV2Schema,
  ).max(PLATFORM_RELEASE_BOOTSTRAP_NAMESPACE_CENSUS_MAX_ENTRIES_V2),
}).strict();

export type NamespacePhysicalCensusHashPayloadV2 =
  z.infer<typeof NamespacePhysicalCensusV2IdentitySchema>;

export function hashNamespacePhysicalCensusV2(
  value: NamespacePhysicalCensusHashPayloadV2,
): string {
  return hashCanonicalJson({
    schema:
      PLATFORM_RELEASE_BOOTSTRAP_NAMESPACE_PHYSICAL_CENSUS_HASH_V2_DOMAIN,
    census: {
      schema: value.schema,
      version: value.version,
      filesystemScope: value.filesystemScope,
      filesystemScopeIdentityHash:
        value.filesystemScopeIdentityHash,
      logicalCensus: value.logicalCensus,
      parentObjectIdentity: value.parentObjectIdentity,
      parentFingerprint: value.parentFingerprint,
      entryCount: value.entryCount,
      orderedEntryCaptures: value.orderedEntryCaptures,
    },
  });
}

export const NamespacePhysicalCensusV2Schema =
  NamespacePhysicalCensusV2IdentitySchema.extend({
    physicalCensusHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (
      !platformReleaseCandidateFitsCanonicalCapV2(
        value,
        PLATFORM_RELEASE_BOOTSTRAP_PHYSICAL_CENSUS_MAX_CANONICAL_BYTES_V2,
      )
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Namespace physical census exceeds its fixed canonical byte cap",
      });
    }
    const parentLocatorKey = filesystemObjectLocatorKeyV2(
      value.parentObjectIdentity,
    );
    const childLocatorKeys = new Set<string>();
    if (
      value.filesystemScopeIdentityHash
        !== value.filesystemScope.scopeIdentityHash
      || value.parentObjectIdentity.objectKind !== "directory"
      || value.parentObjectIdentity.filesystemScopeIdentityHash
        !== value.filesystemScopeIdentityHash
      || value.parentFingerprint.objectIdentityHash
        !== value.parentObjectIdentity.objectIdentityHash
      || value.entryCount !== value.logicalCensus.entryCount
      || value.entryCount !== value.orderedEntryCaptures.length
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Namespace physical census scope, parent, and exact logical/physical counts must join",
      });
    }
    for (
      let index = 0;
      index < value.orderedEntryCaptures.length;
      index += 1
    ) {
      const logical = value.logicalCensus.orderedEntries[index];
      const capture = value.orderedEntryCaptures[index]!;
      const childLocatorKey = filesystemObjectLocatorKeyV2(
        capture.objectIdentity,
      );
      if (
        !logical
        || capture.classification.classificationHash
          !== logical.classificationHash
        || canonicalJsonStringify(capture.classification)
          !== canonicalJsonStringify(logical)
        || capture.parentObjectIdentityHash
          !== value.parentObjectIdentity.objectIdentityHash
        || capture.objectIdentity.filesystemScopeIdentityHash
          !== value.filesystemScopeIdentityHash
        || childLocatorKey === parentLocatorKey
        || childLocatorKeys.has(childLocatorKey)
      ) {
        context.addIssue({
          code: "custom",
          path: ["orderedEntryCaptures", index],
          message:
            "Namespace physical captures must join the same ordered logical classification, parent, scope, and one unique direct-child object",
        });
      }
      childLocatorKeys.add(childLocatorKey);
    }
    const {
      physicalCensusHash: _physicalCensusHash,
      ...identity
    } = value;
    if (
      value.physicalCensusHash
        !== hashNamespacePhysicalCensusV2(identity)
    ) {
      context.addIssue({
        code: "custom",
        path: ["physicalCensusHash"],
        message: "Namespace physical census hash mismatch",
      });
    }
  });

export type NamespacePhysicalCensusV2 =
  z.infer<typeof NamespacePhysicalCensusV2Schema>;

const NamespacePhysicalCensusBuilderInputV2Schema = z.object({
  filesystemScope: BootstrapFilesystemScopeIdentityV2Schema,
  logicalCensus: PlatformReleaseBootstrapNamespaceCensusV2Schema,
  parentObjectIdentity: StableFsObjectIdentityV2Schema,
  parentFingerprint: FsObservationFingerprintV2Schema,
  orderedEntryCaptures: z.array(
    NamespacePhysicalEntryCaptureV2Schema,
  ).max(PLATFORM_RELEASE_BOOTSTRAP_NAMESPACE_CENSUS_MAX_ENTRIES_V2),
}).strict();

export type NamespacePhysicalCensusBuilderInputV2 =
  z.infer<typeof NamespacePhysicalCensusBuilderInputV2Schema>;

export function parseNamespacePhysicalCensusCandidateV2(
  input: unknown,
): NamespacePhysicalCensusV2 {
  const snapshot = boundedPhysicalJsonSnapshotV2(
    input,
    PLATFORM_RELEASE_BOOTSTRAP_PHYSICAL_CENSUS_MAX_CANONICAL_BYTES_V2,
  );
  return deepFreezePlatformReleaseJsonV2(
    NamespacePhysicalCensusV2Schema.parse(snapshot),
  );
}

export function buildNamespacePhysicalCensusV2(
  input: NamespacePhysicalCensusBuilderInputV2,
): NamespacePhysicalCensusV2 {
  const parsedInput =
    NamespacePhysicalCensusBuilderInputV2Schema.parse(
      boundedPhysicalJsonSnapshotV2(
        input,
        PLATFORM_RELEASE_BOOTSTRAP_PHYSICAL_CENSUS_MAX_CANONICAL_BYTES_V2,
      ),
    );
  const identity = {
    schema:
      PLATFORM_RELEASE_BOOTSTRAP_NAMESPACE_PHYSICAL_CENSUS_V2_SCHEMA,
    version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
    filesystemScope: parsedInput.filesystemScope,
    filesystemScopeIdentityHash:
      parsedInput.filesystemScope.scopeIdentityHash,
    logicalCensus: parsedInput.logicalCensus,
    parentObjectIdentity: parsedInput.parentObjectIdentity,
    parentFingerprint: parsedInput.parentFingerprint,
    entryCount: parsedInput.orderedEntryCaptures.length,
    orderedEntryCaptures: parsedInput.orderedEntryCaptures,
  } as const;
  return parseNamespacePhysicalCensusCandidateV2({
    ...identity,
    physicalCensusHash: hashNamespacePhysicalCensusV2(identity),
  });
}

const PackageLifecyclePhysicalProjectionV2IdentitySchema = z.object({
  schema: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_LIFECYCLE_PHYSICAL_PROJECTION_V2_SCHEMA,
  ),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  packageRef: PlatformReleaseBootstrapPackageRefV2Schema,
  sourceLogicalCensusHash: Sha256Schema,
  sourcePhysicalCensusHash: Sha256Schema,
  entryCount: PositiveSafeIntegerV2Schema.max(
    PLATFORM_RELEASE_BOOTSTRAP_NAMESPACE_CENSUS_MAX_ENTRIES_V2,
  ),
  orderedEntryCaptures: z.array(
    NamespacePhysicalEntryCaptureV2Schema,
  ).min(1).max(
    PLATFORM_RELEASE_BOOTSTRAP_NAMESPACE_CENSUS_MAX_ENTRIES_V2,
  ),
  packageLockObjectIdentityHash: Sha256Schema,
}).strict();

export type PackageLifecyclePhysicalProjectionHashPayloadV2 =
  z.infer<
    typeof PackageLifecyclePhysicalProjectionV2IdentitySchema
  >;

export function hashPackageLifecyclePhysicalProjectionV2(
  value: PackageLifecyclePhysicalProjectionHashPayloadV2,
): string {
  return hashCanonicalJson({
    schema:
      PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_LIFECYCLE_PHYSICAL_PROJECTION_HASH_V2_DOMAIN,
    projection: {
      schema: value.schema,
      version: value.version,
      packageRef: value.packageRef,
      sourceLogicalCensusHash: value.sourceLogicalCensusHash,
      sourcePhysicalCensusHash: value.sourcePhysicalCensusHash,
      entryCount: value.entryCount,
      orderedEntryCaptures: value.orderedEntryCaptures,
      packageLockObjectIdentityHash:
        value.packageLockObjectIdentityHash,
    },
  });
}

export const PackageLifecyclePhysicalProjectionV2Schema =
  PackageLifecyclePhysicalProjectionV2IdentitySchema.extend({
    projectionHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (
      !platformReleaseCandidateFitsCanonicalCapV2(
        value,
        PLATFORM_RELEASE_BOOTSTRAP_PHYSICAL_CENSUS_MAX_CANONICAL_BYTES_V2,
      )
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Package lifecycle physical projection exceeds its fixed canonical byte cap",
      });
    }
    const packageLocks = value.orderedEntryCaptures.filter((capture) =>
      capture.classification.ownerKind === "package"
      && capture.classification.ownerRef === value.packageRef
      && capture.classification.category === "package_lock");
    const everyCaptureMatchesPackage =
      value.orderedEntryCaptures.every((capture) =>
        capture.classification.ownerKind === "package"
        && capture.classification.ownerRef === value.packageRef);
    const ordered = value.orderedEntryCaptures.every(
      (capture, index) =>
        index === 0
        || value.orderedEntryCaptures[index - 1]!
          .classification.basename
          < capture.classification.basename,
    );
    const {
      projectionHash: _projectionHash,
      ...identity
    } = value;
    if (
      value.entryCount !== value.orderedEntryCaptures.length
      || !everyCaptureMatchesPackage
      || !ordered
      || packageLocks.length !== 1
      || value.packageLockObjectIdentityHash
        !== packageLocks[0]?.objectIdentity.objectIdentityHash
      || value.sourceLogicalCensusHash
        === value.sourcePhysicalCensusHash
      || value.projectionHash
        !== hashPackageLifecyclePhysicalProjectionV2(identity)
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Package lifecycle physical projection must be exact, ordered, source-bound, package-owned, and derive one package-lock object identity",
      });
    }
  });

export type PackageLifecyclePhysicalProjectionV2 =
  z.infer<typeof PackageLifecyclePhysicalProjectionV2Schema>;

function derivePackageLifecyclePhysicalProjectionV2(
  physicalCensus: NamespacePhysicalCensusV2,
  packageRef:
    z.infer<typeof PlatformReleaseBootstrapPackageRefV2Schema>,
): PackageLifecyclePhysicalProjectionV2 {
  const orderedEntryCaptures =
    physicalCensus.orderedEntryCaptures.filter((capture) =>
      capture.classification.ownerKind === "package"
      && capture.classification.ownerRef === packageRef);
  const packageLocks = orderedEntryCaptures.filter((capture) =>
    capture.classification.category === "package_lock");
  if (packageLocks.length !== 1) {
    throw new TypeError(
      "Package lifecycle physical projection requires exactly one package lock",
    );
  }
  const identity = {
    schema:
      PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_LIFECYCLE_PHYSICAL_PROJECTION_V2_SCHEMA,
    version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
    packageRef,
    sourceLogicalCensusHash:
      physicalCensus.logicalCensus.censusHash,
    sourcePhysicalCensusHash:
      physicalCensus.physicalCensusHash,
    entryCount: orderedEntryCaptures.length,
    orderedEntryCaptures,
    packageLockObjectIdentityHash:
      packageLocks[0]!.objectIdentity.objectIdentityHash,
  } as const;
  return deepFreezePlatformReleaseJsonV2(
    PackageLifecyclePhysicalProjectionV2Schema.parse({
      ...identity,
      projectionHash:
        hashPackageLifecyclePhysicalProjectionV2(identity),
    }),
  );
}

export function buildPackageLifecyclePhysicalProjectionV2(
  physicalCensus: NamespacePhysicalCensusV2,
  packageRef:
    z.infer<typeof PlatformReleaseBootstrapPackageRefV2Schema>,
): PackageLifecyclePhysicalProjectionV2 {
  const parsedPhysicalCensus =
    parseNamespacePhysicalCensusCandidateV2(physicalCensus);
  const parsedPackageRef =
    PlatformReleaseBootstrapPackageRefV2Schema.parse(
      boundedPhysicalJsonSnapshotV2(
        packageRef,
        PLATFORM_RELEASE_BOOTSTRAP_PHYSICAL_IDENTITY_MAX_CANONICAL_BYTES_V2,
      ),
    );
  return derivePackageLifecyclePhysicalProjectionV2(
    parsedPhysicalCensus,
    parsedPackageRef,
  );
}

export function parsePackageLifecyclePhysicalProjectionCandidateV2(
  input: unknown,
  sourcePhysicalCensus: NamespacePhysicalCensusV2,
): PackageLifecyclePhysicalProjectionV2 {
  const parsedSource =
    parseNamespacePhysicalCensusCandidateV2(
      sourcePhysicalCensus,
    );
  const snapshot = boundedPhysicalJsonSnapshotV2(
    input,
    PLATFORM_RELEASE_BOOTSTRAP_PHYSICAL_CENSUS_MAX_CANONICAL_BYTES_V2,
  );
  const parsed =
    PackageLifecyclePhysicalProjectionV2Schema.parse(snapshot);
  const expected = derivePackageLifecyclePhysicalProjectionV2(
    parsedSource,
    parsed.packageRef,
  );
  if (
    canonicalJsonStringify(parsed)
      !== canonicalJsonStringify(expected)
  ) {
    throw new TypeError(
      "Package lifecycle physical projection does not equal its source physical census projection",
    );
  }
  return deepFreezePlatformReleaseJsonV2(parsed);
}

export type {
  PlatformReleaseBootstrapNamespaceCensusV2,
};
