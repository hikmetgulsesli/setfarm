import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";

const production = new URL("../../src/db/dashboard-core-readonly-profile-v2.js", import.meta.url);
const names = ["runs", "steps", "stories", "rules", "run_observations"];
// Independent fixture frozen from ordinary DDL and pre32 migrations, not the
// implementation's manifest. No live PG, credentials, SQL mutation or listener.
const fields = [
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
  fields[3]!.filter(name => name !== "source").join(" "),
  "id run_id step_id story_id check_id label status evidence file_paths github metadata created_at updated_at",
].map(value => new Set(value.split(" ")));
const integers = new Set("run_number protocol_version step_index story_index retry_count max_retries abandoned_count claim_generation sort_order".split(" "));

function fixture() {
  const relations = names.map((name, index) => ({
    relation_oid: String(1000 + index), relation_name: name, relation_kind: "r", persistence: "p",
    access_method: "heap", handler_namespace: "pg_catalog", handler_name: "heap_tableam_handler",
    handler_language: "internal", handler_source: "heap_tableam_handler", handler_binary: null,
    handler_security_definer: false, handler_config: null, row_security: false,
    force_row_security: false, has_inheritance: false, has_rewrite: false, can_select: true,
  }));
  const columns = fields.flatMap((list, table) => list.map((name, index) => {
    const type = name.endsWith("_at") ? "timestamptz" : integers.has(name) ? "int4" : ["enabled", "readonly"].includes(name) ? "bool" : "text";
    return {
      relation_oid: String(1000 + table), attribute_number: index + 1, column_name: name,
      type_oid: ({ text: "25", int4: "23", bool: "16", timestamptz: "1184" })[type],
      type_namespace: "pg_catalog", type_name: type, type_kind: "b", type_modifier: -1,
      dimensions: 0, not_null: notNull[table]!.has(name), identity_kind: "", generated_kind: "",
      collation_oid: type === "text" ? "100" : "0",
      collation_namespace: type === "text" ? "pg_catalog" : null,
      collation_name: type === "text" ? "default" : null,
    };
  }));
  const indexes = names.map((name, table) => ({
    relation_oid: String(1000 + table), index_oid: String(2000 + table), index_name: name + "_pkey",
    index_kind: "i", access_method: "btree", handler_namespace: "pg_catalog", handler_name: "bthandler",
    handler_language: "internal", handler_source: "bthandler", handler_binary: null,
    handler_security_definer: false, handler_config: null, total_attributes: 1, key_attributes: 1,
    primary_key: true, unique_index: true, immediate: true, valid: true, ready: true, live: true,
    exclusion: false, attribute_numbers: "1", operator_class_oids: "3126", collation_oids: "100",
    key_options: "0", expressions: null, predicate: null, definition: `CREATE UNIQUE INDEX ${name}_pkey ON public.${name} USING btree (id)`,
    primary_constraints: [{ constraint_oid: String(3000 + table), kind: "p", validated: true, deferrable: false, deferred: false, attributes: [1] }],
    keys: [{ ordinal: 0, attribute_number: 1, operator_class_oid: "3126", operator_class_namespace: "pg_catalog",
      operator_class_name: "text_ops", operator_class_default: true, operator_input_type_oid: "25", operator_key_type_oid: "0",
      family_oid: "1994", family_namespace: "pg_catalog", family_name: "text_ops", class_method_matches: true,
      family_method_matches: true, support_count: 2, operator_count: 5, support_builtin: true, operators_builtin: true }],
  }));
  return { relations, columns, indexes };
}

async function observe(data = fixture(), previous?: unknown, onPort?: (parameters: unknown[], number: number) => void) {
  const module = await import(production.href);
  const calls: Array<{ statement: string; parameters: unknown[] }> = [];
  const batches = [data.relations, data.columns, data.indexes];
  const sql = { unsafe: async (statement: string, parameters: unknown[] = []) => {
    calls.push({ statement, parameters });
    onPort?.(parameters, calls.length);
    const next = batches[calls.length - 1];
    assert.ok(next, "no fourth metadata or data/mutating statement");
    return next;
  } };
  try {
    const profile = await module.observeDashboardCoreReadonlyProfileV2(sql, previous);
    return { profile, calls };
  } catch (error) {
    return { error, calls };
  }
}

