import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, lstatSync, realpathSync, rmSync, writeFileSync, existsSync, chmodSync, renameSync, openSync, closeSync, fstatSync, constants } from "node:fs";
import { registerHooks } from "node:module";
import { Script } from "node:vm";
import { tmpdir } from "node:os";
import path from "node:path";
import { test, type TestContext } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

import type { PgTransactionSql } from "../../src/db-pg.js";
import type { PersistWorkflowRunInputV1 } from "../../src/execution/run-persistence.js";
import { createV3ReleaseAdmissionRepository } from "../../src/execution/v3-release-admission-repository.js";
import { ContentAddressedEvalResultStore } from "../../src/evals/report.js";
import { loadConvergenceSuite, convergenceCaseHash } from "../../src/evals/suite-schema.js";
import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { seedCanonicalSetupBuildCompilerStoryAdmissionFixture } from "./helpers/compiler-story-admission-fixture.js";
import { observeProcessIdentity } from "../../src/execution/process-identity.js";
import { createIsolatedTestDatabase, type OwnedP3ReadinessObservationV1 } from "./test-database.js";

const SOURCE_SHA = "b".repeat(40);
const SOURCE_ROOT = realpathSync(fileURLToPath(new URL("../../", import.meta.url)));
const MANUAL_URL = new URL("../../src/execution/manual-test-admission-v1.js", import.meta.url);
const PERSISTENCE_URL = new URL("../../src/execution/run-persistence.js", import.meta.url);

function validateOwnedP3ReadinessBinding(input: unknown, expected: {database:string;parentPid:number;projectionRoot:string;projectedHead:string;descriptorHash:string}): asserts input is OwnedP3ReadinessObservationV1 {
  const fail = (): never => { throw new Error("P3_READINESS_COMPONENT_BINDING_REFUSED"); };
  const keys = (value:unknown,wanted:string[]) => value !== null && typeof value === "object"
    && Object.getPrototypeOf(value) === Object.prototype && JSON.stringify(Object.keys(value)) === JSON.stringify(wanted);
  if (!keys(input,["schema","database","parentPid","projectionRoot","projectedHead","markerHash","sourcePins","status","ready","descriptorHash"])) fail();
  const value = input as OwnedP3ReadinessObservationV1;
  if (value.schema !== "setfarm.owned-p3-readiness-observation.v1" || !Number.isSafeInteger(value.parentPid) || value.parentPid <= 0
    || !/^setfarm_p3_[a-f0-9]{24}_clone_[a-f0-9]{12}$/.test(value.database)
    || !/^[a-f0-9]{40}$/.test(value.projectedHead) || !/^[a-f0-9]{64}$/.test(value.markerHash)
    || (Object.keys(expected) as (keyof typeof expected)[]).some(key=>value[key] !== expected[key])) fail();
  const inventory = ["src/db-pg.ts","tests/execution-attempts/test-database.ts","tests/execution-attempts/manual-test-admission-v1.isolated-pg.test.ts","src/internal-production/baseline-spawner-startup-admission-v1.js"];
  if (!Array.isArray(value.sourcePins) || value.sourcePins.length !== inventory.length
    || value.sourcePins.some((pin,index)=>!keys(pin,["relative","sha256"]) || pin.relative !== inventory[index] || !/^[a-f0-9]{64}$/.test(pin.sha256))) fail();
  if (!keys(value.status,["state","admissionReady"]) || value.status.state !== "normal_task0_admission_ready"
    || !keys(value.status.admissionReady,["admissionReadyHash","admissionReadyRef"])
    || !keys(value.ready,["state","admissionReadyRef","admissionReadyHash","manifestActivationRef","manifestActivationHash","manifestHeadRef","manifestHeadHash"])
    || value.ready.state !== "normal-task0-admission-ready"
    || !/^[a-f0-9]{64}$/.test(value.ready.admissionReadyHash)
    || value.ready.admissionReadyRef !== "setfarm://tests/p3/admission-ready/sha256/"+value.ready.admissionReadyHash
    || value.status.admissionReady.admissionReadyRef !== value.ready.admissionReadyRef
    || value.status.admissionReady.admissionReadyHash !== value.ready.admissionReadyHash
    || !/^[a-f0-9]{64}$/.test(value.ready.manifestActivationHash) || !/^[a-f0-9]{64}$/.test(value.ready.manifestHeadHash)
    || typeof value.ready.manifestActivationRef !== "string" || typeof value.ready.manifestHeadRef !== "string") fail();
  const {descriptorHash,...body} = value;
  if (hashCanonicalJson(body) !== descriptorHash) fail();
}

function ownedP3ReadinessAdapterSource(observation: OwnedP3ReadinessObservationV1,
  fault: "none" | "crossed_database" | "unknown_reference", faultMarker: string): string {
  const expected = {database:observation.database,parentPid:process.pid,projectionRoot:SOURCE_ROOT,projectedHead:observation.projectedHead,descriptorHash:observation.descriptorHash};
  validateOwnedP3ReadinessBinding(observation,expected);
  const tree=ts.createSourceFile("binding.ts",readFileSync(fileURLToPath(import.meta.url),"utf8"),ts.ScriptTarget.Latest,true);
  const node=tree.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==="validateOwnedP3ReadinessBinding");assert.ok(node);
  const validator=ts.transpileModule(node.getText(tree),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
  return `import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
const observation=${JSON.stringify(observation)},expected=${JSON.stringify(expected)},fault=${JSON.stringify(fault)};
const fail=()=>{throw new Error('P3_READINESS_COMPONENT_BINDING_REFUSED')};
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function readPinned(file){const fd=fs.openSync(file,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);try{const before=fs.fstatSync(fd);if(!before.isFile()||before.nlink!==1||before.uid!==process.getuid()||before.size>2000000||fs.realpathSync(file)!==file)fail();const bytes=fs.readFileSync(fd);const after=fs.fstatSync(fd),current=fs.lstatSync(file);for(const s of [after,current])for(const k of ['dev','ino','uid','mode','nlink','size','mtimeMs','ctimeMs'])if(s[k]!==before[k])fail();return bytes;}finally{fs.closeSync(fd)}}
function assertSource(){if(process.ppid!==expected.parentPid||fs.realpathSync(expected.projectionRoot)!==expected.projectionRoot)fail();const markerFile=path.join(expected.projectionRoot,'.setfarm-p3-projection-marker.json');const bytes=readPinned(markerFile);if(hash(bytes)!==observation.markerHash)fail();const marker=JSON.parse(bytes);if(marker.projectionRoot!==expected.projectionRoot||marker.projectedHead!==expected.projectedHead)fail();for(const pin of observation.sourcePins)if(hash(readPinned(path.join(expected.projectionRoot,pin.relative)))!==pin.sha256)fail();}
assertSource();
const {hashCanonicalJson}=await import(${JSON.stringify(pathToFileURL(path.join(SOURCE_ROOT,"src/product-compiler/canonical-json.ts")).href)});
${validator}
function injectMarker(){fs.writeFileSync(${JSON.stringify(faultMarker)},JSON.stringify({fault,point:'readiness_adapter'})+'\\n',{mode:0o600,flag:'wx'})}
if(fault==='crossed_database'){injectMarker();observation.database='setfarm_p3_'+'0'.repeat(24)+'_clone_'+'0'.repeat(12);}
validateOwnedP3ReadinessBinding(observation,expected);assertSource();
function freeze(value){if(value&&typeof value==='object'){for(const nested of Object.values(value))freeze(nested);Object.freeze(value)}}freeze(observation);freeze(expected);
const db=await import(${JSON.stringify(pathToFileURL(path.join(SOURCE_ROOT,"src/db-pg.ts")).href)});assertSource();
async function verify(){assertSource();validateOwnedP3ReadinessBinding(observation,expected);const sql=db.getSql();
const identity=async()=>{assertSource();const rows=await sql.begin('isolation level repeatable read read only',async s=>{await s.unsafe("SET LOCAL statement_timeout = '5s'");return s.unsafe('SELECT current_database() AS database')});assertSource();if(rows.length!==1||rows[0].database!==expected.database||db.getSql()!==sql)fail()};
await identity();assertSource();const current=await db.resolveCurrentInternalProductionOwnerProducerManifestSetActivationV1();assertSource();
if(!current||current.receipt.phase!=='A'||current.receipt.activationRef!==observation.ready.manifestActivationRef||current.receipt.activationHash!==observation.ready.manifestActivationHash||current.head.headRef!==observation.ready.manifestHeadRef||current.head.headHash!==observation.ready.manifestHeadHash)fail();
await identity();assertSource();}
export async function observeInternalProductionPreSchemaSpawnerRebindStatusV1(){await verify();assertSource();return observation.status}
export async function resolveInternalProductionTask0SpawnerAdmissionReadyV1(pair){await verify();assertSource();if(fault==='unknown_reference'){injectMarker();pair={...pair,admissionReadyRef:'unknown'};}if(!pair||Object.getPrototypeOf(pair)!==Object.prototype||JSON.stringify(Object.keys(pair))!==JSON.stringify(['admissionReadyRef','admissionReadyHash'])||pair.admissionReadyRef!==observation.ready.admissionReadyRef||pair.admissionReadyHash!==observation.ready.admissionReadyHash)fail();return observation.ready}
`;
}

