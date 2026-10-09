import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { test } from "node:test";
import ts from "typescript";

const repository = fileURLToPath(new URL("../..", import.meta.url));
const sources = [
  ["src/cli/cli.ts", "dist/cli/cli.js"],
  ["src/internal-production/baseline-deployment-cutover-v1.ts", "dist/internal-production/baseline-deployment-cutover-v1.js"],
  ["src/internal-production/baseline-workspace-authority-path-v1.ts", "dist/internal-production/baseline-workspace-authority-path-v1.js"],
  ["src/internal-production/baseline-deployment-cutover-records-v1.ts", "dist/internal-production/baseline-deployment-cutover-records-v1.js"],
  ["src/product-compiler/canonical-json.ts", "dist/product-compiler/canonical-json.js"],
];
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const refusal = "DEPLOYMENT_CUTOVER_CLI_ENTRY_REFUSED\n";

test("static runtime closure is fixed, event types erased and existing CLI body byte-exact", () => {
  const source = fs.readFileSync(path.join(repository, sources[0][0]), "utf8");
  const tree = ts.createSourceFile("cli.ts", source, ts.ScriptTarget.ES2022, true);
  const imports = tree.statements.filter(ts.isImportDeclaration);
  const runtime = imports.filter(node => !node.importClause?.isTypeOnly).map(node => node.moduleSpecifier.text);
  const expected = ["../internal-production/baseline-deployment-cutover-v1.js", "node:child_process", "node:fs", "node:url", "node:path"];
  assert.deepEqual(runtime, expected);
  const event = imports.find(node => node.moduleSpecifier.text === "../installer/events.js");
  assert.equal(event?.importClause?.isTypeOnly, true);
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  const compiledTree = ts.createSourceFile("cli.js", compiled, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS);
  assert.deepEqual(compiledTree.statements.filter(ts.isImportDeclaration).map(node => node.moduleSpecifier.text), expected);
  const fence = tree.statements.find(node => ts.isIfStatement(node) && node.expression.getText(tree) === "!exactEntryDiagnostic");
  assert.ok(fence);
  const deferred = tree.statements.filter(node => ts.isVariableStatement(node)
    && node.declarationList.declarations.some(declaration => declaration.initializer && ts.isAwaitExpression(declaration.initializer)));
  assert.equal(deferred.length, 31);
  for (const statement of deferred) {
    assert.ok(statement.pos >= fence.end, "IMPORT_PRECEDES_INITIAL_FENCE");
    const declaration = statement.declarationList.declarations[0];
    const call = declaration.initializer.expression;
    assert.ok(ts.isCallExpression(call) && call.expression.kind === ts.SyntaxKind.ImportKeyword);
    assert.equal(call.arguments.length, 1); assert.ok(ts.isStringLiteral(call.arguments[0]));
  }
  const tail = source.slice(source.indexOf("const __filename ="));
  // Reviewed pre-change 0561dc99 body: intentional command changes must explicitly update this regression pin.
  assert.equal(hash(tail), "98f19fb0b0141eb4fb238ce9a59b78dc32acbedb5f1363b8bb65053459cfaf61");
});

