import type postgres from "postgres";

// SETFARM_SEMANTIC_MIGRATION_REGION:migration-v32-identity-and-statements:BEGIN
import { createHash } from "node:crypto";

type Sql = postgres.Sql | postgres.TransactionSql;
export const BOOTSTRAP_MAIN_CLAIM_HANDOFF_V1_MIGRATION_ID =
  "contract-spine-bootstrap-main-claim-handoff-v1" as const;
export const BOOTSTRAP_MAIN_CLAIM_HANDOFF_V1_MIGRATION_ORDINAL = 32 as const;

export type BootstrapMainClaimHandoffGuardedMigration32EvidenceBodyV1 = Readonly<{
  schema: "setfarm.bootstrap-main-claim-handoff-guarded-migration-32-evidence.v1";
  purpose: "task6a-guarded-migration-32-after-sealed-spawner-v1";
  currentEntryOperationRef: string;
  currentEntryOperationHash: string;
  sealedSpawnerAdmissionRef: string;
  sealedSpawnerAdmissionHash: string;
  postPredecessorTerminationLegacyZeroOwnerObservationRef: string;
  postPredecessorTerminationLegacyZeroOwnerObservationHash: string;
  authorityV3Migration31AuditRef: string;
  authorityV3Migration31AuditHash: string;
  pendingBootstrapHandoffMigrationRef: string;
  pendingBootstrapHandoffMigrationHash: string;
  cleanSetfarmSourceSha: string;
  cleanSetfarmTreeHash: string;
  cleanSetfarmBuildHash: string;
  migrationSourceSha: string;
  freshLegacyZeroOwnerObservationRef: string;
  freshLegacyZeroOwnerObservationHash: string;
  preManifestMigration32AuthorizationRef: string;
  preManifestMigration32AuthorizationHash: string;
  preManifestMigration32AuthorizationConsumptionRef: string;
  preManifestMigration32AuthorizationConsumptionHash: string;
}>;

declare const GUARDED_MIGRATION_32_EVIDENCE_BRAND: unique symbol;
export type BootstrapMainClaimHandoffGuardedMigration32EvidenceV1 =
  BootstrapMainClaimHandoffGuardedMigration32EvidenceBodyV1 & Readonly<{
    [GUARDED_MIGRATION_32_EVIDENCE_BRAND]: true;
  }>;

const authenticatedGuardedMigration32Evidence = new WeakSet<object>();

export function mintBootstrapMainClaimHandoffGuardedMigration32EvidenceForControllerV1(
  evidence: BootstrapMainClaimHandoffGuardedMigration32EvidenceBodyV1,
): BootstrapMainClaimHandoffGuardedMigration32EvidenceV1 {
  if (arguments.length !== 1 || !evidence || typeof evidence !== "object" || Array.isArray(evidence)) {
    throw new TypeError("GUARDED_MIGRATION_32_EVIDENCE_BODY_REQUIRED");
  }
  const authenticated = Object.freeze({ ...evidence });
  authenticatedGuardedMigration32Evidence.add(authenticated);
  return authenticated as BootstrapMainClaimHandoffGuardedMigration32EvidenceV1;
}

export function isAuthenticatedBootstrapMainClaimHandoffGuardedMigration32EvidenceV1(
  evidence: unknown,
): evidence is BootstrapMainClaimHandoffGuardedMigration32EvidenceV1 {
  return typeof evidence === "object"
    && evidence !== null
    && authenticatedGuardedMigration32Evidence.has(evidence);
}

