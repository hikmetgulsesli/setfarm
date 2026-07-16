import type postgres from "postgres";

import { AcceptedCandidateV1Schema, type AcceptedCandidateV1 } from "../evidence/accepted-candidate-v1.js";
import type { ArtifactCapacityLimits } from "../product-compiler/artifact-capacity.js";
import {
  compileLegacyResumePlan,
  OPERATOR_ACTION_STATE_SCHEMA,
  readLegacyResumePlanSource,
  type LegacyResumePlanResult,
} from "../execution/legacy-resume-plan.js";
import {
  DESIGN_CANDIDATE_AUTHORITY_EVIDENCE_SCHEMA_V2,
  DESIGN_CANDIDATE_AUTHORITY_REQUESTER_V2,
  OperationalFailureIdentityV2Schema,
  createOperationalFailureIdentityV2,
} from "../execution/schemas/operational-failure-identity-v2.js";
import { OperationalFailureCauseV1Schema } from "../execution/schemas/operational-failure-cause-v1.js";
import { V3DeployReceiptV1Schema, type V3DeployReceiptV1 } from "../execution/schemas/v3-deploy-receipt-v1.js";
import {
  V3ProjectTransferAckV1Schema,
  type V3ProjectTransferAckV1,
} from "../execution/schemas/v3-project-transfer-ack-v1.js";
import { RuntimeCompletionSubmissionEvidenceV1Schema } from "../execution/schemas/runtime-completion-submission-evidence-v1.js";
import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import {
  resolveProductArtifactCapacity,
  resolveProductArtifactDir,
} from "../runtime-config.js";
import {
  type OperationalAttemptV1,
  type OperationalAcceptedCandidateV1,
  type OperationalV3DeployReceiptV1,
  type OperationalV3ProjectTransferAckV1,
  type OperationalClaimV1,
  type OperationalCompletionEffectV1,
  type OperationalEvidenceBundleV1,
  type OperationalFindingSetV1,
  type OperationalInvariantV1,
  type OperationalOutboxItemV1,
  type OperationalRunV1,
  type OperationalRecoveryCaseV1,
  type OperationalRecoveryDispatchV1,
  type OperationalRuntimeSessionV1,
  type OperationalSummaryV1,
  type OperationalTerminationRequestV1,
  type RunOperationalSnapshotV1,
} from "./schemas/run-operational-snapshot-v1.js";
import {
  RunOperationalSnapshotV2Schema,
  type OperationalCompletionRequestV2,
  type OperationalProjectionCapabilitiesV2,
  type OperationalProjectionSourceV2,
  type RunOperationalSnapshotV2,
} from "./schemas/run-operational-snapshot-v2.js";
import {
  OperationalTerminationRequestV3Schema,
  RunOperationalSnapshotV3Schema,
  computeRunOperationalSnapshotHashV3,
  type CanonicalOperationalFailureV3,
  type OperationalProjectionSourceV3,
  type RunOperationalSnapshotV3,
} from "./schemas/run-operational-snapshot-v3.js";
import {
  readVerifiedDesignCandidateRefusal,
  type VerifiedDesignCandidateRefusalReadOptions,
} from "./product-build-authority.js";
import { hasStopBlockingInvariant } from "../execution/run-operational-invariant-policy.js";

type Sql = postgres.Sql;
type TransactionSql = postgres.TransactionSql;

const TERMINAL_RUN_STATUSES = new Set(["completed", "done", "failed", "cancelled", "canceled", "error"]);
const ACTIVE_ATTEMPT_STATES = new Set(["claimed", "running"]);
const ACTIVE_RUNTIME_STATES = new Set(["reserved", "starting", "running", "drain_requested"]);
const OPEN_COMPLETION_STATES = new Set(["requested", "draining", "processing"]);
const SETTLED_EFFECT_STATES = new Set(["applied", "reconciled"]);
const REQUIRED_TABLE_COLUMNS = {
  runs: ["id", "run_number", "protocol", "status", "updated_at"],
  claim_log: ["id", "run_id", "step_id", "story_id", "agent_id", "claimed_at", "outcome", "abandoned_at"],
  execution_attempts: [
    "attempt_id", "run_id", "step_id", "story_id", "generation", "attempt_class", "packet_hash",
    "compilation_report_hash", "slice_hash", "source_before_sha", "source_before_tree_hash",
    "source_after_sha", "source_after_tree_hash", "finding_set_hash", "role", "agent_id",
    "disposition", "output_hash", "created_at", "updated_at",
  ],
  runtime_sessions: [
    "session_id", "run_id", "claim_id", "attempt_id", "workflow_step_id", "story_id", "runtime_kind",
    "state", "state_version", "started_at", "heartbeat_at", "drain_requested_at", "drained_at",
    "released_at", "created_at", "updated_at",
  ],
  runtime_completion_requests: [
    "request_id", "runtime_session_id", "claim_id", "run_id", "workflow_step_id", "story_id", "attempt_id",
    "output_hash", "apply_phase", "claim_outcome", "state", "requested_at", "drained_at", "processing_at",
    "accepted_at", "rejected_at", "created_at", "updated_at",
  ],
  runtime_completion_effects: [
    "request_id", "effect_key", "ordinal", "effect_type", "input_hash", "mandatory", "state", "attempt_count",
    "applied_at", "reconciled_at", "created_at", "updated_at",
  ],
  run_termination_requests: [
    "request_id", "run_id", "target_status", "state", "requested_by", "requested_at", "drained_at",
    "terminalized_at", "diagnostic", "evidence", "created_at", "updated_at",
  ],
  operational_outbox: [
    "outbox_id", "request_id", "event_key", "event_type", "aggregate_type", "aggregate_id", "state",
    "attempt_count", "published_at", "created_at", "updated_at",
  ],
  operational_events: [
    "event_key", "outbox_id", "run_id", "event_hash", "source_created_at", "committed_at",
  ],
  finding_sets: [
    "finding_set_hash", "finding_set_id", "run_id", "story_id", "packet_hash", "slice_hash",
    "source_sha", "source_tree_hash", "finding_ids", "created_at",
  ],
  evidence_bundles: [
    "evidence_bundle_hash", "evidence_id", "run_id", "story_id", "packet_hash", "slice_hash",
    "source_sha", "source_tree_hash", "attempt_id", "aggregate_verdict", "payload", "created_at",
  ],
  recovery_cases: [
    "recovery_case_id", "run_id", "story_id", "current_revision_id", "owner", "expected_delta",
    "max_implement", "max_supervisor_repair", "max_evidence_only", "used_implement",
    "used_supervisor_repair", "used_evidence_only", "status", "terminal", "state_version",
    "created_at", "updated_at",
  ],
  recovery_case_revisions: [
    "revision_id", "recovery_case_id", "revision_number", "run_id", "story_id", "finding_set_hash",
    "packet_hash", "contract_slice_hash", "source_sha", "source_tree_hash", "owner", "expected_delta",
  ],
  recovery_revision_dispatches: [
    "dispatch_id", "recovery_case_id", "revision_id", "dispatch_class", "source_sha", "source_tree_hash",
    "packet_hash", "contract_slice_hash", "finding_set_hash", "finding_ids", "authorized_at",
  ],
  recovery_dispatch_deliveries: [
    "dispatch_id", "recovery_case_id", "revision_id", "run_id", "story_id", "state", "owner_instance_id",
    "lease_token", "lease_expires_at", "attempt_id", "claim_id", "execution_slice_hash", "attempt_count",
    "terminal_result", "authorized_at", "terminal_at",
  ],
  accepted_candidates: [
    "candidate_hash", "candidate_id", "run_id", "packet_hash", "story_plan_hash",
    "source_sha", "source_tree_hash", "integration_evidence_hash", "payload", "created_at",
  ],
  accepted_candidate_story_evidence: [
    "candidate_hash", "story_id", "attempt_id", "slice_hash", "evidence_plan_hash",
    "evidence_plan_artifact_hash", "evidence_bundle_hash", "evidence_id", "predicate_refs", "created_at",
  ],
  v3_deploy_receipts: [
    "receipt_hash", "run_id", "step_db_id", "workflow_step_id", "claim_id", "candidate_id",
    "candidate_hash", "packet_hash", "product_id", "project_id", "display_name", "summary",
    "stack_pack_id", "stack_pack_version", "stack_pack_content_hash", "platform", "tech_stack",
    "source_sha", "source_tree_hash", "service_id", "deployment_mode", "host", "port", "health_url",
    "deploy_url", "health_http_status", "health_checked_at", "terminal_projection_ref", "completed_at",
    "payload", "created_at",
  ],
  v3_project_transfer_acks: [
    "ack_hash", "run_id", "candidate_id", "candidate_hash", "packet_hash",
    "source_sha", "source_tree_hash", "deploy_receipt_hash", "source_snapshot_hash",
    "project_id", "projection_hash", "project_record_hash", "project_record_ref",
    "persisted_at", "payload", "created_at",
  ],
  semantic_artifacts: [
    "artifact_hash", "artifact_type", "byte_length", "producer_metadata", "created_at",
  ],
  run_artifact_refs: [
    "run_id", "ref_key", "artifact_hash", "created_at",
  ],
} as const;

type TableName = keyof typeof REQUIRED_TABLE_COLUMNS;

type RawRun = {
  id: unknown;
  run_number: unknown;
  protocol: unknown;
  status: unknown;
  updated_at: unknown;
  accepted_candidate_hash: unknown;
  deploy_receipt_hash: unknown;
  project_transfer_ack_hash: unknown;
};

type RawClaim = {
  id: unknown;
  step_id: unknown;
  story_id: unknown;
  agent_id: unknown;
  claimed_at: unknown;
  outcome: unknown;
  abandoned_at: unknown;
};

type RawAttempt = {
  attempt_id: unknown;
  claim_id: unknown;
  step_id: unknown;
  story_id: unknown;
  generation: unknown;
  attempt_class: unknown;
  packet_hash: unknown;
  compilation_report_hash: unknown;
  slice_hash: unknown;
  source_before_sha: unknown;
  source_before_tree_hash: unknown;
  source_after_sha: unknown;
  source_after_tree_hash: unknown;
  finding_set_hash: unknown;
  role: unknown;
  agent_id: unknown;
  disposition: unknown;
  output_hash: unknown;
  created_at: unknown;
  updated_at: unknown;
};

type RawRuntime = {
  session_id: unknown;
  claim_id: unknown;
  attempt_id: unknown;
  workflow_step_id: unknown;
  story_id: unknown;
  runtime_kind: unknown;
  state: unknown;
  state_version: unknown;
  started_at: unknown;
  heartbeat_at: unknown;
  drain_requested_at: unknown;
  drained_at: unknown;
  released_at: unknown;
  created_at: unknown;
  updated_at: unknown;
};

type RawCompletion = {
  request_id: unknown;
  runtime_session_id: unknown;
  claim_id: unknown;
  attempt_id: unknown;
  workflow_step_id: unknown;
  story_id: unknown;
  output_hash: unknown;
  submission_evidence: unknown;
  source_proposal_hash: unknown;
  persisted_output_hash: unknown;
  apply_phase: unknown;
  claim_outcome: unknown;
  completion_plan_hash: unknown;
  state: unknown;
  requested_at: unknown;
  drained_at: unknown;
  processing_at: unknown;
  accepted_at: unknown;
  rejected_at: unknown;
  created_at: unknown;
  updated_at: unknown;
};

