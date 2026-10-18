import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

// The complete genuine exit-finalizer Source body with synthetic SQL/session DATA.
// No whole spawner import, connection, actual claim or operational authority.
const text = readFileSync(new URL("../../src/spawner.ts", import.meta.url), "utf8");
const tree = ts.createSourceFile("spawner.ts", text, ts.ScriptTarget.Latest, true);
const matches = tree.statements.filter((node): node is ts.FunctionDeclaration =>
  ts.isFunctionDeclaration(node) && node.name?.text === "finalizeExitedStoryRuntime");
assert.equal(matches.length, 1);
const js = ts.transpileModule(matches[0]!.getText(tree), { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None,
} }).outputText;
const active = Object.freeze({ claimId: 11, runtimeSessionId: "RTS_component-exit-0001",
  runtimeOwnerInstanceId: "component-spawner", runId: "component-run", wfId: "component-workflow",
  workflowStepId: "plan", storyId: "component-story", claimAgentId: "component-agent", spawnCwd: "/component/repository" });
type Options = { completionState?: string | null; initialState?: string; claimOutcome?: string | null;
  latePublication?: boolean; missingRun?: boolean; foreignRuntime?: boolean; drainError?: Error; releaseError?: Error };
function component(options: Options = {}) {
  const events: string[] = [], queries: string[] = [], warnings: string[] = [];
  const counts = { drain: 0, requestDrain: 0, release: 0, quarantine: 0, emitted: 0, cleanup: 0 };
  const session = { sessionId: active.runtimeSessionId, ownerInstanceId: active.runtimeOwnerInstanceId,
    state: options.initialState ?? "running", stateVersion: 1 };
  let completionState = options.completionState ?? null, inTransaction = false, runLocked = false, runtimeLocked = false;
  const sql = { async unsafe(query: string, parameters: readonly unknown[]) {
    assert.equal(inTransaction, true, "ownership check and release must share the actual callback transaction");
    queries.push(query);
    if (query.includes("FROM runs")) {
      assert.match(query, /FOR UPDATE/);
      assert.deepEqual(parameters, [active.runId]);
      assert.equal(runtimeLocked, false, "run lock precedes runtime lock");
      events.push("run-lock"); runLocked = true;
      if (options.latePublication) completionState = "processing";
      return options.missingRun ? [] : [{ id: active.runId }];
    }
    if (query.includes("FROM runtime_sessions")) {
      assert.equal(runLocked, true); assert.match(query, /FOR UPDATE/);
      assert.deepEqual(parameters, [active.runtimeSessionId, active.runId, active.claimId, active.runtimeOwnerInstanceId]);
      assert.match(query, /session_id = \$1 AND run_id = \$2 AND claim_id = \$3/);
      assert.match(query, /owner_instance_id = \$4/);
      events.push("runtime-lock"); runtimeLocked = true;
      return options.foreignRuntime ? [] : [{ session_id: active.runtimeSessionId }];
    }
    if (query.includes("FROM runtime_completion_requests")) {
      assert.equal(runLocked && runtimeLocked, true);
      assert.deepEqual(parameters, [active.runId, active.claimId, active.runtimeSessionId]);
      assert.match(query, /run_id = \$1 AND claim_id = \$2 AND runtime_session_id = \$3/);
      assert.match(query, /state IN \('requested', 'draining', 'processing'\)/);
      assert.match(query, /LIMIT 1/);
      assert.doesNotMatch(query, /FOR (UPDATE|SHARE)/, "run lock serializes publication; do not reverse completion-chain row locks");
      events.push("completion-read");
      return ["requested", "draining", "processing"].includes(completionState ?? "") ? [{ request_id: "RCR_component-exit-0001" }] : [];
    }
    throw Error("unexpected Source SQL DATA");
  } };
  const bindings = {
    getSql: () => sql,
    createRuntimeSessionRepository: () => ({
      async findById() { return { ...session }; },
      async requestDrain() { counts.requestDrain++; session.state = "drain_requested"; return { ...session }; },
      async quarantine() { counts.quarantine++; session.state = "quarantined"; },
    }),
    async drainDurableRuntimeSession() {
      counts.drain++; events.push("physical-drain");
      if (options.drainError) throw options.drainError;
      session.state = "drained";
    },
    async pgGet() { return { story_status: "done", outcome: options.claimOutcome === undefined ? "completed" : options.claimOutcome }; },
    async pgBegin<T>(operation: (transaction: typeof sql) => Promise<T>) {
      assert.equal(inTransaction, false); inTransaction = true;
      try { return await operation(sql); } finally { inTransaction = false; }
    },
    async releaseDrainedRuntimeSessionInTransaction(actualSql: typeof sql, input: unknown) {
      assert.equal(actualSql, sql); assert.equal(inTransaction, true);
      counts.release++; events.push("release");
      assert.deepEqual(input, { sessionId: active.runtimeSessionId, claimId: active.claimId, ownerInstanceId: active.runtimeOwnerInstanceId });
      if (options.releaseError) throw options.releaseError;
      assert.equal(session.state, "drained"); session.state = "released";
    },
    emitEvent() { counts.emitted++; events.push("event"); },
    async cleanupQuiescedStoryWorktree() { counts.cleanup++; events.push("cleanup"); },
    console: { warn(message: string) { warnings.push(message); } },
  };
  const invoke = new Function(...Object.keys(bindings), js + ";return finalizeExitedStoryRuntime;")
    (...Object.values(bindings)) as (active: unknown) => Promise<void>;
  return { run: () => invoke(active), session, counts, events, queries, warnings };
}
for (const completionState of ["requested", "draining", "processing"]) {
  test(`exit Source proves drain but retains completion-owned runtime in ${completionState}`, async () => {
    const c = component({ completionState }); await c.run();
    assert.equal(c.counts.requestDrain, 1); assert.equal(c.counts.drain, 1);
    assert.equal(c.session.state, "drained");
    assert.deepEqual(c.events, ["physical-drain", "run-lock", "runtime-lock", "completion-read"]);
    assert.equal(c.counts.release + c.counts.emitted + c.counts.cleanup + c.counts.quarantine, 0);
  });
}
test("already-drained processing completion retains its runtime without repeated physical drain", async () => {
  const c = component({ initialState: "drained", completionState: "processing" }); await c.run();
  assert.equal(c.session.state, "drained");
  assert.equal(c.counts.drain + c.counts.requestDrain + c.counts.release + c.counts.emitted + c.counts.cleanup, 0);
});
test("no completion keeps exact normal release/event/story cleanup after the transactional check", async () => {
  const c = component(); await c.run();
  assert.deepEqual(c.events, ["physical-drain", "run-lock", "runtime-lock", "completion-read", "release", "event", "cleanup"]);
  assert.equal(c.session.state, "released"); assert.equal(c.counts.release, 1); assert.equal(c.counts.quarantine, 0);
});
for (const completionState of ["accepted", "rejected", "quarantined"]) {
  test(`terminal completion ${completionState} does not retain an otherwise releasable runtime`, async () => {
    const c = component({ completionState }); await c.run();
    assert.equal(c.session.state, "released"); assert.equal(c.counts.release, 1);
    assert.equal(c.counts.emitted, 1); assert.equal(c.counts.cleanup, 1);
  });
}
test("claim still active keeps the existing drain-only behavior", async () => {
  const c = component({ claimOutcome: null }); await c.run();
  assert.deepEqual(c.events, ["physical-drain"]); assert.equal(c.session.state, "drained");
  assert.equal(c.counts.release + c.counts.emitted + c.counts.cleanup, 0);
});
test("completion published before the serialized read is observed rather than using a stale precheck", async () => {
  const c = component({ latePublication: true }); await c.run();
  assert.equal(c.session.state, "drained"); assert.equal(c.counts.release, 0);
  assert.deepEqual(c.events, ["physical-drain", "run-lock", "runtime-lock", "completion-read"]);
});
for (const options of [{ missingRun: true }, { foreignRuntime: true }]) {
  test(`missing or changed run/runtime identity refuses release: ${JSON.stringify(options)}`, async () => {
    const c = component(options); await c.run();
    assert.equal(c.counts.release + c.counts.emitted + c.counts.cleanup, 0);
    assert.equal(c.counts.quarantine, 1); assert.equal(c.session.state, "quarantined");
    assert.match(c.warnings[0]!, /EXITED_RUNTIME_(?:RUN_NOT_FOUND|OWNER_IDENTITY_CHANGED)/);
  });
}
test("actual release refusal retains existing quarantine behavior without a success event", async () => {
  const c = component({ releaseError: new Error("DRAIN_RELEASE_REFUSED_DATA") }); await c.run();
  assert.equal(c.counts.release, 1); assert.equal(c.counts.quarantine, 1);
  assert.equal(c.counts.emitted + c.counts.cleanup, 0); assert.equal(c.session.state, "quarantined");
});
test("failed physical drain never reaches release or the completion ownership transaction", async () => {
  const c = component({ drainError: new Error("DRAIN_REFUSED_DATA") }); await c.run();
  assert.equal(c.counts.drain, 1); assert.equal(c.queries.length, 0);
  assert.equal(c.counts.release + c.counts.emitted + c.counts.cleanup, 0); assert.equal(c.counts.quarantine, 1);
});
