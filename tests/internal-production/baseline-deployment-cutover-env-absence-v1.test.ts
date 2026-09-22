import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

type Paths = { home: string; selected: string; current: string; runtime: string; link: string; module: string };
function fixture(body: (paths: Paths) => void) {
  const home = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "cutover-env-absence-")));
  const workspace = path.join(home, "ai", "setrox"), selected = path.join(workspace, "deployments", "old"),
    current = path.join(workspace, "deployments", "new"), runtime = path.join(home, ".openclaw", "setfarm"),
    link = path.join(home, ".local", "bin", "setfarm"), module = path.join(current, "src", "internal-production", "baseline-deployment-cutover-env-absence-v1.ts");
  try {
    for (const dir of [path.join(selected, "dist", "cli"), path.dirname(module), path.dirname(link), runtime]) fs.mkdirSync(dir, { recursive: true, mode: 0o755 });
    const target = path.join(selected, "dist", "cli", "cli.js");
    fs.writeFileSync(target, "preserved cli\n", { mode: 0o644 }); fs.symlinkSync(target, link);
    const original = new URL("../../src/internal-production/baseline-deployment-cutover-env-absence-v1.ts", import.meta.url);
    assert.ok(fs.existsSync(original), "production default env absence observer must exist");
    let source = fs.readFileSync(original, "utf8");
    for (const [relative, actual] of [
      ["../product-compiler/canonical-json.js", "../../src/product-compiler/canonical-json.ts"],
      ["./baseline-deployment-cutover-cli-observation-v1.js", "../../src/internal-production/baseline-deployment-cutover-cli-observation-v1.ts"],
    ]) source = source.replace(JSON.stringify(relative), JSON.stringify(new URL(actual!, import.meta.url).href));
    fs.writeFileSync(module, source); fs.writeFileSync(path.join(current, "package.json"), '{"type":"module"}');
    body({ home, selected, current, runtime, link, module });
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
}
function observe(paths: Paths, fault = "", expression = "run()") {
  const child = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `
    import os from 'node:os';import fs from 'node:fs';import net from 'node:net';import {syncBuiltinESMExports}from'node:module';
    const identity=os.userInfo();os.userInfo=()=>({...identity,homedir:${JSON.stringify(paths.home)}});
    let active=false,writes=0,connections=0,inspect=()=>null;
    const envBefore=JSON.stringify(process.env);
    for(const name of ['writeFileSync','mkdirSync','renameSync','unlinkSync','rmdirSync','linkSync','chmodSync','fsyncSync']){
      const original=fs[name];fs[name]=(...args)=>{if(active){writes++;throw Error('UNEXPECTED_WRITE')}return original(...args)};
    }
    net.Socket.prototype.connect=()=>{connections++;throw Error('UNEXPECTED_CONNECTION')};
    ${fault}
    syncBuiltinESMExports();
    let run;
    try{
      const loaded=await import(${JSON.stringify(pathToFileURL(paths.module).href)});run=loaded.observeDeploymentCutoverDefaultEnvAbsenceV1;active=true;
      const observation=${expression};const second=run();
      const frozen=value=>!value||typeof value!=='object'||(Object.isFrozen(value)&&Object.values(value).every(frozen));
      process.stdout.write(JSON.stringify({observation,frozen:frozen(observation),stable:observation.observationHash===second.observationHash,
        writes,connections,envUnchanged:JSON.stringify(process.env)===envBefore,evidence:inspect()}));
    }catch(error){let retryError=null;if(run)try{run()}catch(retry){retryError=retry.message}
      process.stdout.write(JSON.stringify({error:error.message,retryError,writes,connections,evidence:inspect()}));}
  `], { encoding: "utf8", env: {}, timeout: 15000 });
  assert.equal(child.status, 0, child.stderr); return JSON.parse(child.stdout);
}

test("held env absence survives await and refuses recheck after close", () => fixture(paths => {
  const result = observe(paths, "", `await(async()=>{
    const held=loaded.holdDeploymentCutoverDefaultEnvAbsenceV1();
    if(!Object.isFrozen(held))throw Error('MUTABLE_CONTEXT');
    await Promise.resolve();held.recheck();held.close();held.close();
    let refused=false;try{held.recheck()}catch{refused=true}
    if(!refused)throw Error('CLOSED_CONTEXT_ACCEPTED');return held.observation;
  })()`);
  assert.equal(result.observation?.candidates.length, 6, JSON.stringify(result));
  assert.equal(result.stable, true); assert.equal(result.writes, 0); assert.equal(result.connections, 0);
}));

