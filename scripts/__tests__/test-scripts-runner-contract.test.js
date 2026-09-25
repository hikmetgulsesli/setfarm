import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("script fixtures run serially before genuine cutover integration", () => {
  const packageJson = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
  assert.equal(
    packageJson.scripts["test:scripts"],
    "node --test --test-concurrency=1 scripts/__tests__/*.test.js && npm run test:scripts:cutover-genuine",
  );
});
