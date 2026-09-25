import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { createDeploymentCutoverServiceEffectIntentV1, createDeploymentCutoverServiceEffectCompletionV1,
  encodeDeploymentCutoverServiceEffectIntentV1, encodeDeploymentCutoverServiceEffectCompletionV1 } from
  "../../src/internal-production/baseline-deployment-cutover-service-effect-records-v1.js";

const first = createDeploymentCutoverServiceEffectIntentV1({ cutoverIntentHash: "a".repeat(64), ownerClaimHash: "b".repeat(64),
  ordinal: 1, previousCompletionHash: null, beforeLauncherObservationHash: "c".repeat(64),
  beforeProcessObservationHash: "d".repeat(64) });
const firstCompletion = createDeploymentCutoverServiceEffectCompletionV1({ intent: first,
  afterLauncherObservationHash: "e".repeat(64), afterProcessObservationHash: "f".repeat(64) });
const second = createDeploymentCutoverServiceEffectIntentV1({ cutoverIntentHash: "a".repeat(64), ownerClaimHash: "b".repeat(64),
  ordinal: 2, previousCompletionHash: firstCompletion.effectCompletionHash,
  beforeLauncherObservationHash: "1".repeat(64), beforeProcessObservationHash: "2".repeat(64) });
const secondCompletion = createDeploymentCutoverServiceEffectCompletionV1({ intent: second,
  afterLauncherObservationHash: "3".repeat(64), afterProcessObservationHash: "4".repeat(64) });
const moduleUrl = new URL("../../src/internal-production/baseline-deployment-cutover-service-effect-store-v1.ts", import.meta.url).href;
function fixture(body: (home: string, root: string) => void): void {
  const home = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "cutover-effect-store-")));
  const baseline = path.join(home, "ai", "setrox", "data", "internal-production-baseline");
  fs.mkdirSync(baseline, { recursive: true, mode: 0o700 });
  try { body(home, path.join(baseline, "deployment-cutover-service-effects-v1")); }
  finally { fs.rmSync(home, { recursive: true, force: true }); }
}
function run(home: string, operation: "observe" | "first-intent"): any {
  const script = `
    import os from "node:os"; import {syncBuiltinESMExports} from "node:module";
    const identity=os.userInfo(); os.userInfo=()=>({...identity,homedir:${JSON.stringify(home)}});
    syncBuiltinESMExports();
    try { const store=await import(${JSON.stringify(moduleUrl)});
      const before=store.observeDeploymentCutoverServiceEffectStoreV1();
      const after=${JSON.stringify(operation)}==="observe" ? before
        : store.publishDeploymentCutoverServiceEffectIntentV1(${JSON.stringify(first)},before.storeObservationHash);
      process.stdout.write(JSON.stringify({before,after}));
    } catch(error) {process.stdout.write(JSON.stringify({error:error.message}));}
  `;
  const child = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", script],
    { encoding: "utf8", env: {}, timeout: 10000 });
  assert.equal(child.status, 0, child.stderr);
  return JSON.parse(child.stdout);
}
type Action = "intent1" | "completion1" | "intent2" | "completion2" | "conflict1" | "completionCrossed" | "intent2Wrong";
function runActions(home: string, actions: Action[], fault = "", retryOnFailure = false, expectedOverride?: string): any {
  const crossed = createDeploymentCutoverServiceEffectIntentV1({ cutoverIntentHash: "9".repeat(64), ownerClaimHash: "b".repeat(64),
    ordinal: 1, previousCompletionHash: null, beforeLauncherObservationHash: "c".repeat(64), beforeProcessObservationHash: "d".repeat(64) });
  const records = { intent1: first, completion1: firstCompletion, intent2: second, completion2: secondCompletion,
    conflict1: crossed,
    completionCrossed: createDeploymentCutoverServiceEffectCompletionV1({ intent: crossed,
      afterLauncherObservationHash: "e".repeat(64), afterProcessObservationHash: "f".repeat(64) }),
    intent2Wrong: createDeploymentCutoverServiceEffectIntentV1({ cutoverIntentHash: "a".repeat(64), ownerClaimHash: "b".repeat(64),
      ordinal: 2, previousCompletionHash: "0".repeat(64), beforeLauncherObservationHash: "1".repeat(64),
      beforeProcessObservationHash: "2".repeat(64) }) };
  const script = `
    import os from "node:os"; import fs from "node:fs"; import {syncBuiltinESMExports} from "node:module";
    const identity=os.userInfo(); os.userInfo=()=>({...identity,homedir:${JSON.stringify(home)}});
    let active=false, evidence=()=>null, store, observations=[];
    ${fault}
    syncBuiltinESMExports();
    try {store=await import(${JSON.stringify(moduleUrl)}); active=true;
      const records=${JSON.stringify(records)};
      for(const action of ${JSON.stringify(actions)}) {
        const before=store.observeDeploymentCutoverServiceEffectStoreV1();
        const expected=${JSON.stringify(expectedOverride ?? null)}??before.storeObservationHash;
        const after=action.startsWith("completion")
          ? store.publishDeploymentCutoverServiceEffectCompletionV1(records[action],expected)
          : store.publishDeploymentCutoverServiceEffectIntentV1(records[action],expected);
        observations.push({before,after});
      }
      process.stdout.write(JSON.stringify({observations,evidence:evidence()}));
    } catch(error) {let retryError=null;
      if(${retryOnFailure}&&store){try{store.observeDeploymentCutoverServiceEffectStoreV1();}catch(retry){retryError=retry.message;}}
      process.stdout.write(JSON.stringify({error:error.message,retryError,observations,evidence:evidence()}));}
  `;
  const child = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", script],
    { encoding: "utf8", env: {}, timeout: 10000 });
  assert.equal(child.status, 0, child.stderr);
  return JSON.parse(child.stdout);
}

