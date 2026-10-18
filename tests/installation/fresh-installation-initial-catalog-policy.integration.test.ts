import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import postgres from "postgres";
import { createFreshInstallationTestFixtureV1 as create, freshTestAdminUrl } from "./fresh-installation-test-support.js";

const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
const targetUrl = (database: string) => { const url = new URL(freshTestAdminUrl); url.pathname = "/" + database; return url.href; };

async function assertRolledBack(sql: postgres.Sql, directory: string) {
  assert.equal(existsSync(path.join(directory, "schema-prepared.json")), false);
  assert.equal(existsSync(path.join(directory, "schema-committed.json")), false);
  const rows = await sql<Array<{ count: number }>>`
    SELECT (SELECT count(*) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public')::integer +
      (SELECT count(*) FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public')::integer AS count`;
  assert.equal(rows[0]?.count, 0, "the schema transaction must roll back before publishing prepared evidence");
}

for (const variant of ["PUBLIC_CONNECT", "PUBLIC_CREATE", "runtime_CONNECT_GRANT_OPTION"] as const) {
  test(`fresh bootstrap rejects initial database ACL ${variant} before commit`, { timeout: 120_000 }, async t => {
    const installation = await create(t);
    const control = postgres(targetUrl(installation.databaseName), { max: 1, connect_timeout: 3, onnotice() {} });
    try {
      const privilege = variant === "PUBLIC_CREATE" ? "CREATE" : "CONNECT";
      const grantee = variant === "runtime_CONNECT_GRANT_OPTION" ? quote(installation.runtimeRole) : "PUBLIC";
      await control.unsafe(`GRANT ${privilege} ON DATABASE ${quote(installation.databaseName)} TO ${grantee}${variant === "runtime_CONNECT_GRANT_OPTION" ? " WITH GRANT OPTION" : ""}`);
      await assert.rejects(installation.initialize(), /FRESH_INSTALLATION_SCHEMA_FAILED/);
      await assertRolledBack(control, installation.directory);
    } finally { await control.end({ timeout: 3 }); }
  });
}

for (const namespace of ["pg_catalog", "information_schema"]) {
  test(`fresh bootstrap rejects an unexposed new ${namespace} routine before commit`, { timeout: 120_000 }, async t => {
    const installation = await create(t);
    const control = postgres(targetUrl(installation.databaseName), { max: 1, connect_timeout: 3, onnotice() {} });
    try {
      // Benign, never called, and created only inside this test's new database.
      await control.unsafe(`CREATE FUNCTION ${quote(namespace)}.fresh_inert_noop_v1() RETURNS integer LANGUAGE sql AS 'SELECT 1'`);
      await control.unsafe(`REVOKE ALL ON FUNCTION ${quote(namespace)}.fresh_inert_noop_v1() FROM PUBLIC`);
      const rows = await control<Array<{ oid: number; public_grants: number }>>`
        SELECT p.oid::integer AS oid, (SELECT count(*) FROM pg_catalog.aclexplode(p.proacl) a WHERE a.grantee=0)::integer AS public_grants
        FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
        WHERE n.nspname=${namespace} AND p.proname='fresh_inert_noop_v1'`;
      assert.ok(rows[0]!.oid >= 16384);
      assert.equal(rows[0]?.public_grants, 0);
      await assert.rejects(installation.initialize(), /FRESH_INSTALLATION_SCHEMA_FAILED/);
      await assertRolledBack(control, installation.directory);
    } finally { await control.end({ timeout: 3 }); }
  });
}
