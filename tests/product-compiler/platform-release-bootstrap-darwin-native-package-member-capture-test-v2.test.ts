import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign, type KeyObject } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2,
  PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_SHARED_LOCK_CONTENT_V2,
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
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_CATALOG_V2_SCHEMA,
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_CONTRACT_V2,
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_ENTRY_V2_SCHEMA,
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_PROVIDER_MEMBER_REF_V2,
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_PRODUCTION_USE_V2,
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_SELECTION_INPUT_V2_SCHEMA,
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_VERIFICATION_INPUT_V2_SCHEMA,
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SIGNED_NATIVE_DISTRIBUTION_CATALOG_V2_SCHEMA,
  hashPlatformReleaseBootstrapDarwinNativeDistributionCatalogSigningPreimageV2,
  canonicalizePlatformReleaseBootstrapDarwinNativeDistributionCatalogSigningPreimageV2,
  hashPlatformReleaseBootstrapDarwinNativeDistributionCatalogV2,
  hashPlatformReleaseBootstrapDarwinNativeDistributionEntryV2,
  hashPlatformReleaseBootstrapDarwinSignedNativeDistributionCatalogV2,
  parsePlatformReleaseBootstrapDarwinNativeDistributionCatalogCandidateV2,
  parsePlatformReleaseBootstrapDarwinNativeDistributionContractCandidateV2,
  parsePlatformReleaseBootstrapDarwinSignedNativeDistributionCatalogCandidateV2,
  verifyPlatformReleaseBootstrapDarwinNativeDistributionCatalogSignatureMechanicsV2,
} from "../../src/execution/schemas/platform-release-bootstrap-darwin-native-distribution-v2.js";
import { PLATFORM_RELEASE_COMPONENT_VERSION_V2 } from "../../src/execution/schemas/platform-release-common-v2.js";
import {
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_LOCK_CONTENT_V2,
} from "../../src/product-compiler/schemas/node-toolchain-provisioner-bootstrap-installation-state-v2.js";
import {
  buildBootstrapFilesystemScopeIdentityV2,
  buildDirectoryMembershipIdentityV2,
  buildFsObservationFingerprintV2,
  hashFsObservationFingerprintV2,
  hashStableFsObjectIdentityV2,
  buildNamespacePhysicalCensusV2,
  buildNamespacePhysicalEntryCaptureV2,
  buildStableFsObjectIdentityV2,
  type NamespacePhysicalCensusV2,
} from "../../src/product-compiler/platform-release-bootstrap-physical-census-v2.js";
import {
  classifyPlatformReleaseBootstrapNamespaceCensusV2,
} from "../../src/product-compiler/platform-release-bootstrap-registry-v2.js";
import {
  buildPlatformReleaseBootstrapRegistryPackagePhysicalSnapshotTestV2,
} from "../../src/product-compiler/platform-release-bootstrap-registry-package-physical-snapshot-test-support-v2.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_COOPERATIVE_CAPTURE_CAPABILITY_V2,
} from "../../src/product-compiler/platform-release-bootstrap-filesystem-capture-core-v2.js";
import {
  buildPlatformReleaseBootstrapDarwinNativePackageMemberCaptureTestV2,
  parsePlatformReleaseBootstrapDarwinNativePackageMemberCaptureTestCandidateV2,
  PlatformReleaseBootstrapDarwinNativePackageMemberCaptureTestErrorV2,
} from "../../src/product-compiler/platform-release-bootstrap-darwin-native-package-member-capture-test-support-v2.js";
import { canonicalJsonStringify } from "../../src/product-compiler/canonical-json.js";

const contract = PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2;
const packageRefs = Object.freeze([
  PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.hostVerifier,
  PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.nodeToolchainProvisioner,
  PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.platformReleaseComposition,
  PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.runtimeAccountProvisioner,
] as const);

