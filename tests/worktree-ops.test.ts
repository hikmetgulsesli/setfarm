import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { applyScopedRetryPatchForStory, createStoryWorktree, discardDirtyRetryWorktreeState, discardStoryWorktreeAndResetBranch, latestRetryPatchForStory } from "../src/installer/worktree-ops.js";

function git(cwd: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf-8",
    timeout: 30000,
    stdio: ["pipe", "pipe", "pipe"],
  }).trim();
}

describe("worktree operations", () => {
  it("supports macOS worktree process cleanup via lsof", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/installer/worktree-ops.ts"), "utf-8");

    assert.match(source, /process\.platform === "darwin"/);
    assert.match(source, /execFileSync\("lsof",\s*\["-t",\s*"\+D",\s*dir\]/);
    assert.match(source, /process\.kill\(pid,\s*"SIGTERM"\)/);
    assert.match(source, /process\.kill\(pid,\s*"SIGKILL"\)/);
  });

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
      const retryPatch = latestRetryPatchForStory(repo, storyBranch);
      assert.ok(retryPatch.endsWith(".patch"));
      assert.match(fs.readFileSync(retryPatch, "utf-8"), /dirty\.txt/);
      assert.match(fs.readFileSync(retryPatch, "utf-8"), /uncommitted retry context/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("finds retry patches captured under run-prefixed story branches", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-worktree-retry-patch-"));
    const repo = path.join(tmp, "repo");

    try {
      fs.mkdirSync(path.join(repo, ".setfarm", "retry-patches"), { recursive: true });
      const patchPath = path.join(repo, ".setfarm", "retry-patches", "257439ea-qa-fix-001-2026-06-05T07-03-48-938Z.patch");
      fs.writeFileSync(patchPath, "diff --git a/src/App.tsx b/src/App.tsx\n");

      assert.equal(latestRetryPatchForStory(repo, "QA-FIX-001"), patchPath);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("does not reuse a clean story worktree when main advanced underneath it", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-worktree-stale-base-"));
    const origin = path.join(tmp, "origin.git");
    const repo = path.join(tmp, "repo");
    const storyBranch = "c62e1bc1-qa-fix-002";

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
      fs.writeFileSync(path.join(repo, "README.md"), "base v1\n");
      git(repo, ["add", "README.md"]);
      git(repo, ["commit", "-m", "base v1"]);
      git(repo, ["push", "origin", "main"]);

      const firstWorktree = createStoryWorktree(repo, storyBranch, "main");
      assert.equal(fs.readFileSync(path.join(firstWorktree, "README.md"), "utf-8"), "base v1\n");
      assert.equal(git(firstWorktree, ["status", "--porcelain"]), "");

      fs.writeFileSync(path.join(repo, "README.md"), "base v2\n");
      git(repo, ["add", "README.md"]);
      git(repo, ["commit", "-m", "base v2"]);
      git(repo, ["push", "origin", "main"]);

      const secondWorktree = createStoryWorktree(repo, storyBranch, "main");

      assert.equal(secondWorktree, firstWorktree);
      assert.equal(git(secondWorktree, ["status", "--porcelain"]), "");
      assert.equal(git(secondWorktree, ["branch", "--show-current"]), storyBranch);
      assert.equal(fs.readFileSync(path.join(secondWorktree, "README.md"), "utf-8"), "base v2\n");
      assert.equal(git(secondWorktree, ["rev-parse", "HEAD"]), git(repo, ["rev-parse", "main"]));
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("does not let assume-unchanged tracked source changes hide in a reused worktree", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-worktree-hidden-index-"));
    const origin = path.join(tmp, "origin.git");
    const repo = path.join(tmp, "repo");
    const storyBranch = "c62e1bc1-us-006";

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
      fs.mkdirSync(path.join(repo, "src"), { recursive: true });
      fs.writeFileSync(path.join(repo, "src", "App.tsx"), "export const value = 'base';\n");
      git(repo, ["add", "src/App.tsx"]);
      git(repo, ["commit", "-m", "base"]);
      git(repo, ["push", "origin", "main"]);

      const firstWorktree = createStoryWorktree(repo, storyBranch, "main");
      fs.writeFileSync(path.join(firstWorktree, "src", "App.tsx"), "export const value = 'stale hidden';\n");
      git(firstWorktree, ["update-index", "--assume-unchanged", "src/App.tsx"]);
      assert.equal(git(firstWorktree, ["status", "--porcelain"]), "");
      assert.match(git(firstWorktree, ["ls-files", "-v", "src/App.tsx"]), /^h /);

      const secondWorktree = createStoryWorktree(repo, storyBranch, "main");

      assert.equal(secondWorktree, firstWorktree);
      assert.equal(fs.readFileSync(path.join(secondWorktree, "src", "App.tsx"), "utf-8"), "export const value = 'base';\n");
      assert.equal(git(secondWorktree, ["status", "--porcelain"]), "");
      assert.match(git(secondWorktree, ["ls-files", "-v", "src/App.tsx"]), /^H /);
      assert.match(git(repo, ["stash", "list"]), /setfarm-auto-stash dirty story worktree before c62e1bc1-us-006/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("discards dirty tracked files before retry context reaches an agent", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-worktree-retry-clean-"));
    const origin = path.join(tmp, "origin.git");
    const repo = path.join(tmp, "repo");
    const storyBranch = "c62e1bc1-us-007";

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
      fs.mkdirSync(path.join(repo, "src"), { recursive: true });
      fs.writeFileSync(path.join(repo, "src", "App.tsx"), "export const marker = 'clean';\n");
      git(repo, ["add", "src/App.tsx"]);
      git(repo, ["commit", "-m", "base"]);
      git(repo, ["push", "origin", "main"]);

      const worktree = createStoryWorktree(repo, storyBranch, "main");
      fs.writeFileSync(path.join(worktree, "src", "App.tsx"), "export const marker = 'failed retry shell';\n");
      assert.match(git(worktree, ["status", "--porcelain"]), /src\/App\.tsx/);

      const discarded = discardDirtyRetryWorktreeState(worktree, "US-007", "run-test");

      assert.deepEqual(discarded, ["src/App.tsx"]);
      assert.equal(git(worktree, ["status", "--porcelain"]), "");
      assert.equal(fs.readFileSync(path.join(worktree, "src", "App.tsx"), "utf-8"), "export const marker = 'clean';\n");
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("restores the latest retry patch when every touched file is inside story scope", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-worktree-retry-restore-"));
    const origin = path.join(tmp, "origin.git");
    const repo = path.join(tmp, "repo");
    const storyBranch = "c62e1bc1-us-008";

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
      fs.mkdirSync(path.join(repo, "src"), { recursive: true });
      fs.writeFileSync(path.join(repo, "src", "App.tsx"), "export const marker = 'clean';\n");
      git(repo, ["add", "src/App.tsx"]);
      git(repo, ["commit", "-m", "base"]);
      git(repo, ["push", "origin", "main"]);

      const worktree = createStoryWorktree(repo, storyBranch, "main");
      fs.writeFileSync(path.join(worktree, "src", "App.tsx"), "export const marker = 'failed attempt';\n");
      const retryWorktree = createStoryWorktree(repo, storyBranch, "main");

      assert.equal(retryWorktree, worktree);
      assert.equal(fs.readFileSync(path.join(worktree, "src", "App.tsx"), "utf-8"), "export const marker = 'clean';\n");
      assert.ok(latestRetryPatchForStory(repo, storyBranch));

      const restored = applyScopedRetryPatchForStory(repo, worktree, storyBranch, ["src/App.tsx"], "run-test");

      assert.equal(restored.applied, true);
      assert.deepEqual(restored.touchedFiles, ["src/App.tsx"]);
      assert.equal(fs.readFileSync(path.join(worktree, "src", "App.tsx"), "utf-8"), "export const marker = 'failed attempt';\n");
      assert.match(git(worktree, ["status", "--porcelain"]), /src\/App\.tsx/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("does not restore retry patches that touch files outside story scope", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-worktree-retry-restore-deny-"));
    const origin = path.join(tmp, "origin.git");
    const repo = path.join(tmp, "repo");
    const storyBranch = "c62e1bc1-us-009";

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
      fs.mkdirSync(path.join(repo, "src"), { recursive: true });
      fs.writeFileSync(path.join(repo, "src", "App.tsx"), "export const marker = 'clean';\n");
      fs.writeFileSync(path.join(repo, "package.json"), "{\"scripts\":{}}\n");
      git(repo, ["add", "src/App.tsx", "package.json"]);
      git(repo, ["commit", "-m", "base"]);
      git(repo, ["push", "origin", "main"]);

      const worktree = createStoryWorktree(repo, storyBranch, "main");
      fs.writeFileSync(path.join(worktree, "package.json"), "{\"scripts\":{\"test\":\"vitest\"}}\n");
      createStoryWorktree(repo, storyBranch, "main");

      const restored = applyScopedRetryPatchForStory(repo, worktree, storyBranch, ["src/App.tsx"], "run-test");

      assert.equal(restored.applied, false);
      assert.equal(restored.reason, "out_of_scope");
      assert.deepEqual(restored.touchedFiles, ["package.json"]);
      assert.equal(git(worktree, ["status", "--porcelain"]), "");
      assert.equal(fs.readFileSync(path.join(worktree, "package.json"), "utf-8"), "{\"scripts\":{}}\n");
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
