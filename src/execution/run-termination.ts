import { randomUUID } from "node:crypto";

import type postgres from "postgres";
import { z } from "zod";

import { readDatabaseWallClock } from "../db/database-wall-clock.js";
import {
  transitionRunToTerminal,
  type RunTerminalTransitionResult,
} from "./run-terminal-transition.js";
import { evaluateOperationalFailureCauseEvidenceAuthorityV1 } from "./operational-failure-cause-authority-v1.js";
import {
  OPERATIONAL_FAILURE_CAUSE_EVIDENCE_KEY,
  OperationalFailureCauseV1Schema,
  assertOperationalFailureCauseEvidenceKeyAbsent,
  operationalFailureCauseFromEvidenceV1,
  operationalFailureCauseHashV1,
  type OperationalFailureCauseV1,
} from "./schemas/operational-failure-cause-v1.js";

const TerminationRequestIdSchema = z.string().regex(/^RTR_[A-Za-z0-9-]{16,160}$/);
const TargetStatusSchema = z.enum(["cancelled", "failed"]);
const TerminationStateSchema = z.enum([
  "requested",
  "draining",
  "drained",
  "terminalized",
  "quarantined",
]);

type RequestRow = Readonly<{
  request_id: string;
  run_id: string;
  target_status: string;
  state: string;
  requested_by: string;
  owner_instance_id: string | null;
  lease_expires_at: Date | string | null;
  heartbeat_at: Date | string | null;
  requested_at: Date | string;
  drained_at: Date | string | null;
  terminalized_at: Date | string | null;
  diagnostic: string;
  evidence: unknown;
  created_at: Date | string;
  updated_at: Date | string;
}>;

export type RunTerminationRequest = Readonly<{
  requestId: string;
  runId: string;
  targetStatus: "cancelled" | "failed";
  state: z.infer<typeof TerminationStateSchema>;
  requestedBy: string;
  ownerInstanceId?: string;
  leaseExpiresAt?: string;
  heartbeatAt?: string;
  requestedAt: string;
  drainedAt?: string;
  terminalizedAt?: string;
  diagnostic: string;
  evidence: Record<string, unknown>;
  failureCause?: OperationalFailureCauseV1;
  createdAt: string;
  updatedAt: string;
}>;

function time(value: Date | undefined): Date {
  const parsed = value ? new Date(value) : new Date();
  if (!Number.isFinite(parsed.getTime())) throw new Error("RUN_TERMINATION_TIME_INVALID");
  return parsed;
}

function timestamp(value: Date | string): string {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

function optionalTimestamp(value: Date | string | null): string | undefined {
  return value === null ? undefined : timestamp(value);
}

function mapRequest(row: RequestRow): RunTerminationRequest {
  const evidence = typeof row.evidence === "string" ? JSON.parse(row.evidence) as unknown : row.evidence;
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) {
    throw new Error("RUN_TERMINATION_EVIDENCE_INVALID");
  }
  const typedEvidence = evidence as Record<string, unknown>;
  const failureCause = operationalFailureCauseFromEvidenceV1(typedEvidence);
  return Object.freeze({
    requestId: TerminationRequestIdSchema.parse(row.request_id),
    runId: row.run_id,
    targetStatus: TargetStatusSchema.parse(row.target_status),
    state: TerminationStateSchema.parse(row.state),
    requestedBy: row.requested_by,
    ...(row.owner_instance_id ? { ownerInstanceId: row.owner_instance_id } : {}),
    ...(optionalTimestamp(row.lease_expires_at) ? { leaseExpiresAt: optionalTimestamp(row.lease_expires_at) } : {}),
    ...(optionalTimestamp(row.heartbeat_at) ? { heartbeatAt: optionalTimestamp(row.heartbeat_at) } : {}),
    requestedAt: timestamp(row.requested_at),
    ...(optionalTimestamp(row.drained_at) ? { drainedAt: optionalTimestamp(row.drained_at) } : {}),
    ...(optionalTimestamp(row.terminalized_at) ? { terminalizedAt: optionalTimestamp(row.terminalized_at) } : {}),
    diagnostic: row.diagnostic,
    evidence: Object.freeze({ ...typedEvidence }),
    ...(failureCause ? { failureCause: Object.freeze(failureCause) } : {}),
    createdAt: timestamp(row.created_at),
    updatedAt: timestamp(row.updated_at),
  });
}

export function newRunTerminationRequestId(): string {
  return `RTR_${randomUUID()}`;
}