test("P3 readonly readiness observation binding rejects crossed identities", () => {
  // Pure synthetic descriptor contract only; no database/readiness qualification.
  const body = {schema:"setfarm.owned-p3-readiness-observation.v1",database:"setfarm_p3_"+"a".repeat(24)+"_clone_"+"b".repeat(12),
    parentPid:process.pid,projectionRoot:SOURCE_ROOT,projectedHead:"c".repeat(40),markerHash:"d".repeat(64),
    sourcePins:["src/db-pg.ts","tests/execution-attempts/test-database.ts","tests/execution-attempts/manual-test-admission-v1.isolated-pg.test.ts","src/internal-production/baseline-spawner-startup-admission-v1.js"].map(relative=>({relative,sha256:"e".repeat(64)})),
    status:{state:"normal_task0_admission_ready",admissionReady:{admissionReadyHash:"f".repeat(64),admissionReadyRef:"setfarm://tests/p3/admission-ready/sha256/"+"f".repeat(64)}},
    ready:{state:"normal-task0-admission-ready",admissionReadyRef:"setfarm://tests/p3/admission-ready/sha256/"+"f".repeat(64),admissionReadyHash:"f".repeat(64),manifestActivationRef:"activation",manifestActivationHash:"1".repeat(64),manifestHeadRef:"head",manifestHeadHash:"2".repeat(64)}};
  const observation={...body,descriptorHash:hashCanonicalJson(body)};
  const expected={database:body.database,parentPid:body.parentPid,projectionRoot:body.projectionRoot,projectedHead:body.projectedHead,descriptorHash:observation.descriptorHash};
  assert.doesNotThrow(()=>validateOwnedP3ReadinessBinding(observation,expected));
  const serialized=JSON.parse(JSON.stringify(observation));
  validateOwnedP3ReadinessBinding(serialized,expected);
  for (const fault of ["none","crossed_database","unknown_reference"] as const)
    assert.deepEqual(ts.transpileModule(ownedP3ReadinessAdapterSource(serialized,fault,"/owned/marker"),
      {reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).diagnostics,[]);
  for(const field of ["database","parentPid","projectionRoot","projectedHead","descriptorHash"] as const)
    assert.throws(()=>validateOwnedP3ReadinessBinding(observation,{...expected,[field]:field==="parentPid"?124:"crossed"}),/P3_READINESS_COMPONENT_BINDING_REFUSED/);
  assert.throws(()=>validateOwnedP3ReadinessBinding({...observation,extra:true},expected),/P3_READINESS_COMPONENT_BINDING_REFUSED/);
  assert.throws(()=>validateOwnedP3ReadinessBinding({...observation,ready:{...body.ready,admissionReadyRef:"unknown"}},expected),/P3_READINESS_COMPONENT_BINDING_REFUSED/);
});

// Explicit OS fixture boundary: parent harness identity/table remain injected.
// Only the default CLI child and its descendants use actual captured OS rows;
// Authenticated readonly P3 readiness observations are an additional explicit
// component boundary; this is not compiled selection/readiness qualification.
function childTableObservationSource(owner: {pid:number;processGroupId:number}, argv: string[], repository: string): string {
  return `function processTableV1(){const rows=actualProcessTableV1();const keep=new Set([${owner.pid}]);
    for(const row of rows)if(row.parentPid===${owner.pid}&&row.command.startsWith(${JSON.stringify(argv[0]+" "+path.join(repository,"dist/cli/cli.js")+" ")}))keep.add(row.pid);
    for(let n=0;n<rows.length;n++){let added=false;for(const row of rows)if(row.parentPid!==${owner.pid}&&keep.has(row.parentPid)&&!keep.has(row.pid)){keep.add(row.pid);added=true;}if(!added)break;}
    return rows.filter(row=>keep.has(row.pid)).map(row=>row.pid===${owner.pid}?{...row,processGroupId:${owner.processGroupId},command:${JSON.stringify(argv.join(" "))}}:row);}`;
}

type SafeStartDiagnostic = { name: string; code: string | null; frames: string[] };
function exactContextForEntry(contexts: readonly import("../../src/execution/v3-release-admission.js").InternalCanaryAdmissionContextV1[],
  entry: Parameters<typeof convergenceCaseHash>[0]) {
  const matching = contexts.filter(context => context.caseHash === convergenceCaseHash(entry)
    && context.taskHash === hashCanonicalJson(entry.task) && context.repetition === 1);
  assert.equal(matching.length, 1, "The intended case must have exactly one matching stored canary context");
  return matching[0]!;
}
function safeStartDiagnostic(error: unknown): SafeStartDiagnostic {
  const value = error as {name?:unknown;message?:unknown;code?:unknown;stack?:unknown} | null;
  const names = ["Error", "TypeError", "RangeError", "ZodError", "ControlWorkerFatalErrorV1", "PostgresError"];
  const codes = ["ENOENT","EEXIST","EACCES","EPERM","ELOOP","EINVAL","CONTROL_START_UNRESOLVED","CHILD_EXIT_NONZERO",
    "MANUAL_EVALUATION_OWNERSHIP_UNKNOWN","MANUAL_EVALUATION_PROOF_MISSING","MANUAL_EVALUATION_ENTRY_REFUSED",
    "MANUAL_EVALUATION_CUSTODY_REQUIRED","MANUAL_EVALUATION_RESERVED","MANUAL_EVALUATION_ACTIVITY",
    "FIXTURE_ENTRY_REFUSED","FIXTURE_OS_OBSERVATION_UNKNOWN","FIXTURE_SELECTED_LOCATOR_CHANGED","OWNED_CLONE_IDENTITY_REFUSED",
    "ISOLATED_TEST_DATABASE_ALREADY_CONNECTED","ISOLATED_TEST_DATABASE_URL_REJECTED",
    "INTERNAL_PRODUCTION_CURRENT_ENTRY_MANIFEST_A_NOT_CURRENT","INTERNAL_PRODUCTION_CURRENT_ENTRY_MIGRATION_32_INVALID",
    "INTERNAL_PRODUCTION_CURRENT_ENTRY_MIGRATION_33_INVALID","INTERNAL_PRODUCTION_CURRENT_ENTRY_MIGRATION_UNKNOWN_VERSION",
    "RUN_PERSISTENCE_ADMISSION_READY_IDENTITY_INVALID","RUN_PERSISTENCE_ADMISSION_READY_UNAVAILABLE",
    "P3_READINESS_COMPONENT_BINDING_REFUSED",
    "RUN_PERSISTENCE_READINESS_MODULE_NAMESPACE_INVALID","TASK6A_RESTRICTED_DATABASE_NOT_VERIFIED",
    "SETFARM_BASE_SCHEMA_VERIFY_INCOMPLETE","SETFARM_BASE_SCHEMA_VERIFY_REFUSED","DASHBOARD_CUTOVER_ORDINARY_DATABASE_REFUSED",
    "FRESH_INSTALLATION_INCOMPATIBLE_DATABASE_PROFILE","RUN_RELEASE_ADMISSION_IDENTITY_INVALID",
    "RUN_RELEASE_ADMISSION_REQUIRED","RUN_RELEASE_ADMISSION_KIND_INVALID","RUN_PERSISTENCE_DATABASE_TIME_UNAVAILABLE"];
  const allowedCode = (candidate: unknown): candidate is string => typeof candidate === "string" && candidate.length <= 128
    && codes.includes(candidate);
  const code = allowedCode(value?.message) ? value.message : allowedCode(value?.code) ? value.code
    : typeof value?.code === "string" && /^[0-9A-Z]{5}$/.test(value.code) ? value.code
    : typeof value?.code === "number" && value.code !== 0 ? "CHILD_EXIT_NONZERO" : null;
  const frames: string[] = [];
  if (typeof value?.stack === "string") for (const line of value.stack.slice(0,8192).split("\n").slice(1,17)) {
    const frame = /^\s+at (?:([A-Za-z0-9_.$<>]{1,96}) \()?[^\n]*[/\\]([A-Za-z0-9_.-]{1,96}\.(?:ts|mjs|cjs|js)):(\d{1,6}):(\d{1,6})\)?$/.exec(line);
    if (frame) frames.push(`${frame[1] ?? "anonymous"} ${frame[2]}:${frame[3]}:${frame[4]}`);
    else {
      // A transformed data-URL frame may lack a usable Source line. Retain
      // only its bounded function name; never return any part of that URI.
      const functionOnly = /^\s+at ([A-Za-z0-9_.$<>]{1,96}) \(/.exec(line);
      if (functionOnly) frames.push(functionOnly[1]!);
    }
    if (frames.length === 6) break;
  }
  return {name:typeof value?.name === "string" && names.includes(value.name) ? value.name : "OtherError",code,frames};
}

function parseSafeChildDiagnostic(bytes: string) {
  try {
    if (Buffer.byteLength(bytes) > 4096) return null;
    const value = JSON.parse(bytes);
    if (!value || value.schema !== "setfarm.owned-component-child-diagnostic.v1" || value.cleanup !== "unknown"
      || !["import_database","configure_database","initialize_database","verify_database_identity","import_persistence","inject_fault","verify_context","persist_run","cleanup"].includes(value.stage)) return null;
    const failure = value.failure;
    if (!failure || !Array.isArray(failure.frames) || failure.frames.length > 6
      || failure.frames.some((frame: unknown) => typeof frame !== "string"
        || !/^[A-Za-z0-9_.$<>]{1,96}(?: [A-Za-z0-9_.-]{1,96}\.(?:ts|mjs|cjs|js):\d{1,6}:\d{1,6})?$/.test(frame))) return null;
    const safe = safeStartDiagnostic({name:failure.name,code:failure.code});
    if (safe.name !== failure.name || safe.code !== failure.code) return null;
    const canonical = {schema:value.schema,stage:value.stage,cleanup:"unknown",failure:{name:safe.name,code:safe.code,frames:failure.frames}};
    return bytes === JSON.stringify(canonical)+"\n" ? canonical : null;
  } catch { return null; }
}

function readSafeChildDiagnostic(locator: string) {
  let fd: number | undefined;
  try {
    fd = openSync(locator,constants.O_RDONLY|constants.O_NOFOLLOW);
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.nlink !== 1 || stat.uid !== process.getuid!() || (stat.mode & 0o7777) !== 0o600 || stat.size > 4096) return null;
    const bytes = readFileSync(fd,"utf8"), after = fstatSync(fd), current = lstatSync(locator);
    if (current.isSymbolicLink() || [after,current].some(observed =>
      (["dev","ino","uid","mode","nlink","size","mtimeMs","ctimeMs"] as const).some(key => observed[key] !== stat[key]))) return null;
    return parseSafeChildDiagnostic(bytes);
  } catch { return null; } finally { if (fd !== undefined) closeSync(fd); }
}

/** Root-approved component scope: only the new module's immutable locator
 * observation is replaced. DB preparation, pgBegin, the common fence, run
 * persistence, canary validation/consumption and terminal settlement stay real.
 * This supplies no compiled selected-entry or privileged recovery authority. */
async function fixture(t: TestContext, entryKind: "worker" | "direct" = "worker", actualChild = false) {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), "setfarm-manual-admission-")));
  const rootPin = lstatSync(root);
  const runtime = path.join(root, "runtime");
  const evals = path.join(runtime, "evals");
  for (const directory of [runtime, evals, path.join(evals, "results")]) mkdirSync(directory, { mode: 0o700 });
  const repositoryRoot = actualChild ? path.join(root, "release") : SOURCE_ROOT;
  if (actualChild) {
    for (const directory of [repositoryRoot,path.join(repositoryRoot,"dist"),path.join(repositoryRoot,"dist/cli"),path.join(repositoryRoot,"evals"),path.join(repositoryRoot,"evals/suites")]) mkdirSync(directory,{mode:0o700});
    writeFileSync(path.join(repositoryRoot,"evals/suites/product-convergence-codex-v1.json"),readFileSync(path.join(SOURCE_ROOT,"evals/suites/product-convergence-codex-v1.json")),{mode:0o600});
  }
  const fixtureId = randomUUID(); let jobId: string = randomUUID();
  const identity = observeProcessIdentity(process.pid);
  assert.ok(identity && identity.source === "observed_os" && identity.processGroupId);
  const { schema: _schema, ...osIdentity } = identity;
  const executable = realpathSync(process.execPath);
  const script = path.join(repositoryRoot, entryKind === "worker" ? "dist/cli/control-test-worker-v1.js" : "dist/evals/convergence-runner.js");
  const workerArgv = entryKind === "worker" ? [executable, script, "--job-id", jobId]
    : [executable, script, "--suite", path.join(repositoryRoot, "evals/suites/product-convergence-codex-v1.json"), "--output-root", path.join(evals, "results")];
  const owner = Object.freeze({ ...osIdentity, processGroupId: identity.processGroupId, source: "observed_os" as const, executable, script, commandHash: createHash("sha256").update(workerArgv.join(" ")).digest("hex") });
  const faults = { rollbackAfterCallback: false, censusOverlay: null as Record<string, unknown> | null, transactionBackendPid: null as number | null, startPublication: null as null | {state:"published" | "refused"; failure:SafeStartDiagnostic | null} };
  const faultKey = `setfarm.manual-test-fault.${fixtureId}`;
  Reflect.set(globalThis, Symbol.for(faultKey), faults);
  const selected = {
    directory: root,
    paths: { root: runtime, repository: repositoryRoot, evals: path.join(evals, "results") },
    state: { origin: { sourceSha: SOURCE_SHA, installationId: fixtureId } },
    catalogHash: "c".repeat(64),
    activation: { acknowledged: true, preparedPin: { sha256: "e".repeat(64) }, activatedPin: { sha256: "f".repeat(64) } },
  };
  const selectionHash = hashCanonicalJson({
    schema: "setfarm.manual-control-selection.v1", installationId: fixtureId, sourceSha: SOURCE_SHA,
    installationDir: root, releaseDir: repositoryRoot, catalogHash: selected.catalogHash,
    activationPreparedHash: selected.activation.preparedPin.sha256,
    activationAcknowledgedHash: selected.activation.activatedPin.sha256,
  });
  const selectionSource = `
    import {lstatSync} from 'node:fs';
    const selected=${JSON.stringify(selected)};
    const pins=[selected.directory,selected.paths.root,selected.paths.evals].map(path=>({path,stat:lstatSync(path)}));
    export function assertFreshInstallationSelectionUnchangedV1(){for(const pin of pins){const current=lstatSync(pin.path);if(!current.isDirectory()||current.isSymbolicLink()||current.dev!==pin.stat.dev||current.ino!==pin.stat.ino||current.uid!==pin.stat.uid||(current.mode&511)!==448)throw new Error('FIXTURE_SELECTED_LOCATOR_CHANGED')}}
    selected.assertUnchanged=assertFreshInstallationSelectionUnchangedV1;
    function freeze(value){if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value)}}freeze(selected);
    export const freshInstallationSelectionV1=selected;
    export function selectedFreshInstallationRootV1(){assertFreshInstallationSelectionUnchangedV1();return selected.paths.root}
  `;
  const selectionUrl = `data:text/javascript;base64,${Buffer.from(selectionSource).toString("base64")}`;
  // Negative fault ports only: execute real SQL before corrupting a census,
  // or throw after the real transaction callback to cause a real rollback.
  const databaseUrl = new URL("../../src/db-pg.ts", import.meta.url).href;
  const faultSource = `
    export * from ${JSON.stringify(databaseUrl)};
    import * as db from ${JSON.stringify(databaseUrl)};
    const fault=globalThis[Symbol.for(${JSON.stringify(faultKey)})];
    export function pgBegin(callback){return db.pgBegin(async sql=>{
      const identity=await sql.unsafe("SELECT pg_backend_pid() AS pid");
      fault.transactionBackendPid=identity[0].pid;
      const observed=new Proxy(sql,{get(target,key){if(key==='unsafe')return async(query,...args)=>{
        const rows=await target.unsafe(query,...args);
        if(fault.censusOverlay&&/AS\\s+active_runs/i.test(query))return rows.map(row=>({...row,...fault.censusOverlay}));
        return rows;
      };const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;}});
      const result=await callback(observed);
      if(fault.rollbackAfterCallback)throw new Error('INJECTED_MANUAL_TRANSACTION_ROLLBACK');
      return result;
    })}
  `;
  const faultUrl = `data:text/javascript;base64,${Buffer.from(faultSource).toString("base64")}`;
  const processUrl = `data:text/javascript;base64,${Buffer.from(`import real from 'node:process';export default new Proxy(real,{get(target,key){if(key==='argv')return Object.freeze(${JSON.stringify(workerArgv)});if(key==='execArgv')return Object.freeze([]);const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;}})`).toString("base64")}`;
  const entryUrl = `data:text/javascript;base64,${Buffer.from(`import {assertFreshInstallationSelectionUnchangedV1} from ${JSON.stringify(selectionUrl)};export function assertFreshInstallationOperationalEntryV1(){assertFreshInstallationSelectionUnchangedV1()}`).toString("base64")}`;
  const hooks = registerHooks({
    resolve(specifier, context, nextResolve) {
      const parent = context.parentURL ?? "";
      if (parent.includes(`manual-test-admission-v1.`) && parent.includes(`manual-fixture=${fixtureId}`)
        && /fresh-installation-selection-v1\.[jt]s$/.test(specifier)) {
        return { url: selectionUrl, shortCircuit: true };
      }
      if (parent.includes("manual-test-admission-v1.") && parent.includes(`manual-fixture=${fixtureId}`)) {
        if (specifier === "node:process") return { url: processUrl, shortCircuit: true };
        if (/fresh-installation-entry-v1\.[jt]s$/.test(specifier)) return { url: entryUrl, shortCircuit: true };
      }
      if (parent.includes("manual-test-admission-v1.") && parent.includes(`manual-fixture=${fixtureId}`)
        && /(?:^|\/)db-pg\.[jt]s$/.test(specifier)) return { url: faultUrl, shortCircuit: true };
      if (parent.includes("convergence-runner.") && parent.includes(`manual-fixture=${fixtureId}`)
        && /manual-test-admission-v1\.[jt]s$/.test(specifier)) return nextResolve(`${specifier}?manual-fixture=${fixtureId}`,context);
      if (parent.includes("run-persistence.") && parent.includes(`manual-fixture=${fixtureId}`)
        && /manual-test-admission-v1\.[jt]s$/.test(specifier)) {
        return nextResolve(`${specifier}?manual-fixture=${fixtureId}${parent.includes("pre-worker") ? "&pre-worker" : ""}`, context);
      }
      return nextResolve(specifier, context);
    },
    load(url, context, nextLoad) {
      const loaded = nextLoad(url, context);
      if (!url.includes("/manual-test-admission-v1.") || !url.includes(`manual-fixture=${fixtureId}`)) return loaded;
      const source = typeof loaded.source === "string" ? loaded.source : new TextDecoder().decode(loaded.source!);
      const tree = ts.createSourceFile("observation-component.ts", source, ts.ScriptTarget.Latest, true);
      // These three complete observation functions alone receive immutable
      // component facts. Neither admission, persistence nor SQL is substituted.
      const replacements: Record<string, string> = {
        entryV1: `function entryV1(kind){if(kind!==${JSON.stringify(entryKind)})throw new Error('FIXTURE_ENTRY_REFUSED');return Object.freeze(${JSON.stringify(owner)})}`,
        processOwnerV1: `function processOwnerV1(pid,script,executable){const owner=Object.freeze(${JSON.stringify(owner)});if(pid!==owner.pid||script!==owner.script||executable!==owner.executable)throw new Error('FIXTURE_OS_OBSERVATION_UNKNOWN');return owner}`,
        processTableV1: `function processTableV1(){return ${JSON.stringify(url.includes("pre-worker") ? [] : [{pid:owner.pid,parentPid:process.ppid,processGroupId:owner.processGroupId,command:workerArgv.join(" ")}])}}`,
      };
      const edits = tree.statements.filter(ts.isFunctionDeclaration).filter(node => node.name && replacements[node.name.text])
        .map(node => ({ start: node.getStart(tree), end: node.end, text: replacements[node.name!.text]! }));
      assert.equal(edits.length, 3);
      if (actualChild) {
        const originalOwner = tree.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==="processOwnerV1")!.getText(tree).replace("function processOwnerV1(","function actualProcessOwnerV1(");
        const originalTable = tree.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==="processTableV1")!.getText(tree).replace("function processTableV1(","function actualProcessTableV1(");
        replacements.processOwnerV1 = `function processOwnerV1(pid,script,executable){if(pid===${owner.pid})return ${JSON.stringify(owner)};return actualProcessOwnerV1(pid,script,executable);}`;
        replacements.processTableV1 = childTableObservationSource(owner,workerArgv,repositoryRoot);
        for (const edit of edits) { const node=tree.statements.find(node=>node.getStart(tree)===edit.start)! as ts.FunctionDeclaration; edit.text=replacements[node.name!.text]!; }
        // Existing parent entry/OS observations are fixture facts; exact child
        // identities and descendants come from the production OS observer.
        // Observe the exact original publisher without changing its body,
        // argument identities, result or thrown error. Never retain raw input/error text.
        const diagnosticTree = ts.createSourceFile("diagnostic.ts",readFileSync(fileURLToPath(import.meta.url),"utf8"),ts.ScriptTarget.Latest,true);
        const diagnosticNode = diagnosticTree.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==="safeStartDiagnostic");
        assert.ok(diagnosticNode);
        const diagnosticFunction = ts.transpileModule(diagnosticNode.getText(diagnosticTree),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
        const publicationObservation = `
const originalStartPublisherForFixture = publishSelectedManualStartChildV1;
${diagnosticFunction}
const safeStartDiagnosticForFixture = safeStartDiagnostic;
publishSelectedManualStartChildV1 = function(...args) {
  const fault = globalThis[Symbol.for(${JSON.stringify(faultKey)})];
  let result;
  try { result = originalStartPublisherForFixture(...args); }
  catch(error) { try { fault.startPublication = {state:"refused",failure:safeStartDiagnosticForFixture(error)}; } catch {} throw error; }
  try { fault.startPublication = {state:"published",failure:null}; } catch {}
  return result;
};`;
        edits.push({start:source.length,end:source.length,text:"\n"+originalOwner+"\n"+originalTable+"\n"+publicationObservation});
      }
      let changed = source;
      for (const edit of edits.sort((a, b) => b.start - a.start)) changed = changed.slice(0, edit.start) + edit.text + changed.slice(edit.end);
      return { ...loaded, source: changed };
    },
  });
  t.after(() => {
    hooks.deregister();
    Reflect.deleteProperty(globalThis, Symbol.for(faultKey));
    const current = lstatSync(root);
    assert.equal(current.dev, rootPin.dev);
    assert.equal(current.ino, rootPin.ino);
    assert.equal(current.uid, rootPin.uid);
    assert.equal(current.isSymbolicLink(), false);
    rmSync(root, { recursive: true }); // Only this test's newly created, pinned temp root.
  });
  // Import before creating any DB: the initial RED is the absent implementation.
  const manual: typeof import("../../src/execution/manual-test-admission-v1.js") =
    await import(`${MANUAL_URL.href}?manual-fixture=${fixtureId}`);
  const persistence: typeof import("../../src/execution/run-persistence.js") =
    await import(`${PERSISTENCE_URL.href}?manual-fixture=${fixtureId}`);
  const database = await createIsolatedTestDatabase();
  const db = await import("../../src/db-pg.js");
  t.after(async () => { await db.pgClose(); await database.cleanup(); });
  // The helper owns a query-suffixed client. Bind the real unsuffixed client
  // used by pgBegin and compiler continuations to that exact owned clone too.
  db.pgConfigureIsolatedTestDatabase(database.url);
  await db.initializeInternalProductionCurrentEntryDatabaseV1();
  const unsuffixedTs: typeof db = await import(new URL("../../src/db-pg.ts", import.meta.url).href);
  assert.equal(unsuffixedTs.getSql(), db.getSql());
  for (const sql of [database.sql, db.getSql()]) {
    const rows = await sql.unsafe<Array<{ database: string }>>("SELECT current_database() AS database");
    assert.equal(rows.length, 1); assert.equal(rows[0]!.database, database.database);
  }
  const suite = await loadConvergenceSuite(path.join(SOURCE_ROOT, "evals/suites/product-convergence-codex-v1.json"));
  const input = () => ({ jobId, kind: "convergence_full8" as const,
    selectionHash, sourceSha: SOURCE_SHA, suiteHash: suite.suiteHash });
  const nonce = "test_private_nonce_".repeat(4);
  let enrolled = false;
  async function enroll() {
    if (entryKind === "direct") {
      if (enrolled) return;
      const prepared = await manual.prepareSelectedDirectEvaluationIntentV1();
      jobId = prepared.jobId; assert.deepEqual(prepared, input()); enrolled = true; return;
    }
    if (!enrolled) {
      const jobDirectory = path.join(runtime, "mission-control", "controls", "jobs", jobId);
      mkdirSync(jobDirectory, { recursive: true, mode: 0o700 });
      const now = new Date().toISOString();
      writeFileSync(path.join(jobDirectory, "intent.json"), JSON.stringify({ schema: "mission-control.control-intent.v1",
        receipt: { schema: "mission-control.control-job.v1", ...input(), revision: 1, mcSourceSha: "c".repeat(40), mcBuildHash: "d".repeat(64),
          state: "accepted", requestedAt: now, startedAt: null, updatedAt: now, finishedAt: null, phase: "accepted", code: null,
          currentCaseId: null, ownedRunId: null, completedCases: 0, plannedCases: 8, reportRefs: {}, cancelRequested: false },
        installationDir: root, releaseDir: repositoryRoot, nonceDigest: createHash("sha256").update(nonce).digest("hex"),
        fixedSuiteRelativePath: "evals/suites/product-convergence-codex-v1.json" }) + "\n", { mode: 0o600, flag: "wx" });
      enrolled = true;
    }
    await manual.registerSelectedManualWorkerCustodyV1({ schema: "mission-control.control-custody.v1", jobId, selectionHash, sourceSha: SOURCE_SHA,
      mcBuildHash: "d".repeat(64), nonce });
  }
  async function acquire() { await enroll(); return manual.acquireSelectedManualEvaluationV1(input()); }
  const ordinaryRunInput: PersistWorkflowRunInputV1 = {
    run: {
      id: randomUUID(), runNumber: 8101, workflowId: "feature-dev", task: suite.suite.cases[0]!.task,
      context: "{}", notifyUrl: null, createdAt: new Date().toISOString(),
      protocol: { mode: "v3", version: 1, compilerReleaseSha: SOURCE_SHA,
        activationPreflightHash: "d".repeat(64),
        releaseAdmissionHash: await database.seedV3ReleaseGoAdmission(SOURCE_SHA),
        releaseAdmissionKind: "release_go", canaryAdmission: null },
    },
    steps: [],
  };
  async function revision(jobId: string): Promise<number> {
    const matches: number[] = [];
    function visit(directory: string, depth: number): void {
      assert.ok(depth <= 4);
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const locator = path.join(directory, entry.name);
        const stat = lstatSync(locator);
        assert.equal(stat.isSymbolicLink(), false);
        if (entry.isDirectory()) { assert.equal(stat.mode & 0o777, 0o700); visit(locator, depth + 1); }
        else if (entry.isFile() && entry.name.endsWith(".json")) {
          assert.equal(stat.mode & 0o777, 0o600);
          const record = JSON.parse(readFileSync(locator, "utf8"));
          const reservation = record.reservation ?? record;
          if (reservation.jobId === jobId && Number.isSafeInteger(reservation.revision)) matches.push(reservation.revision);
        }
      }
    }
    visit(evals, 0);
    assert.ok(matches.length > 0, "reservation must survive in the selected eval root");
    return Math.max(...matches);
  }
  const restart = async (): Promise<typeof manual> => import(`${MANUAL_URL.href}?manual-fixture=${fixtureId}&restart=${randomUUID()}`);
  return { manual, persistence, database, db, root, evals, suite, input, owner, repositoryRoot, selectionSource, fixtureId, workerArgv, ordinaryRunInput, revision, faults, restart, acquire, enroll, preWorkerManual: () => import(`${MANUAL_URL.href}?manual-fixture=${fixtureId}&pre-worker`) as Promise<typeof manual>, preWorkerPersistence: () => import(`${PERSISTENCE_URL.href}?manual-fixture=${fixtureId}&pre-worker`) as Promise<typeof persistence> };
}

