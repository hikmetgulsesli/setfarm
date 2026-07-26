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
import * as attestationModule from
  "../../src/execution/schemas/platform-release-build-attestation-v2.js";
import {
  PLATFORM_RELEASE_BUILD_ATTESTATION_V2_MAX_CANONICAL_BYTES,
  PlatformReleaseBuildAttestationV2Schema,
  PlatformReleaseCandidateEnvelopeV2Schema,
  hashPlatformReleaseBuildAttestationV2,
  parsePlatformReleaseBuildAttestationCandidateV2,
  parsePlatformReleaseCandidateEnvelopeV2,
} from
  "../../src/execution/schemas/platform-release-build-attestation-v2.js";
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
  createPlatformReleaseCandidateEnvelopeFixtureV2,
  createDistinctPlatformReleaseBuildAttemptFixtureV2,
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

function rehashAttestation(envelope: any): void {
  envelope.buildAttestation.releaseContentHash =
    envelope.manifest.manifestPayloadHash;
  envelope.buildAttestation.attestationHash =
    hashPlatformReleaseBuildAttestationV2(
      envelope.buildAttestation,
    );
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

function rebindSourceAdmission(envelope: any): void {
  const attestation = envelope.buildAttestation;
  const admission = attestation.sourceAdmissionReceipt;
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
  attestation.sourceAdmissionReceiptHash = admission.receiptHash;
  for (const key of [
    "firstBuildReceipt",
    "secondBuildReceipt",
  ] as const) {
    const receipt = attestation[key];
    receipt.sourceAdmissionReceiptHash = admission.receiptHash;
    receipt.receiptHash =
      hashPlatformReleaseBuildReceiptV2(receipt);
    attestation[`${key}Hash`] = receipt.receiptHash;
  }
  rehashAttestation(envelope);
}

describe("PlatformReleaseManifestV2 candidate authority boundary", () => {
  it("binds typed source and two independent build receipts with stable goldens", () => {
    const envelope =
      createPlatformReleaseCandidateEnvelopeFixtureV2();
    const attestation = envelope.buildAttestation;
    const sourceReceipt = attestation.sourceAdmissionReceipt;
    const toolchainReceipt = attestation.buildToolchainReceipt;
    const first = attestation.firstBuildReceipt;
    const second = attestation.secondBuildReceipt;

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
    assert.equal(
      PlatformReleaseBuildAttestationV2Schema
        .safeParse(attestation).success,
      true,
    );
    assert.equal(
      PlatformReleaseCandidateEnvelopeV2Schema
        .safeParse(envelope).success,
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
        attestationHash: attestation.attestationHash,
        attestationBytes:
          canonicalJsonBytes(attestation).byteLength,
        attestationCap:
          PLATFORM_RELEASE_BUILD_ATTESTATION_V2_MAX_CANONICAL_BYTES,
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
        attestationHash:
          "d858e8c423f76578689d33990341b1587ebdddb283765423ec32c0ceab5ba86c",
        attestationBytes: 43_907,
        attestationCap: 1_048_576,
      },
    );
    assert.notEqual(
      first.stage.outputStagePhysicalIdentityHash,
      second.stage.outputStagePhysicalIdentityHash,
    );
    assert.deepEqual(first.output, second.output);
  });

  it("keeps one release ID across distinct physical and process attempts", () => {
    const first =
      createPlatformReleaseCandidateEnvelopeFixtureV2();
    const second: any = {
      schema: first.schema,
      manifest: structuredClone(first.manifest),
      buildAttestation:
        createDistinctPlatformReleaseBuildAttemptFixtureV2(
          first.buildAttestation,
          "second-clean-attempt",
        ),
    };
    const secondToolchain =
      second.buildAttestation.buildToolchainReceipt;

    assert.equal(
      PlatformReleaseCandidateEnvelopeV2Schema
        .safeParse(second).success,
      true,
    );
    assert.deepEqual(second.manifest, first.manifest);
    assert.equal(
      second.manifest.manifestPayloadHash,
      first.manifest.manifestPayloadHash,
    );
    assert.equal(
      second.buildAttestation.releaseContentHash,
      first.buildAttestation.releaseContentHash,
    );
    assert.notEqual(
      second.buildAttestation.attestationHash,
      first.buildAttestation.attestationHash,
    );
    const stableManifestBytes =
      canonicalJsonStringify(second.manifest);
    assert.equal(
      stableManifestBytes.includes(
        secondToolchain.process.environmentHash,
      ),
      false,
    );
    assert.equal(
      stableManifestBytes.includes(
        secondToolchain.process.projectScopeHash,
      ),
      false,
    );
    assert.notEqual(
      second.buildAttestation.sourceAdmissionReceipt
        .exportedSource.stageAfter.identityHash,
      first.buildAttestation.sourceAdmissionReceipt
        .exportedSource.stageAfter.identityHash,
    );
    assert.notEqual(
      second.buildAttestation.buildToolchainReceipt
        .physicalAfter.identityHash,
      first.buildAttestation.buildToolchainReceipt
        .physicalAfter.identityHash,
    );
  });

  it("closes every nested code-owned catalog and cross-component root join", () => {
    const envelope =
      createPlatformReleaseCandidateEnvelopeFixtureV2();
    const manifest = envelope.manifest;
    const parsed =
      parsePlatformReleaseManifestCandidateV2(manifest);
    const parsedEnvelope =
      parsePlatformReleaseCandidateEnvelopeV2(envelope);
    assert.deepEqual(parsed, manifest);
    assert.deepEqual(parsedEnvelope, envelope);
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
          "0346947594cbc6bbfec5d171b05b0261592e97b13b63e9f75c0084a4e96a6102",
        bytes: 60_463,
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
    recursivelyAssertFrozen(parsedEnvelope);
  });

  it("fresh-snapshots source/build inputs and rejects forged source or stage authority", () => {
    const attestation =
      createPlatformReleaseCandidateEnvelopeFixtureV2()
        .buildAttestation;
    const parsedSource = parseSourceAdmissionReceiptCandidateV2(
      attestation.sourceAdmissionReceipt,
    );
    const parsedBuild = parsePlatformReleaseBuildReceiptCandidateV2(
      attestation.firstBuildReceipt,
    );
    const parsedToolchain =
      parsePlatformReleaseBuildToolchainReceiptCandidateV2(
        attestation.buildToolchainReceipt,
      );
    const parsedAttestation =
      parsePlatformReleaseBuildAttestationCandidateV2(
        attestation,
      );
    recursivelyAssertFrozen(parsedSource);
    recursivelyAssertFrozen(parsedBuild);
    recursivelyAssertFrozen(parsedToolchain);
    recursivelyAssertFrozen(parsedAttestation);

    const driftedSource: any = structuredClone(
      attestation.sourceAdmissionReceipt,
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
      attestation.sourceAdmissionReceipt,
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
      attestation.sourceAdmissionReceipt,
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
      attestation.sourceAdmissionReceipt,
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
      attestation.firstBuildReceipt,
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
      attestation.firstBuildReceipt,
    );
    driftedResult.process.commandResult.platformFileCount += 1;
    rebindCommandResult(driftedResult);
    assert.equal(
      PlatformReleaseBuildReceiptV2Schema.safeParse(driftedResult).success,
      false,
    );

    const driftedSourceCount: any = structuredClone(
      attestation.firstBuildReceipt,
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
      attestation.firstBuildReceipt,
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
      attestation.firstBuildReceipt,
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
      attestation.buildToolchainReceipt,
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
    const baseEnvelope =
      createPlatformReleaseCandidateEnvelopeFixtureV2();
    const manifest = baseEnvelope.manifest;

    const aliasedBuild: any = structuredClone(baseEnvelope);
    aliasedBuild.buildAttestation.secondBuildReceipt.stage
      .outputStagePhysicalIdentityHash =
        aliasedBuild.buildAttestation.firstBuildReceipt.stage
          .outputStagePhysicalIdentityHash;
    aliasedBuild.buildAttestation.secondBuildReceipt.receiptHash =
      hashPlatformReleaseBuildReceiptV2(
        aliasedBuild.buildAttestation.secondBuildReceipt,
      );
    aliasedBuild.buildAttestation.secondBuildReceiptHash =
      aliasedBuild.buildAttestation.secondBuildReceipt.receiptHash;
    rehashAttestation(aliasedBuild);

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

    const wrongBuildSource: any = structuredClone(baseEnvelope);
    const wrongSha = fixtureShaV2("wrong-build-source").slice(0, 40);
    for (const key of [
      "firstBuildReceipt",
      "secondBuildReceipt",
    ] as const) {
      const receipt = wrongBuildSource.buildAttestation[key];
      receipt.process.commandResult.sourceSha = wrongSha;
      rebindCommandResult(receipt);
      wrongBuildSource.buildAttestation[`${key}Hash`] =
        receipt.receiptHash;
    }
    rehashAttestation(wrongBuildSource);

    const sourceVerifierDrift: any =
      structuredClone(baseEnvelope);
    sourceVerifierDrift.buildAttestation.sourceAdmissionReceipt
      .implementation.module.hostAdmissionReceipt
      .verifier.abiHash = fixtureShaV2(
        "different-source-host-verifier",
      );
    rebindSourceAdmission(sourceVerifierDrift);

    const sourceGitVerifierDrift: any =
      structuredClone(baseEnvelope);
    sourceGitVerifierDrift.buildAttestation.sourceAdmissionReceipt
      .gitTool.executable.hostAdmissionReceipt
      .verifier.abiHash = fixtureShaV2(
        "different-source-git-host-verifier",
      );
    rebindSourceAdmission(sourceGitVerifierDrift);

    const detachedSourceStage: any =
      structuredClone(baseEnvelope);
    for (const key of [
      "firstBuildReceipt",
      "secondBuildReceipt",
    ] as const) {
      const receipt = detachedSourceStage.buildAttestation[key];
      receipt.stage.sourceStagePhysicalIdentityHash =
        fixtureShaV2("detached-source-stage");
      receipt.receiptHash =
        hashPlatformReleaseBuildReceiptV2(receipt);
      detachedSourceStage.buildAttestation[`${key}Hash`] =
        receipt.receiptHash;
    }
    rehashAttestation(detachedSourceStage);

    const detachedToolchain: any =
      structuredClone(baseEnvelope);
    detachedToolchain.buildAttestation.secondBuildReceipt
      .buildToolchain.treeHash =
      fixtureShaV2("detached-build-toolchain-tree");
    detachedToolchain.buildAttestation.secondBuildReceipt
      .buildToolchain.bindingHash =
      buildModule.hashPlatformReleaseBuildToolchainTreeBindingV2(
        detachedToolchain.buildAttestation.secondBuildReceipt
          .buildToolchain,
      );
    detachedToolchain.buildAttestation.secondBuildReceipt
      .process.commandResult
      .buildToolchainTreeHash =
        detachedToolchain.buildAttestation.secondBuildReceipt
          .buildToolchain
          .treeHash;
    rebindCommandResult(
      detachedToolchain.buildAttestation.secondBuildReceipt,
    );
    detachedToolchain.buildAttestation.secondBuildReceiptHash =
      detachedToolchain.buildAttestation
        .secondBuildReceipt.receiptHash;
    rehashAttestation(detachedToolchain);

    const transplantedAttestation: any =
      structuredClone(baseEnvelope);
    transplantedAttestation.buildAttestation.releaseContentHash =
      fixtureShaV2("other-release-content");
    transplantedAttestation.buildAttestation.attestationHash =
      hashPlatformReleaseBuildAttestationV2(
        transplantedAttestation.buildAttestation,
      );
    assert.equal(
      PlatformReleaseBuildAttestationV2Schema.safeParse(
        transplantedAttestation.buildAttestation,
      ).success,
      true,
    );

    for (const candidate of [
      networkDrift,
      profileDrift,
    ]) {
      assert.equal(
        PlatformReleaseManifestV2Schema.safeParse(candidate).success,
        false,
      );
    }
    for (const candidate of [
      aliasedBuild,
      wrongBuildSource,
      sourceVerifierDrift,
      sourceGitVerifierDrift,
      detachedSourceStage,
      detachedToolchain,
      transplantedAttestation,
    ]) {
      assert.equal(
        PlatformReleaseCandidateEnvelopeV2Schema
          .safeParse(candidate).success,
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
    assert.throws(
      () => parsePlatformReleaseBuildAttestationCandidateV2(hostile),
    );
    assert.throws(
      () => parsePlatformReleaseCandidateEnvelopeV2(hostile),
    );
    assert.equal(traps, 0);

    for (const exports of [
      Object.keys(manifestModule),
      Object.keys(attestationModule),
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
