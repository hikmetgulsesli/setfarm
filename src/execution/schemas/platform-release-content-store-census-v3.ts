import { z } from "zod";

import {
  canonicalJsonStringify,
  hashCanonicalJson,
} from "../../product-compiler/canonical-json.js";
import { Sha256Schema } from "../../product-compiler/schemas/common-v1.js";
import {
  boundedPlatformReleaseJsonSnapshotV2,
  deepFreezePlatformReleaseJsonV2,
  platformReleaseCandidateFitsCanonicalCapV2,
} from "./platform-release-common-v2.js";

export const PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_V3_SCHEMA =
  "setfarm.platform-release-content-store-global-census.v3" as const;
export const PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_HASH_V3_SCHEMA =
  "setfarm.platform-release-content-store-global-census-hash.v3" as const;
export const PLATFORM_RELEASE_CONTENT_STORE_OBSERVATION_HASH_V3_SCHEMA =
  "setfarm.platform-release-content-store-observation-hash.v3" as const;
export const PLATFORM_RELEASE_CONTENT_STORE_DIRECTORY_MEMBERSHIP_HASH_V3_SCHEMA =
  "setfarm.platform-release-content-store-directory-membership-hash.v3" as const;
export const PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_V3_VERSION =
  "3.0.0" as const;
export const PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_MAX_RELEASES_V3 = 64;
export const PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_MAX_ATTESTATIONS_V3 =
  256;
export const PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_MAX_FILE_BYTES_V3 =
  8 * 1024 * 1024;
export const PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_MAX_TOTAL_CONTENT_BYTES_V3 =
  64 * 1024 * 1024;
export const PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_MAX_CANONICAL_BYTES_V3 =
  12 * 1024 * 1024;

const CanonicalDecimalV3Schema = z.string()
  .min(1)
  .max(80)
  .regex(/^(?:0|[1-9][0-9]*)$/u, "Expected one canonical unsigned decimal");
const CanonicalModeV3Schema = z.string()
  .regex(/^[0-7]{4}$/u, "Expected one canonical four-digit octal mode");
const OwnerIdV3Schema = z.number().int().nonnegative().safe()
  .max(4_294_967_294);

export const PlatformReleaseContentStoreDirectoryMembershipRoleV3Schema = z.enum([
  "store_root",
  "locks_root",
  "staging_root",
  "releases_root",
  "attestations_root",
  "release_root",
]);

const PlatformReleaseContentStoreDirectoryEntryNamesV3Schema = z.array(
  z.string().min(1).max(80).regex(
    /^(?:\.[a-z]+|[a-z]+(?:\.json)?|[a-f0-9]{64}(?:\.json)?)$/u,
    "Expected one canonical content-store directory entry name",
  ),
).max(PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_MAX_ATTESTATIONS_V3)
  .superRefine((entries, context) => {
    for (let index = 1; index < entries.length; index += 1) {
      if (entries[index - 1]! >= entries[index]!) {
        context.addIssue({
          code: "custom",
          path: [index],
          message: "Content-store directory entry names must be unique and strictly ordered",
        });
        break;
      }
    }
  });

const PlatformReleaseContentStoreDirectoryMembershipIdentityV3Schema = z.object({
  role: PlatformReleaseContentStoreDirectoryMembershipRoleV3Schema,
  entryNames: PlatformReleaseContentStoreDirectoryEntryNamesV3Schema,
}).strict();

export type PlatformReleaseContentStoreDirectoryMembershipIdentityV3 = z.infer<
  typeof PlatformReleaseContentStoreDirectoryMembershipIdentityV3Schema
>;

export type PlatformReleaseContentStoreDirectoryMembershipFingerprintV3 =
  Readonly<{
    contentHash: string;
    byteLength: number;
  }>;

