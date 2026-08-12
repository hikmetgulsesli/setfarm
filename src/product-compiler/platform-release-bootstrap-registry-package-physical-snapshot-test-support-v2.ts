import { createHash } from "node:crypto";
import { isProxy } from "node:util/types";

import { z } from "zod";

import {
  PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2,
} from "../execution/schemas/platform-release-bootstrap-contract-v2.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_OPERATION_ABI_SET_V2,
  PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2,
  PlatformReleaseBootstrapPackageRefV2Schema,
} from "../execution/schemas/platform-release-bootstrap-operation-abis-v2.js";
import {
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_LOCK_CONTENT_V2,
} from "./schemas/node-toolchain-provisioner-bootstrap-installation-state-v2.js";
import {
  PLATFORM_RELEASE_COMPONENT_VERSION_V2,
  boundedPlatformReleaseJsonSnapshotV2,
  deepFreezePlatformReleaseJsonV2,
  platformReleaseCandidateFitsCanonicalCapV2,
} from "../execution/schemas/platform-release-common-v2.js";
import {
  buildDirectoryMembershipIdentityV2,
  buildPackageLifecyclePhysicalProjectionV2,
  hashPackageLifecyclePhysicalProjectionV2,
  parseNamespacePhysicalCensusCandidateV2,
  PackageLifecyclePhysicalProjectionV2Schema,
  type NamespacePhysicalCensusV2,
  type NamespacePhysicalEntryCaptureV2,
  type PackageLifecyclePhysicalProjectionV2,
} from "./platform-release-bootstrap-physical-census-v2.js";
import {
  canonicalJsonStringify,
  hashCanonicalJson,
} from "./canonical-json.js";
import { Sha256Schema } from "./schemas/common-v1.js";
import {
  derivePlatformReleaseBootstrapDarwinSystemAnchorHashOnlyTestRelationV2,
  PlatformReleaseBootstrapDarwinSystemAnchorHashOnlyTestRelationV2Schema,
  type PlatformReleaseBootstrapDarwinSystemAnchorHashOnlyTestRelationV2,
} from "./platform-release-bootstrap-darwin-system-anchor-relation-test-support-v2.js";

/**
 * This module is deliberately a test-support boundary.  It joins the
 * code-owned package registry and one complete physical census, but it does
 * not open a package, acquire a lock, mutate a registry, or mint a capability.
 */
export const PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PACKAGE_PHYSICAL_SNAPSHOT_TEST_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-registry-package-physical-snapshot-test.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PACKAGE_PHYSICAL_SNAPSHOT_TEST_V2_HASH_SCHEMA =
  "setfarm.platform-release-bootstrap-registry-package-physical-snapshot-test-hash.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PACKAGE_PHYSICAL_SNAPSHOT_TEST_V2_MAX_CANONICAL_BYTES =
  16 * 1024 * 1024;

const PACKAGE_REFS_V2 = Object.freeze([
  PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.hostVerifier,
  PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.nodeToolchainProvisioner,
  PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.platformReleaseComposition,
  PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.runtimeAccountProvisioner,
] as const);
export const PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PACKAGE_PHYSICAL_SNAPSHOT_TEST_V2_PACKAGE_REFS =
  PACKAGE_REFS_V2;

type PackageRefV2 = (typeof PACKAGE_REFS_V2)[number];

const PackageRefsTupleV2Schema = z.tuple([
  z.literal(PACKAGE_REFS_V2[0]),
  z.literal(PACKAGE_REFS_V2[1]),
  z.literal(PACKAGE_REFS_V2[2]),
  z.literal(PACKAGE_REFS_V2[3]),
]);
type PackageRefsTupleV2 = z.infer<typeof PackageRefsTupleV2Schema>;

export type PlatformReleaseBootstrapRegistryPackagePhysicalSnapshotTestSystemAnchorRelationV2 =
  PlatformReleaseBootstrapDarwinSystemAnchorHashOnlyTestRelationV2;

