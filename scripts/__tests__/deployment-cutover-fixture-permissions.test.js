import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";

// Mutation caught: publishing fixture dist directories without the real stock
// writer's 0755 finalization makes the genuine selected-build owner refuse.
for (const mask of [0o077, 0o022]) {
  test(`retained fixture authenticates finalized output under umask ${mask.toString(8)}`, () => {
    const result = spawnSync(process.execPath, ["--input-type=module", "--eval", `
      import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
      process.umask(${mask});
      const {retainedFixture}=await import('./scripts/__tests__/fixtures/deployment-cutover-retained-profile.mjs');
      retainedFixture(({root,selected,home,observe})=>{
        const original=observe();assert.equal(original.status,0,original.stderr);
        assert.equal(original.signal,null);const observation=JSON.parse(original.stdout);
        const modes=[];function visit(directory){
          const stat=fs.lstatSync(directory);assert.ok(stat.isDirectory()&&!stat.isSymbolicLink());
          modes.push(stat.mode&0o7777);
          for(const name of fs.readdirSync(directory)){
            const child=path.join(directory,name);if(fs.lstatSync(child).isDirectory())visit(child);
          }
        }
        visit(path.join(root,'dist'));visit(path.join(selected,'dist'));
        console.log(JSON.stringify({scope:observation.scope,homeMode:fs.lstatSync(home).mode&0o7777,modes}));
      });
    `], {
      cwd: new URL("../../", import.meta.url), encoding: "utf8", timeout: 30000,
      env: { PATH: `${path.dirname(process.execPath)}:/usr/bin:/bin`, LANG: "C", LC_ALL: "C", TMPDIR: tmpdir() },
    });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.signal, null);
    const evidence = JSON.parse(result.stdout.split("\n").find(line => line.startsWith("{")));
    assert.equal(evidence.scope, "retained-startup-byte-inventory-only");
    assert.equal(evidence.homeMode, 0o700);
    assert.ok(evidence.modes.length >= 8);
    assert.ok(evidence.modes.every(mode => mode === 0o755), JSON.stringify(evidence));
  });
}

test("fixture output finalization refuses symlinks without changing their target", () => {
  const result = spawnSync(process.execPath, ["--input-type=module", "--eval", `
    import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import os from 'node:os';
    process.umask(0o077);
    const {fixture}=await import('./scripts/__tests__/fixtures/deployment-cutover-bootstrap.mjs');
    const sentinel=fs.mkdtempSync(path.join(os.tmpdir(),'cutover-permissions-sentinel-'));
    try{
      const before=fs.lstatSync(sentinel,{bigint:true});let called=false;
      assert.throws(()=>fixture(()=>{called=true},source=>source,{prepare(root){
        fs.mkdirSync(path.join(root,'dist'),{recursive:true});
        fs.symlinkSync(sentinel,path.join(root,'dist','escape'));
      }}),/fixture output must not contain symlinks/);
      assert.equal(called,false);const after=fs.lstatSync(sentinel,{bigint:true});
      for(const key of ['dev','ino','uid','gid','mode','nlink','size','mtimeNs','ctimeNs'])assert.equal(after[key],before[key],key);
    }finally{fs.rmSync(sentinel,{recursive:true,force:true})}
  `], {
    cwd: new URL("../../", import.meta.url), encoding: "utf8", timeout: 30000,
    env: { PATH: `${path.dirname(process.execPath)}:/usr/bin:/bin`, LANG: "C", LC_ALL: "C", TMPDIR: tmpdir() },
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.signal, null);
});
