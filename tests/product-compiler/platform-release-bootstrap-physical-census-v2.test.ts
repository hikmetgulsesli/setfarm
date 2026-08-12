import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2,
} from
  "../../src/execution/schemas/platform-release-bootstrap-contract-v2.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2,
} from
  "../../src/execution/schemas/platform-release-bootstrap-operation-abis-v2.js";
import {
  BootstrapFilesystemScopeIdentityV2Schema,
  DirectoryMembershipIdentityV2Schema,
  FsObservationFingerprintV2Schema,
  NamespacePhysicalContentEvidenceV2Schema,
  NamespacePhysicalCensusV2Schema,
  NamespacePhysicalEntryCaptureV2Schema,
  PackageLifecyclePhysicalProjectionV2Schema,
  StableFsObjectIdentityV2Schema,
  PLATFORM_RELEASE_BOOTSTRAP_PHYSICAL_CENSUS_MAX_CANONICAL_BYTES_V2,
  buildBootstrapFilesystemScopeIdentityV2,
  buildDirectoryMembershipIdentityV2,
  buildFsObservationFingerprintV2,
  buildNamespacePhysicalCensusV2,
  buildNamespacePhysicalEntryCaptureV2,
  buildPackageLifecyclePhysicalProjectionV2,
  buildStableFsObjectIdentityV2,
  hashBootstrapFilesystemScopeIdentityV2,
  hashDirectoryMembershipIdentityV2,
  hashFsObservationFingerprintV2,
  hashNamespacePhysicalCensusV2,
  hashNamespacePhysicalEntryCaptureV2,
  hashPackageLifecyclePhysicalProjectionV2,
  hashStableFsObjectIdentityV2,
  parseBootstrapFilesystemScopeIdentityCandidateV2,
  parseDirectoryMembershipIdentityCandidateV2,
  parseFsObservationFingerprintCandidateV2,
  parseNamespacePhysicalCensusCandidateV2,
  parseNamespacePhysicalEntryCaptureCandidateV2,
  parsePackageLifecyclePhysicalProjectionCandidateV2,
  parseStableFsObjectIdentityCandidateV2,
  type BootstrapFilesystemScopeIdentityV2,
  type DirectoryMembershipIdentityV2,
  type FsObservationFingerprintV2,
  type NamespacePhysicalCensusV2,
  type NamespacePhysicalEntryCaptureV2,
  type NamespacePhysicalContentEvidenceV2,
  type StableFsObjectIdentityV2,
  type StableFsObjectKindV2,
} from
  "../../src/product-compiler/platform-release-bootstrap-physical-census-v2.js";
import {
  canonicalJsonStringify,
} from "../../src/product-compiler/canonical-json.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_NAMESPACE_CENSUS_MAX_ENTRIES_V2,
  classifyPlatformReleaseBootstrapNamespaceCensusV2,
  type PlatformReleaseBootstrapNamespaceClassificationV2,
} from
  "../../src/product-compiler/platform-release-bootstrap-registry-v2.js";

const hex = (character: string): string => character.repeat(64);
const contract = PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2;
const hostPackage = contract.packages.find((entry) =>
  entry.packageRef
    === PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.hostVerifier)!;
const nodePackage = contract.packages.find((entry) =>
  entry.packageRef
    === PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2
      .nodeToolchainProvisioner)!;

function mutableClone<T>(value: T): T {
  return structuredClone(value);
}

function expectedKind(
  classification:
    PlatformReleaseBootstrapNamespaceClassificationV2,
): StableFsObjectKindV2 {
  return (
    classification.category === "transaction_staging"
    || classification.category === "package_root"
    || classification.category === "generation_staging"
  )
    ? "directory"
    : "ordinary_file";
}

function contentEvidence(
  objectKind: StableFsObjectKindV2,
  index: number,
): NamespacePhysicalContentEvidenceV2 {
  const character =
    "abcdef0123456789"[index % 16]!;
  return objectKind === "ordinary_file"
    ? {
        kind: "bounded_regular_file_bytes",
        rawContentHash: hex(character),
      }
    : {
        kind: "directory_membership",
        membership: buildDirectoryMembershipIdentityV2({
          orderedEntries: [],
        }),
      };
}