test("absent effect store is observational; first intent publishes exact immutable bytes", () => fixture((home, root) => {
  const empty = run(home, "observe");
  assert.equal(empty.before.history.historicalState, "empty", JSON.stringify(empty));
  assert.equal(empty.before.authority, "history-only");
  assert.equal(fs.existsSync(root), false);
  const result = run(home, "first-intent");
  assert.equal(result.error, undefined, JSON.stringify(result));
  assert.equal(result.after.history.historicalState, "unsettled", JSON.stringify(result));
  assert.deepEqual(fs.readFileSync(path.join(root, "intent-0001.json")), encodeDeploymentCutoverServiceEffectIntentV1(first));
  assert.equal(fs.lstatSync(root).mode & 0o7777, 0o700);
  assert.equal(fs.lstatSync(path.join(root, "intent-0001.json")).mode & 0o7777, 0o600);
}));

test("four fixed records publish in order; exact replay retains the committed inode", () => fixture((home, root) => {
  const result = runActions(home, ["intent1", "completion1", "intent2", "completion2"]);
  assert.equal(result.error, undefined, JSON.stringify(result));
  assert.deepEqual(result.observations.map((step: any) => step.after.history.historicalState),
    ["unsettled", "recorded-prefix", "unsettled", "recorded-complete"]);
  assert.deepEqual(fs.readFileSync(path.join(root, "completion-0001.json")),
    encodeDeploymentCutoverServiceEffectCompletionV1(firstCompletion));
  assert.deepEqual(fs.readFileSync(path.join(root, "intent-0002.json")), encodeDeploymentCutoverServiceEffectIntentV1(second));
  const file = path.join(root, "intent-0001.json"), inode = fs.lstatSync(file).ino;
  const replay = runActions(home, ["intent1"]);
  assert.equal(replay.error, undefined, JSON.stringify(replay));
  assert.equal(fs.lstatSync(file).ino, inode);
  assert.equal(replay.observations[0].after.authority, "history-only");
  assert.equal(replay.observations[0].after.storageState, "settled");
}));

test("missing predecessor and early second intent refuse before any fixed publication", () => fixture((home, root) => {
  const earlyCompletion = runActions(home, ["completion1"]);
  assert.match(earlyCompletion.error, /DEPLOYMENT_CUTOVER_SERVICE_EFFECT_STORE_INVALID/);
  assert.equal(fs.existsSync(root), false, "a missing predecessor must not create the store");
  assert.equal(runActions(home, ["intent1"]).error, undefined);
  const earlySecond = runActions(home, ["intent2"]);
  assert.match(earlySecond.error, /DEPLOYMENT_CUTOVER_SERVICE_EFFECT_STORE_INVALID/);
  assert.equal(fs.existsSync(path.join(root, "intent-0002.json")), false);
  assert.deepEqual(fs.readdirSync(root).filter(name => name.startsWith(".intent-0002")), []);
}));

