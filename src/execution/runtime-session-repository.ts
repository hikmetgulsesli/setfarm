import { randomUUID } from "node:crypto";

import type postgres from "postgres";
import { z } from "zod";
import { readDatabaseWallClock } from "../db/database-wall-clock.js";
import {
  ProcessIdentityV1Schema,
  sameProcessIdentity,
  type ProcessIdentityV1,
} from "./schemas/process-identity-v1.js";
import { v3RecoveryStoryLockIdentity } from "../recovery/v3-recovery-claim-authority.js";

type Sql = postgres.Sql;
type TransactionSql = postgres.TransactionSql;

export type RecoveryRuntimeLeaseFence = Readonly<{
  revisionId: string;
  dispatchId: string;
  leaseToken: string;
  attempt: Readonly<{
    attemptId: string;
    generation: number;
    fenceToken: string;
  }>;
}>;

export const RuntimeSessionStateSchema = z.enum([
  "reserved",
  "starting",
  "running",
  "drain_requested",
  "drained",
  "released",
  "quarantined",
]);

export const RuntimeKindSchema = z.enum([
  "local_process",
  "openclaw_session",
  "external_session",
]);

const RuntimeSessionIdSchema = z.string().regex(/^RTS_[A-Za-z0-9-]{16,160}$/);

export const RuntimeClaimIntentV1Schema = z.object({
  schema: z.literal("setfarm.runtime-claim-intent.v1"),
  sessionId: RuntimeSessionIdSchema,
  runtimeAgentId: z.string().min(1).max(500),
  runtimeKind: RuntimeKindSchema,
  ownerInstanceId: z.string().min(1).max(500),
  sessionKey: z.string().min(1).max(1_000).optional(),
  worktree: z.string().min(1).max(4_000).optional(),
  runtimePath: z.string().min(1).max(4_000).optional(),
  transcriptPath: z.string().min(1).max(4_000).optional(),
}).strict();

export type RuntimeClaimIntentV1 = z.infer<typeof RuntimeClaimIntentV1Schema>;

export const RuntimeDrainEvidenceV1Schema = z.object({
  schema: z.literal("setfarm.runtime-drain-evidence.v1"),
  observedAt: z.string().datetime({ offset: true }),
  localProcessAbsent: z.boolean(),
  openClawTaskAbsent: z.boolean(),
  workspaceProcessAbsent: z.boolean(),
  stableObservations: z.number().int().min(2).max(100),
  evidenceRefs: z.array(z.string().min(1).max(500)).max(100),
  expectedProcessIdentity: ProcessIdentityV1Schema.optional(),
  observedProcessIdentity: ProcessIdentityV1Schema.optional(),
  processIdentityMatched: z.boolean().optional(),
  trackedChildTerminal: z.boolean().optional(),
}).strict().superRefine((value, context) => {
  for (const field of [
    "localProcessAbsent",
    "openClawTaskAbsent",
    "workspaceProcessAbsent",
  ] as const) {
    if (!value[field]) {
      context.addIssue({ code: "custom", path: [field], message: "Drain proof must show absence" });
    }
  }
  if (value.processIdentityMatched === true && (!value.expectedProcessIdentity || !value.observedProcessIdentity)) {
    context.addIssue({
      code: "custom",
      path: ["processIdentityMatched"],
      message: "Matched process identity evidence requires expected and observed identities",
    });
  }
});

const RuntimeSessionReservationSchema = z.object({
  sessionId: RuntimeSessionIdSchema,
  runId: z.string().min(1).max(500),
  stepDbId: z.string().min(1).max(500),
  workflowStepId: z.string().min(1).max(500),
  storyDbId: z.string().min(1).max(500).optional(),
  storyId: z.string().min(1).max(500).optional(),
  claimId: z.number().int().positive(),
  attemptId: z.string().regex(/^ATT_[A-Za-z0-9-]{16,160}$/).optional(),
  claimAgentId: z.string().min(1).max(500),
  runtimeAgentId: z.string().min(1).max(500),
  runtimeKind: RuntimeKindSchema,
  ownerInstanceId: z.string().min(1).max(500),
  sessionKey: z.string().min(1).max(1_000).optional(),
  worktree: z.string().min(1).max(4_000).optional(),
  runtimePath: z.string().min(1).max(4_000).optional(),
  transcriptPath: z.string().min(1).max(4_000).optional(),
  now: z.date().optional(),
}).strict().superRefine((value, context) => {
  if ((value.storyId === undefined) !== (value.storyDbId === undefined)) {
    context.addIssue({ code: "custom", path: ["storyId"], message: "Story identities must be paired" });
  }
});

type RuntimeSessionRow = Readonly<{
  session_id: string;
  run_id: string;
  step_db_id: string;
  workflow_step_id: string;
  story_db_id: string | null;
  story_id: string | null;
  claim_id: string;
  attempt_id: string | null;
  claim_agent_id: string;
  runtime_agent_id: string;
  runtime_kind: string;
  session_key: string | null;
  pid: number | null;
  process_started_at: Date | string | null;
  process_group_id: number | null;
  process_identity: unknown;
  worktree: string | null;
  runtime_path: string | null;
  transcript_path: string | null;
  state: string;
  owner_instance_id: string;
  state_version: number;
  started_at: Date | string | null;
  heartbeat_at: Date | string;
  drain_requested_at: Date | string | null;
  drained_at: Date | string | null;
  released_at: Date | string | null;
  diagnostic: string | null;
  drain_evidence: unknown;
  created_at: Date | string;
  updated_at: Date | string;
}>;

export type ClaimRuntimeSession = Readonly<{
  sessionId: string;
  runId: string;
  stepDbId: string;
  workflowStepId: string;
  storyDbId?: string;
  storyId?: string;
  claimId: number;
  attemptId?: string;
  claimAgentId: string;
  runtimeAgentId: string;
  runtimeKind: z.infer<typeof RuntimeKindSchema>;
  sessionKey?: string;
  pid?: number;
  processStartedAt?: string;
  processGroupId?: number;
  processIdentity?: ProcessIdentityV1;
  worktree?: string;
  runtimePath?: string;
  transcriptPath?: string;
  state: z.infer<typeof RuntimeSessionStateSchema>;
  ownerInstanceId: string;
  stateVersion: number;
  startedAt?: string;
  heartbeatAt: string;
  drainRequestedAt?: string;
  drainedAt?: string;
  releasedAt?: string;
  diagnostic?: string;
  drainEvidence: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}>;