function fingerprint(
  objectIdentity: StableFsObjectIdentityV2,
  overrides: Partial<{
    ownerUid: number;
    ownerGid: number;
    mode: string;
    linkCount: number;
    byteLength: number;
    modifiedTimeNanoseconds: string;
    changedTimeNanoseconds: string;
  }> = {},
): FsObservationFingerprintV2 {
  return buildFsObservationFingerprintV2({
    objectIdentity,
    ownerUid: overrides.ownerUid ?? 0,
    ownerGid: overrides.ownerGid ?? 0,
    mode: overrides.mode
      ?? (
        objectIdentity.objectKind === "directory"
          ? "0700"
          : "0444"
      ),
    linkCount: overrides.linkCount ?? 1,
    byteLength: overrides.byteLength ?? 128,
    modifiedTimeNanoseconds:
      overrides.modifiedTimeNanoseconds ?? "1000",
    changedTimeNanoseconds:
      overrides.changedTimeNanoseconds ?? "1001",
  });
}

function entryCapture(
  input: Readonly<{
    classification:
      PlatformReleaseBootstrapNamespaceClassificationV2;
    filesystemScope: BootstrapFilesystemScopeIdentityV2;
    parentObjectIdentity: StableFsObjectIdentityV2;
    index: number;
    objectIdentity?: StableFsObjectIdentityV2;
    fingerprint?: FsObservationFingerprintV2;
    parentObjectIdentityHash?: string;
    contentEvidence?: NamespacePhysicalContentEvidenceV2;
  }>,
): NamespacePhysicalEntryCaptureV2 {
  const objectKind = expectedKind(input.classification);
  const objectIdentity = input.objectIdentity
    ?? buildStableFsObjectIdentityV2({
      filesystemScope: input.filesystemScope,
      objectKind,
      device: "7",
      inode: String(200 + input.index),
    });
  return buildNamespacePhysicalEntryCaptureV2({
    classification: input.classification,
    parentObjectIdentityHash:
      input.parentObjectIdentityHash
      ?? input.parentObjectIdentity.objectIdentityHash,
    objectIdentity,
    fingerprint:
      input.fingerprint ?? fingerprint(objectIdentity),
    contentEvidence:
      input.contentEvidence
      ?? contentEvidence(objectKind, input.index),
  });
}

function physicalCensus(
  names: readonly string[],
  input: Readonly<{
    filesystemScope?: BootstrapFilesystemScopeIdentityV2;
    parentInode?: string;
  }> = {},
): NamespacePhysicalCensusV2 {
  const filesystemScope = input.filesystemScope
    ?? buildBootstrapFilesystemScopeIdentityV2({
      scopeNonce: hex("1"),
    });
  const logicalCensus =
    classifyPlatformReleaseBootstrapNamespaceCensusV2(names);
  const parentObjectIdentity =
    buildStableFsObjectIdentityV2({
      filesystemScope,
      objectKind: "directory",
      device: "7",
      inode: input.parentInode ?? "100",
    });
  const parentFingerprint = fingerprint(
    parentObjectIdentity,
    { mode: "0755", byteLength: 512 },
  );
  const orderedEntryCaptures =
    logicalCensus.orderedEntries.map((classification, index) =>
      entryCapture({
        classification,
        filesystemScope,
        parentObjectIdentity,
        index,
      }));
  return buildNamespacePhysicalCensusV2({
    filesystemScope,
    logicalCensus,
    parentObjectIdentity,
    parentFingerprint,
    orderedEntryCaptures,
  });
}

