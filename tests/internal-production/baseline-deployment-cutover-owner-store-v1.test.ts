import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { createDeploymentCutoverMaintenanceIntentV1, createDeploymentCutoverOwnerClaimV1, encodeDeploymentCutoverOwnerClaimV1 } from "../../src/internal-production/baseline-deployment-cutover-records-v1.js";

const maintenance = createDeploymentCutoverMaintenanceIntentV1({ controllerSourceHash: "8".repeat(64), plan: {
  oldDeployment: { checkoutPath: "/fixture/old", checkoutDirectoryIdentityHash: "a".repeat(64), sourceSha: "b".repeat(40), sourceTreeHash: "c".repeat(40), buildHash: "d".repeat(64) },
  newDeployment: { checkoutPath: "/fixture/new", checkoutDirectoryIdentityHash: "e".repeat(64), sourceSha: "f".repeat(40), sourceTreeHash: "1".repeat(40), buildHash: "2".repeat(64) },
  cliLinkObservationHash: "3".repeat(64), spawnerLauncherConfigurationHash: "4".repeat(64), dashboardLauncherConfigurationHash: "5".repeat(64), dashboardPort: 3333,
} });
const claim = (pid = 4101) => createDeploymentCutoverOwnerClaimV1({ maintenance, owner: { uid: 501, pid, processGroupId: pid,
  processLstart: "Wed Sep 16 01:02:03 2026", bootSessionHash: "a".repeat(64), reservationNonce: "12345678-1234-4234-8234-123456789abc" },
  previous: null, previousOwnerDeathObservationHash: null });
function fixture(body: (home: string, root: string) => void): void {
  const home = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "cutover-owner-store-")));
  const baseline = path.join(home, "ai", "setrox", "data", "internal-production-baseline");
  fs.mkdirSync(baseline, { recursive: true, mode: 0o700 });
  try { body(home, path.join(baseline, "deployment-cutover-owner-v1")); }
  finally { fs.rmSync(home, { recursive: true, force: true }); }
}
function childArguments(home: string, input: unknown = claim(), fault = "", observeOnly = false, retryOnFailure = false): string[] {
  const url = new URL("../../src/internal-production/baseline-deployment-cutover-owner-store-v1.ts", import.meta.url).href;
  return ["--import", "tsx", "--input-type=module", "-e", `
    import os from "node:os"; import fs from "node:fs"; import {syncBuiltinESMExports} from "node:module";
    const identity=os.userInfo(); os.userInfo=()=>({...identity,homedir:${JSON.stringify(home)}});
    let active=false, evidence=()=>null, module;
    ${fault}
    syncBuiltinESMExports();
    try {module=await import(${JSON.stringify(url)}); active=true;
      const observation=${observeOnly} ? module.observeDeploymentCutoverOwnerHistoryV1()
        : module.publishDeploymentCutoverOwnerClaimV1(${JSON.stringify(maintenance)},${JSON.stringify(input)});
      process.stdout.write(JSON.stringify({observation,evidence:evidence()}));
    } catch(error) {let retryError=null; if(${retryOnFailure}&&module){try{module.observeDeploymentCutoverOwnerHistoryV1();}catch(retry){retryError=retry.message;}}
      process.stdout.write(JSON.stringify({error:error.message,retryError,evidence:evidence()}));}
  `];
}
function run(home: string, input: unknown = claim(), fault = "", observeOnly = false, retryOnFailure = false): any {
  const child = spawnSync(process.execPath, childArguments(home, input, fault, observeOnly, retryOnFailure), { encoding: "utf8", env: {}, timeout: 10000 });
  assert.equal(child.status, 0, child.stderr); return JSON.parse(child.stdout);
}

test("owner store publishes private history and exact replay preserves committed identity", () => fixture((home, root) => {
  const first = run(home);
  assert.equal(first.observation?.claims[0].ownerClaimHash, claim().ownerClaimHash, JSON.stringify(first));
  const file = path.join(root, "owner-0001.json"), before = fs.lstatSync(file);
  assert.deepEqual(fs.readFileSync(file), encodeDeploymentCutoverOwnerClaimV1(claim()));
  assert.equal(before.mode & 0o7777, 0o600); assert.equal(fs.lstatSync(root).mode & 0o7777, 0o700);
  assert.equal(run(home).observation.claims.length, 1);
  assert.equal(fs.lstatSync(file).ino, before.ino);
  assert.equal(fs.existsSync(path.join(path.dirname(root), "deployment-cutover-v1")), false);
}));

