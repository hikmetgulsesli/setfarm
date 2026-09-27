import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { test } from "node:test";

import postgres from "postgres";

import { createIsolatedTestDatabase, type TestDatabase } from "./test-database.js";
import { requireTask6aPrivateLoopbackHostname } from "./task6a-private-cluster-loopback.js";

const expectedDataDirectory = process.env.SETFARM_TASK6A_TEST_PG_DATA_DIRECTORY;

test("private PostgreSQL URL preflight preserves IPv6 loopback", () => {
  const parsed = new URL("postgresql://[::1]:55437/postgres");
  const hostname = requireTask6aPrivateLoopbackHostname(parsed);
  assert.equal(hostname, "[::1]");
  const oldUrl = new URL("postgresql://127.0.0.1:55437/test");
  oldUrl.hostname = hostname;
  assert.equal(oldUrl.hostname, parsed.hostname);
  for (const rejected of ["postgresql://127.0.0.2:55437/postgres",
    "postgresql://[::2]:55437/postgres",
    "postgresql://db.example:55437/postgres"]) {
    assert.throws(() => requireTask6aPrivateLoopbackHostname(new URL(rejected)),
      /TASK6A_PRIVATE_CLUSTER_HOST_INVALID/);
  }
});

test("isolated database URL guard accepts IPv6 loopback without admitting other hosts", async () => {
  const db = await import("../../src/db-pg.ts?task6a-ipv6-isolated-url-guard");
  const database = "setfarm_contract_spine_test_123_abcdefabcdef";
  try {
    assert.doesNotThrow(() => db.pgConfigureIsolatedTestDatabase(
      `postgresql://[::1]:55437/${database}`,
    ));
    for (const host of ["127.0.0.2", "[::2]", "db.example"]) {
      assert.throws(() => db.pgConfigureIsolatedTestDatabase(
        `postgresql://${host}:55437/${database}`,
      ), /ISOLATED_TEST_DATABASE_URL_REJECTED/);
    }
  } finally {
    await db.pgClose();
  }
});

function permissionDenied(error: unknown): boolean {
  return error !== null && typeof error === "object"
    && "code" in error && error.code === "42501";
}