type RawEffect = {
  request_id: unknown;
  effect_key: unknown;
  ordinal: unknown;
  effect_type: unknown;
  input_hash: unknown;
  mandatory: unknown;
  state: unknown;
  attempt_count: unknown;
  applied_at: unknown;
  reconciled_at: unknown;
  created_at: unknown;
  updated_at: unknown;
};

type RawTermination = {
  request_id: unknown;
  target_status: unknown;
  state: unknown;
  requested_by: unknown;
  diagnostic: unknown;
  evidence: unknown;
  requested_at: unknown;
  drained_at: unknown;
  terminalized_at: unknown;
  created_at: unknown;
  updated_at: unknown;
};

type RawOutbox = {
  outbox_id: unknown;
  request_id: unknown;
  event_key: unknown;
  event_type: unknown;
  aggregate_type: unknown;
  aggregate_id: unknown;
  state: unknown;
  attempt_count: unknown;
  published_at: unknown;
  created_at: unknown;
  updated_at: unknown;
};

type RawFindingSet = {
  finding_set_hash: unknown;
  finding_set_id: unknown;
  story_id: unknown;
  packet_hash: unknown;
  slice_hash: unknown;
  source_sha: unknown;
  source_tree_hash: unknown;
  finding_ids: unknown;
  created_at: unknown;
};

type RawEvidenceBundle = {
  evidence_bundle_hash: unknown;
  evidence_id: unknown;
  story_id: unknown;
  packet_hash: unknown;
  slice_hash: unknown;
  source_sha: unknown;
  source_tree_hash: unknown;
  attempt_id: unknown;
  aggregate_verdict: unknown;
  predicate_count: unknown;
  observation_count: unknown;
  created_at: unknown;
};

type RawRecoveryCase = {
  recovery_case_id: unknown;
  revision_id: unknown;
  revision_number: unknown;
  case_story_id: unknown;
  revision_run_id: unknown;
  story_id: unknown;
  finding_set_hash: unknown;
  packet_hash: unknown;
  contract_slice_hash: unknown;
  source_sha: unknown;
  source_tree_hash: unknown;
  case_owner: unknown;
  revision_owner: unknown;
  case_expected_delta_kind: unknown;
  revision_expected_delta_kind: unknown;
  max_implement: unknown;
  max_supervisor_repair: unknown;
  max_evidence_only: unknown;
  used_implement: unknown;
  used_supervisor_repair: unknown;
  used_evidence_only: unknown;
  status: unknown;
  terminal_reason_code: unknown;
  state_version: unknown;
  created_at: unknown;
  updated_at: unknown;
};

type RawRecoveryDispatch = {
  dispatch_id: unknown;
  recovery_case_id: unknown;
  revision_id: unknown;
  revision_number: unknown;
  dispatch_class: unknown;
  revision_run_id: unknown;
  revision_story_id: unknown;
  delivery_run_id: unknown;
  delivery_story_id: unknown;
  source_sha: unknown;
  source_tree_hash: unknown;
  packet_hash: unknown;
  contract_slice_hash: unknown;
  finding_set_hash: unknown;
  finding_ids: unknown;
  dispatch_authorized_at: unknown;
  delivery_authorized_at: unknown;
  delivery_state: unknown;
  owner_instance_id: unknown;
  lease_expires_at: unknown;
  attempt_id: unknown;
  claim_id: unknown;
  execution_slice_hash: unknown;
  attempt_count: unknown;
  terminal_reason_code: unknown;
  terminal_at: unknown;
};

type RawAcceptedCandidate = {
  candidate_hash: unknown;
  candidate_id: unknown;
  run_id: unknown;
  packet_hash: unknown;
  story_plan_hash: unknown;
  source_sha: unknown;
  source_tree_hash: unknown;
  integration_evidence_hash: unknown;
  payload: unknown;
  created_at: unknown;
};

type RawAcceptedCandidateStoryEvidence = {
  candidate_hash: unknown;
  story_id: unknown;
  attempt_id: unknown;
  slice_hash: unknown;
  evidence_plan_hash: unknown;
  evidence_plan_artifact_hash: unknown;
  evidence_bundle_hash: unknown;
  evidence_id: unknown;
  predicate_refs: unknown;
};

type RawV3DeployReceipt = {
  receipt_hash: unknown;
  run_id: unknown;
  candidate_id: unknown;
  candidate_hash: unknown;
  packet_hash: unknown;
  product_id: unknown;
  project_id: unknown;
  display_name: unknown;
  summary: unknown;
  stack_pack_id: unknown;
  stack_pack_version: unknown;
  stack_pack_content_hash: unknown;
  platform: unknown;
  tech_stack: unknown;
  source_sha: unknown;
  source_tree_hash: unknown;
  service_id: unknown;
  deployment_mode: unknown;
  host: unknown;
  port: unknown;
  health_url: unknown;
  deploy_url: unknown;
  health_http_status: unknown;
  health_checked_at: unknown;
  terminal_projection_ref: unknown;
  completed_at: unknown;
  payload: unknown;
  created_at: unknown;
};

type RawV3ProjectTransferAck = {
  ack_hash: unknown;
  run_id: unknown;
  candidate_id: unknown;
  candidate_hash: unknown;
  packet_hash: unknown;
  source_sha: unknown;
  source_tree_hash: unknown;
  deploy_receipt_hash: unknown;
  source_snapshot_hash: unknown;
  project_id: unknown;
  projection_hash: unknown;
  project_record_hash: unknown;
  project_record_ref: unknown;
  persisted_at: unknown;
  payload: unknown;
  created_at: unknown;
};

function identity(value: unknown): string {
  return String(value ?? "");
}

function optionalIdentity(value: unknown): string | null {
  const normalized = identity(value);
  return normalized.length > 0 ? normalized : null;
}

function integer(value: unknown): number {
  return Number(value);
}

function timestamp(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return new Date(String(value)).toISOString();
}

function optionalTimestamp(value: unknown): string | null {
  return value === null || value === undefined ? null : timestamp(value);
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new TypeError("OPERATIONAL_SNAPSHOT_CANONICAL_STRING_ARRAY_REQUIRED");
  }
  return value;
}

function jsonObject(value: unknown): Record<string, unknown> {
  const parsed = typeof value === "string" ? JSON.parse(value) as unknown : value;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new TypeError("OPERATIONAL_SNAPSHOT_CANONICAL_JSON_OBJECT_REQUIRED");
  }
  return parsed as Record<string, unknown>;
}

function segment(value: string): string {
  return encodeURIComponent(value);
}

export function runOperationalRef(runId: string): string {
  return `setfarm://run/${segment(runId)}`;
}

function stepRef(runId: string, workflowStepId: string): string {
  return `${runOperationalRef(runId)}/step/${segment(workflowStepId)}`;
}

function storyRef(runId: string, storyId: string | null): string | null {
  return storyId ? `${runOperationalRef(runId)}/story/${segment(storyId)}` : null;
}

function claimRef(claimId: string): string {
  return `setfarm://claim-log/${claimId}`;
}

function attemptRef(attemptId: string): string {
  return `setfarm://execution-attempt/${segment(attemptId)}`;
}

function runtimeRef(sessionId: string): string {
  return `setfarm://runtime-session/${segment(sessionId)}`;
}

function completionRef(requestId: string): string {
  return `setfarm://runtime-completion/${segment(requestId)}`;
}

function effectRef(requestId: string, effectKey: string): string {
  return `${completionRef(requestId)}/effect/${segment(effectKey)}`;
}

function terminationRef(requestId: string): string {
  return `setfarm://run-termination/${segment(requestId)}`;
}

function outboxRef(outboxId: string): string {
  return `setfarm://operational-outbox/${segment(outboxId)}`;
}

function findingSetRef(findingSetHash: string): string {
  return `setfarm://finding-set/${segment(findingSetHash)}`;
}

function evidenceBundleRef(evidenceBundleHash: string): string {
  return `setfarm://evidence-bundle/${segment(evidenceBundleHash)}`;
}

function recoveryCaseRef(recoveryCaseId: string): string {
  return `setfarm://recovery-case/${segment(recoveryCaseId)}`;
}

function recoveryRevisionRef(revisionId: string): string {
  return `setfarm://recovery-revision/${segment(revisionId)}`;
}

function recoveryDispatchRef(dispatchId: string): string {
  return `setfarm://recovery-dispatch/${segment(dispatchId)}`;
}

function acceptedCandidateRef(candidateHash: string): string {
  return `setfarm://accepted-candidate/${segment(candidateHash)}`;
}

function v3DeployReceiptRef(receiptHash: string): string {
  return `setfarm://v3-deploy-receipts/${segment(receiptHash)}`;
}

function v3ProjectTransferAckRef(ackHash: string): string {
  return `setfarm://v3-project-transfer-acks/${segment(ackHash)}`;
}

function hasColumns(columns: ReadonlyMap<string, ReadonlySet<string>>, table: TableName): boolean {
  const actual = columns.get(table);
  return Boolean(actual && REQUIRED_TABLE_COLUMNS[table].every((column) => actual.has(column)));
}

