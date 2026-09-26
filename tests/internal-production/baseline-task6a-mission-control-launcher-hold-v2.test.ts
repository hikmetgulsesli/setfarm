import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

const sourceUrl = new URL("../../src/internal-production/baseline-task6a-mission-control-launcher-hold-v2.ts", import.meta.url);
const ERROR = "INTERNAL_PRODUCTION_TASK6A_MISSION_CONTROL_LAUNCHER_INVALID";
const LABEL = "com.setrox.mission-control";

function fixture(options: { password?: string | null; token?: string; fault?: string; action?: string;
  plistFault?: "extra-env" | "remote-url" | "empty-token" | "not-keepalive" | "world-readable" } = {}) {
  const home = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "task6a-mc-hold-")));
  const password = options.password === undefined ? "PRIVATE_PASSWORD_ONE" : options.password;
  const token = options.token ?? "PRIVATE_TOKEN_ONE";
  const databaseUrl = `postgresql://fixture${password === null ? "" : `:${password}`}@localhost:5432/setfarm`;
  const missionRoot = path.join(home, "ai", "setrox", "mission-control");
  const directory = path.join(home, "Library", "LaunchAgents");
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  fs.mkdirSync(missionRoot, { recursive: true, mode: 0o700 });
  const plistPath = path.join(directory, `${LABEL}.plist`);
  const program = process.execPath;
  const args = [program, path.join(missionRoot, "dist-server", "index.js")];
  const environment = {
    CLI_PATH: path.join(home, ".local", "bin"), MC_HOST: "0.0.0.0", MC_INTERNAL_URL: "http://127.0.0.1:3080",
    MC_PORT: "3080", PATH: "/opt/homebrew/opt/node/bin:/usr/bin:/bin",
    PROJECTS_DIR: path.join(home, "projects"), PROJECTS_JSON: path.join(home, "projects", "mission-control", "projects.json"),
    SETFARM_DIR: path.join(home, ".openclaw", "setfarm"), SETFARM_OPERATIONAL_WRITE_TOKEN: token,
    SETFARM_PG_URL: databaseUrl, SETFARM_REPO_DIR: path.join(home, "ai", "setrox", "setfarm"),
    SETFARM_URL: "http://127.0.0.1:3333",
  };
  const plist = { EnvironmentVariables: environment, KeepAlive: true, Label: LABEL,
    ProgramArguments: args, RunAtLoad: true,
    StandardErrorPath: path.join(home, ".openclaw", "logs", "mission-control.err.log"),
    StandardOutPath: path.join(home, ".openclaw", "logs", "mission-control.out.log"), WorkingDirectory: missionRoot };
  if (options.plistFault === "extra-env") (environment as Record<string, string>).EXTRA = "not-allowed";
  if (options.plistFault === "remote-url") environment.SETFARM_PG_URL = "postgresql://fixture:PRIVATE_PASSWORD@remote.invalid/setfarm";
  if (options.plistFault === "empty-token") environment.SETFARM_OPERATIONAL_WRITE_TOKEN = "";
  if (options.plistFault === "not-keepalive") plist.KeepAlive = false;
  fs.writeFileSync(plistPath, execFileSync("/usr/bin/plutil", ["-convert", "xml1", "-o", "-", "-"],
    { input: JSON.stringify(plist) }), { mode: 0o600 });
  if (options.plistFault === "world-readable") fs.chmodSync(plistPath, 0o644);
  const block = (name: string, lines: string[]) => `\t${name} = {\n${lines.map(line => `\t\t${line}\n`).join("")}\t}\n`;
  const loaded = { ...environment, OSLogRateLimit: "64", XPC_SERVICE_NAME: LABEL };
  const launchctl = `gui/${process.getuid!()}/${LABEL} = {\n\tpath = ${plistPath}\n\tprogram = ${program}\n\tstate = running\n\tpid = 12345\n\tactive count = 1\n\ttype = LaunchAgent\n\tproperties = keepalive | runatload\n\tworking directory = ${missionRoot}\n\tstdout path = ${plist.StandardOutPath}\n\tstderr path = ${plist.StandardErrorPath}\n`
    + block("arguments", args) + block("environment", Object.entries(loaded).map(([key, value]) => `${key} => ${value}`)) + "}\n";
  try {
    const child = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `
      import os from 'node:os';import fs from 'node:fs';import cp from 'node:child_process';
      import {syncBuiltinESMExports,registerHooks} from 'node:module';
      let imports=[];registerHooks({resolve(specifier,context,next){if(specifier==='postgres'||/db-pg|runtime-config/.test(specifier))imports.push(specifier);return next(specifier,context)}});
      const identity=os.userInfo();os.userInfo=()=>({...identity,homedir:${JSON.stringify(home)}});
      const native=cp.spawnSync;let calls=0,launchctl=${JSON.stringify(launchctl)},plistPath=${JSON.stringify(plistPath)};
      cp.spawnSync=(command,args,options)=>{if(command==='/bin/launchctl'){
        calls++;return {status:0,signal:null,stdout:Buffer.from(launchctl),stderr:Buffer.alloc(0)};
      }return native(command,args,options)};syncBuiltinESMExports();
      const module=await import(${JSON.stringify(sourceUrl.href)});const importCalls=calls,importLoads=[...imports];
      let observation,error,role,afterClose,otherError,frozen;
      try{${options.fault ?? ""}
        const held=module.holdTask6aMissionControlLauncherV2();
        try{${options.action ?? `role=held.assertSameDatabaseUrl(${JSON.stringify(databaseUrl)});held.recheck();observation=held.observation;frozen=Object.isFrozen(observation);`}}
        catch(caught){otherError=caught.message}finally{held.close();held.close()}
        try{held.recheck()}catch(caught){afterClose=caught.message}
      }catch(caught){error=caught.message}
      process.stdout.write(JSON.stringify({observation,error,otherError,afterClose,role,frozen,importCalls,importLoads,calls}));
    `], { encoding: "utf8", timeout: 15000, env: {} });
    assert.equal(child.status, 0, child.stderr);
    const result = JSON.parse(child.stdout);
    assert.doesNotMatch(JSON.stringify(result), /PRIVATE_PASSWORD|PRIVATE_TOKEN|OTHER_SECRET/);
    return result;
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
}

