import { isProxy } from "node:util/types";

import { z } from "zod";

import {
  PlatformReleaseBootstrapDarwinSystemAnchorHashOnlyTestRelationV2Schema,
  type PlatformReleaseBootstrapDarwinSystemAnchorHashOnlyTestRelationV2,
} from "./platform-release-bootstrap-darwin-system-anchor-relation-test-support-v2.js";
import {
  parsePlatformReleaseBootstrapDarwinNativePackageMemberCaptureTestCandidateV2,
  type PlatformReleaseBootstrapDarwinNativePackageMemberCaptureRelationV2,
} from "./platform-release-bootstrap-darwin-native-package-member-capture-test-support-v2.js";
import {
  parsePlatformReleaseBootstrapReleaseCompositionMemberCaptureTestCandidateV2,
  type PlatformReleaseBootstrapReleaseCompositionMemberCaptureRelationV2,
} from "./platform-release-bootstrap-release-composition-member-capture-test-support-v2.js";
import {
  parsePlatformReleaseBootstrapRuntimeAccountRelationTestCandidateV2,
  type PlatformReleaseBootstrapRuntimeAccountRelationTestV2,
} from "./platform-release-bootstrap-runtime-account-relation-test-support-v2.js";
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
  BootstrapFilesystemScopeIdentityV2Schema,
  DirectoryMembershipIdentityV2Schema,
  FsObservationFingerprintV2Schema,
  NamespacePhysicalCensusV2Schema,
  PackageLifecyclePhysicalProjectionV2Schema,
  StableFsObjectIdentityV2Schema,
  buildDirectoryMembershipIdentityV2,
  type StableFsObjectIdentityV2,
} from "./platform-release-bootstrap-physical-census-v2.js";
import {
  PlatformReleaseBootstrapNamespaceCensusV2Schema,
} from "./platform-release-bootstrap-registry-v2.js";
import { Sha256Schema } from "./schemas/common-v1.js";
import { canonicalJsonStringify, hashCanonicalJson } from "./canonical-json.js";

/**
 * This is a test-only hash join. It deliberately does not extend either
 * aggregate NDJSON stream and does not open, mutate, or authenticate a leaf.
 * The aggregate mapping remains the recursive fixture's false-authority DTO;
 * this adapter only checks that independently produced V/R/S/A relations and
 * the aggregate share the expected serialized scope/provenance joins.
 */
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_AGGREGATE_LEAF_JOIN_TEST_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-darwin-aggregate-leaf-join-test.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_AGGREGATE_LEAF_JOIN_TEST_V2_HASH_SCHEMA =
  "setfarm.platform-release-bootstrap-darwin-aggregate-leaf-join-test-hash.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_AGGREGATE_LEAF_JOIN_TEST_V2_OBSERVATION_HASH_SCHEMA =
  "setfarm.platform-release-bootstrap-darwin-aggregate-leaf-join-test-observation-hash.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_AGGREGATE_LEAF_JOIN_TEST_V2_MAX_CANONICAL_BYTES =
  16 * 1024 * 1024;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_AGGREGATE_LEAF_JOIN_TEST_V2_MAX_INPUT_BYTES =
  64 * 1024 * 1024;

const AGGREGATE_MAPPING_SCHEMA_V2 =
  "setfarm.platform-release-bootstrap-darwin-aggregate-recursive-census-fixture-mapping.v2" as const;
const AGGREGATE_MAPPING_HASH_DOMAIN_V2 =
  "setfarm.platform-release-bootstrap-darwin-aggregate-recursive-census-fixture-mapping-hash.v2" as const;
const AGGREGATE_OBSERVATION_SCHEMA_V2 =
  "setfarm.platform-release-bootstrap-darwin-aggregate-census-fixture-mapping.v2" as const;
const AGGREGATE_CAPABILITY_V2 =
  "darwin_read_only_aggregate_census_fixture_v2" as const;
const JOIN_STATUS_V2 =
  "native_capture_only_requires_ts_aggregate_join_v2" as const;
const NODE_ROOT_BASENAME_V2 = "node-toolchain-provisioner-v2" as const;
const LOCK_ORDER_V2 = [
  "shared_parent_lock",
  "registered_node_package_lock",
] as const;

