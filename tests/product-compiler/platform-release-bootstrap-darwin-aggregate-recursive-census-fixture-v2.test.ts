import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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
  PlatformReleaseBootstrapDarwinAggregateCensusFixtureErrorV2,
  mapPlatformReleaseBootstrapDarwinAggregateCensusFixtureV2,
} from
  "../../src/product-compiler/platform-release-bootstrap-darwin-aggregate-census-fixture-v2.js";
import {
  PlatformReleaseBootstrapDarwinAggregateRecursiveCensusFixtureErrorV2,
  mapPlatformReleaseBootstrapDarwinAggregateRecursiveCensusEvidenceStreamV2,
  mapPlatformReleaseBootstrapDarwinAggregateRecursiveCensusFixtureV2,
} from "../../src/product-compiler/platform-release-bootstrap-darwin-aggregate-recursive-census-fixture-v2.js";
import {
  buildBootstrapFilesystemScopeIdentityV2,
} from
  "../../src/product-compiler/platform-release-bootstrap-physical-census-v2.js";
import {
  canonicalJsonStringify,
  hashCanonicalJson,
} from "../../src/product-compiler/canonical-json.js";

const HEADER_SCHEMA_V2 =
  "setfarm.platform-release-bootstrap-darwin-aggregate-census-fixture-stream-header.v2";
const HEADER_SCHEMA_V3 =
  "setfarm.platform-release-bootstrap-darwin-aggregate-census-fixture-stream-header.v3";
const PARENT_SCHEMA =
  "setfarm.platform-release-bootstrap-darwin-aggregate-census-fixture-parent.v2";
const LOCKS_SCHEMA =
  "setfarm.platform-release-bootstrap-darwin-aggregate-census-fixture-locks.v2";
const ENTRY_SCHEMA =
  "setfarm.platform-release-bootstrap-darwin-aggregate-census-fixture-entry.v2";
const RECURSIVE_SCHEMA =
  "setfarm.platform-release-bootstrap-darwin-aggregate-census-fixture-node-recursive-evidence.v3";
const FOOTER_SCHEMA_V2 =
  "setfarm.platform-release-bootstrap-darwin-aggregate-census-fixture-stream-footer.v2";
const FOOTER_SCHEMA_V3 =
  "setfarm.platform-release-bootstrap-darwin-aggregate-census-fixture-stream-footer.v3";
const MAPPING_HASH_DOMAIN =
  "setfarm.platform-release-bootstrap-darwin-aggregate-recursive-census-fixture-mapping-hash.v2";
const JOIN_STATUS = "native_capture_only_requires_ts_aggregate_join_v2";
const LOCK_ORDER = [
  "shared_parent_lock",
  "registered_node_package_lock",
] as const;

type Frame = Record<string, unknown>;
type RecursiveStatus = "complete" | "root_absent" | "layout_not_exact";

const NODE_PACKAGE = PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.packages.find(
  (candidate) =>
    candidate.packageRef
      === PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.nodeToolchainProvisioner,
)!;

function b64(value: string | Buffer): string {
  return Buffer.from(value).toString("base64");
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
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

function topFile(
  basename: string,
  inode: string,
  bytes: Buffer,
  mode = "0444",
): Frame {
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
    content: {
      kind: "directory_membership",
      members: orderedMembers(members),
    },
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
    content: {
      kind: "directory_membership",
      members: orderedMembers(members),
    },
  };
}

