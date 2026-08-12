import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2,
} from "../../src/execution/schemas/platform-release-bootstrap-contract-v2.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2,
} from "../../src/execution/schemas/platform-release-bootstrap-operation-abis-v2.js";
import {
  PLATFORM_RELEASE_COMPONENT_VERSION_V2,
} from "../../src/execution/schemas/platform-release-common-v2.js";
import {
  hashPlatformReleaseBootstrapDarwinNativePackageMemberCaptureTestV2,
  parsePlatformReleaseBootstrapDarwinNativePackageMemberCaptureTestCandidateV2,
} from "../../src/product-compiler/platform-release-bootstrap-darwin-native-package-member-capture-test-support-v2.js";
import {
  hashPlatformReleaseBootstrapReleaseCompositionMemberCaptureTestV2,
  parsePlatformReleaseBootstrapReleaseCompositionMemberCaptureTestCandidateV2,
} from "../../src/product-compiler/platform-release-bootstrap-release-composition-member-capture-test-support-v2.js";
import {
  hashPlatformReleaseBootstrapRuntimeAccountRelationTestV2,
  parsePlatformReleaseBootstrapRuntimeAccountRelationTestCandidateV2,
} from "../../src/product-compiler/platform-release-bootstrap-runtime-account-relation-test-support-v2.js";
import {
  buildPlatformReleaseBootstrapDarwinAggregateLeafJoinTestV2,
  hashPlatformReleaseBootstrapDarwinAggregateLeafJoinTestV2,
  parsePlatformReleaseBootstrapDarwinAggregateLeafJoinTestCandidateV2,
  PlatformReleaseBootstrapDarwinAggregateLeafJoinTestErrorV2,
} from "../../src/product-compiler/platform-release-bootstrap-darwin-aggregate-leaf-join-test-support-v2.js";
import {
  mapPlatformReleaseBootstrapDarwinAggregateRecursiveCensusEvidenceStreamV2,
} from "../../src/product-compiler/platform-release-bootstrap-darwin-aggregate-recursive-census-fixture-v2.js";
import {
  buildBootstrapFilesystemScopeIdentityV2,
  hashPackageLifecyclePhysicalProjectionV2,
} from "../../src/product-compiler/platform-release-bootstrap-physical-census-v2.js";
import {
  canonicalJsonStringify,
  hashCanonicalJson,
} from "../../src/product-compiler/canonical-json.js";

const JOIN_STATUS = "native_capture_only_requires_ts_aggregate_join_v2";
const LOCK_ORDER = [
  "shared_parent_lock",
  "registered_node_package_lock",
] as const;
const HEADER_SCHEMA =
  "setfarm.platform-release-bootstrap-darwin-aggregate-census-fixture-stream-header.v3";
const PARENT_SCHEMA =
  "setfarm.platform-release-bootstrap-darwin-aggregate-census-fixture-parent.v2";
const LOCKS_SCHEMA =
  "setfarm.platform-release-bootstrap-darwin-aggregate-census-fixture-locks.v2";
const ENTRY_SCHEMA =
  "setfarm.platform-release-bootstrap-darwin-aggregate-census-fixture-entry.v2";
const RECURSIVE_SCHEMA =
  "setfarm.platform-release-bootstrap-darwin-aggregate-census-fixture-node-recursive-evidence.v3";
const FOOTER_SCHEMA =
  "setfarm.platform-release-bootstrap-darwin-aggregate-census-fixture-stream-footer.v3";
const AGGREGATE_MAPPING_HASH_DOMAIN =
  "setfarm.platform-release-bootstrap-darwin-aggregate-recursive-census-fixture-mapping-hash.v2";

type Frame = Record<string, unknown>;

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function b64(value: string | Buffer): string {
  return Buffer.from(value).toString("base64");
}

