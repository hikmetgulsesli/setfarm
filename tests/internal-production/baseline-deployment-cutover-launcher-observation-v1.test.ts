import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const secrets = ["postgresql://fixture:PG_SENTINEL@localhost/fixture", "TOKEN_SENTINEL", "/var/run/com.apple.launchd.SocketSentinel/Listeners"];
const labels = ["com.setrox.setfarm-spawner", "com.setrox.setfarm-dashboard"];
function fixture(body: (home: string, texts: string[]) => void): void {
  const home = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "cutover-launcher-")));
  const directory = path.join(home, "Library", "LaunchAgents");
  fs.mkdirSync(directory, { recursive: true, mode: 0o755 });
  const texts = labels.map((label, index) => {
    const program = path.join(home, ".local", "bin", "setfarm");
    const args = index ? [program, "dashboard", "start", "--port", "3333"] : [program, "spawner", "start"];
    const environment = index ? { PATH: "/usr/local/bin:/usr/bin:/bin", SETFARM_PG_URL: secrets[0], SETFARM_OPERATIONAL_WRITE_TOKEN: secrets[1] }
      : { PATH: "/usr/local/bin:/usr/bin:/bin", SETFARM_PG_URL: secrets[0] };
    const log = path.join(home, ".openclaw", "logs", index ? "setfarm-dashboard.watch" : "setfarm-spawner.watch");
    const plistPath = path.join(directory, `${label}.plist`);
    const plist = { Label: label, ProgramArguments: args, EnvironmentVariables: environment, RunAtLoad: true, StartInterval: 60,
      StandardOutPath: `${log}.log`, StandardErrorPath: `${log}.err.log` };
    fs.writeFileSync(plistPath, execFileSync("/usr/bin/plutil", ["-convert", "xml1", "-o", "-", "-"], { input: JSON.stringify(plist) }), { mode: 0o600 });
    const block = (name: string, lines: string[]) => `\t${name} = {\n${lines.map(line => `\t\t${line}\n`).join("")}\t}\n`;
    return `gui/${process.getuid!()}/${label} = {\n\tpath = ${plistPath}\n\tprogram = ${program}\n\tstate = not running\n\tactive count = 0\n\ttype = LaunchAgent\n\trun interval = 60 seconds\n\tproperties = runatload\n`
      + block("arguments", args)
      + block("environment", Object.entries({ ...environment, OSLogRateLimit: "64", XPC_SERVICE_NAME: label }).map(([key, value]) => `${key} => ${value}`))
      + block("inherited environment", [`SETFARM_ENV_DIR => ${home}/ai/setrox/setfarm/scripts`, `SSH_AUTH_SOCK => ${secrets[2]}`])
      + block("default environment", ["PATH => /usr/bin:/bin:/usr/sbin:/sbin"]) + "}\n";
  });
  try { body(home, texts); } finally { fs.rmSync(home, { recursive: true, force: true }); }
}
function observe(home: string, texts: string[], fault = "", census?: string, defaultAction?: string): any {
  const originalUrl = new URL("../../src/internal-production/baseline-deployment-cutover-launcher-observation-v1.ts", import.meta.url);
  let url = originalUrl.href;
  if (census !== undefined || defaultAction !== undefined) {
    let source = fs.readFileSync(originalUrl, "utf8");
    const marker = 'await import("./baseline-legacy-database-census-v1.js")';
    assert.equal(source.split(marker).length, 2);
    const transportFile = path.join(home, "census-transport.mjs");
    fs.writeFileSync(transportFile, `export async function observeLegacyDatabaseCensusV1(url,cold,profile){${census ?? "globalThis.dbCalls++;return Object.freeze({activeRunCount:0})"}}`);
    source = source.replace(marker, `await import(${JSON.stringify(pathToFileURL(transportFile).href)})`);
    source = source.replace('"../product-compiler/canonical-json.js"', JSON.stringify(new URL("../../src/product-compiler/canonical-json.ts", import.meta.url).href));
    if (defaultAction !== undefined) {
      const helpers = path.join(home, "default-helpers.mjs");
      fs.writeFileSync(helpers, `
        export const holdDeploymentCutoverNodePathV1=(...args)=>globalThis.nodeHold(...args);
        export const observeDeploymentCutoverProcessFamiliesV1=()=>globalThis.processes();
        export const identifyDeploymentCutoverPassiveProcessV1=request=>globalThis.identify(request);
        export const measureDeploymentCutoverPassiveHomeV1=request=>globalThis.measure(request);
      `);
      for (const name of ["baseline-deployment-cutover-node-path-v1", "baseline-deployment-cutover-process-observation-v1"])
        source = source.replace(JSON.stringify(`./${name}.js`), JSON.stringify(pathToFileURL(helpers).href));
      const native = path.join(home, "default-native.mjs");
      fs.writeFileSync(native, `globalThis.allowRunning=true;
        export const identifyDeploymentCutoverPassiveProcessV1=request=>globalThis.identify(request);
        export const measureDeploymentCutoverPassiveHomeV1=request=>globalThis.measure(request);`);
      source = source.replace('new URL("../../scripts/deployment-cutover-passive-home.mjs", import.meta.url).href', JSON.stringify(pathToFileURL(native).href));
    } else {
      for (const name of ["baseline-deployment-cutover-node-path-v1", "baseline-deployment-cutover-process-observation-v1"])
        source = source.replace(JSON.stringify(`./${name}.js`), JSON.stringify(new URL(`../../src/internal-production/${name}.ts`, import.meta.url).href));
    }
    fs.writeFileSync(path.join(home, "package.json"), '{"type":"module"}');
    const file = path.join(home, "launcher-fixture.ts");
    fs.writeFileSync(file, source);
    url = pathToFileURL(file).href;
  }
  const child = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `
    import os from "node:os"; import fs from "node:fs"; import cp from "node:child_process";
    import {inspect as render} from "node:util"; import {syncBuiltinESMExports} from "node:module";
    const identity = os.userInfo(); os.userInfo = () => ({...identity,homedir:${JSON.stringify(home)}});
    const texts = ${JSON.stringify(texts)}, labels = ${JSON.stringify(labels)};
    let prints = 0, conversions = 0, active = false, run, evidence = () => null;
    globalThis.dbCalls=0;globalThis.samples=0;globalThis.nodeCloses=0;
    globalThis.processes=()=>Object.freeze({families:Object.freeze([]),listener:null});
    globalThis.nodeHold=()=>({observation:Object.freeze({candidatePath:'/fixture/invoked/node',executablePath:'/fixture/physical/node'}),recheck(){},close(){globalThis.nodeCloses++}});
    globalThis.identify=request=>({...request,schema:'setfarm.internal-production-passive-process-identity.v1',ppid:1,startSeconds:1234,startMicroseconds:56});
    globalThis.measure=request=>{globalThis.samples++;if(globalThis.samples===2)setTimeout(()=>{globalThis.idle=true},0);return Object.freeze({schema:'setfarm.internal-production-passive-home-measurement.v1',pid:request.pid,ppid:1,uid:request.uid,gid:request.gid,startSeconds:1234,startMicroseconds:56,homeContext:'account',completeEnvironmentValidated:true,stableDoubleRead:true})};
    const spawn = cp.spawnSync;
    cp.spawnSync = (command, args, options) => {
      if (command === "/bin/launchctl") {
        if (args.length !== 2 || args[0] !== "print") throw Error("unexpected launcher command");
        const index = labels.findIndex(label => args[1] === "gui/" + process.getuid() + "/" + label);
        if (index < 0) throw Error("unexpected launcher target");
        prints++; let text=texts[index];
        if (${defaultAction !== undefined} && !globalThis.idle && globalThis.allowRunning
          && (globalThis.runningIndex===undefined||globalThis.runningIndex===index)
          && !(globalThis.dashboardFirst&&index===0&&globalThis.samples===0))
          text=text.replace('state = not running','state = running').replace('active count = 0','active count = 1').slice(0,-2)+'\\tpid = '+(12345+index)+'\\n}\\n';
        return {status:0, signal:null, stdout:Buffer.from(text), stderr:Buffer.alloc(0)};
      }
      if (command === '/usr/bin/getconf') return {status:0,signal:null,stdout:Buffer.from('/var/folders/fixture/T/\\n'),stderr:Buffer.alloc(0)};
      if (command !== "/usr/bin/plutil" || JSON.stringify(args) !== JSON.stringify(["-convert","json","-o","-","-"])) throw Error("unexpected command");
      conversions++; return spawn(command,args,options);
    };
    ${fault}
    syncBuiltinESMExports();
    try {
      const module = await import(${JSON.stringify(url)}); active = true;
      run = ${defaultAction === undefined ? `module.${census === undefined ? "observeDeploymentCutoverLauncherConfigurationV1" : "observeDeploymentCutoverLauncherDatabaseV1"}` : `async()=>{const context=module.holdDeploymentCutoverDefaultLauncherV1();try{${defaultAction}}finally{context.close()}}`};
      const observation = await run();
      const frozen = value => !value || typeof value !== "object" || (Object.isFrozen(value) && Object.values(value).every(frozen));
      process.stdout.write(JSON.stringify({observation,frozen:frozen(observation),prints,conversions,evidence:evidence()}));
    } catch(error) {
      let retryError = null;
      if (run && ${defaultAction === undefined}) { try { await run(); } catch (retry) { retryError = render(retry,{depth:null}); } }
      process.stdout.write(JSON.stringify({error:render(error,{depth:null}),launcherStage:error.cutoverLauncherStage,cleanupFailed:error.cutoverCleanupFailed,retryError,prints,conversions,evidence:evidence()}));
    }
  `], { encoding: "utf8", env: {}, timeout: 15000 });
  assert.equal(child.status, 0, child.stderr); return JSON.parse(child.stdout);
}

