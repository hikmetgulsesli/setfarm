import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getChangedFiles, getDiffSummary } from "../src/installer/static-analysis.js";

function git(repo: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd: repo,
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

describe("verify static analysis", () => {
  it("diffs an explicit head ref instead of depending on the current checkout", () => {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-static-analysis-"));
    try {
      git(repo, ["init", "-b", "main"]);
      git(repo, ["config", "user.email", "setfarm@example.test"]);
      git(repo, ["config", "user.name", "Setfarm Test"]);
      fs.mkdirSync(path.join(repo, "src"));
      fs.writeFileSync(path.join(repo, "src", "base.ts"), "export const base = 1;\n");
      git(repo, ["add", "."]);
      git(repo, ["commit", "-m", "base"]);
      git(repo, ["checkout", "-b", "story"]);
      fs.writeFileSync(path.join(repo, "src", "feature.ts"), "export const feature = 2;\n");
      fs.writeFileSync(path.join(repo, "README.md"), "ignored by changed source filter\n");
      git(repo, ["add", "."]);
      git(repo, ["commit", "-m", "story"]);
      git(repo, ["checkout", "main"]);

      assert.deepEqual(getChangedFiles(repo, "main", "story"), ["src/feature.ts"]);
      assert.match(getDiffSummary(repo, "main", "story"), /src\/feature\.ts/);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });
});