const RECURSIVE_TREE_SPECS_V2 = Object.freeze([
  {
    role: "root_directory",
    parentRole: "global_parent",
    locator: ".",
    kind: "directory",
    mode: "0555",
    members: [
      ["NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MANIFEST.v2.json", "ordinary_file"],
      ["bin", "directory"],
      ["lib", "directory"],
      ["runtime", "directory"],
    ],
  },
  {
    role: "bin_directory",
    parentRole: "root_directory",
    locator: "bin",
    kind: "directory",
    mode: "0555",
    members: [["setfarm-node-toolchain-provisioner-v2", "ordinary_file"]],
  },
  {
    role: "launcher_file",
    parentRole: "bin_directory",
    locator: "bin/setfarm-node-toolchain-provisioner-v2",
    kind: "ordinary_file",
    mode: "0555",
    maxBytes: 64 * 1024,
  },
  {
    role: "lib_directory",
    parentRole: "root_directory",
    locator: "lib",
    kind: "directory",
    mode: "0555",
    members: [["node-toolchain-provisioner-v2.cjs", "ordinary_file"]],
  },
  {
    role: "bundle_file",
    parentRole: "lib_directory",
    locator: "lib/node-toolchain-provisioner-v2.cjs",
    kind: "ordinary_file",
    mode: "0444",
    maxBytes: 32 * 1024 * 1024,
  },
  {
    role: "manifest_file",
    parentRole: "root_directory",
    locator: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MANIFEST.v2.json",
    kind: "ordinary_file",
    mode: "0444",
    maxBytes: 4 * 1024 * 1024,
  },
  {
    role: "runtime_directory",
    parentRole: "root_directory",
    locator: "runtime",
    kind: "directory",
    mode: "0555",
    members: [["node", "ordinary_file"]],
  },
  {
    role: "bootstrap_runtime_file",
    parentRole: "runtime_directory",
    locator: "runtime/node",
    kind: "ordinary_file",
    mode: "0555",
    maxBytes: 128 * 1024 * 1024,
  },
] as const);

const LockOrderV2Schema = z.tuple([
  z.literal(LOCK_ORDER_V2[0]),
  z.literal(LOCK_ORDER_V2[1]),
]);

const HeldLockEvidenceV2Schema = z.object({
  objectIdentity: StableFsObjectIdentityV2Schema,
  fingerprint: FsObservationFingerprintV2Schema,
}).strict();

const HeldLocksV2Schema = z.object({
  lockOrder: LockOrderV2Schema,
  sharedParentLock: HeldLockEvidenceV2Schema,
  registeredNodePackageLock: HeldLockEvidenceV2Schema,
}).strict();

/*
 * The aggregate mapper's logical projection is intentionally opaque here. Its
 * own mapping hash binds every byte; this join only needs the physical census,
 * Node projection, scope, and lock fields needed for the cross-leaf fence.
 */
const AggregateObservationV2Schema = z.object({
  schema: z.literal(AGGREGATE_OBSERVATION_SCHEMA_V2),
  admissionScope: z.literal("test_fixture"),
  capability: z.literal(AGGREGATE_CAPABILITY_V2),
  productionAuthority: z.literal(false),
  signingAuthority: z.literal("adhoc_or_unsigned_test_fixture"),
  observationAuthority: z.literal(
    "fixture_evidence_only_never_backend_capability_v2",
  ),
  capturePasses: z.literal(2),
  lockOrder: LockOrderV2Schema,
  filesystemScope: BootstrapFilesystemScopeIdentityV2Schema,
  logicalCensus: PlatformReleaseBootstrapNamespaceCensusV2Schema,
  physicalCensus: NamespacePhysicalCensusV2Schema,
  nodeLogicalProjection: z.unknown(),
  nodePhysicalProjection: PackageLifecyclePhysicalProjectionV2Schema,
  heldLocks: HeldLocksV2Schema,
}).strict();

const RecursiveContentV2Schema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("directory_membership"),
    membership: DirectoryMembershipIdentityV2Schema,
  }).strict(),
  z.object({
    kind: z.literal("sha256_regular_file"),
    rawContentHash: Sha256Schema,
  }).strict(),
]);

const RecursiveEntryV2Schema = z.object({
  role: z.string().min(1).max(96),
  parentRole: z.string().min(1).max(96),
  locator: z.string().min(1).max(512),
  parentObjectIdentityHash: Sha256Schema,
  objectIdentity: StableFsObjectIdentityV2Schema,
  fingerprint: FsObservationFingerprintV2Schema,
  content: RecursiveContentV2Schema,
}).strict();

const RecursiveEvidenceV2Schema = z.object({
  status: z.literal("complete"),
  rootBasename: z.literal(NODE_ROOT_BASENAME_V2),
  orderedEntries: z.array(RecursiveEntryV2Schema).length(8),
}).strict();

const AggregateMappingV2Schema = z.object({
  schema: z.literal(AGGREGATE_MAPPING_SCHEMA_V2),
  admissionScope: z.literal("test_fixture"),
  productionAuthority: z.literal(false),
  semanticReady: z.literal(false),
  joinStatus: z.literal(JOIN_STATUS_V2),
  rawStreamHash: Sha256Schema,
  recursiveLineHash: Sha256Schema,
  namespaceEntryCount: z.number().int().nonnegative().safe(),
  frameCount: z.number().int().positive().safe(),
  aggregateObservation: AggregateObservationV2Schema,
  recursiveEvidence: RecursiveEvidenceV2Schema,
  mappingHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  const { mappingHash: _mappingHash, ...identity } = value;
  if (value.mappingHash !== hashAggregateMappingV2(identity)) {
    context.addIssue({
      code: "custom",
      path: ["mappingHash"],
      message: "Aggregate recursive mapping hash mismatch",
    });
  }
});

type AggregateMappingV2 = z.infer<typeof AggregateMappingV2Schema>;