const PackagePhysicalEvidenceV2Schema = z.object({
  packageRef: PlatformReleaseBootstrapPackageRefV2Schema,
  projection: PackageLifecyclePhysicalProjectionV2Schema,
  rootObjectIdentityHash: Sha256Schema,
  rootFingerprintHash: Sha256Schema,
  rootMembershipHash: Sha256Schema,
  packageLockObjectIdentityHash: Sha256Schema,
  packageLockFingerprintHash: Sha256Schema,
  packageLockRawContentHash: Sha256Schema,
}).strict();
type PackageEvidenceV2 = z.infer<typeof PackagePhysicalEvidenceV2Schema>;
type PackageEvidenceTupleV2 = [
  PackageEvidenceV2,
  PackageEvidenceV2,
  PackageEvidenceV2,
  PackageEvidenceV2,
];

const SnapshotIdentityV2Schema = z.object({
  schema: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PACKAGE_PHYSICAL_SNAPSHOT_TEST_V2_SCHEMA,
  ),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  admissionScope: z.literal("test_fixture"),
  authorityState: z.literal("observed_test_fixture_unverified"),
  productionAuthority: z.literal(false),
  productionAdmission: z.literal("forbidden"),
  credentialUse: z.literal("none"),
  signingAuthority: z.literal("unsigned_test_fixture"),
  mutationAuthority: z.literal(false),
  trustConclusion: z.literal("characterization_only"),
  registryContractHash: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.contractHash,
  ),
  operationAbiSetHash: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_OPERATION_ABI_SET_V2.abiSetHash,
  ),
  packageCount: z.literal(PACKAGE_REFS_V2.length),
  packageRefs: PackageRefsTupleV2Schema,
  packageEvidence: z.tuple([
    PackagePhysicalEvidenceV2Schema,
    PackagePhysicalEvidenceV2Schema,
    PackagePhysicalEvidenceV2Schema,
    PackagePhysicalEvidenceV2Schema,
  ]),
  filesystemScopeIdentityHash: Sha256Schema,
  sourceLogicalCensusHash: Sha256Schema,
  sourcePhysicalCensusHash: Sha256Schema,
  systemAnchorRelation:
    PlatformReleaseBootstrapDarwinSystemAnchorHashOnlyTestRelationV2Schema
      .nullable(),
}).strict();

export type PlatformReleaseBootstrapRegistryPackagePhysicalSnapshotTestIdentityV2 =
  z.infer<typeof SnapshotIdentityV2Schema>;

export const PlatformReleaseBootstrapRegistryPackagePhysicalSnapshotTestV2Schema =
  SnapshotIdentityV2Schema.extend({
    snapshotHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const { snapshotHash: _snapshotHash, ...identity } = value;
    try {
      validateIdentityV2(identity);
    } catch (error) {
      context.addIssue({
        code: "custom",
        message: error instanceof Error
          ? error.message
          : "Package physical snapshot identity relations are invalid",
      });
    }
    if (
      value.snapshotHash
        !== hashPlatformReleaseBootstrapRegistryPackagePhysicalSnapshotTestV2(
          identity,
        )
    ) {
      context.addIssue({
        code: "custom",
        path: ["snapshotHash"],
        message: "Package physical snapshot hash mismatch",
      });
    }
  });

export type PlatformReleaseBootstrapRegistryPackagePhysicalSnapshotTestV2 =
  z.infer<
    typeof PlatformReleaseBootstrapRegistryPackagePhysicalSnapshotTestV2Schema
  >;

export type PlatformReleaseBootstrapRegistryPackagePhysicalSnapshotTestInputV2 = Readonly<{
  physicalCensus: NamespacePhysicalCensusV2;
  packageRefs: readonly string[];
  systemAnchorObservation?: unknown | null;
}>;

export type PlatformReleaseBootstrapRegistryPackagePhysicalSnapshotTestErrorCodeV2 =
  | "REGISTRY_PACKAGE_PHYSICAL_SNAPSHOT_INPUT_INVALID"
  | "REGISTRY_PACKAGE_PHYSICAL_SNAPSHOT_PACKAGE_SET_INVALID"
  | "REGISTRY_PACKAGE_PHYSICAL_SNAPSHOT_PROJECTION_INVALID"
  | "REGISTRY_PACKAGE_PHYSICAL_SNAPSHOT_SYSTEM_ANCHOR_INVALID"
  | "REGISTRY_PACKAGE_PHYSICAL_SNAPSHOT_SERIALIZATION_INVALID";

