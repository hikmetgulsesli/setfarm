import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";

import {
  canonicalJsonBytes,
  canonicalJsonStringify,
  hashCanonicalJson,
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
  PlatformReleaseBuildToolchainReceiptV2Schema,
  SourceAdmissionReceiptV2Schema,
  hashPlatformReleaseBuildReceiptV2,
  hashPlatformReleaseSourceStagePhysicalIdentityV2,
  hashSourceAdmissionReceiptV2,
  parsePlatformReleaseBuildReceiptCandidateV2,
  parsePlatformReleaseBuildToolchainReceiptCandidateV2,
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
  hashHostAdmissionReceiptV2,
} from
  "../../src/execution/schemas/platform-release-common-v2.js";
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

function rebindCommandResult(receipt: any): void {
  const stdout =
    `${canonicalJsonStringify(receipt.process.commandResult)}\n`;
  receipt.process.stdoutContentHash = createHash("sha256")
    .update(stdout)
    .digest("hex");
  receipt.process.stdoutByteLength = Buffer.byteLength(stdout, "utf8");
  receipt.receiptHash =
    hashPlatformReleaseBuildReceiptV2(receipt);
}

function rebindSourceAdmission(manifest: any): void {
  const admission = manifest.release.sourceAdmission.receipt;
  for (const hostFile of [
    admission.implementation.module,
    admission.gitTool.executable,
  ]) {
    hostFile.hostAdmissionReceipt.receiptHash =
      hashHostAdmissionReceiptV2(hostFile.hostAdmissionReceipt);
    hostFile.hostAdmissionEvidenceHash =
      hostFile.hostAdmissionReceipt.receiptHash;
  }
  admission.receiptHash = hashSourceAdmissionReceiptV2(admission);
  manifest.release.sourceAdmission.receiptHash = admission.receiptHash;
  for (const key of [
    "firstBuildReceipt",
    "secondBuildReceipt",
  ] as const) {
    const receipt = manifest.build[key];
    receipt.sourceAdmissionReceiptHash = admission.receiptHash;
    receipt.receiptHash =
      hashPlatformReleaseBuildReceiptV2(receipt);
    manifest.build[`${key}Hash`] = receipt.receiptHash;
  }
  rehashManifest(manifest);
}

