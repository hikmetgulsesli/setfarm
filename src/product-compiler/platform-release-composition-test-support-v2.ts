import {
  hashCanonicalJson,
} from "./canonical-json.js";
import {
  hashPlatformReleaseCompositionTestEvidenceV2,
  hashPlatformReleaseCompositionTestObservationV2,
  hashPlatformReleaseCompositionTestV2,
  parsePlatformReleaseCompositionTestCandidateV2,
  parsePlatformReleaseCompositionTestSealedRootEvidenceV2,
  PLATFORM_RELEASE_COMPOSITION_TEST_EVIDENCE_V2_SCHEMA,
  PLATFORM_RELEASE_COMPOSITION_TEST_V2_SCHEMA,
  type PlatformReleaseCompositionTestSealedRootEvidenceV2,
  type PlatformReleaseCompositionTestV2,
} from "../execution/schemas/platform-release-composition-test-v2.js";

function fixtureHashV2(label: string): string {
  return hashCanonicalJson({
    schema: "setfarm.platform-release-composition-test-fixture-value.v2",
    label,
  });
}

export function buildPlatformReleaseCompositionTestSealedRootEvidenceForTestV2(): PlatformReleaseCompositionTestSealedRootEvidenceV2 {
  const hostIdentityHash = hashCanonicalJson({
    schema: `${PLATFORM_RELEASE_COMPOSITION_TEST_EVIDENCE_V2_SCHEMA}.host.v2`,
    platform: process.platform,
    authority: "test_fixture_only",
  });
  const stableIdentity = {
    hostIdentityHash,
    objectKind: "directory" as const,
    device: "7",
    inode: "11",
  };
  const mutableFingerprint = {
    ownerUid: typeof process.getuid === "function" ? process.getuid() : 501,
    ownerGid: typeof process.getgid === "function" ? process.getgid() : 20,
    mode: "0555" as const,
    linkCount: 2,
    byteLength: 32,
    contentHash: hashCanonicalJson({
      schema: `${PLATFORM_RELEASE_COMPOSITION_TEST_EVIDENCE_V2_SCHEMA}.sealed-layout.v2`,
      entries: ["manifest.json", "payload"],
    }),
    modifiedTimeNanoseconds: "1",
    changedTimeNanoseconds: "1",
  };
  const observationIdentity = { stableIdentity, mutableFingerprint };
  const sealedRoot = {
    ...observationIdentity,
    observationHash: hashPlatformReleaseCompositionTestObservationV2(
      observationIdentity,
    ),
  };
  const evidenceIdentity = {
    schema: PLATFORM_RELEASE_COMPOSITION_TEST_EVIDENCE_V2_SCHEMA,
    version: "2.0.0" as const,
    authorityState: "test_fixture_sealed_root_unverified" as const,
    admissionScope: "test_fixture" as const,
    productionAuthority: false as const,
    productionAdmission: "forbidden" as const,
    credentialUse: "none" as const,
    signingAuthority: "unsigned_test_fixture" as const,
    evidenceOutcome: "sealed_root_observed_without_production_authority" as const,
    manifestPayloadHash: fixtureHashV2("manifest-payload"),
    buildAttestationHash: fixtureHashV2("build-attestation"),
    runtimePayloadHash: fixtureHashV2("runtime-payload"),
    outputTreeHash: fixtureHashV2("output-tree"),
    sealedRootMembershipHash: mutableFingerprint.contentHash,
    manifestByteLength: 1_024,
    buildAttestationByteLength: 2_048,
    sealedRoot,
    durability: {
      stageManifestFsync: true as const,
      sealedRootFsync: true as const,
      releaseParentFsync: true as const,
      attestationFsync: true as const,
    },
  };
  return parsePlatformReleaseCompositionTestSealedRootEvidenceV2({
    ...evidenceIdentity,
    evidenceHash: hashPlatformReleaseCompositionTestEvidenceV2(evidenceIdentity),
  });
}

export function buildPlatformReleaseCompositionTestContractForTestV2(
  sealedRootEvidence: unknown = buildPlatformReleaseCompositionTestSealedRootEvidenceForTestV2(),
): PlatformReleaseCompositionTestV2 {
  const evidence = parsePlatformReleaseCompositionTestSealedRootEvidenceV2(
    sealedRootEvidence,
  );
  const transactionIdentity = {
    schema: PLATFORM_RELEASE_COMPOSITION_TEST_V2_SCHEMA,
    version: "2.0.0" as const,
    authorityState: "test_fixture_composition_unverified" as const,
    admissionScope: "test_fixture" as const,
    productionAuthority: false as const,
    productionAdmission: "forbidden" as const,
    credentialUse: "none" as const,
    signingAuthority: "unsigned_test_fixture" as const,
    operationMode: "test_fixture_composition_contract_only" as const,
    pairLifecycle: [
      "pair_ready",
      "pair_consuming",
      "terminalizing",
      "selected_root_owned",
      "predecessors_consumed",
      "release_completed",
    ] as const,
    selectedOccurrence: "first" as const,
    ownershipTransfer: "selected_root_transferred_predecessors_consumed" as const,
    predecessorTombstone: "pathless_release_completed_tombstone" as const,
    sealedRootEvidence: evidence,
  };
  return parsePlatformReleaseCompositionTestCandidateV2({
    ...transactionIdentity,
    transactionHash: hashPlatformReleaseCompositionTestV2(transactionIdentity),
  });
}
