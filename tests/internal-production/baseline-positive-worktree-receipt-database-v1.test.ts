import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";

const sourceUrl = new URL("../../src/internal-production/baseline-positive-worktree-receipt-database-v1.ts", import.meta.url);
const root = "/tmp/projects/story/.worktrees/story-1";
const localUrl = "postgresql://fixture:PRIVATE_PASSWORD@localhost/setfarm";

test("receipt DB adapter is import-inert and refuses absent credentials before driver load", () => {
  const result = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `
    import net from 'node:net';
    import { registerHooks, syncBuiltinESMExports } from 'node:module';
    let loads = 0; let connections = 0;
    registerHooks({resolve(specifier, context, next) { if (specifier === 'postgres') loads++; return next(specifier, context); }});
    net.Socket.prototype.connect = () => { connections++; throw Error('UNEXPECTED_CONNECTION'); };
    syncBuiltinESMExports();
    const module = await import(${JSON.stringify(sourceUrl.href)});
    const importLoads = loads;
    let error;
    try { await module.observeDiagnosticPositiveWorktreeReceiptCandidateWithCodeOwnedDatabaseV1(
      undefined, ${JSON.stringify(root)}, {}); }
    catch (caught) { error = caught.message; }
    process.stdout.write(JSON.stringify({ error, loads, importLoads, connections }));
  `], { encoding: "utf8", timeout: 15000, env: { SETFARM_PG_URL: "postgresql://PRIVATE_AMBIENT@localhost/setfarm" } });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {
    error: "INTERNAL_PRODUCTION_POSITIVE_WORKTREE_RECEIPT_DATABASE_INVALID",
    loads: 0, importLoads: 0, connections: 0,
  });
});

for (const scenario of ["ambient-pg", "remote-host", "port", "query", "wrong-database", "invalid-root"]) {
  test(`receipt DB adapter refuses ${scenario} before loading the driver`, () => {
    const url = scenario === "remote-host" ? "postgresql://fixture:PRIVATE_PASSWORD@remote.invalid/setfarm"
      : scenario === "port" ? "postgresql://fixture:PRIVATE_PASSWORD@localhost:55437/setfarm"
        : scenario === "query" ? `${localUrl}?sslmode=disable`
          : scenario === "wrong-database" ? "postgresql://fixture:PRIVATE_PASSWORD@localhost/other" : localUrl;
    const selectedRoot = scenario === "invalid-root" ? `${root}/../other` : root;
    const result = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `
      import { registerHooks } from 'node:module';
      let loads = 0;
      registerHooks({resolve(specifier, context, next) { if (specifier === 'postgres') loads++; return next(specifier, context); }});
      const module = await import(${JSON.stringify(sourceUrl.href)});
      let error;
      try { await module.observeDiagnosticPositiveWorktreeReceiptCandidateWithCodeOwnedDatabaseV1(
        ${JSON.stringify(url)}, ${JSON.stringify(selectedRoot)}, {}); }
      catch (caught) { error = caught.message; }
      process.stdout.write(JSON.stringify({ error, loads }));
    `], { encoding: "utf8", timeout: 15000, env: scenario === "ambient-pg" ? { PGPORT: "55437" } : {} });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), {
      error: "INTERNAL_PRODUCTION_POSITIVE_WORKTREE_RECEIPT_DATABASE_INVALID", loads: 0,
    });
  });
}

