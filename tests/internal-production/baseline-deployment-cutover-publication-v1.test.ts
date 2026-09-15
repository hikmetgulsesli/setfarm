import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createDeploymentCutoverIntentV1, encodeDeploymentCutoverIntentV1 } from "../../src/internal-production/baseline-deployment-cutover-records-v1.js";

const intent = createDeploymentCutoverIntentV1({
  oldDeployment: { checkoutPath: "/fixture/old", checkoutDirectoryIdentityHash: "a".repeat(64), sourceSha: "b".repeat(40), sourceTreeHash: "c".repeat(40), buildHash: "d".repeat(64) },
  newDeployment: { checkoutPath: "/fixture/new", checkoutDirectoryIdentityHash: "e".repeat(64), sourceSha: "f".repeat(40), sourceTreeHash: "1".repeat(40), buildHash: "2".repeat(64) },
  cliLinkObservationHash: "3".repeat(64), spawnerLauncherConfigurationHash: "4".repeat(64),
  dashboardLauncherConfigurationHash: "5".repeat(64), maintenanceIntentHash: "6".repeat(64), dashboardPort: 3333,
});
const bytes = encodeDeploymentCutoverIntentV1(intent);
function fixture(body: (home: string, root: string) => void): void {
  const home = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "cutover-publication-")));
  const baseline = path.join(home, "ai", "setrox", "data", "internal-production-baseline");
  fs.mkdirSync(baseline, { recursive: true, mode: 0o700 });
  try { body(home, path.join(baseline, "deployment-cutover-v1")); }
  finally { fs.rmSync(home, { recursive: true, force: true }); }
}
function run(home: string, input: unknown = intent, fault = "", observeOnly = false, retryOnFailure = false): any {
  const publisher = new URL("../../src/internal-production/baseline-deployment-cutover-publication-v1.ts", import.meta.url).href;
  const observer = new URL("../../src/internal-production/baseline-deployment-cutover-v1.ts", import.meta.url).href;
  const result = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `
    import os from "node:os";
    import fs from "node:fs";
    import { syncBuiltinESMExports } from "node:module";
    const identity = os.userInfo(); os.userInfo = () => ({...identity, homedir:${JSON.stringify(home)}});
    let active = false; let inspect = () => null; let publication;
    ${fault}
    syncBuiltinESMExports();
    try {
      const module = await import(${JSON.stringify(publisher)});
      publication = module.publishDeploymentCutoverIntentV1;
      const observation = await import(${JSON.stringify(observer)});
      active = true;
      if (${observeOnly}) { process.stdout.write(JSON.stringify(observation.observeDeploymentCutoverIntentV1())); process.exit(0); }
      const published = module.publishDeploymentCutoverIntentV1(${JSON.stringify(input)});
      let ordinaryError = null;
      try { observation.assertOrdinarySpawnerDeploymentCutoverAdmissionV1(); } catch (error) { ordinaryError = error.message; }
      process.stdout.write(JSON.stringify({ published, state:observation.observeDeploymentCutoverIntentV1().state, ordinaryError, evidence:inspect() }));
    } catch (error) {
      let retryError = null;
      if (${retryOnFailure} && publication) { try { publication(${JSON.stringify(input)}); } catch (retry) { retryError = retry.message; } }
      process.stdout.write(JSON.stringify({error:error.message, retryError, evidence:inspect()}));
    }
  `], { encoding: "utf8", timeout: 10000, env: {} });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test("publication creates durable refusal and exact finalized replay preserves its inode", () => fixture((home, root) => {
  const first = run(home);
  assert.equal(first.state, "open", JSON.stringify(first));
  assert.equal(first.ordinaryError, "DEPLOYMENT_CUTOVER_ORDINARY_START_REFUSED");
  assert.equal(first.published.cutoverIntentHash, intent.cutoverIntentHash);
  const file = path.join(root, "intent.json"), before = fs.lstatSync(file, { bigint: true });
  assert.equal(before.nlink, 1n);
  assert.equal(before.mode & 0o7777n, 0o600n);
  assert.equal(fs.lstatSync(root).mode & 0o7777, 0o700);
  assert.deepEqual(fs.readFileSync(file), bytes);
  assert.deepEqual(fs.readdirSync(root), ["intent.json"]);
  assert.equal(run(home).state, "open");
  assert.equal(fs.lstatSync(file, { bigint: true }).ino, before.ino);
  assert.deepEqual(fs.readFileSync(file), bytes);
}));