export const BOOTSTRAP_MAIN_CLAIM_HANDOFF_V1_STATEMENTS = Object.freeze([
  `CREATE TABLE public.internal_production_bootstrap_main_claim_handoff_operations_v1 (
     bootstrap_handoff_operation_id TEXT NOT NULL,
     continuation_grant_ref TEXT NOT NULL,
     continuation_grant_hash TEXT NOT NULL,
     bootstrap_settlement_ref TEXT NOT NULL,
     bootstrap_settlement_hash TEXT NOT NULL,
     migration_receipt_ref TEXT NOT NULL,
     migration_receipt_hash TEXT NOT NULL,
     claim_id TEXT,
     phase TEXT NOT NULL,
     expected_predecessor_phase TEXT,
     worktree_identity_hash TEXT,
     terminal_receipt_ref TEXT,
     terminal_receipt_hash TEXT,
     failure_code TEXT,
     release_receipt_ref TEXT,
     release_receipt_hash TEXT,
     released_at TIMESTAMPTZ,
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     CONSTRAINT internal_production_bootstrap_handoff_operation_pkey
       PRIMARY KEY (bootstrap_handoff_operation_id),
     CONSTRAINT internal_production_bootstrap_handoff_continuation_grant_unique
       UNIQUE (continuation_grant_ref, continuation_grant_hash),
     CONSTRAINT internal_production_bootstrap_handoff_claim_unique UNIQUE (claim_id),
     CONSTRAINT internal_production_bootstrap_handoff_hashes_check CHECK (
       continuation_grant_hash ~ '^[a-f0-9]{64}$'
       AND bootstrap_settlement_hash ~ '^[a-f0-9]{64}$'
       AND migration_receipt_hash ~ '^[a-f0-9]{64}$'
       AND (worktree_identity_hash IS NULL
         OR worktree_identity_hash ~ '^[a-f0-9]{64}$')
       AND (terminal_receipt_hash IS NULL
         OR terminal_receipt_hash ~ '^[a-f0-9]{64}$')
       AND (release_receipt_hash IS NULL
         OR release_receipt_hash ~ '^[a-f0-9]{64}$')
     ),
     CONSTRAINT internal_production_bootstrap_handoff_phase_check CHECK (
       phase IN (
         'reserved', 'claim_allocated', 'worktree_ready',
         'receipt_published', 'terminal', 'failed_released'
       )
       AND (expected_predecessor_phase IS NULL OR expected_predecessor_phase IN (
         'reserved', 'claim_allocated', 'worktree_ready', 'receipt_published'
       ))
     ),
     CONSTRAINT internal_production_bootstrap_handoff_terminal_pair_check CHECK (
       (terminal_receipt_ref IS NULL) = (terminal_receipt_hash IS NULL)
     ),
     CONSTRAINT internal_production_bootstrap_handoff_release_pair_check CHECK (
       (release_receipt_ref IS NULL) = (release_receipt_hash IS NULL)
     ),
     CONSTRAINT internal_production_bootstrap_handoff_phase_shape_check CHECK (
       (phase = 'reserved'
         AND claim_id IS NULL
         AND worktree_identity_hash IS NULL
         AND terminal_receipt_ref IS NULL
         AND failure_code IS NULL
         AND release_receipt_ref IS NULL
         AND released_at IS NULL)
       OR (phase = 'claim_allocated'
         AND claim_id IS NOT NULL
         AND worktree_identity_hash IS NULL
         AND terminal_receipt_ref IS NULL
         AND failure_code IS NULL
         AND release_receipt_ref IS NULL
         AND released_at IS NULL)
       OR (phase = 'worktree_ready'
         AND claim_id IS NOT NULL
         AND worktree_identity_hash IS NOT NULL
         AND terminal_receipt_ref IS NULL
         AND failure_code IS NULL
         AND release_receipt_ref IS NULL
         AND released_at IS NULL)
       OR (phase = 'receipt_published'
         AND claim_id IS NOT NULL
         AND worktree_identity_hash IS NOT NULL
         AND terminal_receipt_ref IS NOT NULL
         AND failure_code IS NULL
         AND release_receipt_ref IS NULL
         AND released_at IS NULL)
       OR (phase = 'terminal'
         AND claim_id IS NOT NULL
         AND worktree_identity_hash IS NOT NULL
         AND terminal_receipt_ref IS NOT NULL
         AND failure_code IS NULL
         AND release_receipt_ref IS NULL
         AND released_at IS NULL)
       OR (phase = 'failed_released'
         AND terminal_receipt_ref IS NULL
         AND failure_code IS NOT NULL
         AND release_receipt_ref IS NOT NULL
         AND released_at IS NOT NULL)
     )
   )`,
  `CREATE TABLE public.internal_production_owner_reservations_v1 (
     reservation_ref TEXT NOT NULL,
     reservation_hash TEXT NOT NULL,
     category TEXT NOT NULL,
     owner_key TEXT NOT NULL,
     owner_key_hash TEXT NOT NULL,
     producer_purpose_hash TEXT NOT NULL,
     producer_implementation_id TEXT NOT NULL,
     producer_implementation_hash TEXT NOT NULL,
     reservation_payload JSONB NOT NULL,
     reservation_head_predecessor_hash TEXT NOT NULL,
     state TEXT NOT NULL,
     canonical_owner_identity JSONB,
     binding_hash TEXT,
     binding_payload JSONB,
     close_kind TEXT,
     terminal_owner_ref TEXT,
     terminal_owner_hash TEXT,
     close_head_predecessor_hash TEXT,
     close_head_successor_hash TEXT,
     preserved_fence_ref TEXT,
     preserved_fence_hash TEXT,
     close_ref TEXT,
     close_hash TEXT,
     close_payload JSONB,
     head_version BIGINT NOT NULL,
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     CONSTRAINT internal_production_owner_reservation_pkey PRIMARY KEY (reservation_ref),
     CONSTRAINT internal_production_owner_reservation_hash_unique UNIQUE (reservation_hash),
     CONSTRAINT internal_production_owner_reservation_key_unique
       UNIQUE (category, owner_key_hash),
     CONSTRAINT internal_production_owner_reservation_category_check CHECK (
       category IN (
         'run', 'claim', 'execution-attempt', 'runtime-session',
         'completion-owner', 'mandatory-effect', 'ordinary-service-start',
         'restart-reservation', 'service-restart-operation', 'launch-preparation',
         'prepared-launch', 'staged-case', 'fixture-attempt',
         'artifact-reservation', 'artifact-publication', 'docs-session',
         'docs-lease', 'fleet-stage', 'fleet-inflight', 'fleet-review',
         'matrix-inflight', 'launch-outbox', 'termination', 'finding',
         'recovery', 'operational-delivery', 'source-run', 'cold-rehearsal',
         'compilation-lease', 'execution-lease', 'process', 'listener',
         'worktree', 'dirty-worktree', 'stale-child'
       )
     ),
     CONSTRAINT internal_production_owner_reservation_hashes_check CHECK (
       reservation_hash ~ '^[a-f0-9]{64}$'
       AND owner_key_hash ~ '^[a-f0-9]{64}$'
       AND producer_purpose_hash ~ '^[a-f0-9]{64}$'
       AND producer_implementation_hash ~ '^[a-f0-9]{64}$'
       AND reservation_head_predecessor_hash ~ '^[a-f0-9]{64}$'
       AND (binding_hash IS NULL OR binding_hash ~ '^[a-f0-9]{64}$')
       AND (terminal_owner_hash IS NULL OR terminal_owner_hash ~ '^[a-f0-9]{64}$')
       AND (close_head_predecessor_hash IS NULL
         OR close_head_predecessor_hash ~ '^[a-f0-9]{64}$')
       AND (close_head_successor_hash IS NULL
         OR close_head_successor_hash ~ '^[a-f0-9]{64}$')
       AND (preserved_fence_hash IS NULL OR preserved_fence_hash ~ '^[a-f0-9]{64}$')
       AND (close_hash IS NULL OR close_hash ~ '^[a-f0-9]{64}$')
     ),
     CONSTRAINT internal_production_owner_reservation_payloads_check CHECK (
       jsonb_typeof(reservation_payload) = 'object'
       AND (canonical_owner_identity IS NULL
         OR jsonb_typeof(canonical_owner_identity) = 'object')
       AND (binding_payload IS NULL OR jsonb_typeof(binding_payload) = 'object')
       AND (close_payload IS NULL OR jsonb_typeof(close_payload) = 'object')
     ),
     CONSTRAINT internal_production_owner_reservation_state_check CHECK (
       state IN ('pending', 'bound', 'closed')
       AND (close_kind IS NULL OR close_kind IN ('ordinary', 'fence-target'))
       AND head_version >= 0
     ),
     CONSTRAINT internal_production_owner_reservation_terminal_owner_pair_check CHECK (
       (terminal_owner_ref IS NULL) = (terminal_owner_hash IS NULL)
     ),
     CONSTRAINT internal_prod_owner_reservation_preserved_fence_pair_check CHECK (
       (preserved_fence_ref IS NULL) = (preserved_fence_hash IS NULL)
     ),
     CONSTRAINT internal_production_owner_reservation_close_pair_check CHECK (
       (close_ref IS NULL) = (close_hash IS NULL)
     ),
     CONSTRAINT internal_production_owner_reservation_state_shape_check CHECK (
       (state = 'pending'
         AND canonical_owner_identity IS NULL
         AND binding_hash IS NULL
         AND binding_payload IS NULL
         AND close_kind IS NULL
         AND terminal_owner_ref IS NULL
         AND close_head_predecessor_hash IS NULL
         AND close_head_successor_hash IS NULL
         AND preserved_fence_ref IS NULL
         AND close_ref IS NULL
         AND close_payload IS NULL)
       OR (state = 'bound'
         AND canonical_owner_identity IS NOT NULL
         AND binding_hash IS NOT NULL
         AND binding_payload IS NOT NULL
         AND close_kind IS NULL
         AND terminal_owner_ref IS NULL
         AND close_head_predecessor_hash IS NULL
         AND close_head_successor_hash IS NULL
         AND preserved_fence_ref IS NULL
         AND close_ref IS NULL
         AND close_payload IS NULL)
       OR (state = 'closed'
         AND canonical_owner_identity IS NOT NULL
         AND binding_hash IS NOT NULL
         AND binding_payload IS NOT NULL
         AND close_kind IS NOT NULL
         AND terminal_owner_ref IS NOT NULL
         AND close_head_predecessor_hash IS NOT NULL
         AND close_head_successor_hash IS NOT NULL
         AND close_ref IS NOT NULL
         AND close_payload IS NOT NULL
         AND (close_kind = 'fence-target' OR preserved_fence_ref IS NULL))
     )
   )`,
  `CREATE TABLE public.internal_production_owner_admission_authorities_v1 (
     authority_ref TEXT NOT NULL,
     authority_hash TEXT NOT NULL,
     authority_kind TEXT NOT NULL,
     phase_key TEXT NOT NULL,
     predecessor_head_hash TEXT NOT NULL,
     successor_head_hash TEXT NOT NULL,
     authority_body JSONB NOT NULL,
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     CONSTRAINT internal_production_owner_admission_authority_pkey
       PRIMARY KEY (authority_ref),
     CONSTRAINT internal_production_owner_admission_authority_hash_unique
       UNIQUE (authority_hash),
     CONSTRAINT internal_production_owner_admission_authority_phase_unique
       UNIQUE (authority_kind, phase_key),
     CONSTRAINT internal_production_owner_admission_authority_hashes_check CHECK (
       authority_hash ~ '^[a-f0-9]{64}$'
       AND predecessor_head_hash ~ '^[a-f0-9]{64}$'
       AND successor_head_hash ~ '^[a-f0-9]{64}$'
     ),
     CONSTRAINT internal_production_owner_admission_authority_kind_check CHECK (
       authority_kind IN ('reservation', 'binding', 'close', 'fence', 'release')
     ),
     CONSTRAINT internal_production_owner_admission_authority_purpose_check CHECK (
       CASE WHEN authority_kind IN ('fence', 'release') THEN
         COALESCE(authority_body ->> 'purpose' IN (
           'golden-launch-operation-migration-release-v1',
           'recovery-d-physical-service-restart-authority-cutover-v1',
           'recovery-d-source-delivery-v1',
           'recovery-d-physical-service-restart-operation-v1'
         ), FALSE)
       ELSE TRUE END
     ),
     CONSTRAINT internal_production_owner_admission_authority_body_check CHECK (
       jsonb_typeof(authority_body) = 'object'
       AND CASE authority_kind
         WHEN 'reservation' THEN
           authority_body ->> 'schema' = 'setfarm.internal-production-owner-reservation.v1'
           AND authority_body ->> 'reservationRef' = authority_ref
           AND authority_body ->> 'reservationHash' = authority_hash
           AND authority_body ->> 'ownerAdmissionHeadPredecessorHash' = predecessor_head_hash
         WHEN 'binding' THEN
           authority_body ->> 'schema' = 'setfarm.internal-production-bound-owner-reservation.v1'
           AND authority_body ->> 'bindingHash' = authority_hash
         WHEN 'close' THEN
           authority_body ->> 'schema' = 'setfarm.internal-production-owner-reservation-close.v1'
           AND authority_body ->> 'closeRef' = authority_ref
           AND authority_body ->> 'closeHash' = authority_hash
           AND authority_body ->> 'ownerAdmissionHeadPredecessorHash' = predecessor_head_hash
           AND authority_body ->> 'ownerAdmissionHeadSuccessorHash' = successor_head_hash
         WHEN 'fence' THEN
           authority_body ->> 'schema' = 'setfarm.internal-production-global-owner-admission-fence.v1'
           AND authority_body ->> 'fenceRef' = authority_ref
           AND authority_body ->> 'fenceHash' = authority_hash
           AND authority_body ->> 'ownerAdmissionHeadHash' = successor_head_hash
           AND jsonb_typeof(authority_body -> 'targetFamily') = 'object'
         WHEN 'release' THEN
           authority_body ->> 'schema' = 'setfarm.internal-production-global-owner-admission-fence-release.v1'
           AND authority_body ->> 'releaseRef' = authority_ref
           AND authority_body ->> 'releaseHash' = authority_hash
           AND authority_body ->> 'ownerAdmissionHeadPredecessorHash' = predecessor_head_hash
           AND authority_body ->> 'ownerAdmissionHeadSuccessorHash' = successor_head_hash
           AND jsonb_typeof(authority_body -> 'releaseAuthority') = 'object'
         ELSE FALSE
       END
     )
   )`,
  `CREATE FUNCTION public.setfarm_forbid_internal_production_owner_admission_authority_mutation()
   RETURNS trigger
   LANGUAGE plpgsql
   SET search_path TO pg_catalog, public
   AS $function$
   BEGIN
     RAISE EXCEPTION 'INTERNAL_PRODUCTION_OWNER_ADMISSION_AUTHORITY_MUTATION_FORBIDDEN'
       USING ERRCODE = '55000';
   END
   $function$`,
  `CREATE TRIGGER trg_internal_production_owner_admission_authority_immutable
   BEFORE UPDATE OR DELETE
   ON public.internal_production_owner_admission_authorities_v1
   FOR EACH ROW
   EXECUTE FUNCTION public.setfarm_forbid_internal_production_owner_admission_authority_mutation()`,
  `CREATE TRIGGER trg_internal_production_owner_admission_authority_truncate_forbidden
   BEFORE TRUNCATE
   ON public.internal_production_owner_admission_authorities_v1
   FOR EACH STATEMENT
   EXECUTE FUNCTION public.setfarm_forbid_internal_production_owner_admission_authority_mutation()`,
  `CREATE TABLE public.internal_production_owner_admission_head_v1 (
     singleton BOOLEAN NOT NULL DEFAULT TRUE,
     head_version BIGINT NOT NULL,
     head_hash TEXT NOT NULL,
     active_fence_ref TEXT,
     active_fence_hash TEXT,
     active_target_family_hash TEXT,
     migration_application_evidence_hash TEXT NOT NULL,
     head_payload JSONB NOT NULL,
     updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     CONSTRAINT internal_production_owner_admission_head_pkey PRIMARY KEY (singleton),
     CONSTRAINT internal_production_owner_admission_head_shape_check CHECK (
       singleton
       AND head_version >= 0
       AND head_hash ~ '^[a-f0-9]{64}$'
       AND (active_fence_hash IS NULL OR active_fence_hash ~ '^[a-f0-9]{64}$')
       AND (active_target_family_hash IS NULL
         OR active_target_family_hash ~ '^[a-f0-9]{64}$')
       AND migration_application_evidence_hash ~ '^[a-f0-9]{64}$'
       AND jsonb_typeof(head_payload) = 'object'
     ),
     CONSTRAINT internal_production_owner_admission_head_fence_pair_check CHECK (
       (active_fence_ref IS NULL) = (active_fence_hash IS NULL)
     ),
     CONSTRAINT internal_production_owner_admission_head_target_check CHECK (
       active_target_family_hash IS NULL OR active_fence_ref IS NOT NULL
     )
   )`,
   `INSERT INTO public.internal_production_owner_admission_head_v1 (
     singleton, head_version, head_hash,
     active_fence_ref, active_fence_hash, active_target_family_hash,
     migration_application_evidence_hash, head_payload
   ) VALUES (
     TRUE, 0, '${"0".repeat(64)}', NULL, NULL, NULL,
     '${"0".repeat(64)}',
     '{"schema":"setfarm.internal-production-owner-admission-head.v1","version":0}'::jsonb
   )`,
  `CREATE FUNCTION public.ip_op_reject_immutable_v1()
   RETURNS trigger
   LANGUAGE plpgsql
   VOLATILE
   SECURITY INVOKER
   SET search_path = pg_catalog, public
   AS $function$
   BEGIN
     RAISE EXCEPTION USING
       ERRCODE = '55000',
       MESSAGE = 'IP_OWNER_PRODUCER_IMMUTABLE_MUTATION';
     RETURN NULL;
   END;
   $function$;`,
  `CREATE TABLE public.internal_production_owner_producer_source_build_authorities_v1 (
     source_build_authority_ref TEXT NOT NULL,
     source_build_authority_hash CHAR(64) NOT NULL,
     plan TEXT NOT NULL,
     manifest_hash CHAR(64) NOT NULL,
     owner_category_registry_hash CHAR(64) NOT NULL,
     owner_category_census_map_hash CHAR(64) NOT NULL,
     canonical_body TEXT NOT NULL,
     created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
     CONSTRAINT ip_op_sba_v1_pkey PRIMARY KEY (source_build_authority_ref),
     CONSTRAINT ip_op_sba_v1_hash_uq UNIQUE (source_build_authority_hash),
     CONSTRAINT ip_op_sba_v1_pair_uq UNIQUE (
       source_build_authority_ref, source_build_authority_hash
     ),
     CONSTRAINT ip_op_sba_v1_plan_ck CHECK (plan IN ('A','B','C','D','E')),
     CONSTRAINT ip_op_sba_v1_ref_ck CHECK (
       octet_length(source_build_authority_ref) BETWEEN 1 AND 512
     ),
     CONSTRAINT ip_op_sba_v1_hash_ck CHECK (
       source_build_authority_hash ~ '^[0-9a-f]{64}$'
       AND manifest_hash ~ '^[0-9a-f]{64}$'
       AND owner_category_registry_hash ~ '^[0-9a-f]{64}$'
       AND owner_category_census_map_hash ~ '^[0-9a-f]{64}$'
     ),
     CONSTRAINT ip_op_sba_v1_body_ck CHECK (
       jsonb_typeof(canonical_body::jsonb) = 'object'
       AND octet_length(canonical_body) BETWEEN 2 AND 65536
     )
   )`,
  `CREATE INDEX ip_op_sba_v1_plan_manifest_idx
     ON public.internal_production_owner_producer_source_build_authorities_v1
     USING btree (plan, manifest_hash)`,
  `CREATE TABLE public.internal_production_owner_producer_manifest_set_activations_v1 (
     activation_ref TEXT NOT NULL,
     activation_hash CHAR(64) NOT NULL,
     phase TEXT NOT NULL,
     manifest_set_hash CHAR(64) NOT NULL,
     owner_category_registry_hash CHAR(64) NOT NULL,
     owner_category_census_map_hash CHAR(64) NOT NULL,
     predecessor_activation_ref TEXT,
     predecessor_activation_hash CHAR(64),
     predecessor_head_ref TEXT,
     predecessor_head_hash CHAR(64),
     canonical_body TEXT NOT NULL,
     created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
     CONSTRAINT ip_op_msa_v1_pkey PRIMARY KEY (activation_ref),
     CONSTRAINT ip_op_msa_v1_hash_uq UNIQUE (activation_hash),
     CONSTRAINT ip_op_msa_v1_pair_uq UNIQUE (activation_ref, activation_hash),
     CONSTRAINT ip_op_msa_v1_phase_ck CHECK (
       phase IN ('A','A+B','A+B+C','A+B+C+D','A+B+C+D+E')
     ),
     CONSTRAINT ip_op_msa_v1_refs_ck CHECK (
       octet_length(activation_ref) BETWEEN 1 AND 512
       AND (predecessor_activation_ref IS NULL
         OR octet_length(predecessor_activation_ref) BETWEEN 1 AND 512)
       AND (predecessor_head_ref IS NULL
         OR octet_length(predecessor_head_ref) BETWEEN 1 AND 512)
     ),
     CONSTRAINT ip_op_msa_v1_hashes_ck CHECK (
       activation_hash ~ '^[0-9a-f]{64}$'
       AND manifest_set_hash ~ '^[0-9a-f]{64}$'
       AND owner_category_registry_hash ~ '^[0-9a-f]{64}$'
       AND owner_category_census_map_hash ~ '^[0-9a-f]{64}$'
       AND (predecessor_activation_hash IS NULL
         OR predecessor_activation_hash ~ '^[0-9a-f]{64}$')
       AND (predecessor_head_hash IS NULL
         OR predecessor_head_hash ~ '^[0-9a-f]{64}$')
     ),
     CONSTRAINT ip_op_msa_v1_body_ck CHECK (
       jsonb_typeof(canonical_body::jsonb) = 'object'
       AND octet_length(canonical_body) BETWEEN 2 AND 65536
     ),
     CONSTRAINT ip_op_msa_v1_pred_activation_pair_ck CHECK (
       (predecessor_activation_ref IS NULL) = (predecessor_activation_hash IS NULL)
     ),
     CONSTRAINT ip_op_msa_v1_pred_head_pair_ck CHECK (
       (predecessor_head_ref IS NULL) = (predecessor_head_hash IS NULL)
     ),
     CONSTRAINT ip_op_msa_v1_phase_pred_ck CHECK (
       (phase = 'A') = (
         predecessor_activation_ref IS NULL
         AND predecessor_activation_hash IS NULL
         AND predecessor_head_ref IS NULL
         AND predecessor_head_hash IS NULL
       )
     ),
     CONSTRAINT ip_op_msa_v1_pred_activation_fk FOREIGN KEY (
       predecessor_activation_ref, predecessor_activation_hash
     ) REFERENCES public.internal_production_owner_producer_manifest_set_activations_v1 (
       activation_ref, activation_hash
     ) MATCH SIMPLE ON UPDATE RESTRICT ON DELETE RESTRICT NOT DEFERRABLE
   )`,
  `CREATE INDEX ip_op_msa_v1_phase_manifest_idx
     ON public.internal_production_owner_producer_manifest_set_activations_v1
     USING btree (phase, manifest_set_hash)`,
  `CREATE INDEX ip_op_msa_v1_pred_activation_idx
     ON public.internal_production_owner_producer_manifest_set_activations_v1
     USING btree (predecessor_activation_ref, predecessor_activation_hash)
     WHERE predecessor_activation_ref IS NOT NULL`,
  `CREATE INDEX ip_op_msa_v1_pred_head_idx
     ON public.internal_production_owner_producer_manifest_set_activations_v1
     USING btree (predecessor_head_ref, predecessor_head_hash)
     WHERE predecessor_head_ref IS NOT NULL`,
  `CREATE TABLE public.internal_production_owner_producer_manifest_activation_heads_v1 (
     head_ref TEXT NOT NULL,
     head_hash CHAR(64) NOT NULL,
     phase TEXT NOT NULL,
     activation_ref TEXT NOT NULL,
     activation_hash CHAR(64) NOT NULL,
     predecessor_head_ref TEXT,
     predecessor_head_hash CHAR(64),
     canonical_body TEXT NOT NULL,
     created_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
     CONSTRAINT ip_op_mah_v1_pkey PRIMARY KEY (head_ref),
     CONSTRAINT ip_op_mah_v1_hash_uq UNIQUE (head_hash),
     CONSTRAINT ip_op_mah_v1_pair_uq UNIQUE (head_ref, head_hash),
     CONSTRAINT ip_op_mah_v1_activation_pair_uq UNIQUE (
       head_ref, head_hash, activation_ref, activation_hash
     ),
     CONSTRAINT ip_op_mah_v1_phase_ck CHECK (
       phase IN ('A','A+B','A+B+C','A+B+C+D','A+B+C+D+E')
     ),
     CONSTRAINT ip_op_mah_v1_refs_ck CHECK (
       octet_length(head_ref) BETWEEN 1 AND 512
       AND octet_length(activation_ref) BETWEEN 1 AND 512
       AND (predecessor_head_ref IS NULL
         OR octet_length(predecessor_head_ref) BETWEEN 1 AND 512)
     ),
     CONSTRAINT ip_op_mah_v1_hashes_ck CHECK (
       head_hash ~ '^[0-9a-f]{64}$'
       AND activation_hash ~ '^[0-9a-f]{64}$'
       AND (predecessor_head_hash IS NULL
         OR predecessor_head_hash ~ '^[0-9a-f]{64}$')
     ),
     CONSTRAINT ip_op_mah_v1_body_ck CHECK (
       jsonb_typeof(canonical_body::jsonb) = 'object'
       AND octet_length(canonical_body) BETWEEN 2 AND 65536
     ),
     CONSTRAINT ip_op_mah_v1_pred_pair_ck CHECK (
       (predecessor_head_ref IS NULL) = (predecessor_head_hash IS NULL)
     ),
     CONSTRAINT ip_op_mah_v1_phase_pred_ck CHECK (
       (phase = 'A') = (
         predecessor_head_ref IS NULL AND predecessor_head_hash IS NULL
       )
     ),
     CONSTRAINT ip_op_mah_v1_activation_fk FOREIGN KEY (
       activation_ref, activation_hash
     ) REFERENCES public.internal_production_owner_producer_manifest_set_activations_v1 (
       activation_ref, activation_hash
     ) MATCH SIMPLE ON UPDATE RESTRICT ON DELETE RESTRICT NOT DEFERRABLE,
     CONSTRAINT ip_op_mah_v1_pred_head_fk FOREIGN KEY (
       predecessor_head_ref, predecessor_head_hash
     ) REFERENCES public.internal_production_owner_producer_manifest_activation_heads_v1 (
       head_ref, head_hash
     ) MATCH SIMPLE ON UPDATE RESTRICT ON DELETE RESTRICT NOT DEFERRABLE
   )`,
  `CREATE INDEX ip_op_mah_v1_phase_activation_idx
     ON public.internal_production_owner_producer_manifest_activation_heads_v1
     USING btree (phase, activation_ref, activation_hash)`,
  `CREATE INDEX ip_op_mah_v1_pred_head_idx
     ON public.internal_production_owner_producer_manifest_activation_heads_v1
     USING btree (predecessor_head_ref, predecessor_head_hash)
     WHERE predecessor_head_ref IS NOT NULL`,
  `ALTER TABLE public.internal_production_owner_producer_manifest_set_activations_v1
     ADD CONSTRAINT ip_op_msa_v1_pred_head_fk FOREIGN KEY (
       predecessor_head_ref, predecessor_head_hash
     ) REFERENCES public.internal_production_owner_producer_manifest_activation_heads_v1 (
       head_ref, head_hash
     ) MATCH SIMPLE ON UPDATE RESTRICT ON DELETE RESTRICT NOT DEFERRABLE`,
  `CREATE TABLE public.internal_production_owner_producer_manifest_set_current_v1 (
     singleton_key BOOLEAN NOT NULL DEFAULT TRUE,
     current_revision BIGINT NOT NULL DEFAULT 0,
     phase TEXT,
     activation_ref TEXT,
     activation_hash CHAR(64),
     head_ref TEXT,
     head_hash CHAR(64),
     updated_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
     CONSTRAINT ip_op_msc_v1_pkey PRIMARY KEY (singleton_key),
     CONSTRAINT ip_op_msc_v1_singleton_ck CHECK (singleton_key IS TRUE),
     CONSTRAINT ip_op_msc_v1_revision_ck CHECK (current_revision >= 0),
     CONSTRAINT ip_op_msc_v1_phase_ck CHECK (
       phase IS NULL OR phase IN ('A','A+B','A+B+C','A+B+C+D','A+B+C+D+E')
     ),
     CONSTRAINT ip_op_msc_v1_shape_ck CHECK (
       (current_revision = 0
         AND phase IS NULL
         AND activation_ref IS NULL
         AND activation_hash IS NULL
         AND head_ref IS NULL
         AND head_hash IS NULL)
       OR (current_revision > 0
         AND phase IS NOT NULL
         AND activation_ref IS NOT NULL
         AND activation_hash IS NOT NULL
         AND head_ref IS NOT NULL
         AND head_hash IS NOT NULL)
     ),
     CONSTRAINT ip_op_msc_v1_refs_ck CHECK (
       (activation_ref IS NULL OR octet_length(activation_ref) BETWEEN 1 AND 512)
       AND (head_ref IS NULL OR octet_length(head_ref) BETWEEN 1 AND 512)
     ),
     CONSTRAINT ip_op_msc_v1_hashes_ck CHECK (
       (activation_hash IS NULL OR activation_hash ~ '^[0-9a-f]{64}$')
       AND (head_hash IS NULL OR head_hash ~ '^[0-9a-f]{64}$')
     ),
     CONSTRAINT ip_op_msc_v1_activation_fk FOREIGN KEY (
       activation_ref, activation_hash
     ) REFERENCES public.internal_production_owner_producer_manifest_set_activations_v1 (
       activation_ref, activation_hash
     ) MATCH SIMPLE ON UPDATE RESTRICT ON DELETE RESTRICT NOT DEFERRABLE,
     CONSTRAINT ip_op_msc_v1_head_activation_fk FOREIGN KEY (
       head_ref, head_hash, activation_ref, activation_hash
     ) REFERENCES public.internal_production_owner_producer_manifest_activation_heads_v1 (
       head_ref, head_hash, activation_ref, activation_hash
     ) MATCH SIMPLE ON UPDATE RESTRICT ON DELETE RESTRICT NOT DEFERRABLE
   )`,
  `INSERT INTO public.internal_production_owner_producer_manifest_set_current_v1 (
     singleton_key, current_revision, phase, activation_ref, activation_hash,
     head_ref, head_hash, updated_at
   ) VALUES (TRUE, 0, NULL, NULL, NULL, NULL, NULL, transaction_timestamp())`,
  `CREATE FUNCTION public.ip_op_enforce_current_update_v1()
   RETURNS trigger
   LANGUAGE plpgsql
   VOLATILE
   SECURITY INVOKER
   SET search_path = pg_catalog, public
   AS $function$
   DECLARE
     target_activation public.internal_production_owner_producer_manifest_set_activations_v1%ROWTYPE;
     target_head public.internal_production_owner_producer_manifest_activation_heads_v1%ROWTYPE;
   BEGIN
     IF NEW.singleton_key IS DISTINCT FROM OLD.singleton_key
        OR NEW.singleton_key IS DISTINCT FROM TRUE
        OR NEW.current_revision IS DISTINCT FROM OLD.current_revision + 1 THEN
       RAISE EXCEPTION USING
         ERRCODE = '23514',
         MESSAGE = 'IP_OWNER_PRODUCER_CURRENT_TRANSITION_INVALID';
     END IF;

     IF NOT (
       (OLD.current_revision = 0 AND OLD.phase IS NULL AND NEW.phase = 'A')
       OR (OLD.phase = 'A' AND NEW.phase = 'A+B')
       OR (OLD.phase = 'A+B' AND NEW.phase = 'A+B+C')
       OR (OLD.phase = 'A+B+C' AND NEW.phase = 'A+B+C+D')
       OR (OLD.phase = 'A+B+C+D' AND NEW.phase = 'A+B+C+D+E')
     ) THEN
       RAISE EXCEPTION USING
         ERRCODE = '23514',
         MESSAGE = 'IP_OWNER_PRODUCER_CURRENT_TRANSITION_INVALID';
     END IF;

     SELECT * INTO STRICT target_activation
       FROM public.internal_production_owner_producer_manifest_set_activations_v1
      WHERE activation_ref = NEW.activation_ref
        AND activation_hash = NEW.activation_hash
      FOR KEY SHARE;
     SELECT * INTO STRICT target_head
       FROM public.internal_production_owner_producer_manifest_activation_heads_v1
      WHERE head_ref = NEW.head_ref
        AND head_hash = NEW.head_hash
      FOR KEY SHARE;

     IF target_activation.phase IS DISTINCT FROM NEW.phase
        OR target_head.phase IS DISTINCT FROM NEW.phase
        OR target_head.activation_ref IS DISTINCT FROM NEW.activation_ref
        OR target_head.activation_hash IS DISTINCT FROM NEW.activation_hash THEN
       RAISE EXCEPTION USING
         ERRCODE = '23514',
         MESSAGE = 'IP_OWNER_PRODUCER_CURRENT_TRANSITION_INVALID';
     END IF;

     IF OLD.current_revision = 0 THEN
       IF target_activation.predecessor_activation_ref IS NOT NULL
          OR target_activation.predecessor_activation_hash IS NOT NULL
          OR target_activation.predecessor_head_ref IS NOT NULL
          OR target_activation.predecessor_head_hash IS NOT NULL
          OR target_head.predecessor_head_ref IS NOT NULL
          OR target_head.predecessor_head_hash IS NOT NULL THEN
         RAISE EXCEPTION USING
           ERRCODE = '23514',
           MESSAGE = 'IP_OWNER_PRODUCER_CURRENT_TRANSITION_INVALID';
       END IF;
     ELSIF target_activation.predecessor_activation_ref IS DISTINCT FROM OLD.activation_ref
        OR target_activation.predecessor_activation_hash IS DISTINCT FROM OLD.activation_hash
        OR target_activation.predecessor_head_ref IS DISTINCT FROM OLD.head_ref
        OR target_activation.predecessor_head_hash IS DISTINCT FROM OLD.head_hash
        OR target_head.predecessor_head_ref IS DISTINCT FROM OLD.head_ref
        OR target_head.predecessor_head_hash IS DISTINCT FROM OLD.head_hash THEN
       RAISE EXCEPTION USING
         ERRCODE = '23514',
         MESSAGE = 'IP_OWNER_PRODUCER_CURRENT_TRANSITION_INVALID';
     END IF;

     NEW.updated_at := transaction_timestamp();
     RETURN NEW;
   EXCEPTION
     WHEN NO_DATA_FOUND THEN
       RAISE EXCEPTION USING
         ERRCODE = '23503',
         MESSAGE = 'IP_OWNER_PRODUCER_CURRENT_TARGET_MISSING';
     WHEN TOO_MANY_ROWS THEN
       RAISE EXCEPTION USING
         ERRCODE = '21000',
         MESSAGE = 'IP_OWNER_PRODUCER_CURRENT_TARGET_NONUNIQUE';
   END;
   $function$;`,
  `CREATE TRIGGER ip_op_sba_v1_immutable_trg
   BEFORE UPDATE OR DELETE OR TRUNCATE
   ON public.internal_production_owner_producer_source_build_authorities_v1
   FOR EACH STATEMENT EXECUTE FUNCTION public.ip_op_reject_immutable_v1();`,
  `CREATE TRIGGER ip_op_msa_v1_immutable_trg
   BEFORE UPDATE OR DELETE OR TRUNCATE
   ON public.internal_production_owner_producer_manifest_set_activations_v1
   FOR EACH STATEMENT EXECUTE FUNCTION public.ip_op_reject_immutable_v1();`,
  `CREATE TRIGGER ip_op_mah_v1_immutable_trg
   BEFORE UPDATE OR DELETE OR TRUNCATE
   ON public.internal_production_owner_producer_manifest_activation_heads_v1
   FOR EACH STATEMENT EXECUTE FUNCTION public.ip_op_reject_immutable_v1();`,
  `CREATE TRIGGER ip_op_msc_v1_delete_truncate_trg
   BEFORE DELETE OR TRUNCATE
   ON public.internal_production_owner_producer_manifest_set_current_v1
   FOR EACH STATEMENT EXECUTE FUNCTION public.ip_op_reject_immutable_v1();`,
  `CREATE TRIGGER ip_op_msc_v1_update_trg
   BEFORE UPDATE
   ON public.internal_production_owner_producer_manifest_set_current_v1
   FOR EACH ROW EXECUTE FUNCTION public.ip_op_enforce_current_update_v1();`,
] as const);
// SETFARM_SEMANTIC_MIGRATION_REGION:migration-v32-identity-and-statements:END

