import { createHash } from "node:crypto";
import { isProxy } from "node:util/types";

import { z } from "zod";

import {
  PLATFORM_RELEASE_BOOTSTRAP_COOPERATIVE_CAPTURE_CAPABILITY_V2,
} from "./platform-release-bootstrap-filesystem-capture-core-v2.js";
import {
  BootstrapFilesystemScopeIdentityV2Schema,
  FsObservationFingerprintV2Schema,
  StableFsObjectIdentityV2Schema,
} from "./platform-release-bootstrap-physical-census-v2.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PACKAGE_PHYSICAL_SNAPSHOT_TEST_V2_MAX_CANONICAL_BYTES,
  parsePlatformReleaseBootstrapRegistryPackagePhysicalSnapshotTestCandidateV2,
  type PlatformReleaseBootstrapRegistryPackagePhysicalSnapshotTestV2,
} from "./platform-release-bootstrap-registry-package-physical-snapshot-test-support-v2.js";
import {
  PLATFORM_RELEASE_COMPONENT_VERSION_V2,
  boundedPlatformReleaseJsonSnapshotV2,
  deepFreezePlatformReleaseJsonV2,
  platformReleaseCandidateFitsCanonicalCapV2,
} from "../execution/schemas/platform-release-common-v2.js";
import { Sha256Schema } from "./schemas/common-v1.js";
import { canonicalJsonStringify, hashCanonicalJson } from "./canonical-json.js";

/**
 * This module is deliberately a test-support boundary. It re-joins a
 * serialized package census with one separately published cooperative scope
 * observation, but it does not open a file, acquire a lock, mutate a registry,
 * or mint a capability. The cooperative publication is evidence only.
 */
export const PLATFORM_RELEASE_BOOTSTRAP_FILESYSTEM_SCOPE_REJOIN_TEST_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-filesystem-scope-rejoin-test.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_FILESYSTEM_SCOPE_REJOIN_TEST_V2_HASH_SCHEMA =
  "setfarm.platform-release-bootstrap-filesystem-scope-rejoin-test-hash.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_FILESYSTEM_SCOPE_PUBLICATION_EVIDENCE_TEST_V2_HASH_SCHEMA =
  "setfarm.platform-release-bootstrap-filesystem-scope-publication-evidence-test-hash.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_FILESYSTEM_SCOPE_REJOIN_TEST_V2_MAX_CANONICAL_BYTES =
  PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PACKAGE_PHYSICAL_SNAPSHOT_TEST_V2_MAX_CANONICAL_BYTES;

const ScopePublicationEvidenceIdentityV2Schema = z.object({
  capability: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_COOPERATIVE_CAPTURE_CAPABILITY_V2,
  ),
  filesystemScope: BootstrapFilesystemScopeIdentityV2Schema,
  objectIdentity: StableFsObjectIdentityV2Schema,
  fingerprint: FsObservationFingerprintV2Schema,
  rawContentHash: Sha256Schema,
}).strict();

export type PlatformReleaseBootstrapFilesystemScopePublicationEvidenceTestV2 =
  z.infer<typeof ScopePublicationEvidenceIdentityV2Schema>;

const ScopeRejoinIdentityV2Schema = z.object({
  schema: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_FILESYSTEM_SCOPE_REJOIN_TEST_V2_SCHEMA,
  ),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  admissionScope: z.literal("test_fixture"),
  authorityState: z.literal("cooperative_scope_test_fixture_unverified"),
  productionAuthority: z.literal(false),
  productionAdmission: z.literal("forbidden"),
  credentialUse: z.literal("none"),
  signingAuthority: z.literal("unsigned_test_fixture"),
  mutationAuthority: z.literal(false),
  trustConclusion: z.literal("characterization_only"),
  snapshotHash: Sha256Schema,
  filesystemScopeIdentityHash: Sha256Schema,
  publicationObservationHash: Sha256Schema,
}).strict();

export type PlatformReleaseBootstrapFilesystemScopeRejoinTestIdentityV2 =
  z.infer<typeof ScopeRejoinIdentityV2Schema>;