test("exact104-column five-table profile uses three fixed original-OID statements", async () => {
  const { profile, error, calls } = await observe();
  assert.equal(error, undefined); assert.ok(profile); assert.equal(calls.length, 3);
  assert.match(calls[0]!.statement, /LIMIT 6/);
  assert.match(calls[1]!.statement, /LIMIT 105/);
  assert.match(calls[2]!.statement, /LIMIT 129/);
  assert.deepEqual(calls.map(call => call.parameters), [[], [["1000", "1001", "1002", "1003", "1004"]], [["1000", "1001", "1002", "1003", "1004"]]]);
  assert.ok(Object.isFrozen(profile)); assert.ok(Object.isFrozen(profile.relationOids));
  assert.match(profile.catalogHash, /^[a-f0-9]{64}$/);
  assert.deepEqual(Object.keys(profile), ["schema", "relationOids", "catalogHash"]);
  const nomination = fs.readFileSync(new URL("../../docs/superpowers/specs/2026-10-07-dashboard-core-readonly-profile-v2.md", import.meta.url), "utf8");
  const statements = [...nomination.matchAll(/```sql\n([\s\S]*?)\n```/g)].map(match => match[1]);
  assert.equal(statements.length, 3);
  assert.deepEqual(calls.map(call => call.statement), statements);
});

const mutations: Array<[string, (data: ReturnType<typeof fixture>) => void, number]> = [
  ["missing relation", data => { data.relations.pop(); }, 1],
  ["duplicate relationOID", data => { data.relations[1]!.relation_oid = "1000"; }, 1],
  ["view substitution", data => { data.relations[0]!.relation_kind = "v"; }, 1],
  ["temporary heap", data => { data.relations[0]!.persistence = "t"; }, 1],
  ["RLS", data => { data.relations[0]!.row_security = true; }, 1],
  ["inheritance", data => { data.relations[0]!.has_inheritance = true; }, 1],
  ["rewrite", data => { data.relations[0]!.has_rewrite = true; }, 1],
  ["no SELECT privilege", data => { data.relations[0]!.can_select = false; }, 1],
  ["custom heap handler", data => { data.relations[0]!.handler_namespace = "public"; }, 1],
  ["extra column", data => { data.columns.push({ ...data.columns[0]!, column_name: "extra" }); }, 2],
  ["missing column", data => { data.columns.pop(); }, 2],
  ["crossed columnOID", data => { data.columns[0]!.relation_oid = "1001"; }, 2],
  ["domain type", data => { data.columns[0]!.type_kind = "d"; }, 2],
  ["wrong builtinOID", data => { data.columns[0]!.type_oid = "23"; }, 2],
  ["type modifier", data => { data.columns[0]!.type_modifier = 10; }, 2],
  ["array dimension", data => { data.columns[0]!.dimensions = 1; }, 2],
  ["wrong nullability", data => { data.columns[0]!.not_null = false; }, 2],
  ["generated column", data => { data.columns[0]!.generated_kind = "s"; }, 2],
  ["foreign collation", data => { data.columns[0]!.collation_namespace = "public"; }, 2],
  ["missing primary key", data => { data.indexes.pop(); }, 3],
  ["invalid index", data => { data.indexes[0]!.valid = false; }, 3],
  ["index on unknown relation", data => { data.indexes[0]!.relation_oid = "9999"; }, 3],
  ["expression index", data => { (data.indexes[0] as any).expressions = "custom(id)"; }, 3],
  ["unknown predicate", data => { (data.indexes[0] as any).predicate = "custom(id)"; }, 3],
  ["custom opclass", data => { data.indexes[0]!.keys[0]!.operator_class_namespace = "public"; }, 3],
  ["custom family", data => { data.indexes[0]!.keys[0]!.family_namespace = "public"; }, 3],
  ["custom support", data => { data.indexes[0]!.keys[0]!.support_builtin = false; }, 3],
  ["missing operators", data => { data.indexes[0]!.keys[0]!.operator_count = 0; }, 3],
  ["dependency overflow", data => { data.indexes[0]!.keys[0]!.support_count = 65; }, 3],
  ["wrong key binding", data => { data.indexes[0]!.keys[0]!.attribute_number = 2; }, 3],
  ["bad vector", data => { data.indexes[0]!.attribute_numbers = "01"; }, 3],
  ["deferrable primary", data => { data.indexes[0]!.primary_constraints[0]!.deferrable = true; }, 3],
  ["duplicate constraint", data => { data.indexes[0]!.primary_constraints.push({ ...data.indexes[0]!.primary_constraints[0]! }); }, 3],
  ["index-cap sentinel", data => { while (data.indexes.length < 129) data.indexes.push({ ...data.indexes[0]! }); }, 3],
];
for (const [name, mutate, expectedCalls] of mutations) test(`profile refuses ${name} before further metadata ports`, async () => {
  const data = fixture(); mutate(data);
  const { error, calls } = await observe(data);
  assert.equal((error as Error)?.message, "DASHBOARD_CORE_READONLY_PROFILE_REFUSED");
  assert.equal(calls.length, expectedCalls);
});

