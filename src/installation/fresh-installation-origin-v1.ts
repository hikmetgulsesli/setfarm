import { types } from "node:util";
import { hashCanonicalJson } from "../product-compiler/canonical-json.js";

export type FreshInstallationOriginV1 = Readonly<{
  schema: "setfarm.fresh-installation-origin.v1";
  installationId: string;
  operationId: string;
  systemIdentifier: string;
  databaseOid: number;
  databaseName: string;
  ownerRole: string;
  runtimeRole: string;
  sourceSha: string;
  migrations: readonly Readonly<{ version: number; name: string; checksum: string; migrationClass: "automatic" | "guarded" }>[];
}>;
export type FreshInstallationApplicationV1 = Readonly<{
  schema: "setfarm.fresh-installation-schema-application.v1";
  origin: FreshInstallationOriginV1;
  evidenceHash: string;
  applicationHash: string;
}>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const HASH = /^[0-9a-f]{64}$/;
function fail(): never { throw new Error("FRESH_INSTALLATION_ORIGIN_INVALID"); }
function record(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || types.isProxy(value) || Array.isArray(value)
    || Object.getPrototypeOf(value) !== Object.prototype) fail();
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(value).length !== keys.length
    || keys.some(key => !descriptors[key]?.enumerable || !Object.hasOwn(descriptors[key]!, "value"))) fail();
  return value as Record<string, unknown>;
}

/** Data validation only. A parsed origin never authorizes schema writes. */
export function parseFreshInstallationOriginV1(value: unknown): FreshInstallationOriginV1 {
  const v = record(value, ["schema", "installationId", "operationId", "systemIdentifier", "databaseOid",
    "databaseName", "ownerRole", "runtimeRole", "sourceSha", "migrations"]);
  if (v.schema !== "setfarm.fresh-installation-origin.v1"
    || typeof v.installationId !== "string" || !UUID.test(v.installationId)
    || typeof v.operationId !== "string" || !UUID.test(v.operationId)
    || typeof v.systemIdentifier !== "string" || !/^[1-9][0-9]{0,19}$/.test(v.systemIdentifier)
    || BigInt(v.systemIdentifier) > 18446744073709551615n
    || typeof v.databaseOid !== "number" || !Number.isInteger(v.databaseOid)
    || v.databaseOid < 1 || v.databaseOid > 4294967295
    || typeof v.sourceSha !== "string" || !/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(v.sourceSha)
    || !Array.isArray(v.migrations) || types.isProxy(v.migrations) || v.migrations.length !== 33) fail();
  const suffix = v.installationId.replaceAll("-", "");
  if (v.databaseName !== `setfarm_install_${suffix}` || v.ownerRole !== `sf_owner_${suffix}`
    || v.runtimeRole !== `sf_runtime_${suffix}`) fail();
  const entries = Object.getOwnPropertyDescriptors(v.migrations);
  if (Object.getPrototypeOf(v.migrations) !== Array.prototype || Reflect.ownKeys(v.migrations).length !== 34) fail();
  const migrations: FreshInstallationOriginV1["migrations"][number][] = [];
  for (let index = 0; index < 33; index += 1) {
    const entry = entries[String(index)];
    if (!entry?.enumerable || !Object.hasOwn(entry, "value")) fail();
    const item: unknown = entry.value;
    const m = record(item, ["version", "name", "checksum", "migrationClass"]);
    if (m.version !== index + 1 || typeof m.name !== "string" || m.name.length < 1 || m.name.length > 256
      || typeof m.checksum !== "string" || !HASH.test(m.checksum)
      || m.migrationClass !== (index === 31 ? "guarded" : "automatic")) fail();
    migrations.push(Object.freeze({ version: index + 1, name: m.name, checksum: m.checksum,
      migrationClass: m.migrationClass as "automatic" | "guarded" }));
  }
  return Object.freeze({ ...v, migrations: Object.freeze(migrations) }) as FreshInstallationOriginV1;
}

export function createFreshInstallationApplicationV1(origin: FreshInstallationOriginV1): FreshInstallationApplicationV1 {
  const copied = parseFreshInstallationOriginV1(origin);
  const body = { schema: "setfarm.fresh-installation-schema-application.v1" as const,
    origin: copied, evidenceHash: hashCanonicalJson(copied) };
  return Object.freeze({ ...body, applicationHash: hashCanonicalJson(body) });
}

export function parseFreshInstallationApplicationV1(value: unknown, evidenceHash: string): FreshInstallationApplicationV1 {
  const v = record(value, ["schema", "origin", "evidenceHash", "applicationHash"]);
  if (v.schema !== "setfarm.fresh-installation-schema-application.v1" || !HASH.test(evidenceHash)
    || v.evidenceHash !== evidenceHash) fail();
  const expected = createFreshInstallationApplicationV1(parseFreshInstallationOriginV1(v.origin));
  if (expected.evidenceHash !== evidenceHash || v.applicationHash !== expected.applicationHash) fail();
  return expected;
}

type IdentitySqlV1 = Readonly<{
  unsafe<T extends Record<string, unknown>[]>(query: string): PromiseLike<T>;
}>;
/** Actual connected identity check; valid JSON from another database is refused. */
export async function verifyFreshInstallationDatabaseIdentityV1(
  sql: IdentitySqlV1, origin: FreshInstallationOriginV1,
): Promise<void> {
  const rows = await sql.unsafe<Array<{ system_identifier: string; database_oid: number;
    database_name: string; owner_role: string; current_role: string }>>(
    `SELECT control.system_identifier::text AS system_identifier, database.oid::integer AS database_oid,
       database.datname AS database_name, pg_catalog.pg_get_userbyid(database.datdba) AS owner_role,
       current_user AS current_role
     FROM pg_catalog.pg_database database CROSS JOIN pg_catalog.pg_control_system() control
     WHERE database.datname = current_database()`,
  );
  const row = rows[0];
  if (rows.length !== 1 || !row || row.system_identifier !== origin.systemIdentifier
    || row.database_oid !== origin.databaseOid || row.database_name !== origin.databaseName
    || row.owner_role !== origin.ownerRole
    || ![origin.ownerRole, origin.runtimeRole].includes(row.current_role)) {
    throw new Error("FRESH_INSTALLATION_DATABASE_IDENTITY_MISMATCH");
  }
}
