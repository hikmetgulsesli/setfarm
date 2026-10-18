import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import postgres from "postgres";
import ts from "typescript";
import { createFreshInstallationTestFixtureV1 as create, freshTestAdminUrl } from "./fresh-installation-test-support.js";
import { freshSourceCheckoutFixture } from "./fresh-source-checkout-fixture.js";

const ABSENT_HASH = "0".repeat(64);
const QUERIES = [
  { id: "published-event", file: "src/execution/operational-outbox-repository.ts",
    marker: "SELECT * FROM operational_events WHERE event_key = $1 FOR UPDATE", args: ["component-event-absent"] },
  { id: "delivery-event", file: "src/execution/operational-event-delivery-repository.ts",
    marker: "SELECT * FROM operational_events WHERE event_key=$1 FOR UPDATE", args: ["component-event-absent"] },
  { id: "expired-events", file: "src/execution/operational-event-delivery-repository.ts",
    marker: "FOR UPDATE OF event SKIP LOCKED", args: ["jsonl"] },
  { id: "claim-subject-binding", file: "src/execution/v3-story-claim-runtime-binding-v1.ts",
    marker: "FOR UPDATE OF binding, claim, runtime, step", args: ["0", "RTS_COMPONENT_ABSENT"] },
  { id: "supervisor-binding", file: "src/installer/step-ops.ts",
    marker: "FOR UPDATE OF binding, runtime, story",
    args: ["RTS_COMPONENT_ABSENT", "component-run-absent", "component-step-absent", "component-story-absent", "component-story"] },
  // Match the old lock-bearing branch, including its lock clause. Matching
  // only a shared SELECT prefix would find duplicate source expressions.
  { id: "compiler-batch-items", file: "src/product-compiler/artifact-index.ts",
    marker: "SELECT * FROM artifact_publication_batch_items WHERE batch_reservation_id = $1 ORDER BY ordinal FOR UPDATE",
    args: ["component-batch-absent"], immutableRead: true, legacyLock: "FOR UPDATE" },
  { id: "compiler-batch-plan", file: "src/product-compiler/artifact-index.ts",
    marker: "SELECT * FROM artifact_publication_batch_plans WHERE batch_reservation_id = $1 FOR UPDATE",
    args: ["component-batch-absent"], immutableRead: true, legacyLock: "FOR UPDATE" },
  { id: "compiler-batch-plan-items", file: "src/product-compiler/artifact-index.ts",
    marker: "SELECT * FROM artifact_publication_batch_plan_items WHERE batch_reservation_id = $1 ORDER BY ordinal FOR UPDATE",
    args: ["component-batch-absent"], immutableRead: true, legacyLock: "FOR UPDATE" },
  { id: "compiler-semantic-index", file: "src/product-compiler/artifact-index.ts",
    marker: "SELECT * FROM semantic_artifacts ORDER BY artifact_hash FOR UPDATE",
    args: [], immutableRead: true, legacyLock: "FOR UPDATE" },
  { id: "compiler-evidence-replay", file: "src/recovery/v3-downstream-evidence-publication.ts",
    marker: "SELECT payload FROM evidence_bundles WHERE evidence_bundle_hash = $1 FOR KEY SHARE",
    args: [ABSENT_HASH], immutableRead: true, legacyLock: "FOR KEY SHARE" },
  { id: "compiler-finding-parent", file: "src/recovery/v3-downstream-evidence-publication.ts",
    marker: "SELECT * FROM finding_sets WHERE finding_set_hash=$1 FOR UPDATE",
    args: [ABSENT_HASH], immutableRead: true, legacyLock: "FOR UPDATE" },
  { id: "compiler-finding-children", file: "src/recovery/v3-downstream-evidence-publication.ts",
    marker: "FROM findings WHERE finding_set_hash=$1 ORDER BY array_position($2::text[],finding_id),finding_id FOR UPDATE",
    args: [ABSENT_HASH, ["FIND_" + ABSENT_HASH]], immutableRead: true, legacyLock: "FOR UPDATE" },
  { id: "compiler-accepted-evidence", file: "src/evidence/accepted-candidate-repository.ts",
    marker: "FROM evidence_bundles WHERE evidence_bundle_hash = $1 FOR SHARE",
    args: [ABSENT_HASH], immutableRead: true, legacyLock: "FOR SHARE" },
  { id: "compiler-accepted-replay", file: "src/evidence/accepted-candidate-repository.ts",
    marker: "SELECT payload FROM accepted_candidates WHERE run_id = $1 FOR SHARE",
    args: ["component-run-absent"], immutableRead: true, legacyLock: "FOR SHARE" },
  { id: "terminal-accepted-candidate", file: "src/execution/run-terminal-transition.ts",
    marker: "SELECT payload FROM accepted_candidates WHERE candidate_hash = $1 AND run_id = $2 LIMIT 1 FOR SHARE",
    args: [ABSENT_HASH, "component-run-absent"], immutableRead: true, legacyLock: "FOR SHARE" },
  { id: "claim-packet-owner", file: "src/execution/claim-runtime-publication.ts",
    marker: "SELECT packet_hash FROM product_packets WHERE run_id = $1 AND packet_hash = $2 FOR KEY SHARE",
    args: ["component-run-absent", ABSENT_HASH], immutableRead: true, legacyLock: "FOR KEY SHARE" },
  { id: "run-release-admission", file: "src/execution/run-persistence.ts",
    marker: "FROM v3_release_admissions WHERE admission_hash = $1 FOR SHARE",
    args: [ABSENT_HASH], immutableRead: true, legacyLock: "FOR SHARE" },
  { id: "retry-auth-supervisor-binding", file: "src/execution/claim-runtime-publication.ts",
    ownerFunction: "loadAuthenticatedV3SupervisorRetryPreparationSourceV1",
    marker: "FOR UPDATE OF binding, claim, runtime, completion",
    args: ["0", "RTS_COMPONENT_ABSENT", "component-run-absent", "component-story-absent", "component-story", 0, ABSENT_HASH],
    selectedLock: "FOR UPDATE OF claim, runtime, completion", legacyLock: "FOR UPDATE OF binding, claim, runtime, completion" },
  { id: "retry-auth-preparation-binding", file: "src/execution/claim-runtime-publication.ts",
    ownerFunction: "loadAuthenticatedV3SupervisorRetryPreparationSourceV1",
    marker: "FOR UPDATE OF preparation, claim, binding, runtime, completion",
    args: ["component-run-absent", "component-step", "component-story", "component-step-absent", "component-story-absent", 0],
    selectedLock: "FOR UPDATE OF preparation, claim, runtime, completion", legacyLock: "FOR UPDATE OF preparation, claim, binding, runtime, completion" },
  { id: "normal-claim-unsettled-supervision", file: "src/execution/claim-runtime-publication.ts",
    ownerFunction: "publishLoopClaimRuntime",
    marker: "FOR UPDATE OF binding, runtime",
    args: ["component-run-absent", "component-story-absent", "component-story", 0],
    selectedLock: "FOR UPDATE OF runtime", legacyLock: "FOR UPDATE OF binding, runtime" },
  { id: "normal-claim-exact-supervisor", file: "src/execution/claim-runtime-publication.ts",
    ownerFunction: "publishLoopClaimRuntime",
    marker: "FOR UPDATE OF binding, claim, runtime, completion",
    args: ["0", "RTS_COMPONENT_ABSENT", "component-run-absent", "component-story-absent", "component-story", 0, ABSENT_HASH],
    selectedLock: "FOR UPDATE OF claim, runtime, completion", legacyLock: "FOR UPDATE OF binding, claim, runtime, completion" },
] as const;

