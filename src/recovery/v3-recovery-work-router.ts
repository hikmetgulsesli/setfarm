import type postgres from "postgres";
import { z } from "zod";

import { readDatabaseWallClock } from "../db/database-wall-clock.js";
import {
  V3RecoveryClaimAuthorityError,
  V3RecoveryClaimHandoffV1Schema,
  createV3RecoveryClaimAuthority,
  type V3RecoveryClaimHandoffV1,
} from "./v3-recovery-claim-authority.js";

type Sql = postgres.Sql;
type TransactionSql = postgres.TransactionSql;

const BoundedIdentitySchema = z.string().min(1).max(500);
const ModelDispatchClassSchema = z.enum(["product_implementation", "supervisor_repair"]);

const AcquireNextInputSchema = z.object({
  workflowId: BoundedIdentitySchema,
  dispatchClass: ModelDispatchClassSchema,
  ownerInstanceId: BoundedIdentitySchema,
  leaseMs: z.number().int().positive().max(24 * 60 * 60 * 1_000).default(10 * 60 * 1_000),
}).strict();

type AcquireNextInput = z.infer<typeof AcquireNextInputSchema>;

export type V3RecoveryWorkStep = Readonly<{
  id: string;
  step_id: string;
  run_id: string;
  agent_id: string;
  step_index: number;
  input_template: string;
  type: "loop";
  loop_config: string | null;
  step_status: "pending" | "running";
  current_story_id: string | null;
  retry_count: number;
  output: string | null;
}>;

export type V3RecoveryWorkStory = Readonly<{
  id: string;
  run_id: string;
  story_index: number;
  story_id: string;
  title: string;
  description: string;
  acceptance_criteria: string;
  status: "failed";
  output: string | null;
  retry_count: number;
  max_retries: number;
  abandoned_count: number;
  claimed_by: string | null;
  claimed_at: Date | string | null;
  claim_generation: number;
  started_at: Date | string | null;
  depends_on: string | null;
  scope_files: string | null;
  shared_files: string | null;
  scope_targets: string | null;
  requested_dependencies: string | null;
  shared_edit_requests: string | null;
  resolved_scope_files: string | null;
  scope_description: string | null;
  file_skeletons: string | null;
  implementation_contract: string | null;
  story_screens: string | null;
  story_branch: string | null;
  pr_url: string | null;
  merge_status: string | null;
  quality_failure_fingerprint: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}>;

export type V3RecoveryRoutedWork = Readonly<{
  step: V3RecoveryWorkStep;
  story: V3RecoveryWorkStory;
  handoff: V3RecoveryClaimHandoffV1;
}>;

type CandidateIdentityRow = {
  run_id: string;
  story_id: string;
  story_db_id: string;
  step_db_id: string;
  dispatch_id: string;
};

type RoutedWorkRow = CandidateIdentityRow & {
  step_workflow_id: string;
  step_agent_id: string;
  step_index: number;
  step_input_template: string;
  step_type: string;
  step_loop_config: string | null;
  step_status: string;
  step_current_story_id: string | null;
  step_retry_count: number;
  step_output: string | null;
  story_index: number;
  story_title: string;
  story_description: string;
  story_acceptance_criteria: string;
  story_status: string;
  story_output: string | null;
  story_retry_count: number;
  story_max_retries: number;
  story_abandoned_count: number;
  story_claimed_by: string | null;
  story_claimed_at: Date | string | null;
  story_claim_generation: number;
  story_started_at: Date | string | null;
  story_depends_on: string | null;
  story_scope_files: string | null;
  story_shared_files: string | null;
  story_scope_targets: string | null;
  story_requested_dependencies: string | null;
  story_shared_edit_requests: string | null;
  story_resolved_scope_files: string | null;
  story_scope_description: string | null;
  story_file_skeletons: string | null;
  story_implementation_contract: string | null;
  story_screens: string | null;
  story_branch: string | null;
  story_pr_url: string | null;
  story_merge_status: string | null;
  story_quality_failure_fingerprint: string | null;
  story_created_at: Date | string;
  story_updated_at: Date | string;
};