function businessBindings(source) {
  const tree = ts.createSourceFile("cli.ts", source, ts.ScriptTarget.ES2022, true);
  const modules = new Map();
  const add = (locator, names) => {
    if (!locator.startsWith(".")) return;
    const set = modules.get(locator) ?? new Set();
    for (const name of names) set.add(name);
    modules.set(locator, set);
  };
  const visit = node => {
    if (ts.isImportDeclaration(node) && node.importClause && !node.importClause.isTypeOnly
      && ts.isStringLiteral(node.moduleSpecifier)) {
      const bindings = node.importClause.namedBindings;
      if (bindings && ts.isNamedImports(bindings)) add(node.moduleSpecifier.text,
        bindings.elements.filter(row => !row.isTypeOnly).map(row => row.propertyName?.text ?? row.name.text));
    }
    if (ts.isVariableDeclaration(node) && ts.isObjectBindingPattern(node.name) && node.initializer
      && ts.isAwaitExpression(node.initializer) && ts.isCallExpression(node.initializer.expression)
      && node.initializer.expression.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const argument = node.initializer.expression.arguments[0];
      if (argument && ts.isStringLiteral(argument)) add(argument.text,
        node.name.elements.map(row => row.propertyName?.getText(tree) ?? row.name.getText(tree)));
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return [...modules].map(([locator, names]) => [locator, [...names]]);
}

async function runCli({ mode = "open", argv = ["step", "claim", "fixture-agent"], cutpoint = "resolve", environment = {} } = {}) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-cli-entry-v4-")));
  const home = path.join(root, "account"), workspace = path.join(home, "ai/setrox");
  fs.mkdirSync(workspace, { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(root, "package.json"), '{"type":"module"}\n', { mode: 0o600 });
  const bridges = sources.map(([locator, output]) => {
    const text = fs.readFileSync(path.join(repository, locator), "utf8");
    const translated = ts.transpileModule(text, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
    }).outputText;
    const target = path.join(root, output);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, translated, { mode: 0o600 });
    return { locator, output, text, sourceHash: hash(text), translated, outputHash: hash(translated) };
  });
  const cli = path.join(root, "dist/cli/cli.js");
  const records = await import(pathToFileURL(path.join(root, sources[3][1])).href);
  const field = "a".repeat(64), sha = "b".repeat(40);
  const deployment = { checkoutPath: "/fixture/old-source", checkoutDirectoryIdentityHash: field,
    sourceSha: sha, sourceTreeHash: "c".repeat(40), buildHash: field };
  const intent = records.encodeDeploymentCutoverIntentV1(records.createDeploymentCutoverIntentV1({
    oldDeployment: deployment, newDeployment: { ...deployment, checkoutPath: "/fixture/new-source" },
    cliLinkObservationHash: field, spawnerLauncherConfigurationHash: field,
    dashboardLauncherConfigurationHash: field, maintenanceIntentHash: field, dashboardPort: 3333,
  }));
  const journal = path.join(workspace, "data/internal-production-baseline/deployment-cutover-v1");
  if (mode !== "absent" && mode !== "late-open") {
    fs.mkdirSync(journal, { recursive: true, mode: 0o700 });
    fs.writeFileSync(path.join(journal, mode === "partial" ? "unexpected" : "intent.json"),
      mode === "malformed" ? "PRIVATE_RECORD\n" : intent, { mode: 0o600 });
    if (mode === "unsafe") fs.chmodSync(journal, 0o755);
  }
  const qualified = bridges.slice(1).map(row => pathToFileURL(path.join(root, row.output)).href);
  const business = businessBindings(bridges[0].text).map(([locator, names]) => [
    new URL(locator, pathToFileURL(cli)).href, names,
  ]).filter(([url]) => !qualified.includes(url));
  const observationFile = path.join(root, "child-observation.json");
  const program = `import fs from 'node:fs';import os from 'node:os';
import {registerHooks,isBuiltin,syncBuiltinESMExports} from 'node:module';
const originals={write:fs.writeFileSync,mkdir:fs.mkdirSync,open:fs.openSync,close:fs.closeSync};
const state={businessResolves:[],businessEvaluations:[],latePublished:false,observerCloseLosses:0};
process.on('exit',()=>originals.write(${JSON.stringify(observationFile)},JSON.stringify(state),{mode:0o600}));
const account=os.userInfo();os.userInfo=()=>({...account,homedir:${JSON.stringify(home)}});
const mode=${JSON.stringify(mode)},cutpoint=${JSON.stringify(cutpoint)};
if(mode==='close-loss'){
 const observerFds=new Set(),workspace=${JSON.stringify(workspace)};
 fs.openSync=(target,...args)=>{
  const fd=originals.open(target,...args);
  if(typeof target==='string'&&(target===workspace||target.startsWith(workspace+'/')))observerFds.add(fd);
  return fd;
 };
 fs.closeSync=fd=>{
  const observed=observerFds.delete(fd);originals.close(fd);
  if(observed){state.observerCloseLosses++;throw Error('PRIVATE_CLOSE_ERROR')}
 };
}
syncBuiltinESMExports();
const qualified=new Set(${JSON.stringify(qualified)}),business=new Map(${JSON.stringify(business)});
registerHooks({
 resolve(specifier,context,next){
   if(isBuiltin(specifier))return next(specifier,context);
   const url=new URL(specifier,context.parentURL).href;
   if(url===${JSON.stringify(pathToFileURL(cli).href)}||qualified.has(url))return next(specifier,context);
   const names=business.get(url);if(!names)throw Error('CLI_FIXTURE_UNQUALIFIED_RESOLUTION');
   state.businessResolves.push(url);
   if(mode==='late-open'&&!state.latePublished){
     originals.mkdir(${JSON.stringify(journal)},{recursive:true,mode:0o700});
     originals.write(${JSON.stringify(path.join(journal, "intent.json"))},Buffer.from(${JSON.stringify(intent.toString("base64"))},'base64'),{mode:0o600,flag:'wx'});
     state.latePublished=true;
   }
   if(cutpoint==='resolve')throw Error('FORBIDDEN_BUSINESS_RESOLUTION');
   const source="globalThis.businessEvaluations.push("+JSON.stringify(url)+");throw Error('FORBIDDEN_BUSINESS_EVALUATION');"+
     names.map(name=>"export function "+name+"(){}").join(';');
   return{url:'data:text/javascript,'+encodeURIComponent(source),shortCircuit:true};
 }
});
globalThis.businessEvaluations=state.businessEvaluations;
`;
  const preload = path.join(root, "preload.mjs");
  fs.writeFileSync(preload, program, { mode: 0o600 });
  const command = [process.execPath, "--import", preload, cli, ...argv];
  fs.writeFileSync(path.join(root, "original-inputs.json"),
    JSON.stringify({ schema: "setfarm.source-cli-entry-fixture.v4", bridges, program, command,
      sourceOnly: true, manualOutputs: true, nativeCalls: 0, qualified, business,
      canonicalIntentBase64: intent.toString("base64"), mode, cutpoint, environment }), { mode: 0o600 });
  const child = spawn(command[0], command.slice(1), { cwd: "/", env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C", ...environment },
    stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "", stderr = "", error = null, exit = null;
  const eof = { stdout: false, stderr: false }, closed = { stdout: false, stderr: false };
  for (const [name, stream] of [["stdout", child.stdout], ["stderr", child.stderr]]) {
    stream.on("data", bytes => { if (name === "stdout") stdout += bytes; else stderr += bytes; });
    stream.on("error", cause => { error ??= cause.message; });
    stream.on("end", () => { eof[name] = true; });
    stream.on("close", () => { closed[name] = true; });
  }
  child.on("error", cause => { error ??= cause.message; });
  child.on("exit", (status, signal) => { exit = { status, signal }; });
  const result = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error("CLI_FIXTURE_DRIVER_TIMEOUT_ORIGINAL_RETAINED")), 10000);
    child.on("close", (status, signal) => { clearTimeout(timer); resolve({ status, signal }); });
  });
  const snapshot = JSON.parse(fs.readFileSync(observationFile, "utf8"));
  const row = { root, ...result, error, exit, eof, closed, stdout, stderr, ...snapshot };
  fs.writeFileSync(path.join(root, "original-result.json"), JSON.stringify(row), { mode: 0o600 });
  process.stdout.write(JSON.stringify({ kind: "cli-entry-source-only-original", root, ...result, eof, closed }) + "\n");
  assert.equal(error, null); assert.equal(result.signal, null);
  assert.deepEqual(exit, result); assert.deepEqual(eof, { stdout: true, stderr: true });
  assert.deepEqual(closed, { stdout: true, stderr: true });
  assert.doesNotMatch(stderr, /CLI_FIXTURE_UNQUALIFIED_RESOLUTION/);
  return row;
}

