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
function component(genuineRecovery = false) {
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
    deferCleanup: false, maintenanceError: false, quiescenceHook: undefined as undefined | (() => Promise<void>),
    maintenanceQueryHook: undefined as undefined | (() => Promise<void>),
    runtimeListHook: undefined as undefined | (() => Promise<void>),
    envelopeQueryHook: undefined as undefined | ((read: number) => Promise<void>), envelopeReads: 0,
    notifyHook: undefined as undefined | (() => Promise<void>), replacementRunId: "run-original" };
  const oldSessionId = "RTS_component-old-session";
  const claims = new Map<number, { id: number; open: boolean; agentId: string; runId: string }>([[2, { id: 2, open: true, agentId: claimAgent, runId: "run-original" }]]);
  const runtimes = new Map<string, any>([[oldSessionId, {
    sessionId: oldSessionId, claimId: 2, runId: "run-original", stepDbId: "step-db", workflowStepId: "design",
    claimAgentId: claimAgent, runtimeAgentId: runtimeAgent, ownerInstanceId: owner,
    state: "reserved", stateVersion: 1, runtimeKind: "local_process", heartbeatAt: "2020-01-01T00:00:00Z",
  }]]);
  const durableEffects = { requested: [] as number[], drained: [] as number[], retried: [] as number[], released: [] as number[], notifications: 0 };
  if (genuineRecovery) state.rows[0]!.pending_runtime_session_id = oldSessionId;
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
      if (genuineRecovery) {
        if (state.replacementRunId === "run-original") {
          claims.get(2)!.open = false; runtimes.get(oldSessionId)!.state = "released";
        }
        claims.set(3, { id: 3, open: true, agentId: fullAgentId, runId: state.replacementRunId });
        runtimes.set(intent.sessionId, { ...runtimes.get(oldSessionId), sessionId: intent.sessionId, claimId: 3, runId: state.replacementRunId, state: "reserved" });
      }
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
    async pgQuery(sql: string, params: any[] = []) {
      if (state.maintenanceError) throw Error("INERT_QUERY_FAILURE");
      if (!genuineRecovery || sql.includes("FROM steps s")) {
        query = sql; const selected = state.rows.map(row => ({ ...row }));
        await state.maintenanceQueryHook?.(); return selected;
      }
      assert.ok(sql.includes("cl.id::text AS claim_id") && sql.includes("FROM claim_log cl"), "bounded genuine envelope query only");
      const selected = [...claims.values()].filter(claim => claim.open && claim.runId === params[0] && (!params[4] || claim.agentId === params[4])
        && (params[5] == null || claim.id === params[5])).map(claim => ({
          claim_id: String(claim.id), claim_agent_id: claim.agentId, protocol: "legacy", packet_hash: null, claim_generation: null,
        }));
      if (params[5] != null) assert.match(sql, /cl\.id = \$6/);
      await state.envelopeQueryHook?.(++state.envelopeReads); return selected;
    },
    async waitForClaimRuntimeQuiescence(...args: any[]) { calls.quiescence.push(args); await state.quiescenceHook?.(); },
    async retrySingleStepClaimWithAuthority(value: any) { calls.retry.push(value); return true; },
    async recoverClaimEnvelopeFromDatabase(input: any) { return { claimId: input.expectedClaimId }; },
    async releaseReservedRuntimeForClaimIfPresent(...args: any[]) { calls.release.push(args); },
    isClaimMutationAuthorityError: () => false, childProcessTerminalReason: (value: any) => value.exitCode === null ? null : "exit",
    reapFinishedClaims: async () => {}, reconcileTerminalClaimRuntimeOwnership: async () => {},
    requeueOrphanedRunningStories: async () => {}, requeueUntrackedRunningLoopStoryClaims: async () => {},
  };
  if (genuineRecovery) {
    Object.assign(ports, {
      parseClaimEnvelope: (envelope: any) => envelope,
      async pgGet(sql: string, params: any[]) {
        if (sql.includes("FROM runtime_sessions WHERE claim_id = $1")) {
          const runtime = [...runtimes.values()].find(r => r.claimId === params[0]);
          return runtime ? { session_id: runtime.sessionId, owner_instance_id: runtime.ownerInstanceId, state: runtime.state } : undefined;
        }
        assert.ok(sql.includes("FROM claim_log"), "bounded genuine open-claim lookup only");
        if (params[3] != null) assert.match(sql, /id = \$4/);
        const claim = [...claims.values()].find(c => c.open && c.runId === params[0] && c.agentId === params[2] && (params[3] == null || c.id === params[3]));
        return claim ? { id: String(claim.id) } : undefined;
      },
      createRuntimeSessionRepository: () => ({
        async listRecoverable(input: any) { await state.runtimeListHook?.(); return [...runtimes.values()].filter(r => r.runId === input.runId && r.state !== "released").map(r => ({ ...r })); },
        async findById(id: string) { const runtime = runtimes.get(id); return runtime ? { ...runtime } : undefined; },
        async requestDrain(input: any) {
          const runtime = runtimes.get(input.sessionId)!;
          durableEffects.requested.push(runtime.claimId); runtime.state = "drain_requested"; return { ...runtime };
        },
      }),
      async drainDurableRuntimeSession(runtime: any) { durableEffects.drained.push(runtime.claimId); runtimes.get(runtime.sessionId)!.state = "drained"; },
      async failStep(_stepId: string, _diagnostic: string, envelope: any, options: any) {
        assert.equal(options.recoveryAuthority, "orphan_recovery");
        const claim = claims.get(envelope.claimId);
        // Inert mutation-authority port rejects the exact closed envelope; it
        // deliberately accepts a valid current C2 envelope, exposing broad recovery.
        if (!claim?.open) throw Object.assign(Error("INERT_EXACT_CLAIM_CLOSED"), { authority: true });
        durableEffects.retried.push(envelope.claimId); claim.open = false;
      },
      async pgRun(sql: string) { assert.ok(sql.includes("pg_notify")); durableEffects.notifications++; await state.notifyHook?.(); },
      async pgBegin(action: (sql: any) => Promise<void>) { return action({}); },
      async releaseReservedRuntimeSessionInTransaction(_sql: any, input: any) {
        const runtime = runtimes.get(input.sessionId)!; assert.equal(runtime.claimId, input.claimId);
        durableEffects.released.push(input.claimId); runtime.state = "released";
      },
      async releaseDrainedRuntimeSessionInTransaction(_sql: any, input: any) {
        const runtime = runtimes.get(input.sessionId)!; assert.equal(runtime.claimId, input.claimId);
        durableEffects.released.push(input.claimId); runtime.state = "released";
      },
      isClaimMutationAuthorityError: (error: any) => error?.authority === true,
    });
  }
  const names = ["hasTrackedClaimRuntime", "trackedRuntimeCount", "recoveryDispatchClassForRole", "retainTask6aV2PostClaimRuntimeIfExact", "spawnAgentNow", "requeueUntrackedRunningSingleStepClaims", "runClaimMaintenance"];
  if (genuineRecovery) names.push("waitForClaimRuntimeQuiescence", "recoverClaimEnvelopeFromDatabase", "retrySingleStepClaimWithAuthority", "releaseReservedRuntimeForClaimIfPresent");
  const code = names.map(name => whole(name)).join("\n") + whole("hasPendingClaimInvocation");
  const bindings = Object.keys(ports).filter(name => !names.includes(name));
  const js = ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const controls = new Function(...bindings, "let shuttingDown=false, claimMaintenanceInFlight=false;\n" + js +
    "; return {spawnAgentNow,requeueUntrackedRunningSingleStepClaims,runClaimMaintenance,waitForClaimRuntimeQuiescence,retrySingleStepClaimWithAuthority,setShuttingDown(){shuttingDown=true;}};")(...bindings.map(key => ports[key as keyof typeof ports]));
  const found = () => ({ found: true, runtimeSessionId: sessionId, runtimeOwnerInstanceId: owner, claimId: 2,
    claimAgentId: claimAgent, runId: "run-original", stepId: "step-db", workflowStepId: "design", resolvedInput: "inert", compilerCompletionOutput: "compiler result" });
  return { ...controls, state, calls, claims, runtimes, durableEffects, pendingClaimInvocations, activeProcesses, drainingProcesses, child, found,
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
  assert.deepEqual(c.calls.quiescence[0], ["run-original", undefined, claimAgent, undefined, 2]);
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


test("stale C1 maintenance never targets pending replacement C2 through genuine recovery helpers", async t => {
  for (const boundary of ["before-first-effect", "during-candidate-envelope-await", "during-quiescence-list-await"]) await t.test(boundary, async () => {
    const c = component(true); let invocation!: Promise<void>;
    const replace = async () => { invocation = c.start(); await c.claimEntered.promise; };
    if (boundary === "before-first-effect") c.state.maintenanceQueryHook = replace;
    else if (boundary === "during-candidate-envelope-await") c.state.envelopeQueryHook = async read => { if (read === 1) await replace(); };
    else c.state.runtimeListHook = replace;
    try {
      await c.requeueUntrackedRunningSingleStepClaims();
      assert.ok(c.pendingClaimInvocations.has(sessionId), "actual C2 claimStep remains awaited");
      assert.deepEqual(c.durableEffects, { requested: [], drained: [], retried: [], released: [], notifications: 0 },
        "stale C1 must abandon recovery instead of draining/retrying/releasing pending C2");
      assert.equal(c.claims.get(3)?.open, true); assert.equal(c.runtimes.get(sessionId)?.state, "reserved");
    } finally { c.claimResult.resolve({ found: false }); await invocation; }
  });
});

test("genuine exact recovery helpers retain ordinary C1 orphan recovery and legacy broad callers", async t => {
  await t.test("maintenance genuine orphan", async () => {
    const c = component(true); await c.requeueUntrackedRunningSingleStepClaims();
    assert.deepEqual(c.durableEffects, { requested: [2], drained: [2], retried: [2], released: [2], notifications: 1 });
  });
  await t.test("legacy helper signature", async () => {
    const c = component(true);
    await c.waitForClaimRuntimeQuiescence("run-original", undefined, claimAgent);
    await c.retrySingleStepClaimWithAuthority({ runId: "run-original", stepDbId: "step-db", workflowStepId: "design", claimAgentId: claimAgent, runtimeAgentId: runtimeAgent, diagnostic: "inert legacy recovery" });
    assert.deepEqual(c.durableEffects, { requested: [2], drained: [2], retried: [2], released: [], notifications: 1 });
  });
});


test("replacement across retry authority and release awaits cannot change recovery target from C1 to C2", async t => {
  for (const boundary of ["retry-envelope-await", "post-retry-notification-await"]) await t.test(boundary, async () => {
    const c = component(true); let invocation!: Promise<void>;
    const replace = async () => { invocation = c.start(); await c.claimEntered.promise; };
    if (boundary === "retry-envelope-await") c.state.envelopeQueryHook = async read => { if (read === 2) await replace(); };
    else c.state.notifyHook = replace;
    try {
      await c.requeueUntrackedRunningSingleStepClaims();
      assert.ok(c.pendingClaimInvocations.has(sessionId));
      for (const effect of ["requested", "drained", "retried", "released"] as const) assert.ok(!c.durableEffects[effect].includes(3), `${effect} never targets C2`);
      assert.equal(c.claims.get(3)?.open, true); assert.equal(c.runtimes.get(sessionId)?.state, "reserved");
      assert.deepEqual(c.durableEffects.retried, boundary === "retry-envelope-await" ? [] : [2]);
    } finally { c.claimResult.resolve({ found: false }); await invocation; }
  });
});

test("exact helper rejects a supplied replacement envelope instead of accepting its valid authority", async () => {
  const c = component(true);
  const retried = await c.retrySingleStepClaimWithAuthority({
    runId: "run-original", stepDbId: "step-db", workflowStepId: "design", claimAgentId: claimAgent,
    runtimeAgentId: runtimeAgent, diagnostic: "stale C1", expectedClaimId: 2, envelope: { claimId: 3 },
  });
  assert.equal(retried, false); assert.deepEqual(c.durableEffects.retried, []);
});

test("genuine helper recovery remains exact with absent C1 runtime or unrelated same-role C2", async t => {
  for (const missing of [false, true]) await t.test(`missing C1 runtime=${missing}`, async () => {
    const c = component(true); c.state.replacementRunId = "another-run-same-role";
    const invocation = c.start(); await c.claimEntered.promise;
    if (missing) c.runtimes.delete("RTS_component-old-session");
    try {
      if (missing) await assert.rejects(c.requeueUntrackedRunningSingleStepClaims(), /RUNTIME_QUIESCENCE_OWNER_MISSING:2/);
      else await c.requeueUntrackedRunningSingleStepClaims();
      for (const effect of ["requested", "drained", "retried", "released"] as const) assert.ok(!c.durableEffects[effect].includes(3), `${effect} never targets unrelated C2`);
      assert.deepEqual(c.durableEffects.retried, missing ? [] : [2]);
      assert.equal(c.claims.get(3)?.open, true); assert.equal(c.runtimes.get(sessionId)?.state, "reserved");
    } finally { c.claimResult.resolve({ found: false }); await invocation; }
  });
});

test("exact quiescence also excludes an in-memory draining replacement C2", async () => {
  const c = component(true), invocation = c.start(); await c.claimEntered.promise;
  c.drainingProcesses.set(sessionId, {
    runId: "run-original", claimAgentId: claimAgent, claimId: 3,
    runtimeSessionId: sessionId, runtimeOwnerInstanceId: owner, child: c.child, sessionKey: "replacement-session-key",
  });
  try {
    await c.waitForClaimRuntimeQuiescence("run-original", undefined, claimAgent, undefined, 2);
    assert.deepEqual(c.durableEffects, { requested: [], drained: [], retried: [], released: [], notifications: 0 });
    assert.equal(c.runtimes.get(sessionId)?.state, "reserved");
  } finally { c.claimResult.resolve({ found: false }); await invocation; }
});

test("existing gateway single-step recovery contract callback remains valid through inert extraction", () => {
  const gatewayFile = new URL("./spawner-gateway-recovery.test.ts", import.meta.url);
  assert.ok(statSync(gatewayFile).size < 2 * 1024 * 1024, "bounded existing test Source read");
  const gatewaySource = readFileSync(gatewayFile, "utf8");
  const gatewayTree = ts.createSourceFile(gatewayFile.pathname, gatewaySource, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS);
  const callbacks: ts.ArrowFunction[] = [];
  const title = "retries running single-step claims that are no longer tracked by the spawner";
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "it"
      && node.arguments[0] && ts.isStringLiteral(node.arguments[0]) && node.arguments[0].text === title) {
      assert.equal(node.arguments.length, 2);
      const callback = node.arguments[1]; assert.ok(callback && ts.isArrowFunction(callback)); callbacks.push(callback);
    }
    ts.forEachChild(node, visit);
  }
  visit(gatewayTree); assert.equal(callbacks.length, 1, "one complete existing genuine callback");
  const js = ts.transpileModule("const callback = " + callbacks[0]!.getText(gatewayTree) + ";", {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
  const readonlyFs = { readFileSync(file: string, encoding: BufferEncoding) {
    assert.equal(file, sourceFile.pathname, "existing callback may read only the admitted spawner Source");
    return readFileSync(file, encoding);
  } };
  const callback = new Function("fs", "path", "root", "assert", js + ";return callback;")(
    readonlyFs, path, path.resolve(import.meta.dirname, ".."), assert,
  ) as () => void;
  callback();
});
