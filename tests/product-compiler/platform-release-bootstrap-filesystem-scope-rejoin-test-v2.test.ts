import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_LOCK_CONTENT_V2,
} from "../../src/product-compiler/schemas/node-toolchain-provisioner-bootstrap-installation-state-v2.js";
import {
  buildBootstrapFilesystemScopeIdentityV2,
  buildDirectoryMembershipIdentityV2,
  buildFsObservationFingerprintV2,
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
  buildPlatformReleaseBootstrapFilesystemScopeRejoinTestV2,
  parsePlatformReleaseBootstrapFilesystemScopeRejoinTestCandidateV2,
  PlatformReleaseBootstrapFilesystemScopeRejoinTestErrorV2,
  type PlatformReleaseBootstrapFilesystemScopePublicationEvidenceTestV2,
} from "../../src/product-compiler/platform-release-bootstrap-filesystem-scope-rejoin-test-support-v2.js";
import { canonicalJsonStringify } from "../../src/product-compiler/canonical-json.js";

const packageRefs = Object.freeze([
  PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.hostVerifier,
  PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.nodeToolchainProvisioner,
  PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.platformReleaseComposition,
  PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.runtimeAccountProvisioner,
] as const);
const contract = PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2;

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
  const packageContract = contract.packages.find(
    (entry) => entry.packageRef === packageRef,
  )!;
  const rootDirectory = packageContract.directories.find(
    (entry) => entry.relativeLocator === ".",
  )!;
  const directoryRefs = new Set(
    packageContract.directories.map((entry) => entry.directoryRef),
  );
  return buildDirectoryMembershipIdentityV2({
    orderedEntries: rootDirectory.orderedEntryRefs.map((memberRef, index) => ({
      basename: rootDirectory.orderedEntryBasenames[index]!,
      objectKind: directoryRefs.has(memberRef)
        ? "directory" as const
        : "ordinary_file" as const,
    })).sort((left, right) =>
      left.basename < right.basename ? -1 : left.basename > right.basename ? 1 : 0),
  });
}

function buildFixtureCensusV2(scopeNonce = "a".repeat(64)): NamespacePhysicalCensusV2 {
  const scope = buildBootstrapFilesystemScopeIdentityV2({ scopeNonce });
  const basenames = [
    contract.registry.filesystemScopeBasename,
    contract.registry.sharedLockBasename,
    ...packageRefs.flatMap((packageRef) => {
      const packageContract = contract.packages.find(
        (entry) => entry.packageRef === packageRef,
      )!;
      return [
        packageContract.rootBasename,
        packageContract.lifecycle.packageLockBasename,
      ];
    }),
  ];
  const logicalCensus = classifyPlatformReleaseBootstrapNamespaceCensusV2(basenames);
  const parentObjectIdentity = buildStableFsObjectIdentityV2({
    filesystemScope: scope,
    objectKind: "directory",
    device: "7",
    inode: "100",
  });
  const parentFingerprint = buildFsObservationFingerprintV2({
    objectIdentity: parentObjectIdentity,
    ownerUid: 0,
    ownerGid: 0,
    mode: "0755",
    linkCount: 1,
    byteLength: 2_048,
    modifiedTimeNanoseconds: "1000",
    changedTimeNanoseconds: "1001",
  });
  const orderedEntryCaptures = logicalCensus.orderedEntries.map(
    (classification, index) => {
      const packageContract = classification.ownerKind === "package"
        ? contract.packages.find(
          (entry) => entry.packageRef === classification.ownerRef,
        )!
        : undefined;
      const isRoot = classification.category === "package_root";
      const isScope = classification.category === "filesystem_scope";
      const isSharedLock = classification.category === "shared_parent_lock";
      const byteLength = isRoot
        ? 256
        : isScope
          ? Buffer.byteLength(canonicalJsonStringify(scope), "utf8")
          : isSharedLock
            ? Buffer.byteLength(PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_SHARED_LOCK_CONTENT_V2, "utf8")
            : packageContract === undefined
              ? 128
              : Buffer.byteLength(expectedLockContentV2(packageContract.packageRef), "utf8");
      const objectIdentity = buildStableFsObjectIdentityV2({
        filesystemScope: scope,
        objectKind: isRoot ? "directory" : "ordinary_file",
        device: "7",
        inode: String(200 + index),
      });
      const fingerprint = buildFsObservationFingerprintV2({
        objectIdentity,
        ownerUid: 0,
        ownerGid: 0,
        mode: isRoot ? packageContract!.rootMode : "0600",
        linkCount: 1,
        byteLength,
        modifiedTimeNanoseconds: String(2_000 + index),
        changedTimeNanoseconds: String(3_000 + index),
      });
      const contentEvidence = isRoot
        ? {
            kind: "directory_membership" as const,
            membership: expectedRootMembershipV2(packageContract!.packageRef),
          }
        : {
            kind: "bounded_regular_file_bytes" as const,
            rawContentHash: isScope
              ? sha256V2(canonicalJsonStringify(scope))
              : isSharedLock
                ? contract.registry.sharedLockContentHash
                : sha256V2(expectedLockContentV2(packageContract!.packageRef)),
          };
      return buildNamespacePhysicalEntryCaptureV2({
        classification,
        parentObjectIdentityHash: parentObjectIdentity.objectIdentityHash,
        objectIdentity,
        fingerprint,
        contentEvidence,
      });
    },
  );
  return buildNamespacePhysicalCensusV2({
    filesystemScope: scope,
    logicalCensus,
    parentObjectIdentity,
    parentFingerprint,
    orderedEntryCaptures,
  });
}