test("default launcher holds configuration without exposing credential-derived commitments and denies early census", () => fixture((home, texts) => {
  texts = texts.map(text => text.replace(`\t\tSETFARM_ENV_DIR => ${home}/ai/setrox/setfarm/scripts\n`, ""));
  const result = observe(home, texts, `evidence=()=>({dbCalls:globalThis.dbCalls,nodeCloses:globalThis.nodeCloses});`, undefined,
    `await context.census();return context.observation;`);
  assert.match(result.error, /DEPLOYMENT_CUTOVER_LAUNCHER_OBSERVATION_INVALID/);
  assert.equal(result.evidence.dbCalls, 0);
  assert.ok(result.evidence.nodeCloses >= 2);
}));

test("default launcher accepts only zero input", async () => {
  const module = await import("../../src/internal-production/baseline-deployment-cutover-launcher-observation-v1.js");
  assert.equal(typeof (module as any).holdDeploymentCutoverDefaultLauncherV1, "function");
  assert.throws(() => (module as any).holdDeploymentCutoverDefaultLauncherV1({pid:12345}), /DEPLOYMENT_CUTOVER_LAUNCHER_OBSERVATION_INVALID/);
});

function defaultFixture(body: (home: string, texts: string[]) => void) {
  fixture((home, texts) => {
    const agreed = secrets[0]!.replace(/\/fixture$/, "/setfarm");
    labels.forEach((label, index) => {
      const file = path.join(home, "Library", "LaunchAgents", `${label}.plist`);
      fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace(secrets[0]!, agreed));
      texts[index] = texts[index]!.replace(secrets[0]!, agreed)
        .replace(`\t\tSETFARM_ENV_DIR => ${home}/ai/setrox/setfarm/scripts\n`, "");
    });
    body(home, texts);
  });
}

test("default launcher binds both passive generations before fresh idle and private census", () => defaultFixture((home, texts) => {
  const result = observe(home, texts, `
    const measure=globalThis.measure;globalThis.measure=request=>{
      if(request.environment.HOME!==${JSON.stringify(home)} || request.launchExecutable!=='/fixture/invoked/node'
        || request.executable!=='/fixture/physical/node' || request.argv[0]!=='node'
        || request.expectedStartSeconds!==1234 || request.expectedStartMicroseconds!==56
        || request.optionalEnvironment.USER!==identity.username || request.optionalEnvironment.TMPDIR!=='/var/folders/fixture/T/'
        || 'SETFARM_ENV_DIR' in request.environment)throw Error('CROSSED_PROFILE');
      return measure(request);
    };
    evidence=()=>({dbCalls:globalThis.dbCalls,samples:globalThis.samples,nodeCloses:globalThis.nodeCloses});
  `, undefined, `const qualification=await context.qualifyPassiveHome();const database=await context.census();return Object.freeze({configuration:context.observation,qualification,database});`);
  assert.equal(result.observation?.configuration.schema, "setfarm.internal-production-deployment-cutover-default-launcher.v1", JSON.stringify(result));
  assert.equal(result.observation.qualification.samples.length, 2);
  assert.equal(result.evidence.dbCalls, 1);
  assert.equal(result.evidence.nodeCloses, 2);
  assert.equal(result.frozen, true);
  assert.doesNotMatch(JSON.stringify(result), /PG_SENTINEL|TOKEN_SENTINEL|SocketSentinel|plistBytesHash|configurationHash|loadedStateHash|launcherObservationHash/);
}));