function oversizedSelfConsistentPhysicalCensusCandidate():
NamespacePhysicalCensusV2 {
  const filesystemScope =
    buildBootstrapFilesystemScopeIdentityV2({
      scopeNonce: hex("d"),
    });
  const basenames = Array.from(
    {
      length:
        PLATFORM_RELEASE_BOOTSTRAP_NAMESPACE_CENSUS_MAX_ENTRIES_V2,
    },
    (_, index) =>
      `${hostPackage.lifecycle.stagingPrefix}.${
        index.toString(16).padStart(64, "0")
      }`,
  );
  const seed = physicalCensus(
    [basenames[0]!],
    { filesystemScope, parentInode: "900000" },
  );
  const logicalCensus =
    classifyPlatformReleaseBootstrapNamespaceCensusV2(basenames);
  const seedCapture = seed.orderedEntryCaptures[0]!;
  const orderedEntryCaptures =
    logicalCensus.orderedEntries.map((classification, index) => {
      const objectIdentity =
        mutableClone(seedCapture.objectIdentity);
      objectIdentity.inode = String(1_000_000 + index);
      objectIdentity.objectIdentityHash =
        hashStableFsObjectIdentityV2(objectIdentity);
      const observed = mutableClone(seedCapture.fingerprint);
      observed.objectIdentityHash =
        objectIdentity.objectIdentityHash;
      observed.fingerprintHash =
        hashFsObservationFingerprintV2(observed);
      const capture = mutableClone(seedCapture);
      capture.classification = classification;
      capture.objectIdentity = objectIdentity;
      capture.fingerprint = observed;
      capture.entryCaptureHash =
        hashNamespacePhysicalEntryCaptureV2(capture);
      return capture;
    });
  const candidate = mutableClone(seed);
  candidate.logicalCensus = logicalCensus;
  candidate.entryCount = orderedEntryCaptures.length;
  candidate.orderedEntryCaptures = orderedEntryCaptures;
  candidate.physicalCensusHash =
    hashNamespacePhysicalCensusV2(candidate);
  return candidate;
}