test("conflicting owner ordinal cannot replace the winner", () => fixture((home, root) => {
  assert.equal(run(home).observation?.claims.length, 1);
  const file = path.join(root, "owner-0001.json"), bytes = fs.readFileSync(file), inode = fs.lstatSync(file).ino;
  assert.match(run(home, claim(4102)).error, /DEPLOYMENT_CUTOVER_OWNER_STORE_INVALID/);
  assert.deepEqual(fs.readFileSync(file), bytes); assert.equal(fs.lstatSync(file).ino, inode);
}));

test("bounded inert partial stage is preserved without becoming owner authority", () => fixture((home, root) => {
  fs.mkdirSync(root, { mode: 0o700 });
  const stage = path.join(root, ".owner-0001.json.12345678-1234-4234-8234-123456789abc.tmp");
  fs.writeFileSync(stage, "partial", { mode: 0o600 });
  const result = run(home);
  assert.equal(result.observation?.claims.length, 1, JSON.stringify(result));
  assert.equal(result.observation.pendingStageCount, 1);
  const inert = result.observation.files.find((file: any) => file.name === path.basename(stage));
  assert.equal(inert.kind, "inert-stage"); assert.equal(inert.byteLength, 7);
  assert.equal(inert.bytesHash, createHash("sha256").update("partial").digest("hex"));
  const fixed = result.observation.files.find((file: any) => file.name === "owner-0001.json");
  const alias = result.observation.files.find((file: any) => file.name.startsWith(".owner-0001.json.") && file.name !== path.basename(stage));
  assert.equal(fixed.kind, "committed"); assert.equal(alias.kind, "committed-alias");
  assert.equal(alias.byteLength, fs.statSync(path.join(root, alias.name)).size);
  assert.equal(alias.bytesHash, fixed.bytesHash);
  assert.equal(fs.readFileSync(stage, "utf8"), "partial");
}));

test("absent owner observation never creates a root", () => fixture((home, root) => {
  const result = run(home, claim(), "", true);
  assert.deepEqual(result.observation?.claims, [], JSON.stringify(result));
  assert.equal(result.observation.maintenance, null); assert.equal(fs.existsSync(root), false);
}));

test("invalid owner input has no storage effect", () => fixture((home, root) => {
  assert.match(run(home, { ...claim(), ownerClaimHash: "0".repeat(64) }).error, /DEPLOYMENT_CUTOVER/);
  assert.equal(fs.existsSync(root), false);
}));

test("individually valid crossed maintenance claim refuses before root creation", () => fixture((home, root) => {
  const other = { ...maintenance, controllerSourceHash: "9".repeat(64) };
  // Build a different valid maintenance commitment independently from its body.
  const { maintenanceIntentHash: ignoredHash, maintenanceIntentRef: ignoredRef, ...body } = other;
  const canonical = (value: any): string => value === null || typeof value !== "object" ? JSON.stringify(value)
    : `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  const hash = createHash("sha256").update(canonical(body)).digest("hex");
  const crossed = createDeploymentCutoverOwnerClaimV1({ maintenance: { ...body, maintenanceIntentHash: hash,
    maintenanceIntentRef: `setfarm://internal-production/deployment-cutover-maintenance-intent/sha256/${hash}` },
    owner: claim().owner, previous: null, previousOwnerDeathObservationHash: null });
  assert.match(run(home, crossed).error, /DEPLOYMENT_CUTOVER/);
  assert.equal(fs.existsSync(root), false);
}));

