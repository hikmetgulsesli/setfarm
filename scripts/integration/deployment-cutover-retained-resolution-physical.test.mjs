import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { write } from "../__tests__/fixtures/deployment-cutover-bootstrap.mjs";
import { retainedFixture as inventoryFixture } from "../__tests__/fixtures/deployment-cutover-retained-profile.mjs";

const retainedFixture = (body, options = {}) => inventoryFixture(body, { ...options, resolution: true });

test("held retained profile resolves reviewed ESM/CJS edges without evaluating throwing targets", () => retainedFixture(({ observe }) => {
  const result = observe("", `await (async()=>{
    const held=module.holdDeploymentCutoverRetainedProfileV1();
    const resolution=held.resolveModules();await Promise.resolve();held.recheck();held.close();return resolution;
  })()`);
  assert.equal(result.status, 0, result.stderr);
  const observed = JSON.parse(result.stdout);
  assert.equal(observed.scope, "reviewed-selected-startup-resolution-only");
  assert.deepEqual(observed.contexts.map(item => item.home), ["absent", "account"]);
  for (const context of observed.contexts) assert.deepEqual(context.targets, [
    "node_modules/reviewed-fixture/index.js", "node_modules/reviewed-fixture/index.js", null,
  ]);
}));

test("held resolver honors distinct import and require exports without evaluating either", () => retainedFixture(({ observe }) => {
  const result = observe("", `(()=>{const held=module.holdDeploymentCutoverRetainedProfileV1();try{return held.resolveModules()}finally{held.close()}})()`);
  assert.equal(result.status, 0, result.stderr);
  for (const context of JSON.parse(result.stdout).contexts) assert.deepEqual(context.targets, [
    "node_modules/reviewed-fixture/index.js", "node_modules/reviewed-fixture/require.cjs", null,
  ]);
}, { conditional: true }));

test("held resolver rejects an optional global shadow without evaluating its canary", () => retainedFixture(({ home, observe }) => {
  write(home, ".node_modules/reviewed-absent-optional.js", 'throw Error("GLOBAL_CANARY_MUST_NOT_EXECUTE");');
  const result = observe("", `(()=>{const held=module.holdDeploymentCutoverRetainedProfileV1();try{return held.resolveModules()}finally{try{held.close()}catch{}}})()`);
  assert.equal(result.status, 1); assert.equal(result.stderr, "DEPLOYMENT_CUTOVER_RETAINED_PROFILE_INVALID");
}));

test("held resolver rejects a declared nearer package shadow after inventory succeeds", () => retainedFixture(({ observe }) => {
  const result = observe("", `(()=>{
    const held=module.holdDeploymentCutoverRetainedProfileV1();let refused=false;
    try{held.resolveModules()}catch{refused=true}finally{try{held.close()}catch{}}
    return Object.freeze({inventorySucceeded:true,resolutionRefused:refused});
  })()`);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { inventorySucceeded: true, resolutionRefused: true });
}, { nearerShadow: true }));

for (const fault of ["global-appearance", "global-aba", "package-replacement"]) {
  test(`held resolution refuses ${fault} after await and drains descriptors`, () => retainedFixture(({ home, selected, observe }) => {
    const result = observe(`const pending=new Set(),open=fs.openSync,close=fs.closeSync;
      fs.openSync=(...args)=>{const fd=open(...args);pending.add(fd);return fd};fs.closeSync=fd=>{close(fd);pending.delete(fd)};`, `await(async()=>{
      const held=module.holdDeploymentCutoverRetainedProfileV1();held.resolveModules();await Promise.resolve();
      if(${JSON.stringify(fault)}==='package-replacement'){
        const file=${JSON.stringify(path.join(selected, "node_modules/reviewed-fixture/index.js"))},bytes=fs.readFileSync(file);
        fs.renameSync(file,file+'.saved');fs.writeFileSync(file,bytes);
      }else{
        const directory=${JSON.stringify(path.join(home, ".node_modules"))};fs.mkdirSync(directory);
        if(${JSON.stringify(fault)}==='global-aba')fs.rmdirSync(directory);
      }
      let refused=false;try{held.recheck()}catch{refused=true}finally{try{held.close()}catch{}}
      return Object.freeze({refused,remaining:pending.size});
    })()`);
    assert.equal(result.status, 0, result.stderr); assert.deepEqual(JSON.parse(result.stdout), { refused: true, remaining: 0 });
  }));
}

