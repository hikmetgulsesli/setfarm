import type postgres from "postgres";

import { readDatabaseWallClock } from "../db/database-wall-clock.js";
import { createAttemptRepository } from "./attempt-repository.js";
import type {
  ExecutionAttemptV1,
  TerminalAttemptDispositionV1,
} from "./schemas/execution-attempt-v1.js";

const DEFAULT_RECONCILE_LIMIT = 50;
const DEFAULT_RECONCILE_GRACE_MS = 15_000;

export type TerminalAttemptCandidate = Readonly<{
  attempt: ExecutionAttemptV1;
  claimId: number;
  claimOutcome: string;
}>;

export type TerminalAttemptReconcileEvent = Readonly<{
  code:
    | "ATTEMPT_TERMINAL_RECONCILED"
    | "ATTEMPT_TERMINAL_RECONCILE_RACED"
    | "ATTEMPT_TERMINAL_RECONCILE_FAILED";
  attemptId: string;
  runId: string;
  stepId: string;
  storyId: string;
  claimId: number;
  claimOutcome: string;
  requestedDisposition: TerminalAttemptDispositionV1;
}>;

type CompleteInput = Readonly<{
  attemptId: string;
  generation: number;
  fenceToken: string;
  runId: string;
  stepId: string;
  storyId: string;
  claimId: number;
  claimOutcome: string;
  disposition: TerminalAttemptDispositionV1;
  evidenceRefs: string[];
}>;

type TerminalAttemptCompletionResult =
  | Readonly<{ status: "completed" }>
  | Readonly<{ status: "stale_fence" }>;

export type TerminalAttemptReconcilerDependencies = Readonly<{
  listCandidates(input: Readonly<{ limit: number }>): Promise<TerminalAttemptCandidate[]>;
  complete(input: CompleteInput): Promise<TerminalAttemptCompletionResult>;
  emit(event: TerminalAttemptReconcileEvent): void | Promise<void>;
}>;

export type TerminalAttemptReconcileResult = Readonly<{
  scanned: number;
  reconciled: number;
  raced: number;
  failed: number;
}>;

async function safeEmit(
  emit: TerminalAttemptReconcilerDependencies["emit"],
  event: TerminalAttemptReconcileEvent,
): Promise<void> {
  try {
    await emit(event);
  } catch {
    // Reconciliation fencing is authoritative; diagnostics are best-effort.
  }
}

function boundedLimit(value: number | undefined): number {
  if (!Number.isFinite(value)) return DEFAULT_RECONCILE_LIMIT;
  return Math.max(1, Math.min(500, Math.trunc(value!)));
}

function normalizeOutcome(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "_");
  return normalized.slice(0, 80) || "unknown";
}

function terminalDisposition(outcome: string): TerminalAttemptDispositionV1 {
  return normalizeOutcome(outcome) === "failed" ? "failed" : "inconclusive";
}

/**
 * Bounded safety-net for split legacy transitions.
 *
 * Normal success/failure hooks remain the precise source-revision observers.
 * This owner only closes an attempt after its exact legacy claim is terminal
 * and the normal hook missed it. A successful legacy claim is therefore
 * `inconclusive`, not fabricated as `produced_delta` or `already_satisfied`.
 */
export async function reconcileTerminalClaimAttempts(
  input: Readonly<{ limit?: number }>,
  dependencies: TerminalAttemptReconcilerDependencies,
): Promise<TerminalAttemptReconcileResult> {
  const candidates = await dependencies.listCandidates({ limit: boundedLimit(input.limit) });
  let reconciled = 0;
  let raced = 0;
  let failed = 0;

  for (const candidate of candidates) {
    const disposition = terminalDisposition(candidate.claimOutcome);
    const reconciliationRef = `setfarm://attempt-reconciler/claim-terminal/${normalizeOutcome(candidate.claimOutcome)}`;
    const evidenceRefs = [...new Set([
      ...candidate.attempt.evidenceRefs,
      reconciliationRef,
    ])].sort();
    const eventBase = {
      attemptId: candidate.attempt.attemptId,
      runId: candidate.attempt.runId,
      stepId: candidate.attempt.stepId,
      storyId: candidate.attempt.storyId,
      claimId: candidate.claimId,
      claimOutcome: candidate.claimOutcome,
      requestedDisposition: disposition,
    } as const;
    try {
      const result = await dependencies.complete({
        attemptId: candidate.attempt.attemptId,
        generation: candidate.attempt.generation,
        fenceToken: candidate.attempt.fenceToken,
        runId: candidate.attempt.runId,
        stepId: candidate.attempt.stepId,
        storyId: candidate.attempt.storyId,
        claimId: candidate.claimId,
        claimOutcome: candidate.claimOutcome,
        disposition,
        evidenceRefs,
      });
      if (result.status === "stale_fence") {
        raced++;
        await safeEmit(dependencies.emit, { code: "ATTEMPT_TERMINAL_RECONCILE_RACED", ...eventBase });
      } else {
        reconciled++;
        await safeEmit(dependencies.emit, { code: "ATTEMPT_TERMINAL_RECONCILED", ...eventBase });
      }
    } catch {
      failed++;
      await safeEmit(dependencies.emit, { code: "ATTEMPT_TERMINAL_RECONCILE_FAILED", ...eventBase });
    }
  }

  return Object.freeze({
    scanned: candidates.length,
    reconciled,
    raced,
    failed,
  });
}

