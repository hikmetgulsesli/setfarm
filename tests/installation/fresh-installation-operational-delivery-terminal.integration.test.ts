import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import postgres from "postgres";
import ts from "typescript";
import { createFreshInstallationTestFixtureV1 as create, freshTestAdminUrl } from "./fresh-installation-test-support.js";
import { freshSourceCheckoutFixture } from "./fresh-source-checkout-fixture.js";

// Schema-only real-PG components. No compiled activation, owner reservation,
// terminal authority or successful public close is fabricated by these tests.
// The actual public access guard is expected to refuse before any resolver SQL.
// Whole projection execution is a separate real-PG component, never public admission.
const EVENTS = [
  { eventKey: "component-terminal-delivered", consumer: "webhook", state: "delivered" },
  { eventKey: "component-terminal-skipped", consumer: "jsonl", state: "skipped" },
  { eventKey: "component-terminal-quarantined", consumer: "webhook", state: "quarantined" },
  { eventKey: "component-terminal-pending", consumer: "jsonl", state: "pending" },
] as const;

function exactProjectionSource(root: string): string {
  const file = path.join(root, "src/db-pg.ts");
  const source = readFileSync(file, "utf8");
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const names = ["OPERATIONAL_DELIVERY_TERMINAL_STATUSES_V1", "OPERATIONAL_DELIVERY_TERMINAL_RESOLVER_CONFIG_V1"];
  const statements = names.map(name => {
    const matches = tree.statements.filter(statement => ts.isVariableStatement(statement)
      && statement.declarationList.declarations.some(declaration => ts.isIdentifier(declaration.name) && declaration.name.text === name));
    assert.equal(matches.length, 1, `production declaration must be unique: ${name}`);
    assert.equal((matches[0] as ts.VariableStatement).declarationList.declarations.length, 1);
    return matches[0]!.getText(tree);
  });
  return ts.transpileModule(statements.join("\n"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
}

const CHILD = String.raw`
  import assert from "node:assert/strict";
  import { createHash } from "node:crypto";
  import { readFileSync } from "node:fs";
  import postgres from "postgres";
  const leaf = await import(input.root + "/src/installation/fresh-installation-selection-v1.ts");
  assert.equal(leaf.selectedFreshInstallationRootV1() !== null, input.selected);
  const db = await import(input.root + "/src/db-pg.ts");
  const owner = await import(input.root + "/src/internal-production/owner-admission-v1.ts");
  const canonical = await import(input.root + "/src/product-compiler/canonical-json.ts");
  const credentials = JSON.parse(readFileSync(input.directory + "/runtime-credentials.json", "utf8"));
  const sql = postgres(credentials.runtimeUrl, { max: 1, connect_timeout: 3, onnotice() {} });
  const projection = new Function(
    "createInternalProductionOperationalDeliveryCanonicalOwnerIdentityV1", "hashCanonicalJson",
    "selectedFreshInstallationRootV1", input.projectionSource + "\nreturn OPERATIONAL_DELIVERY_TERMINAL_RESOLVER_CONFIG_V1;"
  )(owner.createInternalProductionOperationalDeliveryCanonicalOwnerIdentityV1,
    canonical.hashCanonicalJson, leaf.selectedFreshInstallationRootV1);
  const sha = text => createHash("sha256").update(text).digest("hex");
  const traces = [];
  // A transparent recorder delegates every statement to the same real PG
  // transaction. It supplies no rows, authority, flags or alternate SQL.
  function observed(tx) {
    return new Proxy(tx, {
      apply(target, receiver, args) {
        if (Array.isArray(args[0])) traces.push(args[0].join("?"));
        return Reflect.apply(target, target, args);
      },
      get(target, key) {
        const value = Reflect.get(target, key, target);
        if (key === "unsafe") return (...args) => {
          traces.push(args[0]); return Reflect.apply(value, target, args);
        };
        return value;
      }
    });
  }
  async function transaction(body) {
    return sql.begin(async tx => {
      await tx.unsafe("SET LOCAL statement_timeout='5s'");
      await tx.unsafe("SET LOCAL lock_timeout='1s'");
      return body(observed(tx));
    });
  }
  const exact = Object.freeze({ eventKey: input.events[0].eventKey, consumer: input.events[0].consumer });
  try {
    const who = await sql.unsafe("SELECT current_user AS role,current_database() AS database");
    assert.equal(who[0].role, input.runtimeRole);
    assert.equal(who[0].database, input.databaseName);
    if (input.mode === "public" || input.mode === "legacy" || input.mode === "contended") {
      let failure;
      try {
        await transaction(tx => input.mode === "public"
          ? db.resolveInternalProductionOperationalDeliveryTerminalAuthorityPairInTransactionV1(tx, exact)
          : projection.lockProjection(tx, exact));
      } catch (error) { failure = error; }
      assert.ok(failure, "component must never issue a terminal close capability");
      if (input.mode === "legacy") {
        assert.equal(failure.code, "42501");
        assert.match(traces.find(value => /FROM operational_events/.test(value)) ?? "", /FOR UPDATE/);
      } else if (input.mode === "contended") {
        assert.equal(failure.code, "55P03", "the exact mutable delivery must remain row-locked");
        assert.match(traces.find(value => /FROM operational_event_deliveries/.test(value)) ?? "", /FOR UPDATE/);
      } else {
        assert.equal(failure.message, "DASHBOARD_CUTOVER_ORDINARY_DATABASE_REFUSED",
          "schema-only fixture must preserve the actual public ordinary access refusal");
        assert.equal(traces.length, 0, "public refusal must precede every terminal resolver SQL statement");
      }
    } else if (input.mode === "projection") {
      for (const row of input.events.filter(row => row.state !== "pending")) {
        const key = Object.freeze({ eventKey: row.eventKey, consumer: row.consumer });
        const actual = await transaction(tx => projection.lockProjection(tx, key));
        assert.equal(Object.isFrozen(actual), true);
        assert.equal(actual.status, row.state);
        // Independent fixed DTO encodings, rather than the production hash helper.
        assert.deepEqual(actual.identity, {
          schema: "setfarm.internal-production-canonical-owner-identity.v1", category: "operational-delivery",
          ownerKey: JSON.stringify({ consumer: row.consumer, eventKey: row.eventKey, schema: "setfarm.internal-production-operational-event-key-consumer.v1" }),
          ownerRef: "setfarm://operational-event/" + row.eventKey + "/delivery/" + row.consumer,
          ownerHash: sha(JSON.stringify({ consumer: row.consumer, eventKey: row.eventKey, schema: "setfarm.internal-production-operational-delivery-owner.v1" }))
        });
        assert.equal(actual.terminalOwnerHash, sha(JSON.stringify({
          consumer: row.consumer, eventKey: row.eventKey,
          schema: "setfarm.internal-production-operational-delivery-terminal-owner.v1", status: row.state
        })));
      }
      for (const key of [
        { eventKey: input.events[3].eventKey, consumer: input.events[3].consumer },
        { eventKey: "component-terminal-absent", consumer: "webhook" },
        { eventKey: input.events[0].eventKey, consumer: "jsonl" }
      ]) {
        await assert.rejects(transaction(tx => projection.lockProjection(tx, Object.freeze(key))),
          { message: "INTERNAL_PRODUCTION_OPERATIONAL_DELIVERY_OWNER_UNAVAILABLE" });
      }
      for (const key of [
        { eventKey: input.events[0].eventKey, consumer: "invalid" },
        { eventKey: input.events[0].eventKey, consumer: "webhook", extra: true }
      ]) {
        const before = traces.length;
        await assert.rejects(transaction(tx => projection.lockProjection(tx, Object.freeze(key))));
        assert.equal(traces.length, before, "invalid owner input must fail before projection reads");
      }
    } else if (input.mode === "privileges") {
      const rights = await sql.unsafe("SELECT pg_catalog.has_any_column_privilege(current_user,'public.operational_events','UPDATE') AS update_any, pg_catalog.has_table_privilege(current_user,'public.operational_events','DELETE') AS delete_table, pg_catalog.has_table_privilege(current_user,'public.operational_events','TRUNCATE') AS truncate_table");
      assert.deepEqual([rights[0].update_any,rights[0].delete_table,rights[0].truncate_table], [false,false,false]);
      const guards = await sql.unsafe("SELECT t.tgtype::integer AS type,t.tgenabled,p.prosrc,p.prosecdef,(p.proowner=c.relowner AND o.rolname=$1 AND p.pronargs=0 AND l.lanname='plpgsql' AND t.tgnargs=0 AND octet_length(t.tgargs)=0 AND t.tgqual IS NULL AND t.tgconstraint=0 AND NOT t.tgdeferrable AND NOT t.tginitdeferred) AS valid FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace JOIN pg_catalog.pg_proc p ON p.oid=t.tgfoid JOIN pg_catalog.pg_roles o ON o.oid=c.relowner JOIN pg_catalog.pg_language l ON l.oid=p.prolang WHERE n.nspname='public' AND c.relname='operational_events' AND t.tgname='trg_operational_events_immutable' AND NOT t.tgisinternal", [input.ownerRole]);
      assert.equal(guards.length,1);
      assert.deepEqual([guards[0].type,guards[0].tgenabled,guards[0].prosecdef,guards[0].valid],[27,"O",false,true]);
      assert.match(guards[0].prosrc, /RAISE EXCEPTION 'OPERATIONAL_EVENT_IMMUTABLE'/);
      for (const statement of [
        "UPDATE public.operational_events SET payload=payload WHERE event_key=$1",
        "DELETE FROM public.operational_events WHERE event_key=$1",
        "TRUNCATE TABLE public.operational_events",
        "SET session_replication_role='replica'"
      ]) {
        let code;
        try { await sql.unsafe(statement, statement.includes("$1") ? [exact.eventKey] : []); }
        catch (error) { code=error.code; }
        assert.equal(code,"42501","immutable DML/replication bypass must stay denied");
      }
      const retained=await sql.unsafe("SELECT event_hash FROM operational_events WHERE event_key=$1",[exact.eventKey]);
      assert.equal(retained[0].event_hash,"a".repeat(64));
    } else { assert.fail("unrecognized fixed component mode"); }
    console.log("OPERATIONAL_TERMINAL_COMPONENT_CHECKED:" + input.mode);
  } finally { await sql.end({ timeout: 3 }); }
`;

test("fresh operational terminal reads preserve owner authority and mutable locking without immutable UPDATE", { timeout: 180_000 }, async t => {
  const installation = await create(t);
  await installation.initialize();
  const fixture = await freshSourceCheckoutFixture();
  const protection = await import(pathToFileURL(path.join(fixture.root, "src/installation/fresh-installation-provenance-v1.ts")).href);
  const business = await import(pathToFileURL(path.join(fixture.root, "src/installation/fresh-installation-runtime-grants-v1.ts")).href);
  const adminUrl = new URL(freshTestAdminUrl); adminUrl.pathname = "/" + installation.databaseName;
  const control = postgres(adminUrl.href, { max: 1, connect_timeout: 3, onnotice() {} });
  try {
    // Owned schema-only fixture, following the maintained immutable-lock test.
    // Installing component grants is not compiled activation or readiness.
    await control.begin(async tx => {
      await tx.unsafe(`SET LOCAL ROLE "${installation.ownerRole}"`);
      await protection.installFreshInstallationProvenanceProtectionV1(tx, installation.runtimeRole);
      await business.installFreshInstallationRuntimeBusinessGrantsV1(tx, installation.runtimeRole);
      for (const [index, row] of EVENTS.entries()) {
        const outboxId = "component-terminal-outbox-" + index;
        await tx`INSERT INTO operational_outbox(outbox_id,event_key,event_type,aggregate_type,aggregate_id,payload,state,published_at)
          VALUES(${outboxId},${row.eventKey},'component','component','component-terminal','{}'::jsonb,'published',NOW())`;
        await tx`INSERT INTO operational_events(event_key,outbox_id,event_type,aggregate_type,aggregate_id,run_id,payload,event_hash,source_created_at,committed_at)
          VALUES(${row.eventKey},${outboxId},'component','component','component-terminal','component-terminal',
            '{"schema":"setfarm.operational-terminal-test-component.v1"}'::jsonb,${"a".repeat(64)},NOW(),NOW())`;
        await tx`INSERT INTO operational_event_deliveries(event_key,consumer,delivery_id,input_hash,idempotency_key,state,attempt_count,delivered_at,diagnostic,result)
          VALUES(${row.eventKey},${row.consumer},${"OED_" + String(index+1).padStart(64,"0")},${"b".repeat(64)},${row.eventKey},${row.state},1,
            ${row.state === "delivered" || row.state === "skipped" ? new Date() : null},
            ${row.state === "quarantined" ? "component quarantine" : null},'{}'::jsonb)`;
      }
    });
    const environment = { ...process.env };
    for (const key of Object.keys(environment)) {
      if (key.startsWith("SETFARM_") || key.startsWith("OPENCLAW_")
        || ["DATABASE_URL","PGHOST","PGPORT","PGUSER","PGPASSWORD","PGDATABASE","PROJECTS_DIR","SCRIPTS_DIR","CLI_PATH"].includes(key)) delete environment[key];
    }
    const projectionSource = exactProjectionSource(fixture.root);
    const run = (mode: string, selected = true) => {
      const input = { mode, selected, root: fixture.root, directory: installation.directory,
        runtimeRole: installation.runtimeRole, ownerRole: installation.ownerRole,
        databaseName: installation.databaseName, events: EVENTS, projectionSource };
      const child = spawnSync(process.execPath, ["--import", import.meta.resolve("tsx"), "--input-type=module", "-e", "const input=" + JSON.stringify(input) + ";\n" + CHILD], {
        cwd: fixture.root, env: selected ? { ...environment, SETFARM_INSTALLATION_DIR: installation.directory } : environment,
        encoding: "utf8", timeout: 30_000, maxBuffer: 65_536,
      });
      assert.equal(child.error,undefined,"component child exceeded its declared boundary");
      assert.equal(child.signal,null);
      assert.equal(child.status,0,child.stderr);
      assert.equal(child.stdout,"OPERATIONAL_TERMINAL_COMPONENT_CHECKED:"+mode+"\n");
    };
    await t.test("actual public resolver retains its pre-SQL schema-only access refusal", () => run("public"));
    await t.test("actual whole projection preserves all terminal identities hashes and guards", () => run("projection"));
    await t.test("legacy whole projection retains immutable lock refusal", () => run("legacy", false));
    await t.test("immutable mutation and replication privileges remain absent", () => run("privileges"));
    await t.test("actual whole projection still contends on the mutable delivery row", async () => {
      let ready!: () => void, release!: () => void;
      const acquired = new Promise<void>(resolve => { ready = resolve; });
      const released = new Promise<void>(resolve => { release = resolve; });
      const holding = control.begin(async tx => {
        await tx.unsafe(`SET LOCAL ROLE "${installation.ownerRole}"`);
        await tx.unsafe("SET LOCAL idle_in_transaction_session_timeout='45s'");
        await tx`SELECT event_key FROM operational_event_deliveries
          WHERE event_key=${EVENTS[0].eventKey} AND consumer=${EVENTS[0].consumer} FOR UPDATE`;
        ready();
        await released;
      });
      // Fail the waiter too if acquisition itself fails; no hanging ready promise.
      await Promise.race([acquired, holding.then(() => { throw new Error("delivery lock ended before acquisition"); })]);
      try { run("contended"); }
      finally { release(); await holding; }
    });
    const count = await control`SELECT count(*)::integer AS count FROM internal_production_owner_reservations_v1 WHERE category='operational-delivery'`;
    assert.equal(count[0]!.count,0,"test must not mint owner reservation or terminal authority");
  } finally { await control.end({ timeout: 3 }); }
});
