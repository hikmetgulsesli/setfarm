import { types } from "node:util";

import { hashCanonicalJson } from "../product-compiler/canonical-json.js";

const SCHEMA = "setfarm.internal-production-task6a-private-catalog-inventory.v3";
const MAX_ROWS = 1024;
const MAX_BYTES = 2_097_152;
const MAX_ACL_BYTES = 4096;
const META_KEYS = ["serverVersionText", "databaseName", "sessionRole", "effectiveRole"] as const;
const OBJECT_KEYS = ["kind", "oidText", "namespaceText", "nameText", "ownerText",
  "aclText", "attributeText", "publicAcl"] as const;
const DEFAULT_KEYS = ["oidText", "namespaceText", "roleText", "objectTypeText", "aclText", "publicAcl"] as const;
const MEMBERSHIP_KEYS = ["roleText", "memberText", "grantorText", "inherit", "set", "admin"] as const;
const OBJECT_KINDS = ["column", "database", "relation", "routine", "schema", "type"] as const;

const META_SQL = `SELECT current_setting('server_version_num') AS "serverVersionText",
  current_database() AS "databaseName", session_user AS "sessionRole", current_user AS "effectiveRole"`;

// This inventory records selected explicit catalog ACLs, not effective grants.
// Names and ACL text never leave the private observer in its public result.
const OBJECT_SQL = `WITH inventory AS (
  SELECT 'database' AS kind, d.oid::text AS "oidText", '' AS "namespaceText",
    d.datname AS "nameText", r.rolname AS "ownerText", left(d.datacl::text, 4097) AS "aclText",
    '' AS "attributeText", coalesce(EXISTS (
      SELECT 1 FROM aclexplode(d.datacl) AS a WHERE a.grantee = 0), false) AS "publicAcl"
  FROM pg_database d LEFT JOIN pg_roles r ON r.oid = d.datdba WHERE d.datname = current_database()
  UNION ALL
  SELECT 'schema', n.oid::text, '', n.nspname, r.rolname, left(n.nspacl::text, 4097), '',
    coalesce(EXISTS (SELECT 1 FROM aclexplode(n.nspacl) AS a WHERE a.grantee = 0), false)
  FROM pg_namespace n LEFT JOIN pg_roles r ON r.oid = n.nspowner
  WHERE left(n.nspname, 3) <> 'pg_' AND n.nspname <> 'information_schema'
  UNION ALL
  SELECT 'relation', c.oid::text, n.nspname, c.relname, r.rolname, left(c.relacl::text, 4097), c.relkind::text,
    coalesce(EXISTS (SELECT 1 FROM aclexplode(c.relacl) AS a WHERE a.grantee = 0), false)
  FROM pg_class c LEFT JOIN pg_namespace n ON n.oid = c.relnamespace
    LEFT JOIN pg_roles r ON r.oid = c.relowner
  WHERE n.oid IS NULL OR (left(n.nspname, 3) <> 'pg_' AND n.nspname <> 'information_schema')
  UNION ALL
  SELECT 'column', c.oid::text || ':' || a.attnum::text, n.nspname, a.attname, r.rolname,
    left(a.attacl::text, 4097), c.relname,
    coalesce(EXISTS (SELECT 1 FROM aclexplode(a.attacl) AS x WHERE x.grantee = 0), false)
  FROM pg_attribute a LEFT JOIN pg_class c ON c.oid = a.attrelid
    LEFT JOIN pg_namespace n ON n.oid = c.relnamespace LEFT JOIN pg_roles r ON r.oid = c.relowner
  WHERE a.attnum > 0 AND NOT a.attisdropped AND a.attacl IS NOT NULL
    AND (n.oid IS NULL OR (left(n.nspname, 3) <> 'pg_' AND n.nspname <> 'information_schema'))
  UNION ALL
  SELECT 'routine', p.oid::text, n.nspname, p.proname, r.rolname, left(p.proacl::text, 4097),
    p.prokind::text,
    coalesce(EXISTS (SELECT 1 FROM aclexplode(p.proacl) AS a WHERE a.grantee = 0), false)
  FROM pg_proc p LEFT JOIN pg_namespace n ON n.oid = p.pronamespace
    LEFT JOIN pg_roles r ON r.oid = p.proowner
  WHERE n.oid IS NULL OR (left(n.nspname, 3) <> 'pg_' AND n.nspname <> 'information_schema')
  UNION ALL
  SELECT 'type', t.oid::text, n.nspname, t.typname, r.rolname, left(t.typacl::text, 4097),
    t.typtype::text,
    coalesce(EXISTS (SELECT 1 FROM aclexplode(t.typacl) AS a WHERE a.grantee = 0), false)
  FROM pg_type t LEFT JOIN pg_namespace n ON n.oid = t.typnamespace
    LEFT JOIN pg_roles r ON r.oid = t.typowner
  WHERE n.oid IS NULL OR (left(n.nspname, 3) <> 'pg_' AND n.nspname <> 'information_schema')
) SELECT * FROM inventory ORDER BY kind COLLATE "C", "oidText" COLLATE "C" LIMIT 1025`;