export type RequestRunTerminationResult =
  | Readonly<{ status: "requested" | "existing"; request: RunTerminationRequest }>
  | Readonly<{ status: "already_terminal"; runId: string; targetStatus: "cancelled" | "failed" }>;

export type RequestRunTerminationInput = Readonly<{
  runId: string;
  targetStatus: "cancelled" | "failed";
  requestedBy: string;
  diagnostic: string;
  evidence?: Record<string, unknown>;
  failureCause?: OperationalFailureCauseV1;
  requestId?: string;
  now?: Date;
}>;

export async function requestRunTerminationInTransaction(
  sql: postgres.TransactionSql,
  rawInput: RequestRunTerminationInput,
): Promise<RequestRunTerminationResult> {
  const input = z.object({
    runId: z.string().min(1).max(500),
    targetStatus: TargetStatusSchema,
    requestedBy: z.string().min(1).max(500),
    diagnostic: z.string().min(1).max(4_000),
    evidence: z.record(z.string(), z.unknown()).optional(),
    failureCause: OperationalFailureCauseV1Schema.optional(),
    requestId: TerminationRequestIdSchema.optional(),
    now: z.date().optional(),
  }).strict().superRefine((value, context) => {
    if (value.targetStatus === "cancelled" && value.failureCause) {
      context.addIssue({
        code: "custom",
        path: ["failureCause"],
        message: "Cancelled termination cannot carry an operational failure cause",
      });
    }
  }).parse(rawInput);
  assertOperationalFailureCauseEvidenceKeyAbsent(input.evidence);
  if (input.failureCause) {
    const authority = evaluateOperationalFailureCauseEvidenceAuthorityV1({
      requestedBy: input.requestedBy,
      cause: input.failureCause,
      evidence: input.evidence ?? {},
    });
    if (!authority.trusted) {
      throw new Error(`RUN_TERMINATION_FAILURE_CAUSE_AUTHORITY_INVALID:${authority.reasonCode}`);
    }
  }
  time(input.now);
  const runs = await sql.unsafe<Array<{ status: string }>>(
    "SELECT status FROM runs WHERE id = $1 FOR UPDATE",
    [input.runId],
  );
  const run = runs[0];
  if (!run) throw new Error("RUN_TERMINATION_RUN_NOT_FOUND");
  if (run.status === input.targetStatus) {
    return { status: "already_terminal" as const, runId: input.runId, targetStatus: input.targetStatus };
  }
  const existing = await sql.unsafe<RequestRow[]>(
    `SELECT * FROM run_termination_requests
      WHERE run_id = $1 AND state <> 'terminalized'
      LIMIT 1 FOR UPDATE`,
    [input.runId],
  );
  if (existing[0]) {
    if (existing[0].target_status !== input.targetStatus) {
      throw new Error("RUN_TERMINATION_TARGET_CONFLICT");
    }
    const existingRequest = mapRequest(existing[0]);
    if (
      input.failureCause
      && (!existingRequest.failureCause
        || operationalFailureCauseHashV1(existingRequest.failureCause)
          !== operationalFailureCauseHashV1(input.failureCause))
    ) {
      throw new Error("RUN_TERMINATION_FAILURE_CAUSE_CONFLICT");
    }
    if (input.failureCause && existingRequest.requestedBy !== input.requestedBy) {
      throw new Error("RUN_TERMINATION_FAILURE_CAUSE_REQUESTER_CONFLICT");
    }
    return { status: "existing" as const, request: existingRequest };
  }
  if (!["running", "resuming"].includes(run.status)) {
    throw new Error(`RUN_TERMINATION_SOURCE_STATUS_INVALID:${run.status}`);
  }
  const requestId = input.requestId ?? newRunTerminationRequestId();
  const sourceStatus = input.targetStatus === "cancelled" ? "cancelling" : "failing";
  const activeCompletionOwner = await sql.unsafe<Array<{ request_id: string }>>(
    `SELECT request_id FROM runtime_completion_requests
      WHERE run_id = $1 AND state IN ('draining', 'processing')
      LIMIT 1 FOR UPDATE`,
    [input.runId],
  );
  const now = await readDatabaseWallClock(sql, "RUN_TERMINATION_DATABASE_TIME_UNAVAILABLE");
  const deferredForCompletion = activeCompletionOwner.length > 0;
  if (!deferredForCompletion) {
    const updated = await sql.unsafe<Array<{ id: string }>>(
      `UPDATE runs SET status = $2, updated_at = $3
        WHERE id = $1 AND status IN ('running', 'resuming')
        RETURNING id`,
      [input.runId, sourceStatus, now],
    );
    if (updated.length !== 1) throw new Error("RUN_TERMINATION_RUN_CAS_LOST");
  }
  const inserted = await sql.unsafe<RequestRow[]>(
    `INSERT INTO run_termination_requests (
       request_id, run_id, target_status, state, requested_by,
       requested_at, diagnostic, evidence, created_at, updated_at
     ) VALUES ($1, $2, $3, 'requested', $4, $5, $6, $7::text::jsonb, $5, $5)
     RETURNING *`,
    [
      requestId,
      input.runId,
      input.targetStatus,
      input.requestedBy,
      now,
      input.diagnostic,
      JSON.stringify({
        ...(input.evidence ?? {}),
        ...(input.failureCause ? {
          [OPERATIONAL_FAILURE_CAUSE_EVIDENCE_KEY]: input.failureCause,
        } : {}),
        ...(deferredForCompletion ? {
          deferredForCompletionRequestId: activeCompletionOwner[0]!.request_id,
        } : {}),
      }),
    ],
  );
  if (inserted.length !== 1) throw new Error("RUN_TERMINATION_REQUEST_INSERT_FAILED");
  return { status: "requested" as const, request: mapRequest(inserted[0]!) };
}