// SETFARM_SEMANTIC_MIGRATION_REGION:migration-v32-activation-catalog-authority:BEGIN
export const EXPECTED_IP_OP_FUNCTION_CATALOG_DEFS_V1 = Object.freeze({
  ip_op_enforce_current_update_v1:
    `create or replace function public.ip_op_enforce_current_update_v1() returns trigger language plpgsql set search_path to 'pg_catalog', 'public' as $function$
   DECLARE
     target_activation public.internal_production_owner_producer_manifest_set_activations_v1%ROWTYPE;
     target_head public.internal_production_owner_producer_manifest_activation_heads_v1%ROWTYPE;
   BEGIN
     IF NEW.singleton_key IS DISTINCT FROM OLD.singleton_key
        OR NEW.singleton_key IS DISTINCT FROM TRUE
        OR NEW.current_revision IS DISTINCT FROM OLD.current_revision + 1 THEN
       RAISE EXCEPTION USING
         ERRCODE = '23514',
         MESSAGE = 'IP_OWNER_PRODUCER_CURRENT_TRANSITION_INVALID';
     END IF;

     IF NOT (
       (OLD.current_revision = 0 AND OLD.phase IS NULL AND NEW.phase = 'A')
       OR (OLD.phase = 'A' AND NEW.phase = 'A+B')
       OR (OLD.phase = 'A+B' AND NEW.phase = 'A+B+C')
       OR (OLD.phase = 'A+B+C' AND NEW.phase = 'A+B+C+D')
       OR (OLD.phase = 'A+B+C+D' AND NEW.phase = 'A+B+C+D+E')
     ) THEN
       RAISE EXCEPTION USING
         ERRCODE = '23514',
         MESSAGE = 'IP_OWNER_PRODUCER_CURRENT_TRANSITION_INVALID';
     END IF;

     SELECT * INTO STRICT target_activation
       FROM public.internal_production_owner_producer_manifest_set_activations_v1
      WHERE activation_ref = NEW.activation_ref
        AND activation_hash = NEW.activation_hash
      FOR KEY SHARE;
     SELECT * INTO STRICT target_head
       FROM public.internal_production_owner_producer_manifest_activation_heads_v1
      WHERE head_ref = NEW.head_ref
        AND head_hash = NEW.head_hash
      FOR KEY SHARE;

     IF target_activation.phase IS DISTINCT FROM NEW.phase
        OR target_head.phase IS DISTINCT FROM NEW.phase
        OR target_head.activation_ref IS DISTINCT FROM NEW.activation_ref
        OR target_head.activation_hash IS DISTINCT FROM NEW.activation_hash THEN
       RAISE EXCEPTION USING
         ERRCODE = '23514',
         MESSAGE = 'IP_OWNER_PRODUCER_CURRENT_TRANSITION_INVALID';
     END IF;

     IF OLD.current_revision = 0 THEN
       IF target_activation.predecessor_activation_ref IS NOT NULL
          OR target_activation.predecessor_activation_hash IS NOT NULL
          OR target_activation.predecessor_head_ref IS NOT NULL
          OR target_activation.predecessor_head_hash IS NOT NULL
          OR target_head.predecessor_head_ref IS NOT NULL
          OR target_head.predecessor_head_hash IS NOT NULL THEN
         RAISE EXCEPTION USING
           ERRCODE = '23514',
           MESSAGE = 'IP_OWNER_PRODUCER_CURRENT_TRANSITION_INVALID';
       END IF;
     ELSIF target_activation.predecessor_activation_ref IS DISTINCT FROM OLD.activation_ref
        OR target_activation.predecessor_activation_hash IS DISTINCT FROM OLD.activation_hash
        OR target_activation.predecessor_head_ref IS DISTINCT FROM OLD.head_ref
        OR target_activation.predecessor_head_hash IS DISTINCT FROM OLD.head_hash
        OR target_head.predecessor_head_ref IS DISTINCT FROM OLD.head_ref
        OR target_head.predecessor_head_hash IS DISTINCT FROM OLD.head_hash THEN
       RAISE EXCEPTION USING
         ERRCODE = '23514',
         MESSAGE = 'IP_OWNER_PRODUCER_CURRENT_TRANSITION_INVALID';
     END IF;

     NEW.updated_at := transaction_timestamp();
     RETURN NEW;
   EXCEPTION
     WHEN NO_DATA_FOUND THEN
       RAISE EXCEPTION USING
         ERRCODE = '23503',
         MESSAGE = 'IP_OWNER_PRODUCER_CURRENT_TARGET_MISSING';
     WHEN TOO_MANY_ROWS THEN
       RAISE EXCEPTION USING
         ERRCODE = '21000',
         MESSAGE = 'IP_OWNER_PRODUCER_CURRENT_TARGET_NONUNIQUE';
   END;
   $function$`,
  ip_op_reject_immutable_v1:
    `create or replace function public.ip_op_reject_immutable_v1() returns trigger language plpgsql set search_path to 'pg_catalog', 'public' as $function$
   BEGIN
     RAISE EXCEPTION USING
       ERRCODE = '55000',
       MESSAGE = 'IP_OWNER_PRODUCER_IMMUTABLE_MUTATION';
     RETURN NULL;
   END;
   $function$`,
} as const);

