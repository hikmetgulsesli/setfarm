import { createHash } from "node:crypto";
import { types } from "node:util";
import type postgres from "postgres";

// Closed metadata profile only. The caller owns its original transaction,
// locks, journal/cold census and settlement. This is not reader/start authority.
export type DashboardCoreReadonlyProfileV2 = Readonly<{
  schema: "setfarm.dashboard-core-readonly-profile.v2";
  relationOids: Readonly<Record<string, string>>;
  catalogHash: string;
}>;
const issued = new WeakSet<object>();
const names = ["runs", "steps", "stories", "rules", "run_observations"] as const;
const fieldLists = [
  "id run_number workflow_id task status context meta notify_url assigned_developer protocol protocol_version compiler_release_sha packet_hash activation_preflight_hash accepted_candidate_hash deploy_receipt_hash release_admission_hash project_transfer_ack_hash created_at updated_at",
  "id run_id step_id agent_id step_index input_template expects status output retry_count max_retries abandoned_count started_at type loop_config current_story_id created_at updated_at",
  "id run_id story_index story_id title description acceptance_criteria status output retry_count max_retries abandoned_count claimed_by claimed_at claim_generation started_at depends_on scope_files shared_files scope_targets requested_dependencies shared_edit_requests resolved_scope_files scope_description file_skeletons implementation_contract story_screens story_branch pr_url merge_status created_at updated_at quality_failure_fingerprint",
  "id title content category project_type source severity applies_to enabled readonly sort_order created_at updated_at",
  "id run_id step_id story_id agent_id phase check_id label status summary detail evidence file_paths github metadata event_type started_at completed_at created_at updated_at",
].map(value => value.split(" "));
const notNull = [
  "id run_number workflow_id task status context protocol protocol_version created_at updated_at",
  "id run_id step_id agent_id step_index input_template expects status retry_count max_retries abandoned_count type created_at updated_at",
  "id run_id story_index story_id title description acceptance_criteria status retry_count max_retries abandoned_count claim_generation created_at updated_at",
  fieldLists[3]!.filter(name => name !== "source").join(" "),
  "id run_id step_id story_id check_id label status evidence file_paths github metadata created_at updated_at",
].map(value => new Set(value.split(" ")));
const integers = new Set("run_number protocol_version step_index story_index retry_count max_retries abandoned_count claim_generation sort_order".split(" "));
const builtinTypes = {
  text: { oid: "25", opclass: "text_ops", family: "text_ops" },
  int4: { oid: "23", opclass: "int4_ops", family: "integer_ops" },
  bool: { oid: "16", opclass: "bool_ops", family: "bool_ops" },
  timestamptz: { oid: "1184", opclass: "timestamptz_ops", family: "datetime_ops" },
} as const;
type ColumnType = keyof typeof builtinTypes;
export const DASHBOARD_CORE_COLUMN_MANIFEST_V2 = Object.freeze(Object.fromEntries(
  names.map((table, index) => [table, Object.freeze(fieldLists[index]!.map(name => Object.freeze({
    name, type: (name.endsWith("_at") ? "timestamptz" : integers.has(name) ? "int4"
      : ["enabled", "readonly"].includes(name) ? "bool" : "text") as ColumnType,
    notNull: notNull[index]!.has(name),
  })))]),
)) as Readonly<Record<typeof names[number], readonly Readonly<{ name: string; type: ColumnType; notNull: boolean }>[]>>;

type Row = Record<string, unknown>;
const relationKeys = "relation_oid relation_name relation_kind persistence access_method handler_namespace handler_name handler_language handler_source handler_binary handler_security_definer handler_config row_security force_row_security has_inheritance has_rewrite can_select".split(" ");
const columnKeys = "relation_oid attribute_number column_name type_oid type_namespace type_name type_kind type_modifier dimensions not_null identity_kind generated_kind collation_oid collation_namespace collation_name".split(" ");
const indexKeys = "relation_oid index_oid index_name index_kind access_method handler_namespace handler_name handler_language handler_source handler_binary handler_security_definer handler_config total_attributes key_attributes primary_key unique_index immediate valid ready live exclusion attribute_numbers operator_class_oids collation_oids key_options expressions predicate definition primary_constraints keys".split(" ");
const keyKeys = "ordinal attribute_number operator_class_oid operator_class_namespace operator_class_name operator_class_default operator_input_type_oid operator_key_type_oid family_oid family_namespace family_name class_method_matches family_method_matches support_count operator_count support_builtin operators_builtin".split(" ");
const constraintKeys = "constraint_oid kind validated deferrable deferred attributes".split(" ");

