import type postgres from "postgres";

import { readDatabaseWallClock } from "../db/database-wall-clock.js";
import { v3RecoveryStoryLockIdentity } from "./v3-recovery-claim-authority.js";

type TransactionSql = postgres.TransactionSql;

export type V3RecoveryRunMutationAuthority = Readonly<{
  protocol: "shadow" | "v3";
  observedAt: Date;
}>;

/**
 * Canonical pre-dispatch recovery writer fence.
 *
 * Every mutation that can create or retain an active recovery case, revision,
 * or delivery must acquire this authority before locking its ledger row. The
 * run terminal owner locks the same run row first, so a terminal run can never
 * gain a new active recovery owner after settlement.
 */
export async function lockV3RecoveryRunMutationAuthorityInTransaction(
  transaction: TransactionSql,
  input: Readonly<{ runId: string; storyId: string }>,
): Promise<V3RecoveryRunMutationAuthority> {
  await transaction.unsafe("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [
    v3RecoveryStoryLockIdentity(input),
  ]);
  const runs = await transaction.unsafe<Array<{ protocol: string; status: string }>>(
    "SELECT protocol, status FROM runs WHERE id = $1 FOR UPDATE",
    [input.runId],
  );
  const run = runs[0];
  if (
    !run
    || !["shadow", "v3"].includes(run.protocol)
  ) {
    throw new Error(`V3_RECOVERY_RUN_NOT_ACTIVE:${run?.protocol ?? "missing"}:${run?.status ?? "missing"}`);
  }
  const terminations = await transaction.unsafe<Array<{ request_id: string }>>(
    `SELECT request_id
       FROM run_termination_requests
      WHERE run_id = $1 AND state <> 'terminalized'
      ORDER BY requested_at, request_id
      LIMIT 1
      FOR UPDATE`,
    [input.runId],
  );
  if (terminations.length > 0) {
    throw new Error(`V3_RECOVERY_TERMINATION_PENDING:${terminations[0]!.request_id}`);
  }
  if (!["running", "resuming"].includes(run.status)) {
    throw new Error(`V3_RECOVERY_RUN_NOT_ACTIVE:${run.protocol}:${run.status}`);
  }
  const observedAt = await readDatabaseWallClock(
    transaction,
    "V3_RECOVERY_RUN_MUTATION_DATABASE_TIME_UNAVAILABLE",
  );
  return Object.freeze({
    protocol: run.protocol as "shadow" | "v3",
    observedAt,
  });
}
