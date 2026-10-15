import type { ReadOnlyCatalogTransactionV1 } from "./read-only-catalog-transaction-v1.js";

function mismatch(): never {
  throw new Error("SETFARM_CURRENT_HEAD_JOURNAL_CATALOG_MISMATCH_V1");
}

/** Runtime/access baseline ONLY; does not verify current-head journal identities. */
export async function verifyContractSpineRuntimeAccessInTransactionReadOnlyV1(
  transaction: ReadOnlyCatalogTransactionV1,
): Promise<void> {
  try {
    const access = await transaction.unsafe<Array<{
      sameRole: boolean;
      otherRoleMembership: boolean;
      unsafeRoleAttributes: boolean;
      databaseCreate: boolean;
      schemaCreate: boolean;
      journalSelect: boolean;
      journalWrite: boolean;
      journalColumnWrite: boolean;
    }>>(
      `SELECT session_user = current_user AS "sameRole",
        EXISTS (SELECT 1 FROM pg_catalog.pg_roles r
          WHERE r.rolname <> session_user
            AND pg_catalog.pg_has_role(session_user, r.oid, 'MEMBER')) AS "otherRoleMembership",
        COALESCE((SELECT NOT r.rolcanlogin OR r.rolsuper OR r.rolcreaterole
          OR r.rolcreatedb OR r.rolbypassrls OR r.rolreplication
          FROM pg_catalog.pg_roles r WHERE r.rolname = session_user), true)
          AS "unsafeRoleAttributes",
        pg_catalog.has_database_privilege(current_user, current_database(), 'CREATE') AS "databaseCreate",
        pg_catalog.has_schema_privilege(current_user, 'public', 'CREATE') AS "schemaCreate",
        pg_catalog.has_table_privilege(current_user,
          'public.setfarm_schema_migrations', 'SELECT') AS "journalSelect",
        (pg_catalog.has_table_privilege(current_user,
          'public.setfarm_schema_migrations', 'INSERT')
         OR pg_catalog.has_table_privilege(current_user,
          'public.setfarm_schema_migrations', 'UPDATE')
         OR pg_catalog.has_table_privilege(current_user,
          'public.setfarm_schema_migrations', 'DELETE')
         OR pg_catalog.has_table_privilege(current_user,
          'public.setfarm_schema_migrations', 'TRUNCATE')
         OR pg_catalog.has_table_privilege(current_user,
          'public.setfarm_schema_migrations', 'REFERENCES')
         OR pg_catalog.has_table_privilege(current_user,
          'public.setfarm_schema_migrations', 'TRIGGER')
         OR pg_catalog.has_table_privilege(current_user,
          'public.setfarm_schema_migrations', 'MAINTAIN')) AS "journalWrite",
        (pg_catalog.has_any_column_privilege(current_user,
          'public.setfarm_schema_migrations', 'INSERT')
         OR pg_catalog.has_any_column_privilege(current_user,
          'public.setfarm_schema_migrations', 'UPDATE')
         OR pg_catalog.has_any_column_privilege(current_user,
          'public.setfarm_schema_migrations', 'REFERENCES')) AS "journalColumnWrite"`,
    );
    if (access.length !== 1 || !access[0]?.sameRole || access[0].otherRoleMembership
      || access[0].unsafeRoleAttributes
      || access[0].databaseCreate || access[0].schemaCreate
      || !access[0].journalSelect || access[0].journalWrite
      || access[0].journalColumnWrite) mismatch();
  } catch {
    mismatch();
  }
}
