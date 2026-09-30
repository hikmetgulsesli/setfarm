import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";
import { PassThrough } from "node:stream";
import { parseTask6aPostgresSocketTransportV1 } from "../../src/internal-production/task6a-postgres-socket-transport-v1.js";
import { contractSpinePre32SourceJournalIdentitiesV1 } from "../../src/db/contract-spine-migrations.js";

const original = () => fs.readFileSync(new URL("../../src/db-pg.ts", import.meta.url), "utf8");
async function extract(source: string): Promise<readonly string[]> {
  const file = new URL("./task6a-held-pg31-base-ddl-v2.ts", import.meta.url);
  assert.ok(fs.existsSync(file), "actual-source ordinary base DDL extractor is missing");
  const module = await import(file.href);
  return module.extractTask6aOrdinaryBaseStatementsV2(source);
}

test("private PG31 fixture extracts actual ordinary base statements without importing db-pg", async () => {
  // Manual alternate schema, missed unique indexes or selected unrelated SQL
  // cannot satisfy this hand-checked source topology.
  const statements = await extract(original());
  assert.equal(statements.length, 52);
  assert.equal(statements[0], "CREATE SEQUENCE IF NOT EXISTS runs_run_number_seq");
  assert.equal(statements.filter(query => /^CREATE TABLE/.test(query)).length, 7);
  assert.equal(statements.filter(query => /^ALTER TABLE/.test(query)).length, 30);
  assert.equal(statements.filter(query => /^CREATE (?:UNIQUE )?INDEX/.test(query)).length, 12);
  assert.equal(statements.filter(query => /^SELECT/.test(query)).length, 2);
  assert.ok(statements[50]!.includes("idx_claim_log_open_single_unique"));
  assert.ok(statements[51]!.includes("idx_claim_log_open_story_unique"));
  assert.equal(Object.isFrozen(statements), true);
});

test("private PG31 fixture refuses dynamic base SQL before setup", async () => {
  // Source interpolation cannot be silently omitted or evaluated under privilege.
  const source = original().replace("s`CREATE SEQUENCE IF NOT EXISTS runs_run_number_seq`",
    's`CREATE SEQUENCE IF NOT EXISTS ${"untrusted"}`');
  await assert.rejects(extract(source), /TASK6A_ORDINARY_BASE_SOURCE_REFUSED/);
});

test("private PG31 fixture refuses missing statement or migration function", async () => {
  // Missing one real base statement must never degrade to a partial fixture.
  for (const source of [original().replace("s`CREATE SEQUENCE IF NOT EXISTS runs_run_number_seq`", "other`ignored`"),
    original().replace("function pgMigrate(", "function unrelatedMigrate(")]) {
    await assert.rejects(extract(source), /TASK6A_ORDINARY_BASE_SOURCE_REFUSED/);
  }
});

test("held PG31 privileged fixture requires all three opt-ins before effects", () => {
  // A lone new opt-in must not silently skip or enter any old privileged test.
  const result = spawnSync(process.execPath, ["--import", "tsx", "--test",
    fileURLToPath(new URL("./task6a-private-protected-cluster.integration.test.ts", import.meta.url))], {
    encoding: "utf8", timeout: 10000, env: { SETFARM_TASK6A_TEST_HELD_PG31_FIXTURE: "1" },
  });
  assert.equal(result.error, undefined);
  assert.notEqual(result.status, 0);
  assert.match(result.stdout + result.stderr, /held PG31 fixture requires all three explicit opt-ins/);
});

test("private PG31 setup is import-inert and refuses wrong database before connection", async () => {
  // The source setup entry must never adopt a generic/ambient target.
  const file = new URL("./task6a-held-pg31-fixture-entry-v2.ts", import.meta.url);
  assert.ok(fs.existsSync(file), "protected source31 fixture entry is missing");
  const module = await import(file.href);
  assert.equal(typeof module.withTask6aPrivateHeldPg31DiagnosticV2, "function");
  await assert.rejects(module.prepareTask6aPrivateSource31FixtureV2({
    schema: "setfarm.postgres-socket-transport.v1",
    socketDirectory: "/private/tmp/setfarm-task6a-protected-pg.Abc123/socket",
    port: 55439, database: "postgres", user: "task6a_admin", osUid: process.getuid!(),
  }, await extract(original())), /TASK6A_PRIVATE_SOURCE31_SETUP_REFUSED/);
});

test("held PG31 fixture ends child input exactly once even before close event arrives", async () => {
  // Writing a second finish after stdout closed but before process CLOSE can
  // produce ERR_STREAM_WRITE_AFTER_END and make definite cleanup uncertain.
  const source = fs.readFileSync(new URL("./task6a-private-protected-cluster.integration.test.ts", import.meta.url), "utf8");
  const ast = ts.createSourceFile("fixture.ts", source, ts.ScriptTarget.Latest, true);
  const fn = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "endHeldFixtureInputV2");
  assert.ok(fn, "idempotent held child input settlement is missing");
  const context = vm.createContext({});
  vm.runInContext(ts.transpileModule(fn.getText(ast), { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None,
  } }).outputText, context);
  const input = new PassThrough(); let output = ""; const errors: Error[] = [];
  input.on("data", chunk => { output += chunk; }); input.on("error", error => { errors.push(error); });
  context.endHeldFixtureInputV2(input); context.endHeldFixtureInputV2(input);
  await new Promise<void>(resolve => setImmediate(resolve));
  assert.equal(output, "finish\n"); assert.deepEqual(errors, []);
});