function recursiveFile(
  role: string,
  parentRole: string,
  locator: string,
  inode: string,
  mode: "0444" | "0555",
): Frame {
  const byteLength = 64;
  return {
    role,
    parentRole,
    locator,
    stable: { objectKind: "ordinary_file", device: "7", inode },
    mutable: mutable(byteLength, mode),
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
      {
        basename: "setfarm-node-toolchain-provisioner-v2",
        objectKind: "ordinary_file",
      },
    ]),
    recursiveFile(
      "launcher_file",
      "bin_directory",
      "bin/setfarm-node-toolchain-provisioner-v2",
      "202",
      "0555",
    ),
    recursiveDirectory("lib_directory", "root_directory", "lib", "203", [
      {
        basename: "node-toolchain-provisioner-v2.cjs",
        objectKind: "ordinary_file",
      },
    ]),
    recursiveFile(
      "bundle_file",
      "lib_directory",
      "lib/node-toolchain-provisioner-v2.cjs",
      "204",
      "0444",
    ),
    recursiveFile(
      "manifest_file",
      "root_directory",
      "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MANIFEST.v2.json",
      "205",
      "0444",
    ),
    recursiveDirectory(
      "runtime_directory",
      "root_directory",
      "runtime",
      "206",
      [{ basename: "node", objectKind: "ordinary_file" }],
    ),
    recursiveFile(
      "bootstrap_runtime_file",
      "runtime_directory",
      "runtime/node",
      "207",
      "0555",
    ),
  ];
}

function validFrames(status: RecursiveStatus = "complete"): Frame[] {
  const scope = buildBootstrapFilesystemScopeIdentityV2({
    scopeNonce: "a".repeat(64),
  });
  const scopeBytes = Buffer.from(canonicalJsonStringify(scope), "utf8");
  const root = topDirectory(NODE_PACKAGE.rootBasename, "102", [
    {
      basename: "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MANIFEST.v2.json",
      objectKind: "ordinary_file",
    },
    { basename: "bin", objectKind: "directory" },
    { basename: "lib", objectKind: "directory" },
    { basename: "runtime", objectKind: "directory" },
  ]);
  if (status === "layout_not_exact") {
    (root.mutable as Frame).mode = "0700";
  }
  const entries = [
    topFile(
      PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.registry.filesystemScopeBasename,
      "101",
      scopeBytes,
    ),
    ...(status === "root_absent" ? [] : [root]),
    topFile(
      NODE_PACKAGE.lifecycle.packageLockBasename,
      "103",
      Buffer.from(
        "setfarm.node-toolchain-provisioner-bootstrap-installation-lock.v2\n",
      ),
      "0600",
    ),
    topFile(
      PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.registry.sharedLockBasename,
      "104",
      Buffer.from("setfarm.bootstrap-package-registry-parent-lock.v2\n"),
      "0600",
    ),
  ].sort((left, right) =>
    Buffer.compare(
      Buffer.from(String(left.basenameBase64), "base64"),
      Buffer.from(String(right.basenameBase64), "base64"),
    ));
  const findEntry = (basename: string): Frame => entries.find((entry) =>
    Buffer.from(String(entry.basenameBase64), "base64").toString("utf8")
      === basename)!;
  const nodeLock = findEntry(NODE_PACKAGE.lifecycle.packageLockBasename);
  const sharedLock = findEntry(
    PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.registry.sharedLockBasename,
  );
  const orderedEntries = status === "complete" ? recursiveEntries(root) : [];
  const header = {
    schema: HEADER_SCHEMA_V3,
    admissionScope: "test_fixture",
    capability:
      "darwin_read_only_aggregate_census_with_node_recursive_evidence_fixture_v3",
    productionAuthority: false,
    signingAuthority: "adhoc_or_unsigned_test_fixture",
    observationAuthority:
      "fixture_evidence_only_never_backend_capability_v2",
    capturePasses: 2,
    recursiveEvidencePolicy:
      "code_owned_exact_node_tree_descriptor_relative_v3",
    lockOrder: [...LOCK_ORDER],
  };
  const parent = {
    schema: PARENT_SCHEMA,
    stable: { objectKind: "directory", device: "7", inode: "100" },
    mutable: mutable(192, "0555", 2),
  };
  const locks = {
    schema: LOCKS_SCHEMA,
    lockOrder: [...LOCK_ORDER],
    sharedParentLock: {
      stable: structuredClone(sharedLock.stable),
      mutable: structuredClone(sharedLock.mutable),
    },
    registeredNodePackageLock: {
      stable: structuredClone(nodeLock.stable),
      mutable: structuredClone(nodeLock.mutable),
    },
  };
  const recursive = {
    schema: RECURSIVE_SCHEMA,
    admissionScope: "test_fixture",
    productionAuthority: false,
    joinStatus: JOIN_STATUS,
    rootBasename: NODE_PACKAGE.rootBasename,
    status,
    entryCount: orderedEntries.length,
    orderedEntries,
  };
  const footer = {
    schema: FOOTER_SCHEMA_V3,
    namespaceEntryCount: entries.length,
    recursiveFrameCount: 1,
    frameCount: entries.length + 5,
    completed: true,
  };
  return [header, parent, locks, ...entries, recursive, footer];
}

