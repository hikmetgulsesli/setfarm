import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { test } from "node:test";

import postgres from "postgres";

import { createIsolatedTestDatabase, type TestDatabase } from "./test-database.js";
import { requireTask6aPrivateLoopbackHostname } from "./task6a-private-cluster-loopback.js";

const expectedDataDirectory = process.env.SETFARM_TASK6A_TEST_PG_DATA_DIRECTORY;

function permissionDenied(error: unknown): boolean {
  return error !== null && typeof error === "object"
    && "code" in error && error.code === "42501";
}

test("private successor login allocates run numbers only after scoped sequence USAGE", {
  skip: expectedDataDirectory ? false : "requires an explicitly identified private PostgreSQL cluster",
}, async () => {
  assert.equal(process.env.SETFARM_PG_URL, undefined);
  assert.match(expectedDataDirectory!, /^\/tmp\/setfarm-task6a-pg\.[A-Za-z0-9]+\/data$/);
  const adminUrl = process.env.SETFARM_TEST_PG_ADMIN_URL;
  assert.ok(adminUrl);
  const parsed = new URL(adminUrl);
  assert.equal(parsed.pathname, "/postgres");
  const privateHostname = requireTask6aPrivateLoopbackHostname(parsed);
  assert.notEqual(parsed.port, "5432");

  const admin = postgres(adminUrl, { max: 1 });
  let database: TestDatabase | undefined;
  let successorDb: typeof import("../../src/db-pg.js") | undefined;
  const role = `task6a_private_successor_${randomBytes(6).toString("hex")}`;
  const password = randomBytes(24).toString("hex");
  let roleCreated = false;
  let testFailure: unknown;
  let stage = "private-cluster-preflight";
  try {
    const identity = await admin<Array<{ data_directory: string; port: string;
      socket_directories: string; server_version_num: number }>>`
      SELECT current_setting('data_directory') AS data_directory,
        current_setting('port') AS port,
        current_setting('unix_socket_directories') AS socket_directories,
        current_setting('server_version_num')::integer AS server_version_num
    `;
    assert.equal(identity[0]?.data_directory, expectedDataDirectory);
    assert.equal(identity[0]?.port, parsed.port);
    assert.ok(identity[0]?.socket_directories.split(",").map((value) => value.trim())
      .includes(path.dirname(expectedDataDirectory!)));
    assert.ok(identity[0]!.server_version_num >= 170000
      && identity[0]!.server_version_num < 180000);

    stage = "create-isolated-fixture";
    database = await createIsolatedTestDatabase();
    const ownerRows = await database.sql<Array<{ owner: string }>>`SELECT current_user AS owner`;
    const expectedSchemaOwner = ownerRows[0]?.owner;
    assert.match(expectedSchemaOwner ?? "", /^[a-z_][a-z0-9_]{0,62}$/);
    const existing = await admin<Array<{ count: string }>>`
      SELECT count(*)::text AS count FROM pg_catalog.pg_roles WHERE rolname = ${role}
    `;
    assert.equal(existing[0]?.count, "0");

    stage = "create-private-successor";
    roleCreated = true;
    try {
      await admin.unsafe(`CREATE ROLE "${role}" LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`);
    } catch {
      throw new Error("TASK6A_PRIVATE_SUCCESSOR_CREATE_FAILED");
    }
    await admin.unsafe(`GRANT CONNECT ON DATABASE "${database.database}" TO "${role}"`);
    await database.sql.unsafe(`GRANT USAGE ON SCHEMA public TO "${role}"`);
    await database.sql.unsafe(`GRANT SELECT ON public.setfarm_schema_migrations TO "${role}"`);

    const successorUrl = new URL(database.url);
    successorUrl.username = role;
    successorUrl.password = password;
    successorUrl.hostname = privateHostname;
    successorUrl.port = parsed.port;
    successorDb = await import(`../../src/db-pg.ts?task6a-successor=${database.database}`);
    successorDb.pgConfigureIsolatedTestDatabase(successorUrl.toString());

    stage = "restricted-capability-preflight";
    const probe = postgres(successorUrl.toString(), { max: 1 });
    try {
      const rights = await probe<Array<{ login: string; effective: string;
        superuser: boolean; bypassRls: boolean; createRole: boolean; createDatabase: boolean;
        ownerMember: boolean; ownerSet: boolean; ownerAdmin: boolean;
        databaseCreate: boolean; schemaCreate: boolean;
        sequenceUsage: boolean; sequenceUpdate: boolean; tableDml: boolean[] }>>`
        SELECT session_user AS login, current_user AS effective,
          r.rolsuper AS superuser, r.rolbypassrls AS "bypassRls",
          r.rolcreaterole AS "createRole", r.rolcreatedb AS "createDatabase",
          pg_catalog.pg_has_role(session_user, o.oid, 'MEMBER') AS "ownerMember",
          pg_catalog.pg_has_role(session_user, o.oid, 'SET') AS "ownerSet",
          EXISTS (SELECT 1 FROM pg_catalog.pg_auth_members m
            WHERE m.roleid = o.oid AND m.member = r.oid AND m.admin_option) AS "ownerAdmin",
          has_database_privilege(current_user, current_database(), 'CREATE') AS "databaseCreate",
          has_schema_privilege(current_user, 'public', 'CREATE') AS "schemaCreate",
          has_sequence_privilege(current_user, 'public.runs_run_number_seq', 'USAGE') AS "sequenceUsage",
          has_sequence_privilege(current_user, 'public.runs_run_number_seq', 'UPDATE') AS "sequenceUpdate",
          ARRAY(SELECT has_table_privilege(current_user, name, privilege)
            FROM unnest(ARRAY['public.runs', 'public.claim_log',
              'public.execution_attempts', 'public.runtime_sessions']) AS tables(name)
            CROSS JOIN unnest(ARRAY['INSERT', 'UPDATE', 'DELETE']) AS rights(privilege)) AS "tableDml"
        FROM pg_catalog.pg_roles r CROSS JOIN pg_catalog.pg_roles o
        WHERE r.rolname = session_user AND o.rolname = ${expectedSchemaOwner}
      `;
      assert.deepEqual(rights[0], { login: role, effective: role,
        superuser: false, bypassRls: false, createRole: false, createDatabase: false,
        ownerMember: false, ownerSet: false, ownerAdmin: false,
        databaseCreate: false, schemaCreate: false,
        sequenceUsage: false, sequenceUpdate: false, tableDml: Array(12).fill(false) });
    } finally {
      await probe.end({ timeout: 5 });
    }

    stage = "opt-in-verify-and-deny";
    await successorDb.pgMigrate({ baseSchemaMode: "verify", expectedSchemaOwner });
    await assert.rejects(successorDb.pgNextRunNumber(), permissionDenied);
    for (const table of ["runs", "claim_log", "execution_attempts", "runtime_sessions"]) {
      await assert.rejects(successorDb.pgQuery(`INSERT INTO public.${table} DEFAULT VALUES`), permissionDenied);
    }
    await assert.rejects(successorDb.pgQuery("CREATE TABLE public.task6a_forbidden (id integer)"), permissionDenied);

    stage = "scoped-sequence-grant";
    await database.sql.unsafe(`GRANT USAGE ON SEQUENCE public.runs_run_number_seq TO "${role}"`);
    const scopedRights = await database.sql<Array<{ usage: boolean; update: boolean;
      tableDml: boolean[] }>>`
      SELECT has_sequence_privilege(${role}, 'public.runs_run_number_seq', 'USAGE') AS usage,
        has_sequence_privilege(${role}, 'public.runs_run_number_seq', 'UPDATE') AS update,
        ARRAY(SELECT has_table_privilege(${role}, name, privilege)
          FROM unnest(ARRAY['public.runs', 'public.claim_log',
            'public.execution_attempts', 'public.runtime_sessions']) AS tables(name)
          CROSS JOIN unnest(ARRAY['INSERT', 'UPDATE', 'DELETE']) AS rights(privilege)) AS "tableDml"
    `;
    assert.deepEqual(scopedRights[0], { usage: true, update: false,
      tableDml: Array(12).fill(false) });
    const first = await successorDb.pgNextRunNumber();
    const second = await successorDb.pgNextRunNumber();
    assert.ok(Number.isSafeInteger(first) && first > 0);
    assert.ok(Number.isSafeInteger(second) && second === first + 1);
    await database.sql`SELECT setval('public.runs_run_number_seq'::regclass, 2147483647, true)`;
    await assert.rejects(successorDb.pgNextRunNumber(), (error: unknown) =>
      error !== null && typeof error === "object" && "code" in error && error.code === "22003");
    const after = await successorDb.pgQuery<{ value: number }>("SELECT 1 AS value");
    assert.equal(after[0]?.value, 1);
  } catch (error) {
    testFailure = error;
    process.stderr.write(`[task6a-private-successor-sequence] failed at ${stage}\n`);
    throw error;
  } finally {
    const cleanupFailures: string[] = [];
    try { await successorDb?.pgClose(); } catch { cleanupFailures.push("successor_connection"); }
    try { await database?.cleanup(); } catch { cleanupFailures.push("fixture_database"); }
    try {
      if (roleCreated) await admin.unsafe(`DROP ROLE IF EXISTS "${role}"`);
    } catch { cleanupFailures.push("successor_role"); }
    try { await admin.end({ timeout: 5 }); } catch { cleanupFailures.push("admin_connection"); }
    if (cleanupFailures.length > 0) {
      const cleanupError = new Error(`TASK6A_PRIVATE_SUCCESSOR_CLEANUP_FAILED:${cleanupFailures.join(",")}`);
      if (testFailure !== undefined) {
        throw new AggregateError([testFailure, cleanupError], "TASK6A_PRIVATE_SUCCESSOR_TEST_AND_CLEANUP_FAILED");
      }
      throw cleanupError;
    }
  }
});
