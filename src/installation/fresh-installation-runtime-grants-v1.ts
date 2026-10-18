import type postgres from "postgres";
import { canonicalJsonStringify } from "../product-compiler/canonical-json.js";
import {
  verifyFreshInstallationProvenanceProtectionV1,
  type FreshInstallationProvenanceSqlV1,
} from "./fresh-installation-provenance-v1.js";

type Grant = Readonly<{ table: string; privilege: "INSERT" | "UPDATE"; columns: readonly string[] }>;
const GRANTS: readonly Grant[] = Object.freeze([
  // run-persistence:475/520; terminal transition:905; repo/step/spawner updates.
  { table: "runs", privilege: "INSERT", columns: ["id", "run_number", "workflow_id", "task", "status", "context", "notify_url", "protocol", "protocol_version", "compiler_release_sha", "activation_preflight_hash", "release_admission_hash", "created_at", "updated_at"] },
  { table: "runs", privilege: "UPDATE", columns: ["assigned_developer", "context", "meta", "status", "packet_hash", "accepted_candidate_hash", "deploy_receipt_hash", "project_transfer_ack_hash", "updated_at"] },
  { table: "steps", privilege: "INSERT", columns: ["id", "run_id", "step_id", "agent_id", "step_index", "input_template", "expects", "status", "max_retries", "type", "loop_config", "created_at", "updated_at"] },
  { table: "steps", privilege: "UPDATE", columns: ["status", "output", "retry_count", "max_retries", "abandoned_count", "started_at", "current_story_id", "updated_at"] },
  // story-ops:496 and step-ops:2929; repo.updateStoryStatus adds abandoned_count.
  { table: "stories", privilege: "INSERT", columns: ["id", "run_id", "story_index", "story_id", "title", "description", "acceptance_criteria", "status", "retry_count", "max_retries", "depends_on", "scope_files", "shared_files", "scope_targets", "requested_dependencies", "shared_edit_requests", "resolved_scope_files", "scope_description", "file_skeletons", "implementation_contract", "output", "quality_failure_fingerprint", "created_at", "updated_at"] },
  { table: "stories", privilege: "UPDATE", columns: ["title", "description", "acceptance_criteria", "status", "output", "retry_count", "max_retries", "abandoned_count", "claimed_by", "claimed_at", "claim_generation", "started_at", "depends_on", "scope_files", "shared_files", "resolved_scope_files", "scope_description", "file_skeletons", "implementation_contract", "story_screens", "story_branch", "pr_url", "merge_status", "quality_failure_fingerprint", "updated_at"] },
  // claim-runtime-publication:377; completion/failure/terminal settlement.
  { table: "claim_log", privilege: "INSERT", columns: ["id", "run_id", "step_id", "story_id", "agent_id", "claimed_at"] },
  { table: "claim_log", privilege: "UPDATE", columns: ["outcome", "abandoned_at", "duration_ms", "diagnostic"] },
  // Normal claim exclusion/withdrawal/completion locks this mutable table even
  // when no recovery delivery exists. FOR UPDATE needs one UPDATE column;
  // the fixed owner-only guard below rejects every actual runtime UPDATE.
  { table: "recovery_dispatch_deliveries", privilege: "UPDATE", columns: ["updated_at"] },
  { table: "runtime_sessions", privilege: "INSERT", columns: ["session_id", "run_id", "step_db_id", "workflow_step_id", "story_db_id", "story_id", "claim_id", "attempt_id", "claim_agent_id", "runtime_agent_id", "runtime_kind", "owner_instance_id", "session_key", "worktree", "runtime_path", "transcript_path", "state", "heartbeat_at", "created_at", "updated_at"] },
  { table: "runtime_sessions", privilege: "UPDATE", columns: ["attempt_id", "diagnostic", "drain_evidence", "drain_requested_at", "drained_at", "heartbeat_at", "pid", "process_group_id", "process_identity", "process_started_at", "released_at", "runtime_path", "session_key", "started_at", "state", "state_version", "transcript_path", "updated_at", "worktree"] },
  // Expired downstream-evidence adoption rotates generation/fence/acquired time
  // under the exact existing old-generation/old-fence/claim/expired-lease CAS.
  { table: "execution_attempts", privilege: "INSERT", columns: ["attempt_id", "claim_id", "run_id", "step_id", "story_id", "generation", "fence_token", "attempt_class", "packet_hash", "compilation_report_hash", "slice_hash", "source_before_sha", "source_before_tree_hash", "finding_set_hash", "dedupe_key", "recovery_case_revision_id", "recovery_dispatch_id", "role", "agent_id", "branch", "worktree", "lease_acquired_at", "lease_expires_at", "heartbeat_at", "disposition", "evidence_refs", "created_at", "updated_at"] },
  { table: "execution_attempts", privilege: "UPDATE", columns: ["generation", "fence_token", "lease_acquired_at", "disposition", "evidence_refs", "heartbeat_at", "lease_expires_at", "output_hash", "source_after_sha", "source_after_tree_hash", "updated_at"] },
  { table: "runtime_completion_requests", privilege: "INSERT", columns: ["request_id", "runtime_session_id", "claim_id", "attempt_id", "run_id", "step_db_id", "workflow_step_id", "story_db_id", "story_id", "output", "output_hash", "source_proposal", "submission_evidence", "claim_envelope", "requested_by", "requested_at", "state", "result", "created_at", "updated_at"] },
  { table: "runtime_completion_requests", privilege: "UPDATE", columns: ["accepted_at", "apply_phase", "claim_committed_at", "claim_outcome", "completion_plan", "completion_plan_hash", "diagnostic", "drained_at", "effects_committed_at", "lease_expires_at", "owner_attempt_count", "owner_instance_id", "prepared_at", "processing_at", "rejected_at", "result", "state", "updated_at"] },
  { table: "runtime_completion_effects", privilege: "INSERT", columns: ["request_id", "effect_key", "ordinal", "effect_type", "input_hash", "payload", "mandatory", "state", "created_at", "updated_at"] },
  { table: "runtime_completion_effects", privilege: "UPDATE", columns: ["state", "owner_instance_id", "lease_token", "lease_expires_at", "attempt_count", "result", "evidence", "applied_at", "reconciled_at", "updated_at"] },
  { table: "run_termination_requests", privilege: "INSERT", columns: ["request_id", "run_id", "requested_by", "target_status", "state", "diagnostic", "evidence", "requested_at", "created_at", "updated_at"] },
  { table: "run_termination_requests", privilege: "UPDATE", columns: ["diagnostic", "drained_at", "evidence", "heartbeat_at", "lease_expires_at", "owner_instance_id", "state", "terminalized_at", "updated_at"] },
  // emitEvent -> recordEventObservation -> recordObservation:68; spawner:10078.
  { table: "run_observations", privilege: "INSERT", columns: ["id", "run_id", "step_id", "story_id", "agent_id", "phase", "check_id", "label", "status", "summary", "detail", "evidence", "file_paths", "github", "metadata", "event_type", "started_at", "completed_at", "created_at", "updated_at"] },
  // Existing cleanup receipt upsert/finalization only; no identity retargeting.
  { table: "run_observations", privilege: "UPDATE", columns: ["status", "summary", "detail", "completed_at", "updated_at", "metadata"] },
  // Health history uses the existing latest500-row retention statement.
  { table: "medic_checks", privilege: "INSERT", columns: ["id", "checked_at", "issues_found", "actions_taken", "summary", "details"] },
  // Existing user rule CRUD; id/readonly UPDATE and DDL remain closed.
  { table: "rules", privilege: "INSERT", columns: ["id", "title", "content", "category", "project_type", "severity", "applies_to", "enabled", "sort_order", "created_at", "updated_at"] },
  { table: "rules", privilege: "UPDATE", columns: ["title", "content", "category", "project_type", "severity", "applies_to", "enabled", "updated_at"] },
  { table: "operational_outbox", privilege: "INSERT", columns: ["outbox_id", "request_id", "event_key", "event_type", "aggregate_type", "aggregate_id", "payload", "state", "created_at", "updated_at"] },
  // event_key is used by the exact-equality ON CONFLICT replay, not identity retargeting.
  { table: "operational_outbox", privilege: "UPDATE", columns: ["event_key", "state", "owner_instance_id", "lease_token", "lease_expires_at", "attempt_count", "published_at", "diagnostic", "updated_at"] },
  { table: "operational_events", privilege: "INSERT", columns: ["event_key", "outbox_id", "request_id", "event_type", "aggregate_type", "aggregate_id", "run_id", "payload", "event_hash", "source_created_at", "committed_at"] },
  { table: "operational_event_deliveries", privilege: "INSERT", columns: ["event_key", "consumer", "delivery_id", "input_hash", "idempotency_key", "state", "created_at", "updated_at"] },
  { table: "operational_event_deliveries", privilege: "UPDATE", columns: ["state", "owner_instance_id", "lease_token", "lease_expires_at", "attempt_count", "delivered_at", "diagnostic", "result", "updated_at"] },
  // Append-only subject authority for ordinary V3 implement/supervise claims.
  { table: "v3_story_claim_runtime_bindings_v1", privilege: "INSERT", columns: ["claim_id", "runtime_session_id", "run_id", "step_db_id", "workflow_step_id", "subject_kind", "story_db_id", "story_id", "story_index", "story_claim_generation", "story_admission_receipt_hash", "story_admission_subject_hash", "bound_at"] },
  // Exact ordinary V3 create/promote and consume-once lifecycle. Release
  // admissions stay immutable; only mutable slot consumption may be updated.
  { table: "v3_release_admissions", privilege: "INSERT", columns: ["admission_hash", "kind", "release_sha", "suite_hash", "result_hash", "result_ref", "gate_hash", "gate_ref", "expires_at", "payload", "created_at"] },
  { table: "v3_canary_admission_claims", privilege: "INSERT", columns: ["slot_hash", "admission_hash", "admission_kind", "case_hash", "task_hash", "repetition", "selector_hash", "created_at"] },
  { table: "v3_canary_admission_claims", privilege: "UPDATE", columns: ["run_id", "consumed_at"] },
  // Compiler CAS index and exact packet/run refs. Every immutable table is
  // append-only; fresh source queries omit its row locks, not its validations.
  { table: "semantic_artifacts", privilege: "INSERT", columns: ["artifact_hash", "artifact_type", "byte_length", "producer_metadata", "created_at"] },
  { table: "run_artifact_refs", privilege: "INSERT", columns: ["run_id", "ref_key", "artifact_hash", "created_at"] },
  { table: "product_packets", privilege: "INSERT", columns: ["run_id", "packet_hash", "compiler_metadata", "sealed_at"] },
  // Initial quota/max_payload/bootstrap readiness are established by the owner
  // against the empty private CAS before activation. Runtime cannot raise quota.
  { table: "artifact_capacity", privilege: "UPDATE", columns: ["total_bytes", "reserved_bytes", "state", "diagnostic", "reconciled_at", "updated_at"] },
  { table: "artifact_publication_reservations", privilege: "INSERT", columns: ["reservation_id", "artifact_hash", "artifact_type", "byte_length", "producer_metadata", "state", "owner_instance_id", "lease_token", "lease_expires_at", "created_at", "updated_at"] },
  { table: "artifact_publication_reservations", privilege: "UPDATE", columns: ["state", "owner_instance_id", "lease_token", "lease_expires_at", "diagnostic", "published_at", "finalized_at", "updated_at"] },
  { table: "artifact_publication_batches", privilege: "INSERT", columns: ["batch_reservation_id", "identity_schema", "batch_identity_hash", "artifact_count", "created_by_instance_id", "state", "owner_instance_id", "lease_token", "lease_expires_at", "finalized_at", "created_at", "updated_at"] },
  { table: "artifact_publication_batches", privilege: "UPDATE", columns: ["state", "owner_instance_id", "lease_token", "lease_expires_at", "diagnostic", "finalized_at", "updated_at"] },
  { table: "artifact_publication_batch_items", privilege: "INSERT", columns: ["batch_reservation_id", "ordinal", "artifact_hash", "artifact_type", "byte_length", "producer_metadata", "reservation_id", "indexed_artifact_hash", "created_at"] },
  { table: "artifact_publication_batch_plans", privilege: "INSERT", columns: ["batch_reservation_id", "plan_schema", "plan_identity_hash", "item_count", "created_at"] },
  { table: "artifact_publication_batch_plan_items", privilege: "INSERT", columns: ["batch_reservation_id", "ordinal", "artifact_hash", "durability_tier", "created_at"] },
  // Design-source compilation leases: exact repository reserve/dispatch/seal/
  // fail/adopt/heartbeat columns; existing source/fence predicates stay intact.
  { table: "product_compilation_attempts", privilege: "INSERT", columns: ["attempt_id", "run_id", "origin_claim_id", "owner_claim_id", "pass_kind", "authority_hash", "request_hash", "ordinal", "parent_attempt_id", "parent_failure_artifact_hash", "parent_failure_fingerprint", "retry_delta_hash", "generation", "fence_token", "state", "owner_instance_id", "lease_token", "lease_acquired_at", "lease_expires_at", "heartbeat_at", "attempt_locator", "created_at", "updated_at"] },
  { table: "product_compilation_attempts", privilege: "UPDATE", columns: ["owner_claim_id", "generation", "fence_token", "state", "owner_instance_id", "lease_token", "lease_acquired_at", "lease_expires_at", "heartbeat_at", "dispatch_intent_at", "dispatch_started_at", "dispatch_finished_at", "external_operation_id", "disposition", "output_refs", "output_seal_hash", "failure", "failure_artifact_hash", "failure_fingerprint", "operational_cause_hash", "updated_at"] },
  // Preparation is an ordinary compiler operation, not legacy Task6A admission.
  { table: "v3_preparation_blocks", privilege: "INSERT", columns: ["block_id", "fingerprint", "occurrence", "run_id", "step_id", "story_id", "packet_hash", "source_sha", "source_tree_hash", "phase", "error_code", "action", "dependency_state", "detail", "evidence_refs", "opened_at"] },
  { table: "v3_preparation_blocks", privilege: "UPDATE", columns: ["resolved_at", "resolution_fingerprint"] },
  { table: "v3_preparation_story_state", privilege: "INSERT", columns: ["run_id", "step_id", "story_id", "state_version", "state", "packet_hash", "base_source_sha", "base_source_tree_hash", "projected_dependency_ids", "dependency_attempts", "state_fingerprint", "claim_id", "created_at", "updated_at", "claimed_at"] },
  { table: "v3_preparation_story_state", privilege: "UPDATE", columns: ["state_version", "state", "packet_hash", "base_source_sha", "base_source_tree_hash", "projected_dependency_ids", "dependency_attempts", "state_fingerprint", "claim_id", "claimed_at", "updated_at"] },
  // Published migration25 validation + unconditional immutable guards retained.
  // Its two unavoidable KEY SHARE privilege exceptions are kept in the separate
  // fixed timestamp-only policy below, never this mutable business grant list.
  { table: "v3_preparation_authorities_v2", privilege: "INSERT", columns: ["authority_hash", "authority_schema", "authority_version", "packet_schema", "run_id", "step_id", "story_id", "state_version", "packet_hash", "compilation_report_hash", "base_source_sha", "base_source_tree_hash", "authority_payload"] },
  { table: "v3_preparation_authority_claims_v2", privilege: "INSERT", columns: ["authority_hash", "claim_id"] },
  { table: "v3_preparation_authority_attempts_v2", privilege: "INSERT", columns: ["authority_hash", "claim_id", "attempt_id", "slice_hash"] },
  // Normal verification/final-test evidence publication uses these existing
  // guarded append APIs; no recovery dispatch/state/identity mutation right.
  { table: "evidence_bundles", privilege: "INSERT", columns: ["evidence_bundle_hash", "evidence_id", "run_id", "story_id", "packet_hash", "slice_hash", "source_sha", "source_tree_hash", "attempt_id", "aggregate_verdict", "payload"] },
  { table: "finding_sets", privilege: "INSERT", columns: ["finding_set_hash", "finding_set_id", "run_id", "story_id", "packet_hash", "slice_hash", "source_sha", "source_tree_hash", "finding_ids", "payload"] },
  { table: "findings", privilege: "INSERT", columns: ["finding_set_hash", "finding_id", "origin", "classification", "invariant_ref", "status", "source_fingerprint", "payload"] },
  { table: "accepted_candidates", privilege: "INSERT", columns: ["candidate_hash", "candidate_id", "run_id", "packet_hash", "story_plan_hash", "source_sha", "source_tree_hash", "integration_evidence_hash", "payload", "created_at"] },
  { table: "accepted_candidate_story_evidence", privilege: "INSERT", columns: ["candidate_hash", "story_id", "attempt_id", "slice_hash", "evidence_plan_hash", "evidence_plan_artifact_hash", "evidence_bundle_hash", "evidence_id", "predicate_refs", "created_at"] },
  // Product deployment/transfer acknowledgements, not Setfarm source activation.
  { table: "v3_deploy_receipts", privilege: "INSERT", columns: ["receipt_hash", "run_id", "step_db_id", "workflow_step_id", "claim_id", "candidate_id", "candidate_hash", "packet_hash", "product_id", "project_id", "display_name", "summary", "stack_pack_id", "stack_pack_version", "stack_pack_content_hash", "platform", "tech_stack", "source_sha", "source_tree_hash", "build_artifact_hash", "build_manifest_file_count", "build_manifest_total_bytes", "build_manifest_ref", "sealed_runtime_ref", "service_id", "deployment_mode", "host", "port", "health_url", "deploy_url", "health_http_status", "health_checked_at", "runtime_owner_pid", "runtime_owner_started_at", "runtime_owner_process_group_id", "terminal_projection_ref", "completed_at", "payload", "created_at"] },
  { table: "v3_project_transfer_acks", privilege: "INSERT", columns: ["ack_hash", "run_id", "candidate_id", "candidate_hash", "packet_hash", "source_sha", "source_tree_hash", "deploy_receipt_hash", "source_snapshot_hash", "project_id", "projection_hash", "project_record_hash", "project_record_ref", "persisted_at", "payload", "created_at"] },
]);
const TABLES = Object.freeze([...new Set(GRANTS.map(grant => grant.table))].sort());
const SEQUENCES = Object.freeze(["runs_run_number_seq", "claim_log_id_seq"]);
// Exact scoped exception for unavoidable published migration25 INVOKER locks.
// Neither timestamp can actually be updated: the exact existing row triggers
// reject ALL UPDATEs before identity/INSERT logic, including equal assignments.
const PREPARATION_ROW_LOCK_PRIVILEGES = Object.freeze([
  { table: "v3_preparation_authorities_v2", column: "created_at" },
  { table: "v3_preparation_authority_claims_v2", column: "claimed_at" },
]);
const PREPARATION_GUARD_FUNCTIONS = Object.freeze([
  "setfarm_enforce_v3_preparation_authority_v2_immutable",
  "setfarm_enforce_v3_preparation_authority_claim_v2",
  "setfarm_enforce_v3_preparation_authority_attempt_v2",
  "setfarm_enforce_v3_preparation_bound_claim_v2",
  "setfarm_enforce_v3_preparation_bound_attempt_v2",
]);
// Fixed mutable story replacement, medic latest500 retention and user-rule
// deletion only; their source-owned statements retain the predicates.
const DELETE_TABLES = Object.freeze(["stories", "medic_checks", "rules"]);
const DELIVERY_GUARD_FUNCTION = "setfarm_fresh_recovery_delivery_lock_guard_v1";
const DELIVERY_GUARD_TRIGGER = "trg_setfarm_fresh_recovery_delivery_lock_v1";
const DELIVERY_GUARD_BODY = `BEGIN
  IF TG_TABLE_SCHEMA <> 'public' OR TG_TABLE_NAME <> 'recovery_dispatch_deliveries'
     OR TG_NARGS <> 0 OR TG_OP <> 'UPDATE' OR TG_LEVEL <> 'STATEMENT'
     OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_class c WHERE c.oid=TG_RELID
       AND pg_catalog.pg_get_userbyid(c.relowner)=current_user) THEN
    RAISE EXCEPTION 'FRESH_INSTALLATION_RECOVERY_DELIVERY_UPDATE_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  RETURN NULL;
END`;

