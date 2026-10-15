import assert from "node:assert/strict";
import { test } from "node:test";
import { DASHBOARD_CORE_COLUMN_MANIFEST_V2 as manifest } from "../../src/db/dashboard-core-readonly-profile-v2.js";

const production = new URL("../../src/db/dashboard-core-response-v2.js", import.meta.url);
const timestamp = "2026-10-07T00:00:00.000Z";
function row(table: keyof typeof manifest, overrides: Record<string, unknown> = {}) {
  return { ...Object.fromEntries(manifest[table].map(field => [field.name, field.type === "timestamptz" ? new Date(timestamp)
    : field.type === "int4" ? 1 : field.type === "bool" ? true : field.notNull ? field.name : null])), ...overrides };
}
function run(id = "r", status = "running") { return row("runs", { id, status, workflow_id: "w", protocol: "legacy" }); }
function step(id = "s", runId = "r") { return row("steps", { id, run_id: runId }); }
function fixture() {
  return {
    runs: [run()], steps: [step()], stories: [row("stories", { id: "story", run_id: "r" })],
    rules: [row("rules", { id: "rule" })], observations: [row("run_observations", {
      id: "o", run_id: "r", evidence: '{"ok":true}', file_paths: '["a"]', github: "{}", metadata: "{}",
    })],
  };
}
async function invoke(request: unknown, data = fixture(), failAt = 0, unfilteredSteps = false) {
  const module = await import(production.href);
  const calls: Array<{ statement: string; parameters: unknown[]; sameOriginal: boolean }> = [];
  let txLookups = 0;
  const tx = { get unsafe() {
    txLookups++;
    return async function(this: unknown, statement: string, parameters: unknown[] = []) {
      calls.push({ statement, parameters, sameOriginal: this === tx });
      if (calls.length === failAt) throw Error("PRIVATE_DRIVER_DETAIL");
      if (statement.startsWith("SELECT * FROM public.runs")) return data.runs;
      if (statement.startsWith("SELECT * FROM public.steps")) return unfilteredSteps ? data.steps : data.steps.filter(item => item.run_id === parameters[0]);
      if (statement.startsWith("SELECT * FROM public.stories")) return data.stories;
      if (statement.startsWith("SELECT * FROM public.rules")) return data.rules;
      if (statement.includes("FROM public.run_observations")) return data.observations;
      throw Error("UNNOMINATED_STATEMENT");
    };
  } };
  try { return { result: await module.readDashboardCoreResponseInTransactionV2(tx, request), calls, txLookups }; }
  catch (error) { return { error, failure: module.classifyDashboardCoreResponseFailureV2(error), calls, txLookups }; }
}

for (const request of [{ kind: "runs" }, { kind: "runs", workflowId: "w" }, { kind: "run", id: "r" },
  { kind: "stories", id: "r" }, { kind: "observations", id: "r" }, { kind: "rules" }]) {
  test(`closed ${JSON.stringify(request)} operation uses only original data ports`, async () => {
    const result = await invoke(request); assert.equal(result.error, undefined); assert.ok(result.result);
    assert.equal(result.calls.length, request.kind === "runs" || request.kind === "run" ? 2 : 1);
    assert.ok(result.calls.every(call => call.sameOriginal));
    assert.ok(Object.isFrozen(result.result));
    if (request.kind === "runs") {
      assert.equal((result.result as any)[0].steps[0].id, "s");
      assert.equal((result.result as any)[0].derived_status, "active");
      assert.equal((result.result as any)[0].created_at, timestamp);
    }
  });
}

test("list defaults to active while history preserves terminal data; detail is never list-filtered", async () => {
  const data = fixture(); data.runs = [run("r", "failed")];
  const active = await invoke({ kind: "runs" }, data); assert.deepEqual(active.result, []); assert.equal(active.calls.length, 1);
  const history = await invoke({ kind: "runs", includeTerminal: true }, data);
  assert.equal((history.result as any)[0].status, "failed"); assert.equal(history.calls.length, 2);
  const detail = await invoke({ kind: "run", id: "r" }, data);
  assert.equal((detail.result as any).status, "failed"); assert.equal(detail.calls.length, 2);
});

