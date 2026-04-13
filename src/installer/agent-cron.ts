import { createAgentCronJob, deleteAgentCronJobs, deleteCronJob, listCronJobs, checkCronToolAvailable } from "./gateway-api.js";
import type { WorkflowSpec, AgentMapping } from "./types.js";
import { resolveSetfarmCli } from "./paths.js";
import { pgGet, pgQuery } from "../db-pg.js";
import { logger } from "../lib/logger.js";

const DEFAULT_EVERY_MS = 30_000; // 2 min — safe with demand-based crons // 4 minutes
const DEFAULT_AGENT_TIMEOUT_SECONDS = 30 * 60; // 30 minutes

const DEFAULT_POLLING_TIMEOUT_SECONDS = 120;

/** Extract role from cron name: "setfarm/feature-dev/security-gate" -> "security-gate", "setfarm/feature-dev/reviewer-2" -> "reviewer" */
function extractRoleFromCronName(name: string, prefix: string): string {
  const suffix = name.replace(prefix, '');
  // Handle indexed names: "reviewer-2" -> "reviewer"
  const match = suffix.match(/^(.+)-(\d+)$/);
  return match ? match[1] : suffix;
}
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
export function buildPollingPrompt(workflowId: string, agentId: string, gatewayAgentId?: string): string {
  const fullAgentId = `${workflowId}_${agentId}`;
  // Use gateway agent ID for output file to prevent cross-agent contamination
  // e.g. koda, flux, cipher each write to their own file
  const outputFileId = gatewayAgentId || fullAgentId;
  const cli = resolveSetfarmCli();
  // Compact prompt — minimizes tokens on NO_WORK (majority of calls)
  // cuddly-sleeping-quail: force safe cwd before anything else. Cron-spawned
  // agents inherit the gateway default cwd which often lands in
  // ~/.openclaw/setfarm-repo — step claim / file writes from there corrupt
  // the platform source tree (run #385 postmortem: prism ran `cd setfarm-repo
  // && step claim` under cron, killed at 22:49). agent-scratch is not a git
  // repo so stray `git` commands fail loudly instead of silently corrupting.
  return `Workflow agent. Peek→Claim→Work→Complete.

0. SAFE SHELL START (fallback cwd — claim will move you elsewhere):
   mkdir -p ~/.openclaw/workspace/agent-scratch && cd ~/.openclaw/workspace/agent-scratch
   NEVER run commands from ~/.openclaw/setfarm-repo (platform source tree).

1. /usr/bin/node ${cli} step peek "${fullAgentId}"
   NO_WORK → reply "HEARTBEAT_OK", STOP.

2. CLAIM the step and save the JSON to a file in one shot:
   /usr/bin/node ${cli} step claim "${fullAgentId}"${gatewayAgentId ? ` --caller ${gatewayAgentId}` : ""} > /tmp/claim-${outputFileId}.json
   If the file content is "NO_WORK" → reply "HEARTBEAT_OK", STOP.

3. EXTRACT the step id and working directory via jq (DO NOT parse by hand):
   STEP_ID=$(jq -r '.stepId // empty' /tmp/claim-${outputFileId}.json)
   WORKDIR=$(jq -r '.input.story_workdir // .input.repo // empty' /tmp/claim-${outputFileId}.json)
   [ -z "$STEP_ID" ] && { echo "HEARTBEAT_OK"; exit 0; }
   [ -z "$WORKDIR" ] && WORKDIR="$HOME/.openclaw/workspace/agent-scratch"
   cd "$WORKDIR" && pwd
   case "$(pwd)" in
     $HOME/.openclaw/setfarm-repo*) echo "STATUS: fatal"; echo "FATAL: platform_path_touched"; exit 1;;
   esac
   Save STEP_ID — you need it for step complete/fail. The claim JSON is in
   /tmp/claim-${outputFileId}.json if you need other fields (input.prd,
   input.task, input.scope_files, etc.). Read it with:
     cat /tmp/claim-${outputFileId}.json
     jq -r '.input.task' /tmp/claim-${outputFileId}.json
     jq -r '.input.prd' /tmp/claim-${outputFileId}.json

4. Do the work described in the claim input. No narration. Stay in WORKDIR.
   Never run npx/npm init — setup-repo and setup-build already scaffolded
   the project. You only modify files inside WORKDIR.

5. Write output in KEY: VALUE format (NOT JSON) to /tmp, then complete:
cat <<'SETFARM_EOF' > /tmp/setfarm-output-${outputFileId}.txt
STATUS: done
<other keys as specified in step input>
SETFARM_EOF
/usr/bin/node ${cli} step complete "<the stepId from claim JSON>" --file /tmp/setfarm-output-${outputFileId}.txt
On failure: /usr/bin/node ${cli} step fail "<the stepId from claim JSON>" "reason"

6. STOP. Reply "HEARTBEAT_OK". No more tool calls.

Rules: NO_WORK/complete/fail → SESSION OVER. Never skip peek. Never run workflow stop/uninstall/sessions_spawn. Write output to /tmp/setfarm-output-${outputFileId}.txt, use --file flag. Output must be KEY: VALUE lines, NOT JSON.`;
}

