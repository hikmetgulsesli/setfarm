/**
 * Setfarm Event-Driven Spawner
 * Listens to PostgreSQL NOTIFY events for pending steps/stories
 * and immediately spawns agent sessions via openclaw CLI.
 */
import postgres from "postgres";
import { execFile, execFileSync, spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { pgClose, pgGet, pgMigrate, pgQuery, pgRun } from "./db-pg.js";
import { loadWorkflowSpec } from "./installer/workflow-spec.js";
import { resolveWorkflowDir, resolveSetfarmCli } from "./installer/paths.js";
import { claimStep, completeStep } from "./installer/step-ops.js";
import { failStep } from "./installer/step-fail.js";
import { cleanupProjectEphemera } from "./installer/cleanup-ops.js";

const OPENCLAW_CLI = process.env.OPENCLAW_CLI || "/home/setrox/.local/bin/openclaw";
const OPENCLAW_TASKS_DB = process.env.OPENCLAW_TASKS_DB || path.join(os.homedir(), ".openclaw", "tasks", "runs.sqlite");
const POLL_INTERVAL_MS = 30_000;
const AGENT_TIMEOUT_SECONDS = 1800;
const PID_FILE = path.join(os.homedir(), ".openclaw", "setfarm", "spawner.pid");
const MAX_CONCURRENT = 8;
const SPAWN_STAGGER_MS = parseInt(process.env.SETFARM_SPAWN_STAGGER_MS || "12000", 10);
const WORKFLOW_DEFER_RETRY_MS = parsePositiveInt(process.env.SETFARM_WORKFLOW_DEFER_RETRY_MS, POLL_INTERVAL_MS);
const BACKGROUND_WORKFLOWS = new Set((process.env.SETFARM_BACKGROUND_WORKFLOWS || "daily-standup")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean));
const NON_DEVELOPER_STUCK_MS = parsePositiveInt(process.env.SETFARM_AGENT_STUCK_MS, 12 * 60_000);
const DEVELOPER_STUCK_MS = parsePositiveInt(process.env.SETFARM_DEVELOPER_AGENT_STUCK_MS, 15 * 60_000);
const QA_FIX_AGENT_STUCK_MS = parsePositiveInt(process.env.SETFARM_QA_FIX_AGENT_STUCK_MS, 8 * 60_000);
const STARTUP_RUNNING_GRACE_MS = parsePositiveInt(process.env.SETFARM_STARTUP_RUNNING_GRACE_MS, 0);
const QA_AGENT_STUCK_MS = parsePositiveInt(process.env.SETFARM_QA_AGENT_STUCK_MS, 18 * 60_000);
const AGENT_ACTIVITY_GRACE_MS = parsePositiveInt(process.env.SETFARM_AGENT_ACTIVITY_GRACE_MS, 4 * 60_000);
const AGENT_STARTUP_SILENCE_MS = parsePositiveInt(process.env.SETFARM_AGENT_STARTUP_SILENCE_MS, 4 * 60_000);
const REAP_FINISHED_ACTIVE_GRACE_MS = parsePositiveInt(process.env.SETFARM_REAP_FINISHED_ACTIVE_GRACE_MS, 60_000);
const OPENCLAW_TASK_REGISTRY_SETTLE_MS = parsePositiveInt(process.env.SETFARM_OPENCLAW_TASK_REGISTRY_SETTLE_MS, 2000);
const OPENCLAW_STALE_TASK_SWEEP_MS = parsePositiveInt(process.env.SETFARM_OPENCLAW_STALE_TASK_SWEEP_MS, 2 * 60_000);
const IMPLEMENT_EXIT_RECOVERY_BUILD_TIMEOUT_MS = parsePositiveInt(process.env.SETFARM_IMPLEMENT_EXIT_RECOVERY_BUILD_TIMEOUT_MS, 120_000);
const OPENCLAW_AGENT_LOCAL = process.env.SETFARM_OPENCLAW_AGENT_LOCAL !== "0";
const GATEWAY_HEALTH_URL = process.env.OPENCLAW_GATEWAY_HEALTH_URL || "http://127.0.0.1:18789/health";
const GATEWAY_READY_URL = process.env.OPENCLAW_GATEWAY_READY_URL || GATEWAY_HEALTH_URL.replace(/\/health\/?$/, "/ready");
const GATEWAY_PRESPAWN_RETRY_MS = parsePositiveInt(process.env.SETFARM_GATEWAY_PRESPAWN_RETRY_MS, 10_000);
const GATEWAY_WARMUP_MS = parsePositiveInt(process.env.SETFARM_GATEWAY_WARMUP_MS, 45_000);
const GATEWAY_SIDECAR_BYPASS_AFTER_MS = parsePositiveInt(process.env.SETFARM_GATEWAY_SIDECAR_BYPASS_AFTER_MS, 30_000);
const GATEWAY_TIMEOUT_BYPASS_AFTER_MS = parsePositiveInt(process.env.SETFARM_GATEWAY_TIMEOUT_BYPASS_AFTER_MS, 2 * 60_000);
const GATEWAY_PRESPAWN_RESTART_AFTER_MS = parsePositiveInt(process.env.SETFARM_GATEWAY_PRESPAWN_RESTART_AFTER_MS, 90_000);
const GATEWAY_PRESPAWN_RESTART_COOLDOWN_MS = parsePositiveInt(process.env.SETFARM_GATEWAY_PRESPAWN_RESTART_COOLDOWN_MS, 5 * 60_000);
const GATEWAY_IGNORABLE_FAILING = new Set((process.env.SETFARM_GATEWAY_IGNORABLE_FAILING || "startup-sidecars,whatsapp,telegram,browser,gmail")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean));
const spawnerStartedAtMs = Date.now();
let gatewayNotReadySinceMs: number | null = null;
let gatewayRestartInFlight = false;
let lastGatewayPrespawnRestartMs = 0;
let lastGatewayCleanupRestartMs = 0;

// Wave 13 Bug M (run #344 postmortem): agent default cwd must NOT be the
// setfarm-repo. Previously execFile inherited the spawner's cwd (the systemd
// service's WorkingDirectory = ~/.openclaw/setfarm-repo). If the polling
// prompt told the agent to `cd $story_workdir` and the agent skipped that
// step, it would fall through to writing files, staging, committing and
// pushing INSIDE setfarm-repo. Run #344 caught it: Prism wrote a 1067-line
// pomodoro timer into src/lib/ and pushed it to setfarm-repo/main. The
// Wave 12 cross-project guard now detects it in agent output, but this is
// the proactive layer: start every agent in a non-git scratch directory so
// stray `git` commands fail with "not a git repository" instead of silently
// landing in the wrong repo.
const SETFARM_SRC = path.resolve(process.env.SETFARM_REPO_DIR || path.join(os.homedir(), ".openclaw", "setfarm-repo"));
const AGENT_SAFE_CWD = path.join(os.homedir(), ".openclaw", "workspace", "agent-scratch");
const TRANSCRIPT_ROOT = path.join(os.homedir(), ".openclaw", "workspace", "transcripts");
const OPENCLAW_AGENTS_ROOT = path.join(os.homedir(), ".openclaw", "agents");

function assertAgentCwdSafe(): void {
  // cuddly-sleeping-quail: refuse to spawn agents inside the platform source tree.
  // A misconfigured cwd has historically corrupted setfarm-repo itself (agents
  // writing project code into src/, committing to a story branch, then npm run
  // build rebuilt dist/ from the stale checkout). This is the last-line check —
  // runtime-guard + write-build-info stop it earlier; this stops any spawner
  // that bypassed those.
  const resolved = path.resolve(AGENT_SAFE_CWD);
  if (resolved === SETFARM_SRC || resolved.startsWith(SETFARM_SRC + path.sep)) {
    throw new Error("SELF_CONTAIN_VIOLATION: AGENT_SAFE_CWD (" + resolved + ") resolves inside platform source tree (" + SETFARM_SRC + "). Refusing to spawn agents — they would corrupt setfarm-repo.");
  }
}
try { fs.mkdirSync(AGENT_SAFE_CWD, { recursive: true }); } catch { /* best-effort */ }
try { fs.mkdirSync(TRANSCRIPT_ROOT, { recursive: true }); } catch { /* best-effort */ }
assertAgentCwdSafe();

function safeAgentCwdFromCandidate(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let candidate = raw.trim();
  if (!candidate || candidate.includes("<") || candidate.includes(">") || candidate.includes("[missing:")) return null;
  if (candidate.startsWith("~/")) candidate = path.join(os.homedir(), candidate.slice(2));
  if (candidate.includes("$HOME") || candidate.startsWith("~")) return null;
  if (!path.isAbsolute(candidate)) return null;

  const resolved = path.resolve(candidate);
  if (resolved === SETFARM_SRC || resolved.startsWith(SETFARM_SRC + path.sep)) return null;
  try {
    if (!fs.statSync(resolved).isDirectory()) return null;
  } catch {
    return null;
  }
  return resolved;
}