async function readSource(
  sql: TransactionSql,
): Promise<Readonly<{
  source: OperationalProjectionSourceV2;
  columns: ReadonlyMap<string, ReadonlySet<string>>;
  operationalFailureAuthority: boolean;
}>> {
  const tableNames = [...Object.keys(REQUIRED_TABLE_COLUMNS), "steps", "stories", "setfarm_schema_migrations"];
  const columnRows = await sql.unsafe<Array<{ table_name: string; column_name: string }>>(
    `SELECT table_name, column_name
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = ANY($1::text[])
      ORDER BY table_name, ordinal_position`,
    [tableNames],
  );
  const mutableColumns = new Map<string, Set<string>>();
  for (const row of columnRows) {
    const table = mutableColumns.get(row.table_name) ?? new Set<string>();
    table.add(row.column_name);
    mutableColumns.set(row.table_name, table);
  }
  const columns: ReadonlyMap<string, ReadonlySet<string>> = mutableColumns;
  const attempts = hasColumns(columns, "execution_attempts");
  const claimBinding = attempts
    && hasColumns(columns, "claim_log")
    && Boolean(columns.get("execution_attempts")?.has("claim_id"));
  const runtimeOwnership = claimBinding
    && hasColumns(columns, "runtime_sessions")
    && hasColumns(columns, "run_termination_requests");
  const managerCompletion = runtimeOwnership
    && hasColumns(columns, "runtime_completion_requests");
  const implementationSubmissionEvidenceShape = managerCompletion
    && Boolean(columns.get("runtime_completion_requests")?.has("submission_evidence"))
    && Boolean(columns.get("runtime_completion_requests")?.has("source_proposal"));
  const effectLedger = managerCompletion
    && Boolean(columns.get("runtime_completion_requests")?.has("completion_plan_hash"))
    && hasColumns(columns, "runtime_completion_effects")
    && hasColumns(columns, "operational_outbox");
  const findingRecovery = hasColumns(columns, "finding_sets")
    && hasColumns(columns, "recovery_cases")
    && hasColumns(columns, "recovery_case_revisions")
    && hasColumns(columns, "recovery_revision_dispatches")
    && hasColumns(columns, "recovery_dispatch_deliveries");
  const evidenceLedger = hasColumns(columns, "evidence_bundles");
  const acceptedCandidate = attempts
    && evidenceLedger
    && Boolean(columns.get("runs")?.has("accepted_candidate_hash"))
    && hasColumns(columns, "accepted_candidates")
    && hasColumns(columns, "accepted_candidate_story_evidence");
  const deploymentReceipt = acceptedCandidate
    && effectLedger
    && Boolean(columns.get("runs")?.has("deploy_receipt_hash"))
    && hasColumns(columns, "v3_deploy_receipts");
  const projectTransferAck = deploymentReceipt
    && Boolean(columns.get("runs")?.has("project_transfer_ack_hash"))
    && hasColumns(columns, "v3_project_transfer_acks");
  const operationalFailureAuthorityShape = runtimeOwnership
    && hasColumns(columns, "semantic_artifacts")
    && hasColumns(columns, "run_artifact_refs");
  const journalColumns = columns.get("setfarm_schema_migrations") ?? new Set<string>();
  let migrationVersions: number[] = [];
  let verifiedReleaseSha: string | null = null;
  if (journalColumns.has("version")) {
    const hasAttestation = journalColumns.has("verified_release_sha") && journalColumns.has("verified_at");
    const journal = await sql.unsafe<Array<{
      version: number;
      verified_release_sha: string | null;
      verified_at: unknown;
    }>>(
      hasAttestation
        ? `SELECT version, verified_release_sha, verified_at
             FROM setfarm_schema_migrations
            ORDER BY version`
        : `SELECT version, NULL::text AS verified_release_sha, NULL::timestamptz AS verified_at
             FROM setfarm_schema_migrations
            ORDER BY version`,
    );
    migrationVersions = journal.map((row) => Number(row.version));
    const releases = new Set(journal.map((row) => row.verified_release_sha).filter(
      (value): value is string => Boolean(value),
    ));
    if (
      hasAttestation
      && journal.length > 0
      && journal.every((row) => row.verified_release_sha !== null && row.verified_at !== null)
      && releases.size === 1
    ) {
      verifiedReleaseSha = [...releases][0] ?? null;
    }
  }

  const implementationSubmissionEvidence = implementationSubmissionEvidenceShape
    && migrationVersions.includes(19)
    && verifiedReleaseSha !== null;
  const operationalFailureAuthority = operationalFailureAuthorityShape
    && migrationVersions.includes(22)
    && verifiedReleaseSha !== null;
  const capabilities: OperationalProjectionCapabilitiesV2 = {
    attempts,
    claimBinding,
    runtimeOwnership,
    managerCompletion,
    implementationSubmissionEvidence,
    effectLedger,
    findingRecovery,
    evidenceLedger,
    acceptedCandidate,
    deploymentReceipt,
    projectTransferAck,
  };
  const lifecycleProjectionComplete = [
    attempts,
    claimBinding,
    runtimeOwnership,
    managerCompletion,
    effectLedger,
    findingRecovery,
    evidenceLedger,
    acceptedCandidate,
    deploymentReceipt,
    projectTransferAck,
  ].every(Boolean);
  const coreAvailable = hasColumns(columns, "runs");
  return {
    columns,
    operationalFailureAuthority,
    source: {
      database: "postgres",
      projection: !coreAvailable
        ? "unavailable"
        : lifecycleProjectionComplete
          ? "complete"
          : "partial",
      migrationVersions,
      verifiedReleaseSha,
      capabilities,
    },
  };
}

function projectRun(runId: string, row: RawRun): OperationalRunV1 {
  const status = identity(row.status);
  return {
    ref: runOperationalRef(runId),
    id: identity(row.id),
    runNumber: row.run_number === null || row.run_number === undefined ? null : integer(row.run_number),
    protocol: optionalIdentity(row.protocol) as OperationalRunV1["protocol"],
    status,
    terminal: TERMINAL_RUN_STATUSES.has(status.toLowerCase()),
    updatedAt: optionalTimestamp(row.updated_at),
  };
}

function projectClaim(runId: string, row: RawClaim): OperationalClaimV1 {
  const id = identity(row.id);
  const workflowStepId = identity(row.step_id);
  const storyId = optionalIdentity(row.story_id);
  const outcome = optionalIdentity(row.outcome);
  return {
    ref: claimRef(id),
    id,
    runRef: runOperationalRef(runId),
    stepRef: stepRef(runId, workflowStepId),
    storyRef: storyRef(runId, storyId),
    workflowStepId,
    storyId,
    agentId: identity(row.agent_id),
    state: outcome === null ? "open" : "closed",
    outcome,
    claimedAt: timestamp(row.claimed_at),
    abandonedAt: optionalTimestamp(row.abandoned_at),
  };
}

function projectAttempt(runId: string, row: RawAttempt): OperationalAttemptV1 {
  const attemptId = identity(row.attempt_id);
  const workflowStepId = identity(row.step_id);
  const storyId = optionalIdentity(row.story_id);
  const sourceAfterSha = optionalIdentity(row.source_after_sha);
  const sourceAfterTreeHash = optionalIdentity(row.source_after_tree_hash);
  return {
    ref: attemptRef(attemptId),
    attemptId,
    runRef: runOperationalRef(runId),
    claimRef: row.claim_id === null || row.claim_id === undefined ? null : claimRef(identity(row.claim_id)),
    stepRef: stepRef(runId, workflowStepId),
    storyRef: storyRef(runId, storyId),
    workflowStepId,
    storyId,
    generation: integer(row.generation),
    attemptClass: identity(row.attempt_class) as OperationalAttemptV1["attemptClass"],
    packetHash: optionalIdentity(row.packet_hash),
    compilationReportHash: identity(row.compilation_report_hash),
    sliceHash: optionalIdentity(row.slice_hash),
    sourceBefore: {
      sha: identity(row.source_before_sha),
      treeHash: identity(row.source_before_tree_hash),
    },
    sourceAfter: sourceAfterSha && sourceAfterTreeHash
      ? { sha: sourceAfterSha, treeHash: sourceAfterTreeHash }
      : null,
    findingSetHash: optionalIdentity(row.finding_set_hash),
    role: identity(row.role),
    agentId: optionalIdentity(row.agent_id),
    disposition: identity(row.disposition) as OperationalAttemptV1["disposition"],
    outputHash: optionalIdentity(row.output_hash),
    createdAt: timestamp(row.created_at),
    updatedAt: timestamp(row.updated_at),
  };
}

function projectRuntime(runId: string, row: RawRuntime): OperationalRuntimeSessionV1 {
  const sessionId = identity(row.session_id);
  const attemptId = optionalIdentity(row.attempt_id);
  const workflowStepId = identity(row.workflow_step_id);
  const storyId = optionalIdentity(row.story_id);
  return {
    ref: runtimeRef(sessionId),
    sessionId,
    runRef: runOperationalRef(runId),
    claimRef: claimRef(identity(row.claim_id)),
    attemptRef: attemptId ? attemptRef(attemptId) : null,
    stepRef: stepRef(runId, workflowStepId),
    storyRef: storyRef(runId, storyId),
    workflowStepId,
    storyId,
    runtimeKind: identity(row.runtime_kind) as OperationalRuntimeSessionV1["runtimeKind"],
    state: identity(row.state) as OperationalRuntimeSessionV1["state"],
    stateVersion: integer(row.state_version),
    startedAt: optionalTimestamp(row.started_at),
    heartbeatAt: timestamp(row.heartbeat_at),
    drainRequestedAt: optionalTimestamp(row.drain_requested_at),
    drainedAt: optionalTimestamp(row.drained_at),
    releasedAt: optionalTimestamp(row.released_at),
    createdAt: timestamp(row.created_at),
    updatedAt: timestamp(row.updated_at),
  };
}

function projectEffect(row: RawEffect): OperationalCompletionEffectV1 {
  const requestId = identity(row.request_id);
  const effectKey = identity(row.effect_key);
  return {
    ref: effectRef(requestId, effectKey),
    effectKey,
    ordinal: integer(row.ordinal),
    effectType: identity(row.effect_type),
    inputHash: identity(row.input_hash),
    mandatory: Boolean(row.mandatory),
    state: identity(row.state) as OperationalCompletionEffectV1["state"],
    attemptCount: integer(row.attempt_count),
    appliedAt: optionalTimestamp(row.applied_at),
    reconciledAt: optionalTimestamp(row.reconciled_at),
    createdAt: timestamp(row.created_at),
    updatedAt: timestamp(row.updated_at),
  };
}

function projectCompletion(
  runId: string,
  row: RawCompletion,
  effects: OperationalCompletionEffectV1[],
): OperationalCompletionRequestV2 {
  const requestId = identity(row.request_id);
  const attemptId = optionalIdentity(row.attempt_id);
  const workflowStepId = identity(row.workflow_step_id);
  const storyId = optionalIdentity(row.story_id);
  const submissionReceipt = row.submission_evidence === null || row.submission_evidence === undefined
    ? null
    : RuntimeCompletionSubmissionEvidenceV1Schema.parse(
        typeof row.submission_evidence === "string"
          ? JSON.parse(row.submission_evidence) as unknown
          : row.submission_evidence,
      );
  const persistedSourceProposalHash = optionalIdentity(row.source_proposal_hash);
  const persistedOutputHash = optionalIdentity(row.persisted_output_hash);
  if (submissionReceipt) {
    if (
      persistedSourceProposalHash !== submissionReceipt.sourceProposalHash
      || persistedOutputHash !== submissionReceipt.canonicalOutputHash
      || identity(row.output_hash) !== submissionReceipt.canonicalOutputHash
    ) {
      throw new Error(`OPERATIONAL_SNAPSHOT_SUBMISSION_EVIDENCE_DB_BINDING_INVALID:${requestId}`);
    }
  } else if (persistedSourceProposalHash !== null || persistedOutputHash !== null) {
    throw new Error(`OPERATIONAL_SNAPSHOT_SUBMISSION_EVIDENCE_DB_BINDING_INVALID:${requestId}`);
  }
  return {
    ref: completionRef(requestId),
    requestId,
    runRef: runOperationalRef(runId),
    runtimeSessionRef: runtimeRef(identity(row.runtime_session_id)),
    claimRef: claimRef(identity(row.claim_id)),
    attemptRef: attemptId ? attemptRef(attemptId) : null,
    stepRef: stepRef(runId, workflowStepId),
    storyRef: storyRef(runId, storyId),
    workflowStepId,
    storyId,
    outputHash: identity(row.output_hash),
    implementationSubmissionEvidence: submissionReceipt
      ? {
          receipt: submissionReceipt,
          sourceProposalRef: `setfarm://runtime-completion/${segment(requestId)}/source-proposal/${submissionReceipt.sourceProposalHash}`,
        }
      : null,
    applyPhase: identity(row.apply_phase) as OperationalCompletionRequestV2["applyPhase"],
    claimOutcome: optionalIdentity(row.claim_outcome),
    completionPlanHash: optionalIdentity(row.completion_plan_hash),
    state: identity(row.state) as OperationalCompletionRequestV2["state"],
    requestedAt: timestamp(row.requested_at),
    drainedAt: optionalTimestamp(row.drained_at),
    processingAt: optionalTimestamp(row.processing_at),
    acceptedAt: optionalTimestamp(row.accepted_at),
    rejectedAt: optionalTimestamp(row.rejected_at),
    createdAt: timestamp(row.created_at),
    updatedAt: timestamp(row.updated_at),
    effects,
  };
}

