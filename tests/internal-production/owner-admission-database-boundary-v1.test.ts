import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import ts from "typescript";
import { transformSync } from "esbuild";

const ownerSource = new URL("./owner-admission-v1.test.ts", import.meta.url);
const tree = ts.createSourceFile("owner-admission-v1.test.ts", readFileSync(ownerSource, "utf8"), ts.ScriptTarget.Latest, true);
const titles = [
  "historical source rejects a self-consistent non-contract PBA before target scans",
  "PostgreSQL source rows reject every noncanonical TEXT spelling before historical ports",
  "PostgreSQL target resolution rejects noncanonical activation bytes before source or head adoption",
  "real PostgreSQL initial activation rolls back a write prefix then identical publishers converge and adopt response loss",
];
for (const title of titles) for (const url of [undefined, "postgresql://unused@127.0.0.1:1/setfarm"]) {
  test(`${title}: refuses ${url === undefined ? "absent" : "production-shaped"} URL before DB effects`, () => {
    const registration = tree.statements.find(statement => ts.isExpressionStatement(statement)
      && ts.isCallExpression(statement.expression) && ts.isIdentifier(statement.expression.expression)
      && statement.expression.expression.text === "test"
      && ts.isStringLiteral(statement.expression.arguments[0]!) && statement.expression.arguments[0]!.text === title);
    assert.ok(registration && ts.isExpressionStatement(registration) && ts.isCallExpression(registration.expression));
    const callback = registration.expression.arguments[1]!;
    assert.ok(ts.isArrowFunction(callback));
    const dbTrap = "data:text/javascript," + encodeURIComponent("globalThis.databaseAttempts++; throw Error('DATABASE_BOUNDARY_REACHED');");
    const helper = new URL("../execution-attempts/test-database.ts", import.meta.url).href;
    const projected = callback.getText(tree)
      .replaceAll('"../../src/db-pg.js"', JSON.stringify(dbTrap))
      .replaceAll('"../execution-attempts/test-database.js"', JSON.stringify(helper));
    const body = transformSync(`const callback = ${projected};`, { loader: "ts", format: "esm" }).code;
    const result = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `
      globalThis.databaseAttempts = 0; let fixtureAttempts = 0;
      const createPreparedActivationRepositoryFixture = () => { fixtureAttempts++; throw Error("FIXTURE_BOUNDARY_REACHED"); };
      ${body}
      let error = null;
      try { await callback(); } catch (caught) { error = {message:caught.message,code:caught.code}; }
      process.stdout.write(JSON.stringify({error,databaseAttempts:globalThis.databaseAttempts,fixtureAttempts}));
    `], { encoding: "utf8", timeout: 10000, env: url === undefined ? {} : { SETFARM_PG_URL: url } });
    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.ok(output.error, "missing P3 authority must refuse, not silently skip");
    assert.match(output.error.message, /P3_PROJECTION_CAPABILITY|\.setfarm-p3-projection-marker\.json/);
    assert.equal(output.databaseAttempts, 0);
    assert.equal(output.fixtureAttempts, 0);
  });
}
