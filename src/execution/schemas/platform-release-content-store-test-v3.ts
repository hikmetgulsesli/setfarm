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
import {
  PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_MAX_FILE_BYTES_V3,
  PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_V3_VERSION,
  PlatformReleaseContentStoreGlobalCensusV3Schema,
  assertPlatformReleaseContentStoreAppendOnlySupersetV3,
  type PlatformReleaseContentStoreGlobalCensusV3,
} from "./platform-release-content-store-census-v3.js";

export const PLATFORM_RELEASE_CONTENT_STORE_PUBLISHER_PREFLIGHT_TEST_V3_SCHEMA =
  "setfarm.platform-release-content-store-publisher-preflight-test.v3" as const;
export const PLATFORM_RELEASE_CONTENT_STORE_PUBLISHER_PREFLIGHT_TEST_HASH_V3_SCHEMA =
  "setfarm.platform-release-content-store-publisher-preflight-test-hash.v3" as const;
export const PLATFORM_RELEASE_CONTENT_STORE_CANDIDATE_TEST_HASH_V3_SCHEMA =
  "setfarm.platform-release-content-store-candidate-test-hash.v3" as const;
export const PLATFORM_RELEASE_CONTENT_STORE_CANDIDATE_DELTA_TEST_HASH_V3_SCHEMA =
  "setfarm.platform-release-content-store-candidate-delta-test-hash.v3" as const;
export const PLATFORM_RELEASE_CONTENT_STORE_LEAF_RECEIPT_TEST_V3_SCHEMA =
  "setfarm.platform-release-content-store-leaf-receipt-test.v3" as const;
export const PLATFORM_RELEASE_CONTENT_STORE_LEAF_RECEIPT_TEST_HASH_V3_SCHEMA =
  "setfarm.platform-release-content-store-leaf-receipt-test-hash.v3" as const;
export const PLATFORM_RELEASE_CONTENT_STORE_TEST_MAX_CANONICAL_BYTES_V3 =
  32 * 1024 * 1024;
export const PLATFORM_RELEASE_CONTENT_STORE_TEST_MAX_FILE_BYTES_V3 =
  PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_MAX_FILE_BYTES_V3;

export const PLATFORM_RELEASE_CONTENT_STORE_TEST_V3_PRODUCTION_BLOCKERS = Object.freeze([
  "production_store_bootstrap_absent",
  "authenticated_content_lease_absent",
  "authenticated_attestation_lease_absent",
  "authenticated_global_census_absent",
  "production_publisher_preflight_absent",
  "atomic_conditional_unlink_absent",
  "crash_replay_ledger_absent",
  "durable_release_store_records_absent",
  "whole_content_root_atomic_rename_absent",
  "authenticated_restart_rejoin_absent",
  "canonical_release_payload_layout_absent",
  "b5d_composer_bridge_absent",
  "runtime_payload_unbound",
  "fresh_production_verifier_absent",
] as const);

const ProductionBlockersV3Schema = z.tuple([
  z.literal(PLATFORM_RELEASE_CONTENT_STORE_TEST_V3_PRODUCTION_BLOCKERS[0]),
  z.literal(PLATFORM_RELEASE_CONTENT_STORE_TEST_V3_PRODUCTION_BLOCKERS[1]),
  z.literal(PLATFORM_RELEASE_CONTENT_STORE_TEST_V3_PRODUCTION_BLOCKERS[2]),
  z.literal(PLATFORM_RELEASE_CONTENT_STORE_TEST_V3_PRODUCTION_BLOCKERS[3]),
  z.literal(PLATFORM_RELEASE_CONTENT_STORE_TEST_V3_PRODUCTION_BLOCKERS[4]),
  z.literal(PLATFORM_RELEASE_CONTENT_STORE_TEST_V3_PRODUCTION_BLOCKERS[5]),
  z.literal(PLATFORM_RELEASE_CONTENT_STORE_TEST_V3_PRODUCTION_BLOCKERS[6]),
  z.literal(PLATFORM_RELEASE_CONTENT_STORE_TEST_V3_PRODUCTION_BLOCKERS[7]),
  z.literal(PLATFORM_RELEASE_CONTENT_STORE_TEST_V3_PRODUCTION_BLOCKERS[8]),
  z.literal(PLATFORM_RELEASE_CONTENT_STORE_TEST_V3_PRODUCTION_BLOCKERS[9]),
  z.literal(PLATFORM_RELEASE_CONTENT_STORE_TEST_V3_PRODUCTION_BLOCKERS[10]),
  z.literal(PLATFORM_RELEASE_CONTENT_STORE_TEST_V3_PRODUCTION_BLOCKERS[11]),
  z.literal(PLATFORM_RELEASE_CONTENT_STORE_TEST_V3_PRODUCTION_BLOCKERS[12]),
  z.literal(PLATFORM_RELEASE_CONTENT_STORE_TEST_V3_PRODUCTION_BLOCKERS[13]),
]);

