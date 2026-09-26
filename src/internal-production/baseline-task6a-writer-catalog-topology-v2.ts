import { types } from "node:util";

import { hashCanonicalJson } from "../product-compiler/canonical-json.js";

const SCHEMA = "setfarm.internal-production-task6a-writer-catalog-topology.v2";
const COUNT_NAMES = ["directMembership", "directInherit", "directSet", "directAdmin", "schema", "ownedSchema",
  "relation", "ownedRelation", "sequence", "ownedSequence", "routine", "ownedRoutine",
  "securityDefinerRoutine", "selectedExplicitAclRow", "defaultAcl", "ownedDefaultAcl"] as const;
const ROW_KEYS = ["serverVersionText", "databaseName", "sessionRole", "effectiveRole",
  ...COUNT_NAMES.map(name => `${name}CountText`)] as const;

// Coarse topology, never an effective-permission or writer-denial proof. Direct
// membership options are deliberately not represented as transitive authority.
const TOPOLOGY_SQL = `
SELECT current_setting('server_version_num') AS "serverVersionText",
       d.datname AS "databaseName", r.rolname AS "sessionRole", current_user AS "effectiveRole",
       (SELECT count(DISTINCT m.roleid)::text FROM pg_auth_members m WHERE m.member = r.oid) AS "directMembershipCountText",
       (SELECT count(DISTINCT m.roleid)::text FROM pg_auth_members m WHERE m.member = r.oid AND m.inherit_option) AS "directInheritCountText",
       (SELECT count(DISTINCT m.roleid)::text FROM pg_auth_members m WHERE m.member = r.oid AND m.set_option) AS "directSetCountText",
       (SELECT count(DISTINCT m.roleid)::text FROM pg_auth_members m WHERE m.member = r.oid AND m.admin_option) AS "directAdminCountText",
       (SELECT count(*)::text FROM pg_namespace n WHERE left(n.nspname, 3) <> 'pg_' AND n.nspname <> 'information_schema') AS "schemaCountText",
       (SELECT count(*)::text FROM pg_namespace n WHERE left(n.nspname, 3) <> 'pg_' AND n.nspname <> 'information_schema' AND n.nspowner = r.oid) AS "ownedSchemaCountText",
       (SELECT count(*)::text FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE left(n.nspname, 3) <> 'pg_' AND n.nspname <> 'information_schema') AS "relationCountText",
       (SELECT count(*)::text FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE left(n.nspname, 3) <> 'pg_' AND n.nspname <> 'information_schema' AND c.relowner = r.oid) AS "ownedRelationCountText",
       (SELECT count(*)::text FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE left(n.nspname, 3) <> 'pg_' AND n.nspname <> 'information_schema' AND c.relkind = 'S') AS "sequenceCountText",
       (SELECT count(*)::text FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE left(n.nspname, 3) <> 'pg_' AND n.nspname <> 'information_schema' AND c.relkind = 'S' AND c.relowner = r.oid) AS "ownedSequenceCountText",
       (SELECT count(*)::text FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE left(n.nspname, 3) <> 'pg_' AND n.nspname <> 'information_schema') AS "routineCountText",
       (SELECT count(*)::text FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE left(n.nspname, 3) <> 'pg_' AND n.nspname <> 'information_schema' AND p.proowner = r.oid) AS "ownedRoutineCountText",
       (SELECT count(*)::text FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE left(n.nspname, 3) <> 'pg_' AND n.nspname <> 'information_schema' AND p.prosecdef) AS "securityDefinerRoutineCountText",
       (SELECT count(*)::text FROM (
          SELECT 1 FROM pg_database ad WHERE ad.datname = current_database() AND ad.datacl IS NOT NULL
          UNION ALL SELECT 1 FROM pg_namespace n WHERE left(n.nspname, 3) <> 'pg_' AND n.nspname <> 'information_schema' AND n.nspacl IS NOT NULL
          UNION ALL SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE left(n.nspname, 3) <> 'pg_' AND n.nspname <> 'information_schema' AND c.relacl IS NOT NULL
          UNION ALL SELECT 1 FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE left(n.nspname, 3) <> 'pg_' AND n.nspname <> 'information_schema' AND a.attnum > 0 AND a.attacl IS NOT NULL
          UNION ALL SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE left(n.nspname, 3) <> 'pg_' AND n.nspname <> 'information_schema' AND p.proacl IS NOT NULL
          UNION ALL SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE left(n.nspname, 3) <> 'pg_' AND n.nspname <> 'information_schema' AND t.typacl IS NOT NULL
       ) acl_rows) AS "selectedExplicitAclRowCountText",
       (SELECT count(*)::text FROM pg_default_acl a) AS "defaultAclCountText",
       (SELECT count(*)::text FROM pg_default_acl a WHERE a.defaclrole = r.oid) AS "ownedDefaultAclCountText"
  FROM pg_database d JOIN pg_roles r ON r.rolname = session_user
 WHERE d.datname = current_database()`;

