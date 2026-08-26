import type postgres from "postgres";
import { z } from "zod";

import { readDatabaseWallClock } from "../db/database-wall-clock.js";
import {
  beginOrAdoptInternalProductionOwnerReservationV1,
  bindInternalProductionOwnerReservationV1,
  closeInternalProductionOwnerReservationV1,
  resolveInternalProductionExecutionAttemptTerminalAuthorityPairInTransactionV1,
  type PgTransactionSql,
} from "../db-pg.js";
import { createInternalProductionExecutionAttemptCanonicalOwnerIdentityV1 } from "../internal-production/owner-admission-v1.js";
import { canonicalJsonStringify, hashCanonicalJson } from "../product-compiler/canonical-json.js";
import { Sha256Schema } from "../product-compiler/schemas/common-v1.js";
import {
  DEFAULT_ATTEMPT_LEASE_MS,
  computeAttemptDedupeKey,
  defaultAttemptIdentityFactory,
  leaseWindow,
  type AttemptIdentityFactory,
} from "./lease-fence.js";
import {
  ExecutionAttemptV1Schema,
  SourceRevisionV1Schema,
  TerminalAttemptDispositionV1Schema,
  type ExecutionAttemptV1,
} from "./schemas/execution-attempt-v1.js";
import { parseOperationalRetryAwareAttemptReservation } from "./operational-retry-reservation.js";
import { V3RecoveryClaimHandoffV1Schema } from "../recovery/v3-recovery-claim-authority.js";

type Sql = postgres.Sql;
type TransactionSql = postgres.TransactionSql;

type AttemptRow = {
  attempt_id: string;
  claim_id: string | null;
  run_id: string;
  step_id: string;
  story_id: string;
  generation: number;
  fence_token: string;
  attempt_class: string;
  packet_hash: string | null;
  compilation_report_hash: string;
  slice_hash: string | null;
  source_before_sha: string;
  source_before_tree_hash: string;
  source_after_sha: string | null;
  source_after_tree_hash: string | null;
  finding_set_hash: string | null;
  recovery_case_revision_id: string | null;
  recovery_dispatch_id: string | null;
  dedupe_key: string | null;
  role: string;
  agent_id: string | null;
  branch: string | null;
  worktree: string | null;
  lease_acquired_at: Date | string;
  lease_expires_at: Date | string;
  heartbeat_at: Date | string;
  disposition: string;
  output_hash: string | null;
  evidence_refs: string;
  created_at: Date | string;
  updated_at: Date | string;
};

type RecoveryDeliveryBindingRow = {
  state: string;
  owner_instance_id: string | null;
  lease_token: string | null;
  lease_expires_at: Date | string | null;
  attempt_id: string | null;
  execution_slice_hash: string | null;
  attempt_count: number;
  started_at: Date | string | null;
  run_id: string;
  story_id: string;
  dispatch_class: string;
  revision_id: string;
  packet_hash: string;
  finding_set_hash: string;
  source_sha: string;
  source_tree_hash: string;
  claim_id: string | number | null;
  contract_slice_hash: string;
};

type RecoveryClaimPublicationAttemptBirthRow = Readonly<{
  claim_id: string;
  runtime_session_id: string;
  run_id: string;
  step_db_id: string;
  workflow_step_id: string;
  story_db_id: string;
  story_id: string;
  story_index: number;
  recovery_case_id: string;
  revision_id: string;
  dispatch_id: string;
  status: string;
  handoff_canonical_json: string;
  handoff_hash: string;
  bound_at: Date | string;
  runtime_claim_id: string;
  runtime_run_id: string;
  runtime_step_db_id: string;
  runtime_workflow_step_id: string;
  runtime_story_db_id: string | null;
  runtime_story_id: string | null;
  runtime_claim_agent_id: string;
  runtime_owner_instance_id: string;
  runtime_created_at: Date | string;
  runtime_heartbeat_at: Date | string;
  runtime_heartbeat_matches_creation: boolean;
  publication_bound_matches_claim: boolean;
  publication_bound_matches_story: boolean;
  publication_bound_not_after_runtime_creation: boolean;
  delivery_authorization_matches_dispatch: boolean;
  delivery_lease_matches_handoff: boolean | null;
  runtime_attempt_id: string | null;
  runtime_state: string;
  case_run_id: string;
  case_story_id: string;
  case_status: string;
  current_revision_id: string | null;
  case_owner: string;
  case_packet_hash: string;
  case_slice_hash: string;
  case_source_sha: string;
  case_source_tree_hash: string;
  case_finding_set_hash: string;
  case_finding_ids: unknown;
  case_expected_delta: unknown;
  case_allowed_paths: unknown;
  case_evidence_plan: unknown;
  revision_recovery_case_id: string;
  revision_run_id: string;
  revision_story_id: string;
  revision_owner: string;
  revision_packet_hash: string;
  revision_contract_slice_hash: string;
  revision_source_sha: string;
  revision_source_tree_hash: string;
  revision_finding_set_hash: string;
  revision_finding_ids: unknown;
  revision_expected_delta: unknown;
  revision_allowed_paths: unknown;
  revision_evidence_plan: unknown;
  revision_evidence_plan_artifact_hash: string | null;
  dispatch_recovery_case_id: string;
  dispatch_revision_id: string;
  dispatch_class: string;
  dispatch_packet_hash: string;
  dispatch_contract_slice_hash: string;
  dispatch_source_sha: string;
  dispatch_source_tree_hash: string;
  dispatch_finding_set_hash: string;
  dispatch_finding_ids: unknown;
  dispatch_evidence_plan: unknown;
  dispatch_evidence_plan_artifact_hash: string | null;
  dispatch_authorized_at: Date | string;
  delivery_state: string;
  delivery_owner_instance_id: string | null;
  delivery_lease_token: string | null;
  delivery_lease_expires_at: Date | string | null;
  delivery_attempt_id: string | null;
  delivery_claim_id: string | number | null;
  delivery_execution_slice_hash: string | null;
  delivery_attempt_count: number;
  delivery_run_id: string;
  delivery_story_id: string;
  delivery_authorized_at: Date | string;
  run_protocol: string;
  run_status: string;
  run_packet_hash: string;
  step_run_id: string;
  step_workflow_step_id: string;
  step_status: string;
  step_current_story_id: string | null;
  story_run_id: string;
  stored_story_id: string;
  stored_story_index: number;
  story_status: string;
  story_claimed_by: string | null;
  story_claimed_at: Date | string | null;
  claim_run_id: string;
  claim_step_id: string;
  claim_story_id: string | null;
  claim_agent_id: string;
  claim_claimed_at: Date | string;
  claim_outcome: string | null;
  finding_run_id: string;
  finding_story_id: string;
  finding_packet_hash: string;
  finding_slice_hash: string;
  finding_source_sha: string;
  finding_source_tree_hash: string;
  finding_ids: unknown;
}>;

const FenceIdentityV1Schema = z.object({
  attemptId: z.string().regex(/^ATT_[A-Za-z0-9-]{16,160}$/),
  generation: z.number().int().positive(),
  fenceToken: Sha256Schema,
}).strict();

const CompletionInputV1Schema = FenceIdentityV1Schema.extend({
  disposition: TerminalAttemptDispositionV1Schema,
  sourceAfter: SourceRevisionV1Schema.optional(),
  outputHash: Sha256Schema.optional(),
  evidenceRefs: z.array(z.string().min(1).max(500)).max(1_000),
}).strict().superRefine((value, context) => {
  if (value.disposition === "produced_delta" && !value.sourceAfter) {
    context.addIssue({ code: "custom", path: ["sourceAfter"], message: "Produced delta requires source-after" });
  }
});

const CandidateSourceInputV1Schema = FenceIdentityV1Schema.extend({
  sourceAfter: SourceRevisionV1Schema,
}).strict();

