import type { ReadOnlyCatalogTransactionV1 } from "../db/read-only-catalog-transaction-v1.js";

// Import-inert exact cold-phase producer. No client, transaction or authority.
// This is the ordinary census SQL/guard, including the global trigger count.
export async function requireColdPre32CatalogAbsenceInTransactionV1(
  transaction: ReadOnlyCatalogTransactionV1,
): Promise<void> {
  const rows = await transaction.unsafe<Array<Record<string, unknown>>>(`
    WITH expected_tables(name) AS (VALUES
      ('internal_production_bootstrap_main_claim_handoff_operations_v1'), ('internal_production_owner_reservations_v1'),
      ('internal_production_owner_admission_authorities_v1'), ('internal_production_owner_admission_head_v1'),
      ('internal_production_owner_producer_source_build_authorities_v1'), ('internal_production_owner_producer_manifest_set_activations_v1'),
      ('internal_production_owner_producer_manifest_activation_heads_v1'), ('internal_production_owner_producer_manifest_set_current_v1'),
      ('internal_production_v3_recovery_claim_publications_v1')
    ), expected_indexes(name) AS (VALUES
      ('ip_op_sba_v1_plan_manifest_idx'), ('ip_op_msa_v1_phase_manifest_idx'),
      ('ip_op_msa_v1_pred_activation_idx'), ('ip_op_msa_v1_pred_head_idx'),
      ('ip_op_mah_v1_phase_activation_idx'), ('ip_op_mah_v1_pred_head_idx'),
      ('internal_production_bootstrap_handoff_operation_pkey'),
      ('internal_production_bootstrap_handoff_continuation_grant_unique'), ('internal_production_bootstrap_handoff_claim_unique'),
      ('internal_production_owner_reservation_pkey'), ('internal_production_owner_reservation_hash_unique'),
      ('internal_production_owner_reservation_key_unique'), ('internal_production_owner_admission_authority_pkey'),
      ('internal_production_owner_admission_authority_hash_unique'), ('internal_production_owner_admission_authority_phase_unique'),
      ('internal_production_owner_admission_head_pkey'),
      ('ip_op_sba_v1_pkey'), ('ip_op_sba_v1_hash_uq'), ('ip_op_sba_v1_pair_uq'),
      ('ip_op_msa_v1_pkey'), ('ip_op_msa_v1_hash_uq'), ('ip_op_msa_v1_pair_uq'),
      ('ip_op_mah_v1_pkey'), ('ip_op_mah_v1_hash_uq'), ('ip_op_mah_v1_pair_uq'), ('ip_op_mah_v1_activation_pair_uq'),
      ('ip_op_msc_v1_pkey'), ('ip_v3_recovery_publications_pkey'),
      ('ip_v3_recovery_publications_runtime_key'), ('ip_v3_recovery_publications_dispatch_key')
    ), expected_relations(name) AS (
      SELECT name FROM expected_tables UNION ALL SELECT name FROM expected_indexes
    ), expected_functions(name) AS (VALUES
      ('setfarm_forbid_internal_production_owner_admission_authority_mutation'),
      ('ip_op_reject_immutable_v1'), ('ip_op_enforce_current_update_v1'), ('ip_v3_recovery_publication_immutable_v1')
    ), expected_triggers(name) AS (VALUES
      ('trg_internal_production_owner_admission_authority_immutable'),
      ('trg_internal_production_owner_admission_authority_truncate_forbidden'),
      ('ip_op_sba_v1_immutable_trg'), ('ip_op_msa_v1_immutable_trg'), ('ip_op_mah_v1_immutable_trg'),
      ('ip_op_msc_v1_delete_truncate_trg'), ('ip_op_msc_v1_update_trg'),
      ('ip_v3_recovery_publication_row_immutable_v1'), ('ip_v3_recovery_publication_truncate_forbidden_v1')
    )
    SELECT
      (SELECT COUNT(*) FROM public.setfarm_schema_migrations WHERE version >= 32)::text AS "laterJournalCount",
      (SELECT COUNT(*) FROM pg_catalog.pg_class actual JOIN expected_relations expected
        ON actual.relname = left(expected.name, 63) AND actual.relnamespace = 'public'::regnamespace)::text AS "relationCount",
      (SELECT COUNT(*) FROM pg_catalog.pg_proc actual JOIN expected_functions expected
        ON actual.proname = left(expected.name, 63) AND actual.pronamespace = 'public'::regnamespace)::text AS "functionCount",
      (SELECT COUNT(*) FROM pg_catalog.pg_type actual JOIN expected_tables expected
        ON actual.typname = left(expected.name, 63) AND actual.typnamespace = 'public'::regnamespace)::text AS "typeCount",
      (SELECT COUNT(*) FROM pg_catalog.pg_trigger actual JOIN expected_triggers expected
        ON actual.tgname = left(expected.name, 63))::text AS "triggerCount"
  `);
  const keys = ["laterJournalCount", "relationCount", "functionCount", "typeCount", "triggerCount"];
  const refused = () => new Error("INTERNAL_PRODUCTION_CURRENT_ENTRY_INVALID:cold bootstrap migration32/33 catalog or journal is not absent");
  if (rows.length !== 1) throw refused();
  const row = rows[0];
  if (!row || typeof row !== "object" || Array.isArray(row)
    || Object.getPrototypeOf(row) !== Object.prototype
    || Object.keys(row).length !== keys.length || keys.some(key => !Object.hasOwn(row, key))
    || keys.some(key => row[key] !== "0")) {
    throw refused();
  }
}
