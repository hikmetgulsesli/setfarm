import type postgres from "postgres";
import { canonicalJsonStringify } from "../product-compiler/canonical-json.js";
import {
  parseFreshInstallationApplicationV1,
  verifyFreshInstallationDatabaseIdentityV1,
  type FreshInstallationOriginV1,
} from "./fresh-installation-origin-v1.js";

export type FreshInstallationProvenanceSqlV1 = Pick<postgres.TransactionSql, "unsafe">;

const HEAD = "internal_production_owner_admission_head_v1";
const AUTHORITIES = "internal_production_owner_admission_authorities_v1";
const RESERVATIONS = "internal_production_owner_reservations_v1";
const TABLES = Object.freeze([HEAD, AUTHORITIES, RESERVATIONS]);
const FUNCTION = "setfarm_fresh_owner_head_provenance_guard_v1";
const ROW_TRIGGER = "trg_setfarm_fresh_owner_head_provenance_v1";
const TRUNCATE_TRIGGER = "trg_setfarm_fresh_owner_head_truncate_v1";

// These are the actual SET/INSERT columns in db-pg owner reservation, binding,
// ordinary/fence-target close, fence and release paths. Immutable identity and
// created_at fields receive no UPDATE permission; the head receives no INSERT.
const COLUMN_GRANTS = Object.freeze([
  { table: HEAD, privilege: "UPDATE", columns: Object.freeze([
    "head_version", "head_hash", "head_payload", "active_fence_ref",
    "active_fence_hash", "active_target_family_hash", "updated_at",
  ]) },
  { table: AUTHORITIES, privilege: "INSERT", columns: Object.freeze([
    "authority_ref", "authority_hash", "authority_kind", "phase_key",
    "predecessor_head_hash", "successor_head_hash", "authority_body",
  ]) },
  { table: RESERVATIONS, privilege: "INSERT", columns: Object.freeze([
    "reservation_ref", "reservation_hash", "category", "owner_key", "owner_key_hash",
    "producer_purpose_hash", "producer_implementation_id", "producer_implementation_hash",
    "reservation_payload", "reservation_head_predecessor_hash", "state", "head_version",
  ]) },
  { table: RESERVATIONS, privilege: "UPDATE", columns: Object.freeze([
    "state", "canonical_owner_identity", "binding_hash", "binding_payload", "close_kind",
    "terminal_owner_ref", "terminal_owner_hash", "close_head_predecessor_hash",
    "close_head_successor_hash", "preserved_fence_ref", "preserved_fence_hash",
    "close_ref", "close_hash", "close_payload", "head_version", "updated_at",
  ]) },
] as const);

const GUARD_BODY = `BEGIN
  IF TG_TABLE_SCHEMA <> 'public'
     OR TG_TABLE_NAME <> 'internal_production_owner_admission_head_v1'
     OR TG_NARGS <> 0 OR TG_OP <> 'UPDATE' THEN
    RAISE EXCEPTION 'FRESH_INSTALLATION_HEAD_PROVENANCE_IMMUTABLE' USING ERRCODE = '55000';
  END IF;
  IF NEW.migration_application_evidence_hash IS DISTINCT FROM OLD.migration_application_evidence_hash
     OR (NEW.head_payload -> 'migrationApplication') IS DISTINCT FROM (OLD.head_payload -> 'migrationApplication') THEN
    RAISE EXCEPTION 'FRESH_INSTALLATION_HEAD_PROVENANCE_IMMUTABLE' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END`;

type Target = Readonly<{
  origin: FreshInstallationOriginV1;
  ownerRole: string;
  runtimeRole: string;
  ownerOid: string;
  runtimeOid: string;
  headOid: string;
}>;
type AclRow = {
  table_name: string;
  column_name: string;
  grantor: string;
  grantee: string;
  privilege: string;
  grantable: boolean;
};