test("conflicting replay refuses without replacing the original intent", () => fixture((home, root) => {
  fs.mkdirSync(root, { mode: 0o700 });
  const file = path.join(root, "intent.json");
  fs.writeFileSync(file, bytes, { mode: 0o600 });
  const before = fs.lstatSync(file, { bigint: true });
  const { schema, purpose, cutoverIntentHash, cutoverIntentRef, ...input } = intent;
  const conflicting = createDeploymentCutoverIntentV1({ ...input, cliLinkObservationHash: "7".repeat(64) });
  assert.match(run(home, conflicting).error, /DEPLOYMENT_CUTOVER_PUBLICATION_INVALID/);
  assert.equal(fs.lstatSync(file, { bigint: true }).ino, before.ino);
  assert.deepEqual(fs.readFileSync(file), bytes);
}));

test("partial publication refuses without repairing or removing retained evidence", () => fixture((home, root) => {
  fs.mkdirSync(root, { mode: 0o700 });
  fs.writeFileSync(path.join(root, ".foreign.tmp"), "partial", { mode: 0o600 });
  assert.match(run(home).error, /DEPLOYMENT_CUTOVER_PUBLICATION_INVALID/);
  assert.deepEqual(fs.readdirSync(root), [".foreign.tmp"]);
  assert.equal(fs.readFileSync(path.join(root, ".foreign.tmp"), "utf8"), "partial");
}));

test("finalized replay must flush the authenticated intent inode before returning", () => fixture((home, root) => {
  fs.mkdirSync(root, { mode: 0o700 });
  const file = path.join(root, "intent.json");
  fs.writeFileSync(file, bytes, { mode: 0o600 });
  const before = fs.lstatSync(file, { bigint: true });
  const result = run(home, intent, `
    const sync = fs.fsyncSync;
    fs.fsyncSync = fd => { if (active && fs.fstatSync(fd).isFile()) throw Error("REPLAY_DATA_SYNC_FAILED"); return sync(fd); };
  `);
  assert.match(result.error, /DEPLOYMENT_CUTOVER_PUBLICATION_INVALID/);
  assert.equal(fs.lstatSync(file, { bigint: true }).ino, before.ino);
  assert.deepEqual(fs.readFileSync(file), bytes);
}));

for (const fault of ["root-response", "stage-response", "short-write", "file-sync", "link-response", "unlink-response", "root-sync"]) {
  test(`${fault} preserves physical evidence and never reopens ordinary admission`, () => fixture((home, root) => {
    const result = run(home, intent, `
      const fault = ${JSON.stringify(fault)}, root = ${JSON.stringify(root)};
      const mkdir = fs.mkdirSync, open = fs.openSync, write = fs.writeFileSync, sync = fs.fsyncSync, link = fs.linkSync, unlink = fs.unlinkSync;
      fs.mkdirSync = (...args) => { const value = mkdir(...args); if (active && fault === "root-response" && args[0] === root) throw Error("ROOT_RESPONSE_LOST"); return value; };
      fs.openSync = (...args) => { const value = open(...args); if (active && fault === "stage-response" && String(args[0]).endsWith(".tmp")) { fs.closeSync(value); throw Error("STAGE_RESPONSE_LOST"); } return value; };
      fs.writeFileSync = (...args) => { if (active && fault === "short-write" && typeof args[0] === "number") return write(args[0], args[1].subarray(0, 5)); return write(...args); };
      fs.fsyncSync = fd => { if (active && ((fault === "file-sync" && fs.fstatSync(fd).isFile()) || (fault === "root-sync" && fs.fstatSync(fd).ino === fs.lstatSync(root).ino))) throw Error("SYNC_FAILED"); return sync(fd); };
      fs.linkSync = (...args) => { const value = link(...args); if (active && fault === "link-response") throw Error("LINK_RESPONSE_LOST"); return value; };
      fs.unlinkSync = (...args) => { const value = unlink(...args); if (active && fault === "unlink-response") throw Error("UNLINK_RESPONSE_LOST"); return value; };
    `);
    assert.match(result.error, /DEPLOYMENT_CUTOVER_PUBLICATION_INVALID/);
    assert.ok(fs.existsSync(root));
    const observed = run(home, intent, "", true);
    if (["unlink-response", "root-sync"].includes(fault)) {
      assert.equal(observed.state, "open");
      assert.deepEqual(fs.readFileSync(path.join(root, "intent.json")), bytes);
    } else {
      assert.match(observed.error, /DEPLOYMENT_CUTOVER_OBSERVATION_INVALID/);
      const names = fs.readdirSync(root);
      assert.match(run(home).error, /DEPLOYMENT_CUTOVER_PUBLICATION_INVALID/);
      assert.deepEqual(fs.readdirSync(root), names);
    }
  }));
}

test("invalid intent causes no authority directory creation", () => fixture((home, root) => {
  assert.match(run(home, {}).error, /DEPLOYMENT_CUTOVER_INTENT_INVALID/);
  assert.equal(fs.existsSync(root), false);
}));

