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

type ReadSpec = Readonly<{ id: string; file: string; fn?: string; variable: string; config?: string }>;
const READS: readonly ReadSpec[] = [
  { id: "publication-before-parent", file: "src/recovery/finding-recovery-repository.ts", fn: "publishFindingSetWithOwnerInTransactionV1", variable: "beforeParents" },
  { id: "publication-before-children", file: "src/recovery/finding-recovery-repository.ts", fn: "publishFindingSetWithOwnerInTransactionV1", variable: "beforeChildren" },
  { id: "publication-after-parent", file: "src/recovery/finding-recovery-repository.ts", fn: "publishFindingSetWithOwnerInTransactionV1", variable: "parents" },
  { id: "publication-after-children", file: "src/recovery/finding-recovery-repository.ts", fn: "publishFindingSetWithOwnerInTransactionV1", variable: "children" },
  { id: "terminal-parent", file: "src/db-pg.ts", config: "FINDING_TERMINAL_RESOLVER_CONFIG_V1", variable: "sets" },
  { id: "terminal-children", file: "src/db-pg.ts", config: "FINDING_TERMINAL_RESOLVER_CONFIG_V1", variable: "children" },
];

function ancestor(node: ts.Node, predicate: (node: ts.Node) => boolean): boolean {
  for (let current = node.parent; current; current = current.parent) if (predicate(current)) return true;
  return false;
}
function readInitializer(root: string, spec: ReadSpec): string {
  const file = path.join(root, spec.file), source = readFileSync(file, "utf8");
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const matches: ts.Expression[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === spec.variable && node.initializer
      && (!spec.fn || ancestor(node, n => ts.isFunctionDeclaration(n) && n.name?.text === spec.fn))
      && (!spec.config || ancestor(node, n => ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === spec.config))) {
      matches.push(node.initializer);
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  assert.equal(matches.length, 1, `exact Source initializer: ${spec.id}`);
  return matches[0]!.getText(tree);
}
function projectionArrow(root: string): string {
  const file = path.join(root, "src/db-pg.ts"), source = readFileSync(file, "utf8");
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const matches: ts.ArrowFunction[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isPropertyAssignment(node) && ts.isIdentifier(node.name) && node.name.text === "lockProjection"
      && ts.isArrowFunction(node.initializer)
      && ancestor(node, n => ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === "FINDING_TERMINAL_RESOLVER_CONFIG_V1")) {
      matches.push(node.initializer);
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  assert.equal(matches.length, 1, "full finding projection must be unique");
  return matches[0]!.getText(tree);
}

test("fresh finding normal-publication and terminal reads need no immutable UPDATE privilege", { timeout: 120_000 }, async t => {
  const installation = await create(t);
  await installation.initialize();
  const fixture = await freshSourceCheckoutFixture();
  const protection = await import(pathToFileURL(path.join(fixture.root, "src/installation/fresh-installation-provenance-v1.ts")).href);
  const business = await import(pathToFileURL(path.join(fixture.root, "src/installation/fresh-installation-runtime-grants-v1.ts")).href);
  const findingApi = await import(pathToFileURL(path.join(fixture.root, "src/findings/finding-set.ts")).href);
  const canonical = await import(pathToFileURL(path.join(fixture.root, "src/product-compiler/canonical-json.ts")).href);
  const makeFindingSet = (suffix: string, count: number) => findingApi.createFindingSetV1({
    runId: "component-finding-terminal-" + suffix, storyId: "COMPONENT-001", packetHash: "a".repeat(64), sliceHash: "b".repeat(64),
    sourceRevision: { sha: fixture.sha, treeHash: "2".repeat(40) },
    findings: Array.from({ length: count }, (_, i) => ({
      origin: "runtime", classification: "structured", invariantRef: "INV_COMPONENT_" + (i === 0 ? "ONE" : "TWO"),
      sourceLocators: [{ path: "src/component.ts", contentHash: "d".repeat(64) }], observedEvidenceRefs: ["c".repeat(64)],
      expectedPredicateRef: "EVID_COMPONENT", status: "open",
    })),
  });
  // Explicit component DTOs, not business runs or admitted owner sidecars.
  const complete = makeFindingSet("complete", 1), incomplete = makeFindingSet("incomplete", 2);
  const adminUrl = new URL(freshTestAdminUrl); adminUrl.pathname = "/" + installation.databaseName;
  const control = postgres(adminUrl.href, { max: 1, connect_timeout: 3, onnotice() {} });
  try {
    await control.begin(async tx => {
      await tx.unsafe(`SET LOCAL ROLE "${installation.ownerRole}"`);
      await protection.installFreshInstallationProvenanceProtectionV1(tx, installation.runtimeRole);
      await business.installFreshInstallationRuntimeBusinessGrantsV1(tx, installation.runtimeRole);
      for (const value of [complete, incomplete]) {
        await tx.unsafe(`INSERT INTO finding_sets (
          finding_set_hash,finding_set_id,run_id,story_id,packet_hash,slice_hash,source_sha,source_tree_hash,finding_ids,payload
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::text::jsonb,$10::text::jsonb)`, [
          value.findingSetHash, value.findingSetId, value.runId, value.storyId, value.packetHash, value.sliceHash,
          value.sourceRevision.sha, value.sourceRevision.treeHash,
          JSON.stringify(value.findings.map((f: { findingId: string }) => f.findingId)), JSON.stringify(value),
        ]);
        // The second component intentionally has an incomplete child set; the
        // genuine publication validator must refuse it without repairing it.
        for (const finding of value.findings.slice(0, 1)) {
          await tx.unsafe(`INSERT INTO findings (
            finding_set_hash,finding_id,origin,classification,invariant_ref,status,source_fingerprint,payload
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::text::jsonb)`, [
            value.findingSetHash, finding.findingId, finding.origin, finding.classification, finding.invariantRef,
            finding.status, canonical.hashCanonicalJson(finding.sourceLocators), JSON.stringify(finding),
          ]);
        }
      }
    });
  } finally { await control.end({ timeout: 3 }); }
  const initializers = READS.map(spec => ({ id: spec.id, expression: readInitializer(fixture.root, spec),
    expectRows: /parent/.test(spec.id) ? 1 : complete.findings.length }));
  const projection = projectionArrow(fixture.root);
  const migration = readFileSync(path.join(fixture.root, "src/db/contract-spine-migrations.ts"), "utf8");
  const immutableBody = migration.match(/CREATE FUNCTION setfarm_forbid_artifact_identity_update\(\) RETURNS trigger[\s\S]*?AS \$\$([\s\S]*?)\$\$/)?.[1];
  assert.ok(immutableBody, "canonical immutability function body must be found");
  for (const selected of [true, false]) {
    const environment = { ...process.env };
    for (const key of Object.keys(environment)) {
      if (key.startsWith("SETFARM_") || key.startsWith("OPENCLAW_") || ["DATABASE_URL", "PGHOST", "PGPORT", "PGUSER", "PGPASSWORD", "PGDATABASE", "PROJECTS_DIR", "SCRIPTS_DIR", "CLI_PATH", "NODE_OPTIONS"].includes(key)) delete environment[key];
    }
    if (selected) environment.SETFARM_INSTALLATION_DIR = installation.directory;
    const script = `
      import assert from 'node:assert/strict';
      import {readFileSync} from 'node:fs';
      import postgres from 'postgres';
      import ts from 'typescript';
      const root=${JSON.stringify(fixture.root)}, selected=${JSON.stringify(selected)};
      const value=${JSON.stringify(complete)}, incomplete=${JSON.stringify(incomplete)};
      const expressions=${JSON.stringify(initializers)}, projectionSource=${JSON.stringify(projection)};
      const leaf=await import(root+'/src/installation/fresh-installation-selection-v1.ts');
      assert.equal(leaf.selectedFreshInstallationRootV1()!==null,selected);
      const owner=await import(root+'/src/internal-production/owner-admission-v1.ts');
      const publication=await import(root+'/src/findings/finding-publication-v1.ts');
      const canonical=await import(root+'/src/product-compiler/canonical-json.ts');
      const db=await import(root+'/src/db-pg.ts');
      const credential=JSON.parse(readFileSync(${JSON.stringify(installation.directory)}+'/runtime-credentials.json','utf8'));
      const sql=postgres(credential.runtimeUrl,{max:1,connect_timeout:3,onnotice(){}});
      const globals={selectedFreshInstallationRootV1:leaf.selectedFreshInstallationRootV1,
        createInternalProductionFindingCanonicalOwnerIdentityV1:owner.createInternalProductionFindingCanonicalOwnerIdentityV1,
        requireFindingPublicationV1:publication.requireFindingPublicationV1,hashCanonicalJson:canonical.hashCanonicalJson};
      const compile=(source)=>new Function(...Object.keys(globals),
        ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText+';return read;')(...Object.values(globals));
      const failures=[];
      try{
        const who=await sql.unsafe('SELECT current_user AS role,current_database() AS database');
        assert.equal(who[0].role,${JSON.stringify(installation.runtimeRole)});
        assert.equal(who[0].database,${JSON.stringify(installation.databaseName)});
        await sql.unsafe("SET statement_timeout='2000ms'");
        await sql.unsafe("SET lock_timeout='1000ms'");
        const identity=owner.createInternalProductionFindingCanonicalOwnerIdentityV1({findingSetHash:value.findingSetHash});
        // These six exact initializer SQL components intentionally use autocommit;
        // the public API and complete projection below use owned transactions.
        for(const spec of expressions){
          const read=compile('async function read(sql,transaction,findingSet,expectedIds,identity){return '+spec.expression+';}');
          let result,code=null;
          try{result=await read(sql,sql,value,value.findings.map(f=>f.findingId),identity);}catch(error){code=error?.code??'NON_PG_ERROR';}
          if(selected){if(code!==null)failures.push({id:spec.id,code});else assert.equal(result.length,spec.expectRows);}
          else if(code!=='42501')failures.push({id:spec.id,code:code??'UNEXPECTED_SUCCESS'});
        }
        const readProjection=compile('const read='+projectionSource+';');
        const runProjection=input=>sql.begin(tx=>readProjection(tx,input));
        if(selected){
          let publicError;try{await sql.begin(tx=>db.resolveInternalProductionFindingTerminalAuthorityPairInTransactionV1(tx,{findingSetHash:value.findingSetHash}));}catch(error){publicError=error;}
          if(publicError?.message!=='INTERNAL_PRODUCTION_FINDING_OWNER_UNAVAILABLE') failures.push({id:'public-boundary',code:publicError?.code??publicError?.message??'UNEXPECTED_SUCCESS'});
          if(failures.length===0){
            const result=await runProjection({findingSetHash:value.findingSetHash});
            assert.equal(result.status,'published');assert.deepEqual(result.identity,identity);
            assert.equal(result.terminalOwnerHash,canonical.hashCanonicalJson({schema:'setfarm.internal-production-finding-terminal-owner.v1',findingSetHash:value.findingSetHash,status:'published'}));
            await assert.rejects(runProjection({findingSetHash:incomplete.findingSetHash}),/INTERNAL_PRODUCTION_FINDING_OWNER_UNAVAILABLE/);
            await assert.rejects(runProjection({findingSetHash:'0'.repeat(64)}),/INTERNAL_PRODUCTION_FINDING_OWNER_UNAVAILABLE/);
          }
        }else{
          await assert.rejects(runProjection({findingSetHash:value.findingSetHash}),error=>error?.code==='42501');
        }
        for(const table of ['finding_sets','findings']){
          const guards=await sql.unsafe("SELECT t.tgname,t.tgtype::integer AS type,t.tgenabled,p.prosrc,p.prosecdef,(p.proowner=c.relowner AND o.rolname=$1) AS owner_ok FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_roles o ON o.oid=c.relowner WHERE n.nspname='public' AND c.relname=$2 AND NOT t.tgisinternal ORDER BY t.tgname",[${JSON.stringify(installation.ownerRole)},table]);
          assert.equal(guards.length,1);assert.equal(guards[0].tgname,'trg_'+table+'_immutable');
          assert.equal(guards[0].type,27);assert.equal(guards[0].tgenabled,'O');
          assert.equal(guards[0].prosrc,${JSON.stringify(immutableBody)});assert.equal(guards[0].prosecdef,false);assert.equal(guards[0].owner_ok,true);
          const rights=await sql.unsafe("SELECT has_any_column_privilege(current_user,$1::text,'UPDATE') AS u,has_table_privilege(current_user,$1::text,'DELETE') AS d,has_table_privilege(current_user,$1::text,'TRUNCATE') AS t",['public.'+table]);
          assert.deepEqual([rights[0].u,rights[0].d,rights[0].t],[false,false,false]);
          for(const statement of ['UPDATE public.'+table+' SET payload=payload','DELETE FROM public.'+table,'TRUNCATE public.'+table]){
            await assert.rejects(sql.unsafe(statement),error=>error?.code==='42501');
          }
        }
        await assert.rejects(sql.unsafe("SET session_replication_role='replica'"),error=>error?.code==='42501');
        assert.deepEqual(failures,[],'all six actual Source initializers must have exact selected/legacy behavior');
        console.log('FINDING_TERMINAL_COMPONENT_CHECKED');
      }finally{await sql.end({timeout:3});}
    `;
    const child = spawnSync(process.execPath, ["--import", import.meta.resolve("tsx"), "--input-type=module", "-e", script], {
      cwd: fixture.root, env: environment, encoding: "utf8", timeout: 45_000, maxBuffer: 65_536,
    });
    assert.equal(child.error, undefined, "bounded finding SQL child did not settle");
    assert.equal(child.signal, null);assert.equal(child.status,0,child.stderr);
    assert.equal(child.stdout,"FINDING_TERMINAL_COMPONENT_CHECKED\n");
  }
  // No activation/ready, admitted owner reservation, run or real workflow was fabricated.
});
