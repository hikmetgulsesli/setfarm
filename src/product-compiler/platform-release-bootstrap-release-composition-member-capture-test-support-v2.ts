import { isProxy } from "node:util/types";

import { z } from "zod";

import {
  PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2,
  PLATFORM_RELEASE_COMPOSITION_EXECUTABLE_LOCATOR_V2,
  PLATFORM_RELEASE_COMPOSITION_MODULE_LOCATOR_V2,
  PLATFORM_RELEASE_COMPOSITION_PACKAGE_MANIFEST_LOCATOR_V2,
  PLATFORM_RELEASE_METADATA_MODULE_LOCATOR_V2,
  PLATFORM_RELEASE_NETWORK_WRAPPER_MODULE_LOCATOR_V2,
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
import { Sha256Schema } from "./schemas/common-v1.js";
import { canonicalJsonStringify, hashCanonicalJson } from "./canonical-json.js";
import {
  DirectoryMembershipIdentityV2Schema,
  FsObservationFingerprintV2Schema,
  StableFsObjectIdentityV2Schema,
  buildDirectoryMembershipIdentityV2,
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
 * Test-only R-member characterization. It joins the serialized R package root
 * to separately supplied bin/lib/member captures, but never opens a package,
 * loads a module, verifies a signature, or mints production authority.
 */
export const PLATFORM_RELEASE_BOOTSTRAP_RELEASE_COMPOSITION_MEMBER_CAPTURE_TEST_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-release-composition-member-capture-test.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_RELEASE_COMPOSITION_MEMBER_CAPTURE_TEST_V2_HASH_SCHEMA =
  "setfarm.platform-release-bootstrap-release-composition-member-capture-test-hash.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_RELEASE_COMPOSITION_MEMBER_CAPTURE_TEST_V2_OBSERVATION_HASH_SCHEMA =
  "setfarm.platform-release-bootstrap-release-composition-member-capture-test-observation-hash.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_RELEASE_COMPOSITION_MEMBER_CAPTURE_TEST_V2_MAX_CANONICAL_BYTES =
  16 * 1024 * 1024;
export const PLATFORM_RELEASE_BOOTSTRAP_RELEASE_COMPOSITION_MEMBER_CAPTURE_TEST_V2_MAX_MEMBER_BYTES =
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
    .regex(/^[^/\\\0]+$/, "Expected one canonical direct-child basename"),
  objectIdentity: StableFsObjectIdentityV2Schema,
  fingerprint: FsObservationFingerprintV2Schema,
  parentObjectIdentity: StableFsObjectIdentityV2Schema,
  contentEvidence: ContentEvidenceV2Schema,
  observedExports: z.array(z.string().min(1).max(256)).max(32),
}).strict();

const MemberCapturesV2Schema = z.object({
  binDirectory: MemberCaptureV2Schema,
  libDirectory: MemberCaptureV2Schema,
  manifest: MemberCaptureV2Schema,
  executable: MemberCaptureV2Schema,
  releaseModule: MemberCaptureV2Schema,
  metadataModule: MemberCaptureV2Schema,
  networkWrapperModule: MemberCaptureV2Schema,
}).strict();

type MemberCaptureV2 = z.infer<typeof MemberCaptureV2Schema>;
export type PlatformReleaseBootstrapReleaseCompositionMemberCapturesTestV2 =
  z.infer<typeof MemberCapturesV2Schema>;

const RelationIdentityV2Schema = z.object({
  schema: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_RELEASE_COMPOSITION_MEMBER_CAPTURE_TEST_V2_SCHEMA,
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
  sealedRootProvenanceHash: Sha256Schema.nullable(),
  rootObjectIdentityHash: Sha256Schema,
  binDirectoryObjectIdentityHash: Sha256Schema,
  libDirectoryObjectIdentityHash: Sha256Schema,
  manifestObjectIdentityHash: Sha256Schema,
  executableObjectIdentityHash: Sha256Schema,
  releaseModuleObjectIdentityHash: Sha256Schema,
  metadataModuleObjectIdentityHash: Sha256Schema,
  networkWrapperModuleObjectIdentityHash: Sha256Schema,
  memberCaptureObservationHash: Sha256Schema,
}).strict();

