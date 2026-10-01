import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtempSync, rmdirSync } from "node:fs";
import { test } from "node:test";
import path from "node:path";

import postgres from "postgres";

import { verifyOrdinaryBaseSchemaCatalogReadOnlyV1 } from "../../src/db/base-schema-readonly-verifier-v1.js";
import { createIsolatedTestDatabase, type TestDatabase } from "./test-database.js";

const expectedDataDirectory = process.env.SETFARM_TASK6A_TEST_PG_DATA_DIRECTORY;

async function schemaFingerprint(sql: postgres.Sql): Promise<string> {
  const rows = await sql<Array<{ fingerprint: string }>>`
    SELECT md5(jsonb_build_object(
      'relations', (SELECT jsonb_agg(jsonb_build_array(c.relname, c.relkind,
        c.relpersistence, c.relrowsecurity, c.relforcerowsecurity,
        c.relowner::text, c.relam::text, c.reloptions, c.relreplident,
        c.reloftype::text, c.reltablespace::text,
        toast.reltablespace::text, toast.reloptions) ORDER BY c.relname)
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        LEFT JOIN pg_class toast ON toast.oid = c.reltoastrelid
        WHERE n.nspname = 'public'),
      'inheritance', (SELECT jsonb_agg(jsonb_build_array(child.relname,
        parent.relname) ORDER BY child.relname, parent.relname)
        FROM pg_inherits h JOIN pg_class child ON child.oid = h.inhrelid
        JOIN pg_class parent ON parent.oid = h.inhparent),
      'columns', (SELECT jsonb_agg(jsonb_build_array(c.relname, a.attname, a.attnum,
        format_type(a.atttypid, a.atttypmod), a.attnotnull,
        a.attcollation::text, a.attidentity, a.attgenerated,
        a.atthasmissing, a.attmissingval::text, a.attstorage,
        a.attcompression::text,
        pg_get_expr(d.adbin, d.adrelid)) ORDER BY c.relname, a.attname)
        FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        LEFT JOIN pg_attrdef d ON d.adrelid = c.oid AND d.adnum = a.attnum
        WHERE n.nspname = 'public' AND a.attnum > 0 AND NOT a.attisdropped),
      'constraints', (SELECT jsonb_agg(jsonb_build_array(c.relname, x.conname,
        pg_get_constraintdef(x.oid)) ORDER BY c.relname, x.conname)
        FROM pg_constraint x JOIN pg_class c ON c.oid = x.conrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'),
      'triggers', (SELECT jsonb_agg(jsonb_build_array(c.relname, t.tgname,
        t.tgenabled, t.tgisinternal, t.tgconstraint::text)
        ORDER BY c.relname, t.tgname)
        FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'),
      'rules', (SELECT jsonb_agg(jsonb_build_array(c.relname, r.rulename,
        r.ev_type, r.is_instead, r.ev_enabled, pg_get_ruledef(r.oid))
        ORDER BY c.relname, r.rulename)
        FROM pg_rewrite r JOIN pg_class c ON c.oid = r.ev_class
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'),
      'indexes', (SELECT jsonb_agg(jsonb_build_array(ic.relname,
        pg_get_indexdef(i.indexrelid), ic.reltablespace::text, ic.reloptions, i.indimmediate,
        EXISTS (SELECT 1 FROM pg_constraint co WHERE co.conindid=i.indexrelid
          AND co.contype IN ('p', 'u', 'x')))
        ORDER BY ic.relname)
        FROM pg_index i JOIN pg_class ic ON ic.oid = i.indexrelid
        JOIN pg_namespace n ON n.oid = ic.relnamespace
        WHERE n.nspname = 'public')
    )::text) AS fingerprint
  `;
  assert.match(rows[0]?.fingerprint ?? "", /^[a-f0-9]{32}$/);
  return rows[0]!.fingerprint;
}

