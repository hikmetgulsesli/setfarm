import type postgres from "postgres";

import { readDatabaseWallClock } from "../db/database-wall-clock.js";
import { isClaimMutationAuthorityError } from "./claim-mutation-authority.js";
import { withdrawPreDispatchClaimInTransaction } from "./pre-dispatch-withdrawal-authority.js";

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
    let withdrawal: Awaited<ReturnType<typeof withdrawPreDispatchClaimInTransaction>>;
    try {
      withdrawal = await withdrawPreDispatchClaimInTransaction(transaction, {
        identity: {
          claimId: input.claimId,
          runId: input.runId,
          workflowStepId: input.stepId,
          storyId: input.storyId,
          claimAgentId: input.claimAgentId,
        },
        outcome: "infra_retry",
        diagnostic: input.diagnostic,
        preserveExactAttempt: true,
      });
    } catch (error) {
      if (
        isClaimMutationAuthorityError(error)
        && error instanceof Error
        && error.message.startsWith("CLAIM_MUTATION_DURABLE_OWNER_ACTIVE:runtime_session:")
      ) {
        const state = error.message.split(":")[2] || "unknown";
        return {
          status: "blocked" as const,
          reason: `COMPILER_CLAIM_RUNTIME_ALREADY_STARTED:${state}`,
        };
      }
      throw error;
    }
    if (withdrawal.status !== "withdrawn") return withdrawal;
    const now = await readDatabaseWallClock(
      transaction,
      "COMPILER_CLAIM_FENCE_DATABASE_TIME_UNAVAILABLE",
    );
    const stories = await transaction.unsafe<Array<{ id: string }>>(
      `UPDATE stories
          SET status = 'pending', claimed_by = NULL, claimed_at = NULL, updated_at = $5
        WHERE id = $1
          AND run_id = $2
          AND story_id = $3
          AND status = 'running'
          AND claimed_by = $4
        RETURNING id`,
      [input.storyDbId, input.runId, input.storyId, input.claimAgentId, now],
    );
    if (stories.length !== 1) throw new Error("COMPILER_CLAIM_STORY_REQUEUE_CAS_LOST");
    const steps = await transaction.unsafe<Array<{ id: string }>>(
      `UPDATE steps
          SET status = 'pending', current_story_id = NULL, updated_at = $4
        WHERE run_id = $1
          AND step_id = $2
          AND current_story_id = $3
          AND status = 'running'
        RETURNING id`,
      [input.runId, input.stepId, input.storyDbId, now],
    );
    if (steps.length !== 1) throw new Error("COMPILER_CLAIM_STEP_REQUEUE_CAS_LOST");
    return { status: "reverted" as const };
  }) as Promise<CompilerClaimFenceResult>;
}