test("genuine missing detail returns null without querying steps", async () => {
  const data = fixture(); data.runs = [];
  const result = await invoke({ kind: "run", id: "missing" }, data);
  assert.equal(result.error, undefined); assert.equal(result.result, null); assert.equal(result.calls.length, 1);
});

for (const request of [undefined, null, [], "runs", { kind: "unknown" }, { kind: "steps", id: "r" },
  { kind: "rules", sql: "SELECT 1" }, { kind: "run" }, { kind: "run", id: "" }, { kind: "run", id: "a\0b" },
  { kind: "run", id: "\ud800" }, { kind: "run", id: "a".repeat(1025) }, { kind: "runs", workflowId: "" },
  { kind: "runs", workflowId: undefined }, { kind: "runs", includeTerminal: "true" }, { kind: "runs", includeTerminal: undefined },
  { kind: "rules", [Symbol("x")]: true }]) {
  test(`invalid closed request ${JSON.stringify(request)} has zero transaction lookups`, async () => {
    const result = await invoke(request);
    assert.equal(result.failure?.code, "DASHBOARD_CORE_REQUEST_REFUSED");
    assert.equal(result.failure?.disposition, "operation-refusal");
    assert.equal(result.calls.length, 0); assert.equal(result.txLookups, 0);
  });
}

test("proxy and accessor controls refuse before traps or originalTx lookup", async () => {
  let traps = 0;
  for (const request of [new Proxy({}, { get() { traps++; throw Error("CALLER_TRAP"); },
    ownKeys() { traps++; throw Error("CALLER_TRAP"); }, getPrototypeOf() { traps++; throw Error("CALLER_TRAP"); } }),
    Object.defineProperty({}, "kind", { enumerable: true, get() { traps++; throw Error("CALLER_TRAP"); } })]) {
    const result = await invoke(request);
    assert.equal(result.failure?.code, "DASHBOARD_CORE_REQUEST_REFUSED");
    assert.equal(result.txLookups, 0); assert.equal(result.calls.length, 0);
  }
  assert.equal(traps, 0);
});

test("request copy defaults are frozen, original alias/control mutation cannot change them", async () => {
  const module = await import(production.href);
  const request = { kind: "runs", workflowId: "w" };
  const copied = module.copyDashboardCoreRequestV2(request);
  request.workflowId = "changed";
  assert.deepEqual(copied, { kind: "runs", workflowId: "w", includeTerminal: false });
  assert.ok(Object.isFrozen(copied));
});

for (const [name, mutate] of [
  ["duplicate run", (data: ReturnType<typeof fixture>) => { data.runs.push(run()); }],
  ["wrong workflow", (data: ReturnType<typeof fixture>) => { data.runs[0]!.workflow_id = "other"; }],
  ["extra row column", (data: ReturnType<typeof fixture>) => { data.runs[0]!.extra = "not source"; }],
  ["missing row column", (data: ReturnType<typeof fixture>) => { delete data.runs[0]!.meta; }],
  ["wrong primitive type", (data: ReturnType<typeof fixture>) => { data.runs[0]!.run_number = "1"; }],
  ["NULL nonnullable", (data: ReturnType<typeof fixture>) => { data.runs[0]!.task = null; }],
  ["invalid timestamp", (data: ReturnType<typeof fixture>) => { data.runs[0]!.created_at = new Date(NaN); }],
] as const) test(`${name} refuses whole response before step ports`, async () => {
  const data = fixture(); mutate(data);
  const result = await invoke({ kind: "runs", workflowId: "w" }, data);
  assert.equal(result.failure?.code, "DASHBOARD_CORE_ROWS_REFUSED");
  assert.equal(result.failure?.disposition, "sticky-refusal");
  assert.equal(result.result, undefined); assert.equal(result.calls.length, 1);
});

