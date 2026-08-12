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
  PlatformReleaseBootstrapDarwinAggregateCensusFixtureErrorV2,
  mapPlatformReleaseBootstrapDarwinAggregateCensusFixtureV2,
} from
  "../../src/product-compiler/platform-release-bootstrap-darwin-aggregate-census-fixture-v2.js";
import {
  buildBootstrapFilesystemScopeIdentityV2,
} from
  "../../src/product-compiler/platform-release-bootstrap-physical-census-v2.js";
import {
  canonicalJsonStringify,
} from "../../src/product-compiler/canonical-json.js";

const HEADER_SCHEMA =
  "setfarm.platform-release-bootstrap-darwin-aggregate-census-fixture-stream-header.v2";
const PARENT_SCHEMA =
  "setfarm.platform-release-bootstrap-darwin-aggregate-census-fixture-parent.v2";
const LOCKS_SCHEMA =
  "setfarm.platform-release-bootstrap-darwin-aggregate-census-fixture-locks.v2";
const ENTRY_SCHEMA =
  "setfarm.platform-release-bootstrap-darwin-aggregate-census-fixture-entry.v2";
const FOOTER_SCHEMA =
  "setfarm.platform-release-bootstrap-darwin-aggregate-census-fixture-stream-footer.v2";

type Frame = Record<string, unknown>;

function b64(value: string | Buffer): string {
  return Buffer.from(value).toString("base64");
}

function mutable(byteLength: number, mode = "0444") {
  return {
    ownerUid: 0,
    ownerGid: 0,
    mode,
    linkCount: 1,
    byteLength,
    modifiedSeconds: "100",
    modifiedNanoseconds: "17",
    changedSeconds: "101",
    changedNanoseconds: "19",
  };
}

function fileEntry(
  basename: string,
  inode: string,
  bytes: Buffer,
  mode = "0444",
): Frame {
  return {
    schema: ENTRY_SCHEMA,
    basenameBase64: b64(basename),
    stable: {
      objectKind: "ordinary_file",
      device: "7",
      inode,
    },
    mutable: mutable(bytes.byteLength, mode),
    content: {
      kind: "bounded_regular_file_bytes",
      byteLength: bytes.byteLength,
      contentBase64: b64(bytes),
    },
  };
}

function directoryEntry(
  basename: string,
  inode: string,
  members: readonly Readonly<{
    basename: string;
    objectKind: "ordinary_file" | "directory";
  }>[],
): Frame {
  const orderedMembers = [...members].sort((left, right) =>
    Buffer.compare(Buffer.from(left.basename), Buffer.from(right.basename)));
  return {
    schema: ENTRY_SCHEMA,
    basenameBase64: b64(basename),
    stable: {
      objectKind: "directory",
      device: "7",
      inode,
    },
    mutable: mutable(128, "0555"),
    content: {
      kind: "directory_membership",
      members: orderedMembers.map((member) => ({
        basenameBase64: b64(member.basename),
        objectKind: member.objectKind,
      })),
    },
  };
}

