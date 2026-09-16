import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";

function observe(fault = ""): any {
  const url = new URL("../../src/internal-production/baseline-deployment-cutover-process-observation-v1.ts", import.meta.url).href;
  const child = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `
    import cp from "node:child_process"; import fs from "node:fs";
    import {syncBuiltinESMExports} from "node:module"; import {inspect} from "node:util";
    const node = fs.realpathSync(process.execPath), uid = process.getuid();
    const row = (pid, command, ppid=1, pgid=pid, birth="Wed Sep 16 01:02:03 2026") => uid+" "+pid+" "+ppid+" "+pgid+" S "+birth+" "+command+"\\n";
    let rows = () => row(process.pid,node+" /fixture/observer.mjs",process.ppid,process.pid)
      + row(4101,node+" /fixture/old/dist/spawner.js")
      + row(4102,node+" /fixture/new/dist/spawner.js")
      + row(4103,node+" /fixture/old/dist/server/daemon.js 3333")
      + row(4104,"/usr/bin/unrelated --token UNRELATED_SECRET");
    let listener = Buffer.from("p4103\\0cnode\\0\\nf21\\0n127.0.0.1:3333\\0\\n");
    let scans = 0, listens = 0, transform = (command,result) => result;
    const executables = {4101:node,4102:node,4103:node};
    ${fault}
    cp.spawnSync = (command,args,options) => {
      let stdout;
      if(command === "/bin/ps" && JSON.stringify(args) === JSON.stringify(["-ww","-axo","uid=,pid=,ppid=,pgid=,stat=,lstart=,command="])) { scans++; stdout=Buffer.from(rows()); }
      else if(command === "/bin/ps" && args.length===5 && args[0]==="-ww" && args[1]==="-p" && args[3]==="-o" && args[4]==="comm=" && [4101,4102,4103].includes(Number(args[2]))) stdout=Buffer.from(executables[args[2]]+"\\n");
      else if(command === "/usr/sbin/lsof" && JSON.stringify(args)===JSON.stringify(["-nP","-iTCP:3333","-sTCP:LISTEN","-F0pcfn"])) {listens++; stdout=listener;}
      else throw Error("unexpected process observation command");
      return transform(command,{status:command==="/usr/sbin/lsof" && stdout.length===0 ? 1 : 0,signal:null,stdout,stderr:Buffer.alloc(0)});
    };
    syncBuiltinESMExports();
    try { const module = await import(${JSON.stringify(url)}); const observation = module.observeDeploymentCutoverProcessFamiliesV1();
      process.stdout.write(JSON.stringify({observation,frozen:Object.isFrozen(observation)&&Object.isFrozen(observation.families),scans,listens}));
    } catch(error) {process.stdout.write(JSON.stringify({error:inspect(error,{depth:null}),scans,listens}));}
  `], { encoding: "utf8", env: {}, timeout: 10000 });
  assert.equal(child.status, 0, child.stderr); return JSON.parse(child.stdout);
}

test("old dashboard may use its own observed Node executable rather than the controller Node", () => {
  const result = observe(`const original=rows; rows=()=>original().replace(node+" /fixture/old/dist/server/daemon.js", "/fixture/node22/bin/node /fixture/old/dist/server/daemon.js"); executables[4103]="/fixture/node22/bin/node";`);
  assert.equal(result.observation?.families[2].executable, "/fixture/node22/bin/node", JSON.stringify(result));
});

test("claimed daemon executable cannot disagree with observed comm", () => {
  assert.match(observe(`executables[4103]="/fixture/foreign/bin/node";`).error, /DEPLOYMENT_CUTOVER_PROCESS_OBSERVATION_INVALID/);
});

test("unrelated process turnover does not invalidate the family bracket", () => {
  const result = observe(`const original=rows; rows=()=>original()+(scans>1?row(4106,"/usr/bin/unrelated --token DIFFERENT_SECRET"):"");`);
  assert.equal(result.observation?.families.length, 3, JSON.stringify(result));
  assert.equal(JSON.stringify(result).includes("DIFFERENT_SECRET"), false);
});

test("empty global families and port report diagnostic absence without synthesizing authority", () => {
  const result = observe(`rows=()=>row(process.pid,node+" /fixture/observer.mjs",process.ppid,process.pid); listener=Buffer.alloc(0);`);
  assert.deepEqual(result.observation?.families, [], JSON.stringify(result));
  assert.equal(result.observation.listener, null);
});