test("original profile rejects OID drift without repinning", async () => {
  const first = await observe(); assert.ok(first.profile);
  const data = fixture(); data.relations[0]!.relation_oid = "4000";
  const next = await observe(data, first.profile);
  assert.equal((next.error as Error)?.message, "DASHBOARD_CORE_READONLY_PROFILE_REFUSED");
  assert.equal(next.calls.length, 1);
});

test("foreign copied profile refuses before metadata ports", async () => {
  const first = await observe(); assert.ok(first.profile);
  const next = await observe(fixture(), { ...first.profile });
  assert.equal((next.error as Error)?.message, "DASHBOARD_CORE_READONLY_PROFILE_REFUSED");
  assert.equal(next.calls.length, 0);
});

test("original profile recheck accepts unchanged snapshot without issuing a grant", async () => {
  const first = await observe(); assert.ok(first.profile);
  const next = await observe(fixture(), first.profile);
  assert.equal(next.error, undefined); assert.equal(next.profile, first.profile);
});

test("provider details are replaced by fixed refusal", async () => {
  const module = await import(production.href);
  await assert.rejects(module.observeDashboardCoreReadonlyProfileV2({ unsafe: async () => { throw Error("PRIVATE_PROVIDER_DETAIL"); } }),
    { message: "DASHBOARD_CORE_READONLY_PROFILE_REFUSED" });
});

for (const [batch, expectedCalls] of [["relations", 1], ["columns", 2], ["indexes", 3]] as const) {
  test(`${batch} proxy row refuses with zero caller traps`, async () => {
    const data = fixture(); let traps = 0;
    data[batch][0] = new Proxy(data[batch][0]!, { get() { traps++; throw Error("CALLER_TRAP"); },
      getPrototypeOf() { traps++; throw Error("CALLER_TRAP"); }, ownKeys() { traps++; throw Error("CALLER_TRAP"); } }) as never;
    const result = await observe(data);
    assert.equal((result.error as Error)?.message, "DASHBOARD_CORE_READONLY_PROFILE_REFUSED");
    assert.equal(result.calls.length, expectedCalls); assert.equal(traps, 0);
  });
  test(`${batch} accessor row refuses without invoking getter`, async () => {
    const data = fixture(); let traps = 0;
    Object.defineProperty(data[batch][0], "relation_oid", { enumerable: true,
      get() { traps++; throw Error("CALLER_TRAP"); } });
    const result = await observe(data);
    assert.equal((result.error as Error)?.message, "DASHBOARD_CORE_READONLY_PROFILE_REFUSED");
    assert.equal(result.calls.length, expectedCalls); assert.equal(traps, 0);
  });
}