test("actual private setup applies automatic source migrations before ordinary indexes owned by migration5", async () => {
  // Installing ordinary claim indexes first creates partial migration5. This
  // executes the actual setup body at a controlled external PG boundary; the
  // full privileged run, not this boundary, must prove real source31 schema.
  const source = fs.readFileSync(new URL("./task6a-held-pg31-fixture-entry-v2.ts", import.meta.url), "utf8");
  const ast = ts.createSourceFile("entry.ts", source, ts.ScriptTarget.Latest, true);
  const fn = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "prepareTask6aPrivateSource31FixtureV2");
  assert.ok(fn);
  const events: string[] = [];
  const context = vm.createContext({ assert: { ...assert,
    deepEqual: (actual: unknown, expected: unknown) => assert.deepEqual(structuredClone(actual), structuredClone(expected)),
  }, Error, Array, Number, RegExp, process,
    parseTask6aPostgresSocketTransportV1, contractSpinePre32SourceJournalIdentitiesV1,
    createTask6aSingleBackendSocketClientV1: () => ({
      sql: { unsafe: async (query: string) => {
        events.push(query);
        if (query.startsWith("SELECT version, name, checksum")) return contractSpinePre32SourceJournalIdentitiesV1()
          .map(row => ({ ...row, state: "applied" }));
        if (query.includes('AS "ownerLogin"')) return [{ ownerLogin: false, runtimeUnsafe: false,
          runtimeCanCreateSchema: false, runtimeOwnsSource: true, runtimeOwnerMember: false, runtimeAdminMember: false }];
        return [];
      } }, revoke: () => { events.push("revoke"); }, close: async () => { events.push("close"); },
    }),
    applyContractSpineMigrations: async () => {
      if (events.some(query => query.includes("idx_claim_log_open_single_unique"))) throw Error("Migration 5 is partially present");
      events.push("actual-source-migrations");
      return { guardedPending: ["contract-spine-bootstrap-main-claim-handoff-v1"] };
    },
  });
  vm.runInContext(ts.transpileModule(fn.getText(ast).replace(/^export /, ""), { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None,
  } }).outputText, context);
  const statements = await extract(original());
  await context.prepareTask6aPrivateSource31FixtureV2({ schema: "setfarm.postgres-socket-transport.v1",
    socketDirectory: "/private/tmp/setfarm-task6a-protected-pg.Abc123/socket", port: 55439,
    database: "setfarm", user: "task6a_admin", osUid: process.getuid!() }, statements);
  assert.ok(events.indexOf("actual-source-migrations") < events.indexOf(statements[0]!));
  for (const statement of statements) assert.equal(events.filter(query => query === statement).length, 1);
  assert.equal(events.at(-1), "close");
});

test("actual private setup retains frozen owner-only ACLs instead of granting a second observer SELECT", async () => {
  // A different journal owner plus SELECT grants rejects the real V27/V28/V29
  // audit. Execute the actual setup at the external SQL boundary, not a source
  // substring test; the real opt-in fixture must prove PostgreSQL ownership.
  const source = fs.readFileSync(new URL("./task6a-held-pg31-fixture-entry-v2.ts", import.meta.url), "utf8");
  const ast = ts.createSourceFile("entry.ts", source, ts.ScriptTarget.Latest, true);
  const fn = ast.statements.find(node => ts.isFunctionDeclaration(node)
    && node.name?.text === "prepareTask6aPrivateSource31FixtureV2");
  assert.ok(fn);
  const events: string[] = [];
  const context = vm.createContext({ assert: { ...assert,
    deepEqual: (actual: unknown, expected: unknown) => assert.deepEqual(structuredClone(actual), structuredClone(expected)),
  }, Error, Array, Number, RegExp, process, parseTask6aPostgresSocketTransportV1,
  contractSpinePre32SourceJournalIdentitiesV1,
  createTask6aSingleBackendSocketClientV1: () => ({ sql: { unsafe: async (query: string) => {
    events.push(query);
    assert.doesNotMatch(query, /GRANT\s+(?:SELECT|ALL)\s+ON\s+(?:ALL\s+)?(?:TABLE|FUNCTION|COLUMN)/i);
    if (query.startsWith("SELECT version, name, checksum")) return contractSpinePre32SourceJournalIdentitiesV1()
      .map(row => ({ ...row, state: "applied" }));
    if (query.includes('AS "ownerLogin"')) return [{ ownerLogin: false, runtimeUnsafe: false,
      runtimeCanCreateSchema: false, runtimeOwnsSource: true, runtimeOwnerMember: false, runtimeAdminMember: false }];
    return [];
  } }, revoke: () => { events.push("revoke"); }, close: async () => { events.push("close"); } }),
  applyContractSpineMigrations: async () => {
    assert.match(events.at(-1)!, /SET ROLE task6a_runtime\s*$/,
      "source objects must be created by the explicitly owner-class private observer");
    return { guardedPending: ["contract-spine-bootstrap-main-claim-handoff-v1"] };
  } });
  vm.runInContext(ts.transpileModule(fn.getText(ast).replace(/^export /, ""), { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None,
  } }).outputText, context);
  await context.prepareTask6aPrivateSource31FixtureV2({ schema: "setfarm.postgres-socket-transport.v1",
    socketDirectory: "/private/tmp/setfarm-task6a-protected-pg.Abc123/socket", port: 55439,
    database: "setfarm", user: "task6a_admin", osUid: process.getuid!() }, await extract(original()));
  assert.ok(events.some(query => /RESET ROLE;\s*REVOKE CREATE ON SCHEMA public FROM task6a_runtime/.test(query)));
  assert.equal(events.at(-1), "close");
});

