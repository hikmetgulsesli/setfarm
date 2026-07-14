import type postgres from "postgres";
import { z } from "zod";

import { v3RecoveryStoryLockIdentity } from "./v3-recovery-claim-authority.js";

type Sql = postgres.Sql;
type TransactionSql = postgres.TransactionSql;

const BoundedIdentitySchema = z.string().min(1).max(500);
const AttemptIdSchema = z.string().regex(/^ATT_[A-Za-z0-9-]{16,160}$/);
const RuntimeSessionIdSchema = z.string().regex(/^RTS_[A-Za-z0-9-]{16,160}$/);
const RecoveryRevisionIdSchema = z.string().regex(/^RREV_[a-f0-9]{64}$/);
const RecoveryDispatchIdSchema = z.string().regex(/^RDISP_[a-f0-9]{64}$/);

const AttemptFenceSchema = z.object({
  attemptId: AttemptIdSchema,
  generation: z.number().int().positive(),
  fenceToken: z.string().min(16).max(500),
}).strict();

const OwnerHeartbeatBaseSchema = z.object({
  runId: BoundedIdentitySchema,
  storyId: BoundedIdentitySchema,
  claimId: z.number().int().positive(),
  revisionId: RecoveryRevisionIdSchema,
  dispatchId: RecoveryDispatchIdSchema,
  ownerInstanceId: BoundedIdentitySchema,
  leaseToken: z.string().min(16).max(500),
  attempt: AttemptFenceSchema,
}).strict();

export const V3RecoveryOwnerHeartbeatInputV1Schema = z.discriminatedUnion("kind", [
  OwnerHeartbeatBaseSchema.extend({
    kind: z.literal("model_runtime"),
    runtimeSessionId: RuntimeSessionIdSchema,
  }).strict(),
  OwnerHeartbeatBaseSchema.extend({
    kind: z.literal("evidence_only"),
  }).strict(),
]);

export type V3RecoveryOwnerHeartbeatInputV1 = z.infer<
  typeof V3RecoveryOwnerHeartbeatInputV1Schema
>;

export type V3RecoveryOwnerHeartbeatResult =
  | Readonly<{ status: "retained"; expiresAt: string }>
  | Readonly<{ status: "stale_fence"; reason: string }>;

type RuntimeOwnerRow = Readonly<{
  session_id: string;
  run_id: string;
  story_id: string | null;
  claim_id: string | number;
  attempt_id: string | null;
  owner_instance_id: string;
  state: string;
}>;

type AttemptOwnerRow = Readonly<{
  attempt_id: string;
  claim_id: string | number | null;
  run_id: string;
  step_id: string;
  story_id: string;
  attempt_class: string;
  generation: number;
  fence_token: string;
  disposition: string;
  recovery_case_revision_id: string | null;
  recovery_dispatch_id: string | null;
  lease_expires_at: Date | string;
}>;

type DeliveryOwnerRow = Readonly<{
  dispatch_id: string;
  revision_id: string;
  recovery_case_id: string;
  run_id: string;
  story_id: string;
  state: string;
  owner_instance_id: string | null;
  lease_token: string | null;
  lease_expires_at: Date | string | null;
  attempt_id: string | null;
  claim_id: string | number | null;
  dispatch_class: string;
}>;

class StaleRecoveryOwnerFence extends Error {
  constructor(readonly reason: string) {
    super(reason);
    this.name = "StaleRecoveryOwnerFence";
  }
}

function validTime(value?: Date): Date {
  const parsed = new Date(value ?? new Date());
  if (!Number.isFinite(parsed.getTime())) throw new Error("V3_RECOVERY_OWNER_HEARTBEAT_TIME_INVALID");
  return parsed;
}