for (const kind of ["startup", "startup-active-zero", "startup-no-pid", "unknown-startup", "startup-baseline", "startup-deadline"]) {
  test(`default ${kind} is occupied but never eligible for native sampling`, () => defaultFixture((home, texts) => {
    const result = observe(home, texts, `
      const kind=${JSON.stringify(kind)},command=cp.spawnSync,identify=globalThis.identify;
      let starting=true,scheduled=false,startupSnapshots=0,nativeDuringStartup=0;
      if(kind==='startup-deadline'){let tick=0;performance.now=()=>tick+=40000}
      cp.spawnSync=(exe,args,options)=>{
        const value=command(exe,args,options);
        if(exe==='/bin/launchctl'&&globalThis.allowRunning&&starting){
          startupSnapshots++;
          if(!scheduled&&kind!=='startup-deadline'){scheduled=true;setTimeout(()=>{starting=false},0)}
          let text=value.stdout.toString().replace('state = running','state = '+(kind==='unknown-startup'?'unknown startup':'xpcproxy'));
          if(kind==='startup-active-zero')text=text.replace('active count = 1','active count = 0');
          if(kind==='startup-no-pid')text=text.replace(/\\tpid = [0-9]+\\n/,'');
          return {...value,stdout:Buffer.from(text)};
        }
        return value;
      };
      globalThis.identify=request=>{if(starting){nativeDuringStartup++;throw Error('TOKEN_SENTINEL')}return identify(request)};
      evidence=()=>({startupSnapshots,nativeDuringStartup,dbCalls:globalThis.dbCalls,samples:globalThis.samples,nodeCloses:globalThis.nodeCloses});
    `, undefined, `${kind === "startup-baseline" ? "globalThis.allowRunning=true;" : ""}const qualification=await context.qualifyPassiveHome();await context.census();return qualification;`);
    assert.ok(result.evidence.startupSnapshots > 0, JSON.stringify(result));
    assert.equal(result.evidence.nativeDuringStartup, 0); assert.equal(result.evidence.nodeCloses, 2);
    if (kind === "startup") {
      assert.equal(result.error, undefined, JSON.stringify(result));
      assert.equal(result.observation.samples.length, 2); assert.equal(result.evidence.dbCalls, 1);
    } else {
      assert.match(result.error, /DEPLOYMENT_CUTOVER_LAUNCHER_OBSERVATION_INVALID/);
      assert.equal(result.evidence.samples, 0); assert.equal(result.evidence.dbCalls, 0);
      if (kind === "startup-baseline") assert.equal(result.launcherStage, "baseline");
      if (kind === "startup-deadline") assert.equal(result.launcherStage, "waiting");
    }
    assert.doesNotMatch(JSON.stringify(result), /TOKEN_SENTINEL|PG_SENTINEL/);
  }));
}

test("default acquisition does not treat xpcproxy as idle", () => defaultFixture((home, texts) => {
  texts[0] = texts[0]!.replace('state = not running', 'state = xpcproxy').replace('active count = 0', 'active count = 1').slice(0, -2) + '\tpid = 12345\n}\n';
  const result = observe(home, texts, `evidence=()=>({samples:globalThis.samples,dbCalls:globalThis.dbCalls});`, undefined, `await context.qualifyPassiveHome();return context.observation;`);
  assert.match(result.error, /DEPLOYMENT_CUTOVER_LAUNCHER_OBSERVATION_INVALID/);
  assert.deepEqual(result.evidence, { samples: 0, dbCalls: 0 });
}));

test("strict launcher observation still rejects xpcproxy", () => fixture((home, texts) => {
  texts[0] = texts[0]!.replace('state = not running', 'state = xpcproxy').replace('active count = 0', 'active count = 1').slice(0, -2) + '\tpid = 12345\n}\n';
  const result = observe(home, texts);
  assert.match(result.error, /DEPLOYMENT_CUTOVER_LAUNCHER_OBSERVATION_INVALID/);
}));

test("sampled startup regression refuses before another native identity call", () => defaultFixture((home, texts) => {
  const result = observe(home, texts, `
    const command=cp.spawnSync,identify=globalThis.identify;let identities=0;
    globalThis.identify=request=>{identities++;return identify(request)};
    cp.spawnSync=(exe,args,options)=>{
      const value=command(exe,args,options);
      if(exe==='/bin/launchctl'&&globalThis.samples===2&&args[1].endsWith('setfarm-spawner'))
        return {...value,stdout:Buffer.from(value.stdout.toString().replace('state = running','state = xpcproxy'))};
      return value;
    };
    evidence=()=>({identities,samples:globalThis.samples,dbCalls:globalThis.dbCalls});
  `, undefined, `await context.qualifyPassiveHome();await context.census();return context.observation;`);
  assert.equal(result.launcherStage, "sampled-generation", JSON.stringify(result));
  assert.deepEqual(result.evidence, { identities: 2, samples: 2, dbCalls: 0 });
}));