function projectTermination(runId: string, row: RawTermination): OperationalTerminationRequestV1 {
  const requestId = identity(row.request_id);
  return {
    ref: terminationRef(requestId),
    requestId,
    runRef: runOperationalRef(runId),
    targetStatus: identity(row.target_status) as OperationalTerminationRequestV1["targetStatus"],
    state: identity(row.state) as OperationalTerminationRequestV1["state"],
    requestedBy: identity(row.requested_by),
    diagnostic: identity(row.diagnostic),
    evidence: jsonObject(row.evidence),
    requestedAt: timestamp(row.requested_at),
    drainedAt: optionalTimestamp(row.drained_at),
    terminalizedAt: optionalTimestamp(row.terminalized_at),
    createdAt: timestamp(row.created_at),
    updatedAt: timestamp(row.updated_at),
  };
}

function projectOutbox(row: RawOutbox): OperationalOutboxItemV1 {
  const outboxId = identity(row.outbox_id);
  const requestId = optionalIdentity(row.request_id);
  return {
    ref: outboxRef(outboxId),
    outboxId,
    requestRef: requestId ? completionRef(requestId) : null,
    eventKey: identity(row.event_key),
    eventType: identity(row.event_type),
    aggregateType: identity(row.aggregate_type),
    aggregateId: identity(row.aggregate_id),
    state: identity(row.state) as OperationalOutboxItemV1["state"],
    attemptCount: integer(row.attempt_count),
    publishedAt: optionalTimestamp(row.published_at),
    createdAt: timestamp(row.created_at),
    updatedAt: timestamp(row.updated_at),
  };
}

function projectFindingSet(runId: string, row: RawFindingSet): OperationalFindingSetV1 {
  const findingSetHash = identity(row.finding_set_hash);
  const storyId = identity(row.story_id);
  return {
    ref: findingSetRef(findingSetHash),
    findingSetId: identity(row.finding_set_id),
    findingSetHash,
    runRef: runOperationalRef(runId),
    storyRef: storyRef(runId, storyId)!,
    storyId,
    packetHash: identity(row.packet_hash),
    sliceHash: identity(row.slice_hash),
    sourceRevision: {
      sha: identity(row.source_sha),
      treeHash: identity(row.source_tree_hash),
    },
    findingIds: stringArray(row.finding_ids),
    createdAt: timestamp(row.created_at),
  };
}

function projectEvidenceBundle(runId: string, row: RawEvidenceBundle): OperationalEvidenceBundleV1 {
  const evidenceBundleHash = identity(row.evidence_bundle_hash);
  const storyId = identity(row.story_id);
  const attemptId = optionalIdentity(row.attempt_id);
  return {
    ref: evidenceBundleRef(evidenceBundleHash),
    evidenceId: identity(row.evidence_id),
    evidenceBundleHash,
    runRef: runOperationalRef(runId),
    storyRef: storyRef(runId, storyId)!,
    storyId,
    attemptRef: attemptId ? attemptRef(attemptId) : null,
    attemptId,
    packetHash: identity(row.packet_hash),
    sliceHash: identity(row.slice_hash),
    sourceRevision: {
      sha: identity(row.source_sha),
      treeHash: identity(row.source_tree_hash),
    },
    aggregateVerdict: identity(row.aggregate_verdict) as OperationalEvidenceBundleV1["aggregateVerdict"],
    predicateCount: integer(row.predicate_count),
    observationCount: integer(row.observation_count),
    createdAt: timestamp(row.created_at),
  };
}

function projectRecoveryCase(runId: string, row: RawRecoveryCase): OperationalRecoveryCaseV1 {
  const recoveryCaseId = identity(row.recovery_case_id);
  const revisionId = identity(row.revision_id);
  const caseStoryId = identity(row.case_story_id);
  const revisionRunId = identity(row.revision_run_id);
  const storyId = identity(row.story_id);
  const findingSetHash = identity(row.finding_set_hash);
  const caseOwner = identity(row.case_owner);
  const revisionOwner = identity(row.revision_owner);
  const caseExpectedDeltaKind = identity(row.case_expected_delta_kind);
  const revisionExpectedDeltaKind = identity(row.revision_expected_delta_kind);
  if (
    revisionRunId !== runId
    || caseStoryId !== storyId
    || caseOwner !== revisionOwner
    || caseExpectedDeltaKind !== revisionExpectedDeltaKind
  ) {
    throw new Error(`RECOVERY_CURRENT_REVISION_PROJECTION_MISMATCH:${recoveryCaseId}`);
  }
  return {
    ref: recoveryCaseRef(recoveryCaseId),
    recoveryCaseId,
    revisionRef: recoveryRevisionRef(revisionId),
    revisionId,
    revisionNumber: integer(row.revision_number),
    runRef: runOperationalRef(runId),
    storyRef: storyRef(runId, storyId)!,
    storyId,
    findingSetRef: findingSetRef(findingSetHash),
    findingSetHash,
    packetHash: identity(row.packet_hash),
    sliceHash: identity(row.contract_slice_hash),
    sourceRevision: {
      sha: identity(row.source_sha),
      treeHash: identity(row.source_tree_hash),
    },
    owner: revisionOwner as OperationalRecoveryCaseV1["owner"],
    expectedDeltaKind: revisionExpectedDeltaKind as OperationalRecoveryCaseV1["expectedDeltaKind"],
    status: identity(row.status) as OperationalRecoveryCaseV1["status"],
    budget: {
      limits: {
        implement: integer(row.max_implement),
        supervisorRepair: integer(row.max_supervisor_repair),
        evidenceOnly: integer(row.max_evidence_only),
      },
      used: {
        implement: integer(row.used_implement),
        supervisorRepair: integer(row.used_supervisor_repair),
        evidenceOnly: integer(row.used_evidence_only),
      },
    },
    stateVersion: integer(row.state_version),
    terminalReasonCode: optionalIdentity(row.terminal_reason_code) as OperationalRecoveryCaseV1["terminalReasonCode"],
    createdAt: timestamp(row.created_at),
    updatedAt: timestamp(row.updated_at),
  };
}

function projectRecoveryDispatch(runId: string, row: RawRecoveryDispatch): OperationalRecoveryDispatchV1 {
  const dispatchId = identity(row.dispatch_id);
  const recoveryCaseId = identity(row.recovery_case_id);
  const revisionId = identity(row.revision_id);
  const revisionRunId = identity(row.revision_run_id);
  const revisionStoryId = identity(row.revision_story_id);
  const deliveryRunId = identity(row.delivery_run_id);
  const deliveryStoryId = identity(row.delivery_story_id);
  if (revisionRunId !== runId || deliveryRunId !== runId || revisionStoryId !== deliveryStoryId) {
    throw new Error(`RECOVERY_DELIVERY_REVISION_PROJECTION_MISMATCH:${dispatchId}`);
  }
  const dispatchAuthorizedAt = timestamp(row.dispatch_authorized_at);
  const deliveryAuthorizedAt = timestamp(row.delivery_authorized_at);
  if (dispatchAuthorizedAt !== deliveryAuthorizedAt) {
    throw new Error(`RECOVERY_DELIVERY_AUTHORIZATION_TIME_MISMATCH:${dispatchId}`);
  }
  const findingSetHash = identity(row.finding_set_hash);
  const attemptId = optionalIdentity(row.attempt_id);
  const claimId = row.claim_id === null || row.claim_id === undefined ? null : identity(row.claim_id);
  return {
    ref: recoveryDispatchRef(dispatchId),
    dispatchId,
    recoveryCaseRef: recoveryCaseRef(recoveryCaseId),
    recoveryCaseId,
    revisionRef: recoveryRevisionRef(revisionId),
    revisionId,
    revisionNumber: integer(row.revision_number),
    runRef: runOperationalRef(runId),
    storyRef: storyRef(runId, revisionStoryId)!,
    storyId: revisionStoryId,
    findingSetRef: findingSetRef(findingSetHash),
    findingSetHash,
    dispatchClass: identity(row.dispatch_class) as OperationalRecoveryDispatchV1["dispatchClass"],
    packetHash: identity(row.packet_hash),
    sliceHash: identity(row.contract_slice_hash),
    sourceRevision: {
      sha: identity(row.source_sha),
      treeHash: identity(row.source_tree_hash),
    },
    findingIds: stringArray(row.finding_ids),
    deliveryState: identity(row.delivery_state) as OperationalRecoveryDispatchV1["deliveryState"],
    attemptRef: attemptId ? attemptRef(attemptId) : null,
    attemptId,
    claimRef: claimId ? claimRef(claimId) : null,
    executionSliceHash: optionalIdentity(row.execution_slice_hash),
    attemptCount: integer(row.attempt_count),
    leaseOwnerInstanceId: optionalIdentity(row.owner_instance_id),
    leaseExpiresAt: optionalTimestamp(row.lease_expires_at),
    terminalReasonCode: optionalIdentity(row.terminal_reason_code),
    authorizedAt: deliveryAuthorizedAt,
    terminalAt: optionalTimestamp(row.terminal_at),
  };
}

function projectAcceptedCandidate(
  runId: string,
  row: RawAcceptedCandidate,
  storyRows: RawAcceptedCandidateStoryEvidence[],
): OperationalAcceptedCandidateV1 {
  const candidate = AcceptedCandidateV1Schema.parse(row.payload);
  const candidateHash = identity(row.candidate_hash);
  if (
    candidate.candidateHash !== candidateHash
    || candidate.candidateId !== identity(row.candidate_id)
    || candidate.runId !== runId
    || candidate.runId !== identity(row.run_id)
    || candidate.packetHash !== identity(row.packet_hash)
    || candidate.storyPlanHash !== identity(row.story_plan_hash)
    || candidate.sourceRevision.sha !== identity(row.source_sha)
    || candidate.sourceRevision.treeHash !== identity(row.source_tree_hash)
    || candidate.integrationEvidenceHash !== identity(row.integration_evidence_hash)
  ) {
    throw new Error(`ACCEPTED_CANDIDATE_ROW_IDENTITY_MISMATCH:${candidateHash}`);
  }
  const projectedStories: AcceptedCandidateV1["storyEvidence"] = storyRows
    .map((story) => {
      if (identity(story.candidate_hash) !== candidateHash) {
        throw new Error(`ACCEPTED_CANDIDATE_STORY_OWNER_MISMATCH:${candidateHash}`);
      }
      return {
        storyId: identity(story.story_id),
        attemptId: identity(story.attempt_id),
        sliceHash: identity(story.slice_hash),
        evidencePlanHash: identity(story.evidence_plan_hash),
        evidencePlanArtifactHash: identity(story.evidence_plan_artifact_hash),
        evidenceBundleHash: identity(story.evidence_bundle_hash),
        evidenceId: identity(story.evidence_id),
        predicateRefs: stringArray(story.predicate_refs),
      };
    })
    .sort((left, right) => left.storyId.localeCompare(right.storyId));
  if (hashCanonicalJson(projectedStories) !== hashCanonicalJson(candidate.storyEvidence)) {
    throw new Error(`ACCEPTED_CANDIDATE_STORY_LEDGER_MISMATCH:${candidateHash}`);
  }
  return {
    ref: acceptedCandidateRef(candidateHash),
    candidate,
    createdAt: timestamp(row.created_at),
  };
}

