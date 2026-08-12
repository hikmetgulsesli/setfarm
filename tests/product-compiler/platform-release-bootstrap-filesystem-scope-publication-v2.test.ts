import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
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
  canonicalJsonStringify,
} from
  "../../src/product-compiler/canonical-json.js";
import {
  ensureCooperativeBootstrapFilesystemScopeV2,
} from
  "../../src/product-compiler/platform-release-bootstrap-filesystem-scope-publication-cooperative-v2.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_FILESYSTEM_SCOPE_DOCUMENT_BASENAME_V2,
  PLATFORM_RELEASE_BOOTSTRAP_FILESYSTEM_SCOPE_STAGE_BASENAME_V2,
  PlatformReleaseBootstrapScopePublicationCheckpointV2,
  ensureCooperativeBootstrapFilesystemScopeWithTestFaultsV2,
} from
  "../../src/product-compiler/platform-release-bootstrap-filesystem-scope-publication-test-support-v2.js";
import {
  PlatformReleaseBootstrapScopePublicationErrorV2,
} from
  "../../src/product-compiler/platform-release-bootstrap-filesystem-scope-publication-core-v2.js";
import {
  buildBootstrapFilesystemScopeIdentityV2,
} from
  "../../src/product-compiler/platform-release-bootstrap-physical-census-v2.js";

async function fixtureV2(): Promise<Readonly<{
  root: string;
  parent: string;
  target: string;
  stage: string;
  cleanup: () => Promise<void>;
}>> {
  const root = await mkdtemp(
    path.join(
      os.tmpdir(),
      "setfarm-bootstrap-scope-publication-v2-",
    ),
  );
  const parent = path.join(root, "scope-parent");
  await mkdir(parent, { mode: 0o700 });
  return Object.freeze({
    root,
    parent,
    target: path.join(
      parent,
      PLATFORM_RELEASE_BOOTSTRAP_FILESYSTEM_SCOPE_DOCUMENT_BASENAME_V2,
    ),
    stage: path.join(
      parent,
      PLATFORM_RELEASE_BOOTSTRAP_FILESYSTEM_SCOPE_STAGE_BASENAME_V2,
    ),
    cleanup: async () => {
      await rm(root, { recursive: true, force: true });
    },
  });
}

function scopeTextV2(nonceCharacter: string): string {
  return canonicalJsonStringify(
    buildBootstrapFilesystemScopeIdentityV2({
      scopeNonce: nonceCharacter.repeat(64),
    }),
  );
}

async function expectPublicationErrorV2(
  action: () => Promise<unknown>,
  code:
    | "SCOPE_PUBLICATION_CONFLICT"
    | "SCOPE_PUBLICATION_INVALID"
    | "SCOPE_PUBLICATION_PARENT_CHANGED"
    | "SCOPE_PUBLICATION_UNAVAILABLE",
): Promise<void> {
  await assert.rejects(action, (error: unknown) => {
    assert.ok(
      error
        instanceof PlatformReleaseBootstrapScopePublicationErrorV2,
    );
    assert.equal(error.code, code);
    return true;
  });
}

