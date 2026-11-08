// Removing the producer's V3 exclusion must fail these durable-state tests.
// Execute the genuine caller and SQL; replace only GitHub/loop effect imports.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test, type TestContext } from "node:test";
import ts from "typescript";
import { createIsolatedTestDatabase } from "./execution-attempts/test-database.js";

const sourceFile = new URL("../src/spawner.ts", import.meta.url);
const source = readFileSync(sourceFile, "utf8");
const tree = ts.createSourceFile(sourceFile.pathname, source, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS);
const declarations = tree.statements.filter((node): node is ts.FunctionDeclaration =>
  ts.isFunctionDeclaration(node) && node.name?.text === "autoVerifyMergedPrEachStories");
assert.equal(declarations.length, 1, "one genuine background auto-verifier");

const replacedImports: string[] = [];
const transformed = ts.transform(declarations[0]!, [(context) => {
  const visit: ts.Visitor = (node) => {
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      assert.equal(node.arguments.length, 1);
      const argument = node.arguments[0]!;
      assert.ok(ts.isStringLiteral(argument));
      const port = new Map([
        ["./installer/step-ops.js", "stepOps"],
        ["./installer/step-advance.js", "stepAdvance"],
      ]).get(argument.text);
      assert.ok(port, `explicit inert import port: ${argument.text}`);
      replacedImports.push(argument.text);
      return ts.factory.createIdentifier(port);
    }
    return ts.visitEachChild(node, visit, context);
  };
  return (node) => ts.visitNode(node, visit) as ts.FunctionDeclaration;
}]);
const functionSource = ts.createPrinter().printNode(ts.EmitHint.Unspecified, transformed.transformed[0]!, tree);
transformed.dispose();
assert.deepEqual(replacedImports, ["./installer/step-ops.js", "./installer/step-advance.js"]);
const javascript = ts.transpileModule(functionSource, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;

type FixtureRun = {
  id: string;
  protocol: "v3" | "legacy" | "shadow";
  verifyStatus: "waiting" | "pending";
  returnStory?: boolean;
};

async function fixture(t: TestContext, runs: FixtureRun[]) {
  const database = await createIsolatedTestDatabase({ migrate: false });
  t.after(() => database.cleanup());
  // Minimal fixtures deliberately do not invoke db-pg's full-schema migration.
  // Both production ports execute their unchanged SQL on this helper-owned DB.
  const pgQuery = async <T = any>(sql: string, params: any[] = []): Promise<T[]> =>
    await database.sql.unsafe(sql, params) as unknown as T[];
  const pgRun = async (sql: string, params: any[] = []) => {
    const result = await database.sql.unsafe(sql, params);
    return { changes: result.count };
  };
  await database.sql.unsafe(`
    CREATE TABLE runs (
      id text PRIMARY KEY, status text NOT NULL, context text,
      protocol text NOT NULL DEFAULT 'legacy'
    );
    CREATE TABLE steps (
      id text PRIMARY KEY, run_id text NOT NULL, step_id text NOT NULL,
      type text NOT NULL, status text NOT NULL, loop_config text,
      updated_at timestamptz NOT NULL
    );
    CREATE TABLE stories (
      id text PRIMARY KEY, run_id text NOT NULL, status text NOT NULL, pr_url text
    );
  `);
  for (const run of runs) {
    await pgRun(
      "INSERT INTO runs (id, status, context, protocol) VALUES ($1, 'running', $2, $3)",
      [run.id, JSON.stringify({ fixture: run.id }), run.protocol],
    );
    await pgRun(`
      INSERT INTO steps (id, run_id, step_id, type, status, loop_config, updated_at) VALUES
        ($1, $4, 'implement', 'loop', 'running', '{"verifyEach":true,"superviseEach":true}', '2020-01-01T00:00:00Z'),
        ($2, $4, 'supervise', 'single', 'running', NULL, '2020-01-01T00:00:00Z'),
        ($3, $4, 'verify', 'single', $5, NULL, '2020-01-01T00:00:00Z')`,
    [`${run.id}-implement`, `${run.id}-supervise`, `${run.id}-verify`, run.id, run.verifyStatus]);
    // The OPEN PR remains unverified; no GitHub request is made by the inert port.
    await pgRun(
      "INSERT INTO stories (id, run_id, status, pr_url) VALUES ($1, $2, 'done', 'https://example.invalid/pull/1')",
      [`${run.id}-story`, run.id],
    );
  }
  const calls = { autoVerify: [] as string[], advance: [] as string[], errors: [] as string[] };
  const runById = new Map(runs.map((run) => [run.id, run]));
  const invoke = new Function("pgQuery", "pgRun", "stepOps", "stepAdvance", "console", `${javascript}\nreturn autoVerifyMergedPrEachStories;`)(
    pgQuery,
    pgRun,
    {
      async autoVerifyDoneStories(runId: string, context: Record<string, string>, logPrefix: string) {
        assert.deepEqual(context, { fixture: runId });
        assert.equal(logPrefix, "spawner-auto-verify");
        assert.ok(runById.has(runId));
        calls.autoVerify.push(runId);
        if (runById.get(runId)!.returnStory === false) return null;
        return (await pgQuery("SELECT * FROM stories WHERE run_id = $1 AND status = 'done'", [runId]))[0];
      },
    },
    {
      async checkLoopContinuation(runId: string, loopStepId: string) {
        assert.equal(loopStepId, `${runId}-implement`);
        calls.advance.push(runId);
      },
    },
    { error: (message: string) => calls.errors.push(message) },
  ) as () => Promise<void>;
  const steps = () => pgQuery<{ id: string; status: string; updated_at: Date }>(
    "SELECT id, status, updated_at FROM steps ORDER BY id",
  );
  return { database, calls, invoke, steps };
}

test("V3 waiting verification stays untouched before supervisor acceptance", async (t) => {
  const f = await fixture(t, [{ id: "v3", protocol: "v3", verifyStatus: "waiting" }]);
  const before = await f.steps();
  await f.invoke();
  assert.deepEqual(await f.steps(), before, "V3 verification must remain waiting without any row mutation");
  assert.deepEqual(f.calls, { autoVerify: [], advance: [], errors: [] });
});

test("legacy waiting verification is queued for its unverified OPEN PR story", async (t) => {
  const f = await fixture(t, [{ id: "legacy", protocol: "legacy", verifyStatus: "waiting" }]);
  await f.invoke();
  const rows = await f.steps();
  assert.equal(rows.find((row) => row.id === "legacy-verify")!.status, "pending");
  assert.equal(rows.find((row) => row.id === "legacy-supervise")!.status, "running");
  assert.deepEqual(f.calls, { autoVerify: ["legacy"], advance: [], errors: [] });
});

test("legacy already-pending verification remains eligible after stale review delay", async (t) => {
  const f = await fixture(t, [{ id: "legacy-pending", protocol: "legacy", verifyStatus: "pending" }]);
  const before = (await f.steps()).find((row) => row.id === "legacy-pending-verify")!;
  await f.invoke();
  const after = (await f.steps()).find((row) => row.id === "legacy-pending-verify")!;
  assert.equal(after.status, "pending");
  assert.ok(after.updated_at > before.updated_at, "the pending legacy row is still processed");
  assert.deepEqual(f.calls, { autoVerify: ["legacy-pending"], advance: [], errors: [] });
});

test("mixed protocols queue only non-V3 verification and never advance the V3 loop", async (t) => {
  const f = await fixture(t, [
    { id: "mixed-v3", protocol: "v3", verifyStatus: "waiting", returnStory: false },
    { id: "mixed-legacy", protocol: "legacy", verifyStatus: "waiting" },
    { id: "mixed-shadow", protocol: "shadow", verifyStatus: "waiting" },
  ]);
  const before = (await f.steps()).filter((row) => row.id.startsWith("mixed-v3-"));
  await f.invoke();
  const after = await f.steps();
  assert.deepEqual(after.filter((row) => row.id.startsWith("mixed-v3-")), before);
  assert.equal(after.find((row) => row.id === "mixed-legacy-verify")!.status, "pending");
  assert.equal(after.find((row) => row.id === "mixed-shadow-verify")!.status, "pending");
  assert.deepEqual([...f.calls.autoVerify].sort(), ["mixed-legacy", "mixed-shadow"]);
  assert.deepEqual(f.calls.advance, []);
  assert.deepEqual(f.calls.errors, []);
});