function buildSnapshotV2(census = buildFixtureCensusV2()) {
  return buildPlatformReleaseBootstrapRegistryPackagePhysicalSnapshotTestV2({
    physicalCensus: census,
    packageRefs,
  });
}

function buildPublicationV2(
  census: NamespacePhysicalCensusV2,
): PlatformReleaseBootstrapFilesystemScopePublicationEvidenceTestV2 {
  const capture = census.orderedEntryCaptures.find(
    (entry) => entry.classification.category === "filesystem_scope",
  )!;
  assert.equal(capture.contentEvidence.kind, "bounded_regular_file_bytes");
  return {
    capability: PLATFORM_RELEASE_BOOTSTRAP_COOPERATIVE_CAPTURE_CAPABILITY_V2,
    filesystemScope: census.filesystemScope,
    objectIdentity: capture.objectIdentity,
    fingerprint: capture.fingerprint,
    rawContentHash: capture.contentEvidence.rawContentHash,
  };
}

function assertInvalidV2(action: () => unknown): void {
  assert.throws(action, (error: unknown) => {
    assert.ok(error instanceof PlatformReleaseBootstrapFilesystemScopeRejoinTestErrorV2);
    return true;
  });
}

function recursivelyFrozenV2(value: unknown): boolean {
  if (value === null || typeof value !== "object") return true;
  return Object.isFrozen(value)
    && Object.values(value).every(recursivelyFrozenV2);
}

