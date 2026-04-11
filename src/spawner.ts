/**
 * Setfarm Event-Driven Spawner
 * Listens to PostgreSQL NOTIFY events for pending steps/stories
 * and immediately spawns agent sessions via openclaw CLI.
 */
import postgres from "postgres";
import { execFile, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { pgGet, pgQuery } from "./db-pg.js";
import { buildPollingPrompt } from "./installer/agent-cron.js";
import { loadWorkflowSpec } from "./installer/workflow-spec.js";
import { resolveWorkflowDir } from "./installer/paths.js";

const OPENCLAW_CLI = process.env.OPENCLAW_CLI || "/home/setrox/.local/bin/openclaw";
const POLL_INTERVAL_MS = 30_000;
const AGENT_TIMEOUT_SECONDS = 1800;
const PID_FILE = path.join(os.homedir(), ".openclaw", "setfarm", "spawner.pid");
const MAX_CONCURRENT = 8;

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

const activeProcesses = new Map<string, ChildProcess>();
let shuttingDown = false;

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

function spawnAgent(agentId: string, wfId: string, role: string): void {
  const key = `${wfId}:${role}:${agentId}`;
  if (activeProcesses.has(key)) {
    console.log(`[spawner] Already running: ${key}, skip`);
    return;
  }
  if (activeProcesses.size >= MAX_CONCURRENT) {
    console.log(`[spawner] At capacity (${activeProcesses.size}/${MAX_CONCURRENT}), skip ${agentId}`);
    return;
  }
  const prompt = buildPollingPrompt(wfId, role, agentId);
  console.log("[spawner] Spawning " + agentId + " for " + wfId + "/" + role + " (active: " + activeProcesses.size + ")");

  // cuddly-sleeping-quail: capture agent stdout/stderr to a transcript file for
  // post-hoc NO_WORK diagnosis. One file per spawn.
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const transcriptPath = path.join(TRANSCRIPT_ROOT, wfId, agentId + "-" + ts + ".log");
  try { fs.mkdirSync(path.dirname(transcriptPath), { recursive: true }); } catch {}
  try { fs.writeFileSync(transcriptPath, "[spawner] " + new Date().toISOString() + " " + wfId + "/" + role + " agent=" + agentId + "\n"); } catch {}

  const child = execFile(OPENCLAW_CLI, [
    "agent", "--agent", agentId,
    "--message", prompt, "--timeout", String(AGENT_TIMEOUT_SECONDS),
  ], {
    cwd: AGENT_SAFE_CWD,  // Wave 13 Bug M — start outside any git repo
    timeout: (AGENT_TIMEOUT_SECONDS + 60) * 1000,
    // Security audit S-1: explicit env allowlist. Previous `{...process.env}` leaked
    // ALL secrets (API keys, DB password, master URLs) to every agent child process.
    // Agents can run `printenv` and see everything. OpenClaw gateway handles API key
    // resolution internally — agents do not need direct key access.
    // Security: denylist DB credentials from agent env. Keep everything
    // else — OpenClaw CLI needs many env vars and allowlist is too fragile.
    env: (() => {
      const e: Record<string, string | undefined> = { ...process.env, OPENCLAW_AUTO_APPROVE: "1" };
      // Denylist: strip DB credentials only
      for (const k of ["SETFARM_PG_URL", "MASTER_POSTGRES_URL", "MASTER_MARIADB_URL", "MASTER_MONGODB_URL"]) {
        delete e[k];
      }
      return e;
    })(),
    maxBuffer: 10 * 1024 * 1024,
  }, (err, stdout, stderr) => {
    activeProcesses.delete(key);
    try {
      let body = "";
      if (stdout) body += "--- STDOUT ---\n" + String(stdout) + "\n";
      if (stderr) body += "--- STDERR ---\n" + String(stderr) + "\n";
      if (err) body += "--- EXIT ---\n" + String((err as any).message || err) + "\n";
      body += "--- FINISHED " + new Date().toISOString() + " ---\n";
      fs.appendFileSync(transcriptPath, body);
    } catch (e) { console.warn("[spawner] transcript write failed: " + String(e)); }
    if (err) console.warn("[spawner] " + agentId + " exited: " + ((err as any).message || err) + " (transcript: " + transcriptPath + ")");
    else console.log("[spawner] " + agentId + " completed (transcript: " + transcriptPath + ")");
  });
  if (child.pid) activeProcesses.set(key, child);
}

async function handleStepPending(payload: { agentId: string; runId: string; stepId: string }) {
  if (shuttingDown) return;
  const { agentId, runId } = payload;
  const run = await pgGet<{ workflow_id: string }>("SELECT workflow_id FROM runs WHERE id = $1", [runId]);
  if (!run) return;
  const wfId = run.workflow_id;
  const role = agentId.replace(`${wfId}_`, "");
  try {
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
    const wf = await loadWorkflowSpec(resolveWorkflowDir(wfId));
    const agents = resolveAgentId(wfId, role, wf.agent_mapping ?? {});
    const cnt = await pgGet<{ cnt: string }>("SELECT COUNT(*) as cnt FROM stories WHERE run_id = $1 AND status = 'running'", [runId]);
    const running = parseInt(cnt?.cnt || "0", 10);
    const loopStep = await pgGet<{ loop_config: string }>("SELECT loop_config FROM steps WHERE run_id = $1 AND type = 'loop' AND status = 'running' LIMIT 1", [runId]);
    const parallelCount = loopStep?.loop_config ? JSON.parse(loopStep.loop_config).parallelCount || 3 : 3;
    const slots = parallelCount - running;
    if (slots <= 0) { console.log(`[spawner] No slots for ${wfId}/${role} (${running}/${parallelCount})`); return; }
    const n = Math.min(slots, agents.length);
    for (let i = 0; i < n; i++) spawnAgent(agents[i % agents.length], wfId, role);
  } catch (err) { console.error(`[spawner] story handler: ${String(err)}`); }
}

async function pollForPendingWork() {
  if (shuttingDown) return;
  try {
    const steps = await pgQuery<{ agent_id: string; run_id: string; step_id: string }>(
      "SELECT s.agent_id, s.run_id, s.step_id FROM steps s JOIN runs r ON r.id = s.run_id WHERE s.status = 'pending' AND r.status = 'running' ORDER BY s.step_index ASC LIMIT 5"
    );
    for (const s of steps) await handleStepPending({ agentId: s.agent_id, runId: s.run_id, stepId: s.step_id });
    const stories = await pgQuery<{ run_id: string; story_id: string }>(
      "SELECT s.run_id, s.story_id FROM stories s JOIN runs r ON r.id = s.run_id WHERE s.status = 'pending' AND r.status = 'running' ORDER BY s.story_index ASC LIMIT 10"
    );
    for (const st of stories) await handleStoryPending({ role: "developer", runId: st.run_id, storyId: st.story_id });
  } catch (err) { console.error(`[spawner] poll: ${String(err)}`); }
}

async function main() {
  fs.mkdirSync(path.dirname(PID_FILE), { recursive: true });
  fs.writeFileSync(PID_FILE, String(process.pid));
  console.log(`[spawner] Starting (PID ${process.pid})`);

  const shutdown = () => {
    shuttingDown = true;
    console.log(`[spawner] Shutting down (${activeProcesses.size} active)`);
    for (const [, child] of activeProcesses) { try { child.kill("SIGTERM"); } catch {} }
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

  console.log("[spawner] Listening for step_pending and story_pending events");
  setInterval(pollForPendingWork, POLL_INTERVAL_MS);
  await pollForPendingWork();
  console.log("[spawner] Ready");
}

main().catch((err) => { console.error(`[spawner] Fatal: ${String(err)}`); process.exit(1); });
