import { randomUUID } from "node:crypto";

import type postgres from "postgres";
import { z } from "zod";

import {
  transitionRunToTerminal,
  type RunTerminalTransitionResult,
} from "./run-terminal-transition.js";

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
    evidence: Object.freeze({ ...(evidence as Record<string, unknown>) }),
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
  requestId?: string;
  now?: Date;
}>;

export async function requestRunTerminationInTransaction(
  sql: postgres.Sql | postgres.TransactionSql,
  rawInput: RequestRunTerminationInput,
): Promise<RequestRunTerminationResult> {
  const input = z.object({
    runId: z.string().min(1).max(500),
    targetStatus: TargetStatusSchema,
    requestedBy: z.string().min(1).max(500),
    diagnostic: z.string().min(1).max(4_000),
    evidence: z.record(z.string(), z.unknown()).optional(),
    requestId: TerminationRequestIdSchema.optional(),
    now: z.date().optional(),
  }).strict().parse(rawInput);
  const now = time(input.now);
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
    return { status: "existing" as const, request: mapRequest(existing[0]) };
  }
  if (!["running", "resuming"].includes(run.status)) {
    throw new Error(`RUN_TERMINATION_SOURCE_STATUS_INVALID:${run.status}`);
  }
  const requestId = input.requestId ?? newRunTerminationRequestId();
  const sourceStatus = input.targetStatus === "cancelled" ? "cancelling" : "failing";
  const activeCompletionOwner = await sql.unsafe<Array<{ request_id: string }>>(
    `SELECT request_id FROM runtime_completion_requests
      WHERE run_id = $1 AND state IN ('draining', 'processing')
      LIMIT 1`,
    [input.runId],
  );
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
      const now = time(input.now);
      const leaseMs = Math.max(5_000, Math.min(300_000, Math.trunc(input.leaseMs ?? 30_000)));
      const leaseExpiresAt = new Date(now.getTime() + leaseMs);
      return sql.begin(async (transaction) => {
        const candidates = await transaction.unsafe<Array<{ request_id: string; run_id: string }>>(
          `SELECT request_id, run_id FROM run_termination_requests
            WHERE ($1::text IS NULL OR request_id = $1)
              AND (
                state = 'requested'
                OR (state = 'draining' AND (lease_expires_at IS NULL OR lease_expires_at <= $2))
              )
            ORDER BY requested_at, request_id
            LIMIT 1`,
          [input.requestId ?? null, now],
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
                OR (state = 'draining' AND (lease_expires_at IS NULL OR lease_expires_at <= $2))
              )
            FOR UPDATE SKIP LOCKED`,
          [candidate.request_id, now],
        );
        const request = rows[0];
        if (!request) return undefined;
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
      const now = time(input.now);
      const leaseMs = Math.max(5_000, Math.min(300_000, Math.trunc(input.leaseMs ?? 30_000)));
      const rows = await sql.unsafe<Array<{ request_id: string }>>(
        `UPDATE run_termination_requests
            SET heartbeat_at = $3, lease_expires_at = $4, updated_at = $3
          WHERE request_id = $1 AND owner_instance_id = $2 AND state = 'draining'
          RETURNING request_id`,
        [
          TerminationRequestIdSchema.parse(input.requestId),
          input.ownerInstanceId,
          now,
          new Date(now.getTime() + leaseMs),
        ],
      );
      return rows.length === 1;
    },
    async markDrained(input: Readonly<{
      requestId: string;
      ownerInstanceId: string;
      evidence?: Record<string, unknown>;
      now?: Date;
    }>): Promise<RunTerminationRequest> {
      const now = time(input.now);
      return sql.begin(async (transaction) => {
        const rows = await transaction.unsafe<RequestRow[]>(
          `SELECT * FROM run_termination_requests
            WHERE request_id = $1 FOR UPDATE`,
          [TerminationRequestIdSchema.parse(input.requestId)],
        );
        const request = rows[0];
        if (!request) throw new Error("RUN_TERMINATION_REQUEST_NOT_FOUND");
        if (request.state === "drained") return mapRequest(request);
        if (request.state !== "draining" || request.owner_instance_id !== input.ownerInstanceId) {
          throw new Error("RUN_TERMINATION_DRAIN_OWNER_MISMATCH");
        }
        const undrained = await transaction.unsafe<Array<{ count: number }>>(
          `SELECT COUNT(*)::integer AS count FROM runtime_sessions
            WHERE run_id = $1 AND state NOT IN ('drained', 'released')`,
          [request.run_id],
        );
        if ((undrained[0]?.count ?? 0) > 0) {
          throw new Error(`RUN_TERMINATION_RUNTIME_NOT_DRAINED:${undrained[0]!.count}`);
        }
        const missingSessions = await transaction.unsafe<Array<{ count: number }>>(
          `SELECT COUNT(*)::integer AS count
             FROM claim_log cl
             LEFT JOIN runtime_sessions rs ON rs.claim_id = cl.id
            WHERE cl.run_id = $1 AND cl.outcome IS NULL AND rs.session_id IS NULL`,
          [request.run_id],
        );
        if ((missingSessions[0]?.count ?? 0) > 0) {
          throw new Error(`RUN_TERMINATION_OPEN_CLAIM_SESSION_MISSING:${missingSessions[0]!.count}`);
        }
        const updated = await transaction.unsafe<RequestRow[]>(
          `UPDATE run_termination_requests
              SET state = 'drained', drained_at = $3, heartbeat_at = $3,
                  evidence = (evidence || $4::text::jsonb), updated_at = $3
            WHERE request_id = $1 AND owner_instance_id = $2 AND state = 'draining'
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
      const now = time(input.now);
      const rows = await sql.unsafe<RequestRow[]>(
        `UPDATE run_termination_requests
            SET state = 'quarantined', diagnostic = $3,
                evidence = (evidence || $4::text::jsonb), updated_at = $5
          WHERE request_id = $1
            AND ($2::text IS NULL OR owner_instance_id = $2)
            AND state <> 'terminalized'
          RETURNING *`,
        [
          TerminationRequestIdSchema.parse(input.requestId),
          input.ownerInstanceId ?? null,
          input.diagnostic.slice(0, 4_000),
          JSON.stringify(input.evidence ?? {}),
          now,
        ],
      );
      if (rows.length !== 1) throw new Error("RUN_TERMINATION_QUARANTINE_FAILED");
      return mapRequest(rows[0]!);
    },
    async listPending(limit = 100): Promise<RunTerminationRequest[]> {
      const bounded = Math.max(1, Math.min(500, Math.trunc(limit)));
      const rows = await sql.unsafe<RequestRow[]>(
        `SELECT * FROM run_termination_requests
          WHERE state IN ('requested', 'drained')
             OR (state = 'draining' AND (lease_expires_at IS NULL OR lease_expires_at <= NOW()))
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
        return {
          status: request.targetStatus,
          previousStatus: request.targetStatus,
          closedClaims: 0,
          closedAttempts: 0,
          changedSteps: 0,
          changedStories: 0,
        };
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
