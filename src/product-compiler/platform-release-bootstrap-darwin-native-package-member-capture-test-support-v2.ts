import { isProxy } from "node:util/types";

import { z } from "zod";

import {
  PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2,
  PLATFORM_RELEASE_HOST_VERIFIER_EXECUTABLE_LOCATOR_V2,
  PLATFORM_RELEASE_HOST_VERIFIER_MANIFEST_LOCATOR_V2,
} from "../execution/schemas/platform-release-bootstrap-contract-v2.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2,
} from "../execution/schemas/platform-release-bootstrap-operation-abis-v2.js";
import {
  PLATFORM_RELEASE_COMPONENT_VERSION_V2,
  boundedPlatformReleaseJsonSnapshotV2,
  deepFreezePlatformReleaseJsonV2,
  platformReleaseCandidateFitsCanonicalCapV2,
} from "../execution/schemas/platform-release-common-v2.js";
import {
  selectPlatformReleaseBootstrapDarwinNativeDistributionEntryMechanicsV2,
  type PlatformReleaseBootstrapDarwinNativeDistributionSelectionV2,
  type PlatformReleaseBootstrapDarwinNativeDistributionVerificationReceiptV2,
} from "../execution/schemas/platform-release-bootstrap-darwin-native-distribution-v2.js";
import { Sha256Schema } from "./schemas/common-v1.js";
import { canonicalJsonStringify, hashCanonicalJson } from "./canonical-json.js";
import {
  DirectoryMembershipIdentityV2Schema,
  FsObservationFingerprintV2Schema,
  StableFsObjectIdentityV2Schema,
  buildDirectoryMembershipIdentityV2,
  type FsObservationFingerprintV2,
  type NamespacePhysicalEntryCaptureV2,
  type StableFsObjectIdentityV2,
} from "./platform-release-bootstrap-physical-census-v2.js";
import {
  hashPlatformReleaseBootstrapFilesystemScopePublicationEvidenceTestV2,
  parsePlatformReleaseBootstrapFilesystemScopePublicationEvidenceTestCandidateV2,
  type PlatformReleaseBootstrapFilesystemScopePublicationEvidenceTestV2,
} from "./platform-release-bootstrap-filesystem-scope-rejoin-test-support-v2.js";
import {
  parsePlatformReleaseBootstrapRegistryPackagePhysicalSnapshotTestCandidateV2,
  type PlatformReleaseBootstrapRegistryPackagePhysicalSnapshotTestV2,
} from "./platform-release-bootstrap-registry-package-physical-snapshot-test-support-v2.js";

/**
 * Test-only V member evidence. This mapper never opens a package, performs an
 * AMFI check, issues a capability, or imports a production opener. The native
 * selector is called with the original ephemeral mechanics receipt so its
 * WeakMap authenticity cannot be laundered through JSON cloning.
 */
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_PACKAGE_MEMBER_CAPTURE_TEST_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-darwin-native-package-member-capture-test.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_PACKAGE_MEMBER_CAPTURE_TEST_V2_HASH_SCHEMA =
  "setfarm.platform-release-bootstrap-darwin-native-package-member-capture-test-hash.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_PACKAGE_MEMBER_CAPTURE_TEST_V2_OBSERVATION_HASH_SCHEMA =
  "setfarm.platform-release-bootstrap-darwin-native-package-member-capture-test-observation-hash.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_PACKAGE_MEMBER_CAPTURE_TEST_V2_MAX_CANONICAL_BYTES =
  16 * 1024 * 1024;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_PACKAGE_MEMBER_CAPTURE_TEST_V2_MAX_MEMBER_BYTES =
  64 * 1024 * 1024;

const ContentEvidenceV2Schema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("directory_membership"),
    membership: DirectoryMembershipIdentityV2Schema,
  }).strict(),
  z.object({
    kind: z.literal("bounded_regular_file_bytes"),
    rawContentHash: Sha256Schema,
  }).strict(),
]);

const MemberCaptureV2Schema = z.object({
  basename: z.string()
    .min(1)
    .max(255)
    .regex(/^[^/]+$/, "Expected one canonical direct-child basename"),
  objectIdentity: StableFsObjectIdentityV2Schema,
  fingerprint: FsObservationFingerprintV2Schema,
  parentObjectIdentity: StableFsObjectIdentityV2Schema,
  contentEvidence: ContentEvidenceV2Schema,
}).strict();

