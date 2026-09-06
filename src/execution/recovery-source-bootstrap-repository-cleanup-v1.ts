import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  classifyInternalProductionRecoverySourceBootstrapRunPersistenceInTransactionV1,
  getSql,
  type PgTransactionSql,
} from "../db-pg.js";
import {
  isInternalProductionRecoverySourceBootstrapRunContextV1,
  resolveInternalProductionRecoverySourceBootstrapRunContextBindingAuthorityV1,
} from "./recovery-source-bootstrap-run-authority-v1.js";
import {
  removeAuthenticatedInternalProductionRecoverySourceBootstrapRepositoryV1,
  releaseAuthenticatedInternalProductionRecoverySourceBootstrapErasureCompletionV1,
  listInternalProductionRecoverySourceBootstrapRepositoryCleanupCandidateRunIdsV1,
  resolveInternalProductionRecoverySourceBootstrapRepositoryCleanupStateV1,
  validateClaimedInternalProductionRecoverySourceBootstrapRepositoryV1,
  validateInternalProductionRecoverySourceBootstrapRepositoryV1,
} from "./recovery-source-bootstrap-repository-v1.js";

const RECOVERY_SOURCE_BOOTSTRAP_SOURCE_ROOT_V1 = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

const RECOVERY_SOURCE_BOOTSTRAP_CLEANUP_RECEIPT_PREFIX_V1 =
  "internal-production-recovery-source-bootstrap-repository-cleanup-v1:";
const RECOVERY_SOURCE_BOOTSTRAP_CLEANUP_CHECK_V1 =
  "recovery-source-bootstrap.repository-cleanup";

type RecoverySourceBootstrapCleanupRepositoryInputV1 = Readonly<{
  sourceRepositoryRoot: string;
  runId: string;
  operationRef: string;
  operationHash: string;
  baseSourceSha: string;
  baseSourceTreeHash: string;
}>;

type RecoverySourceBootstrapCleanupOutcomeV1 = Readonly<{
  cleaned: boolean;
  releaseCompletion: boolean;
  finalizeReceipt: boolean;
  repositoryInput: RecoverySourceBootstrapCleanupRepositoryInputV1 | null;
}>;

