import type postgres from "postgres";

import {
  createAttemptRepository,
  type FenceUpdateResult,
} from "./attempt-repository.js";
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
  disposition: TerminalAttemptDispositionV1;
  evidenceRefs: string[];
}>;

export type TerminalAttemptReconcilerDependencies = Readonly<{
  listCandidates(input: Readonly<{ limit: number }>): Promise<TerminalAttemptCandidate[]>;
  complete(input: CompleteInput): Promise<FenceUpdateResult>;
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
    const terminalBefore = new Date(Date.now() - candidateGraceMs);
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
                ) <= $1
            AND ($3::bigint IS NULL OR cl.id = $3::bigint)
            AND ($4::boolean OR ea.lease_expires_at <= NOW())
          ORDER BY ea.attempt_id
          LIMIT $2`,
        [terminalBefore, limit, claimId ?? null, runtimeQuiesced],
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
    complete: async (completion) => repository.complete(completion),
    emit: options.emit ?? (() => undefined),
  };
  return Object.freeze({
    reconcile: (input: Readonly<{ limit?: number }> = {}) =>
      reconcileTerminalClaimAttempts(input, dependencies),
    reconcileQuiesced: (input: Readonly<{ limit?: number; runtimeQuiesced: true }>) =>
      reconcileTerminalClaimAttempts(input, {
        ...dependencies,
        listCandidates: async ({ limit }) => listCandidates(limit, 0, undefined, input.runtimeQuiesced),
      }),
    reconcileClaim: (input: Readonly<{ claimId: number; runtimeQuiesced: true }>) => {
      const { claimId } = input;
      if (!Number.isSafeInteger(claimId) || claimId <= 0) {
        throw new Error("ATTEMPT_RECONCILE_CLAIM_ID_INVALID");
      }
      return reconcileTerminalClaimAttempts({ limit: 1 }, {
        ...dependencies,
        listCandidates: async () => listCandidates(1, 0, claimId, input.runtimeQuiesced),
      });
    },
  });
}