const TestOnlyAuthorityV3Shape = {
  version: z.literal(PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_V3_VERSION),
  admissionScope: z.literal("test_fixture"),
  productionAuthority: z.literal(false),
  productionAdmission: z.literal("forbidden"),
  credentialUse: z.literal("none"),
  signingAuthority: z.literal("unsigned_test_fixture"),
  mutationAuthority: z.literal(false),
  trustConclusion: z.literal("characterization_only"),
  productionBlockers: ProductionBlockersV3Schema,
} as const;

const CandidateIdentityV3Schema = z.object({
  manifestPayloadHash: Sha256Schema,
  attestationHash: Sha256Schema,
  releaseContentHash: Sha256Schema,
  manifestFileContentHash: Sha256Schema,
  attestationFileContentHash: Sha256Schema,
  manifestByteLength: z.number().int().positive().safe()
    .max(PLATFORM_RELEASE_CONTENT_STORE_TEST_MAX_FILE_BYTES_V3),
  attestationByteLength: z.number().int().positive().safe()
    .max(PLATFORM_RELEASE_CONTENT_STORE_TEST_MAX_FILE_BYTES_V3),
}).strict();

export type PlatformReleaseContentStoreCandidateTestHashPayloadV3 =
  z.infer<typeof CandidateIdentityV3Schema>;

export function hashPlatformReleaseContentStoreCandidateTestV3(
  value: PlatformReleaseContentStoreCandidateTestHashPayloadV3,
): string {
  return hashCanonicalJson({
    schema: PLATFORM_RELEASE_CONTENT_STORE_CANDIDATE_TEST_HASH_V3_SCHEMA,
    candidate: value,
  });
}

const CandidateV3Schema = CandidateIdentityV3Schema.extend({
  candidateHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  const { candidateHash: _candidateHash, ...identity } = value;
  if (value.candidateHash !== hashPlatformReleaseContentStoreCandidateTestV3(identity)) {
    context.addIssue({
      code: "custom",
      path: ["candidateHash"],
      message: "Content-store candidate hash mismatch",
    });
  }
  if (value.releaseContentHash !== value.manifestPayloadHash) {
    context.addIssue({
      code: "custom",
      path: ["releaseContentHash"],
      message: "Release content hash must equal the manifest payload hash",
    });
  }
});

const CandidateDeltaIdentityV3Schema = z.object({
  addedReleaseCount: z.number().int().min(0).max(1),
  addedAttestationCount: z.number().int().min(0).max(1),
  addedContentBytes: z.number().int().nonnegative().safe()
    .max(PLATFORM_RELEASE_CONTENT_STORE_TEST_MAX_FILE_BYTES_V3 * 2),
}).strict();

export type PlatformReleaseContentStoreCandidateDeltaTestHashPayloadV3 =
  z.infer<typeof CandidateDeltaIdentityV3Schema>;

export function hashPlatformReleaseContentStoreCandidateDeltaTestV3(
  value: PlatformReleaseContentStoreCandidateDeltaTestHashPayloadV3,
): string {
  return hashCanonicalJson({
    schema: PLATFORM_RELEASE_CONTENT_STORE_CANDIDATE_DELTA_TEST_HASH_V3_SCHEMA,
    delta: value,
  });
}

