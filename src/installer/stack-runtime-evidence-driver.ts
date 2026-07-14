import fs from "node:fs";
import path from "node:path";
import { execFile, spawn, type ChildProcess } from "node:child_process";

import {
  RuntimeEvidenceContractV1Schema,
  type RuntimeCliInvocationV1,
  type RuntimeEvidenceContractV1,
  type RuntimeHttpInvocationV1,
} from "../evidence/runtime-evidence-contract-v1.js";
import { allocateRuntimePort } from "./runtime-ports.js";
import { WebPreviewRuntimeDriver } from "./web-runtime-driver.js";
import type {
  CapturedRuntimeState,
  InteractionRequest,
  InteractionResult,
  RuntimeDriver,
  RuntimeSession,
  StoryRuntimeContext,
} from "./runtime-driver.js";

type CliContract = Extract<RuntimeEvidenceContractV1, { adapter: "cli-process" }>;
type HttpContract = Extract<RuntimeEvidenceContractV1, { adapter: "http-service" }>;

type HttpSessionState = {
  context: StoryRuntimeContext;
  child: ChildProcess;
  stdout: string;
  stderr: string;
  spawnError?: string;
  lastCapture?: CapturedRuntimeState;
};

type DirectCommandResult = Readonly<{
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}>;

function nowIso(): string {
  return new Date().toISOString();
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeSegment(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 180) || "runtime";
}

function resolveRuntimeCwd(workdir: string, cwd: string): string {
  const root = path.resolve(workdir);
  const resolved = path.resolve(root, cwd);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error("RUNTIME_EVIDENCE_CWD_ESCAPE");
  }
  return resolved;
}

function renderRuntimeToken(value: string, session: RuntimeSession): string {
  return value
    .replaceAll("{{HOST}}", session.host)
    .replaceAll("{{PORT}}", session.port === null ? "" : String(session.port))
    .replaceAll("{{RUNTIME_URL}}", session.url ?? "");
}

function commandEnvironment(
  declared: Readonly<Record<string, string>> | undefined,
  session: RuntimeSession,
): NodeJS.ProcessEnv {
  return {
    ...process.env,
    CI: "true",
    ...Object.fromEntries(Object.entries(declared ?? {}).map(([key, value]) => [
      key,
      renderRuntimeToken(value, session),
    ])),
  };
}

async function runDirectCommand(input: Readonly<{
  workdir: string;
  session: RuntimeSession;
  command: RuntimeCliInvocationV1["command"];
  stdin?: string;
}>): Promise<DirectCommandResult> {
  const argv = input.command.argv.map((argument) => renderRuntimeToken(argument, input.session));
  return new Promise((resolve) => {
    const child = execFile(argv[0]!, argv.slice(1), {
      cwd: resolveRuntimeCwd(input.workdir, input.command.cwd),
      env: commandEnvironment(input.command.env, input.session),
      timeout: input.command.timeoutMs,
      maxBuffer: 10 * 1024 * 1024,
      encoding: "utf8",
    }, (error, stdout, stderr) => {
      const timedOut = Boolean(error && "killed" in error && error.killed);
      const code = error && "code" in error && typeof error.code === "number"
        ? error.code
        : error
          ? timedOut ? 124 : 1
          : 0;
      resolve({
        exitCode: code,
        stdout: String(stdout ?? ""),
        stderr: String(stderr ?? error?.message ?? ""),
        timedOut,
      });
    });
    child.stdin?.end(input.stdin ?? "");
  });
}

