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
import { pgGet, pgQuery, pgRun } from "./db-pg.js";
import { loadWorkflowSpec } from "./installer/workflow-spec.js";
import { resolveWorkflowDir, resolveSetfarmCli } from "./installer/paths.js";
import { PR_REVIEW_DELAY_MS } from "./installer/constants.js";
import { claimStep } from "./installer/step-ops.js";
import { failStep } from "./installer/step-fail.js";

const OPENCLAW_CLI = process.env.OPENCLAW_CLI || "/home/setrox/.local/bin/openclaw";
const POLL_INTERVAL_MS = 30_000;
const AGENT_TIMEOUT_SECONDS = 1800;
const PID_FILE = path.join(os.homedir(), ".openclaw", "setfarm", "spawner.pid");
const MAX_CONCURRENT = 8;
const SPAWN_STAGGER_MS = parseInt(process.env.SETFARM_SPAWN_STAGGER_MS || "12000", 10);
const NON_DEVELOPER_STUCK_MS = parsePositiveInt(process.env.SETFARM_AGENT_STUCK_MS, 5 * 60_000);
const DEVELOPER_STUCK_MS = parsePositiveInt(process.env.SETFARM_DEVELOPER_AGENT_STUCK_MS, 8 * 60_000);
const STARTUP_RUNNING_GRACE_MS = parsePositiveInt(process.env.SETFARM_STARTUP_RUNNING_GRACE_MS, 0);
const QA_AGENT_STUCK_MS = parsePositiveInt(process.env.SETFARM_QA_AGENT_STUCK_MS, 12 * 60_000);
const GATEWAY_HEALTH_URL = process.env.OPENCLAW_GATEWAY_HEALTH_URL || "http://127.0.0.1:18789/health";
const GATEWAY_PRESPAWN_RETRY_MS = parsePositiveInt(process.env.SETFARM_GATEWAY_PRESPAWN_RETRY_MS, 10_000);
const GATEWAY_WARMUP_MS = parsePositiveInt(process.env.SETFARM_GATEWAY_WARMUP_MS, 150_000);
const spawnerStartedAtMs = Date.now();

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

type ActiveProcess = {
  child: ChildProcess;
  runId: string;
  stepId: string;
  agentId: string;
  wfId: string;
  role: string;
  startedAtMs: number;
  transcriptPath: string;
  sessionId: string;
  sessionKey: string;
};

const activeProcesses = new Map<string, ActiveProcess>();
const queuedSpawns = new Set<string>();
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

function stuckThresholdMs(role: string): number {
  if (role.includes("qa") || role.includes("test")) return QA_AGENT_STUCK_MS;
  return role === "developer" ? DEVELOPER_STUCK_MS : NON_DEVELOPER_STUCK_MS;
}

async function isGatewayReady(): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);
  try {
    const res = await fetch(GATEWAY_HEALTH_URL, { signal: controller.signal });
    if (!res.ok) return false;
    const text = await res.text();
    if (!text.trim()) return true;
    try {
      const body = JSON.parse(text);
      if (typeof body.ready === "boolean") return body.ready === true;
      if (typeof body.ok === "boolean") return body.ok === true;
    } catch {
      // Some gateway endpoints return plain text/html after readiness. Treat 2xx as ready.
    }
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

function isVerifyReviewDelayActive(stepId: string, runContext: string | null): boolean {
  if (stepId !== "verify" || !runContext) return false;
  try {
    const context = JSON.parse(runContext);
    const sinceRaw = context?.verify_pending_since;
    const prUrl = context?.verify_pending_pr_url;
    if (!sinceRaw || !prUrl) return false;
    const sinceMs = new Date(String(sinceRaw)).getTime();
    return Number.isFinite(sinceMs) && Date.now() - sinceMs < PR_REVIEW_DELAY_MS;
  } catch {
    return false;
  }
}

function buildOpenClawChildEnv(): NodeJS.ProcessEnv {
  const e: Record<string, string | undefined> = { ...process.env, OPENCLAW_AUTO_APPROVE: "1" };
  for (const k of ["SETFARM_PG_URL", "MASTER_POSTGRES_URL", "MASTER_MARIADB_URL", "MASTER_MONGODB_URL"]) {
    delete e[k];
  }
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
      return;
    }
    console.log(`[spawner] OpenClaw task cancelled for ${lookup} (${context})`);
  });
}

