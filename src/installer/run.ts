import os from "node:os";
import crypto from "node:crypto";
import { loadWorkflowSpec } from "./workflow-spec.js";
import { resolveWorkflowDir } from "./paths.js";
import { getDb, nextRunNumber } from "../db.js";
import { pgRun, pgGet, pgExec, pgBegin, pgNextRunNumber } from "../db-pg.js";
import { logger } from "../lib/logger.js";
import { ensureWorkflowCrons } from "./agent-cron.js";
import { cleanAgentWorkspace } from "./worktree-ops.js";
import { emitEvent } from "./events.js";

const USE_PG = process.env.DB_BACKEND === "postgres";

export async function runWorkflow(params: {
  workflowId: string;
  taskTitle: string;
  notifyUrl?: string;
}): Promise<{ id: string; runNumber: number; workflowId: string; task: string; status: string }> {
  const workflowDir = resolveWorkflowDir(params.workflowId);
  const workflow = await loadWorkflowSpec(workflowDir);
  const now = new Date().toISOString();
  const runId = crypto.randomUUID();

  const initialContext: Record<string, string> = {
    task: params.taskTitle,
    ...workflow.context,
  };

  // Parse --repo and --branch from task text into initial context
  const repoFlag = params.taskTitle.match(/--repo\s+(\S+)/);
  if (repoFlag) {
    initialContext.repo = repoFlag[1].replace(/~/g, os.homedir());
  }
  const branchFlag = params.taskTitle.match(/--branch\s+(\S+)/);
  if (branchFlag) {
    initialContext.branch = branchFlag[1];
  }
  const portFlag = params.taskTitle.match(/--port\s+(\d+)/);
  if (portFlag) {
    initialContext.dev_server_port = portFlag[1];
  }

  // Parse DB_REQUIRED from task text (e.g. "DB_REQUIRED: postgres")
  const dbMatch = params.taskTitle.match(/DB_REQUIRED:\s*(\S+)/i);
  if (dbMatch) {
    initialContext.db_required = dbMatch[1].toLowerCase();
  }
  // Parse explicit DB host/port if provided (e.g. "host=1.2.3.4, port=5432")
  const dbHostMatch = params.taskTitle.match(/(?:db_host|host)\s*[=:]\s*([\d.]+)/i);
  if (dbHostMatch) initialContext.db_host = dbHostMatch[1];
  const dbPortMatch = params.taskTitle.match(/(?:db_port|port)\s*[=:]\s*(\d+)/i);
  if (dbPortMatch) initialContext.db_port = dbPortMatch[1];

  if (USE_PG) {
    const runNumber = await pgNextRunNumber();
    const notifyUrl = params.notifyUrl ?? workflow.notifications?.url ?? null;

    // Duplicate run guard
    const repoMatch = params.taskTitle.match(/Repo:\s*(\S+)/i);
    if (repoMatch) {
      const repoPath = repoMatch[1].replace(/~/g, os.homedir());
      const existingRun = await pgGet<{ id: string; run_number: number }>(
        "SELECT id, run_number FROM runs WHERE status = 'running' AND task LIKE $1", [`%${repoPath}%`]
      );
      if (existingRun) {
        throw new Error(
          `Already running: Run #${existingRun.run_number} (${existingRun.id}) for repo ${repoPath}. Cancel it first or wait for completion.`
        );
      }
    }

    await pgBegin(async (sql) => {
      await sql.unsafe(
        "INSERT INTO runs (id, run_number, workflow_id, task, status, context, notify_url, created_at, updated_at) VALUES ($1, $2, $3, $4, 'running', $5, $6, $7, $8)",
        [runId, runNumber, workflow.id, params.taskTitle, JSON.stringify(initialContext), notifyUrl, now, now]
      );

      for (let i = 0; i < workflow.steps.length; i++) {
        const step = workflow.steps[i];
        const stepUuid = crypto.randomUUID();
        const agentId = `${workflow.id}_${step.agent}`;
        const status = i === 0 ? "pending" : "waiting";
        const maxRetries = step.max_retries ?? step.on_fail?.max_retries ?? 2;
        const stepType = step.type ?? "single";
        const loopConfig = step.loop ? JSON.stringify(step.loop) : null;
        await sql.unsafe(
          "INSERT INTO steps (id, run_id, step_id, agent_id, step_index, input_template, expects, status, max_retries, type, loop_config, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)",
          [stepUuid, runId, step.id, agentId, i, step.input, step.expects, status, maxRetries, stepType, loopConfig, now, now]
        );
      }
    });

    // Clean agent workspaces of stale files from previous runs
    const agentIds = new Set(workflow.steps.map((s: any) => `${workflow.id}_${s.agent}`));
    for (const agentId of agentIds) {
      try {
        cleanAgentWorkspace(agentId);
      } catch (err) {
        logger.warn(`[run] Workspace cleanup failed for ${agentId}: ${err}`, {});
      }
    }

    // Start crons for this workflow (no-op if already running from another run)
    try {
      await ensureWorkflowCrons(workflow);
    } catch (err) {
      // Roll back the run since it can't advance without crons
      await pgRun("UPDATE runs SET status = 'failed', updated_at = $1 WHERE id = $2", [new Date().toISOString(), runId]);
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Cannot start workflow run: cron setup failed. ${message}`);
    }

    emitEvent({ ts: new Date().toISOString(), event: "run.started", runId, workflowId: workflow.id });

    logger.info(`Run started: "${params.taskTitle}"`, {
      workflowId: workflow.id,
      runId,
      stepId: workflow.steps[0]?.id,
    });

    return { id: runId, runNumber, workflowId: workflow.id, task: params.taskTitle, status: "running" };
  } else {
    const db = getDb();
    const runNumber = nextRunNumber();

    // Duplicate run guard: prevent starting a new run for same repo if one is already running
    const repoMatch = params.taskTitle.match(/Repo:\s*(\S+)/i);
    if (repoMatch) {
      const repoPath = repoMatch[1].replace(/~/g, os.homedir());
      const existingRun = db.prepare(
        "SELECT id, run_number FROM runs WHERE status = 'running' AND task LIKE ?"
      ).get(`%${repoPath}%`) as { id: string; run_number: number } | undefined;
      if (existingRun) {
        throw new Error(
          `Already running: Run #${existingRun.run_number} (${existingRun.id}) for repo ${repoPath}. Cancel it first or wait for completion.`
        );
      }
    }

    db.exec("BEGIN");
    try {
      const notifyUrl = params.notifyUrl ?? workflow.notifications?.url ?? null;
      const insertRun = db.prepare(
        "INSERT INTO runs (id, run_number, workflow_id, task, status, context, notify_url, created_at, updated_at) VALUES (?, ?, ?, ?, 'running', ?, ?, ?, ?)"
      );
      insertRun.run(runId, runNumber, workflow.id, params.taskTitle, JSON.stringify(initialContext), notifyUrl, now, now);

      const insertStep = db.prepare(
        "INSERT INTO steps (id, run_id, step_id, agent_id, step_index, input_template, expects, status, max_retries, type, loop_config, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      );

      for (let i = 0; i < workflow.steps.length; i++) {
        const step = workflow.steps[i];
        const stepUuid = crypto.randomUUID();
        const agentId = `${workflow.id}_${step.agent}`;
        const status = i === 0 ? "pending" : "waiting";
        const maxRetries = step.max_retries ?? step.on_fail?.max_retries ?? 2;
        const stepType = step.type ?? "single";
        const loopConfig = step.loop ? JSON.stringify(step.loop) : null;
        insertStep.run(stepUuid, runId, step.id, agentId, i, step.input, step.expects, status, maxRetries, stepType, loopConfig, now, now);
      }

      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }

    // Clean agent workspaces of stale files from previous runs
    const agentIds = new Set(workflow.steps.map((s: any) => `${workflow.id}_${s.agent}`));
    for (const agentId of agentIds) {
      try {
        cleanAgentWorkspace(agentId);
      } catch (err) {
        logger.warn(`[run] Workspace cleanup failed for ${agentId}: ${err}`, {});
      }
    }

    // Start crons for this workflow (no-op if already running from another run)
    try {
      await ensureWorkflowCrons(workflow);
    } catch (err) {
      // Roll back the run since it can't advance without crons
      const db2 = getDb();
      db2.prepare("UPDATE runs SET status = 'failed', updated_at = ? WHERE id = ?").run(new Date().toISOString(), runId);
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Cannot start workflow run: cron setup failed. ${message}`);
    }

    emitEvent({ ts: new Date().toISOString(), event: "run.started", runId, workflowId: workflow.id });

    logger.info(`Run started: "${params.taskTitle}"`, {
      workflowId: workflow.id,
      runId,
      stepId: workflow.steps[0]?.id,
    });

    return { id: runId, runNumber, workflowId: workflow.id, task: params.taskTitle, status: "running" };
  }
}