function timestamp(value: Date | string): string {
  const parsed = value instanceof Date ? value : new Date(value);
  return parsed.toISOString();
}

function optional<T>(value: T | null): T | undefined {
  return value === null ? undefined : value;
}

function evidenceRefs(raw: string): string[] {
  const parsed: unknown = JSON.parse(raw);
  return z.array(z.string().min(1).max(500)).max(1_000).parse(parsed);
}

function sameCanonical(left: unknown, right: unknown): boolean {
  return canonicalJsonStringify(left) === canonicalJsonStringify(right);
}

async function lockAndAssertRecoveryClaimPublicationForAttemptBirth(
  transaction: TransactionSql,
  reservation: ReturnType<typeof parseOperationalRetryAwareAttemptReservation>,
): Promise<string | undefined> {
  if (
    !reservation.recoveryDispatchId
    || !reservation.recoveryCaseRevisionId
    || reservation.attemptClass === "evidence_only"
  ) return undefined;
  const recoveryDispatchId = reservation.recoveryDispatchId;
  const recoveryCaseRevisionId = reservation.recoveryCaseRevisionId;
  const exactClaimId = reservation.claimId;
  if (exactClaimId === undefined) throw new Error("ATTEMPT_CLAIM_ID_REQUIRED");
  const rows = await transaction.unsafe<RecoveryClaimPublicationAttemptBirthRow[]>(
    `SELECT publication.claim_id::text AS claim_id,
            publication.runtime_session_id, publication.run_id,
            publication.step_db_id, publication.workflow_step_id,
            publication.story_db_id, publication.story_id, publication.story_index,
            publication.recovery_case_id, publication.revision_id,
            publication.dispatch_id, publication.status,
            publication.handoff_canonical_json, publication.handoff_hash, publication.bound_at,
            runtime.claim_id::text AS runtime_claim_id,
            runtime.run_id AS runtime_run_id, runtime.step_db_id AS runtime_step_db_id,
            runtime.workflow_step_id AS runtime_workflow_step_id,
            runtime.story_db_id AS runtime_story_db_id, runtime.story_id AS runtime_story_id,
            runtime.claim_agent_id AS runtime_claim_agent_id,
            runtime.owner_instance_id AS runtime_owner_instance_id,
            runtime.created_at AS runtime_created_at,
            runtime.heartbeat_at AS runtime_heartbeat_at,
            runtime.heartbeat_at = runtime.created_at AS runtime_heartbeat_matches_creation,
            publication.bound_at = claim.claimed_at AS publication_bound_matches_claim,
            publication.bound_at = story.claimed_at AS publication_bound_matches_story,
            publication.bound_at <= runtime.created_at AS publication_bound_not_after_runtime_creation,
            delivery.authorized_at = dispatch.authorized_at AS delivery_authorization_matches_dispatch,
            delivery.lease_expires_at = (
              publication.handoff_canonical_json::jsonb #>> '{lease,expiresAt}'
            )::timestamptz AS delivery_lease_matches_handoff,
            runtime.attempt_id AS runtime_attempt_id, runtime.state AS runtime_state,
            recovery_case.run_id AS case_run_id,
            recovery_case.story_id AS case_story_id,
            recovery_case.status AS case_status,
            recovery_case.current_revision_id,
            recovery_case.owner AS case_owner,
            recovery_case.packet_hash AS case_packet_hash,
            recovery_case.slice_hash AS case_slice_hash,
            recovery_case.source_sha AS case_source_sha,
            recovery_case.source_tree_hash AS case_source_tree_hash,
            recovery_case.finding_set_hash AS case_finding_set_hash,
            recovery_case.finding_ids AS case_finding_ids,
            recovery_case.expected_delta AS case_expected_delta,
            recovery_case.allowed_paths AS case_allowed_paths,
            recovery_case.evidence_plan AS case_evidence_plan,
            revision.recovery_case_id AS revision_recovery_case_id,
            revision.run_id AS revision_run_id,
            revision.story_id AS revision_story_id,
            revision.owner AS revision_owner,
            revision.packet_hash AS revision_packet_hash,
            revision.contract_slice_hash AS revision_contract_slice_hash,
            revision.source_sha AS revision_source_sha,
            revision.source_tree_hash AS revision_source_tree_hash,
            revision.finding_set_hash AS revision_finding_set_hash,
            revision.finding_ids AS revision_finding_ids,
            revision.expected_delta AS revision_expected_delta,
            revision.allowed_paths AS revision_allowed_paths,
            revision.evidence_plan AS revision_evidence_plan,
            revision.evidence_plan_artifact_hash AS revision_evidence_plan_artifact_hash,
            dispatch.recovery_case_id AS dispatch_recovery_case_id,
            dispatch.revision_id AS dispatch_revision_id,
            dispatch.dispatch_class,
            dispatch.packet_hash AS dispatch_packet_hash,
            dispatch.contract_slice_hash AS dispatch_contract_slice_hash,
            dispatch.source_sha AS dispatch_source_sha,
            dispatch.source_tree_hash AS dispatch_source_tree_hash,
            dispatch.finding_set_hash AS dispatch_finding_set_hash,
            dispatch.finding_ids AS dispatch_finding_ids,
            dispatch.evidence_plan AS dispatch_evidence_plan,
            dispatch.evidence_plan_artifact_hash AS dispatch_evidence_plan_artifact_hash,
            dispatch.authorized_at AS dispatch_authorized_at,
            delivery.state AS delivery_state,
            delivery.owner_instance_id AS delivery_owner_instance_id,
            delivery.lease_token AS delivery_lease_token,
            delivery.lease_expires_at AS delivery_lease_expires_at,
            delivery.attempt_id AS delivery_attempt_id,
            delivery.claim_id AS delivery_claim_id,
            delivery.execution_slice_hash AS delivery_execution_slice_hash,
            delivery.attempt_count AS delivery_attempt_count,
            delivery.run_id AS delivery_run_id,
            delivery.story_id AS delivery_story_id,
            delivery.authorized_at AS delivery_authorized_at,
            run_row.protocol AS run_protocol, run_row.status AS run_status,
            run_row.packet_hash AS run_packet_hash,
            step.run_id AS step_run_id, step.step_id AS step_workflow_step_id,
            step.status AS step_status, step.current_story_id AS step_current_story_id,
            story.run_id AS story_run_id, story.story_id AS stored_story_id,
            story.story_index AS stored_story_index, story.status AS story_status,
            story.claimed_by AS story_claimed_by, story.claimed_at AS story_claimed_at,
            claim.run_id AS claim_run_id, claim.step_id AS claim_step_id,
            claim.story_id AS claim_story_id, claim.agent_id AS claim_agent_id,
            claim.claimed_at AS claim_claimed_at, claim.outcome AS claim_outcome,
            finding_set.run_id AS finding_run_id, finding_set.story_id AS finding_story_id,
            finding_set.packet_hash AS finding_packet_hash,
            finding_set.slice_hash AS finding_slice_hash,
            finding_set.source_sha AS finding_source_sha,
            finding_set.source_tree_hash AS finding_source_tree_hash,
            finding_set.finding_ids
       FROM internal_production_v3_recovery_claim_publications_v1 publication
       JOIN runtime_sessions runtime
         ON runtime.session_id = publication.runtime_session_id
        AND runtime.claim_id = publication.claim_id
        AND runtime.run_id = publication.run_id
       JOIN recovery_dispatch_deliveries delivery
         ON delivery.dispatch_id = publication.dispatch_id
        AND delivery.revision_id = publication.revision_id
        AND delivery.recovery_case_id = publication.recovery_case_id
        AND delivery.run_id = publication.run_id
        AND delivery.story_id = publication.story_id
       JOIN recovery_cases recovery_case
         ON recovery_case.recovery_case_id = publication.recovery_case_id
       JOIN recovery_case_revisions revision
         ON revision.revision_id = publication.revision_id
        AND revision.recovery_case_id = publication.recovery_case_id
       JOIN recovery_revision_dispatches dispatch
         ON dispatch.dispatch_id = publication.dispatch_id
        AND dispatch.revision_id = publication.revision_id
       JOIN runs run_row ON run_row.id = publication.run_id
       JOIN steps step ON step.id = publication.step_db_id
       JOIN stories story ON story.id = publication.story_db_id
       JOIN claim_log claim ON claim.id = publication.claim_id
       JOIN finding_sets finding_set ON finding_set.finding_set_hash = revision.finding_set_hash
      WHERE publication.claim_id = $1::bigint
        AND publication.dispatch_id = $2
        AND publication.revision_id = $3
      FOR UPDATE OF publication, runtime, delivery, recovery_case, revision, dispatch, run_row, step, story, claim, finding_set`,
    [exactClaimId, recoveryDispatchId, recoveryCaseRevisionId],
  );
  const row = rows[0];
  if (rows.length !== 1 || !row) {
    throw new Error("RECOVERY_ATTEMPT_CLAIM_PUBLICATION_NOT_FOUND");
  }
  let handoff: ReturnType<typeof V3RecoveryClaimHandoffV1Schema.parse>;
  try {
    handoff = V3RecoveryClaimHandoffV1Schema.parse(JSON.parse(row.handoff_canonical_json));
  } catch {
    throw new Error("RECOVERY_ATTEMPT_CLAIM_PUBLICATION_INVALID");
  }
  const directive = handoff.directive;
  const canonicalRevisionDirective = {
    packetHash: row.revision_packet_hash,
    contractSliceHash: row.revision_contract_slice_hash,
    sourceRevision: {
      sha: row.revision_source_sha,
      treeHash: row.revision_source_tree_hash,
    },
    findingSetHash: row.revision_finding_set_hash,
    findingIds: row.revision_finding_ids,
    expectedDelta: row.revision_expected_delta,
    allowedPaths: row.revision_allowed_paths,
    evidencePlan: row.revision_evidence_plan,
    ...(row.revision_evidence_plan_artifact_hash
      ? { evidencePlanArtifactHash: row.revision_evidence_plan_artifact_hash }
      : {}),
  };
  const canonicalDispatchDirective = {
    packetHash: row.dispatch_packet_hash,
    contractSliceHash: row.dispatch_contract_slice_hash,
    sourceRevision: {
      sha: row.dispatch_source_sha,
      treeHash: row.dispatch_source_tree_hash,
    },
    findingSetHash: row.dispatch_finding_set_hash,
    findingIds: row.dispatch_finding_ids,
    evidencePlan: row.dispatch_evidence_plan,
    ...(row.dispatch_evidence_plan_artifact_hash
      ? { evidencePlanArtifactHash: row.dispatch_evidence_plan_artifact_hash }
      : {}),
  };
  const completeDeliveryPair = (
    row.delivery_claim_id !== null
    && row.delivery_attempt_id !== null
    && row.delivery_execution_slice_hash !== null
    && row.delivery_attempt_count === 1
    && ["attempt_reserved", "running"].includes(row.delivery_state)
  );
  const freshDeliveryPair = (
    row.delivery_claim_id === null
    && row.delivery_attempt_id === null
    && row.delivery_execution_slice_hash === null
    && row.delivery_attempt_count === 0
    && row.delivery_state === "leased"
  );
  const exactFreshRuntime = (
    freshDeliveryPair
    && row.runtime_state === "reserved"
    && row.runtime_attempt_id === null
    && row.runtime_heartbeat_matches_creation
  );
  const exactReplayRuntime = (
    completeDeliveryPair
    && (
      (
        row.runtime_state === "reserved"
        && (
          row.runtime_attempt_id === null
          || row.runtime_attempt_id === row.delivery_attempt_id
        )
      )
      || (
        row.runtime_state === "starting"
        && row.runtime_attempt_id === row.delivery_attempt_id
      )
    )
  );
  const legalDispatchOwner = (
    (row.dispatch_class === "product_implementation" && row.case_owner === "implement")
    || (row.dispatch_class === "supervisor_repair" && row.case_owner === "supervisor")
  );
  if (
    row.claim_id !== String(reservation.claimId)
    || row.step_db_id !== row.runtime_step_db_id
    || row.story_db_id !== row.runtime_story_db_id
    || row.story_index !== row.stored_story_index
    || !row.publication_bound_matches_claim
    || !row.publication_bound_matches_story
    || !row.publication_bound_not_after_runtime_creation
    || row.runtime_claim_id !== row.claim_id
    || row.runtime_run_id !== reservation.runId
    || row.runtime_workflow_step_id !== reservation.stepId
    || row.runtime_story_id !== reservation.storyId
    || row.runtime_claim_agent_id !== reservation.agentId
    || row.runtime_owner_instance_id !== handoff.lease.ownerInstanceId
    || (!exactFreshRuntime && !exactReplayRuntime)
    || row.run_id !== reservation.runId
    || row.workflow_step_id !== reservation.stepId
    || row.story_id !== reservation.storyId
    || row.recovery_case_id !== handoff.recoveryCaseId
    || row.revision_id !== handoff.revisionId
    || row.dispatch_id !== handoff.dispatchId
    || row.status !== handoff.status
    || row.handoff_canonical_json !== canonicalJsonStringify(handoff)
    || row.handoff_hash !== hashCanonicalJson(handoff)
    || row.case_run_id !== reservation.runId
    || row.case_story_id !== reservation.storyId
    || row.case_status !== "repairing"
    || row.current_revision_id !== reservation.recoveryCaseRevisionId
    || row.case_owner !== row.revision_owner
    || row.case_packet_hash !== row.revision_packet_hash
    || row.case_slice_hash !== row.revision_contract_slice_hash
    || row.case_source_sha !== row.revision_source_sha
    || row.case_source_tree_hash !== row.revision_source_tree_hash
    || row.case_finding_set_hash !== row.revision_finding_set_hash
    || !sameCanonical(row.case_finding_ids, row.revision_finding_ids)
    || !sameCanonical(row.case_expected_delta, row.revision_expected_delta)
    || !sameCanonical(row.case_allowed_paths, row.revision_allowed_paths)
    || !sameCanonical(row.case_evidence_plan, row.revision_evidence_plan)
    || row.revision_recovery_case_id !== row.recovery_case_id
    || row.revision_run_id !== reservation.runId
    || row.revision_story_id !== reservation.storyId
    || row.dispatch_recovery_case_id !== row.recovery_case_id
    || row.dispatch_revision_id !== row.revision_id
    || !legalDispatchOwner
    || handoff.runId !== reservation.runId
    || handoff.storyId !== reservation.storyId
    || handoff.revisionId !== reservation.recoveryCaseRevisionId
    || handoff.dispatchId !== reservation.recoveryDispatchId
    || handoff.dispatchClass !== reservation.attemptClass
    || handoff.recoveryOwner !== row.revision_owner
    || handoff.lease.ownerInstanceId !== reservation.recoveryDeliveryLease?.ownerInstanceId
    || handoff.lease.leaseToken !== reservation.recoveryDeliveryLease?.leaseToken
    || row.delivery_owner_instance_id !== handoff.lease.ownerInstanceId
    || row.delivery_lease_token !== handoff.lease.leaseToken
    || !row.delivery_lease_expires_at
    || row.delivery_lease_matches_handoff !== true
    || !["leased", "attempt_reserved", "running"].includes(row.delivery_state)
    || row.delivery_run_id !== reservation.runId
    || row.delivery_story_id !== reservation.storyId
    || !row.delivery_authorization_matches_dispatch
    || (row.delivery_claim_id !== null && String(row.delivery_claim_id) !== row.claim_id)
    || (row.delivery_execution_slice_hash !== null && row.delivery_execution_slice_hash !== directive.contractSliceHash)
    || ![0, 1].includes(row.delivery_attempt_count)
    || row.run_protocol !== "v3"
    || !["running", "resuming"].includes(row.run_status)
    || row.run_packet_hash !== directive.packetHash
    || row.step_run_id !== reservation.runId
    || row.step_workflow_step_id !== reservation.stepId
    || !["pending", "running"].includes(row.step_status)
    || row.step_current_story_id !== row.story_db_id
    || row.story_run_id !== reservation.runId
    || row.stored_story_id !== reservation.storyId
    || row.story_status !== "running"
    || row.story_claimed_by !== reservation.agentId
    || row.claim_run_id !== reservation.runId
    || row.claim_step_id !== reservation.stepId
    || row.claim_story_id !== reservation.storyId
    || row.claim_agent_id !== reservation.agentId
    || row.claim_outcome !== null
    || row.finding_run_id !== reservation.runId
    || row.finding_story_id !== reservation.storyId
    || row.finding_packet_hash !== row.revision_packet_hash
    || row.finding_slice_hash !== row.revision_contract_slice_hash
    || row.finding_source_sha !== row.revision_source_sha
    || row.finding_source_tree_hash !== row.revision_source_tree_hash
    || !sameCanonical(row.finding_ids, row.revision_finding_ids)
    || directive.packetHash !== reservation.packetHash
    || directive.findingSetHash !== reservation.findingSetHash
    || directive.sourceRevision.sha !== reservation.sourceBefore.sha
    || directive.sourceRevision.treeHash !== reservation.sourceBefore.treeHash
    || row.dispatch_class !== reservation.attemptClass
    || !sameCanonical(directive, canonicalRevisionDirective)
    || !sameCanonical(canonicalDispatchDirective, {
      packetHash: canonicalRevisionDirective.packetHash,
      contractSliceHash: canonicalRevisionDirective.contractSliceHash,
      sourceRevision: canonicalRevisionDirective.sourceRevision,
      findingSetHash: canonicalRevisionDirective.findingSetHash,
      findingIds: canonicalRevisionDirective.findingIds,
      evidencePlan: canonicalRevisionDirective.evidencePlan,
      ...(row.revision_evidence_plan_artifact_hash
        ? { evidencePlanArtifactHash: row.revision_evidence_plan_artifact_hash }
        : {}),
    })
  ) throw new Error("RECOVERY_ATTEMPT_CLAIM_PUBLICATION_MISMATCH");
  return directive.contractSliceHash;
}

