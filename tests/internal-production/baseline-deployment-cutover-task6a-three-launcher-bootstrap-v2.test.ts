import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import { spawnSync } from "node:child_process";

const script = new URL("../../scripts/deployment-cutover.mjs", import.meta.url);
const source = fs.readFileSync(script, "utf8");

test("Task6A three-launcher bootstrap has a distinct authenticated no-write verb and strict result gate", () => {
  assert.match(source, /"inspect-task6a-three-launcher-host-v2"/);
  assert.match(source, /observeCodeOwnedTask6aThreeLauncherHostV2\(\)/);
  assert.match(source, /plainFrozenTree\(value\)/);
  assert.match(source, /diagnosticHash/);
  assert.match(source, /task6aThreeLauncherHostV2 = observed/);
  assert.match(source, /\.\.\.\(task6aThreeLauncherHostV2 \? \{ task6aThreeLauncherHostV2 \} : \{\}\)/);
  assert.match(source, /"not-granted"/);
  assert.match(source, /"unverified"/);
});

test("new host verb refuses a feature worktree before loading or observing the host", () => {
  const child = spawnSync(process.execPath, [script.pathname, "inspect-task6a-three-launcher-host-v2", "--json"],
    { encoding: "utf8", timeout: 15000, env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" } });
  assert.equal(child.status, 1);
  assert.equal(child.stdout, "");
  const lines = child.stderr.trimEnd().split("\n");
  assert.equal(lines[0], "DEPLOYMENT_CUTOVER_BOOTSTRAP_REFUSED");
  assert.equal(JSON.parse(lines[1]!).stage, "source-authentication");
  assert.equal(lines.length, 2);
});