const RelationIdentityV2Schema = z.object({
  schema: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_AGGREGATE_LEAF_JOIN_TEST_V2_SCHEMA,
  ),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  admissionScope: z.literal("test_fixture"),
  authorityState: z.literal("aggregate_leaf_join_test_only"),
  productionAuthority: z.literal(false),
  productionAdmission: z.literal("forbidden"),
  credentialUse: z.literal("none"),
  signingAuthority: z.literal("unsigned_test_fixture"),
  mutationAuthority: z.literal(false),
  trustConclusion: z.literal("characterization_only"),
  semanticReady: z.literal(false),
  joinStatus: z.literal(JOIN_STATUS_V2),
  aggregateMappingHash: Sha256Schema,
  aggregateProjectionHash: Sha256Schema,
  packageSnapshotHash: Sha256Schema,
  filesystemScopeIdentityHash: Sha256Schema,
  scopePublicationObservationHash: Sha256Schema,
  nodeRootObjectIdentityHash: Sha256Schema,
  nodeRootFingerprintHash: Sha256Schema,
  vRootObjectIdentityHash: Sha256Schema,
  rRootObjectIdentityHash: Sha256Schema,
  aggregateRelationHash: Sha256Schema,
  vRelationHash: Sha256Schema,
  rRelationHash: Sha256Schema,
  sRelationHash: Sha256Schema,
  aRelationHash: Sha256Schema,
  leafObservationHash: Sha256Schema,
}).strict();

export type PlatformReleaseBootstrapDarwinAggregateLeafJoinTestIdentityV2 =
  z.infer<typeof RelationIdentityV2Schema>;

export const PlatformReleaseBootstrapDarwinAggregateLeafJoinTestV2Schema =
  RelationIdentityV2Schema.extend({
    joinHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (!platformReleaseCandidateFitsCanonicalCapV2(
      value,
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_AGGREGATE_LEAF_JOIN_TEST_V2_MAX_CANONICAL_BYTES,
    )) {
      context.addIssue({
        code: "custom",
        message: "Aggregate leaf join exceeds its canonical byte cap",
      });
    }
    const { joinHash: _joinHash, ...identity } = value;
    if (
      value.joinHash
        !== hashPlatformReleaseBootstrapDarwinAggregateLeafJoinTestV2(identity)
    ) {
      context.addIssue({
        code: "custom",
        path: ["joinHash"],
        message: "Aggregate leaf join hash mismatch",
      });
    }
    if (value.aggregateRelationHash !== value.aggregateMappingHash) {
      context.addIssue({
        code: "custom",
        path: ["aggregateRelationHash"],
        message: "Aggregate relation hash must equal the aggregate mapping hash",
      });
    }
    const expectedProjectionHash = hashAggregateProjectionV2({
      mappingHash: value.aggregateMappingHash,
      filesystemScopeIdentityHash: value.filesystemScopeIdentityHash,
      capturePasses: 2,
      lockOrder: LOCK_ORDER_V2,
      nodeRootObjectIdentityHash: value.nodeRootObjectIdentityHash,
      nodeRootFingerprintHash: value.nodeRootFingerprintHash,
    });
    if (value.aggregateProjectionHash !== expectedProjectionHash) {
      context.addIssue({
        code: "custom",
        path: ["aggregateProjectionHash"],
        message: "Aggregate projection hash does not match its relation fields",
      });
    }
    const expectedLeafObservationHash = hashLeafObservationV2({
      aggregateMappingHash: value.aggregateMappingHash,
      aggregateProjectionHash: value.aggregateProjectionHash,
      packageSnapshotHash: value.packageSnapshotHash,
      filesystemScopeIdentityHash: value.filesystemScopeIdentityHash,
      scopePublicationObservationHash: value.scopePublicationObservationHash,
      aggregateRelationHash: value.aggregateRelationHash,
      vRelationHash: value.vRelationHash,
      rRelationHash: value.rRelationHash,
      sRelationHash: value.sRelationHash,
      aRelationHash: value.aRelationHash,
      nodeRootObjectIdentityHash: value.nodeRootObjectIdentityHash,
      vRootObjectIdentityHash: value.vRootObjectIdentityHash,
      rRootObjectIdentityHash: value.rRootObjectIdentityHash,
    });
    if (value.leafObservationHash !== expectedLeafObservationHash) {
      context.addIssue({
        code: "custom",
        path: ["leafObservationHash"],
        message: "Leaf observation hash does not match its relation fields",
      });
    }
  });

export type PlatformReleaseBootstrapDarwinAggregateLeafJoinTestV2 = z.infer<
  typeof PlatformReleaseBootstrapDarwinAggregateLeafJoinTestV2Schema
>;

export type PlatformReleaseBootstrapDarwinAggregateLeafJoinTestInputV2 =
  Readonly<{
    aggregate: unknown;
    vRelation: unknown;
    rRelation: unknown;
    sRelation: unknown;
    aRelation: unknown;
  }>;

export type PlatformReleaseBootstrapDarwinAggregateLeafJoinTestErrorCodeV2 =
  | "AGGREGATE_LEAF_JOIN_INPUT_INVALID"
  | "AGGREGATE_LEAF_JOIN_AGGREGATE_INVALID"
  | "AGGREGATE_LEAF_JOIN_V_INVALID"
  | "AGGREGATE_LEAF_JOIN_R_INVALID"
  | "AGGREGATE_LEAF_JOIN_S_INVALID"
  | "AGGREGATE_LEAF_JOIN_A_INVALID"
  | "AGGREGATE_LEAF_JOIN_MISMATCH"
  | "AGGREGATE_LEAF_JOIN_SERIALIZATION_INVALID";

