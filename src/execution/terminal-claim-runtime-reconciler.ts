import type postgres from "postgres";

import {
  createRuntimeSessionRepository,
  releaseDrainedRuntimeSessionInTransaction,
  type ClaimRuntimeSession,
} from "./runtime-session-repository.js";

const DEFAULT_RECONCILE_LIMIT = 50;

export type TerminalClaimRuntimeCandidate = Readonly<{
  sessionId: string;
  runId: string;
  claimId: number;
  claimOutcome: string;
  ownerInstanceId: string;
}>;

export type TerminalClaimRuntimeReconcileEvent = Readonly<{
  code:
    | "TERMINAL_CLAIM_RUNTIME_RELEASED"
    | "TERMINAL_CLAIM_RUNTIME_ALREADY_SETTLED"
    | "TERMINAL_CLAIM_RUNTIME_RECONCILE_FAILED";
  sessionId: string;
  runId: string;
  claimId: number;
  claimOutcome: string;
  diagnostic?: string;
}>;

export type TerminalClaimRuntimeReconcilerDependencies = Readonly<{
  listCandidates(input: Readonly<{ limit: number }>): Promise<TerminalClaimRuntimeCandidate[]>;
  requestDrain(candidate: TerminalClaimRuntimeCandidate): Promise<ClaimRuntimeSession>;
  drain(
    session: ClaimRuntimeSession,
    candidate: TerminalClaimRuntimeCandidate,
  ): Promise<void>;
  findSession(sessionId: string): Promise<ClaimRuntimeSession | undefined>;
  release(
    session: ClaimRuntimeSession,
    candidate: TerminalClaimRuntimeCandidate,
  ): Promise<ClaimRuntimeSession>;
  emit(event: TerminalClaimRuntimeReconcileEvent): void | Promise<void>;
}>;

export type TerminalClaimRuntimeReconcileResult = Readonly<{
  scanned: number;
  released: number;
  alreadySettled: number;
  failed: number;
}>;

function boundedLimit(value: number | undefined): number {
  if (!Number.isFinite(value)) return DEFAULT_RECONCILE_LIMIT;
  return Math.max(1, Math.min(500, Math.trunc(value!)));
}

async function safeEmit(
  emit: TerminalClaimRuntimeReconcilerDependencies["emit"],
  event: TerminalClaimRuntimeReconcileEvent,
): Promise<void> {
  try {
    await emit(event);
  } catch {
    // Runtime fencing and release are authoritative; diagnostics are best-effort.
  }
}

/**
 * Repairs the exact invariant produced when a claim reaches a terminal outcome
 * after its process has gone away but before its durable runtime owner is
 * drained and released. This is intentionally not a claim retry owner: it only
 * settles the already-terminal claim's runtime, allowing the normal claim
 * publisher to decide whether new work may start.
 */
export async function reconcileTerminalClaimRuntimes(
  input: Readonly<{ limit?: number }>,
  dependencies: TerminalClaimRuntimeReconcilerDependencies,
): Promise<TerminalClaimRuntimeReconcileResult> {
  const candidates = await dependencies.listCandidates({ limit: boundedLimit(input.limit) });
  let released = 0;
  let alreadySettled = 0;
  let failed = 0;

  for (const candidate of candidates) {
    try {
      const current = await dependencies.findSession(candidate.sessionId);
      if (!current || current.state === "released") {
        alreadySettled += 1;
        await safeEmit(dependencies.emit, {
          code: "TERMINAL_CLAIM_RUNTIME_ALREADY_SETTLED",
          ...candidate,
        });
        continue;
      }

      const requested = current.state === "drained"
        ? current
        : await dependencies.requestDrain(candidate);
      if (requested.state !== "drained") {
        await dependencies.drain(requested, candidate);
      }

      const drained = await dependencies.findSession(candidate.sessionId);
      if (!drained || drained.state === "released") {
        alreadySettled += 1;
        await safeEmit(dependencies.emit, {
          code: "TERMINAL_CLAIM_RUNTIME_ALREADY_SETTLED",
          ...candidate,
        });
        continue;
      }
      if (drained.state !== "drained") {
        throw new Error(`TERMINAL_CLAIM_RUNTIME_NOT_DRAINED:${drained.state}`);
      }

      await dependencies.release(drained, candidate);
      released += 1;
      await safeEmit(dependencies.emit, {
        code: "TERMINAL_CLAIM_RUNTIME_RELEASED",
        ...candidate,
      });
    } catch (error) {
      const settledAfterRace = await dependencies.findSession(candidate.sessionId).catch(() => undefined);
      if (!settledAfterRace || settledAfterRace.state === "released") {
        alreadySettled += 1;
        await safeEmit(dependencies.emit, {
          code: "TERMINAL_CLAIM_RUNTIME_ALREADY_SETTLED",
          ...candidate,
        });
        continue;
      }
      failed += 1;
      await safeEmit(dependencies.emit, {
        code: "TERMINAL_CLAIM_RUNTIME_RECONCILE_FAILED",
        ...candidate,
        diagnostic: String(error).slice(0, 500),
      });
    }
  }

  return { scanned: candidates.length, released, alreadySettled, failed };
}