test("predecessor replacement during intent replay cannot publish a crossed successor", () => fixture((home, root) => {
  assert.equal(run(home).observation?.claims.length, 1);
  const next = createDeploymentCutoverOwnerClaimV1({ maintenance, owner: claim(4102).owner, previous: claim(), previousOwnerDeathObservationHash: "e".repeat(64) });
  const file = path.join(root, "owner-0001.json"), alias = path.join(root, fs.readdirSync(root).find(name => name.startsWith(".owner-0001.json."))!);
  const replacement = encodeDeploymentCutoverOwnerClaimV1(claim(4103));
  const result = run(home, next, `
    const sync=fs.fsyncSync;let changed=false;
    const intentInode=fs.lstatSync(${JSON.stringify(path.join(root, "intent.json"))}).ino;
    fs.fsyncSync=fd=>{ const result=sync(fd);if(active&&!changed&&fs.fstatSync(fd).ino===intentInode){changed=true;
      fs.unlinkSync(${JSON.stringify(alias)});fs.unlinkSync(${JSON.stringify(file)});
      fs.writeFileSync(${JSON.stringify(file)},Buffer.from(${JSON.stringify(replacement.toString())}),{mode:0o600});fs.linkSync(${JSON.stringify(file)},${JSON.stringify(alias)});
    }return result;};evidence=()=>({changed});
  `);
  assert.match(result.error, /DEPLOYMENT_CUTOVER/); assert.equal(result.evidence.changed, true);
  assert.equal(fs.existsSync(path.join(root, "owner-0002.json")), false);
  assert.deepEqual(fs.readFileSync(file), replacement);
}));

for (const fault of ["short-write", "file-sync", "link-response", "directory-sync"]) {
  test(`${fault} preserves evidence and a fresh valid retry can finish history`, () => fixture((home, root) => {
    const result = run(home, claim(), `
      const write=fs.writeFileSync, sync=fs.fsyncSync, link=fs.linkSync;
      fs.writeFileSync=(fd,bytes,...rest)=>active&&${JSON.stringify(fault)}==="short-write"&&typeof fd==="number"?write(fd,bytes.subarray(0,5),...rest):write(fd,bytes,...rest);
      fs.fsyncSync=fd=>{ if(active && (${JSON.stringify(fault)}==="file-sync"&&fs.fstatSync(fd).isFile() || ${JSON.stringify(fault)}==="directory-sync"&&fs.fstatSync(fd).isDirectory()))throw Error("SYNC_LOST"); return sync(fd); };
      fs.linkSync=(...args)=>{const result=link(...args);if(active&&${JSON.stringify(fault)}==="link-response")throw Error("LINK_RESPONSE_LOST");return result;};
    `);
    assert.match(result.error, /DEPLOYMENT_CUTOVER_OWNER_STORE_INVALID/);
    const before = fs.existsSync(root) ? fs.readdirSync(root).map(name => ({ name, inode: fs.lstatSync(path.join(root, name)).ino, bytes: fs.readFileSync(path.join(root, name)) })) : [];
    assert.equal(run(home).observation?.claims.length, 1);
    for (const old of before) { assert.equal(fs.lstatSync(path.join(root, old.name)).ino, old.inode); assert.deepEqual(fs.readFileSync(path.join(root, old.name)), old.bytes); }
  }));
}

test("matching owner replay must flush fixed file bytes again", () => fixture((home, root) => {
  assert.equal(run(home).observation?.claims.length, 1);
  const before = fs.readdirSync(root);
  const result = run(home, claim(), `const sync=fs.fsyncSync;fs.fsyncSync=fd=>{if(active&&fs.fstatSync(fd).isFile())throw Error("REPLAY_SYNC_LOST");return sync(fd);};`);
  assert.match(result.error, /DEPLOYMENT_CUTOVER_OWNER_STORE_INVALID/); assert.deepEqual(fs.readdirSync(root), before);
}));

