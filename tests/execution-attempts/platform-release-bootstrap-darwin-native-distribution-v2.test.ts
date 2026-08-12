import assert from "node:assert/strict";
import {
  createHash,
  generateKeyPairSync,
  sign,
  type KeyObject,
} from "node:crypto";
import { describe, it } from "node:test";

import {
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_ARCHITECTURES_V2,
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_CATALOG_V2_SCHEMA,
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_CONTRACT_V2,
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_ENTRY_V2_SCHEMA,
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_PRODUCTION_TRUST_CONFIGURATION_V2,
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_PRODUCTION_USE_V2,
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_PROVIDER_MAX_ARTIFACT_BYTES_V2,
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_PROVIDER_MEMBER_REF_V2,
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_SELECTION_INPUT_V2_SCHEMA,
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_VERIFICATION_INPUT_MAX_CANONICAL_BYTES_V2,
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_VERIFICATION_INPUT_V2_SCHEMA,
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SIGNED_NATIVE_DISTRIBUTION_CATALOG_V2_SCHEMA,
  PlatformReleaseBootstrapDarwinNativeDistributionMechanicsErrorV2,
  buildPlatformReleaseBootstrapDarwinNativeDistributionCatalogSigningPreimageV2,
  canonicalizePlatformReleaseBootstrapDarwinNativeDistributionCatalogSigningPreimageV2,
  hashPlatformReleaseBootstrapDarwinNativeDistributionCatalogSigningPreimageV2,
  hashPlatformReleaseBootstrapDarwinNativeDistributionCatalogV2,
  hashPlatformReleaseBootstrapDarwinNativeDistributionEntryV2,
  hashPlatformReleaseBootstrapDarwinSignedNativeDistributionCatalogV2,
  parsePlatformReleaseBootstrapDarwinNativeDistributionCatalogCandidateV2,
  parsePlatformReleaseBootstrapDarwinNativeDistributionContractCandidateV2,
  parsePlatformReleaseBootstrapDarwinNativeDistributionEntryCandidateV2,
  parsePlatformReleaseBootstrapDarwinSignedNativeDistributionCatalogCandidateV2,
  selectPlatformReleaseBootstrapDarwinNativeDistributionEntryMechanicsV2,
  verifyPlatformReleaseBootstrapDarwinNativeDistributionCatalogSignatureMechanicsV2,
  type PlatformReleaseBootstrapDarwinNativeDistributionCatalogV2,
  type PlatformReleaseBootstrapDarwinNativeDistributionVerificationReceiptV2,
  type PlatformReleaseBootstrapDarwinSignedNativeDistributionCatalogV2,
} from "../../src/execution/schemas/platform-release-bootstrap-darwin-native-distribution-v2.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2,
} from "../../src/execution/schemas/platform-release-bootstrap-contract-v2.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_OPERATION_ABI_SET_V2,
  PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2,
} from "../../src/execution/schemas/platform-release-bootstrap-operation-abis-v2.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CAPTURE_TRANSCRIPT_CONTRACT_V2,
} from "../../src/execution/schemas/platform-release-bootstrap-darwin-capture-transcripts-v2.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_ABI_SET_V2,
} from "../../src/execution/schemas/platform-release-bootstrap-darwin-filesystem-backend-v2.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_PRODUCTION_ERROR_CODE_V2,
  PlatformReleaseBootstrapDarwinFilesystemBackendAuthorityErrorV2,
  PlatformReleaseBootstrapDarwinFilesystemBackendCapabilityV2,
  openProductionAuthenticatedDarwinFilesystemBackendV2,
} from "../../src/execution/platform-release-bootstrap-darwin-filesystem-backend-authority-v2.js";
import { PLATFORM_RELEASE_COMPONENT_VERSION_V2 } from "../../src/execution/schemas/platform-release-common-v2.js";
import * as nativeDistributionApiV2 from "../../src/execution/schemas/platform-release-bootstrap-darwin-native-distribution-v2.js";

function hashV2(label: string): string {
  return createHash("sha256").update(label, "utf8").digest("hex");
}

function keyDerV2(publicKey: KeyObject): Buffer {
  const der = publicKey.export({ format: "der", type: "spki" });
  assert.ok(Buffer.isBuffer(der));
  return der;
}

function entryV2(
  architecture: "arm64" | "x64",
  distributionEpoch = 7,
): Record<string, unknown> {
  const identity = {
    schema:
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_ENTRY_V2_SCHEMA,
    version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
    distributionContractHash:
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_CONTRACT_V2.contractHash,
    providerPackageRef: PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.hostVerifier,
    providerMemberRef:
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_PROVIDER_MEMBER_REF_V2,
    architecture,
    distributionEpoch,
    artifactByteLength: architecture === "arm64" ? 1_001 : 1_002,
    artifactContentHash: hashV2(`${architecture}:artifact`),
    codeDirectoryHash: hashV2(`${architecture}:code-directory`),
    sourceTreeHash: hashV2(`${architecture}:source-tree`),
    buildRecipeHash: hashV2(`${architecture}:build-recipe`),
    buildAttestationHash: hashV2(`${architecture}:build-attestation`),
    packageManifestHash: hashV2(`${architecture}:package-manifest`),
    registryContractHash: PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.contractHash,
    operationAbiSetHash:
      PLATFORM_RELEASE_BOOTSTRAP_OPERATION_ABI_SET_V2.abiSetHash,
    backendAbiHash:
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_ABI_SET_V2.backendAbiHash,
    captureTranscriptContractHash:
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CAPTURE_TRANSCRIPT_CONTRACT_V2.captureTranscriptContractHash,
  };
  return {
    ...identity,
    entryHash:
      hashPlatformReleaseBootstrapDarwinNativeDistributionEntryV2(identity),
  };
}

