import type postgres from "postgres";

import { releaseReservedRuntimeSessionInTransaction } from "./runtime-session-repository.js";

type Sql = postgres.Sql;

type ClaimRow = {
  id: string;
  outcome: string | null;
  protocol: string;
  run_status: string;
};

type AttemptRow = {
  attempt_id: string;
  claim_id: string | null;
  generation: number;
  fence_token: string;
  agent_id: string | null;
};

type RuntimeRow = {
  session_id: string;
  owner_instance_id: string;
  state: string;
};

export type CompilerClaimFenceResult =
  | Readonly<{
    status: "fenced";
    attempt: { attemptId: string; generation: number; fenceToken: string };
  }>
  | Readonly<{ status: "reverted" }>
  | Readonly<{ status: "blocked"; reason: string }>;

/**
 * Fail-closed bridge for the legacy claim publication window.
 *
 * Shadow observation is deliberately non-authoritative and can return an
 * error after the attempt was actually reserved. Before a compiler claim is
 * handed to a runtime, recover that exact fence or atomically withdraw the
 * unfenced claim. An unrelated active fence keeps the story non-retryable so
 * a second runtime cannot be launched against the same source.
 */
export async function ensureCompilerClaimFence(
  sql: Sql,
  input: Readonly<{
    claimId: number;
    runId: string;
    stepId: string;
    storyId: string;
    storyDbId: string;
    claimAgentId: string;
    diagnostic: string;
  }>,
): Promise<CompilerClaimFenceResult> {
  if (!Number.isSafeInteger(input.claimId) || input.claimId <= 0) {
    throw new Error("COMPILER_CLAIM_ID_INVALID");
  }
  return sql.begin(async (transaction) => {
    const claims = await transaction.unsafe<ClaimRow[]>(
      `SELECT cl.id::text, cl.outcome, r.protocol, r.status AS run_status
         FROM claim_log cl
         JOIN runs r ON r.id = cl.run_id
        WHERE cl.id = $1
          AND cl.run_id = $2
          AND cl.step_id = $3
          AND cl.story_id = $4
          AND cl.agent_id = $5
        FOR UPDATE OF cl`,
      [input.claimId, input.runId, input.stepId, input.storyId, input.claimAgentId],
    );
    const claim = claims[0];
    if (!claim) throw new Error("COMPILER_CLAIM_IDENTITY_MISMATCH");
    if (claim.protocol === "legacy") throw new Error("COMPILER_CLAIM_PROTOCOL_LEGACY");

    const attempts = await transaction.unsafe<AttemptRow[]>(
      `SELECT attempt_id, claim_id::text, generation, fence_token, agent_id
         FROM execution_attempts
        WHERE run_id = $1
          AND step_id = $2
          AND story_id = $3
          AND disposition IN ('claimed', 'running')
        FOR UPDATE`,
      [input.runId, input.stepId, input.storyId],
    );
    if (attempts.length > 1) throw new Error("COMPILER_CLAIM_ACTIVE_FENCE_AMBIGUOUS");
    const attempt = attempts[0];
    const exactAttempt = attempt
      && attempt.claim_id === String(input.claimId)
      && (attempt.agent_id === null || attempt.agent_id === input.claimAgentId);

    if (claim.outcome === null && exactAttempt) {
      return {
        status: "fenced" as const,
        attempt: {
          attemptId: attempt.attempt_id,
          generation: attempt.generation,
          fenceToken: attempt.fence_token,
        },
      };
    }
    if (claim.outcome !== null) {
      return { status: "blocked" as const, reason: "COMPILER_CLAIM_ALREADY_TERMINAL" };
    }

    const runtimes = await transaction.unsafe<RuntimeRow[]>(
      `SELECT session_id, owner_instance_id, state
         FROM runtime_sessions
        WHERE claim_id = $1
        FOR UPDATE`,
      [input.claimId],
    );
    if (runtimes.length > 1) throw new Error("COMPILER_CLAIM_RUNTIME_AMBIGUOUS");
    const runtime = runtimes[0];
    if (runtime && !["reserved", "released"].includes(runtime.state)) {
      return { status: "blocked" as const, reason: `COMPILER_CLAIM_RUNTIME_ALREADY_STARTED:${runtime.state}` };
    }

    await transaction.unsafe(
      `UPDATE claim_log
          SET outcome = 'infra_retry',
              abandoned_at = NOW(),
              duration_ms = LEAST(CAST(EXTRACT(EPOCH FROM (NOW() - claimed_at::timestamptz)) * 1000 AS BIGINT), 2147483647)::INTEGER,
              diagnostic = $2
        WHERE id = $1 AND outcome IS NULL`,
      [input.claimId, input.diagnostic],
    );

    if (runtime?.state === "reserved") {
      await releaseReservedRuntimeSessionInTransaction(transaction, {
        sessionId: runtime.session_id,
        claimId: input.claimId,
        ownerInstanceId: runtime.owner_instance_id,
        diagnostic: input.diagnostic,
      });
    }

    if (attempt) {
      return { status: "blocked" as const, reason: "COMPILER_CLAIM_DIFFERENT_ACTIVE_FENCE" };
    }
    if (!["running", "resuming"].includes(claim.run_status)) {
      return { status: "blocked" as const, reason: "COMPILER_CLAIM_RUN_TERMINAL" };
    }
    await transaction.unsafe(
      `UPDATE stories
          SET status = 'pending', claimed_by = NULL, claimed_at = NULL, updated_at = NOW()
        WHERE id = $1
          AND run_id = $2
          AND story_id = $3
          AND status = 'running'
          AND claimed_by = $4`,
      [input.storyDbId, input.runId, input.storyId, input.claimAgentId],
    );
    await transaction.unsafe(
      `UPDATE steps
          SET status = 'pending', current_story_id = NULL, updated_at = NOW()
        WHERE run_id = $1
          AND step_id = $2
          AND current_story_id = $3
          AND status = 'running'`,
      [input.runId, input.stepId, input.storyDbId],
    );
    return { status: "reverted" as const };
  }) as Promise<CompilerClaimFenceResult>;
}