function mapAttempt(row: AttemptRow): ExecutionAttemptV1 {
  return ExecutionAttemptV1Schema.parse({
    schema: "setfarm.execution-attempt.v1",
    attemptId: row.attempt_id,
    claimId: optional(row.claim_id === null ? null : Number(row.claim_id)),
    runId: row.run_id,
    stepId: row.step_id,
    storyId: row.story_id,
    generation: row.generation,
    fenceToken: row.fence_token,
    attemptClass: row.attempt_class,
    packetHash: optional(row.packet_hash),
    compilationReportHash: row.compilation_report_hash,
    sliceHash: optional(row.slice_hash),
    sourceBefore: { sha: row.source_before_sha, treeHash: row.source_before_tree_hash },
    ...(row.source_after_sha && row.source_after_tree_hash
      ? { sourceAfter: { sha: row.source_after_sha, treeHash: row.source_after_tree_hash } }
      : {}),
    findingSetHash: optional(row.finding_set_hash),
    recoveryCaseRevisionId: optional(row.recovery_case_revision_id),
    recoveryDispatchId: optional(row.recovery_dispatch_id),
    dedupeKey: optional(row.dedupe_key),
    role: row.role,
    agentId: optional(row.agent_id),
    branch: optional(row.branch),
    worktree: optional(row.worktree),
    lease: {
      acquiredAt: timestamp(row.lease_acquired_at),
      expiresAt: timestamp(row.lease_expires_at),
      heartbeatAt: timestamp(row.heartbeat_at),
    },
    disposition: row.disposition,
    outputHash: optional(row.output_hash),
    evidenceRefs: evidenceRefs(row.evidence_refs),
    createdAt: timestamp(row.created_at),
    updatedAt: timestamp(row.updated_at),
  });
}

