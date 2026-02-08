import { getDbPath } from "../db.js";
import { createAgentCronJob, deleteAgentCronJobs } from "./gateway-api.js";
import type { WorkflowSpec } from "./types.js";

const EVERY_MS = 900_000; // 15 minutes

function buildAgentPrompt(workflowId: string, agentId: string): string {
  const fullAgentId = `${workflowId}/${agentId}`;
  const dbPath = getDbPath();

  return `You are an Antfarm workflow agent. Check for pending work and execute it.

Step 1 — Check for pending steps:
\`\`\`
sqlite3 ${dbPath} "SELECT id, run_id, input_template FROM steps WHERE agent_id = '${fullAgentId}' AND status = 'pending' LIMIT 1"
\`\`\`

If no output, reply HEARTBEAT_OK and stop.

Step 2 — If a row is returned (pipe-separated: step_id|run_id|input_template), claim it:
\`\`\`
sqlite3 ${dbPath} "UPDATE steps SET status = 'running', updated_at = datetime('now') WHERE id = '<step_id>' AND status = 'pending'"
\`\`\`

Step 3 — Read the run context:
\`\`\`
sqlite3 ${dbPath} "SELECT context FROM runs WHERE id = '<run_id>'"
\`\`\`
Parse the JSON context. Replace every {{key}} in the input_template with the corresponding value from context.

Step 4 — EXECUTE THE WORK. The interpolated input_template contains your actual task instructions. Read them carefully and DO the work they describe. This is the core of your job — perform whatever task is specified.

Step 5 — After completing the work, update the database. Your output should contain lines matching KEY: value format for context passing.

Run these sqlite3 commands:
\`\`\`
sqlite3 ${dbPath} "UPDATE steps SET status = 'done', output = '<your output (escape single quotes)>', updated_at = datetime('now') WHERE id = '<step_id>'"
\`\`\`

Then read current context, merge your KEY: value output lines (lowercased keys) into it, and update:
\`\`\`
sqlite3 ${dbPath} "UPDATE runs SET context = '<updated context json>', updated_at = datetime('now') WHERE id = '<run_id>'"
\`\`\`

Step 6 — Advance the pipeline. Check for a next step:
\`\`\`
sqlite3 ${dbPath} "SELECT id FROM steps WHERE run_id = '<run_id>' AND status = 'waiting' ORDER BY step_index ASC LIMIT 1"
\`\`\`
If a row exists, mark it pending:
\`\`\`
sqlite3 ${dbPath} "UPDATE steps SET status = 'pending', updated_at = datetime('now') WHERE id = '<next_step_id>'"
\`\`\`
If no next step, mark the run completed:
\`\`\`
sqlite3 ${dbPath} "UPDATE runs SET status = 'completed', updated_at = datetime('now') WHERE id = '<run_id>'"
\`\`\`

RETRY: If the work fails, increment retry_count. If retry_count >= max_retries, set step status='failed' and run status='failed'. Otherwise set step status='pending' so next poll retries.`;
}

export async function setupAgentCrons(workflow: WorkflowSpec): Promise<void> {
  const agents = workflow.agents;
  for (let i = 0; i < agents.length; i++) {
    const agent = agents[i];
    const anchorMs = i * 60_000; // stagger by 1 minute each
    const cronName = `antfarm/${workflow.id}/${agent.id}`;
    const agentId = `${workflow.id}/${agent.id}`;
    const prompt = buildAgentPrompt(workflow.id, agent.id);

    await createAgentCronJob({
      name: cronName,
      schedule: { kind: "every", everyMs: EVERY_MS, anchorMs },
      sessionTarget: "isolated",
      agentId,
      payload: { kind: "agentTurn", message: prompt },
      delivery: { mode: "none" },
      enabled: true,
    });
  }
}

export async function removeAgentCrons(workflowId: string): Promise<void> {
  await deleteAgentCronJobs(`antfarm/${workflowId}/`);
}