const MemberCapturesV2Schema = z.object({
  binDirectory: MemberCaptureV2Schema,
  manifest: MemberCaptureV2Schema,
  executable: MemberCaptureV2Schema,
}).strict();

export type PlatformReleaseBootstrapDarwinNativePackageMemberCaptureTestV2 =
  z.infer<typeof MemberCapturesV2Schema>;

const RelationIdentityV2Schema = z.object({
  schema: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_PACKAGE_MEMBER_CAPTURE_TEST_V2_SCHEMA,
  ),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  admissionScope: z.literal("test_fixture"),
  authorityState: z.literal("caller_supplied_test_mechanics_only"),
  productionAuthority: z.literal(false),
  productionAdmission: z.literal("forbidden"),
  credentialUse: z.literal("none"),
  signingAuthority: z.literal("unsigned_test_fixture"),
  mutationAuthority: z.literal(false),
  trustConclusion: z.literal("characterization_only"),
  packageSnapshotHash: Sha256Schema,
  filesystemScopeIdentityHash: Sha256Schema,
  scopePublicationObservationHash: Sha256Schema,
  verificationReceiptHash: Sha256Schema,
  selectionHash: Sha256Schema,
  rootObjectIdentityHash: Sha256Schema,
  binDirectoryObjectIdentityHash: Sha256Schema,
  manifestObjectIdentityHash: Sha256Schema,
  executableObjectIdentityHash: Sha256Schema,
  memberCaptureObservationHash: Sha256Schema,
}).strict();

export type PlatformReleaseBootstrapDarwinNativePackageMemberCaptureTestIdentityV2 =
  z.infer<typeof RelationIdentityV2Schema>;

export const PlatformReleaseBootstrapDarwinNativePackageMemberCaptureTestV2Schema =
  RelationIdentityV2Schema.extend({
    observationHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (
      !platformReleaseCandidateFitsCanonicalCapV2(
        value,
        PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_PACKAGE_MEMBER_CAPTURE_TEST_V2_MAX_CANONICAL_BYTES,
      )
    ) {
      context.addIssue({
        code: "custom",
        message: "Native package member relation exceeds its byte cap",
      });
    }
    const { observationHash: _observationHash, ...identity } = value;
    if (
      value.observationHash
        !== hashPlatformReleaseBootstrapDarwinNativePackageMemberCaptureTestV2(identity)
    ) {
      context.addIssue({
        code: "custom",
        path: ["observationHash"],
        message: "Native package member relation observation hash mismatch",
      });
    }
  });

export type PlatformReleaseBootstrapDarwinNativePackageMemberCaptureRelationV2 =
  z.infer<
    typeof PlatformReleaseBootstrapDarwinNativePackageMemberCaptureTestV2Schema
  >;

export type PlatformReleaseBootstrapDarwinNativePackageMemberCaptureTestInputV2 =
  Readonly<{
    packageSnapshot: unknown;
    scopePublicationEvidence: unknown;
    verificationReceipt: unknown;
    selectionInput: unknown;
    memberCaptures: unknown;
  }>;

export type PlatformReleaseBootstrapDarwinNativePackageMemberCaptureTestErrorCodeV2 =
  | "NATIVE_PACKAGE_MEMBER_CAPTURE_INPUT_INVALID"
  | "NATIVE_PACKAGE_MEMBER_CAPTURE_SNAPSHOT_INVALID"
  | "NATIVE_PACKAGE_MEMBER_CAPTURE_SCOPE_INVALID"
  | "NATIVE_PACKAGE_MEMBER_CAPTURE_SELECTION_INVALID"
  | "NATIVE_PACKAGE_MEMBER_CAPTURE_PHYSICAL_INVALID"
  | "NATIVE_PACKAGE_MEMBER_CAPTURE_SERIALIZATION_INVALID";

export class PlatformReleaseBootstrapDarwinNativePackageMemberCaptureTestErrorV2
  extends TypeError {
  constructor(
    readonly code:
      PlatformReleaseBootstrapDarwinNativePackageMemberCaptureTestErrorCodeV2,
    message: string,
    options: ErrorOptions = {},
  ) {
    super(message.slice(0, 1_500), options);
    this.name =
      "PlatformReleaseBootstrapDarwinNativePackageMemberCaptureTestErrorV2";
  }
}