for (const [transition, expectedStage] of [["idle", null], ["native-error", "sampled-native"],
  ["identity-mismatch", "sampled-bind"], ["replacement", "sampled-postcheck"], ["malformed-idle", "sampled-postcheck"], ["sampled-startup", "sampled-postcheck"], ["settled-restart", "sampled-generation"]] as const) {
  test(`sampled monitor ${transition} preserves authenticated settlement and refusal boundaries`, () => defaultFixture((home, texts) => {
    const result = observe(home, texts, `
      const transition=${JSON.stringify(transition)},identify=globalThis.identify,command=cp.spawnSync;
      let monitored=false;
      globalThis.identify=request=>{
        const value=identify(request);
        if(globalThis.samples===2){
          monitored=true;
          if(transition==='settled-restart')globalThis.runningIndex=request.pid===12345?1:undefined;
          if(transition==='idle'||transition==='native-error'||transition==='identity-mismatch')globalThis.idle=true;
          if(transition==='native-error')throw Error('TOKEN_SENTINEL');
          if(transition==='identity-mismatch')return {...value,startMicroseconds:57};
        }
        return value;
      };
      cp.spawnSync=(exe,args,options)=>{
        const value=command(exe,args,options);
        if(monitored&&exe==='/bin/launchctl'&&args[1].endsWith('setfarm-spawner')){
          if(transition==='replacement')return {...value,stdout:Buffer.from(value.stdout.toString().replace('pid = 12345','pid = 22345'))};
          if(transition==='malformed-idle')return {...value,stdout:Buffer.from(value.stdout.toString().replace('state = running','state = spawn scheduled'))};
          if(transition==='sampled-startup')return {...value,stdout:Buffer.from(value.stdout.toString().replace('state = running','state = xpcproxy'))};
        }
        return value;
      };
      evidence=()=>({monitored,dbCalls:globalThis.dbCalls,samples:globalThis.samples,nodeCloses:globalThis.nodeCloses});
    `, undefined, `const qualification=await context.qualifyPassiveHome();await context.census();return qualification;`);
    assert.equal(result.evidence.monitored, true, JSON.stringify(result));
    assert.equal(result.evidence.samples, 2); assert.equal(result.evidence.nodeCloses, 2);
    if (expectedStage === null) {
      assert.equal(result.error, undefined, JSON.stringify(result));
      assert.equal(result.observation.samples.length, 2); assert.equal(result.evidence.dbCalls, 1);
    } else {
      assert.match(result.error, /DEPLOYMENT_CUTOVER_LAUNCHER_OBSERVATION_INVALID/);
      assert.equal(result.launcherStage, expectedStage, JSON.stringify(result));
      assert.equal(result.evidence.dbCalls, 0);
    }
    assert.doesNotMatch(JSON.stringify(result), /TOKEN_SENTINEL|PG_SENTINEL/);
  }));
}

for (const [fault, stage] of [["identify", "identity"], ["measure", "measure"], ["generation", "measurement-bind"], ["process", "idle"]]) {
  test(`default launcher finite diagnostic identifies ${fault} refusal without secrets`, () => defaultFixture((home, texts) => {
    const result = observe(home, texts, `
      const kind=${JSON.stringify(fault)},measure=globalThis.measure;
      if(kind==='identify')globalThis.identify=()=>{throw Error('TOKEN_SENTINEL')};
      if(kind==='measure')globalThis.measure=()=>{throw Error('TOKEN_SENTINEL')};
      if(kind==='generation')globalThis.measure=request=>({...measure(request),startMicroseconds:999});
      if(kind==='process')globalThis.processes=()=>({families:[{}],listener:null});
      evidence=()=>({dbCalls:globalThis.dbCalls,nodeCloses:globalThis.nodeCloses});
    `, undefined, `await context.qualifyPassiveHome();await context.census();return context.observation;`);
    assert.equal(result.launcherStage, stage, JSON.stringify(result));
    assert.equal(result.evidence.dbCalls, 0); assert.equal(result.evidence.nodeCloses, 2);
    assert.doesNotMatch(JSON.stringify(result), /TOKEN_SENTINEL|PG_SENTINEL/);
  }));
}

test("default partial acquisition exposes sanitized cleanup loss before returning a holder", () => defaultFixture((home, texts) => {
  const result = observe(home, texts, `
    let calls=0;const node=globalThis.nodeHold;
    globalThis.nodeHold=(...args)=>{if(++calls===2)throw Error('TOKEN_SENTINEL');const held=node(...args);return {...held,close(){held.close();throw Error('TOKEN_SENTINEL')}}};
    evidence=()=>({dbCalls:globalThis.dbCalls,nodeCloses:globalThis.nodeCloses});
  `, undefined, `return context.observation;`);
  assert.equal(result.cleanupFailed, true, JSON.stringify(result));
  assert.equal(result.evidence.nodeCloses, 1); assert.equal(result.evidence.dbCalls, 0);
  assert.doesNotMatch(JSON.stringify(result), /TOKEN_SENTINEL/);
}));

test("default configuration acquisition retains observed descriptor cleanup loss", () => defaultFixture((home, texts) => {
  const result = observe(home, texts, `
    const close=fs.closeSync,spawnCommand=cp.spawnSync;let lost=false;
    cp.spawnSync=(command,args,options)=>{if(active&&command==='/usr/bin/plutil')throw Error('TOKEN_SENTINEL');return spawnCommand(command,args,options)};
    fs.closeSync=fd=>{close(fd);if(active&&!lost){lost=true;throw Error('TOKEN_SENTINEL')}};
    evidence=()=>({lost,dbCalls:globalThis.dbCalls,nodeCloses:globalThis.nodeCloses});
  `, undefined, `return context.observation;`);
  assert.equal(result.evidence.lost, true); assert.equal(result.cleanupFailed, true, JSON.stringify(result));
  assert.equal(result.evidence.nodeCloses, 0); assert.equal(result.evidence.dbCalls, 0);
  assert.doesNotMatch(JSON.stringify(result), /TOKEN_SENTINEL/);
}));

for (const fault of ["generation", "parent", "native-refusal", "process-contender", "temp", "account", "pid", "node-second"]) {
  test(`default ${fault} refusal prevents census and drains held nodes`, () => defaultFixture((home, texts) => {
    const result = observe(home, texts, `
      const kind=${JSON.stringify(fault)};let changed=false;
      const identify=globalThis.identify,measure=globalThis.measure;
      globalThis.identify=request=>{const value=identify(request);if(kind==='parent')value.ppid=99;return value};
      globalThis.measure=request=>{
        if(kind==='native-refusal')throw Error('TOKEN_SENTINEL');
        const value=measure(request);changed=true;
        if(kind==='generation')return {...value,startMicroseconds:57};
        if(kind==='pid')texts[0]=texts[0].replace('state = not running','state = spawn scheduled');
        return value;
      };
      if(kind==='process-contender')globalThis.processes=()=>({families:[{}],listener:null});
      const info=os.userInfo;os.userInfo=()=>{const value=info();return kind==='account'&&changed?{...value,username:'crossed'}:value};
      const command=cp.spawnSync;cp.spawnSync=(exe,args,options)=>{
        const value=command(exe,args,options);
        if(kind==='temp'&&changed&&exe==='/usr/bin/getconf')return {...value,stdout:Buffer.from('/var/folders/crossed/T/\\n')};
        return value;
      };
      const node=globalThis.nodeHold;let nodeCalls=0;globalThis.nodeHold=(...args)=>{nodeCalls++;if(kind==='node-second'&&nodeCalls===2)throw Error('TOKEN_SENTINEL');return node(...args)};
      evidence=()=>({dbCalls:globalThis.dbCalls,nodeCloses:globalThis.nodeCloses,nodeCalls});
    `, undefined, `await context.qualifyPassiveHome();await context.census();return context.observation;`);
    assert.match(result.error, /DEPLOYMENT_CUTOVER_LAUNCHER_OBSERVATION_INVALID/, JSON.stringify(result));
    assert.equal(result.evidence.dbCalls, 0);
    assert.ok(result.evidence.nodeCloses >= (fault === "node-second" ? 1 : 2));
    assert.doesNotMatch(JSON.stringify(result), /TOKEN_SENTINEL|PG_SENTINEL/);
  }));
}