for (const phase of ["intent-root-sync", "owner-file-sync", "owner-link-response", "owner-root-sync", "owner-replay-file-sync", "owner-replay-root-sync", "owner-replay-baseline-sync"]) {
  test(`${phase} failure refuses and fresh retry preserves committed evidence`, () => fixture((home, root) => {
    const replay = phase.startsWith("owner-replay");
    if (replay) assert.equal(run(home).observation?.claims.length, 1);
    const result = run(home, claim(), `
      const sync=fs.fsyncSync,link=fs.linkSync;let fired=false,linked=null,ownerFlushed=false;
      const root=${JSON.stringify(root)},phase=${JSON.stringify(phase)};
      fs.linkSync=(from,to)=>{const value=link(from,to);if(active){linked=to.split('/').at(-1);
        if(phase==='owner-link-response'&&linked==='owner-0001.json'){fired=true;throw Error('RESPONSE_LOST');}}return value;};
      fs.fsyncSync=fd=>{if(active){const stat=fs.fstatSync(fd),owner=root+'/owner-0001.json';
        const ownerExists=fs.existsSync(owner),isOwner=ownerExists&&stat.ino===fs.lstatSync(owner).ino;
        const stageOwner=stat.isFile()&&fs.readdirSync(root).some(name=>name.startsWith('.owner-0001.json.')&&fs.lstatSync(root+'/'+name).ino===stat.ino);
        const rootSync=stat.ino===fs.lstatSync(root).ino;
        const baselineSync=stat.ino===fs.lstatSync(root+'/..').ino;
        const matches=phase==='intent-root-sync'&&rootSync&&linked==='intent.json'
          ||phase==='owner-file-sync'&&stageOwner&&!ownerExists
          ||phase==='owner-root-sync'&&rootSync&&linked==='owner-0001.json'
          ||phase==='owner-replay-file-sync'&&isOwner
          ||phase==='owner-replay-root-sync'&&ownerFlushed&&rootSync
          ||phase==='owner-replay-baseline-sync'&&ownerFlushed&&baselineSync;
        if(matches){fired=true;throw Error('TARGET_SYNC_LOST');}
        if(isOwner)ownerFlushed=true;
      }return sync(fd);};evidence=()=>({fired});
    `);
    assert.equal(result.evidence.fired, true, phase);
    assert.match(result.error, /DEPLOYMENT_CUTOVER_OWNER_STORE_INVALID/);
    if (["owner-link-response", "owner-root-sync"].includes(phase) || replay) assert.equal(fs.existsSync(path.join(root, "owner-0001.json")), true);
    else assert.equal(fs.existsSync(path.join(root, "owner-0001.json")), false);
    const before = fs.readdirSync(root).map(name => ({ name, inode: fs.lstatSync(path.join(root, name)).ino, bytes: fs.readFileSync(path.join(root, name)) }));
    assert.equal(run(home).observation?.claims.length, 1);
    for (const file of before) { assert.equal(fs.lstatSync(path.join(root, file.name)).ino, file.inode); assert.deepEqual(fs.readFileSync(path.join(root, file.name)), file.bytes); }
  }));
}

for (const fault of ["root-symlink", "parent-symlink", "root-mode", "foreign-link", "crossed-alias", "unexpected-name"]) {
  test(`${fault} store state refuses and preserves foreign evidence`, () => fixture((home, root) => {
    assert.equal(run(home).observation?.claims.length, 1);
    const outside = path.join(home, "foreign"), file = path.join(root, "owner-0001.json");
    if (fault === "root-symlink") { fs.renameSync(root, outside); fs.symlinkSync(outside, root); }
    if (fault === "parent-symlink") { fs.renameSync(path.dirname(root), outside); fs.symlinkSync(outside, path.dirname(root)); }
    if (fault === "root-mode") fs.chmodSync(root, 0o777);
    if (fault === "foreign-link") fs.linkSync(file, outside);
    if (fault === "crossed-alias") {
      const alias = fs.readdirSync(root).find(name => name.startsWith(".owner-0001.json."))!;
      fs.renameSync(path.join(root, alias), path.join(root, alias.replace("owner-0001", "owner-0002")));
    }
    if (fault === "unexpected-name") fs.writeFileSync(path.join(root, "unexpected"), "foreign");
    const names = fs.readdirSync(root), inode = fs.lstatSync(file).ino;
    assert.match(run(home, claim(), "", true).error, /DEPLOYMENT_CUTOVER_OWNER_STORE_INVALID/);
    assert.deepEqual(fs.readdirSync(root), names); assert.equal(fs.lstatSync(file).ino, inode);
  }));
}

test("inert stage cap prevents new publication but does not invalidate committed history", () => fixture((home, root) => {
  assert.equal(run(home).observation?.claims.length, 1);
  for (let index = 0; index < 8; index++) fs.writeFileSync(path.join(root, `.owner-0002.json.12345678-1234-4234-8234-${String(index).padStart(12, "0")}.tmp`), "partial", { mode: 0o600 });
  assert.equal(run(home, claim(), "", true).observation.pendingStageCount, 8);
  const next = createDeploymentCutoverOwnerClaimV1({ maintenance, owner: { ...claim(4102).owner }, previous: claim(), previousOwnerDeathObservationHash: "e".repeat(64) });
  assert.match(run(home, next).error, /DEPLOYMENT_CUTOVER_OWNER_STORE_INVALID/);
  assert.equal(fs.existsSync(path.join(root, "owner-0002.json")), false);
  assert.equal(run(home).observation.claims.length, 1);
}));