test("provider row accessor refuses without getter invocation", async () => {
  const data = fixture(); let traps = 0;
  Object.defineProperty(data.runs[0], "task", { enumerable: true, get() { traps++; throw Error("CALLER_TRAP"); } });
  const result = await invoke({ kind: "runs" }, data);
  assert.equal(result.failure?.code, "DASHBOARD_CORE_ROWS_REFUSED"); assert.equal(traps, 0); assert.equal(result.calls.length, 1);
});

test("late original step-query failure publishes no earlier run rows and hides provider detail", async () => {
  const result = await invoke({ kind: "runs" }, fixture(), 2);
  assert.equal(result.failure?.code, "DASHBOARD_CORE_QUERY_REFUSED");
  assert.equal(result.failure?.disposition, "sticky-refusal");
  assert.equal((result.error as Error).message, "DASHBOARD_CORE_QUERY_REFUSED");
  assert.equal(result.result, undefined); assert.equal(result.calls.length, 2);
});

test("third-port failure withholds an already completed earlier run projection", async () => {
  const data = fixture(); data.runs = [run("r"), run("r2")]; data.steps.push(step("s2", "r2"));
  const result = await invoke({ kind: "runs" }, data, 3);
  assert.equal(result.failure?.code, "DASHBOARD_CORE_QUERY_REFUSED"); assert.equal(result.failure?.disposition, "sticky-refusal");
  assert.equal(result.result, undefined); assert.equal(result.calls.length, 3);
  assert.deepEqual(result.calls.map(call => call.parameters), [[], ["r"], ["r2"]]);
});

for (const [kind, field, cap] of [["runs", "runs", 256], ["stories", "stories", 4096], ["rules", "rules", 4096],
  ["observations", "observations", 250]] as const) test(`${kind} overflow refuses whole operation`, async () => {
  const data = fixture(); const original = data[field][0]!;
  data[field] = Array.from({ length: cap + 1 }, (_, index) => ({ ...original, id: String(index) }));
  const result = await invoke(kind === "runs" || kind === "rules" ? { kind } : { kind, id: "r" }, data);
  assert.equal(result.failure?.code, "DASHBOARD_CORE_RESPONSE_CAPACITY_REFUSED");
  assert.equal(result.failure?.disposition, "operation-refusal"); assert.equal(result.result, undefined);
  assert.equal(result.calls.length, 1);
});

test("step overflow refuses whole result rather than truncate", async () => {
  const data = fixture(); data.steps = Array.from({ length: 1025 }, (_, index) => step(String(index)));
  const result = await invoke({ kind: "run", id: "r" }, data);
  assert.equal(result.failure?.code, "DASHBOARD_CORE_RESPONSE_CAPACITY_REFUSED"); assert.equal(result.result, undefined);
});

test("full projected UTF8 JSON limit includes source text escape expansion", async () => {
  const data = fixture(); data.rules[0]!.content = "\"".repeat(3 * 1024 * 1024);
  const result = await invoke({ kind: "rules" }, data);
  assert.equal(result.failure?.code, "DASHBOARD_CORE_RESPONSE_CAPACITY_REFUSED"); assert.equal(result.result, undefined);
});

test("observations preserve camelCase, JSON scalars/fallbacks and deep inert copy", async () => {
  const data = fixture(); data.observations[0]!.metadata = "null"; data.observations[0]!.github = "invalid";
  const result = await invoke({ kind: "observations", id: "r" }, data);
  assert.equal(result.error, undefined);
  const observation = (result.result as any)[0];
  assert.equal(observation.runId, "r"); assert.equal(observation.createdAt, timestamp);
  assert.equal(observation.metadata, null); assert.deepEqual(observation.github, {});
  assert.deepEqual(observation.filePaths, ["a"]); assert.deepEqual(observation.evidence, { ok: true });
  assert.ok(Object.isFrozen(observation)); assert.ok(Object.isFrozen(observation.evidence)); assert.ok(Object.isFrozen(observation.filePaths));
  data.observations[0]!.evidence = "changed"; assert.deepEqual(observation.evidence, { ok: true });
});