export class PlatformReleaseBootstrapDarwinAggregateLeafJoinTestErrorV2
  extends TypeError {
  constructor(
    readonly code:
      PlatformReleaseBootstrapDarwinAggregateLeafJoinTestErrorCodeV2,
    message: string,
    options: ErrorOptions = {},
  ) {
    super(message.slice(0, 1_500), options);
    this.name =
      "PlatformReleaseBootstrapDarwinAggregateLeafJoinTestErrorV2";
  }
}

function failV2(
  code: PlatformReleaseBootstrapDarwinAggregateLeafJoinTestErrorCodeV2,
  message: string,
  cause?: unknown,
): never {
  throw new PlatformReleaseBootstrapDarwinAggregateLeafJoinTestErrorV2(
    code,
    message,
    cause === undefined ? {} : { cause },
  );
}

function assertSafeJsonGraphV2(
  value: unknown,
  label: string,
  active = new WeakSet<object>(),
): void {
  if (value === null || typeof value !== "object") return;
  if (isProxy(value)) {
    failV2("AGGREGATE_LEAF_JOIN_INPUT_INVALID", `${label} must not be a proxy`);
  }
  if (active.has(value)) {
    failV2("AGGREGATE_LEAF_JOIN_INPUT_INVALID", `${label} contains a cycle`);
  }
  active.add(value);
  try {
    if (Array.isArray(value)) {
      for (const key of Reflect.ownKeys(value)) {
        if (key === "length") continue;
        if (typeof key !== "string" || !/^(?:0|[1-9][0-9]*)$/u.test(key)) {
          failV2("AGGREGATE_LEAF_JOIN_INPUT_INVALID", `${label} has an unknown array key`);
        }
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
          failV2("AGGREGATE_LEAF_JOIN_INPUT_INVALID", `${label} has an accessor field`);
        }
        assertSafeJsonGraphV2(descriptor.value, `${label}.${key}`, active);
      }
      return;
    }
    if (Object.getPrototypeOf(value) !== Object.prototype) {
      failV2("AGGREGATE_LEAF_JOIN_INPUT_INVALID", `${label} must be plain JSON`);
    }
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string") {
        failV2("AGGREGATE_LEAF_JOIN_INPUT_INVALID", `${label} has a symbol key`);
      }
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
        failV2("AGGREGATE_LEAF_JOIN_INPUT_INVALID", `${label}.${key} must be data`);
      }
      assertSafeJsonGraphV2(descriptor.value, `${label}.${key}`, active);
    }
  } finally {
    active.delete(value);
  }
}

function boundedInputV2(
  value: unknown,
  label: string,
  maxBytes: number,
): unknown {
  assertSafeJsonGraphV2(value, label);
  try {
    return boundedPlatformReleaseJsonSnapshotV2(value, maxBytes);
  } catch (error) {
    failV2(
      "AGGREGATE_LEAF_JOIN_INPUT_INVALID",
      `${label} is not bounded canonical JSON`,
      error,
    );
  }
}

function hashAggregateMappingV2(value: Readonly<Record<string, unknown>>): string {
  return hashCanonicalJson({
    schema: AGGREGATE_MAPPING_HASH_DOMAIN_V2,
    mapping: value,
  });
}

function hashAggregateProjectionV2(value: Readonly<Record<string, unknown>>): string {
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-bootstrap-darwin-aggregate-leaf-join-aggregate-projection-hash.v2",
    projection: value,
  });
}

function hashLeafObservationV2(value: Readonly<Record<string, unknown>>): string {
  return hashCanonicalJson({
    schema:
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_AGGREGATE_LEAF_JOIN_TEST_V2_OBSERVATION_HASH_SCHEMA,
    observation: value,
  });
}

function locatorKeyV2(identity: StableFsObjectIdentityV2): string {
  return [
    identity.filesystemScopeIdentityHash,
    identity.device,
    identity.inode,
  ].join(":");
}

export function hashPlatformReleaseBootstrapDarwinAggregateLeafJoinTestV2(
  value: PlatformReleaseBootstrapDarwinAggregateLeafJoinTestIdentityV2,
): string {
  return hashCanonicalJson({
    schema: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_AGGREGATE_LEAF_JOIN_TEST_V2_HASH_SCHEMA,
    relation: value,
  });
}