export type PlatformReleaseBootstrapReleaseCompositionMemberCaptureTestIdentityV2 =
  z.infer<typeof RelationIdentityV2Schema>;

export const PlatformReleaseBootstrapReleaseCompositionMemberCaptureTestV2Schema =
  RelationIdentityV2Schema.extend({
    observationHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (!platformReleaseCandidateFitsCanonicalCapV2(
      value,
      PLATFORM_RELEASE_BOOTSTRAP_RELEASE_COMPOSITION_MEMBER_CAPTURE_TEST_V2_MAX_CANONICAL_BYTES,
    )) {
      context.addIssue({
        code: "custom",
        message: "Release-composition member relation exceeds its byte cap",
      });
    }
    const { observationHash: _observationHash, ...identity } = value;
    if (value.observationHash !==
      hashPlatformReleaseBootstrapReleaseCompositionMemberCaptureTestV2(identity)) {
      context.addIssue({
        code: "custom",
        path: ["observationHash"],
        message: "Release-composition member relation observation hash mismatch",
      });
    }
  });

export type PlatformReleaseBootstrapReleaseCompositionMemberCaptureRelationV2 =
  z.infer<typeof PlatformReleaseBootstrapReleaseCompositionMemberCaptureTestV2Schema>;

export type PlatformReleaseBootstrapReleaseCompositionMemberCaptureTestInputV2 =
  Readonly<{
    packageSnapshot: unknown;
    scopePublicationEvidence: unknown;
    memberCaptures: unknown;
    sealedRootProvenanceHash?: unknown;
  }>;

export type PlatformReleaseBootstrapReleaseCompositionMemberCaptureTestErrorCodeV2 =
  | "RELEASE_COMPOSITION_MEMBER_CAPTURE_INPUT_INVALID"
  | "RELEASE_COMPOSITION_MEMBER_CAPTURE_SNAPSHOT_INVALID"
  | "RELEASE_COMPOSITION_MEMBER_CAPTURE_SCOPE_INVALID"
  | "RELEASE_COMPOSITION_MEMBER_CAPTURE_PHYSICAL_INVALID"
  | "RELEASE_COMPOSITION_MEMBER_CAPTURE_SERIALIZATION_INVALID";

export class PlatformReleaseBootstrapReleaseCompositionMemberCaptureTestErrorV2
  extends TypeError {
  constructor(
    readonly code: PlatformReleaseBootstrapReleaseCompositionMemberCaptureTestErrorCodeV2,
    message: string,
    options: ErrorOptions = {},
  ) {
    super(message.slice(0, 1_500), options);
    this.name = "PlatformReleaseBootstrapReleaseCompositionMemberCaptureTestErrorV2";
  }
}

function failV2(
  code: PlatformReleaseBootstrapReleaseCompositionMemberCaptureTestErrorCodeV2,
  message: string,
  cause?: unknown,
): never {
  throw new PlatformReleaseBootstrapReleaseCompositionMemberCaptureTestErrorV2(
    code,
    message,
    cause === undefined ? {} : { cause },
  );
}