test("held resolution rejects caller inputs, repeated resolution and closed contexts", () => retainedFixture(({ observe }) => {
  const result = observe("", `(()=>{
    const held=module.holdDeploymentCutoverRetainedProfileV1();let supplied=false,repeated=false,closed=false;
    try{held.resolveModules({HOME:'/caller'})}catch{supplied=true}
    held.resolveModules();try{held.resolveModules()}catch{repeated=true}held.close();
    try{held.resolveModules()}catch{closed=true}
    return Object.freeze({supplied,repeated,closed});
  })()`);
  assert.equal(result.status, 0, result.stderr); assert.deepEqual(JSON.parse(result.stdout), { supplied: true, repeated: true, closed: true });
}));

test("held resolver rejects distinct but authenticated wrong export target", () => retainedFixture(({ root, expectedProfile, observe }) => {
  expectedProfile.startupResolution[0][3] = "node_modules/reviewed-fixture/require.cjs";
  write(root, "scripts/deployment-cutover-retained-profile.v1.json", JSON.stringify(expectedProfile));
  const result = observe("", `(()=>{const held=module.holdDeploymentCutoverRetainedProfileV1();try{return held.resolveModules()}finally{try{held.close()}catch{}}})()`);
  assert.equal(result.status, 1); assert.equal(result.stderr, "DEPLOYMENT_CUTOVER_RETAINED_PROFILE_INVALID");
}, { conditional: true }));

test("held resolver rejects lookup drift during actual resolver child and drains pins", () => retainedFixture(({ home, observe }) => {
  const result = observe(`const cp=await import('node:child_process'),spawn=cp.default.spawnSync,open=fs.openSync,close=fs.closeSync,pending=new Set();
    fs.openSync=(...args)=>{const fd=open(...args);pending.add(fd);return fd};fs.closeSync=fd=>{close(fd);pending.delete(fd)};
    let changed=false;cp.default.spawnSync=(file,args,options)=>{
      const result=spawn(file,args,options);
      if(args.includes('--experimental-import-meta-resolve')&&JSON.parse(options.input).phase==='resolve'&&!changed){
        changed=true;fs.mkdirSync(${JSON.stringify(path.join(home, ".node_modules"))});
      }return result;
    };`, `(()=>{
    const held=module.holdDeploymentCutoverRetainedProfileV1();let refused=false;
    try{held.resolveModules()}catch{refused=true}finally{try{held.close()}catch{}}
    return Object.freeze({refused,changed,remaining:pending.size});
  })()`);
  assert.equal(result.status, 0, result.stderr); assert.deepEqual(JSON.parse(result.stdout), { refused: true, changed: true, remaining: 0 });
}));

for (const fault of ["untracked-parent", "untracked-target", "duplicate", "unknown-mode", "excessive-edges"]) {
  test(`held resolver rejects ${fault} profile table`, () => retainedFixture(({ root, expectedProfile, observe }) => {
    const table = expectedProfile.startupResolution;
    if (fault === "untracked-parent") table[0][1] = "dist/unknown.js";
    if (fault === "untracked-target") table[0][3] = "node_modules/reviewed-fixture/unknown.js";
    if (fault === "duplicate") table.push([...table[0]]);
    if (fault === "unknown-mode") table[0][0] = "caller-loader";
    if (fault === "excessive-edges") expectedProfile.startupResolution = Array(65).fill(table[0]);
    write(root, "scripts/deployment-cutover-retained-profile.v1.json", JSON.stringify(expectedProfile));
    const result = observe("", `(()=>{const held=module.holdDeploymentCutoverRetainedProfileV1();try{return held.resolveModules()}finally{try{held.close()}catch{}}})()`);
    assert.equal(result.status, 1); assert.equal(result.stderr, "DEPLOYMENT_CUTOVER_RETAINED_PROFILE_INVALID");
  }));
}

for (const fault of ["wrong-target", "stderr", "timeout"]) {
  test(`held resolver rejects ${fault} child evidence`, () => retainedFixture(({ observe }) => {
    const result = observe(`const cp=await import('node:child_process'),spawn=cp.default.spawnSync;
      cp.default.spawnSync=(file,args,options)=>{
        if(!args.includes('--experimental-import-meta-resolve')||JSON.parse(options.input).phase!=='resolve')return spawn(file,args,options);
        const result=spawn(file,args,options);
        if(${JSON.stringify(fault)}==='wrong-target')return {...result,stdout:'[null,null,null]'};
        if(${JSON.stringify(fault)}==='stderr')return {...result,stderr:'PRIVATE_CHILD_DIAGNOSTIC'};
        return {...result,error:Object.assign(Error('PRIVATE_TIMEOUT'),{code:'ETIMEDOUT'})};
      };`, `(()=>{const held=module.holdDeploymentCutoverRetainedProfileV1();try{return held.resolveModules()}finally{try{held.close()}catch{}}})()`);
    assert.equal(result.status, 1); assert.equal(result.stderr, "DEPLOYMENT_CUTOVER_RETAINED_PROFILE_INVALID");
  }));
}
