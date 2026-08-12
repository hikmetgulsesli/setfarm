import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";

import {
  buildPlatformReleaseContentStoreDirectoryMembershipFingerprintV3,
  buildPlatformReleaseContentStoreGlobalCensusV3,
  buildPlatformReleaseContentStoreObservationV3,
  type PlatformReleaseContentStoreGlobalCensusV3,
  type PlatformReleaseContentStoreObservationV3,
} from "../../src/execution/schemas/platform-release-content-store-census-v3.js";
import {
  PLATFORM_RELEASE_CONTENT_STORE_PUBLISHER_PREFLIGHT_TEST_V3_SCHEMA,
  PLATFORM_RELEASE_CONTENT_STORE_TEST_V3_PRODUCTION_BLOCKERS,
  PlatformReleaseContentStoreLeafReceiptTestV3Schema,
  PlatformReleaseContentStorePublisherPreflightTestV3Schema,
  assertPlatformReleaseContentStoreLeafReceiptJoinsPreflightTestV3,
  buildPlatformReleaseContentStoreLeafReceiptFromPreflightTestV3,
  hashPlatformReleaseContentStoreCandidateDeltaTestV3,
  hashPlatformReleaseContentStoreCandidateTestV3,
  hashPlatformReleaseContentStoreLeafReceiptTestV3,
  hashPlatformReleaseContentStorePublisherPreflightTestV3,
  parsePlatformReleaseContentStoreLeafReceiptTestCandidateV3,
  parsePlatformReleaseContentStorePublisherPreflightTestCandidateV3,
  type PlatformReleaseContentStorePublisherPreflightTestHashPayloadV3,
} from "../../src/execution/schemas/platform-release-content-store-test-v3.js";
import {
  PLATFORM_RELEASE_CONTENT_STORE_TEST_V2_SCHEMA,
  PlatformReleaseContentStoreTestV2Schema,
  hashPlatformReleaseContentStoreTestDirectoryMembershipV2,
  hashPlatformReleaseContentStoreTestMembershipV2,
  hashPlatformReleaseContentStoreTestNativePublicationV2,
  hashPlatformReleaseContentStoreTestObservationV2,
  hashPlatformReleaseContentStoreTestReleaseMembershipV2,
  hashPlatformReleaseContentStoreTestV2,
  parsePlatformReleaseContentStoreTestCandidateV2,
} from "../../src/execution/schemas/platform-release-content-store-test-v2.js";
import {
  canonicalJsonStringify,
  hashCanonicalJson,
} from "../../src/product-compiler/canonical-json.js";

function sha(label: string): string {
  return createHash("sha256").update(label).digest("hex");
}

function productionBlockers(): [...typeof PLATFORM_RELEASE_CONTENT_STORE_TEST_V3_PRODUCTION_BLOCKERS] {
  return [...PLATFORM_RELEASE_CONTENT_STORE_TEST_V3_PRODUCTION_BLOCKERS];
}

function observationV3(input: {
  inode: number;
  objectKind: "directory" | "ordinary_file";
  mode: string;
  contentHash: string;
  byteLength: number;
  linkCount?: number;
}): PlatformReleaseContentStoreObservationV3 {
  return buildPlatformReleaseContentStoreObservationV3({
    stableIdentity: {
      hostIdentityHash: sha("host-v3"),
      objectKind: input.objectKind,
      device: "41",
      inode: String(input.inode),
    },
    mutableFingerprint: {
      ownerUid: 501,
      ownerGid: 20,
      mode: input.mode,
      linkCount: input.linkCount ?? 2,
      byteLength: input.byteLength,
      contentHash: input.contentHash,
      modifiedTimeNanoseconds: "1000000001",
      changedTimeNanoseconds: "1000000002",
    },
  });
}

function directoryObservationV3(input: {
  inode: number;
  mode: "0700" | "0555";
  role: Parameters<
    typeof buildPlatformReleaseContentStoreDirectoryMembershipFingerprintV3
  >[0];
  entryNames: readonly string[];
}): PlatformReleaseContentStoreObservationV3 {
  const membership =
    buildPlatformReleaseContentStoreDirectoryMembershipFingerprintV3(
      input.role,
      input.entryNames,
    );
  return observationV3({
    inode: input.inode,
    objectKind: "directory",
    mode: input.mode,
    ...membership,
  });
}

