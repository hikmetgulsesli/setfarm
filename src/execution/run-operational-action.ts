import type postgres from "postgres";

import {
  compileLegacyResumePlan,
  readLegacyResumePlanSource,
  type LegacyResumePlanV1,
} from "./legacy-resume-plan.js";
import {
  requestRunTerminationInTransaction,
  type RunTerminationRequest,
} from "./run-termination.js";
import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import { buildRunOperationalSnapshotInTransaction } from "../server/run-operational-snapshot.js";

type Sql = postgres.Sql;
type TransactionSql = postgres.TransactionSql;

export type RunOperationalAction = "stop" | "resume";
export type RunOperationalActionPublicErrorCode =
  | "RUN_OPERATIONAL_ACTION_RUN_ID_REQUIRED"
  | "RUN_OPERATIONAL_ACTION_EXPECTED_SNAPSHOT_HASH_INVALID"
  | "RUN_OPERATIONAL_ACTION_RUN_NOT_FOUND"
  | "RUN_OPERATIONAL_ACTION_TARGET_AMBIGUOUS"
  | "RUN_OPERATIONAL_ACTION_STALE_SNAPSHOT"
  | "RUN_OPERATIONAL_ACTION_PROJECTION_INCOMPLETE"
  | "RUN_OPERATIONAL_ACTION_INVARIANT_BLOCKED"
  | "RUN_OPERATIONAL_ACTION_DENIED"
  | "RUN_OPERATIONAL_ACTION_CONFLICT";

export class RunOperationalActionError extends Error {
  readonly operationalCode: RunOperationalActionPublicErrorCode;
  readonly reasonCode?: string;

  constructor(code: RunOperationalActionPublicErrorCode, reasonCode?: string) {
    super(reasonCode ? `${code}:${reasonCode}` : code);
    this.name = "RunOperationalActionError";
    this.operationalCode = code;
    this.reasonCode = reasonCode;
  }
}

export type RunOperationalActionResult =
  | Readonly<{
      action: "stop";
      runId: string;
      workflowId: string;
      expectedSnapshotHash: string;
      actionStateHash: string;
      terminationRequest: RunTerminationRequest;
    }>
  | Readonly<{
      action: "resume";
      runId: string;
      workflowId: string;
      expectedSnapshotHash: string;
      actionStateHash: string;
      planHash: string;
      targetWorkflowStepId: string;
      outboxId: string;
      eventKey: string;
    }>;

const SHA256_PATTERN = /^[a-f0-9]{64}$/;

function exactHash(value: string): string {
  if (!SHA256_PATTERN.test(value)) {
    throw new RunOperationalActionError("RUN_OPERATIONAL_ACTION_EXPECTED_SNAPSHOT_HASH_INVALID");
  }
  return value;
}

function exactRunId(value: string): string {
  if (!value.trim() || value.trim() !== value || value.length > 1_000) {
    throw new RunOperationalActionError("RUN_OPERATIONAL_ACTION_RUN_ID_REQUIRED");
  }
  return value;
}

function postgresCode(error: unknown): string | undefined {
  return error && typeof error === "object" && "code" in error
    ? String((error as { code?: unknown }).code ?? "")
    : undefined;
}

export async function resolveRunOperationalActionTarget(
  sql: Sql,
  query: string,
): Promise<string> {
  const target = exactRunId(query);
  let rows: Array<{ id: string }> = [];
  if (/^[1-9][0-9]*$/.test(target)) {
    rows = await sql.unsafe<Array<{ id: string }>>(
      "SELECT id FROM runs WHERE run_number = $1 ORDER BY id LIMIT 2",
      [Number(target)],
    );
  }
  if (rows.length === 0) {
    rows = await sql.unsafe<Array<{ id: string }>>(
      "SELECT id FROM runs WHERE id = $1 ORDER BY id LIMIT 2",
      [target],
    );
  }
  if (rows.length === 0) {
    rows = await sql.unsafe<Array<{ id: string }>>(
      "SELECT id FROM runs WHERE id LIKE $1 ORDER BY id LIMIT 2",
      [`${target}%`],
    );
  }
  if (rows.length === 0) throw new RunOperationalActionError("RUN_OPERATIONAL_ACTION_RUN_NOT_FOUND");
  if (rows.length !== 1) throw new RunOperationalActionError("RUN_OPERATIONAL_ACTION_TARGET_AMBIGUOUS");
  return rows[0]!.id;
}