function millis(value: Date | string | null): number {
  if (value === null) return Number.NaN;
  const parsed = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function sameClaimId(value: string | number | null, expected: number): boolean {
  if (value === null) return false;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed === expected;
}

function stale(reason: string): never {
  throw new StaleRecoveryOwnerFence(reason);
}

async function lockRun(
  sql: TransactionSql,
  input: V3RecoveryOwnerHeartbeatInputV1,
): Promise<void> {
  const rows = await sql.unsafe<Array<{ protocol: string; status: string }>>(
    "SELECT protocol, status FROM runs WHERE id = $1 FOR UPDATE",
    [input.runId],
  );
  const run = rows[0];
  if (!run || run.protocol !== "v3" || !["running", "resuming"].includes(run.status)) {
    stale("V3_RECOVERY_OWNER_RUN_NOT_ACTIVE");
  }
  const terminations = await sql.unsafe<Array<{ request_id: string }>>(
    `SELECT request_id FROM run_termination_requests
      WHERE run_id = $1 AND state <> 'terminalized'
      LIMIT 1 FOR UPDATE`,
    [input.runId],
  );
  if (terminations.length > 0) stale("V3_RECOVERY_OWNER_TERMINATION_PENDING");
}

async function lockRuntime(
  sql: TransactionSql,
  input: Extract<V3RecoveryOwnerHeartbeatInputV1, { kind: "model_runtime" }>,
): Promise<RuntimeOwnerRow> {
  const rows = await sql.unsafe<RuntimeOwnerRow[]>(
    `SELECT session_id, run_id, story_id, claim_id, attempt_id,
            owner_instance_id, state
       FROM runtime_sessions
      WHERE session_id = $1
      FOR UPDATE`,
    [input.runtimeSessionId],
  );
  const row = rows[0];
  if (
    !row
    || row.run_id !== input.runId
    || row.story_id !== input.storyId
    || !sameClaimId(row.claim_id, input.claimId)
    || row.attempt_id !== input.attempt.attemptId
    || row.owner_instance_id !== input.ownerInstanceId
    || !["starting", "running"].includes(row.state)
  ) {
    stale("V3_RECOVERY_OWNER_RUNTIME_FENCE_STALE");
  }
  return row;
}

async function lockAttempt(
  sql: TransactionSql,
  input: V3RecoveryOwnerHeartbeatInputV1,
  now: Date,
): Promise<AttemptOwnerRow> {
  const rows = await sql.unsafe<AttemptOwnerRow[]>(
    `SELECT attempt_id, claim_id, run_id, step_id, story_id, attempt_class, generation,
            fence_token, disposition, recovery_case_revision_id,
            recovery_dispatch_id, lease_expires_at
       FROM execution_attempts
      WHERE attempt_id = $1
      FOR UPDATE`,
    [input.attempt.attemptId],
  );
  const row = rows[0];
  const expectedClasses = input.kind === "evidence_only"
    ? ["evidence_only"]
    : ["product_implementation", "supervisor_repair"];
  if (
    !row
    || !sameClaimId(row.claim_id, input.claimId)
    || row.run_id !== input.runId
    || row.step_id !== "implement"
    || row.story_id !== input.storyId
    || !expectedClasses.includes(row.attempt_class)
    || row.generation !== input.attempt.generation
    || row.fence_token !== input.attempt.fenceToken
    || !["claimed", "running"].includes(row.disposition)
    || row.recovery_case_revision_id !== input.revisionId
    || row.recovery_dispatch_id !== input.dispatchId
    || !Number.isFinite(millis(row.lease_expires_at))
    || millis(row.lease_expires_at) <= now.getTime()
  ) {
    stale("V3_RECOVERY_OWNER_ATTEMPT_FENCE_STALE");
  }
  return row;
}

async function lockDelivery(
  sql: TransactionSql,
  input: V3RecoveryOwnerHeartbeatInputV1,
  attempt: AttemptOwnerRow,
  now: Date,
): Promise<DeliveryOwnerRow> {
  const rows = await sql.unsafe<DeliveryOwnerRow[]>(
    `SELECT delivery.dispatch_id, delivery.revision_id, delivery.recovery_case_id,
            delivery.run_id, delivery.story_id, delivery.state,
            delivery.owner_instance_id, delivery.lease_token,
            delivery.lease_expires_at, delivery.attempt_id, delivery.claim_id,
            dispatch.dispatch_class
       FROM recovery_dispatch_deliveries delivery
       JOIN recovery_revision_dispatches dispatch
         ON dispatch.dispatch_id = delivery.dispatch_id
        AND dispatch.revision_id = delivery.revision_id
        AND dispatch.recovery_case_id = delivery.recovery_case_id
      WHERE delivery.dispatch_id = $1
      FOR UPDATE OF delivery`,
    [input.dispatchId],
  );
  const row = rows[0];
  if (
    !row
    || row.revision_id !== input.revisionId
    || row.run_id !== input.runId
    || row.story_id !== input.storyId
    || !["attempt_reserved", "running"].includes(row.state)
    || row.owner_instance_id !== input.ownerInstanceId
    || row.lease_token !== input.leaseToken
    || row.attempt_id !== input.attempt.attemptId
    || !sameClaimId(row.claim_id, input.claimId)
    || row.dispatch_class !== attempt.attempt_class
    || !Number.isFinite(millis(row.lease_expires_at))
    || millis(row.lease_expires_at) <= now.getTime()
  ) {
    stale("V3_RECOVERY_OWNER_DELIVERY_FENCE_STALE");
  }
  const cases = await sql.unsafe<Array<{ current_revision_id: string; status: string; owner: string }>>(
    `SELECT current_revision_id, status, owner
       FROM recovery_cases
      WHERE recovery_case_id = $1
      FOR KEY SHARE`,
    [row.recovery_case_id],
  );
  const expectedCase = row.dispatch_class === "evidence_only"
    ? { owner: "infrastructure", status: "evidencing" }
    : row.dispatch_class === "supervisor_repair"
      ? { owner: "supervisor", status: "repairing" }
      : { owner: "implement", status: "repairing" };
  if (
    cases[0]?.current_revision_id !== input.revisionId
    || cases[0]?.owner !== expectedCase.owner
    || cases[0]?.status !== expectedCase.status
  ) {
    stale("V3_RECOVERY_OWNER_CASE_FENCE_STALE");
  }
  return row;
}

export function createV3RecoveryOwnerLeaseRepository(sql: Sql) {
  return Object.freeze({
    async heartbeat(
      raw: unknown,
      options: Readonly<{ now?: Date; leaseMs?: number }> = {},
    ): Promise<V3RecoveryOwnerHeartbeatResult> {
      const input = V3RecoveryOwnerHeartbeatInputV1Schema.parse(raw);
      const now = validTime(options.now);
      const leaseMs = z.number().int().min(30_000).max(24 * 60 * 60 * 1_000)
        .parse(options.leaseMs ?? 2 * 60_000);
      const expiresAt = new Date(now.getTime() + leaseMs);
      try {
        await sql.begin(async (transaction) => {
          await transaction.unsafe("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [
            v3RecoveryStoryLockIdentity({ runId: input.runId, storyId: input.storyId }),
          ]);
          await lockRun(transaction, input);
          if (input.kind === "model_runtime") await lockRuntime(transaction, input);
          const attempt = await lockAttempt(transaction, input, now);
          await lockDelivery(transaction, input, attempt, now);

          if (input.kind === "model_runtime") {
            const runtimes = await transaction.unsafe<Array<{ session_id: string }>>(
              `UPDATE runtime_sessions
                  SET heartbeat_at = $7, updated_at = $7
                WHERE session_id = $1
                  AND run_id = $2
                  AND story_id = $3
                  AND claim_id = $4
                  AND attempt_id = $5
                  AND owner_instance_id = $6
                  AND state IN ('starting', 'running')
                RETURNING session_id`,
              [
                input.runtimeSessionId,
                input.runId,
                input.storyId,
                input.claimId,
                input.attempt.attemptId,
                input.ownerInstanceId,
                now,
              ],
            );
            if (runtimes.length !== 1) stale("V3_RECOVERY_OWNER_RUNTIME_HEARTBEAT_CAS_LOST");
          }

          const attempts = await transaction.unsafe<Array<{ attempt_id: string }>>(
            `UPDATE execution_attempts
                SET heartbeat_at = $4, lease_expires_at = $5, updated_at = $4
              WHERE attempt_id = $1
                AND generation = $2
                AND fence_token = $3
                AND claim_id = $6
                AND recovery_case_revision_id = $7
                AND recovery_dispatch_id = $8
                AND disposition IN ('claimed', 'running')
                AND lease_expires_at > $4
              RETURNING attempt_id`,
            [
              input.attempt.attemptId,
              input.attempt.generation,
              input.attempt.fenceToken,
              now,
              expiresAt,
              input.claimId,
              input.revisionId,
              input.dispatchId,
            ],
          );
          if (attempts.length !== 1) stale("V3_RECOVERY_OWNER_ATTEMPT_HEARTBEAT_CAS_LOST");

          const deliveries = await transaction.unsafe<Array<{ dispatch_id: string }>>(
            `UPDATE recovery_dispatch_deliveries
                SET lease_expires_at = $9, updated_at = $8
              WHERE dispatch_id = $1
                AND revision_id = $2
                AND run_id = $3
                AND story_id = $4
                AND owner_instance_id = $5
                AND lease_token = $6
                AND attempt_id = $7
                AND claim_id = $10
                AND state IN ('attempt_reserved', 'running')
                AND lease_expires_at > $8
              RETURNING dispatch_id`,
            [
              input.dispatchId,
              input.revisionId,
              input.runId,
              input.storyId,
              input.ownerInstanceId,
              input.leaseToken,
              input.attempt.attemptId,
              now,
              expiresAt,
              input.claimId,
            ],
          );
          if (deliveries.length !== 1) stale("V3_RECOVERY_OWNER_DELIVERY_HEARTBEAT_CAS_LOST");
        });
        return { status: "retained", expiresAt: expiresAt.toISOString() };
      } catch (error) {
        if (error instanceof StaleRecoveryOwnerFence) {
          return { status: "stale_fence", reason: error.reason };
        }
        throw error;
      }
    },
  });
}