describe("platform release bootstrap filesystem scope publication v2", () => {
  it("publishes one canonical scope with no-replace 1-2-1 links and reuses the exact final", async () => {
    const fixture = await fixtureV2();
    try {
      const first =
        await ensureCooperativeBootstrapFilesystemScopeWithTestFaultsV2({
          parentPath: fixture.parent,
          nonceHex: "a".repeat(64),
        });
      assert.equal(
        first.filesystemScope.scopeNonce,
        "a".repeat(64),
      );
      assert.equal(first.fingerprint.linkCount, 1);
      assert.equal(
        JSON.stringify(first).includes(fixture.parent),
        false,
      );
      assert.equal(
        await readFile(fixture.target, "utf8"),
        canonicalJsonStringify(first.filesystemScope),
      );
      assert.equal((await lstat(fixture.target)).nlink, 1);
      await assert.rejects(
        () => lstat(fixture.stage),
        (error: unknown) =>
          error instanceof Error
          && "code" in error
          && error.code === "ENOENT",
      );

      const replay =
        await ensureCooperativeBootstrapFilesystemScopeV2(
          fixture.parent,
        );
      assert.deepEqual(replay, first);
    } finally {
      await fixture.cleanup();
    }
  });

  it("converges after every process-crash checkpoint without replacing the staged inode", async () => {
    for (
      const checkpoint of Object.values(
        PlatformReleaseBootstrapScopePublicationCheckpointV2,
      )
    ) {
      const fixture = await fixtureV2();
      try {
        let injected = false;
        await assert.rejects(
          () =>
            ensureCooperativeBootstrapFilesystemScopeWithTestFaultsV2({
              parentPath: fixture.parent,
              nonceHex: "b".repeat(64),
              checkpoint: (observed) => {
                if (!injected && observed === checkpoint) {
                  injected = true;
                  throw new Error(`injected:${checkpoint}`);
                }
              },
            }),
          new RegExp(`injected:${checkpoint}`),
        );
        assert.equal(injected, true);
        const replayCheckpoints: string[] = [];
        const replay =
          await ensureCooperativeBootstrapFilesystemScopeWithTestFaultsV2({
            parentPath: fixture.parent,
            nonceHex: "b".repeat(64),
            checkpoint: (observed) => {
              replayCheckpoints.push(observed);
            },
          });
        if (
          checkpoint
            ===
              PlatformReleaseBootstrapScopePublicationCheckpointV2
                .afterStageWrite
          || checkpoint
            ===
              PlatformReleaseBootstrapScopePublicationCheckpointV2
                .afterStageFileSync
        ) {
          assert.ok(
            replayCheckpoints.includes(
              PlatformReleaseBootstrapScopePublicationCheckpointV2
                .afterStageFileSync,
            ),
          );
          assert.ok(
            replayCheckpoints.includes(
              PlatformReleaseBootstrapScopePublicationCheckpointV2
                .afterStageDirectorySync,
            ),
          );
        }
        if (
          checkpoint
            ===
              PlatformReleaseBootstrapScopePublicationCheckpointV2
                .afterStageUnlink
        ) {
          assert.ok(
            replayCheckpoints.includes(
              PlatformReleaseBootstrapScopePublicationCheckpointV2
                .afterFinalDirectorySync,
            ),
          );
        }
        assert.equal(
          replay.filesystemScope.scopeNonce,
          "b".repeat(64),
        );
        assert.equal((await lstat(fixture.target)).nlink, 1);
        await assert.rejects(
          () => lstat(fixture.stage),
          (error: unknown) =>
            error instanceof Error
            && "code" in error
            && error.code === "ENOENT",
        );
      } finally {
        await fixture.cleanup();
      }
    }
  });

  it("accepts only an exact valid EEXIST winner and removes its own exact unaliased stage", async () => {
    const fixture = await fixtureV2();
    try {
      let installedCompetitor = false;
      const observedCheckpoints: string[] = [];
      const winner =
        await ensureCooperativeBootstrapFilesystemScopeWithTestFaultsV2({
          parentPath: fixture.parent,
          nonceHex: "c".repeat(64),
          checkpoint: async (checkpoint) => {
            observedCheckpoints.push(checkpoint);
            if (
              !installedCompetitor
              && checkpoint
                ===
                  PlatformReleaseBootstrapScopePublicationCheckpointV2
                    .afterStageDirectorySync
            ) {
              installedCompetitor = true;
              await writeFile(
                fixture.target,
                scopeTextV2("d"),
                { mode: 0o600, flag: "wx" },
              );
            }
          },
        });
      assert.equal(installedCompetitor, true);
      assert.equal(
        winner.filesystemScope.scopeNonce,
        "d".repeat(64),
      );
      assert.equal(
        await readFile(fixture.target, "utf8"),
        scopeTextV2("d"),
      );
      assert.ok(
        observedCheckpoints.includes(
          PlatformReleaseBootstrapScopePublicationCheckpointV2
            .afterTargetDirectorySync,
        ),
      );
      assert.ok(
        observedCheckpoints.includes(
          PlatformReleaseBootstrapScopePublicationCheckpointV2
            .afterFinalDirectorySync,
        ),
      );
      await assert.rejects(() => lstat(fixture.stage));
    } finally {
      await fixture.cleanup();
    }
  });

  it("adopts one exact durable stage-only replay before accepting a later EEXIST winner", async () => {
    const fixture = await fixtureV2();
    try {
      await writeFile(fixture.stage, scopeTextV2("8"), {
        mode: 0o600,
      });
      let installedCompetitor = false;
      const winner =
        await ensureCooperativeBootstrapFilesystemScopeWithTestFaultsV2({
          parentPath: fixture.parent,
          nonceHex: "9".repeat(64),
          checkpoint: async (checkpoint) => {
            if (
              !installedCompetitor
              && checkpoint
                ===
                  PlatformReleaseBootstrapScopePublicationCheckpointV2
                    .afterStageDirectorySync
            ) {
              installedCompetitor = true;
              await writeFile(
                fixture.target,
                scopeTextV2("7"),
                { mode: 0o600, flag: "wx" },
              );
            }
          },
        });
      assert.equal(installedCompetitor, true);
      assert.equal(
        winner.filesystemScope.scopeNonce,
        "7".repeat(64),
      );
      await assert.rejects(() => lstat(fixture.stage));
      assert.equal((await lstat(fixture.target)).nlink, 1);
    } finally {
      await fixture.cleanup();
    }
  });

  it("preserves an ambiguous pre-existing valid stage plus different valid target", async () => {
    const fixture = await fixtureV2();
    try {
      await writeFile(fixture.target, scopeTextV2("a"), {
        mode: 0o600,
      });
      await writeFile(fixture.stage, scopeTextV2("b"), {
        mode: 0o600,
      });
      await expectPublicationErrorV2(
        () =>
          ensureCooperativeBootstrapFilesystemScopeV2(
            fixture.parent,
          ),
        "SCOPE_PUBLICATION_CONFLICT",
      );
      assert.equal(
        await readFile(fixture.target, "utf8"),
        scopeTextV2("a"),
      );
      assert.equal(
        await readFile(fixture.stage, "utf8"),
        scopeTextV2("b"),
      );
    } finally {
      await fixture.cleanup();
    }
  });

  it("rejects a valid target inode replacement after staged unlink", async () => {
    const fixture = await fixtureV2();
    try {
      let replaced = false;
      await expectPublicationErrorV2(
        () =>
          ensureCooperativeBootstrapFilesystemScopeWithTestFaultsV2({
            parentPath: fixture.parent,
            nonceHex: "c".repeat(64),
            checkpoint: async (checkpoint, context) => {
              if (
                !replaced
                && checkpoint
                  ===
                    PlatformReleaseBootstrapScopePublicationCheckpointV2
                      .afterStageUnlink
              ) {
                replaced = true;
                await unlink(context.targetPath);
                await writeFile(
                  context.targetPath,
                  scopeTextV2("d"),
                  { mode: 0o600 },
                );
              }
            },
          }),
        "SCOPE_PUBLICATION_CONFLICT",
      );
      assert.equal(replaced, true);
      assert.equal(
        await readFile(fixture.target, "utf8"),
        scopeTextV2("d"),
      );
    } finally {
      await fixture.cleanup();
    }
  });

  it("preserves invalid targets and rejects symlink, FIFO, hard-link, and invalid-stage state", async () => {
    const invalidFixture = await fixtureV2();
    try {
      await writeFile(
        invalidFixture.target,
        "foreign",
        { mode: 0o600 },
      );
      await expectPublicationErrorV2(
        () =>
          ensureCooperativeBootstrapFilesystemScopeV2(
            invalidFixture.parent,
          ),
        "SCOPE_PUBLICATION_INVALID",
      );
      assert.equal(
        await readFile(invalidFixture.target, "utf8"),
        "foreign",
      );
    } finally {
      await invalidFixture.cleanup();
    }

    const symlinkFixture = await fixtureV2();
    try {
      const outside = path.join(
        symlinkFixture.root,
        "outside",
      );
      await writeFile(outside, scopeTextV2("e"), {
        mode: 0o600,
      });
      await symlink(outside, symlinkFixture.target);
      await expectPublicationErrorV2(
        () =>
          ensureCooperativeBootstrapFilesystemScopeV2(
            symlinkFixture.parent,
          ),
        "SCOPE_PUBLICATION_INVALID",
      );
    } finally {
      await symlinkFixture.cleanup();
    }

    const fifoFixture = await fixtureV2();
    try {
      execFileSync("mkfifo", [fifoFixture.target]);
      await expectPublicationErrorV2(
        () =>
          ensureCooperativeBootstrapFilesystemScopeV2(
            fifoFixture.parent,
          ),
        "SCOPE_PUBLICATION_INVALID",
      );
    } finally {
      await fifoFixture.cleanup();
    }

    const hardlinkFixture = await fixtureV2();
    try {
      const outside = path.join(
        hardlinkFixture.root,
        "outside",
      );
      await writeFile(outside, scopeTextV2("f"), {
        mode: 0o600,
      });
      await link(outside, hardlinkFixture.target);
      await expectPublicationErrorV2(
        () =>
          ensureCooperativeBootstrapFilesystemScopeV2(
            hardlinkFixture.parent,
          ),
        "SCOPE_PUBLICATION_CONFLICT",
      );
      assert.equal((await lstat(outside)).nlink, 2);
    } finally {
      await hardlinkFixture.cleanup();
    }

    const stageFixture = await fixtureV2();
    try {
      await writeFile(stageFixture.stage, "foreign", {
        mode: 0o600,
      });
      await expectPublicationErrorV2(
        () =>
          ensureCooperativeBootstrapFilesystemScopeV2(
            stageFixture.parent,
          ),
        "SCOPE_PUBLICATION_INVALID",
      );
      assert.equal(
        await readFile(stageFixture.stage, "utf8"),
        "foreign",
      );
    } finally {
      await stageFixture.cleanup();
    }
  });

  it("fails closed when the parent is replaced after the final durability checkpoint", async () => {
    const fixture = await fixtureV2();
    try {
      const moved = path.join(fixture.root, "moved-parent");
      let replaced = false;
      await expectPublicationErrorV2(
        () =>
          ensureCooperativeBootstrapFilesystemScopeWithTestFaultsV2({
            parentPath: fixture.parent,
            nonceHex: "1".repeat(64),
            checkpoint: async (checkpoint, context) => {
              if (
                !replaced
                && checkpoint
                  ===
                    PlatformReleaseBootstrapScopePublicationCheckpointV2
                      .afterFinalDirectorySync
              ) {
                replaced = true;
                const exact = await readFile(
                  context.targetPath,
                );
                await rename(fixture.parent, moved);
                await mkdir(fixture.parent, {
                  mode: 0o700,
                });
                await writeFile(
                  path.join(
                    fixture.parent,
                    PLATFORM_RELEASE_BOOTSTRAP_FILESYSTEM_SCOPE_DOCUMENT_BASENAME_V2,
                  ),
                  exact,
                  { mode: 0o600 },
                );
              }
            },
          }),
        "SCOPE_PUBLICATION_PARENT_CHANGED",
      );
      assert.equal(replaced, true);
    } finally {
      await fixture.cleanup();
    }
  });
});