test("failure classification authenticates original source errors, never caller messages/proxies", async () => {
  const module = await import(production.href); let traps = 0;
  assert.equal(module.classifyDashboardCoreResponseFailureV2(Error("DASHBOARD_CORE_RESPONSE_CAPACITY_REFUSED")), null);
  const proxy = new Proxy({}, { get() { traps++; throw Error("CALLER_TRAP"); }, ownKeys() { traps++; throw Error("CALLER_TRAP"); } });
  assert.equal(module.classifyDashboardCoreResponseFailureV2(proxy), null); assert.equal(traps, 0);
});

for (const kind of ["run", "stories", "observations"] as const) test(`${kind} crossed identity is sticky, never absent`, async () => {
  const data = fixture();
  if (kind === "run") data.runs[0]!.id = "other";
  else if (kind === "stories") data.stories[0]!.run_id = "other";
  else data.observations[0]!.run_id = "other";
  const result = await invoke({ kind, id: "r" }, data);
  assert.equal(result.failure?.code, "DASHBOARD_CORE_ROWS_REFUSED"); assert.equal(result.result, undefined);
  assert.equal(result.calls.length, 1);
});

test("crossed step row is refused, not silently filtered", async () => {
  const data = fixture(); data.steps[0]!.run_id = "other";
  const result = await invoke({ kind: "run", id: "r" }, data, 0, true);
  assert.equal(result.failure?.code, "DASHBOARD_CORE_ROWS_REFUSED"); assert.equal(result.result, undefined);
});

for (const kind of ["stories", "observations", "rules", "run"] as const) test(`${kind} duplicate related id refuses`, async () => {
  const data = fixture(); const target = kind === "run" ? data.steps : kind === "stories" ? data.stories
    : kind === "observations" ? data.observations : data.rules;
  target.push({ ...target[0]! });
  const result = await invoke(kind === "rules" ? { kind } : { kind, id: "r" }, data);
  assert.equal(result.failure?.code, "DASHBOARD_CORE_ROWS_REFUSED"); assert.equal(result.result, undefined);
});

test("aggregate fetched-row overflow stops before the next run step port", async () => {
  const data = fixture(); data.runs = Array.from({ length: 5 }, (_, index) => run(`r${index}`));
  data.steps = data.runs.flatMap(parent => Array.from({ length: 1024 }, (_, index) => step(`${parent.id}-${index}`, parent.id as string)));
  const result = await invoke({ kind: "runs" }, data);
  assert.equal(result.failure?.code, "DASHBOARD_CORE_RESPONSE_CAPACITY_REFUSED");
  assert.equal(result.result, undefined); assert.equal(result.calls.length, 5);
  assert.equal(result.calls.some(call => call.parameters[0] === "r4"), false);
});

test("exact aggregate row capacity includes initial run rows", async () => {
  const data = fixture(); data.runs = Array.from({ length: 4 }, (_, index) => run(`r${index}`));
  data.steps = data.runs.flatMap(parent => Array.from({ length: 1023 }, (_, index) => step(`${parent.id}-${index}`, parent.id as string)));
  const result = await invoke({ kind: "runs" }, data);
  assert.equal(result.error, undefined); assert.equal((result.result as any).length, 4); assert.equal(result.calls.length, 5);
});

