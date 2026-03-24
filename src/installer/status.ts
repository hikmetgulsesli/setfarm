import { getDb } from "../db.js";
import { pgQuery, pgGet, pgRun } from "../db-pg.js";
import { teardownWorkflowCronsIfIdle } from "./agent-cron.js";
import { emitEvent } from "./events.js";

const USE_PG = process.env.DB_BACKEND === 'postgres';

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
  if (USE_PG) {
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
  } else {
    const db = getDb();
    let run: RunInfo | undefined;
    if (/^\d+$/.test(query)) {
      run = db.prepare("SELECT * FROM runs WHERE run_number = ? LIMIT 1").get(parseInt(query, 10)) as RunInfo | undefined;
    }
    if (!run) {
      run = db.prepare("SELECT * FROM runs WHERE LOWER(task) = LOWER(?) ORDER BY created_at DESC LIMIT 1").get(query) as RunInfo | undefined;
    }
    if (!run) {
      run = db.prepare("SELECT * FROM runs WHERE LOWER(task) LIKE '%' || LOWER(?) || '%' ORDER BY created_at DESC LIMIT 1").get(query) as RunInfo | undefined;
    }
    if (!run) {
      run = db.prepare("SELECT * FROM runs WHERE id LIKE ? || '%' ORDER BY created_at DESC LIMIT 1").get(query) as RunInfo | undefined;
    }
    if (!run) {
      const allRuns = db.prepare("SELECT id, run_number, task, status, created_at FROM runs ORDER BY created_at DESC LIMIT 20").all() as Array<{ id: string; run_number: number | null; task: string; status: string; created_at: string }>;
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
    const steps = db.prepare("SELECT * FROM steps WHERE run_id = ? ORDER BY step_index ASC").all(run.id) as StepInfo[];
    return { status: "ok", run, steps };
  }
}

export async function listRuns(): Promise<RunInfo[]> {
  if (USE_PG) {
    return await pgQuery<RunInfo>("SELECT * FROM runs ORDER BY created_at DESC");
  } else {
    const db = getDb();
    return db.prepare("SELECT * FROM runs ORDER BY created_at DESC").all() as RunInfo[];
  }
}

export type StopWorkflowResult =
  | { status: "ok"; runId: string; workflowId: string; cancelledSteps: number }
  | { status: "not_found"; message: string }
  | { status: "already_done"; message: string };

export async function stopWorkflow(query: string): Promise<StopWorkflowResult> {
  if (USE_PG) {
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
    await pgRun("UPDATE runs SET status = 'cancelled', updated_at = $1 WHERE id = $2", [new Date().toISOString(), run.id]);
    const result = await pgRun(
      "UPDATE steps SET status = 'failed', output = 'Cancelled by user', updated_at = $1 WHERE run_id = $2 AND status IN ('waiting', 'pending', 'running')",
      [new Date().toISOString(), run.id]
    );
    const cancelledSteps = result.changes;
    await teardownWorkflowCronsIfIdle(run.workflow_id);
    emitEvent({ ts: new Date().toISOString(), event: "run.failed", runId: run.id, workflowId: run.workflow_id, detail: "Cancelled by user" });
    return { status: "ok", runId: run.id, workflowId: run.workflow_id, cancelledSteps };
  } else {
    const db = getDb();
    let run = db.prepare("SELECT * FROM runs WHERE id = ?").get(query) as RunInfo | undefined;
    if (!run) {
      run = db.prepare("SELECT * FROM runs WHERE id LIKE ? || '%' ORDER BY created_at DESC LIMIT 1").get(query) as RunInfo | undefined;
    }
    if (!run) {
      const allRuns = db.prepare("SELECT id, task, status, created_at FROM runs ORDER BY created_at DESC LIMIT 20").all() as Array<{ id: string; task: string; status: string; created_at: string }>;
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
    db.prepare("UPDATE runs SET status = 'cancelled', updated_at = ? WHERE id = ?").run(new Date().toISOString(), run.id);
    const result = db.prepare(
      "UPDATE steps SET status = 'failed', output = 'Cancelled by user', updated_at = ? WHERE run_id = ? AND status IN ('waiting', 'pending', 'running')"
    ).run(new Date().toISOString(), run.id);
    const cancelledSteps = Number(result.changes);
    await teardownWorkflowCronsIfIdle(run.workflow_id);
    emitEvent({ ts: new Date().toISOString(), event: "run.failed", runId: run.id, workflowId: run.workflow_id, detail: "Cancelled by user" });
    return { status: "ok", runId: run.id, workflowId: run.workflow_id, cancelledSteps };
  }
}