type CandidateRow = Readonly<{
  attempt_id: string;
  claim_id: string;
  claim_outcome: string;
}>;

/**
 * Close one missed shadow attempt only after durable claim and runtime state
 * prove that no worker can still own it. This is intentionally separate from
 * the normal attempt `complete` path: a worker must hold a live lease, while
 * this bounded recovery owner is useful precisely after that lease expired or
 * after the manager proved runtime drain.
 */
async function completeTerminalAttemptForRecovery(
  sql: postgres.Sql,
  input: CompleteInput,
  runtimeQuiesced: boolean,
): Promise<TerminalAttemptCompletionResult> {
  return sql.begin(async (transaction) => {
    const runs = await transaction.unsafe<Array<{ protocol: string }>>(
      "SELECT protocol FROM runs WHERE id = $1 FOR UPDATE",
      [input.runId],
    );
    if (runs[0]?.protocol !== "shadow") return { status: "stale_fence" as const };
    await transaction.unsafe(
      `SELECT request_id FROM run_termination_requests
        WHERE run_id = $1 AND state <> 'terminalized'
        ORDER BY requested_at, request_id
        FOR UPDATE`,
      [input.runId],
    );
    const runtimes = await transaction.unsafe<Array<{ state: string }>>(
      `SELECT state FROM runtime_sessions
        WHERE claim_id = $1
        ORDER BY session_id
        FOR UPDATE`,
      [input.claimId],
    );
    if (runtimes.some((runtime) => !["drained", "released"].includes(runtime.state))) {
      return { status: "stale_fence" as const };
    }
    const attempts = await transaction.unsafe<Array<{
      claim_id: string | number | null;
      run_id: string;
      step_id: string;
      story_id: string;
      agent_id: string | null;
      disposition: string;
      lease_expires_at: Date | string;
    }>>(
      `SELECT claim_id, run_id, step_id, story_id, agent_id, disposition, lease_expires_at
         FROM execution_attempts
        WHERE attempt_id = $1 AND generation = $2 AND fence_token = $3
        FOR UPDATE`,
      [input.attemptId, input.generation, input.fenceToken],
    );
    const attempt = attempts[0];
    if (
      !attempt
      || Number(attempt.claim_id) !== input.claimId
      || attempt.run_id !== input.runId
      || attempt.step_id !== input.stepId
      || attempt.story_id !== input.storyId
      || !["claimed", "running"].includes(attempt.disposition)
    ) return { status: "stale_fence" as const };
    const claims = await transaction.unsafe<Array<{
      run_id: string;
      step_id: string;
      story_id: string | null;
      agent_id: string;
      outcome: string | null;
    }>>(
      `SELECT run_id, step_id, story_id, agent_id, outcome
         FROM claim_log
        WHERE id = $1
        FOR UPDATE`,
      [input.claimId],
    );
    const claim = claims[0];
    if (
      !claim
      || claim.run_id !== input.runId
      || claim.step_id !== input.stepId
      || (claim.story_id ?? "") !== input.storyId
      || claim.outcome !== input.claimOutcome
      || (attempt.agent_id !== null && attempt.agent_id !== claim.agent_id)
    ) return { status: "stale_fence" as const };
    const now = await readDatabaseWallClock(
      transaction,
      "ATTEMPT_RECONCILER_DATABASE_TIME_UNAVAILABLE",
    );
    if (
      !runtimeQuiesced
      && new Date(attempt.lease_expires_at).getTime() > now.getTime()
    ) return { status: "stale_fence" as const };
    const rows = await transaction.unsafe<Array<{ attempt_id: string }>>(
      `UPDATE execution_attempts
          SET disposition = $4,
              evidence_refs = $5,
              heartbeat_at = $6,
              updated_at = $6
        WHERE attempt_id = $1
          AND generation = $2
          AND fence_token = $3
          AND disposition IN ('claimed', 'running')
          AND ($7::boolean OR lease_expires_at <= $6)
        RETURNING attempt_id`,
      [
        input.attemptId,
        input.generation,
        input.fenceToken,
        input.disposition,
        JSON.stringify(input.evidenceRefs),
        now,
        runtimeQuiesced,
      ],
    );
    return rows.length === 1
      ? { status: "completed" as const }
      : { status: "stale_fence" as const };
  }) as Promise<TerminalAttemptCompletionResult>;
}

