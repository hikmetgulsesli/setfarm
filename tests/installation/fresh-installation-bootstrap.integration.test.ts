import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, existsSync, statfsSync, writeFileSync, unlinkSync, chmodSync, linkSync, symlinkSync, copyFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import postgres from "postgres";
import { verifyContractSpineCurrentHeadJournalReadOnlyV1 } from "../../src/db/contract-spine-readonly-verifier-v1.js";
import { initializeFreshInstallationContractSpineV1 } from "../../src/db/contract-spine-migrations.js";
import { freshSourceCheckoutFixture } from "./fresh-source-checkout-fixture.js";
import { createCommitAckLossProxy } from "./commit-ack-proxy.js";

const adminUrl = process.env.SETFARM_TEST_PG_ADMIN_URL || "postgresql://postgres@127.0.0.1:5432/postgres";
const quote = (s: string) => `"${s.replaceAll('"', '""')}"`;
const targetUrl = (database: string) => { const u = new URL(adminUrl); u.pathname = "/" + database; return u.href; };

async function create(t: TestContext, sourceSha?: string, baseDirectory = mkdtempSync(path.join(tmpdir(), "setfarm-fresh-integration-")),
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

test("fresh provisioning refuses a caller SHA different from the executing source", async t => {
  const baseDirectory = mkdtempSync(path.join(tmpdir(), "setfarm-fresh-source-rejection-"));
  await assert.rejects(create(t, "0".repeat(40), baseDirectory), /FRESH_INSTALLATION_SOURCE_MISMATCH/);
  assert.deepEqual(readdirSync(baseDirectory), []);
});

test("fresh provisioning snapshots caller input before awaits and refuses source accessors", { timeout: 120_000 }, async t => {
  const fixture = await freshSourceCheckoutFixture();
  let input!: { sourceSha: string };
  const baseDirectory = mkdtempSync(path.join(tmpdir(), "setfarm-fresh-source-snapshot-"));
  const installation = await create(t, undefined, baseDirectory, value => {
    input = value;
    // The original source check resumes first; this runs before its caller's continuation.
    queueMicrotask(() => { input.sourceSha = "0".repeat(40); });
  });
  input.sourceSha = fixture.sha;
  const origin = await installation.initialize();
  assert.equal(origin.sourceSha, fixture.sha);
  let invoked = false;
  const options = { adminUrl, baseDirectory, get sourceSha() { invoked = true; return fixture.sha; } };
  await assert.rejects(fixture.api.createFreshInstallationV1(options), /FRESH_INSTALLATION_OPTIONS_INVALID/);
  assert.equal(invoked, false);
});

test("runtime verification refuses elevated role flags and memberships", { timeout: 120_000 }, async t => {
  const installation = await create(t);
  await installation.initialize();
  const control = postgres(targetUrl(installation.databaseName), { max: 1, onnotice() {} });
  try {
    for (const flag of ["CREATEDB", "CREATEROLE", "REPLICATION", "BYPASSRLS", "INHERIT", "SUPERUSER"]) {
      await control.unsafe(`ALTER ROLE ${quote(installation.runtimeRole)} ${flag}`);
      try { await assert.rejects(installation.verifyRuntime(), /FRESH_INSTALLATION_RUNTIME_VERIFY_FAILED/); }
      finally { await control.unsafe(`ALTER ROLE ${quote(installation.runtimeRole)} NO${flag}`); }
    }
    await control.unsafe(`GRANT pg_read_all_data TO ${quote(installation.runtimeRole)}`);
    try { await assert.rejects(installation.verifyRuntime(), /FRESH_INSTALLATION_RUNTIME_VERIFY_FAILED/); }
    finally { await control.unsafe(`REVOKE pg_read_all_data FROM ${quote(installation.runtimeRole)}`); }
    await installation.verifyRuntime();
  } finally { await control.end({ timeout: 3 }); }
});

test("source capture rejects changed and ignored extra executing source without trusting Git status", async () => {
  const fixture = await freshSourceCheckoutFixture();
  assert.equal(await fixture.capture.captureFreshInstallationSourceShaV1(), fixture.sha);
  const file = path.join(fixture.root, "src/installation/fresh-installation-v1.ts"), original = readFileSync(file);
  const git = (args: string[]) => execFileSync("/usr/bin/git", args, { cwd: fixture.root,
    env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C", GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null" },
    encoding: "utf8", timeout: 5000 });
  git(["update-index", "--assume-unchanged", "--", "src/installation/fresh-installation-v1.ts"]);
  try {
    writeFileSync(file, Buffer.concat([original, Buffer.from("\n// changed source\n")]));
    assert.equal(git(["status", "--porcelain=v1", "--untracked-files=all"]), "");
    await assert.rejects(fixture.capture.captureFreshInstallationSourceShaV1(), /FRESH_INSTALLATION_SOURCE_UNAVAILABLE/);
  } finally {
    writeFileSync(file, original);
    git(["update-index", "--no-assume-unchanged", "--", "src/installation/fresh-installation-v1.ts"]);
  }
  const extra = path.join(fixture.root, "src/ignored.tmp");
  const ignore = path.join(fixture.root, ".git/info/exclude");
  const before = readFileSync(ignore);
  try {
    writeFileSync(ignore, Buffer.concat([before, Buffer.from("\nsrc/ignored.tmp\n")]));
    writeFileSync(extra, "ignored but executable input");
    await assert.rejects(fixture.capture.captureFreshInstallationSourceShaV1(), /FRESH_INSTALLATION_SOURCE_UNAVAILABLE/);
  } finally { unlinkSync(extra); writeFileSync(ignore, before); }
  const prior = process.env.GIT_DIR;
  try {
    process.env.GIT_DIR = path.join(fixture.root, ".git");
    await assert.rejects(fixture.capture.captureFreshInstallationSourceShaV1(), /FRESH_INSTALLATION_SOURCE_UNAVAILABLE/);
  } finally {
    if (prior === undefined) delete process.env.GIT_DIR; else process.env.GIT_DIR = prior;
  }
  assert.equal(await fixture.capture.captureFreshInstallationSourceShaV1(), fixture.sha);
});

