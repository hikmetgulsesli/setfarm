import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

function fixture(body: (home: string, root: string) => void) {
  const home = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "cutover-helper-")));
  const baseline = path.join(home, "ai/setrox/data/internal-production-baseline"), root = path.join(baseline, "restart-authority-retirement-v1");
  fs.mkdirSync(baseline, { recursive: true, mode: 0o700 });
  try { body(home, root); } finally { fs.rmSync(home, { recursive: true, force: true }); }
}
function observe(home: string, fault = "") {
  const url = new URL("../../src/internal-production/baseline-deployment-cutover-helper-observation-v1.ts", import.meta.url);
  assert.ok(fs.existsSync(url), "production helper-history observer must exist");
  const child = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `
    import os from 'node:os';import fs from 'node:fs';import net from 'node:net';import cp from 'node:child_process';import{syncBuiltinESMExports}from'node:module';
    const identity=os.userInfo();os.userInfo=()=>({...identity,homedir:${JSON.stringify(home)}});os.homedir=()=>${JSON.stringify(home)};
    let active=false,writes=0,connections=0,effects=0,inspect=()=>null;const envBefore=JSON.stringify(process.env);
    for(const name of ['writeFileSync','mkdirSync','renameSync','unlinkSync','rmdirSync','linkSync','chmodSync','fsyncSync']){
      const original=fs[name];fs[name]=(...args)=>{if(active){writes++;throw Error('UNEXPECTED_WRITE')}return original(...args)};
    }
    const spawn=cp.spawn,spawnSync=cp.spawnSync,kill=process.kill;
    cp.spawn=(...args)=>{if(active){effects++;throw Error('UNEXPECTED_SPAWN')}return spawn(...args)};
    cp.spawnSync=(...args)=>{if(active){effects++;throw Error('UNEXPECTED_COMMAND')}return spawnSync(...args)};
    process.kill=(...args)=>{if(active){effects++;throw Error('UNEXPECTED_SIGNAL')}return kill(...args)};
    net.Socket.prototype.connect=()=>{connections++;throw Error('UNEXPECTED_CONNECTION')};
    ${fault}
    syncBuiltinESMExports();let run;
    try{const module=await import(${JSON.stringify(url.href)});run=module.observeDeploymentCutoverHelperHistoryV1;active=true;
      const observation=await run();const second=await run();
      const frozen=value=>!value||typeof value!=='object'||(Object.isFrozen(value)&&Object.values(value).every(frozen));
      process.stdout.write(JSON.stringify({observation,frozen:frozen(observation),stable:observation.observationHash===second.observationHash,
        writes,connections,effects,envUnchanged:JSON.stringify(process.env)===envBefore,evidence:inspect()}));
    }catch(error){process.stdout.write(JSON.stringify({error:error.message,writes,connections,effects,evidence:inspect()}));}
  `], { encoding: "utf8", env: {}, timeout: 15000 });
  assert.equal(child.status, 0, child.stderr); return JSON.parse(child.stdout);
}

test("absent real helper history is stable read-only evidence, not complete zero ownership", () => fixture((home, root) => {
  const result = observe(home);
  assert.equal(result.observation?.scope, "helper-history-only", JSON.stringify(result));
  assert.equal(result.observation.coldState, "absent"); assert.equal(result.observation.preSchemaHelperState, "absent");
  assert.equal(result.observation.registeredHelperCount, 0); assert.equal(result.observation.terminalHelperCount, 0);
  assert.deepEqual(result.observation.blockers, ["filesystem-phase-zero-owner-not-observed", "runtime-effective-environment-not-authenticated",
    "database-zero-owner-not-observed", "controller-ownership-not-acquired"]);
  assert.equal(result.frozen, true); assert.equal(result.stable, true); assert.equal(result.envUnchanged, true);
  assert.equal(result.writes, 0); assert.equal(result.connections, 0); assert.equal(result.effects, 0);
  assert.equal(fs.existsSync(root), false); assert.equal(Object.hasOwn(result.observation, "settlement"), false);
}));

