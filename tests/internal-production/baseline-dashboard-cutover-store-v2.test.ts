import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createDashboardCutoverIntentV2, createDashboardCutoverCompletionV2,
  encodeDashboardCutoverIntentV2, encodeDashboardCutoverCompletionV2 } from
  "../../src/internal-production/baseline-dashboard-cutover-records-v2.js";

const first = createDashboardCutoverIntentV2({ cutoverIntentHash: "a".repeat(64), ownerClaimHash: "b".repeat(64),
  ordinal: 1, previousCompletionHash: null, beforeObservationHash: "c".repeat(64) });
const firstCompletion = createDashboardCutoverCompletionV2({ intent: first,
  afterObservationHash: "e".repeat(64), completionOwnerClaimHash: "b".repeat(64), outcome: "launcher-unloaded" });
const second = createDashboardCutoverIntentV2({ cutoverIntentHash: "a".repeat(64), ownerClaimHash: "b".repeat(64),
  ordinal: 2, previousCompletionHash: firstCompletion.effectCompletionHash,
  beforeObservationHash: "1".repeat(64) });
const secondCompletion = createDashboardCutoverCompletionV2({ intent: second,
  afterObservationHash: "3".repeat(64), completionOwnerClaimHash: "b".repeat(64), outcome: "launcher-unloaded" });