function fail(): never { throw new Error("INTERNAL_PRODUCTION_TASK6A_WRITER_CATALOG_TOPOLOGY_INVALID"); }
function oneRow(value: unknown): Record<string, unknown> {
  if (types.isProxy(value) || !Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length !== 1) fail();
  const descriptors = Object.getOwnPropertyDescriptors(value) as Record<string, PropertyDescriptor>;
  if (Reflect.ownKeys(descriptors).length !== 2 || !descriptors["0"]?.enumerable || !("value" in descriptors["0"])
    || descriptors.length?.value !== 1) fail();
  const row = descriptors["0"].value as unknown;
  if (row === null || typeof row !== "object" || types.isProxy(row) || Object.getPrototypeOf(row) !== Object.prototype) fail();
  const fields = Object.getOwnPropertyDescriptors(row) as Record<string, PropertyDescriptor>;
  if (Reflect.ownKeys(fields).length !== ROW_KEYS.length || Reflect.ownKeys(fields).some(key => typeof key !== "string"
    || !ROW_KEYS.includes(key as typeof ROW_KEYS[number]) || !fields[key]!.enumerable || !("value" in fields[key]!))) fail();
  return Object.fromEntries(ROW_KEYS.map(key => [key, fields[key]!.value as unknown]));
}
function roleName(value: unknown): string {
  if (typeof value !== "string" || !/^[a-z][a-z0-9_]{0,62}$/.test(value)) fail();
  return value;
}
function count(value: unknown): number {
  if (typeof value !== "string" || !/^(0|[1-9][0-9]*)$/.test(value)) fail();
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) fail();
  return parsed;
}

export async function projectTask6aWriterCatalogTopologyInTransactionV2(query: (statement: string) => Promise<unknown>) {
  try {
    if (typeof query !== "function") fail();
    const row = oneRow(await query(TOPOLOGY_SQL));
    if (row.databaseName !== "setfarm") fail();
    const sessionRole = roleName(row.sessionRole);
    if (roleName(row.effectiveRole) !== sessionRole) fail();
    const version = count(row.serverVersionText);
    if (version < 160000 || version >= 200000) fail();
    const counts = Object.freeze(Object.fromEntries(COUNT_NAMES.map(name =>
      [name, count(row[`${name}CountText`])])) as Record<typeof COUNT_NAMES[number], number>);
    for (const [subset, total] of [["directInherit", "directMembership"], ["directSet", "directMembership"],
      ["directAdmin", "directMembership"], ["ownedSchema", "schema"], ["ownedRelation", "relation"],
      ["sequence", "relation"], ["ownedSequence", "sequence"], ["ownedRoutine", "routine"],
      ["securityDefinerRoutine", "routine"], ["ownedDefaultAcl", "defaultAcl"]] as const) {
      if (counts[subset] > counts[total]) fail();
    }
    const body = Object.freeze({ schema: SCHEMA, authority: "diagnostic-only" as const,
      cutoverAdmission: "not-granted" as const, physicalIdentityProvenance: "unverified" as const,
      temporalScope: "catalog-transaction-snapshot" as const,
      membershipScope: "direct-only-non-transitive" as const,
      catalogScope: "coarse-selected-catalog-row-counts-not-permission-proof" as const,
      databaseName: "setfarm" as const, sessionRole, serverVersion: version, counts });
    return Object.freeze({ ...body, topologyHash: hashCanonicalJson(body) });
  } catch { fail(); }
}

/** Import-inert: only a caller-held, exact local launcher URL reaches the driver. */
export async function observeTask6aWriterCatalogTopologyV2(databaseUrl: string | undefined) {
  let sql: import("postgres").Sql | undefined;
  try {
    if (typeof databaseUrl !== "string" || Object.keys(process.env).some(key => key.startsWith("PG"))
      || !/^postgres(?:ql)?:\/\/[^/?#@\s]+@(?:localhost|127\.0\.0\.1)(?::5432)?\/setfarm$/.test(databaseUrl)) fail();
    const target = new URL(databaseUrl);
    const username = decodeURIComponent(target.username);
    if (!["postgres:", "postgresql:"].includes(target.protocol) || !/^[a-z][a-z0-9_]{0,62}$/.test(username)
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
        const topology = await projectTask6aWriterCatalogTopologyInTransactionV2(async statement =>
          Array.from(await connection.unsafe(statement)));
        if (topology.sessionRole !== username) fail();
        return topology;
      }), new Promise<never>((_, reject) => {
        deadline = setTimeout(() => reject(new Error("TRANSACTION_DEADLINE")), 7500);
      })]);
    } finally { if (deadline) clearTimeout(deadline); }
  } catch { fail(); }
  finally {
    if (sql) {
      try { await sql.end({ timeout: 1 }); } catch { fail(); }
    }
  }
}
