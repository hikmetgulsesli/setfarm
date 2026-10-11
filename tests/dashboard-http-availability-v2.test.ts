import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { test } from "node:test";

const html = fs.readFileSync(new URL("../src/server/index.html", import.meta.url), "utf8");
const script = html.match(/<script>([\s\S]*?)<\/script>/)![1]!;

function fixture() {
  const ids = new Map<string, Element>();
  class Element {
    id = ""; className = ""; value = ""; disabled = false;
    style: Record<string, string> = {}; dataset: Record<string, string> = {};
    attrs: Record<string, string> = {}; children: Element[] = []; parentNode: Element | null = null;
    ownText = ""; onclick: (() => unknown) | null = null;
    classes = new Set<string>();
    classList = { add: (x: string) => this.classes.add(x), remove: (x: string) => this.classes.delete(x),
      toggle: (x: string, force?: boolean) => { if (force ?? !this.classes.has(x)) this.classes.add(x); else this.classes.delete(x); },
      contains: (x: string) => this.classes.has(x) };
    set textContent(value: unknown) { this.children.forEach(x => x.detach()); this.children = []; this.ownText = String(value); }
    get textContent(): string { return this.ownText + this.children.map(x => x.textContent).join(" "); }
    get childNodes() { return this.children; }
    appendChild(child: Element) { child.parentNode = this; this.children.push(child); if (child.id) ids.set(child.id, child); return child; }
    prepend(child: Element) { child.parentNode = this; this.children.unshift(child); if (child.id) ids.set(child.id, child); }
    setAttribute(key: string, value: string) { this.attrs[key] = value; }
    getAttribute(key: string) { return this.attrs[key] ?? null; }
    hasChildNodes() { return this.children.length > 0; }
    addEventListener() {} focus() {} contains(child: Element) { return this.children.includes(child); }
    click() { probe.clicks++; this.onclick?.(); }
    detach() { if (this.id && ids.get(this.id) === this) ids.delete(this.id); this.children.forEach(x => x.detach()); }
    remove() { this.detach(); if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(x => x !== this); }
  }
  for (const match of html.matchAll(/id="([^"]+)"/g)) { const element = new Element(); element.id = match[1]!; ids.set(element.id, element); }
  const probe = { requests: [] as Array<{ url: string; options: any }>, json: 0, blobs: 0, urls: 0, clicks: 0,
    alerts: [] as string[], fetch: (_url: string, _options: any): Promise<any> => new Promise(() => {}) };
  const document = { getElementById: (id: string) => ids.get(id) ?? null, createElement: () => new Element(),
    createTextNode: (text: string) => { const element = new Element(); element.textContent = text; return element; },
    addEventListener() {}, documentElement: new Element(), body: new Element() };
  const context = vm.createContext({ document, window: { matchMedia: () => ({ matches: false, addEventListener() {} }) },
    localStorage: { getItem: () => null, setItem() {} }, setInterval() {},
    fetch: (url: string, options: any) => { probe.requests.push({ url, options }); return probe.fetch(url, options); },
    confirm: () => true, alert: (message: string) => probe.alerts.push(message),
    URL: { createObjectURL() { probe.urls++; return "blob:inert"; }, revokeObjectURL() {} }, console,
  });
  vm.runInContext(script, context, { filename: "actual-dashboard-inline.js", timeout: 1000 });
  probe.requests = []; // Initial real-script loads remain pending inert work.
  function response(data: unknown = [], ok = true, status = ok ? 200 : 503) {
    return { ok, status, json: async () => { probe.json++; return data; }, blob: async () => { probe.blobs++; return {}; } };
  }
  return { probe, context: context as any, response, element: (id: string) => ids.get(id)!,
    evaluate: (source: string) => vm.runInContext(source, context) };
}
function seedRun(f: ReturnType<typeof fixture>) {
  f.evaluate(`workflows=[{id:'wf',name:'WF',steps:[{id:'step'}]}];currentWf=workflows[0];`);
}
function unavailable(element: ReturnType<ReturnType<typeof fixture>["element"]>) {
  assert.ok(element, "missing visible unavailable status owner");
  assert.equal(element.dataset.dashboardLoadState, "unavailable");
  assert.match(element.textContent, /unavailable/i);
  assert.match(element.textContent, /stale|incomplete/i);
  assert.ok(element.children.some(child => child.getAttribute("role") === "status"));
  assert.ok(!element.textContent.includes("PRIVATE_DETAIL"));
}

