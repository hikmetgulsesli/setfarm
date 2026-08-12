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
  rmdir,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2 } from "../../src/execution/schemas/platform-release-bootstrap-contract-v2.js";
import { publishCooperativeEpochStateV2 } from "../../src/product-compiler/platform-release-bootstrap-epoch-state-publication-cooperative-v2.js";
import { PlatformReleaseBootstrapEpochPublicationErrorV2 } from "../../src/product-compiler/platform-release-bootstrap-epoch-state-publication-core-v2.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_EPOCH_TARGET_STAGE_BASENAME_V2,
  PlatformReleaseBootstrapEpochPublicationCheckpointV2,
  publishCooperativeEpochStateWithTestFaultsV2,
} from "../../src/product-compiler/platform-release-bootstrap-epoch-state-publication-test-support-v2.js";
import {
  buildBootstrapFilesystemScopeIdentityV2,
  buildStableFsObjectIdentityV2,
} from "../../src/product-compiler/platform-release-bootstrap-physical-census-v2.js";

const filesystemScope = buildBootstrapFilesystemScopeIdentityV2({
  scopeNonce: "5".repeat(64),
});
const priorBytes = "prior-epoch-state";
const targetBytes = "target-epoch-state";

function hashV2(bytes: Buffer | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

async function fixtureV2() {
  const root = await mkdtemp(
    path.join(os.tmpdir(), "setfarm-epoch-state-publication-v2-"),
  );
  const namespaceParentPath = path.join(root, "namespace");
  const stagingDirectoryPath = path.join(
    namespaceParentPath,
    PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.registry.transactionStagingBasename,
  );
  const stagePath = path.join(
    stagingDirectoryPath,
    PLATFORM_RELEASE_BOOTSTRAP_EPOCH_TARGET_STAGE_BASENAME_V2,
  );
  const targetPath = path.join(
    namespaceParentPath,
    PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.registry.epochFloorBasename,
  );
  await mkdir(namespaceParentPath, { mode: 0o700 });
  await mkdir(stagingDirectoryPath, { mode: 0o700 });
  await writeFile(targetPath, priorBytes, { mode: 0o600 });
  await writeFile(stagePath, targetBytes, { mode: 0o600 });
  const stageDirectoryStat = await lstat(stagingDirectoryPath, {
    bigint: true,
  });
  const stageStat = await lstat(stagePath, { bigint: true });
  const priorStat = await lstat(targetPath, { bigint: true });
  const input = Object.freeze({
    filesystemScope,
    stagingDirectoryPath,
    namespaceParentPath,
    expectedPriorRawContentHash: hashV2(priorBytes),
    expectedTargetRawContentHash: hashV2(targetBytes),
    expectedPriorObjectIdentity: buildStableFsObjectIdentityV2({
      filesystemScope,
      objectKind: "ordinary_file",
      device: priorStat.dev.toString(10),
      inode: priorStat.ino.toString(10),
    }),
    expectedStagingDirectoryObjectIdentity: buildStableFsObjectIdentityV2({
      filesystemScope,
      objectKind: "directory",
      device: stageDirectoryStat.dev.toString(10),
      inode: stageDirectoryStat.ino.toString(10),
    }),
    expectedTargetObjectIdentity: buildStableFsObjectIdentityV2({
      filesystemScope,
      objectKind: "ordinary_file",
      device: stageStat.dev.toString(10),
      inode: stageStat.ino.toString(10),
    }),
  });
  return {
    root,
    namespaceParentPath,
    stagingDirectoryPath,
    stagePath,
    targetPath,
    admittedTargetInode: stageStat.ino,
    input,
    cleanup: async () => rm(root, { recursive: true, force: true }),
  };
}

async function expectCodeV2(
  action: () => Promise<unknown>,
  code:
    | "EPOCH_PUBLICATION_CONFLICT"
    | "EPOCH_PUBLICATION_INVALID"
    | "EPOCH_PUBLICATION_PARENT_CHANGED"
    | "EPOCH_PUBLICATION_UNAVAILABLE",
): Promise<void> {
  await assert.rejects(action, (error: unknown) => {
    assert.ok(error instanceof PlatformReleaseBootstrapEpochPublicationErrorV2);
    assert.equal(error.code, code);
    return true;
  });
}

describe("platform release bootstrap epoch state publication v2", () => {
  it("atomically consumes the exact staged inode and removes only the exact empty staging directory", async () => {
    const fixture = await fixtureV2();
    try {
      const result = await publishCooperativeEpochStateV2(fixture.input);
      assert.equal(await readFile(fixture.targetPath, "utf8"), targetBytes);
      assert.equal(
        (await lstat(fixture.targetPath, { bigint: true })).ino,
        fixture.admittedTargetInode,
      );
      await assert.rejects(() => lstat(fixture.stagingDirectoryPath));
      assert.equal(
        result.objectIdentity.objectIdentityHash,
        fixture.input.expectedTargetObjectIdentity.objectIdentityHash,
      );
      assert.equal(result.fingerprint.linkCount, 1);
      assert.equal(JSON.stringify(result).includes(fixture.root), false);
    } finally {
      await fixture.cleanup();
    }
  });

  it("replays every process-crash checkpoint to target plus absent staging", async () => {
    for (const boundary of Object.values(
      PlatformReleaseBootstrapEpochPublicationCheckpointV2,
    )) {
      const fixture = await fixtureV2();
      try {
        let injected = false;
        await assert.rejects(
          () =>
            publishCooperativeEpochStateWithTestFaultsV2(
              fixture.input,
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
        const replay = await publishCooperativeEpochStateWithTestFaultsV2(
          fixture.input,
          (checkpoint) => {
            replayCheckpoints.push(checkpoint);
          },
        );
        assert.equal(
          (await lstat(fixture.targetPath, { bigint: true })).ino,
          fixture.admittedTargetInode,
        );
        assert.equal(
          replay.objectIdentity.inode,
          fixture.admittedTargetInode.toString(10),
        );
        await assert.rejects(() => lstat(fixture.stagingDirectoryPath));
        if (
          boundary ===
          PlatformReleaseBootstrapEpochPublicationCheckpointV2.afterStageDirectoryRemove
        ) {
          assert.ok(
            replayCheckpoints.includes(
              PlatformReleaseBootstrapEpochPublicationCheckpointV2.afterFinalParentSync,
            ),
          );
        }
      } finally {
        await fixture.cleanup();
      }
    }
  });

  it("reobserves exact rename and rename-plus-cleanup races", async () => {
    for (const removeStagingDirectory of [false, true]) {
      const fixture = await fixtureV2();
      try {
        let raced = false;
        const result =
          await publishCooperativeEpochStateWithTestFaultsV2(
            fixture.input,
            async (checkpoint, context) => {
              if (
                !raced &&
                checkpoint ===
                  PlatformReleaseBootstrapEpochPublicationCheckpointV2.afterStageDirectorySync
              ) {
                raced = true;
                await rename(context.stagePath, context.targetPath);
                if (removeStagingDirectory) {
                  await rmdir(context.stagingDirectoryPath);
                }
              }
            },
          );
        assert.equal(raced, true);
        assert.equal(
          result.objectIdentity.inode,
          fixture.admittedTargetInode.toString(10),
        );
        await assert.rejects(() =>
          lstat(fixture.stagingDirectoryPath),
        );
      } finally {
        await fixture.cleanup();
      }
    }
  });

  it("rejects target-plus-exact, prior-plus-consumed, third-floor, and hidden-link states without cleanup", async () => {
    const priorReplacement = await fixtureV2();
    try {
      await unlink(priorReplacement.targetPath);
      await writeFile(priorReplacement.targetPath, priorBytes, { mode: 0o600 });
      await expectCodeV2(
        () => publishCooperativeEpochStateV2(priorReplacement.input),
        "EPOCH_PUBLICATION_CONFLICT",
      );
      assert.equal(
        await readFile(priorReplacement.stagePath, "utf8"),
        targetBytes,
      );
      assert.equal(
        await readFile(priorReplacement.targetPath, "utf8"),
        priorBytes,
      );
    } finally {
      await priorReplacement.cleanup();
    }

    const targetPlusExact = await fixtureV2();
    try {
      await writeFile(targetPlusExact.targetPath, targetBytes);
      await expectCodeV2(
        () => publishCooperativeEpochStateV2(targetPlusExact.input),
        "EPOCH_PUBLICATION_CONFLICT",
      );
      assert.equal(
        await readFile(targetPlusExact.stagePath, "utf8"),
        targetBytes,
      );
    } finally {
      await targetPlusExact.cleanup();
    }

    const priorPlusConsumed = await fixtureV2();
    try {
      await unlink(priorPlusConsumed.stagePath);
      await expectCodeV2(
        () => publishCooperativeEpochStateV2(priorPlusConsumed.input),
        "EPOCH_PUBLICATION_CONFLICT",
      );
      assert.equal(
        (await lstat(priorPlusConsumed.stagingDirectoryPath)).isDirectory(),
        true,
      );
    } finally {
      await priorPlusConsumed.cleanup();
    }

    const thirdFloor = await fixtureV2();
    try {
      await writeFile(thirdFloor.targetPath, "third-state");
      await expectCodeV2(
        () => publishCooperativeEpochStateV2(thirdFloor.input),
        "EPOCH_PUBLICATION_CONFLICT",
      );
      assert.equal(await readFile(thirdFloor.stagePath, "utf8"), targetBytes);
    } finally {
      await thirdFloor.cleanup();
    }

    const hiddenLink = await fixtureV2();
    try {
      await link(hiddenLink.stagePath, path.join(hiddenLink.root, "hidden"));
      await expectCodeV2(
        () => publishCooperativeEpochStateV2(hiddenLink.input),
        "EPOCH_PUBLICATION_INVALID",
      );
      assert.equal((await lstat(hiddenLink.stagePath)).nlink, 2);
    } finally {
      await hiddenLink.cleanup();
    }
  });

  it("rejects late target replacement and staging recreation after irreversible boundaries", async () => {
    const replaced = await fixtureV2();
    try {
      let mutated = false;
      await expectCodeV2(
        () =>
          publishCooperativeEpochStateWithTestFaultsV2(
            replaced.input,
            async (checkpoint, context) => {
              if (
                !mutated &&
                checkpoint ===
                  PlatformReleaseBootstrapEpochPublicationCheckpointV2.afterAtomicReplace
              ) {
                mutated = true;
                await unlink(context.targetPath);
                await writeFile(context.targetPath, targetBytes, {
                  mode: 0o600,
                });
              }
            },
          ),
        "EPOCH_PUBLICATION_CONFLICT",
      );
      assert.equal(mutated, true);
    } finally {
      await replaced.cleanup();
    }

    const recreated = await fixtureV2();
    try {
      let mutated = false;
      await expectCodeV2(
        () =>
          publishCooperativeEpochStateWithTestFaultsV2(
            recreated.input,
            async (checkpoint, context) => {
              if (
                !mutated &&
                checkpoint ===
                  PlatformReleaseBootstrapEpochPublicationCheckpointV2.afterStageDirectoryRemove
              ) {
                mutated = true;
                await mkdir(context.stagingDirectoryPath, {
                  mode: 0o700,
                });
              }
            },
          ),
        "EPOCH_PUBLICATION_CONFLICT",
      );
      assert.equal(mutated, true);
    } finally {
      await recreated.cleanup();
    }
  });

  it("validates scope before mutation and rejects symlink, FIFO, and unknown staging members", async () => {
    const malformed = await fixtureV2();
    try {
      await expectCodeV2(
        () =>
          publishCooperativeEpochStateV2({
            ...malformed.input,
            filesystemScope: {
              ...malformed.input.filesystemScope,
              scopeIdentityHash: "0".repeat(64),
            },
          }),
        "EPOCH_PUBLICATION_INVALID",
      );
      assert.equal(await readFile(malformed.targetPath, "utf8"), priorBytes);
      assert.equal(await readFile(malformed.stagePath, "utf8"), targetBytes);
    } finally {
      await malformed.cleanup();
    }

    const symlinkStage = await fixtureV2();
    try {
      await unlink(symlinkStage.stagePath);
      const outside = path.join(symlinkStage.root, "outside");
      await writeFile(outside, targetBytes, { mode: 0o600 });
      await symlink(outside, symlinkStage.stagePath);
      await expectCodeV2(
        () => publishCooperativeEpochStateV2(symlinkStage.input),
        "EPOCH_PUBLICATION_INVALID",
      );
    } finally {
      await symlinkStage.cleanup();
    }

    const fifoStage = await fixtureV2();
    try {
      await unlink(fifoStage.stagePath);
      execFileSync("mkfifo", [fifoStage.stagePath]);
      await expectCodeV2(
        () => publishCooperativeEpochStateV2(fifoStage.input),
        "EPOCH_PUBLICATION_INVALID",
      );
    } finally {
      await fifoStage.cleanup();
    }

    const unknownMember = await fixtureV2();
    try {
      await writeFile(
        path.join(unknownMember.stagingDirectoryPath, "foreign"),
        "foreign",
        { mode: 0o600 },
      );
      await expectCodeV2(
        () => publishCooperativeEpochStateV2(unknownMember.input),
        "EPOCH_PUBLICATION_CONFLICT",
      );
      assert.equal(
        await readFile(unknownMember.targetPath, "utf8"),
        priorBytes,
      );
    } finally {
      await unknownMember.cleanup();
    }
  });

  it("fails closed on a final namespace-parent replacement", async () => {
    const fixture = await fixtureV2();
    try {
      const moved = path.join(fixture.root, "moved");
      let replaced = false;
      await expectCodeV2(
        () =>
          publishCooperativeEpochStateWithTestFaultsV2(
            fixture.input,
            async (checkpoint, context) => {
              if (
                !replaced &&
                checkpoint ===
                  PlatformReleaseBootstrapEpochPublicationCheckpointV2.afterFinalParentSync
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
                    PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.registry
                      .epochFloorBasename,
                  ),
                  exact,
                  { mode: 0o600 },
                );
              }
            },
          ),
        "EPOCH_PUBLICATION_PARENT_CHANGED",
      );
      assert.equal(replaced, true);
    } finally {
      await fixture.cleanup();
    }
  });
});