test("held env absence rejects caller-supplied qualification inputs", () => fixture(paths => {
  const result = observe(paths, "", `(()=>{
    let refused=false,held;
    try{held=loaded.holdDeploymentCutoverDefaultEnvAbsenceV1({accepted:true});}catch{refused=true}
    finally{if(held)held.close();}
    if(!refused)throw Error('CALLER_INPUT_ACCEPTED');return run();
  })()`);
  assert.equal(result.observation?.candidates.length, 6, JSON.stringify(result));
}));

for (const change of ["candidate-aba", "ancestor-replacement", "cli-replacement"]) {
  test(`held env absence refuses ${change} after await`, () => fixture(paths => {
    const result = observe(paths, `const pending=new Set(),open=fs.openSync,close=fs.closeSync;let opened=0;
      fs.openSync=(...args)=>{const fd=open(...args);if(active){pending.add(fd);opened++;}return fd;};
      fs.closeSync=fd=>{close(fd);pending.delete(fd);};`, `await(async()=>{
      const held=loaded.holdDeploymentCutoverDefaultEnvAbsenceV1();await Promise.resolve();
      const root=${JSON.stringify(paths.runtime)},link=${JSON.stringify(paths.link)};
      active=false;
      try{
        if(${JSON.stringify(change)}==='candidate-aba'){fs.writeFileSync(root+'/.env','CANARY');fs.unlinkSync(root+'/.env');}
        else if(${JSON.stringify(change)}==='ancestor-replacement'){fs.renameSync(root,root+'.preserved');fs.mkdirSync(root,{mode:0o755});}
        else{fs.renameSync(link,link+'.preserved');fs.symlinkSync('different',link);}
      }finally{active=true;}
      let recheckRefused=false,closeRefused=false,recheckError;
      try{held.recheck();}catch(error){recheckRefused=true;recheckError=error;}
      try{held.close();}catch{closeRefused=true;}
      inspect=()=>({recheckRefused,closeRefused,remaining:pending.size,opened});
      if(recheckError)throw recheckError;return held.observation;
    })()`);
    assert.equal(result.error, "DEPLOYMENT_CUTOVER_ENV_ABSENCE_INVALID", JSON.stringify(result));
    assert.equal(result.retryError, "DEPLOYMENT_CUTOVER_ENV_ABSENCE_INVALID");
    assert.equal(result.evidence.recheckRefused, true);
    assert.equal(result.evidence.closeRefused, false);
    assert.equal(result.evidence.remaining, 0); assert.ok(result.evidence.opened > 0);
    assert.equal(result.writes, 0); assert.equal(result.connections, 0);
  }));
}

test("default env candidate absence is physical, stable, read-only and not runtime authority", () => fixture(paths => {
  const result = observe(paths);
  assert.equal(result.observation?.schema, "setfarm.internal-production-deployment-cutover-default-env-absence.v1", JSON.stringify(result));
  assert.equal(result.observation.scope, "default-candidate-absence-only");
  assert.deepEqual(result.observation.candidates.map((entry: { path: string }) => entry.path),
    [paths.selected, paths.current, paths.runtime].flatMap(root => [path.join(root, ".env"), path.join(root, ".env.local")]));
  assert.deepEqual(result.observation.blockers, ["runtime-effective-environment-not-authenticated", "controller-ownership-not-acquired"]);
  assert.equal(result.frozen, true); assert.equal(result.stable, true); assert.equal(result.envUnchanged, true);
  assert.equal(result.writes, 0); assert.equal(result.connections, 0);
}));