test("non-OK JSON is rejected before successful-looking body parsing", async () => {
  const f = fixture(); f.probe.fetch = async () => f.response({ success: true }, false);
  await assert.rejects(f.context.fetchJSON("/api/runs")); assert.equal(f.probe.json, 0);
});
test("non-OK non-JSON is refused without decoding its body", async () => {
  const f = fixture(); f.probe.fetch = async () => ({ ok: false, status: 503, json() { f.probe.json++; throw Error("PRIVATE_DETAIL"); } });
  await assert.rejects(f.context.fetchJSON("/api/runs"), /unavailable/i); assert.equal(f.probe.json, 0);
});
for (const mode of ["network", "json"]) test(`${mode} failure produces fixed safe request error`, async () => {
  const f = fixture(); f.probe.fetch = async () => { if (mode === "network") throw Error("PRIVATE_DETAIL"); return { ok: true, json: async () => { throw Error("PRIVATE_DETAIL"); } }; };
  await assert.rejects(f.context.fetchJSON("/api/runs"), (error: any) => { assert.ok(!error.message.includes("PRIVATE_DETAIL")); return true; });
});
test("successful empty JSON remains a genuine empty success", async () => {
  const f = fixture(); f.probe.fetch = async () => f.response([]);
  assert.equal(JSON.stringify(await f.context.fetchJSON("/api/runs")), "[]"); assert.equal(f.probe.json, 1);
});
for (const [method, panel, args] of [
  ["loadWorkflows", "board", []], ["loadRuns", "board", []], ["openRun", "panel", ["run"]],
  ["loadStories", "stories-panel", ["run"]], ["loadScrapeHistory", "scrape-history-body", []],
  ["loadRulesData", "rules-list", []], ["loadMedicData", "medic-panel-body", []],
] as const) test(`${method} keeps prior data visibly unavailable on HTTP failure`, async () => {
  const f = fixture(); seedRun(f);
  if (panel === "stories-panel") { const p = f.context.document.createElement(); p.id = panel; f.element("panel").appendChild(p); }
  f.element(panel).textContent = "Previously failed project";
  f.probe.fetch = async () => f.response({ error: "PRIVATE_DETAIL" }, false);
  await f.context[method](...args); unavailable(f.element(panel));
  assert.match(f.element(panel).textContent, /Previously failed project/); assert.equal(f.probe.json, 0);
});
test("successful run refresh clears stale marker and renders genuine empty data", async () => {
  const f = fixture(); seedRun(f); f.probe.fetch = async () => f.response([], false); await f.context.loadRuns();
  f.probe.fetch = async () => f.response([]); await f.context.loadRuns();
  assert.equal(f.element("board").dataset.dashboardLoadState, "ready"); assert.match(f.element("board").textContent, /No runs/); assert.doesNotMatch(f.element("board").textContent, /unavailable/);
});
test("Medic HTTP failure is explicitly unavailable rather than not-installed", async () => {
  const f = fixture(); f.probe.fetch = async () => f.response({}, false); await f.context.loadMedicStatus();
  assert.match(f.element("medic-label").textContent, /unavailable/i); assert.equal(f.element("medic-dot").className, "medic-dot unknown");
});
for (const failure of ["events", "observations", "both"]) test(`activity source failure ${failure} is visible without blocking the other source`, async () => {
  const f = fixture(); const container = f.context.document.createElement(); container.id = "activity-panel"; f.element("panel").appendChild(container); container.textContent = "Previous activity";
  f.probe.fetch = async url => { const events = url.endsWith("/events"); const denied = failure === "both" || failure === (events ? "events" : "observations");
    return f.response(events ? [{ event: "run.failed", ts: "2026-10-07T00:00:00Z" }] : [{ label: "Observed failure", status: "fail", createdAt: "2026-10-07T00:00:00Z" }], !denied); };
  await f.context.loadActivity("run"); unavailable(container);
  assert.equal(f.probe.requests.length, 2);
  if (failure === "events") assert.match(container.textContent, /Observed failure/);
  if (failure === "observations") assert.match(container.textContent, /Run failed/);
  if (failure === "both") assert.match(container.textContent, /Previous activity/);
});
test("filtering old cached rules cannot erase unavailable state", async () => {
  const f = fixture(); f.evaluate(`allRules=[{id:'r',title:'Old rule',content:'data',category:'general',project_type:'general',readonly:false}];filterRules();`);
  f.probe.fetch = async () => f.response({}, false); await f.context.loadRulesData(); f.context.filterRules();
  unavailable(f.element("rules-list")); assert.match(f.element("rules-list").textContent, /Old rule/);
});
test("failed rule export does not decode a blob or create any download", async () => {
  const f = fixture(); f.probe.fetch = async () => f.response({}, false); await f.context.exportRules();
  assert.equal(f.probe.blobs, 0); assert.equal(f.probe.urls, 0); assert.equal(f.probe.clicks, 0); unavailable(f.element("rules-export-status"));
});
test("failed import neither parses error data nor announces invented zero success", async () => {
  const f = fixture(); f.probe.fetch = async () => f.response({ imported: 0 }, false);
  await f.context.handleRulesImport({ target: { files: [{ text: async () => "{}" }], value: "selected" } });
  assert.equal(f.probe.json, 0); assert.equal(f.probe.alerts.length, 0); assert.equal(f.probe.requests.length, 1); unavailable(f.element("rules-import-status"));
});
for (const method of ["saveRule", "deleteRule"]) test(`failed ${method} does not reload as successful mutation`, async () => {
  const f = fixture(); f.probe.fetch = async () => f.response({}, false);
  await f.context[method]("r", { title: "Rule", content: "data" });
  assert.equal(f.probe.requests.length, 1); unavailable(f.element(method === "saveRule" ? "rules-save-status" : "rules-delete-status"));
});
test("failed modal save keeps the actual editor open", async () => {
  const f = fixture(); f.context.openRuleModal(); const modal = f.element("rules-modal-overlay");
  f.element("rule-title").value = "Rule"; f.element("rule-content").value = "data";
  f.probe.fetch = async () => f.response({}, false);
  const buttons = modal.children[0]!.children.at(-1)!.children; await buttons.at(-1)!.onclick!();
  assert.equal(f.element("rules-modal-overlay"), modal); unavailable(f.element("rules-save-status"));
});
test("failed scrape with success-shaped body cannot display a successful result", async () => {
  const f = fixture(); f.element("scrape-url").value = "https://example.invalid";
  f.probe.fetch = async () => f.response({ success: true, data: { title: "FALSE_SUCCESS" } }, false);
  await f.context.doScrape(); assert.equal(f.probe.json, 0); assert.doesNotMatch(f.element("scrape-output").textContent, /FALSE_SUCCESS/); assert.match(f.element("scrape-output").textContent, /unavailable|failed/i);
});
test("late run-list response cannot repaint a different workflow selection", async () => {
  const f = fixture(); seedRun(f); let settle!: (value: unknown) => void;
  f.probe.fetch = () => new Promise(resolve => { settle = resolve; }); const original = f.context.loadRuns();
  f.evaluate(`currentWf={id:'new',steps:[{id:'different'}]};`); f.element("board").textContent = "New selection";
  settle(f.response([])); await original; assert.equal(f.element("board").textContent, "New selection");
});
test("closed run panel cannot be reopened by a late detail response", async () => {
  const f = fixture(); let settle!: (value: unknown) => void;
  f.probe.fetch = () => new Promise(resolve => { settle = resolve; }); const original = f.context.openRun("run"); f.context.closePanel();
  settle(f.response({ workflow_id: "wf", task: "Old run", steps: [] })); await original; assert.equal(f.element("overlay").classList.contains("open"), false);
});
for (const olderFails of [false, true]) test(`same-workflow older result cannot replace the newer state (olderFails=${olderFails})`, async () => {
  const f = fixture(); seedRun(f); const pending: Array<(value: unknown) => void> = [];
  f.probe.fetch = () => new Promise(resolve => pending.push(resolve));
  const older = f.context.loadRuns(), newer = f.context.loadRuns();
  pending[1]!(f.response([], olderFails)); await newer;
  pending[0]!(f.response([], !olderFails)); await older;
  if (!olderFails) unavailable(f.element("board"));
  else { assert.equal(f.element("board").dataset.dashboardLoadState, "ready"); assert.doesNotMatch(f.element("board").textContent, /unavailable/); }
});
test("terminal-filter change prevents an older active-only result hiding history", async () => {
  const f = fixture(); seedRun(f); let settle!: (value: unknown) => void;
  f.probe.fetch = () => new Promise(resolve => { settle = resolve; }); const older = f.context.loadRuns();
  f.evaluate("showTerminalRuns=true"); f.element("board").textContent = "Terminal history selected";
  settle(f.response([])); await older; assert.equal(f.element("board").textContent, "Terminal history selected");
});
test("different requested view failure names the retained successful workflow", async () => {
  const f = fixture(); seedRun(f); f.probe.fetch = async () => f.response([]); await f.context.loadRuns();
  f.evaluate(`currentWf={id:'second-wf',name:'Second WF',steps:[{id:'next'}]};`); f.probe.fetch = async () => f.response({}, false); await f.context.loadRuns();
  unavailable(f.element("board")); assert.match(f.element("board").textContent, /Workflow wf \(active runs\)/); assert.match(f.element("board").textContent, /Workflow second-wf \(active runs\)/); assert.match(f.element("board").textContent, /last (displayed|successful)/i);
});
test("workflow auto-selection failure cannot silently imply no active runs", async () => {
  const f = fixture(); f.probe.fetch = async url => url === "/api/workflows" ? f.response([{id:'a',name:'A',steps:[]},{id:'b',name:'B',steps:[]}]) : f.response([], false);
  await f.context.loadWorkflows(); unavailable(f.element("board"));
});
test("old automatic workflow probe cannot replace a newer manual selection", async () => {
  const f = fixture(); let settle!: (value: unknown) => void, probes = 0;
  f.probe.fetch = async url => {
    if (url === "/api/workflows") return f.response([{id:'a',name:'A',steps:[{id:'a-step'}]},{id:'b',name:'B',steps:[{id:'b-step'}]}]);
    if (url.includes("workflow=a") && ++probes === 1) return new Promise(resolve => { settle = resolve; });
    return f.response([]);
  };
  const original = f.context.loadWorkflows(); await new Promise(resolve => setImmediate(resolve));
  f.element("wf-select").value = "b"; f.context.selectWorkflow("b"); await new Promise(resolve => setImmediate(resolve));
  settle(f.response([{operationalActive:true}])); await original;
  assert.equal(f.evaluate("currentWf.id"), "b"); assert.equal(f.element("wf-select").value, "b"); assert.equal(probes, 1);
});
for (const method of ["loadStories", "loadActivity"]) test(`new detail selection immediately revokes old ${method} publication`, async () => {
  const f = fixture(), id = method === "loadStories" ? "stories-panel" : "activity-panel";
  const container = f.context.document.createElement(); container.id = id; f.element("panel").appendChild(container); container.textContent = "Old snapshot";
  let settle!: (value: unknown) => void;
  f.probe.fetch = url => url === "/api/runs/b" ? new Promise(() => {}) : new Promise(resolve => { settle = resolve; });
  const older = f.context[method]("a"); void f.context.openRun("b");
  // Activity's first events port is enough: a revoked continuation must stop
  // before observations. An immediate empty second result keeps the oracle finite.
  f.probe.fetch = async () => f.response([]); settle(f.response([])); await older;
  assert.equal(container.textContent, "Old snapshot"); assert.equal(container.dataset.dashboardLoadState, undefined);
});
for (const [method, panel, args] of [["loadStories", "stories-panel", ["run"]], ["loadScrapeHistory", "scrape-history-body", []], ["loadRulesData", "rules-list", []]] as const) {
  for (const data of [null, {}]) test(`${method} rejects malformed successful array DTO ${JSON.stringify(data)}`, async () => {
    const f = fixture();
    if (panel === "stories-panel") { const element = f.context.document.createElement(); element.id = panel; f.element("panel").appendChild(element); }
    f.element(panel).textContent = "Previous data"; f.probe.fetch = async () => f.response(data);
    await f.context[method](...args); unavailable(f.element(panel)); assert.match(f.element(panel).textContent, /Previous data/);
    if (method === "loadRulesData") assert.doesNotThrow(() => f.context.filterRules());
  });
}
test("render-rejected rule rows do not poison the previously valid cache", async () => {
  const f = fixture(); f.evaluate(`allRules=[{id:'r',title:'Old rule',content:'data',category:'general',project_type:'general',readonly:false}];filterRules();`);
  f.probe.fetch = async () => f.response([{id:'bad',title:'Malformed',content:'data',category:null}]);
  await f.context.loadRulesData(); assert.doesNotThrow(() => f.context.filterRules());
  unavailable(f.element("rules-list")); assert.match(f.element("rules-list").textContent, /Old rule/); assert.doesNotMatch(f.element("rules-list").textContent, /Malformed/);
});
test("HTTP200 scrape application failure never exposes private error-body text", async () => {
  const f = fixture(); f.element("scrape-url").value = "https://example.invalid";
  f.probe.fetch = async url => f.response(url === "/api/scrape" ? {success:false,error:'PRIVATE_DETAIL'} : []);
  await f.context.doScrape(); assert.doesNotMatch(f.element("scrape-output").textContent, /PRIVATE_DETAIL/); assert.match(f.element("scrape-output").textContent, /failed/i);
});
for (const [method, status] of [["saveRule", "rules-save-status"], ["deleteRule", "rules-delete-status"], ["exportRules", "rules-export-status"], ["handleRulesImport", "rules-import-status"]] as const) test(`successful rules GET cannot mask a pending denied ${method}`, async () => {
  const f = fixture(); let settle!: (value: unknown) => void;
  f.probe.fetch = () => new Promise(resolve => { settle = resolve; });
  const original = method === "handleRulesImport" ? f.context.handleRulesImport({target:{files:[{text:async()=>"{}"}],value:'selected'}}) : f.context[method]("r", {title:'Rule',content:'data'});
  await new Promise(resolve => setImmediate(resolve)); f.probe.fetch = async () => f.response([]); await f.context.loadRulesData();
  settle(f.response({}, false)); await original;
  assert.equal(f.element("rules-list").dataset.dashboardLoadState, "ready"); unavailable(f.element(status)); assert.equal(f.probe.requests.length, 2); assert.equal(f.probe.alerts.length, 0); assert.equal(f.probe.clicks, 0);
});
test("ordinary populated run and rule data keep failed cards and successful projections", async () => {
  const f = fixture(); seedRun(f); f.evaluate("showTerminalRuns=true");
  f.probe.fetch = async url => f.response(url.startsWith("/api/runs") ? [{id:'r',task:'Failed fixture',status:'failed',created_at:'2026-10-07T00:00:00Z',steps:[{step_id:'step',status:'failed'}]}] : [{id:'rule',title:'Custom fixture',content:'Rule body',category:'general',project_type:'general',readonly:false,enabled:true}]);
  await f.context.loadRuns(); await f.context.loadRulesData();
  assert.match(f.element("board").textContent, /Failed fixture/); assert.match(f.element("board").textContent, /failed/);
  assert.equal(f.probe.requests[0]!.url, "/api/runs?workflow=wf&include_terminal=1");
  assert.match(f.element("rules-list").textContent, /Custom fixture/); assert.match(f.element("rules-stats").textContent, /1 rules/);
  assert.equal(f.element("board").dataset.dashboardLoadState, "ready"); assert.equal(f.element("rules-list").dataset.dashboardLoadState, "ready");
});
for (const [method, status] of [["saveRule", "rules-save-status"], ["deleteRule", "rules-delete-status"]] as const) test(`successful ${method} clears only its action warning and reloads rules`, async () => {
  const f = fixture(); f.probe.fetch = async () => f.response({}, false); await f.context[method]("r", {title:'Rule',content:'data'});
  unavailable(f.element(status)); f.probe.requests = [];
  f.probe.fetch = async (_url, options) => f.response(options ? {id:'r'} : []); await f.context[method]("r", {title:'Rule',content:'data'}); await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.probe.requests.length, 2); assert.equal(f.probe.requests[0]!.options.method, method === "saveRule" ? "PUT" : "DELETE");
  assert.equal(f.element(status).dataset.dashboardLoadState, "ready"); assert.doesNotMatch(f.element(status).textContent, /unavailable/); assert.equal(f.element("rules-list").dataset.dashboardLoadState, "ready");
});
test("successful import preserves counts and successful export creates its intended download", async () => {
  const f = fixture(); f.probe.fetch = async (_url, options) => f.response(options ? {imported:2,updated:1,skipped:3} : []);
  const target = {files:[{text:async()=>"{}"}],value:'selected'}; await f.context.handleRulesImport({target}); await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(f.probe.alerts, ["Import: 2 added, 1 updated, 3 ignored"]); assert.equal(target.value, "");
  await f.context.exportRules(); assert.equal(f.probe.blobs, 1); assert.equal(f.probe.urls, 1); assert.equal(f.probe.clicks, 1);
  assert.equal(f.element("rules-import-status").dataset.dashboardLoadState, "ready"); assert.equal(f.element("rules-export-status").dataset.dashboardLoadState, "ready");
});
test("successful modal save closes only after confirmation settles", async () => {
  const f = fixture(); f.context.openRuleModal(); const modal = f.element("rules-modal-overlay");
  f.element("rule-title").value = "Rule"; f.element("rule-content").value = "data";
  let settle!: (value: unknown) => void; f.probe.fetch = (_url, options) => options ? new Promise(resolve => { settle = resolve; }) : Promise.resolve(f.response([]));
  const save = modal.children[0]!.children.at(-1)!.children.at(-1)!.onclick!();
  assert.equal(f.element("rules-modal-overlay"), modal); settle(f.response({id:'r'})); await save;
  assert.equal(f.element("rules-modal-overlay"), undefined);
});