export async function setupAgentCrons(workflow: WorkflowSpec, onlyAgentIds?: Set<string>): Promise<void> {
  // Always remove existing crons first to prevent duplicates
  // Gateway API creates new crons even if same name exists
  // DISABLED: await removeAgentCrons(workflow.id); // Removal destabilizes gateway scheduler
  // Wait for WS to settle after bulk cron removal (OpenClaw 2026.3.13 handshake issue)
  // DISABLED: await new Promise(r => setTimeout(r, 3000)); // No removal = no settle needed

  // DEMAND-BASED: Only create crons for agents with pending/running steps.
  // syncActiveCrons() will add more as pipeline advances.
  const activeRun = await pgGet<{ id: string }>(
    "SELECT id FROM runs WHERE workflow_id = $1 AND status = 'running' ORDER BY created_at DESC LIMIT 1",
    [workflow.id]
  );
  if (activeRun) {
    await syncActiveCrons(activeRun.id, workflow.id);
    return;
  }

  // Fallback: no active run yet (first setup) — create only first step's agent cron
  const agents = workflow.agents;
  // Allow per-workflow cron interval via cron.interval_ms in workflow.yml
  const everyMs = (workflow as any).cron?.interval_ms ?? DEFAULT_EVERY_MS;

  // Agent mapping: maps workflow role IDs to real OpenClaw agent IDs
  // e.g. { developer: "koda", verifier: "sinan", planner: "main" }
  const agentMapping: AgentMapping = workflow.agent_mapping ?? {};


  for (let i = 0; i < agents.length; i++) {
    const agent = agents[i];
    // Skip agents that already have crons (only create missing ones)
    if (onlyAgentIds && !onlyAgentIds.has(agent.id)) continue;
    const anchorMs = i * 60_000; // stagger by 60s to prevent gateway OOM // stagger by 15s each
    const cronName = `setfarm/${workflow.id}/${agent.id}`;
    // Use mapped OpenClaw agent ID if available, otherwise fall back to workflow agent ID
    const rawMappedId = agentMapping[agent.id];
    const mappedAgentId = Array.isArray(rawMappedId) ? rawMappedId[0] : rawMappedId;
    const cronAgentId = mappedAgentId ?? `${workflow.id}_${agent.id}`;

    // Model is NOT passed to the cron payload — the gateway resolves it
    // from the agent's config in openclaw.json (which includes fallbacks).
    // This ensures failover works when the primary model is unavailable.
    const prompt = buildPollingPrompt(workflow.id, agent.id, cronAgentId);
    // Timeout must accommodate full work duration (30min), not just peek (2min).
    // Heartbeats still finish in seconds — timeout is just the max.
    const timeoutSeconds = agent.timeoutSeconds ?? DEFAULT_AGENT_TIMEOUT_SECONDS;

    const result = await createAgentCronJob({
      name: cronName,
      schedule: { kind: "every", everyMs, anchorMs },
      sessionTarget: "isolated",
      agentId: cronAgentId,
      payload: { kind: "agentTurn", message: prompt, timeoutSeconds },
      delivery: { mode: "none", channel: "telegram" },
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
        delivery: { mode: "none", channel: "telegram" },
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
        const pPrompt = buildPollingPrompt(workflow.id, agent.id, agentForCron);
        await createAgentCronJob({
          name: pName,
          schedule: { kind: "every", everyMs, anchorMs: anchorMs + n * 15_000 },
          sessionTarget: "isolated",
          agentId: agentForCron,
          payload: { kind: "agentTurn", message: pPrompt, timeoutSeconds },
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
async function countActiveRuns(workflowId: string): Promise<number> {
  const row = await pgGet<{ cnt: number }>(
    "SELECT COUNT(*) as cnt FROM runs WHERE workflow_id = $1 AND status = 'running'", [workflowId]
  );
  return Number(row?.cnt ?? 0);
}

/**
 * Check if crons already exist for a workflow.
 */
async function getExistingCronAgentIds(workflowId: string): Promise<Set<string>> {
  const result = await listCronJobs();
  if (!result.ok || !result.jobs) return new Set();
  const prefix = `setfarm/${workflowId}/`;
  const ids = new Set<string>();
  for (const job of result.jobs) {
    if (job.name.startsWith(prefix)) {
      const agentPart = job.name.slice(prefix.length).replace(/-\d+$/, "");
      ids.add(agentPart);
    }
  }
  return ids;
}

/**
 * Start crons for a workflow when a run begins.
 * No-ops if crons already exist (another run of the same workflow is active).
 */
export async function ensureWorkflowCrons(workflow: WorkflowSpec): Promise<void> {
  const existingAgentIds = await getExistingCronAgentIds(workflow.id);
  const expectedAgentIds = workflow.agents.map((a) => a.id);
  const missingAgentIds = expectedAgentIds.filter((id) => !existingAgentIds.has(id));

  if (missingAgentIds.length === 0) {
    try {
      const activeRun = await pgGet<{ id: string; workflow_id: string }>(
        "SELECT id, workflow_id FROM runs WHERE workflow_id = $1 AND status = 'running' ORDER BY created_at DESC LIMIT 1",
        [workflow.id]
      );
      if (activeRun) {
        await syncActiveCrons(activeRun.id, activeRun.workflow_id);
      }
    } catch {}
    return;
  }

  logger.info(`[ensureWorkflowCrons] ${missingAgentIds.length} missing crons for ${workflow.id}: ${missingAgentIds.join(", ")}`, {});

  const preflight = await checkCronToolAvailable();
  if (!preflight.ok) {
    throw new Error(preflight.error!);
  }

  await setupAgentCrons(workflow, new Set(missingAgentIds));
}

/**
 * Tear down crons for a workflow when a run ends.
 * Only removes if no other active runs exist for this workflow.
 * Fix 1: 5-minute grace period — if a new run starts within 5min, crons survive.
 */
const TEARDOWN_GRACE_MS = 5 * 60 * 1000; // 5 minutes

export async function teardownWorkflowCronsIfIdle(workflowId: string): Promise<void> {
  const active = await countActiveRuns(workflowId);
  if (active > 0) return;

  // Grace period: wait 5min, then re-check. If a new run started, keep crons.
  await new Promise(r => setTimeout(r, TEARDOWN_GRACE_MS));

  // Re-check after grace period — new run may have started
  const activeAfterGrace = await countActiveRuns(workflowId);
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
    const anchorMs = i * 60_000; // stagger by 60s to prevent gateway OOM
    const cronName = `setfarm/${workflow.id}/${agent.id}`;
    const rawMappedId = agentMapping[agent.id];
    const mappedAgentId = Array.isArray(rawMappedId) ? rawMappedId[0] : rawMappedId;
    const cronAgentId = mappedAgentId ?? `${workflow.id}_${agent.id}`;
    const prompt = buildPollingPrompt(workflow.id, agent.id, cronAgentId);
    const timeoutSeconds = agent.timeoutSeconds ?? DEFAULT_AGENT_TIMEOUT_SECONDS;

    if (!existingNames.has(cronName)) {
      const res = await createAgentCronJob({
        name: cronName,
        schedule: { kind: "every", everyMs, anchorMs },
        sessionTarget: "isolated",
        agentId: cronAgentId,
        payload: { kind: "agentTurn", message: prompt, timeoutSeconds },
        delivery: { mode: "none", channel: "telegram" },
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
          const pPrompt = buildPollingPrompt(workflow.id, agent.id, agentForCron);
          const res = await createAgentCronJob({
            name: pName,
            schedule: { kind: "every", everyMs, anchorMs: anchorMs + n * 15_000 },
            sessionTarget: "isolated",
            agentId: agentForCron,
            payload: { kind: "agentTurn", message: pPrompt, timeoutSeconds },
            enabled: true,
          });
          if (res.ok) added++;
        }
      }
    }
  }

  return { added, removed };
}


// ── Demand-based cron sync ──────────────────────────────────────────

/**
 * Sync gateway crons to match ONLY the agents that have pending/running steps.
 * Called by advancePipeline after each step transition.
 *
 * Instead of 19 crons firing every 4 minutes (17-18 doing NO_WORK),
 * only 1-6 crons exist at any time — matching the active pipeline phase.
 */
export async function syncActiveCrons(runId: string, workflowId: string): Promise<void> {
  try {
    // 1. Find steps that NEED crons across ALL active runs of this workflow
    //    (not just the given run — parallel runs share the same cron pool)
    const activeSteps = await pgQuery<{ agent_id: string; step_id: string; status: string; type: string; loop_config: string | null }>(
      `SELECT DISTINCT s.agent_id, s.step_id, s.status, s.type, s.loop_config
       FROM steps s JOIN runs r ON r.id = s.run_id
       WHERE r.workflow_id = $1 AND r.status = 'running'
         AND s.status IN ('pending', 'running')`,
      [workflowId]
    );

    if (activeSteps.length === 0) return;

    // 2. Load workflow spec to resolve agent_mapping (role -> gateway agent IDs)
    const { resolveWorkflowDir } = await import("./paths.js");
    const { loadWorkflowSpec } = await import("./workflow-spec.js");
    const workflowDir = resolveWorkflowDir(workflowId);
    const workflow = await loadWorkflowSpec(workflowDir);
    const agentMapping: Record<string, string | string[]> = workflow.agent_mapping ?? {};

    // 3. Build set of GATEWAY agent IDs that need crons
    const neededGatewayAgents = new Set<string>();
    const neededRoles = new Set<string>();

    for (const step of activeSteps) {
      // Extract role from agent_id: "feature-dev_developer" -> "developer"
      const role = step.agent_id.replace(workflowId + '_', '');
      neededRoles.add(role);

      // Resolve via agent_mapping to actual gateway agent IDs
      const mapped = agentMapping[role];
      if (Array.isArray(mapped)) {
        for (const a of mapped) neededGatewayAgents.add(a);
      } else if (mapped) {
        neededGatewayAgents.add(mapped);
      } else {
        neededGatewayAgents.add(role); // fallback: use role name as agent ID
      }

      // For loop steps with verify_each, also keep the verify agent active
      if (step.type === 'loop' && step.loop_config) {
        try {
          const lc = JSON.parse(step.loop_config);
          if (lc.verifyEach && lc.verifyStep) {
            const verifyRole = lc.verifyStep.replace(workflowId + '_', '');
            neededRoles.add(verifyRole);
            const verifyMapped = agentMapping[verifyRole];
            if (Array.isArray(verifyMapped)) {
              for (const a of verifyMapped) neededGatewayAgents.add(a);
            } else if (verifyMapped) {
              neededGatewayAgents.add(verifyMapped);
            }
          }
        } catch {}
      }
    }

    // 4. Get current gateway crons for this workflow
    const cronResult = await listCronJobs();
    if (!cronResult.ok || !cronResult.jobs) return;

    const prefix = `setfarm/${workflowId}/`;
    const existingCrons = cronResult.jobs.filter((j: any) => j.name.startsWith(prefix));

    // 5. Remove crons for roles that are no longer needed (step done/waiting)
    //    Only remove setfarm workflow crons, not other crons
    let removed = 0;
    for (const cron of existingCrons) {
      const cronRole = extractRoleFromCronName(cron.name, prefix);
      if (!neededRoles.has(cronRole)) {
        try { await deleteCronJob(cron.id); removed++; } catch (e) {
          logger.warn("[syncActiveCrons] Failed to remove idle cron: " + String(e), { runId });
        }
      }
    }

    // 6. Check if needed roles are missing crons — recreate from workflow spec
    const existingRoles = new Set(existingCrons.map((c: any) => extractRoleFromCronName(c.name, prefix)));
    let added = 0;
    for (const role of neededRoles) {
      if (existingRoles.has(role)) continue; // Role already has cron(s)

      const mapped = agentMapping[role];
      const agents: string[] = Array.isArray(mapped) ? mapped : mapped ? [mapped] : [role];

      for (let i = 0; i < agents.length; i++) {

        const cronName = i === 0
          ? `setfarm/${workflowId}/${role}`
          : `setfarm/${workflowId}/${role}-${i + 1}`;
        const prompt = buildPollingPrompt(workflowId, role, agents[i]);

        await createAgentCronJob({
          name: cronName,
          schedule: { kind: "every", everyMs: (workflow as any).cron?.interval_ms ?? DEFAULT_EVERY_MS, anchorMs: i * 60_000 },
          sessionTarget: "isolated",
          agentId: agents[i],
          payload: { kind: "agentTurn", message: prompt, timeoutSeconds: DEFAULT_AGENT_TIMEOUT_SECONDS },
          delivery: { mode: "none", channel: "telegram" },
          enabled: true,
        });
        added++;
      }
    }

    if (removed > 0 || added > 0) {
      logger.info(`[syncActiveCrons] Removed ${removed} idle, added ${added} needed — ${neededGatewayAgents.size} active agents for roles [${[...neededRoles].join(',')}]`, { runId });
    }
  } catch (err) {
    logger.warn(`[syncActiveCrons] Failed: ${String(err)}`, { runId });
  }
}


/**
 * Nuclear recovery: remove + create all crons for active workflows.
 * Called on gateway startup and by medic when crons are stale.
 */

/**
 * Nuclear recovery: remove + create all crons for active workflows.
 */
export async function recoverActiveWorkflowCrons(): Promise<void> {
  try {
    const activeRuns = await pgQuery<{ id: string; workflow_id: string }>(
      "SELECT id, workflow_id FROM runs WHERE status = 'running' ORDER BY created_at DESC", []
    );
    if (activeRuns.length === 0) { logger.info("[startup-recovery] No active runs"); return; }
    const workflowIds = [...new Set(activeRuns.map(r => r.workflow_id))];
    logger.info(`[startup-recovery] ${activeRuns.length} active run(s), ${workflowIds.length} workflow(s)`, {});
    const { resolveWorkflowDir } = await import("./paths.js");
    for (const wfId of workflowIds) {
      try {
        await removeAgentCrons(wfId);
        await new Promise(r => setTimeout(r, 2000));
        const { loadWorkflowSpec: loadWf } = await import("./workflow-spec.js");
        const wf = await loadWf(resolveWorkflowDir(wfId));
        await setupAgentCrons(wf);
        logger.info(`[startup-recovery] Nuclear recreate done for ${wfId}`, {});
      } catch (err) { logger.error(`[startup-recovery] Failed for ${wfId}: ${String(err)}`, {}); }
    }
  } catch (err) { logger.error(`[startup-recovery] Fatal: ${String(err)}`, {}); }
}
