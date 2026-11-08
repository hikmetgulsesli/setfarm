import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import ts from "typescript";
import { OperationalFailureCauseAuthorityV4MigrationError, OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V4_CONSTRAINT_EXPRESSION } from "../../src/db/operational-failure-cause-authority-v4-migration.js";

// Exercise the actual declarations, SQL-emitting loop and result checks. The
// catalog/authentication prefix is outside this component, not replaced by fake
// authority. Literal SQL rows are an external port, not a PostgreSQL proof.
const location = new URL("../../src/db/operational-failure-cause-authority-v4-migration.ts", import.meta.url);
const tree = ts.createSourceFile(location.pathname, readFileSync(location, "utf8"), ts.ScriptTarget.ESNext, true);
const verifier = tree.statements.find(node => ts.isFunctionDeclaration(node)
  && node.name?.text === "verifyOperationalFailureCauseAuthorityV4Constraint");
assert.ok(verifier && ts.isFunctionDeclaration(verifier) && verifier.body);
const statements = verifier.body.statements;
const declarations = ["exact", "cases"].map(name => {
  const statement = statements.find(node => ts.isVariableStatement(node)
    && node.declarationList.declarations.some(declaration => ts.isIdentifier(declaration.name) && declaration.name.text === name));
  assert.ok(statement, `actual declaration ${name}`);
  return statement.getText(tree);
});
const loop = statements.find(ts.isForOfStatement);
assert.ok(loop, "actual V4 behavior loop");
const refusal = tree.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "refuse");
assert.ok(refusal, "actual refusal helper");
const compiled = ts.transpileModule(`${refusal.getText(tree)}\nasync function behavior(sql) {\n${declarations.join("\n")}\n${loop.getText(tree)}\n}`, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

it("V4 behavior probe transports all seven JSON-string cases as text before jsonb parsing", async () => {
  const exact = { schema: "setfarm.operational-failure-cause.v1", workflowStepId: "design",
    boundary: "product_compiler.design_source.artifact_download", failureClass: "infrastructure_failure",
    failureCode: "STITCH_MCP_ARTIFACT_RETRIEVAL_FAILED" };
  const rows = [
    { requester: "setfarm.step-fail.single", cause: exact, accepted: true },
    { requester: "setfarm.step-ops.stories-completeness", cause: exact, accepted: false },
    { requester: "setfarm.step-fail.single", cause: { ...exact, workflowStepId: "setup-build" }, accepted: false },
    { requester: "setfarm.step-fail.single", cause: { ...exact, boundary: "product_compiler.design_source.resource_prefetch" }, accepted: false },
    { requester: "setfarm.step-fail.single", cause: { ...exact, failureClass: "contract_invalid" }, accepted: false },
    { requester: "setfarm.step-fail.single", cause: { ...exact, failureCode: "STITCH_MCP_ARTIFACT_RETRIEVAL_FAILED_OTHER" }, accepted: false },
    { requester: "setfarm.step-fail.single", cause: { ...exact, diagnostic: "not canonical cause identity" }, accepted: false },
  ];
  let calls = 0;
  const sql = { unsafe: async (statement: string, parameters: readonly unknown[]) => {
    const row = rows[calls++];
    assert.ok(row, "exactly seven external SQL calls");
    assert.equal(parameters.length, 2);
    assert.equal(parameters[0], row.requester);
    assert.equal(typeof parameters[1], "string", "the existing caller sends JSON.stringify text");
    assert.deepEqual(JSON.parse(parameters[1] as string), row.cause);
    // This asserts the emitted driver boundary, not production source text.
    // With postgres.js, direct jsonb typing JSON-encodes this string again.
    assert.ok(/\$2\s*::\s*text\s*::\s*jsonb/.test(statement),
      "JSON.stringify text must reach PostgreSQL as text before jsonb parsing");
    return [{ accepted: row.accepted }];
  } };
  const behavior = new Function("OperationalFailureCauseAuthorityV4MigrationError", "OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V4_CONSTRAINT_EXPRESSION",
    `${compiled}\nreturn behavior;`)(OperationalFailureCauseAuthorityV4MigrationError, OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V4_CONSTRAINT_EXPRESSION) as
    (port: typeof sql) => Promise<void>;
  await behavior(sql);
  assert.equal(calls, 7);
});