for (const cutpoint of ["resolve", "evaluate"]) test(`initial genuine OPEN stops ordinary absolute compiled CLI before business ${cutpoint}`, async () => {
  const row = await runCli({ cutpoint });
  assert.equal(row.businessResolves.length, 0, "INITIAL_OPEN_REACHED_BUSINESS_RESOLUTION");
  assert.equal(row.businessEvaluations.length, 0, "INITIAL_OPEN_REACHED_BUSINESS_EVALUATION");
  assert.equal(row.status, 1); assert.equal(row.stdout, ""); assert.equal(row.stderr, refusal);
});

test("genuine absent workspace reaches the fixed normal dependency boundary", async () => {
  const row = await runCli({ mode: "absent" });
  assert.ok(row.businessResolves.length > 0);
  assert.equal(row.status, 1); assert.equal(row.stdout, "");
  assert.match(row.stderr, /FORBIDDEN_BUSINESS_RESOLUTION/);
});

for (const mode of ["partial", "malformed", "unsafe", "close-loss"]) test(`initial ${mode} refuses without observer private errors or business ports`, async () => {
  const row = await runCli({ mode, cutpoint: "evaluate" });
  assert.equal(row.businessResolves.length, 0); assert.equal(row.businessEvaluations.length, 0);
  assert.equal(row.status, 1); assert.equal(row.stdout, ""); assert.equal(row.stderr, refusal);
  assert.doesNotMatch(row.stderr, /PRIVATE_|\/account|OBSERVATION_INVALID/);
  if (mode === "close-loss") assert.ok(row.observerCloseLosses > 0, "OBSERVER_CLOSE_LOSS_NOT_ARMED");
});

