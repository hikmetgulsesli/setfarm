import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  link,
  mkdir,
  mkdtemp,
  rename,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import {
  PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2,
} from
  "../../src/execution/schemas/platform-release-bootstrap-contract-v2.js";
import {
  captureCooperativeBootstrapNamespaceEntryV2,
} from
  "../../src/product-compiler/platform-release-bootstrap-filesystem-capture-cooperative-v2.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_CAPTURE_MAX_FILE_BYTES_V2,
  PLATFORM_RELEASE_BOOTSTRAP_COOPERATIVE_CAPTURE_CAPABILITY_V2,
  PlatformReleaseBootstrapFilesystemCaptureErrorV2,
} from
  "../../src/product-compiler/platform-release-bootstrap-filesystem-capture-core-v2.js";
import {
  PlatformReleaseBootstrapCaptureCheckpointV2,
  captureCooperativeBootstrapNamespaceEntryWithTestFaultsV2,
} from
  "../../src/product-compiler/platform-release-bootstrap-filesystem-capture-test-support-v2.js";
import {
  buildBootstrapFilesystemScopeIdentityV2,
} from
  "../../src/product-compiler/platform-release-bootstrap-physical-census-v2.js";
import {
  classifyPlatformReleaseBootstrapNamespaceBasenameV2,
} from
  "../../src/product-compiler/platform-release-bootstrap-registry-v2.js";

const filesystemScope =
  buildBootstrapFilesystemScopeIdentityV2({
    scopeNonce: "a".repeat(64),
  });

const sharedLockBasename =
  PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.registry
    .sharedLockBasename;
const transactionStagingBasename =
  PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.registry
    .transactionStagingBasename;

const sharedLockClassification =
  classifyPlatformReleaseBootstrapNamespaceBasenameV2(
    sharedLockBasename,
  );
const transactionStagingClassification =
  classifyPlatformReleaseBootstrapNamespaceBasenameV2(
    transactionStagingBasename,
  );

async function fixtureV2(): Promise<Readonly<{
  root: string;
  parent: string;
  cleanup: () => Promise<void>;
}>> {
  const root = await mkdtemp(
    path.join(
      os.tmpdir(),
      "setfarm-bootstrap-capture-v2-",
    ),
  );
  const parent = path.join(root, "parent");
  await mkdir(parent, { mode: 0o700 });
  return Object.freeze({
    root,
    parent,
    cleanup: async () => {
      await rm(root, { recursive: true, force: true });
    },
  });
}

function captureInputV2(
  parentPath: string,
  classification = sharedLockClassification,
) {
  return {
    filesystemScope,
    parentPath,
    classification,
  };
}

async function expectCaptureCodeV2(
  action: () => Promise<unknown>,
  code:
    | "CAPTURE_CHANGED"
    | "CAPTURE_ENTRY_HARDLINKED"
    | "CAPTURE_ENTRY_TOO_LARGE"
    | "CAPTURE_INVALID_INPUT"
    | "CAPTURE_PARENT_INVALID"
    | "CAPTURE_UNSAFE_ENTRY_KIND",
): Promise<void> {
  await assert.rejects(action, (error: unknown) => {
    assert.ok(
      error
        instanceof PlatformReleaseBootstrapFilesystemCaptureErrorV2,
    );
    assert.equal(error.code, code);
    return true;
  });
}