export function hashPlatformReleaseContentStoreDirectoryMembershipV3(
  value: PlatformReleaseContentStoreDirectoryMembershipIdentityV3,
): string {
  return hashCanonicalJson({
    schema: PLATFORM_RELEASE_CONTENT_STORE_DIRECTORY_MEMBERSHIP_HASH_V3_SCHEMA,
    membership: value,
  });
}

function directoryMembershipFingerprintUncheckedV3(
  role: PlatformReleaseContentStoreDirectoryMembershipIdentityV3["role"],
  entryNames: readonly string[],
): PlatformReleaseContentStoreDirectoryMembershipFingerprintV3 {
  const identity = { role, entryNames: [...entryNames] };
  return Object.freeze({
    contentHash: hashPlatformReleaseContentStoreDirectoryMembershipV3(identity),
    byteLength: Buffer.byteLength(canonicalJsonStringify(identity.entryNames)),
  });
}

export function buildPlatformReleaseContentStoreDirectoryMembershipFingerprintV3(
  role: PlatformReleaseContentStoreDirectoryMembershipIdentityV3["role"],
  entryNames: readonly string[],
): PlatformReleaseContentStoreDirectoryMembershipFingerprintV3 {
  const identity = PlatformReleaseContentStoreDirectoryMembershipIdentityV3Schema.parse(
    boundedPlatformReleaseJsonSnapshotV2(
      { role, entryNames },
      PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_MAX_CANONICAL_BYTES_V3,
    ),
  );
  return directoryMembershipFingerprintUncheckedV3(
    identity.role,
    identity.entryNames,
  );
}

export const PlatformReleaseContentStoreStableIdentityV3Schema = z.object({
  hostIdentityHash: Sha256Schema,
  objectKind: z.enum(["directory", "ordinary_file"]),
  device: CanonicalDecimalV3Schema,
  inode: CanonicalDecimalV3Schema,
}).strict();

export type PlatformReleaseContentStoreStableIdentityV3 = z.infer<
  typeof PlatformReleaseContentStoreStableIdentityV3Schema
>;

export const PlatformReleaseContentStoreMutableFingerprintV3Schema = z.object({
  ownerUid: OwnerIdV3Schema,
  ownerGid: OwnerIdV3Schema,
  mode: CanonicalModeV3Schema,
  linkCount: z.number().int().positive().safe(),
  byteLength: z.number().int().nonnegative().safe()
    .max(PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_MAX_TOTAL_CONTENT_BYTES_V3),
  contentHash: Sha256Schema,
  modifiedTimeNanoseconds: CanonicalDecimalV3Schema,
  changedTimeNanoseconds: CanonicalDecimalV3Schema,
}).strict();

export type PlatformReleaseContentStoreMutableFingerprintV3 = z.infer<
  typeof PlatformReleaseContentStoreMutableFingerprintV3Schema
>;

const ObservationIdentityV3Schema = z.object({
  stableIdentity: PlatformReleaseContentStoreStableIdentityV3Schema,
  mutableFingerprint: PlatformReleaseContentStoreMutableFingerprintV3Schema,
}).strict();

export type PlatformReleaseContentStoreObservationHashPayloadV3 = z.infer<
  typeof ObservationIdentityV3Schema
>;

export function hashPlatformReleaseContentStoreObservationV3(
  value: PlatformReleaseContentStoreObservationHashPayloadV3,
): string {
  return hashCanonicalJson({
    schema: PLATFORM_RELEASE_CONTENT_STORE_OBSERVATION_HASH_V3_SCHEMA,
    observation: value,
  });
}

export const PlatformReleaseContentStoreObservationV3Schema =
  ObservationIdentityV3Schema.extend({
    observationHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const { observationHash: _observationHash, ...identity } = value;
    if (value.observationHash !== hashPlatformReleaseContentStoreObservationV3(identity)) {
      context.addIssue({
        code: "custom",
        path: ["observationHash"],
        message: "Content-store observation hash mismatch",
      });
    }
  });

export type PlatformReleaseContentStoreObservationV3 = z.infer<
  typeof PlatformReleaseContentStoreObservationV3Schema
