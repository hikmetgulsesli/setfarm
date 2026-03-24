import { createAgentCronJob, deleteAgentCronJobs, deleteCronJob, listCronJobs, checkCronToolAvailable } from "./gateway-api.js";
import type { WorkflowSpec, AgentMapping } from "./types.js";
import { resolveSetfarmCli } from "./paths.js";
import { getDb } from "../db.js";
import { logger } from "../lib/logger.js";

const DEFAULT_EVERY_MS = 240_000; // 4 minutes
const DEFAULT_AGENT_TIMEOUT_SECONDS = 30 * 60; // 30 minutes

const DEFAULT_POLLING_TIMEOUT_SECONDS = 120;
const DEFAULT_POLLING_MODEL = "minimax/MiniMax-M2.7";

/**
 * Build inline execution prompt — no sessions_spawn.
 *
 * The agent peeks, claims, and does the work ALL in the same session.
 * This eliminates the unreliable spawn layer that caused orphaned stories.
 *
 * Before (v1.1): peek → claim → sessions_spawn(work) → [spawn dies] → orphan
 * After  (v1.2): peek → claim → do work inline → step complete → done
 */
export function buildPollingPrompt(workflowId: string, agentId: string): string {
  const fullAgentId = `${workflowId}_${agentId}`;
  const cli = resolveSetfarmCli();

  // Compact prompt — minimizes tokens on NO_WORK (majority of calls)
  return `Workflow agent. Peek→Claim→Work→Complete.

1. /usr/bin/node ${cli} step peek "${fullAgentId}"
   NO_WORK → reply "HEARTBEAT_OK", STOP.

2. /usr/bin/node ${cli} step claim "${fullAgentId}"
   NO_WORK → "HEARTBEAT_OK", STOP.
   JSON output contains {"stepId":"<UUID>","runId":"<UUID>","input":"..."}.
   CRITICAL: Save the "stepId" value (NOT "runId"). You MUST use stepId for complete/fail.

3. Do the work described in "input". No narration.

4. Write output in KEY: VALUE format (NOT JSON), then complete:
cat <<'SETFARM_EOF' > .setfarm-step-output.txt
STATUS: done
<other keys as specified in step input>
SETFARM_EOF
cat .setfarm-step-output.txt | /usr/bin/node ${cli} step complete "<the stepId from claim JSON>"
On failure: /usr/bin/node ${cli} step fail "<the stepId from claim JSON>" "reason"

5. STOP. Reply "HEARTBEAT_OK". No more tool calls.

Rules: NO_WORK/complete/fail → SESSION OVER. Never skip peek. Never run workflow stop/uninstall/sessions_spawn. Write output to file, pipe via stdin. Output must be KEY: VALUE lines, NOT JSON.`;
}

export async function setupAgentCrons(workflow: WorkflowSpec): Promise<void> {
  // Always remove existing crons first to prevent duplicates
  // Gateway API creates new crons even if same name exists
  await removeAgentCrons(workflow.id);
  // Wait for WS to settle after bulk cron removal (OpenClaw 2026.3.13 handshake issue)
  await new Promise(r => setTimeout(r, 3000));
  const agents = workflow.agents;
  // Allow per-workflow cron interval via cron.interval_ms in workflow.yml
  const everyMs = (workflow as any).cron?.interval_ms ?? DEFAULT_EVERY_MS;

  // Agent mapping: maps workflow role IDs to real OpenClaw agent IDs
  // e.g. { developer: "koda", verifier: "sinan", planner: "main" }
  const agentMapping: AgentMapping = workflow.agent_mapping ?? {};


  for (let i = 0; i < agents.length; i++) {
    const agent = agents[i];
    const anchorMs = i * 15_000; // stagger by 15s each
    const cronName = `setfarm/${workflow.id}/${agent.id}`;
    // Use mapped OpenClaw agent ID if available, otherwise fall back to workflow agent ID
    const rawMappedId = agentMapping[agent.id];
    const mappedAgentId = Array.isArray(rawMappedId) ? rawMappedId[0] : rawMappedId;
    const cronAgentId = mappedAgentId ?? `${workflow.id}_${agent.id}`;

    // Model is NOT passed to the cron payload — the gateway resolves it
    // from the agent's config in openclaw.json (which includes fallbacks).
    // This ensures failover works when the primary model is unavailable.
    const prompt = buildPollingPrompt(workflow.id, agent.id);
    // Timeout must accommodate full work duration (30min), not just peek (2min).
    // Heartbeats still finish in seconds — timeout is just the max.
    const timeoutSeconds = agent.timeoutSeconds ?? DEFAULT_AGENT_TIMEOUT_SECONDS;

    const result = await createAgentCronJob({
      name: cronName,
      schedule: { kind: "every", everyMs, anchorMs },
      sessionTarget: "isolated",
      agentId: cronAgentId,
      payload: { kind: "agentTurn", message: prompt, timeoutSeconds },
      delivery: { mode: "none" },
      enabled: true,
    });

    if (!result.ok) {
      // Retry once after 2s — WS may still be settling
      await new Promise(r => setTimeout(r, 2000));
      const retry = await createAgentCronJob({
        name: cronName,
        schedule: { kind: "every", everyMs, anchorMs },
        sessionTarget: "isolated",
        agentId: cronAgentId,
        payload: { kind: "agentTurn", message: prompt, timeoutSeconds },
        delivery: { mode: "none" },
        enabled: true,
      });
      if (!retry.ok) {
        // Fix 1: Don't throw — log and continue so remaining agents still get crons
        logger.warn(`[setupAgentCrons] Failed to create cron for ${cronName} (agent ${cronAgentId}) after retry — skipping`, {});
        continue;
      }
    }

    // Create parallel crons for roles with multiple agents, count derived from agent_mapping
    const PARALLEL_AGENTS = ["developer", "reviewer", "verifier"];
    if (PARALLEL_AGENTS.includes(agent.id)) {
      // Get all mapped agents for this role (supports string or string[])
      const rawMapping = agentMapping[agent.id];
      const allAgents: string[] = Array.isArray(rawMapping)
        ? rawMapping
        : rawMapping ? [rawMapping] : [cronAgentId];
      const parallelCount = allAgents.length; // dynamic: 5 developers → 5 crons

      for (let n = 2; n <= parallelCount; n++) {
        // Round-robin distribute across available agents
        const agentForCron = allAgents[(n - 1) % allAgents.length];
        const pName = `setfarm/${workflow.id}/${agent.id}-${n}`;
        await createAgentCronJob({
          name: pName,
          schedule: { kind: "every", everyMs, anchorMs: anchorMs + n * 15_000 },
          sessionTarget: "isolated",
          agentId: agentForCron,
          payload: { kind: "agentTurn", message: prompt, timeoutSeconds },
          enabled: true,
        });
      }
    }
  }
}