export class PlatformReleaseBootstrapRegistryPackagePhysicalSnapshotTestErrorV2
  extends TypeError {
  constructor(
    readonly code:
      PlatformReleaseBootstrapRegistryPackagePhysicalSnapshotTestErrorCodeV2,
    message: string,
    options: ErrorOptions = {},
  ) {
    super(message.slice(0, 1_500), options);
    this.name =
      "PlatformReleaseBootstrapRegistryPackagePhysicalSnapshotTestErrorV2";
  }
}

function failV2(
  code: PlatformReleaseBootstrapRegistryPackagePhysicalSnapshotTestErrorCodeV2,
  message: string,
  cause?: unknown,
): never {
  throw new PlatformReleaseBootstrapRegistryPackagePhysicalSnapshotTestErrorV2(
    code,
    message,
    cause === undefined ? {} : { cause },
  );
}

function isPlainRecordV2(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object"
    && value !== null
    && !Array.isArray(value)
    && !isProxy(value)
    && Object.getPrototypeOf(value) === Object.prototype
  );
}

function assertPlainRecordV2(
  value: unknown,
  label: string,
): asserts value is Record<string, unknown> {
  if (!isPlainRecordV2(value)) {
    failV2(
      "REGISTRY_PACKAGE_PHYSICAL_SNAPSHOT_INPUT_INVALID",
      `${label} must be one non-proxy plain record`,
    );
  }
}

function assertNoProxyV2(value: unknown, label: string): void {
  if (typeof value === "object" && value !== null && isProxy(value)) {
    failV2(
      "REGISTRY_PACKAGE_PHYSICAL_SNAPSHOT_INPUT_INVALID",
      `${label} must not be a proxy`,
    );
  }
}

function expectedPackageLockRawContentV2(packageRef: PackageRefV2): string {
  return packageRef === PACKAGE_REFS_V2[1]
    ? NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_LOCK_CONTENT_V2
    : [
        "setfarm.bootstrap-package-installation-lock.v2",
        `registryContractHash=${PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.contractHash}`,
        `packageRef=${packageRef}`,
        "",
      ].join("\n");
}

function expectedPackageLockRawContentHashV2(packageRef: PackageRefV2): string {
  const content = expectedPackageLockRawContentV2(packageRef);
  return createHash("sha256").update(content, "utf8").digest("hex");
}

function packageContractV2(packageRef: PackageRefV2) {
  const packageContract = PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.packages.find(
    (entry) => entry.packageRef === packageRef,
  );
  if (packageContract === undefined) {
    return failV2(
      "REGISTRY_PACKAGE_PHYSICAL_SNAPSHOT_PROJECTION_INVALID",
      `Code-owned package contract is missing ${packageRef}`,
    );
  }
  return packageContract;
}

function expectedRootMembershipV2(packageRef: PackageRefV2) {
  const packageContract = packageContractV2(packageRef);
  const rootDirectory = packageContract.directories.find(
    (entry) => entry.relativeLocator === ".",
  );
  if (
    rootDirectory === undefined
    || rootDirectory.orderedEntryRefs.length
      !== rootDirectory.orderedEntryBasenames.length
  ) {
    return failV2(
      "REGISTRY_PACKAGE_PHYSICAL_SNAPSHOT_PROJECTION_INVALID",
      `Package ${packageRef} has no exact root directory contract`,
    );
  }
  const directoryRefs = new Set(
    packageContract.directories.map((entry) => entry.directoryRef),
  );
  const orderedEntries = rootDirectory.orderedEntryRefs.map((memberRef, index) => ({
    basename: rootDirectory.orderedEntryBasenames[index]!,
    objectKind: directoryRefs.has(memberRef)
      ? "directory" as const
      : "ordinary_file" as const,
  })).sort((left, right) =>
    left.basename < right.basename ? -1 : left.basename > right.basename ? 1 : 0);
  return buildDirectoryMembershipIdentityV2({ orderedEntries });
}