function refuse(): never { throw new Error("DASHBOARD_CORE_READONLY_PROFILE_REFUSED"); }
function requireTrue(value: unknown): void { if (value !== true) refuse(); }
function integer(value: unknown, minimum: number, maximum: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < minimum || value > maximum) refuse();
  return value;
}
function oid(value: unknown, zero = false): string {
  if (typeof value !== "string" || !/^(?:0|[1-9][0-9]*)$/.test(value)
    || Number(value) > 4294967295 || (!zero && value === "0")) refuse();
  return value;
}
function text(value: unknown, maximum = 65536): string {
  if (typeof value !== "string" || !value || value.includes("\0")
    || Buffer.byteLength(value, "utf8") > maximum || Buffer.from(value, "utf8").toString("utf8") !== value) refuse();
  return value;
}
function record(value: unknown, keys: readonly string[]): Row {
  if (value === null || typeof value !== "object" || types.isProxy(value)) refuse();
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) refuse();
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(descriptors).length !== keys.length) refuse();
  const copy: Row = Object.create(null);
  for (const key of keys) {
    const descriptor = descriptors[key];
    if (!descriptor || !Object.hasOwn(descriptor, "value") || !descriptor.enumerable) refuse();
    copy[key] = descriptor.value;
  }
  return copy;
}
function array(value: unknown, maximum: number, driverResult = false): unknown[] {
  if (typeof value !== "object" || value === null || types.isProxy(value) || !Array.isArray(value)) refuse();
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const count = integer(Object.getOwnPropertyDescriptor(value, "length")?.value, 0, maximum);
  for (const key of Reflect.ownKeys(descriptors)) {
    if (typeof key !== "string") refuse();
    if (key !== "length" && (!/^(?:0|[1-9][0-9]*)$/.test(key) || Number(key) >= count)
      && (!driverResult || descriptors[key]!.enumerable)) refuse();
  }
  const copied: unknown[] = [];
  for (let index = 0; index < count; index++) {
    const descriptor = descriptors[String(index)];
    if (!descriptor || !Object.hasOwn(descriptor, "value") || !descriptor.enumerable) refuse();
    copied.push(descriptor.value);
  }
  return copied;
}
function vector(value: unknown, length: number, allowZero = false): string[] {
  if (typeof value !== "string") refuse();
  const values = value.split(" ");
  if (values.length !== length) refuse();
  return values.map(item => oid(item, allowZero));
}
function handler(row: Row, name: string, method: string): void {
  if (row.access_method !== method || row.handler_namespace !== "pg_catalog"
    || row.handler_name !== name || row.handler_language !== "internal" || row.handler_source !== name
    || row.handler_binary !== null || row.handler_config !== null || row.handler_security_definer !== false) refuse();
}
type Binding = { name: string; table: typeof names[number]; type: ColumnType; collation: string };
function partial(row: Row, table: string, fields: string[]): void {
  if (row.predicate === null) return;
  const fieldKey = fields.join(" ");
  const active = "(status = ANY (ARRAY['pending'::text, 'running'::text]))";
  const known = (table === "runs" && fieldKey === "status assigned_developer"
      && row.predicate === "(status = 'running'::text)")
    || (table === "steps" && fieldKey === "agent_id status" && row.predicate === active)
    || (table === "stories" && fieldKey === "run_id story_id" && row.predicate === active)
    || (table === "stories" && fieldKey === "run_id quality_failure_fingerprint"
      && row.predicate === "(quality_failure_fingerprint IS NOT NULL)");
  if (!known) refuse();
}

