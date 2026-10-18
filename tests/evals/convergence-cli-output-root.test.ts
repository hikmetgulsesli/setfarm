/** Exact CLI/resolver Source components, without entry/DB qualification. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import ts from "typescript";

function sourceFunction(file: string, name: string): string {
  const text = readFileSync(new URL("../../" + file, import.meta.url), "utf8");
  const tree = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const nodes = tree.statements.filter((node): node is ts.FunctionDeclaration =>
    ts.isFunctionDeclaration(node) && node.name?.text === name);
  assert.equal(nodes.length, 1);
  return nodes[0]!.getText(tree);
}
const compile = (text: string) => ts.transpileModule(text, { compilerOptions: {
  module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022,
} }).outputText.replace(/^export /gm, "");

function parser(selected: boolean, environment: Record<string, string> = {}, refused = false) {
  const code = compile(sourceFunction("src/runtime-config.ts", "resolveConvergenceEvalResultDir")
    + "\n" + sourceFunction("src/evals/convergence-runner.ts", "parseCli"));
  return new Function("path", "join", "packageRoot", "resolvePackageRoot", "expandRuntimePath", "process",
    "freshInstallationSelectionV1", "assertFreshInstallationSelectionUnchangedV1", code + ";return parseCli;")(
    path, path.join, () => "/component/release", () => "/component/release", (value: string) => value,
    { env: environment }, selected ? { paths: { evals: "/component/installation/runtime/evals/results" } } : null,
    () => { if (refused) throw Error("selection refused"); },
  ) as (argv: readonly string[]) => { outputRoot: string; suiteFile: string; execute: boolean; json: boolean; releaseSha?: string };
}

test("actual CLI defaults selected evaluation to its private captured result root", () => {
  const result = parser(true)([]);
  assert.equal(result.outputRoot, "/component/installation/runtime/evals/results");
  assert.equal(result.suiteFile, "/component/release/evals/suites/product-convergence-v1.json");
});
test("actual CLI keeps the ordinary default and resolves an intended configured result root", () => {
  assert.equal(parser(false)([]).outputRoot, "/component/release/.setfarm/evals/results");
  assert.equal(parser(false, { SETFARM_CONVERGENCE_RESULT_DIR: "/component/custom" })([]).outputRoot, "/component/custom");
});
test("actual CLI preserves explicit arguments for the downstream exact-path guard", () => {
  const result = parser(true)(["--output-root", "/component/foreign", "--suite", "custom.json", "--execute", "--json", "--release-sha", "a".repeat(40)]);
  assert.deepEqual(result, { outputRoot: "/component/foreign", suiteFile: "custom.json", execute: true, json: true, releaseSha: "a".repeat(40) });
  assert.throws(() => parser(false)(["--unknown"]), /EVAL_ARGUMENT_INVALID/);
});
test("actual CLI propagates captured selection refusal even with an explicit output argument", () => {
  assert.throws(() => parser(true, {}, true)(["--output-root", "/component/foreign"]), /selection refused/);
});