test("real concurrent processes cannot both publish a different first owner", async () => {
  const home = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "cutover-owner-race-")));
  fs.mkdirSync(path.join(home, "ai", "setrox", "data", "internal-production-baseline"), { recursive: true, mode: 0o700 });
  const launch = (pid: number) => new Promise<any>((resolve, reject) => {
    const child = spawn(process.execPath, childArguments(home, claim(pid)), { env: {}, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = ""; child.stdout.on("data", bytes => { stdout += bytes; }); child.stderr.on("data", bytes => { stderr += bytes; });
    child.on("error", reject); child.on("close", code => { try { assert.equal(code, 0, stderr); resolve(JSON.parse(stdout)); } catch (error) { reject(error); } });
  });
  try {
    const results = await Promise.all([launch(4101), launch(4102)]);
    assert.ok(results.filter(result => result.observation).length <= 1);
    let observed = run(home, claim(), "", true);
    // Concurrent changing inventories may make both attempts refuse safely;
    // once quiescent, retained inert stages must not prevent an honest retry.
    if (observed.observation?.claims.length === 0) observed = run(home);
    assert.equal(observed.observation?.claims.length, 1, JSON.stringify(results));
    assert.ok([4101, 4102].includes(observed.observation.claims[0].owner.pid));
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});

test("successor history publication preserves predecessor inode and exact relation", () => fixture((home, root) => {
  assert.equal(run(home).observation?.claims.length, 1);
  const original = fs.lstatSync(path.join(root, "owner-0001.json")).ino;
  const next = createDeploymentCutoverOwnerClaimV1({ maintenance, owner: claim(4102).owner, previous: claim(), previousOwnerDeathObservationHash: "e".repeat(64) });
  const result = run(home, next);
  assert.equal(result.observation?.claims.length, 2, JSON.stringify(result));
  assert.equal(result.observation.claims[1].previousOwnerClaimHash, claim().ownerClaimHash);
  assert.equal(fs.lstatSync(path.join(root, "owner-0001.json")).ino, original);
}));

test("uncertain store close preserves a reused descriptor and blocks fresh observations", () => fixture((home) => {
  const sentinel = path.join(home, "sentinel"); fs.writeFileSync(sentinel, "sentinel");
  const result = run(home, claim(), `
    const close=fs.closeSync;let chosen=null,reused=null,attempts=0;
    fs.closeSync=fd=>{if(active&&chosen===null){chosen=fd;attempts++;close(fd);reused=fs.openSync(${JSON.stringify(sentinel)},"r");throw Error("CLOSE_RESPONSE_LOST");}
      if(fd===chosen)attempts++;return close(fd);};
    evidence=()=>{let preserved=false;try{preserved=fs.fstatSync(reused).ino===fs.lstatSync(${JSON.stringify(sentinel)}).ino;}catch{}
      return {attempts,preserved,reused:chosen===reused};};
  `, false, true);
  assert.match(result.error, /DEPLOYMENT_CUTOVER_OWNER_STORE_INVALID/);
  assert.match(result.retryError, /DEPLOYMENT_CUTOVER_OWNER_STORE_INVALID/);
  assert.deepEqual(result.evidence, { attempts: 1, preserved: true, reused: true });
}));

test("root replacement during staged write preserves both foreign and original directories", () => fixture((home, root) => {
  const retained = path.join(home, "retained");
  const result = run(home, claim(), `const sync=fs.fsyncSync;let replaced=false;
    fs.fsyncSync=fd=>{const result=sync(fd);if(active&&!replaced&&fs.fstatSync(fd).isFile()){replaced=true;
      fs.renameSync(${JSON.stringify(root)},${JSON.stringify(retained)});fs.mkdirSync(${JSON.stringify(root)},{mode:0o700});}
      return result;};evidence=()=>({replaced});`);
  assert.match(result.error, /DEPLOYMENT_CUTOVER_OWNER_STORE_INVALID/);
  assert.equal(result.evidence.replaced, true); assert.deepEqual(fs.readdirSync(root), []);
  assert.equal(fs.readdirSync(retained).length, 1);
}));