export const EXPECTED_IP_OP_TRIGGER_CATALOG_DEFS_V1 = Object.freeze({
  ip_op_mah_v1_immutable_trg:
    "create trigger ip_op_mah_v1_immutable_trg before delete or update or truncate on internal_production_owner_producer_manifest_activation_heads_v1 for each statement execute function ip_op_reject_immutable_v1()",
  ip_op_msa_v1_immutable_trg:
    "create trigger ip_op_msa_v1_immutable_trg before delete or update or truncate on internal_production_owner_producer_manifest_set_activations_v1 for each statement execute function ip_op_reject_immutable_v1()",
  ip_op_msc_v1_delete_truncate_trg:
    "create trigger ip_op_msc_v1_delete_truncate_trg before delete or truncate on internal_production_owner_producer_manifest_set_current_v1 for each statement execute function ip_op_reject_immutable_v1()",
  ip_op_msc_v1_update_trg:
    "create trigger ip_op_msc_v1_update_trg before update on internal_production_owner_producer_manifest_set_current_v1 for each row execute function ip_op_enforce_current_update_v1()",
  ip_op_sba_v1_immutable_trg:
    "create trigger ip_op_sba_v1_immutable_trg before delete or update or truncate on internal_production_owner_producer_source_build_authorities_v1 for each statement execute function ip_op_reject_immutable_v1()",
} as const);