function refuse(): never { throw new Error("FRESH_INSTALLATION_PROVENANCE_PROTECTION_REFUSED"); }
function quoteIdentifier(value: string): string { return `"${value.replaceAll('"', '""')}"`; }
function requireRuntimeRole(value: string): string {
  if (typeof value !== "string" || !/^sf_runtime_[0-9a-f]{32}$/.test(value)) refuse();
  return value;
}
function validOid(value: string): boolean {
  return typeof value === "string" && /^[1-9][0-9]{0,9}$/.test(value) && BigInt(value) <= 4294967295n;
}

async function readTarget(
  sql: FreshInstallationProvenanceSqlV1, runtimeRole: string, requireGenesisOwner: boolean,
): Promise<Target> {
  const suffix = runtimeRole.slice("sf_runtime_".length);
  const ownerRole = `sf_owner_${suffix}`, databaseName = `setfarm_install_${suffix}`;
  const rows = await sql.unsafe<Array<{
    database_name: string; owner_name: string; owner_oid: string; runtime_oid: string;
    current_role: string; session_role: string; valid_roles: boolean; isolated_runtime: boolean;
  }>>(`SELECT d.datname AS database_name,o.rolname AS owner_name,o.oid::text AS owner_oid,
      r.oid::text AS runtime_oid,current_user AS current_role,session_user AS session_role,
      (NOT o.rolcanlogin AND r.rolcanlogin AND NOT o.rolsuper AND NOT r.rolsuper
       AND NOT o.rolcreatedb AND NOT r.rolcreatedb AND NOT o.rolcreaterole AND NOT r.rolcreaterole
       AND NOT o.rolreplication AND NOT r.rolreplication AND NOT o.rolbypassrls AND NOT r.rolbypassrls
       AND NOT o.rolinherit AND NOT r.rolinherit
       AND NOT EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members m
         WHERE m.member IN (o.oid,r.oid) OR m.roleid IN (o.oid,r.oid))) AS valid_roles,
      (pg_catalog.has_database_privilege(r.oid,d.oid,'CONNECT')
       AND NOT pg_catalog.has_database_privilege(r.oid,d.oid,'CREATE')
       AND NOT pg_catalog.has_database_privilege(r.oid,d.oid,'TEMPORARY')
       AND NOT pg_catalog.has_schema_privilege(r.oid,'public','CREATE')) AS isolated_runtime
    FROM pg_catalog.pg_database d JOIN pg_catalog.pg_roles o ON o.oid=d.datdba
      JOIN pg_catalog.pg_roles r ON r.rolname='${runtimeRole}'
    WHERE d.datname=current_database() LIMIT 2`);
  const row = rows[0];
  if (rows.length !== 1 || !row || row.database_name !== databaseName || row.owner_name !== ownerRole
    || !validOid(row.owner_oid) || !validOid(row.runtime_oid) || row.owner_oid === row.runtime_oid
    || row.valid_roles !== true || row.isolated_runtime !== true
    || (requireGenesisOwner ? row.current_role !== ownerRole
      : ![ownerRole, runtimeRole].includes(row.current_role))
    || (row.current_role === runtimeRole && row.session_role !== runtimeRole)) refuse();

  const tables = await sql.unsafe<Array<{ name: string; oid: string; owner_oid: string; valid: boolean }>>(
    `SELECT c.relname AS name,c.oid::text AS oid,c.relowner::text AS owner_oid,
       (c.relkind='r' AND c.relpersistence='p' AND NOT c.relispartition AND c.reloftype=0
        AND NOT c.relrowsecurity AND NOT c.relforcerowsecurity) AS valid
     FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public' AND c.relname IN ('${HEAD}','${AUTHORITIES}','${RESERVATIONS}')
     ORDER BY c.relname LIMIT 4`,
  );
  if (tables.length !== 3 || tables.some(table => !TABLES.includes(table.name)
    || table.owner_oid !== row.owner_oid || !validOid(table.oid) || table.valid !== true)
    || new Set(tables.map(table => table.name)).size !== 3) refuse();
  const head = tables.find(table => table.name === HEAD)!;
  const heads = await sql.unsafe<Array<{
    version: string; payload: unknown; evidence_hash: string; release_sha: string | null;
    no_fence: boolean;
  }>>(`SELECT h.head_version::text AS version,h.head_payload AS payload,
      h.migration_application_evidence_hash AS evidence_hash,m.release_sha,
      (h.active_fence_ref IS NULL AND h.active_fence_hash IS NULL AND h.active_target_family_hash IS NULL) AS no_fence
    FROM public.${HEAD} h JOIN public.setfarm_schema_migrations m ON m.version=32
    WHERE h.singleton=TRUE LIMIT 2`);
  const h = heads[0];
  if (heads.length !== 1 || !h || !h.payload || typeof h.payload !== "object" || Array.isArray(h.payload)) refuse();
  const payload = h.payload as Record<string, unknown>;
  if (payload.schema !== "setfarm.internal-production-owner-admission-head.v1"
    || !Number.isSafeInteger(payload.version) || String(payload.version) !== h.version) refuse();
  if (requireGenesisOwner && (h.version !== "0" || h.no_fence !== true
    || canonicalJsonStringify(Object.keys(payload).sort())
      !== canonicalJsonStringify(["migrationApplication", "schema", "version"]))) refuse();
  const application = parseFreshInstallationApplicationV1(payload.migrationApplication, h.evidence_hash);
  if (application.origin.runtimeRole !== runtimeRole || application.origin.ownerRole !== ownerRole
    || application.origin.databaseName !== databaseName || h.release_sha !== application.origin.sourceSha) refuse();
  await verifyFreshInstallationDatabaseIdentityV1(sql, application.origin);
  return Object.freeze({ origin: application.origin, ownerRole, runtimeRole,
    ownerOid: row.owner_oid, runtimeOid: row.runtime_oid, headOid: head.oid });
}