>;

export function buildPlatformReleaseContentStoreObservationV3(
  input: PlatformReleaseContentStoreObservationHashPayloadV3,
): PlatformReleaseContentStoreObservationV3 {
  const identity = ObservationIdentityV3Schema.parse(
    boundedPlatformReleaseJsonSnapshotV2(
      input,
      PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_MAX_CANONICAL_BYTES_V3,
    ),
  );
  return deepFreezePlatformReleaseJsonV2(
    PlatformReleaseContentStoreObservationV3Schema.parse({
      ...identity,
      observationHash: hashPlatformReleaseContentStoreObservationV3(identity),
    }),
  );
}

export const PlatformReleaseContentStorePersistentAnchorsV3Schema = z.object({
  storeRoot: PlatformReleaseContentStoreObservationV3Schema,
  locksRoot: PlatformReleaseContentStoreObservationV3Schema,
  stagingRoot: PlatformReleaseContentStoreObservationV3Schema,
  releasesRoot: PlatformReleaseContentStoreObservationV3Schema,
  attestationsRoot: PlatformReleaseContentStoreObservationV3Schema,
}).strict();

export type PlatformReleaseContentStorePersistentAnchorsV3 = z.infer<
  typeof PlatformReleaseContentStorePersistentAnchorsV3Schema
>;

export const PlatformReleaseContentStoreReleaseCensusEntryV3Schema = z.object({
  manifestPayloadHash: Sha256Schema,
  releaseRoot: PlatformReleaseContentStoreObservationV3Schema,
  manifest: PlatformReleaseContentStoreObservationV3Schema,
}).strict();

export type PlatformReleaseContentStoreReleaseCensusEntryV3 = z.infer<
  typeof PlatformReleaseContentStoreReleaseCensusEntryV3Schema
>;

export const PlatformReleaseContentStoreAttestationCensusEntryV3Schema =
  z.object({
    attestationHash: Sha256Schema,
    releaseContentHash: Sha256Schema,
    attestation: PlatformReleaseContentStoreObservationV3Schema,
  }).strict();

export type PlatformReleaseContentStoreAttestationCensusEntryV3 = z.infer<
  typeof PlatformReleaseContentStoreAttestationCensusEntryV3Schema
>;

const PlatformReleaseContentStoreGlobalCensusIdentityFieldsV3Schema = z.object({
  schema: z.literal(PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_V3_SCHEMA),
  version: z.literal(PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_V3_VERSION),
  admissionScope: z.literal("test_fixture"),
  productionAuthority: z.literal(false),
  hostIdentityHash: Sha256Schema,
  persistentAnchors: PlatformReleaseContentStorePersistentAnchorsV3Schema,
  releaseEntries: z.array(PlatformReleaseContentStoreReleaseCensusEntryV3Schema)
    .max(PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_MAX_RELEASES_V3),
  attestationEntries:
    z.array(PlatformReleaseContentStoreAttestationCensusEntryV3Schema)
      .max(PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_MAX_ATTESTATIONS_V3),
  releaseCount: z.number().int().nonnegative().safe()
    .max(PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_MAX_RELEASES_V3),
  attestationCount: z.number().int().nonnegative().safe()
    .max(PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_MAX_ATTESTATIONS_V3),
  totalContentBytes: z.number().int().nonnegative().safe()
    .max(PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_MAX_TOTAL_CONTENT_BYTES_V3),
}).strict();

function validateDirectoryMembershipObservationV3(
  observation: PlatformReleaseContentStoreObservationV3,
  role: PlatformReleaseContentStoreDirectoryMembershipIdentityV3["role"],
  entryNames: readonly string[],
  context: z.RefinementCtx,
  path: readonly (string | number)[],
): void {
  const expected = directoryMembershipFingerprintUncheckedV3(
    role,
    [...entryNames].sort(),
  );
  if (
    observation.mutableFingerprint.contentHash !== expected.contentHash
    || observation.mutableFingerprint.byteLength !== expected.byteLength
  ) {
    context.addIssue({
      code: "custom",
      path: [...path, "mutableFingerprint"],
      message: "Directory observation must bind its exact canonical membership",
    });
  }
}