test("individually valid crossed completion and second predecessor refuse before staging", () => fixture((home, root) => {
  assert.equal(runActions(home, ["intent1"]).error, undefined);
  assert.match(runActions(home, ["completionCrossed"]).error, /DEPLOYMENT_CUTOVER_SERVICE_EFFECT_STORE_INVALID/);
  assert.equal(fs.existsSync(path.join(root, "completion-0001.json")), false);
  assert.deepEqual(fs.readdirSync(root).filter(name => name.startsWith(".completion-0001")), []);
  assert.equal(runActions(home, ["completion1"]).error, undefined);
  assert.match(runActions(home, ["intent2Wrong"]).error, /DEPLOYMENT_CUTOVER_SERVICE_EFFECT_STORE_INVALID/);
  assert.equal(fs.existsSync(path.join(root, "intent-0002.json")), false);
  assert.deepEqual(fs.readdirSync(root).filter(name => name.startsWith(".intent-0002")), []);
}));

test("conflicting committed bytes and stale observation hash cannot replace a fixed record", () => fixture((home, root) => {
  const staleHash = run(home, "observe").before.storeObservationHash;
  assert.equal(runActions(home, ["intent1"]).error, undefined);
  const fixed = path.join(root, "intent-0001.json"), bytes = fs.readFileSync(fixed), inode = fs.lstatSync(fixed).ino;
  assert.match(runActions(home, ["conflict1"]).error, /DEPLOYMENT_CUTOVER_SERVICE_EFFECT_STORE_INVALID/);
  assert.deepEqual(fs.readFileSync(fixed), bytes);
  assert.equal(fs.lstatSync(fixed).ino, inode);
  const stale = runActions(home, ["completion1"], "", false, staleHash);
  assert.match(stale.error, /DEPLOYMENT_CUTOVER_SERVICE_EFFECT_STORE_INVALID/);
  assert.equal(fs.existsSync(path.join(root, "completion-0001.json")), false);
}));

for (const fault of ["unknown-name", "root-mode", "root-symlink", "parent-mode", "parent-symlink", "crossed-alias", "alias-missing", "foreign-link", "malformed-fixed"] as const) {
  test(`${fault} refuses observation without repairing or deleting physical evidence`, () => fixture((home, root) => {
    assert.equal(runActions(home, ["intent1"]).error, undefined);
    const fixed = path.join(root, "intent-0001.json"), outside = path.join(home, "outside");
    if (fault === "unknown-name") fs.writeFileSync(path.join(root, "other.json"), "x", { mode: 0o600 });
    if (fault === "root-mode") fs.chmodSync(root, 0o777);
    if (fault === "root-symlink") { fs.renameSync(root, outside); fs.symlinkSync(outside, root); }
    if (fault === "parent-mode") fs.chmodSync(path.dirname(root), 0o777);
    if (fault === "parent-symlink") { fs.renameSync(path.dirname(root), outside); fs.symlinkSync(outside, path.dirname(root)); }
    if (fault === "crossed-alias") {
      const alias = fs.readdirSync(root).find(name => name.startsWith(".intent-0001.json."))!;
      fs.renameSync(path.join(root, alias), path.join(root, alias.replace("intent-0001", "intent-0002")));
    }
    if (fault === "alias-missing") {
      const alias = fs.readdirSync(root).find(name => name.startsWith(".intent-0001.json."))!;
      fs.unlinkSync(path.join(root, alias));
    }
    if (fault === "foreign-link") fs.linkSync(fixed, outside);
    if (fault === "malformed-fixed") fs.writeFileSync(fixed, "{}\n");
    const names = fs.readdirSync(root).sort();
    const observed = run(home, "observe");
    assert.match(observed.error, /DEPLOYMENT_CUTOVER_SERVICE_EFFECT_STORE_INVALID/);
    assert.deepEqual(fs.readdirSync(root).sort(), names);
  }));
}

test("inert partial stage is visible but permanently blocks new publication", () => fixture((home, root) => {
  fs.mkdirSync(root, { mode: 0o700 });
  const stage = path.join(root, ".intent-0001.json.12345678-1234-4234-8234-123456789abc.tmp");
  fs.writeFileSync(stage, "partial", { mode: 0o600 });
  const before = run(home, "observe").before;
  assert.equal(before.storageState, "needs-reconciliation");
  assert.equal(before.pendingStageCount, 1);
  assert.equal(before.history.historicalState, "empty");
  assert.match(runActions(home, ["intent1"]).error, /DEPLOYMENT_CUTOVER_SERVICE_EFFECT_STORE_INVALID/);
  assert.deepEqual(fs.readFileSync(stage), Buffer.from("partial"));
  assert.equal(fs.existsSync(path.join(root, "intent-0001.json")), false);
}));