for (const name of ["pre-schema-helper-journal.json", ".pre-schema-helper-journal.json.pending",
  "cold-spawner-bootstrap-v1", "cold-spawner-bootstrap-controller-settlement-v1.json", "direct-spawner-rebind-v1", "baseline-helper-registry-v1"]) {
  test(`partial ${name} never becomes settled helper evidence`, () => fixture((home, root) => {
    fs.mkdirSync(root, { mode: 0o700 }); const target = path.join(root, name);
    if (name.endsWith("-v1")) fs.mkdirSync(target, { mode: 0o700 }); else fs.writeFileSync(target, "{\"secret\":\"PRIVATE_HISTORY_CANARY\"}\n", { mode: 0o600 });
    if (name === "baseline-helper-registry-v1") fs.writeFileSync(path.join(target, "current-head.pair.json"), "{}\n", { mode: 0o600 });
    const before = fs.lstatSync(target, { bigint: true }), result = observe(home);
    assert.equal(result.error, "DEPLOYMENT_CUTOVER_HELPER_OBSERVATION_INVALID", JSON.stringify(result));
    assert.equal(result.writes, 0); assert.equal(result.connections, 0); assert.equal(result.effects, 0);
    assert.equal(fs.lstatSync(target, { bigint: true }).ino, before.ino);
    assert.equal(JSON.stringify(result).includes("PRIVATE_HISTORY_CANARY"), false);
  }));
}

for (const fault of ["unsafe-mode", "symlink"]) {
  test(`${fault} helper ancestry refuses without repair`, () => fixture((home, root) => {
    if (fault === "unsafe-mode") fs.mkdirSync(root, { mode: 0o755 });
    else fs.symlinkSync("missing-retirement-root", root);
    const result = observe(home);
    assert.equal(result.error, "DEPLOYMENT_CUTOVER_HELPER_OBSERVATION_INVALID"); assert.equal(result.writes, 0);
  }));
}

test("changed cold absence identity across helper observations refuses", () => fixture((home, root) => {
  const baseline = path.dirname(root);
  const result = observe(home, `const close=fs.closeSync,baselineInode=fs.lstatSync(${JSON.stringify(baseline)}).ino;let changed=false;
    fs.closeSync=fd=>{const matches=active&&!changed&&fs.fstatSync(fd).ino===baselineInode;const result=close(fd);
      if(matches){changed=true;active=false;try{fs.mkdirSync(${JSON.stringify(root)},{mode:0o700})}finally{active=true}}
      return result;
    };inspect=()=>({changed});`);
  assert.equal(result.error, "DEPLOYMENT_CUTOVER_HELPER_OBSERVATION_INVALID", JSON.stringify(result));
  assert.deepEqual(result.evidence, { changed: true }); assert.equal(result.writes, 0); assert.ok(fs.lstatSync(root).isDirectory());
}));

test("helper close response loss leaves a reused descriptor untouched", () => fixture((home, root) => {
  const sentinel = path.join(home, "sentinel"); fs.writeFileSync(sentinel, "foreign fd");
  const result = observe(home, `const close=fs.closeSync,baselineInode=fs.lstatSync(${JSON.stringify(path.dirname(root))}).ino;
    let selected=null,failed=false,attempts=0;
    fs.closeSync=fd=>{if(fd===selected)attempts++;
      if(active&&!failed&&fs.fstatSync(fd).ino===baselineInode){failed=true;selected=fd;attempts=1;close(fd);
        if(fs.openSync(${JSON.stringify(sentinel)},fs.constants.O_RDONLY)!==fd)throw Error('NO_FD_REUSE');throw Error('PRIVATE_CLOSE_LOSS');}
      return close(fd);
    };inspect=()=>({attempts,preserved:selected!==null&&fs.fstatSync(selected).ino===fs.lstatSync(${JSON.stringify(sentinel)}).ino});`);
  assert.equal(result.error, "DEPLOYMENT_CUTOVER_HELPER_OBSERVATION_INVALID");
  assert.deepEqual(result.evidence, { attempts: 1, preserved: true }); assert.equal(result.writes, 0);
}));