function refuse(): never { throw new Error("FRESH_INSTALLATION_RUNTIME_GRANTS_REFUSED"); }
function quote(value: string): string { return `"${value.replaceAll('"', '""')}"`; }
function requireRole(value: string): string {
  if (typeof value !== "string" || !/^sf_runtime_[0-9a-f]{32}$/.test(value)) refuse();
  return value;
}
function oid(value: string): boolean {
  return typeof value === "string" && /^[1-9][0-9]{0,9}$/.test(value) && BigInt(value) <= 4294967295n;
}
type Context = Readonly<{ ownerOid: string; runtimeOid: string }>;
type Acl = { object: string; column: string; grantor: string; grantee: string; privilege: string; grantable: boolean };

async function installDeliveryRowLockGuard(sql: FreshInstallationProvenanceSqlV1, ctx: Context): Promise<void> {
  const absent = await sql.unsafe<Array<{ absent: boolean }>>(`SELECT
    NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname='${DELIVERY_GUARD_FUNCTION}')
    AND NOT EXISTS(SELECT 1 FROM pg_catalog.pg_trigger t
      WHERE t.tgrelid='public.recovery_dispatch_deliveries'::regclass AND NOT t.tgisinternal) AS absent`);
  if (absent.length !== 1 || absent[0]?.absent !== true) refuse();
  await sql.unsafe(`CREATE FUNCTION public.${DELIVERY_GUARD_FUNCTION}() RETURNS trigger
    LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $fresh_delivery$${DELIVERY_GUARD_BODY}$fresh_delivery$`);
  await sql.unsafe(`REVOKE ALL ON FUNCTION public.${DELIVERY_GUARD_FUNCTION}() FROM PUBLIC`);
  await sql.unsafe(`CREATE TRIGGER ${DELIVERY_GUARD_TRIGGER} BEFORE UPDATE ON public.recovery_dispatch_deliveries
    FOR EACH STATEMENT EXECUTE FUNCTION public.${DELIVERY_GUARD_FUNCTION}()`);
  await sql.unsafe(`ALTER TABLE public.recovery_dispatch_deliveries ENABLE ALWAYS TRIGGER ${DELIVERY_GUARD_TRIGGER}`);
  await verifyDeliveryRowLockGuard(sql, ctx);
}

