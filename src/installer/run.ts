import os from "node:os";
import crypto from "node:crypto";
import { loadWorkflowSpec } from "./workflow-spec.js";
import { resolveWorkflowDir } from "./paths.js";
import { pgRun, pgGet, pgExec, pgBegin, pgNextRunNumber, now } from "../db-pg.js";
import { logger } from "../lib/logger.js";
import { ensureWorkflowCrons } from "./agent-cron.js";
import { cleanAgentWorkspace } from "./worktree-ops.js";
import { emitEvent } from "./events.js";
import { refreshRunContractSafe } from "./contract-ledger.js";
import { parseStackPrefix } from "./stack-contract/prefix.js";
import {
  resolveNewRunProtocol,
  type RunProtocolIdentity,
  type RunReleaseAdmissionSelection,
} from "../execution/run-protocol.js";
import {
  persistWorkflowRun,
  type PersistedWorkflowStep,
} from "../execution/run-persistence.js";
import { transitionRunToTerminalInTransaction } from "../execution/run-terminal-transition.js";

export async function runWorkflow(params: {
  workflowId: string;
  taskTitle: string;
  notifyUrl?: string;
  requestedProtocol?: string;
  compilerReleaseSha: string;
  activationPreflight?: Readonly<{
    status: "pass" | "fail";
    hash: string;
    stored: boolean;
  }>;
  releaseAdmission?: RunReleaseAdmissionSelection;
}): Promise<{
  id: string;
  runNumber: number;
  workflowId: string;
  task: string;
  status: string;
  protocol: RunProtocolIdentity["mode"];
  protocolVersion: RunProtocolIdentity["version"];
}> {
  const protocol = resolveNewRunProtocol({
    ...(params.requestedProtocol !== undefined
      ? { requestedMode: params.requestedProtocol }
      : {}),
    compilerReleaseSha: params.compilerReleaseSha,
    ...(params.activationPreflight
      ? { activationPreflight: params.activationPreflight }
      : {}),
    ...(params.releaseAdmission
      ? { releaseAdmission: params.releaseAdmission }
      : {}),
  });
  const workflowDir = resolveWorkflowDir(params.workflowId);
  const workflow = await loadWorkflowSpec(workflowDir);
  const ts = now();
  const runId = crypto.randomUUID();
  const stackPrefix = parseStackPrefix(params.taskTitle);
  const contextTaskTitle = stackPrefix?.taskText || params.taskTitle;

  const initialContext: Record<string, string> = {
    task: contextTaskTitle,
    ...workflow.context,
  };
  if (stackPrefix) {
    initialContext.original_task = params.taskTitle;
    initialContext.requested_stack_prefix = stackPrefix.prefix;
    initialContext.stack_pack_id = stackPrefix.packId;
    initialContext.detected_stack = stackPrefix.packId;
    initialContext.platform = stackPrefix.platform;
    initialContext.tech_stack = stackPrefix.techStack;
  }

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

  const persistedSteps: PersistedWorkflowStep[] = workflow.steps.map((step, index) => ({
    id: crypto.randomUUID(),
    stepId: step.id,
    agentId: `${workflow.id}_${step.agent}`,
    stepIndex: index,
    inputTemplate: step.input,
    expects: step.expects,
    status: index === 0 ? "pending" : "waiting",
    maxRetries: step.max_retries ?? step.on_fail?.max_retries ?? 2,
    type: step.type ?? "single",
    loopConfig: step.loop ? JSON.stringify(step.loop) : null,
  }));
  await persistWorkflowRun({
    run: {
      id: runId,
      runNumber,
      workflowId: workflow.id,
      task: params.taskTitle,
      context: JSON.stringify(initialContext),
      notifyUrl,
      createdAt: ts,
      protocol,
    },
    steps: persistedSteps,
  });

  await refreshRunContractSafe(runId, "run.started");

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
    const message = err instanceof Error ? err.message : String(err);
    // No worker can have claimed this run before cron publication succeeds.
    // Prove that invariant and terminalize the whole persisted bootstrap state
    // atomically. This explicit pre-claim bootstrap exception is valid for
    // either protocol; every post-publication failure uses durable termination.
    await pgBegin(async (sql) => {
      await transitionRunToTerminalInTransaction(sql, {
        runId,
        status: "failed",
        diagnostic: `Cron setup failed before claim publication: ${message}`,
        terminalFailure: true,
        unclaimedBootstrapFailure: true,
      });
    });
    throw new Error(`Cannot start workflow run: cron setup failed. ${message}`);
  }

  emitEvent({ ts: now(), event: "run.started", runId, workflowId: workflow.id });
  const firstStep = workflow.steps[0];
  if (firstStep) {
    const payload = JSON.stringify({
      agentId: `${workflow.id}_${firstStep.agent}`,
      runId,
      stepId: firstStep.id,
    });
    try {
      await pgRun("SELECT pg_notify('step_pending', $1)", [payload]);
    } catch (err) {
      logger.warn(`[run] step_pending notify failed for run ${runId}: ${err}`, {});
    }
  }

  logger.info(`Run started: "${params.taskTitle}"`, {
    workflowId: workflow.id,
    runId,
    stepId: workflow.steps[0]?.id,
  });

  return {
    id: runId,
    runNumber,
    workflowId: workflow.id,
    task: params.taskTitle,
    status: "running",
    protocol: protocol.mode,
    protocolVersion: protocol.version,
  };
}
