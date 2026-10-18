/** Source-function DATA components. No Codex invocation, SQL or readiness grant. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";
import { z } from "zod";

const root = new URL("../../", import.meta.url);
const read = (file: string): string => readFileSync(new URL(file, root), "utf8");
function source(file: string) {
  const text = read(file), tree = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  return { text, tree };
}
function declaration(file: string, name: string): string {
  const { tree } = source(file);
  const matches = tree.statements.filter((node): node is ts.FunctionDeclaration =>
    ts.isFunctionDeclaration(node) && node.name?.text === name);
  assert.equal(matches.length, 1, "actual Source function missing/ambiguous " + name);
  return matches[0]!.getText(tree);
}
function variable(file: string, name: string): ts.VariableDeclaration {
  const { tree } = source(file), matches: ts.VariableDeclaration[] = [];
  function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name) matches.push(node);
    ts.forEachChild(node, visit);
  }
  visit(tree); assert.equal(matches.length, 1, "actual Source variable missing/ambiguous " + name);
  return matches[0]!;
}
function compile(text: string): string {
  return ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } })
    .outputText.replace(/^export /gm, "");
}

function profileModule(options: { selected?: boolean; runtime?: string; model?: string } = {}) {
  const env: Record<string, string | undefined> = { SETFARM_AGENT_RUNTIME: options.runtime, SETFARM_CODEX_MODEL: options.model };
  let selectionCalls = 0, recordCalls = 0, badSelection = false;
  const selected = options.selected === false ? null : { assertUnchanged() { recordCalls++; } };
  const { tree } = source("src/installation/fresh-installation-v3-profile-v1.ts");
  const body = tree.statements.filter(node => !ts.isImportDeclaration(node)).map(node => node.getText(tree)).join("\n");
  const api = new Function("process", "assertFreshInstallationSelectionUnchangedV1", "freshInstallationSelectionV1", compile(body)
    + ";return {assertSelectedFreshCodexProfileUnchangedV1,readSelectedFreshCodexExecutionProfileV1,selectedFreshCodexModelArgumentsV1};")(
      { env }, () => { selectionCalls++; if (badSelection) throw Error("selection refused"); }, selected,
    ) as { assertSelectedFreshCodexProfileUnchangedV1(): void; readSelectedFreshCodexExecutionProfileV1(): any; selectedFreshCodexModelArgumentsV1(value: any): string[] };
  return { api, env, counts: () => ({ selectionCalls, recordCalls }), refuseSelection() { badSelection = true; } };
}

function resolver(readProfile: () => unknown) {
  const file = "src/execution/operational-retry-directive.ts";
  const definitions = ["ProviderIdSchema", "ModelIdSchema", "ModelExecutionProfileV1Schema", "PRIMARY_EXECUTION_PROFILE", "FALLBACK_EXECUTION_PROFILE"]
    .map(name => "const " + variable(file, name).getText() + ";").join("\n");
  return new Function("z", "readSelectedFreshCodexExecutionProfileV1", compile(definitions + "\n" + declaration(file, "resolveV3ExecutionProfile"))
    + ";return resolveV3ExecutionProfile;")(z, readProfile) as (kind: "primary" | "fallback") => any;
}

test("actual V3 primary resolver binds selected qualified Codex identity instead of legacy Minimax", () => {
  const selected = { schema: "setfarm.model-execution-profile.v1", providerId: "codex", modelId: "codex/gpt-6.1-sol", selection: "primary" };
  assert.deepEqual(resolver(() => selected)("primary"), selected);
});
test("actual V3 fallback resolver refuses selected unsupported fallback and preserves both legacy profiles", () => {
  const selected = { schema: "setfarm.model-execution-profile.v1", providerId: "codex", modelId: "codex/gpt-6.1-sol", selection: "primary" };
  assert.throws(() => resolver(() => selected)("fallback"), /FRESH_V3_FALLBACK_PROFILE_UNAVAILABLE/);
  const legacy = resolver(() => null);
  assert.deepEqual(legacy("primary"), { schema: "setfarm.model-execution-profile.v1", providerId: "minimax", modelId: "minimax/MiniMax-M3", selection: "primary" });
  assert.deepEqual(legacy("fallback"), { schema: "setfarm.model-execution-profile.v1", providerId: "kimi", modelId: "kimi/kimi-for-coding", selection: "fallback" });
});

test("profile module import is inert, while actual selected V3 consumption requires explicit bounded Codex model", () => {
  const absent = profileModule({ runtime: "codex" });
  assert.deepEqual(absent.counts(), { selectionCalls: 0, recordCalls: 0 });
  absent.api.assertSelectedFreshCodexProfileUnchangedV1(); // Ordinary selected startup may use the CLI's default outside V3.
  assert.throws(() => absent.api.readSelectedFreshCodexExecutionProfileV1(), /FRESH_V3_CODEX_PROFILE_REFUSED/);
  for (const model of ["", " bad", "a b", "-option", "x\ny", "x".repeat(195)]) {
    assert.throws(() => profileModule({ runtime: "codex", model }).api.readSelectedFreshCodexExecutionProfileV1(), /FRESH_V3_CODEX_PROFILE_REFUSED/);
  }
  assert.throws(() => profileModule({ runtime: "openclaw", model: "gpt-6.1-sol" }).api.readSelectedFreshCodexExecutionProfileV1(), /FRESH_V3_CODEX_PROFILE_REFUSED/);
  assert.equal(profileModule({ selected: false }).api.readSelectedFreshCodexExecutionProfileV1(), null);
});

test("exact immutable selected model profile maps to exact raw Codex --model argv", () => {
  const h = profileModule({ runtime: "codex", model: "gpt-6.1-sol" });
  const profile = h.api.readSelectedFreshCodexExecutionProfileV1();
  assert.deepEqual(profile, { schema: "setfarm.model-execution-profile.v1", providerId: "codex", modelId: "codex/gpt-6.1-sol", selection: "primary" });
  assert.deepEqual(resolver(() => profile)("primary"), profile);
  assert.deepEqual(h.api.selectedFreshCodexModelArgumentsV1(profile), ["--model", "gpt-6.1-sol"]);
  for (const patch of [{ providerId: "minimax" }, { modelId: "codex/other-model" }, { selection: "fallback" }]) {
    const other = profileModule({ runtime: "codex", model: "gpt-6.1-sol" });
    assert.throws(() => other.api.selectedFreshCodexModelArgumentsV1({ ...profile, ...patch }), /FRESH_V3_CODEX_PROFILE_REFUSED/);
  }
});

test("runtime/model retarget is sticky even after restoration and blocks actual argv", () => {
  for (const key of ["SETFARM_AGENT_RUNTIME", "SETFARM_CODEX_MODEL"]) {
    const h = profileModule({ runtime: "codex", model: "gpt-6.1-sol" });
    const profile = h.api.readSelectedFreshCodexExecutionProfileV1(), old = h.env[key];
    h.env[key] = "foreign";
    assert.throws(() => h.api.assertSelectedFreshCodexProfileUnchangedV1(), /FRESH_V3_CODEX_PROFILE_REFUSED/);
    h.env[key] = old;
    assert.throws(() => h.api.readSelectedFreshCodexExecutionProfileV1(), /FRESH_V3_CODEX_PROFILE_REFUSED/);
    assert.throws(() => h.api.selectedFreshCodexModelArgumentsV1(profile), /FRESH_V3_CODEX_PROFILE_REFUSED/);
  }
});

test("actual spawner model declaration validates handoff, uses raw selected model, and keeps legacy argv", () => {
  const declaration = "const " + variable("src/spawner.ts", "codexModelArgs").getText() + ";return codexModelArgs;";
  const invoke = new Function("SELECTED_SPAWNER_V1", "claim", "process", "selectedFreshCodexModelArgumentsV1", compile(declaration)) as (...args: any[]) => string[];
  const selected = profileModule({ runtime: "codex", model: "gpt-6.1-sol" });
  const profile = selected.api.readSelectedFreshCodexExecutionProfileV1();
  assert.deepEqual(invoke({}, { v3ImplementationHandoff: { executionProfile: profile } }, { env: selected.env }, selected.api.selectedFreshCodexModelArgumentsV1), ["--model", "gpt-6.1-sol"]);
  const mismatch = profileModule({ runtime: "codex", model: "gpt-6.1-sol" });
  assert.throws(() => invoke({}, { v3ImplementationHandoff: { executionProfile: { ...profile, modelId: "minimax/MiniMax-M3" } } }, { env: mismatch.env }, mismatch.api.selectedFreshCodexModelArgumentsV1), /FRESH_V3_CODEX_PROFILE_REFUSED/);
  assert.deepEqual(invoke(null, {}, { env: { SETFARM_CODEX_MODEL: "legacy-model" } }, () => { throw Error("not selected"); }), ["--model", "legacy-model"]);
  assert.deepEqual(invoke(null, {}, { env: {} }, () => { throw Error("not selected"); }), []);
});

test("actual handoff default does not consume a selected V3 profile during schema construction", () => {
  const { tree } = source("src/execution/v3-implementation-handoff.ts"), matches: ts.PropertyAssignment[] = [];
  function visit(node: ts.Node) {
    if (ts.isPropertyAssignment(node) && node.name.getText(tree) === "executionProfile"
      && node.initializer.getText(tree).startsWith("ModelExecutionProfileV1Schema.default(")) matches.push(node);
    ts.forEachChild(node, visit);
  }
  visit(tree); assert.equal(matches.length, 1);
  let calls = 0, lazy: unknown;
  new Function("ModelExecutionProfileV1Schema", "resolveV3ExecutionProfile", compile("const result = " + matches[0]!.initializer.getText(tree) + ";"))(
    { default(value: unknown) { lazy = value; } }, () => { calls++; throw Error("missing selected model consumed eagerly"); },
  );
  assert.equal(calls, 0); assert.equal(typeof lazy, "function");
  assert.throws(() => (lazy as () => unknown)(), /consumed eagerly/); assert.equal(calls, 1);
});

test("actual selected convergence profile never reads shared OpenClaw and retains exact legacy derivation", async () => {
  const body = declaration("src/evals/convergence-runner.ts", "readConvergenceExecutionProfileV1");
  let reads = 0;
  const invoke = new Function("readSelectedFreshCodexExecutionProfileV1", "YAML", "readOpenClawConfig", compile(body) + ";return readConvergenceExecutionProfileV1;");
  const profile = { providerId: "codex", modelId: "codex/gpt-6.1-sol" };
  const yaml = { parse: () => ({ agent_mapping: { developer: ["wf_dev"], tester: ["wf_test"] } }) };
  const shared = async () => { reads++; return { config: { agents: { list: [ { id: "wf_dev", model: "minimax/MiniMax-M3" }, { id: "wf_test", model: { primary: "minimax/MiniMax-M3" } } ] } } }; };
  assert.deepEqual(await invoke(() => profile, yaml, shared)("DATA workflow"), { ...profile, agentCount: 2 }); assert.equal(reads, 0);
  assert.deepEqual(await invoke(() => null, yaml, shared)("DATA workflow"), { providerId: "minimax", modelId: "minimax/MiniMax-M3", agentCount: 2 }); assert.equal(reads, 1);
  const closed = invoke(() => { throw Error("sticky selection refused"); }, yaml, shared);
  await assert.rejects(closed("DATA workflow"), /sticky selection refused/); assert.equal(reads, 1);
});