test("one fixed read-only snapshot returns only an unpublished candidate and closes on every failure", () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "receipt-database-v1-"));
  try {
    let source = fs.readFileSync(sourceUrl, "utf8");
    const marker = 'const postgresModule = await import("postgres");';
    assert.equal(source.split(marker).length, 2);
    source = source.replace('from "./baseline-positive-worktree-active-row-snapshot-v2.js"',
      `from ${JSON.stringify(new URL("../../src/internal-production/baseline-positive-worktree-active-row-snapshot-v2.ts", import.meta.url).href)}`)
      .replace('from "./baseline-positive-worktree-receipt-protocol-v1.js"',
        `from ${JSON.stringify(new URL("../../src/internal-production/baseline-positive-worktree-receipt-protocol-v1.ts", import.meta.url).href)}`)
      .replace(marker, `const postgresModule = { default: (url, options) => {
        globalThis.probe.options = options;
        return { options: {host: [globalThis.probe.wrongTarget ? 'remote.invalid' : 'localhost'],
          port: [5432], database: 'setfarm', user: 'fixture'},
          begin: async (mode, operation) => {
            globalThis.probe.modes.push(mode);
            const tx = (strings) => { globalThis.probe.locals.push(strings[0]); return []; };
            tx.unsafe = async (statement, parameters) => {
              globalThis.probe.queries.push({statement, parameters});
              if (globalThis.probe.queryFailure) throw Error('PRIVATE_QUERY_PASSWORD');
              const rows = statement.includes('session_user')
                ? [{sessionUser: 'fixture', currentUser: globalThis.probe.wrongRole ? 'other' : 'fixture'}]
                : statement.includes('execution_attempts') ? globalThis.probe.attempts : globalThis.probe.sessions;
              class Result extends Array {}
              const result = new Result(...rows);
              for (const key of ['count','state','command','columns','statement'])
                Object.defineProperty(result, key, {value: null});
              return result;
            };
            return operation(tx);
          },
          end: async (options) => { globalThis.probe.closes.push(options);
            if (globalThis.probe.closeFailure) throw Error('PRIVATE_CLOSE_PASSWORD'); }
        };
      } };`);
    fs.writeFileSync(path.join(temporary, "package.json"), '{"type":"module"}');
    const file = path.join(temporary, "adapter.ts");
    fs.writeFileSync(file, source);
    const result = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `
      const module = await import(${JSON.stringify(pathToFileURL(file).href)});
      const root = ${JSON.stringify(root)};
      const fenceToken = 'a'.repeat(64);
      const sourceSha = 'b'.repeat(40);
      const sourceTreeHash = 'c'.repeat(40);
      const physical = {root,dev:'1',ino:'2',birthtimeNs:'3',gitPrimaryRoot:'/tmp/projects/story'};
      const source = {root,gitPrimaryRoot:physical.gitPrimaryRoot,sourceSha,sourceTreeHash};
      const attempt = {runId:'run-1',claimId:'1',attemptId:'ATT_1234567890abcdef',generation:1,
        fenceToken,worktreeRoot:root,sourceSha,sourceTreeHash,disposition:'running'};
      const session = {runId:'run-1',claimId:'1',attemptId:attempt.attemptId,
        sessionId:'RTS_1234567890abcdef',ownerInstanceId:'owner-1',worktreeRoot:root,state:'running'};
      const ports = {holdPhysical: async callback => callback(physical, async () => physical),
        observeSource: async () => source};
      const run = async flags => {
        globalThis.probe = { ...flags,
          attempts: flags.missingAttempt ? [] : flags.duplicate ? [attempt, attempt] : [attempt],
          sessions: flags.missingSession ? [] : [flags.crossed ? {...session,runId:'wrong'} : session],
          options:null,modes:[],locals:[],queries:[],closes:[] };
        let output,error;
        try { const candidate = await module.observeDiagnosticPositiveWorktreeReceiptCandidateWithCodeOwnedDatabaseV1(
          ${JSON.stringify(localUrl)},root,ports);
          output = {authority:candidate.authority,receiptStatus:candidate.receiptStatus,
            provenance:candidate.physicalIdentityProvenance,authentication:candidate.producerAuthentication,
            root:candidate.receipt.root,candidateHash:candidate.candidateHash}; }
        catch (caught) { error = caught.message; }
        const p = globalThis.probe;
        return { output,error,modes:p.modes,locals:p.locals,
          queries:p.queries.map(q => ({statement:q.statement,parameters:q.parameters})),
          closes:p.closes,options:p.options };
      };
      globalThis.probe = {attempts:[attempt],sessions:[session],options:null,
        modes:[],locals:[],queries:[],closes:[]};
      let releaseSecond; let reportSecond;
      const secondGate = new Promise(resolve => { releaseSecond = resolve; });
      const secondEntered = new Promise(resolve => { reportSecond = resolve; });
      let sourceReads = 0;
      const waitingSourcePorts = {...ports, observeSource: async () => {
        sourceReads++;
        if (sourceReads === 2) { reportSecond(); await secondGate; }
        return source;
      }};
      const waitingWork = module.observeDiagnosticPositiveWorktreeReceiptCandidateWithCodeOwnedDatabaseV1(
        ${JSON.stringify(localUrl)},root,waitingSourcePorts);
      await secondEntered;
      const closedBeforeSecondSourceSettles = globalThis.probe.closes.length;
      releaseSecond();
      const waitingCandidate = await waitingWork;
      const pendingSource = {closedBeforeSecondSourceSettles,
        finalCloses:globalThis.probe.closes.length,authority:waitingCandidate.authority};
      process.stdout.write(JSON.stringify({success:await run({}),wrongRole:await run({wrongRole:true}),
        missingAttempt:await run({missingAttempt:true}),missingSession:await run({missingSession:true}),
        duplicate:await run({duplicate:true}),crossed:await run({crossed:true}),
        queryFailure:await run({queryFailure:true}),closeFailure:await run({closeFailure:true}),
        wrongTarget:await run({wrongTarget:true}),pendingSource}));
    `], { encoding: "utf8", timeout: 15000, env: {} });
    assert.equal(result.status, 0, result.stderr);
    const observed = JSON.parse(result.stdout);
    const invalid = "INTERNAL_PRODUCTION_POSITIVE_WORKTREE_RECEIPT_DATABASE_INVALID";
    assert.deepEqual(observed.success.output, {
      authority: "diagnostic-only", receiptStatus: "required-unpublished", provenance: "unverified",
      authentication: "unverified", root, candidateHash: observed.success.output.candidateHash,
    });
    assert.match(observed.success.output.candidateHash, /^[a-f0-9]{64}$/);
    assert.deepEqual(observed.success.modes, ["isolation level repeatable read read only"]);
    assert.deepEqual(observed.success.locals, [
      "SET LOCAL statement_timeout = '5s'", "SET LOCAL lock_timeout = '1s'",
      "SET LOCAL idle_in_transaction_session_timeout = '10s'",
    ]);
    assert.equal(observed.success.queries.length, 3);
    assert.match(observed.success.queries[1].statement, /worktree = \$1[\s\S]*LIMIT 2/);
    assert.match(observed.success.queries[2].statement, /worktree = \$1[\s\S]*LIMIT 2/);
    assert.deepEqual(observed.success.queries[1].parameters, [root]);
    assert.deepEqual(observed.success.queries[2].parameters, [root]);
    assert.deepEqual(observed.success.closes, [{ timeout: 1 }]);
    assert.equal(observed.success.options.max, 1);
    assert.equal(observed.success.options.connect_timeout, 5);
    for (const key of ["wrongRole", "missingAttempt", "missingSession", "duplicate", "crossed",
      "queryFailure", "closeFailure", "wrongTarget"]) {
      assert.equal(observed[key].error, invalid, key);
      assert.deepEqual(observed[key].closes, [{ timeout: 1 }], key);
    }
    assert.deepEqual(observed.wrongTarget.modes, []);
    assert.deepEqual(observed.pendingSource, { closedBeforeSecondSourceSettles: 1,
      finalCloses: 1, authority: "diagnostic-only" });
    assert.equal(result.stdout.includes("PRIVATE_PASSWORD"), false);
    assert.equal(result.stdout.includes("PRIVATE_QUERY_PASSWORD"), false);
    assert.equal(result.stdout.includes("PRIVATE_CLOSE_PASSWORD"), false);
    assert.equal(result.stdout.includes("a".repeat(64)), false);
  } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
});