function normalizedSqlSource(value: string): string { return value.replace(/\s+/g, " ").trim(); }

type SqlMarkerInput = Readonly<{ id: string; file: string; marker: string; ownerFunction?: string }>;
function inNamedFunction(node: ts.Node, name: string | undefined): boolean {
  if (name === undefined) return true;
  for (let current: ts.Node | undefined = node.parent; current; current = current.parent) {
    if (ts.isFunctionDeclaration(current) && current.name?.text === name) return true;
  }
  return false;
}

function matchingSqlArguments(root: string, input: SqlMarkerInput): readonly string[] {
  const file = path.join(root, input.file), text = readFileSync(file, "utf8");
  const tree = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const matches: ts.Expression[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
      && node.expression.name.text === "unsafe" && node.arguments[0]
      && inNamedFunction(node, input.ownerFunction)
      && normalizedSqlSource(node.arguments[0].getText(tree)).includes(normalizedSqlSource(input.marker))) matches.push(node.arguments[0]);
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return matches.map(node => node.getText(tree));
}

function exactSqlArgument(root: string, input: SqlMarkerInput): string {
  const matches = matchingSqlArguments(root, input);
  assert.equal(matches.length, 1, `exact production SQL argument must be unique: ${input.id}`);
  return matches[0]!;
}