function parseAggregateV2(input: unknown): AggregateMappingV2 {
  let parsed: AggregateMappingV2;
  try {
    parsed = AggregateMappingV2Schema.parse(
      boundedInputV2(
        input,
        "Aggregate recursive mapping",
        PLATFORM_RELEASE_BOOTSTRAP_DARWIN_AGGREGATE_LEAF_JOIN_TEST_V2_MAX_INPUT_BYTES,
      ),
    );
  } catch (error) {
    if (error instanceof PlatformReleaseBootstrapDarwinAggregateLeafJoinTestErrorV2) {
      throw error;
    }
    failV2(
      "AGGREGATE_LEAF_JOIN_AGGREGATE_INVALID",
      "Aggregate recursive mapping is not one bounded self-hashed complete fixture mapping",
      error,
    );
  }
  const observation = parsed.aggregateObservation;
  const scopeHash = observation.filesystemScope.scopeIdentityHash;
  const nodeProjectionRoots =
    observation.nodePhysicalProjection.orderedEntryCaptures.filter(
      (capture) => capture.classification.category === "package_root",
    );
  if (
    observation.filesystemScope.scopeIdentityHash
      !== observation.physicalCensus.filesystemScopeIdentityHash
    || observation.physicalCensus.filesystemScopeIdentityHash
      !== nodeProjectionRoots[0]?.objectIdentity.filesystemScopeIdentityHash
    || observation.nodePhysicalProjection.sourceLogicalCensusHash
      !== observation.physicalCensus.logicalCensus.censusHash
    || observation.nodePhysicalProjection.sourcePhysicalCensusHash
      !== observation.physicalCensus.physicalCensusHash
    || observation.nodePhysicalProjection.packageRef
      !== PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.nodeToolchainProvisioner
    || observation.lockOrder[0] !== LOCK_ORDER_V2[0]
    || observation.lockOrder[1] !== LOCK_ORDER_V2[1]
  ) {
    failV2(
      "AGGREGATE_LEAF_JOIN_AGGREGATE_INVALID",
      "Aggregate mapping scope, Node projection, and lock joins are inconsistent",
    );
  }
  const physicalByLocator = new Map(
    observation.physicalCensus.orderedEntryCaptures.map((capture) => [
      locatorKeyV2(capture.objectIdentity),
      capture,
    ] as const),
  );
  const projectionLocators = new Set<string>();
  const nodeParentHash = observation.physicalCensus.parentObjectIdentity.objectIdentityHash;
  for (const capture of observation.nodePhysicalProjection.orderedEntryCaptures) {
    const key = locatorKeyV2(capture.objectIdentity);
    const globalCapture = physicalByLocator.get(key);
    if (
      capture.objectIdentity.filesystemScopeIdentityHash
        !== observation.physicalCensus.filesystemScopeIdentityHash
      || capture.parentObjectIdentityHash !== nodeParentHash
      || projectionLocators.has(key)
      || globalCapture === undefined
      || globalCapture.entryCaptureHash !== capture.entryCaptureHash
    ) {
      failV2(
        "AGGREGATE_LEAF_JOIN_AGGREGATE_INVALID",
        "Node physical projection must be an exact unique source-census subset",
      );
    }
    projectionLocators.add(key);
  }
  const physicalSharedLock = observation.physicalCensus.orderedEntryCaptures.find(
    (capture) => capture.classification.category === "shared_parent_lock",
  );
  const physicalNodeLock = observation.physicalCensus.orderedEntryCaptures.find(
    (capture) => capture.classification.category === "package_lock"
      && capture.classification.ownerRef
        === PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.nodeToolchainProvisioner,
  );
  const projectedNodeLock = observation.nodePhysicalProjection.orderedEntryCaptures.find(
    (capture) => capture.classification.category === "package_lock",
  );
  if (
    physicalSharedLock === undefined
    || physicalNodeLock === undefined
    || projectedNodeLock === undefined
    || observation.nodePhysicalProjection.packageLockObjectIdentityHash
      !== observation.heldLocks.registeredNodePackageLock.objectIdentity.objectIdentityHash
    || observation.heldLocks.registeredNodePackageLock.objectIdentity.objectIdentityHash
      !== physicalNodeLock.objectIdentity.objectIdentityHash
    || observation.heldLocks.registeredNodePackageLock.fingerprint.fingerprintHash
      !== physicalNodeLock.fingerprint.fingerprintHash
    || observation.heldLocks.sharedParentLock.objectIdentity.objectIdentityHash
      !== physicalSharedLock.objectIdentity.objectIdentityHash
    || observation.heldLocks.sharedParentLock.fingerprint.fingerprintHash
      !== physicalSharedLock.fingerprint.fingerprintHash
    || projectedNodeLock.objectIdentity.objectIdentityHash
      !== physicalNodeLock.objectIdentity.objectIdentityHash
  ) {
    failV2(
      "AGGREGATE_LEAF_JOIN_AGGREGATE_INVALID",
      "Aggregate lock evidence must join the source census and Node projection",
    );
  }
  const recursive = parsed.recursiveEvidence;
  const nodeProjectionRoot = nodeProjectionRoots[0]!;
  const recursiveRoot = recursive.orderedEntries[0]!;
  if (
    nodeProjectionRoot.classification.basename !== NODE_ROOT_BASENAME_V2
    || nodeProjectionRoot.classification.ownerKind !== "package"
    || nodeProjectionRoot.classification.ownerRef
      !== PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.nodeToolchainProvisioner
    || nodeProjectionRoot.parentObjectIdentityHash
      !== observation.physicalCensus.parentObjectIdentity.objectIdentityHash
    || recursiveRoot.role !== "root_directory"
    || recursiveRoot.parentRole !== "global_parent"
    || recursiveRoot.locator !== "."
    || recursiveRoot.objectIdentity.objectKind !== "directory"
    || nodeProjectionRoots.length !== 1
    || recursiveRoot.objectIdentity.objectIdentityHash
      !== nodeProjectionRoots[0]!.objectIdentity.objectIdentityHash
    || recursiveRoot.fingerprint.fingerprintHash
      !== nodeProjectionRoot.fingerprint.fingerprintHash
    || recursiveRoot.parentObjectIdentityHash
      !== observation.physicalCensus.parentObjectIdentity.objectIdentityHash
    || recursiveRoot.objectIdentity.filesystemScopeIdentityHash
      !== observation.filesystemScope.scopeIdentityHash
  ) {
    failV2(
      "AGGREGATE_LEAF_JOIN_AGGREGATE_INVALID",
      "Recursive Node root does not equal the global Node package-root capture",
    );
  }
  const locatorKeys = new Set<string>();
  const identityByRole = new Map<string, StableFsObjectIdentityV2>();
  for (const [index, entry] of recursive.orderedEntries.entries()) {
    const spec = RECURSIVE_TREE_SPECS_V2[index];
    const expectedParentHash = spec?.parentRole === "global_parent"
      ? nodeParentHash
      : spec === undefined
        ? undefined
        : identityByRole.get(spec.parentRole)?.objectIdentityHash;
    const contentMatches = spec?.kind === "directory"
      && entry.content.kind === "directory_membership"
      ? canonicalJsonStringify(entry.content.membership)
        === canonicalJsonStringify(buildDirectoryMembershipIdentityV2({
          orderedEntries: spec.members.map(([basename, objectKind]) => ({
            basename,
            objectKind,
          })),
        }))
      : spec?.kind === "ordinary_file"
        && entry.content.kind === "sha256_regular_file";
    const maxBytes = spec !== undefined && "maxBytes" in spec
      ? spec.maxBytes
      : undefined;
    if (
      spec === undefined
      || entry.role !== spec.role
      || entry.parentRole !== spec.parentRole
      || entry.locator !== spec.locator
      || entry.objectIdentity.objectKind !== spec.kind
      || entry.objectIdentity.filesystemScopeIdentityHash !== scopeHash
      || entry.objectIdentity.device !== recursiveRoot.objectIdentity.device
      || entry.fingerprint.objectIdentityHash
        !== entry.objectIdentity.objectIdentityHash
      || entry.fingerprint.ownerUid !== recursiveRoot.fingerprint.ownerUid
      || entry.fingerprint.ownerGid !== recursiveRoot.fingerprint.ownerGid
      || entry.fingerprint.mode !== spec.mode
      || !contentMatches
      || entry.parentObjectIdentityHash !== expectedParentHash
      || (spec.kind === "directory"
        ? entry.fingerprint.linkCount < 1
        : entry.fingerprint.linkCount !== 1
          || entry.fingerprint.byteLength < 1
          || maxBytes === undefined
          || entry.fingerprint.byteLength > maxBytes)
    ) {
      failV2(
        "AGGREGATE_LEAF_JOIN_AGGREGATE_INVALID",
        "Recursive Node evidence does not match the exact code-owned tree",
      );
    }
    const key = locatorKeyV2(entry.objectIdentity);
    if (locatorKeys.has(key) || (index > 0 && physicalByLocator.has(key))) {
      failV2(
        "AGGREGATE_LEAF_JOIN_AGGREGATE_INVALID",
        "Recursive Node entries contain a physical locator alias",
      );
    }
    locatorKeys.add(key);
    identityByRole.set(entry.role, entry.objectIdentity);
  }
  return parsed;
}