export async function requestRunTermination(
  sql: postgres.Sql,
  input: RequestRunTerminationInput,
): Promise<RequestRunTerminationResult> {
  return sql.begin((transaction) => requestRunTerminationInTransaction(transaction, input)) as Promise<RequestRunTerminationResult>;
}

export async function processRunTerminationBatch(input: Readonly<{
  candidates: readonly RunTerminationRequest[];
  process: (candidate: RunTerminationRequest) => Promise<"processed" | "skipped">;
  quarantine: (candidate: RunTerminationRequest, diagnostic: string) => Promise<void>;
  warn?: (message: string) => void;
}>): Promise<number> {
  let processed = 0;
  for (const candidate of input.candidates) {
    if (candidate.state === "terminalized" || candidate.state === "quarantined") continue;
    try {
      if (await input.process(candidate) === "processed") processed += 1;
    } catch (error) {
      const diagnostic = `RUN_TERMINATION_QUARANTINED: ${String(error).slice(0, 1_000)}`;
      try {
        await input.quarantine(candidate, diagnostic);
      } catch (quarantineError) {
        input.warn?.(
          `${diagnostic}; quarantine failed: ${String(quarantineError).slice(0, 500)}`,
        );
        continue;
      }
      processed += 1;
      input.warn?.(diagnostic);
    }
  }
  return processed;
}