test("runtime verification refuses incoming grants of its owner or runtime role", { timeout: 120_000 }, async t => {
  const installation = await create(t);
  await installation.initialize();
  const control = postgres(targetUrl(installation.databaseName), { max: 1, onnotice() {} });
  const grantee = installation.ownerRole.replace("sf_owner_", "sf_grantee_");
  let granteeOid: number | undefined;
  try {
    await control.unsafe(`CREATE ROLE ${quote(grantee)} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`);
    const created = await control<Array<{ oid: number }>>`SELECT oid::integer AS oid FROM pg_catalog.pg_roles WHERE rolname=${grantee}`;
    granteeOid = created[0]!.oid;
    for (const role of [installation.ownerRole, installation.runtimeRole]) {
      await control.unsafe(`GRANT ${quote(role)} TO ${quote(grantee)}`);
      try { await assert.rejects(installation.verifyRuntime(), /FRESH_INSTALLATION_RUNTIME_VERIFY_FAILED/); }
      finally { await control.unsafe(`REVOKE ${quote(role)} FROM ${quote(grantee)}`); }
    }
    await installation.verifyRuntime();
  } finally {
    try {
      if (granteeOid !== undefined) {
        const current = await control<Array<{ oid: number }>>`SELECT oid::integer AS oid FROM pg_catalog.pg_roles WHERE rolname=${grantee}`;
        assert.equal(current[0]?.oid, granteeOid, "grantee identity changed; refusing cleanup");
        await control.unsafe(`DROP ROLE ${quote(grantee)}`);
      }
    } finally { await control.end({ timeout: 3 }); }
  }
});

test("runtime verification refuses database CREATE and TEMPORARY grants", { timeout: 120_000 }, async t => {
  const installation = await create(t);
  await installation.initialize();
  const control = postgres(targetUrl(installation.databaseName), { max: 1, onnotice() {} });
  try {
    for (const privilege of ["CREATE", "TEMPORARY"]) {
      await control.unsafe(`GRANT ${privilege} ON DATABASE ${quote(installation.databaseName)} TO ${quote(installation.runtimeRole)}`);
      try { await assert.rejects(installation.verifyRuntime(), /FRESH_INSTALLATION_RUNTIME_VERIFY_FAILED/); }
      finally { await control.unsafe(`REVOKE ${privilege} ON DATABASE ${quote(installation.databaseName)} FROM ${quote(installation.runtimeRole)}`); }
    }
    await installation.verifyRuntime();
  } finally { await control.end({ timeout: 3 }); }
});