function mutable(byteLength: number, mode = "0444", linkCount = 1): Frame {
  return {
    ownerUid: 0,
    ownerGid: 0,
    mode,
    linkCount,
    byteLength,
    modifiedSeconds: "100",
    modifiedNanoseconds: "17",
    changedSeconds: "101",
    changedNanoseconds: "19",
  };
}

function orderedMembers(
  members: readonly Readonly<{
    basename: string;
    objectKind: "ordinary_file" | "directory";
  }>[],
): Frame[] {
  return [...members]
    .sort((left, right) =>
      Buffer.compare(Buffer.from(left.basename), Buffer.from(right.basename)))
    .map((member) => ({
      basenameBase64: b64(member.basename),
      objectKind: member.objectKind,
    }));
}

function topFile(basename: string, inode: string, bytes: Buffer, mode = "0444"): Frame {
  return {
    schema: ENTRY_SCHEMA,
    basenameBase64: b64(basename),
    stable: { objectKind: "ordinary_file", device: "7", inode },
    mutable: mutable(bytes.byteLength, mode),
    content: {
      kind: "bounded_regular_file_bytes",
      byteLength: bytes.byteLength,
      contentBase64: b64(bytes),
    },
  };
}

function topDirectory(
  basename: string,
  inode: string,
  members: Parameters<typeof orderedMembers>[0],
): Frame {
  return {
    schema: ENTRY_SCHEMA,
    basenameBase64: b64(basename),
    stable: { objectKind: "directory", device: "7", inode },
    mutable: mutable(128, "0555", 2),
    content: { kind: "directory_membership", members: orderedMembers(members) },
  };
}

function recursiveDirectory(
  role: string,
  parentRole: string,
  locator: string,
  inode: string,
  members: Parameters<typeof orderedMembers>[0],
): Frame {
  return {
    role,
    parentRole,
    locator,
    stable: { objectKind: "directory", device: "7", inode },
    mutable: mutable(128, "0555", 2),
    content: { kind: "directory_membership", members: orderedMembers(members) },
  };
}

function recursiveFile(
  role: string,
  parentRole: string,
  locator: string,
  inode: string,
  mode: "0444" | "0555",
): Frame {
  return {
    role,
    parentRole,
    locator,
    stable: { objectKind: "ordinary_file", device: "7", inode },
    mutable: mutable(64, mode),
    content: {
      kind: "sha256_regular_file",
      sha256: sha256(`${role}-fixture-bytes`),
    },
  };
}

function recursiveEntries(root: Frame): Frame[] {
  return [
    {
      role: "root_directory",
      parentRole: "global_parent",
      locator: ".",
      stable: structuredClone(root.stable),
      mutable: structuredClone(root.mutable),
      content: structuredClone(root.content),
    },
    recursiveDirectory("bin_directory", "root_directory", "bin", "201", [
      { basename: "setfarm-node-toolchain-provisioner-v2", objectKind: "ordinary_file" },
    ]),
    recursiveFile("launcher_file", "bin_directory", "bin/setfarm-node-toolchain-provisioner-v2", "202", "0555"),
    recursiveDirectory("lib_directory", "root_directory", "lib", "203", [
      { basename: "node-toolchain-provisioner-v2.cjs", objectKind: "ordinary_file" },
    ]),
    recursiveFile("bundle_file", "lib_directory", "lib/node-toolchain-provisioner-v2.cjs", "204", "0444"),
    recursiveFile("manifest_file", "root_directory", "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MANIFEST.v2.json", "205", "0444"),
    recursiveDirectory("runtime_directory", "root_directory", "runtime", "206", [
      { basename: "node", objectKind: "ordinary_file" },
    ]),
    recursiveFile("bootstrap_runtime_file", "runtime_directory", "runtime/node", "207", "0555"),
  ];
}

