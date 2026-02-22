import { createAgentCronJob, deleteAgentCronJobs, deleteCronJob, listCronJobs, checkCronToolAvailable } from "./gateway-api.js";
import type { WorkflowSpec, AgentMapping } from "./types.js";
import { resolveSetfarmCli } from "./paths.js";
import { getDb } from "../db.js";

const DEFAULT_EVERY_MS = 300_000; // 5 minutes
const DEFAULT_AGENT_TIMEOUT_SECONDS = 30 * 60; // 30 minutes

function buildAgentPrompt(workflowId: string, agentId: string): string {
  const fullAgentId = `${workflowId}_${agentId}`;
  const cli = resolveSetfarmCli();

  return `You are an Setfarm workflow agent. Check for pending work and execute it.

⚠️ CRITICAL: You MUST call "step complete" or "step fail" before ending your session. If you don't, the workflow will be stuck forever. This is non-negotiable.

Step 1 — Check for pending work:
\`\`\`
/usr/bin/node ${cli} step claim "${fullAgentId}"
\`\`\`

If output is "NO_WORK", reply HEARTBEAT_OK and stop.

Step 2 — If JSON is returned, it contains: {"stepId": "...", "runId": "...", "input": "..."}
Save the stepId — you'll need it to report completion.
The "input" field contains your FULLY RESOLVED task instructions. Read it carefully and DO the work.

Step 3 — Do the work described in the input. Format your output with KEY: value lines as specified.

Step 4 — MANDATORY: Report completion (do this IMMEDIATELY after finishing the work):
\`\`\`
cat <<'ANTFARM_EOF' > /tmp/setfarm-step-output.txt
<YOUR OUTPUT HERE — use the EXACT format specified in the step input above, including ALL required keys like STORIES_JSON, REPO, BRANCH etc.>
ANTFARM_EOF
cat /tmp/setfarm-step-output.txt | /usr/bin/node ${cli} step complete "<stepId>"
\`\`\`

CRITICAL: The output format in the heredoc MUST match what the step input asks for. Do NOT use a generic STATUS/CHANGES/TESTS format — read the step input and replicate its MANDATORY OUTPUT FORMAT exactly.

If the work FAILED:
\`\`\`
/usr/bin/node ${cli} step fail "<stepId>" "description of what went wrong"
\`\`\`

RULES:
1. NEVER end your session without calling step complete or step fail
2. Write output to a file first, then pipe via stdin (shell escaping breaks direct args)
3. If you're unsure whether to complete or fail, call step fail with an explanation

The workflow cannot advance until you report. Your session ending without reporting = broken pipeline.`;
}

/** @deprecated Kept for backward compatibility — inline execution replaces spawn */
export function buildWorkPrompt(workflowId: string, agentId: string): string {
  const fullAgentId = `${workflowId}_${agentId}`;
  const cli = resolveSetfarmCli();

  return `You are an Setfarm workflow agent. Execute the pending work below.

⚠️ CRITICAL: You MUST call "step complete" or "step fail" before ending your session. If you don't, the workflow will be stuck forever. This is non-negotiable.

The claimed step JSON is provided below. It contains: {"stepId": "...", "runId": "...", "input": "..."}
Save the stepId — you'll need it to report completion.
The "input" field contains your FULLY RESOLVED task instructions. Read it carefully and DO the work.

Do the work described in the input. Format your output with KEY: value lines as specified.

MANDATORY: Report completion (do this IMMEDIATELY after finishing the work):
\`\`\`
cat <<'ANTFARM_EOF' > /tmp/setfarm-step-output.txt
<YOUR OUTPUT HERE — use the EXACT format specified in the step input above, including ALL required keys like STORIES_JSON, REPO, BRANCH etc.>
ANTFARM_EOF
cat /tmp/setfarm-step-output.txt | /usr/bin/node ${cli} step complete "<stepId>"
\`\`\`

CRITICAL: The output format in the heredoc MUST match what the step input asks for. Do NOT use a generic STATUS/CHANGES/TESTS format — read the step input and replicate its MANDATORY OUTPUT FORMAT exactly.

If the work FAILED:
\`\`\`
/usr/bin/node ${cli} step fail "<stepId>" "description of what went wrong"
\`\`\`

RULES:
1. NEVER end your session without calling step complete or step fail
2. Write output to a file first, then pipe via stdin (shell escaping breaks direct args)
3. If you're unsure whether to complete or fail, call step fail with an explanation

The workflow cannot advance until you report. Your session ending without reporting = broken pipeline.`;
}