/** This timestamp is a recovery causality/CAS input, not freely mutable data. */
async function verifyDeliveryRowLockGuard(sql: FreshInstallationProvenanceSqlV1, ctx: Context): Promise<void> {
  const functions = await sql.unsafe<Array<{
    oid: string; owner_oid: string; body: string; config: string[] | null; valid: boolean; owner_acl: boolean;
  }>>(`SELECT p.oid::text AS oid,p.proowner::text AS owner_oid,p.prosrc AS body,p.proconfig AS config,
      (p.pronargs=0 AND p.pronargdefaults=0 AND p.prokind='f' AND p.prorettype='pg_catalog.trigger'::regtype
       AND l.lanname='plpgsql' AND NOT p.prosecdef AND NOT p.proleakproof AND NOT p.proisstrict
       AND NOT p.proretset AND p.provolatile='v' AND p.proparallel='u'
       AND pg_catalog.pg_get_function_identity_arguments(p.oid)='') AS valid,
      (SELECT count(*)=1 AND bool_and(a.grantor=p.proowner AND a.grantee=p.proowner
         AND a.privilege_type='EXECUTE' AND NOT a.is_grantable)
       FROM pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) a) AS owner_acl
    FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
      JOIN pg_catalog.pg_language l ON l.oid=p.prolang
    WHERE n.nspname='public' AND p.proname='${DELIVERY_GUARD_FUNCTION}' LIMIT 2`);
  const fn = functions[0];
  if (functions.length !== 1 || !fn || !oid(fn.oid) || fn.owner_oid !== ctx.ownerOid
    || fn.body !== DELIVERY_GUARD_BODY || fn.valid !== true || fn.owner_acl !== true
    || canonicalJsonStringify(fn.config) !== canonicalJsonStringify(["search_path=pg_catalog"])) refuse();
  const triggers = await sql.unsafe<Array<{
    name: string; function_oid: string; type: number; enabled: string; valid: boolean;
  }>>(`SELECT t.tgname AS name,t.tgfoid::text AS function_oid,t.tgtype::integer AS type,t.tgenabled AS enabled,
      (t.tgnargs=0 AND octet_length(t.tgargs)=0 AND t.tgattr=''::int2vector AND t.tgqual IS NULL
       AND t.tgconstraint=0 AND t.tgconstrrelid=0 AND t.tgconstrindid=0
       AND NOT t.tgdeferrable AND NOT t.tginitdeferred) AS valid
    FROM pg_catalog.pg_trigger t WHERE t.tgrelid='public.recovery_dispatch_deliveries'::regclass
      AND NOT t.tgisinternal ORDER BY t.tgname LIMIT 2`);
  if (triggers.length !== 1 || triggers[0]?.name !== DELIVERY_GUARD_TRIGGER
    || triggers[0].function_oid !== fn.oid || triggers[0].type !== 18
    || triggers[0].enabled !== "A" || triggers[0].valid !== true) refuse();
}