for (const boundary of ["second-sample", "repeat", "concurrent", "deadline", "db-retry-start", "close-loss"]) {
  test(`default ${boundary} lifecycle refuses without partial success`, () => defaultFixture((home, texts) => {
    const fault = `
      const kind=${JSON.stringify(boundary)},measure=globalThis.measure,node=globalThis.nodeHold;
      globalThis.measure=request=>{if(kind==='second-sample'&&globalThis.samples===1)throw Error('TOKEN_SENTINEL');return measure(request)};
      if(kind==='deadline'){globalThis.idle=true;let tick=0;performance.now=()=>tick+=40000}
      globalThis.nodeHold=(...args)=>{const value=node(...args);return {...value,close(){value.close();if(kind==='close-loss')throw Error('TOKEN_SENTINEL')}}};
      evidence=()=>({dbCalls:globalThis.dbCalls,samples:globalThis.samples,nodeCloses:globalThis.nodeCloses});
    `;
    const action = boundary === "concurrent"
      ? `await Promise.all([context.qualifyPassiveHome(),context.qualifyPassiveHome()]);return context.observation;`
      : boundary === "repeat"
        ? `await context.qualifyPassiveHome();await context.qualifyPassiveHome();return context.observation;`
        : `await context.qualifyPassiveHome();await context.census();return context.observation;`;
    const result = observe(home, texts, fault,
      `globalThis.dbCalls++;await Promise.resolve();${boundary === "db-retry-start" ? "globalThis.idle=false;" : ""}return Object.freeze({activeRunCount:0});`, action);
    assert.match(result.error, /DEPLOYMENT_CUTOVER_LAUNCHER_OBSERVATION_INVALID/, JSON.stringify(result));
    assert.equal(result.observation, undefined);
    assert.equal(result.evidence.dbCalls, ["db-retry-start", "close-loss"].includes(boundary) ? 1 : 0);
    assert.equal(result.evidence.nodeCloses, 2);
    if (boundary === "second-sample") assert.equal(result.evidence.samples, 1);
    assert.doesNotMatch(JSON.stringify(result), /TOKEN_SENTINEL|PG_SENTINEL/);
  }));
}

test("default failed qualification permanently poisons recheck and census", () => defaultFixture((home, texts) => {
  const result = observe(home, texts, `globalThis.measure=()=>{throw Error('TOKEN_SENTINEL')};evidence=()=>({dbCalls:globalThis.dbCalls});`, undefined, `
    let refusals=0;
    for(const action of [()=>context.qualifyPassiveHome(),()=>context.recheck(),()=>context.census(),()=>context.qualifyPassiveHome()]){
      try{await action()}catch(error){if(error.message!=='DEPLOYMENT_CUTOVER_LAUNCHER_OBSERVATION_INVALID')throw error;refusals++}
    }
    return Object.freeze({refusals});
  `);
  assert.equal(result.observation?.refusals, 4, JSON.stringify(result));
  assert.equal(result.evidence.dbCalls, 0);
}));

test("default account acquisition drift refuses before native observation", () => defaultFixture((home, texts) => {
  const result = observe(home, texts, `
    const info=os.userInfo;let calls=0;os.userInfo=()=>{const value=info();return {...value,username:++calls===1?'before':'after'}};
    evidence=()=>({samples:globalThis.samples,dbCalls:globalThis.dbCalls});
  `, undefined, `await context.qualifyPassiveHome();return context.observation;`);
  assert.match(result.error, /DEPLOYMENT_CUTOVER_LAUNCHER_OBSERVATION_INVALID/, JSON.stringify(result));
  assert.equal(result.evidence.samples, 0);
  assert.equal(result.evidence.dbCalls, 0);
}));

test("default replacement generation after sampling refuses instead of waiting through it", () => defaultFixture((home, texts) => {
  const result = observe(home, texts, `
    const command=cp.spawnSync;cp.spawnSync=(exe,args,options)=>{
      const value=command(exe,args,options);
      if(exe==='/bin/launchctl'&&globalThis.samples===2&&!globalThis.idle&&args[1].endsWith('setfarm-spawner'))
        return {...value,stdout:Buffer.from(value.stdout.toString().replace('pid = 12345','pid = 22345'))};
      return value;
    };evidence=()=>({dbCalls:globalThis.dbCalls});
  `, undefined, `await context.qualifyPassiveHome();await context.census();return context.observation;`);
  assert.match(result.error, /DEPLOYMENT_CUTOVER_LAUNCHER_OBSERVATION_INVALID/, JSON.stringify(result));
  assert.equal(result.evidence.dbCalls, 0);
}));

for (const index of [0, 1]) test(`default already-running label ${index} refuses before reading a pre-absence generation`, () => defaultFixture((home, texts) => {
  const result = observe(home, texts, `globalThis.allowRunning=true;globalThis.runningIndex=${index};evidence=()=>({samples:globalThis.samples,dbCalls:globalThis.dbCalls});`, undefined,
    `await context.qualifyPassiveHome();await context.census();return context.observation;`);
  assert.match(result.error, /DEPLOYMENT_CUTOVER_LAUNCHER_OBSERVATION_INVALID/, JSON.stringify(result));
  assert.equal(result.evidence.samples, 0);
  assert.equal(result.evidence.dbCalls, 0);
}));

test("default pre-resolution generation refuses at qualification even after idle acquisition", () => defaultFixture((home, texts) => {
  const result = observe(home, texts, `evidence=()=>({samples:globalThis.samples,dbCalls:globalThis.dbCalls});`, undefined,
    `globalThis.allowRunning=true;await context.qualifyPassiveHome();await context.census();return context.observation;`);
  assert.match(result.error, /DEPLOYMENT_CUTOVER_LAUNCHER_OBSERVATION_INVALID/, JSON.stringify(result));
  assert.equal(result.evidence.samples, 0);
  assert.equal(result.evidence.dbCalls, 0);
}));