test("Mission Control holder is import-inert and produces only a public frozen diagnostic", () => {
  const observed = fixture();
  assert.equal(observed.error, undefined);
  assert.equal(observed.otherError, undefined);
  assert.equal(observed.importCalls, 0);
  assert.deepEqual(observed.importLoads, []);
  assert.equal(observed.role, "fixture");
  assert.equal(observed.frozen, true);
  assert.equal(observed.afterClose, ERROR);
  assert.deepEqual(Object.keys(observed.observation).sort(),
    ["activeCount", "authority", "cutoverAdmission", "databaseRole", "label", "physicalIdentityProvenance", "schema", "state", "observationHash"].sort());
  assert.equal(observed.observation.authority, "diagnostic-only");
  assert.equal(observed.observation.cutoverAdmission, "not-granted");
  assert.equal(observed.observation.physicalIdentityProvenance, "unverified");
  assert.equal(observed.observation.state, "running");
  assert.equal(observed.observation.activeCount, 1);
  assert.match(observed.observation.observationHash, /^[a-f0-9]{64}$/);
});

test("public observation does not commit to private password or token bytes", () => {
  assert.deepEqual(fixture().observation,
    fixture({ password: "PRIVATE_PASSWORD_TWO", token: "PRIVATE_TOKEN_TWO" }).observation);
  assert.deepEqual(fixture().observation, fixture({ password: null }).observation);
});

test("holder rejects nonzero input before accessing the OS", () => {
  const child = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `
    const module=await import(${JSON.stringify(sourceUrl.href)});let error;
    try{module.holdTask6aMissionControlLauncherV2(undefined)}catch(caught){error=caught.message}
    process.stdout.write(JSON.stringify({error}));
  `], { encoding: "utf8", timeout: 15000, env: {} });
  assert.equal(child.status, 0, child.stderr);
  assert.deepEqual(JSON.parse(child.stdout), { error: ERROR });
});