for (const [depth, accepted] of [[64, true], [65, false]] as const) test(`root-depth ${depth} ${accepted ? "accepted" : "whole refusal"}`, async () => {
  // Response array(0), observation(1), evidence(2), nested keys through depth64/65.
  let value: unknown = 1;
  for (let index = 0; index < depth - 2; index++) value = { nested: value };
  const data = fixture(); data.observations[0]!.evidence = JSON.stringify(value);
  const result = await invoke({ kind: "observations", id: "r" }, data);
  if (accepted) assert.equal(result.error, undefined);
  else { assert.equal(result.failure?.code, "DASHBOARD_CORE_RESPONSE_CAPACITY_REFUSED"); assert.equal(result.result, undefined); }
});

test("PG Result nonenumerable metadata is ignored without executing getters", async () => {
  const data = fixture(); let getters = 0;
  Object.defineProperty(data.rules, "count", { get() { getters++; throw Error("PROVIDER_METADATA"); } });
  const result = await invoke({ kind: "rules" }, data);
  assert.equal(result.error, undefined); assert.equal(getters, 0);
});

for (const fault of ["hole", "extra", "indexGetter"] as const) test(`provider array ${fault} is sticky with zero traps`, async () => {
  const data = fixture(); let traps = 0;
  if (fault === "hole") delete data.rules[0];
  if (fault === "extra") Object.defineProperty(data.rules, "extra", { value: 1, enumerable: true });
  if (fault === "indexGetter") Object.defineProperty(data.rules, "0", { enumerable: true, get() { traps++; throw Error("TRAP"); } });
  const result = await invoke({ kind: "rules" }, data);
  assert.equal(result.failure?.code, "DASHBOARD_CORE_ROWS_REFUSED"); assert.equal(traps, 0); assert.equal(result.result, undefined);
});

test("synchronously returned proxy result is rejected before Promise assimilation traps", async () => {
  const module = await import(production.href); let traps = 0;
  const proxy = new Proxy([], { get() { traps++; throw Error("TRAP"); }, ownKeys() { traps++; throw Error("TRAP"); } });
  let caught: unknown;
  try { await module.readDashboardCoreResponseInTransactionV2({ unsafe() { return proxy; } }, { kind: "rules" }); }
  catch (error) { caught = error; }
  assert.equal(module.classifyDashboardCoreResponseFailureV2(caught)?.code, "DASHBOARD_CORE_ROWS_REFUSED");
  assert.equal(traps, 0);
});

test("synchronously returned function proxy is rejected before then trap", async () => {
  const module = await import(production.href); let traps = 0;
  const proxy = new Proxy(function() {}, { get() { traps++; throw Error("TRAP"); } });
  let caught: unknown;
  try { await module.readDashboardCoreResponseInTransactionV2({ unsafe() { return proxy; } }, { kind: "rules" }); }
  catch (error) { caught = error; }
  assert.equal(module.classifyDashboardCoreResponseFailureV2(caught)?.code, "DASHBOARD_CORE_ROWS_REFUSED");
  assert.equal(traps, 0);
});

test("data port parameter alias cannot rebind a step to another run", async () => {
  const module = await import(production.href);
  const tx = { async unsafe(sql: string, parameters: string[]) {
    if (sql.startsWith("SELECT * FROM public.runs")) return [run()];
    parameters[0] = "other";
    return [step("s", "other")];
  } };
  let caught: unknown;
  try { await module.readDashboardCoreResponseInTransactionV2(tx, { kind: "runs" }); }
  catch (error) { caught = error; }
  assert.equal(module.classifyDashboardCoreResponseFailureV2(caught)?.code, "DASHBOARD_CORE_ROWS_REFUSED");
});

test("builtin Date hooks are never invoked and subclass timestamps refuse", async () => {
  const data = fixture(); let traps = 0;
  Object.defineProperty(data.runs[0]!.created_at, "toJSON", { get() { traps++; throw Error("TRAP"); } });
  const decorated = await invoke({ kind: "runs" }, data);
  assert.equal(decorated.failure?.code, "DASHBOARD_CORE_ROWS_REFUSED"); assert.equal(traps, 0);
  class ForeignDate extends Date {}
  data.runs[0]!.created_at = new ForeignDate(timestamp);
  const foreign = await invoke({ kind: "runs" }, data);
  assert.equal(foreign.failure?.code, "DASHBOARD_CORE_ROWS_REFUSED");
});

