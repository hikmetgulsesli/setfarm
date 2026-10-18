import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, appendFileSync, rmSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import ts from "typescript";

const root = new URL("../../", import.meta.url);
const read = (name: string): string => readFileSync(new URL(name, root), "utf8");
function declaration(file: string, name: string): string {
  const source = read(file), tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  let statements = tree.statements;
  if (file === "src/cli/cli.ts" && ["renderWorkflowRunAcceptedV1", "extractWorkflowRunOutputArgumentV1"].includes(name)) {
    // These two DATA helpers live only in the fixed ordinary CLI branch.
    // Follow exactly custody -> diagnostic -> ordinary else; no recursive lookup.
    const custody = tree.statements.find((node): node is ts.IfStatement =>
      ts.isIfStatement(node) && node.expression.getText(tree) === "freshCliCustodyHandledV1");
    assert.ok(custody?.elseStatement && ts.isIfStatement(custody.elseStatement));
    const diagnostic = custody.elseStatement;
    assert.equal(diagnostic.expression.getText(tree), "exactEntryDiagnostic");
    assert.ok(diagnostic.elseStatement && ts.isBlock(diagnostic.elseStatement));
    statements = diagnostic.elseStatement.statements;
  }
  const matches = statements.filter((node): node is ts.FunctionDeclaration =>
    ts.isFunctionDeclaration(node) && node.name?.text === name);
  assert.equal(matches.length, 1, "fixed source function is missing or ambiguous: " + name);
  return matches[0]!.getText(tree);
}

test("operational entry exposes no caller authority port and refuses source execution", async () => {
  const api = await import("../../src/installation/fresh-installation-entry-v1.js");
  assert.deepEqual(Object.keys(api).sort(), [
    "assertFreshInstallationOperationalEntryV1", "prepareFreshInstallationOperationalEntryV1",
  ].sort());
  let gets = 0;
  const hostile = new Proxy({}, { get() { gets++; throw Error("caller data is not authority"); } });
  assert.throws(() => Reflect.apply(api.assertFreshInstallationOperationalEntryV1, null, [hostile]),
    /FRESH_INSTALLATION_OPERATIONAL_ENTRY_REFUSED/);
  await assert.rejects(Reflect.apply(api.prepareFreshInstallationOperationalEntryV1, null, [hostile]),
    /FRESH_INSTALLATION_OPERATIONAL_ENTRY_REFUSED/);
  assert.equal(gets, 0);
});

test("operational database predicate cannot admit an unselected source process", async () => {
  assert.equal(process.env.SETFARM_INSTALLATION_DIR, undefined, "negative test requires an unselected child/test process");
  const db = await import("../../src/db-pg.js");
  assert.equal(typeof db.assertSelectedFreshInstallationOperationalDatabaseV1, "function");
  assert.throws(() => db.assertSelectedFreshInstallationOperationalDatabaseV1(),
    /FRESH_INSTALLATION_OPERATIONAL_DATABASE_NOT_PREPARED/);
});