for (const change of ["stage-replacement", "foreign-hardlink", "ancestor-replacement", "unexpected-file"]) {
  test(`${change} after linking preserves foreign and original evidence`, () => fixture((home, root) => {
    const outside = path.join(home, "retained"), foreign = path.join(home, "foreign");
    fs.writeFileSync(foreign, "foreign sentinel", { mode: 0o600 });
    const result = run(home, intent, `
      const link = fs.linkSync; let changed = false;
      fs.linkSync = (...args) => {
        const value = link(...args);
        if (active && !changed) {
          changed = true;
          const change = ${JSON.stringify(change)};
          if (change === "stage-replacement") { fs.renameSync(args[0], ${JSON.stringify(outside)}); link(${JSON.stringify(foreign)}, args[0]); }
          if (change === "foreign-hardlink") link(args[0], ${JSON.stringify(outside)});
          if (change === "ancestor-replacement") { fs.renameSync(${JSON.stringify(path.dirname(root))}, ${JSON.stringify(outside)}); fs.mkdirSync(${JSON.stringify(path.dirname(root))}, {mode:0o700}); }
          if (change === "unexpected-file") link(${JSON.stringify(foreign)}, ${JSON.stringify(path.join(root, "foreign.json"))});
        }
        return value;
      };
    `);
    assert.match(result.error, /DEPLOYMENT_CUTOVER_PUBLICATION_INVALID/);
    assert.equal(fs.readFileSync(foreign, "utf8"), "foreign sentinel");
    const retainedRoot = change === "ancestor-replacement" ? path.join(outside, "deployment-cutover-v1") : root;
    assert.deepEqual(fs.readFileSync(path.join(retainedRoot, "intent.json")), bytes);
    const names = fs.readdirSync(retainedRoot);
    assert.ok(names.some(name => name.endsWith(".tmp")));
    if (change === "stage-replacement") assert.equal(fs.readFileSync(path.join(root, names.find(name => name.endsWith(".tmp"))!), "utf8"), "foreign sentinel");
    if (change === "foreign-hardlink") assert.deepEqual(fs.readFileSync(outside), bytes);
    if (change === "unexpected-file") assert.equal(fs.readFileSync(path.join(root, "foreign.json"), "utf8"), "foreign sentinel");
  }));
}

test("uncertain close consumes ownership once and preserves a reused descriptor", () => fixture((home, root) => {
  const sentinel = path.join(home, "sentinel");
  fs.writeFileSync(sentinel, "retained descriptor", { mode: 0o600 });
  const result = run(home, intent, `
    const close = fs.closeSync; let failed = false, selected = null, attempts = 0;
    fs.closeSync = fd => {
      if (fd === selected) attempts++;
      if (active && !failed) {
        failed = true; selected = fd; attempts = 1; close(fd);
        const replacement = fs.openSync(${JSON.stringify(sentinel)}, fs.constants.O_RDONLY);
        if (replacement !== fd) throw Error("SENTINEL_SLOT_NOT_REUSED");
        throw Error("CLOSE_RESPONSE_LOST");
      }
      return close(fd);
    };
    inspect = () => { let preserved = false; try { preserved = fs.fstatSync(selected).ino === fs.lstatSync(${JSON.stringify(sentinel)}).ino; } catch {} return {attempts,preserved}; };
  `, false, true);
  assert.match(result.error, /DEPLOYMENT_CUTOVER_PUBLICATION_INVALID/);
  assert.match(result.retryError, /DEPLOYMENT_CUTOVER_PUBLICATION_INVALID/);
  assert.deepEqual(result.evidence, { attempts: 1, preserved: true });
  assert.deepEqual(fs.readFileSync(path.join(root, "intent.json")), bytes);
}));

for (const shape of ["root-symlink", "parent-symlink", "root-mode", "parent-mode", "intent-hardlink"]) {
  test(`${shape} refuses without replacing existing paths`, () => fixture((home, root) => {
    fs.mkdirSync(root, { mode: 0o700 });
    fs.writeFileSync(path.join(root, "intent.json"), bytes, { mode: 0o600 });
    const outside = path.join(home, "outside");
    if (shape === "root-symlink") { fs.renameSync(root, outside); fs.symlinkSync(outside, root); }
    if (shape === "parent-symlink") { fs.renameSync(path.dirname(root), outside); fs.symlinkSync(outside, path.dirname(root)); }
    if (shape === "root-mode") fs.chmodSync(root, 0o770);
    if (shape === "parent-mode") fs.chmodSync(path.dirname(root), 0o770);
    if (shape === "intent-hardlink") fs.linkSync(path.join(root, "intent.json"), outside);
    const before = fs.lstatSync(root, { bigint: true });
    assert.match(run(home).error, /DEPLOYMENT_CUTOVER_PUBLICATION_INVALID/);
    assert.equal(fs.lstatSync(root, { bigint: true }).ino, before.ino);
    assert.deepEqual(fs.readFileSync(path.join(root, "intent.json")), bytes);
  }));
}
