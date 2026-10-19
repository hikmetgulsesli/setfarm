/** Exact CLI/resolver Source components, without entry/DB qualification. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import ts from "typescript";

const SELECTED_SUITE = "/component/selected-release/evals/suites/product-convergence-codex-v1.json";
const LEGACY_SUITE = "/component/release/evals/suites/product-convergence-v1.json";
const SOURCE_SHA = "a".repeat(40);

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
    { env: environment }, selected ? { paths: { repository: "/component/selected-release", evals: "/component/installation/runtime/evals/results" } } : null,
    () => { if (refused) throw Error("selection refused"); },
  ) as (argv: readonly string[]) => { outputRoot: string; suiteFile: string; execute: boolean; json: boolean; releaseSha?: string };
}

test("actual CLI defaults selected evaluation to its captured codex suite and private result root", () => {
  const result = parser(true)([]);
  assert.equal(result.outputRoot, "/component/installation/runtime/evals/results");
  assert.equal(result.suiteFile, SELECTED_SUITE);
});
test("actual CLI keeps the ordinary default and resolves an intended configured result root", () => {
  assert.equal(parser(false)([]).outputRoot, "/component/release/.setfarm/evals/results");
  assert.equal(parser(false)([]).suiteFile, LEGACY_SUITE);
  assert.equal(parser(false, { SETFARM_CONVERGENCE_RESULT_DIR: "/component/custom" })([]).outputRoot, "/component/custom");
});
test("ordinary CLI preserves explicit suite behavior and selected CLI retains downstream output guards", () => {
  const result = parser(false)(["--output-root", "/component/foreign", "--suite", "custom.json", "--execute", "--json", "--release-sha", "a".repeat(40)]);
  assert.deepEqual(result, { outputRoot: "/component/foreign", suiteFile: "custom.json", execute: true, json: true, releaseSha: "a".repeat(40) });
  assert.equal(parser(true)(["--suite", SELECTED_SUITE, "--output-root", "/component/foreign"]).outputRoot, "/component/foreign");
  assert.throws(() => parser(false)(["--unknown"]), /EVAL_ARGUMENT_INVALID/);
});

test("selected CLI refuses explicit foreign legacy relative and noncanonical suites", () => {
  for (const suite of ["/component/foreign.json", LEGACY_SUITE,
    "evals/suites/product-convergence-codex-v1.json", "/component/selected-release/evals/suites/../suites/product-convergence-codex-v1.json"]) {
    assert.throws(() => parser(true)(["--suite", suite]), { message: "MANUAL_EVALUATION_RECIPE_REFUSED" });
  }
});

function routedMain(selected: boolean, argv: readonly string[]) {
  const declaration = compile(sourceFunction("src/evals/convergence-runner.ts", "main"));
  const fixedImport = 'await import("../execution/manual-test-worker-v1.js")';
  assert.equal(declaration.split(fixedImport).length, 2);
  const body = declaration.replace(fixedImport, "({runSelectedDirectConvergenceV1})");
  const events: string[] = [];
  const rawArgv = Object.freeze(["/component/node", "/component/release/dist/evals/convergence-runner.js", ...argv]);
  const loaded = Object.freeze({ componentLoadedSuite: true });
  const completed = { result: { schema: "setfarm.product-convergence-result.v1", status: "planned" },
    artifact: { locator: "component-artifact" }, gate: { decision: "no_go", gateHash: "component-hash" },
    gateArtifact: { locator: "component-gate" } };
  const dispatch = (route: string) => async (suite: unknown, options: { releaseSha: string; execute: boolean }) => {
    assert.equal(suite, loaded);
    assert.deepEqual(options, { releaseSha: SOURCE_SHA, execute: argv.includes("--execute") });
    events.push(route); return completed;
  };
  const main = new Function("parseCli", "createDefaultConvergencePorts", "GitObjectHashSchema", "loadConvergenceSuiteVersioned",
    "runConvergenceSuite", "freshInstallationSelectionV1", "runSelectedDirectConvergenceV1", "process",
    "convergenceResultTable", "stableConvergenceResultJson", "convergenceResultTableV2", "stableConvergenceResultJsonV2", body + ";return main;")(
    parser(selected), async () => { events.push("ports"); return {
      process: { inspectRelease: async () => { events.push("inspect"); return { headSha: SOURCE_SHA }; } },
      sql: { close: async () => { events.push("close"); } },
    }; }, { parse: (value: string) => value }, async (file: string) => { events.push(`load:${file}`); return loaded; },
    dispatch("ordinary"), selected ? Object.freeze({}) : null, dispatch("reserved"),
    { argv: rawArgv, stdout: { write: () => {} } }, () => "", () => "", () => "", () => "",
  ) as () => Promise<void>;
  return { main, events, rawArgv };
}

test("maintained no-suite invocation routes actual parsed main to selected reservation with fixed suite", async () => {
  const manifest = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
  const command = manifest.scripts["eval:convergence"].split(" ");
  assert.deepEqual(command.slice(0, 2), ["node", "dist/evals/convergence-runner.js"]);
  assert.deepEqual(command.slice(2), []);
  for (const argv of [command.slice(2), ["--json"], ["--execute", "--release-sha", SOURCE_SHA], ["--suite", SELECTED_SUITE]]) {
    const component = routedMain(true, argv);
    const before = [...component.rawArgv];
    await component.main();
    assert.deepEqual(component.events, ["ports", "inspect", `load:${SELECTED_SUITE}`, "reserved", "close"]);
    assert.deepEqual(component.rawArgv, before);
  }
});

test("actual parsed main keeps ordinary default and refuses selected foreign suites before ports or loading", async () => {
  const ordinary = routedMain(false, []);
  await ordinary.main();
  assert.deepEqual(ordinary.events, ["ports", "inspect", `load:${LEGACY_SUITE}`, "ordinary", "close"]);
  for (const suite of ["/component/foreign.json", LEGACY_SUITE, "evals/suites/product-convergence-codex-v1.json"]) {
    const component = routedMain(true, ["--suite", suite]);
    await assert.rejects(component.main, { message: "MANUAL_EVALUATION_RECIPE_REFUSED" });
    assert.deepEqual(component.events, []);
  }
});
test("actual CLI propagates captured selection refusal even with an explicit output argument", () => {
  assert.throws(() => parser(true, {}, true)(["--output-root", "/component/foreign"]), /selection refused/);
});
