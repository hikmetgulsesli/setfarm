import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { pathToFileURL } from "node:url";

const sourceUrl = new URL("../../src/internal-production/baseline-task6a-held-receipt-host-v1.ts", import.meta.url);

test("code-owned held receipt host is import-inert", () => {
  const result = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `
    import net from 'node:net';
    import { registerHooks, syncBuiltinESMExports } from 'node:module';
    let loads=0,connections=0;
    registerHooks({resolve(specifier,context,next){if(specifier==='postgres')loads++;return next(specifier,context)}});
    net.Socket.prototype.connect=()=>{connections++;throw Error('UNEXPECTED_CONNECTION')};
    syncBuiltinESMExports();
    const module=await import(${JSON.stringify(sourceUrl.href)});
    process.stdout.write(JSON.stringify({exports:Object.keys(module),loads,connections}));
  `], { encoding: "utf8", timeout: 15000, env: {} });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {
    exports: ["observeCodeOwnedTask6aHeldReceiptCandidateV1"], loads: 0, connections: 0,
  });
});

test("code-owned held receipt host qualifies, calls one path-only method and closes both holders", () => {
  const temporary = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "setfarm-held-receipt-host-"));
  try {
    const fake = path.join(temporary, "holders.mjs");
    fs.writeFileSync(fake, `
      export function holdDeploymentCutoverDefaultLauncherV1(){
        globalThis.events.push('setfarm-acquire');
        return {observation:{launchers:[{label:'com.setrox.setfarm-spawner'},
          {label:globalThis.scenario==='labels'?'wrong':'com.setrox.setfarm-dashboard'}]},
          async qualifyPassiveHome(){globalThis.events.push('qualify');if(globalThis.scenario==='qualify')throw Error('PRIVATE_TOKEN')},
          recheck(){globalThis.events.push('setfarm-recheck')},
          async observeTask6aHeldReceiptCandidateV1(mc,root){
            globalThis.events.push('receipt');
            if(mc.brand!==true||root!=='/tmp/projects/story/.worktrees/story-1')throw Error('CROSSED_INPUT');
            if(globalThis.scenario==='receipt')throw Error('PRIVATE_TOKEN');
            return Object.freeze({authority:'diagnostic-only',receiptStatus:'required-unpublished',
              physicalIdentityProvenance:'unverified',producerAuthentication:'unverified'});
          },close(){globalThis.events.push('setfarm-close');if(globalThis.scenario==='close')throw Error('PRIVATE_TOKEN')}
        };
      }
      export function holdTask6aMissionControlLauncherV2(){
        globalThis.events.push('mc-acquire');
        if(globalThis.scenario==='acquire')throw Error('PRIVATE_TOKEN');
        return {brand:true,recheck(){globalThis.events.push('mc-recheck')},close(){globalThis.events.push('mc-close')}};
      }
    `);
    const source = fs.readFileSync(sourceUrl, "utf8")
      .replace('await import("./baseline-deployment-cutover-launcher-observation-v1.js")',
        `await import(${JSON.stringify(pathToFileURL(fake).href)})`)
      .replace('await import("./baseline-task6a-mission-control-launcher-hold-v2.js")',
        `await import(${JSON.stringify(pathToFileURL(fake).href)})`);
    assert.equal(source.includes('await import("./baseline-deployment-cutover-launcher-observation-v1.js")'), false);
    assert.equal(source.includes('await import("./baseline-task6a-mission-control-launcher-hold-v2.js")'), false);
    const copy = path.join(temporary, "host.ts");
    fs.writeFileSync(copy, source);
    const result = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `
      const module=await import(${JSON.stringify(pathToFileURL(copy).href)});
      const outputs=[];
      for(const scenario of ['success','qualify','receipt','labels','acquire','close']){
        globalThis.scenario=scenario;globalThis.events=[];
        let output,error;
        try{output=await module.observeCodeOwnedTask6aHeldReceiptCandidateV1('/tmp/projects/story/.worktrees/story-1')}
        catch(caught){error=caught.message}
        outputs.push({scenario,output,error,events:globalThis.events});
      }
      process.stdout.write(JSON.stringify(outputs));
    `], { encoding: "utf8", timeout: 15000, env: {} });
    assert.equal(result.status, 0, result.stderr);
    const outputs = JSON.parse(result.stdout);
    assert.deepEqual(outputs[0], { scenario: "success",
      output: { authority: "diagnostic-only", receiptStatus: "required-unpublished",
        physicalIdentityProvenance: "unverified", producerAuthentication: "unverified" },
      events: ["setfarm-acquire", "mc-acquire", "qualify", "setfarm-recheck", "mc-recheck",
        "receipt", "setfarm-recheck", "mc-recheck", "mc-close", "setfarm-close"] });
    for (const failed of outputs.slice(1)) {
      assert.equal(failed.error, "INTERNAL_PRODUCTION_TASK6A_HELD_RECEIPT_HOST_INVALID");
      assert.equal(failed.events.at(-1), "setfarm-close");
      if (failed.scenario !== "acquire") assert.equal(failed.events.at(-2), "mc-close");
    }
    assert.doesNotMatch(result.stdout, /PRIVATE_TOKEN|PG_SENTINEL/);
  } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
});