type ProcessOverrides = Partial<{
  exitCode: number;
  signal: string;
  stdout: Buffer;
  stderr: Buffer;
}>;

function processResult(
  frames: readonly Frame[],
  overrides: ProcessOverrides = {},
) {
  return {
    exitCode: overrides.exitCode ?? 0,
    signal: overrides.signal ?? null,
    stdout: overrides.stdout ?? Buffer.from(
      `${frames.map((frame) => JSON.stringify(frame)).join("\n")}\n`,
    ),
    stderr: overrides.stderr ?? Buffer.alloc(0),
  };
}

function cloneFrames(frames: readonly Frame[]): Frame[] {
  return structuredClone(frames) as Frame[];
}

function swapFirstTwoKeys(frame: Frame): Frame {
  const entries = Object.entries(frame);
  [entries[0], entries[1]] = [entries[1]!, entries[0]!];
  return Object.fromEntries(entries);
}

function recursiveFrame(frames: readonly Frame[]): Frame {
  return frames.find((frame) => frame.schema === RECURSIVE_SCHEMA)!;
}

function recursiveEntry(frames: readonly Frame[], index: number): Frame {
  return (recursiveFrame(frames).orderedEntries as Frame[])[index]!;
}

function topEntry(frames: readonly Frame[], basename: string): Frame {
  return frames.find((frame) =>
    frame.schema === ENTRY_SCHEMA
    && Buffer.from(String(frame.basenameBase64), "base64").toString("utf8")
      === basename)!;
}

function assertInvalid(
  frames: readonly Frame[],
  overrides: ProcessOverrides = {},
): void {
  assert.throws(
    () =>
      mapPlatformReleaseBootstrapDarwinAggregateRecursiveCensusFixtureV2(
        processResult(frames, overrides),
      ),
    PlatformReleaseBootstrapDarwinAggregateRecursiveCensusFixtureErrorV2,
  );
}

function legacyFrames(frames: readonly Frame[]): Frame[] {
  const entries = frames.filter((frame) => frame.schema === ENTRY_SCHEMA);
  return [
    {
      schema: HEADER_SCHEMA_V2,
      admissionScope: "test_fixture",
      capability: "darwin_read_only_aggregate_census_fixture_v2",
      productionAuthority: false,
      signingAuthority: "adhoc_or_unsigned_test_fixture",
      observationAuthority:
        "fixture_evidence_only_never_backend_capability_v2",
      capturePasses: 2,
      lockOrder: [...LOCK_ORDER],
    },
    structuredClone(frames[1]!),
    structuredClone(frames[2]!),
    ...structuredClone(entries),
    {
      schema: FOOTER_SCHEMA_V2,
      entryCount: entries.length,
      frameCount: entries.length + 4,
      completed: true,
    },
  ];
}

