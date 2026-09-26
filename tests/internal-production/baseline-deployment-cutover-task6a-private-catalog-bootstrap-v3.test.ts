import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { test } from "node:test";

const script = new URL("../../scripts/deployment-cutover.mjs", import.meta.url);
const source = fs.readFileSync(script, "utf8");

test("private catalog host bootstrap has a distinct authenticated no-write verb and strict public gate", () => {
  assert.match(source, /"inspect-task6a-private-catalog-host-v3"/);
  assert.match(source, /observeCodeOwnedTask6aPrivateCatalogHostV3\(\)/);
  assert.match(source, /task6aPrivateCatalogHostV3 = observed/);
  assert.match(source, /\.\.\.\(task6aPrivateCatalogHostV3 \? \{ task6aPrivateCatalogHostV3 \} : \{\}\)/);
  assert.match(source, /"selected-explicit-acl-and-direct-membership-rows-not-permission-proof"/);
  assert.match(source, /"not-granted"/);
  assert.doesNotMatch(source, /JSON\.stringify\([^)]*(?:objects|memberships|aclText)/);
});

test("private catalog verb refuses a feature worktree before loading or observing host", () => {
  const child = spawnSync(process.execPath, [script.pathname, "inspect-task6a-private-catalog-host-v3", "--json"],
    { encoding: "utf8", timeout: 15000, env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" } });
  assert.equal(child.status, 1);
  assert.equal(child.stdout, "");
  const lines = child.stderr.trimEnd().split("\n");
  assert.equal(lines[0], "DEPLOYMENT_CUTOVER_BOOTSTRAP_REFUSED");
  assert.equal(JSON.parse(lines[1]!).stage, "source-authentication");
  assert.equal(lines.length, 2);
});