function parseV2(input: unknown): PlatformReleaseBootstrapDarwinNativePackageMemberCaptureRelationV2 {
  try {
    return parsePlatformReleaseBootstrapDarwinNativePackageMemberCaptureTestCandidateV2(
      boundedInputV2(
        input,
        "V member relation",
        PLATFORM_RELEASE_BOOTSTRAP_DARWIN_AGGREGATE_LEAF_JOIN_TEST_V2_MAX_INPUT_BYTES,
      ),
    );
  } catch (error) {
    if (error instanceof PlatformReleaseBootstrapDarwinAggregateLeafJoinTestErrorV2) {
      throw error;
    }
    failV2("AGGREGATE_LEAF_JOIN_V_INVALID", "V member relation is invalid", error);
  }
}

function parseR2(input: unknown): PlatformReleaseBootstrapReleaseCompositionMemberCaptureRelationV2 {
  try {
    return parsePlatformReleaseBootstrapReleaseCompositionMemberCaptureTestCandidateV2(
      boundedInputV2(
        input,
        "R member relation",
        PLATFORM_RELEASE_BOOTSTRAP_DARWIN_AGGREGATE_LEAF_JOIN_TEST_V2_MAX_INPUT_BYTES,
      ),
    );
  } catch (error) {
    if (error instanceof PlatformReleaseBootstrapDarwinAggregateLeafJoinTestErrorV2) {
      throw error;
    }
    failV2("AGGREGATE_LEAF_JOIN_R_INVALID", "R member relation is invalid", error);
  }
}