export class V3RecoveryWorkRouterError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(`${code}:${message}`);
    this.name = "V3RecoveryWorkRouterError";
    this.code = code;
  }
}

function fail(code: string, message: string): never {
  throw new V3RecoveryWorkRouterError(code, message);
}

const EXACT_CHAIN_PREDICATE = `
  recovery_case.current_revision_id = revision.revision_id
  AND recovery_case.run_id = delivery.run_id
  AND recovery_case.story_id = delivery.story_id
  AND recovery_case.finding_set_hash = revision.finding_set_hash
  AND recovery_case.packet_hash = revision.packet_hash
  AND recovery_case.slice_hash = revision.contract_slice_hash
  AND recovery_case.source_sha = revision.source_sha
  AND recovery_case.source_tree_hash = revision.source_tree_hash
  AND recovery_case.owner = revision.owner
  AND recovery_case.finding_ids = revision.finding_ids
  AND recovery_case.expected_delta = revision.expected_delta
  AND recovery_case.allowed_paths = revision.allowed_paths
  AND recovery_case.evidence_plan = revision.evidence_plan
  AND dispatch.recovery_case_id = recovery_case.recovery_case_id
  AND dispatch.revision_id = revision.revision_id
  AND dispatch.packet_hash = revision.packet_hash
  AND dispatch.contract_slice_hash = revision.contract_slice_hash
  AND dispatch.finding_set_hash = revision.finding_set_hash
  AND dispatch.source_sha = revision.source_sha
  AND dispatch.source_tree_hash = revision.source_tree_hash
  AND dispatch.finding_ids = revision.finding_ids
  AND dispatch.evidence_plan = revision.evidence_plan
  AND dispatch.evidence_plan_artifact_hash IS NOT DISTINCT FROM revision.evidence_plan_artifact_hash
  AND delivery.dispatch_id = dispatch.dispatch_id
  AND delivery.recovery_case_id = recovery_case.recovery_case_id
  AND delivery.revision_id = revision.revision_id
  AND delivery.run_id = revision.run_id
  AND delivery.story_id = revision.story_id
  AND delivery.authorized_at = dispatch.authorized_at
  AND finding_set.finding_set_hash = revision.finding_set_hash
  AND finding_set.run_id = revision.run_id
  AND finding_set.story_id = revision.story_id
  AND finding_set.packet_hash = revision.packet_hash
  AND finding_set.slice_hash = revision.contract_slice_hash
  AND finding_set.source_sha = revision.source_sha
  AND finding_set.source_tree_hash = revision.source_tree_hash
  AND finding_set.finding_ids = revision.finding_ids
  AND run_row.packet_hash = revision.packet_hash
`;

const ROUTED_WORK_COLUMNS = `
  run_row.id AS run_id,
  story_row.story_id,
  story_row.id AS story_db_id,
  step_row.id AS step_db_id,
  delivery.dispatch_id,
  step_row.step_id AS step_workflow_id,
  step_row.agent_id AS step_agent_id,
  step_row.step_index,
  step_row.input_template AS step_input_template,
  step_row.type AS step_type,
  step_row.loop_config AS step_loop_config,
  step_row.status AS step_status,
  step_row.current_story_id AS step_current_story_id,
  step_row.retry_count AS step_retry_count,
  step_row.output AS step_output,
  story_row.story_index,
  story_row.title AS story_title,
  story_row.description AS story_description,
  story_row.acceptance_criteria AS story_acceptance_criteria,
  story_row.status AS story_status,
  story_row.output AS story_output,
  story_row.retry_count AS story_retry_count,
  story_row.max_retries AS story_max_retries,
  story_row.abandoned_count AS story_abandoned_count,
  story_row.claimed_by AS story_claimed_by,
  story_row.claimed_at AS story_claimed_at,
  story_row.claim_generation AS story_claim_generation,
  story_row.started_at AS story_started_at,
  story_row.depends_on AS story_depends_on,
  story_row.scope_files AS story_scope_files,
  story_row.shared_files AS story_shared_files,
  story_row.scope_targets AS story_scope_targets,
  story_row.requested_dependencies AS story_requested_dependencies,
  story_row.shared_edit_requests AS story_shared_edit_requests,
  story_row.resolved_scope_files AS story_resolved_scope_files,
  story_row.scope_description AS story_scope_description,
  story_row.file_skeletons AS story_file_skeletons,
  story_row.implementation_contract AS story_implementation_contract,
  story_row.story_screens,
  story_row.story_branch,
  story_row.pr_url AS story_pr_url,
  story_row.merge_status AS story_merge_status,
  story_row.quality_failure_fingerprint AS story_quality_failure_fingerprint,
  story_row.created_at AS story_created_at,
  story_row.updated_at AS story_updated_at
`;