test("actual held observer probe cannot report a wrongly successful restored recheck as refusal", async () => {
  // The literal real child probe must not catch its own assertion and print a
  // false refusal when the API wrongly succeeds after restoration.
  const source = fs.readFileSync(new URL("./task6a-private-protected-cluster.integration.test.ts", import.meta.url), "utf8");
  const ast = ts.createSourceFile("fixture.ts", source, ts.ScriptTarget.Latest, true);
  const declaration = ast.statements.filter(ts.isVariableStatement)
    .flatMap(node => Array.from(node.declarationList.declarations))
    .find(node => ts.isIdentifier(node.name) && node.name.text === "HELD_PG31_PROBE");
  assert.ok(declaration?.initializer && ts.isNoSubstitutionTemplateLiteral(declaration.initializer));
  const code = declaration.initializer.text
    .replace("import assert from 'node:assert/strict';", "")
    .replace("import {createInterface} from 'node:readline';", "")
    .replace("await import(process.argv[1])", "await loadModule(process.argv[1])");
  let rechecks = 0;
  const holder = { observe: () => {
    if (rechecks) throw Error("burned observer");
    return { authority: "diagnostic-only", productionAuthority: false, observingBackendCount: 1, backendPid: 4242 };
  }, recheck: async () => { if (++rechecks !== 3) throw Error("burned recheck"); } };
  const context = vm.createContext({ assert, Error, AggregateError,
    process: { argv: ["node", "entry", "{}", "{}", "other-backend"], pid: 1234,
      getuid: () => 70, geteuid: () => 70, execPath: "/private/protected/node", stdin: {} },
    console: { log: () => {} },
    createInterface: () => (async function* () { yield "check"; yield "check"; yield "finish"; })(),
    loadModule: async () => ({ withTask6aPrivateHeldPg31DiagnosticV2: async (
      _transport: unknown, _uid: unknown, _gid: unknown, operation: (held: typeof holder) => Promise<unknown>,
    ) => { await operation(holder); throw Error("burned invocation"); } }),
  });
  await assert.rejects(vm.runInContext(`(async()=>{${code}})()`, context), assert.AssertionError);
});

for (const broken of ["close", "revoke", "both"]) test(`actual private setup retains primary error and attempts all cleanup after ${broken} failure`, async () => {
  // Finally must not replace a source setup error or skip definite close after
  // revoke throws. Exercise the actual setup function at its owned client port.
  const source = fs.readFileSync(new URL("./task6a-held-pg31-fixture-entry-v2.ts", import.meta.url), "utf8");
  const ast = ts.createSourceFile("entry.ts", source, ts.ScriptTarget.Latest, true);
  const fn = ast.statements.find(node => ts.isFunctionDeclaration(node)
    && node.name?.text === "prepareTask6aPrivateSource31FixtureV2");
  assert.ok(fn);
  const primary = Error("actual setup SQL failure"), revocation = Error("actual revoke failure"), closing = Error("actual close failure");
  const events: string[] = [];
  const context = vm.createContext({ assert, Error, AggregateError, Object, Array, Number, RegExp, process,
    parseTask6aPostgresSocketTransportV1,
    createTask6aSingleBackendSocketClientV1: () => ({ sql: { unsafe: async () => { throw primary; } },
      revoke: () => { events.push("revoke"); if (broken !== "close") throw revocation; },
      close: async () => { events.push("close"); if (broken !== "revoke") throw closing; } }),
  });
  vm.runInContext(ts.transpileModule(fn.getText(ast).replace(/^export /, ""), { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None,
  } }).outputText, context);
  await assert.rejects(context.prepareTask6aPrivateSource31FixtureV2({ schema: "setfarm.postgres-socket-transport.v1",
    socketDirectory: "/private/tmp/setfarm-task6a-protected-pg.Abc123/socket", port: 55439,
    database: "setfarm", user: "task6a_admin", osUid: process.getuid!() }, await extract(original())), error => {
    assert.ok(error instanceof AggregateError);
    assert.deepEqual(Array.from(error.errors), [primary, ...(broken !== "close" ? [revocation] : []), ...(broken !== "revoke" ? [closing] : [])]);
    return true;
  });
  assert.deepEqual(events, ["revoke", "close"]);
});