async function applyStepMutations(
  sql: TransactionSql,
  runId: string,
  plan: LegacyResumePlanV1,
  transitionTime: Date,
): Promise<void> {
  for (const mutation of plan.stepMutations) {
    const rows = await sql.unsafe<Array<{ id: string }>>(
      `UPDATE steps
          SET status = $2,
              current_story_id = NULL,
              retry_count = 0,
              abandoned_count = 0,
              output = CASE WHEN $3::boolean THEN NULL ELSE output END,
              updated_at = $4
        WHERE id = $1
          AND run_id = $5
          AND step_id = $6
          AND step_index = $7
          AND status = $8
          AND retry_count = $9
          AND abandoned_count = $10
          AND current_story_id IS NOT DISTINCT FROM $11
          AND output IS NOT DISTINCT FROM $12
        RETURNING id`,
      [
        mutation.stepDbId,
        mutation.toStatus,
        mutation.clearOutput,
        transitionTime,
        runId,
        mutation.workflowStepId,
        mutation.stepIndex,
        mutation.fromStatus,
        mutation.fromRetryCount,
        mutation.fromAbandonedCount,
        mutation.fromCurrentStoryId,
        mutation.fromOutput,
      ],
    );
    if (rows.length !== 1) throw new Error("RUN_OPERATIONAL_ACTION_STEP_CAS_LOST");
  }
}

async function applyStoryMutations(
  sql: TransactionSql,
  runId: string,
  plan: LegacyResumePlanV1,
  transitionTime: Date,
): Promise<void> {
  for (const mutation of plan.storyMutations) {
    const rows = await sql.unsafe<Array<{ id: string }>>(
      `UPDATE stories
          SET status = 'pending',
              retry_count = 0,
              claimed_by = NULL,
              claimed_at = NULL,
              updated_at = $2
        WHERE id = $1
          AND run_id = $3
          AND story_id = $4
          AND story_index = $5
          AND status = $6
          AND retry_count = $7
          AND claimed_by IS NOT DISTINCT FROM $8::text
          AND claimed_at IS NOT DISTINCT FROM $9::text::timestamptz
          AND pr_url IS NOT DISTINCT FROM $10::text
        RETURNING id`,
      [
        mutation.storyDbId,
        transitionTime,
        runId,
        mutation.storyId,
        mutation.storyIndex,
        mutation.fromStatus,
        mutation.fromRetryCount,
        mutation.fromClaimedBy,
        mutation.fromClaimedAt,
        mutation.fromPrUrl,
      ],
    );
    if (rows.length !== 1) {
      const diagnostic = await sql.unsafe<Array<{
        exists: boolean;
        run_matches: boolean;
        identity_matches: boolean;
        status_matches: boolean;
        retry_matches: boolean;
        claimed_by_matches: boolean;
        claimed_at_matches: boolean;
        pr_url_matches: boolean;
      }>>(
        `SELECT TRUE AS exists,
                run_id = $2 AS run_matches,
                (story_id = $3 AND story_index = $4) AS identity_matches,
                status = $5 AS status_matches,
                retry_count = $6 AS retry_matches,
                claimed_by IS NOT DISTINCT FROM $7::text AS claimed_by_matches,
                claimed_at IS NOT DISTINCT FROM $8::text::timestamptz AS claimed_at_matches,
                pr_url IS NOT DISTINCT FROM $9::text AS pr_url_matches
           FROM stories WHERE id = $1`,
        [
          mutation.storyDbId,
          runId,
          mutation.storyId,
          mutation.storyIndex,
          mutation.fromStatus,
          mutation.fromRetryCount,
          mutation.fromClaimedBy,
          mutation.fromClaimedAt,
          mutation.fromPrUrl,
        ],
      );
      throw new Error(`RUN_OPERATIONAL_ACTION_STORY_CAS_LOST:${JSON.stringify(diagnostic[0] ?? { exists: false })}`);
    }
  }
}