function buildV3Fixture(): {
  baselineCensus: PlatformReleaseContentStoreGlobalCensusV3;
  candidateFinalCensus: PlatformReleaseContentStoreGlobalCensusV3;
  candidate: PlatformReleaseContentStorePublisherPreflightTestHashPayloadV3["candidate"];
  preflight: ReturnType<typeof parsePlatformReleaseContentStorePublisherPreflightTestCandidateV3>;
  receipt: ReturnType<typeof parsePlatformReleaseContentStoreLeafReceiptTestCandidateV3>;
} {
  const manifestPayloadHash = sha("manifest-payload-v3");
  const attestationHash = sha("attestation-v3");
  const manifestFileContentHash = sha("manifest-file-v3");
  const attestationFileContentHash = sha("attestation-file-v3");
  const manifestByteLength = 307;
  const attestationByteLength = 211;
  const persistentAnchors = (
    releaseHashes: readonly string[],
    attestationHashes: readonly string[],
  ) => ({
    storeRoot: directoryObservationV3({
      inode: 1,
      mode: "0700",
      role: "store_root",
      entryNames: [".locks", ".staging", "attestations", "releases"],
    }),
    locksRoot: directoryObservationV3({
      inode: 2,
      mode: "0700",
      role: "locks_root",
      entryNames: [],
    }),
    stagingRoot: directoryObservationV3({
      inode: 3,
      mode: "0700",
      role: "staging_root",
      entryNames: [],
    }),
    releasesRoot: directoryObservationV3({
      inode: 4,
      mode: "0700",
      role: "releases_root",
      entryNames: [...releaseHashes].sort(),
    }),
    attestationsRoot: directoryObservationV3({
      inode: 5,
      mode: "0700",
      role: "attestations_root",
      entryNames: attestationHashes.map((hash) => `${hash}.json`).sort(),
    }),
  });
  const releaseEntry = {
    manifestPayloadHash,
    releaseRoot: directoryObservationV3({
      inode: 6,
      mode: "0555",
      role: "release_root",
      entryNames: ["manifest.json"],
    }),
    manifest: observationV3({
      inode: 7,
      objectKind: "ordinary_file",
      mode: "0444",
      linkCount: 1,
      contentHash: manifestFileContentHash,
      byteLength: manifestByteLength,
    }),
  };
  const attestationEntry = {
    attestationHash,
    releaseContentHash: manifestPayloadHash,
    attestation: observationV3({
      inode: 8,
      objectKind: "ordinary_file",
      mode: "0444",
      linkCount: 1,
      contentHash: attestationFileContentHash,
      byteLength: attestationByteLength,
    }),
  };
  const baselineCensus = buildPlatformReleaseContentStoreGlobalCensusV3({
    hostIdentityHash: sha("host-v3"),
    persistentAnchors: persistentAnchors([], []),
    releaseEntries: [],
    attestationEntries: [],
  });
  const candidateFinalCensus = buildPlatformReleaseContentStoreGlobalCensusV3({
    hostIdentityHash: sha("host-v3"),
    persistentAnchors: persistentAnchors(
      [manifestPayloadHash],
      [attestationHash],
    ),
    releaseEntries: [releaseEntry],
    attestationEntries: [attestationEntry],
  });
  const candidateIdentity = {
    manifestPayloadHash,
    attestationHash,
    releaseContentHash: manifestPayloadHash,
    manifestFileContentHash,
    attestationFileContentHash,
    manifestByteLength,
    attestationByteLength,
  };
  const candidate = {
    ...candidateIdentity,
    candidateHash: hashPlatformReleaseContentStoreCandidateTestV3(candidateIdentity),
  };
  const deltaIdentity = {
    addedReleaseCount: 1,
    addedAttestationCount: 1,
    addedContentBytes: manifestByteLength + attestationByteLength,
  };
  const preflightIdentity: PlatformReleaseContentStorePublisherPreflightTestHashPayloadV3 = {
    schema: PLATFORM_RELEASE_CONTENT_STORE_PUBLISHER_PREFLIGHT_TEST_V3_SCHEMA,
    version: "3.0.0",
    admissionScope: "test_fixture",
    productionAuthority: false,
    productionAdmission: "forbidden",
    credentialUse: "none",
    signingAuthority: "unsigned_test_fixture",
    mutationAuthority: false,
    trustConclusion: "characterization_only",
    productionBlockers: productionBlockers(),
    authorityState: "test_fixture_publisher_preflight_unverified",
    operationMode: "test_fixture_preflight_only",
    baselineCensus,
    candidateFinalCensus,
    candidate,
    disposition: "append_candidate_delta",
    delta: {
      ...deltaIdentity,
      deltaHash: hashPlatformReleaseContentStoreCandidateDeltaTestV3(deltaIdentity),
    },
    expectedFinalCensusHash: candidateFinalCensus.censusHash,
  };
  const preflight = parsePlatformReleaseContentStorePublisherPreflightTestCandidateV3({
    ...preflightIdentity,
    preflightHash: hashPlatformReleaseContentStorePublisherPreflightTestV3(
      preflightIdentity,
    ),
  });
  const receipt =
    buildPlatformReleaseContentStoreLeafReceiptFromPreflightTestV3(preflight);
  return { baselineCensus, candidateFinalCensus, candidate, preflight, receipt };
}

