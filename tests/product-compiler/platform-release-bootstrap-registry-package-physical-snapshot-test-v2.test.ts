import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { after, before, describe, it } from "node:test";

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
  buildDirectoryMembershipIdentityV2,
  buildFsObservationFingerprintV2,
  buildNamespacePhysicalCensusV2,
  buildNamespacePhysicalEntryCaptureV2,
  buildStableFsObjectIdentityV2,
  hashDirectoryMembershipIdentityV2,
  hashFsObservationFingerprintV2,
  hashNamespacePhysicalCensusV2,
  hashNamespacePhysicalEntryCaptureV2,
  hashStableFsObjectIdentityV2,
  buildBootstrapFilesystemScopeIdentityV2,
  type NamespacePhysicalCensusV2,
} from "../../src/product-compiler/platform-release-bootstrap-physical-census-v2.js";
import {
  classifyPlatformReleaseBootstrapNamespaceCensusV2,
} from "../../src/product-compiler/platform-release-bootstrap-registry-v2.js";
import {
  buildPlatformReleaseBootstrapDarwinSystemAnchorObservationFixtureForTestV2,
  observePlatformReleaseBootstrapDarwinSystemAnchorObservationForTestV2,
  type PlatformReleaseBootstrapDarwinSystemAnchorObservationFixtureV2,
} from "../../src/product-compiler/platform-release-bootstrap-darwin-system-anchor-observation-test-support-v2.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PACKAGE_PHYSICAL_SNAPSHOT_TEST_V2_PACKAGE_REFS,
  PlatformReleaseBootstrapRegistryPackagePhysicalSnapshotTestV2Schema,
  PlatformReleaseBootstrapRegistryPackagePhysicalSnapshotTestErrorV2,
  buildPlatformReleaseBootstrapRegistryPackagePhysicalSnapshotTestV2,
  hashPlatformReleaseBootstrapRegistryPackagePhysicalSnapshotTestV2,
  parsePlatformReleaseBootstrapRegistryPackagePhysicalSnapshotTestCandidateV2,
} from "../../src/product-compiler/platform-release-bootstrap-registry-package-physical-snapshot-test-support-v2.js";
import { canonicalJsonStringify } from "../../src/product-compiler/canonical-json.js";

const packageRefs =
  PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PACKAGE_PHYSICAL_SNAPSHOT_TEST_V2_PACKAGE_REFS;
const contract = PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2;
let systemAnchorFixture:
  | PlatformReleaseBootstrapDarwinSystemAnchorObservationFixtureV2
  | undefined;
let systemAnchorObservation: unknown;

