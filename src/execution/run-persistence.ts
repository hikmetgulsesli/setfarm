import { readDatabaseWallClock } from "../db/database-wall-clock.js";
import {
  beginOrAdoptInternalProductionOwnerReservationV1,
  bindInternalProductionOwnerReservationV1,
  createInternalProductionWorkflowRunCanonicalOwnerIdentityV1,
  lockInternalProductionWorkflowRunInsertionFenceV1,
  pgBegin,
  type PgTransactionSql,
} from "../db-pg.js";
import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import type { RunProtocolIdentity } from "./run-protocol.js";
import {
  V3ReleaseAdmissionV1Schema,
  canarySelectorHash,
} from "./v3-release-admission.js";

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

export type PersistWorkflowRunInputV1 = Readonly<{
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
}>;

export type PersistedWorkflowRunV1 = Readonly<{
  id: string;
  runNumber: number;
  workflowId: string;
  task: string;
  status: "running";
  context: string;
  notifyUrl: string | null;
  protocol: RunProtocolIdentity["mode"];
  protocolVersion: RunProtocolIdentity["version"];
  compilerReleaseSha: string;
  activationPreflightHash: string | null;
  releaseAdmissionHash: string | null;
  createdAt: string;
  updatedAt: string;
}>;

export type WorkflowRunOwnerReservationPairV1 = Readonly<{
  runOwnerReservationRef: string;
  runOwnerReservationHash: string;
}>;

export type PersistWorkflowRunResultV1 = Readonly<{
  run: PersistedWorkflowRunV1;
}> & WorkflowRunOwnerReservationPairV1;

type AdmissionPersistenceRow = Readonly<{
  admission_hash: string;
  kind: string;
  release_sha: string;
  expires_at: Date | string | null;
  payload: unknown;
}>;

type PersistedWorkflowRunRowV1 = Readonly<{
  id: string;
  run_number: number;
  workflow_id: string;
  task: string;
  status: string;
  context: string;
  notify_url: string | null;
  protocol: string;
  protocol_version: number;
  compiler_release_sha: string | null;
  activation_preflight_hash: string | null;
  release_admission_hash: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}>;