describe("platform release bootstrap filesystem capture v2", () => {
  it("captures one exact bounded ordinary file twice with BigInt physical evidence", async () => {
    const fixture = await fixtureV2();
    try {
      const bytes = Buffer.from("shared-lock-v2", "utf8");
      await writeFile(
        path.join(fixture.parent, sharedLockBasename),
        bytes,
        { mode: 0o600 },
      );
      const observed =
        await captureCooperativeBootstrapNamespaceEntryV2(
          captureInputV2(fixture.parent),
        );
      assert.equal(
        observed.capability,
        PLATFORM_RELEASE_BOOTSTRAP_COOPERATIVE_CAPTURE_CAPABILITY_V2,
      );
      assert.equal(
        observed.parentObjectIdentity.objectKind,
        "directory",
      );
      assert.equal(
        observed.entryCapture.objectIdentity.objectKind,
        "ordinary_file",
      );
      assert.equal(
        observed.entryCapture.parentObjectIdentityHash,
        observed.parentObjectIdentity.objectIdentityHash,
      );
      assert.equal(
        observed.entryCapture.fingerprint.linkCount,
        1,
      );
      assert.deepEqual(
        observed.entryCapture.contentEvidence,
        {
          kind: "bounded_regular_file_bytes",
          rawContentHash: createHash("sha256")
            .update(bytes)
            .digest("hex"),
        },
      );
      assert.match(
        observed.entryCapture.fingerprint
          .modifiedTimeNanoseconds,
        /^(?:0|[1-9][0-9]*)$/,
      );
    } finally {
      await fixture.cleanup();
    }
  });

  it("captures exact every-and-only directory membership with two stable enumerations", async () => {
    const fixture = await fixtureV2();
    try {
      const stage = path.join(
        fixture.parent,
        transactionStagingBasename,
      );
      await mkdir(stage, { mode: 0o700 });
      await writeFile(
        path.join(stage, "a.json"),
        "{}",
        { mode: 0o600 },
      );
      await mkdir(path.join(stage, "b-dir"), {
        mode: 0o700,
      });
      const observed =
        await captureCooperativeBootstrapNamespaceEntryV2(
          captureInputV2(
            fixture.parent,
            transactionStagingClassification,
          ),
        );
      assert.equal(
        observed.entryCapture.objectIdentity.objectKind,
        "directory",
      );
      assert.deepEqual(
        observed.entryCapture.contentEvidence,
        {
          kind: "directory_membership",
          membership: {
            schema:
              "setfarm.platform-release-bootstrap-directory-membership-identity.v2",
            version: "2.0.0",
            entryCount: 2,
            orderedEntries: [
              {
                basename: "a.json",
                objectKind: "ordinary_file",
              },
              {
                basename: "b-dir",
                objectKind: "directory",
              },
            ],
            membershipHash:
              observed.entryCapture.contentEvidence.kind
                === "directory_membership"
                ? observed.entryCapture.contentEvidence
                  .membership.membershipHash
                : "",
          },
        },
      );
    } finally {
      await fixture.cleanup();
    }
  });

  it("rejects malformed locators, symlinks, FIFOs, hard links, and oversized files", async () => {
    const malformed =
      {
        ...sharedLockClassification,
        basename: "../escaped",
      } as typeof sharedLockClassification;
    await expectCaptureCodeV2(
      () =>
        captureCooperativeBootstrapNamespaceEntryV2({
          filesystemScope,
          parentPath: "relative",
          classification: sharedLockClassification,
        }),
      "CAPTURE_INVALID_INPUT",
    );
    const fixture = await fixtureV2();
    try {
      await expectCaptureCodeV2(
        () =>
          captureCooperativeBootstrapNamespaceEntryV2(
            captureInputV2(fixture.parent, malformed),
          ),
        "CAPTURE_INVALID_INPUT",
      );

      const target = path.join(
        fixture.parent,
        sharedLockBasename,
      );
      const outside = path.join(fixture.root, "outside");
      await writeFile(outside, "outside");
      await symlink(outside, target);
      await expectCaptureCodeV2(
        () =>
          captureCooperativeBootstrapNamespaceEntryV2(
            captureInputV2(fixture.parent),
          ),
        "CAPTURE_UNSAFE_ENTRY_KIND",
      );
      await unlink(target);

      execFileSync("mkfifo", [target]);
      await expectCaptureCodeV2(
        () =>
          captureCooperativeBootstrapNamespaceEntryV2(
            captureInputV2(fixture.parent),
          ),
        "CAPTURE_UNSAFE_ENTRY_KIND",
      );
      await unlink(target);

      await link(outside, target);
      await expectCaptureCodeV2(
        () =>
          captureCooperativeBootstrapNamespaceEntryV2(
            captureInputV2(fixture.parent),
          ),
        "CAPTURE_ENTRY_HARDLINKED",
      );
      await unlink(target);

      await writeFile(
        target,
        Buffer.alloc(
          PLATFORM_RELEASE_BOOTSTRAP_CAPTURE_MAX_FILE_BYTES_V2,
          0x61,
        ),
      );
      const boundary =
        await captureCooperativeBootstrapNamespaceEntryV2(
          captureInputV2(fixture.parent),
        );
      assert.equal(
        boundary.entryCapture.fingerprint.byteLength,
        PLATFORM_RELEASE_BOOTSTRAP_CAPTURE_MAX_FILE_BYTES_V2,
      );
      await writeFile(
        target,
        Buffer.alloc(
          PLATFORM_RELEASE_BOOTSTRAP_CAPTURE_MAX_FILE_BYTES_V2
            + 1,
          0x61,
        ),
      );
      await expectCaptureCodeV2(
        () =>
          captureCooperativeBootstrapNamespaceEntryV2(
            captureInputV2(fixture.parent),
          ),
        "CAPTURE_ENTRY_TOO_LARGE",
      );
    } finally {
      await fixture.cleanup();
    }
  });

  it("rejects content, path, parent, and membership changes at deterministic checkpoints", async () => {
    const contentFixture = await fixtureV2();
    try {
      const target = path.join(
        contentFixture.parent,
        sharedLockBasename,
      );
      await writeFile(target, "before");
      let changed = false;
      await expectCaptureCodeV2(
        () =>
          captureCooperativeBootstrapNamespaceEntryWithTestFaultsV2(
            captureInputV2(contentFixture.parent),
            async (checkpoint) => {
              if (
                !changed
                && checkpoint
                  ===
                    PlatformReleaseBootstrapCaptureCheckpointV2
                      .afterChildRead
              ) {
                changed = true;
                await writeFile(target, "after-change");
              }
            },
          ),
        "CAPTURE_CHANGED",
      );
    } finally {
      await contentFixture.cleanup();
    }

    const pathFixture = await fixtureV2();
    try {
      const target = path.join(
        pathFixture.parent,
        sharedLockBasename,
      );
      await writeFile(target, "same");
      let replaced = false;
      await expectCaptureCodeV2(
        () =>
          captureCooperativeBootstrapNamespaceEntryWithTestFaultsV2(
            captureInputV2(pathFixture.parent),
            async (checkpoint) => {
              if (
                !replaced
                && checkpoint
                  ===
                    PlatformReleaseBootstrapCaptureCheckpointV2
                      .afterFirstCapture
              ) {
                replaced = true;
                await unlink(target);
                await writeFile(target, "same");
              }
            },
          ),
        "CAPTURE_CHANGED",
      );
    } finally {
      await pathFixture.cleanup();
    }

    const parentFixture = await fixtureV2();
    try {
      const target = path.join(
        parentFixture.parent,
        sharedLockBasename,
      );
      await writeFile(target, "same");
      const moved = path.join(
        parentFixture.root,
        "moved-parent",
      );
      let replaced = false;
      await expectCaptureCodeV2(
        () =>
          captureCooperativeBootstrapNamespaceEntryWithTestFaultsV2(
            captureInputV2(parentFixture.parent),
            async (checkpoint) => {
              if (
                !replaced
                && checkpoint
                  ===
                    PlatformReleaseBootstrapCaptureCheckpointV2
                      .afterFirstCapture
              ) {
                replaced = true;
                await rename(parentFixture.parent, moved);
                await mkdir(parentFixture.parent, {
                  mode: 0o700,
                });
                await writeFile(
                  path.join(
                    parentFixture.parent,
                    sharedLockBasename,
                  ),
                  "same",
                );
              }
            },
          ),
        "CAPTURE_CHANGED",
      );
    } finally {
      await parentFixture.cleanup();
    }

    const directoryFixture = await fixtureV2();
    try {
      const stage = path.join(
        directoryFixture.parent,
        transactionStagingBasename,
      );
      await mkdir(stage, { mode: 0o700 });
      await writeFile(path.join(stage, "a"), "a");
      let changed = false;
      await expectCaptureCodeV2(
        () =>
          captureCooperativeBootstrapNamespaceEntryWithTestFaultsV2(
            captureInputV2(
              directoryFixture.parent,
              transactionStagingClassification,
            ),
            async (checkpoint) => {
              if (
                !changed
                && checkpoint
                  ===
                    PlatformReleaseBootstrapCaptureCheckpointV2
                      .afterDirectoryMembershipFirst
              ) {
                changed = true;
                await writeFile(path.join(stage, "b"), "b");
              }
            },
          ),
        "CAPTURE_CHANGED",
      );
    } finally {
      await directoryFixture.cleanup();
    }

    const lateFixture = await fixtureV2();
    try {
      await writeFile(
        path.join(lateFixture.parent, sharedLockBasename),
        "same",
      );
      const moved = path.join(
        lateFixture.root,
        "late-moved-parent",
      );
      let replaced = false;
      await expectCaptureCodeV2(
        () =>
          captureCooperativeBootstrapNamespaceEntryWithTestFaultsV2(
            captureInputV2(lateFixture.parent),
            async (checkpoint) => {
              if (
                !replaced
                && checkpoint
                  ===
                    PlatformReleaseBootstrapCaptureCheckpointV2
                      .afterParentPathAfter
              ) {
                replaced = true;
                await rename(lateFixture.parent, moved);
                await mkdir(lateFixture.parent, {
                  mode: 0o700,
                });
                await writeFile(
                  path.join(
                    lateFixture.parent,
                    sharedLockBasename,
                  ),
                  "same",
                );
              }
            },
          ),
        "CAPTURE_CHANGED",
      );
    } finally {
      await lateFixture.cleanup();
    }
  });

  it("propagates test-only checkpoint faults without mutation and permits an exact retry", async () => {
    const fixture = await fixtureV2();
    try {
      await writeFile(
        path.join(fixture.parent, sharedLockBasename),
        "retry",
      );
      const injected = new Error("injected checkpoint");
      await assert.rejects(
        () =>
          captureCooperativeBootstrapNamespaceEntryWithTestFaultsV2(
            captureInputV2(fixture.parent),
            (checkpoint) => {
              if (
                checkpoint
                  ===
                    PlatformReleaseBootstrapCaptureCheckpointV2
                      .afterParentDescriptorBefore
              ) {
                throw injected;
              }
            },
          ),
        (error: unknown) => {
          assert.ok(
            error
              instanceof PlatformReleaseBootstrapFilesystemCaptureErrorV2,
          );
          assert.equal(error.code, "CAPTURE_PARENT_INVALID");
          assert.equal(error.cause, injected);
          return true;
        },
      );
      const retried =
        await captureCooperativeBootstrapNamespaceEntryV2(
          captureInputV2(fixture.parent),
        );
      assert.equal(
        retried.entryCapture.fingerprint.linkCount,
        1,
      );
    } finally {
      await fixture.cleanup();
    }
  });
});
