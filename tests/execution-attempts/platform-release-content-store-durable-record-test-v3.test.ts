import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";

import {
  PLATFORM_RELEASE_CONTENT_STORE_DURABLE_RECORD_TEST_MAX_CANONICAL_BYTES_V3,
  PLATFORM_RELEASE_CONTENT_STORE_DURABLE_RECORD_TEST_V3_REMAINING_PRODUCTION_BLOCKERS,
  PlatformReleaseContentStoreDurableRecordTestV3Schema,
  buildPlatformReleaseContentStoreDurableRecordTestV3,
  hashPlatformReleaseContentStoreDurableRecordTestV3,
  parsePlatformReleaseContentStoreDurableRecordTestCandidateV3,
  type PlatformReleaseContentStoreDurableRecordTestV3,
} from "../../src/execution/schemas/platform-release-content-store-durable-record-test-v3.js";
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
  buildPlatformReleaseContentStoreLeafReceiptFromPreflightTestV3,
  hashPlatformReleaseContentStoreCandidateDeltaTestV3,
  hashPlatformReleaseContentStoreCandidateTestV3,
  hashPlatformReleaseContentStoreLeafReceiptTestV3,
  hashPlatformReleaseContentStorePublisherPreflightTestV3,
  parsePlatformReleaseContentStorePublisherPreflightTestCandidateV3,
  type PlatformReleaseContentStoreLeafReceiptTestV3,
  type PlatformReleaseContentStorePublisherPreflightTestHashPayloadV3,
} from "../../src/execution/schemas/platform-release-content-store-test-v3.js";

function sha(label: string): string {
  return createHash("sha256").update(label).digest("hex");
}

function productionBlockers():
  [...typeof PLATFORM_RELEASE_CONTENT_STORE_TEST_V3_PRODUCTION_BLOCKERS] {
  return [...PLATFORM_RELEASE_CONTENT_STORE_TEST_V3_PRODUCTION_BLOCKERS];
}

function observation(input: Readonly<{
  inode: number;
  objectKind: "directory" | "ordinary_file";
  mode: string;
  contentHash: string;
  byteLength: number;
  linkCount?: number;
}>): PlatformReleaseContentStoreObservationV3 {
  return buildPlatformReleaseContentStoreObservationV3({
    stableIdentity: {
      hostIdentityHash: sha("durable-record-host-v3"),
      objectKind: input.objectKind,
      device: "73",
      inode: String(input.inode),
    },
    mutableFingerprint: {
      ownerUid: 501,
      ownerGid: 20,
      mode: input.mode,
      linkCount: input.linkCount ?? 2,
      byteLength: input.byteLength,
      contentHash: input.contentHash,
      modifiedTimeNanoseconds: "3000000001",
      changedTimeNanoseconds: "3000000002",
    },
  });
}

function directoryObservation(input: Readonly<{
  inode: number;
  mode: "0700" | "0555";
  role: Parameters<
    typeof buildPlatformReleaseContentStoreDirectoryMembershipFingerprintV3
  >[0];
  entryNames: readonly string[];
}>): PlatformReleaseContentStoreObservationV3 {
  const membership =
    buildPlatformReleaseContentStoreDirectoryMembershipFingerprintV3(
      input.role,
      input.entryNames,
    );
  return observation({
    inode: input.inode,
    objectKind: "directory",
    mode: input.mode,
    ...membership,
  });
}

