import type postgres from "postgres";

import type { RunProtocolIdentity } from "./run-protocol.js";

export const runAdmissionLockKey = 1_397_117_252;

export class RunActivationConflictError extends Error {
  readonly code = "RUN_ACTIVATION_CONFLICT";

  constructor() {
    super("RUN_ACTIVATION_CONFLICT: another run or claim owns compiler activation");
    this.name = "RunActivationConflictError";
  }
}

export type PersistedWorkflowStep = Readonly<{
  id: string;
  stepId: string;
  agentId: string;
  stepIndex: number;
  inputTemplate: string;
  expects: string;
  status: string;
  maxRetries: number;
  type: string;
  loopConfig: string | null;
}>;

export async function persistWorkflowRun(
  sql: postgres.Sql | postgres.TransactionSql,
  input: Readonly<{
    run: Readonly<{
      id: string;
      runNumber: number;
      workflowId: string;
      task: string;
      context: string;
      notifyUrl: string | null;
      createdAt: string;
      protocol: RunProtocolIdentity;
    }>;
    steps: readonly PersistedWorkflowStep[];
  }>,
): Promise<void> {
  const { run } = input;
  await sql.unsafe("SELECT pg_advisory_xact_lock($1)", [runAdmissionLockKey]);
  const activity = await sql.unsafe<Array<{
    active_runs: number;
    active_compiler_runs: number;
    open_claims: number;
  }>>(
    `SELECT
       (SELECT COUNT(*)::integer FROM runs
         WHERE status IN ('running', 'resuming')) AS active_runs,
       (SELECT COUNT(*)::integer FROM runs
         WHERE status IN ('running', 'resuming')
           AND protocol IN ('shadow', 'v3')) AS active_compiler_runs,
       (SELECT COUNT(*)::integer FROM claim_log WHERE outcome IS NULL) AS open_claims`,
  );
  const current = activity[0] ?? { active_runs: 0, active_compiler_runs: 0, open_claims: 0 };
  const conflicts = run.protocol.mode === "legacy"
    ? current.active_compiler_runs > 0
    : current.active_runs > 0 || current.open_claims > 0;
  if (conflicts) throw new RunActivationConflictError();
  if (run.protocol.mode !== "legacy" && !run.protocol.activationPreflightHash) {
    throw new Error("RUN_ACTIVATION_PREFLIGHT_IDENTITY_MISSING");
  }
  await sql.unsafe(
    `INSERT INTO runs
       (id, run_number, workflow_id, task, status, context, notify_url,
        protocol, protocol_version, compiler_release_sha,
        activation_preflight_hash, created_at, updated_at)
     VALUES
       ($1, $2, $3, $4, 'running', $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      run.id,
      run.runNumber,
      run.workflowId,
      run.task,
      run.context,
      run.notifyUrl,
      run.protocol.mode,
      run.protocol.version,
      run.protocol.compilerReleaseSha,
      run.protocol.activationPreflightHash,
      run.createdAt,
      run.createdAt,
    ],
  );

  for (const step of input.steps) {
    await sql.unsafe(
      `INSERT INTO steps
         (id, run_id, step_id, agent_id, step_index, input_template, expects,
          status, max_retries, type, loop_config, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        step.id,
        run.id,
        step.stepId,
        step.agentId,
        step.stepIndex,
        step.inputTemplate,
        step.expects,
        step.status,
        step.maxRetries,
        step.type,
        step.loopConfig,
        run.createdAt,
        run.createdAt,
      ],
    );
  }
}
