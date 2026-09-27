import type postgres from "postgres";

import { getContractSpineCurrentHeadJournalIdentitiesV1 } from "./contract-spine-migrations.js";

const EXPECTED_JOURNAL_COLUMNS_V1 = Object.freeze([
  ["version", "integer", true, null],
  ["name", "text", true, null],
  ["checksum", "text", true, null],
  ["state", "text", true, null],
  ["release_sha", "text", false, null],
  ["applied_at", "timestamp with time zone", true, "now()"],
  ["verified_release_sha", "text", false, null],
  ["verified_at", "timestamp with time zone", false, null],
] as const);

const JOURNAL_COLUMNS_SQL_V1 = `SELECT a.attname AS name, a.attnum AS ordinal,
  pg_catalog.format_type(a.atttypid, a.atttypmod) AS type,
  a.atttypmod AS typmod, a.attnotnull AS "notNull",
  pg_catalog.pg_get_expr(d.adbin, d.adrelid) AS "default",
  a.attisdropped AS dropped, a.attidentity AS identity,
  a.attgenerated AS generated, a.atthasmissing AS "hasMissing",
  a.attmissingval IS NOT NULL AS "missingPresent",
  a.attstorage AS storage,
  a.attcompression = ''::pg_catalog."char" AS "defaultCompression",
  CASE WHEN a.attcollation = 0 THEN 'none'
       WHEN a.attcollation = 'pg_catalog."default"'::regcollation THEN 'default'
       ELSE 'custom' END AS collation
 FROM pg_catalog.pg_class c
 JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
 JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0
 LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid = c.oid AND d.adnum = a.attnum
 WHERE n.nspname = 'public' AND c.relname = 'setfarm_schema_migrations'
 ORDER BY a.attnum LIMIT 9`;

const JOURNAL_RELATION_SQL_V1 = `SELECT c.relname AS name,
  c.relkind AS kind, c.relpersistence AS persistence,
  c.relispartition AS partitioned, am.amname AS "accessMethod",
  c.reloptions AS options, toast.reloptions AS "toastOptions",
  c.reltablespace = 0 AS "defaultTablespace",
  toast.reltablespace = 0 AS "defaultToastTablespace",
  c.relreplident AS "replicaIdentity", c.reloftype = 0 AS untyped,
  c.relrowsecurity AS "rowSecurity", c.relforcerowsecurity AS "forceRowSecurity",
  pg_catalog.pg_has_role(session_user, c.relowner, 'MEMBER') AS "ownerReachable",
  EXISTS (SELECT 1 FROM pg_catalog.pg_inherits h
    WHERE h.inhrelid = c.oid OR h.inhparent = c.oid) AS "hasInheritance",
  EXISTS (SELECT 1 FROM pg_catalog.pg_trigger t
    WHERE t.tgrelid = c.oid AND NOT t.tgisinternal) AS "hasUserTrigger",
  EXISTS (SELECT 1 FROM pg_catalog.pg_rewrite r
    WHERE r.ev_class = c.oid) AS "hasRewriteRule",
  EXISTS (SELECT 1 FROM pg_catalog.pg_policy p
    WHERE p.polrelid = c.oid) AS "hasPolicy",
  EXISTS (SELECT 1 FROM pg_catalog.pg_constraint co
    WHERE co.contype = 'f' AND co.confrelid = c.oid) AS "hasIncomingForeignKey"
 FROM pg_catalog.pg_class c
 JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
 LEFT JOIN pg_catalog.pg_am am ON am.oid = c.relam
 LEFT JOIN pg_catalog.pg_class toast ON toast.oid = c.reltoastrelid
 WHERE n.nspname = 'public' AND c.relname = 'setfarm_schema_migrations'
 LIMIT 2`;

const EXPECTED_JOURNAL_INDEXES_V1 = Object.freeze([
  ["setfarm_schema_migrations_name_key", "CREATE UNIQUE INDEX setfarm_schema_migrations_name_key ON public.setfarm_schema_migrations USING btree (name)", false],
  ["setfarm_schema_migrations_pkey", "CREATE UNIQUE INDEX setfarm_schema_migrations_pkey ON public.setfarm_schema_migrations USING btree (version)", true],
] as const);

const JOURNAL_INDEX_SQL_V1 = `SELECT ic.relname AS name,
  pg_catalog.pg_get_indexdef(i.indexrelid) AS definition,
  i.indisvalid AS valid, i.indisready AS ready, i.indislive AS live,
  i.indisunique AS unique, i.indisprimary AS "primary",
  i.indimmediate AS immediate, i.indnkeyatts AS "keyCount",
  i.indnatts AS "totalCount", i.indexprs IS NOT NULL AS "hasExpression",
  am.amname AS method, ic.relkind AS kind,
  ic.relpersistence AS persistence, ic.reloptions AS options,
  ic.reltablespace = 0 AS "defaultTablespace",
  pg_catalog.pg_has_role(session_user, ic.relowner, 'MEMBER') AS "ownerReachable"
 FROM pg_catalog.pg_index i
 JOIN pg_catalog.pg_class tc ON tc.oid = i.indrelid
 JOIN pg_catalog.pg_namespace tn ON tn.oid = tc.relnamespace
 JOIN pg_catalog.pg_class ic ON ic.oid = i.indexrelid
 JOIN pg_catalog.pg_namespace n ON n.oid = ic.relnamespace
 JOIN pg_catalog.pg_am am ON am.oid = ic.relam
 WHERE tn.nspname = 'public' AND n.nspname = 'public'
   AND tc.relname = 'setfarm_schema_migrations'
 ORDER BY ic.relname COLLATE "C" LIMIT 3`;