const CandidateDeltaV3Schema = CandidateDeltaIdentityV3Schema.extend({
  deltaHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  const { deltaHash: _deltaHash, ...identity } = value;
  if (value.deltaHash !== hashPlatformReleaseContentStoreCandidateDeltaTestV3(identity)) {
    context.addIssue({
      code: "custom",
      path: ["deltaHash"],
      message: "Content-store candidate delta hash mismatch",
    });
  }
});

const PublisherPreflightIdentityV3Schema = z.object({
  schema: z.literal(PLATFORM_RELEASE_CONTENT_STORE_PUBLISHER_PREFLIGHT_TEST_V3_SCHEMA),
  ...TestOnlyAuthorityV3Shape,
  authorityState: z.literal("test_fixture_publisher_preflight_unverified"),
  operationMode: z.literal("test_fixture_preflight_only"),
  baselineCensus: PlatformReleaseContentStoreGlobalCensusV3Schema,
  candidateFinalCensus: PlatformReleaseContentStoreGlobalCensusV3Schema,
  candidate: CandidateV3Schema,
  disposition: z.enum(["append_candidate_delta", "adopt_identical_candidate"]),
  delta: CandidateDeltaV3Schema,
  expectedFinalCensusHash: Sha256Schema,
}).strict();

export type PlatformReleaseContentStorePublisherPreflightTestHashPayloadV3 =
  z.infer<typeof PublisherPreflightIdentityV3Schema>;

export function hashPlatformReleaseContentStorePublisherPreflightTestV3(
  value: PlatformReleaseContentStorePublisherPreflightTestHashPayloadV3,
): string {
  return hashCanonicalJson({
    schema: PLATFORM_RELEASE_CONTENT_STORE_PUBLISHER_PREFLIGHT_TEST_HASH_V3_SCHEMA,
    preflight: value,
  });
}

function findCandidateRelease(
  census: PlatformReleaseContentStoreGlobalCensusV3,
  manifestPayloadHash: string,
) {
  return census.releaseEntries.find(
    (entry) => entry.manifestPayloadHash === manifestPayloadHash,
  );
}

function findCandidateAttestation(
  census: PlatformReleaseContentStoreGlobalCensusV3,
  attestationHash: string,
) {
  return census.attestationEntries.find(
    (entry) => entry.attestationHash === attestationHash,
  );
}

function addCandidateMembershipIssues(
  candidate: z.infer<typeof CandidateV3Schema>,
  census: PlatformReleaseContentStoreGlobalCensusV3,
  context: z.RefinementCtx,
  censusPath: string,
): void {
  const release = findCandidateRelease(census, candidate.manifestPayloadHash);
  if (!release) {
    context.addIssue({
      code: "custom",
      path: [censusPath, "releaseEntries"],
      message: "Candidate release is absent from the full census",
    });
  } else if (
    release.manifest.mutableFingerprint.contentHash !== candidate.manifestFileContentHash
      || release.manifest.mutableFingerprint.byteLength !== candidate.manifestByteLength
  ) {
    context.addIssue({
      code: "custom",
      path: [censusPath, "releaseEntries"],
      message: "Candidate manifest bytes do not match the full census leaf",
    });
  }

  const attestation = findCandidateAttestation(census, candidate.attestationHash);
  if (!attestation) {
    context.addIssue({
      code: "custom",
      path: [censusPath, "attestationEntries"],
      message: "Candidate attestation is absent from the full census",
    });
  } else if (
    attestation.releaseContentHash !== candidate.releaseContentHash
      || attestation.attestation.mutableFingerprint.contentHash
        !== candidate.attestationFileContentHash
      || attestation.attestation.mutableFingerprint.byteLength
        !== candidate.attestationByteLength
  ) {
    context.addIssue({
      code: "custom",
      path: [censusPath, "attestationEntries"],
      message: "Candidate attestation bytes or release binding do not match the full census leaf",
    });
  }
}