function isPlainRecordV2(value: unknown): value is Record<string, unknown> {
  return typeof value === "object"
    && value !== null
    && !Array.isArray(value)
    && !isProxy(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function assertInputRecordV2(
  input: unknown,
): asserts input is Record<string, unknown> {
  if (!isPlainRecordV2(input)) {
    return failV2(
      "RELEASE_COMPOSITION_MEMBER_CAPTURE_INPUT_INVALID",
      "Release-composition member input must be one non-proxy plain record",
    );
  }
  for (const key of Reflect.ownKeys(input)) {
    if (typeof key !== "string") {
      return failV2(
        "RELEASE_COMPOSITION_MEMBER_CAPTURE_INPUT_INVALID",
        "Release-composition member input cannot contain symbol keys",
      );
    }
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
      return failV2(
        "RELEASE_COMPOSITION_MEMBER_CAPTURE_INPUT_INVALID",
        "Release-composition member input cannot contain accessor or hidden fields",
      );
    }
  }
}

function assertNotProxyV2(value: unknown, label: string): void {
  if (typeof value === "object" && value !== null && isProxy(value)) {
    return failV2(
      "RELEASE_COMPOSITION_MEMBER_CAPTURE_INPUT_INVALID",
      `${label} must not be a proxy`,
    );
  }
}

function sameJsonV2(left: unknown, right: unknown): boolean {
  return canonicalJsonStringify(left) === canonicalJsonStringify(right);
}

function locatorKeyV2(identity: StableFsObjectIdentityV2): string {
  return [
    identity.filesystemScopeIdentityHash,
    identity.device,
    identity.inode,
  ].join(":");
}

function basenameV2(locator: string): string {
  return locator.split("/").at(-1)!;
}

function packageContractV2() {
  const contract = PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.packages.find(
    (entry) => entry.packageRef === PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.platformReleaseComposition,
  );
  if (!contract) {
    return failV2(
      "RELEASE_COMPOSITION_MEMBER_CAPTURE_SNAPSHOT_INVALID",
      "Code-owned release-composition package contract is missing",
    );
  }
  return contract;
}

function expectedMembershipV2(
  entries: readonly { basename: string; objectKind: "directory" | "ordinary_file" }[],
) {
  return buildDirectoryMembershipIdentityV2({
    orderedEntries: [...entries].sort((left, right) =>
      left.basename < right.basename ? -1 : left.basename > right.basename ? 1 : 0),
  });
}

function expectedRootMembershipV2() {
  const contract = packageContractV2();
  const directoryRefs = new Set(contract.directories.map((entry) => entry.directoryRef));
  const root = contract.directories.find((entry) => entry.relativeLocator === ".");
  if (!root || root.orderedEntryRefs.length !== root.orderedEntryBasenames.length) {
    return failV2(
      "RELEASE_COMPOSITION_MEMBER_CAPTURE_SNAPSHOT_INVALID",
      "Release-composition root directory contract is incomplete",
    );
  }
  return expectedMembershipV2(root.orderedEntryRefs.map((memberRef, index) => ({
    basename: root.orderedEntryBasenames[index]!,
    objectKind: directoryRefs.has(memberRef) ? "directory" as const : "ordinary_file" as const,
  })));
}

function exactRootV2(
  snapshot: PlatformReleaseBootstrapRegistryPackagePhysicalSnapshotTestV2,
): NamespacePhysicalEntryCaptureV2 {
  const evidence = snapshot.packageEvidence.find((entry) =>
    entry.packageRef === PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.platformReleaseComposition);
  const root = evidence?.projection.orderedEntryCaptures.filter(
    (capture) => capture.classification.category === "package_root",
  );
  if (!root || root.length !== 1) {
    return failV2(
      "RELEASE_COMPOSITION_MEMBER_CAPTURE_SNAPSHOT_INVALID",
      "Release-composition snapshot has no exact package root capture",
    );
  }
  return root[0]!;
}

function assertCaptureCommonV2(
  capture: MemberCaptureV2,
  scopeHash: string,
  device: string,
  keys: Set<string>,
  label: string,
): void {
  if (capture.objectIdentity.filesystemScopeIdentityHash !== scopeHash
    || capture.fingerprint.objectIdentityHash !== capture.objectIdentity.objectIdentityHash
    || capture.objectIdentity.device !== device
    || keys.has(locatorKeyV2(capture.objectIdentity))) {
    return failV2(
      "RELEASE_COMPOSITION_MEMBER_CAPTURE_PHYSICAL_INVALID",
      `${label} must join one scope/device and a unique stable locator`,
    );
  }
  keys.add(locatorKeyV2(capture.objectIdentity));
}

function assertDirectoryV2(
  capture: MemberCaptureV2,
  label: string,
  basename: string,
  parent: StableFsObjectIdentityV2,
  membership: unknown,
  requiredMode: string,
): void {
  if (capture.basename !== basename
    || capture.objectIdentity.objectKind !== "directory"
    || capture.parentObjectIdentity.objectIdentityHash !== parent.objectIdentityHash
    || !sameJsonV2(capture.parentObjectIdentity, parent)
    || capture.fingerprint.ownerUid !== 0
    || capture.fingerprint.ownerGid !== 0
    || capture.fingerprint.mode !== requiredMode
    || capture.fingerprint.linkCount < 1
    || capture.contentEvidence.kind !== "directory_membership"
    || !sameJsonV2(capture.contentEvidence.membership, membership)
    || capture.observedExports.length !== 0) {
    return failV2(
      "RELEASE_COMPOSITION_MEMBER_CAPTURE_PHYSICAL_INVALID",
      `${label} does not join the exact root-owned directory topology`,
    );
  }
}

function assertFileV2(
  capture: MemberCaptureV2,
  label: string,
  basename: string,
  parent: StableFsObjectIdentityV2,
  requiredMode: string,
  requiredLinkCount: number,
  maxBytes: number,
  requiredExports: readonly string[],
): void {
  const contentHash = capture.contentEvidence.kind === "bounded_regular_file_bytes"
    ? capture.contentEvidence.rawContentHash
    : null;
  if (capture.basename !== basename
    || capture.objectIdentity.objectKind !== "ordinary_file"
    || capture.parentObjectIdentity.objectIdentityHash !== parent.objectIdentityHash
    || !sameJsonV2(capture.parentObjectIdentity, parent)
    || capture.fingerprint.ownerUid !== 0
    || capture.fingerprint.ownerGid !== 0
    || capture.fingerprint.mode !== requiredMode
    || capture.fingerprint.linkCount !== requiredLinkCount
    || capture.fingerprint.byteLength < 1
    || capture.fingerprint.byteLength > maxBytes
    || capture.contentEvidence.kind !== "bounded_regular_file_bytes"
    || contentHash === capture.objectIdentity.objectIdentityHash
    || contentHash === capture.fingerprint.fingerprintHash
    || !sameJsonV2(capture.observedExports, [...requiredExports].sort())) {
    return failV2(
      "RELEASE_COMPOSITION_MEMBER_CAPTURE_PHYSICAL_INVALID",
      `${label} does not join the exact root-owned file contract`,
    );
  }
}

function hashMemberObservationV2(value: Readonly<{
  packageSnapshotHash: string;
  scopeIdentityHash: string;
  sealedRootProvenanceHash: string | null;
  root: NamespacePhysicalEntryCaptureV2;
  captures: PlatformReleaseBootstrapReleaseCompositionMemberCapturesTestV2;
}>): string {
  return hashCanonicalJson({
    schema:
      PLATFORM_RELEASE_BOOTSTRAP_RELEASE_COMPOSITION_MEMBER_CAPTURE_TEST_V2_OBSERVATION_HASH_SCHEMA,
    observation: value,
  });
}

export function hashPlatformReleaseBootstrapReleaseCompositionMemberCaptureTestV2(
  value: PlatformReleaseBootstrapReleaseCompositionMemberCaptureTestIdentityV2,
): string {
  return hashCanonicalJson({
    schema:
      PLATFORM_RELEASE_BOOTSTRAP_RELEASE_COMPOSITION_MEMBER_CAPTURE_TEST_V2_HASH_SCHEMA,
    relation: value,
  });
}

export function parsePlatformReleaseBootstrapReleaseCompositionMemberCaptureTestCandidateV2(
  input: unknown,
): PlatformReleaseBootstrapReleaseCompositionMemberCaptureRelationV2 {
  assertNotProxyV2(input, "Serialized release-composition member relation");
  try {
    const parsed = PlatformReleaseBootstrapReleaseCompositionMemberCaptureTestV2Schema.parse(
      boundedPlatformReleaseJsonSnapshotV2(
        input,
        PLATFORM_RELEASE_BOOTSTRAP_RELEASE_COMPOSITION_MEMBER_CAPTURE_TEST_V2_MAX_CANONICAL_BYTES,
      ),
    );
    const { observationHash: _observationHash, ...identity } = parsed;
    if (parsed.observationHash !==
      hashPlatformReleaseBootstrapReleaseCompositionMemberCaptureTestV2(identity)) {
      return failV2(
        "RELEASE_COMPOSITION_MEMBER_CAPTURE_SERIALIZATION_INVALID",
        "Release-composition member relation hash mismatch",
      );
    }
    return deepFreezePlatformReleaseJsonV2(parsed);
  } catch (error) {
    if (error instanceof PlatformReleaseBootstrapReleaseCompositionMemberCaptureTestErrorV2) {
      throw error;
    }
    return failV2(
      "RELEASE_COMPOSITION_MEMBER_CAPTURE_SERIALIZATION_INVALID",
      "Release-composition member relation serialization is invalid",
      error,
    );
  }
}

export function buildPlatformReleaseBootstrapReleaseCompositionMemberCaptureTestV2(
  input: PlatformReleaseBootstrapReleaseCompositionMemberCaptureTestInputV2,
): PlatformReleaseBootstrapReleaseCompositionMemberCaptureRelationV2 {
  assertInputRecordV2(input);
  const keys = Object.keys(input).sort();
  const requiredKeys = [
    "memberCaptures",
    "packageSnapshot",
    "scopePublicationEvidence",
  ];
  const allowedKeys = new Set([
    ...requiredKeys,
    "sealedRootProvenanceHash",
  ]);
  if (keys.length < requiredKeys.length
    || keys.length > requiredKeys.length + 1
    || keys.some((key) => !allowedKeys.has(key))
    || requiredKeys.some((key) => !keys.includes(key))) {
    return failV2(
      "RELEASE_COMPOSITION_MEMBER_CAPTURE_INPUT_INVALID",
      "Release-composition member input contains unknown or missing fields",
    );
  }
  assertNotProxyV2(input.packageSnapshot, "Package snapshot");
  assertNotProxyV2(input.scopePublicationEvidence, "Scope publication evidence");
  assertNotProxyV2(input.memberCaptures, "Member captures");

  let snapshot: PlatformReleaseBootstrapRegistryPackagePhysicalSnapshotTestV2;
  try {
    snapshot = parsePlatformReleaseBootstrapRegistryPackagePhysicalSnapshotTestCandidateV2(
      input.packageSnapshot,
    );
  } catch (error) {
    return failV2(
      "RELEASE_COMPOSITION_MEMBER_CAPTURE_SNAPSHOT_INVALID",
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
      "RELEASE_COMPOSITION_MEMBER_CAPTURE_SCOPE_INVALID",
      "Scope publication evidence is not one exact cooperative observation",
      error,
    );
  }
  if (snapshot.filesystemScopeIdentityHash !== publication.filesystemScope.scopeIdentityHash) {
    return failV2(
      "RELEASE_COMPOSITION_MEMBER_CAPTURE_SCOPE_INVALID",
      "Package snapshot and scope publication do not share one scope identity",
    );
  }

  let sealedRootProvenanceHash: string | null = null;
  if (input.sealedRootProvenanceHash !== undefined) {
    try {
      sealedRootProvenanceHash = Sha256Schema.parse(input.sealedRootProvenanceHash);
    } catch (error) {
      return failV2(
        "RELEASE_COMPOSITION_MEMBER_CAPTURE_INPUT_INVALID",
        "Optional sealed-root provenance must be one SHA-256 hash only",
        error,
      );
    }
  }

  let captures: PlatformReleaseBootstrapReleaseCompositionMemberCapturesTestV2;
  try {
    captures = MemberCapturesV2Schema.parse(
      boundedPlatformReleaseJsonSnapshotV2(
        input.memberCaptures,
        PLATFORM_RELEASE_BOOTSTRAP_RELEASE_COMPOSITION_MEMBER_CAPTURE_TEST_V2_MAX_MEMBER_BYTES,
      ),
    );
  } catch (error) {
    return failV2(
      "RELEASE_COMPOSITION_MEMBER_CAPTURE_PHYSICAL_INVALID",
      "Release-composition member captures are not one bounded strict record",
      error,
    );
  }

  const root = exactRootV2(snapshot);
  const scopeHash = publication.filesystemScope.scopeIdentityHash;
  const contract = packageContractV2();
  const rootDirectoryContract = contract.directories.find((entry) => entry.relativeLocator === ".")!;
  if (root.classification.basename !== contract.rootBasename
    || root.objectIdentity.filesystemScopeIdentityHash !== scopeHash
    || root.objectIdentity.objectKind !== "directory"
    || root.fingerprint.ownerUid !== 0
    || root.fingerprint.ownerGid !== 0
    || root.fingerprint.mode !== contract.rootMode
    || root.contentEvidence.kind !== "directory_membership"
    || !sameJsonV2(root.contentEvidence.membership, expectedRootMembershipV2())) {
    return failV2(
      "RELEASE_COMPOSITION_MEMBER_CAPTURE_PHYSICAL_INVALID",
      "Release-composition package root does not join the exact code-owned contract",
    );
  }
  if (rootDirectoryContract.orderedEntryRefs.length !== 3) {
    return failV2(
      "RELEASE_COMPOSITION_MEMBER_CAPTURE_SNAPSHOT_INVALID",
      "Release-composition root contract must have exactly three entries",
    );
  }

  const locatorKeys = new Set<string>();
  const allCaptures = [
    captures.binDirectory,
    captures.libDirectory,
    captures.manifest,
    captures.executable,
    captures.releaseModule,
    captures.metadataModule,
    captures.networkWrapperModule,
  ];
  if (root.objectIdentity.filesystemScopeIdentityHash !== scopeHash) {
    return failV2(
      "RELEASE_COMPOSITION_MEMBER_CAPTURE_PHYSICAL_INVALID",
      "Release-composition root is outside the published scope",
    );
  }
  locatorKeys.add(locatorKeyV2(root.objectIdentity));
  for (const [index, capture] of allCaptures.entries()) {
    assertCaptureCommonV2(capture, scopeHash, root.objectIdentity.device, locatorKeys, `R member ${index}`);
  }

  const binDirectoryContract = contract.directories.find((entry) => entry.relativeLocator === "bin")!;
  const libDirectoryContract = contract.directories.find((entry) => entry.relativeLocator === "lib")!;
  assertDirectoryV2(
    captures.binDirectory,
    "Release-composition bin directory",
    "bin",
    root.objectIdentity,
    expectedMembershipV2([{ basename: basenameV2(PLATFORM_RELEASE_COMPOSITION_EXECUTABLE_LOCATOR_V2), objectKind: "ordinary_file" }]),
    binDirectoryContract.requiredMode,
  );
  assertDirectoryV2(
    captures.libDirectory,
    "Release-composition lib directory",
    "lib",
    root.objectIdentity,
    expectedMembershipV2([
      { basename: basenameV2(PLATFORM_RELEASE_COMPOSITION_MODULE_LOCATOR_V2), objectKind: "ordinary_file" },
      { basename: basenameV2(PLATFORM_RELEASE_METADATA_MODULE_LOCATOR_V2), objectKind: "ordinary_file" },
      { basename: basenameV2(PLATFORM_RELEASE_NETWORK_WRAPPER_MODULE_LOCATOR_V2), objectKind: "ordinary_file" },
    ]),
    libDirectoryContract.requiredMode,
  );

  const manifest = contract.members.find((entry) => entry.role === "canonical_manifest")!;
  const executable = contract.members.find((entry) => entry.role === "release_executable")!;
  const releaseModule = contract.members.find((entry) => entry.role === "release_module")!;
  const metadataModule = contract.members.find((entry) => entry.role === "metadata_module")!;
  const networkModule = contract.members.find((entry) => entry.role === "network_wrapper_module")!;
  assertFileV2(captures.manifest, "Release-composition manifest", basenameV2(manifest.relativeLocator), root.objectIdentity, manifest.requiredMode, manifest.requiredLinkCount, manifest.maxBytes, manifest.requiredExports);
  assertFileV2(captures.executable, "Release-composition executable", basenameV2(executable.relativeLocator), captures.binDirectory.objectIdentity, executable.requiredMode, executable.requiredLinkCount, executable.maxBytes, executable.requiredExports);
  assertFileV2(captures.releaseModule, "Release-composition module", basenameV2(releaseModule.relativeLocator), captures.libDirectory.objectIdentity, releaseModule.requiredMode, releaseModule.requiredLinkCount, releaseModule.maxBytes, releaseModule.requiredExports);
  assertFileV2(captures.metadataModule, "Release-composition metadata module", basenameV2(metadataModule.relativeLocator), captures.libDirectory.objectIdentity, metadataModule.requiredMode, metadataModule.requiredLinkCount, metadataModule.maxBytes, metadataModule.requiredExports);
  assertFileV2(captures.networkWrapperModule, "Release-composition network module", basenameV2(networkModule.relativeLocator), captures.libDirectory.objectIdentity, networkModule.requiredMode, networkModule.requiredLinkCount, networkModule.maxBytes, networkModule.requiredExports);

  const observation = hashMemberObservationV2({
    packageSnapshotHash: snapshot.snapshotHash,
    scopeIdentityHash: scopeHash,
    sealedRootProvenanceHash,
    root,
    captures,
  });
  const identity = {
    schema: PLATFORM_RELEASE_BOOTSTRAP_RELEASE_COMPOSITION_MEMBER_CAPTURE_TEST_V2_SCHEMA,
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
    filesystemScopeIdentityHash: scopeHash,
    scopePublicationObservationHash: hashPlatformReleaseBootstrapFilesystemScopePublicationEvidenceTestV2(publication),
    sealedRootProvenanceHash,
    rootObjectIdentityHash: root.objectIdentity.objectIdentityHash,
    binDirectoryObjectIdentityHash: captures.binDirectory.objectIdentity.objectIdentityHash,
    libDirectoryObjectIdentityHash: captures.libDirectory.objectIdentity.objectIdentityHash,
    manifestObjectIdentityHash: captures.manifest.objectIdentity.objectIdentityHash,
    executableObjectIdentityHash: captures.executable.objectIdentity.objectIdentityHash,
    releaseModuleObjectIdentityHash: captures.releaseModule.objectIdentity.objectIdentityHash,
    metadataModuleObjectIdentityHash: captures.metadataModule.objectIdentity.objectIdentityHash,
    networkWrapperModuleObjectIdentityHash: captures.networkWrapperModule.objectIdentity.objectIdentityHash,
    memberCaptureObservationHash: observation,
  } satisfies PlatformReleaseBootstrapReleaseCompositionMemberCaptureTestIdentityV2;
  return parsePlatformReleaseBootstrapReleaseCompositionMemberCaptureTestCandidateV2({
    ...identity,
    observationHash: hashPlatformReleaseBootstrapReleaseCompositionMemberCaptureTestV2(identity),
  });
}
