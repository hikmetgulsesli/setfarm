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
] as const);
// SETFARM_SEMANTIC_MIGRATION_REGION:migration-v32-identity-and-statements:END

// SETFARM_SEMANTIC_MIGRATION_REGION:migration-v32-schema-projector:BEGIN
const BOOTSTRAP_HANDOFF_OPERATION_TABLE =
  "internal_production_bootstrap_main_claim_handoff_operations_v1";
const OWNER_RESERVATION_TABLE = "internal_production_owner_reservations_v1";
const OWNER_ADMISSION_AUTHORITY_TABLE = "internal_production_owner_admission_authorities_v1";
const OWNER_ADMISSION_HEAD_TABLE = "internal_production_owner_admission_head_v1";

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
    ]],
  );
  return new Set(rows.map((row) => row.relation_name));
}

function normalizeSql(source: string): string {
  return source.replace(/\s+/g, " ").trim().toLowerCase();
}

const EXPECTED_RELATION_METADATA_HASHES = Object.freeze({
  [BOOTSTRAP_HANDOFF_OPERATION_TABLE]: "b8ba5b2d4a39e85300a9ced031f62a19b14aaf415e6d1144df3110ee432aaf82",
  [OWNER_RESERVATION_TABLE]: "dfd68d29ea41810f6f75bac0dc16067147afab9d8a4d5f619a4767051b4954b1",
  [OWNER_ADMISSION_AUTHORITY_TABLE]: "3b5f99470404679f1f62b6a8c2d25ed120b4e6a4d3f45bd8f96dfac309964712",
  [OWNER_ADMISSION_HEAD_TABLE]: "c73bea41c46b00dee7912ffc848a7f8c3822a6bd03f8f1b18441156de4412fc0",
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
      default_expression: normalizeSql(row.default_expression ?? ""),
    })),
    constraints: constraints.map((row) => ({
      ...row,
      definition: normalizeSql(row.definition),
    })),
    indexes: indexes.map((row) => ({
      ...row,
      definition: normalizeSql(row.definition),
    })),
    triggers: triggers.map((row) => ({
      ...row,
      definition: normalizeSql(row.definition),
      function_definition: normalizeSql(row.function_definition),
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
  ] as const) {
    await assertExactRelationMetadata(sql, relation);
  }
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
  if (relations.size !== 4) return "partial";
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