const EXPECTED_IP_OP_FUNCTION_DEPENDENCIES_V1 = Object.freeze([
  Object.freeze({
    proname: "ip_op_enforce_current_update_v1",
    deptype: "n",
    refobjsubid: 0,
    refclassid: "pg_language",
    referenced: "plpgsql",
  }),
  Object.freeze({
    proname: "ip_op_enforce_current_update_v1",
    deptype: "n",
    refobjsubid: 0,
    refclassid: "pg_namespace",
    referenced: "public",
  }),
  Object.freeze({
    proname: "ip_op_reject_immutable_v1",
    deptype: "n",
    refobjsubid: 0,
    refclassid: "pg_language",
    referenced: "plpgsql",
  }),
  Object.freeze({
    proname: "ip_op_reject_immutable_v1",
    deptype: "n",
    refobjsubid: 0,
    refclassid: "pg_namespace",
    referenced: "public",
  }),
] as const);
// SETFARM_SEMANTIC_MIGRATION_REGION:migration-v32-activation-catalog-authority:END

// SETFARM_SEMANTIC_MIGRATION_REGION:migration-v32-schema-projector:BEGIN
const BOOTSTRAP_HANDOFF_OPERATION_TABLE =
  "internal_production_bootstrap_main_claim_handoff_operations_v1";
const OWNER_RESERVATION_TABLE = "internal_production_owner_reservations_v1";
const OWNER_ADMISSION_AUTHORITY_TABLE = "internal_production_owner_admission_authorities_v1";
const OWNER_ADMISSION_HEAD_TABLE = "internal_production_owner_admission_head_v1";
const OWNER_PRODUCER_SOURCE_BUILD_AUTHORITY_TABLE =
  "internal_production_owner_producer_source_build_authorities_v1";
const OWNER_PRODUCER_MANIFEST_SET_ACTIVATION_TABLE =
  "internal_production_owner_producer_manifest_set_activations_v1";