async function recordRecoverySourceBootstrapCleanupReceiptV1(input: Readonly<{
  runId: string;
  status: "pass" | "retry";
  diagnostic: string;
  completionReleased?: boolean;
}>, sql: PgTransactionSql = getSql() as unknown as PgTransactionSql): Promise<void> {
  const receiptId = `${RECOVERY_SOURCE_BOOTSTRAP_CLEANUP_RECEIPT_PREFIX_V1}${input.runId}`;
  const rows = await sql.unsafe<Array<{
    id: string;
    run_id: string;
    step_id: string;
    story_id: string;
    phase: string;
    check_id: string;
    status: string;
    event_type: string;
    metadata: string;
  }>>(
    `INSERT INTO public.run_observations (
       id,run_id,step_id,story_id,agent_id,phase,check_id,label,status,
       summary,detail,evidence,file_paths,github,metadata,event_type,
       started_at,completed_at,created_at,updated_at
     ) VALUES (
       $1,$2,'run','',NULL,'operations','recovery-source-bootstrap.repository-cleanup',
       'Recovery source bootstrap repository cleanup',$3,$4,$4,'{}','[]','{}',
       jsonb_build_object(
         'completionReleased',$5,
         'runContext',(SELECT context FROM public.runs WHERE id=$2)
       )::text,
       'recovery-source-bootstrap.repository-cleanup',NULL,
       CASE WHEN $3 = 'pass' THEN NOW() ELSE NULL END,NOW(),NOW()
     )
     ON CONFLICT (id) DO UPDATE SET
       status=CASE WHEN run_observations.status = 'pass' THEN 'pass' ELSE EXCLUDED.status END,
       summary=CASE WHEN run_observations.status = 'pass' THEN run_observations.summary ELSE EXCLUDED.summary END,
       detail=CASE WHEN run_observations.status = 'pass' THEN run_observations.detail ELSE EXCLUDED.detail END,
       completed_at=CASE WHEN run_observations.status = 'pass' THEN run_observations.completed_at ELSE EXCLUDED.completed_at END,
       updated_at=CASE WHEN run_observations.status = 'pass' THEN run_observations.updated_at ELSE NOW() END
     WHERE run_observations.run_id=EXCLUDED.run_id
       AND run_observations.step_id='run'
       AND run_observations.story_id=''
       AND run_observations.phase='operations'
       AND run_observations.check_id='recovery-source-bootstrap.repository-cleanup'
       AND run_observations.event_type='recovery-source-bootstrap.repository-cleanup'
       AND run_observations.metadata=EXCLUDED.metadata
       AND run_observations.status IN ('pass','retry')
     RETURNING id,run_id,step_id,story_id,phase,check_id,status,event_type,metadata`,
    [receiptId, input.runId, input.status, input.diagnostic, input.completionReleased === true],
  );
  const row = rows[0];
  let metadata: Readonly<Record<string, unknown>> | null = null;
  try {
    metadata = JSON.parse(row?.metadata ?? "null") as Readonly<Record<string, unknown>> | null;
  } catch {
    metadata = null;
  }
  if (
    rows.length !== 1
    || row?.id !== receiptId
    || row.run_id !== input.runId
    || row.step_id !== "run"
    || row.story_id !== ""
    || row.phase !== "operations"
    || row.check_id !== RECOVERY_SOURCE_BOOTSTRAP_CLEANUP_CHECK_V1
    || ![input.status, "pass"].includes(row.status)
    || row.event_type !== RECOVERY_SOURCE_BOOTSTRAP_CLEANUP_CHECK_V1
    || metadata === null
    || typeof metadata !== "object"
    || Object.keys(metadata).sort().join(",") !== "completionReleased,runContext"
    || metadata.completionReleased !== (input.completionReleased === true)
    || typeof metadata.runContext !== "string"
  ) throw new Error("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_CLEANUP_RECEIPT_CROSSED");
}

async function finalizeRecoverySourceBootstrapCleanupReceiptV1(
  input: Readonly<{ runId: string }>,
  sql: PgTransactionSql,
): Promise<void> {
  const receiptId = `${RECOVERY_SOURCE_BOOTSTRAP_CLEANUP_RECEIPT_PREFIX_V1}${input.runId}`;
  const rows = await sql.unsafe<Array<{ id: string; metadata: string }>>(
    `UPDATE public.run_observations observation
        SET metadata=jsonb_build_object(
          'completionReleased',true,
          'runContext',run.context
        )::text,
            updated_at=NOW()
       FROM public.runs run
      WHERE observation.id=$1
        AND run.id=$2
        AND observation.run_id=run.id
        AND observation.step_id='run'
        AND observation.story_id=''
        AND observation.phase='operations'
        AND observation.check_id='recovery-source-bootstrap.repository-cleanup'
        AND observation.status='pass'
        AND observation.event_type='recovery-source-bootstrap.repository-cleanup'
        AND observation.metadata IN (
          jsonb_build_object('completionReleased',false,'runContext',run.context)::text,
          jsonb_build_object('completionReleased',true,'runContext',run.context)::text
        )
      RETURNING observation.id,observation.metadata`,
    [receiptId, input.runId],
  );
  let metadata: Readonly<Record<string, unknown>> | null = null;
  try {
    metadata = JSON.parse(rows[0]?.metadata ?? "null") as Readonly<Record<string, unknown>> | null;
  } catch {
    metadata = null;
  }
  if (
    rows.length !== 1
    || rows[0]?.id !== receiptId
    || metadata === null
    || typeof metadata !== "object"
    || Object.keys(metadata).sort().join(",") !== "completionReleased,runContext"
    || metadata.completionReleased !== true
    || typeof metadata.runContext !== "string"
  ) throw new Error("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_CLEANUP_RECEIPT_CROSSED");
}