async function one(sql: Pick<Sql, "unsafe">, query: string, params: any[]): Promise<AttemptRow | undefined> {
  const rows = await sql.unsafe<AttemptRow[]>(query, params);
  return rows[0];
}

async function adoptExactExistingAttemptOwnerInTransaction(
  transaction: TransactionSql,
  expected: AttemptRow,
): Promise<AttemptRow> {
  const sidecars = await transaction.unsafe<Array<{
    reservation_ref: string;
    reservation_hash: string;
    state: string;
  }>>(
    `SELECT reservation_ref,reservation_hash,state
       FROM internal_production_owner_reservations_v1
      WHERE producer_implementation_id = 'a-execution-attempt-v1'
        AND category = 'execution-attempt'
        AND owner_key = $1
      FOR UPDATE`,
    [expected.attempt_id],
  );
  if (
    sidecars.length !== 1
    || !sidecars[0]
    || !["bound", "closed"].includes(sidecars[0].state)
  ) throw new Error("INTERNAL_PRODUCTION_EXECUTION_ATTEMPT_ADOPTION_INVALID");
  const identity = createInternalProductionExecutionAttemptCanonicalOwnerIdentityV1({
    attemptId: expected.attempt_id,
  });
  const reservation = await beginOrAdoptInternalProductionOwnerReservationV1(
    transaction as PgTransactionSql,
    {
      producerImplementationId: "a-execution-attempt-v1",
      ownerKey: identity.ownerKey,
    },
  );
  if (
    reservation.reservationRef !== sidecars[0].reservation_ref
    || reservation.reservationHash !== sidecars[0].reservation_hash
  ) throw new Error("INTERNAL_PRODUCTION_EXECUTION_ATTEMPT_ADOPTION_INVALID");
  const rereadRows = await transaction.unsafe<AttemptRow[]>(
    "SELECT * FROM execution_attempts WHERE attempt_id = $1 FOR UPDATE",
    [expected.attempt_id],
  );
  const reread = rereadRows[0];
  const rereadBytes = reread
    ? canonicalJsonStringify(JSON.parse(JSON.stringify(mapAttempt(reread))))
    : undefined;
  const expectedBytes = canonicalJsonStringify(JSON.parse(JSON.stringify(mapAttempt(expected))));
  if (
    rereadRows.length !== 1
    || !reread
    || rereadBytes !== expectedBytes
  ) throw new Error("INTERNAL_PRODUCTION_EXECUTION_ATTEMPT_ADOPTION_INVALID");
  const bound = await bindInternalProductionOwnerReservationV1(
    transaction as PgTransactionSql,
    {
      reservationRef: reservation.reservationRef,
      reservationHash: reservation.reservationHash,
      canonicalOwnerIdentity: identity,
    },
  );
  if (
    bound.ownerKey !== expected.attempt_id
    || bound.reservationRef !== reservation.reservationRef
    || bound.reservationHash !== reservation.reservationHash
    || bound.canonicalOwnerIdentity.ownerKey !== expected.attempt_id
  ) throw new Error("INTERNAL_PRODUCTION_EXECUTION_ATTEMPT_BINDING_INVALID");
  return reread;
}

export type AttemptReservationResult =
  | Readonly<{ status: "reserved"; attempt: ExecutionAttemptV1 }>
  | Readonly<{ status: "duplicate"; attempt: ExecutionAttemptV1 }>
  | Readonly<{ status: "active_conflict"; attempt: ExecutionAttemptV1 }>;

