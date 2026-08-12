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

export const PLATFORM_RELEASE_CONTENT_STORE_TEST_V2_SCHEMA =
  "setfarm.platform-release-content-store-test.v2" as const;
export const PLATFORM_RELEASE_CONTENT_STORE_TEST_HASH_V2_SCHEMA =
  "setfarm.platform-release-content-store-test-hash.v2" as const;
export const PLATFORM_RELEASE_CONTENT_STORE_TEST_OBSERVATION_HASH_V2_SCHEMA =
  "setfarm.platform-release-content-store-test-observation-hash.v2" as const;
export const PLATFORM_RELEASE_CONTENT_STORE_TEST_MEMBERSHIP_HASH_V2_SCHEMA =
  "setfarm.platform-release-content-store-test-membership-hash.v2" as const;
export const PLATFORM_RELEASE_CONTENT_STORE_TEST_RELEASE_MEMBERSHIP_HASH_V2_SCHEMA =
  "setfarm.platform-release-content-store-test-release-membership-hash.v2" as const;
export const PLATFORM_RELEASE_CONTENT_STORE_TEST_DIRECTORY_MEMBERSHIP_HASH_V2_SCHEMA =
  "setfarm.platform-release-content-store-test-directory-membership-hash.v2" as const;
export const PLATFORM_RELEASE_CONTENT_STORE_TEST_MAX_CANONICAL_BYTES_V2 =
  12 * 1024 * 1024;
export const PLATFORM_RELEASE_CONTENT_STORE_TEST_MAX_FILE_BYTES_V2 =
  8 * 1024 * 1024;
export const PLATFORM_RELEASE_CONTENT_STORE_TEST_IMPLEMENTATION_SCOPE_V2 =
  "test_fixture_private_release_store_v2" as const;
export const PLATFORM_RELEASE_CONTENT_STORE_TEST_PAYLOAD_BINDING_V2 =
  "test_fixture_manifest_attestation_bytes_only_v2" as const;
export const PLATFORM_RELEASE_CONTENT_STORE_TEST_LAYOUT_V2 =
  "private_store_dot_staging_dot_locks_releases_attestations_v2" as const;
export const PLATFORM_RELEASE_CONTENT_STORE_TEST_SNAPSHOT_SCOPE_V2 =
  "single_release_single_attestation_fixture_snapshot_v2" as const;
export const PLATFORM_RELEASE_CONTENT_STORE_TEST_EPHEMERAL_LOCK_POLICY_V2 =
  "ephemeral_lock_lease_excluded_from_stable_receipt_v2" as const;
export const PLATFORM_RELEASE_CONTENT_STORE_TEST_FILESYSTEM_CAPABILITY_V2 =
  "darwin_descriptor_relative_content_store_fixture_v2" as const;
export const PLATFORM_RELEASE_CONTENT_STORE_TEST_PUBLICATION_BACKEND_V2 =
  "darwin_native_descriptor_relative_no_replace_fixture_v2" as const;
export const PLATFORM_RELEASE_CONTENT_STORE_TEST_CONTENT_LEASE_POLICY_V2 =
  "descriptor_relative_lockf_exclusive_manifest_payload_hash_lease_v2" as const;
export const PLATFORM_RELEASE_CONTENT_STORE_TEST_ATTESTATION_LEASE_POLICY_V2 =
  "descriptor_relative_lockf_exclusive_attestation_hash_lease_v2" as const;
export const PLATFORM_RELEASE_CONTENT_STORE_TEST_CONDITIONAL_UNLINK_POLICY_V2 =
  "preserve_unless_exact_identity_revalidated_no_same_uid_atomic_unlink_v2" as const;
export const PLATFORM_RELEASE_CONTENT_STORE_TEST_EXACT_CLEANUP_POLICY_V2 =
  "descriptor_relative_known_shape_non_recursive_fail_closed_v2" as const;
export const PLATFORM_RELEASE_CONTENT_STORE_TEST_STALE_LEASE_RECOVERY_POLICY_V2 =
  "unauthenticated_fixture_exact_inode_and_f_tlock_only_v2" as const;