function sha256V2(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function expectedLockContentV2(packageRef: string): string {
  return packageRef === packageRefs[1]
    ? NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_LOCK_CONTENT_V2
    : [
        "setfarm.bootstrap-package-installation-lock.v2",
        `registryContractHash=${contract.contractHash}`,
        `packageRef=${packageRef}`,
        "",
      ].join("\n");
}

function expectedRootMembershipV2(packageRef: string) {
  const packageContract = contract.packages.find((entry) => entry.packageRef === packageRef)!;
  const root = packageContract.directories.find((entry) => entry.relativeLocator === ".")!;
  const directoryRefs = new Set(packageContract.directories.map((entry) => entry.directoryRef));
  return buildDirectoryMembershipIdentityV2({
    orderedEntries: root.orderedEntryRefs.map((memberRef, index) => ({
      basename: root.orderedEntryBasenames[index]!,
      objectKind: directoryRefs.has(memberRef) ? "directory" as const : "ordinary_file" as const,
    })).sort((left, right) => left.basename < right.basename ? -1 : left.basename > right.basename ? 1 : 0),
  });
}

function buildFixtureCensusV2(scopeNonce = "a".repeat(64)): NamespacePhysicalCensusV2 {
  const scope = buildBootstrapFilesystemScopeIdentityV2({ scopeNonce });
  const basenames = [
    contract.registry.filesystemScopeBasename,
    contract.registry.sharedLockBasename,
    ...packageRefs.flatMap((packageRef) => {
      const packageContract = contract.packages.find((entry) => entry.packageRef === packageRef)!;
      return [packageContract.rootBasename, packageContract.lifecycle.packageLockBasename];
    }),
  ];
  const logicalCensus = classifyPlatformReleaseBootstrapNamespaceCensusV2(basenames);
  const parentObjectIdentity = buildStableFsObjectIdentityV2({ filesystemScope: scope, objectKind: "directory", device: "7", inode: "100" });
  const parentFingerprint = buildFsObservationFingerprintV2({ objectIdentity: parentObjectIdentity, ownerUid: 0, ownerGid: 0, mode: "0755", linkCount: 1, byteLength: 2_048, modifiedTimeNanoseconds: "1000", changedTimeNanoseconds: "1001" });
  const orderedEntryCaptures = logicalCensus.orderedEntries.map((classification, index) => {
    const packageContract = classification.ownerKind === "package" ? contract.packages.find((entry) => entry.packageRef === classification.ownerRef)! : undefined;
    const isRoot = classification.category === "package_root";
    const isScope = classification.category === "filesystem_scope";
    const isSharedLock = classification.category === "shared_parent_lock";
    const byteLength = isRoot ? 256 : isScope ? Buffer.byteLength(canonicalJsonStringify(scope), "utf8") : isSharedLock ? Buffer.byteLength(PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_SHARED_LOCK_CONTENT_V2, "utf8") : packageContract === undefined ? 128 : Buffer.byteLength(expectedLockContentV2(packageContract.packageRef), "utf8");
    const objectIdentity = buildStableFsObjectIdentityV2({ filesystemScope: scope, objectKind: isRoot ? "directory" : "ordinary_file", device: "7", inode: String(200 + index) });
    const fingerprint = buildFsObservationFingerprintV2({ objectIdentity, ownerUid: 0, ownerGid: 0, mode: isRoot ? packageContract!.rootMode : "0600", linkCount: 1, byteLength, modifiedTimeNanoseconds: String(2_000 + index), changedTimeNanoseconds: String(3_000 + index) });
    const contentEvidence = isRoot ? { kind: "directory_membership" as const, membership: expectedRootMembershipV2(packageContract!.packageRef) } : { kind: "bounded_regular_file_bytes" as const, rawContentHash: isScope ? sha256V2(canonicalJsonStringify(scope)) : isSharedLock ? contract.registry.sharedLockContentHash : sha256V2(expectedLockContentV2(packageContract!.packageRef)) };
    return buildNamespacePhysicalEntryCaptureV2({ classification, parentObjectIdentityHash: parentObjectIdentity.objectIdentityHash, objectIdentity, fingerprint, contentEvidence });
  });
  return buildNamespacePhysicalCensusV2({ filesystemScope: scope, logicalCensus, parentObjectIdentity, parentFingerprint, orderedEntryCaptures });
}

function buildSnapshotV2(census: NamespacePhysicalCensusV2) {
  return buildPlatformReleaseBootstrapRegistryPackagePhysicalSnapshotTestV2({ physicalCensus: census, packageRefs });
}

function nativeFixtureV2() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const publicKeyDer = publicKey.export({ format: "der", type: "spki" }) as Buffer;
  const keyId = createHash("sha256").update(publicKeyDer).digest("hex");
  const entry = (architecture: "arm64" | "x64") => {
    const identity = {
      schema: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_ENTRY_V2_SCHEMA,
      version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
      distributionContractHash: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_CONTRACT_V2.contractHash,
      providerPackageRef: PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.hostVerifier,
      providerMemberRef: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_PROVIDER_MEMBER_REF_V2,
      architecture,
      distributionEpoch: 7,
      artifactByteLength: architecture === "arm64" ? 1_001 : 1_002,
      artifactContentHash: sha256V2(`${architecture}:artifact`),
      codeDirectoryHash: sha256V2(`${architecture}:code-directory`),
      sourceTreeHash: sha256V2(`${architecture}:source-tree`),
      buildRecipeHash: sha256V2(`${architecture}:build-recipe`),
      buildAttestationHash: sha256V2(`${architecture}:build-attestation`),
      packageManifestHash: sha256V2(`${architecture}:package-manifest`),
      registryContractHash: contract.contractHash,
      operationAbiSetHash: PLATFORM_RELEASE_BOOTSTRAP_OPERATION_ABI_SET_V2.abiSetHash,
      backendAbiHash: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_ABI_SET_V2.backendAbiHash,
      captureTranscriptContractHash: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CAPTURE_TRANSCRIPT_CONTRACT_V2.captureTranscriptContractHash,
    };
    return { ...identity, entryHash: hashPlatformReleaseBootstrapDarwinNativeDistributionEntryV2(identity) };
  };
  const catalogIdentity = {
    schema: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_CATALOG_V2_SCHEMA,
    version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
    productionUse: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_PRODUCTION_USE_V2,
    distributionContractHash: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_CONTRACT_V2.contractHash,
    installerPackageIdentifier: "com.setfarm.bootstrap.native-v2",
    developerTeamIdentityHash: sha256V2("developer-team"),
    designatedRequirementHash: sha256V2("designated-requirement"),
    hardenedRuntimePolicyHash: sha256V2("hardened-runtime"),
    libraryValidationPolicyHash: sha256V2("library-validation"),
    distributionEpoch: 7,
    offlineReleaseKeyId: keyId,
    entries: [entry("arm64"), entry("x64")],
  };
  const catalog = parsePlatformReleaseBootstrapDarwinNativeDistributionCatalogCandidateV2({ ...catalogIdentity, catalogHash: hashPlatformReleaseBootstrapDarwinNativeDistributionCatalogV2(catalogIdentity) });
  const preimage = canonicalizePlatformReleaseBootstrapDarwinNativeDistributionCatalogSigningPreimageV2(catalog);
  const envelopeIdentity = {
    schema: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SIGNED_NATIVE_DISTRIBUTION_CATALOG_V2_SCHEMA,
    version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
    productionUse: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_PRODUCTION_USE_V2,
    signatureAlgorithm: "ed25519" as const,
    offlineReleaseKeyId: keyId,
    catalog,
    signingPreimageHash: hashPlatformReleaseBootstrapDarwinNativeDistributionCatalogSigningPreimageV2(catalog),
    offlineSignature: sign(null, Buffer.from(preimage, "utf8"), privateKey).toString("base64"),
  };
  const envelope = parsePlatformReleaseBootstrapDarwinSignedNativeDistributionCatalogCandidateV2({ ...envelopeIdentity, signedEnvelopeHash: hashPlatformReleaseBootstrapDarwinSignedNativeDistributionCatalogV2(envelopeIdentity) });
  const verificationReceipt = verifyPlatformReleaseBootstrapDarwinNativeDistributionCatalogSignatureMechanicsV2({ schema: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_VERIFICATION_INPUT_V2_SCHEMA, publicKeySpkiDerBase64: publicKeyDer.toString("base64"), signedEnvelope: envelope });
  const selectionInput = { schema: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_DISTRIBUTION_SELECTION_INPUT_V2_SCHEMA, signedEnvelope: envelope, architecture: "arm64" as const, durableEpochFloor: 7 };
  return { catalog, envelope, verificationReceipt, selectionInput, artifactByteLength: 1_001, artifactContentHash: sha256V2("arm64:artifact"), packageManifestHash: sha256V2("arm64:package-manifest") };
}