function exactCaptureV2(
  projection: PackageLifecyclePhysicalProjectionV2,
  category: "package_root" | "package_lock",
): NamespacePhysicalEntryCaptureV2 {
  const captures = projection.orderedEntryCaptures.filter(
    (capture) => capture.classification.category === category,
  );
  if (captures.length !== 1) {
    return failV2(
      "REGISTRY_PACKAGE_PHYSICAL_SNAPSHOT_PROJECTION_INVALID",
      `${projection.packageRef} projection must contain exactly one ${category}`,
    );
  }
  return captures[0]!;
}

function validateProjectionV2(
  projection: PackageLifecyclePhysicalProjectionV2,
): Readonly<{
  packageRef: PackageRefV2;
  projection: PackageLifecyclePhysicalProjectionV2;
  rootObjectIdentityHash: string;
  rootFingerprintHash: string;
  rootMembershipHash: string;
  packageLockObjectIdentityHash: string;
  packageLockFingerprintHash: string;
  packageLockRawContentHash: string;
}> {
  const packageRef = PlatformReleaseBootstrapPackageRefV2Schema.parse(
    projection.packageRef,
  ) as PackageRefV2;
  const packageContract = packageContractV2(packageRef);
  const root = exactCaptureV2(projection, "package_root");
  const lock = exactCaptureV2(projection, "package_lock");
  const expectedMembership = expectedRootMembershipV2(packageRef);
  if (
    root.classification.basename !== packageContract.rootBasename
    || root.objectIdentity.objectKind !== "directory"
    || root.fingerprint.ownerUid !== packageContract.productionOwnerUid
    || root.fingerprint.ownerGid !== packageContract.productionOwnerGid
    || root.fingerprint.mode !== packageContract.rootMode
    || root.contentEvidence.kind !== "directory_membership"
    || canonicalJsonStringify(root.contentEvidence.membership)
      !== canonicalJsonStringify(expectedMembership)
  ) {
    return failV2(
      "REGISTRY_PACKAGE_PHYSICAL_SNAPSHOT_PROJECTION_INVALID",
      `${packageRef} package root is not the exact code-owned root capture`,
    );
  }
  const expectedLockHash = expectedPackageLockRawContentHashV2(packageRef);
  const expectedLockByteLength = Buffer.byteLength(
    expectedPackageLockRawContentV2(packageRef),
    "utf8",
  );
  if (
    lock.classification.basename !== packageContract.lifecycle.packageLockBasename
    || lock.objectIdentity.objectKind !== "ordinary_file"
    || lock.fingerprint.ownerUid !== packageContract.productionOwnerUid
    || lock.fingerprint.ownerGid !== packageContract.productionOwnerGid
    || lock.fingerprint.mode !== "0600"
    || lock.fingerprint.linkCount !== 1
    || lock.fingerprint.byteLength !== expectedLockByteLength
    || lock.contentEvidence.kind !== "bounded_regular_file_bytes"
    || lock.contentEvidence.rawContentHash !== expectedLockHash
  ) {
    return failV2(
      "REGISTRY_PACKAGE_PHYSICAL_SNAPSHOT_PROJECTION_INVALID",
      `${packageRef} package lock is not the exact code-owned lock capture`,
    );
  }
  return Object.freeze({
    packageRef,
    projection,
    rootObjectIdentityHash: root.objectIdentity.objectIdentityHash,
    rootFingerprintHash: root.fingerprint.fingerprintHash,
    rootMembershipHash:
      root.contentEvidence.kind === "directory_membership"
        ? root.contentEvidence.membership.membershipHash
        : "",
    packageLockObjectIdentityHash: lock.objectIdentity.objectIdentityHash,
    packageLockFingerprintHash: lock.fingerprint.fingerprintHash,
    packageLockRawContentHash:
      lock.contentEvidence.kind === "bounded_regular_file_bytes"
        ? lock.contentEvidence.rawContentHash
        : "",
  });
}