export const PLATFORM_RELEASE_CONTENT_STORE_TEST_NATIVE_PUBLICATION_HASH_V2_SCHEMA =
  "setfarm.platform-release-content-store-test-native-publication-hash.v2" as const;

const CanonicalDecimalV2Schema = z.string()
  .min(1)
  .max(80)
  .regex(/^(?:0|[1-9][0-9]*)$/u);
const CanonicalModeV2Schema = z.string().regex(/^[0-7]{4}$/u);
const StableObjectKindV2Schema = z.enum(["ordinary_file", "directory"]);

const StableIdentityV2Schema = z.object({
  hostIdentityHash: Sha256Schema,
  objectKind: StableObjectKindV2Schema,
  device: CanonicalDecimalV2Schema,
  inode: CanonicalDecimalV2Schema,
}).strict();

const MutableFingerprintV2Schema = z.object({
  ownerUid: z.number().int().nonnegative().safe().max(4_294_967_294),
  ownerGid: z.number().int().nonnegative().safe().max(4_294_967_294),
  mode: CanonicalModeV2Schema,
  linkCount: z.number().int().positive().safe(),
  byteLength: z.number().int().nonnegative().safe()
    .max(PLATFORM_RELEASE_CONTENT_STORE_TEST_MAX_FILE_BYTES_V2),
  contentHash: Sha256Schema,
  modifiedTimeNanoseconds: CanonicalDecimalV2Schema,
  changedTimeNanoseconds: CanonicalDecimalV2Schema,
}).strict();

const ObservationV2Schema = z.object({
  stableIdentity: StableIdentityV2Schema,
  mutableFingerprint: MutableFingerprintV2Schema,
  observationHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  const { observationHash: _observationHash, ...identity } = value;
  if (value.observationHash !== hashPlatformReleaseContentStoreTestObservationV2(identity)) {
    context.addIssue({
      code: "custom",
      path: ["observationHash"],
      message: "Content-store physical observation hash mismatch",
    });
  }
});

type ObservationV2 = z.infer<typeof ObservationV2Schema>;

const FenceV2Schema = z.object({
  storeRoot: ObservationV2Schema,
  locksRoot: ObservationV2Schema,
  stagingRoot: ObservationV2Schema,
  attestationsRoot: ObservationV2Schema,
  releasesRoot: ObservationV2Schema,
  releaseRoot: ObservationV2Schema,
  manifest: ObservationV2Schema,
  attestation: ObservationV2Schema,
}).strict();

const FreshReproductionIdentityV2Schema = z.object({
  outcome: z.literal("exact_manifest_and_attestation_reproduced"),
  manifestPayloadHash: Sha256Schema,
  attestationHash: Sha256Schema,
  manifestFileContentHash: Sha256Schema,
  attestationFileContentHash: Sha256Schema,
  manifestByteLength: z.number().int().positive().safe()
    .max(PLATFORM_RELEASE_CONTENT_STORE_TEST_MAX_FILE_BYTES_V2),
  attestationByteLength: z.number().int().positive().safe()
    .max(PLATFORM_RELEASE_CONTENT_STORE_TEST_MAX_FILE_BYTES_V2),
}).strict();

function freshReproductionHashV2(
  value: z.infer<typeof FreshReproductionIdentityV2Schema>,
): string {
  return hashCanonicalJson({
    schema: `${PLATFORM_RELEASE_CONTENT_STORE_TEST_V2_SCHEMA}.fresh-reproduction.v2`,
    reproduction: value,
  });
}

const FreshReproductionWithHashV2Schema = FreshReproductionIdentityV2Schema.extend({
  reproductionHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  const { reproductionHash: _reproductionHash, ...identity } = value;
  if (value.reproductionHash !== freshReproductionHashV2(identity)) {
    context.addIssue({
      code: "custom",
      path: ["reproductionHash"],
      message: "Fresh reproduction hash mismatch",
    });
  }
});

