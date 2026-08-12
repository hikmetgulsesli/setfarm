import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2 } from "../../src/execution/schemas/platform-release-bootstrap-contract-v2.js";
import { PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2 } from "../../src/execution/schemas/platform-release-bootstrap-operation-abis-v2.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_GENESIS_EPOCH_FLOOR_STATE_V2,
  buildPlatformReleaseBootstrapRegistryActivationClaimV2,
  buildPlatformReleaseBootstrapRegistryActivationReceiptV2,
  buildPlatformReleaseBootstrapRegistryEpochClaimV2,
  buildPlatformReleaseBootstrapRegistryEpochFloorStateV2,
} from "../../src/execution/schemas/platform-release-bootstrap-registry-state-v2.js";
import {
  buildBootstrapFilesystemScopeIdentityV2,
  buildDirectoryMembershipIdentityV2,
  buildFsObservationFingerprintV2,
  buildNamespacePhysicalCensusV2,
  buildNamespacePhysicalEntryCaptureV2,
  buildPackageLifecyclePhysicalProjectionV2,
  buildStableFsObjectIdentityV2,
  hashPackageLifecyclePhysicalProjectionV2,
  hashNamespacePhysicalCensusV2,
  type StableFsObjectIdentityV2,
  type StableFsObjectKindV2,
} from "../../src/product-compiler/platform-release-bootstrap-physical-census-v2.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_ACTIVATION_PRODUCTION_ERROR_CODE_V2,
  PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_NODE_LIFECYCLE_IDENTITY_HASH_V2,
  PlatformReleaseBootstrapRegistryActivationPlanV2Schema,
  PlatformReleaseBootstrapRegistryProductionActivationErrorV2,
  activatePlatformReleaseBootstrapRegistryProductionV2,
  buildPlatformReleaseBootstrapRegistryActivationObservationV2,
  buildPlatformReleaseBootstrapRegistryActivationPlanV2,
  buildPlatformReleaseBootstrapRegistryStagingPhysicalMemberV2,
  expectedPlatformReleaseBootstrapPackageLockRawContentHashV2,
  hashPlatformReleaseBootstrapRegistryOrphanStagingCensusV2,
  hashPlatformReleaseBootstrapRegistryPublishedCanonicalJsonBytesV2,
  hashPlatformReleaseBootstrapRegistryActivationCleanupRemainingCensusV2,
  hashPlatformReleaseBootstrapRegistryActivationStagingInitialCensusV2,
  hashPlatformReleaseBootstrapRegistryEpochStagingCurrentCensusV2,
  hashPlatformReleaseBootstrapRegistryEpochStagingInitialCensusV2,
  hashPlatformReleaseBootstrapRegistryActivationPlanV2,
  parsePlatformReleaseBootstrapRegistryActivationObservationCandidateV2,
  parsePlatformReleaseBootstrapRegistryActivationPlanCandidateV2,
  projectPlatformReleaseBootstrapRegistryClaimedPackageLifecycleV2,
  type PlatformReleaseBootstrapRegistryActivationObservationInputV2,
} from "../../src/product-compiler/platform-release-bootstrap-registry-activation-v2.js";
import {
  classifyPlatformReleaseBootstrapNamespaceCensusV2,
  type PlatformReleaseBootstrapNamespaceCensusV2,
} from "../../src/product-compiler/platform-release-bootstrap-registry-v2.js";
import { PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_CONTRACT_V2 } from "../../src/product-compiler/platform-release-bootstrap-registry-physical-activation-contract-v2.js";
import { createPlatformReleaseBootstrapRegistryDarwinLockFixtureSessionV2 } from "../../src/product-compiler/platform-release-bootstrap-registry-physical-activation-darwin-lock-fixture-v2.js";
import {
  PlatformReleaseBootstrapRegistryPhysicalActivationMechanicsErrorV2,
  hashPlatformReleaseBootstrapRegistryPhysicalActivationLockedSlotLedgerBindingV2,
  runPlatformReleaseBootstrapRegistryPhysicalActivationMechanicsOnlyV2,
} from "../../src/product-compiler/platform-release-bootstrap-registry-physical-activation-core-v2.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_MECHANICS_SCOPE_V2,
  type PlatformReleaseBootstrapRegistryPhysicalActivationLockedSlotLedgerTokenV2,
  type PlatformReleaseBootstrapRegistryPhysicalActivationMechanicsDriverV2,
  type PlatformReleaseBootstrapRegistryPhysicalActivationPlanHandleV2,
  type PlatformReleaseBootstrapRegistryPhysicalActivationSessionV2,
} from "../../src/product-compiler/platform-release-bootstrap-registry-physical-activation-types-v2.js";

const hash = (character: string): string => character.repeat(64);
const contract = PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2;
const nodePackage = contract.packages.find(
  (entry) =>
    entry.packageRef ===
    PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.nodeToolchainProvisioner,
)!;
const hostPackage = contract.packages.find(
  (entry) =>
    entry.packageRef ===
    PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.hostVerifier,
)!;

const ACTIVATION_TRANSACTION_IDENTITY = hash("4");
const EPOCH_PACKAGE_LOCK_IDENTITY = hash("c");
const FILESYSTEM_SCOPE = buildBootstrapFilesystemScopeIdentityV2({
  scopeNonce: hash("9"),
});
const PHYSICAL_PARENT_OBJECT = buildStableFsObjectIdentityV2({
  filesystemScope: FILESYSTEM_SCOPE,
  objectKind: "directory",
  device: "7",
  inode: "100",
});
const PARENT_IDENTITY = PHYSICAL_PARENT_OBJECT.objectIdentityHash;
const STAGED_SHARED_LOCK_OBJECT = stableObjectForBasename(
  contract.registry.sharedLockBasename,
  "ordinary_file",
);
const STAGED_GENESIS_EPOCH_OBJECT = stableObjectForBasename(
  contract.registry.epochFloorBasename,
  "ordinary_file",
);
const STAGED_ACTIVATION_RECEIPT_OBJECT = stableObjectForBasename(
  contract.registry.activationReceiptBasename,
  "ordinary_file",
);
const STAGED_EPOCH_TARGET_OBJECT = buildStableFsObjectIdentityV2({
  filesystemScope: FILESYSTEM_SCOPE,
  objectKind: "ordinary_file",
  device: "7",
  inode: "804",
});
const SHARED_LOCK_IDENTITY = STAGED_SHARED_LOCK_OBJECT.objectIdentityHash;
const GENESIS_EPOCH_FLOOR_PHYSICAL_IDENTITY =
  STAGED_GENESIS_EPOCH_OBJECT.objectIdentityHash;
const ACTIVATION_RECEIPT_PHYSICAL_IDENTITY =
  STAGED_ACTIVATION_RECEIPT_OBJECT.objectIdentityHash;
const STAGING_DIRECTORY_OBJECT = stableObjectForBasename(
  contract.registry.transactionStagingBasename,
  "directory",
);
const ACTIVATION_STAGING_DIRECTORY_IDENTITY =
  STAGING_DIRECTORY_OBJECT.objectIdentityHash;
const EPOCH_STAGING_DIRECTORY_IDENTITY = ACTIVATION_STAGING_DIRECTORY_IDENTITY;
const EPOCH_TARGET_PHYSICAL_IDENTITY =
  STAGED_EPOCH_TARGET_OBJECT.objectIdentityHash;

function physicalObjectKind(category: string): StableFsObjectKindV2 {
  return category === "transaction_staging" ||
    category === "package_root" ||
    category === "generation_staging"
    ? "directory"
    : "ordinary_file";
}

function deterministicPhysicalInode(basename: string): string {
  return BigInt(
    `0x${createHash("sha256")
      .update(`setfarm.test.bootstrap-physical-inode.v2\0${basename}`, "utf8")
      .digest("hex")
      .slice(0, 16)}`,
  ).toString(10);
}

function rawContentHashForBasename(basename: string): string {
  const packageContract = contract.packages.find(
    (entry) => entry.lifecycle.packageLockBasename === basename,
  );
  if (packageContract !== undefined) {
    return expectedPlatformReleaseBootstrapPackageLockRawContentHashV2(
      packageContract.packageRef,
    );
  }
  if (basename === contract.registry.sharedLockBasename) {
    return contract.registry.sharedLockContentHash;
  }
  if (basename === contract.registry.filesystemScopeBasename) {
    return hashPlatformReleaseBootstrapRegistryPublishedCanonicalJsonBytesV2(
      FILESYSTEM_SCOPE,
    );
  }
  if (basename === contract.registry.activationReceiptBasename) {
    return hashPlatformReleaseBootstrapRegistryPublishedCanonicalJsonBytesV2(
      expectedActivationReceipt(),
    );
  }
  if (basename === contract.registry.epochFloorBasename) {
    return hashPlatformReleaseBootstrapRegistryPublishedCanonicalJsonBytesV2(
      PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_GENESIS_EPOCH_FLOOR_STATE_V2,
    );
  }
  return createHash("sha256")
    .update(`setfarm.test.bootstrap-physical-content.v2\0${basename}`, "utf8")
    .digest("hex");
}

function physicalModifiedTimeNanoseconds(basename: string): string {
  return (BigInt(deterministicPhysicalInode(basename)) + 10_000n).toString(10);
}

function physicalChangedTimeNanoseconds(basename: string): string {
  return (BigInt(physicalModifiedTimeNanoseconds(basename)) + 1n).toString(10);
}

function stableObjectForBasename(
  basename: string,
  objectKind: StableFsObjectKindV2,
): StableFsObjectIdentityV2 {
  return stableObjectForBasenameInScope(basename, objectKind, FILESYSTEM_SCOPE);
}

function stableObjectForBasenameInScope(
  basename: string,
  objectKind: StableFsObjectKindV2,
  filesystemScope: typeof FILESYSTEM_SCOPE,
): StableFsObjectIdentityV2 {
  return buildStableFsObjectIdentityV2({
    filesystemScope,
    objectKind,
    device: "7",
    inode: deterministicPhysicalInode(basename),
  });
}

function stagingPhysicalMember(
  memberKind:
    | "staged_activation_receipt"
    | "staged_genesis_epoch_state"
    | "staged_shared_lock"
    | "staged_target_epoch_state",
  logicalIdentityHash: string,
  objectIdentity: StableFsObjectIdentityV2,
  rawContentHash?: string,
) {
  const finalBasename =
    memberKind === "staged_activation_receipt"
      ? contract.registry.activationReceiptBasename
      : memberKind === "staged_genesis_epoch_state" ||
          memberKind === "staged_target_epoch_state"
        ? contract.registry.epochFloorBasename
        : contract.registry.sharedLockBasename;
  const fingerprint = buildFsObservationFingerprintV2({
    objectIdentity,
    ownerUid: 0,
    ownerGid: 0,
    mode: "0600",
    linkCount: 1,
    byteLength: 128,
    modifiedTimeNanoseconds: physicalModifiedTimeNanoseconds(finalBasename),
    changedTimeNanoseconds: physicalChangedTimeNanoseconds(finalBasename),
  });
  return buildPlatformReleaseBootstrapRegistryStagingPhysicalMemberV2({
    memberKind,
    parentObjectIdentity: STAGING_DIRECTORY_OBJECT,
    logicalIdentityHash,
    objectIdentity,
    fingerprint,
    rawContentHash: rawContentHash ?? rawContentHashForBasename(finalBasename),
  });
}

function withStagingMemberLinkCount(
  member: ReturnType<typeof stagingPhysicalMember>,
  linkCount: number,
): ReturnType<typeof stagingPhysicalMember> {
  return buildPlatformReleaseBootstrapRegistryStagingPhysicalMemberV2({
    memberKind: member.memberKind,
    parentObjectIdentity: member.parentObjectIdentity,
    logicalIdentityHash: member.logicalIdentityHash,
    objectIdentity: member.objectIdentity,
    fingerprint: buildFsObservationFingerprintV2({
      objectIdentity: member.objectIdentity,
      ownerUid: member.fingerprint.ownerUid,
      ownerGid: member.fingerprint.ownerGid,
      mode: member.fingerprint.mode,
      linkCount,
      byteLength: member.fingerprint.byteLength,
      modifiedTimeNanoseconds: member.fingerprint.modifiedTimeNanoseconds,
      changedTimeNanoseconds: member.fingerprint.changedTimeNanoseconds,
    }),
    rawContentHash: member.rawContentHash,
  });
}

function stagingDirectoryEvidenceForMembers(
  members: readonly ReturnType<typeof stagingPhysicalMember>[],
) {
  return {
    stagingDirectoryFingerprint: buildFsObservationFingerprintV2({
      objectIdentity: STAGING_DIRECTORY_OBJECT,
      ownerUid: 0,
      ownerGid: 0,
      mode: "0700",
      linkCount: 1,
      byteLength: 512,
      modifiedTimeNanoseconds: physicalModifiedTimeNanoseconds(
        contract.registry.transactionStagingBasename,
      ),
      changedTimeNanoseconds: physicalChangedTimeNanoseconds(
        contract.registry.transactionStagingBasename,
      ),
    }),
    stagingDirectoryMembership: buildDirectoryMembershipIdentityV2({
      orderedEntries: members
        .map((member) => ({
          basename: member.classification.basename,
          objectKind: member.classification.objectKind,
        }))
        .sort((left, right) => (left.basename < right.basename ? -1 : 1)),
    }),
  };
}

const LEGACY_LOCK_IDENTITY = stableObjectForBasename(
  nodePackage.lifecycle.packageLockBasename,
  "ordinary_file",
).objectIdentityHash;

function mutableClone<T>(value: T): T {
  return structuredClone(value);
}

function exactNamespace(
  names: readonly string[],
  overrides: Readonly<{
    objectIdentities?: Readonly<Record<string, StableFsObjectIdentityV2>>;
    linkCounts?: Readonly<Record<string, number>>;
    modes?: Readonly<Record<string, string>>;
    ownerUids?: Readonly<Record<string, number>>;
    rawContentHashes?: Readonly<Record<string, string>>;
    directoryMembers?: Readonly<
      Record<
        string,
        readonly Readonly<{
          basename: string;
          objectKind: StableFsObjectKindV2;
        }>[]
      >
    >;
    filesystemScope?: typeof FILESYSTEM_SCOPE;
    parentMode?: string;
    parentOwnerUid?: number;
    parentOwnerGid?: number;
  }> = {},
): Extract<
  PlatformReleaseBootstrapRegistryActivationObservationInputV2["namespace"],
  { status: "exact" }
> {
  const filesystemScope = overrides.filesystemScope ?? FILESYSTEM_SCOPE;
  const parentObjectIdentity =
    filesystemScope.scopeIdentityHash === FILESYSTEM_SCOPE.scopeIdentityHash
      ? PHYSICAL_PARENT_OBJECT
      : buildStableFsObjectIdentityV2({
          filesystemScope,
          objectKind: "directory",
          device: "7",
          inode: "100",
        });
  const completeNames = names.includes(
    contract.registry.filesystemScopeBasename,
  )
    ? [...names]
    : [...names, contract.registry.filesystemScopeBasename];
  const census =
    classifyPlatformReleaseBootstrapNamespaceCensusV2(completeNames);
  const parentFingerprint = buildFsObservationFingerprintV2({
    objectIdentity: parentObjectIdentity,
    ownerUid: overrides.parentOwnerUid ?? 0,
    ownerGid: overrides.parentOwnerGid ?? 0,
    mode: overrides.parentMode ?? "0755",
    linkCount: 1,
    byteLength: 512,
    modifiedTimeNanoseconds: "1000",
    changedTimeNanoseconds: "1001",
  });
  const orderedEntryCaptures = census.orderedEntries.map((classification) => {
    const objectKind = physicalObjectKind(classification.category);
    const objectIdentity =
      overrides.objectIdentities?.[classification.basename] ??
      stableObjectForBasenameInScope(
        classification.basename,
        objectKind,
        filesystemScope,
      );
    const fingerprint = buildFsObservationFingerprintV2({
      objectIdentity,
      ownerUid: overrides.ownerUids?.[classification.basename] ?? 0,
      ownerGid: 0,
      mode:
        overrides.modes?.[classification.basename] ??
        (classification.ownerKind === "registry"
          ? objectKind === "directory"
            ? "0700"
            : "0600"
          : classification.category === "package_lock"
            ? "0600"
            : classification.category === "package_root"
              ? "0555"
              : objectKind === "directory"
                ? "0700"
                : "0444"),
      linkCount: overrides.linkCounts?.[classification.basename] ?? 1,
      byteLength: objectKind === "directory" ? 512 : 128,
      modifiedTimeNanoseconds: physicalModifiedTimeNanoseconds(
        classification.basename,
      ),
      changedTimeNanoseconds: physicalChangedTimeNanoseconds(
        classification.basename,
      ),
    });
    return buildNamespacePhysicalEntryCaptureV2({
      classification,
      parentObjectIdentityHash: parentObjectIdentity.objectIdentityHash,
      objectIdentity,
      fingerprint,
      contentEvidence:
        objectKind === "directory"
          ? {
              kind: "directory_membership",
              membership: buildDirectoryMembershipIdentityV2({
                orderedEntries: [
                  ...(overrides.directoryMembers?.[classification.basename] ??
                    []),
                ],
              }),
            }
          : {
              kind: "bounded_regular_file_bytes",
              rawContentHash:
                overrides.rawContentHashes?.[classification.basename] ??
                (classification.basename ===
                contract.registry.filesystemScopeBasename
                  ? hashPlatformReleaseBootstrapRegistryPublishedCanonicalJsonBytesV2(
                      filesystemScope,
                    )
                  : rawContentHashForBasename(classification.basename)),
            },
    });
  });
  const physicalCensus = buildNamespacePhysicalCensusV2({
    filesystemScope,
    logicalCensus: census,
    parentObjectIdentity,
    parentFingerprint,
    orderedEntryCaptures,
  });
  const nonNodeSiblingPackageRefs = [
    ...new Set(
      census.orderedEntries.flatMap((entry) =>
        entry.ownerKind === "package" &&
        entry.ownerRef !== nodePackage.packageRef
          ? [entry.ownerRef]
          : [],
      ),
    ),
  ].sort();
  return {
    status: "exact",
    census,
    physicalCensus,
    nonNodeSiblingPackageRefs,
  } as Extract<
    PlatformReleaseBootstrapRegistryActivationObservationInputV2["namespace"],
    { status: "exact" }
  >;
}

function targetEpochNamespace(
  names: readonly string[],
  stagedMemberKinds: readonly string[] = [],
  targetEpochState:
    | ReturnType<typeof laterFloor>
    | ReturnType<typeof laterNodeFloor>
    | null = null,
  epochClaim: ReturnType<
    typeof buildPlatformReleaseBootstrapRegistryEpochClaimV2
  > | null = null,
): ReturnType<typeof exactNamespace> {
  return exactNamespace(names, {
    objectIdentities: {
      [contract.registry.epochFloorBasename]: STAGED_EPOCH_TARGET_OBJECT,
    },
    directoryMembers: {
      [contract.registry.transactionStagingBasename]: stagedMemberKinds.map(
        (basename) => ({
          basename,
          objectKind: "ordinary_file" as const,
        }),
      ),
    },
    rawContentHashes: {
      ...(targetEpochState === null
        ? {}
        : {
            [contract.registry.epochFloorBasename]:
              hashPlatformReleaseBootstrapRegistryPublishedCanonicalJsonBytesV2(
                targetEpochState,
              ),
          }),
      ...(epochClaim === null
        ? {}
        : {
            [contract.registry.epochClaimBasename]:
              hashPlatformReleaseBootstrapRegistryPublishedCanonicalJsonBytesV2(
                epochClaim,
              ),
          }),
    },
  });
}