function validateIdentityV2(
  value: PlatformReleaseBootstrapRegistryPackagePhysicalSnapshotTestIdentityV2,
): void {
  if (
    canonicalJsonStringify(value.packageRefs)
      !== canonicalJsonStringify(PACKAGE_REFS_V2)
    || value.packageEvidence.length !== PACKAGE_REFS_V2.length
    || value.packageEvidence.some(
      (evidence, index) => evidence.packageRef !== PACKAGE_REFS_V2[index],
    )
  ) {
    failV2(
      "REGISTRY_PACKAGE_PHYSICAL_SNAPSHOT_PACKAGE_SET_INVALID",
      "Package refs must equal the exact ordered V/R/N/A registry package set",
    );
  }
  const physicalLocatorKeys = new Set<string>();
  const parentIdentityHashes = new Set<string>();
  for (const evidence of value.packageEvidence) {
    const projection = evidence.projection;
    if (
      projection.packageRef !== evidence.packageRef
      || projection.sourceLogicalCensusHash !== value.sourceLogicalCensusHash
      || projection.sourcePhysicalCensusHash !== value.sourcePhysicalCensusHash
      || projection.projectionHash !== hashPackageLifecyclePhysicalProjectionV2(
        projection,
      )
    ) {
      failV2(
        "REGISTRY_PACKAGE_PHYSICAL_SNAPSHOT_PROJECTION_INVALID",
        "Package evidence must retain each exact self-hashed source-bound lifecycle projection",
      );
    }
    if (projection.orderedEntryCaptures.some((capture) =>
      capture.objectIdentity.filesystemScopeIdentityHash
        !== value.filesystemScopeIdentityHash)) {
      failV2(
        "REGISTRY_PACKAGE_PHYSICAL_SNAPSHOT_PROJECTION_INVALID",
        "Every package capture must join the top-level filesystem scope identity",
      );
    }
    for (const capture of projection.orderedEntryCaptures) {
      const stable = capture.objectIdentity;
      const locatorKey = [
        stable.filesystemScopeIdentityHash,
        stable.objectKind,
        stable.device,
        stable.inode,
      ].join(":");
      if (physicalLocatorKeys.has(locatorKey)) {
        failV2(
          "REGISTRY_PACKAGE_PHYSICAL_SNAPSHOT_PROJECTION_INVALID",
          "Package projections must not alias one physical census object",
        );
      }
      physicalLocatorKeys.add(locatorKey);
      parentIdentityHashes.add(capture.parentObjectIdentityHash);
    }
    const expectedEvidence = validateProjectionV2(projection);
    if (canonicalJsonStringify(expectedEvidence) !== canonicalJsonStringify(evidence)) {
      failV2(
        "REGISTRY_PACKAGE_PHYSICAL_SNAPSHOT_PROJECTION_INVALID",
        `Package ${evidence.packageRef} evidence fields do not join its projection`,
      );
    }
  }
  if (parentIdentityHashes.size !== 1) {
    failV2(
      "REGISTRY_PACKAGE_PHYSICAL_SNAPSHOT_PROJECTION_INVALID",
      "Every package projection must join one physical census parent identity",
    );
  }
}

export function hashPlatformReleaseBootstrapRegistryPackagePhysicalSnapshotTestV2(
  value: PlatformReleaseBootstrapRegistryPackagePhysicalSnapshotTestIdentityV2,
): string {
  return hashCanonicalJson({
    schema:
      PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PACKAGE_PHYSICAL_SNAPSHOT_TEST_V2_HASH_SCHEMA,
    snapshot: value,
  });
}

