import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { createStoryWorktree } from "../src/installer/worktree-ops.js";

function git(cwd: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf-8",
    timeout: 30000,
    stdio: ["pipe", "pipe", "pipe"],
  }).trim();
}

describe("worktree operations", () => {
  it("recovers when the main project worktree is left on the story branch", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-worktree-"));
    const origin = path.join(tmp, "origin.git");
    const repo = path.join(tmp, "repo");
    const storyBranch = "c62e1bc1-us-001";

    try {
      execFileSync("git", ["init", "--bare", "--initial-branch=main", origin], {
        encoding: "utf-8",
        timeout: 30000,
        stdio: ["pipe", "pipe", "pipe"],
      });
      execFileSync("git", ["clone", origin, repo], {
        encoding: "utf-8",
        timeout: 30000,
        stdio: ["pipe", "pipe", "pipe"],
      });

      git(repo, ["config", "user.email", "setfarm@example.invalid"]);
      git(repo, ["config", "user.name", "Setfarm Test"]);
      fs.writeFileSync(path.join(repo, "README.md"), "base\n");
      git(repo, ["add", "README.md"]);
      git(repo, ["commit", "-m", "base"]);
      git(repo, ["push", "origin", "main"]);

      git(repo, ["checkout", "-b", storyBranch]);
      fs.writeFileSync(path.join(repo, "story.txt"), "story\n");
      git(repo, ["add", "story.txt"]);
      git(repo, ["commit", "-m", "story"]);
      git(repo, ["push", "-u", "origin", storyBranch]);
      assert.equal(git(repo, ["branch", "--show-current"]), storyBranch);

      const worktree = createStoryWorktree(repo, storyBranch, "main");

      assert.ok(worktree.endsWith(path.join(".worktrees", storyBranch)));
      assert.ok(fs.existsSync(path.join(worktree, "story.txt")));
      assert.equal(git(repo, ["branch", "--show-current"]), "main");
      assert.equal(git(worktree, ["branch", "--show-current"]), storyBranch);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("does not hand a dirty reused story worktree to the next claim", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-worktree-dirty-"));
    const origin = path.join(tmp, "origin.git");
    const repo = path.join(tmp, "repo");
    const storyBranch = "c62e1bc1-qa-fix-001";

    try {
      execFileSync("git", ["init", "--bare", "--initial-branch=main", origin], {
        encoding: "utf-8",
        timeout: 30000,
        stdio: ["pipe", "pipe", "pipe"],
      });
      execFileSync("git", ["clone", origin, repo], {
        encoding: "utf-8",
        timeout: 30000,
        stdio: ["pipe", "pipe", "pipe"],
      });

      git(repo, ["config", "user.email", "setfarm@example.invalid"]);
      git(repo, ["config", "user.name", "Setfarm Test"]);
      fs.writeFileSync(path.join(repo, "README.md"), "base\n");
      git(repo, ["add", "README.md"]);
      git(repo, ["commit", "-m", "base"]);
      git(repo, ["push", "origin", "main"]);

      const firstWorktree = createStoryWorktree(repo, storyBranch, "main");
      fs.writeFileSync(path.join(firstWorktree, "dirty.txt"), "uncommitted retry context\n");
      assert.notEqual(git(firstWorktree, ["status", "--porcelain"]), "");

      const secondWorktree = createStoryWorktree(repo, storyBranch, "main");

      assert.equal(secondWorktree, firstWorktree);
      assert.equal(git(secondWorktree, ["status", "--porcelain"]), "");
      assert.equal(git(secondWorktree, ["branch", "--show-current"]), storyBranch);
      assert.equal(fs.existsSync(path.join(secondWorktree, "dirty.txt")), false);
      assert.match(git(repo, ["stash", "list"]), /setfarm-auto-stash dirty story worktree before c62e1bc1-qa-fix-001/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
