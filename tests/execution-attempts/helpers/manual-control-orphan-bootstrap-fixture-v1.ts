import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir, userInfo } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as orphanFs from "node:fs";
import { createHash } from "node:crypto";
import {
  MANUAL_ORPHAN_VECTOR_V1, encodeManualOrphanRunnerSetupFrameV1,
  encodeManualOrphanOwnedPhaseFrameV1, decodeManualOrphanOwnedPhaseResultV1,
  canonicalizeManualOrphanClusterBaselineV1, encodeManualOrphanIntegrationResultV1,
  decodeManualOrphanIntegrationResultV1, encodeManualOrphanRunnerResultV1,
  readManualOrphanOwnedFd4V1, observeManualOrphanOwnedFd4V1, holdManualOrphanOwnedSourcesV1, observeManualOrphanProcessV1,
  observeManualOrphanOwnedChildV1, observeManualOrphanOwnedIntegrationChildV1,
} from "./manual-control-orphan-bootstrap-child-v1.mjs";

// The legacy negative helpers below cannot establish original compiled launch,
// clean-main M, old T admission, or a fixed-I5 positive. The separate owned
// runner/integration routes require their retained ownership preconditions.
// All IO is explicit: importing this helper starts no child and reads no record.
const root = new URL("../../../", import.meta.url);
const adapter = new URL("src/installation/fresh-installation-manual-control-maintenance-v1.ts", root).href;
const cli = new URL("src/cli/manual-control-orphan-retirement-v1.ts", root).href;

export function runManualOrphanSourceContextNegativeV1(input: Readonly<{
  mode: "api" | "cli" | "calibration";
  args?: readonly string[];
  environment?: Readonly<Record<string, string>>;
  apiArguments?: "import-only" | "none" | "hostile" | "undefined";
}>): void {
  const program = `
    import assert from "node:assert/strict";
    import cp from "node:child_process";
    import fs from "node:fs";
    import fsp from "node:fs/promises";
    import net from "node:net";
    import tls from "node:tls";
    import path from "node:path";
    import {fileURLToPath} from "node:url";
    import {isBuiltin,registerHooks,syncBuiltinESMExports} from "node:module";
    const context=${JSON.stringify(input)};
    const maintenanceRoot=fileURLToPath(${JSON.stringify(root.href)});
    const productionRoots=[new URL("src/",${JSON.stringify(root.href)}).href,new URL("dist/",${JSON.stringify(root.href)}).href];
    const scaffoldSources=[${JSON.stringify(adapter)},${JSON.stringify(cli)},new URL("src/installation/manual-orphan-bootstrap-pins-v1.ts",${JSON.stringify(root.href)}).href];
    // tsx maps the existing ESM .js Source specifiers to these exact .ts files.
    // This finite bootstrap scaffold is allowed; no M observer/package is allowed.
    const scaffold=new Set(scaffoldSources.flatMap(url=>[url,url.slice(0,-3)+".js"]));
    const productionOrigin=(locator)=>typeof locator==="string"&&productionRoots.some(prefix=>locator.startsWith(prefix)||locator.startsWith(fileURLToPath(prefix)));
    const effects={imports:0,children:0,connections:0,targetReads:0,maintenanceReads:0,writes:0};
    const deny=(kind)=>{effects[kind]++;throw Error("COMPONENT_EFFECT_TRIPWIRE");};
    // Read origin is the nearest external caller, not any deeper production
    // frame: tsx/Node loader reads must not be attributed to the importing M.
    const captureStackTrace=Error.captureStackTrace;
    function productionReadCaller(wrapper){
      const formatter=Error.prepareStackTrace;
      try{
        Error.prepareStackTrace=(_error,frames)=>frames;
        const trace={};captureStackTrace(trace,wrapper);
        for(const frame of trace.stack){
          const locator=frame.getScriptNameOrSourceURL?.()??frame.getFileName();
          if(!locator||locator.startsWith("node:")||locator.startsWith("internal/"))continue;
          return productionOrigin(locator);
        }
        return false;
      }finally{Error.prepareStackTrace=formatter;}
    }
    function maintenancePath(value){
      if(typeof value==="number")return false;
      try{
        const locator=value instanceof URL?fileURLToPath(value):String(value);
        const absolute=path.resolve(locator);
        return absolute===maintenanceRoot.slice(0,-1)||absolute.startsWith(maintenanceRoot);
      }catch{return false;}
    }
    for(const key of ["spawn","spawnSync","execFile","execFileSync","exec","execSync","fork"])
      cp[key]=()=>deny("children");
    net.Socket.prototype.connect=function(){return deny("connections");};
    tls.connect=()=>deny("connections");
    const target=/[\\/]releases[\\/]setfarm-161297ff(?:[\\/]|$)|[\\/]installations[\\/]fdd9fe74-ccee-4673-a727-64fe57f68ad0(?:[\\/]|$)/;
    const calibrationUrl=new URL("src/__manual_orphan_component_monitor_calibration__.js",${JSON.stringify(root.href)}).href;
    registerHooks({resolve(specifier,context,next){
      if(isBuiltin(specifier))return next(specifier,context);
      if(target.test(specifier)||/^(postgres|zod|yaml)(?:\\/|$)/.test(specifier)
        ||/(?:db-pg|fresh-installation-entry-v1|runtime-config)\\.[cm]?[jt]s(?:$|[?#])/.test(specifier))
        return deny("imports");
      if(productionOrigin(context.parentURL)){
        let resolved;
        try{resolved=new URL(specifier,context.parentURL).href;}catch{return deny("imports");}
        if(!scaffold.has(resolved))return deny("imports");
      }
      if(${JSON.stringify(input.mode)}==="calibration"&&specifier===calibrationUrl)
        return {url:calibrationUrl,shortCircuit:true};
      return next(specifier,context);
    },load(url,loadContext,next){
      if(context.mode!=="calibration"||url!==calibrationUrl)return next(url,loadContext);
      // Harness calibration only: synthetic module, never a production substitute
      // or bootstrap-positive. All three attempts must trip before actual IO.
      return {format:"module",shortCircuit:true,source:
        'import fs from "node:fs";import fsp from "node:fs/promises";'+
        'try{fs.readFileSync(new URL("../package.json",import.meta.url));}catch{}'+
        'try{await fsp.readFile(new URL("../package.json",import.meta.url));}catch{}'+
        'try{await import("./internal-production/baseline-post-handoff-receipt-v1.js");}catch{}'};
    }});
    for(const owner of [fs,fsp]){
      for(const key of ["open","readFile","lstat","stat","readdir","realpath","access","readlink","opendir","createReadStream"]){
        for(const name of [key,key+"Sync"]){
          if(typeof owner[name]!=="function")continue;
          const original=owner[name];
          owner[name]=function monitoredRead(...args){
            if(target.test(String(args[0])))return deny("targetReads");
            if(maintenancePath(args[0])&&productionReadCaller(monitoredRead))return deny("maintenanceReads");
            return Reflect.apply(original,owner,args);
          };
        }
      }
      for(const key of ["writeFile","appendFile","mkdir","mkdtemp","rename","unlink","rm","rmdir","chmod","chown","truncate","link","symlink","copyFile","cp","createWriteStream"]){
        for(const name of [key,key+"Sync"])
          if(typeof owner[name]==="function")owner[name]=()=>deny("writes");
      }
    }
    syncBuiltinESMExports();
    const assertSafeError=(error)=>{
      assert.ok(error instanceof Error);
      assert.equal(Object.getPrototypeOf(error),Error.prototype);
      assert.equal(error.message,"BOOTSTRAP_CONTEXT_REFUSED");
      assert.equal(Object.hasOwn(error,"cause"),false);
      assert.deepEqual(Reflect.ownKeys(error).sort(),["message","stack"]);
    };
    if(context.mode==="calibration"){
      // Nonproduction harness/loader-origin M reads stay distinguishable.
      fs.readFileSync(new URL("package.json",${JSON.stringify(root.href)}));
      assert.equal(effects.maintenanceReads,0);
      await import(calibrationUrl);
      assert.deepEqual(effects,{imports:1,children:0,connections:0,targetReads:0,maintenanceReads:2,writes:0});
      process.stdout.write("COMPONENT_MONITORS_CALIBRATED\\n");
    }else if(context.mode==="api"){
      const stderr=[],stdout=[];
      const originalStderr=process.stderr.write,originalStdout=process.stdout.write;
      process.stderr.write=(value)=>{stderr.push(String(value));return true;};
      process.stdout.write=(value)=>{stdout.push(String(value));return true;};
      try{
      const api=await import(${JSON.stringify(adapter)});
      assert.deepEqual(Object.keys(api),["observeSelectedManualOrphanBootstrapV1"]);
      assert.equal(typeof api.observeSelectedManualOrphanBootstrapV1,"function");
      let touches=0;
      const hostile=new Proxy({}, {
        get(){touches++;throw Error("PRIVATE_CALLER_VALUE");},
        ownKeys(){touches++;throw Error("PRIVATE_CALLER_KEYS");},
        getPrototypeOf(){touches++;throw Error("PRIVATE_CALLER_PROTOTYPE");}
      });
      const args=context.apiArguments==="hostile"?[hostile]:context.apiArguments==="undefined"?[undefined]:[];
      const failures=[];
      for(let i=0;i<(context.apiArguments==="import-only"?0:2);i++){
        let caught;
        try{await Reflect.apply(api.observeSelectedManualOrphanBootstrapV1,null,args);}
        catch(error){caught=error;}
        assertSafeError(caught);failures.push(caught);
      }
      if(context.apiArguments!=="import-only")
        assert.notEqual(failures[0],failures[1],"each public rejection owns a fresh sanitized Error");
      assert.equal(touches,0,"arguments are rejected without inspecting caller authority");
      assert.equal(stdout.join(""),"");assert.equal(stderr.join(""),"");
      assert.deepEqual(effects,{imports:0,children:0,connections:0,targetReads:0,maintenanceReads:0,writes:0});
      }finally{process.stderr.write=originalStderr;process.stdout.write=originalStdout;}
      // Parent requires this harness-only receipt so an accidental process.exit(0)
      // from the API cannot bypass every assertion and look like a clean refusal.
      process.stdout.write("COMPONENT_API_CHECKED\\n");
    }else{
      process.argv=[process.execPath,new URL(${JSON.stringify(cli)}).pathname,...context.args??[]];
      process.on("exit",()=>{
        assert.deepEqual(effects,{imports:0,children:0,connections:0,targetReads:0,maintenanceReads:0,writes:0});
      });
      await import(${JSON.stringify(cli)});
    }
  `;
  const result = spawnSync(process.execPath,
    ["--import", import.meta.resolve("tsx"), "--input-type=module", "-e", program], {
      cwd: root,
      env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C", TSX_DISABLE_CACHE: "1", ...input.environment },
      encoding: "utf8", timeout: 15_000, maxBuffer: 65_536,
    });
  assert.equal(result.error, undefined, "component child did not finish normally");
  assert.equal(result.signal, null);
  assert.equal(result.status, input.mode === "cli" ? 1 : 0, result.stderr);
  assert.equal(result.stdout, input.mode === "api" ? "COMPONENT_API_CHECKED\n"
    : input.mode === "calibration" ? "COMPONENT_MONITORS_CALIBRATED\n" : "");
  assert.equal(result.stderr, input.mode === "cli" ? "BOOTSTRAP_CONTEXT_REFUSED\n" : "");
}

// This is a component copy, not a stock build or authenticated Source projection.
// It transpiles complete unchanged modules without extracting/replacing guards.
// The explicit preload and temporary root make original launch invalid. Thus a
// refusal here proves only public CLI encoding and the pre-import boundary; it
// cannot identify which original-launch/argv/environment check caused refusal.
export async function runManualOrphanCompiledCliNegativeV1(args: readonly string[]): Promise<void> {
  const ts = await import("typescript");
  const temporaryLocator = mkdtempSync(join(tmpdir(), "setfarm-orphan-component-"));
  try {
    // Match Node's physical module URLs (for example /private/tmp on Darwin).
    const temporary = realpathSync(temporaryLocator);
    writeFileSync(join(temporary, "package.json"), '{"type":"module"}\n');
    const componentLocators = [
      "cli/manual-control-orphan-retirement-v1",
      "installation/fresh-installation-manual-control-maintenance-v1",
      "installation/manual-orphan-bootstrap-pins-v1",
    ];
    const allowed = componentLocators.map((locator) => {
      const source = readFileSync(new URL(`src/${locator}.ts`, root), "utf8");
      const output = join(temporary, "dist", `${locator}.js`);
      mkdirSync(new URL(".", pathToFileURL(output)), { recursive: true });
      writeFileSync(output, ts.transpileModule(source, {
        fileName: `${locator}.ts`,
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
      }).outputText);
      return pathToFileURL(realpathSync(output)).href;
    });
    const preload = join(temporary, "component-tripwire.mjs");
    writeFileSync(preload, `
      import assert from "node:assert/strict";
      import fs from "node:fs";
      import fsp from "node:fs/promises";
      import cp from "node:child_process";
      import net from "node:net";
      import tls from "node:tls";
      import {isAbsolute} from "node:path";
      import {pathToFileURL} from "node:url";
      import {isBuiltin,registerHooks,syncBuiltinESMExports} from "node:module";
      const effects={imports:0,children:0,connections:0,targetReads:0,writes:0};
      const deny=(kind)=>{effects[kind]++;throw Error("COMPONENT_EFFECT_TRIPWIRE");};
      const allowed=new Set(${JSON.stringify(allowed)});
      registerHooks({resolve(specifier,context,next){
        if(isBuiltin(specifier))return next(specifier,context);
        let url;
        try{url=isAbsolute(specifier)?pathToFileURL(specifier).href:new URL(specifier,context.parentURL).href;}catch{return deny("imports");}
        if(!allowed.has(url))return deny("imports");
        return next(specifier,context);
      }});
      for(const key of ["spawn","spawnSync","execFile","execFileSync","exec","execSync","fork"])
        cp[key]=()=>deny("children");
      net.Socket.prototype.connect=function(){return deny("connections");};
      tls.connect=()=>deny("connections");
      const target=/[\\\\/]releases[\\\\/]setfarm-161297ff(?:[\\\\/]|$)|[\\\\/]installations[\\\\/]fdd9fe74-ccee-4673-a727-64fe57f68ad0(?:[\\\\/]|$)/;
      for(const owner of [fs,fsp]){
        for(const key of ["open","readFile","lstat","stat","readdir","realpath","access","readlink","opendir","createReadStream"]){
          for(const name of [key,key+"Sync"]){
            if(typeof owner[name]!=="function")continue;
            const original=owner[name];
            owner[name]=function(...values){
              if(target.test(String(values[0])))return deny("targetReads");
              return Reflect.apply(original,owner,values);
            };
          }
        }
        for(const key of ["writeFile","appendFile","mkdir","mkdtemp","rename","unlink","rm","rmdir","chmod","chown","truncate","link","symlink","copyFile","cp","createWriteStream"]){
          for(const name of [key,key+"Sync"])
            if(typeof owner[name]==="function")owner[name]=()=>deny("writes");
        }
      }
      syncBuiltinESMExports();
      // A caught tripwire cannot masquerade as a successful refusal: the exit
      // listener independently checks every attempt even if CLI sanitizes it.
      process.on("exit",()=>{
        assert.deepEqual(effects,{imports:0,children:0,connections:0,targetReads:0,writes:0});
      });
    `);
    const result = spawnSync(process.execPath, ["--import", preload,
      join(temporary, "dist", "cli", "manual-control-orphan-retirement-v1.js"), ...args], {
      cwd: temporary,
      env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" },
      encoding: "utf8", timeout: 15_000, maxBuffer: 65_536,
    });
    assert.equal(result.error, undefined, "compiled component child did not finish normally");
    assert.equal(result.signal, null);
    assert.equal(result.status, 1, result.stderr);
    assert.equal(result.stdout, "");
    assert.equal(result.stderr, "BOOTSTRAP_CONTEXT_REFUSED\n");
  } finally {
    rmSync(temporaryLocator, { recursive: true, force: true });
  }
}

