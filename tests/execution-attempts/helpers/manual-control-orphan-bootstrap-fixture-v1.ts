import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

// Component negatives only. This helper provides neither installation setup nor
// an owned genuine-bootstrap route. In particular its tsx child cannot establish
// original compiled launch, clean-main M, old T admission, or a fixed-I5 positive.
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