function validatePlatformReleaseContentStoreGlobalCensusIdentityV3(
  value: z.infer<
    typeof PlatformReleaseContentStoreGlobalCensusIdentityFieldsV3Schema
  >,
  context: z.RefinementCtx,
): void {
  if (
    value.releaseCount !== value.releaseEntries.length
    || value.attestationCount !== value.attestationEntries.length
  ) {
    context.addIssue({
      code: "custom",
      path: ["releaseCount"],
      message: "Content-store census counts must equal their exact entry arrays",
    });
  }

  for (let index = 1; index < value.releaseEntries.length; index += 1) {
    if (
      value.releaseEntries[index - 1]!.manifestPayloadHash
      >= value.releaseEntries[index]!.manifestPayloadHash
    ) {
      context.addIssue({
        code: "custom",
        path: ["releaseEntries", index, "manifestPayloadHash"],
        message: "Release census entries must be unique and strictly hash ordered",
      });
      break;
    }
  }
  for (let index = 1; index < value.attestationEntries.length; index += 1) {
    if (
      value.attestationEntries[index - 1]!.attestationHash
      >= value.attestationEntries[index]!.attestationHash
    ) {
      context.addIssue({
        code: "custom",
        path: ["attestationEntries", index, "attestationHash"],
        message: "Attestation census entries must be unique and strictly hash ordered",
      });
      break;
    }
  }

  const releaseHashes = new Set(
    value.releaseEntries.map((entry) => entry.manifestPayloadHash),
  );
  const attestedReleaseHashes = new Set<string>();
  for (const [index, entry] of value.attestationEntries.entries()) {
    if (!releaseHashes.has(entry.releaseContentHash)) {
      context.addIssue({
        code: "custom",
        path: ["attestationEntries", index, "releaseContentHash"],
        message: "Every attestation must join one release in the same global census",
      });
    } else {
      attestedReleaseHashes.add(entry.releaseContentHash);
    }
  }
  for (const [index, entry] of value.releaseEntries.entries()) {
    if (!attestedReleaseHashes.has(entry.manifestPayloadHash)) {
      context.addIssue({
        code: "custom",
        path: ["releaseEntries", index, "manifestPayloadHash"],
        message: "Every durable release census entry must have at least one attestation occurrence",
      });
    }
  }

  const anchorEntries = Object.entries(value.persistentAnchors) as readonly (
    readonly [keyof typeof value.persistentAnchors, PlatformReleaseContentStoreObservationV3]
  )[];
  const allObservations: PlatformReleaseContentStoreObservationV3[] = [
    ...anchorEntries.map(([, observation]) => observation),
    ...value.releaseEntries.flatMap((entry) => [entry.releaseRoot, entry.manifest]),
    ...value.attestationEntries.map((entry) => entry.attestation),
  ];
  const anchorDirectoryModes: Readonly<Record<keyof typeof value.persistentAnchors, string>> = {
    storeRoot: "0700",
    locksRoot: "0700",
    stagingRoot: "0700",
    releasesRoot: "0700",
    attestationsRoot: "0700",
  };
  for (const [name, observation] of anchorEntries) {
    if (
      observation.stableIdentity.objectKind !== "directory"
      || observation.mutableFingerprint.mode !== anchorDirectoryModes[name]
    ) {
      context.addIssue({
        code: "custom",
        path: ["persistentAnchors", name],
        message: "Persistent content-store anchors must be private mode-0700 directories",
      });
    }
  }
  validateDirectoryMembershipObservationV3(
    value.persistentAnchors.storeRoot,
    "store_root",
    [".locks", ".staging", "attestations", "releases"],
    context,
    ["persistentAnchors", "storeRoot"],
  );
  validateDirectoryMembershipObservationV3(
    value.persistentAnchors.locksRoot,
    "locks_root",
    [],
    context,
    ["persistentAnchors", "locksRoot"],
  );
  validateDirectoryMembershipObservationV3(
    value.persistentAnchors.stagingRoot,
    "staging_root",
    [],
    context,
    ["persistentAnchors", "stagingRoot"],
  );
  validateDirectoryMembershipObservationV3(
    value.persistentAnchors.releasesRoot,
    "releases_root",
    value.releaseEntries.map((entry) => entry.manifestPayloadHash),
    context,
    ["persistentAnchors", "releasesRoot"],
  );
  validateDirectoryMembershipObservationV3(
    value.persistentAnchors.attestationsRoot,
    "attestations_root",
    value.attestationEntries.map((entry) => `${entry.attestationHash}.json`),
    context,
    ["persistentAnchors", "attestationsRoot"],
  );
  for (const [index, entry] of value.releaseEntries.entries()) {
    if (
      entry.releaseRoot.stableIdentity.objectKind !== "directory"
      || entry.releaseRoot.mutableFingerprint.mode !== "0555"
      || entry.manifest.stableIdentity.objectKind !== "ordinary_file"
      || entry.manifest.mutableFingerprint.mode !== "0444"
      || entry.manifest.mutableFingerprint.linkCount !== 1
      || entry.manifest.mutableFingerprint.byteLength < 1
      || entry.manifest.mutableFingerprint.byteLength
        > PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_MAX_FILE_BYTES_V3
    ) {
      context.addIssue({
        code: "custom",
        path: ["releaseEntries", index],
        message: "Release entries must contain one sealed root and one bounded single-link manifest",
      });
    }
    validateDirectoryMembershipObservationV3(
      entry.releaseRoot,
      "release_root",
      ["manifest.json"],
      context,
      ["releaseEntries", index, "releaseRoot"],
    );
  }
  for (const [index, entry] of value.attestationEntries.entries()) {
    if (
      entry.attestation.stableIdentity.objectKind !== "ordinary_file"
      || entry.attestation.mutableFingerprint.mode !== "0444"
      || entry.attestation.mutableFingerprint.linkCount !== 1
      || entry.attestation.mutableFingerprint.byteLength < 1
      || entry.attestation.mutableFingerprint.byteLength
        > PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_MAX_FILE_BYTES_V3
    ) {
      context.addIssue({
        code: "custom",
        path: ["attestationEntries", index],
        message: "Attestation entries must be bounded single-link read-only files",
      });
    }
  }

  const expectedTotalContentBytes = [
    ...value.releaseEntries.map((entry) => entry.manifest),
    ...value.attestationEntries.map((entry) => entry.attestation),
  ].reduce(
    (sum, observation) => sum + observation.mutableFingerprint.byteLength,
    0,
  );
  if (value.totalContentBytes !== expectedTotalContentBytes) {
    context.addIssue({
      code: "custom",
      path: ["totalContentBytes"],
      message: "Content-store total bytes must equal every manifest and attestation byte length",
    });
  }

  const hostHashes = new Set(
    allObservations.map((observation) => observation.stableIdentity.hostIdentityHash),
  );
  const devices = new Set(
    allObservations.map((observation) => observation.stableIdentity.device),
  );
  if (hostHashes.size !== 1 || !hostHashes.has(value.hostIdentityHash)) {
    context.addIssue({
      code: "custom",
      path: ["hostIdentityHash"],
      message: "Every global census observation must join its one declared host",
    });
  }
  if (devices.size !== 1) {
    context.addIssue({
      code: "custom",
      path: ["persistentAnchors"],
      message: "Every global census observation must join one filesystem device",
    });
  }

  const owner = value.persistentAnchors.storeRoot.mutableFingerprint;
  if (
    allObservations.some((observation) =>
      observation.mutableFingerprint.ownerUid !== owner.ownerUid
      || observation.mutableFingerprint.ownerGid !== owner.ownerGid)
  ) {
    context.addIssue({
      code: "custom",
      path: ["persistentAnchors", "storeRoot", "mutableFingerprint"],
      message: "Every global census observation must retain the store owner",
    });
  }

  const physicalKeys = new Set<string>();
  for (const observation of allObservations) {
    const stable = observation.stableIdentity;
    physicalKeys.add([
      stable.hostIdentityHash,
      stable.objectKind,
      stable.device,
      stable.inode,
    ].join(":"));
  }
  if (physicalKeys.size !== allObservations.length) {
    context.addIssue({
      code: "custom",
      path: ["releaseEntries"],
      message: "Every persistent anchor and content leaf must be one physically distinct object",
    });
  }
}

