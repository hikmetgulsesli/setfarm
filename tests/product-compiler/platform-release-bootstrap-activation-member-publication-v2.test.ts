import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  link,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
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
  publishCooperativeActivationMemberV2,
} from
  "../../src/product-compiler/platform-release-bootstrap-activation-member-publication-cooperative-v2.js";
import {
  PlatformReleaseBootstrapActivationPublicationErrorV2,
} from
  "../../src/product-compiler/platform-release-bootstrap-activation-member-publication-core-v2.js";
import {
  PlatformReleaseBootstrapActivationPublicationCheckpointV2,
  PlatformReleaseBootstrapActivationPublicationMemberKindV2,
  publishCooperativeActivationMemberWithTestFaultsV2,
} from
  "../../src/product-compiler/platform-release-bootstrap-activation-member-publication-test-support-v2.js";
import {
  buildBootstrapFilesystemScopeIdentityV2,
  buildStableFsObjectIdentityV2,
} from
  "../../src/product-compiler/platform-release-bootstrap-physical-census-v2.js";

const filesystemScope =
  buildBootstrapFilesystemScopeIdentityV2({
    scopeNonce: "4".repeat(64),
  });

async function fixtureV2() {
  const root = await mkdtemp(
    path.join(
      os.tmpdir(),
      "setfarm-activation-member-publication-v2-",
    ),
  );
  const namespaceParentPath = path.join(root, "namespace");
  const stagingDirectoryPath = path.join(root, "stage");
  await mkdir(namespaceParentPath, { mode: 0o700 });
  await mkdir(stagingDirectoryPath, { mode: 0o700 });
  return {
    root,
    namespaceParentPath,
    stagingDirectoryPath,
    cleanup: async () =>
      rm(root, { recursive: true, force: true }),
  };
}