export async function observeDashboardCoreReadonlyProfileV2(
  originalTransaction: Pick<postgres.TransactionSql, "unsafe">,
  previousProfile?: DashboardCoreReadonlyProfileV2,
): Promise<DashboardCoreReadonlyProfileV2> {
  try {
    if (arguments.length > 2 || (previousProfile !== undefined
      && (previousProfile === null || typeof previousProfile !== "object"
        || types.isProxy(previousProfile) || !issued.has(previousProfile)))) refuse();
    const relations = array(await originalTransaction.unsafe(RELATIONS_SQL), 5, true).map(row => record(row, relationKeys));
    if (relations.length !== 5) refuse();
    const relationOids: Record<string, string> = Object.create(null);
    const tableByOid = new Map<string, typeof names[number]>();
    for (const row of relations) {
      const table = row.relation_name;
      if (typeof table !== "string" || !names.includes(table as typeof names[number])
        || Object.hasOwn(relationOids, table) || row.relation_kind !== "r" || row.persistence !== "p") refuse();
      const tableOid = oid(row.relation_oid);
      if (tableByOid.has(tableOid)) refuse();
      handler(row, "heap_tableam_handler", "heap");
      for (const field of ["row_security", "force_row_security", "has_inheritance", "has_rewrite"])
        if (row[field] !== false) refuse();
      requireTrue(row.can_select);
      if (previousProfile && previousProfile.relationOids[table] !== tableOid) refuse();
      relationOids[table] = tableOid;
      tableByOid.set(tableOid, table as typeof names[number]);
    }
    const capturedOids = Object.freeze(names.map(table => relationOids[table]!));
    const columns = array(await originalTransaction.unsafe(COLUMNS_SQL, [[...capturedOids]]), 104, true)
      .map(row => record(row, columnKeys));
    if (columns.length !== 104) refuse();
    const bindings = new Map<string, Binding>(), members = new Set<string>();
    for (const row of columns) {
      const tableOid = oid(row.relation_oid), table = tableByOid.get(tableOid);
      if (!table) refuse();
      const expected = DASHBOARD_CORE_COLUMN_MANIFEST_V2[table].find(item => item.name === row.column_name);
      if (!expected || row.type_namespace !== "pg_catalog" || row.type_kind !== "b"
        || row.type_name !== expected.type || row.type_oid !== builtinTypes[expected.type].oid
        || row.type_modifier !== -1 || row.dimensions !== 0 || row.not_null !== expected.notNull
        || row.identity_kind !== "" || row.generated_kind !== "") refuse();
      const attnum = integer(row.attribute_number, 1, 32767);
      const key = tableOid + ":" + attnum, member = table + ":" + expected.name;
      if (bindings.has(key) || members.has(member)) refuse();
      const collation = expected.type === "text" ? "100" : "0";
      if (row.collation_oid !== collation || row.collation_namespace !== (collation === "100" ? "pg_catalog" : null)
        || row.collation_name !== (collation === "100" ? "default" : null)) refuse();
      bindings.set(key, { name: expected.name, table, type: expected.type, collation });
      members.add(member);
    }
    const indexes = array(await originalTransaction.unsafe(INDEXES_SQL, [[...capturedOids]]), 128, true)
      .map(row => record(row, indexKeys));
    const indexOids = new Set<string>(), primaryTables = new Set<string>(), constraints = new Set<string>();
    for (const row of indexes) {
      const tableOid = oid(row.relation_oid), table = tableByOid.get(tableOid), indexOid = oid(row.index_oid);
      if (!table || indexOids.has(indexOid) || row.index_kind !== "i" || row.exclusion !== false
        || row.expressions !== null || typeof row.primary_key !== "boolean" || typeof row.unique_index !== "boolean") refuse();
      indexOids.add(indexOid); text(row.index_name, 1024); text(row.definition);
      handler(row, "bthandler", "btree");
      for (const field of ["immediate", "valid", "ready", "live"]) requireTrue(row[field]);
      const count = integer(row.key_attributes, 1, 32);
      if (row.total_attributes !== count) refuse();
      const attributes = vector(row.attribute_numbers, count), classes = vector(row.operator_class_oids, count);
      const collations = vector(row.collation_oids, count, true), options = vector(row.key_options, count, true);
      const keys = array(row.keys, 32).map(item => record(item, keyKeys));
      if (keys.length !== count) refuse();
      const fieldNames: string[] = [];
      for (let pos = 0; pos < count; pos++) {
        const key = keys[pos]!, attnum = integer(key.attribute_number, 1, 32767);
        const binding = bindings.get(tableOid + ":" + attnum);
        if (!binding || String(attnum) !== attributes[pos] || key.ordinal !== pos
          || key.operator_class_oid !== classes[pos] || collations[pos] !== binding.collation
          || Number(options[pos]) > 3 || key.operator_class_namespace !== "pg_catalog"
          || key.operator_class_name !== builtinTypes[binding.type].opclass
          || key.operator_input_type_oid !== builtinTypes[binding.type].oid || key.operator_key_type_oid !== "0"
          || key.family_namespace !== "pg_catalog" || key.family_name !== builtinTypes[binding.type].family) refuse();
        oid(key.family_oid);
        for (const field of ["operator_class_default", "class_method_matches", "family_method_matches",
          "support_builtin", "operators_builtin"]) requireTrue(key[field]);
        integer(key.support_count, 1, 64); integer(key.operator_count, 1, 64);
        fieldNames.push(binding.name);
      }
      row.keys = keys;
      partial(row, table, fieldNames);
      if (row.primary_key) {
        if (primaryTables.has(table) || !row.unique_index || count !== 1 || fieldNames[0] !== "id"
          || row.predicate !== null) refuse();
        primaryTables.add(table);
        const primary = array(row.primary_constraints, 1).map(item => record(item, constraintKeys));
        if (primary.length !== 1) refuse();
        const constraint = primary[0]!, constraintOid = oid(constraint.constraint_oid);
        if (constraints.has(constraintOid) || constraint.kind !== "p" || constraint.validated !== true
          || constraint.deferrable !== false || constraint.deferred !== false) refuse();
        constraints.add(constraintOid);
        const constrainedAttributes = array(constraint.attributes, 1);
        if (constrainedAttributes.length !== 1 || constrainedAttributes[0] !== Number(attributes[0])) refuse();
        constraint.attributes = constrainedAttributes; row.primary_constraints = primary;
      } else if (row.primary_constraints !== null) refuse();
    }
    if (primaryTables.size !== 5) refuse();
    const metadata = JSON.stringify([relations, columns, indexes]);
    if (Buffer.byteLength(metadata, "utf8") > 4 * 1024 * 1024) refuse();
    const catalogHash = createHash("sha256").update(metadata).digest("hex");
    if (previousProfile) {
      if (previousProfile.catalogHash !== catalogHash) refuse();
      return previousProfile;
    }
    const profile: DashboardCoreReadonlyProfileV2 = Object.freeze({
      schema: "setfarm.dashboard-core-readonly-profile.v2",
      relationOids: Object.freeze(relationOids), catalogHash,
    });
    issued.add(profile);
    return profile;
  } catch { return refuse(); }
}