// Task5C genuine owners. Everything above this boundary, except the explicitly
// recorded inert imports, is the original dormant component fixture.
// Wire values originate in the actual MJS codecs. Dynamic stock/driver records
// are projected and checked here before any private ledger accepts them.
type ManualOrphanDataV1 = Record<string, any>;
type ManualOrphanPairV1 = Readonly<{pid:number;backendStartedAtUTC:string;datid:number;usesysid:number}>;
type ManualOrphanPinV1 = {path:string;fd:number;kind:"file"|"directory";policy:string;identity:ManualOrphanDataV1};
type ManualOrphanPinsV1 = {stage:string;maintenanceRoot:string;source:ManualOrphanPinV1[];records:ManualOrphanPinV1[];mutable:ManualOrphanPinV1[]};
const manualOrphanNodeV1="/opt/homebrew/Cellar/node/26.4.0/bin/node";
const manualOrphanWorkspaceV1="/Users/setrox/ai/setrox";
const manualOrphanFileV1="tests/execution-attempts/manual-control-orphan-bootstrap-v1.integration.test.ts";
const manualOrphanHelperV1="tests/execution-attempts/helpers/manual-control-orphan-bootstrap-child-v1.mjs";
const manualOrphanPathV1="/opt/homebrew/Cellar/node/26.4.0/bin:/Users/setrox/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin";
const manualOrphanNodeHashV1="59cd4fb59cf5bc239f43d5db8c0cd8c23c22db79419612b92da3b7cf34de8553";
const manualOrphanSourceNamesV1=["constructor","constructorTests","wrapper","isolatedRunner","builtinChild","routeTests","fixture","integration","journal","pgPreflight","profile"] as const;
const manualOrphanSourceFilesV1=["scripts/run-private-postgres-tests.mjs","scripts/__tests__/private-postgres-test-cluster.test.js",
  "scripts/run-execution-attempt-tests.ts","scripts/run-isolated-postgres-tests.ts",manualOrphanHelperV1,
  "scripts/__tests__/manual-orphan-bootstrap-owned-route-v1.test.js","tests/execution-attempts/helpers/manual-control-orphan-bootstrap-fixture-v1.ts",
  manualOrphanFileV1,"scripts/private-postgres-test-journal-v1.mjs","scripts/finding-test-preflight.mjs","src/installation/manual-orphan-target-dependencies-v1.json"] as const;
const manualOrphanRecordNamesV1=["planned.json","owner-created.json","runtime-created.json","database-created.json","runtime-credentials.json","schema-prepared.json","schema-committed.json"] as const;
let manualOrphanFixtureClaimedV1=false;
let manualOrphanFixtureOutputFaultV1=false;
let manualOrphanFixtureCompletionV1:ReturnType<typeof retainManualOrphanFixtureCompletionV1>|null=null;
const manualOrphanCompletionChildrenV1=new WeakMap<object,Set<ReturnType<typeof retainManualOrphanOriginalChildLifetimeV1>>>();