function rehashEntryV2(entry: Record<string, unknown>): void {
  entry.entryHash =
    hashPlatformReleaseBootstrapDarwinNativeDistributionEntryV2(entry);
}

function catalogV2(
  offlineReleaseKeyId: string,
  distributionEpoch = 7,
): Record<string, unknown> {
  const identity = {
    schema:
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_CATALOG_V2_SCHEMA,
    version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
    productionUse:
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_PRODUCTION_USE_V2,
    distributionContractHash:
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_CONTRACT_V2.contractHash,
    installerPackageIdentifier: "com.setfarm.bootstrap.native-v2",
    developerTeamIdentityHash: hashV2("developer-team"),
    designatedRequirementHash: hashV2("designated-requirement"),
    hardenedRuntimePolicyHash: hashV2("hardened-runtime"),
    libraryValidationPolicyHash: hashV2("library-validation"),
    distributionEpoch,
    offlineReleaseKeyId,
    entries: [
      entryV2("arm64", distributionEpoch),
      entryV2("x64", distributionEpoch),
    ],
  };
  return {
    ...identity,
    catalogHash:
      hashPlatformReleaseBootstrapDarwinNativeDistributionCatalogV2(identity),
  };
}

function rehashCatalogV2(catalog: Record<string, unknown>): void {
  catalog.catalogHash =
    hashPlatformReleaseBootstrapDarwinNativeDistributionCatalogV2(catalog);
}

function signedEnvelopeV2(
  catalog: PlatformReleaseBootstrapDarwinNativeDistributionCatalogV2,
  signingKey: KeyObject,
): PlatformReleaseBootstrapDarwinSignedNativeDistributionCatalogV2 {
  const preimage =
    canonicalizePlatformReleaseBootstrapDarwinNativeDistributionCatalogSigningPreimageV2(
      catalog,
    );
  const identity = {
    schema:
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SIGNED_NATIVE_DISTRIBUTION_CATALOG_V2_SCHEMA,
    version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
    productionUse:
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_PRODUCTION_USE_V2,
    signatureAlgorithm: "ed25519" as const,
    offlineReleaseKeyId: catalog.offlineReleaseKeyId,
    catalog,
    signingPreimageHash:
      hashPlatformReleaseBootstrapDarwinNativeDistributionCatalogSigningPreimageV2(
        catalog,
      ),
    offlineSignature: sign(
      null,
      Buffer.from(preimage, "utf8"),
      signingKey,
    ).toString("base64"),
  };
  return parsePlatformReleaseBootstrapDarwinSignedNativeDistributionCatalogCandidateV2(
    {
      ...identity,
      signedEnvelopeHash:
        hashPlatformReleaseBootstrapDarwinSignedNativeDistributionCatalogV2(
          identity,
        ),
    },
  );
}

function fixtureV2(distributionEpoch = 7): Readonly<{
  publicKey: KeyObject;
  privateKey: KeyObject;
  publicKeyDer: Buffer;
  catalog: PlatformReleaseBootstrapDarwinNativeDistributionCatalogV2;
  envelope: PlatformReleaseBootstrapDarwinSignedNativeDistributionCatalogV2;
}> {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const publicKeyDer = keyDerV2(publicKey);
  const keyId = createHash("sha256").update(publicKeyDer).digest("hex");
  const catalog =
    parsePlatformReleaseBootstrapDarwinNativeDistributionCatalogCandidateV2(
      catalogV2(keyId, distributionEpoch),
    );
  return Object.freeze({
    publicKey,
    privateKey,
    publicKeyDer,
    catalog,
    envelope: signedEnvelopeV2(catalog, privateKey),
  });
}

function verifyV2(
  fixture: ReturnType<typeof fixtureV2>,
): PlatformReleaseBootstrapDarwinNativeDistributionVerificationReceiptV2 {
  return verifyPlatformReleaseBootstrapDarwinNativeDistributionCatalogSignatureMechanicsV2(
    {
      schema:
        PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_VERIFICATION_INPUT_V2_SCHEMA,
      publicKeySpkiDerBase64: fixture.publicKeyDer.toString("base64"),
      signedEnvelope: fixture.envelope,
    },
  );
}

function selectV2(
  fixture: ReturnType<typeof fixtureV2>,
  receipt: PlatformReleaseBootstrapDarwinNativeDistributionVerificationReceiptV2,
  architecture: "arm64" | "x64",
  durableEpochFloor: number,
) {
  return selectPlatformReleaseBootstrapDarwinNativeDistributionEntryMechanicsV2(
    receipt,
    {
      schema:
        PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_SELECTION_INPUT_V2_SCHEMA,
      signedEnvelope: fixture.envelope,
      architecture,
      durableEpochFloor,
    },
  );
}