async function readRuntimeAcl(sql: FreshInstallationProvenanceSqlV1, target: Target): Promise<AclRow[]> {
  // Direct PUBLIC and runtime grants are exact; role membership was separately
  // refused. Table-level rights and column-level rights are not conflated.
  return sql.unsafe<AclRow[]>(`WITH relations AS (
      SELECT c.oid,c.relname,c.relowner,c.relacl FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname IN ('${HEAD}','${AUTHORITIES}','${RESERVATIONS}')
    ), entries AS (
      SELECT c.relname AS table_name,''::text AS column_name,a.* FROM relations c
        CROSS JOIN LATERAL pg_catalog.aclexplode(coalesce(c.relacl,pg_catalog.acldefault('r',c.relowner))) a
      UNION ALL SELECT c.relname,att.attname,a.* FROM relations c
        JOIN pg_catalog.pg_attribute att ON att.attrelid=c.oid AND att.attnum>0 AND NOT att.attisdropped
        CROSS JOIN LATERAL pg_catalog.aclexplode(att.attacl) a
    ) SELECT table_name,column_name,grantor::text AS grantor,grantee::text AS grantee,
        privilege_type AS privilege,is_grantable AS grantable FROM entries
      WHERE grantee IN (0::oid,'${target.runtimeOid}'::oid)
      ORDER BY table_name,column_name,privilege_type,grantor,grantee,is_grantable LIMIT 128`);
}

function assertRuntimeAcl(rows: readonly AclRow[], target: Target, extended: boolean): void {
  const wanted: AclRow[] = TABLES.map(table_name => ({ table_name, column_name: "",
    grantor: target.ownerOid, grantee: target.runtimeOid, privilege: "SELECT", grantable: false }));
  if (extended) for (const grant of COLUMN_GRANTS) for (const column_name of grant.columns) wanted.push({
    table_name: grant.table, column_name, grantor: target.ownerOid, grantee: target.runtimeOid,
    privilege: grant.privilege, grantable: false,
  });
  const projection = (members: readonly AclRow[]) => members.map(row => canonicalJsonStringify({
    table_name: row.table_name, column_name: row.column_name, grantor: row.grantor,
    grantee: row.grantee, privilege: row.privilege, grantable: row.grantable,
  })).sort();
  if (canonicalJsonStringify(projection(rows)) !== canonicalJsonStringify(projection(wanted))) refuse();
}