function terminateActiveProcess(active: ActiveProcess, context: string): void {
  cancelOpenClawTask(active.sessionKey, context);
  killProcessTree(active.child.pid, "SIGTERM");
  setTimeout(() => killProcessTree(active.child.pid, "SIGKILL"), 5000);
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

async function failClaimIfStillRunning(stepId: string, agentId: string, wfId: string, role: string, transcriptPath: string, err: unknown, startedAtMs?: number): Promise<void> {
  try {
    const row = await pgGet<{ status: string; step_id: string; run_id: string; type: string; current_story_id: string | null }>(
      "SELECT status, step_id, run_id, type, current_story_id FROM steps WHERE id = $1 LIMIT 1",
      [stepId],
    );
    if (!row || row.status !== "running") return;

    if (row.type === "loop" && await loopStoryCompletedAfter(row.run_id, agentId, row.current_story_id, startedAtMs)) {
      console.log(`[spawner] ${agentId} exited after completing a loop story for ${wfId}/${role}; keeping loop ${row.step_id} running (${compactExitReason(err)})`);
      return;
    }

    const reason = `AGENT_PROCESS_EXITED: ${agentId} exited before completing ${wfId}/${role}. ${compactExitReason(err)}. Transcript: ${transcriptPath}`;
    console.warn(`[spawner] failing still-running claim ${stepId} (${row.step_id}) after agent exit`);
    await failStep(stepId, reason);
  } catch (failErr) {
    console.warn(`[spawner] failed to mark exited agent claim as failed: ${String(failErr).slice(0, 300)}`);
  }
}

async function reapFinishedClaims(): Promise<void> {
  for (const [key, active] of activeProcesses) {
    try {
      const row = await pgGet<{ step_status: string; run_status: string; step_id: string; run_id: string; type: string; current_story_id: string | null }>(
        `SELECT s.status as step_status, r.status as run_status, s.step_id, s.run_id, s.type, s.current_story_id
         FROM steps s
         JOIN runs r ON r.id = s.run_id
         WHERE s.id = $1
         LIMIT 1`,
        [active.stepId],
      );
      if (!row) {
        console.warn(`[spawner] Reaping ${key}: claimed step disappeared`);
      } else if (row.run_status === "running" && row.step_status === "running") {
        if (row.step_id === "verify" && !await verifyEachHasDoneStory(active.runId, row.step_id)) {
          console.log(`[spawner] Reaping stale verify agent ${key}: no done story awaits verify`);
          terminateActiveProcess(active, "verify-no-done-story");
          activeProcesses.delete(key);
          await pgRun("UPDATE steps SET status = 'waiting', updated_at = NOW() WHERE id = $1 AND status = 'running'", [active.stepId]);
          continue;
        }

        const ageMs = Date.now() - active.startedAtMs;
        const thresholdMs = stuckThresholdMs(active.role);
        if (ageMs < thresholdMs) continue;

        if (row.type === "loop" && await loopStoryCompletedAfter(row.run_id, active.agentId, row.current_story_id, active.startedAtMs)) {
          console.log(`[spawner] Reaping completed loop agent ${key}: story completed before watchdog threshold`);
          terminateActiveProcess(active, "watchdog-completed-loop");
          activeProcesses.delete(key);
          continue;
        }

        const reason = `AGENT_PROCESS_STUCK: ${active.agentId} kept ${active.wfId}/${active.role} running for ${formatDurationMs(ageMs)} without step complete/fail; killed by spawner watchdog. Transcript: ${active.transcriptPath}`;
        console.warn(`[spawner] ${reason}`);
        try { fs.appendFileSync(active.transcriptPath, `--- WATCHDOG ${new Date().toISOString()} ---
${reason}
`); } catch {}
        terminateActiveProcess(active, "watchdog-stuck");
        activeProcesses.delete(key);
        await failStep(active.stepId, reason);
        continue;
      } else {
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
  if (activeProcesses.has(key)) {
    console.log(`[spawner] Already running: ${key}, skip`);
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
  if (activeProcesses.has(key)) {
    console.log(`[spawner] Already running: ${key}, skip`);
    return;
  }
  if (activeProcesses.size >= MAX_CONCURRENT) {
    console.log(`[spawner] At capacity (${activeProcesses.size}/${MAX_CONCURRENT}), skip ${agentId}`);
    return;
  }
  const gatewayWarmupRemainingMs = GATEWAY_WARMUP_MS - (Date.now() - spawnerStartedAtMs);
  if (gatewayWarmupRemainingMs > 0) {
    const delayMs = Math.min(Math.max(gatewayWarmupRemainingMs, GATEWAY_PRESPAWN_RETRY_MS), GATEWAY_WARMUP_MS);
    console.warn(`[spawner] Gateway warmup active; delaying ${key} for ${delayMs}ms`);
    queuedSpawns.add(key);
    setTimeout(() => {
      queuedSpawns.delete(key);
      if (!shuttingDown) void spawnAgentNow(agentId, wfId, role);
    }, delayMs);
    return;
  }
  if (!(await isGatewayReady())) {
    console.warn(`[spawner] Gateway not live (${GATEWAY_HEALTH_URL}); delaying ${key} for ${GATEWAY_PRESPAWN_RETRY_MS}ms`);
    queuedSpawns.add(key);
    setTimeout(() => {
      queuedSpawns.delete(key);
      if (!shuttingDown) void spawnAgentNow(agentId, wfId, role);
    }, GATEWAY_PRESPAWN_RETRY_MS);
    return;
  }
  const outputFileId = agentId + "-spawner";
  const claimFile = path.join("/tmp", "claim-" + outputFileId + ".json");
  const stalePath = path.join("/tmp", "setfarm-output-" + outputFileId + ".txt");
  try { fs.unlinkSync(stalePath); } catch { /* didnt exist, fine */ }
  try { fs.unlinkSync(claimFile); } catch { /* didnt exist, fine */ }

  const fullAgentId = `${wfId}_${role}`;
  let claim: Awaited<ReturnType<typeof claimStep>>;
  try {
    claim = await claimStep(fullAgentId, agentId);
  } catch (err) {
    console.warn("[spawner] claim failed for " + fullAgentId + ": " + String(err));
    return;
  }
  if (!claim.found) {
    console.log("[spawner] No claimable work for " + fullAgentId + ", skip spawn");
    return;
  }
  fs.writeFileSync(claimFile, JSON.stringify({ stepId: claim.stepId, runId: claim.runId, input: claim.resolvedInput }) + "\n");

  const prompt = buildPreclaimedPrompt(wfId, role, agentId, outputFileId, claimFile);
  console.log("[spawner] Spawning " + agentId + " for " + wfId + "/" + role + " after pre-claim (active: " + activeProcesses.size + ")");
  // capture agent stdout/stderr to a transcript file for post-hoc diagnosis.
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const transcriptPath = path.join(TRANSCRIPT_ROOT, wfId, agentId + "-" + ts + ".log");
  try { fs.mkdirSync(path.dirname(transcriptPath), { recursive: true }); } catch {}
  try { fs.writeFileSync(transcriptPath, "[spawner] " + new Date().toISOString() + " " + wfId + "/" + role + " agent=" + agentId + "\n"); } catch {}

  // cuddly-sleeping-quail: unique session-id per spawn. Without this the gateway
  // routes every call into the persistent default session (agent:main:main) and
  // the agent's conversation history piles up across spawns until it just emits
  // intro lines without running any bash. Cron-spawned agents avoid this via
  // `sessionTarget: "isolated"` in the cron config; we get the same effect here
  // by passing --session-id with a unique value per spawn.
  const sessionId = "spawner-" + agentId + "-" + Date.now() + "-" + Math.random().toString(36).slice(2, 10);
  const sessionKey = buildSessionKey(agentId, sessionId);
  const childArgs = [
    "agent", "--json", "--agent", agentId,
    "--session-id", sessionId,
    "--message", prompt, "--timeout", String(AGENT_TIMEOUT_SECONDS),
  ];
  const outFd = fs.openSync(transcriptPath, "a");
  const errFd = fs.openSync(transcriptPath, "a");
  const child = spawn(OPENCLAW_CLI, childArgs, {
    cwd: AGENT_SAFE_CWD,  // Wave 13 Bug M — start outside any git repo
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
    terminateActiveProcess(
      { child, runId: claim.runId || "", stepId: claim.stepId || "", agentId, wfId, role, startedAtMs, transcriptPath, sessionId, sessionKey },
      "spawn-hard-timeout",
    );
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
    if (isCurrentProcess && !shuttingDown && claim.stepId) void failClaimIfStillRunning(claim.stepId, agentId, wfId, role, transcriptPath, err, startedAtMs);
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
      if (isCurrentProcess && !shuttingDown && claim.stepId) void failClaimIfStillRunning(claim.stepId, agentId, wfId, role, transcriptPath, err, startedAtMs);
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
        );
      }
    }
  });
  if (child.pid && claim.runId && claim.stepId) {
    activeProcesses.set(key, { child, runId: claim.runId, stepId: claim.stepId, agentId, wfId, role, startedAtMs, transcriptPath, sessionId, sessionKey });
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
    const row = await pgGet<{ type: string; current_story_id: string | null }>(
      "SELECT type, current_story_id FROM steps WHERE id = $1 AND status = 'running' LIMIT 1",
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
      console.log(`[spawner] released active loop claim for shutdown: ${active.agentId} ${active.wfId}/${active.role}`);
      return;
    }

    await pgRun("UPDATE steps SET status = 'pending', updated_at = NOW() WHERE id = $1 AND status = 'running'", [active.stepId]);
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
        if (parseInt(awaitingVerify?.cnt || "0", 10) > 0) {
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
      if (parseInt(awaitingVerify?.cnt || "0", 10) > 0) {
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

async function autoVerifyMergedPrEachStories() {
  try {
    const rows = await pgQuery<{ run_id: string; context: string | null }>(
      `SELECT DISTINCT r.id as run_id, r.context
       FROM runs r
       JOIN steps loop_step ON loop_step.run_id = r.id
       WHERE r.status = 'running'
         AND loop_step.type = 'loop'
         AND COALESCE(loop_step.loop_config::jsonb, '{}'::jsonb) @> '{"verifyEach":true}'::jsonb
         AND EXISTS (
           SELECT 1 FROM stories st
           WHERE st.run_id = r.id AND st.status = 'done' AND st.pr_url IS NOT NULL
         )
       LIMIT 10`
    );
    if (rows.length === 0) return;
    const { autoVerifyDoneStories } = await import("./installer/step-ops.js");
    for (const row of rows) {
      let context: Record<string, string> = {};
      try { context = row.context ? JSON.parse(row.context) : {}; } catch {}
      await autoVerifyDoneStories(row.run_id, context, "spawner-auto-verify");
    }
  } catch (err) {
    console.error(`[spawner] auto-verify merged PRs: ${String(err)}`);
  }
}

async function pollForPendingWork() {
  if (shuttingDown) return;
  try {
    await reapFinishedClaims();
    await autoVerifyMergedPrEachStories();
    const steps = await pgQuery<{ agent_id: string; run_id: string; step_id: string; context: string | null }>(
      `SELECT s.agent_id, s.run_id, s.step_id, r.context
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
         )
       ORDER BY s.step_index ASC
       LIMIT 5`
    );
    for (const s of steps) {
      if (isVerifyReviewDelayActive(s.step_id, s.context)) {
        console.log(`[spawner] Verify review delay active for run ${s.run_id.slice(0, 8)}; skip spawn`);
        continue;
      }
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
         )
       ORDER BY s.story_index ASC
       LIMIT 10`
    );
    for (const st of stories) await handleStoryPending({ role: "developer", runId: st.run_id, storyId: st.story_id });
  } catch (err) { console.error(`[spawner] poll: ${String(err)}`); }
}

async function main() {
  fs.mkdirSync(path.dirname(PID_FILE), { recursive: true });
  fs.writeFileSync(PID_FILE, String(process.pid));
  console.log(`[spawner] Starting (PID ${process.pid})`);
  killStartupOrphanSpawnerAgents();
  await failStaleRunningClaimsFromPreviousSpawner();

  const shutdown = () => {
    shuttingDown = true;
    console.log(`[spawner] Shutting down (${activeProcesses.size} active)`);
    for (const [, active] of activeProcesses) {
      void releaseActiveProcessForShutdown(active);
      terminateActiveProcess(active, "spawner-shutdown");
    }
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
  await pollForPendingWork();
  console.log("[spawner] Ready");
}

main().catch((err) => { console.error(`[spawner] Fatal: ${String(err)}`); process.exit(1); });