function jsonPointer(value: unknown, pointer: string): unknown {
  if (pointer === "") return value;
  let current = value;
  for (const encoded of pointer.slice(1).split("/")) {
    if (current === null || typeof current !== "object") return undefined;
    const key = encoded.replace(/~1/g, "/").replace(/~0/g, "~");
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function writeRuntimeSnapshot(input: Readonly<{
  session: RuntimeSession;
  phase: string;
  payload: Record<string, unknown>;
  raw: string;
  capture: RuntimeCliInvocationV1["capture"] | RuntimeHttpInvocationV1["capture"];
  url?: string;
}>): Readonly<{ capture: CapturedRuntimeState; captureOk: boolean; captureError?: string }> {
  const capturedAt = nowIso();
  let parsed: unknown;
  let state: unknown;
  let captureOk = true;
  let captureError: string | undefined;
  if (input.capture.format === "json") {
    try {
      parsed = JSON.parse(input.raw);
      state = jsonPointer(parsed, input.capture.statePointer);
      if (state === undefined) {
        captureOk = false;
        captureError = `JSON state pointer did not resolve: ${input.capture.statePointer}`;
      }
    } catch (error: any) {
      captureOk = false;
      captureError = `Runtime output is not valid JSON: ${String(error?.message || error).slice(0, 500)}`;
    }
  }
  const outDir = path.join(input.session.workdir, ".setfarm", "runtime", safeSegment(input.session.sessionId));
  fs.mkdirSync(outDir, { recursive: true });
  const runtimeSnapshotPath = path.join(
    outDir,
    `${safeSegment(input.phase)}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}.json`,
  );
  fs.writeFileSync(runtimeSnapshotPath, `${JSON.stringify({
    schema: "setfarm.stack-runtime-snapshot.v1",
    capturedAt,
    phase: input.phase,
    ...input.payload,
    raw: input.raw,
    parsed: parsed ?? null,
    state: state ?? null,
    captureOk,
    captureError: captureError ?? null,
  }, null, 2)}\n`);
  return {
    capture: {
      capturedAt,
      ...(input.url ? { url: input.url } : {}),
      runtimeSnapshotPath,
      stateBridge: input.capture.format === "json"
        ? { state: state ?? null, result: parsed ?? null }
        : { result: { text: input.raw } },
    },
    captureOk,
    ...(captureError ? { captureError } : {}),
  };
}

function unavailableCapture(session: RuntimeSession, phase: string): CapturedRuntimeState {
  const result = writeRuntimeSnapshot({
    session,
    phase,
    payload: { available: false },
    raw: "",
    capture: { format: "text" },
    ...(session.url ? { url: session.url } : {}),
  });
  return { ...result.capture, stateBridge: null };
}

export class CliProcessRuntimeEvidenceDriver implements RuntimeDriver {
  private readonly sessions = new Map<string, {
    context: StoryRuntimeContext;
    lastCapture?: CapturedRuntimeState;
  }>();

  constructor(private readonly contract: CliContract) {}

  async start(context: StoryRuntimeContext): Promise<RuntimeSession> {
    const session: RuntimeSession = {
      kind: "process",
      sessionId: `${safeSegment(context.runId).slice(0, 40)}-${safeSegment(context.storyId)}-cli-${Date.now()}`,
      workdir: context.workdir,
      host: context.host || "127.0.0.1",
      port: null,
      url: null,
      startedAt: nowIso(),
    };
    this.sessions.set(session.sessionId, { context });
    return session;
  }

  async waitReady(session: RuntimeSession): Promise<void> {
    if (!this.sessions.has(session.sessionId)) throw new Error("CLI_RUNTIME_SESSION_UNKNOWN");
  }

  private async execute(
    session: RuntimeSession,
    invocation: RuntimeCliInvocationV1,
    phase: string,
  ): Promise<Readonly<{ result: InteractionResult; capture: CapturedRuntimeState }>> {
    const startedAt = nowIso();
    const execution = await runDirectCommand({
      workdir: session.workdir,
      session,
      command: invocation.command,
      ...(invocation.stdin !== undefined ? { stdin: invocation.stdin } : {}),
    });
    const snapshot = writeRuntimeSnapshot({
      session,
      phase,
      payload: {
        adapter: "cli-process",
        stackPackId: this.contract.stackPackId,
        argv: invocation.command.argv,
        cwd: invocation.command.cwd,
        expectedExitCode: invocation.expectedExitCode,
        exitCode: execution.exitCode,
        stderr: execution.stderr,
        timedOut: execution.timedOut,
      },
      raw: execution.stdout,
      capture: invocation.capture,
    });
    const passed = execution.exitCode === invocation.expectedExitCode && snapshot.captureOk;
    return {
      result: {
        id: phase,
        action: "invoke",
        status: passed ? "pass" : "fail",
        startedAt,
        completedAt: nowIso(),
        ...(!passed ? {
          detail: snapshot.captureError
            ?? `CLI exit ${execution.exitCode}; expected ${invocation.expectedExitCode}. ${execution.stderr}`.slice(0, 1_000),
        } : {}),
      },
      capture: snapshot.capture,
    };
  }

  async interact(session: RuntimeSession, action: InteractionRequest): Promise<InteractionResult> {
    const state = this.sessions.get(session.sessionId);
    const phase = action.value === "reload" ? "reload" : "action";
    const binding = this.contract.actions.find((candidate) => candidate.actionRef === action.target);
    const invocation = phase === "reload" ? binding?.reload : binding?.action;
    if (!state || action.action !== "invoke" || !binding || !invocation) {
      const at = nowIso();
      return {
        id: action.id || action.action,
        action: action.action,
        status: "fail",
        startedAt: at,
        completedAt: nowIso(),
        detail: "CLI runtime request is not authorized by the sealed evidence contract.",
      };
    }
    const execution = await this.execute(session, invocation, `${phase}:${binding.actionRef}`);
    state.lastCapture = execution.capture;
    return { ...execution.result, id: action.id || execution.result.id };
  }

  async captureState(session: RuntimeSession): Promise<CapturedRuntimeState> {
    const state = this.sessions.get(session.sessionId);
    if (!state) throw new Error("CLI_RUNTIME_SESSION_UNKNOWN");
    if (state.lastCapture) return state.lastCapture;
    if (!this.contract.initial) {
      state.lastCapture = unavailableCapture(session, "initial");
      return state.lastCapture;
    }
    const initial = await this.execute(session, this.contract.initial, "initial");
    if (initial.result.status !== "pass") throw new Error(initial.result.detail || "CLI initial evidence failed.");
    state.lastCapture = initial.capture;
    return initial.capture;
  }

  async stop(session: RuntimeSession): Promise<void> {
    this.sessions.delete(session.sessionId);
  }
}

export class HttpServiceRuntimeEvidenceDriver implements RuntimeDriver {
  private readonly sessions = new Map<string, HttpSessionState>();

  constructor(private readonly contract: HttpContract) {}

  private spawnServer(
    context: StoryRuntimeContext,
    session: RuntimeSession,
    current?: HttpSessionState,
  ): HttpSessionState {
    const argv = this.contract.server.argv.map((argument) => renderRuntimeToken(argument, session));
    const child = spawn(argv[0]!, argv.slice(1), {
      cwd: resolveRuntimeCwd(context.workdir, this.contract.server.cwd),
      env: commandEnvironment(this.contract.server.env, session),
      stdio: ["ignore", "pipe", "pipe"],
    });
    const state: HttpSessionState = current ?? { context, child, stdout: "", stderr: "" };
    state.context = context;
    state.child = child;
    state.stdout = "";
    state.stderr = "";
    delete state.spawnError;
    child.stdout?.on("data", (chunk) => {
      if (state.child !== child) return;
      state.stdout = `${state.stdout}${String(chunk)}`.slice(-1_000_000);
    });
    child.stderr?.on("data", (chunk) => {
      if (state.child !== child) return;
      state.stderr = `${state.stderr}${String(chunk)}`.slice(-1_000_000);
    });
    child.once("error", (error) => {
      if (state.child !== child) return;
      state.spawnError = String(error?.message || error).slice(0, 1_000);
    });
    return state;
  }

  private async waitForExit(child: ChildProcess, timeoutMs: number): Promise<boolean> {
    if (child.exitCode !== null || child.signalCode !== null) return true;
    return new Promise((resolve) => {
      let settled = false;
      const finish = (exited: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        child.off("exit", onExit);
        resolve(exited);
      };
      const onExit = () => finish(true);
      const timer = setTimeout(() => finish(false), timeoutMs);
      child.once("exit", onExit);
    });
  }

  private async stopServer(state: HttpSessionState): Promise<void> {
    const child = state.child;
    if (child.exitCode !== null || child.signalCode !== null) return;
    child.kill("SIGTERM");
    if (await this.waitForExit(child, 1_000)) return;
    child.kill("SIGKILL");
    await this.waitForExit(child, 1_000);
  }

  private async restartServer(session: RuntimeSession, state: HttpSessionState): Promise<void> {
    await this.stopServer(state);
    this.spawnServer(state.context, session, state);
    await this.waitReady(session);
  }

  async start(context: StoryRuntimeContext): Promise<RuntimeSession> {
    const allocation = await allocateRuntimePort({
      runId: context.runId,
      runNumber: context.runNumber ?? null,
      band: "backend",
      preferredPort: context.preferredPort ?? null,
      host: context.host || "127.0.0.1",
    });
    const session: RuntimeSession = {
      kind: "process",
      sessionId: `${safeSegment(context.runId).slice(0, 40)}-${safeSegment(context.storyId)}-http-${allocation.port}`,
      workdir: context.workdir,
      host: allocation.host,
      port: allocation.port,
      url: allocation.url,
      startedAt: nowIso(),
    };
    const state = this.spawnServer(context, session);
    this.sessions.set(session.sessionId, state);
    return session;
  }

  async waitReady(session: RuntimeSession): Promise<void> {
    const state = this.sessions.get(session.sessionId);
    if (!state || !session.url) throw new Error("HTTP_RUNTIME_SESSION_UNKNOWN");
    const probe = this.contract.readiness;
    const url = `${session.url}${probe.path}`;
    const deadline = Date.now() + probe.timeoutMs;
    let lastError = "";
    while (Date.now() < deadline) {
      if (state.spawnError) throw new Error(`HTTP runtime failed to start: ${state.spawnError}`);
      if (state.child.exitCode !== null) {
        throw new Error(`HTTP runtime exited before readiness (${state.child.exitCode}): ${state.stderr.slice(-1_000)}`);
      }
      try {
        const response = await fetch(url, {
          method: probe.method,
          signal: AbortSignal.timeout(Math.min(2_000, Math.max(100, deadline - Date.now()))),
        });
        if (response.status === probe.expectedStatus) return;
        lastError = `HTTP ${response.status}; expected ${probe.expectedStatus}`;
      } catch (error: any) {
        lastError = String(error?.message || error).slice(0, 500);
      }
      await delay(100);
    }
    throw new Error(`HTTP runtime readiness failed at ${url}: ${lastError || "timeout"}`);
  }

  private async request(
    session: RuntimeSession,
    invocation: RuntimeHttpInvocationV1,
    phase: string,
  ): Promise<Readonly<{ result: InteractionResult; capture: CapturedRuntimeState }>> {
    const state = this.sessions.get(session.sessionId);
    if (!state || !session.url) throw new Error("HTTP_RUNTIME_SESSION_UNKNOWN");
    const startedAt = nowIso();
    const url = `${session.url}${invocation.path}`;
    let status = 0;
    let responseText = "";
    let requestError = "";
    try {
      const headers = { ...invocation.headers };
      if (invocation.body !== undefined && !Object.keys(headers).some((key) => key.toLowerCase() === "content-type")) {
        headers["content-type"] = "application/json";
      }
      const response = await fetch(url, {
        method: invocation.method,
        headers,
        ...(invocation.body !== undefined ? { body: JSON.stringify(invocation.body) } : {}),
        signal: AbortSignal.timeout(invocation.timeoutMs),
      });
      status = response.status;
      responseText = await response.text();
    } catch (error: any) {
      requestError = String(error?.message || error).slice(0, 1_000);
    }
    const snapshot = writeRuntimeSnapshot({
      session,
      phase,
      payload: {
        adapter: "http-service",
        stackPackId: this.contract.stackPackId,
        method: invocation.method,
        path: invocation.path,
        requestBody: invocation.body ?? null,
        expectedStatus: invocation.expectedStatus,
        status,
        requestError: requestError || null,
        serverStdout: state.stdout,
        serverStderr: state.stderr,
      },
      raw: responseText,
      capture: invocation.capture,
      url,
    });
    const passed = !requestError && status === invocation.expectedStatus && snapshot.captureOk;
    return {
      result: {
        id: phase,
        action: "invoke",
        status: passed ? "pass" : "fail",
        startedAt,
        completedAt: nowIso(),
        ...(!passed ? {
          detail: (snapshot.captureError ?? requestError)
            || `HTTP ${status}; expected ${invocation.expectedStatus}.`,
        } : {}),
      },
      capture: snapshot.capture,
    };
  }

  async interact(session: RuntimeSession, action: InteractionRequest): Promise<InteractionResult> {
    const state = this.sessions.get(session.sessionId);
    const phase = action.value === "reload" ? "reload" : "action";
    const binding = this.contract.actions.find((candidate) => candidate.actionRef === action.target);
    const invocation = phase === "reload" ? binding?.reload : binding?.action;
    if (!state || action.action !== "invoke" || !binding || !invocation) {
      const at = nowIso();
      return {
        id: action.id || action.action,
        action: action.action,
        status: "fail",
        startedAt: at,
        completedAt: nowIso(),
        detail: "HTTP runtime request is not authorized by the sealed evidence contract.",
      };
    }
    if (phase === "reload" && binding.reloadLifecycle === "restart") {
      await this.restartServer(session, state);
    }
    const execution = await this.request(session, invocation, `${phase}:${binding.actionRef}`);
    state.lastCapture = execution.capture;
    return { ...execution.result, id: action.id || execution.result.id };
  }

  async captureState(session: RuntimeSession): Promise<CapturedRuntimeState> {
    const state = this.sessions.get(session.sessionId);
    if (!state) throw new Error("HTTP_RUNTIME_SESSION_UNKNOWN");
    if (state.lastCapture) return state.lastCapture;
    if (!this.contract.initial) {
      state.lastCapture = unavailableCapture(session, "initial");
      return state.lastCapture;
    }
    const initial = await this.request(session, this.contract.initial, "initial");
    if (initial.result.status !== "pass") throw new Error(initial.result.detail || "HTTP initial evidence failed.");
    state.lastCapture = initial.capture;
    return initial.capture;
  }

  async stop(session: RuntimeSession): Promise<void> {
    const state = this.sessions.get(session.sessionId);
    this.sessions.delete(session.sessionId);
    if (!state) return;
    await this.stopServer(state);
  }
}

export function createStackRuntimeEvidenceDriver(contract: RuntimeEvidenceContractV1): RuntimeDriver {
  const parsed = RuntimeEvidenceContractV1Schema.parse(contract);
  if (parsed.adapter === "cli-process") return new CliProcessRuntimeEvidenceDriver(parsed);
  if (parsed.adapter === "http-service") return new HttpServiceRuntimeEvidenceDriver(parsed);
  return new WebPreviewRuntimeDriver({
    exactCommand: parsed.server,
    readinessPath: parsed.readiness.path,
    readinessMethod: parsed.readiness.method,
    readinessExpectedStatus: parsed.readiness.expectedStatus,
    captureAbi: parsed.capture,
    timeoutMs: parsed.readiness.timeoutMs,
  });
}