test("runtime verification refuses extra system-function grants without executing them", { timeout: 120_000 }, async t => {
  const installation = await create(t);
  await installation.initialize();
  const control = postgres(targetUrl(installation.databaseName), { max: 1, onnotice() {} });
  try {
    for (const grantee of [quote(installation.runtimeRole), quote(installation.ownerRole), "PUBLIC", "pg_database_owner"]) {
      await control.unsafe(`GRANT EXECUTE ON FUNCTION pg_catalog.pg_read_file(text) TO ${grantee}`);
      try { await assert.rejects(installation.verifyRuntime(), /FRESH_INSTALLATION_RUNTIME_VERIFY_FAILED/); }
      finally { await control.unsafe(`REVOKE EXECUTE ON FUNCTION pg_catalog.pg_read_file(text) FROM ${grantee}`); }
    }
    await control.unsafe(`GRANT EXECUTE ON FUNCTION pg_catalog.pg_control_system() TO ${quote(installation.runtimeRole)} WITH GRANT OPTION`);
    try { await assert.rejects(installation.verifyRuntime(), /FRESH_INSTALLATION_RUNTIME_VERIFY_FAILED/); }
    finally { await control.unsafe(`REVOKE GRANT OPTION FOR EXECUTE ON FUNCTION pg_catalog.pg_control_system() FROM ${quote(installation.runtimeRole)}`); }
    await installation.verifyRuntime();
  } finally { await control.end({ timeout: 3 }); }
});

test("fresh bootstrap refuses an extra system grant before catalog capture", { timeout: 120_000 }, async t => {
  const installation = await create(t);
  const control = postgres(targetUrl(installation.databaseName), { max: 1, onnotice() {} });
  try {
    await control.unsafe(`GRANT EXECUTE ON FUNCTION pg_catalog.pg_read_file(text) TO ${quote(installation.runtimeRole)}`);
    try { await assert.rejects(installation.initialize(), /FRESH_INSTALLATION_SCHEMA_FAILED/); }
    finally { await control.unsafe(`REVOKE EXECUTE ON FUNCTION pg_catalog.pg_read_file(text) FROM ${quote(installation.runtimeRole)}`); }
    assert.equal(existsSync(path.join(installation.directory, "schema-prepared.json")), false);
    assert.equal(existsSync(path.join(installation.directory, "schema-committed.json")), false);
    const rows = await control<Array<{ count: number }>>`
      SELECT count(*)::integer AS count FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'`;
    assert.equal(rows[0]?.count, 0);
  } finally { await control.end({ timeout: 3 }); }
});

test("fresh schema can be reopened after a lost local commit acknowledgment", { timeout: 120_000 }, async t => {
  const installation = await create(t);
  await installation.initialize();
  await installation.close();
  assert.ok(existsSync(path.join(installation.directory, "schema-prepared.json")), "durable prepared evidence is missing");
  const fixture = await freshSourceCheckoutFixture();
  const listing = readdirSync(installation.directory).sort();
  const verified = await fixture.api.verifyFreshInstallationSchemaV1(installation.directory);
  assert.equal(verified.origin.databaseOid, installation.origin.databaseOid);
  assert.deepEqual(readdirSync(installation.directory).sort(), listing);
  unlinkSync(path.join(installation.directory, "schema-committed.json")); // Exact test-owned acknowledgment only.
  await assert.rejects(fixture.api.verifyFreshInstallationSchemaV1(installation.directory), /FRESH_INSTALLATION_SCHEMA_VERIFICATION_REFUSED/);
  assert.equal(existsSync(path.join(installation.directory, "schema-committed.json")), false);
  const [recovered, concurrent] = await Promise.all([
    fixture.api.reconcileFreshInstallationSchemaV1(installation.directory),
    fixture.api.reconcileFreshInstallationSchemaV1(installation.directory),
  ]);
  assert.equal(recovered.origin.databaseOid, installation.origin.databaseOid);
  assert.deepEqual(concurrent, recovered);
  assert.ok(existsSync(path.join(installation.directory, "schema-committed.json")));
  const before = readFileSync(path.join(installation.directory, "schema-committed.json"));
  await fixture.api.reconcileFreshInstallationSchemaV1(installation.directory);
  assert.deepEqual(readFileSync(path.join(installation.directory, "schema-committed.json")), before);
});