function aggregateFrames(): Frame[] {
  const nodePackage = PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.packages.find(
    (entry) => entry.packageRef === PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.nodeToolchainProvisioner,
  )!;
  const scope = buildBootstrapFilesystemScopeIdentityV2({ scopeNonce: "a".repeat(64) });
  const scopeBytes = Buffer.from(canonicalJsonStringify(scope), "utf8");
  const root = topDirectory(nodePackage.rootBasename, "102", [
    { basename: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MANIFEST.v2.json", objectKind: "ordinary_file" },
    { basename: "bin", objectKind: "directory" },
    { basename: "lib", objectKind: "directory" },
    { basename: "runtime", objectKind: "directory" },
  ]);
  const entries = [
    topFile(PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.registry.filesystemScopeBasename, "101", scopeBytes),
    root,
    topFile(nodePackage.lifecycle.packageLockBasename, "103", Buffer.from("setfarm.node-toolchain-provisioner-bootstrap-installation-lock.v2\n"), "0600"),
    topFile(PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.registry.sharedLockBasename, "104", Buffer.from("setfarm.bootstrap-package-registry-parent-lock.v2\n"), "0600"),
  ].sort((left, right) => Buffer.compare(Buffer.from(String(left.basenameBase64), "base64"), Buffer.from(String(right.basenameBase64), "base64")));
  const findEntry = (basename: string): Frame => entries.find((entry) =>
    Buffer.from(String(entry.basenameBase64), "base64").toString("utf8") === basename)!;
  const recursive = recursiveEntries(root);
  return [
    {
      schema: HEADER_SCHEMA,
      admissionScope: "test_fixture",
      capability: "darwin_read_only_aggregate_census_with_node_recursive_evidence_fixture_v3",
      productionAuthority: false,
      signingAuthority: "adhoc_or_unsigned_test_fixture",
      observationAuthority: "fixture_evidence_only_never_backend_capability_v2",
      capturePasses: 2,
      recursiveEvidencePolicy: "code_owned_exact_node_tree_descriptor_relative_v3",
      lockOrder: [...LOCK_ORDER],
    },
    {
      schema: PARENT_SCHEMA,
      stable: { objectKind: "directory", device: "7", inode: "100" },
      mutable: mutable(192, "0555", 2),
    },
    {
      schema: LOCKS_SCHEMA,
      lockOrder: [...LOCK_ORDER],
      sharedParentLock: { stable: structuredClone(findEntry(PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.registry.sharedLockBasename).stable), mutable: structuredClone(findEntry(PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.registry.sharedLockBasename).mutable) },
      registeredNodePackageLock: { stable: structuredClone(findEntry(nodePackage.lifecycle.packageLockBasename).stable), mutable: structuredClone(findEntry(nodePackage.lifecycle.packageLockBasename).mutable) },
    },
    ...entries,
    {
      schema: RECURSIVE_SCHEMA,
      admissionScope: "test_fixture",
      productionAuthority: false,
      joinStatus: JOIN_STATUS,
      rootBasename: nodePackage.rootBasename,
      status: "complete",
      entryCount: recursive.length,
      orderedEntries: recursive,
    },
    {
      schema: FOOTER_SCHEMA,
      namespaceEntryCount: entries.length,
      recursiveFrameCount: 1,
      frameCount: entries.length + 5,
      completed: true,
    },
  ];
}

function aggregateFixture() {
  const bytes = Buffer.from(`${aggregateFrames().map((frame) => JSON.stringify(frame)).join("\n")}\n`, "utf8");
  try {
    return mapPlatformReleaseBootstrapDarwinAggregateRecursiveCensusEvidenceStreamV2(bytes);
  } finally {
    bytes.fill(0);
  }
}

function relationFixtures(aggregate: ReturnType<typeof aggregateFixture>) {
  const scopeHash = aggregate.aggregateObservation.filesystemScope.scopeIdentityHash;
  const packageSnapshotHash = sha256("shared-package-snapshot");
  const publicationHash = sha256("shared-scope-publication");
  const vIdentity = {
    schema: "setfarm.platform-release-bootstrap-darwin-native-package-member-capture-test.v2" as const,
    version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
    admissionScope: "test_fixture" as const,
    authorityState: "caller_supplied_test_mechanics_only" as const,
    productionAuthority: false as const,
    productionAdmission: "forbidden" as const,
    credentialUse: "none" as const,
    signingAuthority: "unsigned_test_fixture" as const,
    mutationAuthority: false as const,
    trustConclusion: "characterization_only" as const,
    packageSnapshotHash,
    filesystemScopeIdentityHash: scopeHash,
    scopePublicationObservationHash: publicationHash,
    verificationReceiptHash: sha256("v-receipt"),
    selectionHash: sha256("v-selection"),
    rootObjectIdentityHash: sha256("v-root"),
    binDirectoryObjectIdentityHash: sha256("v-bin"),
    manifestObjectIdentityHash: sha256("v-manifest"),
    executableObjectIdentityHash: sha256("v-executable"),
    memberCaptureObservationHash: sha256("v-observation"),
  };
  const vRelation = parsePlatformReleaseBootstrapDarwinNativePackageMemberCaptureTestCandidateV2({
    ...vIdentity,
    observationHash: hashPlatformReleaseBootstrapDarwinNativePackageMemberCaptureTestV2(vIdentity),
  });
  const rIdentity = {
    schema: "setfarm.platform-release-bootstrap-release-composition-member-capture-test.v2" as const,
    version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
    admissionScope: "test_fixture" as const,
    authorityState: "caller_supplied_test_mechanics_only" as const,
    productionAuthority: false as const,
    productionAdmission: "forbidden" as const,
    credentialUse: "none" as const,
    signingAuthority: "unsigned_test_fixture" as const,
    mutationAuthority: false as const,
    trustConclusion: "characterization_only" as const,
    packageSnapshotHash,
    filesystemScopeIdentityHash: scopeHash,
    scopePublicationObservationHash: publicationHash,
    sealedRootProvenanceHash: null,
    rootObjectIdentityHash: sha256("r-root"),
    binDirectoryObjectIdentityHash: sha256("r-bin"),
    libDirectoryObjectIdentityHash: sha256("r-lib"),
    manifestObjectIdentityHash: sha256("r-manifest"),
    executableObjectIdentityHash: sha256("r-executable"),
    releaseModuleObjectIdentityHash: sha256("r-release-module"),
    metadataModuleObjectIdentityHash: sha256("r-metadata-module"),
    networkWrapperModuleObjectIdentityHash: sha256("r-network-module"),
    memberCaptureObservationHash: sha256("r-observation"),
  };
  const rRelation = parsePlatformReleaseBootstrapReleaseCompositionMemberCaptureTestCandidateV2({
    ...rIdentity,
    observationHash: hashPlatformReleaseBootstrapReleaseCompositionMemberCaptureTestV2(rIdentity),
  });
  const sRelation = {
    relation: "external_system_anchor_observation_hash_only_test_relation_v2" as const,
    admissionScope: "test_fixture" as const,
    productionAuthority: false as const,
    productionAdmission: "forbidden" as const,
    observationHash: sha256("s-observation"),
  };
  const aIdentity = {
    schema: "setfarm.platform-release-bootstrap-runtime-account-relation-test.v2" as const,
    version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
    admissionScope: "test_fixture" as const,
    authorityState: "observed_test_fixture_unverified" as const,
    productionAuthority: false as const,
    productionAdmission: "forbidden" as const,
    credentialUse: "none" as const,
    mutationAuthority: false as const,
    trustConclusion: "characterization_only" as const,
    provisioningReceiptHash: sha256("a-receipt"),
    beforeLookupObservationHash: sha256("a-before"),
    afterLookupObservationHash: sha256("a-after"),
    stableRecordProjectionHash: sha256("a-record"),
  };
  const aRelation = parsePlatformReleaseBootstrapRuntimeAccountRelationTestCandidateV2({
    ...aIdentity,
    observationHash: hashPlatformReleaseBootstrapRuntimeAccountRelationTestV2(aIdentity),
  });
  return { aggregate, vRelation, rRelation, sRelation, aRelation };
}

function validInput() {
  return relationFixtures(aggregateFixture());
}

function assertInvalid(action: () => unknown): void {
  assert.throws(action, (error: unknown) =>
    error instanceof PlatformReleaseBootstrapDarwinAggregateLeafJoinTestErrorV2);
}

describe("Darwin aggregate V/R/S/A leaf hash join test v2", () => {
  it("joins one recursive aggregate and four false-authority leaf relations", () => {
    const input = validInput();
    const relation = buildPlatformReleaseBootstrapDarwinAggregateLeafJoinTestV2(input);
    assert.equal(relation.productionAuthority, false);
    assert.equal(relation.productionAdmission, "forbidden");
    assert.equal(relation.credentialUse, "none");
    assert.equal(relation.semanticReady, false);
    assert.equal(relation.joinStatus, JOIN_STATUS);
    assert.equal(relation.filesystemScopeIdentityHash, input.aggregate.aggregateObservation.filesystemScope.scopeIdentityHash);
    assert.notEqual(relation.nodeRootObjectIdentityHash, relation.vRootObjectIdentityHash);
    assert.notEqual(relation.nodeRootObjectIdentityHash, relation.rRootObjectIdentityHash);
    assert.notEqual(relation.vRootObjectIdentityHash, relation.rRootObjectIdentityHash);
    assert.equal("path" in relation, false);
    assert.equal("capability" in relation, false);
    assert.equal(Object.isFrozen(relation), true);
    assert.equal(parsePlatformReleaseBootstrapDarwinAggregateLeafJoinTestCandidateV2(relation).joinHash, relation.joinHash);
  });

  it("rejects scope/snapshot/publication splice and any root alias", () => {
    const input = validInput();
    const scope = structuredClone(input.vRelation) as any;
    scope.filesystemScopeIdentityHash = sha256("foreign-scope");
    const { observationHash: _scopeOld, ...scopeIdentity } = scope;
    scope.observationHash = hashPlatformReleaseBootstrapDarwinNativePackageMemberCaptureTestV2(scopeIdentity);
    assertInvalid(() => buildPlatformReleaseBootstrapDarwinAggregateLeafJoinTestV2({ ...input, vRelation: scope }));

    const snapshot = structuredClone(input.rRelation) as any;
    snapshot.packageSnapshotHash = sha256("foreign-snapshot");
    const { observationHash: _old, ...snapshotIdentity } = snapshot;
    snapshot.observationHash = hashPlatformReleaseBootstrapReleaseCompositionMemberCaptureTestV2(snapshotIdentity);
    assertInvalid(() => buildPlatformReleaseBootstrapDarwinAggregateLeafJoinTestV2({ ...input, rRelation: snapshot }));

    const alias = structuredClone(input.rRelation) as any;
    alias.rootObjectIdentityHash = input.vRelation.rootObjectIdentityHash;
    const { observationHash: _aliasOld, ...aliasIdentity } = alias;
    alias.observationHash = hashPlatformReleaseBootstrapReleaseCompositionMemberCaptureTestV2(aliasIdentity);
    assertInvalid(() => buildPlatformReleaseBootstrapDarwinAggregateLeafJoinTestV2({ ...input, rRelation: alias }));
  });

  it("rejects aggregate marker/hash drift and hostile input graphs", () => {
    const input = validInput();
    const marker = structuredClone(input.aggregate) as any;
    marker.semanticReady = true;
    const { mappingHash: _markerOld, ...markerIdentity } = marker;
    marker.mappingHash = hashCanonicalJson({ schema: AGGREGATE_MAPPING_HASH_DOMAIN, mapping: markerIdentity });
    assertInvalid(() => buildPlatformReleaseBootstrapDarwinAggregateLeafJoinTestV2({ ...input, aggregate: marker }));

    const tampered = structuredClone(input.aggregate) as any;
    tampered.mappingHash = "f".repeat(64);
    assertInvalid(() => buildPlatformReleaseBootstrapDarwinAggregateLeafJoinTestV2({ ...input, aggregate: tampered }));
    const sourceSplice = structuredClone(input.aggregate) as any;
    const nodeProjection = sourceSplice.aggregateObservation.nodePhysicalProjection;
    nodeProjection.sourcePhysicalCensusHash = sha256("foreign-physical-census");
    const { projectionHash: _projectionOld, ...projectionIdentity } = nodeProjection;
    nodeProjection.projectionHash = hashPackageLifecyclePhysicalProjectionV2(projectionIdentity);
    const { mappingHash: _sourceOld, ...sourceIdentity } = sourceSplice;
    sourceSplice.mappingHash = hashCanonicalJson({ schema: AGGREGATE_MAPPING_HASH_DOMAIN, mapping: sourceIdentity });
    assertInvalid(() => buildPlatformReleaseBootstrapDarwinAggregateLeafJoinTestV2({ ...input, aggregate: sourceSplice }));

    assertInvalid(() => buildPlatformReleaseBootstrapDarwinAggregateLeafJoinTestV2(new Proxy(input, {})));
    assertInvalid(() => buildPlatformReleaseBootstrapDarwinAggregateLeafJoinTestV2(null as any));
    assertInvalid(() => buildPlatformReleaseBootstrapDarwinAggregateLeafJoinTestV2(undefined as any));
    const accessor: Record<string, unknown> = { ...input };
    Object.defineProperty(accessor, "vRelation", { enumerable: true, get: () => input.vRelation });
    assertInvalid(() => buildPlatformReleaseBootstrapDarwinAggregateLeafJoinTestV2(accessor as any));
    assertInvalid(() => buildPlatformReleaseBootstrapDarwinAggregateLeafJoinTestV2({ ...input, extra: true } as any));
    const cycle: any = { ...input, aggregate: {} };
    cycle.aggregate.self = cycle;
    assertInvalid(() => buildPlatformReleaseBootstrapDarwinAggregateLeafJoinTestV2(cycle));
  });

  it("keeps relation hash changes observable while retaining the forbidden boundary", () => {
    const input = validInput();
    const first = buildPlatformReleaseBootstrapDarwinAggregateLeafJoinTestV2(input);
    const alteredS = { ...input.sRelation, observationHash: sha256("another-s-observation") };
    const second = buildPlatformReleaseBootstrapDarwinAggregateLeafJoinTestV2({ ...input, sRelation: alteredS });
    assert.notEqual(second.joinHash, first.joinHash);
    assert.notEqual(second.sRelationHash, first.sRelationHash);
    assert.equal(second.productionAuthority, false);
  });

  it("rejects a forged component projection even when the outer join hash is recomputed", () => {
    const input = validInput();
    const relation = buildPlatformReleaseBootstrapDarwinAggregateLeafJoinTestV2(input);
    const forged = structuredClone(relation) as any;
    forged.aggregateProjectionHash = sha256("foreign-projection");
    const { joinHash: _oldJoin, ...identity } = forged;
    forged.joinHash = hashPlatformReleaseBootstrapDarwinAggregateLeafJoinTestV2(identity);
    assertInvalid(() => parsePlatformReleaseBootstrapDarwinAggregateLeafJoinTestCandidateV2(forged));
  });

  it("has no filesystem, child-process, or production-opener authority", () => {
    const source = readFileSync("src/product-compiler/platform-release-bootstrap-darwin-aggregate-leaf-join-test-support-v2.ts", "utf8");
    assert.equal(source.includes("node:fs"), false);
    assert.equal(source.includes("node:child_process"), false);
    assert.equal(source.includes("openProductionAuthenticatedDarwinFilesystemBackendV2"), false);
    assert.equal(source.includes("openPlatformReleaseHostCompositionAuthorityV2Internal"), false);
  });
});