function projectV3DeployReceipt(runId: string, row: RawV3DeployReceipt): OperationalV3DeployReceiptV1 {
  const receipt = V3DeployReceiptV1Schema.parse(row.payload);
  const receiptHash = identity(row.receipt_hash);
  const timestampMatches = (left: string, right: unknown) => Date.parse(left) === Date.parse(timestamp(right));
  if (
    receipt.receiptHash !== receiptHash
    || receipt.runId !== runId
    || receipt.runId !== identity(row.run_id)
    || receipt.candidateId !== identity(row.candidate_id)
    || receipt.candidateHash !== identity(row.candidate_hash)
    || receipt.packetHash !== identity(row.packet_hash)
    || receipt.project.productId !== identity(row.product_id)
    || receipt.project.projectId !== identity(row.project_id)
    || receipt.project.displayName !== identity(row.display_name)
    || receipt.project.summary !== identity(row.summary)
    || receipt.stack.stackPackId !== identity(row.stack_pack_id)
    || receipt.stack.stackPackVersion !== identity(row.stack_pack_version)
    || receipt.stack.stackPackContentHash !== identity(row.stack_pack_content_hash)
    || receipt.stack.platform !== optionalIdentity(row.platform)
    || receipt.stack.techStack !== optionalIdentity(row.tech_stack)
    || receipt.sourceBefore.sha !== identity(row.source_sha)
    || receipt.sourceBefore.treeHash !== identity(row.source_tree_hash)
    || receipt.sourceAfter.sha !== identity(row.source_sha)
    || receipt.sourceAfter.treeHash !== identity(row.source_tree_hash)
    || receipt.runtime.serviceId !== identity(row.service_id)
    || receipt.runtime.mode !== identity(row.deployment_mode)
    || receipt.runtime.host !== identity(row.host)
    || receipt.runtime.port !== integer(row.port)
    || receipt.runtime.healthUrl !== identity(row.health_url)
    || receipt.runtime.deployUrl !== identity(row.deploy_url)
    || receipt.health.httpStatus !== integer(row.health_http_status)
    || !timestampMatches(receipt.health.checkedAt, row.health_checked_at)
    || receipt.terminalProjectProjection.evidenceRef !== identity(row.terminal_projection_ref)
    || !timestampMatches(receipt.completedAt, row.completed_at)
  ) {
    throw new Error(`V3_DEPLOY_RECEIPT_ROW_IDENTITY_MISMATCH:${receiptHash}`);
  }
  return {
    ref: v3DeployReceiptRef(receiptHash),
    receipt,
    createdAt: timestamp(row.created_at),
  };
}

function projectV3ProjectTransferAck(
  runId: string,
  row: RawV3ProjectTransferAck,
): OperationalV3ProjectTransferAckV1 {
  const acknowledgement = V3ProjectTransferAckV1Schema.parse(row.payload);
  const ackHash = identity(row.ack_hash);
  const timestampMatches = (left: string, right: unknown) => Date.parse(left) === Date.parse(timestamp(right));
  if (
    acknowledgement.ackHash !== ackHash
    || acknowledgement.runId !== runId
    || acknowledgement.runId !== identity(row.run_id)
    || acknowledgement.candidateId !== identity(row.candidate_id)
    || acknowledgement.candidateHash !== identity(row.candidate_hash)
    || acknowledgement.packetHash !== identity(row.packet_hash)
    || acknowledgement.sourceRevision.sha !== identity(row.source_sha)
    || acknowledgement.sourceRevision.treeHash !== identity(row.source_tree_hash)
    || acknowledgement.deploymentReceiptHash !== identity(row.deploy_receipt_hash)
    || acknowledgement.sourceSnapshotHash !== identity(row.source_snapshot_hash)
    || acknowledgement.projectId !== identity(row.project_id)
    || acknowledgement.projectionHash !== identity(row.projection_hash)
    || acknowledgement.projectRecordHash !== identity(row.project_record_hash)
    || acknowledgement.projectRecordRef !== identity(row.project_record_ref)
    || !timestampMatches(acknowledgement.persistedAt, row.persisted_at)
  ) {
    throw new Error(`V3_PROJECT_TRANSFER_ACK_ROW_IDENTITY_MISMATCH:${ackHash}`);
  }
  return {
    ref: v3ProjectTransferAckRef(ackHash),
    acknowledgement,
    createdAt: timestamp(row.created_at),
  };
}

type ReducerInput = Readonly<{
  source: OperationalProjectionSourceV2;
  run: OperationalRunV1;
  claims: OperationalClaimV1[];
  attempts: OperationalAttemptV1[];
  runtimeSessions: OperationalRuntimeSessionV1[];
  completionRequests: OperationalCompletionRequestV2[];
  terminationRequests: OperationalTerminationRequestV1[];
  outbox: OperationalOutboxItemV1[];
  invariants: OperationalInvariantV1[];
  legacyResumePlan: LegacyResumePlanResult;
}>;

export function reduceRunOperationalLifecycle(input: ReducerInput): OperationalSummaryV1 {
  const activeClaims = input.claims.filter((claim) => claim.state === "open").length;
  const activeAttempts = input.attempts.filter((attempt) => ACTIVE_ATTEMPT_STATES.has(attempt.disposition)).length;
  const activeRuntimes = input.runtimeSessions.filter((runtime) => ACTIVE_RUNTIME_STATES.has(runtime.state)).length;
  const openCompletions = input.completionRequests.filter((request) => OPEN_COMPLETION_STATES.has(request.state)).length;
  const mandatoryEffectsPending = input.completionRequests.reduce(
    (count, request) => count + request.effects.filter(
      (effect) => effect.mandatory && !SETTLED_EFFECT_STATES.has(effect.state),
    ).length,
    0,
  );
  const unpublishedOutbox = input.outbox.filter((item) => item.state !== "published").length;
  const unsettledEffects = input.completionRequests.reduce(
    (count, request) => count + request.effects.filter((effect) => !SETTLED_EFFECT_STATES.has(effect.state)).length,
    0,
  );
  const hasErrors = input.invariants.some((invariant) => invariant.severity === "error");
  const stopBlockedByInvariant = hasStopBlockingInvariant(input.invariants);
  const openTermination = input.terminationRequests.some((request) => request.state !== "terminalized");
  const trackedCount = input.claims.length
    + input.attempts.length
    + input.runtimeSessions.length
    + input.completionRequests.length
    + input.terminationRequests.length;

  let lifecycleState: OperationalSummaryV1["lifecycleState"];
  if (hasErrors) lifecycleState = "inconsistent";
  else if (input.run.terminal) lifecycleState = "terminal";
  else if (mandatoryEffectsPending > 0 || unpublishedOutbox > 0) lifecycleState = "effects_applying";
  else if (openCompletions > 0) lifecycleState = "completion_requested";
  else if (activeRuntimes > 0 || openTermination) lifecycleState = "runtime_active";
  else if (activeClaims > 0 || activeAttempts > 0) lifecycleState = "claimed";
  else if (trackedCount > 0) lifecycleState = "settled";
  else if (input.run.protocol === "legacy") lifecycleState = "legacy_untracked";
  else lifecycleState = "idle";

  const health: OperationalSummaryV1["health"] = input.source.projection === "unavailable"
    ? "unavailable"
    : hasErrors
      ? "blocked"
      : input.source.projection === "partial" || input.invariants.length > 0
        ? "attention"
        : "ok";

  let stop: OperationalSummaryV1["operatorActions"]["stop"];
  let resume: OperationalSummaryV1["operatorActions"]["resume"];
  const normalizedStatus = input.run.status.toLowerCase() === "canceled"
    ? "cancelled"
    : input.run.status.toLowerCase();
  const stoppableStatus = ["running", "resuming"].includes(normalizedStatus);
  const resumableLegacyStatus = ["failed", "cancelled"].includes(normalizedStatus);
  const unsettledResumeState = activeClaims
    + activeAttempts
    + activeRuntimes
    + openCompletions
    + unsettledEffects
    + unpublishedOutbox > 0;
  const actionStateHash = input.legacyResumePlan.stateHash;

  if (input.source.projection === "unavailable") {
    stop = { allowed: false, reasonCode: "OPERATIONAL_SOURCE_UNAVAILABLE", stateHash: actionStateHash };
  } else if (input.source.projection === "partial") {
    stop = { allowed: false, reasonCode: "PARTIAL_PROJECTION_PREVENTS_ACTION", stateHash: actionStateHash };
  } else if (input.run.terminal) {
    stop = { allowed: false, reasonCode: "RUN_ALREADY_TERMINAL", stateHash: actionStateHash };
  } else if (!stoppableStatus) {
    stop = { allowed: false, reasonCode: "RUN_STATUS_NOT_STOPPABLE", stateHash: actionStateHash };
  } else if (stopBlockedByInvariant) {
    stop = { allowed: false, reasonCode: "INVARIANT_VIOLATION_BLOCKS_ACTION", stateHash: actionStateHash };
  } else if (openTermination) {
    stop = { allowed: false, reasonCode: "TERMINATION_ALREADY_REQUESTED", stateHash: actionStateHash };
  } else if (hasErrors) {
    stop = { allowed: true, reasonCode: "RUN_CAN_BE_STOPPED_WITH_QUARANTINE_RECOVERY", stateHash: actionStateHash };
  } else {
    stop = { allowed: true, reasonCode: "RUN_CAN_BE_STOPPED", stateHash: actionStateHash };
  }

  if (input.source.projection === "unavailable") {
    resume = { allowed: false, reasonCode: "OPERATIONAL_SOURCE_UNAVAILABLE", stateHash: actionStateHash };
  } else if (input.source.projection === "partial") {
    resume = { allowed: false, reasonCode: "PARTIAL_PROJECTION_PREVENTS_ACTION", stateHash: actionStateHash };
  } else if (input.run.protocol !== "legacy") {
    resume = { allowed: false, reasonCode: "COMPILER_PROTOCOL_RESUME_FORBIDDEN", stateHash: actionStateHash };
  } else if (!resumableLegacyStatus) {
    resume = { allowed: false, reasonCode: "RUN_STATUS_NOT_RESUMABLE", stateHash: actionStateHash };
  } else if (hasErrors) {
    resume = { allowed: false, reasonCode: "INVARIANT_VIOLATION_BLOCKS_ACTION", stateHash: actionStateHash };
  } else if (openTermination) {
    resume = { allowed: false, reasonCode: "TERMINATION_IN_PROGRESS", stateHash: actionStateHash };
  } else if (unsettledResumeState) {
    resume = { allowed: false, reasonCode: "ACTIVE_OWNERSHIP_PREVENTS_RESUME", stateHash: actionStateHash };
  } else if (input.legacyResumePlan.status === "denied") {
    resume = {
      allowed: false,
      reasonCode: input.legacyResumePlan.reasonCode,
      stateHash: actionStateHash,
    };
  } else {
    resume = { allowed: true, reasonCode: "RUN_CAN_BE_RESUMED", stateHash: actionStateHash };
  }

  return {
    lifecycleState,
    health,
    activeClaims,
    activeAttempts,
    activeRuntimes,
    openCompletions,
    mandatoryEffectsPending,
    unpublishedOutbox,
    invariantViolations: input.invariants.length,
    operatorActions: { stop, resume },
  };
}

type InvariantInput = Omit<ReducerInput, "invariants" | "legacyResumePlan"> & Readonly<{
  observedAt: string;
  acceptedCandidate?: OperationalAcceptedCandidateV1 | null;
  acceptedCandidateBindingMismatchRefs?: string[];
  deploymentReceipt?: OperationalV3DeployReceiptV1 | null;
  deploymentReceiptBindingMismatchRefs?: string[];
  projectTransferAck?: OperationalV3ProjectTransferAckV1 | null;
  projectTransferAckBindingMismatchRefs?: string[];
}>;