export function createRunTerminationRepository(sql: postgres.Sql) {
  return Object.freeze({
    async findById(requestId: string): Promise<RunTerminationRequest | undefined> {
      const rows = await sql.unsafe<RequestRow[]>(
        "SELECT * FROM run_termination_requests WHERE request_id = $1 LIMIT 1",
        [TerminationRequestIdSchema.parse(requestId)],
      );
      return rows[0] ? mapRequest(rows[0]) : undefined;
    },
    async claim(input: Readonly<{
      ownerInstanceId: string;
      requestId?: string;
      leaseMs?: number;
      now?: Date;
    }>): Promise<RunTerminationRequest | undefined> {
      time(input.now);
      const leaseMs = Math.max(5_000, Math.min(300_000, Math.trunc(input.leaseMs ?? 30_000)));
      return sql.begin(async (transaction) => {
        const candidates = await transaction.unsafe<Array<{ request_id: string; run_id: string }>>(
          `SELECT request_id, run_id FROM run_termination_requests
            WHERE ($1::text IS NULL OR request_id = $1)
              AND (
                state = 'requested'
                OR (state = 'draining' AND (lease_expires_at IS NULL OR lease_expires_at <= clock_timestamp()))
              )
            ORDER BY requested_at, request_id
            LIMIT 1`,
          [input.requestId ?? null],
        );
        const candidate = candidates[0];
        if (!candidate) return undefined;
        const runs = await transaction.unsafe<Array<{ status: string }>>(
          "SELECT status FROM runs WHERE id = $1 FOR UPDATE",
          [candidate.run_id],
        );
        // Match the completion claimant's run -> completion -> termination
        // order. The run row serializes all same-run recovery ownership, and a
        // processing completion remains the only non-preemptible phase.
        const activeCompletionOwner = await transaction.unsafe<Array<{ request_id: string }>>(
          `SELECT request_id FROM runtime_completion_requests
            WHERE run_id = $1 AND state IN ('draining', 'processing')
            LIMIT 1 FOR UPDATE`,
          [candidate.run_id],
        );
        if (activeCompletionOwner.length > 0) return undefined;
        const rows = await transaction.unsafe<RequestRow[]>(
          `SELECT * FROM run_termination_requests
            WHERE request_id = $1
              AND (
                state = 'requested'
                OR (state = 'draining' AND (lease_expires_at IS NULL OR lease_expires_at <= clock_timestamp()))
              )
            FOR UPDATE SKIP LOCKED`,
          [candidate.request_id],
        );
        const request = rows[0];
        if (!request) return undefined;
        const now = await readDatabaseWallClock(
          transaction,
          "RUN_TERMINATION_DATABASE_TIME_UNAVAILABLE",
        );
        if (
          request.state === "draining"
          && request.lease_expires_at
          && new Date(request.lease_expires_at).getTime() > now.getTime()
        ) return undefined;
        const leaseExpiresAt = new Date(now.getTime() + leaseMs);
        const sourceStatus = request.target_status === "cancelled" ? "cancelling" : "failing";
        const runStatus = runs[0]?.status;
        if (['running', 'resuming'].includes(runStatus ?? "")) {
          const updatedRun = await transaction.unsafe<Array<{ id: string }>>(
            `UPDATE runs SET status = $2, updated_at = $3
              WHERE id = $1 AND status IN ('running', 'resuming')
              RETURNING id`,
            [request.run_id, sourceStatus, now],
          );
          if (updatedRun.length !== 1) throw new Error("RUN_TERMINATION_RUN_CAS_LOST");
        } else if (runStatus !== sourceStatus) {
          throw new Error(`RUN_TERMINATION_SOURCE_STATUS_INVALID:${runStatus ?? "missing"}`);
        }
        const updated = await transaction.unsafe<RequestRow[]>(
          `UPDATE run_termination_requests
              SET state = 'draining', owner_instance_id = $2,
                  lease_expires_at = $3, heartbeat_at = $4, updated_at = $4
            WHERE request_id = $1
              AND (
                state = 'requested'
                OR (state = 'draining' AND (lease_expires_at IS NULL OR lease_expires_at <= $4))
              )
            RETURNING *`,
          [request.request_id, input.ownerInstanceId, leaseExpiresAt, now],
        );
        if (updated.length !== 1) return undefined;
        await transaction.unsafe(
          `UPDATE runtime_sessions
              SET state = 'drain_requested',
                  drain_requested_at = COALESCE(drain_requested_at, $2),
                  diagnostic = $3,
                  state_version = state_version + 1,
                  updated_at = $2
            WHERE run_id = $1
              AND state IN ('reserved', 'starting', 'running')`,
          [request.run_id, now, `Run termination ${request.request_id} requested runtime drain`],
        );
        return mapRequest(updated[0]!);
      }) as Promise<RunTerminationRequest | undefined>;
    },
    async heartbeat(input: Readonly<{
      requestId: string;
      ownerInstanceId: string;
      leaseMs?: number;
      now?: Date;
    }>): Promise<boolean> {
      time(input.now);
      const leaseMs = Math.max(5_000, Math.min(300_000, Math.trunc(input.leaseMs ?? 30_000)));
      const requestId = TerminationRequestIdSchema.parse(input.requestId);
      const identity = await sql.unsafe<Array<{ run_id: string }>>(
        "SELECT run_id FROM run_termination_requests WHERE request_id = $1",
        [requestId],
      );
      if (!identity[0]) return false;
      return sql.begin(async (transaction) => {
        await transaction.unsafe("SELECT id FROM runs WHERE id = $1 FOR UPDATE", [identity[0]!.run_id]);
        const locked = await transaction.unsafe<RequestRow[]>(
          "SELECT * FROM run_termination_requests WHERE request_id = $1 FOR UPDATE",
          [requestId],
        );
        const current = locked[0];
        const now = await readDatabaseWallClock(
          transaction,
          "RUN_TERMINATION_DATABASE_TIME_UNAVAILABLE",
        );
        if (
          !current
          || current.state !== "draining"
          || current.owner_instance_id !== input.ownerInstanceId
          || !current.lease_expires_at
          || new Date(current.lease_expires_at).getTime() <= now.getTime()
        ) return false;
        const rows = await transaction.unsafe<Array<{ request_id: string }>>(
          `UPDATE run_termination_requests
              SET heartbeat_at = $3, lease_expires_at = $4, updated_at = $3
            WHERE request_id = $1 AND owner_instance_id = $2 AND state = 'draining'
              AND lease_expires_at > $3
            RETURNING request_id`,
          [requestId, input.ownerInstanceId, now, new Date(now.getTime() + leaseMs)],
        );
        return rows.length === 1;
      }) as Promise<boolean>;
    },
    async markDrained(input: Readonly<{
      requestId: string;
      ownerInstanceId: string;
      evidence?: Record<string, unknown>;
      now?: Date;
    }>): Promise<RunTerminationRequest> {
      assertOperationalFailureCauseEvidenceKeyAbsent(input.evidence);
      time(input.now);
      const requestId = TerminationRequestIdSchema.parse(input.requestId);
      const identity = await sql.unsafe<Array<{ run_id: string }>>(
        "SELECT run_id FROM run_termination_requests WHERE request_id = $1",
        [requestId],
      );
      if (!identity[0]) throw new Error("RUN_TERMINATION_REQUEST_NOT_FOUND");
      return sql.begin(async (transaction) => {
        await transaction.unsafe("SELECT id FROM runs WHERE id = $1 FOR UPDATE", [identity[0]!.run_id]);
        const rows = await transaction.unsafe<RequestRow[]>(
          `SELECT * FROM run_termination_requests
            WHERE request_id = $1 FOR UPDATE`,
          [requestId],
        );
        const request = rows[0];
        if (!request) throw new Error("RUN_TERMINATION_REQUEST_NOT_FOUND");
        if (request.state === "drained") return mapRequest(request);
        if (request.state !== "draining" || request.owner_instance_id !== input.ownerInstanceId) {
          throw new Error("RUN_TERMINATION_DRAIN_OWNER_MISMATCH");
        }
        const runtimes = await transaction.unsafe<Array<{
          session_id: string;
          state: string;
          claim_id: string | number;
        }>>(
          `SELECT session_id, state, claim_id FROM runtime_sessions
            WHERE run_id = $1 ORDER BY session_id FOR UPDATE`,
          [request.run_id],
        );
        const claims = await transaction.unsafe<Array<{ id: string; outcome: string | null }>>(
          `SELECT id::text, outcome FROM claim_log
            WHERE run_id = $1 ORDER BY id FOR UPDATE`,
          [request.run_id],
        );
        const now = await readDatabaseWallClock(
          transaction,
          "RUN_TERMINATION_DATABASE_TIME_UNAVAILABLE",
        );
        if (
          !request.lease_expires_at
          || new Date(request.lease_expires_at).getTime() <= now.getTime()
        ) {
          throw new Error("RUN_TERMINATION_DRAIN_LEASE_EXPIRED");
        }
        const undrained = runtimes.filter((runtime) => !["drained", "released"].includes(runtime.state));
        if (undrained.length > 0) {
          throw new Error(`RUN_TERMINATION_RUNTIME_NOT_DRAINED:${undrained.length}`);
        }
        const runtimeClaimIds = new Set(runtimes.map((runtime) => String(runtime.claim_id)));
        const missingSessions = claims.filter((claim) =>
          claim.outcome === null && !runtimeClaimIds.has(claim.id));
        if (missingSessions.length > 0) {
          throw new Error(`RUN_TERMINATION_OPEN_CLAIM_SESSION_MISSING:${missingSessions.length}`);
        }
        const updated = await transaction.unsafe<RequestRow[]>(
          `UPDATE run_termination_requests
              SET state = 'drained', drained_at = $3, heartbeat_at = $3,
                  evidence = (evidence || $4::text::jsonb), updated_at = $3
            WHERE request_id = $1 AND owner_instance_id = $2 AND state = 'draining'
              AND lease_expires_at > $3
            RETURNING *`,
          [request.request_id, input.ownerInstanceId, now, JSON.stringify(input.evidence ?? {})],
        );
        if (updated.length !== 1) throw new Error("RUN_TERMINATION_DRAIN_CAS_LOST");
        return mapRequest(updated[0]!);
      }) as Promise<RunTerminationRequest>;
    },
    async quarantine(input: Readonly<{
      requestId: string;
      ownerInstanceId?: string;
      diagnostic: string;
      evidence?: Record<string, unknown>;
      now?: Date;
    }>): Promise<RunTerminationRequest> {
      if (!input.diagnostic.trim()) throw new Error("RUN_TERMINATION_QUARANTINE_DIAGNOSTIC_REQUIRED");
      assertOperationalFailureCauseEvidenceKeyAbsent(input.evidence);
      time(input.now);
      const requestId = TerminationRequestIdSchema.parse(input.requestId);
      const identity = await sql.unsafe<Array<{ run_id: string }>>(
        "SELECT run_id FROM run_termination_requests WHERE request_id = $1",
        [requestId],
      );
      if (!identity[0]) throw new Error("RUN_TERMINATION_QUARANTINE_FAILED");
      return sql.begin(async (transaction) => {
        await transaction.unsafe("SELECT id FROM runs WHERE id = $1 FOR UPDATE", [identity[0]!.run_id]);
        const locked = await transaction.unsafe<RequestRow[]>(
          "SELECT * FROM run_termination_requests WHERE request_id = $1 FOR UPDATE",
          [requestId],
        );
        const current = locked[0];
        if (
          !current
          || current.state === "terminalized"
          || (input.ownerInstanceId !== undefined
            && current.owner_instance_id !== input.ownerInstanceId)
        ) throw new Error("RUN_TERMINATION_QUARANTINE_FAILED");
        const now = await readDatabaseWallClock(
          transaction,
          "RUN_TERMINATION_DATABASE_TIME_UNAVAILABLE",
        );
        const rows = await transaction.unsafe<RequestRow[]>(
          `UPDATE run_termination_requests
              SET state = 'quarantined', diagnostic = $3,
                  evidence = (evidence || $4::text::jsonb), updated_at = $5
            WHERE request_id = $1
              AND ($2::text IS NULL OR owner_instance_id = $2)
              AND state <> 'terminalized'
            RETURNING *`,
          [
            requestId,
            input.ownerInstanceId ?? null,
            input.diagnostic.slice(0, 4_000),
            JSON.stringify(input.evidence ?? {}),
            now,
          ],
        );
        if (rows.length !== 1) throw new Error("RUN_TERMINATION_QUARANTINE_FAILED");
        return mapRequest(rows[0]!);
      }) as Promise<RunTerminationRequest>;
    },
    async listPending(limit = 100): Promise<RunTerminationRequest[]> {
      const bounded = Math.max(1, Math.min(500, Math.trunc(limit)));
      const rows = await sql.unsafe<RequestRow[]>(
        `SELECT * FROM run_termination_requests
          WHERE state IN ('requested', 'drained')
             OR (state = 'draining' AND (lease_expires_at IS NULL OR lease_expires_at <= clock_timestamp()))
          ORDER BY requested_at, request_id LIMIT $1`,
        [bounded],
      );
      return rows.map(mapRequest);
    },
    async terminalize(input: Readonly<{
      requestId: string;
      diagnostic?: string;
      now?: Date;
    }>): Promise<RunTerminalTransitionResult> {
      const request = await this.findById(input.requestId);
      if (!request) throw new Error("RUN_TERMINATION_REQUEST_NOT_FOUND");
      if (request.state === "terminalized") {
        const rows = await sql.unsafe<Array<{ status: string }>>(
          "SELECT status FROM runs WHERE id = $1",
          [request.runId],
        );
        if (rows[0]?.status !== request.targetStatus) throw new Error("RUN_TERMINATION_TERMINAL_STATE_DRIFT");
        // Re-enter the canonical terminal owner so historical residue from a
        // pre-fence release (attempt, recovery delivery/case, or claim) is
        // reconciled under the same run lock instead of being declared clean.
        return transitionRunToTerminal(sql, {
          runId: request.runId,
          status: request.targetStatus,
          diagnostic: input.diagnostic ?? request.diagnostic,
          now: input.now,
        });
      }
      if (request.state !== "drained") throw new Error("RUN_TERMINATION_REQUEST_NOT_DRAINED");
      return transitionRunToTerminal(sql, {
        runId: request.runId,
        status: request.targetStatus,
        diagnostic: input.diagnostic ?? request.diagnostic,
        ...(request.targetStatus === "failed" && typeof request.evidence.terminalFailure === "boolean"
          ? { terminalFailure: request.evidence.terminalFailure }
          : {}),
        drainedTerminationRequestId: request.requestId,
        now: input.now,
      });
    },
  });
}
