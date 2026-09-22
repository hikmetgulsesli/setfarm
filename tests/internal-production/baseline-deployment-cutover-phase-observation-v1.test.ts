import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";

type Fixture = { home: string; current: string; selected: string; runtime: string; module: string };
const receipt = "internal-production/baseline-post-handoff-receipt-v1";
function fixture(body: (value: Fixture) => void) {
  const source = new URL("../../src/internal-production/baseline-deployment-cutover-phase-observation-v1.ts", import.meta.url);
  assert.ok(fs.existsSync(source), "production held phase observer must exist");
  const home = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "cutover-phase-")));
  const current = path.join(home, "ai/setrox/deployments/new"), selected = path.join(home, "ai/setrox/deployments/old");
  const runtime = path.join(home, ".openclaw/setfarm/internal-production");
  const module = path.join(current, "src/internal-production/baseline-deployment-cutover-phase-observation-v1.ts");
  try {
    for (const base of [current, selected]) {
      for (const dir of ["src/internal-production", "dist/internal-production", "dist/cli"]) fs.mkdirSync(path.join(base, dir), { recursive: true, mode: 0o700 });
      for (const [dir, extension] of [["src", "ts"], ["dist", "js"]]) fs.writeFileSync(path.join(base, dir!, `${receipt}.${extension}`), "export const inertReceipt = true;\n", { mode: 0o600 });
    }
    fs.mkdirSync(path.dirname(runtime), { recursive: true, mode: 0o700 });
    fs.mkdirSync(path.join(home, ".local/bin"), { recursive: true, mode: 0o700 });
    fs.writeFileSync(path.join(selected, "dist/cli/cli.js"), "preserved cli\n", { mode: 0o600 });
    fs.symlinkSync(path.join(selected, "dist/cli/cli.js"), path.join(home, ".local/bin/setfarm"));
    let code = fs.readFileSync(source, "utf8");
    for (const [relative, actual] of [["../product-compiler/canonical-json.js", "../../src/product-compiler/canonical-json.ts"],
      ["./baseline-deployment-cutover-cli-observation-v1.js", "../../src/internal-production/baseline-deployment-cutover-cli-observation-v1.ts"]]) {
      code = code.replace(JSON.stringify(relative), JSON.stringify(new URL(actual!, import.meta.url).href));
    }
    fs.writeFileSync(module, code); fs.writeFileSync(path.join(current, "package.json"), '{"type":"module"}');
    body({ home, current, selected, runtime, module });
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
}
function run(f: Fixture, exercise = "const held=run();await Promise.resolve();held.recheck();const value=held.observation;held.close();held.close();let refused=false;try{held.recheck()}catch{refused=true}if(!refused)throw Error('CLOSED_ACCEPTED');return value;", fault = "") {
  const child = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `
    import fs from 'node:fs';import os from 'node:os';import net from 'node:net';import cp from 'node:child_process';import{syncBuiltinESMExports}from'node:module';
    const identity=os.userInfo();os.userInfo=()=>({...identity,homedir:${JSON.stringify(f.home)}});
    let active=false,writes=0,effects=0,inspect=()=>null;
    for(const name of ['writeFileSync','mkdirSync','renameSync','unlinkSync','rmdirSync','linkSync','chmodSync','fsyncSync']){
      const original=fs[name];fs[name]=(...args)=>{if(active){writes++;throw Error('UNEXPECTED_WRITE')}return original(...args)}}
    for(const name of ['spawn','spawnSync','execFileSync']){const original=cp[name];cp[name]=(...args)=>{if(active){effects++;throw Error('UNEXPECTED_PROCESS')}return original(...args)}}
    const kill=process.kill;process.kill=(...args)=>{if(active){effects++;throw Error('UNEXPECTED_SIGNAL')}return kill(...args)};
    net.Socket.prototype.connect=()=>{effects++;throw Error('UNEXPECTED_CONNECTION')};
    ${fault}
    syncBuiltinESMExports();
    try{const loaded=await import(${JSON.stringify(pathToFileURL(f.module).href)});const run=loaded.holdDeploymentCutoverPhaseClosedPreflightV1;active=true;
      const observation=await(async()=>{${exercise}})();const frozen=v=>!v||typeof v!=='object'||Object.isFrozen(v)&&Object.values(v).every(frozen);
      console.log(JSON.stringify({observation,frozen:frozen(observation),writes,effects,evidence:inspect()}));
    }catch(e){console.log(JSON.stringify({error:e.message,cleanup:e.cutoverCleanupFailed,writes,effects,evidence:inspect()}))}
  `], { encoding: "utf8", env: { HOME: "/untrusted", SETFARM_DIR: "/untrusted" }, timeout: 15000 });
  assert.equal(child.status, 0, child.stderr); return JSON.parse(child.stdout);
}

test("held phase binds account roots and complete hash without executing receipt or effects", () => fixture(f => {
  const result = run(f);
  assert.equal(result.observation?.scope, "phase-closure-only", JSON.stringify(result));
  assert.equal(result.observation.runtimeAuthorityRoot, f.runtime);
  assert.equal(result.observation.currentCheckoutPath, f.current);
  assert.equal(result.observation.selectedCheckoutPath, f.selected);
  assert.equal(result.observation.futureProducers.length, 18);
  assert.equal(result.observation.receipts.length, 4);
  assert.ok(result.observation.blockers.includes("physical-zero-owner-not-observed"));
  const { observationHash, ...body } = result.observation; assert.equal(observationHash, hashCanonicalJson(body));
  assert.equal(result.frozen, true); assert.equal(result.writes, 0); assert.equal(result.effects, 0);
}));