export const PlatformReleaseContentStoreGlobalCensusIdentityV3Schema =
  PlatformReleaseContentStoreGlobalCensusIdentityFieldsV3Schema.superRefine(
    validatePlatformReleaseContentStoreGlobalCensusIdentityV3,
  );

export type PlatformReleaseContentStoreGlobalCensusHashPayloadV3 = z.infer<
  typeof PlatformReleaseContentStoreGlobalCensusIdentityV3Schema
>;

export function hashPlatformReleaseContentStoreGlobalCensusV3(
  value: PlatformReleaseContentStoreGlobalCensusHashPayloadV3,
): string {
  const identity = { ...value } as Record<string, unknown>;
  delete identity.censusHash;
  return hashCanonicalJson({
    schema: PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_HASH_V3_SCHEMA,
    census: identity,
  });
}

export const PlatformReleaseContentStoreGlobalCensusV3Schema =
  PlatformReleaseContentStoreGlobalCensusIdentityFieldsV3Schema.extend({
    censusHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    validatePlatformReleaseContentStoreGlobalCensusIdentityV3(value, context);
    const { censusHash: _censusHash, ...identity } = value;
    if (value.censusHash !== hashPlatformReleaseContentStoreGlobalCensusV3(identity)) {
      context.addIssue({
        code: "custom",
        path: ["censusHash"],
        message: "Global content-store census hash mismatch",
      });
    }
    if (
      !platformReleaseCandidateFitsCanonicalCapV2(
        value,
        PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_MAX_CANONICAL_BYTES_V3,
      )
    ) {
      context.addIssue({
        code: "custom",
        message: "Global content-store census exceeds its canonical byte cap",
      });
    }
  });