for (const change of ["disappeared", "wrong-parent", "zombie", "truncated", "ipv6-listener", "duplicate-listener", "malformed-utf8", "stderr", "failure"]) {
  test(`${change} process evidence refuses without secret disclosure`, () => {
    const fault = change === "disappeared" ? `const original=rows; rows=()=>scans>1?original().split("\\n").filter(line=>!line.includes("/fixture/new/dist/spawner.js")).join("\\n"):original();`
      : change === "wrong-parent" ? `const original=rows; rows=()=>original().replace("4101 1 4101", "4101 99 4101");`
      : change === "zombie" ? `const original=rows; rows=()=>original().replace("4101 S ", "4101 Z ");`
      : change === "truncated" ? `const original=rows; rows=()=>original().slice(0,-1);`
      : change === "ipv6-listener" ? `listener=Buffer.from("p4103\\0cnode\\0\\nf21\\0n[::1]:3333\\0\\n");`
      : change === "duplicate-listener" ? `listener=Buffer.concat([listener,listener]);`
      : change === "malformed-utf8" ? `transform=(command,result)=>({...result,stdout:Buffer.from([255,10])});`
      : change === "stderr" ? `transform=(command,result)=>({...result,stderr:Buffer.from("UNRELATED_SECRET")});`
      : `transform=()=>{throw Error("UNRELATED_SECRET",{cause:Error("UNRELATED_SECRET")});};`;
    const result = observe(fault);
    assert.match(result.error, /DEPLOYMENT_CUTOVER_PROCESS_OBSERVATION_INVALID/);
    assert.equal(result.error.includes("UNRELATED_SECRET"), false);
  });
}

for (const entry of ["dist/server/daemon.js", "/old/src/server/daemon.ts"]) {
  test(`${entry} dashboard without a listener cannot disappear from family evidence`, () => {
    const result = observe(`rows=()=>row(process.pid,node+" /fixture/observer.mjs",process.ppid,process.pid)+row(4103,node+" "+${JSON.stringify(entry)}+" 3333"); listener=Buffer.alloc(0);`);
    assert.match(result.error, /DEPLOYMENT_CUTOVER_PROCESS_OBSERVATION_INVALID/);
  });
}

test("global cutover observation retains old and new daemon families and hides unrelated arguments", () => {
  const result = observe();
  assert.equal(result.observation?.families.length, 3, JSON.stringify(result));
  assert.deepEqual(result.observation.families.map((row: any) => row.checkoutPath), ["/fixture/old", "/fixture/new", "/fixture/old"]);
  assert.equal(result.observation.listener.pid, 4103);
  assert.equal(JSON.stringify(result).includes("UNRELATED_SECRET"), false);
  assert.equal(result.frozen, true); assert.equal(result.scans, 2); assert.equal(result.listens, 2);
});

for (const entry of ["/unrelated/cli.js", "cli.ts", "/unrelated/bin/cli.mjs", "/unrelated/cli.cjs",
  "/unrelated/spawner.js", "spawner.ts", "/unrelated/server/daemon.js", "server/daemon.ts"]) {
  test(`${entry} with dashboard or spawner arguments is not a Setfarm starter`, () => {
    const result = observe(`const original=rows; rows=()=>original()+row(4105,node+" "+${JSON.stringify(entry)}+" dashboard spawner UNRELATED_SECRET",4100,4100);`);
    assert.equal(result.observation?.families.length, 3, JSON.stringify(result));
    assert.equal(JSON.stringify(result).includes("UNRELATED_SECRET"), false);
  });
}

for (const entry of ["/fixture/new/dist/cli/cli.js", "dist/cli/cli.js", "./dist/cli/cli.js",
  "/fixture/old/src/cli/cli.ts", "src/cli/cli.ts", "./src/cli/cli.ts", "setfarm", "/fixture/.local/bin/setfarm"]) {
  for (const command of ["spawner", "dashboard"]) {
    test(`${entry} ${command} starter remains in the global family diagnostic`, () => {
      const result = observe(`const original=rows; rows=()=>original()+row(4105,node+" "+${JSON.stringify(entry)}+" "+${JSON.stringify(command)}+" start",4100,4100);`);
      assert.equal(result.observation?.families.length, 4, JSON.stringify(result));
      assert.equal(result.observation.families[3].classification, `${command}-cli-starter`);
    });
  }
}

for (const change of ["late-family", "reused", "missing-observer", "duplicate-pid", "foreign-listener", "wildcard-listener"]) {
  test(`${change} global process bracket refuses`, () => {
    const fault = change === "late-family" ? `const original=rows; rows=()=>original()+(scans>1?row(4105,node+" /fixture/old/dist/spawner.js"):"");`
      : change === "reused" ? `const original=rows; rows=()=>{ const lines=original().split("\\n"); if(scans>1) lines[1]=lines[1].replace("01:02:03","01:02:04"); return lines.join("\\n"); };`
      : change === "missing-observer" ? `const original=rows; rows=()=>original().split("\\n").slice(1).join("\\n");`
      : change === "duplicate-pid" ? `const original=rows; rows=()=>original()+row(4101,node+" /fixture/old/dist/spawner.js");`
      : change === "foreign-listener" ? `listener=Buffer.from("p4104\\0cforeign\\0\\nf21\\0n127.0.0.1:3333\\0\\n");`
      : `listener=Buffer.from("p4103\\0cnode\\0\\nf21\\0n*:3333\\0\\n");`;
    assert.match(observe(fault).error, /DEPLOYMENT_CUTOVER_PROCESS_OBSERVATION_INVALID/);
  });
}