test("JSON own __proto__ is inert data, not a prototype change", async () => {
  const data = fixture(); data.observations[0]!.evidence = '{"__proto__":{"polluted":true}}';
  const result = await invoke({ kind: "observations", id: "r" }, data);
  const evidence = (result.result as any)[0].evidence;
  assert.equal(Object.getPrototypeOf(evidence), Object.prototype);
  assert.equal(Object.hasOwn(evidence, "__proto__"), true); assert.equal(evidence.polluted, undefined);
  assert.ok(Object.isFrozen(evidence.__proto__));
});

test("legacy non-enum protocol TEXT and timestamps retain serialized values", async () => {
  const data = fixture(); data.runs[0]!.protocol = "historical-unrecognized-text";
  const result = await invoke({ kind: "runs" }, data);
  assert.equal(result.error, undefined); assert.equal((result.result as any)[0].protocol, "historical-unrecognized-text");
  data.runs[0]!.created_at = new Date("2020-01-01T00:00:00Z");
  assert.equal((result.result as any)[0].created_at, timestamp);
});

test("all seven complete SQL statements, ordering and primitive parameters are independently pinned", async () => {
  const observed: Array<{ statement: string; parameters: unknown[] }> = [];
  for (const request of [{ kind: "runs" }, { kind: "runs", workflowId: "w" }, { kind: "run", id: "r" },
    { kind: "stories", id: "r" }, { kind: "observations", id: "r" }, { kind: "rules" }]) {
    const result = await invoke(request); assert.equal(result.error, undefined);
    observed.push(...result.calls.map(({ statement, parameters }) => ({ statement, parameters })));
  }
  const steps = { statement: "SELECT * FROM public.steps WHERE run_id = $1 ORDER BY step_index ASC", parameters: ["r"] };
  assert.deepEqual(observed, [
    { statement: "SELECT * FROM public.runs ORDER BY created_at DESC", parameters: [] }, steps,
    { statement: "SELECT * FROM public.runs WHERE workflow_id = $1 ORDER BY created_at DESC", parameters: ["w"] }, steps,
    { statement: "SELECT * FROM public.runs WHERE id = $1", parameters: ["r"] }, steps,
    { statement: "SELECT * FROM public.stories WHERE run_id = $1 ORDER BY story_index ASC", parameters: ["r"] },
    { statement: `SELECT id, run_id, step_id, story_id, agent_id, phase, check_id, label, status,
       summary, detail, evidence, file_paths, github, metadata, event_type,
       started_at, completed_at, created_at, updated_at
FROM public.run_observations
WHERE run_id = $1
ORDER BY created_at DESC
LIMIT 250`, parameters: ["r"] },
    { statement: "SELECT * FROM public.rules ORDER BY sort_order ASC, created_at ASC", parameters: [] },
  ]);
});

for (const fault of ["holes", "indexGetter", "symbol"] as const) test(`over-cap ${fault} array is malformed sticky, not reusable capacity`, async () => {
  const data = fixture(); let traps = 0;
  data.runs = fault === "holes" ? new Array(257) : Array.from({ length: 257 }, (_, index) => run(String(index)));
  if (fault === "indexGetter") Object.defineProperty(data.runs, "256", { enumerable: true, get() { traps++; throw Error("TRAP"); } });
  if (fault === "symbol") Object.defineProperty(data.runs, Symbol("foreign"), { value: true });
  const result = await invoke({ kind: "runs" }, data);
  assert.equal(result.failure?.code, "DASHBOARD_CORE_ROWS_REFUSED"); assert.equal(result.failure?.disposition, "sticky-refusal");
  assert.equal(traps, 0); assert.equal(result.result, undefined); assert.equal(result.calls.length, 1);
});