function timestamp(value: Date | string): string {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

function optionalTimestamp(value: Date | string | null): string | undefined {
  return value === null ? undefined : timestamp(value);
}

function mapRuntimeSession(row: RuntimeSessionRow): ClaimRuntimeSession {
  const claimId = Number(row.claim_id);
  if (!Number.isSafeInteger(claimId) || claimId <= 0) throw new Error("RUNTIME_SESSION_CLAIM_ID_INVALID");
  const evidence = typeof row.drain_evidence === "string"
    ? JSON.parse(row.drain_evidence) as unknown
    : row.drain_evidence;
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) {
    throw new Error("RUNTIME_SESSION_DRAIN_EVIDENCE_INVALID");
  }
  const rawIdentity = typeof row.process_identity === "string"
    ? JSON.parse(row.process_identity) as unknown
    : row.process_identity;
  const processIdentity = rawIdentity
    && typeof rawIdentity === "object"
    && !Array.isArray(rawIdentity)
    && Object.keys(rawIdentity as Record<string, unknown>).length > 0
    ? ProcessIdentityV1Schema.parse(rawIdentity)
    : undefined;
  return Object.freeze({
    sessionId: RuntimeSessionIdSchema.parse(row.session_id),
    runId: row.run_id,
    stepDbId: row.step_db_id,
    workflowStepId: row.workflow_step_id,
    ...(row.story_db_id ? { storyDbId: row.story_db_id } : {}),
    ...(row.story_id ? { storyId: row.story_id } : {}),
    claimId,
    ...(row.attempt_id ? { attemptId: row.attempt_id } : {}),
    claimAgentId: row.claim_agent_id,
    runtimeAgentId: row.runtime_agent_id,
    runtimeKind: RuntimeKindSchema.parse(row.runtime_kind),
    ...(row.session_key ? { sessionKey: row.session_key } : {}),
    ...(row.pid === null ? {} : { pid: row.pid }),
    ...(optionalTimestamp(row.process_started_at) ? { processStartedAt: optionalTimestamp(row.process_started_at) } : {}),
    ...(row.process_group_id === null ? {} : { processGroupId: row.process_group_id }),
    ...(processIdentity ? { processIdentity } : {}),
    ...(row.worktree ? { worktree: row.worktree } : {}),
    ...(row.runtime_path ? { runtimePath: row.runtime_path } : {}),
    ...(row.transcript_path ? { transcriptPath: row.transcript_path } : {}),
    state: RuntimeSessionStateSchema.parse(row.state),
    ownerInstanceId: row.owner_instance_id,
    stateVersion: row.state_version,
    ...(optionalTimestamp(row.started_at) ? { startedAt: optionalTimestamp(row.started_at) } : {}),
    heartbeatAt: timestamp(row.heartbeat_at),
    ...(optionalTimestamp(row.drain_requested_at) ? { drainRequestedAt: optionalTimestamp(row.drain_requested_at) } : {}),
    ...(optionalTimestamp(row.drained_at) ? { drainedAt: optionalTimestamp(row.drained_at) } : {}),
    ...(optionalTimestamp(row.released_at) ? { releasedAt: optionalTimestamp(row.released_at) } : {}),
    ...(row.diagnostic ? { diagnostic: row.diagnostic } : {}),
    drainEvidence: Object.freeze({ ...(evidence as Record<string, unknown>) }),
    createdAt: timestamp(row.created_at),
    updatedAt: timestamp(row.updated_at),
  });
}

function validTime(value: Date | undefined): Date {
  const now = value ? new Date(value) : new Date();
  if (!Number.isFinite(now.getTime())) throw new Error("RUNTIME_SESSION_TIME_INVALID");
  return now;
}

async function assertBoundRecoveryLeaseLiveInTransaction(
  sql: TransactionSql,
  session: RuntimeSessionRow,
  recoveryFence?: RecoveryRuntimeLeaseFence,
): Promise<void> {
  if (!session.attempt_id) {
    if (recoveryFence) throw new Error("RUNTIME_SESSION_RECOVERY_FENCE_UNEXPECTED");
    return;
  }
  const attempts = await sql.unsafe<Array<{
    attempt_id: string;
    claim_id: string | number | null;
    run_id: string;
    story_id: string;
    generation: number;
    fence_token: string;
    disposition: string;
    recovery_case_revision_id: string | null;
    recovery_dispatch_id: string | null;
    lease_expires_at: Date | string;
  }>>(
    `SELECT attempt_id, claim_id, run_id, story_id, generation, fence_token,
            disposition, recovery_case_revision_id, recovery_dispatch_id,
            lease_expires_at
       FROM execution_attempts
      WHERE attempt_id = $1
      FOR UPDATE`,
    [session.attempt_id],
  );
  const attempt = attempts[0];
  if (!attempt) throw new Error("RUNTIME_SESSION_ATTEMPT_FENCE_MISSING");
  const recoveryBound = attempt.recovery_case_revision_id !== null
    || attempt.recovery_dispatch_id !== null;
  if (!recoveryBound) {
    if (recoveryFence) throw new Error("RUNTIME_SESSION_RECOVERY_FENCE_UNEXPECTED");
    return;
  }
  if (!recoveryFence) throw new Error("RUNTIME_SESSION_RECOVERY_FENCE_REQUIRED");
  if (
    attempt.recovery_case_revision_id === null
    || attempt.recovery_dispatch_id === null
    || attempt.attempt_id !== recoveryFence.attempt.attemptId
    || Number(attempt.claim_id) !== Number(session.claim_id)
    || attempt.run_id !== session.run_id
    || attempt.story_id !== session.story_id
    || attempt.generation !== recoveryFence.attempt.generation
    || attempt.fence_token !== recoveryFence.attempt.fenceToken
    || !["claimed", "running"].includes(attempt.disposition)
    || attempt.recovery_case_revision_id !== recoveryFence.revisionId
    || attempt.recovery_dispatch_id !== recoveryFence.dispatchId
  ) {
    throw new Error("RUNTIME_SESSION_RECOVERY_ATTEMPT_FENCE_STALE");
  }
  const deliveries = await sql.unsafe<Array<{ dispatch_id: string; lease_expires_at: Date | string }>>(
    `SELECT dispatch_id, lease_expires_at
       FROM recovery_dispatch_deliveries
      WHERE dispatch_id = $1
        AND revision_id = $2
        AND run_id = $3
        AND story_id = $4
        AND attempt_id = $5
        AND claim_id = $6
        AND owner_instance_id = $7
        AND lease_token = $8
        AND state IN ('attempt_reserved', 'running')
      FOR UPDATE`,
    [
      recoveryFence.dispatchId,
      recoveryFence.revisionId,
      session.run_id,
      session.story_id,
      recoveryFence.attempt.attemptId,
      Number(session.claim_id),
      session.owner_instance_id,
      recoveryFence.leaseToken,
    ],
  );
  const wallClock = await readDatabaseWallClock(
    sql,
    "RUNTIME_SESSION_DATABASE_WALL_CLOCK_UNAVAILABLE",
  );
  if (new Date(attempt.lease_expires_at).getTime() <= wallClock.getTime()) {
    throw new Error("RUNTIME_SESSION_RECOVERY_ATTEMPT_FENCE_STALE");
  }
  if (
    deliveries.length !== 1
    || new Date(deliveries[0]!.lease_expires_at).getTime() <= wallClock.getTime()
  ) {
    throw new Error("RUNTIME_SESSION_RECOVERY_DELIVERY_FENCE_STALE");
  }
}

