import assert from "node:assert/strict";
import type { TestContext } from "node:test";
import { mkdtempSync, readFileSync, statfsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import postgres from "postgres";
import { freshSourceCheckoutFixture } from "./fresh-source-checkout-fixture.js";

export const freshTestAdminUrl = process.env.SETFARM_TEST_PG_ADMIN_URL || "postgresql://postgres@127.0.0.1:5432/postgres";
const adminUrl = freshTestAdminUrl;
const quote = (s: string) => `"${s.replaceAll('"', '""')}"`;

export async function createFreshInstallationTestFixtureV1(t: TestContext, sourceSha?: string, baseDirectory = mkdtempSync(path.join(tmpdir(), "setfarm-fresh-integration-")),
  afterStart?: (input: { adminUrl: string; baseDirectory: string; sourceSha: string }) => void, endpoint = adminUrl) {
  const capacity = statfsSync(process.cwd());
  assert.ok(capacity.bavail * capacity.bsize > 8 * 1024 ** 3, "fresh test requires8GiB disk floor");
  const fixture = await freshSourceCheckoutFixture();
  const module = fixture.api;
  assert.equal(typeof module.createFreshInstallationV1, "function", "explicit fresh-installation initializer is missing");
  const input = { adminUrl: endpoint, baseDirectory, sourceSha: sourceSha ?? fixture.sha };
  const original = module.createFreshInstallationV1(input);
  afterStart?.(input);
  const installation = await original;
  t.after(async () => {
    await installation.close();
    const admin = postgres(adminUrl, { max: 1, connect_timeout: 3, onnotice() {} });
    try {
      const db = await admin<Array<{ oid: number; owner: string }>>`
        SELECT oid::integer AS oid, pg_get_userbyid(datdba) AS owner
        FROM pg_catalog.pg_database WHERE datname = ${installation.databaseName}`;
      assert.equal(db.length, 1, "created test database disappeared");
      assert.equal(db[0]!.oid, installation.origin.databaseOid, "test database identity changed; refusing cleanup");
      assert.equal(db[0]!.owner, installation.ownerRole);
      const record = JSON.parse(readFileSync(path.join(installation.directory, "database-created.json"), "utf8"));
      for (const [name, oid] of [[installation.ownerRole, record.ownerOid], [installation.runtimeRole, record.runtimeOid]]) {
        const roles = await admin<Array<{ oid: number }>>`SELECT oid::integer AS oid FROM pg_catalog.pg_roles WHERE rolname = ${name}`;
        assert.equal(roles[0]?.oid, oid, "test role identity changed; refusing cleanup");
      }
      await admin.unsafe(`DROP DATABASE ${quote(installation.databaseName)}`);
      await admin.unsafe(`DROP ROLE ${quote(installation.runtimeRole)}`);
      await admin.unsafe(`DROP ROLE ${quote(installation.ownerRole)}`);
    } finally { await admin.end({ timeout: 3 }); }
  });
  return installation;
}