test("default dashboard-first sampling retains explicit launcher and Node association", () => defaultFixture((home, texts) => {
  const result = observe(home, texts, `globalThis.dashboardFirst=true;`, undefined, `return await context.qualifyPassiveHome();`);
  assert.equal(result.observation?.samples.length, 2, JSON.stringify(result));
  assert.deepEqual(result.observation.samples.map((entry: any) => entry.label), labels);
  assert.deepEqual(result.observation.samples.map((entry: any) => entry.measurement.pid), [12345, 12346]);
  assert.ok(result.observation.samples.every((entry: any) => entry.node.executablePath === "/fixture/physical/node"));
}));

test("database observation privately binds the agreed launcher URL and pre32 census", () => fixture((home, texts) => {
  const original = secrets[0]!;
  const agreed = original.replace(/\/fixture$/, "/setfarm");
  for (const label of labels) {
    const file = path.join(home, "Library", "LaunchAgents", `${label}.plist`);
    fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace(original, agreed));
  }
  texts = texts.map(text => text.replace(original, agreed));
  const result = observe(home, texts, "", `
    if(url!==${JSON.stringify(agreed)} || cold!==true || profile!=='cutover-local')throw Error('WRONG_DATABASE_TARGET');
    return Object.freeze({activeRunCount:0});
  `);
  assert.equal(result.observation?.schema, "setfarm.internal-production-deployment-cutover-launcher-database-observation.v1", JSON.stringify(result));
  assert.deepEqual(result.observation.databaseCensus, { activeRunCount: 0 });
  assert.equal(result.observation.launcherObservation.launchers.length, 2);
  assert.equal(result.frozen, true);
  for (const secret of [...secrets, agreed]) assert.equal(JSON.stringify(result).includes(secret), false);
}));

test("launcher observation accepts legitimate partial plist reads", () => fixture((home, texts) => {
  const result = observe(home, texts, `const read=fs.readSync;fs.readSync=(fd,buffer,offset,length,position)=>read(fd,buffer,offset,active?Math.min(length,17):length,position);`);
  assert.equal(result.observation?.launchers.length, 2, JSON.stringify(result));
  assert.equal(result.frozen, true);
}));

test("async census close response loss consumes descriptors once and poisons retry", () => fixture((home, texts) => {
  const original = secrets[0]!, agreed = original.replace(/\/fixture$/, "/setfarm");
  labels.forEach((label, index) => {
    const file = path.join(home, "Library", "LaunchAgents", `${label}.plist`);
    fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace(original, agreed));
    texts[index] = texts[index]!.replace(original, agreed);
  });
  const sentinel = path.join(home, "sentinel"); fs.writeFileSync(sentinel, "sentinel");
  const result = observe(home, texts, `
    const close=fs.closeSync;let consumed=null,sentinelFd=null,attempts=0;
    globalThis.censusCalls=0;
    fs.closeSync=fd=>{
      if(active && consumed===null && fs.fstatSync(fd).isDirectory()){consumed=fd;attempts++;close(fd);sentinelFd=fs.openSync(${JSON.stringify(sentinel)},'r');throw Error('TOKEN_SENTINEL')}
      if(fd===consumed)attempts++;return close(fd);
    };
    evidence=()=>({attempts,reused:sentinelFd===consumed,alive:fs.fstatSync(sentinelFd).isFile(),calls:globalThis.censusCalls});
  `, `globalThis.censusCalls++;await Promise.resolve();return Object.freeze({activeRunCount:0});`);
  assert.match(result.error, /DEPLOYMENT_CUTOVER_LAUNCHER_OBSERVATION_INVALID/);
  assert.match(result.retryError, /DEPLOYMENT_CUTOVER_LAUNCHER_OBSERVATION_INVALID/);
  assert.deepEqual(result.evidence, { attempts: 1, reused: true, alive: true, calls: 1 });
  assert.equal(result.observation, undefined);
  assert.doesNotMatch(JSON.stringify(result), /TOKEN_SENTINEL|PG_SENTINEL/);
}));

for (const target of ["crossed", "remote", "query", "fragment", "port", "database", "ambiguous-host"]) {
  test(`${target} database target refuses before invoking the census`, () => fixture((home, texts) => {
    const original = secrets[0]!;
    const agreed = original.replace(/\/fixture$/, "/setfarm");
    const changed = target === "ambiguous-host" ? "postgresql://u:p@remote.invalid,other.invalid@localhost/setfarm"
      : target === "remote" ? agreed.replace("localhost", "remote.invalid")
      : target === "query" ? `${agreed}?host=remote.invalid`
      : target === "fragment" ? `${agreed}#private`
      : target === "port" ? agreed.replace("localhost", "localhost:5433")
      : target === "database" ? original : agreed.replace("PG_SENTINEL", "OTHER_PRIVATE_SENTINEL");
    labels.forEach((label, index) => {
      const url = target === "crossed" && index === 0 ? agreed : changed;
      const file = path.join(home, "Library", "LaunchAgents", `${label}.plist`);
      fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace(original, url.replaceAll("&", "&amp;")));
      texts[index] = texts[index]!.replace(original, url);
    });
    const result = observe(home, texts, `globalThis.censusCalls=0;evidence=()=>({calls:globalThis.censusCalls});`,
      `globalThis.censusCalls++;throw Error('PRIVATE_CENSUS_CALLED');`);
    assert.match(result.error, /DEPLOYMENT_CUTOVER_LAUNCHER_OBSERVATION_INVALID/);
    assert.equal(result.evidence.calls, 0);
    for (const secret of [...secrets, changed, "OTHER_PRIVATE_SENTINEL"]) assert.equal(JSON.stringify(result).includes(secret), false);
  }));
}

test("asynchronous database failure closes held descriptors without exposing credentials", () => fixture((home, texts) => {
  const original = secrets[0]!, agreed = original.replace(/\/fixture$/, "/setfarm");
  labels.forEach((label, index) => {
    const file = path.join(home, "Library", "LaunchAgents", `${label}.plist`);
    fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace(original, agreed));
    texts[index] = texts[index]!.replace(original, agreed);
  });
  const result = observe(home, texts, `
    const descriptors=new Set(),open=fs.openSync,close=fs.closeSync;
    fs.openSync=(...args)=>{const fd=open(...args);if(active)descriptors.add(fd);return fd};
    fs.closeSync=fd=>{close(fd);descriptors.delete(fd)};
    evidence=()=>({open:descriptors.size});
  `, `await Promise.resolve();throw Error(${JSON.stringify(agreed)},{cause:Error('TOKEN_SENTINEL')});`);
  assert.match(result.error, /DEPLOYMENT_CUTOVER_LAUNCHER_OBSERVATION_INVALID/);
  assert.equal(result.evidence.open, 0);
  for (const secret of [...secrets, agreed]) assert.equal(JSON.stringify(result).includes(secret), false);
}));

