import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { test } from "node:test";

import postgres from "postgres";

import { createIsolatedTestDatabase, type TestDatabase } from "./test-database.js";
import { requireTask6aPrivateLoopbackHostname } from "./task6a-private-cluster-loopback.js";

const expectedDataDirectory = process.env.SETFARM_TASK6A_TEST_PG_DATA_DIRECTORY;

function permissionDenied(error: unknown): boolean {
  return error !== null && typeof error === "object" && "code" in error
    && error.code === "42501";
}

function sequencePermissionDenied(error: unknown): boolean {
  return permissionDenied(error) && error !== null && typeof error === "object"
    && "message" in error
    && typeof error.message === "string"
    && error.message.includes("runs_run_number_seq");
}

async function fingerprint(sql: postgres.Sql): Promise<string> {
  const rows = await sql<Array<{ value: string }>>`
    SELECT md5(jsonb_build_object(
      'relations', (SELECT jsonb_agg(jsonb_build_array(c.relname, c.relkind,
        c.relowner::text, c.reloptions) ORDER BY c.relname) FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'),
      'columns', (SELECT jsonb_agg(jsonb_build_array(c.relname, a.attname,
        a.atttypid::text, a.attnotnull) ORDER BY c.relname, a.attname)
        FROM pg_catalog.pg_attribute a JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND a.attnum > 0 AND NOT a.attisdropped)
    )::text) AS value`;
  assert.match(rows[0]?.value ?? "", /^[a-f0-9]{32}$/);
  return rows[0]!.value;
}

