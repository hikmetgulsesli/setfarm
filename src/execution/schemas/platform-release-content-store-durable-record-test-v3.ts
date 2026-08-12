import { z } from "zod";

import { hashCanonicalJson } from "../../product-compiler/canonical-json.js";
import { Sha256Schema } from "../../product-compiler/schemas/common-v1.js";
import {
  boundedPlatformReleaseJsonSnapshotV2,
  deepFreezePlatformReleaseJsonV2,
  platformReleaseCandidateFitsCanonicalCapV2,
} from "./platform-release-common-v2.js";
import {
  PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_V3_VERSION,
} from "./platform-release-content-store-census-v3.js";
import {
  PlatformReleaseContentStoreLeafReceiptTestV3Schema,
  PlatformReleaseContentStorePublisherPreflightTestV3Schema,
  assertPlatformReleaseContentStoreLeafReceiptJoinsPreflightTestV3,
  parsePlatformReleaseContentStorePublisherPreflightTestCandidateV3,
} from "./platform-release-content-store-test-v3.js";

export const PLATFORM_RELEASE_CONTENT_STORE_DURABLE_RECORD_TEST_V3_SCHEMA =
  "setfarm.platform-release-content-store-durable-record-test.v3" as const;
export const PLATFORM_RELEASE_CONTENT_STORE_DURABLE_RECORD_TEST_HASH_V3_SCHEMA =
  "setfarm.platform-release-content-store-durable-record-test-hash.v3" as const;
export const PLATFORM_RELEASE_CONTENT_STORE_DURABLE_RECORD_TEST_MAX_CANONICAL_BYTES_V3 =
  65 * 1024 * 1024;

export const PLATFORM_RELEASE_CONTENT_STORE_DURABLE_RECORD_TEST_V3_REMAINING_PRODUCTION_BLOCKERS =
  Object.freeze([
    "production_store_bootstrap_absent",
    "authenticated_content_lease_absent",
    "authenticated_attestation_lease_absent",
    "authenticated_global_census_absent",
    "production_publisher_preflight_absent",
    "atomic_conditional_unlink_absent",
    "crash_replay_ledger_absent",
    "whole_content_root_atomic_rename_absent",
    "authenticated_restart_rejoin_absent",
    "canonical_release_payload_layout_absent",
    "b5d_composer_bridge_absent",
    "runtime_payload_unbound",
    "fresh_production_verifier_absent",
  ] as const);

const RemainingProductionBlockersV3Schema = z.tuple([
  z.literal(
    PLATFORM_RELEASE_CONTENT_STORE_DURABLE_RECORD_TEST_V3_REMAINING_PRODUCTION_BLOCKERS[0],
  ),
  z.literal(
    PLATFORM_RELEASE_CONTENT_STORE_DURABLE_RECORD_TEST_V3_REMAINING_PRODUCTION_BLOCKERS[1],
  ),
  z.literal(
    PLATFORM_RELEASE_CONTENT_STORE_DURABLE_RECORD_TEST_V3_REMAINING_PRODUCTION_BLOCKERS[2],
  ),
  z.literal(
    PLATFORM_RELEASE_CONTENT_STORE_DURABLE_RECORD_TEST_V3_REMAINING_PRODUCTION_BLOCKERS[3],
  ),
  z.literal(
    PLATFORM_RELEASE_CONTENT_STORE_DURABLE_RECORD_TEST_V3_REMAINING_PRODUCTION_BLOCKERS[4],
  ),
  z.literal(
    PLATFORM_RELEASE_CONTENT_STORE_DURABLE_RECORD_TEST_V3_REMAINING_PRODUCTION_BLOCKERS[5],
  ),
  z.literal(
    PLATFORM_RELEASE_CONTENT_STORE_DURABLE_RECORD_TEST_V3_REMAINING_PRODUCTION_BLOCKERS[6],
  ),
  z.literal(
    PLATFORM_RELEASE_CONTENT_STORE_DURABLE_RECORD_TEST_V3_REMAINING_PRODUCTION_BLOCKERS[7],
  ),
  z.literal(
    PLATFORM_RELEASE_CONTENT_STORE_DURABLE_RECORD_TEST_V3_REMAINING_PRODUCTION_BLOCKERS[8],
  ),
  z.literal(
    PLATFORM_RELEASE_CONTENT_STORE_DURABLE_RECORD_TEST_V3_REMAINING_PRODUCTION_BLOCKERS[9],
  ),
  z.literal(
    PLATFORM_RELEASE_CONTENT_STORE_DURABLE_RECORD_TEST_V3_REMAINING_PRODUCTION_BLOCKERS[10],
  ),
  z.literal(
    PLATFORM_RELEASE_CONTENT_STORE_DURABLE_RECORD_TEST_V3_REMAINING_PRODUCTION_BLOCKERS[11],
  ),
  z.literal(
    PLATFORM_RELEASE_CONTENT_STORE_DURABLE_RECORD_TEST_V3_REMAINING_PRODUCTION_BLOCKERS[12],
  ),
]);