function claimManualOrphanFixtureEntryV1(kind:string,argumentCount:number):void {
  const previous=manualOrphanFixtureClaimedV1;manualOrphanFixtureClaimedV1=true;
  if(previous||(kind!=="runner"&&kind!=="integration")||argumentCount!==0)throw Error("MANUAL_ORPHAN_OWNER_REFUSED");
}
function qualifyManualOrphanFixtureLaunchV1(kind:string,actual:ManualOrphanDataV1,frame:ManualOrphanDataV1):ManualOrphanDataV1 {
  try {
    const need=(ok:unknown):void=>{if(!ok)throw Error();};
    const m=actual.maintenanceRoot,t=manualOrphanWorkspaceV1+"/releases/setfarm-161297ff";
    need(kind==="runner"||kind==="integration");need(typeof m==="string"&&dirname(m)===manualOrphanWorkspaceV1+"/releases"
      &&/^setfarm-[a-f0-9]{8}$/.test(basename(m))&&m!==t&&basename(m)==="setfarm-"+frame.source.maintenance.sha.slice(0,8));
    need(actual.workspace===manualOrphanWorkspaceV1&&actual.targetRoot===t&&actual.node===manualOrphanNodeV1
      &&actual.cwd===m&&actual.execPath===manualOrphanNodeV1&&actual.argv0===manualOrphanNodeV1);
    need(JSON.stringify(actual.maintenance)===JSON.stringify(frame.source.maintenance)&&JSON.stringify(actual.target)===JSON.stringify(frame.source.target));
    const integration=kind==="integration",self=integration?frame.child:frame.runner,parent=integration?frame.runner:frame.constructor;
    const ownRaw=manualOrphanNodeV1+(integration?" --import tsx --test --test-isolation=none "+manualOrphanFileV1:
      " --import tsx scripts/run-isolated-postgres-tests.ts -- "+MANUAL_ORPHAN_VECTOR_V1.join(" "));
    const parentRaw=integration?manualOrphanNodeV1+" --import tsx scripts/run-isolated-postgres-tests.ts -- "+MANUAL_ORPHAN_VECTOR_V1.join(" "):
      manualOrphanNodeV1+" "+m+"/scripts/run-private-postgres-tests.mjs manual-orphan-bootstrap";
    for(const [observation,expected,raw] of [[actual.self,self,ownRaw],[actual.parent,parent,parentRaw]] as const){
      need(observation.rawCommand===raw&&JSON.stringify(observation.pin)===JSON.stringify(expected));
      need(expected.uid===501&&expected.executable===manualOrphanNodeV1&&expected.executableSha256===manualOrphanNodeHashV1
        &&expected.commandSha256===createHash("sha256").update(raw).digest("hex"));
    }
    need(self.ppid===parent.pid&&self.pid!==parent.pid);
    const argv=[manualOrphanNodeV1,m+"/"+(integration?manualOrphanFileV1:"scripts/run-isolated-postgres-tests.ts"),...(integration?[]:["--",...MANUAL_ORPHAN_VECTOR_V1])];
    need(JSON.stringify(actual.argv)===JSON.stringify(argv)&&JSON.stringify(actual.execArgv)===JSON.stringify(integration?
      ["--import","tsx","--test","--test-isolation=none"]:["--import","tsx"]));
    need(actual.env.PATH===manualOrphanPathV1&&actual.env.LANG==="C"&&actual.env.LC_ALL==="C");
    need(Object.keys(actual.env).every(key=>["PATH","LANG","LC_ALL","__CF_USER_TEXT_ENCODING"].includes(key)));
    if(Object.hasOwn(actual.env,"__CF_USER_TEXT_ENCODING")){
      const value=actual.env.__CF_USER_TEXT_ENCODING;need(typeof value==="string");
      const fields=value.split(":");need(fields.length===3&&fields[0]==="0x1F5"
        &&fields.every((field:string)=>/^0x(?:0|[1-9A-F][0-9A-F]{0,7})$/.exec(field)?.[0]===field));
    }
    need(integration?actual.worker!==null&&Object.keys(actual.worker).length===1&&Object.hasOwn(actual.worker,"NODE_TEST_WORKER_ID")&&actual.worker.NODE_TEST_WORKER_ID==="1":actual.worker===null);
    return Object.freeze({node:manualOrphanNodeV1,maintenanceRoot:m,targetRoot:t,workspace:manualOrphanWorkspaceV1,
      helper:m+"/"+manualOrphanHelperV1,integration:m+"/"+manualOrphanFileV1});
  } catch {throw Error("MANUAL_ORPHAN_OWNER_REFUSED");}
}
function joinManualOrphanInstallationFactsV1(stage:string,receipt:ManualOrphanDataV1,records:ManualOrphanDataV1,catalogs:ManualOrphanDataV1):ManualOrphanDataV1 {
  try {
    const need=(ok:unknown):void=>{if(!ok)throw Error();};
    const equal=(a:unknown,b:unknown):boolean=>JSON.stringify(a)===JSON.stringify(b);
    const freeze=(value:any):any=>{if(value!==null&&typeof value==="object"){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;};
    need(stage==="committed"||stage==="activated");
    // Actual decoder alone defines receipt keys, values, canonical ordering and limits.
    const decoded=decodeManualOrphanOwnedPhaseResultV1(Buffer.from(JSON.stringify(receipt)+"\n")) as ManualOrphanDataV1;
    need(decoded.purpose===(stage==="activated"?"activate":"provision"));
    const i=decoded.result.installation,p=records.prepared,o=p.origin,e=catalogs.expected;
    need(p.committed===true&&o.schema==="setfarm.fresh-installation-origin.v1"&&o.systemIdentifier===e.cluster.systemIdentifier
      &&o.sourceSha===e.sourceSha&&o.sourceSha===i.sourceSha&&p.catalogHash===i.schemaCatalogHash
      &&catalogs.schemaCatalogHash===i.schemaCatalogHash&&records.observedSchemaCatalogHash===i.schemaCatalogHash
      &&p.ownerOid===i.ownerOid&&p.runtimeOid===i.runtimeOid&&i.ownerOid!==i.runtimeOid);
    for(const key of ["installationId","operationId","databaseName","databaseOid","ownerRole","runtimeRole","sourceSha"])need(o[key]===i[key]);
    need(Array.isArray(o.migrations)&&o.migrations.length===33&&equal(o.migrations,e.migrations));
    for(let n=0;n<33;n++)need(o.migrations[n].version===n+1&&o.migrations[n].migrationClass===(n===31?"guarded":"automatic"));
    need(records.selectedDirectory===e.installationsDirectory+"/"+i.installationId&&records.directory.realpath===records.selectedDirectory);
    for(const key of ["dev","ino","uid","gid","mode"])need(records.directory[key]===i.directory[key]);
    need(Object.keys(p.baseRecordPins).length===7);
    for(const name of manualOrphanRecordNamesV1)need(equal(p.baseRecordPins[name],i.records[name]));
    if(e.installation!==null){
      for(const key of ["installationId","operationId","directory","databaseName","databaseOid","ownerRole","ownerOid","runtimeRole","runtimeOid","sourceSha","schemaCatalogHash"])
        need(equal(e.installation[key],i[key]));
      for(const name of manualOrphanRecordNamesV1)need(equal(e.installation.records[name],i.records[name]));
    }
    if(stage==="activated"){
      const a=records.activation;need(a!==null&&a.acknowledged===true&&records.staleAbsenceRefused===true
        &&i.activationCatalogHash!==i.schemaCatalogHash&&i.activationCatalogHash===catalogs.activationCatalogHash
        &&i.activationCatalogHash===records.observedActivationCatalogHash&&a.prepared.catalogHash===i.activationCatalogHash);
      need(equal(a.prepared.origin,o)&&equal(a.prepared.directoryIdentity,records.directory));
      for(const name of manualOrphanRecordNamesV1)need(equal(a.baseRecordPins[name],i.records[name]));
      for(const name of ["schema-prepared.json","schema-committed.json"])need(equal(a.prepared.schemaRecordPins[name],i.records[name]));
      need(equal(a.preparedPin,i.records["activation-prepared.json"])&&equal(a.activatedPin,i.records["activated.json"]));
      need(equal(records.activationReturn,{schema:"setfarm.fresh-installation-activation-verification.v1",state:"activated",
        installationId:i.installationId,sourceSha:i.sourceSha,catalogHash:i.activationCatalogHash}));
    }else need(records.activation===null&&records.activationAbsenceObserved===true&&records.activationReturn===null&&catalogs.activationCatalogHash===null);
    const rows=catalogs.rows,db=rows.databases.filter((r:ManualOrphanDataV1)=>r.name===i.databaseName),roles=rows.roles.filter((r:ManualOrphanDataV1)=>r.name===i.ownerRole||r.name===i.runtimeRole);
    need(rows.databases.length===4&&rows.roles.length<=130&&rows.memberships.length<=256&&db.length===1&&roles.length===2
      &&db[0].oid===i.databaseOid&&db[0].ownerOid===i.ownerOid&&db[0].allowConnections===true&&db[0].connectionLimit===-1);
    for(const row of roles){const owner=row.name===i.ownerRole;need(row.oid===(owner?i.ownerOid:i.runtimeOid)&&row.login===!owner
      &&row.superuser===false&&row.inherit===false&&row.createRole===false&&row.createDb===false&&row.replication===false
      &&row.bypassRls===false&&row.connectionLimit===-1&&row.validUntilUTC===null);}
    need(rows.memberships.every((r:ManualOrphanDataV1)=>[r.roleOid,r.memberOid,r.grantorOid].every(id=>id!==i.ownerOid&&id!==i.runtimeOid)));
    const baseline=canonicalizeManualOrphanClusterBaselineV1({databases:rows.databases.filter((r:unknown)=>r!==db[0]),roles:rows.roles.filter((r:unknown)=>!roles.includes(r)),memberships:rows.memberships}) as ManualOrphanDataV1;
    for(const key of ["databaseBaselineSha256","roleBaselineSha256","membershipBaselineSha256"])need(baseline[key]===e.cluster[key]);
    return freeze(i);
  }catch{throw Error("MANUAL_ORPHAN_OWNER_REFUSED");}
}
function checkManualOrphanDeliveryMetadataV1(pins:ManualOrphanPinsV1):boolean {
  try {
    const need=(ok:unknown):void=>{if(!ok)throw Error();};
    const m=pins.maintenanceRoot;need(dirname(m)===manualOrphanWorkspaceV1+"/releases");
    const ancestors=["/","/Users","/Users/setrox","/Users/setrox/ai",manualOrphanWorkspaceV1,manualOrphanWorkspaceV1+"/releases",m,m+"/scripts",m+"/scripts/__tests__",m+"/tests",m+"/tests/execution-attempts",m+"/tests/execution-attempts/helpers",m+"/src",m+"/src/installation"];
    const count=pins.stage==="provision"?0:pins.stage==="activate"?7:["integration","old_entry_positive","new_entry_refusal"].includes(pins.stage)?9:-1;
    need(count>=0&&pins.source.length===25&&pins.records.length===count&&pins.mutable.length===(count===0?3:4));
    const seen=new Set<number>();
    for(let n=0;n<25;n++)need(pins.source[n].path===(n<11?m+"/"+manualOrphanSourceFilesV1[n]:ancestors[n-11])
      &&pins.source[n].policy===(n<11?"immutable-file":n<17?"shared-ancestor":"immutable-directory"));
    const names=[...manualOrphanRecordNamesV1,"activation-prepared.json","activated.json"];
    for(let n=0;n<count;n++)need(basename(pins.records[n].path)===names[n]&&pins.records[n].policy==="immutable-file");
    for(const row of [...pins.source,...pins.records,...pins.mutable]){
      need(Number.isSafeInteger(row.fd)&&row.fd>=0&&!seen.has(row.fd));seen.add(row.fd);
      const expected=row.identity;
      for(const stat of [orphanFs.lstatSync(row.path,{bigint:true}),orphanFs.fstatSync(row.fd,{bigint:true})]){
        need(!stat.isSymbolicLink()&&(row.kind==="file"?stat.isFile():stat.isDirectory()));
        const keys=["dev","ino","uid","gid","mode","birthtimeNs",...(row.policy==="immutable-file"||row.policy==="immutable-directory"?["nlink","size","mtimeNs","ctimeNs"]:[])];
        for(const key of keys){const value=(stat as unknown as Record<string,unknown>)[key];need(typeof value==="bigint"&&value===BigInt(expected[key]));}
        need((stat.mode&0o022n)===0n&&(stat.uid===501n||row.policy==="shared-ancestor"&&stat.uid===0n));
        if(row.kind==="file")need(stat.nlink===1n&&stat.size>=0n&&stat.size<=16777216n);
        if(row.policy==="mutable-directory")need(row.kind==="directory"&&stat.uid===501n&&stat.gid===20n&&(stat.mode&0o7777n)===0o700n);
      }
    }
    return true;
  }catch{throw Error("MANUAL_ORPHAN_OWNER_REFUSED");}
}
function deliverManualOrphanOwnedFrameV1(child:ManualOrphanDataV1,witness:ManualOrphanDataV1,frame:ManualOrphanDataV1,delivery:ManualOrphanDataV1):ManualOrphanDataV1 {
  const fail=():never=>{delivery.unknown=true;throw Error("MANUAL_ORPHAN_CLEANUP_UNKNOWN");};
  const clock=():void=>{try{const now=process.hrtime.bigint(),start=BigInt(delivery.startedAtNs),last=BigInt(delivery.lastAtNs);
    if(now<0n||now<last||last<start||now-start>=5000000000n)fail();delivery.lastAtNs=String(now);}catch{fail();}};
  try {
    if(delivery.unknown||delivery.ended||delivery.issued!==null||manualOrphanFixtureOutputFaultV1)fail();clock();
    const current=():void=>{const s=witness.snapshot();if(manualOrphanFixtureOutputFaultV1||s.state!=="pending"||s.reason!==null||s.stderr.bytes!==0||s.exit!==null||s.close!==null)fail();clock();};
    current();if(child.pid!==frame.child.pid||delivery.purpose!==frame.purpose||delivery.postspawn.length!==3)fail();
    for(const [n,key] of [[0,"parent"],[1,"server"],[2,"child"]] as const){const got=delivery.postspawn[n],old=delivery.retainedGraph[key];
      if(JSON.stringify(got)!==JSON.stringify(old)||JSON.stringify(got.pin)!==JSON.stringify(frame[key])
        ||createHash("sha256").update(got.rawCommand).digest("hex")!==got.pin.commandSha256)fail();}
    const m=delivery.pins.maintenanceRoot,mechanical=frame.purpose==="old_entry_positive"||frame.purpose==="new_entry_refusal";
    const expectedChild=manualOrphanNodeV1+(frame.purpose==="integration"?" --import tsx --test --test-isolation=none "+manualOrphanFileV1:" "+m+"/"+manualOrphanHelperV1);
    const expectedParent=manualOrphanNodeV1+(mechanical?" --import tsx --test --test-isolation=none "+manualOrphanFileV1:
      " --import tsx scripts/run-isolated-postgres-tests.ts -- "+MANUAL_ORPHAN_VECTOR_V1.join(" "));
    if(basename(m)!=="setfarm-"+frame.source.maintenance.sha.slice(0,8)||delivery.postspawn[0].rawCommand!==expectedParent||delivery.postspawn[2].rawCommand!==expectedChild
      ||frame.child.ppid!==frame.parent.pid||frame.child.executable!==manualOrphanNodeV1||frame.child.executableSha256!==manualOrphanNodeHashV1)fail();
    checkManualOrphanDeliveryMetadataV1(delivery.pins);current();
    const bytes=encodeManualOrphanOwnedPhaseFrameV1(frame),digest=createHash("sha256").update(bytes).digest("hex");
    const installation=frame.purpose==="provision"?null:frame.input.installation;
    const freeze=(value:any):any=>{if(value!==null&&typeof value==="object"){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
    const issued=freeze({purpose:frame.purpose,run:frame.run,frameSha256:digest,pid:frame.child.pid,parentPid:frame.parent.pid,installation});
    delivery.issued=issued;checkManualOrphanDeliveryMetadataV1(delivery.pins);current();
    const writer=child.stdio[4];if(writer===null||typeof writer.end!=="function")fail();clock();
    delivery.ended=true;writer.end(bytes);clock();return issued;
  }catch{return fail();}
}
function correlateManualOrphanPhaseResultV1(issued:ManualOrphanDataV1,snapshot:ManualOrphanDataV1,output:ManualOrphanDataV1):ManualOrphanDataV1 {
  try {
    const need=(ok:unknown):void=>{if(!ok)throw Error();};
    need(snapshot.purpose===issued.purpose&&snapshot.state==="observed"&&snapshot.reason===null
      &&snapshot.exit.code===0&&snapshot.exit.signal===null&&snapshot.close.code===0&&snapshot.close.signal===null
      &&snapshot.stdout.end&&snapshot.stdout.close&&snapshot.stderr.end&&snapshot.stderr.close
      &&snapshot.fd4.finish&&snapshot.fd4.end&&snapshot.fd4.close&&snapshot.stderr.bytes===0&&output.stderr.length===0
      &&snapshot.stdout.bytes===output.stdout.length&&createHash("sha256").update(output.stdout).digest("hex")===snapshot.stdout.sha256);
    const result=decodeManualOrphanOwnedPhaseResultV1(output.stdout) as ManualOrphanDataV1;
    for(const key of ["purpose","run","frameSha256","pid","parentPid"])need(result[key]===issued[key]);
    if(issued.purpose==="provision")need(issued.installation===null);
    else if(issued.purpose==="activate"){
      const actual=result.result.installation,old=issued.installation;
      for(const key of ["installationId","operationId","directory","databaseName","databaseOid","ownerRole","ownerOid","runtimeRole","runtimeOid","sourceSha","schemaCatalogHash"])
        need(JSON.stringify(actual[key])===JSON.stringify(old[key]));
      for(const name of manualOrphanRecordNamesV1)need(JSON.stringify(actual.records[name])===JSON.stringify(old.records[name]));
    }else need(result.result.installationId===issued.installation.installationId&&result.result.target.sha===issued.installation.sourceSha);
    return result;
  }catch{throw Error("MANUAL_ORPHAN_OWNER_REFUSED");}
}
function correlateManualOrphanIntegrationResultV1(issued:ManualOrphanDataV1,snapshot:ManualOrphanDataV1,output:ManualOrphanDataV1):ManualOrphanDataV1 {
  try {
    const need=(ok:unknown):void=>{if(!ok)throw Error();};
    need(issued.purpose==="integration"&&snapshot.purpose==="integration"&&snapshot.state==="observed"&&snapshot.reason===null
      &&snapshot.exit.code===0&&snapshot.exit.signal===null&&snapshot.close.code===0&&snapshot.close.signal===null
      &&snapshot.stdout.end&&snapshot.stdout.close&&snapshot.stderr.end&&snapshot.stderr.close&&snapshot.stderr.bytes===0&&output.stderr.length===0
      &&snapshot.fd4.finish&&snapshot.fd4.end&&snapshot.fd4.close&&output.integration.state==="observed");
    const summary=output.integration.summary;need(Object.keys(summary).length===7);
    for(const [key,value] of Object.entries({tests:1,suites:0,pass:1,fail:0,cancelled:0,skipped:0,todo:0}))need(summary[key]===value);
    const result=decodeManualOrphanIntegrationResultV1(encodeManualOrphanIntegrationResultV1(output.integration.marker)) as ManualOrphanDataV1;
    for(const key of ["run","frameSha256","pid","parentPid"])need(result[key]===issued[key]);
    need(result.oldEntry.installationId===issued.installation.installationId&&result.newEntry.installationId===issued.installation.installationId
      &&result.oldEntry.target.sha===issued.installation.sourceSha&&result.newEntry.target.sha===issued.installation.sourceSha);
    return result;
  }catch{throw Error("MANUAL_ORPHAN_OWNER_REFUSED");}
}
function advanceManualOrphanRouteLedgerV1(ledger:ManualOrphanDataV1,event:ManualOrphanDataV1):ManualOrphanDataV1 {
  const freeze=(value:any):any=>{if(value!==null&&typeof value==="object"){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
  const old=JSON.parse(JSON.stringify(ledger));if(old.unknown)return freeze(old);
  try {
    const need=(ok:unknown):void=>{if(!ok)throw Error();};
    const next:Record<string,string>={empty:"schema-verified","schema-verified":"activation-verified","activation-verified":"cases-settled",
      "cases-settled":"database-dropped","database-dropped":"runtime-dropped","runtime-dropped":"owner-dropped","owner-dropped":"clean"};
    need(event.type===next[ledger.state]);const c=event.closures;
    need(c.pending===0&&c.fault===null&&c.queries==="settled"&&c.input==="fulfilled"&&c.children==="fulfilled"
      &&[c.source,c.admin].every(v=>v==="fulfilled"||(event.type!=="clean"&&v==="retained")));
    need(event.source.maintenance.sha!==event.source.target.sha&&event.source.target.sha===event.installation.sourceSha);
    canonicalizeManualOrphanClusterBaselineV1({databases:event.baseline.databases,roles:event.baseline.roles,memberships:event.baseline.memberships});
    if(event.type==="schema-verified"||event.type==="activation-verified"){
      const p=decodeManualOrphanOwnedPhaseResultV1(Buffer.from(JSON.stringify(event.phase)+"\n")) as ManualOrphanDataV1;
      need(p.purpose===(event.type==="schema-verified"?"provision":"activate")&&JSON.stringify(p.result.installation)===JSON.stringify(event.installation));
      if(old.installation!==null){for(const key of ["installationId","operationId","databaseName","databaseOid","ownerRole","ownerOid","runtimeRole","runtimeOid","sourceSha","schemaCatalogHash"])
        need(old.installation[key]===event.installation[key]);for(const name of manualOrphanRecordNamesV1)need(JSON.stringify(old.installation.records[name])===JSON.stringify(event.installation.records[name]));}
      old.installation=event.installation;
    }else if(event.type==="cases-settled"){
      const r=decodeManualOrphanIntegrationResultV1(encodeManualOrphanIntegrationResultV1(event.integration)) as ManualOrphanDataV1;
      need(r.oldEntry.installationId===old.installation.installationId&&r.oldEntry.target.sha===old.installation.sourceSha
        &&JSON.stringify(event.installation)===JSON.stringify(old.installation));old.oldEntry=r.oldEntry;old.newEntry=r.newEntry;
    }else if(event.type==="clean"){
      need(event.cleanup.databaseAbsent===true&&event.cleanup.runtimeRoleAbsent===true&&event.cleanup.ownerRoleAbsent===true
        &&event.cleanup.baselineRestored===true&&event.cleanup.adminClose==="fulfilled");
    }else need(event.cleanup!==null&&event.cleanup.state===event.type&&event.cleanup.unknown===false);
    old.state=event.type;return freeze(old);
  }catch{throw Error("MANUAL_ORPHAN_OWNER_REFUSED");}
}
function qualifyManualOrphanRunnerCatalogV1(stage:string,baseline:ManualOrphanDataV1,generated:ManualOrphanDataV1|null,rows:ManualOrphanDataV1,sessions:ManualOrphanDataV1):ManualOrphanDataV1 {
  try {
    const need=(ok:unknown):void=>{if(!ok)throw Error();};
    need(["initial","created","activated","database-dropped","runtime-dropped","owner-dropped"].includes(stage));
    need(Array.isArray(rows.databases)&&rows.databases.length<=(stage==="created"||stage==="activated"?4:3)
      &&Array.isArray(rows.roles)&&rows.roles.length<=130&&Array.isArray(rows.memberships)&&rows.memberships.length<=256);
    let databases=rows.databases,roles=rows.roles;
    if(stage!=="initial"){
      const i=generated;need(i!==null);if(i===null)throw Error();
      need(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(i.installationId));
      const suffix=i.installationId.replaceAll("-","");
      need(i.databaseName==="setfarm_install_"+suffix&&i.ownerRole==="sf_owner_"+suffix&&i.runtimeRole==="sf_runtime_"+suffix
        &&Number.isSafeInteger(i.databaseOid)&&i.databaseOid>0&&Number.isSafeInteger(i.ownerOid)&&i.ownerOid>0
        &&Number.isSafeInteger(i.runtimeOid)&&i.runtimeOid>0&&i.ownerOid!==i.runtimeOid);
      const databasePresent=stage==="created"||stage==="activated",runtimePresent=databasePresent||stage==="database-dropped",ownerPresent=stage!=="owner-dropped";
      const db=rows.databases.filter((r:ManualOrphanDataV1)=>r.name===i.databaseName||r.oid===i.databaseOid);
      need(db.length===(databasePresent?1:0));if(databasePresent)need(db[0].name===i.databaseName&&db[0].oid===i.databaseOid&&db[0].ownerOid===i.ownerOid
        &&db[0].allowConnections===true&&db[0].connectionLimit===-1&&Object.keys(db[0]).length===5);
      const remove:unknown[]=[];
      for(const [name,oid,login,present] of [[i.ownerRole,i.ownerOid,false,ownerPresent],[i.runtimeRole,i.runtimeOid,true,runtimePresent]] as const){
        const found=rows.roles.filter((r:ManualOrphanDataV1)=>r.name===name||r.oid===oid);need(found.length===(present?1:0));
        if(present){const r=found[0];need(Object.keys(r).length===11&&r.name===name&&r.oid===oid&&r.login===login&&r.superuser===false&&r.inherit===false
          &&r.createRole===false&&r.createDb===false&&r.replication===false&&r.bypassRls===false&&r.connectionLimit===-1&&r.validUntilUTC===null);remove.push(r);}
      }
      need(rows.memberships.every((r:ManualOrphanDataV1)=>[r.roleOid,r.memberOid,r.grantorOid].every(v=>v!==i.ownerOid&&v!==i.runtimeOid)));
      databases=rows.databases.filter((r:unknown)=>!db.includes(r));roles=rows.roles.filter((r:unknown)=>!remove.includes(r));
    }else need(generated===null);
    const canonical=canonicalizeManualOrphanClusterBaselineV1({databases,roles,memberships:rows.memberships}) as ManualOrphanDataV1;
    for(const key of ["databaseBaselineSha256","roleBaselineSha256","membershipBaselineSha256"])need(canonical[key]===baseline[key]);
    for(const key of ["databases","roles","memberships"])if(Object.hasOwn(baseline,key))need(JSON.stringify(canonical[key])===JSON.stringify(baseline[key]));
    const own=sessions.own,constructor=sessions.constructor as unknown as ManualOrphanPairV1;
    need(own.pid!==constructor.pid&&Array.isArray(sessions.rows)&&sessions.rows.length>=2&&sessions.rows.length<=128);
    const seen=new Set<number>();let owns=0,constructors=0;
    for(const r of sessions.rows){
      need(Number.isSafeInteger(r.pid)&&r.pid>0&&!seen.has(r.pid));seen.add(r.pid);
      if(r.pid===own.pid||r.pid===constructor.pid){const p=r.pid===own.pid?own:constructor;
        need(r.backendStartedAtUTC===p.backendStartedAtUTC&&r.datid===p.datid&&r.usesysid===p.usesysid&&r.database===sessions.database
          &&r.user===sessions.user&&r.backendType==="client backend"&&r.clientAddress==="127.0.0.1");
        need(p.datid===own.datid&&p.usesysid===own.usesysid);if(p===own)owns++;else constructors++;
      }else need(r.clientAddress===null&&["autovacuum launcher","autovacuum worker","background writer","checkpointer","walwriter","logical replication launcher"].includes(r.backendType));
      if(generated!==null)need(r.database!==generated.databaseName&&r.datid!==generated.databaseOid);
    }
    need(owns===1&&constructors===1);return canonical;
  }catch{throw Error("MANUAL_ORPHAN_OWNER_REFUSED");}
}
function retainManualOrphanRunnerAdminV1(pool:ManualOrphanDataV1,reserved:ManualOrphanDataV1,expected:ManualOrphanDataV1):ManualOrphanDataV1 {
  const pair=Object.freeze({...expected.pair}) as ManualOrphanPairV1;
  let unknown=false,stopped=false,closed=false,releaseAttempted=false,endAttempted=false;
  let pending:Promise<unknown>|null=null,closing:Promise<void>|null=null,capturedInstallation:ManualOrphanDataV1|null=null,dropStage="activated";
  const clocks:{start:bigint;last:bigint;done:boolean}[]=[];
  let cleanupAttempted=false,cleanupEnded=false,cleanupClock:{start:bigint;last:bigint}|null=null;
  let cleanupTimer:ReturnType<typeof setTimeout>|null=null;
  const mark=():void=>{unknown=true;closed=false;};
  const failure=():Error=>Error("MANUAL_ORPHAN_CLEANUP_UNKNOWN");
  const sample=():void=>{
    if(manualOrphanFixtureOutputFaultV1)mark();
    for(const item of clocks)if(!item.done)try{const now=process.hrtime.bigint();if(now<item.last||now-item.start>=5000000000n)mark();item.last=now;}catch{mark();}
    if(cleanupAttempted&&!cleanupEnded){
      const clock=cleanupClock;
      if(clock===null)mark();
      else try{const now=process.hrtime.bigint();
        if(typeof now!=="bigint"||now<0n||now<clock.last)mark();
        else {clock.last=now;if(now-clock.start>=30000000000n)mark();}
      }catch{mark();}
    }
  };
  const beginCleanup=():void=>{
    if(cleanupAttempted){mark();throw failure();}cleanupAttempted=true;
    if(unknown||stopped||closed||pending!==null){mark();throw failure();}
    try{const now=process.hrtime.bigint();if(typeof now!=="bigint"||now<0n)throw failure();
      cleanupClock={start:now,last:now};cleanupTimer=setTimeout(()=>{if(!cleanupEnded)mark();},30000);
    }catch{mark();}
    sample();if(unknown)throw failure();
  };
  const endCleanup=():void=>{
    if(!cleanupAttempted||cleanupEnded){mark();throw failure();}
    try{
      sample();const timer=cleanupTimer;cleanupTimer=null;
      if(timer!==null)try{clearTimeout(timer);}catch{mark();}
      sample();
    }finally{cleanupEnded=true;}
    if(unknown)throw failure();
  };
  const collect=async(start:()=>unknown):Promise<unknown>=>{
    let origin=0n;try{origin=process.hrtime.bigint();if(origin<0n)mark();}catch{mark();}
    const item={start:origin,last:origin,done:false};clocks.push(item);let timer:ReturnType<typeof setTimeout>|null=null;
    let value:unknown;
    try{const original=Promise.resolve(start());try{timer=setTimeout(mark,5000);}catch{mark();}value=await original;}
    catch{mark();}finally{sample();item.done=true;if(timer!==null)try{clearTimeout(timer);}catch{mark();}}
    if(unknown)throw failure();return value;
  };
  const ownSql=`pg_backend_pid() AS pid,to_char(a.backend_start AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "backendStartedAtUTC",a.datid::text AS datid,a.usesysid::text AS usesysid`;
  const identitySql=`SELECT ${ownSql},current_database() AS database,d.oid::text AS "databaseOid",current_user::text AS "currentUser",session_user::text AS "sessionUser",r.oid::text AS "userOid",host(inet_server_addr()) AS "serverAddress",inet_server_port() AS "serverPort",c.system_identifier::text AS "systemIdentifier",to_char(pg_postmaster_start_time() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "postmasterStartedAtUTC",current_setting('server_version_num') AS "serverVersionNum" FROM pg_catalog.pg_stat_activity a JOIN pg_catalog.pg_database d ON d.oid=a.datid JOIN pg_catalog.pg_roles r ON r.oid=a.usesysid CROSS JOIN pg_catalog.pg_control_system() c WHERE a.pid=pg_backend_pid()`;
  const sql:Record<string,string>={
    databases:`SELECT datname AS name,oid::float8 AS oid,datdba::float8 AS "ownerOid",datallowconn AS "allowConnections",datconnlimit AS "connectionLimit" FROM pg_catalog.pg_database ORDER BY datname COLLATE "C",oid LIMIT 5`,
    roles:`SELECT rolname AS name,oid::float8 AS oid,rolsuper AS superuser,rolinherit AS inherit,rolcreaterole AS "createRole",rolcreatedb AS "createDb",rolcanlogin AS login,rolreplication AS replication,rolbypassrls AS "bypassRls",rolconnlimit AS "connectionLimit",CASE WHEN rolvaliduntil IS NULL THEN NULL WHEN rolvaliduntil='infinity'::timestamptz THEN 'infinity' WHEN rolvaliduntil='-infinity'::timestamptz THEN '-infinity' ELSE to_char(rolvaliduntil AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') END AS "validUntilUTC" FROM pg_catalog.pg_roles ORDER BY rolname COLLATE "C",oid LIMIT 131`,
    memberships:`SELECT roleid::float8 AS "roleOid",member::float8 AS "memberOid",grantor::float8 AS "grantorOid",admin_option AS "adminOption",inherit_option AS "inheritOption",set_option AS "setOption" FROM pg_catalog.pg_auth_members ORDER BY roleid,member,grantor LIMIT 257`,
    sessions:`SELECT pid,to_char(backend_start AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "backendStartedAtUTC",datid::float8 AS datid,usesysid::float8 AS usesysid,datname AS database,usename AS "user",backend_type AS "backendType",host(client_addr) AS "clientAddress" FROM pg_catalog.pg_stat_activity ORDER BY pid LIMIT 129`,
  };
  const samePair=(row:ManualOrphanDataV1):boolean=>row.pid===pair.pid&&row.backendStartedAtUTC===pair.backendStartedAtUTC&&String(row.datid)===String(pair.datid)&&String(row.usesysid)===String(pair.usesysid);
  const freeze=(value:any):any=>{if(value!==null&&typeof value==="object"){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
  const query=(kind:string,operation?:ManualOrphanDataV1):Promise<unknown>=>{
    sample();if(unknown||stopped||pending!==null||!["identity","databases","roles","memberships","sessions","drop-database","drop-runtime","drop-owner"].includes(kind)){
      mark();return Promise.reject(failure());}
    const task=Promise.resolve().then(async()=>{
      try{
        let command:string;
        if(kind.startsWith("drop-")){
          if(operation===undefined||Object.keys(operation).length!==3||operation.stage!==dropStage)throw failure();
          const i=operation.installation,o=operation.object,suffix=i.installationId.replaceAll("-","");
          if(Object.keys(i).length!==13||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(i.operationId)
            ||i.sourceSha!=="161297ffca6adf2851918a93d492e1c9a77ce59d"||!/^[a-f0-9]{64}$/.test(i.schemaCatalogHash)||i.schemaCatalogHash===i.activationCatalogHash
            ||Object.keys(i.directory).length!==5||!/^\d+$/.test(i.directory.dev)||!/^\d+$/.test(i.directory.ino)
            ||i.directory.uid!==501||i.directory.gid!==20||i.directory.mode!==0o700
            ||[i.databaseOid,i.ownerOid,i.runtimeOid].some(value=>!Number.isSafeInteger(value)||value<1))throw failure();
          let total=0;for(const name of [...manualOrphanRecordNamesV1,"activation-prepared.json","activated.json"]){const pin=i.records[name];
            if(pin===undefined||Object.keys(pin).length!==2||!Number.isSafeInteger(pin.bytes)||pin.bytes<1
              ||pin.bytes>(name==="runtime-credentials.json"?4096:32768)||!/^[a-f0-9]{64}$/.test(pin.sha256))throw failure();total+=pin.bytes;}
          if(total>262144)throw failure();
          if(!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(i.installationId)
            ||!/^[a-f0-9]{64}$/.test(i.activationCatalogHash)||Object.keys(i.records).length!==9
            ||i.databaseName!=="setfarm_install_"+suffix||i.ownerRole!=="sf_owner_"+suffix||i.runtimeRole!=="sf_runtime_"+suffix||i.ownerOid===i.runtimeOid)throw failure();
          const expectedKind=dropStage==="activated"?"database":dropStage==="database-dropped"?"runtime":dropStage==="runtime-dropped"?"owner":null;
          if(expectedKind===null||kind!=="drop-"+expectedKind||o.kind!==expectedKind||Object.keys(o).length!==3
            ||o.name!==i[expectedKind==="database"?"databaseName":expectedKind==="runtime"?"runtimeRole":"ownerRole"]
            ||o.oid!==i[expectedKind==="database"?"databaseOid":expectedKind==="runtime"?"runtimeOid":"ownerOid"]||!Number.isSafeInteger(o.oid)||o.oid<1)throw failure();
          if(capturedInstallation===null)capturedInstallation=freeze(JSON.parse(JSON.stringify(i)));
          else if(JSON.stringify(capturedInstallation)!==JSON.stringify(i))throw failure();
          command=(expectedKind==="database"?"DROP DATABASE ":"DROP ROLE ")+'"'+o.name+'"';
        }else{
          if(operation!==undefined)throw failure();command=kind==="identity"?identitySql:
            `SELECT ${ownSql},COALESCE((SELECT json_agg(v) FROM (${sql[kind]}) v),'[]'::json) AS rows FROM pg_catalog.pg_stat_activity a WHERE a.pid=pg_backend_pid()`;
        }
        sample();if(unknown||stopped)throw failure();const result=await collect(()=>{
          const mutation=kind.startsWith("drop-"),method=reserved.unsafe;if(typeof method!=="function")throw failure();
          // Method acquisition and the five-second origin precede this final shared-clock sample.
          sample();if(unknown||stopped||mutation&&(!cleanupAttempted||cleanupEnded||cleanupClock===null))throw failure();
          return Reflect.apply(method,reserved,[command]);
        }) as ManualOrphanDataV1[];
        if(kind.startsWith("drop-")){dropStage=kind==="drop-database"?"database-dropped":kind==="drop-runtime"?"runtime-dropped":"owner-dropped";return undefined;}
        if(!Array.isArray(result)||result.length!==1||!samePair(result[0]))throw failure();const r=result[0];
        if(kind==="identity"){
          if(r.database!==expected.database||r.databaseOid!==String(expected.databaseOid)||r.currentUser!==expected.user||r.sessionUser!==expected.user
            ||r.userOid!==String(expected.userOid)||r.serverAddress!=="127.0.0.1"||r.serverPort!==expected.cluster.port
            ||r.systemIdentifier!==expected.cluster.systemIdentifier||r.postmasterStartedAtUTC!==expected.cluster.postmasterStartedAtUTC
            ||r.serverVersionNum!==String(expected.cluster.serverVersionNum))throw failure();return pair;
        }
        const bounds:Record<string,number>={databases:4,roles:130,memberships:256,sessions:128};
        if(!Array.isArray(r.rows)||r.rows.length>bounds[kind])throw failure();return freeze(JSON.parse(JSON.stringify(r.rows)));
      }catch{mark();throw failure();}
    });
    pending=task;void task.then(()=>{if(pending===task)pending=null;},()=>{if(pending===task)pending=null;});return task;
  };
  const close=():Promise<void>=>{
    stopped=true;if(closing!==null)return closing;
    const active=pending;
    closing=(async()=>{
      if(active!==null)try{await active;}catch{mark();}
      if(active!==null)await Promise.resolve();sample();
      if(cleanupAttempted&&!cleanupEnded)try{endCleanup();}catch{mark();}
      if(!releaseAttempted){releaseAttempted=true;try{reserved.release();}catch{mark();}}
      if(!endAttempted){endAttempted=true;
        // No await, query, shape inspection or other operation between release and end.
        let original:unknown;try{original=pool.end({timeout:5});}catch{mark();}
        const ending=collect(()=>original);pending=ending;try{await ending;}catch{mark();}finally{if(pending===ending)pending=null;}
      }
      sample();closed=!unknown;if(unknown)throw failure();
    })();return closing;
  };
  return Object.freeze({beginCleanup,endCleanup,query,stop(){stopped=true;},close,onclose(){if(!endAttempted)mark();},current(){sample();return Object.freeze({closed,endAttempted,pair,pending:pending!==null,releaseAttempted,stopped,unknown});}});
}
function advanceManualOrphanCleanupLedgerV1(ledger:ManualOrphanDataV1,event:ManualOrphanDataV1):ManualOrphanDataV1 {
  const freeze=(value:any):any=>{if(value!==null&&typeof value==="object"){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
  const next=JSON.parse(JSON.stringify(ledger));if(next.unknown)return freeze(next);
  try {
    const c=event.closures;if(c.pending!==0||c.fault!==null||c.queries!=="settled"||[c.input,c.children].some(v=>v!=="fulfilled")||[c.source,c.admin].some(v=>v!=="fulfilled"&&v!=="retained")||event.completion!=="fulfilled"){
      next.unknown=true;return freeze(next);}
    const parts=/^(database|runtime|owner)-(ack|absent)$/.exec(event.type);if(parts===null)throw Error();
    const object=parts[1],operation=parts[2],i=event.installation,o=event.object;
    const expectedState=object==="database"?"cases-settled":object==="runtime"?"database-dropped":"runtime-dropped";
    if(next.state!==expectedState||o.kind!==object||o.name!==i[object==="database"?"databaseName":object==="runtime"?"runtimeRole":"ownerRole"]
      ||o.oid!==i[object==="database"?"databaseOid":object==="runtime"?"runtimeOid":"ownerOid"]||!i.activationCatalogHash)throw Error();
    const key=object+"Ack";
    if(operation==="ack"){
      if(next[key]!==null)throw Error();
      if(next.databaseAck!==null&&JSON.stringify(next.databaseAck.installation)!==JSON.stringify(i))throw Error();
      next[key]={object:o,installation:i};
    }else{
      if(next[key]===null||JSON.stringify(next[key].object)!==JSON.stringify(o)||JSON.stringify(next[key].installation)!==JSON.stringify(i)
        ||event.absence.nameAbsent!==true||event.absence.oidAbsent!==true)throw Error();
      const canonical=canonicalizeManualOrphanClusterBaselineV1({databases:event.baseline.databases,roles:event.baseline.roles,memberships:event.baseline.memberships}) as ManualOrphanDataV1;
      for(const digest of ["databaseBaselineSha256","roleBaselineSha256","membershipBaselineSha256"])if(canonical[digest]!==event.baseline[digest])throw Error();
      next.state=object+"-dropped";
    }
    return freeze(next);
  }catch{throw Error("MANUAL_ORPHAN_OWNER_REFUSED");}
}
function inspectManualOrphanPartialInstallationV1(entries:ManualOrphanDataV1[],stage:string):ManualOrphanDataV1 {
  try {
    if(!["provision","activate","integration","old_entry_positive","new_entry_refusal"].includes(stage)||!Array.isArray(entries)||entries.length>1)throw Error();
    if(entries.length===0)return Object.freeze({installationId:null,partial:false,cleanupEligible:false});
    const entry=entries[0];if(!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(entry.name)||entry.kind!=="directory"
      ||!Array.isArray(entry.entries)||entry.entries.length>18)throw Error();
    let failures=0,total=0;const seen=new Set<string>();
    for(const item of entry.entries){if(seen.has(item.name))throw Error();seen.add(item.name);
      if(item.name==="runtime"){
        if(item.kind!=="directory"||!Number.isSafeInteger(item.files)||item.files<0||item.files>2048||!Number.isSafeInteger(item.bytes)||item.bytes<0||item.bytes>8388608)throw Error();
        if(item.artifactSubtree!==undefined){const a=item.artifactSubtree;if(a.path!=="product-compiler/artifacts/sha256"||!Number.isSafeInteger(a.files)||a.files<0||a.files>item.files||!Number.isSafeInteger(a.bytes)||a.bytes<0||a.bytes>item.bytes)throw Error();}
      }else{
        if(item.kind!=="file"||!Number.isSafeInteger(item.bytes)||item.bytes<0||item.bytes>(item.name==="runtime-credentials.json"?4096:32768))throw Error();
        if(/^failure-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.json$/.test(item.name)){if(++failures>8)throw Error();}
        else if(![...manualOrphanRecordNamesV1,"activation-prepared.json","activated.json"].includes(item.name))throw Error();
        total+=item.bytes;if(total>262144)throw Error();
      }
    }
    return Object.freeze({installationId:entry.name,partial:true,cleanupEligible:false});
  }catch{throw Error("MANUAL_ORPHAN_OWNER_REFUSED");}
}
function finalizeManualOrphanFixtureResultV1(kind:string,facts:ManualOrphanDataV1):unknown {
  try{
    const c=facts.closures;if(facts.unknown||c.pending!==0||c.fault!==null||c.queries!=="settled"||[c.input,c.source,c.admin,c.children].some(v=>v!=="fulfilled")
      ||facts.currentSource.maintenance.sha===facts.currentSource.target.sha)throw Error();
    for(const entry of [facts.result.oldEntry,facts.result.newEntry])if(JSON.stringify(entry.maintenance)!==JSON.stringify(facts.currentSource.maintenance)
      ||JSON.stringify(entry.target)!==JSON.stringify(facts.currentSource.target))throw Error();
    if(kind==="runner")return encodeManualOrphanRunnerResultV1(facts.result);
    if(kind==="integration")return decodeManualOrphanIntegrationResultV1(encodeManualOrphanIntegrationResultV1(facts.result));throw Error();
  }catch{throw Error("MANUAL_ORPHAN_CLEANUP_UNKNOWN");}
}
function planManualOrphanFixtureChildV1(purpose:string,admittedPaths:ManualOrphanDataV1):ManualOrphanDataV1 {
  try{
    const p=admittedPaths,m=p.maintenanceRoot;if(!["provision","activate","integration","old_entry_positive","new_entry_refusal"].includes(purpose)
      ||p.node!==manualOrphanNodeV1||dirname(m)!==manualOrphanWorkspaceV1+"/releases"||!/^setfarm-[a-f0-9]{8}$/.test(basename(m))
      ||p.targetRoot!==manualOrphanWorkspaceV1+"/releases/setfarm-161297ff"||m===p.targetRoot||p.helper!==m+"/"+manualOrphanHelperV1
      ||p.integration!==m+"/"+manualOrphanFileV1||p.env.PATH!==manualOrphanPathV1||p.env.LANG!=="C"||p.env.LC_ALL!=="C"
      ||!Object.keys(p.env).every(k=>["PATH","LANG","LC_ALL","__CF_USER_TEXT_ENCODING"].includes(k)))throw Error();
    const env=Object.freeze({...p.env}),args=Object.freeze(purpose==="integration"?["--import","tsx","--test","--test-isolation=none",manualOrphanFileV1]:[p.helper]);
    return Object.freeze({executable:manualOrphanNodeV1,args,options:Object.freeze({cwd:m,argv0:manualOrphanNodeV1,shell:false,detached:false,env,
      stdio:Object.freeze(["ignore","pipe","pipe","ignore","pipe"])})});
  }catch{throw Error("MANUAL_ORPHAN_OWNER_REFUSED");}
}
function openManualOrphanDeliveryPinsV1(context:ManualOrphanDataV1,stage:string):ManualOrphanDataV1 {
  const pins:ManualOrphanPinsV1={stage,maintenanceRoot:context.paths.maintenanceRoot,source:[],records:[],mutable:[]};
  const retained:{fd:number;attempted:boolean}[]=[];let closed=false,unknown=false;
  const close=():void=>{if(closed){if(unknown)throw Error("MANUAL_ORPHAN_CLEANUP_UNKNOWN");return;}closed=true;
    for(const entry of retained.reverse())if(!entry.attempted){entry.attempted=true;try{orphanFs.closeSync(entry.fd);}catch{unknown=true;context.burn();}}
    if(unknown)throw Error("MANUAL_ORPHAN_CLEANUP_UNKNOWN");};
  const owner={pins,close,current(){return {closed,unknown};}};context.retainPins(owner);
  const need=(value:unknown):void=>{if(!value)throw Error("MANUAL_ORPHAN_OWNER_REFUSED");};
  const identity=(s:orphanFs.BigIntStats):ManualOrphanDataV1=>({dev:String(s.dev),ino:String(s.ino),uid:Number(s.uid),gid:Number(s.gid),mode:Number(s.mode),
    nlink:Number(s.nlink),size:String(s.size),mtimeNs:String(s.mtimeNs),ctimeNs:String(s.ctimeNs),birthtimeNs:String(s.birthtimeNs)});
  const acquire=(path:string,kind:"file"|"directory",policy:string,expected:ManualOrphanDataV1|null):ManualOrphanPinV1=>{
    const before=orphanFs.lstatSync(path,{bigint:true});need(!before.isSymbolicLink()&&(kind==="file"?before.isFile():before.isDirectory()));
    need(orphanFs.realpathSync(path)===path&&(before.mode&0o022n)===0n&&(before.uid===501n||policy==="shared-ancestor"&&before.uid===0n));
    const fd=orphanFs.openSync(path,orphanFs.constants.O_RDONLY|orphanFs.constants.O_NOFOLLOW|(kind==="directory"?orphanFs.constants.O_DIRECTORY:orphanFs.constants.O_NONBLOCK));
    retained.push({fd,attempted:false});const held=orphanFs.fstatSync(fd,{bigint:true});need(JSON.stringify(identity(before))===JSON.stringify(identity(held)));
    const row={path,fd,kind,policy,identity:identity(held)};
    if(kind==="file"){
      const cap=expected===null?16777216:basename(path)==="runtime-credentials.json"?4096:32768;
      need(held.nlink===1n&&held.size>=0n&&held.size<=BigInt(cap));
      const hash=createHash("sha256"),chunk=Buffer.alloc(65536);let offset=0;
      while(offset<Number(held.size)){const n=orphanFs.readSync(fd,chunk,0,Math.min(chunk.length,Number(held.size)-offset),offset);need(n>0);hash.update(chunk.subarray(0,n));offset+=n;}
      const digest=hash.digest("hex");need(orphanFs.readSync(fd,chunk,0,1,offset)===0);
      const after=orphanFs.fstatSync(fd,{bigint:true}),named=orphanFs.lstatSync(path,{bigint:true});
      need(JSON.stringify(identity(held))===JSON.stringify(identity(after))&&JSON.stringify(identity(held))===JSON.stringify(identity(named)));
      if(expected!==null)need(Number(held.size)===expected.bytes&&digest===expected.sha256);
      else {const key=manualOrphanSourceFilesV1.indexOf(path.slice(context.paths.maintenanceRoot.length+1) as typeof manualOrphanSourceFilesV1[number]);
        need(key>=0);const source=context.frame.source.files[manualOrphanSourceNamesV1[key]];
        need(digest===source.sha256&&Number(held.size)===source.bytes&&String(held.dev)===source.dev&&String(held.ino)===source.ino
          &&Number(held.uid)===source.uid&&Number(held.gid)===source.gid&&Number(held.mode&0o7777n)===source.mode&&held.nlink===BigInt(source.nlink)
          &&String(held.mtimeNs)===source.mtimeNs&&String(held.ctimeNs)===source.ctimeNs);}
    }
    return row;
  };
  try {
    context.check();const m=context.paths.maintenanceRoot;
    for(const leaf of manualOrphanSourceFilesV1)pins.source.push(acquire(m+"/"+leaf,"file","immutable-file",null));
    const ancestors=["/","/Users","/Users/setrox","/Users/setrox/ai",manualOrphanWorkspaceV1,manualOrphanWorkspaceV1+"/releases",m,m+"/scripts",m+"/scripts/__tests__",m+"/tests",m+"/tests/execution-attempts",m+"/tests/execution-attempts/helpers",m+"/src",m+"/src/installation"];
    for(let index=0;index<ancestors.length;index++)pins.source.push(acquire(ancestors[index],"directory",index<6?"shared-ancestor":"immutable-directory",null));
    const names=stage==="provision"?[]:stage==="activate"?[...manualOrphanRecordNamesV1]:[...manualOrphanRecordNamesV1,"activation-prepared.json","activated.json"];
    let recordBytes=0;for(const name of names){const expected=context.installation.records[name];recordBytes+=expected.bytes;need(recordBytes<=262144);
      pins.records.push(acquire(context.directory+"/"+name,"file","immutable-file",expected));}
    const mutable=[context.physicalRoot,context.physicalRoot+"/data",context.installationsDirectory,...(stage==="provision"?[]:[context.directory])];
    for(const path of mutable)pins.mutable.push(acquire(path,"directory","mutable-directory",null));
    checkManualOrphanDeliveryMetadataV1(pins);context.check();return owner;
  }catch(error){try{close();}catch{context.burn();throw Error("MANUAL_ORPHAN_CLEANUP_UNKNOWN");}throw error;}
}
function holdManualOrphanRunnerInstallationsV1(physicalRoot:string,
  longPins:{path:string;fd:number;initial:orphanFs.BigIntStats;mutable:boolean;attempted:boolean}[]):void {
  const need=(ok:unknown):void=>{if(!ok)throw Error("MANUAL_ORPHAN_OWNER_REFUSED");};
  need(typeof physicalRoot==="string"&&Buffer.byteLength(physicalRoot)<=136
    &&/^\/private\/tmp\/setfarm-task6a-pg\.[A-Za-z0-9]+$/.exec(physicalRoot)?.[0]===physicalRoot);
  const path=physicalRoot+"/installations";
  need(Array.isArray(longPins)&&!longPins.some(pin=>pin.path===path));
  orphanFs.mkdirSync(path,{mode:0o700,recursive:false});
  const before=orphanFs.lstatSync(path,{bigint:true});
  need(!before.isSymbolicLink()&&before.isDirectory()&&orphanFs.realpathSync(path)===path);
  const fd=orphanFs.openSync(path,orphanFs.constants.O_RDONLY|orphanFs.constants.O_DIRECTORY|orphanFs.constants.O_NOFOLLOW);
  // The outer C finally owns this original even if held/private validation fails.
  longPins.push({path,fd,initial:before,mutable:true,attempted:false});
  const held=orphanFs.fstatSync(fd,{bigint:true});
  need((["dev","ino","uid","gid","mode","birthtimeNs","nlink","size","mtimeNs","ctimeNs"] as (keyof orphanFs.BigIntStats)[])
    .every(key=>before[key]===held[key]));
  need(held.uid===501n&&held.gid===20n&&(held.mode&0o7777n)===0o700n);
  need(orphanFs.readdirSync(path,{withFileTypes:true}).length===0);
}
function projectManualOrphanInstallationsPinV1(pins:ManualOrphanPinsV1,installationsDirectory:string):Readonly<ManualOrphanDataV1> {
  try{
    const need=(ok:unknown):void=>{if(!ok)throw Error();};
    need(typeof installationsDirectory==="string"&&Array.isArray(pins.mutable));
    const rows=pins.mutable.filter(row=>row.path===installationsDirectory);need(rows.length===1);
    const row=rows[0];need(row.kind==="directory"&&row.policy==="mutable-directory"
      &&Number.isSafeInteger(row.fd)&&row.fd>=0&&!Object.is(row.fd,-0));
    const {dev,ino,uid,gid,mode}=row.identity;
    const decimal=(value:unknown):boolean=>typeof value==="string"&&value.length<=20
      &&/^(0|[1-9][0-9]*)$/.exec(value)?.[0]===value&&(value.length<20||value<="18446744073709551615");
    need(decimal(dev)&&decimal(ino)&&uid===501&&gid===20
      &&Number.isSafeInteger(mode)&&mode>=0&&mode<=0o177777&&(mode&0o7777)===0o700);
    return Object.freeze({dev,ino,uid,gid,mode:mode&0o7777});
  }catch{throw Error("MANUAL_ORPHAN_OWNER_REFUSED");}
}
async function openManualOrphanFixtureContextV1(kind:string,frame:ManualOrphanDataV1):Promise<unknown> {
  const completion=manualOrphanFixtureCompletionV1;
  let unknown=false,holder:ManualOrphanDataV1|null=null,admin:ManualOrphanDataV1|null=null;
  let pool:ManualOrphanDataV1|null=null,reservation:ManualOrphanDataV1|null=null,initialPending:Promise<unknown>|null=null;
  let fallbackRelease=false,fallbackEnd=false,handedOff=false,sourceClosed=false,sqlClosed=false;
  let installationsCreationAttempted=false;
  let paths:ManualOrphanDataV1,physicalRoot="",installationsDirectory="",directory="",installation:ManualOrphanDataV1|null=null;
  let prepared:ManualOrphanDataV1|null=null,activation:ManualOrphanDataV1|null=null,baseline:ManualOrphanDataV1|null=null;
  let records:ManualOrphanDataV1,migrations:ManualOrphanDataV1[],driver:ManualOrphanDataV1,runtime:ManualOrphanDataV1,activationApi:ManualOrphanDataV1;
  let originalGraph:ManualOrphanDataV1={},rootAlias="",failure:unknown=null,result:ManualOrphanDataV1|null=null;
  let finalLedger:ManualOrphanDataV1|null=null,finalCleanup:ManualOrphanDataV1|null=null;
  const longPins:{path:string;fd:number;initial:orphanFs.BigIntStats;mutable:boolean;attempted:boolean}[]=[];
  const aliases:{path:string;initial:orphanFs.BigIntStats;text:string;physical:string}[]=[];
  const deliveryOwners:ManualOrphanDataV1[]=[],children:ManualOrphanDataV1[]=[];
  let socketPin:{path:string;initial:orphanFs.BigIntStats}|null=null;
  const burn=():void=>{unknown=true;completion?.fail();};
  const need=(ok:unknown):void=>{if(!ok)throw Error("MANUAL_ORPHAN_OWNER_REFUSED");};
  const detach=(value:unknown):any=>JSON.parse(JSON.stringify(value));
  const sample=():void=>{
    try{if(completion===null||completion.current().kind!==kind)burn();else completion.check();}catch{burn();}
    for(const child of children)if(child.lifetime!==null&&child.lifetime.current().unknown)burn();
    if(manualOrphanFixtureOutputFaultV1||admin?.current().unknown)burn();if(unknown)throw Error("MANUAL_ORPHAN_CLEANUP_UNKNOWN");
  };
  const initialEnvironment={...process.env};
  const same=(a:orphanFs.BigIntStats,b:orphanFs.BigIntStats,mutable=false):boolean=>
    (["dev","ino","uid","gid","mode","birthtimeNs",...(mutable?[]:["nlink","size","mtimeNs","ctimeNs"])] as (keyof orphanFs.BigIntStats)[]).every(key=>a[key]===b[key]);
  const directoryData=(s:orphanFs.BigIntStats):ManualOrphanDataV1=>({dev:String(s.dev),ino:String(s.ino),uid:Number(s.uid),gid:Number(s.gid),mode:Number(s.mode&0o7777n)});
  const pinLong=(path:string,mutable:boolean,isFile=false):orphanFs.BigIntStats=>{
    const before=orphanFs.lstatSync(path,{bigint:true});need(!before.isSymbolicLink()&&(isFile?before.isFile():before.isDirectory())&&orphanFs.realpathSync(path)===path);
    need((before.mode&0o022n)===0n||(path==="/private/tmp"&&(before.mode&0o7777n)===0o1777n));
    const fd=orphanFs.openSync(path,orphanFs.constants.O_RDONLY|orphanFs.constants.O_NOFOLLOW|(isFile?orphanFs.constants.O_NONBLOCK:orphanFs.constants.O_DIRECTORY));
    longPins.push({path,fd,initial:before,mutable,attempted:false});need(same(before,orphanFs.fstatSync(fd,{bigint:true})));return before;
  };
  const privateDirectory=(path:string,expected:ManualOrphanDataV1|null):ManualOrphanDataV1=>{
    const old=longPins.find(item=>item.path===path),s=old?orphanFs.fstatSync(old.fd,{bigint:true}):pinLong(path,true);
    need(s.uid===501n&&s.gid===20n&&(s.mode&0o7777n)===0o700n);const data=directoryData(s);
    if(expected!==null)need(Object.keys(data).every(key=>data[key]===expected[key]));return data;
  };
  const check=():void=>{
    sample();need(JSON.stringify(process.env)===JSON.stringify(initialEnvironment)&&process.getuid?.()===501&&process.geteuid?.()===501
      &&process.getgid?.()===20&&process.getegid?.()===20&&process.platform==="darwin"&&process.arch==="arm64"&&process.version==="v26.4.0");
    holder?.check();
    for(const pin of longPins){need(!pin.attempted);const named=orphanFs.lstatSync(pin.path,{bigint:true}),held=orphanFs.fstatSync(pin.fd,{bigint:true});
      need(!named.isSymbolicLink()&&same(pin.initial,named,pin.mutable)&&same(pin.initial,held,pin.mutable));}
    for(const a of aliases){const now=orphanFs.lstatSync(a.path,{bigint:true});need(now.isSymbolicLink()&&same(a.initial,now)
      &&orphanFs.readlinkSync(a.path)===a.text&&orphanFs.realpathSync(a.path)===a.physical);}
    if(socketPin!==null){const now=orphanFs.lstatSync(socketPin.path,{bigint:true});need(now.isSocket()&&!now.isSymbolicLink()&&same(now,socketPin.initial));}
    for(const key of Object.keys(originalGraph)){const got=observeManualOrphanProcessV1(originalGraph[key].pin.pid);
      need(JSON.stringify(got)===JSON.stringify(originalGraph[key]));}
    prepared?.assertUnchanged();activation?.assertUnchanged();sample();
  };
  const bounded=async(begin:()=>unknown,retain?:(value:any)=>void):Promise<any>=>{
    sample();let timeout:ReturnType<typeof setTimeout>|null=null,origin=process.hrtime.bigint(),observed=origin;
    let original:Promise<unknown>|null=null;
    try {original=Promise.resolve(begin()).then(value=>{if(retain)retain(value);return value;});initialPending=original;
      try{timeout=setTimeout(burn,5000);}catch{burn();}const value=await original;const now=process.hrtime.bigint();if(now<observed||now-origin>=5000000000n)burn();observed=now;
      sample();return value;
    }catch(error){burn();throw error;}finally{if(timeout!==null)try{clearTimeout(timeout);}catch{burn();}if(initialPending===original)initialPending=null;}
  };
  const load=async(name:"records"|"migrations"|"postgres"|"runtime"|"activation"):Promise<ManualOrphanDataV1>=>{
    check();const targets={records:"dist/installation/fresh-installation-records-v1.js",migrations:"dist/db/contract-spine-migrations.js",
      postgres:"node_modules/postgres/src/index.js",runtime:"dist/installation/fresh-installation-runtime-v1.js",activation:"dist/installation/fresh-installation-activation-v1.js"};
    const namespace=await import(pathToFileURL(paths.targetRoot+"/"+targets[name]).href);check();return namespace;
  };
  const stock=async(begin:()=>Promise<unknown>):Promise<any>=>{
    check();let timeout:ReturnType<typeof setTimeout>|null=null;const origin=process.hrtime.bigint();
    try{const original=Promise.resolve(begin());initialPending=original;try{timeout=setTimeout(burn,30000);}catch{burn();}const value=await original;
      const now=process.hrtime.bigint();if(now<origin||now-origin>=30000000000n)burn();check();return value;
    }catch(error){burn();throw error;}finally{if(timeout!==null)try{clearTimeout(timeout);}catch{burn();}initialPending=null;}
  };
  const readInstallation=(i:ManualOrphanDataV1,activated:boolean):ManualOrphanDataV1=>{
    check();need(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(i.installationId));
    const selected=installationsDirectory+"/"+i.installationId;need(directory===""||directory===selected);
    const entries=orphanFs.readdirSync(installationsDirectory,{withFileTypes:true});
    need(entries.length===1&&entries[0].name===i.installationId&&entries[0].isDirectory()&&!entries[0].isSymbolicLink());directory=selected;
    const identity={realpath:directory,...privateDirectory(directory,i.directory)};
    prepared=records.readFreshInstallationPreparedStateV1(directory,true);const p=prepared!;
    need(p.origin.installationId===i.installationId&&p.origin.sourceSha===frame.source.target.sha&&p.origin.systemIdentifier===frame.cluster.systemIdentifier
      &&p.catalogHash===i.schemaCatalogHash&&p.ownerOid===i.ownerOid&&p.runtimeOid===i.runtimeOid&&p.committed===true);
    for(const key of ["installationId","operationId","databaseName","databaseOid","ownerRole","runtimeRole","sourceSha"])need(p.origin[key]===i[key]);
    need(JSON.stringify(p.origin.migrations)===JSON.stringify(migrations));
    for(const name of manualOrphanRecordNamesV1)need(JSON.stringify(p.baseRecordPins[name])===JSON.stringify(i.records[name]));
    p.assertUnchanged();activation=activated?records.readFreshInstallationActivationStateV1(directory,"required"):null;
    if(activated){const a=activation!;need(a!==null&&a.acknowledged===true&&a.prepared.catalogHash===i.activationCatalogHash
      &&JSON.stringify(a.prepared.origin)===JSON.stringify(p.origin)&&JSON.stringify(a.prepared.directoryIdentity)===JSON.stringify(identity));
      for(const name of manualOrphanRecordNamesV1)need(JSON.stringify(a.baseRecordPins[name])===JSON.stringify(i.records[name]));
      for(const name of ["schema-prepared.json","schema-committed.json"])need(JSON.stringify(a.prepared.schemaRecordPins[name])===JSON.stringify(i.records[name]));
      need(JSON.stringify(a.preparedPin)===JSON.stringify(i.records["activation-prepared.json"])&&JSON.stringify(a.activatedPin)===JSON.stringify(i.records["activated.json"]));a.assertUnchanged();}
    check();return identity;
  };
  const catalogRows=async():Promise<ManualOrphanDataV1>=>{
    need(admin!==null&&!sqlClosed);check();await admin!.query("identity");
    const databases=await admin!.query("databases");check();const roles=await admin!.query("roles");check();const memberships=await admin!.query("memberships");check();
    return {databases,roles,memberships};
  };
  const runnerCatalog=async(stage:string):Promise<ManualOrphanDataV1>=>{
    need(kind==="runner");const rows=await catalogRows(),sessions=await admin!.query("sessions");check();
    const pair=admin!.current().pair,constructor={...frame.constructorAdminBackend,datid:pair.datid,usesysid:pair.usesysid};
    const result=qualifyManualOrphanRunnerCatalogV1(stage,baseline??frame.cluster,stage==="initial"?null:installation,rows,
      {own:pair,constructor,database:"postgres",user:"postgres",rows:sessions});
    const db=result.databases.find((r:ManualOrphanDataV1)=>r.name==="postgres"),role=result.roles.find((r:ManualOrphanDataV1)=>r.name==="postgres");
    need(db!==undefined&&role!==undefined&&db.oid===pair.datid&&db.ownerOid===role.oid&&role.oid===pair.usesysid
      &&db.allowConnections===true&&db.connectionLimit===-1&&role.superuser===true&&role.inherit===true&&role.createRole===true
      &&role.createDb===true&&role.login===true&&role.replication===true&&role.bypassRls===true&&role.connectionLimit===-1&&role.validUntilUTC===null);
    if(baseline===null)baseline=result;return {rows,canonical:result,sessions};
  };
  const runtimeCatalog=async():Promise<void>=>{
    const rows=await catalogRows(),i=installation!;need(rows.databases.length===4&&rows.roles.length<=130&&rows.memberships.length<=256);
    const db=rows.databases.filter((r:ManualOrphanDataV1)=>r.name===i.databaseName||r.oid===i.databaseOid);
    need(db.length===1&&db[0].name===i.databaseName&&db[0].oid===i.databaseOid&&db[0].ownerOid===i.ownerOid&&db[0].allowConnections===true&&db[0].connectionLimit===-1);
    const generated:unknown[]=[];for(const [name,oid,login] of [[i.ownerRole,i.ownerOid,false],[i.runtimeRole,i.runtimeOid,true]]){
      const found=rows.roles.filter((r:ManualOrphanDataV1)=>r.name===name||r.oid===oid);need(found.length===1);const r=found[0];
      need(r.name===name&&r.oid===oid&&r.login===login&&r.superuser===false&&r.inherit===false&&r.createRole===false&&r.createDb===false
        &&r.replication===false&&r.bypassRls===false&&r.connectionLimit===-1&&r.validUntilUTC===null);generated.push(r);}
    need(rows.memberships.every((r:ManualOrphanDataV1)=>[r.roleOid,r.memberOid,r.grantorOid].every(v=>v!==i.ownerOid&&v!==i.runtimeOid)));
    const residual=canonicalizeManualOrphanClusterBaselineV1({databases:rows.databases.filter((r:unknown)=>r!==db[0]),roles:rows.roles.filter((r:unknown)=>!generated.includes(r)),memberships:rows.memberships}) as ManualOrphanDataV1;
    for(const key of ["databaseBaselineSha256","roleBaselineSha256","membershipBaselineSha256"])need(residual[key]===frame.cluster[key]);
    baseline=residual;await admin!.query("identity");check();
  };
  const closeSql=async():Promise<void>=>{
    if(handedOff&&admin!==null){await admin.close();need(admin.current().closed);sqlClosed=true;return;}
    if(initialPending!==null)try{await initialPending;}catch{burn();}
    if(reservation!==null&&!fallbackRelease){fallbackRelease=true;try{reservation.release();}catch{burn();}}
    if(pool!==null&&!fallbackEnd){fallbackEnd=true;let end:unknown;try{end=pool.end({timeout:5});}catch{burn();}
      let t:ReturnType<typeof setTimeout>|null=null;try{const original=Promise.resolve(end);try{t=setTimeout(burn,5000);}catch{burn();}await original;}catch{burn();}finally{if(t!==null)try{clearTimeout(t);}catch{burn();}}}
    sqlClosed=!unknown;if(unknown)throw Error("MANUAL_ORPHAN_CLEANUP_UNKNOWN");
  };
  const closures=():ManualOrphanDataV1=>{
    sample();const input=observeManualOrphanOwnedFd4V1();need(input.claimed&&input.adopted&&input.closed&&!input.unknown);
    const state=admin?.current();need(initialPending===null&&children.every(child=>child.closed));
    need(sqlClosed||state!==undefined&&!state.pending&&!state.unknown&&!state.closed);
    if(!sourceClosed){need(holder!==null);check();}
    return {input:"fulfilled",source:sourceClosed?"fulfilled":"retained",admin:sqlClosed?"fulfilled":"retained",
      children:"fulfilled",queries:"settled",pending:0,fault:null};
  };
  const phaseEvent=(type:string,phase:unknown,integration:unknown,cleanup:unknown=null):ManualOrphanDataV1=>({type,phase,integration,installation,baseline,
    source:frame.source,closures:closures(),cleanup});
  const context:ManualOrphanDataV1={frame,burn,check,retainPins(value:ManualOrphanDataV1){deliveryOwners.push(value);},
    get paths(){return paths;},get physicalRoot(){return physicalRoot;},get installationsDirectory(){return installationsDirectory;},
    get installation(){return installation;},get directory(){return directory;}};
  const runChild=async(purpose:string):Promise<ManualOrphanDataV1>=>{
    check();const plan=planManualOrphanFixtureChildV1(purpose,{...paths,env:childEnvironment});
    const pins=openManualOrphanDeliveryPinsV1(context,purpose);check();
    const own=kind==="runner"?originalGraph.runner:originalGraph.self;
    const retainedGraph={constructor:originalGraph.constructor,runner:originalGraph.runner,parent:own,server:originalGraph.server,child:null};
    let delivery:ManualOrphanDataV1={purpose,startedAtNs:"",lastAtNs:"",pins:pins.pins,retainedGraph,postspawn:[],ended:false,issued:null,unknown:false};
    const obligation:ManualOrphanDataV1={child:null,witness:null,lifetime:null,join:null,delivery,closed:false};children.push(obligation);
    let child:ReturnType<typeof spawn>|null=null;
    try{
      const installations=projectManualOrphanInstallationsPinV1(pins.pins,installationsDirectory);
      // The SINGLE origin is captured before spawn. No full-check operation is
      // legal until G returns after end and its immediate clock observation.
      const origin=process.hrtime.bigint();need(origin>=0n);delivery.startedAtNs=String(origin);delivery.lastAtNs=String(origin);
      child=spawn(plan.executable,[...plan.args],{...plan.options,stdio:[...plan.options.stdio]});obligation.child=child;
      let witness:ManualOrphanDataV1|null=null;
      try{witness=purpose==="integration"?observeManualOrphanOwnedIntegrationChildV1(child):observeManualOrphanOwnedChildV1(child,purpose);obligation.witness=witness;}catch{burn();}
      const lifetime=retainManualOrphanOriginalChildLifetimeV1(child as unknown as ManualOrphanDataV1,witness);obligation.lifetime=lifetime;
      obligation.join=lifetime.settled.then(()=>{obligation.closed=lifetime.current().closed;},()=>{
        // Physical closure is independent of the semantic witness's failure.
        // Keep its true projection before rejecting into the actual finally.
        obligation.closed=lifetime.current().closed;burn();throw Error("MANUAL_ORPHAN_CLEANUP_UNKNOWN");
      });
      retainManualOrphanCompletionChildV1(completion,lifetime);
      if(witness===null||unknown)throw Error("MANUAL_ORPHAN_CLEANUP_UNKNOWN");
      const actualWitness=witness;
      const windowCheck=():void=>{const now=process.hrtime.bigint();if(now<BigInt(delivery.lastAtNs)||now-origin>=5000000000n||manualOrphanFixtureOutputFaultV1||actualWitness.snapshot().state!=="pending")throw Error("MANUAL_ORPHAN_CLEANUP_UNKNOWN");delivery.lastAtNs=String(now);};
      windowCheck();const self=observeManualOrphanProcessV1(own.pin.pid);windowCheck();
      const server=observeManualOrphanProcessV1(originalGraph.server.pin.pid);windowCheck();
      const observedChild=observeManualOrphanProcessV1(child.pid!);windowCheck();
      need(JSON.stringify(self)===JSON.stringify(own)&&JSON.stringify(server)===JSON.stringify(originalGraph.server));
      const raw=plan.executable+" "+plan.args.join(" ");need(observedChild.rawCommand===raw&&observedChild.pin.ppid===own.pin.pid
        &&observedChild.pin.pid===child.pid&&observedChild.pin.uid===501&&observedChild.pin.executable===manualOrphanNodeV1&&observedChild.pin.executableSha256===manualOrphanNodeHashV1);
      delivery.postspawn=[self,server,observedChild];delivery.retainedGraph={...retainedGraph,child:observedChild};
      const phase={schema:"setfarm.manual-orphan-owned-phase.v1",run:frame.run,constructor:frame.constructor,runner:frame.runner,
        parent:own.pin,child:observedChild.pin,server:frame.server,source:frame.source,cluster:frame.cluster,
        installations,purpose,
        input:purpose==="provision"?{adminPassword:frame.adminPassword}:purpose==="activate"?{adminPassword:frame.adminPassword,installation}:{installation}};
      const issued=deliverManualOrphanOwnedFrameV1(child as unknown as ManualOrphanDataV1,witness,phase,delivery);
      await obligation.join;await witness.settled;check();
      const a=witness.snapshot(),output=witness.output(),b=witness.snapshot();need(a.state==="observed"&&b.state==="observed");
      const result=purpose==="integration"?correlateManualOrphanIntegrationResultV1(issued,b,output):correlateManualOrphanPhaseResultV1(issued,b,output);
      if(purpose==="integration"||purpose==="old_entry_positive"||purpose==="new_entry_refusal"){
        const entries=purpose==="integration"?[result.oldEntry,result.newEntry]:[result.result];
        for(const entry of entries)need(JSON.stringify(entry.maintenance)===JSON.stringify(frame.source.maintenance)&&JSON.stringify(entry.target)===JSON.stringify(frame.source.target));
      }
      need(witness.snapshot().state==="observed");check();return result;
    }catch(error){burn();throw error;}
    finally{
      if(child!==null&&!delivery.ended){delivery.ended=true;try{(child.stdio[4] as unknown as ManualOrphanDataV1)?.end();}catch{burn();}}
      if(obligation.join!==null)try{await obligation.join;}catch{burn();}
      if(obligation.witness!==null)try{await obligation.witness.settled;}catch{burn();}
      try{pins.close();}catch{burn();}
    }
  };
  const childEnvironment:Record<string,string>={PATH:manualOrphanPathV1,LANG:"C",LC_ALL:"C"};
  if(typeof initialEnvironment.__CF_USER_TEXT_ENCODING==="string")childEnvironment.__CF_USER_TEXT_ENCODING=initialEnvironment.__CF_USER_TEXT_ENCODING;
  try{
    sample();
    const account=userInfo();need(account.homedir==="/Users/setrox"&&account.uid===501&&account.gid===20);
    const m=fileURLToPath(root).replace(/\/$/,""),selfPin=kind==="runner"?frame.runner:frame.child,parentPin=kind==="runner"?frame.constructor:frame.runner;
    const self=observeManualOrphanProcessV1(process.pid),parent=observeManualOrphanProcessV1(process.ppid);
    const env:Record<string,string|undefined>={...initialEnvironment};let worker:ManualOrphanDataV1|null=null;
    if(kind==="integration"){worker={NODE_TEST_WORKER_ID:env.NODE_TEST_WORKER_ID};delete env.NODE_TEST_WORKER_ID;}
    paths=qualifyManualOrphanFixtureLaunchV1(kind,{node:manualOrphanNodeV1,maintenanceRoot:m,targetRoot:manualOrphanWorkspaceV1+"/releases/setfarm-161297ff",
      workspace:manualOrphanWorkspaceV1,cwd:process.cwd(),execPath:process.execPath,argv0:process.argv0,argv:[...process.argv],execArgv:[...process.execArgv],env,worker,
      self,parent,maintenance:frame.source.maintenance,target:frame.source.target},frame);
    need(self.pin.pid===selfPin.pid&&parent.pin.pid===parentPin.pid);check();
    holder=await holdManualOrphanOwnedSourcesV1();sample();need(holder!==null&&typeof holder.check==="function"&&typeof holder.close==="function");
    need(JSON.stringify(holder.source)===JSON.stringify(frame.source));check();
    originalGraph={constructor:observeManualOrphanProcessV1((frame.constructor as unknown as ManualOrphanDataV1).pid),runner:observeManualOrphanProcessV1(frame.runner.pid),server:observeManualOrphanProcessV1(frame.server.pid)};
    if(kind==="integration")originalGraph.self=self;
    for(const key of ["constructor","runner","server"]){need(JSON.stringify(originalGraph[key].pin)===JSON.stringify(frame[key])&&originalGraph[key].pin.uid===501);
      if(key!=="server")need(originalGraph[key].pin.executable===manualOrphanNodeV1&&originalGraph[key].pin.executableSha256===manualOrphanNodeHashV1);}
    need(frame.runner.ppid===(frame.constructor as unknown as ManualOrphanDataV1).pid&&frame.server.ppid===(frame.constructor as unknown as ManualOrphanDataV1).pid&&frame.runner.pid!==frame.server.pid
      &&(originalGraph.constructor as unknown as ManualOrphanDataV1).rawCommand===manualOrphanNodeV1+" "+m+"/scripts/run-private-postgres-tests.mjs manual-orphan-bootstrap"
      &&originalGraph.runner.rawCommand===manualOrphanNodeV1+" --import tsx scripts/run-isolated-postgres-tests.ts -- "+MANUAL_ORPHAN_VECTOR_V1.join(" "));
    const match=/^\/opt\/homebrew\/opt\/postgresql@17\/bin\/postgres -D (\/tmp\/setfarm-task6a-pg\.[A-Za-z0-9]+)\/data -h 127\.0\.0\.1 -p ([0-9]+) -k \1 -c unix_socket_permissions=0700 -c shared_buffers=32MB -c max_connections=50$/.exec(originalGraph.server.rawCommand);
    need(match!==null);if(match===null)throw Error("MANUAL_ORPHAN_OWNER_REFUSED");rootAlias=match[1];physicalRoot="/private"+rootAlias;installationsDirectory=physicalRoot+"/installations";
    need(Number(match[2])===frame.cluster.port&&frame.cluster.port!==5432&&String(frame.cluster.port)===match[2]);
    const alias=(path:string,physical:string,text:string,uid:bigint):void=>{const initial=orphanFs.lstatSync(path,{bigint:true});
      need(initial.isSymbolicLink()&&initial.uid===uid&&initial.nlink===1n&&orphanFs.readlinkSync(path)===text&&orphanFs.realpathSync(path)===physical);aliases.push({path,physical,text,initial});};
    const tmpText=orphanFs.readlinkSync("/tmp");need(tmpText==="private/tmp"||tmpText==="/private/tmp");alias("/tmp","/private/tmp",tmpText,0n);
    const pgText=orphanFs.readlinkSync("/opt/homebrew/opt/postgresql@17");need(/^\.\.\/Cellar\/postgresql@17\/17\.[0-9]+(?:_[0-9]+)?$/.test(pgText));
    const pg=resolve("/opt/homebrew/opt",pgText);alias("/opt/homebrew/opt/postgresql@17",pg,pgText,501n);
    for(const path of ["/","/private","/private/tmp","/opt","/opt/homebrew","/opt/homebrew/Cellar","/opt/homebrew/Cellar/postgresql@17",pg,pg+"/bin"])pinLong(path,path==="/private/tmp");
    const executable=pg+"/bin/postgres",binary=pinLong(executable,false,true);need(binary.nlink===1n&&(binary.mode&0o111n)!==0n&&binary.size>0n&&binary.size<=536870912n);
    const binaryPin=longPins.at(-1)!,hash=createHash("sha256"),chunk=Buffer.alloc(65536);let offset=0;
    while(offset<Number(binary.size)){const n=orphanFs.readSync(binaryPin.fd,chunk,0,Math.min(chunk.length,Number(binary.size)-offset),offset);need(n>0);hash.update(chunk.subarray(0,n));offset+=n;}
    need(hash.digest("hex")===originalGraph.server.pin.executableSha256&&originalGraph.server.pin.executable===executable);
    privateDirectory(physicalRoot,frame.cluster.root);privateDirectory(physicalRoot+"/data",frame.cluster.data);
    if(kind==="integration")privateDirectory(installationsDirectory,frame.installations);
    const socket=physicalRoot+"/.s.PGSQL."+frame.cluster.port,socketStat=orphanFs.lstatSync(socket,{bigint:true});
    need(socketStat.isSocket()&&!socketStat.isSymbolicLink()&&socketStat.uid===501n&&socketStat.gid===20n&&(socketStat.mode&0o7777n)===0o700n);socketPin={path:socket,initial:socketStat};
    const capacity=orphanFs.statfsSync(physicalRoot,{bigint:true});need(capacity.bavail*capacity.bsize>=8n*1024n**3n+64n*1024n**2n);check();
    records=await load("records");migrations=detach((await load("migrations")).getContractSpineCurrentHeadJournalIdentitiesV1());need(migrations.length===33);
    driver=await load("postgres");runtime=await load("runtime");activationApi=await load("activation");
    if(kind==="integration"){installation=frame.input.installation;readInstallation(installation!,true);}
    let endpoint:string;
    if(kind==="runner"){need(/^[a-f0-9]{64}$/.test(frame.adminPassword));endpoint="postgresql://postgres:"+frame.adminPassword+"@127.0.0.1:"+frame.cluster.port+"/postgres";}
    else {endpoint=prepared!.runtimeUrl;const u=new URL(endpoint),i=installation!;
      need(u.protocol==="postgresql:"&&u.hostname==="127.0.0.1"&&u.port===String(frame.cluster.port)&&u.username===i.runtimeRole
        &&u.pathname==="/"+i.databaseName&&/^[a-f0-9]{64}$/.test(u.password)&&!u.search&&!u.hash&&u.href===endpoint);}
    check();need(typeof driver.default==="function");
    pool=driver.default(endpoint,{max:1,connect_timeout:5,idle_timeout:0,max_lifetime:0,connection:{statement_timeout:5000,lock_timeout:5000},
      onclose(){if(handedOff)admin!.onclose();else if(!fallbackEnd)burn();},onnotice(){}});sample();
    await bounded(()=>pool!.reserve(),value=>{reservation=value;});
    const retainedReservation=reservation as ManualOrphanDataV1|null;
    need(retainedReservation!==null&&typeof retainedReservation.unsafe==="function"&&typeof retainedReservation.release==="function");
    const initialSql=`SELECT pg_backend_pid() AS pid,to_char(a.backend_start AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "backendStartedAtUTC",a.datid::text AS datid,a.usesysid::text AS usesysid,current_database() AS database,d.oid::text AS "databaseOid",d.datdba::text AS "ownerOid",current_user::text AS "currentUser",session_user::text AS "sessionUser",r.oid::text AS "userOid",host(inet_server_addr()) AS "serverAddress",inet_server_port() AS "serverPort",c.system_identifier::text AS "systemIdentifier",to_char(pg_postmaster_start_time() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "postmasterStartedAtUTC",current_setting('server_version_num') AS "serverVersionNum"${kind==="runner"?',current_setting(\'data_directory\') AS "dataDirectory",current_setting(\'unix_socket_directories\') AS "socketDirectories"':""} FROM pg_catalog.pg_stat_activity a JOIN pg_catalog.pg_database d ON d.oid=a.datid JOIN pg_catalog.pg_roles r ON r.oid=a.usesysid CROSS JOIN pg_catalog.pg_control_system() c WHERE a.pid=pg_backend_pid()`;
    const rows=await bounded(()=>reservation!.unsafe(initialSql));need(Array.isArray(rows)&&rows.length===1);const r=rows[0];
    const database=kind==="runner"?"postgres":installation!.databaseName,user=kind==="runner"?"postgres":installation!.runtimeRole;
    need(Number.isSafeInteger(r.pid)&&r.pid>0&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(r.backendStartedAtUTC)
      &&/^[1-9][0-9]*$/.test(r.datid)&&/^[1-9][0-9]*$/.test(r.usesysid)&&Number.isSafeInteger(Number(r.datid))&&Number.isSafeInteger(Number(r.usesysid))&&r.databaseOid===r.datid&&r.userOid===r.usesysid
      &&r.database===database&&r.currentUser===user&&r.sessionUser===user&&r.serverAddress==="127.0.0.1"&&r.serverPort===frame.cluster.port
      &&r.systemIdentifier===frame.cluster.systemIdentifier&&r.postmasterStartedAtUTC===frame.cluster.postmasterStartedAtUTC&&r.serverVersionNum===String(frame.cluster.serverVersionNum)
      &&frame.cluster.serverVersionNum>=170000&&frame.cluster.serverVersionNum<180000);
    if(kind==="runner")need(r.dataDirectory===rootAlias+"/data"&&r.socketDirectories===rootAlias&&r.ownerOid===r.usesysid&&r.pid!==frame.constructorAdminBackend.pid);
    else need(r.datid===String(installation!.databaseOid)&&r.usesysid===String(installation!.runtimeOid)&&r.ownerOid===String(installation!.ownerOid));
    const pair=Object.freeze({pid:r.pid,backendStartedAtUTC:r.backendStartedAtUTC,datid:Number(r.datid),usesysid:Number(r.usesysid)});
    admin=retainManualOrphanRunnerAdminV1(pool!,reservation!,{pair,cluster:frame.cluster,database,databaseOid:pair.datid,user,userOid:pair.usesysid});handedOff=true;check();
    if(kind==="runner"){
      await runnerCatalog("initial");check();installationsCreationAttempted=true;
      holdManualOrphanRunnerInstallationsV1(physicalRoot,longPins);check();
      let ledger:ManualOrphanDataV1={state:"empty",installation:null,oldEntry:null,newEntry:null,unknown:false};
      const provision=await runChild("provision");installation=provision.result.installation;const committedDirectory=readInstallation(installation!,false);
      const verified=await stock(()=>runtime.verifyFreshInstallationSchemaV1(directory));need(verified.state==="committed"&&JSON.stringify(verified.origin)===JSON.stringify(prepared!.origin)&&verified.catalogHash===installation!.schemaCatalogHash);
      const absent=records.captureFreshInstallationActivationAbsenceV1(directory);absent();
      const createdCatalog=await runnerCatalog("created");
      const projection=(active:boolean,returned:unknown,stale:boolean):ManualOrphanDataV1=>({prepared:detach(Object.fromEntries(["origin","catalogHash","ownerOid","runtimeOid","runtimeUrl","committed","baseRecordBytes","baseRecordPins"].map(k=>[k,prepared![k]]))),
        directory:committedDirectory,activation:active?detach({prepared:activation!.prepared,preparedPin:activation!.preparedPin,activatedPin:activation!.activatedPin,acknowledged:activation!.acknowledged,baseRecordPins:activation!.baseRecordPins}):null,
        observedSchemaCatalogHash:prepared!.catalogHash,observedActivationCatalogHash:active?activation!.prepared.catalogHash:null,
        activationAbsenceObserved:!active,staleAbsenceRefused:stale,selectedDirectory:directory,activationReturn:returned});
      const expected=(old:unknown):ManualOrphanDataV1=>({cluster:frame.cluster,sourceSha:frame.source.target.sha,migrations,installationsDirectory,installation:old});
      installation=joinManualOrphanInstallationFactsV1("committed",provision,projection(false,null,false),{expected:expected(null),rows:createdCatalog.rows,schemaCatalogHash:prepared!.catalogHash,activationCatalogHash:null});
      ledger=advanceManualOrphanRouteLedgerV1(ledger,phaseEvent("schema-verified",provision,null));
      const created=installation;await runnerCatalog("created");absent();const activated=await runChild("activate");installation=activated.result.installation;readInstallation(installation!,true);
      let stale=false;try{absent();}catch(error){stale=error instanceof Error&&error.message==="FRESH_INSTALLATION_RECORDS_REFUSED";}need(stale);
      const activationVerified=await stock(()=>activationApi.verifyFreshInstallationActivationV1(directory)),activatedCatalog=await runnerCatalog("activated");
      installation=joinManualOrphanInstallationFactsV1("activated",activated,projection(true,activationVerified,true),{expected:expected(created),rows:activatedCatalog.rows,schemaCatalogHash:prepared!.catalogHash,activationCatalogHash:activation!.prepared.catalogHash});
      ledger=advanceManualOrphanRouteLedgerV1(ledger,phaseEvent("activation-verified",activated,null));
      await stock(()=>activationApi.verifyFreshInstallationActivationV1(directory));await runnerCatalog("activated");const integration=await runChild("integration");
      // The last verifier's own finally has completed before the no-generated-session census. No further verifier is opened during cleanup.
      check();await runnerCatalog("activated");ledger=advanceManualOrphanRouteLedgerV1(ledger,phaseEvent("cases-settled",null,integration));
      let cleanup:ManualOrphanDataV1={state:"cases-settled",databaseAck:null,runtimeAck:null,ownerAck:null,unknown:false};
      try{
        admin!.beginCleanup();
        for(const [object,before,after] of [["database","activated","database-dropped"],["runtime","database-dropped","runtime-dropped"],["owner","runtime-dropped","owner-dropped"]] as const){
          check();need(ledger.state===(object==="database"?"cases-settled":before));await runnerCatalog(before);check();
          const i=installation!,identity={kind:object,name:i[object==="database"?"databaseName":object==="runtime"?"runtimeRole":"ownerRole"],oid:i[object==="database"?"databaseOid":object==="runtime"?"runtimeOid":"ownerOid"]};
          await admin!.query("drop-"+object,{installation:i,object:identity,stage:before});check();
          const event={type:object+"-ack",installation:i,object:identity,completion:"fulfilled",absence:{nameAbsent:true,oidAbsent:true},baseline,closures:closures()};
          cleanup=advanceManualOrphanCleanupLedgerV1(cleanup,event);const absentCatalog=await runnerCatalog(after);check();
          cleanup=advanceManualOrphanCleanupLedgerV1(cleanup,{...event,type:object+"-absent",baseline:absentCatalog.canonical});
          ledger=advanceManualOrphanRouteLedgerV1(ledger,phaseEvent(after,null,null,cleanup));
        }
        await runnerCatalog("owner-dropped");await new Promise<void>(yes=>setTimeout(yes,100));check();await runnerCatalog("owner-dropped");check();
      }finally{admin!.endCleanup();}
      await closeSql();check();const clean={databaseAbsent:true,ownerRoleAbsent:true,runtimeRoleAbsent:true,baselineRestored:true,adminClose:"fulfilled"};
      finalLedger=ledger;finalCleanup=clean;
      result={schema:"setfarm.manual-orphan-runner-result.v1",run:frame.run,frameSha256:createHash("sha256").update(encodeManualOrphanRunnerSetupFrameV1(frame)).digest("hex"),
        pid:frame.runner.pid,parentPid:(frame.constructor as unknown as ManualOrphanDataV1).pid,installationId:installation!.installationId,oldEntry:integration.oldEntry,newEntry:integration.newEntry,cleanup:clean,sourcePinsClosed:true};
    }else{
      await runtimeCatalog();await closeSql();check();
      const verified=await stock(()=>activationApi.verifyFreshInstallationActivationV1(directory));need(verified.schema==="setfarm.fresh-installation-activation-verification.v1"&&verified.state==="activated"
        &&verified.installationId===installation!.installationId&&verified.sourceSha===installation!.sourceSha&&verified.catalogHash===installation!.activationCatalogHash);check();
      const old=await runChild("old_entry_positive");check();const fresh=await runChild("new_entry_refusal");check();
      result={schema:"setfarm.manual-orphan-integration-result.v1",run:frame.run,frameSha256:createHash("sha256").update(encodeManualOrphanOwnedPhaseFrameV1(frame)).digest("hex"),pid:frame.child.pid,parentPid:frame.runner.pid,
        oldEntry:old.result,newEntry:fresh.result,sourcePinsClosed:true};
    }
    check();
  }catch(error){failure=error;if(admin!==null&&!sqlClosed)burn();
    // Bounded metadata-only diagnostics cannot create ownership or cleanup rights.
    if(installationsDirectory!=="")try{
      let absentBeforeCreation=false;
      if(kind==="runner"&&!installationsCreationAttempted){
        try{orphanFs.lstatSync(installationsDirectory,{bigint:true});}
        catch(error){const code=error instanceof Error?Object.getOwnPropertyDescriptor(error,"code"):undefined;
          if(code!==undefined&&Object.hasOwn(code,"value")&&code.value==="ENOENT")absentBeforeCreation=true;else throw error;}
        need(absentBeforeCreation);
      }
      if(!absentBeforeCreation){
      const names=orphanFs.readdirSync(installationsDirectory,{withFileTypes:true});need(names.length<=1);
      const diagnostic:ManualOrphanDataV1[]=[];for(const entry of names){need(entry.isDirectory()&&!entry.isSymbolicLink());const path=installationsDirectory+"/"+entry.name;
        const children=orphanFs.readdirSync(path,{withFileTypes:true});need(children.length<=18);const list:ManualOrphanDataV1[]=[];
        for(const child of children){const stat=orphanFs.lstatSync(path+"/"+child.name,{bigint:true});need(!stat.isSymbolicLink());
          if(child.name==="runtime"&&stat.isDirectory()){
            let files=0,bytes=0,directories=1;const queue=[path+"/runtime"];
            while(queue.length){const current=queue.pop()!,items=orphanFs.readdirSync(current,{withFileTypes:true});need(items.length<=2048);for(const item of items){const next=current+"/"+item.name,s=orphanFs.lstatSync(next,{bigint:true});
              need(!s.isSymbolicLink());if(s.isDirectory()){need(++directories<=2048);queue.push(next);}else{need(s.isFile());files++;bytes+=Number(s.size);need(files<=2048&&bytes<=8388608);}}}
            list.push({name:"runtime",kind:"directory",files,bytes});
          }else{need(stat.isFile());list.push({name:child.name,kind:"file",bytes:Number(stat.size)});}}
        diagnostic.push({name:entry.name,kind:"directory",entries:list});}
      inspectManualOrphanPartialInstallationV1(diagnostic,kind==="runner"?"provision":"integration");
      }
    }catch{burn();}
  }finally{
    if(initialPending!==null)try{await initialPending;}catch{burn();}
    for(const child of children){if(child.child!==null&&!child.delivery.ended){child.delivery.ended=true;try{child.child.stdio[4]?.end();}catch{burn();}}
      if(child.join!==null)try{await child.join;}catch{burn();}}
    try{await closeSql();}catch{burn();}
    if(holder!==null)try{check();}catch{burn();}
    for(const owner of deliveryOwners)try{owner.close();}catch{burn();}
    for(const pin of longPins.reverse())if(!pin.attempted){pin.attempted=true;try{orphanFs.closeSync(pin.fd);}catch{burn();}}
    if(holder!==null)try{holder.close();sourceClosed=true;}catch{burn();}
    try{sample();}catch{burn();}
  }
  if(unknown||manualOrphanFixtureOutputFaultV1)throw Error("MANUAL_ORPHAN_CLEANUP_UNKNOWN");
  if(failure!==null){const message=failure instanceof Error?failure.message:"";throw Error(["MANUAL_ORPHAN_OWNER_REFUSED","MANUAL_ORPHAN_FRAME_REFUSED","MANUAL_ORPHAN_CASE_REFUSED"].includes(message)?message:"MANUAL_ORPHAN_CLEANUP_UNKNOWN");}
  need(result!==null&&sourceClosed&&sqlClosed&&children.every(child=>child.closed));
  if(kind==="runner"){need(finalLedger!==null&&finalCleanup!==null);
    finalLedger=advanceManualOrphanRouteLedgerV1(finalLedger!,phaseEvent("clean",null,null,finalCleanup));need(finalLedger.state==="clean");}
  return finalizeManualOrphanFixtureResultV1(kind,{result,closures:closures(),currentSource:frame.source,unknown});
}

// Physical custody is distinct from transport success. No observer timeout or
// error manufactures a close event for an acquired original.
function retainManualOrphanOriginalChildLifetimeV1(actualChild:ManualOrphanDataV1,actualWitness:ManualOrphanDataV1|null){
  type ChannelState="unacquired"|"open"|"closed"|"unobserved";
  type Channel={original:ManualOrphanDataV1|null|undefined;state:ChannelState};
  const channels:Record<"stdout"|"stderr"|"fd4",Channel>={stdout:{original:null,state:"unobserved"},
    stderr:{original:null,state:"unobserved"},fd4:{original:null,state:"unobserved"}};
  const child={original:actualChild,closed:false};
  let unknown=false,bindingsComplete=false,physicalResolved=false;
  let resolvePhysical!:()=>void;
  const physical=new Promise<void>(yes=>{resolvePhysical=yes;});
  const burn=():void=>{unknown=true;};
  const closed=():boolean=>child.closed&&Object.values(channels).every(value=>value.state==="closed"||value.state==="unacquired");
  const checkPhysical=():void=>{if(bindingsComplete&&!physicalResolved&&closed()){physicalResolved=true;resolvePhysical();}};
  const sample=():void=>{
    if(actualWitness===null){burn();return;}
    try{if(actualWitness.snapshot().state==="unknown")burn();}catch{burn();}
  };
  try{child.original.on("close",()=>{if(child.closed)burn();child.closed=true;checkPhysical();});}catch{burn();}
  try{child.original.on("error",burn);}catch{burn();}
  for(const name of ["stdout","stderr","fd4"] as const){
    let stream:ManualOrphanDataV1|null|undefined;
    try{stream=name==="fd4"?actualChild.stdio[4]:actualChild[name];}catch{burn();continue;}
    channels[name].original=stream;
    if(stream===null||stream===undefined){channels[name].state="unacquired";burn();continue;}
    channels[name].state="open";
    try{stream.on("close",()=>{if(channels[name].state==="closed")burn();channels[name].state="closed";checkPhysical();});}
    catch{channels[name].state="unobserved";burn();}
    try{stream.on("error",burn);}catch{burn();}
  }
  // Retain and handle the original witness promise immediately, without using
  // its early unknown result as physical completion evidence.
  let witnessJoin:Promise<unknown>|null=null;
  if(actualWitness!==null)try{witnessJoin=Promise.resolve(actualWitness.settled).then(value=>value,()=>{burn();});}
  catch{burn();witnessJoin=new Promise<never>(()=>{});}
  else burn();
  bindingsComplete=true;checkPhysical();
  const current=()=>{sample();const complete=closed();return Object.freeze({closed:complete,pending:!complete,unknown,childClosed:child.closed,
    stdout:channels.stdout.state,stderr:channels.stderr.state,fd4:channels.fd4.state});};
  const settled=(async():Promise<void>=>{
    await physical;if(witnessJoin!==null)await witnessJoin;sample();
    try{if(actualWitness===null||actualWitness.snapshot().state!=="observed")burn();}catch{burn();}
    if(unknown)throw Error("MANUAL_ORPHAN_CLEANUP_UNKNOWN");
  })();
  return Object.freeze({settled,current});
}

function retainManualOrphanCompletionChildV1(completion:object|null,lifetime:ReturnType<typeof retainManualOrphanOriginalChildLifetimeV1>):void{
  const retained=completion===null?undefined:manualOrphanCompletionChildrenV1.get(completion);
  if(retained===undefined)throw Error("MANUAL_ORPHAN_CLEANUP_UNKNOWN");
  retained.add(lifetime);
}

// One entry-owned interval includes input, C, final codec and original output.
// Pending callbacks retain custody even after timeout; only their own callback
// can settle an invoked write. No public options or clock/provider injection.
function retainManualOrphanFixtureCompletionV1(kind:string){
  const retainedChildren=new Set<ReturnType<typeof retainManualOrphanOriginalChildLifetimeV1>>();
  const limitNs=BigInt(kind==="runner"?840000:300000)*1000000n;
  let startedAtNs=0n,lastAtNs=0n,unknown=kind!=="runner"&&kind!=="integration",finished=false;
  let writeStarted=false,writePending=false,writeSettled=false,timerCleared=false;
  let timer:ReturnType<typeof setTimeout>|null=null;
  let stdout:typeof process.stdout|null=null,stderr:typeof process.stderr|null=null;
  let originalWrite:Promise<void>|null=null;
  const fail=():void=>{unknown=true;};
  const outputFault=():void=>{manualOrphanFixtureOutputFaultV1=true;fail();};
  const sample=():void=>{
    try{if(observeManualOrphanOwnedFd4V1().unknown)fail();}catch{fail();}
    for(const child of retainedChildren)try{if(child.current().unknown)fail();}catch{fail();}
    try{const now=process.hrtime.bigint();if(typeof now!=="bigint"||now<0n||now<lastAtNs)fail();
      else {lastAtNs=now;if(now-startedAtNs>=limitNs)fail();}}catch{fail();}
    if(manualOrphanFixtureOutputFaultV1)fail();
  };
  try{const now=process.hrtime.bigint();if(typeof now!=="bigint"||now<0n)fail();else startedAtNs=lastAtNs=now;}catch{fail();}
  try{timer=setTimeout(fail,kind==="runner"?840000:300000);}catch{fail();}
  try{stdout=process.stdout;stdout.on("error",outputFault);}catch{outputFault();}
  try{stderr=process.stderr;stderr.on("error",outputFault);}catch{outputFault();}
  const check=():void=>{sample();if(unknown)throw Error("MANUAL_ORPHAN_CLEANUP_UNKNOWN");};
  const current=()=>{sample();return Object.freeze({kind,startedAtNs:String(startedAtNs),lastAtNs:String(lastAtNs),limitNs:String(limitNs),
    unknown,finished,writeStarted,writePending,writeSettled});};
  const write=async(bytes:Buffer):Promise<void>=>{
    sample();
    if(kind!=="runner"||finished||writeStarted||unknown||!Buffer.isBuffer(bytes)||bytes.length<1||bytes.length>16384||bytes[bytes.length-1]!==10||stdout===null){
      fail();throw Error("MANUAL_ORPHAN_CLEANUP_UNKNOWN");
    }
    // Capture the actual method before invoking it. A getter failure acquired
    // no callback operation. An invocation that throws remains uncertain and
    // pending until its retained callback actually arrives.
    let method:typeof process.stdout.write;
    try{method=stdout.write.bind(stdout);}catch{outputFault();throw Error("MANUAL_ORPHAN_CLEANUP_UNKNOWN");}
    writeStarted=true;writePending=true;
    originalWrite=new Promise<void>((yes,no)=>{
      const done=(error?:Error|null):void=>{
        if(!writePending){outputFault();return;}
        writePending=false;writeSettled=true;if(error)outputFault();sample();
        if(unknown)no(Error("MANUAL_ORPHAN_CLEANUP_UNKNOWN"));else yes();
      };
      try{method(bytes,done);}catch{outputFault();}
    });
    await originalWrite;check();
  };
  const finish=(success:boolean):void=>{
    sample();
    if(writePending){fail();throw Error("MANUAL_ORPHAN_CLEANUP_UNKNOWN");}
    if(finished||typeof success!=="boolean"||success&&(kind==="runner"?!writeStarted||!writeSettled:writeStarted))fail();
    if(timer!==null&&!timerCleared){timerCleared=true;try{clearTimeout(timer);}catch{fail();}}
    // Release is fallible and consumes time too. This final sample is after it,
    // with no asynchronous gap between this outcome and the public return.
    sample();finished=true;if(unknown)throw Error("MANUAL_ORPHAN_CLEANUP_UNKNOWN");
  };
  const completion=Object.freeze({check,fail,write,finish,current});
  manualOrphanCompletionChildrenV1.set(completion,retainedChildren);
  return completion;
}

export async function runManualOrphanBootstrapRouteV1():Promise<void> {
  claimManualOrphanFixtureEntryV1("runner",arguments.length);
  let input:ReturnType<typeof readManualOrphanOwnedFd4V1>|null=null;
  let completion:ReturnType<typeof retainManualOrphanFixtureCompletionV1>|null=null;
  try{
    input=readManualOrphanOwnedFd4V1("runner");
    completion=retainManualOrphanFixtureCompletionV1("runner");manualOrphanFixtureCompletionV1=completion;
    const frame=await input;completion.check();const bytes=await openManualOrphanFixtureContextV1("runner",frame) as Buffer;
    await completion.write(bytes);completion.finish(true);return;
  }catch(error){if(input!==null)try{await input;}catch{/* Join the one retained inherited reader. */}
    let completionFault=manualOrphanFixtureOutputFaultV1;
    if(completion!==null)try{completion.finish(false);}catch{completionFault=true;}
    const message=error instanceof Error?error.message:"";throw Error(completionFault?"MANUAL_ORPHAN_CLEANUP_UNKNOWN":
      ["MANUAL_ORPHAN_OWNER_REFUSED","MANUAL_ORPHAN_FRAME_REFUSED","MANUAL_ORPHAN_CASE_REFUSED","MANUAL_ORPHAN_CLEANUP_UNKNOWN"].includes(message)?message:"MANUAL_ORPHAN_CLEANUP_UNKNOWN");}
}
export async function runManualOrphanBootstrapIntegrationV1():Promise<Readonly<ManualOrphanDataV1>> {
  claimManualOrphanFixtureEntryV1("integration",arguments.length);
  let input:ReturnType<typeof readManualOrphanOwnedFd4V1>|null=null;
  let completion:ReturnType<typeof retainManualOrphanFixtureCompletionV1>|null=null;
  try{
    input=readManualOrphanOwnedFd4V1("integration");
    completion=retainManualOrphanFixtureCompletionV1("integration");manualOrphanFixtureCompletionV1=completion;
    const frame=await input;completion.check();const result=await openManualOrphanFixtureContextV1("integration",frame) as Readonly<ManualOrphanDataV1>;
    completion.finish(true);return result;
  }catch(error){if(input!==null)try{await input;}catch{/* Join the one actual reader; never reopen FD4. */}
    let completionFault=manualOrphanFixtureOutputFaultV1;
    if(completion!==null)try{completion.finish(false);}catch{completionFault=true;}
    const message=error instanceof Error?error.message:"";throw Error(completionFault?"MANUAL_ORPHAN_CLEANUP_UNKNOWN":
      ["MANUAL_ORPHAN_OWNER_REFUSED","MANUAL_ORPHAN_FRAME_REFUSED","MANUAL_ORPHAN_CASE_REFUSED","MANUAL_ORPHAN_CLEANUP_UNKNOWN"].includes(message)?message:"MANUAL_ORPHAN_CLEANUP_UNKNOWN");}
}