function deriveInvariants(input: InvariantInput): OperationalInvariantV1[] {
  const invariants: OperationalInvariantV1[] = [];
  const seen = new Set<string>();
  const add = (
    code: string,
    severity: OperationalInvariantV1["severity"],
    refs: string[],
  ): void => {
    const uniqueRefs = [...new Set(refs)].sort();
    const key = `${code}:${uniqueRefs.join("|")}`;
    if (seen.has(key)) return;
    seen.add(key);
    invariants.push({ code, severity, refs: uniqueRefs, observedAt: input.observedAt });
  };

  if (input.source.projection === "partial") {
    add("OPERATIONAL_PROJECTION_PARTIAL", "warning", [input.run.ref]);
  } else if (input.source.projection === "unavailable") {
    add("OPERATIONAL_PROJECTION_UNAVAILABLE", "error", [input.run.ref]);
  }

  if (input.acceptedCandidateBindingMismatchRefs?.length) {
    add("ACCEPTED_CANDIDATE_POINTER_MISMATCH", "error", input.acceptedCandidateBindingMismatchRefs);
  }
  if (input.acceptedCandidate && input.run.protocol !== "v3") {
    add("ACCEPTED_CANDIDATE_REQUIRES_V3_RUN", "error", [input.run.ref, input.acceptedCandidate.ref]);
  }
  const successfulV3 = input.run.protocol === "v3"
    && input.run.terminal
    && ["completed", "done"].includes(input.run.status.toLowerCase());
  if (input.source.capabilities.acceptedCandidate && successfulV3 && !input.acceptedCandidate) {
    add("SUCCESSFUL_V3_RUN_MISSING_ACCEPTED_CANDIDATE", "error", [input.run.ref]);
  }
  if (input.deploymentReceiptBindingMismatchRefs?.length) {
    add("DEPLOYMENT_RECEIPT_POINTER_MISMATCH", "error", input.deploymentReceiptBindingMismatchRefs);
  }
  if (input.deploymentReceipt && (input.run.protocol !== "v3" || !input.acceptedCandidate)) {
    add("DEPLOYMENT_RECEIPT_AUTHORITY_MISMATCH", "error", [
      input.run.ref,
      input.deploymentReceipt.ref,
      ...(input.acceptedCandidate ? [input.acceptedCandidate.ref] : []),
    ]);
  }
  if (input.projectTransferAckBindingMismatchRefs?.length) {
    add("PROJECT_TRANSFER_ACK_POINTER_MISMATCH", "error", input.projectTransferAckBindingMismatchRefs);
  }
  if (input.projectTransferAck && (input.run.protocol !== "v3" || !input.acceptedCandidate || !input.deploymentReceipt)) {
    add("PROJECT_TRANSFER_ACK_AUTHORITY_MISMATCH", "error", [
      input.run.ref,
      input.projectTransferAck.ref,
      ...(input.acceptedCandidate ? [input.acceptedCandidate.ref] : []),
      ...(input.deploymentReceipt ? [input.deploymentReceipt.ref] : []),
    ]);
  }

  const claims = new Map(input.claims.map((claim) => [claim.ref, claim]));
  const activeClaims = input.claims.filter((claim) => claim.state === "open");
  const activeAttempts = input.attempts.filter((attempt) => ACTIVE_ATTEMPT_STATES.has(attempt.disposition));
  const activeRuntimes = input.runtimeSessions.filter((runtime) => ACTIVE_RUNTIME_STATES.has(runtime.state));
  const openCompletions = input.completionRequests.filter((request) => OPEN_COMPLETION_STATES.has(request.state));
  const openTerminations = input.terminationRequests.filter((request) => request.state !== "terminalized");

  if (input.run.terminal) {
    for (const claim of activeClaims) add("TERMINAL_RUN_HAS_ACTIVE_CLAIM", "error", [input.run.ref, claim.ref]);
    for (const attempt of activeAttempts) add("TERMINAL_RUN_HAS_ACTIVE_ATTEMPT", "error", [input.run.ref, attempt.ref]);
    for (const runtime of activeRuntimes) add("TERMINAL_RUN_HAS_ACTIVE_RUNTIME", "error", [input.run.ref, runtime.ref]);
    for (const request of openCompletions) add("TERMINAL_RUN_HAS_OPEN_COMPLETION", "error", [input.run.ref, request.ref]);
    for (const request of openTerminations) add("TERMINAL_RUN_HAS_OPEN_TERMINATION", "error", [input.run.ref, request.ref]);
  }

  for (const attempt of activeAttempts) {
    if (!attempt.claimRef) {
      if (input.source.capabilities.claimBinding) {
        add("ACTIVE_ATTEMPT_MISSING_CLAIM_BINDING", "error", [attempt.ref]);
      }
      continue;
    }
    const claim = claims.get(attempt.claimRef);
    if (!claim) add("ACTIVE_ATTEMPT_REFERENCES_MISSING_CLAIM", "error", [attempt.ref, attempt.claimRef]);
    else if (claim.state === "closed") add("CLOSED_CLAIM_HAS_ACTIVE_ATTEMPT", "error", [claim.ref, attempt.ref]);
  }

  for (const runtime of activeRuntimes) {
    const claim = claims.get(runtime.claimRef);
    if (!claim) add("ACTIVE_RUNTIME_REFERENCES_MISSING_CLAIM", "error", [runtime.ref, runtime.claimRef]);
    else if (claim.state === "closed") add("CLOSED_CLAIM_HAS_ACTIVE_RUNTIME", "error", [claim.ref, runtime.ref]);
  }

  for (const request of input.completionRequests) {
    if (request.state === "accepted" && request.applyPhase !== "effects_committed") {
      add("ACCEPTED_COMPLETION_HAS_UNCOMMITTED_EFFECTS", "error", [request.ref]);
    }
    for (const effect of request.effects) {
      if (effect.mandatory && effect.state === "quarantined") {
        add("MANDATORY_COMPLETION_EFFECT_QUARANTINED", "error", [request.ref, effect.ref]);
      }
    }
  }
  for (const runtime of input.runtimeSessions) {
    if (runtime.state === "quarantined") add("RUNTIME_SESSION_QUARANTINED", "error", [runtime.ref]);
  }
  for (const request of input.completionRequests) {
    if (request.state === "quarantined") add("COMPLETION_REQUEST_QUARANTINED", "error", [request.ref]);
  }
  for (const request of input.terminationRequests) {
    if (request.state === "terminalized") {
      const normalizedRunStatus = input.run.status.toLowerCase() === "canceled"
        ? "cancelled"
        : input.run.status.toLowerCase();
      if (!input.run.terminal || normalizedRunStatus !== request.targetStatus) {
        add("TERMINALIZED_TERMINATION_STATUS_MISMATCH", "error", [input.run.ref, request.ref]);
      }
    }
    if (request.state === "quarantined") add("TERMINATION_REQUEST_QUARANTINED", "error", [request.ref]);
  }
  for (const item of input.outbox) {
    if (item.state === "quarantined") add("OPERATIONAL_OUTBOX_QUARANTINED", "error", [item.ref]);
  }

  return invariants.sort((left, right) => left.code.localeCompare(right.code) || left.refs.join("|").localeCompare(right.refs.join("|")));
}

type HashableSnapshot =
  | Omit<RunOperationalSnapshotV1, "snapshotHash">
  | Omit<RunOperationalSnapshotV2, "snapshotHash">
  | Omit<RunOperationalSnapshotV3, "snapshotHash">;

export type RunOperationalSnapshotBuildOptions = Readonly<{
  artifactRoot?: string;
  artifactLimits?: ArtifactCapacityLimits;
}>;

function verifiedRefusalOptions(
  sql: VerifiedDesignCandidateRefusalReadOptions["sql"],
  options: RunOperationalSnapshotBuildOptions,
  terminationRequest: OperationalTerminationRequestV1,
): VerifiedDesignCandidateRefusalReadOptions {
  return {
    sql,
    artifactRoot: options.artifactRoot ?? resolveProductArtifactDir(),
    artifactLimits: options.artifactLimits ?? resolveProductArtifactCapacity(),
    terminationRequest,
  };
}

export async function projectCanonicalOperationalFailureV3(
  sql: VerifiedDesignCandidateRefusalReadOptions["sql"],
  runId: string,
  terminationRequests: readonly OperationalTerminationRequestV1[],
  options: RunOperationalSnapshotBuildOptions,
): Promise<CanonicalOperationalFailureV3 | null> {
  const parsedRequests = terminationRequests.map((request) =>
    OperationalTerminationRequestV3Schema.parse(request));
  const candidates = parsedRequests.filter((request) =>
    request.targetStatus === "failed"
    && request.state === "terminalized"
    && Object.hasOwn(request.evidence, "operationalFailureCause"));
  if (candidates.length === 0) return null;
  if (candidates.length !== 1) {
    throw new Error(`OPERATIONAL_FAILURE_TERMINATION_CARDINALITY_INVALID:${runId}`);
  }
  const request = candidates[0]!;
  const evidenceSchema = typeof request.evidence.schema === "string"
    ? request.evidence.schema
    : null;
  if (
    request.requestedBy === DESIGN_CANDIDATE_AUTHORITY_REQUESTER_V2
    || evidenceSchema === DESIGN_CANDIDATE_AUTHORITY_EVIDENCE_SCHEMA_V2
  ) {
    const refusal = await readVerifiedDesignCandidateRefusal(
      runId,
      verifiedRefusalOptions(sql, options, request),
    );
    if (!refusal) {
      throw new Error(`OPERATIONAL_FAILURE_DESIGN_REFUSAL_MISSING:${runId}`);
    }
    return {
      terminationRequestRef: refusal.terminationRequestRef,
      failureIdentity: refusal.failureIdentity,
    };
  }

  const cause = OperationalFailureCauseV1Schema.parse(
    request.evidence.operationalFailureCause,
  );
  return {
    terminationRequestRef: request.ref,
    failureIdentity: OperationalFailureIdentityV2Schema.parse(
      createOperationalFailureIdentityV2({
        requestedBy: request.requestedBy,
        evidenceSchema,
        operationalCause: cause,
        exactFailure: null,
      }),
    ),
  };
}

/**
 * Hashes only canonical operational state. Observation-clock fields
 * (`generatedAt` and invariant `observedAt`) and the hash field itself are
 * deliberately outside the digest, so polling unchanged rows yields one hash.
 */
export function computeRunOperationalSnapshotHash(snapshot: HashableSnapshot): string {
  const { generatedAt: _generatedAt, ...state } = snapshot;
  const invariants = state.invariants.map(({ observedAt: _observedAt, ...invariant }) => invariant);
  return hashCanonicalJson({ ...state, invariants });
}

