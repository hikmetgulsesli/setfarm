import assert from "node:assert/strict";
import { test } from "node:test";
import { censusTypeScriptSourceLocators } from "./fixtures/deployment-cutover-bootstrap.mjs";

const scripts = ["scripts/build-generation-retention.mjs", "scripts/deployment-dashboard-cutover-adapter-v2.mjs"];
test("census compiler inputs enroll exactly the copied scripts without dist transforms", () => {
  assert.deepEqual(censusTypeScriptSourceLocators([
    "src/internal-production/baseline-legacy-database-census-v1.ts", ...scripts,
    "src/product-compiler/canonical-json.ts",
  ]), ["internal-production/baseline-legacy-database-census-v1", "product-compiler/canonical-json"]);
});
for (const input of ["scripts/foreign.mjs", "scripts/build-generation-retention.mjs?query",
  "scripts/deployment-dashboard-cutover-adapter-v2.mjs#fragment", "src/../foreign.ts",
  "src/a/../b.ts", "src/./b.ts", "src//b.ts", "/src/b.ts", "file:///src/b.ts",
  "src/b.ts?query", "src/b.ts#fragment", "src/b.js", "node_modules/foreign/index.js",
  "src/b.ts\u0000", 31, null]) {
  test(`census compiler inputs refuse foreign or noncanonical member ${JSON.stringify(input)}`, () => {
    assert.throws(() => censusTypeScriptSourceLocators([...scripts, input]));
  });
}
for (const absent of scripts) test(`census compiler inputs refuse missing ${absent}`, () => {
  assert.throws(() => censusTypeScriptSourceLocators(scripts.filter(input => input !== absent)), /closure must be exact/);
});
test("census compiler inputs refuse duplicated members", () => {
  for (const input of [...scripts, "src/owner.ts"])
    assert.throws(() => censusTypeScriptSourceLocators([...scripts, "src/owner.ts", input]), /must be unique/);
});
