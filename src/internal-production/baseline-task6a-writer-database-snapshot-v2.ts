import { types } from "node:util";

import { hashCanonicalJson } from "../product-compiler/canonical-json.js";

const SCHEMA = "setfarm.internal-production-task6a-writer-database-snapshot.v2";
const ROW_KEYS = ["databaseName", "databaseOwnerRole", "sessionRole", "effectiveRole", "login", "superuser",
  "bypassRls", "createRole", "createDatabase", "otherSessionCountText"] as const;

// Keep the role join and the session population in one fixed statement. The
// activity view is live even in a repeatable-read catalog transaction.
const SNAPSHOT_SQL = `
SELECT d.datname AS "databaseName", database_owner.rolname AS "databaseOwnerRole",
       session_role.rolname AS "sessionRole", current_user AS "effectiveRole",
       session_role.rolcanlogin AS "login", session_role.rolsuper AS "superuser",
       session_role.rolbypassrls AS "bypassRls", session_role.rolcreaterole AS "createRole",
       session_role.rolcreatedb AS "createDatabase",
       (SELECT count(*)::text FROM pg_stat_activity AS a
         WHERE a.datid = d.oid AND a.usesysid = session_role.oid
           AND a.pid <> pg_backend_pid()) AS "otherSessionCountText"
  FROM pg_database AS d
  JOIN pg_roles AS database_owner ON database_owner.oid = d.datdba
  JOIN pg_roles AS session_role ON session_role.rolname = session_user
 WHERE d.datname = current_database()`;

function fail(): never {
  throw new Error("INTERNAL_PRODUCTION_TASK6A_WRITER_DATABASE_SNAPSHOT_INVALID");
}

function record(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || types.isProxy(value)
    || Object.getPrototypeOf(value) !== Object.prototype) fail();
  const descriptors = Object.getOwnPropertyDescriptors(value) as Record<string, PropertyDescriptor>;
  const keys = Reflect.ownKeys(descriptors);
  if (keys.length !== ROW_KEYS.length || keys.some(key => typeof key !== "string" || !ROW_KEYS.includes(key as typeof ROW_KEYS[number])
    || !descriptors[key]!.enumerable || !("value" in descriptors[key]!))) fail();
  return Object.fromEntries(ROW_KEYS.map(key => [key, descriptors[key]!.value as unknown]));
}

function roleName(value: unknown): string {
  if (typeof value !== "string" || !/^[a-z][a-z0-9_]{0,62}$/.test(value)) fail();
  return value;
}

function flag(value: unknown): boolean {
  if (typeof value !== "boolean") fail();
  return value;
}

function oneRow(value: unknown): Record<string, unknown> {
  if (types.isProxy(value) || !Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length !== 1) fail();
  const descriptors = Object.getOwnPropertyDescriptors(value) as unknown as Record<string, PropertyDescriptor>;
  const keys = Reflect.ownKeys(descriptors);
  if (keys.length !== 2 || !descriptors["0"]?.enumerable || !("value" in descriptors["0"])
    || !descriptors["length"] || descriptors["length"].value !== 1) fail();
  return record(descriptors["0"].value);
}

export async function projectTask6aWriterDatabaseSnapshotInTransactionV2(query: (statement: string) => Promise<unknown>) {
  try {
    if (typeof query !== "function") fail();
    const row = oneRow(await query(SNAPSHOT_SQL));
    if (row.databaseName !== "setfarm") fail();
    const databaseOwnerRole = roleName(row.databaseOwnerRole);
    const sessionRole = roleName(row.sessionRole);
    if (roleName(row.effectiveRole) !== sessionRole) fail();
    const countText = row.otherSessionCountText;
    if (typeof countText !== "string" || !/^(0|[1-9][0-9]*)$/.test(countText)) fail();
    const otherSessionCount = Number(countText);
    if (!Number.isSafeInteger(otherSessionCount)) fail();
    const database = Object.freeze({
      databaseName: "setfarm" as const, databaseOwnerRole, sessionRole,
      effectiveRole: sessionRole, login: flag(row.login), superuser: flag(row.superuser),
      bypassRls: flag(row.bypassRls), createRole: flag(row.createRole),
      createDatabase: flag(row.createDatabase), otherSessionCount,
    });
    const body = Object.freeze({
      schema: SCHEMA, authority: "diagnostic-only" as const,
      temporalScope: "catalog-snapshot-and-live-session-sample" as const,
      cutoverAdmission: "not-granted" as const,
      physicalIdentityProvenance: "unverified" as const, database,
    });
    return Object.freeze({ ...body, snapshotHash: hashCanonicalJson(body) });
  } catch { fail(); }
}

// Import-inert. Only a privately held, explicitly supplied local launcher URL
// can reach the driver; ambient runtime configuration is never consulted.
export async function observeTask6aWriterDatabaseSnapshotV2(databaseUrl: string | undefined) {
  let sql: import("postgres").Sql | undefined;
  try {
    if (typeof databaseUrl !== "string" || Object.keys(process.env).some(key => key.startsWith("PG"))
      || !/^postgres(?:ql)?:\/\/[^/?#@\s]+@(?:localhost|127\.0\.0\.1)(?::5432)?\/setfarm$/.test(databaseUrl)) fail();
    const target = new URL(databaseUrl);
    const username = decodeURIComponent(target.username);
    if (!["postgres:", "postgresql:"].includes(target.protocol) || !target.password || !/^[a-z][a-z0-9_]{0,62}$/.test(username)
      || !["localhost", "127.0.0.1"].includes(target.hostname)
      || (target.port !== "" && target.port !== "5432") || target.pathname !== "/setfarm"
      || target.search !== "" || target.hash !== "") fail();
    const postgresModule = await import("postgres");
    sql = postgresModule.default(databaseUrl, {
      max: 1, idle_timeout: 1, connect_timeout: 5, debug: false, onnotice: () => {},
      connection: { statement_timeout: 5000, lock_timeout: 1000, idle_in_transaction_session_timeout: 5000 },
    });
    if (sql.options.host.length !== 1 || sql.options.host[0] !== target.hostname
      || sql.options.port.length !== 1 || sql.options.port[0] !== 5432
      || sql.options.database !== "setfarm" || sql.options.user !== username) fail();
    let deadline: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([sql.begin("isolation level repeatable read read only", async tx => {
        const connection = tx as unknown as typeof sql;
        if (!connection) fail();
        await connection`SET LOCAL statement_timeout = '5s'`;
        await connection`SET LOCAL lock_timeout = '1s'`;
        const snapshot = await projectTask6aWriterDatabaseSnapshotInTransactionV2(async statement =>
          Array.from(await connection.unsafe(statement)));
        if (snapshot.database.sessionRole !== username) fail();
        return snapshot;
      }), new Promise<never>((_, reject) => {
        deadline = setTimeout(() => reject(new Error("TRANSACTION_DEADLINE")), 7500);
      })]);
    } finally {
      if (deadline) clearTimeout(deadline);
    }
  } catch { fail(); }
  finally {
    if (sql) {
      try { await sql.end({ timeout: 1 }); } catch { fail(); }
    }
  }
}
