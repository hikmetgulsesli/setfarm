import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { test } from "node:test";

const script = new URL("../../scripts/deployment-cutover.mjs", import.meta.url);
const source = fs.readFileSync(script, "utf8");

test("physical coverage has a distinct authenticated no-write bootstrap verb", () => {
  assert.match(source, /"inspect-pre32-physical-inventory-coverage-v1"/);
  assert.match(source, /observeCodeOwnedPositiveWorktreePre32PhysicalInventoryCoverageV1\(\)/);
  assert.match(source, /pre32PhysicalInventoryCoverageV1 = result/);
  assert.match(source, /\.\.\.\(pre32PhysicalInventoryCoverageV1 \? \{ pre32PhysicalInventoryCoverageV1 \} : \{\}\)/);
  assert.match(source, /retainedGitTopologyRoots/);
  assert.match(source, /unresolvedPresentRoots/);
  assert.match(source, /coverageHash/);
});

test("physical coverage verb refuses a feature worktree before loading or observing host", () => {
  const child = spawnSync(process.execPath, [script.pathname, "inspect-pre32-physical-inventory-coverage-v1", "--json"],
    { encoding: "utf8", timeout: 15000, env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" } });
  assert.equal(child.status, 1);
  assert.equal(child.stdout, "");
  const lines = child.stderr.trimEnd().split("\n");
  assert.equal(lines[0], "DEPLOYMENT_CUTOVER_BOOTSTRAP_REFUSED");
  assert.equal(JSON.parse(lines[1]!).stage, "source-authentication");
  assert.equal(lines.length, 2);
});