async function assertUninstalled(sql: FreshInstallationProvenanceSqlV1): Promise<void> {
  const rows = await sql.unsafe<Array<{ absent: boolean }>>(`SELECT
    NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname='${FUNCTION}')
    AND NOT EXISTS(SELECT 1 FROM pg_catalog.pg_trigger t
      WHERE t.tgrelid='public.${HEAD}'::regclass AND NOT t.tgisinternal)
    AND NOT EXISTS(SELECT 1 FROM public.${RESERVATIONS})
    AND NOT EXISTS(SELECT 1 FROM public.${AUTHORITIES}) AS absent`);
  if (rows.length !== 1 || rows[0]?.absent !== true) refuse();
}

async function inspectExtension(sql: FreshInstallationProvenanceSqlV1, runtimeRole: string): Promise<Target> {
  const target = await readTarget(sql, runtimeRole, false);
  const functions = await sql.unsafe<Array<{
    oid: string; owner_oid: string; body: string; config: string[] | null; valid: boolean;
  }>>(`SELECT p.oid::text AS oid,p.proowner::text AS owner_oid,p.prosrc AS body,p.proconfig AS config,
      (p.pronargs=0 AND p.pronargdefaults=0 AND p.prokind='f' AND p.prorettype='pg_catalog.trigger'::regtype
       AND l.lanname='plpgsql' AND NOT p.prosecdef AND NOT p.proleakproof AND p.provolatile='v'
       AND p.proparallel='u' AND pg_catalog.pg_get_function_identity_arguments(p.oid)='') AS valid
    FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
      JOIN pg_catalog.pg_language l ON l.oid=p.prolang
    WHERE n.nspname='public' AND p.proname='${FUNCTION}' LIMIT 2`);
  const fn = functions[0];
  if (functions.length !== 1 || !fn || !validOid(fn.oid) || fn.owner_oid !== target.ownerOid
    || fn.body !== GUARD_BODY || fn.valid !== true
    || canonicalJsonStringify(fn.config) !== canonicalJsonStringify(["search_path=pg_catalog"])) refuse();
  const triggers = await sql.unsafe<Array<{
    name: string; function_oid: string; type: number; enabled: string; valid: boolean;
  }>>(`SELECT t.tgname AS name,t.tgfoid::text AS function_oid,t.tgtype::integer AS type,t.tgenabled AS enabled,
      (t.tgnargs=0 AND octet_length(t.tgargs)=0 AND t.tgattr=''::int2vector AND t.tgqual IS NULL
       AND t.tgconstraint=0 AND t.tgconstrrelid=0 AND t.tgconstrindid=0
       AND NOT t.tgdeferrable AND NOT t.tginitdeferred) AS valid
    FROM pg_catalog.pg_trigger t WHERE t.tgrelid='public.${HEAD}'::regclass AND NOT t.tgisinternal
    ORDER BY t.tgname LIMIT 3`);
  if (triggers.length !== 2 || triggers.some(trigger => trigger.function_oid !== fn.oid
    || trigger.enabled !== "A" || trigger.valid !== true
    || trigger.type !== (trigger.name === ROW_TRIGGER ? 27 : trigger.name === TRUNCATE_TRIGGER ? 34 : -1))) refuse();
  const acl = await sql.unsafe<Array<{ grantor: string; grantee: string; privilege: string; grantable: boolean }>>(
    `SELECT a.grantor::text AS grantor,a.grantee::text AS grantee,a.privilege_type AS privilege,a.is_grantable AS grantable
     FROM pg_catalog.pg_proc p CROSS JOIN LATERAL pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) a
     WHERE p.oid='${fn.oid}'::oid ORDER BY a.grantor,a.grantee,a.privilege_type,a.is_grantable LIMIT 3`,
  );
  if (acl.length !== 1 || acl[0]?.grantor !== target.ownerOid || acl[0]?.grantee !== target.ownerOid
    || acl[0]?.privilege !== "EXECUTE" || acl[0]?.grantable !== false) refuse();
  assertRuntimeAcl(await readRuntimeAcl(sql, target), target, true);
  return target;
}

