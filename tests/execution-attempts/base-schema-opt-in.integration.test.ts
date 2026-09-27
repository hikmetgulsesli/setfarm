import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import path from "node:path";

import postgres from "postgres";

import { createIsolatedTestDatabase, type TestDatabase } from "./test-database.js";

const expectedDataDirectory = process.env.SETFARM_TASK6A_TEST_PG_DATA_DIRECTORY;

test("current-entry initializer rechecks verify-only mode after its asynchronous authority read", async () => {
  const source = await readFile(path.join(process.cwd(), "src/db-pg.ts"), "utf8");
  const start = source.indexOf("export async function initializeInternalProductionCurrentEntryDatabaseV1(");
  const end = source.indexOf("async function ensureSchemaReady()", start);
  assert.ok(start >= 0 && end > start);
  const initializer = source.slice(start, end);
  assert.match(initializer,
    /await verifyInternalProductionCurrentEntryDatabaseThroughMigration33AndManifestAV1\(\);\s*if \(_verificationOnlyMode\) throw new Error\("SETFARM_BASE_SCHEMA_VERIFY_INCOMPLETE"\);\s*_schemaReady = true;/);
});

async function schemaFingerprint(sql: postgres.Sql): Promise<string> {
  const rows = await sql<Array<{ fingerprint: string }>>`
    SELECT md5(jsonb_build_object(
      'relations', (SELECT jsonb_agg(jsonb_build_array(c.relname, c.relkind,
        c.relowner::text, c.reloptions, c.relrowsecurity, c.relforcerowsecurity)
        ORDER BY c.relname) FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'),
      'columns', (SELECT jsonb_agg(jsonb_build_array(c.relname, a.attname,
        a.atttypid::text, a.attnotnull, pg_catalog.pg_get_expr(d.adbin, d.adrelid))
        ORDER BY c.relname, a.attname) FROM pg_catalog.pg_attribute a
        JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid = c.oid AND d.adnum = a.attnum
        WHERE n.nspname = 'public' AND a.attnum > 0 AND NOT a.attisdropped),
      'indexes', (SELECT jsonb_agg(pg_catalog.pg_get_indexdef(i.indexrelid)
        ORDER BY ic.relname) FROM pg_catalog.pg_index i
        JOIN pg_catalog.pg_class ic ON ic.oid = i.indexrelid
        JOIN pg_catalog.pg_namespace n ON n.oid = ic.relnamespace
        WHERE n.nspname = 'public')
    )::text) AS fingerprint
  `;
  assert.match(rows[0]?.fingerprint ?? "", /^[a-f0-9]{32}$/);
  return rows[0]!.fingerprint;
}