function validFrames(): Frame[] {
  const scope = buildBootstrapFilesystemScopeIdentityV2({
    scopeNonce: "a".repeat(64),
  });
  const scopeBytes = Buffer.from(canonicalJsonStringify(scope), "utf8");
  const nodePackage = PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.packages.find(
    (entry) =>
      entry.packageRef
        === PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.nodeToolchainProvisioner,
  )!;
  const entries = [
    fileEntry(
      PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.registry.filesystemScopeBasename,
      "101",
      scopeBytes,
    ),
    directoryEntry(nodePackage.rootBasename, "102", [
      { basename: "artifact", objectKind: "ordinary_file" },
      { basename: "cache", objectKind: "directory" },
      { basename: "\u{10000}", objectKind: "ordinary_file" },
      { basename: "\uE000", objectKind: "ordinary_file" },
    ]),
    fileEntry(
      nodePackage.lifecycle.packageLockBasename,
      "103",
      Buffer.from(
        "setfarm.node-toolchain-provisioner-bootstrap-installation-lock.v2\n",
      ),
      "0600",
    ),
    fileEntry(
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
  const header = {
    schema: HEADER_SCHEMA,
    admissionScope: "test_fixture",
    capability: "darwin_read_only_aggregate_census_fixture_v2",
    productionAuthority: false,
    signingAuthority: "adhoc_or_unsigned_test_fixture",
    observationAuthority:
      "fixture_evidence_only_never_backend_capability_v2",
    capturePasses: 2,
    lockOrder: [
      "shared_parent_lock",
      "registered_node_package_lock",
    ],
  };
  const parent = {
    schema: PARENT_SCHEMA,
    stable: {
      objectKind: "directory",
      device: "7",
      inode: "100",
    },
    mutable: mutable(192, "0555"),
  };
  const sharedLockEntry = entries.find((entry) =>
    Buffer.from(String(entry.basenameBase64), "base64").toString("utf8")
      === PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.registry.sharedLockBasename)!;
  const nodeLockEntry = entries.find((entry) =>
    Buffer.from(String(entry.basenameBase64), "base64").toString("utf8")
      === nodePackage.lifecycle.packageLockBasename)!;
  const locks = {
    schema: LOCKS_SCHEMA,
    lockOrder: [
      "shared_parent_lock",
      "registered_node_package_lock",
    ],
    sharedParentLock: {
      stable: structuredClone(sharedLockEntry.stable),
      mutable: structuredClone(sharedLockEntry.mutable),
    },
    registeredNodePackageLock: {
      stable: structuredClone(nodeLockEntry.stable),
      mutable: structuredClone(nodeLockEntry.mutable),
    },
  };
  const footer = {
    schema: FOOTER_SCHEMA,
    entryCount: entries.length,
    frameCount: entries.length + 4,
    completed: true,
  };
  return [header, parent, locks, ...entries, footer];
}

function processResult(
  frames: readonly Frame[],
  overrides: Partial<{
    exitCode: number | null;
    signal: string | null;
    stdout: Buffer;
    stderr: Buffer;
  }> = {},
) {
  return {
    exitCode: overrides.exitCode ?? 0,
    signal: overrides.signal ?? null,
    stdout: overrides.stdout
      ?? Buffer.from(`${frames.map((frame) => JSON.stringify(frame)).join("\n")}\n`),
    stderr: overrides.stderr ?? Buffer.alloc(0),
  };
}

function cloneFrames(frames: readonly Frame[]): Frame[] {
  return structuredClone(frames) as Frame[];
}

function entryFrame(frames: readonly Frame[], basename: string): Frame {
  return frames.find((frame) =>
    frame.schema === ENTRY_SCHEMA
    && Buffer.from(String(frame.basenameBase64), "base64").toString("utf8")
      === basename)!;
}

function assertInvalid(
  frames: readonly Frame[],
  overrides: Parameters<typeof processResult>[1] = {},
): void {
  assert.throws(
    () =>
      mapPlatformReleaseBootstrapDarwinAggregateCensusFixtureV2(
        processResult(frames, overrides),
      ),
    PlatformReleaseBootstrapDarwinAggregateCensusFixtureErrorV2,
  );
}

describe("Darwin aggregate census fixture bridge", () => {
  it("maps one exact completed fixture stream into pathless logical and physical Node projections", () => {
    const captured = processResult(validFrames());
    const retainedStdout = Buffer.from(captured.stdout);
    const mapped =
      mapPlatformReleaseBootstrapDarwinAggregateCensusFixtureV2(
        captured,
      );

    assert.equal(mapped.admissionScope, "test_fixture");
    assert.equal(mapped.productionAuthority, false);
    assert.equal(
      mapped.observationAuthority,
      "fixture_evidence_only_never_backend_capability_v2",
    );
    assert.deepEqual(mapped.lockOrder, [
      "shared_parent_lock",
      "registered_node_package_lock",
    ]);
    assert.equal(mapped.capturePasses, 2);
    assert.equal(mapped.logicalCensus.entryCount, 4);
    assert.equal(mapped.physicalCensus.entryCount, 4);
    assert.equal(
      mapped.nodeLogicalProjection.packageRef,
      PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.nodeToolchainProvisioner,
    );
    assert.equal(mapped.nodeLogicalProjection.entryCount, 2);
    assert.equal(mapped.nodePhysicalProjection.entryCount, 2);
    assert.equal(
      mapped.nodePhysicalProjection.packageLockObjectIdentityHash,
      mapped.heldLocks.registeredNodePackageLock.objectIdentity.objectIdentityHash,
    );
    assert.notEqual(
      mapped.physicalCensus.parentObjectIdentity.objectIdentityHash,
      mapped.physicalCensus.parentFingerprint.fingerprintHash,
    );
    assert.equal(
      mapped.physicalCensus.orderedEntryCaptures.find((entry) =>
        entry.classification.category === "package_root")
        ?.contentEvidence.kind,
      "directory_membership",
    );
    const rootEvidence = mapped.physicalCensus.orderedEntryCaptures.find(
      (entry) => entry.classification.category === "package_root",
    )?.contentEvidence;
    assert.equal(rootEvidence?.kind, "directory_membership");
    if (rootEvidence?.kind !== "directory_membership") {
      throw new Error("Expected one directory membership");
    }
    assert.deepEqual(
      rootEvidence.membership.orderedEntries.map((entry) => entry.basename),
      ["artifact", "cache", "\u{10000}", "\uE000"],
    );
    assert.ok(Object.isFrozen(mapped));
    assert.ok(Object.isFrozen(mapped.physicalCensus));
    assert.deepEqual(captured.stdout, retainedStdout);
  });

  it("rejects nonzero, signaled, diagnostic, partial, extra, and noncanonical process output", () => {
    const frames = validFrames();
    assertInvalid(frames, { exitCode: 70 });
    assertInvalid(frames, { signal: "SIGKILL" });
    assertInvalid(frames, { stderr: Buffer.from("diagnostic") });
    assertInvalid(frames, {
      stdout: Buffer.from(frames.map((frame) => JSON.stringify(frame)).join("\n")),
    });
    assertInvalid(frames, {
      stdout: Buffer.from(
        `${frames.map((frame) => JSON.stringify(frame)).join("\n")}\n{}\n`,
      ),
    });
    assertInvalid(frames, {
      stdout: Buffer.from(
        `${frames.map((frame) => JSON.stringify(frame)).join("\n")}\n\n`,
      ),
    });
    assertInvalid(frames, {
      stdout: Buffer.concat([
        Buffer.from(JSON.stringify(frames[0])),
        Buffer.from([0xff, 0x0a]),
      ]),
    });

    const laterInvalid = cloneFrames(frames);
    laterInvalid.at(-1)!.completed = false;
    const retained = processResult(laterInvalid);
    const retainedStdout = Buffer.from(retained.stdout);
    assert.throws(
      () => mapPlatformReleaseBootstrapDarwinAggregateCensusFixtureV2(retained),
      PlatformReleaseBootstrapDarwinAggregateCensusFixtureErrorV2,
    );
    assert.deepEqual(retained.stdout, retainedStdout);
  });

  it("rejects unknown keys, malformed base64/UTF-8, foreign names, and scope mismatch", () => {
    const unknownKey = cloneFrames(validFrames());
    unknownKey[0]!.unexpected = true;
    assertInvalid(unknownKey);

    const noncanonicalBase64 = cloneFrames(validFrames());
    const firstEntry = noncanonicalBase64[3]!;
    firstEntry.basenameBase64 = `${String(firstEntry.basenameBase64)}=`;
    assertInvalid(noncanonicalBase64);

    const invalidUtf8 = cloneFrames(validFrames());
    invalidUtf8[3]!.basenameBase64 = "/w==";
    assertInvalid(invalidUtf8);

    const foreign = cloneFrames(validFrames());
    foreign[3]!.basenameBase64 = b64("foreign-member");
    assertInvalid(foreign);

    const scopeMismatch = cloneFrames(validFrames());
    const scopeFrame = scopeMismatch.find((frame) =>
      Buffer.from(String(frame.basenameBase64 ?? ""), "base64").toString("utf8")
        === PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.registry.filesystemScopeBasename)!;
    const content = scopeFrame.content as Frame;
    const scope = JSON.parse(
      Buffer.from(String(content.contentBase64), "base64").toString("utf8"),
    ) as Frame;
    scope.scopeNonce = "b".repeat(64);
    const tampered = Buffer.from(canonicalJsonStringify(scope));
    content.byteLength = tampered.byteLength;
    content.contentBase64 = b64(tampered);
    (scopeFrame.mutable as Frame).byteLength = tampered.byteLength;
    assertInvalid(scopeMismatch);
  });

  it("rejects duplicate, reordered, aliased, count-mismatched, and nested-member streams", () => {
    const reordered = cloneFrames(validFrames());
    [reordered[3], reordered[4]] = [reordered[4]!, reordered[3]!];
    assertInvalid(reordered);

    const duplicate = cloneFrames(validFrames());
    duplicate.splice(4, 0, structuredClone(duplicate[3]!));
    const duplicateFooter = duplicate.at(-1)!;
    duplicateFooter.entryCount = 5;
    duplicateFooter.frameCount = 9;
    assertInvalid(duplicate);

    const aliased = cloneFrames(validFrames());
    aliased[4]!.stable = structuredClone(aliased[3]!.stable);
    assertInvalid(aliased);

    const countMismatch = cloneFrames(validFrames());
    countMismatch.at(-1)!.entryCount = 2;
    assertInvalid(countMismatch);

    const nestedReordered = cloneFrames(validFrames());
    const directory = nestedReordered.find((frame) =>
      (frame.stable as Frame | undefined)?.objectKind === "directory"
      && frame.schema === ENTRY_SCHEMA)!;
    const members = (directory.content as Frame).members as Frame[];
    members.reverse();
    assertInvalid(nestedReordered);

    const contentLengthMismatch = cloneFrames(validFrames());
    const file = contentLengthMismatch.find((frame) =>
      (frame.stable as Frame | undefined)?.objectKind === "ordinary_file")!;
    (file.content as Frame).byteLength = 999;
    assertInvalid(contentLengthMismatch);

    const heldLockMismatch = cloneFrames(validFrames());
    const locks = heldLockMismatch[2]!;
    ((locks.sharedParentLock as Frame).stable as Frame).inode = "999";
    assertInvalid(heldLockMismatch);
  });

  it("rejects cleanly joined held locks with non-fixed bytes or metadata", () => {
    const nodePackage = PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.packages.find(
      (entry) =>
        entry.packageRef
          === PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.nodeToolchainProvisioner,
    )!;
    const cases = [
      {
        basename:
          PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.registry.sharedLockBasename,
        lockField: "sharedParentLock",
      },
      {
        basename: nodePackage.lifecycle.packageLockBasename,
        lockField: "registeredNodePackageLock",
      },
    ] as const;

    for (const fixedLock of cases) {
      const arbitraryBytes = cloneFrames(validFrames());
      const entry = entryFrame(arbitraryBytes, fixedLock.basename);
      const content = entry.content as Frame;
      const entryMutable = entry.mutable as Frame;
      const heldMutable = (
        (arbitraryBytes[2]![fixedLock.lockField] as Frame).mutable as Frame
      );
      const bytes = Buffer.from("attacker-selected-lock-bytes\n");
      content.byteLength = bytes.byteLength;
      content.contentBase64 = b64(bytes);
      entryMutable.byteLength = bytes.byteLength;
      heldMutable.byteLength = bytes.byteLength;
      assertInvalid(arbitraryBytes);

      for (const mutate of [
        (value: Frame) => { value.mode = "0644"; },
        (value: Frame) => { value.linkCount = 2; },
        (value: Frame) => { value.ownerUid = 1; },
        (value: Frame) => { value.ownerGid = 1; },
      ]) {
        const metadata = cloneFrames(validFrames());
        const metadataEntry = entryFrame(metadata, fixedLock.basename);
        const metadataEntryMutable = metadataEntry.mutable as Frame;
        const metadataHeldMutable = (
          (metadata[2]![fixedLock.lockField] as Frame).mutable as Frame
        );
        mutate(metadataEntryMutable);
        mutate(metadataHeldMutable);
        assertInvalid(metadata);
      }
    }
  });

  it("rejects accessor, proxy, shadowed, and oversized process-result channels", () => {
    const clean = processResult(validFrames());
    let getterCalled = false;
    const accessor = {
      exitCode: 0,
      signal: null,
      get stdout() {
        getterCalled = true;
        return clean.stdout;
      },
      stderr: Buffer.alloc(0),
    };
    assert.throws(
      () =>
        mapPlatformReleaseBootstrapDarwinAggregateCensusFixtureV2(
          accessor as never,
        ),
      PlatformReleaseBootstrapDarwinAggregateCensusFixtureErrorV2,
    );
    assert.equal(getterCalled, false);

    let channelProxyTrapCalled = false;
    const proxiedStdout = new Proxy(clean.stdout, {
      getPrototypeOf() {
        channelProxyTrapCalled = true;
        return Buffer.prototype;
      },
    });
    assert.throws(
      () =>
        mapPlatformReleaseBootstrapDarwinAggregateCensusFixtureV2({
          ...clean,
          stdout: proxiedStdout,
        }),
      PlatformReleaseBootstrapDarwinAggregateCensusFixtureErrorV2,
    );
    assert.equal(channelProxyTrapCalled, false);

    assert.throws(
      () =>
        mapPlatformReleaseBootstrapDarwinAggregateCensusFixtureV2(
          new Proxy(clean, {}) as never,
        ),
      PlatformReleaseBootstrapDarwinAggregateCensusFixtureErrorV2,
    );

    let shadowGetterCalled = false;
    const shadowedByteLength = Buffer.from(clean.stdout);
    Object.defineProperty(shadowedByteLength, "byteLength", {
      get() {
        shadowGetterCalled = true;
        return 0;
      },
    });
    assert.throws(
      () =>
        mapPlatformReleaseBootstrapDarwinAggregateCensusFixtureV2({
          ...clean,
          stdout: shadowedByteLength,
        }),
      PlatformReleaseBootstrapDarwinAggregateCensusFixtureErrorV2,
    );
    assert.equal(shadowGetterCalled, false);

    let shadowedBufferGetterCalled = false;
    const shadowedBuffer = new Uint8Array(clean.stdout);
    Object.defineProperty(shadowedBuffer, "buffer", {
      get() {
        shadowedBufferGetterCalled = true;
        return new ArrayBuffer(0);
      },
    });
    assert.throws(
      () =>
        mapPlatformReleaseBootstrapDarwinAggregateCensusFixtureV2({
          ...clean,
          stdout: shadowedBuffer,
        }),
      PlatformReleaseBootstrapDarwinAggregateCensusFixtureErrorV2,
    );
    assert.equal(shadowedBufferGetterCalled, false);

    assert.throws(
      () =>
        mapPlatformReleaseBootstrapDarwinAggregateCensusFixtureV2({
          ...clean,
          stderr: Buffer.alloc(4 * 1024 + 1),
        }),
      PlatformReleaseBootstrapDarwinAggregateCensusFixtureErrorV2,
    );
  });
});