const FilesystemMechanicsV2Schema = z.object({
  capability: z.literal(PLATFORM_RELEASE_CONTENT_STORE_TEST_FILESYSTEM_CAPABILITY_V2),
  productionAuthority: z.literal(false),
  publicationBackend: z.literal(PLATFORM_RELEASE_CONTENT_STORE_TEST_PUBLICATION_BACKEND_V2),
  contentLeasePolicy: z.literal(PLATFORM_RELEASE_CONTENT_STORE_TEST_CONTENT_LEASE_POLICY_V2),
  attestationLeasePolicy: z.literal(PLATFORM_RELEASE_CONTENT_STORE_TEST_ATTESTATION_LEASE_POLICY_V2),
  conditionalUnlinkPolicy: z.literal(PLATFORM_RELEASE_CONTENT_STORE_TEST_CONDITIONAL_UNLINK_POLICY_V2),
  exactCleanupPolicy: z.literal(PLATFORM_RELEASE_CONTENT_STORE_TEST_EXACT_CLEANUP_POLICY_V2),
  staleLeaseRecoveryPolicy: z.literal(
    PLATFORM_RELEASE_CONTENT_STORE_TEST_STALE_LEASE_RECOVERY_POLICY_V2,
  ),
  contentLeaseRecovered: z.literal(false),
  attestationLeaseRecovered: z.literal(false),
  unauthenticatedStaleLeaseRecoveryEnabled: z.literal(true),
  authenticatedLeaseLedgerPresent: z.literal(false),
  sameUidAtomicConditionalUnlinkAvailable: z.literal(false),
  fixtureBuildRecipeHash: Sha256Schema,
  fixtureBinaryHash: Sha256Schema,
  fixtureBinaryByteLength: z.number().int().positive().safe().max(4 * 1024 * 1024),
}).strict();

export function hashPlatformReleaseContentStoreTestNativePublicationV2(
  mechanics: z.infer<typeof FilesystemMechanicsV2Schema>,
  publication: "published" | "adopted_identical",
  fence: z.infer<typeof FenceV2Schema>,
): string {
  return hashCanonicalJson({
    schema: PLATFORM_RELEASE_CONTENT_STORE_TEST_NATIVE_PUBLICATION_HASH_V2_SCHEMA,
    mechanics,
    publication,
    fence,
  });
}

const IdentityV2Schema = z.object({
  schema: z.literal(PLATFORM_RELEASE_CONTENT_STORE_TEST_V2_SCHEMA),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  authorityState: z.literal("test_fixture_content_store_unverified"),
  admissionScope: z.literal("test_fixture"),
  productionAuthority: z.literal(false),
  productionAdmission: z.literal("forbidden"),
  credentialUse: z.literal("none"),
  signingAuthority: z.literal("unsigned_test_fixture"),
  mutationAuthority: z.literal(false),
  operationMode: z.literal("test_fixture_publication_only"),
  trustConclusion: z.literal("characterization_only"),
  productionBlockers: z.tuple([
    z.literal("production_store_bootstrap_absent"),
    z.literal("authenticated_release_lease_absent"),
    z.literal("atomic_conditional_unlink_absent"),
    z.literal("crash_replay_ledger_absent"),
    z.literal("runtime_payload_unbound"),
    z.literal("fresh_production_verifier_absent"),
  ]),
  implementationScope: z.literal(PLATFORM_RELEASE_CONTENT_STORE_TEST_IMPLEMENTATION_SCOPE_V2),
  payloadBinding: z.literal(PLATFORM_RELEASE_CONTENT_STORE_TEST_PAYLOAD_BINDING_V2),
  layout: z.literal(PLATFORM_RELEASE_CONTENT_STORE_TEST_LAYOUT_V2),
  snapshotScope: z.literal(PLATFORM_RELEASE_CONTENT_STORE_TEST_SNAPSHOT_SCOPE_V2),
  ephemeralLockPolicy: z.literal(PLATFORM_RELEASE_CONTENT_STORE_TEST_EPHEMERAL_LOCK_POLICY_V2),
  challengeHash: Sha256Schema,
  manifestPayloadHash: Sha256Schema,
  attestationHash: Sha256Schema,
  releaseContentHash: Sha256Schema,
  manifestFileContentHash: Sha256Schema,
  attestationFileContentHash: Sha256Schema,
  manifestByteLength: z.number().int().positive().safe()
    .max(PLATFORM_RELEASE_CONTENT_STORE_TEST_MAX_FILE_BYTES_V2),
  attestationByteLength: z.number().int().positive().safe()
    .max(PLATFORM_RELEASE_CONTENT_STORE_TEST_MAX_FILE_BYTES_V2),
  publication: z.enum(["published", "adopted_identical"]),
  filesystemMechanics: FilesystemMechanicsV2Schema,
  nativePublicationHash: Sha256Schema,
  storeMembershipHash: Sha256Schema,
  releaseMembershipHash: Sha256Schema,
  publishedFence: FenceV2Schema,
  reproducedFence: FenceV2Schema,
  freshReproduction: FreshReproductionWithHashV2Schema,
}).strict();

