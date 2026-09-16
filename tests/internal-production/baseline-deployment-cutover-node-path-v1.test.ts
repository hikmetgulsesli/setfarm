import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { homedir } from "node:os";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

const moduleUrl = new URL("../../src/internal-production/baseline-deployment-cutover-node-path-v1.ts", import.meta.url).href;
function fixture(body: string) {
  const root = fs.mkdtempSync(path.join(fs.realpathSync(homedir()), ".cutover-node-test-"));
  try {
    const earlier = path.join(root, "earlier"), selected = path.join(root, "selected");
    fs.mkdirSync(earlier, { mode: 0o700 });
    fs.symlinkSync(path.dirname(fs.realpathSync(process.execPath)), selected);
    const result = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `
      import fs from 'node:fs'; import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
      const root=${JSON.stringify(root)}, earlier=${JSON.stringify(earlier)}, selected=${JSON.stringify(selected)};
      const module=await import(${JSON.stringify(moduleUrl)}).catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e});
      assert.equal(typeof module.holdDeploymentCutoverNodePathV1,'function','held Node/PATH qualifier must exist');
      const hold=module.holdDeploymentCutoverNodePathV1;
      ${body}
    `], { encoding: "utf8", timeout: 20000, maxBuffer: 1024 * 1024 });
    assert.equal(result.status, 0, result.stderr);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
}

test("Node PATH holds actual directory-symlink selection across await", () => fixture(`
  const held=hold(earlier+':'+selected);
  assert.ok(Object.isFrozen(held)); assert.ok(Object.isFrozen(held.observation));
  assert.equal(held.observation.candidatePath, selected+'/node');
  assert.equal(held.observation.executablePath, fs.realpathSync(process.execPath));
  assert.match(held.observation.executableHash,/^[a-f0-9]{64}$/);
  await Promise.resolve(); held.recheck(); held.close(); held.close();
  assert.throws(()=>held.recheck(), /DEPLOYMENT_CUTOVER_NODE_PATH_INVALID/);
`));

for (const mutation of ["earlier-appearance", "earlier-aba", "directory-link-replacement"]) {
  test(`Node PATH rejects ${mutation} on held recheck`, () => fixture(`
    const held=hold(earlier+':'+selected); await Promise.resolve();
    if(${JSON.stringify(mutation)}==='directory-link-replacement'){
      const target=fs.readlinkSync(selected); fs.renameSync(selected,selected+'.saved'); fs.symlinkSync(target,selected);
    } else {
      fs.writeFileSync(earlier+'/node','#!/bin/sh\\nexit 99\\n',{mode:0o700});
      if(${JSON.stringify(mutation)}==='earlier-aba')fs.unlinkSync(earlier+'/node');
    }
    assert.throws(()=>held.recheck(), /DEPLOYMENT_CUTOVER_NODE_PATH_INVALID/);
    held.close();
  `));
}

test("Node PATH never skips or executes an earlier foreign executable", () => fixture(`
  fs.writeFileSync(earlier+'/node','#!/bin/sh\\ntouch '+root+'/EXECUTED\\n',{mode:0o700});
  assert.throws(()=>hold(earlier+':'+selected), /DEPLOYMENT_CUTOVER_NODE_PATH_INVALID/);
  assert.equal(fs.existsSync(root+'/EXECUTED'),false);
`));

test("Node PATH rejects empty relative and noncanonical search entries", () => fixture(`
  for(const input of ['', ':'+selected, selected+':', '.', selected+'/../selected', selected+'\\n'])
    assert.throws(()=>hold(input), /DEPLOYMENT_CUTOVER_NODE_PATH_INVALID/);
`));

test("Node PATH does not lexically collapse dotdot across a directory symlink", () => fixture(`
  fs.mkdirSync(root+'/package'); fs.mkdirSync(root+'/outside'); fs.mkdirSync(root+'/outside/child');
  fs.symlinkSync(root+'/outside/child',root+'/package/branch');
  fs.symlinkSync(fs.realpathSync(process.execPath),root+'/package/node');
  fs.writeFileSync(root+'/outside/node','#!/bin/sh\\nexit 99\\n',{mode:0o700});
  fs.mkdirSync(root+'/ambiguous'); fs.symlinkSync('../package/branch/../node',root+'/ambiguous/node');
  assert.equal(fs.realpathSync.native(root+'/ambiguous/node'),root+'/outside/node');
  assert.throws(()=>hold(root+'/ambiguous'), /DEPLOYMENT_CUTOVER_NODE_PATH_INVALID/);
`));

test("Node PATH drains descriptors and refuses reuse after close response loss", () => fixture(`
  const originalOpen=fs.openSync, originalClose=fs.closeSync, pending=new Set(); let lost=false,reused,lostFd;
  fs.openSync=(...args)=>{const fd=originalOpen(...args);pending.add(fd);return fd};
  fs.closeSync=fd=>{
    originalClose(fd); pending.delete(fd);
    if(!lost){lost=true;lostFd=fd;reused=originalOpen(root+'/earlier',fs.constants.O_RDONLY);throw Error('PRIVATE_CLOSE_FAILURE')}
  };
  const held=hold(earlier+':'+selected);
  assert.ok(pending.size>0);
  assert.throws(()=>held.close(),/DEPLOYMENT_CUTOVER_NODE_PATH_INVALID/);
  assert.equal(pending.size,0);assert.equal(reused,lostFd); assert.ok(fs.fstatSync(reused).isDirectory());
  held.close(); assert.ok(fs.fstatSync(reused).isDirectory());
  assert.throws(()=>held.recheck(),/DEPLOYMENT_CUTOVER_NODE_PATH_INVALID/);
  assert.throws(()=>hold(selected),/DEPLOYMENT_CUTOVER_NODE_PATH_INVALID/);
  originalClose(reused);
`));