function failV2(
  code: PlatformReleaseBootstrapDarwinNativePackageMemberCaptureTestErrorCodeV2,
  message: string,
  cause?: unknown,
): never {
  throw new PlatformReleaseBootstrapDarwinNativePackageMemberCaptureTestErrorV2(
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

function assertInputRecordV2(
  input: unknown,
): asserts input is Record<string, unknown> {
  if (!isPlainRecordV2(input)) {
    return failV2(
      "NATIVE_PACKAGE_MEMBER_CAPTURE_INPUT_INVALID",
      "Native package member input must be one non-proxy plain record",
    );
  }
  const keys = Reflect.ownKeys(input);
  for (const key of keys) {
    if (typeof key !== "string") {
      return failV2(
        "NATIVE_PACKAGE_MEMBER_CAPTURE_INPUT_INVALID",
        "Native package member input cannot contain symbol keys",
      );
    }
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
      return failV2(
        "NATIVE_PACKAGE_MEMBER_CAPTURE_INPUT_INVALID",
        "Native package member input cannot contain accessor or hidden fields",
      );
    }
  }
}

function assertNotProxyV2(value: unknown, label: string): void {
  if (typeof value === "object" && value !== null && isProxy(value)) {
    return failV2(
      "NATIVE_PACKAGE_MEMBER_CAPTURE_INPUT_INVALID",
      `${label} must not be a proxy`,
    );
  }
}

function locatorKeyV2(identity: StableFsObjectIdentityV2): string {
  return [
    identity.filesystemScopeIdentityHash,
    identity.device,
    identity.inode,
  ].join(":");
}

function sameJsonV2(left: unknown, right: unknown): boolean {
  return canonicalJsonStringify(left) === canonicalJsonStringify(right);
}

function expectedRootMembershipV2() {
  const packageContract = PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.packages.find(
    (entry) => entry.packageRef === PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.hostVerifier,
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

function expectedBinMembershipV2() {
  return buildDirectoryMembershipIdentityV2({
    orderedEntries: [{
      basename: PLATFORM_RELEASE_HOST_VERIFIER_EXECUTABLE_LOCATOR_V2
        .split("/").at(-1)!,
      objectKind: "ordinary_file",
    }],
  });
}

function hostRootCaptureV2(
  snapshot: PlatformReleaseBootstrapRegistryPackagePhysicalSnapshotTestV2,
): NamespacePhysicalEntryCaptureV2 {
  const hostEvidence = snapshot.packageEvidence.find(
    (entry) => entry.packageRef === PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.hostVerifier,
  );
  const root = hostEvidence?.projection.orderedEntryCaptures.find(
    (capture) => capture.classification.category === "package_root",
  );
  if (!root) {
    return failV2(
      "NATIVE_PACKAGE_MEMBER_CAPTURE_SNAPSHOT_INVALID",
      "Host-verifier package snapshot has no exact root capture",
    );
  }
  return root;
}

function validateCaptureShapeV2(
  captures: PlatformReleaseBootstrapDarwinNativePackageMemberCaptureTestV2,
  selection: PlatformReleaseBootstrapDarwinNativeDistributionSelectionV2,
  snapshot: PlatformReleaseBootstrapRegistryPackagePhysicalSnapshotTestV2,
  publication: PlatformReleaseBootstrapFilesystemScopePublicationEvidenceTestV2,
): Readonly<{
  root: NamespacePhysicalEntryCaptureV2;
  binDirectory: MemberCaptureV2;
  manifest: MemberCaptureV2;
  executable: MemberCaptureV2;
}> {
  const root = hostRootCaptureV2(snapshot);
  const scopeHash = publication.filesystemScope.scopeIdentityHash;
  if (
    selection.providerPackageRef !== PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.hostVerifier
    || selection.providerMemberRef !== "BOOTSTRAP_HOST_VERIFIER_EXECUTABLE_V2"
    || selection.registryContractHash !== PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.contractHash
    || root.objectIdentity.filesystemScopeIdentityHash !== scopeHash
    || root.objectIdentity.objectKind !== "directory"
    || root.fingerprint.ownerUid !== 0
    || root.fingerprint.ownerGid !== 0
    || root.fingerprint.mode !== "0555"
    || !root.contentEvidence
    || root.contentEvidence.kind !== "directory_membership"
    || !sameJsonV2(root.contentEvidence.membership, expectedRootMembershipV2())
  ) {
    return failV2(
      "NATIVE_PACKAGE_MEMBER_CAPTURE_PHYSICAL_INVALID",
      "Host-verifier root does not join the exact code-owned package and scope",
    );
  }
  const parsed = {
    binDirectory: captures.binDirectory,
    manifest: captures.manifest,
    executable: captures.executable,
  } as const;
  const all = [root, parsed.binDirectory, parsed.manifest, parsed.executable];
  const keys = new Set<string>();
  for (const capture of all) {
    if (
      capture.objectIdentity.filesystemScopeIdentityHash !== scopeHash
      || capture.fingerprint.objectIdentityHash
        !== capture.objectIdentity.objectIdentityHash
      || capture.objectIdentity.device !== root.objectIdentity.device
      || keys.has(locatorKeyV2(capture.objectIdentity))
    ) {
      return failV2(
        "NATIVE_PACKAGE_MEMBER_CAPTURE_PHYSICAL_INVALID",
        "Native package members must join one scope/device and unique stable locators",
      );
    }
    keys.add(locatorKeyV2(capture.objectIdentity));
  }
  if (
    parsed.binDirectory.basename !== "bin"
    || parsed.binDirectory.objectIdentity.objectKind !== "directory"
    || parsed.binDirectory.fingerprint.ownerUid !== 0
    || parsed.binDirectory.fingerprint.ownerGid !== 0
    || parsed.binDirectory.fingerprint.mode !== "0555"
    || parsed.binDirectory.contentEvidence.kind !== "directory_membership"
    || !sameJsonV2(parsed.binDirectory.contentEvidence.membership, expectedBinMembershipV2())
    || parsed.binDirectory.parentObjectIdentity.objectIdentityHash
      !== root.objectIdentity.objectIdentityHash
  ) {
    return failV2(
      "NATIVE_PACKAGE_MEMBER_CAPTURE_PHYSICAL_INVALID",
      "Host-verifier bin directory is not the exact root-owned topology",
    );
  }
  const manifestContract = PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.packages
    .find((entry) => entry.packageRef === PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.hostVerifier)!
    .members.find((entry) => entry.role === "canonical_manifest")!;
  if (
    parsed.manifest.basename !== PLATFORM_RELEASE_HOST_VERIFIER_MANIFEST_LOCATOR_V2
    || parsed.manifest.objectIdentity.objectKind !== "ordinary_file"
    || parsed.manifest.fingerprint.ownerUid !== 0
    || parsed.manifest.fingerprint.ownerGid !== 0
    || parsed.manifest.fingerprint.mode !== manifestContract.requiredMode
    || parsed.manifest.fingerprint.linkCount !== manifestContract.requiredLinkCount
    || parsed.manifest.fingerprint.byteLength < 1
    || parsed.manifest.fingerprint.byteLength > manifestContract.maxBytes
    || parsed.manifest.contentEvidence.kind !== "bounded_regular_file_bytes"
    || parsed.manifest.contentEvidence.rawContentHash !== selection.packageManifestHash
    || parsed.manifest.parentObjectIdentity.objectIdentityHash
      !== root.objectIdentity.objectIdentityHash
  ) {
    return failV2(
      "NATIVE_PACKAGE_MEMBER_CAPTURE_PHYSICAL_INVALID",
      "Host-verifier manifest capture does not join the selected package manifest",
    );
  }
  const executableContract = PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.packages
    .find((entry) => entry.packageRef === PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.hostVerifier)!
    .members.find((entry) => entry.role === "signed_native_executable")!;
  if (
    parsed.executable.basename
      !== PLATFORM_RELEASE_HOST_VERIFIER_EXECUTABLE_LOCATOR_V2.split("/").at(-1)
    || parsed.executable.objectIdentity.objectKind !== "ordinary_file"
    || parsed.executable.fingerprint.ownerUid !== 0
    || parsed.executable.fingerprint.ownerGid !== 0
    || parsed.executable.fingerprint.mode !== executableContract.requiredMode
    || parsed.executable.fingerprint.linkCount !== executableContract.requiredLinkCount
    || parsed.executable.fingerprint.byteLength !== selection.artifactByteLength
    || parsed.executable.fingerprint.byteLength > executableContract.maxBytes
    || parsed.executable.contentEvidence.kind !== "bounded_regular_file_bytes"
    || parsed.executable.contentEvidence.rawContentHash !== selection.artifactContentHash
    || parsed.executable.parentObjectIdentity.objectIdentityHash
      !== parsed.binDirectory.objectIdentity.objectIdentityHash
  ) {
    return failV2(
      "NATIVE_PACKAGE_MEMBER_CAPTURE_PHYSICAL_INVALID",
      "Host-verifier executable capture does not join the selected artifact",
    );
  }
  return Object.freeze({
    root,
    ...parsed,
  });
}

type MemberCaptureV2 = z.infer<typeof MemberCaptureV2Schema>;

function hashMemberObservationV2(value: Readonly<{
  packageSnapshotHash: string;
  scopeIdentityHash: string;
  selection: PlatformReleaseBootstrapDarwinNativeDistributionSelectionV2;
  root: NamespacePhysicalEntryCaptureV2;
  captures: PlatformReleaseBootstrapDarwinNativePackageMemberCaptureTestV2;
}>): string {
  return hashCanonicalJson({
    schema:
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_PACKAGE_MEMBER_CAPTURE_TEST_V2_OBSERVATION_HASH_SCHEMA,
    observation: value,
  });
}

export function hashPlatformReleaseBootstrapDarwinNativePackageMemberCaptureTestV2(
  value: PlatformReleaseBootstrapDarwinNativePackageMemberCaptureTestIdentityV2,
): string {
  return hashCanonicalJson({
    schema:
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_PACKAGE_MEMBER_CAPTURE_TEST_V2_HASH_SCHEMA,
    relation: value,
  });
}

export function parsePlatformReleaseBootstrapDarwinNativePackageMemberCaptureTestCandidateV2(
  input: unknown,
): PlatformReleaseBootstrapDarwinNativePackageMemberCaptureRelationV2 {
  assertNotProxyV2(input, "Serialized native package member relation");
  try {
    const parsed =
      PlatformReleaseBootstrapDarwinNativePackageMemberCaptureTestV2Schema.parse(
        boundedPlatformReleaseJsonSnapshotV2(
          input,
          PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_PACKAGE_MEMBER_CAPTURE_TEST_V2_MAX_CANONICAL_BYTES,
        ),
      );
    const { observationHash: _observationHash, ...identity } = parsed;
    if (
      parsed.observationHash
        !== hashPlatformReleaseBootstrapDarwinNativePackageMemberCaptureTestV2(identity)
    ) {
      return failV2(
        "NATIVE_PACKAGE_MEMBER_CAPTURE_SERIALIZATION_INVALID",
        "Native package member relation hash mismatch",
      );
    }
    return deepFreezePlatformReleaseJsonV2(parsed);
  } catch (error) {
    if (error instanceof PlatformReleaseBootstrapDarwinNativePackageMemberCaptureTestErrorV2) {
      throw error;
    }
    return failV2(
      "NATIVE_PACKAGE_MEMBER_CAPTURE_SERIALIZATION_INVALID",
      "Native package member relation serialization is invalid",
      error,
    );
  }
}

export function buildPlatformReleaseBootstrapDarwinNativePackageMemberCaptureTestV2(
  input: PlatformReleaseBootstrapDarwinNativePackageMemberCaptureTestInputV2,
): PlatformReleaseBootstrapDarwinNativePackageMemberCaptureRelationV2 {
  assertInputRecordV2(input);
  const expectedKeys = [
    "memberCaptures",
    "packageSnapshot",
    "scopePublicationEvidence",
    "selectionInput",
    "verificationReceipt",
  ];
  const keys = Object.keys(input).sort();
  if (
    keys.length !== expectedKeys.length
    || keys.some((key, index) => key !== expectedKeys[index])
  ) {
    return failV2(
      "NATIVE_PACKAGE_MEMBER_CAPTURE_INPUT_INVALID",
      "Native package member input contains unknown or missing fields",
    );
  }
  assertNotProxyV2(input.packageSnapshot, "Package snapshot");
  assertNotProxyV2(input.scopePublicationEvidence, "Scope publication evidence");
  assertNotProxyV2(input.selectionInput, "Native selection input");
  assertNotProxyV2(input.memberCaptures, "Member captures");
  if (
    typeof input.verificationReceipt !== "object"
    || input.verificationReceipt === null
    || isProxy(input.verificationReceipt)
  ) {
    return failV2(
      "NATIVE_PACKAGE_MEMBER_CAPTURE_SELECTION_INVALID",
      "Native distribution selection requires one original mechanics verification receipt",
    );
  }

  let snapshot: PlatformReleaseBootstrapRegistryPackagePhysicalSnapshotTestV2;
  try {
    snapshot = parsePlatformReleaseBootstrapRegistryPackagePhysicalSnapshotTestCandidateV2(
      input.packageSnapshot,
    );
  } catch (error) {
    return failV2(
      "NATIVE_PACKAGE_MEMBER_CAPTURE_SNAPSHOT_INVALID",
      "Package snapshot is not one complete self-hashed registry snapshot",
      error,
    );
  }
  let publication: PlatformReleaseBootstrapFilesystemScopePublicationEvidenceTestV2;
  try {
    publication = parsePlatformReleaseBootstrapFilesystemScopePublicationEvidenceTestCandidateV2(
      input.scopePublicationEvidence,
    );
  } catch (error) {
    return failV2(
      "NATIVE_PACKAGE_MEMBER_CAPTURE_SCOPE_INVALID",
      "Scope publication evidence is not one exact cooperative observation",
      error,
    );
  }
  if (
    snapshot.filesystemScopeIdentityHash !== publication.filesystemScope.scopeIdentityHash
  ) {
    return failV2(
      "NATIVE_PACKAGE_MEMBER_CAPTURE_SCOPE_INVALID",
      "Package snapshot and scope publication do not share one scope identity",
    );
  }

  let captures: PlatformReleaseBootstrapDarwinNativePackageMemberCaptureTestV2;
  try {
    captures = MemberCapturesV2Schema.parse(
      boundedPlatformReleaseJsonSnapshotV2(
        input.memberCaptures,
        PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_PACKAGE_MEMBER_CAPTURE_TEST_V2_MAX_MEMBER_BYTES,
      ),
    );
  } catch (error) {
    return failV2(
      "NATIVE_PACKAGE_MEMBER_CAPTURE_PHYSICAL_INVALID",
      "Native package member captures are not one bounded strict record",
      error,
    );
  }

  let selection: PlatformReleaseBootstrapDarwinNativeDistributionSelectionV2;
  try {
    selection = selectPlatformReleaseBootstrapDarwinNativeDistributionEntryMechanicsV2(
      input.verificationReceipt as PlatformReleaseBootstrapDarwinNativeDistributionVerificationReceiptV2,
      input.selectionInput,
    );
  } catch (error) {
    return failV2(
      "NATIVE_PACKAGE_MEMBER_CAPTURE_SELECTION_INVALID",
      "Native distribution selection did not retain its original mechanics receipt",
      error,
    );
  }
  const shape = validateCaptureShapeV2(captures, selection, snapshot, publication);
  const observation = hashMemberObservationV2({
    packageSnapshotHash: snapshot.snapshotHash,
    scopeIdentityHash: publication.filesystemScope.scopeIdentityHash,
    selection,
    root: shape.root,
    captures,
  });
  const identity = {
    schema:
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NATIVE_PACKAGE_MEMBER_CAPTURE_TEST_V2_SCHEMA,
    version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
    admissionScope: "test_fixture" as const,
    authorityState: "caller_supplied_test_mechanics_only" as const,
    productionAuthority: false as const,
    productionAdmission: "forbidden" as const,
    credentialUse: "none" as const,
    signingAuthority: "unsigned_test_fixture" as const,
    mutationAuthority: false as const,
    trustConclusion: "characterization_only" as const,
    packageSnapshotHash: snapshot.snapshotHash,
    filesystemScopeIdentityHash: publication.filesystemScope.scopeIdentityHash,
    scopePublicationObservationHash:
      hashPlatformReleaseBootstrapFilesystemScopePublicationEvidenceTestV2(
        publication,
      ),
    verificationReceiptHash: selection.verificationReceiptHash,
    selectionHash: selection.selectionHash,
    rootObjectIdentityHash: shape.root.objectIdentity.objectIdentityHash,
    binDirectoryObjectIdentityHash: shape.binDirectory.objectIdentity.objectIdentityHash,
    manifestObjectIdentityHash: shape.manifest.objectIdentity.objectIdentityHash,
    executableObjectIdentityHash: shape.executable.objectIdentity.objectIdentityHash,
    memberCaptureObservationHash: observation,
  } satisfies PlatformReleaseBootstrapDarwinNativePackageMemberCaptureTestIdentityV2;
  return parsePlatformReleaseBootstrapDarwinNativePackageMemberCaptureTestCandidateV2({
    ...identity,
    observationHash:
      hashPlatformReleaseBootstrapDarwinNativePackageMemberCaptureTestV2(identity),
  });
}