for (const plistFault of ["extra-env", "remote-url", "empty-token", "not-keepalive", "world-readable"] as const) {
  test(`holder rejects ${plistFault} plist`, () => {
    const result = fixture({ plistFault });
    assert.equal(result.error, ERROR);
    assert.equal(result.observation, undefined);
  });
}

for (const [name, fault] of [
  ["stopped", `launchctl=launchctl.replace('state = running','state = not running')`],
  ["second active", `launchctl=launchctl.replace('active count = 1','active count = 2')`],
  ["bad pid", `launchctl=launchctl.replace('pid = 12345','pid = 0')`],
  ["loaded without keepalive", `launchctl=launchctl.replace('properties = keepalive | runatload','properties = runatload')`],
  ["loaded without runatload", `launchctl=launchctl.replace('properties = keepalive | runatload','properties = keepalive')`],
  ["crossed loaded URL", `launchctl=launchctl.replace('SETFARM_PG_URL => postgresql://fixture:PRIVATE_PASSWORD_ONE@localhost:5432/setfarm','SETFARM_PG_URL => postgresql://fixture:OTHER_SECRET@localhost:5432/setfarm')`],
  ["crossed loaded token", `launchctl=launchctl.replace('SETFARM_OPERATIONAL_WRITE_TOKEN => PRIVATE_TOKEN_ONE','SETFARM_OPERATIONAL_WRITE_TOKEN => OTHER_SECRET')`],
] as const) {
  test(`holder refuses ${name} without private output`, () => {
    const result = fixture({ fault });
    assert.equal(result.error, ERROR);
    assert.equal(result.observation, undefined);
  });
}

test("holder refuses mismatched private URL and changed plist bytes", () => {
  const wrong = fixture({ action: `held.assertSameDatabaseUrl('postgresql://fixture:OTHER_SECRET@localhost/setfarm')` });
  assert.equal(wrong.otherError, ERROR);
  const drift = fixture({ action: `fs.appendFileSync(plistPath,'\\n');held.recheck()` });
  assert.equal(drift.otherError, ERROR);
});

for (const [name, action] of [
  ["loaded PID", `launchctl=launchctl.replace('pid = 12345','pid = 12346');held.recheck()`],
  ["loaded state", `launchctl=launchctl.replace('state = running','state = not running');held.recheck()`],
  ["loaded database URL", `launchctl=launchctl.replace('SETFARM_PG_URL => postgresql://fixture:PRIVATE_PASSWORD_ONE@localhost:5432/setfarm','SETFARM_PG_URL => postgresql://fixture:OTHER_SECRET@localhost:5432/setfarm');held.recheck()`],
  ["plist mode", `fs.chmodSync(plistPath,0o644);held.recheck()`],
] as const) {
  test(`held recheck refuses changed ${name}`, () => {
    const result = fixture({ action });
    assert.equal(result.otherError, ERROR);
  });
}

test("a failed recheck irreversibly invalidates the held interval after loaded state returns", () => {
  const result = fixture({ action: `
    const original=launchctl;
    launchctl=launchctl.replace('pid = 12345','pid = 12346');
    let firstFailed=false;try{held.recheck()}catch{firstFailed=true}
    if(!firstFailed)throw Error('FIRST_RECHECK_DID_NOT_FAIL');
    launchctl=original;held.recheck();
  ` });
  assert.equal(result.otherError, ERROR);
});

test("a failed private URL agreement irreversibly invalidates the holder", () => {
  const result = fixture({ action: `
    let firstFailed=false;try{held.assertSameDatabaseUrl('postgresql://fixture:OTHER_SECRET@localhost:5432/setfarm')}catch{firstFailed=true}
    if(!firstFailed)throw Error('FIRST_AGREEMENT_DID_NOT_FAIL');
    held.assertSameDatabaseUrl(${JSON.stringify("postgresql://fixture:PRIVATE_PASSWORD_ONE@localhost:5432/setfarm")});
  ` });
  assert.equal(result.otherError, ERROR);
});
