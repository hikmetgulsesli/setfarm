import { getDb } from "../db.js";

export type RunInfo = {
  id: string;
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

export function getWorkflowStatus(taskTitle: string): WorkflowStatusResult {
  const db = getDb();
  const run = db.prepare("SELECT * FROM runs WHERE LOWER(task) = LOWER(?) ORDER BY created_at DESC LIMIT 1").get(taskTitle) as RunInfo | undefined;

  if (!run) {
    const allRuns = db.prepare("SELECT task FROM runs ORDER BY created_at DESC LIMIT 20").all() as Array<{ task: string }>;
    const available = allRuns.map((r) => r.task);
    return {
      status: "not_found",
      message: available.length
        ? `No run found for "${taskTitle}". Available: ${available.join(", ")}`
        : "No workflow runs found.",
    };
  }

  const steps = db.prepare("SELECT * FROM steps WHERE run_id = ? ORDER BY step_index ASC").all(run.id) as StepInfo[];
  return { status: "ok", run, steps };
}

export function listRuns(): RunInfo[] {
  const db = getDb();
  return db.prepare("SELECT * FROM runs ORDER BY created_at DESC").all() as RunInfo[];
}