for (const rootName of ["selected", "current", "runtime"] as const) for (const filename of [".env", ".env.local"]) {
  test(`present ${rootName}/${filename} refuses without reading or changing credentials`, () => fixture(paths => {
    const file = path.join(paths[rootName], filename), secret = "PRIVATE_ENV_CONTENT_CANARY";
    fs.writeFileSync(file, secret, { mode: 0o600 });
    const result = observe(paths, `let envReads=0;const inode=fs.lstatSync(${JSON.stringify(file)}).ino,read=fs.readFileSync,readFd=fs.readSync;
      fs.readFileSync=(target,...args)=>{if(String(target)===${JSON.stringify(file)}){envReads++;throw Error('ENV_FILE_READ')}return read(target,...args)};
      fs.readSync=(fd,...args)=>{if(active&&fs.fstatSync(fd).ino===inode){envReads++;throw Error('ENV_FD_READ')}return readFd(fd,...args)};
      inspect=()=>({envReads});`);
    assert.equal(result.error, "DEPLOYMENT_CUTOVER_ENV_ABSENCE_INVALID");
    assert.equal(JSON.stringify(result).includes(secret), false); assert.equal(fs.readFileSync(file, "utf8"), secret);
    assert.equal(result.writes, 0); assert.equal(result.connections, 0);
    assert.deepEqual(result.evidence, { envReads: 0 });
  }));
}

test("dangling env symlink is present evidence, not absence", () => fixture(paths => {
  const file = path.join(paths.selected, ".env"); fs.symlinkSync("missing-private-target", file);
  assert.equal(observe(paths).error, "DEPLOYMENT_CUTOVER_ENV_ABSENCE_INVALID");
  assert.equal(fs.readlinkSync(file), "missing-private-target");
}));

for (const missing of ["runtime", "openclaw"]) {
  test(`missing ${missing} directory uses its physical nearest ancestor without creation`, () => fixture(paths => {
    fs.rmdirSync(paths.runtime); if (missing === "openclaw") fs.rmdirSync(path.dirname(paths.runtime));
    const result = observe(paths), boundary = missing === "runtime" ? paths.runtime : path.dirname(paths.runtime);
    assert.equal(result.observation?.candidates.length, 6, JSON.stringify(result));
    for (const entry of result.observation.candidates.slice(4)) {
      assert.equal(entry.missingAt, boundary); assert.equal(entry.ancestorPath, path.dirname(boundary));
    }
    assert.equal(result.writes, 0); assert.equal(fs.existsSync(boundary), false);
  }));
}

for (const fault of ["parent-symlink", "parent-mode"]) {
  test(`${fault} refuses candidate traversal`, () => fixture(paths => {
    const parent = path.dirname(paths.runtime);
    if (fault === "parent-symlink") { const retained = path.join(paths.home, "retained-openclaw"); fs.renameSync(parent, retained); fs.symlinkSync(retained, parent); }
    else fs.chmodSync(parent, 0o777);
    assert.equal(observe(paths).error, "DEPLOYMENT_CUTOVER_ENV_ABSENCE_INVALID");
  }));
}

test("ambiguous candidate lstat never becomes absence", () => fixture(paths => {
  const file = path.join(paths.current, ".env");
  const result = observe(paths, `const stat=fs.lstatSync;fs.lstatSync=(target,...args)=>{if(active&&String(target)===${JSON.stringify(file)})throw Object.assign(Error('PRIVATE_PATH_ERROR'),{code:'EACCES'});return stat(target,...args)};`);
  assert.equal(result.error, "DEPLOYMENT_CUTOVER_ENV_ABSENCE_INVALID");
  assert.equal(JSON.stringify(result).includes("PRIVATE_PATH_ERROR"), false);
}));

test("foreign-owner candidate ancestor refuses without traversal", () => fixture(paths => {
  const result = observe(paths, `const stat=fs.lstatSync;fs.lstatSync=(target,...args)=>{
    const value=stat(target,...args);if(active&&String(target)===${JSON.stringify(paths.runtime)})value.uid=typeof value.uid==='bigint'?value.uid+1n:value.uid+1;return value;
  };`);
  assert.equal(result.error, "DEPLOYMENT_CUTOVER_ENV_ABSENCE_INVALID"); assert.equal(result.writes, 0);
}));

