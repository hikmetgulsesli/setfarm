import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

describe("package test coverage contract", () => {
  it("keeps eval, evidence, and recovery suites in the main test chain", async () => {
    const pkg = JSON.parse(await readFile("package.json", "utf8")) as { scripts?: Record<string, string> };
    const scripts = pkg.scripts ?? {};
    assert.match(scripts["test:evals"] ?? "", /tests\/evals\/\*\.test\.ts/);
    assert.match(scripts["test:evidence"] ?? "", /tests\/evidence\/\*\.test\.ts/);
    assert.match(scripts["test:recovery"] ?? "", /tests\/recovery\/\*\.test\.ts/);
    assert.match(scripts["test"] ?? "", /npm run test:evals/);
    assert.match(scripts["test"] ?? "", /npm run test:evidence/);
    assert.match(scripts["test"] ?? "", /npm run test:recovery/);
    assert.match(scripts["eval:convergence"] ?? "", /src\/evals\/convergence-runner\.ts/);
  });
});
