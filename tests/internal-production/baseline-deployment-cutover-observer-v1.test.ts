import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createDeploymentCutoverIntentV1, encodeDeploymentCutoverIntentV1 } from "../../src/internal-production/baseline-deployment-cutover-records-v1.js";

const intentBytes = encodeDeploymentCutoverIntentV1(createDeploymentCutoverIntentV1({
  oldDeployment: { checkoutPath: "/fixture/old", checkoutDirectoryIdentityHash: "a".repeat(64), sourceSha: "b".repeat(40), sourceTreeHash: "c".repeat(40), buildHash: "d".repeat(64) },
  newDeployment: { checkoutPath: "/fixture/new", checkoutDirectoryIdentityHash: "e".repeat(64), sourceSha: "f".repeat(40), sourceTreeHash: "1".repeat(40), buildHash: "2".repeat(64) },
  cliLinkObservationHash: "3".repeat(64), spawnerLauncherConfigurationHash: "4".repeat(64),
  dashboardLauncherConfigurationHash: "5".repeat(64), maintenanceIntentHash: "6".repeat(64), dashboardPort: 3333,
}));
function fixture(run: (home: string, root: string) => void): void {
  const home = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "cutover-observer-")));
  fs.mkdirSync(path.join(home, "ai", "setrox"), { recursive: true, mode: 0o700 });
  try { run(home, path.join(home, "ai", "setrox", "data", "internal-production-baseline", "deployment-cutover-v1")); }
  finally { fs.rmSync(home, { recursive: true, force: true }); }
}
function publishFixture(root: string): void {
  fs.mkdirSync(root, { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(root, "intent.json"), intentBytes, { mode: 0o600 });
}
function observe(home: string, fault = "", assertion = false): any {
  const moduleUrl = new URL("../../src/internal-production/baseline-deployment-cutover-v1.ts", import.meta.url).href;
  const child = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `
    import os from "node:os";
    import fs from "node:fs";
    import { syncBuiltinESMExports } from "node:module";
    const identity = os.userInfo(); os.userInfo = () => ({ ...identity, homedir: ${JSON.stringify(home)} });
    let observationActive = false;
    ${fault}
    syncBuiltinESMExports();
    const { observeDeploymentCutoverIntentV1, assertOrdinarySpawnerDeploymentCutoverAdmissionV1 } = await import(${JSON.stringify(moduleUrl)});
    observationActive = true;
    const run = () => ${assertion ? "(assertOrdinarySpawnerDeploymentCutoverAdmissionV1(), { admitted: true })" : "observeDeploymentCutoverIntentV1()"};
    try { process.stdout.write(JSON.stringify(run())); }
    catch (error) {
      let retryError = null;
      try { run(); } catch (retry) { retryError = retry.message; }
      process.stdout.write(JSON.stringify({ error: error.message, retryError,
        causes: (error.errors ?? []).map(cause => cause.message),
        closeAttempts: typeof closeAttempts === "undefined" ? null : closeAttempts }));
    }
  `], { encoding: "utf8", timeout: 10000, env: {} });
  assert.equal(child.status, 0, child.stderr);
  return JSON.parse(child.stdout);
}

test("ordinary assertion preserves absent compatibility without publishing authority", () => fixture((home, root) => {
  assert.deepEqual(observe(home, "", true), { admitted: true });
  assert.equal(fs.existsSync(root), false);
}));

test("ordinary assertion refuses persisted open intent in every fresh process", () => fixture((home, root) => {
  publishFixture(root);
  const original = fs.lstatSync(path.join(root, "intent.json"), { bigint: true });
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = observe(home, "", true);
    assert.equal(result.error, "DEPLOYMENT_CUTOVER_ORDINARY_START_REFUSED");
    assert.equal(result.retryError, result.error);
  }
  assert.deepEqual(fs.readFileSync(path.join(root, "intent.json")), intentBytes);
  assert.equal(fs.lstatSync(path.join(root, "intent.json"), { bigint: true }).ino, original.ino);
}));