const RELATIONS_SQL = `SELECT c.oid::text AS relation_oid,
       c.relname::text AS relation_name,
       c.relkind::text AS relation_kind,
       c.relpersistence::text AS persistence,
       am.amname::text AS access_method,
       pn.nspname::text AS handler_namespace,
       hp.proname::text AS handler_name,
       hl.lanname::text AS handler_language,
       hp.prosrc AS handler_source,
       hp.probin AS handler_binary,
       hp.prosecdef AS handler_security_definer,
       hp.proconfig AS handler_config,
       c.relrowsecurity AS row_security,
       c.relforcerowsecurity AS force_row_security,
       EXISTS (SELECT 1 FROM pg_catalog.pg_inherits h
               WHERE h.inhrelid=c.oid OR h.inhparent=c.oid) AS has_inheritance,
       EXISTS (SELECT 1 FROM pg_catalog.pg_rewrite r
               WHERE r.ev_class=c.oid) AS has_rewrite,
       pg_catalog.has_table_privilege(c.oid,'SELECT') AS can_select
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
LEFT JOIN pg_catalog.pg_am am ON am.oid=c.relam
LEFT JOIN pg_catalog.pg_proc hp ON hp.oid=am.amhandler
LEFT JOIN pg_catalog.pg_namespace pn ON pn.oid=hp.pronamespace
LEFT JOIN pg_catalog.pg_language hl ON hl.oid=hp.prolang
WHERE n.nspname='public'
  AND c.relname IN ('runs','steps','stories','rules','run_observations')
ORDER BY c.relname
LIMIT 6`;