function exactWorkJoins(): string {
  return `
    FROM recovery_dispatch_deliveries delivery
    JOIN recovery_revision_dispatches dispatch
      ON dispatch.dispatch_id = delivery.dispatch_id
    JOIN recovery_case_revisions revision
      ON revision.revision_id = dispatch.revision_id
     AND revision.recovery_case_id = dispatch.recovery_case_id
    JOIN recovery_cases recovery_case
      ON recovery_case.recovery_case_id = revision.recovery_case_id
    JOIN finding_sets finding_set
      ON finding_set.finding_set_hash = revision.finding_set_hash
    JOIN runs run_row
      ON run_row.id = delivery.run_id
    JOIN stories story_row
      ON story_row.run_id = run_row.id
     AND story_row.story_id = delivery.story_id
    JOIN steps step_row
      ON step_row.run_id = run_row.id
     AND step_row.step_id = 'implement'
     AND step_row.type = 'loop'
  `;
}

async function discoverCandidate(
  sql: Sql,
  input: AcquireNextInput,
  excludedDispatchIds: readonly string[],
): Promise<CandidateIdentityRow | undefined> {
  return sql.begin(async (transaction) => {
    const rows = await transaction.unsafe<CandidateIdentityRow[]>(
      `SELECT run_row.id AS run_id,
              story_row.story_id,
              story_row.id AS story_db_id,
              step_row.id AS step_db_id,
              delivery.dispatch_id
         ${exactWorkJoins()}
        WHERE run_row.workflow_id = $1
          AND run_row.protocol = 'v3'
          AND run_row.status IN ('running', 'resuming')
          AND story_row.status = 'failed'
          AND step_row.status IN ('pending', 'running')
          AND recovery_case.status IN ('open', 'repairing', 'evidencing')
          AND dispatch.dispatch_class = $2
          AND (
            ($2 = 'product_implementation' AND revision.owner = 'implement')
            OR ($2 = 'supervisor_repair' AND revision.owner = 'supervisor')
          )
          AND (
            delivery.state = 'authorized'
            OR (delivery.state = 'leased' AND delivery.lease_expires_at <= clock_timestamp())
          )
          AND NOT (delivery.dispatch_id = ANY($3::text[]))
          AND NOT EXISTS (
            SELECT 1 FROM stories duplicate_story
             WHERE duplicate_story.run_id = story_row.run_id
               AND duplicate_story.story_id = story_row.story_id
               AND duplicate_story.status = 'failed'
               AND duplicate_story.id <> story_row.id
          )
          AND NOT EXISTS (
            SELECT 1 FROM steps duplicate_step
             WHERE duplicate_step.run_id = step_row.run_id
               AND duplicate_step.step_id = 'implement'
               AND duplicate_step.type = 'loop'
               AND duplicate_step.status IN ('pending', 'running')
               AND duplicate_step.id <> step_row.id
          )
          AND ${EXACT_CHAIN_PREDICATE}
        ORDER BY delivery.authorized_at, delivery.dispatch_id, step_row.step_index, step_row.id, story_row.id
        LIMIT 1
        FOR UPDATE OF delivery SKIP LOCKED`,
      [input.workflowId, input.dispatchClass, excludedDispatchIds],
    );
    return rows[0];
  }) as Promise<CandidateIdentityRow | undefined>;
}