function requireSystemAnchorObservationV2(): unknown {
  assert.notEqual(systemAnchorObservation, undefined);
  return systemAnchorObservation;
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function expectedLockContent(packageRef: string): string {
  return packageRef === packageRefs[1]
    ? NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_LOCK_CONTENT_V2
    : [
        "setfarm.bootstrap-package-installation-lock.v2",
        `registryContractHash=${contract.contractHash}`,
        `packageRef=${packageRef}`,
        "",
      ].join("\n");
}

function expectedLockHash(packageRef: string): string {
  return sha256(expectedLockContent(packageRef));
}

function expectedRootMembership(packageRef: string) {
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

function buildFixtureCensusV2(
  scopeNonce = "a".repeat(64),
): NamespacePhysicalCensusV2 {
  const scope = buildBootstrapFilesystemScopeIdentityV2({
    scopeNonce,
  });
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
  const logicalCensus = classifyPlatformReleaseBootstrapNamespaceCensusV2(
    basenames,
  );
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
            ? Buffer.byteLength(
                PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_SHARED_LOCK_CONTENT_V2,
                "utf8",
              )
            : packageContract === undefined
              ? 128
              : Buffer.byteLength(expectedLockContent(packageContract.packageRef), "utf8");
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
        modifiedTimeNanoseconds: String(2000 + index),
        changedTimeNanoseconds: String(3000 + index),
      });
      const contentEvidence = isRoot
        ? {
            kind: "directory_membership" as const,
            membership: expectedRootMembership(packageContract!.packageRef),
          }
        : {
            kind: "bounded_regular_file_bytes" as const,
            rawContentHash: isScope
              ? sha256(canonicalJsonStringify(scope))
              : isSharedLock
                ? contract.registry.sharedLockContentHash
                : expectedLockHash(packageContract!.packageRef),
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
  const input: {
    physicalCensus: NamespacePhysicalCensusV2;
    packageRefs: readonly string[];
    systemAnchorObservation?: unknown;
  } = {
    physicalCensus: census,
    packageRefs: [...packageRefs],
  };
  if (systemAnchorObservation !== undefined) {
    input.systemAnchorObservation = systemAnchorObservation;
  }
  return buildPlatformReleaseBootstrapRegistryPackagePhysicalSnapshotTestV2(input);
}

function assertInvalid(
  action: () => unknown,
  code?:
    | "REGISTRY_PACKAGE_PHYSICAL_SNAPSHOT_INPUT_INVALID"
    | "REGISTRY_PACKAGE_PHYSICAL_SNAPSHOT_PACKAGE_SET_INVALID"
    | "REGISTRY_PACKAGE_PHYSICAL_SNAPSHOT_PROJECTION_INVALID"
    | "REGISTRY_PACKAGE_PHYSICAL_SNAPSHOT_SYSTEM_ANCHOR_INVALID"
    | "REGISTRY_PACKAGE_PHYSICAL_SNAPSHOT_SERIALIZATION_INVALID",
): void {
  assert.throws(action, (error: unknown) => {
    assert.ok(
      error
        instanceof PlatformReleaseBootstrapRegistryPackagePhysicalSnapshotTestErrorV2,
    );
    if (code !== undefined) assert.equal(error.code, code);
    return true;
  });
}

function rehashCaptureV2(capture: Record<string, any>): void {
  capture.fingerprint.fingerprintHash = hashFsObservationFingerprintV2(
    capture.fingerprint,
  );
  const { entryCaptureHash: _entryCaptureHash, ...identity } = capture;
  capture.entryCaptureHash = hashNamespacePhysicalEntryCaptureV2(identity);
}

function rehashCensusV2(candidate: Record<string, any>): void {
  const { physicalCensusHash: _physicalCensusHash, ...identity } = candidate;
  candidate.physicalCensusHash = hashNamespacePhysicalCensusV2(identity);
}

describe("test-only registry package physical snapshot", () => {
  before(async () => {
    if (process.platform !== "darwin") return;
    systemAnchorFixture =
      buildPlatformReleaseBootstrapDarwinSystemAnchorObservationFixtureForTestV2();
    systemAnchorObservation =
      await observePlatformReleaseBootstrapDarwinSystemAnchorObservationForTestV2(
        systemAnchorFixture,
        { challenge: Buffer.alloc(32, 0x62) },
      );
  });

  after(() => {
    systemAnchorFixture?.dispose();
  });

  it("joins all four package projections to one pathless full census", () => {
    const snapshot = buildSnapshotV2();
    assert.equal(snapshot.admissionScope, "test_fixture");
    assert.equal(snapshot.productionAuthority, false);
    assert.equal(snapshot.productionAdmission, "forbidden");
    assert.equal(snapshot.credentialUse, "none");
    assert.equal(snapshot.signingAuthority, "unsigned_test_fixture");
    assert.equal(snapshot.mutationAuthority, false);
    assert.equal(snapshot.trustConclusion, "characterization_only");
    assert.equal(snapshot.registryContractHash, contract.contractHash);
    assert.equal(
      snapshot.operationAbiSetHash,
      PLATFORM_RELEASE_BOOTSTRAP_OPERATION_ABI_SET_V2.abiSetHash,
    );
    assert.equal(snapshot.packageCount, 4);
    assert.deepEqual(snapshot.packageRefs, packageRefs);
    assert.deepEqual(
      snapshot.packageEvidence.map((evidence) => evidence.packageRef),
      packageRefs,
    );
    assert.ok(snapshot.packageEvidence.every((evidence) =>
      evidence.projection.sourcePhysicalCensusHash
        === snapshot.sourcePhysicalCensusHash
      && evidence.projection.sourceLogicalCensusHash
        === snapshot.sourceLogicalCensusHash,
    ));
    for (const evidence of snapshot.packageEvidence) {
      const lock = evidence.projection.orderedEntryCaptures.find(
        (capture) => capture.classification.category === "package_lock",
      );
      assert.ok(lock);
      assert.equal(
        lock.contentEvidence.kind === "bounded_regular_file_bytes"
          ? lock.contentEvidence.rawContentHash
          : undefined,
        expectedLockHash(evidence.packageRef),
      );
    }
    assert.equal(
      snapshot.systemAnchorRelation?.observationHash,
      systemAnchorObservation === undefined
        ? undefined
        : (requireSystemAnchorObservationV2() as Record<string, unknown>)
            .observationHash,
    );
    assert.ok(Object.isFrozen(snapshot));
    assert.ok(Object.isFrozen(snapshot.packageEvidence));
    assert.equal(
      PlatformReleaseBootstrapRegistryPackagePhysicalSnapshotTestV2Schema.safeParse(snapshot).success,
      true,
    );
    const serialized = JSON.parse(JSON.stringify(snapshot)) as unknown;
    const reparsed =
      parsePlatformReleaseBootstrapRegistryPackagePhysicalSnapshotTestCandidateV2(
        serialized,
      );
    assert.deepEqual(reparsed, snapshot);
    const serializedText = JSON.stringify(snapshot);
    assert.equal(serializedText.includes("absolutePath"), false);
    assert.equal(serializedText.includes("fixtureRoot"), false);
    assert.equal(serializedText.includes("/tmp/"), false);
  });

  it("rejects unknown, duplicate, and reordered package refs", () => {
    const census = buildFixtureCensusV2();
    assertInvalid(() =>
      buildPlatformReleaseBootstrapRegistryPackagePhysicalSnapshotTestV2({
        physicalCensus: census,
        packageRefs: ["unknown", ...packageRefs.slice(1)],
      }), "REGISTRY_PACKAGE_PHYSICAL_SNAPSHOT_PACKAGE_SET_INVALID");
    assertInvalid(() =>
      buildPlatformReleaseBootstrapRegistryPackagePhysicalSnapshotTestV2({
        physicalCensus: census,
        packageRefs: [packageRefs[0], packageRefs[0], packageRefs[2], packageRefs[3]],
      }), "REGISTRY_PACKAGE_PHYSICAL_SNAPSHOT_PACKAGE_SET_INVALID");
    assertInvalid(() =>
      buildPlatformReleaseBootstrapRegistryPackagePhysicalSnapshotTestV2({
        physicalCensus: census,
        packageRefs: [packageRefs[1], packageRefs[0], packageRefs[2], packageRefs[3]],
      }), "REGISTRY_PACKAGE_PHYSICAL_SNAPSHOT_PACKAGE_SET_INVALID");
  });

  it("rejects malformed scope, root kind/mode/membership, and lock content", () => {
    const scopeMismatch = structuredClone(buildFixtureCensusV2()) as Record<string, any>;
    scopeMismatch.filesystemScope.scopeNonce = "c".repeat(64);
    assertInvalid(() => buildSnapshotV2(scopeMismatch as NamespacePhysicalCensusV2));

    const rootMode = structuredClone(buildFixtureCensusV2()) as Record<string, any>;
    const rootCapture = rootMode.orderedEntryCaptures.find(
      (capture: any) => capture.classification.category === "package_root",
    )!;
    rootCapture.fingerprint.mode = "0444";
    rehashCaptureV2(rootCapture);
    rehashCensusV2(rootMode);
    assertInvalid(() => buildSnapshotV2(rootMode as NamespacePhysicalCensusV2),
      "REGISTRY_PACKAGE_PHYSICAL_SNAPSHOT_PROJECTION_INVALID");

    const membership = structuredClone(buildFixtureCensusV2()) as Record<string, any>;
    const membershipCapture = membership.orderedEntryCaptures.find(
      (capture: any) => capture.classification.category === "package_root",
    )!;
    membershipCapture.contentEvidence.membership.orderedEntries.reverse();
    membershipCapture.contentEvidence.membership.membershipHash =
      hashDirectoryMembershipIdentityV2(
        membershipCapture.contentEvidence.membership,
      );
    rehashCaptureV2(membershipCapture);
    rehashCensusV2(membership);
    assertInvalid(() => buildSnapshotV2(membership as NamespacePhysicalCensusV2),
      "REGISTRY_PACKAGE_PHYSICAL_SNAPSHOT_INPUT_INVALID");

    const lockContent = structuredClone(buildFixtureCensusV2()) as Record<string, any>;
    const lockCapture = lockContent.orderedEntryCaptures.find(
      (capture: any) => capture.classification.category === "package_lock",
    )!;
    lockCapture.contentEvidence.rawContentHash = "d".repeat(64);
    rehashCaptureV2(lockCapture);
    rehashCensusV2(lockContent);
    assertInvalid(() => buildSnapshotV2(lockContent as NamespacePhysicalCensusV2),
      "REGISTRY_PACKAGE_PHYSICAL_SNAPSHOT_PROJECTION_INVALID");

    const lockLength = structuredClone(buildFixtureCensusV2()) as Record<string, any>;
    const lengthCapture = lockLength.orderedEntryCaptures.find(
      (capture: any) => capture.classification.category === "package_lock",
    )!;
    lengthCapture.fingerprint.byteLength += 1;
    rehashCaptureV2(lengthCapture);
    rehashCensusV2(lockLength);
    assertInvalid(() => buildSnapshotV2(lockLength as NamespacePhysicalCensusV2),
      "REGISTRY_PACKAGE_PHYSICAL_SNAPSHOT_PROJECTION_INVALID");

    const rootKind = structuredClone(buildFixtureCensusV2()) as Record<string, any>;
    const root = rootKind.orderedEntryCaptures.find(
      (capture: any) => capture.classification.category === "package_root",
    )!;
    root.objectIdentity.objectKind = "ordinary_file";
    root.fingerprint.objectIdentityHash = root.objectIdentity.objectIdentityHash;
    rehashCaptureV2(root);
    rehashCensusV2(rootKind);
    assertInvalid(() => buildSnapshotV2(rootKind as NamespacePhysicalCensusV2));
  });

  it("rejects direct-child aliases and parent metadata drift", () => {
    const alias = structuredClone(buildFixtureCensusV2()) as Record<string, any>;
    const root = alias.orderedEntryCaptures.find(
      (capture: any) => capture.classification.category === "package_root",
    )!;
    const lock = alias.orderedEntryCaptures.find(
      (capture: any) => capture.classification.category === "package_lock",
    )!;
    lock.objectIdentity = structuredClone(root.objectIdentity);
    lock.fingerprint.objectIdentityHash = lock.objectIdentity.objectIdentityHash;
    rehashCaptureV2(lock);
    rehashCensusV2(alias);
    assertInvalid(() => buildSnapshotV2(alias as NamespacePhysicalCensusV2));

    const parent = structuredClone(buildFixtureCensusV2()) as Record<string, any>;
    parent.parentFingerprint.mode = "0700";
    parent.parentFingerprint.fingerprintHash =
      hashFsObservationFingerprintV2(parent.parentFingerprint);
    rehashCensusV2(parent);
    assertInvalid(() => buildSnapshotV2(parent as NamespacePhysicalCensusV2),
      "REGISTRY_PACKAGE_PHYSICAL_SNAPSHOT_PROJECTION_INVALID");
  });

  it("rejects a rehashed top-level scope transplant", () => {
    const snapshot = structuredClone(buildSnapshotV2()) as Record<string, any>;
    snapshot.filesystemScopeIdentityHash = "f".repeat(64);
    const { snapshotHash: _snapshotHash, ...identity } = snapshot;
    snapshot.snapshotHash =
      hashPlatformReleaseBootstrapRegistryPackagePhysicalSnapshotTestV2(identity);
    assert.equal(
      PlatformReleaseBootstrapRegistryPackagePhysicalSnapshotTestV2Schema.safeParse(snapshot).success,
      false,
    );
    assertInvalid(
      () => parsePlatformReleaseBootstrapRegistryPackagePhysicalSnapshotTestCandidateV2(snapshot),
      "REGISTRY_PACKAGE_PHYSICAL_SNAPSHOT_SERIALIZATION_INVALID",
    );
  });

  it("rejects proxies and malformed optional system-anchor relations", () => {
    const input = {
      physicalCensus: buildFixtureCensusV2(),
      packageRefs: [...packageRefs],
    };
    assertInvalid(() =>
      buildPlatformReleaseBootstrapRegistryPackagePhysicalSnapshotTestV2(
        new Proxy(input, {}),
      ), "REGISTRY_PACKAGE_PHYSICAL_SNAPSHOT_INPUT_INVALID");
    assertInvalid(() =>
      buildPlatformReleaseBootstrapRegistryPackagePhysicalSnapshotTestV2({
        ...input,
        physicalCensus: new Proxy(input.physicalCensus, {}),
      }), "REGISTRY_PACKAGE_PHYSICAL_SNAPSHOT_INPUT_INVALID");
    if (systemAnchorObservation !== undefined) {
      assertInvalid(() =>
        buildPlatformReleaseBootstrapRegistryPackagePhysicalSnapshotTestV2({
          ...input,
          systemAnchorObservation: {
            ...(structuredClone(requireSystemAnchorObservationV2()) as Record<string, any>),
            productionAuthority: true,
          },
        }), "REGISTRY_PACKAGE_PHYSICAL_SNAPSHOT_SYSTEM_ANCHOR_INVALID");
    }
    assertInvalid(() =>
      buildPlatformReleaseBootstrapRegistryPackagePhysicalSnapshotTestV2({
        ...input,
        systemAnchorRelation: {
          relation:
            "external_system_anchor_observation_hash_only_test_relation_v2",
          admissionScope: "test_fixture",
          productionAuthority: false,
          productionAdmission: "forbidden",
          observationHash: "e".repeat(64),
        } as never,
      } as never), "REGISTRY_PACKAGE_PHYSICAL_SNAPSHOT_INPUT_INVALID");
  });
});
