import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import { spawnSync } from "node:child_process";

describe("package test coverage contract", () => {
  for (const [script, expectedMode] of [
    ["test:findings:private", "findings"], ["test:private-postgres", "all"],
  ] as const) {
    it(`dispatches ${script} to its exact private wrapper mode without starting PostgreSQL`, () => {
      // Observe the actual npm edge at wrapper entry, before its imports/effects.
      const guard = `
if (process.argv[1]?.endsWith('/scripts/run-private-postgres-tests.mjs')) {
  console.log('PRIVATE_TEST_PACKAGE_MODE:'+JSON.stringify(process.argv.slice(2)));
  process.exit(0);
}
`;
      const result = spawnSync("npm", ["run", script, "--silent"], {
        encoding: "utf8", timeout: 10000, maxBuffer: 65536,
        env: { PATH: process.env.PATH ?? "", LANG: "C", LC_ALL: "C",
          NODE_OPTIONS: "--import=data:text/javascript;base64," + Buffer.from(guard).toString("base64") },
      });
      assert.equal(result.error, undefined); assert.equal(result.signal, null);
      assert.equal(result.status, 0, result.stdout + result.stderr);
      const observed = result.stdout.split("\n")
        .filter(line => line.startsWith("PRIVATE_TEST_PACKAGE_MODE:"))
        .map(line => JSON.parse(line.slice("PRIVATE_TEST_PACKAGE_MODE:".length)));
      assert.deepEqual(observed, [[expectedMode]]);
    });
  }

  it("keeps eval, evidence, and recovery suites in the main test chain", async () => {
    const pkg = JSON.parse(await readFile("package.json", "utf8")) as { scripts?: Record<string, string> };
    const scripts = pkg.scripts ?? {};
    assert.match(scripts["test:evals"] ?? "", /tests\/evals\/\*\.test\.ts/);
    assert.match(scripts["test:evidence"] ?? "", /node scripts\/run-evidence-tests\.mjs/);
    assert.match(scripts["test:recovery"] ?? "", /tests\/recovery\/\*\.test\.ts/);
    assert.match(scripts["test"] ?? "", /npm run test:evals/);
    assert.match(scripts["test"] ?? "", /npm run test:evidence/);
    assert.match(scripts["test"] ?? "", /npm run test:recovery/);
    assert.match(scripts["eval:convergence"] ?? "", /src\/evals\/convergence-runner\.ts/);
  });

  it("dispatches the held PG31 lifecycle regression from the default test graph", async () => {
    // A standalone command is insufficient: resolve actual npm-run edges from
    // npm test, then execute the selected lifecycle leaf at a bounded port.
    // Do not execute unrelated all-tests/isolated-PG helpers to prove discovery.
    const pkg = JSON.parse(await readFile("package.json", "utf8")) as { scripts: Record<string, string> };
    const pending = ["test"], visited = new Set<string>(), selected = new Set<string>();
    while (pending.length) {
      const name = pending.pop()!;
      if (visited.has(name)) continue;
      visited.add(name);
      const command = pkg.scripts[name];
      assert.equal(typeof command, "string", `missing default-chain script ${name}`);
      for (const match of command.matchAll(/\bnpm run ([a-zA-Z0-9:_-]+)/g)) pending.push(match[1]!);
      if (/\bnode\b[^&]*--test\b/.test(command)) {
        for (const match of command.matchAll(/tests\/[a-zA-Z0-9_./*-]+\.test\.ts/g)) selected.add(match[0]);
      }
    }
    const target = "tests/internal-production/task6a-held-pg31-diagnostic-v2.test.ts";
    const discovered = [...selected].some(selector => new RegExp(`^${selector
      .replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*")}$`).test(target));
    assert.equal(discovered, true, "default npm test graph never dispatches the retained PG31 lifecycle suite");
    const child = spawnSync(process.execPath, ["--import", "tsx", "--test",
      "--test-name-pattern=^private held diagnostic retains one backend", target], {
      // Inheriting NODE_TEST_CONTEXT can silently suppress this child runner.
      // A clean whitelist also excludes PG credentials and loader injection.
      env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" },
      encoding: "utf8", timeout: 20000, maxBuffer: 65536,
    });
    assert.equal(child.error, undefined); assert.equal(child.signal, null);
    assert.equal(child.status, 0, child.stdout + child.stderr);
    assert.match(child.stdout, /private held diagnostic retains one backend/);
    assert.match(child.stdout, /(?:ℹ|#) pass 1\b/);
  });
});