export function hashPlatformReleaseBootstrapFilesystemScopePublicationEvidenceTestV2(
  value: PlatformReleaseBootstrapFilesystemScopePublicationEvidenceTestV2,
): string {
  return hashCanonicalJson({
    schema:
      PLATFORM_RELEASE_BOOTSTRAP_FILESYSTEM_SCOPE_PUBLICATION_EVIDENCE_TEST_V2_HASH_SCHEMA,
    evidence: value,
  });
}

export function hashPlatformReleaseBootstrapFilesystemScopeRejoinTestV2(
  value: PlatformReleaseBootstrapFilesystemScopeRejoinTestIdentityV2,
): string {
  return hashCanonicalJson({
    schema: PLATFORM_RELEASE_BOOTSTRAP_FILESYSTEM_SCOPE_REJOIN_TEST_V2_HASH_SCHEMA,
    relation: value,
  });
}

export const PlatformReleaseBootstrapFilesystemScopeRejoinTestV2Schema =
  ScopeRejoinIdentityV2Schema.extend({
    observationHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (
      !platformReleaseCandidateFitsCanonicalCapV2(
        value,
        PLATFORM_RELEASE_BOOTSTRAP_FILESYSTEM_SCOPE_REJOIN_TEST_V2_MAX_CANONICAL_BYTES,
      )
    ) {
      context.addIssue({
        code: "custom",
        message: "Filesystem scope rejoin relation exceeds its fixed byte cap",
      });
    }
    const { observationHash: _observationHash, ...identity } = value;
    if (
      value.observationHash
        !== hashPlatformReleaseBootstrapFilesystemScopeRejoinTestV2(identity)
    ) {
      context.addIssue({
        code: "custom",
        path: ["observationHash"],
        message: "Filesystem scope rejoin observation hash mismatch",
      });
    }
  });

export type PlatformReleaseBootstrapFilesystemScopeRejoinTestV2 = z.infer<
  typeof PlatformReleaseBootstrapFilesystemScopeRejoinTestV2Schema
>;

export type PlatformReleaseBootstrapFilesystemScopeRejoinTestInputV2 = Readonly<{
  packageSnapshot: unknown;
  scopePublicationEvidence: unknown;
}>;

export type PlatformReleaseBootstrapFilesystemScopeRejoinTestErrorCodeV2 =
  | "FILESYSTEM_SCOPE_REJOIN_INPUT_INVALID"
  | "FILESYSTEM_SCOPE_REJOIN_SNAPSHOT_INVALID"
  | "FILESYSTEM_SCOPE_REJOIN_SCOPE_PUBLICATION_INVALID"
  | "FILESYSTEM_SCOPE_REJOIN_SERIALIZATION_INVALID";

export class PlatformReleaseBootstrapFilesystemScopeRejoinTestErrorV2
  extends TypeError {
  constructor(
    readonly code: PlatformReleaseBootstrapFilesystemScopeRejoinTestErrorCodeV2,
    message: string,
    options: ErrorOptions = {},
  ) {
    super(message.slice(0, 1_500), options);
    this.name = "PlatformReleaseBootstrapFilesystemScopeRejoinTestErrorV2";
  }
}

function failV2(
  code: PlatformReleaseBootstrapFilesystemScopeRejoinTestErrorCodeV2,
  message: string,
  cause?: unknown,
): never {
  throw new PlatformReleaseBootstrapFilesystemScopeRejoinTestErrorV2(
    code,
    message,
    cause === undefined ? {} : { cause },
  );
}

function assertNoProxyV2(value: unknown, label: string): void {
  if (typeof value === "object" && value !== null && isProxy(value)) {
    failV2(
      "FILESYSTEM_SCOPE_REJOIN_INPUT_INVALID",
      `${label} must not be a proxy`,
    );
  }
}

function isPlainRecordV2(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object"
    && value !== null
    && !Array.isArray(value)
    && !isProxy(value)
    && Object.getPrototypeOf(value) === Object.prototype
  );
}

