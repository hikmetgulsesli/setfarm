import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";
import { preserveActionableStoryRetryOutput } from "../src/installer/retry-output.ts";

const root = path.resolve(import.meta.dirname, "..");

function claimSingleStepSource(): string {
  const source = fs.readFileSync(path.join(root, "src", "installer", "step-ops.ts"), "utf-8");
  const start = source.indexOf("async function claimSingleStep(");
  const end = source.indexOf("// ── End extracted helpers", start);
  assert.notEqual(start, -1, "claimSingleStep source not found");
  assert.notEqual(end, -1, "claimSingleStep end marker not found");
  return source.slice(start, end);
}

function v3StageRetryClaimProjectionSource(): string {
  const source = claimSingleStepSource();
  const start = source.indexOf("type PreviousStageFailureRow = {");
  const end = source.indexOf("let shouldRecordSingleStepTransition", start);
  assert.notEqual(start, -1, "V3 stage retry row projection not found");
  assert.notEqual(end, -1, "V3 stage retry projection end not found");
  return source.slice(start, end);
}

function assertV3StageRetryClaimProjectionAuthority(source: string): void {
  assert.match(source, /claim_id: string/);
  assert.match(source, /SELECT cl\.id::text AS claim_id/);
  assert.match(source, /const previousClaimId = Number\(row\.claim_id\)/);
  assert.match(source, /Number\.isSafeInteger\(previousClaimId\)/);
  assert.match(source, /previousClaimId > 0/);
  assert.match(source, /String\(previousClaimId\) === row\.claim_id/);
  assert.match(source, /previousClaimIds\.some\(\(claimId\) => claimId === null\)/);
  assert.match(source, /previousClaimId: previousClaimIds\[index\]!/);
}

function stepOpsSource(): string {
  return fs.readFileSync(path.join(root, "src", "installer", "step-ops.ts"), "utf-8");
}

function v3PreDispatchFailureOwnerSource(): string {
  return fs.readFileSync(path.join(root, "src", "installer", "v3-pre-dispatch-failure.ts"), "utf-8");
}

function claimRuntimePublicationSource(): string {
  return fs.readFileSync(path.join(root, "src", "execution", "claim-runtime-publication.ts"), "utf-8");
}

function stepAdvanceSource(): string {
  return fs.readFileSync(path.join(root, "src", "installer", "step-advance.ts"), "utf-8");
}

function repoSource(): string {
  return fs.readFileSync(path.join(root, "src", "installer", "repo.ts"), "utf-8");
}

function cliSource(): string {
  return fs.readFileSync(path.join(root, "src", "cli", "cli.ts"), "utf-8");
}

function runWorkflowSource(): string {
  const source = fs.readFileSync(path.join(root, "src", "installer", "run.ts"), "utf-8");
  const start = source.indexOf("export async function runWorkflow(");
  const end = source.indexOf("\nexport async function ", start + 1);
  assert.notEqual(start, -1, "runWorkflow source not found");
  assert.notEqual(end, -1, "runWorkflow end not found");
  return source.slice(start, end);
}

function runningSingleStepClaimReissueSource(): string {
  const source = stepOpsSource();
  const start = source.indexOf("async function authenticateRunningSingleStepClaimReissueV1(");
  const end = source.indexOf("\nasync function claimSingleStep(", start);
  assert.notEqual(start, -1, "running single-step claim reissue source not found");
  assert.notEqual(end, -1, "running single-step claim reissue end not found");
  return source.slice(start, end);
}