const DEFAULT_POLLING_TIMEOUT_SECONDS = 120;
const DEFAULT_POLLING_MODEL = "minimax/MiniMax-M2.5";

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

  return `You are a Setfarm workflow agent. Check for pending work and execute it inline.

⚠️ CRITICAL: If you claim work, you MUST call "step complete" or "step fail" before ending your session. If you don't, the workflow will be stuck forever.

Step 1 — Quick check for pending work (lightweight, no side effects):
\`\`\`
/usr/bin/node ${cli} step peek "${fullAgentId}"
\`\`\`
If output is "NO_WORK", reply HEARTBEAT_OK and stop immediately. Do NOT run step claim.

Step 2 — If "HAS_WORK", claim the step:
\`\`\`
/usr/bin/node ${cli} step claim "${fullAgentId}"
\`\`\`
If output is "NO_WORK", reply HEARTBEAT_OK and stop.

Step 3 — If JSON is returned, it contains: {"stepId": "...", "runId": "...", "input": "..."}
Save the stepId — you'll need it to report completion.
The "input" field contains your FULLY RESOLVED task instructions. Read it carefully and DO the work.

Step 4 — Do the work described in the input. Format your output with KEY: value lines as specified in the input.

Step 5 — MANDATORY: Report completion (do this IMMEDIATELY after finishing the work):
\`\`\`
cat <<'ANTFARM_EOF' > /tmp/setfarm-step-output.txt
<YOUR OUTPUT HERE — use the EXACT format specified in the step input above, including ALL required keys like STORIES_JSON, REPO, BRANCH etc.>
ANTFARM_EOF
cat /tmp/setfarm-step-output.txt | /usr/bin/node ${cli} step complete "<stepId>"
\`\`\`

CRITICAL: The output format in the heredoc MUST match what the step input asks for. Do NOT use a generic STATUS/CHANGES/TESTS format — read the step input and replicate its MANDATORY OUTPUT FORMAT exactly.

If the work FAILED:
\`\`\`
/usr/bin/node ${cli} step fail "<stepId>" "description of what went wrong"
\`\`\`

RULES:
1. NEVER end your session without calling step complete or step fail
2. Write output to a file first, then pipe via stdin (shell escaping breaks direct args)
3. If you're unsure whether to complete or fail, call step fail with an explanation
4. Do NOT call sessions_spawn — do all work directly in this session

The workflow cannot advance until you report. Your session ending without reporting = broken pipeline.`;
}

export async function setupAgentCrons(workflow: WorkflowSpec): Promise<void> {
  const agents = workflow.agents;
  // Allow per-workflow cron interval via cron.interval_ms in workflow.yml
  const everyMs = (workflow as any).cron?.interval_ms ?? DEFAULT_EVERY_MS;

  // Agent mapping: maps workflow role IDs to real OpenClaw agent IDs
  // e.g. { developer: "koda", verifier: "sinan", planner: "main" }
  const agentMapping: AgentMapping = workflow.agent_mapping ?? {};

  // Resolve polling model (used as fallback if agent has no work model)
  const workflowPollingModel = workflow.polling?.model ?? DEFAULT_POLLING_MODEL;

  for (let i = 0; i < agents.length; i++) {
    const agent = agents[i];
    const anchorMs = i * 40_000; // stagger by 40s each
    const cronName = `setfarm/${workflow.id}/${agent.id}`;
    // Use mapped OpenClaw agent ID if available, otherwise fall back to workflow agent ID
    const rawMappedId = agentMapping[agent.id];
    const mappedAgentId = Array.isArray(rawMappedId) ? rawMappedId[0] : rawMappedId;
    const cronAgentId = mappedAgentId ?? `${workflow.id}_${agent.id}`;

    // Inline execution: single model does peek + claim + work.
    // Prefer agent's work model; fall back to workflow polling model.
    const model = agent.model ?? agent.pollingModel ?? workflowPollingModel;
    const prompt = buildPollingPrompt(workflow.id, agent.id);
    // Timeout must accommodate full work duration (30min), not just peek (2min).
    // Heartbeats still finish in seconds — timeout is just the max.
    const timeoutSeconds = agent.timeoutSeconds ?? DEFAULT_AGENT_TIMEOUT_SECONDS;

    const result = await createAgentCronJob({
      name: cronName,
      schedule: { kind: "every", everyMs, anchorMs },
      sessionTarget: "isolated",
      agentId: cronAgentId,
      payload: { kind: "agentTurn", message: prompt, model, timeoutSeconds },
      delivery: { mode: "none" },
      enabled: true,
    });

    if (!result.ok) {
      throw new Error(`Failed to create cron job for agent "${agent.id}": ${result.error}`);
    }

    // Create parallel crons for developer and verifier, distributed across agent array
    const PARALLEL_AGENTS = ["developer", "verifier"];
    const PARALLEL_COUNT = 3;
    if (PARALLEL_AGENTS.includes(agent.id)) {
      // Get all mapped agents for this role (supports string or string[])
      const rawMapping = agentMapping[agent.id];
      const allAgents: string[] = Array.isArray(rawMapping)
        ? rawMapping
        : rawMapping ? [rawMapping] : [cronAgentId];

      for (let n = 2; n <= PARALLEL_COUNT; n++) {
        // Round-robin distribute across available agents
        const agentForCron = allAgents[(n - 1) % allAgents.length];
        const pName = `setfarm/${workflow.id}/${agent.id}-${n}`;
        await createAgentCronJob({
          name: pName,
          schedule: { kind: "every", everyMs, anchorMs: anchorMs + n * 40_000 },
          sessionTarget: "isolated",
          agentId: agentForCron,
          payload: { kind: "agentTurn", message: prompt, model, timeoutSeconds },
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
  if (await workflowCronsExist(workflow.id)) return;

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
 */
export async function teardownWorkflowCronsIfIdle(workflowId: string): Promise<void> {
  const active = countActiveRuns(workflowId);
  if (active > 0) return;
  const listResult = await listCronJobs();
  if (!listResult.ok || !listResult.jobs) return;
  const prefix = `setfarm/${workflowId}/`;
  for (const job of listResult.jobs) {
    if (!job.name.startsWith(prefix)) continue;
    await deleteCronJob(job.id);
  }
}