function rehashPreflight(
  value: ReturnType<typeof buildV3Fixture>["preflight"],
): unknown {
  const { preflightHash: _preflightHash, ...identity } = value;
  return {
    ...identity,
    preflightHash: hashPlatformReleaseContentStorePublisherPreflightTestV3(identity),
  };
}

function rehashReceipt(
  value: ReturnType<typeof buildV3Fixture>["receipt"],
): ReturnType<typeof buildV3Fixture>["receipt"] {
  const { receiptHash: _receiptHash, ...identity } = value;
  return parsePlatformReleaseContentStoreLeafReceiptTestCandidateV3({
    ...identity,
    receiptHash: hashPlatformReleaseContentStoreLeafReceiptTestV3(identity),
  });
}

function membershipByteLength(entries: readonly string[]): number {
  return Buffer.byteLength(canonicalJsonStringify(entries));
}

function observationV2(input: {
  inode: number;
  objectKind: "directory" | "ordinary_file";
  mode: string;
  contentHash: string;
  byteLength: number;
  linkCount?: number;
}) {
  const identity = {
    stableIdentity: {
      hostIdentityHash: sha("host-v2"),
      objectKind: input.objectKind,
      device: "31",
      inode: String(input.inode),
    },
    mutableFingerprint: {
      ownerUid: 501,
      ownerGid: 20,
      mode: input.mode,
      linkCount: input.linkCount ?? 2,
      byteLength: input.byteLength,
      contentHash: input.contentHash,
      modifiedTimeNanoseconds: "2000000001",
      changedTimeNanoseconds: "2000000002",
    },
  };
  return {
    ...identity,
    observationHash: hashPlatformReleaseContentStoreTestObservationV2(identity),
  };
}