function recursivelyFrozenV2(value: unknown): boolean {
  if (value === null || typeof value !== "object") return true;
  if (!Object.isFrozen(value)) return false;
  return Object.values(value).every(recursivelyFrozenV2);
}

function expectMechanicsCodeV2(
  action: () => unknown,
  code:
    PlatformReleaseBootstrapDarwinNativeDistributionMechanicsErrorV2["code"],
): void {
  assert.throws(action, (error: unknown) => {
    assert.ok(
      error instanceof
        PlatformReleaseBootstrapDarwinNativeDistributionMechanicsErrorV2,
    );
    assert.equal(error.code, code);
    return true;
  });
}

describe("platform release Darwin signed native distribution v2", () => {
  it("freezes the exact code-owned host-verifier provider and ABI contract", () => {
    const contract =
      parsePlatformReleaseBootstrapDarwinNativeDistributionContractCandidateV2(
        structuredClone(
          PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_CONTRACT_V2,
        ),
      );
    const providerPackage = PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.packages.find(
      (entry) =>
        entry.packageRef === PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.hostVerifier,
    )!;
    const providerMember = providerPackage.members.find(
      (entry) =>
        entry.memberRef ===
        PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_PROVIDER_MEMBER_REF_V2,
    )!;
    assert.equal(contract.providerPackageRef, providerPackage.packageRef);
    assert.equal(contract.providerMemberRef, providerMember.memberRef);
    assert.equal(providerPackage.packageKind, "signed_native_leaf");
    assert.equal(providerMember.role, "signed_native_executable");
    assert.equal(providerMember.mediaType, "application/x-mach-binary");
    assert.equal(providerMember.requiredMode, "0555");
    assert.equal(providerMember.requiredLinkCount, 1);
    assert.equal(
      contract.providerMaxArtifactBytes,
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_PROVIDER_MAX_ARTIFACT_BYTES_V2,
    );
    assert.deepEqual(contract.requiredArchitectures, ["arm64", "x64"]);
    assert.equal(
      contract.backendAbiHash,
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_ABI_SET_V2.backendAbiHash,
    );
    assert.equal(
      contract.captureTranscriptContractHash,
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CAPTURE_TRANSCRIPT_CONTRACT_V2.captureTranscriptContractHash,
    );
    assert.equal(recursivelyFrozenV2(contract), true);
  });

  it("verifies a canonical Ed25519 catalog and selects both exact architectures without authority promotion", () => {
    const fixture = fixtureV2();
    assert.deepEqual(
      fixture.catalog.entries.map((entry) => entry.architecture),
      [...PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_ARCHITECTURES_V2],
    );
    const preimage =
      buildPlatformReleaseBootstrapDarwinNativeDistributionCatalogSigningPreimageV2(
        fixture.catalog,
      );
    assert.equal(
      createHash("sha256")
        .update(
          canonicalizePlatformReleaseBootstrapDarwinNativeDistributionCatalogSigningPreimageV2(
            fixture.catalog,
          ),
          "utf8",
        )
        .digest("hex"),
      fixture.envelope.signingPreimageHash,
    );
    assert.equal(recursivelyFrozenV2(preimage), true);

    const receipt = verifyV2(fixture);
    assert.equal(receipt.productionAuthority, false);
    assert.equal(receipt.authorityState, "caller_supplied_test_mechanics_only");
    assert.equal(receipt.catalogHash, fixture.catalog.catalogHash);
    assert.deepEqual(
      receipt.orderedEntryHashes,
      fixture.catalog.entries.map((entry) => entry.entryHash),
    );
    assert.equal(recursivelyFrozenV2(receipt), true);

    const arm64 = selectV2(fixture, receipt, "arm64", 7);
    const x64 = selectV2(fixture, receipt, "x64", 1);
    for (const [selection, entryIndex, durableEpochFloor] of [
      [arm64, 0, 7],
      [x64, 1, 1],
    ] as const) {
      const entry = fixture.catalog.entries[entryIndex];
      assert.deepEqual(
        {
          authorityState: selection.authorityState,
          productionAuthority: selection.productionAuthority,
          providerPackageRef: selection.providerPackageRef,
          providerMemberRef: selection.providerMemberRef,
          architecture: selection.architecture,
          durableEpochFloor: selection.durableEpochFloor,
          distributionEpoch: selection.distributionEpoch,
          artifactByteLength: selection.artifactByteLength,
          artifactContentHash: selection.artifactContentHash,
          codeDirectoryHash: selection.codeDirectoryHash,
          sourceTreeHash: selection.sourceTreeHash,
          buildRecipeHash: selection.buildRecipeHash,
          buildAttestationHash: selection.buildAttestationHash,
          packageManifestHash: selection.packageManifestHash,
          registryContractHash: selection.registryContractHash,
          operationAbiSetHash: selection.operationAbiSetHash,
          backendAbiHash: selection.backendAbiHash,
          captureTranscriptContractHash:
            selection.captureTranscriptContractHash,
          installerPackageIdentifier: selection.installerPackageIdentifier,
          developerTeamIdentityHash: selection.developerTeamIdentityHash,
          designatedRequirementHash: selection.designatedRequirementHash,
          hardenedRuntimePolicyHash: selection.hardenedRuntimePolicyHash,
          libraryValidationPolicyHash: selection.libraryValidationPolicyHash,
          offlineReleaseKeyId: selection.offlineReleaseKeyId,
          distributionContractHash: selection.distributionContractHash,
          catalogHash: selection.catalogHash,
          entryHash: selection.entryHash,
          signingPreimageHash: selection.signingPreimageHash,
          signedEnvelopeHash: selection.signedEnvelopeHash,
          verificationReceiptHash: selection.verificationReceiptHash,
        },
        {
          authorityState: "caller_supplied_test_mechanics_only",
          productionAuthority: false,
          providerPackageRef: entry.providerPackageRef,
          providerMemberRef: entry.providerMemberRef,
          architecture: entry.architecture,
          durableEpochFloor,
          distributionEpoch: entry.distributionEpoch,
          artifactByteLength: entry.artifactByteLength,
          artifactContentHash: entry.artifactContentHash,
          codeDirectoryHash: entry.codeDirectoryHash,
          sourceTreeHash: entry.sourceTreeHash,
          buildRecipeHash: entry.buildRecipeHash,
          buildAttestationHash: entry.buildAttestationHash,
          packageManifestHash: entry.packageManifestHash,
          registryContractHash: entry.registryContractHash,
          operationAbiSetHash: entry.operationAbiSetHash,
          backendAbiHash: entry.backendAbiHash,
          captureTranscriptContractHash: entry.captureTranscriptContractHash,
          installerPackageIdentifier: fixture.catalog.installerPackageIdentifier,
          developerTeamIdentityHash: fixture.catalog.developerTeamIdentityHash,
          designatedRequirementHash: fixture.catalog.designatedRequirementHash,
          hardenedRuntimePolicyHash: fixture.catalog.hardenedRuntimePolicyHash,
          libraryValidationPolicyHash:
            fixture.catalog.libraryValidationPolicyHash,
          offlineReleaseKeyId: fixture.catalog.offlineReleaseKeyId,
          distributionContractHash: entry.distributionContractHash,
          catalogHash: fixture.catalog.catalogHash,
          entryHash: entry.entryHash,
          signingPreimageHash: fixture.envelope.signingPreimageHash,
          signedEnvelopeHash: fixture.envelope.signedEnvelopeHash,
          verificationReceiptHash: receipt.verificationReceiptHash,
        },
      );
      assert.equal(recursivelyFrozenV2(selection), true);
    }
  });

  it("allows epoch equal to the durable floor and rejects an epoch below it", () => {
    const fixture = fixtureV2(9);
    const receipt = verifyV2(fixture);
    assert.equal(selectV2(fixture, receipt, "arm64", 0).distributionEpoch, 9);
    assert.equal(selectV2(fixture, receipt, "arm64", 9).distributionEpoch, 9);
    expectMechanicsCodeV2(
      () => selectV2(fixture, receipt, "arm64", 10),
      "NATIVE_DISTRIBUTION_EPOCH_BELOW_FLOOR",
    );
    assert.throws(() => selectV2(fixture, receipt, "arm64", -1));
    assert.throws(() =>
      selectV2(fixture, receipt, "arm64", Number.MAX_SAFE_INTEGER + 1)
    );
  });

  it("rejects missing, duplicate, reordered and cross-architecture entries", () => {
    const fixture = fixtureV2();
    const variants: Record<string, unknown>[] = [];

    const missing = structuredClone(fixture.catalog) as unknown as Record<
      string,
      unknown
    >;
    (missing.entries as unknown[]).pop();
    rehashCatalogV2(missing);
    variants.push(missing);

    const duplicate = structuredClone(fixture.catalog) as unknown as Record<
      string,
      unknown
    >;
    const duplicateEntries = duplicate.entries as Record<string, unknown>[];
    duplicateEntries[1] = structuredClone(duplicateEntries[0]!);
    rehashCatalogV2(duplicate);
    variants.push(duplicate);

    const reordered = structuredClone(fixture.catalog) as unknown as Record<
      string,
      unknown
    >;
    (reordered.entries as unknown[]).reverse();
    rehashCatalogV2(reordered);
    variants.push(reordered);

    const crossArchitecture = structuredClone(
      fixture.catalog,
    ) as unknown as Record<string, unknown>;
    const crossEntries = crossArchitecture.entries as Record<string, unknown>[];
    crossEntries[0]!.architecture = "x64";
    rehashEntryV2(crossEntries[0]!);
    rehashCatalogV2(crossArchitecture);
    variants.push(crossArchitecture);

    for (const candidate of variants) {
      assert.throws(() =>
        parsePlatformReleaseBootstrapDarwinNativeDistributionCatalogCandidateV2(
          candidate,
        ),
      );
    }
  });

  it("rejects cross-package/member entries, zero epochs and oversized artifacts", () => {
    const fixture = fixtureV2();
    const mutations: Array<(entry: Record<string, unknown>) => void> = [
      (entry) => {
        entry.providerPackageRef =
          PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.runtimeAccountProvisioner;
      },
      (entry) => {
        entry.providerMemberRef =
          "BOOTSTRAP_RUNTIME_ACCOUNT_PROVISIONER_EXECUTABLE_V2";
      },
      (entry) => {
        entry.distributionEpoch = 0;
      },
      (entry) => {
        entry.artifactByteLength =
          PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_PROVIDER_MAX_ARTIFACT_BYTES_V2 +
          1;
      },
    ];
    for (const mutate of mutations) {
      const candidate = structuredClone(
        fixture.catalog.entries[0],
      ) as unknown as Record<string, unknown>;
      mutate(candidate);
      rehashEntryV2(candidate);
      assert.throws(() =>
        parsePlatformReleaseBootstrapDarwinNativeDistributionEntryCandidateV2(
          candidate,
        ),
      );
    }

    const zeroCatalog = structuredClone(
      fixture.catalog,
    ) as unknown as Record<string, unknown>;
    zeroCatalog.distributionEpoch = 0;
    for (const entry of zeroCatalog.entries as Record<string, unknown>[]) {
      entry.distributionEpoch = 0;
      rehashEntryV2(entry);
    }
    rehashCatalogV2(zeroCatalog);
    assert.throws(() =>
      parsePlatformReleaseBootstrapDarwinNativeDistributionCatalogCandidateV2(
        zeroCatalog,
      ),
    );
  });

  it("rejects fully rehashed semantic hash-role aliases while allowing one role across architectures", () => {
    const fixture = fixtureV2();
    const evidenceAliases = [
      "codeDirectoryHash",
      "sourceTreeHash",
      "buildRecipeHash",
      "buildAttestationHash",
      "packageManifestHash",
    ];
    for (const field of evidenceAliases) {
      const candidate = structuredClone(
        fixture.catalog,
      ) as unknown as Record<string, unknown>;
      const entries = candidate.entries as Record<string, unknown>[];
      entries[0]![field] = entries[0]!.artifactContentHash;
      rehashEntryV2(entries[0]!);
      rehashCatalogV2(candidate);
      assert.throws(() =>
        parsePlatformReleaseBootstrapDarwinNativeDistributionCatalogCandidateV2(
          candidate,
        )
      );
    }

    const evidenceToAbi = structuredClone(
      fixture.catalog,
    ) as unknown as Record<string, unknown>;
    const evidenceToAbiEntries =
      evidenceToAbi.entries as Record<string, unknown>[];
    evidenceToAbiEntries[0]!.artifactContentHash =
      evidenceToAbiEntries[0]!.backendAbiHash;
    rehashEntryV2(evidenceToAbiEntries[0]!);
    rehashCatalogV2(evidenceToAbi);
    assert.throws(() =>
      parsePlatformReleaseBootstrapDarwinNativeDistributionCatalogCandidateV2(
        evidenceToAbi,
      )
    );

    const crossFamily = structuredClone(
      fixture.catalog,
    ) as unknown as Record<string, unknown>;
    const crossFamilyEntries = crossFamily.entries as Record<string, unknown>[];
    crossFamily.developerTeamIdentityHash =
      crossFamilyEntries[0]!.artifactContentHash;
    rehashCatalogV2(crossFamily);
    assert.throws(() =>
      parsePlatformReleaseBootstrapDarwinNativeDistributionCatalogCandidateV2(
        crossFamily,
      )
    );

    const trustAlias = structuredClone(
      fixture.catalog,
    ) as unknown as Record<string, unknown>;
    trustAlias.libraryValidationPolicyHash =
      trustAlias.hardenedRuntimePolicyHash;
    rehashCatalogV2(trustAlias);
    assert.throws(() =>
      parsePlatformReleaseBootstrapDarwinNativeDistributionCatalogCandidateV2(
        trustAlias,
      )
    );

    const sameRole = structuredClone(
      fixture.catalog,
    ) as unknown as Record<string, unknown>;
    const sameRoleEntries = sameRole.entries as Record<string, unknown>[];
    sameRoleEntries[1]!.sourceTreeHash = sameRoleEntries[0]!.sourceTreeHash;
    rehashEntryV2(sameRoleEntries[1]!);
    rehashCatalogV2(sameRole);
    assert.doesNotThrow(() =>
      parsePlatformReleaseBootstrapDarwinNativeDistributionCatalogCandidateV2(
        sameRole,
      )
    );
  });

  it("rejects tamper-and-rehash when the old signature is retained", () => {
    const fixture = fixtureV2();
    const tampered = structuredClone(
      fixture.envelope,
    ) as unknown as Record<string, unknown>;
    const catalog = tampered.catalog as Record<string, unknown>;
    const entry = (catalog.entries as Record<string, unknown>[])[0]!;
    entry.artifactContentHash = hashV2("attacker-artifact");
    rehashEntryV2(entry);
    rehashCatalogV2(catalog);
    const parsedCatalog =
      parsePlatformReleaseBootstrapDarwinNativeDistributionCatalogCandidateV2(
        catalog,
      );
    tampered.signingPreimageHash =
      hashPlatformReleaseBootstrapDarwinNativeDistributionCatalogSigningPreimageV2(
        parsedCatalog,
      );
    tampered.signedEnvelopeHash =
      hashPlatformReleaseBootstrapDarwinSignedNativeDistributionCatalogV2(
        tampered,
      );
    expectMechanicsCodeV2(
      () =>
        verifyPlatformReleaseBootstrapDarwinNativeDistributionCatalogSignatureMechanicsV2(
          {
            schema:
              PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_VERIFICATION_INPUT_V2_SCHEMA,
            publicKeySpkiDerBase64: fixture.publicKeyDer.toString("base64"),
            signedEnvelope: tampered,
          },
        ),
      "NATIVE_DISTRIBUTION_SIGNATURE_INVALID",
    );
  });

  it("rejects wrong keys, explicit key-id mismatches and signature bit flips", () => {
    const fixture = fixtureV2();
    const wrong = fixtureV2();
    expectMechanicsCodeV2(
      () =>
        verifyPlatformReleaseBootstrapDarwinNativeDistributionCatalogSignatureMechanicsV2(
          {
            schema:
              PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_VERIFICATION_INPUT_V2_SCHEMA,
            publicKeySpkiDerBase64: wrong.publicKeyDer.toString("base64"),
            signedEnvelope: fixture.envelope,
          },
        ),
      "NATIVE_DISTRIBUTION_KEY_ID_MISMATCH",
    );

    const mismatchedCatalog = catalogV2(hashV2("unrelated-key"));
    const parsedMismatchedCatalog =
      parsePlatformReleaseBootstrapDarwinNativeDistributionCatalogCandidateV2(
        mismatchedCatalog,
      );
    const mismatchedEnvelope = signedEnvelopeV2(
      parsedMismatchedCatalog,
      fixture.privateKey,
    );
    expectMechanicsCodeV2(
      () =>
        verifyPlatformReleaseBootstrapDarwinNativeDistributionCatalogSignatureMechanicsV2(
          {
            schema:
              PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_VERIFICATION_INPUT_V2_SCHEMA,
            publicKeySpkiDerBase64: fixture.publicKeyDer.toString("base64"),
            signedEnvelope: mismatchedEnvelope,
          },
        ),
      "NATIVE_DISTRIBUTION_KEY_ID_MISMATCH",
    );

    const bitFlipped = structuredClone(
      fixture.envelope,
    ) as unknown as Record<string, unknown>;
    const signatureBytes = Buffer.from(
      bitFlipped.offlineSignature as string,
      "base64",
    );
    signatureBytes[0] = signatureBytes[0]! ^ 1;
    bitFlipped.offlineSignature = signatureBytes.toString("base64");
    bitFlipped.signedEnvelopeHash =
      hashPlatformReleaseBootstrapDarwinSignedNativeDistributionCatalogV2(
        bitFlipped,
      );
    expectMechanicsCodeV2(
      () =>
        verifyPlatformReleaseBootstrapDarwinNativeDistributionCatalogSignatureMechanicsV2(
          {
            schema:
              PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_VERIFICATION_INPUT_V2_SCHEMA,
            publicKeySpkiDerBase64: fixture.publicKeyDer.toString("base64"),
            signedEnvelope: bitFlipped,
          },
        ),
      "NATIVE_DISTRIBUTION_SIGNATURE_INVALID",
    );
  });

  it("rejects malformed/noncanonical signatures and non-Ed25519 SPKI", () => {
    const fixture = fixtureV2();
    for (const signature of [
      "A".repeat(87),
      `${"A".repeat(86)}=A`,
      `${"A".repeat(86)}__`,
      `${"A".repeat(85)}B==`,
    ]) {
      const malformed = structuredClone(
        fixture.envelope,
      ) as unknown as Record<string, unknown>;
      malformed.offlineSignature = signature;
      malformed.signedEnvelopeHash =
        hashPlatformReleaseBootstrapDarwinSignedNativeDistributionCatalogV2(
          malformed,
        );
      assert.throws(() =>
        parsePlatformReleaseBootstrapDarwinSignedNativeDistributionCatalogCandidateV2(
          malformed,
        ),
      );
    }

    const { publicKey } = generateKeyPairSync("ec", {
      namedCurve: "prime256v1",
    });
    const ecDer = keyDerV2(publicKey);
    const ecKeyId = createHash("sha256").update(ecDer).digest("hex");
    const ecCatalog =
      parsePlatformReleaseBootstrapDarwinNativeDistributionCatalogCandidateV2(
        catalogV2(ecKeyId),
      );
    const unsignedIdentity = {
      schema:
        PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SIGNED_NATIVE_DISTRIBUTION_CATALOG_V2_SCHEMA,
      version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
      productionUse:
        PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_PRODUCTION_USE_V2,
      signatureAlgorithm: "ed25519" as const,
      offlineReleaseKeyId: ecKeyId,
      catalog: ecCatalog,
      signingPreimageHash:
        hashPlatformReleaseBootstrapDarwinNativeDistributionCatalogSigningPreimageV2(
          ecCatalog,
        ),
      offlineSignature: Buffer.alloc(64).toString("base64"),
    };
    const ecEnvelope =
      parsePlatformReleaseBootstrapDarwinSignedNativeDistributionCatalogCandidateV2(
        {
          ...unsignedIdentity,
          signedEnvelopeHash:
            hashPlatformReleaseBootstrapDarwinSignedNativeDistributionCatalogV2(
              unsignedIdentity,
            ),
        },
      );
    expectMechanicsCodeV2(
      () =>
        verifyPlatformReleaseBootstrapDarwinNativeDistributionCatalogSignatureMechanicsV2(
          {
            schema:
              PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_VERIFICATION_INPUT_V2_SCHEMA,
            publicKeySpkiDerBase64: ecDer.toString("base64"),
            signedEnvelope: ecEnvelope,
          },
        ),
      "NATIVE_DISTRIBUTION_PUBLIC_KEY_INVALID",
    );
  });

  it("rejects a verification receipt paired with another signed catalog and serialized receipt replay", () => {
    const first = fixtureV2();
    const second = fixtureV2();
    const receipt = verifyV2(first);
    expectMechanicsCodeV2(
      () => selectV2(second, receipt, "arm64", 1),
      "NATIVE_DISTRIBUTION_SELECTION_MISMATCH",
    );

    const sameKeyCatalog =
      parsePlatformReleaseBootstrapDarwinNativeDistributionCatalogCandidateV2(
        catalogV2(first.catalog.offlineReleaseKeyId, 8),
      );
    const sameKeyEnvelope = signedEnvelopeV2(
      sameKeyCatalog,
      first.privateKey,
    );
    expectMechanicsCodeV2(
      () =>
        selectPlatformReleaseBootstrapDarwinNativeDistributionEntryMechanicsV2(
          receipt,
          {
            schema:
              PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_SELECTION_INPUT_V2_SCHEMA,
            signedEnvelope: sameKeyEnvelope,
            architecture: "arm64",
            durableEpochFloor: 1,
          },
        ),
      "NATIVE_DISTRIBUTION_SELECTION_MISMATCH",
    );
    expectMechanicsCodeV2(
      () =>
        selectV2(
          first,
          structuredClone(receipt),
          "arm64",
          1,
        ),
      "NATIVE_DISTRIBUTION_VERIFICATION_RECEIPT_UNAUTHENTICATED",
    );
  });

  it("fails closed on proxy, accessor, cycle and oversized candidates without invoking hostile traps", () => {
    const fixture = fixtureV2();
    let proxyReads = 0;
    const proxy = new Proxy(structuredClone(fixture.catalog), {
      get() {
        proxyReads += 1;
        throw new Error("proxy trap must not run");
      },
      ownKeys() {
        proxyReads += 1;
        throw new Error("proxy trap must not run");
      },
    });
    assert.throws(() =>
      parsePlatformReleaseBootstrapDarwinNativeDistributionCatalogCandidateV2(
        proxy,
      ),
    );
    assert.equal(proxyReads, 0);

    const verificationProxy = new Proxy({}, {
      get() {
        proxyReads += 1;
        throw new Error("verification proxy trap must not run");
      },
      ownKeys() {
        proxyReads += 1;
        throw new Error("verification proxy trap must not run");
      },
    });
    assert.throws(() =>
      verifyPlatformReleaseBootstrapDarwinNativeDistributionCatalogSignatureMechanicsV2(
        verificationProxy,
      ),
    );
    assert.equal(proxyReads, 0);

    let accessorReads = 0;
    const accessor = structuredClone(
      fixture.catalog,
    ) as unknown as Record<string, unknown>;
    Object.defineProperty(accessor, "catalogHash", {
      enumerable: true,
      configurable: true,
      get() {
        accessorReads += 1;
        throw new Error("accessor must not run");
      },
    });
    assert.throws(() =>
      parsePlatformReleaseBootstrapDarwinNativeDistributionCatalogCandidateV2(
        accessor,
      ),
    );
    assert.equal(accessorReads, 0);

    const authenticReceipt = verifyV2(fixture);
    let receiptProxyReads = 0;
    const receiptProxy = new Proxy(authenticReceipt, {
      get() {
        receiptProxyReads += 1;
        throw new Error("receipt proxy trap must not run");
      },
      ownKeys() {
        receiptProxyReads += 1;
        throw new Error("receipt proxy trap must not run");
      },
    });
    expectMechanicsCodeV2(
      () => selectV2(fixture, receiptProxy, "arm64", 1),
      "NATIVE_DISTRIBUTION_VERIFICATION_RECEIPT_UNAUTHENTICATED",
    );
    assert.equal(receiptProxyReads, 0);

    const selectionAccessor = {
      schema:
        PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_SELECTION_INPUT_V2_SCHEMA,
      signedEnvelope: fixture.envelope,
      architecture: "arm64",
      durableEpochFloor: 1,
    } as Record<string, unknown>;
    Object.defineProperty(selectionAccessor, "architecture", {
      enumerable: true,
      configurable: true,
      get() {
        accessorReads += 1;
        throw new Error("selection accessor must not run");
      },
    });
    assert.throws(() =>
      selectPlatformReleaseBootstrapDarwinNativeDistributionEntryMechanicsV2(
        authenticReceipt,
        selectionAccessor,
      ),
    );
    assert.equal(accessorReads, 0);

    const cycle = structuredClone(
      fixture.catalog,
    ) as unknown as Record<string, unknown>;
    cycle.cycle = cycle;
    assert.throws(() =>
      parsePlatformReleaseBootstrapDarwinNativeDistributionCatalogCandidateV2(
        cycle,
      ),
    );

    assert.throws(() =>
      verifyPlatformReleaseBootstrapDarwinNativeDistributionCatalogSignatureMechanicsV2(
        {
          schema:
            PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_VERIFICATION_INPUT_V2_SCHEMA,
          publicKeySpkiDerBase64: fixture.publicKeyDer.toString("base64"),
          signedEnvelope: fixture.envelope,
          oversized: "x".repeat(
            PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_VERIFICATION_INPUT_MAX_CANONICAL_BYTES_V2,
          ),
        },
      ),
    );

    let nestedProxyReads = 0;
    const nestedProxy = new Proxy({}, {
      get() {
        nestedProxyReads += 1;
        throw new Error("nested proxy trap must not run");
      },
      ownKeys() {
        nestedProxyReads += 1;
        throw new Error("nested proxy trap must not run");
      },
    });
    assert.throws(() =>
      verifyPlatformReleaseBootstrapDarwinNativeDistributionCatalogSignatureMechanicsV2(
        {
          aOversized: "x".repeat(
            PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_VERIFICATION_INPUT_MAX_CANONICAL_BYTES_V2,
          ),
          zHostile: nestedProxy,
        },
      ),
    );
    assert.equal(nestedProxyReads, 0);
  });

  it("exposes no ambient execution or secret-key surface in public contract data", () => {
    const fixture = fixtureV2();
    const receipt = verifyV2(fixture);
    const selection = selectV2(fixture, receipt, "arm64", 1);
    const publicValues = [
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_CONTRACT_V2,
      fixture.catalog,
      fixture.envelope,
      receipt,
      selection,
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_PRODUCTION_TRUST_CONFIGURATION_V2,
    ];
    assert.equal(recursivelyFrozenV2(fixture.catalog), true);
    assert.equal(recursivelyFrozenV2(fixture.envelope), true);
    assert.equal(
      recursivelyFrozenV2(
        PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_PRODUCTION_TRUST_CONFIGURATION_V2,
      ),
      true,
    );
    const fieldNames: string[] = [];
    const visit = (value: unknown): void => {
      if (Array.isArray(value)) {
        value.forEach(visit);
        return;
      }
      if (value === null || typeof value !== "object") return;
      for (const [key, child] of Object.entries(value)) {
        fieldNames.push(key);
        visit(child);
      }
    };
    publicValues.forEach(visit);
    assert.deepEqual(
      fieldNames.filter((field) =>
        /(?:spawn|exec(?:ute|ution)?|shell|compiler|process|argv|cwd|(?:^|_)env(?:$|_)|path|locator|(?:^|_)fd(?:$|_)|descriptor|callback|command|private)/i.test(
          field,
        ),
      ),
      [],
    );
    assert.deepEqual(
      Object.keys(nativeDistributionApiV2).filter((name) =>
        /(?:spawn|exec(?:ute|ution)?|shell|compiler|process|argv|cwd|(?:^|_)env(?:$|_)|path|locator|(?:^|_)fd(?:$|_)|descriptor|callback|command|private)/i.test(
          name,
        ),
      ),
      [],
    );
    assert.doesNotMatch(
      JSON.stringify([
        PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_CONTRACT_V2,
        fixture.catalog,
      ]),
      /backend(?:Authority|Capability)/i,
    );
    assert.equal(
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_PRODUCTION_TRUST_CONFIGURATION_V2.state,
      "unavailable",
    );
    assert.equal(
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_PRODUCTION_TRUST_CONFIGURATION_V2.offlineReleasePublicKeySpkiDerBase64,
      null,
    );
    assert.equal(
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_PRODUCTION_TRUST_CONFIGURATION_V2.signedNativeDistributionCatalog,
      null,
    );
  });

  it("cannot turn serialized catalog mechanics into a backend capability and leaves the zero-input opener inert", async () => {
    const fixture = fixtureV2();
    const receipt = verifyV2(fixture);
    assert.throws(
      () =>
        new PlatformReleaseBootstrapDarwinFilesystemBackendCapabilityV2(
          structuredClone(receipt),
          {} as never,
        ),
      (error: unknown) => {
        assert.ok(
          error instanceof
            PlatformReleaseBootstrapDarwinFilesystemBackendAuthorityErrorV2,
        );
        assert.equal(
          error.code,
          "DARWIN_FILESYSTEM_BACKEND_HANDLE_UNAUTHENTICATED",
        );
        return true;
      },
    );

    assert.equal(openProductionAuthenticatedDarwinFilesystemBackendV2.length, 0);
    let hostileReads = 0;
    const hostile = new Proxy({}, {
      get() {
        hostileReads += 1;
        return undefined;
      },
    });
    await assert.rejects(
      async () =>
        Reflect.apply(
          openProductionAuthenticatedDarwinFilesystemBackendV2,
          undefined,
          [hostile],
        ),
      (error: unknown) => {
        assert.ok(
          error instanceof
            PlatformReleaseBootstrapDarwinFilesystemBackendAuthorityErrorV2,
        );
        assert.equal(
          error.code,
          PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_PRODUCTION_ERROR_CODE_V2,
        );
        return true;
      },
    );
    assert.equal(hostileReads, 0);
  });
});