const OWNER_PRODUCER_MANIFEST_ACTIVATION_HEAD_TABLE =
  "internal_production_owner_producer_manifest_activation_heads_v1";
const OWNER_PRODUCER_MANIFEST_SET_CURRENT_TABLE =
  "internal_production_owner_producer_manifest_set_current_v1";

const EXPECTED_COLUMNS = Object.freeze({
  [BOOTSTRAP_HANDOFF_OPERATION_TABLE]: Object.freeze([
    "bootstrap_handoff_operation_id",
    "continuation_grant_ref",
    "continuation_grant_hash",
    "bootstrap_settlement_ref",
    "bootstrap_settlement_hash",
    "migration_receipt_ref",
    "migration_receipt_hash",
    "claim_id",
    "phase",
    "expected_predecessor_phase",
    "worktree_identity_hash",
    "terminal_receipt_ref",
    "terminal_receipt_hash",
    "failure_code",
    "release_receipt_ref",
    "release_receipt_hash",
    "released_at",
    "created_at",
    "updated_at",
  ]),
  [OWNER_RESERVATION_TABLE]: Object.freeze([
    "reservation_ref",
    "reservation_hash",
    "category",
    "owner_key",
    "owner_key_hash",
    "producer_purpose_hash",
    "producer_implementation_id",
    "producer_implementation_hash",
    "reservation_payload",
    "reservation_head_predecessor_hash",
    "state",
    "canonical_owner_identity",
    "binding_hash",
    "binding_payload",
    "close_kind",
    "terminal_owner_ref",
    "terminal_owner_hash",
    "close_head_predecessor_hash",
    "close_head_successor_hash",
    "preserved_fence_ref",
    "preserved_fence_hash",
    "close_ref",
    "close_hash",
    "close_payload",
    "head_version",
    "created_at",
    "updated_at",
  ]),
  [OWNER_ADMISSION_AUTHORITY_TABLE]: Object.freeze([
    "authority_ref",
    "authority_hash",
    "authority_kind",
    "phase_key",
    "predecessor_head_hash",
    "successor_head_hash",
    "authority_body",
    "created_at",
  ]),
  [OWNER_ADMISSION_HEAD_TABLE]: Object.freeze([
    "singleton",
    "head_version",
    "head_hash",
    "active_fence_ref",
    "active_fence_hash",
    "active_target_family_hash",
    "migration_application_evidence_hash",
    "head_payload",
    "updated_at",
  ]),
  [OWNER_PRODUCER_SOURCE_BUILD_AUTHORITY_TABLE]: Object.freeze([
    "source_build_authority_ref",
    "source_build_authority_hash",
    "plan",
    "manifest_hash",
    "owner_category_registry_hash",
    "owner_category_census_map_hash",
    "canonical_body",
    "created_at",
  ]),
  [OWNER_PRODUCER_MANIFEST_SET_ACTIVATION_TABLE]: Object.freeze([
    "activation_ref",
    "activation_hash",
    "phase",
    "manifest_set_hash",
    "owner_category_registry_hash",
    "owner_category_census_map_hash",
    "predecessor_activation_ref",
    "predecessor_activation_hash",
    "predecessor_head_ref",
    "predecessor_head_hash",
    "canonical_body",
    "created_at",
  ]),
  [OWNER_PRODUCER_MANIFEST_ACTIVATION_HEAD_TABLE]: Object.freeze([
    "head_ref",
    "head_hash",
    "phase",
    "activation_ref",
    "activation_hash",
    "predecessor_head_ref",
    "predecessor_head_hash",
    "canonical_body",
    "created_at",
  ]),
  [OWNER_PRODUCER_MANIFEST_SET_CURRENT_TABLE]: Object.freeze([
    "singleton_key",
    "current_revision",
    "phase",
    "activation_ref",
    "activation_hash",
    "head_ref",
    "head_hash",
    "updated_at",
  ]),
} as const);

export type BootstrapMainClaimHandoffV1SchemaState =
  | "absent"
  | "present"
  | "partial";

export type BootstrapMainClaimHandoffV1SchemaProjection = Readonly<{
  schema: "setfarm.bootstrap-main-claim-handoff-schema-projection.v1";
  migrationId: typeof BOOTSTRAP_MAIN_CLAIM_HANDOFF_V1_MIGRATION_ID;
  migrationOrdinal: typeof BOOTSTRAP_MAIN_CLAIM_HANDOFF_V1_MIGRATION_ORDINAL;
  bootstrapHandoffOperationTablePresent: true;
  bootstrapHandoffOperationIdUnique: true;
  bootstrapHandoffClaimIdUnique: true;
  terminalReceiptPairColumnsPresent: true;
  ownerReservationSidecarPresent: true;
  ownerAdmissionHeadPresent: true;
}>;

export class BootstrapMainClaimHandoffV1SchemaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BootstrapMainClaimHandoffV1SchemaError";
  }
}

async function existingRelations(sql: Sql): Promise<Set<string>> {
  const rows = await sql.unsafe<Array<{ relation_name: string }>>(
    `SELECT c.relname AS relation_name
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = ANY($1::text[])
      ORDER BY c.relname`,
    [[
      BOOTSTRAP_HANDOFF_OPERATION_TABLE,
      OWNER_RESERVATION_TABLE,
      OWNER_ADMISSION_AUTHORITY_TABLE,
      OWNER_ADMISSION_HEAD_TABLE,
      OWNER_PRODUCER_SOURCE_BUILD_AUTHORITY_TABLE,
      OWNER_PRODUCER_MANIFEST_SET_ACTIVATION_TABLE,
      OWNER_PRODUCER_MANIFEST_ACTIVATION_HEAD_TABLE,
      OWNER_PRODUCER_MANIFEST_SET_CURRENT_TABLE,
    ]],
  );
  return new Set(rows.map((row) => row.relation_name));
}

function normalizeCatalogSql(source: string): string {
  let normalized = "";
  let pendingWhitespace = false;
  let index = 0;
  const appendQuoted = (end: number): void => {
    if (pendingWhitespace && normalized.length > 0) normalized += " ";
    normalized += source.slice(index, end);
    pendingWhitespace = false;
    index = end;
  };
  while (index < source.length) {
    const character = source[index]!;
    if (/\s/.test(character)) {
      pendingWhitespace = normalized.length > 0;
      index += 1;
      continue;
    }
    if (character === "'") {
      let end = index + 1;
      while (end < source.length) {
        if (source[end] !== "'") {
          end += 1;
          continue;
        }
        if (source[end + 1] === "'") {
          end += 2;
          continue;
        }
        end += 1;
        break;
      }
      appendQuoted(end);
      continue;
    }
    if (character === '"') {
      let end = index + 1;
      while (end < source.length) {
        if (source[end] !== '"') {
          end += 1;
          continue;
        }
        if (source[end + 1] === '"') {
          end += 2;
          continue;
        }
        end += 1;
        break;
      }
      appendQuoted(end);
      continue;
    }
    if (character === "$") {
      const delimiter = source.slice(index).match(/^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/)?.[0];
      if (delimiter !== undefined) {
        const closing = source.indexOf(delimiter, index + delimiter.length);
        if (closing >= 0) {
          appendQuoted(closing + delimiter.length);
          continue;
        }
      }
    }
    if (pendingWhitespace && normalized.length > 0) normalized += " ";
    normalized += character.toLowerCase();
    pendingWhitespace = false;
    index += 1;
  }
  return normalized;
}