async function lockRuntimeStartAuthorityInTransaction(
  sql: TransactionSql,
  sessionId: string,
  ownerInstanceId: string,
): Promise<RuntimeSessionRow> {
  const identities = await sql.unsafe<Array<{ run_id: string; story_id: string | null }>>(
    "SELECT run_id, story_id FROM runtime_sessions WHERE session_id = $1",
    [sessionId],
  );
  const identity = identities[0];
  if (!identity) throw new Error("RUNTIME_SESSION_NOT_FOUND");
  if (identity.story_id) {
    await sql.unsafe("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [
      v3RecoveryStoryLockIdentity({ runId: identity.run_id, storyId: identity.story_id }),
    ]);
  }
  const runs = await sql.unsafe<Array<{ status: string }>>(
    "SELECT status FROM runs WHERE id = $1 FOR UPDATE",
    [identity.run_id],
  );
  if (!runs[0]) throw new Error("RUNTIME_SESSION_START_RUN_NOT_FOUND");
  const terminations = await sql.unsafe<Array<{ request_id: string }>>(
    `SELECT request_id FROM run_termination_requests
      WHERE run_id = $1 AND state <> 'terminalized'
      ORDER BY requested_at, request_id
      LIMIT 1
      FOR UPDATE`,
    [identity.run_id],
  );
  const rows = await sql.unsafe<RuntimeSessionRow[]>(
    "SELECT * FROM runtime_sessions WHERE session_id = $1 FOR UPDATE",
    [sessionId],
  );
  const current = rows[0];
  if (!current || current.run_id !== identity.run_id || current.story_id !== identity.story_id) {
    throw new Error("RUNTIME_SESSION_IDENTITY_CHANGED");
  }
  if (current.owner_instance_id !== ownerInstanceId) {
    throw new Error("RUNTIME_SESSION_OWNER_MISMATCH");
  }
  // Canonical termination may win after markStarting and publish a durable
  // drain request. markRunning must observe that handoff instead of throwing
  // before it reaches the runtime row and stranding the claim owner.
  if (current.state !== "drain_requested") {
    if (!["running", "resuming"].includes(runs[0].status)) {
      throw new Error("RUNTIME_SESSION_START_RUN_NOT_ACTIVE");
    }
    if (terminations.length > 0) throw new Error("RUNTIME_SESSION_START_TERMINATION_PENDING");
  }
  return current;
}

/**
 * Publish the execution-side half of a runtime start under the same database
 * transaction as the runtime-session transition.  A compiler attempt is not
 * actually running merely because a child process was forked; the durable
 * runtime capability, attempt fence and (when present) recovery delivery must
 * all name the same owner before any of them may expose `running`.
 */
async function markBoundAttemptRuntimeRunningInTransaction(
  sql: TransactionSql,
  session: RuntimeSessionRow,
  now: Date,
): Promise<void> {
  if (!session.attempt_id) return;

  const attempts = await sql.unsafe<Array<{
    attempt_id: string;
    claim_id: string;
    run_id: string;
    step_id: string;
    story_id: string;
    slice_hash: string | null;
    recovery_case_revision_id: string | null;
    recovery_dispatch_id: string | null;
  }>>(
    `UPDATE execution_attempts
        SET disposition = 'running', heartbeat_at = $6, updated_at = $6
      WHERE attempt_id = $1
        AND claim_id = $2
        AND run_id = $3
        AND step_id = $4
        AND story_id = $5
        AND disposition IN ('claimed', 'running')
      RETURNING attempt_id, claim_id::text, run_id, step_id, story_id, slice_hash,
                recovery_case_revision_id, recovery_dispatch_id`,
    [
      session.attempt_id,
      Number(session.claim_id),
      session.run_id,
      session.workflow_step_id,
      session.story_id ?? "",
      now,
    ],
  );
  if (attempts.length !== 1) {
    throw new Error("RUNTIME_SESSION_ATTEMPT_RUNNING_CAS_LOST");
  }

  const attempt = attempts[0]!;
  const hasRecoveryRevision = attempt.recovery_case_revision_id !== null;
  const hasRecoveryDispatch = attempt.recovery_dispatch_id !== null;
  if (hasRecoveryRevision !== hasRecoveryDispatch) {
    throw new Error("RUNTIME_SESSION_RECOVERY_ATTEMPT_IDENTITY_INCOMPLETE");
  }
  if (!hasRecoveryDispatch) return;
  if (!attempt.slice_hash || !session.story_id) {
    throw new Error("RUNTIME_SESSION_RECOVERY_ATTEMPT_IDENTITY_INCOMPLETE");
  }

  const deliveries = await sql.unsafe<Array<{ dispatch_id: string }>>(
    `UPDATE recovery_dispatch_deliveries delivery
        SET state = 'running', updated_at = $8
      WHERE delivery.dispatch_id = $1
        AND delivery.revision_id = $2
        AND delivery.attempt_id = $3
        AND delivery.claim_id = $4
        AND delivery.run_id = $5
        AND delivery.story_id = $6
        AND delivery.execution_slice_hash = $7
        AND delivery.owner_instance_id = $9
        AND delivery.state IN ('attempt_reserved', 'running')
      RETURNING delivery.dispatch_id`,
    [
      attempt.recovery_dispatch_id!,
      attempt.recovery_case_revision_id!,
      attempt.attempt_id,
      Number(attempt.claim_id),
      attempt.run_id,
      attempt.story_id,
      attempt.slice_hash,
      now,
      session.owner_instance_id,
    ],
  );
  if (deliveries.length !== 1) {
    throw new Error("RUNTIME_SESSION_RECOVERY_DELIVERY_RUNNING_CAS_LOST");
  }
}