for (const drift of ["bytes", "file", "parent", "loaded"]) {
  test(`${drift} drift while awaiting database census refuses the observation`, () => fixture((home, texts) => {
    const original = secrets[0]!, agreed = original.replace(/\/fixture$/, "/setfarm");
    labels.forEach((label, index) => {
      const file = path.join(home, "Library", "LaunchAgents", `${label}.plist`);
      fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace(original, agreed));
      texts[index] = texts[index]!.replace(original, agreed);
    });
    const file = path.join(home, "Library", "LaunchAgents", `${labels[0]}.plist`);
    const result = observe(home, texts, `
      let changed=false;globalThis.censusDrift=()=>{
        if(changed)return;changed=true;
        const file=${JSON.stringify(file)},kind=${JSON.stringify(drift)},parent=${JSON.stringify(path.dirname(file))};
        if(kind==='bytes')fs.appendFileSync(file,'\\n');
        if(kind==='file'){const bytes=fs.readFileSync(file);fs.renameSync(file,file+'.retained');fs.writeFileSync(file,bytes,{mode:0o600})}
        if(kind==='parent'){fs.renameSync(parent,parent+'.retained');fs.mkdirSync(parent)}
        if(kind==='loaded')texts[0]=texts[0].replace('not running','spawn scheduled');
      };evidence=()=>({changed});
    `, `await Promise.resolve();globalThis.censusDrift();return Object.freeze({activeRunCount:0});`);
    assert.match(result.error, /DEPLOYMENT_CUTOVER_LAUNCHER_OBSERVATION_INVALID/);
    assert.equal(result.evidence.changed, true);
    assert.equal(result.observation, undefined);
  }));
}

test("fixed launcher observation commits both unchanged configurations without revealing secrets", () => fixture((home, texts) => {
  const paths = labels.map(label => path.join(home, "Library", "LaunchAgents", `${label}.plist`));
  const bytes = paths.map(file => fs.readFileSync(file)), inodes = paths.map(file => fs.lstatSync(file).ino);
  const result = observe(home, texts);
  assert.equal(result.observation?.launchers.length, 2, JSON.stringify(result));
  assert.deepEqual(result.observation.launchers.map((entry: any) => entry.label), labels);
  assert.ok(result.observation.launchers.every((entry: any) => entry.activeCount === 0 && entry.state === "not running"));
  assert.equal(result.frozen, true); assert.equal(result.prints, 4);
  for (const secret of secrets) assert.equal(JSON.stringify(result).includes(secret), false);
  assert.equal(observe(home, texts).observation.launcherObservationHash, result.observation.launcherObservationHash);
  paths.forEach((file, index) => { assert.deepEqual(fs.readFileSync(file), bytes[index]); assert.equal(fs.lstatSync(file).ino, inodes[index]); });
}));

test("transient inherited socket changes do not change durable launcher commitments", () => fixture((home, texts) => {
  const first = observe(home, texts), next = observe(home, texts.map(text => text.replace("SocketSentinel", "DifferentSocket")));
  assert.equal(first.observation?.launchers.length, 2, JSON.stringify(first));
  assert.equal(next.observation?.launchers.length, 2, JSON.stringify(next));
  first.observation.launchers.forEach((entry: any, index: number) => {
    assert.equal(entry.configurationHash, next.observation.launchers[index].configurationHash);
    assert.notEqual(entry.loadedStateHash, next.observation.launchers[index].loadedStateHash);
  });
}));

for (const change of ["credential", "duplicate", "active", "arguments"]) {
  test(`${change} loaded configuration refuses without leaking credentials`, () => fixture((home, texts) => {
    if (change === "credential") texts[1] = texts[1]!.replace("TOKEN_SENTINEL", "CROSSED_TOKEN_SENTINEL");
    if (change === "duplicate") texts[0] = texts[0]!.replace("\tactive count = 0", "\tactive count = 0\n\tactive count = 0");
    if (change === "active") texts[0] = texts[0]!.replace("\tactive count = 0", "\tactive count = 1");
    if (change === "arguments") texts[1] = texts[1]!.replace("\t\t3333\n", "\t\t4444\n");
    const result = observe(home, texts);
    assert.match(result.error, /DEPLOYMENT_CUTOVER_LAUNCHER_OBSERVATION_INVALID/);
    for (const secret of [...secrets, "CROSSED_TOKEN_SENTINEL"]) assert.equal(result.error.includes(secret), false);
  }));
}

for (const change of ["symlink", "parent-symlink", "hardlink", "mode", "parent-mode", "fifo", "oversized"]) {
  test(`${change} physical plist refuses before conversion`, () => fixture((home, texts) => {
    const file = path.join(home, "Library", "LaunchAgents", `${labels[0]}.plist`), outside = path.join(home, "retained");
    if (change === "symlink") { fs.renameSync(file, outside); fs.symlinkSync(outside, file); }
    if (change === "parent-symlink") { fs.renameSync(path.dirname(file), outside); fs.symlinkSync(outside, path.dirname(file)); }
    if (change === "hardlink") fs.linkSync(file, outside);
    if (change === "mode") fs.chmodSync(file, 0o666);
    if (change === "parent-mode") fs.chmodSync(path.dirname(file), 0o777);
    if (change === "fifo") { fs.unlinkSync(file); execFileSync("/usr/bin/mkfifo", [file]); }
    if (change === "oversized") fs.truncateSync(file, 1024 * 1024 + 1);
    const inode = fs.lstatSync(file).ino, result = observe(home, texts);
    assert.match(result.error, /DEPLOYMENT_CUTOVER_LAUNCHER_OBSERVATION_INVALID/);
    assert.equal(result.conversions, 0); assert.equal(fs.lstatSync(file).ino, inode);
  }));
}

