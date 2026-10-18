import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

// Execute exact production DATA/HTTP-port bodies. No runner/module import,
// installation authority, DB, provider, child process or real network is used.
function loadPort(env: Record<string, string | undefined>, fetchPort: typeof fetch) {
  const file = new URL("../../src/evals/convergence-runner.ts", import.meta.url);
  const source = readFileSync(file, "utf8");
  const tree = ts.createSourceFile(file.pathname, source, ts.ScriptTarget.Latest, true);
  const names = ["endpoint", "fetchResponse", "createFetchConvergenceHttpPort"];
  const bodies = names.map((name) => {
    const matches = tree.statements.filter((node): node is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(node) && node.name?.text === name);
    assert.equal(matches.length, 1, `missing/ambiguous production function: ${name}`);
    return matches[0]!.getText(tree);
  });
  const compiled = ts.transpileModule(bodies.join("\n"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText.replace(/^export /gm, "");
  return new Function("process", "runtimeConfig", "fetch", "safeHash", "AbortSignal",
    compiled + ";return createFetchConvergenceHttpPort();")(
    { env }, { missionControlInternalUrl: "http://127.0.0.1:3080" }, fetchPort,
    (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex"), AbortSignal,
  ) as {
    health(service: "setfarm" | "mission_control"): Promise<{ ok: boolean; evidenceHash: string }>;
    operationalSnapshot(service: "setfarm" | "mission_control", runId: string): Promise<unknown>;
    syncProject(runId: string): Promise<{ ok: boolean; evidenceHash: string }>;
  };
}

type Call = { url: string; init: RequestInit };
function fetchRecorder(calls: Call[], status = 200): typeof fetch {
  return (async (url: string | URL | Request, init: RequestInit = {}) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify({ synced: [], skipped: [] }), {
      status, headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
}

test("default evaluator routes the intended MC token only to exact MC snapshot and sync calls", async () => {
  const token = "component-only-mc-token";
  const calls: Call[] = [];
  const port = loadPort({ MC_AUTH_TOKEN: token, AUTH_TOKEN: "not-the-intended-token" }, fetchRecorder(calls));
  const runId = "component /?";
  await port.health("setfarm");
  await port.health("mission_control");
  await port.operationalSnapshot("setfarm", runId);
  await port.operationalSnapshot("mission_control", runId);
  const synced = await port.syncProject(runId);
  assert.equal(synced.ok, true);
  assert.equal(calls.length, 5);
  assert.deepEqual(calls.map(({ url }) => url), [
    "http://127.0.0.1:3333/", "http://127.0.0.1:3080/api/health",
    "http://127.0.0.1:3333/api/runs/component%20%2F%3F/operational-snapshot",
    "http://127.0.0.1:3080/api/setfarm/runs/component%20%2F%3F/operational-snapshot",
    "http://127.0.0.1:3080/api/setfarm/sync-projects?runId=component%20%2F%3F",
  ]);
  for (let index = 0; index < calls.length; index++) {
    const headers = new Headers(calls[index]!.init.headers);
    assert.equal(headers.get("accept"), "application/json");
    assert.equal(headers.get("x-mc-token"), index >= 3 ? token : null);
    assert.equal(headers.get("authorization"), null);
    assert.equal(headers.get("x-setfarm-operational-token"), null);
    assert.equal(calls[index]!.url.includes(token), false);
    assert.equal(calls[index]!.init.body, undefined);
    assert.ok(calls[index]!.init.signal instanceof AbortSignal);
  }
  assert.equal(calls[3]!.init.redirect, "error", "custom MC credential must not follow redirects");
  assert.equal(calls[4]!.init.redirect, "error");
  assert.equal(calls[4]!.init.method, "POST");
  assert.equal(JSON.stringify(synced).includes(token), false);
});

test("generic AUTH_TOKEN is not an evaluator credential fallback", async () => {
  const calls: Call[] = [];
  const port = loadPort({ AUTH_TOKEN: "generic-must-not-leak" }, fetchRecorder(calls));
  await port.operationalSnapshot("mission_control", "component");
  await port.syncProject("component");
  for (const call of calls) assert.equal(new Headers(call.init.headers).get("x-mc-token"), null);
});

test("one evaluator HTTP port captures its intended credential before later environment edits", async () => {
  const env = { MC_AUTH_TOKEN: "original-component-token" };
  const calls: Call[] = [];
  const port = loadPort(env, fetchRecorder(calls));
  env.MC_AUTH_TOKEN = "later-component-token";
  await port.operationalSnapshot("mission_control", "component");
  await port.syncProject("component");
  for (const call of calls) assert.equal(new Headers(call.init.headers).get("x-mc-token"), "original-component-token");
});

test("MC authentication refusal remains a snapshot error and unsuccessful sync", async () => {
  const calls: Call[] = [];
  const port = loadPort({ MC_AUTH_TOKEN: "wrong-component-token" }, fetchRecorder(calls, 401));
  await assert.rejects(port.operationalSnapshot("mission_control", "component"), /EVAL_OPERATIONAL_SNAPSHOT_UNAVAILABLE/);
  const sync = await port.syncProject("component");
  assert.equal(sync.ok, false);
  assert.equal(JSON.stringify(sync).includes("wrong-component-token"), false);
});

test("MC redirect rejection propagates without retrying a credential-bearing request", async () => {
  const calls: Call[] = [];
  const rejectRedirect = (async (url: string | URL | Request, init: RequestInit = {}) => {
    calls.push({ url: String(url), init });
    assert.equal(init.redirect, "error");
    throw new TypeError("component redirect refused");
  }) as typeof fetch;
  const port = loadPort({ MC_AUTH_TOKEN: "component-token" }, rejectRedirect);
  await assert.rejects(port.operationalSnapshot("mission_control", "component"), /component redirect refused/);
  await assert.rejects(port.syncProject("component"), /component redirect refused/);
  assert.equal(calls.length, 2, "no automatic retry or unscoped redirected fetch");
});