const COLUMNS_SQL = `SELECT a.attrelid::text AS relation_oid,
       a.attnum::integer AS attribute_number,
       a.attname::text AS column_name,
       t.oid::text AS type_oid,
       tn.nspname::text AS type_namespace,
       t.typname::text AS type_name,
       t.typtype::text AS type_kind,
       a.atttypmod::integer AS type_modifier,
       a.attndims::integer AS dimensions,
       a.attnotnull AS not_null,
       a.attidentity::text AS identity_kind,
       a.attgenerated::text AS generated_kind,
       a.attcollation::text AS collation_oid,
       cn.nspname::text AS collation_namespace,
       co.collname::text AS collation_name
FROM pg_catalog.pg_attribute a
JOIN pg_catalog.pg_type t ON t.oid=a.atttypid
JOIN pg_catalog.pg_namespace tn ON tn.oid=t.typnamespace
LEFT JOIN pg_catalog.pg_collation co ON co.oid=a.attcollation
LEFT JOIN pg_catalog.pg_namespace cn ON cn.oid=co.collnamespace
WHERE a.attrelid=ANY($1::oid[]) AND a.attnum>0 AND NOT a.attisdropped
ORDER BY a.attrelid,a.attname
LIMIT 105`;

const INDEXES_SQL = `WITH indexes AS MATERIALIZED (
  SELECT i.* FROM pg_catalog.pg_index i
  WHERE i.indrelid=ANY($1::oid[])
  ORDER BY i.indrelid,i.indexrelid LIMIT 129
)
SELECT i.indrelid::text AS relation_oid,
       i.indexrelid::text AS index_oid,
       ic.relname::text AS index_name,
       ic.relkind::text AS index_kind,
       am.amname::text AS access_method,
       hn.nspname::text AS handler_namespace,
       hp.proname::text AS handler_name,
       hl.lanname::text AS handler_language,
       hp.prosrc AS handler_source,
       hp.probin AS handler_binary,
       hp.prosecdef AS handler_security_definer,
       hp.proconfig AS handler_config,
       i.indnatts::integer AS total_attributes,
       i.indnkeyatts::integer AS key_attributes,
       i.indisprimary AS primary_key,
       i.indisunique AS unique_index,
       i.indimmediate AS immediate,
       i.indisvalid AS valid,
       i.indisready AS ready,
       i.indislive AS live,
       i.indisexclusion AS exclusion,
       i.indkey::text AS attribute_numbers,
       i.indclass::text AS operator_class_oids,
       i.indcollation::text AS collation_oids,
       i.indoption::text AS key_options,
       pg_catalog.pg_get_expr(i.indexprs,i.indrelid,false) AS expressions,
       pg_catalog.pg_get_expr(i.indpred,i.indrelid,false) AS predicate,
       pg_catalog.pg_get_indexdef(i.indexrelid,0,false) AS definition,
       (SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'constraint_oid',c.oid::text,'kind',c.contype::text,
          'validated',c.convalidated,'deferrable',c.condeferrable,
          'deferred',c.condeferred,'attributes',c.conkey) ORDER BY c.oid)
        FROM pg_catalog.pg_constraint c
        WHERE c.conindid=i.indexrelid AND c.conrelid=i.indrelid
          AND c.contype='p') AS primary_constraints,
       (SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'ordinal',k.pos,'attribute_number',i.indkey[k.pos],
          'operator_class_oid',oc.oid::text,
          'operator_class_namespace',onsp.nspname::text,
          'operator_class_name',oc.opcname::text,
          'operator_class_default',oc.opcdefault,
          'operator_input_type_oid',oc.opcintype::text,
          'operator_key_type_oid',oc.opckeytype::text,
          'family_oid',f.oid::text,'family_namespace',fn.nspname::text,
          'family_name',f.opfname::text,
          'class_method_matches',oc.opcmethod=ic.relam,
          'family_method_matches',f.opfmethod=ic.relam,
          'support_count',(SELECT count(*)::integer FROM pg_catalog.pg_amproc ap
                           WHERE ap.amprocfamily=f.oid),
          'operator_count',(SELECT count(*)::integer FROM pg_catalog.pg_amop ao
                            WHERE ao.amopfamily=f.oid),
          'support_builtin',NOT EXISTS (
            SELECT 1 FROM pg_catalog.pg_amproc ap
            LEFT JOIN pg_catalog.pg_proc p ON p.oid=ap.amproc
            LEFT JOIN pg_catalog.pg_namespace ns ON ns.oid=p.pronamespace
            LEFT JOIN pg_catalog.pg_language l ON l.oid=p.prolang
            WHERE ap.amprocfamily=f.oid AND (
              p.oid IS NULL OR ns.nspname IS DISTINCT FROM 'pg_catalog'
              OR l.lanname IS DISTINCT FROM 'internal'
              OR p.prokind IS DISTINCT FROM 'f' OR p.prosecdef
              OR p.proconfig IS NOT NULL OR p.probin IS NOT NULL)),
          'operators_builtin',NOT EXISTS (
            SELECT 1 FROM pg_catalog.pg_amop ao
            LEFT JOIN pg_catalog.pg_operator op ON op.oid=ao.amopopr
            LEFT JOIN pg_catalog.pg_namespace ons ON ons.oid=op.oprnamespace
            LEFT JOIN pg_catalog.pg_proc p ON p.oid=op.oprcode
            LEFT JOIN pg_catalog.pg_namespace ns ON ns.oid=p.pronamespace
            LEFT JOIN pg_catalog.pg_language l ON l.oid=p.prolang
            WHERE ao.amopfamily=f.oid AND (
              op.oid IS NULL OR p.oid IS NULL
              OR ons.nspname IS DISTINCT FROM 'pg_catalog'
              OR ns.nspname IS DISTINCT FROM 'pg_catalog'
              OR l.lanname IS DISTINCT FROM 'internal'
              OR p.prokind IS DISTINCT FROM 'f' OR p.prosecdef
              OR p.proconfig IS NOT NULL OR p.probin IS NOT NULL
              OR ao.amopmethod IS DISTINCT FROM ic.relam
              OR ao.amoplefttype IS DISTINCT FROM op.oprleft
              OR ao.amoprighttype IS DISTINCT FROM op.oprright))
        ) ORDER BY k.pos)
        FROM pg_catalog.generate_series(0,i.indnkeyatts-1) k(pos)
        LEFT JOIN pg_catalog.pg_opclass oc ON oc.oid=i.indclass[k.pos]
        LEFT JOIN pg_catalog.pg_namespace onsp ON onsp.oid=oc.opcnamespace
        LEFT JOIN pg_catalog.pg_opfamily f ON f.oid=oc.opcfamily
        LEFT JOIN pg_catalog.pg_namespace fn ON fn.oid=f.opfnamespace) AS keys
FROM indexes i
LEFT JOIN pg_catalog.pg_class ic ON ic.oid=i.indexrelid
LEFT JOIN pg_catalog.pg_am am ON am.oid=ic.relam
LEFT JOIN pg_catalog.pg_proc hp ON hp.oid=am.amhandler
LEFT JOIN pg_catalog.pg_namespace hn ON hn.oid=hp.pronamespace
LEFT JOIN pg_catalog.pg_language hl ON hl.oid=hp.prolang
ORDER BY i.indrelid,i.indexrelid`;