test("selected CLI DATA policy distinguishes operational commands from custody and shared administration", () => {
  // Command classification DATA only. No compiled/client/service authority is supplied.
  const source = declaration("src/cli/cli.ts", "isFreshInstallationOperationalCliEntryV1");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const classify = new Function(compiled + ";return isFreshInstallationOperationalCliEntryV1;")() as (args: readonly string[]) => boolean;
  for (const args of [["version"], ["--version"], ["-v"], ["ant"], ["logs"], ["logs", "20"],
    ["workflow", "list"], ["workflow", "runs"], ["workflow", "status", "component"],
    ["dashboard", "start"], ["dashboard", "restart"], ["spawner", "start"], ["spawner", "restart"],
    ["workflow", "install", "feature-dev"], ["workflow", "run", "feature-dev", "--json", "@component-task"],
    ["workflow", "stop", "component", "--expected-snapshot-hash", "a".repeat(64), "--force"],
    ["step", "peek", "feature-dev_planner"], ["step", "claim", "feature-dev_planner"],
    ["step", "complete", "component", "--claim-file", "claim.json", "--file", "output.txt"],
    ["step", "fail", "component", "failure\nDATA"]]) assert.equal(classify(args), true, args.join(" "));
  for (const args of [[], ["version", "--unknown"], ["update"], ["install"], ["uninstall", "--force"],
    ["dashboard"], ["dashboard", "status"], ["dashboard", "stop"], ["dashboard", "start", "--unknown"],
    ["spawner", "status"], ["spawner", "stop"], ["medic", "install"], ["workflow", "run", "feature-dev"],
    ["workflow", "ensure-crons", "feature-dev"], ["workflow", "resume", "component"], ["workflow", "stop", "component"],
    ["workflow", "status"], ["logs", "1", "extra"], ["logs", ""],
    ["workflow", "status", "x".repeat(2049)], ["workflow", "status", "bad\nquery"], ["step", "claim", "bad\0id"]]) {
    assert.equal(classify(args), false, "shared/custody/malformed command must not enter operational preparation: " + args.join(" "));
  }
  const custodySource = declaration("src/cli/cli.ts", "freshCliCustodyActionV1");
  const custodyCompiled = ts.transpileModule(custodySource, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const custody = new Function(custodyCompiled + ";return freshCliCustodyActionV1;")() as (args: readonly string[]) => unknown;
  for (const service of ["dashboard", "spawner"]) for (const action of ["status", "stop"]) {
    assert.deepEqual(custody([service, action]), { service, action });
    assert.equal(custody([service, action, "--force"]), null);
  }
  for (const args of [["dashboard", "start"], ["dashboard", "restart"], ["spawner", "restart"],
    ["workflow", "stop"], ["step", "claim", "agent"], ["update"], []]) assert.equal(custody(args), null);
});

test("selected unsupported CLI action refuses before spawn, SQL or ordinary module evaluation", () => {
  const entry = new URL("src/cli/cli.ts", root).href;
  const program = `
    import assert from "node:assert/strict";
    import cp from "node:child_process";
    import net from "node:net";
    import {syncBuiltinESMExports} from "node:module";
    const counts={children:0,connections:0};
    for(const key of ["spawn","spawnSync","execFile","execFileSync","exec","execSync"])
      cp[key]=()=>{counts.children++;throw Error("unexpected child before interim refusal");};
    net.Socket.prototype.connect=function(){counts.connections++;throw Error("unexpected SQL/network before interim refusal");};
    syncBuiltinESMExports();
    const stderr=[];
    process.stderr.write=(value)=>{stderr.push(String(value));return true;};
    process.exit=()=>{throw Error("CONTROLLED_CLI_EXIT");};
    process.argv=[process.execPath,${JSON.stringify(entry)},"install"];
    try{await import(${JSON.stringify(entry)});assert.fail("selected install must refuse");}
    catch(error){assert.equal(error.message,"CONTROLLED_CLI_EXIT");}
    assert.equal(stderr.join(""),"FRESH_INSTALLATION_CLI_ACTION_NOT_WIRED\\n");
    assert.deepEqual(counts,{children:0,connections:0});
    console.log("SELECTED_CLI_NEGATIVE_CHECKED");
  `;
  const environment = { ...process.env, TSX_DISABLE_CACHE: "1", SETFARM_INSTALLATION_DIR: "/not-an-admitted-selected-installation" };
  const result = spawnSync(process.execPath, ["--import", import.meta.resolve("tsx"), "--input-type=module", "-e", program], {
    cwd: root, env: environment, encoding: "utf8", timeout: 15_000, maxBuffer: 65_536,
  });
  assert.equal(result.error, undefined);
  assert.equal(result.signal, null);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "SELECTED_CLI_NEGATIVE_CHECKED\n");
});