function buildFixture(): Readonly<{
  baselineCensus: PlatformReleaseContentStoreGlobalCensusV3;
  finalCensus: PlatformReleaseContentStoreGlobalCensusV3;
  preflight: ReturnType<
    typeof parsePlatformReleaseContentStorePublisherPreflightTestCandidateV3
  >;
  receipt: PlatformReleaseContentStoreLeafReceiptTestV3;
}> {
  const manifestPayloadHash = sha("durable-record-manifest-payload-v3");
  const attestationHash = sha("durable-record-attestation-v3");
  const manifestFileContentHash = sha("durable-record-manifest-file-v3");
  const attestationFileContentHash = sha("durable-record-attestation-file-v3");
  const manifestByteLength = 307;
  const attestationByteLength = 211;
  const persistentAnchors = (
    releaseHashes: readonly string[],
    attestationHashes: readonly string[],
  ) => ({
    storeRoot: directoryObservation({
      inode: 1,
      mode: "0700",
      role: "store_root",
      entryNames: [".locks", ".staging", "attestations", "releases"],
    }),
    locksRoot: directoryObservation({
      inode: 2,
      mode: "0700",
      role: "locks_root",
      entryNames: [],
    }),
    stagingRoot: directoryObservation({
      inode: 3,
      mode: "0700",
      role: "staging_root",
      entryNames: [],
    }),
    releasesRoot: directoryObservation({
      inode: 4,
      mode: "0700",
      role: "releases_root",
      entryNames: [...releaseHashes].sort(),
    }),
    attestationsRoot: directoryObservation({
      inode: 5,
      mode: "0700",
      role: "attestations_root",
      entryNames: attestationHashes.map((hash) => `${hash}.json`).sort(),
    }),
  });
  const baselineCensus = buildPlatformReleaseContentStoreGlobalCensusV3({
    hostIdentityHash: sha("durable-record-host-v3"),
    persistentAnchors: persistentAnchors([], []),
    releaseEntries: [],
    attestationEntries: [],
  });
  const finalCensus = buildPlatformReleaseContentStoreGlobalCensusV3({
    hostIdentityHash: sha("durable-record-host-v3"),
    persistentAnchors: persistentAnchors(
      [manifestPayloadHash],
      [attestationHash],
    ),
    releaseEntries: [{
      manifestPayloadHash,
      releaseRoot: directoryObservation({
        inode: 6,
        mode: "0555",
        role: "release_root",
        entryNames: ["manifest.json"],
      }),
      manifest: observation({
        inode: 7,
        objectKind: "ordinary_file",
        mode: "0444",
        linkCount: 1,
        contentHash: manifestFileContentHash,
        byteLength: manifestByteLength,
      }),
    }],
    attestationEntries: [{
      attestationHash,
      releaseContentHash: manifestPayloadHash,
      attestation: observation({
        inode: 8,
        objectKind: "ordinary_file",
        mode: "0444",
        linkCount: 1,
        contentHash: attestationFileContentHash,
        byteLength: attestationByteLength,
      }),
    }],
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
    candidateHash:
      hashPlatformReleaseContentStoreCandidateTestV3(candidateIdentity),
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
    candidateFinalCensus: finalCensus,
    candidate,
    disposition: "append_candidate_delta",
    delta: {
      ...deltaIdentity,
      deltaHash:
        hashPlatformReleaseContentStoreCandidateDeltaTestV3(deltaIdentity),
    },
    expectedFinalCensusHash: finalCensus.censusHash,
  };
  const preflight =
    parsePlatformReleaseContentStorePublisherPreflightTestCandidateV3({
      ...preflightIdentity,
      preflightHash:
        hashPlatformReleaseContentStorePublisherPreflightTestV3(
          preflightIdentity,
        ),
    });
  return {
    baselineCensus,
    finalCensus,
    preflight,
    receipt:
      buildPlatformReleaseContentStoreLeafReceiptFromPreflightTestV3(preflight),
  };
}

function rehashRecord(
  value: PlatformReleaseContentStoreDurableRecordTestV3,
): unknown {
  const { recordHash: _recordHash, ...identity } = value;
  return {
    ...identity,
    recordHash: hashPlatformReleaseContentStoreDurableRecordTestV3(identity),
  };
}

function buildAdoptedFixture() {
  const fixture = buildFixture();
  const { preflightHash: _preflightHash, ...publishedIdentity } =
    fixture.preflight;
  const zeroDelta = {
    addedReleaseCount: 0,
    addedAttestationCount: 0,
    addedContentBytes: 0,
  };
  const preflightIdentity: PlatformReleaseContentStorePublisherPreflightTestHashPayloadV3 = {
    ...publishedIdentity,
    baselineCensus: fixture.finalCensus,
    disposition: "adopt_identical_candidate",
    delta: {
      ...zeroDelta,
      deltaHash: hashPlatformReleaseContentStoreCandidateDeltaTestV3(zeroDelta),
    },
  };
  const preflight =
    parsePlatformReleaseContentStorePublisherPreflightTestCandidateV3({
      ...preflightIdentity,
      preflightHash:
        hashPlatformReleaseContentStorePublisherPreflightTestV3(
          preflightIdentity,
        ),
    });
  return {
    preflight,
    receipt:
      buildPlatformReleaseContentStoreLeafReceiptFromPreflightTestV3(preflight),
  };
}

describe("platform release content-store durable record wrapper test v3", () => {
  it("builds one frozen false-authority published record with exactly thirteen remaining blockers", () => {
    const fixture = buildFixture();
    const record = buildPlatformReleaseContentStoreDurableRecordTestV3({
      recordOrdinal: 0,
      priorRecordHash: null,
      preflight: fixture.preflight,
      leafReceipt: fixture.receipt,
    });

    assert.equal(record.productionAuthority, false);
    assert.equal(record.productionAdmission, "forbidden");
    assert.equal(record.mutationAuthority, false);
    assert.equal(record.storeAuthority, false);
    assert.equal(record.restartAuthority, false);
    assert.equal(record.preparedPlatformReleaseIssued, false);
    assert.equal(record.serializedValueAuthority, false);
    assert.equal(record.persistenceScope, "exact_database_occurrence_required");
    assert.equal(
      record.closedProductionBlocker,
      "durable_release_store_records_absent",
    );
    assert.deepEqual(
      record.remainingProductionBlockers,
      PLATFORM_RELEASE_CONTENT_STORE_DURABLE_RECORD_TEST_V3_REMAINING_PRODUCTION_BLOCKERS,
    );
    assert.equal(record.remainingProductionBlockers.length, 13);
    assert.equal(
      (record.remainingProductionBlockers as readonly string[]).includes(
        "durable_release_store_records_absent",
      ),
      false,
    );
    assert.deepEqual(
      record.preflight.productionBlockers,
      PLATFORM_RELEASE_CONTENT_STORE_TEST_V3_PRODUCTION_BLOCKERS,
    );
    assert.equal(record.leafReceipt.publication, "published");
    assert.equal(Object.isFrozen(record), true);
    assert.equal(Object.isFrozen(record.preflight), true);
    assert.equal(Object.isFrozen(record.leafReceipt.publishedCensus), true);
    const { recordHash: _recordHash, ...identity } = record;
    assert.equal(
      record.recordHash,
      hashPlatformReleaseContentStoreDurableRecordTestV3(identity),
    );
  });

  it("binds ordinal and prior record hash into the domain-separated identity", () => {
    const fixture = buildFixture();
    const genesis = buildPlatformReleaseContentStoreDurableRecordTestV3({
      recordOrdinal: 0,
      priorRecordHash: null,
      preflight: fixture.preflight,
      leafReceipt: fixture.receipt,
    });
    const successor = buildPlatformReleaseContentStoreDurableRecordTestV3({
      recordOrdinal: 1,
      priorRecordHash: genesis.recordHash,
      preflight: fixture.preflight,
      leafReceipt: fixture.receipt,
    });

    assert.notEqual(successor.recordHash, genesis.recordHash);
    assert.equal(successor.priorRecordHash, genesis.recordHash);
    assert.throws(() => buildPlatformReleaseContentStoreDurableRecordTestV3({
      recordOrdinal: 0,
      priorRecordHash: genesis.recordHash,
      preflight: fixture.preflight,
      leafReceipt: fixture.receipt,
    }), /Only record ordinal zero/u);
    assert.throws(() => buildPlatformReleaseContentStoreDurableRecordTestV3({
      recordOrdinal: 1,
      priorRecordHash: null,
      preflight: fixture.preflight,
      leafReceipt: fixture.receipt,
    }), /Only record ordinal zero/u);
    assert.throws(() => buildPlatformReleaseContentStoreDurableRecordTestV3({
      recordOrdinal: 256,
      priorRecordHash: genesis.recordHash,
      preflight: fixture.preflight,
      leafReceipt: fixture.receipt,
    }));
  });

  it("rejects adopted-identical receipts and locally valid receipts that do not join the preflight", () => {
    const adopted = buildAdoptedFixture();
    assert.equal(adopted.receipt.publication, "adopted_identical");
    assert.throws(() => buildPlatformReleaseContentStoreDurableRecordTestV3({
      recordOrdinal: 0,
      priorRecordHash: null,
      preflight: adopted.preflight,
      leafReceipt: adopted.receipt,
    }), /newly published leaf/u);

    const fixture = buildFixture();
    const forgedReceipt = structuredClone(fixture.receipt);
    forgedReceipt.preflightHash = sha("different-durable-record-preflight-v3");
    const { receiptHash: _receiptHash, ...receiptIdentity } = forgedReceipt;
    forgedReceipt.receiptHash =
      hashPlatformReleaseContentStoreLeafReceiptTestV3(receiptIdentity);
    assert.equal(
      PlatformReleaseContentStoreLeafReceiptTestV3Schema.safeParse(
        forgedReceipt,
      ).success,
      true,
    );
    assert.throws(() => buildPlatformReleaseContentStoreDurableRecordTestV3({
      recordOrdinal: 0,
      priorRecordHash: null,
      preflight: fixture.preflight,
      leafReceipt: forgedReceipt,
    }), /PREFLIGHT_RECEIPT_JOIN_MISMATCH/u);
  });

  it("rejects blocker drift, unknown fields, and a recomputed outer hash over a mismatched join", () => {
    const fixture = buildFixture();
    const record = buildPlatformReleaseContentStoreDurableRecordTestV3({
      recordOrdinal: 0,
      priorRecordHash: null,
      preflight: fixture.preflight,
      leafReceipt: fixture.receipt,
    });
    for (const mutation of [
      (blockers: string[]) => blockers.splice(0, 2, blockers[1]!, blockers[0]!),
      (blockers: string[]) => blockers.splice(4, 1),
      (blockers: string[]) => blockers.push("durable_release_store_records_absent"),
    ]) {
      const forged = structuredClone(record);
      mutation(forged.remainingProductionBlockers as string[]);
      assert.throws(() =>
        parsePlatformReleaseContentStoreDurableRecordTestCandidateV3(
          rehashRecord(forged),
        ));
    }

    assert.equal(
      PlatformReleaseContentStoreDurableRecordTestV3Schema.safeParse({
        ...record,
        unexpectedDatabaseAuthority: true,
      }).success,
      false,
    );
    assert.throws(() =>
      parsePlatformReleaseContentStoreDurableRecordTestCandidateV3({
        ...record,
        recordHash: sha("forged-durable-record-hash-v3"),
      }),
    );
  });

  it("keeps the wrapper language disjoint from its V3 inputs and enforces a bounded canonical parse", () => {
    const fixture = buildFixture();
    const record = buildPlatformReleaseContentStoreDurableRecordTestV3({
      recordOrdinal: 0,
      priorRecordHash: null,
      preflight: fixture.preflight,
      leafReceipt: fixture.receipt,
    });

    assert.equal(
      PlatformReleaseContentStorePublisherPreflightTestV3Schema.safeParse(record)
        .success,
      false,
    );
    assert.equal(
      PlatformReleaseContentStoreLeafReceiptTestV3Schema.safeParse(record).success,
      false,
    );
    assert.equal(
      PlatformReleaseContentStoreDurableRecordTestV3Schema.safeParse(
        fixture.preflight,
      ).success,
      false,
    );
    assert.equal(
      PLATFORM_RELEASE_CONTENT_STORE_DURABLE_RECORD_TEST_MAX_CANONICAL_BYTES_V3,
      65 * 1024 * 1024,
    );
    assert.throws(() =>
      parsePlatformReleaseContentStoreDurableRecordTestCandidateV3({
        ...record,
        oversizedUnknownField: "x".repeat(17 * 1024 * 1024),
      }),
      /Canonical JSON exceeds maximum work/u,
    );
  });
});
