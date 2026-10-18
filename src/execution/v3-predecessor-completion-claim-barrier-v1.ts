import type postgres from "postgres";

/** A causal wait, never an accepted-completion or English-admission authority.
 * Fixed aliases s/r are the candidate step and its run. Story/loop predecessor
 * completions do not serialize verifyEach, superviseEach or parallel stories.
 */
export const V3_PENDING_SINGLE_PREDECESSOR_COMPLETION_SQL_V1 = `(
  r.protocol = 'v3'
  AND s.status = 'pending'
  AND EXISTS (
    SELECT 1
      FROM steps predecessor
      JOIN claim_log predecessor_claim
        ON predecessor_claim.run_id = predecessor.run_id
       AND predecessor_claim.step_id = predecessor.step_id
       AND predecessor_claim.story_id IS NULL
       AND predecessor_claim.outcome = 'completed'
      JOIN runtime_completion_requests predecessor_completion
        ON predecessor_completion.claim_id = predecessor_claim.id
       AND predecessor_completion.run_id = predecessor.run_id
       AND predecessor_completion.step_db_id = predecessor.id
       AND predecessor_completion.workflow_step_id = predecessor.step_id
       AND predecessor_completion.story_db_id IS NULL
       AND predecessor_completion.story_id IS NULL
       AND predecessor_completion.attempt_id IS NULL
     WHERE predecessor.run_id = s.run_id
       AND predecessor.step_index < s.step_index
       AND predecessor.type = 'single'
       AND predecessor_completion.state IN ('requested', 'draining', 'processing')
  )
)`;

/** Caller already holds this exact run's FOR UPDATE lock. Recheck only new
 * pending publication; the caller must keep authenticated committed replays
 * before this check and all existing proof validation unchanged.
 */
export async function hasPendingV3SinglePredecessorCompletionInTransactionV1(
  transaction: postgres.TransactionSql,
  input: Readonly<{ runId: string; stepDbId: string; workflowStepId: string }>,
): Promise<boolean> {
  const rows = await transaction.unsafe<Array<{ blocked: number }>>(
    `SELECT 1 AS blocked
       FROM steps s JOIN runs r ON r.id = s.run_id
      WHERE s.run_id = $1 AND s.id = $2 AND s.step_id = $3
        AND ${V3_PENDING_SINGLE_PREDECESSOR_COMPLETION_SQL_V1}
      LIMIT 1`,
    [input.runId, input.stepDbId, input.workflowStepId],
  );
  return rows.length !== 0;
}