function physicalCaptureForBasename(
  namespace: ReturnType<typeof exactNamespace>,
  basename: string,
) {
  const capture = namespace.physicalCensus.orderedEntryCaptures.find(
    (entry) => entry.classification.basename === basename,
  );
  assert.ok(capture !== undefined);
  return capture;
}

function regularFilePhysicalEvidence(
  namespace: ReturnType<typeof exactNamespace>,
  basename: string,
) {
  const capture = physicalCaptureForBasename(namespace, basename);
  assert.equal(capture.contentEvidence.kind, "bounded_regular_file_bytes");
  return {
    physicalFingerprint: capture.fingerprint,
    rawContentHash: capture.contentEvidence.rawContentHash,
  };
}

function stagingDirectoryPhysicalEvidence(
  namespace: ReturnType<typeof exactNamespace>,
) {
  const capture = physicalCaptureForBasename(
    namespace,
    contract.registry.transactionStagingBasename,
  );
  assert.equal(capture.contentEvidence.kind, "directory_membership");
  return {
    stagingDirectoryFingerprint: capture.fingerprint,
    stagingDirectoryMembership: capture.contentEvidence.membership,
  };
}

function semanticRawContentOverrides(
  input: PlatformReleaseBootstrapRegistryActivationObservationInputV2,
): Record<string, string> {
  const overrides: Record<string, string> = {};
  if (input.activationClaim.status === "exact") {
    overrides[contract.registry.activationClaimBasename] =
      hashPlatformReleaseBootstrapRegistryPublishedCanonicalJsonBytesV2(
        input.activationClaim.claim,
      );
  }
  if (input.activationReceipt.status === "exact") {
    overrides[contract.registry.activationReceiptBasename] =
      hashPlatformReleaseBootstrapRegistryPublishedCanonicalJsonBytesV2(
        input.activationReceipt.receipt,
      );
  }
  if (input.epochFloor.status === "exact") {
    overrides[contract.registry.epochFloorBasename] =
      hashPlatformReleaseBootstrapRegistryPublishedCanonicalJsonBytesV2(
        input.epochFloor.state,
      );
  }
  if (input.epochClaim.status === "exact") {
    overrides[contract.registry.epochClaimBasename] =
      hashPlatformReleaseBootstrapRegistryPublishedCanonicalJsonBytesV2(
        input.epochClaim.claim,
      );
  }
  return overrides;
}

function refreshGlobalPhysicalEvidence(
  input: PlatformReleaseBootstrapRegistryActivationObservationInputV2,
  namespace: ReturnType<typeof exactNamespace>,
): PlatformReleaseBootstrapRegistryActivationObservationInputV2 {
  const refreshRegular = <T extends { status: string }>(
    observation: T,
    basename: string,
    includeIdentity = false,
  ): T => {
    if (observation.status !== "exact") return observation;
    const capture = physicalCaptureForBasename(namespace, basename);
    return {
      ...observation,
      ...(includeIdentity
        ? {
            physicalIdentityHash: capture.objectIdentity.objectIdentityHash,
          }
        : {}),
      ...regularFilePhysicalEvidence(namespace, basename),
    };
  };
  const transactionStaging =
    input.transactionStaging.status === "absent" ||
    input.transactionStaging.status === "invalid"
      ? input.transactionStaging
      : {
          ...input.transactionStaging,
          ...stagingDirectoryPhysicalEvidence(namespace),
        };
  return {
    ...input,
    namespace,
    legacyLock: refreshRegular(
      input.legacyLock,
      nodePackage.lifecycle.packageLockBasename,
    ),
    sharedLock: refreshRegular(
      input.sharedLock,
      contract.registry.sharedLockBasename,
    ),
    parentBoundary:
      input.parentBoundary.status === "exact"
        ? {
            ...input.parentBoundary,
            parentFingerprint: namespace.physicalCensus.parentFingerprint,
          }
        : input.parentBoundary,
    epochFloor: refreshRegular(
      input.epochFloor,
      contract.registry.epochFloorBasename,
    ),
    activationClaim: refreshRegular(
      input.activationClaim,
      contract.registry.activationClaimBasename,
      true,
    ),
    activationReceipt: refreshRegular(
      input.activationReceipt,
      contract.registry.activationReceiptBasename,
    ),
    epochClaim: refreshRegular(
      input.epochClaim,
      contract.registry.epochClaimBasename,
      true,
    ),
    transactionStaging,
  } as PlatformReleaseBootstrapRegistryActivationObservationInputV2;
}

function exactNamespacePreservingPhysicalState(
  input: PlatformReleaseBootstrapRegistryActivationObservationInputV2,
  names: readonly string[],
  rawOverrides: Readonly<Record<string, string>> = {},
  linkOverrides: Readonly<Record<string, number>> = {},
): ReturnType<typeof exactNamespace> {
  assert.equal(input.namespace.status, "exact");
  const objectIdentities: Record<string, StableFsObjectIdentityV2> = {};
  const linkCounts: Record<string, number> = {};
  const rawContentHashes: Record<string, string> = {};
  for (const capture of input.namespace.physicalCensus.orderedEntryCaptures) {
    objectIdentities[capture.classification.basename] = capture.objectIdentity;
    linkCounts[capture.classification.basename] = capture.fingerprint.linkCount;
    if (capture.contentEvidence.kind === "bounded_regular_file_bytes") {
      rawContentHashes[capture.classification.basename] =
        capture.contentEvidence.rawContentHash;
    }
  }
  const stage = input.transactionStaging;
  const currentMembers =
    stage.status === "exact"
      ? stage.orderedMembers
      : stage.status === "cleanup_partial"
        ? stage.remainingMembers
        : [];
  return exactNamespace(names, {
    objectIdentities,
    linkCounts: {
      ...linkCounts,
      ...linkOverrides,
    },
    directoryMembers: {
      [contract.registry.transactionStagingBasename]: currentMembers.map(
        (member) => ({
          basename: member.classification.basename,
          objectKind: member.classification.objectKind,
        }),
      ),
    },
    rawContentHashes: {
      ...rawContentHashes,
      ...rawOverrides,
    },
  });
}

function emptyNodeNames(): string[] {
  return [nodePackage.lifecycle.packageLockBasename];
}

function readyNodeNames(): string[] {
  return [
    nodePackage.rootBasename,
    nodePackage.lifecycle.activeReceiptBasename,
    nodePackage.lifecycle.activeClaimBasename,
    nodePackage.lifecycle.packageLockBasename,
  ];
}

function baseInput(
  names = emptyNodeNames(),
): PlatformReleaseBootstrapRegistryActivationObservationInputV2 {
  const namespace = exactNamespace(names);
  const nodeLogicalNamespaceProjection =
    projectPlatformReleaseBootstrapRegistryClaimedPackageLifecycleV2(
      namespace.census,
      nodePackage.packageRef,
    );
  return {
    filesystemScope: FILESYSTEM_SCOPE,
    legacyLock: {
      status: "exact",
      legacyNodeLockIdentityHash: LEGACY_LOCK_IDENTITY,
      ...regularFilePhysicalEvidence(
        namespace,
        nodePackage.lifecycle.packageLockBasename,
      ),
    },
    sharedLock: { status: "absent" },
    parentBoundary: {
      status: "exact",
      parentIdentityHash: PARENT_IDENTITY,
      parentFingerprint: namespace.physicalCensus.parentFingerprint,
    },
    nodeLifecycle: {
      status: "empty_or_rolled_back",
      observationAuthority:
        "logical_namespace_projection_only_never_node_semantic_authority_v2",
      productionAuthority: false,
      semanticSnapshotStatus:
        "unavailable_requires_captured_evidence_v2",
      nodeLifecycleIdentityHash:
        PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_NODE_LIFECYCLE_IDENTITY_HASH_V2,
      nodeLifecycleSnapshotHash: nodeLogicalNamespaceProjection.censusHash,
    },
    namespace,
    epochFloor: { status: "absent" },
    activationClaim: { status: "absent" },
    activationReceipt: { status: "absent" },
    epochClaim: { status: "absent" },
    transactionStaging: { status: "absent" },
  };
}

function withActivationClaim(
  input: PlatformReleaseBootstrapRegistryActivationObservationInputV2,
): PlatformReleaseBootstrapRegistryActivationObservationInputV2 {
  assert.equal(input.namespace.status, "exact");
  assert.ok(
    input.nodeLifecycle.status === "ready" ||
      input.nodeLifecycle.status === "empty_or_rolled_back",
  );
  const stagedActivationReceipt = expectedActivationReceipt();
  const orderedMembers = [
    stagingPhysicalMember(
      "staged_activation_receipt",
      stagedActivationReceipt.activationReceiptHash,
      STAGED_ACTIVATION_RECEIPT_OBJECT,
    ),
    stagingPhysicalMember(
      "staged_genesis_epoch_state",
      PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_GENESIS_EPOCH_FLOOR_STATE_V2.epochStateHash,
      STAGED_GENESIS_EPOCH_OBJECT,
    ),
    stagingPhysicalMember(
      "staged_shared_lock",
      contract.registry.sharedLockContentHash,
      STAGED_SHARED_LOCK_OBJECT,
    ),
  ];
  const stagingCensusHash =
    hashPlatformReleaseBootstrapRegistryActivationStagingInitialCensusV2(
      orderedMembers,
    );
  const claim = buildPlatformReleaseBootstrapRegistryActivationClaimV2({
    transactionIdentityHash: ACTIVATION_TRANSACTION_IDENTITY,
    sharedLockIdentityHash: SHARED_LOCK_IDENTITY,
    legacyNodeLockIdentityHash: LEGACY_LOCK_IDENTITY,
    nodeLifecycleIdentityHash:
      PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_NODE_LIFECYCLE_IDENTITY_HASH_V2,
    nodeLifecycleSnapshotHash: input.nodeLifecycle.nodeLifecycleSnapshotHash,
    parentIdentityHash: PARENT_IDENTITY,
    preActivationNamespaceCaptureHash:
      input.namespace.physicalCensus.physicalCensusHash,
    transactionStagingIdentityHash: ACTIVATION_STAGING_DIRECTORY_IDENTITY,
    transactionStagingCensusHash: stagingCensusHash,
  });
  const namespace = exactNamespace(
    [
      ...input.namespace.census.orderedEntries.map((entry) => entry.basename),
      contract.registry.activationClaimBasename,
      contract.registry.transactionStagingBasename,
    ],
    {
      rawContentHashes: {
        [contract.registry.activationClaimBasename]:
          hashPlatformReleaseBootstrapRegistryPublishedCanonicalJsonBytesV2(
            claim,
          ),
      },
      directoryMembers: {
        [contract.registry.transactionStagingBasename]: orderedMembers.map(
          (member) => ({
            basename: member.classification.basename,
            objectKind: member.classification.objectKind,
          }),
        ),
      },
    },
  );
  const stageDirectoryEvidence = stagingDirectoryPhysicalEvidence(namespace);
  return {
    ...input,
    namespace,
    activationClaim: {
      status: "exact",
      claim,
      physicalIdentityHash: physicalCaptureForBasename(
        namespace,
        contract.registry.activationClaimBasename,
      ).objectIdentity.objectIdentityHash,
      ...regularFilePhysicalEvidence(
        namespace,
        contract.registry.activationClaimBasename,
      ),
    },
    transactionStaging: {
      status: "exact",
      transactionKind: "activation",
      transactionIdentityHash: ACTIVATION_TRANSACTION_IDENTITY,
      stagingDirectoryIdentityHash: ACTIVATION_STAGING_DIRECTORY_IDENTITY,
      ...stageDirectoryEvidence,
      stagingCensusHash,
      preActivationNamespaceCaptureHash:
        input.namespace.physicalCensus.physicalCensusHash,
      stagedSharedLockContentHash: contract.registry.sharedLockContentHash,
      stagedSharedLock: orderedMembers[2]!,
      stagedGenesisEpochStateHash:
        PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_GENESIS_EPOCH_FLOOR_STATE_V2.epochStateHash,
      stagedGenesisEpochState: orderedMembers[1]!,
      stagedActivationReceiptHash: claim.expectedActivationReceiptHash,
      stagedActivationReceipt: orderedMembers[0]!,
      orderedMembers,
    },
  };
}

function withSharedLock(
  input: PlatformReleaseBootstrapRegistryActivationObservationInputV2,
): PlatformReleaseBootstrapRegistryActivationObservationInputV2 {
  const names =
    input.namespace.status === "exact"
      ? input.namespace.census.orderedEntries.map((entry) => entry.basename)
      : emptyNodeNames();
  const activationStage =
    input.transactionStaging.status === "exact" &&
    input.transactionStaging.transactionKind === "activation"
      ? input.transactionStaging
      : null;
  const stagedSharedLock =
    activationStage === null
      ? null
      : withStagingMemberLinkCount(activationStage.stagedSharedLock, 2);
  const transactionStaging =
    activationStage === null
      ? input.transactionStaging
      : {
          ...activationStage,
          stagedSharedLock: stagedSharedLock!,
          orderedMembers: activationStage.orderedMembers.map((member) =>
            member.memberKind === "staged_shared_lock"
              ? stagedSharedLock!
              : member,
          ),
        };
  const namespace = exactNamespace(
    [...names, contract.registry.sharedLockBasename],
    {
      rawContentHashes: semanticRawContentOverrides(input),
      linkCounts: {
        [contract.registry.sharedLockBasename]:
          activationStage === null ? 1 : 2,
      },
      directoryMembers:
        activationStage === null
          ? undefined
          : {
              [contract.registry.transactionStagingBasename]:
                transactionStaging.status === "exact" &&
                transactionStaging.transactionKind === "activation"
                  ? transactionStaging.orderedMembers.map((member) => ({
                      basename: member.classification.basename,
                      objectKind: member.classification.objectKind,
                    }))
                  : [],
            },
    },
  );
  return refreshGlobalPhysicalEvidence(
    {
      ...input,
      sharedLock: {
        status: "exact",
        sharedLockIdentityHash: SHARED_LOCK_IDENTITY,
        ...regularFilePhysicalEvidence(
          namespace,
          contract.registry.sharedLockBasename,
        ),
      },
      namespace,
      transactionStaging,
    },
    namespace,
  );
}

function withGenesis(
  input: PlatformReleaseBootstrapRegistryActivationObservationInputV2,
): PlatformReleaseBootstrapRegistryActivationObservationInputV2 {
  assert.equal(input.namespace.status, "exact");
  const activationStage =
    input.transactionStaging.status === "exact" &&
    input.transactionStaging.transactionKind === "activation"
      ? input.transactionStaging
      : null;
  const stagedGenesis =
    activationStage === null
      ? null
      : withStagingMemberLinkCount(activationStage.stagedGenesisEpochState, 2);
  const transactionStaging =
    activationStage === null
      ? input.transactionStaging
      : {
          ...activationStage,
          stagedGenesisEpochState: stagedGenesis!,
          orderedMembers: activationStage.orderedMembers.map((member) =>
            member.memberKind === "staged_genesis_epoch_state"
              ? stagedGenesis!
              : member,
          ),
        };
  const namespace = exactNamespace(
    [
      ...input.namespace.census.orderedEntries.map((entry) => entry.basename),
      contract.registry.epochFloorBasename,
    ],
    {
      rawContentHashes: {
        ...semanticRawContentOverrides(input),
        [contract.registry.epochFloorBasename]:
          hashPlatformReleaseBootstrapRegistryPublishedCanonicalJsonBytesV2(
            PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_GENESIS_EPOCH_FLOOR_STATE_V2,
          ),
      },
      linkCounts: {
        [contract.registry.sharedLockBasename]:
          activationStage === null ? 1 : 2,
        [contract.registry.epochFloorBasename]:
          activationStage === null ? 1 : 2,
      },
      directoryMembers:
        activationStage === null
          ? undefined
          : {
              [contract.registry.transactionStagingBasename]:
                transactionStaging.status === "exact" &&
                transactionStaging.transactionKind === "activation"
                  ? transactionStaging.orderedMembers.map((member) => ({
                      basename: member.classification.basename,
                      objectKind: member.classification.objectKind,
                    }))
                  : [],
            },
    },
  );
  return refreshGlobalPhysicalEvidence(
    {
      ...input,
      namespace,
      epochFloor: {
        status: "exact",
        state: PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_GENESIS_EPOCH_FLOOR_STATE_V2,
        physicalIdentityHash: GENESIS_EPOCH_FLOOR_PHYSICAL_IDENTITY,
        ...regularFilePhysicalEvidence(
          namespace,
          contract.registry.epochFloorBasename,
        ),
      },
      transactionStaging,
    },
    namespace,
  );
}

function expectedActivationReceipt() {
  return buildPlatformReleaseBootstrapRegistryActivationReceiptV2({
    sharedLockIdentityHash: SHARED_LOCK_IDENTITY,
    legacyNodeLockIdentityHash: LEGACY_LOCK_IDENTITY,
    nodeLifecycleIdentityHash:
      PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_NODE_LIFECYCLE_IDENTITY_HASH_V2,
    parentIdentityHash: PARENT_IDENTITY,
  });
}

function withActivation(
  input: PlatformReleaseBootstrapRegistryActivationObservationInputV2,
): PlatformReleaseBootstrapRegistryActivationObservationInputV2 {
  assert.equal(input.namespace.status, "exact");
  const activationStage =
    input.transactionStaging.status === "exact" &&
    input.transactionStaging.transactionKind === "activation"
      ? input.transactionStaging
      : null;
  const stagedReceipt =
    activationStage === null
      ? null
      : withStagingMemberLinkCount(activationStage.stagedActivationReceipt, 2);
  const transactionStaging =
    activationStage === null
      ? input.transactionStaging
      : {
          ...activationStage,
          stagedActivationReceipt: stagedReceipt!,
          orderedMembers: activationStage.orderedMembers.map((member) =>
            member.memberKind === "staged_activation_receipt"
              ? stagedReceipt!
              : member,
          ),
        };
  const receipt = expectedActivationReceipt();
  const namespace = exactNamespace(
    [
      ...input.namespace.census.orderedEntries.map((entry) => entry.basename),
      contract.registry.activationReceiptBasename,
    ],
    {
      rawContentHashes: {
        ...semanticRawContentOverrides(input),
        [contract.registry.activationReceiptBasename]:
          hashPlatformReleaseBootstrapRegistryPublishedCanonicalJsonBytesV2(
            receipt,
          ),
      },
      linkCounts: {
        [contract.registry.sharedLockBasename]:
          activationStage === null ? 1 : 2,
        [contract.registry.epochFloorBasename]:
          activationStage === null ? 1 : 2,
        [contract.registry.activationReceiptBasename]:
          activationStage === null ? 1 : 2,
      },
      directoryMembers:
        activationStage === null
          ? undefined
          : {
              [contract.registry.transactionStagingBasename]:
                transactionStaging.status === "exact" &&
                transactionStaging.transactionKind === "activation"
                  ? transactionStaging.orderedMembers.map((member) => ({
                      basename: member.classification.basename,
                      objectKind: member.classification.objectKind,
                    }))
                  : [],
            },
    },
  );
  return refreshGlobalPhysicalEvidence(
    {
      ...input,
      namespace,
      activationReceipt: {
        status: "exact",
        receipt,
        physicalIdentityHash: ACTIVATION_RECEIPT_PHYSICAL_IDENTITY,
        ...regularFilePhysicalEvidence(
          namespace,
          contract.registry.activationReceiptBasename,
        ),
      },
      transactionStaging,
    },
    namespace,
  );
}

