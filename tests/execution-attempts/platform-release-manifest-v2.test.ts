import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  canonicalJsonBytes,
} from "../../src/product-compiler/canonical-json.js";
import {
  hashProductDeliveryProfileCatalogV2,
  hashProductDeliveryProfileV2,
} from
  "../../src/product-compiler/product-delivery-profile-catalog-v2.js";
import {
  hashEvidenceEnvironmentCapsuleV2,
  hashNetworkIsolationAuthorityV2,
} from
  "../../src/execution/schemas/evidence-environment-capsule-v2.js";
import * as buildModule from
  "../../src/execution/schemas/platform-release-build-v2.js";
import {
  PlatformReleaseBuildReceiptV2Schema,
  SourceAdmissionReceiptV2Schema,
  hashPlatformReleaseBuildReceiptV2,
  hashSourceAdmissionReceiptV2,
  parsePlatformReleaseBuildReceiptCandidateV2,
  parseSourceAdmissionReceiptCandidateV2,
} from "../../src/execution/schemas/platform-release-build-v2.js";
import * as manifestModule from
  "../../src/execution/schemas/platform-release-manifest-v2.js";
import {
  PLATFORM_RELEASE_MANIFEST_V2_MAX_CANONICAL_BYTES,
  PlatformReleaseManifestV2Schema,
  hashPlatformReleaseManifestV2,
  parsePlatformReleaseManifestCandidateV2,
} from
  "../../src/execution/schemas/platform-release-manifest-v2.js";
import {
  hashPlatformReleaseModuleRefV2,
  hashPlatformRunnerCatalogEntryV2,
  hashPlatformRunnerCatalogV2,
  hashPlatformRunnerToolchainV2,
} from
  "../../src/execution/schemas/platform-release-module-catalogs-v2.js";
import {
  createPlatformReleaseManifestFixtureV2,
  fixtureShaV2,
} from
  "./fixtures/platform-release-manifest-v2-fixture.js";

function recursivelyAssertFrozen(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  assert.equal(Object.isFrozen(value), true);
  Object.values(value).forEach(recursivelyAssertFrozen);
}

function rehashManifest(candidate: any): void {
  candidate.manifestPayloadHash =
    hashPlatformReleaseManifestV2(candidate);
}