async function enqueueResumeEvent(
  sql: TransactionSql,
  input: Readonly<{
    runId: string;
    workflowId: string;
    expectedSnapshotHash: string;
    plan: LegacyResumePlanV1;
    now: Date;
  }>,
): Promise<Readonly<{ outboxId: string; eventKey: string }>> {
  const eventKey = `run/${encodeURIComponent(input.runId)}/resumed/${input.plan.stateHash}`;
  const outboxId = `OBX_${hashCanonicalJson({
    schema: "setfarm.run-operational-action-outbox-id.v1",
    eventKey,
  })}`;
  const payload = {
    schema: "setfarm.run-operational-action-resumed.v1",
    runId: input.runId,
    workflowId: input.workflowId,
    expectedSnapshotHash: input.expectedSnapshotHash,
    actionStateHash: input.plan.stateHash,
    planHash: input.plan.planHash,
    requestedBy: "setfarm.workflow.resume",
    targetWorkflowStepId: input.plan.targetWorkflowStepId,
    mode: input.plan.mode,
  };
  const rows = await sql.unsafe<Array<{ outbox_id: string }>>(
    `INSERT INTO operational_outbox (
       outbox_id, request_id, event_key, event_type, aggregate_type,
       aggregate_id, payload, state, created_at, updated_at
     ) VALUES ($1, NULL, $2, 'run.resumed', 'run', $3, $4::text::jsonb, 'pending', $5, $5)
     ON CONFLICT (event_key) DO NOTHING
     RETURNING outbox_id`,
    [outboxId, eventKey, input.runId, JSON.stringify(payload), input.now],
  );
  if (rows.length === 1 && rows[0]!.outbox_id === outboxId) return { outboxId, eventKey };
  const existing = await sql.unsafe<Array<{
    outbox_id: string;
    event_type: string;
    aggregate_type: string;
    aggregate_id: string;
    payload: unknown;
  }>>(
    `SELECT outbox_id, event_type, aggregate_type, aggregate_id, payload
       FROM operational_outbox
      WHERE event_key = $1
      FOR UPDATE`,
    [eventKey],
  );
  const row = existing[0];
  if (
    !row
    || row.outbox_id !== outboxId
    || row.event_type !== "run.resumed"
    || row.aggregate_type !== "run"
    || row.aggregate_id !== input.runId
    || hashCanonicalJson(row.payload) !== hashCanonicalJson(payload)
  ) {
    throw new Error("RUN_OPERATIONAL_ACTION_OUTBOX_IDEMPOTENCY_CONFLICT");
  }
  return { outboxId, eventKey };
}