test("private Task6A rehearsal denies the old login's direct run and claim inserts after privilege transition", {
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
  let oldSql: postgres.Sql | undefined;
  const suffix = randomBytes(6).toString("hex");
  const owner = `task6a_private_owner_${suffix}`;
  const oldLogin = `task6a_private_old_${suffix}`;
  const oldPassword = randomBytes(24).toString("hex");
  let ownerCreated = false;
  let oldCreated = false;
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
    const existingRoles = await admin<Array<{ count: string }>>`
      SELECT count(*)::text AS count FROM pg_catalog.pg_roles
      WHERE rolname IN (${owner}, ${oldLogin})
    `;
    assert.equal(existingRoles[0]?.count, "0");

    stage = "create-private-roles";
    ownerCreated = true;
    await admin.unsafe(`CREATE ROLE "${owner}" NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`);
    oldCreated = true;
    try {
      await admin.unsafe(`CREATE ROLE "${oldLogin}" LOGIN PASSWORD '${oldPassword}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`);
    } catch {
      throw new Error("TASK6A_PRIVATE_OLD_ROLE_CREATE_FAILED");
    }
    await admin.unsafe(`GRANT CONNECT ON DATABASE "${database.database}" TO "${oldLogin}"`);
    await database.sql.unsafe(`ALTER TABLE public.runs OWNER TO "${owner}"`);
    await database.sql.unsafe(`ALTER TABLE public.claim_log OWNER TO "${owner}"`);
    await database.sql.unsafe(`GRANT USAGE ON SCHEMA public TO "${oldLogin}"`);
    await database.sql.unsafe(`GRANT INSERT ON public.runs, public.claim_log TO "${oldLogin}"`);

    const oldUrl = new URL(database.url);
    oldUrl.username = oldLogin;
    oldUrl.password = oldPassword;
    oldUrl.hostname = privateHostname;
    oldUrl.port = parsed.port;
    oldSql = postgres(oldUrl.toString(), { max: 1 });

    stage = "pre-transition-capability";
    const role = await oldSql<Array<{ login: string; effective: string; superuser: boolean;
      bypassRls: boolean; createRole: boolean; createDatabase: boolean;
      ownerLogin: boolean; ownerMember: boolean; ownerSet: boolean; ownerAdmin: boolean }>>`
      SELECT session_user AS login, current_user AS effective,
        r.rolsuper AS superuser, r.rolbypassrls AS "bypassRls",
        r.rolcreaterole AS "createRole", r.rolcreatedb AS "createDatabase",
        o.rolcanlogin AS "ownerLogin",
        pg_catalog.pg_has_role(session_user, o.oid, 'MEMBER') AS "ownerMember",
        pg_catalog.pg_has_role(session_user, o.oid, 'SET') AS "ownerSet",
        EXISTS (SELECT 1 FROM pg_catalog.pg_auth_members m
          WHERE m.roleid = o.oid AND m.member = r.oid AND m.admin_option) AS "ownerAdmin"
      FROM pg_catalog.pg_roles r CROSS JOIN pg_catalog.pg_roles o
      WHERE r.rolname = session_user AND o.rolname = ${owner}
    `;
    assert.deepEqual(role[0], { login: oldLogin, effective: oldLogin, superuser: false,
      bypassRls: false, createRole: false, createDatabase: false,
      ownerLogin: false, ownerMember: false, ownerSet: false, ownerAdmin: false });

    const runId = `task6a-private-fence-${suffix}`;
    const rollbackMarker = new Error("TASK6A_PRIVATE_PROBE_ROLLBACK");
    await assert.rejects(oldSql.begin(async (tx) => {
      await tx`INSERT INTO public.runs (id, run_number, workflow_id, task, status, context)
        VALUES (${runId}, 999999, 'workflow', 'private fence probe', 'running', '{}')`;
      await tx`INSERT INTO public.claim_log (id, run_id, step_id, agent_id)
        VALUES (999999, ${runId}, 'step', 'agent')`;
      throw rollbackMarker;
    }), (error: unknown) => error === rollbackMarker);

    stage = "post-transition-denial";
    await database.sql.unsafe(`REVOKE INSERT ON public.runs, public.claim_log FROM "${oldLogin}"`);
    await assert.rejects(oldSql.begin(async (tx) => {
      await tx`INSERT INTO public.runs (id, run_number, workflow_id, task, status, context)
        VALUES (${runId}, 999999, 'workflow', 'private fence probe', 'running', '{}')`;
      throw rollbackMarker;
    }), permissionDenied);
    await assert.rejects(oldSql.begin(async (tx) => {
      await tx`INSERT INTO public.claim_log (id, run_id, step_id, agent_id)
        VALUES (999999, ${runId}, 'step', 'agent')`;
      throw rollbackMarker;
    }), permissionDenied);
    const after = await database.sql<Array<{ runCount: string; claimCount: string }>>`
      SELECT (SELECT count(*)::text FROM public.runs WHERE id = ${runId}) AS "runCount",
        (SELECT count(*)::text FROM public.claim_log WHERE run_id = ${runId}) AS "claimCount"
    `;
    assert.deepEqual(after[0], { runCount: "0", claimCount: "0" });
  } catch (error) {
    testFailure = error;
    process.stderr.write(`[task6a-private-old-writer-test] failed at ${stage}\n`);
    throw error;
  } finally {
    const cleanupFailures: string[] = [];
    try { await oldSql?.end({ timeout: 5 }); } catch { cleanupFailures.push("old_connection"); }
    try { await database?.cleanup(); } catch { cleanupFailures.push("fixture_database"); }
    try {
      if (oldCreated) await admin.unsafe(`DROP ROLE IF EXISTS "${oldLogin}"`);
    } catch { cleanupFailures.push("old_role"); }
    try {
      if (ownerCreated) await admin.unsafe(`DROP ROLE IF EXISTS "${owner}"`);
    } catch { cleanupFailures.push("owner_role"); }
    try { await admin.end({ timeout: 5 }); } catch { cleanupFailures.push("admin_connection"); }
    if (cleanupFailures.length > 0) {
      const cleanupError = new Error(`TASK6A_PRIVATE_OLD_WRITER_CLEANUP_FAILED:${cleanupFailures.join(",")}`);
      if (testFailure !== undefined) {
        throw new AggregateError([testFailure, cleanupError], "TASK6A_PRIVATE_OLD_WRITER_TEST_AND_CLEANUP_FAILED");
      }
      throw cleanupError;
    }
  }
});