test("ordinary assertion refuses partial publication without repairing it", () => fixture((home, root) => {
  fs.mkdirSync(root, { recursive: true, mode: 0o700 });
  const result = observe(home, "", true);
  assert.equal(result.error, "DEPLOYMENT_CUTOVER_OBSERVATION_INVALID");
  assert.equal(result.retryError, result.error);
  assert.deepEqual(fs.readdirSync(root), []);
}));

test("missing descendant is observed absent without creating any directory", () => fixture((home, root) => {
  assert.deepEqual(observe(home), { state: "absent" });
  assert.equal(fs.existsSync(path.join(home, "ai", "setrox", "data")), false);
  fs.mkdirSync(path.dirname(root), { recursive: true, mode: 0o700 });
  assert.deepEqual(observe(home), { state: "absent" });
  assert.equal(fs.existsSync(root), false);
}));

test("intent observer accepts legitimate partial reads without changing publication", () => fixture((home, root) => {
  publishFixture(root);
  const file = path.join(root, "intent.json"), inode = fs.lstatSync(file).ino;
  const result = observe(home, `const read=fs.readSync;fs.readSync=(fd,buffer,offset,length,position)=>read(fd,buffer,offset,observationActive?Math.min(3,length):length,position);`);
  assert.equal(result.state, "open", JSON.stringify(result));
  assert.deepEqual(result.intent, JSON.parse(intentBytes.toString()));
  assert.equal(fs.lstatSync(file).ino, inode); assert.deepEqual(fs.readFileSync(file), intentBytes);
}));

test("complete physical intent is open and remains byte-identical", () => fixture((home, root) => {
  publishFixture(root);
  assert.equal(observe(home).state, "open");
  assert.deepEqual(fs.readFileSync(path.join(root, "intent.json")), intentBytes);
  assert.deepEqual(fs.readdirSync(root), ["intent.json"]);
}));

for (const state of ["empty", "staging", "extra", "malformed", "symlink", "root-symlink", "mode", "root-mode", "parent-mode", "file-directory", "hardlink", "oversized"]) {
  test(`${state} cutover state refuses and is not cleaned up`, () => fixture((home, root) => {
    publishFixture(root);
    const file = path.join(root, "intent.json");
    if (state === "empty" || state === "staging") fs.unlinkSync(file);
    if (state === "staging" || state === "extra") fs.writeFileSync(path.join(root, ".intent.tmp"), "partial", { mode: 0o600 });
    if (state === "malformed") fs.writeFileSync(file, "{}\n");
    if (state === "mode") fs.chmodSync(file, 0o644);
    if (state === "root-mode") fs.chmodSync(root, 0o770);
    if (state === "parent-mode") fs.chmodSync(path.dirname(root), 0o770);
    if (state === "file-directory") { fs.unlinkSync(file); fs.mkdirSync(file, { mode: 0o700 }); }
    if (state === "hardlink") fs.linkSync(file, path.join(home, "alias.json"));
    if (state === "oversized") fs.writeFileSync(file, Buffer.alloc(65537));
    if (state === "symlink") { fs.renameSync(file, path.join(home, "outside.json")); fs.symlinkSync(path.join(home, "outside.json"), file); }
    if (state === "root-symlink") { fs.renameSync(root, path.join(home, "outside")); fs.symlinkSync(path.join(home, "outside"), root); }
    const names = fs.readdirSync(root);
    assert.match(observe(home).error, /DEPLOYMENT_CUTOVER_OBSERVATION_INVALID/);
    assert.deepEqual(fs.readdirSync(root), names);
  }));
}