function withActivationCleanupPartial(
  input: PlatformReleaseBootstrapRegistryActivationObservationInputV2,
  remainingMemberCount: 0 | 1 | 2,
): PlatformReleaseBootstrapRegistryActivationObservationInputV2 {
  assert.ok(
    input.transactionStaging.status === "exact" &&
      input.transactionStaging.transactionKind === "activation",
  );
  const stage = input.transactionStaging;
  const allMembers = stage.orderedMembers;
  const remainingMembers = allMembers.slice(
    allMembers.length - remainingMemberCount,
  );
  assert.equal(input.namespace.status, "exact");
  const remainingKinds = new Set(
    remainingMembers.map((member) => member.memberKind),
  );
  const namespace = exactNamespace(
    input.namespace.census.orderedEntries.map((entry) => entry.basename),
    {
      rawContentHashes: semanticRawContentOverrides(input),
      linkCounts: {
        [contract.registry.activationReceiptBasename]: remainingKinds.has(
          "staged_activation_receipt",
        )
          ? 2
          : 1,
        [contract.registry.epochFloorBasename]: remainingKinds.has(
          "staged_genesis_epoch_state",
        )
          ? 2
          : 1,
        [contract.registry.sharedLockBasename]: remainingKinds.has(
          "staged_shared_lock",
        )
          ? 2
          : 1,
      },
      directoryMembers: {
        [contract.registry.transactionStagingBasename]: remainingMembers.map(
          (member) => ({
            basename: member.classification.basename,
            objectKind: member.classification.objectKind,
          }),
        ),
      },
    },
  );
  return refreshGlobalPhysicalEvidence(
    {
      ...input,
      namespace,
      transactionStaging: {
        status: "cleanup_partial",
        transactionKind: "activation",
        transactionIdentityHash: stage.transactionIdentityHash,
        stagingDirectoryIdentityHash: stage.stagingDirectoryIdentityHash,
        ...stagingDirectoryPhysicalEvidence(namespace),
        initialStagingCensusHash: stage.stagingCensusHash,
        currentRemainingCensusHash:
          hashPlatformReleaseBootstrapRegistryActivationCleanupRemainingCensusV2(
            remainingMembers,
          ),
        preActivationNamespaceCaptureHash:
          stage.preActivationNamespaceCaptureHash,
        stagedSharedLockContentHash: stage.stagedSharedLockContentHash,
        stagedSharedLock: stage.stagedSharedLock,
        stagedGenesisEpochStateHash: stage.stagedGenesisEpochStateHash,
        stagedGenesisEpochState: stage.stagedGenesisEpochState,
        stagedActivationReceiptHash: stage.stagedActivationReceiptHash,
        stagedActivationReceipt: stage.stagedActivationReceipt,
        remainingMembers,
      },
    },
    namespace,
  );
}

function withoutTransactionStaging(
  input: PlatformReleaseBootstrapRegistryActivationObservationInputV2,
): PlatformReleaseBootstrapRegistryActivationObservationInputV2 {
  assert.equal(input.namespace.status, "exact");
  const namespace = exactNamespace(
    input.namespace.census.orderedEntries
      .filter((entry) => entry.category !== "transaction_staging")
      .map((entry) => entry.basename),
    {
      rawContentHashes: semanticRawContentOverrides(input),
    },
  );
  return refreshGlobalPhysicalEvidence(
    {
      ...input,
      namespace,
      transactionStaging: { status: "absent" },
    },
    namespace,
  );
}

function withoutActivationClaim(
  input: PlatformReleaseBootstrapRegistryActivationObservationInputV2,
): PlatformReleaseBootstrapRegistryActivationObservationInputV2 {
  assert.equal(input.namespace.status, "exact");
  return {
    ...input,
    namespace: exactNamespacePreservingPhysicalState(
      input,
      input.namespace.census.orderedEntries
        .filter((entry) => entry.category !== "activation_claim")
        .map((entry) => entry.basename),
    ),
    activationClaim: { status: "absent" },
  };
}

function fullyActivated(
  input = baseInput(),
): PlatformReleaseBootstrapRegistryActivationObservationInputV2 {
  return withoutActivationClaim(
    withoutTransactionStaging(
      withActivation(withGenesis(withSharedLock(withActivationClaim(input)))),
    ),
  );
}

function plan(
  input: PlatformReleaseBootstrapRegistryActivationObservationInputV2,
) {
  return buildPlatformReleaseBootstrapRegistryActivationPlanV2(
    buildPlatformReleaseBootstrapRegistryActivationObservationV2(input),
  );
}

type PhysicalActivationSessionScriptV2 = Readonly<{
  observations: readonly PlatformReleaseBootstrapRegistryActivationObservationInputV2[];
  slotLedgerToken?: PlatformReleaseBootstrapRegistryPhysicalActivationLockedSlotLedgerTokenV2;
  actionError?: unknown;
}>;

function scriptedPhysicalActivationDriverV2(
  scripts: readonly PhysicalActivationSessionScriptV2[],
  trace: string[],
  options: Readonly<{
    reuseFirstSession?: boolean;
    actionSlotLedgerTokens?: PlatformReleaseBootstrapRegistryPhysicalActivationLockedSlotLedgerTokenV2[];
  }> = {},
): PlatformReleaseBootstrapRegistryPhysicalActivationMechanicsDriverV2 {
  const physicalContract =
    PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_CONTRACT_V2;
  const sessions = scripts.map((script, scriptIndex) => {
    const sessionLabel = `session${scriptIndex + 1}`;
    const observations = script.observations.map((observation) =>
      buildPlatformReleaseBootstrapRegistryActivationObservationV2(observation),
    );
    const sessionOccurrenceHash = createHash("sha256")
      .update(
        `setfarm.test.physical-activation-session.v2\0${scriptIndex}`,
        "utf8",
      )
      .digest("hex");
    const slotLedgerToken =
      script.slotLedgerToken ??
      Object.freeze({
        mechanicsScope:
          PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_MECHANICS_SCOPE_V2,
      });
    const recordAction = (
      method: string,
      handle: PlatformReleaseBootstrapRegistryPhysicalActivationPlanHandleV2,
      receivedSlotLedgerToken: PlatformReleaseBootstrapRegistryPhysicalActivationLockedSlotLedgerTokenV2,
    ): void => {
      assert.strictEqual(receivedSlotLedgerToken, slotLedgerToken);
      options.actionSlotLedgerTokens?.push(receivedSlotLedgerToken);
      trace.push(
        `${sessionLabel}.action:${method}:${handle.nextAction}:${handle.round}`,
      );
      if (script.actionError !== undefined) {
        throw script.actionError;
      }
    };
    const session: PlatformReleaseBootstrapRegistryPhysicalActivationSessionV2 =
      {
        mechanicsScope:
          PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_MECHANICS_SCOPE_V2,
        contractHash: physicalContract.contractHash,
        backendAbiHash: physicalContract.backendAbiHash,
        sessionOccurrenceHash,
        async observePhysicalActivationState() {
          trace.push(`${sessionLabel}.observe:1`);
          const observation = observations[0];
          assert.ok(
            observation,
            `${sessionLabel} missing scripted probe observation`,
          );
          return observation;
        },
        async reobserveLockedPhysicalActivationState() {
          trace.push(`${sessionLabel}.observe:2`);
          const observation = observations[1];
          assert.ok(
            observation,
            `${sessionLabel} missing scripted locked observation`,
          );
          return {
            observation,
            slotLedgerToken,
            slotLedgerBindingHash:
              hashPlatformReleaseBootstrapRegistryPhysicalActivationLockedSlotLedgerBindingV2(
                sessionOccurrenceHash,
                observation,
              ),
          };
        },
        async acquireLegacyNodeLock() {
          trace.push(`${sessionLabel}.lock:legacy`);
        },
        async acquireSharedParentLock() {
          trace.push(`${sessionLabel}.lock:shared`);
        },
        async acquireRegisteredPackageLock() {
          trace.push(`${sessionLabel}.lock:package`);
        },
        async revalidateFixedSession() {
          trace.push(`${sessionLabel}.revalidate`);
        },
        async assertPhysicalActivationOperationReserve() {
          trace.push(`${sessionLabel}.reserve`);
        },
        async cleanupActivationStaging(handle, receivedSlotLedgerToken) {
          recordAction(
            "cleanupActivationStaging",
            handle,
            receivedSlotLedgerToken,
          );
        },
        async cleanupOrphanedActivationStaging(
          handle,
          receivedSlotLedgerToken,
        ) {
          recordAction(
            "cleanupOrphanedActivationStaging",
            handle,
            receivedSlotLedgerToken,
          );
        },
        async cleanupOrphanedEpochStaging(handle, receivedSlotLedgerToken) {
          recordAction(
            "cleanupOrphanedEpochStaging",
            handle,
            receivedSlotLedgerToken,
          );
        },
        async prepareAndPublishActivationClaim(
          handle,
          receivedSlotLedgerToken,
        ) {
          recordAction(
            "prepareAndPublishActivationClaim",
            handle,
            receivedSlotLedgerToken,
          );
        },
        async publishAndAcquireSharedLock(handle, receivedSlotLedgerToken) {
          recordAction(
            "publishAndAcquireSharedLock",
            handle,
            receivedSlotLedgerToken,
          );
        },
        async publishGenesisEpochFloor(handle, receivedSlotLedgerToken) {
          recordAction(
            "publishGenesisEpochFloor",
            handle,
            receivedSlotLedgerToken,
          );
        },
        async publishActivationReceipt(handle, receivedSlotLedgerToken) {
          recordAction(
            "publishActivationReceipt",
            handle,
            receivedSlotLedgerToken,
          );
        },
        async recoverEpochClaim(handle, receivedSlotLedgerToken) {
          recordAction("recoverEpochClaim", handle, receivedSlotLedgerToken);
        },
        async removeActivationClaim(handle, receivedSlotLedgerToken) {
          recordAction(
            "removeActivationClaim",
            handle,
            receivedSlotLedgerToken,
          );
        },
        async resumeActivationStagingCleanup(handle, receivedSlotLedgerToken) {
          recordAction(
            "resumeActivationStagingCleanup",
            handle,
            receivedSlotLedgerToken,
          );
        },
        async returnActivated(handle, receivedSlotLedgerToken) {
          recordAction("returnActivated", handle, receivedSlotLedgerToken);
        },
        async closeWithoutMutation(handle, receivedSlotLedgerToken) {
          recordAction("closeWithoutMutation", handle, receivedSlotLedgerToken);
        },
        async closeOrAbortSession(disposition) {
          trace.push(`${sessionLabel}.settle:${disposition}`);
        },
      };
    return session;
  });
  let openIndex = 0;
  return {
    mechanicsScope:
      PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_MECHANICS_SCOPE_V2,
    contractHash: physicalContract.contractHash,
    backendAbiHash: physicalContract.backendAbiHash,
    async openFreshSession() {
      const requestedIndex = openIndex;
      openIndex += 1;
      if (options.reuseFirstSession === true && requestedIndex > 0) {
        trace.push(`driver.open:${requestedIndex + 1}->session1`);
        assert.ok(sessions[0], "missing reused scripted session");
        return sessions[0];
      }
      const session = sessions[requestedIndex];
      trace.push(`driver.open:${requestedIndex + 1}`);
      assert.ok(session, "physical activation opened beyond its script");
      return session;
    },
  };
}

function laterFloor() {
  const packageEpochArtifactMap = mutableClone(
    PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_GENESIS_EPOCH_FLOOR_STATE_V2.packageEpochArtifactMap,
  );
  packageEpochArtifactMap[
    PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.hostVerifier
  ] = {
    distributionEpoch: 1,
    artifactHash: hash("a"),
  };
  return buildPlatformReleaseBootstrapRegistryEpochFloorStateV2({
    generation: 1,
    priorEpochStateHash:
      PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_GENESIS_EPOCH_FLOOR_STATE_V2.epochStateHash,
    transactionIdentityHash: hash("b"),
    packageEpochArtifactMap,
  });
}

function laterNodeFloor() {
  const packageEpochArtifactMap = mutableClone(
    PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_GENESIS_EPOCH_FLOOR_STATE_V2.packageEpochArtifactMap,
  );
  packageEpochArtifactMap[
    PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.nodeToolchainProvisioner
  ] = {
    distributionEpoch: 1,
    artifactHash: hash("a"),
  };
  return buildPlatformReleaseBootstrapRegistryEpochFloorStateV2({
    generation: 1,
    priorEpochStateHash:
      PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_GENESIS_EPOCH_FLOOR_STATE_V2.epochStateHash,
    transactionIdentityHash: hash("b"),
    packageEpochArtifactMap,
  });
}

function epochStageBinding(
  targetEpochState:
    ReturnType<typeof laterFloor> | ReturnType<typeof laterNodeFloor>,
) {
  const orderedMembers = [
    {
      memberKind: "staged_target_epoch_state",
      logicalIdentityHash: targetEpochState.epochStateHash,
      physicalIdentityHash: EPOCH_TARGET_PHYSICAL_IDENTITY,
    },
  ] as const;
  return {
    transactionStagingIdentityHash: EPOCH_STAGING_DIRECTORY_IDENTITY,
    transactionStagingCensusHash:
      hashPlatformReleaseBootstrapRegistryEpochStagingInitialCensusV2(
        orderedMembers,
      ),
    stagedTargetEpochStatePhysicalIdentityHash: EPOCH_TARGET_PHYSICAL_IDENTITY,
  };
}

function exactEpochStageObservation(
  claim: ReturnType<typeof buildPlatformReleaseBootstrapRegistryEpochClaimV2>,
) {
  const binding = epochStageBinding(claim.targetEpochState);
  const stagedTargetEpochMember = stagingPhysicalMember(
    "staged_target_epoch_state",
    claim.targetEpochState.epochStateHash,
    STAGED_EPOCH_TARGET_OBJECT,
    hashPlatformReleaseBootstrapRegistryPublishedCanonicalJsonBytesV2(
      claim.targetEpochState,
    ),
  );
  const orderedMembers = [stagedTargetEpochMember];
  return {
    status: "exact",
    transactionKind: "epoch_floor",
    transactionIdentityHash: claim.transactionIdentityHash,
    stagingDirectoryIdentityHash: binding.transactionStagingIdentityHash,
    ...stagingDirectoryEvidenceForMembers(orderedMembers),
    stagingCensusHash: binding.transactionStagingCensusHash,
    stagedTargetEpochState: claim.targetEpochState,
    stagedTargetEpochMember,
    orderedMembers,
  };
}

function consumedEpochStageObservation(
  claim: ReturnType<typeof buildPlatformReleaseBootstrapRegistryEpochClaimV2>,
) {
  const stagedTargetEpochMember = stagingPhysicalMember(
    "staged_target_epoch_state",
    claim.targetEpochState.epochStateHash,
    STAGED_EPOCH_TARGET_OBJECT,
    hashPlatformReleaseBootstrapRegistryPublishedCanonicalJsonBytesV2(
      claim.targetEpochState,
    ),
  );
  return {
    status: "epoch_target_consumed",
    transactionKind: "epoch_floor",
    transactionIdentityHash: claim.transactionIdentityHash,
    stagingDirectoryIdentityHash: claim.transactionStagingIdentityHash,
    ...stagingDirectoryEvidenceForMembers([]),
    initialStagingCensusHash: claim.transactionStagingCensusHash,
    currentRemainingCensusHash:
      hashPlatformReleaseBootstrapRegistryEpochStagingCurrentCensusV2([]),
    stagedTargetEpochState: claim.targetEpochState,
    stagedTargetEpochMember,
    remainingMembers: [],
  };
}

function exactEpochClaimObservation(
  claim: ReturnType<typeof buildPlatformReleaseBootstrapRegistryEpochClaimV2>,
  namespace: Extract<
    PlatformReleaseBootstrapRegistryActivationObservationInputV2["namespace"],
    { status: "exact" }
  >,
) {
  const packageLifecycleProjection = buildPackageLifecyclePhysicalProjectionV2(
    namespace.physicalCensus,
    claim.packageRef,
  );
  return {
    status: "exact",
    claim,
    physicalIdentityHash: physicalCaptureForBasename(
      namespace,
      contract.registry.epochClaimBasename,
    ).objectIdentity.objectIdentityHash,
    packageRef: claim.packageRef,
    packageLifecycleProjection,
    observedInstallationGeneration: claim.packageInstallationGeneration,
    ...regularFilePhysicalEvidence(
      namespace,
      contract.registry.epochClaimBasename,
    ),
  } as const;
}

function exactEpochFloorObservation(
  state:
    | typeof PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_GENESIS_EPOCH_FLOOR_STATE_V2
    | ReturnType<typeof laterFloor>
    | ReturnType<typeof laterNodeFloor>,
  namespace: ReturnType<typeof exactNamespace>,
) {
  return {
    status: "exact",
    state,
    physicalIdentityHash: physicalCaptureForBasename(
      namespace,
      contract.registry.epochFloorBasename,
    ).objectIdentity.objectIdentityHash,
    ...regularFilePhysicalEvidence(
      namespace,
      contract.registry.epochFloorBasename,
    ),
  } as const;
}

