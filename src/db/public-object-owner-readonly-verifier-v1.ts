import type { ReadOnlyCatalogTransactionV1 } from "./read-only-catalog-transaction-v1.js";

/** Caller owns the transaction and expected-owner policy; no pool or runtime access. */
export async function verifyExpectedPublicObjectOwnerInTransactionReadOnlyV1(
  transaction: ReadOnlyCatalogTransactionV1, expectedOwner: string,
): Promise<void> {
  await transaction.unsafe("SELECT pg_catalog.set_config('lock_timeout', '1000ms', true)");
  await transaction.unsafe("SELECT pg_catalog.set_config('statement_timeout', '5000ms', true)");
  const rows = await transaction.unsafe<Array<{
    roleExists: boolean;
    ownerReachable: boolean | null;
    objectCount: number;
    ownerMatches: boolean;
  }>>(`
    WITH expected AS (
      SELECT oid FROM pg_catalog.pg_roles WHERE rolname = $1
    ), objects AS (
      SELECT c.relowner FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
    )
    SELECT EXISTS(SELECT 1 FROM expected) AS "roleExists",
      pg_catalog.pg_has_role(session_user, (SELECT oid FROM expected), 'MEMBER') AS "ownerReachable",
      (SELECT count(*)::integer FROM objects) AS "objectCount",
      NOT EXISTS(SELECT 1 FROM objects
        WHERE relowner IS DISTINCT FROM (SELECT oid FROM expected)) AS "ownerMatches"
  `, [expectedOwner]);
  if (rows.length !== 1 || !rows[0]?.roleExists || rows[0].ownerReachable !== false
    || rows[0].objectCount === 0 || !rows[0].ownerMatches) {
    throw new Error("SETFARM_BASE_SCHEMA_OWNER_MISMATCH");
  }
}
