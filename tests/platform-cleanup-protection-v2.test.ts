import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const source = new URL("../src/installer/platform-cleanup-protection-v2.ts", import.meta.url).href;
const inheritedImport = process.execArgv[process.execArgv.indexOf("--import") + 1];
const loader = inheritedImport && path.isAbsolute(inheritedImport)
  ? inheritedImport : createRequire(import.meta.url).resolve("tsx");
const refused = "SETFARM_PROTECTED_BASELINE_CLEANUP_REFUSED";
const ts = createRequire(loader)("typescript") as typeof import("typescript");
function consumer(relative: string, name: string): string {
  const filename = new URL(relative, import.meta.url);
  const text = fs.readFileSync(filename, "utf8");
  const parsed = ts.createSourceFile(filename.pathname, text, ts.ScriptTarget.ES2022, true);
  const selected = parsed.statements.filter(statement => (ts.isFunctionDeclaration(statement)
      && (relative.includes("uninstall") || statement.name?.text === name))
    || (ts.isVariableStatement(statement) && statement.declarationList.declarations.some(declaration =>
      ts.isIdentifier(declaration.name) && ["WORKSPACE_PRESERVED", "DEFAULT_CRON_SESSION_RETENTION", "DEFAULT_SESSION_MAINTENANCE"].includes(declaration.name.text))));
  const compiled = ts.transpileModule(selected.map(statement => statement.getText(parsed)).join("\n"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    transformers: { before: [context => root => {
      const visit = (node: import("typescript").Node): import("typescript").VisitResult<import("typescript").Node> =>
        ts.isMetaProperty(node) ? ts.factory.createIdentifier("importMeta") : ts.visitEachChild(node, visit, context);
      return ts.visitNode(root, visit) as import("typescript").SourceFile;
    }] },
  }).outputText;
  return `const {fs,path,os,logger,getAgentWorkspacePath,killWorktreeProcesses,assertCleanupTargetOutsideBaselineV2,
readOpenClawConfig,writeOpenClawConfig,removeMainAgentGuidance,removeSubagentAllowlist,pgQuery,pgRun,pgGet,removeAgentCrons,
resolveWorkflowDir,resolveWorkflowWorkspaceDir,resolveWorkflowRoot,resolveWorkflowWorkspaceRoot,resolveSetfarmRoot,
stopDaemon,uninstallSetfarmSkill,deleteAgentCronJobs,execSync}=env;const importMeta={dirname:${JSON.stringify(path.dirname(fileURLToPath(filename)))}};
const exports={};${compiled};return exports[${JSON.stringify(name)}];`;
}
async function fixture(body: string, setup = "", present = true): Promise<any> {
  const home = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-cleanup-protection-v2-")));
  const baseline = path.join(home, "ai/setrox/data/internal-production-baseline");
  fs.mkdirSync(present ? baseline : path.dirname(baseline), { recursive: true, mode: 0o700 });
  const program = `import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
const home=${JSON.stringify(home)},baseline=${JSON.stringify(baseline)};const account=os.userInfo();let ports=0;
os.userInfo=()=>{ports++;return{...account,homedir:home}};
${setup}
const out={};let api;const call=target=>{try{api.assertCleanupTargetOutsideBaselineV2(target);return null}catch(e){return e.message}};
try{api=await import(${JSON.stringify(source)});${body}}catch(e){out.error=e.message}
process.stdout.write(JSON.stringify(out));`;
  // The guard itself performs no deletion, signals or DB work. Keep all fixtures.
  const child = spawn(process.execPath, ["--import", loader, "--input-type=module", "-e", program],
    { cwd: "/", env: {}, stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "", stderr = "", unknown: Error | undefined, bytes = 0;
  const eof = { stdout: false, stderr: false };
  child.on("error", error => { unknown ??= error; });
  for (const [stream, name] of [[child.stdout, "stdout"], [child.stderr, "stderr"]] as const) {
    stream.on("error", error => { unknown ??= error; });
    stream.on("end", () => { eof[name] = true; });
    stream.on("data", (chunk: Buffer) => {
      bytes += chunk.length; if (bytes > 1048576) { unknown ??= Error("CAPTURE_UNKNOWN"); return; }
      if (name === "stdout") stdout += chunk; else stderr += chunk;
    });
  }
  const [status, signal] = await new Promise<[number | null, NodeJS.Signals | null]>(resolve => child.on("close", (code, sig) => resolve([code, sig])));
  assert.equal(unknown, undefined); assert.equal(signal, null); assert.equal(status, 0, stderr);
  assert.deepEqual(eof, { stdout: true, stderr: true }); assert.equal(stderr, "");
  return JSON.parse(stdout);
}

function uninstallCliBranch(): string {
  const filename = new URL("../src/cli/cli.ts", import.meta.url);
  const parsed = ts.createSourceFile(filename.pathname, fs.readFileSync(filename, "utf8"), ts.ScriptTarget.ES2022, true);
  const selected: import("typescript").IfStatement[] = [];
  const visit = (node: import("typescript").Node): void => {
    if (ts.isIfStatement(node)) {
      let uninstall = false;
      const condition = (part: import("typescript").Node): void => {
        if (ts.isBinaryExpression(part) && part.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken
          && ts.isIdentifier(part.left) && part.left.text === "group"
          && ts.isStringLiteral(part.right) && part.right.text === "uninstall") uninstall = true;
        ts.forEachChild(part, condition);
      };
      condition(node.expression);
      if (uninstall) selected.push(node);
    }
    ts.forEachChild(node, visit);
  };
  visit(parsed); assert.equal(selected.length, 1);
  return `const {group,args,process,console,assertOrdinarySpawnerDeploymentCutoverAdmissionV1,checkActiveRuns,
isRunning,stopDaemon,uninstallAllWorkflows}=env;return(async()=>{${selected[0].getText(parsed)}})();`;
}

for (const protectedTarget of [true, false]) {
  test(`CLI uninstall ${protectedTarget ? "refuses protected targets before PID inspection or daemon stop" : "reaches one callee stop only after disjoint preflight"}`, async () => {
    const cli = uninstallCliBranch(), factory = consumer("../src/installer/uninstall.ts", "uninstallAllWorkflows");
    const out = await fixture(`const effects=[],events=[];const dirs=name=>path.join(home,'.openclaw',name);
const record={id:'owned_workflow_agent',agentDir:${protectedTarget ? "baseline" : "dirs('agent-root')"}+'/.openclaw/agents/demo/agent'},config={agents:{list:[record]}};
const effect=name=>()=>{effects.push(name);throw Error('OWNED_MUTATION')};
const uninstaller=new Function('env',${JSON.stringify(factory)})({fs:{...fs.promises,rm:effect('rm')},path,os,
readOpenClawConfig:async()=>{events.push('config-read');return{path:dirs('config.json'),config}},writeOpenClawConfig:effect('write-config'),
removeMainAgentGuidance:effect('guidance'),removeSubagentAllowlist:effect('allowlist'),pgQuery:effect('database'),pgRun:effect('database'),
resolveWorkflowRoot:()=>dirs('workflows'),resolveWorkflowWorkspaceRoot:()=>dirs('workspaces'),resolveSetfarmRoot:()=>dirs('setfarm'),
stopDaemon(){events.push('callee-stop');effects.push('callee-stop');throw Error('OWNED_MUTATION')},
uninstallSetfarmSkill:effect('skill'),deleteAgentCronJobs:effect('cron'),execSync:effect('exec'),assertCleanupTargetOutsideBaselineV2:api.assertCleanupTargetOutsideBaselineV2});
const env={group:'uninstall',args:['uninstall','--force'],process:{stdin:{isTTY:false},stderr:{write:effect('stderr')},exit:effect('exit')},console:{log:effect('success-log')},
assertOrdinarySpawnerDeploymentCutoverAdmissionV1(){events.push('ordinary-admission')},checkActiveRuns:async()=>{events.push('active-run-read');return[]},
isRunning(){events.push('pid-inspection');return{running:true}},stopDaemon:effect('caller-stop'),
uninstallAllWorkflows:async()=>{events.push('callee-entry');await uninstaller()}};
try{await new Function('env',${JSON.stringify(cli)})(env)}catch(e){out.refused=e.message}
out.effects=effects;out.events=events;out.configSame=config.agents.list.length===1&&config.agents.list[0]===record;`);
    assert.equal(out.error, undefined, JSON.stringify(out));
    assert.equal(out.refused, protectedTarget ? refused : "OWNED_MUTATION");
    assert.deepEqual(out.effects, protectedTarget ? [] : ["callee-stop"]);
    assert.deepEqual(out.events, protectedTarget
      ? ["ordinary-admission", "active-run-read", "callee-entry", "config-read"]
      : ["ordinary-admission", "active-run-read", "callee-entry", "config-read", "callee-stop"]);
    assert.equal(out.configSame, true);
  });
}

for (const target of ["home", "path.dirname(baseline)", "baseline", "path.join(baseline,'retained')"]) {
  test(`protects existing reserved target ${target} without changing bytes`, async () => {
    const out = await fixture(`out.result=call(${target});out.same=fs.readFileSync(path.join(baseline,'retained'),'utf8')==='original';`,
      "fs.writeFileSync(path.join(baseline,'retained'),'original');");
    assert.equal(out.error, undefined, JSON.stringify(out)); assert.equal(out.result, refused); assert.equal(out.same, true);
  });
}
test("protects absent baseline and future child, never treating ENOENT as cleanup permission", async () => {
  const out = await fixture(`out.results=[call(path.dirname(baseline)),call(baseline),call(path.join(baseline,'future'))];`, "", false);
  assert.equal(out.error, undefined, JSON.stringify(out)); assert.deepEqual(out.results, [refused, refused, refused]);
});
test("physically disjoint generated directories and their absent descendants remain permitted", async () => {
  const out = await fixture(`out.results=[call(workspace),call(path.join(workspace,'missing','child'))];`,
    "const workspace=path.join(home,'.openclaw','workspace');fs.mkdirSync(workspace,{recursive:true});");
  assert.equal(out.error, undefined, JSON.stringify(out)); assert.deepEqual(out.results, [null, null]);
});
test("workspace alias to protected parent refuses physically", async () => {
  const out = await fixture(`out.result=call(alias);`, "const alias=path.join(home,'alias');fs.symlinkSync(path.dirname(baseline),alias);");
  assert.equal(out.error, undefined, JSON.stringify(out)); assert.equal(out.result, refused);
});
test("workspace nested under protected alias refuses physically", async () => {
  const out = await fixture(`out.result=call(path.join(alias,'future'));`, "const alias=path.join(home,'alias');fs.symlinkSync(baseline,alias);");
  assert.equal(out.error, undefined, JSON.stringify(out)); assert.equal(out.result, refused);
});
test("broken-link and nondirectory unresolved ancestry refuse rather than becoming disjoint", async () => {
  const out = await fixture(`out.results=[call(alias),call(path.join(file,'future'))];`,
    "const alias=path.join(home,'broken'),file=path.join(home,'file');fs.symlinkSync('/unresolved-owned-cleanup-target',alias);fs.writeFileSync(file,'original');");
  assert.equal(out.error, undefined, JSON.stringify(out)); assert.deepEqual(out.results, [refused, refused]);
});
test("invalid caller values invoke no account or filesystem ports", async () => {
  const out = await fixture(`let traps=0;const proxy=new Proxy({},{get(){traps++;throw Error('TRAP')}});const before=ports;
out.results=[null,{},proxy,'','relative','/nul\\0name','/'+ 'x'.repeat(16385)].map(call);out.ports=ports-before;out.traps=traps;`,
    "for(const name of ['lstatSync','realpathSync','readlinkSync']){const original=fs[name];fs[name]=(...args)=>{ports++;return original(...args)}}");
  assert.equal(out.error, undefined, JSON.stringify(out)); assert.ok(out.results.every((value: unknown) => value === refused));
  assert.equal(out.ports, 0); assert.equal(out.traps, 0);
});
test("unresolved path components are bounded before filesystem traversal", async () => {
  const out = await fixture(`out.result=call(path.join(home,...Array(129).fill('segment')));`);
  assert.equal(out.error, undefined, JSON.stringify(out)); assert.equal(out.result, refused);
});
test("literal dot components cannot guard a lexically normalized symlink deletion path", async () => {
  const out = await fixture(`const before=ports;out.results=[call(alias+'/../internal-production-baseline'),call(alias+'/./future')];out.ports=ports-before;`,
    "const alias=path.join(home,'alias');fs.symlinkSync(baseline,alias);for(const name of ['lstatSync','realpathSync','readlinkSync']){const original=fs[name];fs[name]=(...args)=>{ports++;return original(...args)}}");
  assert.equal(out.error, undefined, JSON.stringify(out)); assert.deepEqual(out.results, [refused, refused]); assert.equal(out.ports, 0);
});
test("Darwin absent reserved ASCII case alias refuses conservatively", { skip: process.platform !== "darwin" }, async () => {
  const out = await fixture(`out.result=call(path.join(path.dirname(baseline),'INTERNAL-PRODUCTION-BASELINE','future'));`, "", false);
  assert.equal(out.error, undefined, JSON.stringify(out)); assert.equal(out.result, refused);
});
test("reserved baseline symlink still protects its original namespace parent", async () => {
  const out = await fixture(`out.result=call(path.dirname(baseline));out.disjoint=call(path.join(home,'.openclaw','workspace'));`,
    "const destination=path.join(home,'elsewhere');fs.mkdirSync(destination);fs.symlinkSync(destination,baseline);", false);
  assert.equal(out.error, undefined, JSON.stringify(out)); assert.equal(out.result, refused); assert.equal(out.disjoint, null);
});
test("an observed workspace alias retargeted during final account bracket refuses", async () => {
  const out = await fixture(`out.result=call(alias);out.triggered=accounts;out.target=fs.readlinkSync(alias);`,
    "const destination=path.join(home,'elsewhere'),alias=path.join(home,'alias');fs.mkdirSync(destination);fs.symlinkSync(destination,alias);let accounts=0;const who=os.userInfo;os.userInfo=()=>{const a=who();if(++accounts===2){fs.unlinkSync(alias);fs.symlinkSync(baseline,alias)}return a};");
  assert.equal(out.error, undefined, JSON.stringify(out)); assert.equal(out.result, refused); assert.equal(out.triggered, 2);
});
test("a formerly absent target redirected into baseline during the bracket refuses without repinning", async () => {
  const out = await fixture(`out.result=call(workspace);out.triggered=accounts;`,
    "const workspace=path.join(home,'missing');let accounts=0;const who=os.userInfo;os.userInfo=()=>{const a=who();if(++accounts===2)fs.symlinkSync(baseline,workspace);return a};");
  assert.equal(out.error, undefined, JSON.stringify(out)); assert.equal(out.result, refused); assert.equal(out.triggered, 2);
});
// Evaluate real AST-extracted consumer bodies, with real guard/path observations.
// Mutation ports are fail-fast traps, never live cleanup/DB/process operations;
// this does not qualify complete CLI/runtime-guard/import composition.
test("agent workspace consumer refuses baseline ancestor before stale unlink, process-kill or recursive deletion", async () => {
  const factory = consumer("../src/installer/worktree-ops.ts", "cleanAgentWorkspace");
  const out = await fixture(`const effects=[];const io={...fs,rmSync(){effects.push('rm');throw Error('OWNED_MUTATION')},unlinkSync(){effects.push('unlink');throw Error('OWNED_MUTATION')}};
const clean=new Function('env',${JSON.stringify(factory)})({fs:io,path,os,logger:{warn(){},info(){}},getAgentWorkspacePath:()=>path.dirname(baseline),
killWorktreeProcesses(){effects.push('kill')},assertCleanupTargetOutsideBaselineV2:api.assertCleanupTargetOutsideBaselineV2});
try{clean('owned-fixture')}catch(e){out.refused=e.message}out.effects=effects;`);
  assert.equal(out.error, undefined, JSON.stringify(out)); assert.equal(out.refused, refused); assert.deepEqual(out.effects, []);
});
for (const name of ["uninstallWorkflow", "uninstallAllWorkflows"]) {
  test(`${name} validates configured deletion targets before any config, daemon, database or deletion effect`, async () => {
    const factory = consumer("../src/installer/uninstall.ts", name);
    const out = await fixture(`const effects=[],record={id:'owned_workflow_agent',agentDir:baseline+'/.openclaw/agents/demo/agent'},config={agents:{list:[record]}};
const effect=name=>()=>{effects.push(name);throw Error('OWNED_MUTATION')};const dirs=name=>path.join(home,'.openclaw',name);
const fn=new Function('env',${JSON.stringify(factory)})({fs:{...fs.promises,rm:effect('rm')},path,os,
readOpenClawConfig:async()=>({path:dirs('config.json'),config}),writeOpenClawConfig:effect('write-config'),removeMainAgentGuidance:effect('guidance'),
removeSubagentAllowlist:effect('allowlist'),pgQuery:effect('database'),pgRun:effect('database'),removeAgentCrons:effect('cron'),
resolveWorkflowDir:()=>dirs('workflows/demo'),resolveWorkflowWorkspaceDir:()=>dirs('workspaces/demo'),resolveWorkflowRoot:()=>dirs('workflows'),
resolveWorkflowWorkspaceRoot:()=>dirs('workspaces'),resolveSetfarmRoot:()=>dirs('setfarm'),stopDaemon:effect('stop-daemon'),
uninstallSetfarmSkill:effect('skill'),deleteAgentCronJobs:effect('cron'),execSync:effect('exec'),
assertCleanupTargetOutsideBaselineV2:api.assertCleanupTargetOutsideBaselineV2});
try{await fn({workflowId:'owned_workflow',removeGuidance:false})}catch(e){out.refused=e.message}
out.effects=effects;out.configSame=config.agents.list.length===1&&config.agents.list[0]===record;`);
    assert.equal(out.error, undefined, JSON.stringify(out)); assert.equal(out.refused, refused); assert.deepEqual(out.effects, []);
    assert.equal(out.configSame, true);
  });
  test(`${name} permits a disjoint finite preflight before its first ordinary effect`, async () => {
    const factory = consumer("../src/installer/uninstall.ts", name);
    const out = await fixture(`const effects=[],record={id:'owned_workflow_agent',agentDir:home+'/.openclaw/agents/demo/agent'},config={agents:{list:[record]}};
const effect=name=>()=>{effects.push(name);throw Error('OWNED_FIRST_EFFECT')};const dirs=name=>path.join(home,'.openclaw',name);
const fn=new Function('env',${JSON.stringify(factory)})({fs:{...fs.promises,rm:effect('rm')},path,os,
readOpenClawConfig:async()=>({path:dirs('config.json'),config}),writeOpenClawConfig:effect('write-config'),removeMainAgentGuidance:effect('guidance'),
removeSubagentAllowlist:effect('allowlist'),pgQuery:effect('database'),pgRun:effect('database'),removeAgentCrons:effect('cron'),
resolveWorkflowDir:()=>dirs('workflows/demo'),resolveWorkflowWorkspaceDir:()=>dirs('workspaces/demo'),resolveWorkflowRoot:()=>dirs('workflows'),
resolveWorkflowWorkspaceRoot:()=>dirs('workspaces'),resolveSetfarmRoot:()=>dirs('setfarm'),stopDaemon:effect('stop-daemon'),
uninstallSetfarmSkill:effect('skill'),deleteAgentCronJobs:effect('cron'),execSync:effect('exec'),
assertCleanupTargetOutsideBaselineV2:api.assertCleanupTargetOutsideBaselineV2});
try{await fn({workflowId:'owned_workflow',removeGuidance:false})}catch(e){out.refused=e.message}out.effects=effects;`);
    assert.equal(out.error, undefined, JSON.stringify(out)); assert.equal(out.refused, "OWNED_FIRST_EFFECT");
    assert.deepEqual(out.effects, [name === "uninstallWorkflow" ? "allowlist" : "stop-daemon"]);
  });
  test(`${name} rechecks the original captured target after an awaited path observation`, async () => {
    const factory = consumer("../src/installer/uninstall.ts", name);
    const out = await fixture(`const deletions=[],config={agents:{list:[]}};const dirs=name=>path.join(home,'.openclaw',name);
const target=dirs('${name === "uninstallWorkflow" ? "workflows/demo" : "workflows"}');fs.mkdirSync(target,{recursive:true});let redirected=false;
const io={...fs.promises,access:async name=>{if(name===target&&!redirected){fs.renameSync(target,target+'-original');fs.symlinkSync(baseline,target);redirected=true}return fs.promises.access(name)},
rm:async name=>{deletions.push(name);throw Error('OWNED_DELETE_PORT')}};
const noop=()=>{};const fn=new Function('env',${JSON.stringify(factory)})({fs:io,path,os,
readOpenClawConfig:async()=>({path:dirs('config.json'),config}),writeOpenClawConfig:noop,removeMainAgentGuidance:noop,
removeSubagentAllowlist:noop,pgQuery:async()=>[],pgRun:noop,removeAgentCrons:noop,
resolveWorkflowDir:()=>dirs('workflows/demo'),resolveWorkflowWorkspaceDir:()=>dirs('workspaces/demo'),resolveWorkflowRoot:()=>dirs('workflows'),
resolveWorkflowWorkspaceRoot:()=>dirs('workspaces'),resolveSetfarmRoot:()=>dirs('setfarm'),stopDaemon:noop,
uninstallSetfarmSkill:noop,deleteAgentCronJobs:noop,execSync:noop,assertCleanupTargetOutsideBaselineV2:api.assertCleanupTargetOutsideBaselineV2});
try{await fn({workflowId:'owned_workflow',removeGuidance:false})}catch(e){out.refused=e.message}out.deletions=deletions;out.redirected=redirected;out.originalRetained=fs.existsSync(target+'-original');`);
    assert.equal(out.error, undefined, JSON.stringify(out)); assert.equal(out.refused, refused);
    assert.equal(out.redirected, true); assert.equal(out.originalRetained, true); assert.deepEqual(out.deletions, []);
  });
}
test("workspace entry-level refusal cannot fall through into unlink or process-delete fallback", async () => {
  const factory = consumer("../src/installer/worktree-ops.ts", "cleanAgentWorkspace");
  const out = await fixture(`const effects=[],workspace=path.join(home,'.openclaw','workspace'),alias=path.join(workspace,'alias');fs.mkdirSync(workspace,{recursive:true});fs.symlinkSync(baseline,alias);
const io={...fs,rmSync(){effects.push('rm');throw Error('OWNED_MUTATION')},unlinkSync(){effects.push('unlink');throw Error('OWNED_MUTATION')}};
const clean=new Function('env',${JSON.stringify(factory)})({fs:io,path,os,logger:{warn(){},info(){}},getAgentWorkspacePath:()=>workspace,
killWorktreeProcesses(){effects.push('kill')},assertCleanupTargetOutsideBaselineV2:api.assertCleanupTargetOutsideBaselineV2});
clean('owned-fixture');out.effects=effects;out.aliasRetained=fs.readlinkSync(alias)===baseline;`);
  assert.equal(out.error, undefined, JSON.stringify(out)); assert.deepEqual(out.effects, []); assert.equal(out.aliasRetained, true);
});
test("an indirect workspace symlink hop retargeted during the bracket refuses", async () => {
  const out = await fixture(`out.result=call(aliasA);out.triggered=accounts;`,
    "const destination=path.join(home,'elsewhere'),aliasA=path.join(home,'aliasA'),aliasB=path.join(home,'aliasB');fs.mkdirSync(destination);fs.symlinkSync(destination,aliasB);fs.symlinkSync(aliasB,aliasA);let accounts=0;const who=os.userInfo;os.userInfo=()=>{const a=who();if(++accounts===2){fs.renameSync(aliasB,aliasB+'-original');fs.symlinkSync(baseline,aliasB)}return a};");
  assert.equal(out.error, undefined, JSON.stringify(out)); assert.equal(out.result, refused); assert.equal(out.triggered, 2);
});
test("baseline indirect symlink also protects the namespace containing the intermediate link", async () => {
  const out = await fixture(`out.result=call(path.dirname(aliasB));`,
    "const destination=path.join(home,'elsewhere'),container=path.join(home,'links'),aliasB=path.join(container,'aliasB');fs.mkdirSync(destination);fs.mkdirSync(container);fs.symlinkSync(destination,aliasB);fs.symlinkSync(aliasB,baseline);", false);
  assert.equal(out.error, undefined, JSON.stringify(out)); assert.equal(out.result, refused);
});
test("workspace rechecks a file-like alias between consumer lstat and unlink dispatch", async () => {
  const factory = consumer("../src/installer/worktree-ops.ts", "cleanAgentWorkspace");
  const out = await fixture(`const effects=[],workspace=path.join(home,'.openclaw','workspace'),alias=path.join(workspace,'alias'),destination=path.join(home,'elsewhere');
fs.mkdirSync(workspace,{recursive:true});fs.mkdirSync(destination);fs.symlinkSync(destination,alias);let retargeted=0;
const io={...fs,lstatSync(name,...args){if(name===alias){fs.renameSync(alias,alias+'-original');fs.symlinkSync(baseline,alias);retargeted++}return fs.lstatSync(name,...args)},
rmSync(){effects.push('rm');throw Error('OWNED_MUTATION')},unlinkSync(){effects.push('unlink');throw Error('OWNED_MUTATION')}};
const clean=new Function('env',${JSON.stringify(factory)})({fs:io,path,os,logger:{warn(){},info(){}},getAgentWorkspacePath:()=>workspace,
killWorktreeProcesses(){effects.push('kill')},assertCleanupTargetOutsideBaselineV2:api.assertCleanupTargetOutsideBaselineV2});
clean('owned-fixture');out.effects=effects;out.retargeted=retargeted;out.originalRetained=fs.existsSync(alias+'-original');`);
  assert.equal(out.error, undefined, JSON.stringify(out)); assert.equal(out.retargeted, 1); assert.equal(out.originalRetained, true);
  assert.deepEqual(out.effects, []);
});
test("a disjoint regular file leaf remains eligible for ordinary cleanup", async () => {
  const out = await fixture(`out.result=call(file);out.same=fs.readFileSync(file,'utf8')==='original';`,
    "const file=path.join(home,'generated.txt');fs.writeFileSync(file,'original');");
  assert.equal(out.error, undefined, JSON.stringify(out)); assert.equal(out.result, null); assert.equal(out.same, true);
});
test("relative symlink target dots follow the physical intermediate hop, not its lexical parent", async () => {
  const out = await fixture(`out.result=call(aliasA);`,
    "const workspace=path.join(home,'.openclaw','workspace');fs.mkdirSync(workspace,{recursive:true});fs.mkdirSync(path.join(baseline,'nested'));const aliasA=path.join(workspace,'aliasA'),aliasB=path.join(workspace,'aliasB');fs.symlinkSync(path.join(baseline,'nested'),aliasB);fs.symlinkSync('aliasB/..',aliasA);");
  assert.equal(out.error, undefined, JSON.stringify(out)); assert.equal(out.result, refused);
});
test("cyclic links refuse within the nominated hop budget", async () => {
  const out = await fixture(`out.result=call(alias);out.hops=hops;`,
    "const alias=path.join(home,'cycle');fs.symlinkSync('cycle',alias);let hops=0;const read=fs.readlinkSync;fs.readlinkSync=(...args)=>{hops++;return read(...args)};");
  assert.equal(out.error, undefined, JSON.stringify(out)); assert.equal(out.result, refused); assert.equal(out.hops, 16);
});
test("inaccessible metadata refuses rather than being mistaken for missing disjoint ancestry", async () => {
  const out = await fixture(`out.result=call(path.join(home,'unreadable','child'));out.unknowns=unknowns;`,
    "let unknowns=0;const stat=fs.lstatSync;fs.lstatSync=(name,...args)=>{if(name===path.join(home,'unreadable')){unknowns++;const e=Error('OWNED_METADATA_UNKNOWN');e.code='EACCES';throw e}return stat(name,...args)};");
  assert.equal(out.error, undefined, JSON.stringify(out)); assert.equal(out.result, refused); assert.equal(out.unknowns, 1);
});
