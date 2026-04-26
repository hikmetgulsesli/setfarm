import { pgQuery, pgGet, pgRun, now } from "../db-pg.js";
import { teardownWorkflowCronsIfIdle } from "./agent-cron.js";
import { emitEvent } from "./events.js";
import { recordStepTransition } from "./repo.js";

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

async function notifyRunCancelled(run: RunInfo): Promise<void> {
  try {
    await pgRun("SELECT pg_notify('run_cancelled', $1)", [
      JSON.stringify({ runId: run.id, workflowId: run.workflow_id }),
    ]);
  } catch {
    // best effort; DB state remains authoritative
  }
}

async function cancelActiveRunState(run: RunInfo): Promise<number> {
  const activeStepsForCancel = await pgQuery<{ id: string; status: string }>(
    "SELECT id, status FROM steps WHERE run_id = $1 AND status IN ('waiting', 'pending', 'running')",
    [run.id]
  );

  await pgRun("UPDATE runs SET status = 'cancelled', updated_at = $1 WHERE id = $2", [now(), run.id]);
  const result = await pgRun(
    "UPDATE steps SET status = 'cancelled', output = COALESCE(output, 'Cancelled by user'), current_story_id = NULL, updated_at = $1 WHERE run_id = $2 AND status IN ('waiting', 'pending', 'running')",
    [now(), run.id]
  );
  await pgRun(
    "UPDATE stories SET status = 'skipped', output = COALESCE(output, 'Cancelled by user'), updated_at = $1 WHERE run_id = $2 AND status IN ('pending', 'running')",
    [now(), run.id]
  );
  for (const s of activeStepsForCancel) {
    await recordStepTransition(s.id, run.id, s.status, "cancelled", undefined, "stopWorkflow:cancelled");
  }

  await teardownWorkflowCronsIfIdle(run.workflow_id, { graceMs: 0 });
  await notifyRunCancelled(run);
  return result.changes;
}

export async function stopWorkflow(query: string): Promise<StopWorkflowResult> {
  let run: RunInfo | undefined;
  if (/^\d+$/.test(query)) {
    run = await pgGet<RunInfo>("SELECT * FROM runs WHERE run_number = $1 LIMIT 1", [parseInt(query, 10)]);
  }
  if (!run) {
    run = await pgGet<RunInfo>("SELECT * FROM runs WHERE id = $1", [query]);
  }
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
  if (run.status === "completed") {
    return { status: "already_done", message: `Run ${run.id.slice(0, 8)} is already "${run.status}".` };
  }
  const cancelledSteps = await cancelActiveRunState(run);
  if (run.status === "cancelled" && cancelledSteps === 0) {
    return { status: "already_done", message: `Run ${run.id.slice(0, 8)} is already "${run.status}".` };
  }

  // Clean up MC project + tunnel if deploy didn't complete
  try {
    const planStep = await pgGet<{ output: string }>("SELECT output FROM steps WHERE run_id = $1 AND step_id = 'plan'", [run.id]);
    const repoMatch = planStep?.output?.match(/^REPO:\s*(.+)$/m);
    if (repoMatch) {
      const projectName = repoMatch[1].trim().split("/").filter(Boolean).pop();
      if (projectName) {
        // Remove from MC projects.json
        try {
          const { execFileSync } = await import("child_process");
          execFileSync("curl", ["-sf", "-X", "DELETE", `http://127.0.0.1:3080/api/projects/${projectName}`,
            "-H", "Content-Type: application/json", "-d", JSON.stringify({ confirmName: projectName })],
            { timeout: 10000, stdio: "pipe" });
        } catch { /* MC might not have it */ }
        // Remove tunnel entry
        try {
          const { execFileSync } = await import("child_process");
          const tunnelScript = `${process.env.HOME}/.openclaw/scripts/tunnel-remove.sh`;
          execFileSync("sudo", ["bash", tunnelScript, `${projectName}.setrox.com.tr`],
            { timeout: 15000, stdio: "pipe" });
        } catch { /* tunnel might not exist */ }
      }
    }
  } catch { /* best effort cleanup */ }

  emitEvent({ ts: now(), event: "run.cancelled", runId: run.id, workflowId: run.workflow_id, detail: "Cancelled by user" });
  return { status: "ok", runId: run.id, workflowId: run.workflow_id, cancelledSteps };
}
