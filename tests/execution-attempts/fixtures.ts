export const HASH_A = "a".repeat(64);
export const HASH_B = "b".repeat(64);
export const HASH_C = "c".repeat(64);
export const HASH_D = "d".repeat(64);
export const SHA_A = "1".repeat(40);
export const SHA_B = "2".repeat(40);
export const TREE_A = "3".repeat(40);
export const TREE_B = "4".repeat(40);

export function exactProductReservation(overrides: Record<string, unknown> = {}) {
  return {
    runId: "run-contract-1",
    stepId: "implement",
    storyId: "US-002",
    attemptClass: "product_implementation" as const,
    packetHash: HASH_A,
    compilationReportHash: HASH_B,
    sliceHash: HASH_C,
    sourceBefore: { sha: SHA_A, treeHash: TREE_A },
    findingSetHash: HASH_D,
    role: "developer",
    agentId: "feature-dev",
    branch: "story/us-002",
    worktree: ".worktrees/us-002",
    evidenceRefs: [],
    ...overrides,
  };
}

export async function insertOpenClaim(
  sql: Readonly<{ unsafe<T extends readonly unknown[] = readonly unknown[]>(query: string, params?: readonly unknown[]): Promise<T> }>,
  overrides: Readonly<{
    runId?: string;
    stepId?: string;
    storyId?: string;
    agentId?: string;
  }> = {},
): Promise<number> {
  const runId = overrides.runId ?? "run-contract-1";
  const stepId = overrides.stepId ?? "implement";
  const storyId = overrides.storyId ?? "US-002";
  const agentId = overrides.agentId ?? "feature-dev";
  const rows = await sql.unsafe<Array<{ id: string }>>(
    `INSERT INTO claim_log (run_id, step_id, story_id, agent_id)
     VALUES ($1, $2, $3, $4)
     RETURNING id::text AS id`,
    [runId, stepId, storyId, agentId],
  );
  const claimId = Number(rows[0]?.id);
  if (!Number.isSafeInteger(claimId) || claimId <= 0) throw new Error("TEST_CLAIM_ID_INVALID");
  return claimId;
}

export function bindReservationToClaim(
  reservation: Record<string, unknown>,
  claimId: number,
): Record<string, unknown> {
  const refs = Array.isArray(reservation.evidenceRefs)
    ? reservation.evidenceRefs.filter(
      (ref): ref is string => typeof ref === "string" && !/^setfarm:\/\/claim-log\//.test(ref),
    )
    : [];
  return {
    ...reservation,
    claimId,
    evidenceRefs: [...refs, `setfarm://claim-log/${claimId}`],
  };
}

export async function exactBoundProductReservation(
  sql: Parameters<typeof insertOpenClaim>[0],
  overrides: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const reservation = exactProductReservation(overrides);
  const claimId = await insertOpenClaim(sql, {
    runId: String(reservation.runId),
    stepId: String(reservation.stepId),
    storyId: String(reservation.storyId),
    agentId: String(reservation.agentId),
  });
  return bindReservationToClaim(reservation, claimId);
}