describe("platform release filesystem scope external rejoin test v2", () => {
  it("joins one serialized package snapshot to one separate scope publication without authority promotion", () => {
    const census = buildFixtureCensusV2();
    const relation = buildPlatformReleaseBootstrapFilesystemScopeRejoinTestV2({
      packageSnapshot: buildSnapshotV2(census),
      scopePublicationEvidence: buildPublicationV2(census),
    });
    assert.equal(relation.filesystemScopeIdentityHash, census.filesystemScope.scopeIdentityHash);
    assert.equal(relation.productionAuthority, false);
    assert.equal(relation.productionAdmission, "forbidden");
    assert.equal(relation.credentialUse, "none");
    assert.equal(relation.mutationAuthority, false);
    assert.equal(recursivelyFrozenV2(relation), true);
    assert.equal("path" in relation, false);
    assert.equal("capability" in relation, false);
    assert.equal(parsePlatformReleaseBootstrapFilesystemScopeRejoinTestCandidateV2(relation).observationHash, relation.observationHash);
  });

  it("rejects scope identity drift, canonical-content drift, and scope/object/fingerprint transplant", () => {
    const census = buildFixtureCensusV2();
    const snapshot = buildSnapshotV2(census);
    const scopeDrift = structuredClone(buildPublicationV2(census)) as Record<string, any>;
    scopeDrift.filesystemScope.scopeNonce = "b".repeat(64);
    assertInvalidV2(() => buildPlatformReleaseBootstrapFilesystemScopeRejoinTestV2({
      packageSnapshot: snapshot,
      scopePublicationEvidence: scopeDrift,
    }));
    const contentDrift = structuredClone(buildPublicationV2(census)) as Record<string, any>;
    contentDrift.rawContentHash = "f".repeat(64);
    assertInvalidV2(() => buildPlatformReleaseBootstrapFilesystemScopeRejoinTestV2({
      packageSnapshot: snapshot,
      scopePublicationEvidence: contentDrift,
    }));
    const transplanted = structuredClone(buildPublicationV2(census)) as Record<string, any>;
    const root = census.orderedEntryCaptures.find(
      (entry) => entry.classification.category === "package_root",
    )!;
    transplanted.objectIdentity = root.objectIdentity;
    transplanted.fingerprint = root.fingerprint;
    assertInvalidV2(() => buildPlatformReleaseBootstrapFilesystemScopeRejoinTestV2({
      packageSnapshot: snapshot,
      scopePublicationEvidence: transplanted,
    }));
    const fingerprintTransplant = structuredClone(buildPublicationV2(census)) as Record<string, any>;
    const lock = census.orderedEntryCaptures.find(
      (entry) => entry.classification.category === "package_lock",
    )!;
    fingerprintTransplant.fingerprint = lock.fingerprint;
    assertInvalidV2(() => buildPlatformReleaseBootstrapFilesystemScopeRejoinTestV2({
      packageSnapshot: snapshot,
      scopePublicationEvidence: fingerprintTransplant,
    }));
    const other = buildFixtureCensusV2("c".repeat(64));
    assertInvalidV2(() => buildPlatformReleaseBootstrapFilesystemScopeRejoinTestV2({
      packageSnapshot: snapshot,
      scopePublicationEvidence: buildPublicationV2(other),
    }));
  });

  it("rejects a rehashed package snapshot transplant and a tampered relation", () => {
    const census = buildFixtureCensusV2();
    const snapshot = structuredClone(buildSnapshotV2(census)) as Record<string, any>;
    snapshot.filesystemScopeIdentityHash = "f".repeat(64);
    assertInvalidV2(() => buildPlatformReleaseBootstrapFilesystemScopeRejoinTestV2({
      packageSnapshot: snapshot,
      scopePublicationEvidence: buildPublicationV2(census),
    }));
    const relation = buildPlatformReleaseBootstrapFilesystemScopeRejoinTestV2({
      packageSnapshot: buildSnapshotV2(census),
      scopePublicationEvidence: buildPublicationV2(census),
    });
    const tampered = structuredClone(relation) as Record<string, any>;
    tampered.observationHash = "0".repeat(64);
    assertInvalidV2(() => parsePlatformReleaseBootstrapFilesystemScopeRejoinTestCandidateV2(tampered));
  });

  it("keeps a self-consistent foreign scope explicitly non-authoritative", () => {
    const foreign = buildFixtureCensusV2("d".repeat(64));
    const relation = buildPlatformReleaseBootstrapFilesystemScopeRejoinTestV2({
      packageSnapshot: buildSnapshotV2(foreign),
      scopePublicationEvidence: buildPublicationV2(foreign),
    });
    assert.equal(relation.admissionScope, "test_fixture");
    assert.equal(relation.productionAuthority, false);
    assert.equal(relation.productionAdmission, "forbidden");
    assert.equal(relation.trustConclusion, "characterization_only");
  });

  it("rejects proxies, accessors, cycles, and unknown input fields before trust joins", () => {
    const census = buildFixtureCensusV2();
    const input = {
      packageSnapshot: buildSnapshotV2(census),
      scopePublicationEvidence: buildPublicationV2(census),
    };
    assertInvalidV2(() => buildPlatformReleaseBootstrapFilesystemScopeRejoinTestV2(new Proxy(input, {})));
    assertInvalidV2(() => buildPlatformReleaseBootstrapFilesystemScopeRejoinTestV2({ ...input, extra: true } as any));
    const accessor: Record<string, unknown> = { packageSnapshot: input.packageSnapshot };
    Object.defineProperty(accessor, "scopePublicationEvidence", {
      enumerable: true,
      get: () => input.scopePublicationEvidence,
    });
    assertInvalidV2(() => buildPlatformReleaseBootstrapFilesystemScopeRejoinTestV2(accessor as any));
    const cycle: Record<string, unknown> = { ...input };
    cycle.cycle = cycle;
    assertInvalidV2(() => buildPlatformReleaseBootstrapFilesystemScopeRejoinTestV2(cycle as any));
  });

  it("keeps the adapter outside filesystem, child-process, and production-opener authorities", () => {
    const source = readFileSync(
      "src/product-compiler/platform-release-bootstrap-filesystem-scope-rejoin-test-support-v2.ts",
      "utf8",
    );
    assert.equal(source.includes("node:fs"), false);
    assert.equal(source.includes("node:child_process"), false);
    assert.equal(source.includes("openProductionAuthenticatedDarwinFilesystemBackendV2"), false);
  });
});
