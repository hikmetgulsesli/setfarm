import { pgQuery, pgGet, pgRun, now } from "../db-pg.js";
import { teardownWorkflowCronsIfIdle } from "./agent-cron.js";
import { emitEvent } from "./events.js";

export type RunInfo = {
  id: string;
  run_number: number | null;
  workflow_id: string;
  task: string;
  status: string;
  context: string;
  created_at: string;
  updated_at: string;
};

export type StepInfo = {
  id: string;
  run_id: string;
  step_id: string;
  agent_id: string;
  step_index: number;
  input_template: string;
  expects: string;
  status: string;
  output: string | null;
  retry_count: number;
  max_retries: number;
  created_at: string;
  updated_at: string;
};

export type WorkflowStatusResult =
  | { status: "ok"; run: RunInfo; steps: StepInfo[] }
  | { status: "not_found"; message: string };

export async function getWorkflowStatus(query: string): Promise<WorkflowStatusResult> {
  let run: RunInfo | undefined;
  if (/^\d+$/.test(query)) {
    run = await pgGet<RunInfo>("SELECT * FROM runs WHERE run_number = $1 LIMIT 1", [parseInt(query, 10)]);
  }
  if (!run) {
    run = await pgGet<RunInfo>("SELECT * FROM runs WHERE LOWER(task) = LOWER($1) ORDER BY created_at DESC LIMIT 1", [query]);
  }
  if (!run) {
    run = await pgGet<RunInfo>("SELECT * FROM runs WHERE LOWER(task) LIKE '%' || LOWER($1) || '%' ORDER BY created_at DESC LIMIT 1", [query]);
  }
  if (!run) {
    run = await pgGet<RunInfo>("SELECT * FROM runs WHERE id LIKE $1 || '%' ORDER BY created_at DESC LIMIT 1", [query]);
  }
  if (!run) {
    const allRuns = await pgQuery<{ id: string; run_number: number | null; task: string; status: string; created_at: string }>(
      "SELECT id, run_number, task, status, created_at FROM runs ORDER BY created_at DESC LIMIT 20"
    );
    const available = allRuns.map((r) => {
      const num = r.run_number != null ? `#${r.run_number}` : r.id.slice(0, 8);
      return `  [${r.status}] ${num.padEnd(6)} ${r.task.slice(0, 60)}`;
    });
    return {
      status: "not_found",
      message: available.length
        ? `No run matching "${query}". Recent runs:\n${available.join("\n")}`
        : "No workflow runs found.",
    };
  }
  const steps = await pgQuery<StepInfo>("SELECT * FROM steps WHERE run_id = $1 ORDER BY step_index ASC", [run.id]);
  return { status: "ok", run, steps };
}

export async function listRuns(): Promise<RunInfo[]> {
  return await pgQuery<RunInfo>("SELECT * FROM runs ORDER BY created_at DESC");
}

export type StopWorkflowResult =
  | { status: "ok"; runId: string; workflowId: string; cancelledSteps: number }
  | { status: "not_found"; message: string }
  | { status: "already_done"; message: string };

export async function stopWorkflow(query: string): Promise<StopWorkflowResult> {
  let run = await pgGet<RunInfo>("SELECT * FROM runs WHERE id = $1", [query]);
  if (!run) {
    run = await pgGet<RunInfo>("SELECT * FROM runs WHERE id LIKE $1 || '%' ORDER BY created_at DESC LIMIT 1", [query]);
  }
  if (!run) {
    const allRuns = await pgQuery<{ id: string; task: string; status: string; created_at: string }>(
      "SELECT id, task, status, created_at FROM runs ORDER BY created_at DESC LIMIT 20"
    );
    const available = allRuns.map((r) => `  [${r.status}] ${r.id.slice(0, 8)} ${r.task.slice(0, 60)}`);
    return {
      status: "not_found",
      message: available.length
        ? `No run matching "${query}". Recent runs:\n${available.join("\n")}`
        : "No workflow runs found.",
    };
  }
  if (run.status === "completed" || run.status === "cancelled") {
    return { status: "already_done", message: `Run ${run.id.slice(0, 8)} is already "${run.status}".` };
  }
  await pgRun("UPDATE runs SET status = 'cancelled', updated_at = $1 WHERE id = $2", [now(), run.id]);
  const result = await pgRun(
    "UPDATE steps SET status = 'failed', output = 'Cancelled by user', updated_at = $1 WHERE run_id = $2 AND status IN ('waiting', 'pending', 'running')",
    [now(), run.id]
  );
  const cancelledSteps = result.changes;
  await teardownWorkflowCronsIfIdle(run.workflow_id);
  emitEvent({ ts: now(), event: "run.failed", runId: run.id, workflowId: run.workflow_id, detail: "Cancelled by user" });
  return { status: "ok", runId: run.id, workflowId: run.workflow_id, cancelledSteps };
}