for (const argv of [
  [], ["version"], ["dashboard", "start"], ["spawner", "restart"], ["workflow", "run", "fixture-workflow"],
  ["update", "--skip-runtime-guard"], ["platform-release", "preflight"],
  ["platform-release", "preflight", "--json", "extra"], ["platform-release", "preflight", "--json", "--json"],
]) test(`initial OPEN blocks ordinary argv ${JSON.stringify(argv)} before fixed imports`, async () => {
  const row = await runCli({ argv, cutpoint: "evaluate" });
  assert.equal(row.businessResolves.length, 0); assert.equal(row.businessEvaluations.length, 0);
  assert.equal(row.status, 1); assert.equal(row.stdout, ""); assert.equal(row.stderr, refusal);
});

test("only existing exact diagnostic argv reaches its dependency boundary while OPEN", async () => {
  const row = await runCli({ argv: ["platform-release", "preflight", "--json"] });
  assert.ok(row.businessResolves.length > 0); assert.equal(row.businessEvaluations.length, 0);
  assert.equal(row.status, 1); assert.equal(row.stdout, "");
  assert.match(row.stderr, /FORBIDDEN_BUSINESS_RESOLUTION/);
  // Deliberate stop before readiness/business execution: no diagnostic receipt or authority fabricated.
});

test("existing runtime-guard environment bypass does not bypass initial OPEN refusal", async () => {
  const row = await runCli({ environment: { SETFARM_SKIP_RUNTIME_GUARD: "1", SETFARM_REPO_DIR: "/fixture/not-a-repo" }, cutpoint: "evaluate" });
  assert.equal(row.businessResolves.length, 0); assert.equal(row.businessEvaluations.length, 0);
  assert.equal(row.status, 1); assert.equal(row.stdout, ""); assert.equal(row.stderr, refusal);
});

test("late OPEN is not claimed excluded by the initial-only admission fence", async () => {
  const row = await runCli({ mode: "late-open", cutpoint: "evaluate" });
  assert.equal(row.latePublished, true); assert.ok(row.businessResolves.length > 0);
  assert.equal(row.businessEvaluations.length, 1); assert.equal(row.status, 1);
  assert.equal(row.stdout, ""); assert.match(row.stderr, /FORBIDDEN_BUSINESS_EVALUATION/);
});