const EXPECTED_JOURNAL_CONSTRAINTS_V1 = Object.freeze([
  ["setfarm_schema_migrations_checksum_check", "c", "CHECK (checksum ~ '^[a-f0-9]{64}$'::text)"],
  ["setfarm_schema_migrations_name_key", "u", "UNIQUE (name)"],
  ["setfarm_schema_migrations_pkey", "p", "PRIMARY KEY (version)"],
  ["setfarm_schema_migrations_state_check", "c", "CHECK (state = ANY (ARRAY['applied'::text, 'adopted'::text]))"],
  ["setfarm_schema_migrations_verified_pair_check", "c", "CHECK ((verified_release_sha IS NULL) = (verified_at IS NULL))"],
  ["setfarm_schema_migrations_verified_release_check", "c", "CHECK (verified_release_sha IS NULL OR verified_release_sha ~ '^[a-f0-9]{40}([a-f0-9]{24})?$'::text)"],
  ["setfarm_schema_migrations_version_check", "c", "CHECK (version > 0)"],
] as const);

const JOURNAL_CONSTRAINT_SQL_V1 = `SELECT co.conname AS name, co.contype AS kind,
  pg_catalog.pg_get_constraintdef(co.oid, true) AS definition,
  co.convalidated AS validated, co.condeferrable AS deferrable,
  co.condeferred AS deferred, co.conislocal AS local,
  co.coninhcount AS "inheritCount", co.connoinherit AS "noInherit",
  co.conparentid::text AS "parentOid",
  (SELECT count(*)::integer FROM pg_catalog.pg_depend d
    JOIN pg_catalog.pg_proc p ON d.refclassid = 'pg_catalog.pg_proc'::pg_catalog.regclass
      AND p.oid = d.refobjid
    JOIN pg_catalog.pg_namespace pn ON pn.oid = p.pronamespace
   WHERE d.classid = 'pg_catalog.pg_constraint'::pg_catalog.regclass
     AND d.objid = co.oid AND pn.nspname <> 'pg_catalog') AS "nonCatalogFunctionDependencies",
  (SELECT count(*)::integer FROM pg_catalog.pg_depend d
    JOIN pg_catalog.pg_operator o ON d.refclassid = 'pg_catalog.pg_operator'::pg_catalog.regclass
      AND o.oid = d.refobjid
    JOIN pg_catalog.pg_namespace pn ON pn.oid = o.oprnamespace
   WHERE d.classid = 'pg_catalog.pg_constraint'::pg_catalog.regclass
     AND d.objid = co.oid AND pn.nspname <> 'pg_catalog') AS "nonCatalogOperatorDependencies"
 FROM pg_catalog.pg_constraint co
 JOIN pg_catalog.pg_class c ON c.oid = co.conrelid
 JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public' AND c.relname = 'setfarm_schema_migrations'
 ORDER BY co.conname COLLATE "C" LIMIT 8`;

function mismatch(): never {
  throw new Error("SETFARM_CURRENT_HEAD_JOURNAL_CATALOG_MISMATCH_V1");
}