function hashV2(bytes: Buffer | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

async function inputV2(
  fixture: Awaited<ReturnType<typeof fixtureV2>>,
  memberKind:
    | "staged_activation_receipt"
    | "staged_genesis_epoch_state"
    | "staged_shared_lock",
  bytes: Buffer | string,
): Promise<Readonly<{
  filesystemScope: typeof filesystemScope;
  stagingDirectoryPath: string;
  namespaceParentPath: string;
  memberKind: typeof memberKind;
  expectedRawContentHash: string;
  expectedObjectIdentity:
    ReturnType<typeof buildStableFsObjectIdentityV2>;
}>> {
  const stageStat = await lstat(
    path.join(fixture.stagingDirectoryPath, memberKind),
    { bigint: true },
  );
  return {
    filesystemScope,
    stagingDirectoryPath: fixture.stagingDirectoryPath,
    namespaceParentPath: fixture.namespaceParentPath,
    memberKind,
    expectedRawContentHash: hashV2(bytes),
    expectedObjectIdentity: buildStableFsObjectIdentityV2({
      filesystemScope,
      objectKind: "ordinary_file",
      device: stageStat.dev.toString(10),
      inode: stageStat.ino.toString(10),
    }),
  } as const;
}

function targetBasenameV2(
  memberKind:
    | "staged_activation_receipt"
    | "staged_genesis_epoch_state"
    | "staged_shared_lock",
): string {
  if (memberKind === "staged_activation_receipt") {
    return PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.registry
      .activationReceiptBasename;
  }
  if (memberKind === "staged_genesis_epoch_state") {
    return PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.registry
      .epochFloorBasename;
  }
  return PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.registry
    .sharedLockBasename;
}

async function writeStageV2(
  fixture: Awaited<ReturnType<typeof fixtureV2>>,
  memberKind:
    | "staged_activation_receipt"
    | "staged_genesis_epoch_state"
    | "staged_shared_lock",
  bytes: Buffer | string,
): Promise<string> {
  const stagePath = path.join(
    fixture.stagingDirectoryPath,
    memberKind,
  );
  await writeFile(stagePath, bytes, { mode: 0o600 });
  return stagePath;
}

async function expectCodeV2(
  action: () => Promise<unknown>,
  code:
    | "ACTIVATION_PUBLICATION_CONFLICT"
    | "ACTIVATION_PUBLICATION_INVALID"
    | "ACTIVATION_PUBLICATION_PARENT_CHANGED"
    | "ACTIVATION_PUBLICATION_UNAVAILABLE",
): Promise<void> {
  await assert.rejects(action, (error: unknown) => {
    assert.ok(
      error
        instanceof PlatformReleaseBootstrapActivationPublicationErrorV2,
    );
    assert.equal(error.code, code);
    return true;
  });
}

describe("platform release bootstrap activation member publication v2", () => {
  it("publishes every fixed activation member through the exact no-replace target mapping", async () => {
    for (
      const memberKind of Object.values(
        PlatformReleaseBootstrapActivationPublicationMemberKindV2,
      )
    ) {
      const fixture = await fixtureV2();
      try {
        const bytes = Buffer.from(`payload:${memberKind}`);
        const stagePath = await writeStageV2(
          fixture,
          memberKind,
          bytes,
        );
        const result =
          await publishCooperativeActivationMemberV2(
            await inputV2(fixture, memberKind, bytes),
          );
        const targetPath = path.join(
          fixture.namespaceParentPath,
          targetBasenameV2(memberKind),
        );
        assert.equal(await readFile(targetPath, "utf8"), bytes.toString());
        assert.equal((await lstat(targetPath)).nlink, 1);
        await assert.rejects(() => lstat(stagePath));
        assert.equal(result.memberKind, memberKind);
        assert.equal(
          result.objectIdentity.inode,
          (
            await lstat(targetPath, { bigint: true })
          ).ino.toString(10),
        );
        assert.equal(JSON.stringify(result).includes(fixture.root), false);
      } finally {
        await fixture.cleanup();
      }
    }
  });

  it("replays every cooperative hard-link crash boundary to one final inode", async () => {
    for (
      const boundary of Object.values(
        PlatformReleaseBootstrapActivationPublicationCheckpointV2,
      )
    ) {
      const fixture = await fixtureV2();
      try {
        const memberKind = "staged_shared_lock" as const;
        const bytes = "shared";
        const stagePath = await writeStageV2(
          fixture,
          memberKind,
          bytes,
        );
        const admittedInode = (
          await lstat(stagePath, { bigint: true })
        ).ino;
        const input = await inputV2(
          fixture,
          memberKind,
          bytes,
        );
        let injected = false;
        await assert.rejects(
          () =>
            publishCooperativeActivationMemberWithTestFaultsV2(
              input,
              (checkpoint) => {
                if (!injected && checkpoint === boundary) {
                  injected = true;
                  throw new Error(`injected:${boundary}`);
                }
              },
            ),
          new RegExp(`injected:${boundary}`),
        );
        assert.equal(injected, true);
        const replayCheckpoints: string[] = [];
        const replay =
          await publishCooperativeActivationMemberWithTestFaultsV2(
            input,
            (checkpoint) => {
              replayCheckpoints.push(checkpoint);
            },
          );
        const targetPath = path.join(
          fixture.namespaceParentPath,
          targetBasenameV2(memberKind),
        );
        assert.equal(
          (await lstat(targetPath, { bigint: true })).ino,
          admittedInode,
        );
        assert.equal(
          replay.objectIdentity.inode,
          admittedInode.toString(10),
        );
        assert.equal((await lstat(targetPath)).nlink, 1);
        await assert.rejects(() => lstat(stagePath));
        if (
          boundary
            ===
              PlatformReleaseBootstrapActivationPublicationCheckpointV2
                .afterStageUnlink
        ) {
          assert.ok(
            replayCheckpoints.includes(
              PlatformReleaseBootstrapActivationPublicationCheckpointV2
                .afterFinalStageDirectorySync,
            ),
          );
        }
      } finally {
        await fixture.cleanup();
      }
    }
  });

  it("preserves different-inode EEXIST state and rejects post-unlink target replacement", async () => {
    const mixed = await fixtureV2();
    try {
      const memberKind = "staged_shared_lock" as const;
      const bytes = "same";
      const stagePath = await writeStageV2(
        mixed,
        memberKind,
        bytes,
      );
      const targetPath = path.join(
        mixed.namespaceParentPath,
        targetBasenameV2(memberKind),
      );
      await writeFile(targetPath, bytes, { mode: 0o600 });
      await expectCodeV2(
        async () =>
          publishCooperativeActivationMemberV2(
            await inputV2(mixed, memberKind, bytes),
          ),
        "ACTIVATION_PUBLICATION_CONFLICT",
      );
      assert.equal(await readFile(stagePath, "utf8"), bytes);
      assert.equal(await readFile(targetPath, "utf8"), bytes);
    } finally {
      await mixed.cleanup();
    }

    const replaced = await fixtureV2();
    try {
      const memberKind = "staged_shared_lock" as const;
      const bytes = "same";
      await writeStageV2(replaced, memberKind, bytes);
      let mutated = false;
      await expectCodeV2(
        async () =>
          publishCooperativeActivationMemberWithTestFaultsV2(
            await inputV2(replaced, memberKind, bytes),
            async (checkpoint, context) => {
              if (
                !mutated
                && checkpoint
                  ===
                    PlatformReleaseBootstrapActivationPublicationCheckpointV2
                      .afterStageUnlink
              ) {
                mutated = true;
                await unlink(context.targetPath);
                await writeFile(context.targetPath, bytes, {
                  mode: 0o600,
                });
              }
            },
          ),
        "ACTIVATION_PUBLICATION_CONFLICT",
      );
      assert.equal(mutated, true);
    } finally {
      await replaced.cleanup();
    }
  });

  it("converges a same-inode EEXIST race but rejects a same-byte historical inode replacement", async () => {
    const raced = await fixtureV2();
    try {
      const memberKind = "staged_shared_lock" as const;
      const bytes = "same";
      await writeStageV2(raced, memberKind, bytes);
      const input = await inputV2(raced, memberKind, bytes);
      let linked = false;
      const result =
        await publishCooperativeActivationMemberWithTestFaultsV2(
          input,
          async (checkpoint, context) => {
            if (
              !linked
              && checkpoint
                ===
                  PlatformReleaseBootstrapActivationPublicationCheckpointV2
                    .afterStageDirectorySync
            ) {
              linked = true;
              await link(context.stagePath, context.targetPath);
            }
          },
        );
      assert.equal(linked, true);
      assert.equal(
        result.objectIdentity.objectIdentityHash,
        input.expectedObjectIdentity.objectIdentityHash,
      );
    } finally {
      await raced.cleanup();
    }

    const replaced = await fixtureV2();
    try {
      const memberKind = "staged_shared_lock" as const;
      const bytes = "same";
      await writeStageV2(replaced, memberKind, bytes);
      const input = await inputV2(replaced, memberKind, bytes);
      await publishCooperativeActivationMemberV2(input);
      const targetPath = path.join(
        replaced.namespaceParentPath,
        targetBasenameV2(memberKind),
      );
      await unlink(targetPath);
      await writeFile(targetPath, bytes, { mode: 0o600 });
      await expectCodeV2(
        () => publishCooperativeActivationMemberV2(input),
        "ACTIVATION_PUBLICATION_CONFLICT",
      );
    } finally {
      await replaced.cleanup();
    }
  });

  it("requires final stage absence at both overlap and final-only fences", async () => {
    for (
      const boundary of [
        PlatformReleaseBootstrapActivationPublicationCheckpointV2
          .afterStageUnlink,
        PlatformReleaseBootstrapActivationPublicationCheckpointV2
          .afterFinalStageDirectorySync,
      ] as const
    ) {
      const fixture = await fixtureV2();
      try {
        const memberKind = "staged_shared_lock" as const;
        const bytes = "same";
        await writeStageV2(fixture, memberKind, bytes);
        const input = await inputV2(
          fixture,
          memberKind,
          bytes,
        );
        if (
          boundary
            ===
              PlatformReleaseBootstrapActivationPublicationCheckpointV2
                .afterFinalStageDirectorySync
        ) {
          await publishCooperativeActivationMemberV2(input);
        }
        let recreated = false;
        await expectCodeV2(
          () =>
            publishCooperativeActivationMemberWithTestFaultsV2(
              input,
              async (checkpoint, context) => {
                if (!recreated && checkpoint === boundary) {
                  recreated = true;
                  await writeFile(context.stagePath, bytes, {
                    mode: 0o600,
                  });
                }
              },
            ),
          "ACTIVATION_PUBLICATION_CONFLICT",
        );
        assert.equal(recreated, true);
        const targetPath = path.join(
          fixture.namespaceParentPath,
          targetBasenameV2(memberKind),
        );
        assert.notEqual(
          (await lstat(targetPath, { bigint: true })).ino,
          (
            await lstat(
              path.join(
                fixture.stagingDirectoryPath,
                memberKind,
              ),
              { bigint: true },
            )
          ).ino,
        );
      } finally {
        await fixture.cleanup();
      }
    }
  });

  it("validates scope authority before any filesystem mutation", async () => {
    const fixture = await fixtureV2();
    try {
      const memberKind = "staged_shared_lock" as const;
      const bytes = "same";
      const stagePath = await writeStageV2(
        fixture,
        memberKind,
        bytes,
      );
      const input = await inputV2(fixture, memberKind, bytes);
      await expectCodeV2(
        () =>
          publishCooperativeActivationMemberV2({
            ...input,
            filesystemScope: {
              ...input.filesystemScope,
              scopeIdentityHash: "0".repeat(64),
            },
          }),
        "ACTIVATION_PUBLICATION_INVALID",
      );
      assert.equal(await readFile(stagePath, "utf8"), bytes);
      await assert.rejects(() =>
        lstat(
          path.join(
            fixture.namespaceParentPath,
            targetBasenameV2(memberKind),
          ),
        ),
      );
    } finally {
      await fixture.cleanup();
    }
  });

  it("rejects symlink, FIFO, and hidden-link stages without mutation", async () => {
    const symlinkFixture = await fixtureV2();
    try {
      const outside = path.join(symlinkFixture.root, "outside");
      await writeFile(outside, "same", { mode: 0o600 });
      await symlink(
        outside,
        path.join(
          symlinkFixture.stagingDirectoryPath,
          "staged_shared_lock",
        ),
      );
      await expectCodeV2(
        async () =>
          publishCooperativeActivationMemberV2(
            await inputV2(
              symlinkFixture,
              "staged_shared_lock",
              "same",
            ),
          ),
        "ACTIVATION_PUBLICATION_INVALID",
      );
    } finally {
      await symlinkFixture.cleanup();
    }

    const fifoFixture = await fixtureV2();
    try {
      execFileSync("mkfifo", [
        path.join(
          fifoFixture.stagingDirectoryPath,
          "staged_shared_lock",
        ),
      ]);
      await expectCodeV2(
        async () =>
          publishCooperativeActivationMemberV2(
            await inputV2(
              fifoFixture,
              "staged_shared_lock",
              "same",
            ),
          ),
        "ACTIVATION_PUBLICATION_INVALID",
      );
    } finally {
      await fifoFixture.cleanup();
    }

    const hardlinkFixture = await fixtureV2();
    try {
      const outside = path.join(hardlinkFixture.root, "outside");
      await writeFile(outside, "same", { mode: 0o600 });
      const stagePath = path.join(
        hardlinkFixture.stagingDirectoryPath,
        "staged_shared_lock",
      );
      await link(outside, stagePath);
      await expectCodeV2(
        async () =>
          publishCooperativeActivationMemberV2(
            await inputV2(
              hardlinkFixture,
              "staged_shared_lock",
              "same",
            ),
          ),
        "ACTIVATION_PUBLICATION_CONFLICT",
      );
      assert.equal((await lstat(stagePath)).nlink, 2);
    } finally {
      await hardlinkFixture.cleanup();
    }
  });

  it("fails closed on a final namespace-parent replacement", async () => {
    const fixture = await fixtureV2();
    try {
      const memberKind = "staged_shared_lock" as const;
      const bytes = "same";
      await writeStageV2(fixture, memberKind, bytes);
      const moved = path.join(fixture.root, "moved");
      let replaced = false;
      await expectCodeV2(
        async () =>
          publishCooperativeActivationMemberWithTestFaultsV2(
            await inputV2(fixture, memberKind, bytes),
            async (checkpoint, context) => {
              if (
                !replaced
                && checkpoint
                  ===
                    PlatformReleaseBootstrapActivationPublicationCheckpointV2
                      .afterFinalStageDirectorySync
              ) {
                replaced = true;
                const exact = await readFile(context.targetPath);
                await rename(fixture.namespaceParentPath, moved);
                await mkdir(fixture.namespaceParentPath, {
                  mode: 0o700,
                });
                await writeFile(
                  path.join(
                    fixture.namespaceParentPath,
                    targetBasenameV2(memberKind),
                  ),
                  exact,
                  { mode: 0o600 },
                );
              }
            },
          ),
        "ACTIVATION_PUBLICATION_PARENT_CHANGED",
      );
    } finally {
      await fixture.cleanup();
    }
  });
});