export function parsePlatformReleaseBootstrapRegistryPackagePhysicalSnapshotTestCandidateV2(
  input: unknown,
): PlatformReleaseBootstrapRegistryPackagePhysicalSnapshotTestV2 {
  assertNoProxyV2(input, "Serialized package snapshot");
  try {
    const snapshot = boundedPlatformReleaseJsonSnapshotV2(
      input,
      PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PACKAGE_PHYSICAL_SNAPSHOT_TEST_V2_MAX_CANONICAL_BYTES,
    );
    const parsed =
      PlatformReleaseBootstrapRegistryPackagePhysicalSnapshotTestV2Schema.parse(
        snapshot,
      );
    const { snapshotHash: _snapshotHash, ...identity } = parsed;
    validateIdentityV2(identity);
    if (
      parsed.snapshotHash
        !== hashPlatformReleaseBootstrapRegistryPackagePhysicalSnapshotTestV2(
          identity,
        )
    ) {
      return failV2(
        "REGISTRY_PACKAGE_PHYSICAL_SNAPSHOT_SERIALIZATION_INVALID",
        "Package physical snapshot hash mismatch",
      );
    }
    return deepFreezePlatformReleaseJsonV2(parsed);
  } catch (error) {
    if (
      error
        instanceof PlatformReleaseBootstrapRegistryPackagePhysicalSnapshotTestErrorV2
    ) {
      throw error;
    }
    return failV2(
      "REGISTRY_PACKAGE_PHYSICAL_SNAPSHOT_SERIALIZATION_INVALID",
      "Package physical snapshot serialization is invalid",
      error,
    );
  }
}

