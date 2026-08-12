import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2,
  PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_SHARED_LOCK_CONTENT_V2,
  PLATFORM_RELEASE_COMPOSITION_EXECUTABLE_LOCATOR_V2,
  PLATFORM_RELEASE_COMPOSITION_MODULE_LOCATOR_V2,
  PLATFORM_RELEASE_COMPOSITION_PACKAGE_MANIFEST_LOCATOR_V2,
  PLATFORM_RELEASE_METADATA_MODULE_LOCATOR_V2,
  PLATFORM_RELEASE_NETWORK_WRAPPER_MODULE_LOCATOR_V2,
} from "../../src/execution/schemas/platform-release-bootstrap-contract-v2.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2,
} from "../../src/execution/schemas/platform-release-bootstrap-operation-abis-v2.js";
import {
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_LOCK_CONTENT_V2,
} from "../../src/product-compiler/schemas/node-toolchain-provisioner-bootstrap-installation-state-v2.js";
import {
  buildBootstrapFilesystemScopeIdentityV2,
  buildDirectoryMembershipIdentityV2,
  buildFsObservationFingerprintV2,
  hashFsObservationFingerprintV2,
  buildNamespacePhysicalCensusV2,
  buildNamespacePhysicalEntryCaptureV2,
  buildStableFsObjectIdentityV2,
  hashStableFsObjectIdentityV2,
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
  buildPlatformReleaseBootstrapReleaseCompositionMemberCaptureTestV2,
  parsePlatformReleaseBootstrapReleaseCompositionMemberCaptureTestCandidateV2,
  PlatformReleaseBootstrapReleaseCompositionMemberCaptureTestErrorV2,
} from "../../src/product-compiler/platform-release-bootstrap-release-composition-member-capture-test-support-v2.js";
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

function buildPublicationV2(census: NamespacePhysicalCensusV2) {
  const capture = census.orderedEntryCaptures.find((entry) => entry.classification.category === "filesystem_scope")!;
  assert.equal(capture.contentEvidence.kind, "bounded_regular_file_bytes");
  return { capability: PLATFORM_RELEASE_BOOTSTRAP_COOPERATIVE_CAPTURE_CAPABILITY_V2, filesystemScope: census.filesystemScope, objectIdentity: capture.objectIdentity, fingerprint: capture.fingerprint, rawContentHash: capture.contentEvidence.rawContentHash };
}

