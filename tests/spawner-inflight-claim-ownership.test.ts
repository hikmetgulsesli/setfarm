// Genuine production functions, extracted without importing the spawner entry.
// All effect ports are synthetic: no DB, native process, timers, provider or live service.
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { EventEmitter } from "node:events";
import ts from "typescript";

const sourceFile = new URL("../src/spawner.ts", import.meta.url);
assert.ok(statSync(sourceFile).size < 2 * 1024 * 1024);
const source = readFileSync(sourceFile, "utf8");
const tree = ts.createSourceFile(sourceFile.pathname, source, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS);
function whole(name: string): string {
  const rows = tree.statements.filter((n): n is ts.FunctionDeclaration => ts.isFunctionDeclaration(n) && n.name?.text === name);
  assert.equal(rows.length, 1, `one genuine function ${name}`);
  return rows[0]!.getText(tree).replace(/^export\s+/, "");
}
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const claimAgent = "workflow_with_underscores_designer";
const runtimeAgent = "runtime_with_underscores";
const sessionId = "RTS_component-unique-session";
const owner = "component-owner";
const candidate = () => ({
  claim_id: "2", step_db_id: "step-db", step_id: "design", run_id: "run-original", run_number: 1,
  agent_id: claimAgent, claimed_at: "2020-01-01T00:00:00.000Z",
  pending_runtime_session_id: sessionId, pending_runtime_owner_instance_id: owner,
  pending_runtime_claim_agent_id: claimAgent, pending_runtime_agent_id: runtimeAgent,
});
type Candidate = ReturnType<typeof candidate>;
function component() {
  const claimEntered = deferred<void>(), claimResult = deferred<any>();
  const publicationEntered = deferred<void>(), publicationResult = deferred<any>();
  const runningEntered = deferred<void>(), runningResult = deferred<any>();
  const cleanupEntered = deferred<void>(), cleanupResult = deferred<void>();
  const activeProcesses = new Map<string, any>(), drainingProcesses = new Map<string, any>();
  const pendingDeclarations = tree.statements.filter((n): n is ts.VariableStatement =>
    ts.isVariableStatement(n) && n.declarationList.declarations.some(d => ts.isIdentifier(d.name) && d.name.text === "pendingClaimInvocations"));
  assert.equal(pendingDeclarations.length, 1, "genuine pending resource declaration");
  const pendingJs = ts.transpileModule(pendingDeclarations[0]!.getText(tree), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const pendingClaimInvocations = new Function(pendingJs + ";return pendingClaimInvocations;")() as Map<string, any>;
  const calls = { quiescence: [] as any[], retry: [] as any[], release: [] as any[], cleanup: 0, spawn: 0 };
  const state = { rows: [candidate()] as Candidate[], entryCalls: 0, refuseAt: 0, shutdownAfterClaim: false,
    deferCleanup: false, maintenanceError: false, quiescenceHook: undefined as undefined | (() => Promise<void>) };
  let query = "";
  const child = Object.assign(new EventEmitter(), { pid: 4242, exitCode: null, signalCode: null, stdin: { write() {}, end() {} } });
  const ports = {
    path, console: { log() {}, warn() {} }, pendingClaimInvocations,
    activeProcesses, drainingProcesses, claimingSpawns: new Set(), queuedSpawns: new Set(),
    task6aV2RetainedPostClaimRuntimes: new Map(), task6aV2UnboundPostClaimRefusals: 0,
    SPAWNER_INSTANCE_ID: owner, AGENT_RUNTIME: "codex", OPENCLAW_AGENT_LOCAL: false,
    MAX_CONCURRENT: 5, TRANSCRIPT_ROOT: "/inert/transcripts", AGENT_SAFE_CWD: "/inert/safe",
    SELECTED_SPAWNER_V1: {}, CODEX_CLI: "/inert/codex", AGENT_TIMEOUT_SECONDS: 60,
    process: { env: {} }, setTimeout() { return 1; }, clearTimeout() {},
    fs: { unlinkSync() {}, writeFileSync() {}, chmodSync() {}, mkdirSync() {}, appendFileSync() {}, openSync() { return 7; }, closeSync() {} },
    async assertSpawnerOperationalEntryV1() { if (++state.entryCalls === state.refuseAt) throw Error("INERT_ENTRY_REFUSAL"); },
    async shouldDeferBackgroundWorkflow() { return false; },
    buildSessionKey: () => "component-key", agentSessionJsonlPath: () => "/inert/session.jsonl", newRuntimeSessionId: () => sessionId,
    async claimStep(fullAgentId: string, agentId: string, intent: any) {
      assert.equal(fullAgentId, claimAgent); assert.equal(agentId, runtimeAgent);
      assert.equal(intent.sessionId, sessionId); assert.equal(intent.ownerInstanceId, owner);
      assert.equal(intent.runtimeAgentId, runtimeAgent);
      claimEntered.resolve(); const result = await claimResult.promise;
      if (state.shutdownAfterClaim) controls.setShuttingDown();
      return result;
    },
    safeAgentCwdFromClaimInput: () => "/inert/project", runtimeClaimEnvelope: () => ({ schema: "inert-envelope" }),
    async publishRuntimeCompletionProposal() { publicationEntered.resolve(); return publicationResult.promise; },
    async publishRuntimeCompletionIfPresent() { return true; },
    async releaseUntransferredPostClaimOwnership() { calls.cleanup++; cleanupEntered.resolve(); if (state.deferCleanup) await cleanupResult.promise; },
    claimRoleRequiresProjectCwd: () => false, buildClaimSummary: () => ({}), buildResolvedClaimBootstrapScript: () => "inert",
    claimTaskPreview: () => "inert", completeInlineSecurityGateIfApplicable: async () => false,
    recordSupervisorInfraEvent: async () => {},
    buildPreclaimedPrompt: () => "inert", getSql: () => ({}),
    createRuntimeSessionRepository: () => ({
      async findById() { return { sessionId, ownerInstanceId: owner, state: "reserved", stateVersion: 1 }; },
      async markStarting() { return { sessionId, ownerInstanceId: owner, state: "starting", stateVersion: 2 }; },
      async markRunning() { runningEntered.resolve(); return runningResult.promise; },
    }),
    buildAgentChildEnv: () => ({}), spawn() { calls.spawn++; return child; },
    observeProcessIdentity: () => ({ pid: 4242, processGroupId: 4242, source: "observed_os" }),
    fileSize: () => 0, readProcessCpuTicks: () => 0, terminateActiveProcess() {},
    ORPHANED_SINGLE_STEP_CLAIM_MS: 120_000, formatDurationMs: () => "old",
    async pgQuery(sql: string) { query = sql; if (state.maintenanceError) throw Error("INERT_QUERY_FAILURE"); return state.rows; },
    async waitForClaimRuntimeQuiescence(...args: any[]) { calls.quiescence.push(args); await state.quiescenceHook?.(); },
    async retrySingleStepClaimWithAuthority(value: any) { calls.retry.push(value); },
    async releaseReservedRuntimeForClaimIfPresent(...args: any[]) { calls.release.push(args); },
    isClaimMutationAuthorityError: () => false, childProcessTerminalReason: (value: any) => value.exitCode === null ? null : "exit",
    reapFinishedClaims: async () => {}, reconcileTerminalClaimRuntimeOwnership: async () => {},
    requeueOrphanedRunningStories: async () => {}, requeueUntrackedRunningLoopStoryClaims: async () => {},
  };
  const names = ["hasTrackedClaimRuntime", "trackedRuntimeCount", "recoveryDispatchClassForRole", "retainTask6aV2PostClaimRuntimeIfExact", "spawnAgentNow", "requeueUntrackedRunningSingleStepClaims", "runClaimMaintenance"];
  const code = names.map(name => whole(name)).join("\n") + whole("hasPendingClaimInvocation");
  const js = ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const controls = new Function(...Object.keys(ports), "let shuttingDown=false, claimMaintenanceInFlight=false;\n" + js +
    "; return {spawnAgentNow,requeueUntrackedRunningSingleStepClaims,runClaimMaintenance,setShuttingDown(){shuttingDown=true;}};")(...Object.values(ports));
  const found = () => ({ found: true, runtimeSessionId: sessionId, runtimeOwnerInstanceId: owner, claimId: 2,
    claimAgentId: claimAgent, runId: "run-original", stepId: "step-db", workflowStepId: "design", resolvedInput: "inert", compilerCompletionOutput: "compiler result" });
  return { ...controls, state, calls, pendingClaimInvocations, activeProcesses, drainingProcesses, child, found,
    claimEntered, claimResult, publicationEntered, publicationResult, runningEntered, runningResult, cleanupEntered, cleanupResult,
    query: () => query, start: () => controls.spawnAgentNow(runtimeAgent, "workflow_with_underscores", "designer") };
}
function noOrphanEffects(c: ReturnType<typeof component>) {
  assert.deepEqual(c.calls.quiescence, [], "still-awaited exact invocation must not be drained");
  assert.deepEqual(c.calls.retry, [], "still-awaited exact invocation must not be retried");
  assert.deepEqual(c.calls.release, [], "still-awaited exact invocation must not be released");
}

test("actual pending claimStep prevents false orphan drain/retry/release, then settles to ordinary recovery", async () => {
  const c = component(), invocation = c.start(); await c.claimEntered.promise;
  try {
    assert.deepEqual([...c.pendingClaimInvocations.values()], [{ sessionId, ownerInstanceId: owner, claimAgentId: claimAgent, runtimeAgentId: runtimeAgent }]);
    await c.requeueUntrackedRunningSingleStepClaims(); noOrphanEffects(c);
  } finally { c.claimResult.resolve({ found: false }); await invocation; }
  assert.equal(c.pendingClaimInvocations.size, 0);
  await c.requeueUntrackedRunningSingleStepClaims();
  assert.equal(c.calls.quiescence.length, 1); assert.equal(c.calls.retry.length, 1); assert.equal(c.calls.release.length, 1);
  assert.deepEqual(c.calls.quiescence[0], ["run-original", undefined, claimAgent]);
  assert.equal(c.calls.retry[0].claimAgentId, claimAgent); assert.equal(c.calls.release[0][0], 2);
});

test("actual compiler publication and postclaim cleanup retain invocation ownership until both settle", async () => {
  const c = component(); c.state.deferCleanup = true;
  const invocation = c.start(); await c.claimEntered.promise; c.claimResult.resolve(c.found());
  try {
    await c.publicationEntered.promise;
    await c.requeueUntrackedRunningSingleStepClaims(); noOrphanEffects(c);
    c.publicationResult.resolve({ managed: true });
    await c.cleanupEntered.promise;
    await c.requeueUntrackedRunningSingleStepClaims(); noOrphanEffects(c);
  } finally {
    c.publicationResult.resolve({ managed: true }); c.cleanupResult.resolve(); await invocation;
  }
  assert.equal(c.pendingClaimInvocations.size, 0); assert.equal(c.calls.spawn, 0);
  await c.requeueUntrackedRunningSingleStepClaims(); assert.equal(c.calls.retry.length, 1);
});

test("same-role unrelated session and every missing/mismatched durable tuple remain real orphans", async t => {
  for (const field of ["agent_id", "pending_runtime_session_id", "pending_runtime_owner_instance_id", "pending_runtime_claim_agent_id", "pending_runtime_agent_id"] as const) {
    for (const value of (field === "agent_id" ? ["unrelated"] : [null, "unrelated"])) await t.test(`${field}=${value}`, async () => {
      const c = component(), invocation = c.start(); await c.claimEntered.promise;
      Object.assign(c.state.rows[0]!, { [field]: value });
      if (field === "pending_runtime_session_id") c.state.rows[0]!.run_id = "another-run-same-role";
      try { await c.requeueUntrackedRunningSingleStepClaims(); assert.equal(c.calls.retry.length, 1); assert.equal(c.calls.release.length, 1); }
      finally { c.claimResult.resolve({ found: false }); await invocation; }
    });
  }
});

test("actual invocation cleanup covers rejection, no work, entry refusal, shutdown and mismatched publication", async t => {
  for (const mode of ["reject", "no-work", "entry-refusal", "shutdown", "mismatched-publication"]) await t.test(mode, async () => {
    const c = component(), invocation = c.start(); await c.claimEntered.promise;
    assert.equal(c.pendingClaimInvocations.size, 1, "invocation is owned before settlement");
    if (mode === "reject") c.claimResult.reject(Error("INERT_CLAIM_REJECT"));
    else if (mode === "no-work") c.claimResult.resolve({ found: false });
    else {
      if (mode === "entry-refusal") c.state.refuseAt = c.state.entryCalls + 1;
      if (mode === "shutdown") c.state.shutdownAfterClaim = true;
      const claim = c.found(); if (mode === "mismatched-publication") claim.runtimeOwnerInstanceId = "another-owner";
      c.claimResult.resolve(claim);
    }
    await invocation; assert.equal(c.pendingClaimInvocations.size, 0);
    await c.requeueUntrackedRunningSingleStepClaims(); assert.equal(c.calls.retry.length, 1);
  });
});

test("active and draining runtime transfer preserve existing protection after invocation cleanup", async t => {
  for (const status of ["running", "drain_requested"]) await t.test(status, async () => {
    const c = component(), invocation = c.start(); await c.claimEntered.promise;
    const claim = c.found(); delete (claim as any).compilerCompletionOutput; c.claimResult.resolve(claim);
    await c.runningEntered.promise;
    try { await c.requeueUntrackedRunningSingleStepClaims(); noOrphanEffects(c); }
    finally { c.runningResult.resolve({ status }); await invocation; }
    assert.equal(c.pendingClaimInvocations.size, 0); assert.equal(c.calls.cleanup, 0); assert.equal(c.calls.spawn, 1);
    await c.requeueUntrackedRunningSingleStepClaims(); noOrphanEffects(c);
  });
});

test("actual maintenance errors clear maintenance-in-flight without discarding pending invocation", async () => {
  const c = component(), invocation = c.start(); await c.claimEntered.promise;
  try {
    c.state.maintenanceError = true; await c.runClaimMaintenance();
    c.state.maintenanceError = false; await c.runClaimMaintenance(); noOrphanEffects(c);
  } finally { c.claimResult.resolve({ found: false }); await invocation; }
  await c.runClaimMaintenance(); assert.equal(c.calls.retry.length, 1);
});

test("compiler publication rejection and rejecting cleanup still release the exact invocation record", async () => {
  const c = component(); c.state.deferCleanup = true;
  const invocation = c.start(); await c.claimEntered.promise; c.claimResult.resolve(c.found());
  await c.publicationEntered.promise; c.publicationResult.reject(Error("INERT_PUBLICATION_FAILURE"));
  await c.cleanupEntered.promise;
  await c.requeueUntrackedRunningSingleStepClaims(); noOrphanEffects(c);
  c.cleanupResult.reject(Error("INERT_CLEANUP_FAILURE"));
  await assert.rejects(invocation, /INERT_CLEANUP_FAILURE/);
  assert.equal(c.pendingClaimInvocations.size, 0);
  await c.requeueUntrackedRunningSingleStepClaims(); assert.equal(c.calls.retry.length, 1);
});

test("settling invocation cannot delete a later record with the same session key", async () => {
  const c = component(), invocation = c.start(); await c.claimEntered.promise;
  const replacement = { sessionId, ownerInstanceId: "later-owner", claimAgentId: claimAgent, runtimeAgentId: runtimeAgent };
  c.pendingClaimInvocations.set(sessionId, replacement);
  c.claimResult.resolve({ found: false }); await invocation;
  assert.equal(c.pendingClaimInvocations.get(sessionId), replacement);
});

test("maintenance rechecks exact pending ownership after awaited quiescence before retry or release", async () => {
  const c = component(); let invocation!: Promise<void>;
  c.state.quiescenceHook = async () => { invocation = c.start(); await c.claimEntered.promise; };
  try {
    await c.requeueUntrackedRunningSingleStepClaims();
    assert.equal(c.calls.quiescence.length, 1, "quiescence began before this defensive late registration");
    assert.deepEqual(c.calls.retry, []); assert.deepEqual(c.calls.release, []);
  } finally { c.claimResult.resolve({ found: false }); await invocation; }
});

test("candidate SQL preserves completion/termination fences and joins exact durable claim identity", async () => {
  const c = component(); c.state.rows = []; await c.requeueUntrackedRunningSingleStepClaims();
  const sql = c.query();
  for (const predicate of ["pending_runtime.claim_id = cl.id", "pending_runtime.run_id = s.run_id", "pending_runtime.step_db_id = s.id", "pending_runtime.workflow_step_id = s.step_id", "pending_runtime.claim_agent_id = cl.agent_id"]) assert.ok(sql.includes(predicate), predicate);
  for (const projected of ["pending_runtime.session_id AS pending_runtime_session_id", "pending_runtime.owner_instance_id AS pending_runtime_owner_instance_id", "pending_runtime.claim_agent_id AS pending_runtime_claim_agent_id", "pending_runtime.runtime_agent_id AS pending_runtime_agent_id"]) assert.ok(sql.includes(projected), projected);
  assert.match(sql, /completion.state NOT IN \('accepted', 'rejected'\)/);
  assert.match(sql, /runtime.state = 'quarantined'/); assert.match(sql, /termination.state <> 'terminalized'/);
});