test("same-byte inode replacement during read refuses", () => fixture((home, root) => {
  publishFixture(root);
  const file = path.join(root, "intent.json");
  const result = observe(home, `
    const read = fs.readSync; let changed = false;
    fs.readSync = (...args) => { const count = read(...args); if (observationActive && !changed) {
      changed = true; fs.renameSync(${JSON.stringify(file)}, ${JSON.stringify(path.join(home, "retired.json"))});
      fs.writeFileSync(${JSON.stringify(file)}, ${JSON.stringify(intentBytes.toString())}, { mode: 0o600 });
    } return count; };
  `);
  assert.match(result.error, /DEPLOYMENT_CUTOVER_OBSERVATION_INVALID/);
  assert.ok(fs.existsSync(path.join(home, "retired.json")));
}));

test("uncertain descriptor close refuses and poisons later observation", () => fixture((home, root) => {
  publishFixture(root);
  const result = observe(home, `
    const close = fs.closeSync; let failed = false;
    fs.closeSync = fd => { close(fd); if (observationActive && !failed) { failed = true; throw Error("INJECTED_CLOSE"); } };
  `);
  assert.match(result.error, /DEPLOYMENT_CUTOVER_OBSERVATION_INVALID/);
  assert.match(result.retryError, /DEPLOYMENT_CUTOVER_OBSERVATION_INVALID/);
  assert.deepEqual(fs.readFileSync(path.join(root, "intent.json")), intentBytes);
}));

test("parent replacement with a surviving intent inode refuses", () => fixture((home, root) => {
  publishFixture(root);
  const parent = path.dirname(root), retired = path.join(home, "retired-parent");
  const result = observe(home, `
    const read = fs.readSync; let changed = false;
    fs.readSync = (...args) => { const count = read(...args); if (observationActive && !changed) {
      changed = true; fs.renameSync(${JSON.stringify(parent)}, ${JSON.stringify(retired)});
      fs.mkdirSync(${JSON.stringify(parent)}, { mode: 0o700 });
      fs.renameSync(${JSON.stringify(path.join(retired, path.basename(root)))}, ${JSON.stringify(root)});
    } return count; };
  `);
  assert.match(result.error, /DEPLOYMENT_CUTOVER_OBSERVATION_INVALID/);
  assert.deepEqual(fs.readFileSync(path.join(root, "intent.json")), intentBytes);
}));

test("publication between two absence observations cannot be reported absent", () => fixture((home, root) => {
  fs.mkdirSync(path.dirname(root), { recursive: true, mode: 0o700 });
  const result = observe(home, `
    const lstat = fs.lstatSync; let changed = false;
    fs.lstatSync = (...args) => {
      try { return lstat(...args); } catch (error) {
        if (observationActive && !changed && args[0] === ${JSON.stringify(root)} && error.code === "ENOENT") {
          changed = true; fs.mkdirSync(${JSON.stringify(root)}, { mode: 0o700 });
        }
        throw error;
      }
    };
  `);
  assert.match(result.error, /DEPLOYMENT_CUTOVER_OBSERVATION_INVALID/);
  assert.deepEqual(fs.readdirSync(root), []);
}));

test("failed workspace acquisition never retries a consumed descriptor", () => fixture((home, root) => {
  publishFixture(root);
  const result = observe(home, `
    const close = fs.closeSync, fstat = fs.fstatSync, closeAttempts = [];
    let failedStat = false, failedClose = false;
    fs.fstatSync = (...args) => { if (observationActive && !failedStat) { failedStat = true; throw Error("INJECTED_ACQUISITION"); } return fstat(...args); };
    fs.closeSync = fd => { if (observationActive) closeAttempts.push(fd); close(fd);
      if (observationActive && !failedClose) { failedClose = true; throw Error("INJECTED_CONSUMED_CLOSE"); } };
  `);
  assert.equal(result.closeAttempts.length, 1);
  assert.deepEqual(result.causes, ["INJECTED_ACQUISITION", "INJECTED_CONSUMED_CLOSE"]);
  assert.match(result.retryError, /DEPLOYMENT_CUTOVER_OBSERVATION_INVALID/);
}));