/** Standalone journal/catalog sample only; never a runtime admission signal. */
export async function verifyContractSpineCurrentHeadJournalReadOnlyV1(
  sql: postgres.Sql,
): Promise<void> {
  try {
    await sql.begin("isolation level repeatable read read only", async (transaction) => {
      await transaction.unsafe("SELECT pg_catalog.set_config('search_path', 'pg_catalog, public, pg_temp', true)");
      await transaction.unsafe("SELECT pg_catalog.set_config('lock_timeout', '1000ms', true)");
      await transaction.unsafe("SELECT pg_catalog.set_config('statement_timeout', '5000ms', true)");
      await transaction.unsafe("SELECT pg_catalog.set_config('idle_in_transaction_session_timeout', '5000ms', true)");
      const journal = await transaction.unsafe<Array<{
        name: string;
        kind: string;
        persistence: string;
        partitioned: boolean;
        accessMethod: string | null;
        options: string[] | null;
        toastOptions: string[] | null;
        defaultTablespace: boolean;
        defaultToastTablespace: boolean;
        replicaIdentity: string;
        untyped: boolean;
        rowSecurity: boolean;
        forceRowSecurity: boolean;
        ownerReachable: boolean;
        hasInheritance: boolean;
        hasUserTrigger: boolean;
        hasRewriteRule: boolean;
        hasPolicy: boolean;
        hasIncomingForeignKey: boolean;
      }>>(JOURNAL_RELATION_SQL_V1);
      const relation = journal[0];
      if (journal.length !== 1 || relation?.name !== "setfarm_schema_migrations"
        || relation.kind !== "r" || relation.persistence !== "p" || relation.partitioned
        || relation.accessMethod !== "heap" || relation.options !== null
        || relation.toastOptions !== null || !relation.defaultTablespace
        || !relation.defaultToastTablespace || relation.replicaIdentity !== "d"
        || !relation.untyped || relation.rowSecurity || relation.forceRowSecurity
        || relation.ownerReachable || relation.hasInheritance || relation.hasUserTrigger
        || relation.hasRewriteRule || relation.hasPolicy || relation.hasIncomingForeignKey) mismatch();
      const columns = await transaction.unsafe<Array<{
        name: string;
        ordinal: number;
        type: string;
        typmod: number;
        notNull: boolean;
        default: string | null;
        dropped: boolean;
        identity: string;
        generated: string;
        hasMissing: boolean;
        missingPresent: boolean;
        storage: string;
        defaultCompression: boolean;
        collation: string;
      }>>(JOURNAL_COLUMNS_SQL_V1);
      if (columns.length !== EXPECTED_JOURNAL_COLUMNS_V1.length
        || columns.some((actual, index) => {
          const source = EXPECTED_JOURNAL_COLUMNS_V1[index]!;
          return actual.ordinal !== index + 1 || actual.name !== source[0]
            || actual.type !== source[1] || actual.typmod !== -1
            || actual.notNull !== source[2] || actual.default !== source[3]
            || actual.dropped || actual.identity !== "" || actual.generated !== ""
            || actual.hasMissing || actual.missingPresent
            || actual.storage !== (source[1] === "text" ? "x" : "p")
            || !actual.defaultCompression
            || actual.collation !== (source[1] === "text" ? "default" : "none");
        })) mismatch();
      const indexes = await transaction.unsafe<Array<{
        name: string;
        definition: string;
        valid: boolean;
        ready: boolean;
        live: boolean;
        unique: boolean;
        primary: boolean;
        immediate: boolean;
        keyCount: number;
        totalCount: number;
        hasExpression: boolean;
        method: string;
        kind: string;
        persistence: string;
        options: string[] | null;
        defaultTablespace: boolean;
        ownerReachable: boolean;
      }>>(JOURNAL_INDEX_SQL_V1);
      if (indexes.length !== EXPECTED_JOURNAL_INDEXES_V1.length
        || indexes.some((actual, index) => {
          const source = EXPECTED_JOURNAL_INDEXES_V1[index]!;
          return actual.name !== source[0] || actual.definition !== source[1]
            || !actual.valid || !actual.ready || !actual.live || !actual.unique
            || actual.primary !== source[2] || !actual.immediate
            || actual.keyCount !== 1 || actual.totalCount !== 1 || actual.hasExpression
            || actual.method !== "btree" || actual.kind !== "i"
            || actual.persistence !== "p" || actual.options !== null
            || !actual.defaultTablespace || actual.ownerReachable;
        })) mismatch();
      const constraints = await transaction.unsafe<Array<{
        name: string;
        kind: string;
        definition: string;
        validated: boolean;
        deferrable: boolean;
        deferred: boolean;
        local: boolean;
        inheritCount: number;
        noInherit: boolean;
        parentOid: string;
        nonCatalogFunctionDependencies: number;
        nonCatalogOperatorDependencies: number;
      }>>(JOURNAL_CONSTRAINT_SQL_V1);
      if (constraints.length !== EXPECTED_JOURNAL_CONSTRAINTS_V1.length
        || constraints.some((actual, index) => {
          const source = EXPECTED_JOURNAL_CONSTRAINTS_V1[index]!;
          return actual.name !== source[0] || actual.kind !== source[1]
            || actual.definition !== source[2] || !actual.validated
            || actual.deferrable || actual.deferred || !actual.local
            || actual.inheritCount !== 0 || actual.noInherit !== (source[1] !== "c")
            || actual.parentOid !== "0"
            || actual.nonCatalogFunctionDependencies !== 0
            || actual.nonCatalogOperatorDependencies !== 0;
        })) mismatch();
      const access = await transaction.unsafe<Array<{
        sameRole: boolean;
        otherRoleMembership: boolean;
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
        || access[0].databaseCreate || access[0].schemaCreate
        || !access[0].journalSelect || access[0].journalWrite
        || access[0].journalColumnWrite) mismatch();
      const expected = getContractSpineCurrentHeadJournalIdentitiesV1();
      const rows = await transaction.unsafe<Array<{
        version: number;
        name: string;
        checksum: string;
        state: string;
      }>>(
        "SELECT version, name, checksum, state FROM public.setfarm_schema_migrations ORDER BY version LIMIT 34",
      );
      if (rows.length !== expected.length || rows.some((row, index) => {
        const source = expected[index]!;
        return row.version !== source.version || row.name !== source.name
          || row.checksum !== source.checksum
          || (source.migrationClass === "guarded"
            ? row.state !== "applied"
            : row.state !== "applied" && row.state !== "adopted");
      })) mismatch();
    });
  } catch {
    mismatch();
  }
}