export type PlatformReleaseContentStoreGlobalCensusV3 = z.infer<
  typeof PlatformReleaseContentStoreGlobalCensusV3Schema
>;

export type PlatformReleaseContentStoreGlobalCensusBuildInputV3 = Readonly<{
  hostIdentityHash: string;
  persistentAnchors: PlatformReleaseContentStorePersistentAnchorsV3;
  releaseEntries: readonly PlatformReleaseContentStoreReleaseCensusEntryV3[];
  attestationEntries: readonly PlatformReleaseContentStoreAttestationCensusEntryV3[];
}>;

export function buildPlatformReleaseContentStoreGlobalCensusV3(
  input: PlatformReleaseContentStoreGlobalCensusBuildInputV3,
): PlatformReleaseContentStoreGlobalCensusV3 {
  const snapshot = boundedPlatformReleaseJsonSnapshotV2(
    input,
    PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_MAX_CANONICAL_BYTES_V3,
  ) as PlatformReleaseContentStoreGlobalCensusBuildInputV3;
  const totalContentBytes = [
    ...snapshot.releaseEntries.map((entry) => entry.manifest),
    ...snapshot.attestationEntries.map((entry) => entry.attestation),
  ].reduce(
    (sum, observation) => sum + observation.mutableFingerprint.byteLength,
    0,
  );
  const identity = PlatformReleaseContentStoreGlobalCensusIdentityV3Schema.parse({
    schema: PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_V3_SCHEMA,
    version: PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_V3_VERSION,
    admissionScope: "test_fixture",
    productionAuthority: false,
    hostIdentityHash: snapshot.hostIdentityHash,
    persistentAnchors: snapshot.persistentAnchors,
    releaseEntries: snapshot.releaseEntries,
    attestationEntries: snapshot.attestationEntries,
    releaseCount: snapshot.releaseEntries.length,
    attestationCount: snapshot.attestationEntries.length,
    totalContentBytes,
  });
  return deepFreezePlatformReleaseJsonV2(
    PlatformReleaseContentStoreGlobalCensusV3Schema.parse({
      ...identity,
      censusHash: hashPlatformReleaseContentStoreGlobalCensusV3(identity),
    }),
  );
}