async function loadExactRoutedWork(
  sql: Sql,
  input: AcquireNextInput,
  candidate: CandidateIdentityRow,
  handoff: V3RecoveryClaimHandoffV1,
): Promise<RoutedWorkRow | undefined> {
  return sql.begin(async (transaction: TransactionSql) => {
    const rows = await transaction.unsafe<RoutedWorkRow[]>(
      `SELECT ${ROUTED_WORK_COLUMNS}
         ${exactWorkJoins()}
        WHERE run_row.workflow_id = $1
          AND run_row.protocol = 'v3'
          AND run_row.status IN ('running', 'resuming')
          AND run_row.id = $2
          AND story_row.id = $3
          AND story_row.story_id = $4
          AND story_row.status = 'failed'
          AND step_row.id = $5
          AND step_row.status IN ('pending', 'running')
          AND recovery_case.status IN ('open', 'repairing', 'evidencing')
          AND dispatch.dispatch_class = $6
          AND delivery.dispatch_id = $7
          AND delivery.state = 'leased'
          AND delivery.owner_instance_id = $8
          AND delivery.lease_token = $9
          AND delivery.lease_expires_at = $10::timestamptz
          AND NOT EXISTS (
            SELECT 1 FROM stories duplicate_story
             WHERE duplicate_story.run_id = story_row.run_id
               AND duplicate_story.story_id = story_row.story_id
               AND duplicate_story.status = 'failed'
               AND duplicate_story.id <> story_row.id
          )
          AND NOT EXISTS (
            SELECT 1 FROM steps duplicate_step
             WHERE duplicate_step.run_id = step_row.run_id
               AND duplicate_step.step_id = 'implement'
               AND duplicate_step.type = 'loop'
               AND duplicate_step.status IN ('pending', 'running')
               AND duplicate_step.id <> step_row.id
          )
          AND ${EXACT_CHAIN_PREDICATE}
        FOR KEY SHARE OF run_row, story_row, step_row, recovery_case, revision, dispatch, delivery`,
      [
        input.workflowId,
        candidate.run_id,
        candidate.story_db_id,
        candidate.story_id,
        candidate.step_db_id,
        input.dispatchClass,
        candidate.dispatch_id,
        input.ownerInstanceId,
        handoff.lease.leaseToken,
        handoff.lease.expiresAt,
      ],
    );
    if (rows.length !== 1) return undefined;
    const wallClock = await readDatabaseWallClock(
      transaction,
      "V3_RECOVERY_WORK_ROUTER_DATABASE_TIME_UNAVAILABLE",
    );
    return Date.parse(handoff.lease.expiresAt) > wallClock.getTime() ? rows[0] : undefined;
  }) as Promise<RoutedWorkRow | undefined>;
}

function mapRoutedWork(row: RoutedWorkRow, handoff: V3RecoveryClaimHandoffV1): V3RecoveryRoutedWork {
  if (row.step_type !== "loop" || !["pending", "running"].includes(row.step_status) || row.story_status !== "failed") {
    fail("V3_RECOVERY_WORK_ROUTER_ROW_INVALID", "routed work is not an active implement loop with one failed story");
  }
  return Object.freeze({
    step: Object.freeze({
      id: row.step_db_id,
      step_id: row.step_workflow_id,
      run_id: row.run_id,
      agent_id: row.step_agent_id,
      step_index: row.step_index,
      input_template: row.step_input_template,
      type: "loop",
      loop_config: row.step_loop_config,
      step_status: row.step_status as "pending" | "running",
      current_story_id: row.step_current_story_id,
      retry_count: row.step_retry_count,
      output: row.step_output,
    }),
    story: Object.freeze({
      id: row.story_db_id,
      run_id: row.run_id,
      story_index: row.story_index,
      story_id: row.story_id,
      title: row.story_title,
      description: row.story_description,
      acceptance_criteria: row.story_acceptance_criteria,
      status: "failed",
      output: row.story_output,
      retry_count: row.story_retry_count,
      max_retries: row.story_max_retries,
      abandoned_count: row.story_abandoned_count,
      claimed_by: row.story_claimed_by,
      claimed_at: row.story_claimed_at,
      claim_generation: row.story_claim_generation,
      started_at: row.story_started_at,
      depends_on: row.story_depends_on,
      scope_files: row.story_scope_files,
      shared_files: row.story_shared_files,
      scope_targets: row.story_scope_targets,
      requested_dependencies: row.story_requested_dependencies,
      shared_edit_requests: row.story_shared_edit_requests,
      resolved_scope_files: row.story_resolved_scope_files,
      scope_description: row.story_scope_description,
      file_skeletons: row.story_file_skeletons,
      implementation_contract: row.story_implementation_contract,
      story_screens: row.story_screens,
      story_branch: row.story_branch,
      pr_url: row.story_pr_url,
      merge_status: row.story_merge_status,
      quality_failure_fingerprint: row.story_quality_failure_fingerprint,
      created_at: row.story_created_at,
      updated_at: row.story_updated_at,
    }),
    handoff,
  });
}

