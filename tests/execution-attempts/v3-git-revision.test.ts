import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  captureV3GitCommitRevision,
  replayV3HistoricalGitCommitAncestryV1,
  resolveV3GitRevision,
  V3GitRevisionError,
} from "../../src/execution/v3-git-revision.js";
import * as v3GitRevisionModule from "../../src/execution/v3-git-revision.js";

function git(repo: string, args: readonly string[]): string {
  return execFileSync("git", [...args], {
    cwd: repo,
    encoding: "utf8",
    timeout: 10_000,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function gitObject(repo: string, type: "commit" | "tree", bytes: string): string {
  return execFileSync("git", ["hash-object", "--literally", "-t", type, "-w", "--stdin"], {
    cwd: repo,
    encoding: "utf8",
    input: bytes,
    stdio: ["pipe", "pipe", "pipe"],
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

  it("replays the exact stored historical ancestry proof without consulting current HEAD", () => {
    const replay = (v3GitRevisionModule as Readonly<Record<string, unknown>>)
      .replayV3HistoricalGitCommitAncestryV1;
    assert.equal(
      typeof replay,
      "function",
      "production must export replayV3HistoricalGitCommitAncestryV1",
    );
    assert.deepEqual(
      (replay as (input: Readonly<Record<string, string>>) => unknown)({
        repo,
        ancestorSha: firstSha,
        descendantSha: secondSha,
        expectedAncestorTreeHash: firstTree,
        expectedDescendantTreeHash: secondTree,
        expectedMergeBase: firstSha,
      }),
      {
        ancestorSha: firstSha,
        descendantSha: secondSha,
        ancestorTreeHash: firstTree,
        descendantTreeHash: secondTree,
        mergeBase: firstSha,
      },
    );
  });

  it("rejects any ref or other caller-controlled field outside the exact historical proof ABI", () => {
    assert.throws(
      () => replayV3HistoricalGitCommitAncestryV1({
        repo,
        ancestorSha: firstSha,
        descendantSha: secondSha,
        expectedAncestorTreeHash: firstTree,
        expectedDescendantTreeHash: secondTree,
        expectedMergeBase: firstSha,
        requestedRef: "main",
      } as Parameters<typeof replayV3HistoricalGitCommitAncestryV1>[0]),
      (error) => errorCode(error) === "V3_GIT_REVISION_INPUT_INVALID",
    );
  });

  it("returns the typed INVALID error for non-object and non-string historical inputs", () => {
    const replay = replayV3HistoricalGitCommitAncestryV1 as unknown as (input: unknown) => unknown;
    for (const input of [null, undefined, 42, [], "history"]) {
      assert.throws(
        () => replay(input),
        (error) => errorCode(error) === "V3_GIT_REVISION_INPUT_INVALID",
      );
    }
    const valid = {
      repo,
      ancestorSha: firstSha,
      descendantSha: secondSha,
      expectedAncestorTreeHash: firstTree,
      expectedDescendantTreeHash: secondTree,
      expectedMergeBase: firstSha,
    };
    for (const field of Object.keys(valid)) {
      assert.throws(
        () => replay({ ...valid, [field]: 42 }),
        (error) => errorCode(error) === "V3_GIT_REVISION_INPUT_INVALID",
      );
    }
  });

  it("replays stored objects across HEAD advance and ignores replacement refs", async () => {
    const valid = {
      repo,
      ancestorSha: firstSha,
      descendantSha: secondSha,
      expectedAncestorTreeHash: firstTree,
      expectedDescendantTreeHash: secondTree,
      expectedMergeBase: firstSha,
    } as const;
    git(repo, ["replace", firstSha, secondSha]);
    await writeFile(path.join(repo, "tracked.txt"), "third\n", "utf8");
    git(repo, ["add", "tracked.txt"]);
    git(repo, ["commit", "-qm", "advance current HEAD"]);
    assert.deepEqual(replayV3HistoricalGitCommitAncestryV1(valid), {
      ancestorSha: firstSha,
      descendantSha: secondSha,
      ancestorTreeHash: firstTree,
      descendantTreeHash: secondTree,
      mergeBase: firstSha,
    });
  });

  it("rejects historical object, stored-tree, merge-base, and ancestry proof drift", async () => {
    const valid = {
      repo,
      ancestorSha: firstSha,
      descendantSha: secondSha,
      expectedAncestorTreeHash: firstTree,
      expectedDescendantTreeHash: secondTree,
      expectedMergeBase: firstSha,
    } as const;
    assert.throws(
      () => replayV3HistoricalGitCommitAncestryV1({
        ...valid,
        expectedAncestorTreeHash: "0".repeat(firstTree.length),
      }),
      (error) => errorCode(error) === "V3_GIT_PROOF_MISMATCH",
    );
    assert.throws(
      () => replayV3HistoricalGitCommitAncestryV1({
        ...valid,
        expectedMergeBase: secondSha,
      }),
      (error) => errorCode(error) === "V3_GIT_PROOF_MISMATCH",
    );
    assert.throws(
      () => replayV3HistoricalGitCommitAncestryV1({
        ...valid,
        ancestorSha: secondSha,
        descendantSha: firstSha,
        expectedAncestorTreeHash: secondTree,
        expectedDescendantTreeHash: firstTree,
        expectedMergeBase: secondSha,
      }),
      (error) => errorCode(error) === "V3_GIT_ANCESTRY_INVALID",
    );

    await writeFile(path.join(repo, "historical-blob.txt"), "blob\n", "utf8");
    const blobSha = git(repo, ["hash-object", "-w", "historical-blob.txt"]);
    assert.throws(
      () => replayV3HistoricalGitCommitAncestryV1({ ...valid, ancestorSha: blobSha }),
      (error) => errorCode(error) === "V3_GIT_OBJECT_NOT_COMMIT",
    );
    git(repo, ["tag", "-a", "history-tag", firstSha, "-m", "history tag"]);
    const tagSha = git(repo, ["rev-parse", "refs/tags/history-tag"]);
    assert.throws(
      () => replayV3HistoricalGitCommitAncestryV1({ ...valid, ancestorSha: tagSha }),
      (error) => errorCode(error) === "V3_GIT_OBJECT_NOT_COMMIT",
    );
    assert.throws(
      () => replayV3HistoricalGitCommitAncestryV1({ ...valid, descendantSha: "f".repeat(40) }),
      (error) => errorCode(error) === "V3_GIT_COMMIT_UNAVAILABLE",
    );

    const malformedTreeSha = gitObject(repo, "tree", "not-a-valid-tree-object");
    const malformedCommitSha = gitObject(repo, "commit", [
      `tree ${malformedTreeSha}`,
      "author Setfarm Test <setfarm-test@example.invalid> 0 +0000",
      "committer Setfarm Test <setfarm-test@example.invalid> 0 +0000",
      "",
      "malformed tree fixture",
      "",
    ].join("\n"));
    assert.throws(
      () => replayV3HistoricalGitCommitAncestryV1({
        ...valid,
        ancestorSha: malformedCommitSha,
        expectedAncestorTreeHash: malformedTreeSha,
      }),
      (error) => errorCode(error) === "V3_GIT_TREE_INVALID",
    );
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
