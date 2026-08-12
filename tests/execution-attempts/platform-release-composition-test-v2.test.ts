import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildPlatformReleaseCompositionTestContractForTestV2,
  buildPlatformReleaseCompositionTestSealedRootEvidenceForTestV2,
} from "../../src/product-compiler/platform-release-composition-test-support-v2.js";
import {
  hashPlatformReleaseCompositionTestV2,
  parsePlatformReleaseCompositionTestCandidateV2,
  parsePlatformReleaseCompositionTestSealedRootEvidenceV2,
  PlatformReleaseCompositionTestV2Schema,
} from "../../src/execution/schemas/platform-release-composition-test-v2.js";

describe("platform release composition contract v2", () => {
  it("binds pathless sealed-root evidence to one explicit one-shot lifecycle without authority", () => {
    const evidence = buildPlatformReleaseCompositionTestSealedRootEvidenceForTestV2();
    const contract = buildPlatformReleaseCompositionTestContractForTestV2(evidence);

    assert.equal(evidence.authorityState, "test_fixture_sealed_root_unverified");
    assert.equal(evidence.productionAuthority, false);
    assert.equal(evidence.productionAdmission, "forbidden");
    assert.equal(evidence.signingAuthority, "unsigned_test_fixture");
    assert.equal(evidence.sealedRoot.stableIdentity.objectKind, "directory");
    assert.equal(evidence.sealedRoot.mutableFingerprint.mode, "0555");
    assert.deepEqual(contract.pairLifecycle, [
      "pair_ready",
      "pair_consuming",
      "terminalizing",
      "selected_root_owned",
      "predecessors_consumed",
      "release_completed",
    ]);
    assert.equal(contract.operationMode, "test_fixture_composition_contract_only");
    assert.equal(contract.ownershipTransfer, "selected_root_transferred_predecessors_consumed");
    assert.equal(contract.predecessorTombstone, "pathless_release_completed_tombstone");
    assert.equal(contract.sealedRootEvidence.evidenceHash, evidence.evidenceHash);
    assert.equal(hashPlatformReleaseCompositionTestV2(contract), contract.transactionHash);
    assert.equal(PlatformReleaseCompositionTestV2Schema.safeParse(contract).success, true);
    const parsed = parsePlatformReleaseCompositionTestCandidateV2(structuredClone(contract));
    assert.equal(Object.isFrozen(parsed), true);
    assert.equal(Object.isFrozen(parsed.pairLifecycle), true);
    assert.equal(JSON.stringify(contract).includes("/"), false);
  });

  it("rejects lifecycle, evidence, authority, and path-bearing promotion attempts", () => {
    const contract = buildPlatformReleaseCompositionTestContractForTestV2();

    const reordered = structuredClone(contract) as Record<string, any>;
    reordered.pairLifecycle = [
      "pair_ready",
      "terminalizing",
      "pair_consuming",
      "selected_root_owned",
      "predecessors_consumed",
      "release_completed",
    ];
    assert.equal(PlatformReleaseCompositionTestV2Schema.safeParse(reordered).success, false);

    const evidenceTampered = structuredClone(contract) as Record<string, any>;
    evidenceTampered.sealedRootEvidence.manifestPayloadHash = "0".repeat(64);
    assert.equal(PlatformReleaseCompositionTestV2Schema.safeParse(evidenceTampered).success, false);

    const forged = structuredClone(contract) as Record<string, any>;
    forged.productionAuthority = true;
    forged.transactionHash = hashPlatformReleaseCompositionTestV2(forged);
    assert.equal(PlatformReleaseCompositionTestV2Schema.safeParse(forged).success, false);

    const pathBearing = structuredClone(contract) as Record<string, any>;
    pathBearing.path = "/tmp/forbidden-path";
    assert.equal(PlatformReleaseCompositionTestV2Schema.safeParse(pathBearing).success, false);

    const evidence = structuredClone(contract.sealedRootEvidence) as Record<string, any>;
    evidence.evidenceHash = "0".repeat(64);
    assert.throws(
      () => parsePlatformReleaseCompositionTestSealedRootEvidenceV2(evidence),
    );
  });
});