for (const change of ["file", "parent", "bytes", "loaded"]) {
  test(`${change} drift during launcher bracket refuses without repairing replacement`, () => fixture((home, texts) => {
    const file = path.join(home, "Library", "LaunchAgents", `${labels[0]}.plist`), outside = path.join(home, "retained");
    const result = observe(home, texts, `
      const command = cp.spawnSync; let changed = false;
      cp.spawnSync = (...args) => {
        const result = command(...args);
        if (active && args[0] === "/bin/launchctl" && !changed) {
          changed = true; const kind = ${JSON.stringify(change)}, file = ${JSON.stringify(file)}, outside = ${JSON.stringify(outside)};
          if (kind === "file") { const bytes = fs.readFileSync(file); fs.renameSync(file,outside); fs.writeFileSync(file,bytes,{mode:0o600}); }
          if (kind === "parent") { fs.renameSync(${JSON.stringify(path.dirname(file))},outside); fs.mkdirSync(${JSON.stringify(path.dirname(file))}); }
          if (kind === "bytes") fs.appendFileSync(file,"\\n");
          if (kind === "loaded") texts[0] = texts[0].replace("not running","spawn scheduled");
        }
        return result;
      }; evidence = () => ({changed});
    `);
    assert.match(result.error, /DEPLOYMENT_CUTOVER_LAUNCHER_OBSERVATION_INVALID/);
    assert.equal(result.evidence.changed, true);
    if (change === "file" || change === "parent") assert.equal(fs.existsSync(outside), true);
    if (change === "parent") assert.deepEqual(fs.readdirSync(path.dirname(file)), []);
    if (change === "bytes") assert.ok(fs.readFileSync(file, "utf8").endsWith("\n\n"));
  }));
}

for (const boundary of ["launchctl", "plutil"]) {
  test(`${boundary} subprocess failures cannot expose secret-bearing causes or output`, () => fixture((home, texts) => {
    const result = observe(home, texts, `
      const command = cp.spawnSync;
      cp.spawnSync = (...args) => {
        if (args[0].endsWith(${JSON.stringify(boundary)})) {
          throw new Error(${JSON.stringify(secrets.join(" "))}, {cause:new Error("TOKEN_SENTINEL")});
        }
        return command(...args);
      };
    `);
    assert.match(result.error, /DEPLOYMENT_CUTOVER_LAUNCHER_OBSERVATION_INVALID/);
    for (const secret of secrets) assert.equal(result.error.includes(secret), false);
  }));
}

for (const change of ["unexpected-key", "interval", "log", "arguments", "environment-key"]) {
  test(`${change} durable plist refuses before launcher reads`, () => fixture((home, texts) => {
    const file = path.join(home, "Library", "LaunchAgents", `${labels[0]}.plist`);
    const parsed = JSON.parse(execFileSync("/usr/bin/plutil", ["-convert", "json", "-o", "-", file], { encoding: "utf8" }));
    if (change === "unexpected-key") parsed.KeepAlive = true;
    if (change === "interval") parsed.StartInterval = 1;
    if (change === "log") parsed.StandardOutPath = path.join(home, "wrong.log");
    if (change === "arguments") parsed.ProgramArguments.push("--unexpected");
    if (change === "environment-key") parsed.EnvironmentVariables.EXTRA = "unexpected";
    const bytes = execFileSync("/usr/bin/plutil", ["-convert", "xml1", "-o", "-", "-"], { input: JSON.stringify(parsed) });
    fs.writeFileSync(file, bytes);
    const result = observe(home, texts);
    assert.match(result.error, /DEPLOYMENT_CUTOVER_LAUNCHER_OBSERVATION_INVALID/);
    assert.equal(result.prints, 0); assert.deepEqual(fs.readFileSync(file), bytes);
  }));
}

for (const change of ["environment-duplicate", "block-duplicate", "envelope", "interval"]) {
  test(`${change} loaded launcher text refuses`, () => fixture((home, texts) => {
    if (change === "environment-duplicate") texts[0] = texts[0]!.replace("\t\tOSLogRateLimit => 64", "\t\tOSLogRateLimit => 64\n\t\tOSLogRateLimit => 64");
    if (change === "block-duplicate") texts[0] = texts[0]!.replace("\tproperties = runatload", "\targuments = {\n\t}\n\tproperties = runatload");
    if (change === "envelope") texts[0] = "crossed" + texts[0];
    if (change === "interval") texts[0] = texts[0]!.replace("60 seconds", "1 seconds");
    assert.match(observe(home, texts).error, /DEPLOYMENT_CUTOVER_LAUNCHER_OBSERVATION_INVALID/);
  }));
}

test("uncertain launcher descriptor close never closes a reused descriptor and prevents reobservation", () => fixture((home, texts) => {
  const sentinel = path.join(home, "sentinel"); fs.writeFileSync(sentinel, "sentinel");
  const result = observe(home, texts, `
    const close = fs.closeSync; let consumed = null, sentinelFd = null, attempts = 0;
    fs.closeSync = fd => {
      if (active && consumed === null) {
        consumed = fd; attempts++; close(fd);
        sentinelFd = fs.openSync(${JSON.stringify(sentinel)},"r");
        if (sentinelFd !== fd) throw Error("sentinel did not reuse descriptor");
        throw Error("close response lost TOKEN_SENTINEL");
      }
      if (fd === consumed) attempts++;
      return close(fd);
    };
    evidence = () => { let alive = false; try { alive = fs.fstatSync(sentinelFd).isFile(); } catch {}
      return {attempts,alive,reused:sentinelFd === consumed}; };
  `);
  assert.match(result.error, /DEPLOYMENT_CUTOVER_LAUNCHER_OBSERVATION_INVALID/);
  assert.match(result.retryError, /DEPLOYMENT_CUTOVER_LAUNCHER_OBSERVATION_INVALID/);
  assert.equal(result.error.includes("TOKEN_SENTINEL"), false);
  assert.deepEqual(result.evidence, { attempts: 1, alive: true, reused: true });
  assert.equal(result.prints, 4);
}));

for (const name of ["state", "active count"]) {
  test(`empty duplicate ${name} assignment is ambiguous and refuses`, () => fixture((home, texts) => {
    texts[0] = texts[0]!.replace("\ttype = LaunchAgent", `\t${name} = \n\ttype = LaunchAgent`);
    assert.match(observe(home, texts).error, /DEPLOYMENT_CUTOVER_LAUNCHER_OBSERVATION_INVALID/);
  }));
}
for (const boundary of ["launchctl", "plutil"]) {
  test(`${boundary} success carrying stderr refuses without exposing it`, () => fixture((home, texts) => {
    const result = observe(home, texts, `
      const command = cp.spawnSync;
      cp.spawnSync = (...args) => {
        const result = command(...args);
        return args[0].endsWith(${JSON.stringify(boundary)}) ? {...result,stderr:Buffer.from("TOKEN_SENTINEL")} : result;
      };
    `);
    assert.match(result.error, /DEPLOYMENT_CUTOVER_LAUNCHER_OBSERVATION_INVALID/);
    assert.equal(result.error.includes("TOKEN_SENTINEL"), false);
  }));
}