export async function cleanupCompletedInternalProductionRecoverySourceBootstrapRepositoryV1(
  input: Readonly<{ runId: string }>,
): Promise<boolean> {
  const reserved = await getSql().reserve();
  const lockKey = `setfarm.recovery-source-bootstrap.repository-cleanup.v1:${input.runId}`;
  let sessionTimeoutConfigured = false;
  let sessionLockHeld = false;
  let transactionOpen = false;
  let connectionPoisoned = false;
  let outcome: RecoverySourceBootstrapCleanupOutcomeV1 | undefined;
  let primaryError: unknown;
  let cleanupError: unknown;
  try {
    sessionTimeoutConfigured = true;
    await reserved.unsafe("SELECT set_config('lock_timeout',$1,false)", ["30000ms"]);
    sessionLockHeld = true;
    const lockRows = await reserved.unsafe<Array<Record<string, unknown>>>(
      "SELECT pg_advisory_lock(hashtextextended($1, 0))",
      [lockKey],
    );
    if (lockRows.length !== 1) {
      throw new Error("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_CLEANUP_LOCK_CROSSED");
    }
    transactionOpen = true;
    await reserved.unsafe("BEGIN ISOLATION LEVEL REPEATABLE READ");
    const transaction = reserved as unknown as PgTransactionSql;
    outcome = await (async (): Promise<RecoverySourceBootstrapCleanupOutcomeV1> => {
    const rows = await transaction.unsafe<Array<{
      status: string;
      context: string;
      cleanup_id: string | null;
      cleanup_run_id: string | null;
      cleanup_step_id: string | null;
      cleanup_story_id: string | null;
      cleanup_phase: string | null;
      cleanup_check_id: string | null;
      cleanup_status: string | null;
      cleanup_event_type: string | null;
      cleanup_metadata: string | null;
    }>>(
      `SELECT run.status,run.context,
              observation.id AS cleanup_id,
              observation.run_id AS cleanup_run_id,
              observation.step_id AS cleanup_step_id,
              observation.story_id AS cleanup_story_id,
              observation.phase AS cleanup_phase,
              observation.check_id AS cleanup_check_id,
              observation.status AS cleanup_status,
              observation.event_type AS cleanup_event_type,
              observation.metadata AS cleanup_metadata
         FROM public.runs run
         LEFT JOIN public.run_observations observation
           ON observation.id = 'internal-production-recovery-source-bootstrap-repository-cleanup-v1:' || run.id
        WHERE run.id=$1
        FOR UPDATE OF run`,
      [input.runId],
    );
    if (rows.length !== 1) throw new Error("RECOVERY_SOURCE_BOOTSTRAP_CLEANUP_RUN_INVALID");
    const row = rows[0]!;
    const expectedReceiptId = `${RECOVERY_SOURCE_BOOTSTRAP_CLEANUP_RECEIPT_PREFIX_V1}${input.runId}`;
    let receiptMetadata: Readonly<Record<string, unknown>> | null = null;
    try {
      receiptMetadata = JSON.parse(row.cleanup_metadata ?? "null") as Readonly<Record<string, unknown>> | null;
    } catch {
      receiptMetadata = null;
    }
    const receiptExists = row.cleanup_id !== null;
    if (
      receiptExists
      && (
        row.cleanup_id !== expectedReceiptId
        || row.cleanup_run_id !== input.runId
        || row.cleanup_step_id !== "run"
        || row.cleanup_story_id !== ""
        || row.cleanup_phase !== "operations"
        || row.cleanup_check_id !== RECOVERY_SOURCE_BOOTSTRAP_CLEANUP_CHECK_V1
        || !["pass", "retry"].includes(row.cleanup_status ?? "")
        || row.cleanup_event_type !== RECOVERY_SOURCE_BOOTSTRAP_CLEANUP_CHECK_V1
        || receiptMetadata === null
        || typeof receiptMetadata !== "object"
        || Object.keys(receiptMetadata).sort().join(",") !== "completionReleased,runContext"
        || typeof receiptMetadata.completionReleased !== "boolean"
        || (row.cleanup_status === "retry" && receiptMetadata.completionReleased !== false)
        || receiptMetadata.runContext !== row.context
      )
    ) throw new Error("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_CLEANUP_RECEIPT_CROSSED");
    let context: Readonly<Record<string, unknown>>;
    try {
      context = JSON.parse(row.context) as Readonly<Record<string, unknown>>;
    } catch {
      throw new Error("RECOVERY_SOURCE_BOOTSTRAP_CLEANUP_CONTEXT_INVALID");
    }
    if (!isInternalProductionRecoverySourceBootstrapRunContextV1(context)) {
      if (!["completed", "failed", "cancelled"].includes(row.status)) {
        return Object.freeze({ cleaned: false, releaseCompletion: false, finalizeReceipt: false, repositoryInput: null });
      }
      if (row.cleanup_status === "pass") {
        return Object.freeze({
          cleaned: false,
          releaseCompletion: false,
          finalizeReceipt: receiptMetadata?.completionReleased === false,
          repositoryInput: null,
        });
      }
      await recordRecoverySourceBootstrapCleanupReceiptV1(
        { runId: input.runId, status: "pass", diagnostic: "not-recovery-source-bootstrap" },
        transaction,
      );
      return Object.freeze({ cleaned: false, releaseCompletion: false, finalizeReceipt: true, repositoryInput: null });
    }
    const authority = resolveInternalProductionRecoverySourceBootstrapRunContextBindingAuthorityV1({
      sourceRepositoryRoot: RECOVERY_SOURCE_BOOTSTRAP_SOURCE_ROOT_V1,
      runId: input.runId,
      context,
    });
    const persistence = await classifyInternalProductionRecoverySourceBootstrapRunPersistenceInTransactionV1(
      transaction,
      {
        recoveryState: "terminal",
        recoveryOperationAuthority: authority.operation,
      },
    );
    const bindingMatches = persistence.state !== "absent"
      && persistence.runId === input.runId
      && persistence.operationRunBindingHash === authority.operationRunBindingHash
      && persistence.reciprocalRunOperationBindingHash === authority.reciprocalRunOperationBindingHash;
    if (["running", "resuming", "cancelling", "failing"].includes(row.status)) {
      if (
        persistence.state === "active"
        && persistence.workflowState === row.status
        && bindingMatches
        && !receiptExists
      ) return Object.freeze({ cleaned: false, releaseCompletion: false, finalizeReceipt: false, repositoryInput: null });
      throw new Error("RECOVERY_SOURCE_BOOTSTRAP_CLEANUP_RUN_CROSSED");
    }
    if (["failed", "cancelled"].includes(row.status)) {
      if (
        persistence.state === "released"
        && persistence.workflowState === row.status
        && bindingMatches
      ) {
        // Continue with the same released terminal cleanup below.
      } else {
        throw new Error("RECOVERY_SOURCE_BOOTSTRAP_CLEANUP_RUN_CROSSED");
      }
    } else if (
      row.status !== "completed"
      || persistence.state !== "released"
      || persistence.workflowState !== "completed"
      || !bindingMatches
    ) {
      throw new Error("RECOVERY_SOURCE_BOOTSTRAP_CLEANUP_RUN_CROSSED");
    }
    const repositoryInput = Object.freeze({
      sourceRepositoryRoot: authority.repositoryIdentity.sourceRepositoryRoot,
      runId: input.runId,
      operationRef: authority.operation.operationRef,
      operationHash: authority.operation.operationHash,
      baseSourceSha: authority.operation.baseSourceSha,
      baseSourceTreeHash: authority.operation.baseSourceTreeHash,
    });
    const cleanupState = resolveInternalProductionRecoverySourceBootstrapRepositoryCleanupStateV1(repositoryInput);
    if (row.cleanup_status === "pass") {
      if (receiptMetadata?.completionReleased === true) {
        if (cleanupState !== "absent") {
          throw new Error("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_CLEANUP_RECEIPT_CROSSED");
        }
        return Object.freeze({ cleaned: false, releaseCompletion: false, finalizeReceipt: false, repositoryInput });
      }
      if (cleanupState === "absent") {
        return Object.freeze({ cleaned: true, releaseCompletion: true, finalizeReceipt: true, repositoryInput });
      }
      if (cleanupState !== "erased") {
        throw new Error("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_CLEANUP_RECEIPT_CROSSED");
      }
      return Object.freeze({ cleaned: true, releaseCompletion: true, finalizeReceipt: true, repositoryInput });
    }
    if (cleanupState === "absent") {
      throw new Error("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_CLEANUP_EVIDENCE_MISSING");
    }
    if (cleanupState === "workspace") {
      validateInternalProductionRecoverySourceBootstrapRepositoryV1(repositoryInput);
    } else if (cleanupState === "claimed") {
      validateClaimedInternalProductionRecoverySourceBootstrapRepositoryV1(repositoryInput);
    }
    removeAuthenticatedInternalProductionRecoverySourceBootstrapRepositoryV1(repositoryInput);
    await recordRecoverySourceBootstrapCleanupReceiptV1(
      { runId: input.runId, status: "pass", diagnostic: "" },
      transaction,
    );
      return Object.freeze({ cleaned: true, releaseCompletion: true, finalizeReceipt: true, repositoryInput });
    })();
    await reserved.unsafe("COMMIT");
    transactionOpen = false;
    if (outcome.releaseCompletion && outcome.repositoryInput !== null) {
      releaseAuthenticatedInternalProductionRecoverySourceBootstrapErasureCompletionV1(outcome.repositoryInput);
    }
    if (outcome.finalizeReceipt) {
      await finalizeRecoverySourceBootstrapCleanupReceiptV1(
        { runId: input.runId },
        reserved as unknown as PgTransactionSql,
      );
    }
  } catch (error) {
    primaryError = error;
    if (transactionOpen) {
      try {
        await reserved.unsafe("ROLLBACK");
        transactionOpen = false;
      } catch (rollbackError) {
        cleanupError = rollbackError;
        connectionPoisoned = true;
      }
    }
  }
  if (sessionLockHeld && !connectionPoisoned) {
    try {
      const unlockRows = await reserved.unsafe<Array<{ unlocked: boolean }>>(
        "SELECT pg_advisory_unlock(hashtextextended($1, 0)) AS unlocked",
        [lockKey],
      );
      if (unlockRows.length !== 1 || unlockRows[0]?.unlocked !== true) {
        throw new Error("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_CLEANUP_UNLOCK_CROSSED");
      }
      sessionLockHeld = false;
    } catch (error) {
      cleanupError ??= error;
      connectionPoisoned = true;
    }
  }
  if (sessionTimeoutConfigured && !connectionPoisoned) {
    try {
      await reserved.unsafe("RESET lock_timeout");
      sessionTimeoutConfigured = false;
    } catch (error) {
      cleanupError ??= error;
      connectionPoisoned = true;
    }
  }
  if (connectionPoisoned) {
    try {
      await reserved.unsafe("SELECT pg_terminate_backend(pg_backend_pid())");
    } catch {
      // Successful self-termination closes the poisoned reserved connection.
    }
  } else {
    try {
      reserved.release();
    } catch (error) {
      cleanupError ??= error;
    }
  }
  if (primaryError !== undefined) {
    if (cleanupError !== undefined) {
      throw new AggregateError(
        [primaryError, cleanupError],
        "Recovery repository cleanup primary failure was followed by session cleanup failure",
        { cause: primaryError },
      );
    }
    throw primaryError;
  }
  if (cleanupError !== undefined) throw cleanupError;
  if (outcome === undefined) {
    throw new Error("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_CLEANUP_RESULT_MISSING");
  }
  return outcome.cleaned;
}