export function buildPlatformReleaseBootstrapRegistryPackagePhysicalSnapshotTestV2(
  input: PlatformReleaseBootstrapRegistryPackagePhysicalSnapshotTestInputV2,
): PlatformReleaseBootstrapRegistryPackagePhysicalSnapshotTestV2 {
  let candidateInput: Record<string, unknown>;
  try {
    const boundedInput = boundedPlatformReleaseJsonSnapshotV2(
      input,
      PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PACKAGE_PHYSICAL_SNAPSHOT_TEST_V2_MAX_CANONICAL_BYTES,
    );
    assertPlainRecordV2(boundedInput, "Snapshot input");
    candidateInput = boundedInput;
  } catch (error) {
    if (
      error
        instanceof PlatformReleaseBootstrapRegistryPackagePhysicalSnapshotTestErrorV2
    ) {
      throw error;
    }
    return failV2(
      "REGISTRY_PACKAGE_PHYSICAL_SNAPSHOT_INPUT_INVALID",
      "Snapshot input is not one bounded plain JSON record",
      error,
    );
  }
  const keys = Object.keys(candidateInput).sort();
  if (
    keys.some((key) =>
      key !== "packageRefs"
      && key !== "physicalCensus"
      && key !== "systemAnchorObservation")
  ) {
    return failV2(
      "REGISTRY_PACKAGE_PHYSICAL_SNAPSHOT_INPUT_INVALID",
      "Snapshot input contains an unknown field",
    );
  }
  assertNoProxyV2(candidateInput.packageRefs, "Package refs");
  assertNoProxyV2(candidateInput.physicalCensus, "Physical census");
  assertNoProxyV2(
    candidateInput.systemAnchorObservation,
    "System-anchor observation",
  );
  if (!Array.isArray(candidateInput.packageRefs)) {
    return failV2(
      "REGISTRY_PACKAGE_PHYSICAL_SNAPSHOT_PACKAGE_SET_INVALID",
      "Package refs must be one exact ordered array",
    );
  }
  let packageRefs: PackageRefsTupleV2;
  try {
    packageRefs = PackageRefsTupleV2Schema.parse(
      boundedPlatformReleaseJsonSnapshotV2(candidateInput.packageRefs, 4 * 1024),
    );
  } catch (error) {
    return failV2(
      "REGISTRY_PACKAGE_PHYSICAL_SNAPSHOT_PACKAGE_SET_INVALID",
      "Package refs are not the exact four registered package refs",
      error,
    );
  }
  if (canonicalJsonStringify(packageRefs) !== canonicalJsonStringify(PACKAGE_REFS_V2)) {
    return failV2(
      "REGISTRY_PACKAGE_PHYSICAL_SNAPSHOT_PACKAGE_SET_INVALID",
      "Package refs are reordered or duplicated",
    );
  }
  let physicalCensus: NamespacePhysicalCensusV2;
  try {
    physicalCensus = parseNamespacePhysicalCensusCandidateV2(
      candidateInput.physicalCensus,
    );
  } catch (error) {
    return failV2(
      "REGISTRY_PACKAGE_PHYSICAL_SNAPSHOT_INPUT_INVALID",
      "Physical census is not one complete self-hashed census",
      error,
    );
  }
  if (
    physicalCensus.parentFingerprint.ownerUid !== 0
    || physicalCensus.parentFingerprint.ownerGid !== 0
    || physicalCensus.parentFingerprint.mode !== "0755"
  ) {
    return failV2(
      "REGISTRY_PACKAGE_PHYSICAL_SNAPSHOT_PROJECTION_INVALID",
      "Bootstrap parent fingerprint is not the exact root-owned 0755 boundary",
    );
  }
  let systemAnchorRelation:
    PlatformReleaseBootstrapRegistryPackagePhysicalSnapshotTestSystemAnchorRelationV2
    | null = null;
  if (
    candidateInput.systemAnchorObservation !== undefined
    && candidateInput.systemAnchorObservation !== null
  ) {
    try {
      systemAnchorRelation =
        derivePlatformReleaseBootstrapDarwinSystemAnchorHashOnlyTestRelationV2(
          candidateInput.systemAnchorObservation,
        );
    } catch (error) {
      return failV2(
        "REGISTRY_PACKAGE_PHYSICAL_SNAPSHOT_SYSTEM_ANCHOR_INVALID",
        "Optional system-anchor observation must be one parsed false-authority test observation",
        error,
      );
    }
  }
  const deriveEvidence = (packageRef: PackageRefV2): PackageEvidenceV2 => {
    try {
      return validateProjectionV2(
        buildPackageLifecyclePhysicalProjectionV2(physicalCensus, packageRef),
      );
    } catch (error) {
      if (
        error
          instanceof PlatformReleaseBootstrapRegistryPackagePhysicalSnapshotTestErrorV2
      ) {
        throw error;
      }
      return failV2(
        "REGISTRY_PACKAGE_PHYSICAL_SNAPSHOT_PROJECTION_INVALID",
        `Package ${packageRef} projection could not be derived from the same census`,
        error,
      );
    }
  };
  const packageEvidence = [
    deriveEvidence(packageRefs[0]),
    deriveEvidence(packageRefs[1]),
    deriveEvidence(packageRefs[2]),
    deriveEvidence(packageRefs[3]),
  ] as PackageEvidenceTupleV2;
  const identity = {
    schema:
      PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PACKAGE_PHYSICAL_SNAPSHOT_TEST_V2_SCHEMA,
    version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
    admissionScope: "test_fixture" as const,
    authorityState: "observed_test_fixture_unverified" as const,
    productionAuthority: false as const,
    productionAdmission: "forbidden" as const,
    credentialUse: "none" as const,
    signingAuthority: "unsigned_test_fixture" as const,
    mutationAuthority: false as const,
    trustConclusion: "characterization_only" as const,
    registryContractHash: PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.contractHash,
    operationAbiSetHash: PLATFORM_RELEASE_BOOTSTRAP_OPERATION_ABI_SET_V2.abiSetHash,
    packageCount: 4 as const,
    packageRefs,
    packageEvidence,
    filesystemScopeIdentityHash: physicalCensus.filesystemScopeIdentityHash,
    sourceLogicalCensusHash: physicalCensus.logicalCensus.censusHash,
    sourcePhysicalCensusHash: physicalCensus.physicalCensusHash,
    systemAnchorRelation,
  } satisfies PlatformReleaseBootstrapRegistryPackagePhysicalSnapshotTestIdentityV2;
  if (
    !platformReleaseCandidateFitsCanonicalCapV2(
      identity,
      PLATFORM_RELEASE_BOOTSTRAP_REGISTRY_PACKAGE_PHYSICAL_SNAPSHOT_TEST_V2_MAX_CANONICAL_BYTES,
    )
  ) {
    return failV2(
      "REGISTRY_PACKAGE_PHYSICAL_SNAPSHOT_SERIALIZATION_INVALID",
      "Package physical snapshot exceeds its fixed canonical byte cap",
    );
  }
  return parsePlatformReleaseBootstrapRegistryPackagePhysicalSnapshotTestCandidateV2({
    ...identity,
    snapshotHash:
      hashPlatformReleaseBootstrapRegistryPackagePhysicalSnapshotTestV2(identity),
  });
}