export function newRuntimeSessionId(): string {
  return `RTS_${randomUUID()}`;
}

export function parseRuntimeClaimIntentV1(value: unknown): RuntimeClaimIntentV1 {
  return Object.freeze(RuntimeClaimIntentV1Schema.parse(value));
}

export async function reserveRuntimeSessionInTransaction(
  sql: Sql | TransactionSql,
  rawInput: unknown,
): Promise<ClaimRuntimeSession> {
  const input = RuntimeSessionReservationSchema.parse(rawInput);
  const now = validTime(input.now);
  const claims = await sql.unsafe<Array<{
    run_status: string;
    claim_run_id: string;
    claim_step_id: string;
    claim_story_id: string | null;
    claim_agent_id: string;
    claim_outcome: string | null;
    step_db_id: string;
    step_status: string;
    current_story_id: string | null;
  }>>(
    `SELECT r.status AS run_status,
            cl.run_id AS claim_run_id,
            cl.step_id AS claim_step_id,
            cl.story_id AS claim_story_id,
            cl.agent_id AS claim_agent_id,
            cl.outcome AS claim_outcome,
            s.id AS step_db_id,
            s.status AS step_status,
            s.current_story_id
       FROM claim_log cl
       JOIN runs r ON r.id = cl.run_id
       JOIN steps s ON s.run_id = cl.run_id AND s.step_id = cl.step_id AND s.id = $2
      WHERE cl.id = $1
      FOR UPDATE OF cl, r, s`,
    [input.claimId, input.stepDbId],
  );
  const claim = claims[0];
  if (!claim) throw new Error("RUNTIME_SESSION_CLAIM_NOT_FOUND");
  if (
    claim.claim_run_id !== input.runId
    || claim.claim_step_id !== input.workflowStepId
    || (claim.claim_story_id ?? undefined) !== input.storyId
    || claim.claim_agent_id !== input.claimAgentId
  ) {
    throw new Error("RUNTIME_SESSION_CLAIM_IDENTITY_MISMATCH");
  }
  if (claim.claim_outcome !== null) throw new Error("RUNTIME_SESSION_CLAIM_TERMINAL");
  if (!['running', 'resuming'].includes(claim.run_status)) {
    throw new Error("RUNTIME_SESSION_RUN_NOT_ACTIVE");
  }
  if (claim.step_db_id !== input.stepDbId || claim.step_status !== "running") {
    throw new Error("RUNTIME_SESSION_STEP_OWNERSHIP_MISMATCH");
  }
  if (input.storyId) {
    const stories = await sql.unsafe<Array<{
      story_db_id: string;
      story_status: string;
      story_claimed_by: string | null;
    }>>(
      `SELECT id AS story_db_id, status AS story_status, claimed_by AS story_claimed_by
         FROM stories
        WHERE id = $1 AND run_id = $2 AND story_id = $3
        FOR UPDATE`,
      [input.storyDbId!, input.runId, input.storyId],
    );
    const story = stories[0];
    if (
      !story
      || story.story_status !== "running"
      || claim.current_story_id !== input.storyDbId
      || (story.story_claimed_by !== null && story.story_claimed_by !== input.claimAgentId)
    ) {
      throw new Error("RUNTIME_SESSION_STORY_OWNERSHIP_MISMATCH");
    }
  }

  if (input.attemptId) {
    const attempts = await sql.unsafe<Array<{ attempt_id: string }>>(
      `SELECT attempt_id
         FROM execution_attempts
        WHERE attempt_id = $1
          AND claim_id = $2
          AND run_id = $3
          AND step_id = $4
          AND story_id = $5
          AND disposition IN ('claimed', 'running')
        FOR KEY SHARE`,
      [input.attemptId, input.claimId, input.runId, input.workflowStepId, input.storyId ?? ""],
    );
    if (attempts.length !== 1) throw new Error("RUNTIME_SESSION_ATTEMPT_BINDING_INVALID");
  }

  const inserted = await sql.unsafe<RuntimeSessionRow[]>(
    `INSERT INTO runtime_sessions (
       session_id, run_id, step_db_id, workflow_step_id, story_db_id, story_id,
       claim_id, attempt_id, claim_agent_id, runtime_agent_id, runtime_kind,
       owner_instance_id, session_key, worktree, runtime_path, transcript_path,
       state, heartbeat_at, created_at, updated_at
     ) VALUES (
       $1, $2, $3, $4, $5, $6,
       $7, $8, $9, $10, $11,
       $12, $13, $14, $15, $16,
       'reserved', $17, $17, $17
     )
     RETURNING *`,
    [
      input.sessionId,
      input.runId,
      input.stepDbId,
      input.workflowStepId,
      input.storyDbId ?? null,
      input.storyId ?? null,
      input.claimId,
      input.attemptId ?? null,
      input.claimAgentId,
      input.runtimeAgentId,
      input.runtimeKind,
      input.ownerInstanceId,
      input.sessionKey ?? null,
      input.worktree ?? null,
      input.runtimePath ?? null,
      input.transcriptPath ?? null,
      now,
    ],
  );
  if (inserted.length !== 1) throw new Error("RUNTIME_SESSION_RESERVATION_FAILED");
  return mapRuntimeSession(inserted[0]!);
}

