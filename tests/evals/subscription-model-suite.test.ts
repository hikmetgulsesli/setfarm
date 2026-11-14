import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { evaluateTaskIntentOracleTaskBindingV1 } from "../../src/evals/task-intent-oracle.js";
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

test("Kimi fixed suite preserves seven cases while exercising the playable holdout contract", () => {
  const read = (name: string) => JSON.parse(readFileSync(new URL(`../../evals/suites/${name}.json`, import.meta.url), "utf8"));
  const baseline = ProductConvergenceSuiteV1Schema.parse(read("product-convergence-minimax-m31-flash-v1"));
  const kimi = ProductConvergenceSuiteV1Schema.parse(read("product-convergence-kimi-k31-pro-v1"));
  const game = kimi.cases.find(entry => entry.caseId === "game-playable-compositional-v2");
  assert.ok(game, "reviewed playable game holdout is missing");
  assert.equal(kimi.cases.length, 8);
  const contracts = (cases: typeof kimi.cases) => cases.map(({ executionProfile: _profile, ...entry }) => entry);
  assert.deepEqual(contracts(kimi.cases.filter(entry => entry !== game)),
    contracts(baseline.cases.filter(entry => entry.caseId !== "game-restart-compositional")));
  const { cases: _baselineCases, suiteId: _baselineId, ...baselineConfig } = baseline;
  const { cases: _kimiCases, suiteId: _kimiId, ...kimiConfig } = kimi;
  assert.deepEqual(kimiConfig, baselineConfig);
  for (const entry of kimi.cases) assert.deepEqual(entry.executionProfile, { providerId: "kimi", modelId: "kimi/k3.1-pro" });
  assert.equal(game.oracle.cohort, "holdout");
  assert.equal(game.oracle.variant, "compositional");
  assert.deepEqual(evaluateTaskIntentOracleTaskBindingV1(game.task, game.oracle).mismatchCodes, []);
  // A copied oracle must not silently authorize a changed task.
  assert.equal(ProductConvergenceSuiteV1Schema.safeParse({ ...kimi, cases: kimi.cases.map(entry => entry === game
    ? { ...game, task: game.task.replace("one point", "two points") } : entry) }).success, false);
  const actions = game.oracle.expectations.filter(entry => entry.kind === "action");
  assert.deepEqual(actions.map(entry => entry.control.label?.expected).sort(),
    ["Center", "Collect", "Left", "Restart", "Resume", "Right", "Settings", "Start"]);
  for (const action of actions) {
    assert.equal(action.triggerKind, "user");
    assert.deepEqual(action.control.kinds, ["button"]);
    assert.ok(action.observableAssertions.some(assertion => assertion.phase === "after"));
  }
  const collect = actions.find(entry => entry.control.label?.expected === "Collect")!;
  assert.deepEqual(collect.persistenceEffects, [{ operation: "write", policyKind: "local_storage", durability: "reload" }]);
  assert.ok(collect.observableAssertions.some(assertion => assertion.phase === "after" && assertion.property === "visible_text" && assertion.expected === "Star collected"));
  assert.ok(collect.observableAssertions.some(assertion => assertion.phase === "reload" && assertion.property === "visible_text" && assertion.expected === "High score: 1"));
  assert.ok(game.oracle.expectations.some(entry => entry.kind === "surface" && entry.surfaceKind === "canvas" && entry.routePath === "/play"));
  assert.ok(game.oracle.expectations.some(entry => entry.kind === "surface" && entry.surfaceKind === "overlay"));
});