const DurableRecordIdentityV3Schema = z.object({
  schema: z.literal(PLATFORM_RELEASE_CONTENT_STORE_DURABLE_RECORD_TEST_V3_SCHEMA),
  version: z.literal(PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_V3_VERSION),
  admissionScope: z.literal("test_fixture"),
  authorityState: z.literal("durable_database_record_test_fixture_unverified"),
  productionAuthority: z.literal(false),
  productionAdmission: z.literal("forbidden"),
  credentialUse: z.literal("none"),
  signingAuthority: z.literal("unsigned_test_fixture"),
  mutationAuthority: z.literal(false),
  storeAuthority: z.literal(false),
  restartAuthority: z.literal(false),
  preparedPlatformReleaseIssued: z.literal(false),
  serializedValueAuthority: z.literal(false),
  trustConclusion: z.literal("characterization_only"),
  persistenceScope: z.literal("exact_database_occurrence_required"),
  closedProductionBlocker: z.literal("durable_release_store_records_absent"),
  remainingProductionBlockers: RemainingProductionBlockersV3Schema,
  recordOrdinal: z.number().int().nonnegative().safe().max(255),
  priorRecordHash: Sha256Schema.nullable(),
  preflight: PlatformReleaseContentStorePublisherPreflightTestV3Schema,
  leafReceipt: PlatformReleaseContentStoreLeafReceiptTestV3Schema,
}).strict();

export type PlatformReleaseContentStoreDurableRecordTestHashPayloadV3 =
  z.infer<typeof DurableRecordIdentityV3Schema>;

export function hashPlatformReleaseContentStoreDurableRecordTestV3(
  value: PlatformReleaseContentStoreDurableRecordTestHashPayloadV3,
): string {
  return hashCanonicalJson({
    schema: PLATFORM_RELEASE_CONTENT_STORE_DURABLE_RECORD_TEST_HASH_V3_SCHEMA,
    durableRecord: value,
  });
}

export const PlatformReleaseContentStoreDurableRecordTestV3Schema =
  DurableRecordIdentityV3Schema.extend({
    recordHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const isGenesis = value.recordOrdinal === 0;
    if (isGenesis !== (value.priorRecordHash === null)) {
      context.addIssue({
        code: "custom",
        path: ["priorRecordHash"],
        message: "Only record ordinal zero may omit the prior durable record hash",
      });
    }
    if (value.leafReceipt.publication !== "published") {
      context.addIssue({
        code: "custom",
        path: ["leafReceipt", "publication"],
        message: "A new durable record must describe one newly published leaf",
      });
    }
    try {
      assertPlatformReleaseContentStoreLeafReceiptJoinsPreflightTestV3(
        value.preflight,
        value.leafReceipt,
      );
    } catch {
      context.addIssue({
        code: "custom",
        path: ["leafReceipt"],
        message: "Durable record leaf receipt must exactly join its V3 preflight",
      });
    }
    const { recordHash: _recordHash, ...identity } = value;
    if (
      value.recordHash
        !== hashPlatformReleaseContentStoreDurableRecordTestV3(identity)
    ) {
      context.addIssue({
        code: "custom",
        path: ["recordHash"],
        message: "Durable content-store record hash mismatch",
      });
    }
    if (
      !platformReleaseCandidateFitsCanonicalCapV2(
        value,
        PLATFORM_RELEASE_CONTENT_STORE_DURABLE_RECORD_TEST_MAX_CANONICAL_BYTES_V3,
      )
    ) {
      context.addIssue({
        code: "custom",
        message: "Durable content-store record exceeds its canonical byte cap",
      });
    }
  });

export type PlatformReleaseContentStoreDurableRecordTestV3 = z.infer<
  typeof PlatformReleaseContentStoreDurableRecordTestV3Schema
>;

export function parsePlatformReleaseContentStoreDurableRecordTestCandidateV3(
  input: unknown,
): PlatformReleaseContentStoreDurableRecordTestV3 {
  const snapshot = boundedPlatformReleaseJsonSnapshotV2(
    input,
    PLATFORM_RELEASE_CONTENT_STORE_DURABLE_RECORD_TEST_MAX_CANONICAL_BYTES_V3,
  );
  return deepFreezePlatformReleaseJsonV2(
    PlatformReleaseContentStoreDurableRecordTestV3Schema.parse(snapshot),
  );
}

export function buildPlatformReleaseContentStoreDurableRecordTestV3(input: Readonly<{
  recordOrdinal: number;
  priorRecordHash: string | null;
  preflight: unknown;
  leafReceipt: unknown;
}>): PlatformReleaseContentStoreDurableRecordTestV3 {
  const preflight =
    parsePlatformReleaseContentStorePublisherPreflightTestCandidateV3(
      input.preflight,
    );
  const leafReceipt =
    assertPlatformReleaseContentStoreLeafReceiptJoinsPreflightTestV3(
      preflight,
      input.leafReceipt,
    );
  const identity: PlatformReleaseContentStoreDurableRecordTestHashPayloadV3 = {
    schema: PLATFORM_RELEASE_CONTENT_STORE_DURABLE_RECORD_TEST_V3_SCHEMA,
    version: PLATFORM_RELEASE_CONTENT_STORE_GLOBAL_CENSUS_V3_VERSION,
    admissionScope: "test_fixture",
    authorityState: "durable_database_record_test_fixture_unverified",
    productionAuthority: false,
    productionAdmission: "forbidden",
    credentialUse: "none",
    signingAuthority: "unsigned_test_fixture",
    mutationAuthority: false,
    storeAuthority: false,
    restartAuthority: false,
    preparedPlatformReleaseIssued: false,
    serializedValueAuthority: false,
    trustConclusion: "characterization_only",
    persistenceScope: "exact_database_occurrence_required",
    closedProductionBlocker: "durable_release_store_records_absent",
    remainingProductionBlockers: [
      ...PLATFORM_RELEASE_CONTENT_STORE_DURABLE_RECORD_TEST_V3_REMAINING_PRODUCTION_BLOCKERS,
    ],
    recordOrdinal: input.recordOrdinal,
    priorRecordHash: input.priorRecordHash,
    preflight,
    leafReceipt,
  };
  return parsePlatformReleaseContentStoreDurableRecordTestCandidateV3({
    ...identity,
    recordHash: hashPlatformReleaseContentStoreDurableRecordTestV3(identity),
  });
}
