import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  captureV3GitCommitRevision,
  resolveV3GitRevision,
  V3GitRevisionError,
} from "../../src/execution/v3-git-revision.js";

function git(repo: string, args: readonly string[]): string {
  return execFileSync("git", [...args], {
    cwd: repo,
    encoding: "utf8",
    timeout: 10_000,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function errorCode(error: unknown): string | undefined {
  return error instanceof V3GitRevisionError ? error.code : undefined;
}

describe("v3 immutable Git revision capture", () => {
  let repo = "";
  let firstSha = "";
  let firstTree = "";
  let secondSha = "";
  let secondTree = "";

  beforeEach(async () => {
    repo = await mkdtemp(path.join(tmpdir(), "setfarm-v3-git-revision-"));
    git(repo, ["init", "-q", "-b", "main"]);
    git(repo, ["config", "user.name", "Setfarm Test"]);
    git(repo, ["config", "user.email", "setfarm-test@example.invalid"]);
    await writeFile(path.join(repo, "tracked.txt"), "first\n", "utf8");
    git(repo, ["add", "tracked.txt"]);
    git(repo, ["commit", "-qm", "first"]);
    firstSha = git(repo, ["rev-parse", "HEAD"]);
    firstTree = git(repo, ["rev-parse", `${firstSha}^{tree}`]);
    git(repo, ["branch", "pinned-base", firstSha]);

    await writeFile(path.join(repo, "tracked.txt"), "second\n", "utf8");
    git(repo, ["add", "tracked.txt"]);
    git(repo, ["commit", "-qm", "second"]);
    secondSha = git(repo, ["rev-parse", "HEAD"]);
    secondTree = git(repo, ["rev-parse", `${secondSha}^{tree}`]);
  });

  afterEach(async () => {
    await rm(repo, { recursive: true, force: true });
  });

  it("captures the requested pinned base rather than HEAD", () => {
    assert.notEqual(firstSha, secondSha);
    assert.deepEqual(resolveV3GitRevision({ repo, requestedRef: "pinned-base" }), {
      sha: firstSha,
      treeHash: firstTree,
    });
    assert.deepEqual(resolveV3GitRevision({ repo, requestedRef: secondSha }), {
      sha: secondSha,
      treeHash: secondTree,
    });
  });

  it("ignores dirty tracked and untracked working-tree bytes without changing them", async () => {
    await writeFile(path.join(repo, "tracked.txt"), "dirty\n", "utf8");
    git(repo, ["add", "tracked.txt"]);
    await writeFile(path.join(repo, "untracked.txt"), "untracked\n", "utf8");
    const headBefore = git(repo, ["rev-parse", "HEAD"]);
    const statusBefore = git(repo, ["status", "--porcelain=v1"]);
    const worktreesBefore = git(repo, ["worktree", "list", "--porcelain"]);

    assert.deepEqual(resolveV3GitRevision({ repo, requestedRef: "pinned-base" }), {
      sha: firstSha,
      treeHash: firstTree,
    });
    assert.equal(git(repo, ["rev-parse", "HEAD"]), headBefore);
    assert.equal(git(repo, ["status", "--porcelain=v1"]), statusBefore);
    assert.equal(git(repo, ["worktree", "list", "--porcelain"]), worktreesBefore);
  });

  it("pins an advanced ref to its new commit and enforces expected-SHA CAS", () => {
    assert.deepEqual(resolveV3GitRevision({
      repo,
      requestedRef: "pinned-base",
      expectedSha: firstSha,
    }), { sha: firstSha, treeHash: firstTree });

    git(repo, ["branch", "-f", "pinned-base", secondSha]);
    assert.deepEqual(resolveV3GitRevision({ repo, requestedRef: "pinned-base" }), {
      sha: secondSha,
      treeHash: secondTree,
    });
    assert.throws(
      () => resolveV3GitRevision({ repo, requestedRef: "pinned-base", expectedSha: firstSha }),
      (error) => errorCode(error) === "V3_GIT_EXPECTED_SHA_MISMATCH",
    );
  });

  it("peels an unambiguous annotated tag but rejects ambiguous short refs", () => {
    git(repo, ["tag", "-a", "release", firstSha, "-m", "release"]);
    assert.deepEqual(resolveV3GitRevision({ repo, requestedRef: "release" }), {
      sha: firstSha,
      treeHash: firstTree,
    });

    git(repo, ["branch", "clash", firstSha]);
    git(repo, ["tag", "clash", secondSha]);
    assert.throws(
      () => resolveV3GitRevision({ repo, requestedRef: "clash" }),
      (error) => errorCode(error) === "V3_GIT_REF_INVALID",
    );
    assert.deepEqual(resolveV3GitRevision({ repo, requestedRef: "refs/heads/clash" }), {
      sha: firstSha,
      treeHash: firstTree,
    });
    assert.deepEqual(resolveV3GitRevision({ repo, requestedRef: "refs/tags/clash" }), {
      sha: secondSha,
      treeHash: secondTree,
    });
  });

  it("fails closed for missing commits, non-commit refs, and revision expressions", async () => {
    assert.throws(
      () => captureV3GitCommitRevision({ repo, commitSha: "f".repeat(39) }),
      (error) => errorCode(error) === "V3_GIT_REVISION_INPUT_INVALID",
    );
    assert.throws(
      () => resolveV3GitRevision({ repo, requestedRef: firstSha, expectedSha: firstSha.toUpperCase() }),
      (error) => errorCode(error) === "V3_GIT_REVISION_INPUT_INVALID",
    );
    assert.throws(
      () => captureV3GitCommitRevision({ repo, commitSha: "f".repeat(40) }),
      (error) => errorCode(error) === "V3_GIT_COMMIT_UNAVAILABLE",
    );

    await writeFile(path.join(repo, "blob.txt"), "blob\n", "utf8");
    const blobSha = git(repo, ["hash-object", "-w", "blob.txt"]);
    git(repo, ["update-ref", "refs/tags/blob-target", blobSha]);
    assert.throws(
      () => captureV3GitCommitRevision({ repo, commitSha: blobSha }),
      (error) => errorCode(error) === "V3_GIT_OBJECT_NOT_COMMIT",
    );
    assert.throws(
      () => resolveV3GitRevision({ repo, requestedRef: "blob-target" }),
      (error) => errorCode(error) === "V3_GIT_REF_NOT_COMMIT",
    );
    assert.throws(
      () => resolveV3GitRevision({ repo, requestedRef: "missing-base" }),
      (error) => errorCode(error) === "V3_GIT_REF_INVALID",
    );
    assert.throws(
      () => resolveV3GitRevision({ repo, requestedRef: "HEAD~1" }),
      (error) => errorCode(error) === "V3_GIT_REF_INVALID",
    );
  });
});