test("a directly written fixed record is not accepted as a published history", () => fixture((home, root) => {
  fs.mkdirSync(root, { mode: 0o700 });
  const fixed = path.join(root, "intent-0001.json");
  fs.writeFileSync(fixed, encodeDeploymentCutoverServiceEffectIntentV1(first), { mode: 0o600 });
  const bytes = fs.readFileSync(fixed), inode = fs.lstatSync(fixed).ino;
  assert.match(run(home, "observe").error, /DEPLOYMENT_CUTOVER_SERVICE_EFFECT_STORE_INVALID/);
  assert.deepEqual(fs.readFileSync(fixed), bytes);
  assert.equal(fs.lstatSync(fixed).ino, inode);
}));

test("excess inert stages refuse observation without deleting any stage", () => fixture((home, root) => {
  fs.mkdirSync(root, { mode: 0o700 });
  for (let index = 0; index < 9; index++) fs.writeFileSync(path.join(root,
    `.intent-0001.json.12345678-1234-4234-8234-${String(index).padStart(12, "0")}.tmp`), "partial", { mode: 0o600 });
  const names = fs.readdirSync(root).sort();
  assert.match(run(home, "observe").error, /DEPLOYMENT_CUTOVER_SERVICE_EFFECT_STORE_INVALID/);
  assert.deepEqual(fs.readdirSync(root).sort(), names);
}));

test("bounded partial reads do not truncate committed record observation", () => fixture((home) => {
  assert.equal(runActions(home, ["intent1"]).error, undefined);
  const replay = runActions(home, ["intent1"], `
    const read=fs.readSync;let partialReads=0;
    fs.readSync=(fd,buffer,offset,length,position)=>{if(active)partialReads++;
      return read(fd,buffer,offset,active?Math.min(length,3):length,position);};
    evidence=()=>({partialReads});
  `);
  assert.equal(replay.error, undefined, JSON.stringify(replay));
  assert.ok(replay.evidence.partialReads > 1);
}));

for (const fault of ["short-write", "file-sync", "link-response", "root-sync", "close-loss"] as const) {
  test(`${fault} preserves publication evidence and cannot silently retry a physical effect`, () => fixture((home, root) => {
    const hook = `
      const write=fs.writeFileSync,sync=fs.fsyncSync,link=fs.linkSync,close=fs.closeSync;
      let fired=false;const root=${JSON.stringify(root)},fault=${JSON.stringify(fault)};
      fs.writeFileSync=(fd,bytes,...rest)=>active&&fault==="short-write"&&typeof fd==="number"
        ? (fired=true,write(fd,bytes.subarray(0,5),...rest)) : write(fd,bytes,...rest);
      fs.fsyncSync=fd=>{if(active&&!fired&&((fault==="file-sync"&&fs.fstatSync(fd).isFile())
        ||(fault==="root-sync"&&fs.existsSync(root)&&fs.fstatSync(fd).ino===fs.lstatSync(root).ino))){fired=true;throw Error("SYNC_LOST");}
        return sync(fd);};
      fs.linkSync=(from,to)=>{const result=link(from,to);if(active&&fault==="link-response"){fired=true;throw Error("LINK_RESPONSE_LOST");}return result;};
      fs.closeSync=fd=>{if(active&&!fired&&fault==="close-loss"&&fs.fstatSync(fd).isFile()){
        fired=true;throw Error("CLOSE_LOST");}return close(fd);};
      evidence=()=>({fired});
    `;
    const failed = runActions(home, ["intent1"], hook, true);
    assert.equal(failed.evidence.fired, true, JSON.stringify(failed));
    assert.match(failed.error, /DEPLOYMENT_CUTOVER_SERVICE_EFFECT_STORE_INVALID/);
    if (["close-loss", "file-sync", "root-sync"].includes(fault))
      assert.match(failed.retryError, /DEPLOYMENT_CUTOVER_SERVICE_EFFECT_STORE_INVALID/);
    const names = fs.readdirSync(root).sort(), fixed = path.join(root, "intent-0001.json");
    const observed = run(home, "observe");
    assert.equal(observed.error, undefined, JSON.stringify(observed));
    if (["link-response", "root-sync"].includes(fault)) {
      assert.equal(fs.existsSync(fixed), true);
      assert.equal(observed.before.history.historicalState, "unsettled");
      const inode = fs.lstatSync(fixed).ino;
      assert.equal(runActions(home, ["intent1"]).error, undefined);
      assert.equal(fs.lstatSync(fixed).ino, inode);
    } else {
      assert.equal(fs.existsSync(fixed), false);
      assert.equal(observed.before.storageState, "needs-reconciliation");
      assert.match(runActions(home, ["intent1"]).error, /DEPLOYMENT_CUTOVER_SERVICE_EFFECT_STORE_INVALID/);
    }
    assert.deepEqual(fs.readdirSync(root).sort(), names);
  }));
}