type CandidateRow = Readonly<{
  session_id: string;
  run_id: string;
  claim_id: string;
  claim_outcome: string;
  owner_instance_id: string;
}>;

export function createPostgresTerminalClaimRuntimeReconciler(
  sql: postgres.Sql,
  options: Readonly<{
    drain(
      session: ClaimRuntimeSession,
      candidate: TerminalClaimRuntimeCandidate,
    ): Promise<void>;
    emit?: (event: TerminalClaimRuntimeReconcileEvent) => void | Promise<void>;
  }>,
) {
  const sessions = createRuntimeSessionRepository(sql);
  const dependencies: TerminalClaimRuntimeReconcilerDependencies = {
    async listCandidates({ limit }) {
      const rows = await sql.unsafe<CandidateRow[]>(
        `SELECT runtime.session_id,
                runtime.run_id,
                runtime.claim_id::text,
                claim.outcome AS claim_outcome,
                runtime.owner_instance_id
           FROM runtime_sessions runtime
           JOIN claim_log claim
             ON claim.id = runtime.claim_id
            AND claim.run_id = runtime.run_id
          WHERE claim.outcome IS NOT NULL
            AND runtime.state IN ('reserved', 'starting', 'running', 'drain_requested', 'drained')
            AND NOT EXISTS (
              SELECT 1
                FROM execution_attempts attempt
               WHERE attempt.claim_id = claim.id
                 AND attempt.disposition IN ('claimed', 'running')
            )
            AND NOT EXISTS (
              SELECT 1
                FROM runtime_completion_requests completion
               WHERE completion.runtime_session_id = runtime.session_id
                 AND completion.state IN ('requested', 'draining', 'processing')
            )
            AND NOT EXISTS (
              SELECT 1
                FROM recovery_dispatch_deliveries recovery_delivery
               WHERE recovery_delivery.claim_id = claim.id
                 AND recovery_delivery.state IN ('authorized', 'leased', 'attempt_reserved', 'running')
            )
            AND NOT EXISTS (
              SELECT 1
                FROM run_termination_requests termination
               WHERE termination.run_id = runtime.run_id
                 AND termination.state <> 'terminalized'
            )
          ORDER BY runtime.updated_at ASC, runtime.session_id ASC
          LIMIT $1`,
        [limit],
      );
      return rows.flatMap((row): TerminalClaimRuntimeCandidate[] => {
        const claimId = Number(row.claim_id);
        if (!Number.isSafeInteger(claimId) || claimId <= 0 || !row.claim_outcome) return [];
        return [{
          sessionId: row.session_id,
          runId: row.run_id,
          claimId,
          claimOutcome: row.claim_outcome,
          ownerInstanceId: row.owner_instance_id,
        }];
      });
    },
    findSession: (sessionId) => sessions.findById(sessionId),
    requestDrain: (candidate) => sessions.requestDrain({
      sessionId: candidate.sessionId,
      ownerInstanceId: candidate.ownerInstanceId,
      diagnostic: `Terminal claim ${candidate.claimId} (${candidate.claimOutcome}) retained an active durable runtime; proving absence before release`,
    }),
    drain: options.drain,
    release: (session, candidate) => sql.begin((transaction) =>
      releaseDrainedRuntimeSessionInTransaction(transaction, {
        sessionId: session.sessionId,
        claimId: candidate.claimId,
        ownerInstanceId: candidate.ownerInstanceId,
      })) as Promise<ClaimRuntimeSession>,
    emit: options.emit ?? (() => undefined),
  };

  return Object.freeze({
    reconcile: (input: Readonly<{ limit?: number }> = {}) =>
      reconcileTerminalClaimRuntimes(input, dependencies),
  });
}