/**
 * Owner-transaction component only. Existing extensions or broader runtime
 * privileges refuse; this operation never repairs/adopts them. All statements
 * must commit/roll back with the controller's already-authenticated transaction.
 */
export async function installFreshInstallationProvenanceProtectionV1(
  sql: FreshInstallationProvenanceSqlV1, runtimeRoleInput: string,
): Promise<void> {
  try {
    const runtimeRole = requireRuntimeRole(runtimeRoleInput);
    const before = await readTarget(sql, runtimeRole, true);
    assertRuntimeAcl(await readRuntimeAcl(sql, before), before, false);
    await assertUninstalled(sql);
    await sql.unsafe(`LOCK TABLE public.${HEAD},public.${AUTHORITIES},public.${RESERVATIONS} IN SHARE ROW EXCLUSIVE MODE`);
    // Recheck inside the held table boundary before the first extension write.
    const locked = await readTarget(sql, runtimeRole, true);
    if (canonicalJsonStringify(before) !== canonicalJsonStringify(locked)) refuse();
    assertRuntimeAcl(await readRuntimeAcl(sql, locked), locked, false);
    await assertUninstalled(sql);
    await sql.unsafe(`CREATE FUNCTION public.${FUNCTION}() RETURNS trigger LANGUAGE plpgsql
      VOLATILE SECURITY INVOKER SET search_path=pg_catalog AS $fresh$${GUARD_BODY}$fresh$`);
    await sql.unsafe(`REVOKE ALL ON FUNCTION public.${FUNCTION}() FROM PUBLIC,${quoteIdentifier(runtimeRole)}`);
    await sql.unsafe(`CREATE TRIGGER ${ROW_TRIGGER} BEFORE UPDATE OR DELETE ON public.${HEAD}
      FOR EACH ROW EXECUTE FUNCTION public.${FUNCTION}()`);
    await sql.unsafe(`CREATE TRIGGER ${TRUNCATE_TRIGGER} BEFORE TRUNCATE ON public.${HEAD}
      FOR EACH STATEMENT EXECUTE FUNCTION public.${FUNCTION}()`);
    await sql.unsafe(`ALTER TABLE public.${HEAD} ENABLE ALWAYS TRIGGER ${ROW_TRIGGER}`);
    await sql.unsafe(`ALTER TABLE public.${HEAD} ENABLE ALWAYS TRIGGER ${TRUNCATE_TRIGGER}`);
    for (const grant of COLUMN_GRANTS) await sql.unsafe(
      `GRANT ${grant.privilege} (${grant.columns.map(quoteIdentifier).join(",")}) ON TABLE public.${grant.table} TO ${quoteIdentifier(runtimeRole)}`,
    );
    const after = await inspectExtension(sql, runtimeRole);
    if (canonicalJsonStringify(before) !== canonicalJsonStringify(after)) refuse();
  } catch { return refuse(); }
}

/** Exact read-only component verification, usable by the selected runtime. */
export async function verifyFreshInstallationProvenanceProtectionV1(
  sql: FreshInstallationProvenanceSqlV1, runtimeRoleInput: string,
): Promise<void> {
  try { await inspectExtension(sql, requireRuntimeRole(runtimeRoleInput)); }
  catch { return refuse(); }
}