describe("platform release bootstrap registry activation v2", () => {
  it("reduces the exact crash-resumable activation sequence and lock orders", () => {
    const legacy = baseInput();
    const legacyPlan = plan(legacy);
    assert.equal(legacyPlan.state, "LEGACY_ONLY");
    assert.equal(legacyPlan.nextAction, "prepare_and_publish_activation_claim");
    assert.deepEqual(legacyPlan.requiredLockOrder, [
      "legacy_node_package_lock",
    ]);
    assert.equal(legacyPlan.expectedActivationReceipt, null);

    const claimed = withActivationClaim(legacy);
    const claimedPlan = plan(claimed);
    assert.equal(claimedPlan.state, "ACTIVATION_CLAIMED");
    assert.equal(claimedPlan.nextAction, "publish_and_acquire_shared_lock");
    assert.deepEqual(
      claimedPlan.expectedActivationClaim,
      claimed.activationClaim.status === "exact"
        ? claimed.activationClaim.claim
        : null,
    );

    const shared = withSharedLock(claimed);
    const sharedPlan = plan(shared);
    assert.equal(sharedPlan.state, "SHARED_LOCK_PUBLISHED");
    assert.equal(sharedPlan.nextAction, "publish_genesis_epoch_floor");
    assert.deepEqual(
      sharedPlan.expectedActivationReceipt,
      expectedActivationReceipt(),
    );

    const genesis = withGenesis(shared);
    const genesisPlan = plan(genesis);
    assert.equal(genesisPlan.state, "GENESIS_PUBLISHED");
    assert.equal(genesisPlan.nextAction, "publish_activation_receipt");
    assert.deepEqual(
      genesisPlan.genesisEpochFloorState,
      PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_GENESIS_EPOCH_FLOOR_STATE_V2,
    );

    const activated = withActivation(genesis);
    const activatedPlan = plan(activated);
    assert.equal(activatedPlan.state, "ACTIVATION_CLEANUP_REQUIRED");
    assert.equal(activatedPlan.nextAction, "cleanup_activation_staging");
    assert.deepEqual(activatedPlan.requiredLockOrder, [
      "shared_parent_lock",
      "legacy_node_package_lock",
    ]);

    for (const remainingMemberCount of [2, 1, 0] as const) {
      const partial = withActivationCleanupPartial(
        activated,
        remainingMemberCount,
      );
      const partialPlan = plan(partial);
      assert.equal(partialPlan.state, "ACTIVATION_CLEANUP_REQUIRED");
      assert.equal(partialPlan.nextAction, "resume_activation_staging_cleanup");
      assert.deepEqual(partialPlan.requiredLockOrder, [
        "shared_parent_lock",
        "legacy_node_package_lock",
      ]);
      assert.deepEqual(
        plan(partial),
        partialPlan,
        "cleanup retry must reduce identically",
      );
    }

    const receiptWithoutStage = withoutTransactionStaging(activated);
    const receiptWithoutStagePlan = plan(receiptWithoutStage);
    assert.equal(receiptWithoutStagePlan.state, "ACTIVATION_CLEANUP_REQUIRED");
    assert.equal(receiptWithoutStagePlan.nextAction, "remove_activation_claim");
    assert.deepEqual(receiptWithoutStagePlan.requiredLockOrder, [
      "shared_parent_lock",
      "legacy_node_package_lock",
    ]);

    const cleanActivated = withoutActivationClaim(receiptWithoutStage);
    const cleanActivatedPlan = plan(cleanActivated);
    assert.equal(cleanActivatedPlan.state, "ACTIVATED");
    assert.equal(cleanActivatedPlan.nextAction, "return_activated");
    assert.equal(cleanActivatedPlan.epochClaimDisposition, "absent");
    assert.deepEqual(cleanActivatedPlan.requiredLockOrder, [
      "shared_parent_lock",
      "package_lock",
    ]);
    assert.ok(Object.isFrozen(cleanActivatedPlan));
    assert.ok(Object.isFrozen(cleanActivatedPlan.observation));
    assert.ok(Object.isFrozen(cleanActivatedPlan.requiredLockOrder));
    assert.equal(
      cleanActivatedPlan.planHash,
      hashPlatformReleaseBootstrapRegistryActivationPlanV2(cleanActivatedPlan),
    );
  });

  it("types orphan cleanup and rejects claimless or mismatched activation staging", () => {
    const orphanBase = baseInput([
      ...emptyNodeNames(),
      contract.registry.transactionStagingBasename,
    ]);
    assert.equal(orphanBase.namespace.status, "exact");
    const orphanMembers: ReturnType<typeof stagingPhysicalMember>[] = [];
    orphanBase.transactionStaging = {
      status: "orphan",
      transactionKind: "activation",
      stagingDirectoryIdentityHash: ACTIVATION_STAGING_DIRECTORY_IDENTITY,
      ...stagingDirectoryPhysicalEvidence(orphanBase.namespace),
      stagingCensusHash:
        hashPlatformReleaseBootstrapRegistryOrphanStagingCensusV2(
          "activation",
          orphanMembers,
        ),
      orderedMembers: orphanMembers,
    };
    const orphanPlan = plan(orphanBase);
    assert.equal(orphanPlan.state, "ACTIVATION_STAGING_ORPHANED");
    assert.equal(orphanPlan.nextAction, "cleanup_orphaned_activation_staging");
    assert.deepEqual(orphanPlan.requiredLockOrder, [
      "legacy_node_package_lock",
    ]);

    const claimed = withActivationClaim(baseInput());
    const claimless = withoutActivationClaim(claimed);
    assert.deepEqual(plan(claimless).corruptionReasons, [
      "activation_staging_missing_claim",
    ]);

    const claimlessShared = withoutActivationClaim(withSharedLock(claimed));
    assert.deepEqual(plan(claimlessShared).corruptionReasons, [
      "activation_claim_required_for_resume",
      "activation_staging_missing_claim",
    ]);

    const mismatched = mutableClone(claimed);
    assert.ok(
      claimed.transactionStaging.status === "exact" &&
        claimed.transactionStaging.transactionKind === "activation",
    );
    mismatched.activationClaim = {
      ...claimed.activationClaim,
      claim: buildPlatformReleaseBootstrapRegistryActivationClaimV2({
        transactionIdentityHash: hash("0"),
        sharedLockIdentityHash: SHARED_LOCK_IDENTITY,
        legacyNodeLockIdentityHash: LEGACY_LOCK_IDENTITY,
        nodeLifecycleIdentityHash:
          PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_NODE_LIFECYCLE_IDENTITY_HASH_V2,
        nodeLifecycleSnapshotHash:
          claimed.nodeLifecycle.status === "ready" ||
          claimed.nodeLifecycle.status === "empty_or_rolled_back"
            ? claimed.nodeLifecycle.nodeLifecycleSnapshotHash
            : hash("f"),
        parentIdentityHash: PARENT_IDENTITY,
        preActivationNamespaceCaptureHash:
          claimed.transactionStaging.preActivationNamespaceCaptureHash,
        transactionStagingIdentityHash: ACTIVATION_STAGING_DIRECTORY_IDENTITY,
        transactionStagingCensusHash:
          claimed.transactionStaging.stagingCensusHash,
      }),
    };
    assert.deepEqual(plan(mismatched).corruptionReasons, [
      "activation_claim_identity_mismatch",
      "physical_namespace_relation_mismatch",
    ]);

    const stagedPayloadMismatch = mutableClone(claimed);
    assert.ok(
      stagedPayloadMismatch.transactionStaging.status === "exact" &&
        stagedPayloadMismatch.transactionStaging.transactionKind ===
          "activation",
    );
    stagedPayloadMismatch.transactionStaging.stagedGenesisEpochStateHash =
      hash("f");
    stagedPayloadMismatch.transactionStaging.orderedMembers[1].logicalIdentityHash =
      hash("f");
    stagedPayloadMismatch.transactionStaging.stagingCensusHash =
      hashPlatformReleaseBootstrapRegistryActivationStagingInitialCensusV2(
        stagedPayloadMismatch.transactionStaging.orderedMembers,
      );
    assert.deepEqual(plan(stagedPayloadMismatch).corruptionReasons, [
      "activation_claim_identity_mismatch",
      "activation_staged_payload_mismatch",
    ]);

    const nodeSnapshotDrift = mutableClone(claimed);
    assert.ok(
      nodeSnapshotDrift.nodeLifecycle.status === "ready" ||
        nodeSnapshotDrift.nodeLifecycle.status === "empty_or_rolled_back",
    );
    nodeSnapshotDrift.nodeLifecycle.nodeLifecycleSnapshotHash = hash("f");
    assert.deepEqual(plan(nodeSnapshotDrift).corruptionReasons, [
      "activation_claim_identity_mismatch",
    ]);

    const aliasedStageEvidence = mutableClone(claimed);
    assert.equal(aliasedStageEvidence.transactionStaging.status, "exact");
    aliasedStageEvidence.transactionStaging.stagingCensusHash =
      aliasedStageEvidence.transactionStaging.stagingDirectoryIdentityHash;
    assert.throws(() => plan(aliasedStageEvidence));

    assert.equal(claimed.namespace.status, "exact");
    assert.ok(
      claimed.transactionStaging.status === "exact" &&
        claimed.transactionStaging.transactionKind === "activation",
    );
    assert.equal(claimed.activationClaim.status, "exact");
    const legacyPackageLockCapture =
      claimed.namespace.physicalCensus.orderedEntryCaptures.find(
        (capture) =>
          capture.classification.category === "package_lock" &&
          capture.classification.ownerRef === nodePackage.packageRef,
      );
    assert.ok(legacyPackageLockCapture !== undefined);
    const stagedReceiptAliasedToLegacyPackageLock = stagingPhysicalMember(
      "staged_activation_receipt",
      claimed.transactionStaging.stagedActivationReceiptHash,
      legacyPackageLockCapture.objectIdentity,
    );
    const aliasedReceiptMembers = claimed.transactionStaging.orderedMembers.map(
      (member) =>
        member.memberKind === "staged_activation_receipt"
          ? stagedReceiptAliasedToLegacyPackageLock
          : member,
    );
    const aliasedReceiptStagingCensusHash =
      hashPlatformReleaseBootstrapRegistryActivationStagingInitialCensusV2(
        aliasedReceiptMembers,
      );
    const aliasedReceiptClaim =
      buildPlatformReleaseBootstrapRegistryActivationClaimV2({
        transactionIdentityHash:
          claimed.transactionStaging.transactionIdentityHash,
        sharedLockIdentityHash:
          claimed.transactionStaging.stagedSharedLock.physicalIdentityHash,
        legacyNodeLockIdentityHash: LEGACY_LOCK_IDENTITY,
        nodeLifecycleIdentityHash:
          PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_NODE_LIFECYCLE_IDENTITY_HASH_V2,
        nodeLifecycleSnapshotHash:
          claimed.activationClaim.claim.nodeLifecycleSnapshotHash,
        parentIdentityHash: PARENT_IDENTITY,
        preActivationNamespaceCaptureHash:
          claimed.transactionStaging.preActivationNamespaceCaptureHash,
        transactionStagingIdentityHash:
          claimed.transactionStaging.stagingDirectoryIdentityHash,
        transactionStagingCensusHash: aliasedReceiptStagingCensusHash,
      });
    const aliasedReceiptNamespace = exactNamespacePreservingPhysicalState(
      claimed,
      claimed.namespace.census.orderedEntries.map((entry) => entry.basename),
      {
        [contract.registry.activationClaimBasename]:
          hashPlatformReleaseBootstrapRegistryPublishedCanonicalJsonBytesV2(
            aliasedReceiptClaim,
          ),
      },
    );
    const receiptLocatorAliasedToLegacyPackageLock =
      refreshGlobalPhysicalEvidence(
        {
          ...claimed,
          activationClaim: {
            ...claimed.activationClaim,
            claim: aliasedReceiptClaim,
          },
          namespace: aliasedReceiptNamespace,
          transactionStaging: {
            ...claimed.transactionStaging,
            stagingCensusHash: aliasedReceiptStagingCensusHash,
            stagedActivationReceipt: stagedReceiptAliasedToLegacyPackageLock,
            orderedMembers: aliasedReceiptMembers,
          },
        },
        aliasedReceiptNamespace,
      );
    assert.deepEqual(
      plan(receiptLocatorAliasedToLegacyPackageLock).corruptionReasons,
      ["physical_object_locator_alias"],
    );

    const partialBeforeReceipt = withActivationCleanupPartial(claimed, 2);
    assert.deepEqual(plan(partialBeforeReceipt).corruptionReasons, [
      "activation_cleanup_partial_before_receipt",
    ]);

    const activatedWithClaim = withActivation(
      withGenesis(withSharedLock(claimed)),
    );
    const sameBytesNewReceiptInode = mutableClone(activatedWithClaim);
    assert.equal(sameBytesNewReceiptInode.activationReceipt.status, "exact");
    sameBytesNewReceiptInode.activationReceipt.physicalIdentityHash = hash("f");
    assert.deepEqual(plan(sameBytesNewReceiptInode).corruptionReasons, [
      "activation_staged_physical_identity_mismatch",
      "physical_namespace_relation_mismatch",
    ]);

    const stageConsumedThenReplaced =
      withoutTransactionStaging(activatedWithClaim);
    assert.equal(stageConsumedThenReplaced.activationReceipt.status, "exact");
    stageConsumedThenReplaced.activationReceipt.physicalIdentityHash =
      hash("f");
    assert.deepEqual(plan(stageConsumedThenReplaced).corruptionReasons, [
      "physical_namespace_relation_mismatch",
    ]);

    const partial = withActivationCleanupPartial(activatedWithClaim, 2);
    assert.equal(partial.transactionStaging.status, "cleanup_partial");
    assert.deepEqual(
      partial.transactionStaging.remainingMembers.map(
        (member) => member.memberKind,
      ),
      ["staged_genesis_epoch_state", "staged_shared_lock"],
    );
    const replacedMember = mutableClone(partial);
    assert.equal(replacedMember.transactionStaging.status, "cleanup_partial");
    replacedMember.transactionStaging.remainingMembers[0]!.physicalIdentityHash =
      hash("f");
    replacedMember.transactionStaging.currentRemainingCensusHash =
      hashPlatformReleaseBootstrapRegistryActivationCleanupRemainingCensusV2(
        replacedMember.transactionStaging.remainingMembers,
      );
    assert.throws(() => plan(replacedMember));

    const foreignMember = mutableClone(partial);
    foreignMember.transactionStaging = {
      status: "invalid",
      failureKind: "foreign_member",
    };
    assert.deepEqual(plan(foreignMember).corruptionReasons, [
      "activation_claim_identity_mismatch",
      "physical_object_locator_alias",
      "transaction_staging_invalid",
    ]);

    const receiptWithClaimlessStage = withoutActivationClaim(
      withActivation(withGenesis(withSharedLock(claimed))),
    );
    assert.deepEqual(plan(receiptWithClaimlessStage).corruptionReasons, [
      "activation_staging_missing_claim",
    ]);
  });

  it("rejects laundered stage entries, unsafe orphans, hidden links, and fingerprint splices", () => {
    const directoryObject = buildStableFsObjectIdentityV2({
      filesystemScope: FILESYSTEM_SCOPE,
      objectKind: "directory",
      device: "7",
      inode: "9901",
    });
    const directoryFingerprint = buildFsObservationFingerprintV2({
      objectIdentity: directoryObject,
      ownerUid: 0,
      ownerGid: 0,
      mode: "0755",
      linkCount: 1,
      byteLength: 512,
      modifiedTimeNanoseconds: "99010",
      changedTimeNanoseconds: "99011",
    });
    assert.throws(() =>
      buildPlatformReleaseBootstrapRegistryStagingPhysicalMemberV2({
        memberKind: "staged_activation_receipt",
        parentObjectIdentity: STAGING_DIRECTORY_OBJECT,
        logicalIdentityHash: expectedActivationReceipt().activationReceiptHash,
        objectIdentity: directoryObject,
        fingerprint: directoryFingerprint,
        rawContentHash:
          hashPlatformReleaseBootstrapRegistryPublishedCanonicalJsonBytesV2(
            expectedActivationReceipt(),
          ),
      }),
    );
    assert.throws(() =>
      Reflect.apply(
        buildPlatformReleaseBootstrapRegistryStagingPhysicalMemberV2,
        undefined,
        [
          {
            memberKind: "staged_activation_receipt",
            logicalIdentityHash:
              expectedActivationReceipt().activationReceiptHash,
            objectIdentity: STAGED_ACTIVATION_RECEIPT_OBJECT,
            fingerprint: stagingPhysicalMember(
              "staged_activation_receipt",
              expectedActivationReceipt().activationReceiptHash,
              STAGED_ACTIVATION_RECEIPT_OBJECT,
            ).fingerprint,
            rawContentHash:
              hashPlatformReleaseBootstrapRegistryPublishedCanonicalJsonBytesV2(
                expectedActivationReceipt(),
              ),
          },
        ],
      ),
    );

    const knownOrphanMembers = [
      stagingPhysicalMember(
        "staged_activation_receipt",
        expectedActivationReceipt().activationReceiptHash,
        STAGED_ACTIVATION_RECEIPT_OBJECT,
      ),
      stagingPhysicalMember(
        "staged_genesis_epoch_state",
        PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_GENESIS_EPOCH_FLOOR_STATE_V2.epochStateHash,
        STAGED_GENESIS_EPOCH_OBJECT,
      ),
      stagingPhysicalMember(
        "staged_shared_lock",
        contract.registry.sharedLockContentHash,
        STAGED_SHARED_LOCK_OBJECT,
      ),
    ];
    const knownOrphanNamespace = exactNamespace(
      [...emptyNodeNames(), contract.registry.transactionStagingBasename],
      {
        directoryMembers: {
          [contract.registry.transactionStagingBasename]:
            knownOrphanMembers.map((member) => ({
              basename: member.classification.basename,
              objectKind: member.classification.objectKind,
            })),
        },
      },
    );
    const knownOrphan = refreshGlobalPhysicalEvidence(
      {
        ...baseInput(),
        namespace: knownOrphanNamespace,
        transactionStaging: {
          status: "orphan",
          transactionKind: "activation",
          stagingDirectoryIdentityHash: ACTIVATION_STAGING_DIRECTORY_IDENTITY,
          ...stagingDirectoryPhysicalEvidence(knownOrphanNamespace),
          stagingCensusHash:
            hashPlatformReleaseBootstrapRegistryOrphanStagingCensusV2(
              "activation",
              knownOrphanMembers,
            ),
          orderedMembers: knownOrphanMembers,
        },
      },
      knownOrphanNamespace,
    );
    assert.equal(
      plan(knownOrphan).nextAction,
      "cleanup_orphaned_activation_staging",
    );

    const arbitraryReceiptMember = stagingPhysicalMember(
      "staged_activation_receipt",
      hash("a"),
      STAGED_ACTIVATION_RECEIPT_OBJECT,
      hash("b"),
    );
    const arbitraryContentMembers = [
      arbitraryReceiptMember,
      ...knownOrphanMembers.slice(1),
    ];
    const arbitraryContentOrphan = {
      ...knownOrphan,
      transactionStaging: {
        ...knownOrphan.transactionStaging,
        stagingCensusHash:
          hashPlatformReleaseBootstrapRegistryOrphanStagingCensusV2(
            "activation",
            arbitraryContentMembers,
          ),
        orderedMembers: arbitraryContentMembers,
      },
    } as PlatformReleaseBootstrapRegistryActivationObservationInputV2;
    const arbitraryContentPlan = plan(arbitraryContentOrphan);
    assert.equal(arbitraryContentPlan.state, "CORRUPT");
    assert.equal(arbitraryContentPlan.nextAction, "no_mutation");
    assert.deepEqual(arbitraryContentPlan.corruptionReasons, [
      "transaction_staging_orphan_not_cleanable",
    ]);

    const foreignReceipt =
      buildPlatformReleaseBootstrapRegistryActivationReceiptV2({
        sharedLockIdentityHash: hash("f"),
        legacyNodeLockIdentityHash: LEGACY_LOCK_IDENTITY,
        nodeLifecycleIdentityHash:
          PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_NODE_LIFECYCLE_IDENTITY_HASH_V2,
        parentIdentityHash: PARENT_IDENTITY,
      });
    const foreignReceiptMembers = [
      stagingPhysicalMember(
        "staged_activation_receipt",
        foreignReceipt.activationReceiptHash,
        STAGED_ACTIVATION_RECEIPT_OBJECT,
        hashPlatformReleaseBootstrapRegistryPublishedCanonicalJsonBytesV2(
          foreignReceipt,
        ),
      ),
      ...knownOrphanMembers.slice(1),
    ];
    const foreignReceiptOrphan = {
      ...knownOrphan,
      transactionStaging: {
        ...knownOrphan.transactionStaging,
        stagingCensusHash:
          hashPlatformReleaseBootstrapRegistryOrphanStagingCensusV2(
            "activation",
            foreignReceiptMembers,
          ),
        orderedMembers: foreignReceiptMembers,
      },
    } as PlatformReleaseBootstrapRegistryActivationObservationInputV2;
    const foreignReceiptPlan = plan(foreignReceiptOrphan);
    assert.equal(foreignReceiptPlan.state, "CORRUPT");
    assert.equal(foreignReceiptPlan.nextAction, "no_mutation");
    assert.deepEqual(foreignReceiptPlan.corruptionReasons, [
      "transaction_staging_orphan_not_cleanable",
    ]);

    const foreignOrphanNamespace = exactNamespace(
      [...emptyNodeNames(), contract.registry.transactionStagingBasename],
      {
        directoryMembers: {
          [contract.registry.transactionStagingBasename]: [
            {
              basename: "foreign-member",
              objectKind: "ordinary_file",
            },
          ],
        },
      },
    );
    const foreignOrphan = {
      ...baseInput(),
      namespace: foreignOrphanNamespace,
      transactionStaging: {
        status: "orphan",
        transactionKind: "activation",
        stagingDirectoryIdentityHash: ACTIVATION_STAGING_DIRECTORY_IDENTITY,
        ...stagingDirectoryEvidenceForMembers([]),
        stagingCensusHash:
          hashPlatformReleaseBootstrapRegistryOrphanStagingCensusV2(
            "activation",
            [],
          ),
        orderedMembers: [],
      },
    } as PlatformReleaseBootstrapRegistryActivationObservationInputV2;
    const foreignOrphanPlan = plan(foreignOrphan);
    assert.equal(foreignOrphanPlan.state, "CORRUPT");
    assert.equal(foreignOrphanPlan.nextAction, "no_mutation");
    assert.ok(
      foreignOrphanPlan.corruptionReasons.includes(
        "physical_namespace_relation_mismatch",
      ),
    );

    const activated = fullyActivated();
    assert.equal(activated.namespace.status, "exact");
    const hiddenReceiptLinkNamespace = exactNamespacePreservingPhysicalState(
      activated,
      activated.namespace.census.orderedEntries.map((entry) => entry.basename),
      {},
      {
        [contract.registry.activationReceiptBasename]: 2,
      },
    );
    const hiddenReceiptLink = refreshGlobalPhysicalEvidence(
      {
        ...activated,
        namespace: hiddenReceiptLinkNamespace,
      },
      hiddenReceiptLinkNamespace,
    );
    assert.deepEqual(plan(hiddenReceiptLink).corruptionReasons, [
      "physical_object_locator_alias",
    ]);

    const target = laterFloor();
    const targetNamespace = exactNamespace(
      [
        ...activated.namespace.census.orderedEntries.map(
          (entry) => entry.basename,
        ),
        hostPackage.rootBasename,
        hostPackage.lifecycle.packageLockBasename,
      ],
      {
        objectIdentities: {
          [contract.registry.epochFloorBasename]: STAGED_EPOCH_TARGET_OBJECT,
        },
        linkCounts: {
          [contract.registry.epochFloorBasename]: 2,
        },
        rawContentHashes: {
          [contract.registry.epochFloorBasename]:
            hashPlatformReleaseBootstrapRegistryPublishedCanonicalJsonBytesV2(
              target,
            ),
        },
      },
    );
    const hiddenEpochTargetLink = refreshGlobalPhysicalEvidence(
      {
        ...activated,
        namespace: targetNamespace,
        epochFloor: exactEpochFloorObservation(target, targetNamespace),
      },
      targetNamespace,
    );
    assert.deepEqual(plan(hiddenEpochTargetLink).corruptionReasons, [
      "physical_object_locator_alias",
    ]);

    const legacy = baseInput();
    assert.equal(legacy.namespace.status, "exact");
    const hiddenPackageLockLinkNamespace =
      exactNamespacePreservingPhysicalState(
        legacy,
        legacy.namespace.census.orderedEntries.map((entry) => entry.basename),
        {},
        {
          [nodePackage.lifecycle.packageLockBasename]: 2,
        },
      );
    const hiddenPackageLockLink = refreshGlobalPhysicalEvidence(
      {
        ...legacy,
        namespace: hiddenPackageLockLinkNamespace,
      },
      hiddenPackageLockLinkNamespace,
    );
    assert.deepEqual(plan(hiddenPackageLockLink).corruptionReasons, [
      "physical_object_locator_alias",
    ]);

    const shared = withSharedLock(withActivationClaim(baseInput()));
    assert.ok(
      shared.transactionStaging.status === "exact" &&
        shared.transactionStaging.transactionKind === "activation",
    );
    const stagedShared = shared.transactionStaging.stagedSharedLock;
    const incompatibleStagedShared =
      buildPlatformReleaseBootstrapRegistryStagingPhysicalMemberV2({
        memberKind: stagedShared.memberKind,
        parentObjectIdentity: stagedShared.parentObjectIdentity,
        logicalIdentityHash: stagedShared.logicalIdentityHash,
        objectIdentity: stagedShared.objectIdentity,
        fingerprint: buildFsObservationFingerprintV2({
          objectIdentity: stagedShared.objectIdentity,
          ownerUid: 1,
          ownerGid: stagedShared.fingerprint.ownerGid,
          mode: stagedShared.fingerprint.mode,
          linkCount: 2,
          byteLength: stagedShared.fingerprint.byteLength,
          modifiedTimeNanoseconds:
            stagedShared.fingerprint.modifiedTimeNanoseconds,
          changedTimeNanoseconds:
            stagedShared.fingerprint.changedTimeNanoseconds,
        }),
        rawContentHash: stagedShared.rawContentHash,
      });
    shared.transactionStaging.stagedSharedLock = incompatibleStagedShared;
    shared.transactionStaging.orderedMembers[2] = incompatibleStagedShared;
    assert.deepEqual(plan(shared).corruptionReasons, [
      "physical_namespace_relation_mismatch",
      "physical_object_locator_alias",
    ]);

    const staleLockBytes = baseInput();
    assert.equal(staleLockBytes.legacyLock.status, "exact");
    staleLockBytes.legacyLock.rawContentHash = hash("f");
    assert.deepEqual(plan(staleLockBytes).corruptionReasons, [
      "physical_namespace_relation_mismatch",
    ]);

    const wrongScopeBytes = baseInput();
    const wrongScopeNamespace = exactNamespace(emptyNodeNames(), {
      rawContentHashes: {
        [contract.registry.filesystemScopeBasename]: hash("e"),
      },
    });
    const wrongScopeObservation = refreshGlobalPhysicalEvidence(
      wrongScopeBytes,
      wrongScopeNamespace,
    );
    assert.deepEqual(plan(wrongScopeObservation).corruptionReasons, [
      "physical_namespace_relation_mismatch",
    ]);

    for (const namespace of [
      exactNamespace(emptyNodeNames(), {
        modes: {
          [contract.registry.filesystemScopeBasename]: "0644",
        },
      }),
      exactNamespace(emptyNodeNames(), {
        ownerUids: {
          [contract.registry.filesystemScopeBasename]: 1,
        },
      }),
    ]) {
      const tamperedScopeMetadata = refreshGlobalPhysicalEvidence(
        baseInput(),
        namespace,
      );
      assert.deepEqual(plan(tamperedScopeMetadata).corruptionReasons, [
        "physical_namespace_relation_mismatch",
      ]);
    }

    for (const namespace of [
      exactNamespace(emptyNodeNames(), { parentMode: "0775" }),
      exactNamespace(emptyNodeNames(), { parentOwnerUid: 1 }),
    ]) {
      const tamperedParentMetadata = refreshGlobalPhysicalEvidence(
        baseInput(),
        namespace,
      );
      assert.deepEqual(plan(tamperedParentMetadata).corruptionReasons, [
        "physical_namespace_relation_mismatch",
      ]);
    }
  });

  it("accepts stable Node status only as a non-authoritative logical census projection", () => {
    const ready = baseInput(readyNodeNames());
    assert.equal(ready.nodeLifecycle.status, "empty_or_rolled_back");
    ready.nodeLifecycle = {
      status: "ready",
      observationAuthority:
        "logical_namespace_projection_only_never_node_semantic_authority_v2",
      productionAuthority: false,
      semanticSnapshotStatus:
        "unavailable_requires_captured_evidence_v2",
      nodeLifecycleIdentityHash:
        PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_NODE_LIFECYCLE_IDENTITY_HASH_V2,
      nodeLifecycleSnapshotHash: ready.nodeLifecycle.nodeLifecycleSnapshotHash,
    };
    const readyPlan = plan(ready);
    assert.equal(readyPlan.state, "LEGACY_ONLY");
    assert.equal(readyPlan.observation.nodeLifecycle.productionAuthority, false);
    assert.equal(
      readyPlan.observation.nodeLifecycle.observationAuthority,
      "logical_namespace_projection_only_never_node_semantic_authority_v2",
    );
    assert.equal(
      readyPlan.observation.nodeLifecycle.semanticSnapshotStatus,
      "unavailable_requires_captured_evidence_v2",
    );

    const readyWithoutRoot = baseInput();
    assert.equal(readyWithoutRoot.nodeLifecycle.status, "empty_or_rolled_back");
    readyWithoutRoot.nodeLifecycle = {
      status: "ready",
      observationAuthority:
        "logical_namespace_projection_only_never_node_semantic_authority_v2",
      productionAuthority: false,
      semanticSnapshotStatus:
        "unavailable_requires_captured_evidence_v2",
      nodeLifecycleIdentityHash:
        PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_NODE_LIFECYCLE_IDENTITY_HASH_V2,
      nodeLifecycleSnapshotHash:
        readyWithoutRoot.nodeLifecycle.nodeLifecycleSnapshotHash,
    };
    assert.deepEqual(plan(readyWithoutRoot).corruptionReasons, [
      "node_lifecycle_census_mismatch",
    ]);

    const emptyWithClaim = baseInput([
      ...emptyNodeNames(),
      nodePackage.lifecycle.activeClaimBasename,
    ]);
    assert.deepEqual(plan(emptyWithClaim).corruptionReasons, [
      "node_lifecycle_census_mismatch",
    ]);

    const transient = baseInput([
      ...emptyNodeNames(),
      `${nodePackage.lifecycle.stagingPrefix}.${hash("c")}`,
    ]);
    transient.nodeLifecycle = {
      status: "transient",
      failureKind: "active_staging",
    };
    assert.equal(plan(transient).state, "CORRUPT");
    assert.ok(
      plan(transient).corruptionReasons.includes("node_lifecycle_not_stable"),
    );
  });

  it("rejects missing or forged stable Node authority policy even after plan rehash", () => {
    const cleanPlan = plan(baseInput());
    assert.ok(
      cleanPlan.observation.nodeLifecycle.status === "ready" ||
        cleanPlan.observation.nodeLifecycle.status === "empty_or_rolled_back",
    );
    const mutations: readonly ((node: Record<string, unknown>) => void)[] = [
      (node) => {
        delete node.observationAuthority;
      },
      (node) => {
        node.productionAuthority = true;
      },
      (node) => {
        node.observationAuthority = "forged_node_semantic_authority_v2";
      },
      (node) => {
        node.semanticSnapshotStatus = "available_without_captured_evidence_v2";
      },
    ];
    for (const mutate of mutations) {
      const tamperedObservation = mutableClone(
        cleanPlan.observation,
      ) as unknown as Record<string, unknown>;
      mutate(
        tamperedObservation.nodeLifecycle as Record<string, unknown>,
      );
      assert.throws(() =>
        parsePlatformReleaseBootstrapRegistryActivationObservationCandidateV2(
          tamperedObservation,
        ),
      );

      const rehashedPlan = mutableClone(
        cleanPlan,
      ) as unknown as Record<string, unknown>;
      const rehashedObservation = rehashedPlan.observation as Record<
        string,
        unknown
      >;
      mutate(rehashedObservation.nodeLifecycle as Record<string, unknown>);
      rehashedPlan.planHash =
        hashPlatformReleaseBootstrapRegistryActivationPlanV2(rehashedPlan);
      assert.equal(
        PlatformReleaseBootstrapRegistryActivationPlanV2Schema.safeParse(
          rehashedPlan,
        ).success,
        false,
      );
      assert.throws(() =>
        parsePlatformReleaseBootstrapRegistryActivationPlanCandidateV2(
          rehashedPlan,
        ),
      );
    }
  });

  it("fails closed on preactivation siblings, claims, and impossible floor states", () => {
    const sibling = baseInput([
      ...emptyNodeNames(),
      contract.packages.find(
        (entry) =>
          entry.packageRef ===
          PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.hostVerifier,
      )!.rootBasename,
    ]);
    assert.deepEqual(plan(sibling).corruptionReasons, [
      "namespace_non_node_siblings_before_activation",
    ]);

    const shared = withSharedLock(withActivationClaim(baseInput()));
    const claim = buildPlatformReleaseBootstrapRegistryEpochClaimV2({
      transactionIdentityHash: hash("b"),
      priorEpochState:
        PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_GENESIS_EPOCH_FLOOR_STATE_V2,
      targetEpochState: laterFloor(),
      ...epochStageBinding(laterFloor()),
      packageRef: PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.hostVerifier,
      packageInstallationGeneration: 1,
      offlineRollbackAuthorizationHash: null,
    });
    assert.equal(shared.namespace.status, "exact");
    const preactivationNamespace = exactNamespace([
      ...shared.namespace.census.orderedEntries.map((entry) => entry.basename),
      contract.registry.epochClaimBasename,
      hostPackage.rootBasename,
      hostPackage.lifecycle.packageLockBasename,
    ]);
    const preactivationClaim = {
      ...shared,
      namespace: preactivationNamespace,
      epochClaim: exactEpochClaimObservation(claim, preactivationNamespace),
    };
    assert.ok(
      plan(preactivationClaim).corruptionReasons.includes(
        "epoch_claim_present_before_activation",
      ),
    );

    const laterWithoutReceipt = withGenesis(shared);
    assert.equal(laterWithoutReceipt.epochFloor.status, "exact");
    laterWithoutReceipt.epochFloor = {
      ...laterWithoutReceipt.epochFloor,
      state: laterFloor(),
    };
    assert.deepEqual(plan(laterWithoutReceipt).corruptionReasons, [
      "non_genesis_floor_before_activation",
      "physical_namespace_relation_mismatch",
    ]);

    const floorWithoutShared = baseInput([
      ...emptyNodeNames(),
      contract.registry.epochFloorBasename,
    ]);
    floorWithoutShared.epochFloor = {
      status: "exact",
      state: PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_GENESIS_EPOCH_FLOOR_STATE_V2,
      physicalIdentityHash: GENESIS_EPOCH_FLOOR_PHYSICAL_IDENTITY,
      ...regularFilePhysicalEvidence(
        floorWithoutShared.namespace,
        contract.registry.epochFloorBasename,
      ),
    };
    assert.deepEqual(plan(floorWithoutShared).corruptionReasons, [
      "activation_claim_required_for_resume",
      "shared_lock_missing_for_epoch_floor",
    ]);
  });

  it("turns aliased or mismatched cutover identities into corruption without throwing", () => {
    const aliased = withSharedLock(withActivationClaim(baseInput()));
    aliased.sharedLock = {
      ...aliased.sharedLock,
      sharedLockIdentityHash: LEGACY_LOCK_IDENTITY,
    };
    const aliasedPlan = plan(aliased);
    assert.equal(aliasedPlan.state, "CORRUPT");
    assert.deepEqual(aliasedPlan.corruptionReasons, [
      "activation_staging_relation_mismatch",
      "physical_namespace_relation_mismatch",
    ]);

    const genesis = withGenesis(
      withSharedLock(withActivationClaim(baseInput())),
    );
    const activated = withActivation(genesis);
    const wrongReceipt =
      buildPlatformReleaseBootstrapRegistryActivationReceiptV2({
        sharedLockIdentityHash: hash("4"),
        legacyNodeLockIdentityHash: LEGACY_LOCK_IDENTITY,
        nodeLifecycleIdentityHash:
          PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_NODE_LIFECYCLE_IDENTITY_HASH_V2,
        parentIdentityHash: PARENT_IDENTITY,
      });
    activated.activationReceipt = {
      ...activated.activationReceipt,
      receipt: wrongReceipt,
    };
    assert.deepEqual(plan(activated).corruptionReasons, [
      "activation_receipt_cutover_identity_mismatch",
      "physical_namespace_relation_mismatch",
    ]);

    const presenceMismatch = withSharedLock(withActivationClaim(baseInput()));
    assert.equal(presenceMismatch.namespace.status, "exact");
    presenceMismatch.namespace = exactNamespace(
      presenceMismatch.namespace.census.orderedEntries
        .filter((entry) => entry.category !== "shared_parent_lock")
        .map((entry) => entry.basename),
    );
    assert.deepEqual(plan(presenceMismatch).corruptionReasons, [
      "namespace_observation_mismatch",
      "physical_object_locator_alias",
    ]);
  });

  it("accepts a later floor after activation and types exact claim recovery", () => {
    const activated = fullyActivated();
    assert.equal(activated.namespace.status, "exact");
    const current = laterFloor();
    const hostRoot = contract.packages.find(
      (entry) =>
        entry.packageRef ===
        PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.hostVerifier,
    )!.rootBasename;
    const activeLaterNamespace = targetEpochNamespace(
      [
        ...activated.namespace.census.orderedEntries.map(
          (entry) => entry.basename,
        ),
        hostRoot,
        hostPackage.lifecycle.packageLockBasename,
      ],
      [],
      current,
    );
    const activeLater = {
      ...activated,
      namespace: activeLaterNamespace,
      epochFloor: exactEpochFloorObservation(current, activeLaterNamespace),
    };
    const activeLaterPlan = plan(activeLater);
    assert.equal(activeLaterPlan.state, "ACTIVATED");
    assert.equal(activeLaterPlan.nextAction, "return_activated");

    const claim = buildPlatformReleaseBootstrapRegistryEpochClaimV2({
      transactionIdentityHash: current.transactionIdentityHash!,
      priorEpochState:
        PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_GENESIS_EPOCH_FLOOR_STATE_V2,
      targetEpochState: current,
      ...epochStageBinding(current),
      packageRef: PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.hostVerifier,
      packageInstallationGeneration: 1,
      offlineRollbackAuthorizationHash: null,
    });
    const claimNames = [
      ...activeLater.namespace.census.orderedEntries.map(
        (entry) => entry.basename,
      ),
      contract.registry.epochClaimBasename,
    ];
    const atTargetNamespace = targetEpochNamespace(
      claimNames,
      [],
      current,
      claim,
    );
    const atTarget = {
      ...activeLater,
      namespace: atTargetNamespace,
      epochClaim: exactEpochClaimObservation(claim, atTargetNamespace),
    };
    const targetPlan = plan(atTarget);
    assert.equal(targetPlan.state, "ACTIVATED");
    assert.equal(targetPlan.nextAction, "recover_epoch_claim");
    assert.equal(targetPlan.epochClaimDisposition, "recovery_from_target");

    const sameBytesNewTargetInode = mutableClone(atTarget);
    assert.equal(sameBytesNewTargetInode.epochFloor.status, "exact");
    sameBytesNewTargetInode.epochFloor.physicalIdentityHash = hash("f");
    assert.deepEqual(plan(sameBytesNewTargetInode).corruptionReasons, [
      "epoch_staged_physical_identity_mismatch",
      "physical_namespace_relation_mismatch",
    ]);

    assert.equal(atTarget.namespace.status, "exact");
    const atTargetWithStageNamespace = targetEpochNamespace(
      [
        ...atTarget.namespace.census.orderedEntries.map(
          (entry) => entry.basename,
        ),
        contract.registry.transactionStagingBasename,
      ],
      ["staged_target_epoch_state"],
      current,
      claim,
    );
    const atTargetWithStage = {
      ...atTarget,
      namespace: atTargetWithStageNamespace,
      epochClaim: exactEpochClaimObservation(claim, atTargetWithStageNamespace),
      transactionStaging: {
        ...exactEpochStageObservation(claim),
      },
    };
    const atTargetWithExactStagePlan = plan(atTargetWithStage);
    assert.equal(atTargetWithExactStagePlan.state, "CORRUPT");
    assert.deepEqual(atTargetWithExactStagePlan.corruptionReasons, [
      "epoch_target_exact_state_mismatch",
      "physical_object_locator_alias",
    ]);

    const consumedAtTargetNamespace = targetEpochNamespace(
      [
        ...atTarget.namespace.census.orderedEntries.map(
          (entry) => entry.basename,
        ),
        contract.registry.transactionStagingBasename,
      ],
      [],
      current,
      claim,
    );
    const consumedAtTarget = {
      ...atTarget,
      namespace: consumedAtTargetNamespace,
      epochClaim: exactEpochClaimObservation(claim, consumedAtTargetNamespace),
      transactionStaging: consumedEpochStageObservation(claim),
    };
    const consumedAtTargetPlan = plan(consumedAtTarget);
    assert.equal(
      consumedAtTargetPlan.epochClaimDisposition,
      "recovery_from_target",
    );
    assert.deepEqual(consumedAtTargetPlan.requiredLockOrder, [
      "shared_parent_lock",
      "package_lock",
    ]);

    const consumedAtPrior = mutableClone(consumedAtTarget);
    const consumedAtPriorNamespace = exactNamespace(
      consumedAtPrior.namespace.census.orderedEntries.map(
        (entry) => entry.basename,
      ),
      {
        rawContentHashes: {
          [contract.registry.epochClaimBasename]:
            hashPlatformReleaseBootstrapRegistryPublishedCanonicalJsonBytesV2(
              claim,
            ),
        },
        directoryMembers: {
          [contract.registry.transactionStagingBasename]: [],
        },
      },
    );
    consumedAtPrior.namespace = consumedAtPriorNamespace;
    consumedAtPrior.epochClaim = exactEpochClaimObservation(
      claim,
      consumedAtPriorNamespace,
    );
    consumedAtPrior.epochFloor = exactEpochFloorObservation(
      PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_GENESIS_EPOCH_FLOOR_STATE_V2,
      consumedAtPriorNamespace,
    );
    assert.deepEqual(plan(consumedAtPrior).corruptionReasons, [
      "epoch_stage_evidence_missing",
      "epoch_target_consumed_state_mismatch",
    ]);

    const claimlessConsumed = mutableClone(consumedAtTarget);
    assert.equal(claimlessConsumed.namespace.status, "exact");
    claimlessConsumed.namespace = targetEpochNamespace(
      claimlessConsumed.namespace.census.orderedEntries
        .filter((entry) => entry.category !== "epoch_claim")
        .map((entry) => entry.basename),
      [],
      current,
    );
    claimlessConsumed.epochClaim = { status: "absent" };
    assert.deepEqual(plan(claimlessConsumed).corruptionReasons, [
      "epoch_staging_relation_mismatch",
      "epoch_target_consumed_state_mismatch",
      "physical_object_locator_alias",
    ]);

    const movedConsumedStage = mutableClone(consumedAtTarget);
    assert.equal(
      movedConsumedStage.transactionStaging.status,
      "epoch_target_consumed",
    );
    movedConsumedStage.transactionStaging.stagingDirectoryIdentityHash =
      hash("f");
    assert.throws(() => plan(movedConsumedStage));

    const replacedConsumedTarget = mutableClone(consumedAtTarget);
    assert.equal(
      replacedConsumedTarget.transactionStaging.status,
      "epoch_target_consumed",
    );
    const replacementTargetObject = buildStableFsObjectIdentityV2({
      filesystemScope: FILESYSTEM_SCOPE,
      objectKind: "ordinary_file",
      device: "7",
      inode: "9999",
    });
    const replacementTargetMember = stagingPhysicalMember(
      "staged_target_epoch_state",
      claim.targetEpochState.epochStateHash,
      replacementTargetObject,
      hashPlatformReleaseBootstrapRegistryPublishedCanonicalJsonBytesV2(
        claim.targetEpochState,
      ),
    );
    replacedConsumedTarget.transactionStaging.stagedTargetEpochMember =
      replacementTargetMember;
    replacedConsumedTarget.transactionStaging.initialStagingCensusHash =
      hashPlatformReleaseBootstrapRegistryEpochStagingInitialCensusV2([
        {
          memberKind: "staged_target_epoch_state",
          logicalIdentityHash: claim.targetEpochState.epochStateHash,
          physicalIdentityHash: replacementTargetMember.physicalIdentityHash,
        },
      ]);
    assert.deepEqual(plan(replacedConsumedTarget).corruptionReasons, [
      "epoch_staged_physical_identity_mismatch",
      "epoch_staging_relation_mismatch",
      "epoch_target_consumed_state_mismatch",
    ]);

    const unknownConsumedMember = mutableClone(consumedAtTarget);
    assert.equal(
      unknownConsumedMember.transactionStaging.status,
      "epoch_target_consumed",
    );
    assert.throws(() =>
      plan({
        ...unknownConsumedMember,
        transactionStaging: {
          ...unknownConsumedMember.transactionStaging,
          remainingMembers: [
            unknownConsumedMember.transactionStaging.stagedTargetEpochMember,
          ],
        },
      }),
    );

    const mismatchedStage = mutableClone(atTargetWithStage);
    assert.equal(mismatchedStage.transactionStaging.status, "exact");
    mismatchedStage.transactionStaging.transactionIdentityHash = hash("f");
    assert.deepEqual(plan(mismatchedStage).corruptionReasons, [
      "epoch_staging_relation_mismatch",
      "epoch_target_exact_state_mismatch",
      "physical_object_locator_alias",
    ]);

    const mismatchedTarget = mutableClone(atTargetWithStage);
    assert.ok(
      mismatchedTarget.transactionStaging.status === "exact" &&
        mismatchedTarget.transactionStaging.transactionKind === "epoch_floor",
    );
    const mismatchedTargetMap = mutableClone(
      PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_GENESIS_EPOCH_FLOOR_STATE_V2.packageEpochArtifactMap,
    );
    mismatchedTargetMap[
      PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.runtimeAccountProvisioner
    ] = {
      distributionEpoch: 1,
      artifactHash: hash("f"),
    };
    mismatchedTarget.transactionStaging.stagedTargetEpochState =
      buildPlatformReleaseBootstrapRegistryEpochFloorStateV2({
        generation: 1,
        priorEpochStateHash:
          PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_GENESIS_EPOCH_FLOOR_STATE_V2.epochStateHash,
        transactionIdentityHash: claim.transactionIdentityHash,
        packageEpochArtifactMap: mismatchedTargetMap,
      });
    const mismatchedTargetMember = stagingPhysicalMember(
      "staged_target_epoch_state",
      mismatchedTarget.transactionStaging.stagedTargetEpochState.epochStateHash,
      STAGED_EPOCH_TARGET_OBJECT,
    );
    mismatchedTarget.transactionStaging.stagedTargetEpochMember =
      mismatchedTargetMember;
    mismatchedTarget.transactionStaging.orderedMembers = [
      mismatchedTargetMember,
    ];
    mismatchedTarget.transactionStaging.stagingCensusHash =
      hashPlatformReleaseBootstrapRegistryEpochStagingInitialCensusV2([
        {
          memberKind: "staged_target_epoch_state",
          logicalIdentityHash: mismatchedTargetMember.logicalIdentityHash,
          physicalIdentityHash: mismatchedTargetMember.physicalIdentityHash,
        },
      ]);
    assert.deepEqual(plan(mismatchedTarget).corruptionReasons, [
      "epoch_staged_target_mismatch",
      "epoch_staging_relation_mismatch",
      "epoch_target_exact_state_mismatch",
      "physical_object_locator_alias",
    ]);

    const mismatchedGeneration = mutableClone(atTarget);
    assert.equal(mismatchedGeneration.epochClaim.status, "exact");
    mismatchedGeneration.epochClaim.observedInstallationGeneration = 2;
    assert.deepEqual(plan(mismatchedGeneration).corruptionReasons, [
      "epoch_claim_installation_generation_mismatch",
    ]);

    const aliasedClaimEvidence = mutableClone(atTarget);
    assert.equal(aliasedClaimEvidence.epochClaim.status, "exact");
    aliasedClaimEvidence.epochClaim.packageLifecycleProjection.packageLockObjectIdentityHash =
      claim.transactionIdentityHash;
    aliasedClaimEvidence.epochClaim.packageLifecycleProjection.projectionHash =
      hashPackageLifecyclePhysicalProjectionV2(
        aliasedClaimEvidence.epochClaim.packageLifecycleProjection,
      );
    assert.throws(() => plan(aliasedClaimEvidence));

    const aliasedStageEvidence = mutableClone(atTargetWithStage);
    assert.ok(
      aliasedStageEvidence.transactionStaging.status === "exact" &&
        aliasedStageEvidence.transactionStaging.transactionKind ===
          "epoch_floor",
    );
    aliasedStageEvidence.transactionStaging.stagingDirectoryIdentityHash =
      EPOCH_PACKAGE_LOCK_IDENTITY;
    assert.throws(() => plan(aliasedStageEvidence));

    assert.throws(() =>
      buildPlatformReleaseBootstrapRegistryEpochClaimV2({
        transactionIdentityHash: current.transactionIdentityHash!,
        priorEpochState:
          PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_GENESIS_EPOCH_FLOOR_STATE_V2,
        targetEpochState: current,
        ...epochStageBinding(current),
        packageRef:
          PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.runtimeAccountProvisioner,
        packageInstallationGeneration: 1,
        offlineRollbackAuthorizationHash: null,
      }),
    );
    const reviewerRepro = {
      ...activeLater,
      namespace: targetEpochNamespace(
        [
          ...activeLater.namespace.census.orderedEntries.map(
            (entry) => entry.basename,
          ),
          contract.registry.epochClaimBasename,
        ],
        [],
        current,
      ),
      epochClaim: {
        status: "invalid",
        failureKind: "claim_contract_mismatch",
      } as const,
    };
    const reviewerReproPlan = plan(reviewerRepro);
    assert.equal(reviewerReproPlan.state, "CORRUPT");
    assert.deepEqual(reviewerReproPlan.corruptionReasons, [
      "epoch_claim_invalid",
    ]);

    const priorWithoutStageNamespace = exactNamespace(
      atTarget.namespace.census.orderedEntries.map((entry) => entry.basename),
      {
        rawContentHashes: {
          [contract.registry.epochClaimBasename]:
            hashPlatformReleaseBootstrapRegistryPublishedCanonicalJsonBytesV2(
              claim,
            ),
        },
      },
    );
    const priorWithoutStage = {
      ...atTarget,
      namespace: priorWithoutStageNamespace,
      epochClaim: exactEpochClaimObservation(claim, priorWithoutStageNamespace),
      epochFloor: exactEpochFloorObservation(
        PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_GENESIS_EPOCH_FLOOR_STATE_V2,
        priorWithoutStageNamespace,
      ),
    };
    assert.deepEqual(plan(priorWithoutStage).corruptionReasons, [
      "epoch_stage_evidence_missing",
    ]);

    const atPriorNamespace = exactNamespace(
      atTargetWithStage.namespace.census.orderedEntries.map(
        (entry) => entry.basename,
      ),
      {
        rawContentHashes: {
          [contract.registry.epochClaimBasename]:
            hashPlatformReleaseBootstrapRegistryPublishedCanonicalJsonBytesV2(
              claim,
            ),
        },
        directoryMembers: {
          [contract.registry.transactionStagingBasename]: [
            {
              basename: "staged_target_epoch_state",
              objectKind: "ordinary_file",
            },
          ],
        },
      },
    );
    const atPrior = {
      ...atTargetWithStage,
      namespace: atPriorNamespace,
      epochClaim: exactEpochClaimObservation(claim, atPriorNamespace),
      epochFloor: exactEpochFloorObservation(
        PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_GENESIS_EPOCH_FLOOR_STATE_V2,
        atPriorNamespace,
      ),
    };
    assert.equal(plan(atPrior).epochClaimDisposition, "recovery_from_prior");

    const thirdFloor = buildPlatformReleaseBootstrapRegistryEpochFloorStateV2({
      generation: 2,
      priorEpochStateHash: current.epochStateHash,
      transactionIdentityHash: hash("d"),
      packageEpochArtifactMap: current.packageEpochArtifactMap,
    });
    const thirdFloorObject = buildStableFsObjectIdentityV2({
      filesystemScope: FILESYSTEM_SCOPE,
      objectKind: "ordinary_file",
      device: "7",
      inode: "805",
    });
    const thirdNamespace = exactNamespace(
      atTarget.namespace.census.orderedEntries.map((entry) => entry.basename),
      {
        objectIdentities: {
          [contract.registry.epochFloorBasename]: thirdFloorObject,
        },
        rawContentHashes: {
          [contract.registry.epochFloorBasename]:
            hashPlatformReleaseBootstrapRegistryPublishedCanonicalJsonBytesV2(
              thirdFloor,
            ),
          [contract.registry.epochClaimBasename]:
            hashPlatformReleaseBootstrapRegistryPublishedCanonicalJsonBytesV2(
              claim,
            ),
        },
      },
    );
    const third = {
      ...atTarget,
      namespace: thirdNamespace,
      epochClaim: exactEpochClaimObservation(claim, thirdNamespace),
      epochFloor: exactEpochFloorObservation(thirdFloor, thirdNamespace),
    };
    assert.deepEqual(plan(third).corruptionReasons, [
      "epoch_claim_state_mismatch",
    ]);

    const epochOrphanNamespace = targetEpochNamespace(
      [
        ...activeLater.namespace.census.orderedEntries.map(
          (entry) => entry.basename,
        ),
        contract.registry.transactionStagingBasename,
      ],
      [],
      current,
    );
    const epochOrphanMembers: ReturnType<typeof stagingPhysicalMember>[] = [];
    const epochOrphan = {
      ...activeLater,
      namespace: epochOrphanNamespace,
      transactionStaging: {
        status: "orphan",
        transactionKind: "epoch_floor",
        stagingDirectoryIdentityHash: EPOCH_STAGING_DIRECTORY_IDENTITY,
        ...stagingDirectoryPhysicalEvidence(epochOrphanNamespace),
        stagingCensusHash:
          hashPlatformReleaseBootstrapRegistryOrphanStagingCensusV2(
            "epoch_floor",
            epochOrphanMembers,
          ),
        orderedMembers: epochOrphanMembers,
      } as const,
    };
    const epochOrphanPlan = plan(epochOrphan);
    assert.equal(epochOrphanPlan.state, "EPOCH_STAGING_ORPHANED");
    assert.equal(epochOrphanPlan.nextAction, "cleanup_orphaned_epoch_staging");
    assert.deepEqual(epochOrphanPlan.requiredLockOrder, ["shared_parent_lock"]);

    const unclaimedEpochTargetObject = buildStableFsObjectIdentityV2({
      filesystemScope: FILESYSTEM_SCOPE,
      objectKind: "ordinary_file",
      device: "7",
      inode: "9902",
    });
    const unclaimedEpochTargetMember = stagingPhysicalMember(
      "staged_target_epoch_state",
      current.epochStateHash,
      unclaimedEpochTargetObject,
      hashPlatformReleaseBootstrapRegistryPublishedCanonicalJsonBytesV2(
        current,
      ),
    );
    const nonemptyEpochOrphanNamespace = targetEpochNamespace(
      [
        ...activeLater.namespace.census.orderedEntries.map(
          (entry) => entry.basename,
        ),
        contract.registry.transactionStagingBasename,
      ],
      [unclaimedEpochTargetMember.classification.basename],
      current,
    );
    const nonemptyEpochOrphan = {
      ...activeLater,
      namespace: nonemptyEpochOrphanNamespace,
      epochFloor: exactEpochFloorObservation(
        current,
        nonemptyEpochOrphanNamespace,
      ),
      transactionStaging: {
        status: "orphan",
        transactionKind: "epoch_floor",
        stagingDirectoryIdentityHash: EPOCH_STAGING_DIRECTORY_IDENTITY,
        ...stagingDirectoryPhysicalEvidence(nonemptyEpochOrphanNamespace),
        stagingCensusHash:
          hashPlatformReleaseBootstrapRegistryOrphanStagingCensusV2(
            "epoch_floor",
            [unclaimedEpochTargetMember],
          ),
        orderedMembers: [unclaimedEpochTargetMember],
      } as const,
    };
    const nonemptyEpochOrphanPlan = plan(nonemptyEpochOrphan);
    assert.equal(nonemptyEpochOrphanPlan.state, "CORRUPT");
    assert.equal(nonemptyEpochOrphanPlan.nextAction, "no_mutation");
    assert.deepEqual(nonemptyEpochOrphanPlan.corruptionReasons, [
      "transaction_staging_orphan_not_cleanable",
    ]);

    const prematureEpochOrphan = baseInput([
      ...emptyNodeNames(),
      contract.registry.transactionStagingBasename,
    ]);
    prematureEpochOrphan.transactionStaging = {
      status: "orphan",
      transactionKind: "epoch_floor",
      stagingDirectoryIdentityHash: EPOCH_STAGING_DIRECTORY_IDENTITY,
      ...stagingDirectoryPhysicalEvidence(prematureEpochOrphan.namespace),
      stagingCensusHash:
        hashPlatformReleaseBootstrapRegistryOrphanStagingCensusV2(
          "epoch_floor",
          [],
        ),
      orderedMembers: [],
    };
    assert.deepEqual(plan(prematureEpochOrphan).corruptionReasons, [
      "transaction_staging_orphan_not_cleanable",
    ]);

    const cleanupPending = withActivation(
      withGenesis(withSharedLock(withActivationClaim(baseInput()))),
    );
    const cleanupWithLaterFloor = {
      ...cleanupPending,
      epochFloor: {
        ...cleanupPending.epochFloor,
        state: current,
      } as const,
    };
    assert.deepEqual(plan(cleanupWithLaterFloor).corruptionReasons, [
      "activation_cleanup_floor_not_genesis",
      "physical_namespace_relation_mismatch",
    ]);
    assert.equal(cleanupPending.namespace.status, "exact");
    const cleanupWithSibling = {
      ...cleanupPending,
      namespace: exactNamespace([
        ...cleanupPending.namespace.census.orderedEntries.map(
          (entry) => entry.basename,
        ),
        hostRoot,
      ]),
    };
    assert.deepEqual(plan(cleanupWithSibling).corruptionReasons, [
      "activation_cleanup_non_node_siblings_present",
      "physical_namespace_relation_mismatch",
      "physical_object_locator_alias",
    ]);
    assert.equal(cleanupPending.namespace.status, "exact");
    const mutuallyExclusiveClaims = {
      ...cleanupPending,
      namespace: exactNamespace([
        ...cleanupPending.namespace.census.orderedEntries.map(
          (entry) => entry.basename,
        ),
        contract.registry.epochClaimBasename,
        hostPackage.rootBasename,
        hostPackage.lifecycle.packageLockBasename,
      ]),
      epochClaim: exactEpochClaimObservation(
        claim,
        exactNamespace([
          ...cleanupPending.namespace.census.orderedEntries.map(
            (entry) => entry.basename,
          ),
          contract.registry.epochClaimBasename,
          hostPackage.rootBasename,
          hostPackage.lifecycle.packageLockBasename,
        ]),
      ),
    };
    assert.ok(
      plan(mutuallyExclusiveClaims).corruptionReasons.includes(
        "registry_claims_not_mutually_exclusive",
      ),
    );
  });

  it("joins claimed package lifecycle evidence to the exact global namespace", () => {
    const activated = fullyActivated();
    assert.equal(activated.namespace.status, "exact");
    const hostTarget = laterFloor();
    const hostClaim = buildPlatformReleaseBootstrapRegistryEpochClaimV2({
      transactionIdentityHash: hostTarget.transactionIdentityHash!,
      priorEpochState:
        PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_GENESIS_EPOCH_FLOOR_STATE_V2,
      targetEpochState: hostTarget,
      ...epochStageBinding(hostTarget),
      packageRef: hostPackage.packageRef,
      packageInstallationGeneration: 1,
      offlineRollbackAuthorizationHash: null,
    });
    const hostNamespace = targetEpochNamespace(
      [
        ...activated.namespace.census.orderedEntries.map(
          (entry) => entry.basename,
        ),
        hostPackage.rootBasename,
        hostPackage.lifecycle.packageLockBasename,
        contract.registry.epochClaimBasename,
      ],
      [],
      hostTarget,
      hostClaim,
    );
    const hostRecovery = {
      ...activated,
      namespace: hostNamespace,
      epochFloor: exactEpochFloorObservation(hostTarget, hostNamespace),
      epochClaim: exactEpochClaimObservation(hostClaim, hostNamespace),
    };
    assert.equal(
      plan(hostRecovery).epochClaimDisposition,
      "recovery_from_target",
    );

    const foreignFilesystemScope = buildBootstrapFilesystemScopeIdentityV2({
      scopeNonce: hash("8"),
    });
    const foreignHostNamespace = exactNamespace(
      hostNamespace.census.orderedEntries.map((entry) => entry.basename),
      { filesystemScope: foreignFilesystemScope },
    );
    const foreignHostProjection = buildPackageLifecyclePhysicalProjectionV2(
      foreignHostNamespace.physicalCensus,
      hostPackage.packageRef,
    );
    const transplantedForeignHostProjection = mutableClone(hostRecovery);
    assert.equal(transplantedForeignHostProjection.epochClaim.status, "exact");
    transplantedForeignHostProjection.epochClaim.packageLifecycleProjection =
      foreignHostProjection;
    assert.deepEqual(
      plan(transplantedForeignHostProjection).corruptionReasons,
      ["epoch_claim_package_lifecycle_mismatch"],
    );

    const replacementHostLock = buildStableFsObjectIdentityV2({
      filesystemScope: FILESYSTEM_SCOPE,
      objectKind: "ordinary_file",
      device: "7",
      inode: "901",
    });
    const replacedHostLockNamespace = exactNamespace(
      hostNamespace.census.orderedEntries.map((entry) => entry.basename),
      {
        objectIdentities: {
          [contract.registry.epochFloorBasename]: STAGED_EPOCH_TARGET_OBJECT,
          [hostPackage.lifecycle.packageLockBasename]: replacementHostLock,
        },
        rawContentHashes: {
          [contract.registry.epochFloorBasename]:
            hashPlatformReleaseBootstrapRegistryPublishedCanonicalJsonBytesV2(
              hostTarget,
            ),
          [contract.registry.epochClaimBasename]:
            hashPlatformReleaseBootstrapRegistryPublishedCanonicalJsonBytesV2(
              hostClaim,
            ),
        },
      },
    );
    const replacedHostLockWithStaleProjection = {
      ...hostRecovery,
      namespace: replacedHostLockNamespace,
    };
    assert.deepEqual(
      plan(replacedHostLockWithStaleProjection).corruptionReasons,
      ["epoch_claim_package_lifecycle_mismatch"],
    );

    const zeroClaimedPackageEntries = mutableClone(hostRecovery);
    assert.equal(zeroClaimedPackageEntries.namespace.status, "exact");
    zeroClaimedPackageEntries.namespace = targetEpochNamespace(
      zeroClaimedPackageEntries.namespace.census.orderedEntries
        .filter((entry) => entry.ownerRef !== hostPackage.packageRef)
        .map((entry) => entry.basename),
      [],
      hostTarget,
      hostClaim,
    );
    assert.deepEqual(plan(zeroClaimedPackageEntries).corruptionReasons, [
      "epoch_claim_package_lifecycle_mismatch",
    ]);

    const nodeTarget = laterNodeFloor();
    const nodeClaim = buildPlatformReleaseBootstrapRegistryEpochClaimV2({
      transactionIdentityHash: nodeTarget.transactionIdentityHash!,
      priorEpochState:
        PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_GENESIS_EPOCH_FLOOR_STATE_V2,
      targetEpochState: nodeTarget,
      ...epochStageBinding(nodeTarget),
      packageRef: nodePackage.packageRef,
      packageInstallationGeneration: 1,
      offlineRollbackAuthorizationHash: null,
    });
    const nodeNamespace = targetEpochNamespace(
      [
        ...activated.namespace.census.orderedEntries.map(
          (entry) => entry.basename,
        ),
        contract.registry.epochClaimBasename,
      ],
      [],
      nodeTarget,
      nodeClaim,
    );
    const nodeRecovery = {
      ...activated,
      namespace: nodeNamespace,
      epochFloor: exactEpochFloorObservation(nodeTarget, nodeNamespace),
      epochClaim: exactEpochClaimObservation(nodeClaim, nodeNamespace),
    };
    assert.equal(
      plan(nodeRecovery).epochClaimDisposition,
      "recovery_from_target",
    );

    const foreignNodeNamespace = exactNamespace(
      nodeNamespace.census.orderedEntries.map((entry) => entry.basename),
      { filesystemScope: foreignFilesystemScope },
    );
    const foreignNodeProjection = buildPackageLifecyclePhysicalProjectionV2(
      foreignNodeNamespace.physicalCensus,
      nodePackage.packageRef,
    );
    const transplantedForeignNodeProjection = mutableClone(nodeRecovery);
    assert.equal(transplantedForeignNodeProjection.epochClaim.status, "exact");
    transplantedForeignNodeProjection.epochClaim.packageLifecycleProjection =
      foreignNodeProjection;
    assert.deepEqual(
      plan(transplantedForeignNodeProjection).corruptionReasons,
      ["epoch_claim_package_lifecycle_mismatch"],
    );

    const replacementNodeLock = buildStableFsObjectIdentityV2({
      filesystemScope: FILESYSTEM_SCOPE,
      objectKind: "ordinary_file",
      device: "7",
      inode: "902",
    });
    const replacedNodeLockNamespace = exactNamespace(
      nodeNamespace.census.orderedEntries.map((entry) => entry.basename),
      {
        objectIdentities: {
          [contract.registry.epochFloorBasename]: STAGED_EPOCH_TARGET_OBJECT,
          [nodePackage.lifecycle.packageLockBasename]: replacementNodeLock,
        },
        rawContentHashes: {
          [contract.registry.epochFloorBasename]:
            hashPlatformReleaseBootstrapRegistryPublishedCanonicalJsonBytesV2(
              nodeTarget,
            ),
          [contract.registry.epochClaimBasename]:
            hashPlatformReleaseBootstrapRegistryPublishedCanonicalJsonBytesV2(
              nodeClaim,
            ),
        },
      },
    );
    const replacedNodeLock = {
      ...nodeRecovery,
      namespace: replacedNodeLockNamespace,
      epochClaim: exactEpochClaimObservation(
        nodeClaim,
        replacedNodeLockNamespace,
      ),
    };
    assert.deepEqual(plan(replacedNodeLock).corruptionReasons, [
      "epoch_claim_package_lifecycle_mismatch",
      "physical_namespace_relation_mismatch",
    ]);

    const wrongNodeLock = mutableClone(nodeRecovery);
    assert.equal(wrongNodeLock.epochClaim.status, "exact");
    wrongNodeLock.epochClaim.packageLifecycleProjection.packageLockObjectIdentityHash =
      EPOCH_PACKAGE_LOCK_IDENTITY;
    wrongNodeLock.epochClaim.packageLifecycleProjection.projectionHash =
      hashPackageLifecyclePhysicalProjectionV2(
        wrongNodeLock.epochClaim.packageLifecycleProjection,
      );
    assert.throws(() => plan(wrongNodeLock));

    const wrongNodeSnapshot = mutableClone(nodeRecovery);
    assert.ok(
      wrongNodeSnapshot.nodeLifecycle.status === "ready" ||
        wrongNodeSnapshot.nodeLifecycle.status === "empty_or_rolled_back",
    );
    wrongNodeSnapshot.nodeLifecycle.nodeLifecycleSnapshotHash = hash("f");
    assert.deepEqual(plan(wrongNodeSnapshot).corruptionReasons, [
      "epoch_claim_package_lifecycle_mismatch",
    ]);
  });

  it("snapshots hostile candidates and rejects rehashed semantic plan tamper", () => {
    const activatedInput = fullyActivated();
    assert.equal(activatedInput.namespace.status, "exact");
    const foreignFilesystemScope = buildBootstrapFilesystemScopeIdentityV2({
      scopeNonce: hash("7"),
    });
    const foreignScopeNamespace = exactNamespace(
      activatedInput.namespace.census.orderedEntries.map(
        (entry) => entry.basename,
      ),
      { filesystemScope: foreignFilesystemScope },
    );
    assert.throws(() =>
      plan({
        ...activatedInput,
        namespace: foreignScopeNamespace,
      }),
    );

    const activatedPlan = plan(activatedInput);
    const tampered = mutableClone(activatedPlan);
    tampered.state = "LEGACY_ONLY";
    tampered.planHash =
      hashPlatformReleaseBootstrapRegistryActivationPlanV2(tampered);
    assert.equal(
      PlatformReleaseBootstrapRegistryActivationPlanV2Schema.safeParse(tampered)
        .success,
      false,
    );
    assert.throws(() =>
      parsePlatformReleaseBootstrapRegistryActivationPlanCandidateV2(tampered),
    );

    const physicalEvidenceTamper = mutableClone(activatedPlan);
    assert.equal(physicalEvidenceTamper.observation.namespace.status, "exact");
    physicalEvidenceTamper.observation.namespace.physicalCensus.physicalCensusHash =
      hash("f");
    assert.notEqual(
      hashPlatformReleaseBootstrapRegistryActivationPlanV2(
        physicalEvidenceTamper,
      ),
      activatedPlan.planHash,
    );
    assert.equal(
      PlatformReleaseBootstrapRegistryActivationPlanV2Schema.safeParse(
        physicalEvidenceTamper,
      ).success,
      false,
    );

    let getterCalls = 0;
    const accessorCandidate = {};
    Object.defineProperty(accessorCandidate, "legacyLock", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return { status: "absent" };
      },
    });
    assert.throws(() =>
      parsePlatformReleaseBootstrapRegistryActivationObservationCandidateV2(
        accessorCandidate,
      ),
    );
    assert.equal(getterCalls, 0);

    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;
    assert.throws(() =>
      parsePlatformReleaseBootstrapRegistryActivationObservationCandidateV2(
        cycle,
      ),
    );
  });

  it("runs one exact mechanics-only activated session without production authority", async () => {
    const activated = fullyActivated();
    const trace: string[] = [];
    const slotLedgerToken =
      Object.freeze<PlatformReleaseBootstrapRegistryPhysicalActivationLockedSlotLedgerTokenV2>(
        {
          mechanicsScope:
            PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_MECHANICS_SCOPE_V2,
        },
      );
    const actionSlotLedgerTokens: PlatformReleaseBootstrapRegistryPhysicalActivationLockedSlotLedgerTokenV2[] =
      [];
    const driver = scriptedPhysicalActivationDriverV2(
      [{ observations: [activated, activated], slotLedgerToken }],
      trace,
      { actionSlotLedgerTokens },
    );

    const result =
      await runPlatformReleaseBootstrapRegistryPhysicalActivationMechanicsOnlyV2(
        driver,
      );

    assert.deepEqual(trace, [
      "driver.open:1",
      "session1.observe:1",
      "session1.lock:shared",
      "session1.lock:package",
      "session1.revalidate",
      "session1.observe:2",
      "session1.action:returnActivated:return_activated:1",
      "session1.revalidate",
      "session1.settle:close",
    ]);
    assert.equal(actionSlotLedgerTokens.length, 1);
    assert.strictEqual(actionSlotLedgerTokens[0], slotLedgerToken);
    assert.equal(
      result.mechanicsScope,
      PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_MECHANICS_SCOPE_V2,
    );
    assert.equal(result.productionAuthority, false);
    assert.equal(result.terminalState, "ACTIVATED");
    assert.equal(result.completedRounds, 1);
    assert.equal(result.finalPlanHash, plan(activated).planHash);
    assert.equal(
      result.contractHash,
      PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_CONTRACT_V2.contractHash,
    );
    assert.equal(Object.isFrozen(result), true);
  });

  it(
    "runs the activated core path under actual Darwin shared then package fixture leases",
    { skip: process.platform !== "darwin" },
    async () => {
      const root = await mkdtemp(
        path.join(tmpdir(), "setfarm-activation-core-darwin-lock-v2-"),
      );
      const lockBytes = {
        legacy_node_package_lock: Buffer.from("core-legacy-lock-v2\n", "utf8"),
        shared_parent_lock: Buffer.from("core-shared-lock-v2\n", "utf8"),
        package_lock: Buffer.from("core-package-lock-v2\n", "utf8"),
      } as const;
      const lockPaths = {
        legacy_node_package_lock: path.join(root, "legacy.lock"),
        shared_parent_lock: path.join(root, "shared.lock"),
        package_lock: path.join(root, "package.lock"),
      } as const;
      await chmod(root, 0o700);
      await Promise.all(
        Object.entries(lockPaths).map(async ([role, lockPath]) => {
          await writeFile(
            lockPath,
            lockBytes[role as keyof typeof lockBytes],
            { mode: 0o600 },
          );
          await chmod(lockPath, 0o600);
        }),
      );
      const expectedOwner = Object.freeze({
        uid: process.getuid!(),
        gid: process.getgid!(),
      });
      const lockBoundary = (
        role: keyof typeof lockPaths,
      ) =>
        Object.freeze({
          parentPath: root,
          lockPath: lockPaths[role],
          lockBytes: lockBytes[role],
          expectedOwner,
          allowedParentModes: Object.freeze([0o700] as const),
        });
      const lockFixture =
        createPlatformReleaseBootstrapRegistryDarwinLockFixtureSessionV2({
          acquisitionOrder: ["shared_parent_lock", "package_lock"],
          locks: Object.freeze({
            legacy_node_package_lock: lockBoundary(
              "legacy_node_package_lock",
            ),
            shared_parent_lock: lockBoundary("shared_parent_lock"),
            package_lock: lockBoundary("package_lock"),
          }),
        });
      try {
        const activated = fullyActivated();
        const trace: string[] = [];
        const actionSlotLedgerTokens: PlatformReleaseBootstrapRegistryPhysicalActivationLockedSlotLedgerTokenV2[] =
          [];
        const scriptedDriver = scriptedPhysicalActivationDriverV2(
          [{ observations: [activated, activated] }],
          trace,
          { actionSlotLedgerTokens },
        );
        const scriptedSession = await scriptedDriver.openFreshSession();
        const fixtureSession = Object.freeze<PlatformReleaseBootstrapRegistryPhysicalActivationSessionV2>(
          {
            ...scriptedSession,
            async acquireLegacyNodeLock() {
              trace.push("fixture.lock:legacy:start");
              await lockFixture.acquireLegacyNodeLock();
              trace.push("fixture.lock:legacy:held");
            },
            async acquireSharedParentLock() {
              trace.push("fixture.lock:shared:start");
              await lockFixture.acquireSharedParentLock();
              trace.push("fixture.lock:shared:held");
            },
            async acquireRegisteredPackageLock() {
              trace.push("fixture.lock:package:start");
              await lockFixture.acquireRegisteredPackageLock();
              trace.push("fixture.lock:package:held");
            },
            async reobserveLockedPhysicalActivationState() {
              lockFixture.assertAllHeldAndCurrent();
              trace.push("fixture.lock-vector:current-before-locked-observation");
              return scriptedSession.reobserveLockedPhysicalActivationState();
            },
            async returnActivated(handle, slotLedgerToken) {
              lockFixture.assertAllHeldAndCurrent();
              trace.push("fixture.lock-vector:current-before-return-activated");
              return scriptedSession.returnActivated(handle, slotLedgerToken);
            },
            async closeOrAbortSession(disposition) {
              await lockFixture.releaseAll();
              trace.push(`fixture.lock-vector:released:${disposition}`);
              return scriptedSession.closeOrAbortSession(disposition);
            },
          },
        );
        const driver: PlatformReleaseBootstrapRegistryPhysicalActivationMechanicsDriverV2 =
          Object.freeze({
            mechanicsScope:
              PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_MECHANICS_SCOPE_V2,
            contractHash:
              PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_CONTRACT_V2.contractHash,
            backendAbiHash:
              PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_CONTRACT_V2.backendAbiHash,
            async openFreshSession() {
              trace.push("fixture-driver.open:1");
              return fixtureSession;
            },
          });

        const result =
          await runPlatformReleaseBootstrapRegistryPhysicalActivationMechanicsOnlyV2(
            driver,
          );

        assert.equal(result.terminalState, "ACTIVATED");
        assert.equal(result.productionAuthority, false);
        assert.ok(
          trace.indexOf("fixture.lock:shared:held") <
            trace.indexOf("fixture.lock:package:start"),
        );
        assert.ok(
          trace.indexOf("fixture.lock:package:held") <
            trace.indexOf(
              "fixture.lock-vector:current-before-locked-observation",
            ),
        );
        assert.ok(
          trace.indexOf(
            "fixture.lock-vector:current-before-locked-observation",
          ) <
            trace.indexOf(
              "fixture.lock-vector:current-before-return-activated",
            ),
        );
        assert.equal(actionSlotLedgerTokens.length, 1);
        assert.ok(
          trace.includes("fixture.lock-vector:released:close"),
          "the core must close and release the exact real-kernel lock vector",
        );
      } finally {
        await lockFixture.releaseAll().catch(() => undefined);
        await rm(root, { recursive: true, force: true });
      }
    },
  );

  it(
    "drives the full activation transition through fresh reducer-ordered Darwin lock fixtures",
    { skip: process.platform !== "darwin" },
    async () => {
      const root = await mkdtemp(
        path.join(tmpdir(), "setfarm-activation-transition-darwin-lock-v2-"),
      );
      const lockBytes = {
        legacy_node_package_lock: Buffer.from(
          "transition-legacy-lock-v2\n",
          "utf8",
        ),
        shared_parent_lock: Buffer.from(
          "transition-shared-lock-v2\n",
          "utf8",
        ),
        package_lock: Buffer.from("transition-package-lock-v2\n", "utf8"),
      } as const;
      const lockPaths = {
        legacy_node_package_lock: path.join(root, "legacy.lock"),
        shared_parent_lock: path.join(root, "shared.lock"),
        package_lock: path.join(root, "package.lock"),
      } as const;
      await chmod(root, 0o700);
      await Promise.all(
        Object.entries(lockPaths).map(async ([role, lockPath]) => {
          await writeFile(
            lockPath,
            lockBytes[role as keyof typeof lockBytes],
            { mode: 0o600 },
          );
          await chmod(lockPath, 0o600);
        }),
      );
      const expectedOwner = Object.freeze({
        uid: process.getuid!(),
        gid: process.getgid!(),
      });
      const lockBoundary = (role: keyof typeof lockPaths) =>
        Object.freeze({
          parentPath: root,
          lockPath: lockPaths[role],
          lockBytes: lockBytes[role],
          expectedOwner,
          allowedParentModes: Object.freeze([0o700] as const),
        });
      const locks = Object.freeze({
        legacy_node_package_lock: lockBoundary("legacy_node_package_lock"),
        shared_parent_lock: lockBoundary("shared_parent_lock"),
        package_lock: lockBoundary("package_lock"),
      });

      const legacy = baseInput();
      const claimed = withActivationClaim(legacy);
      const shared = withSharedLock(claimed);
      const genesis = withGenesis(shared);
      const receiptWithStage = withActivation(genesis);
      const receiptWithoutStage = withoutTransactionStaging(receiptWithStage);
      const activated = withoutActivationClaim(receiptWithoutStage);
      const roundObservations = [
        legacy,
        claimed,
        shared,
        genesis,
        receiptWithStage,
        receiptWithoutStage,
        activated,
      ] as const;
      const expectedActions = [
        "prepare_and_publish_activation_claim",
        "publish_and_acquire_shared_lock",
        "publish_genesis_epoch_floor",
        "publish_activation_receipt",
        "cleanup_activation_staging",
        "remove_activation_claim",
        "return_activated",
      ] as const;
      const expectedOrders = [
        ["legacy_node_package_lock"],
        ["legacy_node_package_lock", "shared_parent_lock"],
        ["legacy_node_package_lock", "shared_parent_lock"],
        ["legacy_node_package_lock", "shared_parent_lock"],
        ["shared_parent_lock", "legacy_node_package_lock"],
        ["shared_parent_lock", "legacy_node_package_lock"],
        ["shared_parent_lock", "package_lock"],
      ] as const;
      const trace: string[] = [];
      const scriptedDriver = scriptedPhysicalActivationDriverV2(
        roundObservations.map((observation) => ({
          observations: [observation, observation],
        })),
        trace,
      );
      const fixtures: ReturnType<
        typeof createPlatformReleaseBootstrapRegistryDarwinLockFixtureSessionV2
      >[] = [];
      let openIndex = 0;
      const driver: PlatformReleaseBootstrapRegistryPhysicalActivationMechanicsDriverV2 =
        Object.freeze({
          mechanicsScope:
            PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_MECHANICS_SCOPE_V2,
          contractHash:
            PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_CONTRACT_V2.contractHash,
          backendAbiHash:
            PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_CONTRACT_V2.backendAbiHash,
          async openFreshSession() {
            const roundIndex = openIndex;
            openIndex += 1;
            const observation = roundObservations[roundIndex];
            const expectedAction = expectedActions[roundIndex];
            const expectedOrder = expectedOrders[roundIndex];
            assert.ok(observation, "mechanics opened beyond the transition");
            assert.ok(expectedAction, "transition action is missing");
            assert.ok(expectedOrder, "transition lock order is missing");
            const reducedPlan = plan(observation);
            assert.equal(reducedPlan.nextAction, expectedAction);
            assert.deepEqual(reducedPlan.requiredLockOrder, expectedOrder);
            const fixture =
              createPlatformReleaseBootstrapRegistryDarwinLockFixtureSessionV2(
                {
                  acquisitionOrder: reducedPlan.requiredLockOrder,
                  locks,
                },
              );
            fixtures.push(fixture);
            const scriptedSession = await scriptedDriver.openFreshSession();
            const roundLabel = `real-round${roundIndex + 1}`;
            const orderLabel = expectedOrder.join(">");
            trace.push(`${roundLabel}.order:${orderLabel}`);
            const assertActionLockVector = (action: string): void => {
              fixture.assertAllHeldAndCurrent();
              trace.push(`${roundLabel}.action-held:${action}:${orderLabel}`);
            };
            return Object.freeze<PlatformReleaseBootstrapRegistryPhysicalActivationSessionV2>(
              {
                ...scriptedSession,
                async acquireLegacyNodeLock() {
                  trace.push(`${roundLabel}.lock:legacy:start`);
                  await fixture.acquireLegacyNodeLock();
                  trace.push(`${roundLabel}.lock:legacy:held`);
                },
                async acquireSharedParentLock() {
                  trace.push(`${roundLabel}.lock:shared:start`);
                  await fixture.acquireSharedParentLock();
                  trace.push(`${roundLabel}.lock:shared:held`);
                },
                async acquireRegisteredPackageLock() {
                  trace.push(`${roundLabel}.lock:package:start`);
                  await fixture.acquireRegisteredPackageLock();
                  trace.push(`${roundLabel}.lock:package:held`);
                },
                async reobserveLockedPhysicalActivationState() {
                  if (
                    expectedAction !== "publish_and_acquire_shared_lock"
                  ) {
                    fixture.assertAllHeldAndCurrent();
                    trace.push(`${roundLabel}.locked-observation:all-held`);
                  } else {
                    trace.push(
                      `${roundLabel}.locked-observation:shared-deferred`,
                    );
                  }
                  return scriptedSession.reobserveLockedPhysicalActivationState();
                },
                async prepareAndPublishActivationClaim(handle, slotLedger) {
                  assertActionLockVector(handle.nextAction);
                  return scriptedSession.prepareAndPublishActivationClaim(
                    handle,
                    slotLedger,
                  );
                },
                async publishAndAcquireSharedLock(handle, slotLedger) {
                  trace.push(`${roundLabel}.action-shared:start`);
                  await fixture.acquireSharedParentLock();
                  trace.push(`${roundLabel}.action-shared:held`);
                  assertActionLockVector(handle.nextAction);
                  return scriptedSession.publishAndAcquireSharedLock(
                    handle,
                    slotLedger,
                  );
                },
                async publishGenesisEpochFloor(handle, slotLedger) {
                  assertActionLockVector(handle.nextAction);
                  return scriptedSession.publishGenesisEpochFloor(
                    handle,
                    slotLedger,
                  );
                },
                async publishActivationReceipt(handle, slotLedger) {
                  assertActionLockVector(handle.nextAction);
                  trace.push(
                    `${roundLabel}.receipt-published:legacy+shared-held`,
                  );
                  return scriptedSession.publishActivationReceipt(
                    handle,
                    slotLedger,
                  );
                },
                async cleanupActivationStaging(handle, slotLedger) {
                  assertActionLockVector(handle.nextAction);
                  return scriptedSession.cleanupActivationStaging(
                    handle,
                    slotLedger,
                  );
                },
                async removeActivationClaim(handle, slotLedger) {
                  assertActionLockVector(handle.nextAction);
                  return scriptedSession.removeActivationClaim(
                    handle,
                    slotLedger,
                  );
                },
                async returnActivated(handle, slotLedger) {
                  assertActionLockVector(handle.nextAction);
                  return scriptedSession.returnActivated(handle, slotLedger);
                },
                async closeOrAbortSession(disposition) {
                  fixture.assertAllHeldAndCurrent();
                  const reverseReleaseOrder = [...fixture.acquisitionOrder]
                    .reverse()
                    .join(">");
                  assert.equal(
                    reverseReleaseOrder,
                    [...expectedOrder].reverse().join(">"),
                  );
                  trace.push(
                    `${roundLabel}.release-reverse:${reverseReleaseOrder}`,
                  );
                  await fixture.releaseAll();
                  trace.push(`${roundLabel}.released:${disposition}`);
                  return scriptedSession.closeOrAbortSession(disposition);
                },
              },
            );
          },
        });

      try {
        const result =
          await runPlatformReleaseBootstrapRegistryPhysicalActivationMechanicsOnlyV2(
            driver,
          );

        assert.equal(result.terminalState, "ACTIVATED");
        assert.equal(result.productionAuthority, false);
        assert.equal(result.completedRounds, roundObservations.length);
        assert.equal(openIndex, roundObservations.length);
        assert.equal(fixtures.length, roundObservations.length);
        assert.equal(
          new Set(fixtures).size,
          roundObservations.length,
          "each mechanics round must own one fresh real lock fixture",
        );
        assert.ok(
          trace.includes("real-round2.locked-observation:shared-deferred"),
        );
        assert.ok(trace.includes("real-round2.action-shared:held"));
        assert.ok(
          trace.indexOf("real-round2.action-shared:held") <
            trace.indexOf(
              "real-round2.action-held:publish_and_acquire_shared_lock:legacy_node_package_lock>shared_parent_lock",
            ),
        );
        assert.ok(
          trace.includes(
            "real-round4.receipt-published:legacy+shared-held",
          ),
        );
        assert.ok(
          trace.includes(
            "real-round5.action-held:cleanup_activation_staging:shared_parent_lock>legacy_node_package_lock",
          ),
        );
        assert.ok(
          trace.includes(
            "real-round6.action-held:remove_activation_claim:shared_parent_lock>legacy_node_package_lock",
          ),
        );
        assert.ok(
          trace.includes(
            "real-round7.action-held:return_activated:shared_parent_lock>package_lock",
          ),
        );
        expectedOrders.forEach((order, index) => {
          const roundLabel = `real-round${index + 1}`;
          const release = `${roundLabel}.release-reverse:${[...order]
            .reverse()
            .join(">")}`;
          assert.ok(trace.includes(release));
          assert.ok(
            trace.indexOf(
              `${roundLabel}.action-held:${expectedActions[index]}:${order.join(">")}`,
            ) < trace.indexOf(release),
          );
          assert.ok(trace.includes(`${roundLabel}.released:close`));
        });
      } finally {
        await Promise.all(
          fixtures.map((fixture) =>
            fixture.releaseAll().catch(() => undefined),
          ),
        );
        await rm(root, { recursive: true, force: true });
      }
    },
  );

  it("closes lock-vector drift without action and converges in one fresh session", async () => {
    const legacy = baseInput();
    const activated = fullyActivated();
    const trace: string[] = [];
    const driver = scriptedPhysicalActivationDriverV2(
      [
        { observations: [legacy, activated] },
        { observations: [activated, activated] },
      ],
      trace,
    );

    const result =
      await runPlatformReleaseBootstrapRegistryPhysicalActivationMechanicsOnlyV2(
        driver,
      );

    assert.equal(result.completedRounds, 2);
    assert.deepEqual(trace, [
      "driver.open:1",
      "session1.observe:1",
      "session1.lock:legacy",
      "session1.revalidate",
      "session1.observe:2",
      "session1.settle:close",
      "driver.open:2",
      "session2.observe:1",
      "session2.lock:shared",
      "session2.lock:package",
      "session2.revalidate",
      "session2.observe:2",
      "session2.action:returnActivated:return_activated:2",
      "session2.revalidate",
      "session2.settle:close",
    ]);
    assert.equal(
      trace.some((entry) => entry.startsWith("session1.action:")),
      false,
    );
  });

  it("restarts when deferred shared-lock publication changes under the locked reobserve", async () => {
    const claimed = withActivationClaim(baseInput());
    const shared = withSharedLock(claimed);
    assert.equal(plan(claimed).nextAction, "publish_and_acquire_shared_lock");
    assert.equal(plan(shared).nextAction, "publish_genesis_epoch_floor");
    assert.deepEqual(
      plan(claimed).requiredLockOrder,
      plan(shared).requiredLockOrder,
    );
    const activated = fullyActivated();
    const trace: string[] = [];
    const driver = scriptedPhysicalActivationDriverV2(
      [
        { observations: [claimed, shared] },
        { observations: [activated, activated] },
      ],
      trace,
    );

    const result =
      await runPlatformReleaseBootstrapRegistryPhysicalActivationMechanicsOnlyV2(
        driver,
      );

    assert.equal(result.completedRounds, 2);
    assert.deepEqual(trace.slice(0, 6), [
      "driver.open:1",
      "session1.observe:1",
      "session1.lock:legacy",
      "session1.revalidate",
      "session1.observe:2",
      "session1.settle:close",
    ]);
    assert.equal(
      trace.some((entry) => entry.startsWith("session1.action:")),
      false,
    );
    assert.equal(trace.includes("session1.reserve"), false);
    assert.equal(
      trace.includes("session2.action:returnActivated:return_activated:2"),
      true,
    );
  });

  it("stops before a fourth unchanged legacy action after the exact replay bound", async () => {
    const legacy = baseInput();
    const trace: string[] = [];
    const driver = scriptedPhysicalActivationDriverV2(
      Array.from({ length: 4 }, () => ({
        observations: [legacy, legacy],
      })),
      trace,
    );

    await assert.rejects(
      () =>
        runPlatformReleaseBootstrapRegistryPhysicalActivationMechanicsOnlyV2(
          driver,
        ),
      (error: unknown) =>
        error instanceof
          PlatformReleaseBootstrapRegistryPhysicalActivationMechanicsErrorV2 &&
        error.code === "PHYSICAL_ACTIVATION_NO_PROGRESS",
    );
    assert.equal(
      trace.filter((entry) =>
        entry.includes(".action:prepareAndPublishActivationClaim:"),
      ).length,
      3,
    );
    assert.equal(trace.filter((entry) => entry.endsWith(".reserve")).length, 3);
    assert.deepEqual(trace.slice(trace.indexOf("driver.open:4")), [
      "driver.open:4",
      "session4.observe:1",
      "session4.lock:legacy",
      "session4.revalidate",
      "session4.observe:2",
      "session4.settle:close",
    ]);
  });

  it("rejects reused sessions and proxy mechanics drivers", async () => {
    const legacy = baseInput();
    const activated = fullyActivated();
    const reusedTrace: string[] = [];
    const reusedDriver = scriptedPhysicalActivationDriverV2(
      [
        { observations: [legacy, activated] },
        { observations: [activated, activated] },
      ],
      reusedTrace,
      { reuseFirstSession: true },
    );
    await assert.rejects(
      () =>
        runPlatformReleaseBootstrapRegistryPhysicalActivationMechanicsOnlyV2(
          reusedDriver,
        ),
      (error: unknown) =>
        error instanceof
          PlatformReleaseBootstrapRegistryPhysicalActivationMechanicsErrorV2 &&
        error.code === "PHYSICAL_ACTIVATION_DRIVER_INVALID",
    );
    assert.equal(reusedTrace.at(-1), "driver.open:2->session1");

    let proxyReads = 0;
    const proxyDriver = new Proxy(
      {},
      {
        get() {
          proxyReads += 1;
          throw new Error("proxy driver must not be read");
        },
      },
    ) as PlatformReleaseBootstrapRegistryPhysicalActivationMechanicsDriverV2;
    await assert.rejects(
      () =>
        runPlatformReleaseBootstrapRegistryPhysicalActivationMechanicsOnlyV2(
          proxyDriver,
        ),
      (error: unknown) =>
        error instanceof
          PlatformReleaseBootstrapRegistryPhysicalActivationMechanicsErrorV2 &&
        error.code === "PHYSICAL_ACTIVATION_DRIVER_INVALID",
    );
    assert.equal(proxyReads, 0);
  });

  it("rejects one stale locked slot-ledger token before any action", async () => {
    const legacy = baseInput();
    const activated = fullyActivated();
    const staleSlotLedgerToken =
      Object.freeze<PlatformReleaseBootstrapRegistryPhysicalActivationLockedSlotLedgerTokenV2>(
        {
          mechanicsScope:
            PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PHYSICAL_ACTIVATION_MECHANICS_SCOPE_V2,
        },
      );
    const trace: string[] = [];
    const driver = scriptedPhysicalActivationDriverV2(
      [
        {
          observations: [legacy, activated],
          slotLedgerToken: staleSlotLedgerToken,
        },
        {
          observations: [activated, activated],
          slotLedgerToken: staleSlotLedgerToken,
        },
      ],
      trace,
    );

    await assert.rejects(
      () =>
        runPlatformReleaseBootstrapRegistryPhysicalActivationMechanicsOnlyV2(
          driver,
        ),
      (error: unknown) =>
        error instanceof
          PlatformReleaseBootstrapRegistryPhysicalActivationMechanicsErrorV2 &&
        error.code === "PHYSICAL_ACTIVATION_DRIVER_INVALID",
    );
    assert.equal(
      trace.some((entry) => entry.includes(".action:")),
      false,
    );
    assert.deepEqual(trace.slice(trace.indexOf("driver.open:2")), [
      "driver.open:2",
      "session2.observe:1",
      "session2.lock:shared",
      "session2.lock:package",
      "session2.revalidate",
      "session2.observe:2",
      "session2.settle:abort",
    ]);
  });

  it("cannot spoof the private settle-failure brand with an exported error code", async () => {
    const legacy = baseInput();
    const activated = fullyActivated();
    const fakeCloseFailure =
      new PlatformReleaseBootstrapRegistryPhysicalActivationMechanicsErrorV2(
        "PHYSICAL_ACTIVATION_SESSION_CLOSE_FAILED",
        "driver-forged close failure",
      );
    const trace: string[] = [];
    const driver = scriptedPhysicalActivationDriverV2(
      [
        {
          observations: [legacy, legacy],
          actionError: fakeCloseFailure,
        },
        { observations: [activated, activated] },
      ],
      trace,
    );

    const result =
      await runPlatformReleaseBootstrapRegistryPhysicalActivationMechanicsOnlyV2(
        driver,
      );

    assert.equal(result.completedRounds, 2);
    assert.equal(
      trace.includes(
        "session1.action:prepareAndPublishActivationClaim:prepare_and_publish_activation_claim:1",
      ),
      true,
    );
    assert.equal(trace.includes("session1.settle:abort"), true);
    assert.equal(trace.includes("session1.settle:close"), false);
    assert.equal(
      trace.includes("session2.action:returnActivated:return_activated:2"),
      true,
    );
  });

  it("keeps physical activation mechanics source pathless and isolated from production activation", async () => {
    const [typesSource, coreSource, productionActivationSource] =
      await Promise.all([
        readFile(
          new URL(
            "../../src/product-compiler/platform-release-bootstrap-registry-physical-activation-types-v2.ts",
            import.meta.url,
          ),
          "utf8",
        ),
        readFile(
          new URL(
            "../../src/product-compiler/platform-release-bootstrap-registry-physical-activation-core-v2.ts",
            import.meta.url,
          ),
          "utf8",
        ),
        readFile(
          new URL(
            "../../src/product-compiler/platform-release-bootstrap-registry-activation-v2.ts",
            import.meta.url,
          ),
          "utf8",
        ),
      ]);
    const forbiddenMechanicsSource =
      /node:(?:fs|path)|cooperative|callback|generic[\s_-]*execute/i;
    assert.doesNotMatch(typesSource, forbiddenMechanicsSource);
    assert.doesNotMatch(coreSource, forbiddenMechanicsSource);
    assert.doesNotMatch(
      productionActivationSource,
      /platform-release-bootstrap-registry-physical-activation-core-v2/,
    );
  });

  it("keeps production activation zero-input, typed, and physically inert", async () => {
    assert.equal(
      activatePlatformReleaseBootstrapRegistryProductionV2.length,
      0,
    );
    let proxyReads = 0;
    const hostileArgument = new Proxy(
      {},
      {
        get() {
          proxyReads += 1;
          throw new Error("must not inspect");
        },
      },
    );
    assert.throws(
      () =>
        Reflect.apply(
          activatePlatformReleaseBootstrapRegistryProductionV2,
          undefined,
          [hostileArgument],
        ),
      (error) =>
        error instanceof
          PlatformReleaseBootstrapRegistryProductionActivationErrorV2 &&
        error.code ===
          PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_ACTIVATION_PRODUCTION_ERROR_CODE_V2,
    );
    assert.equal(proxyReads, 0);

    const source = await readFile(
      new URL(
        "../../src/product-compiler/platform-release-bootstrap-registry-activation-v2.ts",
        import.meta.url,
      ),
      "utf8",
    );
    assert.doesNotMatch(
      source,
      /node:(?:fs|child_process|net|http|https)|darwin-parent-descriptor-lease|publication-v2/,
    );
  });
});