async function settlementDataSnapshot(f: Awaited<ReturnType<typeof fixture>>) {
  const tables = ["runs", "v3_canary_admission_claims", "internal_production_owner_reservations_v1", "internal_production_owner_admission_authorities_v1", "internal_production_owner_admission_head_v1", "operational_outbox", "operational_events", "operational_event_deliveries"];
  const result: Record<string, unknown> = {};
  for (const table of tables) result[table] = await f.database.sql.unsafe(`SELECT row_to_json(t) AS row FROM ${table} t ORDER BY row_to_json(t)::text`);
  return JSON.stringify(result);
}
async function readonlyRunOwner(f: Awaited<ReturnType<typeof fixture>>, runId: string) {
  return f.database.sql.begin("isolation level repeatable read read only", async sql => {
    assert.equal((await sql`SHOW transaction_read_only`)[0]?.transaction_read_only, "on");
    return f.db.observeInternalProductionWorkflowRunClosedOwnerInTransactionV1(sql as PgTransactionSql, {runId});
  });
}
async function readonlyDeliveryOwner(f: Awaited<ReturnType<typeof fixture>>, eventKey: string, consumer: "jsonl" | "webhook") {
  return f.database.sql.begin("isolation level repeatable read read only", async sql => {
    assert.equal((await sql`SHOW transaction_read_only`)[0]?.transaction_read_only, "on");
    return f.db.observeInternalProductionOperationalDeliveryBoundOwnerInTransactionV1(sql as PgTransactionSql, {eventKey,consumer});
  });
}
// Deliberate private fixture corruption. Every mutation is restored exactly;
// production observers still run against real rows in an enforced READ ONLY transaction.
async function withAlteredOwner(f: Awaited<ReturnType<typeof fixture>>, ref: string, field: "producer_implementation_id" | "binding_hash" | "close_hash", replacement: string, assertion: () => Promise<void>) {
  const original = await f.database.sql.unsafe(`SELECT ${field} AS value FROM internal_production_owner_reservations_v1 WHERE reservation_ref=$1`,[ref]);
  assert.equal(original.length,1);
  await f.database.sql.unsafe(`UPDATE internal_production_owner_reservations_v1 SET ${field}=$2 WHERE reservation_ref=$1`,[ref,replacement]);
  try { await assertion(); } finally { await f.database.sql.unsafe(`UPDATE internal_production_owner_reservations_v1 SET ${field}=$2 WHERE reservation_ref=$1`,[ref,original[0]!.value]); }
}
async function withExtraOwner(f: Awaited<ReturnType<typeof fixture>>, ref: string, assertion: () => Promise<void>) {
  const duplicateRef = "setfarm://fixture/extra-owner/" + randomUUID(), duplicateHash = hashCanonicalJson(duplicateRef);
  await f.database.sql`INSERT INTO internal_production_owner_reservations_v1 SELECT (jsonb_populate_record(NULL::internal_production_owner_reservations_v1,
    to_jsonb(o) || jsonb_build_object('reservation_ref',${duplicateRef}::text,'reservation_hash',${duplicateHash}::text,'owner_key_hash',${duplicateHash}::text))).*
    FROM internal_production_owner_reservations_v1 o WHERE reservation_ref=${ref}`;
  try { await assertion(); } finally { await f.database.sql`DELETE FROM internal_production_owner_reservations_v1 WHERE reservation_ref=${duplicateRef}`; }
}