export type PlatformReleaseContentStoreTestHashPayloadV2 =
  z.infer<typeof IdentityV2Schema>;

export function hashPlatformReleaseContentStoreTestObservationV2(
  value: Readonly<Record<string, unknown>>,
): string {
  return hashCanonicalJson({
    schema: PLATFORM_RELEASE_CONTENT_STORE_TEST_OBSERVATION_HASH_V2_SCHEMA,
    observation: value,
  });
}

export function hashPlatformReleaseContentStoreTestMembershipV2(
  manifestPayloadHash: string,
  attestationHash: string,
): string {
  return hashCanonicalJson({
    schema: PLATFORM_RELEASE_CONTENT_STORE_TEST_MEMBERSHIP_HASH_V2_SCHEMA,
    entries: [
      ".locks",
      ".staging",
      "attestations",
      "releases",
      `attestations/${attestationHash}.json`,
      `releases/${manifestPayloadHash}`,
      `releases/${manifestPayloadHash}/manifest.json`,
    ],
  });
}

export function hashPlatformReleaseContentStoreTestReleaseMembershipV2(): string {
  return hashCanonicalJson({
    schema: PLATFORM_RELEASE_CONTENT_STORE_TEST_RELEASE_MEMBERSHIP_HASH_V2_SCHEMA,
    entries: ["manifest.json"],
  });
}

export function hashPlatformReleaseContentStoreTestDirectoryMembershipV2(
  relativePath: string,
  entries: readonly string[],
): string {
  return hashCanonicalJson({
    schema: PLATFORM_RELEASE_CONTENT_STORE_TEST_DIRECTORY_MEMBERSHIP_HASH_V2_SCHEMA,
    relativePath,
    entries,
  });
}

export function hashPlatformReleaseContentStoreTestV2(
  value: Readonly<Record<string, unknown>>,
): string {
  const identity = { ...value } as Record<string, unknown>;
  delete identity.storeHash;
  return hashCanonicalJson({
    schema: PLATFORM_RELEASE_CONTENT_STORE_TEST_HASH_V2_SCHEMA,
    store: identity,
  });
}