describe("platform release bootstrap physical census v2", () => {
  it("builds strict frozen scope, stable identity, fingerprint, and entry fences", () => {
    const filesystemScope =
      buildBootstrapFilesystemScopeIdentityV2({
        scopeNonce: hex("1"),
      });
    assert.equal(
      BootstrapFilesystemScopeIdentityV2Schema.safeParse(
        filesystemScope,
      ).success,
      true,
    );
    assert.equal(
      filesystemScope.scopeIdentityHash,
      hashBootstrapFilesystemScopeIdentityV2(
        filesystemScope,
      ),
    );

    const parent = buildStableFsObjectIdentityV2({
      filesystemScope,
      objectKind: "directory",
      device: "18446744073709551616",
      inode: "340282366920938463463374607431768211455",
    });
    const file = buildStableFsObjectIdentityV2({
      filesystemScope,
      objectKind: "ordinary_file",
      device: "18446744073709551616",
      inode: "340282366920938463463374607431768211456",
    });
    assert.equal(
      StableFsObjectIdentityV2Schema.safeParse(file).success,
      true,
    );
    assert.equal(
      file.objectIdentityHash,
      hashStableFsObjectIdentityV2(file),
    );

    const observed = fingerprint(file);
    assert.equal(
      FsObservationFingerprintV2Schema.safeParse(observed).success,
      true,
    );
    assert.equal(
      observed.fingerprintHash,
      hashFsObservationFingerprintV2(observed),
    );

    const logical =
      classifyPlatformReleaseBootstrapNamespaceCensusV2([
        hostPackage.lifecycle.packageLockBasename,
      ]);
    const capture = entryCapture({
      classification: logical.orderedEntries[0]!,
      filesystemScope,
      parentObjectIdentity: parent,
      objectIdentity: file,
      fingerprint: observed,
      index: 0,
    });
    assert.equal(
      NamespacePhysicalEntryCaptureV2Schema.safeParse(capture)
        .success,
      true,
    );
    assert.equal(
      capture.entryCaptureHash,
      hashNamespacePhysicalEntryCaptureV2(capture),
    );
    assert.ok(Object.isFrozen(capture));
    assert.ok(Object.isFrozen(capture.classification));
    assert.ok(Object.isFrozen(capture.objectIdentity));
    assert.ok(Object.isFrozen(capture.fingerprint));
    assert.ok(Object.isFrozen(capture.contentEvidence));

    const strictTamper = {
      ...mutableClone(capture),
      unknown: true,
    };
    assert.throws(() =>
      parseNamespacePhysicalEntryCaptureCandidateV2(
        strictTamper,
      ));
    const selfHashTamper = mutableClone(capture);
    selfHashTamper.contentEvidence = {
      kind: "bounded_regular_file_bytes",
      rawContentHash: hex("e"),
    };
    assert.throws(() =>
      parseNamespacePhysicalEntryCaptureCandidateV2(
        selfHashTamper,
      ));
  });

  it("binds directory evidence to one strict canonical membership identity", () => {
    const empty = buildDirectoryMembershipIdentityV2({
      orderedEntries: [],
    });
    assert.equal(
      DirectoryMembershipIdentityV2Schema.safeParse(empty).success,
      true,
    );
    assert.equal(
      empty.membershipHash,
      hashDirectoryMembershipIdentityV2(empty),
    );

    const mixed = buildDirectoryMembershipIdentityV2({
      orderedEntries: [
        { basename: "artifact", objectKind: "ordinary_file" },
        { basename: "cache", objectKind: "directory" },
      ],
    });
    assert.deepEqual(
      parseDirectoryMembershipIdentityCandidateV2(mixed),
      mixed,
    );
    assert.ok(Object.isFrozen(mixed));
    assert.ok(Object.isFrozen(mixed.orderedEntries));
    assert.equal(
      NamespacePhysicalContentEvidenceV2Schema.safeParse({
        kind: "directory_membership",
        membership: mixed,
      }).success,
      true,
    );
    assert.equal(
      NamespacePhysicalContentEvidenceV2Schema.safeParse({
        kind: "directory_membership",
        membershipHash: hex("a"),
      }).success,
      false,
    );

    const invalidCandidates: DirectoryMembershipIdentityV2[] = [];
    const reversed = mutableClone(mixed);
    reversed.orderedEntries.reverse();
    reversed.membershipHash =
      hashDirectoryMembershipIdentityV2(reversed);
    invalidCandidates.push(reversed);

    const duplicate = mutableClone(mixed);
    duplicate.orderedEntries[1] =
      mutableClone(duplicate.orderedEntries[0]!);
    duplicate.membershipHash =
      hashDirectoryMembershipIdentityV2(duplicate);
    invalidCandidates.push(duplicate);

    const malformed = mutableClone(mixed);
    malformed.orderedEntries[0]!.basename = "../artifact";
    malformed.membershipHash =
      hashDirectoryMembershipIdentityV2(malformed);
    invalidCandidates.push(malformed);

    const invalidKind = mutableClone(mixed);
    (
      invalidKind.orderedEntries[0] as { objectKind: string }
    ).objectKind = "symlink";
    invalidKind.membershipHash =
      hashDirectoryMembershipIdentityV2(invalidKind);
    invalidCandidates.push(invalidKind);

    const hashTamper = mutableClone(mixed);
    hashTamper.membershipHash = hex("f");
    invalidCandidates.push(hashTamper);

    for (const candidate of invalidCandidates) {
      assert.equal(
        DirectoryMembershipIdentityV2Schema.safeParse(candidate)
          .success,
        false,
      );
    }
  });

  it("keeps stable inode identity separate from mutable occurrence fingerprints", () => {
    const filesystemScope =
      buildBootstrapFilesystemScopeIdentityV2({
        scopeNonce: hex("2"),
      });
    const original = buildStableFsObjectIdentityV2({
      filesystemScope,
      objectKind: "ordinary_file",
      device: "7",
      inode: "500",
    });
    const stageOnly = fingerprint(original, {
      linkCount: 1,
      changedTimeNanoseconds: "2000",
    });
    const stageAndFinal = fingerprint(original, {
      linkCount: 2,
      changedTimeNanoseconds: "2001",
    });
    const finalOnly = fingerprint(original, {
      linkCount: 1,
      changedTimeNanoseconds: "2002",
    });
    assert.equal(
      stageOnly.objectIdentityHash,
      stageAndFinal.objectIdentityHash,
    );
    assert.equal(
      stageAndFinal.objectIdentityHash,
      finalOnly.objectIdentityHash,
    );
    assert.notEqual(
      stageOnly.fingerprintHash,
      stageAndFinal.fingerprintHash,
    );
    assert.notEqual(
      stageAndFinal.fingerprintHash,
      finalOnly.fingerprintHash,
    );

    const replacement = buildStableFsObjectIdentityV2({
      filesystemScope,
      objectKind: "ordinary_file",
      device: original.device,
      inode: "501",
    });
    assert.notEqual(
      replacement.objectIdentityHash,
      original.objectIdentityHash,
    );
    const sameContentHash = hex("a");
    assert.equal(sameContentHash, hex("a"));
  });

  it("fails closed on noncanonical physical numbers, kind/content drift, and hash aliases", () => {
    const filesystemScope =
      buildBootstrapFilesystemScopeIdentityV2({
        scopeNonce: hex("3"),
      });
    for (
      const invalidDecimal
      of ["00", "01", "-1", "+1", " 1", "1".repeat(81)]
    ) {
      assert.throws(() =>
        buildStableFsObjectIdentityV2({
          filesystemScope,
          objectKind: "ordinary_file",
          device: invalidDecimal,
          inode: "1",
        }));
    }
    assert.throws(() =>
      buildFsObservationFingerprintV2({
        objectIdentity:
          buildStableFsObjectIdentityV2({
            filesystemScope,
            objectKind: "ordinary_file",
            device: "7",
            inode: "10",
          }),
        ownerUid: 0,
        ownerGid: 0,
        mode: "444",
        linkCount: 1,
        byteLength: 1,
        modifiedTimeNanoseconds: "1",
        changedTimeNanoseconds: "1",
      }));
    assert.throws(() =>
      buildFsObservationFingerprintV2({
        objectIdentity:
          buildStableFsObjectIdentityV2({
            filesystemScope,
            objectKind: "ordinary_file",
            device: "7",
            inode: "10",
          }),
        ownerUid: 4_294_967_295,
        ownerGid: 0,
        mode: "0444",
        linkCount: 1,
        byteLength: 1,
        modifiedTimeNanoseconds: "1",
        changedTimeNanoseconds: "1",
      }));
    assert.throws(() =>
      buildFsObservationFingerprintV2({
        objectIdentity:
          buildStableFsObjectIdentityV2({
            filesystemScope,
            objectKind: "ordinary_file",
            device: "7",
            inode: "10",
          }),
        ownerUid: 0,
        ownerGid: 0,
        mode: "0444",
        linkCount: 1,
        byteLength: 1,
        modifiedTimeNanoseconds: "-1",
        changedTimeNanoseconds: "1",
      }));

    const logical =
      classifyPlatformReleaseBootstrapNamespaceCensusV2([
        hostPackage.rootBasename,
      ]);
    const parent = buildStableFsObjectIdentityV2({
      filesystemScope,
      objectKind: "directory",
      device: "7",
      inode: "11",
    });
    const wrongKindObject = buildStableFsObjectIdentityV2({
      filesystemScope,
      objectKind: "ordinary_file",
      device: "7",
      inode: "12",
    });
    assert.throws(() =>
      buildNamespacePhysicalEntryCaptureV2({
        classification: logical.orderedEntries[0]!,
        parentObjectIdentityHash: parent.objectIdentityHash,
        objectIdentity: wrongKindObject,
        fingerprint: fingerprint(wrongKindObject),
        contentEvidence: {
          kind: "bounded_regular_file_bytes",
          rawContentHash: hex("c"),
        },
      }));

    const lockLogical =
      classifyPlatformReleaseBootstrapNamespaceCensusV2([
        hostPackage.lifecycle.packageLockBasename,
      ]);
    const file = buildStableFsObjectIdentityV2({
      filesystemScope,
      objectKind: "ordinary_file",
      device: "7",
      inode: "13",
    });
    const fileFingerprint = fingerprint(file);
    for (
      const aliasedHash
      of [file.objectIdentityHash, fileFingerprint.fingerprintHash]
    ) {
      assert.throws(() =>
        buildNamespacePhysicalEntryCaptureV2({
          classification: lockLogical.orderedEntries[0]!,
          parentObjectIdentityHash: parent.objectIdentityHash,
          objectIdentity: file,
          fingerprint: fileFingerprint,
          contentEvidence: {
            kind: "bounded_regular_file_bytes",
            rawContentHash: aliasedHash,
          },
        }));
    }
  });

  it("builds one exact logical and physical census with ordered unique direct children", () => {
    const census = physicalCensus([
      contract.registry.activationReceiptBasename,
      contract.registry.sharedLockBasename,
      hostPackage.rootBasename,
      hostPackage.lifecycle.activeClaimBasename,
      hostPackage.lifecycle.packageLockBasename,
      `${hostPackage.lifecycle.stagingPrefix}.${hex("4")}`,
      nodePackage.lifecycle.packageLockBasename,
    ]);
    assert.equal(
      NamespacePhysicalCensusV2Schema.safeParse(census).success,
      true,
    );
    assert.equal(
      census.physicalCensusHash,
      hashNamespacePhysicalCensusV2(census),
    );
    assert.equal(
      census.entryCount,
      census.logicalCensus.entryCount,
    );
    assert.deepEqual(
      census.orderedEntryCaptures.map((capture) =>
        capture.classification.classificationHash),
      census.logicalCensus.orderedEntries.map((classification) =>
        classification.classificationHash),
    );
    assert.equal(
      new Set(census.orderedEntryCaptures.map((capture) =>
        capture.objectIdentity.objectIdentityHash)).size,
      census.entryCount,
    );
    assert.ok(Object.isFrozen(census));
    assert.ok(Object.isFrozen(census.logicalCensus));
    assert.ok(Object.isFrozen(census.orderedEntryCaptures));
  });

  it("rejects order, count, parent, scope, and global hard-link alias violations", () => {
    const census = physicalCensus([
      hostPackage.lifecycle.activeClaimBasename,
      hostPackage.lifecycle.packageLockBasename,
    ]);
    const reversed = [...census.orderedEntryCaptures].reverse();
    assert.throws(() =>
      buildNamespacePhysicalCensusV2({
        filesystemScope: census.filesystemScope,
        logicalCensus: census.logicalCensus,
        parentObjectIdentity: census.parentObjectIdentity,
        parentFingerprint: census.parentFingerprint,
        orderedEntryCaptures: reversed,
      }));

    const countTamper = mutableClone(census);
    countTamper.entryCount += 1;
    countTamper.physicalCensusHash =
      hashNamespacePhysicalCensusV2(countTamper);
    assert.throws(() =>
      parseNamespacePhysicalCensusCandidateV2(countTamper));

    const foreignParent =
      buildStableFsObjectIdentityV2({
        filesystemScope: census.filesystemScope,
        objectKind: "directory",
        device: "7",
        inode: "999",
      });
    const wrongParentCapture = entryCapture({
      classification:
        census.logicalCensus.orderedEntries[0]!,
      filesystemScope: census.filesystemScope,
      parentObjectIdentity: census.parentObjectIdentity,
      parentObjectIdentityHash:
        foreignParent.objectIdentityHash,
      index: 0,
    });
    assert.throws(() =>
      buildNamespacePhysicalCensusV2({
        filesystemScope: census.filesystemScope,
        logicalCensus: census.logicalCensus,
        parentObjectIdentity: census.parentObjectIdentity,
        parentFingerprint: census.parentFingerprint,
        orderedEntryCaptures: [
          wrongParentCapture,
          census.orderedEntryCaptures[1]!,
        ],
      }));

    const transplanted = mutableClone(census);
    transplanted.filesystemScope =
      buildBootstrapFilesystemScopeIdentityV2({
        scopeNonce: hex("9"),
      });
    transplanted.filesystemScopeIdentityHash =
      transplanted.filesystemScope.scopeIdentityHash;
    transplanted.physicalCensusHash =
      hashNamespacePhysicalCensusV2(transplanted);
    assert.throws(() =>
      parseNamespacePhysicalCensusCandidateV2(transplanted));

    const sharedObject =
      census.orderedEntryCaptures[0]!.objectIdentity;
    const sharedFingerprint = fingerprint(sharedObject);
    const aliasedSecond = entryCapture({
      classification:
        census.logicalCensus.orderedEntries[1]!,
      filesystemScope: census.filesystemScope,
      parentObjectIdentity: census.parentObjectIdentity,
      objectIdentity: sharedObject,
      fingerprint: sharedFingerprint,
      index: 1,
    });
    assert.throws(() =>
      buildNamespacePhysicalCensusV2({
        filesystemScope: census.filesystemScope,
        logicalCensus: census.logicalCensus,
        parentObjectIdentity: census.parentObjectIdentity,
        parentFingerprint: census.parentFingerprint,
        orderedEntryCaptures: [
          census.orderedEntryCaptures[0]!,
          aliasedSecond,
        ],
      }));

    const parentAliasedFile =
      buildStableFsObjectIdentityV2({
        filesystemScope: census.filesystemScope,
        objectKind: "ordinary_file",
        device: census.parentObjectIdentity.device,
        inode: census.parentObjectIdentity.inode,
      });
    const parentAliasedCapture = entryCapture({
      classification:
        census.logicalCensus.orderedEntries[0]!,
      filesystemScope: census.filesystemScope,
      parentObjectIdentity: census.parentObjectIdentity,
      objectIdentity: parentAliasedFile,
      fingerprint: fingerprint(parentAliasedFile),
      index: 0,
    });
    assert.throws(() =>
      buildNamespacePhysicalCensusV2({
        filesystemScope: census.filesystemScope,
        logicalCensus: census.logicalCensus,
        parentObjectIdentity: census.parentObjectIdentity,
        parentFingerprint: census.parentFingerprint,
        orderedEntryCaptures: [
          parentAliasedCapture,
          census.orderedEntryCaptures[1]!,
        ],
      }));

    const mixedLogical =
      classifyPlatformReleaseBootstrapNamespaceCensusV2([
        hostPackage.rootBasename,
        hostPackage.lifecycle.packageLockBasename,
      ]);
    const sharedDevice = "71";
    const sharedInode = "710";
    const directoryAlias = buildStableFsObjectIdentityV2({
      filesystemScope: census.filesystemScope,
      objectKind: "directory",
      device: sharedDevice,
      inode: sharedInode,
    });
    const fileAlias = buildStableFsObjectIdentityV2({
      filesystemScope: census.filesystemScope,
      objectKind: "ordinary_file",
      device: sharedDevice,
      inode: sharedInode,
    });
    const mixedCaptures = mixedLogical.orderedEntries.map(
      (classification, index) => {
        const objectIdentity =
          expectedKind(classification) === "directory"
            ? directoryAlias
            : fileAlias;
        return entryCapture({
          classification,
          filesystemScope: census.filesystemScope,
          parentObjectIdentity: census.parentObjectIdentity,
          objectIdentity,
          fingerprint: fingerprint(objectIdentity),
          index,
        });
      },
    );
    assert.notEqual(
      directoryAlias.objectIdentityHash,
      fileAlias.objectIdentityHash,
    );
    assert.throws(() =>
      buildNamespacePhysicalCensusV2({
        filesystemScope: census.filesystemScope,
        logicalCensus: mixedLogical,
        parentObjectIdentity: census.parentObjectIdentity,
        parentFingerprint: census.parentFingerprint,
        orderedEntryCaptures: mixedCaptures,
      }));
  });

  it("derives one source-bound package projection and exact package-lock object", () => {
    const census = physicalCensus([
      hostPackage.rootBasename,
      hostPackage.lifecycle.activeClaimBasename,
      hostPackage.lifecycle.packageLockBasename,
      nodePackage.lifecycle.packageLockBasename,
    ]);
    const projection =
      buildPackageLifecyclePhysicalProjectionV2(
        census,
        hostPackage.packageRef,
      );
    assert.equal(
      PackageLifecyclePhysicalProjectionV2Schema
        .safeParse(projection).success,
      true,
    );
    assert.equal(
      projection.sourceLogicalCensusHash,
      census.logicalCensus.censusHash,
    );
    assert.equal(
      projection.sourcePhysicalCensusHash,
      census.physicalCensusHash,
    );
    assert.equal(
      projection.projectionHash,
      hashPackageLifecyclePhysicalProjectionV2(projection),
    );
    const packageLock = projection.orderedEntryCaptures.find(
      (capture) =>
        capture.classification.category === "package_lock",
    )!;
    assert.equal(
      projection.packageLockObjectIdentityHash,
      packageLock.objectIdentity.objectIdentityHash,
    );
    assert.ok(Object.isFrozen(projection));
    assert.deepEqual(
      parsePackageLifecyclePhysicalProjectionCandidateV2(
        projection,
        census,
      ),
      projection,
    );

    const lockOnly = physicalCensus([
      hostPackage.lifecycle.packageLockBasename,
    ]);
    assert.equal(
      buildPackageLifecyclePhysicalProjectionV2(
        lockOnly,
        hostPackage.packageRef,
      ).entryCount,
      1,
    );
    const noHostEntries = physicalCensus([
      nodePackage.lifecycle.packageLockBasename,
    ]);
    assert.throws(() =>
      buildPackageLifecyclePhysicalProjectionV2(
        noHostEntries,
        hostPackage.packageRef,
      ));

    const duplicateLock = mutableClone(projection);
    duplicateLock.orderedEntryCaptures.push(
      mutableClone(packageLock),
    );
    duplicateLock.entryCount =
      duplicateLock.orderedEntryCaptures.length;
    duplicateLock.projectionHash =
      hashPackageLifecyclePhysicalProjectionV2(duplicateLock);
    assert.equal(
      PackageLifecyclePhysicalProjectionV2Schema
        .safeParse(duplicateLock).success,
      false,
    );
  });

  it("changes non-Node stable and projection identity on same-content inode replacement", () => {
    const first = physicalCensus([
      hostPackage.rootBasename,
      hostPackage.lifecycle.packageLockBasename,
    ]);
    const firstProjection =
      buildPackageLifecyclePhysicalProjectionV2(
        first,
        hostPackage.packageRef,
      );
    const replacementCaptures =
      first.orderedEntryCaptures.map((capture, index) => {
        if (
          capture.classification.category !== "package_lock"
        ) return capture;
        const replacementObject =
          buildStableFsObjectIdentityV2({
            filesystemScope: first.filesystemScope,
            objectKind: "ordinary_file",
            device: capture.objectIdentity.device,
            inode: "900",
          });
        return entryCapture({
          classification: capture.classification,
          filesystemScope: first.filesystemScope,
          parentObjectIdentity: first.parentObjectIdentity,
          objectIdentity: replacementObject,
          fingerprint: fingerprint(replacementObject),
          contentEvidence: capture.contentEvidence,
          index,
        });
      });
    const second = buildNamespacePhysicalCensusV2({
      filesystemScope: first.filesystemScope,
      logicalCensus: first.logicalCensus,
      parentObjectIdentity: first.parentObjectIdentity,
      parentFingerprint: first.parentFingerprint,
      orderedEntryCaptures: replacementCaptures,
    });
    const secondProjection =
      buildPackageLifecyclePhysicalProjectionV2(
        second,
        hostPackage.packageRef,
      );
    assert.notEqual(
      secondProjection.packageLockObjectIdentityHash,
      firstProjection.packageLockObjectIdentityHash,
    );
    assert.notEqual(
      secondProjection.projectionHash,
      firstProjection.projectionHash,
    );
    assert.throws(() =>
      parsePackageLifecyclePhysicalProjectionCandidateV2(
        firstProjection,
        second,
      ));
  });

  it("takes bounded snapshots without invoking accessors or proxies", () => {
    const filesystemScope =
      buildBootstrapFilesystemScopeIdentityV2({
        scopeNonce: hex("d"),
      });
    const parsedScope =
      parseBootstrapFilesystemScopeIdentityCandidateV2(
        mutableClone(filesystemScope),
      );
    assert.deepEqual(parsedScope, filesystemScope);
    assert.ok(Object.isFrozen(parsedScope));

    let getterCalls = 0;
    const accessorCandidate = {};
    Object.defineProperty(accessorCandidate, "schema", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return "must-not-run";
      },
    });
    assert.throws(() =>
      parseStableFsObjectIdentityCandidateV2(
        accessorCandidate,
      ));
    assert.equal(getterCalls, 0);

    let proxyReads = 0;
    const hostileProxy = new Proxy({}, {
      get() {
        proxyReads += 1;
        return "must-not-run";
      },
    });
    assert.throws(() =>
      parseFsObservationFingerprintCandidateV2(
        hostileProxy,
      ));
    assert.equal(proxyReads, 0);

    assert.throws(() =>
      parseBootstrapFilesystemScopeIdentityCandidateV2({
        ...filesystemScope,
        oversize: "x".repeat(65 * 1024),
      }));

    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;
    assert.throws(() =>
      parseNamespacePhysicalCensusCandidateV2(cycle));
  });

  it("enforces the physical census byte cap through the exported raw schema", () => {
    const oversized =
      oversizedSelfConsistentPhysicalCensusCandidate();
    assert.equal(
      oversized.entryCount,
      oversized.logicalCensus.entryCount,
    );
    assert.equal(
      oversized.entryCount,
      oversized.orderedEntryCaptures.length,
    );
    assert.equal(
      oversized.physicalCensusHash,
      hashNamespacePhysicalCensusV2(oversized),
    );
    assert.ok(
      Buffer.byteLength(
        canonicalJsonStringify(oversized),
        "utf8",
      )
        > PLATFORM_RELEASE_BOOTSTRAP_PHYSICAL_CENSUS_MAX_CANONICAL_BYTES_V2,
    );
    assert.equal(
      NamespacePhysicalCensusV2Schema.safeParse(oversized).success,
      false,
    );
  });
});