test("provider Result array metadata is ignored without executing hooks", async () => {
  const data = fixture(); let traps = 0;
  class Result extends Array {}
  for (const batch of ["relations", "columns", "indexes"] as const) {
    const result = new Result(); result.push(...data[batch]);
    Object.defineProperty(result, "columns", { get() { traps++; throw Error("UNUSED_METADATA"); } });
    data[batch] = result as never;
  }
  const result = await observe(data);
  assert.equal(result.error, undefined); assert.ok(result.profile); assert.equal(traps, 0);
});

test("hole in a row batch refuses rather than skip missing metadata", async () => {
  const data = fixture(); delete data.columns[10];
  const result = await observe(data);
  assert.equal((result.error as Error)?.message, "DASHBOARD_CORE_READONLY_PROFILE_REFUSED");
  assert.equal(result.calls.length, 2);
});

test("unchanged OIDs with changed valid metadata refuse previous snapshot", async () => {
  const first = await observe(); assert.ok(first.profile);
  const data = fixture(); data.indexes[0]!.index_name = "changed_but_safe";
  const independent = await observe(data); assert.equal(independent.error, undefined); assert.ok(independent.profile);
  const next = await observe(data, first.profile);
  assert.equal((next.error as Error)?.message, "DASHBOARD_CORE_READONLY_PROFILE_REFUSED");
  assert.equal(next.calls.length, 3);
});

test("retained column-query parameter mutation cannot alter next original-OID query", async () => {
  const result = await observe(fixture(), undefined, (parameters, number) => {
    if (number === 2) (parameters[0] as string[])[0] = "9999";
  });
  assert.equal(result.error, undefined); assert.ok(result.profile);
  assert.deepEqual(result.calls[2]!.parameters, [["1000", "1001", "1002", "1003", "1004"]]);
  assert.equal(result.profile.relationOids.runs, "1000");
});

test("proxy previous profile refuses without traps or metadata ports", async () => {
  const first = await observe(); assert.ok(first.profile); let traps = 0;
  const previous = new Proxy(first.profile, { get() { traps++; throw Error("CALLER_TRAP"); },
    ownKeys() { traps++; throw Error("CALLER_TRAP"); }, getPrototypeOf() { traps++; throw Error("CALLER_TRAP"); } });
  const next = await observe(fixture(), previous);
  assert.equal((next.error as Error)?.message, "DASHBOARD_CORE_READONLY_PROFILE_REFUSED");
  assert.equal(next.calls.length, 0); assert.equal(traps, 0);
});

for (const location of ["keys", "constraints", "attributes"] as const) {
  for (const mode of ["hidden-value", "hidden-getter", "symbol", "proxy"] as const) {
    test(`nested ${location} rejects ${mode} with zero traps`, async () => {
      const data = fixture(); let traps = 0;
      const original = location === "keys" ? data.indexes[0]!.keys
        : location === "constraints" ? data.indexes[0]!.primary_constraints
          : data.indexes[0]!.primary_constraints[0]!.attributes;
      let poisoned = original;
      if (mode === "hidden-value") Object.defineProperty(original, "extra", { value: "not JSON" });
      if (mode === "hidden-getter") Object.defineProperty(original, "extra", { get() { traps++; throw Error("CALLER_TRAP"); } });
      if (mode === "symbol") Object.defineProperty(original, Symbol("extra"), { value: "not JSON" });
      if (mode === "proxy") poisoned = new Proxy(original, { get() { traps++; throw Error("CALLER_TRAP"); },
        getPrototypeOf() { traps++; throw Error("CALLER_TRAP"); }, ownKeys() { traps++; throw Error("CALLER_TRAP"); } });
      if (location === "keys") data.indexes[0]!.keys = poisoned as never;
      else if (location === "constraints") data.indexes[0]!.primary_constraints = poisoned as never;
      else data.indexes[0]!.primary_constraints[0]!.attributes = poisoned as never;
      const result = await observe(data);
      assert.equal((result.error as Error)?.message, "DASHBOARD_CORE_READONLY_PROFILE_REFUSED");
      assert.equal(result.calls.length, 3); assert.equal(traps, 0);
    });
  }
}