describe("PlatformReleaseManifestV2 candidate authority boundary", () => {
  it("binds typed source and two independent build receipts with stable goldens", () => {
    const manifest = createPlatformReleaseManifestFixtureV2();
    const sourceReceipt = manifest.release.sourceAdmission.receipt;
    const first = manifest.build.firstBuildReceipt;
    const second = manifest.build.secondBuildReceipt;

    assert.equal(
      SourceAdmissionReceiptV2Schema.safeParse(sourceReceipt).success,
      true,
    );
    assert.equal(
      PlatformReleaseBuildReceiptV2Schema.safeParse(first).success,
      true,
    );
    assert.equal(
      PlatformReleaseBuildReceiptV2Schema.safeParse(second).success,
      true,
    );
    assert.deepEqual(
      {
        sourceHash: sourceReceipt.receiptHash,
        sourceBytes: canonicalJsonBytes(sourceReceipt).byteLength,
        firstBuildHash: first.receiptHash,
        firstBuildBytes: canonicalJsonBytes(first).byteLength,
        secondBuildHash: second.receiptHash,
        secondBuildBytes: canonicalJsonBytes(second).byteLength,
      },
      {
        sourceHash:
          "768a72032119579aad3c85236b3b3046cbae606b057febcc2704201f02e2bdab",
        sourceBytes: 2_279,
        firstBuildHash:
          "68c01635a41f7cab5ae6aa7330c0ec3a34373a2bf363cfa6aac83f9f68528679",
        firstBuildBytes: 8_927,
        secondBuildHash:
          "c45e07efa56fdb0675f8cc803123bce8e9bad09034d8892089e1abc24a6674b7",
        secondBuildBytes: 8_928,
      },
    );
    assert.notEqual(
      first.stage.outputStagePhysicalIdentityHash,
      second.stage.outputStagePhysicalIdentityHash,
    );
    assert.deepEqual(first.output, second.output);
  });

  it("closes every nested code-owned catalog and cross-component root join", () => {
    const manifest = createPlatformReleaseManifestFixtureV2();
    const parsed =
      parsePlatformReleaseManifestCandidateV2(manifest);
    assert.deepEqual(parsed, manifest);
    assert.notStrictEqual(parsed, manifest);
    assert.equal(
      parsed.productionUse,
      "forbidden_until_empty_stage_materialization_and_fresh_verification",
    );
    assert.deepEqual(
      {
        hash: parsed.manifestPayloadHash,
        bytes: canonicalJsonBytes(parsed).byteLength,
        cap: PLATFORM_RELEASE_MANIFEST_V2_MAX_CANONICAL_BYTES,
      },
      {
        hash:
          "455fcccdf2aa6b1d19af7bf8f211bc757b053178fb6a73f819caccd7d0ce3368",
        bytes: 70_474,
        cap: 3_145_728,
      },
    );
    assert.equal(
      parsed.runnerCatalog.launcherCatalogHash,
      parsed.launcherCatalog.catalogHash,
    );
    assert.equal(
      parsed.runtimePayload.dependencyTree.treeHash,
      parsed.externalResolution.materializationReceipt
        .dependencyTreeHash,
    );
    assert.equal(
      parsed.environmentCapsule.network.authority
        .hostRuntimeIdentityHash,
      parsed.externalResolution.hostRuntime.hostRuntimeIdentityHash,
    );
    recursivelyAssertFrozen(parsed);
  });

  it("fresh-snapshots source/build inputs and rejects forged source or stage authority", () => {
    const manifest = createPlatformReleaseManifestFixtureV2();
    const parsedSource = parseSourceAdmissionReceiptCandidateV2(
      manifest.release.sourceAdmission.receipt,
    );
    const parsedBuild = parsePlatformReleaseBuildReceiptCandidateV2(
      manifest.build.firstBuildReceipt,
    );
    recursivelyAssertFrozen(parsedSource);
    recursivelyAssertFrozen(parsedBuild);

    const driftedSource: any = structuredClone(
      manifest.release.sourceAdmission.receipt,
    );
    driftedSource.sourceAfter.identityHash = fixtureShaV2(
      "self-rehashed-wrong-after",
    );
    driftedSource.receiptHash =
      hashSourceAdmissionReceiptV2(driftedSource);
    assert.equal(
      SourceAdmissionReceiptV2Schema.safeParse(driftedSource).success,
      false,
    );

    const aliasedStage: any = structuredClone(
      manifest.build.firstBuildReceipt,
    );
    aliasedStage.stage.outputStagePhysicalIdentityHash =
      aliasedStage.stage.sourceStagePhysicalIdentityHash;
    aliasedStage.receiptHash =
      hashPlatformReleaseBuildReceiptV2(aliasedStage);
    assert.equal(
      PlatformReleaseBuildReceiptV2Schema.safeParse(aliasedStage).success,
      false,
    );
  });

  it("rejects self-rehashed cross-root, double-build and code-owned drift", () => {
    const manifest = createPlatformReleaseManifestFixtureV2();

    const aliasedBuild: any = structuredClone(manifest);
    aliasedBuild.build.secondBuildReceipt.stage
      .outputStagePhysicalIdentityHash =
        aliasedBuild.build.firstBuildReceipt.stage
          .outputStagePhysicalIdentityHash;
    aliasedBuild.build.secondBuildReceipt.receiptHash =
      hashPlatformReleaseBuildReceiptV2(
        aliasedBuild.build.secondBuildReceipt,
      );
    aliasedBuild.build.secondBuildReceiptHash =
      aliasedBuild.build.secondBuildReceipt.receiptHash;
    rehashManifest(aliasedBuild);

    const networkDrift: any = structuredClone(manifest);
    networkDrift.environmentCapsule.network.authority
      .hostRuntimeIdentityHash = fixtureShaV2("other-host");
    networkDrift.environmentCapsule.network.authority.authorityHash =
      hashNetworkIsolationAuthorityV2(
        networkDrift.environmentCapsule.network.authority,
      );
    networkDrift.environmentCapsule.environmentCapsuleHash =
      hashEvidenceEnvironmentCapsuleV2(
        networkDrift.environmentCapsule,
      );
    rehashManifest(networkDrift);

    const profileDrift: any = structuredClone(manifest);
    profileDrift.profileCatalog.profiles[0].readiness.blockerCodes =
      profileDrift.profileCatalog.profiles[0].readiness.blockerCodes
        .slice(1);
    profileDrift.profileCatalog.profiles[0].profileHash =
      hashProductDeliveryProfileV2(
        profileDrift.profileCatalog.profiles[0],
      );
    profileDrift.profileCatalog.catalogHash =
      hashProductDeliveryProfileCatalogV2(
        profileDrift.profileCatalog,
      );
    rehashManifest(profileDrift);

    for (const candidate of [
      aliasedBuild,
      networkDrift,
      profileDrift,
    ]) {
      assert.equal(
        PlatformReleaseManifestV2Schema.safeParse(candidate).success,
        false,
      );
    }
  });

  it("identity-advances coherent candidate module bytes without pretending to verify the tree", () => {
    const original = createPlatformReleaseManifestFixtureV2();
    const candidate: any = structuredClone(original);
    const entry = candidate.runnerCatalog.entries[0];
    entry.module.contentHash = fixtureShaV2(
      "different-unverified-runner-bytes",
    );
    entry.module.moduleRefHash =
      hashPlatformReleaseModuleRefV2(entry.module);
    const executionAdmissionHash =
      entry.admission.executionLeaseContractHash;
    entry.toolchainHash = hashPlatformRunnerToolchainV2({
      runnerEntrypointRef: entry.runnerEntrypointRef,
      runnerModuleHash: entry.module.contentHash,
      runnerAbiHash: entry.abiHash,
      platformTreeHash: candidate.runnerCatalog.platformTreeHash,
      dependencyTreeHash:
        candidate.runnerCatalog.dependencyTreeHash,
      runtimePayloadHash:
        candidate.runnerCatalog.runtimePayloadHash,
      externalResolutionHash:
        candidate.runnerCatalog.externalResolutionHash,
      productionResolutionGraphHash:
        candidate.runnerCatalog.productionResolutionGraphHash,
      environmentCapsuleHash:
        candidate.runnerCatalog.environmentCapsuleHash,
      launcherCatalogHash:
        candidate.runnerCatalog.launcherCatalogHash,
      transportCodecCatalogHash:
        candidate.runnerCatalog.transportCodecCatalogHash,
      receiptSchemaHash:
        candidate.runnerCatalog.receiptSchemaHash,
      adapterDefinitionCatalogHash:
        candidate.runnerCatalog.adapterDefinitionCatalogHash,
      executionAdmissionHash,
    });
    entry.entryHash = hashPlatformRunnerCatalogEntryV2(entry);
    candidate.runnerCatalog.catalogHash =
      hashPlatformRunnerCatalogV2(candidate.runnerCatalog);
    rehashManifest(candidate);

    assert.equal(
      PlatformReleaseManifestV2Schema.safeParse(candidate).success,
      true,
    );
    assert.notEqual(
      candidate.manifestPayloadHash,
      original.manifestPayloadHash,
    );
    assert.equal(
      candidate.productionUse,
      "forbidden_until_empty_stage_materialization_and_fresh_verification",
    );
  });

  it("rejects hostile input before proxy traps and exports no authority promotion", () => {
    let traps = 0;
    const hostile = new Proxy({}, {
      ownKeys() {
        traps += 1;
        throw new Error("manifest proxy trap must not execute");
      },
    });
    assert.throws(
      () => parsePlatformReleaseManifestCandidateV2(hostile),
    );
    assert.equal(traps, 0);

    for (const exports of [
      Object.keys(manifestModule),
      Object.keys(buildModule),
    ]) {
      for (const forbidden of [
        "activate",
        "ForTest",
        "issue",
        "materialize",
        "operational",
        "verify",
      ]) {
        assert.equal(
          exports.some((name) => name.includes(forbidden)),
          false,
          forbidden,
        );
      }
    }
  });
});
