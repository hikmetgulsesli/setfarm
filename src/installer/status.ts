import { getSql, pgQuery, pgGet, pgRun, now } from "../db-pg.js";
import { emitEvent } from "./events.js";
import type { SetfarmProtocolMode } from "../product-compiler/protocol.js";
import {
  executeRunOperationalAction,
  resolveRunOperationalActionTarget,
} from "../execution/run-operational-action.js";

export type RunInfo = {
  id: string;
  run_number: number | null;
  workflow_id: string;
  task: string;
  status: string;
  context: string;
  protocol: SetfarmProtocolMode;
  protocol_version: number;
  compiler_release_sha: string | null;
  packet_hash: string | null;
  activation_preflight_hash: string | null;
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
  {
    status: "ok";
    runId: string;
    workflowId: string;
    cancelledSteps: 0;
    terminationRequestId: string;
    requestState: "requested";
    expectedSnapshotHash: string;
    actionStateHash: string;
  };

async function notifyRunTerminationRequested(
  run: Readonly<{ id: string; workflow_id: string }>,
  terminationRequestId: string,
): Promise<void> {
  try {
    await pgRun("SELECT pg_notify('run_termination_requested', $1)", [
      JSON.stringify({
        runId: run.id,
        workflowId: run.workflow_id,
        terminationRequestId,
      }),
    ]);
  } catch {
    // Wake-up only. The durable request is recovered by startup/polling.
  }
}

export async function stopWorkflow(
  query: string,
  expectedSnapshotHash: string,
): Promise<StopWorkflowResult> {
  const sql = getSql();
  const runId = await resolveRunOperationalActionTarget(sql, query);
  const result = await executeRunOperationalAction(sql, {
    action: "stop",
    runId,
    expectedSnapshotHash,
  });
  if (result.action !== "stop") throw new Error("RUN_OPERATIONAL_ACTION_RESULT_KIND_MISMATCH");
  const run = { id: result.runId, workflow_id: result.workflowId };
  await notifyRunTerminationRequested(run, result.terminationRequest.requestId);
  try {
    emitEvent({
      ts: now(),
      event: "run.cancel_requested",
      runId: run.id,
      workflowId: run.workflow_id,
      detail: `Cancellation request ${result.terminationRequest.requestId} is awaiting proven runtime drain`,
    });
  } catch {
    // Projection-only JSONL/observation failure must not report the committed
    // canonical termination request as failed.
  }
  return {
    status: "ok",
    runId: run.id,
    workflowId: run.workflow_id,
    cancelledSteps: 0,
    terminationRequestId: result.terminationRequest.requestId,
    requestState: "requested",
    expectedSnapshotHash: result.expectedSnapshotHash,
    actionStateHash: result.actionStateHash,
  };
}