function addIndex(data: ReturnType<typeof fixture>, table: number, requested: string[], predicate: string | null = null) {
  const columns = requested.map(name => data.columns.find(column => column.relation_oid === String(1000 + table) && column.column_name === name)!);
  const identity = String(5000 + data.indexes.length);
  const keys = columns.map((column, ordinal) => ({
    ...data.indexes[0]!.keys[0]!, ordinal, attribute_number: column.attribute_number,
    operator_class_oid: ({ text: "3126", int4: "1978", bool: "10003", timestamptz: "3127" })[column.type_name]!,
    operator_class_name: column.type_name + "_ops", operator_input_type_oid: column.type_oid!,
    family_oid: "6000", family_name: ({ text: "text_ops", int4: "integer_ops", bool: "bool_ops", timestamptz: "datetime_ops" })[column.type_name]!,
  }));
  data.indexes.push({ ...data.indexes[0]!, relation_oid: String(1000 + table), index_oid: identity,
    index_name: "ordinary_" + identity, primary_key: false, unique_index: false,
    total_attributes: requested.length, key_attributes: requested.length,
    attribute_numbers: columns.map(column => column.attribute_number).join(" "),
    operator_class_oids: keys.map(key => key.operator_class_oid).join(" "),
    collation_oids: columns.map(column => column.collation_oid).join(" "),
    key_options: requested.map(() => "0").join(" "), keys, predicate,
    primary_constraints: null,
    definition: "CREATE INDEX ordinary ON public." + names[table] + " USING btree (" + requested.join(", ") + ")",
  } as never);
}

for (const [table, fields, predicate] of [
  [0, ["status", "assigned_developer"], "(status = 'running'::text)"],
  [1, ["agent_id", "status"], "(status = ANY (ARRAY['pending'::text, 'running'::text]))"],
  [2, ["run_id", "story_id"], "(status = ANY (ARRAY['pending'::text, 'running'::text]))"],
  [2, ["run_id", "quality_failure_fingerprint"], "(quality_failure_fingerprint IS NOT NULL)"],
] as const) test(`admits nominated partial index ${table}/${fields.join("+")}`, async () => {
  const data = fixture(); addIndex(data, table, [...fields], predicate);
  const result = await observe(data); assert.equal(result.error, undefined); assert.ok(result.profile);
  assert.equal(result.calls.length, 3);
});

for (const [table, field] of [[0, "run_number"], [3, "enabled"], [0, "created_at"]] as const) {
  test(`admits builtin non-text index ${field}`, async () => {
    const data = fixture(); addIndex(data, table, [field]);
    const result = await observe(data); assert.equal(result.error, undefined); assert.ok(result.profile);
  });
}

test("known partial predicate on wrong field bindings is refused", async () => {
  const data = fixture(); addIndex(data, 0, ["id"], "(status = 'running'::text)");
  const result = await observe(data);
  assert.equal((result.error as Error)?.message, "DASHBOARD_CORE_READONLY_PROFILE_REFUSED");
  assert.equal(result.calls.length, 3);
});

test("nonprimary NULL constraint aggregation is accepted, fake empty-array contract is refused", async () => {
  const data = fixture(); addIndex(data, 0, ["created_at"]);
  assert.equal((await observe(data)).error, undefined);
  (data.indexes.at(-1) as any).primary_constraints = [];
  const result = await observe(data);
  assert.equal((result.error as Error)?.message, "DASHBOARD_CORE_READONLY_PROFILE_REFUSED");
});
