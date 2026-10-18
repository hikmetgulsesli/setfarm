import { randomBytes, randomUUID } from "node:crypto";
import { constants, closeSync, fsyncSync, lstatSync, mkdirSync, openSync, statfsSync, writeFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { parseFreshInstallationOriginV1, verifyFreshInstallationDatabaseIdentityV1,
  type FreshInstallationOriginV1 } from "./fresh-installation-origin-v1.js";
import { verifyOrdinaryBaseSchemaCatalogReadOnlyV1 } from "../db/base-schema-readonly-verifier-v1.js";
import { verifyContractSpineCurrentHeadJournalReadOnlyV1 } from "../db/contract-spine-readonly-verifier-v1.js";
import { verifyExpectedPublicObjectOwnerInTransactionReadOnlyV1 } from "../db/public-object-owner-readonly-verifier-v1.js";
import { readFreshInstallationCatalogHashV1 } from "./fresh-installation-catalog-v1.js";

const activeTransactions = new WeakMap<object, FreshInstallationOriginV1>();
const quote = (value: string): string => `"${value.replaceAll('"', '""')}"`;

/** Only this controller can register its actual privately owned transaction. */
export function requireFreshInstallationTransactionV1(transaction: unknown): FreshInstallationOriginV1 {
  const origin = (typeof transaction === "function" || (transaction !== null && typeof transaction === "object"))
    ? activeTransactions.get(transaction as object) : undefined;
  if (!origin) throw new Error("FRESH_INSTALLATION_TRANSACTION_NOT_OWNED");
  return origin;
}

export type FreshInstallationOptionsV1 = Readonly<{
  adminUrl: string;
  baseDirectory: string;
  sourceSha: string;
}>;
export type FreshInstallationV1 = Readonly<{
  installationId: string;
  directory: string;
  databaseName: string;
  ownerRole: string;
  runtimeRole: string;
  origin: FreshInstallationOriginV1;
  initialize(): Promise<FreshInstallationOriginV1>;
  verifyRuntime(): Promise<void>;
  close(): Promise<void>;
}>;

function ensureCapacity(directory: string): void {
  const capacity = statfsSync(directory, { bigint: true });
  // Reserve64MiB for this small bootstrap above the standing8GiB floor.
  if (capacity.bavail * capacity.bsize < 8n * 1024n ** 3n + 64n * 1024n ** 2n) {
    throw new Error("FRESH_INSTALLATION_DISK_CAPACITY_REFUSED");
  }
}
function maintenanceUrl(value: string): URL {
  let u: URL;
  try { u = new URL(value); } catch { throw new Error("FRESH_INSTALLATION_ADMIN_ENDPOINT_INVALID"); }
  if (!["postgres:", "postgresql:"].includes(u.protocol)
    || !["127.0.0.1", "localhost", "[::1]"].includes(u.hostname)
    || u.pathname !== "/postgres" || !u.username || u.search || u.hash) {
    throw new Error("FRESH_INSTALLATION_ADMIN_ENDPOINT_INVALID");
  }
  return u;
}
function privateRecord(directory: string, name: string, value: unknown): void {
  const fd = openSync(path.join(directory, name), constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  try { writeFileSync(fd, `${JSON.stringify(value)}\n`); fsyncSync(fd); }
  finally { closeSync(fd); }
  const parent = openSync(directory, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  try { fsyncSync(parent); } finally { closeSync(parent); }
}
function redactedFailure(directory: string, stage: string, error: unknown): Error {
  const code = error && typeof error === "object" && "code" in error && typeof error.code === "string"
    && /^(?:[A-Z0-9]{5}|MIGRATION_[A-Z0-9_]+)$/.test(error.code) ? error.code : undefined;
  const diagnostic = error instanceof Error && /^(?:Migration |migration journal |Fresh installation |cannot execute |FRESH_INSTALLATION_|SETFARM_BASE_SCHEMA_)/.test(error.message)
    && !error.message.includes("://") ? error.message.slice(0, 240) : undefined;
  const frame = error instanceof Error ? error.stack?.split("\n").find(line => /^\s+at .*\/src\/[^\n]+:\d+:\d+\)?$/.test(line)) : undefined;
  try { privateRecord(directory, `failure-${randomUUID()}.json`, { schema: "setfarm.fresh-installation-failure.v1", stage, code, diagnostic, frame }); }
  catch { return new Error(`FRESH_INSTALLATION_${stage}_FAILED_RECORD_UNCERTAIN`); }
  return new Error(`FRESH_INSTALLATION_${stage}_FAILED${code ? `:${code}` : ""}`);
}

/** Headless provisioning only: no service, producer activation or ready publication. */
export async function createFreshInstallationV1(options: FreshInstallationOptionsV1): Promise<FreshInstallationV1> {
  const u = maintenanceUrl(options.adminUrl);
  if (!/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(options.sourceSha)) throw new Error("FRESH_INSTALLATION_SOURCE_INVALID");
  const base = lstatSync(options.baseDirectory);
  if (!base.isDirectory() || base.isSymbolicLink() || base.uid !== process.getuid?.()
    || (base.mode & 0o077) !== 0) throw new Error("FRESH_INSTALLATION_DIRECTORY_INVALID");
  ensureCapacity(options.baseDirectory);
  const installationId = randomUUID(), operationId = randomUUID(), suffix = installationId.replaceAll("-", "");
  const databaseName = `setfarm_install_${suffix}`, ownerRole = `sf_owner_${suffix}`, runtimeRole = `sf_runtime_${suffix}`;
  const directory = path.join(options.baseDirectory, installationId);
  mkdirSync(directory, { mode: 0o700 });
  privateRecord(directory, "planned.json", { schema: "setfarm.fresh-installation-plan.v1", installationId, operationId,
    databaseName, ownerRole, runtimeRole, sourceSha: options.sourceSha });
  const password = randomBytes(32).toString("hex");
  const admin = postgres(u.href, { max: 1, connect_timeout: 5, idle_timeout: 2, onnotice() {} });
  let ownerOid: number, runtimeOid: number, origin: FreshInstallationOriginV1;
  try {
    const collision = await admin<Array<{ name: string }>>`
      SELECT rolname AS name FROM pg_catalog.pg_roles WHERE rolname IN (${ownerRole},${runtimeRole})
      UNION ALL SELECT datname AS name FROM pg_catalog.pg_database WHERE datname=${databaseName}`;
    if (collision.length !== 0) throw new Error("FRESH_INSTALLATION_TARGET_EXISTS");
    await admin.unsafe(`CREATE ROLE ${quote(ownerRole)} NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`);
    const owner = await admin<Array<{ oid: number }>>`SELECT oid::integer AS oid FROM pg_catalog.pg_roles WHERE rolname=${ownerRole}`;
    ownerOid = owner[0]!.oid;
    privateRecord(directory, "owner-created.json", { ownerRole, ownerOid });
    // Generated hex only; no caller-controlled SQL or secret-bearing errors escape.
    await admin.unsafe(`CREATE ROLE ${quote(runtimeRole)} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD '${password}'`);
    const runtime = await admin<Array<{ oid: number }>>`SELECT oid::integer AS oid FROM pg_catalog.pg_roles WHERE rolname=${runtimeRole}`;
    runtimeOid = runtime[0]!.oid;
    privateRecord(directory, "runtime-created.json", { runtimeRole, runtimeOid });
    ensureCapacity(directory);
    await admin.unsafe(`CREATE DATABASE ${quote(databaseName)} WITH TEMPLATE template0 OWNER ${quote(ownerRole)}`);
    const identity = await admin<Array<{ oid: number; owner: string; system_identifier: string }>>`
      SELECT d.oid::integer AS oid, pg_get_userbyid(d.datdba) AS owner, c.system_identifier::text AS system_identifier
      FROM pg_catalog.pg_database d CROSS JOIN pg_catalog.pg_control_system() c WHERE d.datname=${databaseName}`;
    if (identity.length !== 1 || identity[0]!.owner !== ownerRole) throw new Error("FRESH_INSTALLATION_CREATED_IDENTITY_INVALID");
    const { getContractSpineCurrentHeadJournalIdentitiesV1 } = await import("../db/contract-spine-migrations.js");
    origin = parseFreshInstallationOriginV1({ schema: "setfarm.fresh-installation-origin.v1", installationId, operationId,
      databaseOid: identity[0]!.oid, systemIdentifier: identity[0]!.system_identifier, databaseName, ownerRole, runtimeRole,
      sourceSha: options.sourceSha, migrations: getContractSpineCurrentHeadJournalIdentitiesV1() });
    privateRecord(directory, "database-created.json", { origin, ownerOid, runtimeOid });
    await admin.unsafe(`REVOKE ALL ON DATABASE ${quote(databaseName)} FROM PUBLIC`);
  } catch (error) { throw redactedFailure(directory, "CREATE", error); }
  finally { await admin.end({ timeout: 5 }); }

  const target = new URL(u); target.pathname = "/" + databaseName;
  const runtimeEndpoint = new URL(target); runtimeEndpoint.username = runtimeRole; runtimeEndpoint.password = password;
  privateRecord(directory, "runtime-credentials.json", { runtimeUrl: runtimeEndpoint.href });
  const sql = postgres(target.href, { max: 1, connect_timeout: 5, idle_timeout: 2, onnotice() {} });
  let phase: "created" | "initializing" | "committed" | "failed" | "closed" = "created";
  let catalogHash: string | undefined;

  async function verifyRuntime(): Promise<void> {
    if (phase !== "committed") throw new Error("FRESH_INSTALLATION_RUNTIME_NOT_INITIALIZED");
    const runtime = postgres(runtimeEndpoint.href, { max: 1, connect_timeout: 5, onnotice() {} });
    try {
      await runtime.begin("isolation level repeatable read read only", async tx => {
        await verifyFreshInstallationDatabaseIdentityV1(tx, origin);
        await verifyExpectedPublicObjectOwnerInTransactionReadOnlyV1(tx, ownerRole);
      });
      await verifyContractSpineCurrentHeadJournalReadOnlyV1(runtime);
      await verifyOrdinaryBaseSchemaCatalogReadOnlyV1(runtime);
      const { verifyFreshInstallationSchemaReadOnlyV1 } = await import("../db/contract-spine-migrations.js");
      if (!catalogHash) throw new Error("FRESH_INSTALLATION_CATALOG_NOT_COMMITTED");
      await verifyFreshInstallationSchemaReadOnlyV1(runtime, origin, catalogHash);
    } catch (error) { throw redactedFailure(directory, "RUNTIME_VERIFY", error); }
    finally { await runtime.end({ timeout: 5 }); }
  }

  return Object.freeze({ installationId, directory, databaseName, ownerRole, runtimeRole, origin,
    async initialize() {
      if (phase === "committed") throw new Error("FRESH_INSTALLATION_ALREADY_INITIALIZED");
      if (phase !== "created") throw new Error("FRESH_INSTALLATION_NOT_INITIALIZABLE");
      phase = "initializing";
      try {
        ensureCapacity(directory);
        const { initializeFreshInstallationContractSpineV1 } = await import("../db/contract-spine-migrations.js");
        await sql.begin(async transaction => {
          await transaction.unsafe("SELECT set_config('lock_timeout','5000ms',true)");
          await transaction.unsafe("SELECT set_config('statement_timeout','30000ms',true)");
          await transaction.unsafe(`GRANT EXECUTE ON FUNCTION pg_catalog.pg_control_system() TO ${quote(ownerRole)}, ${quote(runtimeRole)}`);
          await transaction.unsafe(`SET LOCAL ROLE ${quote(ownerRole)}`);
          activeTransactions.set(transaction as object, origin);
          try {
            await initializeFreshInstallationContractSpineV1(transaction);
            await transaction.unsafe("REVOKE ALL ON SCHEMA public FROM PUBLIC");
            await transaction.unsafe(`GRANT USAGE ON SCHEMA public TO ${quote(runtimeRole)}`);
            await transaction.unsafe(`GRANT SELECT ON ALL TABLES IN SCHEMA public TO ${quote(runtimeRole)}`);
            await transaction.unsafe(`GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO ${quote(runtimeRole)}`);
            await transaction.unsafe(`GRANT CONNECT ON DATABASE ${quote(databaseName)} TO ${quote(runtimeRole)}`);
            catalogHash = await readFreshInstallationCatalogHashV1(transaction);
          } finally { activeTransactions.delete(transaction as object); }
        });
        phase = "committed";
        await verifyRuntime();
        privateRecord(directory, "schema-committed.json", { schema: "setfarm.fresh-installation-schema-committed.v1", origin, catalogHash });
        return origin;
      } catch (error) {
        // A committed but unacknowledged database is retained; never bootstrap it again.
        if (phase !== "committed") phase = "failed";
        throw redactedFailure(directory, "SCHEMA", error);
      }
    },
    verifyRuntime,
    async close() { phase = "closed"; await sql.end({ timeout: 5 }); },
  });
}
