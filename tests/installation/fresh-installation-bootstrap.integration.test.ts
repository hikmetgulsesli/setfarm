import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { mkdtempSync, readFileSync, readdirSync, existsSync, statfsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import postgres from "postgres";
import { verifyContractSpineCurrentHeadJournalReadOnlyV1 } from "../../src/db/contract-spine-readonly-verifier-v1.js";
import { initializeFreshInstallationContractSpineV1 } from "../../src/db/contract-spine-migrations.js";

const adminUrl = process.env.SETFARM_TEST_PG_ADMIN_URL || "postgresql://postgres@127.0.0.1:5432/postgres";
const quote = (s: string) => `"${s.replaceAll('"', '""')}"`;
const targetUrl = (database: string) => { const u = new URL(adminUrl); u.pathname = "/" + database; return u.href; };

async function create(t: TestContext) {
  const capacity = statfsSync(process.cwd());
  assert.ok(capacity.bavail * capacity.bsize > 8 * 1024 ** 3, "fresh test requires8GiB disk floor");
  let module: typeof import("../../src/installation/fresh-installation-v1.js") | undefined;
  try { module = await import("../../src/installation/fresh-installation-v1.js"); }
  catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ERR_MODULE_NOT_FOUND"
      && error.message.includes("fresh-installation-v1"))) throw error;
  }
  assert.equal(typeof module?.createFreshInstallationV1, "function", "explicit fresh-installation initializer is missing");
  const baseDirectory = mkdtempSync(path.join(tmpdir(), "setfarm-fresh-integration-"));
  const installation = await module!.createFreshInstallationV1({ adminUrl, baseDirectory,
    sourceSha: "1234567890abcdef1234567890abcdef12345678" });
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

test("fresh bootstrap installs the actual complete schema and verifies a restricted runtime", { timeout: 120_000 }, async t => {
  const installation = await create(t);
  const origin = await installation.initialize();
  assert.equal(origin.databaseName, installation.databaseName);
  assert.equal(origin.migrations.length, 33);
  await installation.verifyRuntime();
  const credentials = JSON.parse(readFileSync(path.join(installation.directory, "runtime-credentials.json"), "utf8"));
  const runtime = postgres(credentials.runtimeUrl, { max: 1, connect_timeout: 3, onnotice() {} });
  try {
    await verifyContractSpineCurrentHeadJournalReadOnlyV1(runtime);
    const rows = await runtime<Array<{ count: number; last: number }>>`
      SELECT count(*)::integer AS count, max(version)::integer AS last FROM public.setfarm_schema_migrations`;
    assert.deepEqual(rows.map(r => ({ ...r })), [{ count: 33, last: 33 }]);
    const size = await runtime<Array<{ bytes: string }>>`SELECT pg_database_size(current_database())::text AS bytes`;
    assert.ok(BigInt(size[0]!.bytes) < 64n * 1024n ** 2n, "fresh schema exceeds reserved64MiB database budget");
    const head = await runtime<Array<{ schema: string }>>`
      SELECT head_payload->'migrationApplication'->>'schema' AS schema
      FROM public.internal_production_owner_admission_head_v1 WHERE singleton`;
    assert.equal(head[0]?.schema, "setfarm.fresh-installation-schema-application.v1");
    for (const command of [
      "CREATE TABLE public.runtime_schema_bypass(id integer)",
      "UPDATE public.setfarm_schema_migrations SET state = 'adopted' WHERE FALSE",
      "UPDATE public.internal_production_owner_admission_head_v1 SET migration_application_evidence_hash = repeat('a',64) WHERE FALSE",
      `SET ROLE ${quote(installation.ownerRole)}`,
    ]) {
      await assert.rejects(runtime.unsafe(command), e => !!e && typeof e === "object" && "code" in e && e.code === "42501");
    }
  } finally { await runtime.end({ timeout: 3 }); }
  const control = postgres(targetUrl(installation.databaseName), { max: 1, onnotice() {} });
  try {
    await control.unsafe("ANALYZE public.steps");
    await installation.verifyRuntime(); // Planner statistics are not schema drift.
    await control.unsafe("ALTER TABLE public.steps ADD COLUMN foreign_column integer");
    await assert.rejects(installation.verifyRuntime(), /FRESH_INSTALLATION_RUNTIME_VERIFY_FAILED/);
    await control.unsafe("ALTER TABLE public.steps DROP COLUMN foreign_column");
  } finally { await control.end({ timeout: 3 }); }
  assert.ok(existsSync(path.join(installation.directory, "schema-committed.json")));
  assert.equal(existsSync(path.join(installation.directory, "ready.json")), false);
  await assert.rejects(installation.initialize(), /FRESH_INSTALLATION_ALREADY_INITIALIZED/);
});