describe("PlatformReleaseManifestV2 candidate authority boundary", () => {
  it("binds typed source and two independent build receipts with stable goldens", () => {
    const manifest = createPlatformReleaseManifestFixtureV2();
    const sourceReceipt = manifest.release.sourceAdmission.receipt;
    const toolchainReceipt = manifest.build.buildToolchainReceipt;
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
    assert.equal(
      PlatformReleaseBuildToolchainReceiptV2Schema
        .safeParse(toolchainReceipt).success,
      true,
    );
    assert.deepEqual(
      {
        sourceHash: sourceReceipt.receiptHash,
        sourceBytes: canonicalJsonBytes(sourceReceipt).byteLength,
        toolchainHash: toolchainReceipt.receiptHash,
        toolchainBytes:
          canonicalJsonBytes(toolchainReceipt).byteLength,
        firstBuildHash: first.receiptHash,
        firstBuildBytes: canonicalJsonBytes(first).byteLength,
        secondBuildHash: second.receiptHash,
        secondBuildBytes: canonicalJsonBytes(second).byteLength,
      },
      {
        sourceHash:
          "e270a58af84c476b5c292fb55bcd28126d2dd0b0df753305133876b266868571",
        sourceBytes: 10_594,
        toolchainHash:
          "e15b1d808d07286328251e27d4fef9e1b629df8beef5a1cd1aad836cf7d42090",
        toolchainBytes: 9_544,
        firstBuildHash:
          "c4a3033385eaf5a9d9b42b9cb325f680f6ce2cae3327636d28817a88a37f57c5",
        firstBuildBytes: 11_466,
        secondBuildHash:
          "7a9013a7b064d6418cf44abb2a04effecd6176cfa3fb17f25c849da31bec4226",
        secondBuildBytes: 11_467,
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
          "1bf159fe34e2f1a333824fefffc420ae45d6731f9a2283b8baf7636090f1b9c0",
        bytes: 100_055,
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
    const parsedToolchain =
      parsePlatformReleaseBuildToolchainReceiptCandidateV2(
        manifest.build.buildToolchainReceipt,
      );
    recursivelyAssertFrozen(parsedSource);
    recursivelyAssertFrozen(parsedBuild);
    recursivelyAssertFrozen(parsedToolchain);

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

    const movedRemote: any = structuredClone(
      manifest.release.sourceAdmission.receipt,
    );
    movedRemote.remoteAfter.observedSha =
      fixtureShaV2("moved-remote-main").slice(0, 40);
    movedRemote.remoteAfter.observationHash = hashCanonicalJson({
      schema: "setfarm.remote-main-observation.v2",
      repositoryId: movedRemote.remoteAfter.repositoryId,
      originTransport: movedRemote.remoteAfter.originTransport,
      originUrlHash: movedRemote.remoteAfter.originUrlHash,
      remoteRef: movedRemote.remoteAfter.remoteRef,
      observedSha: movedRemote.remoteAfter.observedSha,
      observedTreeHash: movedRemote.remoteAfter.observedTreeHash,
    });
    movedRemote.receiptHash =
      hashSourceAdmissionReceiptV2(movedRemote);
    assert.equal(
      SourceAdmissionReceiptV2Schema.safeParse(movedRemote).success,
      false,
    );

    const foreignOrigin: any = structuredClone(
      manifest.release.sourceAdmission.receipt,
    );
    for (const remote of [
      foreignOrigin.remoteBefore,
      foreignOrigin.remoteAfter,
    ]) {
      remote.originUrlHash = fixtureShaV2("foreign-origin-url");
      remote.observationHash = hashCanonicalJson({
        schema: "setfarm.remote-main-observation.v2",
        repositoryId: remote.repositoryId,
        originTransport: remote.originTransport,
        originUrlHash: remote.originUrlHash,
        remoteRef: remote.remoteRef,
        observedSha: remote.observedSha,
        observedTreeHash: remote.observedTreeHash,
      });
    }
    foreignOrigin.receiptHash =
      hashSourceAdmissionReceiptV2(foreignOrigin);
    assert.equal(
      SourceAdmissionReceiptV2Schema.safeParse(foreignOrigin).success,
      false,
    );

    const swappedSourceStage: any = structuredClone(
      manifest.release.sourceAdmission.receipt,
    );
    swappedSourceStage.exportedSource.stageAfter.inode = "999";
    swappedSourceStage.exportedSource.stageAfter.identityHash =
      hashPlatformReleaseSourceStagePhysicalIdentityV2(
        swappedSourceStage.exportedSource.stageAfter,
      );
    swappedSourceStage.receiptHash =
      hashSourceAdmissionReceiptV2(swappedSourceStage);
    assert.equal(
      SourceAdmissionReceiptV2Schema.safeParse(swappedSourceStage)
        .success,
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

    const driftedResult: any = structuredClone(
      manifest.build.firstBuildReceipt,
    );
    driftedResult.process.commandResult.platformFileCount += 1;
    rebindCommandResult(driftedResult);
    assert.equal(
      PlatformReleaseBuildReceiptV2Schema.safeParse(driftedResult).success,
      false,
    );

    const driftedSourceCount: any = structuredClone(
      manifest.build.firstBuildReceipt,
    );
    driftedSourceCount.process.commandResult.sourceFileCount += 1;
    rebindCommandResult(driftedSourceCount);
    assert.equal(
      PlatformReleaseBuildReceiptV2Schema.safeParse(
        driftedSourceCount,
      ).success,
      false,
    );

    const driftedToolchainCount: any = structuredClone(
      manifest.build.firstBuildReceipt,
    );
    driftedToolchainCount.process.commandResult
      .buildToolchainFileCount += 1;
    rebindCommandResult(driftedToolchainCount);
    assert.equal(
      PlatformReleaseBuildReceiptV2Schema.safeParse(
        driftedToolchainCount,
      ).success,
      false,
    );

    const aliasedToolchainStage: any = structuredClone(
      manifest.build.firstBuildReceipt,
    );
    aliasedToolchainStage.stage
      .buildToolchainPhysicalIdentityHash =
        aliasedToolchainStage.stage
          .sourceStagePhysicalIdentityHash;
    aliasedToolchainStage.receiptHash =
      hashPlatformReleaseBuildReceiptV2(aliasedToolchainStage);
    assert.equal(
      PlatformReleaseBuildReceiptV2Schema.safeParse(
        aliasedToolchainStage,
      ).success,
      false,
    );

    const mixedHostToolchain: any = structuredClone(
      manifest.build.buildToolchainReceipt,
    );
    mixedHostToolchain.process.hostToolchainReceiptHash =
      fixtureShaV2("mixed-host-toolchain");
    mixedHostToolchain.receiptHash =
      buildModule.hashPlatformReleaseBuildToolchainReceiptV2(
        mixedHostToolchain,
      );
    assert.equal(
      PlatformReleaseBuildToolchainReceiptV2Schema.safeParse(
        mixedHostToolchain,
      ).success,
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

    const wrongBuildSource: any = structuredClone(manifest);
    const wrongSha = fixtureShaV2("wrong-build-source").slice(0, 40);
    for (const key of [
      "firstBuildReceipt",
      "secondBuildReceipt",
    ] as const) {
      const receipt = wrongBuildSource.build[key];
      receipt.process.commandResult.sourceSha = wrongSha;
      rebindCommandResult(receipt);
      wrongBuildSource.build[`${key}Hash`] = receipt.receiptHash;
    }
    rehashManifest(wrongBuildSource);

    const sourceVerifierDrift: any = structuredClone(manifest);
    sourceVerifierDrift.release.sourceAdmission.receipt
      .implementation.module.hostAdmissionReceipt
      .verifier.abiHash = fixtureShaV2(
        "different-source-host-verifier",
      );
    rebindSourceAdmission(sourceVerifierDrift);

    const sourceGitVerifierDrift: any = structuredClone(manifest);
    sourceGitVerifierDrift.release.sourceAdmission.receipt
      .gitTool.executable.hostAdmissionReceipt
      .verifier.abiHash = fixtureShaV2(
        "different-source-git-host-verifier",
      );
    rebindSourceAdmission(sourceGitVerifierDrift);

    const detachedSourceStage: any = structuredClone(manifest);
    detachedSourceStage.build.sourceStage
      .stagePhysicalIdentityHash =
        fixtureShaV2("detached-source-stage");
    rehashManifest(detachedSourceStage);

    const detachedToolchain: any = structuredClone(manifest);
    detachedToolchain.build.secondBuildReceipt.buildToolchain.treeHash =
      fixtureShaV2("detached-build-toolchain-tree");
    detachedToolchain.build.secondBuildReceipt.buildToolchain.bindingHash =
      buildModule.hashPlatformReleaseBuildToolchainTreeBindingV2(
        detachedToolchain.build.secondBuildReceipt.buildToolchain,
      );
    detachedToolchain.build.secondBuildReceipt.process.commandResult
      .buildToolchainTreeHash =
        detachedToolchain.build.secondBuildReceipt.buildToolchain
          .treeHash;
    rebindCommandResult(
      detachedToolchain.build.secondBuildReceipt,
    );
    detachedToolchain.build.secondBuildReceiptHash =
      detachedToolchain.build.secondBuildReceipt.receiptHash;
    rehashManifest(detachedToolchain);

    for (const candidate of [
      aliasedBuild,
      networkDrift,
      profileDrift,
      wrongBuildSource,
      sourceVerifierDrift,
      sourceGitVerifierDrift,
      detachedSourceStage,
      detachedToolchain,
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