export async function bindRuntimeSessionAttemptInTransaction(
  sql: Sql | TransactionSql,
  input: Readonly<{ sessionId: string; attemptId: string; ownerInstanceId: string; now?: Date }>,
): Promise<ClaimRuntimeSession> {
  const sessionId = RuntimeSessionIdSchema.parse(input.sessionId);
  const now = validTime(input.now);
  const rows = await sql.unsafe<RuntimeSessionRow[]>(
    `UPDATE runtime_sessions rs
        SET attempt_id = $2, state_version = state_version + 1, updated_at = $4
      WHERE rs.session_id = $1
        AND rs.owner_instance_id = $3
        AND rs.attempt_id IS NULL
        AND rs.state = 'reserved'
        AND EXISTS (
          SELECT 1 FROM execution_attempts ea
           WHERE ea.attempt_id = $2
             AND ea.claim_id = rs.claim_id
             AND ea.run_id = rs.run_id
             AND ea.step_id = rs.workflow_step_id
             AND ea.story_id = COALESCE(rs.story_id, '')
             AND ea.disposition IN ('claimed', 'running')
        )
      RETURNING rs.*`,
    [sessionId, input.attemptId, input.ownerInstanceId, now],
  );
  if (rows.length !== 1) throw new Error("RUNTIME_SESSION_ATTEMPT_BINDING_CAS_LOST");
  return mapRuntimeSession(rows[0]!);
}