const DEFAULT_SQL = `SELECT a.oid::text AS "oidText",
  CASE WHEN a.defaclnamespace = 0 THEN '' ELSE n.nspname END AS "namespaceText",
  r.rolname AS "roleText", a.defaclobjtype::text AS "objectTypeText",
  left(a.defaclacl::text, 4097) AS "aclText", coalesce(EXISTS (
    SELECT 1 FROM aclexplode(a.defaclacl) AS x WHERE x.grantee = 0), false) AS "publicAcl"
  FROM pg_default_acl a LEFT JOIN pg_namespace n ON n.oid = a.defaclnamespace
    LEFT JOIN pg_roles r ON r.oid = a.defaclrole ORDER BY a.oid::text COLLATE "C" LIMIT 1025`;

const MEMBERSHIP_SQL = `SELECT granted.rolname AS "roleText", member.rolname AS "memberText",
  grantor.rolname AS "grantorText", m.inherit_option AS inherit, m.set_option AS set,
  m.admin_option AS admin FROM pg_auth_members m
  LEFT JOIN pg_roles granted ON granted.oid = m.roleid
  LEFT JOIN pg_roles member ON member.oid = m.member
  LEFT JOIN pg_roles grantor ON grantor.oid = m.grantor
  ORDER BY granted.rolname COLLATE "C", member.rolname COLLATE "C",
    grantor.rolname COLLATE "C" LIMIT 1025`;

function fail(): never { throw new Error("INTERNAL_PRODUCTION_TASK6A_PRIVATE_CATALOG_INVENTORY_INVALID"); }
function exact(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (value === null || typeof value !== "object" || types.isProxy(value)
    || Object.getPrototypeOf(value) !== Object.prototype) fail();
  const fields = Object.getOwnPropertyDescriptors(value);
  const names = Reflect.ownKeys(fields);
  if (names.length !== keys.length || names.some(name => typeof name !== "string" || !keys.includes(name)
    || !fields[name]!.enumerable || !Object.hasOwn(fields[name]!, "value"))) fail();
  return Object.fromEntries(keys.map(key => [key, fields[key]!.value as unknown]));
}
function rowList(value: unknown): unknown[] {
  if (types.isProxy(value) || !Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype
    || value.length > MAX_ROWS) fail();
  const fields = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(fields).length !== value.length + 1) fail();
  return Array.from({ length: value.length }, (_, index) => {
    const field = fields[String(index)];
    if (!field?.enumerable || !Object.hasOwn(field, "value")) fail();
    return field.value as unknown;
  });
}
function boundedText(value: unknown, optional = false): string {
  if (typeof value !== "string" || (!optional && value.length === 0)
    || Buffer.byteLength(value, "utf8") > 63 || value.includes("\0")) fail();
  return value;
}
function oid(value: unknown, column = false): string {
  if (typeof value !== "string" || !/^([1-9][0-9]*)(?::([1-9][0-9]*))?$/.test(value)) fail();
  const [base, attribute] = value.split(":");
  if (!Number.isSafeInteger(Number(base)) || Number(base) > 4294967295
    || (attribute !== undefined && (!column || !Number.isSafeInteger(Number(attribute)) || Number(attribute) > 32767))) fail();
  return value;
}
function role(value: unknown): string {
  return boundedText(value);
}
function acl(value: unknown, nullable: boolean): string | null {
  if (value === null && nullable) return null;
  if (typeof value !== "string" || value.length === 0
    || Buffer.byteLength(value, "utf8") > MAX_ACL_BYTES || value.includes("\0")) fail();
  return value;
}
function bool(value: unknown): boolean { if (typeof value !== "boolean") fail(); return value; }
function ordered<T>(rows: unknown[], convert: (value: unknown) => T, key: (value: T) => string): T[] {
  let previous: string | undefined;
  return rows.map(raw => {
    const value = convert(raw), current = key(value);
    if (previous !== undefined && Buffer.compare(Buffer.from(previous), Buffer.from(current)) >= 0) fail();
    previous = current;
    return value;
  });
}
function objectRow(raw: unknown) {
  const row = exact(raw, OBJECT_KEYS);
  if (!OBJECT_KINDS.includes(row.kind as typeof OBJECT_KINDS[number])) fail();
  const kind = row.kind as typeof OBJECT_KINDS[number];
  const publicAcl = bool(row.publicAcl), aclText = acl(row.aclText, true);
  if (publicAcl && aclText === null) fail();
  const normalized = { kind, oidText: oid(row.oidText, kind === "column"),
    namespaceText: boundedText(row.namespaceText, true), nameText: boundedText(row.nameText),
    ownerText: role(row.ownerText), aclText, attributeText: boundedText(row.attributeText, true), publicAcl };
  if (kind === "database" && (normalized.nameText !== "setfarm" || normalized.namespaceText !== "")) fail();
  return normalized;
}
function defaultRow(raw: unknown) {
  const row = exact(raw, DEFAULT_KEYS), aclText = acl(row.aclText, false);
  return { oidText: oid(row.oidText), namespaceText: boundedText(row.namespaceText, true),
    roleText: role(row.roleText), objectTypeText: boundedText(row.objectTypeText), aclText,
    publicAcl: bool(row.publicAcl) };
}
function membershipRow(raw: unknown) {
  const row = exact(raw, MEMBERSHIP_KEYS);
  return { roleText: role(row.roleText), memberText: role(row.memberText),
    grantorText: role(row.grantorText), inherit: bool(row.inherit), set: bool(row.set), admin: bool(row.admin) };
}