// Read-only principal boundary. The full exact migration25 verifier is invoked
// ONCE on installation before any exception grant, never as a broad runtime scan.
async function verifyPreparationRowLockPrincipal(
  sql: FreshInstallationProvenanceSqlV1, role: string, ownerOid: string,
): Promise<void> {
  const permissions = await sql.unsafe<Array<{ replica: boolean }>>(
    "SELECT pg_catalog.has_parameter_privilege($1,'session_replication_role','SET') AS replica", [role],
  );
  if (permissions.length !== 1 || permissions[0]?.replica !== false) refuse();
  const functions = await sql.unsafe<Array<{ name: string; owner_oid: string }>>(
    `SELECT p.proname AS name,p.proowner::text AS owner_oid
       FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname=ANY($1::text[])
      ORDER BY p.proname LIMIT 6`, [[...PREPARATION_GUARD_FUNCTIONS]],
  );
  if (functions.length !== PREPARATION_GUARD_FUNCTIONS.length
    || new Set(functions.map(row => row.name)).size !== functions.length
    || functions.some(row => row.owner_oid !== ownerOid || !PREPARATION_GUARD_FUNCTIONS.includes(row.name))) refuse();
}

async function context(sql: FreshInstallationProvenanceSqlV1, role: string, ownerRequired: boolean): Promise<Context> {
  await verifyFreshInstallationProvenanceProtectionV1(sql, role);
  const suffix = role.slice("sf_runtime_".length);
  const rows = await sql.unsafe<Array<{ owner_oid: string; runtime_oid: string; valid: boolean }>>(
    `SELECT o.oid::text AS owner_oid,r.oid::text AS runtime_oid,
       (d.datname='setfarm_install_${suffix}' AND o.rolname='sf_owner_${suffix}'
        AND ${ownerRequired ? "current_user=o.rolname" : "current_user IN (o.rolname,r.rolname)"}) AS valid
     FROM pg_catalog.pg_database d JOIN pg_catalog.pg_roles o ON o.oid=d.datdba
       JOIN pg_catalog.pg_roles r ON r.rolname='${role}' WHERE d.datname=current_database() LIMIT 2`,
  );
  const row = rows[0];
  if (rows.length !== 1 || !row || !oid(row.owner_oid) || !oid(row.runtime_oid) || row.valid !== true) refuse();
  if (TABLES.length + SEQUENCES.length + 1 > 128) refuse();
  await verifyPreparationRowLockPrincipal(sql, role, row.owner_oid);
  const names = [...TABLES, ...SEQUENCES].map(name => `'${name}'`).join(",");
  const objects = await sql.unsafe<Array<{ name: string; owner_oid: string; kind: string; serial_matches: boolean }>>(
    `SELECT c.relname AS name,c.relowner::text AS owner_oid,c.relkind AS kind,
       (c.relname<>'claim_log_id_seq' OR c.oid=pg_catalog.pg_get_serial_sequence('public.claim_log','id')::regclass) AS serial_matches
     FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public' AND c.relname IN (${names}) ORDER BY c.relname LIMIT ${TABLES.length + SEQUENCES.length + 1}`,
  );
  if (objects.length !== TABLES.length + SEQUENCES.length
    || new Set(objects.map(object => object.name)).size !== objects.length
    || objects.some(object => object.owner_oid !== row.owner_oid || object.serial_matches !== true
      || (TABLES.includes(object.name) ? object.kind !== "r"
        : !SEQUENCES.includes(object.name) || object.kind !== "S"))) refuse();
  return Object.freeze({ ownerOid: row.owner_oid, runtimeOid: row.runtime_oid });
}