function safeAgentCwdFromClaimInput(input: unknown): string {
  if (input && typeof input === "object" && !Array.isArray(input)) {
    const record = input as Record<string, unknown>;
    for (const key of ["story_workdir", "repo", "REPO", "workdir", "WORKDIR"]) {
      const resolved = safeAgentCwdFromCandidate(record[key]);
      if (resolved) return resolved;
    }
    return AGENT_SAFE_CWD;
  }

  if (typeof input === "string") {
    try {
      const parsed = JSON.parse(input) as unknown;
      const resolved = safeAgentCwdFromClaimInput(parsed);
      if (resolved !== AGENT_SAFE_CWD) return resolved;
    } catch {}

    for (const match of input.matchAll(/(?:story_workdir|WORKDIR|REPO|repo)\s*[:=]\s*([^\s"'`]+)/g)) {
      const resolved = safeAgentCwdFromCandidate(match[1]);
      if (resolved) return resolved;
    }
  }

  return AGENT_SAFE_CWD;
}

type ActiveProcess = {
  child: ChildProcess;
  runId: string;
  stepId: string;
  storyId?: string;
  storyDbId?: string;
  agentId: string;
  wfId: string;
  role: string;
  startedAtMs: number;
  transcriptPath: string;
  initialTranscriptSize: number;
  outputPath: string;
  spawnCwd: string;
  sessionId: string;
  sessionKey: string;
  sessionJsonlPath: string;
};

type OpenClawTaskRecord = {
  taskId?: string;
  status?: string;
  runtime?: string;
  requesterSessionKey?: string;
  ownerKey?: string;
  childSessionKey?: string;
};

type OpenClawSessionIndexRecord = {
  sessionId?: string;
  sessionFile?: string;
  status?: string;
  updatedAt?: number;
  abortedLastRun?: boolean;
};

type OpenClawCleanupResult = {
  sessions: number;
  tasks: number;
};

const activeProcesses = new Map<string, ActiveProcess>();
const queuedSpawns = new Set<string>();
const claimingSpawns = new Set<string>();
let shuttingDown = false;
let nextSpawnEarliest = 0;

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const parsed = parseInt(raw || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function formatDurationMs(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes > 0 ? `${minutes}m${rest}s` : `${rest}s`;
}

function stuckThresholdMs(role: string, storyId?: string | null): number {
  if (storyId?.startsWith("QA-FIX-")) return QA_FIX_AGENT_STUCK_MS;
  if (role.includes("qa") || role.includes("test")) return QA_AGENT_STUCK_MS;
  return role === "developer" ? DEVELOPER_STUCK_MS : NON_DEVELOPER_STUCK_MS;
}

function agentSessionJsonlPath(agentId: string, sessionId: string): string {
  return path.join(OPENCLAW_AGENTS_ROOT, agentId, "sessions", `${sessionId}.jsonl`);
}

function fileSize(filePath: string): number {
  try {
    const stat = fs.statSync(filePath);
    return Number.isFinite(stat.size) ? stat.size : 0;
  } catch {
    return 0;
  }
}

function activeProcessHasVisibleOutput(active: ActiveProcess): boolean {
  if (fileSize(active.transcriptPath) > active.initialTranscriptSize) return true;
  return fileSize(active.outputPath) > 0;
}

function activeProcessHasStartupActivity(active: ActiveProcess): boolean {
  if (activeProcessHasVisibleOutput(active)) return true;
  return activeProcessLastActivityMs(active) > active.startedAtMs + 1000;
}

function activeProcessLastActivityMs(active: ActiveProcess): number {
  let lastActivityMs = active.startedAtMs;
  for (const filePath of [active.transcriptPath, active.sessionJsonlPath, active.outputPath]) {
    try {
      const mtimeMs = fs.statSync(filePath).mtimeMs;
      if (Number.isFinite(mtimeMs) && mtimeMs > lastActivityMs) lastActivityMs = mtimeMs;
    } catch {}
  }
  return lastActivityMs;
}

function activeProcessIdleMs(active: ActiveProcess): number {
  return Date.now() - activeProcessLastActivityMs(active);
}

type GatewayReadyBody = { ready?: boolean; ok?: boolean; uptimeMs?: number; failing?: unknown };

type GatewayReadiness = {
  ready: boolean;
  reason: string;
  retryAfterMs: number;
};

function isBackgroundWorkflow(wfId: string): boolean {
  return BACKGROUND_WORKFLOWS.has(wfId);
}

async function shouldDeferBackgroundWorkflow(wfId: string): Promise<boolean> {
  if (!isBackgroundWorkflow(wfId)) return false;
  const row = await pgGet<{ cnt: string }>(
    "SELECT COUNT(*) as cnt FROM runs WHERE status = 'running' AND workflow_id <> ALL($1::text[])",
    [[...BACKGROUND_WORKFLOWS]],
  );
  return parseInt(row?.cnt || "0", 10) > 0;
}

function gatewayFailingList(body: GatewayReadyBody): string[] {
  return Array.isArray(body.failing) ? body.failing.map((item) => String(item)).filter(Boolean) : [];
}

function hasOnlyIgnorableGatewayFailures(body: GatewayReadyBody): boolean {
  const failing = gatewayFailingList(body);
  return failing.length > 0 && failing.every((item) => GATEWAY_IGNORABLE_FAILING.has(item));
}

function canBypassGatewaySidecars(body: GatewayReadyBody): boolean {
  return hasOnlyIgnorableGatewayFailures(body)
    && typeof body.uptimeMs === "number"
    && Number.isFinite(body.uptimeMs)
    && body.uptimeMs >= GATEWAY_SIDECAR_BYPASS_AFTER_MS;
}

async function getGatewayReadiness(): Promise<GatewayReadiness> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch(GATEWAY_READY_URL, { signal: controller.signal });
    const text = await res.text();
    let body: GatewayReadyBody = {};
    if (text.trim()) {
      try {
        body = JSON.parse(text);
      } catch {
        // Some gateway endpoints return plain text/html after readiness. Treat 2xx as ready.
      }
    }
    if (!res.ok) {
      if (canBypassGatewaySidecars(body)) {
        return { ready: true, reason: `agent-ready; ignoring gateway sidecars: ${gatewayFailingList(body).join(",")}`, retryAfterMs: 0 };
      }
      const failing = gatewayFailingList(body);
      const suffix = failing.length ? `; failing=${failing.join(",")}` : "";
      return { ready: false, reason: `ready endpoint returned HTTP ${res.status}${suffix}`, retryAfterMs: GATEWAY_PRESPAWN_RETRY_MS };
    }
    if (body.ready === false) {
      if (canBypassGatewaySidecars(body)) {
        return { ready: true, reason: `agent-ready; ignoring gateway sidecars: ${gatewayFailingList(body).join(",")}`, retryAfterMs: 0 };
      }
      const failing = gatewayFailingList(body);
      const suffix = failing.length ? `; failing=${failing.join(",")}` : "";
      return { ready: false, reason: `gateway reports not ready${suffix}`, retryAfterMs: GATEWAY_PRESPAWN_RETRY_MS };
    }
    if (typeof body.uptimeMs === "number" && Number.isFinite(body.uptimeMs) && body.uptimeMs < GATEWAY_WARMUP_MS) {
      const remainingMs = GATEWAY_WARMUP_MS - body.uptimeMs;
      const retryAfterMs = Math.min(Math.max(remainingMs, GATEWAY_PRESPAWN_RETRY_MS), GATEWAY_WARMUP_MS);
      return { ready: false, reason: `gateway warmup active for ${formatDurationMs(remainingMs)}`, retryAfterMs };
    }
    if (typeof body.uptimeMs !== "number") {
      const processWarmupRemainingMs = GATEWAY_WARMUP_MS - (Date.now() - spawnerStartedAtMs);
      if (processWarmupRemainingMs > 0) {
        const retryAfterMs = Math.min(Math.max(processWarmupRemainingMs, GATEWAY_PRESPAWN_RETRY_MS), GATEWAY_WARMUP_MS);
        return { ready: false, reason: `spawner warmup fallback active for ${formatDurationMs(processWarmupRemainingMs)}`, retryAfterMs };
      }
    }
    if (body.ready === true || body.ok === true || !text.trim()) {
      return { ready: true, reason: "ready", retryAfterMs: 0 };
    }
    return { ready: true, reason: "ready endpoint returned HTTP 2xx", retryAfterMs: 0 };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const healthController = new AbortController();
    const healthTimeout = setTimeout(() => healthController.abort(), 2000);
    try {
      const healthRes = await fetch(GATEWAY_HEALTH_URL, { signal: healthController.signal });
      const healthText = await healthRes.text();
      let healthBody: GatewayReadyBody = {};
      if (healthText.trim()) {
        try {
          healthBody = JSON.parse(healthText);
        } catch {
          // Plain text health responses are acceptable when HTTP status is 2xx.
        }
      }
      if (healthRes.ok && healthBody.ok !== false && healthBody.ready !== false) {
        return { ready: true, reason: `ready endpoint unavailable (${message}); health endpoint returned HTTP 2xx`, retryAfterMs: 0 };
      }
    } catch {
      // Fall through to the original readiness failure.
    } finally {
      clearTimeout(healthTimeout);
    }
    if (gatewayNotReadySinceMs !== null && Date.now() - gatewayNotReadySinceMs >= GATEWAY_TIMEOUT_BYPASS_AFTER_MS) {
      return { ready: true, reason: `gateway probe timeout bypass after ${formatDurationMs(Date.now() - gatewayNotReadySinceMs)}: ${message}`, retryAfterMs: 0 };
    }
    return { ready: false, reason: `ready endpoint unavailable: ${message}`, retryAfterMs: GATEWAY_PRESPAWN_RETRY_MS };
  } finally {
    clearTimeout(timeout);
  }
}

function noteGatewayReady(): void {
  gatewayNotReadySinceMs = null;
}

function maybeRestartGatewayForReadiness(reason: string, key: string): void {
  const nowMs = Date.now();
  if (gatewayNotReadySinceMs === null) gatewayNotReadySinceMs = nowMs;
  const notReadyAgeMs = nowMs - gatewayNotReadySinceMs;
  if (notReadyAgeMs < GATEWAY_PRESPAWN_RESTART_AFTER_MS) return;
  if (gatewayRestartInFlight) return;
  if (activeProcesses.size > 0) return;
  if (nowMs - lastGatewayPrespawnRestartMs < GATEWAY_PRESPAWN_RESTART_COOLDOWN_MS) return;

  gatewayRestartInFlight = true;
  lastGatewayPrespawnRestartMs = nowMs;
  console.warn(`[spawner] Gateway not ready for ${formatDurationMs(notReadyAgeMs)} before ${key}; restarting openclaw-gateway. reason=${reason}`);
  execFile("systemctl", ["--user", "restart", "openclaw-gateway"], { timeout: 20_000 }, (err, stdout, stderr) => {
    gatewayRestartInFlight = false;
    if (err) {
      const msg = compactExitReason(stderr || stdout || (err as any).message || err);
      console.warn(`[spawner] gateway prespawn restart failed: ${msg}`);
      return;
    }
    gatewayNotReadySinceMs = null;
    console.log("[spawner] gateway prespawn restart completed");
  });
}

function buildOpenClawChildEnv(): NodeJS.ProcessEnv {
  const e: Record<string, string | undefined> = { ...process.env, OPENCLAW_AUTO_APPROVE: "1" };
  for (const k of ["SETFARM_PG_URL", "MASTER_POSTGRES_URL", "MASTER_MARIADB_URL", "MASTER_MONGODB_URL"]) {
    delete e[k];
  }
  // Project agents run build, test, and verification commands. A global
  // NODE_ENV=production from the service environment makes React/Vitest load
  // production React, which breaks Testing Library's act() and creates false
  // QA failures. Let package scripts or explicit commands set NODE_ENV.
  delete e["NODE_ENV"];
  return e as NodeJS.ProcessEnv;
}

function buildSessionKey(agentId: string, sessionId: string): string {
  return `agent:${agentId}:explicit:${sessionId}`;
}

function resolveAgentId(wfId: string, role: string, mapping: Record<string, string | string[]>): string[] {
  // cuddly-sleeping-quail: respect agent_mapping the same way agent-cron does.
  // Previously this fell back to `${wfId}_${role}` for single-string mappings,
  // which is NOT a registered gateway agent ID — gateway agents are named in
  // openclaw config (main, mert, atlas, koda, ...). The fallback caused two
  // concurrent processes to claim the same step (cron used the mapped name,
  // spawner used the bogus fallback) and write competing /tmp output files.
  // Run #379 plan retry 0/1 hit this race; only retry 2 caught the cron output.
  const m = mapping[role];
  if (Array.isArray(m)) return m;
  if (typeof m === "string" && m.length > 0) return [m];
  return [`${wfId}_${role}`];
}

function buildPreclaimedPrompt(wfId: string, role: string, agentId: string, outputFileId: string, claimFile: string): string {
  const cli = resolveSetfarmCli();
  const cliCommand = "/usr/bin/node " + cli;
  return `Setfarm claim ready. First action MUST be exec. No prose or HEARTBEAT before exec.

CLAIM_FILE=${claimFile}
OUTPUT_FILE=/tmp/setfarm-output-${outputFileId}.txt

First exec command should start with:
CLAIM_FILE='${claimFile}'; OUTPUT_FILE='/tmp/setfarm-output-${outputFileId}.txt'; STEP_ID=$(jq -r '.stepId // empty' "$CLAIM_FILE"); WORKDIR=$(jq -r 'if (.input|type)=="object" then (.input.story_workdir // .input.repo // "") else "" end' "$CLAIM_FILE"); if [ -z "$WORKDIR" ]; then WORKDIR=$(jq -r 'if (.input|type)=="string" then .input else "" end' "$CLAIM_FILE" | sed -n 's/^WORKDIR:[[:space:]]*//p; s/^REPO:[[:space:]]*//p' | head -1); fi; case "$WORKDIR" in ""|*"<"*|*">"*|*"[missing:"*|*'$HOME'*|~*) WORKDIR="$HOME/.openclaw/workspace/agent-scratch";; esac; mkdir -p "$WORKDIR"; cd "$WORKDIR"; case "$(pwd)" in "$HOME"/.openclaw/setfarm-repo*) echo FATAL_PLATFORM_CWD; exit 1;; esac; printf 'STEP_ID=%s\nWORKDIR=%s\n' "$STEP_ID" "$(pwd)"; jq -r 'if (.input|type)=="object" then (.input.task // .input.current_story_title // .input.story_title // "") else .input end' "$CLAIM_FILE" | head -c 1200; echo

Do ${wfId}/${role} work in WORKDIR only. Read CLAIM_FILE for exact requirements. Do NOT run step peek/claim. No subagents/background delegation. No PR actions unless claim explicitly owns PR work.
For normal quality findings in verify/review/QA/final-test, do NOT use step fail. Write STATUS: retry with concise findings and call step complete so the platform can route the batched fix back to implement. Use step fail only for infrastructure/unrecoverable execution failures.

Complete with:
cat > /tmp/setfarm-output-${outputFileId}.txt <<'SETFARM_EOF'
STATUS: done
<required claim output keys>
SETFARM_EOF
${cliCommand} step complete "$STEP_ID" --file /tmp/setfarm-output-${outputFileId}.txt

Fail with: ${cliCommand} step fail "$STEP_ID" "specific reason"
After complete/fail, reply HEARTBEAT_OK and stop.`;
}

function compactExitReason(err: unknown): string {
  return String((err as any)?.message || err || "unknown error").replace(/\s+/g, " ").slice(0, 700);
}

function isCleanZeroExit(err: unknown): boolean {
  return /code\s*=?\s*0|exited with code 0/i.test(compactExitReason(err));
}

function killProcessTree(pid: number | undefined, signal: NodeJS.Signals = "SIGTERM"): void {
  if (!pid) return;
  try {
    const out = execFileSync("pgrep", ["-P", String(pid)], { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    for (const childPid of out.split(/\s+/).filter(Boolean)) {
      killProcessTree(Number(childPid), signal);
    }
  } catch {
    // no children or pgrep unavailable
  }
  try { process.kill(pid, signal); } catch { /* already dead */ }
}

function childProcessTerminalReason(child: ChildProcess): string | null {
  if (child.exitCode !== null) return `exitCode=${child.exitCode}`;
  if (child.signalCode !== null) return `signal=${child.signalCode}`;
  if (!child.pid) return "missing pid";
  try {
    const stat = execFileSync("ps", ["-o", "stat=", "-p", String(child.pid)], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 1000,
    }).trim();
    if (!stat) return "pid not found";
    if (stat.startsWith("Z")) return `zombie stat=${stat}`;
  } catch {
    return "pid not found";
  }
  return null;
}

function parseOpenClawTaskList(stdout: string): OpenClawTaskRecord[] {
  const parsed = JSON.parse(stdout || "{}") as { tasks?: OpenClawTaskRecord[] } | OpenClawTaskRecord[];
  if (Array.isArray(parsed)) return parsed;
  return Array.isArray(parsed.tasks) ? parsed.tasks : [];
}

function taskBelongsToLookup(task: OpenClawTaskRecord, lookup: string): boolean {
  return task.requesterSessionKey === lookup || task.ownerKey === lookup || task.childSessionKey === lookup;
}

function taskSessionKeys(task: OpenClawTaskRecord): string[] {
  return [task.requesterSessionKey, task.ownerKey, task.childSessionKey]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
}

function isSetfarmSpawnerSessionKey(sessionKey: string): boolean {
  return /^agent:[^:]+:explicit:spawner-/.test(sessionKey);
}

function isTaskForActiveProcess(task: OpenClawTaskRecord): boolean {
  const keys = taskSessionKeys(task);
  for (const active of activeProcesses.values()) {
    if (keys.includes(active.sessionKey)) return true;
  }
  return false;
}

function sqliteString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function activeSessionKeyExclusionSql(): string {
  const activeKeys = [...activeProcesses.values()].map((active) => active.sessionKey).filter(Boolean);
  if (activeKeys.length === 0) return "";
  const values = activeKeys.map(sqliteString).join(", ");
  return [
    "AND NOT (",
    `COALESCE(requester_session_key, '') IN (${values})`,
    `OR COALESCE(owner_key, '') IN (${values})`,
    `OR COALESCE(child_session_key, '') IN (${values})`,
    ")",
  ].join(" ");
}

function activeSessionKeys(): Set<string> {
  return new Set([...activeProcesses.values()].map((active) => active.sessionKey).filter(Boolean));
}

function cleanupOpenClawSessionLockSync(agentDir: string, record: OpenClawSessionIndexRecord): boolean {
  const candidates = new Set<string>();
  if (record.sessionFile) candidates.add(`${record.sessionFile}.lock`);
  if (record.sessionId) candidates.add(path.join(OPENCLAW_AGENTS_ROOT, agentDir, "sessions", `${record.sessionId}.jsonl.lock`));

  let removed = false;
  for (const lockPath of candidates) {
    try {
      fs.unlinkSync(lockPath);
      removed = true;
    } catch {}
  }
  return removed;
}

function cleanupStaleSetfarmOpenClawSessionRecordsSync(context: string): number {
  const activeKeys = activeSessionKeys();
  const now = Date.now();
  let changed = 0;
  let locksRemoved = 0;

  let agentDirs: string[] = [];
  try {
    agentDirs = fs.readdirSync(OPENCLAW_AGENTS_ROOT);
  } catch {
    return 0;
  }

  for (const agentDir of agentDirs) {
    const sessionsPath = path.join(OPENCLAW_AGENTS_ROOT, agentDir, "sessions", "sessions.json");
    let parsed: Record<string, OpenClawSessionIndexRecord>;
    try {
      parsed = JSON.parse(fs.readFileSync(sessionsPath, "utf-8")) as Record<string, OpenClawSessionIndexRecord>;
    } catch {
      continue;
    }

    let fileChanged = false;
    for (const [sessionKey, record] of Object.entries(parsed)) {
      if (!isSetfarmSpawnerSessionKey(sessionKey)) continue;
      if (activeKeys.has(sessionKey)) continue;
      if (cleanupOpenClawSessionLockSync(agentDir, record)) locksRemoved += 1;
      if (record?.status !== "running") continue;
      record.status = "timeout";
      record.abortedLastRun = true;
      record.updatedAt = now;
      fileChanged = true;
      changed += 1;
    }

    if (fileChanged) {
      try {
        fs.writeFileSync(sessionsPath, JSON.stringify(parsed, null, 2) + "\n");
      } catch (err) {
        console.warn(`[spawner] stale OpenClaw session sweep failed for ${sessionsPath} (${context}): ${compactExitReason(err)}`);
      }
    }
  }

  if (changed > 0) {
    console.warn(`[spawner] OpenClaw stale session sweep marked ${changed} session record(s) timeout (${context})`);
  }
  if (locksRemoved > 0) {
    console.warn(`[spawner] OpenClaw stale session sweep removed ${locksRemoved} transcript lock(s) (${context})`);
  }
  return changed;
}

function markStaleSetfarmOpenClawTaskRecordsCancelledSync(context: string): number {
  const now = Date.now();
  const message = `Cancelled by Setfarm spawner stale sweep (${context}).`;
  const sql = [
    "UPDATE task_runs",
    `SET status = 'cancelled', ended_at = ${now}, last_event_at = ${now}, error = ${sqliteString(message)}`,
    "WHERE runtime = 'cli'",
    "AND status = 'running'",
    "AND (",
    "requester_session_key GLOB 'agent:*:explicit:spawner-*'",
    "OR owner_key GLOB 'agent:*:explicit:spawner-*'",
    "OR child_session_key GLOB 'agent:*:explicit:spawner-*'",
    ")",
    activeSessionKeyExclusionSql(),
    ";",
    "SELECT changes();",
  ].join(" ");
  try {
    const stdout = execFileSync("sqlite3", [OPENCLAW_TASKS_DB, sql], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 10_000,
      maxBuffer: 1024 * 1024,
    });
    const changed = parseInt(String(stdout || "").trim().split(/\s+/).pop() || "0", 10);
    if (changed > 0) {
      console.warn(`[spawner] OpenClaw stale task sweep marked ${changed} task record(s) cancelled (${context})`);
    }
    return Number.isFinite(changed) ? changed : 0;
  } catch (err) {
    console.warn(`[spawner] OpenClaw stale task sweep failed (${context}): ${compactExitReason(err)}`);
    return 0;
  }
}

function markOpenClawTaskRecordCancelled(taskId: string, lookup: string, context: string): void {
  const now = Date.now();
  const message = "Cancelled by Setfarm spawner after OpenClaw runtime cancel left CLI task running.";
  const sql = [
    "UPDATE task_runs",
    `SET status = 'cancelled', ended_at = ${now}, last_event_at = ${now}, error = ${sqliteString(message)}`,
    `WHERE task_id = ${sqliteString(taskId)}`,
    "AND runtime = 'cli'",
    "AND status = 'running'",
    `AND (requester_session_key = ${sqliteString(lookup)} OR owner_key = ${sqliteString(lookup)} OR child_session_key = ${sqliteString(lookup)});`,
    "SELECT changes();",
  ].join(" ");
  execFile("sqlite3", [OPENCLAW_TASKS_DB, sql], {
    timeout: 10_000,
    maxBuffer: 1024 * 1024,
  }, (err, stdout, stderr) => {
    if (err) {
      const msg = compactExitReason(stderr || stdout || (err as any).message || err);
      console.warn(`[spawner] OpenClaw registry fallback failed for ${taskId} from ${lookup} (${context}): ${msg}`);
      return;
    }
    const changed = parseInt(String(stdout || "").trim().split(/\s+/).pop() || "0", 10);
    if (changed > 0) {
      console.warn(`[spawner] OpenClaw registry fallback marked ${taskId} cancelled for ${lookup} (${context})`);
    } else {
      console.warn(`[spawner] OpenClaw registry fallback no-op for ${taskId} from ${lookup} (${context})`);
    }
  });
}

function cancelOpenClawTaskId(taskId: string, context: string, originalLookup: string): void {
  execFile(OPENCLAW_CLI, ["tasks", "cancel", taskId], {
    cwd: AGENT_SAFE_CWD,
    timeout: 20_000,
    env: buildOpenClawChildEnv(),
    maxBuffer: 2 * 1024 * 1024,
  }, (err, stdout, stderr) => {
    if (err) {
      const msg = compactExitReason(stderr || stdout || (err as any).message || err);
      console.warn(`[spawner] OpenClaw lingering taskId cancel failed for ${taskId} from ${originalLookup} (${context}): ${msg}`);
      setTimeout(() => markOpenClawTaskRecordCancelled(taskId, originalLookup, context), OPENCLAW_TASK_REGISTRY_SETTLE_MS);
      return;
    }
    console.log(`[spawner] OpenClaw lingering taskId cancelled for ${taskId} from ${originalLookup} (${context})`);
    setTimeout(() => markOpenClawTaskRecordCancelled(taskId, originalLookup, context), OPENCLAW_TASK_REGISTRY_SETTLE_MS);
  });
}

function cancelLingeringOpenClawTasksForLookup(lookup: string, context: string): void {
  if (!lookup) return;
  execFile(OPENCLAW_CLI, ["tasks", "list", "--status", "running", "--runtime", "cli", "--json"], {
    cwd: AGENT_SAFE_CWD,
    timeout: 20_000,
    env: buildOpenClawChildEnv(),
    maxBuffer: 4 * 1024 * 1024,
  }, (err, stdout, stderr) => {
    if (err) {
      const msg = compactExitReason(stderr || stdout || (err as any).message || err);
      console.warn(`[spawner] OpenClaw lingering task list failed for ${lookup} (${context}): ${msg}`);
      return;
    }

    let tasks: OpenClawTaskRecord[];
    try {
      tasks = parseOpenClawTaskList(stdout);
    } catch (parseErr) {
      console.warn(`[spawner] OpenClaw lingering task list parse failed for ${lookup} (${context}): ${compactExitReason(parseErr)}`);
      return;
    }

    const seen = new Set<string>();
    for (const task of tasks) {
      const taskId = task.taskId?.trim();
      if (!taskId || taskId === lookup || seen.has(taskId)) continue;
      if (task.status && task.status !== "running") continue;
      if (task.runtime && task.runtime !== "cli") continue;
      if (!taskBelongsToLookup(task, lookup)) continue;
      seen.add(taskId);
      cancelOpenClawTaskId(taskId, context, lookup);
    }
  });
}

function cleanupStaleSetfarmOpenClawTaskRecords(context: string): OpenClawCleanupResult {
  const sessions = cleanupStaleSetfarmOpenClawSessionRecordsSync(context);
  const tasks = markStaleSetfarmOpenClawTaskRecordsCancelledSync(context);
  return { sessions, tasks };
}

async function restartGatewayAfterOpenClawCleanup(context: string, result: OpenClawCleanupResult): Promise<boolean> {
  const changed = result.sessions + result.tasks;
  if (changed === 0) return false;
  if (gatewayRestartInFlight) return false;
  if (activeProcesses.size > 0) {
    console.warn(`[spawner] gateway restart after stale OpenClaw cleanup deferred; ${activeProcesses.size} active process(es) (${context})`);
    return false;
  }
  const nowMs = Date.now();
  if (nowMs - lastGatewayCleanupRestartMs < GATEWAY_PRESPAWN_RESTART_COOLDOWN_MS) return false;

  gatewayRestartInFlight = true;
  lastGatewayCleanupRestartMs = nowMs;
  console.warn(`[spawner] restarting openclaw-gateway after stale OpenClaw cleanup (${context}): sessions=${result.sessions} tasks=${result.tasks}`);
  const restarted = await new Promise<boolean>((resolve) => {
    execFile("systemctl", ["--user", "restart", "openclaw-gateway"], { timeout: 20_000 }, (err, stdout, stderr) => {
      if (err) {
        const msg = compactExitReason(stderr || stdout || (err as any).message || err);
        console.warn(`[spawner] gateway stale-cleanup restart failed: ${msg}`);
        resolve(false);
        return;
      }
      gatewayNotReadySinceMs = null;
      console.log("[spawner] gateway stale-cleanup restart completed");
      resolve(true);
    });
  });
  gatewayRestartInFlight = false;
  if (restarted) cleanupStaleSetfarmOpenClawTaskRecords(`${context}-post-gateway-restart`);
  return restarted;
}

function cancelOpenClawTask(lookup: string, context: string): void {
  if (!lookup) return;
  execFile(OPENCLAW_CLI, ["tasks", "cancel", lookup], {
    cwd: AGENT_SAFE_CWD,
    timeout: 20_000,
    env: buildOpenClawChildEnv(),
    maxBuffer: 2 * 1024 * 1024,
  }, (err, stdout, stderr) => {
    if (err) {
      const msg = compactExitReason(stderr || stdout || (err as any).message || err);
      console.warn(`[spawner] OpenClaw task cancel failed for ${lookup} (${context}): ${msg}`);
      cancelLingeringOpenClawTasksForLookup(lookup, context);
      return;
    }
    console.log(`[spawner] OpenClaw task cancelled for ${lookup} (${context})`);
    setTimeout(() => cancelLingeringOpenClawTasksForLookup(lookup, context), 1500);
  });
}

function terminateActiveProcess(active: ActiveProcess, context: string): void {
  cancelOpenClawTask(active.sessionKey, context);
  killProcessTree(active.child.pid, "SIGTERM");
  setTimeout(() => killProcessTree(active.child.pid, "SIGKILL"), 5000);
  if (["qa-tester", "tester", "final-tester"].some((role) => active.role.includes(role) || active.agentId.includes(role))) {
    setTimeout(() => {
      void cleanupProjectEphemera(active.runId, `spawner-${context}-${active.role}`);
    }, 1500);
  }
}

function readProcessArgs(pid: number): string {
  try {
    return execFileSync("ps", ["-o", "args=", "-p", String(pid)], { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

function extractSpawnerSessionKeyFromArgs(args: string): string {
  const agent = args.match(/--agent\s+(\S+)/)?.[1];
  const sessionId = args.match(/--session-id\s+(\S+)/)?.[1];
  return agent && sessionId ? buildSessionKey(agent, sessionId) : "";
}

function killStartupOrphanSpawnerAgents(): void {
  try {
    const out = execFileSync("pgrep", ["-f", "openclaw.*agent.*--session-id spawner-"], { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    for (const pidRaw of out.split(/\s+/).filter(Boolean)) {
      const pid = Number(pidRaw);
      if (!Number.isFinite(pid) || pid === process.pid) continue;
      const sessionKey = extractSpawnerSessionKeyFromArgs(readProcessArgs(pid));
      console.warn(`[spawner] killing orphan spawner OpenClaw process pid=${pid}${sessionKey ? " session=" + sessionKey : ""}`);
      if (sessionKey) cancelOpenClawTask(sessionKey, "startup-orphan");
      killProcessTree(pid, "SIGTERM");
      setTimeout(() => killProcessTree(pid, "SIGKILL"), 5000);
    }
  } catch {
    // no orphan spawner-owned openclaw processes
  }
}

async function loopStoryCompletedAfter(runId: string, agentId: string, currentStoryId: string | null, startedAtMs?: number): Promise<boolean> {
  const startedAt = new Date(startedAtMs || Date.now() - 24 * 60 * 60 * 1000).toISOString();
  if (currentStoryId) {
    const current = await pgGet<{ status: string }>(
      "SELECT status FROM stories WHERE id = $1 AND run_id = $2 LIMIT 1",
      [currentStoryId, runId],
    );
    if (current && ["done", "verified"].includes(current.status)) return true;
  }

  const completed = await pgGet<{ story_id: string }>(
    `SELECT story_id
     FROM stories
     WHERE run_id = $1
       AND claimed_by = $2
       AND status IN ('done', 'verified')
       AND updated_at >= $3
     ORDER BY updated_at DESC
     LIMIT 1`,
    [runId, agentId, startedAt],
  );
  return !!completed;
}

type RunningStepRow = {
  status: string;
  step_id: string;
  run_id: string;
  type: string;
  current_story_id: string | null;
};

function gitOutput(cwd: string, args: string[], timeoutMs = 10_000): string | null {
  try {
    return execFileSync("git", args, {
      cwd,
      encoding: "utf-8",
      timeout: timeoutMs,
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

function buildScriptExists(workdir: string): boolean {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(workdir, "package.json"), "utf-8"));
    return typeof pkg?.scripts?.build === "string" && pkg.scripts.build.trim().length > 0;
  } catch {
    return false;
  }
}

function sourceDiffFiles(workdir: string, baseRef: string): string[] {
  const raw = gitOutput(workdir, [
    "diff", "--name-only", `${baseRef}...HEAD`, "--",
    "src", "app", "components", "lib", "pages", "public",
    "index.html", "package.json", "package-lock.json",
    "vite.config.ts", "vite.config.js", "tsconfig.json",
    "tailwind.config.ts", "tailwind.config.js", "postcss.config.js",
    "eslint.config.js", "vitest.config.ts", "vitest.config.js",
    "jest.config.ts", "jest.config.js",
  ]);
  return raw ? raw.split("\n").map((line) => line.trim()).filter(Boolean) : [];
}

function findDiffBaseRef(workdir: string): string | null {
  for (const ref of ["main", "origin/main", "HEAD~1"]) {
    if (!gitOutput(workdir, ["rev-parse", "--verify", ref])) continue;
    const aheadRaw = gitOutput(workdir, ["rev-list", "--count", `${ref}..HEAD`]);
    const ahead = Number(aheadRaw || "0");
    if (!Number.isFinite(ahead) || ahead <= 0) continue;
    if (sourceDiffFiles(workdir, ref).length > 0) return ref;
  }
  return null;
}

function findWorktreeByBranch(repo: string, storyBranch: string): string | null {
  const raw = gitOutput(repo, ["worktree", "list", "--porcelain"]);
  if (!raw) return null;
  let worktree = "";
  for (const line of raw.split("\n")) {
    if (line.startsWith("worktree ")) {
      worktree = line.slice("worktree ".length).trim();
      continue;
    }
    if (line.startsWith("branch ")) {
      const branch = line.slice("branch ".length).trim().split("/").pop()?.toLowerCase() || "";
      if (branch === storyBranch.toLowerCase()) return safeAgentCwdFromCandidate(worktree);
    }
  }
  return null;
}

function runBuildGate(workdir: string): boolean {
  if (!buildScriptExists(workdir)) return false;
  try {
    execFileSync("npm", ["run", "build"], {
      cwd: workdir,
      timeout: IMPLEMENT_EXIT_RECOVERY_BUILD_TIMEOUT_MS,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, CI: "true" },
    });
    return true;
  } catch {
    return false;
  }
}

async function tryRecoverExitedImplementWork(
  stepDbId: string,
  row: RunningStepRow,
  agentId: string,
  transcriptPath: string,
  err: unknown,
  claimedCwd?: string,
): Promise<boolean> {
  const exitReason = compactExitReason(err);
  const recoverableExit =
    exitReason.includes("without calling setfarm step complete/fail") ||
    exitReason.includes("AGENT_STARTUP_SILENT") ||
    exitReason.includes("AGENT_PROCESS_STUCK") ||
    exitReason.includes("AGENT_PROCESS_TERMINAL");
  if (!recoverableExit) return false;
  if (row.status !== "running" || row.type !== "loop" || row.step_id !== "implement" || !row.current_story_id) return false;

  const story = await pgGet<{ id: string; story_id: string; title: string; story_branch: string | null; status: string; claimed_by: string | null }>(
    "SELECT id, story_id, title, story_branch, status, claimed_by FROM stories WHERE id = $1 AND run_id = $2 LIMIT 1",
    [row.current_story_id, row.run_id],
  );
  if (!story || story.status !== "running") return false;
  if (story.claimed_by && story.claimed_by !== agentId) return false;

  const storyBranch = (story.story_branch || `${row.run_id.slice(0, 8)}-${story.story_id}`).toLowerCase();
  const contextRow = await pgGet<{ context: string | null }>("SELECT context FROM runs WHERE id = $1 LIMIT 1", [row.run_id]);
  let context: Record<string, string> = {};
  try {
    context = contextRow?.context ? JSON.parse(contextRow.context) : {};
  } catch {
    context = {};
  }

  const workdirCandidates = [
    safeAgentCwdFromCandidate(claimedCwd),
    safeAgentCwdFromCandidate(context["story_workdir"]),
    context["repo"] ? findWorktreeByBranch(context["repo"], storyBranch) : null,
  ].filter((candidate): candidate is string => !!candidate);
  const workdir = [...new Set(workdirCandidates)].find((candidate) => {
    const branch = gitOutput(candidate, ["branch", "--show-current"]);
    return branch?.toLowerCase() === storyBranch;
  });
  if (!workdir) return false;

  const baseRef = findDiffBaseRef(workdir);
  if (!baseRef) return false;
  if (!runBuildGate(workdir)) return false;

  context["story_workdir"] = workdir;
  context["story_branch"] = storyBranch;
  await pgRun("UPDATE runs SET context = $1, updated_at = NOW() WHERE id = $2", [JSON.stringify(context), row.run_id]);

  const changedFiles = sourceDiffFiles(workdir, baseRef).slice(0, 20);
  const recoveryOutput = [
    "STATUS: done",
    `STORY_BRANCH: ${storyBranch}`,
    `CHANGES: Recovered ${story.story_id} after agent exited with build-passing committed work on ${storyBranch}.`,
    "BUILD_CMD: npm run build",
    "RECOVERY: agent-exit-build-passing",
    `TRANSCRIPT: ${transcriptPath}`,
    `CHANGED_FILES: ${changedFiles.join(", ")}`,
  ].join("\n");

  const result = await completeStep(stepDbId, recoveryOutput);
  if (!result.advanced && !result.runCompleted) {
    const refreshed = await pgGet<{ status: string }>("SELECT status FROM stories WHERE id = $1 LIMIT 1", [story.id]);
    if (!["done", "verified"].includes(refreshed?.status || "")) return false;
  }
  console.warn(`[spawner] recovered exited implement story ${story.story_id} for ${agentId}: build passed in ${workdir}`);
  return true;
}

async function verifyEachHasDoneStory(runId: string, verifyStepId: string): Promise<boolean> {
  const loopStep = await pgGet<{ loop_config: string | null }>(
    `SELECT loop_config
     FROM steps
     WHERE run_id = $1 AND type = 'loop' AND loop_config LIKE '%verifyEach%'
     LIMIT 1`,
    [runId],
  );
  if (!loopStep?.loop_config) return true;

  try {
    const cfg = JSON.parse(loopStep.loop_config);
    if (!cfg?.verifyEach || (cfg.verifyStep || "verify") !== verifyStepId) return true;
  } catch {
    return true;
  }

  const waiting = await pgGet<{ cnt: string }>(
    "SELECT COUNT(*) as cnt FROM stories WHERE run_id = $1 AND status = 'done'",
    [runId],
  );
  return parseInt(waiting?.cnt || "0", 10) > 0;
}

async function failClaimIfStillRunning(stepId: string, agentId: string, wfId: string, role: string, transcriptPath: string, err: unknown, startedAtMs?: number, claimedCwd?: string): Promise<void> {
  try {
    const row = await pgGet<{ status: string; step_id: string; run_id: string; type: string; current_story_id: string | null }>(
      "SELECT status, step_id, run_id, type, current_story_id FROM steps WHERE id = $1 LIMIT 1",
      [stepId],
    );
    if (!row) return;

    if (row.type === "loop" && await loopStoryCompletedAfter(row.run_id, agentId, row.current_story_id, startedAtMs)) {
      console.log(`[spawner] ${agentId} exited after completing a loop story for ${wfId}/${role}; keeping loop ${row.step_id} running (${compactExitReason(err)})`);
      return;
    }

    if (row.status === "running") {
      try {
        if (await tryRecoverExitedImplementWork(stepId, row, agentId, transcriptPath, err, claimedCwd)) return;
      } catch (recoveryErr) {
        console.warn(`[spawner] exited implement recovery failed for ${wfId}/${role}: ${String(recoveryErr).slice(0, 300)}`);
      }
    }

    if (row.type === "loop" && row.status !== "running") {
      const requeued = await requeueOrphanedStoryClaim(row.run_id, row.step_id, agentId, `agent exited while loop step was ${row.status}: ${compactExitReason(err)}`);
      if (requeued) return;
    }

    if (row.status !== "running") return;

    const reason = `AGENT_PROCESS_EXITED: ${agentId} exited before completing ${wfId}/${role}. ${compactExitReason(err)}. Transcript: ${transcriptPath}`;
    console.warn(`[spawner] failing still-running claim ${stepId} (${row.step_id}) after agent exit`);
    await failStep(stepId, reason);
  } catch (failErr) {
    console.warn(`[spawner] failed to mark exited agent claim as failed: ${String(failErr).slice(0, 300)}`);
  }
}

async function requeueOrphanedStoryClaim(runId: string, stepId: string, agentId: string, diagnostic: string): Promise<boolean> {
  const row = await pgGet<{ id: string; story_id: string }>(
    `SELECT st.id, st.story_id
     FROM stories st
     JOIN claim_log cl ON cl.run_id = st.run_id AND cl.story_id = st.story_id
     WHERE st.run_id = $1
       AND st.status = 'running'
       AND cl.step_id = $2
       AND cl.agent_id = $3
       AND cl.outcome IS NULL
     ORDER BY cl.claimed_at DESC
     LIMIT 1`,
    [runId, stepId, agentId],
  );
  if (!row) return false;

  await pgRun("UPDATE stories SET status = 'pending', claimed_by = NULL, updated_at = NOW() WHERE id = $1 AND status = 'running'", [row.id]);
  await pgRun("UPDATE steps SET status = 'pending', current_story_id = NULL, updated_at = NOW() WHERE run_id = $1 AND step_id = $2 AND status IN ('pending','running','waiting')", [runId, stepId]);
  await pgRun("UPDATE claim_log SET outcome = 'infra_retry', abandoned_at = NOW(), diagnostic = $1 WHERE run_id = $2 AND step_id = $3 AND story_id = $4 AND agent_id = $5 AND outcome IS NULL", [diagnostic, runId, stepId, row.story_id, agentId]);
  console.warn(`[spawner] requeued orphaned story claim ${row.story_id} for ${agentId}: ${diagnostic.slice(0, 180)}`);
  return true;
}

async function requeueOpenStoryClaim(runId: string, stepId: string, storyId: string, agentId: string, diagnostic: string): Promise<boolean> {
  const row = await pgGet<{ story_db_id: string | null; story_status: string | null; claim_story_id: string }>(
    `SELECT st.id as story_db_id, st.status as story_status, cl.story_id as claim_story_id
     FROM claim_log cl
     LEFT JOIN stories st ON st.run_id = cl.run_id AND st.story_id = cl.story_id
     WHERE cl.run_id = $1
       AND cl.step_id = $2
       AND cl.story_id = $3
       AND cl.agent_id = $4
       AND cl.outcome IS NULL
     ORDER BY cl.claimed_at DESC
     LIMIT 1`,
    [runId, stepId, storyId, agentId],
  );
  if (!row) return false;

  if (row.story_db_id) {
    await pgRun("UPDATE stories SET status = 'pending', claimed_by = NULL, updated_at = NOW() WHERE id = $1 AND status IN ('running','pending')", [row.story_db_id]);
  }
  await pgRun("UPDATE steps SET status = 'pending', current_story_id = NULL, updated_at = NOW() WHERE run_id = $1 AND step_id = $2 AND status IN ('pending','running','waiting')", [runId, stepId]);
  await pgRun("UPDATE claim_log SET outcome = 'infra_retry', abandoned_at = NOW(), diagnostic = $1 WHERE run_id = $2 AND step_id = $3 AND story_id = $4 AND agent_id = $5 AND outcome IS NULL", [diagnostic, runId, stepId, storyId, agentId]);
  console.warn(`[spawner] requeued open story claim ${storyId} for ${agentId}: ${diagnostic.slice(0, 180)}`);
  return true;
}

async function requeueOrphanedRunningStories(): Promise<void> {
  const rows = await pgQuery<{ story_db_id: string; story_id: string; run_id: string; run_number: number; step_db_id: string | null; step_id: string | null; step_status: string | null; agent_id: string | null }>(
    `SELECT st.id as story_db_id, st.story_id, st.run_id, r.run_number,
            loop_step.id as step_db_id, loop_step.step_id, loop_step.status as step_status,
            cl.agent_id
     FROM stories st
     JOIN runs r ON r.id = st.run_id
     LEFT JOIN claim_log cl ON cl.run_id = st.run_id AND cl.story_id = st.story_id AND cl.outcome IS NULL
     LEFT JOIN steps loop_step ON loop_step.run_id = st.run_id AND loop_step.type = 'loop'
     WHERE st.status = 'running'
       AND r.status = 'running'
       AND (
         loop_step.id IS NULL
         OR loop_step.status <> 'running'
         OR loop_step.current_story_id IS DISTINCT FROM st.id
       )
     ORDER BY st.updated_at ASC
     LIMIT 20`
  );

  for (const row of rows) {
    const diagnostic = `ORPHANED_RUNNING_STORY: ${row.story_id} was running but loop step ${row.step_id || "(missing)"} is ${row.step_status || "(missing)"} or no longer points at story`;
    await pgRun("UPDATE stories SET status = 'pending', claimed_by = NULL, updated_at = NOW() WHERE id = $1 AND status = 'running'", [row.story_db_id]);
    if (row.step_db_id) {
      await pgRun("UPDATE steps SET status = 'pending', current_story_id = NULL, updated_at = NOW() WHERE id = $1 AND status IN ('pending','waiting','running')", [row.step_db_id]);
    }
    if (row.agent_id) {
      await pgRun("UPDATE claim_log SET outcome = 'infra_retry', abandoned_at = NOW(), diagnostic = $1 WHERE run_id = $2 AND story_id = $3 AND agent_id = $4 AND outcome IS NULL", [diagnostic, row.run_id, row.story_id, row.agent_id]);
    }
    console.warn(`[spawner] requeued orphaned running story for run #${row.run_number}: ${row.story_id}`);
  }
}

async function cleanupRunningRunEphemeraOnStartup(): Promise<void> {
  try {
    const rows = await pgQuery<{ id: string }>(
      "SELECT id FROM runs WHERE status = 'running' ORDER BY updated_at DESC LIMIT 20",
    );
    for (const row of rows) {
      await cleanupProjectEphemera(row.id, "spawner-startup");
    }
  } catch (err) {
    console.warn(`[spawner] startup project cleanup failed: ${String(err).slice(0, 300)}`);
  }
}

async function reapFinishedClaims(): Promise<void> {
  for (const [key, active] of activeProcesses) {
    try {
      const row = await pgGet<{ step_status: string; run_status: string; step_id: string; run_id: string; type: string; current_story_id: string | null; story_id: string | null; story_status: string | null }>(
        `SELECT s.status as step_status, r.status as run_status, s.step_id, s.run_id, s.type, s.current_story_id, st.story_id, st.status as story_status
         FROM steps s
         JOIN runs r ON r.id = s.run_id
         LEFT JOIN stories st ON st.id = s.current_story_id
         WHERE s.id = $1
         LIMIT 1`,
        [active.stepId],
      );
      if (!row) {
        console.warn(`[spawner] Reaping ${key}: claimed step disappeared`);
      } else if (row.run_status === "running" && row.step_status === "running") {
        const terminalReason = childProcessTerminalReason(active.child);
        if (terminalReason) {
          const reason = `AGENT_PROCESS_TERMINAL: ${active.agentId} process ended while ${active.wfId}/${active.role} was still running (${terminalReason}); recovering claim. Transcript: ${active.transcriptPath}`;
          console.warn(`[spawner] ${reason}`);
          try { fs.appendFileSync(active.transcriptPath, `--- PROCESS TERMINAL ${new Date().toISOString()} ---
${reason}
`); } catch {}
          cancelOpenClawTask(active.sessionKey, "process-terminal");
          activeProcesses.delete(key);
          await failClaimIfStillRunning(active.stepId, active.agentId, active.wfId, active.role, active.transcriptPath, new Error(reason), active.startedAtMs, active.spawnCwd);
          continue;
        }

        if (active.storyId && row.type === "loop" && row.step_id === "implement") {
          const storyStillOwned = row.current_story_id === active.storyDbId
            && row.story_id === active.storyId
            && row.story_status === "running";
          if (!storyStillOwned) {
            const reason = `AGENT_STORY_STATE_MISMATCH: ${active.agentId} is still running ${active.storyId}, but loop step points at ${row.story_id || "(none)"} (${row.story_status || "no-story"}); requeueing stale claim. Transcript: ${active.transcriptPath}`;
            console.warn(`[spawner] ${reason}`);
            try { fs.appendFileSync(active.transcriptPath, `--- STORY STATE MISMATCH ${new Date().toISOString()} ---\n${reason}\n`); } catch {}
            terminateActiveProcess(active, "story-state-mismatch");
            activeProcesses.delete(key);
            await requeueOpenStoryClaim(active.runId, row.step_id, active.storyId, active.agentId, reason);
            continue;
          }
        }

        if (row.step_id === "verify" && !await verifyEachHasDoneStory(active.runId, row.step_id)) {
          console.log(`[spawner] Reaping stale verify agent ${key}: no done story awaits verify`);
          terminateActiveProcess(active, "verify-no-done-story");
          activeProcesses.delete(key);
          await pgRun("UPDATE steps SET status = 'waiting', updated_at = NOW() WHERE id = $1 AND status = 'running'", [active.stepId]);
          continue;
        }

        const loopStoryDone = row.type === "loop"
          && await loopStoryCompletedAfter(row.run_id, active.agentId, row.current_story_id, active.startedAtMs);
        if (loopStoryDone) {
          console.log(`[spawner] Reaping completed loop agent ${key}: story completed; terminating leftover agent process`);
          terminateActiveProcess(active, "completed-loop-story");
          activeProcesses.delete(key);
          continue;
        }

        const ageMs = Date.now() - active.startedAtMs;
        if (ageMs >= AGENT_STARTUP_SILENCE_MS && !activeProcessHasStartupActivity(active)) {
          const reason = `AGENT_STARTUP_SILENT: ${active.agentId} kept ${active.wfId}/${active.role} running for ${formatDurationMs(ageMs)} without transcript/output; OpenClaw session likely stuck before first model/tool turn. Transcript: ${active.transcriptPath}`;
          console.warn(`[spawner] ${reason}`);
          try { fs.appendFileSync(active.transcriptPath, `--- STARTUP SILENCE ${new Date().toISOString()} ---
${reason}
`); } catch {}
          terminateActiveProcess(active, "startup-silent");
          activeProcesses.delete(key);
          await failClaimIfStillRunning(active.stepId, active.agentId, active.wfId, active.role, active.transcriptPath, new Error(reason), active.startedAtMs, active.spawnCwd);
          continue;
        }

        const thresholdMs = stuckThresholdMs(active.role, row.story_id);
        if (ageMs < thresholdMs) continue;

        const idleMs = Date.now() - activeProcessLastActivityMs(active);
        if (idleMs < AGENT_ACTIVITY_GRACE_MS) {
          console.log(`[spawner] ${active.agentId} exceeded ${formatDurationMs(thresholdMs)} but is active (last activity ${formatDurationMs(idleMs)} ago); watchdog deferred`);
          continue;
        }

        const reason = `AGENT_PROCESS_STUCK: ${active.agentId} kept ${active.wfId}/${active.role} running for ${formatDurationMs(ageMs)} without step complete/fail and no agent activity for ${formatDurationMs(idleMs)}; killed by spawner watchdog. Transcript: ${active.transcriptPath}`;
        console.warn(`[spawner] ${reason}`);
        try { fs.appendFileSync(active.transcriptPath, `--- WATCHDOG ${new Date().toISOString()} ---
${reason}
`); } catch {}
        terminateActiveProcess(active, "watchdog-stuck");
        activeProcesses.delete(key);
        await failClaimIfStillRunning(active.stepId, active.agentId, active.wfId, active.role, active.transcriptPath, new Error(reason), active.startedAtMs, active.spawnCwd);
        continue;
      } else {
        const idleMs = activeProcessIdleMs(active);
        if (row.run_status === "running" && idleMs < REAP_FINISHED_ACTIVE_GRACE_MS) {
          console.log(`[spawner] Deferring reap for ${key}: step ${row.step_id} is ${row.step_status}, run is ${row.run_status}, but agent was active ${formatDurationMs(idleMs)} ago`);
          continue;
        }
        console.log(`[spawner] Reaping ${key}: step ${row.step_id} is ${row.step_status}, run is ${row.run_status}`);
      }

      terminateActiveProcess(active, "reap-finished");
      activeProcesses.delete(key);
    } catch (err) {
      console.warn(`[spawner] reap finished claim ${key}: ${String(err).slice(0, 300)}`);
    }
  }
}

function spawnAgent(agentId: string, wfId: string, role: string): void {
  const key = `${wfId}:${role}:${agentId}`;
  if (activeProcesses.has(key) || claimingSpawns.has(key)) {
    console.log(`[spawner] Already running/claiming: ${key}, skip`);
    return;
  }
  if (queuedSpawns.has(key)) {
    console.log(`[spawner] Already queued: ${key}, skip`);
    return;
  }
  const nowMs = Date.now();
  const delayMs = Math.max(0, nextSpawnEarliest - nowMs);
  nextSpawnEarliest = nowMs + delayMs + SPAWN_STAGGER_MS;
  queuedSpawns.add(key);
  if (delayMs > 0) console.log(`[spawner] Queueing ${key} for ${delayMs}ms to avoid OpenClaw plugin-cache races`);
  setTimeout(() => {
    queuedSpawns.delete(key);
    if (shuttingDown) return;
    void spawnAgentNow(agentId, wfId, role);
  }, delayMs);
}

async function spawnAgentNow(agentId: string, wfId: string, role: string): Promise<void> {
  const key = `${wfId}:${role}:${agentId}`;
  if (activeProcesses.has(key) || claimingSpawns.has(key)) {
    console.log(`[spawner] Already running/claiming: ${key}, skip`);
    return;
  }
  if (await shouldDeferBackgroundWorkflow(wfId)) {
    console.log(`[spawner] Deferring background workflow ${wfId}/${role}; foreground run is active`);
    queuedSpawns.add(key);
    setTimeout(() => {
      queuedSpawns.delete(key);
      if (!shuttingDown) void spawnAgentNow(agentId, wfId, role);
    }, WORKFLOW_DEFER_RETRY_MS);
    return;
  }
  const openClawCleanup = cleanupStaleSetfarmOpenClawTaskRecords("prespawn");
  if (!OPENCLAW_AGENT_LOCAL) await restartGatewayAfterOpenClawCleanup("prespawn", openClawCleanup);
  if (activeProcesses.size >= MAX_CONCURRENT) {
    console.log(`[spawner] At capacity (${activeProcesses.size}/${MAX_CONCURRENT}), skip ${agentId}`);
    return;
  }
  if (!OPENCLAW_AGENT_LOCAL) {
    const gatewayReadiness = await getGatewayReadiness();
    if (!gatewayReadiness.ready) {
      maybeRestartGatewayForReadiness(gatewayReadiness.reason, key);
      console.warn(`[spawner] Gateway not ready (${gatewayReadiness.reason}; ${GATEWAY_READY_URL}); delaying ${key} for ${gatewayReadiness.retryAfterMs}ms`);
      queuedSpawns.add(key);
      setTimeout(() => {
        queuedSpawns.delete(key);
        if (!shuttingDown) void spawnAgentNow(agentId, wfId, role);
      }, gatewayReadiness.retryAfterMs);
      return;
    }
    if (!gatewayReadiness.reason.startsWith("gateway probe timeout bypass")) noteGatewayReady();
  }
  claimingSpawns.add(key);
  const spawnId = Date.now() + "-" + Math.random().toString(36).slice(2, 10);
  const outputFileId = agentId + "-spawner-" + spawnId;
  const claimFile = path.join("/tmp", "claim-" + outputFileId + ".json");
  const stalePath = path.join("/tmp", "setfarm-output-" + outputFileId + ".txt");
  try { fs.unlinkSync(stalePath); } catch { /* didnt exist, fine */ }
  try { fs.unlinkSync(claimFile); } catch { /* didnt exist, fine */ }

  const fullAgentId = `${wfId}_${role}`;
  let claim: Awaited<ReturnType<typeof claimStep>>;
  try {
    claim = await claimStep(fullAgentId, agentId);
  } catch (err) {
    claimingSpawns.delete(key);
    console.warn("[spawner] claim failed for " + fullAgentId + ": " + String(err));
    return;
  }
  if (!claim.found) {
    claimingSpawns.delete(key);
    console.log("[spawner] No claimable work for " + fullAgentId + ", skip spawn");
    return;
  }
  if (typeof claim.resolvedInput === "string") {
    claim.resolvedInput = claim.resolvedInput
      .replace(/\[missing:\s*output_file_id\]/gi, outputFileId)
      .replace(/\[missing:\s*OUTPUT_FILE_ID\]/g, outputFileId);
  }
  fs.writeFileSync(claimFile, JSON.stringify({ stepId: claim.stepId, runId: claim.runId, input: claim.resolvedInput }) + "\n");

  const prompt = buildPreclaimedPrompt(wfId, role, agentId, outputFileId, claimFile);
  console.log("[spawner] Spawning " + agentId + " for " + wfId + "/" + role + " after pre-claim (active: " + activeProcesses.size + ")");
  // capture agent stdout/stderr to a transcript file for post-hoc diagnosis.
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const transcriptPath = path.join(TRANSCRIPT_ROOT, wfId, agentId + "-" + ts + ".log");
  claimingSpawns.delete(key);
  try { fs.mkdirSync(path.dirname(transcriptPath), { recursive: true }); } catch {}
  try { fs.writeFileSync(transcriptPath, "[spawner] " + new Date().toISOString() + " " + wfId + "/" + role + " agent=" + agentId + "\n"); } catch {}

  // Use the same per-spawn id for the gateway session and /tmp handoff files.
  // A reaped child can still have late gateway activity; sharing claim/output
  // paths across retries lets old and new attempts overwrite each other's handoff.
  const sessionId = "spawner-" + agentId + "-" + spawnId;
  const sessionKey = buildSessionKey(agentId, sessionId);
  const sessionJsonlPath = agentSessionJsonlPath(agentId, sessionId);
  const spawnCwd = safeAgentCwdFromClaimInput(claim.resolvedInput);
  const childArgs = [
    "agent", "--json", "--agent", agentId,
    ...(OPENCLAW_AGENT_LOCAL ? ["--local"] : []),
    "--session-id", sessionId,
    "--message", prompt, "--timeout", String(AGENT_TIMEOUT_SECONDS),
  ];
  try {
    fs.appendFileSync(transcriptPath, `[spawner] openclaw_cli=${OPENCLAW_CLI} session_id=${sessionId} session_key=${sessionKey} timeout=${AGENT_TIMEOUT_SECONDS}s cwd=${spawnCwd}\n`);
  } catch {}
  const outFd = fs.openSync(transcriptPath, "a");
  const errFd = fs.openSync(transcriptPath, "a");
  const child = spawn(OPENCLAW_CLI, childArgs, {
    cwd: spawnCwd,  // Use the claimed worktree when available so relative tool paths resolve correctly.
    // Security audit S-1: explicit env allowlist. Previous `{...process.env}` leaked
    // ALL secrets (API keys, DB password, master URLs) to every agent child process.
    // Agents can run `printenv` and see everything. OpenClaw gateway handles API key
    // resolution internally — agents do not need direct key access.
    // Security: denylist DB credentials from agent env. Keep everything
    // else — OpenClaw CLI needs many env vars and allowlist is too fragile.
    env: (() => {
      return buildOpenClawChildEnv();
    })(),
    stdio: ["ignore", outFd, errFd],
  });
  const startedAtMs = Date.now();
  const initialTranscriptSize = fileSize(transcriptPath);
  const activeProcess: ActiveProcess = {
    child,
    runId: claim.runId || "",
    stepId: claim.stepId || "",
    storyId: claim.storyId,
    storyDbId: claim.storyDbId,
    agentId,
    wfId,
    role,
    startedAtMs,
    transcriptPath,
    initialTranscriptSize,
    outputPath: stalePath,
    spawnCwd,
    sessionId,
    sessionKey,
    sessionJsonlPath,
  };
  let processExited = false;
  const closeTranscriptFds = () => {
    try { fs.closeSync(outFd); } catch {}
    try { fs.closeSync(errFd); } catch {}
  };
  const hardTimeout = setTimeout(() => {
    if (processExited) return;
    try {
      fs.appendFileSync(transcriptPath, `--- HARD TIMEOUT ${new Date().toISOString()} ---\nopenclaw agent exceeded ${AGENT_TIMEOUT_SECONDS + 60}s\n`);
    } catch {}
    terminateActiveProcess(activeProcess, "spawn-hard-timeout");
  }, (AGENT_TIMEOUT_SECONDS + 60) * 1000);
  child.once("error", (err) => {
    processExited = true;
    clearTimeout(hardTimeout);
    closeTranscriptFds();
    const isCurrentProcess = activeProcesses.get(key)?.child === child;
    if (isCurrentProcess) activeProcesses.delete(key);
    try {
      fs.appendFileSync(transcriptPath, "--- SPAWN ERROR ---\n" + String((err as any).message || err) + "\n--- FINISHED " + new Date().toISOString() + " ---\n");
    } catch (e) { console.warn("[spawner] transcript write failed: " + String(e)); }
    console.warn("[spawner] " + agentId + " spawn error: " + ((err as any).message || err) + " (transcript: " + transcriptPath + ")");
    if (isCurrentProcess && !shuttingDown && claim.stepId) void failClaimIfStillRunning(claim.stepId, agentId, wfId, role, transcriptPath, err, startedAtMs, spawnCwd);
  });
  child.once("exit", (code, signal) => {
    processExited = true;
    clearTimeout(hardTimeout);
    closeTranscriptFds();
    const isCurrentProcess = activeProcesses.get(key)?.child === child;
    if (isCurrentProcess) activeProcesses.delete(key);
    try {
      fs.appendFileSync(transcriptPath, `--- EXIT code=${code ?? ""} signal=${signal ?? ""} ---\n--- FINISHED ${new Date().toISOString()} ---\n`);
    } catch (e) { console.warn("[spawner] transcript write failed: " + String(e)); }
    const err = code === 0 ? null : new Error(`openclaw agent exited code=${code ?? ""} signal=${signal ?? ""}`);
    if (err) {
      console.warn("[spawner] " + agentId + " exited: " + ((err as any).message || err) + " (transcript: " + transcriptPath + ")");
      if (isCurrentProcess && !shuttingDown && claim.stepId) void failClaimIfStillRunning(claim.stepId, agentId, wfId, role, transcriptPath, err, startedAtMs, spawnCwd);
    }
    else {
      console.log("[spawner] " + agentId + " completed (transcript: " + transcriptPath + ")");
      if (isCurrentProcess && !shuttingDown && claim.stepId) {
        void failClaimIfStillRunning(
          claim.stepId,
          agentId,
          wfId,
          role,
          transcriptPath,
          new Error("agent exited with code 0 without calling setfarm step complete/fail"),
          startedAtMs,
          spawnCwd,
        );
      }
    }
  });
  if (child.pid && claim.runId && claim.stepId) {
    activeProcesses.set(key, activeProcess);
  }
}


async function failStaleRunningClaimsFromPreviousSpawner(): Promise<void> {
  try {
    const graceSeconds = Math.max(0, Math.ceil(STARTUP_RUNNING_GRACE_MS / 1000));
    const rows = await pgQuery<{ id: string; step_id: string; agent_id: string; run_id: string; current_story_id: string | null; run_number: number; updated_at: string }>(
      `SELECT s.id, s.step_id, s.agent_id, s.run_id, s.current_story_id, r.run_number, s.updated_at
       FROM steps s
       JOIN runs r ON r.id = s.run_id
       WHERE s.status = 'running'
         AND r.status = 'running'
         AND s.updated_at <= NOW() - ($1::int * interval '1 second')
       ORDER BY s.updated_at ASC
       LIMIT 20`,
      [graceSeconds],
    );
    for (const row of rows) {
      if (row.step_id === "implement") {
        if (row.current_story_id) {
          const currentStory = await pgGet<{ story_id: string; status: string }>(
            "SELECT story_id, status FROM stories WHERE id = $1 AND run_id = $2 LIMIT 1",
            [row.current_story_id, row.run_id],
          );
          if (currentStory?.status === "running") {
            await pgRun(
              "UPDATE stories SET status = 'pending', claimed_by = NULL, updated_at = NOW() WHERE id = $1 AND status = 'running'",
              [row.current_story_id],
            );
            await pgRun(
              "UPDATE steps SET status = 'pending', current_story_id = NULL, updated_at = NOW() WHERE id = $1 AND status = 'running'",
              [row.id],
            );
            console.log(`[spawner] requeued orphaned running story for run #${row.run_number}: ${currentStory.story_id}`);
            continue;
          }
          if (currentStory && ["done", "verified"].includes(currentStory.status)) {
            console.log(`[spawner] preserving orphaned implement loop for run #${row.run_number}: story ${currentStory.story_id} is ${currentStory.status}`);
            continue;
          }
        }
        const doneStory = await pgGet<{ story_id: string }>(
          "SELECT story_id FROM stories WHERE run_id = $1 AND status = 'done' ORDER BY updated_at DESC LIMIT 1",
          [row.run_id],
        );
        if (doneStory) {
          console.log(`[spawner] preserving orphaned implement loop for run #${row.run_number}: story ${doneStory.story_id} awaits verify`);
          continue;
        }
      }
      if (row.step_id === "verify" && !await verifyEachHasDoneStory(row.run_id, row.step_id)) {
        console.log(`[spawner] clearing orphaned verify for run #${row.run_number}: no done story awaits verify`);
        await pgRun("UPDATE steps SET status = 'waiting', updated_at = NOW() WHERE id = $1 AND status = 'running'", [row.id]);
        continue;
      }
      const reason = `AGENT_PROCESS_ORPHANED: spawner restarted with no active process for run #${row.run_number} ${row.step_id} (${row.agent_id}); retrying running claim last updated ${row.updated_at}`;
      console.warn(`[spawner] ${reason}`);
      await failStep(row.id, reason);
    }
  } catch (err) {
    console.warn(`[spawner] startup running claim recovery failed: ${String(err).slice(0, 300)}`);
  }
}

async function releaseActiveProcessForShutdown(active: ActiveProcess): Promise<void> {
  if (!active.stepId) return;
  try {
    const row = await pgGet<{ run_id: string; step_id: string; type: string; current_story_id: string | null; story_id: string | null }>(
      `SELECT s.run_id, s.step_id, s.type, s.current_story_id, st.story_id
       FROM steps s
       LEFT JOIN stories st ON st.id = s.current_story_id
       WHERE s.id = $1 AND s.status = 'running'
       LIMIT 1`,
      [active.stepId],
    );
    if (!row) return;
    if (row.type === "loop" && row.current_story_id) {
      await pgRun(
        "UPDATE stories SET status = 'pending', claimed_by = NULL, updated_at = NOW() WHERE id = $1 AND status = 'running'",
        [row.current_story_id],
      );
      await pgRun(
        "UPDATE steps SET status = 'pending', current_story_id = NULL, updated_at = NOW() WHERE id = $1 AND status = 'running'",
        [active.stepId],
      );
      await pgRun(
        "UPDATE claim_log SET outcome = 'infra_retry', abandoned_at = NOW(), duration_ms = CAST(EXTRACT(EPOCH FROM (NOW() - claimed_at::timestamptz)) * 1000 AS INTEGER), diagnostic = $1 WHERE run_id = $2 AND step_id = $3 AND story_id = $4 AND agent_id = $5 AND outcome IS NULL",
        ["Spawner shutdown released active loop claim", row.run_id, row.step_id, row.story_id, active.agentId],
      );
      console.log(`[spawner] released active loop claim for shutdown: ${active.agentId} ${active.wfId}/${active.role}`);
      return;
    }

    await pgRun("UPDATE steps SET status = 'pending', updated_at = NOW() WHERE id = $1 AND status = 'running'", [active.stepId]);
    await pgRun(
      "UPDATE claim_log SET outcome = 'infra_retry', abandoned_at = NOW(), duration_ms = CAST(EXTRACT(EPOCH FROM (NOW() - claimed_at::timestamptz)) * 1000 AS INTEGER), diagnostic = $1 WHERE run_id = $2 AND step_id = $3 AND story_id IS NULL AND agent_id = $4 AND outcome IS NULL",
      ["Spawner shutdown released active single-step claim", row.run_id, row.step_id, active.agentId],
    );
    console.log(`[spawner] released active step claim for shutdown: ${active.agentId} ${active.wfId}/${active.role}`);
  } catch (err) {
    console.warn(`[spawner] failed to release active claim during shutdown: ${String(err).slice(0, 300)}`);
  }
}

function cancelRunAgents(runId: string): void {
  let killed = 0;
  for (const [key, active] of activeProcesses) {
    if (active.runId !== runId) continue;
    killed++;
    console.log(`[spawner] Cancelling active agent ${key} for run ${runId.slice(0, 8)}`);
    terminateActiveProcess(active, "run-cancelled");
  }
  if (killed === 0) {
    console.log(`[spawner] Run ${runId.slice(0, 8)} cancelled; no active agent process found`);
  }
}

async function handleStepPending(payload: { agentId: string; runId: string; stepId: string }) {
  if (shuttingDown) return;
  const { agentId, runId, stepId } = payload;
  const run = await pgGet<{ workflow_id: string }>("SELECT workflow_id FROM runs WHERE id = $1", [runId]);
  if (!run) return;
  const wfId = run.workflow_id;
  const role = agentId.replace(`${wfId}_`, "");
  try {
    const pendingStep = await pgGet<{ type: string; loop_config: string | null }>(
      "SELECT type, loop_config FROM steps WHERE run_id = $1 AND step_id = $2 LIMIT 1",
      [runId, stepId],
    );
    if (pendingStep?.type === "loop" && pendingStep.loop_config) {
      const loopConfig = JSON.parse(pendingStep.loop_config);
      if (loopConfig.verifyEach && loopConfig.verifyStep) {
        const awaitingVerify = await pgGet<{ cnt: string }>(
          "SELECT COUNT(*) as cnt FROM stories WHERE run_id = $1 AND status = 'done'",
          [runId],
        );
        const activeQaFix = await pgGet<{ cnt: string }>(
          "SELECT COUNT(*) as cnt FROM stories WHERE run_id = $1 AND story_id LIKE 'QA-FIX-%' AND status IN ('pending', 'running')",
          [runId],
        );
        const activeStory = await pgGet<{ cnt: string }>(
          "SELECT COUNT(*) as cnt FROM stories WHERE run_id = $1 AND status IN ('pending', 'running')",
          [runId],
        );
        if (parseInt(awaitingVerify?.cnt || "0", 10) > 0 && parseInt(activeStory?.cnt || "0", 10) === 0 && parseInt(activeQaFix?.cnt || "0", 10) === 0) {
          console.log(`[spawner] Loop pending but ${awaitingVerify?.cnt || "0"} done story/stories await verify; skip ${wfId}/${role}`);
          return;
        }
      }
    }
    const wf = await loadWorkflowSpec(resolveWorkflowDir(wfId));
    const agents = resolveAgentId(wfId, role, wf.agent_mapping ?? {});
    if (agents[0]) spawnAgent(agents[0], wfId, role);
  } catch (err) { console.error(`[spawner] step handler: ${String(err)}`); }
}

async function handleStoryPending(payload: { role: string; runId: string; storyId: string }) {
  if (shuttingDown) return;
  const { role, runId } = payload;
  const run = await pgGet<{ workflow_id: string }>("SELECT workflow_id FROM runs WHERE id = $1", [runId]);
  if (!run) return;
  const wfId = run.workflow_id;
  try {
    const loopStep = await pgGet<{ loop_config: string | null }>("SELECT loop_config FROM steps WHERE run_id = $1 AND type = 'loop' AND status = 'running' LIMIT 1", [runId]);
    if (!loopStep) {
      console.log(`[spawner] Story pending but loop step not running for ${wfId}/${role}, skip`);
      return;
    }
    const loopConfig = loopStep.loop_config ? JSON.parse(loopStep.loop_config) : {};
    if (loopConfig.verifyEach && loopConfig.verifyStep) {
      const awaitingVerify = await pgGet<{ cnt: string }>(
        "SELECT COUNT(*) as cnt FROM stories WHERE run_id = $1 AND status = 'done'",
        [runId],
      );
      const activeQaFix = await pgGet<{ cnt: string }>(
        "SELECT COUNT(*) as cnt FROM stories WHERE run_id = $1 AND story_id LIKE 'QA-FIX-%' AND status IN ('pending', 'running')",
        [runId],
      );
      const activeStory = await pgGet<{ cnt: string }>(
        "SELECT COUNT(*) as cnt FROM stories WHERE run_id = $1 AND status IN ('pending', 'running')",
        [runId],
      );
      if (parseInt(awaitingVerify?.cnt || "0", 10) > 0 && parseInt(activeStory?.cnt || "0", 10) === 0 && parseInt(activeQaFix?.cnt || "0", 10) === 0) {
        console.log(`[spawner] Story pending but ${awaitingVerify?.cnt || "0"} done story/stories await verify; skip developer for ${wfId}`);
        return;
      }
    }
    const wf = await loadWorkflowSpec(resolveWorkflowDir(wfId));
    const agents = resolveAgentId(wfId, role, wf.agent_mapping ?? {});
    const cnt = await pgGet<{ cnt: string }>("SELECT COUNT(*) as cnt FROM stories WHERE run_id = $1 AND status = 'running'", [runId]);
    const running = parseInt(cnt?.cnt || "0", 10);
    const parallelCount = loopConfig.parallelCount || 3;
    const slots = parallelCount - running;
    if (slots <= 0) { console.log(`[spawner] No slots for ${wfId}/${role} (${running}/${parallelCount})`); return; }
    const n = Math.min(slots, agents.length);
    for (let i = 0; i < n; i++) spawnAgent(agents[i % agents.length], wfId, role);
  } catch (err) { console.error(`[spawner] story handler: ${String(err)}`); }
}

async function advanceCompletedVerifyEachLoops(): Promise<void> {
  const rows = await pgQuery<{ run_id: string; loop_step_id: string }>(
    `SELECT r.id as run_id, loop_step.id as loop_step_id
     FROM runs r
     JOIN steps loop_step ON loop_step.run_id = r.id
     WHERE r.status = 'running'
       AND loop_step.type = 'loop'
       AND loop_step.status = 'running'
       AND COALESCE(loop_step.loop_config::jsonb, '{}'::jsonb) @> '{"verifyEach":true}'::jsonb
       AND EXISTS (
         SELECT 1 FROM stories any_st
         WHERE any_st.run_id = r.id
       )
       AND NOT EXISTS (
         SELECT 1 FROM stories st
         WHERE st.run_id = r.id
           AND st.status IN ('pending', 'running', 'done', 'failed')
       )
     ORDER BY loop_step.updated_at ASC
     LIMIT 10`
  );
  if (rows.length === 0) return;
  const { checkLoopContinuation } = await import("./installer/step-advance.js");
  for (const row of rows) {
    console.log(`[spawner] Advancing completed verify-each loop for run ${row.run_id.slice(0, 8)}`);
    await checkLoopContinuation(row.run_id, row.loop_step_id);
  }
}

async function autoVerifyMergedPrEachStories() {
  try {
    const rows = await pgQuery<{ run_id: string; context: string | null; loop_step_id: string; loop_config: string | null }>(
      `SELECT DISTINCT r.id as run_id, r.context, loop_step.id as loop_step_id
              , loop_step.loop_config
       FROM runs r
       JOIN steps loop_step ON loop_step.run_id = r.id
       WHERE r.status = 'running'
         AND loop_step.type = 'loop'
         AND COALESCE(loop_step.loop_config::jsonb, '{}'::jsonb) @> '{"verifyEach":true}'::jsonb
         AND NOT EXISTS (
           SELECT 1 FROM steps verify_step
           WHERE verify_step.run_id = r.id
             AND verify_step.step_id = COALESCE(loop_step.loop_config::jsonb->>'verifyStep', 'verify')
             AND verify_step.status IN ('pending', 'running')
         )
         AND EXISTS (
           SELECT 1 FROM stories st
           WHERE st.run_id = r.id AND st.status = 'done' AND st.pr_url IS NOT NULL
         )
       LIMIT 10`
    );
    if (rows.length === 0) return;
    const { autoVerifyDoneStories } = await import("./installer/step-ops.js");
    const { checkLoopContinuation } = await import("./installer/step-advance.js");
    for (const row of rows) {
      let context: Record<string, string> = {};
      try { context = row.context ? JSON.parse(row.context) : {}; } catch {}
      const nextUnverified = await autoVerifyDoneStories(row.run_id, context, "spawner-auto-verify");
      if (!nextUnverified) {
        await checkLoopContinuation(row.run_id, row.loop_step_id);
      } else {
        let verifyStepName = "verify";
        try { verifyStepName = JSON.parse(row.loop_config || "{}").verifyStep || "verify"; } catch {}
        await pgRun(
          "UPDATE steps SET status = 'pending', updated_at = NOW() WHERE run_id = $1 AND step_id = $2 AND status IN ('waiting', 'done', 'pending')",
          [row.run_id, verifyStepName],
        );
      }
    }
  } catch (err) {
    console.error(`[spawner] auto-verify merged PRs: ${String(err)}`);
  }
}

async function pollForPendingWork() {
  if (shuttingDown) return;
  try {
    await reapFinishedClaims();
    await requeueOrphanedRunningStories();
    await autoVerifyMergedPrEachStories();
    await advanceCompletedVerifyEachLoops();
    const steps = await pgQuery<{ agent_id: string; run_id: string; step_id: string }>(
      `SELECT s.agent_id, s.run_id, s.step_id
       FROM steps s
       JOIN runs r ON r.id = s.run_id
       WHERE s.status = 'pending'
         AND r.status = 'running'
         AND NOT (
           s.type = 'loop'
           AND COALESCE(s.loop_config::jsonb, '{}'::jsonb) @> '{"verifyEach":true}'::jsonb
           AND EXISTS (
             SELECT 1 FROM stories done_st
             WHERE done_st.run_id = s.run_id AND done_st.status = 'done'
           )
           AND NOT EXISTS (
             SELECT 1 FROM stories active_st
             WHERE active_st.run_id = s.run_id
               AND active_st.status IN ('pending', 'running')
           )
           AND NOT EXISTS (
             SELECT 1 FROM stories fix_st
             WHERE fix_st.run_id = s.run_id
               AND fix_st.story_id LIKE 'QA-FIX-%'
               AND fix_st.status IN ('pending', 'running')
           )
         )
       ORDER BY s.step_index ASC
       LIMIT 5`
    );
    for (const s of steps) {
      await handleStepPending({ agentId: s.agent_id, runId: s.run_id, stepId: s.step_id });
    }
    const stories = await pgQuery<{ run_id: string; story_id: string }>(
      `SELECT s.run_id, s.story_id
       FROM stories s
       JOIN runs r ON r.id = s.run_id
       WHERE s.status = 'pending'
         AND r.status = 'running'
         AND EXISTS (
           SELECT 1 FROM steps loop_step
           WHERE loop_step.run_id = s.run_id
             AND loop_step.type = 'loop'
             AND loop_step.status = 'running'
         )
         AND NOT EXISTS (
           SELECT 1 FROM steps loop_step
           WHERE loop_step.run_id = s.run_id
             AND loop_step.type = 'loop'
             AND loop_step.status = 'running'
             AND COALESCE(loop_step.loop_config::jsonb, '{}'::jsonb) @> '{"verifyEach":true}'::jsonb
             AND EXISTS (
               SELECT 1 FROM stories done_st
               WHERE done_st.run_id = s.run_id AND done_st.status = 'done'
             )
             AND NOT EXISTS (
               SELECT 1 FROM stories active_st
               WHERE active_st.run_id = s.run_id
                 AND active_st.status IN ('pending', 'running')
             )
             AND NOT EXISTS (
               SELECT 1 FROM stories fix_st
               WHERE fix_st.run_id = s.run_id
                 AND fix_st.story_id LIKE 'QA-FIX-%'
                 AND fix_st.status IN ('pending', 'running')
             )
         )
       ORDER BY s.story_index ASC
       LIMIT 10`
    );
    for (const st of stories) await handleStoryPending({ role: "developer", runId: st.run_id, storyId: st.story_id });
  } catch (err) { console.error(`[spawner] poll: ${String(err)}`); }
}

async function main() {
  process.on("unhandledRejection", (err) => {
    console.warn(`[spawner] unhandled rejection: ${String(err).slice(0, 500)}`);
  });

  fs.mkdirSync(path.dirname(PID_FILE), { recursive: true });
  fs.writeFileSync(PID_FILE, String(process.pid));
  console.log(`[spawner] Starting (PID ${process.pid})`);
  await pgMigrate();
  killStartupOrphanSpawnerAgents();
  await failStaleRunningClaimsFromPreviousSpawner();
  await requeueOrphanedRunningStories();
  await cleanupRunningRunEphemeraOnStartup();
  await restartGatewayAfterOpenClawCleanup("startup", cleanupStaleSetfarmOpenClawTaskRecords("startup"));

  const shutdown = async () => {
    shuttingDown = true;
    console.log(`[spawner] Shutting down (${activeProcesses.size} active)`);
    for (const [, active] of activeProcesses) {
      await releaseActiveProcessForShutdown(active);
      terminateActiveProcess(active, "spawner-shutdown");
    }
    await pgClose();
    try { fs.unlinkSync(PID_FILE); } catch {}
    setTimeout(() => process.exit(0), 5000);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  const pgUrl = process.env.SETFARM_PG_URL || "postgresql://localhost:5432/setfarm";
  const listener = postgres(pgUrl, { max: 1 });

  await listener.listen("step_pending", (msg) => {
    try { handleStepPending(JSON.parse(msg)); } catch {}
  });
  await listener.listen("story_pending", (msg) => {
    try { handleStoryPending(JSON.parse(msg)); } catch {}
  });
  await listener.listen("run_cancelled", (msg) => {
    try {
      const payload = JSON.parse(msg);
      if (payload?.runId) cancelRunAgents(String(payload.runId));
    } catch {}
  });

  console.log("[spawner] Listening for step_pending and story_pending events");
  setInterval(pollForPendingWork, POLL_INTERVAL_MS);
  setInterval(() => {
    const result = cleanupStaleSetfarmOpenClawTaskRecords("interval");
    void restartGatewayAfterOpenClawCleanup("interval", result);
  }, OPENCLAW_STALE_TASK_SWEEP_MS);
  await pollForPendingWork();
  console.log("[spawner] Ready");
}

main().catch((err) => { console.error(`[spawner] Fatal: ${String(err)}`); process.exit(1); });
