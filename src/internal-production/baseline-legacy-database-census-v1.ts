import type { LegacyFindingPublicationInventoryV1 } from "../findings/legacy-finding-publication-inventory-v1.js";
import type { FindingPublicationParentRowV1, FindingPublicationChildRowV1 } from "../findings/finding-publication-v1.js";

// Import-inert shared read-only primitive. Callers supply their privately held
// URL and must independently fence source, credentials, runtime and ownership.
function currentEntryFail(message: string): never {
  throw new Error(`INTERNAL_PRODUCTION_CURRENT_ENTRY_INVALID:${message}`);
}
function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}
function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
}
function recursivelyFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const key of Reflect.ownKeys(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor && "value" in descriptor) recursivelyFreeze(descriptor.value);
    }
    Object.freeze(value);
  }
  return value;
}

async function requireColdPre32CatalogAbsenceV1(connection: import("postgres").Sql): Promise<void> {
  const rows = await connection<Array<Record<string, unknown>>>`
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
  `;
  const keys = ["laterJournalCount", "relationCount", "functionCount", "typeCount", "triggerCount"];
  if (rows.length !== 1 || !isPlainRecord(rows[0]) || !hasExactKeys(rows[0], keys)
    || keys.some((key) => rows[0]![key] !== "0")) currentEntryFail("cold bootstrap migration32/33 catalog or journal is not absent");
}