async function readAcl(sql: FreshInstallationProvenanceSqlV1, ctx: Context): Promise<Acl[]> {
  const tables = TABLES.map(name => `'${name}'`).join(",");
  const sequences = SEQUENCES.map(name => `'${name}'`).join(",");
  return sql.unsafe<Acl[]>(`WITH objects AS (
      SELECT c.* FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname IN (${tables},${sequences})
    ), entries AS (
      SELECT c.relname AS object_name,''::text AS column_name,a.* FROM objects c
        CROSS JOIN LATERAL pg_catalog.aclexplode(coalesce(c.relacl,
          pg_catalog.acldefault(CASE WHEN c.relkind='S' THEN 's' ELSE 'r' END::"char",c.relowner))) a
      UNION ALL SELECT c.relname,att.attname,a.* FROM objects c
        JOIN pg_catalog.pg_attribute att ON att.attrelid=c.oid AND att.attnum>0 AND NOT att.attisdropped
        CROSS JOIN LATERAL pg_catalog.aclexplode(att.attacl) a
    ) SELECT object_name AS "object",column_name AS "column",grantor::text AS grantor,grantee::text AS grantee,
        privilege_type AS privilege,is_grantable AS grantable FROM entries
      WHERE grantee IN (0::oid,'${ctx.runtimeOid}'::oid)
      ORDER BY object_name,column_name,grantor,grantee,privilege_type,is_grantable LIMIT 2048`);
}