function buildMemberCapturesV2(census: NamespacePhysicalCensusV2) {
  const snapshot = buildSnapshotV2(census);
  const root = snapshot.packageEvidence.find((entry) => entry.packageRef === packageRefs[2])!.projection.orderedEntryCaptures.find((capture) => capture.classification.category === "package_root")!;
  const scope = census.filesystemScope;
  const makeDirectory = (basename: string, inode: string, membership: ReturnType<typeof buildDirectoryMembershipIdentityV2>) => {
    const objectIdentity = buildStableFsObjectIdentityV2({ filesystemScope: scope, objectKind: "directory", device: root.objectIdentity.device, inode });
    return { basename, objectIdentity, fingerprint: buildFsObservationFingerprintV2({ objectIdentity, ownerUid: 0, ownerGid: 0, mode: "0555", linkCount: 2, byteLength: 128, modifiedTimeNanoseconds: `${inode}0`, changedTimeNanoseconds: `${inode}1` }), parentObjectIdentity: root.objectIdentity, contentEvidence: { kind: "directory_membership" as const, membership }, observedExports: [] };
  };
  const binDirectory = makeDirectory("bin", "900", buildDirectoryMembershipIdentityV2({ orderedEntries: [{ basename: "setfarm-platform-release-composition-v2", objectKind: "ordinary_file" }] }));
  const libDirectory = makeDirectory("lib", "901", buildDirectoryMembershipIdentityV2({ orderedEntries: [
    { basename: "platform-release-composition-v2.mjs", objectKind: "ordinary_file" },
    { basename: "platform-release-metadata-v2.mjs", objectKind: "ordinary_file" },
    { basename: "platform-release-network-wrapper-v2.mjs", objectKind: "ordinary_file" },
  ] }));
  const makeFile = (basename: string, inode: string, parentObjectIdentity: typeof root.objectIdentity, mode: "0444" | "0555", contentLabel: string, observedExports: string[]) => {
    const objectIdentity = buildStableFsObjectIdentityV2({ filesystemScope: scope, objectKind: "ordinary_file", device: root.objectIdentity.device, inode });
    return { basename, objectIdentity, fingerprint: buildFsObservationFingerprintV2({ objectIdentity, ownerUid: 0, ownerGid: 0, mode, linkCount: 1, byteLength: 512, modifiedTimeNanoseconds: `${inode}0`, changedTimeNanoseconds: `${inode}1` }), parentObjectIdentity, contentEvidence: { kind: "bounded_regular_file_bytes" as const, rawContentHash: sha256V2(`R:${contentLabel}`) }, observedExports };
  };
  return {
    binDirectory,
    libDirectory,
    manifest: makeFile(PLATFORM_RELEASE_COMPOSITION_PACKAGE_MANIFEST_LOCATOR_V2, "902", root.objectIdentity, "0444", "manifest", []),
    executable: makeFile("setfarm-platform-release-composition-v2", "903", binDirectory.objectIdentity, "0555", "executable", []),
    releaseModule: makeFile("platform-release-composition-v2.mjs", "904", libDirectory.objectIdentity, "0444", "release-module", ["runPlatformReleaseHostOperationV2", "runPlatformReleaseModuleExportProbeV2"]),
    metadataModule: makeFile("platform-release-metadata-v2.mjs", "905", libDirectory.objectIdentity, "0444", "metadata-module", ["runPlatformReleaseMetadataProbeV2"]),
    networkWrapperModule: makeFile("platform-release-network-wrapper-v2.mjs", "906", libDirectory.objectIdentity, "0444", "network-module", ["runPlatformReleaseNetworkNegativeProbeV2"]),
  };
}

function validInputV2() {
  const census = buildFixtureCensusV2();
  return {
    census,
    input: {
      packageSnapshot: buildSnapshotV2(census),
      scopePublicationEvidence: buildPublicationV2(census),
      memberCaptures: buildMemberCapturesV2(census),
      sealedRootProvenanceHash: "a".repeat(64),
    },
  };
}

function assertInvalidV2(action: () => unknown): void {
  assert.throws(action, (error: unknown) => error instanceof PlatformReleaseBootstrapReleaseCompositionMemberCaptureTestErrorV2);
}

