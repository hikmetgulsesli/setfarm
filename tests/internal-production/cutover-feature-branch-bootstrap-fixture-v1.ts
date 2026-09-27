import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Copy the authenticated bootstrap closure so a clean main fixture can pass
// sourceState and expose whether the non-main branch check actually ran.
const closure = [
  "scripts/build-generation-maintenance-journal.mjs",
  "scripts/build-generation-maintenance-owner-observer.mjs",
  "scripts/build-generation-retention.mjs",
  "scripts/deployment-cutover-owner.mjs",
  "scripts/deployment-cutover.mjs",
  "scripts/deployment-cutover-dependencies.mjs",
  "scripts/deployment-cutover-retained-profile.mjs",
  "scripts/deployment-cutover-retained-profile.v1.json",
  "scripts/deployment-cutover-default-context.mjs",
  "scripts/deployment-cutover-passive-home.mjs",
  "scripts/deployment-cutover-passive-home.py",
  "package-lock.json",
] as const;
const env = { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" };
const origin = "https://github.com/hikmetgulsesli/setfarm.git";

function git(root: string, args: string[]): string {
  const child = spawnSync("/usr/bin/git", args, { cwd: root, env, encoding: "utf8", timeout: 15000 });
  assert.equal(child.error, undefined);
  assert.equal(child.signal, null);
  assert.equal(child.status, 0, child.stderr);
  return child.stdout;
}

function refusal(root: string, verb: string, expectedStage: string): void {
  const child = spawnSync(process.execPath, [path.join(root, "scripts", "deployment-cutover.mjs"), verb, "--json"],
    { encoding: "utf8", timeout: 15000, env });
  assert.equal(child.status, 1);
  assert.equal(child.stdout, "");
  const lines = child.stderr.trimEnd().split("\n");
  assert.equal(lines[0], "DEPLOYMENT_CUTOVER_BOOTSTRAP_REFUSED");
  assert.equal(JSON.parse(lines[1]!).stage, expectedStage);
  assert.equal(lines.length, 2);
}

export function assertFeatureBranchCutoverRefusalV1(script: URL, verb: string): void {
  const sourceRoot = path.dirname(path.dirname(fileURLToPath(script)));
  const fixture = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "setfarm-cutover-feature-"));
  try {
    for (const locator of closure) {
      const target = path.join(fixture, locator);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(path.join(sourceRoot, locator), target);
    }
    git(fixture, ["init", "-b", "task6a-feature"]);
    git(fixture, ["remote", "add", "origin", origin]);
    git(fixture, ["add", "--", ...closure]);
    git(fixture, ["-c", "user.name=Task6A Fixture", "-c", "user.email=task6a-fixture@example.invalid",
      "commit", "-m", "fixture"]);
    git(fixture, ["update-ref", "refs/remotes/origin/main", "HEAD"]);
    assert.equal(git(fixture, ["branch", "--show-current"]), "task6a-feature\n");
    assert.equal(git(fixture, ["config", "--local", "--get", "remote.origin.url"]), `${origin}\n`);
    assert.equal(git(fixture, ["status", "--porcelain=v2", "--untracked-files=all"]), "");
    refusal(fixture, verb, "source-authentication");

    git(fixture, ["branch", "-m", "main"]);
    assert.equal(git(fixture, ["branch", "--show-current"]), "main\n");
    assert.equal(git(fixture, ["rev-parse", "HEAD"]), git(fixture, ["rev-parse", "refs/remotes/origin/main"]));
    refusal(fixture, verb, "source-build");
  } finally { fs.rmSync(fixture, { recursive: true, force: true }); }
}