async function startActualDefaultChild(f: Awaited<ReturnType<typeof fixture>>, input: PersistWorkflowRunInputV1,
  reservation: import("../../src/execution/manual-test-admission-v1.js").ManualEvaluationReservationV1,
  contexts: readonly import("../../src/execution/v3-release-admission.js").InternalCanaryAdmissionContextV1[], fault: "none" | "proof_drift" | "foreign_child" = "none",
  readinessFault: "none" | "crossed_database" | "unknown_reference" = "none") {
  // Actual Source journal implementation; no synthetic proof file or child PID.
  const workerPath=path.join(SOURCE_ROOT,"src/execution/manual-test-worker-v1.ts");
  let workerSource=readFileSync(workerPath,"utf8").replace(/from "(\.[^"]+)"/g,(_,specifier)=>`from ${JSON.stringify(pathToFileURL(path.resolve(path.dirname(workerPath),specifier.replace(/\.js$/,".ts"))).href)}`);
  workerSource+="\nexport {WorkerJournalV1};";
  const worker=await import(`data:text/javascript;base64,${Buffer.from(ts.transpileModule(workerSource,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString("base64")}`);
  const record=JSON.parse(readFileSync(path.join(f.evals,"manual-controls/reservation.json"),"utf8"));
  const journal=new worker.WorkerJournalV1(f.evals,reservation.jobId,record.intentHash,f.owner,f.root);
  journal.append({type:"acquired",kind:"convergence_full8",selectionHash:reservation.selectionHash,sourceSha:SOURCE_SHA,suiteHash:f.suite.suiteHash,executionMode:"execute",owner:f.owner,origin:"mission_control",reservationRevision:reservation.revision-1});
  const caseFor=(context:typeof contexts[number])=>f.suite.suite.cases.find(value=>convergenceCaseHash(value)===context.caseHash)!;
  journal.append({type:"canary_create_requested",releaseSha:SOURCE_SHA,suiteHash:f.suite.suiteHash,preflightHash:"d".repeat(64),ttlMs:60_000,slots:contexts.map(context=>({caseId:caseFor(context).caseId,caseHash:context.caseHash,taskHash:context.taskHash,repetition:1,slotToken:context.slotToken}))});
  journal.append({type:"canary_bound",contexts:contexts.map(context=>({caseId:caseFor(context).caseId,context})),reservationRevision:reservation.revision});
  const context=input.run.protocol.canaryAdmission!;
  const head=journal.append({type:"start_requested",case:{caseId:caseFor(context).caseId,caseHash:context.caseHash,taskHash:context.taskHash,repetition:1},admissionHash:context.admissionHash,slotHash:context.slotHash});
  const selectionUrl=`data:text/javascript;base64,${Buffer.from(f.selectionSource).toString("base64")}`;
  // Native synchronous transpilation avoids test-loader work descendants. This
  // temp CLI runs the real persistence transaction, not the actual selected CLI
  // workflow/preparation entry. No compilation/qualification credit is claimed.
  const cli=path.join(f.repositoryRoot,"dist/cli/cli.js");
  const manualSource=readFileSync(path.join(SOURCE_ROOT,"src/execution/manual-test-admission-v1.ts"),"utf8");
  const tree=ts.createSourceFile("manual.ts",manualSource,ts.ScriptTarget.Latest,true);
  const originalOwner=tree.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==="processOwnerV1")!.getText(tree).replace("function processOwnerV1(","function actualProcessOwnerV1(");
  const originalTable=tree.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==="processTableV1")!.getText(tree).replace("function processTableV1(","function actualProcessTableV1(");
  const replacements={processOwnerV1:`function processOwnerV1(pid,script,executable){if(pid===${f.owner.pid})return ${JSON.stringify(f.owner)};return actualProcessOwnerV1(pid,script,executable);}`,processTableV1:childTableObservationSource(f.owner,f.workerArgv,f.repositoryRoot)};
  const proofPath=path.join(f.evals,"manual-controls/start-children",reservation.jobId,context.slotHash+".json");
  const faultMarker=path.join(f.root,"start-fault-observed.json");
  const childDiagnosticPath=path.join(f.root,"child-diagnostic.json");
  const readinessObservation=await f.database.observeOwnedP3ReadinessV1();
  const readinessSource=ownedP3ReadinessAdapterSource(readinessObservation,readinessFault,faultMarker);
  const readinessUrl=`data:text/javascript;base64,${Buffer.from(readinessSource).toString("base64")}`;
  const databaseModuleUrl=pathToFileURL(path.join(SOURCE_ROOT,"src/db-pg.ts")).href;
  const diagnosticTree=ts.createSourceFile("diagnostic.ts",readFileSync(fileURLToPath(import.meta.url),"utf8"),ts.ScriptTarget.Latest,true);
  const diagnosticNode=diagnosticTree.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==="safeStartDiagnostic");
  assert.ok(diagnosticNode);
  const diagnosticFunction=ts.transpileModule(diagnosticNode.getText(diagnosticTree),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
  const childSource=`const fs=require('node:fs'),path=require('node:path');
${diagnosticFunction}
let diagnosticStage='import_database',firstFailureCaptured=false;
function captureFirstChildFailure(error){if(firstFailureCaptured)return;firstFailureCaptured=true;try{const record={schema:'setfarm.owned-component-child-diagnostic.v1',stage:diagnosticStage,cleanup:'unknown',failure:safeStartDiagnostic(error)};const bytes=JSON.stringify(record)+'\\n';if(Buffer.byteLength(bytes)<=4096)fs.writeFileSync(${JSON.stringify(childDiagnosticPath)},bytes,{mode:0o600,flag:'wx'});}catch{}}
const {pathToFileURL,fileURLToPath}=require('node:url');const {registerHooks}=require('node:module');const ts=require(${JSON.stringify(path.join(SOURCE_ROOT,"node_modules/typescript/lib/typescript.js"))});
const sourceRoot=${JSON.stringify(SOURCE_ROOT)},selectionUrl=${JSON.stringify(selectionUrl)},fixtureId=${JSON.stringify(f.fixtureId)},replacements=${JSON.stringify(replacements)};
registerHooks({resolve(specifier,context,next){const parent=context.parentURL||'';
 if(parent===${JSON.stringify(databaseModuleUrl)}&&specifier==='./internal-production/baseline-spawner-startup-admission-v1.js')return {url:${JSON.stringify(readinessUrl)},shortCircuit:true};
 if(parent.includes('manual-test-admission-v1.')&&specifier.includes('fresh-installation-selection-v1'))return {url:selectionUrl,shortCircuit:true};
 if(specifier.startsWith('.')&&/\\.js$/.test(specifier)&&parent.startsWith('file:')){const u=new URL(specifier,parent);u.pathname=u.pathname.replace(/\\.js$/,'.ts');if(fs.existsSync(fileURLToPath(u)))return {url:u.href,shortCircuit:true};}return next(specifier,context);},
 load(url,context,next){if(!url.startsWith('file:')||!new URL(url).pathname.endsWith('.ts'))return next(url,context);let source=fs.readFileSync(fileURLToPath(url),'utf8');
 if(url.includes('/manual-test-admission-v1.')){const tree=ts.createSourceFile('manual.ts',source,ts.ScriptTarget.Latest,true);const edits=tree.statements.filter(ts.isFunctionDeclaration).filter(n=>n.name&&replacements[n.name.text]).map(n=>({start:n.getStart(tree),end:n.end,text:replacements[n.name.text]}));for(const e of edits.sort((a,b)=>b.start-a.start))source=source.slice(0,e.start)+e.text+source.slice(e.end);source+=${JSON.stringify("\n"+originalOwner+"\n"+originalTable)};}
 return {format:'module',source:ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,esModuleInterop:true}}).outputText,shortCircuit:true};}});
(async()=>{const db=await import(pathToFileURL(path.join(sourceRoot,'src/db-pg.ts')).href);diagnosticStage='configure_database';db.pgConfigureIsolatedTestDatabase(process.env.SETFARM_PG_URL);diagnosticStage='initialize_database';await db.initializeInternalProductionCurrentEntryDatabaseV1();
diagnosticStage='verify_database_identity';const databaseIdentity=await db.getSql().unsafe('SELECT current_database() AS database');if(databaseIdentity.length!==1||databaseIdentity[0].database!==${JSON.stringify(f.database.database)})throw new Error('OWNED_CLONE_IDENTITY_REFUSED');
diagnosticStage='import_persistence';const persistence=await import(pathToFileURL(path.join(sourceRoot,'src/execution/run-persistence.ts')).href);
let foreignDone=null,foreignChild=null;try{diagnosticStage='inject_fault';if(${JSON.stringify(fault)}==='proof_drift'){const file=${JSON.stringify(proofPath)},deadline=performance.now()+5000;while(!fs.existsSync(file)){if(performance.now()>=deadline)throw new Error('MANUAL_EVALUATION_PROOF_MISSING');await new Promise(resolve=>setTimeout(resolve,25));}fs.appendFileSync(file,' ');fs.writeFileSync(${JSON.stringify(faultMarker)},JSON.stringify({fault:'proof_drift',point:'proof_modified'})+'\\n',{mode:0o600,flag:'wx'});}
 if(${JSON.stringify(fault)}==='foreign_child'){const {spawn}=require('node:child_process'),{once}=require('node:events');const child=spawn(process.execPath,['-e',${JSON.stringify("process.stdout.write('READY\\n');process.stdin.resume();process.stdin.once('end',()=>process.exit(0));setTimeout(()=>process.exit(9),10000).unref()")}],{env:{PATH:'/usr/bin:/bin'},stdio:['pipe','pipe','pipe']});foreignChild=child;foreignDone=once(child,'exit');foreignDone.catch(()=>{});await Promise.race([once(child.stdout,'data'),foreignDone.then(()=>{throw new Error('foreign fixture child exited before readiness');})]);fs.writeFileSync(${JSON.stringify(faultMarker)},JSON.stringify({fault:'foreign_child',point:'owned_child_ready'})+'\\n',{mode:0o600,flag:'wx'});}
const input=${JSON.stringify(input)};
 diagnosticStage='verify_context';const actual=JSON.parse(process.env.SETFARM_INTERNAL_CONVERGENCE_ADMISSION);if(JSON.stringify(Object.entries(actual).sort())!==JSON.stringify(Object.entries(input.run.protocol.canaryAdmission).sort()))throw new Error('fixture canary context changed');
 diagnosticStage='persist_run';const result=await db.getSql().begin(sql=>persistence.persistWorkflowRunInTransaction(sql,input));process.stdout.write('Run: #'+result.run.runNumber+' ('+result.run.id+')');}
catch(error){captureFirstChildFailure(error);throw error;}
finally{diagnosticStage='cleanup';if(foreignDone){foreignChild.stdin.end();const [code,signal]=await foreignDone;if(code!==0||signal!==null)throw new Error('foreign fixture child cleanup failed');}await db.pgClose();}})().catch(error=>{captureFirstChildFailure(error);process.exitCode=1;});`;
  new Script(childSource, {filename:"owned-component-cli.cjs"});
  writeFileSync(cli,childSource,{mode:0o600,flag:"wx"});
  const runner=await import(`${pathToFileURL(path.join(SOURCE_ROOT,"src/evals/convergence-runner.ts")).href}?manual-fixture=${f.fixtureId}`);
  const previousUrl = process.env.SETFARM_PG_URL;
  const setupCredentialKeys = Object.keys(process.env).filter(key => key !== "SETFARM_PG_URL" && (/^SETFARM_.*(?:ADMIN|TEST).*PG|^SETFARM_.*PG.*(?:ADMIN|TEST)/.test(key) || /^(?:PGHOST|PGHOSTADDR|PGPORT|PGDATABASE|PGUSER|PGPASSWORD|PGPASSFILE|PGSERVICE|PGSERVICEFILE|DATABASE_URL)$/.test(key)));
  const setupCredentials = new Map(setupCredentialKeys.map(key => [key,process.env[key]!]));
  let output: {runId:string;runNumber:number};
  try {
    // Private owned-clone connection ingress only; never serialize it into files or diagnostics.
    for (const key of setupCredentialKeys) delete process.env[key];
    process.env.SETFARM_PG_URL = f.database.url;
    output = await runner.createNodeConvergenceProcessPort(f.repositoryRoot).startRun({workflowId:input.run.workflowId,task:input.run.task,releaseSha:SOURCE_SHA,admission:context,startChild:{reservation,journal:head}});
  } catch(error) {
    let injectionReached = false, readinessInjectionReached = false;
    if ((fault !== "none" || readinessFault !== "none") && existsSync(faultMarker)) {
      const stat = lstatSync(faultMarker);
      if (stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1 && stat.size <= 256 && (stat.mode & 0o777) === 0o600) {
        const expected = {fault,point:fault === "proof_drift" ? "proof_modified" : "owned_child_ready"};
        injectionReached = readFileSync(faultMarker,"utf8") === JSON.stringify(expected)+"\n";
        readinessInjectionReached = readinessFault !== "none" && readFileSync(faultMarker,"utf8") === JSON.stringify({fault:readinessFault,point:"readiness_adapter"})+"\n";
      }
    }
    const observation = {start:safeStartDiagnostic(error),publication:f.faults.startPublication,injectionReached,readinessInjectionReached,child:readSafeChildDiagnostic(childDiagnosticPath)};
    throw Object.assign(new Error("OWNED_COMPONENT_START_REFUSED "+JSON.stringify(observation)), {startObservation:observation});
  } finally {
    if (previousUrl === undefined) delete process.env.SETFARM_PG_URL; else process.env.SETFARM_PG_URL = previousUrl;
    for (const [key,value] of setupCredentials) process.env[key] = value;
  }
  assert.equal(output.runId,input.run.id);assert.equal(output.runNumber,input.run.runNumber);
  const proof=JSON.parse(readFileSync(path.join(f.evals,"manual-controls/start-children",reservation.jobId,context.slotHash+".json"),"utf8"));
  assert.equal(proof.parentPid,process.pid);assert.notEqual(proof.child.pid,process.pid);assert.equal(proof.child.script,cli);assert.equal(proof.journal.hash,head.hash);
  assert.equal(JSON.stringify(proof).includes(context.slotToken),false);
  return output;
}

