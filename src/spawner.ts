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
import { logger } from "./lib/logger.js";

const OPENCLAW_CLI = process.env.OPENCLAW_CLI || "/home/setrox/.local/bin/openclaw";
const POLL_INTERVAL_MS = 30_000;
const AGENT_TIMEOUT_SECONDS = 1800;
const PID_FILE = path.join(os.homedir(), ".openclaw", "setfarm", "spawner.pid");
const MAX_CONCURRENT = 8;

const activeProcesses = new Map<string, ChildProcess>();
let shuttingDown = false;

function resolveAgentId(wfId: string, role: string, mapping: Record<string, string | string[]>): string[] {
  const m = mapping[role];
  if (Array.isArray(m)) return m;
  if (m) return [m];
  return [role];
}

function spawnAgent(agentId: string, wfId: string, role: string): void {
  const key = `${wfId}:${role}:${agentId}:${Date.now()}`;
  if (activeProcesses.size >= MAX_CONCURRENT) {
    logger.info(`[spawner] At capacity (${activeProcesses.size}/${MAX_CONCURRENT}), skip ${agentId}`);
    return;
  }
  const prompt = buildPollingPrompt(wfId, role, agentId);
  logger.info(`[spawner] Spawning ${agentId} for ${wfId}/${role} (active: ${activeProcesses.size})`);

  const child = execFile(OPENCLAW_CLI, [
    "agent", "--agent", agentId,
    "--message", prompt, "--timeout", String(AGENT_TIMEOUT_SECONDS),
  ], {
    timeout: (AGENT_TIMEOUT_SECONDS + 60) * 1000,
    env: { ...process.env, DB_BACKEND: "postgres" },
    maxBuffer: 10 * 1024 * 1024,
  }, (err) => {
    activeProcesses.delete(key);
    if (err) logger.warn(`[spawner] ${agentId} exited: ${err.message}`);
    else logger.info(`[spawner] ${agentId} completed`);
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
  } catch (err) { logger.error(`[spawner] step handler: ${String(err)}`); }
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
    if (slots <= 0) { logger.info(`[spawner] No slots for ${wfId}/${role} (${running}/${parallelCount})`); return; }
    const n = Math.min(slots, agents.length);
    for (let i = 0; i < n; i++) spawnAgent(agents[i % agents.length], wfId, role);
  } catch (err) { logger.error(`[spawner] story handler: ${String(err)}`); }
}

async function pollForPendingWork() {
  if (shuttingDown) return;
  try {
    const steps = await pgQuery<{ agent_id: string; run_id: string; step_id: string }>(
      "SELECT s.agent_id, s.run_id, s.step_id FROM steps s JOIN runs r ON r.id = s.run_id WHERE s.status = 'pending' AND r.status = 'running' ORDER BY s.step_index ASC LIMIT 5"
    );
    for (const s of steps) await handleStepPending({ agentId: s.agent_id, runId: s.run_id, stepId: s.step_id });
    const stories = await pgQuery<{ run_id: string; story_id: string }>(
      "SELECT DISTINCT s.run_id, s.story_id FROM stories s JOIN runs r ON r.id = s.run_id WHERE s.status = 'pending' AND r.status = 'running' ORDER BY s.story_index ASC LIMIT 10"
    );
    for (const st of stories) await handleStoryPending({ role: "developer", runId: st.run_id, storyId: st.story_id });
  } catch (err) { logger.error(`[spawner] poll: ${String(err)}`); }
}

async function main() {
  fs.mkdirSync(path.dirname(PID_FILE), { recursive: true });
  fs.writeFileSync(PID_FILE, String(process.pid));
  logger.info(`[spawner] Starting (PID ${process.pid})`);

  const shutdown = () => {
    shuttingDown = true;
    logger.info(`[spawner] Shutting down (${activeProcesses.size} active)`);
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

  logger.info("[spawner] Listening for step_pending and story_pending events");
  setInterval(pollForPendingWork, POLL_INTERVAL_MS);
  await pollForPendingWork();
  logger.info("[spawner] Ready");
}

main().catch((err) => { logger.error(`[spawner] Fatal: ${String(err)}`); process.exit(1); });
