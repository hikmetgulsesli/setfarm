import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { assertFeatureBranchCutoverRefusalV1 } from "./cutover-feature-branch-bootstrap-fixture-v1.js";

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

test("physical coverage verb refuses a real feature branch before observing host", () => {
  assertFeatureBranchCutoverRefusalV1(script, "inspect-pre32-physical-inventory-coverage-v1");
});