export function parsePlatformReleaseContentStoreGlobalCensusCandidateV3(
  input: unknown,
): PlatformReleaseContentStoreGlobalCensusV3 {
  const snapshot = boundedPlatformReleaseJsonSnapshotV2(
    input,
    PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_MAX_CANONICAL_BYTES_V3,
  );
  return deepFreezePlatformReleaseJsonV2(
    PlatformReleaseContentStoreGlobalCensusV3Schema.parse(snapshot),
  );
}

function persistentAnchorAppendIdentityV3(
  observation: PlatformReleaseContentStoreObservationV3,
): Readonly<Record<string, unknown>> {
  return {
    stableIdentity: observation.stableIdentity,
    ownerUid: observation.mutableFingerprint.ownerUid,
    ownerGid: observation.mutableFingerprint.ownerGid,
    mode: observation.mutableFingerprint.mode,
  };
}

export function assertPlatformReleaseContentStoreAppendOnlySupersetV3(
  baseline: PlatformReleaseContentStoreGlobalCensusV3,
  current: PlatformReleaseContentStoreGlobalCensusV3,
): PlatformReleaseContentStoreGlobalCensusV3 {
  const admittedBaseline = parsePlatformReleaseContentStoreGlobalCensusCandidateV3(
    baseline,
  );
  const admittedCurrent = parsePlatformReleaseContentStoreGlobalCensusCandidateV3(
    current,
  );
  for (const name of Object.keys(admittedBaseline.persistentAnchors) as readonly (
    keyof PlatformReleaseContentStorePersistentAnchorsV3
  )[]) {
    if (
      canonicalJsonStringify(
        persistentAnchorAppendIdentityV3(admittedBaseline.persistentAnchors[name]),
      ) !== canonicalJsonStringify(
        persistentAnchorAppendIdentityV3(admittedCurrent.persistentAnchors[name]),
      )
    ) {
      throw new TypeError(
        `CONTENT_STORE_APPEND_ONLY_VIOLATION: persistent anchor ${name} changed`,
      );
    }
  }

  const currentReleases = new Map(
    admittedCurrent.releaseEntries.map((entry) => [entry.manifestPayloadHash, entry]),
  );
  const currentAttestations = new Map(
    admittedCurrent.attestationEntries.map((entry) => [entry.attestationHash, entry]),
  );
  for (const entry of admittedBaseline.releaseEntries) {
    const reproduced = currentReleases.get(entry.manifestPayloadHash);
    if (
      reproduced === undefined
      || canonicalJsonStringify(reproduced) !== canonicalJsonStringify(entry)
    ) {
      throw new TypeError(
        `CONTENT_STORE_APPEND_ONLY_VIOLATION: release ${entry.manifestPayloadHash} was removed or changed`,
      );
    }
  }
  for (const entry of admittedBaseline.attestationEntries) {
    const reproduced = currentAttestations.get(entry.attestationHash);
    if (
      reproduced === undefined
      || canonicalJsonStringify(reproduced) !== canonicalJsonStringify(entry)
    ) {
      throw new TypeError(
        `CONTENT_STORE_APPEND_ONLY_VIOLATION: attestation ${entry.attestationHash} was removed or changed`,
      );
    }
  }
  return admittedCurrent;
}