export async function observeLegacyDatabaseCensusV1(databaseUrl: string | undefined, coldBootstrap = false, profile?: "cutover-local"): Promise<Readonly<{
  activeRunCount: number; openClaimCount: number; executionAttemptCount: number;
  activeRuntimeSessionCount: number; activeCompletionOwnerCount: number; unsettledMandatoryEffectCount: number;
  artifactReservationCount: number; publicationBatchCount: number; artifactPublicationCount: number;
  terminationOwnerCount: number; findingOwnerCount: number; recoveryOwnerCount: number; operationalDeliveryCount: number;
  legacyFindingPublicationInventory: LegacyFindingPublicationInventoryV1;
}>> {
  const postgresModule = await import("postgres");
  const { observeLegacyFindingPublicationInventoryV1 } = await import("../findings/finding-publication-v1.js");
  if (!databaseUrl) currentEntryFail("legacy zero-owner database is unavailable");
  let cutoverTarget: URL | undefined;
  if (profile === "cutover-local") {
    const refuse = () => currentEntryFail("cutover database target is ambiguous");
    if (!coldBootstrap || Object.keys(process.env).some(key => key.startsWith("PG"))) refuse();
    try { cutoverTarget = new URL(databaseUrl); } catch { refuse(); }
    if (!cutoverTarget || !/^postgres(?:ql)?:\/\/[^/?#@\s]+@(?:localhost|127\.0\.0\.1)(?::5432)?\/setfarm$/.test(databaseUrl)
      || !cutoverTarget.username || cutoverTarget.search || cutoverTarget.hash) refuse();
  }
  const sql = postgresModule.default(databaseUrl, {
    max: 1, idle_timeout: 1, connect_timeout: 5,
    debug: false, onnotice: () => {},
  });
  try {
    if (cutoverTarget && (sql.options.host.length !== 1 || sql.options.host[0] !== cutoverTarget.hostname
      || sql.options.port.length !== 1 || sql.options.port[0] !== 5432 || sql.options.database !== "setfarm"
      || sql.options.user !== decodeURIComponent(cutoverTarget.username))) {
      currentEntryFail("cutover database target is ambiguous");
    }
    return await sql.begin("isolation level repeatable read read only", async (tx) => {
      const connection = tx as unknown as typeof sql;
      await connection`SET LOCAL statement_timeout = '5s'`;
      await connection`SET LOCAL lock_timeout = '1s'`;
      if (coldBootstrap) await requireColdPre32CatalogAbsenceV1(connection);
      const rows = await connection<Array<Record<string, unknown>>>`
        WITH required_columns(table_name,column_name,type_name,required_not_null) AS (
          VALUES
            ('runs','id','text',TRUE),
            ('runs','status','text',TRUE),
            ('claim_log','outcome','text',FALSE),
            ('execution_attempts','disposition','text',TRUE),
            ('runtime_sessions','state','text',TRUE),
            ('runtime_completion_requests','state','text',TRUE),
            ('runtime_completion_effects','mandatory','boolean',TRUE),
            ('runtime_completion_effects','state','text',TRUE),
            ('artifact_publication_reservations','reservation_id','text',TRUE),
            ('artifact_publication_reservations','artifact_hash','text',TRUE),
            ('artifact_publication_reservations','state','text',TRUE),
            ('artifact_publication_reservations','owner_instance_id','text',FALSE),
            ('artifact_publication_reservations','lease_token','text',FALSE),
            ('artifact_publication_reservations','lease_expires_at','timestamp with time zone',FALSE),
            ('artifact_publication_batches','batch_reservation_id','text',TRUE),
            ('artifact_publication_batches','state','text',TRUE),
            ('artifact_publication_batches','owner_instance_id','text',FALSE),
            ('artifact_publication_batches','lease_token','text',FALSE),
            ('artifact_publication_batches','lease_expires_at','timestamp with time zone',FALSE),
            ('artifact_publication_batch_items','batch_reservation_id','text',TRUE),
            ('artifact_publication_batch_items','artifact_hash','text',TRUE),
            ('artifact_publication_batch_items','reservation_id','text',FALSE),
            ('run_termination_requests','state','text',TRUE),
            ('findings','status','text',TRUE),
            ('finding_sets','finding_set_hash','text',TRUE),
            ('finding_sets','finding_set_id','text',TRUE),
            ('finding_sets','run_id','text',TRUE),
            ('finding_sets','story_id','text',TRUE),
            ('finding_sets','packet_hash','text',TRUE),
            ('finding_sets','slice_hash','text',TRUE),
            ('finding_sets','source_sha','text',TRUE),
            ('finding_sets','source_tree_hash','text',TRUE),
            ('finding_sets','finding_ids','jsonb',TRUE),
            ('finding_sets','payload','jsonb',TRUE),
            ('findings','finding_set_hash','text',TRUE),
            ('findings','finding_id','text',TRUE),
            ('findings','origin','text',TRUE),
            ('findings','classification','text',TRUE),
            ('findings','invariant_ref','text',TRUE),
            ('findings','source_fingerprint','text',TRUE),
            ('findings','payload','jsonb',TRUE),
            ('recovery_cases','status','text',TRUE),
            ('recovery_dispatch_deliveries','state','text',TRUE),
            ('operational_event_deliveries','state','text',TRUE)
        ), catalog_violations AS (
          SELECT COUNT(*) AS count
          FROM required_columns expected
          LEFT JOIN pg_catalog.pg_class relation
            ON relation.relname=expected.table_name AND relation.relnamespace='public'::regnamespace
          LEFT JOIN pg_catalog.pg_attribute attribute
            ON attribute.attrelid=relation.oid AND attribute.attname=expected.column_name
              AND attribute.attnum>0 AND NOT attribute.attisdropped
          LEFT JOIN pg_catalog.pg_type data_type ON data_type.oid=attribute.atttypid
          WHERE relation.oid IS NULL OR attribute.attname IS NULL
             OR pg_catalog.format_type(data_type.oid,attribute.atttypmod)<>expected.type_name
             OR attribute.attnotnull<>expected.required_not_null
        ), aprb_child_violations AS (
          SELECT COUNT(*) AS count
          FROM public.artifact_publication_reservations reservation
          WHERE reservation.state='reserved' AND left(reservation.reservation_id,5)='APRB_'
            AND (SELECT COUNT(*)
                 FROM public.artifact_publication_batch_items item
                 JOIN public.artifact_publication_batches batch
                   ON batch.batch_reservation_id=item.batch_reservation_id AND batch.state='active'
                 WHERE (item.reservation_id,item.artifact_hash)=(reservation.reservation_id,reservation.artifact_hash)
                   AND reservation.owner_instance_id IS NOT DISTINCT FROM batch.owner_instance_id
                   AND reservation.lease_token IS NOT DISTINCT FROM batch.lease_token
                   AND reservation.lease_expires_at IS NOT DISTINCT FROM batch.lease_expires_at)<>1
        ), ordinary_batch_violations AS (
          SELECT COUNT(*) AS count
          FROM public.artifact_publication_reservations reservation
          JOIN public.artifact_publication_batch_items item
            ON (item.reservation_id,item.artifact_hash)=(reservation.reservation_id,reservation.artifact_hash)
          WHERE reservation.state='reserved' AND left(reservation.reservation_id,5)<>'APRB_'
        ), active_header_violations AS (
          SELECT COUNT(*) AS count
          FROM public.artifact_publication_batches batch
          WHERE batch.state='active' AND NOT EXISTS (
            SELECT 1 FROM public.artifact_publication_batch_items item
            JOIN public.artifact_publication_reservations reservation
              ON (reservation.reservation_id,reservation.artifact_hash)=(item.reservation_id,item.artifact_hash)
            WHERE item.batch_reservation_id=batch.batch_reservation_id
              AND reservation.state='reserved' AND left(reservation.reservation_id,5)='APRB_'
              AND reservation.owner_instance_id IS NOT DISTINCT FROM batch.owner_instance_id
              AND reservation.lease_token IS NOT DISTINCT FROM batch.lease_token
              AND reservation.lease_expires_at IS NOT DISTINCT FROM batch.lease_expires_at)
        )
        SELECT
          (SELECT count FROM catalog_violations)::text AS "catalogViolationCount",
          (SELECT count FROM aprb_child_violations)::text AS "aprbChildViolationCount",
          (SELECT count FROM ordinary_batch_violations)::text AS "ordinaryBatchViolationCount",
          (SELECT count FROM active_header_violations)::text AS "activeHeaderViolationCount",
          to_regclass('public.internal_production_owner_reservations_v1')::text AS "ownerReservationsRelation",
          to_regclass('public.internal_production_owner_admission_head_v1')::text AS "ownerAdmissionHeadRelation",
          to_regclass('public.internal_production_owner_producer_source_build_authorities_v1')::text AS "producerSourceRelation",
          to_regclass('public.internal_production_owner_producer_manifest_set_activations_v1')::text AS "producerActivationRelation",
          to_regclass('public.internal_production_owner_producer_manifest_activation_heads_v1')::text AS "producerActivationHeadRelation",
          to_regclass('public.internal_production_owner_producer_manifest_set_current_v1')::text AS "producerCurrentRelation",
          (SELECT COUNT(*) FROM public.runs WHERE status IN ('running','resuming','cancelling','failing'))::text AS "activeRunCount",
          (SELECT COUNT(*) FROM public.claim_log WHERE outcome IS NULL)::text AS "openClaimCount",
          (SELECT COUNT(*) FROM public.execution_attempts WHERE disposition IN ('claimed','running'))::text AS "executionAttemptCount",
          (SELECT COUNT(*) FROM public.runtime_sessions WHERE state NOT IN ('released','quarantined'))::text AS "activeRuntimeSessionCount",
          (SELECT COUNT(*) FROM public.runtime_completion_requests WHERE state NOT IN ('accepted','rejected','quarantined'))::text AS "activeCompletionOwnerCount",
          (SELECT COUNT(*) FROM public.runtime_completion_effects WHERE mandatory IS TRUE AND state NOT IN ('applied','reconciled'))::text AS "unsettledMandatoryEffectCount",
          (SELECT COUNT(*) FROM public.artifact_publication_reservations reservation WHERE reservation.state='reserved' AND left(reservation.reservation_id,5)<>'APRB_')::text AS "artifactReservationCount",
          (SELECT COUNT(*) FROM public.artifact_publication_batches WHERE state='active')::text AS "publicationBatchCount",
          (SELECT COUNT(*) FROM public.artifact_publication_batch_items item
             JOIN public.artifact_publication_reservations reservation
               ON (reservation.reservation_id,reservation.artifact_hash)=(item.reservation_id,item.artifact_hash)
             JOIN public.artifact_publication_batches batch
               ON batch.batch_reservation_id=item.batch_reservation_id
            WHERE reservation.state='reserved' AND left(reservation.reservation_id,5)='APRB_' AND batch.state='active')::text AS "artifactPublicationCount",
          (SELECT COUNT(*) FROM public.run_termination_requests WHERE state<>'terminalized')::text AS "terminationOwnerCount",
          (SELECT COUNT(*) FROM public.findings WHERE status='open')::text AS "findingOwnerCount",
          ((SELECT COUNT(*) FROM public.recovery_cases WHERE status IN ('open','repairing','evidencing'))
            +(SELECT COUNT(*) FROM public.recovery_dispatch_deliveries WHERE state IN ('authorized','leased','attempt_reserved','running')))::text AS "recoveryOwnerCount",
          (SELECT COUNT(*) FROM public.operational_event_deliveries WHERE state IN ('pending','leased'))::text AS "operationalDeliveryCount"
      `;
      if (rows.length !== 1 || !isPlainRecord(rows[0])) currentEntryFail("legacy zero-owner database aggregate must return exactly one row");
      const row = rows[0]!;
      for (const relationKey of [
        "ownerReservationsRelation", "ownerAdmissionHeadRelation", "producerSourceRelation",
        "producerActivationRelation", "producerActivationHeadRelation", "producerCurrentRelation",
      ]) if (row[relationKey] !== null) currentEntryFail(`legacy zero-owner database ${relationKey} is present`);
      const parseCount = (key: string): number => {
        const raw = row[key];
        if (typeof raw !== "string" || !/^(?:0|[1-9][0-9]*)$/.test(raw)) currentEntryFail(`${key} is not a canonical nonnegative integer`);
        const count = Number(raw);
        if (!Number.isSafeInteger(count)) currentEntryFail(`${key} exceeds the safe-integer boundary`);
        return count;
      };
      for (const key of ["catalogViolationCount", "aprbChildViolationCount", "ordinaryBatchViolationCount", "activeHeaderViolationCount"]) {
        if (parseCount(key) !== 0) currentEntryFail(`${key} is nonzero`);
      }
      const findingParents = await connection<FindingPublicationParentRowV1[]>`
        SELECT finding_set_hash,finding_set_id,run_id,story_id,packet_hash,slice_hash,
               source_sha,source_tree_hash,finding_ids,payload
          FROM public.finding_sets ORDER BY finding_set_hash LIMIT 4097
      `;
      const findingChildren = await connection<FindingPublicationChildRowV1[]>`
        SELECT finding_set_hash,finding_id,origin,classification,invariant_ref,status,source_fingerprint,payload
          FROM public.findings ORDER BY finding_set_hash,finding_id LIMIT 65537
      `;
      const findingRuns = await connection<Array<{ id: string; status: string }>>`
        SELECT id,status FROM public.runs
         WHERE id IN (SELECT run_id FROM public.finding_sets)
         ORDER BY id LIMIT 4097
      `;
      const legacyFindingPublicationInventory = observeLegacyFindingPublicationInventoryV1(findingParents, findingChildren, findingRuns);
      if (findingChildren.filter((finding) => finding.status === "open").length !== parseCount("findingOwnerCount")) {
        currentEntryFail("legacy finding publication aggregate is crossed");
      }
      const observed = Object.freeze({
        activeRunCount: parseCount("activeRunCount"),
        openClaimCount: parseCount("openClaimCount"),
        executionAttemptCount: parseCount("executionAttemptCount"),
        activeRuntimeSessionCount: parseCount("activeRuntimeSessionCount"),
        activeCompletionOwnerCount: parseCount("activeCompletionOwnerCount"),
        unsettledMandatoryEffectCount: parseCount("unsettledMandatoryEffectCount"),
        artifactReservationCount: parseCount("artifactReservationCount"),
        publicationBatchCount: parseCount("publicationBatchCount"),
        artifactPublicationCount: parseCount("artifactPublicationCount"),
        terminationOwnerCount: parseCount("terminationOwnerCount"),
        // Every inventoried publication is complete and belongs to a terminal
        // run. Orphans, partial publications and nonterminal relations refuse
        // above; issue status itself does not retain publication ownership.
        findingOwnerCount: 0,
        recoveryOwnerCount: parseCount("recoveryOwnerCount"),
        operationalDeliveryCount: parseCount("operationalDeliveryCount"),
      });
      for (const [key, count] of Object.entries(observed)) if (count !== 0) currentEntryFail(`${key} is nonzero`);
      return recursivelyFreeze({ ...observed, legacyFindingPublicationInventory });
    });
  } finally {
    await sql.end({ timeout: 1 });
  }
}