function exactPrivateRecoveryComponent(bindings: Record<string, unknown>) {
  const source = readFileSync(new URL("../../src/execution/run-persistence.ts", import.meta.url), "utf8");
  const tree = ts.createSourceFile("run-persistence.ts", source, ts.ScriptTarget.Latest, true);
  const declaration = tree.statements.find(statement => ts.isFunctionDeclaration(statement)
    && statement.name?.text === "persistRecoverySourceBootstrapRunInTransactionV1");
  assert.ok(declaration, "complete production recovery insertion function must exist");
  const compiled = ts.transpileModule(declaration.getText(tree), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  return new Function(...Object.keys(bindings), `${compiled};return persistRecoverySourceBootstrapRunInTransactionV1;`)
    (...Object.values(bindings)) as (sql: PgTransactionSql, candidate: unknown) => Promise<unknown>;
}

test("reservation-first denies the actual ordinary INSERT and private recovery INSERT before downstream authority", async t => {
  const f = await fixture(t);
  const held = await f.acquire();
  await assert.rejects(() => f.database.sql.begin(sql => f.persistence.persistWorkflowRunInTransaction(
    sql as PgTransactionSql, f.ordinaryRunInput)), /MANUAL_EVALUATION_RESERVED/);
  let downstreamAuthorityReads = 0;
  let fenceEntries = 0;
  const privateRecovery = exactPrivateRecoveryComponent({
    ...f.manual,
    async lockInternalProductionWorkflowRunInsertionFenceV1(sql: PgTransactionSql) {
      await f.db.lockInternalProductionWorkflowRunInsertionFenceV1(sql); fenceEntries += 1;
    },
    async lockInternalProductionRecoverySourceBootstrapRunInsertionFenceV1() {
      downstreamAuthorityReads += 1; throw new Error("UNUSABLE_RECOVERY_AUTHORITY");
    },
  });
  await assert.rejects(() => f.database.sql.begin(sql => privateRecovery(sql as PgTransactionSql, {
    operation: Object.freeze({}), // Deliberately supplies no recovery authority.
  })), /MANUAL_EVALUATION_RESERVED/);
  assert.equal(fenceEntries, 1);
  assert.equal(downstreamAuthorityReads, 0);
  assert.equal(await f.revision(held.jobId), held.revision);
  assert.equal((await f.database.sql`SELECT id FROM runs`).length, 0);
  await assert.rejects(() => f.persistence.persistInternalProductionRecoverySourceBootstrapRunV1({
    operationRef: "setfarm://tests/no-admitted-recovery-operation", operationHash: "e".repeat(64),
  }));
  assert.equal(await f.revision(held.jobId), held.revision);
});

test("two acquisitions have one durable owner and a fresh module observes that same reservation", async t => {
  const f = await fixture(t);
  const results = await Promise.allSettled([
    f.acquire(),
    f.acquire(),
  ]);
  const winners = results.filter(result => result.status === "fulfilled");
  assert.equal(winners.length, 1);
  assert.equal(results.filter(result => result.status === "rejected").length, 1);
  const held = winners[0]!.value;
  const restarted = await f.restart();
  const observed = await f.database.sql.begin(sql => restarted.observeSelectedManualEvaluationInTransactionV1(sql as PgTransactionSql));
  assert.equal(observed?.jobId, held.jobId);
  assert.equal(await f.revision(held.jobId), held.revision);
  await assert.rejects(() => f.acquire(), /MANUAL_EVALUATION_RESERVED|MANUAL_EVALUATION_OWNERSHIP_UNKNOWN/);
});

test("insertion-first holds the actual same-clone lock before evaluator readiness and refuses acquisition", async t => {
  const f = await fixture(t);
  let unlock!: () => void, locked!: () => void, failed!: (reason: unknown) => void;
  const atFence = new Promise<void>((resolve, reject) => { locked = resolve; failed = reject; });
  const hold = new Promise<void>(resolve => { unlock = resolve; });
  const beforeWorker = await f.preWorkerPersistence();
  let insertionPid = 0;
  const insertion = f.database.sql.begin(async sql => {
    insertionPid = Number((await sql.unsafe<Array<{ pid: number }>>("SELECT pg_backend_pid() AS pid"))[0]!.pid);
    await f.db.lockInternalProductionWorkflowRunInsertionFenceV1(sql as PgTransactionSql);
    const inserted = await beforeWorker.persistWorkflowRunInTransaction(sql as PgTransactionSql, f.ordinaryRunInput);
    locked(); await hold; return inserted;
  });
  void insertion.catch(failed);
  await atFence;
  f.faults.transactionBackendPid = null;
  const acquiring = f.acquire();
  const refused = assert.rejects(acquiring, /MANUAL_EVALUATION_ACTIVITY|MANUAL_EVALUATION_OWNERSHIP_UNKNOWN/);
  let blockingProven = false;
  try {
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      const pid: number | null = f.faults.transactionBackendPid;
      if (pid !== null) {
        assert.notEqual(pid, insertionPid);
        const rows: Array<{ blockers: number[]; database: string }> = await f.database.sql.unsafe<Array<{ blockers: number[]; database: string }>>(
          "SELECT pg_blocking_pids($1) AS blockers,current_database() AS database", [pid]);
        assert.equal(rows[0]!.database, f.database.database);
        if (rows[0]!.blockers.includes(insertionPid)) { blockingProven = true; break; }
      }
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    assert.equal(blockingProven, true, "actual acquirer backend must wait on the held insertion backend");
  } finally {
    unlock();
    await Promise.allSettled([insertion, refused]);
  }
  const inserted = await insertion; await refused;
  assert.equal(inserted.run.id, f.ordinaryRunInput.run.id);
});

test("canonical compiler fixture exposes real live run claim and runtime activity to acquisition", async t => {
  const f = await fixture(t);
  const runId = randomUUID();
  const fixtureRun = await seedCanonicalSetupBuildCompilerStoryAdmissionFixture(f.database, {
    runId, repo: path.join(f.root, "compiler-project"), setupBuildStepDbId: `${runId}-setup-build`,
    setupBuildClaimAgentId: "feature-dev_setup-build", releaseSha: SOURCE_SHA,
  });
  assert.ok(fixtureRun.claimId > 0);
  await assert.rejects(() => f.acquire(),
    /MANUAL_EVALUATION_ACTIVITY|MANUAL_EVALUATION_OWNERSHIP_UNKNOWN/);
  const rows = await f.database.sql`SELECT outcome FROM claim_log WHERE id=${fixtureRun.claimId}`;
  assert.equal(rows[0]?.outcome, null);
});

test("all nonterminal run states block acquisition including cancellation and failure drain", async t => {
  const f = await fixture(t);
  for (const status of ["running", "resuming", "cancelling", "failing"]) {
    const runId = randomUUID();
    await f.database.insertRun(runId);
    await f.database.sql`UPDATE runs SET status=${status} WHERE id=${runId}`;
    await assert.rejects(() => f.acquire(),
      /MANUAL_EVALUATION_ACTIVITY|MANUAL_EVALUATION_OWNERSHIP_UNKNOWN/, status);
    assert.equal(existsSync(path.join(f.evals, "manual-controls", "reservation.json")), false,
      "failed readiness must not create a reservation; the enrolled worker remains owned");
    // Fixture-only rows in this exact private DB, never canonical live owners.
    await f.database.sql`DELETE FROM runs WHERE id=${runId}`;
  }
});

test("complete activity census refuses every nonzero family and missing invalid or negative observations", async t => {
  const f = await fixture(t);
  const families = [
    "active_runs", "open_claims", "active_attempts", "active_attempt_binding_conflicts",
    "active_runtimes", "active_runtime_completions", "active_completion_effects", "active_recovery_cases",
    "active_recovery_deliveries", "active_termination_requests", "active_compilations",
    "active_publications", "active_publication_batches", "active_outbox", "active_operational_deliveries", "active_owner_reservations",
  ];
  for (const family of families) {
    for (const value of [1, undefined, -1, 0.5, "0", null]) {
      f.faults.censusOverlay = { [family]: value };
      await assert.rejects(() => f.acquire(),
        /MANUAL_EVALUATION_ACTIVITY|MANUAL_EVALUATION_OWNERSHIP_UNKNOWN/,
        `${family}:${String(value)}`);
      assert.equal(existsSync(path.join(f.evals, "manual-controls", "reservation.json")), false);
    }
  }
  f.faults.censusOverlay = null;
});

test("rollback after durable publication retains a pending or unknown reservation across module restart", async t => {
  const f = await fixture(t);
  const input = f.input();
  f.faults.rollbackAfterCallback = true;
  await assert.rejects(() => f.acquire(), /INJECTED_MANUAL_TRANSACTION_ROLLBACK|MANUAL_EVALUATION_OWNERSHIP_UNKNOWN/);
  f.faults.rollbackAfterCallback = false;
  const restarted = await f.restart();
  const observed = await f.database.sql.begin(sql => restarted.observeSelectedManualEvaluationInTransactionV1(sql as PgTransactionSql));
  assert.ok(observed);
  assert.equal(observed.jobId, input.jobId);
  assert.ok(["pending", "ownership_unknown"].includes(observed.phase));
  assert.equal(await f.revision(input.jobId), observed.revision);
  await assert.rejects(() => restarted.acquireSelectedManualEvaluationV1(f.input()), /MANUAL_EVALUATION_RESERVED|MANUAL_EVALUATION_OWNERSHIP_UNKNOWN|MANUAL_EVALUATION_CUSTODY_REQUIRED/);
  await assert.rejects(() => f.database.sql.begin(sql => f.persistence.persistWorkflowRunInTransaction(sql as PgTransactionSql, f.ordinaryRunInput)),
    /MANUAL_EVALUATION_RESERVED|MANUAL_EVALUATION_OWNERSHIP_UNKNOWN/);
  await assert.rejects(() => restarted.releaseSelectedManualEvaluationV1(observed));
  await assert.rejects(() => f.manual.closeSelectedManualWorkerCustodyV1());
  assert.equal(existsSync(path.join(f.evals, "manual-controls", "closures", input.jobId + ".json")), false);
  assert.equal(await f.revision(input.jobId), observed.revision);
});

test("actual default child consumes exact stored canary once and canonical settlement remains usable (selection, parent OS and authenticated readonly P3 readiness component fixture)", async t => {
  const f = await fixture(t,"worker",true);
  const held = await f.acquire();
  const entry = f.suite.suite.cases[0]!;
  const repository = createV3ReleaseAdmissionRepository(f.database.sql, new ContentAddressedEvalResultStore(path.join(f.evals, "results")));
  const canary = await repository.createCanary({
    releaseSha: SOURCE_SHA, suiteHash: f.suite.suiteHash, preflightHash: "d".repeat(64), ttlMs: 60_000,
    slots: f.suite.suite.cases.map(value=>({caseHash:convergenceCaseHash(value),taskHash:hashCanonicalJson(value.task),repetition:1,slotToken:randomUUID()+randomUUID()})),
  });
  const context = exactContextForEntry(canary.contexts, entry);
  assert.equal(context.repetition, 1);
  const bound = await f.manual.bindSelectedManualCanaryV1({ reservation: held, admissionHash: canary.admission.admissionHash,
    slots: canary.contexts.map(({admissionHash,slotHash,caseHash,taskHash,repetition})=>({admissionHash,slotHash,caseHash,taskHash,repetition})) });
  await assert.rejects(() => f.manual.bindSelectedManualCanaryV1({ reservation: held,
    admissionHash: canary.admission.admissionHash,
    slots: [{ admissionHash: context.admissionHash, slotHash: context.slotHash, caseHash: context.caseHash, taskHash: context.taskHash, repetition: 1 }] }),
  /MANUAL_EVALUATION_REVISION|MANUAL_EVALUATION_CONFLICT/);
  const input: PersistWorkflowRunInputV1 = {
    ...f.ordinaryRunInput,
    run: { ...f.ordinaryRunInput.run, protocol: { ...f.ordinaryRunInput.run.protocol,
      releaseAdmissionKind: "convergence_canary", releaseAdmissionHash: context.admissionHash, canaryAdmission: context } },
  };
  for (const altered of [
    { ...context, slotToken: "foreign_selector_".repeat(3) },
    { ...context, admissionHash: "f".repeat(64) },
    { ...context, caseHash: "f".repeat(64) },
    { ...context, taskHash: "f".repeat(64) },
    { ...context, repetition: 2 },
    { slotHash: context.slotHash },
  ]) {
    await assert.rejects(() => f.database.sql.begin(sql => f.persistence.persistWorkflowRunInTransaction(sql as PgTransactionSql,
      { ...input, run: { ...input.run, protocol: { ...input.run.protocol, canaryAdmission: altered as typeof context } } })));
    assert.equal((await f.database.sql`SELECT id FROM runs`).length, 0);
    const claim = await f.database.sql`SELECT run_id,consumed_at FROM v3_canary_admission_claims WHERE slot_hash=${context.slotHash}`;
    assert.equal(claim[0]?.run_id, null);
    assert.equal(claim[0]?.consumed_at, null);
  }
  const started = await startActualDefaultChild(f,input,bound,canary.contexts);
  const inserted = {run:{id:started.runId}};
  const live = await f.database.sql`SELECT id,run_number,workflow_id,status,protocol,protocol_version,compiler_release_sha,release_admission_hash,task FROM runs WHERE id=${inserted.run.id}`;
  assert.equal(live.length,1);
  assert.equal(live[0]?.id,input.run.id);assert.equal(live[0]?.run_number,input.run.runNumber);
  assert.equal(live[0]?.workflow_id,input.run.workflowId);assert.equal(live[0]?.status,"running");
  assert.equal(live[0]?.protocol,"v3");assert.equal(live[0]?.protocol_version,1);
  assert.equal(live[0]?.compiler_release_sha,SOURCE_SHA);assert.equal(live[0]?.release_admission_hash,context.admissionHash);
  assert.equal(hashCanonicalJson(live[0]?.task),context.taskHash);
  const claim = await f.database.sql`SELECT run_id,consumed_at FROM v3_canary_admission_claims WHERE slot_hash=${context.slotHash}`;
  assert.equal(claim.length,1);
  assert.equal(claim[0]?.run_id, inserted.run.id);
  assert.ok(claim[0]?.consumed_at);
  await assert.rejects(() => readonlyRunOwner(f, inserted.run.id), /INTERNAL_PRODUCTION_WORKFLOW_RUN_OWNER/);
  // The settlement observer requires terminal bound runs; live owner activity
  // cannot be classified as ordinary terminal delivery residue.
  await assert.rejects(() => f.manual.observeSelectedManualSettlementV1(bound),
    (error:unknown)=>error instanceof Error && error.message==="MANUAL_EVALUATION_OWNERSHIP_UNKNOWN");
  await assert.rejects(() => f.manual.releaseSelectedManualEvaluationV1(bound), /MANUAL_EVALUATION_ACTIVITY/);
  const terminal = await import("../../src/execution/run-terminal-transition.js");
  await terminal.transitionRunToTerminal(f.database.sql, {
    runId: inserted.run.id, status: "failed", diagnostic: "Manual admission isolated pre-claim test",
    terminalFailure: true, unclaimedBootstrapFailure: true,
  });
  const beforeReadonly = await settlementDataSnapshot(f);
  const closed = await readonlyRunOwner(f, inserted.run.id);
  assert.equal(closed.runId, inserted.run.id);
  assert.equal(await f.manual.observeSelectedManualSettlementV1(bound), "pending");
  assert.equal(await settlementDataSnapshot(f), beforeReadonly);
  for (const field of ["producer_implementation_id", "close_hash"] as const) await withAlteredOwner(f, closed.runOwnerReservationRef, field,
    field === "close_hash" ? "f".repeat(64) : "a-recovery-source-bootstrap-run-v1", async () => {
      await assert.rejects(() => readonlyRunOwner(f, inserted.run.id), /INTERNAL_PRODUCTION/);
      await assert.rejects(() => f.manual.observeSelectedManualSettlementV1(bound));
    });
  await withExtraOwner(f, closed.runOwnerReservationRef, async () => { await assert.rejects(() => readonlyRunOwner(f, inserted.run.id), /OWNER_UNAVAILABLE/); });
  await f.database.sql`UPDATE runs SET status='completed' WHERE id=${inserted.run.id}`;
  try { await assert.rejects(() => readonlyRunOwner(f, inserted.run.id), /INTERNAL_PRODUCTION/); }
  finally { await f.database.sql`UPDATE runs SET status='failed' WHERE id=${inserted.run.id}`; }
  const pendingOutbox = await f.database.sql`SELECT outbox_id,payload FROM operational_outbox WHERE state='pending'`;
  assert.ok(pendingOutbox.length > 0);
  const originalPayload = pendingOutbox[0]!.payload;
  await f.database.sql`UPDATE operational_outbox SET payload=jsonb_set(payload,'{runId}',to_jsonb('foreign-run'::text)) WHERE outbox_id=${pendingOutbox[0]!.outbox_id}`;
  try { await assert.rejects(() => f.manual.observeSelectedManualSettlementV1(bound), /MANUAL_EVALUATION_ACTIVITY_UNKNOWN/); }
  finally { await f.database.sql`UPDATE operational_outbox SET payload=${f.database.sql.json(originalPayload)} WHERE outbox_id=${pendingOutbox[0]!.outbox_id}`; }
  const current = await f.database.sql.begin(sql => f.manual.observeSelectedManualEvaluationInTransactionV1(sql as PgTransactionSql));
  assert.ok(current);
  await assert.rejects(() => f.database.sql.begin(sql => f.persistence.persistWorkflowRunInTransaction(sql as PgTransactionSql,
    { ...input, run: { ...input.run, id: randomUUID(), runNumber: 8102 } })), /CANARY|MANUAL_EVALUATION/);
  await assert.rejects(() => f.manual.releaseSelectedManualEvaluationV1(current), /MANUAL_EVALUATION_ACTIVITY/);
  // Canonical terminal SQL creates real outbox work. Drain only this pristine
  // owned fixture through its existing repositories; do not zero the census.
  const { createOperationalOutboxRepository } = await import("../../src/execution/operational-outbox-repository.js");
  const { createOperationalEventDeliveryRepository } = await import("../../src/execution/operational-event-delivery-repository.js");
  const outbox = createOperationalOutboxRepository(f.database.sql), deliveries = createOperationalEventDeliveryRepository(f.database.sql);
  const ownerInstanceId = "manual-admission-owned-fixture";
  for (let count = 0; ; count++) {
    assert.ok(count < 20);
    const item = await outbox.claimNext({ ownerInstanceId }); if (!item) break;
    await outbox.publish({ outboxId: item.outboxId, ownerInstanceId, leaseToken: item.leaseToken! });
  }
  const pendingDelivery = await f.database.sql`SELECT event_key,consumer FROM operational_event_deliveries WHERE state='pending' ORDER BY event_key,consumer`;
  assert.ok(pendingDelivery.length > 0);
  const deliveryKey = pendingDelivery[0]!.event_key, consumer = pendingDelivery[0]!.consumer as "jsonl" | "webhook";
  const beforeDeliveryObservation = await settlementDataSnapshot(f);
  const deliveryOwner = await readonlyDeliveryOwner(f, deliveryKey, consumer);
  assert.equal(await f.manual.observeSelectedManualSettlementV1(bound), "pending");
  assert.equal(await settlementDataSnapshot(f), beforeDeliveryObservation);
  await withAlteredOwner(f, deliveryOwner.reservationRef, "binding_hash", "f".repeat(64), async () => {
    await assert.rejects(() => readonlyDeliveryOwner(f, deliveryKey, consumer), /INTERNAL_PRODUCTION/);
    await assert.rejects(() => f.manual.observeSelectedManualSettlementV1(bound));
  });
  await withExtraOwner(f, deliveryOwner.reservationRef, async () => {
    await assert.rejects(() => readonlyDeliveryOwner(f, deliveryKey, consumer), /OWNER_UNAVAILABLE/);
    await assert.rejects(() => f.manual.observeSelectedManualSettlementV1(bound));
  });
  const immutableEvent = await outbox.findCanonicalByEventKey(deliveryKey);
  assert.ok(immutableEvent);
  const immutableDigest = hashCanonicalJson(immutableEvent);
  const beforeImmutableRefusal = await settlementDataSnapshot(f);
  await assert.rejects(() => f.database.sql`UPDATE operational_events SET run_id='foreign-run' WHERE event_key=${deliveryKey}`,
    (error:unknown)=>error instanceof Error && error.message==="OPERATIONAL_EVENT_IMMUTABLE" && (error as Error & {code?:string}).code==="23514");
  assert.equal(hashCanonicalJson(await outbox.findCanonicalByEventKey(deliveryKey)),immutableDigest);
  assert.equal(await f.manual.observeSelectedManualSettlementV1(bound),"pending");
  assert.equal(await settlementDataSnapshot(f),beforeImmutableRefusal);
  // Canonical foreign provenance must be refused even when every event/delivery
  // record is valid. Use the repository contract, never corrupt immutable rows.
  const foreignRunId="manual-owned-foreign-"+randomUUID(), foreignEventKey="manual-owned-event-"+randomUUID();
  const foreignOutbox=await outbox.enqueue({eventKey:foreignEventKey,eventType:"run.lifecycle_changed",aggregateType:"run",aggregateId:foreignRunId,
    payload:{schema:"setfarm.operational-outbox-event.v1",status:"running",runId:foreignRunId}});
  assert.equal(foreignOutbox.state,"pending");
  assert.equal(await outbox.findCanonicalByEventKey(foreignEventKey),undefined);
  const beforeForeignPending=await settlementDataSnapshot(f);
  await assert.rejects(()=>f.manual.observeSelectedManualSettlementV1(bound),
    (error:unknown)=>error instanceof Error && error.message==="MANUAL_EVALUATION_ACTIVITY_UNKNOWN");
  assert.equal(await settlementDataSnapshot(f),beforeForeignPending);
  const foreignClaim=await outbox.claimNext({ownerInstanceId});
  assert.ok(foreignClaim);assert.equal(foreignClaim.outboxId,foreignOutbox.outboxId);
  await outbox.publish({outboxId:foreignClaim.outboxId,ownerInstanceId,leaseToken:foreignClaim.leaseToken!});
  const foreignEvent=await outbox.findCanonicalByEventKey(foreignEventKey);
  assert.ok(foreignEvent);assert.equal(foreignEvent.runId,foreignRunId);
  assert.equal(foreignEvent.aggregateId,foreignRunId);assert.equal(foreignEvent.payload.runId,foreignRunId);
  const foreignDeliveries=await f.database.sql`SELECT consumer,state FROM operational_event_deliveries WHERE event_key=${foreignEventKey} ORDER BY consumer`;
  assert.deepEqual(foreignDeliveries.map(row=>({consumer:row.consumer,state:row.state})),[{consumer:"jsonl",state:"pending"},{consumer:"webhook",state:"pending"}]);
  for(const foreignConsumer of ["jsonl","webhook"] as const) await readonlyDeliveryOwner(f,foreignEventKey,foreignConsumer);
  const beforeForeignDelivery=await settlementDataSnapshot(f);
  await assert.rejects(()=>f.manual.observeSelectedManualSettlementV1(bound),
    (error:unknown)=>error instanceof Error && error.message==="MANUAL_EVALUATION_ACTIVITY_UNKNOWN");
  assert.equal(await settlementDataSnapshot(f),beforeForeignDelivery);
  for (const consumer of ["jsonl", "webhook"] as const) for (let count = 0; ; count++) {
    assert.ok(count < 40);
    const item = await deliveries.claimNext({ consumer, ownerInstanceId }); if (!item) break;
    await deliveries.settle({ eventKey: item.eventKey, consumer, ownerInstanceId, leaseToken: item.leaseToken!, outcome: "skipped", result: { reason: "private test fixture has no external consumer" } });
  }
  const beforeReady = await settlementDataSnapshot(f);
  assert.equal(await f.manual.observeSelectedManualSettlementV1(bound), "ready");
  assert.equal(await settlementDataSnapshot(f), beforeReady);
  await f.manual.releaseSelectedManualEvaluationV1(current);
  // The immutable enrolled-worker snapshot still observes that process alive;
  // release is recorded, but public owner observation may not pretend it exited.
  assert.equal(await f.manual.observeSelectedEvaluatorOwnersV1(), "owned");
  assert.equal(await f.revision(current.jobId), current.revision + 1);
});

test("a bound canary that expires before insertion cannot consume its real stored claim", async t => {
  const f = await fixture(t);
  const held = await f.acquire();
  const entry = f.suite.suite.cases[0]!;
  const repository = createV3ReleaseAdmissionRepository(f.database.sql, new ContentAddressedEvalResultStore(path.join(f.evals, "results")));
  const canary = await repository.createCanary({ releaseSha: SOURCE_SHA,
    suiteHash: f.suite.suiteHash, preflightHash: "d".repeat(64), ttlMs: 1000,
    slots: [{ caseHash: convergenceCaseHash(entry), taskHash: hashCanonicalJson(entry.task), repetition: 1, slotToken: "expiry_private_selector_".repeat(3) }],
  });
  const context = canary.contexts[0]!;
  assert.equal(context.repetition, 1);
  await f.manual.bindSelectedManualCanaryV1({ reservation: held, admissionHash: context.admissionHash,
    slots: [{ admissionHash: context.admissionHash, slotHash: context.slotHash, caseHash: context.caseHash, taskHash: context.taskHash, repetition: 1 }] });
  await f.database.sql`SELECT pg_sleep(1.1)`;
  await assert.rejects(() => f.database.sql.begin(sql => f.persistence.persistWorkflowRunInTransaction(sql as PgTransactionSql, {
    ...f.ordinaryRunInput,
    run: { ...f.ordinaryRunInput.run, protocol: { ...f.ordinaryRunInput.run.protocol,
      releaseAdmissionKind: "convergence_canary", releaseAdmissionHash: context.admissionHash, canaryAdmission: context } },
  })), /CANARY|MANUAL_EVALUATION/);
  assert.equal((await f.database.sql`SELECT id FROM runs`).length, 0);
  const rows = await f.database.sql`SELECT run_id,consumed_at FROM v3_canary_admission_claims WHERE slot_hash=${context.slotHash}`;
  assert.equal(rows[0]?.run_id, null);
  assert.equal(rows[0]?.consumed_at, null);
});


test("certain busy-owner refusal closes only the uninterrupted never-reserved intent", async t => {
  const f = await fixture(t), foreignId = randomUUID();
  await f.database.insertRun(foreignId);
  await assert.rejects(() => f.acquire(), /MANUAL_EVALUATION_ACTIVITY/);
  await f.manual.closeSelectedManualWorkerCustodyV1();
  const marker = JSON.parse(readFileSync(path.join(f.evals, "manual-controls", "closures", `${f.input().jobId}.json`), "utf8"));
  assert.deepEqual(marker.closure, { kind: "never_reserved" });
  assert.equal(marker.owner.source, "observed_os");
  assert.equal(existsSync(path.join(f.evals, "manual-controls", "reservation.json")), false);
  assert.equal((await f.database.sql`SELECT status FROM runs WHERE id=${foreignId}`)[0]?.status, "running");
  assert.equal(await f.manual.observeSelectedEvaluatorOwnersV1(), "owned", "a closure never hides the live enrolled worker");
  await f.manual.closeSelectedManualWorkerCustodyV1();
  await assert.rejects(() => f.acquire());
  const restarted = await f.restart();
  await assert.rejects(() => restarted.closeSelectedManualWorkerCustodyV1(), /MANUAL_EVALUATION_CUSTODY_REQUIRED/);
  const absentWorker = await f.preWorkerManual();
  assert.equal(await absentWorker.observeSelectedEvaluatorOwnersV1(), "none", "stable closure survives process exit without granting new custody");
});

test("held reservation cannot close before exact release and marker binds the retained released revision", async t => {
  const f = await fixture(t), held = await f.acquire();
  await assert.rejects(() => f.manual.closeSelectedManualWorkerCustodyV1(), /MANUAL_EVALUATION_RELEASE_REQUIRED/);
  await f.manual.releaseSelectedManualEvaluationV1(held);
  await f.manual.closeSelectedManualWorkerCustodyV1();
  const locator = path.join(f.evals, "manual-controls", "closures", `${held.jobId}.json`);
  const marker = JSON.parse(readFileSync(locator, "utf8"));
  assert.equal(marker.closure.kind, "reservation_released");
  assert.equal(marker.closure.revision, held.revision + 1);
  const archived = readFileSync(path.join(f.evals, "manual-controls", "revisions", `${String(marker.closure.revision).padStart(20, "0")}.json`));
  assert.equal(marker.closure.recordHash, createHash("sha256").update(archived).digest("hex"));
  await f.manual.closeSelectedManualWorkerCustodyV1();
  await assert.rejects(() => f.manual.releaseSelectedManualEvaluationV1(held));
  await assert.rejects(() => f.acquire());
  chmodSync(locator, 0o644);
  assert.equal(await (await f.preWorkerManual()).observeSelectedEvaluatorOwnersV1(), "unknown");
  await assert.rejects(() => f.manual.closeSelectedManualWorkerCustodyV1());
});

test("closure rollback and missing reservation history remain unknown without marker adoption", async t => {
  const f = await fixture(t);
  await f.enroll();
  f.faults.rollbackAfterCallback = true;
  await assert.rejects(() => f.manual.closeSelectedManualWorkerCustodyV1(), /INJECTED_MANUAL_TRANSACTION_ROLLBACK/);
  f.faults.rollbackAfterCallback = false;
  assert.ok(existsSync(path.join(f.evals, "manual-controls", "mutation.json")));
  assert.ok(existsSync(path.join(f.evals, "manual-controls", "closures", `${f.input().jobId}.json`)));
  assert.equal(await (await f.preWorkerManual()).observeSelectedEvaluatorOwnersV1(), "unknown");
  await assert.rejects(() => f.manual.closeSelectedManualWorkerCustodyV1());
  await assert.rejects(() => f.acquire());
});

test("an abandoned SF intent stays unknown while a strict UI fixture intent is separate", async t => {
  const f = await fixture(t); await f.enroll();
  const observer = await f.preWorkerManual();
  assert.equal(await observer.observeSelectedEvaluatorOwnersV1(), "unknown");
  const locator = path.join(f.root, "runtime", "mission-control", "controls", "jobs", f.input().jobId, "intent.json");
  const intent = JSON.parse(readFileSync(locator, "utf8"));
  // Deliberate negative/alternate-kind fixture mutation; no registered custody
  // may survive or adopt it, and production never performs this rewrite.
  intent.receipt.kind = "ui_regression"; intent.receipt.suiteHash = null; intent.receipt.plannedCases = 0; intent.fixedSuiteRelativePath = null;
  writeFileSync(locator, JSON.stringify(intent) + "\n");
  assert.equal(await observer.observeSelectedEvaluatorOwnersV1(), "none");
  await assert.rejects(() => f.manual.closeSelectedManualWorkerCustodyV1());
  intent.receipt.privateNonce = "forbidden"; writeFileSync(locator, JSON.stringify(intent) + "\n");
  assert.equal(await observer.observeSelectedEvaluatorOwnersV1(), "unknown");
});

test("missing or renamed retained revision forbids release and custody closure", async t => {
  const f = await fixture(t), held = await f.acquire();
  const directory = path.join(f.evals, "manual-controls", "revisions");
  renameSync(path.join(directory, "00000000000000000001.json"), path.join(directory, "retained-corrupt-name.json"));
  assert.equal(await f.manual.observeSelectedEvaluatorOwnersV1(), "unknown");
  await assert.rejects(() => f.manual.releaseSelectedManualEvaluationV1(held));
  await assert.rejects(() => f.manual.closeSelectedManualWorkerCustodyV1());
  assert.equal(existsSync(path.join(f.evals, "manual-controls", "closures", `${held.jobId}.json`)), false);
});


test("selected direct planning enrolls its own intent and uses common release and closure without MC fields", async t => {
  const f = await fixture(t, "direct"), held = await f.acquire();
  const intent = JSON.parse(readFileSync(path.join(f.evals, "manual-controls", "direct", `${held.jobId}.json`), "utf8"));
  assert.equal(intent.executionMode, "preflight");
  assert.equal(intent.mcBuildHash, undefined);
  await assert.rejects(() => f.manual.bindSelectedManualCanaryV1({ reservation: held, admissionHash: "a".repeat(64), slots: [] }), /MANUAL_EVALUATION_CANARY_REFUSED/);
  await f.manual.releaseSelectedManualEvaluationV1(held);
  await f.manual.closeSelectedManualWorkerCustodyV1();
  const marker = JSON.parse(readFileSync(path.join(f.evals, "manual-controls", "closures", `${held.jobId}.json`), "utf8"));
  assert.equal(marker.intentOrigin, "direct"); assert.equal(marker.executionMode, "preflight");
  assert.equal(marker.closure.kind, "reservation_released");
  assert.equal(existsSync(path.join(f.evals, "manual-controls", "direct", `${held.jobId}.released`)), false);
  assert.equal(await (await f.preWorkerManual()).observeSelectedEvaluatorOwnersV1(), "none");
});

test("later canary binds preserve earlier slots and missing cumulative history refuses release", async t => {
  const f = await fixture(t); let held = await f.acquire();
  const repository = createV3ReleaseAdmissionRepository(f.database.sql, new ContentAddressedEvalResultStore(path.join(f.evals, "results")));
  const hashes: string[] = [];
  for (const entry of f.suite.suite.cases.slice(0, 2)) {
    const created = await repository.createCanary({ releaseSha: SOURCE_SHA, suiteHash: f.suite.suiteHash,
      preflightHash: "d".repeat(64), ttlMs: 60_000,
      slots: [{ caseHash: convergenceCaseHash(entry), taskHash: hashCanonicalJson(entry.task), repetition: 1, slotToken: randomUUID() + randomUUID() }] });
    const context = created.contexts[0]!; hashes.push(context.slotHash);
    held = await f.manual.bindSelectedManualCanaryV1({ reservation: held, admissionHash: context.admissionHash,
      slots: [{ admissionHash: context.admissionHash, slotHash: context.slotHash, caseHash: context.caseHash, taskHash: context.taskHash, repetition: 1 }] });
  }
  const head = path.join(f.evals, "manual-controls", "reservation.json"), record = JSON.parse(readFileSync(head, "utf8"));
  assert.deepEqual(record.slots.map((slot: { slotHash: string }) => slot.slotHash), hashes);
  record.slots = record.slots.slice(1);
  const corrupted = JSON.stringify(record) + "\n";
  writeFileSync(head, corrupted);
  writeFileSync(path.join(f.evals, "manual-controls", "revisions", `${String(held.revision).padStart(20, "0")}.json`), corrupted);
  await assert.rejects(() => f.manual.releaseSelectedManualEvaluationV1(held));
  await assert.rejects(() => f.manual.closeSelectedManualWorkerCustodyV1());
  assert.equal(await f.manual.observeSelectedEvaluatorOwnersV1(), "unknown");
});

test("terminal status without the actual canonical closed run owner cannot release custody", async t => {
  const f = await fixture(t,"worker",true); let held = await f.acquire();
  const entry = f.suite.suite.cases[0]!;
  const repository = createV3ReleaseAdmissionRepository(f.database.sql, new ContentAddressedEvalResultStore(path.join(f.evals, "results")));
  const created = await repository.createCanary({ releaseSha: SOURCE_SHA, suiteHash: f.suite.suiteHash, preflightHash: "d".repeat(64), ttlMs: 60_000,
    slots: f.suite.suite.cases.map(value=>({caseHash:convergenceCaseHash(value),taskHash:hashCanonicalJson(value.task),repetition:1,slotToken:randomUUID()+randomUUID()})) });
  const context = exactContextForEntry(created.contexts, entry);
  held = await f.manual.bindSelectedManualCanaryV1({ reservation: held, admissionHash: context.admissionHash,
    slots: created.contexts.map(({admissionHash,slotHash,caseHash,taskHash,repetition})=>({admissionHash,slotHash,caseHash,taskHash,repetition})) });
  const input = { ...f.ordinaryRunInput, run: { ...f.ordinaryRunInput.run, protocol: { ...f.ordinaryRunInput.run.protocol,
    releaseAdmissionKind: "convergence_canary" as const, releaseAdmissionHash: context.admissionHash, canaryAdmission: context } } };
  await startActualDefaultChild(f,input,held,created.contexts);
  // Private negative fixture: a status write supplies no terminal lifecycle or
  // owner-close authority. It must not make this run releasable.
  await f.database.sql`UPDATE runs SET status='failed' WHERE id=${input.run.id}`;
  const owners = await f.database.sql`SELECT state FROM internal_production_owner_reservations_v1 WHERE category='run' AND owner_key=${input.run.id}`;
  assert.equal(owners[0]?.state, "bound");
  await assert.rejects(() => f.manual.releaseSelectedManualEvaluationV1(held), /MANUAL_EVALUATION_ACTIVITY|MANUAL_EVALUATION_CANONICAL/);
  await assert.rejects(() => f.manual.closeSelectedManualWorkerCustodyV1(), /MANUAL_EVALUATION_RELEASE_REQUIRED/);
});

for(const readinessFault of ["crossed_database","unknown_reference"] as const)test(`authenticated readonly P3 readiness ${readinessFault} refuses actual child persistence before mutation`,async t=>{
  const f=await fixture(t,"worker",true);let held=await f.acquire();
  const repository=createV3ReleaseAdmissionRepository(f.database.sql,new ContentAddressedEvalResultStore(path.join(f.evals,"results")));
  const created=await repository.createCanary({releaseSha:SOURCE_SHA,suiteHash:f.suite.suiteHash,preflightHash:"d".repeat(64),ttlMs:60_000,
    slots:f.suite.suite.cases.map(entry=>({caseHash:convergenceCaseHash(entry),taskHash:hashCanonicalJson(entry.task),repetition:1,slotToken:randomUUID()+randomUUID()}))});
  held=await f.manual.bindSelectedManualCanaryV1({reservation:held,admissionHash:created.admission.admissionHash,
    slots:created.contexts.map(({admissionHash,slotHash,caseHash,taskHash,repetition})=>({admissionHash,slotHash,caseHash,taskHash,repetition}))});
  const context=exactContextForEntry(created.contexts,f.suite.suite.cases[0]!);
  const input={...f.ordinaryRunInput,run:{...f.ordinaryRunInput.run,protocol:{...f.ordinaryRunInput.run.protocol,
    releaseAdmissionKind:"convergence_canary" as const,releaseAdmissionHash:context.admissionHash,canaryAdmission:context}}};
  const before=await f.database.sql`SELECT reservation_ref,state FROM internal_production_owner_reservations_v1 ORDER BY reservation_ref`;
  await assert.rejects(()=>startActualDefaultChild(f,input,held,created.contexts,"none",readinessFault),(error:unknown)=>{
    const value=(error as {startObservation?:{publication:{state:string}|null;readinessInjectionReached:boolean;child:{stage:string;failure:SafeStartDiagnostic}|null}}).startObservation;
    return value?.publication?.state==="published" && value.readinessInjectionReached===true && value.child?.stage==="persist_run"
      && value.child.failure.code===(readinessFault==="crossed_database"?"RUN_PERSISTENCE_ADMISSION_READY_UNAVAILABLE":"RUN_PERSISTENCE_ADMISSION_READY_IDENTITY_INVALID");
  });
  assert.equal((await f.database.sql`SELECT id FROM runs`).length,0);
  assert.deepEqual(await f.database.sql`SELECT reservation_ref,state FROM internal_production_owner_reservations_v1 ORDER BY reservation_ref`,before);
  const claims=await f.database.sql`SELECT run_id,consumed_at FROM v3_canary_admission_claims WHERE admission_hash=${context.admissionHash}`;
  assert.equal(claims.length,8);assert.ok(claims.every(row=>row.run_id===null&&row.consumed_at===null));
});

for(const fault of ["proof_drift","foreign_child"] as const)test(`actual default child ${fault} cannot mutate a run, owner or one-use claim (selection, parent OS and authenticated readonly P3 readiness component fixture)`,async t=>{
  const f=await fixture(t,"worker",true);let held=await f.acquire();
  const repository=createV3ReleaseAdmissionRepository(f.database.sql,new ContentAddressedEvalResultStore(path.join(f.evals,"results")));
  const created=await repository.createCanary({releaseSha:SOURCE_SHA,suiteHash:f.suite.suiteHash,preflightHash:"d".repeat(64),ttlMs:60_000,slots:f.suite.suite.cases.map(value=>({caseHash:convergenceCaseHash(value),taskHash:hashCanonicalJson(value.task),repetition:1,slotToken:randomUUID()+randomUUID()}))});
  held=await f.manual.bindSelectedManualCanaryV1({reservation:held,admissionHash:created.admission.admissionHash,slots:created.contexts.map(({admissionHash,slotHash,caseHash,taskHash,repetition})=>({admissionHash,slotHash,caseHash,taskHash,repetition}))});
  const context=exactContextForEntry(created.contexts,f.suite.suite.cases[0]!);
  const input={...f.ordinaryRunInput,run:{...f.ordinaryRunInput.run,protocol:{...f.ordinaryRunInput.run.protocol,releaseAdmissionKind:"convergence_canary" as const,releaseAdmissionHash:context.admissionHash,canaryAdmission:context}}};
  const before=await f.database.sql`SELECT reservation_ref,state FROM internal_production_owner_reservations_v1 ORDER BY reservation_ref`;
  await assert.rejects(()=>startActualDefaultChild(f,input,held,created.contexts,fault), (error: unknown) => {
    const observed = (error as {startObservation?:{injectionReached:boolean;publication:{state:string}|null;start:SafeStartDiagnostic}}).startObservation;
    return observed?.injectionReached === true && observed.publication?.state === "published"
      && ["CONTROL_START_UNRESOLVED","CHILD_EXIT_NONZERO"].includes(observed.start.code ?? "");
  });
  assert.equal((await f.database.sql`SELECT id FROM runs`).length,0);
  assert.deepEqual(await f.database.sql`SELECT reservation_ref,state FROM internal_production_owner_reservations_v1 ORDER BY reservation_ref`,before);
  const claims=await f.database.sql`SELECT run_id,consumed_at FROM v3_canary_admission_claims WHERE admission_hash=${context.admissionHash}`;
  assert.equal(claims.length,8);assert.ok(claims.every(row=>row.run_id===null&&row.consumed_at===null));
});