function unavailableSnapshot(runId: string, generatedAt: string, source: OperationalProjectionSourceV2): RunOperationalSnapshotV2 {
  const run: OperationalRunV1 = {
    ref: runOperationalRef(runId),
    id: runId,
    runNumber: null,
    protocol: null,
    status: "unavailable",
    terminal: false,
    updatedAt: null,
  };
  const claims: OperationalClaimV1[] = [];
  const attempts: OperationalAttemptV1[] = [];
  const runtimeSessions: OperationalRuntimeSessionV1[] = [];
  const completionRequests: OperationalCompletionRequestV2[] = [];
  const terminationRequests: OperationalTerminationRequestV1[] = [];
  const outbox: OperationalOutboxItemV1[] = [];
  const legacyResumePlan: LegacyResumePlanResult = {
    status: "denied",
    reasonCode: "LEGACY_RESUME_PLAN_TARGET_MISSING",
    stateHash: hashCanonicalJson({
      schema: OPERATOR_ACTION_STATE_SCHEMA,
      run: { id: runId, status: "unavailable" },
      steps: [],
      stories: [],
    }),
  };
  const invariants = deriveInvariants({
    source,
    run,
    claims,
    attempts,
    runtimeSessions,
    completionRequests,
    terminationRequests,
    outbox,
    observedAt: generatedAt,
  });
  const summary = reduceRunOperationalLifecycle({
    source,
    run,
    claims,
    attempts,
    runtimeSessions,
    completionRequests,
    terminationRequests,
    outbox,
    invariants,
    legacyResumePlan,
  });
  const hashable: HashableSnapshot = {
    schema: "setfarm.run-operational-snapshot.v2",
    generatedAt,
    source,
    run,
    summary,
    claims,
    attempts,
    runtimeSessions,
    completionRequests,
    terminationRequests,
    outbox,
    invariants,
  };
  return RunOperationalSnapshotV2Schema.parse({
    ...hashable,
    snapshotHash: computeRunOperationalSnapshotHash(hashable),
  });
}