function parseS2(input: unknown): PlatformReleaseBootstrapDarwinSystemAnchorHashOnlyTestRelationV2 {
  try {
    const parsed = PlatformReleaseBootstrapDarwinSystemAnchorHashOnlyTestRelationV2Schema.parse(
      boundedInputV2(
        input,
        "S relation",
        PLATFORM_RELEASE_BOOTSTRAP_DARWIN_AGGREGATE_LEAF_JOIN_TEST_V2_MAX_INPUT_BYTES,
      ),
    );
    if (
      parsed.admissionScope !== "test_fixture"
      || parsed.productionAuthority !== false
      || parsed.productionAdmission !== "forbidden"
    ) {
      failV2(
        "AGGREGATE_LEAF_JOIN_S_INVALID",
        "S relation is not the exact false-authority fixture relation",
      );
    }
    return parsed;
  } catch (error) {
    if (error instanceof PlatformReleaseBootstrapDarwinAggregateLeafJoinTestErrorV2) {
      throw error;
    }
    failV2("AGGREGATE_LEAF_JOIN_S_INVALID", "S relation is invalid", error);
  }
}

function parseA2(input: unknown): PlatformReleaseBootstrapRuntimeAccountRelationTestV2 {
  try {
    const parsed = parsePlatformReleaseBootstrapRuntimeAccountRelationTestCandidateV2(
      boundedInputV2(
        input,
        "A relation",
        PLATFORM_RELEASE_BOOTSTRAP_DARWIN_AGGREGATE_LEAF_JOIN_TEST_V2_MAX_INPUT_BYTES,
      ),
    );
    if (
      parsed.admissionScope !== "test_fixture"
      || parsed.productionAuthority !== false
      || parsed.productionAdmission !== "forbidden"
      || parsed.credentialUse !== "none"
      || parsed.mutationAuthority !== false
      || parsed.trustConclusion !== "characterization_only"
    ) {
      failV2(
        "AGGREGATE_LEAF_JOIN_A_INVALID",
        "A relation is not the exact false-authority fixture relation",
      );
    }
    return parsed;
  } catch (error) {
    if (error instanceof PlatformReleaseBootstrapDarwinAggregateLeafJoinTestErrorV2) {
      throw error;
    }
    failV2("AGGREGATE_LEAF_JOIN_A_INVALID", "A relation is invalid", error);
  }
}

function assertLeafMarkersV2(
  relation: PlatformReleaseBootstrapDarwinNativePackageMemberCaptureRelationV2
    | PlatformReleaseBootstrapReleaseCompositionMemberCaptureRelationV2,
  label: string,
): void {
  if (
    relation.admissionScope !== "test_fixture"
    || relation.productionAuthority !== false
    || relation.productionAdmission !== "forbidden"
    || relation.credentialUse !== "none"
    || relation.mutationAuthority !== false
    || relation.trustConclusion !== "characterization_only"
  ) {
    failV2(
      "AGGREGATE_LEAF_JOIN_MISMATCH",
      `${label} is not an exact false-authority characterization relation`,
    );
  }
}

export function parsePlatformReleaseBootstrapDarwinAggregateLeafJoinTestCandidateV2(
  input: unknown,
): PlatformReleaseBootstrapDarwinAggregateLeafJoinTestV2 {
  try {
    const parsed = PlatformReleaseBootstrapDarwinAggregateLeafJoinTestV2Schema.parse(
      boundedInputV2(
        input,
        "Aggregate leaf join relation",
        PLATFORM_RELEASE_BOOTSTRAP_DARWIN_AGGREGATE_LEAF_JOIN_TEST_V2_MAX_CANONICAL_BYTES,
      ),
    );
    const { joinHash: _joinHash, ...identity } = parsed;
    if (parsed.joinHash !== hashPlatformReleaseBootstrapDarwinAggregateLeafJoinTestV2(identity)) {
      failV2(
        "AGGREGATE_LEAF_JOIN_SERIALIZATION_INVALID",
        "Aggregate leaf join hash mismatch",
      );
    }
    return deepFreezePlatformReleaseJsonV2(parsed);
  } catch (error) {
    if (error instanceof PlatformReleaseBootstrapDarwinAggregateLeafJoinTestErrorV2) {
      throw error;
    }
    failV2(
      "AGGREGATE_LEAF_JOIN_SERIALIZATION_INVALID",
      "Aggregate leaf join relation serialization is invalid",
      error,
    );
  }
}

