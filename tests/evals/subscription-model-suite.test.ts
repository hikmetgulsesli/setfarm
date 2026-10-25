import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { ProductConvergenceSuiteV1Schema } from "../../src/evals/suite-schema.js";

test("subscription convergence suite preserves all original case and oracle contracts under a distinct model identity", () => {
  const read = (name: string) => JSON.parse(readFileSync(new URL(`../../evals/suites/${name}.json`, import.meta.url), "utf8"));
  const original = ProductConvergenceSuiteV1Schema.parse(read("product-convergence-v1"));
  const subscription = ProductConvergenceSuiteV1Schema.parse(read("product-convergence-minimax-m31-flash-v1"));
  assert.equal(subscription.suiteId, "product-convergence-minimax-m31-flash-v1");
  assert.equal(subscription.cases.length, 8);
  for (const entry of subscription.cases) {
    assert.deepEqual(entry.executionProfile, { providerId: "minimax", modelId: "minimax/MiniMax-M3.1-Flash" });
  }
  const withoutIdentity = ({ suiteId: _suiteId, cases, ...rest }: typeof original) => ({
    ...rest,
    cases: cases.map(({ executionProfile: _executionProfile, ...entry }) => entry),
  });
  assert.deepEqual(withoutIdentity(subscription), withoutIdentity(original));
});