function assertAcl(actual: readonly Acl[], ctx: Context, extended: boolean): void {
  const expected: Acl[] = [...TABLES, ...SEQUENCES].map(object => ({ object, column: "",
    grantor: ctx.ownerOid, grantee: ctx.runtimeOid, privilege: "SELECT", grantable: false }));
  const append = (object: string, column: string, privilege: string) => expected.push({ object, column,
    grantor: ctx.ownerOid, grantee: ctx.runtimeOid, privilege, grantable: false });
  if (extended) {
    for (const grant of GRANTS) for (const column of grant.columns) append(grant.table, column, grant.privilege);
    for (const grant of PREPARATION_ROW_LOCK_PRIVILEGES) append(grant.table, grant.column, "UPDATE");
    for (const table of DELETE_TABLES) append(table, "", "DELETE");
    for (const sequence of SEQUENCES) append(sequence, "", "USAGE");
  }
  const encode = (rows: readonly Acl[]) => rows.map(row => canonicalJsonStringify({
    object: row.object, column: row.column, grantor: row.grantor, grantee: row.grantee,
    privilege: row.privilege, grantable: row.grantable,
  })).sort();
  if (canonicalJsonStringify(encode(actual)) !== canonicalJsonStringify(encode(expected))) refuse();
}

/** Owner transaction only; fixed initial policy, no privilege repair/adoption. */
export async function installFreshInstallationRuntimeBusinessGrantsV1(
  sql: postgres.TransactionSql, runtimeRoleInput: string,
): Promise<void> {
  try {
    const role = requireRole(runtimeRoleInput);
    const before = await context(sql, role, true);
    assertAcl(await readAcl(sql, before), before, false);
    // Dynamic import avoids introducing an eager cycle through the existing
    // migration/initializer modules. This exact verifier performs SELECT only:
    // relation topology/columns/constraints/indexes, five whole INVOKER bodies,
    // search_path/config, O triggers, relational identity and journal presence.
    // Enter the existing circular migration graph through its canonical module.
    // Importing the leaf first can read its ledger statements before initialization.
    await import("../db/contract-spine-migrations.js");
    const { verifyPreparationAuthorityV2Ledger } = await import("../db/preparation-authority-v2-migration.js");
    await verifyPreparationAuthorityV2Ledger(sql);
    await installDeliveryRowLockGuard(sql, before);
    for (const grant of GRANTS) await sql.unsafe(
      `GRANT ${grant.privilege} (${grant.columns.map(quote).join(",")}) ON TABLE public.${grant.table} TO ${quote(role)}`,
    );
    for (const grant of PREPARATION_ROW_LOCK_PRIVILEGES) await sql.unsafe(
      `GRANT UPDATE (${quote(grant.column)}) ON TABLE public.${grant.table} TO ${quote(role)}`,
    );
    for (const table of DELETE_TABLES) await sql.unsafe(`GRANT DELETE ON TABLE public.${table} TO ${quote(role)}`);
    for (const sequence of SEQUENCES) await sql.unsafe(`GRANT USAGE ON SEQUENCE public.${sequence} TO ${quote(role)}`);
    const after = await context(sql, role, true);
    if (canonicalJsonStringify(before) !== canonicalJsonStringify(after)) refuse();
    await verifyDeliveryRowLockGuard(sql, after);
    assertAcl(await readAcl(sql, after), after, true);
  } catch { return refuse(); }
}

/** Read-only exact grants verification; full activated catalog is also required. */
export async function verifyFreshInstallationRuntimeBusinessGrantsV1(
  sql: FreshInstallationProvenanceSqlV1, runtimeRoleInput: string,
): Promise<void> {
  try {
    const ctx = await context(sql, requireRole(runtimeRoleInput), false);
    await verifyDeliveryRowLockGuard(sql, ctx);
    assertAcl(await readAcl(sql, ctx), ctx, true);
  } catch { return refuse(); }
}