test("pgMigrate opt-in verifies an isolated database with a restricted login and never repairs drift", {
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
  let restrictedDb: typeof import("../../src/db-pg.js") | undefined;
  const role = `task6a_optin_${randomBytes(6).toString("hex")}`;
  const foreignOwner = `task6a_foreign_${randomBytes(6).toString("hex")}`;
  const password = randomBytes(24).toString("hex");
  let roleCreated = false;
  let foreignOwnerCreated = false;
  let stage = "private-cluster-preflight";
  let testFailure: unknown;
  try {
    const identity = await admin<Array<{ data_directory: string; port: string; socket_directories: string }>>`
      SELECT current_setting('data_directory') AS data_directory,
        current_setting('port') AS port,
        current_setting('unix_socket_directories') AS socket_directories
    `;
    assert.equal(identity[0]?.data_directory, expectedDataDirectory);
    assert.equal(identity[0]?.port, parsed.port);
    assert.ok(identity[0]?.socket_directories.split(",").map((value) => value.trim())
      .includes(path.dirname(expectedDataDirectory!)));

    stage = "create-isolated-fixture";
    database = await createIsolatedTestDatabase();
    const ownerRows = await database.sql<Array<{ owner: string }>>`SELECT current_user AS owner`;
    const expectedSchemaOwner = ownerRows[0]?.owner;
    assert.match(expectedSchemaOwner ?? "", /^[a-z_][a-z0-9_]{0,62}$/);
    stage = "create-restricted-role";
    const existingRole = await admin<Array<{ exists: boolean }>>`
      SELECT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = ${role}) AS exists
    `;
    assert.equal(existingRole[0]?.exists, false);
    roleCreated = true;
    try {
      await admin.unsafe(`CREATE ROLE "${role}" LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`);
    } catch {
      throw new Error("TASK6A_PRIVATE_ROLE_CREATE_FAILED");
    }
    await admin.unsafe(`GRANT CONNECT ON DATABASE "${database.database}" TO "${role}"`);
    await database.sql.unsafe(`GRANT USAGE ON SCHEMA public TO "${role}"`);
    await database.sql.unsafe(`GRANT SELECT ON public.setfarm_schema_migrations TO "${role}"`);

    const restrictedUrl = new URL(database.url);
    restrictedUrl.username = role;
    restrictedUrl.password = password;
    restrictedUrl.hostname = "127.0.0.1";
    restrictedUrl.port = parsed.port;
    restrictedDb = await import(`../../src/db-pg.ts?task6a-optin=${database.database}`);
    restrictedDb.pgConfigureIsolatedTestDatabase(restrictedUrl.toString());

    stage = "restricted-login-check";
    const before = await schemaFingerprint(database.sql);
    const restrictedProbe = postgres(restrictedUrl.toString(), { max: 1 });
    let rights: Array<{ login: string; effective: string; database_create: boolean;
      schema_create: boolean; journal_maintain: boolean }>;
    try {
      rights = await restrictedProbe`
        SELECT session_user AS login, current_user AS effective,
          has_database_privilege(current_user, current_database(), 'CREATE') AS database_create,
          has_schema_privilege(current_user, 'public', 'CREATE') AS schema_create,
          has_table_privilege(current_user, 'public.setfarm_schema_migrations', 'MAINTAIN') AS journal_maintain
      `;
    } finally {
      await restrictedProbe.end({ timeout: 5 });
    }
    assert.deepEqual(rights[0], { login: role, effective: role,
      database_create: false, schema_create: false, journal_maintain: false });

    stage = "public-opt-in-verification";
    const first = restrictedDb.pgMigrate({ baseSchemaMode: "verify", expectedSchemaOwner })
      .then(() => null, (error: unknown) => error);
    const second = restrictedDb.pgMigrate({ baseSchemaMode: "verify", expectedSchemaOwner })
      .then(() => null, (error: unknown) => error);
    const [firstError, secondError] = await Promise.all([first, second]);
    assert.match(String(secondError), /SETFARM_BASE_SCHEMA_VERIFY_CONCURRENT/);
    if (firstError) throw firstError;
    assert.equal(await schemaFingerprint(database.sql), before);
    const verifiedQuery = await restrictedDb.pgQuery<{ value: number }>("SELECT 1 AS value");
    assert.equal(verifiedQuery.length, 1);
    assert.equal(verifiedQuery[0]?.value, 1);
    await assert.rejects(restrictedDb.pgMigrate({ baseSchemaMode: "verify", contractSpineMode: "apply" }),
      /SETFARM_BASE_SCHEMA_VERIFY_MODE_INVALID/);
    await assert.rejects(restrictedDb.pgMigrate({ baseSchemaMode: "verify" }),
      /SETFARM_BASE_SCHEMA_VERIFY_MODE_INVALID/);
    await assert.rejects(restrictedDb.pgMigrate({ baseSchemaMode: "repair" } as never),
      /SETFARM_BASE_SCHEMA_VERIFY_MODE_INVALID/);
    await assert.rejects(restrictedDb.pgMigrate({ baseSchemaMode: "verify", expectedSchemaOwner, unknown: true } as never),
      /SETFARM_BASE_SCHEMA_VERIFY_MODE_INVALID/);

    stage = "foreign-object-owner";
    await restrictedDb.pgClose();
    await admin.unsafe(`CREATE ROLE "${foreignOwner}" NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`);
    foreignOwnerCreated = true;
    restrictedDb.pgConfigureIsolatedTestDatabase(restrictedUrl.toString());
    await assert.rejects(restrictedDb.pgMigrate({ baseSchemaMode: "verify", expectedSchemaOwner: foreignOwner }),
      /SETFARM_BASE_SCHEMA_VERIFY_REFUSED/);
    await restrictedDb.pgClose();
    await database.sql.unsafe("CREATE TYPE public.task6a_foreign_composite AS (flag boolean)");
    await database.sql.unsafe(`ALTER TYPE public.task6a_foreign_composite OWNER TO "${foreignOwner}"`);
    restrictedDb.pgConfigureIsolatedTestDatabase(restrictedUrl.toString());
    await assert.rejects(restrictedDb.pgMigrate({ baseSchemaMode: "verify", expectedSchemaOwner }),
      /SETFARM_BASE_SCHEMA_VERIFY_REFUSED/);
    await restrictedDb.pgClose();
    await database.sql.unsafe("DROP TYPE public.task6a_foreign_composite");
    await database.sql.unsafe(`ALTER TABLE public.runs OWNER TO "${foreignOwner}"`);
    const foreignOwnerBefore = await schemaFingerprint(database.sql);
    restrictedDb.pgConfigureIsolatedTestDatabase(restrictedUrl.toString());
    await assert.rejects(restrictedDb.pgMigrate({ baseSchemaMode: "verify", expectedSchemaOwner }),
      /SETFARM_BASE_SCHEMA_VERIFY_REFUSED/);
    assert.equal(await schemaFingerprint(database.sql), foreignOwnerBefore);
    await restrictedDb.pgClose();
    await database.reset();
    await database.sql.unsafe(`GRANT USAGE ON SCHEMA public TO "${role}"`);
    await database.sql.unsafe(`GRANT SELECT ON public.setfarm_schema_migrations TO "${role}"`);

    stage = "base-catalog-drift";
    await database.sql.unsafe("DROP INDEX public.idx_steps_run_status");
    const driftBefore = await schemaFingerprint(database.sql);
    restrictedDb.pgConfigureIsolatedTestDatabase(restrictedUrl.toString());
    await assert.rejects(restrictedDb.pgMigrate({ baseSchemaMode: "verify", expectedSchemaOwner }),
      /SETFARM_BASE_SCHEMA_VERIFY_REFUSED/);
    assert.equal(await schemaFingerprint(database.sql), driftBefore);
    await assert.rejects(restrictedDb.pgQuery("SELECT 1"),
      /SETFARM_BASE_SCHEMA_VERIFY_INCOMPLETE/);
    await assert.rejects(restrictedDb.initializeInternalProductionCurrentEntryDatabaseV1(),
      /SETFARM_BASE_SCHEMA_VERIFY_INCOMPLETE/);
    assert.equal(await schemaFingerprint(database.sql), driftBefore);

    stage = "journal-drift";
    await restrictedDb.pgClose();
    await database.reset();
    await database.sql.unsafe(`GRANT USAGE ON SCHEMA public TO "${role}"`);
    await database.sql.unsafe(`GRANT SELECT ON public.setfarm_schema_migrations TO "${role}"`);
    await database.sql.unsafe("DELETE FROM public.setfarm_schema_migrations WHERE version = 33");
    const journalBefore = await database.sql<Array<{ count: string }>>`
      SELECT count(*)::text AS count FROM public.setfarm_schema_migrations
    `;
    const journalSchemaBefore = await schemaFingerprint(database.sql);
    restrictedDb.pgConfigureIsolatedTestDatabase(restrictedUrl.toString());
    await assert.rejects(restrictedDb.pgMigrate({ baseSchemaMode: "verify", expectedSchemaOwner }),
      /SETFARM_BASE_SCHEMA_VERIFY_REFUSED/);
    assert.equal(await schemaFingerprint(database.sql), journalSchemaBefore);
    const journalAfter = await database.sql<Array<{ count: string }>>`
      SELECT count(*)::text AS count FROM public.setfarm_schema_migrations
    `;
    assert.equal(journalAfter[0]?.count, journalBefore[0]?.count);

    stage = "missing-target";
    await restrictedDb.pgClose();
    const missingDatabase = `setfarm_contract_spine_test_${process.pid}_${randomBytes(6).toString("hex")}`;
    const missingUrl = new URL(restrictedUrl);
    missingUrl.pathname = `/${missingDatabase}`;
    const beforeMissing = await admin<Array<{ exists: boolean }>>`
      SELECT EXISTS(SELECT 1 FROM pg_catalog.pg_database WHERE datname = ${missingDatabase}) AS exists
    `;
    assert.equal(beforeMissing[0]?.exists, false);
    restrictedDb.pgConfigureIsolatedTestDatabase(missingUrl.toString());
    await assert.rejects(restrictedDb.pgMigrate({ baseSchemaMode: "verify", expectedSchemaOwner }),
      /SETFARM_BASE_SCHEMA_VERIFY_REFUSED/);
    const afterMissing = await admin<Array<{ exists: boolean }>>`
      SELECT EXISTS(SELECT 1 FROM pg_catalog.pg_database WHERE datname = ${missingDatabase}) AS exists
    `;
    assert.equal(afterMissing[0]?.exists, false);
  } catch (error) {
    testFailure = error;
    process.stderr.write(`[task6a-opt-in-test] failed at ${stage}\n`);
    throw error;
  } finally {
    const cleanupFailures: string[] = [];
    try { await restrictedDb?.pgClose(); } catch { cleanupFailures.push("restricted_connection"); }
    try { await database?.cleanup(); } catch { cleanupFailures.push("fixture_database"); }
    try {
      if (roleCreated) await admin.unsafe(`DROP ROLE IF EXISTS "${role}"`);
    } catch { cleanupFailures.push("private_role"); }
    try {
      if (foreignOwnerCreated) await admin.unsafe(`DROP ROLE IF EXISTS "${foreignOwner}"`);
    } catch { cleanupFailures.push("foreign_owner_role"); }
    try { await admin.end({ timeout: 5 }); } catch { cleanupFailures.push("admin_connection"); }
    if (cleanupFailures.length > 0) {
      const cleanupError = new Error(`TASK6A_OPTIN_TEST_CLEANUP_FAILED:${cleanupFailures.join(",")}`);
      if (testFailure !== undefined) {
        throw new AggregateError([testFailure, cleanupError], "TASK6A_OPTIN_TEST_AND_CLEANUP_FAILED");
      }
      throw cleanupError;
    }
  }
});