test("parent fsync loss after fixed completion keeps history but demands fresh exact replay", () => fixture((home, root) => {
  assert.equal(runActions(home, ["intent1"]).error, undefined);
  const baseline = path.dirname(root);
  const failed = runActions(home, ["completion1"], `
    const sync=fs.fsyncSync;let fired=false;const baseline=${JSON.stringify(baseline)};
    fs.fsyncSync=fd=>{if(active&&!fired&&fs.fstatSync(fd).ino===fs.lstatSync(baseline).ino){
      fired=true;throw Error("PARENT_SYNC_LOST");}return sync(fd);};evidence=()=>({fired});
  `);
  assert.equal(failed.evidence.fired, true);
  assert.match(failed.error, /DEPLOYMENT_CUTOVER_SERVICE_EFFECT_STORE_INVALID/);
  const fixed = path.join(root, "completion-0001.json"), inode = fs.lstatSync(fixed).ino;
  assert.equal(run(home, "observe").before.history.historicalState, "recorded-prefix");
  assert.equal(runActions(home, ["completion1"]).error, undefined);
  assert.equal(fs.lstatSync(fixed).ino, inode);
}));

test("two real processes cannot replace a competing first intent", async () => {
  const home = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "cutover-effect-race-")));
  const baseline = path.join(home, "ai", "setrox", "data", "internal-production-baseline");
  fs.mkdirSync(baseline, { recursive: true, mode: 0o700 });
  const root = path.join(baseline, "deployment-cutover-service-effects-v1");
  const candidate = createDeploymentCutoverServiceEffectIntentV1({ cutoverIntentHash: "9".repeat(64),
    ownerClaimHash: "b".repeat(64), ordinal: 1, previousCompletionHash: null,
    beforeLauncherObservationHash: "c".repeat(64), beforeProcessObservationHash: "d".repeat(64) });
  const launch = (intent: typeof first) => new Promise<any>((resolve, reject) => {
    const script = `
      import os from "node:os"; import {syncBuiltinESMExports} from "node:module";
      const identity=os.userInfo();os.userInfo=()=>({...identity,homedir:${JSON.stringify(home)}});syncBuiltinESMExports();
      try{const store=await import(${JSON.stringify(moduleUrl)});const before=store.observeDeploymentCutoverServiceEffectStoreV1();
        const after=store.publishDeploymentCutoverServiceEffectIntentV1(${JSON.stringify(intent)},before.storeObservationHash);
        process.stdout.write(JSON.stringify({hash:after.history.intents[0].effectIntentHash}));}
      catch(error){process.stdout.write(JSON.stringify({error:error.message}));}
    `;
    const child = spawn(process.execPath, ["--import", "tsx", "--input-type=module", "-e", script],
      { env: {}, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    child.stdout.on("data", bytes => { stdout += bytes; }); child.stderr.on("data", bytes => { stderr += bytes; });
    child.on("error", reject);
    child.on("close", code => { try { assert.equal(code, 0, stderr); resolve(JSON.parse(stdout)); } catch (error) { reject(error); } });
  });
  try {
    const results = await Promise.all([launch(first), launch(candidate)]);
    assert.ok(results.filter(result => result.hash).length <= 1, JSON.stringify(results));
    const fixedPath = path.join(root, "intent-0001.json"), observed = run(home, "observe");
    assert.equal(observed.error, undefined, JSON.stringify({ results, observed }));
    if (fs.existsSync(fixedPath)) {
      const fixed = fs.readFileSync(fixedPath);
      assert.ok(fixed.equals(encodeDeploymentCutoverServiceEffectIntentV1(first))
        || fixed.equals(encodeDeploymentCutoverServiceEffectIntentV1(candidate)));
      assert.equal(observed.before.history.historicalState, "unsettled");
    } else {
      assert.equal(results.filter(result => result.hash).length, 0);
      assert.equal(observed.before.history.historicalState, "empty");
      assert.equal(observed.before.storageState, "needs-reconciliation");
      assert.ok(observed.before.pendingStageCount > 0);
    }
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});