const CLAIM_CONTENTION_CODES = new Set([
  "V3_RECOVERY_AUTHORITY_RUN_NOT_FOUND",
  "V3_RECOVERY_AUTHORITY_RUN_NOT_ACTIVE_V3",
  "V3_RECOVERY_AUTHORITY_TERMINATION_PENDING",
  "V3_RECOVERY_AUTHORITY_DELIVERY_NOT_FOUND",
  "V3_RECOVERY_LEASE_HELD",
  "V3_RECOVERY_ATTEMPT_BOUND_CONFLICT",
  "V3_RECOVERY_CONTINUATION_STALE",
  "V3_RECOVERY_DELIVERY_NOT_CLAIMABLE",
  "V3_RECOVERY_LEASE_CAS_LOST",
]);

export function createV3RecoveryWorkRouter(
  sql: Sql,
  options: Readonly<{
    admitCandidate?: (candidate: Readonly<{
      runId: string;
      storyId: string;
      storyDbId: string;
      stepDbId: string;
      dispatchId: string;
    }>) => Promise<void>;
  }> = {},
) {
  const authority = createV3RecoveryClaimAuthority(sql);
  return Object.freeze({
    async acquireNext(raw: unknown): Promise<V3RecoveryRoutedWork | undefined> {
      const input = AcquireNextInputSchema.parse(raw);
      const excludedDispatchIds: string[] = [];
      for (;;) {
        const candidate = await discoverCandidate(sql, input, excludedDispatchIds);
        if (!candidate) return undefined;
        excludedDispatchIds.push(candidate.dispatch_id);

        await options.admitCandidate?.(Object.freeze({
          runId: candidate.run_id,
          storyId: candidate.story_id,
          storyDbId: candidate.story_db_id,
          stepDbId: candidate.step_db_id,
          dispatchId: candidate.dispatch_id,
        }));

        let handoff: V3RecoveryClaimHandoffV1;
        try {
          handoff = V3RecoveryClaimHandoffV1Schema.parse(await authority.acquireRecoveryClaim({
            runId: candidate.run_id,
            storyId: candidate.story_id,
            ownerInstanceId: input.ownerInstanceId,
            leaseMs: input.leaseMs,
          }));
        } catch (error) {
          if (error instanceof V3RecoveryClaimAuthorityError && CLAIM_CONTENTION_CODES.has(error.code)) {
            continue;
          }
          throw error;
        }

        if (
          handoff.status !== "lease_acquired"
          || handoff.runId !== candidate.run_id
          || handoff.storyId !== candidate.story_id
          || handoff.dispatchId !== candidate.dispatch_id
          || handoff.dispatchClass !== input.dispatchClass
          || handoff.lease.ownerInstanceId !== input.ownerInstanceId
        ) {
          fail("V3_RECOVERY_WORK_ROUTER_HANDOFF_MISMATCH", "authority returned a different candidate identity");
        }

        const row = await loadExactRoutedWork(sql, input, candidate, handoff);
        if (!row) {
          fail("V3_RECOVERY_WORK_ROUTER_POST_LEASE_IDENTITY_MISMATCH", "step, story or recovery chain changed after lease");
        }
        return mapRoutedWork(row, handoff);
      }
    },
  });
}