test("private restricted startup fences DDL and scopes the first run-number write", {
  skip: expectedDataDirectory ? false : "requires an explicitly identified private PostgreSQL 17 cluster",
}, async () => {
  assert.equal(process.env.SETFARM_PG_URL, undefined);
  assert.match(expectedDataDirectory!, /^\/tmp\/setfarm-task6a-pg\.[A-Za-z0-9]+\/data$/);
  const adminUrl = process.env.SETFARM_TEST_PG_ADMIN_URL;
  assert.ok(adminUrl);
  const parsed = new URL(adminUrl);
  assert.equal(parsed.pathname, "/postgres");
  const hostname = requireTask6aPrivateLoopbackHostname(parsed);
  assert.notEqual(parsed.port, "5432");
  const admin = postgres(adminUrl, { max: 1 });
  const role = `task6a_private_restricted_${randomBytes(6).toString("hex")}`;
  const password = randomBytes(24).toString("hex");
  let database: TestDatabase | undefined;
  let restrictedDb: typeof import("../../src/db-pg.js") | undefined;
  let roleCreated = false;
  let failure: unknown;
  let stage = "private-cluster-preflight";
  try {
    const identity = await admin<Array<{ dataDirectory: string; port: string;
      socketDirectories: string; version: number }>>`SELECT
      current_setting('data_directory') AS "dataDirectory",
      current_setting('port') AS port,
      current_setting('unix_socket_directories') AS "socketDirectories",
      current_setting('server_version_num')::integer AS version`;
    assert.equal(identity[0]?.dataDirectory, expectedDataDirectory);
    assert.equal(identity[0]?.port, parsed.port);
    assert.ok(identity[0]?.socketDirectories.split(",").map((value) => value.trim())
      .includes(path.dirname(expectedDataDirectory!)));
    assert.ok(identity[0]!.version >= 170000 && identity[0]!.version < 180000);

    stage = "isolated-database";
    database = await createIsolatedTestDatabase();
    const ownerRows = await database.sql<Array<{ owner: string }>>`SELECT current_user AS owner`;
    const owner = ownerRows[0]?.owner;
    assert.match(owner ?? "", /^[a-z_][a-z0-9_]{0,62}$/);
    const existing = await admin<Array<{ count: string }>>`
      SELECT count(*)::text AS count FROM pg_catalog.pg_roles WHERE rolname = ${role}`;
    assert.equal(existing[0]?.count, "0");

    stage = "restricted-role";
    roleCreated = true;
    try {
      await admin.unsafe(`CREATE ROLE "${role}" LOGIN PASSWORD '${password}'
        NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`);
    } catch { throw new Error("TASK6A_PRIVATE_RESTRICTED_ROLE_CREATE_FAILED"); }
    await admin.unsafe(`GRANT CONNECT ON DATABASE "${database.database}" TO "${role}"`);
    await database.sql.unsafe(`GRANT USAGE ON SCHEMA public TO "${role}"`);
    await database.sql.unsafe(`GRANT SELECT ON public.setfarm_schema_migrations TO "${role}"`);
    const restrictedUrl = new URL(database.url);
    restrictedUrl.username = role;
    restrictedUrl.password = password;
    restrictedUrl.hostname = hostname;
    restrictedUrl.port = parsed.port;
    const probe = postgres(restrictedUrl.toString(), { max: 1 });
    try {
      const rights = await probe<Array<{ login: string; effective: string;
        superuser: boolean; bypass: boolean; createRole: boolean; createDatabase: boolean;
        ownerMember: boolean; databaseCreate: boolean; schemaCreate: boolean;
        sequenceUsage: boolean; sequenceUpdate: boolean; journalUpdate: boolean;
        tableDml: boolean[] }>>`
        SELECT session_user AS login, current_user AS effective,
          r.rolsuper AS superuser, r.rolbypassrls AS bypass,
          r.rolcreaterole AS "createRole", r.rolcreatedb AS "createDatabase",
          pg_catalog.pg_has_role(session_user, o.oid, 'MEMBER') AS "ownerMember",
          has_database_privilege(current_user, current_database(), 'CREATE') AS "databaseCreate",
          has_schema_privilege(current_user, 'public', 'CREATE') AS "schemaCreate",
          has_sequence_privilege(current_user, 'public.runs_run_number_seq', 'USAGE') AS "sequenceUsage",
          has_sequence_privilege(current_user, 'public.runs_run_number_seq', 'UPDATE') AS "sequenceUpdate",
          has_table_privilege(current_user, 'public.setfarm_schema_migrations', 'UPDATE') AS "journalUpdate",
          ARRAY(SELECT has_table_privilege(current_user, name, privilege)
            FROM unnest(ARRAY['public.runs', 'public.steps', 'public.claim_log',
              'public.execution_attempts', 'public.runtime_sessions']) AS tables(name)
            CROSS JOIN unnest(ARRAY['INSERT', 'UPDATE', 'DELETE']) AS rights(privilege)) AS "tableDml"
        FROM pg_catalog.pg_roles r CROSS JOIN pg_catalog.pg_roles o
        WHERE r.rolname = session_user AND o.rolname = ${owner}`;
      assert.deepEqual(rights[0], { login: role, effective: role, superuser: false,
        bypass: false, createRole: false, createDatabase: false,
        ownerMember: false, databaseCreate: false, schemaCreate: false,
        sequenceUsage: false, sequenceUpdate: false, journalUpdate: false,
        tableDml: Array(15).fill(false) });
    } finally { await probe.end({ timeout: 5 }); }

    restrictedDb = await import(`../../src/db-pg.ts?task6a-restricted-startup=${database.database}`);
    restrictedDb.pgConfigureIsolatedTestDatabase(restrictedUrl.toString());
    const before = await fingerprint(database.sql);
    stage = "restricted-initialization";
    await restrictedDb.prepareTask6aRestrictedSpawnerDatabaseV1(owner!);
    await assert.rejects(restrictedDb.prepareTask6aRestrictedSpawnerDatabaseV1(owner!),
      /TASK6A_RESTRICTED_DATABASE_STARTUP_ALREADY_USED/);
    await assert.rejects(restrictedDb.pgNextRunNumber(), sequencePermissionDenied);

    stage = "scoped-first-write-grant";
    await database.sql.unsafe(`GRANT USAGE ON SEQUENCE public.runs_run_number_seq TO "${role}"`);
    const scopedRights = await database.sql<Array<{ sequenceUsage: boolean;
      sequenceUpdate: boolean; journalUpdate: boolean; databaseCreate: boolean;
      schemaCreate: boolean; tableDml: boolean[] }>>`
      SELECT has_sequence_privilege(${role}, 'public.runs_run_number_seq', 'USAGE') AS "sequenceUsage",
        has_sequence_privilege(${role}, 'public.runs_run_number_seq', 'UPDATE') AS "sequenceUpdate",
        has_table_privilege(${role}, 'public.setfarm_schema_migrations', 'UPDATE') AS "journalUpdate",
        has_database_privilege(${role}, current_database(), 'CREATE') AS "databaseCreate",
        has_schema_privilege(${role}, 'public', 'CREATE') AS "schemaCreate",
        ARRAY(SELECT has_table_privilege(${role}, name, privilege)
          FROM unnest(ARRAY['public.runs', 'public.steps', 'public.claim_log',
            'public.execution_attempts', 'public.runtime_sessions']) AS tables(name)
          CROSS JOIN unnest(ARRAY['INSERT', 'UPDATE', 'DELETE']) AS rights(privilege)) AS "tableDml"`;
    assert.deepEqual(scopedRights[0], { sequenceUsage: true, sequenceUpdate: false,
      journalUpdate: false, databaseCreate: false, schemaCreate: false,
      tableDml: Array(15).fill(false) });
    const first = await restrictedDb.pgNextRunNumber();
    const second = await restrictedDb.pgNextRunNumber();
    assert.ok(Number.isSafeInteger(first) && first > 0);
    assert.equal(second, first + 1);
    const sequenceState = await database.sql<Array<{ lastValue: string }>>`
      SELECT last_value::text AS "lastValue" FROM public.runs_run_number_seq`;
    assert.equal(Number(sequenceState[0]?.lastValue), second);
    await assert.rejects(restrictedDb.pgQuery("INSERT INTO public.runs DEFAULT VALUES"), permissionDenied);
    await assert.rejects(restrictedDb.pgQuery("CREATE TABLE public.task6a_forbidden (id integer)"),
      permissionDenied);
    assert.equal((await restrictedDb.pgQuery<{ value: number }>("SELECT 1 AS value"))[0]?.value, 1);
    assert.equal(await fingerprint(database.sql), before);
    await assert.rejects(restrictedDb.pgMigrate(), /TASK6A_RESTRICTED_DEFAULT_MIGRATION_FORBIDDEN/);

    stage = "post-close-latch";
    await restrictedDb.pgClose();
    restrictedDb.pgConfigureIsolatedTestDatabase(restrictedUrl.toString());
    await assert.rejects(restrictedDb.initializeInternalProductionCurrentEntryDatabaseV1(),
      /TASK6A_RESTRICTED_DATABASE_NOT_VERIFIED/);
    await assert.rejects(restrictedDb.pgQuery("SELECT 1"),
      /TASK6A_RESTRICTED_DATABASE_NOT_VERIFIED/);
    await assert.rejects(restrictedDb.pgMigrate(),
      /TASK6A_RESTRICTED_DEFAULT_MIGRATION_FORBIDDEN/);
    assert.equal(await fingerprint(database.sql), before);
    await restrictedDb.pgMigrate({ baseSchemaMode: "verify", expectedSchemaOwner: owner });
    assert.equal((await restrictedDb.pgQuery<{ value: number }>("SELECT 1 AS value"))[0]?.value, 1);

    stage = "concurrent-close-verification";
    const pendingVerification = assert.rejects(restrictedDb.pgMigrate({
      baseSchemaMode: "verify", expectedSchemaOwner: owner,
    }), /TASK6A_RESTRICTED_DATABASE_NOT_VERIFIED|SETFARM_BASE_SCHEMA_VERIFY_REFUSED/);
    const pendingClose = restrictedDb.pgClose();
    await assert.rejects(restrictedDb.pgQuery("SELECT 1"),
      /TASK6A_RESTRICTED_DATABASE_NOT_VERIFIED/);
    await Promise.all([pendingVerification, pendingClose]);
    restrictedDb.pgConfigureIsolatedTestDatabase(restrictedUrl.toString());
    await assert.rejects(restrictedDb.pgQuery("SELECT 1"),
      /TASK6A_RESTRICTED_DATABASE_NOT_VERIFIED/);

    stage = "drift-fail-closed";
    await database.sql.unsafe("DROP INDEX public.idx_steps_run_status");
    const drifted = await fingerprint(database.sql);
    restrictedDb.pgConfigureIsolatedTestDatabase(restrictedUrl.toString());
    await assert.rejects(restrictedDb.pgMigrate({ baseSchemaMode: "verify",
      expectedSchemaOwner: owner }), /SETFARM_BASE_SCHEMA_VERIFY_REFUSED/);
    await assert.rejects(restrictedDb.pgQuery("SELECT 1"),
      /TASK6A_RESTRICTED_DATABASE_NOT_VERIFIED/);
    assert.equal(await fingerprint(database.sql), drifted);
  } catch (error) {
    failure = error;
    process.stderr.write(`[task6a-private-restricted-startup] failed at ${stage}\n`);
    throw error;
  } finally {
    const cleanupFailures: string[] = [];
    try { await restrictedDb?.pgClose(); } catch { cleanupFailures.push("restricted_connection"); }
    try { await database?.cleanup(); } catch { cleanupFailures.push("fixture_database"); }
    try { if (roleCreated) await admin.unsafe(`DROP ROLE IF EXISTS "${role}"`); }
    catch { cleanupFailures.push("restricted_role"); }
    try { await admin.end({ timeout: 5 }); } catch { cleanupFailures.push("admin_connection"); }
    if (cleanupFailures.length > 0) {
      const cleanupError = new Error(`TASK6A_PRIVATE_RESTRICTED_STARTUP_CLEANUP_FAILED:${cleanupFailures.join(",")}`);
      if (failure !== undefined) throw new AggregateError([failure, cleanupError],
        "TASK6A_PRIVATE_RESTRICTED_STARTUP_TEST_AND_CLEANUP_FAILED");
      throw cleanupError;
    }
  }
});