function buildValidV2Receipt() {
  const manifestPayloadHash = sha("manifest-payload-v2");
  const attestationHash = sha("attestation-v2");
  const manifestFileContentHash = sha("manifest-file-v2");
  const attestationFileContentHash = sha("attestation-file-v2");
  const manifestByteLength = 151;
  const attestationByteLength = 127;
  const storeEntries = [
    ".locks",
    ".staging",
    "attestations",
    "releases",
    `attestations/${attestationHash}.json`,
    `releases/${manifestPayloadHash}`,
    `releases/${manifestPayloadHash}/manifest.json`,
  ];
  const fence = {
    storeRoot: observationV2({
      inode: 101,
      objectKind: "directory",
      mode: "0700",
      contentHash: hashPlatformReleaseContentStoreTestMembershipV2(
        manifestPayloadHash,
        attestationHash,
      ),
      byteLength: membershipByteLength(storeEntries),
    }),
    locksRoot: observationV2({
      inode: 102,
      objectKind: "directory",
      mode: "0700",
      contentHash: hashPlatformReleaseContentStoreTestDirectoryMembershipV2(".locks", []),
      byteLength: membershipByteLength([]),
    }),
    stagingRoot: observationV2({
      inode: 103,
      objectKind: "directory",
      mode: "0700",
      contentHash: hashPlatformReleaseContentStoreTestDirectoryMembershipV2(".staging", []),
      byteLength: membershipByteLength([]),
    }),
    attestationsRoot: observationV2({
      inode: 104,
      objectKind: "directory",
      mode: "0700",
      contentHash: hashPlatformReleaseContentStoreTestDirectoryMembershipV2(
        "attestations",
        [`${attestationHash}.json`],
      ),
      byteLength: membershipByteLength([`${attestationHash}.json`]),
    }),
    releasesRoot: observationV2({
      inode: 105,
      objectKind: "directory",
      mode: "0700",
      contentHash: hashPlatformReleaseContentStoreTestDirectoryMembershipV2(
        "releases",
        [manifestPayloadHash],
      ),
      byteLength: membershipByteLength([manifestPayloadHash]),
    }),
    releaseRoot: observationV2({
      inode: 106,
      objectKind: "directory",
      mode: "0555",
      contentHash: hashPlatformReleaseContentStoreTestReleaseMembershipV2(),
      byteLength: membershipByteLength(["manifest.json"]),
    }),
    manifest: observationV2({
      inode: 107,
      objectKind: "ordinary_file",
      mode: "0444",
      linkCount: 1,
      contentHash: manifestFileContentHash,
      byteLength: manifestByteLength,
    }),
    attestation: observationV2({
      inode: 108,
      objectKind: "ordinary_file",
      mode: "0444",
      linkCount: 1,
      contentHash: attestationFileContentHash,
      byteLength: attestationByteLength,
    }),
  };
  const filesystemMechanics = {
    capability: "darwin_descriptor_relative_content_store_fixture_v2" as const,
    productionAuthority: false as const,
    publicationBackend: "darwin_native_descriptor_relative_no_replace_fixture_v2" as const,
    contentLeasePolicy:
      "descriptor_relative_lockf_exclusive_manifest_payload_hash_lease_v2" as const,
    attestationLeasePolicy:
      "descriptor_relative_lockf_exclusive_attestation_hash_lease_v2" as const,
    conditionalUnlinkPolicy:
      "preserve_unless_exact_identity_revalidated_no_same_uid_atomic_unlink_v2" as const,
    exactCleanupPolicy:
      "descriptor_relative_known_shape_non_recursive_fail_closed_v2" as const,
    staleLeaseRecoveryPolicy:
      "unauthenticated_fixture_exact_inode_and_f_tlock_only_v2" as const,
    contentLeaseRecovered: false as const,
    attestationLeaseRecovered: false as const,
    unauthenticatedStaleLeaseRecoveryEnabled: true as const,
    authenticatedLeaseLedgerPresent: false as const,
    sameUidAtomicConditionalUnlinkAvailable: false as const,
    fixtureBuildRecipeHash: sha("fixture-recipe-v2"),
    fixtureBinaryHash: sha("fixture-binary-v2"),
    fixtureBinaryByteLength: 4096,
  };
  const freshReproductionIdentity = {
    outcome: "exact_manifest_and_attestation_reproduced" as const,
    manifestPayloadHash,
    attestationHash,
    manifestFileContentHash,
    attestationFileContentHash,
    manifestByteLength,
    attestationByteLength,
  };
  const identity = {
    schema: PLATFORM_RELEASE_CONTENT_STORE_TEST_V2_SCHEMA,
    version: "2.0.0" as const,
    authorityState: "test_fixture_content_store_unverified" as const,
    admissionScope: "test_fixture" as const,
    productionAuthority: false as const,
    productionAdmission: "forbidden" as const,
    credentialUse: "none" as const,
    signingAuthority: "unsigned_test_fixture" as const,
    mutationAuthority: false as const,
    operationMode: "test_fixture_publication_only" as const,
    trustConclusion: "characterization_only" as const,
    productionBlockers: [
      "production_store_bootstrap_absent",
      "authenticated_release_lease_absent",
      "atomic_conditional_unlink_absent",
      "crash_replay_ledger_absent",
      "runtime_payload_unbound",
      "fresh_production_verifier_absent",
    ] as const,
    implementationScope: "test_fixture_private_release_store_v2" as const,
    payloadBinding: "test_fixture_manifest_attestation_bytes_only_v2" as const,
    layout: "private_store_dot_staging_dot_locks_releases_attestations_v2" as const,
    snapshotScope: "single_release_single_attestation_fixture_snapshot_v2" as const,
    ephemeralLockPolicy: "ephemeral_lock_lease_excluded_from_stable_receipt_v2" as const,
    challengeHash: sha("challenge-v2"),
    manifestPayloadHash,
    attestationHash,
    releaseContentHash: manifestPayloadHash,
    manifestFileContentHash,
    attestationFileContentHash,
    manifestByteLength,
    attestationByteLength,
    publication: "published" as const,
    filesystemMechanics,
    nativePublicationHash: hashPlatformReleaseContentStoreTestNativePublicationV2(
      filesystemMechanics,
      "published",
      fence,
    ),
    storeMembershipHash: hashPlatformReleaseContentStoreTestMembershipV2(
      manifestPayloadHash,
      attestationHash,
    ),
    releaseMembershipHash: hashPlatformReleaseContentStoreTestReleaseMembershipV2(),
    publishedFence: fence,
    reproducedFence: structuredClone(fence),
    freshReproduction: {
      ...freshReproductionIdentity,
      reproductionHash: hashCanonicalJson({
        schema: `${PLATFORM_RELEASE_CONTENT_STORE_TEST_V2_SCHEMA}.fresh-reproduction.v2`,
        reproduction: freshReproductionIdentity,
      }),
    },
  };
  return PlatformReleaseContentStoreTestV2Schema.parse({
    ...identity,
    storeHash: hashPlatformReleaseContentStoreTestV2(identity),
  });
}

