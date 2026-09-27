// Private post-33 disposable-Git diagnostic only. These statements are never
// part of the live migration chain. A row correlates a sampled physical root
// with one reservation; direct SQL can forge it, and it grants no owner,
// admission, reservation settlement or continuous writer exclusion.
export const PRIVATE_POSITIVE_WORKTREE_RECOVERY_CREATE_RECEIPT_V1_TABLE =
  "public.internal_production_positive_worktree_recovery_create_receipts_v1";
const TABLE = PRIVATE_POSITIVE_WORKTREE_RECOVERY_CREATE_RECEIPT_V1_TABLE;
const RESERVATIONS = "public.internal_production_positive_worktree_recovery_precreate_reservations_v1";

export const PRIVATE_POSITIVE_WORKTREE_RECOVERY_CREATE_RECEIPT_V1_STATEMENTS = Object.freeze([
  `CREATE TABLE ${TABLE} (
    receipt_hash text PRIMARY KEY CHECK (receipt_hash ~ '^[a-f0-9]{64}$'),
    reservation_hash text NOT NULL UNIQUE REFERENCES ${RESERVATIONS}(reservation_hash)
      ON UPDATE RESTRICT ON DELETE RESTRICT,
    run_id text NOT NULL,
    story_db_id text NOT NULL,
    story_id text NOT NULL,
    dispatch_id text NOT NULL,
    recovery_case_id text NOT NULL,
    revision_id text NOT NULL,
    owner_instance_id text NOT NULL,
    lease_token_hash text NOT NULL CHECK (lease_token_hash ~ '^[a-f0-9]{64}$'),
    root text NOT NULL UNIQUE,
    source_sha text NOT NULL CHECK (source_sha ~ '^([a-f0-9]{40}|[a-f0-9]{64})$'),
    source_tree_hash text NOT NULL CHECK (source_tree_hash ~ '^([a-f0-9]{40}|[a-f0-9]{64})$'),
    git_primary_root text NOT NULL,
    physical_dev text NOT NULL CHECK (physical_dev ~ '^[1-9][0-9]{0,19}$'),
    physical_ino text NOT NULL CHECK (physical_ino ~ '^[1-9][0-9]{0,19}$'),
    physical_birthtime_ns text NOT NULL CHECK (physical_birthtime_ns ~ '^[1-9][0-9]{0,19}$'),
    physical_identity_hash text NOT NULL CHECK (physical_identity_hash ~ '^[a-f0-9]{64}$'),
    canonical_body text NOT NULL CHECK (octet_length(canonical_body) BETWEEN 1 AND 4096),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT task6a_private_recovery_create_receipt_body_hash_v1 CHECK
      (receipt_hash = encode(pg_catalog.sha256(pg_catalog.convert_to(canonical_body, 'UTF8')), 'hex'))
  )`,
  `CREATE FUNCTION public.task6a_private_recovery_create_receipt_immutable_v1() RETURNS trigger
    LANGUAGE plpgsql AS $$ BEGIN
      RAISE EXCEPTION 'TASK6A_PRIVATE_RECOVERY_CREATE_RECEIPT_IMMUTABLE' USING ERRCODE = '42501';
    END $$`,
  `CREATE TRIGGER task6a_private_recovery_create_receipt_no_replace_v1
    BEFORE UPDATE OR DELETE ON ${TABLE}
    FOR EACH ROW EXECUTE FUNCTION public.task6a_private_recovery_create_receipt_immutable_v1()`,
  `CREATE TRIGGER task6a_private_recovery_create_receipt_no_truncate_v1
    BEFORE TRUNCATE ON ${TABLE}
    FOR EACH STATEMENT EXECUTE FUNCTION public.task6a_private_recovery_create_receipt_immutable_v1()`,
] as const);