export async function removeAgentCrons(workflowId: string): Promise<void> {
  await deleteAgentCronJobs(`setfarm/${workflowId}/`);
}

// ── Run-scoped cron lifecycle ───────────────────────────────────────

/**
 * Count active (running) runs for a given workflow.
 */
function countActiveRuns(workflowId: string): number {
  const db = getDb();
  const row = db.prepare(
    "SELECT COUNT(*) as cnt FROM runs WHERE workflow_id = ? AND status = 'running'"
  ).get(workflowId) as { cnt: number };
  return row.cnt;
}

/**
 * Check if crons already exist for a workflow.
 */
async function workflowCronsExist(workflowId: string): Promise<boolean> {
  const result = await listCronJobs();
  if (!result.ok || !result.jobs) return false;
  const prefix = `setfarm/${workflowId}/`;
  return result.jobs.some((j) => j.name.startsWith(prefix));
}

/**
 * Start crons for a workflow when a run begins.
 * No-ops if crons already exist (another run of the same workflow is active).
 */
export async function ensureWorkflowCrons(workflow: WorkflowSpec): Promise<void> {
  if (await workflowCronsExist(workflow.id)) {
    // Crons already exist — skip to prevent anchor-reset loop (#48 fix)
    // Use `workflow ensure-crons <name>` CLI to force-recreate when config changes.
    return;
  }

  // Preflight: verify cron tool is accessible before attempting to create jobs
  const preflight = await checkCronToolAvailable();
  if (!preflight.ok) {
    throw new Error(preflight.error!);
  }

  await setupAgentCrons(workflow);
}

/**
 * Tear down crons for a workflow when a run ends.
 * Only removes if no other active runs exist for this workflow.
 * Fix 1: 5-minute grace period — if a new run starts within 5min, crons survive.
 */
const TEARDOWN_GRACE_MS = 5 * 60 * 1000; // 5 minutes

export async function teardownWorkflowCronsIfIdle(workflowId: string): Promise<void> {
  const active = countActiveRuns(workflowId);
  if (active > 0) return;

  // Grace period: wait 5min, then re-check. If a new run started, keep crons.
  await new Promise(r => setTimeout(r, TEARDOWN_GRACE_MS));

  // Re-check after grace period — new run may have started
  const activeAfterGrace = countActiveRuns(workflowId);
  if (activeAfterGrace > 0) {
    logger.info(`[teardown] Grace period saved crons — new run detected for ${workflowId}`, {});
    return;
  }

  const listResult = await listCronJobs();
  if (!listResult.ok || !listResult.jobs) return;
  const prefix = `setfarm/${workflowId}/`;
  for (const job of listResult.jobs) {
    if (!job.name.startsWith(prefix)) continue;
    await deleteCronJob(job.id);
  }
  logger.info(`[teardown] Crons removed for ${workflowId} after grace period (no active runs)`, {});
}

// ── Cron Count Helpers ──────────────────────────────────────────────

const PARALLEL_AGENTS_SET = new Set(["developer", "reviewer", "verifier"]);