async function assertExactOwnerProducerActivationCatalogV1(sql: Sql): Promise<void> {
  const functions = await sql.unsafe<Array<{
    namespace: string;
    proname: string;
    prokind: string;
    pronargs: number;
    proargtypes: string;
    proallargtypes: null;
    proargmodes: null;
    proargnames: null;
    pronargdefaults: number;
    provariadic_is_zero: boolean;
    rettype: string;
    language: string;
    provolatile: string;
    prosecdef: boolean;
    proconfig: string[] | null;
    proacl: null;
    definition: string;
  }>>(
    `SELECT n.nspname AS namespace, p.proname, p.prokind, p.pronargs,
            p.proargtypes::text AS proargtypes,
            p.proallargtypes, p.proargmodes, p.proargnames,
            p.pronargdefaults, p.provariadic = 0 AS provariadic_is_zero,
            p.prorettype::regtype::text AS rettype,
            l.lanname AS language, p.provolatile, p.prosecdef,
            p.proconfig, p.proacl, pg_get_functiondef(p.oid) AS definition
       FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
       JOIN pg_language l ON l.oid = p.prolang
      WHERE n.nspname = 'public'
        AND p.proname = ANY($1::text[])
      ORDER BY p.proname`,
    [["ip_op_enforce_current_update_v1", "ip_op_reject_immutable_v1"]],
  );
  const functionProjection = functions.map((row) => ({
    ...row,
    definition: normalizeCatalogSql(row.definition),
  }));
  const expectedFunctions = [
    "ip_op_enforce_current_update_v1",
    "ip_op_reject_immutable_v1",
  ].map((proname) => ({
    namespace: "public",
    proname,
    prokind: "f",
    pronargs: 0,
    proargtypes: "",
    proallargtypes: null,
    proargmodes: null,
    proargnames: null,
    pronargdefaults: 0,
    provariadic_is_zero: true,
    rettype: "trigger",
    language: "plpgsql",
    provolatile: "v",
    prosecdef: false,
    proconfig: ["search_path=pg_catalog, public"],
    proacl: null,
    definition: EXPECTED_IP_OP_FUNCTION_CATALOG_DEFS_V1[
      proname as keyof typeof EXPECTED_IP_OP_FUNCTION_CATALOG_DEFS_V1
    ],
  }));
  if (JSON.stringify(functionProjection) !== JSON.stringify(expectedFunctions)) {
    throw new BootstrapMainClaimHandoffV1SchemaError(
      "owner-producer activation function catalog mismatch",
    );
  }

  const dependencies = await sql.unsafe<Array<{
    proname: string;
    deptype: string;
    refobjsubid: number;
    refclassid: string;
    referenced: string;
  }>>(
    `SELECT p.proname, d.deptype, d.refobjsubid,
            d.refclassid::regclass::text AS refclassid,
            CASE
              WHEN d.refclassid = 'pg_language'::regclass THEN l.lanname
              WHEN d.refclassid = 'pg_namespace'::regclass THEN rn.nspname
              ELSE d.refobjid::text
            END AS referenced
       FROM pg_proc p
       JOIN pg_namespace pn ON pn.oid = p.pronamespace
       JOIN pg_depend d
         ON d.classid = 'pg_proc'::regclass
        AND d.objid = p.oid
        AND d.objsubid = 0
       LEFT JOIN pg_language l
         ON d.refclassid = 'pg_language'::regclass AND l.oid = d.refobjid
       LEFT JOIN pg_namespace rn
         ON d.refclassid = 'pg_namespace'::regclass AND rn.oid = d.refobjid
      WHERE pn.nspname = 'public'
        AND p.proname = ANY($1::text[])
      ORDER BY p.proname, refclassid, referenced`,
    [["ip_op_enforce_current_update_v1", "ip_op_reject_immutable_v1"]],
  );
  if (JSON.stringify(dependencies) !== JSON.stringify(EXPECTED_IP_OP_FUNCTION_DEPENDENCIES_V1)) {
    throw new BootstrapMainClaimHandoffV1SchemaError(
      "owner-producer activation function dependency catalog mismatch",
    );
  }

  const triggers = await sql.unsafe<Array<{
    name: string;
    relation: string;
    function_name: string;
    tgtype: number;
    tgenabled: string;
    tgisinternal: boolean;
    parent_zero: boolean;
    constraint_zero: boolean;
    tgdeferrable: boolean;
    tginitdeferred: boolean;
    tgattr: string;
    tgnargs: number;
    tgargs_length: number;
    qual_null: boolean;
    tgoldtable: null;
    tgnewtable: null;
    definition: string;
  }>>(
    `SELECT t.tgname AS name, c.relname AS relation,
            p.proname AS function_name, t.tgtype, t.tgenabled,
            t.tgisinternal, t.tgparentid = 0 AS parent_zero,
            t.tgconstraint = 0 AS constraint_zero,
            t.tgdeferrable, t.tginitdeferred, t.tgattr::text AS tgattr,
            t.tgnargs, octet_length(t.tgargs) AS tgargs_length,
            t.tgqual IS NULL AS qual_null, t.tgoldtable, t.tgnewtable,
            pg_get_triggerdef(t.oid, true) AS definition
       FROM pg_trigger t
       JOIN pg_class c ON c.oid = t.tgrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
       JOIN pg_proc p ON p.oid = t.tgfoid
      WHERE n.nspname = 'public'
        AND c.relname = ANY($1::text[])
        AND NOT t.tgisinternal
      ORDER BY t.tgname`,
    [[
      OWNER_PRODUCER_SOURCE_BUILD_AUTHORITY_TABLE,
      OWNER_PRODUCER_MANIFEST_SET_ACTIVATION_TABLE,
      OWNER_PRODUCER_MANIFEST_ACTIVATION_HEAD_TABLE,
      OWNER_PRODUCER_MANIFEST_SET_CURRENT_TABLE,
    ]],
  );
  const triggerProjection = triggers.map((row) => ({
    ...row,
    definition: normalizeCatalogSql(row.definition),
  }));
  const expectedTriggers = [
    ["ip_op_mah_v1_immutable_trg", OWNER_PRODUCER_MANIFEST_ACTIVATION_HEAD_TABLE,
      "ip_op_reject_immutable_v1", 58],
    ["ip_op_msa_v1_immutable_trg", OWNER_PRODUCER_MANIFEST_SET_ACTIVATION_TABLE,
      "ip_op_reject_immutable_v1", 58],
    ["ip_op_msc_v1_delete_truncate_trg", OWNER_PRODUCER_MANIFEST_SET_CURRENT_TABLE,
      "ip_op_reject_immutable_v1", 42],
    ["ip_op_msc_v1_update_trg", OWNER_PRODUCER_MANIFEST_SET_CURRENT_TABLE,
      "ip_op_enforce_current_update_v1", 19],
    ["ip_op_sba_v1_immutable_trg", OWNER_PRODUCER_SOURCE_BUILD_AUTHORITY_TABLE,
      "ip_op_reject_immutable_v1", 58],
  ].map(([name, relation, function_name, tgtype]) => ({
    name,
    relation,
    function_name,
    tgtype,
    tgenabled: "O",
    tgisinternal: false,
    parent_zero: true,
    constraint_zero: true,
    tgdeferrable: false,
    tginitdeferred: false,
    tgattr: "",
    tgnargs: 0,
    tgargs_length: 0,
    qual_null: true,
    tgoldtable: null,
    tgnewtable: null,
    definition: EXPECTED_IP_OP_TRIGGER_CATALOG_DEFS_V1[
      name as keyof typeof EXPECTED_IP_OP_TRIGGER_CATALOG_DEFS_V1
    ],
  }));
  if (JSON.stringify(triggerProjection) !== JSON.stringify(expectedTriggers)) {
    throw new BootstrapMainClaimHandoffV1SchemaError(
      "owner-producer activation trigger catalog mismatch",
    );
  }
}

const EXPECTED_RELATION_METADATA_HASHES = Object.freeze({
  [BOOTSTRAP_HANDOFF_OPERATION_TABLE]: "b8ba5b2d4a39e85300a9ced031f62a19b14aaf415e6d1144df3110ee432aaf82",
  [OWNER_RESERVATION_TABLE]: "dfd68d29ea41810f6f75bac0dc16067147afab9d8a4d5f619a4767051b4954b1",
  [OWNER_ADMISSION_AUTHORITY_TABLE]: "a18d5135cdd0d3cbb63d71e1ad28a0f69871d79d5fbb232c5586283fa7fc29b2",
  [OWNER_ADMISSION_HEAD_TABLE]: "c73bea41c46b00dee7912ffc848a7f8c3822a6bd03f8f1b18441156de4412fc0",
  [OWNER_PRODUCER_SOURCE_BUILD_AUTHORITY_TABLE]: "3666aedb09ff8ba5f84b923f2a7b8c3e9136b9a67663f5ac6f1ac0b2e34f65f0",
  [OWNER_PRODUCER_MANIFEST_SET_ACTIVATION_TABLE]: "bcfab408c29b74d6c07030b5e56469d35d81b53bf7599bb02bcb6270d8d2bb87",
  [OWNER_PRODUCER_MANIFEST_ACTIVATION_HEAD_TABLE]: "69a58bae4d755cf6cf9892b0484d672df66349413e2e36d10e89d46c99a293e9",
  [OWNER_PRODUCER_MANIFEST_SET_CURRENT_TABLE]: "22dd7ec548f21e8dc8a44a5ee20e4ca738c87ce79f0c91fc99271ccaafaea0d8",
} as const);