test("fresh bootstrap reconciles a real lost server COMMIT response", { timeout: 120_000 }, async t => {
  const proxy = await createCommitAckLossProxy(adminUrl);
  let installation: Awaited<ReturnType<typeof create>> | undefined;
  try {
    installation = await create(t, undefined, undefined, undefined, proxy.adminUrl);
    proxy.arm();
    const origin = await installation.initialize();
    assert.equal(proxy.dropped(), 1, "the actual server COMMIT response was not interrupted");
    assert.equal(origin.databaseOid, installation.origin.databaseOid);
    assert.ok(existsSync(path.join(installation.directory, "schema-prepared.json")));
    assert.ok(existsSync(path.join(installation.directory, "schema-committed.json")));
    await installation.verifyRuntime();
    const control = postgres(targetUrl(installation.databaseName), { max: 1, onnotice() {} });
    try {
      const rows = await control<Array<{ count: number; last: number }>>`
        SELECT count(*)::integer AS count, max(version)::integer AS last FROM public.setfarm_schema_migrations`;
      assert.deepEqual([...rows], [{ count: 33, last: 33 }]);
    } finally { await control.end({ timeout: 3 }); }
    await assert.rejects(installation.initialize(), /FRESH_INSTALLATION_ALREADY_INITIALIZED/);
  } finally {
    try { await installation?.close(); } finally { await proxy.close(); }
  }
});

test("reopen refuses unsafe or changed private evidence without writes", { timeout: 120_000 }, async t => {
  const installation = await create(t);
  await installation.initialize();
  await installation.close();
  const fixture = await freshSourceCheckoutFixture();
  const prepared = path.join(installation.directory, "schema-prepared.json");
  const original = readFileSync(prepared);
  const committed = path.join(installation.directory, "schema-committed.json");
  const ack = readFileSync(committed);
  const listing = readdirSync(installation.directory).sort();
  const refuses = async () => {
    await assert.rejects(fixture.api.verifyFreshInstallationSchemaV1(installation.directory), /FRESH_INSTALLATION_SCHEMA_VERIFICATION_REFUSED/);
    await assert.rejects(fixture.api.reconcileFreshInstallationSchemaV1(installation.directory), /FRESH_INSTALLATION_RECONCILIATION_REFUSED/);
    assert.deepEqual(readdirSync(installation.directory).sort(), listing);
  };
  for (const bytes of [Buffer.from("{"), Buffer.alloc(32769, 0x20), Buffer.from(original.toString().replace('"catalogHash":"', '"catalogHash":"f'))]) {
    try { writeFileSync(prepared, bytes); await refuses(); }
    finally { writeFileSync(prepared, original); }
  }
  try { chmodSync(prepared, 0o644); await refuses(); }
  finally { chmodSync(prepared, 0o600); }
  const linked = path.join(path.dirname(installation.directory), "test-owned-link.json");
  try { linkSync(prepared, linked); await refuses(); }
  finally { unlinkSync(linked); }
  try {
    copyFileSync(prepared, linked);
    unlinkSync(prepared); symlinkSync(linked, prepared); await refuses();
  } finally {
    unlinkSync(prepared); writeFileSync(prepared, original, { mode: 0o600 }); unlinkSync(linked);
  }
  try {
    const conflicting = JSON.parse(ack.toString()); conflicting.catalogHash = "0".repeat(64);
    writeFileSync(committed, JSON.stringify(conflicting) + "\n"); await refuses();
  } finally { writeFileSync(committed, ack); }
  const copied = path.join(mkdtempSync(path.join(tmpdir(), "setfarm-fresh-copied-records-")), installation.installationId);
  mkdirSync(copied, { mode: 0o700 });
  for (const name of listing) copyFileSync(path.join(installation.directory, name), path.join(copied, name));
  await assert.rejects(fixture.api.reconcileFreshInstallationSchemaV1(copied), /FRESH_INSTALLATION_RECONCILIATION_REFUSED/);
  assert.deepEqual(await fixture.api.verifyFreshInstallationSchemaV1(installation.directory),
    await fixture.api.reconcileFreshInstallationSchemaV1(installation.directory));
});