test("selected dashboard permits the exact ACK handler while retaining other mutation and live-observation refusals", () => {
  // Pure DATA request classification, with no listener, private client or positive authority.
  const classifierName = read("src/server/dashboard.ts").includes("function isFreshInstallationDashboardRequestV1(")
    ? "isFreshInstallationDashboardRequestV1" : "isFreshInstallationReadOnlyDashboardRequestV1";
  const source = declaration("src/server/dashboard.ts", classifierName);
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const classify = new Function(
    compiled + ";return " + classifierName + ";",
  )() as (method: string | undefined, pathname: string) => boolean;
  for (const method of ["GET", "HEAD", "OPTIONS"]) {
    for (const pathname of ["/", "/api/runs", "/api/rules", "/api/runs/component/stories"]) {
      assert.equal(classify(method, pathname), true);
    }
    assert.equal(classify(method, "/api/runs/component/deployment-observation"), false);
  }
  assert.equal(classify("POST", "/api/runs/component/project-transfer-ack"), true);
  for (const method of [undefined, "POST", "PUT", "PATCH", "DELETE", "CONNECT", "TRACE", "get"]) {
    for (const pathname of ["/api/scrape", "/api/rules", "/api/rules/import", "/api/rules/component",
      "/api/runs//project-transfer-ack", "/api/runs/a/b/project-transfer-ack",
      "/api/runs/component/project-transfer-ack/", "/api/runs/component/project-transfer-ack/extra",
      "/api/runs/component/deployment-observation"]) assert.equal(classify(method, pathname), false);
    if (method !== "POST") assert.equal(classify(method, "/api/runs/component/project-transfer-ack"), false);
  }
  const dashboard = read("src/server/dashboard.ts");
  const gate = dashboard.indexOf("!isFreshInstallationDashboardRequestV1(req.method, p)");
  assert.ok(gate >= 0 && gate < dashboard.indexOf('if (p === "/api/scrape" && req.method === "POST")'));
  assert.ok(gate < dashboard.indexOf('if (p === "/api/rules" && req.method === "POST")'));
  assert.ok(gate < dashboard.indexOf('if (deploymentObservationMatch && req.method === "GET")'));
  assert.ok(gate < dashboard.indexOf('if (projectTransferAckMatch && req.method === "POST")'));
});

