import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import { assertFeatureBranchCutoverRefusalV1 } from "./cutover-feature-branch-bootstrap-fixture-v1.js";

const script = new URL("../../scripts/deployment-cutover.mjs", import.meta.url);
const source = fs.readFileSync(script, "utf8");

test("catalog host bootstrap has a distinct authenticated no-write verb and strict result gate", () => {
  assert.match(source, /"inspect-task6a-writer-catalog-host-v2"/);
  assert.match(source, /observeCodeOwnedTask6aWriterCatalogHostV2\(\)/);
  assert.match(source, /task6aWriterCatalogHostV2 = observed/);
  assert.match(source, /\.\.\.\(task6aWriterCatalogHostV2 \? \{ task6aWriterCatalogHostV2 \} : \{\}\)/);
  assert.match(source, /"direct-only-non-transitive"/);
  assert.match(source, /"coarse-selected-catalog-row-counts-not-permission-proof"/);
  assert.match(source, /"not-granted"/);
});

test("catalog verb refuses a real feature branch before observing host", () => {
  assertFeatureBranchCutoverRefusalV1(script, "inspect-task6a-writer-catalog-host-v2");
});