function loadRunWorkflowPrivate(input: Readonly<Record<string, unknown>>): (params: Readonly<{
  workflowId: string;
  taskTitle: string;
  compilerReleaseSha: string;
}>) => Promise<unknown> {
  const javascript = ts.transpileModule(
    runWorkflowSource().replace("export async function runWorkflow", "async function runWorkflow"),
    {
      compilerOptions: {
        module: ts.ModuleKind.None,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  const names = Object.keys(input);
  const factory = new Function(...names, `${javascript}\nreturn runWorkflow;`) as (
    ...parameters: unknown[]
  ) => (params: Readonly<{
    workflowId: string;
    taskTitle: string;
    compilerReleaseSha: string;
  }>) => Promise<unknown>;
  return factory(...names.map((name) => input[name]));
}

function spawnerSource(): string {
  return fs.readFileSync(path.join(root, "src", "spawner.ts"), "utf-8");
}

function handleStepPendingSource(): string {
  const source = spawnerSource();
  const start = source.indexOf("async function handleStepPending(");
  const end = source.indexOf("async function handleStoryPending(", start);
  assert.notEqual(start, -1, "handleStepPending source not found");
  assert.notEqual(end, -1, "handleStepPending end not found");
  return source.slice(start, end);
}

type StepPendingPrivateModuleV1 = Readonly<{
  handleStepPending(payload: Readonly<{
    agentId: string;
    runId: string;
    stepId: string;
    runOwnerReservationRef?: string;
    runOwnerReservationHash?: string;
  }>): Promise<void>;
  listenForStepPending(listener: Readonly<{
    listen(channel: string, handler: (message: string) => void): Promise<void>;
  }>): Promise<void>;
}>;

function loadStepPendingPrivateModule(input: Readonly<{
  resolvePair?: (pair: unknown) => Promise<unknown>;
  recoverPair?: (locator: unknown) => Promise<unknown>;
  pgGet?: (query: string, parameters: readonly unknown[]) => Promise<unknown>;
  spawnAgent?: (...parameters: unknown[]) => unknown;
  errors?: string[];
}> = {}): StepPendingPrivateModuleV1 {
  const source = handleStepPendingSource();
  assert.match(source, /async function listenForStepPending\(/, "private listener adapter must exist");
  const javascript = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.None,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const errors = input.errors ?? [];
  const factory = new Function(
    "resolveBoundInternalProductionWorkflowRunOwnerV1",
    "recoverBoundInternalProductionWorkflowRunOwnerV1",
    "pgGet",
    "loadWorkflowSpec",
    "resolveWorkflowDir",
    "resolveAgentId",
    "spawnAgent",
    "console",
    "shuttingDown",
    `${javascript}\nreturn { handleStepPending, listenForStepPending };`,
  ) as (...parameters: unknown[]) => StepPendingPrivateModuleV1;
  return factory(
    input.resolvePair ?? (async () => ({
      schema: "setfarm.internal-production-bound-owner-reservation.v1",
      category: "run",
      ownerKey: "run-owner",
      producerImplementationId: "a-runtime-run-v1",
      reservationRef: "setfarm://internal-production/owner-reservation/run/sha256/" + "1".repeat(64),
      reservationHash: "1".repeat(64),
      bindingRef: "setfarm://internal-production/owner-binding/run/sha256/" + "2".repeat(64),
      bindingHash: "2".repeat(64),
    })),
    input.recoverPair ?? (async () => ({
      schema: "setfarm.internal-production-bound-owner-reservation.v1",
      category: "run",
      ownerKey: "run-owner",
      producerImplementationId: "a-runtime-run-v1",
      reservationRef: "setfarm://internal-production/owner-reservation/run/sha256/" + "1".repeat(64),
      reservationHash: "1".repeat(64),
      bindingRef: "setfarm://internal-production/owner-binding/run/sha256/" + "2".repeat(64),
      bindingHash: "2".repeat(64),
    })),
    input.pgGet ?? (async (query: string) => query.includes("FROM runs")
      ? { workflow_id: "feature-dev" }
      : { type: "single", loop_config: null }),
    async () => ({ agent_mapping: {} }),
    (workflowId: string) => `/fixtures/${workflowId}`,
    () => ["feature-dev_developer"],
    input.spawnAgent ?? (() => undefined),
    {
      error: (...parameters: unknown[]) => errors.push(parameters.map(String).join(" ")),
      log: () => undefined,
      warn: () => undefined,
    },
    false,
  );
}

function handleVerifyEachSource(): string {
  const source = fs.readFileSync(path.join(root, "src", "installer", "step-ops.ts"), "utf-8");
  const start = source.indexOf("async function handleVerifyEachCompletion(");
  const end = source.indexOf("async function autoVerifyDoneStories(", start);
  assert.notEqual(start, -1, "handleVerifyEachCompletion source not found");
  assert.notEqual(end, -1, "handleVerifyEachCompletion end marker not found");
  return source.slice(start, end);
}


function autoVerifyDoneStoriesSource(): string {
  const source = fs.readFileSync(path.join(root, "src", "installer", "step-ops.ts"), "utf-8");
  const start = source.indexOf("export async function autoVerifyDoneStories(");
  assert.notEqual(start, -1, "autoVerifyDoneStories source not found");
  return source.slice(start);
}

function implementContextSource(): string {
  const source = fs.readFileSync(path.join(root, "src", "installer", "steps", "06-implement", "context.ts"), "utf-8");
  const start = source.indexOf("export async function injectStoryContext(");
  const end = source.indexOf("// ── Internal helpers", start);
  assert.notEqual(start, -1, "extracted injectStoryContext not found");
  assert.notEqual(end, -1, "extracted injectStoryContext end not found");
  return source.slice(start, end);
}

function claimStepSelectionSource(): string {
  const source = fs.readFileSync(path.join(root, "src", "installer", "step-ops.ts"), "utf-8");
  const start = source.indexOf("const step = await pgGet<StepRow>(");
  const end = source.indexOf("if (!step) return { found: false };", start);
  assert.notEqual(start, -1, "claimStep selection source not found");
  assert.notEqual(end, -1, "claimStep selection end not found");
  return source.slice(start, end);
}

function peekStepSource(): string {
  const source = fs.readFileSync(path.join(root, "src", "installer", "step-ops.ts"), "utf-8");
  const start = source.indexOf("export async function peekStep(");
  const end = source.indexOf("// ── Claim", start);
  assert.notEqual(start, -1, "peekStep source not found");
  assert.notEqual(end, -1, "peekStep end not found");
  return source.slice(start, end);
}

function claimImplementLoopSource(): string {
  const source = fs.readFileSync(path.join(root, "src", "installer", "step-ops.ts"), "utf-8");
  const start = source.indexOf("// pr-each means strict serial delivery");
  const end = source.indexOf("// Story selection + claim must be atomic", start);
  assert.notEqual(start, -1, "claim implement verifyEach wait source not found");
  assert.notEqual(end, -1, "claim implement verifyEach wait end not found");
  return source.slice(start, end);
}

function autoCompleteStoriesWithPRsSource(): string {
  const source = fs.readFileSync(path.join(root, "src", "installer", "step-ops.ts"), "utf-8");
  const start = source.indexOf("async function autoCompleteStoriesWithPRs(");
  const end = source.indexOf("async function resolveStoryScreens(", start);
  assert.notEqual(start, -1, "autoCompleteStoriesWithPRs source not found");
  assert.notEqual(end, -1, "autoCompleteStoriesWithPRs end not found");
  return source.slice(start, end);
}

function injectSuperviseEachContextSource(): string {
  const source = fs.readFileSync(path.join(root, "src", "installer", "step-ops.ts"), "utf-8");
  const start = source.indexOf("async function injectSuperviseEachContext(");
  const end = source.indexOf("/**\n * Claim a single", start);
  assert.notEqual(start, -1, "injectSuperviseEachContext source not found");
  assert.notEqual(end, -1, "injectSuperviseEachContext end not found");
  return source.slice(start, end);
}

function injectVerifyContextSource(): string {
  const source = fs.readFileSync(path.join(root, "src", "installer", "step-ops.ts"), "utf-8");
  const start = source.indexOf("async function injectVerifyContext(");
  const end = source.indexOf("async function injectSuperviseEachContext(", start);
  assert.notEqual(start, -1, "injectVerifyContext source not found");
  assert.notEqual(end, -1, "injectVerifyContext end not found");
  return source.slice(start, end);
}

function previousStepSelectionBypassSource(source: string): string {
  const marker = source.indexOf("SELECT 1 FROM steps prev");
  assert.notEqual(marker, -1, "previous-step selection bypass source not found");
  const start = source.lastIndexOf("AND NOT EXISTS", marker);
  assert.notEqual(start, -1, "previous-step selection bypass start not found");
  const endCandidates = [
    source.indexOf("ORDER BY", marker),
    source.indexOf("AND (\n          (", marker),
  ].filter((idx) => idx > marker);
  const end = endCandidates.length > 0 ? Math.min(...endCandidates) : Math.min(source.length, marker + 2200);
  return source.slice(start, end);
}

describe("single-step claim_log lifecycle", () => {
  it("installer publishes only the committed run owner pair", () => {
    const source = runWorkflowSource();
    const persistence = source.indexOf("const persisted = await persistWorkflowRun({");
    const persistenceEnd = source.indexOf("\n  });", persistence);
    const notification = source.indexOf("const payload = JSON.stringify({", persistence);
    const workspaceCleanup = source.indexOf("cleanAgentWorkspace(agentId)");
    const cronPrerequisite = source.indexOf("await ensureWorkflowCrons(workflow)");
    assert.notEqual(persistence, -1, "installer must await the public committed persistence result");
    assert.notEqual(persistenceEnd, -1, "installer persistence call end not found");
    assert.notEqual(notification, -1, "installer step_pending payload not found");
    assert.ok(workspaceCleanup < cronPrerequisite, "workspace cleanup must precede the cron prerequisite");
    assert.ok(cronPrerequisite < persistence, "cron prerequisite must complete before run publication");
    assert.ok(persistence < notification, "notification must be constructed after committed persistence");
    assert.doesNotMatch(source.slice(Math.max(0, persistence - 120), persistenceEnd), /pgBegin/);
    const payload = source.slice(notification, source.indexOf("});", notification) + 3);
    assert.match(payload, /agentId:/);
    assert.match(payload, /runId,/);
    assert.match(payload, /stepId:/);
    assert.match(payload, /runOwnerReservationRef: persisted\.runOwnerReservationRef/);
    assert.match(payload, /runOwnerReservationHash: persisted\.runOwnerReservationHash/);
    assert.doesNotMatch(source, /unclaimedBootstrapFailure/);
    assert.doesNotMatch(source, /transitionRunToTerminalInTransaction/);
  });

  it("installer completes cron prerequisites before a run owner becomes poll-visible", async () => {
    const inventory = { runs: 0, steps: 0, owners: 0 };
    const calls: string[] = [];
    let enterCron!: () => void;
    let failCron!: (error: Error) => void;
    const cronEntered = new Promise<void>((resolve) => { enterCron = resolve; });
    const cronBlocked = new Promise<void>((_resolve, reject) => { failCron = reject; });
    let uuid = 0;
    const runWorkflow = loadRunWorkflowPrivate({
      resolveNewRunProtocol: () => ({ mode: "legacy", version: 1 }),
      resolveWorkflowDir: () => "/fixtures/feature-dev",
      loadWorkflowSpec: async () => ({
        id: "feature-dev",
        context: {},
        notifications: {},
        steps: [{ id: "implement", agent: "developer", input: "task", expects: "result" }],
      }),
      now: () => "2026-08-21T00:00:00.000Z",
      crypto: { randomUUID: () => `uuid-${++uuid}` },
      parseStackPrefix: () => null,
      os: { homedir: () => "/fixtures/home" },
      pgNextRunNumber: async () => 1,
      pgGet: async () => null,
      cleanAgentWorkspace: () => calls.push("clean"),
      ensureWorkflowCrons: async () => {
        calls.push("cron");
        enterCron();
        return cronBlocked;
      },
      persistWorkflowRun: async (value: { run: Record<string, unknown>; steps: unknown[] }) => {
        calls.push("persist");
        inventory.runs += 1;
        inventory.steps += value.steps.length;
        inventory.owners += 1;
        return {
          run: {
            id: value.run.id,
            runNumber: value.run.runNumber,
            workflowId: value.run.workflowId,
            task: value.run.task,
            status: "running",
            protocol: "legacy",
            protocolVersion: 1,
          },
          runOwnerReservationRef: `setfarm://internal-production/owner-reservation/run/sha256/${"1".repeat(64)}`,
          runOwnerReservationHash: "1".repeat(64),
        };
      },
      refreshRunContractSafe: async () => calls.push("refresh"),
      emitEvent: () => calls.push("event"),
      pgRun: async () => calls.push("notify"),
      logger: { info: () => undefined, warn: () => undefined },
      pgBegin: async (callback: (sql: unknown) => Promise<void>) => callback({}),
      transitionRunToTerminalInTransaction: async () => calls.push("terminalize"),
    });
    const spawns: string[] = [];
    const spawner = loadStepPendingPrivateModule({
      recoverPair: async () => {
        if (inventory.owners !== 1) throw new Error("INTERNAL_PRODUCTION_WORKFLOW_RUN_OWNER_UNAVAILABLE");
        return {
          category: "run",
          ownerKey: "uuid-1",
          producerImplementationId: "a-runtime-run-v1",
        };
      },
      pgGet: async (query) => query.includes("FROM runs")
        ? (inventory.runs === 1 ? { workflow_id: "feature-dev" } : null)
        : (inventory.steps === 1 ? { type: "single", loop_config: null } : null),
      spawnAgent: () => spawns.push("spawn"),
    });

    const pendingRun = runWorkflow({
      workflowId: "feature-dev",
      taskTitle: "race fixture",
      compilerReleaseSha: "a".repeat(40),
    });
    await cronEntered;
    let pollFailure: unknown;
    try {
      await spawner.handleStepPending({
        agentId: "feature-dev_developer",
        runId: "uuid-1",
        stepId: "implement",
      });
    } catch (error) {
      pollFailure = error;
    }
    failCron(new Error("fixture cron failure"));
    await assert.rejects(pendingRun, /Cannot start workflow run: cron setup failed/);

    assert.match(String(pollFailure), /INTERNAL_PRODUCTION_WORKFLOW_RUN_OWNER_UNAVAILABLE/);
    assert.deepEqual(spawns, []);
    assert.deepEqual(inventory, { runs: 0, steps: 0, owners: 0 });
    assert.deepEqual(calls, ["clean", "cron"]);
  });

  it("spawner authenticates or recovers the exact bound run owner before work", () => {
    const source = spawnerSource();
    const handler = handleStepPendingSource();
    const pairResolution = handler.indexOf("resolveBoundInternalProductionWorkflowRunOwnerV1({");
    const locatorRecovery = handler.indexOf("recoverBoundInternalProductionWorkflowRunOwnerV1({ runId })");
    const firstRead = handler.indexOf("pgGet<");
    const spawn = handler.indexOf("spawnAgent(");
    assert.notEqual(pairResolution, -1, "notification pair must use the full pair resolver");
    assert.notEqual(locatorRecovery, -1, "polling must use the stored sidecar locator");
    assert.ok(pairResolution < firstRead && locatorRecovery < firstRead, "owner authentication must precede workflow reads");
    assert.ok(firstRead < spawn, "owner authentication and reads must precede spawn");
    assert.match(handler, /SPAWNER_RUN_OWNER_PAIR_INCOMPLETE/);
    assert.match(handler, /SPAWNER_RUN_OWNER_IDENTITY_INVALID/);
    assert.doesNotMatch(source, /beginOrAdoptInternalProductionOwnerReservationV1/);
    assert.doesNotMatch(source, /bindInternalProductionOwnerReservationV1/);
    assert.doesNotMatch(source, /internal_production_owner_reservations_v1/);
    assert.match(source, /void handleStepPending\(parsed\)\.catch\(logStepPendingRejection\)/);
    assert.match(source, /\[redacted-ref\]/);
    assert.match(source, /\[redacted-sha256\]/);
  });

  it("P4 spawner admits only ordinary or authenticated recovery source bootstrap run owners", () => {
    const handler = handleStepPendingSource();
    assert.match(handler, /producerImplementationId !== "a-runtime-run-v1"/);
    assert.match(handler, /producerImplementationId !== "a-recovery-source-bootstrap-run-v1"/);
    const authentication = handler.indexOf("resolveBoundInternalProductionWorkflowRunOwnerV1({");
    const firstRead = handler.indexOf("pgGet<");
    assert.ok(authentication >= 0 && authentication < firstRead);
    assert.doesNotMatch(handler, /includes\(boundRunOwner\.producerImplementationId\)/);
  });

  it("private step_pending handler authenticates notification pairs and recovers notification loss", async () => {
    const calls: string[] = [];
    const resolverInputs: unknown[] = [];
    const recoveryInputs: unknown[] = [];
    const module = loadStepPendingPrivateModule({
      resolvePair: async (input) => {
        calls.push("resolve-pair");
        resolverInputs.push(input);
        return {
          category: "run",
          ownerKey: "run-owner",
          producerImplementationId: "a-runtime-run-v1",
        };
      },
      recoverPair: async (input) => {
        calls.push("recover-pair");
        recoveryInputs.push(input);
        return {
          category: "run",
          ownerKey: "run-owner",
          producerImplementationId: "a-runtime-run-v1",
        };
      },
      pgGet: async (query) => {
        calls.push("read");
        return query.includes("FROM runs")
          ? { workflow_id: "feature-dev" }
          : { type: "single", loop_config: null };
      },
      spawnAgent: () => calls.push("spawn"),
    });
    const pair = {
      agentId: "feature-dev_developer",
      runId: "run-owner",
      stepId: "implement",
      runOwnerReservationRef: `setfarm://internal-production/owner-reservation/run/sha256/${"1".repeat(64)}`,
      runOwnerReservationHash: "1".repeat(64),
    };

    await module.handleStepPending(pair);
    assert.deepEqual(calls, ["resolve-pair", "read", "read", "spawn"]);
    assert.deepEqual(resolverInputs, [{
      runOwnerReservationRef: pair.runOwnerReservationRef,
      runOwnerReservationHash: pair.runOwnerReservationHash,
    }]);
    calls.length = 0;
    await module.handleStepPending({ agentId: pair.agentId, runId: pair.runId, stepId: pair.stepId });
    assert.deepEqual(calls, ["recover-pair", "read", "read", "spawn"]);
    assert.deepEqual(recoveryInputs, [{ runId: pair.runId }]);

    for (const invalid of [
      { ...pair, runOwnerReservationHash: undefined },
      { ...pair, runOwnerReservationRef: undefined },
    ]) {
      calls.length = 0;
      await assert.rejects(module.handleStepPending(invalid), /SPAWNER_RUN_OWNER_PAIR_INCOMPLETE/);
      assert.deepEqual(calls, []);
    }

    calls.length = 0;
    const crossed = loadStepPendingPrivateModule({
      resolvePair: async () => {
        calls.push("resolve-pair");
        return {
          category: "run",
          ownerKey: "different-run",
          producerImplementationId: "a-runtime-run-v1",
        };
      },
      pgGet: async () => {
        calls.push("read");
        return null;
      },
      spawnAgent: () => calls.push("spawn"),
    });
    await assert.rejects(crossed.handleStepPending(pair), /SPAWNER_RUN_OWNER_IDENTITY_INVALID/);
    assert.deepEqual(calls, ["resolve-pair"]);

    calls.length = 0;
    const tampered = loadStepPendingPrivateModule({
      resolvePair: async () => {
        calls.push("resolve-pair");
        throw new Error("INTERNAL_PRODUCTION_OWNER_RESERVATION_CORRUPTION");
      },
      pgGet: async () => {
        calls.push("read");
        return null;
      },
      spawnAgent: () => calls.push("spawn"),
    });
    await assert.rejects(
      tampered.handleStepPending(pair),
      /INTERNAL_PRODUCTION_OWNER_RESERVATION_CORRUPTION/,
    );
    assert.deepEqual(calls, ["resolve-pair"]);
  });

  it("private step_pending listener fails closed with bounded redacted diagnostics", async () => {
    const rawHash = "a".repeat(64);
    const rawRef = `setfarm://internal-production/owner-reservation/run/sha256/${rawHash}`;
    const errors: string[] = [];
    const work: string[] = [];
    let listener: ((message: string) => void) | undefined;
    const module = loadStepPendingPrivateModule({
      errors,
      resolvePair: async () => {
        throw new Error(`forged ${rawRef} ${rawHash} ${"x".repeat(600)}`);
      },
      pgGet: async () => {
        work.push("read");
        return null;
      },
      spawnAgent: () => work.push("spawn"),
    });
    await module.listenForStepPending({
      async listen(channel, handler) {
        assert.equal(channel, "step_pending");
        listener = handler;
      },
    });
    assert.ok(listener);

    const unhandled: unknown[] = [];
    const onUnhandled = (error: unknown) => unhandled.push(error);
    process.on("unhandledRejection", onUnhandled);
    try {
      listener(JSON.stringify({
        agentId: "feature-dev_developer",
        runId: "run-owner",
        stepId: "implement",
        runOwnerReservationRef: rawRef,
        runOwnerReservationHash: rawHash,
      }));
      await new Promise((resolve) => setImmediate(resolve));
      listener("{");
      await new Promise((resolve) => setImmediate(resolve));
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }

    assert.equal(unhandled.length, 0);
    assert.equal(errors.length, 2);
    assert.deepEqual(work, []);
    assert.ok(errors.every((entry) => entry.length <= 340));
    assert.doesNotMatch(errors.join("\n"), new RegExp(rawHash));
    assert.doesNotMatch(errors.join("\n"), /setfarm:\/\//);
    assert.match(errors[0], /\[redacted-ref\]/);
    assert.match(errors[1], /SyntaxError/);
  });

  it("records single-step handoff before claim-side gates and closes no-spawn exits", () => {
    const source = claimSingleStepSource();
    const publication = claimRuntimePublicationSource();
    const publicationCall = source.search(
      /publishSingleClaimAndRuntime\(\s*step,\s*agentId,\s*runtimeIntent,\s*planAuthoritySeal,\s*storyAdmissionProof,\s*superviseSubjectCandidate,\s*\)/,
    );
    const transitionRecord = source.indexOf("recordStepTransition(step.id, step.run_id, \"pending\", \"running\"");
    const runningEvent = source.indexOf("event: \"step.running\"");
    const atomicHandoff = source.indexOf("recordSingleStepHandoff(\"claimSingleStep:atomic\")");
    const verifyContextGate = source.indexOf("injectVerifyContext");
    const verifyAutoClose = source.indexOf("verify_each auto-verified or advanced without agent spawn");
    const reviewDelayGate = source.indexOf("PR REVIEW DELAY GATE");
    const reviewDelayClose = source.indexOf("PR review delay deferral");
    const preClaimHandoff = source.indexOf("recordSingleStepHandoff(\"claimSingleStep:preClaim\")");
    const finalHandoff = source.indexOf("recordSingleStepHandoff(\"claimSingleStep\")");
    const modulePreClaimCall = source.indexOf("await _stepModule.preClaim");
    const modulePreClaimNoSpawnGate = source.indexOf("preClaim changed step status");
    const missingInputGate = source.indexOf("MISSING_INPUT_GUARD");
    const missingInputRetryClose = source.indexOf("closeSingleStepHandoff(\"infra_retry\"");
    const missingInputFailClose = source.indexOf("closeSingleStepHandoff(\"failed\"");
    const handoffReturn = source.indexOf("return {\n    found: true");

    assert.match(publication, /publishSingleClaimRuntime[\s\S]*prepareInternalProductionClaimBirthV1[\s\S]*insertAndBindInternalProductionClaimBirthV1[\s\S]*reserveRuntimeSessionInTransaction/);
    assert.match(publication, /SELECT nextval\(pg_get_serial_sequence\('claim_log','id'\)\)::bigint::text AS id/);
    assert.notEqual(publicationCall, -1, "single claim must use canonical claim/runtime publication");
    assert.doesNotMatch(source, /INSERT INTO claim_log/);
    assert.notEqual(transitionRecord, -1, "recordSingleStepHandoff must record a step transition");
    assert.notEqual(runningEvent, -1, "recordSingleStepHandoff must emit step.running");
    assert.notEqual(atomicHandoff, -1, "atomic handoff must be recorded immediately after DB claim");
    assert.ok(atomicHandoff < verifyContextGate, "atomic handoff must run before verify auto/defer gate");
    assert.ok(atomicHandoff < reviewDelayGate, "atomic handoff must run before earlier defer gates");
    assert.ok(verifyAutoClose > verifyContextGate, "verify auto/no-agent path must close the early handoff");
    assert.ok(reviewDelayClose > reviewDelayGate, "review-delay no-agent path must close the early handoff");
    assert.ok(preClaimHandoff < modulePreClaimCall, "preClaim handoff must run before heavy module preClaim work");
    assert.ok(finalHandoff > missingInputGate, "final handoff must remain after no-spawn guards as an idempotent fallback");
    assert.ok(modulePreClaimNoSpawnGate > modulePreClaimCall, "preClaim no-spawn gate must be checked after preClaim");
    assert.ok(missingInputRetryClose > missingInputGate, "missing-input retry path must close the preClaim handoff");
    assert.ok(missingInputFailClose > missingInputGate, "missing-input failure path must close the preClaim handoff");
    assert.ok(finalHandoff < handoffReturn, "final handoff must run before handoff return");
    assert.match(source, /preClaim changed step status[\s\S]*closeSingleStepHandoff\(outcome/);
    assert.match(source, /shouldRecordSingleStepTransition = false/);
  });

  it("propagates immutable single-step claim authority through every preclaim owner", () => {
    const source = stepOpsSource();
    const types = fs.readFileSync(path.join(root, "src", "installer", "steps", "types.ts"), "utf-8");
    assert.match(types, /claimEnvelope\?: ClaimEnvelopeV1/);
    assert.match(source, /singleStepClaimEnvelope = \{/);
    assert.match(source, /claimId: singleStepClaimId,[\s\S]*claimAgentId: agentId,[\s\S]*runtimeAgentId: runtimeIntent\?\.runtimeAgentId \|\| agentId/);
    assert.match(source, /claimEnvelope: singleStepClaimEnvelope/);
    assert.match(
      source,
      /async function terminalizeV3PlatformPreclaim\([\s\S]*failStep\([\s\S]*singleStepClaimEnvelope,[\s\S]*singleStepMode: "terminal_platform_preclaim"/,
    );
    assert.match(
      source,
      /if \(v3PlatformPreclaim\) \{[\s\S]*terminalizeSharedV3PlatformPreclaim\([\s\S]*ownedPreClaimError/,
    );

    const preclaims = [
      "01-plan", "02-design", "03-stories", "04-setup-repo", "05-setup-build",
      "09-qa-test", "10-final-test", "11-deploy",
    ];
    for (const step of preclaims) {
      const preclaim = fs.readFileSync(path.join(root, "src", "installer", "steps", step, "preclaim.ts"), "utf-8");
      const exactClaimAliases = [...preclaim.matchAll(
        /const\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*ctx\.claimEnvelope\s*;/g,
      )].map((match) => match[1]!);
      for (const call of preclaim.matchAll(/(?:completeStep|failStep)\([\s\S]*?\);/g)) {
        const carriesExactAuthority = /ctx\.claimEnvelope/.test(call[0])
          || exactClaimAliases.some((alias) => new RegExp(`\\b${alias}\\b`).test(call[0]));
        assert.equal(
          carriesExactAuthority,
          true,
          `${step} preclaim must complete or fail through exact claim authority`,
        );
      }
    }
  });

  it("does not duplicate idempotent running single-step claims", () => {
    const source = claimSingleStepSource();
    const reissue = runningSingleStepClaimReissueSource();
    assert.match(source, /step\.step_status === "running"[\s\S]*authenticateRunningSingleStepClaimReissueV1\(step, agentId, runtimeIntent\)/);
    assert.match(reissue, /return pgBegin\(async \(sql\) => \{/);
    assert.match(reissue, /SELECT claim\.id::text AS claim_id/);
    assert.match(reissue, /COUNT\(\*\)::text FROM claim_log open_claim/);
    assert.match(reissue, /LEFT JOIN LATERAL \([\s\S]*FROM runtime_sessions candidate[\s\S]*FOR UPDATE[\s\S]*\) runtime ON TRUE/);
    assert.match(reissue, /claim\.run_id=\$1 AND claim\.step_id=\$2[\s\S]*claim\.story_id IS NULL AND claim\.outcome IS NULL/);
    assert.match(reissue, /LIMIT 2[\s\S]*FOR UPDATE OF claim/);
    assert.match(reissue, /rows\.length !== 1 \|\| observed\.open_claim_count !== "1"/);
    assert.match(reissue, /observed\.runtime_claim_id !== observed\.claim_id/);
    assert.match(reissue, /observed\.session_id !== runtimeIntent\.sessionId/);
    assert.match(reissue, /authenticateRunningSingleStepOwnerSidecarsV1\(sql/);
    assert.match(source, /Requeued orphaned running step/);
    assert.match(source, /NOT EXISTS \(\s*SELECT 1 FROM claim_log/);
    assert.match(source, /return \{ found: false \}/);
    assert.doesNotMatch(source, /INSERT INTO claim_log/);
  });

  it("keeps V3 stage retry claim projection inside the canonical safe integer domain", () => {
    const source = v3StageRetryClaimProjectionSource();
    assertV3StageRetryClaimProjectionAuthority(source);

    const mutations = [
      source.replace("cl.id::text AS claim_id", "cl.id::integer AS claim_id"),
      source.replace("Number.isSafeInteger(previousClaimId)", "Number.isInteger(previousClaimId)"),
      source.replace("previousClaimId > 0", "previousClaimId !== 0"),
      source.replace("String(previousClaimId) === row.claim_id", "String(previousClaimId).length > 0"),
      source.replace("previousClaimId: previousClaimIds[index]!", "previousClaimId: Number(row.claim_id)"),
    ];
    for (const mutation of mutations) {
      assert.throws(() => assertV3StageRetryClaimProjectionAuthority(mutation));
    }
  });

  it("does not repeatedly claim verify during the PR review delay window", () => {
    const fullSource = stepOpsSource();
    assert.match(fullSource, /r\.context::jsonb \? 'verify_pending_since'/);
    assert.match(fullSource, /r\.context::jsonb \? 'verify_pending_pr_url'/);
    assert.match(fullSource, /\(r\.context::jsonb ->> 'verify_pending_since'\)::timestamptz > NOW\(\) - \(\$3::int \* interval '1 millisecond'\)/);
    assert.match(fullSource, /verify_done_st\.pr_url <> \(r\.context::jsonb ->> 'verify_pending_pr_url'\)/);
    assert.match(fullSource, /LIMIT 1`, \[agentId, callerGatewayAgent \?\? null, PR_REVIEW_DELAY_MS\]/);
  });

  it("requeues orphaned running story loops when pending stories remain", () => {
    const source = stepAdvanceSource();
    assert.match(source, /status, step_id, current_story_id FROM steps/);
    assert.match(source, /orphanedRunningLoop/);
    assert.match(source, /SELECT id FROM claim_log WHERE run_id = \$1 AND step_id = \$2 AND outcome IS NULL LIMIT 1/);
    assert.match(source, /UPDATE steps SET status = 'pending', current_story_id = NULL/);
    assert.match(source, /checkLoopContinuation:orphanedRunningLoop/);
  });

  it("allows supervise_each supervisor claims to bypass verify_each ordering delay", () => {
    const source = previousStepSelectionBypassSource(claimStepSelectionSource());
    assert.match(source, /"superviseEach":true/);
    assert.match(source, /sup_loop\.loop_config::jsonb ->> 'superviseStep'/);
    assert.match(source, /sup_done_st\.status = 'done'/);
    assert.match(source, /s\.step_id = COALESCE/);
    assert.match(source, /fix_st\.story_id LIKE 'QA-FIX-%'/);
  });

  it("blocks verify_each reviewer claims until supervise_each has passed the done story", () => {
    const source = claimStepSelectionSource();
    assert.match(source, /verify_loop\.loop_config::jsonb ->> 'verifyStep'/);
    assert.match(source, /"superviseEach":true/);
    assert.match(source, /verify_wait_st\.status = 'done'/);
    assert.match(source, /r\.context::jsonb ->> 'supervised_story_ids'/);
    assert.match(source, /POSITION\(',' \|\| verify_wait_st\.story_id \|\| ',' IN ',' \|\| COALESCE\(r\.context::jsonb ->> 'supervised_story_ids'/);
  });

  it("does not hijack final-product supervisor completion as supervise_each after all stories are verified", () => {
    const source = stepOpsSource();
    const configHelperStart = source.indexOf("async function getSuperviseEachConfigForStep(");
    const configHelperEnd = source.indexOf("async function findUnsupervisedDoneStory(", configHelperStart);
    assert.notEqual(configHelperStart, -1, "getSuperviseEachConfigForStep source not found");
    assert.notEqual(configHelperEnd, -1, "getSuperviseEachConfigForStep end not found");
    const configHelper = source.slice(configHelperStart, configHelperEnd);
    assert.match(configHelper, /status = 'done'/);
    assert.match(configHelper, /if \(!pendingStory\) return null/);

    const completeDispatchStart = source.indexOf("if (lc.superviseEach && (lc.superviseStep || \"supervise\") === step.step_id)");
    assert.notEqual(completeDispatchStart, -1, "supervise_each complete dispatch not found");
    const completeDispatch = source.slice(completeDispatchStart, completeDispatchStart + 700);
    assert.match(completeDispatch, /if \(superviseEachConfigForStep\)/);
    assert.match(completeDispatch, /handleSuperviseEachCompletion/);
    assert.match(completeDispatch, /v3SuperviseBoundSubject/);
  });

  it("does not auto-complete downstream quality gates from supervise_each final-product context", () => {
    const source = claimSingleStepSource();
    const finalScope = source.indexOf('context["supervisor_scope"] === "final-product"');
    assert.notEqual(finalScope, -1, "final-product supervise_each auto-complete guard not found");
    const guard = source.slice(Math.max(0, finalScope - 80), finalScope + 160);
    assert.match(guard, /step\.step_id === "supervise"/);
    assert.doesNotMatch(guard, /qa-test|final-test|security-gate|deploy/);
  });

  it("routes deterministic final-product supervision through durable runtime completion", () => {
    const source = claimSingleStepSource();
    const finalScope = source.indexOf('context["supervisor_scope"] === "final-product"');
    const finalRouteEnd = source.indexOf("Final supervisor remains agent-owned", finalScope);
    const finalRoute = source.slice(finalScope, finalRouteEnd);
    assert.match(finalRoute, /compilerCompletionOutput = \[/);
    assert.match(finalRoute, /V3_FINAL_PRODUCT_COMPILER_COMPLETION_RUNTIME_REQUIRED/);
    assert.match(finalRoute, /runtimeSessionId: singleStepRuntime\.sessionId/);
    assert.match(finalRoute, /compilerCompletionOutput/);
    assert.doesNotMatch(finalRoute, /UPDATE steps SET status = 'done'/);
    assert.doesNotMatch(finalRoute, /closeSingleStepHandoff\("completed"/);
    assert.doesNotMatch(finalRoute, /advancePipeline\(step\.run_id\)/);
  });

  it("does not accept final-product retry or block as successful supervision", () => {
    const source = stepOpsSource();
    const handlerStart = source.indexOf("async function handleSuperviseEachCompletion(");
    const finalRetry = source.slice(handlerStart, handlerStart + 4_000);
    assert.match(finalRetry, /boundFinalProduct/);
    assert.match(finalRetry, /authenticatedV3Success/);
    assert.match(finalRetry, /finalProductStatus === "done"/);
    assert.match(finalRetry, /\["pass", "fixed"\]\.includes\(finalProductDecision\)/);
    assert.match(finalRetry, /V3_SUPERVISE_NON_SUCCESS_CLAIM_AUTHORITY_REQUIRED/);
    assert.match(finalRetry, /await failStep\(/);
    assert.match(finalRetry, /return \{ advanced: false, runCompleted: false \}/);
  });

  it("reconciles a committed supervisor block without replaying its retry mutation", () => {
    const source = stepOpsSource();
    const reconcileStart = source.indexOf("export async function reconcileRuntimeCompletionEffects(");
    const resumeStart = source.indexOf("export async function resumeRuntimeCompletionEffects(", reconcileStart);
    const reconcile = source.slice(reconcileStart, resumeStart);
    assert.match(reconcile, /parsed\["supervisor_decision"\] \|\| parsed\["decision"\] \|\| parsed\["status"\]/);
    assert.match(reconcile, /\["retry", "block", "blocked", "failed", "fail"\]\.includes\(decision\)/);
    assert.match(reconcile, /story\.status !== "done"/);
  });

  it("clears stale story supervisor context before final-product supervisor claims", () => {
    const injectSource = injectSuperviseEachContextSource();
    const finalProduct = injectSource.indexOf('authenticatedSubject?.kind === "final_product"');
    const loopLookup = injectSource.indexOf("findLoopStep(step.run_id)");
    assert.ok(finalProduct >= 0 && finalProduct < loopLookup);
    assert.match(injectSource.slice(finalProduct, loopLookup), /delete context\["story_workdir"\]/);
    assert.match(injectSource.slice(finalProduct, loopLookup), /await updateRunContext/);
    assert.match(injectSource, /status IN \('pending','running','done'\)/);
    assert.match(injectSource, /loopStatus\?\.status === "done"/);
    assert.match(injectSource, /context\["supervisor_scope"\] = "final-product"/);
    assert.match(injectSource, /delete context\["current_story_title"\]/);
    assert.match(injectSource, /SUPERVISOR_AC_CONTEXT_MISSING\|story-scoped supervisor/);
    assert.match(injectSource, /No story remains to audit; claiming/);

    const advanceSource = stepAdvanceSource();
    const clearStart = advanceSource.indexOf("function clearPrEachDownstreamContext(");
    const clearEnd = advanceSource.indexOf("// ── advancePipeline", clearStart);
    assert.notEqual(clearStart, -1, "clearPrEachDownstreamContext source not found");
    assert.notEqual(clearEnd, -1, "clearPrEachDownstreamContext end not found");
    const clearSource = advanceSource.slice(clearStart, clearEnd);
    assert.match(clearSource, /next\["supervisor_scope"\] = "final-product"/);
    assert.match(clearSource, /delete next\["current_story_title"\]/);
  });

  it("runs verify preflight against the PR branch diff using the story base", () => {
    const fullSource = stepOpsSource();
    assert.match(fullSource, /execFileSync\("git", \["fetch", "--prune", "origin", "main", analysisBranch\]/);
    assert.match(fullSource, /execFileSync\("git", \["checkout", "-B", analysisBranch, `origin\/\$\{analysisBranch\}`\]/);
    assert.match(fullSource, /function resolveVerifyPreflightBaseRef/);
    assert.match(fullSource, /const storyBaseRef = \(context\["story_base_ref"\] \|\| ""\)\.trim\(\)/);
    assert.match(fullSource, /return isLocalMainAuthoritative\(repo\) \? "main" : "origin\/main"/);
    assert.match(fullSource, /const baseRef = resolveVerifyPreflightBaseRef\(repoPath, context, analysisBranch\)/);
    assert.match(fullSource, /buildPreFlightReport\(repoPath, baseRef, "HEAD"\)/);
    assert.doesNotMatch(fullSource, /buildPreFlightReport\(context\["repo"\], analysisBranch\)/);
  });

  it("does not spawn reviewer for done verify_each stories until a story PR exists", () => {
    const fullSource = stepOpsSource();
    const verifySource = autoVerifyDoneStoriesSource();
    const claimSource = claimSingleStepSource();
    assert.match(fullSource, /async function ensureStoryPrUrlForBranch/);
    assert.match(verifySource, /if \(!prUrl\) \{/);
    assert.match(verifySource, /ensureStoryPrUrlForBranch\(/);
    assert.match(verifySource, /AUTO_PR_CREATE_FAILED/);
    assert.match(verifySource, /deferring reviewer claim/);
    assert.match(fullSource, /has no PR URL after platform auto-PR repair attempt; deferring reviewer claim/);
    assert.match(claimSource, /verify_each auto-verified or advanced without agent spawn/);
    assert.doesNotMatch(verifySource, /if \(!prUrl\) return story; \/\/ No PR URL → needs agent verification/);
  });

  it("auto PR reuse ignores closed PRs instead of marking them ready", () => {
    const fullSource = stepOpsSource();
    const start = fullSource.indexOf("async function ensureStoryPrUrlForBranch");
    const end = fullSource.indexOf("function parseGitStatusPaths", start);
    assert.notEqual(start, -1, "ensureStoryPrUrlForBranch source not found");
    assert.notEqual(end, -1, "ensureStoryPrUrlForBranch source end not found");
    const helper = fullSource.slice(start, end);
    assert.match(helper, /const existingState = getPRState\(existingPrUrl\)/);
    assert.match(helper, /existingState === "OPEN" \|\| \(existingState === "MERGED" && branchIntegrated\)/);
    assert.match(helper, /Ignoring MERGED existing PR[\s\S]*still has commits not integrated/);
    assert.match(helper, /Ignoring \$\{existingState\} existing PR/);
    assert.match(helper, /"--state", "open"/);
    assert.match(helper, /"--json", "url,state"/);
    assert.match(fullSource, /function githubRepoSlugFromRemote/);
    assert.match(fullSource, /function findGithubPrUrlByBranchApi/);
    assert.match(helper, /const apiExistingPr = findGithubPrUrlByBranchApi\(repoPath, storyBranchName, expectedRepoName, branchIntegrated\)/);
    assert.match(helper, /const apiCreatedPr = findGithubPrUrlByBranchApi\(repoPath, storyBranchName, expectedRepoName, branchIntegrated\)/);
    assert.doesNotMatch(helper, /"--state", "all", "--json", "url", "--jq", "\.\[0\]\.url/);
  });

  it("does not overwrite actionable retry context with stale successful output", () => {
    const fullSource = stepOpsSource();
    const source = claimSingleStepSource();
    assert.match(fullSource, /function isSuccessfulStepOutput\(output: string\): boolean/);
    assert.match(fullSource, /return status === "done" \|\| status === "skip"/);
    assert.match(fullSource, /function sanitizedRetryFailureText\(text: string\): string/);
    assert.match(fullSource, /PR_REVIEW_COMMENTS_OPEN\|PR_NOT_MERGED\|PR_MISSING\|VERIFY_SYSTEM_SMOKE_FAILURE/);
    assert.match(source, /const existingFailure = sanitizedRetryFailureText\(context\["previous_failure"\] \|\| ""\)/);
    assert.match(source, /const stepOutputLooksSuccessful = step\.output \? isSuccessfulStepOutput\(step\.output\) : false/);
    assert.match(source, /const failureText = existingFailure \|\| \(!stepOutputLooksSuccessful \? sanitizedRetryFailureText\(step\.output \|\| ""\) : ""\)/);
    assert.match(source, /if \(context\["previous_failure"\] !== failureText\) context\["previous_failure"\] = failureText/);
    assert.match(source, /currentCategory === "UNKNOWN"/);
    assert.match(source, /Unexpected error/i);
    assert.match(source, /Skipped successful step output as retry previous_failure/);
    assert.doesNotMatch(source, /context\["previous_failure"\] = step\.output/);
  });

  it("accumulates implement retry gate blockers instead of replacing prior blockers", () => {
    const fullSource = stepOpsSource();
    assert.match(fullSource, /mergeRetryFailureTexts/);
    assert.match(fullSource, /function applyRetryFailureContext/);
    assert.match(fullSource, /context\["previous_failure"\] = mergeRetryFailureTexts\(\[/);
    assert.match(fullSource, /applyRetryFailureContext\(context, `QUALITY GATE: \$\{qgMsg\}`/);
    assert.match(fullSource, /applyRetryFailureContext\(context, bridgeResult\.reason!/);
    assert.match(fullSource, /applyRetryFailureContext\(context, generatedRuntimeSemanticResult\.reason!/);
    assert.match(fullSource, /applyRetryFailureContext\(context, implementEvidenceResult\.reason!/);
    assert.doesNotMatch(fullSource, /context\["previous_failure"\] = bridgeResult\.reason!/);
    assert.doesNotMatch(fullSource, /context\["previous_failure"\] = generatedRuntimeSemanticResult\.reason!/);
  });

  it("resolves verify_each single-step claims when verify output is accepted", () => {
    const source = handleVerifyEachSource();
    const acceptedOutputGuard = source.indexOf("UPDATE steps SET status = 'waiting'");
    const duplicateGuard = source.indexOf("if (_pgChanged.changes === 0)");
    const claimUpdate = source.indexOf("closeLegacyClaimOwnersInTransaction");
    const retryBranch = source.indexOf("if (status === \"retry\")");
    const passedBranch = source.indexOf("// Verify PASSED");

    assert.ok(claimUpdate > acceptedOutputGuard, "claim_log must close after verify output atomically transitions the step");
    assert.ok(claimUpdate > duplicateGuard, "claim_log must not close on duplicate/late verify completions");
    assert.ok(claimUpdate < retryBranch, "claim_log must close before retry branch returns");
    assert.ok(claimUpdate < passedBranch, "claim_log must close before passed branch returns");
    assert.match(source, /closeLegacyClaimOwnersInTransaction\(sql,[\s\S]*storyId: null/);
  });

  it("persists module onComplete context before continuing guardrails", () => {
    const source = stepOpsSource();
    const moduleStart = source.indexOf("if (_stepModule.onComplete)");
    const moduleEnd = source.indexOf("// (Legacy REPO DEDUP", moduleStart);
    assert.notEqual(moduleStart, -1, "module onComplete block not found");
    assert.notEqual(moduleEnd, -1, "module onComplete block end not found");
    const moduleSource = source.slice(moduleStart, moduleEnd);

    const onComplete = moduleSource.indexOf("_stepModule.onComplete");
    const persist = moduleSource.indexOf("await persistCompletionContext()");
    assert.ok(persist > onComplete, "module onComplete context mutations must be persisted");
    assert.match(source, /const persistCompletionContext = async[\s\S]*UPDATE runs[\s\S]*AND context = \$4/);
  });

  it("closes downstream quality gate claims when routing back to implement", () => {
    const source = stepOpsSource();
    const claimOwnerStart = source.indexOf("async function closeRoutedQualityClaimInTransaction(");
    const start = source.indexOf("export async function routeQualityFailureToImplement(");
    const end = source.indexOf("// Predicted screen file helpers", start);
    assert.notEqual(start, -1, "routeQualityFailureToImplement source not found");
    assert.notEqual(end, -1, "routeQualityFailureToImplement end marker not found");
    const routeSource = source.slice(start, end);
    const claimOwnerSource = source.slice(claimOwnerStart, start);

    const transaction = routeSource.indexOf("await pgBegin(async (sql) => {");
    const claimUpdate = routeSource.indexOf("await closeRoutedQualityClaimInTransaction(", transaction);
    const stateUpdate = routeSource.indexOf("UPDATE steps SET status = 'pending'", claimUpdate);
    const routeTransition = routeSource.indexOf("qualityFailure:routeToImplement");
    const emitEvent = routeSource.indexOf("event: \"story.retry\"");

    assert.ok(transaction > 0, "quality routing must publish through one transaction");
    assert.ok(claimUpdate > transaction, "claim capability must close inside the route transaction");
    assert.ok(stateUpdate > claimUpdate, "old claim must close before retryable state is exposed");
    assert.ok(routeTransition > stateUpdate, "transition audit is recorded after commit");
    assert.ok(claimUpdate < emitEvent, "claim_log closes before route event returns control to spawner");
    assert.match(routeSource, /quality failure routed to \$\{fixStoryId\}/);
    assert.match(claimOwnerSource, /closeExactSingleStepClaimInTransaction/);
    assert.match(claimOwnerSource, /r\.protocol = 'legacy'/);
  });

  it("forks v3 QA and final recovery before every legacy prose classifier and QA-FIX path", () => {
    const source = stepOpsSource();
    const routeStart = source.indexOf("export async function routeQualityFailureToImplement(");
    const routeEnd = source.indexOf("// Predicted screen file helpers", routeStart);
    assert.notEqual(routeStart, -1, "routeQualityFailureToImplement source not found");
    assert.notEqual(routeEnd, -1, "routeQualityFailureToImplement end marker not found");
    const routeSource = source.slice(routeStart, routeEnd);

    const protocolFork = routeSource.indexOf('claimEnvelope?.protocol === "v3"');
    const canonicalMatrix = routeSource.indexOf("createPostgresV3DownstreamEvidenceRouter", protocolFork);
    const canonicalCommit = routeSource.indexOf("commitV3DownstreamEvidenceDecision", canonicalMatrix);
    const legacyLoopLookup = routeSource.indexOf("const loopStep = await pgGet", protocolFork);
    const legacyFailureProse = routeSource.indexOf("const failure = output.slice", protocolFork);
    const legacyFingerprint = routeSource.indexOf("qualityFailureFingerprint(failure)", protocolFork);
    const legacyQaFixLookup = routeSource.indexOf("story_id LIKE 'QA-FIX-%'", protocolFork);

    assert.ok(protocolFork > 0, "v3 protocol fork must be explicit");
    assert.ok(canonicalMatrix > protocolFork, "v3 must execute the canonical downstream evidence matrix");
    assert.ok(canonicalCommit > canonicalMatrix, "v3 must durably commit the typed matrix decision");
    for (const [label, legacyBoundary] of [
      ["loop lookup", legacyLoopLookup],
      ["failure prose", legacyFailureProse],
      ["failure fingerprint", legacyFingerprint],
      ["QA-FIX lookup", legacyQaFixLookup],
    ] as const) {
      assert.ok(legacyBoundary > canonicalCommit, `v3 canonical return must precede legacy ${label}`);
    }
    assert.match(routeSource.slice(protocolFork, legacyLoopLookup), /return true;/);

    const statusStart = source.indexOf("const isV3DownstreamCompletion =");
    const statusEnd = source.indexOf("// FIX 6: Status is ephemeral", statusStart);
    assert.notEqual(statusStart, -1, "v3 downstream status boundary not found");
    assert.notEqual(statusEnd, -1, "status boundary end not found");
    const statusSource = source.slice(statusStart, statusEnd);
    const failBranch = statusSource.indexOf('statusVal === "fail"');
    const failCanonicalRoute = statusSource.indexOf("routeQualityFailureToImplement(step, output", failBranch);
    const failStep = statusSource.indexOf("await failStep(stepId", failCanonicalRoute);
    const retryBranch = statusSource.indexOf('if (statusVal === "retry")');
    const retryCanonicalRoute = statusSource.indexOf("routeQualityFailureToImplement(step, output", retryBranch);
    const retryInfraClassifier = statusSource.indexOf("isSmokeInfrastructureFailure(output)", retryCanonicalRoute);

    assert.match(statusSource, /step\.step_id === "qa-test" && !isV3DownstreamCompletion/);
    assert.ok(failCanonicalRoute > failBranch && failCanonicalRoute < failStep, "v3 failure must route canonically before failStep");
    assert.ok(retryCanonicalRoute > retryBranch && retryCanonicalRoute < retryInfraClassifier, "v3 retry must route canonically before prose infra classification");

    const smokeStart = source.indexOf("if (smokeFailure) {");
    const smokeEnd = source.indexOf("if (!smokeResult)", smokeStart);
    assert.notEqual(smokeStart, -1, "final smoke failure boundary not found");
    assert.notEqual(smokeEnd, -1, "final smoke failure end not found");
    const smokeSource = source.slice(smokeStart, smokeEnd);
    const smokeCanonicalRoute = smokeSource.indexOf("isV3DownstreamCompletion");
    const smokeInfraClassifier = smokeSource.indexOf("isSmokeInfrastructureFailure(smokeFailure)");
    const smokeLegacyRoute = smokeSource.lastIndexOf("routeQualityFailureToImplement(");
    assert.ok(smokeCanonicalRoute >= 0 && smokeCanonicalRoute < smokeInfraClassifier, "v3 final smoke failure must bypass the prose infra classifier");
    assert.ok(smokeInfraClassifier < smokeLegacyRoute, "legacy smoke classifier and QA-FIX route must remain below the v3 fork");
  });

  it("publishes exact v3 final acceptance evidence before completing final-test", () => {
    const source = stepOpsSource();
    const acceptanceStart = source.indexOf("let acceptedCandidateHash: string | undefined;");
    const completionStart = source.indexOf("// Single step: mark done", acceptanceStart);
    assert.notEqual(acceptanceStart, -1, "v3 final acceptance boundary not found");
    assert.notEqual(completionStart, -1, "single-step completion boundary not found");
    const acceptanceSource = source.slice(acceptanceStart, completionStart);

    const finalGuard = acceptanceSource.indexOf('step.step_id === "final-test"');
    const preAcceptanceCleanup = acceptanceSource.indexOf('cleanupProjectEphemera(step.run_id, "pre-acceptance:final-test"', finalGuard);
    const matrix = acceptanceSource.indexOf("createPostgresV3DownstreamEvidenceRouter", finalGuard);
    const finalIntent = acceptanceSource.indexOf('intent: "final_acceptance"', matrix);
    const readyFence = acceptanceSource.indexOf('route.status !== "accepted_candidate_ready"', finalIntent);
    const candidatePublish = acceptanceSource.indexOf("createAcceptedCandidateRepository", readyFence);
    const exactEvidenceRefs = acceptanceSource.indexOf("evidencePlanArtifactHash: story.evidencePlanArtifactHash", candidatePublish);

    assert.ok(finalGuard >= 0, "final-test must have an explicit v3 acceptance fence");
    assert.ok(preAcceptanceCleanup > finalGuard && matrix > preAcceptanceCleanup, "all repo cleanup must precede the final-source evidence matrix");
    assert.ok(finalIntent > matrix, "final-test must rerun the canonical final-source evidence matrix");
    assert.ok(readyFence > finalIntent && candidatePublish > readyFence, "non-passing evidence must route before candidate publication");
    assert.ok(exactEvidenceRefs > candidatePublish, "AcceptedCandidate must bind the exact story attempt, plan and bundle refs");
    assert.match(acceptanceSource, /return \{ advanced: false, runCompleted: false \};/);

    const completionSource = source.slice(completionStart, source.indexOf("// Post-complete:", completionStart));
    assert.match(completionSource, /completeSingleStepClaimAndState/);
    assert.match(completionSource, /acceptedCandidateHash/);

    const postCompletionSource = source.slice(completionStart, source.indexOf("return advancePipeline(step.run_id);", completionStart));
    const immutableFence = postCompletionSource.indexOf("const immutableAcceptedCandidate =");
    const dbOnlyRefresh = postCompletionSource.indexOf("{ writeRepoFiles: false }", immutableFence);
    const cleanupGuard = postCompletionSource.indexOf("if (!immutableAcceptedCandidate)", dbOnlyRefresh);
    const postAcceptanceCleanup = postCompletionSource.indexOf("cleanupProjectEphemera(step.run_id", cleanupGuard);
    assert.ok(immutableFence > 0 && dbOnlyRefresh > immutableFence, "accepted final completion must refresh MC state without writing repo contract files");
    assert.ok(cleanupGuard > dbOnlyRefresh && postAcceptanceCleanup > cleanupGuard, "post-step repo cleanup must be impossible after candidate publication");

    const resumeStart = source.indexOf("export async function resumeRuntimeCompletionEffects(");
    const resumeEnd = source.indexOf("/**\n * Handle supervise-each completion", resumeStart);
    const resumeSource = source.slice(resumeStart, resumeEnd);
    assert.match(resumeSource, /acceptedCandidateHashFromCompletionPlan\(input\.completionPlan\)/);
    assert.match(resumeSource, /acceptedCandidateHash \? \{ writeRepoFiles: false \} : \{\}/);
    assert.match(resumeSource, /if \(!acceptedCandidateHash\) \{[\s\S]*cleanupProjectEphemera/);
  });

  it("persists actionable QA-FIX context when reusing an active fix story", () => {
    const source = stepOpsSource();
    const start = source.indexOf("export async function routeQualityFailureToImplement(");
    const end = source.indexOf("// Predicted screen file helpers", start);
    assert.notEqual(start, -1, "routeQualityFailureToImplement source not found");
    assert.notEqual(end, -1, "routeQualityFailureToImplement end marker not found");
    const routeSource = source.slice(start, end);

    assert.match(source, /Resolve reported issue:/);
    assert.match(routeSource, /qualityFixAcceptanceCriteria\(failure\)/);
    assert.match(routeSource, /UPDATE stories[\s\S]*description = \$2[\s\S]*acceptance_criteria = \$3[\s\S]*output = \$4/);
  });

  it("creates QA-FIX stories idempotently when duplicate routing races choose the same story id", () => {
    const source = stepOpsSource();
    const start = source.indexOf("export async function routeQualityFailureToImplement(");
    const end = source.indexOf("// Predicted screen file helpers", start);
    assert.notEqual(start, -1, "routeQualityFailureToImplement source not found");
    assert.notEqual(end, -1, "routeQualityFailureToImplement end marker not found");
    const routeSource = source.slice(start, end);

    assert.match(routeSource, /qualityFailureFingerprint\(failure\)/);
    assert.match(routeSource, /quality_failure_fingerprint/);
    assert.match(routeSource, /ON CONFLICT \(run_id, story_id\) WHERE status IN \('pending', 'running'\)/);
    assert.match(routeSource, /RETURNING id, story_id/);
  });

  it("binds v3 post-publication preparation failures to typed bounded ownership", () => {
    const source = stepOpsSource();
    const owner = v3PreDispatchFailureOwnerSource();
    assert.match(source, /from "\.\/v3-pre-dispatch-failure\.js"/);
    assert.doesNotMatch(source, /async function handleV3PreDispatchFailure\(/);
    assert.match(owner, /export async function handleV3PreDispatchFailure/);
    assert.match(owner, /createV3PreDispatchFailureV1/);
    assert.match(owner, /LEFT\(diagnostic, CHAR_LENGTH\(\$4\)\) = \$4/);
    assert.match(owner, /decideV3PreDispatchDispositionV1/);
    assert.match(owner, /requestRunTerminationInTransaction/);
    assert.match(owner, /closeReservedClaimRuntimeInTransaction/);

    const reservation = source.slice(
      source.indexOf("let nativeV3Attempt"),
      source.indexOf("// Wave 14 Bug K", source.indexOf("let nativeV3Attempt")),
    );
    assert.match(reservation, /handleV3PreDispatchFailure/);
    assert.doesNotMatch(reservation, /V3_IMPLEMENTATION_SLICE_RESERVATION_FAILED/);
    assert.doesNotMatch(reservation, /outcome:\s*operationalRetryRefused\s*\?\s*"failed"\s*:\s*"infra_retry"/);
  });

  it("routes QA-FIX-disabled app quality failures back to the original story before failing the run", () => {
    const source = stepOpsSource();
    const start = source.indexOf("export async function routeQualityFailureToImplement(");
    const end = source.indexOf("// Predicted screen file helpers", start);
    assert.notEqual(start, -1, "routeQualityFailureToImplement source not found");
    assert.notEqual(end, -1, "routeQualityFailureToImplement end marker not found");
    const routeSource = source.slice(start, end);

    const reClaimGuard = routeSource.indexOf("routeDecision.action === \"re_claim\"");
    const originalStoryRoute = routeSource.indexOf("routeOriginalStoryQualityFailureToImplement(");
    const blockedFail = routeSource.indexOf("QUALITY_FAILURE_ROUTER_BLOCKED_QA_FIX");
    const helper = routeSource.indexOf("async function routeOriginalStoryQualityFailureToImplement(");

    assert.ok(reClaimGuard > 0, "re_claim route guard must be present");
    assert.ok(originalStoryRoute > reClaimGuard, "re_claim must attempt original story routing");
    assert.ok(originalStoryRoute < blockedFail, "original story routing must happen before terminal QA-FIX block failure");
    assert.ok(helper > blockedFail, "original story routing helper must live in the quality routing section");
    assert.match(routeSource, /Do not create a QA-FIX story/);
    assert.match(routeSource, /qualityFailure:routeOriginalStory/);
    assert.match(routeSource, /quality failure routed to original story/);
  });

  it("does not terminally fail duplicate quality routes while the original story is already retrying", () => {
    const source = stepOpsSource();
    const start = source.indexOf("async function routeOriginalStoryQualityFailureToImplement(");
    const end = source.indexOf("// Predicted screen file helpers", start);
    assert.notEqual(start, -1, "routeOriginalStoryQualityFailureToImplement source not found");
    assert.notEqual(end, -1, "routeOriginalStoryQualityFailureToImplement end marker not found");
    const helperSource = source.slice(start, end);

    const pendingRunningQuery = helperSource.indexOf("status IN ('pending','running','done','verified','skipped')");
    const duplicateGuard = helperSource.indexOf('retryStory.status === "pending" || retryStory.status === "running"');
    const terminalFail = helperSource.indexOf("await failRun(step.run_id, true,", duplicateGuard);

    assert.ok(pendingRunningQuery > 0, "original story lookup must include already-routed pending/running stories");
    assert.ok(duplicateGuard > pendingRunningQuery, "pending/running stories must be handled as idempotent duplicate routes");
    assert.ok(terminalFail > duplicateGuard, "terminal failure remains only after duplicate-route guard");
    assert.match(helperSource, /qualityFailure:originalStoryAlreadyRouted/);
    assert.match(helperSource, /quality failure already routed to original story/);
  });

  it("routes post-merge quality regressions to current-main story retry without reopening the merged branch", () => {
    const source = stepOpsSource();
    const start = source.indexOf("async function routeOriginalStoryQualityFailureToImplement(");
    const end = source.indexOf("// Predicted screen file helpers", start);
    assert.notEqual(start, -1, "routeOriginalStoryQualityFailureToImplement source not found");
    assert.notEqual(end, -1, "routeOriginalStoryQualityFailureToImplement end marker not found");
    const helperSource = source.slice(start, end);

    const prSelect = helperSource.indexOf("story_branch, pr_url, scope_files FROM stories");
    const mergedGuard = helperSource.indexOf('retryStory.pr_url && getPRState(retryStory.pr_url) === "MERGED"', prSelect);
    const postMergeCategory = helperSource.indexOf("POST_MERGE_QUALITY_REGRESSION", mergedGuard);
    const exhaustedCategory = helperSource.indexOf("POST_MERGE_QUALITY_REGRESSION_RETRY_EXHAUSTED", mergedGuard);
    const clearBranch = helperSource.indexOf("story_branch = NULL", mergedGuard);
    const repairMax = helperSource.indexOf("postMergeRepairMaxRetries", mergedGuard);
    const maxRetryPersist = helperSource.indexOf("max_retries = $6", mergedGuard);
    const repairScope = helperSource.indexOf("extractQualityFailureScopeFiles(failure)");
    const scopePersist = helperSource.indexOf("scope_files = $3, resolved_scope_files = $3", mergedGuard);
    const routeTransition = helperSource.indexOf("qualityFailure:routeMergedStoryMainRepair", mergedGuard);
    const claimSource = stepOpsSource();

    assert.ok(prSelect >= 0, "original story router must read pr_url");
    assert.ok(mergedGuard > prSelect, "merged PR guard must run after loading story metadata");
    assert.ok(postMergeCategory > mergedGuard, "merged PR guard must classify post-merge quality regression");
    assert.ok(exhaustedCategory > mergedGuard, "merged PR retry exhaustion must have a distinct terminal category");
    assert.ok(clearBranch > postMergeCategory, "merged PR retry must clear stale branch metadata before rerunning implement");
    assert.ok(repairMax > postMergeCategory, "merged PR retry must calculate a visible current-main repair retry budget");
    assert.ok(maxRetryPersist > repairMax, "merged PR retry must persist max_retries with the repair budget");
    assert.ok(repairScope > prSelect, "original story retry must derive repair scope from downstream quality findings");
    assert.ok(scopePersist > repairScope, "merged PR retry must persist expanded repair scope before rerunning implement");
    assert.ok(routeTransition > clearBranch, "merged PR retry must route through implement instead of terminal failure");
    assert.match(helperSource, /retry on current main with a fresh story branch instead of reopening the merged branch/);
    assert.match(helperSource, /quality_failure_repeat_count/);
    assert.match(helperSource, /post_merge_quality_repair_budget/);
    assert.match(helperSource, /matching current-main repair retries are exhausted/);
    assert.match(helperSource, /infra\/model retries do not consume it/);
    assert.match(helperSource, /post-merge quality failure routed to original story/);
    assert.match(claimSource, /isPostMergeQualityRepair/);
    assert.match(claimSource, /POST_MERGE_QUALITY_REGRESSION[\s\S]*nextStory\.output/);
    assert.match(claimSource, /\$\{storyRunPrefix\}-\$\{nextStory\.story_id\}-repair-\$\{Math\.max\(1, Number\(nextStory\.retry_count \|\| 0\)\)\}/);
  });

  it("manual resume clears stale quality failure repeat context", () => {
    const source = fs.readFileSync(
      path.join(root, "src", "execution", "legacy-resume-plan.ts"),
      "utf-8",
    );
    const start = source.indexOf("const CONTEXT_KEYS_TO_SCRUB");
    const end = source.indexOf("const META_KEYS_TO_SCRUB", start);
    assert.notEqual(start, -1, "canonical resume scrub source not found");
    assert.notEqual(end, -1, "canonical resume scrub end marker not found");
    const clearSource = source.slice(start, end);

    assert.match(clearSource, /quality_failure_fingerprint/);
    assert.match(clearSource, /quality_failure_repeat_count/);
    assert.match(clearSource, /post_merge_quality_regression_story_id/);
    assert.match(clearSource, /failure_route_action/);
    assert.match(cliSource(), /executeRunOperationalAction/);
  });

  it("extracts downstream quality file paths for story repair scope expansion", () => {
    const source = stepOpsSource();
    const start = source.indexOf("function extractQualityFailureScopeFiles(");
    const end = source.indexOf("function mergeScopeFilesJson(", start);
    assert.notEqual(start, -1, "extractQualityFailureScopeFiles helper not found");
    assert.notEqual(end, -1, "extractQualityFailureScopeFiles helper end not found");
    const helperSource = source.slice(start, end);

    assert.match(helperSource, /assets\|public/);
    assert.match(helperSource, /\.html/);
    assert.match(helperSource, /node_modules\|dist\|build\|coverage/);
    assert.match(helperSource, /normalizeScopeFile/);
  });

  it("resolves step-level QA failures to an existing story when current_story_id is empty", () => {
    const source = stepOpsSource();
    const start = source.indexOf("async function resolveQualityFailureStoryId(");
    const end = source.indexOf("export async function routeQualityFailureToImplement(", start);
    assert.notEqual(start, -1, "resolveQualityFailureStoryId source not found");
    assert.notEqual(end, -1, "resolveQualityFailureStoryId end marker not found");
    const helperSource = source.slice(start, end);
    const routeStart = source.indexOf("export async function routeQualityFailureToImplement(");
    const routeEnd = source.indexOf("async function routeOriginalStoryQualityFailureToImplement(", routeStart);
    const routeSource = source.slice(routeStart, routeEnd);

    assert.match(helperSource, /current_story_id/);
    assert.match(helperSource, /failure\.match\(\/\\b\(\?:US\|QA-FIX\)-\\d\{3\}\\b\/g\)/);
    assert.match(helperSource, /ORDER BY story_index DESC LIMIT 1/);
    assert.match(routeSource, /const qualityRouteStoryId = await resolveQualityFailureStoryId/);
    assert.match(routeSource, /currentStoryId: qualityRouteStoryId/);
    assert.match(routeSource, /qualityRouteStoryId,\s*\n\s*failure/);
  });

  it("enforces active story id uniqueness at the database boundary", () => {
    const source = fs.readFileSync(path.join(root, "src", "db-pg.ts"), "utf-8");
    assert.match(source, /ALTER TABLE stories ADD COLUMN IF NOT EXISTS quality_failure_fingerprint TEXT/);
    assert.match(source, /CREATE UNIQUE INDEX IF NOT EXISTS idx_stories_active_story_id_unique ON stories\(run_id, story_id\) WHERE status IN \('pending', 'running'\)/);
    assert.match(source, /CREATE INDEX IF NOT EXISTS idx_stories_quality_failure_fingerprint/);
  });

  it("fails verify merge blockers before creating QA-FIX stories", () => {
    const source = stepOpsSource();
    const start = source.indexOf("export async function routeQualityFailureToImplement(");
    const end = source.indexOf("// Predicted screen file helpers", start);
    assert.notEqual(start, -1, "routeQualityFailureToImplement source not found");
    assert.notEqual(end, -1, "routeQualityFailureToImplement end marker not found");
    const routeSource = source.slice(start, end);

    const blockerGuard = routeSource.indexOf("isVerifyRetryMergeBlocker(output)");
    const qaFixLookup = routeSource.indexOf("story_id LIKE 'QA-FIX-%'");
    assert.ok(blockerGuard > 0, "verify merge blocker guard must be present");
    assert.ok(blockerGuard < qaFixLookup, "merge blockers must fail before QA-FIX lookup/creation");
    assert.match(routeSource, /VERIFY_MERGE_BLOCKER/);
    assert.match(routeSource, /do not route this to QA-FIX/);
    assert.match(routeSource, /await failRun\(step\.run_id, true, reason\)/);
  });

  it("lets verify-each retry output use the story retry path instead of QA-FIX", () => {
    const source = stepOpsSource();
    const helperStart = source.indexOf("async function isVerifyEachVerifyStep(");
    const completeStart = source.indexOf("export async function completeStep(");
    const retryStart = source.indexOf("if (statusVal === \"retry\")", completeStart);
    const unknownStart = source.indexOf("if (statusVal && statusVal !== \"done\"", retryStart);
    const loopDispatch = source.indexOf("return await handleVerifyEachCompletion", unknownStart);
    assert.notEqual(helperStart, -1, "isVerifyEachVerifyStep helper not found");
    assert.notEqual(retryStart, -1, "STATUS retry branch not found");
    assert.notEqual(unknownStart, -1, "unknown status guard not found");
    assert.notEqual(loopDispatch, -1, "verify-each completion dispatch not found");

    const helperSource = source.slice(helperStart, completeStart);
    const retrySource = source.slice(retryStart, unknownStart);
    const unknownSource = source.slice(unknownStart, loopDispatch);

    assert.match(helperSource, /step_id = 'implement'/);
    assert.match(helperSource, /loopConfig\?\.verifyEach/);
    assert.match(helperSource, /\(loopConfig\.verifyStep \|\| "verify"\) === step\.step_id/);
    assert.match(retrySource, /verifyEachRetryHandledLater = await isVerifyEachVerifyStep\(step\)/);
    assert.match(retrySource, /if \(!verifyEachRetryHandledLater\)/);
    assert.match(retrySource, /routeQualityFailureToImplement\(step, output, context, completionAuthority\?\.envelope\)/);
    assert.match(unknownSource, /!\(statusVal === "retry" && verifyEachRetryHandledLater\)/);
  });

  it("persists verify-each retry feedback onto the story and retry context", () => {
    const source = handleVerifyEachSource();
    const retryStart = source.indexOf("if (status === \"retry\")");
    const passedStart = source.indexOf("// Verify PASSED", retryStart);
    assert.notEqual(retryStart, -1, "verify-each retry branch not found");
    assert.notEqual(passedStart, -1, "verify-each passed branch not found");
    const retrySource = source.slice(retryStart, passedStart);

    assert.match(retrySource, /const issues = resolveVerifyRetryIssues\(parsedOutput, context, output\)/);
    assert.match(retrySource, /context\["verify_feedback"\] = issues/);
    assert.match(retrySource, /context\["previous_failure"\] = issues/);
    assert.match(retrySource, /isVerifyRetryMergeBlocker\(issues\)/);
    assert.match(retrySource, /UPDATE stories SET status = 'pending', claimed_by = NULL, claimed_at = NULL, retry_count = \$1, output = \$2, updated_at = \$3 WHERE id = \$4/);
    assert.match(retrySource, /UPDATE stories SET status = 'failed', retry_count = \$1, output = \$2, updated_at = \$3 WHERE id = \$4/);
    assert.match(retrySource, /await updateRunContext\(verifyStep\.run_id, context\)/);
  });

  it("defers terminal verify retry exhaustion when fresh pass evidence resolves stale visual retry output", () => {
    const handleSource = handleVerifyEachSource();
    const retryStart = handleSource.indexOf("if (status === \"retry\")");
    const passedStart = handleSource.indexOf("// Verify PASSED", retryStart);
    assert.notEqual(retryStart, -1, "verify retry branch not found");
    assert.notEqual(passedStart, -1, "verify pass branch not found");
    const retrySource = handleSource.slice(retryStart, passedStart);
    const guard = retrySource.indexOf("shouldDeferVerifyRetryExhaustionForResolvedEvidence(");
    const terminalFail = retrySource.indexOf("await failRun(verifyStep.run_id, true)", guard);

    assert.ok(guard >= 0, "retry exhaustion must check resolved pass evidence before failing the run");
    assert.ok(terminalFail > guard, "terminal fail must happen after resolved-evidence deferral guard");
    assert.match(retrySource, /checkId: "verify\.retry_exhaustion\.deferred"/);
    assert.match(retrySource, /VERIFY_STALE_VISUAL_RETRY_DEFERRED/);

    const fullSource = stepOpsSource();
    assert.match(fullSource, /function isResolvedNoRepeatVisualRetryIssue/);
    assert.match(fullSource, /repeat\\s\*=/);
    assert.match(fullSource, /size\\s\*=/);
    assert.match(fullSource, /check_id = 'supervisor-decision'/);
    assert.match(fullSource, /check_id = 'stack-evidence:verify'/);
    assert.match(fullSource, /event_type IN \('story.done', 'story.verified'\)/);
  });

  it("clears stale story failure context after verified and auto-verified stories", () => {
    const handleSource = handleVerifyEachSource();
    const autoSource = autoVerifyDoneStoriesSource();
    const fullSource = stepOpsSource();

    assert.match(fullSource, /function clearVerifiedStoryFailureContext\(context: Record<string, string>\): void/);
    assert.match(fullSource, /delete context\["verify_feedback"\]/);
    assert.match(fullSource, /delete context\["previous_failure"\]/);
    assert.match(fullSource, /delete context\["failure_category"\]/);
    assert.match(fullSource, /delete context\["failure_suggestion"\]/);
    assert.match(fullSource, /delete context\["verify_pending_pr_url"\]/);
    assert.match(fullSource, /delete context\["verify_pending_since"\]/);

    const handleVerifyStory = handleSource.indexOf("await verifyStory(verifiedRow.id, output)");
    const handleClear = handleSource.indexOf("clearVerifiedStoryFailureContext(context)", handleVerifyStory);
    const nextStory = handleSource.indexOf("const nextUnverifiedStory = await autoVerifyDoneStories", handleClear);
    assert.ok(handleVerifyStory >= 0, "normal verify pass must mark the story verified");
    assert.ok(handleClear > handleVerifyStory, "normal verify pass must clear stale failure context after verifyStory");
    assert.ok(nextStory > handleClear, "normal verify pass must clear stale failure context before selecting the next story");

    const autoVerifyCount = (autoSource.match(/await verifyStory\(story\.id/g) || []).length;
    const autoClearCount = (autoSource.match(/clearVerifiedStoryFailureContext\(context\)/g) || []).length;
    assert.ok(autoVerifyCount >= 3, "auto-verify should cover merged, force-merged, and closed-PR paths");
    assert.ok(autoClearCount >= autoVerifyCount, "every auto-verify path must clear stale story failure context");
  });

  it("requires fresh merged PR state before verify can mark a story verified", () => {
    const handleSource = handleVerifyEachSource();
    const passStart = handleSource.indexOf("// Verify PASSED");
    const verifyStoryCall = handleSource.indexOf("await verifyStory(verifiedRow.id, output)", passStart);
    assert.ok(passStart >= 0, "verify pass branch must exist");
    assert.ok(verifyStoryCall > passStart, "verify pass branch must call verifyStory");

    const passSource = handleSource.slice(passStart, verifyStoryCall);
    assert.match(passSource, /fetchFreshPrStateName\(verifiedRow\.pr_url, verifiedStoryId, context, verifyStep\.run_id, verifyStep\.step_id\)/);
    assert.match(passSource, /if \(prState !== "MERGED"\)/);
    assert.match(passSource, /PR_NOT_MERGED/);

    const fullSource = stepOpsSource();
    assert.match(fullSource, /checkId: "verify\.pr_state\.fresh"/);
    assert.match(fullSource, /label: "Verify PR merge state"/);
  });

  it("auto-verify records fresh PR merge state observations before marking stories verified", () => {
    const autoSource = stepOpsSource();
    const helperStart = autoSource.indexOf("export async function autoVerifyDoneStories");
    assert.ok(helperStart >= 0, "auto-verify helper must exist");
    const helperSource = autoSource.slice(helperStart);

    assert.match(helperSource, /const readPrStateForVerify = async/);
    assert.match(helperSource, /fetchFreshPrStateName\(prUrl, story\.story_id, context, runId, verifyStep\.id\)/);

    const readCall = helperSource.indexOf("const prState = await readPrStateForVerify(prUrl)");
    const autoVerify = helperSource.indexOf("Auto-verified after PR was already merged", readCall);
    assert.ok(readCall >= 0, "auto-verify must read fresh PR state before merged branch");
    assert.ok(autoVerify > readCall, "auto-verify must record/check fresh PR state before verifying story");
  });

  it("blocks pr-each implement story selection while PR delivery blocker is open", () => {
    const source = stepOpsSource();
    const blockerHelper = source.indexOf("function isOpenPrDeliveryBlockerContext");
    const autoComplete = source.indexOf("await autoCompleteStoriesWithPRs(step, runIdPrefix, context, null)");
    const pendingSelection = source.indexOf("let pendingStories: any[] = [];", autoComplete);
    assert.ok(blockerHelper >= 0, "PR delivery blocker helper must exist");
    assert.ok(autoComplete >= 0, "implement loop auto-complete point must exist");
    assert.ok(pendingSelection > autoComplete, "pending story selection must happen after auto-complete");

    const selectionPrelude = source.slice(autoComplete, pendingSelection);
    assert.match(source, /PR_EACH_DELIVERY_BLOCKED_STEP_SQL/);
    assert.match(source, /AND NOT \$\{PR_EACH_DELIVERY_BLOCKED_STEP_SQL\}/);
    assert.match(source, /active_st\.status IN \('pending', 'running'\)\)/);
    assert.match(selectionPrelude, /isPrEach && isOpenPrDeliveryBlockerContext\(context\)/);
    assert.match(selectionPrelude, /runProtocol\?\.protocol !== "v3"/);
    assert.match(selectionPrelude, /implement\.pr_each_delivery_blocker/);
    assert.match(selectionPrelude, /Blocking new story claim while verify delivery blocker is open/);
    assert.match(selectionPrelude, /return \{ found: false \}/);
  });

  it("does not block later pr-each stories with stale PR context from a verified story", () => {
    const source = stepOpsSource();
    const autoComplete = source.indexOf("await autoCompleteStoriesWithPRs(step, runIdPrefix, context, null)");
    const pendingSelection = source.indexOf("let pendingStories: any[] = [];", autoComplete);
    assert.ok(autoComplete >= 0, "implement loop auto-complete point must exist");
    assert.ok(pendingSelection > autoComplete, "pending story selection must happen after PR blocker cleanup");

    const selectionPrelude = source.slice(autoComplete, pendingSelection);
    assert.match(source, /function prDeliveryBlockerStoryId\(context: Record<string, string>\): string/);
    assert.match(source, /PR_REVIEW_COMMENTS_OPEN/);
    assert.match(source, /\(explicit \|\| context\["current_story_id"\] \|\| ""\)\.trim\(\)/);
    assert.match(selectionPrelude, /blockedStory\?\.status === "verified"/);
    assert.match(selectionPrelude, /const blockedStoryId = prDeliveryBlockerStoryId\(context\)/);
    assert.match(selectionPrelude, /clearVerifiedStoryFailureContext\(context\)/);
    assert.match(selectionPrelude, /runProtocol\?\.protocol !== "v3"/);
    assert.match(selectionPrelude, /Cleared stale PR delivery blocker for verified story/);
  });

  it("clears stale story failure context after supervise_each passes a story", () => {
    const source = stepOpsSource();
    const start = source.indexOf("async function handleSuperviseEachCompletion(");
    const end = source.indexOf("/**\n * Handle verify-each completion", start);
    assert.notEqual(start, -1, "handleSuperviseEachCompletion source not found");
    assert.notEqual(end, -1, "handleSuperviseEachCompletion end not found");

    const superviseSource = source.slice(start, end);
    const markPassed = superviseSource.indexOf("markStorySupervised(context, story.story_id)");
    const clearFailure = superviseSource.indexOf("clearVerifiedStoryFailureContext(context)", markPassed);
    const updateContext = superviseSource.indexOf("await updateRunContext(superviseStep.run_id, context)", clearFailure);

    assert.ok(markPassed >= 0, "supervisor pass must mark the story supervised");
    assert.ok(clearFailure > markPassed, "supervisor pass must clear stale verify/failure context");
    assert.ok(updateContext > clearFailure, "supervisor pass must persist cleaned context before queuing verify");
  });

  it("pushes story branch before verifying an existing PR", () => {
    const source = stepOpsSource();
    const pushStart = source.indexOf("checkId: \"implement.platform_push.start\"");
    const pushFailure = source.indexOf("PLATFORM_STORY_PUSH_FAILED for", pushStart);
    const autoPrStart = source.indexOf("checkId: \"implement.auto_pr.start\"");
    const storyUpdate = source.indexOf("UPDATE stories SET status=$1,output=$2,pr_url=$3", pushStart);

    assert.ok(pushStart > 0, "story completion must push branch before verify can inspect GitHub PR state");
    assert.ok(pushFailure > pushStart, "push failure must be classified before continuing");
    assert.ok(source.indexOf("completeStep:platformStoryPushFailed", pushFailure) > pushFailure, "push failure must stop story completion as a platform failure");
    assert.ok(source.indexOf("story retry was not consumed", pushFailure) > pushFailure, "push failure must not consume story retry budget");
    assert.equal(source.indexOf("await failStep(stepId, pushFailure)", pushFailure), -1, "push failure must not be routed back to the developer agent");
    assert.ok(autoPrStart > pushStart, "platform push must also run when PR_URL already exists and auto-pr is skipped");
    assert.ok(storyUpdate > pushStart, "story must not be marked done in DB before branch push succeeds");
  });

  it("retries platform story branch push after installing GitHub CLI git credentials", () => {
    const source = stepOpsSource();
    const start = source.indexOf("function pushStoryBranch(");
    const end = source.indexOf("function storyWorkdirMatchesBranch(", start);
    assert.notEqual(start, -1, "pushStoryBranch source not found");
    assert.notEqual(end, -1, "pushStoryBranch end not found");
    const helper = source.slice(start, end);

    assert.match(helper, /const pushArgs = \["push", "-u", "origin", branch\]/);
    assert.match(helper, /GIT_TERMINAL_PROMPT: "0"/);
    assert.match(helper, /"gh", \["auth", "setup-git", "--hostname", "github\.com"\]/);
    assert.match(helper, /after gh auth setup-git/);
  });

  it("recovers stale platform-owned story branch pushes with force-with-lease", () => {
    const source = stepOpsSource();
    const start = source.indexOf("function pushStoryBranch(");
    const end = source.indexOf("function storyWorkdirMatchesBranch(", start);
    assert.notEqual(start, -1, "pushStoryBranch source not found");
    assert.notEqual(end, -1, "pushStoryBranch end not found");
    const helper = source.slice(start, end);

    assert.match(helper, /const leasePushArgs = \["push", "--force-with-lease", "-u", "origin", branch\]/);
    assert.match(helper, /isStaleRemotePush/);
    assert.match(helper, /non-fast-forward/);
    assert.match(helper, /Updates were rejected/);
    assert.match(helper, /after force-with-lease/);
  });

  it("does not reuse a recorded story PR whose head branch differs from the story branch", () => {
    const source = stepOpsSource();
    const start = source.indexOf("async function ensureStoryPrUrlForBranch(");
    const end = source.indexOf("function gitCommandOk(", start);
    assert.notEqual(start, -1, "ensureStoryPrUrlForBranch source not found");
    assert.notEqual(end, -1, "ensureStoryPrUrlForBranch end not found");
    const helper = source.slice(start, end);

    assert.match(helper, /const existingHeadBranch = getPRHeadBranch\(existingPrUrl, repoPath\)/);
    assert.match(helper, /const branchIntegrated = storyBranchIntegratedInBase\(repoPath, storyBranchName, baseBranch \|\| "main"\)/);
    assert.match(helper, /\(existingHeadBranch \|\| ""\)\.toLowerCase\(\) === storyBranchName\.toLowerCase\(\)/);
    assert.match(helper, /existingState === "OPEN" \|\| \(existingState === "MERGED" && branchIntegrated\)/);
    assert.match(helper, /Ignoring MERGED existing PR[\s\S]*still has commits not integrated/);
    assert.match(helper, /"--state", "open"/);
    assert.match(helper, /head .* does not match/);
    assert.match(helper, /const pushResult = pushStoryBranch\(repoPath, storyBranchName\)/);
  });

  it("runs platform git with host GitHub auth instead of agent session auth", () => {
    const source = stepOpsSource();
    const start = source.indexOf("function platformGitEnv(");
    const end = source.indexOf("function sanitizePlatformProcessPath(", start);
    assert.notEqual(start, -1, "platformGitEnv source not found");
    assert.notEqual(end, -1, "platformGitEnv end not found");
    const helper = source.slice(start, end);

    assert.match(helper, /const hostUser = os\.userInfo\(\)/);
    assert.match(helper, /HOME: hostUser\.homedir \|\| os\.homedir\(\)/);
    assert.match(helper, /USER: hostUser\.username \|\| process\.env\.USER/);
    assert.match(helper, /\["GH_CONFIG_DIR", "GH_TOKEN", "GITHUB_TOKEN", "XDG_CONFIG_HOME"\]/);
    assert.match(helper, /if \(!\(key in extra\)\) delete env\[key\]/);
  });

  it("does not let LLM supervisor pass override blocking visual/state evidence", () => {
    const source = stepOpsSource();
    const start = source.indexOf("async function handleSuperviseEachCompletion(");
    const end = source.indexOf("/**\n * Handle verify-each completion", start);
    assert.notEqual(start, -1, "handleSuperviseEachCompletion source not found");
    assert.notEqual(end, -1, "handleSuperviseEachCompletion end not found");

    const superviseSource = source.slice(start, end);
    const evidenceCheck = superviseSource.indexOf("findBlockingSupervisorEvidenceForStory(");
    const markPassed = superviseSource.indexOf("markStorySupervised(context, story.story_id)");
    const queueVerify = superviseSource.indexOf("Supervisor passed ${story.story_id}; verify queued");

    assert.match(source, /readSupervisorVisualResult/);
    assert.match(source, /SUPERVISOR_VISUAL_QA_BLOCKED/);
    assert.match(source, /SUPERVISOR_EVIDENCE_BLOCKED/);
    assert.match(source, /supervise_each\.supervisor_evidence_blocked/);
    assert.match(source, /verify_each\.supervisor_evidence_blocked/);
    assert.match(source, /routeBlockingSupervisorEvidenceToImplement\(/);
    assert.match(source, /returning to implement before reviewer claim/);
    assert.match(source, /expandSupervisorEvidenceWorkdirs\(workdirs, storyBranch \|\| undefined\)/);
    assert.match(source, /params\.story\.story_branch/);
    assert.ok(evidenceCheck >= 0, "supervise_each must inspect supervisor evidence before pass");
    assert.ok(markPassed > evidenceCheck, "supervisor evidence must be checked before marking story supervised");
    assert.ok(queueVerify > evidenceCheck, "supervisor evidence must be checked before verify is queued");
  });

  it("records supervise module observations against the completing story snapshot", () => {
    const fullSource = stepOpsSource();
    assert.match(fullSource, /let completeCurrentStoryId = ""/);
    assert.match(fullSource, /SELECT story_id FROM stories WHERE id = \$1 AND run_id = \$2 LIMIT 1/);
    assert.match(fullSource, /currentStoryId: completeCurrentStoryId/);

    const superviseGuardSource = fs.readFileSync(path.join(root, "src", "installer", "steps", "12-supervise", "guards.ts"), "utf8");
    assert.match(superviseGuardSource, /storyId: ctx\.currentStoryId \|\| ctx\.context\["current_story_id"\] \|\| ""/);
  });

  it("ignores stale supervisor evidence from inactive source workdirs", () => {
    const source = stepOpsSource();
    assert.match(source, /function expandSupervisorEvidenceWorkdirs\(workdirs: string\[\], storyBranch\?: string\): string\[\]/);
    assert.match(source, /story-worktrees/);
    assert.match(source, /fs\.readdirSync\(agentsRoot\)/);
    assert.match(source, /function isUsableSupervisorEvidenceWorkdir\(workdir: string\): boolean/);
    assert.match(source, /Ignoring stale supervisor evidence from inactive workdir/);

    const start = source.indexOf("function findBlockingSupervisorEvidenceForStory(");
    const end = source.indexOf("async function routeBlockingSupervisorEvidenceToImplement(", start);
    assert.notEqual(start, -1, "findBlockingSupervisorEvidenceForStory source not found");
    assert.notEqual(end, -1, "routeBlockingSupervisorEvidenceToImplement source not found");

    const evidenceSource = source.slice(start, end);
    assert.match(evidenceSource, /expandSupervisorEvidenceWorkdirs\(workdirs, storyBranch \|\| undefined\)/);
    const usableCheck = evidenceSource.indexOf("isUsableSupervisorEvidenceWorkdir(workdir)");
    const visualRead = evidenceSource.indexOf("readSupervisorVisualResult(workdir, runId)");
    const stateRead = evidenceSource.indexOf("readSupervisorState(workdir, runId)");

    assert.ok(usableCheck >= 0, "supervisor evidence must verify workdir source markers");
    assert.ok(visualRead > usableCheck, "visual evidence must not be read from inactive workdirs");
    assert.ok(stateRead > usableCheck, "state evidence must not be read from inactive workdirs");
  });

  it("clears stale retry context before verifying a supervise_each-passed story", () => {
    const source = stepOpsSource();
    assert.match(source, /function isStorySupervised\(context: Record<string, string>, storyId: string\): boolean/);

    const verifySource = injectVerifyContextSource();
    const noPrGuard = verifySource.indexOf("if (!nextUnverified.pr_url && context[\"auto_pr_create_failed\"])");
    const supervisedCheck = verifySource.indexOf("if (isStorySupervised(context, nextUnverified.story_id))", noPrGuard);
    const clearFailure = verifySource.indexOf("clearVerifiedStoryFailureContext(context)", supervisedCheck);
    const outputParse = verifySource.indexOf("if (nextUnverified.output)", clearFailure);

    assert.ok(noPrGuard >= 0, "verify claim no-PR guard not found");
    assert.ok(supervisedCheck > noPrGuard, "verify claim must check supervised story status after no-PR deferral");
    assert.ok(clearFailure > supervisedCheck, "verify claim must clear stale retry context for supervised stories");
    assert.ok(outputParse > clearFailure, "verify claim must clear stale context before parsing current story output");
  });


  it("routes auto-verify smoke quality failures back to implement", () => {
    const autoSource = autoVerifyDoneStoriesSource();
    const handleSource = handleVerifyEachSource();
    const fullSource = stepOpsSource();

    assert.match(autoSource, /\["VERIFY_SYSTEM_SMOKE_FAILURE", "BUILD_FAILED"\]\.includes\(context\["failure_category"\] \|\| ""\)/);
    assert.match(autoSource, /routeQualityFailureToImplement\(/);
    assert.match(autoSource, /SYSTEM_SMOKE_FAILURE:/);
    assert.match(autoSource, /verify_quality_failure_routed/);
    assert.match(autoSource, /status IN \('running','pending','failed','waiting'\)/);
    assert.match(autoSource, /ORDER BY CASE WHEN story_id LIKE 'QA-FIX-%' THEN 0 ELSE 1 END, story_index ASC LIMIT 1/);
    assert.match(handleSource, /Routed verify smoke failure to implement; not cycling reviewer/);
    assert.match(fullSource, /Routed verify smoke failure to implement; suppressing reviewer claim/);
  });

  it("does not let stale verify context override the current done story", () => {
    const handleSource = handleVerifyEachSource();
    const identifyStart = handleSource.indexOf("// Identify the story being verified.");
    const retryStart = handleSource.indexOf("if (status === \"retry\")", identifyStart);
    assert.notEqual(identifyStart, -1, "verify target selection block not found");
    assert.notEqual(retryStart, -1, "verify retry branch not found");
    const identifySource = handleSource.slice(identifyStart, retryStart);

    const byBoundSubject = identifySource.indexOf("let verifiedStoryId = boundSubject?.storyId");
    const byPr = identifySource.indexOf("SELECT story_id FROM stories WHERE run_id = $1 AND pr_url = $2 AND status = 'done' LIMIT 1");
    const byReported = identifySource.indexOf("SELECT story_id FROM stories WHERE run_id = $1 AND story_id = $2 AND status = 'done' LIMIT 1");
    const byContext = identifySource.indexOf("Ignoring stale context current_story_id");

    assert.ok(byBoundSubject >= 0, "verify must prefer the immutable completion subject");
    assert.ok(byPr > byBoundSubject, "reported PR lookup must follow an effect-bound subject");
    assert.ok(byPr >= 0, "verify should match a reported merged PR to a done story");
    assert.ok(byReported > byPr, "reported current_story_id should be checked after PR URL");
    assert.ok(byContext > byReported, "context current_story_id should be treated as the weakest/stale source");
    assert.doesNotMatch(identifySource, /parsedOutput\["current_story_id"\] \|\| context\["current_story_id"\]/);
  });

  it("blocks actionable PR review comments before auto-merge", () => {
    const handleSource = handleVerifyEachSource();
    const passedStart = handleSource.indexOf("// Verify PASSED");
    const smokeStart = handleSource.indexOf("const repoPath = context[\"repo\"] || context[\"REPO\"] || \"\";", passedStart);
    assert.notEqual(passedStart, -1, "verify-each passed branch not found");
    assert.notEqual(smokeStart, -1, "verify smoke branch not found");
    const passedSource = handleSource.slice(passedStart, smokeStart);

    const prCommentsCheck = passedSource.indexOf("detectOpenPrReviewCommentFailure(");
    const prCommentsRoute = passedSource.indexOf("PR_REVIEW_COMMENTS_OPEN", prCommentsCheck);
    const mutableState = passedSource.indexOf("let prState = await fetchFreshPrStateName(verifiedRow.pr_url");
    const openGuard = passedSource.indexOf("if (prState === \"OPEN\")", mutableState);
    const settleGate = passedSource.indexOf("prReviewSettleComplete(context)", openGuard);
    const autoMerge = passedSource.indexOf("tryAutoMergePR(verifiedRow.pr_url, verifiedStoryId, verifyStep.run_id)", settleGate);
    const invalidate = passedSource.indexOf("invalidatePRStateCache(verifiedRow.pr_url)", autoMerge);
    const recheck = passedSource.indexOf("prState = await fetchFreshPrStateName(verifiedRow.pr_url", invalidate);
    const notMergedGuard = passedSource.indexOf("if (prState !== \"MERGED\")", recheck);

    assert.ok(prCommentsCheck >= 0, "verify must fetch fresh PR comments before merge");
    assert.ok(prCommentsRoute > prCommentsCheck, "actionable PR comments must route back to implement");
    assert.ok(prCommentsCheck < mutableState, "PR comments must be checked before fresh PR state and auto-merge");
    assert.ok(mutableState >= 0, "PR state must be mutable so merge can be rechecked");
    assert.ok(openGuard > mutableState, "open PR guard must run after state lookup");
    assert.ok(settleGate > openGuard, "open PR auto-merge must wait for the external review settle window");
    assert.ok(autoMerge > settleGate, "approved open PR should use existing auto-merge helper after review settle");
    assert.ok(invalidate > autoMerge, "PR state cache must be invalidated after merge");
    assert.ok(recheck > invalidate, "PR state must be rechecked after merge");
    assert.ok(notMergedGuard > recheck, "not-merged guard should use post-merge state");
  });

  it("routes actionable PR review comments before spawning reviewer", () => {
    const fullSource = stepOpsSource();
    const reviewDelayStart = fullSource.indexOf("// PR REVIEW DELAY GATE");
    const preClaimStart = fullSource.indexOf("recordSingleStepHandoff(\"claimSingleStep:preClaim\")", reviewDelayStart);
    assert.notEqual(reviewDelayStart, -1, "review delay gate not found");
    assert.notEqual(preClaimStart, -1, "preClaim handoff not found after review delay gate");
    const gateSource = fullSource.slice(reviewDelayStart, preClaimStart);

    const signal = gateSource.indexOf("if (hasReviewSignal)");
    const detect = gateSource.indexOf("detectOpenPrReviewCommentFailure(", signal);
    const category = gateSource.indexOf("category: \"PR_REVIEW_COMMENTS_OPEN\"", detect);
    const route = gateSource.indexOf("routeVerifyScopeFailureToImplement(step, context, storyIdForReviewSignal", detect);
    const close = gateSource.indexOf("actionable PR review comments routed to implement before reviewer spawn", route);
    const noSpawn = gateSource.indexOf("return { found: false }", route);

    assert.ok(signal >= 0, "review signal branch should exist");
    assert.ok(detect > signal, "claim path should re-check actionable PR comments");
    assert.ok(category > detect, "claim path should classify actionable comments as PR_REVIEW_COMMENTS_OPEN");
    assert.ok(route > detect, "claim path should route PR review comments back to implement");
    assert.ok(close > route, "claim path should close the handoff before suppressing spawn");
    assert.ok(noSpawn > route, "claim path should suppress reviewer spawn");
  });

  it("escalates exhausted PR review feedback to supervisor instead of failing immediately", () => {
    const source = stepOpsSource();
    const helperStart = source.indexOf("async function routeVerifyScopeFailureToImplement");
    const helperEnd = source.indexOf("function getImplicitScopeFiles", helperStart);
    assert.notEqual(helperStart, -1, "routeVerifyScopeFailureToImplement source not found");
    assert.notEqual(helperEnd, -1, "routeVerifyScopeFailureToImplement source end not found");
    const helper = source.slice(helperStart, helperEnd);
    const reviewBranch = helper.indexOf("const isReviewFailure = isSupervisorEscalatableReviewFailure(options.category, failure)");
    const globalRetryLimit = helper.indexOf("if (newRetry > retryStory.max_retries)");
    assert.match(source, /function isSupervisorEscalatableReviewFailure/);
    assert.match(source, /function extractPrReviewActionableCount/);
    assert.match(source, /const PR_REVIEW_COMMENT_RETRY_LIMIT = 3/);
    assert.match(helper, /const isReviewFailure = isSupervisorEscalatableReviewFailure\(options\.category, failure\)/);
    assert.ok(reviewBranch >= 0, "PR review branch should be explicit");
    assert.ok(globalRetryLimit > reviewBranch, "PR review retries must be handled before global story retry exhaustion");
    assert.match(helper, /pr_review_retry_count/);
    assert.match(helper, /pr_review_last_actionable_count/);
    assert.match(helper, /const madeReviewProgress = sameReviewStory && actionableCount !== null/);
    assert.match(helper, /delete context\["pr_review_supervisor_escalated_story_id"\]/);
    assert.match(helper, /const storyRetryForReview = Math\.min\(newRetry, Math\.max\(0, retryStory\.max_retries\)\)/);
    assert.match(helper, /Developer PR review retries are exhausted\. Escalate this actionable PR review feedback to the story supervisor/);
    assert.match(helper, /pr_review_supervisor_escalated_story_id/);
    assert.match(helper, /UPDATE stories SET status = 'done', retry_count = \$1/);
    assert.match(helper, /UPDATE steps SET status = 'pending', current_story_id = \$1/);
    assert.match(helper, /review retry budget exhausted; escalated to/);
    assert.match(helper, /PR_REVIEW_COMMENTS_MANUAL_REVIEW/);
    assert.match(helper, /Manual review required: developer retries and supervisor escalation did not clear actionable PR review comments/);
    assert.match(helper, /review retry budget and supervisor escalation exhausted; failing for manual review/);
  });

  it("keeps PR review retries on the authoritative PR head branch", () => {
    const source = stepOpsSource();
    const helperStart = source.indexOf("async function routeVerifyScopeFailureToImplement");
    const helperEnd = source.indexOf("function getImplicitScopeFiles", helperStart);
    assert.notEqual(helperStart, -1, "routeVerifyScopeFailureToImplement source not found");
    assert.notEqual(helperEnd, -1, "routeVerifyScopeFailureToImplement source end not found");
    const helper = source.slice(helperStart, helperEnd);
    const claimStart = source.indexOf("const storyRunPrefix = step.run_id.slice(0, 8);");
    const claimEnd = source.indexOf("const publication = await publishLoopClaimAndRuntime", claimStart);
    assert.notEqual(claimStart, -1, "claim story branch block not found");
    assert.notEqual(claimEnd, -1, "claim story branch block end not found");
    const claim = source.slice(claimStart, claimEnd);

    assert.match(source, /getPRHeadBranch/);
    assert.match(helper, /SELECT id, retry_count, max_retries, pr_url, story_branch FROM stories/);
    assert.match(helper, /const prHeadBranch = retryStory\.pr_url \? getPRHeadBranch\(retryStory\.pr_url, context\["repo"\] \|\| ""\) : null/);
    assert.match(helper, /const retryStoryBranch = \(prHeadBranch \|\| retryStory\.story_branch \|\| ""\)\.trim\(\)\.toLowerCase\(\)/);
    assert.match(source, /story_branch = COALESCE\(NULLIF\(\$4, ''\), story_branch\)/);
    assert.match(claim, /const existingStoryBranch = String\(nextStory\.story_branch \|\| ""\)\.trim\(\)\.toLowerCase\(\)/);
    assert.match(claim, /existingStoryBranch \|\| `\$\{storyRunPrefix\}-\$\{nextStory\.story_id\}`/);
  });

  it("recovers the exact supervisor owner when verify routes a story back to implement", () => {
    const source = stepOpsSource();
    const helperStart = source.indexOf("async function publishVerifyRetryToImplement");
    const helperEnd = source.indexOf("function getImplicitScopeFiles", helperStart);
    assert.notEqual(helperStart, -1, "publishVerifyRetryToImplement source not found");
    assert.notEqual(helperEnd, -1, "verify retry recovery source end not found");
    const helper = source.slice(helperStart, helperEnd);

    assert.match(helper, /const loopConfig = parseLoopConfigSafe\(loopStep\?\.loop_config \|\| "", verifyStep\.run_id\)/);
    assert.match(helper, /const superviseStepName = loopConfig\?\.superviseStep \|\| "supervise"/);
    assert.match(helper, /await pgBegin\(async \(sql\) =>/);
    assert.match(helper, /closeUniqueSingleStepClaimForRecoveryInTransaction\(sql/);
    assert.match(helper, /runtimeAgentId: "verify-retry-recovery-owner"/);
    assert.match(helper, /SET status = 'waiting', current_story_id = NULL/);
    assert.match(helper, /exact supervisor owner recovered/);
    assert.doesNotMatch(helper, /UPDATE claim_log/);
  });

  it("loads story branch metadata during atomic pending story claims", () => {
    const source = repoSource();
    const start = source.indexOf("export async function claimNextStory(");
    const end = source.indexOf("export async function getNextDoneStory(", start);
    assert.notEqual(start, -1, "claimNextStory source not found");
    assert.notEqual(end, -1, "claimNextStory source end not found");
    const helper = source.slice(start, end);

    assert.match(helper, /file_skeletons, story_branch, pr_url/);
    assert.match(helper, /FROM stories st WHERE run_id = \$1 AND id = \$2 AND status = 'pending'/);
    assert.match(helper, /FROM stories st WHERE run_id = \$1 AND status = 'pending'/);
    assert.match(helper, /NOT EXISTS \([\s\S]*FROM claim_log cl[\s\S]*cl\.outcome IS NULL/);
  });

  it("fast-forwards mechanically satisfied PR review retries before developer claim", () => {
    const source = stepOpsSource();
    const helper = source.indexOf("async function fastForwardMechanicallySatisfiedPrReviewRetry");
    const call = source.indexOf("fastForwardMechanicallySatisfiedPrReviewRetry(step, nextStory, context)");
    const publication = source.indexOf("const publication = await publishLoopClaimAndRuntime", call);
    const worktree = source.indexOf("let storyWorkdir = createStoryWorktree", call);

    assert.notEqual(helper, -1, "PR review retry fast-forward helper missing");
    assert.notEqual(call, -1, "PR review retry fast-forward call missing");
    assert.ok(call > helper, "claim path should call the helper");
    assert.ok(publication > call, "fast-forward must run before atomic claim/runtime publication");
    assert.ok(worktree > publication, "worktree provisioning must remain after durable publication");
    assert.match(source.slice(helper, call), /resolveMechanicallySatisfiedInlineReviewThreads/);
    assert.match(source.slice(helper, call), /mechanically_satisfied_current_thread_preclaim/);
  });

  it("ignores output-contract PR_URL placeholders in implement completion guards", () => {
    const source = stepOpsSource();
    const start = source.indexOf("// Mark current story done or skipped + persist PR context for verify_each");
    const end = source.indexOf("// CROSS-PROJECT CONTAMINATION GUARD", start);
    assert.notEqual(start, -1, "implement completion PR context block not found");
    assert.notEqual(end, -1, "implement completion PR context block end not found");
    const block = source.slice(start, end);

    assert.match(block, /let storyPrUrl = GH_PR_URL_REGEX\.test\(parsed\["pr_url"\] \|\| ""\) \? parsed\["pr_url"\] : ""/);
    assert.match(block, /const agentOriginalPrRaw = \(parsed\["pr_url"\] \|\| ""\)\.trim\(\)/);
    assert.match(block, /const agentOriginalPr = GH_PR_URL_REGEX\.test\(agentOriginalPrRaw\) \? agentOriginalPrRaw : ""/);
  });

  it("auto-verifies clean open PRs mechanically after comments are clear", () => {
    const source = autoVerifyDoneStoriesSource();
    const openStart = source.indexOf("if (prState === \"OPEN\")");
    const closedStart = source.indexOf("} catch (e)", openStart);
    assert.notEqual(openStart, -1, "OPEN PR auto-verify branch not found");
    assert.notEqual(closedStart, -1, "OPEN PR auto-verify branch end not found");
    const openSource = source.slice(openStart, closedStart);

    const commentsGate = openSource.indexOf("detectOpenPrReviewCommentFailure(");
    const route = openSource.indexOf("routeVerifyScopeFailureToImplement(", commentsGate);
    const settleGate = openSource.indexOf("prReviewSettleComplete(context)", route);
    const cleanOpenPr = openSource.indexOf("const cleanOpenPr", settleGate);
    const autoMerge = openSource.indexOf("tryAutoMergePR(prUrl, story.story_id, runId)", cleanOpenPr);
    const invalidate = openSource.indexOf("invalidatePRStateCache(prUrl)", autoMerge);
    const recheck = openSource.indexOf("const refreshedState = await readPrStateForVerify(prUrl)", invalidate);
    const continueMerged = openSource.indexOf("if (refreshedState === \"MERGED\")", recheck);
    const reviewerFallback = openSource.indexOf("return story", continueMerged);

    assert.ok(commentsGate >= 0, "OPEN PR path must re-check actionable review comments first");
    assert.ok(route > commentsGate, "actionable comments must route to implement before merge");
    assert.ok(settleGate > route, "OPEN PR auto-merge must wait for the external review settle window");
    assert.ok(cleanOpenPr > settleGate, "clean merge signal must be computed after comment gate and settle gate");
    assert.ok(autoMerge > cleanOpenPr, "clean OPEN PR should use Setfarm auto-merge helper");
    assert.ok(invalidate > autoMerge, "PR state cache must be invalidated after auto-merge");
    assert.ok(recheck > invalidate, "PR state must be rechecked after auto-merge");
    assert.ok(continueMerged > recheck, "merged PRs should continue through auto-verify gates");
    assert.ok(reviewerFallback > continueMerged, "reviewer fallback should be last resort for unclean/open PRs");
  });

  it("does not resolve current actionable PR review threads from verify", () => {
    const fullSource = stepOpsSource();
    const detectStart = fullSource.indexOf("async function detectOpenPrReviewCommentFailure");
    const nextFunction = fullSource.indexOf("\nfunction isOpenPrDeliveryBlockerContext", detectStart);
    assert.notEqual(detectStart, -1, "detectOpenPrReviewCommentFailure not found");
    assert.notEqual(nextFunction, -1, "detectOpenPrReviewCommentFailure end not found");
    const detectSource = fullSource.slice(detectStart, nextFunction);

    assert.doesNotMatch(
      detectSource,
      /resolveActionableInlineReviewThreads/,
      "verify must not resolve current actionable PR review threads; it must route them to implement",
    );
    assert.match(detectSource, /PR_REVIEW_COMMENTS_OPEN/, "current actionable comments should remain a blocking route");
    assert.match(detectSource, /policyDecision:\s*"mechanically_satisfied_current_thread"/);
    assert.match(detectSource, /policyDecision:\s*"historical_or_outdated_thread"/);
    assert.doesNotMatch(
      detectSource,
      /state\.state\s*!==\s*"MERGED"\s*&&\s*formatted/,
      "merged PRs with current actionable comments must still be blocked",
    );
    assert.match(detectSource, /PR is merged but still has current actionable PR review comments/);
  });

  it("runs post-merge build before accepting verify or deferring smoke", () => {
    const handleSource = handleVerifyEachSource();
    const passedStart = handleSource.indexOf("// Verify PASSED");
    const smokeStart = handleSource.indexOf("const smokeDecision = await shouldRunStorySystemSmokeGate", passedStart);
    assert.notEqual(passedStart, -1, "verify-each passed branch not found");
    assert.notEqual(smokeStart, -1, "verify smoke decision not found");
    const passedSource = handleSource.slice(passedStart, smokeStart + 1200);

    const syncMain = passedSource.indexOf("syncBaseBranch(repoPath, \"main\")");
    const buildGate = passedSource.indexOf("runPostMergeBuildGate(repoPath");
    const routeFailure = passedSource.indexOf("routeQualityFailureToImplement(", buildGate);
    const smokeDecision = passedSource.indexOf("shouldRunStorySystemSmokeGate", buildGate);

    assert.ok(syncMain >= 0, "verify should sync main before post-merge gates");
    assert.ok(buildGate > syncMain, "post-merge build must run after syncing main");
    assert.ok(routeFailure > buildGate, "post-merge build failure must route through the quality-fix path");
    assert.ok(smokeDecision > buildGate, "smoke may be deferred only after main build passes");

    const fullSource = stepOpsSource();
    const ensureStart = fullSource.indexOf("async function ensureSystemSmokeBeforeAutoVerify(");
    const ensureEnd = fullSource.indexOf("const smokeGate = runSystemSmokeGate", ensureStart);
    assert.notEqual(ensureStart, -1, "auto-verify gate source not found");
    assert.notEqual(ensureEnd, -1, "auto-verify smoke call not found");
    const ensureSource = fullSource.slice(ensureStart, ensureEnd);
    assert.ok(ensureSource.indexOf("runPostMergeBuildGate(repoPath") < ensureSource.indexOf("shouldRunStorySystemSmokeGate"), "auto-verify build must run before smoke deferral");
  });

  it("accepts static HTML source when final-test verifies merged main", () => {
    const source = stepOpsSource();
    const guardStart = source.indexOf("// After final-test completes successfully, verify the feature branch is merged into main.");
    const guardEnd = source.indexOf("await persistCompletionContext();", guardStart);
    assert.notEqual(guardStart, -1, "final-test merge guard not found");
    assert.notEqual(guardEnd, -1, "final-test merge guard end not found");
    const guard = source.slice(guardStart, guardEnd);

    assert.match(source, /function gitRefHasProjectSource/);
    assert.match(source, /"package\.json", "index\.html", "src", "assets"/);
    assert.match(guard, /gitRefHasProjectSource\(mergeRepo, "main"\)/);
    assert.doesNotMatch(guard, /main:package\.json/);
    assert.match(guard, /missing project source files/);
  });

  it("delegates retry context assembly to one authority before developer claim context is persisted", () => {
    const stepOps = stepOpsSource();
    const stepOpsStart = stepOps.indexOf("async function injectStoryContext(");
    const stepOpsEnd = stepOps.indexOf("async function injectVerifyContext(", stepOpsStart);
    assert.notEqual(stepOpsStart, -1, "step-ops injectStoryContext not found");
    assert.notEqual(stepOpsEnd, -1, "step-ops injectStoryContext end not found");
    const stepOpsInject = stepOps.slice(stepOpsStart, stepOpsEnd);
    assert.match(stepOpsInject, /await injectStoryContextFromModule\(nextStory, step, context,/);
    assert.doesNotMatch(stepOpsInject, /const retryFailureText = nextStory\.output/);

    const extracted = implementContextSource();
    for (const [source, persistMarker] of [
      [extracted, "await helpers.updateRunContext(step.run_id, context)"],
    ] as Array<[string, string]>) {
      const retryFailure = source.indexOf("const retryFailureText = nextStory.output");
      const qaFixRetryFailure = source.indexOf("isQualityFixStory");
      const verifyFeedback = Math.max(
        source.indexOf("context[\"verify_feedback\"] = retryFailureText"),
        source.indexOf("context[\"verify_feedback\"] = mergeRetryFailureTexts"),
        source.indexOf("context[\"verify_feedback\"] = combinedRetryFailure"),
      );
      const previousFailure = Math.max(
        source.indexOf("context[\"previous_failure\"] = retryFailureText"),
        source.indexOf("context[\"previous_failure\"] = combinedRetryFailure"),
      );
      const clearPreviousFailure = source.indexOf("delete context[\"previous_failure\"]");
      const clearFailureCategory = source.indexOf("delete context[\"failure_category\"]");
      const clearFailureSuggestion = source.indexOf("delete context[\"failure_suggestion\"]");
      const persist = source.indexOf(persistMarker);
      assert.ok(retryFailure >= 0, "retry failure text must be derived from story output");
      assert.ok(qaFixRetryFailure > retryFailure, "QA-FIX story output must be treated as retry feedback even on the first attempt");
      assert.ok(clearPreviousFailure >= 0, "stale previous_failure must be cleared at new story claim");
      assert.ok(clearFailureCategory > clearPreviousFailure, "stale failure_category must be cleared with previous_failure");
      assert.ok(clearFailureSuggestion > clearFailureCategory, "stale failure_suggestion must be cleared with previous_failure");
      assert.ok(verifyFeedback > retryFailure, "verify_feedback must be restored from story output");
      assert.ok(previousFailure > verifyFeedback, "previous_failure must be restored from retry feedback");
      assert.ok(previousFailure > clearFailureSuggestion, "previous_failure must only be restored after stale failure context is cleared");
      assert.ok(persist > previousFailure, "context must be persisted after retry feedback injection");
      assert.doesNotMatch(source, /context\["verify_feedback"\] = ""/);
    }
  });

  it("preserves current-story gate failure ahead of stale story output retry feedback", () => {
    const source = implementContextSource();
    const preserveStoryId = source.indexOf("const priorContextStoryId = context[\"current_story_id\"] || \"\"");
    const preserveFailure = source.indexOf("const priorContextFailure = context[\"previous_failure\"] || \"\"");
    const clearPreviousFailure = source.indexOf("delete context[\"previous_failure\"]");
    const preservedRetry = source.indexOf("const preservedContextRetryFailure =");
    const retryFailure = source.indexOf("const retryFailureText = nextStory.output");
    const verifyFeedback = source.indexOf("context[\"verify_feedback\"] = mergeRetryFailureTexts([");
    const verifyFeedbackSource = source.slice(verifyFeedback, verifyFeedback + 360);
    const combinedRetry = source.indexOf("const combinedRetryFailure = mergeRetryFailureTexts([");
    const combinedRetrySource = source.slice(combinedRetry, combinedRetry + 260);
    const categoryPreserve = source.indexOf("preservedContextRetryFailure && priorContextFailureCategory");
    const suggestionPreserve = source.indexOf("preservedContextRetryFailure && priorContextFailureSuggestion");

    assert.ok(preserveStoryId >= 0, "current story id must be captured before stale context is cleared");
    assert.ok(preserveFailure > preserveStoryId, "current previous_failure must be captured before clearing");
    assert.ok(clearPreviousFailure > preserveFailure, "stale context should still be cleared before rebuilding claim context");
    assert.ok(preservedRetry > clearPreviousFailure, "same-story preserved retry failure should be rebuilt after story identity is known");
    assert.ok(retryFailure > preservedRetry, "story output retry text is secondary to preserved current gate failure");
    assert.ok(verifyFeedback > retryFailure, "verify feedback should prioritize preserved current gate failure");
    assert.match(verifyFeedbackSource, /scopeFilesRetryFailure,[\s\S]*preservedContextRetryFailure,[\s\S]*retryFailureText,[\s\S]*priorStoryFailureText/);
    assert.ok(combinedRetry > verifyFeedback, "previous_failure should be rebuilt after verify feedback");
    assert.match(combinedRetrySource, /scopeFilesRetryFailure,[\s\S]*preservedContextRetryFailure,[\s\S]*retryFailureText,[\s\S]*priorStoryFailureText/);
    assert.ok(categoryPreserve > combinedRetry, "failure category should preserve the current gate category when available");
    assert.ok(suggestionPreserve > categoryPreserve, "failure suggestion should preserve the current gate suggestion when available");
  });

  it("blocks verify-each claims while an active QA-FIX story is pending", () => {
    const claimSource = claimStepSelectionSource();
    const peekSource = peekStepSource();
    const claimBypassSource = previousStepSelectionBypassSource(claimSource);
    const peekBypassSource = previousStepSelectionBypassSource(peekSource);
    const activeQaFixGuard = /NOT EXISTS \(SELECT 1 FROM stories fix_st WHERE fix_st\.run_id = s\.run_id AND fix_st\.story_id LIKE 'QA-FIX-%' AND fix_st\.status IN \('pending', 'running'\)\)/;

    assert.match(claimBypassSource, activeQaFixGuard);
    assert.match(peekBypassSource, activeQaFixGuard);
    assert.match(peekSource, /prev\.step_index < s\.step_index/);
    assert.match(peekSource, /COALESCE\(prev\.loop_config::jsonb ->> 'verifyStep', ''\) = s\.step_id/);
    assert.match(
      claimBypassSource,
      /prev\.type = 'loop'[\s\S]*prev\.status = 'running'[\s\S]*NOT EXISTS \(SELECT 1 FROM stories fix_st WHERE fix_st\.run_id = s\.run_id AND fix_st\.story_id LIKE 'QA-FIX-%'/,
      "claimStep must not let verify bypass a running implement loop while an active QA-FIX exists",
    );
    assert.match(
      peekBypassSource,
      /prev\.type = 'loop'[\s\S]*prev\.status = 'running'[\s\S]*NOT EXISTS \(SELECT 1 FROM stories fix_st WHERE fix_st\.run_id = s\.run_id AND fix_st\.story_id LIKE 'QA-FIX-%'/,
      "peekStep must not advertise verify work while implement is actively repairing QA-FIX",
    );
    const pendingBypassStart = claimBypassSource.indexOf("prev.status = 'pending'");
    const pendingBypass = claimBypassSource.slice(pendingBypassStart);
    assert.match(pendingBypass, /COALESCE\(prev\.loop_config::jsonb ->> 'verifyStep', ''\) = s\.step_id[\s\S]*fix_st\.story_id LIKE 'QA-FIX-%'/);
  });

  it("keeps verify blocked and implement visible after a verify-each story retry", () => {
    const claimSource = claimStepSelectionSource();
    const peekSource = peekStepSource();
    const claimBypassSource = previousStepSelectionBypassSource(claimSource);
    const peekBypassSource = previousStepSelectionBypassSource(peekSource);
    const activeStoryGuard = /NOT EXISTS \(SELECT 1 FROM stories active_st WHERE active_st\.run_id = s\.run_id AND active_st\.status IN \('pending', 'running'\) AND \$\{ACTIVE_RETRY_STORY_ALIAS_SQL\}\)/;

    const claimPendingBypass = claimBypassSource.slice(claimBypassSource.indexOf("prev.status = 'pending'"));
    const peekPendingBypass = peekBypassSource.slice(peekBypassSource.indexOf("prev.status = 'pending'"));
    assert.match(claimPendingBypass, activeStoryGuard);
    assert.match(peekPendingBypass, activeStoryGuard);
    assert.match(stepOpsSource(), /ACTIONABLE_RETRY_OUTPUT_PATTERN = "PR_REVIEW_COMMENTS_OPEN\|actionable PR review comments/);
    assert.match(stepOpsSource(), /ACTIVE_RETRY_STORY_ALIAS_SQL = `\(active_st\.retry_count > 0 OR COALESCE\(active_st\.output, ''\) ~\* '\$\{ACTIONABLE_RETRY_OUTPUT_PATTERN\}'\)`/);

    const claimRunningStart = claimBypassSource.indexOf("prev.status = 'running'");
    const peekRunningStart = peekBypassSource.indexOf("prev.status = 'running'");
    assert.notEqual(claimRunningStart, -1, "claim running-loop bypass source not found");
    assert.notEqual(peekRunningStart, -1, "peek running-loop bypass source not found");
    const claimRunningBypass = claimBypassSource.slice(claimRunningStart, claimBypassSource.indexOf("prev.status = 'pending'"));
    const peekRunningBypass = peekBypassSource.slice(peekRunningStart, peekBypassSource.indexOf("prev.status = 'pending'"));
    assert.match(claimRunningBypass, activeStoryGuard);
    assert.match(peekRunningBypass, activeStoryGuard);
    assert.match(claimRunningBypass, /COALESCE\(prev\.loop_config::jsonb ->> 'verifyStep', ''\) = s\.step_id/);
    assert.match(peekRunningBypass, /COALESCE\(prev\.loop_config::jsonb ->> 'verifyStep', ''\) = s\.step_id/);

    const pendingLoopStart = peekSource.indexOf("s.status = 'pending'");
    const runningLoopStart = peekSource.indexOf("OR (s.status = 'running'", pendingLoopStart);
    assert.notEqual(pendingLoopStart, -1, "peek pending-loop source not found");
    assert.notEqual(runningLoopStart, -1, "peek running-loop source not found");
    const pendingLoopSource = peekSource.slice(pendingLoopStart, runningLoopStart);
    assert.match(pendingLoopSource, activeStoryGuard);
  });

  it("does not auto-complete retried stories from stale PRs", () => {
    const source = autoCompleteStoriesWithPRsSource();
    const retryGuard = source.indexOf("Number(rs.retry_count || 0)");
    const outputGuard = source.indexOf("ACTIONABLE_RETRY_OUTPUT_RE.test");
    const stalePrSkip = source.indexOf("skipping stale PR auto-complete");
    const prCompletion = source.indexOf("if (prFound && prUrlValid)");
    const doneUpdate = source.indexOf("UPDATE stories SET status = 'done'");

    assert.notEqual(retryGuard, -1, "retry_count guard not found");
    assert.notEqual(outputGuard, -1, "actionable retry output guard not found");
    assert.notEqual(stalePrSkip, -1, "stale PR skip log not found");
    assert.notEqual(prCompletion, -1, "PR completion branch not found");
    assert.notEqual(doneUpdate, -1, "story done update not found");
    assert.ok(retryGuard < prCompletion, "retry guard must run before PR completion");
    assert.ok(outputGuard < prCompletion, "actionable retry output guard must run before PR completion");
    assert.ok(stalePrSkip < doneUpdate, "retried stories must be skipped before status=done update");
    assert.match(source, /if \(retryCount > 0 \|\| hasActionableRetryOutput\) \{[\s\S]*continue;/);
    assert.match(stepOpsSource(), /ACTIONABLE_RETRY_OUTPUT_PATTERN = "PR_REVIEW_COMMENTS_OPEN\|actionable PR review comments\|APP_INTEGRATION_\[A-Z_\]\*REGRESSION\|POST_MERGE_QUALITY_REGRESSION\|VULNERABILITIES/);
  });

  it("allows implement to claim active QA-FIX stories even when older stories are done", () => {
    const source = claimImplementLoopSource();
    assert.match(source, /const activeQaFix = await pgGet/);
    assert.match(source, /story_id LIKE 'QA-FIX-%'/);
    assert.match(source, /parseInt\(awaitingVerify\?\.cnt \|\| "0", 10\) > 0[\s\S]*parseInt\(activeQaFix\?\.cnt \|\| "0", 10\) === 0/);
  });

  it("allows implement to claim retried stories even when stale done stories await verify", () => {
    const source = claimImplementLoopSource();
    const activeRetry = source.indexOf("const activeRetriedStory = await pgGet");
    const awaitingVerify = source.indexOf("const awaitingVerify = await pgGet");
    const waitGate = source.indexOf("parseInt(activeRetriedStory?.cnt || \"0\", 10) === 0");

    assert.notEqual(activeRetry, -1, "active retried story guard not found");
    assert.notEqual(awaitingVerify, -1, "awaiting verify lookup not found");
    assert.notEqual(waitGate, -1, "verify wait gate must check active retried stories");
    assert.ok(activeRetry < awaitingVerify, "active retry guard should be computed before verify wait decision");
    assert.ok(awaitingVerify < waitGate, "active retry guard must affect the pr-each wait gate");
    assert.match(stepOpsSource(), /ACTIONABLE_RETRY_OUTPUT_PATTERN = "PR_REVIEW_COMMENTS_OPEN\|actionable PR review comments/);
    assert.match(stepOpsSource(), /ACTIVE_RETRY_STORY_SQL = `\(retry_count > 0 OR COALESCE\(output, ''\) ~\* '\$\{ACTIONABLE_RETRY_OUTPUT_PATTERN\}'\)`/);
    assert.match(source, /status IN \('pending', 'running'\) AND \$\{ACTIVE_RETRY_STORY_SQL\}/);
  });

  it("prioritizes QA-FIX stories before normal pending stories", () => {
    const source = repoSource();
    const stepOps = stepOpsSource();
    const nextPendingStart = source.indexOf("export async function getNextPendingStory(");
    const claimNextStart = source.indexOf("export async function claimNextStory(");
    const claimNextEnd = source.indexOf("// Wave 14 Bug L", claimNextStart);
    const implementSelectionStart = stepOps.indexOf("// Legacy/shadow keep the historical dependency/status semantics byte-for-byte.");
    const implementSelectionEnd = stepOps.indexOf("if (!nextStory)", implementSelectionStart);
    assert.notEqual(nextPendingStart, -1, "getNextPendingStory source not found");
    assert.notEqual(claimNextStart, -1, "claimNextStory source not found");
    assert.notEqual(claimNextEnd, -1, "claimNextStory query block not found");
    assert.notEqual(implementSelectionStart, -1, "implement story selection source not found");
    assert.notEqual(implementSelectionEnd, -1, "implement story selection end not found");

    const nextPendingSource = source.slice(nextPendingStart, claimNextStart);
    const claimNextSource = source.slice(claimNextStart, claimNextEnd);
    const implementSelectionSource = stepOps.slice(implementSelectionStart, implementSelectionEnd);
    const qaFixOrder = /ORDER BY CASE WHEN story_id LIKE 'QA-FIX-%' THEN 0 ELSE 1 END, story_index ASC/;
    assert.match(nextPendingSource, qaFixOrder);
    assert.match(claimNextSource, qaFixOrder);
    assert.match(implementSelectionSource, qaFixOrder);
    assert.match(stepOps, /createV3NormalImplementationPreclaim/);
    assert.match(stepOps, /if \(runProtocol\?\.protocol === "v3"\)/);
  });

  it("does not hide pending stories after manager guard abandons", () => {
    const source = repoSource();
    const nextPendingStart = source.indexOf("export async function getNextPendingStory(");
    const claimNextStart = source.indexOf("export async function claimNextStory(");
    assert.notEqual(nextPendingStart, -1, "getNextPendingStory source not found");
    assert.notEqual(claimNextStart, -1, "claimNextStory source not found");

    const nextPendingSource = source.slice(nextPendingStart, claimNextStart);
    assert.match(nextPendingSource, /WHERE run_id = \$1 AND status = 'pending'/);
    assert.doesNotMatch(nextPendingSource, /abandoned_count\s*(?:IS NULL|<\s*3)/);
  });

  it("closes single-step failure claims by workflow step id, not step UUID", () => {
    const source = fs.readFileSync(path.join(root, "src", "installer", "step-fail.ts"), "utf-8");
    const owner = fs.readFileSync(path.join(root, "src", "execution", "claim-attempt-transition.ts"), "utf-8");
    const singleFailureStart = source.indexOf("async function handleSingleStepFailurePG(");
    const singleFailureEnd = source.indexOf("// Post-transaction side effects", singleFailureStart);
    assert.notEqual(singleFailureStart, -1, "handleSingleStepFailurePG source not found");
    assert.notEqual(singleFailureEnd, -1, "handleSingleStepFailurePG transaction block not found");
    const singleFailureSource = source.slice(singleFailureStart, singleFailureEnd);

    assert.match(singleFailureSource, /const workflowStepId = step\.step_id \|\| ""/);
    assert.match(singleFailureSource, /closeSingleStepClaimForFailure\(sql/);
    assert.match(source, /cl\.step_id = \$4/);
    assert.match(source, /r\.protocol = 'legacy'/);
    assert.match(owner, /claim\.step_id !== envelope\.workflowStepId/);
    assert.doesNotMatch(singleFailureSource, /UPDATE claim_log[\s\S]*step_id = \$\{stepId\}/);
  });

  it("emits workflow step ids instead of internal UUIDs for failStep terminal events", () => {
    const source = fs.readFileSync(path.join(root, "src", "installer", "step-fail.ts"), "utf-8");
    const failStepStart = source.indexOf("export async function failStep(");
    const loopStart = source.indexOf("async function handleLoopStepFailurePG(");
    const singleStart = source.indexOf("async function handleSingleStepFailurePG(");
    const singleEnd = source.indexOf("// ── Fallback Model Cron", singleStart);
    assert.notEqual(failStepStart, -1, "failStep source not found");
    assert.notEqual(loopStart, -1, "loop failure source not found");
    assert.notEqual(singleStart, -1, "single failure source not found");
    assert.notEqual(singleEnd, -1, "single failure end not found");

    const failStepSource = source.slice(failStepStart, loopStart);
    const loopSource = source.slice(loopStart, singleStart);
    const singleSource = source.slice(singleStart, singleEnd);

    assert.match(failStepSource, /SELECT id, run_id, step_id, step_index/);
    assert.match(loopSource, /const workflowStepId = step\.step_id \|\| stepId/);
    assert.match(loopSource, /event: "step\.failed"[\s\S]*stepId: workflowStepId/);
    assert.match(singleSource, /event: "step\.failed"[\s\S]*stepId: workflowStepId \|\| stepId/);
    assert.doesNotMatch(singleSource, /event: "step\.failed"[\s\S]{0,160}stepId: stepId/);
  });

  it("routes verify-each step fail quality reports back to implement", () => {
    const source = fs.readFileSync(path.join(root, "src", "installer", "step-fail.ts"), "utf-8");
    const helperStart = source.indexOf("function formatVerifyFailureAsRetryOutput(");
    const routeStart = source.indexOf("async function routeVerifyEachFailureToImplement(");
    const singleFailureStart = source.indexOf("async function handleSingleStepFailurePG(");
    assert.notEqual(helperStart, -1, "formatVerifyFailureAsRetryOutput source not found");
    assert.notEqual(routeStart, -1, "routeVerifyEachFailureToImplement source not found");
    assert.notEqual(singleFailureStart, -1, "handleSingleStepFailurePG source not found");
    const helperSource = source.slice(helperStart, routeStart);
    const routeSource = source.slice(routeStart, singleFailureStart);
    const singleFailureSource = source.slice(singleFailureStart, source.indexOf("  // Boost max_retries", singleFailureStart));

    assert.match(helperSource, /STATUS: retry/);
    assert.match(routeSource, /workflowStepId !== "verify"/);
    assert.match(routeSource, /isTransientAgentInfrastructureFailure\(error\)/);
    assert.match(source, /normalized\.includes\("masked_check_command"\)/);
    assert.match(routeSource, /type = 'loop' AND step_id = 'implement'/);
    assert.match(routeSource, /loopConfig\.verifyEach/);
    assert.match(routeSource, /loopConfig\.verifyStep \|\| "verify"/);
    assert.match(routeSource, /status = 'done'/);
    assert.match(routeSource, /formatVerifyFailureAsRetryOutput\(error\)/);
    assert.match(routeSource, /routeQualityFailureToImplement/);
    assert.match(singleFailureSource, /routeVerifyEachFailureToImplement\(stepId, step, workflowStepId, error, claimEnvelope\)/);
  });

  it("does not route exhausted PR review product loops into platform self-heal", () => {
    const source = fs.readFileSync(path.join(root, "src", "installer", "step-fail.ts"), "utf-8");
    const helperStart = source.indexOf("function isProductManualReviewTerminalFailure(");
    const helperEnd = source.indexOf("async function handleLoopStepFailurePG(", helperStart);
    const exhaustedStart = source.indexOf("if (newRetry > story.max_retries)");
    const exhaustedEnd = source.indexOf("return { retrying: false, runFailed: true };", exhaustedStart);
    assert.notEqual(helperStart, -1, "product manual review helper not found");
    assert.notEqual(helperEnd, -1, "product manual review helper end not found");
    assert.notEqual(exhaustedStart, -1, "story exhausted branch not found");
    assert.notEqual(exhaustedEnd, -1, "story exhausted branch end not found");

    const helperSource = source.slice(helperStart, helperEnd);
    const exhaustedSource = source.slice(exhaustedStart, exhaustedEnd);
    assert.match(helperSource, /PR_REVIEW_COMMENTS_OPEN/);
    assert.match(helperSource, /actionable PR review comments/);
    assert.match(helperSource, /DESIGN_IMPORT/);
    assert.match(exhaustedSource, /!isProductManualReviewTerminalFailure\(runFailReason\)/);
    assert.match(exhaustedSource, /recordTerminalPlatformSelfHealPlan/);
  });

  it("treats supervisor as a critical quality gate instead of skipping it", () => {
    const source = fs.readFileSync(path.join(root, "src", "installer", "step-fail.ts"), "utf-8");
    const criticalStart = source.indexOf("const CRITICAL_STEPS");
    const qualityStart = source.indexOf("const QUALITY_GATE_STEPS");
    const qualityEnd = source.indexOf("const QUALITY_GATE_MIN_RETRIES", qualityStart);
    assert.notEqual(criticalStart, -1, "CRITICAL_STEPS source not found");
    assert.notEqual(qualityStart, -1, "QUALITY_GATE_STEPS source not found");
    assert.notEqual(qualityEnd, -1, "QUALITY_GATE_STEPS end not found");

    const criticalSource = source.slice(criticalStart, qualityStart);
    const qualitySource = source.slice(qualityStart, qualityEnd);
    assert.match(criticalSource, /"supervise"/);
    assert.match(qualitySource, /"supervise"/);
  });

  it("feeds invalid supervisor output back into the next supervisor attempt", () => {
    const source = stepOpsSource();
    const onCompleteStart = source.indexOf("if (_stepModule.onComplete)");
    const supervisorFeedback = source.indexOf("SUPERVISOR_OUTPUT_INVALID", onCompleteStart);
    assert.notEqual(onCompleteStart, -1, "step module onComplete block not found");
    assert.notEqual(supervisorFeedback, -1, "supervisor output feedback context not found");

    const onCompleteSource = source.slice(onCompleteStart, source.indexOf("const supervisorPhase =", onCompleteStart));
    assert.match(onCompleteSource, /previous_failure/);
    assert.match(onCompleteSource, /failure_suggestion/);
    assert.match(onCompleteSource, /AC_COVERAGE must use the exact current story acceptance-criteria count/);
  });

  it("removes broad failStepWithOutput ownership and requests zero-story termination atomically", () => {
    const repo = repoSource();
    const source = stepOpsSource();
    const start = source.indexOf("const noStoriesMsg =");
    const end = source.indexOf("// T7: Loop step completion", start);
    assert.equal(repo.includes("export async function failStepWithOutput("), false);
    assert.notEqual(start, -1, "zero-story completeness guard not found");
    assert.notEqual(end, -1, "zero-story completeness guard end not found");
    const guard = source.slice(start, end);

    assert.match(guard, /await pgBegin\(async \(sql\) =>/);
    assert.match(guard, /closeExactSingleStepClaimInTransaction\(sql/);
    assert.match(guard, /closeUniqueSingleStepClaimForRecoveryInTransaction\(sql/);
    assert.match(guard, /requestRunTerminationInTransaction\(sql/);
    assert.match(guard, /targetStatus: "failed"/);
    assert.match(guard, /STORIES_COMPLETENESS_STEP_CAS_LOST/);
    assert.doesNotMatch(guard, /UPDATE claim_log/);
  });

  it("caps terminal failStep retry counters at configured max retries", () => {
    const source = fs.readFileSync(path.join(root, "src", "installer", "step-fail.ts"), "utf-8");
    const loopStart = source.indexOf("if (newRetry > story.max_retries)");
    const loopEnd = source.indexOf("return { retrying: false, runFailed: true };", loopStart);
    const singleStart = source.indexOf("if (newRetryCount > step.max_retries)");
    const singleEnd = source.indexOf("await cleanupProjectEphemera", singleStart);
    assert.notEqual(loopStart, -1, "loop story exhaustion branch not found");
    assert.notEqual(loopEnd, -1, "loop story exhaustion branch end not found");
    assert.notEqual(singleStart, -1, "single step exhaustion branch not found");
    assert.notEqual(singleEnd, -1, "single step exhaustion branch end not found");

    const loopSource = source.slice(loopStart, loopEnd);
    const singleSource = source.slice(singleStart, singleEnd);
    const singleTerminalSource = singleSource.slice(0, singleSource.indexOf("    } else {"));
    assert.match(loopSource, /const terminalRetry = Math\.max\(0, story\.max_retries \|\| 0\)/);
    assert.match(loopSource, /storyRetryCount: terminalRetry/);
    assert.match(source, /retry_count = COALESCE\(\$4, retry_count\)/);
    assert.match(singleSource, /const terminalRetry = Math\.max\(0, step\.max_retries \|\| 0\)/);
    assert.match(singleTerminalSource, /retry_count = \$\{terminalRetry\}/);
    assert.doesNotMatch(singleTerminalSource, /retry_count = \$\{newRetryCount\}/);
  });

  it("preserves actionable story retry output when loop failStep retries or exhausts", () => {
    const source = fs.readFileSync(path.join(root, "src", "installer", "step-fail.ts"), "utf-8");
    assert.match(source, /import \{ preserveActionableStoryRetryOutput \} from "\.\/retry-output\.js"/);
    assert.match(source, /SELECT id, retry_count, max_retries, output FROM stories WHERE id = \$1/);
    assert.match(source, /const storyOutput = preserveActionableStoryRetryOutput\(story\.output,\s*error\)/);
    assert.match(source, /Story \$\{storyRow\?\.story_id\} retries exhausted \(\$\{terminalRetry\}\/\$\{story\.max_retries\}\): \$\{storyOutput\}/);
    assert.match(source, /storyStatus: "failed",[\s\S]{0,180}storyOutput,[\s\S]{0,180}storyRetryCount: terminalRetry/);
    assert.match(source, /storyStatus: "pending",[\s\S]{0,180}storyOutput,[\s\S]{0,180}storyRetryCount: newRetry/);
    assert.match(source, /retry_count = COALESCE\(\$4, retry_count\)/);
  });

  it("terminal failRun delegates active-owner cleanup to the drained termination owner", () => {
    const repo = fs.readFileSync(path.join(root, "src", "installer", "repo.ts"), "utf-8");
    const owner = fs.readFileSync(path.join(root, "src", "execution", "run-terminal-transition.ts"), "utf-8");
    const failRun = repo.slice(repo.indexOf("export async function failRun("), repo.indexOf("async function recordTerminalPlatformSelfHealPlanFromRun"));
    assert.match(failRun, /requestRunTermination\(getSql\(\), \{/);
    assert.match(failRun, /targetStatus: "failed"/);
    assert.match(repo, /terminalFailure: terminal/);
    assert.doesNotMatch(failRun, /transitionRunToTerminal/);
    assert.match(owner, /RUN_TERMINAL_FAIL_DRAIN_PROOF_REQUIRED/);
    assert.match(owner, /UPDATE execution_attempts[\s\S]*disposition = \$4/);
    assert.match(owner, /UPDATE claim_log[\s\S]*outcome = \$2[\s\S]*WHERE run_id = \$1[\s\S]*AND outcome IS NULL/);
    assert.match(owner, /UPDATE stories[\s\S]*claimed_by = NULL[\s\S]*status IN \('pending',\s*'running'\)/);
    assert.match(owner, /UPDATE steps[\s\S]*current_story_id = NULL[\s\S]*status IN \('waiting',\s*'pending',\s*'running'\)/);
    assert.ok(owner.indexOf("UPDATE claim_log") < owner.indexOf("UPDATE execution_attempts"), "claims close before attempt fences");
    assert.ok(owner.indexOf("UPDATE claim_log") < owner.indexOf("UPDATE runs"), "claims close before terminal run publication");
  });

  it("fails loop runs on failed stories before pending siblings can keep the loop alive", () => {
    const source = fs.readFileSync(path.join(root, "src", "installer", "step-advance.ts"), "utf-8");
    const start = source.indexOf("export async function checkLoopContinuation(");
    const end = source.indexOf("// All stories verified/skipped", start);
    assert.notEqual(start, -1, "checkLoopContinuation source not found");
    assert.notEqual(end, -1, "checkLoopContinuation terminal guard end not found");
    const loopSource = source.slice(start, end);

    const failedCheck = loopSource.indexOf("SELECT COUNT(*) as cnt FROM stories WHERE run_id = $1 AND status = 'failed'");
    const pendingCheck = loopSource.indexOf('const pendingStory = await findStoryByStatus(runId, "pending")');
    assert.ok(failedCheck >= 0, "failed-story terminal guard must exist");
    assert.ok(pendingCheck >= 0, "pending-story continuation guard must exist");
    assert.ok(failedCheck < pendingCheck, "failed stories must terminally fail the loop before pending siblings are considered");
    assert.match(loopSource, /requestRunTerminationInTransaction\(sql, \{/);
    assert.match(loopSource, /targetStatus: "failed"/);
    assert.doesNotMatch(loopSource, /UPDATE runs SET status = 'failed'/);
  });

  it("preserves multiple actionable retry targets instead of replacing earlier quality feedback", () => {
    const quality = [
      "POST_MERGE_QUALITY_REGRESSION:",
      "STATUS: retry",
      "VULNERABILITIES:",
      "- assets/js/app.js:42 - XSS: innerHTML assignment without an obvious sanitizer in the file.",
    ].join("\n");
    const semantic = [
      "APP_INTEGRATION_SEMANTIC_REGRESSION: app/router diff removes previously accepted semantic UI contract \"data-action-id=add\".",
      "APP_INTEGRATION_SEMANTIC_REGRESSION: app/router diff removes previously accepted semantic UI contract \"data-action-id=reset\".",
    ].join("\n");
    const combined = preserveActionableStoryRetryOutput(quality, semantic);

    assert.match(combined, /POST_MERGE_QUALITY_REGRESSION/);
    assert.match(combined, /VULNERABILITIES/);
    assert.match(combined, /ALSO_FIX:/);
    assert.match(combined, /APP_INTEGRATION_SEMANTIC_REGRESSION/);
    assert.match(combined, /data-action-id=add/);
    assert.match(combined, /data-action-id=reset/);
  });

  it("preserves generated-screen quality guard feedback across infra requeues", () => {
    const quality = [
      "GUARDRAIL: Quality gate failed - 1 error(s) detected.",
      "QUALITY GATE: 1 error(s), 3 warning(s)",
      "GENERATED_SCREEN_VIEWPORT_MOUNT_UNSAFE: src/App.tsx mounts an absolute generated full-screen Stitch screen without stable viewport height.",
      "Fix these issues and retry.",
    ].join("\n");
    const infra = [
      "AGENT_STEP_STATE_MISMATCH: feature-dev_developer has an active feature-dev/developer process for implement, but the step is pending.",
      "Transcript: /tmp/transcript.log",
    ].join("\n");
    const combined = preserveActionableStoryRetryOutput(quality, infra);

    assert.match(combined, /GENERATED_SCREEN_VIEWPORT_MOUNT_UNSAFE/);
    assert.match(combined, /INFRA_RETRY:/);
    assert.match(combined, /AGENT_STEP_STATE_MISMATCH/);
  });

  it("preserves generated-screen quality guard feedback across masked-check requeues", () => {
    const quality = [
      "GUARDRAIL: Quality gate failed - 1 error(s) detected.",
      "GENERATED_SCREEN_VIEWPORT_MOUNT_UNSAFE: src/App.tsx needs a stable viewport root.",
    ].join("\n");
    const infra = [
      "MASKED_CHECK_COMMAND: feature-dev_developer ran deterministic build/test evidence through an output-filtering pipeline.",
      "Rerun the declared build/test command without a pipe.",
    ].join("\n");
    const combined = preserveActionableStoryRetryOutput(quality, infra);

    assert.match(combined, /GENERATED_SCREEN_VIEWPORT_MOUNT_UNSAFE/);
    assert.match(combined, /INFRA_RETRY:/);
    assert.match(combined, /MASKED_CHECK_COMMAND/);
    assert.ok(combined.indexOf("INFRA_RETRY:") < combined.indexOf("GENERATED_SCREEN_VIEWPORT_MOUNT_UNSAFE"));
  });

  it("keeps repeated runtime guard feedback visible before long actionable story output", () => {
    const quality = [
      "PR_REVIEW_COMMENTS_OPEN: US-002 has actionable PR review comments that must be fixed before merge.",
      "## PR Comments (2 actionable)",
      "thread=PRRT_one src/App.tsx:303 " + "long review context ".repeat(160),
    ].join("\n");
    const infra = [
      "MASKED_CHECK_COMMAND: feature-dev_developer ran deterministic build/test evidence through an output-filtering pipeline.",
      "Rerun the declared build/test command without a pipe.",
    ].join("\n");
    const combined = preserveActionableStoryRetryOutput(quality, infra);

    assert.match(combined, /^INFRA_RETRY:\nMASKED_CHECK_COMMAND:/);
    assert.match(combined, /STILL_OPEN_ACTIONABLE_FEEDBACK:/);
    assert.match(combined, /PR_REVIEW_COMMENTS_OPEN/);
    assert.ok(combined.indexOf("MASKED_CHECK_COMMAND") < combined.indexOf("PR_REVIEW_COMMENTS_OPEN"));
  });

  it("replaces stale pre-delta runtime discipline output on masked-check requeues", () => {
    const staleDiscipline = [
      "IMPLEMENT_PRE_DELTA_CONTEXT_SPRAWL: feature-dev_developer read 11 project/design context paths before any source delta.",
      "Paths included stitch/UI_CONTRACT.json.",
    ].join("\n");
    const infra = [
      "MASKED_CHECK_COMMAND: feature-dev_developer ran deterministic build/test evidence through an output-filtering pipeline.",
      "Rerun the declared build/test command without a pipe.",
    ].join("\n");
    const combined = preserveActionableStoryRetryOutput(staleDiscipline, infra);

    assert.doesNotMatch(combined, /IMPLEMENT_PRE_DELTA_CONTEXT_SPRAWL/);
    assert.doesNotMatch(combined, /INFRA_RETRY:/);
    assert.match(combined, /MASKED_CHECK_COMMAND/);
  });

  it("caps terminal story retry counters in quality and supervisor recovery paths", () => {
    const source = stepOpsSource();
    const terminalUpdates = [...source.matchAll(/UPDATE stories SET status = 'failed', retry_count = \$1[\s\S]{0,160}/g)].map((match) => match[0]);
    assert.ok(terminalUpdates.length >= 8, "expected terminal story retry updates in step-ops");
    for (const update of terminalUpdates) {
      assert.match(update, /\[terminalRetry,/, `terminal failed story retry must use terminalRetry: ${update}`);
      assert.doesNotMatch(update, /\[newRetry,/, `terminal failed story retry must not persist newRetry: ${update}`);
    }

    const qualityRouterStart = source.indexOf("async function routeOriginalStoryQualityFailureToImplement(");
    const qualityRouterEnd = source.indexOf("async function routeBlockingSupervisorEvidenceToImplement(", qualityRouterStart);
    const supervisorRouterEnd = source.indexOf("async function shouldAutoCompleteFinalSuperviseEachStep(", qualityRouterEnd);
    assert.notEqual(qualityRouterStart, -1, "original story quality router not found");
    assert.notEqual(qualityRouterEnd, -1, "blocking supervisor router start not found");
    assert.notEqual(supervisorRouterEnd, -1, "blocking supervisor router end not found");

    const qualityRouter = source.slice(qualityRouterStart, qualityRouterEnd);
    const supervisorRouter = source.slice(qualityRouterEnd, supervisorRouterEnd);
    assert.match(qualityRouter, /const terminalRetry = Math\.max\(0, retryStory\.max_retries \|\| 0\)/);
    assert.match(supervisorRouter, /const terminalRetry = Math\.max\(0, story\.max_retries \|\| 0\)/);
  });
});
