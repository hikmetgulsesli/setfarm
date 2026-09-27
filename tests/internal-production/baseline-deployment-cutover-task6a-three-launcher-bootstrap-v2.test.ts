import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import { assertFeatureBranchCutoverRefusalV1 } from "./cutover-feature-branch-bootstrap-fixture-v1.js";

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

test("new host verb refuses a real feature branch before observing host", () => {
  assertFeatureBranchCutoverRefusalV1(script, "inspect-task6a-three-launcher-host-v2");
});