describe("platform release composition R member capture test v2", () => {
  it("joins exact R root/bin/lib topology and five member captures without authority promotion", () => {
    const { input, census } = validInputV2();
    const relation = buildPlatformReleaseBootstrapReleaseCompositionMemberCaptureTestV2(input);
    assert.equal(relation.filesystemScopeIdentityHash, census.filesystemScope.scopeIdentityHash);
    assert.equal(relation.productionAuthority, false);
    assert.equal(relation.productionAdmission, "forbidden");
    assert.equal(relation.credentialUse, "none");
    assert.equal(relation.mutationAuthority, false);
    assert.equal(relation.sealedRootProvenanceHash, "a".repeat(64));
    assert.equal("path" in relation, false);
    assert.equal("contentEvidence" in relation, false);
    assert.equal(Object.isFrozen(relation), true);
    assert.equal(parsePlatformReleaseBootstrapReleaseCompositionMemberCaptureTestCandidateV2(relation).observationHash, relation.observationHash);
  });

  it("rejects topology, parent, scope/device/inode alias, mode/link/length, and export drift", () => {
    const { input } = validInputV2();
    const topology = structuredClone(input.memberCaptures) as any;
    topology.libDirectory.contentEvidence.membership.orderedEntries.pop();
    assertInvalidV2(() => buildPlatformReleaseBootstrapReleaseCompositionMemberCaptureTestV2({ ...input, memberCaptures: topology }));
    const parent = structuredClone(input.memberCaptures) as any;
    parent.releaseModule.parentObjectIdentity = parent.metadataModule.objectIdentity;
    assertInvalidV2(() => buildPlatformReleaseBootstrapReleaseCompositionMemberCaptureTestV2({ ...input, memberCaptures: parent }));
    const mode = structuredClone(input.memberCaptures) as any;
    mode.executable.fingerprint.mode = "0444";
    assertInvalidV2(() => buildPlatformReleaseBootstrapReleaseCompositionMemberCaptureTestV2({ ...input, memberCaptures: mode }));
    const exportsDrift = structuredClone(input.memberCaptures) as any;
    exportsDrift.releaseModule.observedExports = ["wrongExport"];
    assertInvalidV2(() => buildPlatformReleaseBootstrapReleaseCompositionMemberCaptureTestV2({ ...input, memberCaptures: exportsDrift }));
    const alias = structuredClone(input.memberCaptures) as any;
    alias.metadataModule.objectIdentity = alias.releaseModule.objectIdentity;
    alias.metadataModule.fingerprint.objectIdentityHash = alias.metadataModule.objectIdentity.objectIdentityHash;
    assertInvalidV2(() => buildPlatformReleaseBootstrapReleaseCompositionMemberCaptureTestV2({ ...input, memberCaptures: alias }));
    const crossKind = structuredClone(input.memberCaptures) as any;
    crossKind.manifest.objectIdentity.device = crossKind.binDirectory.objectIdentity.device;
    crossKind.manifest.objectIdentity.inode = crossKind.binDirectory.objectIdentity.inode;
    crossKind.manifest.objectIdentity.objectIdentityHash = hashStableFsObjectIdentityV2(crossKind.manifest.objectIdentity);
    crossKind.manifest.fingerprint.objectIdentityHash = crossKind.manifest.objectIdentity.objectIdentityHash;
    crossKind.manifest.fingerprint.fingerprintHash = hashFsObservationFingerprintV2(crossKind.manifest.fingerprint);
    assertInvalidV2(() => buildPlatformReleaseBootstrapReleaseCompositionMemberCaptureTestV2({ ...input, memberCaptures: crossKind }));
  });

  it("keeps raw content and optional sealed-root provenance inside the non-authoritative observation", () => {
    const { input } = validInputV2();
    const first = buildPlatformReleaseBootstrapReleaseCompositionMemberCaptureTestV2(input);
    const changed = structuredClone(input.memberCaptures) as any;
    changed.manifest.contentEvidence.rawContentHash = "f".repeat(64);
    const second = buildPlatformReleaseBootstrapReleaseCompositionMemberCaptureTestV2({ ...input, memberCaptures: changed });
    assert.notEqual(second.memberCaptureObservationHash, first.memberCaptureObservationHash);
    assert.equal(second.productionAuthority, false);
    assert.equal(second.productionAdmission, "forbidden");
    assertInvalidV2(() => buildPlatformReleaseBootstrapReleaseCompositionMemberCaptureTestV2({ ...input, sealedRootProvenanceHash: "not-a-hash" }));
  });

  it("rejects hostile input and keeps the mapper outside filesystem/child-process/production opener authorities", () => {
    const { input } = validInputV2();
    assertInvalidV2(() => buildPlatformReleaseBootstrapReleaseCompositionMemberCaptureTestV2(new Proxy(input, {})));
    assertInvalidV2(() => buildPlatformReleaseBootstrapReleaseCompositionMemberCaptureTestV2({ ...input, extra: true } as any));
    const accessor: Record<string, unknown> = { ...input };
    Object.defineProperty(accessor, "memberCaptures", { enumerable: true, get: () => input.memberCaptures });
    assertInvalidV2(() => buildPlatformReleaseBootstrapReleaseCompositionMemberCaptureTestV2(accessor as any));
    const cycle = structuredClone(input.memberCaptures) as any;
    cycle.binDirectory.cycle = cycle;
    assertInvalidV2(() => buildPlatformReleaseBootstrapReleaseCompositionMemberCaptureTestV2({ ...input, memberCaptures: cycle }));
    const source = readFileSync("src/product-compiler/platform-release-bootstrap-release-composition-member-capture-test-support-v2.ts", "utf8");
    assert.equal(source.includes("node:fs"), false);
    assert.equal(source.includes("node:child_process"), false);
    assert.equal(source.includes("openProductionAuthenticatedDarwinFilesystemBackendV2"), false);
  });
});