describe("Darwin aggregate recursive census fixture bridge", () => {
  it("maps one exact complete V3 stream into a frozen self-hashed pathless join", () => {
    const captured = processResult(validFrames());
    const retained = Buffer.from(captured.stdout);
    const mapped =
      mapPlatformReleaseBootstrapDarwinAggregateRecursiveCensusFixtureV2(
        captured,
      );
    const rawInput = Buffer.from(captured.stdout);
    const retainedRawInput = Buffer.from(rawInput);
    const rawMapped =
      mapPlatformReleaseBootstrapDarwinAggregateRecursiveCensusEvidenceStreamV2(
        rawInput,
      );

    assert.deepEqual(rawMapped, mapped);
    assert.equal(rawMapped.productionAuthority, false);
    assert.deepEqual(rawInput, retainedRawInput);
    assert.equal(mapped.semanticReady, false);
    assert.equal(mapped.joinStatus, JOIN_STATUS);
    assert.equal(mapped.recursiveEvidence.status, "complete");
    assert.equal(mapped.recursiveEvidence.orderedEntries.length, 8);
    assert.equal(mapped.namespaceEntryCount, 4);
    assert.equal(mapped.frameCount, 9);
    assert.equal(
      mapped.rawStreamHash,
      createHash("sha256").update(retained).digest("hex"),
    );
    const recursiveLine = retained.toString("utf8").split("\n").at(-3)!;
    assert.equal(
      mapped.recursiveLineHash,
      createHash("sha256").update(recursiveLine, "utf8").digest("hex"),
    );
    const { mappingHash, ...identity } = mapped;
    assert.equal(
      mappingHash,
      hashCanonicalJson({ schema: MAPPING_HASH_DOMAIN, mapping: identity }),
    );
    assert.equal(
      mapped.aggregateObservation.nodePhysicalProjection
        .packageLockObjectIdentityHash,
      mapped.aggregateObservation.heldLocks.registeredNodePackageLock
        .objectIdentity.objectIdentityHash,
    );
    assert.ok(Object.isFrozen(mapped));
    assert.ok(Object.isFrozen(mapped.recursiveEvidence.orderedEntries));
    assert.ok(mapped.recursiveEvidence.orderedEntries.every((entry) =>
      !entry.locator.startsWith("/") && !entry.locator.includes("\\")));
    assert.deepEqual(captured.stdout, retained);
  });

  it("mutually rejects legacy V2 and recursive V3 stream envelopes", () => {
    const v3 = validFrames();
    const v2 = legacyFrames(v3);
    assert.throws(
      () =>
        mapPlatformReleaseBootstrapDarwinAggregateCensusFixtureV2(
          processResult(v3),
        ),
      PlatformReleaseBootstrapDarwinAggregateCensusFixtureErrorV2,
    );
    assert.throws(
      () =>
        mapPlatformReleaseBootstrapDarwinAggregateRecursiveCensusFixtureV2(
          processResult(v2),
        ),
      PlatformReleaseBootstrapDarwinAggregateRecursiveCensusFixtureErrorV2,
    );
  });

  it("admits only the exact zero-entry root_absent and layout_not_exact joins", () => {
    const absent =
      mapPlatformReleaseBootstrapDarwinAggregateRecursiveCensusFixtureV2(
        processResult(validFrames("root_absent")),
      );
    assert.equal(absent.recursiveEvidence.status, "root_absent");
    assert.equal(absent.recursiveEvidence.orderedEntries.length, 0);
    assert.equal(absent.namespaceEntryCount, 3);
    assert.equal(
      absent.aggregateObservation.nodePhysicalProjection.orderedEntryCaptures
        .filter((entry) => entry.classification.category === "package_root")
        .length,
      0,
    );

    const layout =
      mapPlatformReleaseBootstrapDarwinAggregateRecursiveCensusFixtureV2(
        processResult(validFrames("layout_not_exact")),
      );
    assert.equal(layout.recursiveEvidence.status, "layout_not_exact");
    assert.equal(layout.recursiveEvidence.orderedEntries.length, 0);
    assert.equal(layout.namespaceEntryCount, 4);
    assert.equal(
      layout.aggregateObservation.nodePhysicalProjection.orderedEntryCaptures
        .filter((entry) => entry.classification.category === "package_root")
        .length,
      1,
    );

    const absentWithRoot = cloneFrames(validFrames("complete"));
    const absentRecursive = recursiveFrame(absentWithRoot);
    absentRecursive.status = "root_absent";
    absentRecursive.entryCount = 0;
    absentRecursive.orderedEntries = [];
    assertInvalid(absentWithRoot);

    const layoutWithoutRoot = cloneFrames(validFrames("root_absent"));
    recursiveFrame(layoutWithoutRoot).status = "layout_not_exact";
    assertInvalid(layoutWithoutRoot);

    const exactRootClaimedInexact = cloneFrames(validFrames("complete"));
    const exactRecursive = recursiveFrame(exactRootClaimedInexact);
    exactRecursive.status = "layout_not_exact";
    exactRecursive.entryCount = 0;
    exactRecursive.orderedEntries = [];
    assertInvalid(exactRootClaimedInexact);
  });

  it("rejects reordered header, recursive, and footer object keys", () => {
    const header = cloneFrames(validFrames());
    header[0] = swapFirstTwoKeys(header[0]!);
    assertInvalid(header);

    const recursive = cloneFrames(validFrames());
    recursive[recursive.length - 2] = swapFirstTwoKeys(
      recursive.at(-2)!,
    );
    assertInvalid(recursive);

    const footer = cloneFrames(validFrames());
    footer[footer.length - 1] = swapFirstTwoKeys(footer.at(-1)!);
    assertInvalid(footer);
  });

  it("rejects missing, duplicated, reordered, and miscounted recursive/footer frames", () => {
    const missing = cloneFrames(validFrames());
    missing.splice(-2, 1);
    assertInvalid(missing);

    const duplicated = cloneFrames(validFrames());
    duplicated.splice(-1, 0, structuredClone(duplicated.at(-2)!));
    assertInvalid(duplicated);

    const reordered = cloneFrames(validFrames());
    const recursiveIndex = reordered.length - 2;
    const namespaceIndex = recursiveIndex - 1;
    [reordered[recursiveIndex], reordered[namespaceIndex]] = [
      reordered[namespaceIndex]!,
      reordered[recursiveIndex]!,
    ];
    assertInvalid(reordered);

    const badNamespaceCount = cloneFrames(validFrames());
    badNamespaceCount.at(-1)!.namespaceEntryCount = 3;
    assertInvalid(badNamespaceCount);

    const badRecursiveCount = cloneFrames(validFrames());
    badRecursiveCount.at(-1)!.recursiveFrameCount = 0;
    assertInvalid(badRecursiveCount);

    const badFrameCount = cloneFrames(validFrames());
    badFrameCount.at(-1)!.frameCount = 8;
    assertInvalid(badFrameCount);
  });

  it("rejects tampered role, root join, membership, and content hash descriptors", () => {
    const role = cloneFrames(validFrames());
    recursiveEntry(role, 1).role = "lib_directory";
    assertInvalid(role);

    const rootJoin = cloneFrames(validFrames());
    (recursiveEntry(rootJoin, 0).stable as Frame).inode = "999";
    assertInvalid(rootJoin);

    const rootMembership = cloneFrames(validFrames());
    const rootContent = recursiveEntry(rootMembership, 0).content as Frame;
    (rootContent.members as Frame[]).pop();
    assertInvalid(rootMembership);

    const fileHash = cloneFrames(validFrames());
    const launcherContent = recursiveEntry(fileHash, 2).content as Frame;
    launcherContent.sha256 = String(launcherContent.sha256).toUpperCase();
    assertInvalid(fileHash);

    const globalRootMismatch = cloneFrames(validFrames());
    const globalRoot = topEntry(globalRootMismatch, NODE_PACKAGE.rootBasename);
    (globalRoot.mutable as Frame).modifiedNanoseconds = "18";
    assertInvalid(globalRootMismatch);
  });

  it("rejects recursive aliases, ownership changes, device changes, and lock drift", () => {
    const nestedGlobalAlias = cloneFrames(validFrames());
    recursiveEntry(nestedGlobalAlias, 2).stable = structuredClone(
      topEntry(
        nestedGlobalAlias,
        NODE_PACKAGE.lifecycle.packageLockBasename,
      ).stable,
    );
    assertInvalid(nestedGlobalAlias);

    const nestedAlias = cloneFrames(validFrames());
    recursiveEntry(nestedAlias, 4).stable = structuredClone(
      recursiveEntry(nestedAlias, 2).stable,
    );
    assertInvalid(nestedAlias);

    const owner = cloneFrames(validFrames());
    (recursiveEntry(owner, 7).mutable as Frame).ownerUid = 1;
    assertInvalid(owner);

    const device = cloneFrames(validFrames());
    (recursiveEntry(device, 7).stable as Frame).device = "8";
    assertInvalid(device);

    const lockDrift = cloneFrames(validFrames());
    const locks = lockDrift[2]!;
    ((locks.registeredNodePackageLock as Frame).stable as Frame).inode = "999";
    assertInvalid(lockDrift);
  });

  it("rejects noncanonical, nonfatal, diagnostic, and partial process output", () => {
    const frames = validFrames();
    const canonical = processResult(frames).stdout;
    assertInvalid(frames, { exitCode: 70 });
    assertInvalid(frames, { signal: "SIGKILL" });
    assertInvalid(frames, { stderr: Buffer.from("diagnostic") });
    assertInvalid(frames, { stdout: canonical.subarray(0, -1) });
    assertInvalid(frames, {
      stdout: Buffer.concat([canonical, Buffer.from("\n")]),
    });
    assertInvalid(frames, {
      stdout: Buffer.from(
        `${JSON.stringify(frames[0], null, 2)}\n${frames.slice(1)
          .map((frame) => JSON.stringify(frame)).join("\n")}\n`,
      ),
    });
    assertInvalid(frames, {
      stdout: Buffer.concat([
        Buffer.from(JSON.stringify(frames[0])),
        Buffer.from([0xff, 0x0a]),
      ]),
    });

    const unknown = cloneFrames(frames);
    unknown[0]!.unexpected = true;
    assertInvalid(unknown);
  });

  it("rejects a shadowed backing buffer without invoking its getter", () => {
    const captured = processResult(validFrames());
    let getterInvocations = 0;
    Object.defineProperty(captured.stdout.buffer, "byteLength", {
      configurable: true,
      get() {
        getterInvocations += 1;
        return 0;
      },
    });
    try {
      assert.throws(
        () =>
          mapPlatformReleaseBootstrapDarwinAggregateRecursiveCensusFixtureV2(
            captured,
          ),
        PlatformReleaseBootstrapDarwinAggregateRecursiveCensusFixtureErrorV2,
      );
      assert.equal(getterInvocations, 0);
    } finally {
      delete (captured.stdout.buffer as unknown as Frame).byteLength;
    }
  });

  it("applies the recursive 64 KiB cap including LF before JSON parsing", () => {
    const lines = validFrames().map((frame) => JSON.stringify(frame));
    lines[lines.length - 2] = "x".repeat(64 * 1024);
    const oversized = Buffer.from(`${lines.join("\n")}\n`);
    assert.throws(
      () =>
        mapPlatformReleaseBootstrapDarwinAggregateRecursiveCensusEvidenceStreamV2(
          oversized,
        ),
      (error: unknown) =>
        error instanceof
          PlatformReleaseBootstrapDarwinAggregateRecursiveCensusFixtureErrorV2
        && error.message
          === "V3 recursive frame plus LF exceeds 64 KiB",
    );
  });
});
