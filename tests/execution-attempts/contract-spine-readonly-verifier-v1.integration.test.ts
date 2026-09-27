import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import path from "node:path";

import postgres from "postgres";

import { verifyContractSpineCurrentHeadJournalReadOnlyV1 } from "../../src/db/contract-spine-readonly-verifier-v1.js";
import { createIsolatedTestDatabase, type TestDatabase } from "./test-database.js";

const expectedDataDirectory = process.env.SETFARM_TASK6A_TEST_PG_DATA_DIRECTORY;

async function journalFingerprint(sql: postgres.Sql): Promise<string> {
  const rows = await sql<Array<{ fingerprint: string }>>`
    SELECT md5(jsonb_build_object(
      'relation', (SELECT jsonb_build_array(c.relkind, c.relpersistence,
        c.relispartition, c.relrowsecurity, c.relforcerowsecurity,
        c.reloftype::text, c.reltablespace::text, c.reloptions,
        c.relreplident, c.relowner::text, c.relacl)
        FROM pg_catalog.pg_class c
        WHERE c.oid = 'public.setfarm_schema_migrations'::pg_catalog.regclass),
      'columns', (SELECT jsonb_agg(jsonb_build_array(a.attname, a.attnum,
        pg_catalog.format_type(a.atttypid, a.atttypmod), a.attnotnull,
        a.attcollation::text, a.attidentity, a.attgenerated,
        a.atthasmissing, a.attmissingval::text, a.attstorage,
        a.attcompression::text, pg_catalog.pg_get_expr(d.adbin, d.adrelid))
        ORDER BY a.attnum)
        FROM pg_catalog.pg_attribute a
        LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
        WHERE a.attrelid = 'public.setfarm_schema_migrations'::pg_catalog.regclass
          AND a.attnum > 0),
      'constraints', (SELECT jsonb_agg(jsonb_build_array(co.conname,
        pg_catalog.pg_get_constraintdef(co.oid, true), co.convalidated,
        co.condeferrable, co.condeferred, co.connoinherit) ORDER BY co.conname)
        FROM pg_catalog.pg_constraint co
        WHERE co.conrelid = 'public.setfarm_schema_migrations'::pg_catalog.regclass),
      'indexes', (SELECT jsonb_agg(jsonb_build_array(ic.relname,
        pg_catalog.pg_get_indexdef(i.indexrelid), ic.reltablespace::text,
        ic.reloptions, i.indisvalid, i.indisready, i.indimmediate)
        ORDER BY ic.relname)
        FROM pg_catalog.pg_index i
        JOIN pg_catalog.pg_class ic ON ic.oid = i.indexrelid
        WHERE i.indrelid = 'public.setfarm_schema_migrations'::pg_catalog.regclass),
      'rules', (SELECT jsonb_agg(jsonb_build_array(r.rulename,
        pg_catalog.pg_get_ruledef(r.oid)) ORDER BY r.rulename)
        FROM pg_catalog.pg_rewrite r
        WHERE r.ev_class = 'public.setfarm_schema_migrations'::pg_catalog.regclass),
      'triggers', (SELECT jsonb_agg(jsonb_build_array(t.tgname,
        t.tgenabled, t.tgisinternal) ORDER BY t.tgname)
        FROM pg_catalog.pg_trigger t
        WHERE t.tgrelid = 'public.setfarm_schema_migrations'::pg_catalog.regclass),
      'policies', (SELECT jsonb_agg(jsonb_build_array(p.polname,
        p.polcmd, p.polpermissive) ORDER BY p.polname)
        FROM pg_catalog.pg_policy p
        WHERE p.polrelid = 'public.setfarm_schema_migrations'::pg_catalog.regclass),
      'access', (SELECT jsonb_build_array(n.nspacl, d.datacl)
        FROM pg_catalog.pg_namespace n CROSS JOIN pg_catalog.pg_database d
        WHERE n.nspname = 'public' AND d.datname = current_database()),
      'journal', (SELECT jsonb_agg(to_jsonb(j) ORDER BY j.version)
        FROM public.setfarm_schema_migrations j)
    )::text) AS fingerprint
  `;
  assert.match(rows[0]?.fingerprint ?? "", /^[a-f0-9]{32}$/);
  return rows[0]!.fingerprint;
}