test("fresh bootstrap refuses a nonempty created target without adopting or repairing it", { timeout: 120_000 }, async t => {
  const installation = await create(t);
  const control = postgres(targetUrl(installation.databaseName), { max: 1, onnotice() {} });
  try {
    await assert.rejects(initializeFreshInstallationContractSpineV1(control as unknown as postgres.TransactionSql), /FRESH_INSTALLATION_TRANSACTION_NOT_OWNED/);
    await control`CREATE TABLE public.foreign_state (id integer)`;
    await assert.rejects(installation.initialize(), /FRESH_INSTALLATION_SCHEMA_FAILED/);
    const rows = await control<Array<{ name: string }>>`
      SELECT c.relname AS name FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind='r' ORDER BY c.relname`;
    assert.deepEqual(rows.map(r => r.name), ["foreign_state"]);
    assert.equal(existsSync(path.join(installation.directory, "schema-committed.json")), false);
  } finally { await control.end({ timeout: 3 }); }
});

test("fresh provisioning rejects legacy or remote endpoints before creating installation state", async () => {
  const { createFreshInstallationV1 } = await import("../../src/installation/fresh-installation-v1.js");
  const baseDirectory = mkdtempSync(path.join(tmpdir(), "setfarm-fresh-rejection-"));
  for (const adminUrl of ["postgresql://postgres@127.0.0.1:5432/setfarm", "postgresql://postgres@example.invalid/postgres"]) {
    await assert.rejects(createFreshInstallationV1({ adminUrl, baseDirectory, sourceSha: "1".repeat(40) }), /FRESH_INSTALLATION_ADMIN_ENDPOINT_INVALID/);
    assert.deepEqual(readdirSync(baseDirectory), []);
  }
});

test("migration27 lock failure rolls back the earlier canonical schema and fresh provenance", { timeout: 120_000 }, async t => {
  const installation = await create(t);
  const control = postgres(targetUrl(installation.databaseName), { max: 1, onnotice() {} });
  let locked!: () => void;
  let release!: () => void;
  const acquired = new Promise<void>(resolve => { locked = resolve; });
  const stop = new Promise<void>(resolve => { release = resolve; });
  const held = control.begin(async tx => {
    // Installation key127 is acquired after canonical migrations1–26, not at bootstrap entry.
    await tx.unsafe("SELECT pg_advisory_xact_lock($1,$2)", [1397117251, 127]);
    locked();
    await stop;
  });
  await acquired;
  try { await assert.rejects(installation.initialize(), { message: "FRESH_INSTALLATION_SCHEMA_FAILED:MIGRATION_LOCK_TIMEOUT" }); }
  finally { release(); await held; }
  try {
    const rows = await control<Array<{ count: number }>>`
      SELECT (SELECT count(*) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='public')::integer +
        (SELECT count(*) FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
        WHERE n.nspname='public')::integer AS count`;
    assert.equal(rows[0]?.count, 0);
    assert.equal(existsSync(path.join(installation.directory, "schema-committed.json")), false);
  } finally { await control.end({ timeout: 3 }); }
});

test("fresh bootstrap refuses a standalone foreign type before installing any canonical objects", { timeout: 120_000 }, async t => {
  const installation = await create(t);
  const control = postgres(targetUrl(installation.databaseName), { max: 1, onnotice() {} });
  try {
    await control.unsafe("CREATE TYPE public.foreign_type AS ENUM ('x')");
    await assert.rejects(installation.initialize(), /FRESH_INSTALLATION_SCHEMA_FAILED/);
    const failures = readdirSync(installation.directory).filter(name => name.startsWith("failure-"));
    assert.equal(failures.length, 1);
    assert.equal(JSON.parse(readFileSync(path.join(installation.directory, failures[0]!), "utf8")).diagnostic,
      "FRESH_INSTALLATION_NONEMPTY_TARGET_REFUSED");
    const retained = await control<Array<{ enumlabel: string }>>`
      SELECT e.enumlabel FROM pg_catalog.pg_enum e JOIN pg_catalog.pg_type t ON t.oid=e.enumtypid
      JOIN pg_catalog.pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typname='foreign_type'`;
    assert.deepEqual(retained.map(row => row.enumlabel), ["x"]);
    const rows = await control<Array<{ count: number }>>`
      SELECT count(*)::integer AS count FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public'`;
    assert.equal(rows[0]?.count, 0);
    assert.equal(existsSync(path.join(installation.directory, "schema-committed.json")), false);
  } finally { await control.end({ timeout: 3 }); }
});

test("runtime verification refuses a column-only grant to change protected provenance", { timeout: 120_000 }, async t => {
  const installation = await create(t);
  await installation.initialize();
  const control = postgres(targetUrl(installation.databaseName), { max: 1, onnotice() {} });
  try {
    await control.unsafe(`GRANT UPDATE (migration_application_evidence_hash) ON public.internal_production_owner_admission_head_v1 TO ${quote(installation.runtimeRole)}`);
    await assert.rejects(installation.verifyRuntime(), /FRESH_INSTALLATION_RUNTIME_VERIFY_FAILED/);
  } finally { await control.end({ timeout: 3 }); }
});