for (const base of ["current", "selected"] as const) for (const kind of ["source", "compiled", "recovery-literal"]) {
  test(`${base} ${kind} producer refuses phase closure`, () => fixture(f => {
    const target = kind === "recovery-literal" ? path.join(f[base], "src", `${receipt}.ts`)
      : path.join(f[base], kind === "source" ? "src" : "dist", "internal-production", `golden-run-harness.${kind === "source" ? "ts" : "js"}`);
    fs.writeFileSync(target, kind === "recovery-literal" ? "// reserveRecoverySourceRunOwnerV1\n" : "throw Error('EXECUTION_CANARY');\n");
    assert.equal(run(f).error, "DEPLOYMENT_CUTOVER_PHASE_OBSERVATION_INVALID");
  }));
}
test("existing runtime authority refuses even if ambient override points elsewhere", () => fixture(f => {
  fs.mkdirSync(f.runtime, { mode: 0o700 }); assert.equal(run(f).error, "DEPLOYMENT_CUTOVER_PHASE_OBSERVATION_INVALID");
}));
test("caller roots never qualify phase closure", () => fixture(f => {
  assert.equal(run(f, "run({root:'/untrusted'});throw Error('INPUT_ACCEPTED')").error, "DEPLOYMENT_CUTOVER_PHASE_OBSERVATION_INVALID");
}));

for (const mutation of ["runtime", "runtime-aba", "producer-aba", "ancestor-aba", "receipt-bytes", "receipt-replace"]) {
  test(`held phase rejects ${mutation} after await and drains cleanly`, () => fixture(f => {
    const target = mutation.startsWith("runtime") ? f.runtime : mutation === "producer-aba"
      ? path.join(f.selected, "dist/internal-production/golden-fleet-scheduler.js")
      : mutation === "ancestor-aba" ? f.current : path.join(f.current, "src", `${receipt}.ts`);
    const result = run(f, `const held=run();await Promise.resolve();active=false;const target=${JSON.stringify(target)};
      ${mutation === "runtime" ? "fs.mkdirSync(target,{mode:0o700});" : mutation === "runtime-aba" ? "fs.mkdirSync(target,{mode:0o700});fs.rmdirSync(target);"
        : mutation === "producer-aba" ? "fs.writeFileSync(target,'producer');fs.unlinkSync(target);"
        : mutation === "ancestor-aba" ? "fs.renameSync(target,target+'.saved');fs.mkdirSync(target,{mode:0o700});fs.rmdirSync(target);fs.renameSync(target+'.saved',target);"
        : mutation === "receipt-replace" ? "fs.renameSync(target,target+'.saved');fs.writeFileSync(target,'export const replacement=true;');"
        : "fs.writeFileSync(target,'export const changed=true;');"}
      active=true;let refused=false;try{held.recheck()}catch{refused=true}held.close();
      if(!refused)throw Error('DRIFT_ACCEPTED');throw Error('EXPECTED_DRIFT');`);
    assert.equal(result.error, "EXPECTED_DRIFT", JSON.stringify(result));
    assert.equal(result.cleanup, undefined); assert.equal(result.writes, 0); assert.equal(result.effects, 0);
  }));
}
for (const issue of ["symlink", "hardlink", "unsafe-mode", "missing", "oversize"]) test(`phase rejects ${issue} receipt`, () => fixture(f => {
  const target = path.join(f.current, "src", `${receipt}.ts`);
  if (issue === "unsafe-mode") fs.chmodSync(target, 0o666);
  else if (issue === "hardlink") fs.linkSync(target, target + ".alias");
  else if (issue === "oversize") fs.truncateSync(target, 4 * 1024 * 1024 + 1);
  else { fs.renameSync(target, target + ".saved"); if (issue === "symlink") fs.symlinkSync(target + ".saved", target); }
  assert.equal(run(f).error, "DEPLOYMENT_CUTOVER_PHASE_OBSERVATION_INVALID");
}));
test("access denial is never authority absence", () => fixture(f => {
  const result = run(f, "run();throw Error('ACCEPTED');", `const stat=fs.lstatSync;fs.lstatSync=(target,...rest)=>{
    if(active&&target===${JSON.stringify(f.runtime)})throw Object.assign(Error('PRIVATE_DENIED'),{code:'EACCES'});return stat(target,...rest)};`);
  assert.equal(result.error, "DEPLOYMENT_CUTOVER_PHASE_OBSERVATION_INVALID");
}));
test("phase holder consumes failed close once and fences reacquisition", () => fixture(f => {
  const sentinel = path.join(f.home, "sentinel"); fs.writeFileSync(sentinel, "foreign");
  const result = run(f, `const held=run();armed=true;let failed=false;try{held.close()}catch(e){failed=e.cutoverCleanupFailed===true}held.close();
    let fenced=false;try{run()}catch(e){fenced=e.cutoverCleanupFailed===true}if(!failed||!fenced)throw Error('UNSAFE_CLOSE');throw Error('EXPECTED_CLOSE');`,
    `let armed=false,lost=false,selected=null,attempts=0;const close=fs.closeSync;
    fs.closeSync=fd=>{if(fd===selected)attempts++;if(armed&&!lost){lost=true;selected=fd;attempts=1;close(fd);
      if(fs.openSync(${JSON.stringify(sentinel)},fs.constants.O_RDONLY)!==fd)throw Error('NO_REUSE');throw Error('PRIVATE_CLOSE')}return close(fd)};
    inspect=()=>({attempts,preserved:fs.fstatSync(selected).ino===fs.statSync(${JSON.stringify(sentinel)}).ino});`);
  assert.equal(result.error, "EXPECTED_CLOSE", JSON.stringify(result));
  assert.deepEqual(result.evidence, { attempts: 1, preserved: true });
}));