const intents = [first, second], completions = [firstCompletion, secondCompletion];
for (let ordinal = 3; ordinal <= 6; ordinal++) {
  const intent = createDashboardCutoverIntentV2({ cutoverIntentHash: "a".repeat(64), ownerClaimHash: "7".repeat(64),
    ordinal, previousCompletionHash: completions[ordinal - 2]!.effectCompletionHash, beforeObservationHash: "8".repeat(64) });
  intents.push(intent);
  completions.push(createDashboardCutoverCompletionV2({ intent, completionOwnerClaimHash: "9".repeat(64),
    afterObservationHash: "0".repeat(64),
    outcome: ["original-process-exited", "selector-selected", "launcher-restored", "dashboard-authenticated"][ordinal - 3] }));
}
const importIndex = process.execArgv.indexOf("--import");
const tsxLoader = importIndex >= 0 ? process.execArgv[importIndex + 1]! : "tsx";
const moduleUrl = new URL("../../src/internal-production/baseline-dashboard-cutover-store-v2.ts", import.meta.url).href;
const canonical = (value: any): string => value === null || typeof value !== "object" ? JSON.stringify(value)
  : Array.isArray(value) ? `[${value.map(canonical).join(",")}]`
    : `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
const hash = (value: unknown) => createHash("sha256").update(canonical(value)).digest("hex");
function fixture(body: (home: string, root: string) => void): void {
  const home = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "cutover-effect-store-")));
  const baseline = path.join(home, "ai", "setrox", "data", "internal-production-baseline");
  fs.mkdirSync(baseline, { recursive: true, mode: 0o700 });
  // Private owned fixture is retained; no existing runtime/evidence path is touched.
  body(home, path.join(baseline, "deployment-dashboard-cutover-v2"));
}
function run(home: string, operation: "observe" | "first-intent"): any {
  const script = `
    import os from "node:os"; import {syncBuiltinESMExports} from "node:module";
    const identity=os.userInfo(); os.userInfo=()=>({...identity,homedir:${JSON.stringify(home)}});
    syncBuiltinESMExports();
    try { const store=await import(${JSON.stringify(moduleUrl)});
      const before=store.observeDashboardCutoverStoreV2();
      const after=${JSON.stringify(operation)}==="observe" ? before
        : store.publishDashboardCutoverIntentV2(${JSON.stringify(first)},before.storeObservationHash);
      process.stdout.write(JSON.stringify({before,after}));
    } catch(error) {process.stdout.write(JSON.stringify({error:error.message}));}
  `;
  const child = spawnSync(process.execPath, ["--import", tsxLoader, "--input-type=module", "-e", script],
    { encoding: "utf8", env: {}, timeout: 10000, maxBuffer: 4 * 1024 * 1024 });
  assert.equal(child.status, 0, child.stderr);
  return JSON.parse(child.stdout);
}
type Action = `intent${1 | 2 | 3 | 4 | 5 | 6}` | `completion${1 | 2 | 3 | 4 | 5 | 6}`
  | "conflict1" | "completionCrossed" | "intent2Wrong";
function runActions(home: string, actions: Action[], fault = "", retryOnFailure = false, expectedOverride?: string): any {
  const crossed = createDashboardCutoverIntentV2({ cutoverIntentHash: "9".repeat(64), ownerClaimHash: "b".repeat(64),
    ordinal: 1, previousCompletionHash: null, beforeObservationHash: "c".repeat(64) });
  const records = { ...Object.fromEntries(intents.flatMap((intent, index) =>
    [[`intent${index + 1}`, intent], [`completion${index + 1}`, completions[index]]])),
    conflict1: crossed,
    completionCrossed: createDashboardCutoverCompletionV2({ intent: crossed,
      afterObservationHash: "e".repeat(64), completionOwnerClaimHash: "b".repeat(64), outcome: "launcher-unloaded" }),
    intent2Wrong: createDashboardCutoverIntentV2({ cutoverIntentHash: "a".repeat(64), ownerClaimHash: "b".repeat(64),
      ordinal: 2, previousCompletionHash: "0".repeat(64), beforeObservationHash: "1".repeat(64) }) };
  const script = `
    import os from "node:os"; import fs from "node:fs"; import {syncBuiltinESMExports} from "node:module";
    const identity=os.userInfo(); os.userInfo=()=>({...identity,homedir:${JSON.stringify(home)}});
    let active=false, evidence=()=>null, store, observations=[];
    ${fault}
    syncBuiltinESMExports();
    try {store=await import(${JSON.stringify(moduleUrl)}); active=true;
      const records=${JSON.stringify(records)};
      for(const action of ${JSON.stringify(actions)}) {
        const before=store.observeDashboardCutoverStoreV2();
        const expected=${JSON.stringify(expectedOverride ?? null)}??before.storeObservationHash;
        const after=action.startsWith("completion")
          ? store.publishDashboardCutoverCompletionV2(records[action],expected)
          : store.publishDashboardCutoverIntentV2(records[action],expected);
        observations.push({before,after});
      }
      process.stdout.write(JSON.stringify({observations,evidence:evidence()}));
    } catch(error) {let retryError=null;
      if(${retryOnFailure}&&store){try{store.observeDashboardCutoverStoreV2();}catch(retry){retryError=retry.message;}}
      process.stdout.write(JSON.stringify({error:error.message,retryError,observations,evidence:evidence()}));}
  `;
  const child = spawnSync(process.execPath, ["--import", tsxLoader, "--input-type=module", "-e", script],
    { encoding: "utf8", env: {}, timeout: 10000, maxBuffer: 4 * 1024 * 1024 });
  assert.equal(child.status, 0, child.stderr);
  return JSON.parse(child.stdout);
}

test("absent effect store is observational; first intent publishes exact immutable bytes", () => fixture((home, root) => {
  const empty = run(home, "observe");
  assert.equal(empty.error, undefined, JSON.stringify(empty));
  assert.equal(empty.before.history.historicalState, "empty", JSON.stringify(empty));
  assert.equal(empty.before.authority, "history-only");
  assert.equal(empty.before.rootIdentityHash, null);
  assert.equal(fs.existsSync(root), false);
  const result = run(home, "first-intent");
  assert.equal(result.error, undefined, JSON.stringify(result));
  assert.equal(result.after.history.historicalState, "unsettled", JSON.stringify(result));
  assert.deepEqual(fs.readFileSync(path.join(root, "intent-0001.json")), encodeDashboardCutoverIntentV2(first));
  assert.equal(fs.lstatSync(root).mode & 0o7777, 0o700);
  assert.equal(fs.lstatSync(path.join(root, "intent-0001.json")).mode & 0o7777, 0o600);
}));

test("four fixed records publish in order; exact replay retains the committed inode", () => fixture((home, root) => {
  const result = runActions(home, ["intent1", "completion1", "intent2", "completion2"]);
  assert.equal(result.error, undefined, JSON.stringify(result));
  assert.deepEqual(result.observations.map((step: any) => step.after.history.historicalState),
    ["unsettled", "recorded-prefix", "unsettled", "recorded-prefix"]);
  assert.deepEqual(fs.readFileSync(path.join(root, "completion-0001.json")),
    encodeDashboardCutoverCompletionV2(firstCompletion));
  assert.deepEqual(fs.readFileSync(path.join(root, "intent-0002.json")), encodeDashboardCutoverIntentV2(second));
  const file = path.join(root, "intent-0001.json"), inode = fs.lstatSync(file).ino;
  const replay = runActions(home, ["intent1"]);
  assert.equal(replay.error, undefined, JSON.stringify(replay));
  assert.equal(fs.lstatSync(file).ino, inode);
  assert.equal(replay.observations[0].after.authority, "history-only");
  assert.equal(replay.observations[0].after.storageState, "settled");
}));

test("all six durable pairs retain exact bytes and aliases without touching V1", () => fixture((home, root) => {
  const oldRoot = path.join(path.dirname(root), "deployment-cutover-service-effects-v1");
  fs.mkdirSync(oldRoot, { mode: 0o700 });
  const old = path.join(oldRoot, "preserved-evidence");
  fs.writeFileSync(old, "original V1 evidence\n", { mode: 0o600 });
  const oldBytes = fs.readFileSync(old), oldInode = fs.lstatSync(old).ino;
  const actions = intents.flatMap((_, index) => [`intent${index + 1}`, `completion${index + 1}`]) as Action[];
  const result = runActions(home, actions, `
    const frozen=value=>value===null||typeof value!=="object"||
      (Object.isFrozen(value)&&Object.values(value).every(frozen));
    evidence=()=>({frozen:observations.every(step=>frozen(step.after))});
  `);
  assert.equal(result.error, undefined, JSON.stringify(result));
  assert.deepEqual(result.observations.map((step: any) => step.after.history.historicalState),
    ["unsettled", "recorded-prefix", "unsettled", "recorded-prefix", "unsettled", "recorded-prefix",
      "unsettled", "recorded-prefix", "unsettled", "recorded-prefix", "unsettled", "dashboard-recorded"]);
  assert.equal(fs.readdirSync(root).length, 24);
  const final = result.observations.at(-1).after;
  assert.equal(final.schema, "setfarm.internal-production-dashboard-cutover-store.v2");
  assert.equal(final.authority, "history-only");
  assert.equal(final.pendingStageCount, 0);
  assert.equal(result.evidence.frozen, true);
  assert.deepEqual(Object.keys(final).sort(), ["ancestorIdentityHash", "authority", "files", "history",
    "pendingStageCount", "rootIdentityHash", "schema", "storageState", "storeObservationHash"]);
  const { storeObservationHash, ...body } = final;
  assert.equal(storeObservationHash, hash(body));
  assert.equal(final.files.filter((file: any) => file.kind === "committed-alias").length, 12);
  for (let index = 0; index < 6; index++) {
    for (const kind of ["intent", "completion"] as const) {
      const name = `${kind}-${String(index + 1).padStart(4, "0")}.json`, fixed = path.join(root, name);
      const expected = kind === "intent" ? encodeDashboardCutoverIntentV2(intents[index])
        : encodeDashboardCutoverCompletionV2(completions[index]);
      assert.deepEqual(fs.readFileSync(fixed), expected);
      assert.equal(fs.lstatSync(fixed).nlink, 2);
      const entry = final.files.find((file: any) => file.name === name);
      assert.deepEqual(Object.keys(entry).sort(), ["byteLength", "bytesHash", "identityHash", "kind", "name"]);
      assert.equal(entry.bytesHash, createHash("sha256").update(expected).digest("hex"));
      assert.equal(entry.byteLength, expected.length);
      const stat = fs.lstatSync(fixed, { bigint: true });
      assert.equal(entry.identityHash, hash(Object.fromEntries(["dev", "ino", "mode", "uid", "gid", "birthtimeNs",
        "size", "nlink", "mtimeNs", "ctimeNs"].map(key => [key, String(stat[key as keyof typeof stat])]))));
      const alias = fs.readdirSync(root).filter(file => file.startsWith(`.${name}.`));
      assert.equal(alias.length, 1);
      assert.equal(fs.lstatSync(path.join(root, alias[0]!)).ino, fs.lstatSync(fixed).ino);
    }
  }
  assert.deepEqual(fs.readFileSync(old), oldBytes);
  assert.equal(fs.lstatSync(old).ino, oldInode);
}));

test("missing predecessor and early second intent refuse before any fixed publication", () => fixture((home, root) => {
  const earlyCompletion = runActions(home, ["completion1"]);
  assert.match(earlyCompletion.error, /DASHBOARD_CUTOVER_STORE_INVALID/);
  assert.equal(fs.existsSync(root), false, "a missing predecessor must not create the store");
  assert.equal(runActions(home, ["intent1"]).error, undefined);
  const earlySecond = runActions(home, ["intent2"]);
  assert.match(earlySecond.error, /DASHBOARD_CUTOVER_STORE_INVALID/);
  assert.equal(fs.existsSync(path.join(root, "intent-0002.json")), false);
  assert.deepEqual(fs.readdirSync(root).filter(name => name.startsWith(".intent-0002")), []);
}));

test("missing baseline refuses without creating or repairing its authority path", () => fixture((home, root) => {
  const baseline = path.dirname(root), retained = `${baseline}.retained`;
  fs.renameSync(baseline, retained);
  assert.match(run(home, "observe").error, /DASHBOARD_CUTOVER_STORE_INVALID/);
  assert.match(runActions(home, ["intent1"]).error, /DASHBOARD_CUTOVER_STORE_INVALID/);
  assert.equal(fs.existsSync(baseline), false);
  assert.ok(fs.lstatSync(retained).isDirectory());
}));

test("individually valid crossed completion and second predecessor refuse before staging", () => fixture((home, root) => {
  assert.equal(runActions(home, ["intent1"]).error, undefined);
  assert.match(runActions(home, ["completionCrossed"]).error, /DASHBOARD_CUTOVER_STORE_INVALID/);
  assert.equal(fs.existsSync(path.join(root, "completion-0001.json")), false);
  assert.deepEqual(fs.readdirSync(root).filter(name => name.startsWith(".completion-0001")), []);
  assert.equal(runActions(home, ["completion1"]).error, undefined);
  assert.match(runActions(home, ["intent2Wrong"]).error, /DASHBOARD_CUTOVER_STORE_INVALID/);
  assert.equal(fs.existsSync(path.join(root, "intent-0002.json")), false);
  assert.deepEqual(fs.readdirSync(root).filter(name => name.startsWith(".intent-0002")), []);
}));

test("conflicting committed bytes and stale observation hash cannot replace a fixed record", () => fixture((home, root) => {
  const staleHash = run(home, "observe").before.storeObservationHash;
  assert.equal(runActions(home, ["intent1"]).error, undefined);
  const fixed = path.join(root, "intent-0001.json"), bytes = fs.readFileSync(fixed), inode = fs.lstatSync(fixed).ino;
  assert.match(runActions(home, ["conflict1"]).error, /DASHBOARD_CUTOVER_STORE_INVALID/);
  assert.deepEqual(fs.readFileSync(fixed), bytes);
  assert.equal(fs.lstatSync(fixed).ino, inode);
  const stale = runActions(home, ["completion1"], "", false, staleHash);
  assert.match(stale.error, /DASHBOARD_CUTOVER_STORE_INVALID/);
  assert.equal(fs.existsSync(path.join(root, "completion-0001.json")), false);
}));

for (const fault of ["unknown-name", "root-mode", "root-symlink", "parent-mode", "parent-symlink", "crossed-alias",
  "alias-missing", "foreign-link", "malformed-fixed", "record-mode", "record-symlink", "record-oversized"] as const) {
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
    if (fault === "record-mode") fs.chmodSync(fixed, 0o644);
    if (fault === "record-symlink") { fs.renameSync(fixed, outside); fs.symlinkSync(outside, fixed); }
    if (fault === "record-oversized") fs.writeFileSync(fixed, Buffer.alloc(65537));
    const names = fs.readdirSync(root).sort();
    const observed = run(home, "observe");
    assert.match(observed.error, /DASHBOARD_CUTOVER_STORE_INVALID/);
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
  assert.match(runActions(home, ["intent1"]).error, /DASHBOARD_CUTOVER_STORE_INVALID/);
  assert.deepEqual(fs.readFileSync(stage), Buffer.from("partial"));
  assert.equal(fs.existsSync(path.join(root, "intent-0001.json")), false);
}));

test("a directly written fixed record is not accepted as a published history", () => fixture((home, root) => {
  fs.mkdirSync(root, { mode: 0o700 });
  const fixed = path.join(root, "intent-0001.json");
  fs.writeFileSync(fixed, encodeDashboardCutoverIntentV2(first), { mode: 0o600 });
  const bytes = fs.readFileSync(fixed), inode = fs.lstatSync(fixed).ino;
  assert.match(run(home, "observe").error, /DASHBOARD_CUTOVER_STORE_INVALID/);
  assert.deepEqual(fs.readFileSync(fixed), bytes);
  assert.equal(fs.lstatSync(fixed).ino, inode);
}));

test("excess inert stages refuse observation without deleting any stage", () => fixture((home, root) => {
  fs.mkdirSync(root, { mode: 0o700 });
  for (let index = 0; index < 9; index++) fs.writeFileSync(path.join(root,
    `.intent-0001.json.12345678-1234-4234-8234-${String(index).padStart(12, "0")}.tmp`), "partial", { mode: 0o600 });
  const names = fs.readdirSync(root).sort();
  assert.match(run(home, "observe").error, /DASHBOARD_CUTOVER_STORE_INVALID/);
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
    assert.match(failed.error, /DASHBOARD_CUTOVER_STORE_INVALID/);
    if (["close-loss", "file-sync", "root-sync"].includes(fault))
      assert.match(failed.retryError, /DASHBOARD_CUTOVER_STORE_INVALID/);
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
      assert.match(runActions(home, ["intent1"]).error, /DASHBOARD_CUTOVER_STORE_INVALID/);
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
  assert.match(failed.error, /DASHBOARD_CUTOVER_STORE_INVALID/);
  const fixed = path.join(root, "completion-0001.json"), inode = fs.lstatSync(fixed).ino;
  assert.equal(run(home, "observe").before.history.historicalState, "recorded-prefix");
  assert.equal(runActions(home, ["completion1"]).error, undefined);
  assert.equal(fs.lstatSync(fixed).ino, inode);
}));

test("response loss after actual close never retries the original descriptor", () => fixture((home, root) => {
  const failed = runActions(home, ["intent1"], `
    const close=fs.closeSync;let original=null,attempts=0;
    fs.closeSync=fd=>{
      if(active&&original===null&&fs.fstatSync(fd).isFile()){
        original=fd;attempts++;close(fd);throw Error("CLOSE_RESPONSE_LOST");
      }
      if(fd===original)attempts++;
      return close(fd);
    };
    evidence=()=>({attempts,original});
  `, true);
  assert.match(failed.error, /DASHBOARD_CUTOVER_STORE_INVALID/);
  assert.match(failed.retryError, /DASHBOARD_CUTOVER_STORE_INVALID/);
  assert.equal(failed.evidence.attempts, 1);
  assert.equal(typeof failed.evidence.original, "number");
  assert.equal(fs.existsSync(path.join(root, "intent-0001.json")), false);
  assert.equal(fs.readdirSync(root).length, 1);
}));

test("two barrier-synchronized real processes cannot replace a competing first intent", async () => {
  const home = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "cutover-effect-race-")));
  const baseline = path.join(home, "ai", "setrox", "data", "internal-production-baseline");
  fs.mkdirSync(baseline, { recursive: true, mode: 0o700 });
  const root = path.join(baseline, "deployment-dashboard-cutover-v2");
  const candidate = createDashboardCutoverIntentV2({ cutoverIntentHash: "9".repeat(64),
    ownerClaimHash: "b".repeat(64), ordinal: 1, previousCompletionHash: null,
    beforeObservationHash: "c".repeat(64) });
  const launch = (intent: typeof first) => {
    let readyResolve!: () => void, readyReject!: (error: Error) => void, readyReceived = false;
    const ready = new Promise<void>((resolve, reject) => { readyResolve = resolve; readyReject = reject; });
    const script = `
      import os from "node:os"; import {syncBuiltinESMExports} from "node:module";
      const identity=os.userInfo();os.userInfo=()=>({...identity,homedir:${JSON.stringify(home)}});syncBuiltinESMExports();
      try{const store=await import(${JSON.stringify(moduleUrl)});const before=store.observeDashboardCutoverStoreV2();
        process.send({ready:true,rootAbsent:before.rootIdentityHash===null});
        await new Promise(resolve=>process.once("message",resolve));
        const after=store.publishDashboardCutoverIntentV2(${JSON.stringify(intent)},before.storeObservationHash);
        process.stdout.write(JSON.stringify({hash:after.history.intents[0].effectIntentHash}));}
      catch(error){process.stdout.write(JSON.stringify({error:error.message}));}
      finally{process.disconnect();}
    `;
    const child = spawn(process.execPath, ["--import", tsxLoader, "--input-type=module", "-e", script],
      { env: {}, stdio: ["ignore", "pipe", "pipe", "ipc"], timeout: 10000 });
    let stdout = "", stderr = "", outputBytes = 0, overflow = false, childError: Error | null = null;
    const collect = (bytes: Buffer, channel: "stdout" | "stderr") => {
      outputBytes += bytes.length;
      if (outputBytes > 1048576) { overflow = true; child.kill(); return; }
      if (channel === "stdout") stdout += bytes.toString(); else stderr += bytes.toString();
    };
    child.stdout!.on("data", bytes => collect(bytes as Buffer, "stdout"));
    child.stderr!.on("data", bytes => collect(bytes as Buffer, "stderr"));
    child.on("error", error => { childError = error; });
    child.on("message", message => {
      if (!readyReceived && JSON.stringify(message) === '{"ready":true,"rootAbsent":true}') {
        readyReceived = true; readyResolve();
      } else { readyReject(Error("race child failed missing-root barrier")); child.kill(); }
    });
    const completion = new Promise<any>((resolve, reject) => {
      child.on("close", (code, signal) => {
        if (!readyReceived) readyReject(Error("race child closed before barrier"));
        try {
          if (childError) throw childError;
          assert.equal(overflow, false, "race child output exceeded finite bound");
          assert.equal(signal, null, "race child failed natural settlement/timeout");
          assert.equal(code, 0, stderr); resolve(JSON.parse(stdout));
        } catch (error) { reject(error); }
      });
    });
    return { ready, completion, release: () => child.send({ release: true }) };
  };
  const contenders = [launch(first), launch(candidate)];
  const settled = Promise.allSettled(contenders.map(child => child.completion));
  try {
    await Promise.all(contenders.map(child => child.ready));
    for (const child of contenders) child.release();
    const results = await Promise.all(contenders.map(child => child.completion));
    assert.ok(results.filter(result => result.hash).length <= 1, JSON.stringify(results));
    const fixedPath = path.join(root, "intent-0001.json"), observed = run(home, "observe");
    assert.equal(observed.error, undefined, JSON.stringify({ results, observed }));
    if (fs.existsSync(fixedPath)) {
      const fixed = fs.readFileSync(fixedPath);
      assert.ok(fixed.equals(encodeDashboardCutoverIntentV2(first))
        || fixed.equals(encodeDashboardCutoverIntentV2(candidate)));
      assert.equal(observed.before.history.historicalState, "unsettled");
    } else {
      assert.equal(results.filter(result => result.hash).length, 0);
      assert.equal(observed.before.history.historicalState, "empty");
      assert.equal(observed.before.storageState, "needs-reconciliation");
      assert.ok(observed.before.pendingStageCount > 0);
    }
  } finally {
    await settled;
    // Retain this exact private race fixture as physical evidence.
  }
});