test("same-inode parent timestamp drift refuses even when the candidate stays absent", () => fixture(paths => {
  const file = path.join(paths.runtime, ".env"), sibling = path.join(paths.runtime, "transient-sibling");
  const before = fs.statSync(paths.runtime, { bigint: true });
  const result = observe(paths, `const stat=fs.lstatSync;let changed=false;
    fs.lstatSync=(target,...args)=>{try{return stat(target,...args)}catch(error){
      if(active&&!changed&&String(target)===${JSON.stringify(file)}&&error.code==='ENOENT'){
        changed=true;active=false;try{fs.writeFileSync(${JSON.stringify(sibling)},'transient');fs.unlinkSync(${JSON.stringify(sibling)});}finally{active=true;}
      }throw error;
    }};inspect=()=>({changed});`);
  assert.equal(result.error, "DEPLOYMENT_CUTOVER_ENV_ABSENCE_INVALID"); assert.deepEqual(result.evidence, { changed: true });
  assert.equal(fs.statSync(paths.runtime, { bigint: true }).ino, before.ino);
  assert.equal(fs.existsSync(file), false); assert.equal(fs.existsSync(sibling), false);
}));

for (const change of ["file-appearance", "parent-replacement", "cli-replacement"]) {
  test(`${change} after an absent observation is rejected without repair`, () => fixture(paths => {
    const file = path.join(paths.runtime, ".env"), retained = path.join(paths.home, "retained");
    const result = observe(paths, `
      const stat=fs.lstatSync;let changed=false;
      fs.lstatSync=(target,...args)=>{
        try{return stat(target,...args)}catch(error){
          if(active&&!changed&&String(target)===${JSON.stringify(file)}&&error.code==='ENOENT'){
            changed=true;active=false;
            try{
              const change=${JSON.stringify(change)};
              if(change==='file-appearance')fs.writeFileSync(${JSON.stringify(file)},'PRIVATE_APPEARANCE_CANARY',{mode:0o600});
              if(change==='parent-replacement'){fs.renameSync(${JSON.stringify(paths.runtime)},${JSON.stringify(retained)});fs.mkdirSync(${JSON.stringify(paths.runtime)},{mode:0o755});}
              if(change==='cli-replacement'){fs.renameSync(${JSON.stringify(paths.link)},${JSON.stringify(retained)});fs.symlinkSync('different-cli',${JSON.stringify(paths.link)});}
            }finally{active=true;}
          }
          throw error;
        }
      };inspect=()=>({changed});
    `);
    assert.equal(result.error, "DEPLOYMENT_CUTOVER_ENV_ABSENCE_INVALID", JSON.stringify(result));
    assert.deepEqual(result.evidence, { changed: true }); assert.equal(result.writes, 0);
    if (change === "file-appearance") assert.equal(fs.readFileSync(file, "utf8"), "PRIVATE_APPEARANCE_CANARY");
    else assert.ok(fs.lstatSync(retained));
  }));
}

for (const mode of ["snapshot", "held"]) test(`uncertain env-directory ${mode} close consumes its fd once and refuses retry`, () => fixture(paths => {
  const sentinel = path.join(paths.home, "sentinel"); fs.writeFileSync(sentinel, "preserved descriptor");
  const result = observe(paths, `
    const open=fs.openSync,close=fs.closeSync;let selected=null,failed=false,attempts=0;
    fs.openSync=(target,...args)=>{const fd=open(target,...args);if(active&&String(target)===${JSON.stringify(paths.current)})selected=fd;return fd};
    fs.closeSync=fd=>{
      if(fd===selected){attempts++;if(!failed){failed=true;close(fd);if(open(${JSON.stringify(sentinel)},fs.constants.O_RDONLY)!==fd)throw Error('NO_FD_REUSE');throw Error('PRIVATE_CLOSE_RESPONSE_LOSS');}}
      return close(fd);
    };
    inspect=()=>({attempts,preserved:selected!==null&&fs.fstatSync(selected).ino===fs.lstatSync(${JSON.stringify(sentinel)}).ino});
  `, mode === "snapshot" ? undefined : `(()=>{
    const held=loaded.holdDeploymentCutoverDefaultEnvAbsenceV1();
    try{held.close();}finally{held.close();let refused=false;try{held.recheck()}catch{refused=true}
      if(!refused)throw Error('CLOSED_CONTEXT_ACCEPTED');}
    return held.observation;
  })()`);
  assert.equal(result.error, "DEPLOYMENT_CUTOVER_ENV_ABSENCE_INVALID");
  assert.equal(result.retryError, "DEPLOYMENT_CUTOVER_ENV_ABSENCE_INVALID");
  assert.deepEqual(result.evidence, { attempts: 1, preserved: true });
}));