test("selected synchronous dashboard cannot create a listener before actual asynchronous admission", () => {
  const source = read("src/server/dashboard.ts");
  const start = source.indexOf("const DASHBOARD_SELECTED_INSTALLATION_LOCATOR_V1 =");
  const end = source.indexOf("export function startDashboard(", start);
  assert.ok(start >= 0 && end > start, "dashboard selected admission declarations are missing");
  const body = source.slice(start, end) + "\n" + declaration("src/server/dashboard.ts", "startDashboard");
  const compiled = ts.transpileModule(body, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText.replace(/export /g, "");
  const saved = process.env.SETFARM_INSTALLATION_DIR;
  process.env.SETFARM_INSTALLATION_DIR = "/component-data-not-an-installed-root";
  let creates = 0, legacyCalls = 0;
  try {
    const invoke = new Function("createDashboardServer", "assertOrdinaryDashboardDeploymentCutoverAdmissionV2",
      "assertTask6aPreSchemaSynchronousOrdinaryStartupV3", compiled + ";return ()=>startDashboard(0);")(
      () => { creates++; throw Error("must not create server"); },
      () => { legacyCalls++; throw Error("fresh source cannot acquire legacy admission"); },
      () => { legacyCalls++; throw Error("fresh source cannot acquire legacy admission"); });
    assert.throws(invoke, /FRESH_INSTALLATION_OPERATIONAL_ENTRY_REFUSED/);
    assert.equal(creates, 0);
    assert.equal(legacyCalls, 0);
    delete process.env.SETFARM_INSTALLATION_DIR;
    assert.throws(invoke, /FRESH_INSTALLATION_OPERATIONAL_ENTRY_REFUSED/);
    process.env.SETFARM_INSTALLATION_DIR = "/component-data-not-an-installed-root";
    assert.throws(invoke, /FRESH_INSTALLATION_OPERATIONAL_ENTRY_REFUSED/);
    assert.equal(creates, 0);
  } finally {
    if (saved === undefined) delete process.env.SETFARM_INSTALLATION_DIR;
    else process.env.SETFARM_INSTALLATION_DIR = saved;
  }
});

test("sync source component rejects actual dirty, changed-HEAD and invalid-build fixtures without CLI skips", () => {
  // Negative component evidence only. The fixture stamp is synthetic DATA and
  // never qualifies a finalized build, private database phase or public entry.
  // Git state and the fixed verifyRuntimeIntegrity dependency are real.
  const body = declaration("src/installation/fresh-installation-entry-v1.ts", "assertRuntimeSourceV1");
  const compiled = ts.transpileModule(body, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  for (const variant of ["dirty", "head", "build-sha", "build-dirty", "branch"] as const) {
    const directory = mkdtempSync(path.join(tmpdir(), "fresh-entry-source-negative-"));
    const git = (...args: string[]): string => execFileSync("/usr/bin/git", [
      "-c", "core.hooksPath=/dev/null", "-c", "commit.gpgsign=false", "-c", "user.name=Source Negative Fixture",
      "-c", "user.email=source-negative@example.invalid", "-C", directory, ...args,
    ], { encoding: "utf8", timeout: 5000, maxBuffer: 65_536, stdio: ["ignore", "pipe", "pipe"] }).trim();
    try {
      git("init", "--quiet", "--initial-branch=main");
      writeFileSync(path.join(directory, ".gitignore"), "dist/\n");
      writeFileSync(path.join(directory, "source.txt"), "original\n");
      git("add", ".gitignore", "source.txt"); git("commit", "--quiet", "-m", "negative source fixture");
      const originSha = git("rev-parse", "HEAD");
      mkdirSync(path.join(directory, "dist"));
      let buildSha = originSha;
      if (variant === "dirty") appendFileSync(path.join(directory, "source.txt"), "changed\n");
      if (variant === "head") {
        appendFileSync(path.join(directory, "source.txt"), "next commit\n");
        git("add", "source.txt"); git("commit", "--quiet", "-m", "changed head fixture");
        buildSha = git("rev-parse", "HEAD");
        assert.notEqual(buildSha, originSha);
      }
      if (variant === "build-sha") buildSha = "b".repeat(40);
      if (variant === "branch") git("checkout", "--quiet", "-b", "unqualified-negative-branch");
      writeFileSync(path.join(directory, "dist", "BUILD_INFO.json"), JSON.stringify({
        sha: buildSha, branch: "main", dirty: variant === "build-dirty", builtAt: "2026-10-18T00:00:00Z",
      }) + "\n");
      const guardUrl = new URL("src/cli/runtime-guard.ts", root).href;
      const program = `
        import assert from "node:assert/strict";
        const guard=await import(${JSON.stringify(guardUrl)});
        process.argv.push("--skip-runtime-guard");
        const select=()=>({selected:{state:{origin:{sourceSha:${JSON.stringify(originSha)}}},assertUnchanged(){}}});
        const fail=()=>{throw Error("FRESH_INSTALLATION_OPERATIONAL_ENTRY_REFUSED");};
        const invoke=new Function("selectedV1","refuse",${JSON.stringify(compiled + ";return assertRuntimeSourceV1;")})(select,fail);
        assert.throws(()=>invoke(guard),/FRESH_INSTALLATION_OPERATIONAL_ENTRY_REFUSED/);
        console.log("SOURCE_NEGATIVE_CHECKED");
      `;
      const result = spawnSync(process.execPath, ["--import", import.meta.resolve("tsx"), "--input-type=module", "-e", program], {
        cwd: directory, env: { ...process.env, TSX_DISABLE_CACHE: "1", SETFARM_REPO_DIR: directory,
          SETFARM_SKIP_RUNTIME_GUARD: "1" }, encoding: "utf8", timeout: 15_000, maxBuffer: 65_536,
      });
      assert.equal(result.error, undefined); assert.equal(result.signal, null);
      assert.equal(result.status, 0, variant + ": " + result.stderr);
      assert.equal(result.stdout, "SOURCE_NEGATIVE_CHECKED\n");
    } finally { rmSync(directory, { recursive: true, force: true }); }
  }
});

test("selected operational CLI entry precedes broad imports while custody is a separate terminal branch", () => {
  const cli = read("src/cli/cli.ts");
  const entry = cli.indexOf("await freshCliEntryV1.prepareFreshInstallationOperationalEntryV1()");
  const ordinary = cli.indexOf('await import("../installer/install.js")');
  const custody = cli.indexOf('await import("../server/fresh-installation-service-controls-v1.js")');
  assert.ok(custody >= 0 && custody < entry && entry < ordinary);
  assert.match(cli, /if \(!exactEntryDiagnostic && !freshCliCustodyHandledV1\)/);
  assert.match(cli, /if \(freshCliCustodyHandledV1\) \{[\s\S]*?\} else if \(exactEntryDiagnostic\)/);
  const beforeGeneralEntry = cli.slice(0, cli.indexOf("// Only reviewed private service/work forms"));
  assert.equal(beforeGeneralEntry.includes("prepareFreshInstallationOperationalEntryV1()"), false);
  assert.equal(beforeGeneralEntry.includes("assertRuntimeIntegrityOrExit()"), false);
  assert.equal(beforeGeneralEntry.includes('await import("../db-pg.js")'), false);
  const daemon = read("src/server/daemon.ts");
  assert.equal(daemon.includes("FRESH_INSTALLATION_DASHBOARD_CONTROL_NOT_WIRED"), false);
  const selected = daemon.indexOf("if(freshInstallationSelectionV1){await runFreshDashboardDaemonV1();}else{");
  assert.ok(selected >= 0 && selected < daemon.indexOf("fs.mkdirSync(pidDir"));
  assert.ok(selected < daemon.indexOf("fs.writeFileSync(pidFile"));
});

test("selection failure is inside the captured-owner cleanup scope and concurrent refusal joins pending cleanup", () => {
  // Source contract for the formerly uncovered pre-import failure. This does not
  // turn a .ts entry or a synthetic authority into an operational positive.
  const source = declaration("src/installation/fresh-installation-entry-v1.ts", "prepareFreshInstallationOperationalEntryV1");
  const tree = ts.createSourceFile("entry.ts", source, ts.ScriptTarget.Latest, true);
  const scopes: ts.TryStatement[] = [];
  function visit(node: ts.Node, parents: readonly ts.Node[]): void {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "selectedV1"
      && parents.filter(parent => ts.isFunctionDeclaration(parent)
        || ts.isArrowFunction(parent) || ts.isFunctionExpression(parent)).length === 1) {
      const scope = [...parents].reverse().find((parent): parent is ts.TryStatement =>
        ts.isTryStatement(parent) && parent.catchClause !== undefined);
      assert.ok(scope, "initial selection failure must reach captured-owner cleanup");
      scopes.push(scope);
    }
    ts.forEachChild(node, child => visit(child, [...parents, node]));
  }
  visit(tree, []);
  assert.equal(scopes.length, 1);
  assert.match(scopes[0]!.catchClause!.getText(tree), /await closeCapturedDatabaseV1\(owner\)/);
  const pending = source.indexOf("if (pendingV1) return pendingV1");
  const refused = source.indexOf("if (refusedV1)");
  assert.ok(pending >= 0 && refused > pending, "concurrent callers must join existing cleanup before terminal refusal");
});

test("captured cleanup DATA component shares one close attempt and cannot retarget it", async () => {
  // Pure cleanup component only: these DATA owners are not SQL clients, a
  // finalized build, selected phase or verifier authority, and admit nothing.
  const source = declaration("src/installation/fresh-installation-entry-v1.ts", "closeCapturedDatabaseV1");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const create = () => new Function(
    "let closingV1=null;" + compiled + ";return closeCapturedDatabaseV1;",
  )() as (owner: {pgClose(): Promise<void>} | null) => Promise<void>;
  const close = create();
  let calls = 0, otherCalls = 0, resolve!: () => void;
  const terminal = new Promise<void>(done => { resolve = done; });
  const first = close({ pgClose() { calls++; return terminal; } });
  assert.equal(calls, 1, "epoch fencing starts immediately, before awaiting cleanup");
  assert.equal(close({ pgClose() { otherCalls++; return Promise.resolve(); } }), first);
  assert.equal(close(null), first);
  let settled = false; first.then(() => { settled = true; });
  await Promise.resolve(); assert.equal(settled, false);
  resolve(); await first;
  assert.equal(otherCalls, 0); assert.equal(calls, 1); assert.equal(settled, true);
  const failed = create(); let failures = 0;
  const rejected = failed({ async pgClose() { failures++; throw Error("DATA_CLOSE_UNCONFIRMED"); } });
  await assert.rejects(rejected, /DATA_CLOSE_UNCONFIRMED/);
  assert.equal(failed(null), rejected);
  await assert.rejects(failed({ async pgClose() { failures++; } }), /DATA_CLOSE_UNCONFIRMED/);
  assert.equal(failures, 1, "a failed close does not silently redirect or remint cleanup");
});


for (const args of [["dashboard","start"],["spawner","start"],["workflow","install","feature-dev"],
  ["workflow","run","feature-dev","component task"],["step","peek","feature-dev_planner"],
  ["step","claim","feature-dev_planner"],["step","complete","component"],["step","fail","component","error"]]) {
  test(`actual selected Source CLI refuses ${args.slice(0,2).join(" ")} before SQL or child effects`, () => {
    const entry = new URL("src/cli/cli.ts", root).href;
    const program = `import assert from "node:assert/strict";import cp from "node:child_process";import net from "node:net";
      import {syncBuiltinESMExports} from "node:module";
      const counts={children:0,connections:0};for(const key of ["spawn","spawnSync","execFile","execFileSync","exec","execSync"])
        cp[key]=()=>{counts.children++;throw Error("UNEXPECTED_CHILD");};
      net.Socket.prototype.connect=function(){counts.connections++;throw Error("UNEXPECTED_SQL");};syncBuiltinESMExports();
      const errors=[];process.stderr.write=value=>{errors.push(String(value));return true;};process.exit=()=>{throw Error("CONTROLLED_EXIT");};
      process.argv=[process.execPath,${JSON.stringify(entry)},...${JSON.stringify(args)}];
      try{await import(${JSON.stringify(entry)});assert.fail("Source cannot admit an operational command");}
      catch(error){assert.equal(error.message,"CONTROLLED_EXIT");}
      assert.equal(errors.join(""),"FRESH_INSTALLATION_CLI_ENTRY_REFUSED\\n");assert.deepEqual(counts,{children:0,connections:0});
      console.log("SOURCE_WORK_REFUSED");`;
    const result=spawnSync(process.execPath,["--import",import.meta.resolve("tsx"),"--input-type=module","-e",program],{
      cwd:root,env:{...process.env,TSX_DISABLE_CACHE:"1",SETFARM_INSTALLATION_DIR:"/not-an-admitted-selected-installation"},
      encoding:"utf8",timeout:15_000,maxBuffer:65_536});
    assert.equal(result.error,undefined);assert.equal(result.signal,null);assert.equal(result.status,0,result.stderr);
    assert.equal(result.stdout,"SOURCE_WORK_REFUSED\n");
  });
}

test("workflow accepted JSON is bounded DATA with the exact existing persisted result fields", () => {
  const body=declaration("src/cli/cli.ts","renderWorkflowRunAcceptedV1");
  const compiled=ts.transpileModule(body,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  const render=new Function(compiled+";return renderWorkflowRunAcceptedV1;")() as (run:unknown,sha:string)=>string;
  // Data examples do not invoke runWorkflow or qualify acceptance/activation.
  const run={id:"12345678-1234-4234-8234-123456789abc",runNumber:1,workflowId:"feature-dev",protocol:"legacy",protocolVersion:1,status:"running"};
  const sha="a".repeat(40),value=render(run,sha);
  assert.ok(Buffer.byteLength(value)<=8192);assert.deepEqual(JSON.parse(value),{
    schema:"setfarm.workflow-run-accepted.v1",accepted:true,runId:run.id,runNumber:1,workflowId:"feature-dev",
    protocol:"legacy",protocolVersion:1,status:"running",compilerReleaseSha:sha});
  for(const update of [{id:"not-a-run"},{runNumber:0},{runNumber:1.5},{workflowId:"../legacy"},
    {protocol:"unknown"},{protocolVersion:2},{status:"done"}])assert.throws(()=>render({...run,...update},sha),/WORKFLOW_RUN_ACCEPTED_RESULT_INVALID/);
  assert.throws(()=>render(run,"not-a-build"),/WORKFLOW_RUN_ACCEPTED_RESULT_INVALID/);
  const cli=read("src/cli/cli.ts"),actual=cli.lastIndexOf("const run = await runWorkflow({"),ack=cli.indexOf("renderWorkflowRunAcceptedV1(run, compilerReleaseSha)",actual);
  assert.ok(actual>=0&&ack>actual);assert.ok(cli.indexOf("resolveNewRunProtocol({",cli.indexOf('if (action === "run")'))<actual);
  assert.ok(cli.includes("if (freshCliEntryV1) await pgClose();"));
  assert.ok(cli.includes("(jsonOutput ? console.error : console.log)(`Spawner started"));
});

test("workflow JSON option preserves protocol/task arguments and rejects duplicate output flags",()=>{
  const body=declaration("src/cli/cli.ts","extractWorkflowRunOutputArgumentV1");
  const compiled=ts.transpileModule(body,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  const extract=new Function(compiled+";return extractWorkflowRunOutputArgumentV1;")() as (args:string[])=>unknown;
  assert.deepEqual(extract(["--json","@task","--protocol","v3"]),{jsonOutput:true,remainingArgs:["@task","--protocol","v3"]});
  assert.deepEqual(extract(["literal task"]),{jsonOutput:false,remainingArgs:["literal task"]});
  assert.throws(()=>extract(["--json","@task","--json"]),/WORKFLOW_RUN_JSON_FLAG_INVALID/);
  const cli=read("src/cli/cli.ts");assert.ok(cli.includes("readUtf8RegularFileAtMostSync(taskTitle.slice(1), 2 * 1024 * 1024).text.trim()"));
  assert.ok(cli.includes("if (!freshCliEntryV1 && !forceQuota)"),"selected Codex cannot probe/choose legacy Kimi fallback");
});

test("fixed selected script context cannot be retargeted by mutable workflow context DATA",()=>{
  const source=declaration("src/installer/context-ops.ts","resolveTemplate");
  const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/^export /gm,"");
  let checks=0;
  const build=(selection:unknown)=>new Function("freshInstallationSelectionV1","assertFreshInstallationSelectionUnchangedV1","fs",compiled+";return resolveTemplate;")(
    selection,()=>{checks++;},new Proxy({},{get(){throw Error("UNEXPECTED_FS");}})) as (template:string,context:Record<string,string>)=>string;
  const template='bash "{{setfarm_scripts_dir|$HOME/.openclaw/setfarm-repo/scripts}}/setup-repo.sh"';
  const context={setfarm_scripts_dir:"/mutable/foreign"};
  assert.equal(build({paths:{scripts:"/fixed release/scripts"}})(template,context),'bash "/fixed release/scripts/setup-repo.sh"');
  assert.equal(context.setfarm_scripts_dir,"/mutable/foreign");assert.equal(checks,1);
  assert.equal(build(null)(template,{}),'bash "$HOME/.openclaw/setfarm-repo/scripts/setup-repo.sh"');
  assert.equal(build(null)(template,context),'bash "$HOME/.openclaw/setfarm-repo/scripts/setup-repo.sh"',"legacy literal prefix cannot be retargeted by the new reserved key");
  const workflow=read("workflows/feature-dev/workflow.yml");
  assert.equal((workflow.match(/\{\{setfarm_scripts_dir\|/g)||[]).length,4);
});