test("a distinct non-CREATE login verifies the isolated base catalog without a schema effect", {
  skip: expectedDataDirectory ? false : "requires an explicitly identified private PostgreSQL cluster",
}, async () => {
  assert.equal(process.env.SETFARM_PG_URL, undefined);
  assert.match(expectedDataDirectory!, /^\/tmp\/setfarm-task6a-pg\.[A-Za-z0-9]+\/data$/);
  const adminUrl = process.env.SETFARM_TEST_PG_ADMIN_URL;
  assert.ok(adminUrl);
  const parsed = new URL(adminUrl);
  assert.equal(parsed.pathname, "/postgres");
  assert.ok(["127.0.0.1", "localhost", "::1"].includes(parsed.hostname));
  assert.notEqual(parsed.port, "5432");
  let password: string;
  try { password = decodeURIComponent(parsed.password); }
  catch { throw new Error("PRIVATE_READONLY_LOGIN_PASSWORD_INVALID"); }
  assert.ok(/^[a-f0-9]{64}$/.test(password), "PRIVATE_READONLY_LOGIN_PASSWORD_INVALID");
  const admin = postgres(adminUrl, { max: 1 });
  let database: TestDatabase | undefined;
  let restricted: postgres.Sql | undefined;
  const role = `task6a_base_v1_${randomBytes(6).toString("hex")}`;
  const tablespace = `task6a_base_space_${randomBytes(6).toString("hex")}`;
  let privateClusterVerified = false;
  let roleCreated = false;
  let tablespaceDirectory: string | undefined;
  let testFailure: unknown;
  try {
    const identity = await admin<Array<{
      data_directory: string;
      port: string;
      socket_directories: string;
      password_encryption: string;
    }>>`
      SELECT current_setting('data_directory') AS data_directory,
        current_setting('port') AS port,
        current_setting('unix_socket_directories') AS socket_directories,
        current_setting('password_encryption') AS password_encryption
    `;
    assert.equal(identity[0]?.data_directory, expectedDataDirectory);
    assert.equal(identity[0]?.port, parsed.port);
    const socketDirectory = path.dirname(expectedDataDirectory!);
    assert.ok(identity[0]?.socket_directories.split(",").map((value) => value.trim())
      .includes(socketDirectory));
    assert.equal(identity[0]?.password_encryption, "scram-sha-256");
    privateClusterVerified = true;

    database = await createIsolatedTestDatabase();
    await admin.unsafe(`CREATE ROLE "${role}" LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD '${password}'`);
    roleCreated = true;
    await admin.unsafe(`GRANT CONNECT ON DATABASE "${database.database}" TO "${role}"`);
    await database.sql.unsafe(`GRANT USAGE ON SCHEMA public TO "${role}"`);
    restricted = postgres({ host: socketDirectory, port: Number(parsed.port),
      database: database.database, username: role, password, max: 1 });
    const rights = await restricted<Array<{
      login: string;
      effective: string;
      database_create: boolean;
      schema_create: boolean;
      journal_maintain: boolean;
    }>>`
      SELECT session_user AS login, current_user AS effective,
        has_database_privilege(current_user, current_database(), 'CREATE') AS database_create,
        has_schema_privilege(current_user, 'public', 'CREATE') AS schema_create,
        has_table_privilege(current_user, 'public.setfarm_schema_migrations', 'MAINTAIN') AS journal_maintain
    `;
    assert.deepEqual(rights[0], { login: role, effective: role,
      database_create: false, schema_create: false, journal_maintain: false });

    const before = await schemaFingerprint(database.sql);
    await verifyOrdinaryBaseSchemaCatalogReadOnlyV1(restricted);
    const after = await schemaFingerprint(database.sql);
    assert.equal(after, before);
    await database.sql.unsafe("CREATE TABLE public.task6a_extra_fk (run_number integer REFERENCES public.runs(run_number))");
    const extraFkBefore = await schemaFingerprint(database.sql);
    await verifyOrdinaryBaseSchemaCatalogReadOnlyV1(restricted);
    assert.equal(await schemaFingerprint(database.sql), extraFkBefore);
    await database.sql.unsafe("DROP TABLE public.task6a_extra_fk");
    await database.sql.unsafe("CREATE TABLE public.task6a_extra_collision (run_id text, CONSTRAINT steps_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.runs(id))");
    const collisionBefore = await schemaFingerprint(database.sql);
    await verifyOrdinaryBaseSchemaCatalogReadOnlyV1(restricted);
    assert.equal(await schemaFingerprint(database.sql), collisionBefore);
    await database.sql.unsafe("DROP TABLE public.task6a_extra_collision");
    await database.sql.unsafe(`CREATE FUNCTION public.set_config(text, text, boolean)
      RETURNS text LANGUAGE SQL AS $$ SELECT $2 $$`);
    await database.sql.unsafe(`CREATE FUNCTION public.format_type(oid, integer)
      RETURNS text LANGUAGE SQL AS $$ SELECT 'spoof'::text $$`);
    await restricted.unsafe("SET search_path TO public, pg_catalog");
    await verifyOrdinaryBaseSchemaCatalogReadOnlyV1(restricted);
    await restricted.unsafe("CREATE TEMP TABLE pg_class (spoof integer)");
    await restricted.unsafe("CREATE TEMP TABLE pg_namespace (spoof integer)");
    await restricted.unsafe("CREATE TEMP TABLE runs (spoof integer)");
    await verifyOrdinaryBaseSchemaCatalogReadOnlyV1(restricted);
    assert.equal(await schemaFingerprint(database.sql), before);

    const typeColumns = await database.sql<Array<{ definition: string }>>`
      SELECT string_agg(format('%I %s', a.attname,
        pg_catalog.format_type(a.atttypid, a.atttypmod)), ', ' ORDER BY a.attnum)
        AS definition
      FROM pg_catalog.pg_attribute a
      WHERE a.attrelid = 'public.runs'::regclass AND a.attnum > 0 AND NOT a.attisdropped
    `;
    assert.ok(typeColumns[0]?.definition);
    tablespaceDirectory = mkdtempSync(path.join(socketDirectory, "tablespace-"));
    await admin.unsafe(`CREATE TABLESPACE "${tablespace}" LOCATION '${tablespaceDirectory}'`);
    const drifts = [
      ["missing table", "DROP TABLE public.medic_checks"],
      ["runtime role owns base table", `ALTER TABLE public.rules OWNER TO "${role}"`],
      ["runtime role owns base sequence", `ALTER SEQUENCE public.runs_run_number_seq OWNER TO "${role}"`],
      ["write-suppressing rewrite rule", "CREATE RULE suppress_run_insert AS ON INSERT TO public.runs DO INSTEAD NOTHING"],
      ["disabled referencing FK triggers", "ALTER TABLE public.steps DISABLE TRIGGER ALL"],
      ["disabled referenced FK triggers", "ALTER TABLE public.runs DISABLE TRIGGER ALL"],
      ["inherited child table", "CREATE TABLE public.shadow_runs () INHERITS (public.runs)"],
      ["typed base table", `CREATE TYPE public.task6a_runs_row_type AS (${typeColumns[0].definition}); ALTER TABLE public.runs OF public.task6a_runs_row_type`],
      ["non-source tablespace", `ALTER TABLE public.medic_checks SET TABLESPACE "${tablespace}"`],
      ["non-source explicit index tablespace", `ALTER INDEX public.idx_steps_run_status SET TABLESPACE "${tablespace}"`],
      ["non-source primary-key index tablespace", `ALTER INDEX public.rules_pkey SET TABLESPACE "${tablespace}"`],
      ["non-source primary-key index options", "ALTER INDEX public.rules_pkey SET (fillfactor = 80)"],
      ["non-source table access method", "CREATE ACCESS METHOD task6a_alt_heap TYPE TABLE HANDLER heap_tableam_handler; ALTER TABLE public.runs SET ACCESS METHOD task6a_alt_heap"],
      ["non-source table options", "ALTER TABLE public.runs SET (autovacuum_enabled = false)"],
      ["non-source TOAST options", "ALTER TABLE public.runs SET (toast.autovacuum_enabled = false)"],
      ["wrong collation", "ALTER TABLE public.rules ALTER COLUMN title TYPE text COLLATE \"C\""],
      ["swapped same-shape column ordinals", "ALTER TABLE public.rules RENAME COLUMN title TO old_title; ALTER TABLE public.rules RENAME COLUMN content TO title; ALTER TABLE public.rules RENAME COLUMN old_title TO content"],
      ["explicit text compression", "ALTER TABLE public.rules ALTER COLUMN content SET COMPRESSION pglz"],
      ["non-source text storage", "ALTER TABLE public.rules ALTER COLUMN content SET STORAGE PLAIN"],
      ["stale fast-default missing value", "ALTER TABLE public.stories RENAME COLUMN output TO old_output; ALTER TABLE public.stories ADD COLUMN output text DEFAULT 'forged'; ALTER TABLE public.stories ALTER COLUMN output DROP DEFAULT"],
      ["row level security", "ALTER TABLE public.runs ENABLE ROW LEVEL SECURITY"],
      ["non-source replica identity", "ALTER TABLE public.runs REPLICA IDENTITY NOTHING"],
      ["missing column", "ALTER TABLE public.steps DROP COLUMN started_at"],
      ["dropped then readded column", "ALTER TABLE public.steps DROP COLUMN started_at; ALTER TABLE public.steps ADD COLUMN started_at TIMESTAMPTZ"],
      ["wrong type", "ALTER TABLE public.rules ALTER COLUMN title TYPE varchar(10)"],
      ["identity column", "ALTER TABLE public.steps ALTER COLUMN step_index ADD GENERATED BY DEFAULT AS IDENTITY"],
      ["wrong nullability", "ALTER TABLE public.runs ALTER COLUMN run_number DROP NOT NULL"],
      ["missing default", "ALTER TABLE public.stories ALTER COLUMN status DROP DEFAULT"],
      ["missing index", "DROP INDEX public.idx_steps_run_status"],
      ["deferred source unique index", "ALTER TABLE public.runs ADD CONSTRAINT idx_runs_run_number_unique UNIQUE USING INDEX idx_runs_run_number_unique DEFERRABLE INITIALLY DEFERRED"],
      ["missing foreign key", "ALTER TABLE public.steps DROP CONSTRAINT steps_run_id_fkey"],
      ["missing sequence", "DROP SEQUENCE public.runs_run_number_seq CASCADE"],
      ["changed sequence", "ALTER SEQUENCE public.runs_run_number_seq INCREMENT BY 2"],
      ["detached sequence", "ALTER SEQUENCE public.claim_log_id_seq OWNED BY NONE"],
    ] as const;
    for (const [label, mutation] of drifts) {
      await restricted.end({ timeout: 5 });
      restricted = undefined;
      await database.reset();
      await database.sql.unsafe("DROP ACCESS METHOD IF EXISTS task6a_alt_heap");
      await database.sql.unsafe(`GRANT USAGE ON SCHEMA public TO "${role}"`);
      await database.sql.unsafe(mutation);
      restricted = postgres({ host: socketDirectory, port: Number(parsed.port),
        database: database.database, username: role, password, max: 1 });
      const driftBefore = await schemaFingerprint(database.sql);
      await assert.rejects(
        verifyOrdinaryBaseSchemaCatalogReadOnlyV1(restricted),
        /SETFARM_BASE_SCHEMA_CATALOG_MISMATCH_V1/,
        label,
      );
      const driftAfter = await schemaFingerprint(database.sql);
      assert.equal(driftAfter, driftBefore, `${label}: verifier changed the schema`);
    }
    await restricted.end({ timeout: 5 });
    restricted = undefined;
    await database.reset();
    await database.sql.unsafe(`REVOKE USAGE ON SCHEMA public FROM "${role}"`);
    restricted = postgres({ host: socketDirectory, port: Number(parsed.port),
      database: database.database, username: role, password, max: 1 });
    const deniedUsage = await restricted<Array<{ allowed: boolean }>>`
      SELECT has_schema_privilege(current_user, 'public', 'USAGE') AS allowed
    `;
    assert.equal(deniedUsage[0]?.allowed, false);
    await assert.rejects(
      verifyOrdinaryBaseSchemaCatalogReadOnlyV1(restricted),
      /SETFARM_BASE_SCHEMA_CATALOG_MISMATCH_V1/,
      "inaccessible public schema",
    );
    const missingTarget = postgres({ host: socketDirectory, port: Number(parsed.port),
      database: `task6a_missing_${randomBytes(8).toString("hex")}`, username: role, password,
      max: 1, connect_timeout: 2 });
    try {
      await assert.rejects(
        verifyOrdinaryBaseSchemaCatalogReadOnlyV1(missingTarget),
        /SETFARM_BASE_SCHEMA_CATALOG_MISMATCH_V1/,
        "missing target database",
      );
    } finally {
      await missingTarget.end({ timeout: 5 });
    }
  } catch (error) {
    testFailure = error;
    throw error;
  } finally {
    const cleanupFailures: string[] = [];
    try { await restricted?.end({ timeout: 5 }); } catch { cleanupFailures.push("restricted_connection"); }
    try { await database?.cleanup(); } catch { cleanupFailures.push("fixture_database"); }
    try {
      if (privateClusterVerified) await admin.unsafe("DROP ACCESS METHOD IF EXISTS task6a_alt_heap");
    } catch { cleanupFailures.push("private_access_method"); }
    let tablespaceDropped = false;
    try {
      if (tablespaceDirectory) {
        await admin.unsafe(`DROP TABLESPACE IF EXISTS "${tablespace}"`);
        tablespaceDropped = true;
      }
    } catch { cleanupFailures.push("private_tablespace"); }
    try {
      if (tablespaceDirectory && tablespaceDropped) rmdirSync(tablespaceDirectory);
    } catch { cleanupFailures.push("private_tablespace_directory"); }
    try {
      if (privateClusterVerified && roleCreated) await admin.unsafe(`DROP ROLE IF EXISTS "${role}"`);
    } catch { cleanupFailures.push("private_role"); }
    try { await admin.end({ timeout: 5 }); } catch { cleanupFailures.push("admin_connection"); }
    if (cleanupFailures.length > 0) {
      const cleanupError = new Error(`ISOLATED_BASE_CATALOG_TEST_CLEANUP_FAILED:${cleanupFailures.join(",")}`);
      if (testFailure !== undefined) {
        throw new AggregateError([testFailure, cleanupError],
          "ISOLATED_BASE_CATALOG_TEST_AND_CLEANUP_FAILED");
      }
      throw cleanupError;
    }
  }
});