export const PlatformReleaseContentStorePublisherPreflightTestV3Schema =
  PublisherPreflightIdentityV3Schema.extend({
    preflightHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const { preflightHash: _preflightHash, ...identity } = value;
    if (
      value.preflightHash
        !== hashPlatformReleaseContentStorePublisherPreflightTestV3(identity)
    ) {
      context.addIssue({
        code: "custom",
        path: ["preflightHash"],
        message: "Content-store publisher preflight hash mismatch",
      });
    }

    if (value.expectedFinalCensusHash !== value.candidateFinalCensus.censusHash) {
      context.addIssue({
        code: "custom",
        path: ["expectedFinalCensusHash"],
        message: "Expected final census hash must bind the complete candidate census",
      });
    }

    if (value.baselineCensus.hostIdentityHash !== value.candidateFinalCensus.hostIdentityHash) {
      context.addIssue({
        code: "custom",
        path: ["candidateFinalCensus", "hostIdentityHash"],
        message: "Baseline and candidate censuses must join one host identity",
      });
    }

    try {
      assertPlatformReleaseContentStoreAppendOnlySupersetV3(
        value.baselineCensus,
        value.candidateFinalCensus,
      );
    } catch {
      context.addIssue({
        code: "custom",
        path: ["candidateFinalCensus"],
        message: "Candidate census must be an append-only superset of the baseline census",
      });
    }

    addCandidateMembershipIssues(
      value.candidate,
      value.candidateFinalCensus,
      context,
      "candidateFinalCensus",
    );

    const expectedReleaseDelta =
      value.candidateFinalCensus.releaseCount - value.baselineCensus.releaseCount;
    const expectedAttestationDelta =
      value.candidateFinalCensus.attestationCount - value.baselineCensus.attestationCount;
    const expectedContentDelta =
      value.candidateFinalCensus.totalContentBytes - value.baselineCensus.totalContentBytes;
    if (
      value.delta.addedReleaseCount !== expectedReleaseDelta
        || value.delta.addedAttestationCount !== expectedAttestationDelta
        || value.delta.addedContentBytes !== expectedContentDelta
    ) {
      context.addIssue({
        code: "custom",
        path: ["delta"],
        message: "Candidate delta must equal the exact baseline-to-final census delta",
      });
    }

    const expectedCandidateBytes =
      value.delta.addedReleaseCount * value.candidate.manifestByteLength
      + value.delta.addedAttestationCount * value.candidate.attestationByteLength;
    if (value.delta.addedContentBytes !== expectedCandidateBytes) {
      context.addIssue({
        code: "custom",
        path: ["delta", "addedContentBytes"],
        message: "Candidate content-byte delta must describe only the admitted leaf",
      });
    }

    const baselineRelease = findCandidateRelease(
      value.baselineCensus,
      value.candidate.manifestPayloadHash,
    );
    const baselineAttestation = findCandidateAttestation(
      value.baselineCensus,
      value.candidate.attestationHash,
    );
    if (
      Number(baselineRelease === undefined) !== value.delta.addedReleaseCount
        || Number(baselineAttestation === undefined) !== value.delta.addedAttestationCount
    ) {
      context.addIssue({
        code: "custom",
        path: ["delta"],
        message: "Candidate delta must distinguish new leaves from identical adoption",
      });
    }

    if (baselineRelease) {
      const finalRelease = findCandidateRelease(
        value.candidateFinalCensus,
        value.candidate.manifestPayloadHash,
      );
      if (
        !finalRelease
          || canonicalJsonStringify(baselineRelease)
            !== canonicalJsonStringify(finalRelease)
      ) {
        context.addIssue({
          code: "custom",
          path: ["candidateFinalCensus", "releaseEntries"],
          message: "An adopted release leaf must remain byte-for-byte identical",
        });
      }
    }
    if (baselineAttestation) {
      const finalAttestation = findCandidateAttestation(
        value.candidateFinalCensus,
        value.candidate.attestationHash,
      );
      if (
        !finalAttestation
          || canonicalJsonStringify(baselineAttestation)
            !== canonicalJsonStringify(finalAttestation)
      ) {
        context.addIssue({
          code: "custom",
          path: ["candidateFinalCensus", "attestationEntries"],
          message: "An adopted attestation leaf must remain byte-for-byte identical",
        });
      }
    }

    const hasDelta = value.delta.addedReleaseCount + value.delta.addedAttestationCount > 0;
    const expectedDisposition = hasDelta
      ? "append_candidate_delta"
      : "adopt_identical_candidate";
    if (value.disposition !== expectedDisposition) {
      context.addIssue({
        code: "custom",
        path: ["disposition"],
        message: "Publisher disposition does not match the authenticated census delta",
      });
    }

    if (
      !platformReleaseCandidateFitsCanonicalCapV2(
        value,
        PLATFORM_RELEASE_CONTENT_STORE_TEST_MAX_CANONICAL_BYTES_V3,
      )
    ) {
      context.addIssue({
        code: "custom",
        message: "Content-store publisher preflight exceeds its canonical byte cap",
      });
    }
  });