async function executeInTransaction(
  sql: TransactionSql,
  input: Readonly<{
    action: RunOperationalAction;
    runId: string;
    expectedSnapshotHash: string;
    now?: Date;
  }>,
): Promise<RunOperationalActionResult> {
  const source = await readLegacyResumePlanSource(sql, input.runId, { lock: true });
  if (!source) throw new RunOperationalActionError("RUN_OPERATIONAL_ACTION_RUN_NOT_FOUND");

  const snapshot = await buildRunOperationalSnapshotInTransaction(sql, input.runId);
  if (!snapshot) throw new RunOperationalActionError("RUN_OPERATIONAL_ACTION_RUN_NOT_FOUND");
  if (snapshot.snapshotHash !== input.expectedSnapshotHash) {
    throw new RunOperationalActionError("RUN_OPERATIONAL_ACTION_STALE_SNAPSHOT");
  }
  if (snapshot.source.projection !== "complete" || !Object.values(snapshot.source.capabilities).every(Boolean)) {
    throw new RunOperationalActionError("RUN_OPERATIONAL_ACTION_PROJECTION_INCOMPLETE");
  }
  if (snapshot.invariants.length > 0) {
    throw new RunOperationalActionError("RUN_OPERATIONAL_ACTION_INVARIANT_BLOCKED");
  }

  const projected = snapshot.summary.operatorActions[input.action];
  const resumePlan = compileLegacyResumePlan(source);
  if (projected.stateHash !== resumePlan.stateHash) {
    throw new Error("RUN_OPERATIONAL_ACTION_STATE_PROJECTION_MISMATCH");
  }
  if (!projected.allowed) {
    throw new RunOperationalActionError("RUN_OPERATIONAL_ACTION_DENIED", projected.reasonCode);
  }

  const workflowId = typeof source.run.workflow_id === "string" ? source.run.workflow_id : "";
  if (!workflowId) throw new Error("RUN_OPERATIONAL_ACTION_WORKFLOW_ID_INVALID");
  const transitionTime = input.now ? new Date(input.now) : new Date();
  if (!Number.isFinite(transitionTime.getTime())) throw new Error("RUN_OPERATIONAL_ACTION_TIME_INVALID");

  if (input.action === "stop") {
    const requested = await requestRunTerminationInTransaction(sql, {
      runId: input.runId,
      targetStatus: "cancelled",
      requestedBy: "setfarm.workflow.stop",
      diagnostic: "Workflow cancellation requested by operator against canonical snapshot",
      evidence: {
        schema: "setfarm.run-operational-action-stop.v1",
        expectedSnapshotHash: input.expectedSnapshotHash,
        actionStateHash: projected.stateHash,
      },
      now: transitionTime,
    });
    if (requested.status === "already_terminal") {
      throw new Error("RUN_OPERATIONAL_ACTION_STOP_TERMINAL_RACE");
    }
    return Object.freeze({
      action: "stop",
      runId: input.runId,
      workflowId,
      expectedSnapshotHash: input.expectedSnapshotHash,
      actionStateHash: projected.stateHash,
      terminationRequest: requested.request,
    });
  }

  if (resumePlan.status !== "ready") {
    throw new Error("RUN_OPERATIONAL_ACTION_RESUME_PLAN_PROJECTION_MISMATCH");
  }
  const plan = resumePlan.plan;
  await applyStepMutations(sql, input.runId, plan, transitionTime);
  await applyStoryMutations(sql, input.runId, plan, transitionTime);
  const runRows = await sql.unsafe<Array<{ id: string }>>(
    `UPDATE runs
        SET status = 'running',
            context = $2,
            meta = $3,
            updated_at = $4
      WHERE id = $1
        AND protocol = 'legacy'
        AND status = $5
        AND context IS NOT DISTINCT FROM $6
        AND meta IS NOT DISTINCT FROM $7
      RETURNING id`,
    [
      input.runId,
      plan.contextAfter,
      plan.metaAfter,
      transitionTime,
      plan.sourceStatus,
      plan.contextBefore,
      plan.metaBefore,
    ],
  );
  if (runRows.length !== 1) throw new Error("RUN_OPERATIONAL_ACTION_RUN_CAS_LOST");

  const event = await enqueueResumeEvent(sql, {
    runId: input.runId,
    workflowId,
    expectedSnapshotHash: input.expectedSnapshotHash,
    plan,
    now: transitionTime,
  });
  return Object.freeze({
    action: "resume",
    runId: input.runId,
    workflowId,
    expectedSnapshotHash: input.expectedSnapshotHash,
    actionStateHash: projected.stateHash,
    planHash: plan.planHash,
    targetWorkflowStepId: plan.targetWorkflowStepId,
    outboxId: event.outboxId,
    eventKey: event.eventKey,
  });
}

/**
 * The operational action owner deliberately performs one SERIALIZABLE attempt.
 * PostgreSQL serialization/deadlock failures are surfaced as a refreshable
 * conflict; callers must fetch a new canonical snapshot instead of replaying a
 * mutation against hidden or changed source state.
 */
export async function executeRunOperationalAction(
  sql: Sql,
  rawInput: Readonly<{
    action: RunOperationalAction;
    runId: string;
    expectedSnapshotHash: string;
    now?: Date;
  }>,
): Promise<RunOperationalActionResult> {
  const input = {
    ...rawInput,
    runId: exactRunId(rawInput.runId),
    expectedSnapshotHash: exactHash(rawInput.expectedSnapshotHash),
  };
  try {
    return await sql.begin(
      "isolation level serializable",
      (transaction) => executeInTransaction(transaction, input),
    ) as RunOperationalActionResult;
  } catch (error) {
    if (error instanceof RunOperationalActionError) throw error;
    if (["40001", "40P01"].includes(postgresCode(error) ?? "")) {
      throw new RunOperationalActionError("RUN_OPERATIONAL_ACTION_CONFLICT");
    }
    throw error;
  }
}