export async function reconcileCompletedInternalProductionRecoverySourceBootstrapRepositoriesV1(
): Promise<Readonly<{
  scanned: number;
  cleaned: number;
  failed: number;
  failures: readonly Readonly<{ runId: string; diagnostic: string }>[];
}>> {
  let cleaned = 0;
  const filesystemCensus = listInternalProductionRecoverySourceBootstrapRepositoryCleanupCandidateRunIdsV1({
    sourceRepositoryRoot: RECOVERY_SOURCE_BOOTSTRAP_SOURCE_ROOT_V1,
  });
  const failures: Array<Readonly<{ runId: string; diagnostic: string }>> = [];
  for (const diagnostic of filesystemCensus.diagnostics) {
    failures.push(Object.freeze({ runId: "unbound", diagnostic }));
  }
  const durableRows = await getSql().unsafe<Array<{
    id: string;
    context: string;
    cleanup_id: string | null;
    cleanup_run_id: string | null;
    cleanup_step_id: string | null;
    cleanup_story_id: string | null;
    cleanup_phase: string | null;
    cleanup_check_id: string | null;
    cleanup_status: string | null;
    cleanup_event_type: string | null;
    cleanup_metadata: string | null;
  }>>(
    `WITH recovery_cleanup_runs AS (
       SELECT run.id,run.context,run.updated_at AS run_updated_at,
              observation.id AS cleanup_id,
              observation.run_id AS cleanup_run_id,
              observation.step_id AS cleanup_step_id,
              observation.story_id AS cleanup_story_id,
              observation.phase AS cleanup_phase,
              observation.check_id AS cleanup_check_id,
              observation.status AS cleanup_status,
              observation.event_type AS cleanup_event_type,
              observation.metadata AS cleanup_metadata,
              observation.updated_at AS cleanup_updated_at
         FROM public.runs run
         LEFT JOIN public.run_observations observation
           ON observation.id = 'internal-production-recovery-source-bootstrap-repository-cleanup-v1:' || run.id
        WHERE run.status IN ('completed','failed','cancelled')
          AND run.context LIKE '%setfarm.internal-production-recovery-source-bootstrap-run-context.v1%'
     ), actionable_cleanup_candidates AS (
       SELECT * FROM recovery_cleanup_runs
        WHERE cleanup_id IS NULL
           OR (
             cleanup_run_id IS NOT DISTINCT FROM id
             AND cleanup_step_id IS NOT DISTINCT FROM 'run'
             AND cleanup_story_id IS NOT DISTINCT FROM ''
             AND cleanup_phase IS NOT DISTINCT FROM 'operations'
             AND cleanup_check_id IS NOT DISTINCT FROM 'recovery-source-bootstrap.repository-cleanup'
             AND cleanup_event_type IS NOT DISTINCT FROM 'recovery-source-bootstrap.repository-cleanup'
             AND (
               (
                 cleanup_status IS NOT DISTINCT FROM 'retry'
                 AND cleanup_metadata IS NOT DISTINCT FROM jsonb_build_object(
                   'completionReleased',false,'runContext',context
                 )::text
                 AND cleanup_updated_at <= NOW() - INTERVAL '5 minutes'
               )
               OR (
                 cleanup_status IS NOT DISTINCT FROM 'pass'
                 AND cleanup_metadata IS NOT DISTINCT FROM jsonb_build_object(
                   'completionReleased',false,'runContext',context
                 )::text
               )
             )
           )
        ORDER BY COALESCE(cleanup_updated_at,run_updated_at) ASC,id ASC
        LIMIT 100
     ), crossed_cleanup_receipts AS (
       SELECT * FROM recovery_cleanup_runs
        WHERE cleanup_id IS NOT NULL
          AND NOT (
            cleanup_run_id IS NOT DISTINCT FROM id
            AND cleanup_step_id IS NOT DISTINCT FROM 'run'
            AND cleanup_story_id IS NOT DISTINCT FROM ''
            AND cleanup_phase IS NOT DISTINCT FROM 'operations'
            AND cleanup_check_id IS NOT DISTINCT FROM 'recovery-source-bootstrap.repository-cleanup'
            AND cleanup_event_type IS NOT DISTINCT FROM 'recovery-source-bootstrap.repository-cleanup'
            AND (
              (
                cleanup_status IS NOT DISTINCT FROM 'retry'
                AND cleanup_metadata IS NOT DISTINCT FROM jsonb_build_object(
                  'completionReleased',false,'runContext',context
                )::text
              )
              OR (
                cleanup_status IS NOT DISTINCT FROM 'pass'
                AND cleanup_metadata IN (
                  jsonb_build_object('completionReleased',false,'runContext',context)::text,
                  jsonb_build_object('completionReleased',true,'runContext',context)::text
                )
              )
            )
          )
        ORDER BY COALESCE(cleanup_updated_at,run_updated_at) ASC,id ASC
        LIMIT 100
     )
     SELECT * FROM actionable_cleanup_candidates
     UNION ALL
     SELECT * FROM crossed_cleanup_receipts`,
    [],
  );
  const invalidDurableRunIds = new Set<string>();
  for (const row of durableRows) {
    if (
      !/^[0-9a-f]{64}$/.test(row.id)
      || typeof row.context !== "string"
    ) throw new Error("RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_CLEANUP_CENSUS_INVALID");
    let cleanupMetadata: Readonly<Record<string, unknown>> | null = null;
    try {
      cleanupMetadata = JSON.parse(row.cleanup_metadata ?? "null") as Readonly<Record<string, unknown>> | null;
    } catch {
      cleanupMetadata = null;
    }
    if (
      row.cleanup_id !== null
      && (
        row.cleanup_id !== `${RECOVERY_SOURCE_BOOTSTRAP_CLEANUP_RECEIPT_PREFIX_V1}${row.id}`
        || row.cleanup_run_id !== row.id
        || row.cleanup_step_id !== "run"
        || row.cleanup_story_id !== ""
        || row.cleanup_phase !== "operations"
        || row.cleanup_check_id !== RECOVERY_SOURCE_BOOTSTRAP_CLEANUP_CHECK_V1
        || !["pass", "retry"].includes(row.cleanup_status ?? "")
        || row.cleanup_event_type !== RECOVERY_SOURCE_BOOTSTRAP_CLEANUP_CHECK_V1
        || cleanupMetadata === null
        || typeof cleanupMetadata !== "object"
        || Object.keys(cleanupMetadata).sort().join(",") !== "completionReleased,runContext"
        || cleanupMetadata.completionReleased !== false
        || cleanupMetadata.runContext !== row.context
      )
    ) {
      invalidDurableRunIds.add(row.id);
      failures.push(Object.freeze({
        runId: row.id,
        diagnostic: "RECOVERY_SOURCE_BOOTSTRAP_REPOSITORY_CLEANUP_RECEIPT_CROSSED",
      }));
    }
  }
  const candidateSet = new Set(filesystemCensus.runIds);
  for (const runId of invalidDurableRunIds) candidateSet.delete(runId);
  for (const row of durableRows) {
    if (invalidDurableRunIds.has(row.id)) continue;
    candidateSet.add(row.id);
  }
  const candidates = Object.freeze([...candidateSet].sort());
  for (const runId of candidates) {
    try {
      if (await cleanupCompletedInternalProductionRecoverySourceBootstrapRepositoryV1({ runId })) {
        cleaned += 1;
      }
    } catch (error) {
      const diagnostic = String(error).slice(0, 300);
      try {
        await recordRecoverySourceBootstrapCleanupReceiptV1({ runId, status: "retry", diagnostic });
      } catch (receiptError) {
        failures.push(Object.freeze({ runId, diagnostic: String(receiptError).slice(0, 300) }));
        continue;
      }
      failures.push(Object.freeze({ runId, diagnostic }));
    }
  }
  return Object.freeze({
    scanned: candidates.length,
    cleaned,
    failed: failures.length,
    failures: Object.freeze(failures),
  });
}
