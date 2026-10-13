import assert from "node:assert/strict";
import { test } from "node:test";
import { contractSpinePre32SourceJournalIdentitiesV1 } from "../../src/db/contract-spine-migrations.js";
import { createFindingSetV1 } from "../../src/findings/finding-set.js";
import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";

const production = new URL("../../src/db/dashboard-core-readonly-qualification-v2.js", import.meta.url);
// Reuse the independent profile fixture verbatim; no production-derived metadata.
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


const countKeys = "activeRunCount openClaimCount executionAttemptCount activeRuntimeSessionCount activeCompletionOwnerCount unsettledMandatoryEffectCount artifactReservationCount publicationBatchCount artifactPublicationCount terminationOwnerCount findingOwnerCount recoveryOwnerCount operationalDeliveryCount".split(" ");
function data() {
  return {
    profile: fixture(),
    journal: contractSpinePre32SourceJournalIdentitiesV1().map(row => ({ ...row, state: "applied" })),
    tail: Array.from({ length: 6 }, (_, index) => ({ version: index + 26, state: "applied" })),
    cold: { laterJournalCount: "0", relationCount: "0", functionCount: "0", typeCount: "0", triggerCount: "0" },
    aggregate: { catalogViolationCount: "0", aprbChildViolationCount: "0", ordinaryBatchViolationCount: "0",
      activeHeaderViolationCount: "0", ownerReservationsRelation: null, ownerAdmissionHeadRelation: null,
      producerSourceRelation: null, producerActivationRelation: null, producerActivationHeadRelation: null,
      producerCurrentRelation: null, ...Object.fromEntries(countKeys.map(key => [key, "0"])) } as Record<string, unknown>,
    parents: [] as Record<string, unknown>[], children: [] as Record<string, unknown>[], runs: [] as Record<string, unknown>[],
  };
}
function transaction(value = data(), failAt = 0) {
  const calls: Array<{ sql: string; parameters: unknown[]; sameOriginal: boolean }> = [];
  async function tx(strings: TemplateStringsArray, ...parameters: unknown[]) {
    const sql = strings.join("?");
    calls.push({ sql, parameters, sameOriginal: true });
    if (calls.length === failAt) throw Error("PRIVATE_PROVIDER_DETAIL");
    if (sql.includes("WITH expected_tables(name)")) return [value.cold];
    if (sql.includes("WITH required_columns(")) return [value.aggregate];
    if (sql.includes("FROM public.finding_sets ORDER BY")) return value.parents;
    if (sql.includes("FROM public.findings ORDER BY")) return value.children;
    if (sql.includes("finding_sets")) return value.runs;
    throw Error("UNNOMINATED_TAGGED_SQL");
  }
  tx.unsafe = async function(this: unknown, sql: string, parameters: unknown[] = []) {
    calls.push({ sql, parameters, sameOriginal: this === tx });
    if (calls.length === failAt) throw Error("PRIVATE_PROVIDER_DETAIL");
    if (calls.length <= 3) return [value.profile.relations, value.profile.columns, value.profile.indexes][calls.length - 1];
    if (sql.includes("WHERE version <= $1")) return value.journal;
    if (sql === "SELECT version,state FROM public.setfarm_schema_migrations WHERE version >= 26 ORDER BY version") return value.tail;
    throw Error("UNNOMINATED_UNSAFE_SQL");
  };
  return { tx, calls, value };
}
async function observe(fixture = transaction(), previous?: unknown) {
  const module = await import(production.href);
  try { return { snapshot: await module.observeDashboardCoreReadonlyQualificationV2(fixture.tx, previous), calls: fixture.calls }; }
  catch (error) { return { error, calls: fixture.calls }; }
}
test("ten original retained statements qualify a frozen inert snapshot without acquisition", async () => {
  const observed = await observe();
  assert.equal(observed.error, undefined); assert.ok(Object.isFrozen(observed.snapshot));
  assert.deepEqual(Object.keys(observed.snapshot), ["schema", "profile", "censusHash"]);
  assert.equal(observed.snapshot.schema, "setfarm.dashboard-core-readonly-qualification.v2");
  assert.match(observed.snapshot.censusHash, /^[a-f0-9]{64}$/);
  assert.equal(observed.calls.length, 10); assert.ok(observed.calls.every(call => call.sameOriginal));
  assert.deepEqual(observed.calls[3]!.parameters, [31]);
  assert.equal(observed.calls[4]!.sql, "SELECT version,state FROM public.setfarm_schema_migrations WHERE version >= 26 ORDER BY version");
  assert.ok(observed.calls.every(call => !/^(?:BEGIN|LOCK|SET|COMMIT|ROLLBACK)/.test(call.sql)));
});
test("unchanged original snapshot rechecks all ten reads without repinning", async () => {
  const first = await observe(); assert.equal(first.error, undefined);
  const next = await observe(transaction(), first.snapshot);
  assert.equal(next.error, undefined); assert.deepEqual(next.snapshot, first.snapshot); assert.equal(next.calls.length, 10);
});
test("census hash pins all thirteen normalized zeros and the verified inventory", async () => {
  const observed = await observe();
  const inventoryBody = { schema: "setfarm.legacy-finding-publication-inventory.v1", entries: [] };
  const inventory = { ...inventoryBody, inventoryHash: hashCanonicalJson(inventoryBody) };
  const normalized = { ...Object.fromEntries(countKeys.map(key => [key, 0])), legacyFindingPublicationInventory: inventory };
  assert.equal(observed.error, undefined); assert.equal(observed.snapshot.censusHash, hashCanonicalJson(normalized));
});
test("earlier adopted source identities remain valid", async () => {
  const value = data(); value.journal[0]!.state = "adopted";
  const observed = await observe(transaction(value)); assert.equal(observed.error, undefined);
});
for (const [name, mutate, stop] of [
  ["sparse journal", (value: ReturnType<typeof data>) => { value.journal = new Array(31); }, 4],
  ["journal checksum", (value: ReturnType<typeof data>) => { value.journal[4]!.checksum = "0".repeat(64); }, 4],
  ["journal missing", (value: ReturnType<typeof data>) => { value.journal.pop(); }, 4],
  ["journal duplicate", (value: ReturnType<typeof data>) => { value.journal[4] = { ...value.journal[3]! }; }, 4],
  ["journal extra field", (value: ReturnType<typeof data>) => { Object.assign(value.journal[0]!, { extra: true }); }, 4],
  ["sparse tail", (value: ReturnType<typeof data>) => { value.tail = new Array(6); }, 5],
  ["adopted tail", (value: ReturnType<typeof data>) => { value.tail[0]!.state = "adopted"; }, 5],
  ["later32 tail", (value: ReturnType<typeof data>) => { value.tail.push({ version: 32, state: "applied" }); }, 5],
  ["tail duplicate", (value: ReturnType<typeof data>) => { value.tail[0]!.version = 27; }, 5],
  ["tail extra field", (value: ReturnType<typeof data>) => { Object.assign(value.tail[0]!, { extra: true }); }, 5],
  ["later cold journal", (value: ReturnType<typeof data>) => { value.cold.laterJournalCount = "1"; }, 6],
  ["active owner", (value: ReturnType<typeof data>) => { value.aggregate.activeRunCount = "1"; }, 10],
] as const) test(`qualification refuses ${name} at the original boundary`, async () => {
  const value = data(); mutate(value); const result = await observe(transaction(value));
  assert.equal(result.snapshot, undefined); assert.equal((result.error as Error).message, "DASHBOARD_CORE_READONLY_QUALIFICATION_REFUSED");
  assert.equal(result.calls.length, stop);
});
for (let port = 1; port <= 10; port++) test(`provider failure at port${port} is fixed refusal with no subsequent ports`, async () => {
  const result = await observe(transaction(data(), port));
  assert.equal(result.snapshot, undefined); assert.equal((result.error as Error).message, "DASHBOARD_CORE_READONLY_QUALIFICATION_REFUSED");
  assert.equal(result.calls.length, port);
});
test("foreign copied and proxy snapshots refuse before transaction ports and traps", async () => {
  const first = await observe(); let traps = 0;
  for (const previous of [{ ...first.snapshot }, new Proxy({}, { get() { traps++; throw Error("TRAP"); }, ownKeys() { traps++; throw Error("TRAP"); } })]) {
    const result = await observe(transaction(), previous);
    assert.equal((result.error as Error).message, "DASHBOARD_CORE_READONLY_QUALIFICATION_REFUSED"); assert.equal(result.calls.length, 0);
  }
  assert.equal(traps, 0);
});
test("original OID/hash drift refuses without repinning", async () => {
  const first = await observe(); const value = data(); value.profile.relations[0]!.relation_oid = "9999";
  const result = await observe(transaction(value), first.snapshot);
  assert.equal((result.error as Error).message, "DASHBOARD_CORE_READONLY_QUALIFICATION_REFUSED"); assert.equal(result.calls.length, 1);
});
test("journal and tail getters are refused without invoking them", async () => {
  let traps = 0;
  for (const selected of ["journal", "tail"] as const) {
    const value = data(); Object.defineProperty(value[selected][0], "state", { enumerable: true, get() { traps++; throw Error("TRAP"); } });
    const result = await observe(transaction(value));
    assert.equal((result.error as Error).message, "DASHBOARD_CORE_READONLY_QUALIFICATION_REFUSED");
    assert.equal(result.calls.length, selected === "journal" ? 4 : 5);
  }
  assert.equal(traps, 0);
});
function publishedData() {
  const value = data();
  const set = createFindingSetV1({ runId: "terminal", storyId: "US-001", packetHash: "a".repeat(64), sliceHash: "b".repeat(64),
    sourceRevision: { sha: "a".repeat(40), treeHash: "b".repeat(40) },
    findings: [{ origin: "test", classification: "structured", invariantRef: "INV_PUBLICATION",
      sourceLocators: [{ path: "src/example.ts", contentHash: "c".repeat(64) }],
      observedEvidenceRefs: ["a".repeat(64)], expectedPredicateRef: "EVID_PUBLICATION", status: "open" }] });
  value.parents = [{ finding_set_hash: set.findingSetHash, finding_set_id: set.findingSetId,
    run_id: set.runId, story_id: set.storyId, packet_hash: set.packetHash, slice_hash: set.sliceHash,
    source_sha: set.sourceRevision.sha, source_tree_hash: set.sourceRevision.treeHash,
    finding_ids: set.findings.map(finding => finding.findingId), payload: set }];
  value.children = set.findings.map(finding => ({ finding_set_hash: set.findingSetHash,
    finding_id: finding.findingId, origin: finding.origin, classification: finding.classification,
    invariant_ref: finding.invariantRef, status: finding.status, source_fingerprint: hashCanonicalJson(finding.sourceLocators), payload: finding }));
  value.runs = [{ id: set.runId, status: "failed" }]; value.aggregate.findingOwnerCount = "1";
  return value;
}
test("complete terminal open finding is preserved, not classified as an active owner", async () => {
  const result = await observe(transaction(publishedData())); const empty = await observe();
  assert.equal(result.error, undefined); assert.notEqual(result.snapshot.censusHash, empty.snapshot.censusHash);
});
test("membership drift refuses original census hash without dropping preserved findings", async () => {
  const first = await observe(transaction(publishedData()));
  const result = await observe(transaction(), first.snapshot);
  assert.equal(result.snapshot, undefined); assert.equal((result.error as Error).message, "DASHBOARD_CORE_READONLY_QUALIFICATION_REFUSED");
  assert.equal(result.calls.length, 10);
});