test("Node PATH failed acquisition closes all descriptors", () => fixture(`
  const originalOpen=fs.openSync,originalClose=fs.closeSync,pending=new Set();let count=0;
  fs.openSync=(...args)=>{const fd=originalOpen(...args);pending.add(fd);count++;return fd};
  fs.closeSync=fd=>{originalClose(fd);pending.delete(fd)};
  fs.writeFileSync(earlier+'/node','invalid executable',{mode:0o700});
  assert.throws(()=>hold(earlier+':'+selected),/DEPLOYMENT_CUTOVER_NODE_PATH_INVALID/);
  assert.ok(count>0); assert.equal(pending.size,0);
`));

test("Node PATH detects same-target file symlink replacement", () => fixture(`
  fs.symlinkSync(fs.realpathSync(process.execPath),earlier+'/node');
  const held=hold(earlier);await Promise.resolve();
  fs.renameSync(earlier+'/node',earlier+'/saved');
  fs.symlinkSync(fs.realpathSync(process.execPath),earlier+'/node');
  assert.throws(()=>held.recheck(),/DEPLOYMENT_CUTOVER_NODE_PATH_INVALID/);held.close();
`));

test("Node PATH retains nearest existing parent for a missing search directory", () => fixture(`
  const held=hold(earlier+'/missing/deep:'+selected);await Promise.resolve();
  fs.mkdirSync(earlier+'/missing');fs.rmdirSync(earlier+'/missing');
  assert.throws(()=>held.recheck(),/DEPLOYMENT_CUTOVER_NODE_PATH_INVALID/);held.close();
`));

test("Node PATH rejects unsafe directory ownership modes", () => fixture(`
  fs.chmodSync(earlier,0o777);
  assert.throws(()=>hold(earlier+':'+selected),/DEPLOYMENT_CUTOVER_NODE_PATH_INVALID/);
`));

test("Node PATH bounds cyclic links and excessive search entries", () => fixture(`
  fs.symlinkSync('node',earlier+'/node');
  assert.throws(()=>hold(earlier+':'+selected),/DEPLOYMENT_CUTOVER_NODE_PATH_INVALID/);
  assert.throws(()=>hold(Array(33).fill(selected).join(':')),/DEPLOYMENT_CUTOVER_NODE_PATH_INVALID/);
`));

test("Node PATH detects held executable metadata drift without touching trusted binary", () => fixture(`
  const held=hold(selected),fstat=fs.fstatSync;
  fs.fstatSync=(fd,options)=>{const stat=fstat(fd,options);return stat.isFile() && options?.bigint ?
    Object.assign(Object.create(Object.getPrototypeOf(stat)),stat,{ino:stat.ino+1n}):stat};
  assert.throws(()=>held.recheck(),/DEPLOYMENT_CUTOVER_NODE_PATH_INVALID/);held.close();
`));

test("Node PATH rejects OS execute-access denial for the trusted candidate", () => fixture(`
  const access=fs.accessSync;
  fs.accessSync=(file,mode)=>{if(mode & fs.constants.X_OK)throw Object.assign(Error('PRIVATE_ACCESS_DENIED'),{code:'EACCES'});return access(file,mode)};
  assert.throws(()=>hold(selected),/DEPLOYMENT_CUTOVER_NODE_PATH_INVALID/);
`));

test("Node PATH rechecks OS execute access on the original held candidate", () => fixture(`
  const held=hold(selected);
  fs.accessSync=()=>{throw Object.assign(Error('PRIVATE_ACCESS_DENIED'),{code:'EACCES'})};
  assert.throws(()=>held.recheck(),/DEPLOYMENT_CUTOVER_NODE_PATH_INVALID/);held.close();
`));

test("Node PATH hashes complete bytes with legal short reads", () => fixture(`
  const expected=createHash('sha256').update(fs.readFileSync(process.execPath)).digest('hex'),read=fs.readSync;
  fs.readSync=(fd,buffer,offset,length,position)=>read(fd,buffer,offset,Math.min(length,97),position);
  const held=hold(selected);assert.equal(held.observation.executableHash,expected);held.close();
`));

test("Node PATH drains original descriptors after a failed held recheck", () => fixture(`
  const open=fs.openSync,close=fs.closeSync,pending=new Set();
  fs.openSync=(...args)=>{const fd=open(...args);pending.add(fd);return fd};
  fs.closeSync=fd=>{close(fd);pending.delete(fd)};
  const held=hold(earlier+':'+selected); assert.ok(pending.size>0);
  fs.writeFileSync(earlier+'/node','not executed',{mode:0o700});
  assert.throws(()=>held.recheck(),/DEPLOYMENT_CUTOVER_NODE_PATH_INVALID/);held.close();
  assert.equal(pending.size,0);
`));

test("Node PATH refuses mismatched real and effective group credentials", () => fixture(`
  const gid=process.getgid();process.getegid=()=>gid+1;
  assert.throws(()=>hold(selected),/DEPLOYMENT_CUTOVER_NODE_PATH_INVALID/);
`));

test("Node PATH refuses group credential drift across held lifetime", () => fixture(`
  const held=hold(selected),gid=process.getgid();process.getgid=()=>gid+1;process.getegid=()=>gid+1;
  assert.throws(()=>held.recheck(),/DEPLOYMENT_CUTOVER_NODE_PATH_INVALID/);held.close();
`));
