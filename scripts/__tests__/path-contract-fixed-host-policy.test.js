import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdirSync,mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';

const POLICY_BYTES=readFileSync(new URL('../../src/installation/manual-orphan-fixed-host-policy-v1.json',import.meta.url));
const CHECKER=fileURLToPath(new URL('../check-path-contract.mjs',import.meta.url));
function fixedPolicy(){
  assert.equal(POLICY_BYTES.length,318);
  assert.equal(createHash('sha256').update(POLICY_BYTES).digest('hex'),
    '4b7ed03bf755ec453e0c7a79d3fcf4f4f4fee387dc9bf551d55e41e7b2281dc5');
  return JSON.parse(POLICY_BYTES.toString('utf8'));
}
function runChecker(file,source){
  const root=mkdtempSync(path.join(tmpdir(),'setfarm-path-contract-'));
  try{
    const destination=path.join(root,file);mkdirSync(path.dirname(destination),{recursive:true});
    writeFileSync(destination,source);
    const config=path.join(root,'src/installation/manual-orphan-fixed-host-policy-v1.json');
    mkdirSync(path.dirname(config),{recursive:true});writeFileSync(config,POLICY_BYTES);
    const result=spawnSync(process.execPath,[CHECKER],{cwd:root,encoding:'utf8',timeout:5000,maxBuffer:65536,
      env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C'}});
    assert.equal(result.error,undefined);assert.equal(result.signal,null);
    return result;
  }finally{rmSync(root,{recursive:true,force:true});}
}
function rejectsLiteral(directory){
  const file=directory+'/forbidden.mjs';
  const source='const forbidden = '+JSON.stringify(fixedPolicy().home) + ';\n';
  const result=runChecker(file,source);
  assert.equal(result.status,1);assert.equal(result.stdout,'');
  assert.ok(result.stderr.startsWith('Setfarm path contract failed:'));
  assert.ok(result.stderr.includes('- '+file+':1: '+source.trim()));
}

// Break: silently updating a configuration value would retarget a fixed-host guard.
test('Task7 path contract pins exact fixed-host configuration bytes and schema',()=>{
  const policy=fixedPolicy();
  assert.deepEqual(Object.keys(policy),['schema','home','workspace','releases','path']);
  assert.equal(policy.schema,'setfarm.manual-orphan-fixed-host-policy.v1');
  assert.ok(Object.values(policy).every(value=>typeof value==='string'));
  assert.equal(policy.workspace,path.join(policy.home,'ai','setrox'));
  assert.equal(policy.releases,path.join(policy.workspace,'releases'));
  assert.deepEqual(policy.path.split(':'),['/opt/homebrew/Cellar/node/26.4.0/bin',
    path.join(policy.home,'.local','bin'),'/opt/homebrew/bin','/usr/local/bin','/usr/bin','/bin','/usr/sbin','/sbin']);
});
test('Task7 path contract accepts explicit configured roots without a checker exception',()=>{
  fixedPolicy();const result=runChecker('scripts/configured.mjs','const workspace = fixedHostPolicy.workspace;\n');
  assert.equal(result.status,0);assert.equal(result.stderr,'');
  assert.equal(result.stdout,'Setfarm path contract OK: 1 files\n');
});
test('Task7 path contract still rejects a host literal in src',()=>rejectsLiteral('src'));
test('Task7 path contract still rejects a host literal in scripts',()=>rejectsLiteral('scripts'));
test('Task7 path contract still rejects a host literal in landing',()=>rejectsLiteral('landing'));