function sha256Utf8V2(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function validateScopePublicationEvidenceV2(
  value: PlatformReleaseBootstrapFilesystemScopePublicationEvidenceTestV2,
): void {
  const scopeHash = value.filesystemScope.scopeIdentityHash;
  const canonicalScopeText = canonicalJsonStringify(value.filesystemScope);
  if (
    value.objectIdentity.objectKind !== "ordinary_file"
    || value.objectIdentity.filesystemScopeIdentityHash !== scopeHash
    || value.fingerprint.objectIdentityHash
      !== value.objectIdentity.objectIdentityHash
    || value.fingerprint.byteLength
      !== Buffer.byteLength(canonicalScopeText, "utf8")
    || value.fingerprint.mode !== "0600"
    || value.fingerprint.linkCount !== 1
    || value.rawContentHash !== sha256Utf8V2(canonicalScopeText)
  ) {
    failV2(
      "FILESYSTEM_SCOPE_REJOIN_SCOPE_PUBLICATION_INVALID",
      "Scope publication must be one exact canonical scope file with joined stable identity and mutable fingerprint",
    );
  }
}

export function parsePlatformReleaseBootstrapFilesystemScopePublicationEvidenceTestCandidateV2(
  input: unknown,
): PlatformReleaseBootstrapFilesystemScopePublicationEvidenceTestV2 {
  assertNoProxyV2(input, "Scope publication evidence");
  try {
    const snapshot = boundedPlatformReleaseJsonSnapshotV2(
      input,
      PLATFORM_RELEASE_BOOTSTRAP_FILESYSTEM_SCOPE_REJOIN_TEST_V2_MAX_CANONICAL_BYTES,
    );
    const parsed = ScopePublicationEvidenceIdentityV2Schema.parse(snapshot);
    validateScopePublicationEvidenceV2(parsed);
    return deepFreezePlatformReleaseJsonV2(parsed);
  } catch (error) {
    if (error instanceof PlatformReleaseBootstrapFilesystemScopeRejoinTestErrorV2) {
      throw error;
    }
    return failV2(
      "FILESYSTEM_SCOPE_REJOIN_SCOPE_PUBLICATION_INVALID",
      "Scope publication evidence is not one bounded exact cooperative observation",
      error,
    );
  }
}

export function parsePlatformReleaseBootstrapFilesystemScopeRejoinTestCandidateV2(
  input: unknown,
): PlatformReleaseBootstrapFilesystemScopeRejoinTestV2 {
  assertNoProxyV2(input, "Serialized filesystem scope rejoin relation");
  try {
    const snapshot = boundedPlatformReleaseJsonSnapshotV2(
      input,
      PLATFORM_RELEASE_BOOTSTRAP_FILESYSTEM_SCOPE_REJOIN_TEST_V2_MAX_CANONICAL_BYTES,
    );
    const parsed = PlatformReleaseBootstrapFilesystemScopeRejoinTestV2Schema.parse(
      snapshot,
    );
    const { observationHash: _observationHash, ...identity } = parsed;
    if (
      parsed.observationHash
        !== hashPlatformReleaseBootstrapFilesystemScopeRejoinTestV2(identity)
    ) {
      return failV2(
        "FILESYSTEM_SCOPE_REJOIN_SERIALIZATION_INVALID",
        "Filesystem scope rejoin observation hash mismatch",
      );
    }
    return deepFreezePlatformReleaseJsonV2(parsed);
  } catch (error) {
    if (error instanceof PlatformReleaseBootstrapFilesystemScopeRejoinTestErrorV2) {
      throw error;
    }
    return failV2(
      "FILESYSTEM_SCOPE_REJOIN_SERIALIZATION_INVALID",
      "Filesystem scope rejoin relation serialization is invalid",
      error,
    );
  }
}

export function buildPlatformReleaseBootstrapFilesystemScopeRejoinTestV2(
  input: PlatformReleaseBootstrapFilesystemScopeRejoinTestInputV2,
): PlatformReleaseBootstrapFilesystemScopeRejoinTestV2 {
  assertNoProxyV2(input, "Filesystem scope rejoin input");
  let candidateInput: Record<string, unknown>;
  try {
    const bounded = boundedPlatformReleaseJsonSnapshotV2(
      input,
      PLATFORM_RELEASE_BOOTSTRAP_FILESYSTEM_SCOPE_REJOIN_TEST_V2_MAX_CANONICAL_BYTES,
    );
    if (!isPlainRecordV2(bounded)) {
      return failV2(
        "FILESYSTEM_SCOPE_REJOIN_INPUT_INVALID",
        "Filesystem scope rejoin input must be one bounded plain JSON record",
      );
    }
    candidateInput = bounded;
  } catch (error) {
    return failV2(
      "FILESYSTEM_SCOPE_REJOIN_INPUT_INVALID",
      "Filesystem scope rejoin input is not one bounded plain JSON record",
      error,
    );
  }
  const keys = Object.keys(candidateInput).sort();
  if (
    keys.length !== 2
    || keys[0] !== "packageSnapshot"
    || keys[1] !== "scopePublicationEvidence"
  ) {
    return failV2(
      "FILESYSTEM_SCOPE_REJOIN_INPUT_INVALID",
      "Filesystem scope rejoin input contains an unknown or missing field",
    );
  }
  assertNoProxyV2(candidateInput.packageSnapshot, "Package snapshot");
  assertNoProxyV2(
    candidateInput.scopePublicationEvidence,
    "Scope publication evidence",
  );

  let packageSnapshot: PlatformReleaseBootstrapRegistryPackagePhysicalSnapshotTestV2;
  try {
    packageSnapshot =
      parsePlatformReleaseBootstrapRegistryPackagePhysicalSnapshotTestCandidateV2(
        candidateInput.packageSnapshot,
      );
  } catch (error) {
    return failV2(
      "FILESYSTEM_SCOPE_REJOIN_SNAPSHOT_INVALID",
      "Package snapshot is not one complete self-hashed registry physical snapshot",
      error,
    );
  }
  let publication: PlatformReleaseBootstrapFilesystemScopePublicationEvidenceTestV2;
  try {
    publication =
      parsePlatformReleaseBootstrapFilesystemScopePublicationEvidenceTestCandidateV2(
        candidateInput.scopePublicationEvidence,
      );
  } catch (error) {
    if (error instanceof PlatformReleaseBootstrapFilesystemScopeRejoinTestErrorV2) {
      throw error;
    }
    return failV2(
      "FILESYSTEM_SCOPE_REJOIN_SCOPE_PUBLICATION_INVALID",
      "Scope publication evidence is not one exact cooperative observation",
      error,
    );
  }
  if (
    packageSnapshot.filesystemScopeIdentityHash
      !== publication.filesystemScope.scopeIdentityHash
    || packageSnapshot.filesystemScopeIdentityHash
      !== publication.objectIdentity.filesystemScopeIdentityHash
  ) {
    return failV2(
      "FILESYSTEM_SCOPE_REJOIN_SCOPE_PUBLICATION_INVALID",
      "Package snapshot and separately published scope identity do not join",
    );
  }

  const publicationObservationHash =
    hashPlatformReleaseBootstrapFilesystemScopePublicationEvidenceTestV2(
      publication,
    );
  const identity = {
    schema: PLATFORM_RELEASE_BOOTSTRAP_FILESYSTEM_SCOPE_REJOIN_TEST_V2_SCHEMA,
    version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
    admissionScope: "test_fixture" as const,
    authorityState: "cooperative_scope_test_fixture_unverified" as const,
    productionAuthority: false as const,
    productionAdmission: "forbidden" as const,
    credentialUse: "none" as const,
    signingAuthority: "unsigned_test_fixture" as const,
    mutationAuthority: false as const,
    trustConclusion: "characterization_only" as const,
    snapshotHash: packageSnapshot.snapshotHash,
    filesystemScopeIdentityHash: packageSnapshot.filesystemScopeIdentityHash,
    publicationObservationHash,
  } satisfies PlatformReleaseBootstrapFilesystemScopeRejoinTestIdentityV2;
  return parsePlatformReleaseBootstrapFilesystemScopeRejoinTestCandidateV2({
    ...identity,
    observationHash:
      hashPlatformReleaseBootstrapFilesystemScopeRejoinTestV2(identity),
  });
}