test("a distinct SELECT-only login verifies the current journal and refuses revoked SELECT", {
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
  const admin = postgres(adminUrl, { max: 1 });
  let database: TestDatabase | undefined;
  let restricted: postgres.Sql | undefined;
  let privateClusterVerified = false;
  let roleCleanupEligible = false;
  let writerRoleCleanupEligible = false;
  let testFailure: unknown;
  const role = `task6a_journal_v1_${randomBytes(6).toString("hex")}`;
  const writerRole = `task6a_journal_writer_v1_${randomBytes(6).toString("hex")}`;
  try {
    const identity = await admin<Array<{
      data_directory: string;
      port: string;
      socket_directories: string;
    }>>`
      SELECT current_setting('data_directory') AS data_directory,
        current_setting('port') AS port,
        current_setting('unix_socket_directories') AS socket_directories
    `;
    assert.equal(identity[0]?.data_directory, expectedDataDirectory);
    assert.equal(identity[0]?.port, parsed.port);
    const socketDirectory = path.dirname(expectedDataDirectory!);
    assert.ok(identity[0]?.socket_directories.split(",").map((value) => value.trim())
      .includes(socketDirectory));
    privateClusterVerified = true;
    const existingRoles = await admin<Array<{ name: string }>>`
      SELECT rolname AS name FROM pg_catalog.pg_roles
      WHERE rolname IN (${role}, ${writerRole})
    `;
    assert.equal(existingRoles.length, 0, "random private role names must be unused");
    roleCleanupEligible = true;
    writerRoleCleanupEligible = true;

    database = await createIsolatedTestDatabase();
    try {
      await admin.unsafe(`CREATE ROLE "${role}" LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`);
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "42710") {
        roleCleanupEligible = false;
      }
      throw error;
    }
    await admin.unsafe(`GRANT CONNECT ON DATABASE "${database.database}" TO "${role}"`);
    await database.sql.unsafe(`GRANT USAGE ON SCHEMA public TO "${role}"`);
    await database.sql.unsafe(`GRANT SELECT ON public.setfarm_schema_migrations TO "${role}"`);
    restricted = postgres({ host: socketDirectory, port: Number(parsed.port),
      database: database.database, username: role, max: 1 });
    const rights = await restricted<Array<{
      login: string;
      database_create: boolean;
      schema_create: boolean;
      journal_select: boolean;
      journal_maintain: boolean;
    }>>`
      SELECT session_user AS login,
        has_database_privilege(current_user, current_database(), 'CREATE') AS database_create,
        has_schema_privilege(current_user, 'public', 'CREATE') AS schema_create,
        has_table_privilege(current_user, 'public.setfarm_schema_migrations', 'SELECT') AS journal_select,
        has_table_privilege(current_user, 'public.setfarm_schema_migrations', 'MAINTAIN') AS journal_maintain
    `;
    assert.deepEqual(rights[0], { login: role, database_create: false,
      schema_create: false, journal_select: true, journal_maintain: false });
    const before = await journalFingerprint(database.sql);
    await verifyContractSpineCurrentHeadJournalReadOnlyV1(restricted);
    assert.equal(await journalFingerprint(database.sql), before);
    await database.sql.unsafe(`CREATE FUNCTION public.set_config(text, text, boolean)
      RETURNS text LANGUAGE SQL AS $$ SELECT $2 $$`);
    await database.sql.unsafe(`CREATE FUNCTION public.format_type(oid, integer)
      RETURNS text LANGUAGE SQL AS $$ SELECT 'spoof'::text $$`);
    await restricted.unsafe("SET search_path TO public, pg_catalog");
    await restricted.unsafe("CREATE TEMP TABLE pg_class (spoof integer)");
    await restricted.unsafe("CREATE TEMP TABLE pg_attribute (spoof integer)");
    await restricted.unsafe("CREATE TEMP TABLE setfarm_schema_migrations (spoof integer)");
    await verifyContractSpineCurrentHeadJournalReadOnlyV1(restricted);
    assert.equal(await journalFingerprint(database.sql), before);

    await database.sql.unsafe(`REVOKE SELECT ON public.setfarm_schema_migrations FROM "${role}"`);
    await assert.rejects(verifyContractSpineCurrentHeadJournalReadOnlyV1(restricted),
      /SETFARM_CURRENT_HEAD_JOURNAL_CATALOG_MISMATCH_V1/);
    const drifts = [
      ["extra journal column", "ALTER TABLE public.setfarm_schema_migrations ADD COLUMN unexpected text"],
      ["missing journal column", "ALTER TABLE public.setfarm_schema_migrations DROP COLUMN release_sha"],
      ["changed journal default", "ALTER TABLE public.setfarm_schema_migrations ALTER COLUMN applied_at SET DEFAULT '2000-01-01'::timestamptz"],
      ["non-source journal options", "ALTER TABLE public.setfarm_schema_migrations SET (autovacuum_enabled = false)"],
      ["journal row-level security", "ALTER TABLE public.setfarm_schema_migrations ENABLE ROW LEVEL SECURITY"],
      ["journal rewrite rule", "CREATE RULE task6a_suppress_journal_insert AS ON INSERT TO public.setfarm_schema_migrations DO INSTEAD NOTHING"],
      ["journal user trigger", "CREATE FUNCTION public.task6a_journal_noop() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$; CREATE TRIGGER task6a_journal_noop BEFORE INSERT ON public.setfarm_schema_migrations FOR EACH ROW EXECUTE FUNCTION public.task6a_journal_noop()"],
      ["incoming journal foreign key", "CREATE TABLE public.task6a_journal_fk (name text REFERENCES public.setfarm_schema_migrations(name))"],
      ["extra journal index", "CREATE INDEX task6a_extra_journal_idx ON public.setfarm_schema_migrations(state)"],
      ["altered journal index", "ALTER INDEX public.setfarm_schema_migrations_name_key SET (fillfactor = 80)"],
      ["missing journal constraint", "ALTER TABLE public.setfarm_schema_migrations DROP CONSTRAINT setfarm_schema_migrations_verified_pair_check"],
      ["wrong guarded migration state", "UPDATE public.setfarm_schema_migrations SET state = 'adopted' WHERE version = 32"],
      ["changed current-head checksum", "UPDATE public.setfarm_schema_migrations SET checksum = repeat('0', 64) WHERE version = 33"],
      ["extra migration row", "INSERT INTO public.setfarm_schema_migrations(version,name,checksum,state) VALUES (34,'future',repeat('0',64),'applied')"],
      ["missing current-head journal row", "DELETE FROM public.setfarm_schema_migrations WHERE version = 33"],
    ] as const;
    for (const [label, mutation] of drifts) {
      await restricted.end({ timeout: 5 });
      restricted = undefined;
      await database.reset();
      await database.sql.unsafe(`GRANT USAGE ON SCHEMA public TO "${role}"`);
      await database.sql.unsafe(`GRANT SELECT ON public.setfarm_schema_migrations TO "${role}"`);
      await database.sql.unsafe(mutation);
      restricted = postgres({ host: socketDirectory, port: Number(parsed.port),
        database: database.database, username: role, max: 1 });
      const driftBefore = await journalFingerprint(database.sql);
      await assert.rejects(verifyContractSpineCurrentHeadJournalReadOnlyV1(restricted),
        /SETFARM_CURRENT_HEAD_JOURNAL_CATALOG_MISMATCH_V1/, label);
      assert.equal(await journalFingerprint(database.sql), driftBefore,
        `${label}: verifier changed the journal catalog`);
    }
    await restricted.end({ timeout: 5 });
    restricted = undefined;
    await database.reset();
    await database.sql.unsafe(`GRANT USAGE ON SCHEMA public TO "${role}"`);
    await database.sql.unsafe(`GRANT SELECT ON public.setfarm_schema_migrations TO "${role}"`);
    restricted = postgres({ host: socketDirectory, port: Number(parsed.port),
      database: database.database, username: role, max: 1 });
    await database.sql.unsafe(`GRANT CREATE ON SCHEMA public TO "${role}"`);
    await assert.rejects(verifyContractSpineCurrentHeadJournalReadOnlyV1(restricted),
      /SETFARM_CURRENT_HEAD_JOURNAL_CATALOG_MISMATCH_V1/,
      "schema CREATE capability");
    await database.sql.unsafe(`REVOKE CREATE ON SCHEMA public FROM "${role}"`);
    await admin.unsafe(`GRANT CREATE ON DATABASE "${database.database}" TO "${role}"`);
    await assert.rejects(verifyContractSpineCurrentHeadJournalReadOnlyV1(restricted),
      /SETFARM_CURRENT_HEAD_JOURNAL_CATALOG_MISMATCH_V1/,
      "database CREATE capability");
    await admin.unsafe(`REVOKE CREATE ON DATABASE "${database.database}" FROM "${role}"`);
    await database.sql.unsafe(`GRANT MAINTAIN ON public.setfarm_schema_migrations TO "${role}"`);
    await assert.rejects(verifyContractSpineCurrentHeadJournalReadOnlyV1(restricted),
      /SETFARM_CURRENT_HEAD_JOURNAL_CATALOG_MISMATCH_V1/,
      "journal MAINTAIN capability");
    await database.sql.unsafe(`REVOKE MAINTAIN ON public.setfarm_schema_migrations FROM "${role}"`);
    await database.sql.unsafe(`GRANT INSERT ON public.setfarm_schema_migrations TO "${role}"`);
    await assert.rejects(verifyContractSpineCurrentHeadJournalReadOnlyV1(restricted),
      /SETFARM_CURRENT_HEAD_JOURNAL_CATALOG_MISMATCH_V1/,
      "journal INSERT capability");
    await database.sql.unsafe(`REVOKE INSERT ON public.setfarm_schema_migrations FROM "${role}"`);
    await database.sql.unsafe(`GRANT UPDATE(applied_at) ON public.setfarm_schema_migrations TO "${role}"`);
    await assert.rejects(verifyContractSpineCurrentHeadJournalReadOnlyV1(restricted),
      /SETFARM_CURRENT_HEAD_JOURNAL_CATALOG_MISMATCH_V1/,
      "journal column UPDATE capability");
    await database.sql.unsafe(`REVOKE UPDATE(applied_at) ON public.setfarm_schema_migrations FROM "${role}"`);
    try {
      await admin.unsafe(`CREATE ROLE "${writerRole}" NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`);
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "42710") {
        writerRoleCleanupEligible = false;
      }
      throw error;
    }
    await database.sql.unsafe(`GRANT INSERT ON public.setfarm_schema_migrations TO "${writerRole}"`);
    await admin.unsafe(`GRANT "${writerRole}" TO "${role}" WITH INHERIT FALSE, SET TRUE`);
    const reachable = await restricted<Array<{ inheritedWrite: boolean; settableWriter: boolean }>>`
      SELECT pg_catalog.has_table_privilege(current_user,
        'public.setfarm_schema_migrations', 'INSERT') AS "inheritedWrite",
        pg_catalog.pg_has_role(session_user, ${writerRole}, 'SET') AS "settableWriter"
    `;
    assert.deepEqual(reachable[0], { inheritedWrite: false, settableWriter: true });
    await assert.rejects(verifyContractSpineCurrentHeadJournalReadOnlyV1(restricted),
      /SETFARM_CURRENT_HEAD_JOURNAL_CATALOG_MISMATCH_V1/,
      "NOINHERIT login can SET ROLE to a journal writer");
    await admin.unsafe(`REVOKE "${writerRole}" FROM "${role}"`);
    await admin.unsafe(`GRANT "${writerRole}" TO "${role}" WITH ADMIN TRUE, INHERIT FALSE, SET FALSE`);
    const administrable = await restricted<Array<{ settableWriter: boolean; adminWriter: boolean }>>`
      SELECT pg_catalog.pg_has_role(session_user, ${writerRole}, 'SET') AS "settableWriter",
        pg_catalog.pg_has_role(session_user, ${writerRole}, 'MEMBER WITH ADMIN OPTION') AS "adminWriter"
    `;
    assert.deepEqual(administrable[0], { settableWriter: false, adminWriter: true });
    await assert.rejects(verifyContractSpineCurrentHeadJournalReadOnlyV1(restricted),
      /SETFARM_CURRENT_HEAD_JOURNAL_CATALOG_MISMATCH_V1/,
      "NOINHERIT login can self-grant SET to a journal writer");
    const missingTarget = postgres({ host: socketDirectory, port: Number(parsed.port),
      database: `task6a_missing_${randomBytes(8).toString("hex")}`, username: role,
      max: 1, connect_timeout: 2 });
    try {
      await assert.rejects(verifyContractSpineCurrentHeadJournalReadOnlyV1(missingTarget),
        /SETFARM_CURRENT_HEAD_JOURNAL_CATALOG_MISMATCH_V1/,
        "missing target database");
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
      if (privateClusterVerified && roleCleanupEligible) await admin.unsafe(`DROP ROLE IF EXISTS "${role}"`);
    } catch { cleanupFailures.push("private_role"); }
    try {
      if (privateClusterVerified && writerRoleCleanupEligible) await admin.unsafe(`DROP ROLE IF EXISTS "${writerRole}"`);
    } catch { cleanupFailures.push("private_writer_role"); }
    try { await admin.end({ timeout: 5 }); } catch { cleanupFailures.push("admin_connection"); }
    if (cleanupFailures.length > 0) {
      const cleanupError = new Error(`ISOLATED_JOURNAL_TEST_CLEANUP_FAILED:${cleanupFailures.join(",")}`);
      if (testFailure !== undefined) {
        throw new AggregateError([testFailure, cleanupError],
          "ISOLATED_JOURNAL_TEST_AND_CLEANUP_FAILED");
      }
      throw cleanupError;
    }
  }
});