/** Only the selected exact catalog rows are hashed; no private row is returned. */
export async function projectTask6aPrivateCatalogInventoryInTransactionV3(
  query: (statement: string) => Promise<unknown>, expectedSessionRole?: string) {
  try {
    if (typeof query !== "function") fail();
    const metadata = rowList(await query(META_SQL));
    if (metadata.length !== 1) fail();
    const meta = exact(metadata[0], META_KEYS);
    const versionText = meta.serverVersionText;
    if (typeof versionText !== "string" || !/^[1-9][0-9]*$/.test(versionText)) fail();
    const serverVersion = Number(versionText);
    const sessionRole = role(meta.sessionRole);
    if (!Number.isSafeInteger(serverVersion) || serverVersion < 160000 || serverVersion >= 200000
      || meta.databaseName !== "setfarm" || sessionRole !== role(meta.effectiveRole)
      || (expectedSessionRole !== undefined && sessionRole !== role(expectedSessionRole))) fail();
    const objects = ordered(rowList(await query(OBJECT_SQL)), objectRow,
      row => `${row.kind}\0${row.oidText}`);
    const defaults = ordered(rowList(await query(DEFAULT_SQL)), defaultRow, row => row.oidText);
    const memberships = ordered(rowList(await query(MEMBERSHIP_SQL)), membershipRow,
      row => `${row.roleText}\0${row.memberText}\0${row.grantorText}`);
    if (objects.length + defaults.length + memberships.length > MAX_ROWS
      || objects.filter(row => row.kind === "database").length !== 1) fail();
    const privateDetail = { domain: `${SCHEMA}:selected-private-rows`,
      databaseName: "setfarm" as const, sessionRole,
      serverVersion, objects, defaults, memberships };
    if (Buffer.byteLength(JSON.stringify(privateDetail), "utf8") > MAX_BYTES) fail();
    const counts = Object.freeze({ object: objects.length,
      explicitAclObject: objects.filter(row => row.aclText !== null).length,
      defaultAcl: defaults.length, directMembership: memberships.length,
      publicAclObject: objects.filter(row => row.publicAcl).length,
      publicDefaultAcl: defaults.filter(row => row.publicAcl).length });
    const body = Object.freeze({ schema: SCHEMA, authority: "diagnostic-only" as const,
      cutoverAdmission: "not-granted" as const, physicalIdentityProvenance: "unverified" as const,
      catalogScope: "selected-explicit-acl-and-direct-membership-rows-not-permission-proof" as const,
      databaseName: "setfarm" as const, serverVersion, counts,
      detailHash: hashCanonicalJson(privateDetail) });
    return Object.freeze({ ...body, diagnosticHash: hashCanonicalJson(body) });
  } catch { fail(); }
}

/** Import-inert. A later reviewed held-host method must provide the private URL. */
export async function observeTask6aPrivateCatalogInventoryV3(databaseUrl: string | undefined) {
  let sql: import("postgres").Sql | undefined;
  try {
    if (typeof databaseUrl !== "string" || Object.keys(process.env).some(key => key.startsWith("PG"))
      || !/^postgres(?:ql)?:\/\/[^/?#@\s]+@(?:localhost|127\.0\.0\.1)(?::5432)?\/setfarm$/.test(databaseUrl)) fail();
    const target = new URL(databaseUrl), username = decodeURIComponent(target.username);
    if (!["postgres:", "postgresql:"].includes(target.protocol) || !/^[a-z][a-z0-9_]{0,62}$/.test(username)
      || !["localhost", "127.0.0.1"].includes(target.hostname)
      || (target.port !== "" && target.port !== "5432") || target.pathname !== "/setfarm"
      || target.search !== "" || target.hash !== "") fail();
    const postgresModule = await import("postgres");
    sql = postgresModule.default(databaseUrl, { max: 1, idle_timeout: 1, connect_timeout: 5,
      debug: false, onnotice: () => {}, connection: { statement_timeout: 5000,
        lock_timeout: 1000, idle_in_transaction_session_timeout: 5000 } });
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
        return await projectTask6aPrivateCatalogInventoryInTransactionV3(async statement =>
          Array.from(await connection.unsafe(statement)), username);
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