export async function buildRunOperationalSnapshotInTransaction(
  sql: TransactionSql,
  runId: string,
  options: RunOperationalSnapshotBuildOptions = {},
): Promise<RunOperationalSnapshotV2 | RunOperationalSnapshotV3 | null> {
  const clockRows = await sql.unsafe<Array<{ generated_at: unknown }>>(
    "SELECT transaction_timestamp() AS generated_at",
  );
  const generatedAt = timestamp(clockRows[0]?.generated_at);
  const { source, columns, operationalFailureAuthority } = await readSource(sql);
  if (source.projection === "unavailable") return unavailableSnapshot(runId, generatedAt, source);

  const runRows = await sql.unsafe<RawRun[]>(
    `SELECT id, run_number, protocol, status, updated_at,
            ${source.capabilities.acceptedCandidate
              ? "accepted_candidate_hash"
              : "NULL::text AS accepted_candidate_hash"},
            ${source.capabilities.deploymentReceipt
              ? "deploy_receipt_hash"
              : "NULL::text AS deploy_receipt_hash"},
            ${source.capabilities.projectTransferAck
              ? "project_transfer_ack_hash"
              : "NULL::text AS project_transfer_ack_hash"}
       FROM runs
      WHERE id = $1
      LIMIT 1`,
    [runId],
  );
  const runRow = runRows[0];
  if (!runRow) return null;
  const run = projectRun(runId, runRow);
  const actionTopologyAvailable = columns.has("steps") && columns.has("stories");
  const legacyResumeSource = actionTopologyAvailable
    ? await readLegacyResumePlanSource(sql, runId)
    : {
        schema: OPERATOR_ACTION_STATE_SCHEMA,
        run: {
          id: run.id,
          workflow_id: "projection-unavailable",
          protocol: run.protocol ?? "shadow",
          status: run.status,
          context: "{}",
          meta: null,
        },
        steps: [],
        stories: [],
      } as const;
  if (!legacyResumeSource) throw new Error(`OPERATIONAL_ACTION_STATE_RUN_DISAPPEARED:${runId}`);
  const legacyResumePlan = compileLegacyResumePlan(legacyResumeSource);

  const claimRows = hasColumns(columns, "claim_log")
    ? await sql.unsafe<RawClaim[]>(
      `SELECT id, step_id, story_id, agent_id, claimed_at, outcome, abandoned_at
         FROM claim_log
        WHERE run_id = $1
        ORDER BY id`,
      [runId],
    )
    : [];
  const attemptsRows = source.capabilities.attempts
    ? await sql.unsafe<RawAttempt[]>(
      `SELECT attempt_id,
              ${source.capabilities.claimBinding ? "claim_id" : "NULL::bigint AS claim_id"},
              step_id, story_id, generation, attempt_class, packet_hash,
              compilation_report_hash, slice_hash, source_before_sha, source_before_tree_hash,
              source_after_sha, source_after_tree_hash, finding_set_hash, role, agent_id,
              disposition, output_hash, created_at, updated_at
         FROM execution_attempts
        WHERE run_id = $1
        ORDER BY created_at, attempt_id`,
      [runId],
    )
    : [];
  const runtimeRows = source.capabilities.runtimeOwnership
    ? await sql.unsafe<RawRuntime[]>(
      `SELECT session_id, claim_id, attempt_id, workflow_step_id, story_id, runtime_kind,
              state, state_version, started_at, heartbeat_at, drain_requested_at, drained_at,
              released_at, created_at, updated_at
         FROM runtime_sessions
        WHERE run_id = $1
        ORDER BY created_at, session_id`,
      [runId],
    )
    : [];
  const completionRows = source.capabilities.managerCompletion
    ? await sql.unsafe<RawCompletion[]>(
      `SELECT request_id, runtime_session_id, claim_id, attempt_id, workflow_step_id, story_id,
              output_hash,
              ${source.capabilities.implementationSubmissionEvidence
                ? "submission_evidence"
                : "NULL::jsonb AS submission_evidence"},
              ${source.capabilities.implementationSubmissionEvidence
                ? `CASE WHEN submission_evidence IS NULL THEN NULL
                        ELSE encode(sha256(convert_to(source_proposal, 'UTF8')), 'hex')
                   END AS source_proposal_hash`
                : "NULL::text AS source_proposal_hash"},
              ${source.capabilities.implementationSubmissionEvidence
                ? `CASE WHEN submission_evidence IS NULL THEN NULL
                        ELSE encode(sha256(convert_to(output, 'UTF8')), 'hex')
                   END AS persisted_output_hash`
                : "NULL::text AS persisted_output_hash"},
              apply_phase, claim_outcome,
              ${source.capabilities.effectLedger ? "completion_plan_hash" : "NULL::text AS completion_plan_hash"},
              state, requested_at, drained_at, processing_at, accepted_at, rejected_at,
              created_at, updated_at
         FROM runtime_completion_requests
        WHERE run_id = $1
        ORDER BY created_at, request_id`,
      [runId],
    )
    : [];
  const completionIds = completionRows.map((row) => identity(row.request_id));
  const effectRows = source.capabilities.effectLedger && completionIds.length > 0
    ? await sql.unsafe<RawEffect[]>(
      `SELECT request_id, effect_key, ordinal, effect_type, input_hash, mandatory, state,
              attempt_count, applied_at, reconciled_at, created_at, updated_at
         FROM runtime_completion_effects
        WHERE request_id = ANY($1::text[])
        ORDER BY request_id, ordinal, effect_key`,
      [completionIds],
    )
    : [];
  const terminationRows = source.capabilities.runtimeOwnership
    ? await sql.unsafe<RawTermination[]>(
      `SELECT request_id, target_status, state, requested_by, requested_at, drained_at, terminalized_at,
              diagnostic, evidence, created_at, updated_at
         FROM run_termination_requests
        WHERE run_id = $1
        ORDER BY created_at, request_id`,
      [runId],
    )
    : [];
  const canonicalOperationalEvents = hasColumns(columns, "operational_events");
  const outboxRows = source.capabilities.effectLedger
    ? await sql.unsafe<RawOutbox[]>(
      canonicalOperationalEvents
        ? `SELECT outbox.outbox_id, outbox.request_id, outbox.event_key,
                  outbox.event_type, outbox.aggregate_type, outbox.aggregate_id,
                  outbox.state, outbox.attempt_count, outbox.published_at,
                  outbox.created_at, outbox.updated_at
             FROM operational_outbox outbox
             LEFT JOIN operational_events event
               ON event.event_key = outbox.event_key
              AND event.outbox_id = outbox.outbox_id
            WHERE ((outbox.aggregate_type = 'run' AND outbox.aggregate_id = $1)
               OR outbox.request_id = ANY($2::text[]))
              AND (outbox.state <> 'published' OR event.event_key IS NOT NULL)
            ORDER BY outbox.created_at, outbox.outbox_id`
        : `SELECT outbox_id, request_id, event_key, event_type, aggregate_type, aggregate_id,
                  state, attempt_count, published_at, created_at, updated_at
             FROM operational_outbox
            WHERE (aggregate_type = 'run' AND aggregate_id = $1)
               OR request_id = ANY($2::text[])
            ORDER BY created_at, outbox_id`,
      [runId, completionIds],
    )
    : [];
  const findingSetRows = source.capabilities.findingRecovery
    ? await sql.unsafe<RawFindingSet[]>(
      `SELECT finding_set_hash, finding_set_id, story_id, packet_hash, slice_hash,
              source_sha, source_tree_hash, finding_ids, created_at
         FROM finding_sets
        WHERE run_id = $1
        ORDER BY created_at, finding_set_hash`,
      [runId],
    )
    : [];
  const evidenceBundleRows = source.capabilities.evidenceLedger
    ? await sql.unsafe<RawEvidenceBundle[]>(
      `SELECT evidence_bundle_hash, evidence_id, story_id, packet_hash, slice_hash,
              source_sha, source_tree_hash, attempt_id, aggregate_verdict,
              jsonb_array_length(payload->'predicates') AS predicate_count,
              jsonb_array_length(payload->'observations') AS observation_count,
              created_at
         FROM evidence_bundles
        WHERE run_id = $1
        ORDER BY created_at, evidence_bundle_hash`,
      [runId],
    )
    : [];
  const recoveryCaseRows = source.capabilities.findingRecovery
    ? await sql.unsafe<RawRecoveryCase[]>(
      `SELECT recovery.recovery_case_id,
              revision.revision_id,
              revision.revision_number,
              recovery.story_id AS case_story_id,
              revision.run_id AS revision_run_id,
              revision.story_id,
              revision.finding_set_hash,
              revision.packet_hash,
              revision.contract_slice_hash,
              revision.source_sha,
              revision.source_tree_hash,
              recovery.owner AS case_owner,
              revision.owner AS revision_owner,
              recovery.expected_delta->>'kind' AS case_expected_delta_kind,
              revision.expected_delta->>'kind' AS revision_expected_delta_kind,
              recovery.max_implement,
              recovery.max_supervisor_repair,
              recovery.max_evidence_only,
              recovery.used_implement,
              recovery.used_supervisor_repair,
              recovery.used_evidence_only,
              recovery.status,
              recovery.terminal->>'reasonCode' AS terminal_reason_code,
              recovery.state_version,
              recovery.created_at,
              recovery.updated_at
         FROM recovery_cases recovery
         LEFT JOIN recovery_case_revisions revision
           ON revision.revision_id = recovery.current_revision_id
          AND revision.recovery_case_id = recovery.recovery_case_id
        WHERE recovery.run_id = $1
        ORDER BY recovery.created_at, recovery.recovery_case_id`,
      [runId],
    )
    : [];
  const recoveryDispatchRows = source.capabilities.findingRecovery
    ? await sql.unsafe<RawRecoveryDispatch[]>(
      `SELECT dispatch.dispatch_id,
              dispatch.recovery_case_id,
              dispatch.revision_id,
              revision.revision_number,
              dispatch.dispatch_class,
              revision.run_id AS revision_run_id,
              revision.story_id AS revision_story_id,
              delivery.run_id AS delivery_run_id,
              delivery.story_id AS delivery_story_id,
              dispatch.source_sha,
              dispatch.source_tree_hash,
              dispatch.packet_hash,
              dispatch.contract_slice_hash,
              dispatch.finding_set_hash,
              dispatch.finding_ids,
              dispatch.authorized_at AS dispatch_authorized_at,
              delivery.authorized_at AS delivery_authorized_at,
              delivery.state AS delivery_state,
              delivery.owner_instance_id,
              delivery.lease_expires_at,
              delivery.attempt_id,
              delivery.claim_id,
              delivery.execution_slice_hash,
              delivery.attempt_count,
              delivery.terminal_result->>'reasonCode' AS terminal_reason_code,
              delivery.terminal_at
         FROM recovery_revision_dispatches dispatch
         JOIN recovery_dispatch_deliveries delivery
           ON delivery.dispatch_id = dispatch.dispatch_id
          AND delivery.recovery_case_id = dispatch.recovery_case_id
          AND delivery.revision_id = dispatch.revision_id
         JOIN recovery_case_revisions revision
           ON revision.revision_id = dispatch.revision_id
          AND revision.recovery_case_id = dispatch.recovery_case_id
        WHERE delivery.run_id = $1
        ORDER BY delivery.authorized_at, dispatch.dispatch_id`,
      [runId],
    )
    : [];
  const acceptedCandidateRows = source.capabilities.acceptedCandidate
    ? await sql.unsafe<RawAcceptedCandidate[]>(
      `SELECT candidate_hash, candidate_id, run_id, packet_hash, story_plan_hash,
              source_sha, source_tree_hash, integration_evidence_hash, payload, created_at
         FROM accepted_candidates
        WHERE run_id = $1
        ORDER BY candidate_hash`,
      [runId],
    )
    : [];
  if (acceptedCandidateRows.length > 1) {
    throw new Error(`ACCEPTED_CANDIDATE_RUN_CARDINALITY_INVALID:${runId}`);
  }
  const acceptedCandidateRow = acceptedCandidateRows[0];
  const acceptedCandidateStoryRows = source.capabilities.acceptedCandidate && acceptedCandidateRow
    ? await sql.unsafe<RawAcceptedCandidateStoryEvidence[]>(
      `SELECT candidate_hash, story_id, attempt_id, slice_hash, evidence_plan_hash,
              evidence_plan_artifact_hash, evidence_bundle_hash, evidence_id, predicate_refs
         FROM accepted_candidate_story_evidence
        WHERE candidate_hash = $1
        ORDER BY story_id`,
      [identity(acceptedCandidateRow.candidate_hash)],
    )
    : [];
  const deploymentReceiptRows = source.capabilities.deploymentReceipt
    ? await sql.unsafe<RawV3DeployReceipt[]>(
      `SELECT receipt_hash, run_id, candidate_id, candidate_hash, packet_hash,
              product_id, project_id, display_name, summary, stack_pack_id,
              stack_pack_version, stack_pack_content_hash, platform, tech_stack,
              source_sha, source_tree_hash, service_id, deployment_mode, host,
              port, health_url, deploy_url, health_http_status, health_checked_at,
              terminal_projection_ref, completed_at, payload, created_at
         FROM v3_deploy_receipts
        WHERE run_id = $1
        ORDER BY receipt_hash`,
      [runId],
    )
    : [];
  if (deploymentReceiptRows.length > 1) {
    throw new Error(`V3_DEPLOY_RECEIPT_RUN_CARDINALITY_INVALID:${runId}`);
  }
  const projectTransferAckRows = source.capabilities.projectTransferAck
    ? await sql.unsafe<RawV3ProjectTransferAck[]>(
      `SELECT ack_hash, run_id, candidate_id, candidate_hash, packet_hash,
              source_sha, source_tree_hash, deploy_receipt_hash,
              source_snapshot_hash, project_id, projection_hash,
              project_record_hash, project_record_ref, persisted_at, payload, created_at
         FROM v3_project_transfer_acks
        WHERE run_id = $1
        ORDER BY ack_hash`,
      [runId],
    )
    : [];
  if (projectTransferAckRows.length > 1) {
    throw new Error(`V3_PROJECT_TRANSFER_ACK_RUN_CARDINALITY_INVALID:${runId}`);
  }

  const claims = claimRows.map((row) => projectClaim(runId, row));
  const attempts = attemptsRows.map((row) => projectAttempt(runId, row));
  const runtimeSessions = runtimeRows.map((row) => projectRuntime(runId, row));
  const effectsByRequest = new Map<string, OperationalCompletionEffectV1[]>();
  for (const row of effectRows) {
    const requestId = identity(row.request_id);
    const effects = effectsByRequest.get(requestId) ?? [];
    effects.push(projectEffect(row));
    effectsByRequest.set(requestId, effects);
  }
  const completionRequests = completionRows.map((row) => {
    const requestId = identity(row.request_id);
    return projectCompletion(runId, row, effectsByRequest.get(requestId) ?? []);
  });
  const terminationRequests = terminationRows.map((row) => projectTermination(runId, row));
  const outbox = outboxRows.map(projectOutbox);
  const findingSets = findingSetRows.map((row) => projectFindingSet(runId, row));
  const evidenceBundles = evidenceBundleRows.map((row) => projectEvidenceBundle(runId, row));
  const recoveryCases = recoveryCaseRows.map((row) => projectRecoveryCase(runId, row));
  const recoveryDispatches = recoveryDispatchRows.map((row) => projectRecoveryDispatch(runId, row));
  const acceptedCandidatePointer = optionalIdentity(runRow.accepted_candidate_hash);
  const acceptedCandidateLedgerHash = acceptedCandidateRow
    ? identity(acceptedCandidateRow.candidate_hash)
    : null;
  const acceptedCandidateBindingMismatchRefs = source.capabilities.acceptedCandidate
    && acceptedCandidatePointer !== acceptedCandidateLedgerHash
    ? [
      run.ref,
      ...(acceptedCandidatePointer ? [acceptedCandidateRef(acceptedCandidatePointer)] : []),
      ...(acceptedCandidateLedgerHash ? [acceptedCandidateRef(acceptedCandidateLedgerHash)] : []),
    ]
    : [];
  const acceptedCandidate = source.capabilities.acceptedCandidate
    && acceptedCandidateRow
    && acceptedCandidatePointer === acceptedCandidateLedgerHash
    ? projectAcceptedCandidate(runId, acceptedCandidateRow, acceptedCandidateStoryRows)
    : null;
  const deploymentReceiptPointer = optionalIdentity(runRow.deploy_receipt_hash);
  const deploymentReceiptRow = deploymentReceiptRows[0];
  const deploymentReceiptLedgerHash = deploymentReceiptRow
    ? identity(deploymentReceiptRow.receipt_hash)
    : null;
  const deploymentReceiptBindingMismatchRefs = source.capabilities.deploymentReceipt
    && deploymentReceiptPointer !== deploymentReceiptLedgerHash
    ? [
      run.ref,
      ...(deploymentReceiptPointer ? [v3DeployReceiptRef(deploymentReceiptPointer)] : []),
      ...(deploymentReceiptLedgerHash ? [v3DeployReceiptRef(deploymentReceiptLedgerHash)] : []),
    ]
    : [];
  const deploymentReceipt = source.capabilities.deploymentReceipt
    && deploymentReceiptRow
    && deploymentReceiptPointer === deploymentReceiptLedgerHash
    ? projectV3DeployReceipt(runId, deploymentReceiptRow)
    : null;
  const projectTransferAckPointer = optionalIdentity(runRow.project_transfer_ack_hash);
  const projectTransferAckRow = projectTransferAckRows[0];
  const projectTransferAckLedgerHash = projectTransferAckRow
    ? identity(projectTransferAckRow.ack_hash)
    : null;
  const projectTransferAckBindingMismatchRefs = source.capabilities.projectTransferAck
    && projectTransferAckPointer !== projectTransferAckLedgerHash
    ? [
      run.ref,
      ...(projectTransferAckPointer ? [v3ProjectTransferAckRef(projectTransferAckPointer)] : []),
      ...(projectTransferAckLedgerHash ? [v3ProjectTransferAckRef(projectTransferAckLedgerHash)] : []),
    ]
    : [];
  const projectTransferAck = source.capabilities.projectTransferAck
    && projectTransferAckRow
    && projectTransferAckPointer === projectTransferAckLedgerHash
    ? projectV3ProjectTransferAck(runId, projectTransferAckRow)
    : null;
  const invariants = deriveInvariants({
    source,
    run,
    claims,
    attempts,
    runtimeSessions,
    completionRequests,
    terminationRequests,
    outbox,
    acceptedCandidate,
    acceptedCandidateBindingMismatchRefs,
    deploymentReceipt,
    deploymentReceiptBindingMismatchRefs,
    projectTransferAck,
    projectTransferAckBindingMismatchRefs,
    observedAt: generatedAt,
  });
  const summary = reduceRunOperationalLifecycle({
    source,
    run,
    claims,
    attempts,
    runtimeSessions,
    completionRequests,
    terminationRequests,
    outbox,
    invariants,
    legacyResumePlan,
  });
  const hashableV2: Omit<RunOperationalSnapshotV2, "snapshotHash"> = {
    schema: "setfarm.run-operational-snapshot.v2",
    generatedAt,
    source,
    run,
    summary,
    claims,
    attempts,
    runtimeSessions,
    completionRequests,
    terminationRequests,
    outbox,
    invariants,
    ...(source.capabilities.findingRecovery ? { findingSets, recoveryCases, recoveryDispatches } : {}),
    ...(source.capabilities.evidenceLedger ? { evidenceBundles } : {}),
    ...(source.capabilities.acceptedCandidate ? { acceptedCandidate } : {}),
    ...(source.capabilities.deploymentReceipt ? { deploymentReceipt } : {}),
    ...(source.capabilities.projectTransferAck ? { projectTransferAck } : {}),
  };
  if (operationalFailureAuthority) {
    const sourceV3: OperationalProjectionSourceV3 = {
      ...source,
      capabilities: {
        ...source.capabilities,
        operationalFailureAuthority: true,
      },
    };
    const operationalFailure = await projectCanonicalOperationalFailureV3(
      sql,
      runId,
      terminationRequests,
      options,
    );
    const hashableV3: Omit<RunOperationalSnapshotV3, "snapshotHash"> = {
      ...hashableV2,
      schema: "setfarm.run-operational-snapshot.v3",
      source: sourceV3,
      operationalFailure,
    };
    return RunOperationalSnapshotV3Schema.parse({
      ...hashableV3,
      snapshotHash: computeRunOperationalSnapshotHashV3(hashableV3),
    });
  }
  return RunOperationalSnapshotV2Schema.parse({
    ...hashableV2,
    snapshotHash: computeRunOperationalSnapshotHash(hashableV2),
  });
}

/**
 * Builds one canonical read model from one PostgreSQL MVCC snapshot. The
 * explicit transaction mode prevents this presentation path from mutating live
 * lifecycle state and prevents cross-query state tearing.
 */
export async function buildRunOperationalSnapshot(
  sql: Sql,
  runId: string,
  options: RunOperationalSnapshotBuildOptions = {},
): Promise<RunOperationalSnapshotV2 | RunOperationalSnapshotV3 | null> {
  if (!runId.trim()) throw new TypeError("RUN_OPERATIONAL_SNAPSHOT_RUN_ID_REQUIRED");
  return sql.begin(
    "isolation level repeatable read read only",
    (transaction) => buildRunOperationalSnapshotInTransaction(transaction, runId, options),
  ) as Promise<RunOperationalSnapshotV2 | RunOperationalSnapshotV3 | null>;
}
