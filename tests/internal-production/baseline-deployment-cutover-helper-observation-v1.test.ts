import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";

function fixture(body: (home: string, root: string) => void) {
  const home = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "cutover-helper-")));
  const baseline = path.join(home, "ai/setrox/data/internal-production-baseline"), root = path.join(baseline, "restart-authority-retirement-v1");
  fs.mkdirSync(baseline, { recursive: true, mode: 0o700 });
  try { body(home, root); } finally { fs.rmSync(home, { recursive: true, force: true }); }
}
function observe(home: string, fault = "", exercise?: string) {
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
      ${exercise ? `run=module.holdDeploymentCutoverAbsentHelperHistoryV1;${exercise}` : "const observation=await run();const second=await run();"}
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

test("held absent history remains read-only until consumed", () => fixture((home) => {
  const result = observe(home, "", `const held=await run();held.recheck();const observation=held.observation;
    held.close();held.close();let consumed=false;try{held.recheck()}catch{consumed=true}
    if(!consumed)throw Error('NOT_CONSUMED');const second=observation;`);
  assert.equal(result.error, undefined, JSON.stringify(result));
  assert.equal(result.observation.accountHome, home);
  assert.equal(result.observation.coldState, "absent");
  const { observationHash, ...body } = result.observation;
  assert.equal(observationHash, hashCanonicalJson(body));
  assert.equal(result.frozen, true); assert.equal(result.writes, 0); assert.equal(result.effects, 0);
}));

for (const aba of [false, true]) test(`held history rejects root appearance${aba ? " and removal" : ""} permanently`, () => fixture((home, root) => {
  const result = observe(home, "", `const held=await run();active=false;
    fs.mkdirSync(${JSON.stringify(root)},{mode:0o700});${aba ? `fs.rmdirSync(${JSON.stringify(root)});` : ""}active=true;
    let refused=false;try{held.recheck()}catch{refused=true}held.close();
    if(!refused)throw Error('DRIFT_ACCEPTED');throw Error('EXPECTED_DRIFT');`);
  assert.equal(result.error, "EXPECTED_DRIFT", JSON.stringify(result));
  assert.equal(result.writes, 0);
}));

test("held history refuses caller input", () => fixture((home) => {
  const result = observe(home, "", "await run({root:'/tmp'});throw Error('INPUT_ACCEPTED');");
  assert.equal(result.error, "DEPLOYMENT_CUTOVER_HELPER_OBSERVATION_INVALID");
}));

test("held history refuses any existing retirement directory", () => fixture((home, root) => {
  fs.mkdirSync(root, { mode: 0o700 });
  const result = observe(home, "", "await run();throw Error('PRESENT_ACCEPTED');");
  assert.equal(result.error, "DEPLOYMENT_CUTOVER_HELPER_OBSERVATION_INVALID");
}));

for (const mutation of ["mode", "replacement", "symlink"]) test(`held history rejects nearest ancestor ${mutation}`, () => fixture((home, root) => {
  const parent = path.dirname(root);
  const result = observe(home, "", `const held=await run();active=false;
    ${mutation === "mode" ? `fs.chmodSync(${JSON.stringify(parent)},0o777);` : `fs.renameSync(${JSON.stringify(parent)},${JSON.stringify(parent + "-old")});
    ${mutation === "symlink" ? `fs.symlinkSync(${JSON.stringify(parent + "-old")},${JSON.stringify(parent)});` : `fs.mkdirSync(${JSON.stringify(parent)},{mode:0o700});`}`}
    active=true;let refused=false;try{held.recheck()}catch{refused=true}held.close();
    if(!refused)throw Error('DRIFT_ACCEPTED');throw Error('EXPECTED_DRIFT');`);
  assert.equal(result.error, "EXPECTED_DRIFT", JSON.stringify(result));
}));

test("held close loss poisons acquisition without retrying a reused descriptor", () => fixture((home, root) => {
  const sentinel = path.join(home, "sentinel"); fs.writeFileSync(sentinel, "foreign fd");
  const result = observe(home, `let armed=false,failed=false,selected=null,attempts=0;const close=fs.closeSync;
    fs.closeSync=fd=>{if(fd===selected)attempts++;if(armed&&!failed){failed=true;selected=fd;attempts=1;close(fd);
      if(fs.openSync(${JSON.stringify(sentinel)},fs.constants.O_RDONLY)!==fd)throw Error('NO_REUSE');throw Error('PRIVATE_CLOSE_LOSS')}return close(fd)};
    inspect=()=>({attempts,preserved:fs.fstatSync(selected).ino===fs.lstatSync(${JSON.stringify(sentinel)}).ino});`,
    `const held=await run();armed=true;let provenance=false;try{held.close()}catch(e){provenance=e.cutoverCleanupFailed===true}held.close();
    let poisoned=false;try{await run()}catch{poisoned=true}if(!provenance||!poisoned)throw Error('UNSAFE_CLOSE');throw Error('EXPECTED_CLOSE_LOSS');`);
  assert.equal(result.error, "EXPECTED_CLOSE_LOSS", JSON.stringify(result));
  assert.deepEqual(result.evidence, { attempts: 1, preserved: true });
}));

test("held acquisition does not misclassify access denial as absence", () => fixture((home, root) => {
  const result = observe(home, `const stat=fs.lstatSync;fs.lstatSync=(target,...rest)=>{
    if(active&&target===${JSON.stringify(root)})throw Object.assign(Error('PRIVATE_ACCESS'),{code:'EACCES'});return stat(target,...rest)};`,
    "await run();throw Error('DENIAL_ACCEPTED');");
  assert.equal(result.error, "DEPLOYMENT_CUTOVER_HELPER_OBSERVATION_INVALID");
}));

test("held history refuses restored ancestor ABA above the nearest parent", () => fixture((home) => {
  const ancestor = path.join(home, "ai/setrox");
  const result = observe(home, "", `const held=await run();active=false;
    fs.renameSync(${JSON.stringify(ancestor)},${JSON.stringify(ancestor + "-old")});
    fs.mkdirSync(${JSON.stringify(ancestor)},{mode:0o700});fs.rmdirSync(${JSON.stringify(ancestor)});
    fs.renameSync(${JSON.stringify(ancestor + "-old")},${JSON.stringify(ancestor)});active=true;
    let refused=false;try{held.recheck()}catch{refused=true}held.close();
    if(!refused)throw Error('ANCESTOR_ABA_ACCEPTED');throw Error('EXPECTED_DRIFT');`);
  assert.equal(result.error, "EXPECTED_DRIFT", JSON.stringify(result));
}));

test("opaque census close loss stays unknown and fences holder reacquisition", () => fixture((home, root) => {
  const sentinel = path.join(home, "sentinel"); fs.writeFileSync(sentinel, "foreign fd");
  const result = observe(home, `const close=fs.closeSync,baselineInode=fs.lstatSync(${JSON.stringify(path.dirname(root))}).ino;
    let selected=null,failed=false,attempts=0;
    fs.closeSync=fd=>{if(fd===selected)attempts++;if(active&&!failed&&fs.fstatSync(fd).ino===baselineInode){failed=true;selected=fd;attempts=1;close(fd);
      if(fs.openSync(${JSON.stringify(sentinel)},fs.constants.O_RDONLY)!==fd)throw Error('NO_FD_REUSE');throw Error('PRIVATE_CLOSE_LOSS')}return close(fd)};
    inspect=()=>({attempts,preserved:fs.fstatSync(selected).ino===fs.lstatSync(${JSON.stringify(sentinel)}).ino});`,
    `for(let i=0;i<2;i++){let refused=false;try{await run()}catch(e){refused=Object.hasOwn(e,'cutoverCleanupFailed')&&e.cutoverCleanupFailed===null}
      if(!refused)throw Error('UNKNOWN_NOT_PRESERVED')}
    throw Error('EXPECTED_UNKNOWN');`);
  assert.equal(result.error, "EXPECTED_UNKNOWN", JSON.stringify(result));
  assert.deepEqual(result.evidence, { attempts: 1, preserved: true });
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