function buildMemberCapturesV2(census: NamespacePhysicalCensusV2, fixture: ReturnType<typeof nativeFixtureV2>) {
  const root = buildSnapshotV2(census).packageEvidence[0].projection.orderedEntryCaptures.find((capture) => capture.classification.category === "package_root")!;
  const scope = census.filesystemScope;
  const binIdentity = buildStableFsObjectIdentityV2({ filesystemScope: scope, objectKind: "directory", device: root.objectIdentity.device, inode: "900" });
  const bin = { basename: "bin", objectIdentity: binIdentity, fingerprint: buildFsObservationFingerprintV2({ objectIdentity: binIdentity, ownerUid: 0, ownerGid: 0, mode: "0555", linkCount: 2, byteLength: 128, modifiedTimeNanoseconds: "9000", changedTimeNanoseconds: "9001" }), parentObjectIdentity: root.objectIdentity, contentEvidence: { kind: "directory_membership" as const, membership: buildDirectoryMembershipIdentityV2({ orderedEntries: [{ basename: "setfarm-host-composition-verifier-v2", objectKind: "ordinary_file" }] }) } };
  const manifestIdentity = buildStableFsObjectIdentityV2({ filesystemScope: scope, objectKind: "ordinary_file", device: root.objectIdentity.device, inode: "901" });
  const manifest = { basename: "HOST_COMPOSITION_VERIFIER_MANIFEST.v2.json", objectIdentity: manifestIdentity, fingerprint: buildFsObservationFingerprintV2({ objectIdentity: manifestIdentity, ownerUid: 0, ownerGid: 0, mode: "0444", linkCount: 1, byteLength: 512, modifiedTimeNanoseconds: "9010", changedTimeNanoseconds: "9011" }), parentObjectIdentity: root.objectIdentity, contentEvidence: { kind: "bounded_regular_file_bytes" as const, rawContentHash: fixture.packageManifestHash } };
  const executableIdentity = buildStableFsObjectIdentityV2({ filesystemScope: scope, objectKind: "ordinary_file", device: root.objectIdentity.device, inode: "902" });
  const executable = { basename: "setfarm-host-composition-verifier-v2", objectIdentity: executableIdentity, fingerprint: buildFsObservationFingerprintV2({ objectIdentity: executableIdentity, ownerUid: 0, ownerGid: 0, mode: "0555", linkCount: 1, byteLength: fixture.artifactByteLength, modifiedTimeNanoseconds: "9020", changedTimeNanoseconds: "9021" }), parentObjectIdentity: binIdentity, contentEvidence: { kind: "bounded_regular_file_bytes" as const, rawContentHash: fixture.artifactContentHash } };
  return { binDirectory: bin, manifest, executable };
}