/**
 * Calculate how many crons a workflow SHOULD have based on its agent spec.
 * Uses agent_mapping array length for dynamic parallel count.
 * Used by medic to detect partial cron loss.
 */
export function expectedCronCount(workflow: WorkflowSpec): number {
  const agentMapping: AgentMapping = workflow.agent_mapping ?? {};
  let count = 0;
  for (const agent of workflow.agents) {
    count++; // base cron
    if (PARALLEL_AGENTS_SET.has(agent.id)) {
      const rawMapping = agentMapping[agent.id];
      const agentCount = Array.isArray(rawMapping) ? rawMapping.length : 1;
      count += agentCount - 1; // extra crons beyond the base
    }
  }
  return count;
}

/**
 * Count actual crons for a workflow in the gateway.
 * Returns -1 if gateway API is unreachable.
 */
export async function actualCronCount(workflowId: string): Promise<number> {
  const result = await listCronJobs();
  if (!result.ok || !result.jobs) return -1;
  const prefix = `setfarm/${workflowId}/`;
  return result.jobs.filter(j => j.name.startsWith(prefix)).length;
}

/**
 * Additive cron repair: only add missing crons, remove extras.
 * Does NOT touch existing crons — prevents anchor-reset loop.
 */
export async function repairAgentCrons(workflow: WorkflowSpec): Promise<{ added: number; removed: number }> {
  const result = await listCronJobs();
  if (!result.ok || !result.jobs) throw new Error("Cannot list crons for repair");

  const prefix = `setfarm/${workflow.id}/`;
  const existingCrons = result.jobs.filter(j => j.name.startsWith(prefix));
  const existingNames = new Set(existingCrons.map(j => j.name));

  // Build expected cron names
  const expectedNames = new Set<string>();
  const agentMapping: AgentMapping = workflow.agent_mapping ?? {};

  for (const agent of workflow.agents) {
    expectedNames.add(`setfarm/${workflow.id}/${agent.id}`);

    const PARALLEL_AGENTS = ["developer", "reviewer", "verifier"];
    if (PARALLEL_AGENTS.includes(agent.id)) {
      const rawMapping = agentMapping[agent.id];
      const allAgents: string[] = Array.isArray(rawMapping)
        ? rawMapping
        : rawMapping ? [rawMapping] : [`${workflow.id}_${agent.id}`];
      for (let n = 2; n <= allAgents.length; n++) {
        expectedNames.add(`setfarm/${workflow.id}/${agent.id}-${n}`);
      }
    }
  }

  let added = 0;
  let removed = 0;

  // Remove extras (not in expected set)
  for (const cron of existingCrons) {
    if (!expectedNames.has(cron.name)) {
      await deleteCronJob(cron.id);
      removed++;
    }
  }

  // Add missing (in expected but not existing)
  const everyMs = (workflow as any).cron?.interval_ms ?? DEFAULT_EVERY_MS;
  const agents = workflow.agents;
  for (let i = 0; i < agents.length; i++) {
    const agent = agents[i];
    const anchorMs = i * 15_000;
    const cronName = `setfarm/${workflow.id}/${agent.id}`;
    const rawMappedId = agentMapping[agent.id];
    const mappedAgentId = Array.isArray(rawMappedId) ? rawMappedId[0] : rawMappedId;
    const cronAgentId = mappedAgentId ?? `${workflow.id}_${agent.id}`;
    const prompt = buildPollingPrompt(workflow.id, agent.id);
    const timeoutSeconds = agent.timeoutSeconds ?? DEFAULT_AGENT_TIMEOUT_SECONDS;

    if (!existingNames.has(cronName)) {
      const res = await createAgentCronJob({
        name: cronName,
        schedule: { kind: "every", everyMs, anchorMs },
        sessionTarget: "isolated",
        agentId: cronAgentId,
        payload: { kind: "agentTurn", message: prompt, timeoutSeconds },
        delivery: { mode: "none" },
        enabled: true,
      });
      if (res.ok) added++;
    }

    // Parallel crons
    const PARALLEL_AGENTS = ["developer", "reviewer", "verifier"];
    if (PARALLEL_AGENTS.includes(agent.id)) {
      const rawMapping = agentMapping[agent.id];
      const allAgents: string[] = Array.isArray(rawMapping)
        ? rawMapping
        : rawMapping ? [rawMapping] : [cronAgentId];
      for (let n = 2; n <= allAgents.length; n++) {
        const pName = `setfarm/${workflow.id}/${agent.id}-${n}`;
        if (!existingNames.has(pName)) {
          const agentForCron = allAgents[(n - 1) % allAgents.length];
          const res = await createAgentCronJob({
            name: pName,
            schedule: { kind: "every", everyMs, anchorMs: anchorMs + n * 15_000 },
            sessionTarget: "isolated",
            agentId: agentForCron,
            payload: { kind: "agentTurn", message: prompt, timeoutSeconds },
            enabled: true,
          });
          if (res.ok) added++;
        }
      }
    }
  }

  return { added, removed };
}