async function lockAndVerifyReleaseAdmission(
  sql: PgTransactionSql,
  run: Readonly<{
    id: string;
    task: string;
    createdAt: string;
    protocol: RunProtocolIdentity;
  }>,
  existingCreatedAt: Date | string | null,
): Promise<Date> {
  if (run.protocol.mode !== "v3") {
    if (
      run.protocol.releaseAdmissionHash !== null
      || run.protocol.releaseAdmissionKind !== null
      || run.protocol.canaryAdmission !== null
    ) throw new Error("RUN_RELEASE_ADMISSION_FORBIDDEN");
    return existingCreatedAt === null
      ? readDatabaseWallClock(sql, "RUN_PERSISTENCE_DATABASE_TIME_UNAVAILABLE")
      : new Date(existingCreatedAt);
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
    return existingCreatedAt === null
      ? readDatabaseWallClock(sql, "RUN_PERSISTENCE_DATABASE_TIME_UNAVAILABLE")
      : new Date(existingCreatedAt);
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
  const observedAt = existingCreatedAt === null
    ? await readDatabaseWallClock(sql, "RUN_PERSISTENCE_DATABASE_TIME_UNAVAILABLE")
    : new Date(existingCreatedAt);
  if (existingCreatedAt === null && new Date(row.expires_at).getTime() <= observedAt.getTime()) {
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
    || (existingCreatedAt === null
      ? claim.run_id !== null || claim.consumed_at !== null
      : claim.run_id !== run.id
        || claim.consumed_at === null
        || new Date(claim.consumed_at).toISOString() !== observedAt.toISOString())
  ) throw new Error("RUN_CANARY_ADMISSION_SLOT_UNAVAILABLE");
  return observedAt;
}

function persistedWorkflowRunResultV1(
  row: PersistedWorkflowRunRowV1,
  pair: WorkflowRunOwnerReservationPairV1,
): PersistWorkflowRunResultV1 {
  if (
    row.status !== "running"
    || row.compiler_release_sha === null
    || !Number.isFinite(new Date(row.created_at).getTime())
    || !Number.isFinite(new Date(row.updated_at).getTime())
  ) throw new Error("RUN_PERSISTENCE_STORED_RUN_INVALID");
  return Object.freeze({
    run: Object.freeze({
      id: row.id,
      runNumber: row.run_number,
      workflowId: row.workflow_id,
      task: row.task,
      status: "running",
      context: row.context,
      notifyUrl: row.notify_url,
      protocol: row.protocol as RunProtocolIdentity["mode"],
      protocolVersion: row.protocol_version as RunProtocolIdentity["version"],
      compilerReleaseSha: row.compiler_release_sha,
      activationPreflightHash: row.activation_preflight_hash,
      releaseAdmissionHash: row.release_admission_hash,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
    }),
    runOwnerReservationRef: pair.runOwnerReservationRef,
    runOwnerReservationHash: pair.runOwnerReservationHash,
  });
}

export async function persistWorkflowRunInTransaction(
  sql: PgTransactionSql,
  input: PersistWorkflowRunInputV1,
): Promise<PersistWorkflowRunResultV1> {
  const { run } = input;
  if (!Number.isFinite(new Date(run.createdAt).getTime())) {
    throw new Error("RUN_PERSISTENCE_CALLER_TIME_INVALID");
  }
  await lockInternalProductionWorkflowRunInsertionFenceV1(sql);
  const reservation = await beginOrAdoptInternalProductionOwnerReservationV1(sql, {
    producerImplementationId: "a-runtime-run-v1",
    ownerKey: run.id,
  });
  const existingRows = await sql.unsafe<PersistedWorkflowRunRowV1[]>(
    `SELECT id,run_number,workflow_id,task,status,context,notify_url,protocol,
            protocol_version,compiler_release_sha,activation_preflight_hash,
            release_admission_hash,created_at,updated_at
       FROM runs
      WHERE id = $1
      FOR UPDATE`,
    [run.id],
  );
  if (existingRows.length > 1) throw new Error("RUN_PERSISTENCE_STORED_RUN_INVALID");
  const existing = existingRows[0] ?? null;
  const activity = await sql.unsafe<Array<{
    active_runs: number;
    active_compiler_runs: number;
    open_claims: number;
    active_attempts: number;
    downstream_claims: number;
    downstream_attempts: number;
  }>>(
    `SELECT
       (SELECT COUNT(*)::integer FROM runs
         WHERE id <> $1 AND status IN ('running', 'resuming')) AS active_runs,
       (SELECT COUNT(*)::integer FROM runs
         WHERE id <> $1 AND status IN ('running', 'resuming')
           AND protocol IN ('shadow', 'v3')) AS active_compiler_runs,
       (SELECT COUNT(*)::integer FROM claim_log WHERE outcome IS NULL) AS open_claims,
       (SELECT COUNT(*)::integer FROM execution_attempts
         WHERE disposition IN ('claimed', 'running')) AS active_attempts,
       (SELECT COUNT(*)::integer FROM claim_log WHERE run_id = $1) AS downstream_claims,
       (SELECT COUNT(*)::integer FROM execution_attempts WHERE run_id = $1) AS downstream_attempts`,
    [run.id],
  );
  const current = activity[0] ?? {
    active_runs: 0,
    active_compiler_runs: 0,
    open_claims: 0,
    active_attempts: 0,
    downstream_claims: 0,
    downstream_attempts: 0,
  };
  const conflicts = run.protocol.mode === "legacy"
    ? current.active_compiler_runs > 0 || current.active_attempts > 0
    : current.active_runs > 0 || current.open_claims > 0 || current.active_attempts > 0;
  if (
    conflicts
    || (existing !== null && (current.downstream_claims > 0 || current.downstream_attempts > 0))
  ) throw new RunActivationConflictError();
  if (run.protocol.mode !== "legacy" && !run.protocol.activationPreflightHash) {
    throw new Error("RUN_ACTIVATION_PREFLIGHT_IDENTITY_MISSING");
  }
  const persistedAt = await lockAndVerifyReleaseAdmission(sql, run, existing?.created_at ?? null);
  if (existing) {
    const createdAt = new Date(existing.created_at).toISOString();
    if (
      existing.id !== run.id
      || existing.run_number !== run.runNumber
      || existing.workflow_id !== run.workflowId
      || existing.task !== run.task
      || existing.status !== "running"
      || existing.context !== run.context
      || existing.notify_url !== run.notifyUrl
      || existing.protocol !== run.protocol.mode
      || existing.protocol_version !== run.protocol.version
      || existing.compiler_release_sha !== run.protocol.compilerReleaseSha
      || existing.activation_preflight_hash !== run.protocol.activationPreflightHash
      || existing.release_admission_hash !== run.protocol.releaseAdmissionHash
      || new Date(existing.updated_at).toISOString() !== createdAt
    ) throw new Error("RUN_PERSISTENCE_ADOPTION_IDENTITY_INVALID");
    const storedSteps = await sql.unsafe<Array<{
      id: string;
      run_id: string;
      step_id: string;
      agent_id: string;
      step_index: number;
      input_template: string;
      expects: string;
      status: string;
      max_retries: number;
      type: string;
      loop_config: string | null;
      created_at: Date | string;
      updated_at: Date | string;
    }>>(
      `SELECT id,run_id,step_id,agent_id,step_index,input_template,expects,
              status,max_retries,type,loop_config,created_at,updated_at
         FROM steps
        WHERE run_id = $1
        ORDER BY step_index,id
        FOR UPDATE`,
      [run.id],
    );
    if (
      storedSteps.length !== input.steps.length
      || storedSteps.some((step, index) => {
        const expected = input.steps[index];
        return !expected
          || step.id !== expected.id
          || step.run_id !== run.id
          || step.step_id !== expected.stepId
          || step.agent_id !== expected.agentId
          || step.step_index !== expected.stepIndex
          || step.input_template !== expected.inputTemplate
          || step.expects !== expected.expects
          || step.status !== expected.status
          || step.max_retries !== expected.maxRetries
          || step.type !== expected.type
          || step.loop_config !== expected.loopConfig
          || new Date(step.created_at).toISOString() !== createdAt
          || new Date(step.updated_at).toISOString() !== createdAt;
      })
    ) throw new Error("RUN_PERSISTENCE_ADOPTION_IDENTITY_INVALID");
    const sidecars = await sql.unsafe<Array<{ reservation_ref: string; reservation_hash: string; state: string }>>(
      `SELECT reservation_ref,reservation_hash,state
         FROM internal_production_owner_reservations_v1
        WHERE producer_implementation_id='a-runtime-run-v1'
          AND category='run'
          AND owner_key=$1
        FOR UPDATE`,
      [run.id],
    );
    if (
      sidecars.length !== 1
      || sidecars[0]!.reservation_ref !== reservation.reservationRef
      || sidecars[0]!.reservation_hash !== reservation.reservationHash
      || sidecars[0]!.state !== "bound"
    ) throw new Error("RUN_PERSISTENCE_ADOPTION_IDENTITY_INVALID");
    const bound = await bindInternalProductionOwnerReservationV1(sql, {
      reservationRef: reservation.reservationRef,
      reservationHash: reservation.reservationHash,
      canonicalOwnerIdentity: createInternalProductionWorkflowRunCanonicalOwnerIdentityV1(run.id),
    });
    return persistedWorkflowRunResultV1(existing, {
      runOwnerReservationRef: bound.reservationRef,
      runOwnerReservationHash: bound.reservationHash,
    });
  }
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
  const bound = await bindInternalProductionOwnerReservationV1(sql, {
    reservationRef: reservation.reservationRef,
    reservationHash: reservation.reservationHash,
    canonicalOwnerIdentity: createInternalProductionWorkflowRunCanonicalOwnerIdentityV1(run.id),
  });
  const stored = await sql.unsafe<Array<{
    id: string;
    run_number: number;
    workflow_id: string;
    task: string;
    status: string;
    context: string;
    notify_url: string | null;
    protocol: string;
    protocol_version: number;
    compiler_release_sha: string | null;
    activation_preflight_hash: string | null;
    release_admission_hash: string | null;
    created_at: Date | string;
    updated_at: Date | string;
  }>>(
    `SELECT id,run_number,workflow_id,task,status,context,notify_url,protocol,
            protocol_version,compiler_release_sha,activation_preflight_hash,
            release_admission_hash,created_at,updated_at
       FROM runs
      WHERE id = $1
      FOR UPDATE`,
    [run.id],
  );
  const row = stored[0];
  if (
    stored.length !== 1
    || !row
    || row.status !== "running"
    || row.compiler_release_sha === null
  ) throw new Error("RUN_PERSISTENCE_STORED_RUN_INVALID");
  return persistedWorkflowRunResultV1(row, {
    runOwnerReservationRef: bound.reservationRef,
    runOwnerReservationHash: bound.reservationHash,
  });
}

export async function persistWorkflowRun(
  input: PersistWorkflowRunInputV1,
): Promise<PersistWorkflowRunResultV1> {
  let tentative: PersistWorkflowRunResultV1 | undefined;
  await pgBegin(async (sql) => {
    tentative = await persistWorkflowRunInTransaction(sql, input);
    return undefined;
  });
  const committed = tentative;
  if (!committed) throw new Error("RUN_PERSISTENCE_COMMIT_RESULT_UNAVAILABLE");
  return committed;
}