export function createRuntimeSessionRepository(sql: Sql) {
  const findById = async (sessionId: string): Promise<ClaimRuntimeSession | undefined> => {
    const rows = await sql.unsafe<RuntimeSessionRow[]>(
      "SELECT * FROM runtime_sessions WHERE session_id = $1 LIMIT 1",
      [RuntimeSessionIdSchema.parse(sessionId)],
    );
    return rows[0] ? mapRuntimeSession(rows[0]) : undefined;
  };

  return Object.freeze({
    findById,
    reserve: (input: unknown) => sql.begin((transaction) =>
      reserveRuntimeSessionInTransaction(transaction, input)) as Promise<ClaimRuntimeSession>,
    bindAttempt: (input: Readonly<{ sessionId: string; attemptId: string; ownerInstanceId: string; now?: Date }>) =>
      sql.begin((transaction) => bindRuntimeSessionAttemptInTransaction(transaction, input)) as Promise<ClaimRuntimeSession>,
    async markStarting(input: Readonly<{
      sessionId: string;
      ownerInstanceId: string;
      sessionKey?: string;
      worktree?: string;
      runtimePath?: string;
      transcriptPath?: string;
      recoveryFence?: RecoveryRuntimeLeaseFence;
      now?: Date;
    }>): Promise<ClaimRuntimeSession> {
      const now = validTime(input.now);
      return sql.begin(async (transaction) => {
        const current = await lockRuntimeStartAuthorityInTransaction(
          transaction,
          RuntimeSessionIdSchema.parse(input.sessionId),
          input.ownerInstanceId,
        );
        await assertBoundRecoveryLeaseLiveInTransaction(transaction, current, input.recoveryFence);
        if (current.state === "starting") return mapRuntimeSession(current);
        if (current.state !== "reserved") throw new Error(`RUNTIME_SESSION_START_STATE_INVALID:${current.state}`);
        const updated = await transaction.unsafe<RuntimeSessionRow[]>(
          `UPDATE runtime_sessions
              SET state = 'starting', session_key = COALESCE($4, session_key),
                  worktree = COALESCE($5, worktree),
                  runtime_path = COALESCE($6, runtime_path),
                  transcript_path = COALESCE($7, transcript_path),
                  state_version = state_version + 1,
                  heartbeat_at = $3, updated_at = $3
            WHERE session_id = $1 AND owner_instance_id = $2 AND state = 'reserved'
            RETURNING *`,
          [
            current.session_id,
            input.ownerInstanceId,
            now,
            input.sessionKey ?? null,
            input.worktree ?? null,
            input.runtimePath ?? null,
            input.transcriptPath ?? null,
          ],
        );
        if (updated.length !== 1) throw new Error("RUNTIME_SESSION_START_CAS_LOST");
        return mapRuntimeSession(updated[0]!);
      }) as Promise<ClaimRuntimeSession>;
    },
    async markRunning(input: Readonly<{
      sessionId: string;
      ownerInstanceId: string;
      pid?: number;
      sessionKey?: string;
      processStartedAt?: Date;
      processIdentity?: ProcessIdentityV1;
      recoveryFence?: RecoveryRuntimeLeaseFence;
      now?: Date;
    }>): Promise<Readonly<{ status: "running" | "drain_requested"; session: ClaimRuntimeSession }>> {
      const now = validTime(input.now);
      const processIdentity = input.processIdentity
        ? ProcessIdentityV1Schema.parse(input.processIdentity)
        : undefined;
      if (input.pid !== undefined && !processIdentity) {
        throw new Error("RUNTIME_SESSION_PROCESS_IDENTITY_REQUIRED");
      }
      if (processIdentity && input.pid === undefined) {
        throw new Error("RUNTIME_SESSION_PROCESS_IDENTITY_PID_REQUIRED");
      }
      if (processIdentity && processIdentity.pid !== input.pid) {
        throw new Error("RUNTIME_SESSION_PROCESS_IDENTITY_PID_MISMATCH");
      }
      const processStartedAt = processIdentity
        ? new Date(processIdentity.processStartedAt)
        : input.processStartedAt
          ? validTime(input.processStartedAt)
          : now;
      return sql.begin(async (transaction) => {
        const sessionId = RuntimeSessionIdSchema.parse(input.sessionId);
        const locked = await lockRuntimeStartAuthorityInTransaction(
          transaction,
          sessionId,
          input.ownerInstanceId,
        );
        if (locked.state === "drain_requested") {
          return { status: "drain_requested" as const, session: mapRuntimeSession(locked) };
        }
        await assertBoundRecoveryLeaseLiveInTransaction(transaction, locked, input.recoveryFence);
        const updated = await transaction.unsafe<RuntimeSessionRow[]>(
          `UPDATE runtime_sessions
              SET state = 'running', pid = $3, session_key = $4,
                  process_started_at = $5, started_at = COALESCE(started_at, $6),
                  process_group_id = $7, process_identity = $8::text::jsonb,
                  heartbeat_at = $6, state_version = state_version + 1, updated_at = $6
            WHERE session_id = $1 AND owner_instance_id = $2 AND state = 'starting'
              AND EXISTS (
                SELECT 1 FROM runs r
                 WHERE r.id = runtime_sessions.run_id
                   AND r.status IN ('running', 'resuming')
              )
              AND NOT EXISTS (
                SELECT 1 FROM run_termination_requests rr
                 WHERE rr.run_id = runtime_sessions.run_id
                   AND rr.state <> 'terminalized'
              )
            RETURNING *`,
          [
            sessionId,
            input.ownerInstanceId,
            input.pid ?? null,
            input.sessionKey ?? null,
            processStartedAt,
            now,
            processIdentity?.processGroupId ?? null,
            JSON.stringify(processIdentity ?? {}),
          ],
        );
        if (updated.length === 1) {
          await markBoundAttemptRuntimeRunningInTransaction(transaction, updated[0]!, now);
          return { status: "running" as const, session: mapRuntimeSession(updated[0]!) };
        }
        const currentRows = await transaction.unsafe<RuntimeSessionRow[]>(
          "SELECT * FROM runtime_sessions WHERE session_id = $1 FOR UPDATE",
          [sessionId],
        );
        const current = currentRows[0];
        if (!current) throw new Error("RUNTIME_SESSION_NOT_FOUND");
        if (current.owner_instance_id !== input.ownerInstanceId) throw new Error("RUNTIME_SESSION_OWNER_MISMATCH");
        if (current.state === "drain_requested") {
          return { status: "drain_requested" as const, session: mapRuntimeSession(current) };
        }
        if (current.state === "running") {
          const mapped = mapRuntimeSession(current);
          if (
            input.pid !== undefined
            && (
              mapped.pid !== input.pid
              || !mapped.processIdentity
              || !processIdentity
              || !sameProcessIdentity(mapped.processIdentity, processIdentity)
              || mapped.processIdentity.source !== processIdentity.source
            )
          ) {
            throw new Error("RUNTIME_SESSION_RUNNING_IDENTITY_MISMATCH");
          }
          await markBoundAttemptRuntimeRunningInTransaction(transaction, current, now);
          return { status: "running" as const, session: mapped };
        }
        throw new Error(`RUNTIME_SESSION_RUNNING_CAS_LOST:${current.state}`);
      }) as Promise<Readonly<{ status: "running" | "drain_requested"; session: ClaimRuntimeSession }>>;
    },
    async heartbeat(input: Readonly<{ sessionId: string; ownerInstanceId: string; now?: Date }>): Promise<boolean> {
      const now = validTime(input.now);
      const rows = await sql.unsafe<Array<{ session_id: string }>>(
        `UPDATE runtime_sessions
            SET heartbeat_at = $3, updated_at = $3
          WHERE session_id = $1 AND owner_instance_id = $2
            AND state IN ('starting', 'running', 'drain_requested')
          RETURNING session_id`,
        [RuntimeSessionIdSchema.parse(input.sessionId), input.ownerInstanceId, now],
      );
      return rows.length === 1;
    },
    async requestDrain(input: Readonly<{
      sessionId: string;
      ownerInstanceId?: string;
      diagnostic: string;
      now?: Date;
    }>): Promise<ClaimRuntimeSession> {
      const now = validTime(input.now);
      const rows = await sql.unsafe<RuntimeSessionRow[]>(
        `UPDATE runtime_sessions
            SET state = CASE
                  WHEN state IN ('reserved', 'starting', 'running') THEN 'drain_requested'
                  ELSE state
                END,
                drain_requested_at = CASE
                  WHEN state IN ('reserved', 'starting', 'running') THEN COALESCE(drain_requested_at, $3)
                  ELSE drain_requested_at
                END,
                diagnostic = CASE
                  WHEN state IN ('reserved', 'starting', 'running') THEN $2
                  ELSE diagnostic
                END,
                state_version = CASE
                  WHEN state IN ('reserved', 'starting', 'running') THEN state_version + 1
                  ELSE state_version
                END,
                updated_at = $3
          WHERE session_id = $1
            AND ($4::text IS NULL OR owner_instance_id = $4)
            AND state <> 'quarantined'
          RETURNING *`,
        [
          RuntimeSessionIdSchema.parse(input.sessionId),
          input.diagnostic.slice(0, 4_000),
          now,
          input.ownerInstanceId ?? null,
        ],
      );
      if (rows.length !== 1) throw new Error("RUNTIME_SESSION_DRAIN_REQUEST_FAILED");
      return mapRuntimeSession(rows[0]!);
    },
    async markDrained(input: Readonly<{
      sessionId: string;
      ownerInstanceId?: string;
      evidence: unknown;
      now?: Date;
    }>): Promise<ClaimRuntimeSession> {
      const evidence = RuntimeDrainEvidenceV1Schema.parse(input.evidence);
      const now = validTime(input.now);
      return sql.begin(async (transaction) => {
        const currentRows = await transaction.unsafe<RuntimeSessionRow[]>(
          "SELECT * FROM runtime_sessions WHERE session_id = $1 FOR UPDATE",
          [RuntimeSessionIdSchema.parse(input.sessionId)],
        );
        const current = currentRows[0];
        if (!current) throw new Error("RUNTIME_SESSION_NOT_FOUND");
        // Drain evidence proves process absence, independent of which later
        // completion/cancellation intent consumes it. Reuse the first durable
        // proof verbatim; never overwrite its timestamp or evidence on replay.
        if (current.state === "drained") return mapRuntimeSession(current);
        if (current.state !== "drain_requested") {
          throw new Error(`RUNTIME_SESSION_DRAIN_CAS_LOST:${current.state}`);
        }
        if (input.ownerInstanceId && current.owner_instance_id !== input.ownerInstanceId) {
          throw new Error("RUNTIME_SESSION_DRAIN_CAS_LOST");
        }
        const rows = await transaction.unsafe<RuntimeSessionRow[]>(
          `UPDATE runtime_sessions
              SET state = 'drained', drained_at = $3,
                  drain_evidence = $2::text::jsonb,
                  heartbeat_at = $3, state_version = state_version + 1, updated_at = $3
            WHERE session_id = $1 AND state = 'drain_requested'
            RETURNING *`,
          [current.session_id, JSON.stringify(evidence), now],
        );
        if (rows.length !== 1) throw new Error("RUNTIME_SESSION_DRAIN_CAS_LOST");
        return mapRuntimeSession(rows[0]!);
      }) as Promise<ClaimRuntimeSession>;
    },
    async recoverQuarantinedForTermination(input: Readonly<{
      sessionId: string;
      expectedStateVersion: number;
      terminationRequestId: string;
      terminationOwnerInstanceId: string;
      evidence: unknown;
      diagnostic: string;
      now?: Date;
    }>): Promise<ClaimRuntimeSession> {
      const evidence = RuntimeDrainEvidenceV1Schema.parse(input.evidence);
      if (!Number.isSafeInteger(input.expectedStateVersion) || input.expectedStateVersion < 0) {
        throw new Error("RUNTIME_SESSION_TERMINATION_RECOVERY_VERSION_INVALID");
      }
      if (!/^RTR_[A-Za-z0-9-]{16,160}$/.test(input.terminationRequestId)) {
        throw new Error("RUNTIME_SESSION_TERMINATION_RECOVERY_REQUEST_INVALID");
      }
      if (!input.terminationOwnerInstanceId.trim()) {
        throw new Error("RUNTIME_SESSION_TERMINATION_RECOVERY_OWNER_REQUIRED");
      }
      if (!input.diagnostic.trim()) {
        throw new Error("RUNTIME_SESSION_TERMINATION_RECOVERY_DIAGNOSTIC_REQUIRED");
      }
      const now = validTime(input.now);
      const rows = await sql.unsafe<RuntimeSessionRow[]>(
        `UPDATE runtime_sessions AS rs
            SET state = 'drained',
                drained_at = COALESCE(rs.drained_at, $6),
                drain_evidence = $5::text::jsonb,
                heartbeat_at = $6,
                diagnostic = LEFT(CONCAT_WS(E'\\n', NULLIF(rs.diagnostic, ''), $7::text), 4000),
                state_version = rs.state_version + 1,
                updated_at = $6
           FROM run_termination_requests AS rr
          WHERE rs.session_id = $1
            AND rs.state = 'quarantined'
            AND rs.state_version = $2
            AND rr.request_id = $3
            AND rr.run_id = rs.run_id
            AND rr.owner_instance_id = $4
            AND rr.state = 'draining'
          RETURNING rs.*`,
        [
          RuntimeSessionIdSchema.parse(input.sessionId),
          input.expectedStateVersion,
          input.terminationRequestId,
          input.terminationOwnerInstanceId,
          JSON.stringify(evidence),
          now,
          input.diagnostic.slice(0, 4_000),
        ],
      );
      if (rows.length === 1) return mapRuntimeSession(rows[0]!);

      const current = await findById(input.sessionId);
      if (!current) throw new Error("RUNTIME_SESSION_NOT_FOUND");
      if (["drained", "released"].includes(current.state)) {
        RuntimeDrainEvidenceV1Schema.parse(current.drainEvidence);
        return current;
      }
      throw new Error(`RUNTIME_SESSION_TERMINATION_RECOVERY_CAS_LOST:${current.state}`);
    },
    async quarantine(input: Readonly<{
      sessionId: string;
      expectedOwnerInstanceId: string;
      expectedStateVersion: number;
      diagnostic: string;
      evidence?: Record<string, unknown>;
      now?: Date;
    }>): Promise<ClaimRuntimeSession> {
      if (!input.diagnostic.trim()) throw new Error("RUNTIME_SESSION_QUARANTINE_DIAGNOSTIC_REQUIRED");
      if (!input.expectedOwnerInstanceId.trim()) {
        throw new Error("RUNTIME_SESSION_QUARANTINE_OWNER_REQUIRED");
      }
      if (!Number.isSafeInteger(input.expectedStateVersion) || input.expectedStateVersion < 0) {
        throw new Error("RUNTIME_SESSION_QUARANTINE_STATE_VERSION_INVALID");
      }
      const now = validTime(input.now);
      const rows = await sql.unsafe<RuntimeSessionRow[]>(
        `UPDATE runtime_sessions
            SET state = 'quarantined', diagnostic = $2,
                drain_evidence = CASE
                  WHEN state = 'drained'
                   AND drain_evidence->>'schema' = 'setfarm.runtime-drain-evidence.v1'
                    THEN drain_evidence
                  ELSE $3::text::jsonb
                END,
                state_version = state_version + 1, updated_at = $4
          WHERE session_id = $1
            AND owner_instance_id = $5
            AND state_version = $6
            AND state IN ('reserved', 'starting', 'running', 'drain_requested', 'drained')
          RETURNING *`,
        [
          RuntimeSessionIdSchema.parse(input.sessionId),
          input.diagnostic.slice(0, 4_000),
          JSON.stringify(input.evidence ?? {}),
          now,
          input.expectedOwnerInstanceId,
          input.expectedStateVersion,
        ],
      );
      if (rows.length === 1) return mapRuntimeSession(rows[0]!);

      const current = await findById(input.sessionId);
      if (!current) throw new Error("RUNTIME_SESSION_NOT_FOUND");
      // Quarantine and release are both terminal runtime-session states. A
      // lost-response replay may observe either one, but it must never rewrite
      // that terminal receipt or turn release back into quarantine.
      if (["quarantined", "released"].includes(current.state)) return current;
      throw new Error("RUNTIME_SESSION_QUARANTINE_CAS_LOST");
    },
    async listRecoverable(input: Readonly<{
      ownerInstanceId?: string;
      runId?: string;
      limit?: number;
    }> = {}): Promise<ClaimRuntimeSession[]> {
      const limit = Math.max(1, Math.min(500, Math.trunc(input.limit ?? 100)));
      const rows = await sql.unsafe<RuntimeSessionRow[]>(
        `SELECT * FROM runtime_sessions
          WHERE state IN ('reserved', 'starting', 'running', 'drain_requested', 'drained', 'quarantined')
            AND ($1::text IS NULL OR owner_instance_id = $1)
            AND ($2::text IS NULL OR run_id = $2)
          ORDER BY created_at, session_id
          LIMIT $3`,
        [input.ownerInstanceId ?? null, input.runId ?? null, limit],
      );
      return rows.map(mapRuntimeSession);
    },
  });
}