export function buildPlatformReleaseBootstrapDarwinAggregateLeafJoinTestV2(
  input: PlatformReleaseBootstrapDarwinAggregateLeafJoinTestInputV2,
): PlatformReleaseBootstrapDarwinAggregateLeafJoinTestV2 {
  if (
    input === null
    || typeof input !== "object"
    || Array.isArray(input)
    || isProxy(input)
    || Object.getPrototypeOf(input) !== Object.prototype
  ) {
    failV2(
      "AGGREGATE_LEAF_JOIN_INPUT_INVALID",
      "Aggregate leaf join input must be one non-proxy plain record",
    );
  }
  try {
    assertSafeJsonGraphV2(input, "Aggregate leaf join input");
  } catch (error) {
    if (error instanceof PlatformReleaseBootstrapDarwinAggregateLeafJoinTestErrorV2) {
      throw error;
    }
    failV2("AGGREGATE_LEAF_JOIN_INPUT_INVALID", "Aggregate leaf join input is invalid", error);
  }
  const keys = Object.keys(input).sort();
  if (
    keys.length !== 5
    || keys[0] !== "aRelation"
    || keys[1] !== "aggregate"
    || keys[2] !== "rRelation"
    || keys[3] !== "sRelation"
    || keys[4] !== "vRelation"
  ) {
    failV2(
      "AGGREGATE_LEAF_JOIN_INPUT_INVALID",
      "Aggregate leaf join input contains unknown or missing fields",
    );
  }
  const aggregate = parseAggregateV2(input.aggregate);
  const vRelation = parseV2(input.vRelation);
  const rRelation = parseR2(input.rRelation);
  const sRelation = parseS2(input.sRelation);
  const aRelation = parseA2(input.aRelation);
  assertLeafMarkersV2(vRelation, "V relation");
  assertLeafMarkersV2(rRelation, "R relation");

  const aggregateObservation = aggregate.aggregateObservation;
  const scopeHash = aggregateObservation.filesystemScope.scopeIdentityHash;
  const nodeRoot = aggregate.recursiveEvidence.orderedEntries[0]!.objectIdentity;
  const vRootHash = vRelation.rootObjectIdentityHash;
  const rRootHash = rRelation.rootObjectIdentityHash;
  if (
    vRelation.filesystemScopeIdentityHash !== scopeHash
    || rRelation.filesystemScopeIdentityHash !== scopeHash
    || vRelation.packageSnapshotHash !== rRelation.packageSnapshotHash
    || vRelation.scopePublicationObservationHash
      !== rRelation.scopePublicationObservationHash
    || nodeRoot.objectIdentityHash === vRootHash
    || nodeRoot.objectIdentityHash === rRootHash
    || vRootHash === rRootHash
  ) {
    failV2(
      "AGGREGATE_LEAF_JOIN_MISMATCH",
      "Aggregate, V, and R do not share one scope/snapshot/publication or have distinct roots",
    );
  }

  const aggregateProjectionHash = hashAggregateProjectionV2({
    mappingHash: aggregate.mappingHash,
    filesystemScopeIdentityHash: scopeHash,
    capturePasses: aggregateObservation.capturePasses,
    lockOrder: aggregateObservation.lockOrder,
    nodeRootObjectIdentityHash: nodeRoot.objectIdentityHash,
    nodeRootFingerprintHash:
      aggregate.recursiveEvidence.orderedEntries[0]!.fingerprint.fingerprintHash,
  });
  const leafObservationHash = hashLeafObservationV2({
    aggregateMappingHash: aggregate.mappingHash,
    aggregateProjectionHash,
    packageSnapshotHash: vRelation.packageSnapshotHash,
    filesystemScopeIdentityHash: scopeHash,
    scopePublicationObservationHash: vRelation.scopePublicationObservationHash,
    aggregateRelationHash: aggregate.mappingHash,
    vRelationHash: vRelation.observationHash,
    rRelationHash: rRelation.observationHash,
    sRelationHash: sRelation.observationHash,
    aRelationHash: aRelation.observationHash,
    nodeRootObjectIdentityHash: nodeRoot.objectIdentityHash,
    vRootObjectIdentityHash: vRootHash,
    rRootObjectIdentityHash: rRootHash,
  });
  const identity = {
    schema:
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_AGGREGATE_LEAF_JOIN_TEST_V2_SCHEMA,
    version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
    admissionScope: "test_fixture" as const,
    authorityState: "aggregate_leaf_join_test_only" as const,
    productionAuthority: false as const,
    productionAdmission: "forbidden" as const,
    credentialUse: "none" as const,
    signingAuthority: "unsigned_test_fixture" as const,
    mutationAuthority: false as const,
    trustConclusion: "characterization_only" as const,
    semanticReady: false as const,
    joinStatus: JOIN_STATUS_V2,
    aggregateMappingHash: aggregate.mappingHash,
    aggregateProjectionHash,
    packageSnapshotHash: vRelation.packageSnapshotHash,
    filesystemScopeIdentityHash: scopeHash,
    scopePublicationObservationHash: vRelation.scopePublicationObservationHash,
    nodeRootObjectIdentityHash: nodeRoot.objectIdentityHash,
    nodeRootFingerprintHash:
      aggregate.recursiveEvidence.orderedEntries[0]!.fingerprint.fingerprintHash,
    vRootObjectIdentityHash: vRootHash,
    rRootObjectIdentityHash: rRootHash,
    aggregateRelationHash: aggregate.mappingHash,
    vRelationHash: vRelation.observationHash,
    rRelationHash: rRelation.observationHash,
    sRelationHash: sRelation.observationHash,
    aRelationHash: aRelation.observationHash,
    leafObservationHash,
  } satisfies PlatformReleaseBootstrapDarwinAggregateLeafJoinTestIdentityV2;
  return parsePlatformReleaseBootstrapDarwinAggregateLeafJoinTestCandidateV2({
    ...identity,
    joinHash:
      hashPlatformReleaseBootstrapDarwinAggregateLeafJoinTestV2(identity),
  });
}
