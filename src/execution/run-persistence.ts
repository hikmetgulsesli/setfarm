import type postgres from "postgres";

import { readDatabaseWallClock } from "../db/database-wall-clock.js";
import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import type { RunProtocolIdentity } from "./run-protocol.js";
import {
  V3ReleaseAdmissionV1Schema,
  canarySelectorHash,
} from "./v3-release-admission.js";

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

type AdmissionPersistenceRow = Readonly<{
  admission_hash: string;
  kind: string;
  release_sha: string;
  expires_at: Date | string | null;
  payload: unknown;
}>;

async function lockAndVerifyReleaseAdmission(
  sql: postgres.TransactionSql,
  run: Readonly<{
    id: string;
    task: string;
    createdAt: string;
    protocol: RunProtocolIdentity;
  }>,
): Promise<Date> {
  if (run.protocol.mode !== "v3") {
    if (
      run.protocol.releaseAdmissionHash !== null
      || run.protocol.releaseAdmissionKind !== null
      || run.protocol.canaryAdmission !== null
    ) throw new Error("RUN_RELEASE_ADMISSION_FORBIDDEN");
    return readDatabaseWallClock(sql, "RUN_PERSISTENCE_DATABASE_TIME_UNAVAILABLE");
  }
  if (!run.protocol.releaseAdmissionHash || !run.protocol.releaseAdmissionKind) {
    throw new Error("RUN_RELEASE_ADMISSION_REQUIRED");
  }
  const admissionRows = await sql.unsafe<AdmissionPersistenceRow[]>(
    `SELECT admission_hash, kind, release_sha, expires_at, payload
       FROM v3_release_admissions
      WHERE admission_hash = $1
      FOR SHARE`,
    [run.protocol.releaseAdmissionHash],
  );
  const row = admissionRows[0];
  const parsed = row ? V3ReleaseAdmissionV1Schema.safeParse(row.payload) : null;
  if (
    !row
    || !parsed?.success
    || parsed.data.admissionHash !== row.admission_hash
    || parsed.data.kind !== row.kind
    || parsed.data.releaseSha !== row.release_sha
    || parsed.data.admissionHash !== run.protocol.releaseAdmissionHash
    || parsed.data.kind !== run.protocol.releaseAdmissionKind
    || parsed.data.releaseSha !== run.protocol.compilerReleaseSha
  ) throw new Error("RUN_RELEASE_ADMISSION_IDENTITY_INVALID");

  if (parsed.data.kind === "release_go") {
    if (run.protocol.canaryAdmission !== null) {
      throw new Error("RUN_RELEASE_ADMISSION_KIND_INVALID");
    }
    return readDatabaseWallClock(sql, "RUN_PERSISTENCE_DATABASE_TIME_UNAVAILABLE");
  }

  const context = run.protocol.canaryAdmission;
  if (
    !context
    || context.admissionHash !== parsed.data.admissionHash
    || context.taskHash !== hashCanonicalJson(run.task)
    || row.expires_at === null
  ) throw new Error("RUN_CANARY_ADMISSION_INVALID");
  const claims = await sql.unsafe<Array<{
    slot_hash: string;
    admission_hash: string;
    case_hash: string;
    task_hash: string;
    repetition: number;
    selector_hash: string;
    run_id: string | null;
    consumed_at: Date | string | null;
  }>>(
    `SELECT slot_hash, admission_hash, case_hash, task_hash, repetition,
            selector_hash, run_id, consumed_at
       FROM v3_canary_admission_claims
      WHERE slot_hash = $1
      FOR UPDATE`,
    [context.slotHash],
  );
  const claim = claims[0];
  const observedAt = await readDatabaseWallClock(
    sql,
    "RUN_PERSISTENCE_DATABASE_TIME_UNAVAILABLE",
  );
  if (new Date(row.expires_at).getTime() <= observedAt.getTime()) {
    throw new Error("RUN_CANARY_ADMISSION_INVALID");
  }
  if (
    !claim
    || claim.slot_hash !== context.slotHash
    || claim.admission_hash !== context.admissionHash
    || claim.case_hash !== context.caseHash
    || claim.task_hash !== context.taskHash
    || claim.repetition !== context.repetition
    || claim.selector_hash !== canarySelectorHash(context.slotToken)
    || claim.run_id !== null
    || claim.consumed_at !== null
  ) throw new Error("RUN_CANARY_ADMISSION_SLOT_UNAVAILABLE");
  return observedAt;
}

export async function persistWorkflowRun(
  sql: postgres.TransactionSql,
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
  if (!Number.isFinite(new Date(run.createdAt).getTime())) {
    throw new Error("RUN_PERSISTENCE_CALLER_TIME_INVALID");
  }
  await sql.unsafe("SELECT pg_advisory_xact_lock($1)", [runAdmissionLockKey]);
  const activity = await sql.unsafe<Array<{
    active_runs: number;
    active_compiler_runs: number;
    open_claims: number;
    active_attempts: number;
  }>>(
    `SELECT
       (SELECT COUNT(*)::integer FROM runs
         WHERE status IN ('running', 'resuming')) AS active_runs,
       (SELECT COUNT(*)::integer FROM runs
         WHERE status IN ('running', 'resuming')
           AND protocol IN ('shadow', 'v3')) AS active_compiler_runs,
       (SELECT COUNT(*)::integer FROM claim_log WHERE outcome IS NULL) AS open_claims,
       (SELECT COUNT(*)::integer FROM execution_attempts
         WHERE disposition IN ('claimed', 'running')) AS active_attempts`,
  );
  const current = activity[0] ?? {
    active_runs: 0,
    active_compiler_runs: 0,
    open_claims: 0,
    active_attempts: 0,
  };
  const conflicts = run.protocol.mode === "legacy"
    ? current.active_compiler_runs > 0 || current.active_attempts > 0
    : current.active_runs > 0 || current.open_claims > 0 || current.active_attempts > 0;
  if (conflicts) throw new RunActivationConflictError();
  if (run.protocol.mode !== "legacy" && !run.protocol.activationPreflightHash) {
    throw new Error("RUN_ACTIVATION_PREFLIGHT_IDENTITY_MISSING");
  }
  const persistedAt = await lockAndVerifyReleaseAdmission(sql, run);
  await sql.unsafe(
    `INSERT INTO runs
       (id, run_number, workflow_id, task, status, context, notify_url,
        protocol, protocol_version, compiler_release_sha,
        activation_preflight_hash, release_admission_hash,
        created_at, updated_at)
     VALUES
       ($1, $2, $3, $4, 'running', $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
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
      run.protocol.releaseAdmissionHash,
      persistedAt,
      persistedAt,
    ],
  );

  if (run.protocol.canaryAdmission) {
    const consumed = await sql.unsafe<Array<{ slot_hash: string }>>(
      `UPDATE v3_canary_admission_claims
          SET run_id = $1, consumed_at = $2
        WHERE slot_hash = $3
          AND admission_hash = $4
          AND run_id IS NULL
          AND consumed_at IS NULL
      RETURNING slot_hash`,
      [
        run.id,
        persistedAt,
        run.protocol.canaryAdmission.slotHash,
        run.protocol.releaseAdmissionHash,
      ],
    );
    if (consumed.length !== 1) throw new Error("RUN_CANARY_ADMISSION_CONSUMPTION_CONFLICT");
  }

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
        persistedAt,
        persistedAt,
      ],
    );
  }
}
