import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { createStoryWorktree, discardStoryWorktreeAndResetBranch } from "../src/installer/worktree-ops.js";

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

  it("does not auto-stash product supervisor memory from the main repo", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-worktree-internal-main-dirty-"));
    const origin = path.join(tmp, "origin.git");
    const repo = path.join(tmp, "repo");
    const storyBranch = "c62e1bc1-us-005";

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
      fs.writeFileSync(path.join(repo, "SUPERVISOR_MEMORY.md"), "legacy memory\n");
      git(repo, ["add", "README.md", "SUPERVISOR_MEMORY.md"]);
      git(repo, ["commit", "-m", "base"]);
      git(repo, ["push", "origin", "main"]);

      fs.writeFileSync(path.join(repo, "SUPERVISOR_MEMORY.md"), "updated manager memory\n");
      assert.match(git(repo, ["status", "--porcelain"]), /SUPERVISOR_MEMORY\.md/);

      const worktree = createStoryWorktree(repo, storyBranch, "main");

      assert.equal(git(repo, ["stash", "list"]), "");
      assert.equal(git(worktree, ["branch", "--show-current"]), storyBranch);
      assert.match(git(repo, ["status", "--porcelain"]), /SUPERVISOR_MEMORY\.md/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("releases stale managed supervisor worktrees before retrying a story branch", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-worktree-supervisor-lock-"));
    const origin = path.join(tmp, "origin.git");
    const repo = path.join(tmp, "repo");
    const supervisorWorktree = path.join(tmp, "supervisor", "story-worktrees", "c62e1bc1-us-004");
    const storyBranch = "c62e1bc1-us-004";

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
      git(repo, ["branch", storyBranch, "main"]);
      fs.mkdirSync(path.dirname(supervisorWorktree), { recursive: true });
      git(repo, ["worktree", "add", supervisorWorktree, storyBranch]);

      assert.equal(git(supervisorWorktree, ["branch", "--show-current"]), storyBranch);

      const retryWorktree = createStoryWorktree(repo, storyBranch, "main");

      assert.ok(retryWorktree.endsWith(path.join(".worktrees", storyBranch)));
      assert.equal(git(retryWorktree, ["branch", "--show-current"]), storyBranch);
      assert.equal(fs.existsSync(supervisorWorktree), false);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("discards guarded retry worktrees instead of preserving WIP history", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-worktree-guard-discard-"));
    const origin = path.join(tmp, "origin.git");
    const repo = path.join(tmp, "repo");
    const storyBranch = "c62e1bc1-us-002";

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
      const baseSha = git(repo, ["rev-parse", "main"]);

      const worktree = createStoryWorktree(repo, storyBranch, baseSha);
      fs.writeFileSync(path.join(worktree, "bad.txt"), "contaminated\n");
      git(worktree, ["add", "bad.txt"]);
      git(worktree, ["commit", "-m", "wip: contaminated runtime guard attempt"]);
      git(worktree, ["push", "-u", "origin", storyBranch]);
      assert.ok(fs.existsSync(worktree));
      assert.notEqual(git(worktree, ["rev-parse", "HEAD"]), baseSha);

      discardStoryWorktreeAndResetBranch(repo, storyBranch, baseSha);

      assert.equal(fs.existsSync(worktree), false);
      assert.equal(git(repo, ["rev-parse", storyBranch]), baseSha);
      assert.throws(() => git(repo, ["ls-remote", "--exit-code", "origin", storyBranch]));

      const cleanWorktree = createStoryWorktree(repo, storyBranch, baseSha);
      assert.equal(git(cleanWorktree, ["rev-parse", "HEAD"]), baseSha);
      assert.equal(fs.existsSync(path.join(cleanWorktree, "bad.txt")), false);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("does not reuse story branches with WIP retry history", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-worktree-wip-history-"));
    const origin = path.join(tmp, "origin.git");
    const repo = path.join(tmp, "repo");
    const storyBranch = "c62e1bc1-us-003";

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
      const baseSha = git(repo, ["rev-parse", "main"]);

      const firstWorktree = createStoryWorktree(repo, storyBranch, baseSha);
      fs.writeFileSync(path.join(firstWorktree, "bad.txt"), "contaminated\n");
      git(firstWorktree, ["add", "bad.txt"]);
      git(firstWorktree, ["commit", "-m", "wip: contaminated history"]);
      git(firstWorktree, ["push", "-u", "origin", storyBranch]);

      const secondWorktree = createStoryWorktree(repo, storyBranch, baseSha);

      assert.equal(secondWorktree, firstWorktree);
      assert.equal(git(secondWorktree, ["rev-parse", "HEAD"]), baseSha);
      assert.equal(fs.existsSync(path.join(secondWorktree, "bad.txt")), false);
      assert.equal(git(repo, ["rev-parse", storyBranch]), baseSha);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