export type PlatformReleaseContentStorePublisherPreflightTestV3 = z.infer<
  typeof PlatformReleaseContentStorePublisherPreflightTestV3Schema
>;

export function parsePlatformReleaseContentStorePublisherPreflightTestCandidateV3(
  input: unknown,
): PlatformReleaseContentStorePublisherPreflightTestV3 {
  const snapshot = boundedPlatformReleaseJsonSnapshotV2(
    input,
    PLATFORM_RELEASE_CONTENT_STORE_TEST_MAX_CANONICAL_BYTES_V3,
  );
  return deepFreezePlatformReleaseJsonV2(
    PlatformReleaseContentStorePublisherPreflightTestV3Schema.parse(snapshot),
  );
}

const LeafReceiptIdentityV3Schema = z.object({
  schema: z.literal(PLATFORM_RELEASE_CONTENT_STORE_LEAF_RECEIPT_TEST_V3_SCHEMA),
  ...TestOnlyAuthorityV3Shape,
  authorityState: z.literal("test_fixture_leaf_publication_unverified"),
  operationMode: z.literal("test_fixture_leaf_receipt_only"),
  publication: z.enum(["published", "adopted_identical"]),
  preflightHash: Sha256Schema,
  leaf: CandidateV3Schema,
  publishedCensus: PlatformReleaseContentStoreGlobalCensusV3Schema,
  publishedCensusHash: Sha256Schema,
}).strict();

export type PlatformReleaseContentStoreLeafReceiptTestHashPayloadV3 =
  z.infer<typeof LeafReceiptIdentityV3Schema>;

export function hashPlatformReleaseContentStoreLeafReceiptTestV3(
  value: PlatformReleaseContentStoreLeafReceiptTestHashPayloadV3,
): string {
  return hashCanonicalJson({
    schema: PLATFORM_RELEASE_CONTENT_STORE_LEAF_RECEIPT_TEST_HASH_V3_SCHEMA,
    receipt: value,
  });
}

export const PlatformReleaseContentStoreLeafReceiptTestV3Schema =
  LeafReceiptIdentityV3Schema.extend({
    receiptHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const { receiptHash: _receiptHash, ...identity } = value;
    if (
      value.receiptHash !== hashPlatformReleaseContentStoreLeafReceiptTestV3(identity)
    ) {
      context.addIssue({
        code: "custom",
        path: ["receiptHash"],
        message: "Content-store leaf receipt hash mismatch",
      });
    }
    if (value.publishedCensusHash !== value.publishedCensus.censusHash) {
      context.addIssue({
        code: "custom",
        path: ["publishedCensusHash"],
        message: "Leaf receipt must bind the complete published census",
      });
    }
    addCandidateMembershipIssues(
      value.leaf,
      value.publishedCensus,
      context,
      "publishedCensus",
    );
    if (
      !platformReleaseCandidateFitsCanonicalCapV2(
        value,
        PLATFORM_RELEASE_CONTENT_STORE_TEST_MAX_CANONICAL_BYTES_V3,
      )
    ) {
      context.addIssue({
        code: "custom",
        message: "Content-store leaf receipt exceeds its canonical byte cap",
      });
    }
  });