async function exactRelationMetadata(
  sql: Sql,
  relation: keyof typeof EXPECTED_COLUMNS,
): Promise<Readonly<Record<string, unknown>>> {
  const topologyRows = await sql.unsafe<Array<{
    relkind: string;
    relpersistence: string;
    relispartition: boolean;
    relrowsecurity: boolean;
    relforcerowsecurity: boolean;
    owner_exact: boolean;
    acl_exact: boolean;
    column_acl_exact: boolean;
    inheritance_edges: number;
    user_triggers: number;
    rewrite_rules: number;
    policies: number;
    incoming_foreign_keys: number;
  }>>(
    `SELECT c.relkind, c.relpersistence, c.relispartition,
            c.relrowsecurity, c.relforcerowsecurity,
            c.relowner = current_user::regrole AS owner_exact,
            c.relacl IS NULL AS acl_exact,
            NOT EXISTS (
              SELECT 1 FROM pg_attribute a
               WHERE a.attrelid = c.oid AND a.attacl IS NOT NULL
            ) AS column_acl_exact,
            (SELECT COUNT(*)::integer FROM pg_inherits i
              WHERE i.inhrelid = c.oid OR i.inhparent = c.oid) AS inheritance_edges,
            (SELECT COUNT(*)::integer FROM pg_trigger t
              WHERE t.tgrelid = c.oid AND NOT t.tgisinternal) AS user_triggers,
            (SELECT COUNT(*)::integer FROM pg_rewrite r
              WHERE r.ev_class = c.oid) AS rewrite_rules,
            (SELECT COUNT(*)::integer FROM pg_policy p
              WHERE p.polrelid = c.oid) AS policies,
            (SELECT COUNT(*)::integer FROM pg_constraint f
              WHERE f.contype = 'f' AND f.confrelid = c.oid
                AND f.conrelid <> c.oid) AS incoming_foreign_keys
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = $1`,
    [relation],
  );
  const columns = await sql.unsafe<Array<{
    name: string;
    type: string;
    not_null: boolean;
    default_expression: string | null;
    generated: string;
    identity: string;
    collation_schema: string | null;
    collation_name: string | null;
  }>>(
    `SELECT a.attname AS name,
            format_type(a.atttypid, a.atttypmod) AS type,
            a.attnotnull AS not_null,
            pg_get_expr(d.adbin, d.adrelid) AS default_expression,
            a.attgenerated AS generated,
            a.attidentity AS identity,
            cn.nspname AS collation_schema,
            co.collname AS collation_name
       FROM pg_attribute a
       JOIN pg_class c ON c.oid = a.attrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
       LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
       LEFT JOIN pg_collation co ON co.oid = NULLIF(a.attcollation, 0)
       LEFT JOIN pg_namespace cn ON cn.oid = co.collnamespace
      WHERE n.nspname = 'public' AND c.relname = $1
        AND a.attnum > 0 AND NOT a.attisdropped
      ORDER BY a.attnum`,
    [relation],
  );
  const constraints = await sql.unsafe<Array<{
    name: string;
    type: string;
    validated: boolean;
    deferrable: boolean;
    deferred: boolean;
    no_inherit: boolean;
    definition: string;
    non_catalog_function_dependencies: number;
    non_catalog_operator_dependencies: number;
  }>>(
    `SELECT con.conname AS name, con.contype AS type,
            con.convalidated AS validated,
            con.condeferrable AS deferrable,
            con.condeferred AS deferred,
            con.connoinherit AS no_inherit,
            pg_get_constraintdef(con.oid, true) AS definition,
            (SELECT COUNT(*)::integer
               FROM pg_depend d
               JOIN pg_proc p ON d.refclassid = 'pg_proc'::regclass
                AND p.oid = d.refobjid
               JOIN pg_namespace pn ON pn.oid = p.pronamespace
              WHERE d.classid = 'pg_constraint'::regclass
                AND d.objid = con.oid AND pn.nspname <> 'pg_catalog')
              AS non_catalog_function_dependencies,
            (SELECT COUNT(*)::integer
               FROM pg_depend d
               JOIN pg_operator o ON d.refclassid = 'pg_operator'::regclass
                AND o.oid = d.refobjid
               JOIN pg_namespace onsp ON onsp.oid = o.oprnamespace
              WHERE d.classid = 'pg_constraint'::regclass
                AND d.objid = con.oid AND onsp.nspname <> 'pg_catalog')
              AS non_catalog_operator_dependencies
       FROM pg_constraint con
      WHERE con.conrelid = $1::regclass AND con.contype <> 't'
      ORDER BY con.conname`,
    [`public.${relation}`],
  );
  const indexes = await sql.unsafe<Array<{
    name: string;
    definition: string;
    valid: boolean;
    ready: boolean;
    live: boolean;
    unique_index: boolean;
    immediate: boolean;
    replica_identity: boolean;
    no_predicate: boolean;
    no_expressions: boolean;
  }>>(
    `SELECT ic.relname AS name, pg_get_indexdef(i.indexrelid) AS definition,
            i.indisvalid AS valid, i.indisready AS ready, i.indislive AS live,
            i.indisunique AS unique_index, i.indimmediate AS immediate,
            i.indisreplident AS replica_identity,
            i.indpred IS NULL AS no_predicate,
            i.indexprs IS NULL AS no_expressions
       FROM pg_index i
       JOIN pg_class tc ON tc.oid = i.indrelid
       JOIN pg_namespace n ON n.oid = tc.relnamespace
       JOIN pg_class ic ON ic.oid = i.indexrelid
      WHERE n.nspname = 'public' AND tc.relname = $1
      ORDER BY ic.relname`,
    [relation],
  );
  const triggers = await sql.unsafe<Array<{
    name: string;
    enabled: string;
    definition: string;
    function_identity: string;
    function_definition: string;
  }>>(
    `SELECT t.tgname AS name, t.tgenabled AS enabled,
            pg_get_triggerdef(t.oid, true) AS definition,
            p.oid::regprocedure::text AS function_identity,
            pg_get_functiondef(p.oid) AS function_definition
       FROM pg_trigger t
       JOIN pg_class c ON c.oid = t.tgrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
       JOIN pg_proc p ON p.oid = t.tgfoid
      WHERE n.nspname = 'public' AND c.relname = $1
        AND NOT t.tgisinternal
      ORDER BY t.tgname`,
    [relation],
  );
  return Object.freeze({
    topology: topologyRows[0] ?? null,
    columns: columns.map((row) => ({
      ...row,
      default_expression: normalizeCatalogSql(row.default_expression ?? ""),
    })),
    constraints: constraints.map((row) => ({
      ...row,
      definition: normalizeCatalogSql(row.definition),
    })),
    indexes: indexes.map((row) => ({
      ...row,
      definition: normalizeCatalogSql(row.definition),
    })),
    triggers: triggers.map((row) => ({
      ...row,
      definition: normalizeCatalogSql(row.definition),
      function_definition: normalizeCatalogSql(row.function_definition),
    })),
  });
}

async function assertExactRelationMetadata(
  sql: Sql,
  relation: keyof typeof EXPECTED_RELATION_METADATA_HASHES,
): Promise<void> {
  const metadata = await exactRelationMetadata(sql, relation);
  const actualHash = createHash("sha256").update(JSON.stringify(metadata)).digest("hex");
  if (actualHash !== EXPECTED_RELATION_METADATA_HASHES[relation]) {
    throw new BootstrapMainClaimHandoffV1SchemaError(
      `bootstrap-main-claim handoff exact relation metadata mismatch: ${relation}:${actualHash}`,
    );
  }
}

export async function projectBootstrapMainClaimHandoffV1Schema(
  sql: Sql,
): Promise<BootstrapMainClaimHandoffV1SchemaProjection> {
  const relations = await existingRelations(sql);
  if (
    !relations.has(BOOTSTRAP_HANDOFF_OPERATION_TABLE)
    || !relations.has(OWNER_RESERVATION_TABLE)
    || !relations.has(OWNER_ADMISSION_AUTHORITY_TABLE)
    || !relations.has(OWNER_ADMISSION_HEAD_TABLE)
    || !relations.has(OWNER_PRODUCER_SOURCE_BUILD_AUTHORITY_TABLE)
    || !relations.has(OWNER_PRODUCER_MANIFEST_SET_ACTIVATION_TABLE)
    || !relations.has(OWNER_PRODUCER_MANIFEST_ACTIVATION_HEAD_TABLE)
    || !relations.has(OWNER_PRODUCER_MANIFEST_SET_CURRENT_TABLE)
  ) {
    throw new BootstrapMainClaimHandoffV1SchemaError(
      "bootstrap-main-claim handoff schema is not fully installed",
    );
  }
  for (const relation of [
    BOOTSTRAP_HANDOFF_OPERATION_TABLE,
    OWNER_RESERVATION_TABLE,
    OWNER_ADMISSION_AUTHORITY_TABLE,
    OWNER_ADMISSION_HEAD_TABLE,
    OWNER_PRODUCER_SOURCE_BUILD_AUTHORITY_TABLE,
    OWNER_PRODUCER_MANIFEST_SET_ACTIVATION_TABLE,
    OWNER_PRODUCER_MANIFEST_ACTIVATION_HEAD_TABLE,
    OWNER_PRODUCER_MANIFEST_SET_CURRENT_TABLE,
  ] as const) {
    await assertExactRelationMetadata(sql, relation);
  }
  await assertExactOwnerProducerActivationCatalogV1(sql);
  const head = await sql.unsafe<Array<{
    singleton: boolean;
    head_version: string | number;
    head_hash: string;
  }>>(
    `SELECT singleton, head_version, head_hash
       FROM public.internal_production_owner_admission_head_v1`,
  );
  if (
    head.length !== 1
    || head[0]?.singleton !== true
    || Number(head[0].head_version) < 0
    || !/^[a-f0-9]{64}$/.test(head[0].head_hash)
  ) {
    throw new BootstrapMainClaimHandoffV1SchemaError(
      "owner-admission head is not one valid singleton",
    );
  }
  const activationCurrent = await sql.unsafe<Array<{
    singleton_key: boolean;
    current_revision: string | number;
    phase: string | null;
    activation_ref: string | null;
    activation_hash: string | null;
    head_ref: string | null;
    head_hash: string | null;
  }>>(
    `SELECT singleton_key, current_revision, phase,
            activation_ref, activation_hash, head_ref, head_hash
       FROM public.internal_production_owner_producer_manifest_set_current_v1`,
  );
  const current = activationCurrent[0];
  const currentRevision = Number(current?.current_revision);
  const currentPairMembers = current === undefined
    ? []
    : [current.phase, current.activation_ref, current.activation_hash, current.head_ref, current.head_hash];
  const currentIsSeed = currentRevision === 0
    && currentPairMembers.every((member) => member === null);
  const currentIsActive = currentRevision > 0
    && currentPairMembers.every((member) => typeof member === "string" && member.length > 0);
  if (
    activationCurrent.length !== 1
    || current?.singleton_key !== true
    || !Number.isSafeInteger(currentRevision)
    || (!currentIsSeed && !currentIsActive)
  ) {
    throw new BootstrapMainClaimHandoffV1SchemaError(
      "owner-producer manifest activation current is not one valid singleton",
    );
  }
  return Object.freeze({
    schema: "setfarm.bootstrap-main-claim-handoff-schema-projection.v1" as const,
    migrationId: BOOTSTRAP_MAIN_CLAIM_HANDOFF_V1_MIGRATION_ID,
    migrationOrdinal: BOOTSTRAP_MAIN_CLAIM_HANDOFF_V1_MIGRATION_ORDINAL,
    bootstrapHandoffOperationTablePresent: true as const,
    bootstrapHandoffOperationIdUnique: true as const,
    bootstrapHandoffClaimIdUnique: true as const,
    terminalReceiptPairColumnsPresent: true as const,
    ownerReservationSidecarPresent: true as const,
    ownerAdmissionHeadPresent: true as const,
  });
}

export async function detectBootstrapMainClaimHandoffV1Schema(
  sql: Sql,
): Promise<BootstrapMainClaimHandoffV1SchemaState> {
  const relations = await existingRelations(sql);
  if (relations.size === 0) return "absent";
  if (relations.size !== 8) return "partial";
  try {
    await projectBootstrapMainClaimHandoffV1Schema(sql);
    return "present";
  } catch (error) {
    if (error instanceof BootstrapMainClaimHandoffV1SchemaError) return "partial";
    throw error;
  }
}

export async function verifyBootstrapMainClaimHandoffV1Schema(sql: Sql): Promise<void> {
  await projectBootstrapMainClaimHandoffV1Schema(sql);
}
// SETFARM_SEMANTIC_MIGRATION_REGION:migration-v32-schema-projector:END