export type FenceUpdateResult =
  | Readonly<{ status: "completed"; attempt: ExecutionAttemptV1 }>
  | Readonly<{ status: "candidate"; attempt: ExecutionAttemptV1 }>
  | Readonly<{ status: "heartbeat"; attempt: ExecutionAttemptV1 }>
  | Readonly<{ status: "running"; attempt: ExecutionAttemptV1 }>
  | Readonly<{ status: "stale_fence" }>;

/**
 * Reserve an attempt inside a caller-owned transaction. This is the single
 * insertion/binding implementation used by both ordinary claim publication
 * and non-model evidence-only publication, so claim + attempt + recovery
 * delivery can share one commit boundary.
 */
export async function reserveAttemptInTransaction(
  transaction: TransactionSql,
  input: unknown,
  options: Readonly<{
    now?: Date;
    leaseMs?: number;
    identityFactory?: AttemptIdentityFactory;
  }> = {},
): Promise<AttemptReservationResult> {
  const reservation = parseOperationalRetryAwareAttemptReservation(input);
  const { predecessorAttempt: _predecessorAttempt, ...baseReservation } = reservation;
  const dedupeKey = computeAttemptDedupeKey(baseReservation);
  if (options.now && !Number.isFinite(new Date(options.now).getTime())) {
    throw new Error("ATTEMPT_TIME_INVALID");
  }
  const identityFactory = options.identityFactory ?? defaultAttemptIdentityFactory;
  const lockIdentity = hashCanonicalJson({
    schema: "setfarm.execution-attempt-lock.v1",
    runId: reservation.runId,
    stepId: reservation.stepId,
    storyId: reservation.storyId,
  });
  await transaction.unsafe("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [lockIdentity]);

  const runRows = await transaction.unsafe<{ status: string; protocol: string }[]>(
    "SELECT status, protocol FROM runs WHERE id = $1 LIMIT 1 FOR KEY SHARE",
    [reservation.runId],
  );
  if (runRows.length !== 1) throw new Error("ATTEMPT_RUN_NOT_FOUND");
  if (
    !["running", "resuming"].includes(runRows[0]!.status)
    || !["shadow", "v3"].includes(runRows[0]!.protocol)
  ) {
    throw new Error("ATTEMPT_RUN_NOT_ACTIVE_COMPILER_OWNER");
  }
  if (reservation.claimId === undefined) throw new Error("ATTEMPT_CLAIM_ID_REQUIRED");
  const boundClaims = await transaction.unsafe<Array<{ id: string }>>(
    `SELECT id::text
       FROM claim_log
      WHERE id = $1
        AND run_id = $2
        AND step_id = $3
        AND COALESCE(story_id, '') = $4
        AND outcome IS NULL
        AND ($5::text IS NULL OR agent_id = $5)
      FOR KEY SHARE`,
    [
      reservation.claimId,
      reservation.runId,
      reservation.stepId,
      reservation.storyId,
      reservation.agentId ?? null,
    ],
  );
  if (boundClaims.length !== 1) throw new Error("ATTEMPT_CLAIM_BINDING_INVALID");

  let leaseClock: Date | undefined;
  let recoveryDeliveryLeaseExpiresAt: Date | string | undefined;
  if (reservation.recoveryDispatchId) {
    const authenticatedModelSliceHash = await lockAndAssertRecoveryClaimPublicationForAttemptBirth(
      transaction,
      reservation,
    );
    const existingRecoveryAttempts = await transaction.unsafe<AttemptRow[]>(
      "SELECT * FROM execution_attempts WHERE recovery_dispatch_id = $1 ORDER BY attempt_id LIMIT 2 FOR UPDATE",
      [reservation.recoveryDispatchId],
    );
    if (existingRecoveryAttempts.length > 1) {
      throw new Error("RECOVERY_DELIVERY_ATTEMPT_IDENTITY_AMBIGUOUS");
    }
    const existingRecoveryAttempt = existingRecoveryAttempts[0];
    const deliveryRows = await transaction.unsafe<RecoveryDeliveryBindingRow[]>(
      `SELECT delivery.state, delivery.owner_instance_id, delivery.lease_token,
              delivery.lease_expires_at, delivery.attempt_id, delivery.claim_id,
              delivery.execution_slice_hash, delivery.attempt_count, delivery.started_at,
              delivery.run_id, delivery.story_id,
              dispatch.dispatch_class, dispatch.revision_id,
              dispatch.packet_hash, dispatch.finding_set_hash,
              dispatch.contract_slice_hash,
              dispatch.source_sha, dispatch.source_tree_hash
         FROM recovery_dispatch_deliveries delivery
         JOIN recovery_revision_dispatches dispatch
           ON dispatch.dispatch_id = delivery.dispatch_id
        WHERE delivery.dispatch_id = $1
          AND delivery.revision_id = $2
        FOR UPDATE OF delivery`,
      [reservation.recoveryDispatchId, reservation.recoveryCaseRevisionId!],
    );
    const delivery = deliveryRows[0];
    const leaseIdentity = reservation.recoveryDeliveryLease!;
    if (!delivery) throw new Error("RECOVERY_DELIVERY_NOT_FOUND");
    const authoritativeSliceHash = authenticatedModelSliceHash ?? delivery.contract_slice_hash;
    if (reservation.sliceHash !== authoritativeSliceHash) {
      throw new Error("RECOVERY_DELIVERY_SLICE_AUTHORITY_MISMATCH");
    }
    if (existingRecoveryAttempt) {
      const replayClock = await readDatabaseWallClock(
        transaction,
        "ATTEMPT_DATABASE_TIME_UNAVAILABLE",
      );
      if (
        delivery.attempt_id !== existingRecoveryAttempt.attempt_id
        || String(delivery.claim_id) !== String(reservation.claimId)
        || delivery.execution_slice_hash !== existingRecoveryAttempt.slice_hash
        || delivery.attempt_count !== 1
        || delivery.started_at === null
        || !["attempt_reserved", "running"].includes(delivery.state)
        || delivery.owner_instance_id !== leaseIdentity.ownerInstanceId
        || delivery.lease_token !== leaseIdentity.leaseToken
        || !delivery.lease_expires_at
        || new Date(delivery.lease_expires_at).getTime() <= replayClock.getTime()
        || new Date(existingRecoveryAttempt.lease_expires_at).getTime() <= replayClock.getTime()
        || existingRecoveryAttempt.claim_id !== String(reservation.claimId)
        || existingRecoveryAttempt.run_id !== reservation.runId
        || existingRecoveryAttempt.step_id !== reservation.stepId
        || existingRecoveryAttempt.story_id !== reservation.storyId
        || existingRecoveryAttempt.attempt_class !== reservation.attemptClass
        || existingRecoveryAttempt.packet_hash !== (reservation.packetHash ?? null)
        || existingRecoveryAttempt.compilation_report_hash !== reservation.compilationReportHash
        || existingRecoveryAttempt.slice_hash !== (reservation.sliceHash ?? null)
        || existingRecoveryAttempt.source_before_sha !== reservation.sourceBefore.sha
        || existingRecoveryAttempt.source_before_tree_hash !== reservation.sourceBefore.treeHash
        || existingRecoveryAttempt.finding_set_hash !== (reservation.findingSetHash ?? null)
        || existingRecoveryAttempt.recovery_case_revision_id !== reservation.recoveryCaseRevisionId
        || existingRecoveryAttempt.recovery_dispatch_id !== reservation.recoveryDispatchId
        || existingRecoveryAttempt.role !== reservation.role
        || existingRecoveryAttempt.agent_id !== (reservation.agentId ?? null)
        || existingRecoveryAttempt.branch !== (reservation.branch ?? null)
        || existingRecoveryAttempt.worktree !== (reservation.worktree ?? null)
      ) throw new Error("RECOVERY_DELIVERY_ATTEMPT_IDENTITY_MISMATCH");
      const adopted = await adoptExactExistingAttemptOwnerInTransaction(
        transaction,
        existingRecoveryAttempt,
      );
      return { status: "duplicate" as const, attempt: mapAttempt(adopted) };
    }
    leaseClock = await readDatabaseWallClock(
      transaction,
      "ATTEMPT_DATABASE_TIME_UNAVAILABLE",
    );
    if (
      delivery.state !== "leased"
      || delivery.owner_instance_id !== leaseIdentity.ownerInstanceId
      || delivery.lease_token !== leaseIdentity.leaseToken
      || !delivery.lease_expires_at
      || new Date(delivery.lease_expires_at).getTime() <= leaseClock.getTime()
    ) {
      throw new Error("RECOVERY_DELIVERY_LEASE_INVALID");
    }
    recoveryDeliveryLeaseExpiresAt = delivery.lease_expires_at;
    if (
      delivery.attempt_id !== null
      || delivery.claim_id !== null
      || delivery.execution_slice_hash !== null
      || delivery.attempt_count !== 0
      || delivery.started_at !== null
      || delivery.run_id !== reservation.runId
      || delivery.story_id !== reservation.storyId
      || delivery.dispatch_class !== reservation.attemptClass
      || delivery.revision_id !== reservation.recoveryCaseRevisionId
      || delivery.packet_hash !== reservation.packetHash
      || delivery.finding_set_hash !== reservation.findingSetHash
      || delivery.source_sha !== reservation.sourceBefore.sha
      || delivery.source_tree_hash !== reservation.sourceBefore.treeHash
    ) {
      throw new Error("RECOVERY_DELIVERY_ATTEMPT_IDENTITY_MISMATCH");
    }
  }

  if (dedupeKey) {
    const duplicates = await transaction.unsafe<AttemptRow[]>(
      "SELECT * FROM execution_attempts WHERE dedupe_key = $1 ORDER BY attempt_id LIMIT 2 FOR UPDATE",
      [dedupeKey],
    );
    if (duplicates.length > 1) throw new Error("ATTEMPT_DEDUPE_IDENTITY_AMBIGUOUS");
    const duplicate = duplicates[0];
    if (duplicate) {
      const adopted = await adoptExactExistingAttemptOwnerInTransaction(transaction, duplicate);
      return { status: "duplicate" as const, attempt: mapAttempt(adopted) };
    }
  }
  const activeRows = await transaction.unsafe<AttemptRow[]>(
    `SELECT * FROM execution_attempts
      WHERE run_id = $1 AND step_id = $2 AND story_id = $3
        AND disposition IN ('claimed', 'running')
      ORDER BY attempt_id LIMIT 2 FOR UPDATE`,
    [reservation.runId, reservation.stepId, reservation.storyId],
  );
  if (activeRows.length > 1) throw new Error("ATTEMPT_ACTIVE_IDENTITY_AMBIGUOUS");
  const active = activeRows[0];
  if (active) {
    const adopted = await adoptExactExistingAttemptOwnerInTransaction(transaction, active);
    return { status: "active_conflict" as const, attempt: mapAttempt(adopted) };
  }

  if (reservation.predecessorAttempt) {
    const predecessors = await transaction.unsafe<Array<{
      attempt_id: string;
      generation: number;
      disposition: string;
    }>>(
      `SELECT attempt_id, generation, disposition
         FROM execution_attempts
        WHERE run_id = $1 AND step_id = $2 AND story_id = $3
        ORDER BY generation DESC
        LIMIT 1
        FOR UPDATE`,
      [reservation.runId, reservation.stepId, reservation.storyId],
    );
    const predecessor = predecessors[0];
    if (
      !predecessor
      || predecessor.attempt_id !== reservation.predecessorAttempt.attemptId
      || predecessor.generation !== reservation.predecessorAttempt.generation
      || predecessor.disposition !== reservation.predecessorAttempt.terminalDisposition
    ) {
      throw new Error("ATTEMPT_PREDECESSOR_FENCE_INVALID");
    }
  }

  const generations = await transaction.unsafe<{ generation: number }[]>(
    "SELECT COALESCE(MAX(generation), 0)::integer + 1 AS generation FROM execution_attempts WHERE run_id = $1 AND step_id = $2 AND story_id = $3",
    [reservation.runId, reservation.stepId, reservation.storyId],
  );
  const generation = generations[0]?.generation ?? 1;
  if (
    reservation.predecessorAttempt
    && generation !== reservation.predecessorAttempt.generation + 1
  ) {
    throw new Error("ATTEMPT_PREDECESSOR_GENERATION_INVALID");
  }
  const attemptId = identityFactory.attemptId();
  const fenceToken = identityFactory.fenceToken();
  const now = leaseClock ?? await readDatabaseWallClock(
    transaction,
    "ATTEMPT_DATABASE_TIME_UNAVAILABLE",
  );
  const lease = leaseWindow(now, options.leaseMs ?? DEFAULT_ATTEMPT_LEASE_MS);
  const identity = createInternalProductionExecutionAttemptCanonicalOwnerIdentityV1({
    attemptId,
  });
  const ownerReservation = await beginOrAdoptInternalProductionOwnerReservationV1(
    transaction as PgTransactionSql,
    {
      producerImplementationId: "a-execution-attempt-v1",
      ownerKey: identity.ownerKey,
    },
  );
  const sidecars = await transaction.unsafe<Array<{
    reservation_ref: string;
    reservation_hash: string;
    state: string;
  }>>(
    `SELECT reservation_ref,reservation_hash,state
       FROM internal_production_owner_reservations_v1
      WHERE producer_implementation_id='a-execution-attempt-v1'
        AND category='execution-attempt'
        AND owner_key=$1
      FOR UPDATE`,
    [attemptId],
  );
  const sidecar = sidecars[0];
  if (
    sidecars.length !== 1
    || !sidecar
    || sidecar.reservation_ref !== ownerReservation.reservationRef
    || sidecar.reservation_hash !== ownerReservation.reservationHash
    || !["pending", "bound"].includes(sidecar.state)
  ) throw new Error("INTERNAL_PRODUCTION_EXECUTION_ATTEMPT_ADOPTION_INVALID");
  const insertedRows = await transaction.unsafe<AttemptRow[]>(
    `INSERT INTO execution_attempts (
       attempt_id, claim_id, run_id, step_id, story_id, generation, fence_token,
       attempt_class, packet_hash, compilation_report_hash, slice_hash,
       source_before_sha, source_before_tree_hash, finding_set_hash, dedupe_key,
       recovery_case_revision_id, recovery_dispatch_id,
       role, agent_id, branch, worktree,
       lease_acquired_at, lease_expires_at, heartbeat_at,
       disposition, evidence_refs, created_at, updated_at
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7,
       $8, $9, $10, $11,
       $12, $13, $14, $15,
       $16, $17,
       $18, $19, $20, $21,
       $22, $23, $24,
       'claimed', $25, $22, $22
     ) ON CONFLICT (attempt_id) DO NOTHING
     RETURNING *`,
    [
      attemptId,
      reservation.claimId,
      reservation.runId,
      reservation.stepId,
      reservation.storyId,
      generation,
      fenceToken,
      reservation.attemptClass,
      reservation.packetHash ?? null,
      reservation.compilationReportHash,
      reservation.sliceHash ?? null,
      reservation.sourceBefore.sha,
      reservation.sourceBefore.treeHash,
      reservation.findingSetHash ?? null,
      dedupeKey,
      reservation.recoveryCaseRevisionId ?? null,
      reservation.recoveryDispatchId ?? null,
      reservation.role,
      reservation.agentId ?? null,
      reservation.branch ?? null,
      reservation.worktree ?? null,
      lease.acquiredAt,
      lease.expiresAt,
      lease.heartbeatAt,
      JSON.stringify(reservation.evidenceRefs),
    ],
  );
  if (
    insertedRows.length > 1
    || (insertedRows.length === 1 && sidecar.state !== "pending")
    || (insertedRows.length === 0 && sidecar.state !== "bound")
  ) throw new Error("INTERNAL_PRODUCTION_EXECUTION_ATTEMPT_INSERT_IDENTITY_INVALID");
  const storedRows = await transaction.unsafe<AttemptRow[]>(
    "SELECT * FROM execution_attempts WHERE attempt_id=$1 FOR UPDATE",
    [attemptId],
  );
  const inserted = storedRows[0];
  if (
    storedRows.length !== 1
    || !inserted
    || inserted.attempt_id !== attemptId
    || inserted.claim_id !== String(reservation.claimId)
    || inserted.run_id !== reservation.runId
    || inserted.step_id !== reservation.stepId
    || inserted.story_id !== reservation.storyId
    || inserted.generation !== generation
    || inserted.fence_token !== fenceToken
    || inserted.attempt_class !== reservation.attemptClass
    || inserted.packet_hash !== (reservation.packetHash ?? null)
    || inserted.compilation_report_hash !== reservation.compilationReportHash
    || inserted.slice_hash !== (reservation.sliceHash ?? null)
    || inserted.source_before_sha !== reservation.sourceBefore.sha
    || inserted.source_before_tree_hash !== reservation.sourceBefore.treeHash
    || inserted.source_after_sha !== null
    || inserted.source_after_tree_hash !== null
    || inserted.finding_set_hash !== (reservation.findingSetHash ?? null)
    || inserted.recovery_case_revision_id !== (reservation.recoveryCaseRevisionId ?? null)
    || inserted.recovery_dispatch_id !== (reservation.recoveryDispatchId ?? null)
    || inserted.dedupe_key !== dedupeKey
    || inserted.role !== reservation.role
    || inserted.agent_id !== (reservation.agentId ?? null)
    || inserted.branch !== (reservation.branch ?? null)
    || inserted.worktree !== (reservation.worktree ?? null)
    || timestamp(inserted.lease_acquired_at) !== lease.acquiredAt.toISOString()
    || timestamp(inserted.lease_expires_at) !== lease.expiresAt.toISOString()
    || timestamp(inserted.heartbeat_at) !== lease.heartbeatAt.toISOString()
    || inserted.disposition !== "claimed"
    || inserted.output_hash !== null
    || JSON.stringify(evidenceRefs(inserted.evidence_refs)) !== JSON.stringify(reservation.evidenceRefs)
    || timestamp(inserted.created_at) !== lease.acquiredAt.toISOString()
    || timestamp(inserted.updated_at) !== lease.acquiredAt.toISOString()
  ) throw new Error("INTERNAL_PRODUCTION_EXECUTION_ATTEMPT_ADOPTION_INVALID");
  const bound = await bindInternalProductionOwnerReservationV1(
    transaction as PgTransactionSql,
    {
      reservationRef: ownerReservation.reservationRef,
      reservationHash: ownerReservation.reservationHash,
      canonicalOwnerIdentity: identity,
    },
  );
  if (
    bound.ownerKey !== attemptId
    || bound.reservationRef !== ownerReservation.reservationRef
    || bound.reservationHash !== ownerReservation.reservationHash
    || bound.canonicalOwnerIdentity.ownerKey !== attemptId
  ) throw new Error("INTERNAL_PRODUCTION_EXECUTION_ATTEMPT_BINDING_INVALID");
  if (reservation.recoveryDispatchId) {
    const deliveryRows = await transaction.unsafe<Array<{
      dispatch_id: string;
      claim_id: string;
      attempt_id: string;
      execution_slice_hash: string;
      state: string;
      attempt_count: number;
    }>>(
      `UPDATE recovery_dispatch_deliveries
          SET state = 'attempt_reserved',
              claim_id = $4::bigint,
              attempt_id = $5,
              execution_slice_hash = $6,
              attempt_count = attempt_count + 1,
              started_at = $7,
              updated_at = $7
        WHERE dispatch_id = $1
          AND revision_id = $2
          AND state = 'leased'
          AND lease_token = $3
          AND owner_instance_id = $8
          AND lease_expires_at = $9
          AND claim_id IS NULL
          AND attempt_id IS NULL
          AND execution_slice_hash IS NULL
          AND attempt_count = 0
          AND started_at IS NULL
        RETURNING dispatch_id,claim_id::text,attempt_id,
                  execution_slice_hash,state,attempt_count`,
      [
        reservation.recoveryDispatchId,
        reservation.recoveryCaseRevisionId!,
        reservation.recoveryDeliveryLease!.leaseToken,
        reservation.claimId,
        inserted.attempt_id,
        reservation.sliceHash!,
        now,
        reservation.recoveryDeliveryLease!.ownerInstanceId,
        recoveryDeliveryLeaseExpiresAt!,
      ],
    );
    const delivery = deliveryRows[0];
    if (
      deliveryRows.length !== 1
      || delivery?.dispatch_id !== reservation.recoveryDispatchId
      || delivery.claim_id !== String(reservation.claimId)
      || delivery.attempt_id !== inserted.attempt_id
      || delivery.execution_slice_hash !== reservation.sliceHash
      || delivery.state !== "attempt_reserved"
      || delivery.attempt_count !== 1
    ) throw new Error("RECOVERY_DELIVERY_BIND_CAS_LOST");
  }
  return { status: "reserved" as const, attempt: mapAttempt(inserted) };
}

async function mutateLiveAttemptFence(
  sql: Sql,
  identity: z.infer<typeof FenceIdentityV1Schema>,
  operation: (
    transaction: TransactionSql,
    current: AttemptRow,
    wallClock: Date,
  ) => Promise<AttemptRow | undefined>,
): Promise<AttemptRow | undefined> {
  return sql.begin(async (transaction) => {
    const discoveredRows = await transaction.unsafe<Array<Pick<AttemptRow, "run_id">>>(
      "SELECT run_id FROM execution_attempts WHERE attempt_id = $1",
      [identity.attemptId],
    );
    const discovered = discoveredRows[0];
    if (!discovered) return undefined;
    const runs = await transaction.unsafe<Array<{ status: string }>>(
      "SELECT status FROM runs WHERE id = $1 FOR UPDATE",
      [discovered.run_id],
    );
    if (!runs[0] || !["running", "resuming"].includes(runs[0].status)) return undefined;
    const locked = await one(
      transaction,
      `SELECT * FROM execution_attempts
        WHERE attempt_id = $1 AND generation = $2 AND fence_token = $3
        FOR UPDATE`,
      [identity.attemptId, identity.generation, identity.fenceToken],
    );
    if (!locked || !["claimed", "running"].includes(locked.disposition)) return undefined;

    let recoveryDelivery: Readonly<{
      state: string;
      attempt_id: string | null;
      claim_id: string | number | null;
      execution_slice_hash: string | null;
      lease_expires_at: Date | string | null;
    }> | undefined;
    if (locked.recovery_dispatch_id) {
      const deliveries = await transaction.unsafe<Array<{
        state: string;
        attempt_id: string | null;
        claim_id: string | number | null;
        execution_slice_hash: string | null;
        lease_expires_at: Date | string | null;
      }>>(
        `SELECT state, attempt_id, claim_id, execution_slice_hash, lease_expires_at
           FROM recovery_dispatch_deliveries
          WHERE dispatch_id = $1
          FOR UPDATE`,
        [locked.recovery_dispatch_id],
      );
      recoveryDelivery = deliveries[0];
    }
    const wallClock = await readDatabaseWallClock(
      transaction,
      "ATTEMPT_DATABASE_TIME_UNAVAILABLE",
    );
    const attemptLeaseExpiresAt = new Date(locked.lease_expires_at).getTime();
    if (
      !Number.isFinite(attemptLeaseExpiresAt)
      || attemptLeaseExpiresAt <= wallClock.getTime()
    ) return undefined;
    if (
      locked.recovery_dispatch_id
      && (
        !recoveryDelivery
        || !["attempt_reserved", "running"].includes(recoveryDelivery.state)
        || recoveryDelivery.attempt_id !== locked.attempt_id
        || String(recoveryDelivery.claim_id) !== locked.claim_id
        || recoveryDelivery.execution_slice_hash !== locked.slice_hash
        || !recoveryDelivery.lease_expires_at
        || !Number.isFinite(new Date(recoveryDelivery.lease_expires_at).getTime())
        || new Date(recoveryDelivery.lease_expires_at).getTime() <= wallClock.getTime()
      )
    ) return undefined;
    return operation(transaction, locked, wallClock);
  }) as Promise<AttemptRow | undefined>;
}

export function createAttemptRepository(
  sql: Sql,
  identityFactory: AttemptIdentityFactory = defaultAttemptIdentityFactory,
) {
  return {
    async reserve(
      input: unknown,
      options: Readonly<{ now?: Date; leaseMs?: number }> = {},
    ): Promise<AttemptReservationResult> {
      const now = options.now ? new Date(options.now) : new Date();
      return sql.begin((transaction) => reserveAttemptInTransaction(transaction, input, {
        now,
        ...(options.leaseMs === undefined ? {} : { leaseMs: options.leaseMs }),
        identityFactory,
      })) as Promise<AttemptReservationResult>;
    },

    async findById(attemptId: string): Promise<ExecutionAttemptV1 | undefined> {
      const row = await one(sql, "SELECT * FROM execution_attempts WHERE attempt_id = $1", [attemptId]);
      return row ? mapAttempt(row) : undefined;
    },

    async findActive(identity: Readonly<{
      runId: string;
      stepId: string;
      storyId: string;
    }>): Promise<ExecutionAttemptV1 | undefined> {
      const row = await one(
        sql,
        `SELECT * FROM execution_attempts
          WHERE run_id = $1 AND step_id = $2 AND story_id = $3
            AND disposition IN ('claimed', 'running')
          LIMIT 1`,
        [identity.runId, identity.stepId, identity.storyId],
      );
      return row ? mapAttempt(row) : undefined;
    },

    async heartbeat(
      input: unknown,
      options: Readonly<{ now?: Date; leaseMs?: number }> = {},
    ): Promise<FenceUpdateResult> {
      const identity = FenceIdentityV1Schema.parse(input);
      if (options.now && !Number.isFinite(new Date(options.now).getTime())) {
        throw new Error("ATTEMPT_TIME_INVALID");
      }
      const row = await mutateLiveAttemptFence(sql, identity, async (transaction, _current, now) => {
        const lease = leaseWindow(now, options.leaseMs ?? DEFAULT_ATTEMPT_LEASE_MS);
        return one(
          transaction,
          `UPDATE execution_attempts
              SET heartbeat_at = $4, lease_expires_at = $5, updated_at = $4
            WHERE attempt_id = $1 AND generation = $2 AND fence_token = $3
              AND disposition IN ('claimed', 'running')
              AND lease_expires_at > $4
            RETURNING *`,
          [identity.attemptId, identity.generation, identity.fenceToken, now, lease.expiresAt],
        );
      });
      return row ? { status: "heartbeat", attempt: mapAttempt(row) } : { status: "stale_fence" };
    },

    async markRunning(input: unknown, options: Readonly<{ now?: Date }> = {}): Promise<FenceUpdateResult> {
      const identity = FenceIdentityV1Schema.parse(input);
      if (options.now && !Number.isFinite(new Date(options.now).getTime())) {
        throw new Error("ATTEMPT_TIME_INVALID");
      }
      const row = await mutateLiveAttemptFence(sql, identity, (transaction, _current, now) => one(
        transaction,
        `UPDATE execution_attempts
            SET disposition = 'running', heartbeat_at = $4, updated_at = $4
          WHERE attempt_id = $1 AND generation = $2 AND fence_token = $3
            AND disposition IN ('claimed', 'running')
            AND lease_expires_at > $4
          RETURNING *`,
        [identity.attemptId, identity.generation, identity.fenceToken, now],
      ));
      return row ? { status: "running", attempt: mapAttempt(row) } : { status: "stale_fence" };
    },

    /**
     * Attest the exact platform-owned candidate commit while the attempt fence
     * is still active. Canonical evidence is only valid after this succeeds.
     * Replays of the same source are idempotent; a different source can never
     * replace an already-attested candidate under the same attempt.
     */
    async recordCandidateSource(
      input: unknown,
      options: Readonly<{ now?: Date }> = {},
    ): Promise<FenceUpdateResult> {
      const candidate = CandidateSourceInputV1Schema.parse(input);
      if (options.now && !Number.isFinite(new Date(options.now).getTime())) {
        throw new Error("ATTEMPT_TIME_INVALID");
      }
      const row = await mutateLiveAttemptFence(sql, candidate, (transaction, _current, now) => one(
        transaction,
        `UPDATE execution_attempts
            SET source_after_sha = $4,
                source_after_tree_hash = $5,
                heartbeat_at = $6,
                updated_at = $6
          WHERE attempt_id = $1 AND generation = $2 AND fence_token = $3
            AND disposition IN ('claimed', 'running')
            AND lease_expires_at > $6
            AND (
              source_after_sha IS NULL
              OR (source_after_sha = $4 AND source_after_tree_hash = $5)
            )
          RETURNING *`,
        [
          candidate.attemptId,
          candidate.generation,
          candidate.fenceToken,
          candidate.sourceAfter.sha,
          candidate.sourceAfter.treeHash,
          now,
        ],
      ));
      return row ? { status: "candidate", attempt: mapAttempt(row) } : { status: "stale_fence" };
    },

    async complete(input: unknown, options: Readonly<{ now?: Date }> = {}): Promise<FenceUpdateResult> {
      const completion = CompletionInputV1Schema.parse(input);
      if (options.now && !Number.isFinite(new Date(options.now).getTime())) {
        throw new Error("ATTEMPT_TIME_INVALID");
      }
      const row = await mutateLiveAttemptFence(sql, completion, async (transaction, _current, now) => {
        const completed = await one(
          transaction,
          `UPDATE execution_attempts
            SET disposition = $4,
                source_after_sha = COALESCE(execution_attempts.source_after_sha, $5),
                source_after_tree_hash = COALESCE(execution_attempts.source_after_tree_hash, $6),
                output_hash = $7,
                evidence_refs = (
                  SELECT jsonb_agg(ref.value ORDER BY ref.value)::text
                    FROM (
                      SELECT DISTINCT value
                        FROM jsonb_array_elements_text(
                          execution_attempts.evidence_refs::jsonb || $8::text::jsonb
                        ) AS item(value)
                    ) AS ref
                ),
                heartbeat_at = $9,
                updated_at = $9
          WHERE attempt_id = $1 AND generation = $2 AND fence_token = $3
            AND disposition IN ('claimed', 'running')
            AND lease_expires_at > $9
            AND (
              source_after_sha IS NULL
              OR ($5::text IS NOT NULL AND source_after_sha = $5 AND source_after_tree_hash = $6)
            )
          RETURNING *`,
        [
          completion.attemptId,
          completion.generation,
          completion.fenceToken,
          completion.disposition,
          completion.sourceAfter?.sha ?? null,
          completion.sourceAfter?.treeHash ?? null,
          completion.outputHash ?? null,
          JSON.stringify(completion.evidenceRefs),
            now,
          ],
        );
        if (!completed) return undefined;
        const terminalClose = await resolveInternalProductionExecutionAttemptTerminalAuthorityPairInTransactionV1(
          transaction as PgTransactionSql,
          { attemptId: completed.attempt_id },
        );
        await closeInternalProductionOwnerReservationV1(
          transaction as PgTransactionSql,
          terminalClose,
        );
        return completed;
      });
      return row ? { status: "completed", attempt: mapAttempt(row) } : { status: "stale_fence" };
    },
  };
}