describe("platform release content-store test-only preflight and leaf receipt v3", () => {
  it("binds an append-only baseline/candidate delta and the complete published census", () => {
    const fixture = buildV3Fixture();

    assert.equal(fixture.preflight.productionAuthority, false);
    assert.equal(fixture.preflight.productionAdmission, "forbidden");
    assert.equal(fixture.preflight.mutationAuthority, false);
    assert.deepEqual(
      fixture.preflight.productionBlockers,
      PLATFORM_RELEASE_CONTENT_STORE_TEST_V3_PRODUCTION_BLOCKERS,
    );
    assert.equal(fixture.preflight.disposition, "append_candidate_delta");
    assert.deepEqual(fixture.preflight.delta, {
      addedReleaseCount: 1,
      addedAttestationCount: 1,
      addedContentBytes: 518,
      deltaHash: fixture.preflight.delta.deltaHash,
    });
    assert.equal(
      fixture.preflight.expectedFinalCensusHash,
      fixture.candidateFinalCensus.censusHash,
    );
    assert.equal(fixture.receipt.productionAuthority, false);
    assert.equal(fixture.receipt.publishedCensusHash, fixture.receipt.publishedCensus.censusHash);
    assert.deepEqual(fixture.receipt.publishedCensus, fixture.candidateFinalCensus);
    assert.equal(fixture.receipt.leaf.candidateHash, fixture.candidate.candidateHash);
    assert.equal(Object.isFrozen(fixture.preflight), true);
    assert.equal(Object.isFrozen(fixture.preflight.candidateFinalCensus), true);
    assert.equal(Object.isFrozen(fixture.receipt.publishedCensus.releaseEntries), true);
  });

  it("rejects a locally valid receipt whose publication or hash does not join its preflight", () => {
    const { preflight, receipt } = buildV3Fixture();
    assert.equal(
      assertPlatformReleaseContentStoreLeafReceiptJoinsPreflightTestV3(
        preflight,
        receipt,
      ).receiptHash,
      receipt.receiptHash,
    );

    const wrongPublication = structuredClone(receipt);
    wrongPublication.publication = "adopted_identical";
    const admittedWrongPublication = rehashReceipt(wrongPublication);
    assert.throws(
      () => assertPlatformReleaseContentStoreLeafReceiptJoinsPreflightTestV3(
        preflight,
        admittedWrongPublication,
      ),
      /PREFLIGHT_RECEIPT_JOIN_MISMATCH/u,
    );

    const wrongPreflightHash = structuredClone(receipt);
    wrongPreflightHash.preflightHash = sha("different-valid-preflight");
    const admittedWrongPreflightHash = rehashReceipt(wrongPreflightHash);
    assert.throws(
      () => assertPlatformReleaseContentStoreLeafReceiptJoinsPreflightTestV3(
        preflight,
        admittedWrongPreflightHash,
      ),
      /PREFLIGHT_RECEIPT_JOIN_MISMATCH/u,
    );
  });

  it("rejects blocker reorder, deletion and addition even after outer hashes are recomputed", () => {
    const { preflight } = buildV3Fixture();
    for (const mutation of [
      (blockers: string[]) => blockers.splice(0, 2, blockers[1]!, blockers[0]!),
      (blockers: string[]) => blockers.splice(4, 1),
      (blockers: string[]) => blockers.push("fresh_production_verifier_absent"),
    ]) {
      const forged = structuredClone(preflight);
      mutation(forged.productionBlockers as string[]);
      assert.throws(
        () => parsePlatformReleaseContentStorePublisherPreflightTestCandidateV3(
          rehashPreflight(forged),
        ),
      );
    }
  });

  it("rejects semantic delta and expected-final-census forgeries with valid local hashes", () => {
    const { preflight } = buildV3Fixture();
    const deltaForgery = structuredClone(preflight);
    deltaForgery.delta.addedContentBytes -= 1;
    const { deltaHash: _deltaHash, ...deltaIdentity } = deltaForgery.delta;
    deltaForgery.delta.deltaHash = hashPlatformReleaseContentStoreCandidateDeltaTestV3(
      deltaIdentity,
    );
    assert.throws(
      () => parsePlatformReleaseContentStorePublisherPreflightTestCandidateV3(
        rehashPreflight(deltaForgery),
      ),
    );

    const censusHashForgery = structuredClone(preflight);
    censusHashForgery.expectedFinalCensusHash = sha("forged-final-census");
    assert.throws(
      () => parsePlatformReleaseContentStorePublisherPreflightTestCandidateV3(
        rehashPreflight(censusHashForgery),
      ),
    );
  });

  it("rejects V2/V3 cross parsing in both directions", () => {
    const fixture = buildV3Fixture();
    const receiptV2 = buildValidV2Receipt();
    assert.equal(PlatformReleaseContentStoreTestV2Schema.safeParse(receiptV2).success, true);

    assert.equal(
      PlatformReleaseContentStoreTestV2Schema.safeParse(fixture.preflight).success,
      false,
    );
    assert.equal(
      PlatformReleaseContentStoreTestV2Schema.safeParse(fixture.receipt).success,
      false,
    );
    assert.throws(() => parsePlatformReleaseContentStoreTestCandidateV2(fixture.receipt));

    assert.equal(
      PlatformReleaseContentStorePublisherPreflightTestV3Schema.safeParse(receiptV2).success,
      false,
    );
    assert.equal(
      PlatformReleaseContentStoreLeafReceiptTestV3Schema.safeParse(receiptV2).success,
      false,
    );
    assert.throws(
      () => parsePlatformReleaseContentStorePublisherPreflightTestCandidateV3(receiptV2),
    );
    assert.throws(
      () => parsePlatformReleaseContentStoreLeafReceiptTestCandidateV3(receiptV2),
    );
  });

  it("rejects unknown fields and receipt leaf/census membership forgeries", () => {
    const { preflight, receipt } = buildV3Fixture();
    assert.equal(
      PlatformReleaseContentStorePublisherPreflightTestV3Schema.safeParse({
        ...preflight,
        unexpectedAuthority: true,
      }).success,
      false,
    );

    const forgedReceipt = structuredClone(receipt);
    forgedReceipt.leaf.manifestFileContentHash = sha("different-manifest-file");
    const { candidateHash: _candidateHash, ...candidateIdentity } = forgedReceipt.leaf;
    forgedReceipt.leaf.candidateHash = hashPlatformReleaseContentStoreCandidateTestV3(
      candidateIdentity,
    );
    const { receiptHash: _receiptHash, ...receiptIdentity } = forgedReceipt;
    forgedReceipt.receiptHash = hashPlatformReleaseContentStoreLeafReceiptTestV3(
      receiptIdentity,
    );
    assert.throws(
      () => parsePlatformReleaseContentStoreLeafReceiptTestCandidateV3(forgedReceipt),
    );
  });
});