function validInputV2() {
  const census = buildFixtureCensusV2();
  const snapshot = buildSnapshotV2(census);
  const scopeCapture = census.orderedEntryCaptures.find((entry) => entry.classification.category === "filesystem_scope")!;
  assert.equal(scopeCapture.contentEvidence.kind, "bounded_regular_file_bytes");
  const publication = { capability: PLATFORM_RELEASE_BOOTSTRAP_COOPERATIVE_CAPTURE_CAPABILITY_V2, filesystemScope: census.filesystemScope, objectIdentity: scopeCapture.objectIdentity, fingerprint: scopeCapture.fingerprint, rawContentHash: scopeCapture.contentEvidence.rawContentHash };
  const fixture = nativeFixtureV2();
  return { input: { packageSnapshot: snapshot, scopePublicationEvidence: publication, verificationReceipt: fixture.verificationReceipt, selectionInput: fixture.selectionInput, memberCaptures: buildMemberCapturesV2(census, fixture) }, fixture, census, snapshot };
}

function assertInvalidV2(action: () => unknown): void {
  assert.throws(action, (error: unknown) => error instanceof PlatformReleaseBootstrapDarwinNativePackageMemberCaptureTestErrorV2);
}

describe("platform release Darwin native package member capture test v2", () => {
  it("joins root/bin/manifest/executable physical captures to the authentic mechanics selection", () => {
    const { input } = validInputV2();
    const relation = buildPlatformReleaseBootstrapDarwinNativePackageMemberCaptureTestV2(input);
    assert.equal(relation.productionAuthority, false);
    assert.equal(relation.productionAdmission, "forbidden");
    assert.equal(relation.credentialUse, "none");
    assert.equal(relation.mutationAuthority, false);
    assert.equal("path" in relation, false);
    assert.equal("artifactContentHash" in relation, false);
    assert.equal(Object.isFrozen(relation), true);
    assert.equal(parsePlatformReleaseBootstrapDarwinNativePackageMemberCaptureTestCandidateV2(relation).observationHash, relation.observationHash);
  });

  it("rejects member mode, parent, content, and alias drift", () => {
    const { input, snapshot } = validInputV2();
    const mode = structuredClone(input.memberCaptures) as any;
    mode.manifest.fingerprint.mode = "0555";
    assertInvalidV2(() => buildPlatformReleaseBootstrapDarwinNativePackageMemberCaptureTestV2({ ...input, memberCaptures: mode }));
    const parent = structuredClone(input.memberCaptures) as any;
    parent.executable.parentObjectIdentity = parent.manifest.objectIdentity;
    assertInvalidV2(() => buildPlatformReleaseBootstrapDarwinNativePackageMemberCaptureTestV2({ ...input, memberCaptures: parent }));
    const content = structuredClone(input.memberCaptures) as any;
    content.executable.contentEvidence.rawContentHash = "f".repeat(64);
    assertInvalidV2(() => buildPlatformReleaseBootstrapDarwinNativePackageMemberCaptureTestV2({ ...input, memberCaptures: content }));
    const root = snapshot.packageEvidence[0].projection.orderedEntryCaptures.find((capture) => capture.classification.category === "package_root")!;
    const alias = structuredClone(input.memberCaptures) as any;
    alias.binDirectory.objectIdentity = root.objectIdentity;
    alias.binDirectory.fingerprint = root.fingerprint;
    assertInvalidV2(() => buildPlatformReleaseBootstrapDarwinNativePackageMemberCaptureTestV2({ ...input, memberCaptures: alias }));
    const crossKind = structuredClone(input.memberCaptures) as any;
    crossKind.manifest.objectIdentity.device = crossKind.binDirectory.objectIdentity.device;
    crossKind.manifest.objectIdentity.inode = crossKind.binDirectory.objectIdentity.inode;
    crossKind.manifest.objectIdentity.objectIdentityHash = hashStableFsObjectIdentityV2(crossKind.manifest.objectIdentity);
    crossKind.manifest.fingerprint.objectIdentityHash = crossKind.manifest.objectIdentity.objectIdentityHash;
    crossKind.manifest.fingerprint.fingerprintHash = hashFsObservationFingerprintV2(crossKind.manifest.fingerprint);
    assertInvalidV2(() => buildPlatformReleaseBootstrapDarwinNativePackageMemberCaptureTestV2({ ...input, memberCaptures: crossKind }));
  });

  it("rejects architecture/receipt splice and hostile top-level input before selection", () => {
    const { input } = validInputV2();
    const x64 = structuredClone(input.selectionInput) as any;
    x64.architecture = "x64";
    assertInvalidV2(() => buildPlatformReleaseBootstrapDarwinNativePackageMemberCaptureTestV2({ ...input, selectionInput: x64 }));
    const other = validInputV2();
    assertInvalidV2(() => buildPlatformReleaseBootstrapDarwinNativePackageMemberCaptureTestV2({ ...input, verificationReceipt: other.input.verificationReceipt }));
    assertInvalidV2(() => buildPlatformReleaseBootstrapDarwinNativePackageMemberCaptureTestV2({ ...input, verificationReceipt: structuredClone(input.verificationReceipt) }));
    assertInvalidV2(() => buildPlatformReleaseBootstrapDarwinNativePackageMemberCaptureTestV2(new Proxy(input, {})));
    assertInvalidV2(() => buildPlatformReleaseBootstrapDarwinNativePackageMemberCaptureTestV2({ ...input, extra: true } as any));
    const accessor: Record<string, unknown> = { ...input };
    Object.defineProperty(accessor, "memberCaptures", { enumerable: true, get: () => input.memberCaptures });
    assertInvalidV2(() => buildPlatformReleaseBootstrapDarwinNativePackageMemberCaptureTestV2(accessor as any));
    const cycle = structuredClone(input.memberCaptures) as any;
    cycle.binDirectory.cycle = cycle;
    assertInvalidV2(() => buildPlatformReleaseBootstrapDarwinNativePackageMemberCaptureTestV2({ ...input, memberCaptures: cycle }));
  });

  it("keeps the mapper outside filesystem, child-process, and production opener authorities", () => {
    const source = readFileSync("src/product-compiler/platform-release-bootstrap-darwin-native-package-member-capture-test-support-v2.ts", "utf8");
    assert.equal(source.includes("node:fs"), false);
    assert.equal(source.includes("node:child_process"), false);
    assert.equal(source.includes("openProductionAuthenticatedDarwinFilesystemBackendV2"), false);
  });
});