export const PlatformReleaseContentStoreTestV2Schema = IdentityV2Schema.extend({
  storeHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  const { storeHash: _storeHash, ...identity } = value;
  if (value.storeHash !== hashPlatformReleaseContentStoreTestV2(identity)) {
    context.addIssue({
      code: "custom",
      path: ["storeHash"],
      message: "Content-store receipt hash mismatch",
    });
  }
  if (value.releaseContentHash !== value.manifestPayloadHash) {
    context.addIssue({
      code: "custom",
      path: ["releaseContentHash"],
      message: "Release content hash must equal the manifest payload hash",
    });
  }
  if (
    value.nativePublicationHash !== hashPlatformReleaseContentStoreTestNativePublicationV2(
      value.filesystemMechanics,
      value.publication,
      value.publishedFence,
    )
  ) {
    context.addIssue({
      code: "custom",
      path: ["nativePublicationHash"],
      message: "Native publication mechanics and exact physical fence hash mismatch",
    });
  }
  if (value.publishedFence.storeRoot.stableIdentity.objectKind !== "directory"
      || value.reproducedFence.storeRoot.stableIdentity.objectKind !== "directory"
      || value.publishedFence.locksRoot.stableIdentity.objectKind !== "directory"
      || value.reproducedFence.locksRoot.stableIdentity.objectKind !== "directory"
      || value.publishedFence.stagingRoot.stableIdentity.objectKind !== "directory"
      || value.reproducedFence.stagingRoot.stableIdentity.objectKind !== "directory"
      || value.publishedFence.attestationsRoot.stableIdentity.objectKind !== "directory"
      || value.reproducedFence.attestationsRoot.stableIdentity.objectKind !== "directory"
      || value.publishedFence.releasesRoot.stableIdentity.objectKind !== "directory"
      || value.reproducedFence.releasesRoot.stableIdentity.objectKind !== "directory"
      || value.publishedFence.releaseRoot.stableIdentity.objectKind !== "directory"
      || value.reproducedFence.releaseRoot.stableIdentity.objectKind !== "directory"
      || value.publishedFence.manifest.stableIdentity.objectKind !== "ordinary_file"
      || value.reproducedFence.manifest.stableIdentity.objectKind !== "ordinary_file"
      || value.publishedFence.attestation.stableIdentity.objectKind !== "ordinary_file"
      || value.reproducedFence.attestation.stableIdentity.objectKind !== "ordinary_file") {
    context.addIssue({ code: "custom", path: ["publishedFence"], message: "Store fence object kinds must match the private release layout" });
  }
  const allObservations = [
    value.publishedFence.storeRoot,
    value.publishedFence.locksRoot,
    value.publishedFence.stagingRoot,
    value.publishedFence.attestationsRoot,
    value.publishedFence.releasesRoot,
    value.publishedFence.releaseRoot,
    value.publishedFence.manifest,
    value.publishedFence.attestation,
    value.reproducedFence.storeRoot,
    value.reproducedFence.locksRoot,
    value.reproducedFence.stagingRoot,
    value.reproducedFence.attestationsRoot,
    value.reproducedFence.releasesRoot,
    value.reproducedFence.releaseRoot,
    value.reproducedFence.manifest,
    value.reproducedFence.attestation,
  ];
  const hostHashes = new Set(allObservations.map((observation) => observation.stableIdentity.hostIdentityHash));
  if (hostHashes.size !== 1) {
    context.addIssue({ code: "custom", path: ["publishedFence"], message: "Every store observation must join one test host identity" });
  }
  const devices = new Set(allObservations.map((observation) => observation.stableIdentity.device));
  if (devices.size !== 1) {
    context.addIssue({ code: "custom", path: ["publishedFence"], message: "Every store observation must join one filesystem device for atomic publication" });
  }
  const publishedKeys = new Set([
    ...[value.publishedFence.storeRoot, value.publishedFence.locksRoot, value.publishedFence.stagingRoot, value.publishedFence.attestationsRoot, value.publishedFence.releasesRoot, value.publishedFence.releaseRoot, value.publishedFence.manifest, value.publishedFence.attestation]
      .map((observation) => `${observation.stableIdentity.objectKind}:${observation.stableIdentity.device}:${observation.stableIdentity.inode}`),
  ]);
  if (publishedKeys.size !== 8) {
    context.addIssue({ code: "custom", path: ["publishedFence"], message: "Persistent store roots, release root, manifest and attestation must be physically distinct" });
  }
  if (canonicalJsonStringify(value.publishedFence) !== canonicalJsonStringify(value.reproducedFence)) {
    context.addIssue({ code: "custom", path: ["reproducedFence"], message: "Fresh reproduction must preserve the published physical fence" });
  }
  const expectedStoreMembershipHash = hashPlatformReleaseContentStoreTestMembershipV2(value.manifestPayloadHash, value.attestationHash);
  const expectedReleaseMembershipHash = hashPlatformReleaseContentStoreTestReleaseMembershipV2();
  const expectedLocksMembershipHash = hashPlatformReleaseContentStoreTestDirectoryMembershipV2(".locks", []);
  const expectedStagingMembershipHash = hashPlatformReleaseContentStoreTestDirectoryMembershipV2(".staging", []);
  const expectedAttestationsMembershipHash = hashPlatformReleaseContentStoreTestDirectoryMembershipV2("attestations", [`${value.attestationHash}.json`]);
  const expectedReleasesMembershipHash = hashPlatformReleaseContentStoreTestDirectoryMembershipV2("releases", [value.manifestPayloadHash]);
  const expectedStoreMembershipByteLength = Buffer.byteLength(canonicalJsonStringify([
    ".locks",
    ".staging",
    "attestations",
    "releases",
    `attestations/${value.attestationHash}.json`,
    `releases/${value.manifestPayloadHash}`,
    `releases/${value.manifestPayloadHash}/manifest.json`,
  ]));
  const expectedStagingMembershipByteLength = Buffer.byteLength(canonicalJsonStringify([]));
  const expectedLocksMembershipByteLength = Buffer.byteLength(canonicalJsonStringify([]));
  const expectedAttestationsMembershipByteLength = Buffer.byteLength(canonicalJsonStringify([`${value.attestationHash}.json`]));
  const expectedReleasesMembershipByteLength = Buffer.byteLength(canonicalJsonStringify([value.manifestPayloadHash]));
  const expectedReleaseMembershipByteLength = Buffer.byteLength(canonicalJsonStringify(["manifest.json"]));
  if (value.storeMembershipHash !== expectedStoreMembershipHash
      || value.releaseMembershipHash !== expectedReleaseMembershipHash
      || value.publishedFence.storeRoot.mutableFingerprint.contentHash !== expectedStoreMembershipHash
      || value.reproducedFence.storeRoot.mutableFingerprint.contentHash !== expectedStoreMembershipHash
      || value.publishedFence.locksRoot.mutableFingerprint.contentHash !== expectedLocksMembershipHash
      || value.reproducedFence.locksRoot.mutableFingerprint.contentHash !== expectedLocksMembershipHash
      || value.publishedFence.stagingRoot.mutableFingerprint.contentHash !== expectedStagingMembershipHash
      || value.reproducedFence.stagingRoot.mutableFingerprint.contentHash !== expectedStagingMembershipHash
      || value.publishedFence.attestationsRoot.mutableFingerprint.contentHash !== expectedAttestationsMembershipHash
      || value.reproducedFence.attestationsRoot.mutableFingerprint.contentHash !== expectedAttestationsMembershipHash
      || value.publishedFence.releasesRoot.mutableFingerprint.contentHash !== expectedReleasesMembershipHash
      || value.reproducedFence.releasesRoot.mutableFingerprint.contentHash !== expectedReleasesMembershipHash
      || value.publishedFence.releaseRoot.mutableFingerprint.contentHash !== expectedReleaseMembershipHash
      || value.reproducedFence.releaseRoot.mutableFingerprint.contentHash !== expectedReleaseMembershipHash
      || value.publishedFence.storeRoot.mutableFingerprint.byteLength !== expectedStoreMembershipByteLength
      || value.reproducedFence.storeRoot.mutableFingerprint.byteLength !== expectedStoreMembershipByteLength
      || value.publishedFence.locksRoot.mutableFingerprint.byteLength !== expectedLocksMembershipByteLength
      || value.reproducedFence.locksRoot.mutableFingerprint.byteLength !== expectedLocksMembershipByteLength
      || value.publishedFence.stagingRoot.mutableFingerprint.byteLength !== expectedStagingMembershipByteLength
      || value.reproducedFence.stagingRoot.mutableFingerprint.byteLength !== expectedStagingMembershipByteLength
      || value.publishedFence.attestationsRoot.mutableFingerprint.byteLength !== expectedAttestationsMembershipByteLength
      || value.reproducedFence.attestationsRoot.mutableFingerprint.byteLength !== expectedAttestationsMembershipByteLength
      || value.publishedFence.releasesRoot.mutableFingerprint.byteLength !== expectedReleasesMembershipByteLength
      || value.reproducedFence.releasesRoot.mutableFingerprint.byteLength !== expectedReleasesMembershipByteLength
      || value.publishedFence.releaseRoot.mutableFingerprint.byteLength !== expectedReleaseMembershipByteLength
      || value.reproducedFence.releaseRoot.mutableFingerprint.byteLength !== expectedReleaseMembershipByteLength) {
    context.addIssue({ code: "custom", path: ["storeMembershipHash"], message: "Store membership must equal the exact release layout" });
  }
  for (const [label, observation] of [
    ["storeRoot", value.publishedFence.storeRoot],
    ["locksRoot", value.publishedFence.locksRoot],
    ["stagingRoot", value.publishedFence.stagingRoot],
    ["attestationsRoot", value.publishedFence.attestationsRoot],
    ["releasesRoot", value.publishedFence.releasesRoot],
    ["releaseRoot", value.publishedFence.releaseRoot],
  ] as const) {
    const expectedMode = label === "releaseRoot" ? "0555" : "0700";
    if (observation.mutableFingerprint.mode !== expectedMode) {
      context.addIssue({ code: "custom", path: ["publishedFence", label, "mutableFingerprint", "mode"], message: "Store directory mode does not implement the release layout" });
    }
  }
  for (const [label, observation] of [["manifest", value.publishedFence.manifest], ["attestation", value.publishedFence.attestation]] as const) {
    if (observation.mutableFingerprint.mode !== "0444" || observation.mutableFingerprint.linkCount !== 1) {
      context.addIssue({ code: "custom", path: ["publishedFence", label, "mutableFingerprint"], message: "Published content files must be single-link read-only files" });
    }
  }
  if (value.publishedFence.manifest.mutableFingerprint.contentHash !== value.manifestFileContentHash
      || value.publishedFence.attestation.mutableFingerprint.contentHash !== value.attestationFileContentHash
      || value.reproducedFence.manifest.mutableFingerprint.contentHash !== value.manifestFileContentHash
      || value.reproducedFence.attestation.mutableFingerprint.contentHash !== value.attestationFileContentHash
      || value.publishedFence.manifest.mutableFingerprint.byteLength !== value.manifestByteLength
      || value.publishedFence.attestation.mutableFingerprint.byteLength !== value.attestationByteLength
      || value.freshReproduction.manifestPayloadHash !== value.manifestPayloadHash
      || value.freshReproduction.attestationHash !== value.attestationHash
      || value.freshReproduction.manifestFileContentHash !== value.manifestFileContentHash
      || value.freshReproduction.attestationFileContentHash !== value.attestationFileContentHash
      || value.freshReproduction.manifestByteLength !== value.manifestByteLength
      || value.freshReproduction.attestationByteLength !== value.attestationByteLength) {
    context.addIssue({ code: "custom", path: ["freshReproduction"], message: "Fresh reproduction must bind both exact canonical content files" });
  }
  if (value.publishedFence.manifest.stableIdentity.hostIdentityHash !== value.publishedFence.attestation.stableIdentity.hostIdentityHash) {
    context.addIssue({ code: "custom", path: ["publishedFence"], message: "Manifest and attestation must share one host identity" });
  }
  if (!platformReleaseCandidateFitsCanonicalCapV2(value, PLATFORM_RELEASE_CONTENT_STORE_TEST_MAX_CANONICAL_BYTES_V2)) {
    context.addIssue({ code: "custom", message: "Content-store receipt exceeds its canonical byte cap" });
  }
});

export type PlatformReleaseContentStoreTestV2 = z.infer<
  typeof PlatformReleaseContentStoreTestV2Schema
>;

export function parsePlatformReleaseContentStoreTestCandidateV2(
  input: unknown,
): PlatformReleaseContentStoreTestV2 {
  const snapshot = boundedPlatformReleaseJsonSnapshotV2(
    input,
    PLATFORM_RELEASE_CONTENT_STORE_TEST_MAX_CANONICAL_BYTES_V2,
  );
  return deepFreezePlatformReleaseJsonV2(
    PlatformReleaseContentStoreTestV2Schema.parse(snapshot),
  );
}

export type PlatformReleaseContentStoreTestFenceV2 = z.infer<
  typeof FenceV2Schema
>;
export type PlatformReleaseContentStoreTestObservationV2 = ObservationV2;