// Census every remaining row-lock-bearing SQL argument in the six patched
// compiler/lifecycle files. Only exact QUERIES corrections are excluded; each
// mixed corrected join separately proves that all mutable aliases stay locked.
// The two identical supervisor queries are scoped to their named functions and
// remain individually unique in the real PG component.
const OTHER_COMPILER_LOCK_COUNTS = [
  ["src/product-compiler/artifact-index.ts", 15],
  ["src/recovery/v3-downstream-evidence-publication.ts", 6],
  ["src/evidence/accepted-candidate-repository.ts", 3],
  ["src/execution/claim-runtime-publication.ts", 30],
  ["src/execution/run-persistence.ts", 9],
  ["src/execution/run-terminal-transition.ts", 14],
] as const;

function otherCompilerLockArguments(root: string, relative: string): readonly string[] {
  const file = path.join(root, relative), text = readFileSync(file, "utf8");
  const tree = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const matches: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
      && node.expression.name.text === "unsafe" && node.arguments[0]) {
      const expression = normalizedSqlSource(node.arguments[0].getText(tree));
      const isImmutableCorrection = QUERIES.some(input => input.file === relative && expression.includes(normalizedSqlSource(input.marker)));
      if (!isImmutableCorrection && /\bFOR\s+(?:UPDATE|NO\s+KEY\s+UPDATE|SHARE|KEY\s+SHARE)\b/i.test(expression)) {
        matches.push(expression);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return matches;
}


const MUTABLE_LOCKS = [
  { id: "batch-owner", file: "src/product-compiler/artifact-index.ts",
    marker: "SELECT * FROM artifact_publication_batches WHERE batch_reservation_id = $1 FOR UPDATE", expectedMatches: 2 },
  { id: "batch-reservations", file: "src/product-compiler/artifact-index.ts",
    marker: "SELECT * FROM artifact_publication_reservations WHERE reservation_id = ANY($1::text[]) ORDER BY reservation_id FOR UPDATE", expectedMatches: 3 },
  { id: "artifact-capacity", file: "src/product-compiler/artifact-index.ts",
    marker: "SELECT * FROM artifact_capacity WHERE capacity_key = 'semantic-artifacts' FOR UPDATE", expectedMatches: 1 },
  { id: "finding-run-owner", file: "src/recovery/v3-downstream-evidence-publication.ts",
    marker: "SELECT id FROM runs WHERE id = $1 FOR UPDATE", expectedMatches: 1 },
  { id: "finding-termination-owner", file: "src/recovery/v3-downstream-evidence-publication.ts",
    marker: "ORDER BY requested_at, request_id LIMIT 1 FOR UPDATE", expectedMatches: 1 },
  { id: "finding-story-owner", file: "src/recovery/v3-downstream-evidence-publication.ts",
    marker: "FOR UPDATE OF run_row, step_row, story_row, parent_claim", expectedMatches: 1 },
  { id: "finding-attempt-owner", file: "src/recovery/v3-downstream-evidence-publication.ts",
    marker: "FOR UPDATE OF attempt, child_claim, parent_claim, run_row, step_row, story_row", expectedMatches: 1 },
  { id: "accepted-run-owner", file: "src/evidence/accepted-candidate-repository.ts",
    marker: "FROM runs WHERE id = $1 FOR UPDATE", expectedMatches: 1 },
  { id: "accepted-story-owner", file: "src/evidence/accepted-candidate-repository.ts",
    marker: "AND story_id NOT LIKE 'QA-FIX-%' ORDER BY story_id FOR UPDATE", expectedMatches: 1 },
  { id: "accepted-attempt-owner", file: "src/evidence/accepted-candidate-repository.ts",
    marker: "FROM execution_attempts WHERE attempt_id = $1 FOR SHARE", expectedMatches: 1 },
] as const;

test("compiler immutable-read correction retains mutable owner and capacity lock arguments", async () => {
  const fixture = await freshSourceCheckoutFixture();
  for (const [file, expectedCount] of OTHER_COMPILER_LOCK_COUNTS) {
    const expressions = otherCompilerLockArguments(fixture.root, file);
    assert.equal(expressions.length, expectedCount, `complete remaining row-lock census changed: ${file}`);
    for (const expression of expressions) assert.doesNotMatch(expression, /selectedFreshInstallationRootV1/,
      `remaining mutable lock must be unconditional: ${file}`);
  }
  for (const input of MUTABLE_LOCKS) {
    const expressions = matchingSqlArguments(fixture.root, input);
    assert.equal(expressions.length, input.expectedMatches,
      `complete fixed mutable SQL argument census changed: ${input.id}`);
    for (const expression of expressions) assert.doesNotMatch(expression, /selectedFreshInstallationRootV1/,
      `mutable SQL must not acquire a selected unlocked alternative: ${input.id}`);
  }
});

test("selected event, claim and compiler immutable reads retain mutable locks without immutable UPDATE rights", { timeout: 120_000 }, async t => {
  const installation = await create(t);
  await installation.initialize();
  const fixture = await freshSourceCheckoutFixture();
  const protection = await import(pathToFileURL(path.join(fixture.root, "src/installation/fresh-installation-provenance-v1.ts")).href);
  const business = await import(pathToFileURL(path.join(fixture.root, "src/installation/fresh-installation-runtime-grants-v1.ts")).href);
  const adminUrl = new URL(freshTestAdminUrl); adminUrl.pathname = "/" + installation.databaseName;
  const control = postgres(adminUrl.href, { max: 1, connect_timeout: 3, onnotice() {} });
  try {
    // Component-only owned schema transaction; not the compiled activation API.
    await control.begin(async tx => {
      await tx.unsafe(`SET LOCAL ROLE "${installation.ownerRole}"`);
      await protection.installFreshInstallationProvenanceProtectionV1(tx, installation.runtimeRole);
      await business.installFreshInstallationRuntimeBusinessGrantsV1(tx, installation.runtimeRole);
    });
  } finally { await control.end({ timeout: 3 }); }

  assert.equal(QUERIES.length, 21);
  assert.equal(QUERIES.filter(input => "immutableRead" in input).length, 12);
  assert.equal(QUERIES.filter(input => "selectedLock" in input).length, 4);
  const queries = QUERIES.map(input => ({ ...input, expression: exactSqlArgument(fixture.root, input) }));
  for (const selected of [true, false]) {
    const environment = { ...process.env };
    for (const key of Object.keys(environment)) {
      if (key.startsWith("SETFARM_") || key.startsWith("OPENCLAW_")
        || ["DATABASE_URL", "PGHOST", "PGPORT", "PGUSER", "PGPASSWORD", "PGDATABASE", "PROJECTS_DIR", "SCRIPTS_DIR", "CLI_PATH"].includes(key)) delete environment[key];
    }
    if (selected) environment.SETFARM_INSTALLATION_DIR = installation.directory;
    const script = `
      import assert from "node:assert/strict";
      import { readFileSync } from "node:fs";
      import vm from "node:vm";
      import postgres from "postgres";
      const root=${JSON.stringify(fixture.root)}, directory=${JSON.stringify(installation.directory)};
      const selected=${JSON.stringify(selected)}, queries=${JSON.stringify(queries)};
      const leaf=await import(root+"/src/installation/fresh-installation-selection-v1.ts");
      assert.equal(leaf.selectedFreshInstallationRootV1()!==null,selected);
      const credential=JSON.parse(readFileSync(directory+"/runtime-credentials.json","utf8"));
      const sql=postgres(credential.runtimeUrl,{max:1,connect_timeout:3,onnotice(){}});
      const failures=[];
      try {
        const who=await sql.unsafe("SELECT current_user AS role,current_database() AS database");
        assert.equal(who[0].role,${JSON.stringify(installation.runtimeRole)});
        assert.equal(who[0].database,${JSON.stringify(installation.databaseName)});
        for(const query of queries){
          // Only the source-owned SQL argument expression is evaluated. The
          // selector is the real leaf function, never a supplied boolean port.
          const statement=vm.runInNewContext("( "+query.expression+" )",{
            selectedFreshInstallationRootV1:leaf.selectedFreshInstallationRootV1
          },{timeout:1000});
          assert.equal(typeof statement,"string");
          if(query.immutableRead){
            if(selected) assert.doesNotMatch(statement,/\\bFOR\\s+(?:UPDATE|NO\\s+KEY\\s+UPDATE|SHARE|KEY\\s+SHARE)\\b/i,
              "selected immutable compiler query must not retain a row lock: "+query.id);
            else assert.ok(statement.includes(query.legacyLock),"legacy lock clause changed: "+query.id);
          }
          if(query.selectedLock){
            if(selected){
              assert.equal(statement.match(/\\bFOR\\s+UPDATE\\s+OF\\s+[^\\r\\n]+/i)?.[0]?.trim(),query.selectedLock,
                "mutable join lock targets must be exact: "+query.id);
              assert.doesNotMatch(statement,/FOR UPDATE OF[^\\r\\n]*\\bbinding\\b/i);
            }else assert.ok(statement.includes(query.legacyLock),"legacy mixed join lock changed: "+query.id);
          }
          let code=null,rows;
          try{rows=await sql.unsafe(statement,query.args);}catch(error){code=error?.code??"NON_PG_ERROR";}
          if(selected){
            if(code!==null)failures.push({id:query.id,code});
            else assert.equal(rows.length,0,"component must not fabricate any workflow/event row");
          }else if(code!=="42501")failures.push({id:query.id,code:code??"UNEXPECTED_SUCCESS"});
          if(query.id==="claim-subject-binding"&&selected){
            assert.match(statement,/FOR UPDATE OF claim, runtime, step/);
            assert.doesNotMatch(statement,/FOR UPDATE OF binding/);
          }
          if(query.id==="supervisor-binding"&&selected){
            assert.match(statement,/FOR UPDATE OF runtime, story/);
            assert.doesNotMatch(statement,/FOR UPDATE OF binding/);
          }
        }
        assert.deepEqual(failures,[],"genuine immutable-lock permission behavior disagrees");
        // These twelve immutable tables exclude the two separately tested
        // migration25 timestamp-only KEY SHARE privilege exceptions.
        for(const [table,column] of [
          ["operational_events","payload"], ["v3_story_claim_runtime_bindings_v1","bound_at"],
          ["artifact_publication_batch_items","artifact_hash"], ["artifact_publication_batch_plans","plan_identity_hash"],
          ["artifact_publication_batch_plan_items","artifact_hash"], ["semantic_artifacts","artifact_hash"],
          ["evidence_bundles","payload"], ["finding_sets","payload"], ["findings","payload"],
          ["accepted_candidates","payload"], ["product_packets","packet_hash"],
          ["v3_release_admissions","payload"]
        ]){
          const rights=await sql.unsafe(
            "SELECT pg_catalog.has_any_column_privilege(current_user,$1::text,'UPDATE') AS update_any,"+
            "pg_catalog.has_table_privilege(current_user,$1::text,'DELETE') AS delete_table,"+
            "pg_catalog.has_table_privilege(current_user,$1::text,'TRUNCATE') AS truncate_table",
            ["public."+table]);
          assert.equal(rights.length,1);
          assert.equal(rights[0].update_any,false,"no immutable column may become UPDATE-capable: "+table);
          assert.equal(rights[0].delete_table,false);
          assert.equal(rights[0].truncate_table,false);
          for(const statement of [
            "UPDATE public."+table+" SET "+column+"="+column+" WHERE FALSE",
            "DELETE FROM public."+table+" WHERE FALSE",
            "TRUNCATE TABLE public."+table
          ]){
            let code=null;try{await sql.unsafe(statement);}catch(error){code=error?.code??"NON_PG_ERROR";}
            assert.equal(code,"42501","immutable mutation privilege must remain absent");
          }
        }
        console.log("IMMUTABLE_SQL_COMPONENT_CHECKED");
      }finally{await sql.end({timeout:3});}
    `;
    const child = spawnSync(process.execPath, ["--import", import.meta.resolve("tsx"), "--input-type=module", "-e", script], {
      cwd: fixture.root, env: environment, encoding: "utf8", timeout: 30_000, maxBuffer: 65_536,
    });
    assert.equal(child.error, undefined, "SQL component child exceeded its bound");
    assert.equal(child.signal, null);
    assert.equal(child.status, 0, child.stderr);
    assert.equal(child.stdout, "IMMUTABLE_SQL_COMPONENT_CHECKED\n");
  }
  // No activation/ready evidence, business run, claim or event has been created.
});