/**
 * Release a runtime that provably never crossed the reserved -> starting CAS.
 * The claim (and any bound attempt) must already be terminal. This is the only
 * safe shortcut around process-drain evidence because `reserved` means no
 * runtime launch was authorized.
 */
export async function releaseReservedRuntimeSessionInTransaction(
  sql: Sql | TransactionSql,
  input: Readonly<{
    sessionId: string;
    claimId: number;
    ownerInstanceId: string;
    diagnostic: string;
    now?: Date;
  }>,
): Promise<ClaimRuntimeSession> {
  const now = validTime(input.now);
  const rows = await sql.unsafe<RuntimeSessionRow[]>(
    `SELECT rs.*
       FROM runtime_sessions rs
       JOIN claim_log cl ON cl.id = rs.claim_id
      WHERE rs.session_id = $1
        AND rs.claim_id = $2
        AND rs.owner_instance_id = $3
      FOR UPDATE OF rs, cl`,
    [RuntimeSessionIdSchema.parse(input.sessionId), input.claimId, input.ownerInstanceId],
  );
  const current = rows[0];
  if (!current) throw new Error("RUNTIME_SESSION_RESERVED_RELEASE_NOT_FOUND");
  if (current.state === "released") return mapRuntimeSession(current);
  if (current.state !== "reserved") {
    throw new Error(`RUNTIME_SESSION_RESERVED_RELEASE_STATE_INVALID:${current.state}`);
  }
  const claims = await sql.unsafe<Array<{ outcome: string | null }>>(
    "SELECT outcome FROM claim_log WHERE id = $1",
    [input.claimId],
  );
  if (claims[0]?.outcome == null) throw new Error("RUNTIME_SESSION_RESERVED_RELEASE_CLAIM_ACTIVE");
  const activeAttempts = await sql.unsafe<Array<{ attempt_id: string }>>(
    `SELECT attempt_id FROM execution_attempts
      WHERE claim_id = $1 AND disposition IN ('claimed', 'running')
      FOR UPDATE`,
    [input.claimId],
  );
  if (activeAttempts.length > 0) throw new Error("RUNTIME_SESSION_RESERVED_RELEASE_ATTEMPT_ACTIVE");
  const updated = await sql.unsafe<RuntimeSessionRow[]>(
    `UPDATE runtime_sessions
        SET state = 'released', drained_at = $4, released_at = $4,
            diagnostic = $5,
            drain_evidence = $6::text::jsonb,
            state_version = state_version + 1, updated_at = $4
      WHERE session_id = $1 AND claim_id = $2
        AND owner_instance_id = $3 AND state = 'reserved'
      RETURNING *`,
    [
      current.session_id,
      input.claimId,
      input.ownerInstanceId,
      now,
      input.diagnostic.slice(0, 4_000),
      JSON.stringify({
        schema: "setfarm.no-spawn-release-evidence.v1",
        observedAt: now.toISOString(),
        sourceState: "reserved",
      }),
    ],
  );
  if (updated.length !== 1) throw new Error("RUNTIME_SESSION_RESERVED_RELEASE_CAS_LOST");
  return mapRuntimeSession(updated[0]!);
}