export function createPostgresTerminalAttemptReconciler(
  sql: postgres.Sql,
  options: Readonly<{
    graceMs?: number;
    emit?: (event: TerminalAttemptReconcileEvent) => void | Promise<void>;
  }> = {},
) {
  const repository = createAttemptRepository(sql);
  const graceMs = Number.isFinite(options.graceMs)
    ? Math.max(0, Math.min(300_000, Math.trunc(options.graceMs!)))
    : DEFAULT_RECONCILE_GRACE_MS;
  const listCandidates = async (
    limit: number,
    candidateGraceMs: number,
    claimId?: number,
    runtimeQuiesced = false,
  ): Promise<TerminalAttemptCandidate[]> => {
    const rows = await sql.unsafe<CandidateRow[]>(
        `SELECT ea.attempt_id,
                cl.id::text AS claim_id,
                cl.outcome AS claim_outcome
           FROM execution_attempts ea
           JOIN claim_log cl
             ON cl.id = ea.claim_id
           JOIN runs r
             ON r.id = ea.run_id
            AND r.protocol = 'shadow'
          WHERE ea.disposition IN ('claimed', 'running')
            AND cl.outcome IS NOT NULL
            AND cl.run_id = ea.run_id
            AND cl.step_id = ea.step_id
            AND COALESCE(cl.story_id, '') = ea.story_id
            AND (ea.agent_id IS NULL OR cl.agent_id = ea.agent_id)
            AND COALESCE(
                  cl.abandoned_at,
                  cl.claimed_at + (COALESCE(cl.duration_ms, 0)::text || ' milliseconds')::interval
                ) <= clock_timestamp() - ($1::bigint * interval '1 millisecond')
            AND ($3::bigint IS NULL OR cl.id = $3::bigint)
            AND ($4::boolean OR ea.lease_expires_at <= clock_timestamp())
          ORDER BY ea.attempt_id
          LIMIT $2`,
        [candidateGraceMs, limit, claimId ?? null, runtimeQuiesced],
      );
    const candidates: TerminalAttemptCandidate[] = [];
    for (const row of rows) {
      const claimId = Number(row.claim_id);
      if (!Number.isSafeInteger(claimId) || claimId <= 0 || !row.claim_outcome) continue;
      const attempt = await repository.findById(row.attempt_id);
      if (!attempt || !["claimed", "running"].includes(attempt.disposition)) continue;
      candidates.push({ attempt, claimId, claimOutcome: row.claim_outcome });
    }
    return candidates;
  };
  const dependencies: TerminalAttemptReconcilerDependencies = {
    listCandidates: async ({ limit }) => listCandidates(limit, graceMs),
    complete: async (completion) => completeTerminalAttemptForRecovery(sql, completion, false),
    emit: options.emit ?? (() => undefined),
  };
  return Object.freeze({
    reconcile: (input: Readonly<{ limit?: number }> = {}) =>
      reconcileTerminalClaimAttempts(input, dependencies),
    reconcileQuiesced: (input: Readonly<{ limit?: number; runtimeQuiesced: true }>) =>
      reconcileTerminalClaimAttempts(input, {
        ...dependencies,
        listCandidates: async ({ limit }) => listCandidates(limit, 0, undefined, input.runtimeQuiesced),
        complete: async (completion) => completeTerminalAttemptForRecovery(
          sql,
          completion,
          input.runtimeQuiesced,
        ),
      }),
    reconcileClaim: (input: Readonly<{ claimId: number; runtimeQuiesced: true }>) => {
      const { claimId } = input;
      if (!Number.isSafeInteger(claimId) || claimId <= 0) {
        throw new Error("ATTEMPT_RECONCILE_CLAIM_ID_INVALID");
      }
      return reconcileTerminalClaimAttempts({ limit: 1 }, {
        ...dependencies,
        listCandidates: async () => listCandidates(1, 0, claimId, input.runtimeQuiesced),
        complete: async (completion) => completeTerminalAttemptForRecovery(
          sql,
          completion,
          input.runtimeQuiesced,
        ),
      });
    },
  });
}
