import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { assertFeatureBranchCutoverRefusalV1 } from "./cutover-feature-branch-bootstrap-fixture-v1.js";

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

test("private catalog verb refuses a real feature branch before observing host", () => {
  assertFeatureBranchCutoverRefusalV1(script, "inspect-task6a-private-catalog-host-v3");
});