export async function releaseDrainedRuntimeSessionsInTransaction(
  sql: Sql | TransactionSql,
  input: Readonly<{ runId: string; now?: Date }>,
): Promise<number> {
  const now = validTime(input.now);
  const owners = await sql.unsafe<Array<{ session_id: string; claim_outcome: string | null }>>(
    `SELECT rs.session_id, cl.outcome AS claim_outcome
       FROM runtime_sessions rs
       JOIN claim_log cl ON cl.id = rs.claim_id
      WHERE rs.run_id = $1
        AND rs.state = 'drained'
      FOR UPDATE OF rs, cl`,
    [input.runId],
  );
  if (owners.some((owner) => owner.claim_outcome === null)) {
    throw new Error("RUNTIME_SESSION_RELEASE_OWNER_ACTIVE");
  }
  const activeAttempts = await sql.unsafe<Array<{ attempt_id: string }>>(
    `SELECT ea.attempt_id
       FROM execution_attempts ea
       JOIN runtime_sessions rs ON rs.attempt_id = ea.attempt_id
      WHERE rs.run_id = $1 AND rs.state = 'drained'
        AND ea.disposition IN ('claimed', 'running')
      FOR UPDATE OF ea`,
    [input.runId],
  );
  if (activeAttempts.length > 0) throw new Error("RUNTIME_SESSION_RELEASE_OWNER_ACTIVE");
  const rows = await sql.unsafe<Array<{ session_id: string }>>(
    `UPDATE runtime_sessions
        SET state = 'released', released_at = $2,
            state_version = state_version + 1, updated_at = $2
      WHERE run_id = $1 AND state = 'drained'
      RETURNING session_id`,
    [input.runId, now],
  );
  return rows.length;
}

export async function releaseDrainedRuntimeSessionInTransaction(
  sql: Sql | TransactionSql,
  input: Readonly<{
    sessionId: string;
    claimId: number;
    ownerInstanceId?: string;
    now?: Date;
  }>,
): Promise<ClaimRuntimeSession> {
  const now = validTime(input.now);
  const rows = await sql.unsafe<Array<RuntimeSessionRow & { claim_outcome: string | null }>>(
    `SELECT rs.*, cl.outcome AS claim_outcome
       FROM runtime_sessions rs
       JOIN claim_log cl ON cl.id = rs.claim_id
      WHERE rs.session_id = $1 AND rs.claim_id = $2
        AND ($3::text IS NULL OR rs.owner_instance_id = $3)
      FOR UPDATE OF rs, cl`,
    [RuntimeSessionIdSchema.parse(input.sessionId), input.claimId, input.ownerInstanceId ?? null],
  );
  const current = rows[0];
  if (!current) throw new Error("RUNTIME_SESSION_DRAINED_RELEASE_NOT_FOUND");
  if (current.state === "released") return mapRuntimeSession(current);
  if (current.state !== "drained") {
    throw new Error(`RUNTIME_SESSION_DRAINED_RELEASE_STATE_INVALID:${current.state}`);
  }
  if (current.claim_outcome === null) throw new Error("RUNTIME_SESSION_DRAINED_RELEASE_CLAIM_ACTIVE");
  const activeAttempts = await sql.unsafe<Array<{ attempt_id: string }>>(
    `SELECT attempt_id FROM execution_attempts
      WHERE claim_id = $1 AND disposition IN ('claimed', 'running')
      FOR UPDATE`,
    [input.claimId],
  );
  if (activeAttempts.length > 0) throw new Error("RUNTIME_SESSION_DRAINED_RELEASE_ATTEMPT_ACTIVE");
  const updated = await sql.unsafe<RuntimeSessionRow[]>(
    `UPDATE runtime_sessions
        SET state = 'released', released_at = $4,
            state_version = state_version + 1, updated_at = $4
      WHERE session_id = $1 AND claim_id = $2
        AND ($3::text IS NULL OR owner_instance_id = $3)
        AND state = 'drained'
      RETURNING *`,
    [current.session_id, input.claimId, input.ownerInstanceId ?? null, now],
  );
  if (updated.length !== 1) throw new Error("RUNTIME_SESSION_DRAINED_RELEASE_CAS_LOST");
  return mapRuntimeSession(updated[0]!);
}