export type PlatformReleaseContentStoreLeafReceiptTestV3 = z.infer<
  typeof PlatformReleaseContentStoreLeafReceiptTestV3Schema
>;

export function parsePlatformReleaseContentStoreLeafReceiptTestCandidateV3(
  input: unknown,
): PlatformReleaseContentStoreLeafReceiptTestV3 {
  const snapshot = boundedPlatformReleaseJsonSnapshotV2(
    input,
    PLATFORM_RELEASE_CONTENT_STORE_TEST_MAX_CANONICAL_BYTES_V3,
  );
  return deepFreezePlatformReleaseJsonV2(
    PlatformReleaseContentStoreLeafReceiptTestV3Schema.parse(snapshot),
  );
}

function productionBlockersForPlatformReleaseContentStoreTestV3():
  [...typeof PLATFORM_RELEASE_CONTENT_STORE_TEST_V3_PRODUCTION_BLOCKERS] {
  return [...PLATFORM_RELEASE_CONTENT_STORE_TEST_V3_PRODUCTION_BLOCKERS];
}

export function assertPlatformReleaseContentStoreLeafReceiptJoinsPreflightTestV3(
  preflightInput: unknown,
  receiptInput: unknown,
): PlatformReleaseContentStoreLeafReceiptTestV3 {
  const preflight =
    parsePlatformReleaseContentStorePublisherPreflightTestCandidateV3(
      preflightInput,
    );
  const receipt = parsePlatformReleaseContentStoreLeafReceiptTestCandidateV3(
    receiptInput,
  );
  const expectedPublication = preflight.disposition === "append_candidate_delta"
    ? "published"
    : "adopted_identical";
  if (
    receipt.preflightHash !== preflight.preflightHash
    || receipt.publication !== expectedPublication
    || canonicalJsonStringify(receipt.leaf)
      !== canonicalJsonStringify(preflight.candidate)
    || receipt.publishedCensusHash !== preflight.expectedFinalCensusHash
    || canonicalJsonStringify(receipt.publishedCensus)
      !== canonicalJsonStringify(preflight.candidateFinalCensus)
  ) {
    throw new TypeError(
      "CONTENT_STORE_PREFLIGHT_RECEIPT_JOIN_MISMATCH: receipt does not exactly reproduce its preflight",
    );
  }
  return receipt;
}

export function buildPlatformReleaseContentStoreLeafReceiptFromPreflightTestV3(
  preflightInput: unknown,
): PlatformReleaseContentStoreLeafReceiptTestV3 {
  const preflight =
    parsePlatformReleaseContentStorePublisherPreflightTestCandidateV3(
      preflightInput,
    );
  const identity: PlatformReleaseContentStoreLeafReceiptTestHashPayloadV3 = {
    schema: PLATFORM_RELEASE_CONTENT_STORE_LEAF_RECEIPT_TEST_V3_SCHEMA,
    version: PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_V3_VERSION,
    admissionScope: "test_fixture",
    productionAuthority: false,
    productionAdmission: "forbidden",
    credentialUse: "none",
    signingAuthority: "unsigned_test_fixture",
    mutationAuthority: false,
    trustConclusion: "characterization_only",
    productionBlockers:
      productionBlockersForPlatformReleaseContentStoreTestV3(),
    authorityState: "test_fixture_leaf_publication_unverified",
    operationMode: "test_fixture_leaf_receipt_only",
    publication: preflight.disposition === "append_candidate_delta"
      ? "published"
      : "adopted_identical",
    preflightHash: preflight.preflightHash,
    leaf: preflight.candidate,
    publishedCensus: preflight.candidateFinalCensus,
    publishedCensusHash: preflight.expectedFinalCensusHash,
  };
  const receipt = parsePlatformReleaseContentStoreLeafReceiptTestCandidateV3({
    ...identity,
    receiptHash: hashPlatformReleaseContentStoreLeafReceiptTestV3(identity),
  });
  return assertPlatformReleaseContentStoreLeafReceiptJoinsPreflightTestV3(
    preflight,
    receipt,
  );
}
